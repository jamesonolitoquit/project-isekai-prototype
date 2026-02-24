/**
 * Phase 23 Task 4: Production Configuration & Auto-Scaling Prep
 * Environment-based configuration management
 */

export interface ServerConfig {
  // Capacity limits
  maxConcurrentPlayers: number;
  maxWebSocketConnections: number;
  messageQueueMaxDepth: number;

  // Timing
  consensusTimeoutMs: number;
  snapshotIntervalTicks: number;
  tickRateHz: number;

  // Database
  databaseUrl: string;
  connectionPoolMin: number;
  connectionPoolMax: number;

  // Maintenance
  maintenanceWindow?: {
    enabled: boolean;
    dayOfWeek: number; // 0-6, 0 = Sunday
    hour: number;
    durationMinutes: number;
  };

  // Feature flags
  enableMetrics: boolean;
  enableDevMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  const config: ServerConfig = {
    // Capacity - tune based on your server resources
    maxConcurrentPlayers: parseInt(process.env.MAX_PLAYERS || '20', 10),
    maxWebSocketConnections: parseInt(process.env.MAX_WS_CONNECTIONS || '30', 10),
    messageQueueMaxDepth: parseInt(process.env.MAX_QUEUE_DEPTH || '1000', 10),

    // Timing
    consensusTimeoutMs: parseInt(process.env.CONSENSUS_TIMEOUT_MS || '3000', 10),
    snapshotIntervalTicks: parseInt(process.env.SNAPSHOT_INTERVAL || '100', 10),
    tickRateHz: parseInt(process.env.TICK_RATE || '20', 10),

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost/isekai',
    connectionPoolMin: parseInt(process.env.DB_POOL_MIN || '5', 10),
    connectionPoolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),

    // Maintenance window
    maintenanceWindow: process.env.MAINTENANCE_ENABLED === 'true'
      ? {
          enabled: true,
          dayOfWeek: parseInt(process.env.MAINTENANCE_DAY || '0', 10),
          hour: parseInt(process.env.MAINTENANCE_HOUR || '2', 10),
          durationMinutes: parseInt(process.env.MAINTENANCE_DURATION || '30', 10),
        }
      : undefined,

    // Feature flags
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableDevMode: process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true',
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Validate configuration values
 */
export function validateConfig(config: ServerConfig): void {
  const errors: string[] = [];

  if (config.maxConcurrentPlayers < 1 || config.maxConcurrentPlayers > 1000) {
    errors.push('maxConcurrentPlayers must be between 1 and 1000');
  }

  if (config.maxWebSocketConnections < config.maxConcurrentPlayers) {
    errors.push('maxWebSocketConnections must be >= maxConcurrentPlayers');
  }

  if (config.consensusTimeoutMs < 100 || config.consensusTimeoutMs > 10000) {
    errors.push('consensusTimeoutMs must be between 100 and 10000');
  }

  if (config.snapshotIntervalTicks < 10 || config.snapshotIntervalTicks > 1000) {
    errors.push('snapshotIntervalTicks must be between 10 and 1000');
  }

  if (config.tickRateHz < 1 || config.tickRateHz > 100) {
    errors.push('tickRateHz must be between 1 and 100');
  }

  if (config.connectionPoolMin < 1 || config.connectionPoolMin > config.connectionPoolMax) {
    errors.push('connectionPoolMin must be >= 1 and <= connectionPoolMax');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration for current environment
 */
export const serverConfig = loadConfig();

/**
 * Check if scheduled maintenance should occur now
 */
export function isMaintenanceWindow(): boolean {
  if (!serverConfig.maintenanceWindow?.enabled) {
    return false;
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  return dayOfWeek === serverConfig.maintenanceWindow.dayOfWeek && hour === serverConfig.maintenanceWindow.hour;
}

/**
 * Get time until next maintenance window (in milliseconds)
 */
export function getTimeUntilMaintenance(): number {
  if (!serverConfig.maintenanceWindow?.enabled) {
    return Infinity;
  }

  const now = new Date();
  const current = new Date(now);

  // Calculate next maintenance window
  let nextMaintenance = new Date(now);
  nextMaintenance.setDate(now.getDate() + (serverConfig.maintenanceWindow.dayOfWeek - now.getDay() + 7) % 7);
  nextMaintenance.setHours(serverConfig.maintenanceWindow.hour, 0, 0, 0);

  // If time has passed this week, schedule for next week
  if (nextMaintenance <= now) {
    nextMaintenance.setDate(nextMaintenance.getDate() + 7);
  }

  return Math.max(0, nextMaintenance.getTime() - now.getTime());
}

/**
 * Log current configuration (censoring secrets)
 */
export function logConfiguration(): void {
  console.log('📋 Server Configuration:');
  console.log(`  Max Players: ${serverConfig.maxConcurrentPlayers}`);
  console.log(`  Max WebSocket Connections: ${serverConfig.maxWebSocketConnections}`);
  console.log(`  Consensus Timeout: ${serverConfig.consensusTimeoutMs}ms`);
  console.log(`  Snapshot Interval: ${serverConfig.snapshotIntervalTicks} ticks`);
  console.log(`  Tick Rate: ${serverConfig.tickRateHz} Hz`);
  console.log(`  DB Pool: ${serverConfig.connectionPoolMin}-${serverConfig.connectionPoolMax} connections`);
  console.log(`  Metrics: ${serverConfig.enableMetrics ? 'enabled' : 'disabled'}`);
  console.log(`  Dev Mode: ${serverConfig.enableDevMode ? 'enabled' : 'disabled'}`);

  if (serverConfig.maintenanceWindow?.enabled) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    console.log(
      `  Maintenance: ${days[serverConfig.maintenanceWindow.dayOfWeek]} at ${serverConfig.maintenanceWindow.hour}:00 (${serverConfig.maintenanceWindow.durationMinutes} min)`
    );
  }
}
