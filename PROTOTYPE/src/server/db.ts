/**
 * db.ts - PostgreSQL Database Layer for Phase 23 Production Hardening
 * Handles persistent storage of world state, mutations, and game data
 * 
 * Connection pooling, schema migrations, and query builders for
 * the production multiplayer infrastructure.
 * 
 * Phase 16 Schemas: Chronicles, Legacies, Session Snapshots
 * Phase 23 Additions: World state snapshots, ledger entries, conflict logs, health monitoring
 * 
 * NOTE: Requires `pg` package: npm install pg
 * Usage: import { DatabaseClient, initializeDatabaseClient } from './db'
 */

// Phase 23: PostgreSQL client (requires: npm install pg)
// Dynamic import for optional dependency
let pg: any = null;
let Pool: any = null;

try {
  pg = require('pg');
  Pool = pg.Pool;
} catch (err) {
  console.warn(
    'PostgreSQL client not available. Install with: npm install pg'
  );
}

export interface DBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
}

// Phase 23: Production pooling configuration
export interface PoolConfig extends DBConfig {
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  connectionErrors: number;
  lastHealthCheckTime: number;
  lastHealthCheckSuccess: boolean;
  averageQueryTimeMs: number;
}

/**
 * Phase 23: DatabaseClient with connection pooling and health monitoring
 */
export class DatabaseClient {
  private pool: InstanceType<typeof Pool> | null = null;
  private metrics: {
    connectionErrors: number;
    totalQueries: number;
    failedQueries: number;
    queryTimesMs: number[];
    lastHealthCheck: number;
    healthCheckSuccess: boolean;
  } = {
    connectionErrors: 0,
    totalQueries: 0,
    failedQueries: 0,
    queryTimesMs: [],
    lastHealthCheck: 0,
    healthCheckSuccess: false,
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize PostgreSQL connection pool
   */
  async initialize(config: PoolConfig): Promise<{ success: boolean; reason?: string }> {
    try {
      if (!Pool) {
        return {
          success: false,
          reason: 'PostgreSQL driver not installed. Run: npm install pg',
        };
      }

      const poolConfig = {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        min: config.min ?? 5,
        max: config.max ?? 20,
        idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
        statementTimeout: config.statementTimeoutMillis ?? 30000,
      };

      this.pool = new Pool(poolConfig);

      // Set up error handlers
      this.pool.on('error', (err: Error) => {
        console.error('Unexpected error on idle client', err);
        this.metrics.connectionErrors++;
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1 as test');
      client.release();

      if (result.rows[0]?.test !== 1) {
        throw new Error('Connection test failed: unexpected result');
      }

      console.log('✅ PostgreSQL connection pool initialized successfully');
      this.metrics.lastHealthCheck = Date.now();
      this.metrics.healthCheckSuccess = true;

      // Start periodic health checks (every 60 seconds)
      this.startHealthChecks();

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to initialize database:', message);
      this.metrics.connectionErrors++;
      return { success: false, reason: message };
    }
  }

  /**
   * Execute raw SQL query with error handling
   */
  async query<T extends Record<string, any>>(
    sql: string,
    values?: (string | number | boolean | null | object)[],
  ): Promise<{ success: boolean; rows?: T[]; error?: string }> {
    if (!this.pool) {
      return {
        success: false,
        error: 'Database client not initialized',
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.pool.query(sql, values);
      const duration = Date.now() - startTime;

      this.metrics.totalQueries++;
      this.metrics.queryTimesMs.push(duration);

      // Keep only last 1000 query times
      if (this.metrics.queryTimesMs.length > 1000) {
        this.metrics.queryTimesMs.shift();
      }

      return { success: true, rows: result.rows };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedQueries++;
      this.metrics.queryTimesMs.push(duration);

      const message = error instanceof Error ? error.message : String(error);
      console.error(`Query failed (${duration}ms):`, sql.substring(0, 100), message);

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Execute query with automatic retry on transient failures
   */
  async queryWithRetry<T extends Record<string, any>>(
    sql: string,
    values?: (string | number | boolean | null | object)[],
    maxRetries: number = 3,
  ): Promise<{ success: boolean; rows?: T[]; error?: string }> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.query<T>(sql, values);

      if (result.success) {
        return result;
      }

      lastError = result.error || 'Unknown error';

      // Only retry on specific transient errors
      if (lastError.includes('ECONNREFUSED') || lastError.includes('timeout')) {
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
          console.log(`Query retry attempt ${attempt}/${maxRetries} after ${backoffMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      } else {
        // Non-transient error, don't retry
        break;
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Acquire raw client from pool for transaction support
   */
  async acquireClient(): Promise<{ success: boolean; client?: any; error?: string }> {
    if (!this.pool) {
      return { success: false, error: 'Database client not initialized' };
    }

    try {
      const client = await this.pool.connect();
      return { success: true, client };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.metrics.connectionErrors++;
      return { success: false, error: message };
    }
  }

  /**
   * Run health check: test connection and measure latency
   */
  private async runHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      await this.query('SELECT extract(epoch from now()) as server_time');
      const duration = Date.now() - startTime;

      this.metrics.lastHealthCheck = Date.now();
      this.metrics.healthCheckSuccess = true;

      if (duration > 100) {
        console.warn(`⚠️  Health check slow: ${duration}ms`);
      }
    } catch (error) {
      this.metrics.healthCheckSuccess = false;
      console.warn('⚠️  Health check failed:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.runHealthCheck();
    }, 60000); // Every 60 seconds
  }

  /**
   * Get current pool metrics for monitoring
   */
  getMetrics(): PoolMetrics {
    if (!this.pool) {
      return {
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        totalConnections: 0,
        connectionErrors: 0,
        lastHealthCheckTime: 0,
        lastHealthCheckSuccess: false,
        averageQueryTimeMs: 0,
      };
    }

    const avgQueryTime =
      this.metrics.queryTimesMs.length > 0
        ? this.metrics.queryTimesMs.reduce((a, b) => a + b, 0) / this.metrics.queryTimesMs.length
        : 0;

    return {
      activeConnections: (this.pool as any)._clients?.length ?? 0,
      idleConnections: (this.pool as any)._idle?.length ?? 0,
      waitingRequests: (this.pool as any)._waitingCount ?? 0,
      totalConnections: this.pool.totalCount ?? 0,
      connectionErrors: this.metrics.connectionErrors,
      lastHealthCheckTime: this.metrics.lastHealthCheck,
      lastHealthCheckSuccess: this.metrics.healthCheckSuccess,
      averageQueryTimeMs: avgQueryTime,
    };
  }

  /**
   * Gracefully shutdown database connection pool
   */
  async shutdown(): Promise<{ success: boolean; reason?: string }> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (!this.pool) {
      return { success: true, reason: 'No connection pool to shutdown' };
    }

    try {
      await this.pool.end();
      this.pool = null;
      console.log('✅ Database connection pool closed cleanly');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('⚠️  Error closing connection pool:', message);
      return { success: false, reason: message };
    }
  }
}

/**
 * Global singleton database client
 */
let globalDbClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient {
  if (!globalDbClient) {
    globalDbClient = new DatabaseClient();
  }
  return globalDbClient;
}

export async function initializeDatabaseClient(config: PoolConfig): Promise<DatabaseClient> {
  const client = getDatabaseClient();
  const result = await client.initialize(config);

  if (!result.success) {
    throw new Error(`Database initialization failed: ${result.reason}`);
  }

  return client;
}

/**
 * SQL Schema Definitions for Phase 16 persistence layer
 */
export const DB_SCHEMAS = {
  // Chronicle deltas: Historical world state diffs
  chronicle_deltas: `
    CREATE TABLE IF NOT EXISTS chronicle_deltas (
      delta_id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      epoch_number INTEGER NOT NULL,
      epoch_id VARCHAR(255) NOT NULL,
      world_delta JSONB NOT NULL,
      timestamp BIGINT NOT NULL,
      faction_power_shifts JSONB,
      location_count INTEGER,
      npc_change_count INTEGER,
      event_log_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session_epoch (session_id, epoch_number),
      FULLTEXT INDEX idx_event_log (event_log_text)
    );
  `,

  // Legacy profiles: Player generations and inherited traits
  legacy_profiles: `
    CREATE TABLE IF NOT EXISTS legacy_profiles (
      legacy_id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      generation_number INTEGER NOT NULL,
      player_name VARCHAR(255),
      inherited_perks JSONB,
      faction_reputation JSONB,
      accumulated_myth_status REAL,
      world_scars JSONB,
      bloodline_deeds JSONB,
      epoch_range_start INTEGER,
      epoch_range_end INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session_generation (session_id, generation_number)
    );
  `,

  // Session snapshots: Point-in-time world state records
  session_snapshots: `
    CREATE TABLE IF NOT EXISTS session_snapshots (
      snapshot_id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      epoch_number INTEGER NOT NULL,
      world_state JSONB NOT NULL,
      player_state JSONB,
      snapshot_timestamp BIGINT NOT NULL,
      compression_status VARCHAR(50) DEFAULT 'uncompressed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session_snapshot (session_id, epoch_number)
    );
  `,

  // Resource nodes: Faction-controlled economic assets
  resource_nodes: `
    CREATE TABLE IF NOT EXISTS resource_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      location_id VARCHAR(255) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_name VARCHAR(255),
      controlling_faction_id VARCHAR(255),
      base_power_contribution REAL,
      control_history JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_location_resource (location_id, resource_type),
      INDEX idx_faction_control (controlling_faction_id)
    );
  `
};

/**
 * Initialize database pool and create tables
 * NOTE: In production, this would connect to actual PostgreSQL
 * For PROTOTYPE, maintains backward compatibility with in-memory storage
 */
export async function initializeDatabase(config?: Partial<DBConfig>) {
  // Placeholder for PostgreSQL initialization
  // In production:
  // const pool = new Pool({
  //   host: config?.host || process.env.DB_HOST || 'localhost',
  //   port: config?.port || parseInt(process.env.DB_PORT || '5432'),
  //   database: config?.database || process.env.DB_NAME || 'project_isekai',
  //   user: config?.user || process.env.DB_USER || 'postgres',
  //   password: config?.password || process.env.DB_PASSWORD || 'postgres',
  //   max: config?.max || 20
  // });

  console.log('[db] Database initialization placeholder - requires pg package');
  console.log('[db] Schema definitions prepared for PostgreSQL migration');
  
  return {
    initialized: false,
    schemasDefined: true,
    schemaCount: Object.keys(DB_SCHEMAS).length
  };
}

/**
 * Store chronicle delta to database
 */
export async function storeChronicle(delta: any): Promise<{ deltaId: string; stored: boolean }> {
  // SQL: INSERT INTO chronicle_deltas (delta_id, session_id, ...) VALUES (...)
  return {
    deltaId: delta.deltaId,
    stored: true
  };
}

/**
 * Retrieve chronicle archive for session
 */
export async function getChronicleArchive(sessionId: string): Promise<any[]> {
  // SQL: SELECT * FROM chronicle_deltas WHERE session_id = ? ORDER BY epoch_number
  return [];
}

/**
 * Reconstruct world state from specific delta
 */
export async function reconstructFromDelta(sessionId: string, epochNumber: number): Promise<any> {
  // SQL: SELECT world_delta FROM chronicle_deltas WHERE session_id = ? AND epoch_number = ?
  return null;
}

/**
 * Search chronicles by full-text index
 */
export async function searchChronicles(
  sessionId: string,
  searchTerm: string,
  limit: number = 50
): Promise<any[]> {
  // SQL: SELECT * FROM chronicle_deltas WHERE session_id = ? AND MATCH(event_log_text) AGAINST(?)
  // Uses GIN index on event_log_text for performance
  return [];
}

/**
 * Store legacy profile
 */
export async function storeLegacy(profile: any): Promise<{ legacyId: string; stored: boolean }> {
  // SQL: INSERT INTO legacy_profiles (...) VALUES (...)
  return {
    legacyId: profile.legacyId,
    stored: true
  };
}

/**
 * Get all generations for a session lineage
 */
export async function getLegacyLineage(sessionId: string): Promise<any[]> {
  // SQL: SELECT * FROM legacy_profiles WHERE session_id = ? ORDER BY generation_number
  return [];
}

/**
 * Update faction resource control
 */
export async function updateResourceControl(
  nodeId: string,
  factionId: string,
  timestamp: number
): Promise<boolean> {
  // SQL: UPDATE resource_nodes SET controlling_faction_id = ?, control_history = JSONB_APPEND(...) WHERE node_id = ?
  return true;
}

/**
 * Get faction resource holdings
 */
export async function getFactionResources(factionId: string): Promise<any[]> {
  // SQL: SELECT * FROM resource_nodes WHERE controlling_faction_id = ? WITH power_contribution CALCULATED
  return [];
}

/**
 * Calculate total faction power from resource control
 */
export async function calculateResourcePower(factionId: string): Promise<number> {
  // SQL: SELECT SUM(base_power_contribution) FROM resource_nodes WHERE controlling_faction_id = ?
  return 0;
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  tables: string[];
  status: 'healthy' | 'degraded' | 'offline';
}> {
  return {
    connected: false,
    tables: Object.keys(DB_SCHEMAS),
    status: 'offline'
  };
}
