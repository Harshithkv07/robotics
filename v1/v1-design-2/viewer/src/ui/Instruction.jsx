import { clamp, fmt, stepIndexAt } from '../data'
import { gearOf, GEAR_NAME, steerText } from '../derive'

function ModeSwitch({ baseline, setBaseline }) {
  return (
    <div className="seg mode" role="group" aria-label="Guidance">
      <button aria-pressed={!baseline} onClick={() => setBaseline(false)} title="Follow the NMPC guidance">Guided</button>
      <button aria-pressed={baseline} className="off" onClick={() => setBaseline(true)} title="Same bay, driven by an unaided driver with no hitch model">Unaided</button>
    </div>
  )
}

function Field({ k, v, note, bar }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v tnum">{v}</span>
      {bar != null ? <span className="fbar"><i style={{ transform: `scaleX(${bar})` }} /></span> : note && <span className="n">{note}</span>}
    </div>
  )
}

const Gear = ({ g }) => (
  <div className={`gearbox g-${g}`} title={GEAR_NAME[g]}>
    <b>{g}</b><small>{GEAR_NAME[g]}</small>
  </div>
)

export function SelectBand({ okCount, free }) {
  return (
    <section className="band select" aria-label="Instructions">
      <div className="band-body">
        <h2>Select a bay</h2>
        <p className="band-note">
          {okCount} of {free} free bays have certified guidance. Choose one outlined in green, on the plan or in the bay list.
        </p>
      </div>
      <ul className="key" aria-label="Plan legend">
        <li><i className="sw sw-ok" />Certified guidance</li>
        <li><i className="sw sw-nc" />Not certified</li>
        <li><i className="sw sw-occ" />Occupied</li>
        <li><i className="sw sw-gate" />Gate (start)</li>
      </ul>
    </section>
  )
}

export function GuidanceBand({ steps, t, duration, plan, baseline, setBaseline, onReport }) {
  const idx = stepIndexAt(steps, t)
  const cur = steps[idx]
  const next = steps[idx + 1]
  const done = t >= duration - 0.2
  const g = done ? 'P' : gearOf(cur)
  const prog = clamp((t - cur.t0) / Math.max(cur.t1 - cur.t0, 0.001), 0, 1)
  const drive = cur.kind === 'drive' && !done
  const f = plan.metrics.final
  return (
    <section className="band guide" aria-live="polite" aria-label="Current instruction">
      <Gear g={g} />
      <div className="band-body">
        <div className="band-meta">
          <span>Step <b className="tnum">{idx + 1}</b> of {steps.length}</span>
          <span className="tnum">{fmt(cur.t0, 0)}–{fmt(cur.t1, 0)} s</span>
          <ModeSwitch baseline={baseline} setBaseline={setBaseline} />
        </div>
        <h2>{done ? 'Parked. Guidance complete.' : cur.label}</h2>
        <div className="band-row">
          {drive ? (
            <div className="fields">
              <Field k="Steering" v={steerText(cur)} />
              <Field k="Speed" v={`${fmt(cur.speed_kmh, 0)} km/h`} />
              <Field k="Distance to go" v={`${fmt(cur.dist * (1 - prog), 0)} of ${fmt(cur.dist, 0)} m`} bar={prog} />
              <Field k="Hitch peak" v={`${fmt(cur.peak_psi, 0)}°`} note={`${fmt(cur.margin_deg, 0)}° below limit`} />
            </div>
          ) : done ? (
            <p className="band-note">
              Set the parking brake. Final pose: <b className="tnum">{fmt(Math.abs(f.lat), 2)} m</b> off-centre, <b className="tnum">{fmt(Math.abs(f.hdg), 1)}°</b> heading, <b className="tnum">{fmt(Math.abs(f.psi), 1)}°</b> hitch.{' '}
              <button className="link" onClick={onReport}>Open run report</button>
            </p>
          ) : (
            <p className="band-note">Come to a full stop{cur.engage ? <>, then select <b>{cur.engage < 0 ? 'Reverse' : 'Drive'}</b></> : ''}.</p>
          )}
          {next && !done && (
            <div className="next" title={next.label}>
              <span className="k">Next</span>
              <span className="v">{next.label}</span>
              {next.kind === 'drive' && <span className="n tnum">{steerText(next)} &middot; {fmt(next.dist, 0)} m &middot; {fmt(next.speed_kmh, 0)} km/h</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function UnaidedBand({ plan, t, frame, baseline, setBaseline, onReport }) {
  const b = plan.baseline
  const over = b.jackknife && t >= b.duration - 0.3
  const g = over ? '!' : Math.abs(frame[5]) < 0.04 ? 'N' : frame[5] < 0 ? 'R' : 'D'
  return (
    <section className="band guide unaided" aria-live="polite" aria-label="Unaided driver">
      {g === '!' ? <div className="gearbox g-X" title="Jackknifed"><b>!</b><small>Jackknife</small></div> : <Gear g={g} />}
      <div className="band-body">
        <div className="band-meta">
          <span>Guidance off</span>
          <span className="tnum">{fmt(b.duration, 0)} s run</span>
          <ModeSwitch baseline={baseline} setBaseline={setBaseline} />
        </div>
        <h2>{b.jackknife ? 'Unaided driver: the rig jackknifes' : 'Unaided driver: parks without help'}</h2>
        <div className="band-row">
          <p className="band-note">
            A tractor-only path follower: no hitch model, no look-ahead, no hitch-angle limit.{' '}
            {b.jackknife
              ? <>The hitch angle runs away and the rig folds after <b className="tnum">{fmt(b.t_jack, 0)} s</b> (peak <b className="tnum">{fmt(b.max_psi_deg, 0)}°</b>).</>
              : <>Driving forward is self-stabilising, so it parks here too.</>}{' '}
            <button className="link" onClick={onReport}>Compare in run report</button>
          </p>
        </div>
      </div>
    </section>
  )
}
