/**
 * Phase 13: Vessel & Essence (Character Morphing & Soul Strain)
 * 
 * The morphing system allows players to change their race/form, but at a cost:
 * transformations consume "Soul Strain" which accumulates and exacerbates
 * Paradox effects. Core mechanics:
 * 
 * - calculateMorphCost(): Returns stat changes and soul strain cost for morphing
 * - performRitual(): Triggers a "Resonance Challenge" (ATT + END check)
 * - handleMorphSuccess(): Apply stat changes and soul strain on success
 * - handleMorphFailure(): Trigger VESSEL_SHATTER on critical failure
 */

import type { WorldState } from './worldEngine';
import { random } from './prng';

export interface CharacterStats {
  str: number;
  agi: number;
  int: number;
  cha: number;
  end: number;
  luk: number;
}

/**
 * Racial stat bases (pre-customization)
 */
export const RACIAL_BASE_STATS: Record<string, Partial<CharacterStats>> = {
  'human': { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
  'elf': { str: 8, agi: 12, int: 12, cha: 11, end: 10, luk: 10 },
  'high-elf': { str: 8, agi: 10, int: 14, cha: 12, end: 9, luk: 11 },
  'dark-elf': { str: 8, agi: 12, int: 12, cha: 10, end: 8, luk: 12 },
  'dwarf': { str: 13, agi: 8, int: 10, cha: 9, end: 12, luk: 9 },
  'beastkin': { str: 12, agi: 12, int: 9, cha: 9, end: 12, luk: 10 },
  'succubus': { str: 9, agi: 12, int: 12, cha: 14, end: 9, luk: 9 },
  'sanguinarian': { str: 12, agi: 12, int: 12, cha: 12, end: 8, luk: 9 }
};

/**
 * Soul strain cost for morphing between races
 * Base cost + multiplier for cursed races (Succubi, Sanguinarians)
 */
export const MORPH_SOUL_STRAIN_COSTS: Record<string, number> = {
  'human→elf': 8,
  'human→dwarf': 12,
  'elf→human': 8,
  'elf→dwarf': 15,
  'dwarf→human': 12,
  'dwarf→elf': 15,
  'human→succubus': 25,    // Cursed transformation
  'succubus→human': 30,    // Cursed reversal also costs
  'human→sanguinarian': 25, // Cursed transformation
  'sanguinarian→human': 30, // Cursed reversal also costs
};

export interface MorphResult {
  success: boolean;
  statChanges: Partial<CharacterStats>;
  soulStrainGain: number;
  eventType: string; // MORPH_SUCCESS, MORPH_FAILURE, VESSEL_SHATTER
  description: string;
  essenceAltar: string; // Location where morph occurred
}

export interface RitualChallenge {
  difficulty: number;  // 0-100, based on soul strain + morph complexity
  requiredInt: number; // Intelligence check needed
  requiredEnd: number; // Endurance check needed
  successChance: number; // 0-100, calculated from player stats
}

/**
 * Calculate the cost of morphing between two forms
 * Returns stat changes and soul strain required
 */
export function calculateMorphCost(
  currentRace: string,
  targetRace: string,
  currentStats: CharacterStats,
  currentSoulStrain: number
): { statChanges: Partial<CharacterStats>; soulStrainCost: number; isValid: boolean } {
  const morphKey = `${currentRace}→${targetRace}`;
  const baseCost = MORPH_SOUL_STRAIN_COSTS[morphKey];
  
  if (!baseCost) {
    return { statChanges: {}, soulStrainCost: 0, isValid: false };
  }

  // Soul strain already at 90+? Morphing becomes unpredictable and costs more
  const strainMultiplier = currentSoulStrain >= 90 ? 1.5 : currentSoulStrain >= 70 ? 1.25 : 1;
  const totalCost = Math.floor(baseCost * strainMultiplier);

  // Calculate new stat baseline from target race
  const targetBase = RACIAL_BASE_STATS[targetRace] || RACIAL_BASE_STATS['human'];
  const currentBase = RACIAL_BASE_STATS[currentRace] || RACIAL_BASE_STATS['human'];

  // Stat changes reflect racial shift
  const statChanges: Partial<CharacterStats> = {};
  let changed = 0;

  // STR change based on racial strength difference
  const strDiff = (targetBase.str || 10) - (currentBase.str || 10);
  if (strDiff !== 0) {
    statChanges.str = Math.max(1, currentStats.str + strDiff);
    changed++;
  }

  // AGI change
  const agiDiff = (targetBase.agi || 10) - (currentBase.agi || 10);
  if (agiDiff !== 0) {
    statChanges.agi = Math.max(1, currentStats.agi + agiDiff);
    changed++;
  }

  // INT change
  const intDiff = (targetBase.int || 10) - (currentBase.int || 10);
  if (intDiff !== 0) {
    statChanges.int = Math.max(1, currentStats.int + intDiff);
    changed++;
  }

  // CHA change
  const chaDiff = (targetBase.cha || 10) - (currentBase.cha || 10);
  if (chaDiff !== 0) {
    statChanges.cha = Math.max(1, currentStats.cha + chaDiff);
    changed++;
  }

  // END change (affected by morph strain)
  const endDiff = (targetBase.end || 10) - (currentBase.end || 10);
  if (endDiff !== 0) {
    statChanges.end = Math.max(1, currentStats.end + endDiff);
    changed++;
  }

  // LUK change
  const lukDiff = (targetBase.luk || 10) - (currentBase.luk || 10);
  if (lukDiff !== 0) {
    statChanges.luk = Math.max(1, currentStats.luk + lukDiff);
    changed++;
  }

  const isValid = totalCost + currentSoulStrain <= 100; // Can't exceed max soul strain

  return { statChanges, soulStrainCost: totalCost, isValid };
}

/**
 * Generate a Resonance Challenge for a morphing ritual
 * Success depends on INT (focus) and END (stamina)
 * High soul strain makes the challenge harder
 */
export function generateRitualChallenge(
  state: WorldState,
  targetRace: string,
  essenceAltarPower: number = 0.7 // 0-1, strength of the Essence Altar
): RitualChallenge {
  const playerStats = state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  const soulStrain = state.player.soulStrain || 0;

  // Base difficulty: 30 + soul strain influence + altar power
  const baseDifficulty = 30 + soulStrain * 0.4;
  const difficulty = Math.floor(baseDifficulty * (1 - essenceAltarPower * 0.3));

  // Required stats scale with difficulty
  const requiredInt = Math.max(5, difficulty / 3);
  const requiredEnd = Math.max(5, difficulty / 2.5);

  // Success chance: player's INT + END vs required values
  const intBonus = Math.max(0, (playerStats.int || 10) - requiredInt);
  const endBonus = Math.max(0, (playerStats.end || 10) - requiredEnd);
  const luckBonus = (playerStats.luk || 10) - 10; // Luck provides +1% per point above 10

  const baseChance = 50 + intBonus * 3 + endBonus * 2 + luckBonus;
  const successChance = Math.min(95, Math.max(5, baseChance));

  return {
    difficulty,
    requiredInt,
    requiredEnd,
    successChance
  };
}

/**
 * Perform a morphing ritual at an Essence Altar
 * Returns success/failure and generates appropriate events
 */
export function performRitualCheck(
  state: WorldState,
  challenge: RitualChallenge
): { success: boolean; rolled: number; passMargin: number } {
  const playerStats = state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  
  // Roll 1d100 with modifiers
  const roll = Math.floor(random() * 100);
  const intMod = Math.max(0, (playerStats.int || 10) - challenge.requiredInt / 2);
  const endMod = Math.max(0, (playerStats.end || 10) - challenge.requiredEnd / 2);
  const modifiedRoll = roll + intMod + endMod;

  const success = modifiedRoll >= challenge.difficulty;
  const passMargin = modifiedRoll - challenge.difficulty;

  return { success, rolled: modifiedRoll, passMargin };
}

/**
 * Handle successful morph: apply stat changes and soul strain
 */
export function handleMorphSuccess(
  state: WorldState,
  morphResult: MorphResult
): MorphResult {
  // Soul strain increase (capped at 100)
  const newSoulStrain = Math.min(100, (state.player.soulStrain || 0) + morphResult.soulStrainGain);

  return {
    ...morphResult,
    success: true,
    eventType: 'MORPH_SUCCESS',
    description: `Successful transformation! Soul Strain increased from ${state.player.soulStrain || 0} to ${newSoulStrain}.`
  };
}

/**
 * Handle failed morph: potential VESSEL_SHATTER event
 * Critical failures trigger "Truth Mutation" where NPCs forget the player
 */
export function handleMorphFailure(
  state: WorldState,
  challenge: RitualChallenge,
  passMargin: number // Negative = how badly they failed
): MorphResult {
  const criticalFailureThreshold = -20; // More than 20 below DC = critical
  const isCritical = passMargin <= criticalFailureThreshold;

  if (isCritical) {
    // VESSEL_SHATTER: Reality warps, NPCs forget you, location glitches
    return {
      success: false,
      statChanges: {},
      soulStrainGain: 40, // Severe soul strain from shattering
      eventType: 'VESSEL_SHATTER',
      description: 'CATASTROPHIC MORPH FAILURE! Your essence shatters. Reality forgets you were ever here.',
      essenceAltar: state.player.location
    };
  } else {
    // Normal failure: ritual backlashes, minor soul strain increase
    return {
      success: false,
      statChanges: {},
      soulStrainGain: 15,
      eventType: 'MORPH_FAILURE',
      description: 'The ritual destabilizes. Your form flickers but holds. Soul Strain increased from backlash.',
      essenceAltar: state.player.location
    };
  }
}

/**
 * Essence Decay: High soul strain causes permanent stat penalties over time
 * Triggered every 24 hours with soulStrain >= 50
 */
export function calculateEssenceDecay(soulStrain: number): { hasPenalty: boolean; penaltyAmount: number } {
  if (soulStrain < 50) {
    return { hasPenalty: false, penaltyAmount: 0 };
  }

  // Every 10 points of soul strain = 1 permanent stat penalty
  const penaltyAmount = Math.floor((soulStrain - 50) / 25);

  return {
    hasPenalty: penaltyAmount > 0,
    penaltyAmount
  };
}

/**
 * Check if morphing is currently available (cooldown system)
 * Successive morphs become increasingly expensive
 */
export function checkMorphCooldown(
  lastMorphTick: number | undefined,
  currentTick: number,
  recentMorphCount: number
): { canMorph: boolean; cooldownRemaining: number; costMultiplier: number } {
  if (!lastMorphTick) {
    return { canMorph: true, cooldownRemaining: 0, costMultiplier: 1 };
  }

  // Cooldown: 30 ticks (1 hour game time) between morphs
  const cooldownTicks = 30;
  const timeSinceLastMorph = currentTick - lastMorphTick;
  const cooldownRemaining = Math.max(0, cooldownTicks - timeSinceLastMorph);

  // Each recent morph increases cost (resets after 12 hours)
  const recentWindow = 12 * 60; // 12 hours in ticks
  const costMultiplier = 1 + recentMorphCount * 0.2; // 20% per morph in window

  return {
    canMorph: cooldownRemaining === 0,
    cooldownRemaining,
    costMultiplier
  };
}

/**
 * Get essence altar location data including power level
 */
export interface EssenceAltar {
  id: string;
  locationId: string;
  name: string;
  power: number; // 0-1, affects ritual difficulty and success chance
  discoveredAt?: number; // Tick when player discovered
}

/**
 * Get all essence altars from world state
 * (These should be added to luxfier-world.json)
 */
export function getEssenceAltars(state: WorldState): EssenceAltar[] {
  // Placeholder: these will be populated from world data
  return [
    {
      id: 'moonwell-altar',
      locationId: 'moonwell-shrine',
      name: 'Moonwell Sacred Altar',
      power: 0.9,
      discoveredAt: state.tick
    },
    {
      id: 'thornwood-altar',
      locationId: 'thornwood-depths',
      name: 'Thornwood Essence Stone',
      power: 0.7,
      discoveredAt: state.tick
    },
    {
      id: 'forge-altar',
      locationId: 'forge-summit',
      name: 'Forge Resonance Anvil',
      power: 0.6,
      discoveredAt: state.tick
    }
  ];
}

/**
 * Find the nearest Essence Altar to current location
 */
export function findNearestAltar(state: WorldState, currentLocationId: string): EssenceAltar | null {
  const altars = getEssenceAltars(state);
  const nearbyAltars = altars.filter(a => a.locationId === currentLocationId);
  
  return nearbyAltars.length > 0 ? nearbyAltars[0] : null;
}
