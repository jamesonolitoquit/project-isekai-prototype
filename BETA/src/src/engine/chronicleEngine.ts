/**
 * chronicleEngine.ts - M44-E4: Historical Event Recording System
 * Handles epoch transitions and world state persistence through chronicle sequence.
 * 
 * M53-A1: Environmental Mutation - Transform WorldScars into permanent biome shifts
 * M53-B1: The Great Library - Archive Grand Deeds as Lore Tomes
 */

import type { WorldState, Quest, UniqueItem, InventoryItem, NPC, WorldScar, ScarType } from './worldEngine';
import type { LegacyImpact } from './legacyEngine';
import type { Event } from '../events/mutationLog';
import { SeededRng } from './prng';
// import { evolveFactionGeneology, redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
// import { redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
import type { SessionRegistry, EpochVoteState } from './multiplayerEngine';
import { createEpochVote, recordEpochVote, hasEpochVoteConsensus } from './multiplayerEngine';
// import { extractGrandDeeds } from './eventCompactionEngine'; // PROTOTYPE: Implement inline
// import { archiveLegacyAsLoreTomes } from './loreEngine'; // PROTOTYPE: Function doesn't exist, commenting out lore tomes feature
import { getEventsForWorld } from '../events/mutationLog';

/**
 * Identify "Grand Deeds" from event log that should generate soul echoes
 * M50-A3 integration point - implemented inline for PROTOTYPE
 */
function extractGrandDeeds(events: Event[]): Event[] {
  return events.filter(event => {
    // Grand deeds are significant events with important consequences
    const isSignificant = [
      'PLAYER_ACTION',
      'FACTION_SKIRMISH',
      'NPC_DEATH',
      'PLAYER_DEATH',
      'LEGENDARY_DEED',
      'WORLD_EVENT',
      'QUEST_COMPLETED'
    ].includes(event.type);

    if (!isSignificant) return false;

    // Additional constraints: player actions with major consequences
    if (event.type === 'PLAYER_ACTION') {
      return event.payload?.consequenceLevel === 'LEGENDARY' || 
             event.payload?.divergenceRating > 75;
    }

    if (event.type === 'FACTION_SKIRMISH') {
      return event.payload?.powerShift > 10;  // Significant territorial shift
    }

    return true;
  });
}

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

/**
 * Phase 28 Genesis: Epoch Transition Result
 * Encapsulates all state changes from one epoch to the next
 * Includes world delta, legacy impact, and myth status calculation
 */
export interface EpochTransitionResult {
  success: boolean;
  fromEpochId: string;
  toEpochId: string;
  worldDelta: WorldDelta;
  legacyImpact: LegacyImpact;
  softCanon: SoftCanon;
  mythStatus: number;
  totalDeathCount: number;
  totalTradeVolume: number;
  totalParadoxManifestations: number;
  sessionDurationTicks: number;
  npcLineageSurvival: { survived: number; deceased: number };
  narrativeSummary: string;
  timestamp: number;
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
    theme: 'Stabilization and mystery.',
    chronologyYear: 1200,
    description: 'The second era.',
    previousEpochId: 'epoch_i_fracture',
    nextEpochId: 'epoch_iii_twilight'
  },
  'epoch_iii_twilight': {
    id: 'epoch_iii_twilight',
    sequenceNumber: 3,
    name: 'Epoch III: Twilight',
    theme: 'New era emerges.',
    chronologyYear: 1500,
    description: 'The final epoch.',
    previousEpochId: 'epoch_ii_waning'
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
      if (toEpoch.theme.includes('Waning')) {
        delta.factionPowerShifts[faction.id] = -10; // Power fades
        delta.eventLog.push(`${faction.name} weakens as magic wanes`);
      } else if (toEpoch.theme.includes('Twilight')) {
        delta.factionPowerShifts[faction.id] = -20; // Power greatly diminished
        delta.eventLog.push(`${faction.name} struggles against the encroaching darkness`);
      }
    });
  }

  // M53-A1: Apply environmental mutations from scars
  const environmentalShifts = calculateEnvironmentalShift(
    state.locations || [],
    fromEpoch,
    toEpoch,
    state.worldScars || []
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

/**
 * Phase 15: Export world state as a deterministic WorldDelta package
 * This distills the current 2,000-year epoch into compressible difference data
 * that the WorldTemplate can use to seed the next generation's starting state.
 * 
 * @param state The current world state to export
 * @param legacy Optional legacy impact to incorporate into delta
 * @returns A WorldDelta containing all faction, location, and NPC transformations
 */
export function exportWorldChronicle(
  state: WorldState,
  legacy?: LegacyImpact
): WorldDelta {
  const delta: WorldDelta = {
    factionPowerShifts: {},
    locationChanges: [],
    npcStateShifts: [],
    eventLog: []
  };

  // Extract all factions and calculate their final power shifts
  if (state.factions && state.factions.length > 0) {
    state.factions.forEach(faction => {
      const baselinePower = 50; // Default faction starting power
      const currentPower = faction.powerScore || 50;
      const shift = currentPower - baselinePower;
      
      // Only record significant shifts (>5 power)
      if (Math.abs(shift) > 5) {
        delta.factionPowerShifts[faction.id] = shift;
        delta.eventLog.push(`Faction [${faction.name}]: Power ${shift > 0 ? '+' : ''}${shift}`);
      }
    });
  }

  // Extract location biome changes and environmental mutations
  if (state.locations && state.locations.length > 0) {
    state.locations.forEach(location => {
      const changes: {
        description?: string;
        biome?: string;
        discovered?: boolean;
        environmentalEffects?: string[];
      } = {};

      // Record biome if changed from original
      if (location.biome && location.biome !== 'unknown') {
        changes.biome = location.biome;
      }

      // Record discovered status if newly found
      if (location.discovered === true) {
        changes.discovered = true;
      }

      // Record environmental effects (world scars, blessings, curses)
      if (location.environmentalEffects && location.environmentalEffects.length > 0) {
        changes.environmentalEffects = location.environmentalEffects;
        delta.eventLog.push(`Location [${location.name}]: Effects ${location.environmentalEffects.join(', ')}`);
      }

      // Only record changes if something actually changed
      if (Object.keys(changes).length > 0) {
        delta.locationChanges.push({
          locationId: location.id,
          changes
        });
      }
    });
  }

  // Extract NPC state changes (deaths, relocations, title changes)
  if (state.npcs && state.npcs.length > 0) {
    state.npcs.forEach(npc => {
      const changes: {
        locationId?: string;
        reputation?: number;
        alive?: boolean;
        title?: string;
      } = {};

      // Track if NPC is alive (important for next generation)
      if (npc.hp !== undefined && npc.hp <= 0) {
        changes.alive = false;
        delta.eventLog.push(`NPC [${npc.name}]: Died`);
      } else {
        changes.alive = true;
      }

      // Record if NPC relocated/moved from default location
      if (npc.locationId) {
        changes.locationId = npc.locationId;
      }

      // Record title changes (promotions, demotions)
      if (npc.title && npc.title.length > 0) {
        changes.title = npc.title;
      }

      // Track reputation shifts for important NPCs
      if (npc.importance === 'critical' || npc.importance === 'major') {
        const playerRep = state.player?.reputation?.[npc.id] || 0;
        if (playerRep !== 0) {
          changes.reputation = playerRep;
        }
      }

      // Only record changes if something significant changed
      if (Object.keys(changes).length > 1 || (Object.keys(changes).length === 1 && !changes.alive)) {
        delta.npcStateShifts.push({
          npcId: npc.id,
          changes
        });
      }
    });
  }

  // Add legacy deeds to event log for historical record
  if (legacy?.deeds && legacy.deeds.length > 0) {
    delta.eventLog.push(`Player Legacy: ${legacy.deeds.join(', ')}`);
  }

  // Add world scars as persistent environmental evidence
  if (state.worldScars && state.worldScars.length > 0) {
    const scarSummary = state.worldScars
      .map(scar => `${scar.type} at ${scar.locationId}`)
      .join('; ');
    delta.eventLog.push(`World Scars: ${scarSummary}`);
  }

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
 * Phase 16: Temporal State Reconstructor (Task 3)
 * Reconstruct world state at any precise historical point by applying delta mutations.
 * 
 * Used by Soul Mirror Séance to pull data from any point in the world's past.
 * - Fetches base WorldTemplate for the epoch
 * - Applies relevant WorldDelta mutations
 * - Plays back environmental effects and NPC changes
 * - Returns synthesized historical world state
 */
export function reconstructHistoricalState(
  baseWorldState: WorldState,
  chronicalDelta: WorldDelta,
  tick: number = 0
): WorldState {
  // Start with a copy of the base world state
  const reconstructed = JSON.parse(JSON.stringify(baseWorldState)) as WorldState;

  // Apply faction power shifts from the delta
  if (chronicalDelta.factionPowerShifts && reconstructed.factions) {
    reconstructed.factions.forEach(faction => {
      const shift = chronicalDelta.factionPowerShifts[faction.id];
      if (shift !== undefined) {
        faction.powerScore = (faction.powerScore || 50) + shift;
      }
    });
  }

  // Apply location biome changes and environmental effects
  if (chronicalDelta.locationChanges && reconstructed.locations) {
    chronicalDelta.locationChanges.forEach(change => {
      const location = reconstructed.locations?.find(l => l.id === change.locationId);
      if (location) {
        if (change.changes.biome) {
          location.biome = change.changes.biome;
        }
        if (change.changes.discovered !== undefined) {
          location.discovered = change.changes.discovered;
        }
        if (change.changes.environmentalEffects) {
          location.environmentalEffects = change.changes.environmentalEffects;
        }
      }
    });
  }

  // Apply NPC state shifts (deaths, relocations, title changes)
  if (chronicalDelta.npcStateShifts && reconstructed.npcs) {
    chronicalDelta.npcStateShifts.forEach(shift => {
      const npc = reconstructed.npcs?.find(n => n.id === shift.npcId);
      if (npc) {
        if (shift.changes.alive === false) {
          npc.hp = 0; // Mark as dead
        }
        if (shift.changes.locationId) {
          npc.locationId = shift.changes.locationId;
        }
        if (shift.changes.title) {
          npc.title = shift.changes.title;
        }
        if (shift.changes.reputation !== undefined) {
          // Apply reputation shift to player relationship
          if (!reconstructed.player) {
            reconstructed.player = { reputation: {} } as any;
          }
          if (!reconstructed.player.reputation) {
            reconstructed.player.reputation = {};
          }
          reconstructed.player.reputation[npc.id] = shift.changes.reputation;
        }
      }
    });
  }

  // Adjust tick-based state (simulate partial epoch progression if specified)
  if (tick > 0 && tick < 2000) {
    // Scale environmental effects by progression through epoch
    const progressRatio = Math.min(tick / 2000, 1);
    reconstructed.time = {
      ...reconstructed.time,
      tick,
      progressionRatio: progressRatio,
      reconstructedFromTick: true
    } as any;
  }

  return reconstructed;
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
  return [];
}

export function ensureGreatLibraryExists(locations: any[]): any[] {
  return locations;
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
          originEpochId: fromState.epochId,
          originYear: fromState.epochMetadata?.chronologyYear,
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
 */
function createHeirloomCaches(
  fromState: WorldState,
  legacy: LegacyImpact
): any[] {
  if (!legacy.inheritedItems || legacy.inheritedItems.length === 0) {
    return [];
  }

  return legacy.inheritedItems.map((item, idx) => ({
    id: `heirloom_cache_${item.itemId}_${idx}`,
    locationId: fromState.player?.location || 'town-square',
    itemId: item.itemId,
    instanceId: item.instanceId || `${item.itemId}_${idx}`,
    ancestorName: legacy.canonicalName,
    discoveryMessage: `A relic from ${legacy.canonicalName}, passed down through ages`,
    hidden: true,
    discoveredAt: undefined
  }));
}

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
    locations: (fromState.locations || []).map(loc => {
      const locDelta = baselineDelta.locationChanges.find(c => c.locationId === loc.id);
      return {
        ...loc,
        ...locDelta?.changes
      };
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
    heirloomCaches: createHeirloomCaches(fromState, legacy),
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
  let nextState = {
    ...seedState,
    lastEpochTransitionTick: fromState.tick || 0
  } as WorldState;
  
  const worldDelta = calculateBaseWorldDelta(EPOCH_DEFINITIONS[fromState.epochId || 'epoch_i_fracture'], nextEpoch, fromState);
  
  // M53-B1: Populate The Great Library with Lore Tomes from legacy deeds
  // COMMENTED OUT: archiveLegacyAsLoreTomes function doesn't exist in PROTOTYPE
  /*
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
              items: loreTomes as UniqueItem[],
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
  */
  
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
    factionLegacies: (() => {
      const result: Record<string, { reputation: number; finalPower: number; primaryInteraction: string }> = {};
      Object.entries(finalLegacy.factionInfluence || {}).forEach(([factionId, reputationValue]) => {
        result[factionId] = {
          reputation: typeof reputationValue === 'number' ? reputationValue : 0,
          finalPower: typeof reputationValue === 'number' ? reputationValue * 0.5 : 0,
          primaryInteraction: 'neutral'
        };
      });
      return result;
    })(),
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
  };

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
  toEpochDef: EpochDefinition,
  legacyImpact: LegacyImpact
): WorldState['heirloomCaches'] {
  return [];
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
    kind: 'unique' as const,
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

export function injectSoulEchoesIntoWorld(
  state: WorldState,
  bloodlineData?: { canonicalName: string; inheritedPerks: string[]; epochsLived: number; deeds: string[] }
): WorldState {
  return state;
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
  
  const soulEchoNpc = {
    id: `soul_echo_${legacy.id}_${Date.now()}`,
    name: `Spirit of ${legacy.canonicalName}`,
    locationId: greatLibraryLocationId,
    importance: 'critical',
    factionId: legacy.bloodlineOrigin ? `bloodline_${legacy.bloodlineOrigin}` : undefined,
    personality: {
      type: 'balanced',
      attackThreshold: 0.5,
      defendThreshold: 0.3,
      riskTolerance: 0.5
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
  } as NPC;
  
  return soulEchoNpc;
}

export function isChronicleComplete(currentEpochId: string): boolean {
  const epoch = EPOCH_DEFINITIONS[currentEpochId];
  return !epoch?.nextEpochId;
}

export function getAvailableStartingEpochs(): EpochDefinition[] {
  return Object.values(EPOCH_DEFINITIONS)
    .filter(e => !e.previousEpochId)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

/**
 * Phase 28 Genesis: Calculate epoch transition result
 * Summarizes all world changes from current epoch for next generation
 * 
 * @param state Current world state at end of epoch
 * @param fromEpochId Previous epoch ID
 * @param toEpochId Next epoch ID
 * @param legacyImpact Player legacy for inheritance
 * @returns EpochTransitionResult containing world delta and myth status
 */
export function calculateEpochTransitionResult(
  state: WorldState,
  fromEpochId: string,
  toEpochId: string,
  legacyImpact: LegacyImpact
): EpochTransitionResult {
  const events = getEventsForWorld(state.id);
  const grandDeeds = extractGrandDeeds(events);

  // Count specific event types
  let deathCount = 0;
  let tradeVolume = 0;
  let paradoxManifestations = 0;

  for (const event of events) {
    if (event.type === 'NPC_DEATH' || event.type === 'PLAYER_DEATH') {
      deathCount++;
    }
    if (event.type === 'ECONOMY_CARAVAN_SPAWNED') {
      tradeVolume += (event.payload?.itemCount ?? 0);
    }
    if (event.type === 'PARADOX_ANOMALY_CREATED') {
      paradoxManifestations++;
    }
  }

  // Calculate myth status (0-100)
  const deedCount = grandDeeds.length;
  const factionSuccess = legacyImpact?.inheritedFactionReputation
    ? Object.values(legacyImpact.inheritedFactionReputation).reduce((a, b) => (a as number) + (b as number), 0) / 
      Object.keys(legacyImpact.inheritedFactionReputation).length
    : 0;
  
  const mythStatus = Math.min(100, Math.floor(
    (deedCount * 5) + // 5 points per grand deed (max 50)
    (Math.min(factionSuccess as number, 100) * 0.3) + // 30% of faction reputation
    (Math.min(state.paradoxState?.totalParadoxPoints ?? 0, 100) * 0.2) // 20% of paradox (inverted difficulty)
  ));

  // Build world delta
  const worldDelta: WorldDelta = {
    factionPowerShifts: {},
    locationChanges: [],
    npcStateShifts: [],
    eventLog: grandDeeds.map(e => `${e.type}: ${e.payload?.description ?? 'Unknown'}`)
  };

  // Track NPC lineage survival
  const npcLineageSurvival = {
    survived: state.npcs?.filter(n => n.hp && n.hp > 0).length ?? 0,
    deceased: deathCount
  };

  // Generate narrative summary
  const narrativeSummary = `
In ${EPOCH_DEFINITIONS[fromEpochId]?.name || fromEpochId}, the player shaped the world through ${deedCount} grand deeds.
${deathCount > 0 ? `${deathCount} lives were lost in the struggle.` : 'The epoch passed without major casualties.'}
Myth Status: ${mythStatus} — ${getMythStatusNarrative(mythStatus)}
The world evolved, and new generations await.
  `.trim();

  return {
    success: true,
    fromEpochId,
    toEpochId,
    worldDelta,
    legacyImpact,
    softCanon: {
      playerLegacyInfluence: mythStatus,
      inheritedFactionReputation: legacyImpact?.inheritedFactionReputation ?? {},
      discoveredLocationsCarryOver: state.locations?.map(l => l.id).slice(0, 5) ?? [],
      npcMemoriesOfPlayer: {}, // Would be populated from npcMemoryEngine
      worldState: factionSuccess > 60 ? 'improved' : factionSuccess < 40 ? 'declined' : 'neutral'
    },
    mythStatus,
    totalDeathCount: deathCount,
    totalTradeVolume: tradeVolume,
    totalParadoxManifestations: paradoxManifestations,
    sessionDurationTicks: state.tick ?? 0,
    npcLineageSurvival,
    narrativeSummary,
    timestamp: Date.now()
  };
}

/**
 * Get narrative description for myth status achievement
 */
function getMythStatusNarrative(mythStatus: number): string {
  if (mythStatus >= 90) return 'A living legend whose deeds echo through eternity.';
  if (mythStatus >= 75) return 'A hero of great renown, remembered for generations.';
  if (mythStatus >= 50) return 'A notable figure whose legacy persists.';
  if (mythStatus >= 25) return 'A figure of some significance in the world\'s history.';
  return 'Their deeds faded into the mists of time.';
}

/**
 * Phase 31 M62 Task 3: Chronicle Sequence Processor
 * Converts EpochTransitionResult into InheritancePayload for infinite replayability
 * 
 * Hero's Journey Formula:
 * - LegacyBudget = (mythStatus / 20 × 1.5) + (worldDeltaMagnitude / 10)
 * - Used to grant inheritance artifacts, stat bonuses, unlocked NPCs
 * 
 * @param result Previous epoch's transition result
 * @returns InheritancePayload for next epoch player
 */
export interface InheritancePayload {
  sequenceNumber: number;
  ancestorMythRank: number;        // 0-5 (Forgotten, Notable, Legendary, Mythic, etc)
  legacyBudget: number;            // Currency for inheritance rewards
  inheritedArtifacts: Array<{     // Items passed down through bloodline
    itemId: string;
    name: string;
    rarity: 'common' | 'rare' | 'legendary' | 'cursed';
    enchantments: string[];
  }>;
  unlockedMemories: string[];      // Narrative flourishes unlocked for dialogs
  ancestorQuests: Array<{          // Procedural quests tied to ancestor
    questId: string;
    title: string;
    rewardLP: number;
    type: 'honoring' | 'avenging' | 'completing';
  }>;
  factionStandingBonus: Record<string, number>;  // Inherited reputation
  worldStateInheritance: {
    blightedBiomesCarryOver: string[];    // Scarred locations persist
    discoveredGatesOpen: string[];        // Unlocked fast travel points
    unlockedMerchantTiers: string[];      // Merchant classes available
  };
  paradoxDescent: number;          // Inherited curse intensity (0-50)
  narrativeForeshadow: string;     // Teaser for next generation
}

export function processChronicleSequence(
  result: EpochTransitionResult
): InheritancePayload {
  // Calculate ancestor myth rank (0-5 scale)
  let ancestorMythRank = 0;
  if (result.mythStatus >= 90) ancestorMythRank = 5;  // Mythic
  else if (result.mythStatus >= 75) ancestorMythRank = 4;  // Legendary
  else if (result.mythStatus >= 50) ancestorMythRank = 3;  // Notable
  else if (result.mythStatus >= 25) ancestorMythRank = 2;  // Remembered
  else if (result.mythStatus >= 10) ancestorMythRank = 1;  // Known
  // else ancestorMythRank = 0;  // Forgotten

  // Calculate world delta magnitude
  const deltaLocationCount = result.worldDelta.locationChanges.length;
  const deltaNpcCount = result.worldDelta.npcStateShifts.length;
  const deltaEventCount = result.worldDelta.eventLog.length;
  const worldDeltaMagnitude = deltaLocationCount + (deltaNpcCount * 2) + (deltaEventCount * 0.5);

  // Hero's Journey Formula: Legacy Budget calculation
  const legacyBudget = Math.floor(
    (ancestorMythRank * 1.5) + (worldDeltaMagnitude / 10)
  );

  // Generate inherited artifacts based on budget
  const inheritedArtifacts = generateInheritedArtifacts(
    legacyBudget,
    result.softCanon.worldState,
    result.fromEpochId
  );

  // Generate unlocked memories (narrative snippets)
  const unlockedMemories = generateUnlockedMemories(
    ancestorMythRank,
    result.totalDeathCount,
    result.npcLineageSurvival
  );

  // Generate ancestor-themed procedural quests
  const ancestorQuests = generateAncestorQuests(
    ancestorMythRank,
    legacyBudget,
    result.worldDelta
  );

  // Build faction standing inheritance
  const factionStandingBonus: Record<string, number> = {};
  for (const [factionId, reputation] of Object.entries(result.softCanon.inheritedFactionReputation)) {
    // Pass down 30% of previous ancestor's reputation
    factionStandingBonus[factionId] = Math.floor((reputation as number) * 0.3);
  }

  // World state inheritance
  const worldStateInheritance = {
    blightedBiomesCarryOver: result.worldDelta.locationChanges
      .filter(loc => loc.changes.environmentalEffects?.some(e => e.includes('blight')))
      .map(loc => loc.locationId),
    discoveredGatesOpen: result.softCanon.discoveredLocationsCarryOver,
    unlockedMerchantTiers: ancestorMythRank >= 2 ? ['rare', 'legendary'] : ['common']
  };

  // Paradox descent (curse inheritance)
  const paradoxDescent = Math.min(50, Math.floor(
    result.totalParadoxManifestations * 0.2 +
    (result.softCanon.worldState === 'declined' ? 10 : 0)
  ));

  // Generate foreshadowing narrative
  const narrativeForeshadow = generateForeshadow(
    ancestorMythRank,
    result.toEpochId,
    result.totalDeathCount > 0
  );

  return {
    sequenceNumber: result.sessionDurationTicks,  // Use session length as sequence marker
    ancestorMythRank,
    legacyBudget,
    inheritedArtifacts,
    unlockedMemories,
    ancestorQuests,
    factionStandingBonus,
    worldStateInheritance,
    paradoxDescent,
    narrativeForeshadow
  };
}

/**
 * Generate inherited artifacts from legacy budget
 * Higher myth ranks unlock rarer items
 */
function generateInheritedArtifacts(
  legacyBudget: number,
  worldState: 'improved' | 'declined' | 'neutral',
  fromEpochId: string
): InheritancePayload['inheritedArtifacts'] {
  const artifacts: InheritancePayload['inheritedArtifacts'] = [];
  
  // Budget tier 1: Common heirloom
  if (legacyBudget >= 1) {
    artifacts.push({
      itemId: `heirloom_ring_${fromEpochId}`,
      name: 'Ancestor\'s Ring',
      rarity: 'common',
      enchantments: ['ancestral_connection', 'slight_luck']
    });
  }

  // Budget tier 2-5: Rare artifact
  if (legacyBudget >= 3) {
    artifacts.push({
      itemId: `heirloom_amulet_${fromEpochId}`,
      name: 'Legacy Amulet',
      rarity: 'rare',
      enchantments: legacyBudget >= 4 
        ? ['resilience', 'faction_favor', 'paradox_resistance']
        : ['resilience', 'faction_favor']
    });
  }

  // Budget tier 6+: Legendary inheritance (only for myth rank 4+)
  if (legacyBudget >= 6) {
    const epithet = worldState === 'improved' ? 'Restoration' : worldState === 'declined' ? 'Reckoning' : 'Echoes';
    artifacts.push({
      itemId: `heirloom_weapon_${fromEpochId}`,
      name: `Blade of ${epithet}`,
      rarity: 'legendary',
      enchantments: ['ancestor_wrath', 'world_knowledge', 'legacy_surge', 'paradox_drain']
    });
  }

  // Cursed inheritance (if paradox was high)
  if (legacyBudget >= 5 && worldState === 'declined') {
    artifacts.push({
      itemId: `heirloom_curse_${fromEpochId}`,
      name: 'Burden of Choices',
      rarity: 'cursed',
      enchantments: ['paradox_echo', 'fate_twist', 'legacy_weight']
    });
  }

  return artifacts;
}

/**
 * Generate unlocked narrative memories for NPC dialogue
 * Higher myth ranks unlock unique dialogue options
 */
function generateUnlockedMemories(
  ancestorMythRank: number,
  deathCount: number,
  npcLineageSurvival: { survived: number; deceased: number }
): string[] {
  const memories: string[] = [];

  // Base memory: acknowledge ancestor
  memories.push('ancestor_was_here');

  // Myth rank unlocks
  if (ancestorMythRank >= 1) memories.push('ancestor_deeds_whispered');
  if (ancestorMythRank >= 2) memories.push('ancestor_songs_sung');
  if (ancestorMythRank >= 3) memories.push('ancestor_legends_known');
  if (ancestorMythRank >= 4) memories.push('ancestor_myths_eternal');
  if (ancestorMythRank >= 5) memories.push('ancestor_divine_presence');

  // Death count unlocks
  if (deathCount > 0) memories.push('ancestor_paid_blood_price');
  if (deathCount > 5) memories.push('ancestor_martyred_many');
  if (deathCount > 10) memories.push('ancestor_death_echo_strong');

  // NPC survival unlocks
  if (npcLineageSurvival.survived > 0) memories.push('ancestor_protected_lineages');
  if (npcLineageSurvival.survived > npcLineageSurvival.deceased) {
    memories.push('ancestor_brought_peace');
  }

  return memories;
}

/**
 * Generate procedural quests related to ancestor's legacy
 * Type: 'honoring' (complete tasks ancestor would approve)
 *       'avenging' (undo ancestor's wrongs)
 *       'completing' (finish ancestor's unfinished business)
 */
function generateAncestorQuests(
  ancestorMythRank: number,
  legacyBudget: number,
  worldDelta: WorldDelta
): InheritancePayload['ancestorQuests'] {
  const quests: InheritancePayload['ancestorQuests'] = [];

  // Quest 1: Honoring the ancestor
  quests.push({
    questId: 'ancestor_honor_pilgrimage',
    title: 'Retrace Ancestor\'s Steps',
    rewardLP: Math.floor(legacyBudget * 2),
    type: 'honoring'
  });

  // Quest 2: If ancestor had significant faction impact
  if (worldDelta.factionPowerShifts && Object.keys(worldDelta.factionPowerShifts).length > 0) {
    const shiftValue = Math.max(...Object.values(worldDelta.factionPowerShifts));
    quests.push({
      questId: 'ancestor_faction_echo',
      title: 'Renew Ancestor\'s Faction Bonds',
      rewardLP: Math.floor(5 + Math.abs(shiftValue) / 2),
      type: 'honoring'
    });
  }

  // Quest 3: If ancestor left many unfinished tasks
  if (worldDelta.eventLog.length > 5 && ancestorMythRank <= 2) {
    quests.push({
      questId: 'ancestor_incomplete_business',
      title: 'Complete Ancestor\'s Unfinished Tasks',
      rewardLP: 10,
      type: 'completing'
    });
  }

  // Quest 4: Legendary ancestors get vengeance quests
  if (ancestorMythRank >= 4 && worldDelta.locationChanges.length > 0) {
    quests.push({
      questId: 'ancestor_avenge_wronging',
      title: 'Avenge Ancestor\'s Enemy',
      rewardLP: 15,
      type: 'avenging'
    });
  }

  return quests;
}

/**
 * Generate foreshadowing narrative for next epoch
 * Hints at what's coming based on current state
 */
function generateForeshadow(
  ancestorMythRank: number,
  nextEpochId: string,
  hadDeaths: boolean
): string {
  const epochName = EPOCH_DEFINITIONS[nextEpochId]?.name || 'the next age';
  
  if (ancestorMythRank >= 4) {
    return `Your ancestor's legend precedes you into ${epochName}. The world trembles with anticipation.`;
  }
  
  if (hadDeaths) {
    return `Ghosts of the fallen linger as you enter ${epochName}. Their unquiet spirits may guide—or haunt.`;
  }

  if (ancestorMythRank >= 2) {
    return `Echoes of your ancestor's journey persist into ${epochName}. Some remember. Some fear. All wonder.`;
  }

  return `${epochName} awaits you, child of a forgotten ancestor. Here you must forge your own legend.`;
}
