import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Yard from './scene/Yard'
import usePlayback from './usePlayback'
import TopBar from './ui/TopBar'
import { SelectBand, SelectLegend, GuidanceBand, UnaidedBand } from './ui/Instruction'
import Procedure from './ui/Procedure'
import Report from './ui/Report'
import { HitchPanel, InputsPanel } from './ui/Instruments'
import ModelPanel from './ui/ModelPanel'
import About from './ui/About'
import Home from './ui/Home'
import Transport, { SPEEDS } from './ui/Transport'
import { I } from './ui/icons'
import {
  loadManifest, loadLot, sampleFrames, stepIndexAt, horizonAt, fmt,
  detectLive, createLot, pollLot, fetchPlan, mergeLot, draftLot, occupiedIds, liveProgress, randomOccupancy, sameIds,
  previewLot, specOf, sameSpec, lockTurns,
} from './data'
import { layoutShort, prediction, history, termScale } from './derive'

const DEFAULT_SPEED = 1 // real time; the library is precomputed at realistic yard speeds
const POLL_MS = 500
const shortReason = (r) => (r || '').replace('guidance not certified ', '').replace(/[()]/g, '') || 'failed a check'

function tipFor(b, editing) {
  if (editing) return b.occupied ? 'Filled. Click to make it free.' : 'Free. Click to fill it with a parked truck.'
  switch (b.status) {
    case 'ok': return 'Certified. Click to start guided parking.'
    case 'occupied': return 'Occupied'
    case 'pending': return 'Queued for the live solver. Click to start as soon as it is certified.'
    case 'solving': return 'Being planned, driven and certified. Click to start as soon as it is certified.'
    case 'deepening': return 'The first attempt did not certify, so it is being tried again: another route, or pulling forward and parking again. Click to start as soon as it is certified.'
    default: return `Not certified: ${shortReason(b.reason)}`
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')     // 'home' (intro + configurations) or 'lot'
  const wantSetup = useRef(false)                  // open the next loaded library fill in the set-up step
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)
  const [layoutName, setLayoutName] = useState('cross')
  const [seedIdx, setSeedIdx] = useState(0)
  const [lot, setLot] = useState(null)              // the library fill on screen
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('select')
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [autoPause, setAutoPause] = useState(false)
  const [baseline, setBaselineState] = useState(false)
  const [view, setView] = useState('tilt')
  const [follow, setFollow] = useState(true)
  const [railTab, setRailTab] = useState('steps')
  // version 2: the live solver (server.py)
  const [live, setLive] = useState(null)            // {version, workers} while the server answers, else null
  const [liveLot, setLiveLot] = useState(null)      // {id, lot, done, elapsed}: a lot being / been solved live
  const [editing, setEditing] = useState(null)      // {base, occupied: Set} while the fill is being edited
  const [waitFor, setWaitFor] = useState(null)      // a bay clicked while it was still being solved
  const [busy, setBusy] = useState(false)           // a new-lot request is on its way
  const [notice, setNotice] = useState(null)        // {kind, text}
  const [vspec, setVspec] = useState(null)          // the rig set in the set-up step (a spec, see data.js); null = the library rig
  const [preview, setPreview] = useState(null)      // {key, lot}: the lot being set up, re-sized for that rig (unsolved)

  useEffect(() => {
    loadManifest().then((m) => {
      setManifest(m)
      setLayoutName((cur) => (m.layouts.some((l) => l.name === cur) ? cur : m.layouts[0]?.name))
    }).catch((e) => setError(e.message))
    // a busy laptop can miss the first health check while the page loads: look a few times before going library-only
    let dead = false
    const look = (n) => detectLive(2500).then((h) => {
      if (dead) return
      if (h || n <= 1) setLive(h)
      else setTimeout(() => look(n - 1), 1500)
    })
    look(3)
    return () => { dead = true }
  }, [])

  // the rig: the library's unless the live solver is on and a different one was set up
  const libSpec = useMemo(() => (lot ? specOf(lot.vehicle) : null), [lot])
  const vehicleEdit = live?.vehicle || null          // {limits, jack_gap} while the live solver answers
  const rigSpec = (vehicleEdit && vspec) || libSpec
  const setRig = (spec) => setVspec(sameSpec(spec, libSpec) ? null : spec)
  const rigChanged = !!editing && !!rigSpec && !sameSpec(rigSpec, specOf(editing.base.vehicle))   // solve on continue
  const previewKey = rigChanged ? JSON.stringify([editing.base.layout.name, editing.base.layout.seed, occupiedIds(editing.base), rigSpec]) : null
  const draftBase = editing && (rigChanged && preview?.key === previewKey ? preview.lot : editing.base)

  // what is on screen: the fill being edited, else the live lot, else the library fill
  const shown = useMemo(() => (editing ? draftLot(draftBase, editing.occupied) : liveLot ? liveLot.lot : lot),
    [editing, draftBase, liveLot, lot])
  const shownRef = useRef(shown)
  shownRef.current = shown

  // while setting up with a different rig, show the lot re-sized for it (bays, aisle, parked trucks)
  useEffect(() => {
    if (!previewKey || preview?.key === previewKey) return
    const [layout, seed, occupied, vehicle] = JSON.parse(previewKey)
    let dead = false
    const timer = setTimeout(() => {
      previewLot({ layout, seed, occupied, vehicle })
        .then((r) => { if (!dead) setPreview({ key: previewKey, lot: r.lot }) })
        .catch(() => {})                              // keep showing the current geometry; the solve reports errors
    }, 150)
    return () => { dead = true; clearTimeout(timer) }
  }, [previewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const entry = useMemo(() => manifest?.layouts.find((l) => l.name === layoutName), [manifest, layoutName])
  const plan = shown && selected != null ? shown.plans[String(selected)] : null
  const steps = plan && !baseline ? plan.steps : []
  const runFrames = plan ? (baseline ? plan.baseline.frames : plan.frames) : null
  const runDuration = plan ? (baseline ? plan.baseline.duration : plan.duration) : 0
  const pb = usePlayback({ duration: runDuration, steps, speed, autoPause })
  const pbRef = useRef(pb)
  pbRef.current = pb

  const resetView = () => { setSelected(null); setMode('select'); setBaselineState(false); setWaitFor(null); pb.seek(0) }
  const toLibrary = () => { setLiveLot(null); setEditing(null); resetView() }
  // The set-up step opens on an empty lot and the user parks the trucks; without the live solver the fill cannot be
  // changed, so it shows the library fill.
  const setupStart = (d) => (live ? new Set() : new Set(occupiedIds(d)))

  useEffect(() => {
    if (!entry) return
    const seed = entry.seeds[seedIdx % entry.seeds.length]
    let dead = false
    loadLot(seed.file).then((d) => {
      if (dead) return
      setLot(d); setSelected(null); setMode('select'); setBaselineState(false); pb.seek(0)
      if (wantSetup.current) { wantSetup.current = false; const s = setupStart(d); setEditing({ base: d, start: s, occupied: s }) }
    }).catch((e) => setError(e.message))
    return () => { dead = true }
  }, [entry, seedIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((id) => {
    const b = shownRef.current?.layout.bays[id]
    if (b && (b.status === 'pending' || b.status === 'solving' || b.status === 'deepening')) { setWaitFor(id); return }   // start it once certified
    setWaitFor(null); setSelected(id); setMode('guide'); setBaselineState(false); setRailTab('steps'); setHovered(null); pb.restart()
  }, [pb.restart]) // eslint-disable-line react-hooks/exhaustive-deps
  const backToLot = () => { setMode('select'); setSelected(null); setBaselineState(false); pb.seek(0) }
  const setBaseline = (b) => { if (b !== baseline) { setBaselineState(b); pb.restart() } }
  const nSeeds = entry?.seeds.length || 1
  const stepSeed = (d) => {
    const setup = !!editing                        // stepping fills during set-up stays in set-up
    toLibrary()
    if (setup) wantSetup.current = true
    setSeedIdx((i) => (i + d + nSeeds) % nSeeds)
  }
  // Open a configuration: its first library fill, in the set-up step (which bays are free and which are filled).
  const enterLot = (name) => {
    setScreen('lot'); toLibrary(); setHovered(null)
    if (lot && lot.layout.name === name && layoutName === name && seedIdx % nSeeds === 0) {
      const s = setupStart(lot)
      setEditing({ base: lot, start: s, occupied: s })
    } else {
      wantSetup.current = true; setLayoutName(name); setSeedIdx(0)
    }
  }
  const goHome = () => { toLibrary(); setScreen('home') }

  // ---- version 2: live lots ----
  const startLive = async (spec) => {
    setBusy(true); setNotice(null)
    try {
      const r = await createLot(spec)
      setEditing(null); resetView()
      setLiveLot({ id: r.lot_id, lot: r.lot, done: false, elapsed: 0 })
    } catch (e) {
      setNotice({ kind: 'danger', text: `The live solver did not answer (${e.message}). The library fills still work.` })
      detectLive().then(setLive)
    } finally {
      setBusy(false)
    }
  }
  const rigField = () => (vehicleEdit && vspec ? { vehicle: vspec } : {})
  const newRandomLot = () => startLive({ layout: layoutName, ...rigField() })
  const startEdit = () => {
    const base = shownRef.current
    if (!base) return
    resetView()
    const s = new Set(occupiedIds(base))
    setEditing({ base, start: s, occupied: s })
  }
  const toggleBay = (id) => {
    if (!live) {
      setNotice({ kind: 'info', text: 'Changing the fill needs the live solver (start v2/run_demo.bat). Random fill steps through the pre-solved fills.' })
      return
    }
    setEditing((e) => {
      const occupied = new Set(e.occupied)
      if (occupied.has(id)) occupied.delete(id)
      else occupied.add(id)
      return { ...e, occupied }
    })
  }
  const randomFill = () => {
    if (!live) { stepSeed(1); return }             // offline: the next pre-solved library fill
    setEditing((e) => e && { ...e, occupied: new Set(randomOccupancy(e.base)) })
  }
  const resetFill = () => setEditing((e) => e && { ...e, occupied: e.start })
  const changed = !!editing && (rigChanged || !sameIds(editing.occupied, occupiedIds(editing.base)))   // not solved yet: solve on continue
  const dirty = !!editing && !sameIds(editing.occupied, editing.start)                // moved since set-up began: can reset
  const solveEdit = () => startLive({ layout: editing.base.layout.name, seed: editing.base.layout.seed,
    occupied: [...editing.occupied].sort((a, b) => a - b), ...rigField() })
  // Continue from set-up: an unchanged fill is already solved (library or live); a changed one is solved live first.
  const continueSetup = () => {
    if (!editing) return
    if (changed) solveEdit()
    else setEditing(null)
  }

  // poll the live lot until every free bay has a verdict, fetching each certified plan once
  const liveRef = useRef(liveLot)
  liveRef.current = liveLot
  useEffect(() => {
    if (!liveLot || liveLot.done) return
    const id = liveLot.id
    let dead = false, timer = null
    const tick = async () => {
      try {
        const st = await pollLot(id)
        const cur = liveRef.current
        if (dead || !cur || cur.id !== id) return
        const need = st.bays.filter((b) => b.status === 'ok' && !cur.lot.plans[String(b.id)])
        const plans = {}
        await Promise.all(need.map(async (b) => { plans[b.id] = await fetchPlan(id, b.id) }))
        if (dead) return
        setLiveLot((c) => (c && c.id === id ? { ...c, lot: mergeLot(c.lot, st.bays, plans), done: st.done, elapsed: st.elapsed } : c))
        if (!st.done) timer = setTimeout(tick, POLL_MS)
      } catch {
        if (dead) return
        setLive(null)
        setNotice({ kind: 'danger', text: 'Lost the live solver (was the server stopped?). Bays not yet certified cannot be driven; the library fills still work.' })
        setLiveLot((c) => {
          if (!c || c.id !== id) return c
          const lost = c.lot.layout.bays.filter((b) => b.status === 'pending' || b.status === 'solving' || b.status === 'deepening')
            .map((b) => ({ id: b.id, status: 'infeasible', reason: 'live solver stopped' }))
          return { ...c, lot: mergeLot(c.lot, lost), done: true, lost: true }
        })
      }
    }
    tick()
    return () => { dead = true; clearTimeout(timer) }
  }, [liveLot?.id, liveLot?.done]) // eslint-disable-line react-hooks/exhaustive-deps

  // a bay clicked while still being solved starts as soon as it is certified
  useEffect(() => {
    if (waitFor == null || !liveLot) return
    const b = liveLot.lot.layout.bays[waitFor]
    if (b?.status === 'ok') pick(waitFor)
    else if (b?.status === 'infeasible') {
      setNotice({ kind: 'info', text: `Bay ${waitFor + 1} could not be certified (${shortReason(b.reason)}). Choose another green bay.` })
      setWaitFor(null)
    }
  }, [liveLot, waitFor, pick])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 9000)
    return () => clearTimeout(t)
  }, [notice])

  // keyboard: space play/pause, arrows step, [ ] slower/faster
  useEffect(() => {
    if (mode !== 'guide') return
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const p = pbRef.current
      if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); p.toggle() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? p.seek(p.t + 5) : p.nextStep() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? p.seek(p.t - 5) : p.prevStep() }
      else if (e.key === ']') setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)])
      else if (e.key === '[') setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const frame = plan && runFrames ? sampleFrames(runFrames, pb.t) : null
  const frameText = plan && runFrames ? sampleFrames(runFrames, pb.tText) : null
  const cur = steps.length ? steps[stepIndexAt(steps, pb.t)] : null
  const advised = cur && cur.kind === 'drive' && pb.t < runDuration - 0.2 ? { turns: cur.turns, kmh: cur.speed_kmh } : null
  const bays = shown ? shown.layout.bays : []
  const okCount = bays.filter((b) => b.status === 'ok').length
  const free = bays.filter((b) => b.status !== 'occupied').length
  const hoveredBay = hovered != null && shown ? bays[hovered] : null
  const jackknifed = baseline && plan && plan.baseline.jackknife && pb.t >= plan.baseline.duration - 0.3
  const parked = !baseline && plan && pb.t >= plan.duration - 0.2
  const guide = mode === 'guide' && plan && frame
  const pred = useMemo(() => (guide && !baseline ? prediction(horizonAt(plan.hor, pb.tText)) : null), [guide, baseline, plan, pb.tText])
  const hist = useMemo(() => (guide ? history(runFrames, pb.tText) : []), [guide, runFrames, pb.tText])
  const scale = useMemo(() => (plan && shown ? termScale(runFrames, shown.vehicle) : 10), [plan, runFrames, shown])
  const lock = shown ? lockTurns(shown.vehicle) : 1.75
  const library = useMemo(() => {
    if (!manifest) return null
    let ok = 0, fr = 0, fills = 0
    for (const l of manifest.layouts) for (const s of l.seeds) { ok += s.ok; fr += s.free; fills++ }
    return { ok, free: fr, fills, layouts: manifest.layouts.length }
  }, [manifest])
  const layoutStats = entry ? entry.seeds.reduce((a, s) => ({ ok: a.ok + s.ok, free: a.free + s.free }), { ok: 0, free: 0 }) : null
  const progress = liveLot ? { ...liveProgress(liveLot.lot), done: liveLot.done, elapsed: liveLot.elapsed, lost: !!liveLot.lost } : null
  const lotName = liveLot ? `live lot ${liveLot.lot.layout.seed}` : `fill ${seedIdx % nSeeds + 1}`
  const noBar = !guide && !editing && !!liveLot          // a solved live lot has no status footer

  if (error) {
    return (
      <div className="fatal">
        <div className="panel">
          <header className="panel-h"><h3>Demo data not found</h3></header>
          <p className="prose">{error}</p>
          <p className="fine">Generate the library with <code>python -m sim.export</code>, then reload.</p>
        </div>
      </div>
    )
  }

  if (screen === 'home') {
    return (
      <div className="app home-screen">
        <Home manifest={manifest} live={live} onChoose={enterLot} />
      </div>
    )
  }

  return (
    <div className={`app ${guide ? 'is-guide' : 'is-select'} ${noBar ? 'no-bar' : ''}`}>
      <TopBar onHome={goHome} manifest={manifest} layoutName={layoutName} live={live} />

      <main className="work">
        {guide && (
          <aside className="rail" aria-label="Procedure and report">
            <header className="rail-h">
              <div><h2>Bay {selected + 1}</h2><p>{layoutShort(entry || shown.layout)} &middot; {lotName}</p></div>
              <button className="btn sm" onClick={backToLot} title="Back to bay selection">{I.chevL}Change bay</button>
            </header>
            <div className="seg rail-tabs" role="group" aria-label="Rail view">
              <button aria-pressed={railTab === 'steps'} onClick={() => setRailTab('steps')}>Procedure</button>
              <button aria-pressed={railTab === 'report'} onClick={() => setRailTab('report')}>Run report</button>
            </div>
            {railTab === 'steps'
              ? (baseline
                ? <div className="scroll"><p className="empty">The unaided driver has no plan and no instructions. Switch back to <b>Guided</b> for the procedure, or open the <b>Run report</b> for the comparison.</p></div>
                : <Procedure steps={plan.steps} t={pb.t} onSeek={pb.seek} lock={lock} />)
              : <Report plan={plan} vehicle={shown.vehicle} />}
          </aside>
        )}

        <section className="center">
          {guide
            ? (baseline
              ? <UnaidedBand plan={plan} t={pb.t} frame={frame} baseline={baseline} setBaseline={setBaseline} onReport={() => setRailTab('report')} />
              : <GuidanceBand steps={steps} t={pb.t} duration={plan.duration} plan={plan} baseline={baseline} setBaseline={setBaseline} onReport={() => setRailTab('report')} lock={lock} />)
            : <SelectBand okCount={okCount} free={free} live={live} progress={progress} editing={!!editing} parked={bays.length - free}
                changed={changed} dirty={dirty} busy={busy} waitFor={waitFor} onRandom={newRandomLot} onEdit={startEdit}
                onRandomFill={randomFill} onReset={resetFill} onContinue={continueSetup} />}

          <div className="stage">
            {shown ? (
              <Yard lot={shown} plan={plan} baseline={baseline} selected={selected} hovered={hovered} onHover={setHovered} onPick={pick}
                t={pb.t} mode={mode} view={view} focusRig={follow} editing={!!editing} onToggle={toggleBay} rig={!editing} />
            ) : <div className="loading">Loading yard&hellip;</div>}

            <div className="viewbar" role="group" aria-label="Camera">
              <div className="seg">
                <button aria-pressed={view === 'top'} onClick={() => setView('top')} title="Plan view">Plan</button>
                <button aria-pressed={view === 'tilt'} onClick={() => setView('tilt')} title="Tilted 3-D view">3-D</button>
              </div>
              {guide && (
                <div className="seg">
                  <button aria-pressed={follow} onClick={() => setFollow(!follow)} title="Keep the rig centred">Follow rig</button>
                </div>
              )}
            </div>

            {!guide && hoveredBay && (
              <div className="tip" role="status">
                <b>Bay {hoveredBay.id + 1}</b>
                <span>{tipFor(hoveredBay, !!editing)}</span>
              </div>
            )}

            {guide ? (
              <ul className="legend" aria-label="Legend">
                <li><i className="ln ln-path" />Planned path (Hybrid A*)</li>
                {!baseline && <li><i className="ln ln-ghost" />NMPC look-ahead: rig in 3, 6, 9 s</li>}
                {!baseline && <li><i className="ln ln-pred" />Predicted tractor and trailer axles</li>}
                <li><i className="ln ln-trail" style={baseline ? { background: 'var(--danger)' } : null} />Driven so far</li>
              </ul>
            ) : shown && <SelectLegend editing={!!editing} solving={!!(progress && !progress.done)} />}

            {jackknifed && (
              <div className="toast danger" role="alert">
                {I.alert}<div><b>Jackknife at {fmt(plan.baseline.t_jack, 1)} s.</b> The hitch angle passed {fmt(plan.baseline.max_psi_deg, 0)}° with guidance off.</div>
              </div>
            )}
            {parked && (
              <div className="toast ok" role="status">
                {I.parked}<div><b>Parked in bay {selected + 1}.</b> {fmt(Math.abs(plan.metrics.final.lat), 2)} m off-centre, {fmt(Math.abs(plan.metrics.final.hdg), 1)}° from aligned.</div>
              </div>
            )}
            {guide && baseline && !plan.baseline.jackknife && pb.t < 3 && (
              <div className="toast info" role="status">
                {I.info}<div>Forward driving is self-stabilising, so the unaided driver also parks here. The difference appears when reversing.</div>
              </div>
            )}
            {!guide && notice && (
              <div className={`toast notice ${notice.kind}`} role="alert">
                {notice.kind === 'danger' ? I.alert : I.info}<div>{notice.text}</div>
              </div>
            )}
          </div>
        </section>

        <aside className="side" aria-label={guide ? 'Instruments and live model' : 'About this system'}>
          {guide ? (
            <>
              <HitchPanel frame={frame} frameText={frameText} vehicle={shown.vehicle} pred={pred} hist={hist} guided={!baseline} />
              <InputsPanel frame={frame} frameText={frameText} vehicle={shown.vehicle} advised={baseline ? null : advised} unaided={baseline} />
              <ModelPanel frameText={frameText} vehicle={shown.vehicle} scale={scale} tText={pb.tText} />
            </>
          ) : shown && (
            <About vehicle={editing ? editing.base.vehicle : shown.vehicle}
              edit={!editing ? null : vehicleEdit && rigSpec
                ? { spec: rigSpec, base: libSpec, limits: vehicleEdit.limits, gap: vehicleEdit.jack_gap, onChange: setRig }
                : { offline: true }} />
          )}
        </aside>
      </main>

      {guide ? (
        <Transport pb={pb} duration={runDuration} steps={steps} speed={speed} setSpeed={setSpeed} autoPause={autoPause} setAutoPause={setAutoPause}
          jackAt={baseline && plan.baseline.jackknife ? plan.baseline.t_jack : null} />
      ) : noBar ? null : (
        <footer className="bar status" aria-label={editing ? 'Live solver' : 'Library'}>
          {editing ? (
            <>
              <span>Setting up the lot: <b className="tnum">{bays.length - free}</b> filled, <b className="tnum">{free}</b> free</span>
              <span className="sep" />
              <span>A changed fill or vehicle is planned, driven and certified live when you continue, with the same checks as the library.</span>
            </>
          ) : library && layoutStats && (
            <>
              <span><b className="tnum">{layoutStats.ok}</b> of <span className="tnum">{layoutStats.free}</span> free bays certified in this layout across {entry.seeds.length} fills</span>
              <span className="sep" />
              <span><b className="tnum">{library.ok}</b> of <span className="tnum">{library.free}</span> across the whole library ({library.layouts} layouts, {library.fills} fills)</span>
              <span className="sep" />
              <span>{live
                ? <>Live solver on (<b className="tnum">{live.workers}</b> processes): <b>New random lot</b> or <b>Change fill</b> to solve new lots.</>
                : 'Every run solved offline, driven in closed loop and certified before it is offered.'}</span>
            </>
          )}
        </footer>
      )}
    </div>
  )
}
