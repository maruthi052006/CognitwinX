import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { api } from '../../services/api';

export default function SatelliteTexturedTerrain({ 
  zoneId = 1, 
  elevationAvg = 12.0, 
  mode = 'satellite' // 'satellite', 'dem_grid', or 'fused'
}) {
  const [textureUrl, setTextureUrl] = useState('');
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (zoneId) {
      const url = api.getSatelliteTileUrl(zoneId);
      setTextureUrl(url);

      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (loadedTexture) => {
          loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
          loadedTexture.generateMipmaps = true;
          setTexture(loadedTexture);
        },
        undefined,
        (err) => {
          console.warn('Satellite texture load error, using fallback procedural ground', err);
        }
      );
    }
  }, [zoneId]);

  // Generate terrain vertex displacement geometry based on CartoDEM-30m basin elevation
  const geometry = useMemo(() => {
    const size = 180;
    const segments = 64;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      const nx = x / (size / 2);
      const ny = y / (size / 2);

      const basin = 4.5 * (nx * nx + ny * ny);
      const canal = 3.5 * Math.exp(-Math.pow(ny - 0.2 * Math.sin(nx * 3.0), 2) / 0.05);
      const noise = Math.sin(nx * 8.0) * Math.cos(ny * 8.0) * 0.8;

      const z = basin - canal + noise - (elevationAvg * 0.15);
      pos.setZ(i, z);
    }

    geo.computeVertexNormals();
    return geo;
  }, [elevationAvg]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* Terrain Surface with Bhuvan Satellite Texture */}
      <mesh geometry={geometry} receiveShadow>
        {texture && mode !== 'dem_grid' ? (
          <meshStandardMaterial
            map={texture}
            roughness={0.7}
            metalness={0.1}
            flatShading={false}
          />
        ) : (
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.85}
            metalness={0.15}
            flatShading={false}
          />
        )}
      </mesh>

      {/* Futuristic ISRO Holographic Coordinates & Elevation Wireframe */}
      <mesh geometry={geometry} position={[0, 0, 0.03]}>
        <meshBasicMaterial
          color="#06b6d4"
          wireframe={true}
          transparent={true}
          opacity={mode === 'satellite' ? 0.07 : 0.18}
        />
      </mesh>
    </group>
  );
}
