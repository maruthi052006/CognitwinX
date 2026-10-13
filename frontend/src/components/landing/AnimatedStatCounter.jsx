import React, { useEffect, useState } from 'react';

export default function AnimatedStatCounter({ end, duration = 2000, suffix = '', prefix = '', decimals = 0, label, sublabel }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const target = parseFloat(end);

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(easeOut * target);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [end, duration]);

  return (
    <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-cyan-500/40 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all group hover:-translate-y-1">
      <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white group-hover:text-cyan-300 transition-colors">
        <span className="text-cyan-400">{prefix}</span>
        {count.toFixed(decimals)}
        <span className="text-cyan-400">{suffix}</span>
      </div>
      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1.5">{label}</div>
      {sublabel && <div className="text-[11px] text-slate-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}
