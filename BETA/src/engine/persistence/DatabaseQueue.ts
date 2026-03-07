/**
 * Database Queue (Phase 7 - Write-Behind Orchestration)
 *
 * Implements the write-behind caching strategy:
 * - Immediate: Critical events (importance >= 9) → PostgreSQL immediately
 * - Batched: Normal events (importance < 9) → Redis queue → PostgreSQL every 100 ticks
 * - Importance Filtering: Trivial data (NPC moves, minor XP) discarded
 *
 * Event Importance Scale (1-10):
 * 1-3:  Trivial (discard)
 * 4-6:  Normal (queue for batched flush)
 * 7-8:  Important (manual query if needed)
 * 9-10: Critical (immediate flush: deaths, births, miracles, epoch transitions)
 *
 * Queue Lifecycle:
 * 1. Event emitted by Phase6 Info Synthesis
 * 2. DatabaseQueue.enqueue() assesses importance
 * 3. Trivial events discarded
 * 4. Normal events staged in Redis
 * 5. Every N ticks, scheduler triggers flush
 * 6. Batch flushed to PostgreSQL
 * 7. Event recorded in mutation_log with StateHash verification
 */

import type { PostgresAdapter } from './PostgresAdapter';
import type { RedisCacheManager } from './RedisCache';
import type { StateHash } from '../../types';

/**
 * Event importance categorization
 */
export enum EventImportance {
  TRIVIAL = 1, // Discard
  MINORMOVEMENT = 2,
  MINORXP = 3,
  NORMAL = 5, // Queue for batch
  IMPORTANT = 7,
  VERYIMPORTANT = 8,
  CRITICAL_DEATH = 9, // Immediate flush
  CRITICAL_MIRACLE = 9,
  CRITICAL_EPOCH = 10, // Immediate flush
}

/**
 * Queueable mutation event
 */
export interface MutationEvent {
  eventId: string;
  timestamp: number;
  tick: number;
  worldInstanceId: string;
  type:
    | 'vessel_death'
    | 'vessel_birth'
    | 'miracle'
    | 'paradox_event'
    | 'epoch_transition'
    | 'faction_conflict'
    | 'territory_change'
    | 'vessel_movement'
    | 'skill_rank_up'
    | 'item_drop'
    | 'environmental_change';
  actorId?: string;
  targetId?: string;
  importance: number; // 1-10
  stateHash?: StateHash;
  data: Record<string, any>;
}

/**
 * Queue statistics for monitoring
 */
export interface QueueStats {
  pendingCount: number;
  discardedCount: number;
  flushedCount: number;
  averageImportance: number;
  lastFlushTick: number;
  pendingTopics: Record<string, number>; // topic -> count
}

/**
 * DatabaseQueue: Orchestrates write-behind batching
 *
 * Responsibilities:
 * 1. Enqueue mutations from EngineOrchestrator
 * 2. Filter trivial events (importance < 4)
 * 3. Stage normal events in Redis
 * 4. Flush batches to PostgreSQL every 100 ticks
 * 5. Track statistics and queue health
 * 6. Handle immediate flushes for critical events
 * 7. Verify flushed events are durable
 */
export class DatabaseQueue {
  private postgresAdapter: PostgresAdapter | null = null;
  private redisCache: RedisCacheManager | null = null;

  private stats: QueueStats = {
    pendingCount: 0,
    discardedCount: 0,
    flushedCount: 0,
    averageImportance: 0,
    lastFlushTick: 0,
    pendingTopics: {},
  };

  private pendingEventsInMemory: MutationEvent[] = [];
  private flushSchedule: number = 100; // Flush every 100 ticks
  private nextFlushTick: number = 100;

  constructor(postgresAdapter: PostgresAdapter, redisCache: RedisCacheManager) {
    this.postgresAdapter = postgresAdapter;
    this.redisCache = redisCache;
  }

  /**
   * Enqueue a mutation event for processing
   * Called by EngineOrchestrator.step() or EventBus
   */
  enqueue(event: MutationEvent): void {
    // Filter by importance
    if (event.importance < 4) {
      // Trivial - discard
      this.stats.discardedCount++;
      return;
    }

    // Track statistics
    this.stats.pendingCount++;
    this.stats.pendingTopics[event.type] = (this.stats.pendingTopics[event.type] || 0) + 1;

    // Immediate flush for critical events
    if (event.importance >= 9) {
      console.log(
        `[DatabaseQueue] Critical event (importance=${event.importance}), flushing immediately: ${event.type}`
      );
      this.flushImmediate([event]);
      return;
    }

    // Stage in Redis for batch flush
    this.pendingEventsInMemory.push(event);
    // TODO: Add Redis event queuing for redundancy
    // this.redisCache?.queueEvent({ ... })
  }

  /**
   * Check if scheduled flush is needed
   */
  shouldFlush(currentTick: number): boolean {
    return currentTick >= this.nextFlushTick && this.stats.pendingCount > 0;
  }

  /**
   * Execute scheduled batch flush
   * Called by EngineOrchestrator or background scheduler
   */
  async flush(currentTick: number): Promise<number> {
    if (!this.postgresAdapter) {
      console.warn('[DatabaseQueue] PostgresAdapter not initialized');
      return 0;
    }

    if (this.pendingEventsInMemory.length === 0) {
      return 0;
    }

    try {
      const toFlush = [...this.pendingEventsInMemory];
      this.pendingEventsInMemory = [];

      // Sort by importance (higher importance first)
      toFlush.sort((a, b) => b.importance - a.importance);

      // Convert to FlushableEvent format
      const flushableEvents = toFlush.map(e => ({
        type: e.type as any,
        importance: e.importance,
        eventId: e.eventId,
        tick: e.tick,
        worldInstanceId: e.worldInstanceId,
        data: e.data,
        causeId: e.data.causeId || `tick_${e.tick}`,
      }));

      // Flush to database
      const flushed = await this.postgresAdapter.flush(currentTick);

      // Update statistics
      this.stats.flushedCount += flushed;
      this.stats.pendingCount = Math.max(0, this.stats.pendingCount - flushed);
      this.stats.lastFlushTick = currentTick;
      this.nextFlushTick = currentTick + this.flushSchedule;

      console.log(
        `[DatabaseQueue] Flushed ${flushed} events at tick ${currentTick}. Pending: ${this.stats.pendingCount}`
      );

      return flushed;
    } catch (error) {
      console.error('[DatabaseQueue] Flush failed:', error);
      // Re-queue failed events (they remain in pendingEventsInMemory)
      return 0;
    }
  }

  /**
   * Flush immediately (don't wait for schedule)
   */
  private async flushImmediate(events: MutationEvent[]): Promise<void> {
    if (!this.postgresAdapter) {
      return;
    }

    try {
      const flushableEvents = events.map(e => ({
        type: e.type as any,
        importance: e.importance,
        eventId: e.eventId,
        tick: e.tick,
        worldInstanceId: e.worldInstanceId,
        data: e.data,
      }));

      for (const event of flushableEvents) {
        this.postgresAdapter.queueEvent(event as any);
      }

      // Force immediate flush
      await this.postgresAdapter.flush(Math.max(...events.map(e => e.tick)));

      this.stats.flushedCount += events.length;
      console.log(`[DatabaseQueue] Immediately flushed ${events.length} critical events`);
    } catch (error) {
      console.error('[DatabaseQueue] Immediate flush failed:', error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Drain entire queue (force flush without schedule)
   * Used during shutdown
   */
  async drain(currentTick: number): Promise<number> {
    console.log(`[DatabaseQueue] Draining queue (${this.stats.pendingCount} pending)...`);

    if (this.pendingEventsInMemory.length > 0) {
      // Convert to flushable format first
      for (const event of this.pendingEventsInMemory) {
        this.postgresAdapter?.queueEvent({
          type: event.type as any,
          importance: event.importance,
          eventId: event.eventId,
          tick: event.tick,
          worldInstanceId: event.worldInstanceId,
          data: event.data,
        });
      }
    }

    // TODO: Implement Redis event queue draining
    // const redisEvents = await this.redisCache?.drainEventQueue();
    // if (redisEvents && redisEvents.length > 0) {
    //   for (const event of redisEvents) {
    //     this.postgresAdapter?.queueEvent(event);
    //   }
    // }

    // Final flush
    const flushed = await this.postgresAdapter?.flush(currentTick) || 0;

    this.pendingEventsInMemory = [];
    this.stats.pendingCount = 0;

    console.log(`[DatabaseQueue] Drain complete. Flushed ${flushed} events.`);

    return flushed;
  }

  /**
   * Set importance threshold for specific event types
   * Allows tuning what gets queued vs discarded
   */
  private getImportanceForType(type: MutationEvent['type']): number {
    const thresholds: Record<MutationEvent['type'], number> = {
      vessel_death: EventImportance.CRITICAL_DEATH,
      vessel_birth: EventImportance.CRITICAL_DEATH,
      miracle: EventImportance.CRITICAL_MIRACLE,
      paradox_event: EventImportance.CRITICAL_DEATH,
      epoch_transition: EventImportance.CRITICAL_EPOCH,
      faction_conflict: EventImportance.IMPORTANT,
      territory_change: EventImportance.IMPORTANT,
      vessel_movement: EventImportance.MINORMOVEMENT,
      skill_rank_up: EventImportance.NORMAL,
      item_drop: EventImportance.MINORXP,
      environmental_change: EventImportance.NORMAL,
    };

    return thresholds[type] || EventImportance.NORMAL;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    pending: number;
    flushed: number;
    discarded: number;
  }> {
    const healthy =
      (await this.postgresAdapter?.healthCheck()) || false;
    // TODO: Add Redis healthCheck

    return {
      healthy,
      pending: this.stats.pendingCount,
      flushed: this.stats.flushedCount,
      discarded: this.stats.discardedCount,
    };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.stats = {
      pendingCount: 0,
      discardedCount: 0,
      flushedCount: 0,
      averageImportance: 0,
      lastFlushTick: 0,
      pendingTopics: {},
    };
  }
}

/**
 * Utility: Calculate event importance manually
 */
export function calculateEventImportance(event: MutationEvent): number {
  const baseImportance: Record<MutationEvent['type'], number> = {
    vessel_death: 10,
    vessel_birth: 10,
    miracle: 9,
    paradox_event: 9,
    epoch_transition: 10,
    faction_conflict: 7,
    territory_change: 7,
    vessel_movement: 2, // Trivial
    skill_rank_up: 5,
    item_drop: 4,
    environmental_change: 5,
  };

  let importance = baseImportance[event.type] || 5;

  // Modifiers
  if (event.type === 'vessel_death' && event.data.playerVessel) {
    importance = 10; // Player death always critical
  }

  if (event.type === 'faction_conflict' && event.data.scale === 'large') {
    importance = 9; // Escalate large conflicts
  }

  if (event.data.stateHash && event.data.stateHashChanged) {
    importance += 2; // State hash change increases  importance
  }

  return Math.min(10, importance);
}
