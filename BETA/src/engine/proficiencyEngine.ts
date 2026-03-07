/**
 * Phase 42: Universal Proficiency System (Learn by Doing)
 *
 * This engine manages the "Skyrim-style" progression where players gain proficiency through usage.
 * Features:
 * - Usage-Based XP granting with anti-abuse measures
 * - Proficiency Levels (0-20 scale: 10=journeyman, 20=master)
 * - Passions (interest multipliers: 0=35%, 1=100%, 2=150%)
 * - Skill Decay (elite skills require maintenance)
 * - Daily Soft Caps (4000 XP per skill per day, then 20% yield)
 * - Stat Bleed (high proficiencies grant passive stat increases)
 * - Botch System (low proficiency + high-tier items = critical failures)
 */

import type { PlayerState, WorldState } from './worldEngine';

// ============= Constants =============

const PROFICIENCY_CATEGORIES = [
  'Blades',      // Swords, axes
  'Blunt',       // Maces, clubs
  'Marksman',    // Bows, crossbows
  'Arcane',      // Spells, magic
  'Stealth',     // Sneaking, sneaking
  'Smithing',    // Weapon/armor crafting
  'Alchemy',     // Potion/reagent crafting
  'Weaving',     // Cloth/leather crafting
  'Artifice',    // Gadget/tool crafting
  'Survival',    // Tracking, gathering
  'Performance'  // Entertainment, persuasion
] as const;

type ProficiencyCategory = typeof PROFICIENCY_CATEGORIES[number];

// XP curve: exponential scale (easy start, hard master)
// Level 0-10: 200 XP/level (foundation)
// Level 10-15: 500 XP/level (journeyman plateau)
// Level 15-20: 1000 XP/level (master grind)
const XP_PER_LEVEL = [
  0, 200, 400, 600, 800, 1000,      // Levels 0-5
  1200, 1400, 1600, 1800, 2000,     // Levels 5-10
  2500, 3000, 3500, 4000, 4500,     // Levels 10-15
  5500, 6500, 7500, 8500, 9500      // Levels 15-20
];

// Stat bleed mapping: proficiency -> stat increases per level
const STAT_BLEED_MAP: Record<ProficiencyCategory, Record<string, number>> = {
  Blades: { str: 0.15, end: 0.1 },      // Blades -> +0.15 STR, +0.1 END per level
  Blunt: { str: 0.2, end: 0.15 },       // Blunt -> +0.2 STR, +0.15 END
  Marksman: { agi: 0.15, perception: 0.1 },  // Marksman -> +0.15 AGI, +0.1 PERCEPTION
  Arcane: { int: 0.2, cha: 0.05 },      // Arcane -> +0.2 INT, +0.05 CHA
  Stealth: { agi: 0.2, perception: 0.15 },   // Stealth -> +0.2 AGI, +0.15 PERCEPTION
  Smithing: { str: 0.1, int: 0.1 },     // Smithing -> mixed stats
  Alchemy: { int: 0.2, cha: 0.05 },     // Alchemy -> +0.2 INT, +0.05 CHA
  Weaving: { agi: 0.1, int: 0.05 },     // Weaving -> +0.1 AGI, +0.05 INT
  Artifice: { int: 0.15, agi: 0.05 },   // Artifice -> +0.15 INT, +0.05 AGI
  Survival: { end: 0.15, perception: 0.1 },  // Survival -> +0.15 END, +0.1 PERCEPTION
  Performance: { cha: 0.2, int: 0.05 }  // Performance -> +0.2 CHA, +0.05 INT
};

// Daily soft cap: earning beyond this per day reduces XP to 20% yield
const DAILY_XP_SOFTCAP = 4000;

// Diminishing returns tracker: same action within time window reduces XP
const ADR_WINDOW_TICKS = 300; // 5 minutes (assuming 60 ticks/second)
const ADR_MAX_REPETITIONS = 5; // After 5 repeats, 0% XP gain
const ADR_REDUCTION_PER_REPEAT = 0.2; // 20% reduction per repeat

// Decay thresholds
const DECAY_LEVEL_THRESHOLD = 10; // Only levels 10+ decay
const DECAY_RATE_PER_DAY = 50; // Points per day (at level 20)

// Challenge thresholds (anti-grind)
const MIN_HP_PERCENT_FOR_XP = 0.05; // Must deal 5% of max HP to grant combat XP
const MIN_LEVEL_RANGE_FOR_CRAFTING = 2; // Craft items within +/- 2 of current proficiency

// Session 4 Anti-Exploit: Global daily XP cap (prevents 11× multiplier abuse)
const GLOBAL_DAILY_XP_SOFTCAP = 8000; // Total XP across ALL proficiencies per day
const TICKS_PER_DAY = 600; // One in-game day = 600 ticks (assuming 10-minute cycle)

// ============= Type Definitions =============

export type ActionSignificanceContext = {
  actionType: 'combat' | 'crafting' | 'social' | 'casting' | 'stealth' | 'gathering';
  actionSuccess?: boolean;            // Session 4: Required for gathering validation
  materialRarity?: 'common' | 'uncommon' | 'rare' | 'epic'; // Session 4: For high-level gathering gates
  targetType?: string;
  damageDealt?: number;
  targetMaxHp?: number;
  itemTier?: number;       // Craft tier vs proficiency level
  reputationShift?: number; // Social XP only
  isRepeat?: boolean;       // Action recently repeated
  timeSinceLastUse?: number; // Ticks since last usage
  proficiencyLevel?: number; // Current level of this proficiency
};

export type ProficiencyDecayConfig = {
  enabled: boolean;
  ticksPerInGameDay: number; // 600 for normal pacing
};

// ============= Core Functions =============

/**
 * Grant proficiency XP with comprehensive anti-abuse checks and passion modifiers
 */
export function grantProficiencyXP(
  profName: ProficiencyCategory,
  baseXpAmount: number,
  player: PlayerState,
  context: ActionSignificanceContext,
  worldState: WorldState,
  tempoMultiplier: number = 1.0,
  template?: any  // Phase 47: Optional world template for ancestry XP multiplier
): boolean {
  // Validate proficiency exists
  if (!PROFICIENCY_CATEGORIES.includes(profName as any)) {
    return false;
  }

  // Initialize proficiency if missing
  if (!player.proficiencies) {
    player.proficiencies = {};
  }
  if (!player.proficiencies[profName]) {
    player.proficiencies[profName] = { xp: 0, level: 0, passion: 1 };
  }

  const profData = player.proficiencies[profName];

  // Step 1: Validate action significance (prevents spam grinding)
  if (!validateActionSignificance(context, profData)) {
    return false;
  }

  // Step 1.5: Session 4 - Check GLOBAL daily cap (prevents 11× multiplier abuse)
  const globalXpYieldMultiplier = checkGlobalDailySoftCap(player, worldState);
  if (globalXpYieldMultiplier === 0) {
    return false; // Hard stop at global cap
  }

  // Step 2: Check daily soft cap (per-proficiency)
  const xpYieldMultiplier = checkDailySoftCap(profData);
  if (xpYieldMultiplier === 0) {
    return false; // Hard stop at per-proficiency cap
  }

  // Step 3: Apply passion multiplier (0=35%, 1=100%, 2=150%)
  const passionMultiplier = [0.35, 1.0, 1.5][profData.passion || 1];

  // Step 4: Phase 47 - Apply ancestry XP multiplier
  let ancestryXpMultiplier = 1.0;
  if (template) {
    // Import dynamically to avoid circular dependency
    try {
      const { getAncestryTree, getAncestryXpMultiplier } = require('./ancestryRegistry');
      const tree = getAncestryTree(template, player.race);
      if (tree) {
        ancestryXpMultiplier = getAncestryXpMultiplier(player, tree);
      }
    } catch (e) {
      // Silently fail if ancestry registry isn't available
      ancestryXpMultiplier = 1.0;
    }
  }

  // Step 5: Calculate final XP
  // Session 4: Apply BOTH per-proficiency AND global multipliers
  let finalXp = Math.round(
    baseXpAmount * tempoMultiplier * xpYieldMultiplier * globalXpYieldMultiplier * passionMultiplier * ancestryXpMultiplier
  );

  // Step 6: Diminishing returns for repeated actions (ADR)
  const adrPenalty = calculateActionDiminishingReturn(profData, context);
  finalXp = Math.round(finalXp * (1 - adrPenalty));

  // Step 7: Award XP and update tracking
  profData.xp += finalXp;
  profData.lastUsageTick = worldState.tick || 0;
  profData.dailyXpEarned = (profData.dailyXpEarned || 0) + finalXp;
  
  // Session 4: Update global daily XP counter
  if (!player.dailyXpEarnedGlobal) {
    player.dailyXpEarnedGlobal = 0;
  }
  player.dailyXpEarnedGlobal += finalXp;

  // Step 8: Check level-up
  const oldLevel = profData.level;
  profData.level = calculateProficiencyLevel(profData.xp);

  // Step 9: Apply stat bleed on level-up
  if (profData.level > oldLevel) {
    applyStatBleed(player, profName, profData.level - oldLevel);
  }

  return true;
}

/**
 * Validate that an action is sufficiently significant to grant XP
 * Prevents "punching walls" or "spamming low-risk actions"
 */
export function validateActionSignificance(
  context: ActionSignificanceContext,
  profData: any
): boolean {
  switch (context.actionType) {
    case 'combat':
      // Must deal 5% of target's max HP to grant XP
      const damagePercent = context.damageDealt && context.targetMaxHp
        ? context.damageDealt / context.targetMaxHp
        : 0;
      if (damagePercent < MIN_HP_PERCENT_FOR_XP) {
        return false; // Insignificant damage, no XP
      }
      break;

    case 'crafting':
      // Item tier must be within +/-2 of current proficiency level
      if (context.itemTier !== undefined && context.proficiencyLevel !== undefined) {
        const tierDiff = Math.abs(context.itemTier - context.proficiencyLevel);
        if (tierDiff > MIN_LEVEL_RANGE_FOR_CRAFTING) {
          return false; // Out of optimal range
        }
      }
      break;

    case 'social':
      // Reputation shift must occur (no "Hello" spam)
      if ((context.reputationShift || 0) === 0) {
        return false;
      }
      break;

    case 'casting':
      // Spells at 0 AP cost grant 0 XP (no spam cast)
      if ((context.damageDealt || 0) === 0 && (context.reputationShift || 0) === 0) {
        return false;
      }
      break;

    case 'stealth':
      // Any action of this type is valid
      break;

    case 'gathering':
      // Session 4 Fix #2: CRITICAL — Only grant XP on successful harvest
      // This eliminates 50% of spam farming (which was granting XP on failures)
      if (!context.actionSuccess) {
        return false; // Failed harvest = no XP, no significance
      }
      
      // High-level players need rarer materials to keep progressing
      // Prevents infinite grinding on basic materials
      if (context.proficiencyLevel && context.proficiencyLevel > 12) {
        const materialRarity = context.materialRarity || 'common';
        // At Level 13+, require at least uncommon materials
        if (materialRarity === 'common') {
          return false; // Common materials don't grant XP at high levels
        }
      }
      
      if (context.proficiencyLevel && context.proficiencyLevel > 17) {
        const materialRarity = context.materialRarity || 'common';
        // At Level 18+, require rare or better
        if (materialRarity !== 'rare' && materialRarity !== 'epic') {
          return false; // Only rare/epic grant XP at very high levels
        }
      }
      break;
  }

  return true;
}

/**
 * Check daily soft cap and return XP yield multiplier (1.0 = normal, 0.2 = soft-cap, 0 = hard-stop)
 */
export function checkDailySoftCap(profData: any): number {
  const dailyXp = profData.dailyXpEarned || 0;

  if (dailyXp >= DAILY_XP_SOFTCAP * 1.5) {
    return 0; // Hard stop at 1.5x cap
  }
  if (dailyXp >= DAILY_XP_SOFTCAP) {
    return 0.2; // 20% yield in soft-cap zone
  }
  return 1.0; // Normal yield
}

/**
 * Session 4: Check GLOBAL daily soft cap across ALL proficiencies
 * Returns XP yield multiplier (1.0 = normal, 0.2 = soft-cap, 0 = hard-stop)
 * This prevents players from earning 88,000 XP/day by multiplying per-proficiency caps
 */
export function checkGlobalDailySoftCap(player: any, worldState: any): number {
  // Initialize global XP tracking if missing
  if (!player.dailyXpEarnedGlobal) {
    player.dailyXpEarnedGlobal = 0;
    player.dailyXpResetTick = worldState?.tick ?? 0;
  }

  // Reset global counter if new day
  if (worldState && worldState.tick !== undefined) {
    const ticksSinceReset = (worldState.tick - (player.dailyXpResetTick ?? 0));
    if (ticksSinceReset >= TICKS_PER_DAY) {
      player.dailyXpEarnedGlobal = 0;
      player.dailyXpResetTick = worldState.tick;
    }
  }

  // Check global cap
  const globalXp = player.dailyXpEarnedGlobal || 0;
  
  if (globalXp >= GLOBAL_DAILY_XP_SOFTCAP * 1.5) {
    return 0; // Hard stop at 12,000 XP (1.5× global cap)
  }
  if (globalXp >= GLOBAL_DAILY_XP_SOFTCAP) {
    return 0.2; // 20% yield in soft-cap zone (8,000-12,000 XP)
  }
  return 1.0; // Normal yield (0-8,000 XP)
}

/**
 * Calculate action diminishing returns (same action in same time window)
 */
export function calculateActionDiminishingReturn(
  profData: any,
  context: ActionSignificanceContext
): number {
  if (!context.isRepeat || context.timeSinceLastUse === undefined) {
    return 0; // No penalty
  }

  // If action is recent (within ADR window), apply penalty
  if (context.timeSinceLastUse < ADR_WINDOW_TICKS) {
    const botchStreak = profData.botchStreak || 0;
    const penalty = Math.min(botchStreak * ADR_REDUCTION_PER_REPEAT, 1.0);
    return penalty; // Up to 100% penalty
  }

  // Reset streak if enough time has passed
  profData.botchStreak = 0;
  return 0;
}

/**
 * Convert total XP to proficiency level (0-20 scale)
 */
export function calculateProficiencyLevel(totalXp: number): number {
  let currentXp = 0;
  for (let level = 0; level < 20; level++) {
    const xpNeeded = XP_PER_LEVEL[level + 1] - currentXp;
    if (totalXp < xpNeeded) {
      return level;
    }
    currentXp += xpNeeded;
  }
  return 20; // Max level
}

/**
 * Apply stat bleed: high proficiencies grant passive stat increases
 */
export function applyStatBleed(
  player: PlayerState,
  profCategory: ProficiencyCategory,
  levelGain: number
): void {
  if (!player.stats) {
    player.stats = { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  }

  const statBoosts = STAT_BLEED_MAP[profCategory];
  for (const [stat, boostPerLevel] of Object.entries(statBoosts)) {
    const boost = Math.round(boostPerLevel * levelGain * 10) / 10; // 1 decimal place
    (player.stats as any)[stat] = ((player.stats as any)[stat] || 10) + boost;
  }
}

/**
 * Apply skill decay: maintenance required for elite skills (levels 10+)
 */
export function applySkillDecay(player: PlayerState, ticksPerDay: number): void {
  if (!player.proficiencies) return;

  const currentTick = (Math.floor(Date.now() / 1000) / 60) | 0; // Approximate ticks

  for (const [profName, profData] of Object.entries(player.proficiencies)) {
    if (profData.level < DECAY_LEVEL_THRESHOLD) {
      continue; // No decay below level 10
    }

    if (!profData.lastUsageTick) {
      profData.lastUsageTick = currentTick;
      continue;
    }

    // Calculate days since last use
    const ticksSinceUse = currentTick - (profData.lastUsageTick || 0);
    const daysSinceUse = ticksSinceUse / ticksPerDay;

    // Decay accelerates at higher levels: Level 20 = 2x decay rate
    const decayMultiplier = 1 + (profData.level - DECAY_LEVEL_THRESHOLD) / 10;
    const xpLoss = Math.round(DECAY_RATE_PER_DAY * daysSinceUse * decayMultiplier);

    profData.xp = Math.max(0, profData.xp - xpLoss);
    const newLevel = calculateProficiencyLevel(profData.xp);

    // Clear stat bleed on downgrade (recalculate all stats)
    if (newLevel < profData.level) {
      profData.level = newLevel;
    }
  }
}

/**
 * Calculate effectiveness multiplier for universal equipment usage
 * Formula: (CurrentProficiency / RequiredTier) ^ 1.5, clamped to [0.1, 1.5]
 */
export function calculateEquipmentEffectiveness(
  currentProfLevel: number,
  requiredTier: number
): number {
  if (requiredTier === 0) return 1.0; // No requirement

  const ratio = Math.max(0.1, currentProfLevel / requiredTier);
  const effectiveness = Math.pow(ratio, 1.5);

  return Math.min(Math.max(effectiveness, 0.1), 1.5); // Clamp [0.1, 1.5]
}

/**
 * Handle botched action: critical failure for low proficiency + high tier
 */
export function shouldBotch(
  currentProfLevel: number,
  itemTier: number,
  state: WorldState
): boolean {
  const tierGap = Math.max(0, itemTier - currentProfLevel);

  // Each tier gap = 15% botch chance
  const botchChance = Math.min(0.9, tierGap * 0.15);

  const roll = Math.random();
  if (roll < botchChance) {
    // Botch occurred
    return true;
  }

  return false;
}

/**
 * Passions: interest multipliers for specific proficiencies
 * Players may have 1-2 passionate skills that grant 150% XP
 */
export function setPlayerPassion(
  player: PlayerState,
  profName: ProficiencyCategory,
  passion: 0 | 1 | 2
): void {
  if (!player.proficiencies) {
    player.proficiencies = {};
  }
  if (!player.proficiencies[profName]) {
    player.proficiencies[profName] = { xp: 0, level: 0 };
  }

  player.proficiencies[profName].passion = passion;
}

/**
 * Get total effective stats after stat bleed is applied
 */
export function getEffectiveStats(player: PlayerState): Record<string, number> {
  if (!player.stats) {
    return { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  }

  return { ...player.stats };
}

/**
 * Get proficiency summary for UI display
 */
export function getProficiencySummary(player: PlayerState): Array<{
  category: ProficiencyCategory;
  level: number;
  xp: number;
  passion: 0 | 1 | 2;
  percentToNextLevel: number;
  xpToNextLevel: number;
  isDecaying: boolean;
  currentTick?: number;
}> {
  if (!player.proficiencies) return [];

  // Get current tick for decay calculation
  const currentTick = Math.floor(Date.now() / 1000);
  const DECAY_CHECK_HOURS = 24;
  const TICKS_PER_CHECK = DECAY_CHECK_HOURS * 3600; // 24 hours in seconds

  return PROFICIENCY_CATEGORIES.map(cat => {
    const prof = player.proficiencies![cat as string];
    if (!prof) {
      return {
        category: cat,
        level: 0,
        xp: 0,
        passion: 1,
        percentToNextLevel: 0,
        xpToNextLevel: XP_PER_LEVEL[1] - 0,
        isDecaying: false,
        currentTick
      };
    }

    const currentLevelXp = prof.level > 0 ? XP_PER_LEVEL[prof.level] : 0;
    const nextLevelXp = prof.level < 20 ? XP_PER_LEVEL[prof.level + 1] : XP_PER_LEVEL[20];
    const xpInLevel = prof.xp - currentLevelXp;
    const xpToLevel = nextLevelXp - currentLevelXp;
    const percentToNextLevel = xpToLevel > 0 ? (xpInLevel / xpToLevel) * 100 : 100;

    // Calculate if skill is decaying (level >= 10 and not used in 24 hours)
    const isElite = prof.level >= 10;
    const lastUsedRecently = prof.lastUsageTick && (currentTick - prof.lastUsageTick) < TICKS_PER_CHECK;
    const isDecaying = isElite && !lastUsedRecently && prof.level < 20;

    return {
      category: cat,
      level: prof.level,
      xp: prof.xp,
      passion: prof.passion || 1,
      percentToNextLevel: Math.min(100, Math.max(0, percentToNextLevel)),
      xpToNextLevel: xpToLevel,
      isDecaying,
      currentTick
    };
  });
}

/**
 * Phase 46: Grant discovery XP for blind fusing new recipes
 * Provides bonus XP when players discover recipes they haven't seen before
 */
export function grantDiscoveryXP(
  player: PlayerState,
  worldState: WorldState,
  proficiencyType: ProficiencyCategory,
  baseDiscoveryXp: number = 40,
  isNewDiscovery: boolean = false
): { newState: PlayerState; xpGranted: number } {
  if (!player.proficiencies) {
    player.proficiencies = {};
  }

  if (!player.proficiencies[proficiencyType]) {
    player.proficiencies[proficiencyType] = { xp: 0, level: 0, passion: 1 };
  }

  const profData = player.proficiencies[proficiencyType];

  // Discovery XP multiplier: +50% if recipe is genuinely new
  const discoveryMultiplier = isNewDiscovery ? 1.5 : 1.0;
  const passionMultiplier = [0.35, 1.0, 1.5][profData.passion || 1];

  // Calculate final XP
  let xpToGrant = Math.round(baseDiscoveryXp * discoveryMultiplier * passionMultiplier);

  // Update proficiency
  profData.xp += xpToGrant;
  profData.lastUsageTick = worldState.tick || 0;
  profData.dailyXpEarned = (profData.dailyXpEarned || 0) + xpToGrant;

  // Level-up check
  const oldLevel = profData.level;
  profData.level = calculateProficiencyLevel(profData.xp);

  // Apply stat bleed on level-up
  if (profData.level > oldLevel) {
    applyStatBleed(player, proficiencyType, profData.level - oldLevel);
  }

  return {
    newState: player,
    xpGranted: xpToGrant
  };
}

export { PROFICIENCY_CATEGORIES };
export type { ProficiencyCategory };
