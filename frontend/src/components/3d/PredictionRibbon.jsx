import { Line } from '@react-three/drei';

export function PredictionRibbon({ horizon = [], visible = true }) {
  if (!visible || !horizon || horizon.length < 2) return null;

  // horizon is array of [x, y, theta, ...]
  // We map physics (x, y) to Three (x, 0.05, -y) to float just above the ground
  const points = horizon.map(pt => [pt[0], 0.05, -pt[1]]);

  return (
    <Line
      points={points}
      color="#00ffff"
      lineWidth={5}
      transparent
      opacity={0.8}
    />
  );
}
