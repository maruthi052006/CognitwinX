import React, { useState, useEffect } from 'react';
import { useTwinStore } from '../../store/twinStore';
import { api } from '../../services/api';
import { Play, Pause, RotateCcw, Clock, History, Waves } from 'lucide-react';

import Button from '../common/Button';

export default function TimelineScrubber() {
  const { scrubberProgress, setScrubberProgress, timelineSnapshots, setTimelineSnapshots, setCognitionLogs, activeZone } = useTwinStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState('2023-12-04');
  const [loadingReplay, setLoadingReplay] = useState(false);

  // Video-like playback loop
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setScrubberProgress((prev) => {
          if (prev >= 1.0) {
            setIsPlaying(false);
            return 1.0;
          }
          return Math.min(1.0, prev + 0.05);
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, setScrubberProgress]);

  // Load Historical Event Replay Data
  const loadHistoricalEvent = async (eventDate) => {
    if (!activeZone?.id) return;
    setLoadingReplay(true);
    try {
      const data = await api.getHistoricalReplay(activeZone.id, eventDate);
      if (data.snapshots && data.snapshots.length > 0) {
        setTimelineSnapshots(data.snapshots);
      }
      if (data.cognition_logs && data.cognition_logs.length > 0) {
        setCognitionLogs(data.cognition_logs);
      }
      setScrubberProgress(0.5); // start mid-storm
    } catch (err) {
      console.error('Failed to load historical replay:', err);
    } finally {
      setLoadingReplay(false);
    }
  };

  const handleToggleReplay = async () => {
    const nextMode = !replayMode;
    setReplayMode(nextMode);
    setIsPlaying(false);

    if (nextMode) {
      await loadHistoricalEvent(selectedEvent);
    } else {
      // Revert to live zone history
      if (activeZone?.id) {
        const liveHist = await api.getZoneHistory(activeZone.id);
        setTimelineSnapshots(liveHist);
        const liveLogs = await api.getCognitionLogs();
        setCognitionLogs(liveLogs.results || liveLogs);
        setScrubberProgress(1.0);
      }
    }
  };

  const currentHourLabel = () => {
    if (replayMode) {
      const stepIdx = Math.min(
        timelineSnapshots.length - 1,
        Math.floor(scrubberProgress * timelineSnapshots.length)
      );
      const snap = timelineSnapshots[stepIdx];
      return snap ? `Replay: ${snap.time_label || snap.timestamp}` : 'Historical Event';
    }
    const hoursAgo = Math.round((1.0 - scrubberProgress) * 24);
    if (hoursAgo === 0) return 'T-0h (Real-time Live)';
    return `T-${hoursAgo}h ago`;
  };

  return (
    <div className="glass-panel rounded-xl p-3 border border-cyan-500/20 flex flex-col md:flex-row items-center gap-4 w-full">
      {/* Controls */}
      <div className="flex items-center space-x-2 shrink-0">
        <Button
          size="icon"
          variant="outline"
          icon={isPlaying ? Pause : Play}
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause timeline playback' : 'Play timeline animation'}
          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-400/40"
        />

        <Button
          size="icon"
          variant="secondary"
          icon={RotateCcw}
          onClick={() => { setIsPlaying(false); setScrubberProgress(0.0); }}
          title="Reset to beginning"
        />
      </div>

      {/* Scrubber Label */}
      <div className="flex items-center space-x-2 min-w-[190px] text-xs shrink-0">
        <Clock className="w-4 h-4 text-cyan-400" />
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">
            {replayMode ? 'Event Reconstruction' : 'Timeline Playback'}
          </div>
          <div className="font-bold text-white font-mono">{currentHourLabel()}</div>
        </div>
      </div>

      {/* Slider track */}
      <div className="flex-1 w-full flex items-center space-x-3">
        <span className="text-[10px] text-slate-400 font-mono">
          {replayMode ? 'T+0h' : '-24h'}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={scrubberProgress}
          onChange={(e) => {
            setIsPlaying(false);
            setScrubberProgress(parseFloat(e.target.value));
          }}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 focus:outline-none"
        />
        <span className="text-[10px] text-cyan-400 font-mono font-bold">
          {replayMode ? 'Peak' : 'Now'}
        </span>
      </div>

      {/* Historical Replay Mode Toggle & Event Selector */}
      <div className="flex items-center space-x-2 border-l border-slate-800 pl-3 shrink-0">
        <Button
          size="sm"
          variant={replayMode ? 'activeTab' : 'secondary'}
          icon={History}
          onClick={handleToggleReplay}
          className={replayMode ? 'bg-purple-950/80 text-purple-300 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : ''}
          title="Toggle 3D Historical Replay Mode"
        >
          <span className="whitespace-nowrap">{replayMode ? 'Replay Active' : 'Historical Replay'}</span>
        </Button>

        {replayMode && (
          <select
            value={selectedEvent}
            onChange={(e) => {
              setSelectedEvent(e.target.value);
              loadHistoricalEvent(e.target.value);
            }}
            className="bg-slate-900 border border-purple-500/40 text-purple-300 text-[10px] rounded-lg px-2 py-1 outline-none font-mono cursor-pointer"
          >
            <option value="2023-12-04">Dec 2023 (Michaung)</option>
            <option value="2021-11-10">Nov 2021 (Monsoon)</option>
            <option value="2024-06-15">Jun 2024 (Basin Peak)</option>
          </select>
        )}
      </div>
    </div>
  );
}

