/**
 * Persistence Manager (Phase 5 Core)
 *
 * Implements the immutable ledger system with Merkle Tree State Hashing
 * for long-term world continuity and tamper detection.
 *
 * Key Systems:
 * 1. StateHash (Merkle Tree): SHA-256 hash of all entity states
 * 2. Deep Snapshots: Complete world state every 3,600 ticks (1 hour)
 * 3. Partial Mutations: Incremental changes between snapshots
 * 4. Immutable Ledger: Hard facts (deaths, births) permanently recorded
 */

import * as crypto from 'crypto';
import type {
  LedgerEntry,
  WorldSnapshot,
  PartialStateMutation,
  BranchMarker,
  StateHash,
  CauseID,
  GlobalConstants,
} from '../types';
import type { Vessel, ActiveFaction, TerritoryNode, Deity, DivineAlignment } from '../types';

/**
 * Re-export StateHash for use in consuming modules
 */
export type { StateHash } from '../types';

/**
 * PersistenceManager: Manages world continuity and state verification
 */
export class PersistenceManager {
  private ledgerEntries: Map<string, LedgerEntry> = new Map();
  private worldSnapshots: Map<string, WorldSnapshot> = new Map();
  private branchMarkers: Map<string, BranchMarker> = new Map();
  private partialMutations: PartialStateMutation[] = [];
  private mutationChain: string = ''; // Hash chain for mutations
  private snapshotIntervalTicks: number = 3600; // 1 hour
  private lastSnapshotTick: number = 0;
  private nextLedgerId: number = 0;
  private nextSnapshotId: number = 0;
  private nextBranchMarkerId: number = 0;

  constructor(snapshotIntervalTicks: number = 3600) {
    this.snapshotIntervalTicks = snapshotIntervalTicks;
    this.mutationChain = this.hashString('genesis');
  }

  /**
   * SHA-256 hash of a string
   */
  private hashString(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * SHA-256 hash of a JSON object
   */
  private hashObject(obj: any): string {
    return this.hashString(JSON.stringify(obj));
  }

  /**
   * Calculate Merkle Tree StateHash for entire world
   * Combines hashes of all entity categories in layered fashion
   */
  calculateStateHash(
    vessels: Vessel[],
    factions: ActiveFaction[],
    territories: TerritoryNode[],
    deities: (Deity & { influence: DivineAlignment })[],
    constants: GlobalConstants
  ): StateHash {
    // Hash each entity category
    const vesselsHash = this.hashString(
      JSON.stringify(vessels.sort((a, b) => a.id.localeCompare(b.id)))
    );
    const factionsHash = this.hashString(
      JSON.stringify(factions.sort((a, b) => a.id.localeCompare(b.id)))
    );
    const territoriesHash = this.hashString(
      JSON.stringify(territories.sort((a, b) => a.id.localeCompare(b.id)))
    );
    const deitiesHash = this.hashString(
      JSON.stringify(deities.sort((a, b) => a.id.localeCompare(b.id)))
    );
    const constantsHash = this.hashString(JSON.stringify(constants));

    // Combine into Merkle tree (level 2: combine pairs)
    const level2_v1 = this.hashString(vesselsHash + factionsHash);
    const level2_v2 = this.hashString(territoriesHash + deitiesHash);

    // Level 3: Combine pairs
    const level3 = this.hashString(level2_v1 + level2_v2 + constantsHash);

    return {
      hash: level3,
      componentHashes: {
        vesselsHash,
        factionsHash,
        territoriesHash,
        deitiesHash,
        constantsHash,
      },
      computedAt: Date.now(),
      isValidated: true, // Set to true on calculation; consensus updates this
    };
  }

  /**
   * Record a hard fact to the immutable ledger
   * Hard facts cannot be rewound; only read for historical analysis
   */
  recordLedgerEntry(
    causeId: CauseID,
    entryType: LedgerEntry['entryType'],
    actorId: string,
    data: Record<string, any>,
    description: string
  ): LedgerEntry {
    const previousEntry = Array.from(this.ledgerEntries.values()).pop();
    const previousEntryHash = previousEntry?.contentHash || this.hashString('genesis');

    const entry: LedgerEntry = {
      id: `ledger-${this.nextLedgerId++}`,
      causeId,
      recordedAtTick: 0, // Will be set by caller
      entryType,
      actorId,
      data,
      contentHash: this.hashObject({ causeId, entryType, actorId, data }),
      isVerified: false, // Set to true by consensus mechanism
      previousEntryHash,
      description,
    };

    this.ledgerEntries.set(entry.id, entry);
    return entry;
  }

  /**
   * Create a deep snapshot of world state
   * Called every 3,600 ticks or at critical moments
   */
  createWorldSnapshot(
    vessels: Vessel[],
    factions: ActiveFaction[],
    territories: TerritoryNode[],
    deities: (Deity & { influence: DivineAlignment })[],
    constants: GlobalConstants,
    currentTick: number,
    epochNumber: number,
    worldStability: number,
    aggregateParadoxDebtState: any
  ): WorldSnapshot {
    const stateHash = this.calculateStateHash(vessels, factions, territories, deities, constants);

    const snapshot: WorldSnapshot = {
      id: `snapshot-${this.nextSnapshotId++}`,
      snapshotTick: currentTick,
      epochNumber,
      vessels: structuredClone(vessels),
      factions: structuredClone(factions),
      territories: structuredClone(territories),
      deities: structuredClone(deities),
      globalConstants: structuredClone(constants),
      worldStability,
      aggregateParadoxDebtState,
      stateHash: stateHash.hash,
      previousSnapshotId:
        Array.from(this.worldSnapshots.values()).pop()?.id || undefined,
      isFinalized: false,
      createdAt: Date.now(),
      isCompressed: false,
      sizeBytes: JSON.stringify({
        vessels,
        factions,
        territories,
        deities,
        constants,
      }).length,
    };

    this.worldSnapshots.set(snapshot.id, snapshot);
    this.lastSnapshotTick = currentTick;

    // Create a branch marker for this snapshot
    this.createBranchMarker(snapshot.id, currentTick, [
      ...vessels.map(v => v.id),
      ...factions.map(f => f.id),
    ]);

    return snapshot;
  }

  /**
   * Record a partial mutation between snapshots
   * Only modified entities are stored to minimize I/O
   */
  recordPartialMutation(
    mutationTick: number,
    causeId: CauseID,
    vesselUpdates?: { id: string; data: Partial<Vessel> | null }[],
    factionUpdates?: { id: string; data: Partial<ActiveFaction> | null }[],
    territoryUpdates?: { id: string; data: Partial<TerritoryNode> | null }[],
    itemUpdates?: { id: string; data: any | null }[],
    globalUpdates?: Partial<GlobalConstants>
  ): PartialStateMutation {
    const mutation: PartialStateMutation = {
      mutationTick,
      causeId,
      vesselUpdates,
      factionUpdates,
      territoryUpdates,
      itemUpdates,
      globalUpdates,
      mutationHash: this.hashObject({
        mutationTick,
        causeId,
        vesselUpdates,
        factionUpdates,
        territoryUpdates,
        itemUpdates,
        globalUpdates,
      }),
      previousMutationHash: this.mutationChain,
    };

    this.partialMutations.push(mutation);
    this.mutationChain = mutation.mutationHash;

    return mutation;
  }

  /**
   * Create a branch marker to enable rewinding
   * Markers are taken at critical snapshots and cost Paradox Debt to rewind to
   */
  private createBranchMarker(snapshotId: string, markerTick: number, affectedActors: string[]): BranchMarker {
    const marker: BranchMarker = {
      id: `marker-${this.nextBranchMarkerId++}`,
      snapshotId,
      markerTick,
      rewindCost: Math.ceil((markerTick + 1) / 3600), // 1 paradox debt per hour
      affectedActors,
      isAvailable: true,
    };

    this.branchMarkers.set(marker.id, marker);
    return marker;
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(snapshotId: string): WorldSnapshot | undefined {
    return this.worldSnapshots.get(snapshotId);
  }

  /**
   * Get the most recent snapshot
   */
  getMostRecentSnapshot(): WorldSnapshot | undefined {
    const snapshots = Array.from(this.worldSnapshots.values());
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  }

  /**
   * Verify a snapshot hasn't been tampered with
   * Compares stored state hash against recalculated hash from entities
   */
  verifySnapshotIntegrity(snapshot: WorldSnapshot): boolean {
    const recalculatedHash = this.calculateStateHash(
      snapshot.vessels,
      snapshot.factions,
      snapshot.territories,
      snapshot.deities,
      snapshot.globalConstants
    );

    return recalculatedHash.hash === snapshot.stateHash;
  }

  /**
   * Replay mutations from a snapshot to rebuild state
   * Used to restore from a checkpoint
   */
  replayMutationsFromSnapshot(
    snapshotId: string,
    endTick: number
  ): { snapshot: WorldSnapshot; finalState: any } | null {
    const snapshot = this.getSnapshot(snapshotId);
    if (!snapshot) return null;

    let currentState = structuredClone({
      vessels: snapshot.vessels,
      factions: snapshot.factions,
      territories: snapshot.territories,
      deities: snapshot.deities,
      constants: snapshot.globalConstants,
    });

    // Apply partial mutations in chronological order
    const relevantMutations = this.partialMutations.filter(
      m => m.mutationTick > snapshot.snapshotTick && m.mutationTick <= endTick
    );

    for (const mutation of relevantMutations) {
      // Apply vessel updates
      if (mutation.vesselUpdates) {
        for (const update of mutation.vesselUpdates) {
          const vesselIndex = currentState.vessels.findIndex(v => v.id === update.id);
          if (update.data === null) {
            if (vesselIndex >= 0) {
              currentState.vessels.splice(vesselIndex, 1);
            }
          } else if (vesselIndex >= 0) {
            currentState.vessels[vesselIndex] = {
              ...currentState.vessels[vesselIndex],
              ...update.data,
            };
          }
        }
      }

      // Apply faction updates
      if (mutation.factionUpdates) {
        for (const update of mutation.factionUpdates) {
          const factionIndex = currentState.factions.findIndex(f => f.id === update.id);
          if (update.data === null) {
            if (factionIndex >= 0) {
              currentState.factions.splice(factionIndex, 1);
            }
          } else if (factionIndex >= 0) {
            currentState.factions[factionIndex] = {
              ...currentState.factions[factionIndex],
              ...update.data,
            };
          }
        }
      }

      // Apply territory updates
      if (mutation.territoryUpdates) {
        for (const update of mutation.territoryUpdates) {
          const territoryIndex = currentState.territories.findIndex(t => t.id === update.id);
          if (update.data === null) {
            if (territoryIndex >= 0) {
              currentState.territories.splice(territoryIndex, 1);
            }
          } else if (territoryIndex >= 0) {
            currentState.territories[territoryIndex] = {
              ...currentState.territories[territoryIndex],
              ...update.data,
            };
          }
        }
      }

      // Apply global updates
      if (mutation.globalUpdates) {
        currentState.constants = {
          ...currentState.constants,
          ...mutation.globalUpdates,
        };
      }
    }

    return { snapshot, finalState: currentState };
  }

  /**
   * Query ledger entries for historical analysis
   */
  queryLedger(
    startTick: number,
    endTick: number,
    entryTypes?: LedgerEntry['entryType'][],
    actorIds?: string[]
  ): LedgerEntry[] {
    return Array.from(this.ledgerEntries.values()).filter(entry => {
      const tickMatch = entry.recordedAtTick >= startTick && entry.recordedAtTick <= endTick;
      const typeMatch = !entryTypes || entryTypes.includes(entry.entryType);
      const actorMatch = !actorIds || actorIds.includes(entry.actorId);
      return tickMatch && typeMatch && actorMatch;
    });
  }

  /**
   * Check if a snapshot interval has elapsed
   */
  shouldCreateSnapshot(currentTick: number): boolean {
    return currentTick - this.lastSnapshotTick >= this.snapshotIntervalTicks;
  }

  /**
   * Get all branch markers available for rewinding
   */
  getAvailableBranchMarkers(): BranchMarker[] {
    return Array.from(this.branchMarkers.values()).filter(m => m.isAvailable);
  }

  /**
   * Archive old snapshots (remove from active memory)
   */
  archiveSnapshotsOlderThan(tickThreshold: number): string[] {
    const archived: string[] = [];

    for (const [id, snapshot] of this.worldSnapshots) {
      if (snapshot.snapshotTick < tickThreshold) {
        // In real implementation, would compress and offload to storage
        archived.push(id);
      }
    }

    return archived;
  }
}
