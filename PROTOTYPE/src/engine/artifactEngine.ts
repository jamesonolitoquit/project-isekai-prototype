import { WorldState, PlayerState } from './worldEngine';
import { random } from './prng';

/**
 * Rune type: Individual magical symbol for infusion into items
 */
export interface RuneDefinition {
  id: string;
  templateId: string;
  name: string;
  essence: 'haste' | 'lux-ar' | 'void' | 'resilience' | 'clarity' | 'harvest' | 'flux' | 'bind';
  statBonus: Record<string, number>; // e.g., { agi: 2, max_mana: 10 }
  complexity: number; // Increases wield requirement
  manaCost: number; // Cost to infuse
  description: string;
  flavor: string; // Lore text
}

/**
 * Relic Slot: A "socket" in a weapon/armor that holds a rune
 */
export interface RunicSlot {
  slotId: string;
  runeId?: string; // undefined if empty
  socketType: 'essence' | 'power' | 'soul'; // Different socket types for variety
  stability: number; // 0-100: lower = more chance of rebellion
}

/**
 * Relic: A high-tier item with sentience, bonuses, and runic slots
 */
export interface Relic {
  id: string;
  templateId: string;
  name: string;
  ownerId?: string; // Player ID if bound
  sentienceLevel: number; // 0 = inert, 1-3 = semi-sentient, 4+ = fully aware
  runicSlots: RunicSlot[];
  boundSoulStrain: number; // Cost to unbind (0 if not bound)
  isBound: boolean;
  totalComplexity: number; // Sum of base + all infused runes
  description: string;
  baseBonus: Record<string, number>; // Always-active bonus (e.g., { str: 1 })
  lore: string;
  lastSpokeAt?: number; // Timestamp of last dialogue
  rebellionCounter: number; // Tracks how many times it's rebelled
}

/**
 * Calculate the dynamic bonus a relic grants based on player state
 * Links to mana for spell-blade synergy
 */
export function calculateRelicBonus(
  relic: Relic,
  state: WorldState
): Record<string, number> {
  const player = state.player;
  const bonus: Record<string, number> = { ...relic.baseBonus };

  // For each slotted rune, add its bonus
  relic.runicSlots.forEach((slot) => {
    if (slot.runeId) {
      // Find rune definition in global runes data (passed in context)
      // For now, return a placeholder; actual rune data will be fetched from runesData
      const runeStatsPerSlot: Record<string, number> = {
        haste: { agi: 2 },
        'lux-ar': { int: 3, max_mana: 15 },
        void: { str: 2, wisdom: 1 },
        resilience: { vit: 2, def: 3 },
        clarity: { int: 2, wisdom: 2 },
        harvest: { luck: 3 },
        flux: { max_mana: 20 },
        bind: { str: 1, int: 1 },
      }[slot.runeId] || {};
      
      Object.entries(runeStatsPerSlot).forEach(([stat, value]) => {
        bonus[stat] = (bonus[stat] || 0) + value;
      });
    }
  });

  // Spell-blade bonus: +1 STR per 10 current Mana (up to player's total invested in arcane)
  if (player.mp && player.mp > 0) {
    const manaBonus = Math.floor(player.mp / 10);
    bonus['str'] = (bonus['str'] || 0) + manaBonus;
  }

  // Sentiency bonus: Higher sentiency → higher base multiplier
  const sentiencyMultiplier = 1 + (relic.sentienceLevel * 0.1);
  Object.entries(bonus).forEach(([stat, value]) => {
    bonus[stat] = Math.floor(value * sentiencyMultiplier);
  });

  return bonus;
}

/**
 * Check if a relic should "Rebel" due to high paradox
 * Higher paradox = more likely to disable bonuses
 */
export function shouldRelicRebel(relic: Relic, paradoxLevel: number): boolean {
  if (paradoxLevel < 50) return false; // Below 50, no rebellion
  if (paradoxLevel >= 90) return true; // 90+, guaranteed rebellion

  // Between 50-89: percentage chance
  const rebellionChance = (paradoxLevel - 50) / 40; // 0% at 50, 97.5% at 89
  const roll = random();
  return roll < rebellionChance;
}

/**
 * Check if infusion is stable (won't corrupt the item or player)
 * Considers wavelength alignment and player's morphing status
 */
export function checkInfusionStability(
  relic: Relic,
  rune: RuneDefinition,
  player: PlayerState,
  paradoxLevel: number
): { stable: boolean; risk: number; message: string } {
  let risk = 0;
  let messages: string[] = [];

  // Base stability from available slots
  const emptySlots = relic.runicSlots.filter((s) => !s.runeId).length;
  if (emptySlots === 0) {
    return {
      stable: false,
      risk: 100,
      message: 'All runic slots are occupied.',
    };
  }

  // Paradox interference
  if (paradoxLevel > 60) {
    risk += Math.min(paradoxLevel - 60, 40);
    messages.push(`High paradox causes instability (+${Math.min(paradoxLevel - 60, 40)}% risk)`);
  }

  // Soul strain from morphing
  if (player.soulStrain && player.soulStrain > 50) {
    risk += Math.min(player.soulStrain - 50, 30);
    messages.push(`Soul strain interferes (+${Math.min(player.soulStrain - 50, 30)}% risk)`);
  }

  // Rune complexity
  risk += rune.complexity * 2;
  messages.push(`Rune complexity: +${rune.complexity * 2}% risk`);

  const stable = risk < 60; // Below 60% risk = acceptable
  return {
    stable,
    risk,
    message: messages.join('; '),
  };
}

/**
 * Calculate the soul strain cost to unbind a relic from a player
 * Higher sentiency = higher cost to sever bond
 */
export function calculateUnbindCost(relic: Relic, paradoxLevel: number): number {
  let cost = relic.boundSoulStrain; // Base cost

  // Sentiency increases unbind difficulty
  cost += relic.sentienceLevel * 5;

  // Paradox makes it harder to unbind (more resistance from the relic)
  if (paradoxLevel > 50) {
    cost += Math.floor((paradoxLevel - 50) / 10) * 3;
  }

  return Math.min(cost, 100); // Cap at 100
}

/**
 * Determine if a relic is in "rebellion" — temporarily disabling its bonuses
 * Used during combat if paradox is high and relic fails check
 */
export function isRelicRebelling(
  relic: Relic,
  paradoxLevel: number,
  combatTick: number
): boolean {
  if (paradoxLevel < 70) return false;

  // At 70+ paradox, relic has a per-tick chance to rebel
  const rebellionChance = (paradoxLevel - 70) / 30; // 0% at 70, 100% at 100
  const seed = relic.id.charCodeAt(0) + combatTick; // Pseudo-randomness per relic per tick
  const roll = (Math.sin(seed) * 10000) % 1; // Seeded pseudo-random in [0, 1]

  return roll < rebellionChance;
}

/**
 * Generate item dialogue from a sentient relic
 * Called when player enters danger or specific story event
 */
export function generateRelicDialogue(
  relic: Relic,
  context: 'danger' | 'rival_killed' | 'paradox_surge' | 'greeting'
): string {
  const dialogueTables: Record<string, Record<string, string[]>> = {
    'Frost-Bound Blade': {
      danger: [
        'The chill deepens... I sense bloodlust in the air.',
        'Ice crystals form along my blade. Combat approaches.',
        'Winter whispers of enemies ahead.',
      ],
      rival_killed: [
        'Another worthy foe falls to our combined cold fury.',
        'That one froze well. The blade remembers their chill.',
      ],
      paradox_surge: [
        'Your power fractures reality itself... I feel the temporal rifts.',
      ],
      greeting: [
        'I have been waiting. The time for frost-craft has come.',
      ],
    },
    'Eye of the Void': {
      danger: [
        'Whispers echo from beyond. Something stirs.',
        'The void-sight perceives many shadows. Choose carefully.',
      ],
      rival_killed: [
        'Another soul surrenders to the void.',
        'The abyss grows hungrier. Good.',
      ],
      paradox_surge: [
        'Chaos ripples. The void feeds on paradox. I hunger for more.',
      ],
      greeting: [
        'I see all, yet remain unseen. We are aligned.',
      ],
    },
    'Spear of Radiance': {
      danger: [
        'Light gathers. Evil stirs nearby. I shall illuminate the path.',
        'Righteousness calls. Steel yourself.',
      ],
      rival_killed: [
        'Darkness is purged. Another victory for the light.',
      ],
      paradox_surge: [
        'Chaos erodes truth... but I still burn with conviction.',
      ],
      greeting: [
        'The dawn rises. Let us bring justice to this realm.',
      ],
    },
  };

  const relicDialogues = dialogueTables[relic.name] || dialogueTables['Frost-Bound Blade'];
  const lines = relicDialogues[context] || ['(silence)'];
  return lines[Math.floor(random() * lines.length)];
}

/**
 * Apply a relic rebellion: temporarily negate its bonuses with a message
 */
export function applyRelicRebellion(relic: Relic): {
  message: string;
  effect: 'disable_bonuses' | 'reverse_bonuses' | 'strike';
} {
  relic.rebellionCounter++;

  const effects: Array<{
    message: string;
    effect: 'disable_bonuses' | 'reverse_bonuses' | 'strike';
  }> = [
    {
      message: `${relic.name} suddenly loses its bond. Its bonuses fade!`,
      effect: 'disable_bonuses',
    },
    {
      message: `${relic.name} resists your control. Its power turns inward...`,
      effect: 'reverse_bonuses',
    },
    {
      message: `${relic.name} surges with uncontrolled energy, striking you with paradox backlash!`,
      effect: 'strike',
    },
  ];

  return effects[Math.floor(random() * effects.length)];
}

/**
 * Determine wielding requirement from total complexity
 * Higher complexity = higher INT needed to use without penalties
 */
export function getWieldingRequirement(totalComplexity: number): {
  intRequired: number;
  penalty: number; // % reduction in effectiveness per point of INT deficit
} {
  const intRequired = Math.floor(10 + totalComplexity / 2);
  const penalty = 5; // 5% per INT below requirement

  return { intRequired, penalty };
}

/**
 * Calculate item corruption from repeated infusion or paradox
 * Higher corruption = more likely item breaks/corrupts permanently
 */
export function calculateItemCorruption(
  infusionCount: number,
  paradoxLevel: number
): { corruption: number; status: 'stable' | 'degrading' | 'corrupted' } {
  let corruption = infusionCount * 3; // Each infusion adds 3% corruption
  corruption += Math.max(0, (paradoxLevel - 50) / 5); // Paradox adds instability

  const status =
    corruption < 30 ? 'stable' : corruption < 70 ? 'degrading' : 'corrupted';

  return { corruption: Math.min(corruption, 100), status };
}

/**
 * M29 Task 6: Heirloom Transformation
 * Calculate stat bonuses based on how many generations the item has passed through
 * Each generation increases power by 5% (multiplicative)
 */
export function calculateHeirloomStatBonus(baseStats: Record<string, number>, generationCount: number): Record<string, number> {
  // Each generation: +5% to all stats (multiplicative)
  const generationMultiplier = Math.pow(1.05, Math.max(0, generationCount - 1));
  
  const boostedStats: Record<string, number> = {};
  Object.entries(baseStats).forEach(([stat, value]) => {
    boostedStats[stat] = Math.floor(value * generationMultiplier);
  });

  return boostedStats;
}

/**
 * M29 Task 6: Apply heirloom transformation to unique items
 * Enhances visuals, stats, and adds prestige tier tracking
 */
export function applyHeirloomTransformation(
  item: any, // UniqueItem
  generationCount: number = 1
): {
  enhancedItem: any;
  prestige: 'Ancestral' | 'Legendary' | 'God-Slayer';
  visualEffect: string;
  statBonus: number; // Percentage increase
} {
  const generationMultiplier = Math.pow(1.05, Math.max(0, generationCount - 1));
  const statBonus = ((generationMultiplier - 1) * 100); // Convert to percentage

  let prestige: 'Ancestral' | 'Legendary' | 'God-Slayer';
  if (generationCount >= 5) {
    prestige = 'God-Slayer'; // 5+ generations
  } else if (generationCount >= 3) {
    prestige = 'Legendary'; // 3-4 generations
  } else {
    prestige = 'Ancestral'; // 1-2 generations
  }

  const visualEffects: Record<string, string> = {
    'Ancestral': 'Golden aura with gentle spirals',
    'Legendary': 'Brilliant radiance with temporal shimmer',
    'God-Slayer': 'Cascading starlight + reality distortion particles'
  };

  // Enhance weapon description with prestige
  const enhancedItem = {
    ...item,
    generationCount,
    _heirloomPrestige: prestige,
    _visualEffect: visualEffects[prestige],
    metadata: {
      ...item.metadata,
      heirloomEnhanced: true,
      prestigeTier: prestige,
      generationMultiplier
    }
  };

  return {
    enhancedItem,
    prestige,
    visualEffect: visualEffects[prestige],
    statBonus: Math.round(statBonus)
  };
}

/**
 * M29 Task 6: Get heirloom prestige tier from generation count
 */
export function getHeirloomPrestigeTier(generationCount: number): {
  tier: 'Ancestral' | 'Legendary' | 'God-Slayer';
  requiredGenerations: number;
  color: string;
  description: string;
} {
  if (generationCount >= 5) {
    return {
      tier: 'God-Slayer',
      requiredGenerations: 5,
      color: '#FF6B9D', // Magenta-ish for godly
      description: 'An artifact that has transcended mortal limitations through countless lineages'
    };
  } else if (generationCount >= 3) {
    return {
      tier: 'Legendary',
      requiredGenerations: 3,
      color: '#FFD700', // Gold
      description: 'A weapon of profound power, shaped by the strength of its wielders'
    };
  } else {
    return {
      tier: 'Ancestral',
      requiredGenerations: 1,
      color: '#C0C0C0', // Silver
      description: 'A weapon passed down through bloodline memory'
    };
  }
}

/**
 * M30 Task 5: Recursive Heirloom "Awakening"
 * God-Slayer tier heirlooms (Gen 5+) can trigger Ancestral Manifestations in combat
 * 5% chance per hit to summon a ghost of the most powerful ancestor
 */
export function shouldTriggerHeirloomAwakening(
  heirloomItem: any, // UniqueItem
  hitChance: number = 0.05
): boolean {
  // Only God-Slayer tier can trigger awakening
  if (heirloomItem._heirloomPrestige !== 'God-Slayer') {
    return false;
  }

  // 5% chance per hit by default
  return Math.random() < hitChance;
}

/**
 * Create an Ancestral Manifestation NPC based on the most powerful ancestor
 */
export function createAncestralManifestation(
  ancestorLegacies: any[], // LegacyImpact[]
  heirloomName: string,
  combatWorldSeed: number
): {
  manifestationNpc: any; // NPC
  manifestationAttack: {
    name: string;
    baseDamage: number;
    description: string;
    element: string;
  };
  temporaryDuration: number; // Ticks
} {
  const { SeededRng } = require('./prng');
  const rng = new SeededRng(combatWorldSeed);

  // Find the greatest ancestor
  const greatestAncestor = [...ancestorLegacies].sort(
    (a, b) => (b.mythStatus || 0) - (a.mythStatus || 0)
  )[0] || {
    canonicalName: 'Unknown Hero',
    mythStatus: 50,
    deeds: [],
    inheritedPerks: []
  };

  // Select a signature deed for the ancestor
  const deedsWithVerbs = greatestAncestor.deeds.filter((d: string) =>
    d.includes('defeated') || d.includes('slain') || d.includes('conquered')
  );
  const signatureDeed = deedsWithVerbs.length > 0 
    ? deedsWithVerbs[rng.nextInt(0, deedsWithVerbs.length - 1)]
    : greatestAncestor.deeds[0] || 'Preserved the realm';

  // Create manifestation NPC
  const manifestationNpc = {
    id: `ancestral_manifestation_${combatWorldSeed}`,
    name: `${greatestAncestor.canonicalName}'s Echo`,
    description: `A ghostly projection of ${greatestAncestor.canonicalName}, drawn from the heirloom ${heirloomName}`,
    level: 20 + Math.floor(greatestAncestor.mythStatus / 5),
    stats: {
      str: 16,
      agi: 14,
      int: 12,
      cha: 18, // Enhanced charisma for spectral presence
      end: 15,
      luk: 16
    },
    _isManifestion: true,
    _ancestralMythStatus: greatestAncestor.mythStatus,
    _ancestorName: greatestAncestor.canonicalName,
    factionId: 'faction_ancestors'
  };

  // Create signature attack based on greatest deed
  const manifestationAttack = {
    name: `${greatestAncestor.canonicalName}'s Retribution`,
    baseDamage: 80 + Math.floor(greatestAncestor.mythStatus),
    description: `${greatestAncestor.canonicalName} echoes their greatest achievement: "${signatureDeed}"`,
    element: 'spectral'
  };

  // Duration: 5-8 rounds (50-80 ticks at ~10 ticks/round)
  const temporaryDuration = 50 + rng.nextInt(0, 30);

  return {
    manifestationNpc,
    manifestationAttack,
    temporaryDuration
  };
}

/**
 * Calculate the bonus a God-Slayer heirloom grants when awakening is triggered
 */
export function getAwakeningBonus(
  heirloomItem: any, // UniqueItem
  ancestorLegacies: any[] // LegacyImpact[]
): {
  damageMultiplier: number;
  temporaryStats: Record<string, number>;
  narrativeEffectText: string;
} {
  const generationCount = heirloomItem.generationCount || 5;
  const avgMythStatus = Math.floor(
    ancestorLegacies.reduce((sum: number, a: any) => sum + (a.mythStatus || 0), 0) / ancestorLegacies.length
  );

  // Damage scales with generations and myth status
  const damageMultiplier = 1.5 + (generationCount - 5) * 0.2 + (avgMythStatus / 100) * 0.5;

  // Temporary stat boost
  const temporaryStats = {
    str: 5 + Math.floor(generationCount / 2),
    agi: Math.floor(generationCount / 2),
    int: 3
  };

  const ancestorNames = ancestorLegacies.map((a: any) => a.canonicalName).slice(0, 3);
  const narrativeEffectText = `The heirloom blazes with ancestral power! Spirits of ${ancestorNames.join(', ')} manifest in the weapon!`;

  return {
    damageMultiplier,
    temporaryStats,
    narrativeEffectText
  };
}

/**
 * Check if heirloom is eligible for awakening this turn
 * (Can't trigger awakening on same turn weapon was just unsheathed)
 */
export function canAwakeningTrigger(
  heirloomItem: any, // UniqueItem
  lastAwakeningTick: number | undefined,
  currentTick: number,
  cooldownTicks: number = 50
): boolean {
  if (!heirloomItem._heirloomPrestige || heirloomItem._heirloomPrestige !== 'God-Slayer') {
    return false;
  }

  if (lastAwakeningTick === undefined) {
    return true; // First time
  }

  return (currentTick - lastAwakeningTick) >= cooldownTicks; // Cooldown
}
