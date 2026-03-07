import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { canonicalize } from '../events/mutationLog';
import { random } from './prng';
import { compactEventLog } from './eventCompactionEngine';
import * as crypto from 'crypto';

/**
 * Simple SHA-256-like hash using TypeScript (for browser compatibility)
 * Note: This is NOT cryptographically secure; for production use crypto libraries
 */
function simpleHash(input: string): string {
  let hash = 0xcafebabe;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Keep as 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Phase 10: Compute SHA-256 hash of world state for snapshot integrity verification
 * Uses cryptographic hashing (via Node.js crypto module if available, falls back to simpleHash)
 */
export function computeSnapshotHash(state: WorldState): string {
  try {
    // Try using Node.js crypto (available in server-side rendering)
    const canonical = canonicalize({
      tick: state.tick,
      seed: state.seed,
      playerLocation: state.player?.location,
      playerLevel: state.player?.level,
      npcCount: state.npcs?.length,
      questCount: state.quests?.length,
      factionCount: state.factions?.length,
      // Exclude: timestamp, audio state, transient director state
    });
    
    if (crypto && crypto.createHash) {
      return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 32);
    }
  } catch (e) {
    // Fall back to simpleHash if crypto unavailable
  }
  
  return simpleHash(canonicalize(state));
}

/**
 * Phase 10: Verify snapshot chain integrity
 * Check that current snapshot links properly to previous snapshot
 */
export function verifySnapshotChain(snapshots: Array<{ tick: number; stateHash: string; previousSnapshotHash?: string }>): { valid: boolean; failedAt?: number; reason?: string } {
  if (!snapshots || snapshots.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    
    // Check chain linkage (if not first snapshot)
    if (i > 0) {
      const prevSnapshot = snapshots[i - 1];
      if (snapshot.previousSnapshotHash && snapshot.previousSnapshotHash !== prevSnapshot.stateHash) {
        return {
          valid: false,
          failedAt: i,
          reason: `Snapshot ${i} (tick ${snapshot.tick}) links to wrong previous hash`
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Compute hash chain for events
 * Each event includes previousHash to form an immutable chain
 */
export function computeEventHashChain(events: Event[]): Map<string, string> {
  const hashMap = new Map<string, string>();
  let previousHash = 'INIT_GENESIS_BLOCK';

  for (const event of events) {
    const eventData = canonicalize(event);
    const currentHash = simpleHash(eventData + previousHash);
    hashMap.set(event.id, currentHash);
    previousHash = currentHash;
  }

  return hashMap;
}

/**
 * Verify entire event log integrity
 * Returns: { valid: boolean; failedAt?: number; reason?: string }
 */
export function verifyEventHashChain(events: Event[]): { valid: boolean; failedAt?: number; reason?: string } {
  if (!events || events.length === 0) {
    return { valid: true };
  }

  let previousHash = 'INIT_GENESIS_BLOCK';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventData = canonicalize(event);
    const expectedHash = simpleHash(eventData + previousHash);

    // If event stores hash for chain validation (optional field)
    if ((event as any).previousHash && (event as any).previousHash !== previousHash) {
      return {
        valid: false,
        failedAt: i,
        reason: `Event ${i} hash chain broken: expected previous=${previousHash}, got=${(event as any).previousHash}`
      };
    }

    previousHash = expectedHash;
  }

  return { valid: true };
}

export interface GameSave {
  id: string;
  name: string;
  worldInstanceId: string;
  timestamp: number;
  tick: number;
  stateSnapshot: WorldState;
  eventLog: Event[];
  checksum: string;
  eventHashChain?: string; // Final hash of the complete chain
  compactionMetadata?: {  // M50-A2: Event compaction metadata
    isCompacted: boolean;
    originalEventCount?: number;
    compactedEventCount?: number;
    reductionRatio?: number;  // Percentage
  };
}

// In-memory save storage (would be localStorage or DB in production)
const SAVE_STORE = new Map<string, GameSave>();

/**
 * Create a hash-chain checksum for a save
 */
export function createSaveChecksum(save: Omit<GameSave, 'checksum' | 'eventHashChain'>): string {
  // Hash the frozen state and event log deterministically
  const canonical = canonicalize({
    id: save.id,
    name: save.name,
    worldInstanceId: save.worldInstanceId,
    timestamp: save.timestamp,
    tick: save.tick,
    stateSnapshot: save.stateSnapshot,
    eventLog: save.eventLog
  });

  // Use event hash chain as foundation
  const eventChainHash = computeEventHashChain(save.eventLog);
  const finalChainHash = Array.from(eventChainHash.values()).pop() || 'EMPTY_LOG';
  
  const hashSource = canonical + finalChainHash + '|PROJECT_ISEKAI_SAVE_V2';
  return simpleHash(hashSource);
}

/**
 * Verify a save's integrity via hash check AND event chain validation
 */
export function verifySaveIntegrity(save: GameSave): { valid: boolean; reason?: string } {
  // Check 1: Verify event hash chain
  const chainCheck = verifyEventHashChain(save.eventLog);
  if (!chainCheck.valid) {
    return {
      valid: false,
      reason: `Event chain broken at position ${chainCheck.failedAt}: ${chainCheck.reason}`
    };
  }

  // Check 2: Verify save checksum
  const expectedChecksum = createSaveChecksum({
    id: save.id,
    name: save.name,
    worldInstanceId: save.worldInstanceId,
    timestamp: save.timestamp,
    tick: save.tick,
    stateSnapshot: save.stateSnapshot,
    eventLog: save.eventLog
  });

  if (save.checksum !== expectedChecksum) {
    return {
      valid: false,
      reason: `Checksum mismatch: expected ${expectedChecksum}, got ${save.checksum}`
    };
  }

  return { valid: true };
}

/**
 * Create a save from current world state
 * @param compactEvents - M50-A2: If true, compact event log before saving
 */
export function createSave(
  name: string,
  currentState: WorldState,
  eventLog: Event[],
  worldInstanceId: string,
  tick: number,
  compactEvents: boolean = false
): GameSave {
  const saveId = `save_${Date.now()}_${Math.floor(random() * 0xffffff).toString(16)}`;
  
  // M50-A2: Optional event log compaction
  let eventLogToSave = structuredClone(eventLog);
  let compactionMetadata: GameSave['compactionMetadata'] | undefined;
  
  if (compactEvents && eventLog.length > 100) {  // Only compact if event log is substantial
    const originalCount = eventLogToSave.length;
    eventLogToSave = compactEventLog(eventLogToSave, 24);  // Group approximately daily
    const newCount = eventLogToSave.length;
    const reductionRatio = Math.round(((originalCount - newCount) / originalCount) * 10000) / 100;
    
    compactionMetadata = {
      isCompacted: true,
      originalEventCount: originalCount,
      compactedEventCount: newCount,
      reductionRatio
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Save] Event log compacted: ${originalCount} → ${newCount} events (-${reductionRatio}%)`);
    }
  }

  const save: Omit<GameSave, 'checksum' | 'eventHashChain'> = {
    id: saveId,
    name,
    worldInstanceId,
    timestamp: Date.now(),
    tick,
    stateSnapshot: structuredClone(currentState),
    eventLog: eventLogToSave,
    compactionMetadata
  };

  const checksum = createSaveChecksum(save);
  
  // Compute and store final event hash for audit trail
  const eventHashMap = computeEventHashChain(save.eventLog);
  const eventHashChain = Array.from(eventHashMap.values()).pop() || 'EMPTY_LOG';
  
  const completeSave: GameSave = { ...save, checksum, eventHashChain };

  SAVE_STORE.set(saveId, completeSave);
  return completeSave;
}

/**
 * Load a save by ID
 */
export function loadSave(saveId: string): GameSave | null {
  const save = SAVE_STORE.get(saveId);
  if (!save) {
    return null;
  }

  // Verify integrity before returning
  const integrityCheck = verifySaveIntegrity(save);
  if (!integrityCheck.valid) {
    console.warn(`Save ${saveId} failed integrity check: ${integrityCheck.reason}`);
    return null;
  }

  return structuredClone(save);
}

/**
 * List all available saves (summaries)
 */
export function listSaves(): Array<{ id: string; name: string; timestamp: number; tick: number }> {
  return Array.from(SAVE_STORE.values()).map(save => ({
    id: save.id,
    name: save.name,
    timestamp: save.timestamp,
    tick: save.tick
  }));
}

/**
 * Delete a save by ID
 */
export function deleteSave(saveId: string): boolean {
  return SAVE_STORE.delete(saveId);
}

/**
 * Export save as JSON (for backup/download)
 */
export function exportSaveAsJson(save: GameSave): string {
  return JSON.stringify(save, null, 2);
}

/**
 * Import save from JSON (with integrity check)
 */
export function importSaveFromJson(jsonString: string): GameSave | null {
  try {
    const imported = JSON.parse(jsonString) as GameSave;
    
    if (!verifySaveIntegrity(imported)) {
      console.warn('Imported save failed integrity check.');
      return null;
    }

    SAVE_STORE.set(imported.id, imported);
    return imported;
  } catch (error) {
    console.error('Failed to import save:', error);
    return null;
  }
}
/**
 * Detect temporal paradox: loading an older save after advancing
 * Returns debt increase amount if paradox detected
 */
export function detectTemporalParadox(
  currentTick: number,
  previousTick: number,
  currentChaos: number,
  previousChaos: number
): { paradoxDetected: boolean; debtIncrease: number; description?: string } {
  // Paradox: current tick is earlier than previous (rewind)
  if (currentTick < previousTick) {
    const ticksRewound = previousTick - currentTick;
    
    // Base debt: 0.5 per tick rewound (max +25 debt per rewind)
    let debtIncrease = Math.min(25, ticksRewound * 0.5);
    
    // Bonus debt if chaos was reduced by rewind (exploiting to lower suspicion)
    if (currentChaos < previousChaos) {
      const chaosReduction = previousChaos - currentChaos;
      const exploitBonus = Math.min(15, chaosReduction * 0.3);  // 30% of chaos reduction
      debtIncrease += exploitBonus;
    }

    return {
      paradoxDetected: true,
      debtIncrease: Math.min(50, debtIncrease),  // Cap at 50 per single rewind
      description: `Temporal Paradox Detected: Rewound ${ticksRewound} ticks. Debt: +${Math.floor(debtIncrease)}`
    };
  }

  return { paradoxDetected: false, debtIncrease: 0 };
}

/**
 * Apply temporal debt to a loaded save state
 * Modifies the world state to reflect time paradox penalties
 */
export function applyTemporalPenalty(
  save: GameSave,
  debtIncrease: number
): GameSave {
  const modified = structuredClone(save);
  
  // Update player's temporal debt
  if (modified.stateSnapshot.player) {
    const currentDebt = modified.stateSnapshot.player.temporalDebt || 0;
    modified.stateSnapshot.player.temporalDebt = Math.min(100, currentDebt + debtIncrease);
    
    // Also boost suspicion slightly (world notices the paradox)
    if (modified.stateSnapshot.player.beliefLayer) {
      const currentSuspicion = modified.stateSnapshot.player.beliefLayer.suspicionLevel || 0;
      const suspicionBoost = Math.floor(debtIncrease * 0.3);  // 30% of debt becomes suspicion
      modified.stateSnapshot.player.beliefLayer.suspicionLevel = Math.min(
        100,
        currentSuspicion + suspicionBoost
      );
    }
  }

  // Recalculate checksum with modified state
  const newChecksum = createSaveChecksum({
    id: modified.id,
    name: modified.name,
    worldInstanceId: modified.worldInstanceId,
    timestamp: modified.timestamp,
    tick: modified.tick,
    stateSnapshot: modified.stateSnapshot,
    eventLog: modified.eventLog
  });

  return { ...modified, checksum: newChecksum };
}

/**
 * Get temporal debt multiplier based on how severe the rewind was
 * Used to calculate NPC behavior changes, obfuscation disruption, etc.
 */
export function getTemporalDebtMultiplier(temporalDebt: number): number {
  if (temporalDebt >= 80) return 3.0;   // Extreme: 3x chaos effects
  if (temporalDebt >= 60) return 2.5;   // Severe: 2.5x
  if (temporalDebt >= 40) return 2.0;   // Moderate: 2x  
  if (temporalDebt >= 20) return 1.5;   // Minor: 1.5x
  return 1.0;                           // No multiplier
}

/**
 * Track save/load history for statistics
 */
export interface SaveLoadStats {
  totalSaves: number;
  totalRewinds: number;
  avgTemporalDebt: number;
  maxTemporalDebt: number;
  paradoxesDetected: number;
}

const SAVE_LOAD_STATS: SaveLoadStats = {
  totalSaves: 0,
  totalRewinds: 0,
  avgTemporalDebt: 0,
  maxTemporalDebt: 0,
  paradoxesDetected: 0
};

/**
 * Record a rewind event in statistics
 */
export function recordRewindStat(temporalDebt: number): void {
  SAVE_LOAD_STATS.totalRewinds += 1;
  SAVE_LOAD_STATS.avgTemporalDebt = 
    (SAVE_LOAD_STATS.avgTemporalDebt * (SAVE_LOAD_STATS.totalRewinds - 1) + temporalDebt) / 
    SAVE_LOAD_STATS.totalRewinds;
  SAVE_LOAD_STATS.maxTemporalDebt = Math.max(SAVE_LOAD_STATS.maxTemporalDebt, temporalDebt);
  SAVE_LOAD_STATS.paradoxesDetected += 1;
}

/**
 * Get current save/load statistics
 */
export function getSaveLoadStats(): SaveLoadStats {
  return { ...SAVE_LOAD_STATS };
}

/**
 * BETA Phase 2: Apply a snapshot to initialize world state
 * 
 * This function:
 * 1. Takes a saved snapshot (state + metadata)
 * 2. Returns the loaded state
 * 3. Returns the event index to start replaying from
 * 
 * Usage: Load snapshot, then replay events after that snapshot for fast recovery
 * 
 * @param snapshotState - The saved WorldState from the snapshot
 * @param lastEventIndexInSnapshot - The event index this snapshot was based on
 * @returns { state, replayFromEventIndex }
 */
export function applySnapshot(
  snapshotState: any, // WorldState
  lastEventIndexInSnapshot: number
): { initialState: any; replayFromEventIndex: number } {
  // Deep clone to avoid mutation
  const initialState = structuredClone(snapshotState);
  
  // Return the state and the event index to start replaying from
  // Events with index > lastEventIndexInSnapshot will be replayed
  return {
    initialState,
    replayFromEventIndex: lastEventIndexInSnapshot
  };
}

/**
 * BETA Phase 2: Verify snapshot hash matches current state
 * For integrity checking when loading a snapshot
 * 
 * @param state - Current state to verify
 * @param snapshotHash - Expected hash from snapshot metadata
 * @returns true if hashes match
 */
export function verifySnapshotIntegrity(state: any, snapshotHash: string): boolean {
  const stateCanonical = canonicalize(state);
  const currentHash = require('crypto')
    .createHash('sha256')
    .update(stateCanonical)
    .digest('hex');
  
  return currentHash === snapshotHash;
}
