import { I, Mark } from './icons'
import { layoutShort } from '../derive'

function Solver({ live }) {
  return (
    <span className={`solver ${live ? 'on' : ''}`} title={live ? `Live solver running with ${live.workers} processes` : 'No live solver: library fills only (start v2/run_demo.bat)'}>
      <i aria-hidden="true" /><span>{live ? 'Live solver' : 'Library only'}</span>
    </span>
  )
}

// home: the home page's bar floats over the hero (solid once the page scrolls) with links to its sections.
// live: the solver's health ({workers}) when server.py answers, else null.
export default function TopBar({ home, solid, onNav, onHome, manifest, layoutName, live }) {
  const brand = (
    <>
      <Mark />
      <div>
        <h1>Trailer Parking Guidance</h1>
        <p>Hybrid A* planning &middot; NMPC tracking &middot; Group B9</p>
      </div>
    </>
  )
  if (home) {
    return (
      <header className={`top home-top ${solid ? 'solid' : ''}`}>
        <div className="brand">{brand}</div>
        <nav className="home-nav" aria-label="Sections">
          <button onClick={() => onNav('how')}>How it works</button>
          <button onClick={() => onNav('configs')}>Configurations</button>
        </nav>
        <div className="top-group right"><Solver live={live} /></div>
      </header>
    )
  }
  const entry = manifest?.layouts.find((l) => l.name === layoutName)
  return (
    <header className="top">
      <button className="brand" onClick={onHome} title="Back to the home page">{brand}</button>
      <nav className="crumb" aria-label="Breadcrumb">
        <button onClick={onHome}>Home</button>{I.chevR}<b>{entry ? layoutShort(entry) : ''}</b>
      </nav>
      <div className="top-group right"><Solver live={live} /></div>
    </header>
  )
}
