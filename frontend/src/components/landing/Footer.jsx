import React from 'react';
import { Waves, Satellite, ShieldCheck, Github, ExternalLink, Radio } from 'lucide-react';

export default function Footer({ onLaunchMissionControl, onOpenAuth }) {
  return (
    <footer className="w-full bg-[#050811] border-t border-slate-900 text-slate-400 text-xs py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-900">
        {/* Brand Col */}
        <div className="md:col-span-1">
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-400">
              <Waves className="w-5 h-5 animate-pulse" />
            </div>
            <span className="font-extrabold text-white text-base tracking-tight">CognitwinX</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              v2.4
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Agentic AI-Enabled Cognitive Digital Twin for Autonomous Urban Flood Prediction and Disaster Management.
          </p>
          <div className="flex items-center space-x-2 text-[11px] text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>All 6 Cognitive Agents Operational</span>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Core Modules</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={onLaunchMissionControl} className="hover:text-cyan-400 transition-colors">
                Mission Control HUD
              </button>
            </li>
            <li>
              <a href="#pipeline-section" className="hover:text-cyan-400 transition-colors">
                Multi-Agent Cognitive Pipeline
              </a>
            </li>
            <li>
              <a href="#features-section" className="hover:text-cyan-400 transition-colors">
                Attention U-Net & Kinematic Wave
              </a>
            </li>
            <li>
              <button onClick={onOpenAuth} className="hover:text-cyan-400 transition-colors">
                NDMA/SDMA Officer Clearance Portal
              </button>
            </li>
          </ul>
        </div>

        {/* Telemetry APIs */}
        <div>
          <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Space Telemetry</h4>
          <ul className="space-y-2 text-xs text-slate-500 font-mono">
            <li className="flex items-center space-x-1.5">
              <Satellite className="w-3.5 h-3.5 text-cyan-400" />
              <span>ISRO Bhoonidhi (EOS-04 C-SAR)</span>
            </li>
            <li className="flex items-center space-x-1.5">
              <Satellite className="w-3.5 h-3.5 text-blue-400" />
              <span>ISRO Bhuvan (WMS India-3 & LULC)</span>
            </li>
            <li className="flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>NASA Earthdata (GES DISC IMERG)</span>
            </li>
            <li className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>ESA Copernicus (Sentinel-1/2)</span>
            </li>
          </ul>
        </div>

        {/* Compliance & Security */}
        <div>
          <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Disaster Standards</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Compliant with NDMA guidelines, WMO Common Alerting Protocol (CAP v1.2), and OGC geospatial standards for hydrodynamic raster models.
          </p>
          <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-cyan-300">
            System Status: 99.98% Uptime
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between text-slate-600 text-[11px]">
        <div>
          &copy; {new Date().getFullYear()} CognitwinX Disaster Intelligence. Built for NDMA & Urban Metros.
        </div>
        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          <span>ISRO & NASA Open Data Integrated</span>
          <span>•</span>
          <span>Zero Secret Exposure Policy</span>
        </div>
      </div>
    </footer>
  );
}
