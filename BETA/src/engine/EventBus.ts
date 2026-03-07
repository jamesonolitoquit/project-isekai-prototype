/**
 * EventBus Engine (Phase 6 Core - UI Integration Layer)
 * 
 * Provides a centralized Subscriber pattern for UI and external systems to receive
 * world state updates without tight coupling to WorldEngine internals.
 * 
 * Each tick emits a WorldUpdateEvent containing:
 * - StateHash (for integrity verification)
 * - Delta mutations (what changed)
 * - Epoch metadata (current era)
 * - Causal lock status (for player UI)
 * - Subscriber-filtered payloads
 * 
 * Design Pattern: Observer Pattern with TypeScript generics
 */

import { Vessel, ActiveFaction, TerritoryNode, ParadoxTracker } from '../types';
import type { PlayerSoul, VesselIncarnation, AncestralEchoPoint, StateHash } from '../types';

/**
 * Re-export StateHash for consuming modules
 */
export type { StateHash } from '../types';

/**
 * NOTE: StateHash is imported from types/persistence.ts for centralized definition
 * Properties: hash, componentHashes (vesselsHash, factionsHash, etc.), computedAt, isValidated
 */

/**
 * Mutations that occurred during this tick
 */
export interface TickMutation {
  type: 'vessel_update' | 'faction_update' | 'territory_update' | 'deity_action' | 
        'death_event' | 'rebirth_event' | 'epoch_transition' | 'causal_lock' | 
        'paradox_shift' | 'conservation_failure' | 'faction_conflict' | 'environment_change';
  actorId?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  timestamp: number; // Tick
}

/**
 * Causal Lock Info for UI display
 */
export interface CausalLockInfo {
  soulId: string;
  remainingTicks: number;
  lockExpiresTick: number;
  reason: 'rebirth_cooldown' | 'causal_paradox' | 'divine_intervention';
}

/**
 * Ancestral Echo Points displayable info
 */
export interface EchoPointInfo {
  soulId: string;
  totalPoints: number;
  bySkill: Record<string, number>; // skill category -> echo points allocated
  lastUpdatedTick: number;
}

/**
 * Primary world state update event emitted every tick
 * UI subscribers filter this based on their interests
 */
export interface WorldUpdateEvent {
  // Core metadata
  tick: number;
  epochNumber: number;
  timestamp: number; // Unix milliseconds
  
  // State verification
  stateHash: StateHash;
  
  // Changes this tick
  mutations: TickMutation[];
  
  // Player-specific info
  playerVesselId?: string;
  playerSoulId?: string;
  causalLocks: CausalLockInfo[];
  echoPoints: EchoPointInfo[];
  
  // World state snapshots (for full sync on subscription or lag recovery)
  // These are usually omitted; included only on special events
  fullWorldSnapshot?: {
    vessels: Map<string, Vessel>;
    factions: Map<string, ActiveFaction>;
    territories: Map<string, TerritoryNode>;
    paradoxTracker: ParadoxTracker;
  };
  
  // Epoch transition event (emitted only when era changes)
  epochTransition?: {
    oldEpoch: number;
    newEpoch: number;
    triggeredBy: 'faction_dominance' | 'player_ascension' | 'chronos_cycle';
    factionShifts: Array<{ factionId: string; powerDelta: number }>;
  };
  
  // UI state changes (non-game-data changes)
  uiEvents?: Array<{
    type: 'game_paused' | 'game_resumed' | 'study_mode_entered' | 'study_mode_exited' |
          'alert' | 'warning' | 'notification';
    message: string;
  }>;
}

/**
 * Subscriber function type - receives world updates
 */
type WorldUpdateSubscriber = (event: WorldUpdateEvent) => void;

/**
 * Subscription metadata for tracking and filtering
 */
interface Subscription {
  id: string;
  subscriber: WorldUpdateSubscriber;
  filter?: {
    mutationTypes?: TickMutation['type'][];
    playerOnly?: boolean; // Only events involving player's vessel/soul
    includingSnapshots?: boolean; // Request full snapshots (heavy, use sparingly)
  };
  createdAt: number;
}

/**
 * EventBus: Centralized event aggregation and distribution
 * 
 * Single instance created at WorldEngine initialization.
 * All tick results flow through EventBus before UI consumption.
 * 
 * Usage:
 *   const eventBus = new EventBus();
 *   eventBus.subscribe(myUIComponent.onWorldUpdate, { 
 *     filter: { playerOnly: true } 
 *   });
 *   // Later, after tick resolution:
 *   eventBus.emit(worldUpdateEvent);
 */
export class EventBus {
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionCounter: number = 0;
  private eventHistory: WorldUpdateEvent[] = [];
  private maxHistorySize: number = 1000; // Keep last 1000 events for replay
  
  /**
   * Subscribe to world updates
   * Returns unsubscribe function
   */
  subscribe(
    subscriber: WorldUpdateSubscriber,
    filter?: Subscription['filter']
  ): () => void {
    const id = `sub_${++this.subscriptionCounter}`;
    const subscription: Subscription = {
      id,
      subscriber,
      filter,
      createdAt: Date.now(),
    };
    
    this.subscriptions.set(id, subscription);
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
    };
  }
  
  /**
   * Emit a world update event to all subscribers
   * Applies filters and delivers tailored payloads
   */
  emit(event: WorldUpdateEvent): void {
    // Store in history for replay/debugging
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Distribute to subscribers
    for (const subscription of this.subscriptions.values()) {
      // Apply filter
      if (subscription.filter) {
        const shouldDeliver = this.shouldDeliverToSubscriber(event, subscription.filter);
        if (!shouldDeliver) {
          continue;
        }
      }
      
      // Deliver (with error handling to prevent one subscriber from breaking others)
      try {
        subscription.subscriber(event);
      } catch (error) {
        console.warn(`[EventBus] Subscriber ${subscription.id} threw error:`, error);
      }
    }
  }
  
  /**
   * Emit a batch of events (used during Study Mode)
   * Only the last event from each mutation type is kept to avoid spam
   */
  emitBatch(events: WorldUpdateEvent[]): void {
    for (const event of events) {
      this.emit(event);
    }
  }
  
  /**
   * Get event history for debugging/replay
   */
  getEventHistory(lastN: number = 100): WorldUpdateEvent[] {
    return this.eventHistory.slice(-lastN);
  }
  
  /**
   * Get current subscriber count (for monitoring)
   */
  getSubscriberCount(): number {
    return this.subscriptions.size;
  }
  
  /**
   * Clear all subscriptions (used on manual reset)
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }
  
  /**
   * Determine if an event should be delivered based on filter
   */
  private shouldDeliverToSubscriber(event: WorldUpdateEvent, filter: Subscription['filter']): boolean {
    if (!filter) {
      return true;
    }
    
    // Filter by mutation type if specified
    if (filter.mutationTypes && filter.mutationTypes.length > 0) {
      const hasRelevantMutation = event.mutations.some(m => 
        filter.mutationTypes!.includes(m.type)
      );
      if (!hasRelevantMutation) {
        return false;
      }
    }
    
    // Filter to player-only events if specified
    if (filter.playerOnly && event.playerVesselId) {
      const playerMutations = event.mutations.filter(m => 
        m.actorId === event.playerVesselId || m.targetId === event.playerVesselId
      );
      if (playerMutations.length === 0 && !event.epochTransition) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Global EventBus singleton
 * Initialized by EngineOrchestrator on world startup
 */
let globalEventBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function setGlobalEventBus(bus: EventBus): void {
  globalEventBus = bus;
}

export function resetGlobalEventBus(): void {
  globalEventBus = null;
}

/**
 * EventBus Utilities: Helper functions for building events
 */

/**
 * Create a WorldUpdateEvent from tick results
 */
export function createWorldUpdateEvent(options: {
  tick: number;
  epochNumber: number;
  stateHash: StateHash;
  mutations?: TickMutation[];
  playerVesselId?: string;
  playerSoulId?: string;
  causalLocks?: CausalLockInfo[];
  echoPoints?: EchoPointInfo[];
  epochTransition?: WorldUpdateEvent['epochTransition'];
  uiEvents?: WorldUpdateEvent['uiEvents'];
}): WorldUpdateEvent {
  return {
    tick: options.tick,
    epochNumber: options.epochNumber,
    timestamp: Date.now(),
    stateHash: options.stateHash,
    mutations: options.mutations || [],
    playerVesselId: options.playerVesselId,
    playerSoulId: options.playerSoulId,
    causalLocks: options.causalLocks || [],
    echoPoints: options.echoPoints || [],
    epochTransition: options.epochTransition,
    uiEvents: options.uiEvents,
  };
}

/**
 * Create a mutation record for event tracking
 */
export function createMutation(options: {
  type: TickMutation['type'];
  actorId?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  tick: number;
}): TickMutation {
  return {
    type: options.type,
    actorId: options.actorId,
    targetId: options.targetId,
    metadata: options.metadata,
    timestamp: options.tick,
  };
}

/**
 * Create causal lock info for display
 */
export function createCausalLockInfo(options: {
  soulId: string;
  remainingTicks: number;
  lockExpiresTick: number;
  reason: CausalLockInfo['reason'];
}): CausalLockInfo {
  return {
    soulId: options.soulId,
    remainingTicks: options.remainingTicks,
    lockExpiresTick: options.lockExpiresTick,
    reason: options.reason,
  };
}

/**
 * Create echo point info for display
 */
export function createEchoPointInfo(options: {
  soulId: string;
  totalPoints: number;
  bySkill?: Record<string, number>;
  tick: number;
}): EchoPointInfo {
  return {
    soulId: options.soulId,
    totalPoints: options.totalPoints,
    bySkill: options.bySkill || {},
    lastUpdatedTick: options.tick,
  };
}
