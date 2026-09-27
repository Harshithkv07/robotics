import { DEG, fmt, horizonAt, kinematics } from '../data'

const sgn = (v, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`

function Cell({ k, v, u }) {
  return <div className="cell"><span className="k">{k}<i>{u}</i></span><span className="v">{v}</span></div>
}

function Row({ eq, val, unit, sub, tone, tag }) {
  return (
    <div className={`mrow ${sub ? 'sub' : ''}`}>
      <span className="eq">{eq}</span>
      <span className={`mv ${tone || ''}`}>{val}<i>{unit}</i></span>
      {tag && <span className={`pill ${tag.tone}`}>{tag.text}</span>}
    </div>
  )
}

export default function MathPanel({ frameText, plan, tText, vehicle, baseline }) {
  const [, x, y, th, psi, v, delta] = frameText
  const k = kinematics(frameText, vehicle)
  const lim = vehicle.psi_crit * DEG
  const margin = lim - Math.abs(psi * DEG)
  const lock = vehicle.delta_max * DEG
  const hor = baseline ? null : horizonAt(plan.hor, tText)
  let peak = null
  if (hor) {
    hor[1].forEach((s, i) => {
      const a = Math.abs(s[3] * DEG)
      if (!peak || a > peak.deg) peak = { deg: a, at: 0.4 + 0.8 * i }
    })
  }
  const mode = { destabilising: { tone: 'danger', text: 'destabilising' }, restoring: { tone: 'ok', text: 'restoring' }, neutral: { tone: 'muted', text: 'neutral' } }[k.mode]
  return (
    <section className="card math" aria-label="Live mathematics">
      <div className="card-h"><h3>Live maths</h3><span className="muted tiny">the model, evaluated now</span></div>

      <div className="cells">
        <Cell k="x₁" v={fmt(x)} u=" m" />
        <Cell k="y₁" v={fmt(y)} u=" m" />
        <Cell k="θ₀" v={fmt(th * DEG, 0)} u=" °" />
        <Cell k="ψ" v={sgn(psi * DEG)} u=" °" />
        <Cell k="v" v={sgn(v, 2)} u=" m/s" />
        <Cell k="δ" v={sgn(delta * DEG)} u=" °" />
      </div>

      <div className="mlabel">Kinematics</div>
      <Row eq="ẋ₁ = v cos θ₀" val={sgn(k.xd, 2)} unit=" m/s" />
      <Row eq="ẏ₁ = v sin θ₀" val={sgn(k.yd, 2)} unit=" m/s" />
      <Row eq="θ̇₀ = (v/L₁) tan δ" val={sgn(k.thd * DEG)} unit=" °/s" />
      <Row eq="ψ̇ = steer + hitch + offset" val={sgn(k.psid * DEG)} unit=" °/s" tone="strong" />
      <Row sub eq="v tanδ / L₁   (steering)" val={sgn(k.steer * DEG)} unit=" °/s" />
      <Row sub eq="−v sinψ / L₂   (hitch)" val={sgn(k.hitch * DEG)} unit=" °/s" tag={mode} />
      <Row sub eq="−v d tanδ cosψ / L₁L₂  (offset)" val={sgn(k.offset * DEG)} unit=" °/s" />
      <Row eq="Turn radius R = L₁ / tan δ" val={k.radius == null ? '∞' : fmt(k.radius, 1)} unit={k.radius == null ? '' : ' m'} />

      <div className="mlabel">Constraints</div>
      <div className="cons">
        <div><span>|ψ| ≤ {fmt(lim, 0)}°</span><span className={`pill ${margin < 6 ? 'warn' : 'ok'}`}>{margin < 6 ? 'ACTIVE' : 'inactive'}</span><em className="mono">margin {fmt(margin)}°</em></div>
        <div><span>|δ| ≤ {fmt(lock, 0)}°</span><span className={`pill ${Math.abs(delta * DEG) > lock * 0.97 ? 'warn' : 'ok'}`}>{Math.abs(delta * DEG) > lock * 0.97 ? 'AT LOCK' : 'free'}</span><em className="mono">{fmt((Math.abs(delta * DEG) / lock) * 100, 0)}% of lock</em></div>
      </div>

      <div className="mlabel">NMPC look-ahead</div>
      {baseline ? (
        <p className="tiny muted" style={{ margin: 0 }}>The unaided driver has no model and no prediction: nothing checks the hitch angle before it is too late.</p>
      ) : peak ? (
        <p className="look">
          Next <b>9.6 s</b>: predicted peak |ψ| <b className={peak.deg > lim * 0.9 ? 'danger' : ''}>{fmt(peak.deg, 0)}°</b> at +{fmt(peak.at, 1)} s, steered to stay under {fmt(lim, 0)}°.
        </p>
      ) : (
        <p className="tiny muted" style={{ margin: 0 }}>No prediction yet.</p>
      )}

      <details className="ref">
        <summary>Model and objective</summary>
        <div className="refbody">
          <div>L₁ = {vehicle.L1} m &middot; L₂ = {vehicle.L2} m &middot; d = {vehicle.d} m</div>
          <div>J = Σ ‖X − X_ref‖²_Q + ‖U‖²_R + ‖ΔU‖²_S</div>
          <div>s.t. |ψ| ≤ ψ_crit (hard) · |δ| ≤ δ_max · clearance ≥ margin</div>
          <div>Reversing (v &lt; 0) flips the sign of the hitch term: it now amplifies ψ instead of correcting it.</div>
        </div>
      </details>
    </section>
  )
}
