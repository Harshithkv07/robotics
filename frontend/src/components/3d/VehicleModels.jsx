import { useMemo } from 'react';
import { Cylinder, Sphere, useGLTF } from '@react-three/drei';
import { CoordinateAxes } from './CoordinateAxes';

useGLTF.preload('/models/tractor.glb');
useGLTF.preload('/models/trailer.glb');

// Blender-authored assets: origin sits at the ground-projected rear-axle point
// (matching the physics "base"/"link1"/"link2" transform frames exactly), and
// the glTF Z-up->Y-up export conversion happens to keep model-forward on +X —
// the same axis `getPoseFromMatrix` already assumes. No offset/rotation hacks needed.
function useVehicleModel(path) {
  const { scene } = useGLTF(path);
  // Each instance needs its own Object3D graph (MultiTrailer renders two trailers
  // from the same asset); materials/geometries are still shared, just the nodes aren't.
  return useMemo(() => scene.clone(true), [scene]);
}

function TractorModel({ position, rotation }) {
  const model = useVehicleModel('/models/tractor.glb');
  return <primitive object={model} position={position} rotation={rotation} castShadow receiveShadow />;
}

function TrailerModel({ position, rotation }) {
  const model = useVehicleModel('/models/trailer.glb');
  return <primitive object={model} position={position} rotation={rotation} castShadow receiveShadow />;
}

function getPoseFromMatrix(matrixArray, groundHeight = 0.01) {
  if (!matrixArray || matrixArray.length !== 16) return { position: [0, 0, 0], rotation: [0, 0, 0] };
  const px = matrixArray[12];
  const py = matrixArray[13];
  const theta = Math.atan2(matrixArray[1], matrixArray[0]);
  return {
    position: [px, groundHeight, -py],
    rotation: [0, theta, 0]
  };
}

export function VehicleModels({ profile, transforms, showAxes }) {
  if (!transforms || !transforms.base) return null;

  const usesTruckModel = profile === 'AckermannCar' || profile === 'SingleTrailer' || profile === 'MultiTrailer';
  const basePose = getPoseFromMatrix(transforms.base, usesTruckModel ? 0.01 : 0.15);
  const link1Pose = transforms.link1 ? getPoseFromMatrix(transforms.link1) : null;
  const link2Pose = transforms.link2 ? getPoseFromMatrix(transforms.link2) : null;

  const hitch1Pose = transforms.hitch1 ? getPoseFromMatrix(transforms.hitch1) : null;
  const hitch2Pose = transforms.hitch2 ? getPoseFromMatrix(transforms.hitch2) : null;

  return (
    <group>
      {/* Tractor / Base */}
      {profile === 'DifferentialDrive' && (
        <group position={basePose.position} rotation={basePose.rotation}>
          <Cylinder args={[0.5, 0.5, 0.3, 32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#888" metalness={0.6} roughness={0.4} />
          </Cylinder>
          <Sphere args={[0.1]} position={[0.3, 0.2, 0]}>
            <meshStandardMaterial color="green" emissive="green" emissiveIntensity={2} />
          </Sphere>
          <Cylinder args={[0.2, 0.2, 0.1, 16]} position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#222" />
          </Cylinder>
          <Cylinder args={[0.2, 0.2, 0.1, 16]} position={[0, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#222" />
          </Cylinder>
        </group>
      )}

      {usesTruckModel && (
        <TractorModel position={basePose.position} rotation={basePose.rotation} />
      )}

      <CoordinateAxes position={basePose.position} rotation={basePose.rotation} size={1.5} visible={showAxes} />

      {/* Trailer 1 */}
      {link1Pose && (
        <group>
          {hitch1Pose && (
            <CoordinateAxes position={hitch1Pose.position} rotation={hitch1Pose.rotation} size={1} visible={showAxes} />
          )}
          <TrailerModel position={link1Pose.position} rotation={link1Pose.rotation} />
          <CoordinateAxes position={link1Pose.position} rotation={link1Pose.rotation} size={1.5} visible={showAxes} />
        </group>
      )}

      {/* Trailer 2 */}
      {link2Pose && (
        <group>
          {hitch2Pose && (
            <CoordinateAxes position={hitch2Pose.position} rotation={hitch2Pose.rotation} size={1} visible={showAxes} />
          )}
          <TrailerModel position={link2Pose.position} rotation={link2Pose.rotation} />
          <CoordinateAxes position={link2Pose.position} rotation={link2Pose.rotation} size={1.5} visible={showAxes} />
        </group>
      )}
    </group>
  );
}
