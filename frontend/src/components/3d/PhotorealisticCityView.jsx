import React, { useState } from 'react';
import { useTwinStore } from '../../store/twinStore';
import MapLibreFallback2D from '../map/MapLibreFallback2D';
import { 
  Globe, 
  Layers, 
  MapPin, 
  Cpu, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  Sparkles 
} from 'lucide-react';

export default function PhotorealisticCityView({ onSwitchToSimulation }) {
  const { activeZone, zones, selectZone, selectedZoneId } = useTwinStore();
  const [mapMode, setMapMode] = useState('vector_2d'); // 'vector_2d' | '3d_preview'

  return (
    <div className="relative w-full h-full min-h-[520px] bg-[#050811] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl flex flex-col">
      {/* Top Navigation HUD */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer 1 Badge & Pilot City Selector */}
        <div className="glass-panel px-3.5 py-2 rounded-xl border border-cyan-500/30 flex items-center space-x-3 text-xs pointer-events-auto shadow-lg backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold text-white tracking-wide uppercase text-[11px]">
              2D Zone Selection & Geospatial Context
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Quick Basin Jumper */}
          <div className="flex items-center space-x-1.5">
            {zones?.map((z) => (
              <button
                key={z.id}
                onClick={() => selectZone(z.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                  selectedZoneId === z.id
                    ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.city}
              </button>
            ))}
          </div>
        </div>

        {/* Action: Switch / Handoff to Simulation Layer */}
        <div className="pointer-events-auto">
          <button
            onClick={onSwitchToSimulation}
            className="glass-panel px-4 py-2 rounded-xl border border-cyan-400/60 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-200 text-xs font-semibold flex items-center space-x-2 transition-all shadow-xl hover:shadow-cyan-500/20 group"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Launch Simulation & Risk Layer (3D Twin)</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main 2D Vector Map Engine (MapLibre GL JS) */}
      <div className="w-full h-full flex-1">
        <MapLibreFallback2D
          customTitle="MapLibre GL JS — Real-World Zone Navigator"
          reason="Vector Tile Layer (Free & Open Source)"
          onSwitchTo3D={onSwitchToSimulation}
        />
      </div>

      {/* Bottom Attribution & Coordinate Footer */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-[10px] text-slate-400">
        <div className="flex items-center space-x-2 bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span className="font-mono">
            {activeZone?.name} ({activeZone?.center_lat}° N, {activeZone?.center_lng}° E)
          </span>
        </div>

        <div className="flex items-center space-x-3 pointer-events-auto bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>OpenFreeMap Vector Tiles</span>
          <span>•</span>
          <span>MapLibre GL JS Engine</span>
        </div>
      </div>
    </div>
  );
}
