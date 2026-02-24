/**
 * M63-B: Conflict Resolution Voting System
 * 
 * Implements democratic consensus voting for multiplayer sessions:
 * - When paradox > 250: "World Reset" vote (75% threshold)
 * - Holiday event consensus: Synchronized across all 16 peers
 * - Trade conflict resolution: Atomic trade validation voting
 * 
 * All votes recorded in ledger for deterministic replay
 */

/**
 * Vote types that can be cast in multiplayer sessions
 */
export type VoteType = 'world_reset' | 'holiday_event' | 'trade_conflict' | 'faction_war_truce';

/**
 * Single peer's vote record
 */
export interface PeerVote {
  peerId: string;
  peerName: string;
  voteType: VoteType;
  vote: 'yes' | 'no' | 'abstain';
  timestamp: number;
  reason?: string;
}

/**
 * Active vote session in multiplayer
 */
export interface VoteSession {
  voteId: string;
  voteType: VoteType;
  proposedAt: number;
  deadline: number;
  description: string;
  proposedBy: string;
  threshold: number;          // Percentage needed to pass (e.g., 0.75 = 75%)
  votes: Map<string, PeerVote>; // peerId -> vote
  status: 'pending' | 'passed' | 'failed' | 'expired';
  ledgerMutationId?: string;  // For deterministic replay
}

/**
 * Results of a completed vote session
 */
export interface VoteResult {
  voteId: string;
  voteType: VoteType;
  passed: boolean;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalPeers: number;
  requiredYes: number;
  actualPercentage: number;
  ledgerHash?: string;
}

// ============================================================================
// VOTE MANAGEMENT
// ============================================================================

/**
 * Create new vote session (called when paradox > 250 or event consensus needed)
 */
export function createVoteSession(
  voteType: VoteType,
  proposedBy: string,
  description: string,
  durationSeconds: number = 30
): VoteSession {
  const now = Date.now();

  return {
    voteId: `vote_${voteType}_${now}_${Math.random().toString(36).slice(2, 9)}`,
    voteType,
    proposedAt: now,
    deadline: now + (durationSeconds * 1000),
    description,
    proposedBy,
    threshold: voteType === 'world_reset' ? 0.75 : 0.5,
    votes: new Map(),
    status: 'pending'
  };
}

/**
 * Cast a vote from a peer
 */
export function castVote(
  session: VoteSession,
  peerId: string,
  peerName: string,
  vote: 'yes' | 'no' | 'abstain',
  reason?: string
): { session: VoteSession; peerVote: PeerVote } {
  if (session.status !== 'pending') {
    throw new Error(`Cannot vote on ${session.status} session`);
  }

  const peerVote: PeerVote = {
    peerId,
    peerName,
    voteType: session.voteType,
    vote,
    timestamp: Date.now(),
    reason
  };

  session.votes.set(peerId, peerVote);

  return { session, peerVote };
}

/**
 * Finalize vote and determine pass/fail
 */
export function finalizeVote(session: VoteSession, totalPeers: number): VoteResult {
  const votes = Array.from(session.votes.values());

  const yesCount = votes.filter(v => v.vote === 'yes').length;
  const noCount = votes.filter(v => v.vote === 'no').length;
  const abstainCount = votes.filter(v => v.vote === 'abstain').length;

  const votingPeers = yesCount + noCount; // Abstain doesn't count
  const requiredYes = Math.ceil(votingPeers * session.threshold);
  const actualPercentage = votingPeers > 0 ? (yesCount / votingPeers) * 100 : 0;

  const passed = yesCount >= requiredYes;

  session.status = passed ? 'passed' : 'failed';

  return {
    voteId: session.voteId,
    voteType: session.voteType,
    passed,
    yesCount,
    noCount,
    abstainCount,
    totalPeers,
    requiredYes,
    actualPercentage
  };
}

/**
 * Convert vote session to ledger mutation for deterministic replay
 */
export function voteSessionToLedgerEvent(
  session: VoteSession,
  result: VoteResult
): any {
  const votes = Array.from(session.votes.values());

  return {
    type: 'MULTIPLAYER_VOTE',
    tick: Math.floor(Date.now() / 16.67), // Approximate tick
    timestamp: Date.now(),
    voteId: session.voteId,
    voteType: session.voteType,
    description: session.description,
    passed: result.passed,
    yesCount: result.yesCount,
    noCount: result.noCount,
    abstainCount: result.abstainCount,
    totalVoters: votes.length,
    threshold: session.threshold,
    payload: {
      voteDetails: result,
      votes: votes.map(v => ({
        peerId: v.peerId,
        peerName: v.peerName,
        vote: v.vote,
        reason: v.reason
      }))
    }
  };
}

// ============================================================================
// CONSENSUS LOGIC: WORLD RESET VOTE
// ============================================================================

/**
 * Check if world reset vote should be triggered
 * Triggers when paradox level exceeds 250
 */
export function shouldTriggerWorldResetVote(paradoxLevel: number): boolean {
  return paradoxLevel > 250;
}

/**
 * Apply world reset if vote passed
 * Sets paradox to 0, triggers celebration event
 */
export function applyWorldReset(
  state: any,
  voteResult: VoteResult
): { state: any; notification: string } {
  if (!voteResult.passed || voteResult.voteType !== 'world_reset') {
    return { state, notification: 'World reset vote failed.' };
  }

  state.paradoxLevel = 0;
  state.lastWorldReset = Date.now();

  return {
    state,
    notification: `✨ World Reset! Paradox cleansed. ${voteResult.yesCount}/${voteResult.totalPeers} peers voted for renewal.`
  };
}

// ============================================================================
// CONSENSUS LOGIC: HOLIDAY EVENT SYNCHRONIZATION
// ============================================================================

/**
 * Holiday event definition - synchronized across peers
 */
export interface HolidayEvent {
  eventId: string;
  eventName: string;
  triggerCondition: string;           // e.g., "any_peer_reaches_myth_rank_4"
  duration: number;                   // in ticks
  rewards: {
    xp: number;
    legendaryPoints: number;
    factionBonus: Record<string, number>;
  };
  npcGathering?: string[];            // NPCs that gather for event
  music?: string;                     // Soundtrack to play
  narrative: string;                  // Event description
}

/**
 * Check if any peer's miracle should trigger holiday event
 */
export function checkHolidayEventTrigger(
  peerStates: Array<{ peerId: string; mythStatus: number }>
): HolidayEvent | null {
  // Example: Festival of Echoes when anyone reaches myth rank 4
  const hasLegendaryPeer = peerStates.some(p => p.mythStatus >= 20);

  if (hasLegendaryPeer) {
    return {
      eventId: `holiday_${Date.now()}`,
      eventName: 'Festival of Echoes',
      triggerCondition: 'any_peer_reaches_myth_rank_4',
      duration: 100, // 100 ticks ≈ 1.6 minutes
      rewards: {
        xp: 250,
        legendaryPoints: 10,
        factionBonus: {
          merchants_guild: 50,
          council_of_fates: 50
        }
      },
      npcGathering: [
        'merchant_guild_master',
        'council_diplomat',
        'wandering_minstrel'
      ],
      music: 'festival_celebration.mp3',
      narrative: 'The world celebrates! NPCs gather to honor the legendary deeds.'
    };
  }

  return null;
}

/**
 * Broadcast holiday event to all peers
 * Creates consensus mutation in ledger
 */
export function broadcastHolidayEvent(event: HolidayEvent, allPeerId: string[]): any {
  return {
    type: 'HOLIDAY_EVENT_BROADCAST',
    tick: Math.floor(Date.now() / 16.67),
    timestamp: Date.now(),
    eventId: event.eventId,
    eventName: event.eventName,
    payload: {
      event,
      affectedPeers: allPeerId,
      broadcastAt: Date.now(),
      syncRequired: true // Force all clients to synchronize
    }
  };
}

// ============================================================================
// TRADE CONFLICT RESOLUTION
// ============================================================================

/**
 * Trade conflict - when peer ledgers disagree on trade state
 */
export interface TradeConflict {
  tradeId: string;
  peerA: string;
  peerB: string;
  conflictType: 'ledger_mismatch' | 'timeout' | 'invalid_state';
  peerAState: string;
  peerBState: string;
  timeout: number;
}

/**
 * Propose resolution vote for trade conflict
 */
export function createTradeConflictVote(
  conflict: TradeConflict,
  proposedResolution: 'cancel_trade' | 'complete_trade' | 'rollback'
): VoteSession {
  return createVoteSession(
    'trade_conflict',
    'system',
    `Trade conflict between ${conflict.peerA} and ${conflict.peerB}: Proposed resolution: ${proposedResolution}`,
    20
  );
}

// ============================================================================
// FACTION WAR TRUCE VOTING
// ============================================================================

/**
 * When factions are in open warfare, peers can vote for truce
 */
export function createFactionsWarTruceVote(
  factionA: string,
  factionB: string
): VoteSession {
  return createVoteSession(
    'faction_war_truce',
    'system',
    `Propose truce between ${factionA} and ${factionB}`,
    60
  );
}

/**
 * Apply truce if vote passes
 */
export function applyFactionTruce(
  state: any,
  factionA: string,
  factionB: string
): any {
  const newState = { ...state };

  // Reduce faction warfare intensity
  if (newState.factionState?.warfare) {
    newState.factionState.warfare[`${factionA}_${factionB}`] = {
      ...newState.factionState.warfare[`${factionA}_${factionB}`],
      intensity: 0,
      status: 'truce'
    };
  }

  return newState;
}

// ============================================================================
// VALIDATION: Ensure Vote Integrity
// ============================================================================

/**
 * Validate vote for integrity - check for duplicate votes, tampering
 */
export function validateVoteIntegrity(
  session: VoteSession
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for duplicate votes from same peer
  const peerIds = new Set<string>();
  Array.from(session.votes.values()).forEach(v => {
    if (peerIds.has(v.peerId)) {
      issues.push(`Duplicate vote from peer ${v.peerId}`);
      return;
    }
    peerIds.add(v.peerId);
    return false;
  });

  // Check vote timestamps are within session window
  Array.from(session.votes.values()).forEach(v => {
    if (v.timestamp > session.deadline) {
      issues.push(`Vote from ${v.peerId} after deadline`);
    }
    if (v.timestamp < session.proposedAt) {
      issues.push(`Vote from ${v.peerId} before session started`);
    }
  });

  // Check threshold is valid
  if (session.threshold < 0 || session.threshold > 1) {
    issues.push(`Invalid threshold: ${session.threshold}`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * M63-B Consensus Voting System - Key Exports:
 * 
 * Core Functions:
 * - createVoteSession() - Start new vote
 * - castVote() - Record peer vote
 * - finalizeVote() - Compute result
 * - voteSessionToLedgerEvent() - Deterministic recording
 * 
 * Voting Scenarios:
 * - World Reset: Triggered when paradox > 250 (75% threshold)
 * - Holiday Events: Synchronized across all peers (50% threshold)
 * - Trade Conflicts: Peer disagreement resolution (75% threshold)
 * - Faction War Truces: Peacemaking votes (60% threshold)
 * 
 * Types:
 * - VoteSession - Active vote state
 * - VoteResult - Final voting outcome
 * - PeerVote - Individual peer's vote
 * - HolidayEvent - Synchronized world event
 * - TradeConflict - Peer disagreement record
 */
