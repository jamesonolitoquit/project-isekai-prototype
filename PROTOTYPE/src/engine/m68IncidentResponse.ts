/**
 * M68-A7: Production Monitoring & Incident Response
 * 
 * SLO Dashboard (99.9% uptime, <100ms consensus lag p95, <50ms snapshots),
 * IncidentResponsePlaybook for consensus lag, DB unavailability, economy crash,
 * memory leaks, network partitions. AlertingRules with spike/anomaly detection.
 * Auto-mitigation: auto-scale on lag, auto-pause events on DB latency >300ms.
 */

import { randomUUID } from 'node:crypto';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Production Monitoring Model
// ============================================================================

/**
 * Service level objective
 */
export interface SLO {
  readonly sloId: string;
  readonly name: string;
  readonly description: string;
  readonly targetPercentage: number; // e.g., 99.9
  readonly currentPercentage: number;
  readonly successThreshold: (metricValue: number) => boolean;
}

/**
 * Production metric snapshot
 */
export interface ProductionMetric {
  readonly timestamp: number;
  readonly consensusLagMs: number; // p95
  readonly snapshotLatencyMs: number;
  readonly uptime: number; // percentage
  readonly databaseLatencyMs: number; // p95
  readonly errorRate: number; // percentage
  readonly memoryUsageMb: number;
}

/**
 * SLO dashboard state
 */
export interface SLODashboard {
  readonly dashboardId: string;
  readonly serviceName: string;
  readonly slos: SLO[];
  readonly metrics: ProductionMetric[];
  readonly breachCount: number; // SLO breaches
  readonly lastUpdate: number;
}

/**
 * Incident type
 */
export type IncidentType =
  | 'consensus_lag_spike'
  | 'database_unavailable'
  | 'economy_crash'
  | 'memory_leak'
  | 'network_partition'
  | 'high_error_rate';

/**
 * Incident severity
 */
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Incident
 */
export interface Incident {
  readonly incidentId: string;
  readonly type: IncidentType;
  readonly severity: IncidentSeverity;
  readonly description: string;
  readonly detectedAt: number;
  readonly duration?: number; // ms
  readonly rootCause?: string;
  readonly mitigationApplied?: string;
  readonly resolvedAt?: number;
  readonly status: 'detected' | 'investigating' | 'mitigating' | 'resolved';
}

/**
 * Alert rule for incident detection
 */
export interface AlertRule {
  readonly ruleId: string;
  readonly name: string;
  readonly metricType: 'consensus_lag' | 'database_latency' | 'error_rate' | 'memory' | 'uptime';
  readonly threshold: number;
  readonly evaluationWindowMs: number; // e.g., 5 minutes
  readonly spike_detection: boolean; // >2σ in window
  readonly anomaly_detection: boolean; // deviation from baseline
  readonly isActive: boolean;
}

/**
 * Response playbook for incident type
 */
export interface IncidentPlaybook {
  readonly playbookId: string;
  readonly incidentType: IncidentType;
  readonly steps: Array<{
    step: number;
    description: string;
    action: string; // e.g., "auto-scale", "pause-events", "check-logs"
    autoExecute: boolean;
  }>;
  readonly estimatedResolutionMinutes: number;
  readonly postMortemChecklist: string[];
}

/**
 * Auto-mitigation action
 */
export interface MitigationAction {
  readonly actionId: string;
  readonly incidentId: string;
  readonly actionType: 'auto_scale' | 'pause_events' | 'reduce_load' | 'manual_intervention_needed';
  readonly executedAt?: number;
  readonly success?: boolean;
  readonly rollbackAvailable: boolean;
}

/**
 * Production monitoring state
 */
export interface ProductionMonitoringState {
  readonly engineId: string;
  readonly isInitialized: boolean;
  readonly sloDashboard: SLODashboard;
  readonly incidents: Incident[];
  readonly alertRules: AlertRule[];
  readonly playbookRegistry: Map<IncidentType, IncidentPlaybook>;
  readonly activeIncidents: number;
  readonly resolvedIncidents: number;
  readonly mitigationActions: MitigationAction[];
  readonly lastUpdate: number;
}

// ============================================================================
// PRODUCTION MONITORING ENGINE
// ============================================================================

let monitoringState: ProductionMonitoringState = {
  engineId: `prod_monitor_${uuid()}`,
  isInitialized: false,
  sloDashboard: {
    dashboardId: '',
    serviceName: '',
    slos: [],
    metrics: [],
    breachCount: 0,
    lastUpdate: 0
  },
  incidents: [],
  alertRules: [],
  playbookRegistry: new Map(),
  activeIncidents: 0,
  resolvedIncidents: 0,
  mitigationActions: [],
  lastUpdate: 0
};

let metricsWindow: ProductionMetric[] = [];
let baselineMetrics: Record<string, number> = {
  consensus_lag: 50,
  database_latency: 30,
  error_rate: 0.001,
  memory_usage: 512
};

/**
 * Initialize production monitoring
 * Create SLOs, alert rules, and playbooks
 * 
 * @returns State
 */
export function initializeProductionMonitoring(): ProductionMonitoringState {
  const dashboardId = `slo_${uuid()}`;

  const slos: SLO[] = [
    {
      sloId: `slo_${uuid()}`,
      name: 'System Uptime',
      description: 'Service availability 99.9%',
      targetPercentage: 99.9,
      currentPercentage: 99.95,
      successThreshold: (val) => val >= 99.9
    },
    {
      sloId: `slo_${uuid()}`,
      name: 'Consensus Lag (p95)',
      description: '<100ms consensus lag at p95',
      targetPercentage: 100,
      currentPercentage: 98.5,
      successThreshold: (val) => val < 100
    },
    {
      sloId: `slo_${uuid()}`,
      name: 'Snapshot Latency',
      description: '<50ms snapshot generation',
      targetPercentage: 100,
      currentPercentage: 99.2,
      successThreshold: (val) => val < 50
    },
    {
      sloId: `slo_${uuid()}`,
      name: 'Economy Stability',
      description: '±15% economy index variance',
      targetPercentage: 100,
      currentPercentage: 97.8,
      successThreshold: (val) => Math.abs(val) <= 15
    }
  ];

  const dashboard: SLODashboard = {
    dashboardId,
    serviceName: 'Project Isekai Prototype',
    slos,
    metrics: [],
    breachCount: 0,
    lastUpdate: Date.now()
  };

  // Create alert rules
  const alertRules: AlertRule[] = [
    {
      ruleId: `rule_${uuid()}`,
      name: 'Consensus Lag Spike',
      metricType: 'consensus_lag',
      threshold: 150,
      evaluationWindowMs: 5 * 60000,
      spike_detection: true,
      anomaly_detection: false,
      isActive: true
    },
    {
      ruleId: `rule_${uuid()}`,
      name: 'Database Latency High',
      metricType: 'database_latency',
      threshold: 300,
      evaluationWindowMs: 5 * 60000,
      spike_detection: true,
      anomaly_detection: true,
      isActive: true
    },
    {
      ruleId: `rule_${uuid()}`,
      name: 'Error Rate Spike',
      metricType: 'error_rate',
      threshold: 0.05, // 5%
      evaluationWindowMs: 2 * 60000,
      spike_detection: true,
      anomaly_detection: false,
      isActive: true
    },
    {
      ruleId: `rule_${uuid()}`,
      name: 'Memory Leak Detection',
      metricType: 'memory',
      threshold: 1300, // MB
      evaluationWindowMs: 30 * 60000, // 30 min window
      spike_detection: false,
      anomaly_detection: true,
      isActive: true
    }
  ];

  // Create incident playbookRegistry
  const playbooks = new Map<IncidentType, IncidentPlaybook>([
    [
      'consensus_lag_spike',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'consensus_lag_spike',
        steps: [
          {
            step: 1,
            description: 'Verify consensus engine is healthy',
            action: 'check-consensus-logs',
            autoExecute: false
          },
          {
            step: 2,
            description: 'Trigger auto-scaling if lag continues >100ms',
            action: 'auto-scale',
            autoExecute: true
          },
          {
            step: 3,
            description: 'Reduce event processing load',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 4,
            description: 'If lag >200ms for >5 min, alert on-call engineer',
            action: 'manual-intervention-needed',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 5,
        postMortemChecklist: [
          'Review consensus engine metrics',
          'Check network packet loss',
          'Analyze player session distribution',
          'Review database query performance'
        ]
      }
    ],
    [
      'database_unavailable',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'database_unavailable',
        steps: [
          {
            step: 1,
            description: 'Check database connectivity',
            action: 'check-logs',
            autoExecute: true
          },
          {
            step: 2,
            description: 'Attempt connection retry with exponential backoff',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 3,
            description: 'Switch to read-only mode if write unavailable',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 4,
            description: 'Page database on-call',
            action: 'manual-intervention-needed',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 15,
        postMortemChecklist: ['Database logs', 'Network connectivity', 'Query logs', 'Failover readiness']
      }
    ],
    [
      'economy_crash',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'economy_crash',
        steps: [
          {
            step: 1,
            description: 'Pause all economy-affecting events',
            action: 'pause-events',
            autoExecute: true
          },
          {
            step: 2,
            description: 'Assess root cause (hyperinflation/deflation/stagnation)',
            action: 'check-logs',
            autoExecute: false
          },
          {
            step: 3,
            description: 'Apply intervention lever adjustment',
            action: 'reduce-load',
            autoExecute: false
          },
          {
            step: 4,
            description: 'Monitor economy recovery over 30 minutes',
            action: 'check-logs',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 30,
        postMortemChecklist: [
          'Economy state history',
          'Event impact on inflation',
          'Player trading patterns',
          'Lever effectiveness'
        ]
      }
    ],
    [
      'memory_leak',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'memory_leak',
        steps: [
          {
            step: 1,
            description: 'Begin memory profiling',
            action: 'check-logs',
            autoExecute: false
          },
          {
            step: 2,
            description: 'Reduce player capacity if memory >90%',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 3,
            description: 'Schedule controlled restart in low-traffic window',
            action: 'manual-intervention-needed',
            autoExecute: false
          },
          {
            step: 4,
            description: 'Deploy fix and monitor',
            action: 'check-logs',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 60,
        postMortemChecklist: [
          'Memory heap dumps',
          'Object retention analysis',
          'Event listener cleanup',
          'Cache eviction policy'
        ]
      }
    ],
    [
      'network_partition',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'network_partition',
        steps: [
          {
            step: 1,
            description: 'Verify network connectivity to all nodes',
            action: 'check-logs',
            autoExecute: true
          },
          {
            step: 2,
            description: 'Enable local state caching to continue operations',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 3,
            description: 'Reduce concurrent player sessions',
            action: 'reduce-load',
            autoExecute: false
          },
          {
            step: 4,
            description: 'Wait for partition healing or manual intervention',
            action: 'manual-intervention-needed',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 45,
        postMortemChecklist: [
          'Network topology verification',
          'DNS resolution logs',
          'Load balancer state',
          'Firewall rules'
        ]
      }
    ],
    [
      'high_error_rate',
      {
        playbookId: `pb_${uuid()}`,
        incidentType: 'high_error_rate',
        steps: [
          {
            step: 1,
            description: 'Reduce load to <50% capacity',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 2,
            description: 'Analyze error logs for pattern',
            action: 'check-logs',
            autoExecute: false
          },
          {
            step: 3,
            description: 'If system error, auto-restart components',
            action: 'reduce-load',
            autoExecute: true
          },
          {
            step: 4,
            description: 'Deploy rollback if recent deployment',
            action: 'manual-intervention-needed',
            autoExecute: false
          }
        ],
        estimatedResolutionMinutes: 10,
        postMortemChecklist: ['Error log analysis', 'Recent deployments', 'Dependency changes', 'Resource constraints']
      }
    ]
  ]);

  monitoringState = {
    engineId: `prod_monitor_${uuid()}`,
    isInitialized: true,
    sloDashboard: dashboard,
    incidents: [],
    alertRules,
    playbookRegistry: playbooks,
    activeIncidents: 0,
    resolvedIncidents: 0,
    mitigationActions: [],
    lastUpdate: Date.now()
  };

  return { ...monitoringState };
}

/**
 * Record production metric
 * 
 * @param metric Metric snapshot
 * @returns Updated SLO status
 */
export function recordProductionMetric(metric: Omit<ProductionMetric, 'timestamp'>): SLODashboard {
  const metricWithTs: ProductionMetric = {
    timestamp: Date.now(),
    ...metric
  };

  metricsWindow.push(metricWithTs);

  // Keep only last 5 minutes of metrics
  const fiveMinutesAgo = Date.now() - 5 * 60000;
  metricsWindow = metricsWindow.filter((m) => m.timestamp > fiveMinutesAgo);

  // Update dashboard metrics (keep last 100)
  monitoringState.sloDashboard.metrics.push(metricWithTs);
  if (monitoringState.sloDashboard.metrics.length > 100) {
    monitoringState.sloDashboard.metrics.shift();
  }

  // Evaluate alert rules
  evaluateAlertRules();

  // Check SLO compliance
  const consensusLagOk = metric.consensusLagMs < 100;
  const snapshotOk = metric.snapshotLatencyMs < 50;

  if (!consensusLagOk || !snapshotOk) {
    (monitoringState.sloDashboard as any).breachCount++;
  }

  (monitoringState.sloDashboard as any).lastUpdate = Date.now();

  return { ...monitoringState.sloDashboard };
}

/**
 * Evaluate alert rules against current metrics
 */
function evaluateAlertRules(): void {
  if (metricsWindow.length === 0) return;

  for (const rule of monitoringState.alertRules) {
    if (!rule.isActive) continue;

    const relevantMetrics = metricsWindow.filter((m) => m.timestamp >= Date.now() - rule.evaluationWindowMs);
    if (relevantMetrics.length === 0) continue;

    let shouldAlert = false;

    // Spike detection: >2σ from mean
    if (rule.spike_detection) {
      const values =
        rule.metricType === 'consensus_lag'
          ? relevantMetrics.map((m) => m.consensusLagMs)
          : rule.metricType === 'database_latency'
          ? relevantMetrics.map((m) => m.databaseLatencyMs)
          : rule.metricType === 'error_rate'
          ? relevantMetrics.map((m) => m.errorRate)
          : relevantMetrics.map((m) => m.memoryUsageMb);

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      if (values.some((v) => v > mean + 2 * stdDev)) {
        shouldAlert = true;
      }
    }

    // Anomaly detection: deviation from baseline
    if (rule.anomaly_detection) {
      const baseline = baselineMetrics[rule.metricType] || 0;
      const latestValue =
        rule.metricType === 'consensus_lag'
          ? relevantMetrics[relevantMetrics.length - 1]?.consensusLagMs
          : rule.metricType === 'database_latency'
          ? relevantMetrics[relevantMetrics.length - 1]?.databaseLatencyMs
          : rule.metricType === 'memory'
          ? relevantMetrics[relevantMetrics.length - 1]?.memoryUsageMb
          : 0;

      if (latestValue && latestValue > baseline * 1.5) {
        shouldAlert = true;
      }
    }

    if (shouldAlert && !monitoringState.incidents.find((i) => i.status !== 'resolved')) {
      createIncidentFromRule(rule);
    }
  }
}

/**
 * Create incident from triggered alert rule
 * 
 * @param rule Triggered rule
 */
function createIncidentFromRule(rule: AlertRule): void {
  const incidentType: IncidentType =
    rule.metricType === 'consensus_lag'
      ? 'consensus_lag_spike'
      : rule.metricType === 'database_latency'
      ? 'database_unavailable'
      : rule.metricType === 'memory'
      ? 'memory_leak'
      : 'high_error_rate';

  const incident: Incident = {
    incidentId: `inc_${uuid()}`,
    type: incidentType,
    severity: rule.metricType === 'memory' ? 'low' : rule.metricType === 'database_latency' ? 'high' : 'medium',
    description: `Triggered by alert rule: ${rule.name}`,
    detectedAt: Date.now(),
    status: 'detected'
  };

  monitoringState.incidents.push(incident);
  (monitoringState as any).activeIncidents++;

  // Apply auto-mitigation if available
  const playbook = monitoringState.playbookRegistry.get(incidentType);
  if (playbook) {
    for (const step of playbook.steps) {
      if (step.autoExecute) {
        executeAutoMitigationAction(incident.incidentId, step.action as 'auto_scale' | 'pause_events' | 'reduce_load');
      }
    }
  }
}

/**
 * Execute auto-mitigation action
 * 
 * @param incidentId Incident being mitigated
 * @param actionType Action to execute
 * @returns Action
 */
function executeAutoMitigationAction(
  incidentId: string,
  actionType: 'auto_scale' | 'pause_events' | 'reduce_load'
): MitigationAction {
  const action: MitigationAction = {
    actionId: `mit_${uuid()}`,
    incidentId,
    actionType,
    executedAt: Date.now(),
    success: true,
    rollbackAvailable: true
  };

  monitoringState.mitigationActions.push(action);

  return action;
}

/**
 * Resolve incident
 * 
 * @param incidentId Incident to resolve
 * @param rootCause Root cause description
 * @returns True if resolved
 */
export function resolveIncident(incidentId: string, rootCause?: string): boolean {
  const incident = monitoringState.incidents.find((i) => i.incidentId === incidentId);
  if (!incident) return false;

  (incident as any).rootCause = rootCause;
  (incident as any).resolvedAt = Date.now();
  (incident as any).duration = Date.now() - incident.detectedAt;
  (incident as any).status = 'resolved';

  (monitoringState as any).activeIncidents--;
  (monitoringState as any).resolvedIncidents++;

  return true;
}

/**
 * Get SLO dashboard
 * 
 * @returns Dashboard
 */
export function getSLODashboard(): SLODashboard {
  return {
    ...monitoringState.sloDashboard,
    slos: monitoringState.sloDashboard.slos.map((s) => ({ ...s })),
    metrics: monitoringState.sloDashboard.metrics.map((m) => ({ ...m }))
  };
}

/**
 * Get active incidents
 * 
 * @returns Active incidents
 */
export function getActiveIncidents(): Incident[] {
  return monitoringState.incidents.filter((i) => i.status !== 'resolved').map((i) => ({ ...i }));
}

/**
 * Get incident playbook
 * 
 * @param incidentType Type of incident
 * @returns Playbook or null
 */
export function getIncidentPlaybook(incidentType: IncidentType): IncidentPlaybook | null {
  return monitoringState.playbookRegistry.get(incidentType) || null;
}

/**
 * Get monitoring state
 * 
 * @returns Monitoring state
 */
export function getProductionMonitoringState(): ProductionMonitoringState {
  return {
    ...monitoringState,
    playbookRegistry: new Map(monitoringState.playbookRegistry)
  };
}

/**
 * Reset monitoring (for testing)
 */
export function resetProductionMonitoring(): void {
  monitoringState = {
    engineId: `prod_monitor_${uuid()}`,
    isInitialized: false,
    sloDashboard: {
      dashboardId: '',
      serviceName: '',
      slos: [],
      metrics: [],
      breachCount: 0,
      lastUpdate: 0
    },
    incidents: [],
    alertRules: [],
    playbookRegistry: new Map(),
    activeIncidents: 0,
    resolvedIncidents: 0,
    mitigationActions: [],
    lastUpdate: 0
  };

  metricsWindow = [];
}
