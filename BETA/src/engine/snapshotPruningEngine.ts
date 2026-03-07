/**
 * Phase 10.4: Ledger Pruning Engine
 * 
 * Manages cleanup of old events and snapshots to bound storage while maintaining
 * a rewind buffer for development and debugging.
 * 
 * Strategy:
 * - Keep all snapshots from current epoch (for fast replay)
 * - Keep last N epochs of snapshots (default 5 = ~7.2 MB)
 * - Delete old events (newer snapshots replace them as backup)
 * - Maintain circular buffer to prevent unbounded growth
 */

import type { Event } from '../events/mutationLog';
import type { SnapshotStorageBackend } from './worldEngine';

export interface PruningReport {
  eventsDeleted: number;
  eventsBytesFreed: number;
  snapshotsDeleted: number;
  snapshotBytesFreed: number;
  eventsRetained: number;
  snapshotsRetained: number;
  prunedAt: number;
  executionTimeMs: number;
}

export interface SnapshotPruneStats {
  totalBeforePrune: number;
  totalAfterPrune: number;
  removed: number;
  preservedRecencyBuffer: number;
  preservedHistorySnapshots: number;
  oldestRetainedTick: number;
}

/**
 * Phase 10.4: Calculate retention window based on current tick and epoch size
 * Default: keep last 5 epochs of snapshots (per PROTOTYPE_IMPLEMENTATION_PLAN.md)
 * 
 * Tick breakdown:
 * - 1 epoch = 1440 ticks (day/night cycle)
 * - Snapshots = every 100 ticks = 14-15 snapshots per epoch
 * - 5 epochs = 7200 ticks = ~72 snapshots total
 * - Storage footprint = ~100KB per snapshot = ~7.2 MB for 5 epochs
 */
export function calculateRetentionEpochs(
  currentTick: number,
  epochSizeTicks: number = 1440,
  retentionEpochs: number = 5,
  snapshotIntervalTicks: number = 100
): {
  oldestRetainedTick: number;
  oldestRetainedEpoch: number;
  retainedSnapshotCount: number;
  estimatedStorageKB: number;
} {
  const currentEpoch = Math.floor(currentTick / epochSizeTicks);
  const oldestRetainedEpoch = Math.max(0, currentEpoch - retentionEpochs + 1);
  const oldestRetainedTick = oldestRetainedEpoch * epochSizeTicks;
  
  // Estimate snapshots in retention window
  const ticksInWindow = currentTick - oldestRetainedTick;
  const retainedSnapshotCount = Math.ceil(ticksInWindow / snapshotIntervalTicks);
  
  // Estimate storage: ~100KB per snapshot
  const estimatedStorageKB = retainedSnapshotCount * 100;

  return {
    oldestRetainedTick,
    oldestRetainedEpoch,
    retainedSnapshotCount,
    estimatedStorageKB
  };
}

/**
 * Prune old snapshots from snapshot storage backend
 * Keeps last N epochs, deletes everything older
 */
export async function pruneSnapshots(
  snapshotStorage: SnapshotStorageBackend,
  currentTick: number,
  worldInstanceId: string,
  epochSizeTicks: number = 1440,
  retentionEpochs: number = 5
): Promise<PruningReport> {
  const startMs = performance.now();
  
  const retention = calculateRetentionEpochs(
    currentTick,
    epochSizeTicks,
    retentionEpochs
  );

  console.log(`[Phase 10.4] Pruning snapshots for world ${worldInstanceId}:`, {
    currentTick,
    currentEpoch: Math.floor(currentTick / epochSizeTicks),
    oldestRetainedTick: retention.oldestRetainedTick,
    oldestRetainedEpoch: retention.oldestRetainedEpoch,
    retainedSnapshotCount: retention.retainedSnapshotCount
  });

  // Delete snapshots older than retention window
  let snapshotsDeleted = 0;
  let snapshotBytesFreed = 0;

  try {
    await snapshotStorage.deleteOlderThan(worldInstanceId, retention.oldestRetainedTick);
    // Estimate bytes freed: assume average 100KB per snapshot, estimate full epoch of deleted snapshots
    const deletedSnapshotCount = Math.floor(retention.oldestRetainedTick / 100);
    snapshotsDeleted = Math.max(0, deletedSnapshotCount - retention.retainedSnapshotCount);
    snapshotBytesFreed = snapshotsDeleted * 102400; // 100KB average
  } catch (error) {
    console.error('[Phase 10.4] Error during snapshot pruning:', error);
  }

  const executionTimeMs = Math.round(performance.now() - startMs);

  const report: PruningReport = {
    eventsDeleted: 0, // Events are pruned separately
    eventsBytesFreed: 0,
    snapshotsDeleted,
    snapshotBytesFreed,
    eventsRetained: 0, // Will be updated by event pruning
    snapshotsRetained: retention.retainedSnapshotCount,
    prunedAt: Date.now(),
    executionTimeMs
  };

  return report;
}

/**
 * Main pruning entry point: coordinate event and snapshot pruning
 * 
 * Strategy:
 * 1. Delete snapshots older than retention window (Phase 10.4a)
 * 2. Keep all events (they're cheap to store once snapshots exist)
 * 3. Keep at least 1 event per snapshot for linking (Phase 10.4b)
 * 4. Log pruning report for monitoring (Phase 10.4c)
 */
export async function pruneEventLog(
  events: Event[],
  snapshotStorage: SnapshotStorageBackend,
  currentTick: number,
  worldInstanceId: string,
  options: {
    epochSizeTicks?: number;
    retentionEpochs?: number;
    snapshotIntervalTicks?: number;
    maxEventsPerSnapshot?: number;
  } = {}
): Promise<PruningReport> {
  const startMs = performance.now();
  const {
    epochSizeTicks = 1440,
    retentionEpochs = 5,
    snapshotIntervalTicks = 100,
    maxEventsPerSnapshot = 10
  } = options;

  // Phase 10.4a: Prune old snapshots
  const snapshotReport = await pruneSnapshots(
    snapshotStorage,
    currentTick,
    worldInstanceId,
    epochSizeTicks,
    retentionEpochs
  );

  // Phase 10.4b: Extract snapshot events and identify linked events
  const snapshotEvents = events.filter(
    e => e.type === 'SNAPSHOT_SAVED' || e.mutationClass === 'SNAPSHOT'
  );

  // Calculate retention threshold
  const retention = calculateRetentionEpochs(
    currentTick,
    epochSizeTicks,
    retentionEpochs,
    snapshotIntervalTicks
  );

  // Identify events to keep:
  // - All events after oldestRetainedTick (within snapshot retention window)
  // - Up to maxEventsPerSnapshot before oldest retained snapshot (history context)
  const eventsCutoffTick = Math.max(
    0,
    retention.oldestRetainedTick - (maxEventsPerSnapshot * snapshotIntervalTicks)
  );

  const prunedEvents = events.filter(event => {
    // Always keep snapshot events in retention window
    if (event.type === 'SNAPSHOT_SAVED' || event.mutationClass === 'SNAPSHOT') {
      const eventTick = event.payload?.tick || 0;
      return eventTick >= retention.oldestRetainedTick;
    }
    // Keep regular events in extended window (retention + context)
    const eventTick = event.payload?.tick || 0;
    return eventTick >= eventsCutoffTick;
  });

  const eventsDeleted = events.length - prunedEvents.length;

  // Phase 10.4c: Compile comprehensive pruning report
  const executionTimeMs = Math.round(performance.now() - startMs);
  const report: PruningReport = {
    eventsDeleted,
    eventsBytesFreed: eventsDeleted * 500, // ~500 bytes average per event
    snapshotsDeleted: snapshotReport.snapshotsDeleted,
    snapshotBytesFreed: snapshotReport.snapshotBytesFreed,
    eventsRetained: prunedEvents.length,
    snapshotsRetained: retention.retainedSnapshotCount,
    prunedAt: Date.now(),
    executionTimeMs
  };

  // Log comprehensive pruning statistics
  console.log('[Phase 10.4] Pruning complete:', formatPruningReport(report));

  return report;
}

/**
 * Format pruning report for logging and monitoring
 */
export function formatPruningReport(report: PruningReport): {
  summary: string;
  details: Record<string, unknown>;
} {
  const totalBytesFreed = report.eventsBytesFreed + report.snapshotBytesFreed;
  const totalDeleted = report.eventsDeleted + report.snapshotsDeleted;

  return {
    summary: `Pruned ${totalDeleted} items, freed ${(totalBytesFreed / 1024 / 1024).toFixed(2)} MB in ${report.executionTimeMs}ms`,
    details: {
      eventsDeleted: report.eventsDeleted,
      eventsBytesFreed: `${(report.eventsBytesFreed / 1024).toFixed(2)} KB`,
      snapshotsDeleted: report.snapshotsDeleted,
      snapshotBytesFreed: `${(report.snapshotBytesFreed / 1024).toFixed(2)} KB`,
      eventsRetained: report.eventsRetained,
      snapshotsRetained: report.snapshotsRetained,
      executionTimeMs: report.executionTimeMs,
      totalBytesFreed: `${(totalBytesFreed / 1024 / 1024).toFixed(2)} MB`
    }
  };
}
