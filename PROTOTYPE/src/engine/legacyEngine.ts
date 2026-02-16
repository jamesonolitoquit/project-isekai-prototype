/**
 * Legacy Engine (BETA Phase)
 * 
 * Purpose: Handle character canonization, bloodline inheritance, and legacy persistence
 * across epoch transitions. Calculates Myth Status and determines what perks/items
 * pass to the next generation.
 * 
 * Key Concepts:
 * - Myth Status: 0-100 rating based on character achievements
 * - Bloodline: Inherited perks and items that persist across resets
 * - Legacy Points: Accumulated through deeds; carried forward
 * - Soul Echo: The legendary reputation that NPCs remember
 */

import type { WorldState, PlayerState, Party } from './worldEngine';
import type { PlaystyleProfile } from './analyticsEngine';
import { SeededRng } from './prng';

export interface SoulEchoNpc {
  id: string;
  name: string;
  title: string;
  description: string;
  role: string;
  knownTo: string[];
  dialogue: {
    greeting: string;
    wisdom: string;
  };
  stats?: any;
  hp?: number;
  maxHp?: number;
  // M32: Multiplayer cross-world legacy support
  _soulEchoMemory?: string; // Custom memory for visiting legends
  _foreignLegacy?: any; // ForeignLegacyImport data
  _visitingLegend?: boolean; // True if this is a visiting legend from another world
}

export interface LegacyImpact {
  canonicalName: string;
  mythStatus: number;           // 0-100: How legendary this character became
  inheritedPerks: string[];     // Unlocked perks for next generation
  inheritedItems: Array<{ itemId: string; rarity?: string }>;
  deeds: string[];             // Memorable achievements
  factionInfluence: Record<string, number>; // How much this character influenced factions
  epochsLived: number;         // How many full epochs survived
  timestamp: number;           // When canonized
}

export interface BloodlineProfile {
  name: string;
  legacyImpacts: LegacyImpact[]; // Accumulated across all lifetimes
  totalMythStatus: number;        // Sum of all ancestors' myth status
  totalLegacyPoints: number;      // Total accumulated by entire lineage
}

/**
 * Calculate Myth Status based on character achievements
 * Factors in:
 * - Playstyle profile completion (explorers get higher status)
 * - Faction reputation (positive reputation = higher myth)
 * - Character level / combat rank
 * - Unique deeds (quests completed, discoveries made)
 */
export function calculateMythStatus(
  player: PlayerState,
  state: WorldState,
  playstyle?: PlaystyleProfile,
  deeds?: string[]
): number {
  let mythStatus = 0;

  // Base from level
  const level = player.level || 1;
  mythStatus += Math.min(40, level * 2); // Max 40 from level

  // Faction reputation bonus
  if (player.factionReputation) {
    const reputationBonus = Object.values(player.factionReputation).reduce((sum, rep) => {
      if (rep > 0) sum += Math.min(10, rep / 10);
      return sum;
    }, 0);
    mythStatus += Math.min(20, reputationBonus);
  }

  // Playstyle bonus - explorers and ritualists get bonus for discovery
  if (playstyle) {
    const explorerBonus = playstyle.characterProfile.explorationFrequency * 10;
    const ritualistBonus = playstyle.characterProfile.ritualFrequency * 8;
    mythStatus += explorerBonus + ritualistBonus;
  }

  // Deed bonus - each deed adds 2-5 myth
  if (deeds && deeds.length > 0) {
    mythStatus += Math.min(15, deeds.length * 2);
  }

  // Cap at 100
  return Math.min(100, mythStatus);
}

/**
 * Determine which perks and items transfer to the next generation
 * Legendary items (Relics) and high-level abilities persist
 */
export function calculateInheritedPerks(
  player: PlayerState,
  mythStatus: number
): string[] {
  const perks: string[] = [];

  // Higher myth status unlocks more perks
  if (mythStatus >= 30) {
    perks.push('bloodline_resilience'); // +5% HP per generation
  }
  if (mythStatus >= 50) {
    perks.push('ancestral_wisdom');     // +2 max ability cooldown reduction
  }
  if (mythStatus >= 70) {
    perks.push('legendary_bearing');    // NPCs start at +20 reputation
  }
  if (mythStatus >= 90) {
    perks.push('myth_transcendence');   // Unlock special legendary quest line
  }

  // Unlocked abilities transfer
  if (player.unlockedAbilities && player.unlockedAbilities.length > 0) {
    player.unlockedAbilities.forEach(abilityId => {
      if (abilityId.includes('legendary') || abilityId.includes('ancient')) {
        perks.push(`inherited_ability_${abilityId}`);
      }
    });
  }

  return perks;
}

/**
 * Determine which items transfer as heirlooms
 * Only Relic-tier and unique legendary items transfer
 */
export function calculateInheritedItems(
  player: PlayerState,
  state: WorldState
): Array<{ itemId: string; rarity?: string }> {
  const items: Array<{ itemId: string; rarity?: string }> = [];

  if (!player.inventory) return items;

  player.inventory.forEach(item => {
    if (item.kind === 'unique') {
      // Relics and legendary unique items transfer
      const template = (state as any).ITEM_TEMPLATES?.[item.itemId];
      if (template?.rarity === 'legendary' || template?.rarity === 'artifact') {
        items.push({
          itemId: item.itemId,
          rarity: template?.rarity
        });
      }
    }
  });

  return items;
}

/**
 * Record a canonized character as a legacy impact
 * Called when character completes epoch or dies with significant achievements
 */
export function canonizeCharacter(
  player: PlayerState,
  state: WorldState,
  playstyle?: PlaystyleProfile,
  deeds?: string[]
): LegacyImpact {
  const rng = new SeededRng(state.seed);
  const pseudoTimestamp = rng.nextInt(1000000, 9999999);
  
  const mythStatus = calculateMythStatus(player, state, playstyle, deeds);
  const inheritedPerks = calculateInheritedPerks(player, mythStatus);
  const inheritedItems = calculateInheritedItems(player, state);

  const impact: LegacyImpact = {
    canonicalName: player.name || 'Unknown Hero',
    mythStatus,
    inheritedPerks,
    inheritedItems,
    deeds: deeds || [],
    factionInfluence: player.factionReputation ? { ...player.factionReputation } : {},
    epochsLived: state.epochMetadata?.sequenceNumber || 1,
    timestamp: pseudoTimestamp
  };

  return impact;
}

/**
 * Apply legacy perks to a new character from bloodline history
 */
export function applyLegacyPerks(player: PlayerState, legacy: LegacyImpact): PlayerState {
  player.bloodlineData ??= {
    canonicalName: legacy.canonicalName,
    inheritedPerks: legacy.inheritedPerks,
    inheritedItems: legacy.inheritedItems,
    mythStatus: legacy.mythStatus,
    epochsLived: legacy.epochsLived,
    deeds: legacy.deeds
  };

  // Apply stat bonuses from perks
  if (legacy.inheritedPerks.includes('bloodline_resilience')) {
    if (player.maxHp) {
      player.maxHp = Math.floor(player.maxHp * 1.05);
    }
    if (player.hp) {
      player.hp = Math.min(player.hp, player.maxHp || player.hp);
    }
  }

  if (legacy.inheritedPerks.includes('legendary_bearing')) {
    // Start with +20 to all faction reputations
    player.factionReputation ??= {};
    Object.keys(legacy.factionInfluence).forEach(factionId => {
      player.factionReputation![factionId] = (player.factionReputation![factionId] || 0) + 20;
    });
  }

  // Add inherited items to starting inventory
  player.inventory = player.inventory || [];
  legacy.inheritedItems.forEach((item, index) => {
    player.inventory!.push({
      kind: 'unique',
      itemId: item.itemId,
      instanceId: `${item.itemId}-inherited-${legacy.timestamp}-${index}`,
      metadata: {
        experience: 0
      }
    });
  });

  return player;
}

/**
 * Create a "Soul Echo" NPC that represents a canonized ancestor
 * This allows new characters to learn about legendary predecessors
 */
/**
 * Create a Soul Echo NPC from legacy data
 * M32: Enhanced to support pooling ancestors from entire party
 * If party is provided, will select the greatest ancestor from all party members' legacies
 */
export function createSoulEchoNpc(
  legacy: LegacyImpact, 
  epochNumber: number, 
  party?: Party,
  partyLegacies?: Map<string, LegacyImpact[]>
): SoulEchoNpc {
  // M32: If party and lineage data provided, select greatest ancestor
  let selectedLegacy = legacy;
  if (party && partyLegacies && partyLegacies.size > 0) {
    // Collect all legacies from all party members
    const allLegacies: LegacyImpact[] = Array.from(partyLegacies.values())
      .flat()
      .sort((a, b) => b.mythStatus - a.mythStatus); // Sort by myth status descending
    
    // Select the greatest ancestor (highest myth status)
    if (allLegacies.length > 0) {
      selectedLegacy = allLegacies[0];
    }
  }

  return {
    id: `soul_echo_${selectedLegacy.canonicalName.toLowerCase().replace(/ /g, '_')}_${selectedLegacy.timestamp}`,
    name: selectedLegacy.canonicalName,
    title: `Legendary ${selectedLegacy.epochsLived > 1 ? 'Ancestor' : 'Hero'}`,
    description: `Spirit of a legendary hero with ${selectedLegacy.mythStatus} mythic stature. Deeds: ${selectedLegacy.deeds.join(', ') || 'Unknown'}`,
    role: 'spirit_guide',
    knownTo: party ? party.memberIds : ['all'], // M32: If party, known to all members; otherwise all
    dialogue: {
      greeting: `I am ${selectedLegacy.canonicalName}, who lived through ${selectedLegacy.epochsLived} era(s). My myth status was ${selectedLegacy.mythStatus}/100.`,
      wisdom: `I passed on ${selectedLegacy.inheritedPerks.length} perks to my bloodline. Remember my deeds: ${selectedLegacy.deeds.join(', ')}`
    }
  };
}

/**
 * Pool legacy lineages from all party members
 * M32: Collects all ancestors from entire party for Soul Echo selection
 * Returns Map of memberId -> LegacyImpact[]
 */
export function poolPartyAncestors(
  party: Party | undefined,
  playerLegacyHistory: LegacyImpact[],
  allPartyLegacyHistories?: Record<string, LegacyImpact[]>
): Map<string, LegacyImpact[]> {
  const pooledLegacies = new Map<string, LegacyImpact[]>();
  
  if (!party) {
    return pooledLegacies;
  }

  // Add current player's legacy
  pooledLegacies.set(party.memberIds[0], playerLegacyHistory);

  // Add other party members' legacies if available
  if (allPartyLegacyHistories) {
    for (const memberId of party.memberIds) {
      if (allPartyLegacyHistories[memberId]) {
        pooledLegacies.set(memberId, allPartyLegacyHistories[memberId]);
      }
    }
  }

  return pooledLegacies;
}

/**
 * Calculate party bloodline strength (aggregate of all members)
 * M32: Pools myth status from entire party for party-wide narrative impact
 */
export function calculatePartyBloodlineStrength(
  party: Party | undefined,
  partyLegacies?: Map<string, LegacyImpact[]>
): number {
  if (!party || !partyLegacies || partyLegacies.size === 0) {
    return 0;
  }

  let totalMythStatus = 0;
  let totalPerks = 0;
  let legacyCount = 0;

  const allLegacies = Array.from(partyLegacies.values()).flat();
  for (const legacy of allLegacies) {
    totalMythStatus += legacy.mythStatus;
    totalPerks += legacy.inheritedPerks.length;
    legacyCount++;
  }

  if (legacyCount === 0) return 0;
  
  return Math.min(100, totalMythStatus / legacyCount + totalPerks * 2);
}

/**
 * Calculate total bloodline power
 * Used to flavor story/NPC dialogue about player ancestry
 */
export function calculateBloodlineStrength(legacyImpacts: LegacyImpact[]): number {
  if (legacyImpacts.length === 0) return 0;

  const totalMythStatus = legacyImpacts.reduce((sum, impact) => sum + impact.mythStatus, 0);
  const totalPerks = legacyImpacts.reduce((sum, impact) => sum + impact.inheritedPerks.length, 0);

  return Math.min(100, totalMythStatus / legacyImpacts.length + totalPerks * 2);
}

/**
 * Ancestral Teaching System: Legendary Abilities from Soul Echo NPCs
 * 
 * Soul Echo NPCs can teach exclusive abilities if the player achieves high synchronization
 * Synchronization = myth status of the ancestor / 100 (0-100% scale)
 * 
 * Abilities cost a "Teaching" interaction and are permanently unlocked
 */
export interface LegendaryAbility {
  id: string;
  name: string;
  description: string;
  mythRequirement: number; // Minimum myth status to unlock (e.g., 50)
  cooldown: number;  // Ticks between uses
  manaCost?: number;
  effect: string; // What the ability does (flavor text + mechanical hook)
  ancestorName: string; // Which ancestor teaches this
  type: 'combat' | 'utility' | 'exploration' | 'ritual';
}

/**
 * Define legendary abilities available from ancestry
 */
export const LEGENDARY_ABILITIES: LegendaryAbility[] = [
  {
    id: 'echo_strike',
    name: 'Echo Strike',
    description: 'Channel your ancestor\'s combat prowess to strike with phenomenal force',
    mythRequirement: 50,
    cooldown: 300,
    manaCost: 40,
    effect: 'Deal 150% weapon damage, ignoring 50% of target armor. Available only through ancestral teaching.',
    ancestorName: 'First Ancestor',
    type: 'combat'
  },
  {
    id: 'ancestral_foresight',
    name: 'Ancestral Foresight',
    description: 'Glimpse future echoes through your bloodline\'s perception',
    mythRequirement: 60,
    cooldown: 600,
    manaCost: 50,
    effect: 'Reveal all hidden enemies in a 50-meter radius for 60 seconds. Gain +20% dodge chance.',
    ancestorName: 'First Ancestor',
    type: 'utility'
  },
  {
    id: 'spirit_walk',
    name: 'Spirit Walk',
    description: 'Project your consciousness to distant ancestors\' locations',
    mythRequirement: 70,
    cooldown: 1200,
    manaCost: 80,
    effect: 'Teleport to any previously discovered location marked by ancestors. Leaves no trace.',
    ancestorName: 'First Ancestor',
    type: 'exploration'
  },
  {
    id: 'ritual_resurrection',
    name: 'Ritual Resurrection',
    description: 'Call upon your bloodline to restore you from the brink of death',
    mythRequirement: 80,
    cooldown: 3600,
    manaCost: 100,
    effect: 'Restore to full HP and remove all negative status effects. Can only be used once per rest.',
    ancestorName: 'First Ancestor',
    type: 'ritual'
  }
];

/**
 * Get teachable legendary abilities for a given ancestor myth status
 */
export function getTeachableAbilities(mythStatus: number): LegendaryAbility[] {
  // Synchronization is mythStatus / 100, so use plain mythStatus for comparison
  return LEGENDARY_ABILITIES.filter(ability => ability.mythRequirement <= mythStatus);
}

/**
 * Check if player can learn a specific legendary ability from a Soul Echo
 */
export function canLearnLegendaryAbility(
  ancestorMythStatus: number,
  targetAbilityId: string,
  playerUnlockedAbilities: string[] = []
): { canLearn: boolean; reason?: string } {
  // Check if already learned
  if (playerUnlockedAbilities.includes(targetAbilityId)) {
    return { canLearn: false, reason: 'You have already learned this ability from your ancestor.' };
  }

  // Find the ability
  const ability = LEGENDARY_ABILITIES.find(a => a.id === targetAbilityId);
  if (!ability) {
    return { canLearn: false, reason: 'This ability does not exist in ancestral teaching.' };
  }

  // Check myth requirement
  if (ancestorMythStatus < ability.mythRequirement) {
    const syncPercent = Math.floor((ancestorMythStatus / ability.mythRequirement) * 100);
    return {
      canLearn: false,
      reason: `Your ancestor's legend is not strong enough yet. (${syncPercent}% synchronized - need ${ability.mythRequirement})`
    };
  }

  return { canLearn: true };
}

/**
 * Record that a player has learned a legendary ability
 */
export function learnLegendaryAbility(
  playerState: any,
  abilityId: string
): any {
  return {
    ...playerState,
    unlockedSoulEchoAbilities: [
      ...(playerState.unlockedSoulEchoAbilities || []),
      abilityId
    ]
  };
}

/**
 * Get available teaching dialogue for Soul Echo NPCs
 */
export function getSoulEchoTeachingDialogue(
  npcName: string,
  ancestorMythStatus: number,
  teachableAbilities: LegendaryAbility[]
): string {
  const syncPercent = Math.floor((ancestorMythStatus / 100) * 100);

  if (teachableAbilities.length === 0) {
    return `I see your bloodline is still weak, young one. Prove yourself worthy, and I shall teach you the ways of our ancestors. (${syncPercent}% synchronized)`;
  }

  const nextAbility = teachableAbilities[0];
  return `The bond between us strengthens. I can now teach you "${nextAbility.name}" - a technique passed down through our lineage. (${syncPercent}% synchronized)`;
}

/**
 * Social Echoes: Asynchronous Multiplayer (M29)
 * 
 * Import a foreign player's legacy into the current world as a "Visiting Legend" NPC.
 * This creates an NPC with the foreign legend's deeds, items, and unique dialogue.
 */
export interface ForeignLegacyImport {
  legacyData: LegacyImpact;
  fromWorldName: string;     // e.g., "Traveler's Luminaria"
  fromPlayerName: string;    // Name of player this came from
  importedAt: number;        // Timestamp of import
}

/**
 * Import a foreign player's legacy and create a "Visiting Legend" NPC
 * Returns NPC object ready to be spawned in the world
 */
export function importForeignLegacy(
  legacyData: LegacyImpact,
  worldName: string = "Unknown Strand",
  playerName: string = "The Wanderer"
): SoulEchoNpc & { _foreignLegacy: ForeignLegacyImport; _visitingLegend: boolean } {
  const deedsDescription = legacyData.deeds?.join("; ") || "Their deeds are shrouded in mystery.";
  const gearList = legacyData.inheritedItems?.map(item => item.itemId).join(", ") || "They carry nothing of note.";

  return {
    id: `visiting_legend_${Date.now()}`,
    name: `${legacyData.canonicalName} the Wanderer`,
    title: `Visitor from ${worldName}`,
    description: `A legendary figure from another strand of fate. They speak of deeds most extraordinary: ${deedsDescription}`,
    role: 'visiting_legend',
    knownTo: [], // Universally known
    dialogue: {
      greeting: `Hail, traveler. I am ${legacyData.canonicalName}, drawn from a parallel world. In my strand, I was known for: ${deedsDescription}`,
      wisdom: `The threads of fate are many. In my world, I learned that ${legacyData.inheritedPerks?.[0]?.toLocaleLowerCase() || 'even legends must persevere'}. Choose your path carefully, for each choice ripples across all strands.`
    },
    stats: {
      str: 14,
      agi: 13,
      int: 16,
      cha: 15,
      end: 14,
      luk: 12
    },
    hp: 60,
    maxHp: 60,
    _foreignLegacy: {
      legacyData,
      fromWorldName: worldName,
      fromPlayerName: playerName,
      importedAt: Date.now()
    },
    _visitingLegend: true,
    _soulEchoMemory: `I remember the deeds of ${legacyData.canonicalName}...`
  };
}

/**
 * Export a player's legacy as a portable data structure
 * This can be shared/imported by other players
 */
export function exportLegacyAsJson(
  legacyImpact: LegacyImpact,
  currentWorldName: string,
  playerName: string
): string {
  const exportObj = {
    version: '1.0',
    legacyData: legacyImpact,
    worldName: currentWorldName,
    playerName: playerName,
    exportedAt: new Date().toISOString(),
    exportFormat: 'SOUL_STRAND_ECHO'
  };

  return JSON.stringify(exportObj, null, 2);
}

/**
 * Import a JSON-encoded legacy string
 */
export function parseLegacyFromJson(jsonString: string): {
  legacy: LegacyImpact;
  worldName: string;
  playerName: string;
} | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.exportFormat !== 'SOUL_STRAND_ECHO') {
      return null; // Wrong format
    }
    return {
      legacy: parsed.legacyData,
      worldName: parsed.worldName,
      playerName: parsed.playerName
    };
  } catch (e) {
    console.error('Failed to parse legacy JSON:', e);
    return null;
  }
}

/**
 * Generational NPC Lineages (M29: Opinion Inheritance)
 * 
 * NPCs can have descendants in future epochs. If the player helped an ancestor,
 * the descendant starts with a "Legacy Bonus" to reputation and special dialogue.
 */
export interface NpcLineage {
  lineageId: string;            // Unique identifier for NPC family line
  ancestorId: string;           // Original NPC from Epoch I
  ancestorName: string;         // Display name
  generationNumber: number;     // 1 for original, 2 for child, etc.
  descendants: Array<{
    npcId: string;
    epochId: string;
    generationNumber: number;
  }>;
}

/**
 * Calculate legacy reputation bonus for NPC descendants
 * If the player helped an ancestor, descendants get a head start
 */
export function calculateAncestryBonus(
  playerReputation: number,
  generationDistance: number  // How many epochs since ancestor
): number {
  // Reputation decays over generations but remains positive if helpful ancestor
  if (playerReputation <= 0) return 0;

  // Bonus calculation: original rep * (1 - generation_decay)
  // Gen 1 (current): full bonus
  // Gen 2: 80% bonus
  // Gen 3+: 50% bonus
  const decayRate = Math.min(0.5, generationDistance * 0.15);
  const bonus = playerReputation * (1 - decayRate);

  return Math.floor(bonus);
}

/**
 * Generate legacy-aware dialogue for NPC descendants
 */
export function getAncestryDialogue(
  npcName: string,
  ancestorName: string,
  playerReputation: number
): string {
  if (playerReputation <= 0) {
    return `${npcName}? My ancestor ${ancestorName} never mentioned your name...`;
  }

  if (playerReputation >= 75) {
    return `You're the one my ancestor ${ancestorName} spoke of with such reverence! They said you saved everything. We owe you a great debt.`;
  }

  if (playerReputation >= 50) {
    return `My grandfather ${ancestorName} often spoke kindly of you. You were good to our family. That means something.`;
  }

  return `My ancestor ${ancestorName} mentioned you once. They seemed to respect your character.`;
}

/**
 * Apply ancestry bonus to NPC reputation in next epoch
 * Called during chronicle seeding to boost descended NPCs
 */
export function applyAncestryBonusToNpc(
  npc: any,
  playerLegacyReps: Record<string, number>,
  generationDistance: number = 1
): any {
  if (!npc.lineageId) return npc;

  // Find if player had relationship with ancestor
  const ancestorRep = playerLegacyReps[npc.lineageId] || 0;
  const bonus = calculateAncestryBonus(ancestorRep, generationDistance);

  if (bonus > 0) {
    return {
      ...npc,
      _ancestryBonus: bonus,
      _ancestorName: npc._ancestorName,
      // Dialogue will be injected by AI DM using getAncestryDialogue()
      reputation: (npc.reputation || 0) + bonus
    };
  }

  return npc;
}

// ============================================================================
// M31 Task 6: The "Observer's Prophecy" (Meta-Narrative Capstone)
// ============================================================================

/**
 * Represents a prophecy about the bloodline's destiny
 */
export interface WorldEndProphecy {
  title: string;
  prophecyText: string;
  sentiment: 'dark' | 'neutral' | 'hopeful' | 'transcendent';
  bloodlinePower: number;         // 0-100 scale of mythStatus influence
  themeAdjective: string;          // Descriptive word for the age
  symbolicEnding: string;          // What fate awaits
  actionImperative: string;        // What should be done next
}

/**
 * Generate a world-end prophecy based on the bloodline's accumulated myth status
 *
 * This represents the climactic narrative evaluation of the entire saga.
 * As generations pass and accumulate myth, the prophecy shifts from:
 * - Dark Prophecy (0-25 myth): "All will fall to shadow"
 * - Uncertain Prophecy (25-50 myth): "The outcome remains unwritten"
 * - Hopeful Prophecy (50-75 myth): "A light persists against the dark"
 * - Transcendent Prophecy (75-100 myth): "A new age shall dawn from the ashes"
 *
 * The prophecy is updated each epoch, changing as the bloodline's legend grows.
 */
export function generateWorldEndProphecy(bloodlineProfile: BloodlineProfile): WorldEndProphecy {
  const totalMythStatus = bloodlineProfile.totalMythStatus;
  const generationCount = bloodlineProfile.legacyImpacts.length;

  // Normalize myth status to 0-100 scale
  const maxPossibleMyth = 100 * generationCount; // Each generation can be 0-100
  const normalizedMyth = Math.min(100, (totalMythStatus / maxPossibleMyth) * 100);

  // Determine sentiment and tone based on myth status
  let sentiment: 'dark' | 'neutral' | 'hopeful' | 'transcendent';
  let themeAdjective: string;
  let prophecyText: string;
  let symbolicEnding: string;
  let actionImperative: string;

  if (normalizedMyth < 25) {
    // Dark prophecy: tragedy and failure
    sentiment = 'dark';
    themeAdjective = 'Twilight';
    prophecyText = `
**The Prophecy of Eternal Dusk**

The thread spun by your bloodline grows thin and frayed. With each passing age, the light dims further. 
Generations rise and fall like waves upon a darkening shore, yet the darkness only deepens.

The world remembers your names—but as warnings. Cautionary echoes of those who strove and failed.

There are no heroes coming. There was never salvation written in the stars.

The Age of Shadows closes upon itself.
    `.trim();
    symbolicEnding = 'The extinction of all things in eternal darkness';
    actionImperative =
      'Prepare for the end. All things must pass. Your defiance cannot change fate itself.';
  } else if (normalizedMyth < 50) {
    // Neutral prophecy: unresolved struggle
    sentiment = 'neutral';
    themeAdjective = 'Twilight';
    prophecyText = `
**The Prophecy of Uncertain Resolution**

Your bloodline has tasted both triumph and despair. The scales remain balanced—neither victory nor defeat is assured.

Each generation adds their weight, each choice matters. Yet the pattern remains unclear.

Will the accumulated courage of your ancestors tip the scales toward light? Or will sorrow consume all?

The prophecy remains inscribed in uncertainty.
    `.trim();
    symbolicEnding = 'A world at the precipice, balanced between salvation and ruin';
    actionImperative = 'Continue striving. History does not write itself. Your choices still matter.';
  } else if (normalizedMyth < 75) {
    // Hopeful prophecy: light persists
    sentiment = 'hopeful';
    themeAdjective = 'Emerging Dawn';
    prophecyText = `
**The Prophecy of Persistence**

Though shadows gather thick, a light persists. Generation after generation, your bloodline has refused to break.

The accumulated deeds of your ancestors shine like stars captured in crystal. In the darkest hours, that light burns brightest.

The darkness recedes, step by step.

A new age stirs beneath the dying one.
    `.trim();
    symbolicEnding = 'The world transforms, scarred but renewed, under a new sky';
    actionImperative =
      'Continue the work begun by those before you. The light is real. It can yet prevail.';
  } else {
    // Transcendent prophecy: transformation and renewal
    sentiment = 'transcendent';
    themeAdjective = 'Ascendant';
    prophecyText = `
**The Prophecy of Transcendence**

Your bloodline has become a beacon. Across epochs, through impossible trials, you have persisted—and more than persisted: you have *transformed*.

The accumulated wisdom and courage of your ancestors has woven a tapestry of such power that reality itself takes notice.

The old world dissolves. In its place, something unprecedented emerges.

You are no longer merely surviving the end of ages. You are midwives to a new cosmos.
    `.trim();
    symbolicEnding = 'The birth of a new age, forever changed by your bloodline\'s touch';
    actionImperative = 'Embrace what you have become. The world waits for the next chapter you will write.';
  }

  return {
    title: sentiment === 'dark' ? 'The Final Prophecy' : 'The Turning Prophecy',
    prophecyText,
    sentiment,
    bloodlinePower: normalizedMyth,
    themeAdjective,
    symbolicEnding,
    actionImperative
  };
}

/**
 * Format prophecy for display in ChronicleScroll UI
 */
export function formatProphecyForDisplay(prophecy: WorldEndProphecy): string {
  return `
# ${prophecy.title}

*Bloodline Power: ${Math.floor(prophecy.bloodlinePower)}%*

${prophecy.prophecyText}

---

**The ${prophecy.themeAdjective} Awaits:**
${prophecy.symbolicEnding}

**What Must Be Done:**
${prophecy.actionImperative}
  `.trim();
}

/**
 * Get color for prophecy display based on sentiment
 */
export function getProphecyColor(sentiment: string): string {
  const colors: Record<string, string> = {
    dark: '#8b0000',        // Dark red
    neutral: '#808080',     // Gray
    hopeful: '#4da6ff',     // Light blue
    transcendent: '#ffd700' // Gold
  };
  return colors[sentiment] ?? '#999999';
}

/**
 * Get icon emoji for prophecy sentiment
 */
export function getProphecyIcon(sentiment: string): string {
  const icons: Record<string, string> = {
    dark: '🌑',             // New moon
    neutral: '⚖️',         // Scales
    hopeful: '🌅',         // Sunrise
    transcendent: '✨'     // Sparkles
  };
  return icons[sentiment] ?? '?';
}

/**
 * Calculate minimum myth needed to reach next prophecy tier
 */
export function getMythRequiredForNextTier(currentMyth: number, totalGenerations: number): number {
  const maxMyth = 100 * totalGenerations;
  const tiers = [0.25 * maxMyth, 0.5 * maxMyth, 0.75 * maxMyth, maxMyth];

  for (const tier of tiers) {
    if (currentMyth < tier) {
      return Math.ceil(tier - currentMyth);
    }
  }

  return 0; // Already at max
}

/**
 * Get prophecy advice based on current trajectory
 */
export function getProphecyAdvice(prophecy: WorldEndProphecy): string {
  if (prophecy.sentiment === 'dark') {
    return 'The darkness deepens. But every hero begins in darkness. Perhaps your bloodline will be different.';
  }
  if (prophecy.sentiment === 'neutral') {
    return 'The outcome hangs in balance. The next generation is crucial. What will they choose?';
  }
  if (prophecy.sentiment === 'hopeful') {
    return 'Your ancestors have lit a fire. Keep it burning. The world watches to see if it grows into a blaze.';
  }
  return 'The impossible has become inevitable. Your bloodline transcends the mortal struggle. What now?';
}
