/**
 * AbilityResolver Engine
 * 
 * Handles the execution and resolution of player abilities.
 * Links the RPG stat system to combat mechanics through deterministic formulas.
 * 
 * Features:
 * - D&D-style stat modifiers (STR, INT, CHA, AGI, END, LUK, PERCEPTION)
 * - Ability cost validation (mana, paradox, stamina)
 * - Damage/healing calculations based on stats
 * - Cooldown management
 * - Effect application (damage, healing, crowd control, status)
 * 
 * Phase 4: Engine Convergence - Stat-Driven Ability System
 */

import type { PlayerState, WorldState } from './worldEngine';
import type { Relic } from './artifactEngine';
import { calculateEquipmentEffectiveness, shouldBotch } from './proficiencyEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AbilityEffect {
  type: 'damage' | 'healing' | 'mana_restore' | 'status_effect' | 'teleport';
  value: number;          // Primary value (damage/healing amount)
  secondaryValue?: number; // Secondary effect value (stun duration, etc)
  statusEffect?: string;  // Applied status (stun, slow, poison, etc)
  targetType: 'self' | 'enemy' | 'aoe' | 'team';
  accuracy?: number;      // Hit chance (0-1)
  range?: number;         // Range in units (0 = melee, 999 = ranged/global)
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: 'offensive' | 'defensive' | 'utility' | 'healing';
  manaCost: number;
  apCost?: number; // Phase 39: Action Points cost per card play (default 1)
  cooldownTicks: number;
  paradoxCost?: number;  // Temporal debt from using paradox abilities
  effect: AbilityEffect;
  requirements?: {
    minimumLevel?: number;
    minimumStat?: { stat: string; value: number };
  };
}

export interface AbilityResolutionResult {
  success: boolean;
  reason?: string;          // Why execution failed (mana, cooldown, etc)
  damage?: number;
  healing?: number;
  manaCost: number;
  cooldownApplied: number;
  paradoxIncurred: number;
  effectLog: string[];      // Human-readable effect descriptions
}

// ============================================================================
// STAT MODIFIER FORMULA (D&D 5e Style)
// ============================================================================

/**
 * Calculate stat modifier from base score
 * Formula: (score - 10) / 2, rounded down
 * Examples: 18 → +4, 14 → +2, 10 → 0, 8 → -1
 */
export function getStatModifier(statValue: number): number {
  return Math.floor((statValue - 10) / 2);
}

// ============================================================================
// ABILITY DEFINITIONS DATABASE
// ============================================================================

export const ABILITY_DATABASE: Record<string, AbilityDefinition> = {
  // Stage 8.95: BASE TACTICAL ACTIONS (always available)
  'attack': {
    id: 'attack',
    name: 'Attack',
    description: 'Basic melee attack on nearby enemy',
    type: 'offensive',
    manaCost: 0,  // No mana cost for basic attack
    cooldownTicks: 10,
    effect: {
      type: 'damage',
      value: 10,  // Base damage (scales with STR)
      targetType: 'enemy',
      range: 5,  // Melee range
      accuracy: 0.85,
    },
    requirements: { minimumLevel: 0 },
  },

  'interact': {
    id: 'interact',
    name: 'Interact',
    description: 'Examine or interact with nearby objects',
    type: 'utility',
    manaCost: 0,
    cooldownTicks: 5,
    effect: {
      type: 'status_effect',
      value: 0,
      targetType: 'aoe',
      range: 2,
      accuracy: 1.0,
      statusEffect: 'interact',
    },
    requirements: { minimumLevel: 0 },
  },

  'search': {
    id: 'search',
    name: 'Search',
    description: 'Investigate an area for hidden items',
    type: 'utility',
    manaCost: 0,
    cooldownTicks: 15,
    effect: {
      type: 'status_effect',
      value: 0,
      targetType: 'aoe',
      range: 1,
      accuracy: 1.0,
      statusEffect: 'search',
    },
    requirements: { minimumLevel: 0 },
  },

  // OFFENSIVE ABILITIES
  'fireball': {
    id: 'fireball',
    name: 'Fireball',
    description: 'Launch a massive fireball at enemies',
    type: 'offensive',
    manaCost: 30,
    cooldownTicks: 30,
    paradoxCost: 5,
    effect: {
      type: 'damage',
      value: 25,  // Base damage
      targetType: 'aoe',
      range: 999,
      accuracy: 0.9,
    },
    requirements: { minimumLevel: 5 },
  },

  'frost-nova': {
    id: 'frost-nova',
    name: 'Frost Nova',
    description: 'Freeze enemies in place',
    type: 'offensive',
    manaCost: 25,
    cooldownTicks: 20,
    paradoxCost: 3,
    effect: {
      type: 'damage',
      value: 15,
      secondaryValue: 5,  // Stun duration in ticks
      statusEffect: 'frozen',
      targetType: 'aoe',
      range: 999,
      accuracy: 0.85,
    },
    requirements: { minimumLevel: 3 },
  },

  'arcane-missile': {
    id: 'arcane-missile',
    name: 'Arcane Missile',
    description: 'Fire magical projectiles',
    type: 'offensive',
    manaCost: 20,
    cooldownTicks: 15,
    paradoxCost: 2,
    effect: {
      type: 'damage',
      value: 12,
      targetType: 'enemy',
      range: 999,
      accuracy: 0.95,
    },
    requirements: { minimumLevel: 1 },
  },

  'shield-bash': {
    id: 'shield-bash',
    name: 'Shield Bash',
    description: 'Stun and block incoming damage',
    type: 'defensive',
    manaCost: 15,
    cooldownTicks: 25,
    effect: {
      type: 'damage',
      value: 8,
      secondaryValue: 3,  // Stun duration
      statusEffect: 'stunned',
      targetType: 'enemy',
      range: 5,  // Melee range
      accuracy: 0.8,
    },
    requirements: { minimumLevel: 1 },
  },

  // DEFENSIVE ABILITIES
  'healing-light': {
    id: 'healing-light',
    name: 'Healing Light',
    description: 'Restore health and cleanse debuffs',
    type: 'healing',
    manaCost: 20,
    cooldownTicks: 40,
    effect: {
      type: 'healing',
      value: 30,  // Base healing
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
    requirements: { minimumLevel: 1 },
  },

  'mana-shield': {
    id: 'mana-shield',
    name: 'Mana Shield',
    description: 'Convert mana into temporary armor',
    type: 'defensive',
    manaCost: 25,
    cooldownTicks: 50,
    effect: {
      type: 'status_effect',
      value: 50,  // Shield strength
      statusEffect: 'mana_shield',
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
  },

  // UTILITY ABILITIES
  'blink': {
    id: 'blink',
    name: 'Blink',
    description: 'Teleport away from danger',
    type: 'utility',
    manaCost: 35,
    cooldownTicks: 50,
    paradoxCost: 8,  // Teleport causes temporal strain
    effect: {
      type: 'teleport',
      value: 50,  // Teleport distance
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
    requirements: { minimumLevel: 10 },
  },

  // SIMPLE ABILITIES (for basic gameplay)
  'heal': {
    id: 'heal',
    name: 'Heal',
    description: 'Restore a moderate amount of health',
    type: 'healing',
    manaCost: 15,
    cooldownTicks: 30,
    effect: {
      type: 'healing',
      value: 20,
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
    requirements: { minimumLevel: 1 },
  },

  'shield-spell': {
    id: 'shield-spell',
    name: 'Shield Spell',
    description: 'Create a protective barrier',
    type: 'defensive',
    manaCost: 20,
    cooldownTicks: 40,
    effect: {
      type: 'status_effect',
      value: 30,
      statusEffect: 'shield',
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
  },

  'teleport': {
    id: 'teleport',
    name: 'Teleport',
    description: 'Instantly move to a nearby location',
    type: 'utility',
    manaCost: 25,
    cooldownTicks: 35,
    paradoxCost: 5,
    effect: {
      type: 'teleport',
      value: 30,
      targetType: 'self',
      range: 0,
      accuracy: 1.0,
    },
    requirements: { minimumLevel: 5 },
  },
};

// ============================================================================
// ABILITY RESOLVER LOGIC
// ============================================================================

/**
 * Check if an ability can be used
 * Phase 42: Removed hard level/stat requirements - now uses proficiency-based scaling
 * Any player can attempt any ability; effectiveness is based on proficiency level
 */
export function canUseAbility(
  ability: AbilityDefinition,
  player: PlayerState
): { canUse: boolean; reason?: string } {
  // Check mana
  if ((player.soulResonanceLevel || 0) < ability.manaCost) {
    return {
      canUse: false,
      reason: `Insufficient mana (need ${ability.manaCost}, have ${player.soulResonanceLevel || 0})`,
    };
  }

  // Check cooldown
  const cooldownRemaining = (player.abilityCooldowns?.[ability.id] || 0);
  if (cooldownRemaining > 0) {
    return {
      canUse: false,
      reason: `Ability on cooldown (${Math.ceil(cooldownRemaining / 10)}s remaining)`,
    };
  }

  // Check paradox capacity if ability has paradox cost
  if (ability.paradoxCost && (player.temporalDebt || 0) + ability.paradoxCost > 100) {
    return {
      canUse: false,
      reason: `Using this ability would exceed paradox limit`,
    };
  }

  // Phase 42: NO hard level or stat requirements
  // Players can use ANY ability at any time
  // Effectiveness is determined by proficiency level and applies scaling penalties
  // (see calculateEquipmentEffectiveness in resolveAbility)

  return { canUse: true };
}

/**
 * Phase 18: Check if equipped relics are stable enough to cast ability
 * Returns the relic result (override, backlash, or success) and debuff multipliers
 */
export interface RelicStabilityResult {
  isStable: boolean;  // true = ability casts normally
  consequence: 'success' | 'refused' | 'backlash' | 'whisper'; // What happens
  backlashDamage?: number; // Self-damage if relic rebels
  debuffMultiplier: number; // Ability damage/speed modifier (1.0 = normal)
  effectLog?: string[]; // Additional narrative feedback
}

export function checkRelicStability(
  player: PlayerState,
  worldState: WorldState
): RelicStabilityResult {
  const equippedRelicIds = player.equippedRelics || [];
  const equippedRelics: Relic[] = equippedRelicIds
    .map((id) => worldState.relics?.[id])
    .filter((r): r is Relic => r !== undefined);
  
  if (equippedRelics.length === 0) {
    return { isStable: true, consequence: 'success', debuffMultiplier: 1.0 };
  }

  const effectLog: string[] = [];
  let worstRebellion: Relic | null = null;
  let highestRebellionCounter = 0;

  // Find the most rebellious equipped relic
  for (const relic of equippedRelics) {
    if ((relic.rebellionCounter || 0) > highestRebellionCounter) {
      highestRebellionCounter = relic.rebellionCounter || 0;
      worstRebellion = relic;
    }
  }

  // Phase 18: If relic rebellion > 70, attempt a stability check
  if (worstRebellion && highestRebellionCounter > 70) {
    // Stability check: 50% + (5% per point over 70)
    const stabilityThreshold = 0.5 + ((highestRebellionCounter - 70) * 0.05);
    const stabilityRoll = Math.random();

    if (stabilityRoll < stabilityThreshold) {
      // Relic rebelled! Determine consequence
      if (highestRebellionCounter > 90) {
        // BACKLASH: Self-damage, action replaced entirely
        const backlashDamage = 15 + (highestRebellionCounter - 90) * 2;
        effectLog.push(`⚔️ RELIC BACKLASH: ${worstRebellion.name} violently refuses to obey! You take ${backlashDamage} damage!`);
        return {
          isStable: false,
          consequence: 'backlash',
          backlashDamage,
          debuffMultiplier: 0, // Action cancelled
          effectLog,
        };
      } else if (highestRebellionCounter > 80) {
        // REFUSED: Ability doesn't activate
        effectLog.push(`🛑 ${worstRebellion.name} REFUSES to cooperate! Ability fails silently.`);
        return {
          isStable: false,
          consequence: 'refused',
          debuffMultiplier: 0,
          effectLog,
        };
      } else {
        // WHISPER: Ability casts but with penalty based on mood
        const moodPenalty = calculateMoodDebuff(worstRebellion);
        const penalty = moodPenalty * 100; // Convert to percentage loss
        effectLog.push(`💭 ${worstRebellion.name} grumbles but cooperates grudgingly. Ability power: ${Math.round((1 - moodPenalty) * 100)}%`);
        
        return {
          isStable: true, // Action proceeds
          consequence: 'whisper',
          debuffMultiplier: 1 - moodPenalty, // Reduced effectiveness
          effectLog,
        };
      }
    }
  }

  // Phase 18: Apply mood-based debuffs even without rebellion
  let totalMoodDebuff = 0;
  for (const relic of equippedRelics) {
    totalMoodDebuff += calculateMoodDebuff(relic);
  }

  if (totalMoodDebuff > 0) {
    effectLog.push(`😠 Equipped artifacts seem irritable. Ability power reduced by ${Math.round(totalMoodDebuff * 100)}%.`);
  }

  return {
    isStable: true,
    consequence: 'success',
    debuffMultiplier: Math.max(0.5, 1 - totalMoodDebuff), // Min 50% effectiveness
    effectLog: effectLog.length > 0 ? effectLog : undefined,
  };
}

/**
 * Phase 18: Calculate mood-based combat penalty
 * Sullen: -20% action speed/damage
 * Rebellious (implied by high rebellion counter): -15% effectiveness
 */
function calculateMoodDebuff(relic: Relic): number {
  let debuff = 0;

  // Sullen mood: -20% penalty
  if (relic.moods?.sullen && relic.moods.sullen > 0.5) {
    debuff += 0.2;
  }

  // Curious mood: slightly reduces debuff (relic engages)
  if (relic.moods?.curious && relic.moods.curious > 0.5) {
    debuff = Math.max(0, debuff - 0.05);
  }

  // Bloodthirsty mood: reduces debuff in combat (wants to fight)
  if (relic.moods?.bloodthirsty && relic.moods.bloodthirsty > 0.5) {
    debuff = Math.max(0, debuff - 0.1);
  }

  return Math.min(0.5, debuff); // Cap at 50% penalty
}

/**
 * Resolve ability execution and calculate effects
 * 
 * This function:
 * 1. Validates ability usage
 * 2. Calculates damage/healing based on stats
 * 3. Applies hit chance and accuracy
 * 4. Returns detailed resolution result
 */
export function resolveAbility(
  abilityId: string,
  player: PlayerState,
  worldState: WorldState
): AbilityResolutionResult {
  const ability = ABILITY_DATABASE[abilityId];

  if (!ability) {
    return {
      success: false,
      reason: `Unknown ability: ${abilityId}`,
      manaCost: 0,
      cooldownApplied: 0,
      paradoxIncurred: 0,
      effectLog: [],
    };
  }

  // Check if ability can be used
  const canUse = canUseAbility(ability, player);
  if (!canUse.canUse) {
    return {
      success: false,
      reason: canUse.reason,
      manaCost: 0,
      cooldownApplied: 0,
      paradoxIncurred: 0,
      effectLog: [],
    };
  }

  // =========================================================================
  // CHECK RELIC STABILITY & REBELLION STATUS
  // =========================================================================

  const stabilityCheck = checkRelicStability(player, worldState);
  if (!stabilityCheck.isStable) {
    if (stabilityCheck.consequence === 'backlash') {
      // Relic rebellion caused backlash - apply self-damage and fail
      const backlashDamage = stabilityCheck.backlashDamage || 20;
      return {
        success: false,
        reason: `Relic backlash! Took ${backlashDamage} damage.`,
        manaCost: 0,
        cooldownApplied: 0,
        paradoxIncurred: backlashDamage * 0.1, // Convert damage to paradox
        effectLog: [
          `Relic rebellion triggered backlash!`,
          `Self-damage: ${backlashDamage}`,
          ...(stabilityCheck.effectLog || []),
        ],
      };
    } else if (stabilityCheck.consequence === 'refused') {
      // Relic refuses to activate
      return {
        success: false,
        reason: `Equipped relic refuses to activate.`,
        manaCost: 0,
        cooldownApplied: 0,
        paradoxIncurred: 0,
        effectLog: [
          `Relic firmly refused activation.`,
          ...(stabilityCheck.effectLog || []),
        ],
      };
    }
    // For 'whisper' consequence, continue but apply debuffMultiplier below
  }

  const effectLog: string[] = [
    ...(stabilityCheck.effectLog || []),
  ];
  let damage = 0;
  let healing = 0;
  const manaCost = ability.manaCost;
  const cooldownApplied = ability.cooldownTicks;
  const paradoxIncurred = ability.paradoxCost || 0;

  // =========================================================================
  // CALCULATE EFFECTS BASED ON ABILITY TYPE & STATS
  // =========================================================================

  const intModifier = getStatModifier(player.stats?.int || 10);
  const strModifier = getStatModifier(player.stats?.str || 10);
  const chaModifier = getStatModifier(player.stats?.cha || 10);
  const agiModifier = getStatModifier(player.stats?.agi || 10);
  const endModifier = getStatModifier(player.stats?.end || 10);
  const lukModifier = getStatModifier(player.stats?.luk || 10);

  switch (ability.id) {
    // OFFENSIVE: Damage = base + INT mod (for magical) or STR mod (for physical)
    case 'fireball':
      damage = ability.effect.value + intModifier * 2;
      effectLog.push(`🔥 Fireball launches! Damage: ${damage}`);
      break;

    case 'frost-nova':
      damage = ability.effect.value + intModifier;
      effectLog.push(`❄️ Frost Nova erupts! Damage: ${damage}, Stun duration: ${ability.effect.secondaryValue} ticks`);
      break;

    case 'arcane-missile':
      damage = ability.effect.value + intModifier;
      effectLog.push(`✨ Arcane Missile fires! Damage: ${damage}`);
      break;

    case 'shield-bash':
      // Physical damage + STR modifier
      damage = ability.effect.value + strModifier;
      effectLog.push(`🛡️ Shield Bash lands! Damage: ${damage}, Stun: ${ability.effect.secondaryValue} ticks`);
      break;

    // HEALING: Healing = base + INT + CHA mods
    case 'healing-light':
      healing = ability.effect.value + intModifier + chaModifier;
      effectLog.push(`💚 Healing Light shines! Healing: ${healing}`);
      break;

    // DEFENSIVE: Mana Shield strength based on INT
    case 'mana-shield':
      const shieldStrength = ability.effect.value + intModifier * 3;
      effectLog.push(`🛡️ Mana Shield applied! Strength: ${shieldStrength}`);
      break;

    // UTILITY: Blink distance based on AGI
    case 'blink':
      const blinkDistance = ability.effect.value + agiModifier * 2;
      effectLog.push(`⚡ Blink! Teleport distance: ${blinkDistance} units`);
      break;

    default:
      effectLog.push(`${ability.name} cast!`);
  }

  // =========================================================================
  // ACCURACY CHECK (affected by AGI and LUK)
  // =========================================================================

  if (ability.effect.accuracy && ability.effect.accuracy < 1.0) {
    const hitChance = ability.effect.accuracy + (agiModifier + lukModifier) * 0.05;
    const roll = Math.random();
    if (roll > hitChance) {
      effectLog.push(`⚠️ Ability missed!`);
      return {
        success: true,
        manaCost,
        cooldownApplied,
        paradoxIncurred,
        damage: 0,
        healing: 0,
        effectLog,
      };
    }
  }

  // =========================================================================
  // APPLY RELIC DEBUFF MULTIPLIER FROM WHISPER CONSEQUENCE
  // =========================================================================

  let stabilityDebuffMultiplier = stabilityCheck.debuffMultiplier;
  let finalDamage = Math.floor(damage * stabilityDebuffMultiplier);
  let finalHealing = Math.floor(healing * stabilityDebuffMultiplier);

  if (stabilityCheck.debuffMultiplier < 1.0 && stabilityCheck.consequence === 'whisper') {
    effectLog.push(
      `⚠️ Relic whispers distortion... Effectiveness: ${(stabilityCheck.debuffMultiplier * 100).toFixed(0)}%`
    );
  }

  // =========================================================================
  // Phase 42: Apply Proficiency-Based Effectiveness Scaling
  // =========================================================================
  // Removes hard level/stat locks but allows universal equipment usage
  // with proficiency-based penalties for under-skilled players

  let proficiencyTier = 1; // Default tier requirement
  let proficiencyCategory = 'Arcane'; // Default category for scaling
  
  // Determine required proficiency tier and category based on ability
  if (ability.id.includes('fireball') || ability.id.includes('frost') || ability.id.includes('arcane')) {
    proficiencyTier = ability.requirements?.minimumLevel || 5;
    proficiencyCategory = 'Arcane';
  } else if (ability.id.includes('shield') || ability.id.includes('bash')) {
    proficiencyTier = ability.requirements?.minimumLevel || 1;
    proficiencyCategory = 'Blunt';
  } else if (ability.id.includes('healing')) {
    proficiencyTier = ability.requirements?.minimumLevel || 1;
    proficiencyCategory = 'Arcane';
  }

  const currentProfLevel = player.proficiencies?.[proficiencyCategory]?.level || 0;
  const proficiencyEffectiveness = calculateEquipmentEffectiveness(currentProfLevel, proficiencyTier);

  // Apply proficiency scaling to damage and healing
  finalDamage = Math.floor(finalDamage * proficiencyEffectiveness);
  finalHealing = Math.floor(finalHealing * proficiencyEffectiveness);

  // Check for botch/critical failure if proficiency is low
  const botchRoll = shouldBotch(currentProfLevel, proficiencyTier, worldState);
  if (botchRoll) {
    effectLog.push(`💥 BOTCH! Your poor skill causes a spectacular failure!`);
    // Reduce damage significantly or cause a fizzle
    finalDamage = Math.floor(finalDamage * 0.1);
    finalHealing = Math.floor(finalHealing * 0.1);
  }

  if (proficiencyEffectiveness < 1.0) {
    effectLog.push(
      `⚠️ Your lack of ${proficiencyCategory} skill reduces effectiveness to ${(proficiencyEffectiveness * 100).toFixed(0)}%`
    );
  } else if (proficiencyEffectiveness > 1.0) {
    effectLog.push(
      `✨ Your expertise in ${proficiencyCategory} enhances the effect to ${(proficiencyEffectiveness * 100).toFixed(0)}%!`
    );
  }

  return {
    success: true,
    manaCost,
    cooldownApplied,
    paradoxIncurred,
    damage: finalDamage,
    healing: finalHealing,
    effectLog,
  };
}

/**
 * Get all abilities available to the player
 */
export function getPlayerAbilities(player: PlayerState): AbilityDefinition[] {
  const equippedIds = player.equippedAbilities || [];
  return equippedIds
    .map((id) => ABILITY_DATABASE[id])
    .filter((ability) => !!ability);
}

/**
 * Get ability cooldown remaining (in ticks)
 */
export function getAbilityCooldownRemaining(
  abilityId: string,
  player: PlayerState
): number {
  return Math.max(0, (player.abilityCooldowns?.[abilityId] || 0));
}

/**
 * Check if ability is currently on cooldown
 */
export function isAbilityOnCooldown(abilityId: string, player: PlayerState): boolean {
  return getAbilityCooldownRemaining(abilityId, player) > 0;
}

export default {
  ABILITY_DATABASE,
  getStatModifier,
  canUseAbility,
  resolveAbility,
  getPlayerAbilities,
  getAbilityCooldownRemaining,
  isAbilityOnCooldown,
};
