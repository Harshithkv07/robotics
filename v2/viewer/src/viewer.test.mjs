// Run with:  npm test   (Node's built-in runner, no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceClock } from './clock.js'
import { frameIndexAt, sampleFrames, stepIndexAt, horizonAt, kinematics, turnsOf, sideOf, DEG, mergeLot, draftLot, rigLength, liveProgress, occupiedIds, randomOccupancy, sameIds,
  specOf, sameSpec, vehicleOf, setParam, lockTurns, turnsText, certifyFraction } from './data.js'

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

// ---------- version 2: live lots ----------
const liveVeh = { L1: 4, L2: 8, d: 0.5, width: 2.5, tractor_front: 1, trailer_rear: 2 }
const mkLot = () => ({
  vehicle: liveVeh,
  layout: {
    name: 'cross', seed: 7, bays: [
      { id: 0, cx: 0, cy: 0, theta: 0, occupied: true, status: 'occupied', parked: { cx: 0.2, cy: 0, theta: 0, l: 14.5, w: 2.5 } },
      { id: 1, cx: 5, cy: 0, theta: 0, occupied: false, status: 'pending' },
      { id: 2, cx: 10, cy: 0, theta: 0, occupied: false, status: 'pending' },
    ],
  },
  plans: {},
})

test('rig length is nose to tail from the vehicle parameters (14.5 m)', () => {
  assert.equal(rigLength(liveVeh), 14.5)
})

test('mergeLot applies verdicts, keeps unchanged bays, and only certifies a bay once its plan has arrived', () => {
  const lot = mkLot()
  const a = mergeLot(lot, [{ id: 1, status: 'ok', s: 9.1 }, { id: 2, status: 'solving' }])
  assert.equal(a.layout.bays[1].status, 'solving', 'certified but plan not fetched yet: not clickable')
  assert.equal(a.layout.bays[2].status, 'solving')
  assert.equal(a.layout.bays[0], lot.layout.bays[0], 'occupied bay object reused')
  const b = mergeLot(a, [{ id: 1, status: 'ok', s: 9.1 }, { id: 2, status: 'infeasible', reason: 'guidance not certified (clearance)' }], { 1: { duration: 50 } })
  assert.equal(b.layout.bays[1].status, 'ok')
  assert.deepEqual(b.plans['1'], { duration: 50 })
  assert.equal(b.layout.bays[2].reason, 'guidance not certified (clearance)')
  assert.deepEqual(liveProgress(b), { free: 2, decided: 2, ok: 1, failed: 1, solving: 0, pending: 0, deepening: 0 })
  const c = mergeLot(b, [{ id: 1, status: 'ok', s: 9.1 }, { id: 2, status: 'infeasible', reason: 'guidance not certified (clearance)' }])
  assert.equal(c.layout.bays[2], b.layout.bays[2], 'no change, same object: nothing re-renders')
  assert.equal(lot.layout.bays[1].status, 'pending', 'input lot untouched')
})

test('draftLot parks new rigs at the bay centre, keeps existing ones, and marks free bays as unsolved', () => {
  const lot = mergeLot(mkLot(), [{ id: 1, status: 'ok' }, { id: 2, status: 'infeasible', reason: 'x' }], { 1: {} })
  const d = draftLot(lot, [0, 2])
  assert.deepEqual(occupiedIds(d), [0, 2])
  assert.equal(d.layout.bays[0].parked.cx, 0.2, 'existing rig keeps its pose')
  assert.deepEqual(d.layout.bays[2].parked, { cx: 10, cy: 0, theta: 0, l: 14.5, w: 2.5 })
  assert.equal(d.layout.bays[2].reason, undefined)
  assert.equal(d.layout.bays[1].status, 'draft')
  assert.equal(d.layout.bays[1].parked, null)
  assert.deepEqual(d.plans, {})
  assert.deepEqual(occupiedIds(draftLot(lot, [])), [])
})

test('random fill: about half the bays filled, never fewer than three free, deterministic for a given generator', () => {
  const lot10 = (name) => ({ layout: { name, bays: Array.from({ length: 10 }, (_, id) => ({ id })) } })
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length] }
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const occ = randomOccupancy(lot10('cross'), seq([r, 0.5, 0.2, 0.8]))
    assert.ok(occ.length >= 3 && occ.length <= 7, `filled ${occ.length}`)
    assert.equal(new Set(occ).size, occ.length)
  }
  assert.deepEqual(randomOccupancy(lot10('angled'), seq([0.1, 0.7, 0.4])), randomOccupancy(lot10('angled'), seq([0.1, 0.7, 0.4])))
})

test('random fill: tandem lanes fill from their far end, so every free slot stays reachable', () => {
  const occ = randomOccupancy({ layout: { name: 'tandem', bays: Array.from({ length: 10 }, (_, id) => ({ id })) } }, () => 0.99)
  assert.deepEqual(occ, [2, 3, 4, 7, 8, 9])     // three trucks at the far end of each lane of five
  assert.ok(sameIds([3, 1], [1, 3]) && !sameIds([1], [1, 2]))
})

// ---------- version 2: the vehicle set up by the user ----------
// as a lot file carries it: radians rounded to 4 decimals
const fileVeh = { L1: 4, L2: 8, d: 0.5, width: 2.5, tractor_front: 1, tractor_rear: 1, trailer_front: 0.3, trailer_rear: 2,
  delta_max: 0.6109, psi_crit: 1.0472, psi_jack: 1.309 }
const limits = { L1: [3, 6.5], L2: [5, 13], d: [0, 1.2], delta_max: [25, 45], psi_crit: [45, 65], psi_jack: [50, 85] }

test('a lot-file vehicle reads back as whole degrees and round-trips through a spec', () => {
  const spec = specOf(fileVeh)
  assert.deepEqual(spec, { L1: 4, L2: 8, d: 0.5, delta_max: 35, psi_crit: 60, psi_jack: 75 })
  const v = vehicleOf({ ...spec, L2: 12 }, fileVeh)
  assert.equal(v.L2, 12)
  assert.equal(v.width, 2.5)                                          // parameters a spec does not cover are kept
  assert.equal(rigLength(v), 18.5)
  assert.ok(sameSpec(specOf(vehicleOf(spec, fileVeh)), spec))
  assert.ok(!sameSpec(spec, { ...spec, d: 0.6 }))
  assert.ok(!sameSpec(spec, null))
})

test('the jackknife angle stays at least the gap above the hitch limit, whichever is edited', () => {
  const spec = specOf(fileVeh)
  assert.deepEqual(setParam(spec, 'psi_crit', 65, limits, 5), { ...spec, psi_crit: 65, psi_jack: 75 })
  assert.deepEqual(setParam({ ...spec, psi_jack: 62 }, 'psi_crit', 61, limits, 5), { ...spec, psi_crit: 61, psi_jack: 66 })
  assert.deepEqual(setParam(spec, 'psi_jack', 50, limits, 5), { ...spec, psi_crit: 45, psi_jack: 50 })
  assert.deepEqual(setParam(spec, 'L1', 5, limits, 5), { ...spec, L1: 5 })
})

test('"full lock" starts at the last quarter turn before the steering lock (as sim/advisor.py)', () => {
  assert.equal(lockTurns(fileVeh), 1.75)                              // 35 deg: 1.94 turns
  assert.equal(lockTurns({ delta_max: 45 / DEG }), 2.5)               // 2.5 turns exactly
  assert.equal(lockTurns({ delta_max: 36 / DEG }), 2)                 // 2.0 turns exactly, despite rounding
  assert.equal(lockTurns({ delta_max: 25 / DEG }), 1.25)
  assert.equal(turnsText(1.75), 'full lock')
  assert.equal(turnsText(1.75, 2.5), '1¾ turns')
  assert.equal(turnsText(1.25, 1.25), 'full lock')
})

test('a bay being retried is neither certified nor decided, and keeps its place until the second attempt decides', () => {
  const lot = mkLot()
  const second = mergeLot(lot, [{ id: 1, status: 'deepening' }, { id: 2, status: 'ok' }], { 2: { duration: 9 } })
  assert.equal(second.layout.bays[1].status, 'deepening')
  assert.equal(second.layout.bays[2].status, 'ok')
  assert.deepEqual(liveProgress(second), { free: 2, decided: 1, ok: 1, failed: 0, solving: 0, pending: 0, deepening: 1 })
  const later = mergeLot(second, [{ id: 1, status: 'ok' }], { 1: { duration: 30 } })    // certified by the second attempt
  assert.equal(later.layout.bays[1].status, 'ok')
  assert.deepEqual(liveProgress(later), { free: 2, decided: 2, ok: 2, failed: 0, solving: 0, pending: 0, deepening: 0 })
  const failed = mergeLot(second, [{ id: 1, status: 'infeasible', reason: 'guidance not certified (clearance, after 6 attempts)' }])
  assert.equal(failed.layout.bays[1].status, 'infeasible')
  assert.equal(failed.layout.bays[1].reason, 'guidance not certified (clearance, after 6 attempts)')
})

test('certification progress grows with time and verdicts, never runs backwards, and only verdicts reach 100 %', () => {
  const lot = (statuses) => ({ layout: { bays: [{ id: 0, status: 'occupied' }, ...statuses.map((status, i) => ({ id: i + 1, status }))] } })
  // one bay through every state: queued, solving, retried, certified; a second bay certified early
  const path = [
    [['pending', 'solving'], { 1: ['pending', 0], 2: ['solving', 0] }, 0],
    [['solving', 'solving'], { 1: ['solving', 2], 2: ['solving', 0] }, 10],
    [['solving', 'ok'], { 1: ['solving', 2], 2: ['ok', 12] }, 20],
    [['deepening', 'ok'], { 1: ['deepening', 25], 2: ['ok', 12] }, 25],
    [['deepening', 'ok'], { 1: ['deepening', 25], 2: ['ok', 12] }, 200],
    [['ok', 'ok'], { 1: ['ok', 260], 2: ['ok', 12] }, 260],
  ]
  let last = -1
  for (const [st, since, t] of path) {
    const f = certifyFraction(lot(st), since, t)
    assert.ok(f >= last - 1e-12 && f >= 0 && f <= 1, `${st} at ${t} s: ${f} after ${last}`)
    if (st.some((s) => s !== 'ok' && s !== 'infeasible')) assert.ok(f < 1)
    last = f
  }
  assert.equal(last, 1)
  assert.equal(certifyFraction(lot(['pending', 'pending']), {}, 30), 0)
  assert.equal(certifyFraction(lot(['ok', 'infeasible']), {}, 30), 1)
})
