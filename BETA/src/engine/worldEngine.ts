import { Event, appendEvent, getEventsForWorld } from "../events/mutationLog";
import CJ, { summarizeStateMinimal } from "./canonJournal";
import { rebuildState } from "./stateRebuilder";
import { validateInvariants, isStatePlayable } from "./constraintValidator";
import { SeededRng, setGlobalRng, getGlobalRng } from "./prng";
import type { SocialScar } from "./npcMemoryEngine";
import type { DialogueNode, DialogueOption, DialogueResolution, BranchingDialogueEngine } from "./branchingDialogueEngine";
import { processAction, Action } from "./actionPipeline";
import { NarrativeSeedProcessor } from "./narrativeSeedProcessor";

// Re-export dialogue types for centralized consumption
export type { DialogueNode, DialogueOption, DialogueResolution, BranchingDialogueEngine };
import { authorizeAction, AuthorizationContext } from "./authorization/authorizeAction";
import { createSave, loadSave, verifySaveIntegrity } from "./saveLoadEngine";
import { resolveNpcLocation, updateNpcLocations, applyLocationUpdates } from "./scheduleEngine";
import { resolveWeather, getWeatherVisuals } from "./weatherEngine";
import { CausalWeatherEngine } from "./causalWeatherEngine";
import { resolveNpcTurns } from './aiTacticEngine';
import { applyStrategyModifierToNpc } from './factionCommandEngine';
import { checkLocationHazards, applyHazardDamage, applyHazardStatus, checkPossessionHazards } from "./hazardEngine";
import { resolveSeason, getSeasonalModifiers, getSeasonalLoot } from './seasonEngine';
import { applySanctifiedZoneDampening } from './environmentalModifierEngine';
import { Faction, FactionRelationship, initializeFactions, initializeFactionRelationships, resolveFactionTurns } from './factionEngine';
import { processDailyInfluenceDiffusion } from './influenceDiffusionEngine';
import { Relic, RunicSlot, shouldRelicRebel, applyRelicRebellion, generateRelicDialogue } from './artifactEngine';
import { processArtifactSentience, updateArtifactMoodFromEvent } from './artifactSentienceLoop';
import { initializeDirectorState, evaluateDirectorIntervention, type DirectorState } from './aiDmEngine';
import { initializeAudioState, calculateRequiredAudio, applyAudioParameterMutation, type AudioState } from './audioEngine';
import { Investigation, getInvestigationPipeline } from './investigationPipelineEngine';
import { getGoalOrientedPlanner, type NpcGoal, type ActionPlan } from './goalOrientedPlannerEngine';
import { getLegacyEngine, type SoulEcho } from './legacyEngine';
import { type WorldScar } from './worldScarsEngine';
import { resolveLocationSkirmishes } from './factionSkirmishEngine';
import { processMacroEvents, applyMacroEventEffectsToNpc } from './macroEventsEngine';
import { processWorldNarrativeAttrition } from './narrativeAttritionEngine';
import { updateMarketFlux, generateMarketAlert, getEpochCorruptedItem } from './merchantEngine';
import { initializeTutorialState, detectMilestones, updateTutorialState, getNextTutorialOverlay } from './tutorialEngine';
// import { multiverseAdapter } from './multiverseAdapter'; // Lazy loaded to avoid client-side bundling
// import { getDatabaseAdapter } from './databaseAdapter'; // Lazy loaded to avoid client-side bundling

// Phase 30: World Registry — centralized template management
import { getWorldRegistry, type WorldTemplateMetadata } from './worldRegistry';
import schemaJson from '../data/luxfier-world.schema.json';

// Lazy-load database adapter to avoid client-side bundling issues
function getDatabaseAdapterSafe() {
  try {
    // Only load on server side
    if (typeof window === 'undefined') {
      const { getDatabaseAdapter } = require('./databaseAdapter');
      return getDatabaseAdapter();
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Lazy-load multiverse adapter to avoid client-side bundling issues
function getMultiverseAdapterSafe() {
  // Always return null on client side to prevent bundling
  if (typeof window !== 'undefined') {
    return null;
  }
  try {
    const { multiverseAdapter } = require('./multiverseAdapter');
    return multiverseAdapter;
  } catch (e) {
    return null;
  }
}

// Phase 30: Initialize world registry and load default template
let WORLD_TEMPLATE: any = null;
let WORLD_REGISTRY_TEMPLATEID: string = 'demo-fantasy'; // Default to demo world

try {
  const registry = getWorldRegistry();
  
  // Resolve template ID from env var or default to demo-fantasy
  WORLD_REGISTRY_TEMPLATEID = registry.resolveTemplateId();
  
  // Load the resolved template
  WORLD_TEMPLATE = registry.getTemplate(WORLD_REGISTRY_TEMPLATEID);
  
  if (WORLD_TEMPLATE) {
    // eslint-disable-next-line no-console
    console.log(`[worldEngine] Loaded world template from registry: ${WORLD_REGISTRY_TEMPLATEID}`);
    
    // Validate template against schema if available
    let valid = true;
    try {
      const Ajv = require('ajv');
      const ajv = new Ajv({ allErrors: true, strict: false });
      const schema = schemaJson;
      const validate = ajv.compile(schema);
      valid = validate(WORLD_TEMPLATE);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.warn('[worldEngine] Template validation warnings:', validate.errors);
      }
    } catch (error_) {
      // if ajv isn't available, continue but log
      // eslint-disable-next-line no-console
      console.warn('[worldEngine] Template validation skipped (ajv not available)', error_);
    }
    
    // Phase 22: Initialize RuleIngestionEngine with template
    try {
      const { getRuleIngestionEngine } = require('./ruleIngestionEngine');
      const ruleEngine = getRuleIngestionEngine();
      ruleEngine.initialize(WORLD_TEMPLATE);
      // eslint-disable-next-line no-console
      console.log('[worldEngine] RuleIngestionEngine initialized with registry template');
    } catch (error_init) {
      // eslint-disable-next-line no-console
      console.warn('[worldEngine] Failed to initialize RuleIngestionEngine:', error_init);
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(`[worldEngine] Failed to load template "${WORLD_REGISTRY_TEMPLATEID}" from registry`);
    WORLD_TEMPLATE = null;
  }
} catch (error_) {
  // eslint-disable-next-line no-console
  console.warn('[worldEngine] World registry initialization failed, using minimal defaults', error_);
  WORLD_TEMPLATE = null;
}

/**
 * Returns the currently loaded world template.
 */
export function getWorldTemplate(): any {
  return WORLD_TEMPLATE;
}

/**
 * Phase 30: Get the world registry for template selection
 */
export function getAvailableTemplates(): WorldTemplateMetadata[] {
  const registry = getWorldRegistry();
  return registry.listTemplates();
}

/**
 * Phase 22: Hot-swap a new template at runtime, triggering rule re-initialization
 * Simulates a Live Ops update without server restart
 * 
 * @param newTemplate The new world template to swap in
 */
export function hotSwapTemplate(newTemplate: any): void {
  if (!newTemplate) {
    console.warn('[worldEngine] Attempted hot-swap with null template');
    return;
  }

  WORLD_TEMPLATE = newTemplate;
  console.log('[worldEngine] Hot-swapped template at runtime');

  // Phase 22: Re-initialize RuleIngestionEngine with new template
  try {
    const { getRuleIngestionEngine } = require('./ruleIngestionEngine');
    const ruleEngine = getRuleIngestionEngine();
    ruleEngine.initialize(newTemplate);
    console.log('[worldEngine] RuleIngestionEngine re-initialized with new template');
  } catch (e) {
    console.warn('[worldEngine] Failed to reinitialize RuleIngestionEngine:', e);
  }

  // Update CausalWeatherEngine if needed
  if (causalWeatherEngineInstance) {
    causalWeatherEngineInstance = null;
    getCausalWeatherEngine();  // Reinitialize
    console.log('[worldEngine] CausalWeatherEngine re-initialized');
  }
}

/**
 * Phase 27: Deep merge a patch into the base world template
 * Validates patch compatibility before applying
 * 
 * @param base The base world template
 * @param patch The partial patch to merge
 * @param options Configuration for patch application
 * @returns The merged template if valid, null if validation fails
 */
export function mergePatch(
  base: any,
  patch: any,
  options?: { validateHardFacts?: boolean; checkParadox?: boolean; dryRun?: boolean }
): any | null {
  if (!base || !patch) {
    console.warn('[worldEngine] mergePatch: base or patch is null');
    return null;
  }

  const opts = options || { validateHardFacts: true, checkParadox: true, dryRun: false };
  
  // Log patch application attempt
  const patchLog = {
    timestamp: Date.now(),
    patchId: patch.id || `patch-${Date.now()}`,
    baseVersion: base.version || 'unknown',
    status: 'pending' as 'pending' | 'applied' | 'rejected'
  };

  try {
    // Validation stage
    if (opts.validateHardFacts && base.epicSoulEvents) {
      for (const hardFact of base.epicSoulEvents) {
        if (hardFact.isImmutable && patch.epicSoulEvents) {
          const patchedFact = patch.epicSoulEvents.find((e: any) => e.id === hardFact.id);
          if (patchedFact && JSON.stringify(patchedFact) !== JSON.stringify(hardFact)) {
            console.warn(`[worldEngine] Patch attempted to modify immutable hard fact: ${hardFact.id}`);
            patchLog.status = 'rejected';
            return null;
          }
        }
      }
    }

    // Check for paradox loops (patches that would contradict current state)
    if (opts.checkParadox && patch.injectedRules?.combatFormulas) {
      const baseCrit = base.injectedRules?.combatFormulas?.critMultiplier ?? 2.0;
      const patchCrit = patch.injectedRules.combatFormulas.critMultiplier;
      // Allow reasonable variance (up to 5x) but reject extreme swings (>10x)
      if (patchCrit && Math.abs(patchCrit / baseCrit) > 10) {
        console.warn(`[worldEngine] Patch creates paradox loop: crit multiplier variance too extreme (${baseCrit} -> ${patchCrit})`);
        patchLog.status = 'rejected';
        return null;
      }
    }

    // Deep merge: create merged template
    const merged = JSON.parse(JSON.stringify(base));
    
    // Recursively merge patch properties
    const deepMerge = (target: any, source: any, depth: number = 0): void => {
      if (depth > 20) {
        console.warn('[worldEngine] mergePatch: maximum recursion depth exceeded');
        return;
      }

      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] === null || source[key] === undefined) {
            // Null/undefined removes the key
            delete target[key];
          } else if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
            // Recursively merge objects
            if (!target[key] || typeof target[key] !== 'object') {
              target[key] = {};
            }
            deepMerge(target[key], source[key], depth + 1);
          } else if (Array.isArray(source[key])) {
            // For arrays, replace entirely (not merge)
            target[key] = JSON.parse(JSON.stringify(source[key]));
          } else {
            // For primitives, replace
            target[key] = source[key];
          }
        }
      }
    };

    deepMerge(merged, patch);

    if (!opts.dryRun) {
      patchLog.status = 'applied';
      console.log(`[worldEngine] Patch applied successfully: ${patchLog.patchId}`);
    } else {
      patchLog.status = 'applied';
      console.log(`[worldEngine] Patch validated (dry-run): ${patchLog.patchId}`);
    }

    // Track patch application
    if (!merged._patchHistory) {
      merged._patchHistory = [];
    }
    merged._patchHistory.push(patchLog);

    return merged;
  } catch (error: any) {
    console.error('[worldEngine] mergePatch error:', error.message);
    patchLog.status = 'rejected';
    return null;
  }
}

/**
 * Apply a patch at runtime and hot-swap the template
 * This is the Live Ops entry point for applying world patches without restart
 * 
 * @param patch The patch to apply (e.g., void-wastes.json)
 */
export function applyLiveOpsPatch(patch: any): boolean {
  if (!WORLD_TEMPLATE) {
    console.error('[worldEngine] Cannot apply patch: no world template loaded');
    return false;
  }

  const merged = mergePatch(WORLD_TEMPLATE, patch, {
    validateHardFacts: true,
    checkParadox: true,
    dryRun: false
  });

  if (!merged) {
    console.error('[worldEngine] Patch validation failed');
    return false;
  }

  // Hot-swap the merged template
  hotSwapTemplate(merged);
  console.log('[worldEngine] Live Ops patch applied and active');
  return true;
}
let causalWeatherEngineInstance: CausalWeatherEngine | null = null;

function getCausalWeatherEngine(): CausalWeatherEngine {
  if (!causalWeatherEngineInstance) {
    causalWeatherEngineInstance = new CausalWeatherEngine();
    const rng = getGlobalRng();
    if (rng) {
      causalWeatherEngineInstance.setSeededRng(rng);
    }
  }
  return causalWeatherEngineInstance;
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
  // Phase 45 Remediation: Tile depletion tracking to prevent gathering exploits
  tileHarvestHistory?: Array<{ tileX: number; tileY: number; lastHarvestTick: number; harvestCount: number }>;
  // Beta Phase 9: Atmospheric Sinks for Paradox manifestations
  atmosphericSinks?: Array<{
    paradoxThreshold: number;
    manifestation: string;
    visualFilter: 'sepia' | 'bleached' | 'glitched' | 'static' | 'pulsing-red' | 'void-violet';
    soundscapeOverride?: string;
  }>;
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
  trigger: string; // Description of what caused conflict
  active: boolean;
  startedAt: number; // tick
  resolvedAt?: number;
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

/**
 * Phase 10: Snapshot Storage Types
 * 
 * WorldSnapshot represents a serialized checkpoint of world state at a specific tick.
 * Used for optimized hydration: load snapshot + replay delta events instead of full replay.
 */
export interface WorldSnapshot {
  id: string;                          // Unique snapshot identifier
  worldInstanceId: string;             // Which world this snapshot belongs to
  tick: number;                        // World tick when snapshot was created
  stateHash: string;                   // SHA-256 hash of serialized state (for integrity verification)
  previousSnapshotHash?: string;       // Hash of previous snapshot (forms chain for tamper detection)
  serializedState: string;             // JSON representation of WorldState (compressed in production)
  createdAt: number;                   // Timestamp when snapshot was persisted
  eventCountInWindow?: number;         // How many events occurred between this snapshot and previous
}

/**
 * Abstract snapshot storage interface
 * Implementations: Redis, PostgreSQL, IndexedDB, or in-memory for BETA
 */
export interface SnapshotStorageBackend {
  save(snapshot: WorldSnapshot): Promise<void>;
  load(snapshotId: string): Promise<WorldSnapshot | null>;
  findMostRecent(worldInstanceId: string, beforeTick: number): Promise<WorldSnapshot | null>;
  listAll(worldInstanceId: string): Promise<WorldSnapshot[]>;
  delete(snapshotId: string): Promise<void>;
  deleteOlderThan(worldInstanceId: string, tick: number): Promise<number>;
}

/**
 * In-memory snapshot storage for BETA (development)
 * Stores snapshots in a Map; simulates persistence without external dependencies
 */
export class InMemorySnapshotStorage implements SnapshotStorageBackend {
  private snapshots: Map<string, WorldSnapshot> = new Map();
  
  async save(snapshot: WorldSnapshot): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);
  }
  
  async load(snapshotId: string): Promise<WorldSnapshot | null> {
    return this.snapshots.get(snapshotId) || null;
  }
  
  async findMostRecent(worldInstanceId: string, beforeTick: number): Promise<WorldSnapshot | null> {
    const relevant = Array.from(this.snapshots.values())
      .filter(s => s.worldInstanceId === worldInstanceId && s.tick < beforeTick)
      .sort((a, b) => b.tick - a.tick);
    return relevant.length > 0 ? relevant[0] : null;
  }
  
  async listAll(worldInstanceId: string): Promise<WorldSnapshot[]> {
    return Array.from(this.snapshots.values())
      .filter(s => s.worldInstanceId === worldInstanceId)
      .sort((a, b) => a.tick - b.tick);
  }
  
  async delete(snapshotId: string): Promise<void> {
    this.snapshots.delete(snapshotId);
  }
  
  async deleteOlderThan(worldInstanceId: string, tick: number): Promise<number> {
    const before = this.snapshots.size;
    const toDelete = Array.from(this.snapshots.values())
      .filter(s => s.worldInstanceId === worldInstanceId && s.tick < tick)
      .map(s => s.id);
    toDelete.forEach(id => this.snapshots.delete(id));
    return toDelete.length;
  }
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
  level?: number; // NPC level for combat/power scaling
  reputation?: number; // Individual NPC reputation (-100 to 100)
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
  // M56: Biological Anchor & Generational Legacy
  race?: 'Human' | 'Elf' | 'Beastkin' | 'Dwarf' | 'Automaton';
  age?: number;
  maxAge?: number;
  lineageId?: string; // Tracks descendants across generations
  descendantOf?: string; // npcId of parent for hereditary traits
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
  // Phase 20: Bloodline divergence traits
  traits?: string[];  // Evolutionary traits gained through bloodline divergence
  
  // Phase 41: NPC Intent System
  // Predictable next action that player can see before acting, enabling tactical card play
  intent?: {
    actionTypeId: string;  // e.g., 'attack', 'defend', 'heal', 'flee', 'cast-spell'
    targetId?: string;     // e.g., state.player.id or another NPC id
    intensity: number;     // 0-100: How committed to this action (affects priority)
    predictedDamage?: number; // Estimated damage this action will deal
    predictedCost?: number;  // AP cost to NPC
    lastComputedTick?: number;  // When this intent was calculated
  };
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
  id?: string;
  description?: string;
  type?: "visit" | "combat" | "exploration" | "challenge" | "gather" | "craft" | "investigation" | "social"; 
  location?: string;
  target?: string;
  quantity?: number;
  requiredClues?: string[]; // Phase 10/11: Required investigation clues (M49-A2)
  status?: 'pending' | 'completed' | 'failed';
  timeConstraints?: { startHour?: number; endHour?: number };
};
export type Quest = { 
  id: string; 
  name?: string; // Phase 11 compatibility
  title?: string; 
  description?: string; 
  objectives?: QuestObjective[];
  objective?: QuestObjective;
  preRequisites?: string[]; // Phase 11: Quest chain dependencies
  dependencies?: string[]; 
  rewards?: any; 
  expiresInHours?: number;
  currentObjectiveIndex?: number;
  gatedReward?: { location?: string; access?: boolean };
  // Phase 8: NPC giver and quest status tracking
  giverId?: string; // Phase 11 compatibility
  giverNpcId?: string;  // NPC ID of quest giver
  status?: 'active' | 'completed' | 'abandoned' | 'available' | 'not-started';  // Quest status
  type?: string;
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

/**
 * M47-E1: Parsed Dialogue Entry Interface
 * Enhanced dialogue entry with sensory cues and NPC personality data
 * Used by EnhancedDialogPanel for rich dialogue visualization
 */
export type ParsedDialogueEntry = {
  npcId: string;
  npcName: string;
  text: string;
  emotionalState?: {
    trust?: number;
    fear?: number;
    gratitude?: number;
    resentment?: number;
  };
  timestamp?: number;
  isRumor?: boolean;
  isFact?: boolean;
  npcStressed?: boolean;
  npcPersonality?: {
    greediness: number;
    piety: number;
    ambition: number;
    loyalty: number;
    risk: number;
    sociability: number;
  };
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
    echoes?: Array<{           // Phase 44: Echo imprints from significant events
      echoId: string;
      name: string;
      description: string;
      eventTrigger: string;
      statModifiers?: Record<string, number>;
      abilityMods?: Array<{ abilityId: string; costModifier?: number; damageModifier?: number }>;
      rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
      timestamp?: number;
    }>;
  };
};

export type InventoryItem = StackableItem | UniqueItem;

export type EquipmentSlots = {
  // Aetheric & Resonance (Column 1)
  head?: string;
  neck?: string;
  ring1?: string;
  ring2?: string;
  
  // Physical Core (Column 2)
  chest?: string;
  waist?: string;
  legs?: string;
  feet?: string;
  
  // Martial & Resonance (Column 3)
  back?: string;
  hands?: string;
  ring3?: string;
  ring4?: string;
  mainHand?: string;
  offHand?: string;
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
  credits?: number;              // Phase 46: Cyberpunk currency
  scrip?: number;                // Phase 46: Alternative currency (labor scrip, tokens, etc.)
  experience?: number;
  xp?: number;
  level?: number;
  attributePoints?: number;
  reputation?: Record<string, number>;
  // Phase 46: Workstation state
  activeWorkstationId?: string;  // Currently open workstation
  blindFusingItems?: InventoryItem[]; // Items queued for blind fusion attempts
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  grit?: number;                 // Grit: endurance/willpower resource (third resource alongside HP/MP)
  maxGrit?: number;
  statusEffects?: string[];
  stats?: {
    str: number;
    agi: number;
    int: number;
    cha: number;
    end: number;
    luk: number;
    perception?: number; // M47: Player perception level for sensory filtering (0-100)
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
  race?: string; // Phase 13: Player's starting/base race
  lastMorphTick?: number; // Phase 13: Tick when last morph occurred
  recentMorphCount?: number; // Phase 13: Morphs in recent window (for cooldown multiplier)
  // Phase 47: Ancestral Tapestry - World-aware passive trees
  ancestryTree?: string; // ID of the active ancestry tree (tied to race and world template)
  ancestryNodes?: string[]; // Array of unlocked ancestry node IDs
  discoveredSecrets?: Set<string>; // Phase 14: IDs of discovered hidden areas (e.g., "hermit-cave")
  explorationProgress?: Record<string, number>; // Phase 14: Track % explored per location
  equippedRelics?: string[]; // Phase 15: IDs of currently equipped relics
  runicInventory?: { runeId: string; quantity: number }[]; // Phase 15: Collected runes
  boundRelicId?: string; // Phase 15: ID of the "Bound" relic (cannot drop)
  infusionHistory?: Array<{ relicId: string; runeId: string; timestamp: number }>; // Phase 15: Track infusions for corruption
  itemCorruption?: Record<string, number>; // Phase 15: Corruption level per item ID (0-100)
  activeTargetId?: string | null; // Phase 7: Currently selected entity ID
  // ALPHA_M9: Skill system
  skillPoints?: number; // Available skill points to spend
  unlockedSkills?: string[]; // IDs of unlocked skills from skill tree/constellation
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
  name: string; // Player character name (required for SoulMirrorOverlay)
  generation: number; // M47-A2: Player's generation in the ancestral line (1 = no ancestry, 2+ = inherited)
  // Phase 19: Tutorial State
  tutorialState: any; // Persistent tutorial milestone tracking (Type-checked in tutorialEngine.ts)
  tutorialOverlay?: any; // Phase 19: Current active tutorial UI modal data
  // Phase 10: UI Theme preference for Hero's Reliquary HUD
  theme?: 'dark-arcane' | 'vale-twilight' | 'ethereal'; // Player's selected UI theme (defaults to 'dark-arcane')
  // Phase 5: Heroic Awakening - Narrative character data
  originStory?: string;                                  // Player's backstory/origin narrative
  archetype?: string;                                    // Character archetype (e.g., 'exiled-noble', 'wandering-scholar')
  talents?: string[];                                    // Array of innate talent IDs (limited to 3)
  talentDetails?: Record<string, { name: string; description: string; effect: string }>; // Talent metadata for UI display
  // Phase 7: Targeting System
  targetingMode?: 'none' | 'hostile' | 'friendly'; // Current targeting mode
  // Phase 8: Encounter Lifecycle
  inCombat?: boolean; // Whether player is currently in an encounter
  combatStartedAt?: number; // Tick when combat began
  combatRound?: number; // Current round number (for turn tracking)
  combatLog?: Array<{ tick: number; actor: string; action: string; target?: string; result: string }>; // Battle log
  // Phase 39: Action Points (AP) system for turn-based card play
  ap?: number; // Current action points available this turn
  maxAp?: number; // Maximum AP per turn (typically 3)
  lastApRecoveryTick?: number; // Tick when AP was last recovered
  // Phase 39: Authoritative hand, deck, and discard tracking (stored in engine, not UI)
  hand?: string[]; // Array of ability IDs currently in hand
  deck?: string[]; // Array of ability IDs remaining in deck
  discard?: string[]; // Array of ability IDs in discard pile
  // Phase 40: Current narrative codec provides mechanical and visual modifiers
  currentCodec?: string; // e.g., 'CODENAME_MEDIEVAL', 'CODENAME_CYBERPUNK', etc.
  
  // Phase 41: Combat stance affects damage/defense tradeoffs
  combatStance?: 'aggressive' | 'defensive' | 'balanced'; // Strategic posture for combat

  // Phase 42: Universal proficiency system (Learn by Doing)
  proficiencies?: Record<string, {
    xp: number;                    // Total XP in this proficiency (0+)
    level: number;                 // Proficiency level (0-20, where 10 = journeyman, 20 = master)
    passion?: 0 | 1 | 2;          // 0 = 35% XP, 1 = 100% XP (normal), 2 = 150% XP (passionate)
    lastUsageTick?: number;        // Last tick this proficiency was used (for decay calculation)
    dailyXpEarned?: number;        // XP earned today (resets daily, for soft-cap enforcement)
    lastDailyReset?: number;       // Tick when daily XP counter was last reset
    botchStreak?: number;          // Consecutive botches (reduces XP gain)
  }>;
  // Proficiency categories: Blades, Blunt, Marksman, Arcane, Stealth, Smithing, Alchemy, Weaving, Artifice, Survival, Performance
  
  // Session 4: Global daily XP cap tracking (8,000 XP/day across all proficiencies)
  dailyXpEarnedGlobal?: number;    // Total XP earned today across all proficiencies (resets daily)
  dailyXpResetTick?: number;       // Tick when daily XP was last reset (for daily boundary detection)
};

export type ResourceNode = {
  id: string;
  name: string;
  locationId: string;
  type: string;
  remainingResources: number;
  maxResources: number;
  regenerationRate: number;
  lootTableId?: string; // Phase 14: Associated loot table for drops
  regeneratesInHours?: number; // Phase 14: Regeneration cooldown
  depletedAt?: number; // Phase 14: Depletion timestamp (tick)
};

// Phase 14: Item, Loot and Crafting Registry
export type ItemTemplate = {
  id: string;
  name: string;
  description: string;
  kind: 'stackable' | 'unique';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  baseValue: number;
  stats?: {
    damage?: number;
    defense?: number;
    power?: number;
    paradoxScale?: number;
  };
  requirements?: {
    str?: number;
    agi?: number;
    int?: number;
    perception?: number;
  };
};

export type LootTable = {
  id: string;
  locationId?: string;
  biome?: string;
  drops: Array<{
    itemId: string;
    chance: number; // 0-1
    minQuantity: number;
    maxQuantity: number;
  }>;
};

export type CraftingRecipe = {
  id: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: Array<{
    itemId: string;
    quantity: number;
  }>;
  requiredFacility?: 'alchemy_bench' | 'forge' | 'none';
  discoveryHardFactId?: string;
};

/**
 * Phase 47: Ancestry Node and Tree types for world-aware passive skill progression.
 * Imported by ancestryRegistry.ts
 */
export type AncestryModifier = {
  statName: string;       // 'str', 'agi', 'int', 'perception', 'xpMultiplier', etc.
  value: number;          // +/- delta to apply
  duration?: 'permanent'; // Currently only permanent modifiers supported
};

export type AncestryNode = {
  id: string;                        // Unique within tree (e.g., "elf_fantasy_mana_1")
  name: string;                      // Display name (e.g., "Ley Attunement")
  description: string;               // Flavor text explaining the node
  cost: number;                      // XP cost to unlock this node
  requirements: {
    prerequisiteNodeIds?: string[];  // Must unlock these nodes first
    minimumLevel?: number;           // Minimum player level required
    minimumProficiency?: Array<{
      proficiencyName: string;
      level: number;
    }>;                              // Minimum proficiency levels required
  };
  modifiers: AncestryModifier[];     // Stats gained from this node
  unlocks?: string[];                // Node IDs that become available after this one
  aesthetics?: {
    icon?: string;                   // Icon name or emoji
    color?: string;                  // Node color for UI (e.g., '#FFD700')
    tier?: number;                   // Visual tier (0=root, 1=mid, 2=end)
  };
};

export type AncestryTree = {
  id: string;                        // Unique ID (e.g., "elf_fantasy_tapestry")
  race: string;                      // Race this tree is for (e.g., "Elf")
  codec: string;                     // World template/codec (e.g., "fantasy", "cyberpunk")
  name: string;                      // Display name (e.g., "The Ley-Weavers")
  rootNodeId: string;                // Entry node ID (must exist in nodes array)
  nodes: AncestryNode[];             // All nodes in this tree
  description?: string;              // Flavor description of the bloodline
  baseStats?: Record<string, number>; // Starting stat allocation (8-base system, Phase 49)
};

/**
 * Template structure for world definitions loaded from JSON files
 * (demo-fantasy-world.json, luxfier-world.json, etc.)
 */
export type WorldTemplate = {
  name: string;
  description: string;
  genre: string;
  version: string;
  season: string;
  baseEpoch: string;
  multiEpochEnabled: boolean;
  timeSettings?: any;
  chroniclerFacts?: any[];
  NPCs?: any[];
  locations?: any[];
  quests?: any[];
  factions?: any[];
  events?: any[];
  rules?: any[];
  lore?: string;
  startLocation?: string;
  ancestryTrees?: AncestryTree[];  // Phase 47: Race-specific passive trees
  [key: string]: any;  // Allow additional template-specific fields
};

export type WorldState = {
  id: string;
  tick?: number;
  seed: number; // Phase 14.5: Seeded RNG for deterministic world simulation
  hour: number;
  day: number;
  dayPhase: "night" | "morning" | "afternoon" | "evening";
  season: "winter" | "spring" | "summer" | "autumn";
  weather: "clear" | "snow" | "rain" | "ash_storm" | "cinder_fog" | "mana_static"; // Phase 17: Extended causal weather types
  time?: { tick: number; baseHour?: number; baseDay?: number; hour: number; minute?: number; day: number; season: WorldState['season'] };
  locations: Location[];
  npcs: NPC[];
  quests: Quest[];
  itemTemplates?: ItemTemplate[]; // Phase 14: Global item definitions
  lootTables?: LootTable[];       // Phase 14: Regional loot tables
  craftingRecipes?: CraftingRecipe[]; // Phase 14: Alchemical recipes
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
  paradox?: number;  // Additional paradox property for UI controls
  temporalParadoxes?: any[];  // Active paradox effects/anomalies
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';  // World decay level for UI feedback
  narrativeInterventions?: any[];  // Director/Seer narrative intervention history
  // BETA Phase 10: Web of Whispers (Information & Relationships)
  rumors?: any[];  // Pre-seeded rumors from template
  relationships?: any[];  // NPC-to-NPC relationships (trust, debt, status)
  standardActionCosts?: Record<string, number>;  // Global tick costs for actions
  travelMatrix?: Record<string, Record<string, number>>;  // Point-to-point travel costs
  investigationClues?: Record<string, any[]>;  // Clue sources for investigation
  soulEchoes?: any[];  // Ancestral perks and relics (M45-C1)
  factionPricingRules?: Record<string, any>;  // Faction-specific pricing modifiers (M44-D2)
  // Phase 16: Economic Pressure - Market flux and pricing dynamics
  marketFluxByLocation?: Record<string, any>;  // locationId → MarketFlux (supply/demand shifts)
  lastMarketUpdateTick?: number;  // Track when markets were last updated
  // BETA Phase 2: Social Memory - Track all active psychological scars across NPCs
  activeSocialScars?: SocialScar[];  // Betrayals, trauma from relationships
  // Phase 13: Multi-Generation Paradox Tracking
  generationalParadox?: number;  // Cumulative paradox across all epochs (never resets, persists across advanceToNextEpoch)
  epochGenerationIndex?: number; // Current generation number (1st ascension = 1, 2nd = 2, etc.)
  // M47-E1: Dialogue History - Track all dialogue exchanges in world state
  dialogueHistory?: ParsedDialogueEntry[];
  // Phase 23: Seasonal modifiers cache - Updated every 1000 ticks or on season change
  currentSeasonalModifiers?: Record<string, number>;  // e.g., { manaRegenMult: 1.3, staminaDecayMult: 1.2 }
  lastSeasonalModifierUpdateTick?: number;  // Track when seasonal modifiers were last refreshed
  // Phase 27: Paradox Bleed - Visual tint override from corrupted parallel worlds
  paradoxBleedTint?: string;  // RGB or hex color from inverse palette (e.g., #1a0a2e when paradox bleeds from other worlds)
  globalParadoxAverage?: number;  // Cached global paradox level from top 5 corrupted worlds
  // Phase 29: Visual overrides for multiverse paradox effects
  visualOverrides?: any;
  // Phase 45-A1: Action Lock - Prevent concurrent overlapping actions per actor
  actionLocks?: Record<string, number>;  // actorId → tickUntilClear: prevents action overlap during execution
  // Phase 45-A3: Tile Depletion - Track harvested resource tiles for respawn management
  depletedTiles?: Record<string, number>;  // tileId → depletionTime: timestamp when tile was depleted for respawn calculation
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
 * Phase 7: Apply stat scaling to NPCs based on location spiritDensity
 * Creates a "Danger Level" that scales NPC stats to match location difficulty
 * Higher spiritDensity = stronger NPCs in that location
 * 
 * @param npcs NPCs to scale
 * @param locations Locations with spiritDensity values
 * @returns NPCs with enhanced stats based on location danger
 */
export function applyNpcStatScaling(npcs: NPC[], locations: Location[]): NPC[] {
  return npcs.map((npc) => {
    const npcLocation = locations.find((l) => l.id === npc.locationId);
    const spiritDensity = npcLocation?.spiritDensity ?? 0.5; // Default to medium difficulty
    
    // Danger level multiplier: 0.5 at spiritDensity 0, 1.5 at spiritDensity 1.0
    const dangerMultiplier = 0.5 + (spiritDensity * 1.0);
    
    // Apply multiplier to HP
    const baseMaxHp = npc.maxHp || 100;
    const scaledMaxHp = Math.floor(baseMaxHp * dangerMultiplier);
    
    // Update NPC with scaled stats
    return {
      ...npc,
      maxHp: scaledMaxHp,
      hp: Math.min(npc.hp || baseMaxHp, scaledMaxHp), // Cap current HP at new max
      // Also scale stat-based damage potential via AbilityResolver calculations
      dangerLevel: spiritDensity // Store for ability damage scaling
    };
  });
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
  // Phase 7: Apply stat scaling based on location spiritDensity
  npcs = applyNpcStatScaling(npcs, locations);
  const quests = tpl?.quests ? structuredCloneSafe(tpl.quests) : [];
  const metadata = tpl?.metadata ? structuredCloneSafe(tpl.metadata) : { audioVolume: 0.8, particleDensity: 'medium' };
  // record template origin for event provenance
  if (tpl && (tpl.id || tpl.name || tpl.metadata?.templateId)) {
    metadata.templateOrigin = tpl.id || tpl.name || tpl.metadata?.templateId;
  } else {
    metadata.templateOrigin = 'builtin';
  }
  
  // Stage 8.99: Include character creation template data in metadata
  // This ensures ancestryTrees, talentPool, and other character-related data flow to CharacterWizard
  if (tpl?.ancestryTrees) {
    metadata.ancestryTrees = structuredCloneSafe(tpl.ancestryTrees);
  }
  if (tpl?.talentPool) {
    metadata.talentPool = structuredCloneSafe(tpl.talentPool);
  }
  if (tpl?.ancestryAvailability) {
    metadata.ancestryAvailability = structuredCloneSafe(tpl.ancestryAvailability);
  }
  if (tpl?.divinePresence) {
    metadata.divinePresence = structuredCloneSafe(tpl.divinePresence);
  }
  if (tpl?.startingGearChoices) {
    metadata.startingGearChoices = structuredCloneSafe(tpl.startingGearChoices);
  }
  if (tpl?.curiosityPool) {
    metadata.curiosityPool = structuredCloneSafe(tpl.curiosityPool);
  }
  if (tpl?.startingLocations) {
    metadata.startingLocations = structuredCloneSafe(tpl.startingLocations);
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

  // Initialize factions with controlledLocationIds
  const factions = (() => {
    const templateFactions = tpl?.factions ? structuredCloneSafe(tpl.factions) : null;
    if (templateFactions) {
      // Ensure template factions have controlledLocationIds initialized
      templateFactions.forEach((faction: any) => {
        if (!faction.controlledLocationIds) {
          faction.controlledLocationIds = [];
        }
      });
      return templateFactions;
    } else {
      return initializeFactions({ 
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
      } as WorldState);
    }
  })();

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
      name: "Adventurer", // Default player name
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
      generation: 1, // M47-A2: Start as first generation (no ancestry)
      // Phase 19: Tutorial State
      tutorialState: initializeTutorialState(), // Initialize empty tutorial milestones
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
    factionRelationships: tpl?.factionRelationships ? structuredCloneSafe(tpl.factionRelationships) : initializeFactionRelationships(),
    factionConflicts: [],
    // Phase 11: Initialize faction system
    factions,
    // M15 Step 5: Initialize influence map (locationId → factionId → score)
    influenceMap: tpl?.influenceMap ? structuredCloneSafe(tpl.influenceMap) : (() => {
      const map: Record<string, Record<string, number>> = {};
      locations.forEach((loc: Location) => {
        map[loc.id] = {};
        // Factions start with influence at their primary location only
        factions.forEach((faction: Faction) => {
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
    // BETA Phase 10: Web of Whispers
    rumors: tpl?.rumors ? structuredCloneSafe(tpl.rumors) : [],
    relationships: tpl?.relationships ? structuredCloneSafe(tpl.relationships) : [],
    standardActionCosts: tpl?.standardActionCosts ? structuredCloneSafe(tpl.standardActionCosts) : {
      search: 15,
      rest_short: 60,
      rest_long: 480,
      dialogue_per_word: 0.1,
      combat_round: 10
    },
    travelMatrix: tpl?.travelMatrix ? structuredCloneSafe(tpl.travelMatrix) : {},
    investigationClues: tpl?.investigationClues ? structuredCloneSafe(tpl.investigationClues) : {},
    soulEchoes: tpl?.soulEchoes ? structuredCloneSafe(tpl.soulEchoes) : [],
    factionPricingRules: tpl?.factionPricingRules ? structuredCloneSafe(tpl.factionPricingRules) : {},
    worldFragments: tpl?.worldFragments ? structuredCloneSafe(tpl.worldFragments) : [],
    // Phase 45-A1: Initialize action locks (empty at start - populated during action execution)
    actionLocks: {},
    // Phase 45-A3: Initialize depleted tiles (empty at start - populated as tiles are harvested)
    depletedTiles: {}
  };
}

/**
 * Initialize a new world from a template
 * Creates a fresh WorldState with no player data, populated from the provided template
 *
 * @param template World template containing locations, npcs, factions, etc.
 * @returns New WorldState initialized from template
 */
export function initializeWorld(template: any): WorldState {
  // Helper for deep clone with fallback
  const structuredCloneSafe = (v: any) => {
    try {
      return structuredClone(v);
    } catch (e) {
      return JSON.parse(JSON.stringify(v));
    }
  };

  // Extract template data
  const locations = template.locations
    ? structuredCloneSafe(template.locations)
    : [
        { id: 'town', name: 'Town Square' },
        { id: 'forest', name: 'Forest' },
        { id: 'hill', name: 'Green Hill' },
        { id: 'lake', name: 'Silver Lake' }
      ];

  let npcs = template.npcs ? structuredCloneSafe(template.npcs) : [];
  // Initialize NPC inventories using helper function
  npcs = initializeNpcInventories(npcs, locations);

  const quests = template.quests ? structuredCloneSafe(template.quests) : [];
  const factions = template.factions
    ? structuredCloneSafe(template.factions)
    : [
        { id: 'silver-flame' },
        { id: 'ironsmith-guild' },
        { id: 'luminara-mercantile' },
        { id: 'shadow-conclave' },
        { id: 'adventurers-league' }
      ];

  // Create default player state
  const player: PlayerState = {
    id: 'player',
    name: 'Hero', // Default player name
    generation: 1, // Starting generation
    tutorialState: {}, // Empty tutorial state
    location: template.startLocation || locations[0]?.id || 'town',
    quests: {},
    gold: 100,
    experience: 0,
    xp: 0,
    level: 1,
    attributePoints: 0,
    reputation: {},
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    statusEffects: [],
    stats: {
      str: 10,
      agi: 10,
      int: 10,
      cha: 10,
      end: 10,
      luk: 10,
      perception: 50
    },
    inventory: [],
    equipment: {},
    knowledgeBase: [],
    visitedLocations: [template.startLocation || locations[0]?.id || 'town'],
    beliefLayer: { npcLocations: {}, npcStats: {}, facts: {}, suspicionLevel: 0 },
    suspicionLevel: 0,
    discoveryAttempts: [],
    factionReputation: {},
    temporalDebt: 0,
    soulStrain: 0,
    discoveredSecrets: new Set(),
    explorationProgress: {},
    equippedRelics: [],
    runicInventory: [],
    activeTargetId: null
  };

  // Initialize faction reputation for player
  factions.forEach((f: any) => {
    player.factionReputation![f.id] = 0;
  });

  // Create initial world state
  const worldState: WorldState = {
    id: '', // Will be set by caller
    seed: Math.floor(Math.random() * 0x7fffffff),
    hour: 8,
    day: 1,
    dayPhase: 'morning',
    season: 'spring',
    weather: 'clear',
    locations,
    npcs,
    quests,
    factions,
    factionRelationships: [], // Will be initialized by faction engine
    factionConflicts: [],
    influenceMap: {},
    relics: {},
    relicEvents: [],
    audio: initializeAudioState(),
    player,
    needsCharacterCreation: true,
    rumors: template.rumors || [],
    relationships: [],
    activeSocialScars: [],
    dialogueHistory: [],
    currentSeasonalModifiers: {},
    lastSeasonalModifierUpdateTick: 0
  };

  return worldState;
}

/**
 * Hash state for integrity verification
 * Used to detect silent corruption during normal operation
 */
function hashState(state: WorldState): string {
  try {
    const crypto = require('crypto');
    const canonical = JSON.stringify({
      tick: state.tick,
      player: state.player ? { id: state.player.id, level: state.player.level, hp: state.player.hp } : null,
      npcs: state.npcs ? state.npcs.length : 0,
      factions: state.factions ? state.factions.length : 0,
      paradoxLevel: state.paradoxLevel,
      season: state.season,
      weather: state.weather
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  } catch (e) {
    console.warn('[worldEngine] hashState failed:', e);
    return 'error';
  }
}

/**
 * Phase 36: Verify hash continuity every 500 ticks
 * Detects silent corruption (unlogged mutations or replay inconsistencies)
 */
function verifyHashContinuity(worldState: WorldState): void {
  // Only verify every 500 ticks to avoid performance impact
  if ((worldState.tick ?? 0) % 500 !== 0) {
    return;
  }

  try {
    // Calculate current state hash
    const liveHash = hashState(worldState);

    // Rebuild state from ledger for last 500 ticks
    const recentEvents: Event[] = getEventsForWorld(worldState.id || 'world-default');
    const startTick = Math.max(0, (worldState.tick ?? 0) - 500);
    const relevantEvents = recentEvents.filter(
      e => (e as any).tick !== undefined && (e as any).tick >= startTick
    );

    // Simple rebuilt hash based on event count and type summary
    let rebuildHash = '';
    if (relevantEvents.length > 0) {
      const eventSummary = {
        eventCount: relevantEvents.length,
        eventTypes: [...new Set(relevantEvents.map((e: any) => e.type))],
        lastEventType: relevantEvents[relevantEvents.length - 1]?.type,
        paradoxEvents: relevantEvents.filter((e: any) => e.type?.includes('PARADOX')).length
      };
      const crypto = require('crypto');
      rebuildHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(eventSummary))
        .digest('hex');
    }

    // Log verification result (warning if hashes significantly differ)
    if (rebuildHash && liveHash !== 'error' && !liveHash.startsWith(rebuildHash.substring(0, 8))) {
      console.warn(
        `[worldEngine] 🔮 Hash continuity check at Tick ${worldState.tick}:`,
        `\n  Live hash: ${liveHash.substring(0, 16)}...`,
        `\n  Rebuild estimate: ${rebuildHash.substring(0, 16)}...`,
        `\n  Recent events: ${relevantEvents.length} mutations in last 500 ticks`,
        '\n  ⚠️  Potential desync detected (Silent Corruption)'
      );

      // Trigger UI effect for player awareness
      if ((worldState as any).paradoxRippleEffect) {
        (worldState as any).paradoxRippleEffect = true;
      }
    } else {
      // Normal verbose logging for hash continuity success
      console.log(
        `[worldEngine] ✓ Hash continuity OK at Tick ${worldState.tick} (${relevantEvents.length} recent events)`
      );
    }
  } catch (error) {
    console.error('[worldEngine] verifyHashContinuity failed:', error);
  }
}

/**
 * Standalone advanceTick function for deployment scripts
 * Creates a world controller and advances the world state
 * Phase 36: Includes hash verification every 500 ticks for paradox detection
 */
export async function advanceTick(worldState: WorldState, template?: any): Promise<void> {
  // Increment tick
  worldState.tick = (worldState.tick ?? 0) + 1;

  // Phase 36: Verify hash continuity every 500 ticks for Silent Corruption detection
  verifyHashContinuity(worldState);
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
    lastFactionTick: currentState.lastFactionTick ?? 0,
    // BETA Phase 10: Web of Whispers
    rumors: template.rumors ? structuredCloneSafe(template.rumors) : [],
    relationships: template.relationships ? structuredCloneSafe(template.relationships) : [],
    factionPricingRules: template.factionPricingRules ? structuredCloneSafe(template.factionPricingRules) : {},
    standardActionCosts: template.standardActionCosts ? structuredCloneSafe(template.standardActionCosts) : {
      search: 15,
      rest_short: 60,
      rest_long: 480,
      dialogue_per_word: 0.1,
      combat_round: 10
    },
    travelMatrix: template.travelMatrix ? structuredCloneSafe(template.travelMatrix) : {},
    investigationClues: template.investigationClues ? structuredCloneSafe(template.investigationClues) : {},
    soulEchoes: template.soulEchoes ? structuredCloneSafe(template.soulEchoes) : [],
    worldFragments: template.worldFragments ? structuredCloneSafe(template.worldFragments) : []
  };
}

/**
 * [Phase 11] Calculates the final trade price for an item based on faction rules, 
 * reputation, and world modifiers.
 */
export function calculateTradePrice(
  state: WorldState, 
  basePrice: number, 
  factionId?: string, 
  isBuying: boolean = true
): number {
  if (!factionId || !state.factionPricingRules || !state.factionPricingRules[factionId]) {
    return basePrice;
  }

  const rule = state.factionPricingRules[factionId];
  let multiplier = rule.baseMultiplier ?? 1.0;

  // Apply reputation modifier
  // Phase 11 uses factionReputation map in player data
  const playerRep = state.player?.factionReputation?.[factionId] || 0;
  
  // Reputation is typically -100 to +100
  // Positive reputation lowers prices when buying, negative increases
  const repMod = (rule.reputationMod || 0) * (playerRep / 100);
  
  if (isBuying) {
    multiplier -= repMod;
  } else {
    multiplier += repMod;
  }

  // Ensure multiplier doesn't go below a reasonable floor (e.g., 0.2) or above ceiling (e.g., 5.0)
  multiplier = Math.max(0.2, Math.min(5.0, multiplier));

  return Math.round(basePrice * multiplier);
}

/**
 * [Phase 10] Calculates the tick cost for an action based on world rules and player stats.
 */
export function calculateActionTickCost(
  state: WorldState,
  actionType: string,
  _context?: any
): number {
  const baseCosts = state.standardActionCosts || {
    search: 15,
    rest_short: 60,
    rest_long: 480,
    dialogue_per_word: 0.1,
    combat_round: 10
  };

  let cost = (baseCosts as any)[actionType] || 0;

  // Example modifier: Agility reduce search costs
  if (actionType === 'search' && state.player?.stats?.agi) {
    const agiBonus = Math.min(0.5, state.player.stats.agi / 100); 
    cost *= (1 - agiBonus);
  }

  return Math.ceil(cost);
}

/**
 * Phase 13: Biological Legacy & Generational Logic
 * 
 * Humans: 80-90 years
 * Elves: 800-1000 years
 * Beastkin: 120-150 years
 * Dwarves: 300-400 years
 * Automatons: Infinite (unless damaged)
 */
export function calculateNaturalLifespan(race?: NPC['race']): number {
  const rng = getGlobalRng();
  switch (race) {
    case 'Elf': return 800 + Math.floor(rng.next() * 200);
    case 'Beastkin': return 120 + Math.floor(rng.next() * 30);
    case 'Dwarf': return 300 + Math.floor(rng.next() * 100);
    case 'Automaton': return 1000000; // Functional immortality
    case 'Human':
    default: return 80 + Math.floor(rng.next() * 10);
  }
}

/**
 * Create a new world controller with optional template selection
 * @param initial - Initial world state (if not provided, creates fresh from template)
 * @param dev - Debug mode flag
 * @param templateId - Optional template ID to use (defaults to registry default)
 */
export function createWorldController(initial?: WorldState, dev = false, templateId?: string) {
  // Resolve template: explicit ID or registry default
  let template: any = WORLD_TEMPLATE; // Start with globally loaded template
  
  if (templateId) {
    const registry = getWorldRegistry();
    const resolvedTemplate = registry.getTemplate(templateId);
    if (resolvedTemplate) {
      template = resolvedTemplate;
      console.log(`[worldController] Using template: ${templateId}`);
    } else {
      console.warn(`[worldController] Template not found: ${templateId}, using default`);
    }
  }
  
  // copy-on-write: instantiate a fresh world from template if initial is not provided
  let state: WorldState = initial ? (function(i){ try { // @ts-ignore
    return structuredClone(i); } catch(e){ return JSON.parse(JSON.stringify(i)); } })(initial) : createInitialWorld("world-1", template);
  
  // Ensure state has an id (defensive programming)
  if (!state.id) {
    state.id = 'world-default';
    console.warn('[WorldController] State missing id, using default');
  }
  
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
  if (state.metadata?.templateOrigin && template) {
     legacyEngine.initFromTemplate(template as any);
  }

  // Initialize Audio Engine state
  let audioState: AudioState = initializeAudioState();
  if (!state.audio) {
    state.audio = audioState;
  }
  
  // Phase 10: Initialize snapshot storage (in-memory for BETA)
  const snapshotStorage = new InMemorySnapshotStorage();
  let lastSnapshotTick: number = 0;
  
  let timer: any = null;
  const subs: Subscriber[] = [];
  let journal = new CJ(state.id);
  
  // Phase 37: Turn-Based Heartbeat State
  let isInTurnResolution = false;
  let currentTurnPhase: 'action' | 'resolution' | 'idle' = 'idle';
  let lastActionTurnTick = 0;
  // validate initial state after journal created
  const initialValidation = validateInvariants(state);
  if (!isStatePlayable(state)) {
    console.warn('Initial state has critical violations', initialValidation.violations);
  }

  function emit() {
    subs.forEach(s => s(state));
  }

  async function advanceTick(amount = 1) {
    const prevTick = state.tick ?? 0;
    const nextTick = prevTick + Math.max(0, Math.floor(amount));

    // Phase 29: Multiverse Paradox Sync
    const mAdapter = getMultiverseAdapterSafe();
    let multiverseVisuals = null;
    if (mAdapter) {
      await mAdapter.syncGlobalParadox(nextTick);
      multiverseVisuals = mAdapter.getParadoxVisuals();
    }

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

    // Phase 29: Inject Multiverse visuals into state
    if (multiverseVisuals) {
      state.visualOverrides = {
        ...(state.visualOverrides || {}),
        multiverseBleed: multiverseVisuals
      };
    } else if (state.visualOverrides?.multiverseBleed) {
      delete state.visualOverrides.multiverseBleed;
    }

    // Use seasonEngine for deterministic seasonal progression
    const { current: nextSeason, dayOfSeason, hasChanged: seasonChanged, transitionEvent: seasonTransition } = resolveSeason(nextTick, state.season);

    // Phase 23: Cache seasonal modifiers every 1000 ticks or on season change
    let nextSeasonalModifiers = state.currentSeasonalModifiers || {};
    const lastSeasonalModifierUpdateTick = state.lastSeasonalModifierUpdateTick ?? 0;
    if (seasonChanged || nextTick - lastSeasonalModifierUpdateTick >= 1000) {
      const tpl = WORLD_TEMPLATE || {};
      const seasonalRules = tpl.seasonalRules;
      const modifiers = getSeasonalModifiers(nextSeason as any, seasonalRules);
      nextSeasonalModifiers = modifiers as any;
    }

    // Phase 27: Check global paradox bleed and apply visual tint overrides
    // Query top 5 corrupted worlds every 150 ticks to trigger cross-world effects
    let nextParadoxBleedTint = state.paradoxBleedTint;
    let nextGlobalParadoxAverage = state.globalParadoxAverage || 0;
    
    if (nextTick % 150 === 0) {
      try {
        // TODO: Implement getGlobalParadoxAverage in DatabaseAdapter
        // const db = getDatabaseAdapter();
        // if (db) {
        //   const { average, topWorlds } = await db.getGlobalParadoxAverage();
        //   nextGlobalParadoxAverage = average;
        // }
        
        // For now, use local paradox level as global average
        nextGlobalParadoxAverage = state.paradoxLevel || 25;
          
          // Apply visual tint override based on global paradox level
          // High paradox (>50) triggers inverse RGB palette colors
          if (nextGlobalParadoxAverage > 50) {
            // Inverse winter palette from void-wastes patch: #1a0a2e (deep purple inverse)
            nextParadoxBleedTint = '#1a0a2e'; // Inverse of bright winter white
          } else if (nextGlobalParadoxAverage > 30) {
            // Moderate corruption: shift towards desaturated tones
            nextParadoxBleedTint = '#4a3b5c'; // Mixed corruption
          } else {
            // Clear bleed effect
            nextParadoxBleedTint = undefined;
          }
          
          console.log(`[worldEngine] Paradox bleed check: global avg ${nextGlobalParadoxAverage.toFixed(2)}, tint ${nextParadoxBleedTint || 'none'}`);
      } catch (err) {
        console.warn('[worldEngine] Paradox bleed query error:', (err as any).message);
      }
    }

    // Determine day phase
    let nextDayPhase: WorldState['dayPhase'] = 'morning';
    if (nextHour < 6) nextDayPhase = 'night';
    else if (nextHour < 12) nextDayPhase = 'morning';
    else if (nextHour < 18) nextDayPhase = 'afternoon';
    else nextDayPhase = 'evening';

    // Phase 17: Use Causal Weather Engine if rules are defined in template
    let nextWeather: 'clear' | 'snow' | 'rain' | 'ash_storm' | 'cinder_fog' | 'mana_static' = 'clear';
    let weatherIntensity: 'light' | 'moderate' | 'heavy' = 'light';
    let weatherChanged = false;
    let weatherTransition: string | undefined = undefined;

    if (state && typeof state === 'object' && !Array.isArray(state)) {
      // Try to resolve weather causal ly for the player's current location
      const playerLocation = state.player?.location || (state.locations?.[0]?.id);
      if (playerLocation) {
        try {
          const causalEngine = getCausalWeatherEngine();
          const causalResult = causalEngine.resolveWeatherByCausalRules(
            playerLocation,
            state,
            nextTick,
            nextSeason as any
          );
          nextWeather = causalResult.current as any;
          weatherIntensity = causalResult.intensity;
          weatherChanged = causalResult.hasChanged;
          weatherTransition = causalResult.transitionEvent;
        } catch (e) {
          // If causal engine fails, fall back to base weather
          let baseWeatherfallback: 'clear' | 'snow' | 'rain' = 'clear';
          const stateWeather = state.weather || 'clear';
          if (stateWeather === 'snow') baseWeatherfallback = 'snow';
          else if (stateWeather === 'rain') baseWeatherfallback = 'rain';
          else if (stateWeather === 'ash_storm') baseWeatherfallback = 'rain';
          else if (stateWeather === 'cinder_fog') baseWeatherfallback = 'rain';
          else if (stateWeather === 'mana_static') baseWeatherfallback = 'clear';
          
          const fallback = resolveWeather(nextSeason, nextHour, baseWeatherfallback);
          nextWeather = fallback.current as any;
          weatherIntensity = fallback.intensity;
          weatherChanged = fallback.hasChanged;
          weatherTransition = fallback.transitionEvent;
        }
      }
    }

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

    // Phase 15: Process artifact sentience (mood decay and state updates)
    const sentientRelics = processArtifactSentience(state, amount);
    if (sentientRelics.length > 0 && state.player?.inventory) {
      // Sync updated relic moods back to player inventory
      state = {
        ...state,
        player: {
          ...state.player,
          inventory: state.player.inventory.map(item => {
            const updatedRelic = sentientRelics.find(r => r.id === (item as any).instanceId);
            return updatedRelic ? ({ ...item, ...updatedRelic } as any) : item;
          })
        }
      };
    }

    // M55-C1: Process NPC social interactions (GOSSIP, persuasion, etc.)
    // This triggers social intents when conditions are met (e.g., coLocationTicks > 50 for GOSSIP)
    const socialTickResult = npcSocialEngine.processNpcSocialTick(updatedNpcs, state, nextTick, 0.08);
    if (socialTickResult.descriptions && socialTickResult.descriptions.length > 0) {
      console.log(`[NpcSocialTick] ${socialTickResult.interactionsOccurred} interactions: ${socialTickResult.descriptions.join('; ')}`);
    }

    // Phase 19: Tutorial Heartbeat
    if (state.player?.tutorialState) {
      const newMilestones = detectMilestones(state, state.player.tutorialState);
      if (newMilestones.length > 0) {
        state = {
          ...state,
          player: {
            ...state.player,
            tutorialState: updateTutorialState(state.player.tutorialState, newMilestones, state.tick),
            tutorialOverlay: getNextTutorialOverlay(updateTutorialState(state.player.tutorialState, newMilestones, state.tick))
          }
        };
      } else {
        state = {
          ...state,
          player: {
            ...state.player,
            tutorialOverlay: getNextTutorialOverlay(state.player.tutorialState)
          }
        };
      }
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
    // Phase 17: Map extended weather types to base weather for audio (ash_storm -> 'rain', mana_static -> 'clear', etc.)
    let audioWeather: 'clear' | 'snow' | 'rain' = 'clear';
    if (nextWeather === 'snow') audioWeather = 'snow';
    else if (nextWeather === 'rain') audioWeather = 'rain';
    else if (nextWeather === 'ash_storm') audioWeather = 'rain'; // Ash storm uses rain audio
    else if (nextWeather === 'cinder_fog') audioWeather = 'rain'; // Cinder fog uses rain audio
    else if (nextWeather === 'mana_static') audioWeather = 'clear'; // Mana static uses clear audio
    
    const nextAudio = calculateRequiredAudio(
      { ...state, hour: nextHour, dayPhase: nextDayPhase, season: nextSeason, weather: audioWeather, npcs: updatedNpcs },
      state.audio
    );

    // Decrement ability cooldowns each tick
    const decrementedCooldowns = state.player?.abilityCooldowns 
      ? Object.entries(state.player.abilityCooldowns).reduce((acc, [abilityId, remaining]) => {
          acc[abilityId] = Math.max(0, remaining - 1);
          return acc;
        }, {} as Record<string, number>)
      : undefined;

    // Phase 39: Player Maintenance - Recover AP at end of tick
    let nextPlayerState = state.player;
    if (state.player && state.player.maxAp && state.player.maxAp > 0) {
      // Check if AP needs recovery (at start of new turn or after action cost)
      const lastRecoveryTick = state.player.lastApRecoveryTick ?? state.tick ?? 0;
      const ticksSinceRecovery = (nextTick ?? 0) - lastRecoveryTick;
      
      // Recover AP to max at end of action turn (when triggerActionTurn() is called)
      if (ticksSinceRecovery >= 1 && state.player.ap !== state.player.maxAp) {
        nextPlayerState = {
          ...state.player,
          ap: state.player.maxAp,
          lastApRecoveryTick: nextTick,
          abilityCooldowns: decrementedCooldowns
        };
      } else {
        nextPlayerState = {
          ...state.player,
          abilityCooldowns: decrementedCooldowns
        };
      }
    } else {
      nextPlayerState = {
        ...state.player,
        abilityCooldowns: decrementedCooldowns
      };
    }

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
      time: { ...(state.time || {}), tick: nextTick, hour: nextHour, day: nextDay, season: nextSeason } as any,
      player: nextPlayerState,
      currentSeasonalModifiers: nextSeasonalModifiers,
      lastSeasonalModifierUpdateTick: lastSeasonalModifierUpdateTick === 0 || seasonChanged || nextTick - lastSeasonalModifierUpdateTick >= 1000 ? nextTick : lastSeasonalModifierUpdateTick,
      paradoxBleedTint: nextParadoxBleedTint,
      globalParadoxAverage: nextGlobalParadoxAverage
    };

    // Phase 45-A1: Clean up expired action locks (remove any locks where tickUntilClear <= current tick)
    if (state.actionLocks) {
      const cleanedActionLocks: Record<string, number> = {};
      for (const [actorId, tickUntilClear] of Object.entries(state.actionLocks)) {
        if (tickUntilClear > nextTick) {
          cleanedActionLocks[actorId] = tickUntilClear;
        }
      }
      state.actionLocks = cleanedActionLocks;
    }

    // Phase 45-A3: Clean up expired tile depletions (remove any tiles that have respawned)
    if (state.depletedTiles) {
      const resourceRespawnMs = 180000; // 3 minutes (180 seconds in ms)
      const cleanedDepletedTiles: Record<string, number> = {};
      const currentTimeMs = Date.now();
      for (const [tileId, depletionTime] of Object.entries(state.depletedTiles)) {
        if (currentTimeMs - depletionTime < resourceRespawnMs) {
          cleanedDepletedTiles[tileId] = depletionTime;
        }
      }
      state.depletedTiles = cleanedDepletedTiles;
    }

    // Phase 39: Emit RESOURCES_RECOVERED event if AP was recovered
    if (nextPlayerState.ap === nextPlayerState.maxAp && (state.player?.ap ?? 0) < nextPlayerState.maxAp) {
      const recoveryEv: Event = {
        id: `recovery-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: "system",
        type: "RESOURCES_RECOVERED",
        payload: { 
          ap: nextPlayerState.ap,
          maxAp: nextPlayerState.maxAp,
          reason: 'turn-end-recovery'
        },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
      };
      appendEvent(recoveryEv);
    }

    // Phase 41: Predict next NPC actions for tactical display
    // This allows the UI to show what each NPC will do next turn
    if (state.combatState?.active && state.npcs) {
      try {
        const { predictNextNpcAction } = require('./aiTacticEngine');
        state.npcs.forEach((npc: any) => {
          predictNextNpcAction(npc, state);
        });
      } catch (err) {
        console.warn('[worldEngine] Failed to predict NPC intents:', err);
      }
    }

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

      // Phase 17: Emit WORLD_EVENT for causal weather (faction contention, magical surge, etc.)
      // This allows the AI Weaver to reference environmental pressure in dialogue
      const causeMap = {
        contention: 'Faction conflicts intensify, stirring ash and discord',
        magic: 'Reality crackles with unleashed magical surges',
        macro_event: 'The world trembles as fate shifts',
        magnus_fluctus: 'Reality itself bends to unknown forces',
        base: 'The seasons turn, bringing new weather patterns'
      };
      
      const cause = (weatherTransition?.includes('contention') || (weatherChanged && nextWeather === 'ash_storm')) 
        ? 'contention' 
        : (weatherChanged && nextWeather === 'mana_static') 
        ? 'magic' 
        : 'base';
      
      const worldEv: Event = {
        id: `world-event-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: "system",
        type: "WORLD_EVENT",
        payload: { 
          eventType: 'CAUSAL_WEATHER_SHIFT',
          weather: nextWeather,
          cause,
          narrative: causeMap[cause as keyof typeof causeMap] || 'Something shifts in the world',
          locationId: state.player?.location
        },
        templateOrigin: state.metadata?.templateOrigin,
        timestamp: Date.now(),
      };
      appendEvent(worldEv);
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

      // Phase 17: Check for possession-triggered hazards (inventory paradox effects)
      const possessionResults = checkPossessionHazards(state, state.player, 0.5);
      const allHazardResults = [...hazardResults, ...possessionResults];

      allHazardResults.forEach(result => {
        if (result.triggered) {
          // Apply damage if applicable
          if (result.damage > 0) {
            // Phase 17: Check if location is sanctified and reduce damage by 50%
            const playerLocation = state.locations?.find(loc => loc.id === state.player.location);
            const dampenedDamage = applySanctifiedZoneDampening(result.damage, playerLocation?.biome, playerLocation?.name);
            
            state = {
              ...state,
              player: applyHazardDamage(state.player, dampenedDamage)
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

    // Phase 16: Update market flux for each location (every 24 ticks = hourly)
    if ((nextTick % 24 === 0) && state.locations.length > 0) {
      const marketFluxByLocation = state.marketFluxByLocation || {};
      
      for (const location of state.locations) {
        const previousFlux = marketFluxByLocation[location.id];
        const updatedFlux = updateMarketFlux(location.id, state, previousFlux);
        marketFluxByLocation[location.id] = updatedFlux;
        
        // Emit market alert every 12 hours if there's significant movement
        if ((nextTick % 288 === 0) && updatedFlux.volatility > 0.2) {
          const alert = generateMarketAlert(updatedFlux, state);
          const marketAlertEv: Event = {
            id: `market-alert-${Date.now()}-${location.id}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'MARKET_FLUX_ALERT',
            payload: {
              locationId: location.id,
              locationName: location.name,
              message: alert.message,
              affectedItems: alert.affectedItems,
              severity: alert.severity,
              volatility: updatedFlux.volatility
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(marketAlertEv);
        }
      }
      
      state = {
        ...state,
        marketFluxByLocation,
        lastMarketUpdateTick: nextTick
      };
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

        // Phase 9: Process narrative attrition (NPC SocialScar accumulation)
        // Attempt to generate new scars for NPCs based on their current state
        const rng = getGlobalRng();
        const { scarsGenerated, affectedNpcs } = processWorldNarrativeAttrition(state, rng);
        
        if (scarsGenerated > 0) {
          const narrativeAttritionEv: Event = {
            id: `narrative-attrition-${Date.now()}`,
            worldInstanceId: state.id,
            actorId: 'system',
            type: 'NARRATIVE_ATTRITION',
            payload: {
              scarsGenerated,
              affectedNpcs: Array.from(affectedNpcs),
              tick: nextTick,
              epoch: Math.floor(nextTick / 1440)
            },
            templateOrigin: state.metadata?.templateOrigin,
            timestamp: Date.now(),
          };
          appendEvent(narrativeAttritionEv);
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

        // Phase 13: Biological Legacy (Daily Aging and Mortality)
        if (state.npcs && state.npcs.length > 0) {
          const biologicalUpdates = state.npcs.map((npc: NPC) => {
            // Age increment: 1/365th of a year per day
            const currentAge = npc.age || 20;
            const nextAge = currentAge + (1/365);
            
            // Determine max age if not set (ensures persistent maxAge across ticks)
            const maxAge = npc.maxAge || calculateNaturalLifespan(npc.race);
            const isDying = nextAge >= maxAge;
            
            if (isDying && npc.importance !== 'critical' && !npc.isDisplaced) {
              const deathEv: Event = {
                id: `natural-death-${Date.now()}-${npc.id}`,
                worldInstanceId: state.id,
                actorId: 'system',
                type: 'NPC_NATURAL_DEATH',
                payload: { 
                  npcId: npc.id, 
                  npcName: npc.name, 
                  race: npc.race, 
                  finalAge: Math.floor(nextAge), 
                  lineageId: npc.lineageId 
                },
                templateOrigin: state.metadata?.templateOrigin,
                timestamp: Date.now(),
              };
              appendEvent(deathEv);
              // Mark as displaced (vanished due to mortality) to prevent further simulation
              return { ...npc, age: nextAge, maxAge, isDisplaced: true } as NPC;
            }
            
            return { ...npc, age: nextAge, maxAge } as NPC;
          });
          state = { ...state, npcs: biologicalUpdates };
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

    // === Phase 10: Snapshot Persistence ===
    // Emit snapshot every 100 ticks for optimized hydration
    if (nextTick > 0 && nextTick % 100 === 0) {
      try {
        const { computeSnapshotHash } = require('./saveLoadEngine');
        
        // Compute hash of current state
        const stateHash = computeSnapshotHash(state);
        const previousSnapshotHash = lastSnapshotTick > 0 ? `snapshot_${lastSnapshotTick}` : undefined;
        
        // Create snapshot record
        const snapshot: WorldSnapshot = {
          id: `snapshot_${nextTick}`,
          worldInstanceId: state.id,
          tick: nextTick,
          stateHash,
          previousSnapshotHash,
          serializedState: JSON.stringify(state),
          createdAt: Date.now(),
          eventCountInWindow: nextTick - lastSnapshotTick
        };
        
        // Persist snapshot (async, non-blocking)
        snapshotStorage.save(snapshot).catch(err => {
          console.warn(`[Snapshot] Failed to persist snapshot at tick ${nextTick}:`, err);
        });
        
        // Emit snapshot saved event for audit trail
        const snapshotEv: Event = {
          id: `snapshot-saved-${nextTick}`,
          worldInstanceId: state.id,
          actorId: 'system',
          type: 'SNAPSHOT_SAVED',
          payload: {
            tick: nextTick,
            snapshotId: snapshot.id,
            eventCountInWindow: snapshot.eventCountInWindow,
            stateHash: stateHash.substring(0, 16),
            serializedSizeBytes: snapshot.serializedState.length
          },
          templateOrigin: state.metadata?.templateOrigin,
          mutationClass: 'SNAPSHOT',
          timestamp: Date.now(),
        };
        appendEvent(snapshotEv);
        
        // Update last snapshot tick
        lastSnapshotTick = nextTick;
      } catch (err) {
        // Non-fatal: snapshot persistence is optimization
        console.warn(`[Snapshot] Error creating snapshot at tick ${nextTick}:`, err);
      }
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

    // Phase 27: Persist state to database periodically
    // Save every 100 ticks using write-behind strategy (Redis cache → Postgres)
    // Applies narrative pruning based on importance weights from template
    if (nextTick % 100 === 0) {
      try {
        const db = getDatabaseAdapterSafe();
        if (db && WORLD_TEMPLATE?.narrativePruningWeights) {
          const worldEvents = getEventsForWorld(state.id) || [];
          const recentEvents = worldEvents.filter((e: any) => e.tick >= nextTick - 100);

          // Flush Redis cache to Postgres with narrative pruning applied
          db.saveActiveStateToPostgres(
            state.id,
            state,
            recentEvents,
            WORLD_TEMPLATE.narrativePruningWeights
          ).catch(err => {
            console.warn('[worldEngine] Persistence flush error:', err.message);
          });
        }
      } catch (err) {
        console.warn('[worldEngine] Persistence error:', err);
      }
    }

    emit();
  }

  /**
   * Phase 37: Manual tick function (no longer auto-triggered)
   * Kept for backwards compatibility with production systems
   * Turn-based flow uses triggerActionTurn() instead
   */
  function tick() {
    try { advanceTick(1); } catch (err) {}
  }

  /**
   * Phase 37: Turn-Based Heartbeat - Initialize turn-based mode
   * Removes the auto-ticker and prepares for manual action triggers
   * Backend systems can still use start() for backwards compatibility
   */
  function start() {
    if (timer) return;
    // In turn-based mode, DON'T start the auto-ticker
    // Leave timer = null for manual control via triggerActionTurn()
    console.log('[worldEngine] Turn-based mode: awaiting triggerActionTurn() calls');
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /**
   * Phase 37: Trigger a single action turn pulse
   * Called by UI when player submits an action during board game mode
   * Resolves NPC logic, world effects, and Director intervention atomically
   * 
   * @param actionCost Optional tick cost for this turn (default: 1)
   * @returns TurnResolution with phase tracking and event summary
   */
  function triggerActionTurn(actionCost: number = 1): { phase: typeof currentTurnPhase; tickResolved: number; eventCount: number; completed: boolean } {
    if (isInTurnResolution) {
      console.warn('[worldEngine] Turn already in resolution, rejecting concurrent trigger');
      return { phase: currentTurnPhase, tickResolved: state.tick ?? 0, eventCount: 0, completed: false };
    }

    try {
      isInTurnResolution = true;
      currentTurnPhase = 'action';
      lastActionTurnTick = state.tick ?? 0;

      // Resolve the turn pulse atomically
      advanceTick(actionCost);
      
      currentTurnPhase = 'resolution';
      
      // Phase 37: Evaluate Director Intervention during resolution phase
      // (Ensures narrative flavor text only appears after action settles)
      try {
        const interventionEvents = evaluateDirectorIntervention(state, directorState);
        if (interventionEvents && interventionEvents.length > 0) {
          interventionEvents.forEach(ev => {
            appendEvent(ev);
            if (ev.payload?.text) {
              console.log(`[worldEngine] Director Whisper during turn resolution: "${ev.payload.text}"`);
            }
          });
        }
      } catch (err) {
        console.warn('[worldEngine] Director intervention error during turn:', err);
      }

      const tickResolved = state.tick ?? 0;
      const recentEvents = getEventsForWorld(state.id).filter((e: any) => e.tick === tickResolved || (Date.now() - (e.timestamp ?? 0)) < 100);
      
      currentTurnPhase = 'idle';
      isInTurnResolution = false;

      console.log(`[worldEngine] Action turn resolved: Tick ${lastActionTurnTick} → ${tickResolved}, Events: ${recentEvents.length}`);

      return {
        phase: 'idle',
        tickResolved,
        eventCount: recentEvents.length,
        completed: true
      };
    } catch (err) {
      console.error('[worldEngine] Turn resolution failed:', err);
      currentTurnPhase = 'idle';
      isInTurnResolution = false;
      return { phase: 'idle', tickResolved: state.tick ?? 0, eventCount: 0, completed: false };
    }
  }

  /**
   * Phase 37: Get current turn phase for UI synchronization
   */
  function getCurrentTurnPhase(): typeof currentTurnPhase {
    return currentTurnPhase;
  }

  /**
   * Phase 37: Check if turn resolution is in progress
   */
  function isTurnInProgress(): boolean {
    return isInTurnResolution;
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
            // Phase 39: Initialize AP system and hand/deck/discard arrays
            const starterAbilities = ['fireball', 'frost-nova', 'heal', 'shield-spell', 'teleport'];
            const initialHand = starterAbilities.slice(0, 5);
            const initialDeck = starterAbilities.slice(5).concat(['fireball', 'frost-nova']); // Add some duplicates for variety
            
            const characterWithPhase39 = {
              ...character,
              // Phase 39: Initialize AP to 3 (turn-based action points)
              ap: 3,
              maxAp: 3,
              lastApRecoveryTick: state.tick ?? 0,
              // Phase 39: Initialize authoritative hand/deck/discard state
              hand: initialHand,
              deck: initialDeck,
              discard: [],
              // Phase 40: Initialize current codec (Medieval as baseline)
              currentCodec: 'CODENAME_MEDIEVAL'
            };
            
            console.log('[worldEngine] CHARACTER_CREATED event processing:', {
              characterName: characterWithPhase39.name,
              ancestryTree: characterWithPhase39.ancestryTree
            });
            
            state = { ...state, player: characterWithPhase39, needsCharacterCreation: false };
            
            console.log('[worldEngine] CHARACTER_CREATED - State updated:', {
              needsCharacterCreation: state.needsCharacterCreation,
              playerName: state.player?.name
            });
            
            // Phase 6: Apply narrative seed from character creation choices
            try {
              const narrativeSeed = NarrativeSeedProcessor.procesPlayerCharacterSeed(characterWithPhase39);
              NarrativeSeedProcessor.applySeedToWorldState(state, narrativeSeed);
              NarrativeSeedProcessor.applyModifiersToPlayer(state.player, narrativeSeed.playerModifiers);
              
              console.log(`[NarrativeSeed] Applied seed for ${characterWithPhase39.name} (${characterWithPhase39.archetype}):`, {
                prologue: narrativeSeed.prologueQuestId,
                discoveredLocations: narrativeSeed.discoveredLocations,
                initialReputation: narrativeSeed.initialReputation,
                phase39: { ap: 3, hand: initialHand.length, deck: initialDeck.length }
              });
            } catch (err) {
              console.error('[NarrativeSeed] Failed to apply narrative seed:', err);
            }
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
        case "QUEST_COMPLETED": {
          const qid = e.payload.questId;
          const updatedQuests = { ...state.player.quests, [qid]: { ...state.player.quests[qid], status: "completed" } };
          
          // PHASE 11: Check for next links in the quest chain
          const worldQuests = state.quests || [];
          const nextChainQuests = worldQuests.filter(q => q.preRequisites?.includes(qid));
          
          nextChainQuests.forEach(nq => {
            // If all prerequisites are met, mark as active in player history
            const allMet = nq.preRequisites?.every(pqid => updatedQuests[pqid]?.status === 'completed');
            if (allMet && (!updatedQuests[nq.id] || updatedQuests[nq.id].status === 'not-started')) {
               updatedQuests[nq.id] = { status: 'active', startedAt: state.tick };
            }
          });

          state = { ...state, player: { ...state.player, quests: updatedQuests } };
          break;
        }
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
          const factionRep = { ...(state.player.factionReputation ?? {}) };
          Object.keys(delta).forEach(k => { 
            rep[k] = (rep[k] ?? 0) + Number(delta[k] ?? 0); 
            factionRep[k] = (factionRep[k] ?? 0) + Number(delta[k] ?? 0);
          });
          state = { ...state, player: { ...state.player, reputation: rep, factionReputation: factionRep } };
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
    const actionMap: Record<string, string> = {
      'MOVE': 'travel',
      'SEARCH': 'search',
      'REST': 'rest_short',
      'WAIT': 'wait'
    };
    
    // [Phase 11] Use dynamic tick cost calculation
    let cost = 1;
    if (action.type === 'MOVE') {
      // Travel cost from matrix
      const from = state.player.location;
      const to = action.payload?.to;
      cost = (state.travelMatrix?.[from]?.[to]) ?? 1;
    } else {
      cost = calculateActionTickCost(state, actionMap[action.type] || action.type.toLowerCase());
    }

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
      
      // Debug: Log state before emit
      if (action.type === 'SUBMIT_CHARACTER') {
        console.log('[worldEngine] performAction BEFORE EMIT:', {
          actionType: action.type,
          needsCharacterCreation: state.needsCharacterCreation,
          playerName: state.player?.name,
          ancestryTree: state.player?.ancestryTree,
          eventsCount: events.length
        });
      }
      
      emit();
      
      if (action.type === 'SUBMIT_CHARACTER') {
        console.log('[worldEngine] performAction AFTER EMIT - events returned:', events.length);
      }
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

  /**
   * Phase 48-Chronos: Execute multiple ticks in "Quiet Mode"
   * 
   * Fast-forwards time while suppressing individual event emissions.
   * Returns a summary event with aggregated world changes.
   * 
   * @param tickCount How many ticks to skip (1-1000)
   * @param quietMode If true, suppress mid-skip emissions (default: true)
   * @returns Summary with tick delta, resources recovered, faction changes, etc.
   */
  function executeBatchTicks(tickCount: number, quietMode: boolean = true): {
    startTick: number;
    endTick: number;
    ticksProcessed: number;
    eventLog: any[];
    summary: {
      hpRecovered: number;
      mpRecovered: number;
      xpGained: number;
      factionChanges: Record<string, number>;
      interruptedAt?: number;
    };
  } {
    if (tickCount <= 0 || tickCount > 1000) {
      console.warn(`[Chronos] Invalid tickCount: ${tickCount}, clamping to 1-1000`);
      tickCount = Math.max(1, Math.min(1000, tickCount));
    }

    const startTick = state.tick ?? 0;
    const startHp = state.player?.hp ?? 0;
    const startMp = state.player?.mp ?? 0;
    const startXp = state.player?.xp ?? 0;
    const startFactionRep: Record<string, number> = { ...state.player.factionReputation };

    // Save original subscribers to restore later
    const savedSubs = [...subs];
    
    if (quietMode) {
      // Clear subscribers to suppress emissions during batch ticking
      subs.length = 0;
    }

    const eventLog: any[] = [];
    let interruptedAt: number | undefined;

    try {
      for (let i = 0; i < tickCount; i++) {
        // Risk check every 10 ticks - abort if high-priority event occurs
        if (i % 10 === 0 && i > 0) {
          const recentEvents = getEventsForWorld(state.id).slice(-5);
          const hasInterruptEvent = recentEvents.some(e =>
            e.type === 'QUEST_EXPIRED' ||
            e.type === 'AMBUSH_TRIGGERED' ||
            e.type === 'NPC_ENTERED_LOCATION' ||
            e.type === 'FACTION_CONFLICT_ESCALATED'
          );

          if (hasInterruptEvent) {
            console.log(`[Chronos] Interruption detected at tick +${i}, aborting batch`);
            interruptedAt = state.tick ?? 0;
            break;
          }
        }

        advanceTick(1);
        
        // Log major events from this tick
        const tickEvents = getEventsForWorld(state.id).filter((e: any) => e.tick === (state.tick ?? 0));
        if (tickEvents.length > 0) {
          eventLog.push(...tickEvents);
        }
      }
    } finally {
      // Restore subscribers and emit final state
      if (quietMode) {
        subs.push(...savedSubs);
      }
      
      // Emit final state
      emit();
    }

    const endTick = state.tick ?? 0;
    const endHp = state.player?.hp ?? 0;
    const endMp = state.player?.mp ?? 0;
    const endXp = state.player?.xp ?? 0;

    // Calculate deltas
    const summary = {
      hpRecovered: Math.max(0, endHp - startHp),
      mpRecovered: Math.max(0, endMp - startMp),
      xpGained: Math.max(0, endXp - startXp),
      factionChanges: {} as Record<string, number>,
      interruptedAt
    };

    // Track faction rep changes
    if (state.player.factionReputation) {
      for (const [factionId, newRep] of Object.entries(state.player.factionReputation)) {
        const oldRep = startFactionRep[factionId] ?? 0;
        const delta = newRep - oldRep;
        if (delta !== 0) {
          summary.factionChanges[factionId] = delta;
        }
      }
    }

    console.log(`[Chronos] Batch completed: Tick ${startTick} → ${endTick} (+${endTick - startTick}), HP +${summary.hpRecovered}, MP +${summary.mpRecovered}, XP +${summary.xpGained}`);

    // Log summary event
    const summaryEvent: Event = {
      id: `chronos-batch-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: 'system',
      type: 'CHRONOS_BATCH_COMPLETED',
      payload: {
        startTick,
        endTick,
        ticksProcessed: endTick - startTick,
        summary,
        eventLog
      },
      templateOrigin: state.metadata?.templateOrigin,
      timestamp: Date.now()
    };

    appendEvent(summaryEvent);

    return {
      startTick,
      endTick,
      ticksProcessed: endTick - startTick,
      eventLog,
      summary
    };
  }

  const kernelApi = Object.freeze({ getState: getStateClone, performAction, advanceTick, executeBatchTicks, triggerActionTurn, getCurrentTurnPhase, isTurnInProgress, load, getRecentMutations });
  
  const devApi = Object.freeze({ getState: getStateClone, performAction, advanceTick, executeBatchTicks, triggerActionTurn, getCurrentTurnPhase, isTurnInProgress, load, getRecentMutations, triggerSoulEcho, triggerMacroEvent, subscribe });

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

