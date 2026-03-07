/**
 * Reincarnation Layer (DSS 03.2, 16: Ancestral Echoes & Soul Persistence)
 *
 * Handles death and rebirth mechanics, ancestral memory retention,
 * and the Causal Vault (legacy storage across reincarnation cycles).
 */

import type { Vessel, VitalStats } from './vessels';
import type { CharacterSkillSet, Skill } from './skills';

/**
 * PlayerSoul: Persistent identity across reincarnation cycles
 * Each player account has one soul that bridges character deaths
 */
export interface PlayerSoul {
  /** Unique soul identifier (persists across all reincarnations) */
  id: string;

  /** Associated player account ID */
  playerId: string;

  /** List of all vessels this soul has inhabited */
  vesselLineage: VesselIncarnation[];

  /** Total ancestral echo points accumulated */
  totalAncestralEchoPoints: number;

  /** Current ancestral echo points available */
  availableAncestralEchoPoints: number;

  /** Lifetime achievements (persist across deaths) */
  lifetimeAchievements: Achievement[];

  /** Total lifetimes lived */
  incarnationCount: number;

  /** When soul was created */
  createdAt: number;

  /** Causal vault IDs associated with this soul */
  causalVaultIds: string[];

  /** Inherited lineage modifiers (from Genesis Template or prior vessels) */
  inheritedModifiers: {
    matriarchalLineageBonus: number;
    factionReputationBonus: number;
    skillXpBonus: number;
  };

  /** Current paradox debt (carries over across deaths) */
  currentParadoxDebt: number;

  /** Whether soul is in "Causal Lock" (72-hour death lock) */
  inCausalLock: boolean;

  /** When causal lock expires (null if not locked) */
  causalLockExpires?: number;

  /** Total time in lock cycles */
  lockTicks: number;
}

/**
 * VesselIncarnation: Record of one lifetime
 */
export interface VesselIncarnation {
  /** The vessel ID */
  vesselId: string;

  /** Vessel name */
  vesselName: string;

  /** Ancestry of this vessel */
  ancestry: string;

  /** When incarnation started */
  incarnationStarted: number;

  /** When incarnation ended (death/reset) */
  incarnationEnded?: number;

  /** Lifespan in ticks */
  lifespan?: number;

  /** Peak level reached */
  peakLevel: number;

  /** Cause of death or reset */
  terminationCause?: VesselTerminationCause;

  /** Achievements during this lifetime */
  achievements: Achievement[];

  /** Final skill levels (captured at death) */
  finalSkills: {
    skillId: string;
    level: number;
    xp: number;
  }[];

  /** XP that was inherited by next vessel */
  xpInherited: {
    skillId: string;
    amount: number;
  }[];

  /** Faction reputation inherited */
  reputationInherited: {
    factionId: string;
    amount: number;
  }[];

  /** Final inventory value (for statistics) */
  inventoryValue: number;

  /** Final paradox debt state */
  finalParadoxDebt: number;

  /** Ancestral echo points earned this lifetime */
  echoPointsEarned: number;

  /** Notes/lore about this incarnation */
  epitaph?: string;
}

/**
 * Vessel termination causes
 */
export enum VesselTerminationCause {
  /** Vessel HP reached 0 and conservation check failed */
  DEATH = 'death',

  /** Paradox debt reached 100% (Reality Fault) */
  PARADOX_RESET = 'paradox-reset',

  /** Player voluntarily reset character */
  VOLUNTARY_RESET = 'voluntary-reset',

  /** Admin intervention */
  ADMIN_PURGE = 'admin-purge',

  /** World rewind event (shared disaster) */
  WORLD_REWIND = 'world-rewind',

  /** Anarchy fallout (world reset) */
  ANARCHY_RESET = 'anarchy-reset',

  /** Character aged out (reached max level 99) */
  ASCENSION = 'ascension',

  /** Mysterious/unknown (error state) */
  UNKNOWN = 'unknown',
}

/**
 * Achievement: Permanent record of accomplishment
 */
export interface Achievement {
  /** Achievement ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** When achieved */
  achievedAtTick: number;

  /** Value (for scaling echo points) */
  value: number;

  /** Whether this achievement carries over to next life */
  isPersistent: boolean;

  /** Rarity tier (affects echo point scaling) */
  tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/**
 * AncestralEchoPoint: Point system for character progression across deaths
 *
 * Players earn echo points based on achievements. These can be spent to
 * "flash learn" skills in new vessels (10x XP gain for first 10 levels)
 */
export interface AncestralEchoPoint {
  /** Unique echo point ID */
  id: string;

  /** Source vessel (who earned this) */
  sourceVesselId: string;

  /** Generation (which lifetime) */
  generation: number;

  /** How many XP this point represents */
  xpValue: number;

  /** Skill this echo is for */
  skillId: string;

  /** Whether point has been spent */
  isSpent: boolean;

  /** Vessels that have used this echo */
  usedByVessels?: string[];

  /** Total uses remaining */
  usesRemaining: number;

  /** When echo point was created */
  createdAt: number;

  /** When echo point expires (null = never) */
  expiresAt?: number;

  /** Special modifier (if rare achievement) */
  modifier?: number;
}

/**
 * VesselRebinding: Process of soul attaching to new vessel after death
 */
export interface VesselRebinding {
  /** Unique rebinding transaction ID */
  id: string;

  /** Soul being rebound */
  soulId: string;

  /** Previous vessel (the one that died) */
  previousVesselId: string;

  /** New vessel (the one being reborn into) */
  newVesselId: string;

  /** Ancestry of new vessel */
  newAncestry: string;

  /** Tick when rebinding occurred */
  rebindingTick: number;

  /** Whether rebinding was successful */
  isSuccessful: boolean;

  /** XP retained from previous life */
  skillXpRetained: {
    skillId: string;
    amount: number;
  }[];

  /** Reputation retained from previous life */
  reputationRetained: {
    factionId: string;
    amount: number;
  }[];

  /** Items retrieved from causal vault */
  itemsRetrieved: string[];

  /** Ancestral echo points used during rebinding */
  echoPointsUsed: number;

  /** Echo points applied to skills */
  echoPointsApplied: {
    skillId: string;
    pointsApplied: number;
  }[];

  /** Paradox debt transferred */
  paradoxDebtTransferred: number;

  /** Notes about rebinding */
  notes?: string;
}

/**
 * Reincarnation Configuration: Customizable retention rules per world
 */
export interface ReincarnationConfig {
  /** Base XP retention percentage (0-100) */
  baseXpRetentionPercent: number;

  /** Base reputation retention percentage (0-100) */
  baseReputationRetentionPercent: number;

  /** Base achievement retention (true/false) */
  retainAchievements: boolean;

  /** Base skill retention percentage */
  baseSkillRetentionPercent: number;

  /** Maximum ancestral echo points per lifetime */
  maxEchoPointsPerLifetime: number;

  /** XP multiplier when using ancestral echoes */
  echoXpMultiplier: number;

  /** Duration of causal lock after death (in ticks) */
  causalLockDurationTicks: number;

  /** Whether paradox debt carries over */
  paradoxDebtCarries: boolean;

  /** Paradox debt reduction on new vessel (%) */
  paradoxDebtReductionPercent: number;

  /** Maximum items allowed in causal vault */
  maxCausalVaultItems: number;

  /** Fuel cost per tick to maintain vault */
  vaultMaintenanceFuelPerTick: number;

  /** Whether new vessels start with base attributes or inherited modifiers */
  useInheritedAttributes: boolean;

  /** Custom skill xp retention per skill (overrides base) */
  customSkillRetention?: {
    skillId: string;
    retentionPercent: number;
  }[];
}

/**
 * Causal Lock: 72-hour death lock preventing immediate resurrection attempts
 * (DSS 02.2.1: Prevents save-scumming via rapid reincarnation)
 */
export interface CausalLock {
  /** Soul that is locked */
  soulId: string;

  /** Vessel that triggered the lock (died) */
  triggeredByVesselId: string;

  /** Tick when lock started */
  lockStartTick: number;

  /** Tick when lock expires */
  lockExpiresTick: number;

  /** Reason for lock */
  reason: VesselTerminationCause;

  /** Events during the lock (for audit) */
  auditTrail: {
    tick: number;
    event: string;
    details?: Record<string, any>;
  }[];

  /** Whether lock was broken early (admin) */
  wasBrokenEarly?: boolean;

  /** If broken early, who authorized it */
  brokenByAdminId?: string;
}

/**
 * Flash Learning Session: Using ancestral echoes to accelerate skill learning
 */
export interface FlashLearningSession {
  /** Session ID */
  id: string;

  /** Vessel performing flash learning */
  vesselId: string;

  /** Skill being learned */
  skillId: string;

  /** Ancestral echo points used */
  echoPointsUsed: number;

  /** XP multiplier (typically 10x) */
  multiplier: number;

  /** Starting XP */
  startingXp: number;

  /** Ending XP (max 10 levels) */
  endingXp: number;

  /** Levels gained */
  levelsGained: number;

  /** When session occurred */
  sessionStartTick: number;

  /** Duration in ticks */
  sessionDurationTicks: number;

  /** Notes */
  notes?: string;
}

/**
 * Ancestral Echo Point: Calculation formula for echo points earned from achievements
 *
 * Formula:
 *   Base = AchievementValue * (Level / 99)
 *   RarityBonus = 1 + (RarityTier * 0.25)  // Legendary = 1.75x multiplier
 *   FinalEchos = Base * RarityBonus * (1 + SkillLevelFraction)
 */
export const ECHO_POINT_FORMULA = {
  /** Base multiplier per achievement value point */
  baseMultiplier: 1.0,

  /** Rarity tier multipliers */
  rarityMultipliers: {
    common: 1.0,
    uncommon: 1.25,
    rare: 1.5,
    epic: 1.75,
    legendary: 2.0,
  },

  /** Level scaling (max at level 99) */
  levelScalingExponent: 1.5,

  /** Bonus for reaching milestones */
  milestoneBonuses: {
    'level-10': 50,
    'level-50': 200,
    'level-99': 500,
    'first-faction-major': 75,
    'divine-covenant': 100,
    'skill-mastery': 150,
  },

  /** Penalty for dying early (scales with level) */
  deathPenaltyFactor: 0.1,

  /** Cap on echo points per lifetime */
  maxPerLifetime: 500,
};

/**
 * Skill XP Retention: How much XP carries over to next life
 *
 * Formula:
 *   Retention = BaseRetentionPercent * (1 - ParadoxDebtFraction) * RarityMultiplier
 *   Capped at 25% (to prevent power creep in legacy play)
 */
export const SKILL_XP_RETENTION_FORMULA = {
  /** Base retention percentage (0-100) */
  baseRetention: 25,

  /** Paradox debt penalty (1% reduction per 1% debt) */
  paradoxDebtPenalty: 1.0,

  /** Maximum retention percentage */
  maxRetentionPercent: 25,

  /** Minimum retention percentage */
  minRetentionPercent: 5,

  /** Rarity multipliers for rare skills */
  rarityMultipliers: {
    common: 1.0,
    uncommon: 1.1,
    rare: 1.2,
    epic: 1.3,
    legendary: 1.5,
  },

  /** Skill categories with custom retention */
  customRetention: {
    'melee_combat': 0.25, // 25%
    'magic': 0.2, // 20%
    'stealth': 0.3, // 30%
    'survival': 0.4, // 40%
    'prophecy': 0.15, // 15%
  },
};

/**
 * Reputation Inheritance: How much faction rep carries over to next life
 *
 * Formula:
 *   InheritedRep = CurrentRep * RetentionPercent * FactionAffinity
 *   Capped at 10% (to prevent legacy factions locking out new players)
 */
export const REPUTATION_INHERITANCE_FORMULA = {
  /** Base retention percentage (0-100) */
  baseRetention: 10,

  /** Maximum inherited reputation at rebirth */
  maxInherited: 10,

  /** Minimum inherited reputation (to prevent total loss) */
  minInherited: 0,

  /** Faction affinity multipliers (based on alignment) */
  affinityMultipliers: {
    hostile: 0.0, // No inheritance if hostile
    neutral: 0.5,
    friendly: 1.0,
    allied: 1.5,
  },

  /** Paradox debt effect */
  paradoxDebtPenalty: 0.5, // Reduce by 50% per full paradox debt unit
};

/**
 * Create a new player soul at character creation
 */
export function createPlayerSoul(playerId: string): PlayerSoul {
  return {
    id: `soul-${playerId}-${Date.now()}`,
    playerId,
    vesselLineage: [],
    totalAncestralEchoPoints: 0,
    availableAncestralEchoPoints: 0,
    lifetimeAchievements: [],
    incarnationCount: 0,
    createdAt: Date.now(),
    causalVaultIds: [],
    inheritedModifiers: {
      matriarchalLineageBonus: 0,
      factionReputationBonus: 0,
      skillXpBonus: 0,
    },
    currentParadoxDebt: 0,
    inCausalLock: false,
    lockTicks: 0,
  };
}

/**
 * Record a vessel incarnation when character dies
 */
export function recordVesselIncarnation(
  vessel: Vessel,
  terminationCause: VesselTerminationCause,
  achievements: Achievement[],
  finalSkills: CharacterSkillSet,
  lifespan: number
): VesselIncarnation {
  const skillRecords = Object.entries(finalSkills)
    .filter(([_, skill]) => skill)
    .map(([skillId, skill]) => ({
      skillId,
      level: skill!.level,
      xp: skill!.currentXp,
    }));

  return {
    vesselId: vessel.id,
    vesselName: vessel.name,
    ancestry: vessel.ancestry,
    incarnationStarted: vessel.createdAtTick,
    incarnationEnded: vessel.createdAtTick + lifespan,
    lifespan,
    peakLevel: vessel.level,
    terminationCause,
    achievements,
    finalSkills: skillRecords,
    xpInherited: [],
    reputationInherited: [],
    inventoryValue: 0,
    finalParadoxDebt: 0,
    echoPointsEarned: 0,
  };
}

/**
 * Calculate ancestral echo points from achievement
 */
export function calculateEchoPoints(
  achievement: Achievement,
  vesselLevel: number
): number {
  const rarityMultiplier =
    ECHO_POINT_FORMULA.rarityMultipliers[achievement.tier] || 1.0;
  const levelFraction = Math.pow(vesselLevel / 99, ECHO_POINT_FORMULA.levelScalingExponent);
  const base =
    achievement.value * ECHO_POINT_FORMULA.baseMultiplier * (1 + levelFraction);
  const withRarity = base * rarityMultiplier;
  return Math.min(withRarity, ECHO_POINT_FORMULA.maxPerLifetime);
}

/**
 * Calculate retained XP for skill in next life
 */
export function calculateRetainedXp(
  currentXp: number,
  skillLevel: number,
  paradoxDebt: number,
  customRetention?: number
): number {
  const baseRetention =
    customRetention !== undefined
      ? customRetention
      : SKILL_XP_RETENTION_FORMULA.baseRetention / 100;

  const paradoxPenalty = 1 - (paradoxDebt / 100) * SKILL_XP_RETENTION_FORMULA.paradoxDebtPenalty;
  const effective = Math.max(
    SKILL_XP_RETENTION_FORMULA.minRetentionPercent / 100,
    Math.min(SKILL_XP_RETENTION_FORMULA.maxRetentionPercent / 100, baseRetention * paradoxPenalty)
  );

  return currentXp * effective;
}

/**
 * Calculate causal lock expiration tick
 */
export function calculateCausalLockExpiration(
  startTick: number,
  config: ReincarnationConfig
): number {
  return startTick + config.causalLockDurationTicks;
}

/**
 * Reincarnation constants
 */
export const REINCARNATION_CONSTANTS = {
  /** 72-hour causal lock duration (in ticks) */
  CAUSAL_LOCK_DURATION_TICKS: 172800, // 72 hours * 3600 ticks/hour / 1.5 seconds per tick

  /** Default causal lock duration in real seconds */
  CAUSAL_LOCK_DURATION_SECONDS: 259200, // 72 hours

  /** Maximum incarnations per soul */
  MAX_INCARNATIONS: 1000,

  /** Echo point flash learning XP multiplier */
  FLASH_LEARNING_MULTIPLIER: 10,

  /** Maximum flash learning levels per skill */
  FLASH_LEARNING_MAX_LEVELS: 10,

  /** Vault maintenance cost per tick */
  VAULT_FUEL_COST_PER_TICK: 1,

  /** Maximum active causal vaults per soul */
  MAX_VAULTS_PER_SOUL: 3,

  /** Items expire from vault after this many ticks if not accessed */
  VAULT_ITEM_EXPIRY_TICKS: 2592000, // 30 days
};
