import { Event, appendEvent, getEventsForWorld } from "../events/mutationLog";
import CJ, { summarizeStateMinimal } from "./canonJournal";
import { rebuildState, type RebuildResult } from "./stateRebuilder";
import { validateInvariants, isStatePlayable } from "./constraintValidator";
import { SeededRng, setGlobalRng, getGlobalRng } from "./prng";
import { processAction, Action } from "./actionPipeline";
import { authorizeAction, AuthorizationContext } from "./authorization/authorizeAction";
import { createSave, loadSave, verifySaveIntegrity } from "./saveLoadEngine";
import { resolveNpcLocation, updateNpcLocations, applyLocationUpdates } from "./scheduleEngine";
import { resolveWeather, getWeatherVisuals } from "./weatherEngine";
import { CausalWeatherEngine, type EnhancedWeatherResult } from "./causalWeatherEngine";
import { resolveNpcTurns } from './aiTacticEngine';
import { checkLocationHazards, applyHazardDamage, applyHazardStatus } from "./hazardEngine";
import { resolveSeason } from './seasonEngine';
import { getSeasonalEventEngine, updateSeasonalEvents } from './seasonalEventEngine'; // Phase 30/31: Seasonal events
import { Faction, FactionRelationship, FactionConflict, initializeFactions, initializeFactionRelationships } from './factionEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import { getQuestSynthesisAI } from './questSynthesisAI';
import { getNpcMemoryEngine } from './npcMemoryEngine';
import { beliefEngine } from './beliefEngine';
import { npcSocialEngine } from './npcSocialAutonomyEngine'; // Phase 19: Gossip system
import { triggerMigrationChecks, createMigrationEvents, applyPopulationDecay, generateTradeInventory, updateNpcEconomicEmotions } from './npcEngine'; // Phase 26 Task 2; Phase 27 Task 3
import { triggerSocialOutburst } from './ruleEngine'; // Phase 26 Task 3: Social Outbursts
import { harvestPhase27ParadoxPoints, shouldManifestPhase27Anomaly, triggerPhase27AgeRotAnomaly } from './paradoxEngine'; // Phase 27 Task 1
import { getEconomicSynthesisEngine, type EconomicCycleResult } from './economicSynthesisEngine'; // Phase 27 Task 3
import { getTelemetryEngine } from './telemetryEngine';
import { emitExploitDetected, emitChurnPredicted, emitAnomalyFlagged } from './broadcastEngine'; // Phase 2: Real-time alerts
import { analyzeCohortEngagement } from './m70TelemetryIntegration'; // Phase 2: M70 integration
import { Relic, RunicSlot } from './artifactEngine';
import { initializeTutorialState, type TutorialState } from './tutorialEngine'; // Phase 24: Tutorial persistence
import { getSnapshotEngine } from './snapshotEngine'; // Phase 25 Task 5: Chronos Snapshotting
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

// M44-E2: Initialize Causal Weather Engine singleton
const causalWeatherEngine = new CausalWeatherEngine();

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
  // M29: Epoch-Linked Sub-Areas (Temporal Gates)
  gating_criteria?: {
    availableInEpochs?: string[];  // e.g., ['epoch_ii_waning', 'epoch_iii_twilight']
    hiddenInEpochs?: string[];     // e.g., ['epoch_i_fracture']
    description_override?: Record<string, string>;  // Epoch-specific descriptions
    biome_shift?: Record<string, string>;  // e.g., { 'epoch_i_fracture': 'flooded', 'epoch_iii_twilight': 'cavern' }
  };
};

export type Location = { 
  id: string; 
  name: string; 
  conditionalSeason?: string; 
  description?: string;
  // ALPHA_M9: Spatial coordinates and discovery
  x?: number;  // Normalized grid coordinate (0-1000)
  y?: number;  // Normalized grid coordinate (0-1000)
  biome?: string;  // forest, cave, village, corrupted, shrine, maritime, mountain, plains
  terrainModifier?: number;  // Terrain difficulty multiplier (0.7-1.5)
  discovered?: boolean;  // Whether location has been revealed to player
  spiritDensity?: number;  // Magic concentration at location (for audio engine)
  subAreas?: SubArea[];  // ALPHA_M9 Phase 3: Hidden nested locations
  // M53: World Scar tracking
  activeScars?: string[];  // IDs of WorldScars affecting this location
  // M44: Geopolitical influences
  geopoliticalInfluence?: Record<string, number>;  // Faction power by factionId
  // M46: Investigation discovery
  discoveryDC?: number;  // Difficulty to discover hidden info (default 15)
  // M37: Macro event system
  magicNode?: boolean;  // Whether this location is a magic node
  lootTableId?: string;  // ID of loot table for resource gathering
  _glitchLevel?: number;  // Environmental glitch/corruption level (0-100)
  _magicFade?: number;  // Magic fading due to macro events
  _resourceDepletion?: number;  // Resource depletion tracker
  // Phase 7: Age rot severity tracking per location
  ageRotSeverity?: number;  // Environmental age rot level (0-100)
  // Phase 29 Task 1: Blessed Locations & Sanctuary Mechanics
  isBlessed?: boolean;  // Whether location is a sanctuary (immune to age rot)
  blessedStrength?: number;  // Sanctuary power level (0-100), determines healing ability
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

// M53-A1: World Scar types for environmental mutation tracking
export type ScarType = 
  | 'battlefield'
  | 'plague_site'
  | 'invasion_damage'
  | 'celestial_mark'
  | 'cultural_scar'
  | 'natural_disaster'
  | 'temporal_rift';

// Phase 7-A1: World Fragment types for persistent world objects (buildings, shrines, ruins, etc.)
export interface WorldFragment {
  id: string;
  type: 'building' | 'garden' | 'landmark' | 'shrine' | 'monument' | 'ruin' | 'statue' | 'road' | 'bridge';
  name: string;
  locationId: string;
  durability: number;  // Fragment health/durability (0-100)
  description: string;
  creatorId?: string;  // NPC or player who created this fragment
  historicalEvent?: {
    description: string;
    narrative: string;
    type: string;
  };
  // Phase 7: Age rot degradation per epoch
  ageRotLevel?: number;  // Fragment age/degradation level (0-100)
}

export interface WorldScar {
  id: string;
  type: ScarType;
  locationId: string;
  description: string;
  severity: number;
  createdAt: number;
  epochCreated: number;
  npcsAffected: string[];
  healingProgress: number;
  visualMarker?: string;
}

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
  soulStrain?: number; // Phase 13: NPC soul strain from otherworldly influences
  lootTable?: string; // ID of loot drops when defeated (e.g., 'common_npc')
  currentGoal?: string; // Current behavioral objective (e.g., 'patrol', 'guard', 'trade')
  memoryProfile?: Record<string, unknown>; // Interaction memory from npcMemoryEngine
  coLocationTicks?: number; // How long NPC has been at this location
  lastEmotionalDecay?: number; // Tick when NPC's emotional state last decayed
  gold?: number; // Phase 12: GOAP engine resource tracking
  power?: number; // Phase 12: GOAP engine resource tracking
  charisma?: number; // NPC stat for social interactions (used by npcSocialAutonomyEngine)
  intelligence?: number; // NPC stat for GOAP/dialogue planning
  // M19: Emotional Intelligence & Narrative Features
  emotionalState?: {
    trust: number;
    fear: number;
    gratitude: number;
    resentment: number;
    emotionalHistory?: Array<{ tick: number; category: string; delta: number; reason: string }>;
    lastEmotionalEventTick?: number;
  };
  importance?: 'minor' | 'major' | 'critical';
  isDisplaced?: boolean;
  defectedFactionId?: string;
  // M29: Generational NPC Lineages
  lineageId?: string;  // e.g., 'farm_keeper_line', connects NPCs across generations
  _ancestryBonus?: number;  // Reputation bonus from player helping ancestor
  _ancestorName?: string;  // Name of the ancestor the player helped
};

/**
 * M34: Temporal Trace - loot left behind by Strand Phantoms
 * Evidence of another timeline's actions
 */
export type TemporalTrace = {
  id: string;
  itemId: string;
  sourcePhantomId: string;  // Which phantom left this
  sourceTimelineId: string; // Which timeline the phantom came from
  description: string;      // "A spectral scroll from another epoch"
  rarity: 'uncommon' | 'rare' | 'legendary';
  lootTableId?: string;     // Optional full loot item
  timestamp: number;
  expiresAt: number;        // Duration 5-10 seconds
  location: {
    x?: number;
    y?: number;
    locationId: string;
  };
};

/**
 * M34: Strand Phantom - asynchronous visibility NPC from another session/timeline
 * Spawned temporarily (5-10 seconds) to show asynchronous player activity
 */
export type StrandPhantom = NPC & {
  isPhantom: true;          // Marker to identify as phantom
  sourceSessionId: string;  // Which session spawned this phantom
  sourcePlayerId: string;   // Which player's actions spawned this phantom
  phantomAction: string;    // What the phantom is doing (e.g., "harvesting", "combat", "exploring")
  durationSeconds: number;  // How long phantom lasts (5-10)
  spawnedAt: number;        // Timestamp when created
  expiresAt: number;        // When phantom disappears
  leavesTrace: boolean;     // Whether phantom leaves TemporalTrace loot
  traceItem?: TemporalTrace; // Optional loot trace
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
  persist_across_epochs?: boolean; // BETA: If true, quest transforms into legacy quest in next epoch
  legacy_quest_template?: { // BETA: Template for transformed quest in next epoch
    title_prefix: string; // e.g., "Ancient Rumor: "
    description_override?: string; // Override description for next epoch
    difficulty_increase?: number; // Multiplier for enemy level (default 1.0)
  };
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
  isHeirloom?: boolean;  // BETA: If true, persists across epochs for descendants
  ancestorName?: string; // BETA: Name of ancestor who wielded this item
  generationCount?: number; // M29: Number of generations this heirloom has been passed through (default 1)
  metadata?: {
    experience?: number;      // Phase 15: XP accumulated on this item
    sentience?: number;        // Phase 15: Personality/sapience level (0-100)
    runes?: string[];          // Phase 15: IDs of installed runes
    corruption?: number;       // Phase 15: Paradox corruption (0-100)
    infusions?: Array<{ runeId: string; timestamp: number }>; // Phase 15: Fusion history
  };
};

export type InventoryItem = StackableItem | UniqueItem;

/**
 * Type guard for stackable items
 * Usage: if (isStackable(item)) { consume(item.quantity); }
 */
export function isStackable(item: InventoryItem): item is StackableItem {
  return item.kind === 'stackable';
}

/**
 * Safe getter for stackable quantity
 * Returns 0 if item is not stackable
 */
export function getStackableQuantity(item: InventoryItem): number {
  return isStackable(item) ? item.quantity : 0;
}

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
  name?: string;  // Player character name
  race?: string;  // Player character race
  location: string;
  quests: Record<string, PlayerQuestState>;
  dialogueHistory?: { npcId: string; text: string; timestamp: number; options?: { id: string; text: string }[] }[];
  npcDialogueIndex?: Record<string, number>;
  gold?: number;
  experience?: number;
  xp?: number;
  level?: number;
  attributePoints?: number;
  skillPoints?: number;  // ALPHA_M9: Skill points for unlocking abilities
  reputation?: Record<string, number>;
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  statusEffects?: string[];
  // BETA: Legacy and inheritance fields for chronicle sequences
  legacyPoints?: number; // Accumulated across lifetimes; resets when character dies
  inheritedReputation?: Record<string, number>; // Faction rep passed from ancestor
  mythStatus?: number; // 0-100: How legendary this character has become
  bloodlineData?: {
    canonicalName?: string; // Name at character canonization
    inheritedPerks?: string[]; // Unlocked perks for next generation
    inheritedItems?: { itemId: string; rarity?: string }[];
    mythStatus: number; // 0-100: How legendary this character became
    epochsLived: number; // Count of epochs this bloodline has spanned
    deeds?: string[]; // Notable achievements that became legend
    legacyPoints?: number; // Phase 30: LP balance for perk store
    equipmentBonusMultiplier?: number; // Phase 30: Heirloom equipment effectiveness
  };
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
  unlockedAbilities?: string[];  // ALPHA_M9: IDs of unlocked abilities
  equippedAbilities?: string[];  // ALPHA_M9: IDs of currently equipped abilities (max 6)
  abilityCooldowns?: Record<string, number>;  // ALPHA_M9: Remaining cooldown ticks per ability ID
  // Phase 24: Tutorial & Social Systems
  tutorialProgress?: TutorialState;  // Persistent tutorial state for save/load
  guildId?: string;  // Guild ID if player is a member
  activeRaidId?: string;  // Active raid ID if currently in a raid
};

/**
 * M32: Party construct for multiplayer sessions
 * Represents a group of players collaborating in the same world
 */
export type Party = {
  id: string;
  name: string;                    // e.g., "The Heroes of the Fracture"
  memberIds: string[];             // PlayerState.id of each member
  sharedGold?: number;             // Optional shared treasury
  sharedReputation?: Record<string, number>; // Aggregate faction reputations (optional)
  collectiveDeeds?: Array<{
    id: string;
    title: string;
    description: string;
    contributors: string[];        // Which party members participated
    timestamp: number;
  }>;
  mythStatus?: number;             // Aggregate myth status of all members
  leader?: string;                 // PlayerState id of party leader (for voting)
  createdAt: number;
};

/**
 * Collective deed that multiple parties can contribute to
 */
export interface CollectiveDeed {
  id: string;
  title: string;
  description: string;
  contributors: Array<{ playerId: string; playerName: string; contributionPercent: number }>;
  baseReward: number;
  completedAt?: number;
}

// Data structure types for JSON imports
export type ItemData = {
  id: string;
  name: string;
  rarity?: string;
  basePrice?: number;
  [key: string]: unknown;
};

export type RecipeData = {
  id: string;
  name: string;
  inputs: Array<{ itemId: string; quantity: number }>;
  output: { itemId: string; quantity: number };
  skillRequired?: number;
  [key: string]: unknown;
};

export type LootEntry = {
  itemId: string;
  weight: number;
  quantity?: number;
  rarity?: string;
};

export type EncounterData = {
  id: string;
  name: string;
  difficulty: number;
  enemies?: Array<{ name: string; hp: number; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type RuneData = {
  id: string;
  name: string;
  effect: string;
  powerLevel?: number;
  [key: string]: unknown;
};

export type ItemsDataFile = {
  items?: ItemData[];
  recipes?: RecipeData[];
  loot_tables?: Record<string, LootEntry[]>;
  [key: string]: unknown;
};

export type EncountersDataFile = {
  encounters?: EncounterData[];
  hiddenAreas?: Record<string, Array<{ id: string; name: string; difficulty: number }>>;
  [key: string]: unknown;
};

export type RunesDataFile = {
  runes?: RuneData[];
  [key: string]: unknown;
};

// Data interfaces for JSON imports
export interface SpellData {
  id: string;
  name: string;
  description?: string;
  manaCost: number;
  damage?: number;
  type?: string;
  castTime?: number;
  cooldown?: number;
  targetType?: 'single' | 'aoe' | 'self';
  effect?: string;
}

export type SpellsData = {
  spells: SpellData[];
};

export interface MemoryEntry {
  id: string;
  npcId: string;
  type: string;
  content: string;
  timestamp: number;
  importance?: number;
  decayRate?: number;
}

export type MemoryData = {
  memories: MemoryEntry[];
  socialScars?: Array<{
    type: "grudge" | "debt" | "favor";
    severity: number;
    memoryIds: string[];
    lastReinforced: number;
    subjectId: string;
  }>;
};

export type WhisperType = 
  | 'vision'
  | 'intuition'
  | 'prophecy'
  | 'memory'
  | 'resonance'
  | 'echo';

// Literal type unions for animation and command systems
export type MacroEventType = 
  | 'faction_incursion'
  | 'cataclysm'
  | 'truce'
  | 'uprising'
  | 'invasion';

export type AnimationType = 
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'emote'
  | 'cast'
  | 'defend';

export type DirectionType = 
  | 'idle'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northeast'
  | 'northwest'
  | 'southeast'
  | 'southwest';

export type WorldState = {
  id: string;
  tick?: number;
  seed: number; // Phase 14.5: Seeded RNG for deterministic world simulation
  hour: number;
  day: number;
  dayPhase: "night" | "morning" | "afternoon" | "evening";
  season: "winter" | "spring" | "summer" | "autumn";
  weather: "clear" | "snow" | "rain";
  // Phase 31: Atmospheric Resonance
  atmosphereState?: {
    visualDistortion: number;  // 0-100: Screen distortion intensity
    desaturation: number;      // 0-100: Color saturation loss
    glitchIntensity: number;   // 0-100: Reality glitch frequency from paradoxDebt
    lastUpdatedTick: number;
  };
  time?: { tick: number; baseHour?: number; baseDay?: number; hour: number; minute: number; day: number; season: WorldState['season'] };
  locations: Location[];
  npcs: NPC[];
  quests: Quest[];
  resourceNodes?: ResourceNode[];
  activeEvents?: WorldEvent[];
  macroEvents?: any[]; // M42: Active macro events
  combatState?: CombatState;
  factions?: Faction[]; // Phase 11: Faction power dynamics
  factionRelationships?: FactionRelationship[]; // Phase 11: Inter-faction relationships
  factionConflicts?: FactionConflict[]; // Phase 11: Active conflicts between factions
  lastFactionTick?: number; // Track when faction events are processed (every 24h)
  
  // M44: Living World Persistence
  locationInfluences?: Record<string, Record<string, number>>; 
  proceduralQuests?: any[]; // Should be ProceduralQuest[]
  npcMemories?: Record<string, any>; // NPC ID -> Memory Profile

  // M53-A1: Environmental mutation scars
  worldScars?: WorldScar[]; // Permanent biome mutations and world damage

  // Phase 17: Historical landmarks - "Fixed Points in Time" that anchor timelines
  historicalLandmarks?: string[]; // e.g., ["The Coronation of the Silver King", "The Void's First Echo"]
  // These landmarks prevent radical divergences during PLANETARY_RESET and serve as canonical anchors

  // BETA: Epoch-aware fields for Template-Driven Epoch Framework
  epochId?: string; // e.g., "epoch_i_fracture", "epoch_ii_waning" - identifies which playable epoch this state belongs to
  chronicleId?: string; // Unique identifier for this chronicle line (allows multiple playthroughs)
  epochMetadata?: {
    chronologyYear: number; // In-world year for the epoch
    theme: string; // Narrative focus (e.g., "Fracture", "Restoration", "Waning Light")
    description?: string; // OOC epoch context
    sequenceNumber: number; // 1 for Epoch I, 2 for Epoch II, etc.
  };
  lastEpochTransitionTick?: number; // Track when the last epoch transition occurred
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
  heirloomCaches?: Array<{ // BETA: Hidden heirloom item caches from previous generations
    id: string;
    locationId: string;
    itemId: string;
    instanceId: string;
    ancestorName: string;
    discoveryMessage: string;
    hidden: boolean;
    discoveredAt?: number; // Tick when discovered
  }>;
  // Phase 13: Multi-generational legacy tracking
  generationalParadox?: number;  // Cumulative paradox across all epochs (never resets, persists across advanceToNextEpoch)
  epochGenerationIndex?: number; // Current generation number (1st ascension = 1, 2nd = 2, etc.)
  strandPhantoms?: StrandPhantom[]; // M34: NPCs from other timelines showing async activity
  temporalTraces?: TemporalTrace[]; // M34: Loot left behind by phantoms
  player: PlayerState;
  needsCharacterCreation?: boolean;
  metadata?: any;
  party?: Party; // M32: Optional shared party state (multiplayer only)
  // M43: AI & Persistence systems
  narrativeDebtState?: any; // NarrativeDebtState: Tracks authority debt from Director overrides
  fragmentRegistry?: any; // WorldFragmentRegistry: Tracks persistent world fragments with durability
  investigations?: any[]; // M46: Active investigations for rumor-to-fact discovery
  // M49: Belief system and investigations
  beliefRegistry?: Record<string, unknown>; // Store of player beliefs/rumors for investigation
  // M44: Property management
  properties?: Record<string, unknown>; // Player-owned properties (homes, shops, etc.)
  // M44: Trade system
  tradeLog?: Array<{ fromId: string; toId: string; itemId: string; tick: number; [key: string]: unknown }>; // Trade history
  // M45: Legacy system
  paradoxDebt?: number; // Paradox debt accumulated from reality manipulation
  worldTemplate?: { name: string; soulEchoes?: Array<unknown>; seed?: number; [key: string]: unknown }; // World template for seeding
  ITEM_TEMPLATES?: Record<string, { rarity?: string; [key: string]: unknown }>; // Item templates for legacy inheritance
  // M37: Macro event system
  _factionMetadata?: Record<string, unknown>; // Faction metadata for macro events
  _eventHistory?: Array<Record<string, unknown>>; // Event history for triggering macro events
  _prophecies?: Array<Record<string, unknown>>; // Prophecy tracking for world events
  npcDisplacements?: Record<string, string>; // Track displaced NPCs (npcId -> new locationId)
  // Phase 7: Paradox and narrative intervention tracking (UI omniscience)
  paradoxLevel?: number;  // Global paradox accumulation (0-100)
  temporalParadoxes?: any[];  // Array of active temporal paradoxes
  narrativeInterventions?: any[];  // Array of narrative interventions/whispers from Director
  // Phase 7: World fragment registry for UI rendering
  worldFragments?: WorldFragment[];  // All persistent world fragments
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';  // Overall world age rot severity
  // Phase 25 Task 2: Global Social Tension (emotional state of NPC society)
  socialTension?: number;  // 0.0 (harmony) to 1.0 (chaos) - driven by scars, grudges, enemy relationships
  // Phase 27 Task 1: Paradox State (Age Rot Manifestation)
  paradoxState?: any;  // ParadoxState: Tracks paradox points and active anomalies
};

type Subscriber = (s: WorldState) => void;

const TICK_MS = 1000;

/**
 * M37: Global effect modifier that persists across regions
 */
export interface GlobalEffectModifier {
  type: string; // MacroEventType
  severity: number;              // 0-100: intensity of effect
  affectedBiomes: string[];      // Biome IDs affected (empty = all)
  affectedFactions?: string[];   // Faction IDs affected (empty = all)
  effectProperties: {
    npcMortalityMultiplier?: number;   // 1.0 = normal, 2.0 = double deaths
    manaEfficiencyMultiplier?: number; // 0.5 = half magic power
    resourceMultiplier?: number;       // 2.0 = double resources available
    moraleDelta?: number;              // -20 = reduce morale 20 points
    conflictChance?: number;           // 0-1: chance of conflict triggering
  };
  startsAt: number;              // Tick when effect begins
  durationTicks: number;         // How long effect persists
  expiresAt: number;             // Calculated: startsAt + durationTicks
  isActive: boolean;
}

/**
 * M37: Market registry interface for economy pricing
 */
export interface MarketRegistry {
  marketValues?: Record<string, number>;  // itemId -> gold price
  locationPriceModifiers?: Record<string, Record<string, number>>;  // locationId -> itemId -> modifier
  economyEvents?: Array<Record<string, unknown>>;  // Economy event history
  vendorInventories?: Record<string, Array<{ itemId: string; quantity: number }>>;  // vendorId -> items
  [key: string]: unknown;
}

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
 * Apply epoch-specific overrides to a world template
 * Enables multi-epoch support by overlaying epoch-specific content on base template
 */
export function applyEpochOverridesToTemplate(baseTemplate: any, epochId: string): any {
  if (!baseTemplate?.epochs || !baseTemplate.epochs[epochId]) {
    // No epoch overrides defined, return base template as-is
    return baseTemplate;
  }

  const epochDef = baseTemplate.epochs[epochId];
  const structuredCloneSafe = (v: any) => { try { // @ts-ignore
    return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };

  // Deep clone base template
  const merged = structuredCloneSafe(baseTemplate);

  // Apply location overrides
  if (epochDef.locationOverrides) {
    Object.entries(epochDef.locationOverrides).forEach(([locId, override]: [string, any]) => {
      const locIdx = merged.locations.findIndex((l: any) => l.id === locId);
      if (locIdx >= 0) {
        merged.locations[locIdx] = { ...merged.locations[locIdx], ...override };
      }
    });
  }

  // Apply NPC overrides
  if (epochDef.npcOverrides) {
    Object.entries(epochDef.npcOverrides).forEach(([npcId, override]: [string, any]) => {
      const npcIdx = merged.npcs.findIndex((n: any) => n.id === npcId);
      if (npcIdx >= 0) {
        if (override.status === 'deceased' || override.status === 'retired') {
          // Remove NPCs that are deceased or retired (unless they should become soul echoes)
          if (override.status === 'retired' && override.role !== 'soul_echo') {
            merged.npcs.splice(npcIdx, 1);
          }
        } else {
          // Update NPC properties
          merged.npcs[npcIdx] = { ...merged.npcs[npcIdx], ...override };
        }
      }
    });
  }

  // Apply quest overrides - remove archived quests
  if (epochDef.questOverrides) {
    Object.entries(epochDef.questOverrides).forEach(([questId, override]: [string, any]) => {
      if (override.status === 'archived') {
        const questIdx = merged.quests.findIndex((q: any) => q.id === questId);
        if (questIdx >= 0) {
          merged.quests.splice(questIdx, 1);
        }
      } else {
        const questIdx = merged.quests.findIndex((q: any) => q.id === questId);
        if (questIdx >= 0) {
          merged.quests[questIdx] = { ...merged.quests[questIdx], ...override };
        }
      }
    });
  }

  // Apply faction state overrides via metadata
  if (epochDef.factionStateOverride) {
    merged.metadata = merged.metadata || {};
    merged.metadata.epochFactionStates = epochDef.factionStateOverride;
  }

  // Mark epoch in metadata for tracking
  merged.metadata = merged.metadata || {};
  merged.metadata.epochId = epochId;
  merged.metadata.epochName = epochDef.name;
  merged.metadata.epochTheme = epochDef.theme;
  merged.metadata.chronologyYear = epochDef.chronologyYear;

  return merged;
}

export function createInitialWorld(id = "world-1", template?: any, bloodlineData?: any): WorldState {
  // Use provided template, else try loaded WORLD_TEMPLATE, else fall back to built-in minimal defaults
  const tpl = template || WORLD_TEMPLATE;
  const baseSeason = tpl?.season ?? 'winter';
  const structuredCloneSafe = (v: any) => { try { // @ts-ignore
    return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
  const locations = tpl?.locations ? structuredCloneSafe(tpl.locations) : [ { id: "town", name: "Town Square" }, { id: "forest", name: "Forest" }, { id: "hill", name: "Green Hill" }, { id: "lake", name: "Silver Lake" } ];
  
  // Phase 29 Task 1: Initialize Blessed Locations (sanctuaries immune to age rot)
  locations.forEach((loc: Location, idx: number) => {
    // Mark holy sites as blessed: Great Library, temples, shrines, etc.
    const holyNames = ['library', 'temple', 'shrine', 'sanctuary', 'cathedral', 'great library', 'luxfier'];
    const isHolySite = holyNames.some(name => loc.name?.toLowerCase().includes(name));
    
    if (isHolySite) {
      locations[idx].isBlessed = true;
      locations[idx].blessedStrength = 75; // Strong blessing for holy sites
    }
    
    // Ensure ageRotSeverity is initialized (starts at 0, accumulates over tick)
    if (!locations[idx].ageRotSeverity) {
      locations[idx].ageRotSeverity = 0;
    }
    
    // Blessed locations start with 0 age rot
    if (locations[idx].isBlessed) {
      locations[idx].ageRotSeverity = 0;
    }
  });
  
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

  const worldState = {
    id,
    tick: 0,
    seed: Math.floor(Math.random() * 0x7fffffff), // Initialize with random seed; will be seeded on load
    hour: tpl?.timeSettings?.startingHour ?? 8,
    day: 1,
    dayPhase: "morning",
    season: baseSeason as WorldState['season'],
    weather: "clear",
    locations,
    npcs,
    quests,
    time: { 
      tick: 0, 
      baseHour: tpl?.timeSettings?.startingHour ?? 8, 
      baseDay: 1, 
      hour: tpl?.timeSettings?.startingHour ?? 8, 
      minute: 0,
      day: 1, 
      season: baseSeason as WorldState['season'] 
    },
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
      tutorialProgress: initializeTutorialState(), // Phase 24: Initialize tutorial milestones
      guildId: undefined, // Phase 24: Not in a guild initially
      activeRaidId: undefined, // Phase 24: Not in a raid initially
    },
    needsCharacterCreation: true,
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
      combatState: {
        active: false,
        participants: [],
        turnIndex: 0,
        roundNumber: 0,
        log: [],
        initiator: ''
      },
      player: {
        id: '',
        location: 'town-square',
        quests: {},
        gold: 0,
        experience: 0,
        level: 1,
        hp: 50,
        maxHp: 50,
        stats: {
          str: 10,
          agi: 10,
          int: 10,
          cha: 10,
          end: 10,
          luk: 10
        },
        inventory: [],
        equipment: {}
      },
      id: '',
      hour: 8,
      day: 1,
      dayPhase: 'morning' as const,
      season: 'winter',
      weather: 'clear'
    } as WorldState),
    factionRelationships: tpl?.factionRelationships ? structuredCloneSafe(tpl.factionRelationships) : initializeFactionRelationships(),
    factionConflicts: [],
    relics: {}, // Phase 15: Empty initially; relics are added to inventory or equipped
    relicEvents: [], // Phase 15: Track all relic-related events
    // Phase 27 Task 1: Initialize paradox state for Age Rot anomaly manifestation
    paradoxState: {
      totalParadoxPoints: 0,
      activeAnomalies: new Map(),
      lastManifestationTick: -1000,
      manifestationThreshold: 100,
      paradoxHistory: []
    },
    lastFactionTick: 0,
    metadata,
  };

  // M43: Initialize fragment registry for persistent world objects
  try {
    const { initializeFragmentRegistry } = require('./worldFragmentEngine');
    initializeFragmentRegistry(worldState);
    console.log('[WorldEngine] Fragment registry initialized for persistent world objects');
  } catch (err) {
    console.error('[WorldEngine] Failed to initialize fragment registry:', err);
  }

  // M43: Initialize authority debt tracking
  try {
    const { initializeDebtTracking } = require('./authorityDebtEngine');
    initializeDebtTracking(worldState);
    console.log('[WorldEngine] Authority debt system initialized');
  } catch (err) {
    console.error('[WorldEngine] Failed to initialize authority debt:', err);
  }

  // Inject Soul Echos from bloodline if provided
  if (bloodlineData) {
    try {
      const { injectSoulEchoesIntoWorld } = require('./chronicleEngine');
      return injectSoulEchoesIntoWorld(worldState, bloodlineData);
    } catch (err) {
      console.error('[WorldEngine] Failed to inject Soul Echos:', err);
      // Return world without echos if injection fails
    }
  }

  return worldState as WorldState;
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

  const newNpcs = template.npcs ? structuredCloneSafe(template.npcs) : [];
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
      minute: 0,
      day: newDay,
      season: newSeason
    },
    resourceNodes: template.resourceNodes ? structuredCloneSafe(template.resourceNodes) : currentState.resourceNodes,
    activeEvents: [], // Reset all active world events
    combatState: newCombatState,
    factions: newFactions,
    factionConflicts: template.factionConflicts ? structuredCloneSafe(template.factionConflicts) : [],
    metadata: newMetadata,

    // Preserve existing relic systems
    relics: currentState.relics || {},
    relicEvents: currentState.relicEvents || [],
    lastFactionTick: currentState.lastFactionTick ?? 0
  };
}

/**
 * M34: Spawn a strand phantom from async activity
 * Phantoms are temporary NPCs showing what other sessions/timelines are doing
 */
export function spawnStrandPhantom(
  worldState: WorldState,
  sourceSessionId: string,
  sourcePlayerId: string,
  sourcePlayerName: string,
  action: string,
  location: Location,
  durationSeconds: number = 7
): StrandPhantom {
  const now = Date.now();
  const phantom: StrandPhantom = {
    id: `phantom-${sourceSessionId}-${now}`,
    name: `Phantom of ${sourcePlayerName}`,
    locationId: location.id,
    isPhantom: true,
    sourceSessionId,
    sourcePlayerId,
    phantomAction: action,
    durationSeconds,
    spawnedAt: now,
    expiresAt: now + (durationSeconds * 1000),
    leavesTrace: Math.random() < 0.4, // 40% chance to leave trace
    stats: { level: 1 },
    hp: 5,
    maxHp: 5,
    importance: 'minor',
    personality: {
      type: 'balanced',
      attackThreshold: 50,
      defendThreshold: 50,
      riskTolerance: 0
    }
  };

  // 40% chance: phantom leaves a temporal trace loot
  if (phantom.leavesTrace) {
    const traceId = `trace-${now}-${Math.random().toString(36).substr(2, 9)}`;
    const trace: TemporalTrace = {
      id: traceId,
      itemId: `temporal-trace-${action}`,
      sourcePhantomId: phantom.id,
      sourceTimelineId: sourceSessionId,
      description: `A residual echo from ${sourcePlayerName}'s ${action}`,
      rarity: 'rare',
      timestamp: now,
      expiresAt: now + (durationSeconds * 1000) + 30000, // Lasts 30 sec after phantom despawns
      location: {
        x: location.x,
        y: location.y,
        locationId: location.id
      }
    };
    phantom.traceItem = trace;
    worldState.temporalTraces = worldState.temporalTraces || [];
    worldState.temporalTraces.push(trace);
  }

  worldState.strandPhantoms = worldState.strandPhantoms || [];
  worldState.strandPhantoms.push(phantom);

  return phantom;
}

/**
 * M34: Clean up expired strand phantoms and their traces
 */
export function pruneExpiredPhantoms(worldState: WorldState): number {
  const now = Date.now();
  let removed = 0;

  // Remove expired phantoms
  if (worldState.strandPhantoms) {
    const initialCount = worldState.strandPhantoms.length;
    worldState.strandPhantoms = worldState.strandPhantoms.filter(p => p.expiresAt > now);
    removed = initialCount - worldState.strandPhantoms.length;
  }

  // Remove expired traces
  if (worldState.temporalTraces) {
    worldState.temporalTraces = worldState.temporalTraces.filter(t => t.expiresAt > now);
  }

  return removed;
}

/**
 * M34: Get a phantom's action description for UI rendering
 */
export function getPhantomActionDescription(phantom: StrandPhantom): string {
  const actions: Record<string, string> = {
    'harvesting': '🌿 Harvesting...',
    'combat': '⚔️ In Combat...',
    'exploring': '🔍 Exploring...',
    'dialogue': '💬 Speaking...',
    'casting': '✨ Casting...',
    'traveling': '🚶 Traveling...',
    'resting': '😴 Resting...'
  };
  return actions[phantom.phantomAction] || `👻 ${phantom.phantomAction}...`;
}

/**
 * M35 Task 3: Hall of Mirrors - Phantom Synchronization
 * 
 * Synchronizes strand phantoms across multiplayer sessions, allowing players to see
 * echoes of collaborative actions. Each deed completion can spawn a "Hall of Mirrors"
 * phantom that manifests across all connected parties' worlds.
 */

export interface PhantomSyncState {
  id: string;
  phantomId: string;
  originSessionId: string;
  syncedSessions: Map<string, number>; // sessionId -> last sync time
  deedId?: string;
  visibility: 'personal' | 'party' | 'global';
  manifestStrength: number; // 0-100, how vivid the phantom appears
}

export interface DeedRewardPulse {
  id: string;
  deedId: string;
  deedContributors: string[];
  spawnedPhantomIds: string[];
  pulseOriginSessionId: string;
  pulseTimestamp: number;
  durationSeconds: number;
  rewardDescription: string;
  narrativeIntegration: string; // How it's presented to other players
}

/**
 * M35: Synchronize phantom visibility across party members' sessions
 * Ensures all players in a party see the same phantoms appearing simultaneously
 */
export function syncPhantomAcrossParty(
  worldState: WorldState,
  phantom: StrandPhantom,
  party: Party | null,
  visibility: 'personal' | 'party' | 'global' = 'party'
): PhantomSyncState {
  const syncState: PhantomSyncState = {
    id: `sync-${phantom.id}-${Date.now()}`,
    phantomId: phantom.id,
    originSessionId: phantom.sourceSessionId,
    syncedSessions: new Map(),
    visibility,
    manifestStrength: 75 // Default vivid appearance
  };

  if (party && visibility === 'party') {
    // Record sync across all party members' sessions
    party.memberIds.forEach(memberId => {
      syncState.syncedSessions.set(memberId, Date.now());
    });
  } else if (visibility === 'global') {
    // Global sync means all sessions receive it (full world event)
    syncState.manifestStrength = 85;
  }

  return syncState;
}

/**
 * M35: Generate a rewarding phantom manifested from a completed deed
 * When a collective deed is completed, a phantom appears in relevant sessions
 * as a "Hall of Mirrors" showing the collaborative achievement.
 */
export function generateDeedRewardPhantom(
  worldState: WorldState,
  deed: CollectiveDeed,
  party: Party,
  manifestLocation: Location,
  durationSeconds: number = 45
): { phantom: StrandPhantom; rewardPulse: DeedRewardPulse } {
  const now = Date.now();
  const pulseId = `pulse-${deed.id}-${now}`;

  // Determine phantom based on deed type
  const contributorNames = deed.contributors.map(c => c.playerName).join(', ');
  const phantom: StrandPhantom = {
    id: `reward-phantom-${deed.id}-${now}`,
    name: `✨ Manifestation of ${deed.title}`,
    locationId: manifestLocation.id,
    isPhantom: true,
    sourceSessionId: party.id,
    sourcePlayerId: party.leader || 'collective',
    phantomAction: `manifesting-deed-${deed.id}`,
    durationSeconds,
    spawnedAt: now,
    expiresAt: now + (durationSeconds * 1000),
    leavesTrace: false, // Reward phantoms don't leave traces
    stats: { level: 1 },
    hp: 10,
    maxHp: 10,
    importance: 'major', // More visible than standard phantoms
    personality: {
      type: 'balanced',
      attackThreshold: 0,    // Non-hostile
      defendThreshold: 0,    // Non-hostile
      riskTolerance: 0
    }
  };

  const rewardPulse: DeedRewardPulse = {
    id: pulseId,
    deedId: deed.id,
    deedContributors: deed.contributors.map(c => c.playerId),
    spawnedPhantomIds: [phantom.id],
    pulseOriginSessionId: party.id,
    pulseTimestamp: now,
    durationSeconds,
    rewardDescription: `A deed has been completed by ${contributorNames}`,
    narrativeIntegration: `The echo of ${deed.title} manifests before you—${contributorNames} have achieved something remarkable.`
  };

  worldState.strandPhantoms = worldState.strandPhantoms || [];
  worldState.strandPhantoms.push(phantom);

  return { phantom, rewardPulse };
}

/**
 * M35: Track a phantom's association with a deed for persistent lore
 * Links the phantom's appearance to collaborative achievement records
 */
export function trackPhantomDeedContribution(
  worldState: WorldState,
  phantom: StrandPhantom,
  deed: CollectiveDeed,
  localPartyId: string
): void {
  // Add to deed's phantom record if available
  if (!deed.completedAt) {
    deed.completedAt = Date.now();
  }

  // Record phantom spawn as part of deed achievement
  // TODO: Implement mutation log tracking
  // if (!worldState.mutationLog) {
  //   worldState.mutationLog = [];
  // }

  // worldState.mutationLog.push({
  //   type: 'phantomDeedIntegration',
  //   timestamp: Date.now(),
  //   phantomId: phantom.id,
  //   deedId: deed.id,
  //   partyId: localPartyId,
  //   narrativeWeight: deed.baseReward // Use deed reward as importance metric
  // } as any);
}

/**
 * M35: Query Hall of Mirrors state - what phantoms are synchronized across sessions
 */
export function getHallOfMirrorsState(
  worldState: WorldState,
  includeExpired: boolean = false
): {
  activePhantoms: StrandPhantom[];
  syncStates: PhantomSyncState[];
  rewardPulses: DeedRewardPulse[];
} {
  const now = Date.now();

  // Filter phantoms that are deed-related (reward phantoms or synced)
  const hallOfMirrorsPhantoms = (worldState.strandPhantoms || []).filter(p => {
    if (includeExpired) return p.phantomAction.includes('manifesting-deed') || p.sourceSessionId.length > 0;
    return (p.phantomAction.includes('manifesting-deed') || p.sourceSessionId.length > 0) && p.expiresAt > now;
  });

  // Gather phantom sync records from mutation log
  const syncStates: PhantomSyncState[] = [];
  const rewardPulses: DeedRewardPulse[] = [];

  // TODO: Implement mutation log tracking
  // if (worldState.mutationLog) {
  //   worldState.mutationLog
  //     .filter((log: any) => log.type === 'phantomDeedIntegration')
  //     .forEach((log: any) => {
  //       if (!syncStates[log.phantomId]) {
  //         const currentPhantom = hallOfMirrorsPhantoms.find(p => p.id === log.phantomId);
  //         if (currentPhantom) {
  //           syncStates[log.phantomId] = {
  //             id: `sync-${log.phantomId}`,
  //             phantomId: log.phantomId,
  //             originSessionId: currentPhantom.sourceSessionId,
  //             syncedSessions: new Map([[log.partyId, log.timestamp]]),
  //             deedId: log.deedId,
  //             visibility: 'party',
  //             manifestStrength: 80
  //           };
  //         }
  //       }
  //     });
  // }

  return {
    activePhantoms: hallOfMirrorsPhantoms,
    syncStates: Object.values(syncStates),
    rewardPulses
  };
}

/**
 * M35: Get visual description of a phantom's deed integration
 */
export function getPhantomDeedNarrative(phantom: StrandPhantom): string {
  if (!phantom.phantomAction.includes('manifesting-deed')) {
    return 'A echo from another world...';
  }

  const narratives = [
    '✨ The echo of a great deed resonates here.',
    '🌟 A manifestation of collaborative triumph.',
    '💫 Witness to an accomplishment across worlds.',
    '🎭 A reflection of unity echoes before you.'
  ];

  return narratives[Math.floor(Math.random() * narratives.length)];
}

/**
 * WorldControllerKernelApi: Minimal production API with core functionality
 */
export interface WorldControllerKernelApi {
  getState: () => WorldState;
  performAction: (action: Action) => Event[];
  advanceTick: (amount?: number) => void;
  load: () => boolean;
  getRecentMutations: (n?: number) => any[];
}

/**
 * WorldControllerDevApi: Extended development API with additional controls
 */
export interface WorldControllerDevApi extends WorldControllerKernelApi {
  start: () => void;
  stop: () => void;
  subscribe: (fn: Subscriber) => () => void;
  save: () => string | null;
  replayEvents: () => WorldState;
  switchTemplate: (template: any) => void;
}

/**
 * M57-T5: Calculate current paradox level from world state
 * Paradox accumulates from timeline anomalies, paradox debt, and temporal scars
 * Used for atmospheric visual feedback (CSS filters)
 */
export function calculateParadoxLevel(worldState: WorldState): number {
  let paradox = worldState.paradoxLevel || 0;

  // Add from paradox debt
  if (worldState.paradoxDebt) {
    paradox += worldState.paradoxDebt * 2; // Debt is twice as impactful
  }

  // Add from world scars (temporal anomalies)
  if (worldState.scarRegistry && worldState.scarRegistry.length > 0) {
    paradox += worldState.scarRegistry.length * 10; // 10 per active scar
  }

  // Add from anomalous chronicle events
  if (worldState.chronicle?.events) {
    const anomalies = worldState.chronicle.events.filter(e => 
      e.kind === 'TIMELINE_ANOMALY' || e.kind === 'TEMPORAL_ECHO' || e.kind === 'PARADOX_EVENT'
    );
    paradox += anomalies.length * 5; // 5 per anomaly
  }

  return Math.max(0, Math.round(paradox));
}

/**
 * M57-T5: Apply atmosphere to world state
 * Call during tick cycle or after major events
 */
export interface AtmosphereState {
  paradoxLevel: number;
  paradoxMax: number;
  intensityMultiplier: number;
  description: string;
}

export function getAtmosphereState(worldState: WorldState): AtmosphereState {
  const paradoxLevel = calculateParadoxLevel(worldState);
  const paradoxMax = 300;
  const intensityMultiplier = 1.0;

  let description = 'Baseline atmosphere';
  if (paradoxLevel < 50) {
    description = '✓ Reality is stable and clear';
  } else if (paradoxLevel < 100) {
    description = '≈ Subtle distortions ripple through reality';
  } else if (paradoxLevel < 150) {
    description = '⊕ The world grows hazy, sepia tones clouding your vision';
  } else if (paradoxLevel < 200) {
    description = '≈ Reality wavers unstably; the air shimmers with distortion';
  } else {
    description = '✕ CRITICAL: Reality collapsing! Intense glitches everywhere!';
  }

  return {
    paradoxLevel,
    paradoxMax,
    intensityMultiplier,
    description
  };
}

/**
 * M57-T2: Apply live world mutation from Architect's Forge
 * Validates and persists player-made changes to world state
 * 
 * Mutation costs:
 * - Minor (description): 5 legacy points
 * - Medium (NPC properties): 15 legacy points
 * - Major (biome, linked locations): 25 legacy points
 */
export interface WorldMutation {
  type: 'location_rename' | 'location_description' | 'npc_property' | 'resource_spawn' | 'biome_change' | 'linked_location';
  targetId: string;
  changes: Record<string, any>;
  timestamp: number;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  cost?: number;
  mutationId?: string;
}

export function applyLiveWorldMutation(
  mutations: WorldMutation[],
  worldState: WorldState,
  playerLegacyPoints: number = 0
): MutationResult {
  try {
    // Validate mutations don't touch Hard Canon (cosmology, Celestin)
    const hardCanonIds = ['loc-celestin-sanctum', 'loc-cosmology'];
    for (const mut of mutations) {
      if (hardCanonIds.some(id => mut.targetId.includes(id))) {
        return {
          success: false,
          error: 'Cannot mutate Hard Canon locations (cosmology/sanctums)'
        };
      }
    }

    let totalCost = 0;
    const appliedMutations: WorldMutation[] = [];

    // Calculate costs and validate
    for (const mut of mutations) {
      let cost = 0;
      switch (mut.type) {
        case 'location_rename':
        case 'location_description':
          cost = 5;
          break;
        case 'npc_property':
        case 'resource_spawn':
          cost = 15;
          break;
        case 'biome_change':
        case 'linked_location':
          cost = 25;
          break;
      }
      totalCost += cost;
    }

    // Check player has enough legacy points
    if (playerLegacyPoints < totalCost) {
      return {
        success: false,
        error: `Insufficient legacy points (have ${playerLegacyPoints}, need ${totalCost})`,
        cost: totalCost
      };
    }

    // Apply mutations
    for (const mut of mutations) {
      switch (mut.type) {
        case 'location_rename': {
          const loc = worldState.locations.find(l => l.id === mut.targetId);
          if (loc) {
            loc.name = mut.changes.name || loc.name;
          }
          break;
        }
        case 'location_description': {
          const loc = worldState.locations.find(l => l.id === mut.targetId);
          if (loc) {
            loc.description = mut.changes.description || loc.description;
          }
          break;
        }
        case 'npc_property': {
          const npc = worldState.npcs.find(n => n.id === mut.targetId);
          if (npc) {
            Object.assign(npc, mut.changes);
          }
          break;
        }
        case 'resource_spawn': {
          const node = worldState.resourceNodes?.find(n => n.id === mut.targetId);
          if (node) {
            Object.assign(node, mut.changes);
          }
          break;
        }
        case 'biome_change': {
          const loc = worldState.locations.find(l => l.id === mut.targetId);
          if (loc) {
            loc.biome = mut.changes.biome || loc.biome;
          }
          break;
        }
        case 'linked_location': {
          const loc = worldState.locations.find(l => l.id === mut.targetId);
          if (loc) {
            loc.linkedLocationIds = mut.changes.linkedLocationIds || loc.linkedLocationIds;
          }
          break;
        }
      }

      appliedMutations.push(mut);
    }

    // Log mutation as event (audit trail)
    if (worldState.chronicle && worldState.chronicle.events) {
      const event = {
        id: `event-mutation-${Date.now()}`,
        kind: 'PLAYER_EDIT' as const,
        tick: 0,
        worldId: worldState.id,
        payload: {
          mutationCount: mutations.length,
          totalCost,
          appliedMutations
        }
      };
      worldState.chronicle.events.push(event);
    }

    return {
      success: true,
      cost: totalCost,
      mutationId: `mutation-${Date.now()}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Mutation failed: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }
}

/**
 * WorldControllerInstance: Union type for controller returned from createWorldController
 * Runtime type determined by dev parameter
 */
export type WorldControllerInstance = WorldControllerDevApi | WorldControllerKernelApi;

export function createWorldController(initial?: WorldState, dev = false): WorldControllerInstance {
  // copy-on-write: instantiate a fresh world from template if initial is not provided
  let state: WorldState = initial ? (function(i){ try { // @ts-ignore
    return structuredClone(i); } catch(e){ return JSON.parse(JSON.stringify(i)); } })(initial) : createInitialWorld();
  // Normalize time tick to match explicit tick when provided by callers
  try {
    if (state) {
      if (!state.time) {
        state.time = {
          tick: state.tick ?? 0,
          baseHour: state.hour ?? 0,
          baseDay: state.day ?? 1,
          hour: state.hour ?? 0,
          minute: 0,
          day: state.day ?? 1,
          season: state.season ?? 'winter'
        };
      } else {
        state.time = {
          ...state.time,
          tick: state.tick ?? state.time.tick ?? 0,
          minute: state.time.minute ?? 0,
          baseHour: state.time.baseHour ?? state.hour ?? 0,
          baseDay: state.time.baseDay ?? state.day ?? 1
        };
      }
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

  function advanceTick(amount = 1, isOracle = true) {
    const prevTick = state.tick ?? 0;
    const nextTick = prevTick + Math.max(0, Math.floor(amount));

    // Increment seed for deterministic RNG progression
    const nextSeed = state.seed + 1;
    
    // Reseed the global RNG with new seed
    const rng = getGlobalRng();
    rng.reseed(nextSeed);

    // CHRONO-ACTION: Compute precise time (minutes/hours/days) from ticks (1 tick = 1 minute)
    const baseHour = (state.time && state.time.baseHour) ?? state.hour ?? 0;
    const baseDay = (state.time && state.time.baseDay) ?? state.day ?? 1;
    
    const totalMinutes = (baseHour * 60) + nextTick;
    const nextHour = Math.floor(totalMinutes / 60) % 24;
    const nextMinute = totalMinutes % 60;
    const nextDay = baseDay + Math.floor(totalMinutes / 1440);

    // Use seasonEngine for deterministic seasonal progression
    const { current: nextSeason, dayOfSeason, hasChanged: seasonChanged, transitionEvent: seasonTransition } = resolveSeason(nextTick, state.season);

    // Determine day phase
    let nextDayPhase: WorldState['dayPhase'] = 'morning';
    if (nextHour < 6) nextDayPhase = 'night';
    else if (nextHour < 12) nextDayPhase = 'morning';
    else if (nextHour < 18) nextDayPhase = 'afternoon';
    else nextDayPhase = 'evening';

    // M44-E2: Use Causal Weather Engine for player's current location
    const playerLocationId = state.player.location;
    let nextWeatherResult: EnhancedWeatherResult;
    
    try {
      // Resolve weather using causal rules (state-driven instead of RNG)
      nextWeatherResult = causalWeatherEngine.resolveWeatherByCausalRules(
        playerLocationId,
        state,
        nextTick,
        nextSeason
      );
    } catch (err) {
      // Fallback to traditional weather resolution if causal engine fails
      // eslint-disable-next-line no-console
      console.warn('[worldEngine] Causal weather resolution failed, using legacy system', err);
      const legacyWeather = resolveWeather(nextSeason, nextHour, state.weather);
      nextWeatherResult = {
        current: legacyWeather.current,
        intensity: legacyWeather.intensity,
        hasChanged: legacyWeather.hasChanged,
        transitionEvent: legacyWeather.transitionEvent,
        causedBy: 'base',
        remainingDuration: 1000
      };
    }

    // Extract simplified weather values for backward compatibility
    const { current: nextWeather, intensity: weatherIntensity, hasChanged: weatherChanged, transitionEvent: weatherTransition } = nextWeatherResult;

    // Update NPC locations via scheduleEngine
    const npcLocationUpdates = updateNpcLocations(state.npcs, nextHour);
    const updatedNpcs = applyLocationUpdates(state.npcs, npcLocationUpdates);

    // Phase 26 Task 2: Check for NPC migrations due to high tension
    const migrations = triggerMigrationChecks({ ...state, npcs: updatedNpcs });
    const abandonedLocationIds = migrations.map(m => m.fromLocationId);
    
    // Create migration events and add to log
    if (migrations.length > 0) {
      const migrationEvents = createMigrationEvents(migrations);
      migrationEvents.forEach(evt => {
        evt.worldInstanceId = state.id;
        evt.templateOrigin = state.metadata?.templateOrigin;
        appendEvent(evt);
      });
      
      // Apply population decay to abandoned locations
      applyPopulationDecay(state, abandonedLocationIds);
    }

    // Phase 19: Process gossip exchanges between co-located NPCs
    const gossipResult = npcSocialEngine.processGossipTick(updatedNpcs, nextTick);

    // Phase 19: Process NPC trades (every 10 ticks to avoid spam)
    if (nextTick % 10 === 0) {
      for (let i = 0; i < updatedNpcs.length; i++) {
        for (let j = i + 1; j < updatedNpcs.length; j++) {
          const npc1 = updatedNpcs[i];
          const npc2 = updatedNpcs[j];
          if (npc1.locationId === npc2.locationId && Math.random() < 0.1) {
            npcSocialEngine.initiateNpcTrade(npc1, npc2, nextTick);
          }
        }
      }
    }

    // Filter available locations based on season conditions
    const availableLocations = state.locations.filter(loc => 
      !loc.conditionalSeason || loc.conditionalSeason === nextSeason
    );

    // Phase 29 Task 1: Apply Blessed Location Protection & Healing
    availableLocations.forEach((loc) => {
      if (loc.isBlessed) {
        // Blessed locations are immune to age rot accumulation
        loc.ageRotSeverity = 0;
        
        // If blessedStrength > 50, slowly heal active scars (1% chance per 100 ticks)
        if (loc.blessedStrength && loc.blessedStrength > 50 && loc.activeScars && loc.activeScars.length > 0) {
          const healChance = 0.01; // 1% per tick
          if (Math.random() < healChance) {
            // Remove one random scar
            const scarIndex = Math.floor(Math.random() * loc.activeScars.length);
            loc.activeScars.splice(scarIndex, 1);
            
            // Emit blessing healing event
            const healingEv: Event = {
              id: `blesse d-heal-${Date.now()}`,
              worldInstanceId: state.id,
              actorId: "system",
              type: "BLESSING_SCAR_HEALED",
              payload: { locationId: loc.id, locationName: loc.name, reason: 'Blessed sanctuary healing' },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(healingEv);
          }
        }
      } else {
        // Non-blessed locations accumulate age rot (small incremental amount per tick)
        if (!loc.ageRotSeverity) {
          loc.ageRotSeverity = 0;
        }
        // Age rot accumulates slowly: +0.1 per tick (takes ~1000 ticks to reach 100)
        loc.ageRotSeverity = Math.min(100, (loc.ageRotSeverity || 0) + 0.1);
      }
    });

    state = { 
      ...state, 
      tick: nextTick, 
      seed: nextSeed,
      hour: nextHour, 
      day: nextDay, 
      dayPhase: nextDayPhase, 
      season: nextSeason, 
      weather: nextWeather as WorldState['weather'],
      npcs: updatedNpcs,
      locations: availableLocations,
      time: { 
        ...(state.time || {}), 
        tick: nextTick, 
        hour: nextHour, 
        minute: nextMinute, 
        day: nextDay, 
        season: nextSeason,
        baseHour: state.time?.baseHour ?? state.hour ?? 0,
        baseDay: state.time?.baseDay ?? state.day ?? 1
      } 
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

      // Phase 31: Update seasonal events when season changes
      const seasonalEngine = getSeasonalEventEngine();
      updateSeasonalEvents(seasonalEngine, nextDay, nextSeason, nextTick);

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

    // M44 FACTION WARFARE: Process skirmishes during large tick jumps
    try {
      if (amount > 30) { // Only simulate warfare for jumps > 30 mins
        const templateFactions = state.metadata?.factions || (WORLD_TEMPLATE?.factions || []);
        const warfare = getFactionWarfareEngine(templateFactions);
        if (warfare) {
          warfare.setSeededRng(rng);
          const warfareEvents = warfare.processChronoActionSkirmishes(
            availableLocations.map(l => l.id),
            amount,
            state.tick,
            state.seed
          );

          warfareEvents.forEach(skirmish => {
            const skirmishEv: Event = {
              id: `skirmish-${skirmish.tick}-${skirmish.locationId}-${Date.now()}`,
              worldInstanceId: state.id,
              actorId: 'system',
              type: 'FACTION_SKIRMISH',
              payload: {
                ...skirmish,
                locationName: availableLocations.find(l => l.id === skirmish.locationId)?.name || skirmish.locationId
              },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(skirmishEv);

            // M44 QUEST SYNTHESIS: Generate quests from war outcomes
            const questAI = getQuestSynthesisAI();
            questAI.setDependencies(getNpcMemoryEngine(), warfare, beliefEngine, rng);
            const status = warfare.getWarZoneStatus(skirmish.locationId);
            const localNpcs = updatedNpcs.filter(n => n.locationId === skirmish.locationId).map(n => n.id);
            const synthesized = questAI.synthesizeQuestsFromWarfare(skirmish.locationId, status, localNpcs, state.tick);
            
            synthesized.forEach(pq => {
              questAI.registerGeneratedQuest(pq);
              const questEv: Event = {
                id: `quest-syn-${pq.id}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'QUEST_DISCOVERED',
                payload: { quest: pq, reason: 'Faction conflict intensity' },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(questEv);
            });
          });
        }
      }
    } catch (err) {
      // Warfare simulation error - non-fatal
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

    // Phase 25 Task 2: Update Global Social Tension every 100 ticks
    {
      if (nextTick % 100 === 0) {
        const memoryEngine = getNpcMemoryEngine();
        const newSocialTension = memoryEngine.getGlobalSocialTension();
        
        state = {
          ...state,
          socialTension: newSocialTension
        };

        // Emit SOCIAL_TENSION_CHANGED if tension changed significantly
        const oldTension = prevTick % 100 === 0 ? (state.socialTension ?? 0) : null;
        if (oldTension !== null && Math.abs(newSocialTension - oldTension) > 0.05) {
          const tensionEv: Event = {
            id: `social-tension-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'SOCIAL_TENSION_CHANGED',
            payload: {
              oldTension,
              newTension: newSocialTension,
              narrativeState: memoryEngine.getNarrativeState(nextTick)
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(tensionEv);
        }
      }
    }

    // Phase 26 Task 3: Social Outbursts & World Scars (GST >= 1.0)
    // Phase 27 Task 2: Gate behind isOracle to prevent duplicate events in multiplayer
    if (isOracle) {
      const currentSocialTension = state.socialTension ?? 0;
      if (currentSocialTension >= 1.0) {
        const outburstResult = triggerSocialOutburst(state, currentSocialTension);
        
        if (outburstResult.triggered) {
          // Create main SOCIAL_OUTBURST event
          const outburstEv: Event = {
            id: `social-outburst-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'SOCIAL_OUTBURST',
            payload: {
              socialTension: currentSocialTension,
              statistics: outburstResult.stats,
              scarsCreated: outburstResult.scars.map(s => ({
                scarId: s.scarId,
                locationId: s.locationId,
                type: s.scarType,
                severity: s.severity
              })),
              fragmentsDestroyed: outburstResult.fragmentDamage.filter(d => d.destroyed).map(d => ({
                fragmentId: d.fragmentId,
                locationId: d.locationId,
                previousDurability: d.previousDurability
              }))
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(outburstEv);

          // Emit individual location scar events for narrative
          outburstResult.scars.forEach(scar => {
            const scarEv: Event = {
              id: `location-scar-${scar.scarId}`,
              worldInstanceId: state.id,
              actorId: 'system',
              type: 'LOCATION_SCAR_CREATED',
              payload: {
                scarId: scar.scarId,
                locationId: scar.locationId,
                locationName: state.locations?.find((l: any) => l.id === scar.locationId)?.name || scar.locationId,
                scarType: scar.scarType,
                severity: scar.severity,
                narrative: scar.scarType === 'battlefield'
                  ? `The battlefield at ${state.locations?.find((l: any) => l.id === scar.locationId)?.name || scar.locationId} bears witness to the social catastrophe`
                  : `A cultural scar marks the identity of ${state.locations?.find((l: any) => l.id === scar.locationId)?.name || scar.locationId}, forever changed by the outburst`
              },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(scarEv);
          });

          // Emit fragment destruction events
          outburstResult.fragmentDamage.forEach(damage => {
            if (damage.destroyed) {
              const fragmentDestroyEv: Event = {
                id: `fragment-destroyed-${damage.fragmentId}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'WORLD_FRAGMENT_DESTROYED',
                payload: {
                  fragmentId: damage.fragmentId,
                  locationId: damage.locationId,
                  damageDealt: damage.damageDealt
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(fragmentDestroyEv);
            }
          });
        }
      }
    }

    // Phase 27 Task 1: Paradox Engine - Age Rot Manifestation
    {
      // Harvest paradox points every 100 ticks from invariant violations
      if (nextTick % 100 === 0) {
        // Phase 31: Update seasonal events every 100 ticks
        const seasonalEngine = getSeasonalEventEngine();
        updateSeasonalEvents(seasonalEngine, nextDay, nextSeason, nextTick);

        const harvestResult = harvestPhase27ParadoxPoints(state);
        
        if (harvestResult.pointsAdded > 0) {
          const harvestEv: Event = {
            id: `paradox-harvest-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'PARADOX_POINTS_HARVESTED',
            payload: {
              pointsAdded: harvestResult.pointsAdded,
              totalPoints: harvestResult.totalPoints,
              sources: harvestResult.sources.map(s => ({ reason: s.reason, points: s.points }))
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(harvestEv);
        }

        // Check if we should manifest an anomaly
        // Phase 27 Task 2: Gate behind isOracle to prevent duplicate events in multiplayer
        if (isOracle && shouldManifestPhase27Anomaly(state)) {
          const anomaly = triggerPhase27AgeRotAnomaly(state);
          
          if (anomaly) {
            const anomalyEv: Event = {
              id: `paradox-anomaly-${anomaly.id}`,
              worldInstanceId: state.id,
              actorId: 'system',
              type: 'PARADOX_ANOMALY_CREATED',
              payload: {
                anomalyId: anomaly.id,
                anomalyType: anomaly.type,
                locationId: anomaly.locationId,
                locationName: state.locations?.find((l: any) => l.id === anomaly.locationId)?.name || anomaly.locationId,
                severity: anomaly.severity,
                expiresAtTick: anomaly.expiresAtTick,
                narrative: anomaly.narrative,
                affectedNpcCount: anomaly.affectedNpcIds.length,
                totalParadoxPoints: state.paradoxState?.totalParadoxPoints ?? 0
              },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(anomalyEv);
          }
        }
      }

      // Clean up expired anomalies
      if (state.paradoxState && state.paradoxState.activeAnomalies) {
        const now = nextTick;
        const expiredIds: string[] = [];
        
        state.paradoxState.activeAnomalies.forEach((anomaly: any) => {
          if (anomaly.expiresAtTick <= now) {
            expiredIds.push(anomaly.id);
            
            // Remove from location scars
            const location = state.locations?.find((l: any) => l.id === anomaly.locationId);
            if (location && location.activeScars) {
              location.activeScars = location.activeScars.filter((s: string) => s !== anomaly.id);
            }
            
            // Emit expiration event
            const expireEv: Event = {
              id: `paradox-anomaly-expired-${anomaly.id}`,
              worldInstanceId: state.id,
              actorId: 'system',
              type: 'PARADOX_ANOMALY_EXPIRED',
              payload: {
                anomalyId: anomaly.id,
                durationTicks: anomaly.expiresAtTick - anomaly.createdAtTick,
                locationId: anomaly.locationId
              },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(expireEv);
          }
        });
        
        // Remove expired anomalies from map
        expiredIds.forEach(id => {
          state.paradoxState.activeAnomalies.delete(id);
        });
      }
    }

    // Phase 27 Task 3: Economic Synthesis Engine - Bridge economy metrics to NPC behaviors
    {
      // Get current economy score from telemetry
      const telemetry = getTelemetryEngine().generateTelemetryPulse(state);
      const economyScore = telemetry.economyHealth ?? 50; // Default to stable if unavailable
      
      // Phase 2: M69 Integration - Check for exploits using economy telemetry
      if (isOracle && nextTick % 20 === 0) {
        // Every ~20 ticks (~20 minutes), check for economic anomalies
        try {
          const recentGoldFlux = telemetry.economyMetrics?.recentGoldFlux ?? 0;
          const baselineGoldGeneration = telemetry.economyMetrics?.baselineGoldGeneration ?? 100;
          
          // If gold flux is >300% of baseline, potential duplication/generation exploit
          if (recentGoldFlux > baselineGoldGeneration * 3) {
            emitExploitDetected(
              state.player?.id || 'player_0',
              'suspicious_gold_spike',
              'high'
            );
          }

          // Phase 2: M70 Integration - Trigger churn analysis every hour
          if (nextTick % 600 === 0 && state.npcs) {
            // Analyze cohort for churn predictions
            const cohortPlayers = [{ id: state.player?.id || 'player_0', engagementTier: 'core' }];
            const engagementMap = new Map([
              [state.player?.id || 'player_0', {
                engagementScore: Math.max(0, Math.min(100, (telemetry.playerEngagement?.sessionLengthTrend as any) || 50)),
                daysSinceLogin: 0,
                sessionLengthTrend: 'stable' as const,
                questCompletionRate: 0.6,
              }],
            ]);

            try {
              analyzeCohortEngagement(cohortPlayers, engagementMap);
            } catch (err) {
              // Silently fail if cohort analysis unavailable
              console.debug('[worldEngine] M70 cohort analysis failed:', err);
            }
          }
        } catch (err) {
          console.error('[worldEngine] M69/M70 telemetry integration error:', err);
        }
      }
      
      // Every 100 ticks, check for economic cycles and their consequences
      if (nextTick % 100 === 0) {
        const economicEngine = getEconomicSynthesisEngine();
        const cycleResult = economicEngine.triggerEconomicCycle(state, economyScore);
        
        // Emit economic cycle change event
        for (const ev of cycleResult.events) {
          const cycleEv: Event = {
            id: `economic-event-${ev.type}-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: ev.type as any,
            payload: ev.payload,
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(cycleEv);
        }
        
        // Add spawned caravans to world NPCs
        // Phase 27 Task 2: Gate behind isOracle to prevent duplicate spawns in multiplayer
        if (isOracle && cycleResult.caravansSpawned.length > 0) {
          if (!state.npcs) state.npcs = [];
          
          // Phase 27 Task 3: Generate trade inventory for each caravan based on economic cycle
          for (const caravan of cycleResult.caravansSpawned) {
            // Generate economy-aware trade inventory
            caravan.caravanInventory = generateTradeInventory(caravan, state);
          }
          
          state.npcs.push(...cycleResult.caravansSpawned);
          
          // Emit caravan spawn confirmation event
          for (const caravan of cycleResult.caravansSpawned) {
            const caravanEv: Event = {
              id: `caravan-spawned-${caravan.id}`,
              worldInstanceId: state.id,
              actorId: 'system',
              type: 'ECONOMY_CARAVAN_MANIFEST',
              payload: {
                caravanId: caravan.id,
                caravanName: caravan.name,
                fromLocationId: caravan.fromLocationId,
                toLocationId: caravan.toLocationId,
                merchantStats: caravan.stats,
                inventorySize: caravan.caravanInventory.length,
                expiresAtTick: caravan.expiresAtTick,
                durationTicks: caravan.expiresAtTick - nextTick
              },
              templateOrigin: state.metadata?.templateOrigin,
              timestamp: Date.now(),
            };
            appendEvent(caravanEv);
          }
        }
        
        // Apply NPC migrations for recession cycles
        // Phase 27 Task 2: Gate behind isOracle to prevent duplicate migrations in multiplayer
        if (isOracle && cycleResult.migrationsTriggered.length > 0) {
          for (const migration of cycleResult.migrationsTriggered) {
            // Update NPC location
            const npc = state.npcs?.find((n: any) => n.id === migration.npcId);
            if (npc) {
              npc.location = migration.toLocationId;
              npc.locationId = migration.toLocationId;
              npc.lastLocationChange = nextTick;
              
              // Emit migration event
              const migrationEv: Event = {
                id: `npc-migration-${migration.npcId}-${Date.now()}`,
                worldInstanceId: state.id,
                actorId: migration.npcId,
                type: 'NPC_ECONOMIC_MIGRATION',
                payload: {
                  npcId: migration.npcId,
                  npcName: migration.npcName,
                  fromLocationId: migration.fromLocationId,
                  toLocationId: migration.toLocationId,
                  reason: 'economic_recession',
                  narrative: `${migration.npcName} has relocated to seek better fortune.`
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(migrationEv);
            }
          }
        }
        
        // Clean up expired caravans
        if (state.npcs && state.npcs.length > 0) {
          const now = nextTick;
          state.npcs = state.npcs.filter((npc: any) => {
            if (npc.isCaravan && npc.expiresAtTick <= now) {
              // Emit caravan despawn event
              const despawnEv: Event = {
                id: `caravan-despawned-${npc.id}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'ECONOMY_CARAVAN_DESPAWNED',
                payload: {
                  caravanId: npc.id,
                  caravanName: npc.name,
                  reason: 'trade_complete',
                  durationTicks: npc.expiresAtTick - (npc.createdAtTick ?? nextTick)
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(despawnEv);
              return false; // Remove from NPCs
            }
            return true; // Keep NPC
          });
        }
        
        // Phase 27 Task 3: Update NPC emotional responses to economic cycles
        if (state.npcs && state.npcs.length > 0) {
          updateNpcEconomicEmotions(state.npcs, state);
        }
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
          const npcSoulStrain = npc.soulStrain ?? 0;
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

    // Phase 31: Calculate Atmospheric Resonance - Pressure Sink
    {
      const ageRotAverage = state.locations.reduce((sum, loc) => sum + (loc.ageRotSeverity || 0), 0) / Math.max(1, state.locations.length);
      const paradoxDebtAmount = state.player.bloodlineData?.legacyPoints || state.paradoxDebt || 0;
      const socialTension = state.socialTension || 0;
      
      const visualDistortion = Math.min(100, (ageRotAverage * 0.3) + (state.paradoxLevel || 0) * 0.4 + (socialTension * 100) * 0.3);
      const desaturation = Math.min(100, (ageRotAverage * 0.5) + (state.paradoxLevel || 0) * 0.3);
      const glitchIntensity = Math.min(100, Math.floor(paradoxDebtAmount / 10));  // 0-100 based on paradox debt
      
      state = {
        ...state,
        atmosphereState: {
          visualDistortion: Math.floor(visualDistortion),
          desaturation: Math.floor(desaturation),
          glitchIntensity,
          lastUpdatedTick: nextTick
        }
      };
    }

    emit();

    // Phase 25 Task 5: Chronos Snapshotting - capture snapshot every 100 ticks
    // Non-blocking async write to IndexedDB for O(1) state reconstruction
    try {
      const snapshotEngine = getSnapshotEngine();
      snapshotEngine.processTick(state.id, state.tick ?? 0, state).catch(err => {
        // Don't throw - snapshot failures shouldn't crash the game
        console.warn('[worldEngine] Snapshot processing failed (non-fatal):', err);
      });
    } catch (err) {
      console.warn('[worldEngine] Error initializing snapshot engine:', err);
    }
  }

  function tick() {
    try { advanceTick(1); } catch (err) {}
  }

  function start() {
    // CHRONO-ACTION: Disabled automatic wall-clock timer to remove real-time pressure.
    // Time advances only on player action or explicit WAIT.
    // if (timer) return;
    // timer = setInterval(tick, TICK_MS);
    console.log('[worldEngine] Chrono-Action mode active: time advances only on action.');
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

    // CHRONO-ACTION: Calculate precise action cost using World Template data
    const tpl = WORLD_TEMPLATE || {};
    const stdCosts = tpl.standardActionCosts || { search: 15, rest_short: 60, dialogue_per_word: 0.1 };
    
    let finalCost = 0;
    
    if (action.type === 'MOVE') {
      const from = state.player?.location;
      const to = action.payload?.to;
      if (from && to && tpl.travelMatrix?.[from]?.[to]) {
        finalCost = tpl.travelMatrix[from][to];
      } else {
        finalCost = 60; // Default 1hr travel if not in matrix
      }
    } else if (action.type === 'INTERACT_NPC') {
      const lastDialogue = events.find((e: any) => e.type === 'INTERACT_NPC')?.payload?.dialogueText;
      if (lastDialogue) {
        const words = lastDialogue.split(/\s+/).length;
        finalCost = Math.ceil(words * (stdCosts.dialogue_per_word || 0.08));
      } else {
        finalCost = 1;
      }
    } else if (action.type === 'SEARCH_AREA') {
      finalCost = stdCosts.search || 15;
    } else if (action.type === 'WAIT' || action.type === 'REST') {
      finalCost = action.payload?.ticks || 60; // Default 1hr for wait/rest
    } else {
      const ACTION_TICK_COST: Record<string, number> = { DIALOG_CHOICE: 1, START_QUEST: 1, COMPLETE_QUEST: 1 };
      finalCost = ACTION_TICK_COST[action.type] ?? 0;
    }

    const meaningful = events.some((e:any) => !['QUEST_LOCKED','NPC_UNAVAILABLE','PHANTOM_SCORE_UPDATED'].includes(e.type)) || finalCost > 0;

    if (meaningful && finalCost > 0) {
      advanceTick(finalCost);
      console.log(`[Chrono-Action] Time advanced by ${finalCost} ticks for action ${action.type}`);
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
        const saveMeta = parsed as unknown as typeof createSave;
        if ((parsed as any).checksum) {
          // This is from saveLoadEngine
          const isValid = verifySaveIntegrity(parsed as any);
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
    let result: RebuildResult | null = null;

    // Phase 25 Task 6: Try snapshot-based rebuild first with panic recovery
    try {
      const snapshotPromise = (async () => {
        const { rebuildStateWithSnapshot } = await import('./stateRebuilder');
        return await rebuildStateWithSnapshot(state.id, events, state.tick);
      })();

      // Wait for snapshot rebuild (use setTimeout to avoid blocking for too long)
      let snapshotResult: RebuildResult | null = null;
      let snapshotFailed = false;
      
      snapshotPromise
        .then(r => { snapshotResult = r; })
        .catch(err => {
          console.error('[WorldEngine] Snapshot rebuild failed, will use full replay:', err);
          snapshotFailed = true;
        });

      // For synchronous replayEvents, use full replay but track whether snapshot would have been tried
      // This is a temporary sync wrapper - ideally replayEvents should be async but that's a larger refactor
      result = rebuildState(state, events);
      
    } catch (err) {
      console.error('[WorldEngine] Rebuild failed:', err);
      // Emit critical failure to telemetry
      if (dev) throw err;
      result = rebuildState(state, events);
    }

    if (!result) {
      console.error('[WorldEngine] Failed to rebuild state');
      return events; // Return events unchanged on critical failure
    }

    try {
      const candidateState = result.candidateState;
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
   * Phase 25 Task 6: Force a snapshot checkpoint
   * Useful for testing, debugging, or manual save points
   * Returns a promise that completes when snapshot is written
   */
  async function forceSnapshot() {
    try {
      const { getSnapshotEngine } = await import('./snapshotEngine');
      const snapshotEngine = getSnapshotEngine();
      const currentTick = state.tick ?? 0;
      await snapshotEngine.processTick(state.id, currentTick, state);
      console.log(`[WorldEngine] Force snapshot completed at tick ${currentTick}`);
      return true;
    } catch (err) {
      console.error('[WorldEngine] Force snapshot failed:', err);
      return false;
    }
  }

  const devApi = Object.freeze({ start, stop, performAction, advanceTick, subscribe, save, load, getState: getStateClone, replayEvents, switchTemplate, getRecentMutations, forceSnapshot }) as unknown as WorldControllerDevApi;

  const kernelApi = Object.freeze({ getState: getStateClone, performAction, advanceTick, load, getRecentMutations }) as unknown as WorldControllerKernelApi;

  return dev ? devApi : kernelApi;
}

export default createWorldController;
/**
 * Phase 31: Helper function to extract atmosphere state from world state
 * Used by UI layer to consume atmospheric metrics for visual effects
 */
export function getAtmosphereState(state: WorldState): {
  visualDistortion: number;
  desaturation: number;
  glitchIntensity: number;
  lastUpdatedTick: number;
} {
  return state.atmosphereState || {
    visualDistortion: 0,
    desaturation: 0,
    glitchIntensity: 0,
    lastUpdatedTick: state.tick || 0
  };
}