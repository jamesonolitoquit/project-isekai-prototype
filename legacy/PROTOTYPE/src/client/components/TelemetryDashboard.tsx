/**
 * Phase 26 Task 4: Live Ops Telemetry Dashboard
 * Real-time visualization of world engine health, GST tension, and hotspot activity
 * Bridges telemetryEngine metrics with live ops decision-making
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';

/**
 * Type matching telemetryEngine.ts TelemetryPulse interface
 */
interface TelemetryPulse {
  timestamp: number;
  totalPlayers: number;
  activeConnections: number;
  consensusLagMs: number;
  hotspots: Array<{
    locationId: string;
    locationName: string;
    playerCount: number;
    density: 'low' | 'moderate' | 'high' | 'critical';
  }>;
  economyHealth: number;           // 0-100
  socialTension: number;           // 0-1
  adaptiveThrottleMultiplier: number; // 0.2-1.0
  snapshotWriteLatencyMs?: number;
  snapshotReadLatencyMs?: number;
  deltReplayCountAverage?: number;
}

interface TelemetryHistoryPoint {
  timestamp: number;
  consensusLagMs: number;
  snapshotWriteLatencyMs: number;
  socialTension: number;
}

/**
 * Get color for consensus lag status
 */
function getConsensusLagColor(ms: number): { bg: string; text: string; label: string } {
  if (ms < 50) return { bg: 'bg-emerald-900', text: 'text-emerald-400', label: '✓ Optimal' };
  if (ms < 100) return { bg: 'bg-amber-900', text: 'text-amber-400', label: '⚠ Elevated' };
  if (ms < 200) return { bg: 'bg-orange-900', text: 'text-orange-400', label: '⚠ High' };
  return { bg: 'bg-red-900', text: 'text-red-400', label: '✗ Critical' };
}

/**
 * Get color for GST tension gauge
 */
function getTensionColor(tension: number): { bg: string; glow: string; label: string } {
  if (tension < 0.3) return { bg: 'from-blue-600 to-cyan-500', glow: 'shadow-blue-500/50', label: 'Calm' };
  if (tension < 0.6) return { bg: 'from-cyan-500 to-yellow-500', glow: 'shadow-yellow-500/50', label: 'Escalating' };
  if (tension < 0.85) return { bg: 'from-orange-500 to-red-500', glow: 'shadow-orange-500/50', label: 'Critical' };
  return { bg: 'from-red-600 to-crimson-700', glow: 'shadow-red-600/60', label: '⚡ Catastrophe' };
}

/**
 * Get color for hotspot density
 */
function getDensityColor(density: string): string {
  switch (density) {
    case 'critical': return 'text-red-500 font-bold';
    case 'high': return 'text-orange-400';
    case 'moderate': return 'text-yellow-400';
    default: return 'text-green-400';
  }
}

/**
 * Sparkline component for historical metrics
 */
function Sparkline({ data, max }: { data: number[]; max: number }) {
  const width = 200;
  const height = 30;
  const padding = 2;

  if (data.length < 2) {
    return (
      <div className="w-full h-6 bg-slate-800 rounded opacity-50 flex items-center justify-center text-xs text-slate-500">
        Collecting data...
      </div>
    );
  }

  const pointSpacing = (width - padding * 2) / (data.length - 1);
  const scaleFactor = (height - padding * 2) / Math.max(max, 1);

  const points = data.map((value, i) => {
    const x = padding + i * pointSpacing;
    const y = height - padding - value * scaleFactor;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="w-full h-6">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-cyan-400"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Main Telemetry Dashboard Component
 */
export function TelemetryDashboard() {
  const [currentPulse, setCurrentPulse] = useState<TelemetryPulse | null>(null);
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<TelemetryHistoryPoint[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        // In a real implementation, this would fetch from the dev API
        // For now, we'll depend on the world engine to provide telemetry
        // This is a placeholder that would be connected to actual telemetry data
        
        // Simulated telemetry for demonstration
        const mockPulse: TelemetryPulse = {
          timestamp: Date.now(),
          totalPlayers: 4,
          activeConnections: 4,
          consensusLagMs: Math.random() * 100,
          hotspots: [
            { locationId: 'loc_village_center', locationName: 'Village Center', playerCount: 2, density: 'low' },
            { locationId: 'loc_tavern', locationName: 'Tavern', playerCount: 1, density: 'low' },
          ],
          economyHealth: 60 + Math.random() * 20,
          socialTension: 0.3 + Math.random() * 0.2,
          adaptiveThrottleMultiplier: 0.9,
          snapshotWriteLatencyMs: 15 + Math.random() * 20,
          snapshotReadLatencyMs: 10 + Math.random() * 15,
          deltReplayCountAverage: 50 + Math.random() * 40,
        };

        setCurrentPulse(mockPulse);
        setLoading(false);

        // Update history
        const newPoint: TelemetryHistoryPoint = {
          timestamp: mockPulse.timestamp,
          consensusLagMs: mockPulse.consensusLagMs,
          snapshotWriteLatencyMs: mockPulse.snapshotWriteLatencyMs ?? 0,
          socialTension: mockPulse.socialTension,
        };

        historyRef.current = [...historyRef.current.slice(-59), newPoint]; // Keep last 60 points
        setHistory([...historyRef.current]);
      } catch (err) {
        console.error('[TelemetryDashboard] Error fetching telemetry:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
        setLoading(false);
      }
    };

    // Fetch immediately and then every 10 seconds (matching TELEMETRY_PULSE interval)
    fetchTelemetry();
    pollIntervalRef.current = setInterval(fetchTelemetry, 10000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-cyan-400 text-xl mb-4">Initializing Telemetry Dashboard...</div>
          <div className="animate-pulse text-slate-400 text-sm">Waiting for engine metrics (10s pulse)</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400">
          <div className="text-xl mb-2">Telemetry Error</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!currentPulse) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">No telemetry data available</div>
      </div>
    );
  }

  const consensusColor = getConsensusLagColor(currentPulse.consensusLagMs);
  const tensionColor = getTensionColor(currentPulse.socialTension);
  const consensusHistory = history.map(p => p.consensusLagMs);
  const snapshotHistory = history.map(p => p.snapshotWriteLatencyMs);
  const tensionHistory = history.map(p => p.socialTension);

  const hasFragmentationWarning = (currentPulse.deltReplayCountAverage ?? 0) > 150;
  const snapshotWriteLatencyWarning = (currentPulse.snapshotWriteLatencyMs ?? 0) > 50;
  const snapshotReadLatencyWarning = (currentPulse.snapshotReadLatencyMs ?? 0) > 30;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 font-mono text-slate-100">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                Live Ops Telemetry Dashboard
              </h1>
              <div className="text-sm text-slate-400 mt-1">Phase 26 Task 4 - Engine Health Monitor</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Last Update</div>
              <div className="text-sm text-cyan-400">
                {new Date(currentPulse.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {(hasFragmentationWarning || snapshotWriteLatencyWarning || snapshotReadLatencyWarning) && (
          <div className="space-y-2">
            {hasFragmentationWarning && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                <span className="text-red-400 font-bold text-lg">⚠</span>
                <div>
                  <div className="text-red-300 font-semibold">Fragmentation Warning</div>
                  <div className="text-red-200 text-sm">
                    Delta replay: {currentPulse.deltReplayCountAverage?.toFixed(1)} (threshold: 150)
                  </div>
                </div>
              </div>
            )}
            {snapshotWriteLatencyWarning && (
              <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3 flex items-start gap-2">
                <span className="text-orange-400 font-bold text-lg">⚠</span>
                <div>
                  <div className="text-orange-300 font-semibold">Snapshot Write Latency High</div>
                  <div className="text-orange-200 text-sm">
                    {currentPulse.snapshotWriteLatencyMs?.toFixed(2)}ms (threshold: 50ms)
                  </div>
                </div>
              </div>
            )}
            {snapshotReadLatencyWarning && (
              <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3 flex items-start gap-2">
                <span className="text-orange-400 font-bold text-lg">⚠</span>
                <div>
                  <div className="text-orange-300 font-semibold">Snapshot Read Latency High</div>
                  <div className="text-orange-200 text-sm">
                    {currentPulse.snapshotReadLatencyMs?.toFixed(2)}ms (threshold: 30ms)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Gauges */}
          <div className="space-y-4">
            {/* GST Tension Gauge */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Global Social Tension</div>
              <div
                className={`relative w-full h-40 rounded-lg bg-gradient-to-br ${tensionColor.bg} ${tensionColor.glow} shadow-lg overflow-hidden flex items-center justify-center`}
              >
                <div className="absolute inset-0 opacity-20">
                  <div className="w-full h-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]"></div>
                </div>
                <div className="relative z-10 text-center">
                  <div className="text-5xl font-bold text-white drop-shadow-lg">
                    {(currentPulse.socialTension * 100).toFixed(0)}%
                  </div>
                  <div className="text-xl text-white/90 mt-2 drop-shadow">{tensionColor.label}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">Range: 0% (calm) → 100% (catastrophe)</div>
            </div>

            {/* Consensus Lag Status */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Consensus Lag</div>
              <div className={`${consensusColor.bg} rounded-lg p-4 text-center`}>
                <div className="text-3xl font-bold text-white mb-1">
                  {currentPulse.consensusLagMs.toFixed(0)}ms
                </div>
                <div className={`text-sm font-semibold ${consensusColor.text}`}>
                  {consensusColor.label}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">30s Trend</div>
                <Sparkline data={consensusHistory} max={200} />
              </div>
            </div>

            {/* Adaptive Throttle */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Adaptive Throttle</div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold text-cyan-400">
                  {(currentPulse.adaptiveThrottleMultiplier * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mb-1">
                  {currentPulse.adaptiveThrottleMultiplier === 1.0 && '(Full: 20Hz)'}
                  {currentPulse.adaptiveThrottleMultiplier === 0.7 && '(Reduced: 14Hz)'}
                  {currentPulse.adaptiveThrottleMultiplier === 0.4 && '(Throttled: 8Hz)'}
                  {currentPulse.adaptiveThrottleMultiplier === 0.2 && '(Minimal: 4Hz)'}
                  {![1.0, 0.7, 0.4, 0.2].includes(currentPulse.adaptiveThrottleMultiplier) && '(Custom)'}
                </div>
              </div>
              <div className="mt-3 w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${currentPulse.adaptiveThrottleMultiplier * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Middle Column: Health Metrics */}
          <div className="space-y-4">
            {/* Snapshot Performance */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Snapshot Performance</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">Write Latency</span>
                    <span className={`text-xs font-semibold ${snapshotWriteLatencyWarning ? 'text-orange-400' : 'text-green-400'}`}>
                      {currentPulse.snapshotWriteLatencyMs?.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${snapshotWriteLatencyWarning ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{
                        width: `${Math.min(100, (currentPulse.snapshotWriteLatencyMs ?? 0) / 0.5)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">Read Latency</span>
                    <span className={`text-xs font-semibold ${snapshotReadLatencyWarning ? 'text-orange-400' : 'text-green-400'}`}>
                      {currentPulse.snapshotReadLatencyMs?.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${snapshotReadLatencyWarning ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{
                        width: `${Math.min(100, (currentPulse.snapshotReadLatencyMs ?? 0) / 0.3)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">Delta Replay Avg</span>
                    <span className={`text-xs font-semibold ${hasFragmentationWarning ? 'text-red-400' : 'text-green-400'}`}>
                      {currentPulse.deltReplayCountAverage?.toFixed(0)} events
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${hasFragmentationWarning ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        width: `${Math.min(100, (currentPulse.deltReplayCountAverage ?? 0) / 1.5)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Economy Health */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Economy Health</div>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold text-amber-400">
                  {currentPulse.economyHealth.toFixed(0)}
                </div>
                <div className="text-xs text-slate-500 mb-1">/ 100</div>
              </div>
              <div className="mt-3 w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                  style={{ width: `${currentPulse.economyHealth}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {currentPulse.economyHealth >= 75 && '✓ Prosperous'}
                {currentPulse.economyHealth >= 50 && currentPulse.economyHealth < 75 && '→ Stable'}
                {currentPulse.economyHealth >= 25 && currentPulse.economyHealth < 50 && '⚠ Declining'}
                {currentPulse.economyHealth < 25 && '✗ Stagnant'}
              </div>
            </div>

            {/* Player Stats */}
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-3">Player Activity</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-2xl font-bold text-cyan-400">{currentPulse.totalPlayers}</div>
                  <div className="text-xs text-slate-500">Total Players</div>
                </div>
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-2xl font-bold text-cyan-400">{currentPulse.activeConnections}</div>
                  <div className="text-xs text-slate-500">Connections</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hotspots */}
          <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-3">Location Hotspots</div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentPulse.hotspots.length === 0 ? (
                <div className="text-slate-500 text-center py-4 text-sm">No active hotspots</div>
              ) : (
                currentPulse.hotspots.map((hotspot, i) => (
                  <div key={hotspot.locationId} className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-200">
                          #{i + 1} {hotspot.locationName}
                        </div>
                        <div className={`text-xs mt-1 ${getDensityColor(hotspot.density)}`}>
                          {hotspot.density.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-cyan-400">{hotspot.playerCount}</div>
                        <div className="text-xs text-slate-500">players</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${
                          hotspot.density === 'critical'
                            ? 'bg-red-500'
                            : hotspot.density === 'high'
                              ? 'bg-orange-500'
                              : hotspot.density === 'moderate'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (hotspot.playerCount / 15) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800 border border-cyan-500/30 rounded-lg p-3 text-center text-xs text-slate-400">
          <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full animate-pulse mr-2"></span>
          Live data updates every 10 seconds | Snapshot metrics interval: 100 ticks
        </div>
      </div>
    </div>
  );
}

export default TelemetryDashboard;
