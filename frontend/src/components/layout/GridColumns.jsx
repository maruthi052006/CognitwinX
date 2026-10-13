import React from 'react';

/**
 * Responsive Grid component primitives.
 * Enforces unified gutters, column ratios, and clean responsive collapse.
 */

export function ThreeColumnDashboardGrid({
  leftCol,
  centerCol,
  rightCol,
  mobileActiveTab = 'viewport', // 'zones' | 'viewport' | 'cognition'
  className = '',
}) {
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch w-full ${className}`}
    >
      {/* Left Column (3 of 12 on desktop): Basins & Risk Ranking */}
      <aside
        aria-label="Monitored Urban Basins"
        className={`lg:col-span-3 flex flex-col space-y-3 min-w-0 ${
          mobileActiveTab === 'zones' ? 'block' : 'hidden lg:flex'
        }`}
      >
        {leftCol}
      </aside>

      {/* Center Column (6 of 12 on desktop): 3D Twin Viewport */}
      <section
        aria-label="3D Digital Twin Viewport"
        className={`lg:col-span-6 flex flex-col space-y-3 min-w-0 ${
          mobileActiveTab === 'viewport' ? 'block' : 'hidden lg:flex'
        }`}
      >
        {centerCol}
      </section>

      {/* Right Column (3 of 12 on desktop): Multi-Agent Cognition & What-If */}
      <aside
        aria-label="Cognition Feed & Simulation"
        className={`lg:col-span-3 flex flex-col space-y-3 min-w-0 ${
          mobileActiveTab === 'cognition' ? 'block' : 'hidden lg:flex'
        }`}
      >
        {rightCol}
      </aside>
    </div>
  );
}

export function TwoColumnGrid({
  mainCol,
  sideCol,
  mainSpan = 'lg:col-span-8',
  sideSpan = 'lg:col-span-4',
  className = '',
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full ${className}`}>
      <div className={`${mainSpan} w-full space-y-4`}>{mainCol}</div>
      <div className={`${sideSpan} w-full space-y-4`}>{sideCol}</div>
    </div>
  );
}

export default {
  ThreeColumnDashboardGrid,
  TwoColumnGrid,
};
