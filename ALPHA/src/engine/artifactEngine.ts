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
  // ALPHA_M13: Relic personality mood system
  moods?: {
    bloodthirsty: number; // 0-1: Increases with combat kills
    curious: number; // 0-1: Increases with exploration/discovery
    sullen: number; // 0-1: Increases with time in inventory, decreases with use
    protective: number; // 0-1: Increases with ally protection/healing
  };
  lastMoodUpdateTick?: number; // Tick of last mood decay
  factionId?: string; // M12: Faction affiliation for influence bonuses
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
 * ALPHA_M13 Step 2: Initialize relic moods
 * Each relic starts with neutral moods that shift based on player actions
 */
export function initializeRelicMoods(): Relic['moods'] {
  return {
    bloodthirsty: 0,
    curious: 0,
    sullen: 0.1, // Start slightly sullen (bored with inactivity)
    protective: 0,
  };
}

/**
 * ALPHA_M13 Step 2: Update relic mood based on player action
 * Moods represent the relic's "personality" and influences dialogue context
 */
export function updateRelicMood(
  relic: Relic,
  actionType: 'combat_kill' | 'explore' | 'use_time' | 'protect_ally' | 'rest',
  amount: number = 0.1
): void {
  if (!relic.moods) {
    relic.moods = initializeRelicMoods();
  }

  switch (actionType) {
    case 'combat_kill':
      // Combat success increases bloodthirsty mood
      relic.moods!.bloodthirsty = Math.min(1, relic.moods!.bloodthirsty + amount);
      relic.moods!.sullen = Math.max(0, relic.moods!.sullen - amount * 0.5); // Breaks sullenness
      break;

    case 'explore':
      // Exploration increases curious mood
      relic.moods!.curious = Math.min(1, relic.moods!.curious + amount);
      relic.moods!.sullen = Math.max(0, relic.moods!.sullen - amount * 0.3);
      break;

    case 'use_time':
      // Active use reduces sullenness
      relic.moods!.sullen = Math.max(0, relic.moods!.sullen - amount);
      break;

    case 'protect_ally':
      // Defensive actions increase protective mood
      relic.moods!.protective = Math.min(1, relic.moods!.protective + amount);
      break;

    case 'rest':
      // Extended rest increases sullenness
      relic.moods!.sullen = Math.min(1, relic.moods!.sullen + amount * 0.5);
      relic.moods!.bloodthirsty = Math.max(0, relic.moods!.bloodthirsty - amount * 0.2);
      break;
  }
}

/**
 * ALPHA_M13 Step 2: Decay relic moods over time
 * Moods gradually return to neutral (0.1 sullen baseline)
 * Called during world ticks
 */
export function decayRelicMoods(relic: Relic, ticksSinceLastUpdate: number): void {
  if (!relic.moods) {
    relic.moods = initializeRelicMoods();
  }

  const decayRate = 0.005; // 0.5% mood decay per tick
  const totalDecay = decayRate * ticksSinceLastUpdate;

  // Decay all moods towards baseline
  relic.moods!.bloodthirsty = Math.max(0, relic.moods!.bloodthirsty - totalDecay);
  relic.moods!.curious = Math.max(0, relic.moods!.curious - totalDecay);
  relic.moods!.protective = Math.max(0, relic.moods!.protective - totalDecay);
  
  // Sullenness decays back to baseline (0.1)
  relic.moods!.sullen = Math.abs(relic.moods!.sullen - 0.1) > totalDecay
    ? relic.moods!.sullen - (relic.moods!.sullen > 0.1 ? totalDecay : -totalDecay)
    : 0.1;
}

/**
 * ALPHA_M13 Step 2: Determine relic's current "mood" for dialogue generation
 * Returns the dominant mood that should influence dialogue tone
 */
export function getDominantMood(relic: Relic): 'bloodthirsty' | 'curious' | 'sullen' | 'protective' {
  if (!relic.moods) {
    return 'sullen'; // Default to neutral sullen
  }

  const moods = relic.moods;
  const entries = [
    ['bloodthirsty', moods.bloodthirsty] as const,
    ['curious', moods.curious] as const,
    ['sullen', moods.sullen] as const,
    ['protective', moods.protective] as const,
  ];

  const highest = entries.reduce((prev, curr) =>
    curr[1] > prev[1] ? curr : prev
  );

  return highest[0];
}

/**
 * ALPHA_M13 Step 2: Generate mood-influenced dialogue
 * Moods affect tone and theme of relic messages
 */
export function generateMoodInfluencedDialogue(
  relic: Relic,
  dominantMood: string,
  context: 'danger' | 'rival_killed' | 'paradox_surge' | 'greeting'
): string {
  // Mood-specific dialogue tables
  const moodDialogues: Record<string, Record<string, string[]>> = {
    bloodthirsty: {
      danger: [
        'Blood calls to blood. Let them come.',
        'I hunger for conflict. Enemies near?',
        'The scent of death excites me.',
      ],
      rival_killed: [
        'YES! Another worthy foe falls!',
        'Their weakness amused me briefly.',
      ],
      paradox_surge: [
        'Chaos fuels my fury. Strike now!',
      ],
      greeting: [
        'Finally. Time to hunt.',
      ],
    },
    curious: {
      danger: [
        'Interesting. What secrets does this threat hold?',
        'I wonder what we shall discover in conflict.',
      ],
      rival_killed: [
        'Fascinating. A new puzzle solved.',
      ],
      paradox_surge: [
        'The rifts fascinate me. More to learn...',
      ],
      greeting: [
        'There is much to discover together.',
      ],
    },
    sullen: {
      danger: [
        '...trouble again.',
        'Must we? Even now?',
      ],
      rival_killed: [
        'Another falls. Does it matter?',
      ],
      paradox_surge: [
        'Even the world fractures in this boredom.',
      ],
      greeting: [
        'I suppose we should begin...',
      ],
    },
    protective: {
      danger: [
        'I will shield you from harm.',
        'Your enemies are my enemies.',
      ],
      rival_killed: [
        'One less threat to you.',
      ],
      paradox_surge: [
        'I shall guard you through this chaos.',
      ],
      greeting: [
        'I am here to protect.',
      ],
    },
  };

  const dialogueTable = moodDialogues[dominantMood] || moodDialogues.sullen;
  const lines = dialogueTable[context] || ['...'];
  return lines[Math.floor(random() * lines.length)];
}

/**
 * ALPHA_M13 Step 3: Generate a relic-issued quest
 * High-sentience relics can create quests directly as commands to the player
 */
export function generateRelicQuest(
  relic: Relic,
  playerId: string,
  currentTick: number
): {
  id: string;
  title: string;
  description: string;
  questType: 'relic_seek' | 'relic_retrieve' | 'relic_prove';
  objectives: Array<{ type: string; description: string }>;
  rewards: { experience: number; gold: number };
} | null {
  // Only high-sentience relics (4+) can issue quests
  if (!relic.sentienceLevel || relic.sentienceLevel < 4) {
    return null;
  }

  // Generate quest based on relic mood and type
  const questTypes: Array<'relic_seek' | 'relic_retrieve' | 'relic_prove'> = [
    'relic_seek',
    'relic_retrieve',
    'relic_prove',
  ];
  const questType = questTypes[Math.floor(random() * questTypes.length)];

  const questId = `${relic.id}_quest_${currentTick}`;
  const dominantMood = getDominantMood(relic);

  let title = '';
  let description = '';
  let objectives: Array<{ type: string; description: string }> = [];

  switch (questType) {
    case 'relic_seek':
      title = `${relic.name}'s Lament`;
      description = `${relic.name} seeks knowledge of a lost artifact matched to its power.`;
      objectives = [
        {
          type: 'gather',
          description: `Discover information about ${relic.name}'s origin.`,
        },
        {
          type: 'visit',
          description: `Return with the knowledge.`,
        },
      ];
      break;

    case 'relic_retrieve':
      title = `${relic.name}'s Claim`;
      description = `${relic.name} demands retrieval of something precious that was taken from it.`;
      objectives = [
        {
          type: 'gather',
          description: `Locate the item desired by ${relic.name}.`,
        },
        {
          type: 'deliver',
          description: `Return it to ${relic.name}.`,
        },
      ];
      break;

    case 'relic_prove':
      title = `Prove Your Worth to ${relic.name}`;
      description = `${relic.name} demands you prove your bond is true through trials.`;
      objectives = [
        {
          type: 'combat',
          description: `Defeat enemies while wielding ${relic.name}.`,
        },
        {
          type: 'challenge',
          description: `Complete a test of your skill.`,
        },
      ];
      break;
  }

  return {
    id: questId,
    title,
    description,
    questType,
    objectives,
    rewards: {
      experience: 150 + relic.sentienceLevel * 20,
      gold: 100 + relic.sentienceLevel * 10,
    },
  };
}

/**
 * M16 Step 4: Process relic communication (barks/comments)
 * Relics with high sentience periodically comment on:
 * - Current location atmosphere
 * - Recent combat performance
 * - Player mood or situation
 * 
 * Emits RELIC_COMMUNICATION event
 */
export function processRelicCommunication(
  relic: Relic,
  state: WorldState,
  eventLog: any[] = []
): { message: string; type: 'observation' | 'encouragement' | 'warning' | 'taunt' } | null {
  // Only communicate if sufficiently sentient
  if (relic.sentienceLevel < 2) {
    return null;
  }

  // Check cooldown (barks every 20-40 ticks to avoid spam)
  const lastBarkTick = relic.lastSpokeAt ?? 0;
  const ticksSinceBark = (state.tick ?? 0) - lastBarkTick;
  const barkCooldown = 20 + Math.floor(Math.random() * 20);
  
  if (ticksSinceBark < barkCooldown) {
    return null;
  }

  // Update last spoke time
  relic.lastSpokeAt = state.tick ?? 0;

  // Get current mood state
  const moods = relic.moods || { bloodthirsty: 0, curious: 0, sullen: 0, protective: 0 };
  const dominantMood = Object.entries(moods).reduce(([maxMood, maxValue], [mood, value]) =>
    (value as number) > maxValue ? [mood, value] : [maxMood, maxValue]
  )[0];

  // Build contextual message based on location and mood
  const location = state.locations.find(l => l.id === state.player?.location);
  const currentSeasonBiome = `${state.season}_${location?.biome || 'unknown'}`;

  // Observation type messages (location/atmosphere)
  if (dominantMood === 'curious') {
    const observations: Record<string, string> = {
      winter_cave: `${relic.name} hums thoughtfully. "I sense old magic here... crystallized in the ice."`,
      summer_forest: `${relic.name} resonates. "The lifeforce is strong in this place. Can you feel it?"`,
      spring_shrine: `${relic.name} glows faintly. "A place of power. Many have prayed here."`,
      autumn_mountain: `${relic.name} vibrates. "The winds carry stories from distant lands."`,
    };
    
    const message = observations[currentSeasonBiome] || 
      `${relic.name} observes: "An interesting locale. What shall we do here?"`;
    
    return { message, type: 'observation' };
  }

  // Encouragement type (after successful combat)
  if (dominantMood === 'bloodthirsty' && moods.bloodthirsty > 0.6) {
    const encouragements = [
      `${relic.name} thrums with excitement. "Magnificent! More foes to claim!"`,
      `${relic.name} glows with anticipation. "Your blade deserves greater challenges!"`,
      `${relic.name} hums triumphantly. "We are unstoppable together!"`
    ];
    return { message: encouragements[Math.floor(Math.random() * encouragements.length)], type: 'encouragement' };
  }

  // Warning type (low health or dangerous area)
  if (moods.protective > 0.5 || (state.player?.hp || 0) < (state.player?.maxHp || 100) * 0.3) {
    const warnings = [
      `${relic.name} warns: "Your wounds trouble me. We should rest soon."`,
      `${relic.name} feels heavy in your grip. "I sense danger ahead. Proceed cautiously."`,
      `${relic.name} pulses urgently. "Your strength wanes. Heal yourself!"`
    ];
    return { message: warnings[Math.floor(Math.random() * warnings.length)], type: 'warning' };
  }

  // Taunt type (if enemy nearby or after victory streak)
  if (dominantMood === 'bloodthirsty' && moods.bloodthirsty > 0.4) {
    const taunts = [
      `${relic.name} snarls. "Where are the worthy opponents? This is...unsatisfying."`,
      `${relic.name} speaks mockingly. "Is that all the realm has to offer?"`,
      `${relic.name} hums impatiently. "Faster. Stronger. Give me a real challenge!"`
    ];
    return { message: taunts[Math.floor(Math.random() * taunts.length)], type: 'taunt' };
  }

  // Default neutral observation
  const neutralObservations = [
    `${relic.name} settles calmly against you.`,
    `${relic.name} rests quietly.`,
    `${relic.name} seems content.`
  ];
  return { message: neutralObservations[Math.floor(Math.random() * neutralObservations.length)], type: 'observation' };
}

