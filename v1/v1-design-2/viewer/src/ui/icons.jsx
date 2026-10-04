// One icon family: 20 px grid, 1.6 px stroke, round joins.
const base = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const I = {
  play: <svg {...base} fill="currentColor" stroke="none"><path d="M6.5 4.2v11.6L16 10z" /></svg>,
  pause: <svg {...base} fill="currentColor" stroke="none"><path d="M5.5 4h3v12h-3zM11.5 4h3v12h-3z" /></svg>,
  restart: <svg {...base}><path d="M4.5 10a5.5 5.5 0 1 0 1.8-4.1M4.5 3.5v3.2h3.2" /></svg>,
  prev: <svg {...base}><path d="M5.5 4.5v11M15 4.5 8.5 10l6.5 5.5z" /></svg>,
  next: <svg {...base}><path d="M14.5 4.5v11M5 4.5l6.5 5.5L5 15.5z" /></svg>,
  chevL: <svg {...base}><path d="M12 5l-5 5 5 5" /></svg>,
  chevR: <svg {...base}><path d="M8 5l5 5-5 5" /></svg>,
  check: <svg {...base} strokeWidth="2"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>,
  cross: <svg {...base} strokeWidth="2"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>,
  alert: <svg {...base}><path d="M10 3.2 2.8 16h14.4z" /><path d="M10 8.2v3.6M10 13.9v.2" /></svg>,
  info: <svg {...base}><circle cx="10" cy="10" r="7" /><path d="M10 9v4.5M10 6.4v.2" /></svg>,
  parked: <svg {...base}><rect x="3.5" y="3.5" width="13" height="13" rx="1.5" /><path d="M8 14V6h2.6a2.3 2.3 0 0 1 0 4.6H8" /></svg>,
}

export const LayoutIcon = ({ name }) => {
  const s = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round' }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...s}>
      {name === 'cross' && <><path d="M3 12h18" strokeDasharray="2 2" /><path d="M5 9V3M9 9V3M13 9V3M17 9V3M5 15v6M9 15v6M13 15v6M17 15v6" /></>}
      {name === 'angled' && <><path d="M3 12h18" strokeDasharray="2 2" /><path d="M5 9l3-6M9 9l3-6M13 9l3-6M17 9l3-6M5 15l3 6M9 15l3 6M13 15l3 6M17 15l3 6" /></>}
      {name === 'parallel' && <><path d="M3 12h18" strokeDasharray="2 2" /><rect x="3" y="4" width="8" height="4" /><rect x="13" y="4" width="8" height="4" /><rect x="3" y="16" width="8" height="4" /><rect x="13" y="16" width="8" height="4" /></>}
      {name === 'tandem' && <><rect x="2" y="5" width="6" height="4" /><rect x="9" y="5" width="6" height="4" /><rect x="16" y="5" width="6" height="4" /><rect x="2" y="15" width="6" height="4" /><rect x="9" y="15" width="6" height="4" /><rect x="16" y="15" width="6" height="4" /></>}
    </svg>
  )
}

// Product mark: a tractor-trailer seen from above, orange tractor as on the plan.
export const Mark = () => (
  <svg className="mark" viewBox="0 0 28 28" aria-hidden="true">
    <rect x="0.5" y="0.5" width="27" height="27" rx="3" fill="#16191d" />
    <rect x="4" y="10.5" width="13" height="7" rx="0.8" fill="#fafaf8" />
    <rect x="18.2" y="10.5" width="6" height="7" rx="0.8" fill="#e8590c" />
  </svg>
)
