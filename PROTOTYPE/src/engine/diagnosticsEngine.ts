/**
 * M42 Task 3.1: Diagnostics Engine
 *
 * Real-time monitoring and reporting of game cluster health:
 * - Faction power breakdown (military, political, economic, spiritual)
 * - Consensus health metrics (latency, peer count, queue depth)
 * - Macro event countdown tracking
 *
 * Used by DiagnosticPanel to display live metrics to players/director
 */

import type { WorldState } from './worldEngine';
import type { SessionRegistry } from './multiplayerEngine';

/**
 * Faction power breakdown by domain
 */
export interface FactionPowerBreakdown {
  factionId: string;
  name: string;
  totalPower: number;                   // Sum of all domains
  military: number;                     // Armed forces, combat readiness
  political: number;                    // Diplomacy, alliances, influence
  economic: number;                     // Trade, resources, production
  spiritual: number;                    // Faith, prophecy, divine favor
  trend: 'rising' | 'stable' | 'falling'; // Direction over last cycle
}

/**
 * Consensus network health
 */
export interface ConsensusHealth {
  avgLatency: number;                   // Average ping to peers (ms)
  p95Latency: number;                   // 95th percentile latency (ms)
  p99Latency: number;                   // 99th percentile latency (ms)
  peerCount: number;                    // Number of connected peers
  proposalQueueDepth: number;           // Proposals waiting for consensus
  consensusSuccessRate: number;         // Success rate as percentage (0-100)
  clockDrift: {
    max: number;                        // Worst peer drift (ms)
    avg: number;                        // Average drift (ms)
  };
  healthStatus: 'green' | 'yellow' | 'red'; // Overall status
}

/**
 * Countdown to macro event
 */
export interface MacroEventCountdown {
  eventId: string;
  eventName: string;
  category: 'monster_invasion' | 'political_crisis' | 'natural_disaster' | 'story_beat';
  icon?: string;                      // Optional icon emoji for the event
  etaTicks: number;                    // Game ticks until event fires
  severity: 1 | 2 | 3 | 4 | 5;        // 1 = minor, 5 = world-ending
  description: string;
  factionImpact?: string[];           // Optional list of affected factions
}

/**
 * Get faction power breakdown for all factions
 */
export function getFactionPowers(state: WorldState): FactionPowerBreakdown[] {
  // Placeholder implementation - would analyze state.factions
  // For now, return empty array (extended in M43 faction engine)
  
  if (!state.factions || state.factions.length === 0) {
    return [];
  }

  return state.factions.map(faction => ({
    factionId: faction.id,
    name: faction.name,
    totalPower: 50, // Placeholder
    military: 15 + Math.random() * 10,
    political: 10 + Math.random() * 10,
    economic: 15 + Math.random() * 10,
    spiritual: 10 + Math.random() * 10,
    trend: (['rising', 'stable', 'falling'] as const)[
      Math.floor(Math.random() * 3)
    ]
  }));
}

/**
 * Get single faction's power breakdown
 */
export function getFactionPower(state: WorldState, factionId: string): FactionPowerBreakdown | null {
  const powers = getFactionPowers(state);
  return powers.find(p => p.factionId === factionId) ?? null;
}

/**
 * Get consensus network health metrics
 */
export function getConsensusHealth(
  registry: SessionRegistry,
  recentLatencies?: number[]
): ConsensusHealth {
  // Calculate latency percentiles
  let p95Latency = 0;
  let p99Latency = 0;
  if (recentLatencies && recentLatencies.length > 0) {
    const sorted = [...recentLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    p95Latency = sorted[p95Index] ?? 0;
    p99Latency = sorted[p99Index] ?? 0;
  }

  const avgLatency = recentLatencies
    ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
    : 0;

  const clockDrifts = Array.from(registry.epochEventQueue).map(e => e.clockOffset ?? 0);
  const maxDrift = clockDrifts.length > 0
    ? Math.max(...clockDrifts.map(d => Math.abs(d)))
    : 0;
  const avgDrift = clockDrifts.length > 0
    ? clockDrifts.reduce((a, b) => a + Math.abs(b), 0) / clockDrifts.length
    : 0;

  const healthStatus =
    p95Latency > 150 || maxDrift > 100
      ? 'red'
      : p95Latency > 100 || maxDrift > 50
      ? 'yellow'
      : 'green';

  // Calculate success rate based on health status
  const consensusSuccessRate = healthStatus === 'green' ? 98 : healthStatus === 'yellow' ? 85 : 65;

  return {
    avgLatency,
    p95Latency,
    p99Latency,
    peerCount: registry.peers.size,
    proposalQueueDepth: registry.epochEventQueue.length,
    consensusSuccessRate,
    clockDrift: { max: maxDrift, avg: avgDrift },
    healthStatus
  };
}

/**
 * Get macro event countdown timers
 */
export function getMacroEventCountdowns(state: WorldState): MacroEventCountdown[] {
  // Placeholder implementation - would analyze state.macroEvents
  // For now, return empty array
  
  if (!state.macroEvents || state.macroEvents.length === 0) {
    return [];
  }

  return state.macroEvents
    .filter(event => event.active !== false)
    .map(event => ({
      eventId: event.id,
      eventName: event.name,
      category: event.category || 'story_beat',
      etaTicks: Math.max(0, (event.fireAt ?? 0) - (state.tick ?? 0)),
      severity: event.severity ?? 2,
      description: event.description || 'Macro event approaching'
    }))
    .sort((a, b) => a.etaTicks - b.etaTicks); // Sort by urgency
}

/**
 * Get status emoji for health status
 */
export function getHealthStatusEmoji(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'green':
      return '🟢';
    case 'yellow':
      return '🟡';
    case 'red':
      return '🔴';
  }
}

/**
 * Get severity emoji for macro event
 */
export function getSeverityEmoji(severity: number): string {
  if (severity <= 1) return '▪️';
  if (severity <= 2) return '◆';
  if (severity <= 3) return '◆◆';
  if (severity <= 4) return '◆◆◆';
  return '◆◆◆◆';
}

/**
 * Format latency for display
 */
export function formatLatency(ms: number): string {
  if (ms < 50) return `${Math.round(ms)}ms`;
  if (ms < 100) return `${Math.round(ms)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format tick delta for display
 */
export function formatTickDelta(ticks: number): string {
  const minutesPerTick = 1; // Configure as needed
  const seconds = ticks * minutesPerTick * 60;

  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * Get faction power trend indicator
 */
export function getTrendIndicator(trend: 'rising' | 'stable' | 'falling'): string {
  switch (trend) {
    case 'rising':
      return '📈';
    case 'stable':
      return '→';
    case 'falling':
      return '📉';
  }
}

/**
 * Batch diagnostics report (all metrics at once)
 */
export interface DiagnosticsReport {
  timestamp: number;
  factionPowers: FactionPowerBreakdown[];
  consensusHealth: ConsensusHealth;
  macroEventCountdowns: MacroEventCountdown[];
}

export function generateDiagnosticsReport(
  state: WorldState,
  registry: SessionRegistry,
  recentLatencies?: number[]
): DiagnosticsReport {
  return {
    timestamp: Date.now(),
    factionPowers: getFactionPowers(state),
    consensusHealth: getConsensusHealth(registry, recentLatencies),
    macroEventCountdowns: getMacroEventCountdowns(state)
  };
}

/**
 * M42: Get diagnostics snapshot for DiagnosticPanel
 */
export interface DiagnosticsSnapshot {
  factionPowers: FactionPowerBreakdown[];
  consensusHealth: ConsensusHealth;
  macroEventCountdowns: MacroEventCountdown[];
  worldTick: number;
  timestamp: number;
}

export function getDiagnosticsSnapshot(
  state: WorldState,
  registry?: SessionRegistry,
  latencyHistory?: number[],
  proposalMetrics?: { totalProposals: number; successfulProposals: number }
): DiagnosticsSnapshot {
  return {
    factionPowers: getFactionPowers(state),
    consensusHealth: registry ? getConsensusHealth(registry, latencyHistory) : {
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      peerCount: 0,
      proposalQueueDepth: 0,
      consensusSuccessRate: 100,
      clockDrift: { max: 0, avg: 0 },
      healthStatus: 'green'
    },
    macroEventCountdowns: getMacroEventCountdowns(state),
    worldTick: state.tick || 0,
    timestamp: Date.now()
  };
}

/**
 * Get display info for a faction power breakdown
 */
export interface FactionPowerDisplay {
  label: string;
  breakdown: Array<{ type: string; width: number; color: string }>;
}

export function getFactionPowerDisplay(faction: FactionPowerBreakdown): FactionPowerDisplay {
  const total = faction.totalPower || 1;
  return {
    label: faction.name,
    breakdown: [
      { type: 'Military', width: (faction.military / total) * 100, color: '#ff6b6b' },
      { type: 'Political', width: (faction.political / total) * 100, color: '#4ecdc4' },
      { type: 'Economic', width: (faction.economic / total) * 100, color: '#ffd700' },
      { type: 'Spiritual', width: (faction.spiritual / total) * 100, color: '#a78bfa' }
    ]
  };
}

/**
 * Get latency health color
 */
export function getLatencyHealthColor(latencyMs: number): string {
  if (latencyMs < 50) return '#22c55e'; // Green
  if (latencyMs < 100) return '#fbbf24'; // Yellow
  return '#ef4444'; // Red
}

/**
 * Get consensus health color
 */
export function getConsensusHealthColor(successRate: number): string {
  if (successRate > 95) return '#22c55e'; // Green
  if (successRate > 80) return '#fbbf24'; // Yellow
  return '#ef4444'; // Red
}

/**
 * Format ETA for display
 */
export function formatETA(ticks: number): string {
  return formatTickDelta(ticks);
}
