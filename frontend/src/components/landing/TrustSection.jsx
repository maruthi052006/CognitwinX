import React from 'react';
import { ShieldCheck, Satellite, Award, Database, Cpu, Radio } from 'lucide-react';

const PARTNERS = [
  {
    name: 'ISRO Bhoonidhi',
    role: 'EOS-04 C-Band SAR & WaterSpread',
    agency: 'National Remote Sensing Centre (NRSC)',
    badge: 'Primary Radar Swaths',
    icon: Satellite
  },
  {
    name: 'ISRO Bhuvan',
    role: 'Open Geoportal WMS Satellite Basemaps',
    agency: 'Indian Space Research Organisation',
    badge: 'High-Res Carto & LULC',
    icon: Database
  },
  {
    name: 'NASA Earthdata GES DISC',
    role: 'GPM IMERG High-Rate Precipitation',
    agency: 'NASA Goddard Space Flight Center',
    badge: '0.1° Global Precipitation',
    icon: Radio
  },
  {
    name: 'ESA Copernicus',
    role: 'Sentinel-1 SAR & Sentinel-2 NDWI',
    agency: 'European Space Agency',
    badge: 'Multi-Sensor Optical Fusion',
    icon: Cpu
  },
  {
    name: 'NDMA & SDMA',
    role: 'Disaster Evacuation & CAP Dispatch',
    agency: 'Ministry of Home Affairs, India',
    badge: 'Emergency Response Matrix',
    icon: ShieldCheck
  },
  {
    name: 'IMD Doppler AWS',
    role: 'Automatic Weather Station Radar Gauges',
    agency: 'Ministry of Earth Sciences, India',
    badge: 'Ground Truth Telemetry',
    icon: Award
  }
];

export default function TrustSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>DATA PROVENANCE & INSTITUTIONAL COMPLIANCE</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Sourced from Leading Space & Disaster Agencies
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          CognitwinX relies on zero simulated placeholders in production. All telemetry is cross-referenced with official space agency sensors.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PARTNERS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/30 backdrop-blur-xl flex items-start space-x-3.5 transition-all group hover:-translate-y-0.5"
            >
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 group-hover:bg-cyan-500/10 transition-colors shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{p.name}</span>
                  <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{p.role}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.agency}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
