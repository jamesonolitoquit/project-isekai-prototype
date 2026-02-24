import type { Event } from '../events/mutationLog';

export interface CharacterStats {
  str: number;
  agi: number;
  int: number;
  cha: number;
  end: number;
  luk: number;
}

export interface PlayerCharacter {
  id: string;
  name: string;
  race: string;
  stats: CharacterStats;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  location: string;
  quests: Record<string, any>;
  reputation: Record<string, number>;
  dialogueHistory: any[];
  inventory?: any[];
  knowledgeBase?: string[];
  visitedLocations?: string[];
  beliefLayer?: { npcLocations: Record<string, string>; npcStats: Record<string, any>; facts: Record<string, boolean>; suspicionLevel: number };
  bloodlineData?: {
    canonicalName?: string;
    inheritedPerks?: string[];
    inheritedItems?: { itemId: string; rarity?: string }[];
    mythStatus: number;
    epochsLived: number;
    deeds?: string[];
  };
  spellCooldownBonus?: number;
  factionReputation?: Record<string, number>;
}

export const STAT_POINTS_AVAILABLE = 20;

/**
 * Generate default stats for a new character
 */
export function generateDefaultStats(): CharacterStats {
  return {
    str: 10,
    agi: 10,
    int: 10,
    cha: 10,
    end: 10,
    luk: 10
  };
}

/**
 * Validate stat allocation (must sum to 60 with 20 points to distribute)
 */
export function validateStatAllocation(stats: CharacterStats): boolean {
  const total = stats.str + stats.agi + stats.int + stats.cha + stats.end + stats.luk;
  const pointsUsed = total - 60; // 6 * 10 = 60 base

  return (
    pointsUsed >= 0 &&
    pointsUsed <= STAT_POINTS_AVAILABLE &&
    stats.str >= 1 &&
    stats.agi >= 1 &&
    stats.int >= 1 &&
    stats.cha >= 1 &&
    stats.end >= 1 &&
    stats.luk >= 1
  );
}

/**
 * Create a new player character
 */
export function createPlayerCharacter(
  name: string,
  race: string,
  baseStats: CharacterStats,
  startingLocation: string = 'Eldergrove Village'
): PlayerCharacter {
  if (!validateStatAllocation(baseStats)) {
    throw new Error('Invalid stat allocation');
  }

  const stats = applyRacialModifiers(baseStats, race);

  const maxHp = 20 + Math.floor(stats.end / 2);
  const maxMp = 50 + stats.int * 5;

  // Initialize knowledge base with starting location (as array for JSON serialization)
  const knowledgeBase: any = [`location:${startingLocation.toLowerCase().replace(/\s+/g, '-')}`];

  // Initialize visited locations (as array for JSON serialization)
  const visitedLocations: any = [startingLocation.toLowerCase().replace(/\s+/g, '-')];

  // Initialize belief layer (empty state, no false beliefs)
  const beliefLayer = {
    npcLocations: {},
    npcStats: {},
    facts: {},
    suspicionLevel: 0
  };

  return {
    id: `player_${name.toLowerCase().replace(/\s+/g, '_')}_0`,
    name,
    race,
    stats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    gold: 0,
    location: startingLocation,
    quests: {},
    reputation: {},
    dialogueHistory: [],
    inventory: [],
    knowledgeBase,
    visitedLocations,
    beliefLayer
  };
}

/**
 * Generate CREATE_CHARACTER event
 */
export function createCharacterCreatedEvent(
  character: PlayerCharacter,
  worldInstanceId: string,
  tick: number = 0
): Event {
  return {
    type: 'CHARACTER_CREATED',
    payload: {
      character
    },
    id: `character-created-t${tick}`,
    worldInstanceId,
    actorId: character.id,
    templateOrigin: 'character_creation',
    timestamp: tick * 1000
  };
}

/**
 * List available races
 */
export function getAvailableRaces(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: 'human', name: 'Human', description: 'Balanced stats, versatile' },
    { id: 'elf', name: 'Elf', description: '+2 AGI, -1 STR' },
    { id: 'dwarf', name: 'Dwarf', description: '+2 END, -1 AGI' },
    { id: 'orc', name: 'Orc', description: '+2 STR, -1 INT' }
  ];
}

/**
 * Apply racial modifiers to base stats
 */
export function applyRacialModifiers(baseStats: CharacterStats, race: string): CharacterStats {
  const stats = { ...baseStats };

  switch (race.toLowerCase()) {
    case 'elf':
      stats.agi += 2;
      stats.str -= 1;
      break;
    case 'dwarf':
      stats.end += 2;
      stats.agi -= 1;
      break;
    case 'orc':
      stats.str += 2;
      stats.int -= 1;
      break;
    case 'human':
    default:
      // No modifiers
      break;
  }

  return stats;
}
