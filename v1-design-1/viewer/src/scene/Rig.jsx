import { useMemo } from 'react'
import { trailerAxle } from '../data'

// World (x east, y north) -> three (x, up, -y). A rotation.y of `th` maps local +x to world heading th.
const P = (x, y, h = 0) => [x, h, -y]

function Wheel({ x, z, r = 0.55, w = 0.4 }) {
  return (
    <mesh position={[x, r, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, w, 18]} />
      <meshStandardMaterial color="#0c1219" roughness={0.9} />
    </mesh>
  )
}

export function Tractor({ veh, color = '#22c4dd', cab = '#0d1c26', alarm = false }) {
  const len = veh.tractor_rear + veh.L1 + veh.tractor_front
  const cx = (-veh.tractor_rear + veh.L1 + veh.tractor_front) / 2
  return (
    <group>
      <mesh position={[cx, 1.05, 0]}>
        <boxGeometry args={[len, 1.5, veh.width]} />
        <meshStandardMaterial color={alarm ? '#ff5c6c' : color} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[cx + len / 2 - 1.5, 2.35, 0]}>
        <boxGeometry args={[2.6, 1.6, veh.width - 0.15]} />
        <meshStandardMaterial color={alarm ? '#ff8a96' : color} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[cx + len / 2 - 0.22, 2.55, 0]}>
        <boxGeometry args={[0.06, 0.9, veh.width - 0.5]} />
        <meshStandardMaterial color={cab} roughness={0.2} metalness={0.4} />
      </mesh>
      {/* fifth wheel */}
      <mesh position={[veh.d, 1.9, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.25, 20]} />
        <meshStandardMaterial color="#1a2632" />
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

export function Trailer({ veh, color = '#dbe4ec', alarm = false }) {
  const len = veh.L2 + veh.trailer_front + veh.trailer_rear
  const cx = (-veh.trailer_rear + veh.L2 + veh.trailer_front) / 2
  return (
    <group>
      <mesh position={[cx, 2.25, 0]}>
        <boxGeometry args={[len, 3.1, veh.width]} />
        <meshStandardMaterial color={alarm ? '#ffc7cd' : color} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[cx, 0.55, 0]}>
        <boxGeometry args={[len - 0.6, 0.5, veh.width - 0.4]} />
        <meshStandardMaterial color="#1a2632" />
      </mesh>
      {/* rear stripe */}
      <mesh position={[-veh.trailer_rear + 0.06, 1.2, 0]}>
        <boxGeometry args={[0.08, 0.35, veh.width - 0.2]} />
        <meshStandardMaterial color="#ffb547" emissive="#ffb547" emissiveIntensity={0.35} />
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
export default function Rig({ state, veh, ghost = false, alarm = false, opacity = 1 }) {
  const [x, y, th, psi] = state
  const tl = useMemo(() => trailerAxle(x, y, th, psi, veh), [x, y, th, psi, veh])
  return (
    <group>
      <group position={P(x, y)} rotation={[0, th, 0]}>
        <Tractor veh={veh} alarm={alarm} color={ghost ? '#ff5c6c' : '#22c4dd'} />
      </group>
      <group position={P(tl.x, tl.y)} rotation={[0, tl.th, 0]}>
        <Trailer veh={veh} alarm={alarm} color={ghost ? '#ffc7cd' : '#dbe4ec'} />
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
      <mesh position={[tOff, 1.0, 0]}>
        <boxGeometry args={[tLen, 1.4, p.w]} />
        <meshStandardMaterial color="#5b6d7f" roughness={0.7} />
      </mesh>
      <mesh position={[tOff + tLen / 2 - 1.5, 2.2, 0]}>
        <boxGeometry args={[2.6, 1.5, p.w - 0.15]} />
        <meshStandardMaterial color="#66798c" roughness={0.7} />
      </mesh>
      <mesh position={[-p.l / 2 + lLen / 2, 2.0, 0]}>
        <boxGeometry args={[lLen - 0.2, 2.9, p.w]} />
        <meshStandardMaterial color="#8798a9" roughness={0.75} />
      </mesh>
    </group>
  )
}
