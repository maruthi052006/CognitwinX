/**
 * photorealisticCoverage.js
 * 
 * Coverage verification and quota-safe validation for Google Photorealistic 3D Tiles.
 * Used by PhotorealisticCityView.jsx and CityTwinScene.jsx to determine whether
 * Layer 1 (Photorealistic 3D Mesh) can be streamed, or if the system must
 * gracefully fall back to Layer 2 (Structured OSM + Microsoft extruded buildings).
 */

const coverageCache = new Map();

/**
 * Checks if a given coordinate or bounding box falls within mainland India.
 * Note: Per Google Maps Platform & Survey of India documentation, dense 3D photogrammetric
 * mesh coverage is currently restricted/unavailable across Indian metros (Chennai, Bengaluru, Mumbai),
 * delivering 2D satellite textures over coarse terrain instead of 3D building geometry.
 */
export function isIndianRegion(lat, lng) {
  return lat >= 8.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5;
}

/**
 * Validates Google Map Tiles API key and checks photorealistic 3D tileset availability for a zone.
 * 
 * @param {Array<number>|Object} bbox - [minLon, minLat, maxLon, maxLat] or { center_lat, center_lng, name }
 * @param {string} [apiKey] - Google Maps Platform API key (defaults to VITE_GOOGLE_MAPS_API_KEY)
 * @returns {Promise<{ available: boolean, reason: string, message: string, isFallback: boolean }>}
 */
export async function checkPhotorealisticCoverage(bbox, apiKey) {
  const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao';

  // Extract center coordinates
  let centerLat = 12.9784;
  let centerLng = 80.2184;
  let zoneName = "Pilot Zone";

  if (Array.isArray(bbox) && bbox.length >= 4) {
    centerLng = (bbox[0] + bbox[2]) / 2;
    centerLat = (bbox[1] + bbox[3]) / 2;
  } else if (bbox && typeof bbox === 'object') {
    centerLat = bbox.center_lat ?? centerLat;
    centerLng = bbox.center_lng ?? centerLng;
    zoneName = bbox.name || zoneName;
  }

  const cacheKey = `${centerLat.toFixed(4)}_${centerLng.toFixed(4)}_${key ? 'key' : 'nokey'}`;
  if (coverageCache.has(cacheKey)) {
    return coverageCache.get(cacheKey);
  }

  // 1. Check if API key is configured
  if (!key || key.trim() === '' || key === 'your_google_maps_platform_api_key_here') {
    const result = {
      available: false,
      reason: 'MISSING_API_KEY',
      message: 'Google Maps Platform API key not configured. Using Layer 2 structured OSM/Microsoft twin.',
      isFallback: true,
      hasKey: false
    };
    coverageCache.set(cacheKey, result);
    return result;
  }

  // 2. Query Google Map Tiles API root tileset endpoint to test key & session initialization
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const testUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`;
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Map Tiles API responded with status ${response.status}`;
      if (response.status === 403) {
        errorMsg = 'Google Maps API key rejected (403 Forbidden). Ensure Map Tiles API is enabled in Google Cloud Console.';
      } else if (response.status === 400) {
        errorMsg = 'Invalid Google Maps API key (400 Bad Request).';
      }

      const result = {
        available: false,
        reason: 'API_ERROR',
        message: `${errorMsg} Defaulting to Layer 2 structured building data.`,
        isFallback: true,
        hasKey: true
      };
      coverageCache.set(cacheKey, result);
      return result;
    }

    const data = await response.json();

    // 3. Inspect if zone is in India with documented mesh limitations
    if (isIndianRegion(centerLat, centerLng)) {
      // Google provides root tileset session, but dense 3D mesh is flat in Indian cities
      const result = {
        available: true,
        isPartialMesh: true,
        reason: 'INDIAN_REGION_TERRAIN_ONLY',
        message: `${zoneName}: Real-world satellite backdrop active. Dense 3D building mesh is restricted in this region; Layer 2 provides authoritative building geometry.`,
        isFallback: false,
        hasKey: true,
        sessionUri: data.root?.content?.uri || null
      };
      coverageCache.set(cacheKey, result);
      return result;
    }

    const result = {
      available: true,
      isPartialMesh: false,
      reason: 'FULL_COVERAGE_AVAILABLE',
      message: 'Photorealistic 3D Tiles available.',
      isFallback: false,
      hasKey: true,
      sessionUri: data.root?.content?.uri || null
    };
    coverageCache.set(cacheKey, result);
    return result;

  } catch (err) {
    const isAbort = err.name === 'AbortError';
    const result = {
      available: false,
      reason: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isAbort
        ? 'Map Tiles API connection timed out. Falling back to Layer 2 structured data.'
        : `Network error connecting to Google Map Tiles API: ${err.message}. Falling back to Layer 2.`,
      isFallback: true,
      hasKey: true
    };
    coverageCache.set(cacheKey, result);
    return result;
  }
}
