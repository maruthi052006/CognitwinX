/**
 * cesiumLoader.js
 * 
 * Asynchronous on-demand loader for CesiumJS runtime.
 * Injects CesiumJS and its styling only when the photorealistic 3D view is activated,
 * keeping the initial application bundle lightweight and resilient.
 */

let cesiumLoadingPromise = null;

export function loadCesium() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cesium can only be loaded in a browser environment.'));
  }

  if (window.Cesium) {
    return Promise.resolve(window.Cesium);
  }

  if (cesiumLoadingPromise) {
    return cesiumLoadingPromise;
  }

  cesiumLoadingPromise = new Promise((resolve, reject) => {
    // Set base URL for Cesium assets (Workers, Assets, Widgets)
    window.CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium';

    // 1. Inject Widgets CSS if not already present
    const cssId = 'cesium-widgets-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Widgets/widgets.css';
      document.head.appendChild(link);
    }

    // 2. Inject Cesium.js script
    const scriptId = 'cesium-core-script';
    if (document.getElementById(scriptId)) {
      // Script tag exists, wait for Cesium to be available
      const interval = setInterval(() => {
        if (window.Cesium) {
          clearInterval(interval);
          resolve(window.Cesium);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Cesium.js';
    script.async = true;

    script.onload = () => {
      if (window.Cesium) {
        resolve(window.Cesium);
      } else {
        reject(new Error('Cesium script loaded but window.Cesium is undefined.'));
      }
    };

    script.onerror = (err) => {
      cesiumLoadingPromise = null;
      reject(new Error('Failed to load CesiumJS from CDN. Check network connectivity.'));
    };

    document.head.appendChild(script);
  });

  return cesiumLoadingPromise;
}
