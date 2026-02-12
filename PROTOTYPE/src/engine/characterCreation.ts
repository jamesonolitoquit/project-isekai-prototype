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
  gold: number;
  location: string;
  quests: Record<string, any>;
  reputation: Record<string, number>;
  dialogueHistory: any[];
  inventory?: Record<string, number>;
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
  stats: CharacterStats,
  startingLocation: string = 'Eldergrove Village'
): PlayerCharacter {
  if (!validateStatAllocation(stats)) {
    throw new Error('Invalid stat allocation');
  }

  const maxHp = 20 + Math.floor(stats.end / 2);

  return {
    id: `player_${Date.now()}`,
    name,
    race,
    stats,
    hp: maxHp,
    maxHp,
    gold: 0,
    location: startingLocation,
    quests: {},
    reputation: {},
    dialogueHistory: [],
    inventory: {}
  };
}

/**
 * Generate CREATE_CHARACTER event
 */
export function createCharacterCreatedEvent(
  character: PlayerCharacter,
  worldInstanceId: string
): Event {
  return {
    type: 'CHARACTER_CREATED',
    payload: {
      character
    },
    id: crypto.randomUUID(),
    worldInstanceId,
    actorId: character.id,
    templateOrigin: 'character_creation',
    timestamp: Date.now()
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
