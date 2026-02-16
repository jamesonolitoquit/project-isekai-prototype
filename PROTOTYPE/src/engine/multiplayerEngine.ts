/**
 * Multiplayer Engine — Milestone 32, Task 1
 *
 * Purpose: Enable multi-player session coordination by tracking multiple players in the same
 * WorldState and maintaining real-time awareness of peer presence, locations, and focus.
 *
 * Key Concepts:
 * - SessionRegistry: Central tracking of all connected players in a session
 * - PeerPresence: Real-time awareness of other players (location, status, intentions)
 * - Session State: Aggregate state of all players, used for consensus mechanics
 * - Peer Discovery: Detect when new players join or disconnect
 *
 * M35 Extensions:
 * - Director/Seer Role: Narrative intervention and event curation
 * - Whisper Logic: Send AI-formatted advice to players
 * - Event Curation: Force-trigger world events for exploration nudging
 *
 * Usage:
 *   const registry = createSessionRegistry('world-123');
 *   registry.addPeer(playerState1, 'client-1');
 *   registry.addPeer(playerState2, 'client-2');
 *   const presence = registry.getPeerPresence('client-1');
 */

import type { WorldState, PlayerState } from './worldEngine';

/**
 * M37 Task 4: Trade state for peer-to-peer inventory exchange
 */
export interface TradeState {
  tradeId: string;
  initiatorClientId: string;           // Who started the trade
  responderClientId: string;           // Other party
  stage: 'proposed' | 'offered' | 'committed' | 'completed' | 'cancelled';
  initiatorItems: Array<{ itemId: string; quantity: number }>;  // Items to send
  responderItems: Array<{ itemId: string; quantity: number }>; // Items to receive
  initiatorConfirmed: boolean;         // Initiator locked in offer
  responderConfirmed: boolean;         // Responder locked in offer
  createdAt: number;
  expiresAt: number;                   // Trade proposal times out
  commitmentTick?: number;             // When both confirmed (atomic swap point)
  completedAt?: number;
}

/**
 * Real-time awareness of a connected peer
 */
export interface PeerPresence {
  clientId: string;
  playerId: string;
  playerName: string;
  status: 'active' | 'idle' | 'casting' | 'dialog' | 'dead' | 'disconnected' | 'trading';
  currentLocationId: string;
  focusNpcId?: string;                 // NPC they're currently interacting with
  lastActivityTick: number;            // Last action tick timestamp
  isSpectating: boolean;               // True if watching, not playing
  diceRollInProgress?: {
    rollType: string;
    difficulty: number;
    reason: string;
  };
  activeTrade?: TradeState;            // Currently active trade (if any)
}

/**
 * Aggregate session configuration
 */
export interface SessionConfig {
  sessionId: string;
  worldId: string;
  maxPlayers: number;
  consensusRequired: 'any' | 'majority' | 'unanimous';
  pvpEnabled: boolean;
  sharedLoot: boolean;
  sharedReputation: boolean;
  createdAt: number;
}

/**
 * Multiplayer session registry
 */
export interface SessionRegistry {
  config: SessionConfig;
  peers: Map<string, PeerPresence>;
  activePlayers: string[];            // clientIds of active (non-spectating) players
  spectators: string[];               // clientIds observing the session
  lastSyncTick: number;
  conflictLog: Array<{
    timestamp: number;
    clientA: string;
    clientB: string;
    action: string;
    resolution: 'clientA_wins' | 'clientB_wins' | 'both_fail' | 'merged';
  }>;
}

/**
 * Create a new session registry for a multiplayer world
 */
export function createSessionRegistry(
  worldId: string,
  config?: Partial<SessionConfig>
): SessionRegistry {
  return {
    config: {
      sessionId: `${worldId}_${Date.now()}`,
      worldId,
      maxPlayers: config?.maxPlayers ?? 4,
      consensusRequired: config?.consensusRequired ?? 'majority',
      pvpEnabled: config?.pvpEnabled ?? false,
      sharedLoot: config?.sharedLoot ?? true,
      sharedReputation: config?.sharedReputation ?? true,
      createdAt: Date.now(),
      ...config
    },
    peers: new Map(),
    activePlayers: [],
    spectators: [],
    lastSyncTick: 0,
    conflictLog: []
  };
}

/**
 * Add a new peer to the session
 */
export function addPeerToSession(
  registry: SessionRegistry,
  playerState: PlayerState,
  clientId: string,
  isSpectating: boolean = false
): PeerPresence | null {
  // Check max player capacity
  if (!isSpectating && registry.activePlayers.length >= registry.config.maxPlayers) {
    console.warn(`Session ${registry.config.sessionId} is at max capacity`);
    return null;
  }

  // Prevent duplicate joins
  if (registry.peers.has(clientId)) {
    console.warn(`Client ${clientId} already in session`);
    return null;
  }

  const presence: PeerPresence = {
    clientId,
    playerId: playerState.id,
    playerName: playerState.name || 'Unknown Player',
    status: 'active',
    currentLocationId: playerState.location,
    lastActivityTick: Date.now(),
    isSpectating,
    focusNpcId: undefined
  };

  registry.peers.set(clientId, presence);

  if (isSpectating) {
    registry.spectators.push(clientId);
  } else {
    registry.activePlayers.push(clientId);
  }

  return presence;
}

/**
 * Remove a peer from the session
 */
export function removePeerFromSession(registry: SessionRegistry, clientId: string): boolean {
  const presence = registry.peers.get(clientId);
  if (!presence) return false;

  registry.peers.delete(clientId);
  registry.activePlayers = registry.activePlayers.filter(id => id !== clientId);
  registry.spectators = registry.spectators.filter(id => id !== clientId);

  return true;
}

/**
 * Get presence info for a specific peer
 */
export function getPeerPresence(registry: SessionRegistry, clientId: string): PeerPresence | null {
  return registry.peers.get(clientId) ?? null;
}

/**
 * Get all currently active peer presences
 */
export function getAllActivePeers(registry: SessionRegistry): PeerPresence[] {
  return registry.activePlayers
    .map(clientId => registry.peers.get(clientId))
    .filter((p): p is PeerPresence => p !== undefined);
}

/**
 * Update a peer's presence status
 */
export function updatePeerPresence(
  registry: SessionRegistry,
  clientId: string,
  updates: Partial<PeerPresence>
): PeerPresence | null {
  const presence = registry.peers.get(clientId);
  if (!presence) return null;

  const updated = { ...presence, ...updates, lastActivityTick: Date.now() };
  registry.peers.set(clientId, updated);

  return updated;
}

/**
 * Check if two peers would conflict on an action
 * Returns true if they're targeting the same NPC/item
 */
export function wouldActionsConflict(
  presenceA: PeerPresence,
  presenceB: PeerPresence,
  actionA: { targetNpcId?: string; targetItemId?: string },
  actionB: { targetNpcId?: string; targetItemId?: string }
): boolean {
  // Different locations = no conflict
  if (presenceA.currentLocationId !== presenceB.currentLocationId) return false;

  // Same NPC target = conflict
  if (actionA.targetNpcId && actionB.targetNpcId && actionA.targetNpcId === actionB.targetNpcId) {
    return true;
  }

  // Same item target = conflict
  if (actionA.targetItemId && actionB.targetItemId && actionA.targetItemId === actionB.targetItemId) {
    return true;
  }

  return false;
}

/**
 * Resolve conflicts between simultaneous actions from two clients
 * Returns which client "wins" or if both succeed
 */
export function resolveActionConflict(
  registry: SessionRegistry,
  clientA: string,
  clientB: string,
  actionTypeA: string,
  actionTypeB: string,
  sequenceNumberA: number,
  sequenceNumberB: number
): 'clientA_wins' | 'clientB_wins' | 'both_fail' | 'merged' {
  // First-come-first-served based on sequence number
  if (sequenceNumberA < sequenceNumberB) {
    logConflict(registry, clientA, clientB, `${actionTypeA} vs ${actionTypeB}`, 'clientA_wins');
    return 'clientA_wins';
  } else if (sequenceNumberB < sequenceNumberA) {
    logConflict(registry, clientA, clientB, `${actionTypeA} vs ${actionTypeB}`, 'clientB_wins');
    return 'clientB_wins';
  }

  // Same sequence number = simultaneous
  // Try to merge if possible (e.g., both buffs from different sources)
  if (actionTypeA === actionTypeB && canMergeActions(actionTypeA)) {
    logConflict(registry, clientA, clientB, `${actionTypeA} vs ${actionTypeB}`, 'merged');
    return 'merged';
  }

  // Otherwise, both fail
  logConflict(registry, clientA, clientB, `${actionTypeA} vs ${actionTypeB}`, 'both_fail');
  return 'both_fail';
}

/**
 * Determine if an action type can be merged (stacked)
 */
function canMergeActions(actionType: string): boolean {
  const mergeableActions = ['apply_buff', 'add_reputation', 'gain_experience', 'discover_location'];
  return mergeableActions.includes(actionType);
}

/**
 * Log a conflict resolution for diagnostics
 */
function logConflict(
  registry: SessionRegistry,
  clientA: string,
  clientB: string,
  action: string,
  resolution: 'clientA_wins' | 'clientB_wins' | 'both_fail' | 'merged'
): void {
  registry.conflictLog.push({
    timestamp: Date.now(),
    clientA,
    clientB,
    action,
    resolution
  });

  // Keep log bounded (max 1000 entries)
  if (registry.conflictLog.length > 1000) {
    registry.conflictLog = registry.conflictLog.slice(-1000);
  }
}

/**
 * Check if a session is ready for epoch transition
 * Requires all active players to have confirmed
 */
export interface EpochVoteState {
  votingActive: boolean;
  initiator: string;
  confirmed: Set<string>;           // clientIds that confirmed
  rejected: Set<string>;             // clientIds that rejected
  timestamp: number;
  timeoutMs: number;                 // How long to wait for votes
}

/**
 * Create a new epoch voting session
 */
export function createEpochVote(
  registry: SessionRegistry,
  initiator: string,
  timeoutMs: number = 60000
): EpochVoteState {
  return {
    votingActive: true,
    initiator,
    confirmed: new Set(),
    rejected: new Set(),
    timestamp: Date.now(),
    timeoutMs
  };
}

/**
 * Record a peer's vote on epoch transition
 */
export function recordEpochVote(
  voteState: EpochVoteState,
  clientId: string,
  confirmed: boolean
): void {
  if (confirmed) {
    voteState.confirmed.add(clientId);
    voteState.rejected.delete(clientId);
  } else {
    voteState.rejected.add(clientId);
    voteState.confirmed.delete(clientId);
  }
}

/**
 * Check if epoch vote has reached consensus
 */
export function hasEpochVoteConsensus(
  voteState: EpochVoteState,
  registry: SessionRegistry
): boolean {
  if (!voteState.votingActive) return false;

  const activePlayers = registry.activePlayers;
  const remainingVotes = activePlayers.filter(
    id => !voteState.confirmed.has(id) && !voteState.rejected.has(id)
  );

  // Check timeout
  if (Date.now() - voteState.timestamp > voteState.timeoutMs) {
    voteState.votingActive = false;
    // Timeout = reject transition
    return false;
  }

  // Check consensus type
  if (registry.config.consensusRequired === 'unanimous') {
    return (
      voteState.confirmed.size === activePlayers.length &&
      voteState.rejected.size === 0 &&
      remainingVotes.length === 0
    );
  } else if (registry.config.consensusRequired === 'majority') {
    return voteState.confirmed.size > activePlayers.length / 2;
  } else {
    // 'any' = just needs one confirmation
    return voteState.confirmed.size > 0;
  }
}

/**
 * Get vote summary for UI display
 */
export function getVoteSummary(
  voteState: EpochVoteState,
  registry: SessionRegistry
): { confirmed: number; rejected: number; pending: number; consensus: boolean } {
  const activePlayers = registry.activePlayers.length;
  const consensus = hasEpochVoteConsensus(voteState, registry);

  return {
    confirmed: voteState.confirmed.size,
    rejected: voteState.rejected.size,
    pending: activePlayers - voteState.confirmed.size - voteState.rejected.size,
    consensus
  };
}

/**
 * Broadcast a message to all active players in session
 * Returns list of clientIds that received the message
 */
export function broadcastToActivePeers(
  registry: SessionRegistry,
  message: {
    type: string;
    payload: any;
    priority: 'low' | 'normal' | 'high';
  },
  excludeClientId?: string
): string[] {
  const recipients: string[] = [];

  for (const clientId of registry.activePlayers) {
    if (excludeClientId && clientId === excludeClientId) continue;

    const presence = registry.peers.get(clientId);
    if (presence && presence.status !== 'disconnected') {
      recipients.push(clientId);
    }
  }

  return recipients;
}

/**
 * Get diagnostics/statistics about the session
 */
export interface SessionStats {
  activePeerCount: number;
  spectatorCount: number;
  conflictCount: number;
  avgConflictResolutionTime: number;
  lastSyncAge: number;
  sessionUptime: number;
}

export function getSessionStats(registry: SessionRegistry): SessionStats {
  const now = Date.now();
  const conflictResolutions = registry.conflictLog;

  // Calculate average conflict resolution time (rough estimate)
  let avgResTime = 0;
  if (conflictResolutions.length > 0) {
    const recentConflicts = conflictResolutions.slice(-100);
    const timeDiffs = recentConflicts.map((c, i) => {
      if (i === 0) return 0;
      return recentConflicts[i].timestamp - recentConflicts[i - 1].timestamp;
    });
    avgResTime = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
  }

  return {
    activePeerCount: registry.activePlayers.length,
    spectatorCount: registry.spectators.length,
    conflictCount: registry.conflictLog.length,
    avgConflictResolutionTime: avgResTime,
    lastSyncAge: now - registry.lastSyncTick,
    sessionUptime: now - registry.config.createdAt
  };
}

/**
 * Export session registry state for persistence
 */
export function exportSessionRegistry(registry: SessionRegistry): any {
  return {
    config: registry.config,
    peers: Array.from(registry.peers.entries()),
    activePlayers: registry.activePlayers,
    spectators: registry.spectators,
    lastSyncTick: registry.lastSyncTick,
    conflictLog: registry.conflictLog
  };
}

/**
 * Import persisted session registry state
 */
export function importSessionRegistry(data: any): SessionRegistry {
  const registry: SessionRegistry = {
    config: data.config,
    peers: new Map(data.peers),
    activePlayers: data.activePlayers,
    spectators: data.spectators,
    lastSyncTick: data.lastSyncTick,
    conflictLog: data.conflictLog
  };

  return registry;
}

/**
 * M35: Director/Seer Intervention System
 * 
 * Allows a designated "Seer" (director) to:
 * - Send narrative whispers to players
 * - Curate world events (trigger phantoms, traces)
 * - Nudge exploration without breaking immersion
 */

/**
 * M35: Seer's whisper - narrative guidance from the director
 */
export interface SeerWhisper {
  id: string;
  senderId: string;           // Director/Seer client ID
  recipientId: string;        // Target player client ID
  message: string;            // The whisper text
  whisperType: 'guidance' | 'warning' | 'revelation' | 'mystery';
  timestamp: number;
  narrativeTag: 'SEER_INTERVENTION' | 'ANCESTRAL_MEMORY' | 'TEMPORAL_ECHO';
  authorityLevel: 'suggestion' | 'prophecy' | 'absolute'; // How binding is this?
  expiresAt?: number;         // Optional expiration (auto-dismiss)
}

/**
 * M35: Event curation request from director
 */
export interface EventCurationRequest {
  id: string;
  curatorId: string;          // Director/Seer client ID
  eventType: 'spawn_phantom' | 'spawn_trace' | 'trigger_event' | 'modify_npc';
  targetLocationId: string;   // Where to apply event
  parameters: Record<string, any>; // Event-specific params
  timestamp: number;
  approved: boolean;
  appliedAt?: number;
}

/**
 * M35: Whisper log for session
 */
export interface SessionWhisperLog {
  whispers: Map<string, SeerWhisper[]>; // recipientId -> whispers
  curationRequests: EventCurationRequest[];
  lastCurationTime: number;
}

/**
 * M35: Send a director whisper to a player
 */
export function sendDirectorWhisper(
  registry: SessionRegistry,
  directorClientId: string,
  playerClientId: string,
  message: string,
  whisperType: SeerWhisper['whisperType'] = 'guidance'
): SeerWhisper {
  // Verify director is authorized (must be in spectators or explicitly marked as director)
  const directorPresence = registry.peers.get(directorClientId);
  if (!directorPresence || (!directorPresence.isSpectating && directorClientId !== 'director')) {
    throw new Error(`Client ${directorClientId} not authorized as director`);
  }

  // Create whisper
  const whisper: SeerWhisper = {
    id: `whisper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    senderId: directorClientId,
    recipientId: playerClientId,
    message,
    whisperType,
    timestamp: Date.now(),
    narrativeTag: 'SEER_INTERVENTION',
    authorityLevel: whisperType === 'guidance' ? 'suggestion' : 'prophecy',
    expiresAt: Date.now() + 30000 // 30-second display
  };

  // If we had a whisper log on the registry, we'd store it here
  // For now, return the whisper for transmission
  console.log(`[Seer] Whisper from ${directorClientId} to ${playerClientId}: "${message}"`);

  return whisper;
}

/**
 * M35: Format whisper for player display
 */
export function formatSeerWhisper(whisper: SeerWhisper): string {
  const icons = {
    guidance: '💫',
    warning: '⚠️',
    revelation: '✨',
    mystery: '🔮'
  };

  return `
${icons[whisper.whisperType]} [${whisper.narrativeTag}]
"${whisper.message}"
— The Seer speaks...
  `.trim();
}

/**
 * M35: Curate an event (director nudges exploration)
 */
export function curateEvent(
  registry: SessionRegistry,
  curatorId: string,
  eventType: EventCurationRequest['eventType'],
  locationId: string,
  parameters: Record<string, any> = {}
): EventCurationRequest {
  // Verify curator is director
  const curatorPresence = registry.peers.get(curatorId);
  if (!curatorPresence || (!curatorPresence.isSpectating && curatorId !== 'director')) {
    throw new Error(`Client ${curatorId} not authorized as director`);
  }

  const request: EventCurationRequest = {
    id: `curation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    curatorId,
    eventType,
    targetLocationId: locationId,
    parameters,
    timestamp: Date.now(),
    approved: true
  };

  console.log(`[Director] Curating event: ${eventType} at ${locationId}`);

  return request;
}

/**
 * M35: Spawn a phantom in a specific location (director curation)
 */
export function curatePhantomSpawn(
  registry: SessionRegistry,
  directorId: string,
  locationId: string,
  sourceSessionId: string,
  sourcePlayerName: string,
  action: string = 'exploring'
): EventCurationRequest {
  return curateEvent(registry, directorId, 'spawn_phantom', locationId, {
    sourceSessionId,
    sourcePlayerName,
    action,
    durationSeconds: 8
  });
}

/**
 * M35: Spawn a temporal trace in a specific location
 */
export function curateTraceSpawn(
  registry: SessionRegistry,
  directorId: string,
  locationId: string,
  itemId: string,
  description: string,
  rarity: 'uncommon' | 'rare' | 'legendary' = 'rare'
): EventCurationRequest {
  return curateEvent(registry, directorId, 'spawn_trace', locationId, {
    itemId,
    description,
    rarity,
    durationSeconds: 60
  });
}

/**
 * M35: Get all whispers sent to a player in a session
 */
export function getWhispersForPlayer(
  whisperLog: SessionWhisperLog,
  playerId: string,
  includeExpired: boolean = false
): SeerWhisper[] {
  const whispers = whisperLog.whispers.get(playerId) || [];
  const now = Date.now();

  return whispers.filter(w => {
    if (!includeExpired && w.expiresAt && w.expiresAt < now) {
      return false;
    }
    return true;
  });
}

/**
 * M35: Get all pending curation requests (not yet applied)
 */
export function getPendingCurations(whisperLog: SessionWhisperLog): EventCurationRequest[] {
  return whisperLog.curationRequests.filter(c => !c.appliedAt);
}

/**
 * M35: Mark curation as applied
 */
export function applyCuration(
  whisperLog: SessionWhisperLog,
  curationId: string
): EventCurationRequest | null {
  const curation = whisperLog.curationRequests.find(c => c.id === curationId);
  if (!curation) return null;

  curation.appliedAt = Date.now();
  whisperLog.lastCurationTime = Date.now();

  return curation;
}

/**
 * M36 Task 1: The Shared Strand — Latency-Aware Consensus
 * 
 * Integrates network latency simulation with multiplayer state consensus.
 * Enables realistic multi-player synchronization accounting for network delays,
 * packet loss, and connection instability.
 * 
 * Consensus approaches:
 * - "Any" mode: First action wins (PvP, fast-paced)
 * - "Majority" mode: Action requires 50%+ agreement (cooperative)
 * - "Unanimous" mode: All players must agree (strict shared state)
 */

import type { NetworkSimState } from './p2pSimEngine';
export interface ConsensusProposal {
  id: string;
  timestamp: number;
  proposerId: string;
  actionType: 'world_event' | 'item_use' | 'npc_dialog' | 'deed_complete' | 'travel';
  actionData: any;
  votesNeeded: number;
  votesReceived: Map<string, boolean>;  // clientId -> vote
  resolutionStrategy: 'any' | 'majority' | 'unanimous';
  timedOutMs: number;
  resolved: boolean;
  resolutionTime?: number;
  resolution?: 'approved' | 'rejected' | 'timeout';
}

export interface LatencyAwareSyncPacket {
  id: string;
  originSessionId: string;
  timestamp: number;
  senderClientId: string;
  
  // Latency metadata
  expectedLocalLatency: number;     // Expected one-way latency in ms
  expectedReturnTime: number;       // When we expect acknowledgment
  
  // Payload
  stateUpdate: Partial<WorldState>;
  consensusProposalId?: string;
  
  // ACK tracking
  acknowledged: boolean;
  acknowledgedBy: Set<string>;      // clientIds that acked
  retransmitCount: number;
}

export interface ConsensusState {
  sessionId: string;
  proposals: Map<string, ConsensusProposal>;
  pendingSyncPackets: LatencyAwareSyncPacket[];
  networkSimState: NetworkSimState | null;  // Optional network sim for testing
  lastConsensusCheckTick: number;
  consensusCheckInterval: number;  // ms between consensus checks
  reconciliationThreshold: number;  // Divergence before forced reconciliation
}

/**
 * M36: Create consensus state tracker for a session
 */
export function createConsensusState(
  sessionId: string,
  networkSim?: NetworkSimState
): ConsensusState {
  return {
    sessionId,
    proposals: new Map(),
    pendingSyncPackets: [],
    networkSimState: networkSim || null,
    lastConsensusCheckTick: Date.now(),
    consensusCheckInterval: 100,     // Check consensus every 100ms
    reconciliationThreshold: 5        // Force reconciliation if > 5% state divergence
  };
}

/**
 * M36: Propose an action that requires consensus
 */
export function proposeAction(
  consensusState: ConsensusState,
  registry: SessionRegistry,
  actionType: ConsensusProposal['actionType'],
  actionData: any,
  proposerId: string,
  timeout: number = 3000
): ConsensusProposal {
  const votesNeeded = getVotesNeeded(
    registry.config.consensusRequired,
    registry.activePlayers.length
  );

  const proposal: ConsensusProposal = {
    id: `proposal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
    proposerId,
    actionType,
    actionData,
    votesNeeded,
    votesReceived: new Map(),
    resolutionStrategy: registry.config.consensusRequired,
    timedOutMs: timeout,
    resolved: false
  };

  // Pre-vote from proposer
  proposal.votesReceived.set(proposerId, true);

  consensusState.proposals.set(proposal.id, proposal);

  return proposal;
}

/**
 * M36: Calculate votes needed based on consensus model
 */
function getVotesNeeded(strategy: string, totalPlayers: number): number {
  if (strategy === 'any') return 1;
  if (strategy === 'majority') return Math.ceil(totalPlayers / 2);
  if (strategy === 'unanimous') return totalPlayers;
  return 1; // Default to "any"
}

/**
 * M36: Record a vote on a proposal
 */
export function voteOnProposal(
  consensusState: ConsensusState,
  proposalId: string,
  voterId: string,
  approve: boolean
): boolean {
  const proposal = consensusState.proposals.get(proposalId);
  if (!proposal || proposal.resolved) {
    return false;
  }

  proposal.votesReceived.set(voterId, approve);

  // Check if consensus reached
  checkConsensusResolution(consensusState, proposalId);

  return true;
}

/**
 * M36: Check if proposal has reached consensus
 */
function checkConsensusResolution(consensusState: ConsensusState, proposalId: string): void {
  const proposal = consensusState.proposals.get(proposalId);
  if (!proposal || proposal.resolved) return;

  const now = Date.now();
  const elapsed = now - proposal.timestamp;

  // Check timeout
  if (elapsed > proposal.timedOutMs) {
    proposal.resolved = true;
    proposal.resolution = 'timeout';
    proposal.resolutionTime = now;
    return;
  }

  // Count votes
  const approvingVotes = Array.from(proposal.votesReceived.values()).filter(Boolean).length;

  // Check for rejection (for unanimous: any no = rejected)
  if (proposal.resolutionStrategy === 'unanimous') {
    const hasRejection = Array.from(proposal.votesReceived.values()).some(v => !v);
    if (hasRejection) {
      proposal.resolved = true;
      proposal.resolution = 'rejected';
      proposal.resolutionTime = now;
      return;
    }
  }

  // Check if votes needed achieved
  if (approvingVotes >= proposal.votesNeeded) {
    proposal.resolved = true;
    proposal.resolution = 'approved';
    proposal.resolutionTime = now;
  }
}

/**
 * M36: Create latency-aware sync packet
 */
export function createSyncPacket(
  consensusState: ConsensusState,
  originSessionId: string,
  senderClientId: string,
  stateUpdate: Partial<WorldState>,
  expectedLatency: number
): LatencyAwareSyncPacket {
  const now = Date.now();

  return {
    id: `sync-${now}-${Math.random().toString(36).substring(2, 11)}`,
    originSessionId,
    timestamp: now,
    senderClientId,
    expectedLocalLatency: expectedLatency,
    expectedReturnTime: now + expectedLatency + 50,  // Add 50ms for processing
    stateUpdate,
    acknowledged: false,
    acknowledgedBy: new Set(),
    retransmitCount: 0
  };
}

/**
 * M36: Apply latency to state update based on network conditions
 * Returns effective state after network delay is accounted for
 */
export function applyLatencyToUpdate(
  packet: LatencyAwareSyncPacket,
  consensusState: ConsensusState
): { delayMs: number; shouldApply: boolean } {
  if (!consensusState.networkSimState) {
    // No network simulation: apply immediately
    return { delayMs: 0, shouldApply: true };
  }

  const netSim = consensusState.networkSimState;

  // Check if packet should be dropped
  if (netSim.config.enabled) {
    // Simulate packet loss
    if (Math.random() < netSim.config.packetLossRate) {
      packet.retransmitCount++;
      return { delayMs: netSim.avgLatency, shouldApply: false };
    }

    // Simulate latency
    const latency = packet.expectedLocalLatency + (Math.random() - 0.5) * 2 * netSim.config.latencyVariance;
    return {
      delayMs: Math.max(0, latency),
      shouldApply: true
    };
  }

  return { delayMs: packet.expectedLocalLatency, shouldApply: true };
}

/**
 * M36: Reconcile divergent state between players
 * Detects when players' world states have diverged too much and forces resync
 */
export function reconcilePlayerStates(
  registry: SessionRegistry,
  consensusState: ConsensusState,
  playerStates: Map<string, Partial<WorldState>>
): {
  divergence: number;
  needsReconciliation: boolean;
  recommendedMergeStrategy: 'youngest' | 'oldest' | 'consensus';
} {
  if (playerStates.size === 0) {
    return { divergence: 0, needsReconciliation: false, recommendedMergeStrategy: 'consensus' };
  }

  // Calculate divergence by comparing key metrics
  const states = Array.from(playerStates.values());
  let maxDivergence = 0;

  // Compare tick counts
  const ticks = states.map(s => s.tick || 0);
  const tickDivergence = (Math.max(...ticks) - Math.min(...ticks)) / Math.max(...ticks || [1]);
  maxDivergence = Math.max(maxDivergence, tickDivergence);

  // Compare NPC states
  const npcCounts = states.map(s => s.npcs?.length || 0);
  const npcDivergence = (Math.max(...npcCounts) - Math.min(...npcCounts)) / Math.max(...npcCounts || [1]);
  maxDivergence = Math.max(maxDivergence, npcDivergence);

  const needsReconciliation = maxDivergence > (consensusState.reconciliationThreshold / 100);

  // Recommend merge strategy based on state info
  let strategy: 'youngest' | 'oldest' | 'consensus' = 'consensus';
  if (maxDivergence <= 0.15 && registry.config.consensusRequired === 'any') {
    // Any mode with low divergence: take the newest
    strategy = 'youngest';
  }
  // Otherwise use consensus (already set as default)

  return {
    divergence: maxDivergence * 100,  // Convert to percentage
    needsReconciliation,
    recommendedMergeStrategy: strategy
  };
}

/**
 * M36: Broadcast state update with latency awareness
 */
export function broadcastStateUpdate(
  consensusState: ConsensusState,
  registry: SessionRegistry,
  update: Partial<WorldState>,
  originClientId: string
): LatencyAwareSyncPacket[] {
  const packets: LatencyAwareSyncPacket[] = [];

  for (const peerId of registry.activePlayers) {
    if (peerId === originClientId) continue;  // Don't send to self

    // Estimate latency for this peer
    const expectedLatency = consensusState.networkSimState
      ? consensusState.networkSimState.avgLatency
      : 35;  // Default broadband latency

    const packet = createSyncPacket(
      consensusState,
      registry.config.sessionId,
      originClientId,
      update,
      expectedLatency
    );

    packets.push(packet);
  }

  consensusState.pendingSyncPackets.push(...packets);

  return packets;
}

/**
 * M36: Check for stalled sync packets and determine if retransmit needed
 */
export function checkSyncPacketStatus(consensusState: ConsensusState): {
  stalledPackets: LatencyAwareSyncPacket[];
  readyForRetransmit: LatencyAwareSyncPacket[];
} {
  const now = Date.now();
  const stalledPackets: LatencyAwareSyncPacket[] = [];
  const readyForRetransmit: LatencyAwareSyncPacket[] = [];

  for (const packet of consensusState.pendingSyncPackets) {
    const age = now - packet.timestamp;

    // Packet is stalled if it's unacknowledged and past expected return time
    if (!packet.acknowledged && age > packet.expectedReturnTime) {
      stalledPackets.push(packet);

      // Mark for retransmit if we haven't exceeded limit
      if (packet.retransmitCount < 3) {
        readyForRetransmit.push(packet);
      }
    }
  }

  return { stalledPackets, readyForRetransmit };
}

/**
 * M36: Get consensus state diagnostics for UI/monitoring
 */
export function getConsensusDiagnostics(consensusState: ConsensusState): {
  activeProposals: number;
  pendingSyncPackets: number;
  stalledPackets: number;
  averageLatency: number;
  consensusHealthStatus: 'healthy' | 'degraded' | 'critical';
} {
  const unresolvedProposals = Array.from(consensusState.proposals.values()).filter(p => !p.resolved);
  
  const { stalledPackets } = checkSyncPacketStatus(consensusState);

  const avgLatency = consensusState.networkSimState
    ? consensusState.networkSimState.avgLatency
    : 0;

  let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (stalledPackets.length > 2 || consensusState.pendingSyncPackets.length > 10) {
    health = 'critical';
  } else if (stalledPackets.length > 0 || consensusState.pendingSyncPackets.length > 5) {
    health = 'degraded';
  }

  return {
    activeProposals: unresolvedProposals.length,
    pendingSyncPackets: consensusState.pendingSyncPackets.length,
    stalledPackets: stalledPackets.length,
    averageLatency: avgLatency,
    consensusHealthStatus: health
  };
}

/**
 * M37 Task 4: Propose a trade between two peers (3-step handshake)
 * Step 1: INITIATE — Lock focus on both traders, create trade state
 */
export function proposeTrade(
  registry: SessionRegistry,
  initiatorClientId: string,
  responderClientId: string,
  initiatorItems: Array<{ itemId: string; quantity: number }>,
  responderItems: Array<{ itemId: string; quantity: number }>,
  timeoutMs: number = 10000
): TradeState | null {
  // Verify both peers are active and at same location
  const initiator = registry.peers.get(initiatorClientId);
  const responder = registry.peers.get(responderClientId);

  if (!initiator || !responder) return null;
  if (initiator.currentLocationId !== responder.currentLocationId) return null;
  if (initiator.activeTrade || responder.activeTrade) return null; // Already trading

  const tradeState: TradeState = {
    tradeId: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    initiatorClientId,
    responderClientId,
    stage: 'proposed',
    initiatorItems,
    responderItems,
    initiatorConfirmed: false,
    responderConfirmed: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + timeoutMs
  };

  // Update both peers' active trade
  initiator.activeTrade = tradeState;
  responder.activeTrade = tradeState;

  // Both transitions to 'trading' status
  initiator.status = 'trading';
  responder.status = 'trading';

  return tradeState;
}

/**
 * M37 Task 4: Update trade offer (Step 2: OFFER_UPDATE)
 * Either party can update their offered items before commitment
 */
export function updateTradeOffer(
  registry: SessionRegistry,
  tradeId: string,
  updatingClientId: string,
  newItems: Array<{ itemId: string; quantity: number }>
): TradeState | null {
  // Find the trade across all peers
  let trade: TradeState | null = null;
  const updatingPeer = registry.peers.get(updatingClientId);

  if (updatingPeer?.activeTrade?.tradeId === tradeId) {
    trade = updatingPeer.activeTrade;
  } else {
    // Scan all peers if not the immediate one
    for (const peer of Array.from(registry.peers.values())) {
      if (peer.activeTrade?.tradeId === tradeId) {
        trade = peer.activeTrade;
        break;
      }
    }
  }

  if (!trade?.tradeId || trade.stage !== 'proposed') return null;

  // Update the appropriate side
  if (updatingClientId === trade.initiatorClientId) {
    trade.initiatorItems = newItems;
    trade.initiatorConfirmed = false; // Reset confirmation on update
  } else if (updatingClientId === trade.responderClientId) {
    trade.responderItems = newItems;
    trade.responderConfirmed = false;
  } else {
    return null;
  }

  return trade;
}

/**
 * M37 Task 4: Confirm trade offer from one party (Step 2 continuation)
 * Once both parties confirm, move to COMMITTED stage for atomic swap
 */
export function confirmTradeOffer(
  registry: SessionRegistry,
  tradeId: string,
  confirmingClientId: string
): { confirmed: boolean; bothConfirmed: boolean; tradeState: TradeState | null } {
  let trade: TradeState | null = null;
  const confirmingPeer = registry.peers.get(confirmingClientId);

  if (confirmingPeer?.activeTrade?.tradeId === tradeId) {
    trade = confirmingPeer.activeTrade;
  }

  if (!trade || trade.stage === 'committed' || trade.stage === 'completed' || trade.stage === 'cancelled') {
    return { confirmed: false, bothConfirmed: false, tradeState: null };
  }

  // Mark this party's confirmation
  if (confirmingClientId === trade.initiatorClientId) {
    trade.initiatorConfirmed = true;
  } else if (confirmingClientId === trade.responderClientId) {
    trade.responderConfirmed = true;
  } else {
    return { confirmed: false, bothConfirmed: false, tradeState: null };
  }

  const bothConfirmed = trade.initiatorConfirmed && trade.responderConfirmed;

  if (bothConfirmed) {
    trade.stage = 'committed';
    trade.commitmentTick = Date.now();
  }

  return { confirmed: true, bothConfirmed, tradeState: trade };
}

/**
 * M37 Task 4: Reject or cancel a trade
 */
export function cancelTrade(
  registry: SessionRegistry,
  tradeId: string,
  cancellingClientId: string
): TradeState | null {
  let trade: TradeState | null = null;
  const cancellingPeer = registry.peers.get(cancellingClientId);

  if (cancellingPeer?.activeTrade?.tradeId === tradeId) {
    trade = cancellingPeer.activeTrade;
  }

  if (!trade?.tradeId) return null;

  // Cancel and remove from both peers
  trade.stage = 'cancelled';
  trade.completedAt = Date.now();

  const initiator = registry.peers.get(trade.initiatorClientId);
  const responder = registry.peers.get(trade.responderClientId);

  if (initiator?.activeTrade?.tradeId === tradeId) {
    initiator.activeTrade = undefined;
    initiator.status = 'active';
  }
  if (responder?.activeTrade?.tradeId === tradeId) {
    responder.activeTrade = undefined;
    responder.status = 'active';
  }

  return trade;
}

/**
 * M37 Task 4: Get active trade for a peer
 */
export function getActiveTrade(registry: SessionRegistry, clientId: string): TradeState | null {
  const peer = registry.peers.get(clientId);
  if (!peer?.activeTrade) return null;

  // Check if trade has expired
  if (peer.activeTrade.stage === 'proposed' || peer.activeTrade.stage === 'offered') {
    if (Date.now() > peer.activeTrade.expiresAt) {
      peer.activeTrade.stage = 'cancelled';
      peer.activeTrade.completedAt = Date.now();
      peer.activeTrade = undefined;
      peer.status = 'active';
      return null;
    }
  }

  return peer.activeTrade;
}

/**
 * M37 Task 4: Complete a committed trade (atomic swap)
 * Called when both parties have locked in consensus
 * Returns list of item transfers to apply atomically
 */
export function completeTrade(
  registry: SessionRegistry,
  tradeId: string
): Array<{ from: string; to: string; itemId: string; quantity: number }> | null {
  let trade: TradeState | null = null;

  for (const peer of Array.from(registry.peers.values())) {
    if (peer.activeTrade?.tradeId === tradeId) {
      trade = peer.activeTrade;
      break;
    }
  }

  if (!trade?.tradeId || trade.stage !== 'committed') return null;

  // Generate atomic transfers
  const transfers: Array<{ from: string; to: string; itemId: string; quantity: number }> = [];

  // Initiator sends to responder
  for (const item of trade.initiatorItems) {
    transfers.push({
      from: trade.initiatorClientId,
      to: trade.responderClientId,
      itemId: item.itemId,
      quantity: item.quantity
    });
  }

  // Responder sends to initiator
  for (const item of trade.responderItems) {
    transfers.push({
      from: trade.responderClientId,
      to: trade.initiatorClientId,
      itemId: item.itemId,
      quantity: item.quantity
    });
  }

  // Mark trade as completed
  trade.stage = 'completed';
  trade.completedAt = Date.now();

  // Remove trade from both peers
  const initiator = registry.peers.get(trade.initiatorClientId);
  const responder = registry.peers.get(trade.responderClientId);

  if (initiator?.activeTrade?.tradeId === tradeId) {
    initiator.activeTrade = undefined;
    initiator.status = 'active';
  }
  if (responder?.activeTrade?.tradeId === tradeId) {
    responder.activeTrade = undefined;
    responder.status = 'active';
  }

  return transfers;
}
