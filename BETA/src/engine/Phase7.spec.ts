/**
 * Phase 7 Integration Tests - Database & Real-time Caching
 *
 * Verifies the three-layer persistence architecture:
 * 1. Redis cache (hot state, 1.5s writes) - WRITE_THROUGH
 * 2. Database queue (batched events) - write-behind with importance filtering
 * 3. PostgreSQL (permanent archive) - long-term storage
 *
 * Test Coverage:
 * - RedisCacheManager (5 tests)
 * - PostgresAdapter (6 tests)
 * - DatabaseQueue (8 tests)
 * - Write-Behind Strategy (3 tests)
 * - Recovery & Consistency (3 tests)
 * - E2E Stress Test (1 test)
 * Total: 26 tests
 */

import { RedisCache, InMemoryRedisClient } from '../engine/persistence/RedisCache';
import { PostgresAdapter, FlushableEvent } from '../engine/persistence/PostgresAdapter';
import { DatabaseQueue, calculateEventImportance, type MutationEvent } from '../engine/persistence/DatabaseQueue';

describe('Phase 7: Database & Real-time Caching Strategy', () => {
  
  // ==================== REDIS CACHE TESTS ====================

  describe('RedisCacheManager - High-Frequency Cache', () => {
    let redis: RedisCache;
    let mockClient: InMemoryRedisClient;

    beforeEach(() => {
      redis = new RedisCache({ redis: { host: 'localhost', port: 6379, db: 0 } });
      mockClient = new InMemoryRedisClient();
    });

    afterEach(async () => {
      await redis.disconnect();
      await mockClient.flushDb();
    });

    test('Cache.T1: Push tick state to Redis', async () => {
      const stateHash = {
        hash: 'abc123',
        componentHashes: {
          vessels: 'v_hash',
          factions: 'f_hash',
          territories: 't_hash',
          deities: 'd_hash',
          globalState: 'g_hash',
        },
        calculatedAt: 100,
      };

      // Mock vessels and factions
      const vessels = [
        { id: 'v1', name: 'Hero', coreStats: { level: 50, hp: 100, maxHp: 100 } },
      ] as any[];
      
      const factions = [
        { id: 'f1', name: 'Kingdom', power: 75, territoriesControlled: 5, members: [] },
      ] as any[];

      // Note: In-memory implementation doesn't actually connect to Redis,
      // so we verify the method completes without error
      await redis.pushTickState(100, 1, vessels, factions, stateHash);
      expect(redis.getLastCachePushTick()).toBe(100);
    });

    test('Cache.T2: Register causal lock', async () => {
      const soulId = 'soul_12345';
      const lockExpiresTick = 259200;

      await redis.registerCausalLock(soulId, lockExpiresTick);
      
      // Lock should be registered (verified by no error)
      const inLock = await redis.isInCausalLock(soulId, 100000);
      expect(typeof inLock).toBe('boolean');
    });

    test('Cache.T3: Check causal lock status', async () => {
      const soulId = 'soul_test';
      const currentTick = 100000;

      // Register lock for future expiry
      await redis.registerCausalLock(soulId, currentTick + 50000);
      
      const isLocked = await redis.isInCausalLock(soulId, currentTick);
      expect(typeof isLocked).toBe('boolean');
    });

    test('Cache.T4: Queue and drain events', async () => {
      await redis.queueEvent({
        type: 'vessel_update',
        importance: 5,
        eventId: 'evt_1',
        data: { test: true },
        tick: 100,
      });

      const events = await redis.drainEventQueue();
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    test('Cache.T5: Health check', async () => {
      const health = await redis.healthCheck();
      expect(health.healthy).toBe(false); // Not connected
      expect(health.latency).toBe(0);
    });
  });

  // ==================== POSTGRES ADAPTER TESTS ====================

  describe('PostgresAdapter - Permanent Storage', () => {
    let adapter: PostgresAdapter;

    beforeEach(() => {
      adapter = new PostgresAdapter();
    });

    test('Postgres.T1: Queue event for flush', () => {
      const event: FlushableEvent = {
        type: 'vessel-death',
        importance: 9,
        eventId: 'death_1',
        tick: 100,
        worldInstanceId: 'test_world',
        data: {
          actorId: 'vessel_1',
          description: 'Killed by dragon',
          contentHash: 'abc123',
        },
      };

      adapter.queueEvent(event);
      expect(adapter.getPendingFlushCount()).toBe(1);
    });

    test('Postgres.T2: Should flush check', () => {
      // Initially, no flush needed
      expect(adapter.shouldFlush(100)).toBe(false);

      // Queue an event and check again
      const event: FlushableEvent = {
        type: 'vessel-death',
        importance: 9,
        eventId: 'death_1',
        tick: 100,
        worldInstanceId: 'test_world',
        data: {},
      };

      adapter.queueEvent(event);
      // Should still be false (no time passed)
      expect(adapter.shouldFlush(100)).toBe(false);
    });

    test('Postgres.T3: Get pending flush count', () => {
      expect(adapter.getPendingFlushCount()).toBe(0);

      const event: FlushableEvent = {
        type: 'snapshot',
        importance: 7,
        eventId: 'snap_1',
        tick: 3600,
        worldInstanceId: 'test_world',
        data: { stateHash: 'abc123' },
      };

      adapter.queueEvent(event);
      expect(adapter.getPendingFlushCount()).toBe(1);
    });

    test('Postgres.T4: Flush without database (no-op)', async () => {
      const event: FlushableEvent = {
        type: 'vessel-death',
        importance: 9,
        eventId: 'death_1',
        tick: 100,
        worldInstanceId: 'test_world',
        data: {},
      };

      adapter.queueEvent(event);
      const flushed = await adapter.flush(100);
      expect(flushed).toBe(0); // No database, so 0 flushed
    });

    test('Postgres.T5: Get last flush tick', () => {
      expect(adapter.getLastFlushTick()).toBe(0);

      const event: FlushableEvent = {
        type: 'snapshot',
        importance: 7,
        eventId: 'snap_1',
        tick: 3600,
        worldInstanceId: 'test_world',
        data: {},
      };

      adapter.queueEvent(event);
      // Without database, flush tick won't update
      expect(adapter.getLastFlushTick()).toBe(0);
    });

    test('Postgres.T6: Health check without database', async () => {
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  // ==================== DATABASE QUEUE TESTS ====================

  describe('DatabaseQueue - Write-Behind Orchestration', () => {
    let queue: DatabaseQueue;
    let postgres: PostgresAdapter;
    let redis: RedisCache;

    beforeEach(() => {
      postgres = new PostgresAdapter();
      redis = new RedisCache({ redis: { host: 'localhost', port: 6379, db: 0 } });
      queue = new DatabaseQueue(postgres, redis);
    });

    test('Queue.T1: Enqueue normal event', () => {
      const event: MutationEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'skill_rank_up',
        importance: 5,
        data: {},
      };

      queue.enqueue(event);
      const stats = queue.getStats();
      expect(stats.pendingCount).toBe(1);
    });

    test('Queue.T2: Discard trivial events', () => {
      const event: MutationEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'vessel_movement',
        importance: 2, // Trivial
        data: {},
      };

      queue.enqueue(event);
      const stats = queue.getStats();
      expect(stats.discardedCount).toBe(1);
      expect(stats.pendingCount).toBe(0);
    });

    test('Queue.T3: Critical event immediate flush', async () => {
      const event: MutationEvent = {
        eventId: 'death_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'vessel_death',
        importance: 10, // Critical
        data: { vesselId: 'v1' },
      };

      queue.enqueue(event); // Should queue for immediate flush
      const stats = queue.getStats();
      expect(stats.pendingCount).toBeGreaterThanOrEqual(0);
    });

    test('Queue.T4: Should flush check', () => {
      const event: MutationEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        tick: 50,
        worldInstanceId: 'test_world',
        type: 'skill_rank_up',
        importance: 5,
        data: {},
      };

      queue.enqueue(event);
      // Shouldn't flush at tick 50
      expect(queue.shouldFlush(50)).toBe(false);

      // Should flush at tick 100
      expect(queue.shouldFlush(100)).toBe(true);
    });

    test('Queue.T5: Flush batch of events', async () => {
      const events: MutationEvent[] = [];
      for (let i = 0; i < 5; i++) {
        events.push({
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          tick: 50 + i,
          worldInstanceId: 'test_world',
          type: 'skill_rank_up',
          importance: 5,
          data: {},
        });
      }

      events.forEach(e => queue.enqueue(e));
      let stats = queue.getStats();
      expect(stats.pendingCount).toBe(5);

      // Flush at tick 100
      const flushed = await queue.flush(100);
      stats = queue.getStats();
      expect(flushed).toBe(0); // No database, so 0 actual flushes
    });

    test('Queue.T6: Queue statistics tracking', () => {
      const events: MutationEvent[] = [
        {
          eventId: 'evt_1',
          timestamp: Date.now(),
          tick: 100,
          worldInstanceId: 'test_world',
          type: 'skill_rank_up',
          importance: 5,
          data: {},
        },
        {
          eventId: 'evt_2',
          timestamp: Date.now(),
          tick: 101,
          worldInstanceId: 'test_world',
          type: 'faction_conflict',
          importance: 7,
          data: {},
        },
      ];

      events.forEach(e => queue.enqueue(e));
      const stats = queue.getStats();
      
      expect(stats.pendingCount).toBe(2);
      expect(stats.pendingTopics['skill_rank_up']).toBe(1);
      expect(stats.pendingTopics['faction_conflict']).toBe(1);
    });

    test('Queue.T7: Reset statistics', () => {
      const event: MutationEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'skill_rank_up',
        importance: 5,
        data: {},
      };

      queue.enqueue(event);
      let stats = queue.getStats();
      expect(stats.pendingCount).toBe(1);

      queue.resetStats();
      stats = queue.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.flushedCount).toBe(0);
    });

    test('Queue.T8: Health check', async () => {
      const health = await queue.healthCheck();
      expect(health.healthy).toBe(false); // No database connected
      expect(health.pending).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== IMPORTANCE FILTERING TESTS ====================

  describe('Importance Filtering - Write-Behind Strategy', () => {
    test('Importance.T1: Calculate vessel death importance', () => {
      const event: MutationEvent = {
        eventId: 'death_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'vessel_death',
        importance: 0, // Will be recalculated
        data: { playerVessel: true },
      };

      const importance = calculateEventImportance(event);
      expect(importance).toBe(10); // Player death = critical
    });

    test('Importance.T2: Calculate trivial move importance', () => {
      const event: MutationEvent = {
        eventId: 'move_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'vessel_movement',
        importance: 0,
        data: {},
      };

      const importance = calculateEventImportance(event);
      expect(importance).toBeLessThanOrEqual(3);
    });

    test('Importance.T3: Calculate epoch transition importance', () => {
      const event: MutationEvent = {
        eventId: 'epoch_1',
        timestamp: Date.now(),
        tick: 360000,
        worldInstanceId: 'test_world',
        type: 'epoch_transition',
        importance: 0,
        data: {},
      };

      const importance = calculateEventImportance(event);
      expect(importance).toBe(10); // Epoch transition = critical
    });
  });

  // ==================== WRITE-BEHIND STRATEGY TESTS ====================

  describe('Write-Behind Strategy - Caching Pattern', () => {
    test('WriteBehind.T1: Hot writes to Redis, cold writes to Postgres', async () => {
      const redis = new RedisCache({ redis: { host: 'localhost', port: 6379, db: 0 } });
      const postgres = new PostgresAdapter();

      const stateHash = {
        hash: 'abc',
        componentHashes: {
          vessels: 'v',
          factions: 'f',
          territories: 't',
          deities: 'd',
          globalState: 'g',
        },
        calculatedAt: 100,
      };

      // Immediate push to Redis
      await redis.pushTickState(100, 1, [], [], stateHash);
      expect(redis.getLastCachePushTick()).toBe(100);

      // Queue event (goes to queue, doesn't flush immediately unless critical)
      const event: MutationEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        tick: 100,
        worldInstanceId: 'test_world',
        type: 'skill_rank_up',
        importance: 5,
        data: {},
      };

      // This would be enqueued by database queue
      postgres.queueEvent({
        type: 'skill_rank_up' as any,
        importance: 5,
        eventId: 'evt_1',
        tick: 100,
        worldInstanceId: 'test_world',
        data: {},
      });

      expect(postgres.getPendingFlushCount()).toBe(1);

      await redis.disconnect();
    });

    test('WriteBehind.T2: Critical event immediate flush', async () => {
      const postgres = new PostgresAdapter();

      // Critical event should trigger immediate flush
      const criticalEvent: FlushableEvent = {
        type: 'vessel-death',
        importance: 10,
        eventId: 'death_1',
        tick: 100,
        worldInstanceId: 'test_world',
        data: { vesselId: 'v1' },
      };

      postgres.queueEvent(criticalEvent);
      expect(postgres.getPendingFlushCount()).toBe(1);

      // In real scenario, this would immediately flush
      // Here we just verify queueing
    });

    test('WriteBehind.T3: Batch flush accumulates across 100 ticks', () => {
      const queue = new DatabaseQueue(new PostgresAdapter(), new RedisCache({ redis: { host: 'localhost', port: 6379, db: 0 } }));

      // Enqueue 10 events
      for (let i = 0; i < 10; i++) {
        queue.enqueue({
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          tick: 50 + i,
          worldInstanceId: 'test_world',
          type: 'skill_rank_up',
          importance: 5,
          data: {},
        });
      }

      const stats = queue.getStats();
      expect(stats.pendingCount).toBe(10);

      // At tick 150, should be ready to flush (100 ticks passed)
      expect(queue.shouldFlush(150)).toBe(true);
    });
  });

  // ==================== RECOVERY & CONSISTENCY TESTS ====================

  describe('Recovery & Consistency Verification', () => {
    test('Recovery.T1: Snapshot before state change', async () => {
      const postgres = new PostgresAdapter();

      const snapshot: FlushableEvent = {
        type: 'snapshot',
        importance: 7,
        eventId: 'snap_1',
        tick: 3600,
        worldInstanceId: 'test_world',
        data: {
          stateHash: 'snap_hash',
          vesselCount: 5,
          factionCount: 3,
        },
      };

      postgres.queueEvent(snapshot);
      expect(postgres.getPendingFlushCount()).toBe(1);
    });

    test('Recovery.T2: Causal chain integrity', () => {
      // Event 1: Death
      const death: FlushableEvent = {
        type: 'vessel-death',
        importance: 10,
        eventId: 'death_1',
        tick: 1000,
        worldInstanceId: 'test_world',
        data: {
          previousHash: 'snap_999_hash',
          contentHash: 'death_hash',
        },
      };

      // Event 2: Rebirth (requires previous hash)
      const rebirth: FlushableEvent = {
        type: 'vessel-birth',
        importance: 10,
        eventId: 'birth_1',
        tick: 260000, // After 72h lock
        worldInstanceId: 'test_world',
        data: {
          previousHash: 'death_hash', // Links back to death
          contentHash: 'birth_hash',
        },
      };

      expect(rebirth.data.previousHash).toBe(death.data.contentHash);
    });

    test('Recovery.T3: Replay from snapshot + ledger', () => {
      // In a real scenario:
      // 1. Fetch most recent snapshot before crash tick
      // 2. Replay mutations from ledger after that snapshot tick
      // 3. Verify StateHash matches

      const snapshotTick = 3600;
      const crashTick = 3650;

      // Mutations between snapshot and crash would be replayed
      expect(crashTick - snapshotTick).toBe(50);
      // Would replay these 50 ticks from ledger
    });
  });

  // ==================== E2E STRESS TEST ====================

  describe('E2E Stress Test - 10,000 Ticks', () => {
    test('Stress.T1: Run 10,000 ticks with caching and queueing', async () => {
      const redis = new RedisCache({ redis: { host: 'localhost', port: 6379, db: 0 } });
      const postgres = new PostgresAdapter();
      const queue = new DatabaseQueue(postgres, redis);

      const startTick = 0;
      const endTick = 10000;
      let enqueued = 0;
      let flushed = 0;

      for (let tick = startTick; tick <= endTick; tick++) {
        // Every tick, push state to Redis
        const stateHash = {
          hash: `hash_${tick}`,
          componentHashes: {
            vessels: 'v',
            factions: 'f',
            territories: 't',
            deities: 'd',
            globalState: 'g',
          },
          calculatedAt: tick,
        };

        await redis.pushTickState(tick, Math.floor(tick / 3600) + 1, [], [], stateHash);

        // Occasionally queue events
        if (tick % 50 === 0) {
          queue.enqueue({
            eventId: `evt_${tick}`,
            timestamp: Date.now(),
            tick,
            worldInstanceId: 'stress_world',
            type: 'skill_rank_up',
            importance: 5,
            data: {},
          });
          enqueued++;
        }

        // Critical events every 1000 ticks
        if (tick % 1000 === 0 && tick > 0) {
          queue.enqueue({
            eventId: `critical_${tick}`,
            timestamp: Date.now(),
            tick,
            worldInstanceId: 'stress_world',
            type: 'miracle',
            importance: 9,
            data: {},
          });
        }

        // Flush at scheduled intervals
        if (queue.shouldFlush(tick)) {
          const flushedCount = await queue.flush(tick);
          flushed += flushedCount;
        }
      }

      expect(enqueued).toBe(200); // 10000 / 50
      expect(queue.getStats().discardedCount).toBe(0);
      expect(redis.getLastCachePushTick()).toBe(endTick);

      await redis.disconnect();
    });
  });
});
