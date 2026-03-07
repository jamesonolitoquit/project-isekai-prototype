/**
 * Persistence Layer (DSS 07, 11: Meta-Integrity & World Templates)
 *
 * The immutable ledger system tracks all state changes with CauseID enforcement.
 * WorldSnapshots are taken every 3,600 ticks (1 hour) to enable rewinding.
 * Hard Facts (combat deaths, births) are permanently committed to the ledger.
 */

import type { Vessel } from './vessels';
import type { ActiveFaction } from './factions';
import type { TerritoryNode } from './geography';
import type { Deity, DivineAlignment } from './divine';
import type { Inventory, Item } from './inventory';
import type { CoreAttributes } from './attributes';

/**
 * CauseID: Every state change requires a valid causal origin
 * Prevents orphaned state mutations and enables audit trails
 */
export type CauseID = string & { readonly __brand: 'CauseID' };

export function createCauseID(source: string, actionType: string, tick: number): CauseID {
  return (`${source}:${actionType}:${tick}`) as CauseID;
}

/**
 * LedgerEntry: Record of a hard fact committed to the immutable ledger
 * These cannot be rewound (only read for historical analysis)
 */
export interface LedgerEntry {
  /** Unique ledger entry ID */
  id: string;

  /** Causal origin of this entry */
  causeId: CauseID;

  /** Tick when this entry was recorded */
  recordedAtTick: number;

  /** Type of hard fact being recorded */
  entryType:
    | 'vessel-death'
    | 'vessel-birth'
    | 'item-creation'
    | 'item-destruction'
    | 'faction-formation'
    | 'faction-dissolution'
    | 'territory-claim'
    | 'divine-miracle'
    | 'paradox-event'
    | 'epoch-transition';

  /** Actor involved (VesselID, FactionID, etc.) */
  actorId: string;

  /** Detailed data for this entry */
  data: Record<string, any>;

  /** Hash for tamper detection */
  contentHash: string;

  /** Whether this entry has been verified by peer nodes (consensus) */
  isVerified: boolean;

  /** Reference to previous entry (blockchain-like chaining) */
  previousEntryHash?: string;

  /** Description for audit trail */
  description: string;
}

/**
 * WorldSnapshot: Complete state of the world at a Branch Marker
 * Snapshots taken every 3,600 ticks (1 hour) enable rewinding
 */
export interface WorldSnapshot {
  /** Unique snapshot identifier */
  id: string;

  /** Tick when this snapshot was taken */
  snapshotTick: number;

  /** Game epoch (tracks world age) */
  epochNumber: number;

  /** All active vessels in the world */
  vessels: Vessel[];

  /** All factions and their current state */
  factions: ActiveFaction[];

  /** All territories and control status */
  territories: TerritoryNode[];

  /** All active deities and influence */
  deities: (Deity & { influence: DivineAlignment })[];

  /** Global constants that were active at this snapshot */
  globalConstants: GlobalConstants;

  /** World stability score (0-1) */
  worldStability: number;

  /** Current paradox debt state aggregated across all actors */
  aggregateParadoxDebtState: {
    totalDebt: number;
    actorsInFault: string[];
    shadowEntitiesSpawned: number;
  };

  /** Hash of entire snapshot for tamper detection */
  stateHash: string;

  /** Previous snapshot ID (for chain validation) */
  previousSnapshotId?: string;

  /** Whether this snapshot is permanent (finalized) */
  isFinalized: boolean;

  /** Timestamp when snapshot was created */
  createdAt: number;

  /** Optional compression (gzip) if snapshot was archived */
  isCompressed?: boolean;

  /** Size in bytes */
  sizeBytes?: number;
}

/**
 * GlobalConstants: Immutable configuration for entire simulation
 * Part of WorldSnapshot to track what rules were active
 */
export interface GlobalConstants {
  /** Tick duration in seconds */
  tickDuration: number;

  /** Ticks per day (86400 / tickDuration) */
  ticksPerDay: number;

  /** Ticks per epoch (long-term time skip period) */
  ticksPerEpoch: number;

  /** Maximum players allowed in this world */
  maxConcurrentPlayers: number;

  /** Starting paradox debt for new characters */
  initialParadoxDebt: number;

  /** Starting world stability */
  initialStability: number;

  /** Interval between snapshots (in ticks) */
  snapshotIntervalTicks: number;

  /** Maximum artifacts that can exist simultaneously */
  maxArtifactsPerWorld: number;

  /** Tile size in game units */
  tileSize: number;

  /** World gravity scale (affects movement, jumping) */
  gravityScale: number;

  /** Mana saturation level in this world (0-1) */
  manaSaturation: number;

  /** Resource generation multiplier */
  resourceGenerationMultiplier: number;

  /** Faction action budget per day */
  factionActionBudgetPerDay: number;

  /** Active security patches (DSS 07) */
  securityPatches: string[];
}

/**
 * PartialStateMutation: Lightweight update to WorldSnapshot
 * Only modified state is recorded to minimize I/O
 */
export interface PartialStateMutation {
  /** Tick when mutation occurred */
  mutationTick: number;

  /** Cause of the mutation */
  causeId: CauseID;

  /** Modified vessels (null = deleted, modified object = updated) */
  vesselUpdates?: {
    id: string;
    data: Partial<Vessel> | null;
  }[];

  /** Modified factions */
  factionUpdates?: {
    id: string;
    data: Partial<ActiveFaction> | null;
  }[];

  /** Modified territories */
  territoryUpdates?: {
    id: string;
    data: Partial<TerritoryNode> | null;
  }[];

  /** Modified items */
  itemUpdates?: {
    id: string;
    data: Partial<Item> | null;
  }[];

  /** Global state changes */
  globalUpdates?: Partial<GlobalConstants>;

  /** Hash of this mutation for chainability */
  mutationHash: string;

  /** Previous mutation hash (blockchain linking) */
  previousMutationHash?: string;
}

/**
 * BranchMarker: Snapshot taken to enable rewinding
 * Every 3,600 ticks (1 hour), a branch marker is created
 */
export interface BranchMarker {
  /** Unique marker ID */
  id: string;

  /** Snapshot this marker references */
  snapshotId: string;

  /** Tick when marker was created */
  markerTick: number;

  /** Cost in Paradox Debt to rewind to this marker */
  rewindCost: number;

  /** All actors who touched state after this marker */
  affectedActors: string[];

  /** Whether marker is still available (older markers may be archived) */
  isAvailable: boolean;

  /** If archived, when will it be permanently deleted */
  archiveExpiryTick?: number;
}

/**
 * LedgerRangeQuery: Retrieve entries from the immutable ledger
 * Used for historical analysis and replay
 */
export interface LedgerRangeQuery {
  /** Start tick (inclusive) */
  startTick: number;

  /** End tick (inclusive) */
  endTick: number;

  /** Filter by entry type */
  entryTypes?: LedgerEntry['entryType'][];

  /** Filter by actor ID */
  actorIds?: string[];

  /** Filter by causal source */
  causeSources?: string[];

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Whether to include unverified entries */
  includeUnverified?: boolean;
}

/**
 * StateHash: Merkle tree hash of entire world state
 * Computed at each snapshot to detect tampering
 * Formula: hash(all_vessels + all_factions + all_territories + all_deities + constants)
 */
export interface StateHash {
  /** The hash value (SHA-256 or similar) */
  hash: string;

  /** Component hashes for debugging */
  componentHashes: {
    vesselsHash: string;
    factionsHash: string;
    territoriesHash: string;
    deitiesHash: string;
    constantsHash: string;
  };

  /** Timestamp when hash was computed */
  computedAt: number;

  /** Whether this hash has been validated by consensus */
  isValidated: boolean;

  /** Number of peers that agreed on this hash */
  consensusCount?: number;

  /** Total peers in network */
  totalPeers?: number;
}

/**
 * LedgerCommitResult: Result of committing an entry to the immutable ledger
 */
export interface LedgerCommitResult {
  /** Whether commit succeeded */
  success: boolean;

  /** Entry that was committed (if successful) */
  entry?: LedgerEntry;

  /** Error message if failed */
  error?: string;

  /** Tick when commitment was processed */
  processedAtTick: number;

  /** Whether entry achieved consensus */
  consensusAchieved: boolean;

  /** Nodes that accepted this entry */
  acceptingNodes?: string[];

  /** Nodes that rejected this entry */
  rejectingNodes?: string[];
}

/**
 * SaveGameState: Complete serializable game state
 * Optimized for database storage (PostgreSQL/Redis)
 */
export interface SaveGameState {
  /** Session ID for this save */
  sessionId: string;

  /** Current world snapshot */
  snapshot: WorldSnapshot;

  /** All uncommitted mutations since last snapshot */
  pendingMutations: PartialStateMutation[];

  /** Ledger entries awaiting consensus */
  pendingLedgerEntries: LedgerEntry[];

  /** Current state hash */
  stateHash: StateHash;

  /** Timestamp of last save */
  savedAt: number;

  /** Format version for migration */
  formatVersion: number;

  /** Optional compression metadata */
  compression?: {
    algorithm: 'gzip' | 'brotli' | 'none';
    compressedSize: number;
    uncompressedSize: number;
  };

  /** Metadata */
  metadata: {
    worldName: string;
    saveSlotNumber: number;
    playtimeMinutes: number;
    maxPlayerLevel: number;
    factionsActive: number;
    totalVesselsCreated: number;
  };
}

/**
 * RollbackTransaction: Reverting state to a previous snapshot
 * Triggered by: High paradox debt, admin intervention, or network failure recovery
 */
export interface RollbackTransaction {
  /** Unique transaction ID */
  id: string;

  /** Snapshot to rollback to */
  targetSnapshotId: string;

  /** Actor requesting rollback (or 'system' if admin) */
  requestedByActorId: string;

  /** Reason for rollback */
  reason:
    | 'paradox-recovery'
    | 'save-scumming-prevention'
    | 'network-recovery'
    | 'admin-intervention'
    | 'validation-failure';

  /** Tick when rollback was requested */
  requestedAtTick: number;

  /** Tick when rollback was executed */
  executedAtTick?: number;

  /** State before rollback (for audit) */
  stateBeforeRollback?: WorldSnapshot;

  /** State after rollback (for verification) */
  stateAfterRollback?: WorldSnapshot;

  /** All mutations that were reverted */
  revertedMutations: PartialStateMutation[];

  /** Whether rollback was successful */
  success?: boolean;

  /** Error if rollback failed */
  error?: string;

  /** Paradox debt incurred (if player-initiated) */
  paradoxDebtIncurred?: number;
}

/**
 * Create a new world snapshot
 */
export function createWorldSnapshot(
  snapshotTick: number,
  epochNumber: number,
  vessels: Vessel[],
  factions: ActiveFaction[],
  territories: TerritoryNode[],
  deities: (Deity & { influence: DivineAlignment })[],
  globalConstants: GlobalConstants,
  worldStability: number,
  stateHash: string
): WorldSnapshot {
  return {
    id: `snapshot-${snapshotTick}`,
    snapshotTick,
    epochNumber,
    vessels,
    factions,
    territories,
    deities,
    globalConstants,
    worldStability,
    aggregateParadoxDebtState: {
      totalDebt: 0,
      actorsInFault: [],
      shadowEntitiesSpawned: 0,
    },
    stateHash,
    isFinalized: false,
    createdAt: Date.now(),
  };
}

/**
 * Create a ledger entry for a hard fact
 */
export function createLedgerEntry(
  causeId: CauseID,
  recordedAtTick: number,
  entryType: LedgerEntry['entryType'],
  actorId: string,
  data: Record<string, any>,
  description: string
): LedgerEntry {
  return {
    id: `ledger-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    causeId,
    recordedAtTick,
    entryType,
    actorId,
    data,
    contentHash: '',
    isVerified: false,
    description,
  };
}

/**
 * Branch Marker constants
 */
export const BRANCH_MARKER_CONSTANTS = {
  /** Ticks between branch markers (3,600 = 1 hour) */
  INTERVAL_TICKS: 3600,

  /** Base paradox debt cost to rewind to marker */
  BASE_REWIND_COST: 10,

  /** Maximum rewind age (24 hours) */
  MAX_REWIND_AGE_TICKS: 86400,

  /** Multiplier for rewind cost based on age */
  REWIND_COST_MULTIPLIER_PER_HOUR: 1.5,
};

/**
 * Immutable Ledger constants
 */
export const LEDGER_CONSTANTS = {
  /** Maximum entries per ledger query */
  MAX_QUERY_RESULTS: 1000,

  /** Entry verification requires N consensus peers */
  CONSENSUS_THRESHOLD: 0.75,

  /** Hard facts that cannot be rewound */
  HARD_FACT_TYPES: [
    'vessel-death',
    'vessel-birth',
    'faction-formation',
    'divine-miracle',
  ] as const,

  /** Soft facts that can be undone by paradox mechanics */
  SOFT_FACT_TYPES: [
    'item-creation',
    'item-destruction',
    'territory-claim',
    'paradox-event',
  ] as const,
};

/**
 * Snapshot storage constants
 */
export const SNAPSHOT_CONSTANTS = {
  /** Interval between snapshots in ticks (3,600 = 1 hour) */
  INTERVAL_TICKS: 3600,

  /** Maximum snapshots to keep in memory */
  MAX_MEMORY_SNAPSHOTS: 24, // 24 hours

  /** Archive old snapshots after this many ticks */
  ARCHIVE_AFTER_TICKS: 604800, // 7 days

  /** Delete archived snapshots after this many ticks */
  DELETE_ARCHIVED_AFTER_TICKS: 2592000, // 30 days

  /** Maximum snapshot size in bytes (100 MB) */
  MAX_SNAPSHOT_SIZE_BYTES: 104857600,

  /** Compression threshold (compress if > 5 MB) */
  COMPRESSION_THRESHOLD_BYTES: 5242880,
};
