/**
 * Phase 38: Narrative Card Registry
 * 
 * Maps core AbilityDefinitions to era-specific "Visual Lenses"
 * Each ability can be rendered with different titles, flavor text, and materials
 * based on the active Narrative Codec (e.g., Medieval, Noir, Cyberpunk, etc.)
 * 
 * Architecture:
 * - Core Ability (engine rules) → Visual Lens (codec-specific presentation)
 * - Cards inherit cooldown, mana cost, effect type from parent ability
 * - Card appearance (title, description, material) determined by codec theme
 * 
 * Phase 38: Initial codec support (Medieval, Cyberpunk, Noir, Steampunk)
 * Phase 40: Dynamic codec themes with per-epoch material profiles
 */

import type { AbilityDefinition } from './abilityResolver';
import { ABILITY_DATABASE } from './abilityResolver';

/** Phase 38: Visual encoding of a card in a specific era/codec */
export interface NarrativeCard {
  // Engine References
  abilityId: string;          // Links to ABILITY_DATABASE entry
  ability: AbilityDefinition;  // Full ability definition
  
  // Visual Codec-Specific Properties
  codecId: 'medieval' | 'cyberpunk' | 'noir' | 'steampunk' | 'generic';
  
  // UI Text (codec-specific titles)
  cardTitle: string;          // "Fireball" → "Incendiary Round" (Noir), "Blaster Charge" (Cyberpunk)
  cardDescription: string;    // Flavor text matching codec aesthetic
  
  // Material & Appearance
  materialProfile: {
    background: string;       // "parchment", "carbon-fiber", "weathered-paper", "brass-gears"
    borderColor: string;       // CSS color (rgba)
    textColor: string;         // CSS color
    accentColor: string;       // Highlight color for card type
    glyphEmoji: string;        // Thematic emoji (🔥 for fire, ⚡ for electric, etc.)
  };
  
  // Card Classification
  cardType: 'offensive' | 'defensive' | 'utility' | 'healing';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  
  // Gameplay Properties (inherited from ability, but displayable on card UI)
  manaCost: number;
  cooldownTicks: number;
  effectSummary: string;      // One-line effect description for card hover
}

// ============================================================================
// MATERIAL PROFILES (Codec-specific visual templates)
// ============================================================================

interface MaterialProfile {
  background: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
}

const MATERIAL_PROFILES: Record<string, Record<string, MaterialProfile>> = {
  offensive: {
    medieval: {
      background: 'rgba(139, 35, 69, 0.3)',      // Dark red parchment
      borderColor: 'rgba(220, 20, 60, 0.6)',     // Crimson
      textColor: '#e8b4b4',
      accentColor: '#ff4444'
    },
    cyberpunk: {
      background: 'rgba(0, 50, 50, 0.4)',        // Dark cyan carbon
      borderColor: 'rgba(0, 255, 200, 0.8)',     // Cyan neon
      textColor: '#00ff00',
      accentColor: '#ff00ff'
    },
    noir: {
      background: 'rgba(20, 20, 30, 0.5)',       // Dark film noir
      borderColor: 'rgba(200, 200, 200, 0.4)',   // Grayscale
      textColor: '#cccccc',
      accentColor: '#ffff00'
    },
    steampunk: {
      background: 'rgba(80, 60, 40, 0.3)',       // Brass/brass-stained
      borderColor: 'rgba(184, 134, 11, 0.6)',    // Dark goldenrod
      textColor: '#daa520',
      accentColor: '#ff8c00'
    },
    generic: {
      background: 'rgba(50, 50, 100, 0.3)',      // Blue-purple
      borderColor: 'rgba(100, 100, 255, 0.5)',
      textColor: '#b0b0d0',
      accentColor: '#6666ff'
    }
  },
  defensive: {
    medieval: {
      background: 'rgba(70, 100, 70, 0.3)',      // Green metal
      borderColor: 'rgba(50, 150, 50, 0.6)',     // Forest green
      textColor: '#a8d5a8',
      accentColor: '#00ff00'
    },
    cyberpunk: {
      background: 'rgba(30, 30, 60, 0.4)',       // Blue-black
      borderColor: 'rgba(0, 200, 255, 0.8)',     // Cyan electric
      textColor: '#00ffff',
      accentColor: '#0088ff'
    },
    noir: {
      background: 'rgba(30, 30, 40, 0.5)',
      borderColor: 'rgba(150, 150, 180, 0.4)',
      textColor: '#b0b0d0',
      accentColor: '#00ccff'
    },
    steampunk: {
      background: 'rgba(90, 80, 60, 0.3)',       // Darker brass
      borderColor: 'rgba(200, 150, 0, 0.6)',     // Golden
      textColor: '#e6c200',
      accentColor: '#ffcc00'
    },
    generic: {
      background: 'rgba(70, 100, 150, 0.3)',     // Blue shield
      borderColor: 'rgba(100, 150, 255, 0.5)',
      textColor: '#b0d0ff',
      accentColor: '#6699ff'
    }
  },
  healing: {
    medieval: {
      background: 'rgba(100, 70, 120, 0.3)',     // Mystic purple
      borderColor: 'rgba(200, 100, 255, 0.6)',   // Violet
      textColor: '#d4a5ff',
      accentColor: '#ff00ff'
    },
    cyberpunk: {
      background: 'rgba(80, 40, 100, 0.4)',      // Purple tech
      borderColor: 'rgba(255, 0, 255, 0.8)',     // Magenta
      textColor: '#ff00ff',
      accentColor: '#ff00ff'
    },
    noir: {
      background: 'rgba(50, 30, 60, 0.5)',       // Purple noir
      borderColor: 'rgba(180, 100, 200, 0.4)',   // Light purple
      textColor: '#d4a5ff',
      accentColor: '#ff99ff'
    },
    steampunk: {
      background: 'rgba(120, 100, 80, 0.3)',     // Copper tone
      borderColor: 'rgba(220, 140, 60, 0.6)',    // Copper
      textColor: '#e6a560',
      accentColor: '#ffaa00'
    },
    generic: {
      background: 'rgba(100, 120, 100, 0.3)',    // Green life
      borderColor: 'rgba(150, 200, 150, 0.5)',
      textColor: '#b0e0b0',
      accentColor: '#00ff00'
    }
  },
  utility: {
    medieval: {
      background: 'rgba(100, 90, 60, 0.3)',      // Brown scroll
      borderColor: 'rgba(160, 120, 80, 0.6)',    // Tan
      textColor: '#d4c0a0',
      accentColor: '#ffcc99'
    },
    cyberpunk: {
      background: 'rgba(40, 40, 40, 0.4)',       // Gray circuit
      borderColor: 'rgba(150, 150, 150, 0.8)',   // Silver
      textColor: '#cccccc',
      accentColor: '#ffffff'
    },
    noir: {
      background: 'rgba(40, 40, 50, 0.5)',       // Gray noir
      borderColor: 'rgba(120, 120, 140, 0.4)',
      textColor: '#a0a0b0',
      accentColor: '#ffffff'
    },
    steampunk: {
      background: 'rgba(100, 100, 100, 0.3)',    // Steel gray
      borderColor: 'rgba(180, 180, 180, 0.6)',   // Light gray
      textColor: '#d0d0d0',
      accentColor: '#e0e0e0'
    },
    generic: {
      background: 'rgba(100, 100, 100, 0.3)',    // Gray utility
      borderColor: 'rgba(150, 150, 150, 0.5)',
      textColor: '#c0c0c0',
      accentColor: '#e0e0e0'
    }
  }
};

// ============================================================================
// CODEC-SPECIFIC ABILITY LENSES
// ============================================================================

interface CodecLens {
  title: string;
  description: string;
  glyphEmoji: string;
}

const CODEC_LENSES: Record<string, Record<string, CodecLens>> = {
  medieval: {
    // Stage 8.95: Base tactical actions
    'attack': {
      title: 'Strike',
      description: 'Basic melee attack with equipped weapon',
      glyphEmoji: '⚔️'
    },
    'interact': {
      title: 'Handle',
      description: 'Examine or manipulate nearby objects',
      glyphEmoji: '🤲'
    },
    'search': {
      title: 'Investigate',
      description: 'Search area for hidden items and secrets',
      glyphEmoji: '🔍'
    },
    'fireball': {
      title: 'Inferno Blast',
      description: 'Summon a massive explosion of mystical flame',
      glyphEmoji: '🔥'
    },
    'frost-nova': {
      title: 'Frozen Tomb',
      description: 'Crystallize enemies in shards of ancient ice',
      glyphEmoji: '❄️'
    },
    'heal': {
      title: 'Holy Mend',
      description: 'Invoke divine magic to restore vitality',
      glyphEmoji: '✨'
    },
    'shield-spell': {
      title: 'Ward of Stone',
      description: 'Conjure magical protection',
      glyphEmoji: '🛡️'
    },
    'teleport': {
      title: 'Arcane Step',
      description: 'Vanish and reappear elsewhere',
      glyphEmoji: '💫'
    }
  },
  cyberpunk: {
    // Stage 8.95: Base tactical actions
    'attack': {
      title: 'Execute',
      description: 'Basic melee combat protocol',
      glyphEmoji: '⚡'
    },
    'interact': {
      title: 'Interface',
      description: 'Interact with electronic systems',
      glyphEmoji: '🖥️'
    },
    'search': {
      title: 'Scan',
      description: 'Scan area for valuable data/items',
      glyphEmoji: '📡'
    },
    'fireball': {
      title: 'Incendiary Burst',
      description: 'Deploy explosive energy charge',
      glyphEmoji: '⚡'
    },
    'frost-nova': {
      title: 'Cryo-Stun Field',
      description: 'Emit freezing electromagnetic pulse',
      glyphEmoji: '❄️'
    },
    'heal': {
      title: 'Bio-Sync Protocol',
      description: 'Restore neural/cellular integrity',
      glyphEmoji: '🔧'
    },
    'shield-spell': {
      title: 'Defense Matrix',
      description: 'Activate protective energy barrier',
      glyphEmoji: '🛡️'
    },
    'teleport': {
      title: 'Quantum Shift',
      description: 'Phase through space via quantum tunneling',
      glyphEmoji: '💫'
    }
  },
  noir: {
    // Stage 8.95: Base tactical actions
    'attack': {
      title: 'Punch it',
      description: 'Basic hand-to-hand combat',
      glyphEmoji: '👊'
    },
    'interact': {
      title: 'Inspect',
      description: 'Examine something up close',
      glyphEmoji: '🔎'
    },
    'search': {
      title: 'Shake Down',
      description: 'Thoroughly search a location',
      glyphEmoji: '🔍'
    },
    'fireball': {
      title: 'Hot Lead',
      description: 'Plant explosive charges on target',
      glyphEmoji: '💣'
    },
    'frost-nova': {
      title: 'Freeze Play',
      description: 'Immobilize target with sedatives',
      glyphEmoji: '💉'
    },
    'heal': {
      title: 'First Aid',
      description: 'Patch wounds and stop bleeding',
      glyphEmoji: '🩹'
    },
    'shield-spell': {
      title: 'Cover Fire',
      description: 'Create tactical defensive position',
      glyphEmoji: '🏚️'
    },
    'teleport': {
      title: 'Quick Escape',
      description: 'Vanish into the urban shadows',
      glyphEmoji: '💨'
    }
  },
  steampunk: {
    // Stage 8.95: Base tactical actions
    'attack': {
      title: 'Gear Strike',
      description: 'Mechanical-assisted melee attack',
      glyphEmoji: '⚙️'
    },
    'interact': {
      title: 'Tinker',
      description: 'Adjust or activate mechanical devices',
      glyphEmoji: '🔧'
    },
    'search': {
      title: 'Examine Gears',
      description: 'Search for valuable salvage',
      glyphEmoji: '🔍'
    },
    'fireball': {
      title: 'Steam Cannon Blast',
      description: 'Fire heated steam at high pressure',
      glyphEmoji: '💨'
    },
    'frost-nova': {
      title: 'Coolant Dispersal',
      description: 'Release refrigerant gas cloud',
      glyphEmoji: '❄️'
    },
    'heal': {
      title: 'Mechanical Repair',
      description: 'Restore damaged body systems',
      glyphEmoji: '⚙️'
    },
    'shield-spell': {
      title: 'Plated Armor Extend',
      description: 'Deploy reinforced metal panels',
      glyphEmoji: '🛡️'
    },
    'teleport': {
      title: 'Pneumatic Propulsion',
      description: 'Launch via pressurized tubes',
      glyphEmoji: '💨'
    }
  }
};

// ============================================================================
// NARRATIVE CARD REGISTRY
// ============================================================================

/**
 * Create a NarrativeCard from an ability definition and codec
 * Called by usePlayerHand when drawing cards from deck
 */
export function createNarrativeCard(abilityId: string, codec: string = 'generic'): NarrativeCard | null {
  const ability = ABILITY_DATABASE[abilityId];
  if (!ability) {
    console.warn(`[narrativeCardRegistry] Unknown ability: ${abilityId}`);
    return null;
  }

  // Validate codec
  const validCodecs = ['medieval', 'cyberpunk', 'noir', 'steampunk', 'generic'];
  const activeCodec = (validCodecs.includes(codec) ? codec : 'generic') as any;

  // Get lens for this codec and ability
  const lens = CODEC_LENSES[activeCodec]?.[abilityId] || {
    title: ability.name,
    description: ability.description,
    glyphEmoji: '✨'
  };

  // Get material profile for this card type and codec
  const materialProfile = MATERIAL_PROFILES[ability.type]?.[activeCodec] || 
                         MATERIAL_PROFILES[ability.type]?.['generic'] ||
                         MATERIAL_PROFILES['utility']['generic'];

  // Determine rarity based on ability properties
  let rarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common';
  if ((ability.requirements?.minimumLevel ?? 0) >= 10) rarity = 'rare';
  if ((ability.requirements?.minimumLevel ?? 0) >= 20) rarity = 'legendary';
  if ((ability.requirements?.minimumLevel ?? 0) >= 5) rarity = 'uncommon';

  return {
    abilityId,
    ability,
    codecId: activeCodec,
    cardTitle: lens.title,
    cardDescription: lens.description,
    materialProfile: {
      ...materialProfile,
      glyphEmoji: lens.glyphEmoji
    },
    cardType: ability.type,
    rarity,
    manaCost: ability.manaCost,
    cooldownTicks: ability.cooldownTicks,
    effectSummary: `${ability.type.toUpperCase()}: ${(ability.effect.value || 0)} ${ability.effect.type}`
  };
}

/**
 * Get all available cards for a codec (for showing in deck builder UI)
 */
export function getAllNarrativeCardsForCodec(codec: string = 'generic'): NarrativeCard[] {
  return Object.keys(ABILITY_DATABASE)
    .map(abilityId => createNarrativeCard(abilityId, codec))
    .filter((card): card is NarrativeCard => card !== null);
}

/**
 * Get codec-specific title for an ability
 */
export function getAbilityCardTitle(abilityId: string, codec: string = 'generic'): string {
  const validCodecs = ['medieval', 'cyberpunk', 'noir', 'steampunk', 'generic'];
  const activeCodec = (validCodecs.includes(codec) ? codec : 'generic') as any;
  
  const lens = CODEC_LENSES[activeCodec]?.[abilityId];
  if (lens) return lens.title;
  
  const ability = ABILITY_DATABASE[abilityId];
  return ability?.name || 'Unknown Card';
}

/**
 * Validate if ability can be used as a card (is it in the card registry?)
 */
export function isCardableAbility(abilityId: string): boolean {
  return abilityId in ABILITY_DATABASE;
}
