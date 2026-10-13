import React from 'react';
import { useTwinStore } from '../../store/twinStore';
import RiskGaugeRing from './RiskGaugeRing';
import { MapPin, AlertCircle, Building2, Hospital, GraduationCap, Zap } from 'lucide-react';

export default function ZoneCard({ zone, isSelected }) {
  const { selectZone, latestPredictions } = useTwinStore();
  const pred = latestPredictions[zone.id];
  const depth = pred?.predicted_depth_m || 0.22;
  const conf = pred?.confidence_score || 0.88;

  const getCriticalityIcon = (crit) => {
    switch (crit) {
      case 'hospital': return <Hospital className="w-3.5 h-3.5 text-red-400" />;
      case 'school': return <GraduationCap className="w-3.5 h-3.5 text-amber-400" />;
      case 'critical_infra': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      default: return <Building2 className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div
      onClick={() => selectZone(zone.id)}
      className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden ${
        isSelected
          ? 'glass-panel-glow border-cyan-400/60 shadow-lg scale-[1.01]'
          : 'glass-panel hover:border-cyan-500/30 hover:bg-slate-900/60'
      }`}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_10px_#06b6d4]" />
      )}

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>{zone.city}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[11px] capitalize text-slate-300">
              {getCriticalityIcon(zone.criticality)}
              {zone.criticality.replace('_', ' ')}
            </span>
          </div>
          <h4 className="font-bold text-white text-sm tracking-tight">{zone.name}</h4>
        </div>

        <RiskGaugeRing value={conf} size={48} strokeWidth={4} label="" />
      </div>

      {/* Metrics Row */}
      <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-400 uppercase">Projected Depth</span>
          <div className={`font-mono font-bold ${depth > 0.6 ? 'text-red-400' : (depth > 0.35 ? 'text-amber-400' : 'text-cyan-300')}`}>
            {depth} m
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase">Elevation</span>
          <div className="font-mono text-slate-200">{zone.elevation_avg} m</div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase">Drain Efficiency</span>
          <div className="font-mono text-slate-200">{Math.round(zone.drainage_capacity_index * 100)}%</div>
        </div>
      </div>
    </div>
  );
}
