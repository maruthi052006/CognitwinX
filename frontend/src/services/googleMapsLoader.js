/**
 * googleMapsLoader.js
 * 
 * Singleton loader for Google Maps JavaScript API with Places library.
 * Loads: https://maps.googleapis.com/maps/api/js?key=...&libraries=places
 */

let mapsPromise = null;

export const DEFAULT_GOOGLE_MAPS_API_KEY = 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao';

export function getGoogleMapsApiKey() {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && envKey !== 'your_google_maps_platform_api_key_here' && envKey.trim() !== '') {
    return envKey.trim();
  }
  return DEFAULT_GOOGLE_MAPS_API_KEY;
}

/**
 * Asynchronously loads the Google Maps JavaScript API with Places library.
 * Safe to call multiple times; returns the same pending/resolved Promise.
 * 
 * @param {string} [customKey] Optional override key
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps(customKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in a browser environment.'));
  }

  // If already loaded and ready with places library
  if (window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve(window.google.maps);
  }

  if (mapsPromise) {
    return mapsPromise;
  }

  mapsPromise = new Promise((resolve, reject) => {
    const key = customKey || getGoogleMapsApiKey();
    const callbackName = `__cognitwinx_init_gmap_${Date.now()}`;

    // Set up global callback
    window[callbackName] = () => {
      try {
        delete window[callbackName];
      } catch (e) {
        window[callbackName] = undefined;
      }
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps script finished but google.maps object is missing.'));
      }
    };

    // Also support global initMap in case external scripts expect it
    if (!window.initMap) {
      window.initMap = () => {
        if (window[callbackName]) {
          window[callbackName]();
        }
      };
    }

    // Check if script tag is already in DOM
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener('load', () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        }
      });
      existing.addEventListener('error', (err) => {
        mapsPromise = null;
        reject(new Error('Failed to load Google Maps script from DOM'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;

    // Safety timeout (12 seconds)
    const timeoutTimer = setTimeout(() => {
      if (!window.google || !window.google.maps) {
        mapsPromise = null;
        try {
          delete window[callbackName];
        } catch (e) {}
        reject(new Error('Google Maps load timeout. Check your internet connection or API key restriction.'));
      }
    }, 12000);

    script.onload = () => {
      clearTimeout(timeoutTimer);
      // Wait briefly for callback to fire if loading=async
      setTimeout(() => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        }
      }, 50);
    };

    script.onerror = (e) => {
      clearTimeout(timeoutTimer);
      mapsPromise = null;
      try {
        delete window[callbackName];
      } catch (err) {}
      reject(new Error('Network error loading Google Maps JavaScript API.'));
    };

    document.head.appendChild(script);
  });

  return mapsPromise;
}
