/**
 * Engine Orchestrator (Phase 6 - Unified Orchestration Layer)
 * 
 * The master controller that initializes all core managers and orchestrates
 * the simulation tick cycle. Acts as the "Brain" of the project, coordinating:
 * 
 * 1. Initialization: Instantiate all 11+ core managers from a template (DSS 16)
 * 2. Tick Heartbeat: Execute 6-phase resolution every 1.5s in "Active" mode
 * 3. Chrono-Action Flow: Switch between Active (auto-tick) and Idle (awaiting input)
 * 4. Study Mode: Fast-forward up to 7 days (10,080 ticks) with accumulated decay
 * 5. Epoch Transitions: Massive 2,000-year time-skip with faction power recalculation
 * 6. UI Integration: Emit WorldUpdateEvents through EventBus for responsive UI
 * 
 * Architecture:
 *   EngineOrchestrator (Phase 6)
 *       ├─ Phase5Manager (orchestrates Persistence + Reincarnation + ResolutionStack)
 *       │   ├─ PersistenceManager (immutable ledger + Merkle Tree hashing)
 *       │   ├─ ReincarnationEngine (soul lifecycle, death/rebirth)
 *       │   └─ ResolutionStack (6-phase tick resolver)
 *       ├─ FrictionManager (vitals decay, cost tracking)
 *       ├─ FactionManager (faction turns, warfare, territory control)
 *       ├─ GeographyManager (land generation, environmental effects)
 *       ├─ DivineManager (deity interventions, miracles)
 *       └─ EventBus (UI subscriber pattern, state updates)
 */

import type { WorldTemplateMetadata } from './worldRegistry';
import type {
  Vessel,
  ActiveFaction,
  TerritoryNode,
  Deity,
  DivineAlignment,
  GlobalConstants,
  ParadoxTracker,
} from '../types';

import { Phase5Manager } from './Phase5Manager';
import { PersistenceManager, type StateHash } from './PersistenceManager';
import { ReincarnationEngine } from './ReincarnationEngine';
import { ResolutionStack, type PhaseResult, type PlayerIntent } from './ResolutionStack';
import { FrictionManager } from './FrictionManager';
import { GeographyManager } from './GeographyManager';
import { DivineManager } from './DivineManager';
import {
  EventBus,
  getGlobalEventBus,
  setGlobalEventBus,
  type WorldUpdateEvent,
  createWorldUpdateEvent,
  createMutation,
  createCausalLockInfo,
} from './EventBus';

/**
 * Simulation mode: how time progresses
 */
export type SimulationMode = 'idle' | 'active' | 'study-mode' | 'paused' | 'epoch-transition';

/**
 * Configuration for EngineOrchestrator initialization
 */
export interface OrchestratorConfig {
  templateId: string;
  seed?: number;
  worldInstanceId?: string;
  
  // Tick rates
  tickIntervalMs?: number; // How often to auto-tick in Active mode (default: 1500ms)
  
  // Persistence
  enablePersistence?: boolean;
  persistenceBackendType?: 'in-memory' | 'redis' | 'postgres';
  
  // Feature flags
  enableStudyMode?: boolean;
  enableEpochTransitions?: boolean;
  enableCausalLocks?: boolean;
  
  // Constants
  deepSnapshotInterval?: number; // Ticks between deep snapshots (default: 3600)
  studyModeTickCap?: number; // Max ticks for single study session (default: 10080 = 7 days)
  epochTransitionTickDuration?: number; // Ticks for era fracture event (default: 2880 = 2000 years)
}

/**
 * Engine state tracking
 */
export interface EngineState {
  currentTick: number;
  currentEpoch: number;
  currentMode: SimulationMode;
  worldInstanceId: string;
  templateId: string;
  
  // Active mode auto-tick timer
  activeTickTimerId?: NodeJS.Timeout;
  
  // Study mode tracking
  studyModeStartTick?: number;
  studyModeTicksRemaining?: number;
  
  // Epoch transition state
  epochTransitionInProgress?: boolean;
  epochTransitionStartTick?: number;
}

/**
 * EngineOrchestrator: Master Controller
 */
export class EngineOrchestrator {
  private config: OrchestratorConfig;
  private state: EngineState;
  
  // Core managers
  private phase5Manager!: Phase5Manager;
  private persistenceManager!: PersistenceManager;
  private reincarnationEngine!: ReincarnationEngine;
  private resolutionStack!: ResolutionStack;
  private frictionManager!: FrictionManager;
  private geographyManager!: GeographyManager;
  private divineManager!: DivineManager;
  private eventBus!: EventBus;
  
  // World state references
  private worldState: any = null;
  private vessels: Map<string, Vessel> = new Map();
  private factions: Map<string, ActiveFaction> = new Map();
  private territories: Map<string, TerritoryNode> = new Map();
  private deities: Map<string, Deity> = new Map();
  private constants: GlobalConstants | null = null;
  private paradoxTracker: ParadoxTracker | null = null;
  
  // Player tracking
  private playerVesselId?: string;
  private playerSoulId?: string;
  
  constructor(config: OrchestratorConfig) {
    this.config = {
      tickIntervalMs: 1500,
      enablePersistence: true,
      persistenceBackendType: 'in-memory',
      enableStudyMode: true,
      enableEpochTransitions: true,
      enableCausalLocks: true,
      deepSnapshotInterval: 3600,
      studyModeTickCap: 10080, // 7 days
      epochTransitionTickDuration: 2880, // 2000 years
      ...config,
    };
    
    this.state = {
      currentTick: 0,
      currentEpoch: 1,
      currentMode: 'idle',
      worldInstanceId: config.worldInstanceId || `world_${Date.now()}`,
      templateId: config.templateId,
    };
  }
  
  /**
   * Initialize the orchestrator and all managers
   * Creates world state from template, sets up managers, emits initial event
   */
  async initialize(template: WorldTemplateMetadata): Promise<void> {
    try {
      console.log(`[EngineOrchestrator] Initializing world from template: ${this.config.templateId}`);
      
      // Create EventBus and set as global
      this.eventBus = new EventBus();
      setGlobalEventBus(this.eventBus);
      
      // Initialize PersistenceManager
      this.persistenceManager = new PersistenceManager();
      
      // Initialize Reincarnation engine
      this.reincarnationEngine = new ReincarnationEngine({
        // enableCausalLocks disabled (not in ReincarnationConfig)
        causalLockDurationTicks: 259200, // 72 hours (1.5s per tick)
      });
      
      // Initialize ResolutionStack
      this.resolutionStack = new ResolutionStack();
      this.resolutionStack.setPersistenceManager(this.persistenceManager);
      
      // Initialize Phase5Manager (orchestrates all above)
      this.phase5Manager = new Phase5Manager(
        this.constants as GlobalConstants,
        undefined
      );
      
      // Initialize utility managers
      this.frictionManager = new FrictionManager();
      this.geographyManager = new GeographyManager();
      this.divineManager = new DivineManager();
      
      // TODO: Initialize world state from template
      // await this.initializeWorldState(template);
      
      // Create initial snapshot
      this.phase5Manager.initializeWorld(
        Array.from(this.vessels.values()),
        Array.from(this.factions.values()),
        Array.from(this.territories.values()),
        Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
        this.constants as GlobalConstants
      );
      
      // TODO: Stage 8.95: Place player and NPCs at spawn locations
      // await this.placePlayersAndNpcs(template);
      
      console.log(`[EngineOrchestrator] Initialization complete. Ready to tick.`);
      console.log(`[EngineOrchestrator] World ID: ${this.state.worldInstanceId}, Epoch: ${this.state.currentEpoch}, Mode: ${this.state.currentMode}`);
      
      // Emit initial state to subscribers
      this.emitWorldUpdate([]);
    } catch (error) {
      console.error('[EngineOrchestrator] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Execute one tick of simulation
   * 
   * Stage 8.98a: Now accepts optional PlayerIntent for D&D-style freedom
   * 
   * Called by:
   * - Auto-ticker in Active mode (every 1.5s)
   * - Manual step() calls by player with custom intents
   * - Batch processor in Study Mode
   */
  async step(playerIntent?: PlayerIntent): Promise<PhaseResult | null> {
    try {
      if (this.state.currentMode === 'paused') {
        console.warn('[EngineOrchestrator] Cannot step: simulation is paused');
        return null;
      }
      
      if (this.state.currentMode === 'epoch-transition') {
        return this.stepEpochTransition();
      }
      
      // Normal tick resolution
      const result = await this.phase5Manager.processTick(
        Array.from(this.vessels.values()),
        Array.from(this.factions.values()),
        Array.from(this.territories.values()),
        Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
        playerIntent // Stage 8.98a: Pass player intent through pipeline
      );
      
      // Update state
      this.state.currentTick++;
      
      // Check for snapshot trigger
      if (this.state.currentTick % this.config.deepSnapshotInterval! === 0) {
        await this.persistenceManager.createWorldSnapshot(
          Array.from(this.vessels.values()),
          Array.from(this.factions.values()),
          Array.from(this.territories.values()),
          Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
          this.constants as GlobalConstants,
          this.state.currentTick,
          this.state.currentEpoch,
          100,
          { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
        );
      }
      
      // Check for epoch trigger
      if (this.shouldTransitionToNextEpoch()) {
        await this.initiateEpochTransition();
      }
      
      // Stage 8.99b: Wire conflict events to mutations
      const mutations: any[] = [];
      if (result?.conflictEvent) {
        const conflictEvent = result.conflictEvent;
        const conflictMutation = {
          type: conflictEvent.isCustomAction ? 'custom_action_resolved' : 'conflict_resolved',
          actorId: conflictEvent.attacker.id,
          targetId: conflictEvent.defender.id,
          metadata: {
            tick: this.state.currentTick,
            d20Roll: conflictEvent.d20Roll,
            totalRoll: conflictEvent.totalRoll,
            dc: conflictEvent.customActionDC || conflictEvent.defenderAC,
            isHit: conflictEvent.isHit,
            isCriticalSuccess: conflictEvent.isCriticalSuccess,
            isCriticalFailure: conflictEvent.isCriticalFailure,
            customPrompt: conflictEvent.customPrompt,
            customStat: conflictEvent.customActionStat,
            statModifier: conflictEvent.statModifier,
            damageRoll: conflictEvent.damageRoll,
            totalDamage: conflictEvent.totalDamage,
          },
        };
        mutations.push(conflictMutation);
      }
      
      // Emit world update
      const phaseResult: PhaseResult = {
        phaseNumber: 6 as const,
        tickNumber: this.state.currentTick,
        success: true,
        mutations
      };
      this.emitWorldUpdate(phaseResult.mutations || []);
      
      return phaseResult;
    } catch (error) {
      console.error('[EngineOrchestrator] Step failed:', error);
      return null;
    }
  }
  
  /**
   * Step during epoch transition
   * Applies massive time-skip and faction power recalculation
   */
  private async stepEpochTransition(): Promise<PhaseResult> {
    const startTick = this.state.epochTransitionStartTick || this.state.currentTick;
    const elapsedTicks = this.state.currentTick - startTick;
    const duration = this.config.epochTransitionTickDuration!;
    
    if (elapsedTicks >= duration) {
      // Transition complete
      this.state.currentEpoch++;
      this.state.currentMode = 'idle'; // Return to idle after transition
      this.state.epochTransitionInProgress = false;
      
      console.log(`[EngineOrchestrator] Epoch transition complete! Now in Epoch ${this.state.currentEpoch}`);
      
      // Record epoch transition in ledger
      await this.persistenceManager.recordLedgerEntry(
        `epoch-${this.state.currentEpoch}` as any, // causeId
        'epoch-transition', // entryType (valid type)
        'CHRONOS', // actorId
        { oldEpoch: this.state.currentEpoch - 1, newEpoch: this.state.currentEpoch }, // data
        `Transition from Epoch ${this.state.currentEpoch - 1} to Epoch ${this.state.currentEpoch}` // description
      );
      
      // Emit epoch transition event
      this.emitWorldUpdate([
        createMutation({
          type: 'epoch_transition',
          tick: this.state.currentTick,
          metadata: { newEpoch: this.state.currentEpoch },
        }),
      ]);
      
      return {
        phaseNumber: 6,
        tickNumber: this.state.currentTick,
        success: true,
        message: `Epoch transition complete`,
      };
    } else {
      // Still transitioning - apply partial time-skip effects
      const progress = elapsedTicks / duration; // 0-1
      
      // Apply stochastic faction power shifts
      for (const faction of this.factions.values()) {
        const powerDelta = (Math.random() - 0.5) * progress * 10; // Stochastic shift
        faction.powerScore = Math.max(0, Math.min(100, faction.powerScore + powerDelta));
      }
      
      this.state.currentTick++;
      return {
        phaseNumber: 6,
        tickNumber: this.state.currentTick,
        success: true,
        message: `Epoch transition in progress (${Math.floor(progress * 100)}%)`,
      };
    }
  }
  
  /**
   * Switch to Active mode (auto-ticking every 1.5s)
   * Used during combat, magic casting, or other time-critical actions
   */
  switchToActiveMode(): void {
    if (this.state.currentMode === 'active') {
      console.warn('[EngineOrchestrator] Already in Active mode');
      return;
    }
    
    console.log('[EngineOrchestrator] Entering Active mode (auto-tick every 1.5s)');
    this.state.currentMode = 'active';
    
    // Start auto-ticker
    this.state.activeTickTimerId = setInterval(() => {
      this.step().catch(err => console.error('[EngineOrchestrator] Auto-tick failed:', err));
    }, this.config.tickIntervalMs);
  }
  
  /**
   * Switch to Idle mode (awaiting player input)
   * Player can manually step(), use Study Mode, or wait for game events
   */
  switchToIdleMode(): void {
    if (this.state.currentMode === 'idle') {
      console.warn('[EngineOrchestrator] Already in Idle mode');
      return;
    }
    
    console.log('[EngineOrchestrator] Entering Idle mode (awaiting input)');
    this.state.currentMode = 'idle';
    
    // Stop auto-ticker
    if (this.state.activeTickTimerId) {
      clearInterval(this.state.activeTickTimerId);
      this.state.activeTickTimerId = undefined;
    }
  }
  
  /**
   * Enter Study Mode: Fast-forward time with accumulated vitals decay
   * Capped at 7 days (10,080 ticks) per session to limit ledger growth
   * 
   * Usage: Player selects "Study for N hours" - batches ticks with decay
   * 
   * @param hoursToStudy - Hours to study (0-168 = 7 days)
   * @returns true if study mode entered, false if cap exceeded
   */
  async enterStudyMode(hoursToStudy: number): Promise<boolean> {
    if (!this.config.enableStudyMode) {
      console.warn('[EngineOrchestrator] Study Mode disabled');
      return false;
    }
    
    if (this.state.currentMode === 'study-mode') {
      console.warn('[EngineOrchestrator] Already in Study Mode');
      return false;
    }
    
    // Convert hours to ticks (1.5s per tick = 2400 ticks per hour)
    const ticksToExecute = hoursToStudy * 2400;
    const maxTicks = this.config.studyModeTickCap!;
    
    if (ticksToExecute > maxTicks) {
      console.warn(`[EngineOrchestrator] Study duration ${hoursToStudy}h exceeds cap of ${maxTicks / 2400}h`);
      return false;
    }
    
    console.log(`[EngineOrchestrator] Entering Study Mode for ${hoursToStudy}h (${ticksToExecute} ticks)`);
    
    this.state.currentMode = 'study-mode';
    this.state.studyModeStartTick = this.state.currentTick;
    this.state.studyModeTicksRemaining = ticksToExecute;
    
    // Execute batch ticks with accumulated decay
    const mutations: any[] = [];
    const ticksPerUpdate = 100; // Emit progress updates every 100 ticks
    
    while (this.state.studyModeTicksRemaining! > 0) {
      // Execute one tick
      const result = await this.step();
      if (result?.mutations) {
        mutations.push(...result.mutations);
      }
      
      this.state.studyModeTicksRemaining!--;
      
      // Emit progress to UI every N ticks
      if (this.state.studyModeTicksRemaining! % ticksPerUpdate === 0) {
        this.eventBus.emit(
          createWorldUpdateEvent({
            tick: this.state.currentTick,
            epochNumber: this.state.currentEpoch,
            stateHash: await this.persistenceManager.calculateStateHash(
              Array.from(this.vessels.values()),
              Array.from(this.factions.values()),
              Array.from(this.territories.values()),
              Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
              this.constants!
            ),
            mutations: [
              createMutation({
                type: 'environment_change',
                tick: this.state.currentTick,
                metadata: { studyModeProgress: `${100 - Math.floor((this.state.studyModeTicksRemaining! / ticksToExecute) * 100)}%` },
              }),
            ],
            uiEvents: [
              {
                type: 'notification',
                message: `Study Mode: ${100 - Math.floor((this.state.studyModeTicksRemaining! / ticksToExecute) * 100)}% complete`,
              },
            ],
          })
        );
      }
    }
    
    console.log(`[EngineOrchestrator] Study Mode complete. Executed ${ticksToExecute} ticks.`);
    this.state.currentMode = 'idle';
    this.state.studyModeStartTick = undefined;
    this.state.studyModeTicksRemaining = undefined;
    
    return true;
  }
  
  /**
   * Check if world should transition to next epoch
   * Triggers when:
   * - Faction dominance > 60% of territories
   * - Player vessel reaches L99 with 0 paradox debt
   */
  private shouldTransitionToNextEpoch(): boolean {
    if (!this.config.enableEpochTransitions) {
      return false;
    }
    
    // Check faction dominance
    if (this.factions.size > 0) {
      const totalTerritories = this.territories.size;
      for (const faction of this.factions.values()) {
        const dominancePercentage = (faction.territory.owned / totalTerritories) * 100;
        if (dominancePercentage > 60) {
          console.log(`[EngineOrchestrator] Epoch trigger: Faction ${faction.id} achieved >60% dominance`);
          return true;
        }
      }
    }
    
    // Check player ascension (L99 + 0 paradox)
    if (this.playerVesselId) {
      const playerVessel = this.vessels.get(this.playerVesselId);
      if (playerVessel && playerVessel.level === 99) {
        if (this.paradoxTracker && this.paradoxTracker.currentDebt === 0) {
          console.log(`[EngineOrchestrator] Epoch trigger: Player reached L99 with 0 paradox`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Initiate epoch transition
   * Starts the 2000-year era fracture sequence
   */
  private async initiateEpochTransition(): Promise<void> {
    console.log(`[EngineOrchestrator] Initiating epoch transition...`);
    this.state.currentMode = 'epoch-transition';
    this.state.epochTransitionInProgress = true;
    this.state.epochTransitionStartTick = this.state.currentTick;
    
    // Emit transition warning to UI
    this.eventBus.emit(
      createWorldUpdateEvent({
        tick: this.state.currentTick,
        epochNumber: this.state.currentEpoch,
        stateHash: await this.persistenceManager.calculateStateHash(
          Array.from(this.vessels.values()),
          Array.from(this.factions.values()),
          Array.from(this.territories.values()),
          Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
          this.constants!
        ),
        uiEvents: [
          {
            type: 'alert',
            message: 'Era Fracture beginning...',
          },
        ],
      })
    );
  }
  
  /**
   * Pause simulation (stops auto-ticker, freezes state)
   */
  pause(): void {
    if (this.state.currentMode === 'paused') {
      return;
    }
    
    const previousMode = this.state.currentMode;
    this.state.currentMode = 'paused';
    
    if (this.state.activeTickTimerId) {
      clearInterval(this.state.activeTickTimerId);
      this.state.activeTickTimerId = undefined;
    }
    
    console.log(`[EngineOrchestrator] Paused (was in ${previousMode} mode)`);
  }
  
  /**
   * Resume from pause (returns to previous mode)
   */
  resume(mode: SimulationMode = 'idle'): void {
    if (this.state.currentMode !== 'paused') {
      console.warn('[EngineOrchestrator] Not paused');
      return;
    }
    
    this.state.currentMode = mode;
    if (mode === 'active') {
      this.switchToActiveMode();
    }
    
    console.log(`[EngineOrchestrator] Resumed in ${mode} mode`);
  }
  
  /**
   * Emit a world update event through EventBus
   */
  private async emitWorldUpdate(mutations: any[]): Promise<void> {
    try {
      const stateHash = await this.persistenceManager.calculateStateHash(
        Array.from(this.vessels.values()),
        Array.from(this.factions.values()),
        Array.from(this.territories.values()),
        Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
        this.constants!
      );
      
      // Build causal lock info for display
      const causalLocks = this.playerSoulId
        ? [
            createCausalLockInfo({
              soulId: this.playerSoulId,
              remainingTicks: Math.max(0, (this.reincarnationEngine as any).getRemainingLockTime?.(this.playerSoulId) || 0),
              lockExpiresTick: this.state.currentTick + Math.max(0, (this.reincarnationEngine as any).getRemainingLockTime?.(this.playerSoulId) || 0),
              reason: 'rebirth_cooldown',
            }),
          ]
        : [];
      
      const event = createWorldUpdateEvent({
        tick: this.state.currentTick,
        epochNumber: this.state.currentEpoch,
        stateHash,
        mutations: mutations.map(m =>
          createMutation({
            type: m.type || 'environment_change',
            actorId: m.actorId,
            targetId: m.targetId,
            metadata: m.metadata,
            tick: this.state.currentTick,
          })
        ),
        playerVesselId: this.playerVesselId,
        playerSoulId: this.playerSoulId,
        causalLocks,
      });
      
      this.eventBus.emit(event);
    } catch (error) {
      console.warn('[EngineOrchestrator] Failed to emit world update:', error);
    }
  }
  
  /**
   * Getters for state inspection
   */
  getState(): Readonly<EngineState> {
    return Object.freeze({ ...this.state });
  }
  
  getEventBus(): EventBus {
    return this.eventBus;
  }
  
  getPhase5Manager(): Phase5Manager {
    return this.phase5Manager;
  }
  
  getPersistenceManager(): PersistenceManager {
    return this.persistenceManager;
  }
  
  getReincarnationEngine(): ReincarnationEngine {
    return this.reincarnationEngine;
  }
  
  getWorldState(): any {
    return this.worldState;
  }
  
  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[EngineOrchestrator] Shutting down...');
    
    this.pause();
    
    // Save final snapshot
    if (this.config.enablePersistence) {
      await this.persistenceManager.createWorldSnapshot(
        Array.from(this.vessels.values()),
        Array.from(this.factions.values()),
        Array.from(this.territories.values()),
        Array.from(this.deities.values()) as (Deity & { influence: DivineAlignment })[],
        this.constants as GlobalConstants,
        this.state.currentTick,
        this.state.currentEpoch,
        100,
        { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
      );
    }
    
    console.log('[EngineOrchestrator] Shutdown complete');
  }
}
