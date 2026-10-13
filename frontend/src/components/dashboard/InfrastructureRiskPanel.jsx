import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ShieldAlert, Wrench, AlertCircle, CheckCircle, RefreshCw, HardHat } from 'lucide-react';

import Button from '../common/Button';

export default function InfrastructureRiskPanel() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await api.getInfrastructureRiskFlags();
      setFlags(res);
    } catch (err) {
      console.error('Failed to load infrastructure flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  return (
    <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/20 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <HardHat className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">Recommended Upgrade Priorities</h3>
            <p className="text-[10px] text-slate-400">Autonomous Celery Infrastructure Risk Flagging</p>
          </div>
        </div>
        <Button
          size="iconSm"
          variant="ghost"
          icon={RefreshCw}
          loading={loading}
          onClick={fetchFlags}
          title="Refresh priorities"
        />
      </div>

      {loading && flags.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-[11px] font-mono text-slate-400">Analyzing recurring flood history...</span>
        </div>
      ) : flags.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          No active civil infrastructure bottlenecks flagged.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {flags.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/30 space-y-2 hover:border-amber-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-xs">{item.zone_name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                    Priority Score: {(item.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {item.recurring_events_count} Flood Cycles
                </span>
              </div>

              <div className="text-[11px] text-slate-300">
                <div className="text-[10px] text-red-300 font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <span>Bottleneck: {item.primary_bottleneck}</span>
                </div>
                <div className="mt-1.5 p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[10px] text-cyan-200 flex items-start space-x-1.5">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span><strong>Recommended Mitigation:</strong> {item.recommended_upgrade}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
