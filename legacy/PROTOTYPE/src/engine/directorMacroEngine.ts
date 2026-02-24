/**
 * M44-B1: Director Macro Engine - Faction Override & World Events
 * M44-C2: Added Custom Macro Template Registry & Narrative Propagation
 * 
 * Handles high-level Director Macro Commands that override simulation mechanics:
 * - Force faction dominance at locations (ignoring 85% cap)
 * - Trigger global narrative events with NPC memory propagation
 * - Create faction-wide consequences that ripple through the world
 * - M44-C2: Support custom JSON-defined event templates with narrative fields
 */

import { getNpcMemoryEngine } from './npcMemoryEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import type { WorldState } from './worldEngine';

/**
 * M44-C2: Custom macro template definition
 */
export interface MacroTemplate {
  id: string;
  name: string;
  eventType: 'faction_incursion' | 'cataclysm' | 'truce' | 'uprising' | 'invasion' | string; // Allow arbitrary types
  narrativeFields: {
    directorNarrative: string; // What the director sees
    npcMemoryMessage: string; // What NPCs remember
    playerNotification?: string; // What player is told
    allyNarrativeVariant?: string; // Alternate narrative for allies
    rivalNarrativeVariant?: string; // Alternate narrative for rivals
  };
  defaultDuration?: number;
  defaultInfluenceOverride?: number;
  metadata?: Record<string, any>;
}

/**
 * M44-C2: Registry for custom macro templates
 */
class MacroTemplateRegistry {
  private templates: Map<string, MacroTemplate> = new Map();
  private byEventType: Map<string, string[]> = new Map(); // eventType -> template IDs

  /**
   * Register a new template
   */
  registerTemplate(template: MacroTemplate): boolean {
    if (this.templates.has(template.id)) {
      console.warn(`[MacroTemplateRegistry] Template ${template.id} already exists`);
      return false;
    }

    this.templates.set(template.id, template);

    // Index by event type
    if (!this.byEventType.has(template.eventType)) {
      this.byEventType.set(template.eventType, []);
    }
    this.byEventType.get(template.eventType)!.push(template.id);

    return true;
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): MacroTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all templates for an event type
   */
  getTemplatesByEventType(eventType: string): MacroTemplate[] {
    const ids = this.byEventType.get(eventType) || [];
    return ids.map(id => this.templates.get(id)!).filter(t => t !== undefined);
  }

  /**
   * Get all registered templates
   */
  getAllTemplates(): MacroTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Remove a template
   */
  removeTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) return false;

    this.templates.delete(templateId);

    const eventTypeTemplates = this.byEventType.get(template.eventType);
    if (eventTypeTemplates) {
      const idx = eventTypeTemplates.indexOf(templateId);
      if (idx !== -1) {
        eventTypeTemplates.splice(idx, 1);
      }
    }

    return true;
  }
}

// Global singleton registry

export interface MacroEvent {
  id: string;
  type: 'faction_incursion' | 'cataclysm' | 'truce' | 'uprising' | 'invasion';
  triggeredBy: string; // Director ID or system
  timestamp: number; // world tick
  affectedLocations: string[];
  targetFactionId: string;
  durationTicks: number;
  narrative: string;
  npcMemoryMessage: string; // What NPCs remember about this
  influenceOverride?: number; // Set faction to this influence level (0-1)
}

export interface MacroEventEffect {
  locationId: string;
  previousDominant: string | null;
  newDominant: string;
  influenceShift: number;
  affectedNpcs: number;
}

class DirectorMacroEngine {
  private activeEvents: Map<string, MacroEvent> = new Map();
  private eventHistory: MacroEvent[] = [];
  private effects: Map<string, MacroEventEffect[]> = new Map();
  private templateRegistry: MacroTemplateRegistry;

  constructor() {
    this.templateRegistry = new MacroTemplateRegistry();
    this.initializeDefaultTemplates();
  }

  /**
   * M44-C2: Initialize with default templates
   */
  private initializeDefaultTemplates(): void {
    // Register default templates
    const defaultTemplates: MacroTemplate[] = [
      {
        id: 'default_faction_incursion',
        name: 'Faction Incursion',
        eventType: 'faction_incursion',
        narrativeFields: {
          directorNarrative: 'The {FACTION} has launched an incursion into the region.',
          npcMemoryMessage: 'The {FACTION} invaded, seizing territory and resources.',
          playerNotification: 'An enemy faction has begun invading nearby territories!',
        },
        defaultDuration: 5000,
        defaultInfluenceOverride: 0.85,
      },
      {
        id: 'default_cataclysm',
        name: 'Cataclysm Event',
        eventType: 'cataclysm',
        narrativeFields: {
          directorNarrative: 'A cataclysmic event has devastated the land. The {FACTION} rises to dominance.',
          npcMemoryMessage: 'In the chaos, the {FACTION} seized power.',
          playerNotification: 'Disaster strikes! All factions scramble for survival.',
          allyNarrativeVariant: 'Our allies in the {FACTION} protected us during the chaos.',
          rivalNarrativeVariant: 'The {FACTION} used the chaos to betray us.',
        },
        defaultDuration: 7000,
        defaultInfluenceOverride: 0.85,
      },
      {
        id: 'default_truce',
        name: 'Faction Truce',
        eventType: 'truce',
        narrativeFields: {
          directorNarrative: 'A fragile truce has been brokered. All factions retreat to neutral positions.',
          npcMemoryMessage: 'Peace accords were signed. Factions withdrew their forces.',
          playerNotification: 'An unexpected peace has fallen over the land.',
        },
        defaultDuration: 10000,
        defaultInfluenceOverride: 0.5,
      },
    ];

    for (const template of defaultTemplates) {
      this.templateRegistry.registerTemplate(template);
    }
  }

  /**
   * M44-C2: Register a custom template at runtime
   */
  registerMacroTemplate(template: MacroTemplate): boolean {
    return this.templateRegistry.registerTemplate(template);
  }

  /**
   * M44-C2: Get template registry for queries
   */
  getTemplateRegistry(): MacroTemplateRegistry {
    return this.templateRegistry;
  }

  /**
   * Spawn a macro event that forcibly shifts faction dominance
   * and propagates through NPC memory
   * M44-C2: Now uses custom template registry
   */
  spawnMacroEvent(
    eventType: 'faction_incursion' | 'cataclysm' | 'truce' | 'uprising' | 'invasion' | string,
    worldState: WorldState,
    targetFactionId: string,
    locationIds: string[],
    durationTicks: number = 5000,
    narrative?: string,
    influenceOverride?: number,
    templateId?: string
  ): MacroEvent {
    const tick = worldState.tick || 0;
    const eventId = `macro_${eventType}_${tick}_${targetFactionId}`;

    // M44-C2: Try to use custom template if provided
    let narrativeContent = { narrative: '', memoryMessage: '' };
    if (templateId) {
      const template = this.templateRegistry.getTemplate(templateId);
      if (template) {
        const directorNarrative = template.narrativeFields.directorNarrative.replace('{FACTION}', targetFactionId);
        const npcMemory = template.narrativeFields.npcMemoryMessage.replace('{FACTION}', targetFactionId);
        narrativeContent = { narrative: directorNarrative, memoryMessage: npcMemory };
        durationTicks = durationTicks || template.defaultDuration || 5000;
        influenceOverride = influenceOverride !== undefined ? influenceOverride : template.defaultInfluenceOverride;
      }
    }

    // Fall back to hardcoded templates if no custom template
    if (!narrativeContent.narrative) {
      const templates: Record<string, { narrative: string; memoryMessage: string }> = {
        faction_incursion: {
          narrative: `The ${targetFactionId} has launched an incursion into the region.`,
          memoryMessage: `The ${targetFactionId} invaded, seizing territory and resources.`,
        },
        cataclysm: {
          narrative: `A cataclysmic event has devastated the land. The ${targetFactionId} rises to dominance.`,
          memoryMessage: `In the chaos, the ${targetFactionId} seized power.`,
        },
        truce: {
          narrative: `A fragile truce has been brokered. All factions retreat to neutral positions.`,
          memoryMessage: `Peace accords were signed. Factions withdrew their forces.`,
        },
        uprising: {
          narrative: `A popular uprising has shattered the old order. The ${targetFactionId} leads the rebellion.`,
          memoryMessage: `The people rose up, and the ${targetFactionId} seized the opportunity.`,
        },
        invasion: {
          narrative: `A foreign invasion force sweeps across the land. The ${targetFactionId} claims total dominion.`,
          memoryMessage: `Invaders conquered us all. The ${targetFactionId} now rules with an iron fist.`,
        },
      };

      const template = templates[eventType as string];
      narrativeContent = template || templates['faction_incursion'];
    }

    const event: MacroEvent = {
      id: eventId,
      type: eventType as any,
      triggeredBy: 'DIRECTOR_COMMAND',
      timestamp: tick,
      affectedLocations: locationIds,
      targetFactionId,
      durationTicks,
      narrative: narrative || narrativeContent.narrative,
      npcMemoryMessage: narrativeContent.memoryMessage,
      influenceOverride,
    };

    this.activeEvents.set(eventId, event);
    this.eventHistory.push(event);

    // Apply immediate effects to faction warfare
    this.applyMacroEventEffects(event, worldState);

    // Propagate to all NPC memories
    this.propagateToNpcMemory(event, worldState);

    return event;
  }

  /**
   * Apply macro event effects to faction warfare engine
   */
  private applyMacroEventEffects(event: MacroEvent, worldState: WorldState): void {
    const factionEngine = getFactionWarfareEngine();
    const effects: MacroEventEffect[] = [];

    for (const locationId of event.affectedLocations) {
      const influence = factionEngine.getOrCreateLocationInfluence(locationId);

      const effect: MacroEventEffect = {
        locationId,
        previousDominant: influence.dominantFactionId,
        newDominant: event.targetFactionId,
        influenceShift: (event.influenceOverride ?? 0.85) - (influence.factionInfluenceMap.get(event.targetFactionId) || 0),
        affectedNpcs: (worldState.npcs || []).filter((npc) => npc.locationId === locationId).length,
      };

      // Apply influence change
      if (event.influenceOverride !== undefined) {
        // Set to exact override level
        influence.factionInfluenceMap.set(event.targetFactionId, Math.min(1.0, event.influenceOverride));
      } else {
        // Default: 85% dominance
        influence.factionInfluenceMap.set(event.targetFactionId, 0.85);
      }

      // Update dominant faction
      influence.dominantFactionId = event.targetFactionId;

      effects.push(effect);
    }

    this.effects.set(event.id, effects);
  }

  /**
   * Propagate macro event to all NPC memories as a traumatic or momentous event
   * M44-C1: Uses universal interaction format
   */
  private propagateToNpcMemory(event: MacroEvent, worldState: WorldState): void {
    const npcMemoryEngine = getNpcMemoryEngine();

    // Find NPCs in affected locations
    for (const location of worldState.locations || []) {
      if (event.affectedLocations.includes(location.id)) {
        const npcsInLocation = (worldState.npcs || []).filter(
          (npc) => npc.locationId === location.id
        );

        // Record interaction with all NPCs
        for (const npc of npcsInLocation) {
          const sentiment = event.type === 'truce' ? 0.5 : event.type === 'cataclysm' ? -0.8 : -0.5;
          const impact = 0.9; // Macro events are high-impact

          npcMemoryEngine.recordInteraction(
            npc.id,
            'system', // "system" as subject for macro events
            'npc', // treated as NPC-system interaction
            `witness_${event.type}`,
            sentiment,
            impact,
            event.npcMemoryMessage,
            event.timestamp
          );
        }
      }
    }
  }

  /**
   * Decay macro event effects (gradually revert influence toward normal)
   */
  decayMacroEvents(worldState: WorldState, tick: number, deltaTime: number): void {
    const itemsToRemove: string[] = [];

    for (const [eventId, event] of this.activeEvents.entries()) {
      const elapsedTicks = tick - event.timestamp;

      if (elapsedTicks > event.durationTicks) {
        // Event expired - remove it
        itemsToRemove.push(eventId);

        // Gradually revert faction influence back to natural levels
        const factionEngine = getFactionWarfareEngine();
        for (const locationId of event.affectedLocations) {
          const influence = factionEngine.getOrCreateLocationInfluence(locationId);
          // Revert 5% influence per tick after expiry
          const currentInfluence = influence.factionInfluenceMap.get(event.targetFactionId) || 0.85;
          influence.factionInfluenceMap.set(
            event.targetFactionId,
            Math.max(0.2, currentInfluence - 0.05 * deltaTime)
          );
        }
      }
    }

    // Remove expired events
    for (const eventId of itemsToRemove) {
      this.activeEvents.delete(eventId);
    }
  }

  /**
   * Get all currently active macro events
   */
  getActiveEvents(): MacroEvent[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Get effects of a specific macro event
   */
  getEventEffects(eventId: string): MacroEventEffect[] {
    return this.effects.get(eventId) || [];
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 50): MacroEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Check if a location is currently under a macro event override
   */
  isLocationUnderMacroEvent(locationId: string, tick: number): MacroEvent | null {
    for (const event of this.activeEvents.values()) {
      if (
        event.affectedLocations.includes(locationId) &&
        tick - event.timestamp < event.durationTicks
      ) {
        return event;
      }
    }
    return null;
  }

  /**
   * Export macro engine state for serialization
   */
  exportState(): object {
    return {
      activeEventCount: this.activeEvents.size,
      historyCount: this.eventHistory.length,
      activeEvents: Array.from(this.activeEvents.values()).map((e) => ({
        id: e.id,
        type: e.type,
        targetFaction: e.targetFactionId,
        affectedLocations: e.affectedLocations.length,
      })),
      recentEvents: this.eventHistory.slice(-5).map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
      })),
    };
  }

  /**
   * Clear all macro events (for testing/reset)
   */
  clearState(): void {
    this.activeEvents.clear();
    this.eventHistory = [];
    this.effects.clear();
  }
}

// Singleton instance
let instance: DirectorMacroEngine | null = null;

export function getDirectorMacroEngine(): DirectorMacroEngine {
  if (!instance) {
    instance = new DirectorMacroEngine();
  }
  return instance;
}
