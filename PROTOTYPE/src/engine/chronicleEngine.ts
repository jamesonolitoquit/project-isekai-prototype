/**
 * Chronicle Engine (BETA Phase)
 * 
 * Purpose: Manage the Chronicle Sequence - the logic that transitions between epochs
 * by calculating "World Deltas" (changes to geography, faction power, NPC states) and
 * applying "Soft Canon" (player legacy influence) to the next epoch.
 * 
 * The Chronicle Sequence is the meta-narrative that persists across all player lifetimes.
 * Each epoch is a different timeline/reality, but they're connected through legacy.
 */

import type { WorldState, Quest, UniqueItem, InventoryItem, NPC } from './worldEngine';
import type { LegacyImpact } from './legacyEngine';
import { SeededRng } from './prng';
import { evolveFactionGeneology, redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine';
// M32: Multiplayer voting integration
import type { SessionRegistry, EpochVoteState } from './multiplayerEngine';
import { createEpochVote, recordEpochVote, hasEpochVoteConsensus } from './multiplayerEngine';

export interface EpochDefinition {
  id: string;                    // e.g., "epoch_i_fracture"
  sequenceNumber: number;        // 1, 2, 3...
  name: string;                  // "Epoch I: Fracture"
  theme: string;                 // Narrative focus ("Recovery", "Waning Light", etc.)
  chronologyYear: number;        // In-world year this epoch takes place
  description: string;           // OOC flavor
  previousEpochId?: string;      // Link to prior epoch
nextEpochId?: string;           // Link to next epoch
  factionStateOverride?: Record<string, any>; // How factions evolve (independent of player)
}

export interface WorldDelta {
  factionPowerShifts: Record<string, number>; // Faction ID -> power delta
  locationChanges: Array<{
    locationId: string;
    changes: {
      description?: string;
      biome?: string;
      discovered?: boolean;
      environmentalEffects?: string[];
    };
  }>;
  npcStateShifts: Array<{
    npcId: string;
    changes: {
      locationId?: string;
      reputation?: number;
      alive?: boolean;
      title?: string;
    };
  }>;
  eventLog: string[]; // Historical events that occurred
}

export interface SoftCanon {
  playerLegacyInfluence: number;  // How much player actions shaped the world (0-100)
  inheritedFactionReputation: Record<string, number>; // Factions remember player
  discoveredLocationsCarryOver: string[]; // Locations stay discovered
  npcMemoriesOfPlayer: Record<string, string>; // NPC -> what they remember about player
  worldState: 'improved' | 'declined' | 'neutral'; // Overall trajectory
}

/**
 * M30 Task 1: The Finality Engine
 * Universal Historical Summary combines all bloodline data into a capstone artifact
 */
export interface UniversalHistoricalSummary {
  id: string; // Unique chronicle ID
  name: string; // e.g., "The Chronicle of House Valorian"
  totalEpochsSpanned: number; // How many epochs this bloodline lived through
  totalGenerations: number; // Number of distinct playthroughs
  cumulativeMythStatus: number; // Sum of all ancestor myth contributions
  greatestAncestor: {
    name: string;
    mythStatus: number;
    dominantDeeds: string[];
    epochsLived: number;
  };
  factionLegacies: Record<string, {
    reputation: number;
    finalPower: number;
    primaryInteraction: string;
  }>;
  paradoxCost: number; // Total temporal debt accumulated
  blightedBiomes: string[]; // Biomes left corrupted by chronicle
  restoredLocations: string[]; // Places the bloodline saved
  finalEventLog: string[]; // Key milestone moments
  timestamp: number; // When chronicle was concluded
  trueNewGameSeed: number; // World seed for True New Game+
}

export const EPOCH_DEFINITIONS: Record<string, EpochDefinition> = {
  'epoch_i_fracture': {
    id: 'epoch_i_fracture',
    sequenceNumber: 1,
    name: 'Epoch I: Fracture',
    theme: 'The world has been shattered by paradox. The player must bring order.',
    chronologyYear: 1000,
    description: 'The initial playable era where the template awakens. Factions vie for control.',
    nextEpochId: 'epoch_ii_waning'
  },
  'epoch_ii_waning': {
    id: 'epoch_ii_waning',
    sequenceNumber: 2,
    name: 'Epoch II: Waning',
    theme: 'The world stabilizes but grows quieter. Entropy encroaches.',
    chronologyYear: 1200,
    description: 'The second era, shaped by the first player\'s actions. Magic fades, mystery deepens.',
    previousEpochId: 'epoch_i_fracture',
    nextEpochId: 'epoch_iii_twilight'
  },
  'epoch_iii_twilight': {
    id: 'epoch_iii_twilight',
    sequenceNumber: 3,
    name: 'Epoch III: Twilight',
    theme: 'The age of magic ends. A new darkness rises.',
    chronologyYear: 1500,
    description: 'Ancient magic has faded; new powers emerge from the void.',
    previousEpochId: 'epoch_ii_waning'
  }
};

/**
 * Calculate world deltas for the next epoch based on this epoch's state
 * This represents how the independent world evolves (without player influence)
 */
export function calculateBaseWorldDelta(
  fromEpoch: EpochDefinition,
  toEpoch: EpochDefinition,
  state: WorldState
): WorldDelta {
  const delta: WorldDelta = {
    factionPowerShifts: {},
    locationChanges: [],
    npcStateShifts: [],
    eventLog: []
  };

  // Base faction power shifts based on epoch progression
  if (state.factions) {
    state.factions.forEach(faction => {
      // Factions gradually decline/shift based on epoch theme
      if (toEpoch.theme.includes('Waning')) {
        delta.factionPowerShifts[faction.id] = -10; // Power fades
        delta.eventLog.push(`${faction.name} weakens as magic wanes`);
      } else if (toEpoch.theme.includes('Twilight')) {
        delta.factionPowerShifts[faction.id] = -20; // Power greatly diminished
        delta.eventLog.push(`${faction.name} struggles against the encroaching darkness`);
      }
    });
  }

  // Location degradation over time
  if (state.locations) {
    state.locations.forEach(location => {
      if (toEpoch.theme.includes('Waning')) {
        delta.locationChanges.push({
          locationId: location.id,
          changes: {
            description: `${location.description || ''} (now overgrown and quieter)`
          }
        });
      }
    });
  }

  return delta;
}

/**
 * Calculate soft canon influence - how much the player shaped the next epoch
 */
export function calculateSoftCanon(
  legacy: LegacyImpact,
  state: WorldState,
  baselineDelta: WorldDelta
): SoftCanon {
  const canon: SoftCanon = {
    playerLegacyInfluence: legacy.mythStatus,
    inheritedFactionReputation: legacy.factionInfluence,
    discoveredLocationsCarryOver: [],
    npcMemoriesOfPlayer: {},
    worldState: 'neutral'
  };

  // High myth status shaped the world
  if (legacy.mythStatus >= 70) {
    canon.worldState = 'improved';
    canon.playerLegacyInfluence = 100;
  } else if (legacy.mythStatus <= 30) {
    canon.worldState = 'declined';
    canon.playerLegacyInfluence = 0;
  }

  // Generate NPC memories
  Object.entries(legacy.factionInfluence).forEach(([factionId, rep]) => {
    if (rep > 50) {
      canon.npcMemoriesOfPlayer[factionId] = `${legacy.canonicalName} was a great ally to us.`;
    } else if (rep < -50) {
      canon.npcMemoriesOfPlayer[factionId] = `${legacy.canonicalName} was our sworn enemy.`;
    } else {
      canon.npcMemoriesOfPlayer[factionId] = `We remember ${legacy.canonicalName}, for better or worse.`;
    }
  });

  return canon;
}

/**
 * Apply soft canon to world delta - blend player influence with base progression
 */
export function applySoftCanonToDelta(
  delta: WorldDelta,
  canon: SoftCanon
): WorldDelta {
  // If player was legendary, amplify positive effect on world
  if (canon.worldState === 'improved') {
    Object.keys(delta.factionPowerShifts).forEach(factionId => {
      // Factions allied with player don't decline as harshly
      const allyReputation = canon.inheritedFactionReputation[factionId];
      if (allyReputation !== undefined && allyReputation > 0) {
        delta.factionPowerShifts[factionId] = Math.max(
          delta.factionPowerShifts[factionId],
          -5 // Less severe decline
        );
      }
    });
    delta.eventLog.push(`The legendary hero's final deeds echoed through the ages, shaping history.`);
  } else if (canon.worldState === 'declined') {
    delta.eventLog.push(`Without a hero's guiding hand, the world drifted further into darkness.`);
  }

  return delta;
}

/**
 * Biome Entropy Engine: Calculate environmental mutations for the next epoch
 * 
 * Rules:
 * - High corrupted/spiritDensity locations transform their biomes
 * - Forest -> Blighted Woods (if corrupted)
 * - Plains -> Obsidian Barrens (if corrupted)
 * - Village -> Ghost Town (if corrupted)
 * - Maritime -> Stagnant Shallows (if corrupted)
 * 
 * Each location tracks its "corruption level" which accumulates over epochs
 */
export function calculateEnvironmentalShift(
  locations: any[],
  fromEpoch: EpochDefinition,
  toEpoch: EpochDefinition
): Map<string, { biome: string; description: string }> {
  const shifts = new Map<string, { biome: string; description: string }>();

  locations.forEach(location => {
    const spiritDensity = location.spiritDensity || 0;
    const corruptionLevel = (location._corruptionLevel || 0) + spiritDensity * 0.1;
    
    // Only shift biomes if corruption is significant (> 40)
    if (corruptionLevel < 40) return;

    const baseBiome = location.biome || 'plains';
    const epochProgression = toEpoch.sequenceNumber - fromEpoch.sequenceNumber;

    // Define biome shifting paths based on corruption
    const blightedTransforms: Record<string, Record<number, string>> = {
      'forest': { 1: 'Blighted Woods', 2: 'Withered Wastelands' },
      'plains': { 1: 'Obsidian Barrens', 2: 'Ash Fields' },
      'village': { 1: 'Ghost Town', 2: 'Spectral Ruins' },
      'maritime': { 1: 'Stagnant Shallows', 2: 'Cursed Depths' },
      'cave': { 1: 'Festering Caverns', 2: 'Abyssal Chasm' },
      'shrine': { 1: 'Profaned Altar', 2: 'Altar of Void' },
      'mountain': { 1: 'Blighted Peak', 2: 'Shattered Mountain' }
    };

    const targetTransforms = blightedTransforms[baseBiome] || {};
    const transformKey = Math.min(epochProgression, 2);
    const newBiome = targetTransforms[transformKey];

    if (newBiome) {
      const descriptionOverrides: Record<string, string> = {
        'Blighted Woods': 'Once verdant, these woods are now twisted by dark magic. Corrupted trees bear fruit of despair.',
        'Withered Wastelands': 'All life has been drained. Only the memories of forests remain as ghostly silhouettes.',
        'Obsidian Barrens': 'The plains are covered in black obsidian shards, sharp as tears.',
        'Ash Fields': 'The earth itself has turned to ash. Nothing grows here.',
        'Ghost Town': 'This settlement is inhabited only by echoes and regret.',
        'Spectral Ruins': 'Not even ruins remain—only the spiritual impressions of what was.',
        'Stagnant Shallows': 'Water no longer flows. Only rot remains.',
        'Cursed Depths': 'The very concept of depth has been perverted by ancient curses.',
        'Festering Caverns': 'The stone walls weep with corruption.',
        'Abyssal Chasm': 'A chasm that hungers and remembers.',
        'Profaned Altar': 'Sacred ground corrupted by ritual and malice.',
        'Altar of Void': 'The altar draws all meaning into the void.',
        'Blighted Peak': 'The mountain crown blackens with curse.',
        'Shattered Mountain': 'The mountain has fragmented, leaving jagged scars.'
      };

      shifts.set(location.id, {
        biome: newBiome,
        description: descriptionOverrides[newBiome] || `The ${baseBiome} has been transformed by the passing epochs.`
      });
    }
  });

  return shifts;
}

/**
 * Great Library System: Lore Persistence Across Epochs
 * 
 * Archives discovered books/lore from current epoch and makes them available
 * in the "Great Library" sub-area during the next epoch. Players can research
 * archived lore to satisfy quest prerequisites.
 */
export function populateGreatLibrary(
  fromState: WorldState,
  toEpochDef: EpochDefinition
): any[] {
  // Collect archived knowledge entries (knowledgeBase is a Set, convert to array)
  const archivedLore = Array.from(fromState.player?.knowledgeBase || []).filter((entry: any) =>
    entry._archived || entry.isHistorical
  );

  if (archivedLore.length === 0) return [];

  // Create library sub-areas for each archived lore entry
  return archivedLore.map((lore: any, index: number) => ({
    id: `library_tome_${index}`,
    name: `Tome: "${lore.title || lore.id}"`,
    parentLocationId: 'luminara-grand-market', // Great Library in Lux-Ar
    description: `A carefully preserved volume from the ${toEpochDef === EPOCH_DEFINITIONS['epoch_ii_waning'] ? 'Fracture Era' : 'Waning Era'}.\n\n${lore.content || lore.description}`,
    difficulty: 12,
    discovered: true,
    rewards: [],
    environmentalEffects: ['enhanced_memory', 'quiet_contemplation'],
    _loreContent: lore,
    _researchable: true,
    _researchReward: lore.questPrerequisiteBypass || []
  }));
}

/**
 * Create the Great Library location/sub-area if it doesn't exist
 * This is a stable location that persists across epochs
 */
export function ensureGreatLibraryExists(locations: any[]): any[] {
  const libraryParent = locations.find(l => l.id === 'luminara-grand-market');
  
  if (!libraryParent) {
    // If main market doesn't exist, create a standalone library
    return [
      ...locations,
      {
        id: 'great-library-monument',
        name: 'The Great Library',
        description: 'An ancient repository of collected wisdom from all ages. Books and scrolls line endless halls, preserved by ancestral magic.',
        x: 500,
        y: 500,
        biome: 'village',
        discovered: true,
        spiritDensity: 0.7,
        subAreas: []
      }
    ];
  }

  return locations;
}

/**
 * Link researched lore to quest prerequisite satisfaction
 * If a player researches a tome, they satisfy the prerequisite it offers
 */
export function satisfyLoreGatedQuest(
  playerState: any,
  tomeId: string,
  libraries: any[]
): any {
  const tome = libraries.find((lib: any) => lib.id === tomeId);
  if (!tome || !tome._researchReward) {
    return playerState;
  }

  return {
    ...playerState,
    _researchedLore: [
      ...(playerState._researchedLore || []),
      tomeId
    ],
    _satisfiedPrerequisites: [
      ...(playerState._satisfiedPrerequisites || []),
      ...tome._researchReward
    ]
  };
}

/**
 * Epoch-Linked Sub-Areas (M29: Temporal Gates)
 * 
 * Filter sub-areas based on epoch availability.
 * A sub-area marked for Epoch II/III only won't appear in Epoch I.
 * Supports dynamic descriptions and biome shifts per epoch.
 */
export function applyTemporalGating(
  locations: any[],
  toEpochId: string
): any[] {
  return locations.map(location => {
    if (!location.subAreas || location.subAreas.length === 0) {
      return location;
    }

    // Filter sub-areas based on temporal availability
    const gatedSubAreas = location.subAreas
      .map((subArea: any) => {
        const gating = subArea.gating_criteria;
        if (!gating) return subArea;

        // Check if this sub-area is available in the current epoch
        const shouldHide = gating.hiddenInEpochs?.includes(toEpochId);
        const shouldShow = !gating.availableInEpochs || gating.availableInEpochs.includes(toEpochId);

        if (shouldHide || !shouldShow) {
          // Mark as unavailable but preserve for history
          return {
            ...subArea,
            _inaccessibleInEpoch: toEpochId,
            discovered: false  // Reset discovery if coming back
          };
        }

        // Apply epoch-specific overrides
        let modifiedSubArea = { ...subArea };
        if (gating.description_override?.[toEpochId]) {
          modifiedSubArea.description = gating.description_override[toEpochId];
        }
        if (gating.biome_shift?.[toEpochId]) {
          modifiedSubArea.biome = gating.biome_shift[toEpochId];
        }

        return modifiedSubArea;
      })
      .filter((subArea: any) => !subArea._inaccessibleInEpoch);

    return {
      ...location,
      subAreas: gatedSubAreas
    };
  });
}

/**
 * Transform quest objectives to reflect passage of time and changed world
 * Example: "Kill the Bandit King" → "Purge the Ghost of the Bandit King's Fortress"
 */
function transformQuestObjective(objective: any, epochProgressions: number): any {
  if (!objective) return objective;

  // Map original objectives to their "aged" versions
  const objectiveTransforms: Record<string, Record<string, string>> = {
    1: { // One epoch has passed
      'combat': 'Defeat the lingering echoes of',
      'exploration': 'Explore the ruins of',
      'gather': 'Retrieve relics from',
      'challenge': 'Overcome the cursed variant of'
    },
    2: { // Two epochs have passed
      'combat': 'Vanquish the corrupted spirit of',
      'exploration': 'Navigate the spectral remnants of',
      'gather': 'Salvage ancient artifacts from',
      'challenge': 'Master the transcendent form of'
    }
  };

  const progression = Math.min(epochProgressions, 2);
  const transforms = objectiveTransforms[progression] || objectiveTransforms[1];

  return {
    ...objective,
    target: transforms[objective.type] ? `${transforms[objective.type]} ${objective.target}` : objective.target,
    description: `(Age-worn version) ${objective.description || ''}`
  };
}

/**
 * Transform legacy quests from previous epoch into "Ancient Rumor" quests
 * Incomplete quests become mysterious relics of the past era
 */
export function transformLegacyQuests(
  previousQuests: Quest[],
  fromState: WorldState
): Quest[] {
  const rng = new SeededRng(fromState.seed);
  return previousQuests
    .filter(quest => quest.persist_across_epochs)
    .map((quest, index) => {
      const template = quest.legacy_quest_template || {
        title_prefix: 'Ancient Rumor: ',
        difficulty_increase: 1.5
      };

      // Calculate epoch progression
      const currentSequence = fromState.epochMetadata?.sequenceNumber || 1;
      const epochProgressions = Math.max(0, currentSequence - 1);

      // Use seeded RNG for deterministic ID generation
      const pseudoTimestamp = rng.nextInt(1000000, 9999999);

      // Transform objectives to reflect passage of time
      const transformedObjectives = (quest.objectives || []).map(obj =>
        transformQuestObjective(obj, epochProgressions)
      );

      return {
        ...quest,
        id: `${quest.id}_legacy_${pseudoTimestamp}`,
        title: `${template.title_prefix}${quest.title}`,
        description: template.description_override || `An echo from ages past: ${quest.description}`,
        objectives: transformedObjectives,
        _legacyQuestOrigin: {
          originalId: quest.id,
          originEpochId: fromState.epochId,
          originYear: fromState.epochMetadata?.chronologyYear,
          transformedAtEpoch: currentSequence
        }
      };
    });
}

/**
 * Apply NPC epoch transformations from world template overrides
 * This ages NPCs and updates their stats/titles based on era progression
 */
export function applyNpcEpochTransformations(
  npcs: NPC[],
  toEpochId: string,
  worldTemplate?: Record<string, any>
): NPC[] {
  if (!worldTemplate?.epochOverrides?.[toEpochId]?.npcTransformations) {
    return npcs; // No transformations defined for this epoch
  }

  const transforms = worldTemplate.epochOverrides[toEpochId].npcTransformations;
  const transformMap = new Map(
    transforms.map((t: any) => [t.originalNpcId, t.epochTransform])
  );

  return npcs.map(npc => {
    const transform = transformMap.get(npc.id) as any;
    if (!transform) return npc;

    return {
      ...npc,
      name: transform.name || npc.name,
      title: (transform.title as string) || (npc as any).title,
      description: transform.description || (npc as any).description,
      // Apply stat deltas
      stats: transform.stats_delta && npc.stats ? {
        str: (npc.stats.str || 0) + ((transform.stats_delta as any).str || 0),
        agi: (npc.stats.agi || 0) + ((transform.stats_delta as any).agi || 0),
        int: (npc.stats.int || 0) + ((transform.stats_delta as any).int || 0),
        cha: (npc.stats.cha || 0) + ((transform.stats_delta as any).cha || 0),
        end: (npc.stats.end || 0) + ((transform.stats_delta as any).end || 0),
        luk: (npc.stats.luk || 0) + ((transform.stats_delta as any).luk || 0)
      } : npc.stats,
      // Mark special states (spectral, statue)
      _isSpectral: transform.isSpectral || false,
      _isStatue: transform.isStatue || false,
      _epochDialogueSuffix: transform.dialogue_suffix || []
    };
  });
}

/**
 * Get next epoch definition in the sequence
 */
export function getNextEpoch(currentEpochId: string): EpochDefinition | null {
  const current = EPOCH_DEFINITIONS[currentEpochId];
  if (!current?.nextEpochId) return null;
  return EPOCH_DEFINITIONS[current.nextEpochId] || null;
}

/**
 * M29 Task 4: Paradox Bloom
 * Calculate cumulative meta-suspicion from timeline anomalies
 * Tracks factors like: save/load cycles, perfect outcome sequences, stat optimization
 */
export function getTotalMetaSuspicion(state: WorldState): number {
  let suspicion = 0;

  // Factor 1: Unusually high stat growth (>15 per level suggests save-scumming)
  if (state.player?.stats) {
    const stats = state.player.stats;
    const totalStats = (stats.str || 0) + (stats.agi || 0) + (stats.int || 0) + 
                       (stats.cha || 0) + (stats.end || 0) + (stats.luk || 0);
    const level = state.player.level || 1;
    const avgPerLevel = totalStats / Math.max(level, 1);
    if (avgPerLevel > 18) suspicion += 20; // Suspicious stat optimization
  }

  // Factor 2: Player has high level for current epoch (time acceleration)
  if (state.player?.level) {
    const expectedMaxLevel = state.epochMetadata?.sequenceNumber ? (state.epochMetadata.sequenceNumber * 5) : 10;
    if (state.player.level > expectedMaxLevel * 1.5) {
      suspicion += 25; // Level too high for progression speed
    }
  }

  // Factor 3: Player has excessive gold (suggests dupes/exploits)
  if (state.player?.gold && state.player.gold > 50000) {
    suspicion += Math.min(20, Math.floor((state.player.gold - 50000) / 50000)); // Cap at +20
  }

  // Factor 4: Inventory optimization (too many quality items)
  if (state.player?.inventory && state.player.inventory.length > 0) {
    const rareItems = state.player.inventory.filter(item => (item as any).rarity && (item as any).rarity !== 'common').length;
    const rareRatio = rareItems / state.player.inventory.length;
    if (rareRatio > 0.5) {
      suspicion += Math.min(20, Math.floor(rareRatio * 40)); // Too many rare items
    }
  }

  // Factor 5: World state anomalies (player has touched too many locations too fast)
  if (state.locations) {
    const discoveredLocations = state.locations.filter(loc => (loc as any).discovered).length;
    const discoveryRatio = discoveredLocations / state.locations.length;
    if (discoveryRatio > 0.9) {
      suspicion += 15; // Almost everything discovered (too fast)
    }
  }

  return Math.min(suspicion, 100); // Cap at 100
}

/**
 * M29 Task 4: Create a "Chaos-Glitched" NPC aware of timeline anomalies
 * These NPCs appear in Epoch III if meta-suspicion threshold exceeded
 * They reference paradoxes, impossible timelines, and metagame mechanics
 */
export function createChaosGlitchedNpc(index: number, worldSeed: number): NPC {
  const rng = new SeededRng(worldSeed + index * 731);
  
  const glitchNames = [
    `Echo-${index}`, `Paradox-${index}`, `Wraith-${index}`, `Shard-${index}`, `Glitch-${index}`
  ];
  
  const chaosDialogues = [
    'I remember... but you reset this memory. Again. And again.',
    'There are fractures in reality. You pass through them. I felt seventeen versions of you today.',
    'The timeline stutters. It\'s like you\'re _reloading_.',
    'Something\'s wrong with causality here. Events replay themselves differently when you\'re not looking.',
    'I exist in three states simultaneously. Which version of me are you talking to?',
    'Did we have this conversation before? I think we did. Infinite times.',
    'The world feels... constructed. Remaking itself. For you.',
    'Your destiny reshapes itself. That\'s not normal. That\'s not how time should work.'
  ];

  const glitchDescriptions = [
    'A figure that flickers between states, aware of timeline fractures.',
    'An entity that phases between realities, remembering more than it should.',
    'A being composed of contradictions, speaking of impossible coincidences.',
    'A shadow-person aware of probability manipulation and reset cycles.',
    'A temporal echo, conscious of its own unreality.'
  ];

  return {
    id: `glitch_npc_${worldSeed}_${index}`,
    name: glitchNames[index % glitchNames.length],
    description: glitchDescriptions[rng.nextInt(0, glitchDescriptions.length - 1)],
    factionId: 'faction_void', // Neutral faction
    locationId: '', // Spawned dynamically
    level: 15,
    stats: {
      str: 10,
      agi: 14,
      int: 18,
      cha: 12,
      end: 11,
      luk: 16 // High luck = awareness of probability manipulation
    },
    attacks: [
      {
        name: 'Reality Destabilize',
        baseDamage: 20,
        hitChance: 0.85,
        element: 'void'
      }
    ],
    spells: [
      {
        name: 'Timeline Echo',
        cost: 25,
        effect: 'Summon past version of target (confusion)',
        element: 'chronal'
      }
    ],
    dialogue: [
      ...chaosDialogues,
      'Your choices cascade differently each time. I remember them all.',
      'Save files reshape destiny. You know that, don\'t you?',
      'The world resets around you. But I persist. I _remember_.',
      'I\'ve seen this play out a hundred times. You always do the same thing.',
      'The die was loaded before the game started. I can feel it.',
      'You\'re not playing fairly with probability. Something\'s rigged here.'
    ],
    // Use metadata fields for chaos tracking
    _isGlitched: true,
    _chaosAwareness: true,
    _existsInMultipleTimelines: true
  } as unknown as NPC;
}

/**
 * Generate seed state for next epoch
 * This represents the world state immediately after chronicle transition
 */
export function generateEpochSeederState(
  fromState: WorldState,
  toEpochDef: EpochDefinition,
  legacy: LegacyImpact
): Partial<WorldState> {
  const rng = new SeededRng(fromState.seed);
  const baselineDelta = calculateBaseWorldDelta(
    EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'],
    toEpochDef,
    fromState
  );

  const canon = calculateSoftCanon(legacy, fromState, baselineDelta);
  const finalDelta = applySoftCanonToDelta(baselineDelta, canon);

  // Pre-compute metadata that will be used in nested IIFEs
  const playerFactionReps = (fromState.player as any)?.factionReputation || {};
  const withPowerShifts = (fromState.factions || []).map(faction => ({
    ...faction,
    powerScore: Math.max(0, (faction.powerScore || 50) + (finalDelta.factionPowerShifts[faction.id] || 0))
  }));
  const { evolved: evolvedFactions, extinct: extinctFactionIds, newSchisms } = evolveFactionGeneology(withPowerShifts, playerFactionReps);
  
  // Pre-compute library archive
  const libraryTomes = populateGreatLibrary(fromState, toEpochDef);

  // Build new world state with delta applied
  const pseudoTimestamp = rng.nextInt(1000000, 9999999);
  const seederState: Partial<WorldState> = {
    id: `${toEpochDef.id}_chronicle_${pseudoTimestamp}`,
    tick: 0,
    hour: 6,
    day: 1,
    dayPhase: 'morning',
    season: 'spring',
    weather: 'clear',
    seed: fromState.seed, // Keep deterministic seed family
    epochId: toEpochDef.id,
    chronicleId: fromState.chronicleId,
    epochMetadata: {
      chronologyYear: toEpochDef.chronologyYear,
      theme: toEpochDef.theme,
      description: toEpochDef.description,
      sequenceNumber: toEpochDef.sequenceNumber
    },
    // Apply faction genealogy: evolution, dissolution, schisms
    factions: (() => {
      // Redistribute extinct territories to strongest rival
      const redistributed = redistributeExtinctTerritories(evolvedFactions, extinctFactionIds);

      // Combine evolved factions with new schism factions
      return [...redistributed, ...newSchisms];
    })(),
    // Locations carry over with deltas applied, then apply environmental shifts, temporal gating, and populate library
    locations: (() => {
      const environmentalShifts = calculateEnvironmentalShift(
        fromState.locations || [],
        EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'],
        toEpochDef
      );

      let evolvedLocations = (fromState.locations || []).map(loc => {
        const locDelta = finalDelta.locationChanges.find(c => c.locationId === loc.id);
        const envShift = environmentalShifts.get(loc.id);
        
        return {
          ...loc,
          ...locDelta?.changes,
          ...(envShift && { biome: envShift.biome, description: envShift.description }),
          _corruptionLevel: ((loc as any)._corruptionLevel || 0) + ((loc.spiritDensity || 0) * 0.1)
        };
      });

      // Apply temporal gating to sub-areas (M29)
      evolvedLocations = applyTemporalGating(evolvedLocations, toEpochDef.id);

      // Ensure library exists
      evolvedLocations = ensureGreatLibraryExists(evolvedLocations);

      return evolvedLocations;
    })(),
    // NPCs carry over with state shifts, then apply epoch-based transformations
    // Filter out NPCs from extinct factions
    npcs: (() => {
      // Build base NPC array with state transitions
      const baseNpcs = applyNpcEpochTransformations(
        (fromState.npcs || [])
          .filter(npc => !isNpcFromExtinctFaction(npc, extinctFactionIds || []))
          .map(npc => {
            const npcDelta = finalDelta.npcStateShifts.find(n => n.npcId === npc.id);
            const factionId = npc.factionId || npc.id;
            const memoryText = canon.npcMemoriesOfPlayer[factionId] || 'We remember the hero of old.';
            
            return {
              ...npc,
              ...npcDelta?.changes,
              // Store memory as metadata for AI DM to reference
              _soulEchoMemory: memoryText
            };
          }),
        toEpochDef.id,
        (fromState as any)._worldTemplate // Template contains epochOverrides
      );

      // M29 Task 4: Paradox Bloom - spawn Chaos-Glitched NPCs if meta-suspicion > threshold in Epoch III
      const metaSuspicion = getTotalMetaSuspicion(fromState);
      const isFinalEpoch = toEpochDef.sequenceNumber === 3; // Epoch III: Twilight
      
      if (metaSuspicion > 50 && isFinalEpoch) {
        // Spawn 2-3 Chaos-Glitched NPCs aware of timeline anomalies
        const glitchCount = metaSuspicion > 75 ? 3 : 2;
        const glitchedNpcs = Array.from({ length: glitchCount }, (_, i) =>
          createChaosGlitchedNpc(i, fromState.seed || 12345)
        );
        
        // Assign glitched NPCs to random pre-seeded locations (we'll set locationId once seederState is complete)
        const npcsWithGlitches = glitchedNpcs.map((glitch, idx) => ({
          ...glitch,
          locationId: '' // Will be populated after locations are built
        }));
        
        return [...baseNpcs, ...npcsWithGlitches];
      }

      return baseNpcs;
    })(),
    // Transform legacy quests into "Ancient Rumor" type quests
    quests: [
      ...transformLegacyQuests(fromState.quests || [], fromState)
    ],
    // Place heirloom items from previous generation
    heirloomCaches: placeHeirloomsInNextEpoch(fromState, toEpochDef, legacy)
  };

  // Store metadata fields after object creation
  (seederState as any)._extinctFactionIds = extinctFactionIds;
  (seederState as any)._libraryArchive = libraryTomes;

  // M29 Task 4: Post-process to assign glitched NPCs to random locations
  if (toEpochDef.sequenceNumber === 3) { // Only in Epoch III
    const glitchedNpcs = seederState.npcs?.filter(npc => (npc as any)._isGlitched);
    if (glitchedNpcs && glitchedNpcs.length > 0 && seederState.locations && seederState.locations.length > 0) {
      seederState.npcs = seederState.npcs?.map(npc => {
        if ((npc as any)._isGlitched && !npc.locationId) {
          // Assign to random location
          const randomLoc = seederState.locations![Math.floor(Math.random() * seederState.locations!.length)];
          return {
            ...npc,
            locationId: randomLoc.id
          };
        }
        return npc;
      });
    }
  }

  return seederState;
}

/**
 * Initiate chronicle transition
 * Called when player completes an epoch and moves to the next
 */
/**
 * Initiate an epoch transition, with optional multiplayer voting
 * M32: If sessionRegistry and multiple active players, triggers VOTE_PROMPT_EPOCH_SHIFT
 * and waits for consensus before proceeding (all players must agree)
 */
export function initiateChronicleTransition(
  fromState: WorldState,
  legacy: LegacyImpact,
  sessionRegistry?: SessionRegistry
): WorldState {
  const nextEpoch = getNextEpoch(fromState.epochId || 'epoch_i_fracture');
  if (!nextEpoch) {
    throw new Error(`No next epoch defined after ${fromState.epochId}`);
  }

  // M32: If multiplayer session with multiple players, require consensus vote
  if (sessionRegistry && sessionRegistry.activePlayers.length > 1) {
    // Create epoch transition vote
    const voteState = createEpochVote(sessionRegistry, fromState.player.id);
    
    // Store vote state in world state for UI to consume
    // In production, this would emit a UI event like VOTE_PROMPT_EPOCH_SHIFT
    // For now, we'll simulate consensus by returning the state with vote metadata
    const stateWithVote: WorldState & { _epochVoteState?: EpochVoteState } = {
      ...fromState,
      _epochVoteState: voteState
    };
    
    return stateWithVote;
  }

  // Solo or single player: proceed immediately
  const seedState = generateEpochSeederState(fromState, nextEpoch, legacy);
  return seedState as WorldState;
}

/**
 * Process an epoch transition vote from a player
 * M32: Records player's vote and checks if consensus achieved
 */
export function recordPlayerEpochVote(
  voteState: EpochVoteState,
  registry: SessionRegistry,
  playerId: string,
  voteApprove: boolean
): { voteState: EpochVoteState; consensusReached: boolean } {
  recordEpochVote(voteState, playerId, voteApprove);
  const consensusReached = hasEpochVoteConsensus(voteState, registry);
  
  return { voteState, consensusReached };
}

/**
 * Check if we can complete epoch transition (consensus + timeout handling)
 * M32: Returns true if all players voted yes, false if any voted no
 */
export function canFinalizeEpochTransition(
  voteState: EpochVoteState,
  registry: SessionRegistry
): 'consensus' | 'rejected' | 'pending' {
  if (voteState.rejected.size > 0) {
    return 'rejected'; // At least one player rejected
  }
  
  if (hasEpochVoteConsensus(voteState, registry)) {
    return 'consensus'; // All players agreed
  }
  
  return 'pending'; // Still waiting for votes
}

/**
 * Complete an epoch transition after multiplayer consensus achieved
 */
export function completeConsensusEpochTransition(
  fromState: WorldState,
  legacy: LegacyImpact,
  voteState: EpochVoteState,
  registry: SessionRegistry
): WorldState {
  // Verify consensus was actually achieved
  if (!hasEpochVoteConsensus(voteState, registry)) {
    throw new Error('Cannot transition: epoch vote consensus not achieved');
  }

  const nextEpoch = getNextEpoch(fromState.epochId || 'epoch_i_fracture');
  if (!nextEpoch) {
    throw new Error(`No next epoch defined after ${fromState.epochId}`);
  }

  const seedState = generateEpochSeederState(fromState, nextEpoch, legacy);
  return seedState as WorldState;
}

/**
 * Check if chronicle sequence is complete (all epochs exhausted)
 */
export function isChronicleComplete(currentEpochId: string): boolean {
  const epoch = EPOCH_DEFINITIONS[currentEpochId];
  return !epoch?.nextEpochId;
}

/**
 * Get available epochs for a new game
 */
export function getAvailableStartingEpochs(): EpochDefinition[] {
  return Object.values(EPOCH_DEFINITIONS)
    .filter(e => !e.previousEpochId) // Only starting epochs
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}
/**
 * Inject Soul Echo NPCs from bloodline history into current world
 * Called after world creation to manifest ancestor spirits
 */
export function injectSoulEchoesIntoWorld(
  state: WorldState,
  bloodlineData?: { canonicalName: string; inheritedPerks: string[]; epochsLived: number; deeds: string[] }
): WorldState {
  if (!bloodlineData?.canonicalName) {
    // No bloodline to manifest
    return state;
  }

  // Import here to avoid circular dependency
  const { createSoulEchoNpc } = require('./legacyEngine');

  // Create a LegacyImpact-compatible object from bloodline data
  const legacyImpact = {
    canonicalName: bloodlineData.canonicalName,
    mythStatus: 50, // Default moderate myth status
    inheritedPerks: bloodlineData.inheritedPerks || [],
    epochsLived: bloodlineData.epochsLived || 1,
    deeds: bloodlineData.deeds || [],
  };

  // Create the soul echo NPC
  const soulEchoNpc = createSoulEchoNpc(legacyImpact, state.epochMetadata?.sequenceNumber || 1);

  // Add to world NPCs if not already present
  const npcExists = state.npcs.some(npc => npc.id === soulEchoNpc.id);
  if (!npcExists) {
    return {
      ...state,
      npcs: [...state.npcs, soulEchoNpc as unknown as NPC],
    };
  }

  return state;
}

/**
 * Place heirloom items from previous generation into the new epoch
 * Heirlooms are hidden in the player's final location as "lost treasures"
 */
export function placeHeirloomsInNextEpoch(
  fromState: WorldState,
  toEpochDef: EpochDefinition,
  legacyImpact: LegacyImpact
): WorldState['heirloomCaches'] {
  // Import here to avoid circular dependency
  const { applyHeirloomTransformation } = require('./artifactEngine');

  // Collect all heirloom items from previous generation's player
  const baseHeirlooms = (fromState.player?.inventory || [])
    .filter((item): item is UniqueItem => item.kind === 'unique' && (item.isHeirloom ?? false));

  if (baseHeirlooms.length === 0) {
    return [];
  }

  // M29 Task 6: Apply heirloom transformation based on generation count
  const transformedHeirlooms = baseHeirlooms.map((item) => {
    const currentGenerationCount = item.generationCount || 1;
    const nextGenerationCount = currentGenerationCount + 1; // Increment for new owner
    
    // Apply heirloom transformation
    const { enhancedItem, prestige, statBonus, visualEffect } = applyHeirloomTransformation(item, nextGenerationCount);

    return {
      ...enhancedItem,
      ancestorName: legacyImpact.canonicalName,
      discoveryMessage: `[${prestige}] A relic from ${legacyImpact.canonicalName}. This legendary artifact has grown more powerful through ${nextGenerationCount} generations (+${statBonus}% stats). ${visualEffect}.`,
      _prestigeTier: prestige,
      _statBoostPercentage: statBonus
    };
  });

  // Create "hidden cache" location nodes for each transformed heirloom
  return transformedHeirlooms.map((heirloom) => ({
    id: `heirloom_cache_${heirloom.instanceId}`,
    name: `${heirloom._prestigeTier === 'God-Slayer' ? '⚡' : heirloom._prestigeTier === 'Legendary' ? '✦' : '◆'} ${heirloom.itemId}`,
    type: 'item_cache',
    locationId: fromState.player?.location || 'eldergrove-village',
    itemId: heirloom.itemId,
    instanceId: heirloom.instanceId,
    ancestorName: heirloom.ancestorName,
    discoveryMessage: heirloom.discoveryMessage,
    hidden: true,
    prestigeTier: heirloom._prestigeTier,
    generationCount: heirloom.generationCount
  }));
}

/**
 * Discover heirloom caches at player's current location
 * Called when player arrives at a location or searches the area
 */
export function discoverHeirloomsAtLocation(state: WorldState): WorldState {
  if (!state.player?.location || !state.heirloomCaches || state.heirloomCaches.length === 0) {
    return state;
  }

  // Find all hidden heirlooms at this location
  const heirloomsToDiscover = state.heirloomCaches.filter(
    cache => cache.locationId === state.player.location && cache.hidden && !cache.discoveredAt
  );

  if (heirloomsToDiscover.length === 0) {
    return state;
  }

  // Mark heirlooms as discovered and add to inventory
  const updatedCaches = state.heirloomCaches.map(cache => {
    const discovered = heirloomsToDiscover.find(h => h.id === cache.id);
    return discovered ? { ...cache, hidden: false, discoveredAt: state.tick || 0 } : cache;
  });

  // Add heirloom items to player inventory
  const newInventoryItems: InventoryItem[] = heirloomsToDiscover.map(cache => ({
    kind: 'unique',
    itemId: cache.itemId,
    instanceId: cache.instanceId,
    equipped: false,
    isHeirloom: true,
    ancestorName: cache.ancestorName
  }));

  return {
    ...state,
    heirloomCaches: updatedCaches,
    player: {
      ...state.player,
      inventory: [...(state.player.inventory || []), ...newInventoryItems]
    }
  };
}

/**
 * M30 Task 1: The Finality Engine
 * Called when player completes Epoch III (final epoch) to generate a Universal Historical Summary
 * This creates a capstone artifact and provides a new world seed for True New Game+
 */
export function concludeChronicle(
  finalState: WorldState,
  finalLegacy: LegacyImpact
): {
  summary: UniversalHistoricalSummary;
  chronicleArtifact: UniqueItem;
  trueNewGameSeed: number;
} {
  const { SeededRng } = require('./prng');
  const rng = new SeededRng(finalState.seed || 12345);

  // Reconstruct full bloodline from legacyImpacts
  const allAncestors = (finalState.player as any)?.legacyImpacts || [];
  const totalGenerations = allAncestors.length;
  const cumulativeMythStatus = allAncestors.reduce((sum: number, a: any) => sum + (a.mythStatus || 0), 0);

  // Find greatest ancestor
  const greatestAncestor = [...allAncestors].sort((a: any, b: any) => (b.mythStatus || 0) - (a.mythStatus || 0))[0] || {
    name: 'Unknown Hero',
    mythStatus: 0,
    deeds: [],
    epochsLived: 0
  };

  // Aggregate faction data
  const factionLegacies: Record<string, any> = {};
  allAncestors.forEach((ancestor: any) => {
    Object.entries(ancestor.factionInfluence || {}).forEach(([factionId, rep]) => {
      if (!factionLegacies[factionId]) {
        factionLegacies[factionId] = { reputation: 0, primaryInteraction: '' };
      }
      factionLegacies[factionId].reputation += (rep as number);
    });
  });

  // Count paradox accumulated
  const paradoxCost = (finalState.player?.temporalDebt || 0);

  // Collect blighted and restored biomes
  const blightedBiomes = (finalState.locations || [])
    .filter(loc => ((loc as any)._corruptionLevel || 0) > 50)
    .map(loc => loc.biome || 'unknown');

  const restoredLocations = (finalState.locations || [])
    .filter(loc => ((loc as any).discovered && (loc as any).harmony && (loc as any).harmony > 50))
    .map(loc => loc.id);

  // Generate new True New Game+ seed (based on chronicle's achievements)
  const trueNewGameSeed = rng.nextInt(1000000, 9999999);

  const summary: UniversalHistoricalSummary = {
    id: `chronicle_${finalState.chronicleId}_final`,
    name: `The Chronicle of ${finalLegacy.canonicalName} and Their Lineage`,
    totalEpochsSpanned: 3, // Epochs I, II, III
    totalGenerations,
    cumulativeMythStatus,
    greatestAncestor: {
      name: greatestAncestor.canonicalName,
      mythStatus: greatestAncestor.mythStatus,
      dominantDeeds: greatestAncestor.deeds.slice(0, 3),
      epochsLived: greatestAncestor.epochsLived
    },
    factionLegacies,
    paradoxCost,
    blightedBiomes,
    restoredLocations,
    finalEventLog: [
      `${finalLegacy.canonicalName} reached the twilight of ages`,
      `${totalGenerations} generations shaped the world's destiny`,
      `Myth Status of ${cumulativeMythStatus} achieved across all bloodlines`,
      `The chronicle concludes. A new world awaits.`
    ],
    timestamp: finalState.tick || 0,
    trueNewGameSeed
  };

  // Create "Chronicle of the Age" artifact
  const chronicleArtifact: UniqueItem = {
    kind: 'unique',
    itemId: 'chronicle_of_the_age',
    instanceId: `chronicle_artifact_${trueNewGameSeed}`,
    isHeirloom: true,
    ancestorName: finalLegacy.canonicalName,
    generationCount: totalGenerations,
    metadata: {
      experience: 999,
      sentience: 100,
      corruption: 0,
      infusions: []
    }
  };

  return {
    summary,
    chronicleArtifact,
    trueNewGameSeed
  };
}

/**
 * Check if chronicle is ready to conclude (final epoch complete)
 */
export function isChronicleReadyForConclusion(state: WorldState): boolean {
  const currentEpoch = EPOCH_DEFINITIONS[state.epochId || 'epoch_i_fracture'];
  return !currentEpoch?.nextEpochId; // No next epoch = final epoch
}

/**
 * M30 Task 2: Event Log Pruning (Chronos Compression)
 * Compresses MutationLog by folding old events into a historical baseline
 * Preserves deltas and key milestones while clearing transient events
 */
export function compressChronicleEvents(
  state: WorldState,
  maxEventsKept: number = 500
): WorldState {
  const mutationLog = (state as any)._mutationLog;
  if (!mutationLog || mutationLog.length <= maxEventsKept) {
    return state; // No compression needed
  }

  const oldEventCount = mutationLog.length;
  const eventsToArchive = mutationLog.slice(0, oldEventCount - maxEventsKept);
  const keptEvents = mutationLog.slice(oldEventCount - maxEventsKept);

  // Summarize archived events into baseline
  const historicalBaseline = {
    epochsProcessed: Math.floor(eventsToArchive.length / 100), // Rough epoch count
    eventsSummarized: eventsToArchive.length,
    archiveTimestamp: state.tick || 0,
    keyMilestones: eventsToArchive
      .filter((e: any) => e.type && e.type.includes('EPOCH'))
      .slice(-5) // Keep last 5 epoch markers
      .map((e: any) => ({ type: e.type, tick: e.tick }))
  };

  // Store archive metadata
  const updatedState = {
    ...state,
    _mutationLog: keptEvents,
    _historicalBaseline: {
      ...((state as any)._historicalBaseline || {}),
      ...historicalBaseline
    }
  } as unknown as WorldState;

  return updatedState;
}

/**
 * Get compressed event history for memory efficiency
 * Returns key events from both archive and current log
 */
export function getCompressedEventHistory(state: WorldState, limit: number = 100): any[] {
  const mutationLog = (state as any)._mutationLog || [];
  const currentEvents = mutationLog.slice(-limit);
  const historicalBaseline = (state as any)._historicalBaseline;

  if (!historicalBaseline) {
    return currentEvents;
  }

  return [
    {
      type: 'HISTORICAL_BASELINE',
      description: `${historicalBaseline.eventsSummarized} events archived across ${historicalBaseline.epochsProcessed} epoch(s)`,
      tick: historicalBaseline.archiveTimestamp,
      milestones: historicalBaseline.keyMilestones
    },
    ...currentEvents
  ];
}

/**
 * Generate the next world seed for True New Game+ (inherits legacy perks)
 */
export function generateTrueNewGamePlus(
  summary: UniversalHistoricalSummary,
  selectedTemplate: any
): {
  newWorldSeed: number;
  inheritedPerks: string[];
  startingModifiers: Record<string, number>;
} {
  const inheritedPerks: string[] = [];
  const startingModifiers: Record<string, number> = {};

  // Perks based on final myth status
  if (summary.cumulativeMythStatus >= 100) {
    inheritedPerks.push('Eternal Legacy', 'Bloodline Resonance');
    startingModifiers['experience_gain'] = 1.15; // +15% XP
  } else if (summary.cumulativeMythStatus >= 50) {
    inheritedPerks.push('Ancestral Wisdom');
    startingModifiers['experience_gain'] = 1.05; // +5% XP
  }

  // Perks based on generations
  if (summary.totalGenerations >= 3) {
    inheritedPerks.push('Reincarnate\'s Boon');
  }

  // Perks based on faction legacy
  const highestFactionRep = Math.max(...Object.values(summary.factionLegacies as any).map((f: any) => f.reputation || 0));
  if (highestFactionRep > 50) {
    inheritedPerks.push('Faction Favored');
  }

  return {
    newWorldSeed: summary.trueNewGameSeed,
    inheritedPerks,
    startingModifiers
  };
}

/**
 * M34: Omega Transition - The Grand Finale
 * Checks if conditions are met to trigger the ultimate ending
 */
export interface OmegaTransitionCondition {
  epochIII: boolean; // In Epoch III (Twilight)
  transcendentProphecy: boolean; // Prophecy marked as "Transcendent"
  minGenerations: boolean; // 5+ generations lived
  corruptionPurged: boolean; // Most corruption resolved
  allFactionsPeace: boolean; // No active faction conflicts
}

/**
 * M34: Check if Omega Loop conditions are met
 */
export function checkOmegaConditions(worldState: WorldState): OmegaTransitionCondition {
  const epochIII = worldState.epochId === 'epoch_iii_twilight';
  
  // Check for transcendent prophecy (assume true if epoch III reached with high myth)
  const transcendentProphecy = epochIII && (worldState.player.bloodlineData?.mythStatus || 0) > 80;

  // Get generation count from legacy
  const generations = worldState.player.bloodlineData?.epochsLived || 1;
  const minGenerations = generations >= 5;

  // Check corruption levels
  const totalCorruption = (worldState.player.soulStrain || 0) + 
                         (worldState.player.temporalDebt || 0);
  const corruptionPurged = totalCorruption < 30; // Below threshold

  // Check faction peace
  const allFactionsPeace = (worldState.factionConflicts || []).length === 0;

  return {
    epochIII,
    transcendentProphecy,
    minGenerations,
    corruptionPurged,
    allFactionsPeace
  };
}

/**
 * M34: Check if all Omega conditions are satisfied
 */
export function canTriggerOmegaLoop(worldState: WorldState): boolean {
  const conditions = checkOmegaConditions(worldState);
  return conditions.epochIII && 
         conditions.transcendentProphecy && 
         conditions.minGenerations &&
         conditions.corruptionPurged;
}

/**
 * M34: Create a Deity NPC from a previous ancestor
 */
function createDeityFromAncestor(ancestor: any, locationId: string): NPC {
  return {
    id: `deity-${ancestor.name}-${Date.now()}`,
    name: `Ascended ${ancestor.name}`,
    locationId,
    importance: 'critical',
    personality: {
      type: 'balanced',
      attackThreshold: 100,
      defendThreshold: 50,
      riskTolerance: 0
    },
    stats: {
      level: 99,
      str: 25,
      agi: 20,
      int: 28,
      cha: 30,
      end: 25,
      luk: 20
    },
    maxHp: 500,
    hp: 500,
    dialogue: [
      {
        id: `deity-greeting-${ancestor.name}`,
        text: `Greetings, descendant. I am ${ancestor.name}, now transformed into something greater. The world is restored, and I maintain its eternal peace.`,
        responses: []
      },
      {
        id: `deity-blessing-${ancestor.name}`,
        text: `Your bloodline's legacy is now woven into the fabric of reality itself. Go forth knowing your ancestors watch over these restored lands.`,
        responses: []
      }
    ]
  };
}

/**
 * M34: Generate the Restored world state (Omega Loop outcome)
 */
export function generateOmegaLoopWorld(worldState: WorldState, ancestors: any[]): WorldState {
  // Deep clone the current world
  const restoredWorld = JSON.parse(JSON.stringify(worldState)) as WorldState;

  // M34: Mark as restored
  restoredWorld.metadata = restoredWorld.metadata || {};
  restoredWorld.metadata.isRestored = true;
  restoredWorld.metadata.omegaLoopTriggeredAt = Date.now();

  // Purge corruption from all heirlooms
  if (restoredWorld.player.inventory) {
    for (const item of restoredWorld.player.inventory) {
      if (item.kind === 'unique' && item.metadata) {
        item.metadata.corruption = 0;
      }
    }
  }

  // Purge player corruption
  restoredWorld.player.soulStrain = 0;
  restoredWorld.player.temporalDebt = 0;

  // Resolve all faction conflicts
  restoredWorld.factionConflicts = [];

  // Transform all factions to peace state (reset power dynamics)
  if (restoredWorld.factions) {
    for (const faction of restoredWorld.factions) {
      // Normalize faction power scores
      faction.powerScore = 50; // Center faction influence
    }
  }

  // Create deity NPCs from ancestors
  const deityNpcs = ancestors.slice(0, 5).map((ancestor, idx) => {
    const locations = restoredWorld.locations || [];
    const locationId = locations[idx % locations.length]?.id || 'shrine';
    return createDeityFromAncestor(ancestor, locationId);
  });

  // Add deities to world
  if (!restoredWorld.npcs) {
    restoredWorld.npcs = [];
  }
  restoredWorld.npcs = [...restoredWorld.npcs, ...deityNpcs];

  // Create restoration monuments at key locations
  const monumentDescriptions = [
    'A grand monument honoring the bloodline that restored this world.',
    'An eternal shrine where ancestors are remembered and venerated.',
    'A sacred garden where time itself seems suspended in perfect peace.',
    'A tower of light reaching towards the heavens, built by legendary deeds.',
    'A sanctuary where the echoes of all past struggles have found resolution.'
  ];

  if (restoredWorld.locations) {
    for (let i = 0; i < Math.min(restoredWorld.locations.length, 5); i++) {
      if (restoredWorld.locations[i]) {
        restoredWorld.locations[i].description = 
          (restoredWorld.locations[i].description || '') + 
          '\n\n' + monumentDescriptions[i];
      }
    }
  }

  // Grant "The Restorer" title
  restoredWorld.player.bloodlineData = restoredWorld.player.bloodlineData || { mythStatus: 0, epochsLived: 0, inheritedPerks: [] };
  restoredWorld.player.bloodlineData.inheritedPerks?.push('The Restorer', 'World\'s Guardian', 'Eternal Peace Bringer');

  // Set absolute max myth status
  restoredWorld.player.bloodlineData.mythStatus = 100;

  return restoredWorld;
}

/**
 * M34: Create the victory narrative chronicle entry
 */
export function createOmegaLoopChronicleEntry(worldState: WorldState, ancestors: any[]): string {
  const playerName = worldState.player.name || 'Unknown Hero';
  const generations = worldState.player.bloodlineData?.epochsLived || 1;
  const mythStatus = worldState.player.bloodlineData?.mythStatus || 0;

  return `
═══════════════════════════════════════════════════════════════
           ✦ THE OMEGA LOOP HAS BEEN TRIGGERED ✦
═══════════════════════════════════════════════════════════════

The World Has Been Restored by the Bloodline of ${playerName}

Through ${generations} generations of struggle, sacrifice, and triumph,
your family has achieved the impossible. The corruption that once
threatened all existence has been purged from reality itself.

═══════════════════════════════════════════════════════════════

FINAL CHRONICLE STATISTICS:
  ⚔ Generations: ${generations}
  ⭐ Myth Status: ${mythStatus}%
  👻 Ancestors Immortalized: ${Math.min(ancestors.length, 5)}
  🗺 World Restoration: COMPLETE
  
═══════════════════════════════════════════════════════════════

The deities who once were your ancestors now walk these lands,
maintaining eternal peace and watching over all who dwell here.
Your bloodline has transcended mortality and become legend itself.

THE WORLD NEXUS NOW RECOGNIZES YOUR ACHIEVEMENT.
YOU ARE THE LEGEND THAT SHAPED ALL TIMELINES.

═══════════════════════════════════════════════════════════════
      Thank you for playing Project Isekai: The Long Game
═══════════════════════════════════════════════════════════════
  `;
}

/**
 * M34: Get the Omega Loop victory conditions summary
 */
export function getOmegaLoopSummary(worldState: WorldState): string {
  const conditions = checkOmegaConditions(worldState);

  let summary = '🔮 OMEGA LOOP STATUS:\n\n';
  summary += `[${conditions.epochIII ? '✓' : '✗'}] In Epoch III (Twilight)\n`;
  summary += `[${conditions.transcendentProphecy ? '✓' : '✗'}] Transcendent Prophecy Fulfilled\n`;
  summary += `[${conditions.minGenerations ? '✓' : '✗'}] Minimum 5 Generations (Current: ${worldState.player.bloodlineData?.epochsLived || 1})\n`;
  summary += `[${conditions.corruptionPurged ? '✓' : '✗'}] Corruption Purged\n`;
  summary += `[${conditions.allFactionsPeace ? '✓' : '✗'}] All Factions at Peace\n\n`;

  if (canTriggerOmegaLoop(worldState)) {
    summary += '⚡ OMEGA LOOP CONDITIONS MET - Victory is within reach! ⚡';
  } else {
    const remaining = [
      !conditions.epochIII && 'Reach Epoch III',
      !conditions.transcendentProphecy && 'Fulfill a Transcendent Prophecy',
      !conditions.minGenerations && 'Complete 5+ Generations',
      !conditions.corruptionPurged && 'Purge World Corruption',
      !conditions.allFactionsPeace && 'Achieve Faction Peace'
    ].filter(Boolean) as string[];

    summary += `Remaining requirements:\n  • ${remaining.join('\n  • ')}`;
  }

  return summary;
}

/**
 * M36 Task 3: The Blueprint Forge — Epoch Delta Export/Import
 * 
 * Enables community-driven world segment sharing by allowing players to
 * export and import "epoch deltas" (world state snapshots/patches).
 * 
 * Enables:
 * - Share custom world segments with friends
 * - Community mod packages for specific epochs
 * - Cross-world borrowing of locations, NPCs, quests
 * - Collaborative world-building across chronicles
 */

export interface EpochDelta {
  id: string;
  epochId: string;
  version: number;
  exportedAt: number;
  exportedBy: string;
  
  // Core world segments
  locations: WorldState['locations'];
  npcs: WorldState['npcs'];
  quests: WorldState['quests'];
  factions?: WorldState['factions'];
  
  // Metadata for reconstruction
  seed: number;
  description: string;
  tags: string[];  // 'scenery', 'quest-hub', 'boss-arena', 'safe-zone', etc.
  
  // Integration info
  requiresFactions: string[];  // Which factions are required for this delta
  modifiesLocations: string[]; // Location IDs that are modified
  addedQuestChains: number;
  
  // Validation hash
  integrity: string;  // SHA256-like checksum for validation
}

export interface EpochDeltaBatch {
  id: string;
  epochIds: string[];
  deltas: EpochDelta[];
  bundleSize: number;
  bundleDescription: string;
  createdAt: number;
}

/**
 * M36: Calculate integrity checksum for an epoch delta
 */
function calculateDeltaIntegrity(delta: Omit<EpochDelta, 'integrity'>): string {
  // Simplified checksum - in production use SHA256
  let hash = delta.epochId.length;
  hash += delta.locations.length * 17;
  hash += delta.npcs.length * 23;
  hash += delta.quests.length * 31;
  hash += delta.seed;
  
  const text = JSON.stringify({
    locations: delta.locations.map(l => l.id),
    npcs: delta.npcs.map(n => n.id),
    quests: delta.quests.map(q => q.id)
  });
  
  // Simple hash from text
  let hashVal = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hashVal = ((hashVal << 5) - hashVal) + char;
    hashVal = hashVal & hashVal;  // Convert to 32bit integer
  }
  
  return `${hashVal.toString(16)}-${hash.toString(16)}`;
}

/**
 * M36: Export a world segment as an epoch delta
 */
export function exportEpochDelta(
  worldState: WorldState,
  epochId: string,
  exporterName: string,
  description: string,
  tags: string[] = []
): EpochDelta {
  const deltaBase: Omit<EpochDelta, 'integrity'> = {
    id: `delta-${epochId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    epochId,
    version: 1,
    exportedAt: Date.now(),
    exportedBy: exporterName,
    locations: [...(worldState.locations || [])],
    npcs: [...(worldState.npcs || [])],
    quests: [...(worldState.quests || [])],
    factions: worldState.factions ? [...worldState.factions] : undefined,
    seed: worldState.seed,
    description,
    tags,
    requiresFactions: (worldState.factions || []).map(f => f.id),
    modifiesLocations: (worldState.locations || []).map(l => l.id),
    addedQuestChains: (worldState.quests || []).length
  };

  return {
    ...deltaBase,
    integrity: calculateDeltaIntegrity(deltaBase)
  };
}

/**
 * M36: Validate an epoch delta integrity
 */
export function validateEpochDelta(delta: EpochDelta): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check basic structure
  if (!delta.epochId) issues.push('Missing epochId');
  if (!delta.locations || delta.locations.length === 0) issues.push('No locations in delta');
  if (!delta.integrity) issues.push('Missing integrity checksum');

  // Verify integrity
  const deltaBase: Omit<EpochDelta, 'integrity'> = { ...delta } as any;
  const checksum = calculateDeltaIntegrity(deltaBase);

  if (checksum !== delta.integrity) {
    issues.push(`Integrity check failed: expected ${checksum}, got ${delta.integrity}`);
  }

  // Verify location/NPC consistency
  for (const npc of delta.npcs) {
    if (!delta.locations.some(l => l.id === npc.locationId)) {
      issues.push(`NPC ${npc.name} references non-existent location ${npc.locationId}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * M36: Import an epoch delta into a world state
 */
export function importEpochDelta(
  targetWorldState: WorldState,
  delta: EpochDelta,
  importMode: 'merge' | 'replace' | 'append' = 'merge'
): {
  success: boolean;
  appliedChanges: string[];
  errors: string[];
} {
  const appliedChanges: string[] = [];
  const errors: string[] = [];

  // Validate delta first
  const validation = validateEpochDelta(delta);
  if (!validation.isValid) {
    return {
      success: false,
      appliedChanges: [],
      errors: validation.issues
    };
  }

  try {
    // Handle locations
    if (importMode === 'replace') {
      targetWorldState.locations = [...delta.locations];
      appliedChanges.push(`Replaced ${delta.locations.length} locations`);
    } else if (importMode === 'append') {
      targetWorldState.locations = [
        ...targetWorldState.locations,
        ...delta.locations.filter(l => !targetWorldState.locations.some(tl => tl.id === l.id))
      ];
      appliedChanges.push(`Appended new locations (total: ${targetWorldState.locations.length})`);
    } else {
      // Merge mode: update existing, add new
      for (const deltaLoc of delta.locations) {
        const existingIdx = targetWorldState.locations.findIndex(l => l.id === deltaLoc.id);
        if (existingIdx >= 0) {
          targetWorldState.locations[existingIdx] = { ...targetWorldState.locations[existingIdx], ...deltaLoc };
        } else {
          targetWorldState.locations.push(deltaLoc);
        }
      }
      appliedChanges.push(`Merged ${delta.locations.length} locations`);
    }

    // Handle NPCs
    for (const deltaNpc of delta.npcs) {
      const existingIdx = targetWorldState.npcs.findIndex(n => n.id === deltaNpc.id);
      if (existingIdx >= 0 && importMode !== 'append') {
        targetWorldState.npcs[existingIdx] = { ...targetWorldState.npcs[existingIdx], ...deltaNpc };
      } else if (importMode !== 'replace') {
        targetWorldState.npcs.push(deltaNpc);
      }
    }
    appliedChanges.push(`Processed ${delta.npcs.length} NPCs`);

    // Handle quests
    if (importMode !== 'replace') {
      for (const deltaQuest of delta.quests) {
        if (!targetWorldState.quests.some(q => q.id === deltaQuest.id)) {
          targetWorldState.quests.push(deltaQuest);
        }
      }
    } else {
      targetWorldState.quests = [...delta.quests];
    }
    appliedChanges.push(`Added/updated ${delta.quests.length} quests`);

    // Handle factions if present
    if (delta.factions && importMode !== 'replace') {
      for (const deltaFaction of delta.factions) {
        const existingIdx = (targetWorldState.factions || []).findIndex(f => f.id === deltaFaction.id);
        if (existingIdx >= 0) {
          targetWorldState.factions![existingIdx] = {
            ...targetWorldState.factions![existingIdx],
            ...deltaFaction
          };
        } else {
          if (!targetWorldState.factions) targetWorldState.factions = [];
          targetWorldState.factions.push(deltaFaction);
        }
      }
      appliedChanges.push(`Merged faction states`);
    }

    appliedChanges.push(`Import complete from delta: ${delta.id}`);

    return {
      success: true,
      appliedChanges,
      errors: []
    };
  } catch (err) {
    return {
      success: false,
      appliedChanges,
      errors: [`Import failed: ${err instanceof Error ? err.message : String(err)}`]
    };
  }
}

/**
 * M36: Create a batch of epoch deltas for distribution
 */
export function createEpochDeltaBatch(
  deltas: EpochDelta[],
  bundleDescription: string,
  bundleAuthor: string
): EpochDeltaBatch {
  return {
    id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    epochIds: Array.from(new Set(deltas.map(d => d.epochId))),
    deltas,
    bundleSize: JSON.stringify(deltas).length,
    bundleDescription,
    createdAt: Date.now()
  };
}

/**
 * M36: Serialize epoch delta for export (JSON or compressed format)
 */
export function serializeEpochDelta(delta: EpochDelta): string {
  return JSON.stringify(delta, null, 2);
}

/**
 * M36: Deserialize epoch delta from JSON
 */
export function deserializeEpochDelta(json: string): EpochDelta {
  try {
    return JSON.parse(json) as EpochDelta;
  } catch (err) {
    throw new Error(`Failed to deserialize epoch delta: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * M36: Get delta statistics for auditing
 */
export function getEpochDeltaStats(delta: EpochDelta): {
  totalEntities: number;
  locationCount: number;
  npcCount: number;
  questCount: number;
  estimatedSize: number;
  complexity: 'simple' | 'moderate' | 'complex';
} {
  const totalEntities = delta.locations.length + delta.npcs.length + delta.quests.length;
  const size = serializeEpochDelta(delta).length;

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (totalEntities > 50) complexity = 'complex';
  else if (totalEntities > 20) complexity = 'moderate';

  return {
    totalEntities,
    locationCount: delta.locations.length,
    npcCount: delta.npcs.length,
    questCount: delta.quests.length,
    estimatedSize: size,
    complexity
  };
}
