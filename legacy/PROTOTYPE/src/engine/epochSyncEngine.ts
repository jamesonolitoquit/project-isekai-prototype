/**
 * Epoch Sync Engine — Milestone 42, Task 1
 *
 * Purpose: Enable P2P epoch synchronization across multiplayer cluster.
 * When any peer shifts the epoch (Director mode, world event, or consensus vote),
 * the change propagates to all connected peers with theme morphing synchronized
 * across the cluster (target: <100ms latency skew).
 *
 * Key Concepts:
 * - EpochSyncEvent: Immutable record of epoch shift request
 * - Clock Offset Compensation: Tracks drift between peers to ensure sync timing
 * - Rollback Support: Allow 1-step undo of epoch shifts
 * - Epoch History: Permanent record of all epoch changes in session
 *
 * Usage:
 *   const engine = createEpochSyncEngine();
 *   engine.subscribeToEpochShifts((event) => {
 *     themeManager.applyTheme(event.targetEpoch, true);  // smooth=true for animation
 *   });
 *   engine.broadcastEpochShift(2, 'director');  // Shift to Epoch II from Director
 */

import type { WorldState } from './worldEngine';

/**
 * Epoch Sync Event — immutable record of epoch shift request
 */
export interface EpochSyncEvent {
  eventId: string;                        // Unique UUID for this shift
  timestamp: number;                      // Sender's clock (ms since epoch)
  targetEpoch: 1 | 2 | 3;                 // Target epoch number
  source: 'director' | 'world_event' | 'player_consensus' | 'system';
  initiatorClientId: string;              // Who/what triggered this shift
  clockOffset?: number;                   // Receiver's clock offset (ms) for sync compensation
  reason?: string;                        // Human-readable reason (e.g., "Player voted", "World event triggered")
}

/**
 * Epoch Record — historical entry stored in epoch history
 */
export interface EpochRecord {
  tick: number;                           // Game tick when shift occurred
  epoch: 1 | 2 | 3;                       // Epoch after shift
  priorEpoch: 1 | 2 | 3;                  // Epoch before shift
  source: string;                         // Source of the shift
  initiator: string;                      // Who initiated
  timestamp: number;                      // Real-world timestamp
  consensusApproved?: boolean;            // If consensus was required, was it approved?
}

/**
 * Epoch Sync Engine — manages epoch synchronization across peers
 */
export interface EpochSyncEngine {
  /** Current epoch (cached for fast access) */
  currentEpoch: 1 | 2 | 3;

  /** Epoch shift history for this session */
  epochHistory: EpochRecord[];

  /** Pending epoch shifts waiting for consensus */
  pendingShifts: EpochSyncEvent[];

  /** Clock offset tracking per peer (clientId -> offset in ms) */
  peerClockOffsets: Map<string, number>;

  /**
   * Broadcast an epoch shift to all connected peers
   * Returns true if broadcast succeeded, false if blocked
   */
  broadcastEpochShift(
    targetEpoch: 1 | 2 | 3,
    source: EpochSyncEvent['source'],
    initiatorClientId: string,
    reason?: string
  ): boolean;

  /**
   * Process an incoming epoch shift event from a peer
   */
  processEpochShiftEvent(event: EpochSyncEvent): void;

  /**
   * Subscribe to epoch shift events (local + remote)
   * Callback receives both local and incoming shifts
   */
  subscribeToEpochShifts(callback: (event: EpochSyncEvent) => void): () => void;

  /**
   * Undo the last epoch shift (1-step rollback only)
   */
  undoEpochShift(): boolean;

  /**
   * Record peer's clock drift for compensation calculations
   */
  recordPeerClockDrift(clientId: string, driftMs: number): void;

  /**
   * Get average clock offset across all known peers
   */
  getAverageClockOffset(): number;

  /**
   * Get current epoch + prior epoch for display
   */
  getEpochState(): { current: 1 | 2 | 3; prior?: 1 | 2 | 3; };
}

/**
 * Create a new epoch sync engine
 */
export function createEpochSyncEngine(
  initialEpoch: 1 | 2 | 3 = 1,
  clientId: string = 'client_0'
): EpochSyncEngine {
  let currentEpoch: 1 | 2 | 3 = initialEpoch;
  const epochHistory: EpochRecord[] = [];
  const pendingShifts: EpochSyncEvent[] = [];
  const peerClockOffsets: Map<string, number> = new Map();
  const subscribers: Array<(event: EpochSyncEvent) => void> = [];

  return {
    currentEpoch,
    epochHistory,
    pendingShifts,
    peerClockOffsets,

    broadcastEpochShift(targetEpoch, source, initiatorClientId, reason) {
      // Validation: ensure target is valid epoch
      if (targetEpoch < 1 || targetEpoch > 3) {
        console.warn(`[EpochSync] Invalid target epoch: ${targetEpoch}`);
        return false;
      }

      // Validation: don't shift to same epoch
      if (targetEpoch === currentEpoch) {
        console.warn(`[EpochSync] Already at epoch ${currentEpoch}`);
        return false;
      }

      const event: EpochSyncEvent = {
        eventId: `epoch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        targetEpoch,
        source,
        initiatorClientId,
        clockOffset: 0, // Local client, no offset
        reason: reason || `Shift to Epoch ${targetEpoch} from ${source}`
      };

      // Record in history
      epochHistory.push({
        tick: 0, // Will be set by worldEngine
        epoch: targetEpoch,
        priorEpoch: currentEpoch,
        source,
        initiator: initiatorClientId,
        timestamp: event.timestamp
      });

      // Update current epoch
      const priorEpoch = currentEpoch;
      currentEpoch = targetEpoch;

      // Notify all subscribers
      subscribers.forEach(cb => {
        try {
          cb(event);
        } catch (err) {
          console.error('[EpochSync] Subscriber error:', err);
        }
      });

      console.log(
        `[EpochSync] Broadcast: ${priorEpoch}→${targetEpoch} from ${source}`,
        `(${subscribers.length} subscribers notified)`
      );

      return true;
    },

    processEpochShiftEvent(event) {
      // Validation: verify event structure
      if (!event.targetEpoch || event.targetEpoch < 1 || event.targetEpoch > 3) {
        console.warn('[EpochSync] Invalid incoming event:', event);
        return;
      }

      // Apply clock offset if provided (for sync compensation)
      if (event.clockOffset !== undefined) {
        this.recordPeerClockDrift(event.initiatorClientId, event.clockOffset);
      }

      // Update current epoch if different
      if (event.targetEpoch !== currentEpoch) {
        const priorEpoch = currentEpoch;
        currentEpoch = event.targetEpoch;

        // Record in history
        epochHistory.push({
          tick: 0,
          epoch: event.targetEpoch,
          priorEpoch,
          source: event.source,
          initiator: event.initiatorClientId,
          timestamp: event.timestamp
        });

        console.log(
          `[EpochSync] Received: ${priorEpoch}→${event.targetEpoch} from ${event.initiatorClientId}`,
          `(source: ${event.source})`
        );
      }

      // Notify subscribers
      subscribers.forEach(cb => {
        try {
          cb(event);
        } catch (err) {
          console.error('[EpochSync] Subscriber error:', err);
        }
      });
    },

    subscribeToEpochShifts(callback) {
      subscribers.push(callback);

      // Return unsubscribe function
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx !== -1) {
          subscribers.splice(idx, 1);
        }
      };
    },

    undoEpochShift() {
      // Allow 1-step rollback only
      if (epochHistory.length < 2) {
        console.warn('[EpochSync] Cannot rollback: not enough history (min 2 records)');
        return false;
      }

      // Get the prior epoch from history
      const lastRecord = epochHistory[epochHistory.length - 1];
      const priorEpoch = lastRecord.priorEpoch;

      // Remove last record
      epochHistory.pop();

      // Revert current epoch
      const oldEpoch = currentEpoch;
      currentEpoch = priorEpoch;

      // Create rollback event
      const rollbackEvent: EpochSyncEvent = {
        eventId: `rollback_${Date.now()}`,
        timestamp: Date.now(),
        targetEpoch: priorEpoch,
        source: 'system',
        initiatorClientId: 'system',
        reason: `Rollback: ${oldEpoch}→${priorEpoch}`
      };

      // Notify subscribers
      subscribers.forEach(cb => {
        try {
          cb(rollbackEvent);
        } catch (err) {
          console.error('[EpochSync] Subscriber error:', err);
        }
      });

      console.log(
        `[EpochSync] Rollback: ${oldEpoch}→${priorEpoch}`,
        `(history now ${epochHistory.length} records)`
      );

      return true;
    },

    recordPeerClockDrift(clientId, driftMs) {
      peerClockOffsets.set(clientId, driftMs);

      // Log if drift is significant (>50ms)
      if (Math.abs(driftMs) > 50) {
        console.warn(
          `[EpochSync] Clock drift detected: ${clientId} @ ${driftMs}ms offset`
        );
      }
    },

    getAverageClockOffset() {
      if (peerClockOffsets.size === 0) return 0;

      const offsets = Array.from(peerClockOffsets.values());
      const sum = offsets.reduce((a, b) => a + b, 0);
      return Math.round(sum / offsets.length);
    },

    getEpochState() {
      const current = currentEpoch;
      const prior = epochHistory.length > 0 
        ? epochHistory[epochHistory.length - 1].priorEpoch 
        : undefined;

      return { current, prior };
    }
  };
}

/**
 * Singleton instance (can be overridden for testing)
 */
let epochSyncEngine: EpochSyncEngine | null = null;

export function initializeEpochSyncEngine(
  initialEpoch?: 1 | 2 | 3,
  clientId?: string
): EpochSyncEngine {
  epochSyncEngine = createEpochSyncEngine(initialEpoch, clientId);
  return epochSyncEngine;
}

export function getEpochSyncEngine(): EpochSyncEngine {
  if (!epochSyncEngine) {
    epochSyncEngine = createEpochSyncEngine();
  }
  return epochSyncEngine;
}
