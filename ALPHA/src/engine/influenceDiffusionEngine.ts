/**
 * influenceDiffusionEngine.ts - M15 Step 5: Geopolitical Influence Diffusion
 * 
 * Manages faction territorial influence expansion through daily diffusion:
 * - Influence gains at faction HQ (+10/day)
 * - Spread to adjacent locations (25% of current)
 * - Decay from entropy (5% daily loss)
 * - Territory capture (>60 influence) and loss (<30 influence)
 * 
 * Emits INFLUENCE_SHIFT events when control changes
 */

import { WorldState, Location } from './worldEngine';
import { Faction } from './factionEngine';
import { appendEvent, Event } from '../events/mutationLog';

/**
 * Build adjacency map from location spatial coordinates
 * Two locations are adjacent if within ~250 coordinate units (configurable)
 */
export function buildAdjacencyMap(locations: Location[]): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {};
  const ADJACENCY_DISTANCE = 250;

  locations.forEach(loc => {
    adjacency[loc.id] = [];
  });

  // Check all pairs for distances (O(n²) but acceptable for game world)
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const a = locations[i];
      const b = locations[j];

      // If coordinates exist, use them; otherwise treat as adjacent (fallback)
      const distance = (a.x !== undefined && a.y !== undefined && 
                       b.x !== undefined && b.y !== undefined)
        ? Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
        : ADJACENCY_DISTANCE / 2; // Default: adjacent

      if (distance <= ADJACENCY_DISTANCE) {
        adjacency[a.id].push(b.id);
        adjacency[b.id].push(a.id);
      }
    }
  }

  return adjacency;
}

export interface InfluenceShiftEvent extends Event {
  type: 'INFLUENCE_SHIFT';
  payload: {
    factionId: string;
    locationId: string;
    oldInfluence: number;
    newInfluence: number;
    controlChanged: boolean;
    nowControls: boolean; // true if faction now controls location
  };
}

/**
 * Main influence diffusion engine
 * Call once per day tick to process territorial influence
 */
export function processDailyInfluenceDiffusion(
  state: WorldState,
  worldInstanceId: string
): { updatedState: WorldState; events: InfluenceShiftEvent[] } {
  const events: InfluenceShiftEvent[] = [];
  let influenceMap = state.influenceMap || {};
  const factions = state.factions || [];
  const locations = state.locations || [];
  const adjacency = buildAdjacencyMap(locations);

  // Ensure influenceMap exists and is initialized
  if (!influenceMap || Object.keys(influenceMap).length === 0) {
    influenceMap = {};
    locations.forEach(loc => {
      influenceMap[loc.id] = {};
      factions.forEach(faction => {
        influenceMap[loc.id][faction.id] = faction.primaryLocationId === loc.id ? 50 : 0;
      });
    });
  }

  const baseControlThreshold = 60; // >60 = capture
  const baseLossThreshold = 30; // <30 = loss

  // Process each faction's influence in each location
  factions.forEach(faction => {
    locations.forEach(location => {
      let currentInfluence = influenceMap[location.id]?.[faction.id] ?? 0;
      let newInfluence = currentInfluence;

      // PHASE 1: Gain influence at faction stronghold (+10/day)
      if (faction.primaryLocationId === location.id) {
        newInfluence = Math.min(100, newInfluence + 10); // Cap at 100
      }

      // PHASE 2: Spread to adjacent locations (25% of current)
      if (currentInfluence > 0 && newInfluence > 0) {
        const spreadAmount = newInfluence * 0.25;
        (adjacency[location.id] || []).forEach(adjacentLocId => {
          if (!influenceMap[adjacentLocId]) influenceMap[adjacentLocId] = {};
          const currentAdjacentInfluence = influenceMap[adjacentLocId][faction.id] ?? 0;
          influenceMap[adjacentLocId][faction.id] = Math.min(
            100,
            currentAdjacentInfluence + spreadAmount * 0.1 // 10% of spread reaches adjacent (reduces propagation)
          );
        });
      }

      // PHASE 3: Decay from entropy (5% daily loss)
      newInfluence = Math.max(0, newInfluence * 0.95);

      // PHASE 4: Territory control thresholds (hysteresis to prevent flickering)
      const wasControlling = currentInfluence >= baseControlThreshold;
      const nowControlling = newInfluence >= baseControlThreshold;
      const wasDominating = currentInfluence < baseLossThreshold;
      const noDominating = newInfluence < baseLossThreshold;

      // Update faction's controlled territories
      const controlledSet = new Set(faction.controlledLocationIds || []);

      if (nowControlling && !wasControlling) {
        // CAPTURE: Faction just crossed threshold to control
        controlledSet.add(location.id);
        events.push({
          type: 'INFLUENCE_SHIFT',
          id: `influence-${faction.id}-${location.id}-${Date.now()}`,
          worldInstanceId,
          actorId: faction.id,
          timestamp: Date.now(),
          payload: {
            factionId: faction.id,
            locationId: location.id,
            oldInfluence: currentInfluence,
            newInfluence: newInfluence,
            controlChanged: true,
            nowControls: true
          }
        });
      } else if (noDominating && !wasDominating && wasControlling) {
        // LOSS: Faction fell below minimum and loses control
        controlledSet.delete(location.id);
        events.push({
          type: 'INFLUENCE_SHIFT',
          id: `influence-${faction.id}-${location.id}-${Date.now()}`,
          worldInstanceId,
          actorId: faction.id,
          timestamp: Date.now(),
          payload: {
            factionId: faction.id,
            locationId: location.id,
            oldInfluence: currentInfluence,
            newInfluence: newInfluence,
            controlChanged: true,
            nowControls: false
          }
        });
      }

      // Sync back to faction's controlledLocationIds
      const updatedFaction = { ...faction, controlledLocationIds: Array.from(controlledSet) };
      const factionIndex = factions.findIndex(f => f.id === faction.id);
      if (factionIndex >= 0) {
        factions[factionIndex] = updatedFaction;
      }

      // Update influence value
      influenceMap[location.id][faction.id] = newInfluence;
    });
  });

  // Return updated state with new influence map and emit events
  const updatedState: WorldState = {
    ...state,
    factions,
    influenceMap,
    lastFactionTick: state.tick ?? 0
  };

  // Append events to mutation log
  events.forEach(event => {
    appendEvent(event);
  });

  return { updatedState, events };
}
