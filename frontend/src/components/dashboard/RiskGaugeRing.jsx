import React from 'react';

export default function RiskGaugeRing({ value = 0.85, size = 64, strokeWidth = 5, label = 'Confidence' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, value));
  const offset = circumference - progress * circumference;

  const getColor = () => {
    if (progress >= 0.8) return '#10b981'; // Green
    if (progress >= 0.6) return '#06b6d4'; // Cyan
    if (progress >= 0.4) return '#f59e0b'; // Amber
    return '#f43f5e'; // Red
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(51, 65, 85, 0.4)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold font-mono text-white">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
      {label && <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{label}</span>}
    </div>
  );
}
