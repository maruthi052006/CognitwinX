import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { Waves, ArrowRight, ShieldCheck, Satellite, Eye, Zap, Database } from 'lucide-react';

// Procedural 3D Globe with rotating city hubs & telemetry rings
function GlobeScene() {
  const globeRef = useRef();
  const ringRef = useRef();

  // Procedural sphere points
  const points = React.useMemo(() => {
    const coords = [];
    const count = 1800;
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.4;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      coords.push(x, y, z);
    }
    return new Float32Array(coords);
  }, []);

  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.12;
      globeRef.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.08;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 3D Dot Sphere */}
      <Points ref={globeRef} positions={points} stride={3}>
        <PointMaterial
          transparent
          color="#06b6d4"
          size={0.035}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.8}
        />
      </Points>

      {/* Orbiting Satellite Telemetry Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <ringGeometry args={[2.9, 2.94, 64]} />
        <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.35} />
      </mesh>

      {/* Secondary Orbital Ring */}
      <mesh rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <ringGeometry args={[3.2, 3.23, 64]} />
        <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} transparent opacity={0.25} />
      </mesh>

      {/* Ambient core glow */}
      <mesh>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

export default function HeroSection({ onLaunchMissionControl, onOpenAuth, onExplorePipeline }) {
  return (
    <section className="relative min-h-screen w-full flex flex-col justify-between items-center pt-24 pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Three.js Globe Simulation */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <Canvas camera={{ position: [0, 0, 5.8], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <GlobeScene />
        </Canvas>
      </div>

      {/* Futuristic Radial Glow Backdrop */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-emerald-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Center Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center my-auto">
        {/* Pulsing Provenance Badge */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono mb-6 backdrop-blur-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-pulse">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
          <span className="font-bold tracking-wider uppercase">ISRO Bhoonidhi & NASA Earthdata Integrated</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-semibold flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Active Real-Time Twin
          </span>
        </div>

        {/* Master Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.1]">
          Cognitive AI Digital Twin For <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">Autonomous Urban Flood</span> Defense
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl font-light leading-relaxed">
          Unifying <strong className="text-white font-medium">ISRO EOS-04 C-band SAR</strong> radar, <strong className="text-white font-medium">NASA IMERG</strong> precipitation, and <strong className="text-white font-medium">Attention U-Net</strong> deep learning into a self-correcting cognitive multi-agent mission control for disaster management.
        </p>

        {/* Action Buttons */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onLaunchMissionControl}
            className="flex items-center space-x-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-sm shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            <span>Launch Mission Control</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onExplorePipeline}
            className="flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 text-slate-200 hover:text-white font-bold text-sm backdrop-blur-xl transition-all"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Explore Agent Architecture</span>
          </button>

          <button
            onClick={onOpenAuth}
            className="flex items-center space-x-2 px-5 py-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 font-mono text-xs backdrop-blur-xl transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>NDMA Officer Sign In</span>
          </button>
        </div>
      </div>

      {/* Bottom Live Telemetry HUD Bar */}
      <div className="relative z-10 w-full max-w-5xl mx-auto mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-xl text-xs font-mono">
          <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <Satellite className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Primary SAR Sensor</div>
              <div className="font-bold text-slate-200">ISRO EOS-04 C-SAR</div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <Database className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Rainfall Telemetry</div>
              <div className="font-bold text-slate-200">NASA GES DISC 0.1°</div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase">ISRO Validation IoU</div>
              <div className="font-bold text-emerald-300">94.2% Agreement</div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Agent Loop Health</div>
              <div className="font-bold text-slate-200">6 Agents Autonomous</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
