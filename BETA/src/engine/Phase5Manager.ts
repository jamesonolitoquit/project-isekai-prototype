/**
 * Phase 5 Manager: Orchestration Layer
 *
 * Coordinates PersistenceManager, ReincarnationEngine, and WorldEngine simulation
 * for long-term continuity, reincarnation cycles, and world state management.
 *
 * This is the integration point between Phase 5 managers and the existing WorldEngine.
 */

import { PersistenceManager } from './PersistenceManager';
import { ReincarnationEngine } from './ReincarnationEngine';
import type { Vessel, ActiveFaction, TerritoryNode, Deity, DivineAlignment, GlobalConstants } from '../types';
import { ResolutionStack, TickContext, type PlayerIntent } from './ResolutionStack';
import { FrictionManager } from './FrictionManager';

/**
 * Phase 5 Manager: Orchestrates long-term world continuity
 */
export class Phase5Manager {
  private persistenceManager: PersistenceManager;
  private reincarnationEngine: ReincarnationEngine;
  private resolutionStack: ResolutionStack;
  private currentTick: number = 0;
  private currentEpoch: number = 1;
  private globalConstants: GlobalConstants;

  constructor(globalConstants: GlobalConstants, rng?: { next(): number }) {
    this.globalConstants = globalConstants;
    this.persistenceManager = new PersistenceManager(globalConstants.snapshotIntervalTicks);
    this.reincarnationEngine = new ReincarnationEngine();
    this.resolutionStack = new ResolutionStack(rng);
  }

  /**
   * Initialize world state for Phase 5 simulation
   */
  initializeWorld(
    vessels: Vessel[],
    factions: ActiveFaction[],
    territories: TerritoryNode[],
    deities: (Deity & { influence: DivineAlignment })[],
    constants: GlobalConstants
  ): void {
    this.globalConstants = constants;
    this.currentTick = 0;
    this.currentEpoch = 1;

    // Create initial snapshot
    this.persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      0,
      1,
      1.0,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );
  }

  /**
   * Process a single tick through the full Phase 5 resolution pipeline:
   * 1. ResolutionStack (6-phase)
   * 2. Vitals decay (FrictionManager)
   * 3. Persistence (snapshot/mutation recording)
   * 4. Reincarnation checks (death handling)
   * 
   * Stage 8.98a: playerIntent now strictly typed with narrative weight & custom prompts
   */
  async processTick(
    vessels: Vessel[],
    factions: ActiveFaction[],
    territories: TerritoryNode[],
    deities: (Deity & { influence: DivineAlignment })[],
    playerIntent?: PlayerIntent
  ): Promise<TickContext> {
    // Create context for resolution stack
    const actor = vessels[0] || ({} as Vessel);
    const context: TickContext = {
      currentTick: this.currentTick,
      worldState: { vessels, factions, territories },
      actor,
      paradoxTracker: {
        actorId: 'world-system',
        currentDebt: 0,
        debtCapacity: 100,
        currentState: 'whisper' as any,
        eventHistory: [],
        createdAtTick: this.currentTick,
        activePenalties: [],
        attractedShadows: [],
        lastDecayAtTick: 0,
        totalDecayApplied: 0,
        inRealityFault: false,
        phase0Security: {
          phase0InputDiscarded: false,
          rollbackCount: 0,
          maxRollbacksPerTick: 5,
          lastRollbackAtTick: 0,
          antiExploitFlags: 0,
          requiresAdminReview: false,
        },
      },
      causalLocks: new Map(),
      playerIntent,
      phaseResults: [],
      informationLagMultiplier: 1.0,
    };

    // Execute 6-phase resolution stack
    await this.resolutionStack.processTick(context);

    // Apply vitals decay to all vessels
    for (const vessel of vessels) {
      FrictionManager.applyVitalsDecay(vessel, 1.0, 1.0);
    }

    // Check for conservation failures (HP <= 0)
    for (const vessel of vessels) {
      if (vessel.healthPoints === undefined) vessel.healthPoints = 100;
      if (vessel.healthPoints <= 0) {
        // Handle death via reincarnation engine
        await this.handleVesselDeath(vessel);
      }
    }

    // Record partial mutation if triggered
    if (this.shouldRecordMutation(context)) {
      this.persistenceManager.recordPartialMutation(
        this.currentTick,
        `tick:world:${this.currentTick}` as any,
        vessels.map(v => ({ id: v.id, data: v })),
        factions.map(f => ({ id: f.id, data: f })),
        territories.map(t => ({ id: t.id, data: t }))
      );
    }

    // Create snapshot if interval reached
    if (this.persistenceManager.shouldCreateSnapshot(this.currentTick)) {
      this.persistenceManager.createWorldSnapshot(
        vessels,
        factions,
        territories,
        deities,
        this.globalConstants,
        this.currentTick,
        this.currentEpoch,
        1.0,
        { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
      );
    }

    this.currentTick += 1;
    return context;
  }

  /**
   * Process a vessel's death and trigger reincarnation
   */
  private async handleVesselDeath(vessel: Vessel): Promise<void> {
    // Find or create the player soul
    let soul = this.reincarnationEngine.getSoul(vessel.playerId || 'unknown');
    if (!soul) {
      soul = this.reincarnationEngine.createPlayerSoul(vessel.playerId || 'unknown');
    }

    // Process death (calculate echo points, apply causal lock)
    const deathResult = this.reincarnationEngine.processVesselDeath(
      vessel,
      soul,
      'death' as any,
      this.currentTick,
      [] // achievements
    );

    // Record hard fact in ledger
    this.persistenceManager.recordLedgerEntry(
      `vessel:death:${this.currentTick}` as any,
      'vessel-death',
      vessel.id,
      {
        vesselName: vessel.name,
        level: vessel.level,
        peakLevel: vessel.level,
        echoPointsEarned: deathResult.incarnationRecord.echoPointsEarned,
      },
      `Vessel ${vessel.name} has died at level ${vessel.level}`
    );
  }

  /**
   * Check if a mutation should be recorded (every tick or on significant changes)
   */
  private shouldRecordMutation(_context: TickContext): boolean {
    // Record mutations every 10 ticks to avoid excessive I/O
    return this.currentTick % 10 === 0;
  }

  /**
   * Get persistence manager for snapshot/ledger queries
   */
  getPersistenceManager(): PersistenceManager {
    return this.persistenceManager;
  }

  /**
   * Get reincarnation engine for soul/echo operations
   */
  getReincarnationEngine(): ReincarnationEngine {
    return this.reincarnationEngine;
  }

  /**
   * Get current tick
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Manually advance epoch (triggered by world events)
   */
  advanceEpoch(): void {
    this.currentEpoch += 1;

    this.persistenceManager.recordLedgerEntry(
      `epoch:advance:${this.currentTick}` as any,
      'epoch-transition',
      'system',
      { newEpoch: this.currentEpoch },
      `Epoch transition to ${this.currentEpoch}`
    );
  }
}

/**
 * Integration helper: Hook Phase 5 managers into ResolutionStack Phase 6
 * Called after all 5 phases complete, before info synthesis
 */
export function integratePhase5WithResolutionStack(): void {
  // This function serves as a schema for how to modify ResolutionStack
  // to call Phase 5 managers during Phase 6 (Info Synthesis)

  // In practice, modify ResolutionStack.phase6_InfoSynthesis to:
  // 1. Call persistenceManager.recordPartialMutation()
  // 2. Call persistenceManager.calculateStateHash()
  // 3. Check for epoch transitions and call phase5Manager.advanceEpoch()
  // 4. Return context with persistence metadata

  console.log('[Phase5Manager] Integration points defined for ResolutionStack Phase 6');
}
