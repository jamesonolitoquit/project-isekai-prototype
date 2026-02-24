/**
 * factionSkirmishEngine.ts - M50-A1: Autonomous Faction Skirmish Resolution
 * 
 * Handles NPC-vs-NPC territorial battles that autonomously change influenceMap
 * when hostile factions occupy the same location during a world tick.
 * 
 * This enables the world to "live" even without player intervention—factions
 * compete for territory through their autonomous NPCs.
 */

import type { WorldState, NPC } from './worldEngine';
import { random } from './prng';
import { Event } from '../events/mutationLog';

export interface SkirmishResult {
  locationId: string;
  winnerFactionId: string;
  loserFactionId: string;
  powerShift: number;  // Amount of influence transferred
  causalities: number;  // NPCs defeated
  events: Event[];
}

/**
 * M50-A1: Process location skirmishes
 * When 2+ NPCs from hostile factions occupy same location, trigger combat resolution
 */
export function resolveLocationSkirmishes(state: WorldState): SkirmishResult[] {
  const results: SkirmishResult[] = [];
  
  // Group NPCs by location
  const npcsByLocation: Map<string, NPC[]> = new Map();
  for (const npc of state.npcs) {
    if (!npcsByLocation.has(npc.locationId)) {
      npcsByLocation.set(npc.locationId, []);
    }
    npcsByLocation.get(npc.locationId)!.push(npc);
  }

  // Check each location for hostile faction conflicts
  for (const [locationId, npcs] of npcsByLocation.entries()) {
    const factionGroups = new Map<string, NPC[]>();
    
    // Group NPCs by their faction
    for (const npc of npcs) {
      const factionId = (npc as any).factionId || 'independent';
      if (!factionGroups.has(factionId)) {
        factionGroups.set(factionId, []);
      }
      factionGroups.get(factionId)!.push(npc);
    }

    // If 2+ factions present, check for hostility
    if (factionGroups.size >= 2) {
      const factionIds = Array.from(factionGroups.keys());
      
      for (let i = 0; i < factionIds.length; i++) {
        for (let j = i + 1; j < factionIds.length; j++) {
          const factionAId = factionIds[i];
          const factionBId = factionIds[j];
          
          // Skip if either is 'independent' (neutral)
          if (factionAId === 'independent' || factionBId === 'independent') {
            continue;
          }

          // Check if factions are hostile (rivalry, war, or very different alignment)
          const factionA = state.factions?.find(f => f.id === factionAId);
          const factionB = state.factions?.find(f => f.id === factionBId);
          
          if (!factionA || !factionB) continue;
          
          const isHostile = areFactionsHostile(state, factionAId, factionBId);
          if (!isHostile) continue;

          // Resolve skirmish
          const npcsA = factionGroups.get(factionAId)!;
          const npcsB = factionGroups.get(factionBId)!;
          
          const skirmishResult = resolveSkirmish(
            state,
            locationId,
            factionAId,
            npcsA,
            factionBId,
            npcsB
          );
          
          results.push(skirmishResult);
        }
      }
    }
  }

  return results;
}

/**
 * Check if two factions are hostile to each other
 */
function areFactionsHostile(state: WorldState, factionAId: string, factionBId: string): boolean {
  const factionA = state.factions?.find(f => f.id === factionAId);
  const factionB = state.factions?.find(f => f.id === factionBId);
  
  if (!factionA || !factionB) return false;

  // Check explicit conflict relationships
  const conflicts = state.factionConflicts || [];
  const hasConflict = conflicts.some(c =>
    c.active && 
    ((c.factionIds[0] === factionAId && c.factionIds[1] === factionBId) ||
     (c.factionIds[0] === factionBId && c.factionIds[1] === factionAId))
  );
  
  if (hasConflict) return true;

  // Check alignment conflict (good vs evil, order vs chaos)
  const alignmentConflict = 
    (factionA.alignment === 'good' && factionB.alignment === 'evil') ||
    (factionA.alignment === 'evil' && factionB.alignment === 'good');
  
  if (alignmentConflict) return true;

  // Otherwise not hostile
  return false;
}

/**
 * M50-A1: Resolve skirmish between two faction groups at a location
 */
function resolveSkirmish(
  state: WorldState,
  locationId: string,
  factionAId: string,
  npcsA: NPC[],
  factionBId: string,
  npcsB: NPC[]
): SkirmishResult {
  // Calculate faction power at location
  const factionA = state.factions?.find(f => f.id === factionAId)!;
  const factionB = state.factions?.find(f => f.id === factionBId)!;
  
  // Base power from faction strength
  let powerA = factionA.powerScore || 50;
  let powerB = factionB.powerScore || 50;
  
  // Modifier from NPC count
  powerA += npcsA.length * 10;
  powerB += npcsB.length * 10;
  
  // Modifier from NPC stats (avg strength)
  const avgStrA = npcsA.reduce((sum, npc) => sum + (npc.stats?.str || 10), 0) / npcsA.length;
  const avgStrB = npcsB.reduce((sum, npc) => sum + (npc.stats?.str || 10), 0) / npcsB.length;
  
  powerA += (avgStrA - 10) * 2;
  powerB += (avgStrB - 10) * 2;
  
  // Determine winner with some randomness
  const roll = random();
  const totalPower = powerA + powerB;
  const winnerA = roll < (powerA / totalPower);
  
  const winnerFactionId = winnerA ? factionAId : factionBId;
  const loserFactionId = winnerA ? factionBId : factionAId;
  const winnerPower = winnerA ? powerA : powerB;
  const loserPower = winnerA ? powerB : powerA;
  
  // Calculate influence shift (larger when power difference is greater)
  const powerDifference = Math.abs(winnerPower - loserPower);
  const powerShift = Math.floor(5 + (powerDifference / 10));
  
  // Apply influence map changes
  if (!state.influenceMap) {
    (state as any).influenceMap = {};
  }
  if (!state.influenceMap[locationId]) {
    (state as any).influenceMap[locationId] = {};
  }
  
  const locInfluence = state.influenceMap[locationId];
  locInfluence[winnerFactionId] = (locInfluence[winnerFactionId] || 0) + powerShift;
  locInfluence[loserFactionId] = Math.max(0, (locInfluence[loserFactionId] || 0) - Math.floor(powerShift / 2));
  
  // Calculate causalities (some NPCs "defeated" and temporarily unavailable)
  const causalities = Math.floor(random() * Math.min(npcsA.length, npcsB.length));
  
  // Create skirmish event
  const events: Event[] = [];
  events.push({
    id: `skirmish-${locationId}-${state.tick}-${Math.floor(random() * 0xffffff).toString(16)}`,
    worldInstanceId: state.id,
    actorId: winnerFactionId,
    type: 'FACTION_SKIRMISH',
    payload: {
      locationId,
      winnerFactionId: winnerFactionId,
      winnerFactionName: (state.factions?.find(f => f.id === winnerFactionId)?.name || 'Unknown'),
      loserFactionId: loserFactionId,
      loserFactionName: (state.factions?.find(f => f.id === loserFactionId)?.name || 'Unknown'),
      powerShift,
      causalities,
      npcCountWinner: winnerA ? npcsA.length : npcsB.length,
      npcCountLoser: winnerA ? npcsB.length : npcsA.length
    },
    templateOrigin: 'faction-skirmish',
    timestamp: Date.now()
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[SKIRMISH] ${state.factions?.find(f => f.id === winnerFactionId)?.name || winnerFactionId} defeats ` +
      `${state.factions?.find(f => f.id === loserFactionId)?.name || loserFactionId} at ${locationId} ` +
      `(+${powerShift} influence, ${causalities} casualties)`
    );
  }
  
  return {
    locationId,
    winnerFactionId,
    loserFactionId,
    powerShift,
    causalities,
    events
  };
}

/**
 * M50-A1: Get all active skirmishes happening at a location
 */
export function getLocationSkirmishStatus(state: WorldState, locationId: string): {
  isUnderSiege: boolean;
  factions: Array<{ factionId: string; factionName: string; npcCount: number }>;
} {
  const npcs = state.npcs.filter(n => n.locationId === locationId);
  const factionGroups = new Map<string, number>();
  
  for (const npc of npcs) {
    const factionId = (npc as any).factionId || 'independent';
    factionGroups.set(factionId, (factionGroups.get(factionId) || 0) + 1);
  }
  
  const factions = Array.from(factionGroups.entries())
    .filter(([fId]) => fId !== 'independent')
    .map(([fId, count]) => ({
      factionId: fId,
      factionName: state.factions?.find(f => f.id === fId)?.name || fId,
      npcCount: count
    }));
  
  // Under siege if 2+ hostile factions present
  const isUnderSiege = factions.length >= 2;
  
  return { isUnderSiege, factions };
}

/**
 * Singleton getter for faction skirmish engine
 */
let skirmishEngineInstance: any = null;

export function getFactionSkirmishEngine() {
  if (!skirmishEngineInstance) {
    skirmishEngineInstance = {
      resolveLocationSkirmishes,
      getLocationSkirmishStatus,
      areFactionsHostile
    };
  }
  return skirmishEngineInstance;
}

export const FactionSkirmishEngineExports = {
  getFactionSkirmishEngine,
  resolveLocationSkirmishes,
  getLocationSkirmishStatus
};
