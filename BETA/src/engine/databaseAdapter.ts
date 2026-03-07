/**
 * Phase 27: Database Adapter Layer
 * Handles persistence of world state, mutation logs, and character records
 * 
 * Architecture:
 * - PostgreSQL: Long-term storage of all world state, immutable mutation logs, hard facts
 * - Redis: Hot cache for active ticks (current 1000-year window) for <15ms retrieval
 * - Schema: Normalized for efficient querying and pruning
 */

import { RedisCache } from './persistence/RedisCache';

export interface DatabaseConfig {
  // PostgreSQL connection
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  
  // Redis connection
  redis: {
    host: string;
    port: number;
    db: number;
  };

  // Pruning configuration
  pruning: {
    enabled: boolean;
    minImportanceForStorage: number;
    archiveAfterEpochs: number;  // Move to cold storage after N epochs
  };
}

/**
 * Schema definitions for PostgreSQL
 */
export const PG_SCHEMA = {
  // Main world state table (current tick snapshot)
  worldState: `
    CREATE TABLE IF NOT EXISTS world_state (
      id TEXT PRIMARY KEY,
      tick INTEGER NOT NULL,
      season TEXT NOT NULL,
      weather TEXT NOT NULL,
      paradox_level INTEGER DEFAULT 0,
      epoch_id TEXT,
      chronicle_id TEXT,
      template_version TEXT,
      state_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      compressed_state BYTEA NOT NULL
    );
    CREATE INDEX idx_world_state_tick ON world_state(tick);
    CREATE INDEX idx_world_state_epoch ON world_state(epoch_id);
  `,

  // Canonical mutation log (immutable event log)
  mutationLog: `
    CREATE TABLE IF NOT EXISTS mutation_log (
      id TEXT PRIMARY KEY,
      world_instance_id TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      timestamp BIGINT NOT NULL,
      tick INTEGER NOT NULL,
      importance_score INTEGER DEFAULT 0,
      is_canonical BOOLEAN DEFAULT FALSE,
      pruned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (world_instance_id) REFERENCES world_state(id)
    );
    CREATE INDEX idx_mutation_log_world ON mutation_log(world_instance_id);
    CREATE INDEX idx_mutation_log_tick ON mutation_log(tick);
    CREATE INDEX idx_mutation_log_canonical ON mutation_log(is_canonical);
    CREATE INDEX idx_mutation_log_type ON mutation_log(event_type);
  `,

  // Character records (player and NPC persistent data)
  characterRecords: `
    CREATE TABLE IF NOT EXISTS character_records (
      id TEXT PRIMARY KEY,
      world_instance_id TEXT NOT NULL,
      character_type TEXT NOT NULL,
      name TEXT,
      stats JSONB,
      inventory JSONB,
      location_id TEXT,
      created_at_tick INTEGER,
      last_updated_tick INTEGER,
      bloodline_divergences TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (world_instance_id) REFERENCES world_state(id)
    );
    CREATE INDEX idx_character_world ON character_records(world_instance_id);
    CREATE INDEX idx_character_type ON character_records(character_type);
  `,

  // Patch history (track all Live Ops patches applied)
  patchHistory: `
    CREATE TABLE IF NOT EXISTS patch_history (
      id TEXT PRIMARY KEY,
      world_instance_id TEXT NOT NULL,
      patch_id TEXT NOT NULL,
      patch_content JSONB NOT NULL,
      applied_at_tick INTEGER NOT NULL,
      status TEXT NOT NULL,
      validation_errors TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (world_instance_id) REFERENCES world_state(id)
    );
    CREATE INDEX idx_patch_history_world ON patch_history(world_instance_id);
    CREATE INDEX idx_patch_history_tick ON patch_history(applied_at_tick);
  `,

  // Hard facts / Immutable epic events
  hardFacts: `
    CREATE TABLE IF NOT EXISTS hard_facts (
      id TEXT PRIMARY KEY,
      world_instance_id TEXT NOT NULL,
      fact_type TEXT NOT NULL,
      event_id TEXT,
      fact_data JSONB NOT NULL,
      established_at_tick INTEGER NOT NULL,
      is_immutable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (world_instance_id) REFERENCES world_state(id)
    );
    CREATE INDEX idx_hard_facts_world ON hard_facts(world_instance_id);
    CREATE INDEX idx_hard_facts_immutable ON hard_facts(is_immutable);
  `,

  // Archive: Cold storage for old epochs (before selective pruning)
  mutationLogArchive: `
    CREATE TABLE IF NOT EXISTS mutation_log_archive (
      id TEXT PRIMARY KEY,
      world_instance_id TEXT NOT NULL,
      epoch_id TEXT NOT NULL,
      event_count INTEGER,
      canonical_count INTEGER,
      pruned_at TIMESTAMP,
      archive_hash TEXT,
      compressed_events BYTEA,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX idx_archive_world ON mutation_log_archive(world_instance_id);
    CREATE INDEX idx_archive_epoch ON mutation_log_archive(epoch_id);
  `,

  // Redis key structure (hot cache)
  redisKeys: {
    activeState: (worldId: string) => `world:${worldId}:state`,
    activeTick: (worldId: string) => `world:${worldId}:tick`,
    seasonalModifiers: (worldId: string) => `world:${worldId}:seasonal`,
    playerInventory: (worldId: string, playerId: string) => `player:${playerId}:inventory`,
    npcState: (worldId: string, npcId: string) => `npc:${npcId}:state`,
    mutationLogCache: (worldId: string) => `world:${worldId}:mutations`,
  }
};

/**
 * Abstract Database Adapter
 * Can be extended for different database backends
 */
export abstract class DatabaseAdapter {
  protected config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  // World State Operations
  abstract saveWorldState(worldId: string, state: any): Promise<boolean>;
  abstract loadWorldState(worldId: string): Promise<any | null>;
  abstract getWorldSnapshot(worldId: string, tick?: number): Promise<any | null>;

  // Mutation Log Operations
  abstract appendMutationEvent(worldId: string, event: any): Promise<boolean>;
  abstract getMutationLog(worldId: string, options?: { from?: number; to?: number; type?: string; canonical?: boolean }): Promise<any[]>;
  abstract pruneMutationLog(worldId: string, weights: Record<string, number>): Promise<number>; // Returns count of pruned events

  // Character Operations
  abstract saveCharacter(worldId: string, character: any): Promise<boolean>;
  abstract loadCharacter(worldId: string, characterId: string): Promise<any | null>;
  abstract getAllCharacters(worldId: string): Promise<any[]>;

  // Patch Operations
  abstract savePatch(worldId: string, patch: any): Promise<boolean>;
  abstract getPatchHistory(worldId: string): Promise<any[]>;

  // Hard Facts Operations
  abstract registerHardFact(worldId: string, fact: any): Promise<boolean>;
  abstract getHardFacts(worldId: string): Promise<any[]>;

  // Hot Cache Operations
  abstract setHotCache(key: string, value: any, ttl?: number): Promise<boolean>;
  abstract getHotCache(key: string): Promise<any | null>;
  abstract invalidateHotCache(key: string): Promise<boolean>;

  // Archive Operations
  abstract archiveEpoch(worldId: string, epochId: string): Promise<boolean>;
  abstract restoreEpoch(worldId: string, epochId: string): Promise<any | null>;

  // Health check
  abstract isConnected(): Promise<boolean>;

  // Active State Operations
  abstract saveActiveStateToPostgres(worldId: string, state: any, mutationEvents: any[], narrativePruningWeights: Record<string, number>): Promise<boolean>;

  // Multiverse Operations
  abstract getGlobalParadoxAverage(): Promise<{ average: number; topWorlds: any[] }>;
}

/**
 * PostgreSQL-specific adapter implementation
 * Note: Requires pg package: npm install pg
 */
export class PostgreSQLAdapter extends DatabaseAdapter {
  private pool: any = null; // Database connection pool
  private redisCache: RedisCache | null = null; // Redis cache for hot data

  async initialize(): Promise<void> {
    try {
      const { Pool } = await import('pg');
      this.pool = new Pool({
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: this.config.postgres.database,
        user: this.config.postgres.user,
        password: this.config.postgres.password,
      });

      // Create schema if not exists
      await this.initializeSchema();
      console.log('[DatabaseAdapter] PostgreSQL connection established');

      // Initialize Redis cache
      this.redisCache = new RedisCache(this.config);
      await this.redisCache.connect();
    } catch (error: any) {
      console.error('[DatabaseAdapter] Failed to initialize PostgreSQL:', error.message);
      throw error;
    }
  }

  private async initializeSchema(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      // Execute schema creation
      for (const [table, sql] of Object.entries(PG_SCHEMA)) {
        if (typeof sql === 'string' && table !== 'redisKeys') {
          await client.query(sql);
        }
      }
      console.log('[DatabaseAdapter] Schema initialized');
    } catch (error: any) {
      console.warn('[DatabaseAdapter] Schema initialization warning:', error.message);
    } finally {
      client.release();
    }
  }

  async saveWorldState(worldId: string, state: any): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const stateHash = this.hashState(state);
      const compressedState = Buffer.from(JSON.stringify(state), 'utf-8');

      const query = `
        INSERT INTO world_state (id, tick, season, weather, paradox_level, epoch_id, chronicle_id, template_version, state_hash, compressed_state)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          tick = $2,
          season = $3,
          weather = $4,
          paradox_level = $5,
          epoch_id = $6,
          chronicle_id = $7,
          state_hash = $9,
          compressed_state = $10,
          updated_at = NOW()
      `;

      const values = [
        worldId,
        state.tick || 0,
        state.season || 'winter',
        state.weather || 'clear',
        state.paradoxLevel || 0,
        state.epochId || null,
        state.chronicleId || null,
        '1.0',
        stateHash,
        compressedState
      ];

      await this.pool.query(query, values);
      console.log(`[DatabaseAdapter] World state saved: ${worldId} at tick ${state.tick}`);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] saveWorldState error:', error.message);
      return false;
    }
  }

  async loadWorldState(worldId: string): Promise<any | null> {
    if (!this.pool) return null;

    try {
      const query = `
        SELECT compressed_state FROM world_state WHERE id = $1 ORDER BY created_at DESC LIMIT 1
      `;
      const result = await this.pool.query(query, [worldId]);

      if (result.rows.length === 0) {
        return null;
      }

      const state = JSON.parse(result.rows[0].compressed_state.toString('utf-8'));
      console.log(`[DatabaseAdapter] World state loaded: ${worldId}`);
      return state;
    } catch (error: any) {
      console.error('[DatabaseAdapter] loadWorldState error:', error.message);
      return null;
    }
  }

  async getWorldSnapshot(worldId: string, tick?: number): Promise<any | null> {
    if (!this.pool) return null;

    try {
      let query = `SELECT tick, season, weather, paradox_level, state_hash FROM world_state WHERE id = $1`;
      const values: any[] = [worldId];

      if (tick !== undefined) {
        query += ` AND tick <= $2 ORDER BY tick DESC LIMIT 1`;
        values.push(tick);
      } else {
        query += ` ORDER BY tick DESC LIMIT 1`;
      }

      const result = await this.pool.query(query, values);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('[DatabaseAdapter] getWorldSnapshot error:', error.message);
      return null;
    }
  }

  async appendMutationEvent(worldId: string, event: any): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const query = `
        INSERT INTO mutation_log (id, world_instance_id, actor_id, event_type, payload, timestamp, tick, importance_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      const values = [
        event.id || `event-${Date.now()}`,
        worldId,
        event.actorId || 'system',
        event.type,
        JSON.stringify(event.payload || {}),
        event.timestamp || Date.now(),
        event.tick || 0,
        event.importance || 0
      ];

      await this.pool.query(query, values);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] appendMutationEvent error:', error.message);
      return false;
    }
  }

  async getMutationLog(worldId: string, options?: any): Promise<any[]> {
    if (!this.pool) return [];

    try {
      let query = `SELECT * FROM mutation_log WHERE world_instance_id = $1`;
      const values: any[] = [worldId];
      let paramCount = 1;

      if (options?.from !== undefined) {
        paramCount++;
        query += ` AND tick >= $${paramCount}`;
        values.push(options.from);
      }

      if (options?.to !== undefined) {
        paramCount++;
        query += ` AND tick <= $${paramCount}`;
        values.push(options.to);
      }

      if (options?.type) {
        paramCount++;
        query += ` AND event_type = $${paramCount}`;
        values.push(options.type);
      }

      if (options?.canonical) {
        query += ` AND is_canonical = true`;
      }

      query += ` ORDER BY tick ASC LIMIT 10000`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error: any) {
      console.error('[DatabaseAdapter] getMutationLog error:', error.message);
      return [];
    }
  }

  async pruneMutationLog(worldId: string, weights: Record<string, number>): Promise<number> {
    if (!this.pool) return 0;

    try {
      // Get all events and calculate importance
      const events = await this.getMutationLog(worldId);
      const threshold = Math.max(...Object.values(weights)) * 0.5; // Keep top 50% by importance

      let prunedCount = 0;
      for (const event of events) {
        const weight = weights[event.event_type] || 0;
        if (weight < threshold && !event.is_canonical) {
          const query = `UPDATE mutation_log SET pruned = true WHERE id = $1`;
          await this.pool.query(query, [event.id]);
          prunedCount++;
        }
      }

      console.log(`[DatabaseAdapter] Pruned ${prunedCount} mutation log entries`);
      return prunedCount;
    } catch (error: any) {
      console.error('[DatabaseAdapter] pruneMutationLog error:', error.message);
      return 0;
    }
  }

  async saveCharacter(worldId: string, character: any): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const query = `
        INSERT INTO character_records (id, world_instance_id, character_type, name, stats, inventory, location_id, created_at_tick, last_updated_tick)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          stats = $5,
          inventory = $6,
          location_id = $7,
          last_updated_tick = $9,
          updated_at = NOW()
      `;

      const values = [
        character.id,
        worldId,
        character.kind || 'npc',
        character.name || '',
        JSON.stringify(character.stats || {}),
        JSON.stringify(character.inventory || []),
        character.locationId || null,
        character.createdAtTick || 0,
        character.lastUpdatedTick || 0
      ];

      await this.pool.query(query, values);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] saveCharacter error:', error.message);
      return false;
    }
  }

  async loadCharacter(worldId: string, characterId: string): Promise<any | null> {
    if (!this.pool) return null;

    try {
      const query = `
        SELECT * FROM character_records WHERE world_instance_id = $1 AND id = $2
      `;
      const result = await this.pool.query(query, [worldId, characterId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('[DatabaseAdapter] loadCharacter error:', error.message);
      return null;
    }
  }

  async getAllCharacters(worldId: string): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const query = `SELECT * FROM character_records WHERE world_instance_id = $1 ORDER BY created_at DESC LIMIT 1000`;
      const result = await this.pool.query(query, [worldId]);
      return result.rows;
    } catch (error: any) {
      console.error('[DatabaseAdapter] getAllCharacters error:', error.message);
      return [];
    }
  }

  async savePatch(worldId: string, patch: any): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const query = `
        INSERT INTO patch_history (id, world_instance_id, patch_id, patch_content, applied_at_tick, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const values = [
        `patch-${Date.now()}`,
        worldId,
        patch.id || 'unknown',
        JSON.stringify(patch),
        patch.appliedAtTick || 0,
        patch.status || 'applied'
      ];

      await this.pool.query(query, values);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] savePatch error:', error.message);
      return false;
    }
  }

  async getPatchHistory(worldId: string): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const query = `SELECT * FROM patch_history WHERE world_instance_id = $1 ORDER BY created_at DESC LIMIT 100`;
      const result = await this.pool.query(query, [worldId]);
      return result.rows;
    } catch (error: any) {
      console.error('[DatabaseAdapter] getPatchHistory error:', error.message);
      return [];
    }
  }

  async registerHardFact(worldId: string, fact: any): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const query = `
        INSERT INTO hard_facts (id, world_instance_id, fact_type, event_id, fact_data, established_at_tick, is_immutable)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        fact.id || `fact-${Date.now()}`,
        worldId,
        fact.type || 'epic_event',
        fact.eventId || null,
        JSON.stringify(fact),
        fact.tick || 0,
        true
      ];

      await this.pool.query(query, values);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] registerHardFact error:', error.message);
      return false;
    }
  }

  async getHardFacts(worldId: string): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const query = `SELECT * FROM hard_facts WHERE world_instance_id = $1 AND is_immutable = true`;
      const result = await this.pool.query(query, [worldId]);
      return result.rows;
    } catch (error: any) {
      console.error('[DatabaseAdapter] getHardFacts error:', error.message);
      return [];
    }
  }

  async setHotCache(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.redisCache) return false;
    
    try {
      return await this.redisCache.cacheSet(key, value, ttl || 120);
    } catch (error: any) {
      console.error('[DatabaseAdapter] setHotCache error:', error.message);
      return false;
    }
  }

  async getHotCache(key: string): Promise<any | null> {
    if (!this.redisCache) return null;
    
    try {
      return await this.redisCache.cacheGet(key);
    } catch (error: any) {
      console.error('[DatabaseAdapter] getHotCache error:', error.message);
      return null;
    }
  }

  async invalidateHotCache(key: string): Promise<boolean> {
    if (!this.redisCache) return false;
    
    try {
      return await this.redisCache.cacheDel(key);
    } catch (error: any) {
      console.error('[DatabaseAdapter] invalidateHotCache error:', error.message);
      return false;
    }
  }

  /**
   * Phase 27: Flush Redis hot-cache to PostgreSQL with narrative pruning
   * Write-behind strategy: Efficient Redis writes, periodic Postgres flushes
   * Runs every 100 ticks to filter and archive mutation logs based on importance
   */
  async saveActiveStateToPostgres(
    worldId: string,
    state: any,
    mutationEvents: any[],
    narrativePruningWeights: Record<string, number>
  ): Promise<boolean> {
    if (!this.pool || !this.redisCache) return false;

    try {
      // Step 1: Save world state snapshot
      const saved = await this.saveWorldState(worldId, state);
      if (!saved) return false;

      // Step 2: Filter mutation events based on narrative importance scores
      const minImportance = narrativePruningWeights['minImportanceForCanonicalStatus'] || 7;
      const prunedEvents = mutationEvents.filter((event: any) => {
        const weight = narrativePruningWeights[event.event_type] || 0;
        return weight >= minImportance;
      });

      console.log(
        `[DatabaseAdapter] Pruning: ${mutationEvents.length} events → ${prunedEvents.length} (min importance: ${minImportance})`
      );

      // Step 3: Append only pruned events to mutation log
      for (const event of prunedEvents) {
        const eventWeight = narrativePruningWeights[event.event_type] || 0;
        const isCanonical = eventWeight >= minImportance;

        await this.appendMutationEvent(worldId, {
          ...event,
          importance_score: eventWeight,
          is_canonical: isCanonical,
        });
      }

      // Step 4: Refresh Redis cache TTL (implicit via flush write)

      console.log(
        `[DatabaseAdapter] Flush complete: ${worldId} at tick ${state.tick} (${prunedEvents.length} events persisted)`
      );
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] saveActiveStateToPostgres error:', error.message);
      return false;
    }
  }

  /**
   * Phase 36: Cold Boot Recovery from Ledger
   * 
   * Reconstructs the world state from Postgres snapshot + mutation ledger after a crash.
   * This is the "Source of Truth" recovery mechanism:
   * 1. Load the latest snapshot from Postgres world_state
   * 2. Fetch all mutation events since snapshot.tick
   * 3. Replay them through stateRebuilder to reach current tick
   * 4. Sync result back to Redis hot-cache
   * 
   * @param worldId World instance ID
   * @returns Complete reconstructed WorldState at current tick, or null if recovery fails
   */
  async recoverActiveStateFromLedger(worldId: string): Promise<any | null> {
    if (!this.pool || !this.redisCache) {
      console.error('[DatabaseAdapter] Recovery failed: missing pool or cache');
      return null;
    }

    try {
      console.log(`[DatabaseAdapter] Starting Cold Boot Recovery for world: ${worldId}`);

      // Step 1: Load latest snapshot from Postgres
      const snapshot = await this.loadWorldState(worldId);
      if (!snapshot) {
        console.error(`[DatabaseAdapter] Recovery failed: no snapshot found for ${worldId}`);
        return null;
      }

      const snapshotTick = snapshot.tick || 0;
      console.log(`[DatabaseAdapter] Loaded snapshot at tick: ${snapshotTick}`);

      // Step 2: Fetch all mutation events since snapshot
      const recoveryStartTime = Date.now();
      const mutationEvents = await this.getMutationLog(worldId, {
        from: snapshotTick + 1,
        canonical: false  // Get all events (both canonical and pruned) for complete replay
      });

      console.log(`[DatabaseAdapter] Fetched ${mutationEvents.length} ledger events for replay`);

      // Step 3: Replay events through stateRebuilder
      // This requires importing the state rebuilder - we'll create a reference
      let rebuiltState = JSON.parse(JSON.stringify(snapshot)); // Deep copy

      for (const event of mutationEvents) {
        // Simple state replay: apply payload mutations
        // In production, this would use the full stateRebuilder logic
        if (event.payload && typeof event.payload === 'object') {
          rebuiltState = { ...rebuiltState, ...event.payload, tick: event.tick };
        }
      }

      console.log(`[DatabaseAdapter] Replay complete: rebuilt state at tick ${rebuiltState.tick}`);

      // Step 4: Sync to Redis cache
      if (this.redisCache) {
        await this.redisCache.setActiveWorldState({
          worldId,
          tick: rebuiltState.tick,
          season: rebuiltState.season || 'spring',
          weather: rebuiltState.weather || 'clear',
          paradoxLevel: rebuiltState.paradoxLevel ?? 0,
          state: rebuiltState,
          timestamp: Date.now()
        });
        console.log(`[DatabaseAdapter] Cold Boot Recovery synced to Redis for ${worldId}`);
      }

      const recoveryTime = Date.now() - recoveryStartTime;
      console.log(`[DatabaseAdapter] Cold Boot Recovery complete in ${recoveryTime}ms`);

      return rebuiltState;
    } catch (error: any) {
      console.error('[DatabaseAdapter] Cold Boot Recovery error:', error.message);
      return null;
    }
  }

  /**
   * Phase 36: Check and recover from crash on startup
   * 
   * Call this on server initialization to detect if Redis is stale and trigger Cold Boot Recovery
   * @param worldId World instance ID
   * @returns true if recovery was needed and succeeded, false otherwise
   */
  async recoverFromCrashIfNeeded(worldId: string): Promise<boolean> {
    if (!this.pool || !this.redisCache) return false;

    try {
      // Check if Redis has active state
      const cachedState = await this.redisCache.getActiveWorldState(worldId);

      if (cachedState) {
        console.log(`[DatabaseAdapter] Redis cache valid, no crash recovery needed`);
        return false;
      }

      // Redis is empty or stale - trigger Cold Boot Recovery
      console.warn(`[DatabaseAdapter] Redis cache missing, initiating Cold Boot Recovery`);
      const recoveredState = await this.recoverActiveStateFromLedger(worldId);

      if (!recoveredState) {
        console.error(`[DatabaseAdapter] Cold Boot Recovery failed, world may be corrupted`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] Crash recovery check error:', error.message);
      return false;
    }
  }

  /**
   * Phase 27: Query global paradox average from top 5 corrupted worlds
   * Used to trigger "Cross-World Bleed" visual effects in primary world
   * Returns average paradox level across most corrupted instances
   */
  async getGlobalParadoxAverage(): Promise<{ average: number; topWorlds: any[] }> {
    if (!this.pool) return { average: 0, topWorlds: [] };

    try {
      // Query top 5 most corrupted worlds
      const query = `
        SELECT 
          id,
          tick,
          season,
          paradox_level,
          updated_at
        FROM world_state
        ORDER BY paradox_level DESC
        LIMIT 5
      `;

      const result = await this.pool.query(query);
      const topWorlds = result.rows;

      if (topWorlds.length === 0) {
        return { average: 0, topWorlds: [] };
      }

      // Calculate average paradox level
      const average =
        topWorlds.reduce((sum: number, world: any) => sum + (world.paradox_level || 0), 0) /
        topWorlds.length;

      console.log(
        `[DatabaseAdapter] Global paradox average: ${average.toFixed(2)} (from ${topWorlds.length} worlds)`
      );

      return { average, topWorlds };
    } catch (error: any) {
      console.error('[DatabaseAdapter] getGlobalParadoxAverage error:', error.message);
      return { average: 0, topWorlds: [] };
    }
  }

  async archiveEpoch(worldId: string, epochId: string): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const events = await this.getMutationLog(worldId);
      const canonicalCount = events.filter((e: any) => e.is_canonical).length;
      
      const query = `
        INSERT INTO mutation_log_archive (id, world_instance_id, epoch_id, event_count, canonical_count, archive_hash, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        `archive-${Date.now()}`,
        worldId,
        epochId,
        events.length,
        canonicalCount,
        this.hashState(events),
        JSON.stringify({ archivedAt: new Date(), eventTypes: Object.keys(events.reduce((acc: any, e: any) => ({ ...acc, [e.event_type]: true }), {})) })
      ];

      await this.pool.query(query, values);
      console.log(`[DatabaseAdapter] Epoch archived: ${epochId} (${events.length} events)`);
      return true;
    } catch (error: any) {
      console.error('[DatabaseAdapter] archiveEpoch error:', error.message);
      return false;
    }
  }

  async restoreEpoch(worldId: string, epochId: string): Promise<any | null> {
    if (!this.pool) return null;

    try {
      const query = `SELECT * FROM mutation_log_archive WHERE world_instance_id = $1 AND epoch_id = $2`;
      const result = await this.pool.query(query, [worldId, epochId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('[DatabaseAdapter] restoreEpoch error:', error.message);
      return null;
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  private hashState(state: any): string {
    return require('crypto').createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }
}

// Global adapter instance
let databaseAdapterInstance: DatabaseAdapter | null = null;

export function getDatabaseAdapter(): DatabaseAdapter | null {
  return databaseAdapterInstance;
}

export function setDatabaseAdapter(adapter: DatabaseAdapter): void {
  databaseAdapterInstance = adapter;
}
