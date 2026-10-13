import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTwinStore } from '../../store/twinStore';
import { buildFloodGeoJSON, getRiskColor, getRiskLabel } from './FloodOverlayLayer';
import { 
  Droplets, 
  Activity, 
  Layers, 
  Map as MapIcon, 
  Cpu, 
  ShieldCheck, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';

const RASTER_PROVIDERS = {
  carto_dark: {
    name: 'Carto Dark (Low CPU)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  },
  osm_standard: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};

export default function LeafletMinimalFallback({ reason, onSwitchToMapLibre, onSwitchTo3D }) {
  const { zones, activeZone, selectZone, predictions, currentDepth, currentConfidence } = useTwinStore();
  const [providerKey, setProviderKey] = useState('carto_dark');
  const [floodOpacity, setFloodOpacity] = useState(0.6);

  const center = activeZone ? [activeZone.center_lat, activeZone.center_lng] : [13.0827, 80.2707];
  const floodGeoJSON = buildFloodGeoJSON(zones, predictions, activeZone?.id);

  const activeProvider = RASTER_PROVIDERS[providerKey];

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#070b14] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl flex flex-col select-none">
      
      {/* Top Banner & Status Badge */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-amber-500/40 flex items-center space-x-2 text-xs shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-bold text-amber-300 tracking-wide uppercase text-[11px]">
            Leaflet — Ultra-Lightweight Raster Fallback
          </span>
          <span className="text-slate-400 text-[10px] hidden sm:inline">
            | {reason || 'Optimized for zero-WebGL / low-memory CPU'}
          </span>
        </div>

        {/* Raster Tile Selector */}
        <div className="glass-panel px-2 py-1 rounded-xl border border-slate-700/60 flex items-center space-x-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            className="bg-transparent text-slate-200 text-[11px] font-semibold focus:outline-none cursor-pointer pr-1"
          >
            {Object.entries(RASTER_PROVIDERS).map(([k, p]) => (
              <option key={k} value={k} className="bg-slate-900 text-slate-100">
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Right Stats HUD */}
      <div className="absolute top-3 right-3 z-[1000] glass-panel p-2.5 rounded-xl border border-cyan-500/20 flex items-center space-x-4 text-xs shadow-xl backdrop-blur-md pointer-events-auto hidden sm:flex">
        <div className="flex items-center space-x-1.5">
          <Droplets className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">Projected Depth</div>
            <div className="font-bold text-white font-mono">{currentDepth}m</div>
          </div>
        </div>
        <div className="h-5 w-px bg-slate-700" />
        <div className="flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">AI Confidence</div>
            <div className="font-bold text-emerald-300 font-mono">{(currentConfidence * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Leaflet MapContainer */}
      <MapContainer
        key={`${activeZone?.id}-${providerKey}`}
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-10 flex-1"
        style={{ background: '#090d16' }}
      >
        <TileLayer
          attribution={activeProvider.attribution}
          url={activeProvider.url}
          opacity={0.9}
        />

        {/* Render Same Unified GeoJSON Features */}
        {floodGeoJSON.features.map((feat) => {
          const props = feat.properties;
          const isSelected = props.is_selected;
          const color = props.risk_color || '#06b6d4';

          if (feat.geometry.type === 'Polygon') {
            const positions = feat.geometry.coordinates[0].map((c) => [c[1], c[0]]);
            return (
              <Polygon
                key={feat.id}
                positions={positions}
                pathOptions={{
                  color: isSelected ? '#38bdf8' : '#64748b',
                  fillColor: color,
                  fillOpacity: isSelected ? floodOpacity : floodOpacity * 0.45,
                  weight: isSelected ? 2.5 : 1,
                  dashArray: isSelected ? '4, 4' : null
                }}
                eventHandlers={{
                  click: () => {
                    if (props.zone_id) selectZone(props.zone_id);
                  }
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-900 text-xs font-sans">
                    <strong className="text-sm block font-bold text-cyan-900">{props.zone_name}</strong>
                    <div className="text-slate-600 mt-1">Criticality: <span className="capitalize">{props.criticality}</span></div>
                    <div className="mt-1 font-semibold text-cyan-700">Projected Depth: {props.depth_m}m</div>
                    <div className="text-emerald-700">AI Confidence: {(props.confidence * 100).toFixed(0)}%</div>
                  </div>
                </Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {/* Centroid Circle Markers */}
        {zones.map((zone) => {
          const isSelected = activeZone?.id === zone.id;
          const color = getRiskColor(isSelected ? currentDepth : 0.2);

          return (
            <CircleMarker
              key={`marker_${zone.id}`}
              center={[zone.center_lat, zone.center_lng]}
              radius={isSelected ? 9 : 5}
              pathOptions={{
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 0.95,
                weight: 2
              }}
              eventHandlers={{
                click: () => selectZone(zone.id)
              }}
            >
              <Popup>
                <div className="text-xs font-sans text-slate-900">
                  <strong className="block text-cyan-800">{zone.name}</strong>
                  <div>City: {zone.city}</div>
                  <div>Elevation: {zone.elevation_avg}m</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Bottom Controls & Zone Switcher Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Monitored Zones Pills */}
        <div className="glass-panel p-1.5 rounded-xl border border-cyan-500/20 flex items-center space-x-1.5 pointer-events-auto shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider hidden md:inline">
            Monitored Basins:
          </span>
          <div className="flex space-x-1 overflow-x-auto max-w-[260px] sm:max-w-md py-0.5">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => selectZone(z.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  activeZone?.id === z.id
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.name.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Upgrades & Switch Actions */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {onSwitchToMapLibre && (
            <button
              onClick={onSwitchToMapLibre}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-bold text-xs flex items-center space-x-1.5 shadow-md transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Try MapLibre 2D</span>
            </button>
          )}

          {onSwitchTo3D && (
            <button
              onClick={onSwitchTo3D}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/25 transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch 3D Twin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
