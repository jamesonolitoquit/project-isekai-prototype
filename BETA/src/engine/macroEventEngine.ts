/**
 * macroEventEngine.ts - M37: World-Wide Macro Events & Phenomena
 * Manages global events with world-wide effects and consequences.
 */

import { SeededRng } from './prng';
import type { WorldState, Location } from './worldEngine';

export interface GlobalEffectModifier {
  statModifierKey: string;
  magnitude: number;
  affectedNpcs?: string[];
  affectedLocations?: string[];
  affectedFactions?: string[];
  durationInTicks: number;
  stackable: boolean;
}

export interface MacroEventTrigger {
  id: string;
  triggerType: 'time_based' | 'faction_based' | 'random' | 'condition_based';
  frequency?: number;
  conditionDescription?: string;
  probability: number;
}

export type MacroEventType =
  | 'plague'
  | 'holy_war'
  | 'mana_depletion'
  | 'environmental_corruption'
  | 'dimensional_rift'
  | 'prophecy_convergence'
  | 'celestial_event'
  | 'famine'
  | 'boon';

export interface MacroEvent {
  id: string;
  eventType: MacroEventType;
  eventName: string;
  description: string;
  severity: number;
  startTick: number;
  endTick?: number;
  isActive: boolean;
  globalEffects: GlobalEffectModifier[];
  affectedLocations: string[];
  affectedNpcs: string[];
  affectedFactions: string[];
  narrativeImpact: string;
  canBeCountered: boolean;
  counterMethods?: string[];
}

export interface MacroEventHistoryEntry {
  eventId: string;
  eventType: MacroEventType;
  eventName: string;
  tick: number;
  duration: number;
  outcome: 'resolved' | 'ongoing' | 'catastrophic' | 'mitigated';
  consequencesDescription: string;
}

class MacroEventEngine {
  private activeEvents: Map<string, MacroEvent> = new Map();
  private eventHistory: MacroEventHistoryEntry[] = [];
  private triggers: Map<string, MacroEventTrigger> = new Map();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
    this.initializeTriggers();
  }

  private initializeTriggers(): void {
    this.triggers.set('plague_trigger', {
      id: 'plague_trigger',
      triggerType: 'random',
      probability: 0.05,
      frequency: 500
    });

    this.triggers.set('holy_war_trigger', {
      id: 'holy_war_trigger',
      triggerType: 'faction_based',
      probability: 0.15,
      conditionDescription: 'Factions with hatred above 80% and military strength above 50'
    });

    this.triggers.set('mana_depletion_trigger', {
      id: 'mana_depletion_trigger',
      triggerType: 'condition_based',
      probability: 0.08,
      conditionDescription: 'Global mana reserves fall below 30%'
    });
  }

  triggerMacroEvent(
    eventType: MacroEventType,
    eventName: string,
    description: string,
    affectedLocations: string[],
    affectedFactions: string[],
    severity: number = 50
  ): MacroEvent {
    const event: MacroEvent = {
      id: `macro_event_${Date.now()}`,
      eventType,
      eventName,
      description,
      severity: Math.min(100, Math.max(0, severity)),
      startTick: this.rng.nextInt(0, 100000),
      isActive: true,
      globalEffects: this.generateGlobalEffects(eventType, severity),
      affectedLocations,
      affectedNpcs: [],
      affectedFactions,
      narrativeImpact: this.generateNarrative(eventType, eventName),
      canBeCountered: severity < 80,
      counterMethods: this.generateCounterMethods(eventType)
    };

    this.activeEvents.set(event.id, event);
    return event;
  }

  private generateGlobalEffects(eventType: MacroEventType, severity: number): GlobalEffectModifier[] {
    const effects: Record<MacroEventType, GlobalEffectModifier[]> = {
      'plague': [
        {
          statModifierKey: 'health_regen',
          magnitude: -0.5 * (severity / 100),
          durationInTicks: 500,
          stackable: false
        },
        {
          statModifierKey: 'population_growth',
          magnitude: -0.3 * (severity / 100),
          durationInTicks: 500,
          stackable: false
        }
      ],
      'holy_war': [
        {
          statModifierKey: 'faction_hatred',
          magnitude: 0.7,
          durationInTicks: 1000,
          stackable: true
        },
        {
          statModifierKey: 'military_recruitment',
          magnitude: 0.8,
          durationInTicks: 500,
          stackable: false
        }
      ],
      'mana_depletion': [
        {
          statModifierKey: 'spell_potency',
          magnitude: -0.6 * (severity / 100),
          durationInTicks: 750,
          stackable: false
        },
        {
          statModifierKey: 'magic_availability',
          magnitude: -0.8 * (severity / 100),
          durationInTicks: 750,
          stackable: false
        }
      ],
      'environmental_corruption': [
        {
          statModifierKey: 'biome_health',
          magnitude: -0.7 * (severity / 100),
          durationInTicks: 800,
          stackable: false
        },
        {
          statModifierKey: 'resource_scarcity',
          magnitude: 0.9,
          durationInTicks: 800,
          stackable: false
        }
      ],
      'dimensional_rift': [
        {
          statModifierKey: 'reality_stability',
          magnitude: -0.6 * (severity / 100),
          durationInTicks: 600,
          stackable: false
        },
        {
          statModifierKey: 'planar_intrusions',
          magnitude: 1.0,
          durationInTicks: 400,
          stackable: true
        }
      ],
      'prophecy_convergence': [
        {
          statModifierKey: 'fate_weight',
          magnitude: 0.8,
          durationInTicks: 1000,
          stackable: false
        }
      ],
      'celestial_event': [
        {
          statModifierKey: 'moonlight_potency',
          magnitude: 0.5,
          durationInTicks: 100,
          stackable: false
        }
      ],
      'famine': [
        {
          statModifierKey: 'food_availability',
          magnitude: -0.8 * (severity / 100),
          durationInTicks: 1000,
          stackable: false
        },
        {
          statModifierKey: 'population_morale',
          magnitude: -0.5 * (severity / 100),
          durationInTicks: 500,
          stackable: false
        }
      ],
      'boon': [
        {
          statModifierKey: 'general_fortune',
          magnitude: 0.3,
          durationInTicks: 300,
          stackable: true
        }
      ]
    };

    return effects[eventType] || [];
  }

  private generateNarrative(eventType: MacroEventType, eventName: string): string {
    const narratives: Record<MacroEventType, string[]> = {
      'plague': [
        `A terrible sickness has swept across the land, claiming ${eventName}.`,
        `Disease spreads uncontrolled in the form of ${eventName}.`
      ],
      'holy_war': [
        `Holy warfare erupts between factions engaged in ${eventName}.`,
        `Crusades and counter-crusades define ${eventName}.`
      ],
      'mana_depletion': [
        `The magical reserves of the world are failing: ${eventName}.`,
        `Magic itself is dying through ${eventName}.`
      ],
      'environmental_corruption': [
        `The land itself is twisted and corrupted by ${eventName}.`,
        `Nature becomes hostile through ${eventName}.`
      ],
      'dimensional_rift': [
        `Reality tears asunder in an event known as ${eventName}.`,
        `Other worlds press through into ours via ${eventName}.`
      ],
      'prophecy_convergence': [
        `Ancient prophecies begin to align: ${eventName}.`,
        `Fate itself pivots toward ${eventName}.`
      ],
      'celestial_event': [
        `The heavens themselves react with ${eventName}.`,
        `Celestial phenomena manifest as ${eventName}.`
      ],
      'famine': [
        `The crops fail and ${eventName} spreads.`,
        `Starvation looms through ${eventName}.`
      ],
      'boon': [
        `Unexpected fortune arrives in the form of ${eventName}.`,
        `A blessing descends as ${eventName}.`
      ]
    };

    const array = narratives[eventType] || ['Something extraordinary occurs.'];
    return array[this.rng.nextInt(0, array.length - 1)];
  }

  private generateCounterMethods(eventType: MacroEventType): string[] {
    const counters: Record<MacroEventType, string[]> = {
      'plague': ['Cure Disease ritual', 'Cleanse affected locations', 'Isolate infected populations'],
      'holy_war': ['Diplomatic mediation', 'Religious council gathering', 'Shared enemy declaration'],
      'mana_depletion': ['Mana Well activation', 'Ley Line restoration', 'Artifact sacrifice'],
      'environmental_corruption': ['Land blessing ritual', 'Purification node creation', 'Nature magic channeling'],
      'dimensional_rift': ['Reality anchoring', 'Planar closing ceremony', 'Dimensional seal placement'],
      'prophecy_convergence': ['Prophecy rewriting', 'Fate intervention', 'Destiny manipulation'],
      'celestial_event': ['Lunar phase correction', 'Stellar alignment breaking', 'Celestial pact reformation'],
      'famine': ['Sacred food blessing', 'Trade route opening', 'Emergency supplies distribution'],
      'boon': ['Let it happen', 'Amplify the blessing', 'Record for posterity']
    };

    return counters[eventType] || [];
  }

  applyCounterMethod(eventId: string, method: string): boolean {
    const event = this.activeEvents.get(eventId);
    if (!event || !event.counterMethods?.includes(method)) return false;

    event.isActive = false;
    event.endTick = this.rng.nextInt(0, 100000);

    this.recordEventToHistory(event, 'mitigated');
    this.activeEvents.delete(eventId);

    return true;
  }

  resolveEvent(eventId: string, outcome: MacroEventHistoryEntry['outcome']): void {
    const event = this.activeEvents.get(eventId);
    if (!event) return;

    event.isActive = false;
    event.endTick = this.rng.nextInt(0, 100000);

    this.recordEventToHistory(event, outcome);
    this.activeEvents.delete(eventId);
  }

  private recordEventToHistory(event: MacroEvent, outcome: MacroEventHistoryEntry['outcome']): void {
    const duration = (event.endTick || this.rng.nextInt(0, 100000)) - event.startTick;

    const entry: MacroEventHistoryEntry = {
      eventId: event.id,
      eventType: event.eventType,
      eventName: event.eventName,
      tick: event.startTick,
      duration,
      outcome,
      consequencesDescription: `Event ${event.eventName} concluded with outcome: ${outcome}`
    };

    this.eventHistory.push(entry);

    if (this.eventHistory.length > 500) {
      this.eventHistory = this.eventHistory.slice(-250);
    }
  }

  getActiveEvent(eventId: string): MacroEvent | undefined {
    return this.activeEvents.get(eventId);
  }

  getAllActiveEvents(): MacroEvent[] {
    return Array.from(this.activeEvents.values());
  }

  getEventsByType(eventType: MacroEventType): MacroEvent[] {
    return Array.from(this.activeEvents.values()).filter(e => e.eventType === eventType);
  }

  getEventHistory(): MacroEventHistoryEntry[] {
    return [...this.eventHistory];
  }

  evaluateTriggers(worldState: WorldState): MacroEvent[] {
    const triggeredEvents: MacroEvent[] = [];

    for (const trigger of this.triggers.values()) {
      if (this.rng.nextInt(0, 100) / 100 <= trigger.probability) {
        const eventType: MacroEventType = Array.from(this.triggers.keys())[
          this.rng.nextInt(0, this.triggers.size - 1)
        ].replace('_trigger', '') as MacroEventType;

        const event = this.triggerMacroEvent(
          eventType,
          `Auto-triggered ${eventType}`,
          `An event of type ${eventType} has occurred.`,
          worldState.locations?.map((l: Location) => l.id) || [],
          [],
          this.rng.nextInt(30, 80)
        );

        triggeredEvents.push(event);
      }
    }

    return triggeredEvents;
  }

  clearActiveEvents(): void {
    this.activeEvents.clear();
  }

  reset(): void {
    this.activeEvents.clear();
    this.eventHistory = [];
  }
}

let macroEventEngineInstance: MacroEventEngine | null = null;

export function getMacroEventEngine(seed: number = 12345): MacroEventEngine {
  if (!macroEventEngineInstance) {
    macroEventEngineInstance = new MacroEventEngine(seed);
  }
  return macroEventEngineInstance;
}

export function resetMacroEventEngine(): void {
  if (macroEventEngineInstance) {
    macroEventEngineInstance.reset();
    macroEventEngineInstance = null;
  }
}

export const MacroEventEngineExports = {
  getMacroEventEngine,
  resetMacroEventEngine
};
