/**
 * Phase 23 Task 3: Monitoring & Observability
 * Real-time metrics collection for multiplayer performance
 */

export interface MetricsSnapshot {
  timestamp: number;
  activeConnections: number;
  messageQueueDepth: number;
  consensusLagMs: number;
  tradeCompletionRate: number;
  dbLatencyMs: number;
  memoryUsageMb: number;
  tickProcessTimeMs: number;
}

export interface PerPlayerMetrics {
  clientId: string;
  inboundMessagesPerSec: number;
  outboundMessagesPerSec: number;
  stateSize: number;
  averageLatencyMs: number;
}

export interface MetricsSnapshot_Aggregated {
  current: MetricsSnapshot;
  history: MetricsSnapshot[]; // Last 60 seconds
  peakActiveConnections: number;
  averageConsensusLagMs: number;
  totalMessages: number;
}

/**
 * Collects and manages real-time metrics from multiplayer engine
 */
export class MetricsCollector {
  private snapshots: MetricsSnapshot[] = [];
  private perPlayerMetrics: Map<string, PerPlayerMetrics> = new Map();
  private maxHistorySnapshots = 300; // 5 minutes at 1 Hz

  private currentMetrics: MetricsSnapshot = {
    timestamp: Date.now(),
    activeConnections: 0,
    messageQueueDepth: 0,
    consensusLagMs: 0,
    tradeCompletionRate: 0,
    dbLatencyMs: 0,
    memoryUsageMb: 0,
    tickProcessTimeMs: 0,
  };

  /**
   * Record metrics snapshot (called every second)
   */
  recordSnapshot(metrics: Partial<MetricsSnapshot>): void {
    const snapshot: MetricsSnapshot = {
      ...this.currentMetrics,
      ...metrics,
      timestamp: Date.now(),
    };

    this.snapshots.push(snapshot);
    this.currentMetrics = snapshot;

    // Keep only last 300 snapshots (5 minutes)
    if (this.snapshots.length > this.maxHistorySnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Update per-player metrics
   */
  updatePlayerMetrics(clientId: string, metrics: Partial<PerPlayerMetrics>): void {
    const existing = this.perPlayerMetrics.get(clientId) || {
      clientId,
      inboundMessagesPerSec: 0,
      outboundMessagesPerSec: 0,
      stateSize: 0,
      averageLatencyMs: 0,
    };

    this.perPlayerMetrics.set(clientId, {
      ...existing,
      ...metrics,
    });
  }

  /**
   * Remove player metrics
   */
  removePlayerMetrics(clientId: string): void {
    this.perPlayerMetrics.delete(clientId);
  }

  /**
   * Get current metrics snapshot
   */
  getCurrentMetrics(): MetricsSnapshot {
    return { ...this.currentMetrics };
  }

  /**
   * Get all snapshots (aggregated metrics)
   */
  getAllMetrics(): MetricsSnapshot_Aggregated {
    const peakConnections = Math.max(...this.snapshots.map((s) => s.activeConnections), 0);
    const avgLag =
      this.snapshots.length > 0
        ? this.snapshots.reduce((sum, s) => sum + s.consensusLagMs, 0) / this.snapshots.length
        : 0;
    const totalMessages = this.snapshots.reduce((sum, s) => sum + s.messageQueueDepth, 0);

    return {
      current: this.currentMetrics,
      history: [...this.snapshots],
      peakActiveConnections: peakConnections,
      averageConsensusLagMs: avgLag,
      totalMessages,
    };
  }

  /**
   * Get metrics for last N seconds
   */
  getMetricsForWindow(windowSeconds: number): MetricsSnapshot[] {
    const cutoff = Date.now() - windowSeconds * 1000;
    return this.snapshots.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Get P50, P95, P99 latency percentiles
   */
  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    if (this.snapshots.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.snapshots]
      .map((s) => s.dbLatencyMs)
      .sort((a, b) => a - b);

    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] ?? 0,
      p95: sorted[p95Index] ?? 0,
      p99: sorted[p99Index] ?? 0,
    };
  }

  /**
   * Get memory usage estimate (rough)
   */
  getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / (1024 * 1024) * 100) / 100;
    }
    return 0;
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.snapshots = [];
    this.perPlayerMetrics.clear();
    this.currentMetrics = {
      timestamp: Date.now(),
      activeConnections: 0,
      messageQueueDepth: 0,
      consensusLagMs: 0,
      tradeCompletionRate: 0,
      dbLatencyMs: 0,
      memoryUsageMb: 0,
      tickProcessTimeMs: 0,
    };
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.perPlayerMetrics.size;
  }

  /**
   * Get all player metrics
   */
  getAllPlayerMetrics(): PerPlayerMetrics[] {
    return Array.from(this.perPlayerMetrics.values());
  }
}

/**
 * Global singleton metrics collector
 */
let globalMetricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}
