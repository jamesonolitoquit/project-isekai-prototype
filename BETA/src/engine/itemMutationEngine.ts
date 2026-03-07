/**
 * Phase 44: Item Mutation Engine (Echo Imprinting & Equipment Resonance)
 *
 * This engine manages:
 * - Echo Imprinting: Items gain traits based on significant events (boss kills, element exposure, etc.)
 * - Equipment Resonance: Items matching the current codec's genre gain efficiency bonuses
 * - Dynamic Stat Calculation: Stats are no longer static; they mutate with echoes
 * - Proficiency Unlocking: High proficiencies unlock dormant traits on equipment
 */

import type { PlayerState, WorldState, UniqueItem } from './worldEngine';
import type { NarrativeCodec } from '../client/services/themeManager';

// ============= Type Definitions =============

/**
 * Echo: A trait "imprinted" onto an item through significant events
 * Echoes can be:
 * - Elemental: Fire-Touched, Frost-Singed, Storm-Rent, Void-Rendered
 * - Alignment: Blessed, Corrupted, Purified, Tainted
 * - Event-Based: Boss-Slayer, Dragon-Bane, Soul-Bound
 * - Codec-Derived: Noir-Worn, Medieval-Blessed, Cyberpunk-Stripped
 */
export interface Echo {
  echoId: string;                      // Unique echo identifier
  name: string;                        // Display name (e.g., "Void-Rendered")
  description: string;                 // Flavor text
  eventTrigger: string;                // Event that caused imprint (e.g., "kill_void_boss", "exposed_to_flame")
  statModifiers?: Record<string, number>; // +5 STR, -2 INT, etc.
  abilityMods?: Array<{ abilityId: string; costModifier?: number; damageModifier?: number }>;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  timestamp?: number;                  // When echo was imprinted (tick)
}

/**
 * Equipment Genre: Codec-style categorization for equipment
 */
export type EquipmentGenre = 
  | 'high-fantasy'
  | 'medieval-steel'
  | 'industrial-noir'
  | 'cyber-neon'
  | 'solarpunk-organic'
  | 'voidsync-cosmic'
  | 'glitch-digital'
  | 'vintage-brass'
  | 'storybook-whimsy'
  | 'dreamscape-surreal';

/**
 * Codec-to-Genre Mapping
 * Used for Equipment Resonance checks
 */
export const CODEC_GENRE_MAP: Record<NarrativeCodec, EquipmentGenre> = {
  'CODENAME_MEDIEVAL': 'medieval-steel',
  'CODENAME_GLITCH': 'glitch-digital',
  'CODENAME_MINIMAL': 'high-fantasy',
  'CODENAME_CYBERPUNK': 'cyber-neon',
  'CODENAME_SOLARPUNK': 'solarpunk-organic',
  'CODENAME_VOIDSYNC': 'voidsync-cosmic',
  'CODENAME_NOIR': 'industrial-noir',
  'CODENAME_OVERLAND': 'high-fantasy',
  'CODENAME_VINTAGE': 'vintage-brass',
  'CODENAME_STORYBOOK': 'storybook-whimsy',
  'CODENAME_DREAMSCAPE': 'dreamscape-surreal'
};

/**
 * Echo Event Triggers & Rarities
 */
const ECHO_LIBRARY: Record<string, Partial<Echo>> = {
  'void-rendered': {
    name: 'Void-Rendered',
    description: 'Touched by the infinite void. This weapon destabilizes matter.',
    statModifiers: { int: 3, perception: 2, endurance: -1 },
    rarity: 'epic'
  },
  'frost-singed': {
    name: 'Frost-Singed',
    description: 'Bathed in primordial ice. The wielder strikes with cold calculation.',
    statModifiers: { agi: 2, int: 1, str: -1 },
    rarity: 'rare'
  },
  'solar-singed': {
    name: 'Solar-Singed',
    description: 'Scorched by elemental flame. Heat radiates from the blade.',
    statModifiers: { str: 3, end: 1, agi: -1 },
    rarity: 'rare'
  },
  'storm-rent': {
    name: 'Storm-Rent',
    description: 'Split by lightning and thunder. Energy crackles along the edge.',
    statModifiers: { agi: 3, int: 2 },
    rarity: 'epic'
  },
  'soul-bound': {
    name: 'Soul-Bound',
    description: 'Imprinted with the essence of a defeated foe. The weapon remembers.',
    statModifiers: { int: 4, cha: 2, luk: 1 },
    rarity: 'legendary'
  },
  'blessed': {
    name: 'Blessed',
    description: 'Sanctified by divine grace. Radiates holy light.',
    statModifiers: { cha: 3, end: 2 },
    rarity: 'rare'
  },
  'corrupted': {
    name: 'Corrupted',
    description: 'Twisted by dark energies. Power flows from shadow.',
    statModifiers: { int: 3, luk: 2, str: 1 },
    rarity: 'rare'
  }
};

// ============= Core Functions =============

/**
 * Imprint an echo onto an item based on a significant event
 * @param item The item to imprint
 * @param eventTrigger The event that caused the imprint
 * @param currentTick Current world tick
 * @returns Modified item with new echo
 */
export function imprintEcho(
  item: UniqueItem,
  eventTrigger: string,
  currentTick: number
): UniqueItem {
  if (item.kind !== 'unique') return item;

  // Initialize metadata if needed
  if (!item.metadata) {
    item.metadata = {};
  }

  // Initialize echoes array if needed
  if (!item.metadata.echoes) {
    item.metadata.echoes = [];
  }

  // Prevent duplicate echoes of same type
  const echoId = eventTrigger.replace(/^(kill|defeat|exposed_to)_/, '');
  if (item.metadata.echoes.some(e => e.echoId === echoId)) {
    return item; // Already imprinted
  }

  // Look up echo in library
  const echoTemplate = ECHO_LIBRARY[echoId];
  if (!echoTemplate) {
    return item; // Unknown event, no echo
  }

  // Create new echo
  const newEcho: Echo = {
    echoId,
    name: echoTemplate.name || echoId,
    description: echoTemplate.description || 'Unknown echo',
    eventTrigger,
    statModifiers: echoTemplate.statModifiers,
    rarity: echoTemplate.rarity || 'common',
    timestamp: currentTick
  };

  // Add to item's echoes
  item.metadata.echoes.push(newEcho);

  return item;
}

/**
 * Calculate mutated stats for an equipped item
 * Accounts for: base stats, echoes, proficiency bonuses, and resonance
 */
export function calculateMutatedStats(
  item: UniqueItem,
  itemTemplate: any,
  proficiencyLevel: number,
  resonanceMultiplier: number = 1.0
): Record<string, number> {
  const baseStats = itemTemplate.stats || {};
  const mutatedStats = { ...baseStats };

  // Apply echo stat modifiers
  if (item.metadata?.echoes) {
    item.metadata.echoes.forEach(echo => {
      if (echo.statModifiers) {
        Object.entries(echo.statModifiers).forEach(([stat, modifier]) => {
          if (typeof modifier === 'number') {
            mutatedStats[stat] = (mutatedStats[stat] || 0) + modifier;
          }
        });
      }
    });
  }

  // Apply proficiency-based scaling
  // High proficiency unlocks and amplifies item effectiveness
  const proficiencyBonus = Math.max(0, (proficiencyLevel - 10) * 0.05); // +5% per level above 10
  Object.keys(mutatedStats).forEach(stat => {
    mutatedStats[stat] = mutatedStats[stat] * (1 + proficiencyBonus);
  });

  // Apply codec resonance multiplier
  // Items matching current codec get +15% effectiveness
  Object.keys(mutatedStats).forEach(stat => {
    mutatedStats[stat] = mutatedStats[stat] * resonanceMultiplier;
  });

  return mutatedStats;
}

/**
 * Check if an item resonates with the current codec
 * Returns resonance multiplier (1.15 for match, 1.0 for mismatch)
 */
export function getEquipmentResonance(
  itemGenre: EquipmentGenre,
  currentCodec: NarrativeCodec
): number {
  const codecGenre = CODEC_GENRE_MAP[currentCodec];
  
  // Direct genre match: +15% effectiveness, -10% AP cost
  if (itemGenre === codecGenre) {
    return 1.15;
  }

  // Cross-codec affinity (e.g., high-fantasy works in Medieval)
  const affinities: Record<EquipmentGenre, EquipmentGenre[]> = {
    'high-fantasy': ['medieval-steel', 'storybook-whimsy'],
    'medieval-steel': ['high-fantasy'],
    'industrial-noir': ['glitch-digital', 'cyber-neon'],
    'cyber-neon': ['industrial-noir', 'glitch-digital'],
    'solarpunk-organic': ['high-fantasy', 'storybook-whimsy'],
    'voidsync-cosmic': ['glitch-digital', 'dreamscape-surreal'],
    'glitch-digital': ['cyber-neon', 'industrial-noir', 'voidsync-cosmic'],
    'vintage-brass': ['industrial-noir', 'high-fantasy'],
    'storybook-whimsy': ['high-fantasy', 'solarpunk-organic'],
    'dreamscape-surreal': ['voidsync-cosmic', 'storybook-whimsy']
  };

  if (affinities[codecGenre]?.includes(itemGenre)) {
    return 1.05; // Partial affinity: +5%
  }

  // No resonance
  return 1.0;
}

/**
 * Get AP cost modifier for equipment based on resonance
 * Resonant items cost less AP to use
 */
export function getEquipmentAPCostModifier(resonanceMultiplier: number): number {
  if (resonanceMultiplier >= 1.15) {
    return 0.9; // -10% AP cost for resonant items
  }
  if (resonanceMultiplier >= 1.05) {
    return 0.95; // -5% AP cost for affinity items
  }
  return 1.0; // No modifier for non-resonant items
}

/**
 * Unlock dormant traits on equipment based on proficiency
 * High proficiency reveals hidden abilities
 */
export function unlockDormantTraits(
  item: UniqueItem,
  proficiencyLevel: number,
  proficiencyCategory: string
): string[] {
  const unlockedTraits: string[] = [];

  // Define proficiency thresholds for trait unlock
  const traitThresholds: Record<string, number> = {
    'shadow-strike': 12,      // Stealth weapon at level 12+
    'void-beam': 15,          // Magic staff at level 15+
    'life-drain': 15,         // Dark weapon at level 15+
    'elemental-burst': 13,    // Staff at level 13+
    'critical-precision': 14, // Scythe/Dagger at level 14+
    'crushing-force': 11      // Heavy weapon at level 11+
  };

  // Check which traits unlock at current proficiency level
  Object.entries(traitThresholds).forEach(([trait, threshold]) => {
    if (proficiencyLevel >= threshold) {
      unlockedTraits.push(trait);
    }
  });

  return unlockedTraits;
}

/**
 * Get echo descriptions for an item's metadata display
 */
export function getEchoDescriptions(item: UniqueItem): string[] {
  if (!item.metadata?.echoes) return [];
  
  return item.metadata.echoes.map(echo => {
    const rarityEmoji = {
      'common': '○',
      'uncommon': '◑',
      'rare': '◐',
      'epic': '●',
      'legendary': '✦'
    };
    
    return `${rarityEmoji[echo.rarity] || '○'} ${echo.name}: ${echo.description}`;
  });
}

/**
 * Calculate total stat bonuses for an equipped set
 * Accounts for all resonance, proficiency, and echo effects
 */
export function getEquipmentBonusesWithMutation(
  equipment: Record<string, string>,
  itemTemplates: Record<string, any>,
  itemInstances: Map<string, UniqueItem>,
  player: PlayerState,
  currentCodec: NarrativeCodec
): Record<string, number> {
  const bonuses: Record<string, number> = {
    str: 0,
    agi: 0,
    int: 0,
    cha: 0,
    end: 0,
    luk: 0,
    perception: 0
  };

  if (!equipment) return bonuses;

  Object.values(equipment).forEach((itemId: string) => {
    if (!itemId) return;

    const template = itemTemplates[itemId];
    if (!template || !template.stats) return;

    // Get unique instance if available
    const uniqueInstance = itemInstances?.get(itemId);
    
    // Determine proficiency bonus
    let proficiencyBonus = 0;
    const proficiencyCategory = template.proficiencyCategory;
    if (proficiencyCategory && player.proficiencies?.[proficiencyCategory]) {
      proficiencyBonus = player.proficiencies[proficiencyCategory].level;
    }

    // Check resonance
    const itemGenre = template.genre || 'high-fantasy';
    const resonance = getEquipmentResonance(itemGenre, currentCodec);

    // Calculate mutated stats (or use base if no unique instance)
    let statBonuses: Record<string, number>;
    if (uniqueInstance && uniqueInstance.kind === 'unique') {
      statBonuses = calculateMutatedStats(uniqueInstance, template, proficiencyBonus, resonance);
    } else {
      statBonuses = { ...template.stats };
      Object.keys(statBonuses).forEach(stat => {
        statBonuses[stat] *= resonance;
      });
    }

    // Add to total bonuses
    Object.entries(statBonuses).forEach(([stat, value]) => {
      bonuses[stat] = (bonuses[stat] || 0) + value;
    });
  });

  return bonuses;
}

/**
 * Serialize echoes array for JSON storage
 * Converts to plain objects for serialization
 */
export function serializeEchoes(echoes: Echo[]): any[] {
  return echoes.map(echo => ({
    ...echo,
    statModifiers: echo.statModifiers ? Object.entries(echo.statModifiers) : []
  }));
}

/**
 * Deserialize echoes array from JSON storage
 */
export function deserializeEchoes(data: any[]): Echo[] {
  return data.map(echoDat => ({
    ...echoDat,
    statModifiers: echoDat.statModifiers 
      ? Object.fromEntries(echoDat.statModifiers)
      : {}
  }));
}
