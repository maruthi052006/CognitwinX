import React, { Suspense, useState, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import TerrainMesh from './TerrainMesh';
import BuildingsLayer from './BuildingsLayer';
import FloodWaterLayer from './FloodWaterLayer';
import RainParticles from './RainParticles';
import CameraController from './CameraController';
import ExplanationOverlay from './ExplanationOverlay';
import PhotorealisticCityView from './PhotorealisticCityView';
import ResponsiveFallback2D from '../common/ResponsiveFallback2D';
import { useTwinStore } from '../../store/twinStore';
import { 
  RefreshCw, 
  Activity, 
  Droplets, 
  CloudRain, 
  Globe, 
  Cpu, 
  Sparkles, 
  Building2,
  Map as MapIcon
} from 'lucide-react';

import Button from '../common/Button';

export default function CityTwinScene() {
  const {
    activeZone,
    selectedZoneId,
    currentDepth,
    currentConfidence,
    currentRainfall,
    currentHeightmap,
    isRecalculating,
    whatIfPreviewDepth,
    isWhatIfActive,
    explanationView,
    setExplanationView
  } = useTwinStore();

  // View Mode: 'simulation' (Three.js R3F) | 'map_2d' (MapLibre / Leaflet / Bhuvan 2D) | 'photorealistic' (Context)
  const [viewMode, setViewMode] = useState('simulation');
  
  // Building Rendering in Layer 2: 'solid' | 'translucent_glow'
  const [buildingStyle, setBuildingStyle] = useState('solid');

  const displayDepth = isWhatIfActive && whatIfPreviewDepth !== null ? whatIfPreviewDepth : currentDepth;

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#050811] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl flex flex-col">
      {/* Primary Top Bar: Architecture Layer Selector & Mode Controls */}
      <div className="absolute top-3 inset-x-3 z-20 pointer-events-none flex flex-wrap items-start justify-between gap-2">
        {/* Left: View & Layer Controls */}
        <div className="glass-panel p-1 rounded-xl border border-cyan-500/40 flex items-center flex-wrap gap-1 text-xs shadow-xl backdrop-blur-md pointer-events-auto">
          <Button
            variant={viewMode === 'map_2d' ? 'primary' : 'ghost'}
            size="chip"
            icon={MapIcon}
            onClick={() => setViewMode('map_2d')}
            className={viewMode === 'map_2d' ? 'text-black font-bold' : ''}
            title="Open-Source 2D Mapping (MapLibre GL JS, Leaflet & ISRO Bhuvan WMS)"
          >
            2D Map
          </Button>

          <Button
            variant={viewMode === 'simulation' ? 'primary' : 'ghost'}
            size="chip"
            icon={Cpu}
            onClick={() => setViewMode('simulation')}
            className={viewMode === 'simulation' ? 'text-black font-bold' : ''}
            title="3D Hydrodynamic Twin with GLSL Water Shaders & Extruded Buildings"
          >
            3D Twin
          </Button>

          {viewMode === 'simulation' && (
            <>
              <div className="h-3.5 w-px bg-slate-700/60 mx-0.5" />
              <Button
                variant={!explanationView ? 'activeTab' : 'ghost'}
                size="chip"
                onClick={() => setExplanationView(false)}
                title="Standard Flood Risk View"
              >
                Risk View
              </Button>
              <Button
                variant={explanationView ? 'activeTab' : 'ghost'}
                size="chip"
                onClick={() => setExplanationView(true)}
                className={explanationView ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' : ''}
                title="Grad-CAM Feature Attribution Saliency"
              >
                Grad-CAM
              </Button>
              <div className="h-3.5 w-px bg-slate-700/60 mx-0.5" />
              <Button
                variant={buildingStyle === 'solid' ? 'activeTab' : 'ghost'}
                size="chip"
                icon={Building2}
                onClick={() => setBuildingStyle('solid')}
                title="Solid architectural extrusions"
              >
                Solid
              </Button>
              <Button
                variant={buildingStyle === 'translucent_glow' ? 'activeTab' : 'ghost'}
                size="chip"
                icon={Sparkles}
                onClick={() => setBuildingStyle('translucent_glow')}
                className={buildingStyle === 'translucent_glow' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : ''}
                title="Subtle risk-colored translucent overlay"
              >
                Glow
              </Button>
            </>
          )}
        </div>

        {/* Right: Telemetry HUD */}
        {viewMode === 'simulation' && (
          <div className="glass-panel p-2 sm:p-2.5 rounded-xl border border-cyan-500/30 flex items-center space-x-2.5 text-xs pointer-events-auto backdrop-blur-md shadow-xl">
            {/* Rainfall */}
            <div className="flex items-center space-x-1.5">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider hidden sm:block">Precip</div>
                <div className="font-bold text-white font-mono text-xs">{currentRainfall} mm/h</div>
              </div>
            </div>

            <div className="h-5 w-px bg-slate-700/60" />

            {/* Flood Depth */}
            <div className="flex items-center space-x-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider hidden sm:block">
                  {isWhatIfActive ? 'What-If' : 'Depth'}
                </div>
                <div className={`font-bold font-mono text-xs ${displayDepth > 0.6 ? 'text-red-400' : (displayDepth > 0.35 ? 'text-amber-400' : 'text-cyan-300')}`}>
                  {displayDepth} m
                </div>
              </div>
            </div>

            <div className="h-5 w-px bg-slate-700/60" />

            {/* AI Confidence */}
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider hidden sm:block">Certainty</div>
                <div className="font-bold text-white font-mono text-xs">{(currentConfidence * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Mode Switching */}
      {viewMode === 'map_2d' ? (
        <div className="w-full h-full flex-1 transition-opacity duration-500 ease-in-out">
          <ResponsiveFallback2D onSwitchTo3D={() => setViewMode('simulation')} />
        </div>
      ) : viewMode === 'photorealistic' ? (
        <div className="w-full h-full flex-1 transition-opacity duration-500 ease-in-out">
          <PhotorealisticCityView 
            onSwitchToSimulation={() => setViewMode('simulation')}
          />
        </div>
      ) : (
        /* Layer 2: Three.js Simulation & Structured Data View */
        <div className="relative w-full h-full flex-1 transition-opacity duration-500 ease-in-out">
          {/* Dynamic Risk / Saliency Legend at bottom-right */}
          <ExplanationOverlay />

          {/* Orchestrator Self-Correction Recalculating Banner */}
          {isRecalculating && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 glass-panel-glow px-4 py-2 rounded-full border border-amber-400/50 flex items-center space-x-2 text-xs text-amber-300 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="font-semibold tracking-wide">Orchestrator: Low confidence detected (recalculating with fused optical NDWI)...</span>
            </div>
          )}

          {/* 3D WebGL Canvas Container with explicit flex-1 and min-height */}
          <div className="flex-1 w-full h-full min-h-[420px] relative">
            <Canvas
              camera={{ position: [90, 75, 90], fov: 45 }}
              dpr={[1, 2]}
              gl={{ powerPreference: 'high-performance', antialias: true }}
              shadows
              className="w-full h-full cursor-grab active:cursor-grabbing"
            >
              <color attach="background" args={['#050811']} />
              <fog attach="fog" args={['#050811', 120, 260]} />

              {/* Cinematic Atmospheric Lighting */}
              <ambientLight intensity={0.45} />
              <directionalLight
                position={[60, 100, 50]}
                intensity={1.2}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={300}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                color="#e0f2fe"
              />
              {/* Futuristic cyan rim glow light */}
              <pointLight position={[-80, 40, -80]} intensity={1.5} color="#06b6d4" distance={250} />

              <Suspense fallback={null}>
                {/* DEM Ground Mesh */}
                <TerrainMesh elevationAvg={activeZone?.elevation_avg || 12.0} />

                {/* Extruded 3D Instanced Buildings (with solid or risk glow overlay) */}
                <BuildingsLayer
                  footprints={activeZone?.building_footprints_geojson}
                  currentDepth={displayDepth}
                  renderMode={buildingStyle}
                  elevationAvg={activeZone?.elevation_avg || 12.0}
                />

                {/* Dynamic GLSL Animated Flood Water */}
                <FloodWaterLayer
                  depth={displayDepth}
                  heightmap={currentHeightmap}
                />

                {/* GPU Rainfall Particle System */}
                <RainParticles rainfallMm={currentRainfall} />

                {/* Orbit Controls with Scripted Fly-to Transitions */}
                <CameraController activeZoneId={selectedZoneId} />
              </Suspense>
            </Canvas>
          </div>

          {/* Bottom Zone Identifier */}
          <div className="absolute bottom-3 left-4 z-20 pointer-events-none">
            <div className="text-xs font-semibold text-cyan-400/80 tracking-widest uppercase">Digital Twin Coordinates</div>
            <div className="text-sm font-bold text-white tracking-wide">{activeZone?.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Lat: {activeZone?.center_lat}° N | Lng: {activeZone?.center_lng}° E | Elev: {activeZone?.elevation_avg}m
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
