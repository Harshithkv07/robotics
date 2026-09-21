import { Canvas } from '@react-three/fiber';
import { Environment, Grid } from '@react-three/drei';
import { WarehouseDock } from './WarehouseDock';
import { VehicleModels } from './VehicleModels';
import { PredictionRibbon } from './PredictionRibbon';
import { ReferencePath } from './ReferencePath';
import { CameraController } from './CameraController';

export function Scene({
  telemetry,
  cameraMode = 'Orbit',
  showAxes = true,
  showRibbon = true
}) {
  const profile = telemetry?.active_profile;
  const transforms = telemetry?.transforms;
  const horizon = telemetry?.predicted_horizon;
  const referenceHorizon = telemetry?.reference_horizon;

  return (
    <Canvas shadows camera={{ position: [10, 10, 10], fov: 50 }}>
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 30, 90]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={[20, 30, 10]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 6, 0]} intensity={8} color="#22d3ee" distance={18} decay={2} />

      <Environment preset="city" />

      <Grid
        infiniteGrid
        fadeDistance={50}
        sectionColor="#0e7490"
        cellColor="#1f2a37"
        position={[0, -0.01, 0]}
      />

      <WarehouseDock />
      
      {profile && transforms && (
        <VehicleModels profile={profile} transforms={transforms} showAxes={showAxes} />
      )}
      
      <ReferencePath horizon={referenceHorizon} visible={showRibbon} />
      <PredictionRibbon horizon={horizon} visible={showRibbon} />

      <CameraController mode={cameraMode} targetTransform={transforms?.base} />
    </Canvas>
  );
}
