import { useState } from 'react'
import { DEG, clamp, fmt, rigLength, sameSpec, setParam, trailerAxle, vehicleOf } from '../data'
import { M, Dot } from './math'

// Pixels per metre and the tractor rear axle's place in the 320 x 166 drawing: 17 px/m with the axle at (198, 100)
// when the rig fits that way, else scaled down and centred (long rigs).
function fitView(v, psi) {
  const tl = trailerAxle(0, 0, 0, psi, v), hw = v.width / 2
  const xs = [], ys = []
  const add = (cx, cy, th, back, front) => {
    const c = Math.cos(th), sn = Math.sin(th)
    for (const [a, b] of [[-back, -hw], [front, -hw], [front, hw], [-back, hw]]) { xs.push(cx + a * c - b * sn); ys.push(cy + a * sn + b * c) }
  }
  add(tl.x, tl.y, tl.th, v.trailer_rear, v.L2 + v.trailer_front)
  add(0, 0, 0, v.tractor_rear, v.L1 + v.tractor_front + 0.6)     // + where the centre line ends
  ys.push(-hw - 2.3)                                               // the L1 label under the tractor
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  if (198 + x0 * 17 >= 6 && 198 + x1 * 17 <= 314 && 100 - y1 * 17 >= 4 && 100 - y0 * 17 <= 162) return { s: 17, ox: 198, oy: 100 }
  const s = Math.min(17, 308 / (x1 - x0), 158 / (y1 - y0))
  return { s, ox: 160 - ((x0 + x1) / 2) * s, oy: 83 + ((y0 + y1) / 2) * s }
}

// Top view of the rig, drawn from the real parameters, with the symbols the model uses.
function VehicleDiagram({ v }) {
  const psi = 24 * Math.PI / 180                 // a hitch angle, to show psi
  const delta = 22 * Math.PI / 180               // a steering angle, to show delta
  const { s, ox, oy } = fitView(v, psi)          // px per metre; tractor rear axle, heading east
  const X = (x) => ox + x * s, Y = (y) => oy - y * s
  const tl = trailerAxle(0, 0, 0, psi, v)        // trailer axle and heading in the tractor's frame
  const W = v.width
  const rect = (cx, cy, th, back, front) => {
    const c = Math.cos(th), sn = Math.sin(th), hw = W / 2
    return [[-back, -hw], [front, -hw], [front, hw], [-back, hw]]
      .map(([a, b]) => `${X(cx + a * c - b * sn).toFixed(1)},${Y(cy + a * sn + b * c).toFixed(1)}`).join(' ')
  }
  const hx = v.d, fx = v.L1
  const t1 = tl.th
  const off = W / 2 - 0.2                        // wheel track, each side of the centre line
  const wheel = (x, y, th, len = 1.0) => {
    const c = Math.cos(th), sn = Math.sin(th)
    return <line x1={X(x - len / 2 * c)} y1={Y(y - len / 2 * sn)} x2={X(x + len / 2 * c)} y2={Y(y + len / 2 * sn)} stroke="#c1c8d2" strokeWidth="4.5" strokeLinecap="round" />
  }
  return (
    <svg className="vdiag" viewBox="0 0 320 166" role="img" aria-label="Tractor-trailer seen from above with wheelbase L1, trailer length L2, hitch offset d, hitch angle psi and steering angle delta">
      {/* trailer and tractor bodies */}
      <polygon points={rect(tl.x, tl.y, t1, v.trailer_rear, v.L2 + v.trailer_front)} fill="#232a33" stroke="#8b95a4" strokeWidth="1.2" />
      <polygon points={rect(0, 0, 0, v.tractor_rear, v.L1 + v.tractor_front)} fill="rgba(240, 136, 62, 0.22)" stroke="#f0883e" strokeWidth="1.2" />
      {/* axles and wheels */}
      {[1, -1].map((sd) => (
        <g key={sd}>
          {wheel(fx, sd * off, delta)}
          {wheel(0, sd * off, 0)}
          {wheel(tl.x - sd * off * Math.sin(t1), tl.y + sd * off * Math.cos(t1), t1)}
        </g>
      ))}
      {/* centre lines */}
      <line x1={X(hx)} y1={Y(0)} x2={X(tl.x)} y2={Y(tl.y)} stroke="#5c6674" strokeWidth="1" strokeDasharray="3 2" />
      <line x1={X(-1.2)} y1={Y(0)} x2={X(fx + 1.4)} y2={Y(0)} stroke="#5c6674" strokeWidth="1" strokeDasharray="3 2" />
      {/* psi: angle between the tractor axis (extended back) and the trailer axis at the hitch */}
      {(() => {
        const r = 2.4
        const a0 = Math.PI, a1 = Math.PI + t1
        const [x0, y0] = [X(hx + r * Math.cos(a0)), Y(r * Math.sin(a0))]
        const [x1, y1] = [X(hx + r * Math.cos(a1)), Y(r * Math.sin(a1))]
        return <path d={`M ${x0} ${y0} A ${r * s} ${r * s} 0 0 1 ${x1} ${y1}`} fill="none" stroke="#f85149" strokeWidth="1.4" />
      })()}
      <text className="vd-t" x={X(hx - 4.5)} y={Y(0.7) + 4} fill="#ff7b72">ψ</text>
      {/* delta at the front wheels */}
      <text className="vd-t" x={X(fx + 0.75)} y={Y(W / 2 + 0.45)}>δ</text>
      {/* dimensions: L1 below the tractor, d at the hitch, L2 along the trailer */}
      <g stroke="#8b95a4" strokeWidth="1">
        <line x1={X(0)} y1={Y(-W / 2 - 0.9)} x2={X(fx)} y2={Y(-W / 2 - 0.9)} markerStart="url(#vd-a)" markerEnd="url(#vd-a)" />
        <line x1={X(0)} y1={Y(-W / 2 - 0.3)} x2={X(0)} y2={Y(-W / 2 - 1.3)} />
        <line x1={X(fx)} y1={Y(-W / 2 - 0.3)} x2={X(fx)} y2={Y(-W / 2 - 1.3)} />
      </g>
      <text className="vd-t" x={X(fx / 2) - 7} y={Y(-W / 2 - 2.1)}>L<tspan className="vd-s" dy="3">1</tspan></text>
      <circle cx={X(hx)} cy={Y(0)} r="3.2" fill="#e6e9ee" />
      <circle cx={X(0)} cy={Y(0)} r="2.6" fill="#f0883e" />
      <text className="vd-t" x={X(hx) + 5} y={Y(0.55)}>d</text>
      <text className="vd-t" x={(X(hx) + X(tl.x)) / 2 - 4} y={(Y(0) + Y(tl.y)) / 2 - 9}>L<tspan className="vd-s" dy="3">2</tspan></text>
      <circle cx={X(tl.x)} cy={Y(tl.y)} r="2.6" fill="#8b95a4" />
      <defs>
        <marker id="vd-a" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L6 3L0 6z" fill="#8b95a4" />
        </marker>
      </defs>
    </svg>
  )
}

// The parameters the set-up step can change, in display order. `step`: the - / + buttons; `dp`: decimals shown.
const PARAMS = [
  { key: 'L1', label: <><M>L</M><sub>1</sub> wheelbase</>, name: 'Tractor wheelbase L1', unit: 'm', step: 0.5, dp: 1 },
  { key: 'L2', label: <><M>L</M><sub>2</sub> trailer</>, name: 'Hitch to trailer axle L2', unit: 'm', step: 0.5, dp: 1 },
  { key: 'd', label: <><M>d</M> hitch offset</>, name: 'Hitch offset d, ahead of the tractor rear axle', unit: 'm', step: 0.1, dp: 1 },
  { key: 'delta_max', label: <><M>δ</M><sub>max</sub> lock</>, name: 'Steering lock', unit: '°', step: 1, dp: 0 },
  { key: 'psi_crit', label: <><M>ψ</M> limit</>, name: 'Hitch-angle limit the NMPC enforces', unit: '°', step: 1, dp: 0 },
  { key: 'psi_jack', label: <><M>ψ</M> jackknife</>, name: 'Jackknife angle (tractor meets trailer)', unit: '°', step: 1, dp: 0 },
]

// Typical rigs, as changes to the standard one (the library rig).
export const PRESETS = [
  { name: 'Standard', title: 'The rig the library was solved for: 4 m wheelbase, 8 m trailer', spec: {} },
  { name: 'City', title: 'Short day cab with a short trailer: 3.5 m wheelbase, 6 m trailer', spec: { L1: 3.5, L2: 6, d: 0.3 } },
  { name: 'Long-haul', title: 'Long tractor with a long trailer: 5 m wheelbase, 12 m trailer', spec: { L1: 5, L2: 12, d: 0.6 } },
]

const roundTo = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp
const numText = (v, dp) => (dp ? v.toFixed(dp) : String(v))

// One editable parameter: type a value or step it. A typed value applies as soon as it is in range; leaving the field
// clamps an out-of-range number and restores anything else.
function ParamField({ p, value, lo, hi, onChange }) {
  const [text, setText] = useState(null)              // what is being typed, while the field has focus
  const n = text == null ? value : Number(text.replace(',', '.'))
  const valid = text == null || (text.trim() !== '' && Number.isFinite(n) && n >= lo - 1e-9 && n <= hi + 1e-9)
  const set = (v) => onChange(clamp(roundTo(v, p.dp), lo, hi))
  const range = `${numText(lo, p.dp)}–${numText(hi, p.dp)}${p.unit === '°' ? '°' : ' m'}`
  const id = `veh-${p.key}`
  return (
    <div className={`pf ${valid ? '' : 'bad'}`} title={`${p.name}: ${range}`}>
      <dt><label htmlFor={id}>{p.label}</label><span className="pf-r">{range}</span></dt>
      <dd>
        <button type="button" className="pf-b" onClick={() => { setText(null); set(value - p.step) }} disabled={value <= lo}
          aria-label={`Decrease ${p.name}`}>−</button>
        <span className={`pf-v ${p.unit === '°' ? 'deg' : ''}`}>
          <input id={id} inputMode="decimal" autoComplete="off" spellCheck="false" aria-invalid={!valid}
            style={{ width: `${numText(hi, p.dp).length + 0.6}ch` }}
            value={text ?? numText(value, p.dp)}
            onChange={(e) => {
              setText(e.target.value)
              const v = Number(e.target.value.replace(',', '.'))
              if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= lo && v <= hi) onChange(roundTo(v, p.dp))
            }}
            onBlur={() => { if (text != null && text.trim() !== '' && Number.isFinite(n)) set(n); setText(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              else if (e.key === 'Escape') { setText(null); e.currentTarget.blur() }
              else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault(); setText(null); set(value + (e.key === 'ArrowUp' ? p.step : -p.step))
              }
            }} />
          <span className="pf-u" aria-hidden="true">{p.unit}</span>
        </span>
        <button type="button" className="pf-b" onClick={() => { setText(null); set(value + p.step) }} disabled={value >= hi}
          aria-label={`Increase ${p.name}`}>+</button>
      </dd>
    </div>
  )
}

// Shown while setting up the lot and choosing a bay: the vehicle and the model it runs on. `edit` (set-up step only)
// makes the vehicle editable: {spec, base, limits, onChange(spec)}, or {offline: true} without the live solver.
export default function About({ vehicle, edit }) {
  const editing = edit && !edit.offline
  const v = editing ? vehicleOf(edit.spec, vehicle) : vehicle
  const preset = editing && PRESETS.find((p) => sameSpec(edit.spec, { ...edit.base, ...p.spec }))
  return (
    <>
      <section className={`panel ${editing ? 'veh-edit' : ''}`} aria-label="The vehicle">
        <header className="panel-h"><h3>The vehicle</h3><span className="panel-m">{fmt(rigLength(v), 1)} m nose to tail, top view</span></header>
        <VehicleDiagram v={v} />
        {editing ? (
          <>
            <div className="seg presets" role="group" aria-label="Vehicle presets">
              {PRESETS.map((p) => (
                <button key={p.name} aria-pressed={preset === p} title={p.title}
                  onClick={() => edit.onChange({ ...edit.base, ...p.spec })}>{p.name}</button>
              ))}
            </div>
            <dl className="params edit">
              {PARAMS.map((p) => (
                <ParamField key={p.key} p={p} value={edit.spec[p.key]} lo={edit.limits[p.key][0]} hi={edit.limits[p.key][1]}
                  onChange={(val) => edit.onChange(setParam(edit.spec, p.key, val, edit.limits, edit.gap))} />
              ))}
            </dl>
            <p className="fine veh-note">Bays, aisles and the parked trucks are sized for this rig, and every free bay is re-planned and certified for it.</p>
          </>
        ) : (
          <>
            <dl className="params">
              <div><dt><M>L</M><sub>1</sub> wheelbase</dt><dd>{fmt(v.L1, 1)} m</dd></div>
              <div><dt><M>L</M><sub>2</sub> trailer</dt><dd>{fmt(v.L2, 1)} m</dd></div>
              <div><dt><M>d</M> hitch offset</dt><dd>{fmt(v.d, 1)} m</dd></div>
              <div><dt><M>δ</M><sub>max</sub> lock</dt><dd>{fmt(v.delta_max * DEG, 0)}°</dd></div>
              <div><dt><M>ψ</M> limit</dt><dd>{fmt(v.psi_crit * DEG, 0)}°</dd></div>
              <div><dt><M>ψ</M> jackknife</dt><dd>{fmt(v.psi_jack * DEG, 0)}°</dd></div>
            </dl>
            {edit?.offline && <p className="fine veh-note">Changing the vehicle needs the live solver: start <code>v2/run_demo.bat</code>.</p>}
          </>
        )}
      </section>
      <section className="panel" aria-label="Kinematic model">
        <header className="panel-h"><h3>Kinematic model</h3><span className="panel-m"><M>X</M> = [<M>x</M><sub>1</sub>, <M>y</M><sub>1</sub>, <M>θ</M><sub>0</sub>, <M>ψ</M>]&ensp;<M>U</M> = [<M>v</M>, <M>δ</M>]</span></header>
        <div className="eqs">
          <div><Dot>x</Dot><sub>1</sub> = <M>v</M> cos <M>θ</M><sub>0</sub></div>
          <div><Dot>y</Dot><sub>1</sub> = <M>v</M> sin <M>θ</M><sub>0</sub></div>
          <div><Dot tall>θ</Dot><sub>0</sub> = (<M>v</M> / <M>L</M><sub>1</sub>) tan <M>δ</M></div>
          <div><span className="nw"><Dot tall>ψ</Dot> = <M>v</M> [ tan <M>δ</M> / <M>L</M><sub>1</sub></span>{' '}<span className="nw">− sin <M>ψ</M> / <M>L</M><sub>2</sub></span>{' '}<span className="nw">− (<M>d</M> / <M>L</M><sub>1</sub><M>L</M><sub>2</sub>) tan <M>δ</M> cos <M>ψ</M> ]</span></div>
        </div>
      </section>
    </>
  )
}
