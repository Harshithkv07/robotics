import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export function CameraController({ mode, targetTransform }) {
  const controlsRef = useRef(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!targetTransform || mode === 'Orbit') return;

    const px = targetTransform[12];
    const py = targetTransform[13];
    const theta = Math.atan2(targetTransform[1], targetTransform[0]);
    
    const targetPos = new THREE.Vector3(px, 0.2, -py);
    
    if (mode === 'Top-Down') {
      camera.position.lerp(new THREE.Vector3(px, 20, -py), 0.1);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetPos, 0.1);
      }
    } else if (mode === 'Chase') {
      const offset = new THREE.Vector3(-8 * Math.cos(theta), 4, 8 * Math.sin(theta));
      const desiredPos = targetPos.clone().add(offset);
      camera.position.lerp(desiredPos, 0.1);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetPos, 0.1);
      }
    } else if (mode === 'Hitch Cam') {
      const hitchPos = targetPos.clone().add(new THREE.Vector3(-1 * Math.cos(theta), 0.5, 1 * Math.sin(theta)));
      const offset = new THREE.Vector3(-3 * Math.cos(theta), 2, 3 * Math.sin(theta));
      const desiredPos = hitchPos.clone().add(offset);
      
      camera.position.lerp(desiredPos, 0.2);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(hitchPos, 0.2);
      }
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      enablePan={mode === 'Orbit'}
      enableZoom={mode === 'Orbit'}
      enableRotate={mode === 'Orbit'}
    />
  );
}
