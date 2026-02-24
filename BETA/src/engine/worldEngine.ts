import { Event, appendEvent, getEventsForWorld } from "../events/mutationLog";
import CJ, { summarizeStateMinimal } from "./canonJournal";
import { rebuildState } from "./stateRebuilder";
import { validateInvariants, isStatePlayable } from "./constraintValidator";
import { SeededRng, setGlobalRng, getGlobalRng } from "./prng";
import type { SocialScar } from "./npcMemoryEngine";
import { processAction, Action } from "./actionPipeline";
import { authorizeAction, AuthorizationContext } from "./authorization/authorizeAction";
import { createSave, loadSave, verifySaveIntegrity } from "./saveLoadEngine";
import { resolveNpcLocation, updateNpcLocations, applyLocationUpdates } from "./scheduleEngine";
import { resolveWeather, getWeatherVisuals } from "./weatherEngine";
import { resolveNpcTurns } from './aiTacticEngine';
import { applyStrategyModifierToNpc } from './factionCommandEngine';
import { checkLocationHazards, applyHazardDamage, applyHazardStatus } from "./hazardEngine";
import { resolveSeason } from './seasonEngine';
import { Faction, FactionRelationship, FactionConflict, initializeFactions, initializeFactionRelationships, resolveFactionTurns } from './factionEngine';
import { processDailyInfluenceDiffusion } from './influenceDiffusionEngine';
import { Relic, RunicSlot, shouldRelicRebel, applyRelicRebellion, generateRelicDialogue } from './artifactEngine';
import { initializeDirectorState, evaluateDirectorIntervention, type DirectorState } from './aiDmEngine';
import { initializeAudioState, calculateRequiredAudio, applyAudioParameterMutation, type AudioState } from './audioEngine';
import { Investigation, getInvestigationPipeline } from './investigationPipelineEngine';
import { getGoalOrientedPlanner, type NpcGoal, type ActionPlan } from './goalOrientedPlannerEngine';
import { getLegacyEngine, type SoulEcho } from './legacyEngine';
import { type WorldScar } from './worldScarsEngine';
import { resolveLocationSkirmishes } from './factionSkirmishEngine';
import { processMacroEvents, applyMacroEventEffectsToNpc } from './macroEventsEngine';
import templateJson from '../data/luxfier-world.json';
import schemaJson from '../data/luxfier-world.schema.json';

// Attempt to load a world template JSON. If unavailable, fall back to hardcoded default.
let WORLD_TEMPLATE: any = null;
try {
  const maybe = templateJson;
  // validate against schema if possible
  let valid = true;
  try {
    const Ajv = require('ajv');
    const ajv = new Ajv({ allErrors: true, strict: false });
    const schema = schemaJson;
    const validate = ajv.compile(schema);
    valid = validate(maybe);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.error('[worldEngine] World template validation errors:', validate.errors);
    }
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

// ALPHA_M9 Phase 3: SubArea for hidden depths and nested locations
export type SubArea = {
  id: string;
  name: string;
  description: string;
  parentLocationId: string;  // Parent location this is nested under
  offset?: { x: number; y: number };  // Offset from parent (for spatial visualization)
  difficulty?: number;  // Perception/search difficulty (10-25 DC)
  discovered?: boolean;  // Initially false, revealed through search
  rewards?: Array<{ itemId: string; quantity?: number; rarity?: string }>;  // Loot table
  environmentalEffects?: string[];  // e.g., "reduced_hearing", "spirit_amplification"
};

export type Location = { 
  id: string; 
  name: string; 
  conditionalSeason?: string; 
  description?: string;
  // ALPHA_M9: Coordinate system for spatial map
  x?: number;  // 0-1000 normalized grid
  y?: number;  // 0-1000 normalized grid
  biome?: 'forest' | 'cave' | 'village' | 'corrupted' | 'shrine' | 'maritime' | 'mountain' | 'plains';
  terrainModifier?: number;  // 1.0 = normal, 1.5 = difficult, 0.8 = easy (affects travel time)
  discovered?: boolean;  // Fog of war tracking
  spiritDensity?: number;  // Lore: magical saturation (0-1)
  subAreas?: SubArea[];  // ALPHA_M9 Phase 3: Hidden nested locations
  activeScars?: Array<{ description: string }>;  // M59-A1: World scars (narrative markers) visible at this location
};

// ALPHA_M9 Phase 3: Spatial Director System - Coordinate-based NPC orchestration zones
export type DirectorZone = {
  id: string;
  centerX: number;        // Center of zone (0-1000)
  centerY: number;        // Center of zone (0-1000)
  radius: number;         // Detection radius in coordinate units
  occupants: string[];    // NPC IDs currently in this zone
  lastPlayerX?: number;   // Last known player coordinates
  lastPlayerY?: number;
  magnetLevel: number;    // 0-1: How strongly NPCs are drawn toward player (pacing nudge)
  activeUntilTick?: number; // When this zone expires
};

/**
 * M57-A1: PlayerAnalytics interface for tracking player playstyle and behavior
 * Used by aiDmEngine for director interventions based on player patterns
 */
export interface PlayerAnalytics {
  engagementScore?: number;    // Overall engagement metric
  context?: string;            // Location or activity context
  timestamp?: number;          // When this event was recorded
  won?: boolean;               // Combat outcome
  succeeded?: boolean;         // Action success
  sessionStartTick?: number;
  totalActionsPerformed?: number;
  combatEngagements?: number;
  dialogueInteractions?: number;
  resourceGathering?: number;
}

/**
 * M57-A1: PlaystyleVector represents player's archetype preferences
 * Used to personalize director interventions and NPC encounters based on playstyle
 */
export interface PlaystyleVector {
  combatant: number;           // 0-1: Preference for combat encounters
  diplomat: number;            // 0-1: Preference for social interactions
  explorer: number;            // 0-1: Preference for exploration & discovery
  dominant?: string;           // Primary archetype: 'combatant' | 'diplomat' | 'explorer' | 'hybrid'
}

/**
 * M57-A1: FactionConflict represents tension between factions
 * Used by aiDmEngine for narrative tension calculations
 */
export interface FactionConflict {
  id: string;
  factionIds: string[];
  type: 'military' | 'economic' | 'religious' | 'infiltration' | 'diplomatic';
  active: boolean;
  intensity?: number;
}

/**
 * M57-A1: TemporalDebt represents player's violation of narrative causality
 * Tracked by Ground Truth violation enforcement
 */
export interface TemporalDebt {
  totalViolations: number;
  unmetConsequences: number;  // Actions requiring narrative resolution
  lastViolationTick: number;
  pendingResolutions: Array<{
    violationType: string;
    severity: number;          // 1-5: Impact severity
    triggeredAtTick: number;
    resolvedAtTick?: number;
  }>;
}

export type PersonalityType = 'aggressive' | 'cautious' | 'tactical' | 'healer' | 'balanced';
export type NpcPersonality = {
  type?: PersonalityType;
  attackThreshold?: number;
  defendThreshold?: number;
  riskTolerance?: number;
  // M49-A3: 6-dimension GOAP trait model
  boldness?: number;        // 0-100: willingness to take risks
  caution?: number;         // 0-100: tendency to avoid danger
  sociability?: number;     // 0-100: preference for interaction
  ambition?: number;        // 0-100: drive for power/status
  curiosity?: number;       // 0-100: desire to explore/learn
  honesty?: number;         // 0-100: adherence to truth/ethics
};
export type NPC = { 
  id: string; 
  name: string; 
  locationId: string; 
  type?: 'NORMAL' | 'SOUL_ECHO'; // M53-D1: Ancestral Soul Echo NPCs
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
  soulEchoData?: { // M53-D1: Data for Soul Echo NPCs
    linkedLegacyId?: string;
    inheritableMerit?: number;
    ancestralAdvice?: string;
    echoType?: 'faint' | 'clear' | 'resonant' | 'overwhelming';
  };
  // M49-A3: Autonomous planning fields
  currentActionPlan?: any;
  goals?: any[];
  factionId?: string; // Phase 11: NPC faction affiliation
  factionRole?: string; // e.g., 'leader', 'soldier', 'informant'
  // M19: Emotional state tracking
  emotionalState?: {
    trust: number; // 0-100: confidence in player's reliability
    fear: number; // 0-100: anxiety about player's intentions
    gratitude: number; // 0-100: appreciation for player's deeds
    resentment: number; // 0-100: anger at past player actions
    lastEmotionalEventTick?: number; // Tick of most recent emotional event
    emotionalHistory?: Array<{
      tick: number;
      category: 'trust' | 'fear' | 'gratitude' | 'resentment';
      delta: number;
      reason: string;
    }>;
  };
  // M55-B1: Rumor tracking for NPC gossip hubs
  rumors?: Array<{
    id: string;
    content: string; // e.g., "Great Library discovered in mountains"
    sourceNpcId?: string;
    acquiredTick: number;
    reliability: number; // 0-100: confidence in rumor accuracy
    type: 'location' | 'deed' | 'scar' | 'faction' | 'generic';
  }>;
  // M55-B1: Track co-location ticks for gossip trigger
  coLocationTicks?: Record<string, number>; // npcId -> ticks spent together
  // M55-C1: NPC inventory for trade & harvesting
  inventory?: InventoryItem[];
  importance?: 'critical' | 'major' | 'minor'; // M19: Quest criticality for attrition
  isDisplaced?: boolean; // M19: Temporarily vanished during conflict
  defectedFactionId?: string; // M19: faction switched to during warfare
  lastEmotionalDecay?: number; // M59-A1: Tick when emotional state last decayed (for pacing emotional shifts)
  // Phase 8: Soul strain tracking for NPC transformation/morphing
  soulStrain?: number;  // Soul strain from morphing/transformations (0-100)
  // BETA Phase 2: Social Memory - Track psychological scars from major events
  socialScars?: SocialScar[];  // Betrayals, trauma, shame from interactions
  // Phase 7: Per-NPC environmental corruption tracking (mirrors WorldState paradoxLevel/ageRotSeverity)
  paradoxLevel?: number;  // 0-100: Individual NPC paradox accumulation affecting their reality stability
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';  // Environmental decay level affecting this NPC's perception
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
  // Phase 8: NPC giver and quest status tracking
  giverNpcId?: string;  // NPC ID of quest giver
  status?: 'active' | 'completed' | 'abandoned' | 'available';  // Quest status
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

/**
 * M47-E1: Dialogue Entry Interface
 * Represents a single dialogue exchange between player and NPC
 * Extracted from PlayerState.dialogueHistory for type safety
 */
export type DialogueEntry = {
  npcId: string;
  text: string;
  timestamp: number;
  options?: { id: string; text: string }[];
};

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
  knowledgeBase?: Map<string, any> | string[]; // M16: Lore entries discovered (maps to LoreEntry objects) | Phase 10: Also supports string[] for snapshot serialization with NPC/item IDs (e.g., "npc:abc", "item:xyz")
  visitedLocations?: Set<string> | string[]; // Phase 10: Locations player has discovered (supports both Set and array for snapshot compatibility)
  beliefLayer?: BeliefLayer; // Tracks false beliefs and suspicion
  suspicionLevel?: number; // M16: Metagaming suspicion (0-100, increases on suspicious actions)
  metaSuspicionLastTriggeredAt?: number; // M16: Last tick when suspicion threshold was crossed
  // Phase 10: World Truth Obfuscation Layer (WTOL) discovery tracking
  discoveryAttempts?: Array<{ tick: number; entityType: 'npc' | 'item' | 'location'; entityId: string; wasKnown: boolean }>; // Track meta-knowledge attempts for suspicion calculation
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
  // ALPHA_M9: Skill system
  skillPoints?: number; // Available skill points to spend
  unlockedAbilities?: string[]; // IDs of unlocked abilities (from skillEngine)
  equippedAbilities?: string[]; // Currently active abilities (max 6)
  abilityCooldowns?: Record<string, number>; // Remaining ticks on ability cooldowns
  // M49-A4: Soul Resonance State
  activeResonanceEchoId?: string; // ID of the currently active "Echo" apparition
  activeResonanceAdvice?: string; // Current content of the apparition's advice
  lastSoulResonanceTick?: number; // Last time a resonance event occurred
  soulResonanceLevel?: number; // 0-100: current alignment with ancestral spirits
  // M51-A1: Merit System (Player Interactivity)
  merit?: number; // 0+: Meta-currency earned through deeds for faction commands
  factionCommands?: Record<string, { strategy: 'CONQUEST' | 'ESPIONAGE' | 'ISOLATIONISM'; appliedAt: number }>; // factionId -> active strategy
  // M55-A1: AI Analytics & Playstyle (M57-A1: Strict typing)
  analytics?: PlayerAnalytics[];   // M57-A1: Renamed from Analytics
  playstyleVector?: PlaystyleVector;
  inactionCounter?: number;        // M57-A1: Ticks of continuous no-op activity for pacing detection
  lastEmotionalDecay?: number; // Tick of last emotional decay update
  recentCombatOutcomes?: Array<{ won: boolean; timestamp?: number }>;
  recentDialogueOutcomes?: Array<{ succeeded: boolean; timestamp?: number }>;
  locationsDiscoveredRecently?: string[];
  bloodlineData?: { canonicalName: string; inheritedPerks: string[]; mythStatus: number; epochsLived: number; deeds: string[] };
  // M55-A: Player position for Director logic
  x?: number;
  y?: number;
  name?: string;
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
  time?: { tick: number; baseHour?: number; baseDay?: number; hour: number; minute?: number; day: number; season: WorldState['season'] };
  locations: Location[];
  npcs: NPC[];
  quests: Quest[];
  resourceNodes?: ResourceNode[];
  activeEvents?: WorldEvent[];
  combatState?: CombatState;
  factions?: Faction[]; // Phase 11: Faction power dynamics
  factionRelationships?: FactionRelationship[]; // Phase 11: Inter-faction relationships
  factionConflicts?: FactionConflict[]; // Phase 11: Active conflicts between factions
  influenceMap?: Record<string, Record<string, number>>; // M15 Step 5: locationId → factionId → influence score
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
  directorZones?: DirectorZone[]; // ALPHA_M9 Phase 3: Spatial zones for NPC orchestration
  relics?: Record<string, Relic>; // Phase 15: All relics in the world (can be unowned, equipped, or bound)
  relicEvents?: Array<{ type: string; relicId: string; tick: number; message: string }>; // Phase 15: Log of relic events (dialogue, rebellion, etc.)
  startLocation?: string; // Template support: initial player location for world creation
  rules?: any[]; // Template support: world rules/game rules
  events?: any[]; // Template support: predefined world events
  lore?: string; // Template support: world lore/background
  // M47-A1: Belief Registry - Tracks rumors, facts, and confidence scores
  beliefRegistry?: Record<string, { fact: string; confidence: number; source: string; isRumor: boolean }>;
  // M47-A1: Unlocked Soul Echoes - Tracks discovered legacy entries with rarity/power
  unlockedSoulEchoes?: SoulEcho[];
  // M48-A4: Macro Events - World-scale events with faction impact
  macroEvents?: Array<{ id: string; priority?: number; locationId?: string; [key: string]: any }>;
  // M48-A4: Director State - Track director intervention system
  directorState?: DirectorState;
  // M48-A4: Epoch Transition Tracking
  lastEpochTransitionTick?: number;
  // M48-A4: Epoch ID - Track current epoch identifier
  epochId?: string;
  // M48-A4: Chronicle ID - Track current chronicle sequence
  chronicleId?: string;
  // M48-A4: Epoch metadata - Track epoch progression and narrative context
  epochMetadata?: {
    chronologyYear: number; // In-world year for the epoch
    theme: string; // Narrative focus (e.g., "Fracture", "Restoration", "Waning Light")
    description?: string; // OOC epoch context
    sequenceNumber: number; // 1 for Epoch I, 2 for Epoch II, etc.
  };
  // Phase 8: Hazards tracking in world state
  hazards?: any[];  // Environmental hazards affecting the world
  // M48-A4: Heirloom Caches - Track legacy heirloom placements
  heirloomCaches?: any[];
  // M48-A4: Paradox Debt - Track accumulated paradox cost
  paradoxDebt?: number;
  // M49-A2: Active Investigations - Track ongoing rumor investigations
  investigations?: Investigation[];
  audio: AudioState; // ALPHA_M8 Phase 1: Deterministic audio state tracking
  player: PlayerState;
  needsCharacterCreation?: boolean;
  metadata?: any;
  // M51-D1: World Scarring - Persistent environmental markers from macro events
  worldScars?: WorldScar[];
  // M49-A1: World Fragments - Interactive world features (ruins, shrines, landmarks, etc.)
  worldFragments?: any[];  // WorldFragment[] - Interactive world features for exploration
  // M55-A1: Global Dialogue Cache - Prevents duplicate LLM API hits
  dialogueCache?: Record<string, { response: string; timestamp: number }>;
  // ALPHA_M19: NPC displacement tracking (temporary location shifts in conflict)
  npcDisplacements?: Record<string, { expectedReturnTick: number; originalLocation: string }>;
  // BETA Phase 1: Pressure Sink - Track accumulated paradox in world state
  paradoxLevel?: number;  // 0-100: World paradox accumulation affecting reality stability
  temporalParadoxes?: any[];  // Active paradox effects/anomalies
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';  // World decay level for UI feedback
  narrativeInterventions?: any[];  // Director/Seer narrative intervention history
  // BETA Phase 2: Social Memory - Track all active psychological scars across NPCs
  activeSocialScars?: SocialScar[];  // Betrayals, trauma from relationships
  // Phase 13: Multi-Generation Paradox Tracking
  generationalParadox?: number;  // Cumulative paradox across all epochs (never resets, persists across advanceToNextEpoch)
  epochGenerationIndex?: number; // Current generation number (1st ascension = 1, 2nd = 2, etc.)
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

/**
 * Beta Phase 5 Task 2: Initialize NPC inventories based on location biome
 * Ensures every NPC has a properly initialized inventory array with biome-appropriate starter items
 * 
 * @param npcs NPC array to initialize
 * @param locations Location array to determine biomes
 * @returns Updated NPC array with initialized inventories
 */
export function initializeNpcInventories(npcs: NPC[], locations: Location[]): NPC[] {
  // Beta Phase 5: Biome-specific harvesting resources
  const biomeResources: Record<string, { itemId: string; quantity: number }[]> = {
    'corrupted': [{ itemId: 'cursed-locus', quantity: 2 }],
    'cave': [{ itemId: 'blessed-crystal', quantity: 3 }],
    'forest': [{ itemId: 'moonleaf', quantity: 4 }],
    'plains': [{ itemId: 'golden-wheat', quantity: 5 }],
    'mountain': [{ itemId: 'iron-ore', quantity: 3 }],
    'maritime': [{ itemId: 'sea-salt', quantity: 3 }],
    'shrine': [{ itemId: 'sacred-incense', quantity: 2 }],
    'village': [{ itemId: 'basic-grain', quantity: 4 }]
  };
  
  return npcs.map((npc) => {
    // Ensure inventory exists
    if (!npc.inventory) {
      npc.inventory = [];
    }
    
    // Only initialize if empty
    if (npc.inventory.length === 0) {
      // Find biome from NPC's location
      const npcLocation = locations.find((l) => l.id === npc.locationId);
      const biome = (npcLocation?.biome || 'forest') as string;
      const resources = biomeResources[biome.toLowerCase()] || biomeResources['forest'];
      
      // Add 1-2 regional resources to NPC inventory for trading
      resources.slice(0, 2).forEach((resource) => {
        npc.inventory!.push(
          createStackableItem(resource.itemId, resource.quantity)
        );
      });
    }
    
    // Beta Phase 5 Task 5: Initialize social scars array
    if (!npc.socialScars) {
      npc.socialScars = [];
    }
    
    return npc;
  });
}

export function createInitialWorld(id = "world-1", template?: any): WorldState {
  // Use provided template, else try loaded WORLD_TEMPLATE, else fall back to built-in minimal defaults
  const tpl = template || WORLD_TEMPLATE;
  const baseSeason = tpl?.season ?? 'winter';
  const structuredCloneSafe = (v: any) => { try { // @ts-ignore
    return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
  const locations = tpl?.locations ? structuredCloneSafe(tpl.locations) : [ { id: "town", name: "Town Square" }, { id: "forest", name: "Forest" }, { id: "hill", name: "Green Hill" }, { id: "lake", name: "Silver Lake" } ];
  // Do not inject hardcoded NPCs/quests; prefer empty arrays to force template authors to define content
  let npcs = tpl?.npcs ? structuredCloneSafe(tpl.npcs) : [];
  // Beta Phase 5 Task 2: Initialize NPC inventories
  npcs = initializeNpcInventories(npcs, locations);
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
      // M51-A1: Merit & Faction Command System
      merit: 0, // Start with 0 merit
      factionCommands: {}, // No active faction commands initially
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
    // M15 Step 5: Initialize influence map (locationId → factionId → score)
    influenceMap: tpl?.influenceMap ? structuredCloneSafe(tpl.influenceMap) : (() => {
      const map: Record<string, Record<string, number>> = {};
      locations.forEach((loc: Location) => {
        map[loc.id] = {};
        // Factions start with influence at their primary location only
        (tpl?.factions ? structuredCloneSafe(tpl.factions) : initializeFactions({
          locations, npcs, quests, combatState: {} as any, player: {} as any,
          id: '', hour: 8, day: 1, dayPhase: 'morning', season: 'winter', weather: 'clear'
        } as WorldState)).forEach((faction: Faction) => {
          map[loc.id][faction.id] = (faction.primaryLocationId === loc.id) ? 50 : 0; // HQ starts with 50 influence
        });
      });
      return map;
    })(),
    relics: {}, // Phase 15: Empty initially; relics are added to inventory or equipped
    relicEvents: [], // Phase 15: Track all relic-related events
    beliefRegistry: {}, // M47-A1: Initialize empty belief registry (populated by beliefEngine)
    unlockedSoulEchoes: [], // M47-A1: Initialize empty soul echoes (populated by legacyEngine)
    investigations: [], // M49-A2: Initialize empty investigations array
    audio: initializeAudioState(), // ALPHA_M8 Phase 1: Initialize audio state for deterministic audio engine
    // M51-D1: Initialize world scars array
    worldScars: [],
    lastFactionTick: 0,
    metadata,
  };
}

/**
 * ALPHA_M22: Reinitialize world from a template while preserving player progression
 * 
 * Enables live blueprint hot-swapping: change world content without losing player data
 * 
 * What is preserved:
 * - player.id, level, xp, gold, inventory, equipment
 * - player.reputation (per-NPC), factionReputation
 * - player.quests, dialogueHistory
 * - player stats, health, attributes
 * 
 * What is reset:
 * - locations, npcs, factions (from new template)
 * - quests (from new template, but player.quests state preserved)
 * - world time (tick reset to 0, or optionally preserved)
 * - combatState (reset to inactive)
 * - activeEvents (cleared)
 * 
 * @param template New world template to apply
 * @param currentState Current WorldState to preserve player data from
 * @param preserveTime If true, keep current tick/hour/day/season; if false, reset to template defaults
 * @returns New WorldState with template applied and player data preserved
 */
export function reinitializeWorldFromTemplate(
  template: any,
  currentState: WorldState,
  preserveTime: boolean = false
): WorldState {
  if (!template) {
    console.warn('[worldEngine] No template provided to reinitializeWorldFromTemplate, skipping');
    return currentState;
  }

  // Helper for deep clone with fallback
  const structuredCloneSafe = (v: any) => {
    try {
      // @ts-ignore
      return structuredClone(v);
    } catch (e) {
      return JSON.parse(JSON.stringify(v));
    }
  };

  // Extract template data
  const newLocations = template.locations
    ? structuredCloneSafe(template.locations)
    : [
        { id: 'town', name: 'Town Square' },
        { id: 'forest', name: 'Forest' },
        { id: 'hill', name: 'Green Hill' },
        { id: 'lake', name: 'Silver Lake' }
      ];

  let newNpcs = template.npcs ? structuredCloneSafe(template.npcs) : [];
  // Beta Phase 5 Task 2: Initialize NPC inventories using helper function
  newNpcs = initializeNpcInventories(newNpcs, newLocations);
  
  // NPC inventories already initialized by initializeNpcInventories() call above
  
  const newQuests = template.quests ? structuredCloneSafe(template.quests) : [];
  const newFactions = template.factions
    ? structuredCloneSafe(template.factions)
    : [
        { id: 'silver-flame' },
        { id: 'ironsmith-guild' },
        { id: 'luminara-mercantile' },
        { id: 'shadow-conclave' },
        { id: 'adventurers-league' }
      ];

  // Create new faction reputation map (reset to neutral for new factions, preserve existing)
  const newFactionRep: Record<string, number> = {};
  newFactions.forEach((f: any) => {
    const factionId = f.id;
    newFactionRep[factionId] = currentState.player.factionReputation?.[factionId] ?? 0;
  });

  // Preserve player data
  const preservedPlayer = structuredCloneSafe(currentState.player);

  // Reset/update faction reputation
  preservedPlayer.factionReputation = newFactionRep;

  // Reset player location to first template location (or keep if location exists in new template)
  const existingLocationId = newLocations.find((l: any) => l.id === currentState.player.location)?.id;
  preservedPlayer.location = existingLocationId || (newLocations.length > 0 ? newLocations[0].id : 'town');

  // Reset quests to template-provided quests, but preserve quest state where applicable
  const newQuestState: Record<string, any> = {};
  newQuests.forEach((q: any) => {
    const questId = q.id;
    const existingQuestState = currentState.player.quests?.[questId];
    newQuestState[questId] = existingQuestState || { status: 'not_started', progress: 0 };
  });
  preservedPlayer.quests = newQuestState;

  // Clear combat state
  const newCombatState = {
    active: false,
    participants: [],
    turnIndex: 0,
    roundNumber: 0,
    log: [],
    initiator: ''
  };

  // Compute time: either preserve or reset based on parameter
  let newTick = 0;
  let newHour = 8;
  let newDay = 1;
  let newSeason = (template.season as WorldState['season']) || 'winter';
  let newDayPhase: WorldState['dayPhase'] = 'morning';

  if (preserveTime) {
    newTick = currentState.tick ?? 0;
    newHour = currentState.hour ?? 8;
    newDay = currentState.day ?? 1;
    newSeason = currentState.season ?? 'winter';
    newDayPhase = currentState.dayPhase ?? 'morning';
  }

  // Build new metadata with template origin
  const newMetadata = template.metadata ? structuredCloneSafe(template.metadata) : { audioVolume: 0.8, particleDensity: 'medium' };
  if (template.id || template.name || template.metadata?.templateId) {
    newMetadata.templateOrigin = template.id || template.name || template.metadata?.templateId;
  }
  newMetadata.blueprintSwappedAt = currentState.tick ?? 0; // Track when blueprint was swapped

  // Return new WorldState with template applied and player data preserved
  return {
    id: currentState.id,
    tick: newTick,
    seed: currentState.seed,
    hour: newHour,
    day: newDay,
    dayPhase: newDayPhase,
    season: newSeason,
    weather: currentState.weather ?? 'clear',
    locations: newLocations,
    npcs: newNpcs,
    quests: newQuests,
    player: preservedPlayer,
    needsCharacterCreation: currentState.needsCharacterCreation ?? false,
    time: {
      tick: newTick,
      baseHour: newHour,
      baseDay: newDay,
      hour: newHour,
      day: newDay,
      season: newSeason
    },
    resourceNodes: template.resourceNodes ? structuredCloneSafe(template.resourceNodes) : currentState.resourceNodes,
    activeEvents: [], // Reset all active world events
    combatState: newCombatState,
    factions: newFactions,
    factionConflicts: template.factionConflicts ? structuredCloneSafe(template.factionConflicts) : [],
    metadata: newMetadata,
    audio: currentState.audio || initializeAudioState(), // Preserve audio state

    // Preserve existing relic systems
    relics: currentState.relics || {},
    relicEvents: currentState.relicEvents || [],
    lastFactionTick: currentState.lastFactionTick ?? 0
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
  
  // Initialize Director AI state
  let directorState: DirectorState = initializeDirectorState();
  
  // Initialize Legacy Engine from template if provided
  const legacyEngine = getLegacyEngine(state.seed);
  if (state.metadata?.templateOrigin && templateJson) {
     legacyEngine.initFromTemplate(templateJson as any);
  }

  // Initialize Audio Engine state
  let audioState: AudioState = initializeAudioState();
  if (!state.audio) {
    state.audio = audioState;
  }
  
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

    // ALPHA_M15 Step 2: Store old NPC locations before updating (for transit events)
    const npcLocationMapBefore = new Map(state.npcs.map(npc => [npc.id, npc.locationId]));
    
    // M50-A4: Process macro events (world-scale modifiers)
    const { activeEvents: activeMacroEvents, effects: macroEffects, newEvents: macroEventTicks, createdScars: scarsDuringMacroEvents } = processMacroEvents(state);
    const npcsWithMacroEffects = state.npcs.map(npc => applyMacroEventEffectsToNpc(npc, macroEffects));
    // M51-D1: Accumulate world scars in state
    const accumulatedScars = [...(state.worldScars || []), ...(scarsDuringMacroEvents || [])];
    state = { ...state, npcs: npcsWithMacroEffects, worldScars: accumulatedScars };
    
    // M49-A3: Process autonomous NPCs (GOAP planning)
    // M51-A1: Apply faction strategy modifiers before GOAP planning
    let stateWithModifiers = state;
    if (state.factions && state.factions.length > 0) {
      const npcsWithStrategyModifiers = state.npcs.map(npc => {
        const npcFaction = state.factions?.find(f => f.id === npc.factionId);
        if (npcFaction && npcFaction.playerStrategy) {
          return applyStrategyModifierToNpc(npc, npcFaction);
        }
        return npc;
      });
      stateWithModifiers = { ...state, npcs: npcsWithStrategyModifiers };
    }
    let stateAfterAutonomy = processAutonomousNpcs(stateWithModifiers);
    
    // M49-A4: Process Soul Resonance (Ancestral Echoes)
    let stateAfterResonance = processSoulResonance(stateAfterAutonomy);
    state = stateAfterResonance;
    
    // Update NPC locations via scheduleEngine
    const npcLocationUpdates = updateNpcLocations(state.npcs, nextHour);
    const updatedNpcs = applyLocationUpdates(state.npcs, npcLocationUpdates);

    // M55-B1: Update NPC social relationships (co-location tracking)
    // This increments coLocationTicks for NPCs at the same location
    const { npcSocialEngine } = require('./npcSocialAutonomyEngine');
    npcSocialEngine.updateRelationshipsTick(updatedNpcs, nextTick);

    // M55-C1: Process NPC social interactions (GOSSIP, persuasion, etc.)
    // This triggers social intents when conditions are met (e.g., coLocationTicks > 50 for GOSSIP)
    const socialTickResult = npcSocialEngine.processNpcSocialTick(updatedNpcs, state, nextTick, 0.08);
    if (socialTickResult.descriptions && socialTickResult.descriptions.length > 0) {
      console.log(`[NpcSocialTick] ${socialTickResult.interactionsOccurred} interactions: ${socialTickResult.descriptions.join('; ')}`);
    }

    // M55-B1/C1: Process NPC autonomous actions (gossip, harvest, trade)
    // NPCs with active plans execute their next action
    const { getGoalOrientedPlanner } = require('./goalOrientedPlannerEngine');
    const planner = getGoalOrientedPlanner();
    for (const npc of updatedNpcs) {
      const plan = planner.getPlanForNpc(npc.id);
      if (plan && plan.isExecuting && plan.currentActionIndex < plan.actions.length) {
        const action = plan.actions[plan.currentActionIndex];
        // Process action via actionPipeline for HARVEST_RESOURCE, move, etc.
        // This will be called next in the main action resolution pipeline
        // For now, actions are queued in the plan and executed via processAction
      }
    }

    // M50-A1: Process faction skirmishes at locations with hostile NPCs
    const tempStateForSkirmishes = { ...state, npcs: updatedNpcs };
    const skirmishResults = resolveLocationSkirmishes(tempStateForSkirmishes);
    const skirmishEvents: Event[] = [];
    for (const result of skirmishResults) {
      skirmishEvents.push(...result.events);
    }

    // Filter available locations based on season conditions
    const availableLocations = state.locations.filter(loc => 
      !loc.conditionalSeason || loc.conditionalSeason === nextSeason
    );

    // Calculate required audio for current world state
    const nextAudio = calculateRequiredAudio(
      { ...state, hour: nextHour, dayPhase: nextDayPhase, season: nextSeason, weather: nextWeather, npcs: updatedNpcs },
      state.audio
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
      audio: nextAudio,
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

    // M50-A1: Append faction skirmish events
    for (const skirmishEvent of skirmishEvents) {
      appendEvent(skirmishEvent);
    }

    // M50-A4: Append macro event activity logs
    for (const macroEvent of macroEventTicks) {
      appendEvent(macroEvent);
    }

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

    // ALPHA_M15 Step 2: Emit NPC_DEPARTED and NPC_ARRIVED for each NPC that moved
    Object.entries(npcLocationUpdates).forEach(([npcId, newLocationId]) => {
      const npc = updatedNpcs.find(n => n.id === npcId);
      const oldLocationId = npcLocationMapBefore.get(npcId);
      if (npc && oldLocationId && oldLocationId !== newLocationId) {
        // Emit NPC_DEPARTED from old location
        const departedEv: Event = {
          id: `npc-departed-${Date.now()}-${npcId}`,
          worldInstanceId: state.id,
          actorId: npcId,
          type: "NPC_DEPARTED",
          payload: { npcId, npcName: npc.name, fromLocation: oldLocationId, toLocation: newLocationId, hour: nextHour },
          templateOrigin: state.metadata?.templateOrigin,
          timestamp: Date.now(),
        };
        appendEvent(departedEv);

        // Emit NPC_ARRIVED at new location
        const arrivedEv: Event = {
          id: `npc-arrived-${Date.now()}-${npcId}`,
          worldInstanceId: state.id,
          actorId: npcId,
          type: "NPC_ARRIVED",
          payload: { npcId, npcName: npc.name, atLocation: newLocationId, fromLocation: oldLocationId, hour: nextHour },
          templateOrigin: state.metadata?.templateOrigin,
          timestamp: Date.now(),
        };
        appendEvent(arrivedEv);

        // Also emit NPC_LOCATION_CHANGED for backwards compatibility
        const movedEv: Event = {
          id: `npc-moved-${Date.now()}-${npcId}`,
          worldInstanceId: state.id,
          actorId: npcId,
          type: "NPC_LOCATION_CHANGED",
          payload: { npcId, npcName: npc.name, from: oldLocationId, to: newLocationId },
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

    // ALPHA_M4: Check for expired status effects
    try {
      const nowTick = nextTick;
      const statusTickEv: Event = {
        id: `status-tick-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'system',
        type: 'STATUS_EFFECT_TICK',
        payload: { currentTick: nowTick },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
      };
      appendEvent(statusTickEv);
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

    // Phase 11: Faction ticks - process every 24 game hours (M11)
    {
      const lastFactionTick = state.lastFactionTick ?? 0;
      const hoursSinceLastTick = nextHour + (nextDay - Math.floor((lastFactionTick + baseHour) / 24)) * 24 - (lastFactionTick % 24);
      
      if (hoursSinceLastTick >= 24) {
        // Resolve faction turns to update power, territories, conflicts
        if (state.factions && state.factionRelationships) {
          const { updatedFactions, updatedRelationships, events: factionTurnEvents } = resolveFactionTurns(
            state,
            state.factions,
            state.factionRelationships,
            state.factionConflicts || []
          );
          
          // Apply faction state updates
          state = {
            ...state,
            factions: updatedFactions,
            factionRelationships: updatedRelationships
          };
          
          // Emit all faction turn events
          factionTurnEvents.forEach(ev => appendEvent(ev));
        }
        
        // Trigger faction struggle event for summary
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

        // M15 Step 5: Process daily influence diffusion for geopolitical dynamics
        if (state.factions && state.locations) {
          try {
            const { updatedState: diffusedState, events: influenceEvents } = processDailyInfluenceDiffusion(state, state.id);
            state = diffusedState;
            
            // Emit all influence shift events
            influenceEvents.forEach(ev => appendEvent(ev));
          } catch (err) {
            // Non-fatal: influence diffusion is best-effort
            console.warn('[advanceTick] Influence diffusion error:', err);
          }
        }

        // M16 Step 3: Process daily metagaming suspicion decay (-5 per 24h cycle)
        {
          if (state.player.suspicionLevel && state.player.suspicionLevel > 0) {
            const suspicionDecay = 5;
            const newSuspicionLevel = Math.max(0, state.player.suspicionLevel - suspicionDecay);
            if (newSuspicionLevel !== state.player.suspicionLevel) {
              const decayEv: Event = {
                id: `suspicion-decay-${Date.now()}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'SUSPICION_DECAYED',
                payload: {
                  previousLevel: state.player.suspicionLevel,
                  newLevel: newSuspicionLevel,
                  decayAmount: suspicionDecay,
                  tick: nextTick,
                  reason: 'Daily passive decay - reality stabilizing'
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(decayEv);
              
              state = {
                ...state,
                player: {
                  ...state.player,
                  suspicionLevel: newSuspicionLevel
                }
              };
            }
          }
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

    // === ALPHA_M1: AI Director Evaluation ===
    // Director observes world state and emits proactive narrative events
    try {
      const directorEvents = evaluateDirectorIntervention(state, directorState);
      directorEvents.forEach(ev => appendEvent(ev));
    } catch (err) {
      // Non-fatal: Director is advisory only
      console.warn('[Director] Evaluation error:', err);
    }

    // === ALPHA_M2: Artifact Relic Rebellion Checks ===
    // High paradox can cause equipped relics to rebel autonomously
    try {
      const paradoxLevel = (state.player as any).temporalDebt ?? 0;
      const equippedRelicIds = state.player.equippedRelics || [];
      const equippedRelics: Relic[] = equippedRelicIds
        .map(id => state.relics?.[id])
        .filter((r): r is Relic => r !== undefined);
      
      for (const relic of equippedRelics) {
        // === M12: Sentient Relic Dialogue (every 12-24 hours) ===
        // Sentient relics emit dialogue based on game state
        const lastSpoke = relic.lastSpokeAt ?? 0;
        const hoursSinceSpoke = nextTick - lastSpoke;
        const dialogueCheckInterval = Math.floor(12 + (Math.random() * 12)); // 12-24 hour randomness
        
        if (relic.sentienceLevel >= 2 && hoursSinceSpoke >= dialogueCheckInterval) {
          // Determine dialogue context
          let dialogueContext: 'danger' | 'rival_killed' | 'paradox_surge' | 'greeting' = 'greeting';
          if (paradoxLevel > 75) {
            dialogueContext = 'paradox_surge';
          } else if (state.combatState?.active) {
            dialogueContext = 'danger';
          }
          
          const relicMessage = generateRelicDialogue(relic, dialogueContext);
          const dialogueEv: Event = {
            id: `relic-message-${Date.now()}-${relic.id}`,
            worldInstanceId: state.id,
            actorId: relic.id,
            type: 'RELIC_MESSAGE',
            payload: {
              relicId: relic.id,
              relicName: relic.name,
              sentienceLevel: relic.sentienceLevel,
              message: relicMessage,
              context: dialogueContext
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(dialogueEv);
          relic.lastSpokeAt = nextTick;
        }
        
        if (shouldRelicRebel(relic, paradoxLevel)) {
          const rebellionInfo = applyRelicRebellion(relic);
          
          const rebellionEv: Event = {
            id: `relic-rebellion-${Date.now()}-${relic.id}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'RELIC_REBELLION_AUTO',
            payload: {
              relicId: relic.id,
              relicName: relic.name,
              message: rebellionInfo.message,
              effect: rebellionInfo.effect,
              paradoxLevel,
            },
            templateOrigin: state.metadata?.templateOrigin,
            mutationClass: 'SYSTEM',
            timestamp: Date.now(),
          };
          appendEvent(rebellionEv);
          
          // Apply effect to state
          if (rebellionInfo.effect === 'strike') {
            state = {
              ...state,
              player: {
                ...state.player,
                hp: Math.max(0, (state.player.hp ?? 0) - 10),
              }
            };
          }
          // Other effects (disable/reverse) are state-neutral and handled in UI
        }
      }
    } catch (err) {
      // Non-fatal: relic rebellion is advisory
    }

    // === M12: Artifact Faction Influence ===
    // Equipped relics that are faction-aligned provide power bonuses during faction turns
    try {
      const ticksPerDay = 24;
      if ((state.tick ?? 0) % ticksPerDay === 0 && (state.tick ?? 0) > 0) {
        // Check equipped relics for faction alignment
        const equippedRelicIds = state.player.equippedRelics || [];
        const updatedFactions = [...(state.factions || [])];

        equippedRelicIds.forEach(relicId => {
          const relic = state.relics?.[relicId];
          if (relic && relic.factionId) {
            // Relic is faction-aligned: grant +10 power bonus to associated faction
            const factionIndex = updatedFactions.findIndex(f => f.id === relic.factionId);
            if (factionIndex >= 0) {
              const faction = updatedFactions[factionIndex];
              faction.powerScore = (faction.powerScore || 0) + 10;

              // Emit artifact influence event
              const influenceEv: Event = {
                id: `relic-influence-${Date.now()}-${relicId}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'RELIC_FACTION_INFLUENCE',
                payload: {
                  relicId,
                  relicName: relic.name,
                  factionId: relic.factionId,
                  factionName: faction.name,
                  powerBonus: 10,
                  message: `${relic.name} channels mystical power to ${faction.name}, increasing their strength.`
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(influenceEv);
            }
          }
        });

        // Update factions with influence changes before standard resolution
        state = {
          ...state,
          factions: updatedFactions
        };
      }
    } catch (err) {
      // Non-fatal: relic influence is advisory
    }

    // === ALPHA_M3: Faction Turn Resolution ===
    // Every 24 ticks (1 day), resolve faction power dynamics
    try {
      const ticksPerDay = 24;
      if ((state.tick ?? 0) % ticksPerDay === 0 && (state.tick ?? 0) > 0) {
        const factionTurnsResult = resolveFactionTurns(
          state,
          state.factions || [],
          state.factionRelationships || [],
          state.factionConflicts || []
        );

        // Update state with faction changes
        state = {
          ...state,
          factions: factionTurnsResult.updatedFactions,
          factionRelationships: factionTurnsResult.updatedRelationships,
          factionConflicts: factionTurnsResult.updatedConflicts
        };

        // Emit faction events
        factionTurnsResult.events.forEach(eventData => {
          const factionEv: Event = {
            id: `faction-event-${Date.now()}-${Math.random()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: eventData.type as any,
            payload: eventData,
            templateOrigin: state.metadata?.templateOrigin,
            mutationClass: 'SYSTEM',
            timestamp: Date.now(),
          };
          appendEvent(factionEv);
        });
      }
    } catch (err) {
      // Non-fatal: faction turns are advisory
      console.warn('[Faction Engine] Turn resolution error:', err);
    }

    // BETA Phase 2: Periodic auto-snapshotting every 100 ticks
    if (nextTick % 100 === 0 && nextTick > 0) {
      try {
        const { createWorldSnapshot } = require('../events/mutationLog');
        const { snapshotEvent } = createWorldSnapshot(state.id, state, nextTick);
        appendEvent(snapshotEvent);
        // Snapshot created. Events after this point will only replay ~100 ticks on fast load
      } catch (err) {
        console.warn('[Snapshot Engine] Periodic snapshot failed at tick', nextTick, err);
      }
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
      // Export NPC social memory to world state before saving (Phase 3)
      try {
        const { exportSocialScarsToWorldState } = require('../engine/npcMemoryEngine');
        exportSocialScarsToWorldState(state);
      } catch (err) {
        console.warn('[Save] Failed to export social scars to world state:', err);
      }
      
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
        
        // Hydrate NPC social memory from world state (Phase 3)
        try {
          const { hydrateScarsFromWorldState } = require('../engine/npcMemoryEngine');
          hydrateScarsFromWorldState(parsed);
        } catch (err) {
          console.warn('[Load] Failed to hydrate social scars from world state:', err);
        }
        
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

  /**
   * M49-A5: Dev toggle to force-trigger a Soul Echo for manual narrative testing
   */
  function triggerSoulEcho(echoId?: string): Event | null {
    const legacyEngine = getLegacyEngine(state.seed);
    const allEchoes: any[] = [];
    
    // Collect all available echoes
    for (const registry of (legacyEngine as any).soulEchoRegistries?.values?.() || []) {
      if (registry.echoes) {
        allEchoes.push(...registry.echoes);
      }
    }

    if (allEchoes.length === 0) {
      console.warn('[DEV] No soul echoes available');
      return null;
    }

    // Select echo by ID or random
    const selectedEcho = echoId 
      ? allEchoes.find(e => e.id === echoId) || allEchoes[0]
      : allEchoes[Math.floor(Math.random() * allEchoes.length)];

    if (!selectedEcho) {
      console.warn('[DEV] Could not select echo');
      return null;
    }

    // Apply resonance boost and echo trigger
    const advice = selectedEcho.ancestralAdvice || `Ancestral wisdom from ${selectedEcho.originalNpcName}`;
    state = {
      ...state,
      player: {
        ...state.player,
        activeResonanceEchoId: selectedEcho.id,
        activeResonanceAdvice: advice,
        soulResonanceLevel: Math.min(100, (state.player as any).soulResonanceLevel || 50 + 20)
      }
    };

    const echoEvent: Event = {
      id: `dev-echo-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: 'system',
      type: 'DEV_SOUL_ECHO_TRIGGERED',
      payload: {
        echoId: selectedEcho.id,
        echoName: selectedEcho.originalNpcName,
        echoType: selectedEcho.echoType,
        advice
      },
      templateOrigin: 'dev',
      timestamp: Date.now()
    };

    appendEvent(echoEvent);
    emit();

    console.log(`[DEV] Soul Echo triggered: ${selectedEcho.originalNpcName} (${selectedEcho.echoType})`);
    return echoEvent;
  }

  function triggerMacroEvent(eventType: string, duration?: number, epicenter?: string): any {
    const { triggerMacroEvent: trigger } = require('./macroEventsEngine');
    const macroEvent = trigger(state, eventType as any, duration, epicenter);
    
    const event: Event = {
      id: `dev-macro-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: 'system',
      type: 'DEV_MACRO_EVENT_TRIGGERED',
      payload: {
        eventId: macroEvent.id,
        eventType: macroEvent.type,
        name: macroEvent.name,
        severity: macroEvent.severity,
        epicenter,
        affectedLocationCount: macroEvent.affectedLocationIds?.length || 0
      },
      templateOrigin: 'dev',
      timestamp: Date.now()
    };

    appendEvent(event);
    emit();

    console.log(`[DEV] Macro Event triggered: ${macroEvent.name} (severity: ${macroEvent.severity.toFixed(0)})`);
    return event;
  }

  const devApi = Object.freeze({ start, stop, performAction, advanceTick, subscribe, save, load, getState: getStateClone, replayEvents, switchTemplate, getRecentMutations, triggerSoulEcho, triggerMacroEvent });

  const kernelApi = Object.freeze({ getState: getStateClone, performAction, advanceTick, load, getRecentMutations });

  return dev ? devApi as any : kernelApi as any;
}

export default createWorldController;

/**
 * M49-A3: Process Autonomous NPC Planning via GOAP
 * 
 * For NPCs without static routines or those needing new plans,
 * generate goals and action plans based on their personality traits.
 * Plans are stored on the NPC object for persistence via Save/Load.
 */
export function processAutonomousNpcs(state: WorldState): WorldState {
  const planner = getGoalOrientedPlanner(state.seed);
  let updatedNpcs = [...state.npcs];

  for (let i = 0; i < updatedNpcs.length; i++) {
    const npc = updatedNpcs[i];
    
    // Skip NPCs with static routines (they rely on scheduleEngine)
    if (npc.routine && Object.keys(npc.routine).length > 0) {
      continue;
    }

    // M49-A3: Check if NPC needs a new plan or plan execution reset
    const shouldGeneratePlan = !npc.currentActionPlan || 
      (npc.currentActionPlan.currentActionIndex >= npc.currentActionPlan.actions.length);

    if (shouldGeneratePlan && npc.personality) {
      // Generate a personality-based goal
      const goal = generateGoalFromPersonality(npc, state);
      
      if (goal) {
        // Create plan via GOAP
        const plan = planner.createPlan(npc, goal, npc.personality, state);
        
        if (plan) {
          updatedNpcs[i] = { ...npc, currentActionPlan: plan };
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[GOAP] NPC '${npc.name}' plans goal '${goal.goalType}' -> location '${goal.targetLocationId}'`);
          }
        }
      }
    } else if (npc.currentActionPlan && npc.currentActionPlan.isExecuting) {
      // Advance plan execution on each tick
      const updatedPlan = {
        ...npc.currentActionPlan,
        currentActionIndex: npc.currentActionPlan.currentActionIndex + 1
      };
      updatedNpcs[i] = { ...npc, currentActionPlan: updatedPlan };
    }
  }

  return { ...state, npcs: updatedNpcs };
}

/**
 * M49-A4: Process Soul Resonance and Ancestral Echoes
 */
export function processSoulResonance(state: WorldState): WorldState {
  const legacyEngine = getLegacyEngine(state.seed);
  const resonanceResult = legacyEngine.calculateResonance(state);

  if (resonanceResult.resonanceDelta === 0 && !resonanceResult.triggeredEchoId) {
    return state;
  }

  const updatedPlayer = {
    ...state.player,
    soulResonanceLevel: Math.min(100, Math.max(0, ((state.player as any).soulResonanceLevel || 0) + resonanceResult.resonanceDelta)),
    activeResonanceEchoId: resonanceResult.triggeredEchoId || state.player.activeResonanceEchoId,
    activeResonanceAdvice: resonanceResult.advice || state.player.activeResonanceAdvice,
    lastSoulResonanceTick: resonanceResult.triggeredEchoId ? state.tick : (state.player as any).lastSoulResonanceTick
  };

  // If a new echo was triggered, log it
  if (resonanceResult.triggeredEchoId && resonanceResult.advice) {
    // eslint-disable-next-line no-console
    console.log(`[SOUL RESONANCE] Ancestral advice: "${resonanceResult.advice}" (Echo: ${resonanceResult.triggeredEchoId})`);
  }

  return {
    ...state,
    player: updatedPlayer
  };
}

/**
 * M49-A3: Generate a goal from NPC personality traits
 * Uses the 6-dimension trait model to decide what the NPC wants to do.
 */
function generateGoalFromPersonality(npc: NPC, state: WorldState): NpcGoal | null {
  const p = npc.personality || {
    boldness: 50,
    caution: 50,
    sociability: 50,
    ambition: 50,
    curiosity: 50,
    honesty: 50
  };

  // Weighted goal selection based on traits
  const goalWeights: { type: string; weight: number; targetFinder: () => string | undefined }[] = [];

  // High curiosity -> explore
  if ((p.curiosity || 0) > 60) {
    goalWeights.push({
      type: 'explore',
      weight: (p.curiosity || 0) - 50,
      targetFinder: () => findRandomUndiscoveredLocation(state)
    });
  }

  // High sociability -> socialize
  if ((p.sociability || 0) > 60) {
    goalWeights.push({
      type: 'socialize',
      weight: (p.sociability || 0) - 50,
      targetFinder: () => findNearbyNpc(npc, state)
    });
  }

  // High boldness -> seek combat/challenge
  if ((p.boldness || 0) > 70 && (p.caution || 0) < 40) {
    goalWeights.push({
      type: 'combat',
      weight: (p.boldness || 0) - 50,
      targetFinder: () => findEnemyOrChallenge(npc, state)
    });
  }

  // Default: rest or gather
  goalWeights.push({
    type: 'rest',
    weight: 30,
    targetFinder: () => npc.locationId
  });

  if (goalWeights.length === 0) {
    return null;
  }

  // Random weighted selection
  const totalWeight = goalWeights.reduce((sum, gw) => sum + gw.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedGoal = goalWeights[0];

  for (const gw of goalWeights) {
    roll -= gw.weight;
    if (roll <= 0) {
      selectedGoal = gw;
      break;
    }
  }

  const targetId = selectedGoal.targetFinder();

  const goal: NpcGoal = {
    id: `goal_${npc.id}_${Date.now()}`,
    goalType: selectedGoal.type as any,
    priority: 50,
    targetLocationId: selectedGoal.type === 'explore' ? targetId : undefined,
    targetNpcId: selectedGoal.type === 'socialize' ? targetId : undefined,
    isCompleted: false,
    progressValue: 0
  };

  return goal;
}

/**
 * Helper: Find a random undiscovered location
 */
function findRandomUndiscoveredLocation(state: WorldState): string | undefined {
  const undiscovered = state.locations.filter(loc => !loc.discovered);
  if (undiscovered.length === 0) {
    // Fallback to any location
    return state.locations[Math.floor(Math.random() * state.locations.length)]?.id;
  }
  return undiscovered[Math.floor(Math.random() * undiscovered.length)].id;
}

/**
 * Helper: Find a nearby NPC for socialization
 */
function findNearbyNpc(npc: NPC, state: WorldState): string | undefined {
  const nearbyNpcs = state.npcs.filter(n => n.id !== npc.id && n.locationId === npc.locationId);
  return nearbyNpcs.length > 0 ? nearbyNpcs[Math.floor(Math.random() * nearbyNpcs.length)].id : undefined;
}

/**
 * Helper: Find an enemy or challenge location
 */
function findEnemyOrChallenge(npc: NPC, state: WorldState): string | undefined {
  // For now, return a random location other than current
  const otherLocations = state.locations.filter(loc => loc.id !== npc.locationId);
  return otherLocations.length > 0 ? otherLocations[Math.floor(Math.random() * otherLocations.length)].id : undefined;
}

/**
 * ALPHA_M8 Phase 1, Step 3: Narrative Audio Triggers
 * 
 * Processes SET_AUDIO_PARAM events to apply temporary audio overrides
 * to the calculated audio state. These events are typically emitted by:
 * - aiDmEngine (Director) for narrative tension moments
 * - Other systems for special audio effects (combat, discovery, etc)
 */
export function processAudioParameterEvents(
  currentAudio: AudioState,
  events: Event[]
): AudioState {
  let resultAudio = currentAudio;

  for (const event of events) {
    if (event.type === 'SET_AUDIO_PARAM' && event.payload) {
      const mutation = {
        bgm: event.payload.bgm,
        masterVolume: event.payload.masterVolume,
        duckingAmount: event.payload.duckingAmount,
        duckingDuration: event.payload.duckingDuration,
      };
      resultAudio = applyAudioParameterMutation(resultAudio, mutation);
    }
  }

  return resultAudio;
}

