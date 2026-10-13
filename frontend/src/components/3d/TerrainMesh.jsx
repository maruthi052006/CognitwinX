import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function TerrainMesh({ elevationAvg = 12.0 }) {
  // Generate terrain vertex displacement geometry based on DEM basin elevation
  const geometry = useMemo(() => {
    const size = 180;
    const segments = 64;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      // Normalized coordinates [-1, 1]
      const nx = x / (size / 2);
      const ny = y / (size / 2);

      // Basin depression towards center with natural drainage canal
      const basin = 4.5 * (nx * nx + ny * ny);
      const canal = 3.5 * Math.exp(-Math.pow(ny - 0.2 * Math.sin(nx * 3.0), 2) / 0.05);
      const noise = Math.sin(nx * 8.0) * Math.cos(ny * 8.0) * 0.8;

      const elevOffset = ((Number(elevationAvg) % 15) - 7.5) * 0.05;
      const z = basin - canal + noise + elevOffset;
      pos.setZ(i, z);
    }

    geo.computeVertexNormals();
    return geo;
  }, [elevationAvg]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* Solid DEM Ground with contour shading */}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.85}
          metalness={0.15}
          flatShading={false}
        />
      </mesh>

      {/* Subtle Digital Grid Wireframe Overlay */}
      <mesh geometry={geometry} position={[0, 0, 0.02]}>
        <meshBasicMaterial
          color="#38bdf8"
          wireframe={true}
          transparent={true}
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}
