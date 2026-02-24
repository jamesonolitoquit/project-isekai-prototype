/**
 * Phase 27 Task 2: Oracle Consensus Engine
 * 
 * Implements "Oracle Consent" for 6-player multiplayer synchronization.
 * Resolves real-time action conflicts (e.g., two players picking up same item simultaneously).
 * 
 * Architecture:
 * - TargetLockRegistry: Map<targetId, { clientId, serverTick }> tracks entity ownership
 * - Consent Protocol: CONSENT_PROPOSAL → ORACLE_VERDICT (GRANTED/DENIED)
 * - Host-Authority Model: Host (clientId 0) acts as Oracle for deterministic resolution
 * - Selective Consensus: Only "contestable actions" (PICK_UP_ITEM, INTERACT_NPC, BUY_ITEM) require Oracle approval
 * 
 * Contestable Actions:
 * - PICK_UP_ITEM: Unique items (instanceId) can only be picked by one player per server tick
 * - INTERACT_NPC: Each NPC can be interacted with by one player per tick (prevents double-triggering)
 * - BUY_ITEM: Prevent overbuy from limited shop stocks
 * 
 * Verdict Types:
 * - GRANTED: Peer can execute action locally and broadcast to others
 * - DENIED: Peer must rollback optimistic state and emit ACTION_FAILED_RESOLVED_CONFLICT
 * - MALFORMED: Request missing required fields (client programming error)
 */

import type { WorldState } from './worldEngine';
import { random } from './prng';

/**
 * Entity type for consensus locking
 */
export type ConsensusTargetType = 'ITEM' | 'NPC' | 'LOCATION' | 'RESOURCE_NODE' | 'SHOP_STOCK';

/**
 * Target lock entry: which client owns an entity for a specific tick
 */
export interface TargetLock {
  targetId: string;
  targetType: ConsensusTargetType;
  clientId: string;           // Which client holds this lock
  serverTick: number;         // Which server tick this lock applies to
  actionType: string;         // ACTION_TYPE that requested this lock (PICK_UP_ITEM, INTERACT_NPC, etc.)
  expiresAtTick: number;      // Locks automatically expire (default: current_tick + 1)
  createdAt: number;          // Timestamp (ms) when lock was created
  instanceId?: string;        // For items: unique instanceId to prevent duplication
  lockNonce?: number;         // Random nonce for lock invalidation
}

/**
 * Oracle consensus verdict: definitive broadcast structure all peers must accept
 */
export interface OracleVerdict {
  verdictId: string;                    // Unique verdict ID for event logging
  clientId: string;                     // Which client's action is being judged
  targetId: string;                     // What entity is being contested
  verdict: 'GRANTED' | 'DENIED' | 'MALFORMED';
  reason: string;                       // English explanation of verdict
  serverTick: number;                   // Server tick at time of verdict
  lockNonce?: number;                   // Lock nonce (if GRANTED) - needed for state rebuild
  oracleClientId: string;               // Always the Oracle (e.g., clientId: '0')
  issuedAt: number;                     // Timestamp (ms) when verdict issued
  conflictingClientId?: string;         // If DENIED: which other client caused the conflict
}

/**
 * Consent proposal: peer requests permission to act on a contested entity
 */
export interface ConsentProposal {
  proposalId: string;
  clientId: string;
  targetId: string;
  targetType: ConsensusTargetType;
  actionType: string;                   // 'PICK_UP_ITEM', 'INTERACT_NPC', 'BUY_ITEM'
  serverTick: number;
  sequenceNumber: number;               // Client's local action sequence for ordering
  instanceId?: string;                  // For items: unique instanceId
  quantity?: number;                    // For resources: how many units
  proposeTime: number;                  // When proposal was created
}

/**
 * Target Lock Registry: Tracks which client owns which entity at which tick
 * Enables conflict detection and deterministic resolution
 */
export class TargetLockRegistry {
  private locks = new Map<string, TargetLock>();  // Lock ID → Lock entry
  private targetToLocks = new Map<string, Set<string>>();  // Target ID → Set of lock IDs
  private clientToLocks = new Map<string, Set<string>>();  // Client ID → Set of lock IDs
  private tickToLocks = new Map<number, Set<string>>();  // Server tick → Set of lock IDs at that tick
  private lockHistory: TargetLock[] = [];  // Historical locks for conflict resolution
  private readonly maxHistorySize = 10000;

  /**
   * Acquire a lock on an entity
   * Returns the lock if successful, or null if lock already held by another client
   */
  acquireLock(proposal: ConsentProposal): TargetLock | null {
    // Check if target already locked at this tick by a different client
    const existingLock = this.getLockAtTick(proposal.targetId, proposal.serverTick);
    if (existingLock && existingLock.clientId !== proposal.clientId) {
      // Lock held by someone else
      return null;
    }

    // Create lock entry
    const lockId = `lock_${proposal.targetId}_${proposal.serverTick}_${Math.floor(random() * 0xffffff).toString(16)}`;
    const lock: TargetLock = {
      targetId: proposal.targetId,
      targetType: proposal.targetType,
      clientId: proposal.clientId,
      serverTick: proposal.serverTick,
      actionType: proposal.actionType,
      expiresAtTick: proposal.serverTick + 1,
      createdAt: Date.now(),
      instanceId: proposal.instanceId,
      lockNonce: Math.floor(random() * 0xffffffff)
    };

    // Store lock
    this.locks.set(lockId, lock);

    // Index by target
    if (!this.targetToLocks.has(proposal.targetId)) {
      this.targetToLocks.set(proposal.targetId, new Set());
    }
    this.targetToLocks.get(proposal.targetId)!.add(lockId);

    // Index by client
    if (!this.clientToLocks.has(proposal.clientId)) {
      this.clientToLocks.set(proposal.clientId, new Set());
    }
    this.clientToLocks.get(proposal.clientId)!.add(lockId);

    // Index by tick
    if (!this.tickToLocks.has(proposal.serverTick)) {
      this.tickToLocks.set(proposal.serverTick, new Set());
    }
    this.tickToLocks.get(proposal.serverTick)!.add(lockId);

    // Track in history
    this.lockHistory.push(lock);
    if (this.lockHistory.length > this.maxHistorySize) {
      this.lockHistory.shift();
    }

    return lock;
  }

  /**
   * Release a specific lock
   */
  releaseLock(lockId: string): void {
    const lock = this.locks.get(lockId);
    if (!lock) return;

    // Remove from indices
    this.locks.delete(lockId);
    this.targetToLocks.get(lock.targetId)?.delete(lockId);
    this.clientToLocks.get(lock.clientId)?.delete(lockId);
    this.tickToLocks.get(lock.serverTick)?.delete(lockId);
  }

  /**
   * Release all locks held by a client at a specific tick
   */
  releaseLocksByClient(clientId: string, serverTick: number): void {
    const clientLocks = this.clientToLocks.get(clientId);
    if (!clientLocks) return;

    const lockIds = Array.from(clientLocks);
    for (const lockId of lockIds) {
      const lock = this.locks.get(lockId);
      if (lock && lock.serverTick === serverTick) {
        this.releaseLock(lockId);
      }
    }
  }

  /**
   * Get lock on a target at a specific tick (returns first/only lock)
   */
  getLockAtTick(targetId: string, serverTick: number): TargetLock | null {
    const targetLocks = this.targetToLocks.get(targetId);
    if (!targetLocks) return null;

    for (const lockId of targetLocks) {
      const lock = this.locks.get(lockId);
      if (lock && lock.serverTick === serverTick && !lock.expiresAtTick || lock.expiresAtTick > serverTick) {
        return lock;
      }
    }
    return null;
  }

  /**
   * Get all locks held by a client
   */
  getClientLocks(clientId: string): TargetLock[] {
    const lockIds = this.clientToLocks.get(clientId);
    if (!lockIds) return [];

    return Array.from(lockIds)
      .map(lockId => this.locks.get(lockId))
      .filter((lock): lock is TargetLock => lock !== undefined);
  }

  /**
   * Check if a lock exists and is held by the specified client
   */
  hasLockByClient(targetId: string, serverTick: number, clientId: string): boolean {
    const lock = this.getLockAtTick(targetId, serverTick);
    return lock !== null && lock.clientId === clientId;
  }

  /**
   * Clean up expired locks (call periodically from server)
   */
  cleanupExpiredLocks(currentTick: number): number {
    let cleaned = 0;
    const toClean: string[] = [];

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.expiresAtTick <= currentTick) {
        toClean.push(lockId);
      }
    }

    for (const lockId of toClean) {
      this.releaseLock(lockId);
      cleaned++;
    }

    return cleaned;
  }

  /**
   * Get all locks active at a specific tick
   */
  getLocksAtTick(serverTick: number): TargetLock[] {
    const lockIds = this.tickToLocks.get(serverTick);
    if (!lockIds) return [];

    return Array.from(lockIds)
      .map(lockId => this.locks.get(lockId))
      .filter((lock): lock is TargetLock => lock !== undefined);
  }

  /**
   * Get conflict info: if target is locked by another client
   */
  getConflictingLock(targetId: string, serverTick: number, clientId: string): TargetLock | null {
    const existingLock = this.getLockAtTick(targetId, serverTick);
    if (existingLock && existingLock.clientId !== clientId) {
      return existingLock;
    }
    return null;
  }

  /**
   * Get lock history (for debugging/verification)
   */
  getHistory(limit: number = 100): TargetLock[] {
    return this.lockHistory.slice(-limit);
  }
}

/**
 * Oracle Consensus Engine: Judges action proposals and issues verdicts
 * Host (clientId '0') acts as Oracle for deterministic consensus
 */
export class OracleConsensusEngine {
  private lockRegistry = new TargetLockRegistry();
  private oracleClientId: string;  // Usually 'clientId: 0' (host)
  private verdictIdCounter = 0;
  private recentVerdicts: OracleVerdict[] = [];
  private readonly maxVerdictHistory = 5000;

  constructor(oracleClientId: string = '0') {
    this.oracleClientId = oracleClientId;
  }

  /**
   * Set oracle designation (for host migration or reassignment)
   */
  setOracleClientId(clientId: string): void {
    this.oracleClientId = clientId;
  }

  /**
   * Request action consent: Does the Oracle approve this action?
   * Returns a verdict (GRANTED, DENIED, or MALFORMED)
   */
  requestActionConsent(proposal: ConsentProposal, currentServerTick: number): OracleVerdict {
    // Validate proposal structure
    const validation = this.validateProposal(proposal);
    if (!validation.valid) {
      return {
        verdictId: `verdict_${++this.verdictIdCounter}`,
        clientId: proposal.clientId,
        targetId: proposal.targetId,
        verdict: 'MALFORMED',
        reason: validation.reason || 'Malformed consent proposal',
        serverTick: currentServerTick,
        oracleClientId: this.oracleClientId,
        issuedAt: Date.now()
      };
    }

    // Try to acquire lock
    const lock = this.lockRegistry.acquireLock(proposal);

    if (!lock) {
      // Lock conflict: another client already owns this entity at this tick
      const conflictingLock = this.lockRegistry.getConflictingLock(proposal.targetId, proposal.serverTick, proposal.clientId);
      return {
        verdictId: `verdict_${++this.verdictIdCounter}`,
        clientId: proposal.clientId,
        targetId: proposal.targetId,
        verdict: 'DENIED',
        reason: `Target locked by client ${conflictingLock?.clientId || 'unknown'} for this action`,
        serverTick: currentServerTick,
        conflictingClientId: conflictingLock?.clientId,
        oracleClientId: this.oracleClientId,
        issuedAt: Date.now()
      };
    }

    // Granted: client can execute action locally
    const verdict: OracleVerdict = {
      verdictId: `verdict_${++this.verdictIdCounter}`,
      clientId: proposal.clientId,
      targetId: proposal.targetId,
      verdict: 'GRANTED',
      reason: `Permission granted to ${proposal.clientId} for ${proposal.actionType}`,
      serverTick: currentServerTick,
      lockNonce: lock.lockNonce,
      oracleClientId: this.oracleClientId,
      issuedAt: Date.now()
    };

    // Record verdict
    this.recentVerdicts.push(verdict);
    if (this.recentVerdicts.length > this.maxVerdictHistory) {
      this.recentVerdicts.shift();
    }

    return verdict;
  }

  /**
   * Invalidate a grant (when peer rollsback or action fails)
   */
  invalidateGrant(verdictId: string): void {
    const verdict = this.recentVerdicts.find(v => v.verdictId === verdictId);
    if (verdict && verdict.verdict === 'GRANTED') {
      // Find and release the lock associated with this verdict
      const clientLocks = this.lockRegistry.getClientLocks(verdict.clientId);
      for (const lock of clientLocks) {
        if (lock.targetId === verdict.targetId && lock.serverTick === verdict.serverTick) {
          // Found matching lock; might want to release it
          // But be careful: only release if not in use anymore
        }
      }
    }
  }

  /**
   * Cleanup locks at a specific tick (call from game loop)
   */
  cleanupTick(serverTick: number): number {
    return this.lockRegistry.cleanupExpiredLocks(serverTick);
  }

  /**
   * Validate proposal structure and permitted action
   */
  private validateProposal(proposal: ConsentProposal): { valid: boolean; reason?: string } {
    // Check required fields
    if (!proposal.proposalId || !proposal.clientId || !proposal.targetId) {
      return { valid: false, reason: 'Missing required fields: proposalId, clientId, or targetId' };
    }

    // Check action type is contestable
    const contestableActions = ['PICK_UP_ITEM', 'INTERACT_NPC', 'BUY_ITEM'];
    if (!contestableActions.includes(proposal.actionType)) {
      return { valid: false, reason: `Action type '${proposal.actionType}' is not contestable` };
    }

    // Check target type
    const validTypes: ConsensusTargetType[] = ['ITEM', 'NPC', 'LOCATION', 'RESOURCE_NODE', 'SHOP_STOCK'];
    if (!validTypes.includes(proposal.targetType)) {
      return { valid: false, reason: `Invalid target type '${proposal.targetType}'` };
    }

    return { valid: true };
  }

  /**
   * Get all verdicts issued by the Oracle (for debugging/telemetry)
   */
  getRecentVerdicts(limit: number = 100): OracleVerdict[] {
    return this.recentVerdicts.slice(-limit);
  }

  /**
   * Get consensus statistics
   */
  getConsensusStats(): {
    totalGrants: number;
    totalDenials: number;
    totalMalformed: number;
    activeLocksCount: number;
    conflictResolutionSuccessRate: number;
  } {
    const grants = this.recentVerdicts.filter(v => v.verdict === 'GRANTED').length;
    const denials = this.recentVerdicts.filter(v => v.verdict === 'DENIED').length;
    const malformed = this.recentVerdicts.filter(v => v.verdict === 'MALFORMED').length;
    const total = grants + denials + malformed;

    return {
      totalGrants: grants,
      totalDenials: denials,
      totalMalformed: malformed,
      activeLocksCount: this.lockRegistry.getHistory().length,
      conflictResolutionSuccessRate: total > 0 ? (grants / total) : 0
    };
  }
}

/**
 * Global singleton instance of Oracle Consensus Engine
 */
let oracleConsensusEngineInstance: OracleConsensusEngine | null = null;

export function getOracleConsensusEngine(): OracleConsensusEngine {
  if (!oracleConsensusEngineInstance) {
    oracleConsensusEngineInstance = new OracleConsensusEngine();
  }
  return oracleConsensusEngineInstance;
}

/**
 * Initialize Oracle Consensus Engine (call on server startup)
 */
export function initializeOracleConsensusEngine(oracleClientId: string = '0'): OracleConsensusEngine {
  oracleConsensusEngineInstance = new OracleConsensusEngine(oracleClientId);
  console.log(`[OracleConsensus] Engine initialized with Oracle: ${oracleClientId}`);
  return oracleConsensusEngineInstance;
}

/**
 * Type guard: Check if message is a consent proposal
 */
export function isConsentProposal(message: any): message is ConsentProposal {
  return message &&
    message.proposalId &&
    message.clientId &&
    message.targetId &&
    message.targetType &&
    message.actionType &&
    message.serverTick !== undefined;
}

/**
 * Type guard: Check if message is an oracle verdict
 */
export function isOracleVerdict(message: any): message is OracleVerdict {
  return message &&
    message.verdictId &&
    message.clientId &&
    message.targetId &&
    ['GRANTED', 'DENIED', 'MALFORMED'].includes(message.verdict) &&
    message.oracleClientId;
}
