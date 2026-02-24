/**
 * Phase 4 Task 1: Director Telemetry HUD
 * 
 * Real-time visualization of cluster health metrics for Directors:
 * - Peer latency heatmap with color-coding
 * - Network throughput (events/tick)
 * - State divergence probability
 * - Consensus health status
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { 
  getConsensusHealth, 
  getFactionPowers, 
  getMacroEventCountdowns,
  getHealthStatusEmoji,
  formatLatency,
  type ConsensusHealth
} from '../../engine/diagnosticsEngine';
import type { SessionRegistry } from '../../engine/multiplayerEngine';

export interface DirectorTelemetryHUDProps {
  /**
   * Current world state
   */
  state: WorldState;

  /**
   * Multiplayer session registry (for peer info)
   */
  registry?: SessionRegistry;

  /**
   * Recent latency samples for percentile calculations
   */
  recentLatencies?: number[];

  /**
   * Current network throughput (events per tick)
   */
  throughputEpt?: number;

  /**
   * Estimated state divergence probability (0-1)
   */
  divergenceProbability?: number;

  /**
   * Whether HUD is minimized
   */
  isMinimized?: boolean;

  /**
   * Callback when toggling minimize
   */
  onToggleMinimize?: () => void;
}

/**
 * Get color for latency value
 */
function getLatencyColor(ms: number): string {
  if (ms < 50) return '#10b981'; // Green: Excellent
  if (ms < 100) return '#84cc16'; // Lime: Good
  if (ms < 150) return '#fbbf24'; // Amber: Acceptable
  if (ms < 200) return '#f97316'; // Orange: Poor
  return '#dc2626'; // Red: Critical
}

/**
 * Get color for divergence probability
 */
function getDivergenceColor(probability: number): string {
  if (probability < 0.01) return '#10b981'; // Green: Very safe
  if (probability < 0.05) return '#84cc16'; // Lime: Safe
  if (probability < 0.10) return '#fbbf24'; // Amber: Watch
  if (probability < 0.20) return '#f97316'; // Orange: Risky
  return '#dc2626'; // Red: Dangerous
}

/**
 * DirectorTelemetryHUD Component
 */
export const DirectorTelemetryHUD: React.FC<DirectorTelemetryHUDProps> = ({
  state,
  registry,
  recentLatencies,
  throughputEpt = 0,
  divergenceProbability = 0.03,
  isMinimized = false,
  onToggleMinimize
}) => {
  const [consensusHealth, setConsensusHealth] = useState<ConsensusHealth | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Update consensus health
  useEffect(() => {
    if (registry) {
      const health = getConsensusHealth(registry, recentLatencies);
      setConsensusHealth(health);
    }
  }, [registry, recentLatencies]);

  const factionPowers = useMemo(() => getFactionPowers(state), [state]);
  const macroEvents = useMemo(() => getMacroEventCountdowns(state), [state]);

  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '8px 12px',
          backgroundColor: '#1f2937',
          border: `2px solid ${consensusHealth?.healthStatus === 'green' ? '#10b981' : consensusHealth?.healthStatus === 'yellow' ? '#fbbf24' : '#dc2626'}`,
          color: '#e0e0e0',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 8000
        }}
      >
        📊 Telemetry
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '420px',
        maxHeight: '600px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: `2px solid ${consensusHealth?.healthStatus === 'green' ? '#10b981' : consensusHealth?.healthStatus === 'yellow' ? '#fbbf24' : '#dc2626'}`,
        borderRadius: '8px',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)',
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0e0e0',
        zIndex: 8000,
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #374151' }}>
        <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '13px' }}>
          📊 Director Telemetry
        </h3>
        <button
          onClick={onToggleMinimize}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0'
          }}
        >
          −
        </button>
      </div>

      {/* Consensus Health Summary */}
      {consensusHealth && (
        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Consensus Health</span>
            <span style={{ color: getLatencyColor(consensusHealth.avgLatency), fontWeight: 'bold' }}>
              {getHealthStatusEmoji(consensusHealth.healthStatus)}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#9ca3af', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <div>Avg: {formatLatency(consensusHealth.avgLatency)}</div>
            <div>P95: {formatLatency(consensusHealth.p95Latency)}</div>
            <div>P99: {formatLatency(consensusHealth.p99Latency)}</div>
            <div>Peers: {consensusHealth.peerCount}</div>
            <div>Queue: {consensusHealth.proposalQueueDepth}</div>
            <div>Success: {consensusHealth.consensusSuccessRate}%</div>
          </div>
        </div>
      )}

      {/* Peer Latency Heatmap */}
      {registry && registry.peers.size > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '6px', color: '#a78bfa', fontWeight: 'bold', fontSize: '11px' }}>
            👥 Peer Latency Heatmap
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(30px, 1fr))',
              gap: '4px',
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px'
            }}
          >
            {Array.from(registry.peers.values()).slice(0, 16).map((peer, idx) => {
              const latency = recentLatencies?.[idx] ?? 0;
              return (
                <div
                  key={peer.clientId}
                  title={`${peer.clientId}: ${formatLatency(latency)}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: getLatencyColor(latency),
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: '#6b7280' }}>
            {consensusHealth && (
              <span>Clock Drift: Max {consensusHealth.clockDrift.max.toFixed(0)}ms, Avg {consensusHealth.clockDrift.avg.toFixed(1)}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Network Performance */}
      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
        <div style={{ marginBottom: '6px', color: '#a78bfa', fontWeight: 'bold', fontSize: '11px' }}>
          📡 Network Performance
        </div>
        <div style={{ fontSize: '10px', color: '#9ca3af', display: 'grid', gap: '2px' }}>
          <div>Throughput: <span style={{ color: '#fbbf24' }}>{throughputEpt.toFixed(1)} events/tick</span></div>
          <div>Divergence: <span style={{ color: getDivergenceColor(divergenceProbability), fontWeight: 'bold' }}>
            {(divergenceProbability * 100).toFixed(2)}%
          </span></div>
          <div>Tick: <span style={{ color: '#c084fc' }}>{state.tick || 0}</span></div>
          <div>Paradox Level: <span style={{ color: '#ef4444' }}>{state.paradoxLevel || 0}</span></div>
        </div>
      </div>

      {/* Faction Powers (Abbreviated) */}
      {factionPowers.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '6px', color: '#a78bfa', fontWeight: 'bold', fontSize: '11px' }}>
            ⚔️ Faction Powers (Top 3)
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            {factionPowers.slice(0, 3).map(faction => (
              <div
                key={faction.factionId}
                style={{
                  padding: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderLeft: `3px solid ${faction.trend === 'rising' ? '#10b981' : faction.trend === 'falling' ? '#dc2626' : '#6b7280'}`,
                  borderRadius: '2px',
                  fontSize: '10px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                  {faction.name}
                  <span style={{ marginLeft: '4px', color: '#6b7280' }}>
                    {faction.trend === 'rising' ? '📈' : faction.trend === 'falling' ? '📉' : '➡️'}
                  </span>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '9px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>Mil: {faction.military.toFixed(0)}</div>
                  <div>Pol: {faction.political.toFixed(0)}</div>
                  <div>Eco: {faction.economic.toFixed(0)}</div>
                  <div>Spi: {faction.spiritual.toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro Events */}
      {macroEvents.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '6px', color: '#a78bfa', fontWeight: 'bold', fontSize: '11px' }}>
            🎬 Macro Events
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            {macroEvents.slice(0, 3).map(event => (
              <div
                key={event.eventId}
                style={{
                  padding: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderLeft: `3px solid ${event.severity >= 4 ? '#dc2626' : event.severity >= 3 ? '#f97316' : event.severity >= 2 ? '#fbbf24' : '#84cc16'}`,
                  borderRadius: '2px',
                  fontSize: '9px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                  {event.eventName}
                  <span style={{ marginLeft: '4px', color: '#6b7280' }}>ETA: {event.etaTicks} ticks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Refresh Toggle */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151', fontSize: '9px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#9ca3af' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Auto-refresh
        </label>
      </div>
    </div>
  );
};

export default DirectorTelemetryHUD;
