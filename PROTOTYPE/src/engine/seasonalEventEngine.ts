/**
 * seasonalEventEngine.ts - Phase 30 Task 4: Seasonal Event Engine
 * 
 * Manages time-tracked seasonal events, faction holidays, and their effects.
 * Enables Oracle governance for coordinating events across multiplayer sessions.
 */

export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  eventType: 'faction_holiday' | 'natural_phenomenon' | 'catastrophe' | 'celebration' | 'ritual';
  season: 'winter' | 'spring' | 'summer' | 'autumn' | null;  // null = any season
  startDay: number;  // 1-100 (world days)
  endDay: number;
  affectedFactions?: string[];  // Factions involved (empty = world-wide)
  effects: EventEffect[];
  isActive: boolean;
  triggerDate?: number; // Tick when event triggers globally
}

export interface EventEffect {
  type: 'dialogue_override' | 'merchant_discount' | 'quest_unlock' | 'cosmetic_change' | 'dialogue_theme' | 'atmosphere_shift';
  targetType: 'npc' | 'location' | 'merchant' | 'quest' | 'world';
  magnitude: number;  // 0-100 scale
  description: string;
  data?: Record<string, unknown>;  // Effect-specific data
}

export interface ActiveSeasonalEvent {
  event: SeasonalEvent;
  activatedAt: number;  // Tick when activated
  expiresAt: number;    // Tick when expires
  affectedPlayers?: string[];  // Player IDs affected (for oracle coordination)
}

export interface FactionHoliday extends SeasonalEvent {
  eventType: 'faction_holiday';
  factionId: string;
  holidayTradition: string;  // "Festival", "Remembrance", "Coronation", etc.
  npcGatherings?: string[];  // Location IDs where NPCs gather
}

export interface SeasonalEventEngine {
  allEvents: SeasonalEvent[];
  activeEvents: Map<string, ActiveSeasonalEvent>;
  eventHistory: Array<{ eventId: string; activatedAt: number; endedAt?: number }>;
}

/**
 * Create a new Seasonal Event Engine
 */
export function createSeasonalEventEngine(): SeasonalEventEngine {
  return {
    allEvents: [],
    activeEvents: new Map(),
    eventHistory: []
  };
}

/**
 * Generate default seasonal events for M60 Beta / Phase 30
 * Includes faction holidays, natural phenomena, and world events
 */
export function generateDefaultSeasonalEvents(): SeasonalEvent[] {
  return [
    // Festival of Lux-Ar (Light Faction celebration)
    {
      id: 'festival_lux_ar',
      name: 'Festival of Lux-Ar',
      description: 'The Light Faction celebrates the alignment of the twin stars',
      eventType: 'faction_holiday',
      season: 'spring',
      startDay: 20,
      endDay: 30,
      affectedFactions: ['light_faction'],
      effects: [
        {
          type: 'dialogue_override',
          targetType: 'npc',
          magnitude: 50,
          description: 'NPCs discuss the beauty and hope of the festival',
          data: { theme: 'celebratory', toneShift: 'optimistic' }
        },
        {
          type: 'merchant_discount',
          targetType: 'merchant',
          magnitude: 25,
          description: 'Light Faction merchants offer 25% discount on holy artifacts',
          data: { discountPercent: 25, itemCategories: ['holy_artifact', 'blessed_item'] }
        },
        {
          type: 'quest_unlock',
          targetType: 'quest',
          magnitude: 0,
          description: 'Light Cleanse quests become available',
          data: { questType: 'light_cleanse', maxAvailable: 3 }
        },
        {
          type: 'atmosphere_shift',
          targetType: 'world',
          magnitude: 60,
          description: 'Sky glows with auroral lights. World feels more hopeful.',
          data: { lightLevel: 1.2, ambience: 'ethereal_glow' }
        }
      ],
      isActive: false
    },

    // Shadow's Eve (Dark Faction celebration)
    {
      id: 'shadows_eve',
      name: "Shadow's Eve",
      description: 'The Dark Faction honors the void and cosmic balance',
      eventType: 'faction_holiday',
      season: 'autumn',
      startDay: 75,
      endDay: 85,
      affectedFactions: ['dark_faction'],
      effects: [
        {
          type: 'dialogue_override',
          targetType: 'npc',
          magnitude: 50,
          description: 'NPCs speak of mystery, secrets, and the beauty of shadow',
          data: { theme: 'mysterious', toneShift: 'ominous_but_fair' }
        },
        {
          type: 'merchant_discount',
          targetType: 'merchant',
          magnitude: 30,
          description: 'Dark Faction merchants offer rare shadow artifacts',
          data: { discountPercent: 30, itemCategories: ['shadow_artifact', 'void_rune'] }
        },
        {
          type: 'quest_unlock',
          targetType: 'quest',
          magnitude: 0,
          description: 'Darkness Embrace quests become available',
          data: { questType: 'darkness_embrace', maxAvailable: 3 }
        },
        {
          type: 'atmosphere_shift',
          targetType: 'world',
          magnitude: 70,
          description: 'The sun sets early. Stars shine brighter. World feels introspective.',
          data: { lightLevel: 0.7, ambience: 'starlit_reflection' }
        }
      ],
      isActive: false
    },

    // Seasons Turning (Universal event - happens at season transitions)
    {
      id: 'seasons_turning',
      name: 'Seasons Turning',
      description: 'The natural world shifts and transforms',
      eventType: 'natural_phenomenon',
      season: null,  // All seasons
      startDay: 25,  // Happens every season change day
      endDay: 32,
      effects: [
        {
          type: 'atmosphere_shift',
          targetType: 'world',
          magnitude: 80,
          description: 'Flora and fauna transform. Weather becomes unpredictable.',
          data: { weatherVariability: 1.5, biomeDiversity: 1.3 }
        },
        {
          type: 'dialogue_theme',
          targetType: 'npc',
          magnitude: 40,
          description: 'NPCs comment on the seasonal change and renewal',
          data: { theme: 'renewal', keywords: ['season', 'cycle', 'transformation'] }
        },
        {
          type: 'quest_unlock',
          targetType: 'quest',
          magnitude: 0,
          description: 'Seasonal Harvest and Sowing quests become available',
          data: { questType: 'seasonal_adaptation', maxAvailable: 5 }
        }
      ],
      isActive: false
    },

    // Bloodmoon Rising (Ominous event)
    {
      id: 'bloodmoon_rising',
      name: 'Bloodmoon Rising',
      description: 'A crimson moon rises. Danger stirs in the world.',
      eventType: 'catastrophe',
      season: 'winter',
      startDay: 60,
      endDay: 65,
      effects: [
        {
          type: 'atmosphere_shift',
          targetType: 'world',
          magnitude: 90,
          description: 'The sky turns blood red. An ominous presence looms.',
          data: { lightLevel: 0.8, skyColor: 'crimson', tension: 1.5 }
        },
        {
          type: 'dialogue_override',
          targetType: 'npc',
          magnitude: 70,
          description: 'NPCs express fear, dread, or mystical anticipation',
          data: { theme: 'ominous', toneShift: 'fearful_and_mystical' }
        },
        {
          type: 'quest_unlock',
          targetType: 'quest',
          magnitude: 0,
          description: 'Dangerous hunts and apocalyptic quests unlock',
          data: { questType: 'bloodmoon_hunt', maxAvailable: 2, difficulty: 'legendary' }
        },
        {
          type: 'cosmetic_change',
          targetType: 'world',
          magnitude: 100,
          description: 'Special cosmetics: blood-stained snow, crimson fog, ominous sounds',
          data: { skyParticles: 'crimson_motes', groundFX: 'bloodied_snow', audio: 'eerie_wind' }
        }
      ],
      isActive: false
    },

    // Starfall Night (Romantic/Magical event)
    {
      id: 'starfall_night',
      name: 'Starfall Night',
      description: 'Stars fall gently from the sky, blessing the world with wishes',
      eventType: 'celebration',
      season: 'summer',
      startDay: 50,
      endDay: 52,
      effects: [
        {
          type: 'atmosphere_shift',
          targetType: 'world',
          magnitude: 85,
          description: 'Shooting stars streaking across the sky. Magical aura everywhere.',
          data: { lightLevel: 1.1, skyParticles: 'falling_stars', ambience: 'magical' }
        },
        {
          type: 'dialogue_override',
          targetType: 'npc',
          magnitude: 60,
          description: 'NPCs make wishes and discuss dreams coming true',
          data: { theme: 'hopeful_and_dreamy', toneShift: 'whimsical' }
        },
        {
          type: 'merchant_discount',
          targetType: 'merchant',
          magnitude: 20,
          description: 'All merchants offer special prices on wish-granting items',
          data: { discountPercent: 20, itemCategories: ['wish', 'charm', 'blessing'] }
        },
        {
          type: 'cosmetic_change',
          targetType: 'world',
          magnitude: 80,
          description: 'Beautiful visual effects: falling stars, glowing flowers, ethereal light',
          data: { visualFX: 'starfall_cascade', flowerGlow: true, musicShift: 'celestial' }
        }
      ],
      isActive: false
    },

    // Founder's Day (Neutral celebration - honors founding of civilization)
    {
      id: 'founders_day',
      name: "Founder's Day",
      description: 'The world celebrates its founding and the first of the ancestors',
      eventType: 'celebration',
      season: null,
      startDay: 1,
      endDay: 5,
      effects: [
        {
          type: 'dialogue_override',
          targetType: 'npc',
          magnitude: 50,
          description: 'NPCs honor the founders and reminisce about history',
          data: { theme: 'commemorative', toneShift: 'reverent' }
        },
        {
          type: 'quest_unlock',
          targetType: 'quest',
          magnitude: 0,
          description: 'Historical pilgrimage quests become available',
          data: { questType: 'founder_pilgrimage', maxAvailable: 3 }
        },
        {
          type: 'merchant_discount',
          targetType: 'merchant',
          magnitude: 15,
          description: 'Merchants offer discount on historical artifacts and relics',
          data: { discountPercent: 15, itemCategories: ['artifact', 'relic', 'heirloom'] }
        }
      ],
      isActive: false
    }
  ];
}

/**
 * Check if a seasonal event should be active based on current world time
 * 
 * @param event - Event to check
 * @param currentDay - Current day of year (1-100)
 * @param currentSeason - Current season
 * @returns Whether the event should be active
 */
export function shouldEventBeActive(
  event: SeasonalEvent,
  currentDay: number,
  currentSeason: string
): boolean {
  // Check season match
  if (event.season !== null && event.season !== currentSeason) {
    return false;
  }

  // Check day range
  if (currentDay >= event.startDay && currentDay <= event.endDay) {
    return true;
  }

  return false;
}

/**
 * Activate a seasonal event in the engine
 * 
 * @param engine - Seasonal Event Engine
 * @param event - Event to activate
 * @param currentTick - Current world tick
 * @param durationTicks - How long event lasts (default: until endDay)
 * @returns Active event
 */
export function activateEvent(
  engine: SeasonalEventEngine,
  event: SeasonalEvent,
  currentTick: number,
  durationTicks: number = 24 * 60  // Default: 1 day worth of ticks
): ActiveSeasonalEvent {
  const activeEvent: ActiveSeasonalEvent = {
    event,
    activatedAt: currentTick,
    expiresAt: currentTick + durationTicks,
    affectedPlayers: []
  };

  engine.activeEvents.set(event.id, activeEvent);
  event.isActive = true;
  event.triggerDate = currentTick;

  engine.eventHistory.push({
    eventId: event.id,
    activatedAt: currentTick
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[SeasonalEventEngine] Activated ${event.name} (${event.id})`);
  }

  return activeEvent;
}

/**
 * Deactivate a seasonal event
 * 
 * @param engine - Seasonal Event Engine
 * @param eventId - ID of event to deactivate
 * @param currentTick - Current tick
 */
export function deactivateEvent(
  engine: SeasonalEventEngine,
  eventId: string,
  currentTick: number
): void {
  const activeEvent = engine.activeEvents.get(eventId);
  if (!activeEvent) return;

  activeEvent.event.isActive = false;
  engine.activeEvents.delete(eventId);

  // Record in history
  const historyEntry = engine.eventHistory.find(e => e.eventId === eventId);
  if (historyEntry) {
    historyEntry.endedAt = currentTick;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[SeasonalEventEngine] Deactivated ${activeEvent.event.name} (${eventId})`);
  }
}

/**
 * Update seasonal events based on world time
 * Called every tick or periodically to check if events should activate/deactivate
 * 
 * @param engine - Seasonal Event Engine
 * @param currentDay - Current day (1-100)
 * @param currentSeason - Current season
 * @param currentTick - Current world tick
 */
export function updateSeasonalEvents(
  engine: SeasonalEventEngine,
  currentDay: number,
  currentSeason: string,
  currentTick: number
): void {
  // Check all events to see if they should be active
  engine.allEvents.forEach(event => {
    const shouldBeActive = shouldEventBeActive(event, currentDay, currentSeason);
    const isCurrentlyActive = engine.activeEvents.has(event.id);

    if (shouldBeActive && !isCurrentlyActive) {
      activateEvent(engine, event, currentTick);
    } else if (!shouldBeActive && isCurrentlyActive) {
      deactivateEvent(engine, event.id, currentTick);
    }
  });

  // Clean up expired events
  const expiredEventIds: string[] = [];
  engine.activeEvents.forEach((activeEvent, eventId) => {
    if (currentTick >= activeEvent.expiresAt) {
      expiredEventIds.push(eventId);
    }
  });

  expiredEventIds.forEach(eventId => {
    deactivateEvent(engine, eventId, currentTick);
  });
}

/**
 * Get all currently active seasonal events
 */
export function getActiveEvents(engine: SeasonalEventEngine): ActiveSeasonalEvent[] {
  return Array.from(engine.activeEvents.values());
}

/**
 * Get event effects for a specific target type
 */
export function getEventEffects(
  engine: SeasonalEventEngine,
  effectType: EventEffect['type'],
  targetType: EventEffect['targetType']
): EventEffect[] {
  const effects: EventEffect[] = [];

  engine.activeEvents.forEach(activeEvent => {
    activeEvent.event.effects.forEach(effect => {
      if (effect.type === effectType && effect.targetType === targetType) {
        effects.push(effect);
      }
    });
  });

  return effects;
}

/**
 * Calculate composite merchant discount from all active events
 * 
 * @param engine - Seasonal Event Engine
 * @param itemCategory - Item category to check
 * @returns Discount percentage (0-100)
 */
export function calculateEventDiscount(
  engine: SeasonalEventEngine,
  itemCategory: string
): number {
  let totalDiscount = 0;

  engine.activeEvents.forEach(activeEvent => {
    activeEvent.event.effects.forEach(effect => {
      if (effect.type === 'merchant_discount' && 
          effect.data?.itemCategories?.includes(itemCategory)) {
        totalDiscount += effect.magnitude;
      }
    });
  });

  return Math.min(100, totalDiscount);  // Cap at 100%
}

/**
 * Register a player as affected by a seasonal event
 * Used for oracle coordination of multi-player events
 */
export function registerPlayerForEvent(
  engine: SeasonalEventEngine,
  eventId: string,
  playerId: string
): void {
  const activeEvent = engine.activeEvents.get(eventId);
  if (!activeEvent) return;

  if (!activeEvent.affectedPlayers) {
    activeEvent.affectedPlayers = [];
  }

  if (!activeEvent.affectedPlayers.includes(playerId)) {
    activeEvent.affectedPlayers.push(playerId);
  }
}

/**
 * Export seasonal engine state for serialization
 */
export function serializeSeasonalEngine(engine: SeasonalEventEngine): string {
  const serializable = {
    allEvents: engine.allEvents,
    activeEvents: Array.from(engine.activeEvents.entries()),
    eventHistory: engine.eventHistory
  };
  return JSON.stringify(serializable);
}

/**
 * Import seasonal engine state from serialization
 */
export function deserializeSeasonalEngine(json: string): SeasonalEventEngine {
  const data = JSON.parse(json);
  const engine = createSeasonalEventEngine();
  
  engine.allEvents = data.allEvents || [];
  engine.activeEvents = new Map(data.activeEvents || []);
  engine.eventHistory = data.eventHistory || [];
  
  return engine;
}

let _seasonalEventEngine: SeasonalEventEngine | null = null;

/**
 * Get or create the global seasonal event engine singleton
 */
export function getSeasonalEventEngine(): SeasonalEventEngine {
  if (!_seasonalEventEngine) {
    _seasonalEventEngine = createSeasonalEventEngine();
    _seasonalEventEngine.allEvents = generateDefaultSeasonalEvents();
  }
  return _seasonalEventEngine;
}

/**
 * Reset the seasonal event engine
 */
export function resetSeasonalEventEngine(): void {
  _seasonalEventEngine = null;
}
