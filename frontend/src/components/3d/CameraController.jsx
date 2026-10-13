import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';

export default function CameraController({ activeZoneId }) {
  const controlsRef = useRef();
  const { camera } = useThree();

  // Scripted fly-to-zone transitions (~1.5s duration with power2.inOut per Section 5.1)
  useEffect(() => {
    if (!controlsRef.current) return;

    // Default elevated isometric overview
    const targetCameraPos = { x: 90, y: 75, z: 90 };
    const targetLookAt = { x: 0, y: 5, z: 0 };

    // Vary angle slightly per zone to give dynamic sense of arrival
    if (activeZoneId) {
      const angle = (activeZoneId * 45) * (Math.PI / 180);
      targetCameraPos.x = 110 * Math.cos(angle);
      targetCameraPos.z = 110 * Math.sin(angle);
      targetCameraPos.y = 70;
    }

    gsap.to(camera.position, {
      x: targetCameraPos.x,
      y: targetCameraPos.y,
      z: targetCameraPos.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.lookAt(targetLookAt.x, targetLookAt.y, targetLookAt.z);
        if (controlsRef.current) {
          controlsRef.current.target.set(targetLookAt.x, targetLookAt.y, targetLookAt.z);
          controlsRef.current.update();
        }
      }
    });
  }, [activeZoneId, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={true}
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2.1} // Prevent dipping below ground
      minDistance={20}
      maxDistance={220}
    />
  );
}
