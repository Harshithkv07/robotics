import { DEG, clamp, fmt, turnsOf, sideOf } from '../data'

const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
const arcPath = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
}

// Dials sweep the top half-circle: value min -> 180 deg (left), max -> 360 deg (right).
const sweep = (v, min, max) => Math.PI * (1 + (clamp(v, min, max) - min) / (max - min))

function Wheel({ delta, deltaText, advisedTurns }) {
  const turns = turnsOf(delta)
  const turnsT = turnsOf(deltaText)
  const rot = -turns * 360 // left turn (positive) rotates counter-clockwise
  const advRot = advisedTurns == null ? null : -advisedTurns * 360
  const side = sideOf(turnsT)
  return (
    <div className="inst">
      <svg viewBox="0 0 120 84" role="img" aria-label={`Steering wheel ${fmt(Math.abs(turnsT), 2)} turns ${side}`}>
        {advRot != null && (
          <g transform={`translate(60 44) rotate(${advRot})`}>
            <line x1="0" y1="-38" x2="0" y2="-47" stroke="#ffb547" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        <g transform={`translate(60 44) rotate(${rot})`}>
          <circle r="33" fill="none" stroke="#2b3d50" strokeWidth="8" />
          <circle r="33" fill="none" stroke="#38d0e8" strokeWidth="2" />
          <circle r="7" fill="#243446" stroke="#38d0e8" strokeWidth="1.5" />
          <line x1="-33" y1="0" x2="-7" y2="0" stroke="#2b3d50" strokeWidth="6" strokeLinecap="round" />
          <line x1="33" y1="0" x2="7" y2="0" stroke="#2b3d50" strokeWidth="6" strokeLinecap="round" />
          <line x1="0" y1="7" x2="0" y2="33" stroke="#2b3d50" strokeWidth="6" strokeLinecap="round" />
          <polygon points="-4.5,-39 4.5,-39 0,-31" fill="#38d0e8" />
        </g>
      </svg>
      <div className="val">{fmt(Math.abs(turnsT), 2)}<span className="unit"> turns {side === 'straight' ? '' : side}</span></div>
      <div className="cap">Steering wheel<br />road wheels {fmt(Math.abs(deltaText) * DEG, 0)}&deg;</div>
    </div>
  )
}

function Hitch({ psi, psiText, limit }) {
  const lim = limit * DEG
  const cx = 60, cy = 62, R = 44
  const a = (d) => sweep(d, -80, 80)
  const [nx, ny] = polar(cx, cy, R - 7, a(psi * DEG))
  const margin = lim - Math.abs(psiText * DEG)
  const tone = margin < 8 ? 'danger' : margin < 20 ? 'warn' : 'ok'
  const col = { danger: '#ff5c6c', warn: '#ffb547', ok: '#3ddc97' }[tone]
  return (
    <div className="inst">
      <svg viewBox="0 0 120 84" role="img" aria-label={`Hitch angle ${fmt(psiText * DEG)} degrees, limit ${fmt(lim, 0)}`}>
        <path d={arcPath(cx, cy, R, a(-80), a(80))} stroke="#1d2b3a" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arcPath(cx, cy, R, a(-lim * 0.58), a(lim * 0.58))} stroke="#2f7d61" strokeWidth="10" fill="none" />
        <path d={arcPath(cx, cy, R, a(lim * 0.58), a(lim))} stroke="#a9762b" strokeWidth="10" fill="none" />
        <path d={arcPath(cx, cy, R, a(-lim), a(-lim * 0.58))} stroke="#a9762b" strokeWidth="10" fill="none" />
        <path d={arcPath(cx, cy, R, a(lim), a(80))} stroke="#a3384a" strokeWidth="10" fill="none" />
        <path d={arcPath(cx, cy, R, a(-80), a(-lim))} stroke="#a3384a" strokeWidth="10" fill="none" />
        {[-lim, lim].map((d) => {
          const [x0, y0] = polar(cx, cy, R - 9, a(d)), [x1, y1] = polar(cx, cy, R + 9, a(d))
          return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#e8eef4" strokeWidth="2" />
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={col} />
        <text x={polar(cx, cy, R + 14, a(-lim))[0]} y={polar(cx, cy, R + 14, a(-lim))[1] + 3} fill="#92a4b6" fontSize="8" textAnchor="middle" fontFamily="var(--mono)">-{fmt(lim, 0)}</text>
        <text x={polar(cx, cy, R + 14, a(lim))[0]} y={polar(cx, cy, R + 14, a(lim))[1] + 3} fill="#92a4b6" fontSize="8" textAnchor="middle" fontFamily="var(--mono)">+{fmt(lim, 0)}</text>
      </svg>
      <div className={`val ${tone}`}>{psiText >= 0 ? '+' : ''}{fmt(psiText * DEG)}&deg;</div>
      <div className="cap">Hitch angle &psi;<br />margin {fmt(Math.max(0, margin), 0)}&deg; to limit</div>
    </div>
  )
}

const SPEED_MAX = 8
function Speed({ v, vText, advisedKmh, gear }) {
  const cx = 60, cy = 62, R = 44
  const a = (k) => sweep(k, 0, SPEED_MAX)
  const kmh = Math.abs(v) * 3.6
  const kmhT = Math.abs(vText) * 3.6
  const [nx, ny] = polar(cx, cy, R - 7, a(kmh))
  const state = kmhT < 0.15 ? 'stopped' : vText < 0 ? 'reverse' : 'forward'
  const g = state === 'stopped' ? 'N' : vText < 0 ? 'R' : 'D'
  return (
    <div className="inst">
      <svg viewBox="0 0 120 84" role="img" aria-label={`Speed ${fmt(kmhT)} kilometres per hour, ${state}`}>
        <path d={arcPath(cx, cy, R, a(0), a(SPEED_MAX))} stroke="#1d2b3a" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arcPath(cx, cy, R, a(0), a(Math.min(kmh, SPEED_MAX)))} stroke={vText < 0 ? '#ffb547' : '#3ddc97'} strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.85" />
        {[0, 2, 4, 6, 8].map((k) => {
          const [x0, y0] = polar(cx, cy, R + 7, a(k)), [x1, y1] = polar(cx, cy, R + 12, a(k)), [tx, ty] = polar(cx, cy, R + 19, a(k))
          return <g key={k}><line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#5f7285" strokeWidth="1.2" /><text x={tx} y={ty + 3} fill="#92a4b6" fontSize="8" textAnchor="middle" fontFamily="var(--mono)">{k}</text></g>
        })}
        {advisedKmh != null && (() => {
          const [x0, y0] = polar(cx, cy, R - 9, a(advisedKmh)), [x1, y1] = polar(cx, cy, R + 8, a(advisedKmh))
          return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffb547" strokeWidth="3.5" strokeLinecap="round" />
        })()}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e8eef4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#e8eef4" />
        <text x={cx} y={cy + 17} fill={g === 'R' ? '#ffb547' : g === 'D' ? '#3ddc97' : '#92a4b6'} fontSize="13" fontWeight="700" textAnchor="middle" fontFamily="var(--mono)">{g}</text>
      </svg>
      <div className="val">{fmt(kmhT)}<span className="unit"> km/h</span></div>
      <div className="cap">Speed<br />{state}</div>
    </div>
  )
}

// frame: smooth (needles); frameText: refreshed ~5 Hz (numbers). advised: {turns, kmh} from the current step.
export default function Instruments({ frame, frameText, vehicle, advised }) {
  return (
    <section className="card" aria-label="Instruments">
      <div className="inst-row">
        <Wheel delta={frame[6]} deltaText={frameText[6]} advisedTurns={advised?.turns} />
        <Speed v={frame[5]} vText={frameText[5]} advisedKmh={advised?.kmh} />
        <Hitch psi={frame[4]} psiText={frameText[4]} limit={vehicle.psi_crit} />
      </div>
      {advised && <div className="inst-key"><i className="key-amber" /> amber marker = advised value for this step</div>}
    </section>
  )
}
