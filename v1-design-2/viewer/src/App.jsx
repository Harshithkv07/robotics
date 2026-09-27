import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Yard from './scene/Yard'
import usePlayback from './usePlayback'
import TopBar from './ui/TopBar'
import { SelectBand, GuidanceBand, UnaidedBand } from './ui/Instruction'
import BayList from './ui/BayList'
import Procedure from './ui/Procedure'
import Report from './ui/Report'
import { HitchPanel, InputsPanel } from './ui/Instruments'
import ModelPanel from './ui/ModelPanel'
import About, { Certification } from './ui/About'
import Transport, { SPEEDS } from './ui/Transport'
import { I } from './ui/icons'
import { loadManifest, loadLot, sampleFrames, stepIndexAt, horizonAt, fmt } from './data'
import { layoutShort, prediction, history, termScale } from './derive'

const DEFAULT_SPEED = 1 // real time; the library is precomputed at realistic yard speeds

export default function App() {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)
  const [layoutName, setLayoutName] = useState('cross')
  const [seedIdx, setSeedIdx] = useState(0)
  const [lot, setLot] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('select')
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [autoPause, setAutoPause] = useState(false)
  const [baseline, setBaselineState] = useState(false)
  const [view, setView] = useState('top')
  const [follow, setFollow] = useState(true)
  const [railTab, setRailTab] = useState('steps')

  useEffect(() => {
    loadManifest().then((m) => {
      setManifest(m)
      setLayoutName((cur) => (m.layouts.some((l) => l.name === cur) ? cur : m.layouts[0]?.name))
    }).catch((e) => setError(e.message))
  }, [])

  const entry = useMemo(() => manifest?.layouts.find((l) => l.name === layoutName), [manifest, layoutName])
  const plan = lot && selected != null ? lot.plans[String(selected)] : null
  const steps = plan && !baseline ? plan.steps : []
  const runFrames = plan ? (baseline ? plan.baseline.frames : plan.frames) : null
  const runDuration = plan ? (baseline ? plan.baseline.duration : plan.duration) : 0
  const pb = usePlayback({ duration: runDuration, steps, speed, autoPause })
  const pbRef = useRef(pb)
  pbRef.current = pb

  useEffect(() => {
    if (!entry) return
    const seed = entry.seeds[seedIdx % entry.seeds.length]
    let dead = false
    loadLot(seed.file).then((d) => {
      if (dead) return
      setLot(d); setSelected(null); setMode('select'); setBaselineState(false); pb.seek(0)
    }).catch((e) => setError(e.message))
    return () => { dead = true }
  }, [entry, seedIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((id) => {
    setSelected(id); setMode('guide'); setBaselineState(false); setRailTab('steps'); setHovered(null); pb.restart()
  }, [pb.restart]) // eslint-disable-line react-hooks/exhaustive-deps
  const backToLot = () => { setMode('select'); setSelected(null); setBaselineState(false); pb.seek(0) }
  const setBaseline = (b) => { if (b !== baseline) { setBaselineState(b); pb.restart() } }
  const nSeeds = entry?.seeds.length || 1
  const stepSeed = (d) => setSeedIdx((i) => (i + d + nSeeds) % nSeeds)

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
  const bays = lot ? lot.layout.bays : []
  const okCount = bays.filter((b) => b.status === 'ok').length
  const free = bays.filter((b) => b.status !== 'occupied').length
  const hoveredBay = hovered != null && lot ? bays[hovered] : null
  const jackknifed = baseline && plan && plan.baseline.jackknife && pb.t >= plan.baseline.duration - 0.3
  const parked = !baseline && plan && pb.t >= plan.duration - 0.2
  const guide = mode === 'guide' && plan && frame
  const pred = useMemo(() => (guide && !baseline ? prediction(horizonAt(plan.hor, pb.tText)) : null), [guide, baseline, plan, pb.tText])
  const hist = useMemo(() => (guide ? history(runFrames, pb.tText) : []), [guide, runFrames, pb.tText])
  const scale = useMemo(() => (plan && lot ? termScale(runFrames, lot.vehicle) : 10), [plan, runFrames, lot])
  const library = useMemo(() => {
    if (!manifest) return null
    let ok = 0, fr = 0, fills = 0
    for (const l of manifest.layouts) for (const s of l.seeds) { ok += s.ok; fr += s.free; fills++ }
    return { ok, free: fr, fills, layouts: manifest.layouts.length }
  }, [manifest])
  const layoutStats = entry ? entry.seeds.reduce((a, s) => ({ ok: a.ok + s.ok, free: a.free + s.free }), { ok: 0, free: 0 }) : null

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

  return (
    <div className={`app ${guide ? 'is-guide' : 'is-select'}`}>
      <TopBar manifest={manifest} layoutName={layoutName} onLayout={(n) => { setLayoutName(n); setSeedIdx(0) }}
        seedIdx={seedIdx % nSeeds} seedCount={nSeeds} onSeed={stepSeed} />

      <main className="work">
        <aside className="rail" aria-label={guide ? 'Procedure and report' : 'Bays'}>
          {!guide ? (
            <>
              <header className="rail-h">
                <div><h2>Bays</h2><p className="tnum">{okCount} certified &middot; {bays.length - free} occupied &middot; {bays.length} total</p></div>
              </header>
              <div className="scroll">
                {lot && <BayList lot={lot} hovered={hovered} setHovered={setHovered} onPick={pick} />}
                {lot && (
                  <dl className="kv lotkv">
                    <dt>Layout</dt><dd>{lot.layout.label.replace(' deg', '°')}</dd>
                    <dt>Aisle width</dt><dd className="tnum">{fmt(lot.layout.aisle, 0)} m</dd>
                    <dt>Rig length</dt><dd className="tnum">{fmt(lot.vehicle.L1 + lot.vehicle.tractor_front + lot.vehicle.L2 + lot.vehicle.trailer_rear - lot.vehicle.d, 1)} m overall</dd>
                  </dl>
                )}
                {lot && <Certification vehicle={lot.vehicle} />}
              </div>
            </>
          ) : (
            <>
              <header className="rail-h">
                <div><h2>Bay {selected + 1}</h2><p>{layoutShort(entry || lot.layout)} &middot; fill {seedIdx % nSeeds + 1}</p></div>
                <button className="btn sm" onClick={backToLot} title="Back to bay selection">{I.chevL}Change bay</button>
              </header>
              <div className="tabs-line rail-tabs" role="group" aria-label="Rail view">
                <button aria-pressed={railTab === 'steps'} onClick={() => setRailTab('steps')}>Procedure</button>
                <button aria-pressed={railTab === 'report'} onClick={() => setRailTab('report')}>Run report</button>
              </div>
              {railTab === 'steps'
                ? (baseline
                  ? <div className="scroll"><p className="empty">The unaided driver has no plan and no instructions. Switch back to <b>Guided</b> for the procedure, or open the <b>Run report</b> for the comparison.</p></div>
                  : <Procedure steps={plan.steps} t={pb.t} onSeek={pb.seek} />)
                : <Report plan={plan} vehicle={lot.vehicle} />}
            </>
          )}
        </aside>

        <section className="center">
          {guide
            ? (baseline
              ? <UnaidedBand plan={plan} t={pb.t} frame={frame} baseline={baseline} setBaseline={setBaseline} onReport={() => setRailTab('report')} />
              : <GuidanceBand steps={steps} t={pb.t} duration={plan.duration} plan={plan} baseline={baseline} setBaseline={setBaseline} onReport={() => setRailTab('report')} />)
            : <SelectBand okCount={okCount} free={free} />}

          <div className="stage">
            {lot ? (
              <Yard lot={lot} plan={plan} baseline={baseline} selected={selected} hovered={hovered} onHover={setHovered} onPick={pick}
                t={pb.t} mode={mode} view={view} focusRig={follow} />
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
                <span>{hoveredBay.status === 'ok' ? 'Certified. Click to start guided parking.' : hoveredBay.status === 'occupied' ? 'Occupied' : `Not certified: ${(hoveredBay.reason || '').replace('guidance not certified ', '').replace(/[()]/g, '')}`}</span>
              </div>
            )}

            {guide && (
              <ul className="legend" aria-label="Plan legend">
                <li><i className="ln ln-path" />Planned path (Hybrid A*)</li>
                {!baseline && <li><i className="ln ln-pred" />NMPC look-ahead, tractor</li>}
                {!baseline && <li><i className="ln ln-predsoft" />NMPC look-ahead, trailer</li>}
                <li><i className="ln" style={{ background: baseline ? 'var(--danger)' : 'var(--rig)' }} />Driven so far</li>
              </ul>
            )}

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
          </div>
        </section>

        <aside className="side" aria-label={guide ? 'Instruments and live model' : 'About this system'}>
          {guide ? (
            <>
              <HitchPanel frame={frame} frameText={frameText} vehicle={lot.vehicle} pred={pred} hist={hist} guided={!baseline} />
              <InputsPanel frame={frame} frameText={frameText} vehicle={lot.vehicle} advised={baseline ? null : advised} unaided={baseline} />
              <ModelPanel frameText={frameText} vehicle={lot.vehicle} scale={scale} tText={pb.tText} />
            </>
          ) : lot && <About vehicle={lot.vehicle} />}
        </aside>
      </main>

      {guide ? (
        <Transport pb={pb} duration={runDuration} steps={steps} speed={speed} setSpeed={setSpeed} autoPause={autoPause} setAutoPause={setAutoPause}
          jackAt={baseline && plan.baseline.jackknife ? plan.baseline.t_jack : null} />
      ) : (
        <footer className="bar status" aria-label="Library">
          {library && layoutStats && (
            <>
              <span><b className="tnum">{layoutStats.ok}</b> of <span className="tnum">{layoutStats.free}</span> free bays certified in this layout across {entry.seeds.length} fills</span>
              <span className="sep" />
              <span><b className="tnum">{library.ok}</b> of <span className="tnum">{library.free}</span> across the whole library ({library.layouts} layouts, {library.fills} fills)</span>
              <span className="sep" />
              <span>Every run solved offline, driven in closed loop and certified before it is offered.</span>
            </>
          )}
        </footer>
      )}
    </div>
  )
}
