import { useMemo } from 'react'
import { Edges } from '@react-three/drei'
import { trailerAxle } from '../data'
import { PLAN } from '../theme'

// World (x east, y north) -> three (x, up, -y). A rotation.y of `th` maps local +x to world heading th.
const P = (x, y, h = 0) => [x, h, -y]

// Flat-shaded box with a drawn outline: reads like a CAD plan from above and still shows depth when tilted.
// polygonOffset pushes the faces back so the outline is never z-fought.
function Block({ position, size, color, edge = PLAN.outline, width = 1.2 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      <Edges color={edge} lineWidth={width} />
    </mesh>
  )
}

function Wheel({ x, z, r = 0.55, w = 0.4 }) {
  return (
    <mesh position={[x, r, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, w, 16]} />
      <meshLambertMaterial color={PLAN.tyre} />
    </mesh>
  )
}

export function Tractor({ veh, color = PLAN.rig, cab = PLAN.rigCab }) {
  const len = veh.tractor_rear + veh.L1 + veh.tractor_front
  const cx = (-veh.tractor_rear + veh.L1 + veh.tractor_front) / 2
  return (
    <group>
      <Block position={[cx, 1.05, 0]} size={[len, 1.5, veh.width]} color={color} />
      <Block position={[cx + len / 2 - 1.5, 2.35, 0]} size={[2.6, 1.6, veh.width - 0.15]} color={cab} />
      <mesh position={[cx + len / 2 - 0.22, 2.55, 0]}>
        <boxGeometry args={[0.06, 0.9, veh.width - 0.5]} />
        <meshLambertMaterial color={PLAN.glass} />
      </mesh>
      {/* fifth wheel */}
      <mesh position={[veh.d, 1.85, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.12, 20]} />
        <meshLambertMaterial color={PLAN.outline} />
      </mesh>
      {[0, veh.L1].map((ax) => (
        <group key={ax}>
          <Wheel x={ax} z={veh.width / 2 - 0.1} />
          <Wheel x={ax} z={-(veh.width / 2 - 0.1)} />
        </group>
      ))}
    </group>
  )
}

export function Trailer({ veh, color = PLAN.trailer }) {
  const len = veh.L2 + veh.trailer_front + veh.trailer_rear
  const cx = (-veh.trailer_rear + veh.L2 + veh.trailer_front) / 2
  return (
    <group>
      <Block position={[cx, 2.25, 0]} size={[len, 3.1, veh.width]} color={color} width={1.4} />
      {/* rear marker board */}
      <mesh position={[-veh.trailer_rear - 0.02, 1.2, 0]}>
        <boxGeometry args={[0.06, 0.35, veh.width - 0.2]} />
        <meshBasicMaterial color={PLAN.alarm} />
      </mesh>
      {[-1.3, 0, 1.3].map((o) => (
        <group key={o}>
          <Wheel x={o} z={veh.width / 2 - 0.1} />
          <Wheel x={o} z={-(veh.width / 2 - 0.1)} />
        </group>
      ))}
    </group>
  )
}

// A live rig: tractor rear axle at (x, y) heading th, hitch angle psi.
// `unaided` paints the tractor red (guidance off); `alarm` tints the whole rig when psi nears the limit.
export default function Rig({ state, veh, unaided = false, alarm = false }) {
  const [x, y, th, psi] = state
  const tl = useMemo(() => trailerAxle(x, y, th, psi, veh), [x, y, th, psi, veh])
  const red = unaided || alarm
  return (
    <group>
      <group position={P(x, y)} rotation={[0, th, 0]}>
        <Tractor veh={veh} color={red ? PLAN.alarm : PLAN.rig} cab={red ? '#b02525' : PLAN.rigCab} />
      </group>
      <group position={P(tl.x, tl.y)} rotation={[0, tl.th, 0]}>
        <Trailer veh={veh} color={alarm ? PLAN.alarmTrailer : PLAN.trailer} />
      </group>
    </group>
  )
}

// A parked rig described by a single rectangle (centre, heading = tractor facing, length, width).
export function ParkedRig({ p, veh }) {
  const tLen = veh.tractor_rear + veh.L1 + veh.tractor_front
  const tOff = p.l / 2 - tLen / 2
  const lLen = p.l - tLen
  return (
    <group position={P(p.cx, p.cy)} rotation={[0, p.theta, 0]}>
      <Block position={[tOff, 1.0, 0]} size={[tLen, 1.4, p.w]} color={PLAN.parked} edge={PLAN.parkedEdge} width={1} />
      <Block position={[tOff + tLen / 2 - 1.5, 2.2, 0]} size={[2.6, 1.5, p.w - 0.15]} color={PLAN.parkedCab} edge={PLAN.parkedEdge} width={1} />
      <Block position={[-p.l / 2 + lLen / 2, 2.0, 0]} size={[lLen - 0.2, 2.9, p.w]} color={PLAN.parkedBox} edge={PLAN.parkedEdge} width={1} />
    </group>
  )
}
