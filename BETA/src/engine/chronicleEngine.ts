/**
 * chronicleEngine.ts - M44-E4: Historical Event Recording System
 * Handles epoch transitions and world state persistence through chronicle sequence.
 * 
 * M53-A1: Environmental Mutation - Transform WorldScars into permanent biome shifts
 * M53-B1: The Great Library - Archive Grand Deeds as Lore Tomes
 */

import type { WorldState, Quest, UniqueItem, InventoryItem, NPC } from './worldEngine';
import type { LegacyImpact } from './legacyEngine';
import type { WorldScar } from './worldScarsEngine';
import { SeededRng } from './prng';
// import { evolveFactionGeneology, redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
// import { redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
import type { SessionRegistry, EpochVoteState } from './multiplayerEngine';
import { createEpochVote, recordEpochVote, hasEpochVoteConsensus } from './multiplayerEngine';
import { extractGrandDeeds } from './eventCompactionEngine';
import { archiveLegacyAsLoreTomes } from './loreEngine';
import { getEventsForWorld } from '../events/mutationLog';

export interface EpochDefinition {
  id: string;
  sequenceNumber: number;
  name: string;
  theme: string;
  chronologyYear: number;
  description: string;
  previousEpochId?: string;
  nextEpochId?: string;
  factionStateOverride?: Record<string, any>;
}

export interface WorldDelta {
  factionPowerShifts: Record<string, number>;
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
  eventLog: string[];
}

export interface SoftCanon {
  playerLegacyInfluence: number;
  inheritedFactionReputation: Record<string, number>;
  discoveredLocationsCarryOver: string[];
  npcMemoriesOfPlayer: Record<string, string>;
  worldState: 'improved' | 'declined' | 'neutral';
}

export interface UniversalHistoricalSummary {
  id: string;
  name: string;
  totalEpochsSpanned: number;
  totalGenerations: number;
  cumulativeMythStatus: number;
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
  paradoxCost: number;
  blightedBiomes: string[];
  restoredLocations: string[];
  finalEventLog: string[];
  timestamp: number;
  trueNewGameSeed: number;
}

export const EPOCH_DEFINITIONS: Record<string, EpochDefinition> = {
  'epoch_i_fracture': {
    id: 'epoch_i_fracture',
    sequenceNumber: 1,
    name: 'Epoch I: Fracture',
    theme: 'Recovery from paradox.',
    chronologyYear: 1000,
    description: 'The initial playable era.',
    nextEpochId: 'epoch_ii_waning'
  },
  'epoch_ii_waning': {
    id: 'epoch_ii_waning',
    sequenceNumber: 2,
    name: 'Epoch II: Waning',
    theme: 'Waning magic and stabilization.',
    chronologyYear: 1200,
    description: 'The second era. Magic begins to fade.',
    previousEpochId: 'epoch_i_fracture',
    nextEpochId: 'epoch_iii_twilight'
  },
  'epoch_iii_twilight': {
    id: 'epoch_iii_twilight',
    sequenceNumber: 3,
    name: 'Epoch III: Twilight',
    theme: 'Twilight of the old world emerges.',
    chronologyYear: 1500,
    description: 'The era of transformation.',
    previousEpochId: 'epoch_ii_waning',
    nextEpochId: 'epoch_iv_renewal'
  },
  'epoch_iv_renewal': {
    id: 'epoch_iv_renewal',
    sequenceNumber: 4,
    name: 'Epoch IV: Renewal',
    theme: 'Rebirth and new beginnings.',
    chronologyYear: 1700,
    description: 'The world renews itself.',
    previousEpochId: 'epoch_iii_twilight',
    nextEpochId: 'epoch_v_ascension'
  },
  'epoch_v_ascension': {
    id: 'epoch_v_ascension',
    sequenceNumber: 5,
    name: 'Epoch V: Ascension',
    theme: 'Rise of new powers.',
    chronologyYear: 1900,
    description: 'Civilization reaches new heights.',
    previousEpochId: 'epoch_iv_renewal',
    nextEpochId: 'epoch_vi_zenith'
  },
  'epoch_vi_zenith': {
    id: 'epoch_vi_zenith',
    sequenceNumber: 6,
    name: 'Epoch VI: Zenith',
    theme: 'The peak of civilization.',
    chronologyYear: 2100,
    description: 'The golden age of the world.',
    previousEpochId: 'epoch_v_ascension',
    nextEpochId: 'epoch_vii_eclipse'
  },
  'epoch_vii_eclipse': {
    id: 'epoch_vii_eclipse',
    sequenceNumber: 7,
    name: 'Epoch VII: Eclipse',
    theme: 'Darkness falls upon the land.',
    chronologyYear: 2300,
    description: 'The sun grows dim.',
    previousEpochId: 'epoch_vi_zenith',
    nextEpochId: 'epoch_viii_void'
  },
  'epoch_viii_void': {
    id: 'epoch_viii_void',
    sequenceNumber: 8,
    name: 'Epoch VIII: Void',
    theme: 'The emptiness between worlds.',
    chronologyYear: 2500,
    description: 'Reality itself becomes uncertain.',
    previousEpochId: 'epoch_vii_eclipse',
    nextEpochId: 'epoch_ix_rebirth'
  },
  'epoch_ix_rebirth': {
    id: 'epoch_ix_rebirth',
    sequenceNumber: 9,
    name: 'Epoch IX: Rebirth',
    theme: 'Life emerges from the void.',
    chronologyYear: 2700,
    description: 'A new creation awakens.',
    previousEpochId: 'epoch_viii_void',
    nextEpochId: 'epoch_x_eternity'
  },
  'epoch_x_eternity': {
    id: 'epoch_x_eternity',
    sequenceNumber: 10,
    name: 'Epoch X: Eternity',
    theme: 'The end of time as we knew it.',
    chronologyYear: 2900,
    description: 'The final epoch, where all things converge.',
    previousEpochId: 'epoch_ix_rebirth'
  }
};

export interface HistoricalEvent {
  id: string;
  type: 'faction_siege' | 'capital_change' | 'catastrophe' | 'miracle' | 'apocalypse' | string;
  epochId: string;
  tick: number;
  locationId: string;
  description: string;
  factionIds: string[];
  severity: number;
  narrative: string;
  monumentName?: string;
  monumentType?: 'ruin' | 'monument' | 'shrine' | 'tomb';
}

export interface WorldFragment {
  id: string;
  name: string;
  type: 'ruin' | 'monument' | 'shrine' | 'tomb' | 'statue' | 'altar';
  locationId: string;
  description: string;
  historicalEvent: HistoricalEvent;
  discoveredAt?: number;
  npcGossip: string;
}

class HistoricalEventRecorder {
  private historicalEvents: Map<string, HistoricalEvent> = new Map();
  private worldFragments: Map<string, WorldFragment> = new Map();

  recordHistoricalEvent(event: HistoricalEvent): void {
    this.historicalEvents.set(event.id, event);
  }

  createWorldFragmentFromEvent(event: HistoricalEvent): WorldFragment | null {
    if (event.severity < 50) return null;

    const monumentMapping: Record<string, { type: WorldFragment['type']; name: string; }> = {
      'faction_siege': { type: 'ruin', name: `Ruins of ${event.description}` },
      'capital_change': { type: 'monument', name: `Monument to ${event.description}` },
      'catastrophe': { type: 'tomb', name: `Tomb of ${event.description}` },
      'miracle': { type: 'shrine', name: `Shrine of ${event.description}` },
      'apocalypse': { type: 'altar', name: `Altar of ${event.description}` }
    };

    const mapping = monumentMapping[event.type] || { type: 'monument' as const, name: event.monumentName || `Monument to History` };

    const fragment: WorldFragment = {
      id: `fragment_${event.id}`,
      name: mapping.name,
      type: mapping.type,
      locationId: event.locationId,
      description: event.narrative,
      historicalEvent: event,
      npcGossip: this.generateNpcGossip(event)
    };

    this.worldFragments.set(fragment.id, fragment);
    return fragment;
  }

  private generateNpcGossip(event: HistoricalEvent): string {
    const tags: Record<string, string[]> = {
      'faction_siege': [
        `They say the ${event.factionIds[0] || 'forces'} laid siege here.`,
        `I heard the walls fell to the invaders.`,
        `The siege left scars that never fully healed.`
      ],
      'capital_change': [
        `${event.description} was a turning point.`,
        `When power shifted, everything changed.`,
        `A new regime rules from the ashes.`
      ],
      'catastrophe': [
        `A catastrophe befell this place.`,
        `Disaster struck without warning.`,
        `The calamity was devastating.`
      ],
      'miracle': [
        `A blessed event occurred here.`,
        `Divine intervention saved us.`,
        `The miracle changed everything.`
      ]
    };

    const gossipLines = tags[event.type] || [`Something momentous happened here.`];
    return gossipLines[Math.floor(Math.random() * gossipLines.length)];
  }

  getFragmentsAtLocation(locationId: string): WorldFragment[] {
    return Array.from(this.worldFragments.values()).filter(f => f.locationId === locationId);
  }

  getAllHistoricalEvents(): HistoricalEvent[] {
    return Array.from(this.historicalEvents.values());
  }

  clearEvents(): void {
    this.historicalEvents.clear();
    this.worldFragments.clear();
  }
}

let eventRecorderInstance: HistoricalEventRecorder | null = null;

export function getHistoricalEventRecorder(): HistoricalEventRecorder {
  if (!eventRecorderInstance) {
    eventRecorderInstance = new HistoricalEventRecorder();
  }
  return eventRecorderInstance;
}

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

  // M53-A1: Apply faction power shifts based on epoch theme
  if (state.factions) {
    state.factions.forEach(faction => {
      // Base power loss from epoch theme
      let powerLoss = 0;
      if (toEpoch.theme.includes('Waning')) {
        powerLoss = -10; // Power fades
        delta.eventLog.push(`${faction.name} weakens as magic wanes`);
      } else if (toEpoch.theme.includes('Twilight')) {
        powerLoss = -20; // Power greatly diminished
        delta.eventLog.push(`${faction.name} struggles against the encroaching darkness`);
      }
      
      // Mitigate power loss if player had high reputation with faction
      if (state.player && (state.player as any).factionReputation) {
        const playerRep = (state.player as any).factionReputation[faction.id] || 0;
        if (playerRep > 50) {
          // High reputation mitigates some loss (up to 50% mitigation at 100 rep)
          const mitigation = Math.floor((playerRep - 50) * 0.5) / 10;
          powerLoss = Math.ceil(powerLoss * (1 - mitigation));
        }
      }
      
      delta.factionPowerShifts[faction.id] = powerLoss;
    });
  }

  // M53-A1: Apply environmental mutations from scars
  const environmentalShifts = calculateEnvironmentalShift(
    state.locations || [],
    fromEpoch,
    toEpoch,
    (state as any).worldScars || []
  );

  environmentalShifts.forEach((mutation, locationId) => {
    delta.locationChanges.push({
      locationId,
      changes: {
        description: mutation.description,
        biome: mutation.newBiome,
        environmentalEffects: [`scar_mutation_${mutation.newBiome}`]
      }
    });

    delta.eventLog.push(
      `📍 ${locationId}: Biome shifted to ${mutation.newBiome}. ${mutation.description}`
    );
  });

  return delta;
}

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

  return canon;
}

export function applySoftCanonToDelta(
  delta: WorldDelta,
  canon: SoftCanon
): WorldDelta {
  return delta;
}

/**
 * M53-A1: Map scar types to biome mutations with healing progression
 * Severe scars persist; healing scars revert partially
 */
function getScarBiomeMutation(
  scarType: string,
  originalBiome: string,
  healingProgress: number
): { newBiome: string; description: string } {
  // Map scar types to valid Location biome values and narrative descriptions
  const scarTypeMap: Record<string, { name: string; biome: string }> = {
    'battlefield': { name: 'Scarred Battlefield', biome: 'mountain' },
    'plague_site': { name: 'Plague Grave', biome: 'forest' },
    'invasion_damage': { name: 'Ruined Settlement', biome: 'corrupted' },
    'celestial_mark': { name: 'Celestial Anomaly', biome: 'mountain' },
    'cultural_scar': { name: 'Abandoned Settlement', biome: 'cave' },
    'natural_disaster': { name: 'Scarred Wasteland', biome: 'plains' },
    'temporal_rift': { name: 'Fractured Reality', biome: 'corrupted' }
  };

  const mutation = scarTypeMap[scarType] || { name: 'Cursed Land', biome: 'corrupted' };

  // If healing progress is high (70%+), restore original biome
  if (healingProgress >= 0.7) {
    return {
      newBiome: originalBiome,
      description: `The land slowly recovers from ${mutation.name.toLowerCase()}. Nature reclaims what was lost.`
    };
  }
  // If healing progress is moderate (40-70%), show transitional state
  if (healingProgress >= 0.4) {
    return {
      newBiome: originalBiome, // Use original biome but indicate recovery
      description: `${mutation.name} persists, though signs of recovery appear. The wound slowly closes.`
    };
  }
  // Fresh or festering scars: permanent mutation
  return {
    newBiome: mutation.biome,
    description: `${mutation.name} - a permanent wound on the world left by the previous epoch.`
  };
}

export function calculateEnvironmentalShift(
  locations: any[],
  fromEpoch: EpochDefinition,
  toEpoch: EpochDefinition,
  previousScars?: WorldScar[]
): Map<string, { newBiome: string; description: string }> {
  const shifts = new Map<string, { newBiome: string; description: string }>();

  if (!previousScars || previousScars.length === 0) {
    return shifts;
  }

  // Group scars by location
  const scarsByLocation = new Map<string, WorldScar[]>();
  previousScars.forEach((scar) => {
    if (!scarsByLocation.has(scar.locationId)) {
      scarsByLocation.set(scar.locationId, []);
    }
    scarsByLocation.get(scar.locationId)!.push(scar);
  });

  // For each scarred location, apply the most severe scar's mutation
  scarsByLocation.forEach((scars, locationId) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;

    // Get most severe scar at this location
    const mostSevereScar = scars.reduce((prev, current) =>
      (current.severity > prev.severity) ? current : prev
    );

    const mutation = getScarBiomeMutation(
      mostSevereScar.type,
      location.biome,
      mostSevereScar.healingProgress
    );

    shifts.set(locationId, mutation);
  });

  return shifts;
}

export function populateGreatLibrary(
  fromState: WorldState,
  toEpochDef: EpochDefinition
): any[] {
  // M59-B1: Convert previous epoch events into discoverable Lore Tomes
  const allEvents = getEventsForWorld(fromState.id) || [];
  const grandDeeds = extractGrandDeeds(allEvents);
  
  if (grandDeeds.length === 0) {
    return [];
  }
  
  // Get the legacy from the player's bloodline data
  const legacy = fromState.player?.bloodlineData as any;
  const loreTomes = archiveLegacyAsLoreTomes(legacy, fromState.epochId || 'epoch_i_fracture', grandDeeds);
  
  return loreTomes;
}

export function ensureGreatLibraryExists(locations: any[]): any[] {
  // M59-B1: Dynamically inject The Great Library if not already present
  const libraryExists = locations.some((loc: any) => loc.id === 'the_great_library');
  
  if (libraryExists) {
    return locations;
  }
  
  // Create The Great Library as a new location
  const greatLibrary = {
    id: 'the_great_library',
    name: 'The Great Library',
    description: 'An ancient repository of knowledge and deeds from ages past. Towering shelves hold Lore Tomes chronicling the legends of ancestors.',
    biome: 'shrine',
    discovered: true,
    spiritDensity: 0.8,
    x: 500,  // Center of map
    y: 500
  };
  
  return [...locations, greatLibrary];
}

export function satisfyLoreGatedQuest(
  playerState: any,
  tomeId: string,
  libraries: any[]
): any {
  return playerState;
}

export function applyTemporalGating(
  locations: any[],
  toEpochId: string
): any[] {
  return locations;
}

/**
 * Helper: Transform a single quest objective to reflect passage of time
 */
function transformQuestObjective(objective: any, epochProgressions: number, difficultyIncrease: number = 1.5): any {
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

  // Scale difficulty based on epochs passed
  const baseDifficulty = objective.difficulty || 1;
  const scaledDifficulty = baseDifficulty * Math.pow(difficultyIncrease, epochProgressions);

  return {
    ...objective,
    target: transforms[objective.type] ? `${transforms[objective.type]} ${objective.target}` : objective.target,
    description: `(Age-worn version) ${objective.description || ''}`,
    difficulty: scaledDifficulty
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
    .filter(quest => (quest as any).persist_across_epochs)
    .map((quest, index) => {
      const template = (quest as any).legacy_quest_template || {
        title_prefix: 'Ancient Rumor: ',
        difficulty_increase: 1.5
      };

      // Calculate epoch progression
      const currentSequence = fromState.epochMetadata?.sequenceNumber || 1;
      const epochProgressions = Math.max(0, currentSequence - 1);

      // Use seeded RNG for deterministic ID generation
      const pseudoTimestamp = rng.nextInt(1000000, 9999999);

      // Determine origin epoch: if we're in Epoch II+, origin is always one epoch back
      const getAllEpochs = () => Object.values(EPOCH_DEFINITIONS);
      const currentEpochDef = EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'];
      const allEpochs = getAllEpochs();
      const currentIndex = allEpochs.findIndex(e => e.id === currentEpochDef.id);
      const originEpoch = currentIndex > 0 ? allEpochs[currentIndex - 1] : currentEpochDef;

      // Transform objectives to reflect passage of time with difficulty scaling
      const transformedObjectives = (quest.objectives || []).map(obj =>
        transformQuestObjective(obj, epochProgressions, template.difficulty_increase)
      );

      return {
        ...quest,
        id: `${quest.id}_legacy_${pseudoTimestamp}`,
        title: `${template.title_prefix}${quest.title}`,
        description: template.description_override || `An echo from ages past: ${quest.description}`,
        objectives: transformedObjectives,
        _legacyQuestOrigin: {
          originalId: quest.id,
          originEpochId: originEpoch.id,
          originYear: originEpoch.chronologyYear,
          transformedAtEpoch: currentSequence
        }
      } as Quest;
    });
}

export function applyNpcEpochTransformations(
  npcs: NPC[],
  toEpochId: string,
  worldTemplate?: Record<string, any>
): NPC[] {
  return npcs;
}

export function getNextEpoch(currentEpochId: string): EpochDefinition | null {
  const current = EPOCH_DEFINITIONS[currentEpochId];
  if (!current?.nextEpochId) return null;
  return EPOCH_DEFINITIONS[current.nextEpochId] || null;
}

export function getTotalMetaSuspicion(state: WorldState): number {
  return 0;
}

export function createChaosGlitchedNpc(index: number, worldSeed: number): NPC {
  return {} as unknown as NPC;
}
/**
 * Helper: Place heirlooms from player inventory into cached locations for discovery in next epoch
 * (Exported version below - this comment marks where it was)
 */

export function generateEpochSeederState(
  fromState: WorldState,
  toEpochDef: EpochDefinition,
  legacy: LegacyImpact
): Partial<WorldState> {
  const rng = new SeededRng(fromState.seed);
  const pseudoTimestamp = rng.nextInt(1000000, 9999999);
  const fromEpochDef = EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'];
  
  const baselineDelta = calculateBaseWorldDelta(fromEpochDef, toEpochDef, fromState);

  // Build new world state with delta applied
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
    // M53-A1: Set epochMetadata for new era
    epochMetadata: {
      chronologyYear: toEpochDef.chronologyYear,
      theme: toEpochDef.theme,
      description: toEpochDef.description,
      sequenceNumber: toEpochDef.sequenceNumber
    },
    // Apply faction power shifts
    factions: (fromState.factions || []).map(faction => ({
      ...faction,
      powerScore: Math.max(0, (faction.powerScore || 50) + (baselineDelta.factionPowerShifts[faction.id] || 0))
    })),
    // Apply location changes from world delta
    locations: (fromState.locations || []).map((loc: any) => {
      const locDelta = baselineDelta.locationChanges.find(c => c.locationId === loc.id);
      if (locDelta?.changes) {
        const updated = { ...loc, ...locDelta.changes };
        // Ensure biome is valid type
        if (updated.biome && !['shrine', 'corrupted', 'forest', 'cave', 'village', 'maritime', 'mountain', 'plains'].includes(updated.biome)) {
          updated.biome = loc.biome; // Keep original if invalid
        }
        return updated;
      }
      return loc;
    }),
    // Inject soul echo memories into NPCs and transform state
    npcs: (fromState.npcs || []).map(npc => ({
      ...npc,
      // M53-A1: Store player legacy memory in NPC state
      _soulEchoMemory: `We remember the legendary deeds of ${legacy.canonicalName}`
    })),
    // Transform legacy quests into "Ancient Rumor" quests
    quests: transformLegacyQuests(fromState.quests || [], fromState),
    // Place heirloom items from previous generation
    heirloomCaches: placeHeirloomsInNextEpoch(fromState, legacy),
    player: fromState.player
  };

  return seederState;
}

export function initiateChronicleTransition(
  fromState: WorldState,
  legacy: LegacyImpact,
  sessionRegistry?: SessionRegistry
): WorldState {
  const nextEpoch = getNextEpoch(fromState.epochId || 'epoch_i_fracture');
  if (!nextEpoch) {
    throw new Error(`No next epoch defined after ${fromState.epochId}`);
  }
  
  // Generate new epoch state with all transformations applied (epochMetadata, faction power shifts, soul echoes, heirlooms)
  const seedState = generateEpochSeederState(fromState, nextEpoch, legacy);
  let nextState = seedState as WorldState;
  
  // M53-B1: Populate The Great Library with Lore Tomes from legacy deeds
  try {
    // Extract grand deeds from the event log
    const allEvents = getEventsForWorld(fromState.id) || [];
    const grandDeeds = extractGrandDeeds(allEvents);
    
    if (grandDeeds.length > 0) {
      // Convert deeds to lore tomes
      const loreTomes = archiveLegacyAsLoreTomes(legacy, fromState.epochId || 'epoch_i_fracture', grandDeeds);
      
      if (loreTomes.length > 0) {
        // Find or create The Great Library location
        let libraryLoc = nextState.locations?.find(loc => loc.id === 'the_great_library');
        
        if (!libraryLoc) {
          // Create The Great Library as a new location
          libraryLoc = {
            id: 'the_great_library',
            name: 'The Great Library',
            description: 'An ancient repository of knowledge and deeds from ages past. Towering shelves hold Lore Tomes chronicling the legends of ancestors.',
            biome: 'shrine' as const,
            discovered: true,
            spiritDensity: 0.8
          };
          nextState = {
            ...nextState,
            locations: [...(nextState.locations || []), libraryLoc]
          };
        }
        
        // Add tomes to player's heirloom caches (persisted items for next gen)
        nextState = {
          ...nextState,
          heirloomCaches: [
            ...(nextState.heirloomCaches || []),
            {
              id: `heirloom_library_${nextEpoch.id}`,
              locationId: 'the_great_library',
              items: loreTomes as any[],
              discoveredAt: nextState.tick || 0,
              description: `Lore Tomes from ${legacy.canonicalName}'s era`
            }
          ]
        };
        
        // Log library population to macro events
        if (nextState.macroEvents) {
          nextState = {
            ...nextState,
            macroEvents: [
              ...nextState.macroEvents,
              {
                id: `library_populated_${nextEpoch.id}`,
                locationId: 'the_great_library',
                message: `📚 The Great Library was populated with ${loreTomes.length} Lore Tomes from ${legacy.canonicalName}'s deeds`,
                tick: nextState.tick || 0,
                type: 'LIBRARY_POPULATED'
              }
            ]
          };
        }
      }
    }
  } catch (error) {
    console.warn('[M53-B1] Failed to populate Great Library:', error);
  }
  
  // M53-D1: Spawn Soul Echo NPC for ancestral reincarnation
  try {
    const soulEchoNpc = spawnSoulEchoNpcs(legacy, 'the_great_library');
    nextState = {
      ...nextState,
      npcs: [...(nextState.npcs || []), soulEchoNpc]
    };
    
    // Log soul echo manifestation to macro events
    if (nextState.macroEvents) {
      nextState = {
        ...nextState,
        macroEvents: [
          ...nextState.macroEvents,
          {
            id: `soul_echo_manifested_${nextEpoch.id}`,
            locationId: 'the_great_library',
            message: `👻 The spectral form of ${legacy.canonicalName} has manifested at The Great Library, ready to guide the next generation`,
            tick: nextState.tick || 0,
            type: 'SOUL_ECHO_MANIFESTED'
          }
        ]
      };
    }
  } catch (error) {
    console.warn('[M53-D1] Failed to spawn Soul Echo NPC:', error);
  }

  // Extract baseline delta for event logging
  const fromEpochDef = EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'];
  const worldDelta = calculateBaseWorldDelta(fromEpochDef, nextEpoch, fromState);
  
  if (worldDelta.eventLog.length > 0 && nextState.macroEvents) {
    const transitionLog = worldDelta.eventLog.map((e, idx) => ({
      id: `epoch_transition_${nextEpoch.id}_${idx}`,
      message: e,
      tick: nextState.tick || 0
    }));
    nextState = {
      ...nextState,
      macroEvents: [...(nextState.macroEvents || []), ...transitionLog]
    };
  }

  // M54-C1: Apply ancestral reputation carryover
  // Factions remember the player's previous incarnation
  try {
    const carryoverReputation: Record<string, number> = {};
    const ancestralFactionInfluence = legacy.factionInfluence || {};

    for (const [factionId, ancestralRep] of Object.entries(ancestralFactionInfluence)) {
      if (typeof ancestralRep === 'number') {
        // M54-C1: Apply carryover with diminishing effect
        // Hostile (-50 or less) becomes Unfriendly (-20)
        // Exalted (+90 or more) becomes Friendly (+15)
        // Others: ~20% of ancestral reputation carries over
        
        if (ancestralRep <= -50) {
          carryoverReputation[factionId] = -20; // Ancestral Grudges
        } else if (ancestralRep >= 90) {
          carryoverReputation[factionId] = 15; // Old Family Ties
        } else if (ancestralRep > 0) {
          carryoverReputation[factionId] = Math.floor(ancestralRep * 0.2); // Modest legacy favor
        } else if (ancestralRep < 0) {
          carryoverReputation[factionId] = Math.ceil(ancestralRep * 0.2); // Lingering resentment
        }
      }
    }

    // Apply carryover reputation to the new player state
    if (nextState.player && Object.keys(carryoverReputation).length > 0) {
      nextState = {
        ...nextState,
        player: {
          ...nextState.player,
          factionReputation: {
            ...(nextState.player.factionReputation || {}),
            ...carryoverReputation
          }
        }
      };

      // Log ancestral reputation application
      if (nextState.macroEvents) {
        const reputationSummary = Object.entries(carryoverReputation)
          .map(([factionId, rep]) => {
            const factionName = nextState.factions?.find(f => f.id === factionId)?.name || factionId;
            const direction = rep > 0 ? '📈' : rep < 0 ? '📉' : '➡️';
            return `${direction} ${factionName}: ${rep > 0 ? '+' : ''}${rep}`;
          })
          .join(', ');

        nextState = {
          ...nextState,
          macroEvents: [
            ...nextState.macroEvents,
            {
              id: `ancestral_reputation_${nextEpoch.id}`,
              locationId: nextState.player?.location,
              message: `🧬 Ancestral Legacy: Factions remember your previous incarnation. ${reputationSummary}`,
              tick: nextState.tick || 0,
              type: 'ANCESTRAL_REPUTATION_APPLIED'
            }
          ]
        };
      }
    }
  } catch (error) {
    console.warn('[M54-C1] Failed to apply ancestral reputation carryover:', error);
  }
  
  return nextState;
}

export function concludeChronicle(
  finalState: WorldState,
  finalLegacy: LegacyImpact
): {
  summary: UniversalHistoricalSummary;
  chronicleArtifact: UniqueItem;
  trueNewGameSeed: number;
} {
  const rng = new SeededRng((finalState.seed || 12345));
  const trueNewGameSeed = rng.nextInt(1000000, 9999999);

  const summary: UniversalHistoricalSummary = {
    id: `chronicle_${finalState.chronicleId}_final`,
    name: `The Chronicle of ${finalLegacy.canonicalName}`,
    totalEpochsSpanned: 3,
    totalGenerations: 1,
    cumulativeMythStatus: finalLegacy.mythStatus,
    greatestAncestor: {
      name: finalLegacy.canonicalName,
      mythStatus: finalLegacy.mythStatus,
      dominantDeeds: finalLegacy.deeds.slice(0, 3),
      epochsLived: finalLegacy.epochsLived
    },
    factionLegacies: finalLegacy.factionInfluence as any,
    paradoxCost: 0,
    blightedBiomes: [],
    restoredLocations: [],
    finalEventLog: [],
    timestamp: finalState.tick || 0,
    trueNewGameSeed
  };

  const chronicleArtifact: UniqueItem = {
    kind: 'unique',
    itemId: 'chronicle_of_the_age',
    instanceId: `chronicle_artifact_${trueNewGameSeed}`,
    isHeirloom: true,
    ancestorName: finalLegacy.canonicalName,
    generationCount: 1,
    metadata: { experience: 999, sentience: 100, corruption: 0, infusions: [] }
  } as any;

  return {
    summary,
    chronicleArtifact,
    trueNewGameSeed
  };
}

export function isChronicleReadyForConclusion(state: WorldState): boolean {
  const currentEpoch = EPOCH_DEFINITIONS[state.epochId || 'epoch_i_fracture'];
  return !currentEpoch?.nextEpochId;
}

export function compressChronicleEvents(
  state: WorldState,
  maxEventsKept: number = 500
): WorldState {
  return state;
}

export function getCompressedEventHistory(state: WorldState, limit: number = 100): any[] {
  return [];
}

export function generateTrueNewGamePlus(
  summary: UniversalHistoricalSummary,
  selectedTemplate: any
): {
  newWorldSeed: number;
  inheritedPerks: string[];
  startingModifiers: Record<string, number>;
} {
  return {
    newWorldSeed: summary.trueNewGameSeed,
    inheritedPerks: [],
    startingModifiers: {}
  };
}

export function placeHeirloomsInNextEpoch(
  fromState: WorldState,
  legacyImpact: LegacyImpact
): WorldState['heirloomCaches'] {
  if (!legacyImpact.inheritedItems || legacyImpact.inheritedItems.length === 0) {
    return [];
  }

  return legacyImpact.inheritedItems.map((item, idx) => ({
    id: `heirloom_cache_${item.itemId}_${idx}`,
    locationId: fromState.player?.location || 'town-square',
    itemId: item.itemId,
    instanceId: item.instanceId || `${item.itemId}_${idx}`,
    ancestorName: legacyImpact.canonicalName,
    discoveryMessage: `A relic from ${legacyImpact.canonicalName}, passed down through ages`,
    hidden: true,
    discoveredAt: undefined
  })) as any;
}

/**
 * Discover heirloom caches at the player's current location
 * Adds discovered items to player inventory and marks caches as discovered
 */
export function discoverHeirloomsAtLocation(state: WorldState): WorldState {
  if (!state.player?.location || !state.heirloomCaches || state.heirloomCaches.length === 0) {
    return state;
  }

  // Find all hidden heirlooms at this location
  const heirloomsToDiscover = state.heirloomCaches.filter(
    cache => cache.locationId === state.player.location && cache.hidden && !(cache as any).discoveredAt
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
  } as any));

  return {
    ...state,
    heirloomCaches: updatedCaches,
    player: {
      ...state.player,
      inventory: [...(state.player.inventory || []), ...newInventoryItems]
    }
  };
}

export function injectSoulEchoesIntoWorld(
  state: WorldState,
  bloodlineData?: { canonicalName: string; inheritedPerks: string[]; epochsLived: number; deeds: string[] }
): WorldState {
  // M59-B1: Create Soul Echo NPCs that manifest the player's ancestor
  if (!bloodlineData || !bloodlineData.deeds || bloodlineData.deeds.length === 0) {
    return state;  // No deeds = no echoes
  }
  
  // Create the main Soul Echo NPC at The Great Library
  const greatLibrary = state.locations?.find((loc: any) => loc.id === 'the_great_library');
  if (!greatLibrary) {
    return state;  // Cannot inject echo without library
  }
  
  // Create LegacyImpact proxy for spawnSoulEchoNpcs
  const legacyProxy: any = {
    id: `legacy_${state.id}`,
    canonicalName: bloodlineData.canonicalName,
    deeds: bloodlineData.deeds,
    mythStatus: Math.min(100, bloodlineData.deeds.length * 15),  // Scale by deed count
    bloodlineOrigin: state.id
  };
  
  const mainEcho = spawnSoulEchoNpcs(legacyProxy, 'the_great_library');
  
  // Add main echo to world
  let updatedState = {
    ...state,
    npcs: [...(state.npcs || []), mainEcho]
  };
  
  // Distribute memories to 5-10 random NPCs (M59-B1: NPC Memory Distribution)
  const echoCount = Math.min(10, Math.max(5, Math.floor(bloodlineData.deeds.length / 2)));
  const randomNpcs = (updatedState.npcs || [])
    .filter((npc: any) => npc.id !== mainEcho.id && !npc.soulEchoData)  // Exclude main echo and other echoes
    .sort(() => Math.random() - 0.5)  // Shuffle
    .slice(0, echoCount);
  
  // Update selected NPCs with inherited memories
  randomNpcs.forEach((npc: any) => {
    if (npc.soulEchoData) return;  // Skip if already an echo
    
    npc.rumors = npc.rumors || [];
    for (const deed of bloodlineData.deeds) {
      npc.rumors.push({
        id: `rumor_${mainEcho.id}_${npc.id}`,
        content: `I heard tales of ${bloodlineData.canonicalName}'s deeds... ${deed}`,
        sourceNpcId: mainEcho.id,
        acquiredTick: 0,
        reliability: 85,
        type: 'deed'
      });
    }
  });
  
  return updatedState;
}

/**
 * M53-D1: Spawn Soul Echo NPCs from legacy impact during epoch transition
 * Injects the player's previous character as a spectral guide at The Great Library
 * 
 * @param legacy The previous generation's LegacyImpact
 * @param greatLibraryLocationId The location where the Soul Echo appears
 * @returns A new Soul Echo NPC record
 */
export function spawnSoulEchoNpcs(
  legacy: LegacyImpact,
  greatLibraryLocationId: string = 'the_great_library'
): NPC {
  // Calculate inheritable merit from the legacy
  const inheritableMerit = Math.max(10, Math.floor(legacy.mythStatus * 0.5));
  
  // Determine echo type based on mythStatus
  let echoType: 'faint' | 'clear' | 'resonant' | 'overwhelming' = 'faint';
  if (legacy.mythStatus >= 75) echoType = 'overwhelming';
  else if (legacy.mythStatus >= 50) echoType = 'resonant';
  else if (legacy.mythStatus >= 30) echoType = 'clear';
  
  // Build ancestral advice from deeds
  const deedCount = legacy.deeds?.length || 0;
  let ancestralAdvice = 'The spirit of your ancestor whispers wisdom from the ages past.';
  if (deedCount > 5) {
    ancestralAdvice = `The spirit of ${legacy.canonicalName} speaks of ${deedCount} legendary deeds and shares their accumulated wisdom.`;
  } else if (deedCount > 0) {
    ancestralAdvice = `${legacy.canonicalName}'s spectral form reaches out, offering guidance from their ${deedCount} memorable ${deedCount === 1 ? 'deed' : 'deeds'}.`;
  }
  
  const soulEchoNpc: NPC = {
    id: `soul_echo_${legacy.id}_${Date.now()}`,
    name: `Spirit of ${legacy.canonicalName}`,
    type: 'SOUL_ECHO',
    locationId: greatLibraryLocationId,
    importance: 'critical',
    factionId: legacy.bloodlineOrigin ? `bloodline_${legacy.bloodlineOrigin}` : undefined,
    personality: {
      boldness: Math.min(100, legacy.mythStatus),
      caution: Math.max(0, 80 - legacy.mythStatus),
      sociability: 60,
      ambition: Math.min(100, legacy.mythStatus * 0.8),
      curiosity: 70,
      honesty: 90
    },
    emotionalState: {
      trust: 85,
      fear: 10,
      gratitude: 75,
      resentment: 0,
      lastEmotionalEventTick: 0,
      emotionalHistory: []
    },
    soulEchoData: {
      linkedLegacyId: legacy.id,
      inheritableMerit,
      ancestralAdvice,
      echoType
    },
    dialogue: [
      {
        text: ancestralAdvice,
        options: [
          {
            id: 'inherit_merit',
            text: `💫 Inherit Ancestral Merit (+${inheritableMerit})`,
            consequence: 'merit_transfer',
            isSecret: false
          },
          {
            id: 'hear_tale',
            text: `📖 Hear a tale of their deeds`,
            consequence: 'quest_start',
            isSecret: false
          },
          {
            id: 'dismiss',
            text: 'Bid them farewell',
            consequence: 'none',
            isSecret: false
          }
        ]
      }
    ]
  };
  
  return soulEchoNpc;
}

export function isChronicleComplete(currentEpochId: string): boolean {
  const epoch = EPOCH_DEFINITIONS[currentEpochId];
  return !epoch?.nextEpochId;
}

/**
 * Phase 12 Task 3: World Aging (Centuries Transition)
 * Simulates passage of ~2,000 years between playable epochs
 * Applies stochastic shifts to faction power and location health based on previous paradox level
 */
export function advanceToNextEpoch(state: WorldState, legacy: LegacyImpact | null): WorldState {
  const rng = new SeededRng(state.seed + (state.tick || 0));
  const currentEpoch = EPOCH_DEFINITIONS[state.epochId || 'epoch_i_fracture'];
  
  if (!currentEpoch) {
    console.warn('[chronicleEngine] Current epoch not found:', state.epochId);
    return state;
  }
  
  const nextEpochId = currentEpoch.nextEpochId;
  
  if (!nextEpochId) {
    console.warn('[chronicleEngine] No next epoch defined');
    return state;
  }
  
  const nextEpoch = EPOCH_DEFINITIONS[nextEpochId];
  
  // === PHASE 1: Faction Power Shifts ===
  // Factions gain/lose power stochastically based on paradoxDebt
  const paradoxLevel = (state as any).paradoxDebt || 0;
  
  if (state.factions) {
    for (const faction of state.factions) {
      const baseShift = rng.nextInt(-10, 10); // Random +/- 10
      
      // Paradox penalty: higher paradox erodes power more dramatically
      const paradoxPenalty = -Math.floor(paradoxLevel * 0.3);
      
      // Legacy bonus: if a player was allied with this faction
      let legacyBonus = 0;
      if (legacy && legacy.factionInfluence[faction.id]) {
        const rep = legacy.factionInfluence[faction.id];
        legacyBonus = rep > 50 ? 15 : rep > 0 ? 5 : 0; // Allied factions get bonus
      }
      
      const totalShift = baseShift + paradoxPenalty + legacyBonus;
      faction.powerScore = Math.max(5, Math.min(95, faction.powerScore + totalShift));
    }
  }
  
  // === PHASE 2: Location Health Erosion ===
  // Locations decay unless protected by faction control or sealing rituals
  if (state.locations) {
    for (const location of state.locations) {
      // Check if location is controlled by a faction
      const controllingFaction = state.factions?.find(f => 
        f.controlledLocationIds?.includes(location.id)
      );
      
      // Base erosion: 5-15 health per 2000 years
      const baseErosion = rng.nextInt(5, 15);
      
      let erosion = baseErosion;
      
      // Faction bonus: controlled locations take half damage
      if (controllingFaction) {
        erosion = Math.floor(erosion / 2);
      }
      
      // Paradox multiplier: high paradox increases erosion
      if (paradoxLevel > 50) {
        erosion = Math.floor(erosion * 1.5);
      }
      
      // Apply erosion (reduce health if it exists)
      if (location.spiritDensity !== undefined) {
        location.spiritDensity = Math.max(0, location.spiritDensity - erosion);
      }
      
      // Mutation: High erosion can change biome type
      if (location.spiritDensity === 0 && rng.nextDouble() < 0.3) {
        const biomeDecay: Record<string, string> = {
          'forest': 'corrupted',
          'mountain': 'corrupted',
          'coast': 'corrupted',
          'cave': 'void',
          'plains': 'barren'
        };
        location.biome = biomeDecay[location.biome || 'plains'] || 'corrupted';
      }
    }
  }
  
  // === PHASE 3: Update Chronicle Metadata ===
  // Phase 13: Preserve generationalParadox (cumulative across all epochs)
  const currentGenerationalParadox = (state as any).generationalParadox || 0;
  const newGenerationalParadox = currentGenerationalParadox + paradoxLevel;
  
  const updatedState = {
    ...state,
    epochId: nextEpochId,
    chronicleId: `chronicle_${state.id}_${nextEpochId}`,
    generationalParadox: newGenerationalParadox,  // Phase 13: Accumulate total paradox
    epochGenerationIndex: ((state as any).epochGenerationIndex || 0) + 1,  // Phase 13: Increment generation
    player: {
      ...state.player,
      knowledgeBase: state.player.knowledgeBase // Preserve knowledge across epochs
    }
  } as WorldState;
  
  // Increment chronology year (~2,000 years per epoch)
  const updatedEpochMetadata = {
    ...(state.metadata || {}),
    chronologyYear: ((state.metadata?.chronologyYear || 1000) + 2000),
    epochsSpanned: ((state.metadata?.epochsSpanned || 1) + 1)
  };
  (updatedState as any).metadata = updatedEpochMetadata;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[chronicleEngine] Transitioned to ${nextEpoch.name}`);
    console.log(`  New Chronology Year: ${updatedEpochMetadata.chronologyYear}`);
    console.log(`  Faction Power Shifts Applied`);
    console.log(`  Location Health Degraded (paradoxLevel: ${paradoxLevel})`);
    console.log(`  Phase 13: Generational Paradox: ${newGenerationalParadox} (prev: ${currentGenerationalParadox} + current: ${paradoxLevel})`);
    console.log(`  Phase 13: Epoch Generation Index: ${updatedState.epochGenerationIndex}`);
  }
  
  return updatedState;
}

export function getAvailableStartingEpochs(): EpochDefinition[] {
  return Object.values(EPOCH_DEFINITIONS)
    .filter(e => !e.previousEpochId)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}
/**
 * M56-D1: Export world chronicle as human-readable Markdown
 * 
 * Aggregates HistoricalEvent logs and UniversalHistoricalSummary into a formatted chronicle
 * suitable for consumption as a campaign summary or narrative document.
 */
export function exportWorldChronicle(state: WorldState, summary?: UniversalHistoricalSummary): string {
  const eventRecorder = getHistoricalEventRecorder();
  const historicalEvents = eventRecorder.getAllHistoricalEvents();
  
  const chronicleId = (state as any).chronicleId || 'Unknown Chronicle';
  const epochDef = EPOCH_DEFINITIONS[(state as any).epochId];
  const epoch = epochDef || { name: 'Unknown Epoch', description: 'Unknown', chronologyYear: 1000, theme: 'Unknown' };
  
  let markdown = `# World Chronicle: ${chronicleId}\n\n`;
  markdown += `**Last Updated**: Year ${epoch.chronologyYear || 'Unknown'}\n`;
  markdown += `**Current Era**: ${epoch.name || 'Unknown'}\n\n`;
  
  // Historical Summary Section
  if (summary) {
    markdown += `## 📜 Historical Summary\n\n`;
    markdown += `- **Epochs Spanned**: ${summary.totalEpochsSpanned}\n`;
    markdown += `- **Generations**: ${summary.totalGenerations}\n`;
    markdown += `- **Cumulative Myth Status**: ${summary.cumulativeMythStatus}\n`;
    markdown += `- **Paradox Cost**: ${summary.paradoxCost}\n\n`;
    
    if (summary.greatestAncestor) {
      markdown += `### Greatest Ancestor\n\n`;
      markdown += `**${summary.greatestAncestor.name}** (Myth Status: ${summary.greatestAncestor.mythStatus})\n`;
      markdown += `- Lived in ${summary.greatestAncestor.epochsLived} epoch(s)\n`;
      markdown += `- Great Deeds:\n`;
      summary.greatestAncestor.dominantDeeds.forEach(deed => {
        markdown += `  - ${deed}\n`;
      });
      markdown += `\n`;
    }
  }
  
  // Faction Legacies
  if (summary?.factionLegacies && Object.keys(summary.factionLegacies).length > 0) {
    markdown += `## ⚔️ Faction Legacies\n\n`;
    Object.entries(summary.factionLegacies).forEach(([factionId, legacy]) => {
      markdown += `### ${factionId}\n\n`;
      markdown += `- **Reputation**: ${(legacy as any).reputation}\n`;
      markdown += `- **Final Power**: ${(legacy as any).finalPower}\n`;
      markdown += `- **Primary Interaction**: ${(legacy as any).primaryInteraction}\n\n`;
    });
  }
  
  // Environmental Changes
  if (summary?.blightedBiomes && summary.blightedBiomes.length > 0) {
    markdown += `## 🌍 Environmental Impact\n\n`;
    markdown += `### Blighted Locations\n`;
    summary.blightedBiomes.forEach(biome => {
      markdown += `- ${biome}\n`;
    });
    markdown += `\n`;
  }
  
  if (summary?.restoredLocations && summary.restoredLocations.length > 0) {
    markdown += `### Restored Locations\n`;
    summary.restoredLocations.forEach(location => {
      markdown += `- ${location}\n`;
    });
    markdown += `\n`;
  }
  
  // Historical Events Timeline
  if (historicalEvents.length > 0) {
    markdown += `## 📅 Historical Timeline\n\n`;
    historicalEvents.sort((a, b) => (a.tick || 0) - (b.tick || 0));
    
    historicalEvents.forEach((event, idx) => {
      markdown += `### Event ${idx + 1}: ${event.description}\n\n`;
      markdown += `- **Type**: ${event.type}\n`;
      markdown += `- **Tick**: ${event.tick || 'Unknown'}\n`;
      if (event.factionIds && event.factionIds.length > 0) {
        markdown += `- **Factions Involved**: ${event.factionIds.join(', ')}\n`;
      }
      if ((event as any).locationId) {
        markdown += `- **Location**: ${(event as any).locationId}\n`;
      }
      markdown += `\n`;
    });
  }
  
  // Current World State Summary
  markdown += `## 🌐 Current World State\n\n`;
  markdown += `- **Player Name**: ${state.player.name}\n`;
  markdown += `- **Current Location**: ${state.player.location}\n`;
  markdown += `- **Player Level**: ${(state.player as any).level || 'Unknown'}\n`;
  markdown += `- **Active NPCs**: ${state.npcs.length}\n`;
  markdown += `- **Discovered Locations**: ${state.locations.filter(l => l.discovered).length} / ${state.locations.length}\n\n`;
  
  // Faction Status
  markdown += `### Faction Status\n\n`;
  if (state.factions && state.factions.length > 0) {
    state.factions.forEach(faction => {
      const powerBar = '█'.repeat(Math.floor(faction.powerScore / 5)) + '░'.repeat(20 - Math.floor(faction.powerScore / 5));
      markdown += `- **${faction.name}**: Power ${faction.powerScore}/100 [${powerBar}]\n`;
    });
  }
  markdown += `\n`;
  
  // Heirloom Status
  if ((state as any).heirloomCaches && (state as any).heirloomCaches.length > 0) {
    markdown += `## 🗡️ Heirloom Archive\n\n`;
    (state as any).heirloomCaches.forEach((heirloom: any) => {
      markdown += `- **${heirloom.itemId}**\n`;
      markdown += `  - Location: ${heirloom.discoveredAt?.locationId || 'Unknown'}\n`;
      if (heirloom.metadata?.legendaryDeeds) {
        markdown += `  - Legendary Deeds: ${heirloom.metadata.legendaryDeeds.join(', ')}\n`;
      }
      markdown += `\n`;
    });
  }
  
  // Footer
  markdown += `---\n\n`;
  markdown += `*Chronicle Generated from Project Isekai Engine*\n`;
  markdown += `*Timestamp: ${new Date().toISOString()}*\n`;
  
  return markdown;
}