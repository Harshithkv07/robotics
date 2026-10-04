import { DEG, fmt } from '../data'

const Check = ({ ok, children }) => (
  <li className={ok ? 'ok' : 'bad'}>
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ok ? <path d="M3 8.5l3.2 3L13 4.5" /> : <path d="M4 4l8 8M12 4l-8 8" />}</svg>
    {children}
  </li>
)

const Kpi = ({ k, v, u, note }) => <div className="kpi"><span className="k">{k}</span><span className="v">{v}<i>{u}</i></span>{note && <span className="n">{note}</span>}</div>

export default function RunSummary({ plan, vehicle }) {
  const m = plan.metrics, b = plan.baseline
  const lim = vehicle.psi_crit * DEG
  const drives = plan.steps.filter((s) => s.kind === 'drive')
  const stops = plan.steps.filter((s) => s.kind === 'stop').length - 1
  const f = m.final
  return (
    <div className="summary">
      <div className="sum-col">
        <h4>Guided run (NMPC)</h4>
        <div className="kpis">
          <Kpi k="Duration" v={fmt(plan.duration, 0)} u=" s" />
          <Kpi k="Distance" v={fmt(m.dist_m, 0)} u=" m" />
          <Kpi k="Instructions" v={drives.length} u=" drives" note={`${Math.max(0, stops)} gear change${stops === 1 ? '' : 's'}`} />
          <Kpi k="Peak hitch |ψ|" v={fmt(m.max_psi_deg)} u="°" note={`limit ${fmt(lim, 0)}°`} />
          <Kpi k="Closest approach" v={fmt(m.min_clearance, 2)} u=" m" />
          <Kpi k="Parked error" v={fmt(Math.abs(f.lat), 2)} u=" m" note={`${fmt(Math.abs(f.hdg), 1)}° heading, ${fmt(Math.abs(f.psi), 1)}° hitch`} />
        </div>
        <ul className="checks" aria-label="Certification criteria">
          <Check ok>No jackknife</Check>
          <Check ok={m.max_psi_deg <= lim + 0.05}>|ψ| never above {fmt(lim, 0)}° ({fmt(m.max_psi_deg)}° peak)</Check>
          <Check ok={m.min_clearance >= 0.1}>At least 0.10 m from every obstacle</Check>
          <Check ok={Math.abs(f.lat) < 0.8 && Math.abs(f.lon) < 0.8}>Within 0.8 m of the bay centre</Check>
          <Check ok={Math.abs(f.hdg) < 10 && Math.abs(f.psi) < 12}>Aligned within 10° with hitch under 12°</Check>
        </ul>
      </div>
      <div className="sum-col">
        <h4>Unaided driver</h4>
        <div className="kpis">
          <Kpi k="Outcome" v={b.jackknife ? 'Jackknife' : 'Parked'} u="" note={b.jackknife ? `after ${fmt(b.t_jack, 0)} s` : 'forward motion is stable'} />
          <Kpi k="Peak hitch |ψ|" v={fmt(b.max_psi_deg)} u="°" note={b.jackknife ? 'past the physical limit' : ''} />
          <Kpi k="Run length" v={fmt(b.duration, 0)} u=" s" />
        </div>
        <h4 style={{ marginTop: 14 }}>Solver</h4>
        <div className="kpis">
          <Kpi k="NMPC solves" v={m.solves} u="" note="one every 0.25 s" />
          <Kpi k="Mean solve" v={fmt(m.solve_ms, 0)} u=" ms" note="measured under a 20-process load" />
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>The run is precomputed offline; on an idle core a solve takes roughly 75&ndash;150 ms against the 250 ms control period.</p>
      </div>
    </div>
  )
}
