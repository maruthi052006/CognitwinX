import { useState, useEffect } from 'react';

/**
 * Capability-tiered rendering decision matrix:
 * - 3D_THREEJS: WebGL2 context + multi-core CPU (>= 4 threads) for heavy shaders
 * - 2D_MAPLIBRE: Standard WebGL1/2 support on mid-tier/tablet devices (vector tiles, GPU acceleration)
 * - 2D_LEAFLET_MINIMAL: Ultra-lightweight fallback for low-end / legacy devices (CPU raster tiles)
 * 
 * @param {Object} capabilities 
 * @returns {"3D_THREEJS" | "2D_MAPLIBRE" | "2D_LEAFLET_MINIMAL"}
 */
export function selectRenderingTier(capabilities) {
  if (capabilities.webgl2Supported && capabilities.hardwareConcurrency >= 4) {
    return "3D_THREEJS";
  } else if (capabilities.webglSupported) {
    return "2D_MAPLIBRE";
  } else {
    return "2D_LEAFLET_MINIMAL";
  }
}

/**
 * Hardware capability detector hook.
 * Inspects WebGL2, WebGL1, hardwareConcurrency, screen viewport, and memory.
 */
export function useDeviceCapability() {
  const [capability, setCapability] = useState({
    webglSupported: true,
    webgl2Supported: true,
    hardwareConcurrency: 4,
    deviceMemoryGB: 4,
    isMobile: false,
    renderingTier: '3D_THREEJS',
    supports3D: true,
    reason: 'Hardware acceleration verified'
  });

  useEffect(() => {
    const isMobileViewport = window.innerWidth < 768;

    // 1. Probe WebGL2 support
    let gl2Supported = false;
    try {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      gl2Supported = !!gl2;
    } catch (e) {
      gl2Supported = false;
    }

    // 2. Probe WebGL1 support (for MapLibre)
    let glSupported = false;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      glSupported = !!gl;
    } catch (e) {
      glSupported = false;
    }

    // 3. Hardware threads & memory
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 4;

    const capObj = {
      webglSupported: glSupported,
      webgl2Supported: gl2Supported,
      hardwareConcurrency: cores,
      deviceMemoryGB: memory,
      isMobile: isMobileViewport
    };

    const tier = selectRenderingTier(capObj);

    let reason = 'High-performance WebGL2 environment';
    if (tier === '2D_MAPLIBRE') {
      reason = 'Mid-tier GPU detected: Vector 2D fallback active';
    } else if (tier === '2D_LEAFLET_MINIMAL') {
      reason = 'Legacy or low-power hardware: Lightweight raster fallback active';
    }

    setCapability({
      ...capObj,
      renderingTier: tier,
      supports3D: tier === '3D_THREEJS',
      reason
    });
  }, []);

  return capability;
}
