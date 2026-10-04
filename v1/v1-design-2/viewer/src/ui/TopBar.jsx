import { I, LayoutIcon, Mark } from './icons'
import { layoutShort } from '../derive'

export default function TopBar({ manifest, layoutName, onLayout, seedIdx, seedCount, onSeed }) {
  return (
    <header className="top">
      <div className="brand">
        <Mark />
        <div>
          <h1>Tractor–Trailer Parking Guidance</h1>
          <p>Hybrid A* planning &middot; NMPC tracking &middot; Group B9</p>
        </div>
      </div>

      <nav className="top-group" aria-label="Yard layout">
        <span className="top-lbl">Layout</span>
        <div className="tabs-line">
          {manifest?.layouts.map((l) => (
            <button key={l.name} aria-pressed={l.name === layoutName} onClick={() => onLayout(l.name)} title={l.label}>
              <LayoutIcon name={l.name} />{layoutShort(l)}
            </button>
          ))}
        </div>
      </nav>

      <div className="top-group" role="group" aria-label="Lot fill">
        <span className="top-lbl" title="Each layout ships six pre-solved random fills of parked trucks">Fill</span>
        <div className="stepper">
          <button onClick={() => onSeed(-1)} aria-label="Previous fill" title="Previous fill">{I.chevL}</button>
          <span className="tnum">{seedIdx + 1} / {seedCount || 1}</span>
          <button onClick={() => onSeed(1)} aria-label="Next fill" title="Next fill: a different set of parked trucks">{I.chevR}</button>
        </div>
      </div>
    </header>
  )
}
