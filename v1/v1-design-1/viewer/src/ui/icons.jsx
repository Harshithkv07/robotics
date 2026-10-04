const base = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const I = {
  play: <svg {...base} fill="currentColor" stroke="none"><path d="M6 4l10 6-10 6z" /></svg>,
  pause: <svg {...base} fill="currentColor" stroke="none"><path d="M5 4h4v12H5zM11 4h4v12h-4z" /></svg>,
  restart: <svg {...base}><path d="M4 10a6 6 0 1 0 2-4.5M4 3v4h4" /></svg>,
  back: <svg {...base}><path d="M12 4 6 10l6 6" /></svg>,
  prev: <svg {...base}><path d="M5 4v12M16 4l-8 6 8 6z" fill="currentColor" /></svg>,
  next: <svg {...base}><path d="M15 4v12M4 4l8 6-8 6z" fill="currentColor" /></svg>,
  shuffle: <svg {...base}><path d="M3 6h3c4 0 4 8 8 8h3M3 14h3c1.5 0 2.5-1 3.3-2M17 6h-3c-1.4 0-2.4.8-3.2 1.8M15 3l2 3-2 3M15 11l2 3-2 3" /></svg>,
  expand: <svg {...base}><path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" /></svg>,
}

export const LayoutIcon = ({ name }) => {
  const s = { stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...s}>
      {name === 'cross' && <><path d="M3 12h18" strokeDasharray="2 2" /><path d="M5 9V3M9 9V3M13 9V3M17 9V3M5 15v6M9 15v6M13 15v6M17 15v6" /></>}
      {name === 'angled' && <><path d="M3 12h18" strokeDasharray="2 2" /><path d="M5 9l3-6M9 9l3-6M13 9l3-6M17 9l3-6M5 15l3 6M9 15l3 6M13 15l3 6M17 15l3 6" /></>}
      {name === 'parallel' && <><path d="M3 12h18" strokeDasharray="2 2" /><rect x="3" y="4" width="8" height="4" /><rect x="13" y="4" width="8" height="4" /><rect x="3" y="16" width="8" height="4" /><rect x="13" y="16" width="8" height="4" /></>}
      {name === 'tandem' && <><rect x="2" y="5" width="6" height="4" /><rect x="9" y="5" width="6" height="4" /><rect x="16" y="5" width="6" height="4" /><rect x="2" y="15" width="6" height="4" /><rect x="9" y="15" width="6" height="4" /><rect x="16" y="15" width="6" height="4" /></>}
    </svg>
  )
}
