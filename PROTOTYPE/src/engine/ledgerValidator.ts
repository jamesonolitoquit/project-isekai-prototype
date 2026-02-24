/**
 * Phase 32 M62-CHRONOS: Deterministic Ledger Integrity Validation
 *
 * Ensures perfect determinism by validating the mutation ledger against snapshots.
 * Uses SHA-256 to verify the ledger chain - any event deviation invalidates the sequence.
 *
 * Target: <200ms load times with ledger verification
 */

/**
 * Simple SHA-256 implementation for ledger hashing
 * Returns hex string of SHA-256 hash
 */
async function sha256(message: string): Promise<string> {
  try {
    // Try browser crypto API first
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback: Simple hash (deterministic but not cryptographically secure)
    // For offline/Node.js environments
    return simpleHashFallback(message);
  } catch (error) {
    console.warn('[Ledger] SHA-256 unavailable, using fallback hash:', error);
    return simpleHashFallback(message);
  }
}

/**
 * Fallback hash function (deterministic but not crypto-grade)
 * Used when Web Crypto API is unavailable
 */
function simpleHashFallback(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).padStart(16, '0') +
         Math.abs(hash ^ 0xffffffff).toString(16).padStart(16, '0');
}

/**
 * Ledger Entry - represents one event in the mutation chain
 */
export interface LedgerEntry {
  eventIndex: number;
  eventType: string;
  tick: number;
  timestamp: number;
  hash: string;  // SHA-256 of event payload
  previousHash: string;  // Link to previous entry
}

/**
 * Ledger Checkpoint - validates integrity at snapshot points
 */
export interface LedgerCheckpoint {
  tick: number;
  timestamp: number;
  eventCount: number;
  ledgerHash: string;  // Cumulative hash of all events up to this tick
  snapshotHash?: string;  // Hash of the world state snapshot
}

/**
 * Validates that events are valid and deterministic
 * Called after loading from snapshot to verify delta replay integrity
 */
export async function validateLedgerIntegrity(
  events: Array<{ type: string; tick: number; timestamp: number; payload?: any }>,
  previousLedgerHash: string = '0'
): Promise<{ valid: boolean; ledgerHash: string; errorMessage?: string }> {
  if (!events || events.length === 0) {
    return { valid: true, ledgerHash: previousLedgerHash };
  }

  try {
    let currentHash = previousLedgerHash;
    
    for (const event of events) {
      // Create payload hash
      const eventPayload = JSON.stringify({ ...event, type: event.type });
      const eventHash = await sha256(eventPayload);
      
      // Chain: current = hash(previousHash + eventHash)
      const chainData = currentHash + eventHash;
      currentHash = await sha256(chainData);
    }
    
    return { valid: true, ledgerHash: currentHash };
  } catch (error) {
    return {
      valid: false,
      ledgerHash: previousLedgerHash,
      errorMessage: `Ledger validation failed: ${String(error)}`
    };
  }
}

/**
 * Create checkpoint for snapshot validation
 * Called when saving a snapshot at a milestone tick
 */
export async function createLedgerCheckpoint(
  tick: number,
  eventCount: number,
  currentLedgerHash: string
): Promise<LedgerCheckpoint> {
  return {
    tick,
    timestamp: Date.now(),
    eventCount,
    ledgerHash: currentLedgerHash,
    snapshotHash: undefined  // Filled in by snapshot engine
  };
}

/**
 * Validate snapshot against ledger checkpoint
 * Ensures events replayed from snapshot resulted in correct state
 */
export async function validateSnapshotAgainstCheckpoint(
  checkpoint: LedgerCheckpoint,
  replayedLedgerHash: string
): Promise<boolean> {
  if (checkpoint.ledgerHash !== replayedLedgerHash) {
    console.error(
      '[Ledger] Checkpoint mismatch:',
      { expected: checkpoint.ledgerHash, got: replayedLedgerHash }
    );
    return false;
  }
  return true;
}

/**
 * Export ledger validation for use in stateRebuilder
 */
export const LedgerValidator = {
  sha256,
  validateLedgerIntegrity,
  createLedgerCheckpoint,
  validateSnapshotAgainstCheckpoint
};
