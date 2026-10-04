import { DEG, fmt } from '../data'
import { M, Dot } from './math'

// Shown while choosing a bay: what the problem is, how the system solves it, and the model it runs on.
export default function About({ vehicle }) {
  const v = vehicle
  return (
    <>
      <section className="panel" aria-label="The problem">
        <header className="panel-h"><h3>The problem</h3></header>
        <p className="prose">
          Reversing a tractor-trailer is open-loop unstable: a small hitch-angle error grows until the rig
          jackknifes. Guidance plans the manoeuvre and keeps the hitch angle inside a hard limit.
        </p>
      </section>

      <section className="panel" aria-label="Method">
        <header className="panel-h"><h3>Method</h3></header>
        <ol className="pipeline">
          <li><b>Lot</b><span>Four layouts, random fills, start at the gate.</span></li>
          <li><b>Hybrid A*</b><span>Searches hitch-stabilised motion primitives.</span></li>
          <li><b>NMPC</b><span>9.6 s horizon every 0.25 s, |<M>ψ</M>| ≤ {fmt(v.psi_crit * DEG, 0)}° hard.</span></li>
          <li><b>Advisor</b><span>Gear, speed, wheel turns, distance per step.</span></li>
        </ol>
      </section>

      <section className="panel" aria-label="Vehicle model">
        <header className="panel-h"><h3>Vehicle model</h3><span className="panel-m">kinematic, low speed</span></header>
        <div className="eqs">
          <div><Dot>x</Dot><sub>1</sub> = <M>v</M> cos <M>θ</M><sub>0</sub></div>
          <div><Dot>y</Dot><sub>1</sub> = <M>v</M> sin <M>θ</M><sub>0</sub></div>
          <div><Dot tall>θ</Dot><sub>0</sub> = (<M>v</M> / <M>L</M><sub>1</sub>) tan <M>δ</M></div>
          <div><Dot tall>ψ</Dot> = <M>v</M> [ tan <M>δ</M> / <M>L</M><sub>1</sub> − sin <M>ψ</M> / <M>L</M><sub>2</sub> − (<M>d</M> / <M>L</M><sub>1</sub><M>L</M><sub>2</sub>) tan <M>δ</M> cos <M>ψ</M> ]</div>
        </div>
        <dl className="params">
          <dt><M>L</M><sub>1</sub></dt><dd>{fmt(v.L1, 1)} m</dd><dd>tractor wheelbase</dd>
          <dt><M>L</M><sub>2</sub></dt><dd>{fmt(v.L2, 1)} m</dd><dd>hitch to trailer axle</dd>
          <dt><M>d</M></dt><dd>{fmt(v.d, 1)} m</dd><dd>hitch ahead of rear axle</dd>
          <dt><M>δ</M><sub>max</sub></dt><dd>{fmt(v.delta_max * DEG, 0)}°</dd><dd>steering lock</dd>
          <dt><M>ψ</M><sub>lim</sub></dt><dd>{fmt(v.psi_crit * DEG, 0)}°</dd><dd>hard limit in the NMPC</dd>
          <dt><M>ψ</M><sub>jack</sub></dt><dd>{fmt(v.psi_jack * DEG, 0)}°</dd><dd>counted as a jackknife</dd>
        </dl>
      </section>
    </>
  )
}

// What "certified" means; sits under the bay list in the rail.
export function Certification({ vehicle }) {
  return (
    <section className="rail-sec" aria-label="Certification">
      <h3>Certified means the closed-loop run</h3>
      <ul className="crit">
        <li>never jackknifes and keeps |<M>ψ</M>| ≤ {fmt(vehicle.psi_crit * DEG, 0)}°</li>
        <li>stays at least 0.10 m from every obstacle</li>
        <li>parks within 0.8 m of the bay centre, 10° of heading and 12° of hitch</li>
      </ul>
    </section>
  )
}
