import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '../../services/googleMapsLoader';
import { useTwinStore } from '../../store/twinStore';
import { 
  Search, 
  MapPin, 
  Layers, 
  Navigation, 
  AlertTriangle, 
  Droplets, 
  Activity, 
  Hospital, 
  Flame, 
  Car, 
  Maximize2, 
  RefreshCw, 
  Compass,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';

// Custom Dark Tactical Theme for Google Maps matching CognitwinX aesthetics
const DARK_TACTICAL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#090d16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#74829c' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0c1a24' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#065f46' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#182235' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0284c7' }, { weight: 0.8 }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bae6fd' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#131b2e' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#032030' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#031726' }]
  }
];

export default function GoogleMapView({ onSwitchToSimulation }) {
  const mapContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  
  const mapInstanceRef = useRef(null);
  const polygonsRef = useRef([]);
  const markersRef = useRef([]);
  const searchMarkerRef = useRef(null);
  const emergencyMarkersRef = useRef([]);
  const trafficLayerRef = useRef(null);
  const infoWindowRef = useRef(null);

  const { 
    zones, 
    activeZone, 
    selectZone, 
    currentDepth, 
    currentConfidence, 
    currentRainfall 
  } = useTwinStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mapStyleType, setMapStyleType] = useState('dark'); // 'dark' | 'satellite' | 'hybrid' | 'terrain'
  const [showTraffic, setShowTraffic] = useState(false);
  const [activeEmergencyFilter, setActiveEmergencyFilter] = useState(null); // 'hospital' | 'fire_station' | null
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [selectedPlaceInfo, setSelectedPlaceInfo] = useState(null);

  const getRiskColor = (depth) => {
    if (depth >= 0.7) return '#f43f5e'; // Critical red
    if (depth >= 0.4) return '#f59e0b'; // Amber warning
    if (depth >= 0.2) return '#06b6d4'; // Cyan moderate
    return '#10b981'; // Green normal
  };

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      try {
        setLoading(true);
        setLoadError(null);

        const google = await loadGoogleMaps();
        if (!isMounted || !mapContainerRef.current) return;

        const defaultCenter = activeZone 
          ? { lat: activeZone.center_lat, lng: activeZone.center_lng }
          : { lat: 12.9784, lng: 80.2184 }; // Chennai Velachery default

        const map = new google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 14,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: DARK_TACTICAL_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          mapTypeControl: false, // We provide customized glassmorphic HUD controls
          streetViewControl: true,
          streetViewControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();

        // Initialize Places Autocomplete
        if (searchInputRef.current && google.maps.places) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'name', 'formatted_address', 'types'],
          });

          autocomplete.bindTo('bounds', map);

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
              return;
            }

            if (place.geometry.viewport) {
              map.fitBounds(place.geometry.viewport);
            } else {
              map.setCenter(place.geometry.location);
              map.setZoom(16);
            }

            // Place search pin
            if (searchMarkerRef.current) {
              searchMarkerRef.current.setMap(null);
            }

            searchMarkerRef.current = new google.maps.Marker({
              map,
              position: place.geometry.location,
              title: place.name || 'Searched Location',
              animation: google.maps.Animation.DROP,
              icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#38bdf8',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#ffffff',
              },
            });

            setSelectedPlaceInfo({
              name: place.name || 'Custom Location',
              address: place.formatted_address || '',
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });

            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(`
                <div style="background:#090d16; color:#f1f5f9; padding:8px; border-radius:6px; font-family:sans-serif; max-width:220px; font-size:12px;">
                  <strong style="color:#38bdf8; display:block; margin-bottom:4px;">${place.name || 'Selected Place'}</strong>
                  <div style="color:#94a3b8; font-size:11px; margin-bottom:6px;">${place.formatted_address || ''}</div>
                  <span style="display:inline-block; background:#0284c7; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">Google Places Verified</span>
                </div>
              `);
              infoWindowRef.current.open(map, searchMarkerRef.current);
            }
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('[GoogleMapView] Initialization error:', err);
        if (isMounted) {
          setLoadError(err.message || 'Failed to load Google Maps JavaScript API');
          setLoading(false);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
      // Cleanup polygons & markers
      polygonsRef.current.forEach(p => p.setMap(null));
      markersRef.current.forEach(m => m.setMap(null));
      emergencyMarkersRef.current.forEach(m => m.setMap(null));
      if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
      if (trafficLayerRef.current) trafficLayerRef.current.setMap(null);
    };
  }, []);

  // 2. Sync Map Type Style
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (mapStyleType === 'dark') {
      map.setMapTypeId(window.google.maps.MapTypeId.ROADMAP);
      map.setOptions({ styles: DARK_TACTICAL_MAP_STYLE });
    } else if (mapStyleType === 'satellite') {
      map.setMapTypeId(window.google.maps.MapTypeId.SATELLITE);
      map.setOptions({ styles: null });
    } else if (mapStyleType === 'hybrid') {
      map.setMapTypeId(window.google.maps.MapTypeId.HYBRID);
      map.setOptions({ styles: null });
    } else if (mapStyleType === 'terrain') {
      map.setMapTypeId(window.google.maps.MapTypeId.TERRAIN);
      map.setOptions({ styles: null });
    }
  }, [mapStyleType]);

  // 3. Sync Traffic Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
    } else {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    }
  }, [showTraffic]);

  // 4. Render Zones & Flood Depth Overlays
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !google?.maps || !zones || zones.length === 0) return;

    // Clear existing polygons and markers
    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current = [];
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    zones.forEach((zone) => {
      const isSelected = activeZone && activeZone.id === zone.id;
      const zoneDepth = isSelected ? currentDepth : 0.25;
      const riskColor = getRiskColor(zoneDepth);

      // Extract boundary coordinates
      let coords = [];
      if (zone.boundary?.coordinates?.[0]) {
        coords = zone.boundary.coordinates[0].map(c => ({
          lat: c[1],
          lng: c[0]
        }));
      }

      // Draw Polygon if coordinates exist
      if (coords.length > 2) {
        const polygon = new google.maps.Polygon({
          paths: coords,
          strokeColor: isSelected ? '#38bdf8' : '#64748b',
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 3 : 1.5,
          fillColor: riskColor,
          fillOpacity: isSelected ? 0.45 : 0.2,
          map,
          zIndex: isSelected ? 10 : 2,
        });

        polygon.addListener('click', () => {
          selectZone(zone.id);
        });

        polygon.addListener('mouseover', () => {
          polygon.setOptions({ fillOpacity: 0.55 });
        });

        polygon.addListener('mouseout', () => {
          polygon.setOptions({ fillOpacity: isSelected ? 0.45 : 0.2 });
        });

        polygonsRef.current.push(polygon);
      }

      // Center Marker with customized pin
      const marker = new google.maps.Marker({
        position: { lat: zone.center_lat, lng: zone.center_lng },
        map,
        title: zone.name,
        zIndex: isSelected ? 20 : 5,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 9 : 6,
          fillColor: riskColor,
          fillOpacity: 0.95,
          strokeWeight: isSelected ? 3 : 1.5,
          strokeColor: isSelected ? '#ffffff' : '#94a3b8',
        }
      });

      marker.addListener('click', () => {
        selectZone(zone.id);
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="background:#090d16; color:#f1f5f9; padding:10px 12px; border-radius:8px; font-family:'Outfit',sans-serif; min-width:210px; border:1px solid #06b6d4;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <span style="font-weight:800; font-size:13px; color:#ffffff;">${zone.name}</span>
                <span style="font-size:10px; font-weight:bold; text-transform:uppercase; color:${riskColor}; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">
                  ${zone.criticality}
                </span>
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-bottom:6px;">
                City Basin: <strong style="color:#e2e8f0;">${zone.city}</strong> • Avg Elev: <strong style="color:#e2e8f0;">${zone.elevation_avg}m</strong>
              </div>
              <div style="border-top:1px solid #1e293b; padding-top:6px; margin-top:6px; display:flex; justify-content:space-between; font-size:11px;">
                <span style="color:#94a3b8;">Projected Flood Depth:</span>
                <strong style="color:${riskColor}; font-family:monospace; font-size:12px;">${zoneDepth}m</strong>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:3px;">
                <span style="color:#94a3b8;">AI Model Confidence:</span>
                <strong style="color:#10b981; font-family:monospace;">${(currentConfidence * 100).toFixed(0)}%</strong>
              </div>
            </div>
          `);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.push(marker);
    });
  }, [zones, activeZone?.id, currentDepth, currentConfidence]);

  // 5. Pan smoothly when activeZone changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeZone) return;

    map.panTo({ lat: activeZone.center_lat, lng: activeZone.center_lng });
  }, [activeZone?.id]);

  // 6. Emergency Facilities Search using Google Places API (Hospitals / Fire Stations)
  const searchEmergencyFacilities = useCallback((type) => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !google?.maps?.places || !activeZone) return;

    // Toggle off if already selected
    if (activeEmergencyFilter === type) {
      setActiveEmergencyFilter(null);
      emergencyMarkersRef.current.forEach(m => m.setMap(null));
      emergencyMarkersRef.current = [];
      setEmergencyCount(0);
      return;
    }

    setActiveEmergencyFilter(type);
    emergencyMarkersRef.current.forEach(m => m.setMap(null));
    emergencyMarkersRef.current = [];

    const service = new google.maps.places.PlacesService(map);
    const request = {
      location: new google.maps.LatLng(activeZone.center_lat, activeZone.center_lng),
      radius: 4000, // 4km radius
      type: type // 'hospital' or 'fire_station'
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setEmergencyCount(results.length);
        results.forEach((place) => {
          if (!place.geometry || !place.geometry.location) return;

          const marker = new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: type === 'hospital' ? '#10b981' : '#f97316',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }
          });

          marker.addListener('click', () => {
            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(`
                <div style="background:#090d16; color:#f1f5f9; padding:8px 10px; border-radius:6px; font-family:sans-serif; max-width:220px; font-size:12px;">
                  <span style="font-size:9px; text-transform:uppercase; font-weight:bold; color:${type === 'hospital' ? '#10b981' : '#f97316'};">
                    ${type === 'hospital' ? 'Emergency Medical Center' : 'Fire & Disaster Rescue'}
                  </span>
                  <strong style="display:block; font-size:13px; color:#fff; margin-top:2px;">${place.name}</strong>
                  <div style="color:#94a3b8; font-size:11px; margin-top:4px;">${place.vicinity || ''}</div>
                  ${place.rating ? `<div style="color:#fbbf24; font-size:10px; margin-top:4px;">★ ${place.rating} / 5</div>` : ''}
                </div>
              `);
              infoWindowRef.current.open(map, marker);
            }
          });

          emergencyMarkersRef.current.push(marker);
        });
      } else {
        setEmergencyCount(0);
      }
    });
  }, [activeZone, activeEmergencyFilter]);

  // Recenter map back to active zone
  const handleRecenter = () => {
    if (mapInstanceRef.current && activeZone) {
      mapInstanceRef.current.panTo({ lat: activeZone.center_lat, lng: activeZone.center_lng });
      mapInstanceRef.current.setZoom(14);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#070b14] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl flex flex-col">
      {/* Top Search & Controls HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Google Places Autocomplete Search Box */}
        <div className="flex items-center space-x-2 pointer-events-auto flex-1 max-w-md">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search ward, address, or shelter (Google Places)..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-900/90 text-slate-100 placeholder-slate-400 border border-cyan-500/30 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-xl backdrop-blur-md transition-all"
            />
            {selectedPlaceInfo && (
              <button 
                onClick={() => {
                  setSelectedPlaceInfo(null);
                  if (searchInputRef.current) searchInputRef.current.value = '';
                  if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Map Layers & Operational Filters */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Map Style Switcher (Dark Tactical, Satellite, Hybrid, Terrain) */}
          <div className="glass-panel p-1 rounded-xl border border-cyan-500/30 flex items-center space-x-1 text-xs shadow-xl backdrop-blur-md">
            <button
              onClick={() => setMapStyleType('dark')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mapStyleType === 'dark'
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Custom Dark Tactical Cartography"
            >
              Dark
            </button>
            <button
              onClick={() => setMapStyleType('satellite')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mapStyleType === 'satellite'
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="High-Res Google Satellite Imagery"
            >
              Satellite
            </button>
            <button
              onClick={() => setMapStyleType('hybrid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mapStyleType === 'hybrid'
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Satellite with Streets & Labels"
            >
              Hybrid
            </button>
            <button
              onClick={() => setMapStyleType('terrain')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mapStyleType === 'terrain'
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Topographical Elevation Contours"
            >
              Terrain
            </button>
          </div>

          {/* Traffic Toggle */}
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xl backdrop-blur-md ${
              showTraffic
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-emerald-500/20'
                : 'glass-panel text-slate-300 border-cyan-500/30 hover:border-cyan-400'
            }`}
            title="Toggle Live Google Traffic Layer"
          >
            <Car className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Traffic</span>
          </button>

          {/* Nearby Hospitals Filter */}
          <button
            onClick={() => searchEmergencyFacilities('hospital')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xl backdrop-blur-md ${
              activeEmergencyFilter === 'hospital'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : 'glass-panel text-slate-300 border-cyan-500/30 hover:border-cyan-400'
            }`}
            title="Find Hospitals & Medical Centers via Google Places"
          >
            <Hospital className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Hospitals</span>
            {activeEmergencyFilter === 'hospital' && emergencyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-black font-mono font-bold text-[10px]">
                {emergencyCount}
              </span>
            )}
          </button>

          {/* Nearby Fire & Rescue Filter */}
          <button
            onClick={() => searchEmergencyFacilities('fire_station')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xl backdrop-blur-md ${
              activeEmergencyFilter === 'fire_station'
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                : 'glass-panel text-slate-300 border-cyan-500/30 hover:border-cyan-400'
            }`}
            title="Find Fire & Rescue Stations via Google Places"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Rescue</span>
            {activeEmergencyFilter === 'fire_station' && emergencyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-mono font-bold text-[10px]">
                {emergencyCount}
              </span>
            )}
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className="p-2 rounded-xl glass-panel text-slate-300 border border-cyan-500/30 hover:border-cyan-400 hover:text-cyan-300 transition-all shadow-xl"
            title="Recenter on Active Basin"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Telemetry HUD (Top-Right Sub-Bar) */}
      <div className="absolute top-16 right-3 z-10 glass-panel p-2.5 rounded-xl border border-cyan-500/20 flex items-center space-x-3 text-xs shadow-2xl backdrop-blur-md pointer-events-auto">
        <div className="flex items-center space-x-1.5">
          <Droplets className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">Depth</div>
            <div className="font-bold text-white text-sm font-mono">{currentDepth}m</div>
          </div>
        </div>
        <div className="h-6 w-px bg-slate-700" />
        <div className="flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">Confidence</div>
            <div className="font-bold text-white text-sm font-mono">{(currentConfidence * 100).toFixed(0)}%</div>
          </div>
        </div>
        <div className="h-6 w-px bg-slate-700 hidden sm:block" />
        <div className="hidden sm:flex items-center space-x-1.5">
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            Google Maps API
          </span>
        </div>
      </div>

      {/* Main Google Maps Canvas */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full flex-1 z-0" 
        style={{ minHeight: '440px' }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#070b14]/90 z-30 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <div className="text-xs font-mono text-cyan-300">Initializing Google Maps Platform & Places API...</div>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-[#070b14]/95 z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Google Maps Integration Notice</h3>
          <p className="text-xs text-slate-300 max-w-md">{loadError}</p>
          {onSwitchToSimulation && (
            <button
              onClick={onSwitchToSimulation}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-all shadow-lg"
            >
              Switch to 3D Hydrodynamic Twin
            </button>
          )}
        </div>
      )}

      {/* Bottom Zone Switcher Bar */}
      <div className="p-2.5 glass-panel border-t border-cyan-500/20 flex items-center justify-between z-10 text-xs backdrop-blur-md">
        <div className="flex items-center space-x-2 text-slate-400 font-medium px-2">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Monitored Basins:</span>
        </div>
        <div className="flex space-x-2 overflow-x-auto py-0.5">
          {zones?.map((z) => (
            <button
              key={z.id}
              onClick={() => selectZone(z.id)}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-all font-medium ${
                activeZone?.id === z.id
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/40'
              }`}
            >
              {z.name.split(' - ')[0]} ({z.city})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
