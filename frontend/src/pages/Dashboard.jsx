import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useTwinStore } from '../store/twinStore';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { useDeviceCapability } from '../components/common/useDeviceCapability';
import ZoneCard from '../components/dashboard/ZoneCard';
import TwinCognitionFeed from '../components/dashboard/TwinCognitionFeed';
import TimelineScrubber from '../components/dashboard/TimelineScrubber';
import AlertBanner from '../components/dashboard/AlertBanner';
import WhatIfSliders from '../components/simulator/WhatIfSliders';
import ResponsiveFallback2D from '../components/common/ResponsiveFallback2D';
import DataProvenanceBadge from '../components/dashboard/DataProvenanceBadge';
import ZoneRiskComparisonWidget from '../components/dashboard/ZoneRiskComparisonWidget';
import InfrastructureRiskPanel from '../components/dashboard/InfrastructureRiskPanel';
import { ThreeColumnDashboardGrid } from '../components/layout';
import { Layers, ShieldCheck, Cpu, RefreshCw, Compass, Waves, BarChart3, HardHat } from 'lucide-react';
import Button from '../components/common/Button';


// Lazy-load 3D CityTwinScene for fast shell loading (Section 5.6)
const CityTwinScene = lazy(() => import('../components/3d/CityTwinScene'));

export default function Dashboard() {
  const {
    zones,
    activeZone,
    selectedZoneId,
    setZones,
    setPredictions,
    setCognitionLogs,
    setAlerts,
    setTimelineSnapshots
  } = useTwinStore();

  const capability = useDeviceCapability();

  // Load initial backend data & connect WebSockets
  useEffect(() => {
    async function loadData() {
      try {
        const [zonesData, predsData, logsData, alertsData] = await Promise.all([
          api.getZones(),
          api.getLatestPredictions(),
          api.getCognitionLogs(),
          api.getAlerts()
        ]);

        setZones(zonesData);
        setPredictions(predsData);
        setCognitionLogs(logsData.results || logsData);
        setAlerts(alertsData.results || alertsData);

        if (zonesData.length > 0) {
          const hist = await api.getZoneHistory(zonesData[0].id);
          setTimelineSnapshots(hist);
        }
      } catch (err) {
        console.error('Initial data loading error:', err);
      }
    }

    loadData();
    wsClient.connect();

    return () => {
      wsClient.disconnect();
    };
  }, []);

  // Fetch zone history when active zone changes
  useEffect(() => {
    if (selectedZoneId) {
      api.getZoneHistory(selectedZoneId)
        .then(hist => setTimelineSnapshots(hist))
        .catch(err => console.error(err));
    }
  }, [selectedZoneId]);

  const [leftTab, setLeftTab] = useState('zones'); // 'zones' | 'ranking'
  const [rightTab, setRightTab] = useState('cognition'); // 'cognition' | 'upgrades'
  const [mobileTab, setMobileTab] = useState('viewport'); // 'zones' | 'viewport' | 'cognition'

  // Left Column Content: Monitored Basins or Risk Ranking
  const leftContent = (
    <div className="flex flex-col space-y-3 h-full lg:h-[calc(100vh-140px)] lg:min-h-[580px]">
      <div className="glass-panel p-1.5 rounded-xl border border-cyan-500/20 flex items-center space-x-1 shrink-0">
        <Button
          variant={leftTab === 'zones' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          icon={Layers}
          onClick={() => setLeftTab('zones')}
        >
          Monitored Basins
        </Button>
        <Button
          variant={leftTab === 'ranking' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          icon={BarChart3}
          onClick={() => setLeftTab('ranking')}
        >
          Risk Ranking
        </Button>
      </div>

      {leftTab === 'zones' ? (
        <>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[300px]">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                isSelected={selectedZoneId === zone.id}
              />
            ))}
          </div>

          {/* Bottom Hydro Benchmark Pill */}
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 text-[11px] text-slate-300 space-y-1 shrink-0">
            <div className="flex items-center space-x-1.5 font-bold text-cyan-300">
              <Waves className="w-3.5 h-3.5" />
              <span>Real-Time Hydro Proxy vs 13h Baseline</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Attention U-Net runs in <strong className="text-white">1.2 seconds</strong>, contrasting with FlowsDT-Galveston's 13-hour PCSWMM run.
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[300px]">
          <ZoneRiskComparisonWidget />
        </div>
      )}
    </div>
  );

  // Center Column Content: 3D Digital Twin Viewport + Timeline Scrubber
  const centerContent = (
    <div className="flex flex-col space-y-3 h-full lg:h-[calc(100vh-140px)] lg:min-h-[580px]">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider">3D Cognitive Twin</span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded border border-cyan-800">
            {activeZone?.name || 'Velachery Demo Zone'}
          </span>
        </div>
        <DataProvenanceBadge
          primarySarSource={activeZone?.primary_sar_source || 'eos4'}
          isroValidationScore={0.892}
          rainfallSource="NASA GES DISC IMERG"
          zoneName={activeZone?.name || 'Velachery Demo Zone'}
        />
      </div>

      <div className="flex-1 min-h-[440px] relative rounded-2xl overflow-hidden shadow-2xl border border-cyan-500/20">
        {capability.supports3D ? (
          <Suspense
            fallback={
              <div className="w-full h-full min-h-[440px] bg-slate-950 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <div className="text-xs font-mono text-cyan-300">Initializing 3D WebGL Digital Twin Shaders...</div>
              </div>
            }
          >
            <CityTwinScene />
          </Suspense>
        ) : (
          <ResponsiveFallback2D reason={capability.reason} />
        )}
      </div>

      {/* 24-Hour Timeline Scrubber & Historical Replay */}
      <div className="shrink-0">
        <TimelineScrubber />
      </div>
    </div>
  );

  // Right Column Content: Cognition Feed OR Upgrade Priorities + What-If Simulator
  const rightContent = (
    <div className="flex flex-col space-y-3 h-full lg:h-[calc(100vh-140px)] lg:min-h-[580px]">
      <div className="glass-panel p-1.5 rounded-xl border border-cyan-500/20 flex items-center space-x-1 shrink-0">
        <Button
          variant={rightTab === 'cognition' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          icon={Cpu}
          onClick={() => setRightTab('cognition')}
        >
          Cognition Feed
        </Button>
        <Button
          variant={rightTab === 'upgrades' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          icon={HardHat}
          onClick={() => setRightTab('upgrades')}
        >
          Upgrade Priorities
        </Button>
      </div>

      {/* Live Multi-Agent Cognition Feed or Infrastructure Risk Panel */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[300px]">
        {rightTab === 'cognition' ? (
          <TwinCognitionFeed />
        ) : (
          <InfrastructureRiskPanel />
        )}
      </div>

      {/* What-If Live Simulator */}
      <div className="shrink-0">
        <WhatIfSliders />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Emergency Alert Bar */}
      <AlertBanner />

      {/* Mobile & Tablet Tab Navigation Bar (< 1024px) */}
      <div className="lg:hidden flex items-center space-x-1 glass-panel p-1 rounded-xl border border-cyan-500/30">
        <Button
          variant={mobileTab === 'zones' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          onClick={() => setMobileTab('zones')}
          className="text-center justify-center font-bold"
        >
          Basins ({zones.length})
        </Button>
        <Button
          variant={mobileTab === 'viewport' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          onClick={() => setMobileTab('viewport')}
          className="text-center justify-center font-bold"
        >
          3D Twin
        </Button>
        <Button
          variant={mobileTab === 'cognition' ? 'activeTab' : 'inactiveTab'}
          size="tab"
          onClick={() => setMobileTab('cognition')}
          className="text-center justify-center font-bold"
        >
          Cognition / What-If
        </Button>
      </div>

      {/* 3-Column Mission Control Layout via ThreeColumnDashboardGrid */}
      <ThreeColumnDashboardGrid
        leftCol={leftContent}
        centerCol={centerContent}
        rightCol={rightContent}
        mobileActiveTab={mobileTab}
      />
    </div>
  );
}


