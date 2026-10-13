import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, User, ArrowRight, Waves, Radio, Activity } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const { login, switchRole } = useAuth();
  const [username, setUsername] = useState('ndma_officer');
  const [password, setPassword] = useState('officer123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(username, password);
    setLoading(false);
    onLoginSuccess();
  };

  const handleQuickRoleSelect = (roleName) => {
    switchRole(roleName);
    onLoginSuccess();
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#050811] overflow-hidden">
      {/* Background Ambient Digital Twin Grid Lines */}
      <div className="absolute inset-0 hud-scanline pointer-events-none opacity-40" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Glassmorphic Login Card */}
      <div className="relative z-10 w-full max-w-md glass-panel-glow p-8 rounded-3xl border border-cyan-500/30 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Waves className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">CognitwinX</h1>
          <p className="text-xs text-slate-300 font-medium">
            Cognitive Digital Twin for Urban Flood Management
          </p>
          <div className="inline-flex items-center space-x-1 text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/60">
            <Radio className="w-2.5 h-2.5 animate-ping text-cyan-400" />
            <span>Autonomous Multi-Agent AI Active</span>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                placeholder="Officer ID"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Authenticating...' : 'Enter Mission Control'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* 1-Click Role Exploration */}
        <div className="pt-4 border-t border-slate-800 space-y-2.5">
          <div className="text-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Or select role for demo evaluation:
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickRoleSelect('ndma_officer')}
              className="px-2 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold text-center transition-all"
            >
              NDMA Officer
            </button>
            <button
              onClick={() => handleQuickRoleSelect('admin')}
              className="px-2 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-amber-500/20 text-amber-300 text-[11px] font-semibold text-center transition-all"
            >
              Admin HQ
            </button>
            <button
              onClick={() => handleQuickRoleSelect('public_viewer')}
              className="px-2 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 text-slate-300 text-[11px] font-semibold text-center transition-all"
            >
              Public Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
