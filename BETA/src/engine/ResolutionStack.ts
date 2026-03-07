/**
 * Resolution Stack Engine (Phase 2 Core)
 * 
 * Implements the 6-Phase tick resolution system that processes all game state changes
 * in a precise, physics-first order. This ensures causality, prevents race conditions,
 * and maintains deterministic simulation.
 * 
 * The 6-Phase Stack (1.5s per tick):
 * 1. Input Decay: Validate player intent, apply Causal Locks, discard rollbacks
 * 2. World AI Drift: NPC/Faction actions, schedule movement (includes Divine & Faction AI)
 * 3. Conflict Resolution: Combat rolls, skill checks, outcome determination
 * 4. Commit & RNG: Finalize state changes, apply RNG, lock results
 * 5. Ripple & Paradox: Update faction reputation, Territory stability & taxes (includes Geography)
 * 6. Info Synthesis: Apply information lag filters, generate UI state
 */

import type {
  Vessel,
  CoreAttributes,
  ParadoxTracker,
  CausalLock,
  ConservationCheck,
  ParadoxDebtState,
  TerritoryNode,
  ActiveFaction,
  Deity,
  FactionRelationship,
} from '../types';
import {
  performConservationCheck,
  isCausallyLocked,
  validateAttributes,
} from '../types';
import GeographyManager from './GeographyManager';
import DivineManager from './DivineManager';
import { PersistenceManager } from './PersistenceManager';
import IntentSynthesizer from './IntentSynthesizer';

/**
 * Player Action Intent
 * Represents user input before validation
 * 
 * Stage 8.98a: Expanded model to support D&D-style freedom
 * - cardVased Intent: Clicked from ActionTray (preset abilities)
 * - Custom Intent: Free-text prompt (e.g., "Swing from chandelier")
 */
export interface PlayerIntent {
  actorId: string;
  actionType: 'move' | 'attack' | 'skill' | 'interact' | 'study' | 'craft' | 'custom';
  targetId?: string;
  payload?: Record<string, any>;
  submittedAtTick: number;
  
  // Stage 8.98a: D&D Freedom Fields
  /** Raw player-submitted prompt (e.g., "tackle the guard") */
  customPrompt?: string;
  
  /** Narrative weight 0.0-1.0 (guides AI DM difficulty scaling) */
  narrativeWeight: number;
  
  /** True if free-text, false if card-based */
  isCustom: boolean;
}

/**
 * Validated Action
 * Represents an action that passed Phase 1 validation
 */
export interface ValidatedAction extends PlayerIntent {
  isValid: boolean;
  invalidReason?: string;
  phase1CausallyLocked: boolean;
  phase0InputDiscarded: boolean;
  
  // Stage 8.98a: Synthesis metadata
  /** Mapped effect type after IntentSynthesizer processes customPrompt */
  synthesizedEffectType?: 'damage' | 'heal' | 'status_effect' | 'skill_check' | 'interaction' | 'movement' | 'unknown';
  
  /** Difficulty Class for this intent (may be modified from base) */
  adjustedDC?: number;
}

/**
 * Intent Queue Buffer
 * Handles burst intent submissions ("Paradox Flood")
 * 
 * Stage 8.98a: Concurrency control for 50+ intents per tick
 */
export interface IntentQueue {
  /** Current queue state */
  queue: PlayerIntent[];
  maxQueueSize: number;
  
  /** Stats for monitoring */
  totalProcessed: number;
  totalDropped: number;
  averageProcessTimeMs: number;
  
  /** Last buffering event */
  lastBufferTick: number;
  lastFlushedTickNum: number;
}

/**
 * Conflict Event (Combat & Custom Actions)
 * Outcome of Phase 3 resolution
 */
export interface ConflictEvent {
  id: string;
  attacker: Vessel;
  defender: Vessel;
  d20Roll: number;
  baseAttackBonus: number;
  defenderAC: number;
  isCritical: boolean;
  isHit: boolean;
  damageRoll: number;
  totalDamage: number;
  happenedAtTick: number;
  
  // Stage 8.99b & 8.99d: Custom Action Fields
  isCustomAction?: boolean;          // Whether this is a custom intent resolution
  customActionStat?: keyof CoreAttributes;  // The primary stat used (AGI, STR, etc.)
  customActionDC?: number;           // The DC for the custom check
  customPrompt?: string;             // The original player prompt
  statModifier?: number;             // Derived from stat
  isCriticalSuccess?: boolean;       // Natural 20 on custom action
  isCriticalFailure?: boolean;       // Natural 1 adds paradox penalty
  totalRoll?: number;                // d20 + stat modifiers
}

/**
 * Phase Result: Output of each phase
 */
export interface PhaseResult {
  phaseNumber: 1 | 2 | 3 | 4 | 5 | 6;
  tickNumber: number;
  success: boolean;
  message?: string;
  mutations?: any;
  invalidReason?: string;
}

/**
 * Tick Context: Complete state during one tick resolution
 */
export interface TickContext {
  currentTick: number;
  worldState: any; // Reference to world state
  actor: Vessel;
  paradoxTracker: ParadoxTracker;
  causalLocks: Map<string, CausalLock>;
  playerIntent?: PlayerIntent;
  validatedAction?: ValidatedAction;
  conflictEvent?: ConflictEvent;
  conservationCheck?: ConservationCheck;
  phaseResults: PhaseResult[];
  informationLagMultiplier: number;
}

/**
 * Resolution Stack: Processes a single 1.5s tick through all 6 phases
 * 
 * Stage 8.98a: Now supports queued intent processing (paradox flood handling)
 */
export class ResolutionStack {
  private causalLocks: Map<string, CausalLock>;
  private rng: { next(): number };
  private geographyManager: GeographyManager;
  private divineManager: DivineManager;
  private persistenceManager?: PersistenceManager;
  private intentQueue: IntentQueue;

  constructor(rng?: { next(): number }, persistenceManager?: PersistenceManager) {
    this.causalLocks = new Map();
    this.rng = rng || { next: () => Math.random() };
    this.geographyManager = new GeographyManager();
    this.divineManager = new DivineManager();
    this.persistenceManager = persistenceManager;
    this.intentQueue = {
      queue: [],
      maxQueueSize: 100,
      totalProcessed: 0,
      totalDropped: 0,
      averageProcessTimeMs: 0,
      lastBufferTick: 0,
      lastFlushedTickNum: 0,
    };
  }

  /**
   * Set persistence manager for Phase 6 integration
   */
  setPersistenceManager(manager: PersistenceManager): void {
    this.persistenceManager = manager;
  }

  /**
   * Stage 8.98a: Submit intent(s) to the queue
   * 
   * Handles burst submissions (Paradox Flood) by buffering up to maxQueueSize intents.
   * Returns success/drop status for each submitted intent.
   */
  submitIntent(intent: PlayerIntent | PlayerIntent[]): { accepted: number; dropped: number } {
    const intents = Array.isArray(intent) ? intent : [intent];
    let accepted = 0;
    let dropped = 0;
    let lastSubmittedTick = 0;

    for (const single of intents) {
      // Normalize intent defaults
      if (single.narrativeWeight === undefined) {
        single.narrativeWeight = 1.0;
      }
      if (single.isCustom === undefined) {
        single.isCustom = false;
      }

      if (this.intentQueue.queue.length < this.intentQueue.maxQueueSize) {
        this.intentQueue.queue.push(single);
        accepted++;
      } else {
        // Queue full, drop intent
        dropped++;
        this.intentQueue.totalDropped++;
      }
      lastSubmittedTick = single.submittedAtTick;
    }

    this.intentQueue.lastBufferTick = lastSubmittedTick;
    return { accepted, dropped };
  }

  /**
   * Stage 8.98a: Process queued intents
   * 
   * Called by Phase 1 to drain the queue in deterministic order.
   * Returns processed intents in submission order.
   */
  flushIntentQueue(tickNum: number): PlayerIntent[] {
    const batch = [...this.intentQueue.queue];
    this.intentQueue.queue = [];
    this.intentQueue.totalProcessed += batch.length;
    this.intentQueue.lastFlushedTickNum = tickNum;
    return batch;
  }

  /**
   * Stage 8.98a: Get queue stats for monitoring
   */
  getQueueStats(): {
    queueSize: number;
    totalProcessed: number;
    totalDropped: number;
    maxQueueSize: number;
  } {
    return {
      queueSize: this.intentQueue.queue.length,
      totalProcessed: this.intentQueue.totalProcessed,
      totalDropped: this.intentQueue.totalDropped,
      maxQueueSize: this.intentQueue.maxQueueSize,
    };
  }

  /**
   * Process one complete tick through all 6 phases
   */
  async processTick(context: TickContext): Promise<TickContext> {
    context.phaseResults = [];

    // Execute phases in strict order
    await this.phase1_InputDecay(context);
    await this.phase2_WorldAIDrift(context);
    await this.phase3_ConflictResolution(context);
    await this.phase4_CommitAndRNG(context);
    await this.phase5_RippleParadox(context);
    await this.phase6_InfoSynthesis(context);

    return context;
  }

  /**
   * Phase 1: Input Decay
   * Validates player intent and applies Causal Lock checks
   * 
   * Input:  PlayerIntent (or undefined if no action this tick)
   * Output: ValidatedAction (ready for Phase 3) or rejected
   * 
   * Rules Applied:
   * - DSS 02.2.1: Causal Lock (prevent action if actor is locked)
   * - DSS 07.1.1: Phase 0 Input Discard (max 3 rollbacks per tick)
   */
  private async phase1_InputDecay(context: TickContext): Promise<void> {
    const phaseNum = 1;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
    };

    if (!context.playerIntent) {
      // No action this tick, skip validation
      result.message = 'No player intent';
      context.phaseResults.push(result);
      return;
    }

    const intent = context.playerIntent;

    // Check if actor is causally locked (DSS 02.2.1)
    if (isCausallyLocked(context.actor, Array.from(context.causalLocks.values()), context.currentTick)) {
      result.success = false;
      result.invalidReason = 'Actor is under Causal Lock (Conservation Check in progress)';
      result.message = `Action rejected: Causal Lock active on ${intent.actorId}`;
      context.phaseResults.push(result);
      return;
    }

    // Check Phase 0 Input Discard (DSS 07.1.1)
    if (context.paradoxTracker.phase0Security.phase0InputDiscarded) {
      result.success = false;
      result.invalidReason = 'Phase 0 input was discarded due to deterministic loop detection';
      result.message = 'Action rejected: Must submit NEW action (not replay)';
      context.paradoxTracker.phase0Security.phase0InputDiscarded = false; // Reset flag
      context.phaseResults.push(result);
      return;
    }

    // Validation passed
    const validatedAction: ValidatedAction = {
      ...intent,
      isValid: true,
      phase1CausallyLocked: false,
      phase0InputDiscarded: false,
      // Stage 8.98a: Preserve new fields
      customPrompt: intent.customPrompt,
      narrativeWeight: intent.narrativeWeight,
      isCustom: intent.isCustom,
      synthesizedEffectType: 'unknown', // Will be set by IntentSynthesizer in Phase 1 (Stage 8.99a)
    };

    // Stage 8.99a: Synthesize custom intents through IntentSynthesizer
    if (intent.isCustom && intent.customPrompt) {
      try {
        const synthesis = IntentSynthesizer.synthesize(intent.customPrompt, intent.narrativeWeight);
        
        validatedAction.synthesizedEffectType = synthesis.effectType;
        validatedAction.adjustedDC = synthesis.suggestedDC;
        
        // Store synthesis metadata in payload for Phase 3 resolution
        if (!validatedAction.payload) validatedAction.payload = {};
        validatedAction.payload.synthesizedStat = synthesis.primaryStat;
        validatedAction.payload.narrativeComplexity = synthesis.narrativeComplexity;
        validatedAction.payload.isGenericSkillCheck = synthesis.isGenericSkillCheck;
        validatedAction.payload.matchedVerb = synthesis.matchedVerb;
        validatedAction.payload.suggestedAbilityId = synthesis.suggestedAbilityId;
        
        result.message = `Custom intent synthesized: "${intent.customPrompt}" -> ${synthesis.effectType} (${synthesis.primaryStat}, DC ${synthesis.suggestedDC})`;
      } catch (error) {
        console.warn(`[ResolutionStack] Synthesis error for prompt "${intent.customPrompt}":`, error);
        result.message = `Action validated but synthesis failed: ${intent.actionType}`;
      }
    } else {
      result.message = `Action validated: ${intent.actionType} (weight: ${intent.narrativeWeight}, custom: ${intent.isCustom})`;
    }

    context.validatedAction = validatedAction;
    context.phaseResults.push(result);
  }

  /**
   * Phase 2: World AI Drift
   * NPCs and Factions take actions, Divine entities update faith dynamics
   * 
   * Rules Applied:
   * - DSS 04: NPC autonomy and faction decision-making
   * - DSS 06: Divine faith generation, covenant maintenance, miracles
   * - DSS 16: Matriarchal genesis faction updates
   */
  private async phase2_WorldAIDrift(context: TickContext): Promise<void> {
    const phaseNum = 2;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
      message: 'World AI drift processed',
    };

    // TODO: Process divine faith dynamics and miracles via divineManager
    // TODO: Integrate with FactionAIManager for faction decisions
    // TODO: Query all NPCs in proximity and execute their AI decision trees
    // TODO: Generate NPC actions (move/attack/interact)
    // TODO: Determine if world event triggers (ambush, trade opportunity, etc.)

    context.phaseResults.push(result);
  }

  /**
   * Phase 3: Conflict Resolution
   * Resolve combat, skill checks, and other d20/d10 rolls
   * 
   * Rules Applied:
   * - DSS 01: Attribute-based skill checks
   * - DSS 02.2: Injury generation on failure
   * - DSS 03: Paradox bias application (from Phase 5 of previous tick)
   * - DSS 08: Dice Altar resolution
   * - Stage 8.99b: Custom intent d20 resolution with luck modifier
   */
  private async phase3_ConflictResolution(context: TickContext): Promise<void> {
    const phaseNum = 3;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
    };

    if (!context.validatedAction) {
      result.message = 'No action this phase';
      context.phaseResults.push(result);
      return;
    }

    // Stage 8.99b: Handle custom intent resolution
    if (context.validatedAction.isCustom && context.validatedAction.payload?.synthesizedStat) {
      const primaryStat = context.validatedAction.payload.synthesizedStat as keyof CoreAttributes;
      const adjustedDC = context.validatedAction.adjustedDC ?? 12; // Default DC 12
      const customPrompt = context.validatedAction.customPrompt ?? 'Unknown action';

      // Roll d20 (deterministic PRNG)
      const d20 = Math.floor(this.rng.next() * 20) + 1;
      const isCriticalSuccess = d20 === 20;
      const isCriticalFailure = d20 === 1;

      // Calculate attribute modifier
      const primaryStatValue = context.actor.attributes[primaryStat] ?? 10;
      const statModifier = Math.floor((primaryStatValue - 10) / 2);

      // Total roll = d20 + stat modifier (no luck modifier in 8-stat system)
      const totalRoll = d20 + statModifier;

      // Determine success
      const isSuccess = isCriticalSuccess || (totalRoll >= adjustedDC && !isCriticalFailure);

      // Stage 8.99d: Apply critical paradox penalty on natural 1 (reduced by Perception)
      if (isCriticalFailure) {
        const perceptionValue = context.actor.attributes.PER ?? 10;
        const perceptionModifier = Math.floor((perceptionValue - 10) / 2);
        // Natural 1 penalty scales inversely with perception (high PER = lower paradox penalty, representing foresight)
        const paradoxPenalty = Math.max(1, 5 - (perceptionModifier / 2)); // At least 1, reduced by PER
        const currentDebt = context.paradoxTracker?.currentDebt ?? 0;
        context.paradoxTracker.currentDebt = currentDebt + paradoxPenalty;
      }

      const conflict: ConflictEvent = {
        id: `conflict-custom-${context.currentTick}`,
        attacker: context.actor,
        defender: { id: 'system' } as any,
        d20Roll: d20,
        baseAttackBonus: statModifier,
        defenderAC: adjustedDC,
        isCritical: isCriticalSuccess || isCriticalFailure,
        isCriticalSuccess,
        isCriticalFailure,
        isHit: isSuccess,
        damageRoll: 0, // Custom actions don't deal damage
        totalDamage: 0,
        happenedAtTick: context.currentTick,
        
        // Custom action fields
        isCustomAction: true,
        customActionStat: primaryStat,
        customActionDC: adjustedDC,
        customPrompt,
        statModifier,
        totalRoll,
      };

      context.conflictEvent = conflict;
      
      const rollDetails = `[${d20}] + ${primaryStat.toLowerCase()} ${statModifier >= 0 ? '+' : ''}${statModifier} = ${totalRoll}`;
      const outcome = isSuccess ? 'SUCCESS' : 'FAILURE';
      
      if (isCriticalSuccess) {
        result.message = `⭐ CRITICAL SUCCESS on "${customPrompt}" ${rollDetails} vs DC ${adjustedDC}!`;
      } else if (isCriticalFailure) {
        const perceptionValue = context.actor.attributes.PER ?? 10;
        const perceptionModifier = Math.floor((perceptionValue - 10) / 2);
        const paradoxPenalty = Math.max(1, 5 - (perceptionModifier / 2));
        result.message = `💥 CRITICAL FAILURE on "${customPrompt}" ${rollDetails} vs DC ${adjustedDC}! (+${paradoxPenalty} paradox debt)`;
      } else {
        result.message = `Custom action "${customPrompt}" ${outcome}: ${rollDetails} vs DC ${adjustedDC}`;
      }

      context.phaseResults.push(result);
      return;
    }

    // Standard attack resolution (legacy)
    if (context.validatedAction.actionType !== 'attack') {
      result.message = 'No conflict this phase';
      context.phaseResults.push(result);
      return;
    }

    // Resolve attack using Dice Altar
    // NOTE: Paradox bias should already be applied via context.actor attributes
    // (modified in Phase 5 of previous tick)

    const attackBonus = Math.floor((context.actor.attributes.DEX - 10) / 2);
    const d20 = Math.floor(this.rng.next() * 20) + 1; // Simulated d20
    const totalAttack = d20 + attackBonus;
    const isCrit = d20 === 20;

    // Mock defender AC
    const defenderAC = 12;
    const isHit = totalAttack >= defenderAC || isCrit;

    const damage = isHit ? Math.floor(this.rng.next() * 8) + 1 : 0; // d8 damage

    const conflict: ConflictEvent = {
      id: `conflict-attack-${context.currentTick}`,
      attacker: context.actor,
      defender: { id: 'mock-defender' } as any,
      d20Roll: d20,
      baseAttackBonus: attackBonus,
      defenderAC,
      isCritical: isCrit,
      isHit,
      damageRoll: damage,
      totalDamage: damage + (isCrit ? 8 : 0), // Double damage on crit
      happenedAtTick: context.currentTick,
    };

    context.conflictEvent = conflict;
    result.message = `Attack resolved: ${conflict.isHit ? 'HIT' : 'MISS'} (Roll: ${d20})`;
    context.phaseResults.push(result);
  }

  /**
   * Phase 4: Commit & RNG
   * Apply all state changes from Phase 3, finalize RNG results
   * 
   * This phase is atomic and locked. No further input validation occurs after Phase 4.
   * 
   * Rules Applied:
   * - Vitals deduction (damage -> HP -> Vigor)
   * - Injury generation
   * - Conservation Check trigger (if HP = 0)
   * - Causal Lock application (if Conservation Check triggered)
   */
  private async phase4_CommitAndRNG(context: TickContext): Promise<void> {
    const phaseNum = 4;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
    };

    if (!context.conflictEvent) {
      result.message = 'No conflict outcome to commit';
      context.phaseResults.push(result);
      return;
    }

    const { attacker, totalDamage } = context.conflictEvent;

    // Apply damage to HP
    attacker.healthPoints -= totalDamage;

    // Check if HP dropped to 0 (trigger Conservation Check)
    if (attacker.healthPoints <= 0) {
      const conservationCheck = performConservationCheck(
        attacker,
        10,
        context.currentTick
      );
      context.conservationCheck = conservationCheck;

      // Apply Causal Lock if check fails (vessel will be destroyed)
      if (!conservationCheck.success) {
        const lock: CausalLock = {
          actorId: attacker.id,
          startedAtTick: context.currentTick,
          durationTicks: 1, // Locks for remainder of this 1.5s tick
          reason: 'conservation_check',
        };
        this.causalLocks.set(attacker.id, lock);
        result.message = `Conservation Check FAILED. Causal Lock applied. Vessel destroyed.`;
      } else {
        // Success: fragile state
        attacker.healthPoints = 1;
        attacker.vesselTier = 'fragile';
        result.message = `Conservation Check SUCCESS. Entered Fragile State (1 HP).`;
      }
    }

    context.phaseResults.push(result);
  }

  /**
   * Phase 5: Ripple & Paradox
   * Update faction reputation, territory stability & taxes, and accumulate paradox debt
   * 
   * Rules Applied:
   * - DSS 05: Territory stability updates, tax collection, information lag calculations
   * - DSS 04: Faction reputation changes from conflicts
   * - DSS 03: Paradox debt accumulation
   * - Paradox bias is calculated here and will affect Phase 3 of NEXT tick
   */
  private async phase5_RippleParadox(
    context: TickContext,
    territories?: Map<string, TerritoryNode>,
    factions?: Map<string, ActiveFaction>,
    relationships?: Map<string, FactionRelationship>,
    worldStability?: number
  ): Promise<void> {
    const phaseNum = 5;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
    };

    // FIRST: Update territory stability, collect taxes, calculate information lag
    if (territories !== undefined && factions !== undefined && worldStability !== undefined) {
      try {
        const geographyResult = await this.geographyManager.processGeographyPhase(
          territories,
          factions,
          worldStability,
          context.currentTick
        );
        result.mutations = { ...result.mutations, geographyPhase: geographyResult };
        result.message = `Territory updates: ${geographyResult.territoryUpdates.length} territories processed`;
      } catch (err) {
        result.success = false;
        result.message = `Geography phase error: ${String(err)}`;
      }
    }

    if (!context.conflictEvent) {
      result.message = (result.message || 'No ripple effects')  + ' - no conflict this tick';
      context.phaseResults.push(result);
      return;
    }

    // TODO: Apply faction reputation changes based on conflict outcome
    // TODO: Calculate Paradox debt changes based on action type and outcome
    // TODO: Transition paradox state if debt thresholds crossed (BLEACH -> REALITY_FAULT)
    
    // NOTE: Paradox bias will be applied in Phase 3 of NEXT tick

    context.phaseResults.push(result);
  }

  /**
   * Phase 6: Info Synthesis
   * Apply information lag filters and generate perceived state
   * Hook for Phase 5 Persistence Manager: Record StateHash and mutations
   * 
   * Rules Applied:
   * - PER/WIS-based perception checks
   * - Vague vs exact value reporting
   * - Information about injuries/vitals is obscured based on perception
   * - Phase 5: StateHash calculation for tamper detection
   * - Phase 5: Partial mutation recording to ledger
   * 
   * This phase DOES NOT change game state; it only prepares data for UI/player observation.
   * Exception: Phase 5 managers record immutable state snapshots (non-breaking)
   */
  private async phase6_InfoSynthesis(context: TickContext): Promise<void> {
    const phaseNum = 6;
    let result: PhaseResult = {
      phaseNumber: phaseNum,
      tickNumber: context.currentTick,
      success: true,
    };

    // Calculate information lag multiplier based on WIS/PER
    // Low stats = high lag = more vague information
    const wisPercent = context.actor.attributes.WIS / 20; // Normalize 0-1
    const perPercent = context.actor.attributes.PER / 20;
    const perceptionAverage = (wisPercent + perPercent) / 2;

    context.informationLagMultiplier = Math.max(0, 1 - perceptionAverage);

    // TODO: Generate perceived state for UI
    // Examples:
    // - If lag > 0.5: "You feel weakened" instead of "Vigor: 25%"
    // - If lag > 0.7: Injuries not reported until "Self Examination" action
    // - If lag > 0.9: Cannot see exact HP, only "Badly Wounded" descriptors

    // === Phase 5 Integration: Record state persistence ===
    if (this.persistenceManager && context.worldState) {
      try {
        // Extract world state components from context
        const vessels = context.worldState.vessels || [];
        const factions = context.worldState.factions || [];
        const territories = context.worldState.territories || [];
        const deities = context.worldState.deities || [];
        const constants = context.worldState.constants || {};

        // Calculate StateHash for this tick's resolution
        if (vessels.length > 0) {
          const stateHash = this.persistenceManager.calculateStateHash(
            vessels,
            factions,
            territories,
            deities,
            constants
          );

          // Record as mutation metadata for later verification
          result.mutations = result.mutations || {};
          (result.mutations as any).stateHash = stateHash.hash;
          (result.mutations as any).componentHashes = stateHash.componentHashes;
        }

        // Record partial mutation if phase advanced meaningfully
        const hasConflictOrEffect = context.conflictEvent || context.conservationCheck;
        if (hasConflictOrEffect) {
          this.persistenceManager.recordPartialMutation(
            context.currentTick,
            `phase6:${context.actor.id}:${context.currentTick}` as any,
            vessels.map(v => ({ id: v.id, data: v })),
            factions.map(f => ({ id: f.id, data: f })),
            territories.map(t => ({ id: t.id, data: t }))
          );
        }
      } catch (err) {
        // Non-fatal: Persistence is advisory
        console.warn(`[ResolutionStack] Phase 6 persistence error:`, err);
      }
    }

    result.message = `Information lag: ${(context.informationLagMultiplier * 100).toFixed(1)}%`;
    context.phaseResults.push(result);
  }

  /**
   * Clean up expired Causal Locks
   */
  expireOldLocks(currentTick: number): void {
    for (const [actorId, lock] of this.causalLocks.entries()) {
      if (currentTick >= lock.startedAtTick + lock.durationTicks) {
        this.causalLocks.delete(actorId);
      }
    }
  }

  /**
   * Get current Causal Lock status for an actor
   */
  getActorLock(actorId: string): CausalLock | undefined {
    return this.causalLocks.get(actorId);
  }

  /**
   * Create lock for an actor (used by Phase 4)
   */
  createLock(lock: CausalLock): void {
    this.causalLocks.set(lock.actorId, lock);
  }

  /**
   * Validation: Ensure PhaseResults are in order
   */
  validatePhaseOrder(results: PhaseResult[]): boolean {
    const expectedOrder = [1, 2, 3, 4, 5, 6];
    if (results.length !== expectedOrder.length) {
      return false;
    }
    return results.every((r, i) => r.phaseNumber === expectedOrder[i]);
  }
}

/**
 * Create a new Resolution Stack with optional RNG
 */
export function createResolutionStack(rng?: { next(): number }): ResolutionStack {
  return new ResolutionStack(rng);
}
