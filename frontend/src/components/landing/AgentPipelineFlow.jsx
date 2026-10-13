import React, { useState } from 'react';
import { Satellite, Brain, RefreshCw, Activity, Cpu, BellRing, ChevronRight, CheckCircle2, Shield, Zap } from 'lucide-react';

const AGENTS = [
  {
    id: 'sensing',
    number: '01',
    name: 'Sensing Agent',
    role: 'Multi-Sensor Space Perception',
    icon: Satellite,
    color: 'cyan',
    algorithm: 'Lee Filter, GLCM Texture, Sigma-0 Calibration',
    sources: ['ISRO EOS-04 C-SAR (Bhoonidhi)', 'NASA GES DISC IMERG (0.1° GPM)', 'Copernicus Sentinel-1/2'],
    output: 'Calibrated 128x128 backscatter matrix + NDWI water prob',
    latency: '840ms',
    description: 'Ingests cloud-penetrating synthetic aperture radar and GPM orbital precipitation. Automatically falls back to secondary satellites and cached telemetry if primary connections fluctuate.'
  },
  {
    id: 'prediction',
    number: '02',
    name: 'Prediction Agent',
    role: 'Attention-Gated Inundation Inference',
    icon: Brain,
    color: 'blue',
    algorithm: 'Attention U-Net (PyTorch)',
    sources: ['Sensing Preprocessed Tensors', 'Zone Criticality Indices'],
    output: 'Inundation extent probability map & peak flood depth (m)',
    latency: '310ms',
    description: 'Processes spatial dielectric gradients with soft attention gating, suppressing urban speckle and focusing on low-elevation retention basins.'
  },
  {
    id: 'correction',
    number: '03',
    name: 'Self-Correction Loop',
    role: 'Cognitive Confidence Reflex',
    icon: RefreshCw,
    color: 'amber',
    algorithm: 'Autonomous Confidence Gate (< 60% Trigger)',
    sources: ['Prediction Confidence Score', 'Speckle Variance Check'],
    output: 'Sensor fusion dispatch or verification confirmation',
    latency: '45ms',
    description: 'If single-polarization SAR confidence drops below 60%, the orchestrator autonomously requests Sentinel-2 multispectral NDWI fusion to recalculate.'
  },
  {
    id: 'simulation',
    number: '04',
    name: 'Simulation Agent',
    role: 'Kinematic Wave Hydrodynamic Foresight',
    icon: Activity,
    color: 'emerald',
    algorithm: '2D St. Venant Kinematic Wave Approximation',
    sources: ['CartoSat-1 CartoDEM-30m', 'Micro-Catchment Drainage Capacity'],
    output: '6-Hour rolling 64x64 heightmap displacement grids',
    latency: '1,120ms',
    description: 'Renders 3D water spread projections across urban micro-catchments, routing runoff according to CartoDEM elevation slopes and drainage choke points.'
  },
  {
    id: 'explainability',
    number: '05',
    name: 'Explainability Agent',
    role: 'Transparent XAI Saliency Attribution',
    icon: Cpu,
    color: 'purple',
    algorithm: 'Grad-CAM (Gradient-Weighted Class Activation)',
    sources: ['Bottleneck Feature Maps', 'Building Footprints GeoJSON'],
    output: 'Attribution heatmaps + per-facility vulnerability rankings',
    latency: '490ms',
    description: 'Eliminates black-box decisions. Generates visual heatmaps explaining which topographical depressions and rainfall intensities drove the prediction.'
  },
  {
    id: 'alert',
    number: '06',
    name: 'Alert & Response Agent',
    role: 'Automated NDMA Emergency Dispatch',
    icon: BellRing,
    color: 'red',
    algorithm: 'Criticality Escalation Matrix & CAP-Compliant Routing',
    sources: ['Flood Depth Thresholds', 'Hospital / Substation GIS Layers'],
    output: 'Twilio SMS dispatches, siren triggers & SDMA bulletin',
    latency: '190ms',
    description: 'Categorizes threat levels (Advisory, Watch, Warning, Emergency) and issues automated alerts to rescue agencies and vulnerable populations.'
  }
];

export default function AgentPipelineFlow() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);

  return (
    <section id="pipeline-section" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>AUTONOMOUS COGNITIVE ARCHITECTURE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          How CognitwinX Thinks: <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">The Multi-Agent Loop</span>
        </h2>
        <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
          Six specialized AI agents collaborate continuously in a self-healing cognitive loop to sense, predict, project, explain, and act before floodwaters crest.
        </p>
      </div>

      {/* Horizontal Pipeline Navigation Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selectedAgent.id === agent.id;

          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`p-4 rounded-2xl text-left transition-all relative overflow-hidden flex flex-col justify-between border ${
                isSelected
                  ? 'bg-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] scale-102 z-10'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <span className="font-mono text-xs font-bold text-slate-500">{agent.number}</span>
                <div className={`p-2 rounded-xl ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-900 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black text-white tracking-tight">{agent.name}</h3>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{agent.role}</p>
              </div>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Agent Detailed Inspection Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] shrink-0">
              <selectedAgent.icon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-bold text-cyan-400">AGENT {selectedAgent.number}</span>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-mono text-slate-400 flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                  Latency: {selectedAgent.latency}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mt-1">{selectedAgent.name}</h3>
              <p className="text-sm text-cyan-300 font-mono mt-0.5">{selectedAgent.role}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              Algorithm: <span className="text-white font-bold">{selectedAgent.algorithm}</span>
            </div>
          </div>
        </div>

        {/* Deep Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Input Telemetry & Data</h4>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {selectedAgent.sources.map((src, i) => (
                <li key={i} className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>{src}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Downstream Agent Output</h4>
            <p className="text-xs text-slate-200 font-mono leading-relaxed">{selectedAgent.output}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cognitive Rationale</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{selectedAgent.description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
