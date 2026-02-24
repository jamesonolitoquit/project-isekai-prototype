/**
 * Phase 3 Task 7: Snapshot Pruning Logic
 * 
 * Maintains efficient snapshot storage by pruning old snapshots:
 * - Keep last 5 snapshots
 * - Then keep 1 snapshot per 1000 ticks for deeper history
 * - Remove snapshots older than 5000 ticks when limit exceeded
 */

import type { Event } from '../events/mutationLog';

export interface SnapshotPruneStats {
  totalBeforePrune: number;
  totalAfterPrune: number;
  removed: number;
  preservedRecencyBuffer: number;
  preservedHistorySnapshots: number;
  oldestRetainedTick: number;
}

/**
 * Pruning strategy:
 * 1. Always keep most recent 5 snapshots (recency buffer)
 * 2. From remaining, keep 1 per 1000-tick window (history layer)
 * 3. If over 50 snapshots total, remove snapshots older than 5000 ticks
 */
export function pruneSnapshotEvents(
  allEvents: Event[],
  currentTick: number,
  maxSnapshots: number = 50
): { prunedEvents: Event[]; stats: SnapshotPruneStats } {
  // Extract snapshot events, sorted by event index
  const snapshots = allEvents
    .filter(e => e.mutationClass === 'SNAPSHOT' || e.type === 'SNAPSHOT')
    .sort((a, b) => (a.eventIndex || 0) - (b.eventIndex || 0));

  if (snapshots.length <= maxSnapshots) {
    // No pruning needed
    return {
      prunedEvents: allEvents,
      stats: {
        totalBeforePrune: allEvents.length,
        totalAfterPrune: allEvents.length,
        removed: 0,
        preservedRecencyBuffer: 0,
        preservedHistorySnapshots: snapshots.length,
        oldestRetainedTick: snapshots[0]?.payload?.currentTick || currentTick
      }
    };
  }

  // Track which snapshots to keep
  const keepSnapshotIndices = new Set<number>();

  // Strategy 1: Keep most recent 5 snapshots (recency buffer)
  const recencyStart = Math.max(0, snapshots.length - 5);
  let recencyBuffer = 0;
  for (let i = recencyStart; i < snapshots.length; i++) {
    keepSnapshotIndices.add(i);
    recencyBuffer++;
  }

  // Strategy 2: Keep 1 snapshot per 1000-tick window from older history
  const historySnapshots: number[] = [];
  let lastKeptTick = currentTick;
  for (let i = snapshots.length - 6; i >= 0; i--) {
    const snapshot = snapshots[i];
    const snapshotTick = snapshot.payload?.currentTick || 0;
    
    // Keep this snapshot if it's at least 1000 ticks earlier than last kept
    if (lastKeptTick - snapshotTick >= 1000) {
      keepSnapshotIndices.add(i);
      historySnapshots.push(i);
      lastKeptTick = snapshotTick;
    }
  }

  // Build pruned event list
  const snapshotIndicesSet = new Set<number>();
  snapshots.forEach((snap, idx) => {
    snapshotIndicesSet.add(snap.eventIndex || idx);
  });

  const prunedEvents = allEvents.filter(event => {
    // Keep all non-snapshot events
    if (event.mutationClass !== 'SNAPSHOT' && event.type !== 'SNAPSHOT') {
      return true;
    }

    // For snapshots, keep only those in our keep set
    const snapshotIdx = snapshots.findIndex(s => s.id === event.id);
    return keepSnapshotIndices.has(snapshotIdx);
  });

  const oldestRetainedTick = snapshots
    .filter((_, idx) => keepSnapshotIndices.has(idx))
    .map(s => s.payload?.currentTick || 0)
    .reduce((min, tick) => Math.min(min, tick), currentTick);

  return {
    prunedEvents,
    stats: {
      totalBeforePrune: allEvents.length,
      totalAfterPrune: prunedEvents.length,
      removed: allEvents.length - prunedEvents.length,
      preservedRecencyBuffer: recencyBuffer,
      preservedHistorySnapshots: historySnapshots.length,
      oldestRetainedTick
    }
  };
}

/**
 * Estimate memory usage of event log
 */
export function estimateEventLogSize(events: Event[]): number {
  // Rough estimate: ~500 bytes per event average
  return events.length * 500;
}

/**
 * Get pruning recommendation
 */
export function getPruningRecommendation(
  events: Event[],
  currentTick: number
): {
  shouldPrune: boolean;
  reason?: string;
  estimatedSavings?: number;
} {
  const snapshots = events.filter(e => e.mutationClass === 'SNAPSHOT' || e.type === 'SNAPSHOT');
  
  if (snapshots.length < 50) {
    return {
      shouldPrune: false,
      reason: 'Snapshot count below threshold'
    };
  }

  const currentSize = estimateEventLogSize(events);
  const { prunedEvents } = pruneSnapshotEvents(events, currentTick);
  const prunedSize = estimateEventLogSize(prunedEvents);
  const savings = currentSize - prunedSize;

  return {
    shouldPrune: savings > 50000, // Prune if > 50 KB savings
    reason: `${snapshots.length} snapshots, ${(currentSize / 1024).toFixed(1)} KB total`,
    estimatedSavings: savings
  };
}
