/**
 * PostgreSQL Adapter (Phase 7 - Permanent Storage Layer)
 *
 * Implements permanent archival of hard facts and deep snapshots.
 * Uses write-behind pattern: accumulates events in database queue,
 * then flushes every N ticks (typically 100) to batch writes.
 *
 * Schema:
 * - mutation_log: Immutable hard facts (deaths, births, miracles)
 * - world_snapshots: Deep snapshots every 3600 ticks (1 hour)
 * - causal_chain: Blockchain-like entry linking (previous_hash)
 * - rewind_markers: Flagged entries when paradox triggers rollback
 *
 * Write Strategy: Batched INSERT statements (1000 rows per batch)
 * Read Strategy: Indexed queries by tick range, actor ID, entry type
 */

import type {
  LedgerEntry,
  WorldSnapshot,
  GlobalConstants,
  PartialStateMutation,
} from '../../types';

/**
 * Database connection interface (abstract for PostgreSQL/MySQL/SQLite)
 */
export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any>;
  queryOne(sql: string, params?: any[]): Promise<any>;
  batch(statements: Array<{ sql: string; params: any[] }>): Promise<void>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

/**
 * SQL schema definitions
 */
export const MIGRATION_001_CREATE_TABLES = `
-- mutation_log: Immutable hard facts from ResolutionStack Phase 6
CREATE TABLE IF NOT EXISTS mutation_log (
  id SERIAL PRIMARY KEY,
  ledger_id VARCHAR(255) UNIQUE NOT NULL,
  recorded_at_tick INTEGER NOT NULL,
  entry_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255),
  cause_id VARCHAR(255) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  previous_entry_hash VARCHAR(64),
  description TEXT,
  importance INTEGER DEFAULT 5,
  is_verified BOOLEAN DEFAULT false,
  is_invalidated BOOLEAN DEFAULT false,
  invalidated_reason VARCHAR(255),
  world_instance_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recorded_at_tick (recorded_at_tick),
  INDEX idx_actor_id (actor_id),
  INDEX idx_entry_type (entry_type),
  INDEX idx_cause_id (cause_id),
  INDEX idx_world_instance_id (world_instance_id)
);

-- world_snapshots: Deep snapshots every 3600 ticks
CREATE TABLE IF NOT EXISTS world_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_id VARCHAR(255) UNIQUE NOT NULL,
  snapshot_tick INTEGER NOT NULL,
  epoch_number INTEGER NOT NULL,
  world_instance_id VARCHAR(255) NOT NULL,
  state_hash VARCHAR(64) NOT NULL,
  previous_snapshot_id VARCHAR(255),
  vessel_count INTEGER,
  faction_count INTEGER,
  territory_count INTEGER,
  world_stability FLOAT,
  aggregate_paradox_debt FLOAT,
  serialized_state LONGTEXT,
  is_finalized BOOLEAN DEFAULT false,
  is_compressed BOOLEAN DEFAULT false,
  size_bytes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_snapshot_tick (snapshot_tick),
  INDEX idx_epoch_number (epoch_number),
  INDEX idx_world_instance_id (world_instance_id),
  INDEX idx_state_hash (state_hash)
);

-- rewind_markers: Track when paradox-triggered rewinds invalidate ledger entries
CREATE TABLE IF NOT EXISTS rewind_markers (
  id SERIAL PRIMARY KEY,
  rewind_id VARCHAR(255) UNIQUE NOT NULL,
  initiated_at_tick INTEGER NOT NULL,
  rewind_to_tick INTEGER NOT NULL,
  world_instance_id VARCHAR(255) NOT NULL,
  reason VARCHAR(255),
  paradox_debt_accumulated FLOAT,
  entries_invalidated INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_initiated_at_tick (initiated_at_tick),
  INDEX idx_world_instance_id (world_instance_id)
);

-- causal_locks: 72-hour rebind prevention registry
CREATE TABLE IF NOT EXISTS causal_locks (
  id SERIAL PRIMARY KEY,
  soul_id VARCHAR(255) NOT NULL,
  locked_at_tick INTEGER NOT NULL,
  lock_expires_tick INTEGER NOT NULL,
  world_instance_id VARCHAR(255) NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_soul_id (soul_id),
  INDEX idx_lock_expires_tick (lock_expires_tick),
  INDEX idx_world_instance_id (world_instance_id)
);
`;

/**
 * Flushable event: High-importance mutation ready for database persistence
 */
export interface FlushableEvent {
  type: 'vessel-death' | 'vessel-birth' | 'miracle' | 'paradox-event' | 'epoch-transition' | 'snapshot';
  importance: number; // 1-10: higher = persist sooner
  eventId: string;
  tick: number;
  worldInstanceId: string;
  data: any;
  ledgerId?: string;
  causeId?: string;
}

/**
 * PostgreSQL Adapter: Permanent storage for critical events
 *
 * Responsibilities:
 * 1. Batch-write hard facts to mutation_log (every 100 ticks)
 * 2. Archive deep snapshots to world_snapshots
 * 3. Track rewind markers when paradox triggers rollback
 * 4. Maintain causal chain (previousHash) for tamper detection
 * 5. Enable historical queries (all deaths in Epoch 5, etc.)
 */
export class PostgresAdapter {
  private db: DatabaseConnection | null = null;
  private pendingFlush: FlushableEvent[] = [];
  private lastFlushTick: number = 0;
  private flushInterval: number = 100; // Flush every N ticks
  private batchSize: number = 1000; // Max rows per INSERT batch

  constructor(db?: DatabaseConnection) {
    this.db = db || null;
  }

  /**
   * Initialize database (create tables if needed)
   */
  async initialize(db: DatabaseConnection): Promise<void> {
    this.db = db;

    try {
      // Run migrations
      const statements = MIGRATION_001_CREATE_TABLES.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.db.query(statement);
        }
      }

      console.log('[PostgresAdapter] Database initialized');
    } catch (error) {
      console.error('[PostgresAdapter] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Queue an event for database persistence
   * Events accumulate and flush every flushInterval ticks
   */
  queueEvent(event: FlushableEvent): void {
    this.pendingFlush.push(event);

    // Immediate flush for critical importance events
    if (event.importance >= 9) {
      this.flushImmediate([event]).catch(err =>
        console.warn('[PostgresAdapter] Immediate flush failed:', err)
      );
    }
  }

  /**
   * Check if flush is needed (every flushInterval ticks)
   */
  shouldFlush(currentTick: number): boolean {
    return (
      this.pendingFlush.length > 0 &&
      (currentTick - this.lastFlushTick >= this.flushInterval ||
       this.pendingFlush.length >= this.batchSize)
    );
  }

  /**
   * Flush accumulated events to PostgreSQL
   * Called by EngineOrchestrator or DatabaseQueue
   */
  async flush(currentTick: number): Promise<number> {
    if (!this.db || this.pendingFlush.length === 0) {
      return 0;
    }

    let toFlush: FlushableEvent[] = [];
    try {
      toFlush = [...this.pendingFlush];
      this.pendingFlush = [];

      let flushed = 0;

      // Batch by event type
      const byType = this.groupBy(toFlush, e => e.type);

      for (const [type, events] of Object.entries(byType)) {
        if (type === 'snapshot') {
          flushed += await this.flushSnapshots(events);
        } else if (type === 'paradox-event') {
          flushed += await this.flushRewindEvents(events);
        } else {
          flushed += await this.flushLedgerEntries(events);
        }
      }

      this.lastFlushTick = currentTick;
      console.log(`[PostgresAdapter] Flushed ${flushed} events to database at tick ${currentTick}`);

      return flushed;
    } catch (error) {
      console.error('[PostgresAdapter] Flush failed:', error);
      // Re-queue failed events
      this.pendingFlush.push(...toFlush);
      return 0;
    }
  }

  /**
   * Flush hard fact ledger entries
   */
  private async flushLedgerEntries(events: FlushableEvent[]): Promise<number> {
    if (!this.db || events.length === 0) {
      return 0;
    }

    const statements: Array<{ sql: string; params: any[] }> = [];

    for (const event of events) {
      const sql = `
        INSERT INTO mutation_log (
          ledger_id, recorded_at_tick, entry_type, actor_id, cause_id,
          content_hash, previous_entry_hash, description, importance,
          world_instance_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE recorded_at_tick = VALUES(recorded_at_tick)
      `;

      const params = [
        event.ledgerId || `ledger_${Date.now()}_${Math.random()}`,
        event.tick,
        event.type,
        event.data.actorId,
        event.causeId || `cause_${event.tick}`,
        event.data.contentHash || '',
        event.data.previousHash,
        event.data.description || '',
        event.importance,
        event.worldInstanceId,
      ];

      statements.push({ sql, params });
    }

    // Batch insert
    if (statements.length > 0) {
      await this.db.batch(statements);
      return events.length;
    }

    return 0;
  }

  /**
   * Flush rewind markers (paradox-event entries)
   */
  private async flushRewindEvents(events: FlushableEvent[]): Promise<number> {
    if (!this.db || events.length === 0) {
      return 0;
    }

    const statements: Array<{ sql: string; params: any[] }> = [];

    for (const event of events) {
      const sql = `
        INSERT INTO rewind_markers (
          rewind_id, initiated_at_tick, rewind_to_tick, world_instance_id,
          reason, paradox_debt_accumulated
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const params = [
        `rewind_${Date.now()}_${Math.random()}`,
        event.tick,
        event.data.rewindToTick,
        event.worldInstanceId,
        event.data.reason || 'paradox_debt_threshold',
        event.data.paradoxDebt || 0,
      ];

      statements.push({ sql, params });

      // Mark affected ledger entries as invalidated
      const invalidateSql = `
        UPDATE mutation_log
        SET is_invalidated = true, invalidated_reason = 'paradox_rewind'
        WHERE recorded_at_tick > ? AND recorded_at_tick <= ? AND world_instance_id = ?
      `;

      statements.push({
        sql: invalidateSql,
        params: [event.data.rewindToTick, event.tick, event.worldInstanceId],
      });
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
      return events.length;
    }

    return 0;
  }

  /**
   * Flush deep snapshots
   */
  private async flushSnapshots(events: FlushableEvent[]): Promise<number> {
    if (!this.db || events.length === 0) {
      return 0;
    }

    const statements: Array<{ sql: string; params: any[] }> = [];

    for (const event of events) {
      const sql = `
        INSERT INTO world_snapshots (
          snapshot_id, snapshot_tick, epoch_number, world_instance_id,
          state_hash, previous_snapshot_id, vessel_count, faction_count,
          territory_count, world_stability, aggregate_paradox_debt,
          serialized_state, is_finalized
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        event.eventId,
        event.tick,
        event.data.epochNumber || 1,
        event.worldInstanceId,
        event.data.stateHash,
        event.data.previousSnapshotId,
        event.data.vesselCount || 0,
        event.data.factionCount || 0,
        event.data.territoryCount || 0,
        event.data.worldStability || 0.5,
        event.data.paradoxDebt || 0,
        event.data.compressedState ? null : JSON.stringify(event.data.state),
        true, // is_finalized
      ];

      statements.push({ sql, params });
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
      return events.length;
    }

    return 0;
  }

  /**
   * Query ledger entries by tick range
   */
  async queryLedgerByTickRange(
    worldInstanceId: string,
    startTick: number,
    endTick: number
  ): Promise<LedgerEntry[]> {
    if (!this.db) {
      return [];
    }

    try {
      const sql = `
        SELECT * FROM mutation_log
        WHERE world_instance_id = ? AND recorded_at_tick BETWEEN ? AND ?
        AND is_invalidated = false
        ORDER BY recorded_at_tick ASC
      `;

      const result = await this.db.query(sql, [worldInstanceId, startTick, endTick]);
      return result || [];
    } catch (error) {
      console.warn('[PostgresAdapter] Query failed:', error);
      return [];
    }
  }

  /**
   * Query ledger entries by actor ID
   */
  async queryLedgerByActor(
    worldInstanceId: string,
    actorId: string
  ): Promise<LedgerEntry[]> {
    if (!this.db) {
      return [];
    }

    try {
      const sql = `
        SELECT * FROM mutation_log
        WHERE world_instance_id = ? AND actor_id = ? AND is_invalidated = false
        ORDER BY recorded_at_tick DESC
        LIMIT 100
      `;

      const result = await this.db.query(sql, [worldInstanceId, actorId]);
      return result || [];
    } catch (error) {
      console.warn('[PostgresAdapter] Query failed:', error);
      return [];
    }
  }

  /**
   * Query snapshots in epoch
   */
  async querySnapshotsByEpoch(
    worldInstanceId: string,
    epochNumber: number
  ): Promise<WorldSnapshot[]> {
    if (!this.db) {
      return [];
    }

    try {
      const sql = `
        SELECT * FROM world_snapshots
        WHERE world_instance_id = ? AND epoch_number = ?
        ORDER BY snapshot_tick ASC
      `;

      const result = await this.db.query(sql, [worldInstanceId, epochNumber]);
      return result || [];
    } catch (error) {
      console.warn('[PostgresAdapter] Query failed:', error);
      return [];
    }
  }

  /**
   * Get most recent snapshot before tick
   */
  async getSnapshotBefore(
    worldInstanceId: string,
    beforeTick: number
  ): Promise<WorldSnapshot | null> {
    if (!this.db) {
      return null;
    }

    try {
      const sql = `
        SELECT * FROM world_snapshots
        WHERE world_instance_id = ? AND snapshot_tick < ?
        ORDER BY snapshot_tick DESC
        LIMIT 1
      `;

      const result = await this.db.queryOne(sql, [worldInstanceId, beforeTick]);
      return result || null;
    } catch (error) {
      console.warn('[PostgresAdapter] Query failed:', error);
      return null;
    }
  }

  /**
   * Flush immediately (don't wait for interval)
   */
  private async flushImmediate(events: FlushableEvent[]): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.beginTransaction();

      for (const event of events) {
        if (event.type === 'snapshot') {
          await this.flushSnapshots([event]);
        } else if (event.type === 'paradox-event') {
          await this.flushRewindEvents([event]);
        } else {
          await this.flushLedgerEntries([event]);
        }
      }

      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      console.error('[PostgresAdapter] Immediate flush failed:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      await this.db.queryOne('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Get pending flush count
   */
  getPendingFlushCount(): number {
    return this.pendingFlush.length;
  }

  /**
   * Get last flush tick
   */
  getLastFlushTick(): number {
    return this.lastFlushTick;
  }

  /**
   * Utility: Group by key function
   */
  private groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const k = key(item);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}
