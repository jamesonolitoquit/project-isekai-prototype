/**
 * Phase 23 Task 3: Metrics Dashboard Component
 * Real-time visualization of multiplayer performance metrics
 */

'use client';

import React, { useEffect, useState } from 'react';
import type { MetricsSnapshot } from '../server/metricsCollector';

interface MetricsResponse {
  current: MetricsSnapshot;
  history: MetricsSnapshot[];
  peakActiveConnections: number;
  averageConsensusLagMs: number;
}

interface GuageColor {
  background: string;
  text: string;
  value: string;
}

const getLatencyColor = (ms: number): GuageColor => {
  if (ms < 50) return { background: 'bg-green-900', text: 'text-green-400', value: 'green' };
  if (ms < 100) return { background: 'bg-yellow-900', text: 'text-yellow-400', value: 'yellow' };
  return { background: 'bg-red-900', text: 'text-red-400', value: 'red' };
};

const getPercentageColor = (percent: number): string => {
  if (percent >= 95) return 'text-green-400';
  if (percent >= 80) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Real-time metrics dashboard for multiplayer monitoring
 */
export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '1h'>('5m');
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling) return;

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setMetrics(data);
        setLoadingError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setLoadingError(`Failed to load metrics: ${message}`);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1000);

    return () => clearInterval(interval);
  }, [polling]);

  if (loadingError) {
    return (
      <div className="p-8 bg-red-950 border border-red-700 rounded">
        <p className="text-red-200">⚠️ {loadingError}</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-700 rounded">
        <p className="text-slate-300">⏳ Loading metrics...</p>
      </div>
    );
  }

  const current = metrics.current;
  const latencyColor = getLatencyColor(current.dbLatencyMs);

  return (
    <div className="space-y-6 p-6 bg-slate-900 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-100">🎮 Multiplayer Metrics</h2>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-slate-300 text-sm"
          >
            <option value="1m">Last 1 min</option>
            <option value="5m">Last 5 min</option>
            <option value="1h">Last 1 hour</option>
          </select>
          <button
            onClick={() => setPolling(!polling)}
            className={`px-3 py-1 rounded text-sm ${
              polling ? 'bg-green-900 text-green-300' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {polling ? '▶️ Live' : '⏸️ Paused'}
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Players */}
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">👥 Active Players</p>
          <p className="text-3xl font-bold text-blue-400">{current.activeConnections}</p>
          <p className="text-xs text-slate-500 mt-1">Peak: {metrics.peakActiveConnections}</p>
        </div>

        {/* Message Queue Depth */}
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">📬 Queue Depth</p>
          <p className="text-3xl font-bold text-purple-400">{current.messageQueueDepth}</p>
          <p className="text-xs text-slate-500 mt-1">Messages pending</p>
        </div>

        {/* Consensus Lag */}
        <div className={`${latencyColor.background} p-4 rounded border border-slate-700`}>
          <p className={`${latencyColor.text} text-sm mb-2`}>⏱️ Consensus Lag</p>
          <p className={`text-3xl font-bold ${latencyColor.text}`}>{Math.round(current.consensusLagMs)} ms</p>
          <p className="text-xs text-slate-400 mt-1">Target: &lt;100ms</p>
        </div>

        {/* DB Latency */}
        <div className={`${latencyColor.background} p-4 rounded border border-slate-700`}>
          <p className={`${latencyColor.text} text-sm mb-2`}>🗄️ DB Latency</p>
          <p className={`text-3xl font-bold ${latencyColor.text}`}>{Math.round(current.dbLatencyMs)} ms</p>
          <p className="text-xs text-slate-400 mt-1">Query time</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {/* Trade Completion Rate */}
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">💰 Trade Success Rate</p>
          <p className={`text-3xl font-bold ${getPercentageColor(current.tradeCompletionRate * 100)}`}>
            {Math.round(current.tradeCompletionRate * 100)}%
          </p>
        </div>

        {/* Memory Usage */}
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">💾 Memory</p>
          <p className="text-3xl font-bold text-orange-400">{current.memoryUsageMb.toFixed(1)} MB</p>
          <p className="text-xs text-slate-500 mt-1">Per player: &lt;8MB</p>
        </div>

        {/* Tick Process Time */}
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">⚙️ Tick Time</p>
          <p className="text-3xl font-bold text-cyan-400">{Math.round(current.tickProcessTimeMs)} ms</p>
          <p className="text-xs text-slate-500 mt-1">Per world update</p>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="space-y-2 bg-slate-800 p-4 rounded border border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Consensus</span>
          <span className={current.consensusLagMs < 100 ? 'text-green-400' : 'text-red-400'}>
            {current.consensusLagMs < 100 ? '✅ Healthy' : '⚠️ Lagging'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Database</span>
          <span className={current.dbLatencyMs < 100 ? 'text-green-400' : 'text-red-400'}>
            {current.dbLatencyMs < 100 ? '✅ Responsive' : '⚠️ Slow'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Memory</span>
          <span className={current.memoryUsageMb < 500 ? 'text-green-400' : 'text-red-400'}>
            {current.memoryUsageMb < 500 ? '✅ Good' : '⚠️ High'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Trades</span>
          <span className={current.tradeCompletionRate >= 0.95 ? 'text-green-400' : 'text-yellow-400'}>
            {current.tradeCompletionRate >= 0.95 ? '✅ Excellent' : '⚠️ Watch'}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-xs text-slate-500 text-center">
        Last update: {new Date(current.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export default MetricsDashboard;
