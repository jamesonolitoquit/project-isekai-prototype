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
  type: 'combat' | 'social' | 'item' | 'environmental' | 'mixed' | 'apex';
  rarity: 'common' | 'rare' | 'epic' | 'apex';
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
 * BETA: Epoch-aware - Twilight era has +40% encounter rates
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

  // BETA: Epoch multiplier
  const epochTheme = state.epochMetadata?.theme;
  if (epochTheme === 'Desperation') {
    baseChance *= 1.4; // +40% encounters in Twilight era
  } else if (epochTheme === 'Decline') {
    baseChance *= 1.15; // +15% encounters in Waning era
  }

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
 * Calculate epoch-based weight modifiers for encounters
 * BETA: Different enemy types are more common in different eras
 */
export function getEpochEncounterModifier(encounterType: string, epochTheme?: string): number {
  if (!epochTheme) return 1.0; // No modifier if epoch not specified
  
  // Twilight era: More chaos-touched enemies, fewer civilized encounters
  if (epochTheme === 'Desperation') {
    if (encounterType.includes('chaos') || encounterType.includes('corrupted') || encounterType.includes('twisted')) {
      return 1.4; // +40% spawn rate for corrupted enemies
    }
    if (encounterType.includes('merchant') || encounterType.includes('trader') || encounterType.includes('civilian')) {
      return 0.15; // -85% spawn rate for peaceful encounters
    }
    if (encounterType.includes('shadow') || encounterType.includes('conclave')) {
      return 1.3; // +30% spawn rate for shadow faction
    }
  }
  
  // Waning era: Balanced, slight increase in rare encounters
  if (epochTheme === 'Decline') {
    if (encounterType.includes('rare') || encounterType.includes('ancient')) {
      return 1.15; // +15% for rare/ancient encounters
    }
    if (encounterType.includes('corrupted')) {
      return 1.1; // +10% for corruption
    }
  }
  
  // Fracture era: Mostly normal encounters, balanced
  if (epochTheme === 'Recovery') {
    if (encounterType.includes('merchant') || encounterType.includes('trader')) {
      return 1.2; // +20% for trade encounters
    }
    if (encounterType.includes('chaos') || encounterType.includes('corrupted')) {
      return 0.8; // -20% for chaos (not yet common)
    }
  }
  
  return 1.0; // Default: no modifier
}

/**
 * Select an encounter from the table based on weighted probability
 * Respects player level range
 */
export function selectEncounterType(
  encounterTable: EncounterTable,
  playerLevel: number,
  seed: number = random(),
  epochTheme?: string
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

  // Calculate weighted probabilities with epoch modifiers
  const totalWeight = availableEncounters.reduce((sum, enc) => {
    const epochMod = getEpochEncounterModifier(enc.name, epochTheme);
    return sum + (enc.spawnWeight * epochMod);
  }, 0);
  
  let roll = seed * totalWeight;

  for (const encounter of availableEncounters) {
    const epochMod = getEpochEncounterModifier(encounter.name, epochTheme);
    const adjustedWeight = encounter.spawnWeight * epochMod;
    if (roll <= adjustedWeight) {
      return encounter;
    }
    roll -= adjustedWeight;
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
  toLocationId: string,
  travelMatrix?: Record<string, Record<string, number>>
): number {
  // If a dynamic travel matrix is provided (from world template), use it first
  if (travelMatrix && travelMatrix[fromLocationId] && travelMatrix[fromLocationId][toLocationId]) {
    return travelMatrix[fromLocationId][toLocationId];
  }

  // Fallback to static distance matrix (prototype legacy)
  const distanceMap: Record<string, Record<string, number>> = {
    'eldergrove-village': {
      'luminara-grand-market': 120, // Ticks are now minutes (2h)
      'forge-summit': 180,
      'moonwell-shrine': 90,
      'thornwood-depths': 150,
      'frozen-lake': 240,
      'abyss-edge': 360
    },
    'forge-summit': {
      'eldergrove-village': 180,
      'frozen-lake': 60,
      'thornwood-depths': 120,
      'abyss-edge': 300
    },
    'thornwood-depths': {
      'eldergrove-village': 150,
      'moonwell-shrine': 60,
      'forge-summit': 120,
      'abyss-edge': 180
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

/**
 * PHASE 14: Apex Entity Definition
 * Mega-bosses that react to generationalParadox and player legitimacy
 */
export interface ApexEntity {
  id: string;
  name: string;
  title: string;  // e.g., "The Void's Echo"
  description: string;
  encounterStages: ApexEncounterStage[];
  currentStage: number;
  baseLevel: number;
  paradoxResonance: number;  // 0-100, increases with generationalParadox
  defeatedBefore: boolean;
  lastEncounterTick?: number;
}

export interface ApexEncounterStage {
  stage: number;
  name: string;
  hpThreshold: number;  // % of full HP to trigger phase shift
  abilities: ApexAbility[];
  description: string;
  environmentalEffect?: string;
}

export interface ApexAbility {
  id: string;
  name: string;
  description: string;
  difficulty: number;  // DC to dodge or resist
  mythStatusRequirement?: number;  // Player must have this much Myth Status to avoid worst effects
  paradoxScaling: number;  // Damage/effect scales with generationalParadox
}

/**
 * M57-A1: Calculate Apex entity's power level based on player's generational paradox
 * Higher paradox = stronger Apex manifestation
 */
export function calculateApexPower(
  state: WorldState,
  baseLevel: number,
  generationalParadox: number
): { level: number; resonance: number; stageModifier: number } {
  // Paradox increases Apex power by up to 50%
  const paradoxMult = 1 + (Math.min(generationalParadox, 100) / 100) * 0.5;
  const adjustedLevel = Math.floor(baseLevel * paradoxMult);

  // Resonance reflects how "real" the Apex feels (higher = more dangerous)
  const resonance = Math.min(100, generationalParadox + 20);

  // Stage modifier: paradox unlocks additional phases
  const stageModifier = Math.floor(generationalParadox / 35);  // 0-2 extra stages at max paradox

  return { level: adjustedLevel, resonance, stageModifier };
}

/**
 * M57-A2: Determine Apex stage shift based on player's Deeds and Myth Status
 * Player legitimacy affects how aggressive the Apex behaves
 */
export function calculateApexPhaseShift(
  state: WorldState,
  apex: ApexEntity,
  playerDeeds: string[],
  playerMythStatus: number,
  currentHpPercent: number
): { stageTransition: boolean; newStage: number; narrativeShift: string } {
  // Base HP threshold for next stage
  const baseThreshold = 75 - apex.currentStage * 20;

  // Player legitimacy reduces Apex aggression
  const legitimacyBonus = playerMythStatus * 0.5;
  const adjustedThreshold = baseThreshold - legitimacyBonus;

  let narrativeShift = '';
  let shouldTransition = false;
  let newStage = apex.currentStage;

  // Check if Apex should shift based on HP
  if (currentHpPercent <= adjustedThreshold && apex.currentStage < apex.encounterStages.length - 1) {
    shouldTransition = true;
    newStage = apex.currentStage + 1;

    // Narrative varies based on player's deed performance
    if (playerDeeds.length > 5) {
      narrativeShift = 'The Apex recognizes your legend and escalates with ancient fury.';
    } else if (playerDeeds.length > 0) {
      narrativeShift = 'The Apex adapts to your threat, revealing new powers.';
    } else {
      narrativeShift = 'The Apex senses weakness and presses the advantage.';
    }
  }

  return {
    stageTransition: shouldTransition,
    newStage,
    narrativeShift
  };
}

/**
 * M57-A3: Generate Apex entity encounter
 * Creates a mega-boss customized to player's current progression
 */
export function generateApexEncounter(
  state: WorldState,
  apexTemplateId: string,
  generationalParadox: number,
  playerDeeds: string[],
  playerMythStatus: number
): ApexEntity {
  // Base Apex templates
  const apexTemplates: Record<string, Partial<ApexEntity>> = {
    'void-echo': {
      name: 'The Void\'s Echo',
      title: 'Manifestation of Chaos',
      description: 'A twisted reflection of cosmic entropy, speaking in fractured memories.',
      baseLevel: 20,
      encounterStages: [
        {
          stage: 0,
          name: 'Awakening',
          hpThreshold: 75,
          abilities: [
            {
              id: 'void-strike',
              name: 'Void Strike',
              description: 'Reality splinters around you',
              difficulty: 18,
              paradoxScaling: 1.2
            },
            {
              id: 'paradox-echo',
              name: 'Paradox Echo',
              description: 'Echoes of your past actions manifest as attacks',
              difficulty: 20,
              mythStatusRequirement: 5,
              paradoxScaling: 0.8
            }
          ],
          environmentalEffect: 'Reality warps and flickers'
        },
        {
          stage: 1,
          name: 'Escalation',
          hpThreshold: 40,
          abilities: [
            {
              id: 'void-rupture',
              name: 'Void Rupture',
              description: 'Tearing a rift in space itself',
              difficulty: 22,
              mythStatusRequirement: 10,
              paradoxScaling: 1.4
            }
          ],
          environmentalEffect: 'The world becomes unstable'
        },
        {
          stage: 2,
          name: 'Convergence',
          hpThreshold: 0,
          abilities: [
            {
              id: 'apex-convergence',
              name: 'Apex Convergence',
              description: 'All paradox focuses through one devastating blow',
              difficulty: 25,
              mythStatusRequirement: 20,
              paradoxScaling: 2.0
            }
          ],
          environmentalEffect: 'Reality collapses inward'
        }
      ]
    },
    'the-architect': {
      name: 'The Architect',
      title: 'Builder of Fates',
      description: 'An entity that shapes destinies through intricate patterns.',
      baseLevel: 22,
      encounterStages: [
        {
          stage: 0,
          name: 'Design Phase',
          hpThreshold: 70,
          abilities: [
            {
              id: 'geometric-assault',
              name: 'Geometric Assault',
              description: 'Intricate patterns that maim and confuse',
              difficulty: 19,
              paradoxScaling: 1.0
            }
          ],
          environmentalEffect: 'Patterns of light surround you'
        }
      ]
    }
  };

  const template = apexTemplates[apexTemplateId];
  if (!template) {
    throw new Error(`Unknown Apex template: ${apexTemplateId}`);
  }

  const { level, resonance, stageModifier } = calculateApexPower(state, template.baseLevel || 20, generationalParadox);

  const apex: ApexEntity = {
    id: `apex-${apexTemplateId}-${state.tick || 0}`,
    name: template.name || 'Unknown Apex',
    title: template.title || '',
    description: template.description || '',
    encounterStages: template.encounterStages || [],
    currentStage: 0,
    baseLevel: level,
    paradoxResonance: resonance,
    defeatedBefore: false
  };

  return apex;
}

/**
 * M57-A4: Resolve an Apex ability roll (damage/effect with paradox scaling)
 */
export function resolveApexAbility(
  ability: ApexAbility,
  playerMythStatus: number,
  generationalParadox: number,
  playerDefenseRoll: number
): { isHit: boolean; damage: number; narrativeEffect: string } {
  // Paradox scales the ability power
  const paradoxMult = 1 + (generationalParadox / 100) * ability.paradoxScaling;
  const baseDamage = 10 + Math.floor(random() * 20);
  const scaledDamage = Math.floor(baseDamage * paradoxMult);

  // Player's Myth Status can mitigate damage
  const mythMitigation = playerMythStatus * 0.3;
  const finalDamage = Math.max(1, scaledDamage - mythMitigation);

  // If ability has myth requirement, Myth Status grants dodge chance
  let isHit = playerDefenseRoll < ability.difficulty;
  if (ability.mythStatusRequirement && playerMythStatus >= ability.mythStatusRequirement) {
    // Myth Status gives 20% dodge bonus
    isHit = playerDefenseRoll < (ability.difficulty - 4);
  }

  const narrativeEffect = isHit
    ? `${ability.name} connects! ${finalDamage.toFixed(0)} damage taken.`
    : `${ability.name} narrowly misses due to your legend's protection.`;

  return { isHit, damage: isHit ? finalDamage : 0, narrativeEffect };
}
