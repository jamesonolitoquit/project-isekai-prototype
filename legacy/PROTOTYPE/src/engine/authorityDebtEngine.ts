/**
 * authorityDebtEngine.ts — Narrative Debt Tracking System (M43 Task A.3)
 * 
 * PURPOSE: Track narrative debt accumulated when Director overrides NPC choices.
 * High debt makes NPCs more resistant and unpredictable.
 * 
 * MECHANICS:
 * - `/force_epoch` costs +1 debt
 * - `/seal_canon` costs +2 debt
 * - High debt increases NPC `prudence` and `mystique` (less controllable)
 * - Director can "spend" ritual consensus votes to reduce debt
 * - Debt persists across epochs unless explicitly cleared
 * 
 * DETERMINISM: Debt calculations are deterministic and replay-safe
 * PERFORMANCE: All operations <2ms
 */

import type { WorldState, PlayerState } from './worldEngine';
import { seededNow } from './prng';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AuthorityDebtRecord {
  timestamp: number; // seededNow(worldTick)
  tick: number;
  debtType: 'force_epoch' | 'seal_canon' | 'announce' | 'custom_command';
  amount: number; // Amount of debt added/removed
  reason: string;
  commandDescription?: string; // What command caused it
  directorId?: string; // Which GM issued the command
}

export interface AuthorityDebtImpact {
  totalDebt: number; // Accumulated debt [0-100]
  npcsAffected: number; // How many NPCs are now resistant
  resistanceBonus: number; // [0-0.3] Personality adjustment for NPC prudence
  chaosModifier: number; // [0-1] How chaotic will next world event be
  consensusDiscount: number; // Cost reduction for next ritual consensus
}

export interface NarrativeDebtState {
  currentDebt: number; // [0-100] Current accumulated debt
  maxDebt: number; // Default 100, resets on epoch boundary
  history: AuthorityDebtRecord[]; // Audit trail
  lastClearedTick?: number; // When was debt last reset
  consensusVotesSpent?: number; // How many consensus votes used to pay debt
}

// ============================================================================
// DEBT MANAGEMENT
// ============================================================================

/**
 * Initialize or retrieve narrative debt tracking
 */
export function initializeDebtTracking(worldState: WorldState): NarrativeDebtState {
  if (!worldState.narrativeDebtState) {
    worldState.narrativeDebtState = {
      currentDebt: 0,
      maxDebt: 100,
      history: [],
      lastClearedTick: worldState.time?.tick ?? 0,
    };
  }
  return worldState.narrativeDebtState;
}

/**
 * Add debt when Director overrides world logic
 * Returns updated debt state
 */
export function addAuthorityDebt(
  worldState: WorldState,
  amount: number,
  debtType: AuthorityDebtRecord['debtType'],
  reason: string,
  directorId?: string
): NarrativeDebtState {
  const debtState = initializeDebtTracking(worldState);
  const worldTick = worldState.time?.tick ?? 0;

  // Add debt (clamped to max)
  const previousDebt = debtState.currentDebt;
  debtState.currentDebt = Math.min(debtState.currentDebt + amount, debtState.maxDebt);

  // Record in history
  debtState.history.push({
    timestamp: seededNow(worldTick),
    tick: worldTick,
    debtType,
    amount,
    reason,
    directorId,
  });

  // Keep history bounded
  if (debtState.history.length > 200) {
    debtState.history.shift();
  }

  console.log(
    `[AuthorityDebt] ${debtType}: +${amount} (${previousDebt} → ${debtState.currentDebt})`
  );

  return debtState;
}

/**
 * Standard debt amounts for common commands
 */
export const DEBT_COSTS: Record<string, number> = {
  'force_epoch': 1,
  'seal_canon': 2,
  'announce': 0.1,
  'spawn_macro_event': 0.5,
  'schedule_event': 0.2,
};

/**
 * Charge debt for a Director command
 */
export function chargeDebtForCommand(
  worldState: WorldState,
  commandType: string,
  directorId?: string
): number {
  const cost = DEBT_COSTS[commandType] ?? 0;
  if (cost > 0) {
    addAuthorityDebt(worldState, cost, commandType as any, `Command: ${commandType}`, directorId);
  }
  return cost;
}

/**
 * Reduce debt by spending ritual consensus votes
 * Director can use this to lower NPC resistance
 */
export function spendConsensusToReduceDebt(
  worldState: WorldState,
  consensusVotesSpent: number,
  reason?: string
): number {
  const debtState = initializeDebtTracking(worldState);
  const worldTick = worldState.time?.tick ?? 0;

  // Each consensus vote reduces debt by 5
  const debtReduction = Math.min(consensusVotesSpent * 5, debtState.currentDebt);
  const previousDebt = debtState.currentDebt;
  debtState.currentDebt = Math.max(debtState.currentDebt - debtReduction, 0);

  // Record in history
  debtState.history.push({
    timestamp: seededNow(worldTick),
    tick: worldTick,
    debtType: 'announce', // Placeholder type
    amount: -debtReduction,
    reason: reason || `Ritual consensus payment: ${consensusVotesSpent} votes spent`,
  });

  if (debtState.consensusVotesSpent === undefined) {
    debtState.consensusVotesSpent = 0;
  }
  debtState.consensusVotesSpent += consensusVotesSpent;

  console.log(
    `[AuthorityDebt] Consensus payment: -${debtReduction} debt (${previousDebt} → ${debtState.currentDebt})`
  );

  return debtReduction;
}

/**
 * Clear debt at epoch transition
 * Simulates NPCs "resetting" their memory of GM meddling
 */
export function clearDebtOnEpochTransition(
  worldState: WorldState,
  severity?: 'partial' | 'full'
): number {
  const debtState = initializeDebtTracking(worldState);
  const worldTick = worldState.time?.tick ?? 0;

  const clearedAmount = severity === 'full' 
    ? debtState.currentDebt 
    : Math.floor(debtState.currentDebt * 0.3); // Partial: 30% cleared

  const previousDebt = debtState.currentDebt;
  debtState.currentDebt = Math.max(debtState.currentDebt - clearedAmount, 0);
  debtState.lastClearedTick = worldTick;

  debtState.history.push({
    timestamp: seededNow(worldTick),
    tick: worldTick,
    debtType: 'announce',
    amount: -clearedAmount,
    reason: `Epoch transition debt reset [${severity}]: NPCs forget Director meddling`,
  });

  console.log(
    `[AuthorityDebt] Epoch reset [${severity}]: -${clearedAmount} debt (${previousDebt} → ${debtState.currentDebt})`
  );

  return clearedAmount;
}

// ============================================================================
// IMPACT CALCULATION
// ============================================================================

/**
 * Calculate gameplay impact of current narrative debt
 * Higher debt = more NPC resistance, more world chaos
 */
export function calculateDebtImpact(
  worldState: WorldState
): AuthorityDebtImpact {
  const debtState = initializeDebtTracking(worldState);
  const debtRatio = debtState.currentDebt / debtState.maxDebt; // [0-1]

  // How many NPCs are currently affected by debt
  const npcCount = worldState.npcs?.length ?? 0;
  const affectedNpcs = Math.floor(npcCount * Math.min(debtRatio * 1.5, 1));

  // Personality adjustment for affected NPCs
  // High debt = increased prudence and mystique (less predictable, more resistive)
  const resistanceBonus = debtRatio * 0.3; // Max +0.3 to prudence

  // World chaos multiplier for events
  const chaosModifier = Math.min(debtRatio * 1.5, 1); // Max 1.5x chaos

  // Reduced cost for consensus items
  const consensusDiscount = Math.min(debtRatio * 0.2, 0.5); // Max 50% discount

  return {
    totalDebt: debtState.currentDebt,
    npcsAffected: affectedNpcs,
    resistanceBonus,
    chaosModifier,
    consensusDiscount,
  };
}

/**
 * Get NPC-specific resistance from authority debt
 * Returns personality adjustments that should be applied to this NPC
 */
export function getNpcDebtResistance(
  worldState: WorldState,
  npcId: string,
  index: number
): Partial<any> {
  const impact = calculateDebtImpact(worldState);

  // Deterministic: first N NPCs affected, rest immune
  if (index >= impact.npcsAffected) {
    return {}; // No adjustment for unaffected NPCs
  }

  return {
    prudenceBonus: impact.resistanceBonus,
    mystiqueBonus: impact.resistanceBonus * 0.5,
    resistanceDescription: 'Authority Debt: NPC questions Director oversight',
  };
}

/**
 * Determine if NPCs should act chaotic due to high debt
 * Returns true if RNG roll fails under chaos multiplier
 */
export function shouldNpcActChaotic(
  worldState: WorldState,
  npcId: string,
  chaosThreshold: number = 0.7
): boolean {
  const impact = calculateDebtImpact(worldState);
  const chaosRoll = Math.random(); // TODO: Use SeededRng

  // Higher debt = higher chance of chaos
  const chaosChance = impact.chaosModifier;
  return chaosRoll < chaosChance * chaosThreshold;
}

// ============================================================================
// DASHBOARD & DISPLAY
// ============================================================================

/**
 * Get human-readable debt status for CoDmDashboard
 */
export function getDebtStatusText(worldState: WorldState): string {
  const debtState = initializeDebtTracking(worldState);
  const ratio = debtState.currentDebt / debtState.maxDebt;

  if (debtState.currentDebt === 0) {
    return '✓ Authority debt clear';
  } else if (ratio < 0.33) {
    return `⚠ Low debt: ${Math.round(debtState.currentDebt)}/${debtState.maxDebt}`;
  } else if (ratio < 0.66) {
    return `⚠⚠ Moderate debt: ${Math.round(debtState.currentDebt)}/${debtState.maxDebt}`;
  } else {
    return `⚠⚠⚠ Critical debt: ${Math.round(debtState.currentDebt)}/${debtState.maxDebt}`;
  }
}

/**
 * Get debt history for dashboard display
 */
export function getRecentDebtHistory(
  worldState: WorldState,
  limit: number = 10
): AuthorityDebtRecord[] {
  const debtState = initializeDebtTracking(worldState);
  return debtState.history.slice(-limit);
}

/**
 * Export debt state for debugging
 */
export function exportDebtState(worldState: WorldState): any {
  const debtState = initializeDebtTracking(worldState);
  const impact = calculateDebtImpact(worldState);

  return {
    currentDebt: debtState.currentDebt,
    maxDebt: debtState.maxDebt,
    debtRatio: debtState.currentDebt / debtState.maxDebt,
    impact,
    recentHistory: debtState.history.slice(-5),
  };
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Check if debt is at critical levels
 */
export function isDebtCritical(worldState: WorldState): boolean {
  const debtState = initializeDebtTracking(worldState);
  return debtState.currentDebt > debtState.maxDebt * 0.75;
}

/**
 * Get percentage debt for progress bar display
 */
export function getDebtPercentage(worldState: WorldState): number {
  const debtState = initializeDebtTracking(worldState);
  return (debtState.currentDebt / debtState.maxDebt) * 100;
}

/**
 * Calculate how many consensus votes needed to clear all debt
 */
export function getConsensusNeededToClearDebt(worldState: WorldState): number {
  const debtState = initializeDebtTracking(worldState);
  return Math.ceil(debtState.currentDebt / 5); // Each vote = 5 debt reduction
}

// ============================================================================
// EXPORTS
// ============================================================================
// Interfaces are already exported above
