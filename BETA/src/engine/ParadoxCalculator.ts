/**
 * Paradox Calculator Engine (Phase 2 Core)
 * 
 * Implements the Paradox Debt formula and its mechanical effects on gameplay.
 * 
 * Core Formula (DSS 03.1):
 * Debt = EventMagnitude * (InformationGained / TemporalDivergence)
 * 
 * - EventMagnitude: Scale of temporal manipulation (0-100)
 * - InformationGained: How much new data player learned (0-100)
 * - TemporalDivergence: How many "timelines" were splinted by the action (1-100+)
 *
 * Paradox Debt States:
 * - Whisper (0-25%): -1 to d20 rolls, minor NPC unrest
 * - Bleed (26-50%): -2 to d20 rolls, visible NPC unrest
 * - Bleach (51-75%): -3 to d20 rolls, Shadow entities attracted
 * - Reality Fault (76%+): -5 to d20 rolls, forced Vessel Reset
 */

import type { ParadoxTracker, ParadoxDebtState } from '../types';
import { ParadoxDebtState as DebtStateEnum } from '../types';

/**
 * Paradox Debt Event Details
 * Used to calculate debt from player actions
 */
export interface ParadoxEventDetails {
  actionType: 'timeline-warp' | 'snapshot-rewind' | 'decision-undo' | 'item-duplication' | 'death-undo';
  magnitude: number;        // 0-100: How big was the time manipulation?
  informationGained: number; // 0-100: How much did player learn?
  temporalDivergence: number; // 1-100+: How "spread out" across timelines?
}

/**
 * Paradox Bias Result: How much to modify d20 rolls
 */
export interface ParadoxBiasResult {
  debtPercent: number;
  currentState: ParadoxDebtState;
  rollPenalty: number;    // Penalty applied to d20 (0 to -5)
  failureInflation: number; // Extra % chance to fail checks
  shadowAttraction: number; // Number of shadow entities attracted
}

/**
 * Paradox Calculator: Static utility class for all paradox calculations
 */
export class ParadoxCalculator {
  /**
   * Calculate paradox debt from an event
   * Formula: Debt = EventMagnitude * (InformationGained / TemporalDivergence)
   * 
   * Real-world examples:
   * - Timeline Warp (magnitude 50, info 30, divergence 10) = 50 * (30/10) = 150 debt
   * - Decision Undo (magnitude 20, info 40, divergence 50) = 20 * (40/50) = 16 debt
   * - Death Undo (magnitude 80, info 100, divergence 5) = 80 * (100/5) = 1600 debt (catastrophic!)
   * 
   * @param event Details of the paradox event
   * @returns Debt accumulated (can exceed 100, triggers Reality Fault)
   */
  static calculateDebtFromEvent(event: ParadoxEventDetails): number {
    if (event.temporalDivergence <= 0) {
      // Degenerate case: inf divergence = inf debt
      return event.magnitude * event.informationGained * 100;
    }

    return event.magnitude * (event.informationGained / event.temporalDivergence);
  }

  /**
   * Get the current paradox state enum
   * Based on debt as % of capacity
   * 
   * @param tracker ParadoxTracker to query
   * @returns Current state (WHISPER, BLEED, BLEACH, or REALITY_FAULT)
   */
  static getParadoxState(tracker: ParadoxTracker): ParadoxDebtState {
    const percent = (tracker.currentDebt / tracker.debtCapacity) * 100;

    if (percent >= 76) return DebtStateEnum.REALITY_FAULT;
    if (percent >= 51) return DebtStateEnum.BLEACH;
    if (percent >= 26) return DebtStateEnum.BLEED;
    return DebtStateEnum.WHISPER;
  }

  /**
   * Calculate paradox bias effects on d20 rolls
   * 
   * Whisper State (0-25%):     -1 penalty
   * Bleed State (26-50%):      -2 penalty
   * Bleach State (51-75%):     -3 penalty
   * Reality Fault (76%+):      -5 penalty
   * 
   * @param tracker ParadoxTracker to query
   * @returns ParadoxBiasResult with all modifiers
   */
  static calculateParadoxBias(tracker: ParadoxTracker): ParadoxBiasResult {
    const debtPercent = (tracker.currentDebt / tracker.debtCapacity) * 100;
    const state = this.getParadoxState(tracker);

    let rollPenalty = 0;
    let failureInflation = 0;
    let shadowAttraction = 0;

    switch (state) {
      case DebtStateEnum.WHISPER:
        rollPenalty = -1;
        failureInflation = 0.05; // +5% failure on checks
        shadowAttraction = 0;
        break;

      case DebtStateEnum.BLEED:
        rollPenalty = -2;
        failureInflation = 0.1; // +10% failure
        shadowAttraction = 0;
        break;

      case DebtStateEnum.BLEACH:
        rollPenalty = -3;
        failureInflation = 0.15; // +15% failure
        shadowAttraction = Math.floor((debtPercent - 51) / 10) + 1; // 1-3 shadows
        break;

      case DebtStateEnum.REALITY_FAULT:
        rollPenalty = -5;
        failureInflation = 0.25; // +25% failure
        shadowAttraction = 5; // Many shadows
        break;
    }

    return {
      debtPercent,
      currentState: state,
      rollPenalty,
      failureInflation,
      shadowAttraction,
    };
  }

  /**
   * Apply paradox bias to a d20 roll
   * 
   * @param tracker ParadoxTracker providing bias
   * @param baseRoll Base d20 result (1-20)
   * @returns Modified roll with paradox penalty applied
   */
  static applyParadoxBiasToRoll(tracker: ParadoxTracker, baseRoll: number): number {
    const bias = this.calculateParadoxBias(tracker);
    return Math.max(1, baseRoll + bias.rollPenalty);
  }

  /**
   * Apply paradox bias to a skill check DC
   * Effectively makes target DC harder to hit
   * 
   * @param baseTarget Target DC (e.g., 12)
   * @param tracker ParadoxTracker
   * @returns Adjusted DC
   */
  static adjustDifficultyByParadox(baseTarget: number, tracker: ParadoxTracker): number {
    const bias = this.calculateParadoxBias(tracker);
    return Math.max(baseTarget, baseTarget - bias.rollPenalty); // Negative penalty = higher DC
  }

  /**
   * Calculate the natural decay rate for paradox debt
   * 
   * Reality "heals itself" over time. High debt decays faster (trying to correct itself).
   * 
   * Formula: BaseDecay * (1 + DebtPercent / 200)
   * 
   * Examples:
   * - At 0% debt: 0.01 per tick (very slow)
   * - At 50% debt: 0.01 * 1.25 = 0.0125 per tick (accelerated)
   * - At 100% debt: 0.01 * 1.5 = 0.015 per tick (much faster)
   * 
   * @param tracker ParadoxTracker
   * @returns Decay rate per tick (0-1 scale)
   */
  static calculateNaturalDecayRate(tracker: ParadoxTracker): number {
    const debtPercent = (tracker.currentDebt / tracker.debtCapacity) * 100;
    const baseDecay = 0.01; // 1% per tick at baseline
    const accelerationFactor = 1 + debtPercent / 200;
    return baseDecay * accelerationFactor;
  }

  /**
   * Check if an actor is in Reality Fault state
   * Triggers forced Vessel Reset if true
   * 
   * @param tracker ParadoxTracker
   * @returns true if debt >= capacity
   */
  static isInRealityFault(tracker: ParadoxTracker): boolean {
    return tracker.currentDebt >= tracker.debtCapacity;
  }

  /**
   * Calculate "shadow entity" count attracted by high paradox debt
   * Shadows are NPCs that spawn to "correct" the timeline
   * 
   * @param tracker ParadoxTracker
   * @returns Number of shadows to spawn (0-10)
   */
  static calculateAttractedShadows(tracker: ParadoxTracker): number {
    const state = this.getParadoxState(tracker);

    switch (state) {
      case DebtStateEnum.WHISPER:
      case DebtStateEnum.BLEED:
        return 0; // No shadows in these states

      case DebtStateEnum.BLEACH:
        // 1-3 shadows depending on exact debt level in this state
        const bleachPercent = ((tracker.currentDebt / tracker.debtCapacity) * 100 - 51) / 24;
        return Math.ceil(1 + bleachPercent * 2);

      case DebtStateEnum.REALITY_FAULT:
        // Many shadows spawning to forcibly reset the timeline
        return 5 + Math.floor((tracker.currentDebt - tracker.debtCapacity) * 10);

      default:
        return 0;
    }
  }

  /**
   * Apply Womb-Magic paradox reduction
   * Reduces paradox debt by casting at ancestral altars
   * 
   * Formula: Debt reduction = 0.05 per cast (5% of max debt)
   * Only applies if current debt > 50 (DSS 16 Patch 2)
   * 
   * @param tracker ParadoxTracker
   * @param wombMagicLevel Character's Womb-Magic skill level (1-10)
   * @returns Amount reduced (0 if conditions not met)
   */
  static applyWombMagicReduction(tracker: ParadoxTracker, wombMagicLevel: number): number {
    // Check conditions
    if (tracker.currentDebt < 50) {
      return 0; // Debt too low
    }

    if (wombMagicLevel < 1 || wombMagicLevel > 10) {
      return 0; // Invalid level
    }

    // Calculate reduction: base (0.05 * capacity) * level bonus
    const baseReduction = 0.05 * tracker.debtCapacity;
    const levelBonus = 1 + (wombMagicLevel - 1) * 0.1; // 1.0x at level 1, 1.9x at level 10
    const reduction = baseReduction * levelBonus;

    tracker.currentDebt = Math.max(0, tracker.currentDebt - reduction);
    return reduction;
  }

  /**
   * Record a paradox event and return its debt impact
   * 
   * @param tracker ParadoxTracker to update
   * @param event Details of the paradox event
   * @returns Debt accumulated from this event
   */
  static recordParadoxEvent(tracker: ParadoxTracker, event: ParadoxEventDetails): number {
    const debt = this.calculateDebtFromEvent(event);
    tracker.currentDebt += debt;

    // Check if Reality Fault triggered
    if (this.isInRealityFault(tracker) && !tracker.inRealityFault) {
      tracker.inRealityFault = true;
      tracker.faultStartedAtTick = tracker.lastDecayAtTick; // Approximate
    }

    return debt;
  }

  /**
   * Apply one tick of natural paradox decay
   * Reality gradually stabilizes on its own
   * 
   * @param tracker ParadoxTracker to update
   * @param currentTick Current world tick
   */
  static applyNaturalDecay(tracker: ParadoxTracker, currentTick: number): void {
    const decayRate = this.calculateNaturalDecayRate(tracker);
    const ticksElapsed = currentTick - tracker.lastDecayAtTick;

    tracker.currentDebt = Math.max(0, tracker.currentDebt - decayRate * ticksElapsed);
    tracker.totalDecayApplied += decayRate * ticksElapsed;
    tracker.lastDecayAtTick = currentTick;

    // Check if Reality Fault resolved
    if (tracker.inRealityFault && !this.isInRealityFault(tracker)) {
      tracker.inRealityFault = false;
    }
  }

  /**
   * Get a human-readable description of paradox state
   * 
   * @param tracker ParadoxTracker
   * @returns String describing the state
   */
  static describeParadoxState(tracker: ParadoxTracker): string {
    const state = this.getParadoxState(tracker);
    const percent = (tracker.currentDebt / tracker.debtCapacity) * 100;

    switch (state) {
      case DebtStateEnum.WHISPER:
        return `Whisper (${percent.toFixed(0)}%): Reality feels slightly strained.`;
      case DebtStateEnum.BLEED:
        return `Bleed (${percent.toFixed(0)}%): NPCs sense unease. You notice discrepancies in your memories.`;
      case DebtStateEnum.BLEACH:
        return `Bleach (${percent.toFixed(0)}%): Shadows flicker at the edge of perception. Reality is fracturing.`;
      case DebtStateEnum.REALITY_FAULT:
        return `Reality Fault (${percent.toFixed(0)}%): The world is tearing apart. Forced reset imminent!`;
      default:
        return 'Unknown state';
    }
  }

  /**
   * Validate paradox tracker state
   */
  static validateParadoxTracker(tracker: ParadoxTracker): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (tracker.currentDebt < 0) {
      errors.push('currentDebt cannot be negative');
    }

    if (tracker.debtCapacity <= 0) {
      errors.push('debtCapacity must be positive');
    }

    if (tracker.totalDecayApplied < 0) {
      errors.push('totalDecayApplied cannot be negative');
    }

    if (tracker.inRealityFault && tracker.currentDebt < tracker.debtCapacity) {
      errors.push('Reality Fault flag should not be true if debt < capacity');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Export for external use
 */
export function createParadoxCalculator(): typeof ParadoxCalculator {
  return ParadoxCalculator;
}

/**
 * Debug utility: Log paradox state
 */
export function logParadoxState(tracker: ParadoxTracker, label?: string): void {
  if (typeof console === 'undefined') return; // Skip in test environments

  const bias = ParadoxCalculator.calculateParadoxBias(tracker);
  const description = ParadoxCalculator.describeParadoxState(tracker);

  console.log(`\n[Paradox State${label ? ` - ${label}` : ''}]`);
  console.log(`Debt: ${tracker.currentDebt.toFixed(2)}/${tracker.debtCapacity} (${bias.debtPercent.toFixed(1)}%)`);
  console.log(`State: ${bias.currentState}`);
  console.log(`Roll Penalty: ${bias.rollPenalty}`);
  console.log(`Failure Inflation: +${(bias.failureInflation * 100).toFixed(0)}%`);
  console.log(`Shadows Attracted: ${bias.shadowAttraction}`);
  console.log(`Description: ${description}`);
}
