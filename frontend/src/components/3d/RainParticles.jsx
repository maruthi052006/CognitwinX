import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function RainParticles({ rainfallMm = 20.0 }) {
  const pointsRef = useRef();

  // Particle count scales with precipitation intensity (0 to 3000 streaks)
  const count = useMemo(() => {
    if (rainfallMm < 1.0) return 0;
    return Math.min(3000, Math.floor(rainfallMm * 65));
  }, [rainfallMm]);

  // Buffer attributes
  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;     // X
      pos[i * 3 + 1] = Math.random() * 80;         // Y (height)
      pos[i * 3 + 2] = (Math.random() - 0.5) * 160; // Z
      vel[i] = 1.2 + Math.random() * 1.8;          // Fall speed
    }

    return { positions: pos, velocities: vel };
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current || count === 0) return;
    const pos = pointsRef.current.geometry.attributes.position;

    for (let i = 0; i < count; i++) {
      let y = pos.getY(i);
      y -= velocities[i] * (delta * 60);

      // Reset to top when hitting the ground
      if (y < -2) {
        y = 70 + Math.random() * 15;
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.65}
        color="#38bdf8"
        transparent={true}
        opacity={Math.min(0.7, 0.2 + (rainfallMm / 50.0) * 0.5)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
