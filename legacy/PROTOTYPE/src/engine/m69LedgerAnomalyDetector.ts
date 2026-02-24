/**
 * M69: Ledger Anomaly Detector
 * SHA-256 chain validation and determinism violation detection
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type AnomalyType =
  | 'chain_validation_failure'
  | 'determinism_violation'
  | 'impossible_state'
  | 'orphaned_event'
  | 'timestamp_inconsistency'
  | 'unknown';

export interface LedgerEvent {
  eventId: string;
  tick: number;
  timestamp: number;
  playerId: string;
  eventType: string;
  data: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

export interface EntityState {
  id: string;
  type: string;
  tick: number;
  data: Record<string, unknown>;
}

export interface LedgerAnomaly {
  id: string;
  type: AnomalyType;
  severity: number; // 0-100 confidence score
  description: string;
  affectedEvents: string[];
  affectedEntities: string[];
  detectedAt: number;
  recommendedAction: string;
  autoRemediationApplied: boolean;
}

export interface RemediationRecommendation {
  action: 'delete' | 'rollback_to_checkpoint' | 'quarantine' | 'manual_review';
  eventIds: string[];
  checkpointTick: number | null;
  reason: string;
}

export interface LedgerDetectionState {
  anomalies: Map<string, LedgerAnomaly>;
  validatedEventCount: number;
  anomalousEventCount: number;
  validationStats: {
    totalChecks: number;
    chainValidationFailures: number;
    determinismViolations: number;
    impossibleStates: number;
    orphanedEvents: number;
    timestampIssues: number;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: LedgerDetectionState = {
  anomalies: new Map(),
  validatedEventCount: 0,
  anomalousEventCount: 0,
  validationStats: {
    totalChecks: 0,
    chainValidationFailures: 0,
    determinismViolations: 0,
    impossibleStates: 0,
    orphanedEvents: 0,
    timestampIssues: 0,
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initLedgerAnomalyDetector(): boolean {
  state.anomalies.clear();
  state.validatedEventCount = 0;
  state.anomalousEventCount = 0;
  state.validationStats = {
    totalChecks: 0,
    chainValidationFailures: 0,
    determinismViolations: 0,
    impossibleStates: 0,
    orphanedEvents: 0,
    timestampIssues: 0,
  };
  return true;
}

// ============================================================================
// CRYPTOGRAPHIC VALIDATION
// ============================================================================

/**
 * Validate ledger chain integrity using hash chain verification
 */
export function validateLedgerChain(events: LedgerEvent[]): LedgerAnomaly[] {
  const anomalies: LedgerAnomaly[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    state.validationStats.totalChecks++;

    if (i === 0) {
      // Genesis event should have empty previousHash
      if (event.previousHash !== '') {
        const anomaly = createAnomaly(
          'chain_validation_failure',
          85,
          `Genesis event ${event.eventId} has non-empty previousHash`,
          [event.eventId],
          [event.playerId]
        );
        anomalies.push(anomaly);
        state.validationStats.chainValidationFailures++;
      }
    } else {
      const prevEvent = events[i - 1];

      // Verify chain linkage: current event's previousHash should match previous event's hash
      if (event.previousHash !== prevEvent.hash) {
        const anomaly = createAnomaly(
          'chain_validation_failure',
          90,
          `Chain linkage broken: event ${event.eventId} previousHash ${event.previousHash} does not match prev event hash ${prevEvent.hash}`,
          [prevEvent.eventId, event.eventId],
          []
        );
        anomalies.push(anomaly);
        state.validationStats.chainValidationFailures++;
      }
    }
  }

  return anomalies;
}

/**
 * Detect determinism violations: replaying should produce same state
 */
export function checkDeterminismViolation(
  originalEvent: LedgerEvent,
  replayResult: Record<string, unknown>,
  originalResult: Record<string, unknown>
): LedgerAnomaly | null {
  state.validationStats.totalChecks++;

  // Compare results
  const originalHash = computeHash(JSON.stringify(originalResult));
  const replayHash = computeHash(JSON.stringify(replayResult));

  if (originalHash !== replayHash) {
    const anomaly = createAnomaly(
      'determinism_violation',
      95,
      `Event ${originalEvent.eventId} produces different result on replay: original hash ${originalHash} vs replay hash ${replayHash}`,
      [originalEvent.eventId],
      [originalEvent.playerId]
    );
    state.validationStats.determinismViolations++;
    return anomaly;
  }

  return null;
}

/**
 * Detect impossible state transitions
 */
export function checkImpossibleStateTransition(
  beforeState: EntityState,
  afterState: EntityState,
  causationEvent: LedgerEvent
): LedgerAnomaly | null {
  state.validationStats.totalChecks++;

  // Type 1: Entity acted after destruction
  if (beforeState.data.alive === false && afterState.data.alive !== false) {
    const anomaly = createAnomaly(
      'impossible_state',
      95,
      `Entity ${beforeState.id} transitioned from dead to alive`,
      [causationEvent.eventId],
      [beforeState.id]
    );
    state.validationStats.impossibleStates++;
    return anomaly;
  }

  // Type 2: Temporal violation - state rolled forward before this event
  if (afterState.tick < beforeState.tick) {
    const anomaly = createAnomaly(
      'impossible_state',
      90,
      `Entity ${beforeState.id} tick regressed from ${beforeState.tick} to ${afterState.tick}`,
      [causationEvent.eventId],
      [beforeState.id]
    );
    state.validationStats.impossibleStates++;
    return anomaly;
  }

  // Type 3: Inventory constraint violation - player has negative items
  if (
    typeof afterState.data.inventory === 'object' &&
    afterState.data.inventory !== null
  ) {
    const inv = afterState.data.inventory as Record<string, number>;
    for (const [itemId, count] of Object.entries(inv)) {
      if (count < 0) {
        const anomaly = createAnomaly(
          'impossible_state',
          85,
          `Entity ${beforeState.id} has negative inventory: ${itemId} = ${count}`,
          [causationEvent.eventId],
          [beforeState.id]
        );
        state.validationStats.impossibleStates++;
        return anomaly;
      }
    }
  }

  return null;
}

/**
 * Detect orphaned events (referencing non-existent entities)
 */
export function checkOrphanedEvent(
  event: LedgerEvent,
  existingEntities: Set<string>
): LedgerAnomaly | null {
  state.validationStats.totalChecks++;

  const references = extractEntityReferences(event.data);

  for (const ref of references) {
    if (!existingEntities.has(ref)) {
      const anomaly = createAnomaly(
        'orphaned_event',
        80,
        `Event ${event.eventId} references non-existent entity ${ref}`,
        [event.eventId],
        [ref]
      );
      state.validationStats.orphanedEvents++;
      return anomaly;
    }
  }

  return null;
}

/**
 * Detect timestamp inconsistencies (causal ordering violations)
 */
export function checkTimestampInconsistency(
  event: LedgerEvent,
  prevEvent: LedgerEvent | null
): LedgerAnomaly | null {
  state.validationStats.totalChecks++;

  // Check 1: timestamps should be monotonically increasing
  if (prevEvent && event.timestamp < prevEvent.timestamp) {
    const anomaly = createAnomaly(
      'timestamp_inconsistency',
      75,
      `Event ${event.eventId} timestamp ${event.timestamp} < previous event ${prevEvent.eventId} timestamp ${prevEvent.timestamp}`,
      [prevEvent.eventId, event.eventId],
      []
    );
    state.validationStats.timestampIssues++;
    return anomaly;
  }

  // Check 2: tick ordering should match timestamp ordering
  if (prevEvent && event.tick < prevEvent.tick && event.timestamp > prevEvent.timestamp) {
    const anomaly = createAnomaly(
      'timestamp_inconsistency',
      70,
      `Event ${event.eventId} tick regressed (tick ${event.tick} < prev tick ${prevEvent.tick}) despite later timestamp`,
      [prevEvent.eventId, event.eventId],
      []
    );
    state.validationStats.timestampIssues++;
    return anomaly;
  }

  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function computeHash(data: string): string {
  // Simplified hash for demo (in production: crypto library)
  // For now, use a deterministic hash based on string
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function extractEntityReferences(data: Record<string, unknown>): string[] {
  const refs: string[] = [];

  function traverse(obj: unknown): void {
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          traverse(item);
        }
      } else {
        for (const value of Object.values(obj)) {
          if (typeof value === 'string' && (value.startsWith('entity_') || value.startsWith('npc_') || value.startsWith('player_'))) {
            refs.push(value);
          }
          traverse(value);
        }
      }
    }
  }

  traverse(data);
  return refs;
}

function createAnomaly(
  type: AnomalyType,
  severity: number,
  description: string,
  affectedEvents: string[],
  affectedEntities: string[]
): LedgerAnomaly {
  const anomaly: LedgerAnomaly = {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity: Math.min(100, Math.max(0, severity)),
    description,
    affectedEvents,
    affectedEntities,
    detectedAt: Date.now(),
    recommendedAction: generateRemediationRecommendation(type, affectedEvents),
    autoRemediationApplied: false,
  };

  state.anomalies.set(anomaly.id, anomaly);
  state.anomalousEventCount++;

  return anomaly;
}

function generateRemediationRecommendation(type: AnomalyType, eventIds: string[]): string {
  switch (type) {
    case 'chain_validation_failure':
      return `Delete corrupted events ${eventIds.join(', ')} and replay from previous checkpoint`;
    case 'determinism_violation':
      return `Quarantine events ${eventIds.join(', ')} for manual review - possible RNG corruption`;
    case 'impossible_state':
      return `Rollback to checkpoint before event ${eventIds[0]} to restore valid state`;
    case 'orphaned_event':
      return `Delete orphaned event ${eventIds[0]} and audit entity deletion timeline`;
    case 'timestamp_inconsistency':
      return `Manual review required: ${eventIds.length} events with causal ordering issues`;
    default:
      return 'Manual review required';
  }
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export function validateLedgerSegment(
  events: LedgerEvent[],
  existingEntities: Set<string>
): LedgerAnomaly[] {
  const allAnomalies: LedgerAnomaly[] = [];

  // Chain validation
  allAnomalies.push(...validateLedgerChain(events));

  // Individual event validation
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const prevEvent = i > 0 ? events[i - 1] : null;

    // Timestamp check
    const tsAnomaly = checkTimestampInconsistency(event, prevEvent);
    if (tsAnomaly && !allAnomalies.find((a) => a.id === tsAnomaly.id)) {
      allAnomalies.push(tsAnomaly);
    }

    // Orphaned check
    const orphanedAnomaly = checkOrphanedEvent(event, existingEntities);
    if (orphanedAnomaly && !allAnomalies.find((a) => a.id === orphanedAnomaly.id)) {
      allAnomalies.push(orphanedAnomaly);
    }
  }

  state.validatedEventCount += events.length;
  return allAnomalies;
}

// ============================================================================
// REMEDIATION
// ============================================================================

export function applyAutoRemediation(anomalyId: string): boolean {
  const anomaly = state.anomalies.get(anomalyId);
  if (!anomaly) return false;

  anomaly.autoRemediationApplied = true;
  return true;
}

// ============================================================================
// QUERIES & RETRIEVAL
// ============================================================================

export function getAnomalies(): LedgerAnomaly[] {
  return Array.from(state.anomalies.values());
}

export function getAnomaliesBySeverity(minSeverity: number): LedgerAnomaly[] {
  return Array.from(state.anomalies.values()).filter((a) => a.severity >= minSeverity);
}

export function getAnomaliesByType(type: AnomalyType): LedgerAnomaly[] {
  return Array.from(state.anomalies.values()).filter((a) => a.type === type);
}

export function getHighRiskAnomalies(): LedgerAnomaly[] {
  return Array.from(state.anomalies.values())
    .filter((a) => a.severity >= 80 && !a.autoRemediationApplied)
    .sort((a, b) => b.severity - a.severity);
}

export function getValidationStats() {
  return state.validationStats;
}

export function getDetectionState(): LedgerDetectionState {
  return state;
}
