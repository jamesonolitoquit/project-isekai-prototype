/**
 * Phase 5 Unit Tests: Persistence, Reincarnation, and World Engine
 *
 * Covers:
 * 1. PersistenceManager: Merkle Tree hashing, snapshots, mutations, ledger
 * 2. ReincarnationEngine: Death processing, XP retention, flash learning, causal locks
 * 3. Phase5Manager: World orchestration and integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PersistenceManager } from './PersistenceManager';
import { ReincarnationEngine } from './ReincarnationEngine';
import { Phase5Manager } from './Phase5Manager';
import type { Vessel, ActiveFaction, TerritoryNode, Deity, DivineAlignment, GlobalConstants } from '../types';

// Mock data factories
function createMockVessel(id: string = 'vessel-1', level: number = 10): Vessel {
  return {
    id,
    name: `Character ${id}`,
    level,
    maxHealthPoints: 100,
    healthPoints: 100,
    attributes: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    vitals: { vigor: 100, nourishment: 100, sanity: 100 },
    maximumVitals: { maxVigor: 100, maxNourishment: 100, maxSanity: 100 },
    skills: [],
    inventory: [],
    ancestry: 'Human',
    createdAtTick: 0,
    playerId: 'player-1',
  } as Vessel;
}

function createMockFaction(id: string = 'faction-1'): ActiveFaction {
  return {
    id,
    name: `Faction ${id}`,
    powerScore: 50,
    primaryLocationId: 'loc-1',
    controlledLocationIds: [],
    conflictLevel: 0,
  } as unknown as ActiveFaction;
}

function createMockTerritory(id: string = 'territory-1'): TerritoryNode {
  return {
    id,
    name: `Territory ${id}`,
    biomeType: 'grassland',
    x: 50,
    y: 50,
    stability: 0.8,
    waterLevel: 0.5,
    controlledByFactionId: 'faction-1',
  } as unknown as TerritoryNode;
}

function createMockGlobalConstants(): GlobalConstants {
  return {
    tickDuration: 1.5,
    ticksPerDay: 57600,
    ticksPerEpoch: 864000,
    maxConcurrentPlayers: 100,
    initialParadoxDebt: 0,
    initialStability: 1.0,
    snapshotIntervalTicks: 3600,
    maxArtifactsPerWorld: 50,
    tileSize: 1.0,
    gravityScale: 1.0,
    manaSaturation: 0.5,
    resourceGenerationMultiplier: 1.0,
    factionActionBudgetPerDay: 100,
    securityPatches: [],
  };
}

describe('PersistenceManager', () => {
  let persistenceManager: PersistenceManager;

  beforeEach(() => {
    persistenceManager = new PersistenceManager(3600);
  });

  it('should calculate identical state hash for same vessels', () => {
    const vessels = [createMockVessel('v1', 10), createMockVessel('v2', 15)];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    const hash1 = persistenceManager.calculateStateHash(
      vessels,
      factions,
      territories,
      deities,
      constants
    );

    const hash2 = persistenceManager.calculateStateHash(
      [...vessels],
      [...factions],
      [...territories],
      deities,
      constants
    );

    expect(hash1.hash).toBe(hash2.hash);
  });

  it('should produce different hashes for different vessel states', () => {
    const vessels1 = [createMockVessel('v1', 10)];
    const vessels2 = [createMockVessel('v1', 15)]; // Different level
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    const hash1 = persistenceManager.calculateStateHash(vessels1, factions, territories, deities, constants);
    const hash2 = persistenceManager.calculateStateHash(vessels2, factions, territories, deities, constants);

    expect(hash1.hash).not.toBe(hash2.hash);
  });

  it('should record ledger entries with proper chaining', () => {
    const entry1 = persistenceManager.recordLedgerEntry(
      'source:action:100' as any,
      'vessel-death',
      'vessel-1',
      { level: 10, cause: 'combat' },
      'Vessel died in combat'
    );

    const entry2 = persistenceManager.recordLedgerEntry(
      'source:action:200' as any,
      'vessel-birth',
      'vessel-2',
      { level: 1, ancestry: 'Human' },
      'New vessel created'
    );

    expect(entry1.id).toBeDefined();
    expect(entry2.previousEntryHash).toBe(entry1.contentHash);
  });

  it('should create world snapshots at intervals', () => {
    const vessels = [createMockVessel('v1')];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    const snapshot = persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      0,
      1,
      1.0,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );

    expect(snapshot.id).toBeDefined();
    expect(snapshot.snapshotTick).toBe(0);
    expect(snapshot.vessels.length).toBe(1);
  });

  it('should verify snapshot integrity', () => {
    const vessels = [createMockVessel('v1')];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    const snapshot = persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      100,
      1,
      0.9,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );

    const isValid = persistenceManager.verifySnapshotIntegrity(snapshot);
    expect(isValid).toBe(true);
  });

  it('should query ledger by tick range', () => {
    persistenceManager.recordLedgerEntry(
      'source:action:50' as any,
      'vessel-death',
      'vessel-1',
      {},
      'Entry at 50'
    );

    persistenceManager.recordLedgerEntry(
      'source:action:100' as any,
      'vessel-birth',
      'vessel-2',
      {},
      'Entry at 100'
    );

    // Note: In real implementation, recordedAtTick would be set by caller
    // This is a simplified test
    expect(persistenceManager.queryLedger(0, 100).length).toBeGreaterThan(0);
  });

  it('should track branch markers for rewinding', () => {
    const vessels = [createMockVessel('v1')];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      3600,
      1,
      1.0,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );

    const markers = persistenceManager.getAvailableBranchMarkers();
    expect(markers.length).toBeGreaterThan(0);
  });
});

describe('ReincarnationEngine', () => {
  let reincarnationEngine: ReincarnationEngine;

  beforeEach(() => {
    reincarnationEngine = new ReincarnationEngine();
  });

  it('should create a player soul on demand', () => {
    const soul = reincarnationEngine.createPlayerSoul('player-1');

    expect(soul.id).toBeDefined();
    expect(soul.playerId).toBe('player-1');
    expect(soul.totalAncestralEchoPoints).toBe(0);
    expect(soul.inCausalLock).toBe(false);
  });

  it('should process vessel death and apply causal lock', () => {
    const soul = reincarnationEngine.createPlayerSoul('player-1');
    const vessel = createMockVessel('v1', 20);

    const deathResult = reincarnationEngine.processVesselDeath(
      vessel,
      soul,
      'death' as any,
      100,
      [] // no achievements
    );

    expect(deathResult.incarnationRecord.vesselId).toBe('v1');
    expect(soul.inCausalLock).toBe(true);
    expect(soul.causalLockExpires).toBeGreaterThan(100);
  });

  it('should calculate XP retention based on paradox debt', () => {
    const baseXp = 1000;
    const paradoxFraction = 0.25; // 25% paradox debt

    const retained = reincarnationEngine.calculateXpRetention(
      'skill-1',
      baseXp,
      paradoxFraction,
      'melee'
    );

    // Base 25% retention, reduced by paradox
    expect(retained).toBeGreaterThan(0);
    expect(retained).toBeLessThanOrEqual(baseXp * 0.25);
  });

  it('should apply flash learning boost to XP', () => {
    const skillXpGained = 100;
    const previousPeakLevel = 10;
    const currentLevel = 3;

    const boostedXp = reincarnationEngine.applyFlashLearningBoost(
      currentLevel,
      previousPeakLevel,
      skillXpGained
    );

    // Should get 10x multiplier since current < 50% of peak
    expect(boostedXp).toBe(skillXpGained * 10);
  });

  it('should not apply flash learning if above threshold', () => {
    const skillXpGained = 100;
    const previousPeakLevel = 10;
    const currentLevel = 6; // Above 50% of peak (5)

    const boostedXp = reincarnationEngine.applyFlashLearningBoost(
      currentLevel,
      previousPeakLevel,
      skillXpGained
    );

    // Should NOT get multiplier
    expect(boostedXp).toBe(skillXpGained);
  });

  it('should check causal lock status', () => {
    const soul = reincarnationEngine.createPlayerSoul('player-1');
    const vessel = createMockVessel('v1', 15);

    // Process death to trigger lock
    reincarnationEngine.processVesselDeath(
      vessel,
      soul,
      'death' as any,
      100,
      []
    );

    const isLocked = reincarnationEngine.isInCausalLock(soul, 101);
    expect(isLocked).toBe(true);

    // After lock expires
    const lockExpires = soul.causalLockExpires || 0;
    const isLockedAfterExpiry = reincarnationEngine.isInCausalLock(soul, lockExpires + 1);
    expect(isLockedAfterExpiry).toBe(false);
  });

  it('should rebind soul to new vessel', () => {
    const soul = reincarnationEngine.createPlayerSoul('player-1');
    const oldVessel = createMockVessel('v1', 15);

    // Process death
    reincarnationEngine.processVesselDeath(
      oldVessel,
      soul,
      'death' as any,
      100,
      []
    );

    // Manually clear lock for rebinding test
    soul.inCausalLock = false;

    const newVessel = createMockVessel('v2', 1);
    const rebinding = reincarnationEngine.rebindSoulToVessel(
      soul,
      oldVessel,
      newVessel,
      200,
      [] // causal vault items
    );

    expect(rebinding.id).toBeDefined();
    expect(rebinding.previousVesselId).toBe('v1');
    expect(rebinding.newVesselId).toBe('v2');
    expect(rebinding.isSuccessful).toBe(true);
  });

  it('should prevent rebinding during causal lock', () => {
    const soul = reincarnationEngine.createPlayerSoul('player-1');
    const oldVessel = createMockVessel('v1', 15);

    // Process death
    reincarnationEngine.processVesselDeath(
      oldVessel,
      soul,
      'death' as any,
      100,
      []
    );

    const newVessel = createMockVessel('v2', 1);

    // Should throw error due to causal lock
    expect(() => {
      reincarnationEngine.rebindSoulToVessel(
        soul,
        oldVessel,
        newVessel,
        101, // Still within lock period
        []
      );
    }).toThrow();
  });
});

describe('Phase5Manager', () => {
  let phase5Manager: Phase5Manager;

  beforeEach(() => {
    const constants = createMockGlobalConstants();
    phase5Manager = new Phase5Manager(constants);
  });

  it('should initialize world with state', () => {
    const vessels = [createMockVessel('v1')];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];
    const constants = createMockGlobalConstants();

    phase5Manager.initializeWorld(vessels, factions, territories, deities, constants);

    expect(phase5Manager.getCurrentTick()).toBe(0);
    expect(phase5Manager.getCurrentEpoch()).toBe(1);
  });

  it('should return persistence manager', () => {
    const persistenceManager = phase5Manager.getPersistenceManager();
    expect(persistenceManager).toBeDefined();
    expect(persistenceManager).toBeInstanceOf(PersistenceManager);
  });

  it('should return reincarnation engine', () => {
    const reincarnationEngine = phase5Manager.getReincarnationEngine();
    expect(reincarnationEngine).toBeDefined();
    expect(reincarnationEngine).toBeInstanceOf(ReincarnationEngine);
  });

  it('should advance epoch', () => {
    expect(phase5Manager.getCurrentEpoch()).toBe(1);
    phase5Manager.advanceEpoch();
    expect(phase5Manager.getCurrentEpoch()).toBe(2);
  });
});

describe('Integration Tests', () => {
  it('should handle complete death and rebirth cycle', () => {
    const constants = createMockGlobalConstants();
    const phase5Manager = new Phase5Manager(constants);
    const reincarnationEngine = phase5Manager.getReincarnationEngine();
    const persistenceManager = phase5Manager.getPersistenceManager();

    // Step 1: Create soul
    const soul = reincarnationEngine.createPlayerSoul('player-1');
    expect(soul.incarnationCount).toBe(0);

    // Step 2: Create vessel and process death
    const vessel1 = createMockVessel('v1', 20);
    const deathResult = reincarnationEngine.processVesselDeath(
      vessel1,
      soul,
      'death' as any,
      100,
      []
    );

    expect(soul.inCausalLock).toBe(true);
    expect(soul.incarnationCount).toBe(1);

    // Step 3: Record in ledger
    const ledgerEntry = persistenceManager.recordLedgerEntry(
      `death:${vessel1.id}:100` as any,
      'vessel-death',
      vessel1.id,
      deathResult.incarnationRecord,
      'Vessel died'
    );
    expect(ledgerEntry.entryType).toBe('vessel-death');

    // Step 4: Query ledger
    const entries = persistenceManager.queryLedger(0, 200, ['vessel-death']);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should maintain state hash consistency across snapshots', () => {
    const constants = createMockGlobalConstants();
    const persistenceManager = new PersistenceManager(3600);

    const vessels = [createMockVessel('v1', 10)];
    const factions = [createMockFaction('f1')];
    const territories = [createMockTerritory('t1')];
    const deities: (Deity & { influence: DivineAlignment })[] = [];

    // Create two snapshots
    const snapshot1 = persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      0,
      1,
      1.0,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );

    // Modify vessel and create another snapshot
    vessels[0].level = 15;
    const snapshot2 = persistenceManager.createWorldSnapshot(
      vessels,
      factions,
      territories,
      deities,
      constants,
      3600,
      1,
      1.0,
      { totalDebt: 0, actorsInFault: [], shadowEntitiesSpawned: 0 }
    );

    // Hashes should be different
    expect(snapshot1.stateHash).not.toBe(snapshot2.stateHash);

    // Both should verify as integral
    expect(persistenceManager.verifySnapshotIntegrity(snapshot1)).toBe(true);
    expect(persistenceManager.verifySnapshotIntegrity(snapshot2)).toBe(true);
  });
});
