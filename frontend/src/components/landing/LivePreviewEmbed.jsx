import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Sliders, Maximize2, ShieldAlert, Waves, CheckCircle2, ArrowRight } from 'lucide-react';

function MiniCityBuildings({ waterDepth }) {
  // Simple stylized 3D city blocks
  const buildings = React.useMemo(() => {
    const list = [];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        if (Math.random() > 0.25) {
          const height = 0.5 + Math.random() * 2.2;
          list.push({
            pos: [x * 1.4, height / 2, z * 1.4],
            size: [0.9, height, 0.9],
            id: `${x}_${z}`,
            height
          });
        }
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* Ground Terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[14, 14, 16, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Grid Lines */}
      <gridHelper args={[14, 14, '#06b6d4', '#1e293b']} position={[0, 0.01, 0]} />

      {/* City Buildings */}
      {buildings.map((b) => {
        const isFlooded = waterDepth > 0.1 && b.pos[1] - b.height / 2 < waterDepth;
        return (
          <mesh key={b.id} position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial
              color={isFlooded ? '#ef4444' : '#334155'}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        );
      })}

      {/* Dynamic 3D Flood Water Layer */}
      {waterDepth > 0.02 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterDepth, 0]}>
          <planeGeometry args={[13, 13]} />
          <meshStandardMaterial
            color="#06b6d4"
            transparent
            opacity={0.65}
            roughness={0.1}
            metalness={0.8}
          />
        </mesh>
      )}
    </group>
  );
}

export default function LivePreviewEmbed({ onLaunchMissionControl }) {
  const [waterDepth, setWaterDepth] = useState(0.85);
  const [selectedCity, setSelectedCity] = useState('Chennai (T. Nagar)');

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-cyan-500/30 p-6 sm:p-10 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-2">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              <span>INTERACTIVE DIGITAL TWIN SANDBOX</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Test Real-Time Flood Inundation in 3D
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Drag the kinematic flood depth slider to simulate runoff propagation over 3D building geometries.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onLaunchMissionControl}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
            >
              <span>Open Full Mission Control</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sandbox Viewport + Controls Container */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 3D Canvas Embed */}
          <div className="lg:col-span-3 h-[380px] sm:h-[460px] rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
            <Canvas camera={{ position: [7, 6, 7], fov: 45 }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 15, 10]} intensity={1.2} />
              <MiniCityBuildings waterDepth={waterDepth} />
              <OrbitControls autoRotate={true} autoRotateSpeed={0.8} enableZoom={true} maxPolarAngle={Math.PI / 2.1} />
            </Canvas>

            {/* Overlay Info Pill */}
            <div className="absolute top-4 left-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md text-xs font-mono">
              <div className="text-[10px] text-slate-400">Target Metro</div>
              <div className="font-bold text-white">{selectedCity}</div>
            </div>

            <div className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md text-xs font-mono text-right">
              <div className="text-[10px] text-slate-400">Projected Peak Depth</div>
              <div className="font-bold text-cyan-300 font-mono text-sm">{waterDepth.toFixed(2)} m</div>
            </div>

            <div className="absolute bottom-4 left-4 text-[10px] text-slate-500 font-mono">
              * Interactive 3D Canvas (Left click + drag to rotate, scroll to zoom)
            </div>
          </div>

          {/* Interactive Controls Panel */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center">
                <Sliders className="w-4 h-4 text-cyan-400 mr-1.5" />
                Scenario Parameters
              </h3>

              {/* City Switcher */}
              <div className="mb-5">
                <label className="text-[10px] font-mono text-slate-400 block mb-1.5">Select Urban Zone</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Chennai (T. Nagar)">Chennai (T. Nagar)</option>
                  <option value="Bengaluru (Bellandur)">Bengaluru (Bellandur)</option>
                  <option value="Mumbai (Kurla West)">Mumbai (Kurla West)</option>
                  <option value="Hyderabad (Old City)">Hyderabad (Old City)</option>
                </select>
              </div>

              {/* Flood Depth Slider */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-slate-400">Water Depth:</span>
                  <span className="text-cyan-300 font-bold">{waterDepth.toFixed(2)} meters</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.05"
                  value={waterDepth}
                  onChange={(e) => setWaterDepth(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>0.0m (Dry)</span>
                  <span>1.2m (Alert)</span>
                  <span>2.5m (Severe)</span>
                </div>
              </div>

              {/* Dynamic Risk Classification */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Simulated Threat Level</div>
                <div className="mt-1 flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${waterDepth > 1.2 ? 'bg-red-500 animate-ping' : (waterDepth > 0.4 ? 'bg-amber-400' : 'bg-emerald-400')}`} />
                  <span className={`font-bold font-mono text-sm uppercase ${waterDepth > 1.2 ? 'text-red-400' : (waterDepth > 0.4 ? 'text-amber-300' : 'text-emerald-300')}`}>
                    {waterDepth > 1.2 ? 'Critical Inundation' : (waterDepth > 0.4 ? 'Moderate Waterlogging' : 'Normal Conditions')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80">
              <button
                onClick={onLaunchMissionControl}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-slate-200 transition-all text-center block"
              >
                Access Zone Telemetry Lineage
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
