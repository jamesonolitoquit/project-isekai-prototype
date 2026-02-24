/**
 * macroEventsEngine.ts - M50-A4: Global Macro Events System
 * 
 * Implements world-scale events that override individual NPC GOAP goals,
 * creating emergency conditions that reshape NPC behavior autonomously.
 * Examples: plagues, invasions, eclipses, natural disasters.
 */

import type { WorldState, NPC } from './worldEngine';
import { createWorldScar, type WorldScar } from './worldScarsEngine';
import { random } from './prng';
import { Event } from '../events/mutationLog';

export type MacroEventType = 
  | 'PLAGUE' 
  | 'INVASION' 
  | 'ECLIPSE' 
  | 'EARTHQUAKE' 
  | 'FAMINE'
  | 'DROUGHT'
  | 'BLIZZARD'
  | 'TERRITORIAL_WAR'
  | 'COSMIC_ANOMALY'
  | 'UNDEAD_RISING';

export interface MacroEvent {
  id: string;
  type: MacroEventType;
  name: string;
  description: string;
  startedAt: number;  // tick
  duration: number;   // ticks (0 = indefinite)
  severity: number;   // 1-100
  epicenter?: string; // locationId for location-specific events
  affectedLocationIds?: string[];
  isActive: boolean;
}

export interface MacroEventEffect {
  npcId: string;
  overrideGoal: string;  // Force NPC to pursue this goal instead
  movementConstraint?: 'flee' | 'gather' | 'defend';
  statsModifier?: Record<string, number>;  // stat adjustments (negative for debuffs)
}

const MACRO_EVENT_DEFINITIONS: Record<MacroEventType, {
  name: string;
  description: string;
  baseSeverity: number;
  effects: (state: WorldState, event: MacroEvent) => MacroEventEffect[];
}> = {
  PLAGUE: {
    name: 'Plague Outbreak',
    description: 'A deadly disease spreads through the land',
    baseSeverity: 60,
    effects: (state, event) => {
      // NPCs flee plague epicenter, seek healing
      const affectedNpcs = state.npcs.filter(npc => 
        event.epicenter ? npc.locationId === event.epicenter : random() < 0.3
      );
      return affectedNpcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: 'flee',
        movementConstraint: 'flee' as const,
        statsModifier: { str: -5, end: -10, agi: -3 }
      }));
    }
  },

  INVASION: {
    name: 'Foreign Invasion',
    description: 'An enemy force invades the realm',
    baseSeverity: 75,
    effects: (state, event) => {
      // NPCs near invasion site fight or flee, militia mobilizes
      const combatNpcs = state.npcs.filter(npc => 
        event.affectedLocationIds?.includes(npc.locationId) ?? false
      );
      return combatNpcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: (npc.stats?.str ?? 10) > 12 ? 'combat' : 'flee',
        movementConstraint: 'defend' as const,
        statsModifier: (npc.stats?.str ?? 10) > 12 ? { str: 5 } : {}
      }));
    }
  },

  ECLIPSE: {
    name: 'Celestial Eclipse',
    description: 'The sun darkens, casting the world into shadow',
    baseSeverity: 40,
    effects: (state, event) => {
      // All NPCs seek shelter or investigate mystery
      const roll = random();
      return state.npcs.filter(() => random() < 0.5).map(npc => ({
        npcId: npc.id,
        overrideGoal: roll > 0.5 ? 'rest' : 'explore',
        statsModifier: roll > 0.5 ? { agi: 10 } : {}  // Investigate: +agility
      }));
    }
  },

  EARTHQUAKE: {
    name: 'Earthquake Tremor',
    description: 'The earth shakes violently',
    baseSeverity: 70,
    effects: (state, event) => {
      // All NPCs flee to safe ground
      return state.npcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: 'flee',
        movementConstraint: 'flee' as const
      }));
    }
  },

  FAMINE: {
    name: 'Great Famine',
    description: 'Crops fail, food becomes scarce',
    baseSeverity: 55,
    effects: (state, event) => {
      // NPCs seek food, gather survival resources
      return state.npcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: 'gather',
        statsModifier: { end: -15, str: -5 }  // Hunger weakens
      }));
    }
  },

  DROUGHT: {
    name: 'Severe Drought',
    description: 'Water sources dry up across the land',
    baseSeverity: 50,
    effects: (state, event) => {
      // NPCs cluster around remaining water sources
      const waterLocations = state.locations.filter(loc => loc.biome === 'maritime' || loc.biome === 'plains');
      const effects = state.npcs.map(npc => {
        const targetLoc = waterLocations[Math.floor(random() * waterLocations.length)] || state.locations[0];
        return {
          npcId: npc.id,
          overrideGoal: 'gather',
          statsModifier: { str: -8, end: -12 }
        };
      });
      return effects;
    }
  },

  BLIZZARD: {
    name: 'Fierce Blizzard',
    description: 'Snow and ice storm rages across the region',
    baseSeverity: 65,
    effects: (state, event) => {
      // NPCs seek shelter indoors
      return state.npcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: 'rest',
        statsModifier: { agi: -10, str: -5, end: -8 }  // Cold penalizes physical
      }));
    }
  },

  TERRITORIAL_WAR: {
    name: 'Territorial War',
    description: 'Factions vie for dominion, conflict spreads',
    baseSeverity: 80,
    effects: (state, event) => {
      // Faction members mobilize for war
      const effects = state.npcs.filter(npc => (npc as any).factionId).map(npc => ({
        npcId: npc.id,
        overrideGoal: 'combat',
        movementConstraint: 'defend' as const,
        statsModifier: { str: 8, end: 5 }
      }));
      return effects;
    }
  },

  COSMIC_ANOMALY: {
    name: 'Cosmic Anomaly',
    description: 'Strange forces distort reality itself',
    baseSeverity: 90,
    effects: (state, event) => {
      // Mixed effects: some NPCs are drawn to anomaly, others flee
      return state.npcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: random() > 0.5 ? 'explore' : 'flee',
        statsModifier: { 
          str: random() > 0.5 ? 10 : -10,
          agi: random() > 0.5 ? 5 : -15
        }
      }));
    }
  },

  UNDEAD_RISING: {
    name: 'Undead Rising',
    description: 'The dead rise from their graves to plague the living',
    baseSeverity: 85,
    effects: (state, event) => {
      // All NPCs fight or flee from undead
      return state.npcs.map(npc => ({
        npcId: npc.id,
        overrideGoal: (npc.stats?.str ?? 10) + (npc.stats?.end ?? 10) > 20 ? 'combat' : 'flee',
        statsModifier: { agi: -5 }  // Panic reduces agility
      }));
    }
  }
};

/**
 * M50-A4: Process macro events for current tick
 * Returns events to register and effects to apply
 */
export function processMacroEvents(state: WorldState): {
  activeEvents: MacroEvent[];
  effects: MacroEventEffect[];
  newEvents: Event[];
  createdScars?: WorldScar[];
} {
  const activeEvents = (state as any).activeMacroEvents || [];
  const effects: MacroEventEffect[] = [];
  const newEvents: Event[] = [];
  const createdScars: WorldScar[] = [];

  // Track which events were active before (to detect expiration)
  const prevActiveCount = activeEvents.length;

  // Update active events (check duration expiration)
  const stillActive = activeEvents.filter((event: MacroEvent) => {
    if (event.duration === 0) return true;  // Indefinite
    const elapsed = (state.tick || 0) - event.startedAt;
    const expired = elapsed >= event.duration;

    // M51-D1: Create world scars when macro events expire (if high severity)
    if (expired && event.severity > 40) {
      const primaryLocation = event.epicenter || state.locations[0]?.id;
      if (primaryLocation) {
        const { scar, events: scarEvents } = createWorldScar(
          state,
          event.type,
          primaryLocation,
          state.tick || 0
        );
        createdScars.push(scar);
        newEvents.push(...scarEvents);

        // Emit event expiration with scar marker
        newEvents.push({
          id: `macro-event-ended-${event.id}`,
          worldInstanceId: state.id,
          actorId: 'system',
          type: 'MACRO_EVENT_ENDED_WITH_SCAR',
          payload: {
            eventId: event.id,
            eventType: event.type,
            name: event.name,
            scarId: scar.id,
            scarType: scar.type
          },
          timestamp: Date.now()
        });
      }
    }

    return !expired;
  });

  // Generate effects for all active events
  for (const macroEvent of stillActive) {
    const definition = MACRO_EVENT_DEFINITIONS[macroEvent.type];
    if (!definition) continue;

    const eventEffects = definition.effects(state, macroEvent);
    effects.push(...eventEffects);

    // Emit macro event tick event occasionally (not every tick)
    if ((state.tick || 0) % 12 === 0) {
      newEvents.push({
        id: `macro-event-tick-${macroEvent.id}-${state.tick}`,
        worldInstanceId: state.id,
        actorId: 'system',
        type: 'MACRO_EVENT_ACTIVE',
        payload: {
          eventId: macroEvent.id,
          eventType: macroEvent.type,
          name: macroEvent.name,
          severity: macroEvent.severity,
          remainingDuration: macroEvent.duration - ((state.tick || 0) - macroEvent.startedAt)
        },
        timestamp: Date.now()
      });
    }
  }

  return { activeEvents: stillActive, effects, newEvents, createdScars };
}

/**
 * M50-A4: Trigger a new macro event
 */
export function triggerMacroEvent(
  state: WorldState,
  eventType: MacroEventType,
  duration: number = 72,  // Default ~3 days
  epicenter?: string
): MacroEvent {
  const definition = MACRO_EVENT_DEFINITIONS[eventType];
  
  const severity = definition.baseSeverity + random() * 20 - 10;  // ±10 variance
  
  const newEvent: MacroEvent = {
    id: `macro-${eventType}-${Date.now()}`,
    type: eventType,
    name: definition.name,
    description: definition.description,
    startedAt: state.tick || 0,
    duration,
    severity: Math.min(100, Math.max(1, severity)),
    epicenter,
    isActive: true
  };

  // Compute affected locations if location-specific
  if (epicenter) {
    newEvent.affectedLocationIds = state.locations
      .filter(loc => {
        const dx = (loc.x || 0) - (state.locations.find(l => l.id === epicenter)?.x || 0);
        const dy = (loc.y || 0) - (state.locations.find(l => l.id === epicenter)?.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (newEvent.severity / 10);  // Spread based on severity
      })
      .map(l => l.id);
  }

  // Store on state
  if (!(state as any).activeMacroEvents) {
    (state as any).activeMacroEvents = [];
  }
  (state as any).activeMacroEvents.push(newEvent);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[MacroEvents] ${definition.name} (severity: ${newEvent.severity.toFixed(0)}) triggered at ${epicenter || 'world-wide'}`);
  }

  return newEvent;
}

/**
 * M50-A4: Cancel an active macro event
 */
export function cancelMacroEvent(state: WorldState, eventId: string): boolean {
  const macroEvents = (state as any).activeMacroEvents || [];
  const index = macroEvents.findIndex((e: MacroEvent) => e.id === eventId);
  
  if (index >= 0) {
    const event = macroEvents[index];
    event.isActive = false;
    macroEvents.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * M50-A4: Apply macro event effects to NPC goals
 * Modifies NPC personality and goals temporarily
 */
export function applyMacroEventEffectsToNpc(npc: NPC, effects: MacroEventEffect[]): NPC {
  const relevantEffect = effects.find(e => e.npcId === npc.id);
  if (!relevantEffect) return npc;

  // Override GOAP goal
  const updatedNpc = structuredClone(npc);
  if (relevantEffect.overrideGoal) {
    (updatedNpc as any).alternativeGoal = relevantEffect.overrideGoal;  // Store for GOAP override
    (updatedNpc as any).goalOverrideReason = 'MACRO_EVENT';
  }

  // Apply temporary stat modifiers
  if (relevantEffect.statsModifier) {
    updatedNpc.stats = updatedNpc.stats || { str: 10, agi: 10, end: 10 };
    for (const [key, modifier] of Object.entries(relevantEffect.statsModifier)) {
      if (key in updatedNpc.stats) {
        (updatedNpc.stats as any)[key] = Math.max(1, (updatedNpc.stats as any)[key] + (modifier as number));
      }
    }
  }

  return updatedNpc;
}

export const MacroEventsEngineExports = {
  processMacroEvents,
  triggerMacroEvent,
  cancelMacroEvent,
  applyMacroEventEffectsToNpc,
  MACRO_EVENT_DEFINITIONS
};
