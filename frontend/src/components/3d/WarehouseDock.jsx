import { Box, Plane, Line } from '@react-three/drei';

export function WarehouseDock() {
  return (
    <group>
      {/* Floor */}
      <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#0d1117" roughness={0.55} metalness={0.15} />
      </Plane>

      {/* Loading Dock Wall */}
      <Box args={[100, 10, 2]} position={[0, 5, -5]} castShadow receiveShadow>
        <meshStandardMaterial color="#131a24" roughness={0.85} />
      </Box>

      {/* Target Bay Lines (cyan, matching the cockpit accent) */}
      <Line
        points={[[-2, 0.05, 5], [-2, 0.05, 0], [2, 0.05, 0], [2, 0.05, 5]]}
        color="#22d3ee"
        lineWidth={3}
      />
      <Line
        points={[[-2, 0.05, 5], [2, 0.05, 5]]}
        color="#22d3ee"
        lineWidth={3}
        dashed={true}
        dashSize={0.5}
        gapSize={0.5}
      />

      {/* Some crates around */}
      <Box args={[2, 2, 2]} position={[-5, 1, 2]} castShadow receiveShadow>
        <meshStandardMaterial color="#5b3a1e" roughness={0.7} />
      </Box>
      <Box args={[3, 3, 3]} position={[6, 1.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#5b3a1e" roughness={0.7} />
      </Box>
    </group>
  );
}
