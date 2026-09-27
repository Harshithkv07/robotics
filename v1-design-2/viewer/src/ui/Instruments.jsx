import { DEG, clamp, fmt, turnsOf, turnsText, sideOf } from '../data'
import { C } from '../theme'

const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}
// Dials sweep the top half-circle: min -> left, max -> right.
const sweep = (v, min, max) => Math.PI * (1 + (clamp(v, min, max) - min) / (max - min))
const signed = (v, d = 1) => { const r = Number(v.toFixed(d)); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}` }

// ---------- hitch angle: dial + readouts + look-ahead chart ----------

function HitchDial({ psiDeg, lim, peak }) {
  const cx = 100, cy = 102, R = 80
  const a = (d) => sweep(d, -90, 90)
  const caution = lim * 0.58
  const [nx, ny] = polar(cx, cy, R - 12, a(psiDeg))
  const hot = Math.abs(psiDeg) > lim * 0.92
  return (
    <svg className="dial" viewBox="-12 -8 224 124" role="img" aria-label={`Hitch angle ${fmt(psiDeg)} degrees; limit ${fmt(lim, 0)}`}>
      <path d={arc(cx, cy, R, a(-caution), a(caution))} stroke={C.zoneSafe} strokeWidth="11" fill="none" />
      <path d={arc(cx, cy, R, a(caution), a(lim))} stroke={C.zoneCaution} strokeWidth="11" fill="none" />
      <path d={arc(cx, cy, R, a(-lim), a(-caution))} stroke={C.zoneCaution} strokeWidth="11" fill="none" />
      <path d={arc(cx, cy, R, a(lim), a(90))} stroke={C.zoneLimit} strokeWidth="11" fill="none" />
      <path d={arc(cx, cy, R, a(-90), a(-lim))} stroke={C.zoneLimit} strokeWidth="11" fill="none" />
      {Array.from({ length: 19 }, (_, i) => -90 + i * 10).map((d) => {
        const major = d % 30 === 0
        const [x0, y0] = polar(cx, cy, R + 6.5, a(d)), [x1, y1] = polar(cx, cy, R + (major ? 11 : 9), a(d))
        return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? C.ink2 : C.ink4} strokeWidth={major ? 1.2 : 0.8} />
      })}
      {[-90, -60, -30, 0, 30, 60, 90].map((d) => {
        const [x, y] = polar(cx, cy, R + 19, a(d))
        const isLim = Math.abs(Math.abs(d) - lim) < 0.5
        return <text key={d} x={x} y={y + 3} className={`dial-t ${isLim ? 'lim' : ''}`} textAnchor="middle">{d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0'}</text>
      })}
      {[-lim, lim].map((d) => {
        const [x0, y0] = polar(cx, cy, R - 8, a(d)), [x1, y1] = polar(cx, cy, R + 8, a(d))
        return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.danger} strokeWidth="2.2" />
      })}
      {peak && (() => {
        const ang = a(peak.psi)
        const [tx, ty] = polar(cx, cy, R - 7, ang)
        const [lx, ly] = polar(cx, cy, R - 16, ang + 0.07)
        const [rx, ry] = polar(cx, cy, R - 16, ang - 0.07)
        return <polygon points={`${tx},${ty} ${lx},${ly} ${rx},${ry}`} fill={C.accent} />
      })()}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={hot ? C.danger : C.ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={hot ? C.danger : C.ink} />
    </svg>
  )
}

// psi over the last 10 s (measured) and the next 9.6 s (NMPC prediction), with the +-limit.
function LookAhead({ hist, pred, lim, guided }) {
  const x0 = 30, x1 = 314, y0 = 5, y1 = 62
  const T0 = -10, T1 = 9.6
  const X = (t) => x0 + ((t - T0) / (T1 - T0)) * (x1 - x0)
  const Y = (p) => y0 + ((90 - clamp(p, -90, 90)) / 180) * (y1 - y0)
  const pts = (arr) => arr.map(([t, p]) => `${X(t).toFixed(1)},${Y(p).toFixed(1)}`).join(' ')
  const now = hist.length ? hist[hist.length - 1][1] : 0
  const predPts = pred ? [[0, now], ...pred.pts] : null
  return (
    <svg className="chart" viewBox="0 0 320 78" role="img"
      aria-label={pred ? `Hitch angle history and NMPC prediction; predicted peak ${fmt(Math.abs(pred.peak.psi), 0)} degrees in ${fmt(pred.peak.at, 1)} seconds` : 'Hitch angle history; no prediction'}>
      <rect x={x0} y={y0} width={x1 - x0} height={Y(lim) - y0} className="ch-lim" />
      <rect x={x0} y={Y(-lim)} width={x1 - x0} height={y1 - Y(-lim)} className="ch-lim" />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="ch-frame" />
      {[lim, -lim].map((p) => <line key={p} x1={x0} x2={x1} y1={Y(p)} y2={Y(p)} className="ch-limline" />)}
      <line x1={x0} x2={x1} y1={Y(0)} y2={Y(0)} className="ch-zero" />
      <line x1={X(0)} x2={X(0)} y1={y0} y2={y1} className="ch-now" />
      {[lim, 0, -lim].map((p) => <text key={p} x={x0 - 4} y={Y(p) + 3} textAnchor="end" className="ch-t">{p > 0 ? `+${fmt(p, 0)}` : p < 0 ? `−${fmt(-p, 0)}` : '0'}</text>)}
      <text x={x0} y={75} className="ch-t">−10 s</text>
      <text x={X(0)} y={75} textAnchor="middle" className="ch-t strong">now</text>
      <text x={x1} y={75} textAnchor="end" className="ch-t">+{fmt(T1, 1)} s</text>
      <text x={x1 - 3} y={Y(lim) - 3} textAnchor="end" className="ch-t lim">limit</text>
      {hist.length > 1 && <polyline points={pts(hist)} fill="none" stroke={guided ? C.ink2 : C.danger} strokeWidth="1.6" strokeLinejoin="round" />}
      {predPts && (
        <>
          <polyline points={pts(predPts)} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" />
          {pred.pts.map(([t, p]) => <circle key={t} cx={X(t)} cy={Y(p)} r="1.6" fill={C.accent} />)}
          <circle cx={X(pred.peak.at)} cy={Y(pred.peak.psi)} r="3.2" fill="#fff" stroke={C.accent} strokeWidth="1.6" />
        </>
      )}
      {!guided && <text x={(X(0) + x1) / 2} y={(y0 + y1) / 2 + 3} textAnchor="middle" className="ch-t">no model, no prediction</text>}
    </svg>
  )
}

export function HitchPanel({ frame, frameText, vehicle, pred, hist, guided }) {
  const lim = vehicle.psi_crit * DEG
  const psiT = frameText[4] * DEG
  const margin = lim - Math.abs(psiT)
  const tone = margin < 8 ? 'danger' : margin < 20 ? 'warn' : ''
  const active = margin < 6
  return (
    <section className="panel" aria-label="Hitch angle">
      <header className="panel-h"><h3>Hitch angle ψ</h3><span className="panel-m">hard limit ±{fmt(lim, 0)}°</span></header>
      <div className="hitch">
        <HitchDial psiDeg={frame[4] * DEG} lim={lim} peak={pred?.peak} />
        <dl className="read">
          <dt className="now">Now</dt><dd className={`big ${tone}`}>{signed(psiT)}°</dd>
          <dt>Margin</dt><dd className={tone}>{fmt(Math.max(0, margin))}°</dd>
          <dt>Limit</dt><dd className={active ? 'danger' : ''}>{active ? 'active' : 'inactive'}</dd>
          <dt><i className="bug" aria-hidden="true" />Peak ahead</dt>
          <dd>{pred ? <>{fmt(Math.abs(pred.peak.psi), 0)}°</> : <span className="muted">none</span>}</dd>
        </dl>
      </div>
      <LookAhead hist={hist} pred={pred} lim={lim} guided={guided} />
      <p className="chart-key">
        <span><i className="ln ln-hist" style={guided ? null : { background: C.danger }} />measured</span>
        {guided && <span><i className="ln ln-pred" />NMPC prediction{pred ? `, peak ${fmt(Math.abs(pred.peak.psi), 0)}° in ${fmt(pred.peak.at, 1)} s` : ''}</span>}
      </p>
    </section>
  )
}

// ---------- driver inputs: steering wheel + speed, live against advised ----------

function WheelGlyph({ turns, advisedTurns }) {
  return (
    <svg className="glyph" viewBox="0 0 56 56" role="img" aria-label="Steering wheel position">
      {advisedTurns != null && (
        <g transform={`translate(28 28) rotate(${-advisedTurns * 360})`}>
          <polygon points="0,-22 -3.6,-27.5 3.6,-27.5" fill={C.accent} />
        </g>
      )}
      <g transform={`translate(28 28) rotate(${-turns * 360})`}>
        <circle r="19" fill="none" stroke={C.ink} strokeWidth="3.2" />
        <circle r="5" fill="none" stroke={C.ink} strokeWidth="2" />
        <path d="M-19 0H-5M19 0H5M0 5V19" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />
        <rect x="-1.4" y="-22" width="2.8" height="6" fill={C.danger} />
      </g>
    </svg>
  )
}

const SPEED_MAX = 8
function SpeedGlyph({ kmh, advisedKmh }) {
  const cx = 28, cy = 36, R = 21
  const a = (k) => sweep(k, 0, SPEED_MAX)
  const [nx, ny] = polar(cx, cy, R - 3, a(kmh))
  return (
    <svg className="glyph" viewBox="0 0 56 56" role="img" aria-label="Speedometer">
      <path d={arc(cx, cy, R, a(0), a(SPEED_MAX))} stroke={C.zoneSafe} strokeWidth="5" fill="none" />
      {[0, 2, 4, 6, 8].map((k) => {
        const [x0, y0] = polar(cx, cy, R + 3, a(k)), [x1, y1] = polar(cx, cy, R + 6, a(k))
        return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.ink3} strokeWidth="1" />
      })}
      {advisedKmh != null && (() => {
        const ang = a(advisedKmh)
        const [tx, ty] = polar(cx, cy, R - 3, ang)
        const [lx, ly] = polar(cx, cy, R + 4, ang + 0.16)
        const [rx, ry] = polar(cx, cy, R + 4, ang - 0.16)
        return <polygon points={`${tx},${ty} ${lx},${ly} ${rx},${ry}`} fill={C.accent} />
      })()}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill={C.ink} />
      <text x={cx} y={cy + 14} textAnchor="middle" className="glyph-t">km/h</text>
    </svg>
  )
}

export function InputsPanel({ frame, frameText, vehicle, advised, unaided }) {
  const turnsT = turnsOf(frameText[6])
  const side = sideOf(turnsT)
  const lock = vehicle.delta_max * DEG
  const roadDeg = Math.abs(frameText[6]) * DEG
  const kmhT = Math.abs(frameText[5]) * 3.6
  const dir = kmhT < 0.15 ? 'stopped' : frameText[5] < 0 ? 'reverse' : 'forward'
  const advSide = advised ? sideOf(advised.turns) : null
  return (
    <section className="panel" aria-label="Driver inputs">
      <header className="panel-h">
        <h3>Driver inputs</h3>
        <span className="panel-m"><i className="bug" aria-hidden="true" />{unaided ? 'no advice when unaided' : advised ? 'advised for this step' : 'stopped: no motion advised'}</span>
      </header>
      <div className="inputs">
        <div className="inp">
          <WheelGlyph turns={turnsOf(frame[6])} advisedTurns={advised?.turns} />
          <div className="inp-a">
            <span className="k">Steering wheel</span>
            <span className="v">{side === 'straight' ? 'straight' : <>{fmt(Math.abs(turnsT), 2)}<small> turns {side}</small></>}</span>
          </div>
          <div className="inp-b">
            {advised ? <span className="adv">{advSide === 'straight' ? 'straight' : `${turnsText(advised.turns)} ${advSide}`}</span> : <span className="adv none">no advice</span>}
            <span className="n">road wheels {fmt(roadDeg, 0)}°, {fmt((roadDeg / lock) * 100, 0)}% of lock</span>
          </div>
        </div>
        <div className="inp">
          <SpeedGlyph kmh={Math.abs(frame[5]) * 3.6} advisedKmh={advised?.kmh} />
          <div className="inp-a">
            <span className="k">Speed</span>
            <span className="v">{fmt(kmhT)}<small> km/h</small></span>
          </div>
          <div className="inp-b">
            {advised ? <span className="adv">{fmt(advised.kmh, 0)} km/h</span> : <span className="adv none">no advice</span>}
            <span className="n">{dir}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
