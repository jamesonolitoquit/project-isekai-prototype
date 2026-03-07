/**
 * Skill Manager Engine (Phase 4 - DSS 01)
 *
 * Manages skill usage, XP progression, and action stamina costs.
 * Integrates with:
 * - DSS 01: Skill progression with d20 + Attr + Skill checks
 * - DSS 01.2: Soft cap mechanics (XP doubles every 5 levels above (INT+WIS)/2)
 * - DSS 01.1: Attribute-based learning speed (1 + INT/20 multiplier)
 * - DSS 02.1: Stamina consumption per action
 *
 * Core Concept: Skills are used to overcome obstacles. Usage grants XP.
 * Learning speed depends on INT (faster learner = more XP per use).
 * Beyond soft cap, progression slows significantly.
 */

import type { Skill, CharacterSkillSet, SkillCoefficients, XpProgress } from '../types';
import type { Vessel, CoreAttributes } from '../types';
import { calculateAttributeModifiers, DEFAULT_LEARNING_CURVE } from '../types';
import { calculateXpRequiredForLevel, getSkillProficiency } from '../types';

/**
 * Skill Check Result: Outcome of a skill check
 * Includes roll result, success status, and XP awarded
 */
export interface SkillCheckResult {
  /** Total roll value (d20 + modifiers) */
  totalRoll: number;

  /** Difficulty class to beat */
  difficultyClass: number;

  /** Whether the check was successful */
  isSuccess: boolean;

  /** The margin (positive = success by X, negative = fail by X) */
  margin: number;

  /** XP awarded (success = full, failure = 0.25x) */
  xpAwarded: number;

  /** Whether this was a critical success (naturals 20) */
  isCriticalSuccess: boolean;

  /** Whether this was a critical failure (natural 1) */
  isCriticalFailure: boolean;

  /** Penalties applied (to show player) */
  appliedPenalties: {
    insufficientAttributePenalty?: number;
    paradoxBiasPenalty?: number;
  };
}

/**
 * Skill Manager: Manages skill checks, XP, and action costs
 */
export class SkillManager {
  /**
   * Calculate skill check success: d20 + Attribute Modifier + Skill Level/5
   *
   * Formula: d20 + floor((Attr - 10) / 2) + floor(Skill / 5) + Paradox Penalty
   *
   * With Insufficient Attribute (e.g., STR 5 using STR 8 weapon):
   * - Additional -5 penalty
   * - 2x stamina cost
   *
   * @param vessel Character attempting the skill
   * @param skill Skill being used
   * @param dc Difficulty class to beat
   * @param diceRoll Optional dice roll (for testing, otherwise random 1-20)
   * @param paradoxBiasPenalty Optional penalty from ParadoxCalculator (-0 to -5)
   * @returns SkillCheckResult
   */
  calculateSkillSuccess(
    vessel: Vessel,
    skill: Skill,
    dc: number,
    diceRoll?: number,
    paradoxBiasPenalty: number = 0
  ): SkillCheckResult {
    // Roll d20 (or use provided roll)
    const roll = diceRoll ?? Math.floor(Math.random() * 20) + 1;

    // Get attribute modifier (STR, DEX, etc. depending on skill type)
    const modifiers = calculateAttributeModifiers(vessel.attributes);
    const attr = vessel.attributes[skill.primaryAttribute];
    const attrMod = Math.floor((attr - 10) / 2);

    // Skill proficiency bonus: level / 5 (so level 25 = +5 bonus)
    const skillBonus = Math.floor(skill.level / 5);

    // Proficiency multiplier bonus
    const proficiencyBonus = skill.proficiencyBonus;

    // Calculate total roll
    let totalRoll =
      roll + attrMod + skillBonus + proficiencyBonus + paradoxBiasPenalty;

    // Check for insufficient primary attribute (based on primaryAttribute field)
    let insufficientAttributePenalty = 0;
    const primaryAttr = vessel.attributes[skill.primaryAttribute];
    if (primaryAttr < 10) {
      // Below average (10) means insufficient
      insufficientAttributePenalty = -5;
      totalRoll += insufficientAttributePenalty;
    }

    // Determine success
    const isSuccess = totalRoll >= dc;
    const margin = totalRoll - dc;
    const isCriticalSuccess = roll === 20;
    const isCriticalFailure = roll === 1;

    // Award XP (success = full, failure = 0.25x)
    const baseXp = 100; // Base XP per attempt
    const xpAwarded = isSuccess ? baseXp : baseXp * 0.25;

    return {
      totalRoll,
      difficultyClass: dc,
      isSuccess,
      margin,
      xpAwarded,
      isCriticalSuccess,
      isCriticalFailure,
      appliedPenalties: {
        insufficientAttributePenalty: insufficientAttributePenalty || undefined,
        paradoxBiasPenalty: paradoxBiasPenalty || undefined,
      },
    };
  }

  /**
   * Process XP gain for a skill after a check
   *
   * Applies INT/WIS multipliers and enforces soft cap:
   * - Below soft cap: Normal XP gain with INT multiplier
   * - At soft cap: 1.0x multiplier (no bonus)
   * - Above soft cap: XP required doubles every 5 levels
   *
   * Soft Cap = CurrentLevel + ((INT + WIS) / 2)
   *
   * INT Multiplier = 1 + (INT / 20)
   * WIS Multiplier = 1 + (WIS / 25) (for knowledge retention)
   *
   * @param vessel Character gaining XP
   * @param skill Skill to level up
   * @param xpEarned Base XP earned from skill check
   * @returns Updated skill with new XP/level
   */
  processXpGain(vessel: Vessel, skill: Skill, xpEarned: number): Skill {
    const updated = { ...skill };

    // Calculate INT/WIS multipliers
    const intMultiplier = 1 + vessel.attributes.INT / 20;
    const wisMultiplier = 1 + vessel.attributes.WIS / 25;

    // Calculate soft cap
    const softCap = vessel.level + (vessel.attributes.INT + vessel.attributes.WIS) / 2;

    // Check if currently above soft cap
    const levelsAboveSoftCap = Math.max(0, skill.level - Math.floor(softCap));

    // Calculate XP required for next level with soft cap doubling
    const xpRequired = calculateXpRequiredForLevel(skill.level, softCap);

    // Apply multipliers
    let xpToAdd = xpEarned * intMultiplier * wisMultiplier;

    // If above soft cap, XP required doubles but XP gain doesn't (creates friction)
    if (levelsAboveSoftCap > 0) {
      // No additional multiplier bonus - just slows progression
    }

    // Add XP
    updated.currentXp += xpToAdd;

    // Check for level-up
    if (updated.currentXp >= xpRequired) {
      updated.level += 1;
      updated.currentXp -= xpRequired; // Carry over overflow
    }

    return updated;
  }

  /**
   * Consume stamina for an action
   *
   * Base stamina cost is action-dependent.
   * If attribute requirement is not met (e.g., STR 5 using STR 8 weapon):
   * - 2x stamina cost multiplier
   *
   * @param vessel Character performing action
   * @param baseStaminaCost Base cost of the action
   * @param insufficientAttribute Whether STR/DEX requirement is unmet
   * @returns Updated vessel with stamina deducted
   */
  consumeStamina(
    vessel: Vessel,
    baseStaminaCost: number,
    insufficientAttribute: boolean = false
  ): Vessel {
    const updated = { ...vessel };

    // Apply 2x multiplier if insufficient attribute
    const totalCost = insufficientAttribute ? baseStaminaCost * 2 : baseStaminaCost;

    // Reduce stamina
    updated.stamina = Math.max(0, updated.stamina - totalCost);

    // If stamina depleted, apply exhaustion penalty
    if (updated.stamina === 0) {
      // Status effect: Exhaustion (-25% damage output)
      // Would be applied to statusEffects in full implementation
    }

    return updated;
  }

  /**
   * Calculate soft cap for a character
   * Formula: CurrentLevel + ((INT + WIS) / 2)
   *
   * Once skill level exceeds soft cap, XP required doubles every 5 levels
   *
   * @param vessel Character to calculate for
   * @param currentSkillLevel Current skill level
   * @returns Soft cap threshold
   */
  calculateSoftCap(vessel: Vessel, currentSkillLevel: number): number {
    return vessel.level + (vessel.attributes.INT + vessel.attributes.WIS) / 2;
  }

  /**
   * Calculate learning efficiency multiplier
   * Based on INT and WIS attributes
   *
   * INT Multiplier: 1 + (INT / 20) - affects XP per usage
   * WIS Multiplier: 1 + (WIS / 25) - affects knowledge retention
   *
   * @param vessel Character to calculate for
   * @returns { intMultiplier, wisMultiplier }
   */
  calculateLearningMultipliers(
    vessel: Vessel
  ): { intMultiplier: number; wisMultiplier: number } {
    return {
      intMultiplier: 1 + vessel.attributes.INT / 20,
      wisMultiplier: 1 + vessel.attributes.WIS / 25,
    };
  }

  /**
   * Get estimated XP to next level
   * Takes into account soft cap doubling
   *
   * @param skill Skill to check
   * @param vessel Character owning the skill
   * @returns { xpNeeded, xpProgress, percentToLevel }
   */
  getXpProgress(skill: Skill, vessel: Vessel): {
    xpNeeded: number;
    xpProgress: number;
    percentToLevel: number;
    levelsAboveSoftCap: number;
  } {
    const softCap = this.calculateSoftCap(vessel, skill.level);
    const xpNeeded = calculateXpRequiredForLevel(skill.level, softCap);
    const levelsAboveSoftCap = Math.max(0, skill.level - Math.floor(softCap));

    return {
      xpNeeded,
      xpProgress: skill.currentXp,
      percentToLevel: (skill.currentXp / xpNeeded) * 100,
      levelsAboveSoftCap,
    };
  }

  /**
   * Apply action cost (stamina + vigor drain)
   * More intense actions drain both stamina and vigor
   *
   * @param vessel Character performing action
   * @param staminaCost Stamina to deduct
   * @param vigorCost Optional vigor drain (e.g., for combat exertion)
   * @returns Updated vessel
   */
  applyActionCost(
    vessel: Vessel,
    staminaCost: number,
    vigorCost: number = 0
  ): Vessel {
    const updated = { ...vessel };

    // Consume stamina
    updated.stamina = Math.max(0, updated.stamina - staminaCost);

    // Consume vigor if applicable
    if (vigorCost > 0) {
      updated.vitals.vigor = Math.max(0, updated.vitals.vigor - vigorCost);
    }

    return updated;
  }

  /**
   * Get skill proficiency tier
   * Used for UI and narrative purposes
   *
   * @param skill Skill to check
   * @returns Proficiency tier string
   */
  getSkillTier(skill: Skill): string {
    return getSkillProficiency(skill.level);
  }
}

/**
 * Default skill manager instance
 */
export const defaultSkillManager = new SkillManager();
