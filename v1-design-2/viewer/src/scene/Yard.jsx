import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import Rig, { ParkedRig } from './Rig'
import { bayCorners, sampleFrames, trailerAxle, frameIndexAt, horizonAt } from '../data'
import { scaleLength } from '../derive'
import { C, PLAN } from '../theme'

const P = (x, y, h = 0) => [x, h, -y]

// Frame the lot in an orthographic camera. `elev` 90 = top-down, lower = tilted. Reports pixels per metre so the
// plan can carry a true scale bar (exact along screen-x in both views).
function Camera({ bounds, focus, elev, onScale }) {
  const { size, camera } = useThree()
  const ref = useRef()
  const last = useRef(0)
  useEffect(() => {
    const cam = ref.current || camera
    const b = bounds
    const w = b.xmax - b.xmin, h = b.ymax - b.ymin
    const cx = (b.xmin + b.xmax) / 2, cy = (b.ymin + b.ymax) / 2
    const zoom = Math.min((size.width * 0.9) / w, (size.height * 0.86) / (h * (elev >= 89 ? 1 : Math.sin((elev * Math.PI) / 180) + 0.35)))
    // following the rig: keep ~36 m (vertical) by ~58 m (horizontal) in view; otherwise frame the whole lot
    cam.zoom = focus ? Math.min(size.width / 58, size.height / 36) : zoom
    const e = (elev * Math.PI) / 180
    const dist = 400
    const fx = focus ? focus[0] : cx, fy = focus ? focus[1] : cy
    cam.position.set(fx, dist * Math.sin(e), -fy + dist * Math.cos(e))
    cam.up.set(0, elev >= 89 ? 0 : 1, elev >= 89 ? -1 : 0)
    cam.lookAt(fx, 0, -fy)
    cam.updateProjectionMatrix()
    if (onScale && Math.abs(cam.zoom - last.current) > 1e-6) {
      last.current = cam.zoom
      onScale(cam.zoom)
    }
  }, [bounds, size, camera, elev, focus, onScale])
  return <OrthographicCamera ref={ref} makeDefault near={-1000} far={2000} />
}

// Lot surface with a 5 m survey grid drawn only inside the lot boundary.
function Ground({ bounds }) {
  const w = bounds.xmax - bounds.xmin, h = bounds.ymax - bounds.ymin
  const cx = (bounds.xmin + bounds.xmax) / 2, cy = (bounds.ymin + bounds.ymax) / 2
  const grid = useMemo(() => {
    const pts = []
    for (let x = Math.ceil(bounds.xmin / 5) * 5; x <= bounds.xmax; x += 5) pts.push(x, 0.005, -bounds.ymin, x, 0.005, -bounds.ymax)
    for (let y = Math.ceil(bounds.ymin / 5) * 5; y <= bounds.ymax; y += 5) pts.push(bounds.xmin, 0.005, -y, bounds.xmax, 0.005, -y)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [bounds])
  const edge = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), [w, h])
  return (
    <group>
      <mesh position={P(cx, cy, -0.02)} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={PLAN.lot} />
      </mesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={PLAN.grid} />
      </lineSegments>
      <lineSegments position={P(cx, cy, 0.01)} rotation={[-Math.PI / 2, 0, 0]} geometry={edge}>
        <lineBasicMaterial color={PLAN.edge} />
      </lineSegments>
    </group>
  )
}

const pointer = (on) => { document.body.style.cursor = on ? 'pointer' : '' }

function Bay({ bay, selected, hovered, onHover, onPick, live }) {
  const corners = useMemo(() => bayCorners(bay).map(([x, y]) => P(x, y, 0.05)), [bay])
  const ok = bay.status === 'ok'
  const bad = bay.status === 'infeasible'
  const line = selected ? C.accent : ok ? C.ok : bad ? PLAN.bayMuted : PLAN.bayLine
  const fill = selected ? C.accent : ok ? C.ok : '#8f939a'
  const alpha = selected ? 0.14 : ok ? (hovered && live ? 0.24 : 0.1) : bad ? (hovered ? 0.12 : 0.06) : 0
  return (
    <group>
      {(ok || bad) && (
        <group position={P(bay.cx, bay.cy, 0.03)} rotation={[0, bay.theta, 0]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); if (live) { onHover(bay.id); pointer(ok) } }}
            onPointerOut={() => { onHover(null); pointer(false) }}
            onClick={(e) => { e.stopPropagation(); if (live && ok) { pointer(false); onPick(bay.id) } }}
          >
            <planeGeometry args={[bay.l, bay.w]} />
            <meshBasicMaterial color={fill} transparent opacity={alpha} depthWrite={false} />
          </mesh>
        </group>
      )}
      <Line points={corners} color={line} lineWidth={selected ? 2.6 : ok ? (hovered && live ? 2.6 : 1.8) : 1.1} dashed={bad} dashSize={1} gapSize={0.7} />
      <Html position={P(bay.cx + Math.cos(bay.theta) * (bay.l / 2 - 1.6), bay.cy + Math.sin(bay.theta) * (bay.l / 2 - 1.6), 0.1)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`bay-tag ${selected ? 'sel' : ok ? 'ok' : bad ? 'nc' : 'occ'}`}>{bay.id + 1}</div>
      </Html>
    </group>
  )
}

// Trail and horizon are keyed on the frame index (4 Hz samples), not on the 60 Hz clock, so their geometry is
// rebuilt only when a new sample is reached.
function Overlays({ plan, frames, veh, t, guided }) {
  const idx = frameIndexAt(frames, t)
  const pathPts = useMemo(() => plan.path.map(([x, y]) => P(x, y, 0.07)), [plan])
  const trail = useMemo(() => frames.slice(0, idx + 1).map((f) => P(f[1], f[2], 0.09)), [frames, idx])
  const hor = guided ? horizonAt(plan.hor, frames[idx][0]) : null
  const horTr = useMemo(() => (hor ? hor[1].map(([x, y]) => P(x, y, 0.11)) : []), [hor])
  const horTl = useMemo(() => (hor ? hor[1].map(([x, y, th, psi]) => { const a = trailerAxle(x, y, th, psi, veh); return P(a.x, a.y, 0.1) }) : []), [hor, veh])
  return (
    <group>
      {pathPts.length > 1 && <Line points={pathPts} color={PLAN.path} lineWidth={1.4} dashed dashSize={1.2} gapSize={0.9} transparent opacity={0.7} />}
      {trail.length > 1 && <Line points={trail} color={guided ? PLAN.trail : PLAN.trailUnaided} lineWidth={2} transparent opacity={0.85} />}
      {horTl.length > 1 && <Line points={horTl} color={C.accentSoft} lineWidth={3} />}
      {horTr.length > 1 && <Line points={horTr} color={C.accent} lineWidth={3.5} />}
    </group>
  )
}

function ScaleBar({ pxPerM, top }) {
  const m = scaleLength(pxPerM)
  const px = m * pxPerM
  return (
    <div className="scalebar" aria-label={`Scale bar: ${m} metres`}>
      {top && (
        <svg className="axes" viewBox="0 0 34 34" aria-hidden="true">
          <path d="M6 28V6M6 28h22" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 9l3-4 3 4M25 25l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <text x="11" y="9" fontSize="8">y</text><text x="24" y="22" fontSize="8">x</text>
        </svg>
      )}
      <div>
        <div className="sb-bar" style={{ width: px }}><i /><i /></div>
        <div className="sb-lbl" style={{ width: px }}><span>0</span><span>{m} m</span></div>
      </div>
    </div>
  )
}

export default function Yard({ lot, plan, baseline, selected, hovered, onHover, onPick, t, mode, view, focusRig }) {
  const { layout, vehicle } = lot
  const [pxPerM, setPxPerM] = useState(null)
  const frames = mode === 'guide' && plan ? (baseline ? plan.baseline.frames : plan.frames) : null
  const state = useMemo(() => {
    const f = frames ? sampleFrames(frames, t) : null
    const s = layout.start
    return f ? [f[1], f[2], f[3], f[4]] : [s[0], s[1], s[2], s[3]]
  }, [layout, frames, t])
  const alarm = Math.abs(state[3]) > vehicle.psi_crit * 0.92
  const goal = useMemo(() => (selected != null ? layout.bays[selected] : null), [selected, layout])
  const focus = focusRig && mode === 'guide' ? [state[0], state[1]] : null
  const elev = view === 'tilt' ? 52 : 90
  const gx = layout.start[0] - 6
  useEffect(() => () => pointer(false), [])
  return (
    <>
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true }} onPointerMissed={() => onHover(null)}>
        <color attach="background" args={[PLAN.bg]} />
        <Camera bounds={layout.bounds} focus={focus} elev={elev} onScale={setPxPerM} />
        <ambientLight intensity={2.2} />
        <directionalLight position={[40, 120, 60]} intensity={1.1} />
        <Ground bounds={layout.bounds} />
        {layout.bays.map((b) => (
          <group key={b.id}>
            <Bay bay={b} selected={selected === b.id} hovered={hovered === b.id} onHover={onHover} onPick={onPick} live={mode === 'select'} />
            {b.parked && <ParkedRig p={b.parked} veh={vehicle} />}
          </group>
        ))}
        {goal && <Line points={bayCorners(goal).map(([x, y]) => P(x, y, 0.06))} color={C.accent} lineWidth={2.6} />}
        {frames && <Overlays plan={plan} frames={frames} veh={vehicle} t={t} guided={!baseline} />}
        <Rig state={state} veh={vehicle} unaided={baseline && mode === 'guide'} alarm={alarm} />
        {/* gate: where every run starts */}
        <Line points={[P(gx, -layout.aisle / 2 + 2, 0.05), P(gx, layout.aisle / 2 - 2, 0.05)]} color={PLAN.gate} lineWidth={1.6} dashed dashSize={1.4} gapSize={1} />
        <Html position={P(gx, layout.aisle / 2 - 1, 0.1)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="gate-tag">Gate</div>
        </Html>
      </Canvas>
      {pxPerM && <ScaleBar pxPerM={pxPerM} top={elev >= 89} />}
    </>
  )
}
