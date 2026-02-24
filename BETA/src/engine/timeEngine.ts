/**
 * Phase 7: Time Engine - Temporal Sovereignty
 * 
 * Centralizes all temporal lifecycle management:
 * - Epoch/tick progression tracking
 * - Snapshot triggers (every 100 ticks)
 * - Day/hour/season evolution
 * - Deterministic temporal state reconstruction
 * - Phase 9: Snapshot pruning to prevent ledger bloat
 * - Phase 11: Political Tick triggers (every 1440 ticks)
 */

import type { WorldState } from './worldEngine';

export interface TemporalState {
  currentTick: number;
  epoch: number;
  baseHour: number;
  baseDay: number;
  currentHour: number;
  currentDay: number;
  currentSeason: "winter" | "spring" | "summer" | "autumn";
  dayPhase: "night" | "morning" | "afternoon" | "evening";
  lastSnapshotTick: number;
  snapshotIntervalTicks: number; // Default 100
  lastPoliticalTickTick: number; // Phase 11: Last tick when political events were processed
  politicalTickIntervalTicks: number; // Phase 11: Default 1440 (one in-game day)
}

/**
 * Phase 9: Snapshot metadata for pruning management
 */
export interface SnapshotMetadata {
  tick: number;
  createdAt: number;
  size?: number;  // Estimated size in bytes
}

/**
 * Phase 9: Snapshot ledger tracker - prevents unbounded growth
 */
export interface SnapshotLedger {
  snapshots: SnapshotMetadata[];
  maxStoredSnapshots: number;  // Keep only this many recent snapshots (default 5)
  totalCreated: number;
  totalPruned: number;
}

/**
 * Initialize temporal state from world state
 */
export function initializeTemporalState(state: WorldState): TemporalState {
  const tick = state.tick ?? 0;
  const hour = state.hour ?? 0;
  const day = state.day ?? 1;
  const season = state.season ?? 'winter';
  
  return {
    currentTick: tick,
    epoch: Math.floor(tick / 1440), // One epoch per 1440 ticks (24 in-game hours)
    baseHour: hour,
    baseDay: day,
    currentHour: hour,
    currentDay: day,
    currentSeason: season,
    dayPhase: calculateDayPhase(hour),
    lastSnapshotTick: 0,
    snapshotIntervalTicks: 100,
    lastPoliticalTickTick: state.lastFactionTick ?? 0,
    politicalTickIntervalTicks: 1440
  };
}

/**
 * Calculate day phase from hour
 */
export function calculateDayPhase(hour: number): "night" | "morning" | "afternoon" | "evening" {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Advance temporal state by given tick count
 * Returns updated temporal state and indicates if snapshot is due
 */
export function advanceTemporalState(
  temporal: TemporalState,
  tickAmount: number = 1
): { temporal: TemporalState; isSnapshotDue: boolean; nextSnapshotTick: number } {
  const nextTick = temporal.currentTick + tickAmount;
  
  // Calculate new hour/day from tick progression
  // Assume each hour = 1 tick (60 game seconds per tick)
  const totalHours = temporal.baseHour + nextTick;
  const nextHour = totalHours % 24;
  const nextDay = temporal.baseDay + Math.floor(totalHours / 24);
  
  // Calculate season (simplified: 360 hours per season)
  const seasonCycleHours = 360;
  const hourOfYear = (nextDay * 24 + nextHour) % (seasonCycleHours * 4);
  const nextSeasonIndex = Math.floor(hourOfYear / seasonCycleHours);
  const seasons: Array<"winter" | "spring" | "summer" | "autumn"> = ['winter', 'spring', 'summer', 'autumn'];
  const nextSeason = seasons[nextSeasonIndex] || 'winter';
  
  const updatedTemporal: TemporalState = {
    ...temporal,
    currentTick: nextTick,
    epoch: Math.floor(nextTick / 1440),
    currentHour: nextHour,
    currentDay: nextDay,
    currentSeason: nextSeason,
    dayPhase: calculateDayPhase(nextHour)
  };
  
  // Check if snapshot is due (every 100 ticks)
  const isSnapshotDue = nextTick % temporal.snapshotIntervalTicks === 0 && nextTick > 0;
  const nextSnapshotTick = isSnapshotDue 
    ? nextTick
    : temporal.lastSnapshotTick + temporal.snapshotIntervalTicks;
  
  return {
    temporal: isSnapshotDue 
      ? { ...updatedTemporal, lastSnapshotTick: nextTick }
      : updatedTemporal,
    isSnapshotDue,
    nextSnapshotTick
  };
}

/**
 * Sync WorldState with TemporalState (Phase 7 integration point)
 */
export function syncWorldStateToTemporal(state: WorldState, temporal: TemporalState): WorldState {
  return {
    ...state,
    tick: temporal.currentTick,
    hour: temporal.currentHour,
    day: temporal.currentDay,
    season: temporal.currentSeason,
    dayPhase: temporal.dayPhase,
    time: {
      ...(state.time ? Object.entries(state.time).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) : {}),
      tick: temporal.currentTick,
      hour: temporal.currentHour,
      day: temporal.currentDay,
      season: temporal.currentSeason,
      baseHour: temporal.baseHour,
      baseDay: temporal.baseDay
    } as any
  };
}

/**
 * Get remaining ticks until next snapshot
 */
export function getTicksUntilSnapshot(temporal: TemporalState): number {
  const nextSnapshot = temporal.lastSnapshotTick + temporal.snapshotIntervalTicks;
  return Math.max(0, nextSnapshot - temporal.currentTick);
}

/**
 * Check if we should trigger periodic snapshot
 */
export function shouldTriggerSnapshot(temporal: TemporalState): boolean {
  return temporal.currentTick > 0 && temporal.currentTick % temporal.snapshotIntervalTicks === 0;
}

// Singleton temporal engine instance
let globalTemporalState: TemporalState | null = null;

export function initializeGlobalTemporalState(state: WorldState): void {
  globalTemporalState = initializeTemporalState(state);
}

export function getGlobalTemporalState(): TemporalState {
  if (!globalTemporalState) {
    // Fallback: create default state
    globalTemporalState = initializeTemporalState({} as any);
  }
  return globalTemporalState;
}

export function updateGlobalTemporalState(temporal: TemporalState): void {
  globalTemporalState = temporal;
}

/**
 * Advance time through the temporal sovereignty system
 * Phase 7: Main entry point for tick advancement
 * Phase 11: Now also detects political ticks (every 1440 ticks)
 */
export function advanceTime(tickAmount: number = 1): {
  temporal: TemporalState;
  isSnapshotDue: boolean;
  nextSnapshotTick: number;
  isPoliticalTickDue: boolean;
  nextPoliticalTickTick: number;
} {
  const current = getGlobalTemporalState();
  const result = advanceTemporalState(current, tickAmount);
  updateGlobalTemporalState(result.temporal);
  
  // Check if political tick is due (Phase 11)
  const isPoliticalTickDue = shouldTriggerPoliticalTick(result.temporal);
  const nextPoliticalTickTick = result.temporal.lastPoliticalTickTick + result.temporal.politicalTickIntervalTicks;
  
  return {
    temporal: result.temporal,
    isSnapshotDue: result.isSnapshotDue,
    nextSnapshotTick: result.nextSnapshotTick,
    isPoliticalTickDue,
    nextPoliticalTickTick
  };
}

/**
 * Phase 11: Check if political tick should trigger (every 1440 ticks = one in-game day)
 * Triggers faction influence diffusion, territory shifts, and political events
 */
export function shouldTriggerPoliticalTick(temporal: TemporalState): boolean {
  return temporal.currentTick - temporal.lastPoliticalTickTick >= temporal.politicalTickIntervalTicks;
}

/**
 * Phase 11: Update political tick timestamp after processing
 */
export function recordPoliticalTick(temporal: TemporalState): void {
  temporal.lastPoliticalTickTick = temporal.currentTick;
}

/**
 * Phase 9: Snapshot Pruning Functions
 * Prevents the SYSTEM_SNAPSHOT ledger from unbounded growth
 */

/**
 * Initialize a snapshot ledger
 */
export function initializeSnapshotLedger(maxStoredSnapshots: number = 5): SnapshotLedger {
  return {
    snapshots: [],
    maxStoredSnapshots,
    totalCreated: 0,
    totalPruned: 0
  };
}

/**
 * Record a snapshot creation and prune if necessary
 * Returns the number of snapshots pruned
 */
export function recordSnapshot(ledger: SnapshotLedger, tick: number, size?: number): number {
  ledger.snapshots.push({
    tick,
    createdAt: Date.now(),
    size
  });
  ledger.totalCreated++;

  // Prune old snapshots if exceeding max
  const prunedCount = pruneOldSnapshots(ledger);
  ledger.totalPruned += prunedCount;

  return prunedCount;
}

/**
 * Remove snapshots older than the most recent N
 */
function pruneOldSnapshots(ledger: SnapshotLedger): number {
  const initialCount = ledger.snapshots.length;
  
  if (initialCount <= ledger.maxStoredSnapshots) {
    return 0; // Nothing to prune
  }

  // Keep only the most recent maxStoredSnapshots
  ledger.snapshots = ledger.snapshots.toSorted((a, b) => b.tick - a.tick);
    .slice(0, ledger.maxStoredSnapshots);

  return initialCount - ledger.snapshots.length;
}

/**
 * Get snapshot statistics
 */
export function getSnapshotStatistics(ledger: SnapshotLedger): {
  total: number;
  stored: number;
  pruned: number;
  averageSize?: number;
} {
  const totalSize = ledger.snapshots.reduce((sum, s) => sum + (s.size ?? 0), 0);
  const averageSize = ledger.snapshots.length > 0 ? totalSize / ledger.snapshots.length : 0;

  return {
    total: ledger.totalCreated,
    stored: ledger.snapshots.length,
    pruned: ledger.totalPruned,
    averageSize: averageSize > 0 ? averageSize : undefined
  };
}

/**
 * Clear all snapshots (for testing or emergency)
 */
export function clearSnapshots(ledger: SnapshotLedger): void {
  ledger.snapshots = [];
}

