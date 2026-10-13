import React, { useState, useRef } from 'react';
import { useTwinStore } from '../../store/twinStore';
import { api } from '../../services/api';
import { Sliders, RotateCcw, Play, Loader2, Sparkles, AlertCircle } from 'lucide-react';

import Button from '../common/Button';

export default function WhatIfSliders() {
  const {
    activeZone,
    updateWhatIfPreview,
    resetWhatIfPreview,
    handleLivePredictionUpdate,
    currentDepth
  } = useTwinStore();

  const [rainfallDelta, setRainfallDelta] = useState(25); // +25%
  const [drainageFactor, setDrainageFactor] = useState(0.7); // -30% capacity
  const [timeHorizon, setTimeHorizon] = useState(3); // 3 hours
  const [isComputing, setIsComputing] = useState(false);
  const debounceRef = useRef(null);

  // Trigger client-side instant preview immediately on slider drag
  const triggerLocalPreview = (rDelta, dFactor, tHorizon) => {
    updateWhatIfPreview({
      rainfallDelta: rDelta,
      drainageFactor: dFactor,
      timeHorizon: tHorizon
    });

    // Debounced asynchronous call to backend Simulation Agent
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runBackendSimulation(rDelta, dFactor, tHorizon);
    }, 400);
  };

  const runBackendSimulation = async (rDelta, dFactor, tHorizon) => {
    if (!activeZone) return;
    setIsComputing(true);
    try {
      const result = await api.simulateWhatIf({
        zone_id: activeZone.id,
        rainfall_delta: rDelta,
        drainage_factor: dFactor,
        time_horizon: tHorizon
      });

      // Update with accurate backend simulated result
      const peakDepth = result.peak_depth_m;
      const lastSlice = result.time_series[result.time_series.length - 1];
      const accurateHeightmap = lastSlice?.depth_heightmap_grid;

      handleLivePredictionUpdate({
        zone_id: activeZone.id,
        predicted_depth_m: peakDepth,
        confidence_score: 0.93,
        depth_heightmap_grid: accurateHeightmap,
        rainfall_mm: Math.round(25 * (1 + rDelta / 100))
      });
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsComputing(false);
    }
  };

  const handleReset = () => {
    setRainfallDelta(0);
    setDrainageFactor(1.0);
    setTimeHorizon(3);
    resetWhatIfPreview();
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-cyan-500/20 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white text-sm">What-If Inundation Simulator</h3>
        </div>

        <div className="flex items-center space-x-2">
          {isComputing && (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              Computing Hydrodynamics...
            </span>
          )}
          <Button
            size="iconSm"
            variant="secondary"
            icon={RotateCcw}
            onClick={handleReset}
            title="Reset Scenarios"
          />
        </div>
      </div>

      <p className="text-xs text-slate-300">
        Simulate climate stress scenarios with <span className="text-cyan-300 font-semibold">instant client-side 3D preview</span> followed by smooth morph to backend kinematic wave projections.
      </p>

      {/* Slider 1: Rainfall Intensity Delta */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-300 font-medium">Monsoon Precipitation Anomaly</span>
          <span className="font-mono font-bold text-cyan-300">{rainfallDelta > 0 ? `+${rainfallDelta}%` : `${rainfallDelta}%`}</span>
        </div>
        <input
          type="range"
          min="-50"
          max="100"
          step="5"
          value={rainfallDelta}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setRainfallDelta(val);
            triggerLocalPreview(val, drainageFactor, timeHorizon);
          }}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>-50% Drought</span>
          <span>Baseline</span>
          <span>+100% Cloudburst</span>
        </div>
      </div>

      {/* Slider 2: Drainage Capacity Degradation */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-300 font-medium">Stormwater Drainage Efficiency</span>
          <span className="font-mono font-bold text-amber-300">
            {Math.round(drainageFactor * 100)}% ({drainageFactor < 1.0 ? `-${Math.round((1-drainageFactor)*100)}% choked` : 'clear'})
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1.5"
          step="0.05"
          value={drainageFactor}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setDrainageFactor(val);
            triggerLocalPreview(rainfallDelta, val, timeHorizon);
          }}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>20% Severe Clog</span>
          <span>100% Design Capacity</span>
          <span>150% Expanded Drains</span>
        </div>
      </div>

      {/* Slider 3: Projection Horizon */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-300 font-medium">Projection Time Horizon</span>
          <span className="font-mono font-bold text-purple-300">+{timeHorizon} Hours</span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={timeHorizon}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setTimeHorizon(val);
            triggerLocalPreview(rainfallDelta, drainageFactor, val);
          }}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>1h Flash Flood</span>
          <span>3h Mid Peak</span>
          <span>6h Sustained Basin Pooling</span>
        </div>
      </div>
    </div>
  );
}
