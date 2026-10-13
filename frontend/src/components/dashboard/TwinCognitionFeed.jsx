import React from 'react';
import { useTwinStore } from '../../store/twinStore';
import { api } from '../../services/api';
import { Play, RotateCcw, Cpu, Eye, CloudRain, Bell, ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react';

import Button from '../common/Button';

export default function TwinCognitionFeed() {
  const { cognitionLogs, selectedZoneId, activeZone, isCycleRunning, setIsCycleRunning } = useTwinStore();

  const handleRunCycle = async () => {
    if (!selectedZoneId || isCycleRunning) return;
    setIsCycleRunning(true);
    try {
      await api.triggerCognitiveCycle(selectedZoneId);
    } catch (err) {
      console.error('Failed to trigger cycle:', err);
      setIsCycleRunning(false);
    }
  };

  const getAgentBadge = (agentName) => {
    switch (agentName) {
      case 'Sensing Agent':
        return { icon: <CloudRain className="w-3.5 h-3.5 text-cyan-400" />, color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' };
      case 'Prediction Agent':
        return { icon: <Cpu className="w-3.5 h-3.5 text-purple-400" />, color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
      case 'Simulation Agent':
        return { icon: <Eye className="w-3.5 h-3.5 text-blue-400" />, color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
      case 'Explainability Agent':
        return { icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />, color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
      case 'Alert Agent':
        return { icon: <Bell className="w-3.5 h-3.5 text-red-400" />, color: 'bg-red-500/10 text-red-300 border-red-500/30' };
      default:
        return { icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-4 border border-cyan-500/20 shadow-xl overflow-hidden">
      {/* Header & Trigger Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Twin Cognition Feed
          </h3>
          <p className="text-[11px] text-slate-400">Autonomous Multi-Agent Reasoning Trail</p>
        </div>

        <Button
          variant={isCycleRunning ? 'secondary' : 'outline'}
          size="sm"
          icon={isCycleRunning ? RotateCcw : Play}
          disabled={isCycleRunning}
          onClick={handleRunCycle}
          className={isCycleRunning ? 'text-slate-400 cursor-not-allowed' : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'}
        >
          {isCycleRunning ? 'Reasoning...' : 'Run Cycle'}
        </Button>
      </div>

      {/* Feed List with Slide-in Cards */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
        {cognitionLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Awaiting agent telemetry. Click "Run Cycle" to execute autonomous cognition.
          </div>
        ) : (
          cognitionLogs.map((log, index) => {
            const badge = getAgentBadge(log.agent_name);
            const isRetry = log.status === 'retry';
            const isEscalate = log.status === 'escalate';

            return (
              <div
                key={log.id || index}
                className={`p-3 rounded-xl transition-all duration-300 border text-xs relative ${
                  isRetry
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : isEscalate
                    ? 'bg-red-950/30 border-red-500/50'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Agent & Action Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${badge.color}`}>
                    {badge.icon}
                    {log.agent_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}
                  </span>
                </div>

                {/* Action Taken */}
                <div className="font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
                  {isRetry && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
                  {log.action_taken}
                </div>

                {/* Agent Reasoning Trail */}
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {log.reasoning_text}
                </p>

                {log.cycle_id && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 text-[9px] text-slate-400 font-mono flex items-center justify-between">
                    <span>Cycle: {log.cycle_id}</span>
                    <span>Zone: {log.zone_name || activeZone?.name?.split(' - ')[0]}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
