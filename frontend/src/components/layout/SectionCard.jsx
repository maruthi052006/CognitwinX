import React from 'react';
import { spacingClasses, borderRadius } from './designTokens';

/**
 * Reusable Glassmorphism Section Card component ensuring consistent
 * padding, border radius, header structure, and visual rhythm.
 */
export default function SectionCard({
  title,
  icon: Icon,
  badge,
  action,
  children,
  padding = 'md', // 'none' | 'xs' | 'sm' | 'md' | 'lg'
  glow = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  id,
}) {
  const padClass = spacingClasses.padding[padding] || spacingClasses.padding.md;

  return (
    <div
      id={id}
      className={`glass-panel border transition-all duration-200 ${borderRadius.lg} ${
        glow
          ? 'border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
          : 'border-cyan-500/20 shadow-lg'
      } ${className}`}
    >
      {(title || Icon || badge || action) && (
        <div
          className={`flex items-center justify-between border-b border-cyan-500/10 px-4 py-3 ${headerClassName}`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-cyan-400 shrink-0" />}
            {title && (
              <h3 className="text-xs font-bold text-white tracking-wide truncate">
                {title}
              </h3>
            )}
            {badge && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 shrink-0">
                {badge}
              </span>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`${padClass} ${bodyClassName}`}>{children}</div>
    </div>
  );
}
