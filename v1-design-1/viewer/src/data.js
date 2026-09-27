// Data loading + geometry helpers shared by scene and UI.

const cache = new Map()

export async function loadManifest() {
  const r = await fetch('./data/manifest.json')
  if (!r.ok) throw new Error('manifest.json missing - run: python -m sim.export')
  return r.json()
}

export async function loadLot(file) {
  if (cache.has(file)) return cache.get(file)
  const r = await fetch(`./data/${file}`)
  if (!r.ok) throw new Error(`${file} not found`)
  const data = await r.json()
  cache.set(file, data)
  return data
}

export const DEG = 180 / Math.PI
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, f) => a + (b - a) * f

export const RATIO = 20 // steering-wheel degrees per road-wheel degree
export const turnsOf = (delta) => (delta * DEG * RATIO) / 360

// frame layout: [t, x, y, th, psi, v, delta]
export function frameIndexAt(frames, t) {
  let lo = 0, hi = frames.length - 1
  if (t <= frames[0][0]) return 0
  if (t >= frames[hi][0]) return hi
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid][0] <= t) lo = mid
    else hi = mid
  }
  return lo
}

export function sampleFrames(frames, t) {
  if (!frames.length) return null
  const last = frames[frames.length - 1]
  if (t <= frames[0][0]) return frames[0]
  if (t >= last[0]) return last
  const i = frameIndexAt(frames, t)
  const a = frames[i], b = frames[i + 1]
  const f = (t - a[0]) / (b[0] - a[0] || 1)
  return [t, lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f),
    lerp(a[4], b[4], f), lerp(a[5], b[5], f), lerp(a[6], b[6], f)]
}

export function trailerAxle(x, y, th, psi, veh) {
  const th1 = th - psi
  const hx = x + veh.d * Math.cos(th)
  const hy = y + veh.d * Math.sin(th)
  return { x: hx - veh.L2 * Math.cos(th1), y: hy - veh.L2 * Math.sin(th1), th: th1 }
}

export function stepIndexAt(steps, t) {
  let idx = 0
  for (let i = 0; i < steps.length; i++) if (steps[i].t0 <= t + 1e-6) idx = i
  return idx
}

// NMPC prediction snapshots, sorted by time: [t, [[x, y, th, psi] ...]]
export function horizonAt(hor, t) {
  if (!hor.length || t < hor[0][0]) return null
  let lo = 0, hi = hor.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (hor[mid][0] <= t) lo = mid
    else hi = mid - 1
  }
  return hor[lo]
}

// The model of PPT slide 9, evaluated at one frame. Angles in rad, rates in rad/s.
export function kinematics(frame, veh) {
  const [, , , th, psi, v, delta] = frame
  const tn = Math.tan(delta)
  const steer = (v * tn) / veh.L1
  const hitch = (-v * Math.sin(psi)) / veh.L2
  const offset = (-v * veh.d * tn * Math.cos(psi)) / (veh.L1 * veh.L2)
  // the hitch term pushes |psi| up when it has the same sign as psi (reversing), otherwise it pulls it back
  const mode = Math.abs(psi) < 0.03 || Math.abs(hitch) < 1e-4 ? 'neutral' : hitch * psi > 0 ? 'destabilising' : 'restoring'
  return {
    xd: v * Math.cos(th), yd: v * Math.sin(th), thd: (v * tn) / veh.L1,
    psid: steer + hitch + offset, steer, hitch, offset, mode,
    radius: Math.abs(delta) < 0.008 ? null : veh.L1 / Math.abs(tn),
  }
}

export function bayCorners(b) {
  const c = Math.cos(b.theta), s = Math.sin(b.theta)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, d]) => {
    const px = (a * b.l) / 2, py = (d * b.w) / 2
    return [b.cx + px * c - py * s, b.cy + px * s + py * c]
  })
}

export function turnsText(turns) {
  const q = Math.round(Math.abs(turns) * 4) / 4
  if (q === 0) return 'straight'
  if (q >= 1.75) return 'full lock'
  const whole = Math.floor(q)
  const frac = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[q - whole]
  return whole === 0 ? `${frac} turn` : `${whole}${frac} turn${q > 1 ? 's' : ''}`
}

export const sideOf = (turns) => (Math.abs(turns) < 0.12 ? 'straight' : turns > 0 ? 'left' : 'right')
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-')
