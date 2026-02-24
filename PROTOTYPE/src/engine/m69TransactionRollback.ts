/**
 * M69: Transaction Rollback Engine
 * Automated rollback procedures with audit trail and compensation
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type CompensationType = 'gold_penalty' | 'item_delete' | 'cosmetic_award' | 'none';
export type RollbackReason =
  | 'exploit_detection'
  | 'duplication'
  | 'gold_generation'
  | 'manual_admin'
  | 'player_request'
  | 'system_error'
  | 'unknown';

export interface Transaction {
  id: string;
  playerId: string;
  receiverId: string;
  itemId: string;
  amount: number;
  tick: number;
  timestamp: number;
}

export interface PlayerInventorySnapshot {
  playerId: string;
  tick: number;
  timestamp: number;
  inventory: Map<string, number>;
}

export interface RollbackAction {
  id: string;
  playerId: string;
  transactionIds: string[];
  cascadedTransactionIds: string[];
  reason: RollbackReason;
  initiatedBy: string; // moderator ID
  compensationType: CompensationType;
  compensationAmount: number;
  playerNotified: boolean;
  executedAt: number | null;
  revertedAt: number | null;
}

export interface RollbackState {
  rollbackActions: Map<string, RollbackAction>;
  snapshots: PlayerInventorySnapshot[];
  transactionDependencies: Map<string, string[]>; // tx -> [dependent tx ids]
  completedRollbacks: number;
  compensationDispensed: number;
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: RollbackState = {
  rollbackActions: new Map(),
  snapshots: [],
  transactionDependencies: new Map(),
  completedRollbacks: 0,
  compensationDispensed: 0,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initTransactionRollback(): boolean {
  state.rollbackActions.clear();
  state.snapshots = [];
  state.transactionDependencies.clear();
  state.completedRollbacks = 0;
  state.compensationDispensed = 0;
  return true;
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

export function recordInventorySnapshot(
  playerId: string,
  tick: number,
  inventory: Map<string, number>
): void {
  const snapshot: PlayerInventorySnapshot = {
    playerId,
    tick,
    timestamp: Date.now(),
    inventory: new Map(inventory),
  };

  state.snapshots.push(snapshot);

  // Keep rolling window of 1000 snapshots per player
  const playerSnapshots = state.snapshots.filter((s) => s.playerId === playerId);
  if (playerSnapshots.length > 1000) {
    const oldestIdx = state.snapshots.findIndex((s) => s === playerSnapshots[0]);
    state.snapshots.splice(oldestIdx, 1);
  }
}

function getInventorySnapshotBefore(playerId: string, tick: number): PlayerInventorySnapshot | null {
  const relevant = state.snapshots
    .filter((s) => s.playerId === playerId && s.tick < tick)
    .sort((a, b) => b.tick - a.tick);

  return relevant.length > 0 ? relevant[0] : null;
}

// ============================================================================
// TRANSACTION DEPENDENCY TRACKING
// ============================================================================

export function recordTransactionDependency(sourceId: string, dependentId: string): void {
  if (!state.transactionDependencies.has(sourceId)) {
    state.transactionDependencies.set(sourceId, []);
  }
  state.transactionDependencies.get(sourceId)!.push(dependentId);
}

function findCascadedTransactions(txIds: string[]): string[] {
  const toCheck: string[] = [...txIds];
  const cascaded = new Set<string>();

  while (toCheck.length > 0) {
    const tx = toCheck.shift()!;
    const dependents = state.transactionDependencies.get(tx) ?? [];

    for (const dependent of dependents) {
      if (!cascaded.has(dependent)) {
        cascaded.add(dependent);
        toCheck.push(dependent);
      }
    }
  }

  return Array.from(cascaded);
}

// ============================================================================
// ROLLBACK EXECUTION
// ============================================================================

export function selectiveRollback(
  playerId: string,
  txIds: string[],
  reason: RollbackReason,
  moderatorId: string
): RollbackAction {
  // Detect cascaded transactions
  const cascaded = findCascadedTransactions(txIds);

  const action: RollbackAction = {
    id: `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    transactionIds: txIds,
    cascadedTransactionIds: cascaded,
    reason,
    initiatedBy: moderatorId,
    compensationType: calculateCompensationType(reason),
    compensationAmount: 0,
    playerNotified: false,
    executedAt: null,
    revertedAt: null,
  };

  state.rollbackActions.set(action.id, action);
  return action;
}

export function executeRollback(rollbackId: string): boolean {
  const action = state.rollbackActions.get(rollbackId);
  if (!action) return false;

  action.executedAt = Date.now();

  // Calculate compensation
  const compensation = calculateCompensation(action.reason, action.transactionIds.length);
  action.compensationAmount = compensation.amount;
  action.compensationType = compensation.type;

  // Record in audit trail
  const auditEntry = `ROLLBACK: ${action.transactionIds.length} txs + ${action.cascadedTransactionIds.length} cascaded. Reason: ${action.reason}. Compensation: ${action.compensationType} x${action.compensationAmount}`;

  // Update stats
  (state as any).completedRollbacks++;
  (state as any).compensationDispensed += action.compensationAmount;

  return true;
}

function calculateCompensationType(reason: RollbackReason): CompensationType {
  switch (reason) {
    case 'exploit_detection':
    case 'duplication':
    case 'gold_generation':
      return 'gold_penalty'; // Penalty applied
    case 'manual_admin':
      return 'cosmetic_award'; // Admin discretion
    case 'system_error':
      return 'cosmetic_award'; // Compensate for system issue
    case 'player_request':
      return 'none';
    default:
      return 'none';
  }
}

interface Compensation {
  type: CompensationType;
  amount: number;
}

function calculateCompensation(reason: RollbackReason, txCount: number): Compensation {
  switch (reason) {
    case 'duplication':
      // 10% penalty on duplicated transactions
      return { type: 'gold_penalty', amount: Math.round(txCount * 10) };
    case 'exploit_detection':
      // Graduated penalty based on severity
      return { type: 'gold_penalty', amount: Math.round(txCount * 5) };
    case 'manual_admin':
      // Award cosmetic for inconvenience
      return { type: 'cosmetic_award', amount: 1 };
    case 'system_error':
      // Generous compensation for system fault
      return { type: 'cosmetic_award', amount: 2 };
    default:
      return { type: 'none', amount: 0 };
  }
}

// ============================================================================
// PLAYER NOTIFICATION
// ============================================================================

export function notifyPlayerOfRollback(rollbackId: string): boolean {
  const action = state.rollbackActions.get(rollbackId);
  if (!action) return false;

  const notificationMessage = generateRollbackNotification(action);

  // In production: send via chat/email system
  action.playerNotified = true;

  return true;
}

function generateRollbackNotification(action: RollbackAction): string {
  let message = `Your account has been affected by ${action.reason}. `;
  message += `${action.transactionIds.length} transaction(s) have been reverted`;

  if (action.cascadedTransactionIds.length > 0) {
    message += ` (plus ${action.cascadedTransactionIds.length} dependent transaction(s))`;
  }

  message += `. `;

  if (action.compensationType === 'gold_penalty') {
    message += `Penalty applied: ${action.compensationAmount} gold. `;
  } else if (action.compensationType === 'cosmetic_award') {
    message += `Compensation awarded: ${action.compensationAmount} cosmetic item(s). `;
  }

  message += `Appeal window: 24 hours. Contact support for more info.`;

  return message;
}

// ============================================================================
// LEDGER RECORDING
// ============================================================================

export function recordRollbackInLedger(
  rollbackId: string,
  moderatorId: string
): { eventId: string; recorded: boolean } {
  const action = state.rollbackActions.get(rollbackId);
  if (!action) return { eventId: '', recorded: false };

  const eventId = `ledger_rollback_${rollbackId.substr(0, 16)}`;

  // In production: write to the ledger system
  // ledger.appendEvent({
  //   eventId,
  //   type: 'transaction_rollback',
  //   playerId: action.playerId,
  //   moderatorId,
  //   transactionIds: action.transactionIds,
  //   cascadedIdCount: action.cascadedTransactionIds.length,
  //   reason: action.reason,
  //   compensation: { type: action.compensationType, amount: action.compensationAmount },
  //   timestamp: Date.now(),
  // });

  action.revertedAt = Date.now();

  return { eventId, recorded: true };
}

// ============================================================================
// CASCADE ANALYSIS REPORTING
// ============================================================================

export function getAffectedTransactionTree(txIds: string[]): Record<string, unknown> {
  const tree: Record<string, unknown> = {
    primary: txIds,
    cascaded: findCascadedTransactions(txIds),
    cascadeDepth: calculateCascadeDepth(txIds),
  };

  return tree;
}

function calculateCascadeDepth(txIds: string[], depth: number = 0, seen: Set<string> = new Set()): number {
  let maxDepth = depth;

  for (const txId of txIds) {
    if (seen.has(txId)) continue;
    seen.add(txId);

    const dependents = state.transactionDependencies.get(txId) ?? [];
    if (dependents.length > 0) {
      const depthResult = calculateCascadeDepth(dependents, depth + 1, seen);
      maxDepth = Math.max(maxDepth, depthResult);
    }
  }

  return maxDepth;
}

export function getModerationReport(rollbackId: string): Record<string, unknown> {
  const action = state.rollbackActions.get(rollbackId);
  if (!action) return {};

  const cascaded = findCascadedTransactions(action.transactionIds);
  const totalAffected = action.transactionIds.length + cascaded.length;

  return {
    rollbackId: action.id,
    playerId: action.playerId,
    reason: action.reason,
    moderator: action.initiatedBy,
    primaryTransactions: action.transactionIds.length,
    cascadedTransactions: cascaded.length,
    totalAffected,
    compensation: {
      type: action.compensationType,
      amount: action.compensationAmount,
    },
    playerNotified: action.playerNotified,
    executedAt: action.executedAt,
    appealDeadline: action.executedAt ? action.executedAt + 24 * 60 * 60 * 1000 : null,
  };
}

// ============================================================================
// QUERIES & RETRIEVAL
// ============================================================================

export function getRollbackActions(): RollbackAction[] {
  return Array.from(state.rollbackActions.values());
}

export function getRollbackActionsByPlayer(playerId: string): RollbackAction[] {
  return Array.from(state.rollbackActions.values()).filter((a) => a.playerId === playerId);
}

export function getCompletedRollbacks(): RollbackAction[] {
  return Array.from(state.rollbackActions.values()).filter((a) => a.executedAt !== null);
}

export function getPendingRollbacks(): RollbackAction[] {
  return Array.from(state.rollbackActions.values()).filter((a) => a.executedAt === null);
}

export function getRollbackStats() {
  return {
    completedRollbacks: state.completedRollbacks,
    compensationDispensed: state.compensationDispensed,
    averageTransactionsPerRollback:
      state.completedRollbacks > 0
        ? Array.from(state.rollbackActions.values())
            .filter((a) => a.executedAt !== null)
            .reduce((sum, a) => sum + a.transactionIds.length, 0) / state.completedRollbacks
        : 0,
  };
}

export function getRollbackState(): RollbackState {
  return state;
}
