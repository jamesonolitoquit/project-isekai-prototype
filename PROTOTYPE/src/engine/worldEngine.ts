import { Event, appendEvent, getEventsForWorld } from "../events/mutationLog";
import CJ, { summarizeStateMinimal } from "./canonJournal";
import { rebuildState } from "./stateRebuilder";
import { validateInvariants, isStatePlayable } from "./constraintValidator";
import { SeededRng, setGlobalRng, getGlobalRng } from "./prng";
import { processAction, Action } from "./actionPipeline";
import { authorizeAction, AuthorizationContext } from "./authorization/authorizeAction";
import { createSave, loadSave, verifySaveIntegrity } from "./saveLoadEngine";
import { resolveNpcLocation, updateNpcLocations, applyLocationUpdates } from "./scheduleEngine";
import { resolveWeather, getWeatherVisuals } from "./weatherEngine";
import { resolveNpcTurns } from './aiTacticEngine';
import { checkLocationHazards, applyHazardDamage, applyHazardStatus } from "./hazardEngine";
import { resolveSeason } from './seasonEngine';
import { Faction, FactionRelationship, FactionConflict, initializeFactions, initializeFactionRelationships } from './factionEngine';
import { Relic, RunicSlot } from './artifactEngine';
import templateJson from '../data/luxfier-world.json';
import schemaJson from '../data/luxfier-world.schema.json';

// Attempt to load a world template JSON. If unavailable, fall back to hardcoded default.
let WORLD_TEMPLATE: any = null;
try {
  const maybe = templateJson;
  // validate against schema if possible
  let valid = true;
  try {
    // const Ajv = require('ajv');
    // const ajv = new Ajv({ allErrors: true, strict: false });
    // const schema = schemaJson;
    // const validate = ajv.compile(schema);
    // valid = validate(maybe);
    // if (!valid) {
    //   // eslint-disable-next-line no-console
    //   console.error('[worldEngine] World template validation errors:', validate.errors);
    // }
  } catch (error_) {
    // if ajv isn't available or validation fails to run, continue but log
    // eslint-disable-next-line no-console
    console.warn('[worldEngine] Template validation skipped (ajv not available or error)', error_);
  }
  if (valid) {
    WORLD_TEMPLATE = maybe;
    // eslint-disable-next-line no-console
    console.log('[worldEngine] Loaded and validated world template from src/data/luxfier-world.json');
  } else {
    // eslint-disable-next-line no-console
    console.error('[worldEngine] Template invalid — falling back to built-in defaults');
    WORLD_TEMPLATE = null;
  }
} catch (error_) {
  // eslint-disable-next-line no-console
  console.warn('[worldEngine] No external world template found, using built-in defaults', error_);
  WORLD_TEMPLATE = null;
}

export type Location = { id: string; name: string; conditionalSeason?: string; description?: string };
export type PersonalityType = 'aggressive' | 'cautious' | 'tactical' | 'healer' | 'balanced';
export type NpcPersonality = {
  type: PersonalityType;
  attackThreshold: number;
  defendThreshold: number;
  riskTolerance: number;
};
export type NPC = { 
  id: string; 
  name: string; 
  locationId: string; 
  questId?: string; 
  dialogue?: any[]; 
  availability?: { startHour?: number; endHour?: number }; 
  routine?: Record<string, string>; 
  stats?: any; 
  hp?: number; 
  maxHp?: number; 
  reputationRequired?: Record<string, number>; 
  statusEffects?: string[]; 
  personality?: NpcPersonality;
  factionId?: string; // Phase 11: NPC faction affiliation
  factionRole?: string; // e.g., 'leader', 'soldier', 'informant'
};
export type CombatState = {
  active: boolean;
  participants: string[];
  turnIndex: number;
  roundNumber: number;
  log: string[];
  initiator: string;
};
export type QuestObjective = { 
  type: "visit" | "combat" | "exploration" | "challenge" | "gather" | "craft"; 
  location?: string;
  target?: string;
  quantity?: number;
  timeConstraints?: { startHour?: number; endHour?: number };
};
export type Quest = { 
  id: string; 
  title: string; 
  description?: string; 
  objectives?: QuestObjective[];
  objective?: QuestObjective;
  dependencies?: string[]; 
  rewards?: any; 
  expiresInHours?: number;
  currentObjectiveIndex?: number;
  gatedReward?: { location?: string; access?: boolean };
};

export type ResourceNode = {
  id: string;
  lootTableId: string;
  locationId: string;
  depletedAt?: number; // Tick when depleted; null = available
  regeneratesInHours: number;
};

export type WorldEvent = {
  id: string;
  name: string;
  type: "climate-change" | "market-closure" | "monster-infestation" | "festival" | "disaster";
  activeFrom: number; // tick
  activeTo: number; // tick
  effects: {
    locationLocked?: string[];
    itemPriceMultiplier?: number;
    npcDialogueOverride?: Record<string, string[]>;
  };
  trigger?: {
    type: "random" | "scheduled" | "condition";
    season?: string;
    dayPhase?: string;
    chance?: number;
  };
};

export type PlayerQuestState = { status: "not_started" | "in_progress" | "completed" | "failed"; startedAt?: number; completedAt?: number; expiresAt?: number; currentObjectiveIndex?: number };

// Phase 14.5: Discriminated union for inventory items
export type StackableItem = {
  kind: 'stackable';
  itemId: string;
  quantity: number;
  equipped?: boolean;
};

export type UniqueItem = {
  kind: 'unique';
  itemId: string;
  instanceId: string; // Unique per weapon/relicable item
  equipped?: boolean;
  metadata?: {
    experience?: number;      // Phase 15: XP accumulated on this item
    sentience?: number;        // Phase 15: Personality/sapience level (0-100)
    runes?: string[];          // Phase 15: IDs of installed runes
    corruption?: number;       // Phase 15: Paradox corruption (0-100)
    infusions?: Array<{ runeId: string; timestamp: number }>; // Phase 15: Fusion history
  };
};

export type InventoryItem = StackableItem | UniqueItem;

export type EquipmentSlots = {
  head?: string;
  chest?: string;
  mainHand?: string;
  offHand?: string;
  feet?: string;
  accessory?: string;
};

export type BeliefLayer = {
  npcLocations: Record<string, string>; // NPC ID -> believed location
  npcStats: Record<string, Partial<any>>; // NPC ID -> believed stats
  facts: Record<string, boolean>; // Fact ID -> believed or not
  suspicionLevel: number; // Accumulates when player acts on false info
};

export type PlayerState = {
  id: string;
  location: string;
  quests: Record<string, PlayerQuestState>;
  dialogueHistory?: { npcId: string; text: string; timestamp: number; options?: { id: string; text: string }[] }[];
  npcDialogueIndex?: Record<string, number>;
  gold?: number;
  experience?: number;
  xp?: number;
  level?: number;
  attributePoints?: number;
  reputation?: Record<string, number>;
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  statusEffects?: string[];
  stats?: {
    str: number;
    agi: number;
    int: number;
    cha: number;
    end: number;
    luk: number;
  };
  inventory?: InventoryItem[];
  equipment?: EquipmentSlots;
  knowledgeBase?: Set<string>; // IDs of known entities (npc:ID, item:ID, location:ID)
  visitedLocations?: Set<string>; // Locations player has discovered
  beliefLayer?: BeliefLayer; // Tracks false beliefs and suspicion
  factionReputation?: Record<string, number>; // Phase 11: Reputation with each faction (-100 to +100)
  temporalDebt?: number; // Phase 12: Accumulated from save-scumming/rewinding (0-100)
  lastSaveTick?: number; // Phase 12: Track tick at last save for rewind detection
  soulStrain?: number; // Phase 13: Accumulated from morphing transformations (0-100)
  currentRace?: string; // Phase 13: Player's current race (for morphing system)
  lastMorphTick?: number; // Phase 13: Tick when last morph occurred
  recentMorphCount?: number; // Phase 13: Morphs in recent window (for cooldown multiplier)
  discoveredSecrets?: Set<string>; // Phase 14: IDs of discovered hidden areas (e.g., "hermit-cave")
  explorationProgress?: Record<string, number>; // Phase 14: Track % explored per location
  equippedRelics?: string[]; // Phase 15: IDs of currently equipped relics
  runicInventory?: { runeId: string; quantity: number }[]; // Phase 15: Collected runes
  boundRelicId?: string; // Phase 15: ID of the "Bound" relic (cannot drop)
  infusionHistory?: Array<{ relicId: string; runeId: string; timestamp: number }>; // Phase 15: Track infusions for corruption
  itemCorruption?: Record<string, number>; // Phase 15: Corruption level per item ID (0-100)
};

export type WorldState = {
  id: string;
  tick?: number;
  seed: number; // Phase 14.5: Seeded RNG for deterministic world simulation
  hour: number;
  day: number;
  dayPhase: "night" | "morning" | "afternoon" | "evening";
  season: "winter" | "spring" | "summer" | "autumn";
  weather: "clear" | "snow" | "rain";
  time?: { tick: number; baseHour?: number; baseDay?: number; hour: number; day: number; season: WorldState['season'] };
  locations: Location[];
  npcs: NPC[];
  quests: Quest[];
  resourceNodes?: ResourceNode[];
  activeEvents?: WorldEvent[];
  combatState?: CombatState;
  factions?: Faction[]; // Phase 11: Faction power dynamics
  factionRelationships?: FactionRelationship[]; // Phase 11: Inter-faction relationships
  factionConflicts?: FactionConflict[]; // Phase 11: Active conflicts between factions
  lastFactionTick?: number; // Track when faction events are processed (every 24h)
  travelState?: {
    isTraveling: boolean;
    fromLocationId: string;
    toLocationId: string;
    remainingTicks: number;
    ticksPerTravelSession: number;
    encounterRolled: boolean;
  }; // Phase 14: Travel state for encounters
  activeEncounter?: {
    id: string;
    npcId?: string;
    type: 'combat' | 'social' | 'environmental' | 'mixed';
    spawnedAt: number;
    remainingTurns?: number;
  }; // Phase 14: Current active encounter
  relics?: Record<string, Relic>; // Phase 15: All relics in the world (can be unowned, equipped, or bound)
  relicEvents?: Array<{ type: string; relicId: string; tick: number; message: string }>; // Phase 15: Log of relic events (dialogue, rebellion, etc.)
  player: PlayerState;
  needsCharacterCreation?: boolean;
  metadata?: any;
};

type Subscriber = (s: WorldState) => void;

const TICK_MS = 1000;

/**
 * Create a stackable inventory item (potions, herbs, gold, etc.)
 */
export function createStackableItem(itemId: string, quantity: number = 1): StackableItem {
  return {
    kind: 'stackable',
    itemId,
    quantity
  };
}

/**
 * Create a unique inventory item with instance identity (weapons, relics, armor)
 */
export function createUniqueItem(itemId: string, metadata?: UniqueItem['metadata']): UniqueItem {
  // Generate deterministic instanceId from timestamp and random component
  // In production, use cryptographic UUID
  const instanceId = `${itemId}-${Date.now()}-${Math.floor(Math.random() * 0xffffff).toString(16)}`;
  
  return {
    kind: 'unique',
    itemId,
    instanceId,
    metadata: metadata || {
      experience: 0,
      sentience: 0,
      runes: [],
      corruption: 0,
      infusions: []
    }
  };
}

/**
 * Check if inventory item is unique
 */
export function isUniqueItem(item: InventoryItem): item is UniqueItem {
  return item.kind === 'unique';
}

/**
 * Check if inventory item is stackable
 */
export function isStackableItem(item: InventoryItem): item is StackableItem {
  return item.kind === 'stackable';
}

/**
 * Merge stackable items in inventory (consolidates duplicates)
 */
export function consolidateStackables(inventory: InventoryItem[]): InventoryItem[] {
  const stackMap = new Map<string, number>();
  const unique: UniqueItem[] = [];

  for (const item of inventory) {
    if (isStackableItem(item)) {
      const key = item.itemId;
      stackMap.set(key, (stackMap.get(key) ?? 0) + item.quantity);
    } else {
      unique.push(item);
    }
  }

  const result: InventoryItem[] = Array.from(stackMap.entries()).map(([itemId, quantity]) =>
    createStackableItem(itemId, quantity)
  );

  return [...unique, ...result];
}

export function createInitialWorld(id = "world-1", template?: any): WorldState {
  // Use provided template, else try loaded WORLD_TEMPLATE, else fall back to built-in minimal defaults
  const tpl = template || WORLD_TEMPLATE;
  const baseSeason = tpl?.season ?? 'winter';
  const structuredCloneSafe = (v: any) => { try { // @ts-ignore
    return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
  const locations = tpl?.locations ? structuredCloneSafe(tpl.locations) : [ { id: "town", name: "Town Square" }, { id: "forest", name: "Forest" }, { id: "hill", name: "Green Hill" }, { id: "lake", name: "Silver Lake" } ];
  // Do not inject hardcoded NPCs/quests; prefer empty arrays to force template authors to define content
  const npcs = tpl?.npcs ? structuredCloneSafe(tpl.npcs) : [];
  const quests = tpl?.quests ? structuredCloneSafe(tpl.quests) : [];
  const metadata = tpl?.metadata ? structuredCloneSafe(tpl.metadata) : { audioVolume: 0.8, particleDensity: 'medium' };
  // record template origin for event provenance
  if (tpl && (tpl.id || tpl.name || tpl.metadata?.templateId)) {
    metadata.templateOrigin = tpl.id || tpl.name || tpl.metadata?.templateId;
  } else {
    metadata.templateOrigin = 'builtin';
  }

  // initial reputation may be supplied by template.metadata.initialReputation as { npcId: number }
  const initialRep = tpl?.metadata?.initialReputation ? structuredCloneSafe(tpl.metadata.initialReputation) : {};

  // Initial player health (starting at full HP until character is created with customized endurance)
  const INITIAL_MAX_HP = 100;

  // Initialize faction reputation (neutral starting: 0 with all factions)
  const factionsForRep = tpl?.factions ? structuredCloneSafe(tpl.factions) : [
    { id: 'silver-flame' },
    { id: 'ironsmith-guild' },
    { id: 'luminara-mercantile' },
    { id: 'shadow-conclave' },
    { id: 'adventurers-league' }
  ];
  const initialFactionRep: Record<string, number> = {};
  factionsForRep.forEach((f: any) => {
    initialFactionRep[f.id] = 0; // Neutral starting reputation
  });

  return {
    id,
    tick: 0,
    seed: Math.floor(Math.random() * 0x7fffffff), // Initialize with random seed; will be seeded on load
    hour: 8,
    day: 1,
    dayPhase: "morning",
    season: baseSeason as WorldState['season'],
    weather: "clear",
    locations,
    npcs,
    quests,
    player: {
      id: "player1",
      location: locations.length > 0 ? locations[0].id : "town",
      quests: {},
      dialogueHistory: [],
      npcDialogueIndex: {},
      gold: 0,
      experience: 0,
      xp: 0,
      level: 1,
      attributePoints: 0,
      reputation: initialRep,
      hp: INITIAL_MAX_HP,
      maxHp: INITIAL_MAX_HP,
      statusEffects: [],
      stats: {
        str: 10,
        agi: 10,
        int: 10,
        cha: 10,
        end: 10,
        luk: 10
      },
      inventory: [
        createStackableItem('healing-potion-minor', 2),
        createStackableItem('rare-herb', 1),
        createUniqueItem('rusty-sword')  // Unique weapon for variety in Phase 14.5+
      ],
      equipment: {
        mainHand: 'rusty-sword'
      },
      factionReputation: initialFactionRep, // Phase 11: Start neutral with all factions
      temporalDebt: 0, // Phase 12: Start with no temporal debt
      lastSaveTick: 0, // Phase 12: Track tick at last save for rewind detection
      soulStrain: 0, // Phase 13: Start with no soul strain from morphing
      currentRace: 'human', // Phase 13: Default race
      lastMorphTick: 0, // Phase 13: Track tick at last morph
      recentMorphCount: 0, // Phase 13: Recent morph count for cooldown multiplier
      discoveredSecrets: new Set(), // Phase 14: No secrets discovered yet
      explorationProgress: {}, // Phase 14: No locations explored yet
      equippedRelics: [], // Phase 15: No relics equipped initially
      runicInventory: [], // Phase 15: No runes collected initially
      boundRelicId: undefined, // Phase 15: Not bound to any relic
      infusionHistory: [], // Phase 15: No infusions yet
      itemCorruption: {}, // Phase 15: No item corruption yet
    },
    needsCharacterCreation: true,
    time: { tick: 0, baseHour: 8, baseDay: 1, hour: 8, day: 1, season: baseSeason as WorldState['season'] },
    resourceNodes: tpl?.resourceNodes ? structuredCloneSafe(tpl.resourceNodes) : [
      { id: 'iron-vein-forge', lootTableId: 'mine-ore', locationId: 'forge-summit', regeneratesInHours: 3 },
      { id: 'herbs-thornwood', lootTableId: 'forest-herbs', locationId: 'thornwood-depths', regeneratesInHours: 2 },
      { id: 'herbs-frozen', lootTableId: 'forest-herbs', locationId: 'frozen-lake', regeneratesInHours: 4 }
    ],
    activeEvents: [],
    combatState: {
      active: false,
      participants: [],
      turnIndex: 0,
      roundNumber: 0,
      log: [],
      initiator: ''
    },
    // Phase 11: Initialize faction system
    factions: tpl?.factions ? structuredCloneSafe(tpl.factions) : initializeFactions({ 
      locations, 
      npcs, 
      quests,
      combatState: {} as any,
      player: {} as any,
      id: '',
      hour: 8,
      day: 1,
      dayPhase: 'morning',
      season: 'winter',
      weather: 'clear'
    } as WorldState),
    factionRelationships: tpl?.factionRelationships ? structuredCloneSafe(tpl.factionRelationships) : initializeFactionRelationships(),
    factionConflicts: [],
    relics: {}, // Phase 15: Empty initially; relics are added to inventory or equipped
    relicEvents: [], // Phase 15: Track all relic-related events
    lastFactionTick: 0,
    metadata,
  };
}

export function createWorldController(initial?: WorldState, dev = false) {
  // copy-on-write: instantiate a fresh world from template if initial is not provided
  let state: WorldState = initial ? (function(i){ try { // @ts-ignore
    return structuredClone(i); } catch(e){ return JSON.parse(JSON.stringify(i)); } })(initial) : createInitialWorld();
  // Normalize time tick to match explicit tick when provided by callers
  try {
    if (state) {
      if (!state.time) state.time = { tick: state.tick ?? 0, hour: state.hour ?? 0, day: state.day ?? 1, season: state.season ?? 'winter' } as any;
      else state.time = { ...(state.time as any), tick: state.tick ?? (state.time as any).tick ?? 0 } as any;
    }
  } catch (e) {}
  
  // Initialize seeded RNG from world state
  const rng = new SeededRng(state.seed);
  setGlobalRng(rng);
  
  let timer: any = null;
  const subs: Subscriber[] = [];
  let journal = new CJ(state.id);
  // validate initial state after journal created
  const initialValidation = validateInvariants(state);
  if (!isStatePlayable(state)) {
    console.warn('Initial state has critical violations', initialValidation.violations);
  }

  function emit() {
    subs.forEach(s => s(state));
  }

  function advanceTick(amount = 1) {
    const prevTick = state.tick ?? 0;
    const nextTick = prevTick + Math.max(0, Math.floor(amount));

    // Increment seed for deterministic RNG progression
    const nextSeed = state.seed + 1;
    
    // Reseed the global RNG with new seed
    const rng = getGlobalRng();
    rng.reseed(nextSeed);

    // Compute hour from base and tick
    const baseHour = (state.time && (state.time as any).baseHour) ?? state.hour ?? 0;
    const baseDay = (state.time && (state.time as any).baseDay) ?? state.day ?? 1;
    const totalHours = baseHour + nextTick;
    const nextHour = totalHours % 24;
    const nextDay = baseDay + Math.floor(totalHours / 24);

    // Use seasonEngine for deterministic seasonal progression
    const { current: nextSeason, dayOfSeason, hasChanged: seasonChanged, transitionEvent: seasonTransition } = resolveSeason(nextTick, state.season);

    // Determine day phase
    let nextDayPhase: WorldState['dayPhase'] = 'morning';
    if (nextHour < 6) nextDayPhase = 'night';
    else if (nextHour < 12) nextDayPhase = 'morning';
    else if (nextHour < 18) nextDayPhase = 'afternoon';
    else nextDayPhase = 'evening';

    // Use weatherEngine for deterministic weather resolution
    const { current: nextWeather, intensity: weatherIntensity, hasChanged: weatherChanged, transitionEvent: weatherTransition } = resolveWeather(nextSeason, nextHour, state.weather);

    // Update NPC locations via scheduleEngine
    const npcLocationUpdates = updateNpcLocations(state.npcs, nextHour);
    const updatedNpcs = applyLocationUpdates(state.npcs, npcLocationUpdates);

    // Filter available locations based on season conditions
    const availableLocations = state.locations.filter(loc => 
      !loc.conditionalSeason || loc.conditionalSeason === nextSeason
    );

    state = { 
      ...state, 
      tick: nextTick, 
      seed: nextSeed,
      hour: nextHour, 
      day: nextDay, 
      dayPhase: nextDayPhase, 
      season: nextSeason, 
      weather: nextWeather,
      npcs: updatedNpcs,
      locations: availableLocations,
      time: { ...(state.time || {}), tick: nextTick, hour: nextHour, day: nextDay, season: nextSeason } as any 
    };

    // Emit base TICK event
    const ev: Event = {
      id: `tick-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: "system",
      type: "TICK",
      payload: { time: state.time, hour: state.hour, day: state.day, season: state.season, weather: state.weather, weatherIntensity },
      templateOrigin: state.metadata?.templateOrigin,
      timestamp: Date.now(),
    };
    appendEvent(ev);

    // Emit WEATHER_CHANGED if weather changed
    if (weatherChanged) {
      const weatherEv: Event = {
        id: `weather-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: "system",
        type: "WEATHER_CHANGED",
        payload: { reason: weatherTransition, from: state.weather, to: nextWeather, weatherIntensity },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
      };
      appendEvent(weatherEv);
    }

    // Emit SEASON_CHANGED if season changed
    if (seasonChanged) {
      const seasonEv: Event = {
        id: `season-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: "system",
        type: "SEASON_CHANGED",
        payload: { reason: seasonTransition, from: state.season, to: nextSeason, dayOfSeason },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
      };
      appendEvent(seasonEv);

      // Emit LOCATION_DISCOVERED for newly available seasonal locations
      const newLocations = availableLocations.filter(loc => 
        loc.conditionalSeason === nextSeason && 
        !state.locations.find(l => l.id === loc.id)
      );
      newLocations.forEach(loc => {
        const discoverEv: Event = {
          id: `location-discover-${Date.now()}-${loc.id}`,
          worldInstanceId: state.id,
          actorId: "system",
          type: "LOCATION_DISCOVERED",
          payload: { locationId: loc.id, locationName: loc.name, reason: `now available in ${nextSeason}` },
          templateOrigin: state.metadata?.templateOrigin,
          timestamp: Date.now(),
        };
        appendEvent(discoverEv);
      });
    }

    // Emit NPC_LOCATION_CHANGED for each NPC that moved
    Object.entries(npcLocationUpdates).forEach(([npcId, newLocationId]) => {
      const npc = updatedNpcs.find(n => n.id === npcId);
      if (npc) {
        const movedEv: Event = {
          id: `npc-moved-${Date.now()}-${npcId}`,
          worldInstanceId: state.id,
          actorId: npcId,
          type: "NPC_LOCATION_CHANGED",
          payload: { npcId, npcName: npc.name, from: npcLocationUpdates[npcId === npcId ? npcId : ''], to: newLocationId },
          templateOrigin: state.metadata?.templateOrigin,
          timestamp: Date.now(),
        };
        appendEvent(movedEv);
      }
    });

    // Check for environmental hazards
    try {
      const hazards = state.metadata?.hazards || (WORLD_TEMPLATE?.hazards || []);
      const hazardResults = checkLocationHazards(state, hazards);

      hazardResults.forEach(result => {
        if (result.triggered) {
          // Apply damage if applicable
          if (result.damage > 0) {
            state = {
              ...state,
              player: applyHazardDamage(state.player, result.damage)
            };
          }

          // Apply status if applicable
          if (result.statusApplied) {
            state = {
              ...state,
              player: applyHazardStatus(state.player, result.statusApplied)
            };
          }

          // Emit HAZARD_DAMAGE event
          const hazardEv: Event = {
            id: `hazard-${Date.now()}-${result.hazardId}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'HAZARD_DAMAGE',
            payload: {
              hazardId: result.hazardId,
              hazardName: result.hazardName,
              damage: result.damage,
              statusApplied: result.statusApplied,
              playerHpRemaining: state.player.hp || 0,
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(hazardEv);
        }
      });
    } catch (err) {
      // Hazard checking error - non-fatal
    }

    // Check for quest expirations after tick advances
    try {
      const nowTick = nextTick;
      const updatedQuests: Record<string, PlayerQuestState> = { ...(state.player.quests || {}) };
      let emittedExpired = false;
      Object.keys(updatedQuests).forEach(qid => {
        const pq = updatedQuests[qid];
        if (pq && pq.status === 'in_progress' && typeof pq.expiresAt === 'number' && nowTick >= pq.expiresAt) {
          updatedQuests[qid] = { ...pq, status: 'failed' };
          const expEv: Event = {
            id: `quest-expire-${Date.now()}-${qid}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'QUEST_EXPIRED',
            payload: { questId: qid, expiredAtTick: nowTick },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(expEv);
          emittedExpired = true;
        }
      });
      if (emittedExpired) state = { ...state, player: { ...state.player, quests: updatedQuests } };
    } catch (err) {
      // non-fatal
    }

    // Process NPC autonomous actions during combat
    if (state.combatState?.active) {
      try {
        const npcActions = resolveNpcTurns(state);
        
        // Process each NPC action through the standard action pipeline
        for (const npcAction of npcActions) {
          const events = processAction(state, npcAction);
          events.forEach(ev => appendEvent(ev));
          
          // Rebuild state from events to keep NPC actions in sync
          const allEvents = getEventsForWorld(state.id);
          const rebuilt = rebuildState(state, allEvents);
          if (rebuilt.candidateState) {
            state = rebuilt.candidateState;
          }
        }

        // Increment combat round after all participants have acted
        if (state.combatState) {
          state.combatState.roundNumber = (state.combatState.roundNumber || 0) + 1;
          const roundEv: Event = {
            id: `combat-round-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'COMBAT_ROUND_ADVANCED',
            payload: { roundNumber: state.combatState.roundNumber },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(roundEv);
        }
      } catch (err) {
        // Non-fatal: NPC action resolution is best-effort
      }
    }

    // Mana regeneration (passive 10% per hour)
    {
      const maxMp = state.player?.maxMp ?? 0;
      const currentMp = state.player?.mp ?? 0;
      if (maxMp > 0 && currentMp < maxMp) {
        const manaRegenAmount = Math.ceil(maxMp * 0.1); // 10% per hour
        const newMp = Math.min(currentMp + manaRegenAmount, maxMp);
        if (newMp > currentMp) {
          state = {
            ...state,
            player: {
              ...state.player,
              mp: newMp
            }
          };
          const manaRegenEv: Event = {
            id: `mana-regen-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: state.player.id,
            type: 'MANA_REGENERATED',
            payload: { previousMp: currentMp, newMp, maxMp, amountRestored: manaRegenAmount },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(manaRegenEv);
        }
      }
    }

    // Phase 11: Faction ticks - process every 24 game hours
    {
      const lastFactionTick = state.lastFactionTick ?? 0;
      const hoursSinceLastTick = nextHour + (nextDay - Math.floor((lastFactionTick + baseHour) / 24)) * 24 - (lastFactionTick % 24);
      
      if (hoursSinceLastTick >= 24) {
        // Trigger faction struggle event
        if (state.factions && state.factionRelationships) {
          const factionStruggleEv: Event = {
            id: `faction-struggle-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'FACTION_STRUGGLE',
            payload: {
              factionCount: state.factions.length,
              relationshipCount: state.factionRelationships.length,
              tick: nextTick,
              daysPassed: nextDay - baseDay
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(factionStruggleEv);
        }
        
        // Update last faction tick
        state = {
          ...state,
          lastFactionTick: nextTick
        };
      }
    }

    // Phase 13: Soul decay from morphing (passive 1% per hour)
    {
      const currentSoulStrain = state.player.soulStrain ?? 0;
      if (currentSoulStrain > 0) {
        const soulDecay = Math.max(0, Math.ceil(currentSoulStrain * 0.01)); // 1% per hour
        const newSoulStrain = currentSoulStrain - soulDecay;
        if (newSoulStrain < currentSoulStrain) {
          state = {
            ...state,
            player: {
              ...state.player,
              soulStrain: newSoulStrain
            }
          };
          const soulDecayEv: Event = {
            id: `soul-decay-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: state.player.id,
            type: 'SOUL_DECAY',
            payload: { previousStrain: currentSoulStrain, newStrain: newSoulStrain, amountDecayed: soulDecay },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(soulDecayEv);
        }
      }
    }

    // Phase 13: NPC Soul Decay (if NPCs have soul strain tracked)
    {
      if (state.npcs && state.npcs.length > 0) {
        const updatedNpcs = state.npcs.map((npc: NPC) => {
          const npcSoulStrain = (npc as any).soulStrain ?? 0;
          if (npcSoulStrain > 0) {
            const decay = Math.max(0, Math.ceil(npcSoulStrain * 0.01));
            const newStrain = npcSoulStrain - decay;
            if (newStrain < npcSoulStrain) {
              const decayEv: Event = {
                id: `npc-soul-decay-${Date.now()}-${npc.id}`,
                worldInstanceId: state.id,
                actorId: npc.id,
                type: 'NPC_SOUL_DECAY',
                payload: { npcId: npc.id, npcName: npc.name, previousStrain: npcSoulStrain, newStrain, amountDecayed: decay },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(decayEv);
              return { ...npc, soulStrain: newStrain } as NPC;
            }
          }
          return npc;
        });
        if (updatedNpcs.some((npc, i) => npc !== state.npcs[i])) {
          state = { ...state, npcs: updatedNpcs };
        }
      }
    }

    // Status Effect ticks (passive reduction of status effect durations)
    {
      if (state.player.statusEffects && state.player.statusEffects.length > 0) {
        const remainingEffects = state.player.statusEffects.filter(effect => {
          // In a full implementation, track effect duration on each status
          // For now, mark effects that have expired
          return effect && effect.length > 0;
        });
        
        if (remainingEffects.length < state.player.statusEffects.length) {
          const expiredCount = state.player.statusEffects.length - remainingEffects.length;
          state = {
            ...state,
            player: {
              ...state.player,
              statusEffects: remainingEffects
            }
          };
          
          if (expiredCount > 0) {
            const expireEv: Event = {
              id: `status-expired-${Date.now()}`,
              worldInstanceId: state.id,
              actorId: state.player.id,
              type: 'STATUS_EFFECT_EXPIRED',
              payload: { expiredCount, remainingEffects: remainingEffects.length },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(expireEv);
          }
        }
      }
    }

    // Validate state invariants after tick (constraint validation)
    const tickValidation = validateInvariants(state);
    if (!tickValidation.valid && tickValidation.violations.some(v => v.severity === 'critical')) {
      console.error('Critical constraint violation after tick', tickValidation.violations);
    }
    emit();
  }

  function tick() {
    try { advanceTick(1); } catch (err) {}
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function performAction(action: Action) {
    // Authorization gate: run deterministic, pure checks before mutating state
    // Build an authorization context from canonical engine state (do not trust caller-provided actorId)
    const canonicalActorId = state.player?.id;
    const ctx: AuthorizationContext = { playerId: canonicalActorId };
    
    // Quick sanity: reject if caller-supplied actorId does not match canonical actor
    // EXCEPT for SUBMIT_CHARACTER which legitimately changes the player ID
    if (action.type !== 'SUBMIT_CHARACTER' && action.playerId && canonicalActorId && action.playerId !== canonicalActorId) {
      const rej: Event = {
        id: `action-rejected-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: canonicalActorId,
        type: 'ACTION_REJECTED',
        payload: { reason: 'actor-mismatch', code: 'ACTOR_MISMATCH', actionType: action.type, claimedActor: action.playerId },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
        mutationClass: 'REJECTION',
      };
      appendEvent(rej);
      return [];
    }

    const auth = authorizeAction(state, action, ctx);
    if (!auth.allowed) {
      const rej: Event = {
        id: `action-rejected-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: canonicalActorId,
        type: 'ACTION_REJECTED',
        payload: { reason: auth.reason, code: auth.code, actionType: action.type },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
        mutationClass: 'REJECTION',
      };
      appendEvent(rej);
      return [];
    }

    // deterministic tick model: record tickBefore, validate & apply action, then advance tick by action cost only if applied
    const tickBefore = state.tick ?? 0;
    const preSummary = summarizeStateMinimal(state);

    const events = processAction(state, action);
    // apply events locally to state; collect quests started to finalize after tick advance
    const questsStarted: string[] = [];
    events.forEach(e => {
      switch (e.type) {
        case "CHARACTER_CREATED": {
          const character = e.payload?.character;
          if (character) {
            state = { ...state, player: character, needsCharacterCreation: false };
          }
          break;
        }
        case "MOVE":
          state = { ...state, player: { ...state.player, location: e.payload.to } };
          break;
        case "INTERACT_NPC": {
          const npc = state.npcs.find(n => n.id === e.payload.npcId);
          const quest = npc?.questId ? state.quests.find(q => q.id === npc!.questId) : undefined;
          const text = e.payload?.text || (npc ? `${npc.name}: ${quest ? `I need help with ${quest.title}.` : "Hello."}` : "");
          const dh = state.player.dialogueHistory ? [...state.player.dialogueHistory] : [];
          dh.push({ npcId: e.payload.npcId, text, timestamp: Date.now(), options: e.payload?.options });
          const idx = { ...(state.player.npcDialogueIndex || {}) };
          idx[e.payload.npcId] = ((idx[e.payload.npcId] || 0) + 1);
          state = { ...state, player: { ...state.player, dialogueHistory: dh, npcDialogueIndex: idx } };
          break;
        }
        case "QUEST_STARTED": {
          const qid = e.payload?.questId;
          // mark as in_progress now; finalize startedAt/expiresAt after tick advances
          state = { ...state, player: { ...state.player, quests: { ...state.player.quests, [qid]: { status: "in_progress" } } } };
          questsStarted.push(qid);
        }
          break;
        case "QUEST_COMPLETED":
          state = { ...state, player: { ...state.player, quests: { ...state.player.quests, [e.payload.questId]: { status: "completed" } } } };
          break;
        case "REWARD": {
          const reward = e.payload?.reward ?? null;
          if (reward && typeof reward.gold === 'number') {
            state = { ...state, player: { ...state.player, gold: (state.player.gold ?? 0) + reward.gold } };
          }
          break;
        }
        case "REPUTATION_CHANGED": {
          const delta = e.payload?.delta ?? {};
          const rep = { ...(state.player.reputation ?? {}) };
          Object.keys(delta).forEach(k => { rep[k] = (rep[k] ?? 0) + Number(delta[k] ?? 0); });
          state = { ...state, player: { ...state.player, reputation: rep } };
          break;
        }
        case "COMBAT_HIT":
        case "COMBAT_MISS":
        case "COMBAT_DODGE":
          // Combat events are logged for history but don't modify core state
          // In a full system, would apply damage, trigger special effects, etc.
          break;
        case "QUEST_LOCKED":
          break;
      }
    });

    // decide whether the action produced a meaningful state change; if so, advance tick by action cost
    const ACTION_TICK_COST: Record<string, number> = { MOVE: 1, INTERACT_NPC: 1, DIALOG_CHOICE: 1, START_QUEST: 1, COMPLETE_QUEST: 1, WAIT: 1 };
    const cost = ACTION_TICK_COST[action.type] ?? 1;
    const meaningful = events.some((e:any) => !['QUEST_LOCKED','NPC_UNAVAILABLE'].includes(e.type)) || action.type === 'WAIT';

    if (meaningful && cost > 0) {
      advanceTick(cost);
    }

    // finalize time-dependent state such as startedAt/expiresAt for quests
    try {
      const tickAfter = state.tick ?? 0;
      if (questsStarted.length) {
        const updated = { ...(state.player.quests || {}) };
        for (const qid of questsStarted) {
          const qdef = state.quests.find(q => q.id === qid);
          const startedAt = tickAfter;
          const expiresIn = qdef?.expiresInHours ? Number(qdef.expiresInHours) : undefined;
          const expiresAt = typeof expiresIn === 'number' ? (startedAt + expiresIn) : undefined;
          updated[qid] = { ...updated[qid], startedAt, expiresAt };
        }
        state = { ...state, player: { ...state.player, quests: updated } };
      }

      // record canon mutation: action, pre-summary, emitted events, post-summary, tickBefore/tickAfter
      const postSummary = summarizeStateMinimal(state);
      try { journal.recordMutation(tickBefore, tickAfter, action, preSummary, events, postSummary); } catch (_) {}
      } catch (err) {}

      // validate invariants after action and journal recorded (constraint validation)
      const actionValidation = validateInvariants(state);
      if (!isStatePlayable(state)) {
        console.error('State became unplayable after action:', actionValidation.violations);
      }
      emit();
    return events;
  }

  function switchTemplate(template: any) {
    // Replace world content (locations, npcs, quests, metadata) while keeping instance id and player progress when possible
    const newBase = createInitialWorld(state.id, template);
    // keep player progress, gold and location where appropriate
    const player = { ...newBase.player, quests: { ...state.player.quests }, dialogueHistory: state.player.dialogueHistory || [], npcDialogueIndex: state.player.npcDialogueIndex || {}, gold: state.player.gold || 0 };
    state = { ...newBase, player };
    emit();
  }

  function subscribe(fn: Subscriber) {
    subs.push(fn);
    fn(state);
    return () => {
      const i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function save() {
    const events = getEventsForWorld(state.id);
    try {
      createSave(`Luxfier Autosave - ${new Date().toLocaleString()}`, state, events, state.id, state.tick ?? 0);
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  function load() {
    // Find the most recent save for this world
    const key = `luxfier_save_${state.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as WorldState;
        // Verify integrity before applying
        const saveMeta = parsed as any;
        if (saveMeta.checksum) {
          // This is from saveLoadEngine
          const isValid = verifySaveIntegrity(saveMeta);
          if (!isValid) {
            console.warn('Loaded save failed integrity check. Proceeding with caution.');
          }
        }
        state = parsed;
        // if loaded state has a different id, rebind journal to that id
        try {
          if (parsed.id && parsed.id !== journal.worldId) {
            journal = new CJ(parsed.id);
          }
        } catch (e) {}
        const loadValidation = validateInvariants(state);
        if (!isStatePlayable(state)) {
          console.error('Loaded state is not playable:', loadValidation.violations);
        }
        emit();
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function getRecentMutations(n = 20) {
    try { return journal.getRecent(n); } catch (e) { return []; }
  }

  function replayEvents() {
    // Rebuild the world from events and validate the reconstructed state.
    // Keep returning the raw events array for callers, but ensure the replay is canonical.
    const events = getEventsForWorld(state.id);
    try {
      const { candidateState } = rebuildState(state, events) as any;
      // validate against constraint invariants for this instance
      const replayValidation = validateInvariants(candidateState);
      if (!isStatePlayable(candidateState)) {
        const errMsg = `Replay validation failed: ${JSON.stringify(replayValidation.violations)}`;
        if (dev) throw new Error(errMsg);
        // In prod, emit an INVARIANT_VIOLATION event into the global event log
          const v: Event = {
            id: `invariant-violation-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'INVARIANT_VIOLATION',
            payload: { error: errMsg },
            timestamp: Date.now(),
            templateOrigin: state.metadata?.templateOrigin,
            mutationClass: 'SYSTEM',
          };
          appendEvent(v);
      }
    } catch (e) {
      // If rebuilding itself failed, bubble in dev, otherwise emit a violation in prod
      if (dev) throw e;
      const v: Event = {
        id: `rebuild-failure-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'system',
        type: 'INVARIANT_VIOLATION',
        payload: { error: String(e) },
        timestamp: Date.now(),
        templateOrigin: state.metadata?.templateOrigin,
        mutationClass: 'SYSTEM',
      };
      appendEvent(v);
    }

    return events;
  }

  // return a deep-cloned state to avoid leaking live references to callers
  function getStateClone(): WorldState {
    try {
      // @ts-ignore - use structuredClone when available (node >= 17+)
      // prefer structuredClone to preserve more types if supported
      // eslint-disable-next-line no-undef
      if (typeof structuredClone === 'function') return structuredClone(state);
    } catch (e) {}
    // fallback to JSON deep copy (state is expected to be serializable)
    return JSON.parse(JSON.stringify(state));
  }

  const devApi = Object.freeze({ start, stop, performAction, advanceTick, subscribe, save, load, getState: getStateClone, replayEvents, switchTemplate, getRecentMutations });

  const kernelApi = Object.freeze({ getState: getStateClone, performAction, advanceTick, load, getRecentMutations });

  return dev ? devApi as any : kernelApi as any;
}

export default createWorldController;
