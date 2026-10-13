import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useTwinStore } from '../../store/twinStore';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

import Button from '../common/Button';

export default function ZoneRiskComparisonWidget() {
  const { setSelectedZoneId, selectedZoneId } = useTwinStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await api.getZoneComparison();
      setData(res);
    } catch (err) {
      console.error('Failed to load zone comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, []);

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-red-950 text-red-400 border-red-800';
      case 'HIGH':
        return 'bg-orange-950 text-orange-400 border-orange-800';
      case 'MEDIUM':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      default:
        return 'bg-emerald-950 text-emerald-400 border-emerald-800';
    }
  };

  return (
    <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/20 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">Multi-Zone Risk Ranking</h3>
            <p className="text-[10px] text-slate-400">Attention U-Net & Hydro Proxy Assessment</p>
          </div>
        </div>
        <Button
          size="iconSm"
          variant="ghost"
          icon={RefreshCw}
          loading={loading}
          onClick={fetchComparison}
          title="Refresh comparison"
        />
      </div>

      {loading && !data ? (
        <div className="py-6 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-[11px] font-mono text-slate-400">Comparing risk across basins...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.ranked_zones?.map((z, index) => {
            const isSelected = selectedZoneId === z.zone_id;
            return (
              <div
                key={z.zone_id}
                onClick={() => setSelectedZoneId(z.zone_id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className="font-mono text-xs font-bold text-slate-500 w-4">
                    #{index + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-white text-xs">{z.zone_name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">({z.city})</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Depth: <strong className="text-cyan-300">{z.predicted_depth_m}m</strong> | Conf: {(z.confidence_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end space-y-1">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${getTierBadge(z.risk_tier)}`}>
                    {z.risk_tier}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Score: {z.composite_risk_score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
