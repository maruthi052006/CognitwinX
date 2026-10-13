import React, { useEffect, useRef, useState } from 'react';
import { Map, NavigationControl, ScaleControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTwinStore } from '../../store/twinStore';
import { buildFloodGeoJSON, buildZoneMarkersGeoJSON, buildBuildingsGeoJSON, getRiskColor, getRiskLabel } from './FloodOverlayLayer';
import { 
  Droplets, 
  Activity, 
  Layers, 
  ShieldAlert, 
  Maximize2, 
  Compass, 
  Eye, 
  Sparkles,
  Info,
  Building2
} from 'lucide-react';

const STYLES = {
  dark: {
    name: 'Carto / Dark Vector',
    url: 'https://tiles.openfreemap.org/styles/dark'
  },
  liberty: {
    name: 'OpenFreeMap Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty'
  },
  bright: {
    name: 'OpenFreeMap Bright',
    url: 'https://tiles.openfreemap.org/styles/bright'
  },
  positron: {
    name: 'Positron Clean',
    url: 'https://tiles.openfreemap.org/styles/positron'
  }
};

export default function MapLibreFallback2D({ reason, onSwitchTo3D, customTitle }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const { zones, activeZone, selectZone, predictions, currentDepth, currentConfidence } = useTwinStore();
  
  const [currentStyle, setCurrentStyle] = useState('dark');
  const [floodOpacity, setFloodOpacity] = useState(0.65);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredZone, setHoveredZone] = useState(null);

  const centerLng = Number(activeZone?.center_lng) || 80.2184;
  const centerLat = Number(activeZone?.center_lat) || 12.9784;

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create MapLibre Map instance with zero-key vector tiles
    const map = new Map({
      container: mapContainerRef.current,
      style: STYLES[currentStyle].url,
      center: [centerLng, centerLat],
      zoom: 14.2,
      pitch: 45,
      bearing: -15,
      attributionControl: false
    });

    // Add navigation controls (Zoom, Pitch, Compass)
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15,
      className: 'maplibre-twin-popup'
    });

    popupRef.current = popup;

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);

      const floodGeoJSON = buildFloodGeoJSON(zones, predictions, activeZone?.id);
      const markerGeoJSON = buildZoneMarkersGeoJSON(zones, activeZone?.id);
      const buildingGeoJSON = buildBuildingsGeoJSON(activeZone);

      // 1. Add Flood Extent & Boundaries GeoJSON Source
      map.addSource('flood-zones-source', {
        type: 'geojson',
        data: floodGeoJSON
      });

      // 2. Add Fill Layer (Water Pooling & Inundation Extent)
      map.addLayer({
        id: 'flood-fill-layer',
        type: 'fill',
        source: 'flood-zones-source',
        paint: {
          'fill-color': [
            'case',
            ['has', 'risk_color'],
            ['get', 'risk_color'],
            '#06b6d4'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            floodOpacity,
            floodOpacity * 0.5
          ]
        }
      });

      // 3. Add Outline Layer
      map.addLayer({
        id: 'flood-line-layer',
        type: 'line',
        source: 'flood-zones-source',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            '#38bdf8',
            '#64748b'
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            3,
            1.5
          ],
          'line-dasharray': [2, 1]
        }
      });

      // 4. Add Buildings GeoJSON Source & 3D Extrusion Layer
      map.addSource('buildings-source', {
        type: 'geojson',
        data: buildingGeoJSON
      });

      // 3D Extruded Building Meshes
      map.addLayer({
        id: 'buildings-extrusion-layer',
        type: 'fill-extrusion',
        source: 'buildings-source',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['has', 'color'],
            ['get', 'color'],
            '#38bdf8'
          ],
          'fill-extrusion-height': [
            'coalesce',
            ['get', 'height_m'],
            ['get', 'height'],
            18
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.90
        }
      });

      // Building 2D Footprint Outline
      map.addLayer({
        id: 'buildings-outline-layer',
        type: 'line',
        source: 'buildings-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      });

      // 5. Centroid Point Markers Source & Layer
      map.addSource('zone-centroids-source', {
        type: 'geojson',
        data: markerGeoJSON
      });

      map.addLayer({
        id: 'zone-centroids-circle',
        type: 'circle',
        source: 'zone-centroids-source',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            9,
            5
          ],
          'circle-color': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            '#06b6d4',
            '#94a3b8'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Hover interaction on buildings
      map.on('mousemove', 'buildings-extrusion-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          const height = props.height_m || props.height || 18;
          const depthVal = currentDepth || 0.25;
          const isAtRisk = depthVal > 0.3;

          popup.setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#090d16; color:#f8fafc; padding:9px 12px; border-radius:10px; border:1px solid ${props.color || '#38bdf8'}; font-family:sans-serif; font-size:11px; box-shadow:0 12px 30px rgba(0,0,0,0.6); min-width:180px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;">
                  <span style="font-weight:bold; font-size:12px; color:#fff;">${props.name || 'Urban Asset'}</span>
                  <span style="font-size:10px; font-weight:bold; color:#38bdf8; font-family:monospace;">${height}m</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                  <span style="background:${props.color || '#0284c7'}33; color:${props.color || '#38bdf8'}; padding:2px 6px; border-radius:4px; font-size:9px; text-transform:uppercase; font-weight:bold;">
                    ${props.type || props.building_type || 'Structure'}
                  </span>
                  <span style="color:#94a3b8; font-size:10px;">${props.is_critical ? '⚡ Critical Infrastructure' : 'Urban Typology'}</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:4px; display:flex; justify-content:space-between; font-size:10px;">
                  <span style="color:#94a3b8;">Hydraulic Risk:</span>
                  <span style="color:${isAtRisk ? '#ef4444' : '#10b981'}; font-weight:bold;">${isAtRisk ? 'Water Ingress Warning' : 'Safe Plinth Height'}</span>
                </div>
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'buildings-extrusion-layer', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Hover interactions on flood zone
      map.on('mousemove', 'flood-fill-layer', (e) => {
        // Only trigger zone popup if not directly hovering a building
        const bldgFeats = map.queryRenderedFeatures(e.point, { layers: ['buildings-extrusion-layer'] });
        if (bldgFeats.length > 0) return;

        map.getCanvas().style.cursor = 'pointer';
        if (e.features.length > 0) {
          const feat = e.features[0];
          const props = feat.properties;
          setHoveredZone(props);

          const depth = props.depth_m || 0.2;
          const conf = props.confidence ? (props.confidence * 100).toFixed(0) : '89';

          popup.setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#090d16; color:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #06b6d4; font-family:sans-serif; font-size:11px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="font-weight:bold; font-size:12px; color:#38bdf8; margin-bottom:2px;">${props.zone_name}</div>
                <div style="color:#94a3b8; margin-bottom:4px;">Criticality: <span style="color:#fff; text-transform:capitalize;">${props.criticality || 'Standard'}</span></div>
                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <span>Depth: <b style="color:${props.risk_color || '#06b6d4'}">${depth}m</b></span>
                  <span>AI Conf: <b style="color:#10b981">${conf}%</b></span>
                </div>
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'flood-fill-layer', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
        setHoveredZone(null);
      });

      // Click to select zone
      map.on('click', 'flood-fill-layer', (e) => {
        if (e.features.length > 0) {
          const zoneId = e.features[0].properties.zone_id;
          if (zoneId) selectZone(Number(zoneId));
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [currentStyle]);

  // Update GeoJSON data and fly to zone when activeZone or predictions change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    const floodSource = map.getSource('flood-zones-source');
    const centroidSource = map.getSource('zone-centroids-source');
    const buildingSource = map.getSource('buildings-source');

    if (floodSource) {
      floodSource.setData(buildFloodGeoJSON(zones, predictions, activeZone?.id));
    }
    if (centroidSource) {
      centroidSource.setData(buildZoneMarkersGeoJSON(zones, activeZone?.id));
    }
    if (buildingSource) {
      buildingSource.setData(buildBuildingsGeoJSON(activeZone));
    }

    if (activeZone) {
      map.flyTo({
        center: [Number(activeZone.center_lng), Number(activeZone.center_lat)],
        zoom: 14.2,
        pitch: showBuildings ? 45 : 15,
        essential: true,
        duration: 1200
      });
    }
  }, [activeZone?.id, zones, predictions, mapLoaded]);

  // Update opacity dynamically
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer('flood-fill-layer')) {
      map.setPaintProperty('flood-fill-layer', 'fill-opacity', [
        'case',
        ['boolean', ['get', 'is_selected'], false],
        floodOpacity,
        floodOpacity * 0.5
      ]);
    }
  }, [floodOpacity, mapLoaded]);

  // Update boundary visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer('flood-line-layer')) {
      map.setLayoutProperty('flood-line-layer', 'visibility', showBoundaries ? 'visible' : 'none');
    }
  }, [showBoundaries, mapLoaded]);

  // Update building visibility and camera pitch
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const vis = showBuildings ? 'visible' : 'none';
    if (map.getLayer('buildings-extrusion-layer')) {
      map.setLayoutProperty('buildings-extrusion-layer', 'visibility', vis);
    }
    if (map.getLayer('buildings-outline-layer')) {
      map.setLayoutProperty('buildings-outline-layer', 'visibility', vis);
    }
    map.easeTo({
      pitch: showBuildings ? 45 : 10,
      duration: 600
    });
  }, [showBuildings, mapLoaded]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#070b14] rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl flex flex-col select-none">
      
      {/* Top Banner & Mode Badge */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-cyan-500/40 flex items-center space-x-2 text-xs shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white tracking-wide uppercase text-[11px]">
            {customTitle || 'MapLibre GL JS — Geospatial Engine'}
          </span>
          <span className="text-slate-400 text-[10px] hidden sm:inline">
            | {reason || '3D Vector Buildings & Flood Inundation'}
          </span>
        </div>

        {/* Style Switcher Dropdown */}
        <div className="glass-panel px-2 py-1 rounded-xl border border-slate-700/60 flex items-center space-x-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <select
            value={currentStyle}
            onChange={(e) => setCurrentStyle(e.target.value)}
            className="bg-transparent text-slate-200 text-[11px] font-semibold focus:outline-none cursor-pointer pr-1"
          >
            {Object.entries(STYLES).map(([key, s]) => (
              <option key={key} value={key} className="bg-slate-900 text-slate-100">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3D Buildings Toggle */}
        <button
          onClick={() => setShowBuildings(!showBuildings)}
          className={`glass-panel px-2.5 py-1 rounded-xl border flex items-center space-x-1.5 text-xs transition-all ${
            showBuildings
              ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-md shadow-cyan-500/20'
              : 'border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Toggle 3D Extruded Buildings"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className="font-bold text-[11px]">3D Buildings</span>
          <span className={`w-1.5 h-1.5 rounded-full ${showBuildings ? 'bg-cyan-400' : 'bg-slate-600'}`} />
        </button>
      </div>

      {/* Top Right Stats HUD */}
      <div className="absolute top-3 right-12 z-20 glass-panel p-2.5 rounded-xl border border-cyan-500/30 flex items-center space-x-4 text-xs shadow-xl backdrop-blur-md pointer-events-auto hidden sm:flex">
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
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">Attention U-Net</div>
            <div className="font-bold text-emerald-300 font-mono">{(currentConfidence * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Bottom Floating Map Toolbar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Monitored Zones Picker Pill */}
        <div className="glass-panel p-1.5 rounded-xl border border-cyan-500/30 flex items-center space-x-1.5 pointer-events-auto shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider hidden md:inline">
            Monitored Basins:
          </span>
          <div className="flex space-x-1 overflow-x-auto max-w-[280px] sm:max-w-md py-0.5">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => selectZone(z.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  activeZone?.id === z.id
                    ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.name.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity & 3D Switch Action */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Opacity slider */}
          <div className="glass-panel px-2.5 py-1.5 rounded-xl border border-cyan-500/20 flex items-center space-x-2 text-xs">
            <span className="text-[10px] text-slate-400">Flood Alpha:</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={floodOpacity}
              onChange={(e) => setFloodOpacity(parseFloat(e.target.value))}
              className="w-16 accent-cyan-400 cursor-pointer h-1"
            />
          </div>

          {onSwitchTo3D && (
            <button
              onClick={onSwitchTo3D}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/25 transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch 3D WebGL Twin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
