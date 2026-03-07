import type { Event } from '../events/mutationLog';
import type { CoreAttributes } from '../types/attributes';
import { getAncestryTree } from './ancestryRegistry';
import type { WorldTemplate } from './worldEngine';

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use CoreAttributes instead
 */
export type CharacterStats = CoreAttributes;

export interface PlayerCharacter {
  id: string;
  name: string;
  race: string;
  stats: CoreAttributes;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  grit: number;
  maxGrit: number;
  gold: number;
  location: string;
  quests: Record<string, any>;
  reputation: Record<string, number>;
  dialogueHistory: any[];
  inventory?: any[];
  equipment?: Record<string, string>;  // Equipment slots (head, chest, mainHand, etc.)
  knowledgeBase?: string[];
  visitedLocations?: string[];
  beliefLayer?: { npcLocations: Record<string, string>; npcStats: Record<string, any>; facts: Record<string, boolean>; suspicionLevel: number };
  // Phase 5: Heroic Awakening
  originStory?: string;      // Narrative backstory for AI Weaver
  archetype?: string;         // e.g., 'exiled-noble', 'wandering-scholar', 'cursed-smith'
  talents?: string[];         // Unique innate abilities
  talentDetails?: Record<string, { name: string; description: string; effect: string }>;
  // Phase 47: Ancestral Tapestry
  ancestryTree?: string;      // ID of the active ancestry tree (tied to race and world template)
  ancestryNodes?: string[];   // Array of unlocked ancestry node IDs
}

export const STAT_POINTS_AVAILABLE = 20;

/**
 * Generate default stats for a new character
 * Returns 8 core stats + luck (9-stat foundation)
 * All stats start at 10 (average human)
 */
export function generateDefaultStats(): CoreAttributes {
  return {
    STR: 10,
    DEX: 10,
    AGI: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
    PER: 10
  };
}

/**
 * Validate stat allocation (must sum to 80 with 20 points to distribute across 8 irreducible core stats)
 */
export function validateStatAllocation(stats: CoreAttributes): boolean {
  // Sum the 8 irreducible core stats (STR, DEX, AGI, CON, INT, WIS, CHA, PER)
  const coreStats = stats.STR + stats.DEX + stats.AGI + stats.CON + stats.INT + stats.WIS + stats.CHA + stats.PER;
  const pointsUsed = coreStats - 80; // 8 * 10 = 80 base

  return (
    pointsUsed >= 0 &&
    pointsUsed <= STAT_POINTS_AVAILABLE &&
    stats.STR >= 1 &&
    stats.DEX >= 1 &&
    stats.AGI >= 1 &&
    stats.CON >= 1 &&
    stats.INT >= 1 &&
    stats.WIS >= 1 &&
    stats.CHA >= 1 &&
    stats.PER >= 1
  );
}

/**
 * Create a new player character
 * Phase 47: Ancestry initialization from world template
 * 
 * HP Formula: 20 + (CON * 2) + floor(WIS / 3)
 * MP Formula: 50 + (INT * 5) + (CHA * 2)
 */
export function createPlayerCharacter(
  name: string,
  race: string,
  baseStats: CoreAttributes,
  startingLocation: string = 'Eldergrove Village',
  originStory?: string,
  archetype?: string,
  talents?: string[],
  template?: WorldTemplate,  // Phase 47: World template for ancestry tree lookup
  startingGearId?: string,   // Starting gear selection from character wizard
  startingGearChoices?: any[] // Available gear choices with equipmentSlot
): PlayerCharacter {
  if (!validateStatAllocation(baseStats)) {
    throw new Error('Invalid stat allocation');
  }

  const stats = applyRacialModifiers(baseStats, race);

  // Updated formulas for 8-stat system (using CoreAttributes)
  // HP = Base + Constitution bonus + Wisdom bonus
  const maxHp = 20 + (stats.CON * 2) + Math.floor(stats.WIS / 3);
  // MP = Base + Intelligence bonus + Charisma bonus
  const maxMp = 50 + (stats.INT * 5) + (stats.CHA * 2);
  // Grit (Endurance/Willpower) = Base + Constitution bonus + Wisdom bonus
  const maxGrit = 30 + (stats.CON * 2) + Math.floor(stats.WIS * 1.5);

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

  // Phase 47: Initialize ancestry tree and nodes
  const ancestryTree = getAncestryTree(template, race);
  const ancestryTreeId = ancestryTree?.id;

  // Initialize equipment with starting gear
  const equipment: Record<string, string> = {};
  if (startingGearId && startingGearChoices) {
    const selectedGear = startingGearChoices.find((g: any) => g.id === startingGearId);
    if (selectedGear && selectedGear.equipmentSlot) {
      // Use the equipmentSlot from the gear choice (e.g., "chest", "mainHand")
      equipment[selectedGear.equipmentSlot] = startingGearId;
    }
  }

  return {
    id: `player_${name.toLowerCase().replace(/\s+/g, '_')}_0`,
    name,
    race,
    stats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    grit: maxGrit,
    maxGrit,
    gold: 0,
    location: startingLocation,
    quests: {},
    reputation: {},
    dialogueHistory: [],
    inventory: [],
    equipment,  // Now includes starting gear in correct slot
    knowledgeBase,
    visitedLocations,
    beliefLayer,
    // Phase 5: Heroic Awakening
    originStory: originStory || '',
    archetype: archetype || 'adventurer',
    talents: talents || [],
    talentDetails: mapTalentDetails(talents || []),
    // Phase 47: Ancestral Tapestry initialization
    ancestryTree: ancestryTreeId,
    ancestryNodes: []  // Start with no unlocked nodes; player must unlock them in game
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
 * Each race has specific stat bonuses/penalties reflecting their nature
 */
export function applyRacialModifiers(baseStats: CoreAttributes, race: string): CoreAttributes {
  const stats = { ...baseStats };

  switch (race.toLowerCase()) {
    case 'elf':
      // Elves are dexterous and perceptive, but less strong
      stats.AGI += 2;
      stats.PER += 1;
      stats.STR -= 1;
      break;
    case 'dwarf':
      // Dwarves are sturdy and perceptive of hazards, but less agile
      stats.CON += 2;
      stats.PER += 1;
      stats.AGI -= 1;
      break;
    case 'orc':
      // Orcs are strong but intellectually challenging, less subtle
      stats.STR += 2;
      stats.INT -= 1;
      stats.PER -= 1;
      break;
    case 'human':
    default:
      // Humans are balanced, no modifiers
      break;
  }

  return stats;
}

// =========================================================================
// PHASE 5: Heroic Awakening - Archetypes & Talents
// =========================================================================

export interface Archetype {
  id: string;
  name: string;
  description: string;
  startingLocation: string;
  statModifiers?: Partial<CoreAttributes>;
  startingEquipment?: string[];
}

export const ARCHETYPES: Record<string, Archetype> = {
  'exiled-noble': {
    id: 'exiled-noble',
    name: 'Exiled Noble',
    description: 'Once blessed with power and privilege, now seeking redemption.',
    startingLocation: 'Luminara Grand Market',
    statModifiers: { CHA: 2, CON: 1, INT: -1 }
  },
  'wandering-scholar': {
    id: 'wandering-scholar',
    name: 'Wandering Scholar',
    description: 'A seeker of knowledge, forever curious about the world\'s mysteries.',
    startingLocation: 'Moonwell Shrine',
    statModifiers: { INT: 2, PER: 2, STR: -1 }
  },
  'cursed-smith': {
    id: 'cursed-smith',
    name: 'Cursed Smith',
    description: 'A master craftsperson bound by a temporal curse, seeking salvation.',
    startingLocation: 'Forge Summit',
    statModifiers: { STR: 2, CON: 1, PER: -1 }
  },
  'forest-hermit': {
    id: 'forest-hermit',
    name: 'Forest Hermit',
    description: 'One who fled civilization to commune with nature and spirits.',
    startingLocation: 'Eldergrove Village',
    statModifiers: { PER: 2, AGI: 1, CHA: -1 }
  },
  'shadow-thief': {
    id: 'shadow-thief',
    name: 'Shadow Thief',
    description: 'A master of stealth and deception, haunted by past crimes.',
    startingLocation: 'Thornwood Depths',
    statModifiers: { AGI: 2, PER: 1, STR: -1 }
  },
  'battlefield-veteran': {
    id: 'battlefield-veteran',
    name: 'Battlefield Veteran',
    description: 'A survivor of countless wars, seeking purpose beyond violence.',
    startingLocation: 'Luminara Grand Market',
    statModifiers: { STR: 2, CON: 1, CHA: -1 }
  }
};

export const TALENTS: Record<string, { name: string; description: string; effect: string }> = {
  'midas-touch': {
    name: 'Midas Touch',
    description: 'Your commerce always yields higher profits.',
    effect: 'gold_multiplier_1.2'
  },
  'shadow-stalk': {
    name: 'Shadow Stalk',
    description: 'Move undetected through darkness and crowds.',
    effect: 'stealth_bonus_25'
  },
  'primal-fear': {
    name: 'Primal Fear',
    description: 'Enemies hesitate when they face your presence.',
    effect: 'intimidation_bonus_20'
  },
  'arcane-insight': {
    name: 'Arcane Insight',
    description: 'Detect and decipher magical auras.',
    effect: 'magic_detection_30'
  },
  'ancient-lineage': {
    name: 'Ancient Lineage',
    description: 'NPCs recognize bloodlines of power in you.',
    effect: 'reputation_boost_10'
  },
  'cursed-fortune': {
    name: 'Cursed Fortune',
    description: 'Luck swings wildly; great rewards or grave consequences.',
    effect: 'luck_variance_high'
  },
  'healer\'s-blessing': {
    name: '\'Healer\'s Blessing',
    description: 'Herbs and potions are more potent in your hands.',
    effect: 'healing_bonus_25'
  },
  'spirit-ward': {
    name: 'Spirit Ward',
    description: 'Supernatural entities regard you with caution.',
    effect: 'spirit_protection_15'
  }
};

function mapTalentDetails(talentIds: string[]): Record<string, { name: string; description: string; effect: string }> {
  const result: Record<string, { name: string; description: string; effect: string }> = {};
  talentIds.forEach(id => {
    if (TALENTS[id]) {
      result[id] = TALENTS[id];
    }
  });
  return result;
}

export function getArchetype(id: string): Archetype | undefined {
  return ARCHETYPES[id];
}

export function getAvailableArchetypes(): Archetype[] {
  return Object.values(ARCHETYPES);
}

export function getAvailableTalents(): Array<{ id: string; name: string; description: string; effect: string }> {
  return Object.entries(TALENTS).map(([id, talent]) => ({ id, ...talent }));
}
