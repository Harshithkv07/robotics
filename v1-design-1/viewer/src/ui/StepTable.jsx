import { useEffect, useRef } from 'react'
import { fmt, stepIndexAt, turnsText } from '../data'

export default function StepTable({ steps, t, onSeek }) {
  const box = useRef(null)
  const rows = useRef([])
  const cur = stepIndexAt(steps, t)

  useEffect(() => {
    const el = rows.current[cur], b = box.current
    if (!el || !b) return
    const head = 30
    if (el.offsetTop - head < b.scrollTop) b.scrollTop = el.offsetTop - head
    else if (el.offsetTop + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = el.offsetTop + el.offsetHeight - b.clientHeight
  }, [cur])

  return (
    <div className="tblwrap" ref={box}>
      <table className="tbl">
        <thead>
          <tr><th>#</th><th>Action</th><th>Gear</th><th>Speed</th><th>Steering</th><th>Distance</th><th>Time</th><th>Hitch peak</th><th>Margin</th></tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            const drive = s.kind === 'drive'
            const mtone = !drive ? '' : s.margin_deg < 8 ? 'danger' : s.margin_deg < 20 ? 'warn' : 'ok'
            return (
              <tr key={s.id} ref={(el) => { rows.current[i] = el }} className={i === cur ? 'cur' : s.t1 < t ? 'done' : ''} onClick={() => onSeek(s.t0)}>
                <td className="mono">{i + 1}</td>
                <td>{s.label}</td>
                <td><span className={`gtag ${drive ? (s.gear > 0 ? 'D' : 'R') : 'N'}`}>{drive ? (s.gear > 0 ? 'D' : 'R') : 'N'}</span></td>
                <td className="mono">{drive ? `${fmt(s.speed_kmh, 0)} km/h` : '—'}</td>
                <td className="mono">{drive ? (s.side === 'straight' ? 'straight' : `${turnsText(s.turns)} ${s.side}`) : '—'}</td>
                <td className="mono">{drive ? `${fmt(s.dist, 0)} m` : '—'}</td>
                <td className="mono">{fmt(Math.max(0, s.t1 - s.t0), 0)} s</td>
                <td className="mono">{drive ? `${fmt(s.peak_psi, 0)}°` : '—'}</td>
                <td>{drive ? <span className={`pill ${mtone}`}>{fmt(s.margin_deg, 0)}&deg;</span> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
