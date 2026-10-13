import React, { useState } from 'react';
import { useDeviceCapability, selectRenderingTier } from '../map/mapCapabilityDetector';
import MapLibreFallback2D from '../map/MapLibreFallback2D';
import LeafletMinimalFallback from '../map/LeafletMinimalFallback';
import BhuvanWMSView from '../map/BhuvanWMSView';
import { Layers, Map as MapIcon, Satellite, Sparkles, Cpu } from 'lucide-react';

export default function ResponsiveFallback2D({ reason, onSwitchTo3D }) {
  const capability = useDeviceCapability();
  const detectedTier = selectRenderingTier(capability);

  // Default active engine based on capability detector
  const [activeEngine, setActiveEngine] = useState(() => {
    return detectedTier === '2D_LEAFLET_MINIMAL' ? 'leaflet' : 'maplibre';
  });

  return (
    <div className="relative w-full h-full min-h-[480px] flex flex-col bg-[#070b14] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl">
      {/* Top Floating Engine Switcher Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <div className="glass-panel p-1 rounded-2xl border border-cyan-500/30 flex items-center space-x-1 text-xs shadow-2xl backdrop-blur-xl">
          {/* MapLibre GL Button */}
          <button
            onClick={() => setActiveEngine('maplibre')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
              activeEngine === 'maplibre'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="MapLibre GL JS (Hardware-accelerated Vector Tiles)"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>MapLibre 2D</span>
          </button>

          {/* Leaflet Minimal Button */}
          <button
            onClick={() => setActiveEngine('leaflet')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
              activeEngine === 'leaflet'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Leaflet Minimal (Ultra-Lightweight Raster Tiles)"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Leaflet Raster</span>
          </button>

          {/* ISRO Bhuvan OpenLayers Button */}
          <button
            onClick={() => setActiveEngine('bhuvan')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
              activeEngine === 'bhuvan'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="OpenLayers ISRO Bhuvan Thematic WMS"
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>ISRO Bhuvan</span>
          </button>
        </div>
      </div>

      {/* Render Active Engine */}
      <div className="w-full h-full flex-1">
        {activeEngine === 'maplibre' && (
          <MapLibreFallback2D
            reason={reason}
            onSwitchTo3D={onSwitchTo3D}
          />
        )}

        {activeEngine === 'leaflet' && (
          <LeafletMinimalFallback
            reason={reason}
            onSwitchToMapLibre={() => setActiveEngine('maplibre')}
            onSwitchTo3D={onSwitchTo3D}
          />
        )}

        {activeEngine === 'bhuvan' && (
          <BhuvanWMSView
            onSwitchTo3D={onSwitchTo3D}
          />
        )}
      </div>
    </div>
  );
}
