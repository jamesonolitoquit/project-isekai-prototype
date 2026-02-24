/**
 * M68-A3: Economy Monitoring & Balance Dashboard
 * 
 * Real-time economy StateMonitor with manual intervention levers, preview mode,
 * and 5-minute rollback capability. Tracks economy index, inflation/deflation,
 * stagnation, and hyperinflation warnings.
 */

import { randomUUID } from 'node:crypto';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Economy Monitoring Model
// ============================================================================

/**
 * Economy state at a point in time
 */
export interface EconomyStateSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly economyIndex: number; // 0-100, 50 = baseline
  readonly inflation: number; // Rate of price increase
  readonly deflation: number; // Rate of price decrease
  readonly stagnation: boolean; // Trading volume critically low
  readonly hyperinflation: boolean; // Out of control price spiral
  readonly npcStartingGold: number;
  readonly tradeTaxRate: number; // 0-1.0
  readonly caravanSpawnWeight: number; // 0-10
}

/**
 * Manual intervention lever
 */
export interface InterventionLever {
  readonly leverId: string;
  readonly name: string;
  readonly description: string;
  readonly parameterName: string;
  readonly minValue: number;
  readonly maxValue: number;
  readonly currentValue: number;
  readonly defaultValue: number;
  readonly adjustmentUnit: string;
}

/**
 * Preview of intervention impact
 */
export interface InterventionPreview {
  readonly previewId: string;
  readonly interventionName: string;
  readonly levers: Array<{ leverName: string; proposedValue: number }>;
  readonly predictedEconomyIndex: number;
  readonly estimatedDuration: number; // Ticks to stabilize
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly rollbackEligible: boolean;
}

/**
 * Adjustment audit log entry
 */
export interface AdjustmentAuditEntry {
  readonly auditId: string;
  readonly timestamp: number;
  readonly action: string;
  readonly leversChanged: Array<{ lever: string; oldValue: number; newValue: number }>;
  readonly reason: string;
  readonly changedBy: string; // Admin identifier
}

/**
 * Dashboard state
 */
export interface DashboardState {
  readonly dashboardId: string;
  readonly isInitialized: boolean;
  readonly currentEconomyState: EconomyStateSnapshot;
  readonly interventionLevers: Map<string, InterventionLever>;
  readonly snapshotHistory: EconomyStateSnapshot[];
  readonly auditLog: AdjustmentAuditEntry[];
  readonly rollbackWindow: number; // Milliseconds (300000 = 5 minutes)
}

// ============================================================================
// ECONOMY MONITORING ENGINE
// ============================================================================

let dashboardState: DashboardState = {
  dashboardId: `dashboard_${uuid()}`,
  isInitialized: false,
  currentEconomyState: {
    snapshotId: '',
    timestamp: 0,
    economyIndex: 50,
    inflation: 0,
    deflation: 0,
    stagnation: false,
    hyperinflation: false,
    npcStartingGold: 1000,
    tradeTaxRate: 0.05,
    caravanSpawnWeight: 5
  },
  interventionLevers: new Map(),
  snapshotHistory: [],
  auditLog: [],
  rollbackWindow: 300000 // 5 minutes
};

/**
 * Initialize economy monitoring dashboard
 * 
 * @returns Dashboard state
 */
export function initializeEconomyDashboard(): DashboardState {
  // Create intervention levers
  createInterventionLever({
    name: 'NPC Starting Gold',
    description: 'Amount of gold NPCs carry when spawned',
    parameterName: 'npc_starting_gold',
    minValue: 100,
    maxValue: 10000,
    currentValue: 1000,
    defaultValue: 1000,
    adjustmentUnit: 'gold'
  });

  createInterventionLever({
    name: 'Trade Tax Rate',
    description: 'Percentage tax on all player trades (0-100%)',
    parameterName: 'trade_tax_rate',
    minValue: 0,
    maxValue: 1.0,
    currentValue: 0.05,
    defaultValue: 0.05,
    adjustmentUnit: 'ratio'
  });

  createInterventionLever({
    name: 'Caravan Spawn Weight',
    description: 'How often NPCs spawn (0-10, higher = more frequent)',
    parameterName: 'caravan_spawn_weight',
    minValue: 0,
    maxValue: 10,
    currentValue: 5,
    defaultValue: 5,
    adjustmentUnit: 'weight'
  });

  createInterventionLever({
    name: 'Inflation Dampening',
    description: 'Price growth ceiling (1.0 = normal, 0.5 = half growth)',
    parameterName: 'inflation_dampening',
    minValue: 0.1,
    maxValue: 2.0,
    currentValue: 1.0,
    defaultValue: 1.0,
    adjustmentUnit: 'multiplier'
  });

  createInterventionLever({
    name: 'Deflation Booster',
    description: 'Item demand multiplier when deflation detected',
    parameterName: 'deflation_booster',
    minValue: 1.0,
    maxValue: 3.0,
    currentValue: 1.5,
    defaultValue: 1.5,
    adjustmentUnit: 'multiplier'
  });

  // Take initial snapshot
  const initialSnapshot: EconomyStateSnapshot = {
    snapshotId: `snapshot_${uuid()}`,
    timestamp: Date.now(),
    economyIndex: 50,
    inflation: 0,
    deflation: 0,
    stagnation: false,
    hyperinflation: false,
    npcStartingGold: 1000,
    tradeTaxRate: 0.05,
    caravanSpawnWeight: 5
  };

  dashboardState = {
    dashboardId: `dashboard_${uuid()}`,
    isInitialized: true,
    currentEconomyState: initialSnapshot,
    interventionLevers: dashboardState.interventionLevers,
    snapshotHistory: [initialSnapshot],
    auditLog: [],
    rollbackWindow: 300000
  };

  return { ...dashboardState };
}

/**
 * Create intervention lever
 * 
 * @param config Lever config
 */
function createInterventionLever(config: Omit<InterventionLever, 'leverId'>): void {
  const lever: InterventionLever = {
    leverId: `lever_${uuid()}`,
    ...config
  };

  dashboardState.interventionLevers.set(lever.parameterName, lever);
}

/**
 * Update current economy state
 * Called periodically by economy engine
 * 
 * @param economyIndex Current index
 * @param inflation Current inflation rate
 * @param deflation Current deflation rate
 * @param stagnation Is trading stagnant?
 * @returns Updated snapshot
 */
export function updateEconomyState(
  economyIndex: number,
  inflation: number,
  deflation: number,
  stagnation: boolean
): EconomyStateSnapshot {
  const hyperinflation = economyIndex > 85;

  const snapshot: EconomyStateSnapshot = {
    snapshotId: `snapshot_${uuid()}`,
    timestamp: Date.now(),
    economyIndex,
    inflation,
    deflation,
    stagnation,
    hyperinflation,
    npcStartingGold: dashboardState.currentEconomyState.npcStartingGold,
    tradeTaxRate: dashboardState.currentEconomyState.tradeTaxRate,
    caravanSpawnWeight: dashboardState.currentEconomyState.caravanSpawnWeight
  };

  (dashboardState as any).currentEconomyState = snapshot;

  // Keep history (last 100 snapshots = ~1 hour at 1 snapshot/36 seconds)
  dashboardState.snapshotHistory.push(snapshot);
  if (dashboardState.snapshotHistory.length > 100) {
    dashboardState.snapshotHistory.shift();
  }

  return snapshot;
}

/**
 * Adjust intervention lever
 * 
 * @param parameterName Lever to adjust
 * @param newValue New value
 * @param reason Why adjustment was made
 * @param changedBy Who made the change
 * @returns Updated lever
 */
export function adjustInterventionLever(
  parameterName: string,
  newValue: number,
  reason: string,
  changedBy: string
): InterventionLever | null {
  const lever = dashboardState.interventionLevers.get(parameterName);
  if (!lever) return null;

  // Validate range
  if (newValue < lever.minValue || newValue > lever.maxValue) {
    return null;
  }

  const oldValue = lever.currentValue;

  // Update lever
  (lever as any).currentValue = newValue;

  // Update economy state
  if (parameterName === 'npc_starting_gold') {
    (dashboardState.currentEconomyState as any).npcStartingGold = newValue;
  } else if (parameterName === 'trade_tax_rate') {
    (dashboardState.currentEconomyState as any).tradeTaxRate = newValue;
  } else if (parameterName === 'caravan_spawn_weight') {
    (dashboardState.currentEconomyState as any).caravanSpawnWeight = newValue;
  }

  // Log adjustment
  const auditEntry: AdjustmentAuditEntry = {
    auditId: `audit_${uuid()}`,
    timestamp: Date.now(),
    action: `Adjusted ${parameterName}`,
    leversChanged: [{ lever: parameterName, oldValue, newValue }],
    reason,
    changedBy
  };

  dashboardState.auditLog.push(auditEntry);

  return { ...lever };
}

/**
 * Preview intervention impact
 * Simulates intervention without applying it
 * 
 * @param interventionName Name of proposed intervention
 * @param leverAdjustments Proposed lever changes
 * @returns Preview with predicted impact
 */
export function previewIntervention(
  interventionName: string,
  leverAdjustments: Array<{ lever: string; value: number }>
): InterventionPreview {
  // Simulate impact on economy index
  let predictedIndex = dashboardState.currentEconomyState.economyIndex;

  for (const adj of leverAdjustments) {
    const lever = dashboardState.interventionLevers.get(adj.lever);
    if (!lever) continue;

    // Impact calculation: each lever adjustment moves index toward center
    const movement = (adj.value - lever.defaultValue) * 0.1; // 10% of lever delta
    predictedIndex += movement;
  }

  // Clamp to 0-100
  predictedIndex = Math.max(0, Math.min(100, predictedIndex));

  // Estimate stabilization time
  const stabilizationTicks = Math.abs(predictedIndex - 50) * 10; // Closer to 50 = faster stabilization

  // Assess risk
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (Math.abs(predictedIndex - dashboardState.currentEconomyState.economyIndex) > 15) {
    riskLevel = 'high';
  } else if (Math.abs(predictedIndex - dashboardState.currentEconomyState.economyIndex) > 8) {
    riskLevel = 'medium';
  }

  const preview: InterventionPreview = {
    previewId: `preview_${uuid()}`,
    interventionName,
    levers: leverAdjustments.map((adj) => ({
      leverName: dashboardState.interventionLevers.get(adj.lever)?.name || adj.lever,
      proposedValue: adj.value
    })),
    predictedEconomyIndex: predictedIndex,
    estimatedDuration: stabilizationTicks,
    riskLevel,
    rollbackEligible: true
  };

  return preview;
}

/**
 * Apply intervention (after preview confirmation)
 * 
 * @param interventionName Name of intervention
 * @param leverAdjustments Lever changes to apply
 * @param reason Reason for intervention
 * @param changedBy Who approved intervention
 * @returns Array of updated levers
 */
export function applyIntervention(
  interventionName: string,
  leverAdjustments: Array<{ lever: string; value: number }>,
  reason: string,
  changedBy: string
): InterventionLever[] {
  const updated: InterventionLever[] = [];

  for (const adj of leverAdjustments) {
    const lever = adjustInterventionLever(adj.lever, adj.value, `${interventionName}: ${reason}`, changedBy);
    if (lever) updated.push(lever);
  }

  return updated;
}

/**
 * Rollback recent intervention
 * Reverts to previous state within 5-minute window
 * 
 * @param changedBy Who authorized rollback
 * @returns True if rollback succeeded
 */
export function rollbackRecentIntervention(changedBy: string): boolean {
  if (dashboardState.snapshotHistory.length < 2) return false;

  const currentTime = Date.now();
  const rollbackWindow = dashboardState.rollbackWindow;

  // Find previous snapshot within window
  let rollbackSnapshot = null;
  for (let i = dashboardState.snapshotHistory.length - 2; i >= 0; i--) {
    const snapshot = dashboardState.snapshotHistory[i];
    if (currentTime - snapshot.timestamp < rollbackWindow) {
      rollbackSnapshot = snapshot;
      break;
    }
  }

  if (!rollbackSnapshot) return false;

  // Restore levers to previous values
  const lever1 = dashboardState.interventionLevers.get('npc_starting_gold');
  if (lever1) {
    (lever1 as any).currentValue = rollbackSnapshot.npcStartingGold;
  }

  const lever2 = dashboardState.interventionLevers.get('trade_tax_rate');
  if (lever2) {
    (lever2 as any).currentValue = rollbackSnapshot.tradeTaxRate;
  }

  const lever3 = dashboardState.interventionLevers.get('caravan_spawn_weight');
  if (lever3) {
    (lever3 as any).currentValue = rollbackSnapshot.caravanSpawnWeight;
  }

  // Restore economy state
  (dashboardState as any).currentEconomyState = { ...rollbackSnapshot };

  // Log rollback
  const auditEntry: AdjustmentAuditEntry = {
    auditId: `audit_${uuid()}`,
    timestamp: Date.now(),
    action: 'Rollback intervention',
    leversChanged: [
      { lever: 'npc_starting_gold', oldValue: dashboardState.currentEconomyState.npcStartingGold, newValue: rollbackSnapshot.npcStartingGold },
      { lever: 'trade_tax_rate', oldValue: dashboardState.currentEconomyState.tradeTaxRate, newValue: rollbackSnapshot.tradeTaxRate },
      { lever: 'caravan_spawn_weight', oldValue: dashboardState.currentEconomyState.caravanSpawnWeight, newValue: rollbackSnapshot.caravanSpawnWeight }
    ],
    reason: 'Manual rollback',
    changedBy
  };

  dashboardState.auditLog.push(auditEntry);

  return true;
}

/**
 * Get economy state history
 * 
 * @returns Snapshot history
 */
export function getEconomyStateHistory(): EconomyStateSnapshot[] {
  return dashboardState.snapshotHistory.map((s) => ({ ...s }));
}

/**
 * Get intervention levers
 * 
 * @returns All levers
 */
export function getInterventionLevers(): InterventionLever[] {
  return Array.from(dashboardState.interventionLevers.values()).map((l) => ({ ...l }));
}

/**
 * Get audit log
 * 
 * @returns Adjustment history
 */
export function getAuditLog(): AdjustmentAuditEntry[] {
  return dashboardState.auditLog.map((a) => ({ ...a }));
}

/**
 * Get dashboard state
 * 
 * @returns Current dashboard state
 */
export function getDashboardState(): DashboardState {
  return {
    ...dashboardState,
    interventionLevers: new Map(dashboardState.interventionLevers)
  };
}

/**
 * Get current economy warnings
 * 
 * @returns Array of warnings
 */
export function getEconomyWarnings(): {
  warnings: string[];
  severity: 'info' | 'warning' | 'critical';
} {
  const current = dashboardState.currentEconomyState;
  const warnings: string[] = [];
  let severity: 'info' | 'warning' | 'critical' = 'info';

  if (current.economyIndex > 85) {
    warnings.push('CRITICAL: Hyperinflation detected. Consider reducing NPC starting gold.');
    severity = 'critical';
  } else if (current.economyIndex > 70) {
    warnings.push('WARNING: High inflation detected. Monitor prices closely.');
    severity = 'warning';
  }

  if (current.economyIndex < 15) {
    warnings.push('CRITICAL: Economy collapse. Consider emergency gold injection.');
    severity = 'critical';
  } else if (current.economyIndex < 30) {
    warnings.push('WARNING: Low economy. Consider increasing caravan spawns.');
    severity = 'warning';
  }

  if (current.stagnation) {
    warnings.push('WARNING: Trading volume critically low. Consider reducing taxes.');
    severity = 'warning';
  }

  if (Math.abs(current.inflation - current.deflation) > 10) {
    warnings.push('WARNING: Extreme price volatility detected.');
    severity = 'warning';
  }

  return { warnings, severity };
}

/**
 * Clear dashboard state (for testing)
 */
export function resetEconomyDashboard(): void {
  dashboardState = {
    dashboardId: `dashboard_${uuid()}`,
    isInitialized: false,
    currentEconomyState: {
      snapshotId: '',
      timestamp: 0,
      economyIndex: 50,
      inflation: 0,
      deflation: 0,
      stagnation: false,
      hyperinflation: false,
      npcStartingGold: 1000,
      tradeTaxRate: 0.05,
      caravanSpawnWeight: 5
    },
    interventionLevers: new Map(),
    snapshotHistory: [],
    auditLog: [],
    rollbackWindow: 300000
  };
}
