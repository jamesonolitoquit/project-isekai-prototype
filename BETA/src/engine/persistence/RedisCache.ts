/**
 * Phase 27: Redis Hot-Cache Layer
 * Manages sub-15ms retrieval of active world state and recent mutation logs
 * 
 * Strategy:
 * - Cache current WorldState and last 1,000 MutationLog entries
 * - TTL: 2 minutes (120s) for auto-invalidation if process crashes
 * - Write-behind pattern: Fast writes to Redis, async flush to Postgres
 */

import { createClient, RedisClientType } from 'redis';

export interface ActiveWorldSnapshot {
  worldId: string;
  tick: number;
  season: string;
  weather: string;
  paradoxLevel: number;
  state: any;
  timestamp: number;
}

export interface CachedMutationEvent {
  id: string;
  worldInstanceId: string;
  eventType: string;
  tick: number;
  importance: number;
  timestamp: number;
  payload: any;
}

export class RedisCache {
  private client: RedisClientType | null = null;
  private config: any;
  private isConnected: boolean = false;
  private ttlSeconds = 120; // 2-minute TTL for auto-invalidation

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: `redis://${this.config.redis.host}:${this.config.redis.port}/${this.config.redis.db}`,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 50, 500),
        },
      });

      this.client.on('error', (err) => {
        console.error('[RedisCache] Client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisCache] Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('[RedisCache] Redis connection established');
    } catch (error: any) {
      console.error('[RedisCache] Failed to connect:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('[RedisCache] Disconnected from Redis');
    }
  }

  /**
   * Save active world state with sub-15ms latency target
   */
  async setActiveWorldState(snapshot: ActiveWorldSnapshot): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const key = `world:${snapshot.worldId}:active`;
      const compressedState = JSON.stringify(snapshot);
      
      const startTime = performance.now();
      await this.client.setEx(key, this.ttlSeconds, compressedState);
      const latency = performance.now() - startTime;

      if (latency > 5) {
        console.warn(`[RedisCache] SET latency ${latency.toFixed(2)}ms (target <5ms)`);
      }

      return true;
    } catch (error: any) {
      console.error('[RedisCache] setActiveWorldState error:', error.message);
      return false;
    }
  }

  /**
   * Retrieve active world state (should complete in <5ms)
   */
  async getActiveWorldState(worldId: string): Promise<ActiveWorldSnapshot | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const key = `world:${worldId}:active`;
      
      const startTime = performance.now();
      const data = await this.client.get(key);
      const latency = performance.now() - startTime;

      if (latency > 5) {
        console.warn(`[RedisCache] GET latency ${latency.toFixed(2)}ms (target <5ms)`);
      }

      if (!data) {
        console.log(`[RedisCache] Cache miss for ${key}`);
        return null;
      }

      return data ? JSON.parse(data as string) : null;
    } catch (error: any) {
      console.error('[RedisCache] getActiveWorldState error:', error.message);
      return null;
    }
  }

  /**
   * Add mutation event to cache (maintains last 1,000 events)
   */
  async pushMutationEvent(
    worldId: string,
    event: CachedMutationEvent
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const key = `world:${worldId}:mutations`;
      const eventJson = JSON.stringify(event);

      // Push to list and trim to last 1,000
      await this.client.lPush(key, eventJson);
      await this.client.lTrim(key, 0, 999);
      await this.client.expire(key, this.ttlSeconds);

      return true;
    } catch (error: any) {
      console.error('[RedisCache] pushMutationEvent error:', error.message);
      return false;
    }
  }

  /**
   * Retrieve last N mutation events
   */
  async getMutationEvents(
    worldId: string,
    count: number = 100
  ): Promise<CachedMutationEvent[]> {
    if (!this.client || !this.isConnected) return [];

    try {
      const key = `world:${worldId}:mutations`;
      const events = await this.client.lRange(key, 0, count - 1);

      return events.map((e) => JSON.parse(e));
    } catch (error: any) {
      console.error('[RedisCache] getMutationEvents error:', error.message);
      return [];
    }
  }

  /**
   * Cache seasonal modifiers (refreshed every 1000 ticks)
   */
  async setSeasonalModifiers(
    worldId: string,
    modifiers: any
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const key = `world:${worldId}:seasonal-modifiers`;
      await this.client.setEx(
        key,
        this.ttlSeconds,
        JSON.stringify(modifiers)
      );
      return true;
    } catch (error: any) {
      console.error('[RedisCache] setSeasonalModifiers error:', error.message);
      return false;
    }
  }

  /**
   * Retrieve cached seasonal modifiers
   */
  async getSeasonalModifiers(worldId: string): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const key = `world:${worldId}:seasonal-modifiers`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error: any) {
      console.error('[RedisCache] getSeasonalModifiers error:', error.message);
      return null;
    }
  }

  /**
   * Cache player inventory
   */
  async setPlayerInventory(
    worldId: string,
    playerId: string,
    inventory: any
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const key = `world:${worldId}:player:${playerId}:inventory`;
      await this.client.setEx(
        key,
        this.ttlSeconds,
        JSON.stringify(inventory)
      );
      return true;
    } catch (error: any) {
      console.error('[RedisCache] setPlayerInventory error:', error.message);
      return false;
    }
  }

  /**
   * Get player inventory from cache
   */
  async getPlayerInventory(
    worldId: string,
    playerId: string
  ): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const key = `world:${worldId}:player:${playerId}:inventory`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error: any) {
      console.error('[RedisCache] getPlayerInventory error:', error.message);
      return null;
    }
  }

  /**
   * Cache NPC state
   */
  async setNpcState(
    worldId: string,
    npcId: string,
    state: any
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const key = `world:${worldId}:npc:${npcId}`;
      await this.client.setEx(key, this.ttlSeconds, JSON.stringify(state));
      return true;
    } catch (error: any) {
      console.error('[RedisCache] setNpcState error:', error.message);
      return false;
    }
  }

  /**
   * Get NPC state from cache
   */
  async getNpcState(worldId: string, npcId: string): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const key = `world:${worldId}:npc:${npcId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error: any) {
      console.error('[RedisCache] getNpcState error:', error.message);
      return null;
    }
  }

  /**
   * Invalidate all caches for a world (used during patch deployment)
   */
  async invalidateWorld(worldId: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const pattern = `world:${worldId}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(
          `[RedisCache] Invalidated ${keys.length} cache entries for ${worldId}`
        );
      }

      return true;
    } catch (error: any) {
      console.error('[RedisCache] invalidateWorld error:', error.message);
      return false;
    }
  }

  /**
   * Get total cache memory usage
   */
  async getCacheStats(): Promise<any> {
    if (!this.client || !this.isConnected) return null;

    try {
      const info = await this.client.info('memory');
      const stats = info.split('\r\n').reduce((acc: any, line: string) => {
        const [key, value] = line.split(':');
        if (key && value) acc[key] = value;
        return acc;
      }, {});

      return {
        usedMemory: stats.used_memory,
        usedMemoryHuman: stats.used_memory_human,
        peakMemory: stats.peak_memory,
        memoryFragmentationRatio: stats.mem_fragmentation_ratio,
      };
    } catch (error: any) {
      console.error('[RedisCache] getCacheStats error:', error.message);
      return null;
    }
  }

  /**
   * Phase 36: Ledger Compaction Job
   * 
   * Scans recent mutation events and collapses redundant updates.
   * Called every 1,000 ticks to reduce Redis memory footprint.
   * 
   * Strategy:
   * - Group events by (actorId, property)
   * - If >5 events update same property, collapse to "State Summary" event
   * - Remove redundant intermediate events from Redis
   * 
   * @param worldId World instance ID
   * @returns Count of events compacted
   */
  async compactLedger(worldId: string): Promise<number> {
    if (!this.client || !this.isConnected) return 0;

    try {
      const mutationKey = `world:${worldId}:mutations`;
      const mutationList = await this.client.lRange(mutationKey, 0, -1);

      if (mutationList.length < 5) {
        console.log(`[RedisCache] Compaction skipped: only ${mutationList.length} events`);
        return 0;
      }

      console.log(`[RedisCache] Starting ledger compaction for ${worldId}: ${mutationList.length} events`);

      // Parse all events
      const events: CachedMutationEvent[] = mutationList.map((e: string) => {
        try {
          return JSON.parse(e);
        } catch {
          return null;
        }
      }).filter((e: any) => e !== null);

      // Group by (actorId, eventType)
      const groupedEvents: Map<string, CachedMutationEvent[]> = new Map();
      for (const event of events) {
        const key = `${event.payload?.actorId || 'system'}:${event.eventType}`;
        if (!groupedEvents.has(key)) {
          groupedEvents.set(key, []);
        }
        groupedEvents.get(key)!.push(event);
      }

      // Find candidates for compaction (groups with >5 redundant updates)
      let compactedCount = 0;
      const survivingEvents: CachedMutationEvent[] = [];

      for (const [groupKey, eventGroup] of groupedEvents) {
        if (eventGroup.length > 5) {
          // Create summary event
          const summaryEvent: CachedMutationEvent = {
            id: `compacted-${Date.now()}`,
            worldInstanceId: eventGroup[0].worldInstanceId,
            eventType: 'STATE_SUMMARY',
            tick: eventGroup[eventGroup.length - 1].tick,
            importance: Math.max(...eventGroup.map(e => e.importance)),
            timestamp: Date.now(),
            payload: {
              actorId: eventGroup[0].payload?.actorId,
              originalEventType: eventGroup[0].eventType,
              collapsedCount: eventGroup.length,
              firstTick: eventGroup[0].tick,
              lastTick: eventGroup[eventGroup.length - 1].tick,
              finalState: eventGroup[eventGroup.length - 1].payload
            }
          };

          survivingEvents.push(summaryEvent);
          compactedCount += eventGroup.length - 1; // All but the summary
          console.log(`[RedisCache] Compacted: ${groupKey} (${eventGroup.length} events → 1 summary)`);
        } else {
          // Keep individual events if not enough redundancy
          survivingEvents.push(...eventGroup);
        }
      }

      // Update Redis with compacted list
      if (compactedCount > 0) {
        // Clear old list
        await this.client.del(mutationKey);

        // Write compacted list
        for (const event of survivingEvents) {
          await this.client.rPush(mutationKey, JSON.stringify(event));
        }

        // Set expiry
        await this.client.expire(mutationKey, this.ttlSeconds);

        console.log(`[RedisCache] Compaction complete: ${compactedCount} events consolidated`);
      }

      return compactedCount;
    } catch (error: any) {
      console.error('[RedisCache] compactLedger error:', error.message);
      return 0;
    }
  }

  /**
   * Generic hot cache set operation (used by DatabaseAdapter)
   */
  async cacheSet(key: string, value: any, ttl: number = 120): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error: any) {
      console.error('[RedisCache] cacheSet error:', error.message);
      return false;
    }
  }

  /**
   * Generic hot cache get operation (used by DatabaseAdapter)
   */
  async cacheGet(key: string): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error: any) {
      console.error('[RedisCache] cacheGet error:', error.message);
      return null;
    }
  }

  /**
   * Generic hot cache delete operation (used by DatabaseAdapter)
   */
  async cacheDel(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error: any) {
      console.error('[RedisCache] cacheDel error:', error.message);
      return false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Global Redis cache instance
let redisCacheInstance: RedisCache | null = null;

export function getRedisCache(): RedisCache | null {
  return redisCacheInstance;
}

export function setRedisCache(cache: RedisCache): void {
  redisCacheInstance = cache;
}

// Alias for backward compatibility (can be used as type)
export type RedisCacheManager = RedisCache;

/**
 * In-Memory Redis Client Mock for testing without Redis server
 */
export class InMemoryRedisClient {
  private store: Map<string, string> = new Map();
  private ttls: Map<string, NodeJS.Timeout> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    
    // Clear existing TTL
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key)!);
    }
    
    // Set new TTL
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.ttls.delete(key);
    }, seconds * 1000);
    
    this.ttls.set(key, timeout);
  }

  async del(key: string): Promise<number> {
    const had = this.store.has(key);
    this.store.delete(key);
    
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key)!);
      this.ttls.delete(key);
    }
    
    return had ? 1 : 0;
  }

  async lpush(key: string, value: string): Promise<number> {
    // Simplified: treat as array
    const existing = this.store.get(key);
    const arr = existing ? JSON.parse(existing) : [];
    arr.unshift(value);
    this.store.set(key, JSON.stringify(arr));
    return arr.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const existing = this.store.get(key);
    if (!existing) return [];
    const arr = JSON.parse(existing);
    return arr.slice(start, stop + 1);
  }

  async llen(key: string): Promise<number> {
    const existing = this.store.get(key);
    if (!existing) return 0;
    const arr = JSON.parse(existing);
    return arr.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const existing = this.store.get(key);
    if (!existing) return;
    const arr = JSON.parse(existing);
    const trimmed = arr.slice(start, stop + 1);
    this.store.set(key, JSON.stringify(trimmed));
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.store.get(key) ?? '0', 10);
    const newVal = val + 1;
    this.store.set(key, newVal.toString());
    return newVal;
  }

  async decr(key: string): Promise<number> {
    const val = parseInt(this.store.get(key) ?? '0', 10);
    const newVal = val - 1;
    this.store.set(key, newVal.toString());
    return newVal;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    // Simplified: if pattern ends with *, treat it as prefix match
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return Array.from(this.store.keys()).filter(k => k.startsWith(prefix));
    }
    return Array.from(this.store.keys());
  }

  async flushDb(): Promise<void> {
    this.store.clear();
    this.ttls.forEach(timeout => clearTimeout(timeout));
    this.ttls.clear();
  }

  on(event: string, callback: (...args: any[]) => void): void {
    // Mock: do nothing
  }

  async connect(): Promise<void> {
    // Mock: do nothing
  }

  async quit(): Promise<void> {
    await this.flushDb();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}
