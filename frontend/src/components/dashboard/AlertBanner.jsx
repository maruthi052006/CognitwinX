import React from 'react';
import { useTwinStore } from '../../store/twinStore';
import { api } from '../../services/api';
import { AlertTriangle, CheckCircle, ShieldAlert, X } from 'lucide-react';

import Button from '../common/Button';

export default function AlertBanner() {
  const { alerts, markAlertAcknowledged } = useTwinStore();
  const unacknowledged = alerts.filter(a => !a.acknowledged);

  if (unacknowledged.length === 0) return null;

  const currentAlert = unacknowledged[0];

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeAlert(currentAlert.id);
      markAlertAcknowledged(currentAlert.id);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const isCritical = currentAlert.severity === 'critical';

  return (
    <div className={`w-full px-4 py-2.5 rounded-xl border flex items-center justify-between transition-all duration-500 text-xs shadow-lg z-[700] ${
      isCritical
        ? 'bg-red-950/85 border-red-500/70 text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.25)] animate-pulse-slow'
        : 'bg-amber-950/85 border-amber-500/70 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
    }`}>
      <div className="flex items-center space-x-3 overflow-hidden">
        <div className={`p-1.5 rounded-lg ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
          <ShieldAlert className="w-4 h-4 animate-bounce" />
        </div>
        <div className="truncate">
          <span className="font-bold tracking-wider uppercase mr-2 text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-current">
            {currentAlert.severity}
          </span>
          <span className="font-medium">{currentAlert.message}</span>
          <span className="text-[10px] opacity-75 ml-2 font-mono">
            {new Date(currentAlert.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={CheckCircle}
        onClick={handleAcknowledge}
        className="ml-4 shrink-0 bg-white/10 hover:bg-white/20 border-white/30 text-white whitespace-nowrap"
      >
        Acknowledge
      </Button>
    </div>
  );
}
