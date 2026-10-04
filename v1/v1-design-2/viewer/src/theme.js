// Colour tokens for the SVG instruments and the three.js plan. styles.css mirrors the UI ones as CSS variables.
// One meaning per colour: ink = measured / live, blue = what the controller commands (plan, look-ahead, advised
// values), orange = the vehicle being parked, green / amber / red = status.
export const C = {
  ink: '#16191d',
  ink2: '#4a515b',
  ink3: '#6b727c',
  ink4: '#9aa0a8',
  rule: '#dedcd6',
  paper: '#f4f3ef',
  accent: '#1d4ed8',
  accentSoft: '#86a2ee',
  ok: '#15803d',
  warn: '#b45309',
  danger: '#b91c1c',
  zoneSafe: '#e7e5df',
  zoneCaution: '#f0d7a4',
  zoneLimit: '#eebfbf',
}

export const PLAN = {
  bg: '#e4e3de',
  lot: '#efeeea',
  grid: '#e1dfd9',
  edge: '#a3a097',
  bayLine: '#8f939a',
  bayMuted: '#aeb2b8',
  parked: '#b2b7bd',
  parkedCab: '#bcc1c6',
  parkedBox: '#cbcfd3',
  parkedEdge: '#7c828a',
  rig: '#e8590c',
  rigCab: '#d9480f',
  trailer: '#fafaf8',
  outline: '#2b3036',
  glass: '#2b3440',
  tyre: '#2a2e33',
  alarm: '#c92a2a',
  alarmTrailer: '#f6d5d5',
  path: '#4a515b',
  trail: '#e8590c',
  trailUnaided: '#c92a2a',
  gate: '#b45309',
}
