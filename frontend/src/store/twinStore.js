import { create } from 'zustand';

export const useTwinStore = create((set, get) => ({
  // Active selection
  zones: [],
  selectedZoneId: null,
  activeZone: null,

  // Live Telemetry & Predictions
  twinState: null,
  latestPredictions: {},
  currentDepth: 0.25,
  currentConfidence: 0.89,
  currentRainfall: 20.0,
  
  // 3D Water Heightmap Grid (64x64 float array)
  currentHeightmap: null,
  targetHeightmap: null, // For GSAP interpolation
  lastHeightmapUpdate: 0,

  // Multi-Agent Cognition Feed
  cognitionLogs: [],
  isCycleRunning: false,
  isRecalculating: false, // Visual cue during Orchestrator self-correction retry

  // Explanation View (false = Prediction Risk View, true = Grad-CAM/SHAP View)
  explanationView: false,
  explanationData: null,

  // What-If Simulator Live Preview
  isWhatIfActive: false,
  whatIfParams: { rainfallDelta: 0, drainageFactor: 1.0, timeHorizon: 3 },
  whatIfPreviewDepth: null,

  // Historical Playback / Timeline Scrubber
  timelineSnapshots: [],
  scrubberProgress: 1.0, // 0.0 (past) to 1.0 (now)

  // Alerts
  alerts: [],
  unreadAlertCount: 0,

  // Actions
  setZones: (zonesData) => {
    const zones = Array.isArray(zonesData) ? zonesData : (zonesData?.results || []);
    const defaultZone = zones.length > 0 ? zones[0] : null;
    set({
      zones,
      selectedZoneId: defaultZone ? defaultZone.id : null,
      activeZone: defaultZone
    });
  },

  selectZone: (zoneId) => {
    const zone = get().zones.find(z => z.id === zoneId);
    if (!zone) return;
    set({
      selectedZoneId: zoneId,
      activeZone: zone,
      // Load zone's existing prediction if available
      currentDepth: get().latestPredictions[zoneId]?.predicted_depth_m || 0.25,
      currentConfidence: get().latestPredictions[zoneId]?.confidence_score || 0.88,
      currentHeightmap: get().latestPredictions[zoneId]?.depth_heightmap_grid || null
    });
  },

  setPredictions: (predictionsList) => {
    const map = {};
    predictionsList.forEach(p => {
      map[p.zone] = p;
    });
    const currentSelected = get().selectedZoneId;
    const activePred = map[currentSelected];

    set({
      latestPredictions: map,
      ...(activePred ? {
        currentDepth: activePred.predicted_depth_m,
        currentConfidence: activePred.confidence_score,
        currentHeightmap: activePred.depth_heightmap_grid
      } : {})
    });
  },

  // Throttled Heightmap & 3D update handler (Section 5.2 requirement: throttled to 2-3s for 60fps)
  handleLivePredictionUpdate: (payload) => {
    const { zone_id, predicted_depth_m, confidence_score, depth_heightmap_grid, rainfall_mm } = payload;
    const now = Date.now();
    const state = get();

    // Update dictionary
    const updatedMap = {
      ...state.latestPredictions,
      [zone_id]: {
        ...state.latestPredictions[zone_id],
        predicted_depth_m,
        confidence_score,
        depth_heightmap_grid,
        rainfall_mm
      }
    };

    if (zone_id === state.selectedZoneId) {
      // Throttle 3D heightmap geometry update to avoid frame-drop
      const canUpdate3D = (now - state.lastHeightmapUpdate) >= 2000;
      set({
        latestPredictions: updatedMap,
        currentDepth: predicted_depth_m,
        currentConfidence: confidence_score,
        currentRainfall: rainfall_mm || state.currentRainfall,
        targetHeightmap: depth_heightmap_grid,
        currentHeightmap: canUpdate3D ? depth_heightmap_grid : state.currentHeightmap,
        lastHeightmapUpdate: canUpdate3D ? now : state.lastHeightmapUpdate,
        isRecalculating: false,
        isCycleRunning: false
      });
    } else {
      set({ latestPredictions: updatedMap });
    }
  },

  // Add Cognition Log Entry
  addCognitionLog: (logEntry) => {
    set(state => ({
      cognitionLogs: [logEntry, ...state.cognitionLogs].slice(0, 100),
      isRecalculating: logEntry.status === 'retry'
    }));
  },

  setCognitionLogs: (logs) => {
    set({ cognitionLogs: logs });
  },

  setTimelineSnapshots: (snapshots) => {
    set({ timelineSnapshots: snapshots });
  },

  setScrubberProgress: (progress) => {
    const snapshots = get().timelineSnapshots;
    if (snapshots.length === 0) return;

    // Interpolate nearest snapshot
    const index = Math.min(
      snapshots.length - 1,
      Math.floor(progress * (snapshots.length - 1))
    );
    const snap = snapshots[index];
    if (snap) {
      set({
        scrubberProgress: progress,
        currentDepth: snap.predicted_depth_m,
        currentConfidence: snap.confidence_score,
        currentHeightmap: snap.depth_heightmap_grid
      });
    }
  },

  setExplanationView: (enabled) => set({ explanationView: enabled }),
  setExplanationData: (data) => set({ explanationData: data }),

  // What-If Simulator Real-time preview (Section 5.3)
  updateWhatIfPreview: (params) => {
    const baseDepth = get().currentDepth;
    const rainMultiplier = 1.0 + (params.rainfallDelta / 100.0);
    const drainMultiplier = Math.max(0.2, params.drainageFactor);
    const approxDepth = Math.round(baseDepth * (rainMultiplier / drainMultiplier) * 100) / 100;

    // Client-side heightmap approximation (instant feedback)
    const baseGrid = get().currentHeightmap;
    let scaledGrid = baseGrid;
    if (baseGrid && baseGrid.length > 0) {
      const scale = rainMultiplier / drainMultiplier;
      scaledGrid = baseGrid.map(row => row.map(cell => Math.round(cell * scale * 1000) / 1000));
    }

    set({
      whatIfParams: params,
      isWhatIfActive: true,
      whatIfPreviewDepth: approxDepth,
      targetHeightmap: scaledGrid
    });
  },

  resetWhatIfPreview: () => {
    set({
      isWhatIfActive: false,
      whatIfPreviewDepth: null,
      targetHeightmap: null
    });
  },

  setAlerts: (alerts) => {
    const unread = alerts.filter(a => !a.acknowledged).length;
    set({ alerts, unreadAlertCount: unread });
  },

  addAlert: (newAlert) => {
    set(state => {
      const exists = state.alerts.some(a => a.id === newAlert.id);
      if (exists) return state;
      return {
        alerts: [newAlert, ...state.alerts],
        unreadAlertCount: state.unreadAlertCount + 1
      };
    });
  },

  markAlertAcknowledged: (alertId) => {
    set(state => ({
      alerts: state.alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a),
      unreadAlertCount: Math.max(0, state.unreadAlertCount - 1)
    }));
  },

  setIsCycleRunning: (running) => set({ isCycleRunning: running })
}));
