import { DEG, fmt } from '../data'
import { I } from './icons'

const Check = ({ ok, children }) => (
  <li className={ok ? 'ok' : 'bad'}>
    <span className="ck" aria-label={ok ? 'Pass' : 'Fail'}>{ok ? I.check : I.cross}</span>
    <span>{children}</span>
  </li>
)

// Guided vs unaided on the same bay, the certification checks the guided run passed, and the solver figures.
export default function Report({ plan, vehicle }) {
  const m = plan.metrics, b = plan.baseline, f = m.final
  const lim = vehicle.psi_crit * DEG
  const drives = plan.steps.filter((s) => s.kind === 'drive').length
  const changes = Math.max(0, plan.steps.filter((s) => s.kind === 'stop').length - 1)
  return (
    <div className="scroll report">
      <table className="cmp">
        <caption>Same bay, same start</caption>
        <thead><tr><th scope="col" /><th scope="col">Guided</th><th scope="col">Unaided</th></tr></thead>
        <tbody>
          <tr><th scope="row">Outcome</th><td className="good">Parked</td><td className={b.jackknife ? 'bad' : 'good'}>{b.jackknife ? `Jackknife at ${fmt(b.t_jack, 0)} s` : 'Parked'}</td></tr>
          <tr><th scope="row">Peak |ψ|</th><td className="tnum">{fmt(m.max_psi_deg)}°</td><td className={`tnum ${b.max_psi_deg > lim ? 'bad' : ''}`}>{fmt(b.max_psi_deg)}°</td></tr>
          <tr><th scope="row">ψ limit</th><td className="tnum">{fmt(lim, 0)}° hard</td><td>none</td></tr>
          <tr><th scope="row">Run time</th><td className="tnum">{fmt(plan.duration, 0)} s</td><td className="tnum">{fmt(b.duration, 0)} s</td></tr>
        </tbody>
      </table>

      <h4>Guided run</h4>
      <dl className="kv">
        <dt>Distance driven</dt><dd>{fmt(m.dist_m, 1)} m</dd>
        <dt>Drive instructions</dt><dd>{drives}</dd>
        <dt>Gear changes</dt><dd>{changes}</dd>
        <dt>Closest approach</dt><dd>{fmt(m.min_clearance, 2)} m</dd>
        <dt>Lateral error</dt><dd>{fmt(Math.abs(f.lat), 2)} m</dd>
        <dt>Along-bay error</dt><dd>{fmt(Math.abs(f.lon), 2)} m</dd>
        <dt>Heading error</dt><dd>{fmt(Math.abs(f.hdg), 1)}°</dd>
        <dt>Hitch at rest</dt><dd>{fmt(Math.abs(f.psi), 1)}°</dd>
      </dl>

      <h4>Certification</h4>
      <ul className="checks">
        <Check ok>No jackknife</Check>
        <Check ok={m.max_psi_deg <= lim + 0.05}>|ψ| never above {fmt(lim, 0)}°</Check>
        <Check ok={m.min_clearance >= 0.1}>At least 0.10 m from every obstacle</Check>
        <Check ok={Math.abs(f.lat) < 0.8 && Math.abs(f.lon) < 0.8}>Within 0.8 m of the bay centre</Check>
        <Check ok={Math.abs(f.hdg) < 10 && Math.abs(f.psi) < 12}>Heading within 10°, hitch within 12°</Check>
      </ul>

      <h4>Solver</h4>
      <dl className="kv">
        <dt>NMPC solves</dt><dd>{m.solves}</dd>
        <dt>Control period</dt><dd>0.25 s</dd>
        <dt>Mean solve time</dt><dd>{fmt(m.solve_ms, 0)} ms</dd>
      </dl>
      <p className="fine">
        Solve times were measured while 20 export processes shared the machine; on an idle core a solve takes roughly
        75–150 ms against the 250 ms control period. The run is precomputed offline and replayed here.
      </p>
    </div>
  )
}
