import React, { useEffect, useState } from 'react';
import { useTwinStore } from '../store/twinStore';
import { api } from '../services/api';
import { SectionCard } from '../components/layout';
import { ShieldAlert, CheckCircle, AlertTriangle, MessageSquare, Clock, MapPin, Send } from 'lucide-react';

export default function AlertsHistory() {
  const { alerts, setAlerts, markAlertAcknowledged } = useTwinStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getAlerts().then(data => setAlerts(data.results || data)).catch(err => console.error(err));
  }, [setAlerts]);

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      markAlertAcknowledged(alertId);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'pending') return !a.acknowledged;
    if (filter === 'acknowledged') return a.acknowledged;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Controls */}
      <SectionCard padding="md" glow={true}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Disaster Emergency Alert Dispatch Center
            </h2>
            <p className="text-xs text-slate-400">Autonomous alert decisions dispatched via Twilio SMS and NDMA channels</p>
          </div>

          {/* Filter Pills */}
          <div className="flex space-x-1.5 text-xs">
            {['all', 'pending', 'critical', 'acknowledged'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                  filter === f
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-500 text-xs rounded-2xl">
            No alerts found matching "{filter}".
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all duration-300 glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !alert.acknowledged && isCritical
                    ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isCritical ? 'bg-red-950/80 text-red-300 border-red-800' : 'bg-amber-950/80 text-amber-300 border-amber-800'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="font-bold text-white text-sm">{alert.zone_name}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-[11px] text-slate-400 capitalize">{alert.zone_criticality} Zone</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">{alert.message}</p>

                    <div className="flex items-center space-x-4 pt-1 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {new Date(alert.sent_at).toLocaleString()}
                      </span>
                      {alert.sms_sent && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Send className="w-3 h-3" /> Twilio SMS Dispatched
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acknowledge Button */}
                <div className="flex items-center space-x-3 self-end md:self-center">
                  {alert.acknowledged ? (
                    <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/50 shadow-md text-xs font-semibold transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Acknowledge Alert</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
