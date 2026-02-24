/**
 * ALPHA_M9: Skill & Ability Engine
 * 
 * Manages four skill branches with tiered abilities:
 * - Martial: Combat techniques (5 tiers)
 * - Arcane: Magic disciplines (5 tiers)
 * - Resonance: Artifact/relic interaction (5 tiers)
 * - Social: Diplomacy, persuasion, espionage (5 tiers)
 * 
 * Each tier requires previous tier completion
 * Abilities grant active powers when unlocked
 */

export type SkillBranch = 'martial' | 'arcane' | 'resonance' | 'social';
export type AbilityTier = 1 | 2 | 3 | 4 | 5;

/**
 * Ability definition
 */
export interface Ability {
  id: string;
  name: string;
  branch: SkillBranch;
  tier: AbilityTier;
  description: string;
  skillPointCost: number;
  requiredLevel?: number;
  prerequisiteAbilityId?: string;  // Must unlock this first
  effect: {
    type: 'damage' | 'healing' | 'defense' | 'utility' | 'social' | 'interaction';
    magnitude?: number;
    duration?: number;  // Ticks
    cooldown?: number;  // Ticks
  };
  stats?: {
    str?: number;
    agi?: number;
    int?: number;
    cha?: number;
    end?: number;
    luk?: number;
  };
}

/**
 * Player ability state
 */
export interface PlayerAbilities {
  unlockedAbilities: string[];  // IDs of unlocked abilities
  equippedAbilities: string[];  // Active ability slots (max 6)
  abilityCooldowns: Record<string, number>;  // Remaining ticks on cooldown
}

/**
 * Skill tree definition - all available abilities
 */
const ABILITY_REGISTRY: Record<string, Ability> = {
  // ========== MARTIAL ABILITIES ==========

  'martial_slash': {
    id: 'martial_slash',
    name: 'Slash',
    branch: 'martial',
    tier: 1,
    description: 'A basic sword slash dealing moderate damage.',
    skillPointCost: 1,
    requiredLevel: 1,
    effect: {
      type: 'damage',
      magnitude: 20,
      cooldown: 6,
    },
    stats: { str: 1 },
  },

  'martial_parry': {
    id: 'martial_parry',
    name: 'Parry',
    branch: 'martial',
    tier: 1,
    description: 'Block incoming attacks for one turn, reducing damage by 50%.',
    skillPointCost: 1,
    requiredLevel: 2,
    effect: {
      type: 'defense',
      magnitude: 0.5,
      duration: 1,
      cooldown: 10,
    },
    stats: { str: 1, agi: 1 },
  },

  'martial_riposte': {
    id: 'martial_riposte',
    name: 'Riposte',
    branch: 'martial',
    tier: 2,
    description: 'After blocking, instantly counterattack for 150% damage.',
    skillPointCost: 2,
    requiredLevel: 5,
    prerequisiteAbilityId: 'martial_parry',
    effect: {
      type: 'damage',
      magnitude: 30,
      cooldown: 12,
    },
    stats: { str: 2, agi: 2 },
  },

  'martial_whirlwind_strike': {
    id: 'martial_whirlwind_strike',
    name: 'Whirlwind Strike',
    branch: 'martial',
    tier: 3,
    description: 'Spin rapidly, hitting all nearby enemies for 100% damage each.',
    skillPointCost: 3,
    requiredLevel: 10,
    prerequisiteAbilityId: 'martial_slash',
    effect: {
      type: 'damage',
      magnitude: 50,
      cooldown: 18,
    },
    stats: { str: 3, agi: 2 },
  },

  'martial_execute': {
    id: 'martial_execute',
    name: 'Execute',
    branch: 'martial',
    tier: 4,
    description: 'Powerful finishing move dealing 200% damage. Only usable when enemy below 30% HP.',
    skillPointCost: 4,
    requiredLevel: 15,
    prerequisiteAbilityId: 'martial_whirlwind_strike',
    effect: {
      type: 'damage',
      magnitude: 100,
      cooldown: 20,
    },
    stats: { str: 4, agi: 1 },
  },

  // ========== ARCANE ABILITIES ==========

  'arcane_fireball': {
    id: 'arcane_fireball',
    name: 'Fireball',
    branch: 'arcane',
    tier: 1,
    description: 'Hurl a ball of flames dealing fire damage to one enemy.',
    skillPointCost: 1,
    requiredLevel: 1,
    effect: {
      type: 'damage',
      magnitude: 25,
      cooldown: 8,
    },
    stats: { int: 3, agi: 1 },
  },

  'arcane_shield': {
    id: 'arcane_shield',
    name: 'Mana Shield',
    branch: 'arcane',
    tier: 1,
    description: 'Create a magical barrier absorbing damage using mana.',
    skillPointCost: 1,
    requiredLevel: 2,
    effect: {
      type: 'defense',
      magnitude: 1.2,
      duration: 10,
      cooldown: 15,
    },
    stats: { int: 2, cha: 1 },
  },

  'arcane_chain_lightning': {
    id: 'arcane_chain_lightning',
    name: 'Chain Lightning',
    branch: 'arcane',
    tier: 2,
    description: 'Lightning that jumps between enemies, hitting up to 5 targets.',
    skillPointCost: 2,
    requiredLevel: 6,
    prerequisiteAbilityId: 'arcane_fireball',
    effect: {
      type: 'damage',
      magnitude: 40,
      cooldown: 10,
    },
    stats: { int: 3, agi: 2 },
  },

  'arcane_time_warp': {
    id: 'arcane_time_warp',
    name: 'Time Warp',
    branch: 'arcane',
    tier: 3,
    description: 'Reverse the last 3 enemy actions.',
    skillPointCost: 3,
    requiredLevel: 12,
    prerequisiteAbilityId: 'arcane_chain_lightning',
    effect: {
      type: 'utility',
      duration: 1,
      cooldown: 30,
    },
    stats: { int: 4, cha: 1 },
  },

  'arcane_meteor_storm': {
    id: 'arcane_meteor_storm',
    name: 'Meteor Storm',
    branch: 'arcane',
    tier: 4,
    description: 'Summon meteors to rain down on the battlefield (AoE, all enemies).',
    skillPointCost: 4,
    requiredLevel: 18,
    prerequisiteAbilityId: 'arcane_time_warp',
    effect: {
      type: 'damage',
      magnitude: 80,
      cooldown: 25,
    },
    stats: { int: 5, agi: 1 },
  },

  // ========== RESONANCE ABILITIES ==========

  'resonance_commune': {
    id: 'resonance_commune',
    name: 'Commune',
    branch: 'resonance',
    tier: 1,
    description: 'Ask a sentient relic for wisdom, gaining knowledge or a stat boost.',
    skillPointCost: 1,
    requiredLevel: 1,
    effect: {
      type: 'interaction',
      magnitude: 1.1,
      duration: 30,
      cooldown: 60,
    },
    stats: { int: 2, cha: 2 },
  },

  'resonance_attune': {
    id: 'resonance_attune',
    name: 'Attune',
    branch: 'resonance',
    tier: 1,
    description: 'Synchronize with a relic, gaining access to its locked abilities.',
    skillPointCost: 1,
    requiredLevel: 3,
    effect: {
      type: 'interaction',
      magnitude: 1,
      duration: 120,
      cooldown: 0,
    },
    stats: { int: 3 },
  },

  'resonance_sacrifice': {
    id: 'resonance_sacrifice',
    name: 'Sacrifice',
    branch: 'resonance',
    tier: 2,
    description: 'Consume mana from a relic to cast a powerful spell.',
    skillPointCost: 2,
    requiredLevel: 7,
    prerequisiteAbilityId: 'resonance_attune',
    effect: {
      type: 'damage',
      magnitude: 60,
      cooldown: 12,
    },
    stats: { int: 4, cha: 1 },
  },

  'resonance_bind': {
    id: 'resonance_bind',
    name: 'Relic Binding',
    branch: 'resonance',
    tier: 3,
    description: 'Permanently bond with a relic, unlocking its full potential.',
    skillPointCost: 3,
    requiredLevel: 11,
    prerequisiteAbilityId: 'resonance_sacrifice',
    effect: {
      type: 'interaction',
      magnitude: 1.5,
      duration: 0,
      cooldown: 0,
    },
    stats: { int: 5, cha: 2 },
  },

  'resonance_singularity': {
    id: 'resonance_singularity',
    name: 'Singularity',
    branch: 'resonance',
    tier: 4,
    description: 'Merge with a relic to gain all its powers temporarily.',
    skillPointCost: 4,
    requiredLevel: 16,
    prerequisiteAbilityId: 'resonance_bind',
    effect: {
      type: 'interaction',
      magnitude: 2.0,
      duration: 15,
      cooldown: 60,
    },
    stats: { int: 5, cha: 3 },
  },

  // ========== SOCIAL ABILITIES ==========

  'social_persuade': {
    id: 'social_persuade',
    name: 'Persuade',
    branch: 'social',
    tier: 1,
    description: 'Convince an NPC to aid you or reduce prices by 20%.',
    skillPointCost: 1,
    requiredLevel: 1,
    effect: {
      type: 'social',
      magnitude: 0.8,
      cooldown: 30,
    },
    stats: { cha: 3 },
  },

  'social_intimidate': {
    id: 'social_intimidate',
    name: 'Intimidate',
    branch: 'social',
    tier: 1,
    description: 'Threaten an enemy to reduce their damage output by 30%.',
    skillPointCost: 1,
    requiredLevel: 2,
    effect: {
      type: 'social',
      magnitude: 0.7,
      duration: 10,
      cooldown: 20,
    },
    stats: { cha: 2, str: 1 },
  },

  'social_charm': {
    id: 'social_charm',
    name: 'Charm',
    branch: 'social',
    tier: 2,
    description: 'Enchant someone to gain advantage in conversations and negotiations.',
    skillPointCost: 2,
    requiredLevel: 5,
    prerequisiteAbilityId: 'social_persuade',
    effect: {
      type: 'social',
      magnitude: 1.3,
      duration: 60,
      cooldown: 40,
    },
    stats: { cha: 3, int: 1 },
  },

  'social_shadow': {
    id: 'social_shadow',
    name: 'Shadow Step',
    branch: 'social',
    tier: 2,
    description: 'Move undetected through crowds, avoiding detection.',
    skillPointCost: 2,
    requiredLevel: 6,
    prerequisiteAbilityId: 'social_intimidate',
    effect: {
      type: 'utility',
      magnitude: 1,
      duration: 30,
      cooldown: 45,
    },
    stats: { agi: 3, cha: 1 },
  },

  'social_betrayal': {
    id: 'social_betrayal',
    name: 'Betrayal',
    branch: 'social',
    tier: 3,
    description: 'Turn an enemy faction member to your side permanently.',
    skillPointCost: 3,
    requiredLevel: 13,
    prerequisiteAbilityId: 'social_charm',
    effect: {
      type: 'social',
      magnitude: 1,
      cooldown: 120,
    },
    stats: { cha: 4, int: 2 },
  },

  'social_legend': {
    id: 'social_legend',
    name: 'Legendary Status',
    branch: 'social',
    tier: 4,
    description: 'Become a living legend, gaining +50% faction reputation and influence.',
    skillPointCost: 4,
    requiredLevel: 17,
    prerequisiteAbilityId: 'social_betrayal',
    effect: {
      type: 'social',
      magnitude: 1.5,
      duration: 0,
      cooldown: 0,
    },
    stats: { cha: 5, int: 2 },
  },
};

/**
 * Initialize empty player abilities
 */
export function initializePlayerAbilities(): PlayerAbilities {
  return {
    unlockedAbilities: [],
    equippedAbilities: [],
    abilityCooldowns: {},
  };
}

/**
 * Get all abilities for a specific branch
 */
export function getAbilitiesByBranch(branch: SkillBranch): Ability[] {
  return Object.values(ABILITY_REGISTRY).filter(a => a.branch === branch);
}

/**
 * Get all abilities of a specific tier across all branches
 */
export function getAbilitiesByTier(tier: AbilityTier): Ability[] {
  return Object.values(ABILITY_REGISTRY).filter(a => a.tier === tier);
}

/**
 * Get an ability by ID
 */
export function getAbility(abilityId: string): Ability | null {
  return ABILITY_REGISTRY[abilityId] ?? null;
}

/**
 * Check if player can unlock an ability
 */
export function canUnlockAbility(
  playerAbilities: PlayerAbilities,
  abilityId: string,
  playerLevel: number,
  playerSkillPoints: number
): { canUnlock: boolean; reason?: string } {
  const ability = getAbility(abilityId);

  if (!ability) {
    return { canUnlock: false, reason: 'Ability not found' };
  }

  if (playerAbilities.unlockedAbilities.includes(abilityId)) {
    return { canUnlock: false, reason: 'Already unlocked' };
  }

  if (playerLevel < (ability.requiredLevel ?? 1)) {
    return {
      canUnlock: false,
      reason: `Requires level ${ability.requiredLevel}. You are level ${playerLevel}`,
    };
  }

  if (playerSkillPoints < ability.skillPointCost) {
    return {
      canUnlock: false,
      reason: `Requires ${ability.skillPointCost} skill points. You have ${playerSkillPoints}`,
    };
  }

  if (ability.prerequisiteAbilityId) {
    if (!playerAbilities.unlockedAbilities.includes(ability.prerequisiteAbilityId)) {
      const prereq = getAbility(ability.prerequisiteAbilityId);
      return {
        canUnlock: false,
        reason: `Requires "${prereq?.name}" to be unlocked first`,
      };
    }
  }

  return { canUnlock: true };
}

/**
 * Unlock an ability for the player
 */
export function unlockAbility(
  playerAbilities: PlayerAbilities,
  abilityId: string
): boolean {
  if (!playerAbilities.unlockedAbilities.includes(abilityId)) {
    playerAbilities.unlockedAbilities.push(abilityId);
    return true;
  }
  return false;
}

/**
 * Equip an ability (add to active slots, max 6)
 */
export function equipAbility(playerAbilities: PlayerAbilities, abilityId: string): boolean {
  if (
    playerAbilities.unlockedAbilities.includes(abilityId) &&
    !playerAbilities.equippedAbilities.includes(abilityId) &&
    playerAbilities.equippedAbilities.length < 6
  ) {
    playerAbilities.equippedAbilities.push(abilityId);
    return true;
  }
  return false;
}

/**
 * Unequip an ability
 */
export function unequipAbility(playerAbilities: PlayerAbilities, abilityId: string): boolean {
  const index = playerAbilities.equippedAbilities.indexOf(abilityId);
  if (index > -1) {
    playerAbilities.equippedAbilities.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Trigger ability cooldown
 */
export function setAbilityCooldown(
  playerAbilities: PlayerAbilities,
  abilityId: string,
  cooldownTicks: number
): void {
  playerAbilities.abilityCooldowns[abilityId] = cooldownTicks;
}

/**
 * Decrement all active cooldowns (call once per tick)
 */
export function tickAbilityCooldowns(playerAbilities: PlayerAbilities): void {
  for (const abilityId in playerAbilities.abilityCooldowns) {
    playerAbilities.abilityCooldowns[abilityId]--;
    if (playerAbilities.abilityCooldowns[abilityId] <= 0) {
      delete playerAbilities.abilityCooldowns[abilityId];
    }
  }
}

/**
 * Check if an ability is on cooldown
 */
export function isAbilityOnCooldown(playerAbilities: PlayerAbilities, abilityId: string): boolean {
  return (playerAbilities.abilityCooldowns[abilityId] ?? 0) > 0;
}

/**
 * Get remaining cooldown ticks for an ability
 */
export function getAbilityCooldownRemaining(
  playerAbilities: PlayerAbilities,
  abilityId: string
): number {
  return Math.max(0, playerAbilities.abilityCooldowns[abilityId] ?? 0);
}

/**
 * Get branch progress (how many abilities unlocked in each branch)
 */
export function getSkillBranchProgress(
  playerAbilities: PlayerAbilities
): Record<SkillBranch, { unlocked: number; total: number }> {
  const branches: SkillBranch[] = ['martial', 'arcane', 'resonance', 'social'];
  const progress: Record<SkillBranch, { unlocked: number; total: number }> = {
    martial: { unlocked: 0, total: 0 },
    arcane: { unlocked: 0, total: 0 },
    resonance: { unlocked: 0, total: 0 },
    social: { unlocked: 0, total: 0 },
  };

  for (const branch of branches) {
    const abilities = getAbilitiesByBranch(branch);
    progress[branch].total = abilities.length;
    progress[branch].unlocked = abilities.filter(a =>
      playerAbilities.unlockedAbilities.includes(a.id)
    ).length;
  }

  return progress;
}
