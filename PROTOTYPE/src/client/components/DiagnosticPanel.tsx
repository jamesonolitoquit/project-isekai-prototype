/**
 * M42 Task 3.2a: Diagnostic Panel Component
 *
 * Real-time sidebar showing:
 * - 3 tabs: Faction Power | Consensus | Macro Events
 * - Faction Power: Stacked bar chart showing military/political/economic/spiritual
 * - Consensus: Latency rolling window, peer counter, queue depth
 * - Macro Events: Countdown timers with event previews
 *
 * Updates on state mutations and auto-refreshes every 500ms
 */

import React, { useState, useEffect } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import type { SessionRegistry } from '../../engine/multiplayerEngine';
import {
  getDiagnosticsSnapshot,
  formatLatency,
  formatETA,
  getLatencyHealthColor,
  getConsensusHealthColor,
  getFactionPowerDisplay
} from '../../engine/diagnosticsEngine';
import '../../styles/diagnostic-panel.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DiagnosticPanelProps {
  state: WorldState;
  registry?: SessionRegistry;
  isExpanded?: boolean;
  latencyHistory?: number[];
  proposalMetrics?: { totalProposals: number; successfulProposals: number };
}

// ============================================================================
// DIAGNOSTIC PANEL COMPONENT
// ============================================================================

type DiagnosticTab = 'factions' | 'consensus' | 'events';

const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  state,
  registry,
  isExpanded = true,
  latencyHistory = [],
  proposalMetrics
}) => {
  const [activeTab, setActiveTab] = useState<DiagnosticTab>('factions');
  const [snapshot, setSnapshot] = useState(
    getDiagnosticsSnapshot(state, registry, latencyHistory, proposalMetrics)
  );

  // Auto-refresh snapshot when state or registry changes
  useEffect(() => {
    setSnapshot(getDiagnosticsSnapshot(state, registry, latencyHistory, proposalMetrics));
  }, [state, registry, latencyHistory, proposalMetrics]);

  // =========================================================================
  // RENDER: FACTIONS TAB
  // =========================================================================

  const renderFactionsTab = () => {
    if (snapshot.factionPowers.length === 0) {
      return <div className="diagnostic-empty">No factions detected</div>;
    }

    return (
      <div className="diagnostic-content">
        <h3 className="tab-header">Faction Power Balance</h3>

        <div className="factions-grid">
          {snapshot.factionPowers.map(faction => {
            const display = getFactionPowerDisplay(faction);

            return (
              <div key={faction.factionId} className="faction-card">
                <div className="faction-header">
                  <div className="faction-name">{display.label}</div>
                  <div className={`faction-trend trend-${faction.trend}`}>{faction.trend}</div>
                </div>

                <div className="power-bar-container">
                  <div className="power-bar-background">
                    {display.breakdown
                      .filter(b => b.width > 0)
                      .map((segment, idx) => (
                        <div
                          key={idx}
                          className="power-bar-segment"
                          style={{
                            width: `${segment.width}%`,
                            backgroundColor: segment.color
                          }}
                          title={`${segment.type}: ${Math.round(segment.width)}%`}
                        />
                      ))}
                  </div>
                  <div className="power-total">{faction.totalPower}/100</div>
                </div>

                <div className="power-breakdown">
                  <div className="power-item">
                    <span className="power-type" style={{ color: '#ff6b6b' }}>
                      ⚔️ Military
                    </span>
                    <span className="power-value">{faction.breakdown.military}</span>
                  </div>
                  <div className="power-item">
                    <span className="power-type" style={{ color: '#4ecdc4' }}>
                      🏛️ Political
                    </span>
                    <span className="power-value">{faction.breakdown.political}</span>
                  </div>
                  <div className="power-item">
                    <span className="power-type" style={{ color: '#ffd700' }}>
                      💰 Economic
                    </span>
                    <span className="power-value">{faction.breakdown.economic}</span>
                  </div>
                  <div className="power-item">
                    <span className="power-type" style={{ color: '#a78bfa' }}>
                      ✨ Spiritual
                    </span>
                    <span className="power-value">{faction.breakdown.spiritual}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER: CONSENSUS TAB
  // =========================================================================

  const renderConsensusTab = () => {
    const { consensusHealth } = snapshot;

    const latencyColor = getLatencyHealthColor(consensusHealth.p95Latency);
    const consensusColor = getConsensusHealthColor(consensusHealth.consensusSuccessRate);

    return (
      <div className="diagnostic-content">
        <h3 className="tab-header">Cluster Health</h3>

        <div className="consensus-grid">
          {/* Peer Count */}
          <div className="consensus-card">
            <div className="card-label">Connected Peers</div>
            <div className="card-value">{consensusHealth.peerCount}</div>
            <div className="card-status">
              {consensusHealth.peerCount > 1 ? '✓ Multiplayer' : '⚬ Solo'}
            </div>
          </div>

          {/* Average Latency */}
          <div className="consensus-card">
            <div className="card-label">Avg Latency</div>
            <div className="card-value">{formatLatency(consensusHealth.avgLatency)}</div>
            <div className="card-subtext">
              P95: {formatLatency(consensusHealth.p95Latency)}
            </div>
          </div>

          {/* P99 Latency */}
          <div className="consensus-card">
            <div className="card-label">P99 Latency</div>
            <div className="card-value">{formatLatency(consensusHealth.p99Latency)}</div>
            <div className={`card-status status-${getLatencyHealthColor(consensusHealth.p99Latency)}`}>
              {consensusHealth.p99Latency < 100 ? '✓ Good' : '⚠ High'}
            </div>
          </div>

          {/* Clock Drift */}
          <div className="consensus-card">
            <div className="card-label">Max Clock Drift</div>
            <div className="card-value">{formatLatency(consensusHealth.maxClockDrift)}</div>
          </div>

          {/* Queue Depth */}
          <div className="consensus-card">
            <div className="card-label">Proposal Queue</div>
            <div className="card-value">{consensusHealth.proposalQueueDepth}</div>
            <div className="card-status">
              {consensusHealth.proposalQueueDepth === 0 ? '✓ Clear' : '⚠ Busy'}
            </div>
          </div>

          {/* Success Rate */}
          <div className="consensus-card">
            <div className="card-label">Consensus Success</div>
            <div className="card-value">{Math.round(consensusHealth.consensusSuccessRate * 100)}%</div>
            <div className={`card-status status-${consensusColor}`}>
              {consensusHealth.consensusSuccessRate > 0.9
                ? '✓ Stable'
                : consensusHealth.consensusSuccessRate > 0.7
                ? '⚠ Degraded'
                : '✗ Critical'}
            </div>
          </div>
        </div>

        {/* Latency Rolling Window Chart (simplified) */}
        <div className="latency-chart-container">
          <div className="chart-label">Latency Trend (last 50 samples)</div>
          <div className="latency-chart">
            {latencyHistory.slice(-50).map((value, idx) => {
              const height = Math.min(80, (value / Math.max(...latencyHistory)) * 80 || 0);
              const color = getLatencyHealthColor(value);
              return (
                <div
                  key={idx}
                  className={`chart-bar bar-${color}`}
                  style={{ height: `${height}px` }}
                  title={`${formatLatency(value)}`}
                />
              );
            })}
          </div>
          <div className="chart-axis">0ms — {formatLatency(Math.max(...latencyHistory))} max</div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER: EVENTS TAB
  // =========================================================================

  const renderEventsTab = () => {
    if (snapshot.macroEvents.length === 0) {
      return <div className="diagnostic-empty">No upcoming events</div>;
    }

    return (
      <div className="diagnostic-content">
        <h3 className="tab-header">Macro Events</h3>

        <div className="events-list">
          {snapshot.macroEvents.map(event => {
            const isImminent = event.etaTicks < 50; // < 2.5 sec
            const isWarning = event.etaTicks < 200; // < 10 sec

            return (
              <div
                key={event.eventId}
                className={`event-card ${isImminent ? 'imminent' : ''} ${isWarning ? 'warning' : ''}`}
              >
                <div className="event-header">
                  <div className="event-icon">{event.icon || '📍'}</div>
                  <div className="event-info">
                    <div className="event-name">{event.eventName}</div>
                    <div className="event-type">{event.eventType}</div>
                  </div>
                </div>

                <div className="event-countdown">
                  <div className="countdown-value">{formatETA(event.etaMs)}</div>
                  <div className="countdown-label">Remaining</div>
                </div>

                {event.description && (
                  <div className="event-description">{event.description}</div>
                )}

                {event.factionImpact && event.factionImpact.length > 0 && (
                  <div className="event-impact">
                    <strong>Affects:</strong> {event.factionImpact.join(', ')}
                  </div>
                )}

                {isImminent && <div className="imminent-badge">IMMINENT</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  if (!isExpanded) {
    return (
      <div className="diagnostic-panel-collapsed">
        <div className="collapse-icon">📊</div>
      </div>
    );
  }

  return (
    <div className="diagnostic-panel">
      <div className="diagnostic-header">
        <h2>System Diagnostics</h2>
        <div className="diagnostic-timestamp">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="diagnostic-tabs">
        <button
          className={`tab-button ${activeTab === 'factions' ? 'active' : ''}`}
          onClick={() => setActiveTab('factions')}
        >
          Factions
        </button>
        <button
          className={`tab-button ${activeTab === 'consensus' ? 'active' : ''}`}
          onClick={() => setActiveTab('consensus')}
        >
          Consensus
        </button>
        <button
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
      </div>

      <div className="diagnostic-tab-content">
        {activeTab === 'factions' && renderFactionsTab()}
        {activeTab === 'consensus' && renderConsensusTab()}
        {activeTab === 'events' && renderEventsTab()}
      </div>

      <div className="diagnostic-footer">
        <div className="footer-text">
          World Tick: <strong>{snapshot.worldTick}</strong>
        </div>
        <div className="footer-text">
          Updated: <strong>{new Date(snapshot.timestamp).toLocaleTimeString()}</strong>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPanel;
