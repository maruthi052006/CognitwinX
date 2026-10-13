import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { fromLonLat, transformExtent } from 'ol/proj';
import { useTwinStore } from '../../store/twinStore';
import { api } from '../../services/api';
import { buildFloodGeoJSON, getRiskRGBA } from './FloodOverlayLayer';
import { 
  Satellite, 
  Layers, 
  Shield, 
  ExternalLink, 
  RefreshCw, 
  Sliders, 
  Droplets, 
  Activity, 
  Eye, 
  Database,
  MapPin,
  Sparkles
} from 'lucide-react';

const DEFAULT_BHUVAN_LAYERS = [
  {
    id: 'bhuvan_satellite',
    name: 'india3',
    title: 'ISRO Bhuvan National Satellite Base (india3)',
    category: 'Satellite Base',
    url: 'https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms',
    abstract: 'High-resolution multi-spectral base imagery covering Indian subcontinent.'
  },
  {
    id: 'bhuvan_hazard',
    name: 'as_hz',
    title: 'ISRO NRSC Flood Hazard Zoning (as_hz)',
    category: 'Flood Hazard',
    url: 'https://bhuvan-ras2.nrsc.gov.in/cgi-bin/hazard.exe',
    abstract: 'Historical flood frequency and hazard vulnerability zoning map.'
  },
  {
    id: 'bhuvan_flood_annual_tn',
    name: 'tn_011112_flood',
    title: 'Tamil Nadu / Chennai Flood Inundation Layer',
    category: 'Annual Flood Layers',
    url: 'https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe',
    abstract: 'Satellite-derived inundated extent during major coastal monsoon event.'
  },
  {
    id: 'bhuvan_flood_master',
    name: 'Flood',
    title: 'National Flood Inundation Master Layer',
    category: 'Annual Flood Layers',
    url: 'https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe',
    abstract: 'Consolidated national flood inundation vector & raster dataset.'
  },
  {
    id: 'bhuvan_lulc_50k',
    name: 'LULC50K_1516',
    title: 'ISRO LULC 1:50,000 Land Use & Land Cover',
    category: 'Urban LULC & Hydrology',
    url: 'https://bhuvan-thematic.nrsc.gov.in/bhuvan/wms',
    abstract: 'High precision land use classification: urban built-up, water bodies, wetlands.'
  }
];

export default function BhuvanWMSView({ onSwitchTo3D }) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const wmsLayerRef = useRef(null);
  const vectorLayerRef = useRef(null);

  const { zones, activeZone, selectZone, predictions, currentDepth, currentConfidence } = useTwinStore();

  const [availableLayers, setAvailableLayers] = useState(DEFAULT_BHUVAN_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState('bhuvan_satellite');
  const [wmsOpacity, setWmsOpacity] = useState(0.85);
  const [showTwinOverlay, setShowTwinOverlay] = useState(true);
  const [loadingCap, setLoadingCap] = useState(false);
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [bhuvanMetadata, setBhuvanMetadata] = useState(null);

  const activeLayerConfig = availableLayers.find((l) => l.id === selectedLayerId) || availableLayers[0];

  // Fetch live capabilities from backend
  useEffect(() => {
    async function loadCapabilities() {
      setLoadingCap(true);
      try {
        const data = await api.getBhuvanCapabilities();
        if (data?.layers?.length > 0) {
          setAvailableLayers(data.layers);
          setBhuvanMetadata(data);
        }
      } catch (err) {
        console.warn('[BhuvanWMSView] Using default verified ISRO layer catalog:', err);
      } finally {
        setLoadingCap(false);
      }
    }
    loadCapabilities();
  }, []);

  // Initialize OpenLayers map instance
  useEffect(() => {
    if (!mapElementRef.current) return;

    const center = fromLonLat([
      activeZone?.center_lng || 80.2184,
      activeZone?.center_lat || 12.9784
    ]);

    // 1. Dark OSM / Carto base tile layer
    const baseLayer = new TileLayer({
      source: new OSM({
        url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      })
    });

    // 2. ISRO Bhuvan WMS Tile Layer (using secure Django proxy to preserve server-side token)
    const proxyUrl = api.getBhuvanWmsProxyUrl();
    const wmsSource = new TileWMS({
      url: proxyUrl,
      params: {
        'LAYERS': activeLayerConfig.name,
        'WMS_URL': activeLayerConfig.url,
        'TILED': true,
        'VERSION': '1.1.1',
        'FORMAT': 'image/png',
        'TRANSPARENT': 'true'
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });

    const wmsLayer = new TileLayer({
      source: wmsSource,
      opacity: wmsOpacity
    });
    wmsLayerRef.current = wmsLayer;

    // 3. Digital Twin GeoJSON Vector Overlay Layer
    const floodGeoJSON = buildFloodGeoJSON(zones, predictions, activeZone?.id);
    const vectorSource = new VectorSource({
      features: new GeoJSON({
        featureProjection: 'EPSG:3857'
      }).readFeatures(floodGeoJSON)
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const props = feature.getProperties();
        const depth = props.depth_m || 0.2;
        const isSelected = props.is_selected;

        return new Style({
          fill: new Fill({
            color: getRiskRGBA(depth, isSelected ? 0.6 : 0.25)
          }),
          stroke: new Stroke({
            color: isSelected ? '#38bdf8' : '#64748b',
            width: isSelected ? 2.5 : 1,
            lineDash: isSelected ? [4, 4] : undefined
          })
        });
      },
      visible: showTwinOverlay
    });
    vectorLayerRef.current = vectorLayer;

    // 4. Create OpenLayers Map
    const map = new Map({
      target: mapElementRef.current,
      layers: [baseLayer, wmsLayer, vectorLayer],
      view: new View({
        center,
        zoom: 13,
        maxZoom: 19,
        minZoom: 4
      }),
      controls: []
    });

    mapInstanceRef.current = map;

    return () => {
      map.setTarget(null);
      mapInstanceRef.current = null;
    };
  }, []);

  // Update WMS Layer source params when selected layer changes
  useEffect(() => {
    if (!wmsLayerRef.current || !activeLayerConfig) return;
    const proxyUrl = api.getBhuvanWmsProxyUrl();
    const newSource = new TileWMS({
      url: proxyUrl,
      params: {
        'LAYERS': activeLayerConfig.name,
        'WMS_URL': activeLayerConfig.url,
        'TILED': true,
        'VERSION': '1.1.1',
        'FORMAT': 'image/png',
        'TRANSPARENT': 'true'
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });
    wmsLayerRef.current.setSource(newSource);
  }, [selectedLayerId, activeLayerConfig]);

  // Update Opacity
  useEffect(() => {
    if (wmsLayerRef.current) {
      wmsLayerRef.current.setOpacity(wmsOpacity);
    }
  }, [wmsOpacity]);

  // Update Overlay visibility
  useEffect(() => {
    if (vectorLayerRef.current) {
      vectorLayerRef.current.setVisible(showTwinOverlay);
    }
  }, [showTwinOverlay]);

  // Re-center map when activeZone changes
  useEffect(() => {
    if (!mapInstanceRef.current || !activeZone) return;
    const center = fromLonLat([activeZone.center_lng, activeZone.center_lat]);
    mapInstanceRef.current.getView().animate({
      center,
      zoom: 13.5,
      duration: 1000
    });

    // Update GeoJSON features in vector source
    if (vectorLayerRef.current) {
      const floodGeoJSON = buildFloodGeoJSON(zones, predictions, activeZone?.id);
      const newSource = new VectorSource({
        features: new GeoJSON({
          featureProjection: 'EPSG:3857'
        }).readFeatures(floodGeoJSON)
      });
      vectorLayerRef.current.setSource(newSource);
    }
  }, [activeZone?.id, zones, predictions]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#070b14] rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl flex flex-col select-none">
      
      {/* Top Banner & ISRO Bhuvan Provenance Badge */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3.5 py-1.5 rounded-xl border border-emerald-500/40 flex items-center space-x-2 text-xs shadow-xl backdrop-blur-md">
          <Satellite className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-emerald-300 tracking-wide uppercase text-[11px]">
            OpenLayers — ISRO Bhuvan WMS Gateway
          </span>
          <span className="text-slate-400 text-[10px] hidden sm:inline">
            | NRSC Thematic Services
          </span>
        </div>

        {/* WMS Thematic Layer Selector */}
        <div className="glass-panel px-2.5 py-1 rounded-xl border border-slate-700/60 flex items-center space-x-1.5 text-xs">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={selectedLayerId}
            onChange={(e) => setSelectedLayerId(e.target.value)}
            className="bg-transparent text-slate-200 text-[11px] font-semibold focus:outline-none cursor-pointer max-w-[200px] sm:max-w-xs"
          >
            {availableLayers.map((l) => (
              <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                [{l.category}] {l.title}
              </option>
            ))}
          </select>
        </div>

        {/* Catalog Inspector Button */}
        <button
          onClick={() => setShowCatalogDrawer(!showCatalogDrawer)}
          className="glass-panel px-2.5 py-1.5 rounded-xl border border-cyan-500/30 text-cyan-300 hover:text-white text-[11px] font-semibold flex items-center space-x-1.5 transition-all"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Catalog ({availableLayers.length})</span>
        </button>
      </div>

      {/* Top Right Stats HUD */}
      <div className="absolute top-3 right-3 z-20 glass-panel p-2.5 rounded-xl border border-emerald-500/30 flex items-center space-x-4 text-xs shadow-xl backdrop-blur-md pointer-events-auto hidden sm:flex">
        <div className="flex items-center space-x-1.5">
          <Droplets className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">Depth (U-Net)</div>
            <div className="font-bold text-white font-mono">{currentDepth}m</div>
          </div>
        </div>
        <div className="h-5 w-px bg-slate-700" />
        <div className="flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">NRSC Protocol</div>
            <div className="font-bold text-emerald-300 font-mono">OGC WMS 1.1.1</div>
          </div>
        </div>
      </div>

      {/* Main OpenLayers Container */}
      <div ref={mapElementRef} className="w-full h-full flex-1" />

      {/* Slide-out Layer Catalog & Metadata Drawer */}
      {showCatalogDrawer && (
        <div className="absolute top-14 left-3 z-30 w-80 max-h-[360px] overflow-y-auto glass-panel-glow rounded-2xl border border-emerald-500/40 p-3 shadow-2xl backdrop-blur-xl text-xs space-y-2.5 pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> ISRO Bhuvan Layer Catalog
            </span>
            <button
              onClick={() => setShowCatalogDrawer(false)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Discovered dynamically from NRSC WMS endpoints. Click any thematic layer to stream:
          </p>
          <div className="space-y-1.5">
            {availableLayers.map((l) => (
              <div
                key={l.id}
                onClick={() => {
                  setSelectedLayerId(l.id);
                  setShowCatalogDrawer(false);
                }}
                className={`p-2 rounded-xl border cursor-pointer transition-all ${
                  selectedLayerId === l.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <span>{l.title}</span>
                  <span className="text-[9px] font-mono text-emerald-400">{l.name}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{l.abstract}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Floating Toolbar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Basin Switcher */}
        <div className="glass-panel p-1.5 rounded-xl border border-emerald-500/30 flex items-center space-x-1.5 pointer-events-auto shadow-xl">
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
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.name.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Layer Controls & Twin Overlay Toggle */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* WMS Opacity */}
          <div className="glass-panel px-2.5 py-1.5 rounded-xl border border-emerald-500/20 flex items-center space-x-2 text-xs">
            <span className="text-[10px] text-slate-400">WMS Opacity:</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={wmsOpacity}
              onChange={(e) => setWmsOpacity(parseFloat(e.target.value))}
              className="w-16 accent-emerald-400 cursor-pointer h-1"
            />
          </div>

          {/* AI Overlay toggle */}
          <button
            onClick={() => setShowTwinOverlay(!showTwinOverlay)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              showTwinOverlay
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>AI Flood Poly</span>
          </button>

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
