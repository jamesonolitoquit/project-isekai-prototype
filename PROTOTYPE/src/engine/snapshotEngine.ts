import type { WorldState } from './worldEngine';
import { indexedDbStore } from './saveLoadEngine';

/**
 * Phase 25 Task 5: Chronos Snapshotting Engine
 * Phase 25 Task 6: Performance Metrics & Panic Recovery
 * 
 * Coordinates snapshot capture for performance hardening.
 * Enables O(1) state reconstruction by:
 * 1. Capturing full WorldState snapshots every 100 ticks
 * 2. Storing in IndexedDB with in-memory cache for fast access
 * 3. Enabling delta replay from snapshot → current tick (instead of tick 0 → current)
 * 4. Tracking performance metrics for beta readiness monitoring
 * 
 * Performance Impact:
 * - Tick 100: ~5-10ms snapshot I/O (async, non-blocking)
 * - Tick 500 rebuild without snapshot: ~50-100ms (full replay)
 * - Tick 500 rebuild with snapshot: ~5-15ms (delta replay from tick 400)
 */

/**
 * Snapshot performance metrics
 */
export interface SnapshotMetrics {
  write_latency_ms: number[];  // Array of write latencies
  read_latency_ms: number[];   // Array of read latencies
  delta_replay_count: number[];  // Array of delta event counts per rebuild
  last_update: number;  // Timestamp of last metric update
  compression_ratio?: number;  // Bytes saved by compression (percentage)
}

export class SnapshotEngine {
  private snapshotInterval = 100; // Capture snapshot every 100 ticks (~5 minutes at 1 tick/3s)
  private instance: SnapshotEngine | null = null;
  private metrics: SnapshotMetrics = {
    write_latency_ms: [],
    read_latency_ms: [],
    delta_replay_count: [],
    last_update: Date.now()
  };

  /**
   * Check if it's time to capture a snapshot
   * Snapshots occur at ticks: 100, 200, 300, etc.
   */
  shouldSnapshot(tick: number): boolean {
    return tick > 0 && tick % this.snapshotInterval === 0;
  }

  /**
   * Process tick: trigger snapshot capture if at milestone
   * Called from world tick loop after state is advanced
   * 
   * Non-blocking: snapshot writes happen async to IndexedDB
   * Phase 25 Task 6: Track write latency for performance monitoring
   */
  async processTick(worldInstanceId: string, tick: number, state: WorldState): Promise<void> {
    if (!this.shouldSnapshot(tick)) {
      return; // Not a snapshot tick
    }

    try {
      const startTime = performance.now();

      // Async write to IndexedDB (doesn't block game loop)
      await indexedDbStore.saveSnapshot(worldInstanceId, tick, state);
      
      const writeLatency = performance.now() - startTime;
      this.metrics.write_latency_ms.push(writeLatency);
      if (this.metrics.write_latency_ms.length > 100) {
        this.metrics.write_latency_ms.shift(); // Keep rolling window of 100
      }

      // Cleanup old snapshots (keep ~120 snapshots = ~10 hours of gameplay)
      await indexedDbStore.clearOldSnapshots(worldInstanceId, 120);

      console.log(`[SnapshotEngine] Captured snapshot at tick ${tick} for world ${worldInstanceId} (latency: ${writeLatency.toFixed(2)}ms)`);
    } catch (error) {
      console.error(`[SnapshotEngine] Failed to save snapshot at tick ${tick}:`, error);
      // Don't throw - snapshot failures shouldn't crash the game
    }
  }

  /**
   * Get the latest available snapshot for a world instance up to a specific tick
   * Used by stateRebuilder.rebuildStateWithSnapshot() to seed delta replay
   * Phase 25 Task 6: Track read latency and delta replay count
   */
  async getLatestSnapshot(worldInstanceId: string, upToTick: number, deltaEventCount?: number) {
    const startTime = performance.now();
    const snapshot = await indexedDbStore.getLatestSnapshot(worldInstanceId, upToTick);
    const readLatency = performance.now() - startTime;
    
    this.metrics.read_latency_ms.push(readLatency);
    if (this.metrics.read_latency_ms.length > 100) {
      this.metrics.read_latency_ms.shift();
    }

    if (deltaEventCount !== undefined) {
      this.metrics.delta_replay_count.push(deltaEventCount);
      if (this.metrics.delta_replay_count.length > 100) {
        this.metrics.delta_replay_count.shift();
      }

      // Phase 25 Task 6: Emit warning if delta replay gets too large (>150 events)
      if (deltaEventCount > 150) {
        console.warn(`[SnapshotEngine] SYSTEM_WARNING: Delta replay count ${deltaEventCount} exceeds 150 (missed snapshot or storage failure?)`);
      }
    }

    return snapshot;
  }

  /**
   * Get cached snapshot without async I/O
   * Used for quick checks during NPC combat loops
   */
  getCachedSnapshot(worldInstanceId: string): WorldState | null {
    return indexedDbStore.getCachedSnapshot(worldInstanceId);
  }

  /**
   * Phase 25 Task 6: Register delta replay metric
   * Called by stateRebuilder after filtering delta events
   * Tracks delta event counts for anomaly detection
   */
  recordDeltaReplayMetric(deltaEventCount: number): void {
    this.metrics.delta_replay_count.push(deltaEventCount);
    if (this.metrics.delta_replay_count.length > 100) {
      this.metrics.delta_replay_count.shift();
    }
    this.metrics.last_update = Date.now();

    // Emit warning if delta replay gets too large (>150 events = potential missed snapshot)
    if (deltaEventCount > 150) {
      console.warn(`[SnapshotEngine] SYSTEM_WARNING: Delta replay count ${deltaEventCount} exceeds 150 (missed snapshot or storage failure?)`);
    }
  }

  /**
   * Set snapshot interval (for testing)
   */
  setSnapshotInterval(interval: number): void {
    this.snapshotInterval = interval;
  }

  /**
   * Phase 25 Task 6: Get current performance metrics
   */
  getMetrics(): SnapshotMetrics {
    return {
      ...this.metrics,
      last_update: Date.now()
    };
  }

  /**
   * Phase 25 Task 6: Get average write latency (for performance monitoring)
   */
  getAverageWriteLatency(): number {
    if (this.metrics.write_latency_ms.length === 0) return 0;
    const sum = this.metrics.write_latency_ms.reduce((a, b) => a + b, 0);
    return sum / this.metrics.write_latency_ms.length;
  }

  /**
   * Phase 25 Task 6: Get average read latency (for performance monitoring)
   */
  getAverageReadLatency(): number {
    if (this.metrics.read_latency_ms.length === 0) return 0;
    const sum = this.metrics.read_latency_ms.reduce((a, b) => a + b, 0);
    return sum / this.metrics.read_latency_ms.length;
  }

  /**
   * Phase 25 Task 6: Get average delta replay count
   */
  getAverageDeltaReplayCount(): number {
    if (this.metrics.delta_replay_count.length === 0) return 0;
    const sum = this.metrics.delta_replay_count.reduce((a, b) => a + b, 0);
    return sum / this.metrics.delta_replay_count.length;
  }
}

// Singleton instance
let snapshotEngineInstance: SnapshotEngine | null = null;

/**
 * Get or create singleton instance
 */
export function getSnapshotEngine(): SnapshotEngine {
  if (!snapshotEngineInstance) {
    snapshotEngineInstance = new SnapshotEngine();
  }
  return snapshotEngineInstance;
}

/**
 * Export default singleton for convenience
 */
export const snapshotEngine = getSnapshotEngine();
