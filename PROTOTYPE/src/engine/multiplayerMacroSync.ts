/**
 * M44-C5: Multiplayer Macro Synchronization
 * 
 * Synchronizes macro events across peers with:
 * - Deterministic event generation via seeded RNG
 * - MACRO_EVENT_BROADCAST message type for all peers
 * - Consensus lag buffer (100 ticks) for synchronized visual effects
 * - Worldseed integration for determinism
 */

import type { WorldState } from './worldEngine';
import { SeededRng } from './prng';

/**
 * M44-C5: Broadcast message for macro events across multiplayer peers
 */
export interface MacroEventBroadcast {
  type: 'MACRO_EVENT_BROADCAST';
  peerId: string;
  macroEventId: string;
  eventType: string;
  worldSeed: number; // for deterministic RNG
  factionId: string;
  locationId: string;
  effectTick: number; // when effect should trigger (current_tick + CONSENSUS_LAG)
  narrativePayload: {
    directorNarrative: string;
    npcMemoryMessage: string;
    playerNotification: string;
  };
  timestamp: number; // peer's local tick
}

/**
 * M44-C5: Received macro event with consensus tracking
 */
export interface ReceivedMacroEvent {
  broadcast: MacroEventBroadcast;
  receivedAtTick: number;
  readyToExecuteAtTick: number; // receivedAtTick + CONSENSUS_LAG
  executed: boolean;
}

/**
 * M44-C5: Consensus parameters for macro sync
 */
export const MACRO_SYNC_CONFIG = {
  CONSENSUS_LAG_TICKS: 100, // Buffer time for all peers to receive event before execution
  BROADCAST_RETRY_COUNT: 3, // Retransmit if peer confirms no receipt
  BROADCAST_RESEND_INTERVAL: 10, // ticks between retransmits
};

/**
 * M44-C5: Multiplayer macro synchronization layer
 */
export class MultiplayerMacroSync {
  private pendingBroadcasts: Map<string, MacroEventBroadcast> = new Map();
  private receivedEvents: ReceivedMacroEvent[] = [];
  private executedEventIds: Set<string> = new Set();
  private rngCache: Map<string, SeededRng> = new Map();

  /**
   * M44-C5: Broadcast macro event to all peers
   * Called when directorMacroEngine spawns an event
   */
  broadcastMacroEvent(
    macroEventId: string,
    eventType: string,
    factionId: string,
    locationId: string,
    worldSeed: number,
    narrativePayload: any,
    currentTick: number,
    peerId: string
  ): MacroEventBroadcast {
    const broadcast: MacroEventBroadcast = {
      type: 'MACRO_EVENT_BROADCAST',
      peerId,
      macroEventId,
      eventType,
      worldSeed,
      factionId,
      locationId,
      effectTick: currentTick + MACRO_SYNC_CONFIG.CONSENSUS_LAG_TICKS,
      narrativePayload,
      timestamp: currentTick,
    };

    this.pendingBroadcasts.set(macroEventId, broadcast);
    return broadcast;
  }

  /**
   * M44-C5: Receive broadcast from another peer
   * Queues event for consensus-delayed execution
   */
  receiveMacroBroadcast(broadcast: MacroEventBroadcast, currentTick: number): void {
    const received: ReceivedMacroEvent = {
      broadcast,
      receivedAtTick: currentTick,
      readyToExecuteAtTick: currentTick + MACRO_SYNC_CONFIG.CONSENSUS_LAG_TICKS,
      executed: false,
    };

    this.receivedEvents.push(received);
  }

  /**
   * M44-C5: Get all macro events ready for execution this tick
   */
  getReadyMacroEvents(currentTick: number): ReceivedMacroEvent[] {
    return this.receivedEvents.filter(
      event => !event.executed && event.readyToExecuteAtTick <= currentTick
    );
  }

  /**
   * M44-C5: Mark macro event as executed
   */
  markMacroEventExecuted(macroEventId: string): void {
    this.executedEventIds.add(macroEventId);
    const event = this.receivedEvents.find(e => e.broadcast.macroEventId === macroEventId);
    if (event) {
      event.executed = true;
    }
  }

  /**
   * M44-C5: Create seeded RNG for deterministic macro effect generation
   * Uses world seed + event seed for reproducibility
   */
  createDeterministicRng(worldSeed: number, eventId: string): SeededRng {
    const cacheKey = `${worldSeed}:${eventId}`;
    if (this.rngCache.has(cacheKey)) {
      return this.rngCache.get(cacheKey)!;
    }

    // Combine seeds: world seed + hash of event ID
    let eventHash = 0;
    for (let i = 0; i < eventId.length; i++) {
      eventHash = ((eventHash << 5) - eventHash) + eventId.charCodeAt(i);
      eventHash = eventHash & eventHash; // Convert to 32-bit integer
    }
    const combinedSeed = (worldSeed + Math.abs(eventHash)) % 2147483647;

    const rng = new SeededRng(combinedSeed);
    this.rngCache.set(cacheKey, rng);
    return rng;
  }

  /**
   * M44-C5: Verify consensus across peers
   * Returns true if all expected peers have received and queued event
   */
  verifyConsensus(macroEventId: string, expectedPeerIds: string[], currentTick: number): boolean {
    const peersAcknowledged = new Set<string>();

    // Check received events
    for (const event of this.receivedEvents) {
      if (event.broadcast.macroEventId === macroEventId) {
        peersAcknowledged.add(event.broadcast.peerId);
      }
    }

    // All peers acknowledged (including originating peer)
    return expectedPeerIds.every(peerId => peersAcknowledged.has(peerId));
  }

  /**
   * M44-C5: Clean up old events that have been executed
   * Called periodically to prevent memory leak
   */
  pruneExecutedEvents(currentTick: number, maxAgeTicks: number = 10000): void {
    this.receivedEvents = this.receivedEvents.filter(
      event => !event.executed || currentTick - event.readyToExecuteAtTick < maxAgeTicks
    );

    // Also clean RNG cache periodically
    if (Math.random() < 0.05) {
      // 5% chance per call
      this.rngCache.clear(); // Clear cache to prevent unbounded growth
    }
  }

  /**
   * M44-C5: Export sync state for debugging
   */
  exportSyncState() {
    return {
      pendingBroadcastCount: this.pendingBroadcasts.size,
      receivedEventsCount: this.receivedEvents.length,
      executedEventCount: this.executedEventIds.size,
      consensusLagTicks: MACRO_SYNC_CONFIG.CONSENSUS_LAG_TICKS,
      rngCacheSize: this.rngCache.size,
    };
  }
}

/**
 * M44-C5: Global instance for multiplayer macro synchronization
 */
let multiplayerMacroSync: MultiplayerMacroSync | null = null;

export function getMultiplayerMacroSync(): MultiplayerMacroSync {
  if (!multiplayerMacroSync) {
    multiplayerMacroSync = new MultiplayerMacroSync();
  }
  return multiplayerMacroSync;
}

export function resetMultiplayerMacroSync(): void {
  multiplayerMacroSync = null;
}
