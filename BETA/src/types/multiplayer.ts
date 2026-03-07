/**
 * Phase 9: Multiplayer & Witness Consensus (DSS 14)
 *
 * Purpose: Define the networking and consensus schemas required for the "Oracle & Witness"
 * distributed tabletop architecture. Multiple clients synchronize 1.5s heartbeats and use
 * majority voting to commit entries to the Immutable Ledger.
 *
 * Key Concepts:
 * - PeerPresence: Real-time awareness of connected players
 * - SignedMutation: State change signed by the Oracle
 * - ConsensusProposal: Voting request for Hard Facts
 * - WitnessCertificate: Witness signature/approval
 * - OracleElection: Deterministic Oracle selection (host authority)
 * - StateHash: World state hash for verification & consensus
 */

import type { StateHash } from './persistence';

/**
 * PeerHandshake: Initial connection metadata when a peer joins
 * Used to establish identity, latency profile, and capabilities
 */
export interface PeerHandshake {
  clientId: string;                    // Unique client identifier (UUID)
  playerId: string;                    // Player/Vessel ID
  sessionId: string;                   // Session they're joining
  connectionTime: number;              // Unix timestamp of connection
  protocolVersion: string;             // Client protocol version (e.g., "1.0.0")
  latencyEstimate: number;             // Initial latency estimate (ms)
  capabilities: {
    supportsConsensus: boolean;        // Can participate in voting
    supportsWitness: boolean;          // Can sign mutations
    supportsPeerDiscovery: boolean;    // Can announce peers
    supportsPersistence: boolean;      // Can persist to ledger
  };
  publicKey?: string;                  // For signature verification (if using PKI)
}

/**
 * SignedMutation: A state change signed by the Oracle or approved by witnesses
 * This is the primary unit of consensus and ledger commitment
 */
export interface SignedMutation {
  mutationId: string;                  // Unique mutation identifier
  tick: number;                        // Game tick when mutation occurred
  oracleClientId: string;              // Which peer is the authority
  
  // Mutation content
  type: 'action' | 'combat' | 'item_transfer' | 'faction_event' | 'geography_change' | 'miracle' | 'paradox';
  affectedEntityIds: string[];         // Which vessels/factions/territories are affected
  description: string;                 // Human-readable description
  data: Record<string, any>;           // Detailed mutation data
  
  // Consensus state
  witnesses: Map<string, WitnessCertificate>;  // Signatures from witness peers
  requiredWitnesses: number;           // Minimum signatures needed
  timestamp: number;                   // Server time when mutation created
  
  // Cryptographic integrity
  stateHashBefore: string;             // SHA256 of world state before mutation
  stateHashAfter: string;              // SHA256 of world state after mutation
  oracleSignature: string;             // HMAC-SHA256 signed by oracle
  
  // Ledger tracking
  committedToLedger: boolean;          // Whether written to persistent store
  ledgerEntryId?: string;              // Reference to LedgerEntry if committed
}

/**
 * WitnessCertificate: A witness peer's validation of a mutation
 * Multiple witnesses must approve before a mutation is committed
 */
export interface WitnessCertificate {
  clientId: string;                    // Which peer witnessed
  mutationId: string;                  // Which mutation they're signing
  
  // Validation result
  approved: boolean;                   // True if witness accepts mutation
  validationMessage?: string;          // Reason for approval/rejection
  
  // Witness proof
  timestamp: number;                   // When witness signed
  signature: string;                   // HMAC-SHA256 of mutation hash
  stateHashMatch: boolean;             // Whether their local state matches oracle
  
  // Latency metadata
  processingTimeMs: number;            // How long validation took
  estimatedClockOffsetMs: number;      // Estimated clock drift from oracle
}

/**
 * ConsensusProposal: Request for witnesses to vote on a mutation
 * Distributed to all peers during tick synchronization
 */
export interface ConsensusProposal {
  proposalId: string;                  // Unique proposal ID
  tick: number;                        // Which tick this affects
  phase: 'propose' | 'vote' | 'commit' | 'ripple';  // Which phase of tick resolution
  
  // Proposal content
  mutations: SignedMutation[];         // Mutations being voted on
  deadline: number;                    // Unix timestamp when voting closes
  requiredMajority: number;            // How many witnesses needed (e.g., 3/5)
  
  // Voting state
  votes: Map<string, 'approve' | 'reject' | 'timeout'>;  // clientId -> vote
  voteTally: { approve: number; reject: number; timeout: number };
  proposedByClientId: string;          // Which peer started voting
  
  // Resolution
  isResolved: boolean;                 // Whether vote is finalized
  resolution?: 'committed' | 'rejected' | 'timed_out';
  metadata?: Record<string, any>;      // Custom data (conflict resolution rules, etc.)
}

/**
 * OracleElectionState: Tracks oracle selection and failover
 * Deterministic logic ensures all peers agree on the authority
 */
export interface OracleElectionState {
  currentOracleClientId: string;       // Active oracle/host
  electionTick: number;                // When oracle was elected
  
  // Election rules
  electionMethod: 'lowest_id' | 'oldest_connection' | 'consensus_vote';
  candidateClientIds: string[];        // Peers eligible to be oracle
  
  // Failover tracking
  oracleHealthy: boolean;              // Is the current oracle responsive?
  lastOracleHeartbeat: number;         // Unix timestamp of last heartbeat
  heartbeatInterval: number;           // Expected ms between heartbeats
  failoverThreshold: number;           // How many missed heartbeats trigger failover
  
  // History (for disaster recovery)
  oracleSuccession: Array<{
    clientId: string;
    startTick: number;
    endTick?: number;
    reason: 'elected' | 'failed' | 'resigned' | 'replaced';
  }>;
}

/**
 * TickSyncEvent: Broadcast to all peers during 1.5s tick boundary
 * Coordinates the "Ready Check" before advancing to next phase
 */
export interface TickSyncEvent {
  tick: number;                        // Which tick this is
  phase: 'propose' | 'vote' | 'commit' | 'ripple';  // Current phase
  oracleClientId: string;              // Current authority
  
  // Synchronization state
  readyPeers: string[];                // Clients that are ready to advance
  pendingPeers: string[];              // Clients still processing
  blockedPeers: string[];              // Clients with errors
  
  // State verification
  stateHashes: Map<string, StateHash>; // Hash from each peer
  allInSync: boolean;                  // Whether all peers agree on state
  
  // Decision
  canAdvance: boolean;                 // Whether we can move to next phase
  advanceTime: number;                 // Unix timestamp to advance
}

/**
 * ConflictResolution: Handle when multiple peers attempt same action
 * Applied when consensus detects conflicting mutations in same tick
 */
export interface ConflictResolution {
  conflictId: string;                  // Unique conflict identifier
  tick: number;                        // Which tick conflict occurred
  
  // Competing mutations
  mutation1: SignedMutation;           // First mutation
  mutation2: SignedMutation;           // Second mutation (conflicting)
  competingClientIds: [string, string];  // Which peers proposed each
  
  // Resolution rules (in priority order)
  resolutionRules: Array<{
    rule: 'oracle_priority' | 'lowest_latency' | 'first_arrived' | 'both_fail' | 'highest_skill';
    ruleData?: Record<string, any>;
  }>;
  
  // Resolution result
  winner?: 'mutation1' | 'mutation2' | 'both_fail';
  loserId: string;                     // Which peer's mutation was rejected
  resolutionTime: number;              // When conflict was resolved
}

/**
 * MultiplayerAuthority: Metadata addition to LedgerEntry for consensus tracking
 * Extends LedgerEntry to include witness signatures and oracle authority
 */
export interface MultiplayerAuthority {
  oracleClientId: string;              // Which peer authored this entry
  witnesses: string[];                 // All peers who voted to approve
  consensusWeight: number;             // Fraction of peers who approved (0-1)
  requiredConsensus: number;           // Minimum consensus needed
  isConsensusValid: boolean;           // Whether entry passed consensus threshold
  
  // Conflict resolution (if this entry resolved a conflict)
  resolvedConflictId?: string;         // Which conflict this resolved
  rejectedAlternatives?: SignedMutation[];  // Mutations that were rejected
}

/**
 * LatencyProfile: Track network performance per peer
 * Used to weight voting power and timeout calculations
 */
export interface LatencyProfile {
  clientId: string;
  baseLatencyMs: number;               // Baseline latency estimate
  latencySamples: number[];            // Last 10 samples (for trend detection)
  averageLatencyMs: number;            // Rolling average
  maxLatencyMs: number;                // Worst-case latency
  
  // Reliability scoring
  mutationsProcessedOnTime: number;    // How many mutations finished before deadline
  mutationsLate: number;               // How many mutations missed deadline
  reliabilityScore: number;            // 0-1, affects voting weight
  
  // Jitter detection
  standardDeviation: number;           // Latency jitter
  isHighJitter: boolean;               // If jitter > 50ms
}

/**
 * PeerState: Complete state of a connected peer
 * Used by MultiplayerManager to track all peers in session
 */
export interface PeerState {
  clientId: string;
  playerId: string;
  sessionId: string;
  
  // Connection state
  connected: boolean;
  connectionTime: number;
  lastHeartbeat: number;
  
  // Performance metrics
  latencyProfile: LatencyProfile;
  
  // Role & authority
  isOracle: boolean;
  isCandidateForOracle: boolean;
  
  // Local state
  currentTick: number;                 // Which tick peer is on
  currentPhase: string;                // Which phase they're in
  stateHash: string;                   // Their current state hash
  
  // Voting history
  votesApproved: number;               // Mutations they approved
  votesRejected: number;               // Mutations they rejected
  consensusScore: number;              // Reliability in consensus voting
  
  // Information lag simulation
  informationLagTicks: number;         // How many ticks behind oracle (for PER/WIS filter)
  revealsPerception: number;           // How much they can perceive (0-1)
  revealsWisdom: number;               // How much insight they have (0-1)
}

/**
 * SessionMetrics: Aggregate statistics for a multiplayer session
 * Used for diagnostics and performance tuning
 */
export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  currentTick: number;
  totalTicksElapsed: number;
  
  // Consensus metrics
  totalMutationsProposed: number;
  totalMutationsCommitted: number;
  consensusSuccessRate: number;        // Fraction that passed voting
  averageConsensusTimeMs: number;      // How long voting takes
  
  // Network metrics
  averageNetworkLatencyMs: number;
  maxNetworkLatencyMs: number;
  networkPartitions: number;           // How many times network split
  oracleFailovers: number;             // How many times oracle changed
  
  // Per-peer metrics
  peerMetrics: Map<string, {
    totalMutations: number;
    consensusScore: number;
    uptime: number;                    // Percentage connected
  }>;
}

/**
 * ReadyCheckPulse: Heartbeat for tick synchronization
 * Sent by oracle to all witnesses at tick boundary
 */
export interface ReadyCheckPulse {
  pulseId: string;
  tick: number;
  phase: 'propose' | 'vote' | 'commit' | 'ripple';
  oracleClientId: string;
  timestamp: number;
  
  // Peer status collection
  expectedPeers: number;               // How many peers should respond
  readyPeers: number;                  // How many said "ready"
  laggyPeers: string[];                // Peers slower than threshold
  
  // Decision
  percentageReady: number;             // Fraction ready to proceed
  canAdvanceToNextPhase: boolean;      // Whether we wait or proceed
  maxWaitTimeMs: number;               // Don't wait longer than this
}

/**
 * SignatureContext: Metadata for HMAC signing/verifying mutations
 * Ensures only authorized peers can create signed mutations
 */
export interface SignatureContext {
  clientId: string;
  sessionId: string;
  sharedSecret: string;                // Pre-shared secret for HMAC
  signatureAlgorithm: 'hmac-sha256' | 'hmac-sha512';
  signatureTimestamp: number;
  signatureExpiry: number;             // How long signature is valid (ms)
}
