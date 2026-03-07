/**
 * Skill System Schemas (Phase 4 - DSS 01)
 *
 * Implements skill progression, XP mechanics, and learning curves tied to INT/WIS.
 * Integrates with:
 * - DSS 01: Skill progression with soft caps, attribute-based learning curves
 * - DSS 01.2: Diminishing returns beyond INT/WIS soft caps
 * - DSS 01.3: Talent system and passive/active skill distinction
 * - DSS 01.4: Workstation-based learning and School system
 *
 * Core Concept: Skills are learned through use or study. Learning speed depends on
 * INT (multiplier on XP gain) and WIS (failure floor and soft cap ceiling).
 * Beyond the soft cap, XP requirements double every 5 levels.
 */

import { CoreAttributes } from './attributes';

/**
 * Skill Category: Organizational classification for skill types
 */
export type SkillCategory =
  | 'melee_combat'
  | 'ranged_combat'
  | 'defense'
  | 'magic'
  | 'crafting'
  | 'survival'
  | 'stealth'
  | 'social'
  | 'perception'
  | 'athletics'
  | 'magical_crafting'
  | 'alchemy'
  | 'medicine';

/**
 * Skill Base: Foundation for all lernable abilities
 *
 * Skills have:
 * - Level (0-100+, typically 1-75 threshold for normal play)
 * - XP progress toward next level
 * - Attribute tying (which attribute governs proficiency)
 * - Passive/Active distinction
 * - Associated workstation tier requirement
 */
export interface Skill {
  /** Unique skill identifier */
  id: string;

  /** Human-readable skill name */
  name: string;

  /** Categorical classification */
  category: SkillCategory;

  /** Current skill level (0 = untrained, 1-75 = normal play, 75+ = legendary) */
  level: number;

  /** Current XP toward next level (0 to baseXpPerLevel * softCapMultiplier) */
  currentXp: number;

  /** Primary attribute governing this skill (INT/WIS for learning, other for execution) */
  primaryAttribute: keyof CoreAttributes;

  /** Secondary attribute (if applicable) for modifier bonus */
  secondaryAttribute: keyof CoreAttributes | null;

  /**
   * Whether this skill is passive (always active) or active (requires usage)
   * - Passive: Automatically grants bonuses (e.g., "Night Vision")
   * - Active: Must be explicitly used in skill checks
   */
  isPassive: boolean;

  /**
   * Passive ability: If isPassive == true, this function applies static bonuses
   * Returns modifier object or null if no immediate effect
   *
   * Example: Night Vision skill might return { visionRange: +5 }
   */
  passiveEffect?: Record<string, number>;

  /**
   * Failure penalty: If false are rolled in a skill check, applies attribute penalty
   * Formula: max(0, 1 - (WIS / 25)) for d20 checks
   */
  failurePenalty: number;

  /** Workstation tier required to learn this skill at School (null = can't be learned in School) */
  workstationTierRequirement: 1 | 2 | 3 | 5 | null;

  /**
   * Learning method: Where this skill can be acquired
   * - "use": Learn through world usage
   * - "school": Learn only at a School workstation
   * - "both": Can be learned either way
   */
  learningMethod: 'use' | 'school' | 'both';

  /** Minute-to-read description for UI/tooltips */
  description: string;

  /** When this skill was first acquired (tick number, null if never used) */
  acquiredAtTick: number | null;

  /** Proficiency multiplier: stacks with INT/WIS bonuses */
  proficiencyBonus: number; // Typically 0-2.0

  /** Whether skill is locked (can't be used/trained until unlocked) */
  isLocked: boolean;
}

/**
 * XP Progress: Tracks progression toward next skill level
 *
 * Handles calculation of:
 * - XP required per level (with soft cap doubling)
 * - INT/WIS multipliers for XP gain
 * - Success/failure XP allocation
 */
export interface XpProgress {
  /** Reference to the skill being trained */
  skillId: string;

  /** Current XP on this level */
  currentXp: number;

  /** Total XP required for next level */
  xpRequiredForNextLevel: number;

  /**
   * Soft cap threshold: Beyond this level, XP required doubles every 5 levels
   * Formula: CurrentLevel + ((INT + WIS) / 2)
   * Calculated externally based on character attributes
   */
  softCap: number;

  /** Multiplier applied to XP gain based on INT */
  intMultiplier: number; // 1 + (INT / 20)

  /** Multiplier applied to XP gain based on WIS */
  wisMultiplier: number; // 1 + (WIS / 25)

  /** Remaining XP to earn before soft cap is exceeded */
  xpUntilSoftCap: number;

  /** Number of levels beyond soft cap (triggers doubling) */
  levelsAboveSoftCap: number;

  /** When this XP progress was last updated (tick number) */
  lastUpdatedAtTick: number;
}

/**
 * Learning Curve Configuration: DSS 01.2 diminishing returns system
 *
 * The learning curve implements the soft cap mechanic:
 * - Below soft cap: XP multiplier from INT/WIS directly applies
 * - At soft cap: 1.0x multiplier (no bonus)
 * - Above soft cap: 2.0x XP required every 5 levels past threshold
 */
export interface LearningCurveConfig {
  /** Base XP required per skill level (typically 1000) */
  baseXpPerLevel: number;

  /** INT/WIS soft cap formula: (INT + WIS) / 2 */
  calculateSoftCap(int: number, wis: number, currentLevel: number): number;

  /** XP multiplier for INT-based learning: 1 + (INT / 20) */
  calculateIntMultiplier(int: number): number;

  /** XP multiplier for WIS-based learning/retention: 1 + (WIS / 25) */
  calculateWisMultiplier(wis: number): number;

  /** XP awarded for failure (typically 0.25x success XP) */
  failureXpMultiplier: number;

  /** XP multiplier when level exceeds soft cap (typically 2.0x required) */
  softCapExceedanceDoubler: number;

  /** How many levels above soft cap before next doubling (typically 5) */
  levelsPerExceedanceStep: number;
}

/**
 * Talent: DSS 01.3 - Passive trait assigned at character creation
 *
 * Talents are permanent, defining characteristics that grant passive bonuses.
 * Each character gets exactly 1 Talent at creation and can unlock 1-2 more through gameplay.
 */
export interface Talent {
  /** Unique talent identifier (e.g., "keen_eye", "lucky_strike") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Multi-line description of talent effects */
  description: string;

  /**
   * Passive bonuses granted by this talent
   * Examples:
   * - { visionRange: 5, perceptionBonus: 1 }
   * - { strikeChance: 0.05, criticalMultiplier: 1.5 }
   * - { xpMultiplier: 1.1, skillLearnSpeed: 1.15 }
   */
  passiveBonuses: Record<string, number>;

  /**
   * Restriction: Which skills/categories does this talent support?
   * If empty array, talent applies universally
   */
  applicableSkillCategories: SkillCategory[];

  /** Whether this talent was chosen at character creation (fixed) or acquired later */
  isCreationTalent: boolean;

  /**
   * Activation criteria: When does this talent trigger?
   * - "passive": Always active
   * - "on_use": Triggered when using associated skill
   * - "conditional": Triggered by specific game state
   */
  activationType: 'passive' | 'on_use' | 'conditional';

  /** Narrative/lore explanation for the talent */
  lore: string;
}

/**
 * Character Skill Set: All skills owned by a character
 *
 * Tracks the collection of learned skills and their current levels.
 * Each character has a skill inventory similar to equipment inventory.
 */
export interface CharacterSkillSet {
  /** Character/Vessel ID this skill set belongs to */
  vesselId: string;

  /** Map of skillId -> Skill for all learned skills */
  skills: Map<string, Skill>;

  /** Talents granted to this character (typically 1-3) */
  talents: Talent[];

  /**
   * Skill categories currently being trained (for School learning)
   * Only characters in "Study State" can actively train at Schools
   */
  currentlyTraining: {
    skillId: string;
    trainingStartTick: number;
    trainingEndTick: number;
  } | null;

  /** When this skill set was last modified */
  lastModifiedAtTick: number;

  /**
   * Total XP earned across all skills (for narrative/progression tracking)
   * Does not affect mechanics, purely cosmetic
   */
  totalXpEarned: number;

  /** Highest skill level this character has achieved across all skills */
  highestSkillLevel: number;
}

/**
 * Skill Check: DSS 01 - Contested skill roll with attributes
 *
 * When a character attempts a skill:
 * - Roll = d20 + (Attribute Modifier) + (Skill Level / 5)
 * - DC = Task difficulty (typically 10-20)
 * - Success: Roll >= DC
 * - Failure: Roll < DC (grants 0.25x XP)
 *
 * Special: If required attribute is too low for the action (e.g., STR 3 using greatsword),
 * apply -5 penalty and 2x stamina cost
 */
export interface SkillCoefficients {
  /** Success threshold modifier from attributes */
  attributeModifier: number;

  /** Success threshold modifier from skill level */
  skillModifier: number;

  /** d20 roll base (1-20) */
  diceRoll: number;

  /** Required attribute value for this action */
  attributeRequirement: number;

  /** Penalty if attribute requirement is not met (-5 to the roll) */
  insufficientAttributePenalty: number;

  /** Stamina cost multiplier if requirement not met (2x normal) */
  insufficientAttributeStaminaMultiplier: number;

  /** Total roll result (d20 + modifiers) */
  totalRoll: number;

  /** Difficulty class: target number to succeed */
  dc: number;

  /** Whether roll was successful (totalRoll >= dc) */
  isSuccess: boolean;

  /** XP awarded (success: base XP, failure: 0.25x base XP) */
  xpAwarded: number;
}

/**
 * Default XP table for skill progression (DSS 01.2)
 * Shows base XP required per level, then multipliers apply
 */
export const DEFAULT_XP_TABLE = [
  // Levels 1-25: Base XP only
  { level: 1, baseXp: 1000 },
  { level: 5, baseXp: 1000 },
  { level: 10, baseXp: 1000 },
  { level: 15, baseXp: 1000 },
  { level: 20, baseXp: 1000 },
  { level: 25, baseXp: 1000 },

  // Levels 26-50: Soft cap zone (depends on INT/WIS)
  // XP multiplier applies linearly
  { level: 30, baseXp: 1000 }, // @ soft cap, 1.0x multiplier becomes active
  { level: 50, baseXp: 1000 },

  // Levels 51+: Post-soft cap doubling
  // Every 5 levels, XP required doubles
  { level: 55, baseXp: 2000 }, // +5 levels beyond soft cap = 2x XP
  { level: 60, baseXp: 2000 },
  { level: 65, baseXp: 4000 }, // +10 levels beyond soft cap = 4x XP
  { level: 70, baseXp: 4000 },
  { level: 75, baseXp: 8000 }, // +15 levels beyond soft cap = 8x XP
] as const;

/**
 * Skill proficiency ranks (for UI/narrative tier system)
 */
export enum SkillProficiency {
  UNTRAINED = 'untrained',        // Level 0
  NOVICE = 'novice',              // Levels 1-10
  APPRENTICE = 'apprentice',      // Levels 11-25
  JOURNEYMAN = 'journeyman',      // Levels 26-50
  EXPERT = 'expert',              // Levels 51-75
  MASTER = 'master',              // Levels 76-100
  LEGENDARY = 'legendary',        // Levels 101+
}

/**
 * Get proficiency tier from skill level
 * @param level Skill level
 * @returns SkillProficiency enum
 */
export function getSkillProficiency(level: number): SkillProficiency {
  if (level === 0) return SkillProficiency.UNTRAINED;
  if (level <= 10) return SkillProficiency.NOVICE;
  if (level <= 25) return SkillProficiency.APPRENTICE;
  if (level <= 50) return SkillProficiency.JOURNEYMAN;
  if (level <= 75) return SkillProficiency.EXPERT;
  if (level <= 100) return SkillProficiency.MASTER;
  return SkillProficiency.LEGENDARY;
}

/**
 * Calculate XP required for next level with soft cap doubling
 * @param currentLevel Current skill level
 * @param softCap Soft cap threshold (from INT/WIS)
 * @param baseXp Base XP per level
 * @returns Total XP required for next level
 */
export function calculateXpRequiredForLevel(
  currentLevel: number,
  softCap: number,
  baseXp: number = 1000
): number {
  if (currentLevel < softCap) {
    // Before soft cap: standard XP
    return baseXp;
  }

  // After soft cap: double every 5 levels
  const levelsAboveCap = currentLevel - Math.floor(softCap);
  const doublingSteps = Math.floor(levelsAboveCap / 5);
  return baseXp * Math.pow(2, doublingSteps);
}
