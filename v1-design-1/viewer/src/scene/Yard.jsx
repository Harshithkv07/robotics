import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import Rig, { ParkedRig } from './Rig'
import { bayCorners, sampleFrames, trailerAxle, frameIndexAt, horizonAt } from '../data'

const P = (x, y, h = 0) => [x, h, -y]

// Frame the lot in an orthographic camera. `elev` 90 = top-down, lower = tilted.
function Camera({ bounds, focus, elev }) {
  const { size, camera } = useThree()
  const ref = useRef()
  useEffect(() => {
    const cam = ref.current || camera
    const b = bounds
    const w = b.xmax - b.xmin, h = b.ymax - b.ymin
    const cx = (b.xmin + b.xmax) / 2, cy = (b.ymin + b.ymax) / 2
    const zoom = Math.min((size.width * 0.92) / w, (size.height * 0.74) / (h * (elev >= 89 ? 1 : Math.sin((elev * Math.PI) / 180) + 0.35)))
    // following the rig: keep ~36 m (vertical) by ~58 m (horizontal) in view; otherwise frame the whole lot
    cam.zoom = focus ? Math.min(size.width / 58, size.height / 36) : zoom
    const e = (elev * Math.PI) / 180
    const dist = 400
    const fx = focus ? focus[0] : cx, fy = focus ? focus[1] : cy
    cam.position.set(fx, dist * Math.sin(e), -fy + dist * Math.cos(e))
    cam.up.set(0, elev >= 89 ? 0 : 1, elev >= 89 ? -1 : 0)
    cam.lookAt(fx, 0, -fy)
    cam.updateProjectionMatrix()
  }, [bounds, size, camera, elev, focus])
  return <OrthographicCamera ref={ref} makeDefault near={-1000} far={2000} />
}

function Ground({ bounds }) {
  const w = bounds.xmax - bounds.xmin, h = bounds.ymax - bounds.ymin
  const cx = (bounds.xmin + bounds.xmax) / 2, cy = (bounds.ymin + bounds.ymax) / 2
  const size = Math.ceil(Math.max(w, h) / 10) * 10
  return (
    <group>
      <mesh position={P(cx, cy, -0.02)} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#141f2b" roughness={1} />
      </mesh>
      <gridHelper args={[size * 2, size * 2 / 5, '#20313f', '#182633']} position={[cx, -0.01, -cy]} />
      <lineSegments position={P(cx, cy, 0.01)} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(w, h)]} />
        <lineBasicMaterial color="#3a5065" />
      </lineSegments>
    </group>
  )
}

function Bay({ bay, selected, hovered, onHover, onPick, live }) {
  const corners = useMemo(() => bayCorners(bay).map(([x, y]) => P(x, y, 0.05)), [bay])
  const ok = bay.status === 'ok'
  const bad = bay.status === 'infeasible'
  const color = selected ? '#38d0e8' : ok ? (hovered ? '#7cf0c1' : '#3ddc97') : bad ? '#4a5b6c' : '#33465a'
  return (
    <group>
      {ok && (
        <group position={P(bay.cx, bay.cy, 0.03)} rotation={[0, bay.theta, 0]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); if (live) onHover(bay.id) }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); if (live) onPick(bay.id) }}
          >
            <planeGeometry args={[bay.l, bay.w]} />
            <meshBasicMaterial color={selected ? '#38d0e8' : '#3ddc97'} transparent opacity={selected ? 0.32 : hovered ? 0.28 : 0.12} />
          </mesh>
        </group>
      )}
      {bad && (
        <group position={P(bay.cx, bay.cy, 0.03)} rotation={[0, bay.theta, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerOver={(e) => { e.stopPropagation(); onHover(bay.id) }} onPointerOut={() => onHover(null)}>
            <planeGeometry args={[bay.l, bay.w]} />
            <meshBasicMaterial color="#5b6d7f" transparent opacity={0.13} />
          </mesh>
        </group>
      )}
      <Line points={corners} color={color} lineWidth={selected || hovered ? 3 : ok ? 2 : 1.2} dashed={bad} dashSize={1.2} gapSize={0.8} />
      <Html position={P(bay.cx + Math.cos(bay.theta) * (bay.l / 2 - 1.6), bay.cy + Math.sin(bay.theta) * (bay.l / 2 - 1.6), 0.1)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`bay-label ${ok ? 'ok' : 'no'}`}>{bay.id + 1}</div>
      </Html>
    </group>
  )
}

// Trail and horizon are keyed on the frame index (5 Hz), not on the 60 Hz clock, so their geometry is rebuilt
// only when a new sample is reached.
function Overlays({ plan, frames, veh, t, guided, showPath }) {
  const idx = frameIndexAt(frames, t)
  const pathPts = useMemo(() => plan.path.map(([x, y]) => P(x, y, 0.07)), [plan])
  const trail = useMemo(() => frames.slice(0, idx + 1).map((f) => P(f[1], f[2], 0.09)), [frames, idx])
  const hor = guided ? horizonAt(plan.hor, frames[idx][0]) : null
  const horTr = useMemo(() => (hor ? hor[1].map(([x, y]) => P(x, y, 0.11)) : []), [hor])
  const horTl = useMemo(() => (hor ? hor[1].map(([x, y, th, psi]) => { const a = trailerAxle(x, y, th, psi, veh); return P(a.x, a.y, 0.1) }) : []), [hor, veh])
  return (
    <group>
      {showPath && pathPts.length > 1 && <Line points={pathPts} color="#8ea2ff" lineWidth={1.5} dashed dashSize={1.4} gapSize={1} transparent opacity={0.5} />}
      {trail.length > 1 && <Line points={trail} color={guided ? '#ffffff' : '#ff8a96'} lineWidth={1.6} transparent opacity={0.6} />}
      {horTl.length > 1 && <Line points={horTl} color="#8ea2ff" lineWidth={3} transparent opacity={0.85} />}
      {horTr.length > 1 && <Line points={horTr} color="#38d0e8" lineWidth={4} transparent opacity={0.95} />}
    </group>
  )
}

export default function Yard({ lot, plan, baseline, selected, hovered, onHover, onPick, t, mode, view, showPath, focusRig }) {
  const { layout, vehicle } = lot
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
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }} onPointerMissed={() => onHover(null)}>
      <color attach="background" args={['#0a1017']} />
      <Camera bounds={layout.bounds} focus={focus} elev={elev} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[60, 120, 40]} intensity={1.1} />
      <Ground bounds={layout.bounds} />
      {layout.bays.map((b) => (
        <group key={b.id}>
          <Bay bay={b} selected={selected === b.id} hovered={hovered === b.id} onHover={onHover} onPick={onPick} live={mode === 'select'} />
          {b.parked && <ParkedRig p={b.parked} veh={vehicle} />}
        </group>
      ))}
      {goal && (
        <Line points={bayCorners(goal).map(([x, y]) => P(x, y, 0.06))} color="#38d0e8" lineWidth={3} />
      )}
      {frames && <Overlays plan={plan} frames={frames} veh={vehicle} t={t} guided={!baseline} showPath={showPath} />}
      <Rig state={state} veh={vehicle} ghost={baseline} alarm={alarm} />
      {/* gate marker */}
      <Line points={[P(layout.start[0] - 6, -layout.aisle / 2 + 2, 0.05), P(layout.start[0] - 6, layout.aisle / 2 - 2, 0.05)]} color="#ffb547" lineWidth={2} dashed dashSize={1.5} gapSize={1.2} />
    </Canvas>
  )
}
