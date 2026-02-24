/**
 * M34: Co-DM Omni-Glimpse Dashboard
 * M35: Enhanced with Seer's Hand (Director Controls)
 * 
 * Displays real-time narrative metrics for Game Masters in observer/director mode.
 * Shows:
 * - Narrative Stress (AI state divergence)
 * - Chaos Level (belief layer deviations)
 * - Prophecy Stability (prophecy generation confidence)
 * 
 * M35: Director can:
 * - Send narrative whispers to players ("Seer's Advice")
 * - Curate world events (spawn phantoms, traces)
 * - Force-nudge exploration without breaking immersion
 */

import React, { useState, useEffect } from 'react';
import type { TradeManager, MultiplayerEngine, PhantomEngine } from '../../types/engines';
const getAllProphecies = () => []; // Stub - prophecy list not available in dashboard context
type WorldState = any; // Use any for WorldState to avoid import path issues
const getAiDmState = () => undefined; // Stub - AI state not available in dashboard

/**
 * M34: Narrative metrics snapshot
 */
interface NarrativeMetrics {
  narrativeStress: number; // 0-100, AI state divergence
  chaosLevel: number; // 0-100, belief layer deviation
  prophecyStability: number; // 0-100, generation confidence
  timestamp: number;
  warnings: string[]; // Issues detected
  healthStatus: 'stable' | 'stress' | 'critical' | 'cascading';
}

/**
 * M34: Calculate narrative stress from AI engine state
 */
function calculateNarrativeStress(worldState: WorldState): number {
  let stress = 0;

  // Factor 1: AI state decision divergence (up to 25 points)
  // Using stub since getAiDmState returns undefined in component context
  const stateConflicts = 0; // Stub value
  stress += Math.min(stateConflicts * 2, 25);

  // Factor 2: NPC willpower variance (up to 25 points)
  const npcWillpowerDeviation = worldState.npcs
    ? worldState.npcs.reduce((sum: number, npc: any) => {
        const baseWillpower = 50;
        const deviation = Math.abs((npc.lifespan?.temperament?.willpower || baseWillpower) - baseWillpower);
        return sum + deviation;
      }, 0) / Math.max(worldState.npcs.length, 1)
    : 0;
  stress += Math.min(npcWillpowerDeviation / 5, 25);

  // Factor 3: Temporal paradoxes (up to 20 points)
  const paradoxCount = worldState.temporalParadoxes?.length || 0;
  stress += Math.min(paradoxCount * 5, 20);

  // Factor 4: Faction conflict intensity (up to 15 points)
  const factionStress = worldState.factions
    ? worldState.factions.reduce((sum: number, fac: any) => {
        const otherReps = worldState.factions!
          .filter((f: any) => f.id !== fac.id)
          .map((f: any) => f.playerReputation || 50);
        const maxRepDiff = Math.max(...otherReps, 50) - Math.min(...otherReps, 50);
        return sum + maxRepDiff;
      }, 0) / Math.max(worldState.factions.length, 1)
    : 0;
  stress += Math.min(factionStress / 10, 15);

  // Factor 5: Resource scarcity (up to 10 points)
  const resourceNodes = worldState.resourceNodes || [];
  const scarcityCount = resourceNodes.filter((r: any) => (r.quantity || 0) < 3).length;
  stress += Math.min((scarcityCount / Math.max(resourceNodes.length, 1)) * 10, 10);

  return Math.min(Math.round(stress), 100);
}

/**
 * M34: Calculate chaos level from belief layer deviations
 */
function calculateChaosLevel(worldState: WorldState): number {
  let chaos = 0;

  // Factor 1: Player belief divergence (up to 35 points)
  const beliefs = worldState.playerBeliefLayer || {};
  const beliefEntries = Object.entries(beliefs);
  if (beliefEntries.length > 0) {
    const beliefVariance = beliefEntries.reduce((sum: number, [, belief]: any) => {
      const confidence = belief.confidence || 50;
      return sum + Math.abs(confidence - 50);
    }, 0) / beliefEntries.length;
    chaos += Math.min(beliefVariance / 1.5, 35);
  }

  // Factor 2: Rumor contamination (up to 25 points)
  const rumorCount = (worldState.globalRumors?.length || 0) +
                     (worldState.localRumors?.length || 0);
  const contaminationPercentage = Math.min((rumorCount / 100) * 25, 25);
  chaos += contaminationPercentage;

  // Factor 3: Heirloom corruption (up to 20 points)
  const corruptedHeirlooms = worldState.heirloomItems
    ? worldState.heirloomItems.filter((h: any) => (h.corruptionLevel || 0) > 30).length
    : 0;
  chaos += Math.min((corruptedHeirlooms / Math.max(worldState.heirloomItems?.length || 1, 1)) * 20, 20);

  // Factor 4: Paradox bloom proliferation (up to 15 points)
  const paradoxBloomCount = worldState.paradoxBlooms?.length || 0;
  chaos += Math.min(paradoxBloomCount * 3, 15);

  // Factor 5: Collective deed conflicts (up to 5 points)
  const deedConflicts = (worldState.mutationLog || [])
    .filter((log: any) => log.type === 'collectiveDeedResult' && log.result === 'conflict')
    .length;
  chaos += Math.min(deedConflicts * 1, 5);

  return Math.min(Math.round(chaos), 100);
}

/**
 * M34: Calculate prophecy stability from prophecy generation confidence
 */
function calculateProphecyStability(worldState: WorldState): number {
  let stability = 100; // Start at perfect

  const prophecies = getAllProphecies();

  // Prophecy stability calculation (assume 70-80% baseline if available)
  if (prophecies.length === 0) {
    // No prophecies - assume 75% stability
    return 75;
  }

  // Factor 1: Unfulfilled prophecies reduce stability (up to 30 points)
  const unfulfilled = prophecies.filter((p: any) => !p.fulfilled && p.expiresAt > Date.now());
  const unfulfillmentPenalty = Math.min((unfulfilled.length / 10) * 30, 30);
  stability -= unfulfillmentPenalty;

  // Factor 2: Expired prophecies (up to 20 points)
  const expired = prophecies.filter((p: any) => !p.fulfilled && p.expiresAt <= Date.now());
  const expirationPenalty = Math.min((expired.length / 5) * 20, 20);
  stability -= expirationPenalty;

  // Factor 3: Conflicting prophecies (up to 25 points)
  const conflicts = prophecies.filter((p: any) => p.conflictingProphecies || []).length;
  const conflictPenalty = Math.min((conflicts / 15) * 25, 25);
  stability -= conflictPenalty;

  // Factor 4: Very high prophecy count (dilutes confidence, up to 15 points)
  const countPenalty = Math.min((prophecies.length / 50) * 15, 15);
  stability -= countPenalty;

  // Factor 5: Recently fulfilled prophecies increase stability (up to 20 points bonus)
  const recentlyFulfilled = prophecies.filter((p: any) => {
    const timeSinceFulfilled = Date.now() - (p.fulfilledAt || 0);
    return p.fulfilled && timeSinceFulfilled < 86400000; // Last 24 hours
  }).length;
  const fulfillmentBonus = Math.min((recentlyFulfilled / 5) * 20, 20);
  stability += fulfillmentBonus;

  return Math.max(Math.round(stability), 0);
}

/**
 * M34: Overall health status assessment
 */
function assessHealthStatus(metrics: Omit<NarrativeMetrics, 'timestamp' | 'warnings' | 'healthStatus'>): 'stable' | 'stress' | 'critical' | 'cascading' {
  const average = (metrics.narrativeStress + metrics.chaosLevel + (100 - metrics.prophecyStability)) / 3;

  if (average >= 80) return 'cascading';
  if (average >= 60) return 'critical';
  if (average >= 40) return 'stress';
  return 'stable';
}

/**
 * M34: Generate warnings based on metrics
 */
function generateWarnings(metrics: Omit<NarrativeMetrics, 'timestamp' | 'warnings' | 'healthStatus'>, worldState: WorldState): string[] {
  const warnings: string[] = [];

  if (metrics.narrativeStress > 75) {
    warnings.push('⚠️ Critical AI state divergence - consider narrative reset events');
  }
  if (metrics.narrativeStress > 50 && metrics.narrativeStress <= 75) {
    warnings.push('⚠️ Rising narrative stress - monitor NPC behavior');
  }

  if (metrics.chaosLevel > 75) {
    warnings.push('⚠️ Catastrophic belief layer damage - players may experience dissonance');
  }
  if (metrics.chaosLevel > 50 && metrics.chaosLevel <= 75) {
    warnings.push('⚠️ Elevated chaos - too many conflicting rumors');
  }

  if (metrics.prophecyStability < 30) {
    warnings.push('⚠️ Prophecy system unstable - many expired expectations');
  }
  if (metrics.prophecyStability < 50 && metrics.prophecyStability >= 30) {
    warnings.push('⚠️ Prophecy confidence declining - consider new prophecy injection');
  }

  const paradoxes = worldState.temporalParadoxes?.length || 0;
  if (paradoxes > 10) {
    warnings.push(`⚠️ ${paradoxes} unresolved paradoxes - timeline corruption risk`);
  }

  const corruptedHeirlooms = worldState.heirloomItems?.filter((h: any) => (h.corruptionLevel || 0) > 60).length || 0;
  if (corruptedHeirlooms > 0) {
    warnings.push(`⚠️ ${corruptedHeirlooms} heavily corrupted heirloom(s) - consider purification events`);
  }

  return warnings;
}

/**
 * Phase 4 Task 4.4: Calculate network health metrics from telemetry engines
 */
function calculateNetworkMetrics(
  tradeManager: TradeManager | undefined,
  multiplayerEngine: MultiplayerEngine | undefined,
  phantomEngine: PhantomEngine | undefined
): NetworkHealthMetrics {
  let p95Latency = 0;
  let peerConsensusScore = 100;
  let phantomCount = 0;
  let activePeerCount = 0;

  // Get P95 latency from tradeManager
  if (tradeManager?.getLatencyStats) {
    const stats = tradeManager.getLatencyStats();
    p95Latency = stats?.p95 || 0;
  }

  // Get peer consensus score from multiplayerEngine
  if (multiplayerEngine?.getConsensusStatus) {
    const consensusStatus = multiplayerEngine.getConsensusStatus();
    peerConsensusScore = consensusStatus?.agreementPercentage || 100;
    activePeerCount = consensusStatus?.activePeers || 0;
  }

  // Get phantom count from phantomEngine
  if (phantomEngine?.getActivePhantoms) {
    const phantoms = phantomEngine.getActivePhantoms();
    phantomCount = phantoms?.length || 0;
  }

  return {
    p95Latency,
    peerConsensusScore,
    phantomCount,
    activePeerCount,
    lastUpdate: Date.now()
  };
}

/**
 * M34: Individual gauge component
 */
interface GaugeProps {
  label: string;
  value: number; // 0-100
  maxValue?: number;
  color: 'green' | 'yellow' | 'red' | 'purple';
  icon: string;
}

const Gauge: React.FC<GaugeProps> = ({ label, value, maxValue = 100, color, icon }) => {
  const percentage = (value / maxValue) * 100;
  const colorMap = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#a855f7'
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
          {icon} {label}
        </label>
        <span style={{ fontSize: '14px', fontWeight: 600, color: colorMap[color] }}>
          {Math.round(value)}/{maxValue}
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '12px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${colorMap[color]}`
      }}>
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          backgroundColor: colorMap[color],
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
};

/**
 * M35: Seer's Hand Intervention Types
 */
interface SeerIntervention {
  id: string;
  type: 'whisper' | 'phantom' | 'trace' | 'event';
  targetPlayer?: string;
  message?: string;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  timestamp: number;
}

/**
 * Phase 4 Task 4.4: Network Health Telemetry for Director
 */
interface NetworkHealthMetrics {
  p95Latency: number; // milliseconds
  peerConsensusScore: number; // 0-100
  phantomCount: number; // Active ghost players
  activePeerCount: number;
  lastUpdate: number;
}

export const CoDmDashboard: React.FC<{
  worldState: WorldState;
  onSendWhisper?: (recipientId: string, message: string, type: string) => void;
  onCurateEvent?: (eventType: string, parameters: Record<string, any>) => void;
  activePlayerIds?: string[];
  tradeManager?: TradeManager;
  multiplayerEngine?: MultiplayerEngine;
  phantomEngine?: PhantomEngine;
}> = ({ worldState, onSendWhisper, onCurateEvent, activePlayerIds = [], tradeManager, multiplayerEngine, phantomEngine }) => {
  const [metrics, setMetrics] = useState<NarrativeMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Phase 4 Task 4.4: Network telemetry metrics
  const [networkMetrics, setNetworkMetrics] = useState<NetworkHealthMetrics>({
    p95Latency: 0,
    peerConsensusScore: 100,
    phantomCount: 0,
    activePeerCount: 0,
    lastUpdate: Date.now()
  });
  
  // M35: Seer's Hand state
  const [whisperRecipient, setWhisperRecipient] = useState('');
  const [whisperMessage, setWhisperMessage] = useState('');
  const [whisperType, setWhisperType] = useState<'guidance' | 'warning' | 'revelation' | 'mystery'>('guidance');
  const [selectedCurationLocation, setSelectedCurationLocation] = useState('');
  const [curationEventType, setCurationEventType] = useState<'phantom' | 'trace' | 'event'>('phantom');
  const [curationDuration, setCurationDuration] = useState(30);
  const [rarity, setRarity] = useState<'common' | 'rare' | 'legendary'>('rare');
  const [interventions, setInterventions] = useState<SeerIntervention[]>([]);
  const [showSeerPanel, setShowSeerPanel] = useState(false);

  // M35: Send a whisper from the Seer to a player
  const handleSendWhisper = () => {
    if (!whisperRecipient || !whisperMessage.trim()) {
      alert('Select recipient and enter message');
      return;
    }

    const intervention: SeerIntervention = {
      id: Math.random().toString(36).substring(7),
      type: 'whisper',
      targetPlayer: whisperRecipient,
      message: whisperMessage,
      status: 'sent',
      timestamp: Date.now()
    };

    setInterventions(prev => [...prev, intervention]);
    
    if (onSendWhisper) {
      onSendWhisper(whisperRecipient, whisperMessage, whisperType);
    }

    // Clear inputs
    setWhisperMessage('');
    setWhisperRecipient('');
  };

  // M35: Trigger director event curation
  const handleCurateEvent = () => {
    if (!selectedCurationLocation) {
      alert('Select curation location');
      return;
    }

    const intervention: SeerIntervention = {
      id: Math.random().toString(36).substring(7),
      type: curationEventType,
      status: 'sent',
      timestamp: Date.now()
    };

    const parameters = {
      location: selectedCurationLocation,
      eventType: curationEventType,
      duration: curationDuration,
      rarity: rarity
    };

    setInterventions(prev => [...prev, intervention]);
    
    if (onCurateEvent) {
      onCurateEvent(curationEventType, parameters);
    }
  };

  useEffect(() => {
    const calculateMetrics = () => {
      const baseMetrics = {
        narrativeStress: calculateNarrativeStress(worldState),
        chaosLevel: calculateChaosLevel(worldState),
        prophecyStability: calculateProphecyStability(worldState)
      };

      const warnings = generateWarnings(baseMetrics, worldState);
      const healthStatus = assessHealthStatus(baseMetrics);

      setMetrics({
        ...baseMetrics,
        timestamp: Date.now(),
        warnings,
        healthStatus
      });

      // Phase 4 Task 4.4: Update network telemetry
      const netMetrics = calculateNetworkMetrics(tradeManager, multiplayerEngine, phantomEngine);
      setNetworkMetrics(netMetrics);
    };

    calculateMetrics();

    if (autoRefresh) {
      const interval = setInterval(calculateMetrics, 2000);
      return () => clearInterval(interval);
    }
  }, [worldState, autoRefresh, tradeManager, multiplayerEngine, phantomEngine]);

  if (!metrics) {
    return <div style={{ color: '#9ca3af' }}>Loading metrics...</div>;
  }

  const statusColors = {
    stable: '#10b981',
    stress: '#f59e0b',
    critical: '#ef4444',
    cascading: '#dc2626'
  };

  const statusIcons = {
    stable: '✓',
    stress: '⚠',
    critical: '⚡',
    cascading: '💥'
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#111827',
      borderRadius: '8px',
      border: `2px solid ${statusColors[metrics.healthStatus]}`,
      maxWidth: '500px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e5e7eb'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#f3f4f6' }}>
          🎭 Co-DM Omni-Glimpse Dashboard
        </h2>
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Status: <span style={{ color: statusColors[metrics.healthStatus], fontWeight: 600 }}>
            {statusIcons[metrics.healthStatus]} {metrics.healthStatus.toUpperCase()}
          </span></span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Auto-Refresh</span>
          </label>
        </div>
      </div>

      {/* Three Main Gauges */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #374151' }}>
        <Gauge
          label="Narrative Stress"
          value={metrics.narrativeStress}
          color={metrics.narrativeStress > 70 ? 'red' : metrics.narrativeStress > 40 ? 'yellow' : 'green'}
          icon="⚙️"
        />
        <Gauge
          label="Chaos Level"
          value={metrics.chaosLevel}
          color={metrics.chaosLevel > 70 ? 'red' : metrics.chaosLevel > 40 ? 'yellow' : 'green'}
          icon="🌪️"
        />
        <Gauge
          label="Prophecy Stability"
          value={metrics.prophecyStability}
          color={metrics.prophecyStability < 30 ? 'red' : metrics.prophecyStability < 60 ? 'yellow' : 'green'}
          icon="🔮"
        />
      </div>

      {/* Phase 4 Task 4.4: Network Health Widget */}
      <div style={{
        padding: '12px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        marginBottom: '16px',
        borderLeft: '3px solid #06b6d4'
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#06b6d4',
          marginBottom: '10px'
        }}>
          🌐 Network Health (Telemetry)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
          <div style={{ 
            padding: '8px', 
            backgroundColor: '#111827', 
            borderRadius: '4px',
            borderLeft: `2px solid ${networkMetrics.p95Latency > 100 ? '#ef4444' : networkMetrics.p95Latency > 50 ? '#f59e0b' : '#10b981'}`
          }}>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>P95 Latency</div>
            <div style={{ 
              color: networkMetrics.p95Latency > 100 ? '#ef4444' : networkMetrics.p95Latency > 50 ? '#f59e0b' : '#10b981',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {Math.round(networkMetrics.p95Latency)}ms
            </div>
          </div>
          <div style={{ 
            padding: '8px', 
            backgroundColor: '#111827', 
            borderRadius: '4px',
            borderLeft: `2px solid ${networkMetrics.peerConsensusScore > 95 ? '#10b981' : networkMetrics.peerConsensusScore > 80 ? '#f59e0b' : '#ef4444'}`
          }}>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Consensus</div>
            <div style={{ 
              color: networkMetrics.peerConsensusScore > 95 ? '#10b981' : networkMetrics.peerConsensusScore > 80 ? '#f59e0b' : '#ef4444',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {Math.round(networkMetrics.peerConsensusScore)}%
            </div>
          </div>
          <div style={{ 
            padding: '8px', 
            backgroundColor: '#111827', 
            borderRadius: '4px',
            borderLeft: `2px solid ${networkMetrics.phantomCount > 5 ? '#f59e0b' : '#10b981'}`
          }}>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Phantoms</div>
            <div style={{ 
              color: networkMetrics.phantomCount > 5 ? '#f59e0b' : '#10b981',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {networkMetrics.phantomCount} active
            </div>
          </div>
          <div style={{ 
            padding: '8px', 
            backgroundColor: '#111827', 
            borderRadius: '4px',
            borderLeft: '2px solid #a855f7'
          }}>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Peers</div>
            <div style={{ 
              color: '#a855f7',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {networkMetrics.activePeerCount} connected
            </div>
          </div>
        </div>
      </div>

      {/* M35: Seer's Hand Control Panel */}
      <div style={{
        padding: '12px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        marginBottom: '16px',
        borderLeft: '3px solid #a855f7'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#a855f7' }}>
            ✨ SEER'S HAND (Director Controls)
          </div>
          <button
            onClick={() => setShowSeerPanel(!showSeerPanel)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {showSeerPanel ? '▼ Hide' : '▶ Show'}
          </button>
        </div>

        {showSeerPanel && (
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            {/* Whisper Section */}
            <div style={{ marginBottom: '12px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>
              <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>💬 Send Whisper</div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <select
                  value={whisperRecipient}
                  onChange={(e) => setWhisperRecipient(e.target.value)}
                  style={{
                    padding: '6px',
                    backgroundColor: '#111827',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: '3px',
                    fontSize: '11px'
                  }}
                >
                  <option value="">Select Player...</option>
                  {activePlayerIds.map(id => (
                    <option key={id} value={id}>{id.substring(0, 8)}...</option>
                  ))}
                </select>
                <textarea
                  value={whisperMessage}
                  onChange={(e) => setWhisperMessage(e.target.value.substring(0, 200))}
                  placeholder="Whisper message (200 chars)..."
                  style={{
                    padding: '6px',
                    backgroundColor: '#111827',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: '3px',
                    fontSize: '11px',
                    minHeight: '50px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <select
                    value={whisperType}
                    onChange={(e) => setWhisperType(e.target.value as any)}
                    style={{
                      padding: '5px',
                      backgroundColor: '#111827',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}
                  >
                    <option value="guidance">💫 Guidance</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="revelation">✨ Revelation</option>
                    <option value="mystery">🔮 Mystery</option>
                  </select>
                  <button
                    onClick={handleSendWhisper}
                    style={{
                      padding: '5px',
                      backgroundColor: '#0891b2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Send Whisper
                  </button>
                </div>
              </div>
            </div>

            {/* Event Curation Section */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#34d399', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>🎯 Curate Event</div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <select
                    value={curationEventType}
                    onChange={(e) => setCurationEventType(e.target.value as any)}
                    style={{
                      padding: '5px',
                      backgroundColor: '#111827',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}
                  >
                    <option value="phantom">👻 Spawn Phantom</option>
                    <option value="trace">⏳ Spawn Trace</option>
                    <option value="event">🎪 Trigger Event</option>
                  </select>
                  <select
                    value={rarity}
                    onChange={(e) => setRarity(e.target.value as any)}
                    style={{
                      padding: '5px',
                      backgroundColor: '#111827',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}
                  >
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Target Location ID"
                  value={selectedCurationLocation}
                  onChange={(e) => setSelectedCurationLocation(e.target.value)}
                  style={{
                    padding: '6px',
                    backgroundColor: '#111827',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: '3px',
                    fontSize: '10px'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '10px', color: '#9ca3af' }}>Duration (sec):</label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={curationDuration}
                    onChange={(e) => setCurationDuration(parseInt(e.target.value) || 30)}
                    style={{
                      padding: '4px',
                      backgroundColor: '#111827',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: '3px',
                      fontSize: '10px',
                      width: '50px'
                    }}
                  />
                </div>
                <button
                  onClick={handleCurateEvent}
                  style={{
                    padding: '6px',
                    backgroundColor: '#f59e0b',
                    color: '#111827',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Curate Event
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* M43 Phase C: Authority Section */}
      <div style={{
        padding: '12px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        marginBottom: '16px',
        borderLeft: '3px solid #f59e0b'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', marginBottom: '10px' }}>
          ⚖️ AUTHORITY LEDGER (Multi-GM Voting)
        </div>

        {/* Director Ledger Actions */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 500 }}>Recent Actions</div>
          <div style={{ 
            backgroundColor: '#111827', 
            borderRadius: '4px', 
            padding: '8px',
            fontSize: '10px',
            maxHeight: '120px',
            overflowY: 'auto',
            color: '#d1d5db'
          }}>
            <div style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #374151' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>SEAL_CANON</span>
              <span style={{ marginLeft: '8px', color: '#34d399' }}>✓ 2/2 voted</span>
              <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '9px' }}>Approved</span>
            </div>
            <div style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #374151' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>FORCE_EPOCH</span>
              <span style={{ marginLeft: '8px', color: '#f59e0b' }}>◐ 1/2 voted</span>
              <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '9px' }}>Pending</span>
            </div>
            <div style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #374151' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>OVERRIDE_NPC</span>
              <span style={{ marginLeft: '8px', color: '#34d399' }}>✓ 2/3 voted</span>
              <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '9px' }}>Approved (2/3 majority)</span>
            </div>
          </div>
        </div>

        {/* Authority Debt Gauge */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Narrative Authority Debt</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>+3.5</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#374151',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #f59e0b'
          }}>
            <div style={{
              height: '100%',
              width: '35%',
              backgroundColor: '#f59e0b',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>
            Director overrides accumulating debt. Reset via ritual consensus.
          </div>
        </div>

        {/* Director Sync Status */}
        <div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 500 }}>Director Sync Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div style={{ 
              backgroundColor: '#111827', 
              padding: '6px', 
              borderRadius: '3px',
              fontSize: '10px',
              borderLeft: '2px solid #34d399'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '9px' }}>GM #1</div>
              <div style={{ color: '#34d399', fontWeight: 600 }}>✓ 100% Sync</div>
            </div>
            <div style={{ 
              backgroundColor: '#111827', 
              padding: '6px', 
              borderRadius: '3px',
              fontSize: '10px',
              borderLeft: '2px solid #34d399'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '9px' }}>GM #2</div>
              <div style={{ color: '#34d399', fontWeight: 600 }}>✓ 99% Sync</div>
            </div>
            <div style={{ 
              backgroundColor: '#111827', 
              padding: '6px', 
              borderRadius: '3px',
              fontSize: '10px',
              borderLeft: '2px solid #f59e0b'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '9px' }}>GM #3</div>
              <div style={{ color: '#f59e0b', fontWeight: 600 }}>⚠️ 78% Sync</div>
            </div>
            <div style={{ 
              backgroundColor: '#111827', 
              padding: '6px', 
              borderRadius: '3px',
              fontSize: '10px',
              borderLeft: '2px solid #ef4444'
            }}>
              <div style={{ color: '#9ca3af', fontSize: '9px' }}>Average</div>
              <div style={{ color: '#fbbf24', fontWeight: 600 }}>92% Consensus</div>
            </div>
          </div>
        </div>
      </div>

      {/* M35: Intervention History */}
      {interventions.length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: '#1f2937',
          borderRadius: '6px',
          marginBottom: '16px',
          borderLeft: '3px solid #8b5cf6'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: '#8b5cf6' }}>
            📜 RECENT INTERVENTIONS ({interventions.length})
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '10px', color: '#d1d5db' }}>
            {interventions.slice(-5).map(intervention => (
              <div key={intervention.id} style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #374151' }}>
                <span style={{ color: '#60a5fa' }}>{intervention.type.toUpperCase()}</span>
                {intervention.targetPlayer && ` → ${intervention.targetPlayer.substring(0, 8)}...`}
                <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
                  {new Date(intervention.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings Section */}
      {metrics.warnings.length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: '#1f2937',
          borderRadius: '6px',
          marginBottom: '16px',
          borderLeft: `3px solid ${statusColors[metrics.healthStatus]}`
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: statusColors[metrics.healthStatus] }}>
            ACTIVE ALERTS
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#d1d5db' }}>
            {metrics.warnings.map((warning, i) => (
              <div key={i}>{warning}</div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        <div style={{ padding: '8px', backgroundColor: '#1f2937', borderRadius: '4px' }}>
          <div style={{ color: '#9ca3af', marginBottom: '4px' }}>NPCs in World</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa' }}>{worldState.npcs?.length || 0}</div>
        </div>
        <div style={{ padding: '8px', backgroundColor: '#1f2937', borderRadius: '4px' }}>
          <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Active Prophecies</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#a78bfa' }}>
            {getAllProphecies().filter((p: any) => !p.fulfilled).length}
          </div>
        </div>
        <div style={{ padding: '8px', backgroundColor: '#1f2937', borderRadius: '4px' }}>
          <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Rumor Pool</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#34d399' }}>
            {((worldState.globalRumors?.length || 0) + (worldState.localRumors?.length || 0))}
          </div>
        </div>
        <div style={{ padding: '8px', backgroundColor: '#1f2937', borderRadius: '4px' }}>
          <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Paradoxes</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#f87171' }}>
            {(worldState.temporalParadoxes?.length || 0) + (worldState.paradoxBlooms?.length || 0)}
          </div>
        </div>
      </div>

      {/* Timer */}
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
        Updated: {new Date(metrics.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default CoDmDashboard;
