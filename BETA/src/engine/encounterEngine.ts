/**
 * Phase 14: The Shifting Path (Random Encounters & Hidden Discovery)
 * 
 * The Encounter Engine manifests probabilistic events during travel and exploration.
 * Encounters are weighted by biome, time of day, player level, and world state.
 * 
 * Core mechanics:
 * - calculateEncounterChance(): Returns probability of encounter based on location/time
 * - selectEncounterType(): Chooses encounter from weighted tables (common, rare, epic)
 * - generateEncounterNpc(): Creates temporary NPC for social encounters
 * - generateEncounterCombatant(): Creates temporary enemy for combat encounters
 */

import type { WorldState } from './worldEngine';
import { random } from './prng';

export interface Encounter {
  id: string;
  name: string;
  type: 'combat' | 'social' | 'item' | 'environmental' | 'mixed';
  rarity: 'common' | 'rare' | 'epic';
  biome: string[];  // biomes where this can appear
  timeOfDay?: ('night' | 'morning' | 'afternoon' | 'evening')[];
  description: string;
  minLevel?: number;
  maxLevel?: number;
  spawnWeight: number;  // 0-100 for probability weighting
}

export interface EncounterTable {
  biome: string;
  encounters: Encounter[];
  baseChance: number;  // 0-100 chance per travel tick
}

/**
 * Biome-based encounter tables
 * Loaded from encounters.json in game, defined here as types
 */
export const ENCOUNTER_TABLES_TEMPLATE: Record<string, EncounterTable> = {
  'forest': {
    biome: 'forest',
    baseChance: 35,  // 35% chance per travel tick in forest
    encounters: []
  },
  'mountain': {
    biome: 'mountain',
    baseChance: 40,
    encounters: []
  },
  'village': {
    biome: 'village',
    baseChance: 20,  // Lower chance in populated areas
    encounters: []
  },
  'ruin': {
    biome: 'ruin',
    baseChance: 50,
    encounters: []
  },
  'abyss': {
    biome: 'abyss',
    baseChance: 65,  // Very dangerous
    encounters: []
  }
};

/**
 * Calculate the probability of an encounter occurring
 * Increases with danger biome, decreases with time in safe areas
 * Scales with player level (harder enemies as player levels up)
 */
export function calculateEncounterChance(
  state: WorldState,
  locationBiome: string,
  encounterTable: EncounterTable,
  playerTravelsForTicks: number = 1
): number {
  if (!encounterTable) {
    return 0;
  }

  let baseChance = encounterTable.baseChance;

  // Weather increases encounter chance
  if (state.weather === 'rain') {
    baseChance *= 1.2;
  }

  // Day phase affects certain encounters
  const dayPhase = state.dayPhase || 'morning';
  if (dayPhase === 'night') {
    baseChance *= 1.3;  // Night is more dangerous
  }

  // Paradox/Soul Strain makes encounters more likely (world is unstable)
  const chaos = (state.player.beliefLayer?.suspicionLevel || 0) * 0.6 + 
                (state.player.temporalDebt || 0) * 0.4 + 
                (state.player.soulStrain || 0) * 0.3;
  if (chaos > 50) {
    const chaosMult = 1 + (chaos - 50) / 100;  // Up to 1.5x multiplier at max chaos
    baseChance *= chaosMult;
  }

  // Faction warfare increases encounters in contested areas
  const factionConflicts = (state.factionConflicts || []).length;
  if (factionConflicts > 0) {
    baseChance *= 1.1 * factionConflicts;
  }

  // Travel duration: longer travels = higher cumulative chance
  // Example: 5-tick travel has 5 rolls for encounters
  const cumulativeChance = Math.min(95, baseChance * playerTravelsForTicks);

  return cumulativeChance;
}

/**
 * Select an encounter from the table based on weighted probability
 * Respects player level range
 */
export function selectEncounterType(
  encounterTable: EncounterTable,
  playerLevel: number,
  seed: number = random()
): Encounter | null {
  if (!encounterTable.encounters || encounterTable.encounters.length === 0) {
    return null;
  }

  // Filter by player level and rarity weighting
  const availableEncounters = encounterTable.encounters.filter(enc => {
    if (enc.minLevel && playerLevel < enc.minLevel) return false;
    if (enc.maxLevel && playerLevel > enc.maxLevel) return false;
    return true;
  });

  if (availableEncounters.length === 0) {
    return null;
  }

  // Calculate weighted probabilities
  const totalWeight = availableEncounters.reduce((sum, enc) => sum + enc.spawnWeight, 0);
  let roll = seed * totalWeight;

  for (const encounter of availableEncounters) {
    if (roll <= encounter.spawnWeight) {
      return encounter;
    }
    roll -= encounter.spawnWeight;
  }

  return availableEncounters[availableEncounters.length - 1];
}

/**
 * Determine rarity distribution weights
 * Common: 70%, Rare: 20%, Epic: 10%
 */
export function getRarityMultiplier(rarity: string): number {
  switch (rarity) {
    case 'common':
      return 70;
    case 'rare':
      return 20;
    case 'epic':
      return 10;
    default:
      return 0;
  }
}

/**
 * Generate a temporary NPC for social encounters
 */
export function generateEncounterNpc(encounter: Encounter, state: WorldState) {
  const names = [
    'Wandering Merchant',
    'Lost Traveler',
    'Rogue Scholar',
    'Mysterious Stranger',
    'Fleeing Peasant',
    'Cursed Wanderer',
    'Exiled Noble',
    'Hermit Mystic'
  ];

  const playerLevel = state.player.level || 1;
  const npcLevel = Math.max(1, playerLevel + Math.floor(random() * 3) - 1);
  const tick = state.tick || 0;

  return {
    id: `encounter-${encounter.id}-t${tick}`,
    name: names[Math.floor(random() * names.length)],
    type: 'temporary',
    location: state.player.location,
    level: npcLevel,
    stats: {
      str: 8 + Math.floor(random() * 5),
      agi: 8 + Math.floor(random() * 5),
      int: 8 + Math.floor(random() * 5),
      cha: 8 + Math.floor(random() * 5),
      end: 8 + Math.floor(random() * 5),
      luk: 8 + Math.floor(random() * 5)
    },
    hp: 20 + npcLevel * 5,
    maxHp: 20 + npcLevel * 5,
    dialogue: [
      `Greetings, ${encounter.name}!`,
      'What brings you to these lands?',
      'I have a tale to share...'
    ]
  };
}

/**
 * Generate a temporary combatant for combat encounters
 */
export function generateEncounterCombatant(encounter: Encounter, state: WorldState) {
  const names = [
    'Bandit',
    'Goblin Raider',
    'Corrupted Beast',
    'Void Marauder',
    'Rogue Spirit',
    'Harbinger Beast',
    'Undead Warrior'
  ];

  const playerLevel = state.player.level || 1;
  const enemyLevel = Math.max(1, playerLevel + Math.floor(random() * 4) - 1);
  const baseHp = 30 + (enemyLevel * 5) + Math.floor(random() * 20);
  const tick = state.tick || 0;

  return {
    id: `encounter-combat-${encounter.id}-t${tick}`,
    name: names[Math.floor(random() * names.length)],
    type: 'temporary',
    location: state.player.location,
    level: enemyLevel,
    stats: {
      str: 9 + Math.floor(random() * 4),
      agi: 9 + Math.floor(random() * 4),
      int: 7 + Math.floor(random() * 3),
      cha: 6 + Math.floor(random() * 2),
      end: 9 + Math.floor(random() * 4),
      luk: 7 + Math.floor(random() * 3)
    },
    hp: baseHp,
    maxHp: baseHp,
    isHostile: true
  };
}

/**
 * Get biome of a location
 * (In real implementation, would be pulled from luxfier-world.json)
 */
export function getLocationBiome(locationId: string): string {
  const biomeMap: Record<string, string> = {
    'eldergrove-village': 'village',
    'luminara-grand-market': 'village',
    'thornwood-depths': 'forest',
    'moonwell-shrine': 'forest',
    'forge-summit': 'mountain',
    'frozen-lake': 'mountain',
    'abyss-edge': 'abyss'
  };

  return biomeMap[locationId] || 'forest';
}

/**
 * Calculate travel time between locations
 * Returns number of ticks required for travel
 */
export function calculateTravelDistance(
  fromLocationId: string,
  toLocationId: string
): number {
  // Simple distance matrix (in a real game, might be calculated from map coords)
  const distanceMap: Record<string, Record<string, number>> = {
    'eldergrove-village': {
      'luminara-grand-market': 3,
      'forge-summit': 4,
      'moonwell-shrine': 2,
      'thornwood-depths': 3,
      'frozen-lake': 5,
      'abyss-edge': 8
    },
    'forge-summit': {
      'eldergrove-village': 4,
      'frozen-lake': 2,
      'thornwood-depths': 3,
      'abyss-edge': 6
    },
    'thornwood-depths': {
      'eldergrove-village': 3,
      'moonwell-shrine': 2,
      'forge-summit': 3,
      'abyss-edge': 4
    }
  };

  // Symmetric lookup
  const key1 = `${fromLocationId}-${toLocationId}`;
  const key2 = `${toLocationId}-${fromLocationId}`;

  if (distanceMap[fromLocationId]?.[toLocationId]) {
    return distanceMap[fromLocationId][toLocationId];
  }

  // Default: random 2-5 ticks
  return 2 + Math.floor(random() * 4);
}

/**
 * Check if a location has hidden areas that can be discovered
 */
export function hasHiddenAreas(locationId: string): boolean {
  const locationsWithSecrets: Record<string, string[]> = {
    'forge-summit': ['secret-mine', 'master-smithy'],
    'thornwood-depths': ['hermit-cave', 'ancient-grove'],
    'moonwell-shrine': ['moon-vault', 'celestial-sanctum'],
    'eldergrove-village': ['refugee-cellar', 'hidden-shrine']
  };

  return (locationsWithSecrets[locationId]?.length || 0) > 0;
}

/**
 * Get hidden areas for a location
 */
export function getHiddenAreas(locationId: string): string[] {
  const locationsWithSecrets: Record<string, string[]> = {
    'forge-summit': ['secret-mine', 'master-smithy'],
    'thornwood-depths': ['hermit-cave', 'ancient-grove'],
    'moonwell-shrine': ['moon-vault', 'celestial-sanctum'],
    'eldergrove-village': ['refugee-cellar', 'hidden-shrine']
  };

  return locationsWithSecrets[locationId] || [];
}

/**
 * Calculate difficulty of discovering hidden area
 * Based on INT (perception) and LUK (chance)
 */
export function calculateSearchDifficulty(locationId: string): number {
  // Different locations have different difficulty to discover secrets
  const difficultyMap: Record<string, number> = {
    'forge-summit': 25,        // DC 25 (moderate)
    'thornwood-depths': 30,    // DC 30 (challenging)
    'moonwell-shrine': 20,     // DC 20 (easy)
    'eldergrove-village': 15   // DC 15 (very easy)
  };

  return difficultyMap[locationId] || 20;
}

/**
 * Perform a search check
 * Player rolls INT or LUK against difficulty
 */
export function performSearchCheck(
  playerInt: number,
  playerLuk: number,
  difficulty: number,
  seed: number = random()
): { success: boolean; roll: number; dc: number; margin: number } {
  // Best of INT or LUK combined with 1d20 equivalent roll
  const bonus = Math.max(playerInt, playerLuk) - 10;
  const roll = Math.floor(seed * 20) + 1;  // 1d20
  const modifiedRoll = roll + bonus;

  return {
    success: modifiedRoll >= difficulty,
    roll,
    dc: difficulty,
    margin: modifiedRoll - difficulty
  };
}
