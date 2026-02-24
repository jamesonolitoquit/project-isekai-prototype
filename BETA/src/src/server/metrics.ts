/**
 * metrics.ts - Prometheus metrics collection for M69+M70 systems
 * 
 * Tracks:
 * - Tick latency distribution
 * - Memory usage
 * - Exploit detection rates
 * - Event broadcast metrics
 * - Database query performance
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Tick Latency Histogram (in milliseconds)
 * Buckets: 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000+
 */
export const tickLatencyHistogram = new Histogram({
  name: 'tick_latency_ms',
  help: 'Latency of each game tick in milliseconds',
  buckets: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  labelNames: ['system'],
});

/**
 * Exploit Detection Counter
 */
export const exploitsDetectedCounter = new Counter({
  name: 'exploits_detected_total',
  help: 'Total number of exploits detected',
  labelNames: ['exploit_type', 'severity'],
});

/**
 * Churn Predictions Counter
 */
export const churnPredictionsCounter = new Counter({
  name: 'churn_predictions_total',
  help: 'Total number of churn predictions made',
  labelNames: ['risk_tier'],
});

/**
 * Campaign Triggers Counter
 */
export const campaignsTriggeredCounter = new Counter({
  name: 'campaigns_triggered_total',
  help: 'Total number of retention campaigns triggered',
  labelNames: ['campaign_type', 'engagement_tier'],
});

/**
 * Broadcast Events Counter
 */
export const broadcastEventsCounter = new Counter({
  name: 'broadcast_events_total',
  help: 'Total number of broadcast events emitted',
  labelNames: ['event_type'],
});

/**
 * Broadcast Event Latency Histogram
 */
export const broadcastLatencyHistogram = new Histogram({
  name: 'broadcast_latency_ms',
  help: 'Latency of broadcast event delivery in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ['event_type'],
});

/**
 * Active Players Gauge
 */
export const activePlayersGauge = new Gauge({
  name: 'active_players',
  help: 'Number of currently active players',
});

/**
 * Memory Usage Gauge
 */
export const memoryUsageGauge = new Gauge({
  name: 'memory_usage_mb',
  help: 'Memory usage in megabytes',
  labelNames: ['type'], // heap, external, rss
});

/**
 * Database Query Latency Histogram
 */
export const dbQueryLatencyHistogram = new Histogram({
  name: 'db_query_latency_ms',
  help: 'Latency of database queries in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ['query_type', 'table'],
});

/**
 * Database Errors Counter
 */
export const dbErrorsCounter = new Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['error_type'],
});

/**
 * API Request Counter
 */
export const apiRequestsCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status'],
});

/**
 * API Latency Histogram
 */
export const apiLatencyHistogram = new Histogram({
  name: 'api_latency_ms',
  help: 'Latency of API requests in milliseconds',
  buckets: [10, 50, 100, 500, 1000, 5000],
  labelNames: ['method', 'endpoint'],
});

/**
 * Socket.IO Connections Gauge
 */
export const socketConnectionsGauge = new Gauge({
  name: 'socket_io_connections',
  help: 'Number of active Socket.IO connections',
});

/**
 * Ledger Entries Gauge
 */
export const ledgerEntriesGauge = new Gauge({
  name: 'ledger_entries_total',
  help: 'Total number of ledger entries',
});

/**
 * Reports Pending Gauge
 */
export const reportsPendingGauge = new Gauge({
  name: 'reports_pending',
  help: 'Number of pending moderation reports',
});

/**
 * Update memory metrics
 */
export function updateMemoryMetrics(): void {
  const memUsage = process.memoryUsage();
  memoryUsageGauge.set({ type: 'heap' }, memUsage.heapUsed / 1024 / 1024);
  memoryUsageGauge.set({ type: 'external' }, memUsage.external / 1024 / 1024);
  memoryUsageGauge.set({ type: 'rss' }, memUsage.rss / 1024 / 1024);
}

/**
 * Record tick latency
 */
export function recordTickLatency(latencyMs: number, system: string = 'world'): void {
  tickLatencyHistogram.labels(system).observe(latencyMs);
}

/**
 * Record exploit detection
 */
export function recordExploitDetected(exploitType: string, severity: string): void {
  exploitsDetectedCounter.labels(exploitType, severity).inc();
}

/**
 * Record churn prediction
 */
export function recordChurnPrediction(riskTier: 'low' | 'medium' | 'high' | 'critical'): void {
  churnPredictionsCounter.labels(riskTier).inc();
}

/**
 * Record campaign trigger
 */
export function recordCampaignTriggered(campaignType: string, engagementTier: string): void {
  campaignsTriggeredCounter.labels(campaignType, engagementTier).inc();
}

/**
 * Record broadcast event
 */
export function recordBroadcastEvent(eventType: string, latencyMs: number): void {
  broadcastEventsCounter.labels(eventType).inc();
  broadcastLatencyHistogram.labels(eventType).observe(latencyMs);
}

/**
 * Record API request
 */
export function recordAPIRequest(method: string, endpoint: string, statusCode: number, latencyMs: number): void {
  apiRequestsCounter.labels(method, endpoint, statusCode.toString()).inc();
  apiLatencyHistogram.labels(method, endpoint).observe(latencyMs);
}

/**
 * Record database query
 */
export function recordDBQuery(queryType: string, tableName: string, latencyMs: number): void {
  dbQueryLatencyHistogram.labels(queryType, tableName).observe(latencyMs);
}

/**
 * Record database error
 */
export function recordDBError(errorType: string): void {
  dbErrorsCounter.labels(errorType).inc();
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetricsPrometheus(): Promise<string> {
  updateMemoryMetrics();
  return await register.metrics();
}

export default {
  tickLatencyHistogram,
  exploitsDetectedCounter,
  churnPredictionsCounter,
  campaignsTriggeredCounter,
  broadcastEventsCounter,
  broadcastLatencyHistogram,
  activePlayersGauge,
  memoryUsageGauge,
  dbQueryLatencyHistogram,
  dbErrorsCounter,
  apiRequestsCounter,
  apiLatencyHistogram,
  socketConnectionsGauge,
  ledgerEntriesGauge,
  reportsPendingGauge,
  updateMemoryMetrics,
  recordTickLatency,
  recordExploitDetected,
  recordChurnPrediction,
  recordCampaignTriggered,
  recordBroadcastEvent,
  recordAPIRequest,
  recordDBQuery,
  recordDBError,
  getMetricsPrometheus,
};
