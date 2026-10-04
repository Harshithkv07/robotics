import { useEffect, useMemo, useRef, useState } from 'react'
import Yard from '../scene/Yard'
import TopBar from './TopBar'
import { loadLot, draftLot, occupiedIds, fmt, bayCorners, trailerAxle } from '../data'
import { layoutShort } from '../derive'
import { I, LayoutIcon } from './icons'

// What each configuration is, in one line, for the cards and the preview caption.
const INFO = {
  cross: { text: 'Bays at right angles to the aisle, like a loading dock. The rig reverses in with a 90° turn.' },
  angled: { text: 'Bays set at 60° to the aisle. A gentler turn-in than cross, on a wider apron.' },
  parallel: { text: 'Long bays along the aisle, like kerbside parking. The hardest manoeuvre for an articulated rig.' },
  tandem: { text: 'Slots end to end in two lanes. The rig drives in forward, which is naturally stable.' },
}

const STEPS = [
  { icon: I.route, title: 'Plan', text: 'Hybrid A* searches hitch-stabilised moves for a collision-free path from the gate to the bay.' },
  { icon: I.horizon, title: 'Predict and steer', text: 'An NMPC looks 9.6 s ahead every 0.25 s and keeps the hitch angle inside a hard limit.' },
  { icon: I.shield, title: 'Certify', text: 'Every run is driven in closed loop first: no jackknife, clear of every obstacle, parked on target.' },
  { icon: I.wheel, title: 'Guide the driver', text: 'Gear, speed, steering-wheel turns and distance for each step, live.' },
]

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// ---------- hero: a real certified run replayed behind the headline ----------

const HERO_SPEED = 7                     // replay speed
const HERO_HOLD = 2.5                    // seconds parked before the replay restarts
const HERO_ANGLE = { el: 0.86, az: -0.5 }

const media = (q) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null

function useMedia(q) {
  const [on, setOn] = useState(() => !!media(q)?.matches)
  useEffect(() => {
    const m = media(q)
    if (!m) return
    const f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [q])
  return on
}

// The first layout's first library fill, its shortest certified run, and bounds around everything that run touches.
function useHeroRun(manifest) {
  const [run, setRun] = useState(null)
  useEffect(() => {
    const entry = manifest?.layouts[0]
    if (!entry) return
    let dead = false
    loadLot(entry.seeds[0].file).then((lot) => {
      const ids = Object.keys(lot.plans).map(Number)
      if (dead || !ids.length) return
      const id = ids.reduce((a, b) => (lot.plans[b].duration < lot.plans[a].duration ? b : a))
      const plan = lot.plans[id], v = lot.vehicle
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      for (const [, x, y, th, psi] of plan.frames) {
        const nose = v.L1 + v.tractor_front
        add(x + nose * Math.cos(th), y + nose * Math.sin(th))
        const tl = trailerAxle(x, y, th, psi, v)
        add(tl.x - v.trailer_rear * Math.cos(tl.th), tl.y - v.trailer_rear * Math.sin(tl.th))
      }
      for (const [x, y] of bayCorners(lot.layout.bays.find((b) => b.id === id))) add(x, y)
      const m = 4
      setRun({ entry, id, plan, lot: draftLot(lot, occupiedIds(lot)), frame: { xmin: x0 - m, xmax: x1 + m, ymin: y0 - m, ymax: y1 + m } })
    }).catch(() => {})
    return () => { dead = true }
  }, [manifest])
  return run
}

// Replay clock in simulation seconds: runs while `running`, holds on the parked rig, fades out and starts again.
function useReplay(plan, running, still) {
  const clock = useRef(0)
  const [t, setT] = useState(0)
  const [fade, setFade] = useState(false)
  useEffect(() => {
    if (!plan) return
    const T = plan.frames[plan.frames.length - 1][0]
    if (still) { setT(T * 0.62); return }
    if (!running) return
    const end = T + HERO_HOLD * HERO_SPEED, fadeAt = end - 0.45 * HERO_SPEED
    let raf, last = performance.now()
    const tick = (now) => {
      clock.current += Math.min(0.1, (now - last) / 1000) * HERO_SPEED
      last = now
      if (clock.current >= end) clock.current = 0
      setFade(clock.current > fadeAt)
      setT(Math.min(clock.current, T))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [plan, running, still])
  return { t, fade }
}

function Hero({ manifest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const wide = useMedia('(min-width: 1101px)')
  const still = useMedia('(prefers-reduced-motion: reduce)')
  const run = useHeroRun(manifest)
  const { t, fade } = useReplay(run?.plan, visible, still)

  return (
    <section className="hero" ref={ref} aria-label="Introduction">
      <div className={`hero-scene ${fade ? 'fade' : ''}`} aria-hidden="true">
        {run && (
          <Yard lot={run.lot} plan={run.plan} selected={run.id} t={t} mode="guide" preview frameloop="demand"
            frame={run.frame} angle={HERO_ANGLE} padLeft={wide ? 0.42 : 0} />
        )}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Robotics project &middot; Model predictive control</p>
          <h1>Reverse a <span className="nw">tractor-trailer</span><br />into any bay,<br />without a jackknife.</h1>
          <p className="hero-lead">
            Reversing an articulated truck is unstable: a small hitch-angle error grows until the trailer folds into the cab.
            This project plans the manoeuvre with Hybrid A*, steers it with a nonlinear model predictive controller that holds
            the hitch angle inside a hard limit, and turns it into instructions a driver can follow.
          </p>
          <div className="hero-cta">
            <button className="btn primary lg" onClick={() => scrollTo('configs')}>Choose a configuration{I.chevR}</button>
            <button className="btn lg ghost" onClick={() => scrollTo('how')}>How it works</button>
          </div>
          <p className="hero-team">Group B9 &middot; <b>Harshith KV</b> &middot; <b>G Venugopalan</b> &middot; <b>Rithvik Arulprakash</b> &middot; <b>Vipin Sudhakar</b></p>
        </div>
      </div>
      {run && <p className="hero-cap">Certified run, replayed at {HERO_SPEED}&times; &middot; {layoutShort(run.entry)}, bay {run.id + 1}</p>}
      <button className="hero-scroll" onClick={() => scrollTo('how')} aria-label="Scroll to how it works">{I.chevD}</button>
    </section>
  )
}

// ---------- configurations ----------

// The yard of one configuration exactly as it will open (library fill 1), neutral: free bays outlined, filled bays with
// parked rigs, your rig at the gate. Still and non-interactive.
function Preview({ entry, onOpen }) {
  const [lot, setLot] = useState(null)
  useEffect(() => {
    let dead = false
    setLot(null)
    loadLot(entry.seeds[0].file).then((d) => { if (!dead) setLot(d) }).catch(() => {})
    return () => { dead = true }
  }, [entry])
  const view = useMemo(() => (lot ? draftLot(lot, occupiedIds(lot)) : null), [lot])
  const filled = lot ? occupiedIds(lot).length : 0
  const approach = lot?.layout.bays[0]?.approach === 'forward' ? 'drive in forward' : 'reverse in'
  return (
    <div className="cfg-preview" aria-label={`Preview of the ${layoutShort(entry)} configuration`}>
      <div className="cfg-stage">
        <span className="cfg-badge">Preview</span>
        {view ? <Yard lot={view} preview /> : <div className="loading">Loading yard&hellip;</div>}
      </div>
      <div className="cfg-cap">
        <div>
          <b>{layoutShort(entry)}</b>
          <span>
            {lot ? <>{lot.layout.bays.length} bays &middot; {fmt(lot.layout.aisle, 0)} m aisle &middot; {approach} &middot; {filled} filled, {lot.layout.bays.length - filled} free</> : ' '}
          </span>
        </div>
        <button className="btn primary" onClick={() => onOpen(entry.name)}>Open {layoutShort(entry)}{I.chevR}</button>
      </div>
    </div>
  )
}

export default function Home({ manifest, live, onChoose }) {
  const layouts = manifest?.layouts || []
  const [active, setActive] = useState(null)
  const [solid, setSolid] = useState(false)
  const cur = layouts.find((l) => l.name === active) || layouts[0]

  return (
    <main className="home" aria-label="Home" onScroll={(e) => setSolid(e.currentTarget.scrollTop > 8)}>
      <TopBar home solid={solid} onNav={scrollTo} live={live} />
      <Hero manifest={manifest} />

      <div className="home-inner">
        <section id="how" aria-label="How it works">
          <div className="sec-h"><div><h2>How it works</h2><p>Four stages run for every free bay before any guidance is offered.</p></div></div>
          <div className="how-row">
            {STEPS.map((s) => (
              <div className="how-card" key={s.title}>
                <span className="how-i">{s.icon}</span>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="configs" aria-label="Parking configurations">
          <div className="sec-h">
            <div>
              <h2>Choose a parking configuration</h2>
              <p>Hover a layout to preview it and click to open it. Next you choose which bays are free and which are filled, then where to park.</p>
            </div>
          </div>
          <div className="cfg-grid">
            <div className="cfg-list">
              {layouts.map((l) => (
                <button key={l.name} className={`cfg ${cur?.name === l.name ? 'hl' : ''}`}
                  onMouseEnter={() => setActive(l.name)} onFocus={() => setActive(l.name)} onClick={() => onChoose(l.name)}>
                  <span className="cfg-ic"><LayoutIcon name={l.name} /></span>
                  <span className="cfg-t">
                    <b>{layoutShort(l)}</b>
                    <span>{INFO[l.name]?.text}</span>
                  </span>
                  <span className="cfg-go" aria-hidden="true">{I.chevR}</span>
                </button>
              ))}
            </div>
            {cur && <Preview entry={cur} onOpen={onChoose} />}
          </div>
        </section>

        <footer className="home-foot">
          <span>Model Predictive Control for Automated Reverse Docking of an Articulated Tractor-Trailer</span>
          <span>Version 2 &middot; live solving</span>
        </footer>
      </div>
    </main>
  )
}
