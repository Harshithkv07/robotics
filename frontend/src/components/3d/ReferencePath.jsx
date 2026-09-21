import { Line } from '@react-three/drei';

export function ReferencePath({ horizon = [], visible = true }) {
  if (!visible || !horizon || horizon.length < 2) return null;

  // horizon is array of [x, y, theta]; same physics->Three mapping as PredictionRibbon.
  const points = horizon.map(pt => [pt[0], 0.03, -pt[1]]);

  return (
    <Line
      points={points}
      color="#f472b6"
      lineWidth={3}
      dashed
      dashSize={0.4}
      gapSize={0.3}
      transparent
      opacity={0.7}
    />
  );
}
