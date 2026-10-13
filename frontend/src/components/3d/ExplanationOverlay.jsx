import React from 'react';
import { useTwinStore } from '../../store/twinStore';
import { Sparkles } from 'lucide-react';

export default function ExplanationOverlay() {
  const { explanationView, latestPredictions, selectedZoneId } = useTwinStore();
  const pred = latestPredictions[selectedZoneId];

  return (
    <div className="absolute bottom-3 right-3 z-20 pointer-events-auto">
      <div className="glass-panel px-2.5 py-1.5 rounded-xl text-[10px] border border-cyan-500/20 backdrop-blur-md shadow-xl transition-all">
        {!explanationView ? (
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline">Risk:</span>
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> Safe</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06b6d4]" /> Mod</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f43f5e]" /> Crit</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1 text-[10px]">
              <Sparkles className="w-2.5 h-2.5" /> Saliency:
            </span>
            <div className="flex items-center space-x-1.5 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a855f7]" /> Med</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f43f5e]" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#facc15]" /> Peak</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
