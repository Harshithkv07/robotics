// Run with:  npm test   (Node's built-in runner, no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceClock } from './clock.js'
import { frameIndexAt, sampleFrames, stepIndexAt, horizonAt, kinematics, turnsOf, sideOf, DEG } from './data.js'

const steps = [
  { id: 0, t0: 0.1, t1: 10 }, { id: 1, t0: 10, t1: 20 }, { id: 2, t0: 20, t1: 22 }, { id: 3, t0: 22, t1: 40 },
]
const base = { t: 0, dt: 0.016, speed: 1, duration: 40, steps, autoPause: false }

test('clock advances by dt x speed', () => {
  assert.ok(Math.abs(advanceClock({ ...base, dt: 0.1, speed: 1 }).t - 0.1) < 1e-9)
  assert.ok(Math.abs(advanceClock({ ...base, dt: 0.1, speed: 4 }).t - 0.4) < 1e-9)
})

test('quarter speed is four times slower than real time', () => {
  const run = (speed) => { let t = 0, n = 0; while (t < 8 && n++ < 1e6) t = advanceClock({ ...base, t, speed }).t; return n }
  const ratio = run(0.25) / run(1)
  assert.ok(ratio > 3.9 && ratio < 4.1, `ratio ${ratio}`)
})

test('clock stops exactly at the end', () => {
  const r = advanceClock({ ...base, t: 39.99, dt: 0.5, speed: 4 })
  assert.deepEqual(r, { t: 40, stop: true })
})

test('auto-pause lands exactly on the next step start, even at 8x', () => {
  const r = advanceClock({ ...base, t: 9.9, dt: 0.1, speed: 8, autoPause: true })
  assert.deepEqual(r, { t: 10, stop: true })
})

test('auto-pause does not re-trigger when resuming from a step boundary', () => {
  let t = 10, stops = 0
  for (let i = 0; i < 4000; i++) { const r = advanceClock({ ...base, t, autoPause: true }); t = r.t; if (r.stop) { stops++; break } }
  assert.equal(t, 20) // ran through step 1 and paused exactly at the start of step 2
  assert.equal(stops, 1)
})

test('auto-pause still stops at a boundary when the clock lands a rounding error below it', () => {
  const r = advanceClock({ ...base, t: 10 - 4e-15, dt: 0.05, speed: 2, autoPause: true })
  assert.deepEqual(r, { t: 10, stop: true })
})

test('without auto-pause the clock runs straight through step boundaries', () => {
  const r = advanceClock({ ...base, t: 9.99, dt: 0.1, speed: 1, autoPause: false })
  assert.equal(r.stop, false)
  assert.ok(r.t > 10)
})

test('every step is visited exactly once in order when auto-pausing through a whole run', () => {
  let t = 0, visited = []
  for (let guard = 0; guard < 100; guard++) {
    let r
    do { r = advanceClock({ ...base, t, dt: 0.05, speed: 2, autoPause: true }); t = r.t } while (!r.stop)
    visited.push(stepIndexAt(steps, t))
    if (t >= 40) break
  }
  assert.deepEqual(visited, [1, 2, 3, 3]) // the final entry is the end of the run
})

test('frameIndexAt / sampleFrames interpolate between samples', () => {
  const f = [[0, 0, 0, 0, 0, 0, 0], [1, 10, 0, 0, 0.2, -2, 0.4], [2, 20, 0, 0, 0.4, -2, 0.4]]
  assert.equal(frameIndexAt(f, 0.5), 0)
  assert.equal(frameIndexAt(f, 1.5), 1)
  assert.equal(frameIndexAt(f, 99), 2)
  const m = sampleFrames(f, 0.5)
  assert.ok(Math.abs(m[1] - 5) < 1e-9 && Math.abs(m[4] - 0.1) < 1e-9 && Math.abs(m[5] + 1) < 1e-9)
})

test('horizonAt returns the latest snapshot at or before t', () => {
  const hor = [[0.5, 'a'], [1.0, 'b'], [1.5, 'c']]
  assert.equal(horizonAt(hor, 0.2), null)
  assert.equal(horizonAt(hor, 1.2)[1], 'b')
  assert.equal(horizonAt(hor, 9)[1], 'c')
})

const veh = { L1: 4, L2: 8, d: 0.5 }
test('kinematics reproduces the slide-9 equations', () => {
  const th = 0.3, psi = 0.2, v = -1.2, delta = 0.25
  const k = kinematics([0, 0, 0, th, psi, v, delta], veh)
  const tn = Math.tan(delta)
  assert.ok(Math.abs(k.xd - v * Math.cos(th)) < 1e-12)
  assert.ok(Math.abs(k.thd - (v / veh.L1) * tn) < 1e-12)
  const psid = v * (tn / veh.L1 - Math.sin(psi) / veh.L2 - (veh.d / (veh.L1 * veh.L2)) * tn * Math.cos(psi))
  assert.ok(Math.abs(k.psid - psid) < 1e-12)
  assert.ok(Math.abs(k.steer + k.hitch + k.offset - k.psid) < 1e-12)
})

test('hitch term is destabilising in reverse and restoring going forward (the PPT non-minimum-phase point)', () => {
  assert.equal(kinematics([0, 0, 0, 0, 0.3, -1.0, 0], veh).mode, 'destabilising')
  assert.equal(kinematics([0, 0, 0, 0, 0.3, 1.0, 0], veh).mode, 'restoring')
  assert.equal(kinematics([0, 0, 0, 0, 0.0, 1.0, 0], veh).mode, 'neutral')
  // and the sign really does mean |psi| grows / shrinks
  assert.ok(kinematics([0, 0, 0, 0, 0.3, -1, 0], veh).hitch > 0) // psi > 0 and psi_dot > 0: grows
  assert.ok(kinematics([0, 0, 0, 0, 0.3, 1, 0], veh).hitch < 0)  // psi_dot < 0: shrinks
})

test('steering-wheel conversion matches the advisor (20:1, full lock 35 deg = 1.94 turns before the 1.75 cap)', () => {
  assert.ok(Math.abs(turnsOf(35 / DEG) - (35 * 20) / 360) < 1e-9)
  assert.equal(sideOf(0.05), 'straight')
  assert.equal(sideOf(0.5), 'left')
  assert.equal(sideOf(-0.5), 'right')
})

test('turn radius is infinite when straight and L1/tan(delta) otherwise', () => {
  assert.equal(kinematics([0, 0, 0, 0, 0, 1, 0.001], veh).radius, null)
  assert.ok(Math.abs(kinematics([0, 0, 0, 0, 0, 1, 0.3], veh).radius - 4 / Math.tan(0.3)) < 1e-9)
})
