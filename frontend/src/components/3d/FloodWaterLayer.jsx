import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import waterVertexShader from './shaders/waterVertex.glsl?raw';
import waterFragmentShader from './shaders/waterFragment.glsl?raw';

export default function FloodWaterLayer({ depth = 0.25, heightmap = null }) {
  const meshRef = useRef();
  const materialRef = useRef();

  // Plane geometry for water with 64x64 subdivision to match depth grid
  const geometry = useMemo(() => {
    const size = 180;
    const segments = 63;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    return geo;
  }, []);

  // Shader Uniforms
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWaterHeight: { value: 0.0 },
    uWaveIntensity: { value: 1.0 },
    uWaterColor: { value: new THREE.Color('#0284c7') }, // Deep cyan-blue
    uGlowColor: { value: new THREE.Color('#38bdf8') },  // Glowing cyan crest
    uOpacity: { value: 0.65 },
  }), []);

  // GSAP Smooth Water Height & Ripple Morphing (1-2s transition per Section 5.1)
  useEffect(() => {
    if (!materialRef.current) return;

    // Target water vertical elevation based on predicted depth:
    // Sits in drainage canal when depth is low, rises onto streets & buildings when depth is high
    const targetHeight = Math.max(0.1, depth * 2.2);
    const waveIntensity = Math.min(2.5, 0.8 + depth * 1.5);

    gsap.to(materialRef.current.uniforms.uWaterHeight, {
      value: targetHeight,
      duration: 1.6,
      ease: 'power2.out'
    });

    gsap.to(materialRef.current.uniforms.uWaveIntensity, {
      value: waveIntensity,
      duration: 1.2,
      ease: 'power1.out'
    });

    // Vertex displacement from 64x64 heightmap if available
    if (meshRef.current && heightmap && heightmap.length >= 64) {
      const pos = meshRef.current.geometry.attributes.position;
      const targetHeights = new Float32Array(pos.count);

      for (let r = 0; r < 64; r++) {
        for (let c = 0; c < 64; c++) {
          const idx = r * 64 + c;
          if (idx < pos.count) {
            const cellDepth = heightmap[r]?.[c] || 0;
            targetHeights[idx] = cellDepth * 3.5;
          }
        }
      }

      // Smooth vertex tweening with GSAP dummy object
      const tweenObj = { factor: 0 };
      const currentZ = new Float32Array(pos.array);

      gsap.to(tweenObj, {
        factor: 1.0,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          for (let i = 0; i < pos.count; i++) {
            const original = currentZ[i * 3 + 2];
            const target = targetHeights[i];
            pos.setZ(i, THREE.MathUtils.lerp(original, target, tweenObj.factor));
          }
          pos.needsUpdate = true;
          meshRef.current.geometry.computeVertexNormals();
        }
      });
    }
  }, [depth, heightmap]);

  // Animation Loop for waves
  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * 1.5;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3.2, 0]}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
