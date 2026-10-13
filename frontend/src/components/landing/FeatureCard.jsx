import React, { useState, useRef } from 'react';

export default function FeatureCard({ icon: Icon, title, category, description, metrics, tag }) {
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setRotateX(-y * 0.05);
    setRotateY(x * 0.05);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: 'transform 0.15s ease-out',
      }}
      className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/50 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex flex-col justify-between group transition-colors relative overflow-hidden"
    >
      {/* Background glow spot on hover */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6" />
          </div>
          {tag && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-cyan-800/50">
              {tag}
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">{category}</div>
        <h3 className="text-lg font-black text-white mt-1 group-hover:text-cyan-200 transition-colors">{title}</h3>
        <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>

      {metrics && (
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">{metrics.label}</span>
          <span className="text-cyan-300 font-bold">{metrics.value}</span>
        </div>
      )}
    </div>
  );
}
