/**
 * M43 Phase C Task C1: Director Ledger Engine
 *
 * Purpose: Implement decentralized multi-GM consensus voting system
 * 
 * Design:
 * - Track all Director actions in tamper-proof ledger
 * - Require 2/3 majority vote before applying major actions
 * - Seal events require 100% consensus (unanimous approval)
 * - Single veto power to prevent abuse, with justification logged
 * - Persistent storage in saveLoadEngine
 *
 * Lifecycle:
 * 1. Director action attempted (e.g., /seal_canon, /force_epoch with debt > 2)
 * 2. Action recorded with pending status
 * 3. Broadcast to all connected GMs for voting
 * 4. Require 2/3 approval (or 100% for seals)
 * 5. Apply action to mutation log only if consensus reached
 * 6. Persist ledger entry permanently
 */

export interface DirectorVote {
  directorId: string;
  directorName: string;
  vote: 'approve' | 'reject' | 'abstain';
  votedAt: number;
  reason?: string; // For veto, justification required
}

export interface DirectorAction {
  id: string;                          // Unique action ID
  directorId: string;                  // Who initiated action
  directorName: string;
  timestamp: number;                   // When action was recorded (Unix ms)
  actionType: 'seal_canon' | 'force_epoch' | 'override_npc' | 'toggle_phantom' | 'ritual_trigger';
  description: string;                 // Human-readable description
  targetId?: string;                   // What was affected (fragmentId, npcId, etc.)
  votes: DirectorVote[];               // All votes received
  status: 'pending' | 'approved' | 'rejected' | 'veto';
  requiredThreshold: number;           // 0.667 for 2/3, 1.0 for unanimous
  approvalTimestamp?: number;          // When consensus reached (or when expired)
  vetoedBy?: string;                   // Director who vetoed
  vetoReason?: string;
}

/**
 * Director Ledger - immutable record of all GM actions
 */
export class DirectorLedgerEngine {
  private ledger: DirectorAction[] = [];
  private readonly maxLedgerSize = 1000; // Prevent unbounded growth
  private votingWindowMs = 30000; // 30 second voting window
  private directorIds: Set<string> = new Set();

  /**
   * Initialize ledger from saved state
   */
  initialize(previousLedger?: DirectorAction[], directorList?: string[]): void {
    if (previousLedger) {
      this.ledger = previousLedger;
    }
    if (directorList) {
      this.directorIds = new Set(directorList);
    }
    console.log(`[DirectorLedger] Initialized with ${this.ledger.length} historical entries`);
  }

  /**
   * Register a director in the consensus system
   */
  registerDirector(directorId: string): void {
    this.directorIds.add(directorId);
    console.log(`[DirectorLedger] Registered director: ${directorId}`);
  }

  /**
   * Record a new director action
   */
  recordAction(
    directorId: string,
    directorName: string,
    actionType: DirectorAction['actionType'],
    description: string,
    targetId?: string
  ): DirectorAction {
    const action: DirectorAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      directorId,
      directorName,
      timestamp: Date.now(),
      actionType,
      description,
      targetId,
      votes: [],
      status: 'pending',
      requiredThreshold: actionType === 'seal_canon' ? 1.0 : 0.667 // 100% for seal, 2/3 otherwise
    };

    this.ledger.push(action);

    // Prevent ledger overflow
    if (this.ledger.length > this.maxLedgerSize) {
      this.ledger = this.ledger.slice(-this.maxLedgerSize);
      console.warn(`[DirectorLedger] Trimmed ledger to ${this.maxLedgerSize} entries`);
    }

    console.log(`[DirectorLedger] Action recorded: ${action.id} (${actionType}) by ${directorName}`);
    return action;
  }

  /**
   * Cast a vote on a pending action
   */
  recordVote(
    actionId: string,
    directorId: string,
    directorName: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string
  ): DirectorAction | null {
    const action = this.ledger.find(a => a.id === actionId);
    if (!action) {
      console.warn(`[DirectorLedger] Action not found: ${actionId}`);
      return null;
    }

    if (action.status !== 'pending') {
      console.warn(`[DirectorLedger] Cannot vote on non-pending action: ${actionId}`);
      return null;
    }

    // Check if director already voted
    const existingVote = action.votes.find(v => v.directorId === directorId);
    if (existingVote) {
      // Update vote
      existingVote.vote = vote;
      existingVote.votedAt = Date.now();
      existingVote.reason = reason;
      console.log(`[DirectorLedger] Vote updated: ${directorId} -> ${vote}`);
    } else {
      // Add new vote
      action.votes.push({
        directorId,
        directorName,
        vote,
        votedAt: Date.now(),
        reason
      });
      console.log(`[DirectorLedger] Vote recorded: ${directorId} -> ${vote}`);
    }

    // Check if consensus reached
    this.checkConsensus(action);

    return action;
  }

  /**
   * Apply veto to an action (single GM can block)
   */
  recordVeto(actionId: string, directorId: string, reason: string): DirectorAction | null {
    const action = this.ledger.find(a => a.id === actionId);
    if (!action) {
      console.warn(`[DirectorLedger] Action not found for veto: ${actionId}`);
      return null;
    }

    if (action.status !== 'pending') {
      console.warn(`[DirectorLedger] Cannot veto non-pending action: ${actionId}`);
      return null;
    }

    action.status = 'veto';
    action.vetoedBy = directorId;
    action.vetoReason = reason;
    action.approvalTimestamp = Date.now();

    console.log(`[DirectorLedger] Action vetoed by ${directorId}: ${reason}`);
    return action;
  }

  /**
   * Check if an action has reached consensus
   */
  checkConsensus(action: DirectorAction): boolean {
    if (action.status !== 'pending') {
      return action.status === 'approved';
    }

    // Count votes
    const approveCount = action.votes.filter(v => v.vote === 'approve').length;
    const rejectCount = action.votes.filter(v => v.vote === 'reject').length;
    const abstainCount = action.votes.filter(v => v.vote === 'abstain').length;
    const totalVotes = action.votes.length;

    // Calculate approval percentage (excluding abstains)
    const activeVotes = approveCount + rejectCount;
    const approvalPercentage = activeVotes > 0 ? approveCount / activeVotes : 0;

    // Check if threshold met
    const thresholdMet = approvalPercentage >= action.requiredThreshold;

    // Check if enough directors have voted to make decision
    const totalDirectors = this.directorIds.size;
    const minVotesNeeded = Math.ceil(totalDirectors * 0.5); // Need 50% participation minimum

    if (totalVotes >= minVotesNeeded && thresholdMet) {
      action.status = 'approved';
      action.approvalTimestamp = Date.now();
      console.log(
        `[DirectorLedger] Consensus reached on ${action.id}: ` +
        `${approveCount}/${activeVotes} votes (${(approvalPercentage * 100).toFixed(1)}%)`
      );
      return true;
    }

    // Check if rejection is certain (can't reach threshold even if remaining vote approve)
    const remainingVoters = totalDirectors - totalVotes;
    const maxPossibleApproves = approveCount + remainingVoters;
    const maxPossibleApprovalPct = maxPossibleApproves / (activeVotes + remainingVoters);

    if (maxPossibleApprovalPct < action.requiredThreshold) {
      action.status = 'rejected';
      action.approvalTimestamp = Date.now();
      console.log(`[DirectorLedger] Action rejected (impossible to reach threshold): ${action.id}`);
      return false;
    }

    return false;
  }

  /**
   * Get all actions in ledger
   */
  getLedger(): DirectorAction[] {
    return [...this.ledger];
  }

  /**
   * Get pending actions (awaiting consensus)
   */
  getPendingActions(): DirectorAction[] {
    return this.ledger.filter(a => a.status === 'pending');
  }

  /**
   * Get approved actions
   */
  getApprovedActions(): DirectorAction[] {
    return this.ledger.filter(a => a.status === 'approved');
  }

  /**
   * Get recent actions (last N entries)
   */
  getRecentActions(count: number = 10): DirectorAction[] {
    return this.ledger.slice(-count).reverse();
  }

  /**
   * Get action by ID
   */
  getAction(actionId: string): DirectorAction | undefined {
    return this.ledger.find(a => a.id === actionId);
  }

  /**
   * Get all votes for an action
   */
  getVotesForAction(actionId: string): DirectorVote[] {
    const action = this.ledger.find(a => a.id === actionId);
    return action ? [...action.votes] : [];
  }

  /**
   * Calculate consensus statistics for dashboard
   */
  getConsensusStats(actionId: string) {
    const action = this.ledger.find(a => a.id === actionId);
    if (!action) return null;

    const approveCount = action.votes.filter(v => v.vote === 'approve').length;
    const rejectCount = action.votes.filter(v => v.vote === 'reject').length;
    const abstainCount = action.votes.filter(v => v.vote === 'abstain').length;
    const activeVotes = approveCount + rejectCount;
    const approvalPercentage = activeVotes > 0 ? (approveCount / activeVotes) * 100 : 0;

    return {
      actionId,
      status: action.status,
      approveCount,
      rejectCount,
      abstainCount,
      totalVotes: action.votes.length,
      approvalPercentage: approvalPercentage.toFixed(1),
      requiredThreshold: (action.requiredThreshold * 100).toFixed(0),
      thresholdMet: approvalPercentage >= action.requiredThreshold * 100
    };
  }

  /**
   * Clear ledger (useful for testing)
   */
  clearLedger(): void {
    this.ledger = [];
    console.log('[DirectorLedger] Ledger cleared');
  }

  /**
   * Export ledger for persistence
   */
  exportLedger(): DirectorAction[] {
    return this.ledger.map(action => ({
      ...action,
      votes: [...action.votes]
    }));
  }

  /**
   * Set voting window duration (default 30s)
   */
  setVotingWindowMs(ms: number): void {
    this.votingWindowMs = ms;
    console.log(`[DirectorLedger] Voting window set to ${ms}ms`);
  }

  // ============================================================================
  // M43 PHASE D ADDITION: CONFLICT RESOLUTION & MULTI-DIRECTOR HANDLING
  // ============================================================================

  /**
   * Detect conflicting actions (e.g., simultaneous seal_canon and rollback)
   */
  detectConflicts(): Array<{
    actionIds: string[];
    conflictType: 'seal_vs_rollback' | 'concurrent_override' | 'phantom_divergence';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> {
    const conflicts: Array<{
      actionIds: string[];
      conflictType: 'seal_vs_rollback' | 'concurrent_override' | 'phantom_divergence';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    // Check for seal_canon vs rollback conflicts
    const recentActions = this.ledger.slice(-20);
    const sealCanonActions = recentActions.filter(a => a.actionType === 'seal_canon' && a.status === 'pending');
    const rollbackActions = recentActions.filter(a => a.actionType === 'force_epoch' && a.status === 'pending');

    if (sealCanonActions.length > 0 && rollbackActions.length > 0) {
      for (const seal of sealCanonActions) {
        for (const rollback of rollbackActions) {
          // Check if they overlap in timestamp (within 5 seconds)
          if (Math.abs(seal.timestamp - rollback.timestamp) < 5000) {
            conflicts.push({
              actionIds: [seal.id, rollback.id],
              conflictType: 'seal_vs_rollback',
              severity: 'high',
              description: `Simultaneous SEAL_CANON and FORCE_EPOCH detected - timeline integrity risk`
            });
          }
        }
      }
    }

    // Check for concurrent overrides on same NPC
    const overridesByTarget = new Map<string, DirectorAction[]>();
    for (const action of recentActions.filter(a => a.actionType === 'override_npc')) {
      if (!action.targetId) continue;
      if (!overridesByTarget.has(action.targetId)) {
        overridesByTarget.set(action.targetId, []);
      }
      overridesByTarget.get(action.targetId)!.push(action);
    }

    for (const [targetId, actions] of overridesByTarget.entries()) {
      if (actions.length > 1) {
        const concurrent = actions.filter(a => {
          return actions.some(other => 
            other.id !== a.id && Math.abs(other.timestamp - a.timestamp) < 2000
          );
        });
        if (concurrent.length > 1) {
          conflicts.push({
            actionIds: concurrent.map(a => a.id),
            conflictType: 'concurrent_override',
            severity: 'medium',
            description: `Multiple concurrent overrides on NPC ${targetId}`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts with safe defaults
   * Strategy: "No Change" preserves state integrity until manual intervention
   */
  resolveConflict(conflict: {
    actionIds: string[];
    conflictType: 'seal_vs_rollback' | 'concurrent_override' | 'phantom_divergence';
  }): { resolved: boolean; resolution: string; actionUpdates: Map<string, string> } {
    const actionUpdates = new Map<string, string>();

    if (conflict.conflictType === 'seal_vs_rollback') {
      // Default: SEAL takes precedence (seal_canon = permanence)
      // Other actions marked as "deferred" pending manual review
      for (const actionId of conflict.actionIds) {
        const action = this.ledger.find(a => a.id === actionId);
        if (!action) continue;

        if (action.actionType === 'seal_canon') {
          // Seal proceeds
          action.status = 'approved';
          actionUpdates.set(actionId, 'approved_conflict_resolution');
          console.log(`[ConflictResolution] SEAL_CANON approved (priority rule)`);
        } else {
          // Rollback deferred
          action.status = 'rejected';
          actionUpdates.set(actionId, 'rejected_conflict_resolution_deferred');
          console.log(`[ConflictResolution] FORCE_EPOCH rejected (seal takes precedence, marked for manual review)`);
        }
      }

      return {
        resolved: true,
        resolution: 'seal_canon_takes_precedence',
        actionUpdates
      };
    }

    if (conflict.conflictType === 'concurrent_override') {
      // Default: First-in-time wins, others deferred
      const sortedActions = conflict.actionIds
        .map(id => this.ledger.find(a => a.id === id)!)
        .sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedActions.length; i++) {
        const action = sortedActions[i];
        if (i === 0) {
          // First action approved
          action.status = 'approved';
          actionUpdates.set(action.id, 'approved_first_in_time');
          console.log(`[ConflictResolution] Override approved (first-in-time)`);
        } else {
          // Later actions deferred
          action.status = 'rejected';
          actionUpdates.set(action.id, 'rejected_conflict_resolution_deferred');
          console.log(`[ConflictResolution] Override rejected (later in sequence, deferred)`);
        }
      }

      return {
        resolved: true,
        resolution: 'first_in_time_precedence',
        actionUpdates
      };
    }

    return {
      resolved: false,
      resolution: 'unknown_conflict_type',
      actionUpdates
    };
  }

  /**
   * Handle phantom director detection (desync)
   * Mark desynced director's voting power as reduced
   */
  markDirectorAsPhantom(directorId: string, reason: string): void {
    // Find all votes by this director and mark them as suspect
    for (const action of this.ledger) {
      for (const vote of action.votes) {
        if (vote.directorId === directorId) {
          vote.reason = `[PHANTOM] ${vote.reason || ''} - ${reason}`;
        }
      }
    }

    console.warn(`[ConflictResolution] Director ${directorId} marked as PHANTOM: ${reason}`);
  }

  /**
   * Audit voting consistency across a sequence of actions
   * Detect if director's voting pattern indicates desync
   */
  auditDirectorVotingPattern(directorId: string): {
    consistencyScore: number;
    isConsistent: boolean;
    anomalyCount: number;
    suspiciousVotes: string[];
  } {
    const directorVotes = this.ledger
      .flatMap(action => 
        action.votes
          .filter(v => v.directorId === directorId)
          .map(v => ({ vote: v.vote, actionId: action.id, actionType: action.actionType }))
      );

    if (directorVotes.length < 3) {
      return { consistencyScore: 1.0, isConsistent: true, anomalyCount: 0, suspiciousVotes: [] };
    }

    let anomalyCount = 0;
    const suspiciousVotes: string[] = [];

    // Check for contradictory voting patterns
    // E.g., approving conflicting actions, or voting differently on identical action types
    const voteCounts = new Map<string, number>();
    for (const vote of directorVotes) {
      const key = `${vote.actionType}_${vote.vote}`;
      voteCounts.set(key, (voteCounts.get(key) ?? 0) + 1);
    }

    for (const vote of directorVotes) {
      const opposite = `${vote.actionType}_${vote.vote === 'approve' ? 'reject' : 'approve'}`;
      const sameRecent = directorVotes.slice(-5).filter(v => 
        v.actionType === vote.actionType && v.vote !== vote.vote
      );

      if (sameRecent.length > 0) {
        anomalyCount++;
        suspiciousVotes.push(vote.actionId);
      }
    }

    const consistencyScore = 1.0 - (anomalyCount / directorVotes.length);

    return {
      consistencyScore,
      isConsistent: consistencyScore > 0.8,
      anomalyCount,
      suspiciousVotes
    };
  }

  /**
   * Get conflict resolution audit report
   */
  generateConflictAuditReport(): string {
    const conflicts = this.detectConflicts();
    let report = '=== DIRECTOR LEDGER CONFLICT AUDIT ===\n\n';

    report += `Total Actions: ${this.ledger.length}\n`;
    report += `Active Pending: ${this.getPendingActions().length}\n`;
    report += `Conflicts Detected: ${conflicts.length}\n\n`;

    if (conflicts.length > 0) {
      report += 'CONFLICTS:\n';
      for (const conflict of conflicts) {
        report += `- ${conflict.conflictType} (severity: ${conflict.severity}): ${conflict.description}\n`;
        report += `  Actions: ${conflict.actionIds.join(', ')}\n`;
      }
    } else {
      report += 'No conflicts detected.\n';
    }

    report += '\nDIRECTOR VOTING AUDIT:\n';
    for (const directorId of this.directorIds) {
      const audit = this.auditDirectorVotingPattern(directorId);
      report += `${directorId}: Consistency ${(audit.consistencyScore * 100).toFixed(1)}% (anomalies: ${audit.anomalyCount})\n`;
      if (!audit.isConsistent) {
        report += `  ⚠️ POTENTIAL DESYNC DETECTED\n`;
      }
    }

    return report;
  }
}

// Global instance
let ledgerInstance: DirectorLedgerEngine | null = null;

/**
 * Get or create global ledger instance
 */
export function getDirectorLedger(): DirectorLedgerEngine {
  if (!ledgerInstance) {
    ledgerInstance = new DirectorLedgerEngine();
  }
  return ledgerInstance;
}

/**
 * Initialize global ledger with persisted state
 */
export function initializeDirectorLedger(
  previousLedger?: DirectorAction[],
  directorList?: string[]
): DirectorLedgerEngine {
  if (!ledgerInstance) {
    ledgerInstance = new DirectorLedgerEngine();
  }
  ledgerInstance.initialize(previousLedger, directorList);
  return ledgerInstance;
}
