import { Line } from '@react-three/drei';

export function CoordinateAxes({ position = [0, 0, 0], rotation = [0, 0, 0], size = 1, visible = true }) {
  if (!visible) return null;

  return (
    <group position={position} rotation={rotation}>
      {/* X - Red (Physics X -> Three X) */}
      <Line points={[[0, 0, 0], [size, 0, 0]]} color="red" lineWidth={3} />
      {/* Y - Green (Physics Y -> Three -Z) */}
      <Line points={[[0, 0, 0], [0, 0, -size]]} color="green" lineWidth={3} />
      {/* Z - Blue (Physics Z -> Three Y) */}
      <Line points={[[0, 0, 0], [0, size, 0]]} color="blue" lineWidth={3} />
    </group>
  );
}
