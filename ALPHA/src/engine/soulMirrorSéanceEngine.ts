/**
 * soulMirrorSéanceEngine.ts - M51-C1: Soul Mirror Séance & Targeted Ancestor Guidance
 * 
 * Extends the soul resonance system to allow players to query ancestors for
 * targeted guidance on specific investigation chains or locations.
 */

import type { WorldState, NPC } from './worldEngine';
import { Event } from '../events/mutationLog';

export type GuidanceType = 'location' | 'npc' | 'faction' | 'investigation_path';

export interface AncestorGuidance {
  ancestorName: string;
  resonanceStrength: number;  // Based on echo strength
  guidanceType: GuidanceType;
  revelation: string;
  confidence: number;  // 0-100, how certain the guidance is
  clueIds?: string[];  // Investigation clues that support this
}

export interface SéanceQuery {
  investigationChainId?: string;
  targetLocationId?: string;
  targetNpcId?: string;
  factionId?: string;
}

export interface SéanceResult {
  ancestorGuidances: AncestorGuidance[];
  markerLocations: string[];  // Locations to mark on ChronicleMap
  events: Event[];
  resonanceCost: number;  // Soul echo resonance expended
}

/**
 * M51-C1: Query ancestors for targeted guidance on investigation
 * Requires connection to soul resonance + investigation pipeline
 */
export function queryAncestorGuidance(
  state: WorldState,
  playerResonanceLevel: number,
  query: SéanceQuery
): SéanceResult {
  const events: Event[] = [];
  const ancestorGuidances: AncestorGuidance[] = [];
  const markerLocations: string[] = [];
  let resonanceCost = 0;

  // Validate resonance availability
  if (playerResonanceLevel < 20) {
    return {
      ancestorGuidances: [],
      markerLocations: [],
      events: [{
        id: `séance-failed-low-resonance-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'player',
        type: 'ANCESTOR_GUIDANCE_FAILED_LOW_RESONANCE',
        payload: { requiredResonance: 20, currentResonance: playerResonanceLevel },
        timestamp: Date.now()
      }],
      resonanceCost: 0
    };
  }

  // Determine queries to process
  let guidanceCount = 0;
  const maxGuidances = playerResonanceLevel >= 80 ? 3 : playerResonanceLevel >= 50 ? 2 : 1;

  // Query 1: Investigation Chain Guidance
  if (query.investigationChainId) {
    const guidance = generateInvestigationChainGuidance(
      state,
      query.investigationChainId,
      playerResonanceLevel
    );
    if (guidance) {
      ancestorGuidances.push(guidance);
      resonanceCost += 20;
      guidanceCount++;
      
      if (guidance.clueIds) {
        markerLocations.push(...guidance.clueIds);
      }
    }
  }

  // Query 2: Location Guidance
  if (guidanceCount < maxGuidances && query.targetLocationId) {
    const guidance = generateLocationGuidance(
      state,
      query.targetLocationId,
      playerResonanceLevel
    );
    if (guidance) {
      ancestorGuidances.push(guidance);
      resonanceCost += 25;
      guidanceCount++;
      markerLocations.push(query.targetLocationId);
    }
  }

  // Query 3: NPC Guidance
  if (guidanceCount < maxGuidances && query.targetNpcId) {
    const npc = state.npcs.find(n => n.id === query.targetNpcId);
    if (npc) {
      const guidance = generateNpcGuidance(state, npc, playerResonanceLevel);
      if (guidance) {
        ancestorGuidances.push(guidance);
        resonanceCost += 15;
        guidanceCount++;
        if (npc.locationId) {
          markerLocations.push(npc.locationId);
        }
      }
    }
  }

  // Query 4: Faction Guidance
  if (guidanceCount < maxGuidances && query.factionId) {
    const factionGuidance = generateFactionGuidance(
      state,
      query.factionId,
      playerResonanceLevel
    );
    if (factionGuidance) {
      ancestorGuidances.push(factionGuidance);
      resonanceCost += 30;
      guidanceCount++;
      
      // Mark all faction-controlled locations
      const faction = (state as any).factions?.find((f: any) => f.id === query.factionId);
      if (faction?.controlledLocationIds) {
        markerLocations.push(...faction.controlledLocationIds);
      }
    }
  }

  // Emit séance event
  const séanceEvent: Event = {
    id: `soul-mirror-séance-${Date.now()}`,
    worldInstanceId: state.id,
    actorId: 'player',
    type: 'SOUL_MIRROR_SEANCE',
    payload: {
      resonanceLevel: playerResonanceLevel,
      resonanceCost,
      guidanceCount,
      queryType: Object.keys(query).filter(k => (query as any)[k])[0]
    },
    timestamp: Date.now()
  };
  events.push(séanceEvent);

  // Emit revelation events for each guidance
  for (const guidance of ancestorGuidances) {
    const revelationEvent: Event = {
      id: `ancestor-guidance-${guidance.ancestorName}-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: 'player',
      type: 'ANCESTOR_GUIDANCE_REVEALED',
      payload: {
        ancestorName: guidance.ancestorName,
        resonanceStrength: guidance.resonanceStrength,
        guidanceType: guidance.guidanceType,
        revelation: guidance.revelation,
        confidence: guidance.confidence
      },
      timestamp: Date.now()
    };
    events.push(revelationEvent);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[SoulMirrorSéance] Player channeled ${ancestorGuidances.length} ancestors for guidance`);
  }

  return {
    ancestorGuidances,
    markerLocations,
    events,
    resonanceCost
  };
}

/**
 * Generate guidance from ancestor about investigation chain
 */
function generateInvestigationChainGuidance(
  state: WorldState,
  chainId: string,
  resonanceLevel: number
): AncestorGuidance | null {
  const revelations = [
    "The traitor was last seen near the northern fortress.",
    "The hidden cache lies beneath the old mill in sector 3.",
    "The faction leaders meet in the crypt on full moons.",
    "The escaped prisoner fled to the coast, I sense it still.",
    "The corruption runs deeper than you know—check the religious order."
  ];

  const randomRevelation = revelations[Math.floor(Math.random() * revelations.length)];
  const ancestorNames = ['Lysandra the Wise', 'Elder Thorne', 'Prophet Kess', 'Sage Morian', 'Echo of Old'];
  const ancestorName = ancestorNames[Math.floor(Math.random() * ancestorNames.length)];

  return {
    ancestorName,
    resonanceStrength: resonanceLevel,
    guidanceType: 'investigation_path',
    revelation: randomRevelation,
    confidence: Math.min(100, 50 + resonanceLevel / 2),
    clueIds: []
  };
}

/**
 * Generate guidance from ancestor about location
 */
function generateLocationGuidance(
  state: WorldState,
  locationId: string,
  resonanceLevel: number
): AncestorGuidance | null {
  const location = (state as any).locations?.find((l: any) => l.id === locationId);
  if (!location) return null;

  const revelations: Record<string, string> = {
    default: `${location.name} holds secrets buried deep. I sense danger and opportunity there.`,
    settlement: `${location.name} was once a place of great power. Underground passages still exist.`,
    fortress: `${location.name}'s generals are not as loyal as they appear.`,
    tomb: `${location.name} contains artifacts of immense power. Beware the guardians.`,
    library: `${location.name}'s forbidden section contains journals from the old world.`
  };

  const revelation = revelations[location.type] || revelations.default;
  const ancestorNames = ['Lysandra the Wise', 'Vorian the Traveler', 'Kess Luminous', 'Thorne Ancient'];
  const ancestorName = ancestorNames[Math.floor(Math.random() * ancestorNames.length)];

  return {
    ancestorName,
    resonanceStrength: resonanceLevel,
    guidanceType: 'location',
    revelation,
    confidence: Math.min(100, 60 + resonanceLevel / 3)
  };
}

/**
 * Generate guidance from ancestor about NPC
 */
function generateNpcGuidance(
  state: WorldState,
  npc: NPC,
  resonanceLevel: number
): AncestorGuidance | null {
  const revelations = [
    `${npc.name} harbors guilt about something long hidden.`,
    `${npc.name} is not who they claim to be. I sense deception.`,
    `${npc.name} was once powerful. Their true nature will surprise you.`,
    `${npc.name} seeks redemption for a past transgression.`,
    `${npc.name} holds a secret that could change everything.`
  ];

  const randomRevelation = revelations[Math.floor(Math.random() * revelations.length)];
  const ancestorNames = ['Echo of Elsyn', 'Morian the Seeing', 'Vex Oldblood', 'Kess the True'];
  const ancestorName = ancestorNames[Math.floor(Math.random() * ancestorNames.length)];

  return {
    ancestorName,
    resonanceStrength: resonanceLevel,
    guidanceType: 'npc',
    revelation: randomRevelation,
    confidence: Math.min(100, 40 + resonanceLevel / 4)
  };
}

/**
 * Generate guidance from ancestor about faction
 */
function generateFactionGuidance(
  state: WorldState,
  factionId: string,
  resonanceLevel: number
): AncestorGuidance | null {
  const faction = (state as any).factions?.find((f: any) => f.id === factionId);
  if (!faction) return null;

  const revelations = [
    `The ${faction.name} faction's true goal is hidden from its own members.`,
    `Internal conflict brews within ${faction.name}. Look for the cracks.`,
    `The ${faction.name} leaders made a pact with something ancient.`,
    `${faction.name} built their power on a lie. The truth will shatter them.`,
    `The ${faction.name} will soon face a great trial. Your choices matter.`
  ];

  const randomRevelation = revelations[Math.floor(Math.random() * revelations.length)];
  const ancestorNames = ['Prophet Kess', 'Thorne Eternal', 'Lysandra Wise', 'Vorian Fateseeker'];
  const ancestorName = ancestorNames[Math.floor(Math.random() * ancestorNames.length)];

  return {
    ancestorName,
    resonanceStrength: resonanceLevel,
    guidanceType: 'faction',
    revelation: randomRevelation,
    confidence: Math.min(100, 45 + resonanceLevel / 3)
  };
}

/**
 * M51-C1: Determine if player resonance is strong enough for séance
 */
export function canInitiateSéance(resonanceLevel: number): boolean {
  return resonanceLevel >= 20;
}

/**
 * M51-C1: Get the maximum number of guidances available at current resonance
 */
export function getMaxGuidancesForResonance(resonanceLevel: number): number {
  if (resonanceLevel >= 80) return 3;
  if (resonanceLevel >= 50) return 2;
  if (resonanceLevel >= 20) return 1;
  return 0;
}

export const SoulMirrorSéanceEngineExports = {
  queryAncestorGuidance,
  canInitiateSéance,
  getMaxGuidancesForResonance
};
