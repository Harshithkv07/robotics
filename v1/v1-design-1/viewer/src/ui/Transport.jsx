import { fmt, stepIndexAt } from '../data'
import { I } from './icons'

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8]
const speedLabel = (s) => (s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`)

export default function Transport({
  pb, duration, steps, speed, setSpeed, autoPause, setAutoPause,
  view, setView, follow, setFollow, baseline, setBaseline,
}) {
  const hasSteps = steps.length > 0
  const cur = hasSteps ? stepIndexAt(steps, pb.t) : 0
  return (
    <footer className="transport" aria-label="Playback controls">
      <div className="tgroup">
        <button className="btn primary" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'} title="Space">
          {pb.playing ? I.pause : I.play}{pb.playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn icon" onClick={pb.prevStep} disabled={!hasSteps} aria-label="Previous step" title="Previous step (Left arrow)">{I.prev}</button>
        <button className="btn icon" onClick={pb.nextStep} disabled={!hasSteps} aria-label="Next step" title="Next step (Right arrow)">{I.next}</button>
        <button className="btn icon" onClick={pb.restart} aria-label="Restart" title="Restart">{I.restart}</button>
      </div>

      <div className="scrubwrap">
        <input className="scrub" type="range" min="0" max={duration} step="0.05" value={Math.min(pb.t, duration)}
          onChange={(e) => pb.seek(parseFloat(e.target.value))} aria-label="Timeline position" />
        {hasSteps && (
          <div className="ticks" aria-hidden="true">
            {steps.map((s, i) => (i === 0 ? null : <i key={s.id} className={i === cur + 1 ? 'nxt' : ''} style={{ left: `${(s.t0 / duration) * 100}%` }} />))}
          </div>
        )}
      </div>
      <span className="time">{fmt(pb.t, 1)} / {fmt(duration, 0)} s</span>

      <div className="seg" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{speedLabel(s)}</button>)}
      </div>
      <button className="btn toggle" aria-pressed={autoPause} onClick={() => setAutoPause(!autoPause)} disabled={!hasSteps} title="Stop automatically at the start of every instruction">
        <span className="sw" aria-hidden="true" />Pause at each step
      </button>

      <div className="seg" role="group" aria-label="Camera">
        <button aria-pressed={view === 'top'} onClick={() => setView('top')}>Top</button>
        <button aria-pressed={view === 'tilt'} onClick={() => setView('tilt')}>Tilt</button>
        <button aria-pressed={follow} onClick={() => setFollow(!follow)}>Follow</button>
      </div>
      <div className="seg mode" role="group" aria-label="Guidance">
        <button aria-pressed={!baseline} onClick={() => setBaseline(false)}>Guided</button>
        <button className="off" aria-pressed={baseline} onClick={() => setBaseline(true)}>Unaided</button>
      </div>
    </footer>
  )
}
