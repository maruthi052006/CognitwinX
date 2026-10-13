/**
 * FloodOverlayLayer.js
 * Shared GeoJSON styling logic, color scales, and polygon formatting
 * reused across MapLibre GL JS, Leaflet, and OpenLayers map engines.
 */

/**
 * Returns hex color string corresponding to water depth threshold.
 * @param {number} depth - Water depth in meters
 * @returns {string} Hex color
 */
export function getRiskColor(depth) {
  if (depth >= 0.7) return '#f43f5e'; // Severe inundation (Rose / Red)
  if (depth >= 0.4) return '#f59e0b'; // High Risk (Amber)
  if (depth >= 0.2) return '#06b6d4'; // Moderate Pooling (Cyan)
  return '#10b981'; // Normal / Minimal Risk (Emerald)
}

/**
 * Returns human-readable risk category label.
 * @param {number} depth - Water depth in meters
 * @returns {string} Severity label
 */
export function getRiskLabel(depth) {
  if (depth >= 0.7) return 'Severe Inundation (>0.7m)';
  if (depth >= 0.4) return 'High Flood Risk (0.4m - 0.7m)';
  if (depth >= 0.2) return 'Moderate Waterlogging (0.2m - 0.4m)';
  return 'Normal Baseline (<0.2m)';
}

/**
 * Returns RGBA color string with customizable alpha channel.
 * @param {number} depth - Water depth in meters
 * @param {number} alpha - Opacity (0.0 to 1.0)
 * @returns {string} RGBA string
 */
export function getRiskRGBA(depth, alpha = 0.55) {
  if (depth >= 0.7) return `rgba(244, 63, 94, ${alpha})`;
  if (depth >= 0.4) return `rgba(245, 158, 11, ${alpha})`;
  if (depth >= 0.2) return `rgba(6, 182, 212, ${alpha})`;
  return `rgba(16, 185, 129, ${alpha})`;
}

/**
 * Normalizes zone boundary and flood prediction data into standard GeoJSON FeatureCollection.
 * Consumed identically across MapLibre, Leaflet, and OpenLayers layers.
 * 
 * @param {Array} zones - List of CityZone objects from twinStore
 * @param {Object} predictions - Array or dictionary of FloodPrediction objects
 * @param {number|null} selectedZoneId - Currently active zone ID
 * @returns {Object} Standard GeoJSON FeatureCollection
 */
export function buildFloodGeoJSON(zones = [], predictions = [], selectedZoneId = null) {
  const features = [];

  // Index predictions by zone ID for quick lookup
  const predMap = {};
  if (Array.isArray(predictions)) {
    predictions.forEach((p) => {
      if (p && p.zone) predMap[p.zone] = p;
    });
  }

  zones.forEach((zone) => {
    const isSelected = selectedZoneId === zone.id;
    const pred = predMap[zone.id];
    const depth = pred?.predicted_depth_m ?? (isSelected ? 0.42 : 0.15);
    const confidence = pred?.confidence_score ?? 0.88;
    const color = getRiskColor(depth);
    const label = getRiskLabel(depth);

    // 1. If prediction has explicit flood_extent_geojson polygon features
    if (pred?.flood_extent_geojson?.features?.length > 0) {
      pred.flood_extent_geojson.features.forEach((feat, idx) => {
        features.push({
          ...feat,
          id: `flood_extent_${zone.id}_${idx}`,
          properties: {
            ...feat.properties,
            zone_id: zone.id,
            zone_name: zone.name,
            city: zone.city,
            depth_m: depth,
            confidence: confidence,
            risk_color: color,
            risk_label: label,
            is_selected: isSelected,
            criticality: zone.criticality,
            type: 'flood_extent'
          }
        });
      });
    }

    // 2. Main Zone boundary feature from PostGIS CityZone.boundary
    if (zone.boundary && zone.boundary.coordinates) {
      features.push({
        type: 'Feature',
        id: `zone_boundary_${zone.id}`,
        geometry: zone.boundary,
        properties: {
          zone_id: zone.id,
          zone_name: zone.name,
          city: zone.city,
          depth_m: depth,
          confidence: confidence,
          risk_color: color,
          risk_label: label,
          is_selected: isSelected,
          criticality: zone.criticality,
          elevation_avg: zone.elevation_avg,
          type: 'zone_boundary'
        }
      });
    } else {
      // Fallback synthetic square polygon around centroid if PostGIS boundary is null
      const lat = zone.center_lat || 13.0827;
      const lng = zone.center_lng || 80.2707;
      const d = 0.008; // ~850m radius
      features.push({
        type: 'Feature',
        id: `zone_boundary_synth_${zone.id}`,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng - d, lat - d],
            [lng + d, lat - d],
            [lng + d, lat + d],
            [lng - d, lat + d],
            [lng - d, lat - d]
          ]]
        },
        properties: {
          zone_id: zone.id,
          zone_name: zone.name,
          city: zone.city,
          depth_m: depth,
          confidence: confidence,
          risk_color: color,
          risk_label: label,
          is_selected: isSelected,
          criticality: zone.criticality,
          elevation_avg: zone.elevation_avg,
          type: 'zone_boundary'
        }
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Returns point centroid markers for zones.
 */
export function buildZoneMarkersGeoJSON(zones = [], selectedZoneId = null) {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      id: `zone_marker_${z.id}`,
      geometry: {
        type: 'Point',
        coordinates: [z.center_lng || 80.27, z.center_lat || 13.08]
      },
      properties: {
        zone_id: z.id,
        zone_name: z.name,
        city: z.city,
        is_selected: z.id === selectedZoneId,
        criticality: z.criticality,
        elevation_avg: z.elevation_avg
      }
    }))
  };
}

/**
 * Normalizes zone building footprints into valid geographic GeoJSON
 * with heights, building types, and risk coloring for 2D/3D map display.
 */
export function buildBuildingsGeoJSON(activeZone) {
  if (!activeZone) return { type: 'FeatureCollection', features: [] };

  const centerLng = Number(activeZone.center_lng) || 80.2184;
  const centerLat = Number(activeZone.center_lat) || 12.9784;

  const raw = activeZone.building_footprints_geojson;
  const feats = raw?.features || [];

  if (feats.length > 0) {
    const projectedFeatures = feats.map((f, idx) => {
      const props = f.properties || {};
      const geom = f.geometry;
      const bldgType = (props.building_type || props.type || (idx % 5 === 0 ? 'hospital' : (idx % 4 === 0 ? 'commercial' : 'residential'))).toLowerCase();
      const height = Number(props.height_m || props.height || (10 + (idx % 5) * 4));

      let coords = geom?.coordinates;
      let hasGeo = false;

      if (coords && coords.length > 0) {
        const ring = Array.isArray(coords[0][0]) ? coords[0] : coords;
        if (ring.length > 0 && Array.isArray(ring[0])) {
          const [lon, lat] = ring[0];
          if (lon > 60 && lon < 100 && lat > 5 && lat < 40) {
            hasGeo = true;
          }
        }
      }

      if (!hasGeo) {
        let cx = props.x;
        let cy = props.y;
        let w = props.width || 14;
        let d = props.depth || 14;

        if (cx === undefined || cy === undefined) {
          cx = ((idx % 12) - 5.5) * 35;
          cy = (Math.floor(idx / 12) - 5.5) * 35;
        }

        const mToLng = 1 / (111000 * Math.cos(centerLat * Math.PI / 180));
        const mToLat = 1 / 111000;

        const bLon = centerLng + cx * mToLng;
        const bLat = centerLat + cy * mToLat;
        const halfW = (w / 2) * mToLng;
        const halfD = (d / 2) * mToLat;

        coords = [[[
          bLon - halfW, bLat - halfD
        ], [
          bLon + halfW, bLat - halfD
        ], [
          bLon + halfW, bLat + halfD
        ], [
          bLon - halfW, bLat + halfD
        ], [
          bLon - halfW, bLat - halfD
        ]]];
      }

      let color = '#38bdf8';
      if (bldgType === 'hospital') color = '#ef4444';
      else if (bldgType === 'substation' || bldgType === 'pump_station') color = '#f59e0b';
      else if (bldgType === 'commercial') color = '#06b6d4';
      else if (bldgType === 'school') color = '#a855f7';
      else color = '#64748b';

      return {
        type: 'Feature',
        id: props.id || f.id || `bldg_${idx}`,
        geometry: {
          type: 'Polygon',
          coordinates: coords
        },
        properties: {
          id: props.id || f.id || `bldg_${idx}`,
          name: props.name || `${bldgType.toUpperCase()} #${idx + 1}`,
          type: bldgType,
          building_type: bldgType,
          height: height,
          height_m: height,
          color: color,
          is_critical: bldgType === 'hospital' || bldgType === 'substation' || props.isCritical,
          data_provenance: props.data_provenance || ['isro_bhuvan', 'osm_footprints']
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: projectedFeatures
    };
  }

  // Synthesize realistic urban building cluster if raw footprints are empty
  const synthFeatures = [];
  const buildingTypes = [
    { type: 'hospital', name: `${activeZone.name} General Hospital`, height: 28, isCritical: true, color: '#ef4444' },
    { type: 'substation', name: 'TANGEDCO 110kV Substation', height: 12, isCritical: true, color: '#f59e0b' },
    { type: 'pump_station', name: 'SWD Sump & Pumping Station #2', height: 8, isCritical: true, color: '#f59e0b' },
    { type: 'emergency_hq', name: 'Disaster Relief Ops Center', height: 32, isCritical: true, color: '#ef4444' },
    { type: 'commercial', name: 'Tech Park IT Tower Alpha', height: 45, color: '#06b6d4' },
    { type: 'commercial', name: 'Express City Center Plaza', height: 36, color: '#06b6d4' },
    { type: 'school', name: 'Public Higher Secondary School', height: 14, color: '#a855f7' },
    { type: 'residential', name: 'Lakeview Enclave Block A', height: 24, color: '#64748b' },
    { type: 'residential', name: 'Lakeview Enclave Block B', height: 22, color: '#64748b' },
    { type: 'residential', name: 'Green Meadows Residency', height: 18, color: '#64748b' },
    { type: 'residential', name: 'Riverfront Towers Block 1', height: 30, color: '#64748b' },
    { type: 'residential', name: 'Riverfront Towers Block 2', height: 26, color: '#64748b' }
  ];

  const mToLng = 1 / (111000 * Math.cos(centerLat * Math.PI / 180));
  const mToLat = 1 / 111000;

  const offsets = [-140, -90, -40, 40, 90, 140];
  let id = 1;

  offsets.forEach((mx, rx) => {
    offsets.forEach((my, ry) => {
      if (Math.abs(mx) === 40 && Math.abs(my) === 40) return;
      const proto = buildingTypes[(rx * 3 + ry * 5) % buildingTypes.length];
      const w = 18 + ((rx + ry) % 3) * 6;
      const d = 16 + ((rx * ry) % 3) * 6;

      const bLon = centerLng + (mx + ((rx * 7) % 5 - 2) * 5) * mToLng;
      const bLat = centerLat + (my + ((ry * 11) % 5 - 2) * 5) * mToLat;
      const halfW = (w / 2) * mToLng;
      const halfD = (d / 2) * mToLat;

      synthFeatures.push({
        type: 'Feature',
        id: `synth_bldg_${id++}`,
        geometry: {
          type: 'Polygon',
          coordinates: [[[
            bLon - halfW, bLat - halfD
          ], [
            bLon + halfW, bLat - halfD
          ], [
            bLon + halfW, bLat + halfD
          ], [
            bLon - halfW, bLat + halfD
          ], [
            bLon - halfW, bLat - halfD
          ]]]
        },
        properties: {
          id: `synth_bldg_${id}`,
          name: proto.name,
          type: proto.type,
          building_type: proto.type,
          height: proto.height,
          height_m: proto.height,
          color: proto.color,
          is_critical: proto.isCritical || false,
          data_provenance: ['mock_synthetic', 'isro_bhuvan_aligned']
        }
      });
    });
  });

  return {
    type: 'FeatureCollection',
    features: synthFeatures
  };
}
