import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Yard from './scene/Yard'
import usePlayback from './usePlayback'
import { GuidanceBar, UnaidedBar } from './ui/Instruction'
import Instruments from './ui/Instruments'
import MathPanel from './ui/MathPanel'
import StepTable from './ui/StepTable'
import RunSummary from './ui/RunSummary'
import Transport, { SPEEDS } from './ui/Transport'
import { I, LayoutIcon } from './ui/icons'
import { loadManifest, loadLot, sampleFrames, stepIndexAt, fmt } from './data'

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
  const [stripTab, setStripTab] = useState('steps')
  const [stripBig, setStripBig] = useState(false)

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
    setSelected(id); setMode('guide'); setBaselineState(false); setStripTab('steps'); pb.restart()
  }, [pb.restart]) // eslint-disable-line react-hooks/exhaustive-deps
  const backToLot = () => { setMode('select'); setSelected(null); setBaselineState(false); pb.seek(0) }
  const setBaseline = (b) => { if (b !== baseline) { setBaselineState(b); pb.restart() } }

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
  const advised = cur && cur.kind === 'drive' ? { turns: cur.turns, kmh: cur.speed_kmh } : null
  const okCount = lot ? lot.layout.bays.filter((b) => b.status === 'ok').length : 0
  const hoveredBay = hovered != null && lot ? lot.layout.bays[hovered] : null
  const jackknifed = baseline && plan && plan.baseline.jackknife && pb.t >= plan.baseline.duration - 0.3
  const parked = !baseline && plan && pb.t >= plan.duration - 0.2
  const guide = mode === 'guide' && plan && frame

  if (error) return <div className="loading"><div className="card" style={{ maxWidth: 460 }}><h3>Data not found</h3>{error}<div className="tiny muted" style={{ marginTop: 8 }}>Generate the demo library with <span className="mono">python -m sim.export</span>, then reload.</div></div></div>

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#16212d" stroke="#33485f" /><rect x="4" y="12" width="15" height="8" rx="1.5" fill="#dbe4ec" /><rect x="20" y="12" width="8" height="8" rx="1.5" fill="#38d0e8" /></svg>
          <div>Trailer Parking Guidance<small>NMPC + Hybrid A* &middot; Group B9</small></div>
        </div>
        <nav className="picker" aria-label="Parking layout">
          {manifest?.layouts.map((l) => (
            <button key={l.name} className="pick" aria-pressed={l.name === layoutName} onClick={() => { setLayoutName(l.name); setSeedIdx(0) }}>
              <LayoutIcon name={l.name} />{l.label}
            </button>
          ))}
          <button className="btn" onClick={() => setSeedIdx((i) => (i + 1) % (entry?.seeds.length || 1))} title="Fill the lot with a different random set of parked trucks">{I.shuffle} New lot</button>
        </nav>
      </header>

      <div className={`workspace ${guide ? 'guide' : 'select'} ${stripBig ? 'big' : ''}`}>
        {guide && (baseline
          ? <UnaidedBar plan={plan} onBack={backToLot} />
          : <GuidanceBar steps={steps} t={pb.t} frame={frame} frameText={frameText} duration={plan.duration} onBack={backToLot} />)}
        <div className="stage">
          {lot ? (
            <Yard lot={lot} plan={plan} baseline={baseline} selected={selected} hovered={hovered} onHover={setHovered} onPick={pick}
              t={pb.t} mode={mode} view={view} showPath focusRig={follow} />
          ) : <div className="loading">Loading yard&hellip;</div>}

          {mode === 'select' && lot && (
            <>
              <div className="hint">Click a <span style={{ color: 'var(--ok)' }}>green</span> bay to park in &middot; {okCount} available</div>
              <div className="legend" aria-label="Legend">
                <span><i className="dot" style={{ background: 'var(--ok)' }} />Guidance available</span>
                <span><i className="dot" style={{ background: '#4a5b6c' }} />Too tight to certify</span>
                <span><i className="dot" style={{ background: '#5b6d7f' }} />Occupied</span>
                <span><i className="dot" style={{ background: 'var(--warn)' }} />Gate</span>
              </div>
            </>
          )}
          {mode === 'select' && hoveredBay && (
            <div className="tooltip" style={{ right: 16, top: 16 }}>
              <b>Bay {hoveredBay.id + 1}</b><br />
              <span className="muted">{hoveredBay.status === 'ok' ? 'Click to start guided parking' : hoveredBay.status === 'occupied' ? 'Occupied' : hoveredBay.reason}</span>
            </div>
          )}
          {guide && (
            <div className="legend guide" aria-label="Scene legend">
              {!baseline && <span><i className="ln" style={{ background: '#38d0e8' }} />NMPC look-ahead (tractor)</span>}
              {!baseline && <span><i className="ln" style={{ background: '#8ea2ff' }} />(trailer)</span>}
              <span><i className="ln dash" />planned path</span>
              <span><i className="ln" style={{ background: baseline ? '#ff8a96' : '#fff' }} />driven so far</span>
            </div>
          )}
          {guide && (
            <p className="kbd tiny" aria-label="Keyboard shortcuts"><kbd>Space</kbd> play/pause <kbd>&larr;</kbd><kbd>&rarr;</kbd> step <kbd>[</kbd><kbd>]</kbd> speed</p>
          )}
          {jackknifed && <div className="banner danger">JACKKNIFE &middot; hitch angle past the limit with guidance off</div>}
          {parked && <div className="banner ok">Parked &middot; {fmt(Math.abs(plan.metrics.final.lat), 2)} m off-centre, {fmt(Math.abs(plan.metrics.final.hdg), 1)}&deg; from aligned</div>}
          {guide && baseline && !plan.baseline.jackknife && pb.t < 2 && (
            <div className="banner info">Forward driving is self-stabilising, so the unaided driver also parks here. The difference appears when reversing.</div>
          )}
        </div>

        {guide && (
          <section className="strip" aria-label="Run data">
            <div className="strip-head">
              <div className="tabs" role="tablist">
                {[['steps', 'Step table'], ['summary', 'Run summary']].map(([k, l]) => (
                  <button key={k} className="tab" role="tab" aria-selected={stripTab === k} onClick={() => setStripTab(k)}>{l}</button>
                ))}
              </div>
              <button className="btn icon ghost" style={{ marginLeft: 'auto' }} onClick={() => setStripBig((b) => !b)} aria-pressed={stripBig} aria-label="Enlarge data strip" title="Enlarge / shrink this strip">{I.expand}</button>
            </div>
            <div className="strip-body">
              {stripTab === 'steps' && (baseline
                ? <div className="empty">The unaided driver has no plan. Switch back to <b>Guided</b> to see the step table, or open <b>Run summary</b> for the comparison.</div>
                : <StepTable steps={plan.steps} t={pb.t} onSeek={pb.seek} />)}
              {stripTab === 'summary' && <RunSummary plan={plan} vehicle={lot.vehicle} />}
            </div>
          </section>
        )}

        <aside className={`side ${guide ? 'guide' : ''}`} aria-label="Guidance panel">
          {!guide ? (
            <>
              {lot && (
                <section className="card" aria-label="Choose a bay">
                  <h3>Choose a bay</h3>
                  <div className="baylist">
                    {lot.layout.bays.filter((b) => b.status !== 'occupied').map((b) => (
                      <button key={b.id} className={`baybtn ${b.status}`} disabled={b.status !== 'ok'}
                        onClick={() => pick(b.id)} onMouseEnter={() => setHovered(b.id)} onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(b.id)} onBlur={() => setHovered(null)}
                        title={b.status === 'ok' ? `Park in bay ${b.id + 1}` : b.reason}>
                        Bay {b.id + 1}
                      </button>
                    ))}
                  </div>
                  <p className="tiny muted" style={{ margin: '8px 0 0' }}>Or click a green bay in the yard. Grey bays are too tight to certify.</p>
                </section>
              )}
              <section className="card">
                <h3>How this works</h3>
                <ol className="howto">
                  <li>Pick a yard layout above.</li>
                  <li>Click a green bay. Grey bays are too tight for a certified plan.</li>
                  <li>Follow the live guidance: gear, speed, steering-wheel turns and distance, computed from the vehicle model.</li>
                  <li>Slow it down (&frac14;&times;, &frac12;&times;) or pause at each step to study the maths.</li>
                </ol>
              </section>
              <section className="card">
                <h3>The problem</h3>
                <p style={{ margin: 0, color: '#b7c6d4' }}>
                  Reversing a tractor-trailer is unstable: a small hitch-angle error grows exponentially until the rig jackknifes.
                  An NMPC controller looks ahead and enforces a hard limit on the hitch angle, so the plan it gives the driver can never fold the rig.
                </p>
              </section>
              {lot && (
                <section className="card">
                  <h3>This lot</h3>
                  <dl className="kv">
                    <dt>Layout</dt><dd>{lot.layout.label}</dd>
                    <dt>Bays</dt><dd>{lot.layout.bays.length}</dd>
                    <dt>Occupied</dt><dd>{lot.layout.bays.filter((b) => b.occupied).length}</dd>
                    <dt>Certified guidance</dt><dd>{okCount}</dd>
                    <dt>Rig</dt><dd>{(lot.vehicle.L1 + lot.vehicle.L2).toFixed(0)} m tractor + trailer</dd>
                  </dl>
                </section>
              )}
            </>
          ) : (
            <>
              <Instruments frame={frame} frameText={frameText} vehicle={lot.vehicle} advised={baseline ? null : advised} />
              <MathPanel frameText={frameText} plan={plan} tText={pb.tText} vehicle={lot.vehicle} baseline={baseline} />
            </>
          )}
        </aside>
      </div>

      {guide && (
        <Transport pb={pb} duration={runDuration} steps={steps} speed={speed} setSpeed={setSpeed} autoPause={autoPause} setAutoPause={setAutoPause}
          view={view} setView={setView} follow={follow} setFollow={setFollow} baseline={baseline} setBaseline={setBaseline} />
      )}
    </div>
  )
}
