import { clamp, fmt, stepIndexAt, turnsOf, turnsText, sideOf } from '../data'
import { I } from './icons'

// Compact meter: title + live value, a track with the advised zone (amber) and the live dot, then end labels.
function Meter({ label, min, max, flip, advised, tol, live, liveText, advisedText, ends }) {
  const pct = (v) => `${(((flip ? max - clamp(v, min, max) : clamp(v, min, max) - min) / (max - min)) * 100).toFixed(2)}%`
  const zoneStart = advised == null ? 0 : flip ? max - (advised + tol) : advised - tol - min
  return (
    <div className="meter">
      <div className="meter-h"><span className="meter-l">{label}</span><b>{liveText}</b></div>
      <div className="track">
        {advised != null && (
          <>
            <i className="zone" style={{ left: `${(Math.max(0, zoneStart / (max - min)) * 100).toFixed(2)}%`, width: `${(((2 * tol) / (max - min)) * 100).toFixed(2)}%` }} />
            <i className="adv" style={{ left: pct(advised) }} />
          </>
        )}
        <i className="dot" style={{ left: pct(live) }} />
      </div>
      <div className="meter-f"><span>{ends[0]}</span>{advisedText ? <em>advised {advisedText}</em> : <span />}<span>{ends[1]}</span></div>
    </div>
  )
}

export function GuidanceBar({ steps, t, frame, frameText, duration, onBack }) {
  const idx = stepIndexAt(steps, t)
  const cur = steps[idx]
  const next = steps[idx + 1]
  const done = t >= duration - 0.2
  const gear = cur.kind === 'stop' ? 'N' : cur.gear > 0 ? 'D' : 'R'
  const prog = clamp((t - cur.t0) / Math.max(cur.t1 - cur.t0, 0.001), 0, 1)
  const drive = cur.kind === 'drive' && !done
  const liveTurnsT = turnsOf(frameText[6])
  const sideT = sideOf(liveTurnsT)
  return (
    <section className="gbar" aria-live="polite">
      <div className="gb-main">
        <div className="gb-top">
          <button className="btn ghost back" onClick={onBack}>{I.back} Bays</button>
          <h3>Step {idx + 1} of {steps.length}</h3>
          <span className="muted tiny mono">{fmt(cur.t0, 0)}&ndash;{fmt(cur.t1, 0)} s</span>
          <div className={`gear ${gear}`} title={gear === 'R' ? 'Reverse' : gear === 'D' ? 'Drive' : 'Neutral, stopped'}>{gear}</div>
        </div>
        <div className="label">{done ? 'Parked. Guidance complete.' : cur.label}</div>
      </div>

      {drive ? (
        <>
          <Meter
            label="Steer" min={-1.75} max={1.75} flip tol={0.25}
            advised={cur.turns} live={turnsOf(frame[6])}
            liveText={sideT === 'straight' ? 'straight' : `${fmt(Math.abs(liveTurnsT), 2)} turns ${sideT}`}
            advisedText={cur.side === 'straight' ? 'straight' : `${turnsText(cur.turns)} ${cur.side}`}
            ends={['LEFT', 'RIGHT']}
          />
          <Meter
            label="Speed" min={0} max={8} tol={0.6}
            advised={cur.speed_kmh} live={Math.abs(frame[5]) * 3.6}
            liveText={`${fmt(Math.abs(frameText[5]) * 3.6)} km/h`} advisedText={`${fmt(cur.speed_kmh, 0)} km/h`}
            ends={['0', '8']}
          />
          <div className="meter">
            <div className="meter-h"><span className="meter-l">Hold</span><b>{fmt(cur.dist * (1 - prog), 0)} m more</b></div>
            <div className="track"><i className="fill" style={{ width: `${(prog * 100).toFixed(1)}%` }} /></div>
            <div className="meter-f"><span>start</span><em className="plain">hitch peak {fmt(cur.peak_psi, 0)}&deg;</em><span>{fmt(cur.dist, 0)} m</span></div>
          </div>
        </>
      ) : (
        <div className="gb-stop">
          {done ? 'You are in the bay. Set the parking brake.' : `Come to a full stop${cur.engage ? `, then select ${cur.engage < 0 ? 'Reverse' : 'Drive'}` : ''}.`}
        </div>
      )}

      <div className="gb-next">
        {next && !done ? (
          <>
            <span>Next</span>
            <b>{next.label}</b>
            {next.kind === 'drive' && <span className="mono">{next.side === 'straight' ? 'straight' : `${turnsText(next.turns)} ${next.side}`} &middot; {fmt(next.dist, 0)} m &middot; {fmt(next.speed_kmh, 0)} km/h</span>}
          </>
        ) : <span>&nbsp;</span>}
      </div>
    </section>
  )
}

export function UnaidedBar({ plan, onBack }) {
  const b = plan.baseline
  return (
    <section className="gbar unaided" aria-live="polite">
      <div className="gb-main">
        <div className="gb-top">
          <button className="btn ghost back" onClick={onBack}>{I.back} Bays</button>
          <h3>Guidance off: unaided driver</h3>
        </div>
        <div className="label">{b.jackknife ? 'The rig jackknifes' : 'Parks without help'}</div>
      </div>
      <div className="gb-stop wide">
        Tractor-only path follower: no hitch model, no look-ahead, no hitch-angle limit.
        {b.jackknife
          ? <> The hitch angle runs away and the rig folds after <b>{fmt(b.t_jack, 0)} s</b> (peak {fmt(b.max_psi_deg, 0)}&deg;). See the Run summary tab for the side-by-side numbers.</>
          : <> Forward driving is self-stabilising, so it parks without help.</>}
      </div>
    </section>
  )
}
