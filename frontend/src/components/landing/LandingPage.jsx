import React, { useState, useEffect } from 'react';
import HeroSection from './HeroSection';
import AnimatedStatCounter from './AnimatedStatCounter';
import AgentPipelineFlow from './AgentPipelineFlow';
import FeatureCard from './FeatureCard';
import LivePreviewEmbed from './LivePreviewEmbed';
import TrustSection from './TrustSection';
import AuthModal from './AuthModal';
import Footer from './Footer';
import { Waves, ArrowRight, ShieldCheck, Box, Cpu, Eye, Radio, BellRing, Sliders, Menu, X } from 'lucide-react';

export default function LandingPage({ onNavigateDashboard }) {
  const [scrolled, setScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070b14] text-slate-100 selection:bg-cyan-500 selection:text-black overflow-x-hidden font-sans">
      {/* NAVBAR */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-4 sm:px-8 py-3.5 flex items-center justify-between ${
          scrolled
            ? 'bg-[#070b14]/90 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
            : 'bg-transparent'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-white text-base tracking-tight">CognitwinX</span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                AI TWIN
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:block">Autonomous Flood Resilience</span>
          </div>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-300">
          <button onClick={() => scrollToSection('pipeline-section')} className="hover:text-cyan-400 transition-colors">
            Agent Architecture
          </button>
          <button onClick={() => scrollToSection('features-section')} className="hover:text-cyan-400 transition-colors">
            Capabilities
          </button>
          <button onClick={() => scrollToSection('sandbox-section')} className="hover:text-cyan-400 transition-colors">
            Live 3D Sandbox
          </button>
          <button onClick={() => scrollToSection('trust-section')} className="hover:text-cyan-400 transition-colors">
            ISRO & NASA Telemetry
          </button>
        </div>

        {/* CTA Buttons */}
        <div className="hidden sm:flex items-center space-x-3">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 text-xs font-bold text-slate-200 transition-all"
          >
            Sign In / Portal
          </button>
          <button
            onClick={onNavigateDashboard}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:scale-105"
          >
            <span>Mission Control</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex sm:hidden items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-[#070b14]/98 pt-20 px-6 sm:hidden flex flex-col space-y-4 text-sm font-bold">
          <button onClick={() => scrollToSection('pipeline-section')} className="text-left py-2 border-b border-slate-800">
            Agent Architecture
          </button>
          <button onClick={() => scrollToSection('features-section')} className="text-left py-2 border-b border-slate-800">
            Capabilities
          </button>
          <button onClick={() => scrollToSection('sandbox-section')} className="text-left py-2 border-b border-slate-800">
            Live 3D Sandbox
          </button>
          <button onClick={() => scrollToSection('trust-section')} className="text-left py-2 border-b border-slate-800">
            ISRO & NASA Telemetry
          </button>
          <div className="pt-4 flex flex-col space-y-2">
            <button
              onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
              className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 text-center font-bold text-xs"
            >
              Sign In / NDMA Clearance
            </button>
            <button
              onClick={onNavigateDashboard}
              className="w-full py-3 rounded-xl bg-cyan-500 text-black text-center font-extrabold text-xs shadow-lg"
            >
              Launch Mission Control
            </button>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <HeroSection
        onLaunchMissionControl={onNavigateDashboard}
        onOpenAuth={() => setAuthModalOpen(true)}
        onExplorePipeline={() => scrollToSection('pipeline-section')}
      />

      {/* PROBLEM & STATS COUNTERS */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatedStatCounter
            prefix="+"
            end="68"
            suffix="%"
            label="Extreme Flood Surge"
            sublabel="Urban Deluges (2015–2025)"
          />
          <AnimatedStatCounter
            prefix="<"
            end="120"
            suffix="s"
            label="Autonomous Latency"
            sublabel="Multi-Agent Sensing to Alert"
          />
          <AnimatedStatCounter
            end="94.2"
            suffix="%"
            decimals={1}
            label="ISRO Validation IoU"
            sublabel="Against Bhoonidhi WaterSpread"
          />
          <AnimatedStatCounter
            end="14.8"
            suffix="M"
            decimals={1}
            label="Citizens Protected"
            sublabel="Across Major Metro Basins"
          />
        </div>
      </section>

      {/* MULTI-AGENT COGNITIVE PIPELINE */}
      <AgentPipelineFlow />

      {/* CORE CAPABILITIES GRID */}
      <section id="features-section" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>FULL-STACK COGNITIVE RESILIENCE</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Built for National Disaster Management Operations
          </h2>
          <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
            Enterprise cognitive capabilities developed specifically to handle rapid coastal convective storms and urban drainage saturation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={Box}
            category="3D Geospatial Engine"
            title="Volumetric GLSL Flood Shader"
            description="Dynamic Three.js vertex displacement meshes rendering floodwater depths, contour gradients, and building boundary collision in real-time."
            metrics={{ label: 'Mesh Geometry', value: '180x180 DEM Vertex Plane' }}
            tag="WebGL 3D"
          />

          <FeatureCard
            icon={Radio}
            category="Space Agency Integration"
            title="ISRO EOS-04 & Bhuvan WMS"
            description="Direct ingest of C-band SAR Level-2B backscatter swaths from Bhoonidhi, coupled with high-resolution Bhuvan satellite and LULC basemaps."
            metrics={{ label: 'Radar Frequency', value: '5.4 GHz C-Band' }}
            tag="ISRO Ingest"
          />

          <FeatureCard
            icon={Eye}
            category="Explainable AI"
            title="Grad-CAM Saliency Attribution"
            description="Transparent convolutional activation heatmaps reveal the exact topographical depressions and rainfall intensities guiding every prediction."
            metrics={{ label: 'Attribution Fidelity', value: 'Per-Building Ranking' }}
            tag="XAI Engine"
          />

          <FeatureCard
            icon={BellRing}
            category="Emergency Response"
            title="CAP Protocol & Twilio SMS"
            description="Automated threshold triggers dispatch multi-lingual SMS alerts and sound local ward sirens before residential streets become impassable."
            metrics={{ label: 'Dispatch Trigger', value: '< 2.4s Latency' }}
            tag="Automated Act"
          />

          <FeatureCard
            icon={Sliders}
            category="Foresight Simulation"
            title="Interactive What-If Sandbox"
            description="Stress-test city infrastructure by simulating +50% convective cloudbursts or -40% choked storm drains over 1-to-6 hour horizons."
            metrics={{ label: 'Solver Accuracy', value: '2D St. Venant Kinematic' }}
            tag="What-If Model"
          />

          <FeatureCard
            icon={ShieldCheck}
            category="Institutional Security"
            title="NDMA Officer Clearance"
            description="Role-based access control segregates public viewer observation from high-privilege emergency evacuation and siren override actuation."
            metrics={{ label: 'Access Control', value: 'Multi-Tier RBAC + JWT' }}
            tag="NDMA Tier"
          />
        </div>
      </section>

      {/* 3D INTERACTIVE SANDBOX EMBED */}
      <div id="sandbox-section">
        <LivePreviewEmbed onLaunchMissionControl={onNavigateDashboard} />
      </div>

      {/* TRUST & PROVENANCE SECTION */}
      <div id="trust-section">
        <TrustSection />
      </div>

      {/* FOOTER */}
      <Footer
        onLaunchMissionControl={onNavigateDashboard}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          onNavigateDashboard();
        }}
      />
    </div>
  );
}
