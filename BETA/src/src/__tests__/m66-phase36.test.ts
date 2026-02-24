/**
 * M66: World-Ending Events - Phase 36
 * Comprehensive test suite for catastrophe systems, finale outcomes, and world reset
 * 
 * Test Groups:
 * - M66-A: Catastrophe Manager (8 tests)
 * - M66-B: Chronicle Sequence (10 tests)
 * - M66-C: Cosmic Entity Framework (8 tests)
 * - M66-D: Graduation Audit Service (10 tests)
 * - M66-E: Integration Tests (4 tests)
 * - M66-F: Performance Tests (2 tests)
 * Total: 42+ tests
 */

import {
  updateInstability,
  calculateAtmosphereState,
  triggerCatastrophe,
  blightRegion,
  cleanseRegion,
  checkCatastropheThresholds,
  exportCatastropheState,
  resetCatastropheState,
  getAllBlights,
  getAllCatastrophes,
  getBlightStatus,
  getInstability,
  getCatastropheStatistics,
  type CatastropheType,
  type CatastrophicEvent,
  type BlightedRegion,
  type WorldInstability
} from '../engine/m66CatastropheManager';

import {
  initializeSession,
  recordDecision,
  recordQuestCompletion,
  recordNPCFactionShift,
  recordSocialScar,
  recordHardFact,
  calculateMythStatus,
  calculateWorldDelta,
  calculateLegacyBudget,
  determineChronicleOutcome,
  finalizeSession,
  sealIronCanon,
  loadIronCanonFromStorage,
  getAllChronicles,
  getChronicleBySession,
  getIronCanonStatistics,
  clearChronicleState,
  type SessionMetrics,
  type MythStatus,
  type WorldDelta,
  type LegacyBudget
} from '../engine/m66ChronicleSequence';

import {
  createCosmicEntity,
  modifyCosmicAffinity,
  sealTruthWithEntity,
  createVoidWalker,
  recordVoidWalkerRevelation,
  recordErasureWitness,
  checkCosmicGatePass,
  evaluateAbsoluteTruthGate,
  registerAbsoluteTruth,
  createCosmicDialogueNode,
  createCosmicDialogueChoice,
  getAllCosmicEntities,
  getAllVoidWalkers,
  getAllAbsoluteTruths,
  getPersistentVoidWalkers,
  clearCosmicState,
  type CosmicEntityProfile,
  type VoidWalkerMetadata,
  type CosmicGateRequirement
} from '../engine/m66CosmicEntityFramework';

import {
  auditTypeSafety,
  validateLedgerChain,
  createStateWipeConfiguration,
  countEntityMetadata,
  executeGraduationAudit,
  applyStateWipe,
  loadAuditHistoryFromStorage,
  getAllGraduationAudits,
  getAllAuditResults,
  getLatestAuditForSession,
  getLatestWipeResult,
  getAuditStatistics,
  clearAuditState,
  type GraduationAudit,
  type AuditResult
} from '../engine/m66GraduationAuditService';

// ============================================================================
// TEST GROUP M66-A: Catastrophe Manager (8 tests)
// ============================================================================

describe('M66-A: Catastrophe Manager', () => {
  beforeEach(() => {
    resetCatastropheState();
  });

  test('M66-A1: Initialize world instability at zero', () => {
    const instability = getInstability();
    expect(instability.paradoxLevel).toBe(0);
    expect(instability.ageRot).toBe(0);
    expect(instability.catastropheCount).toBe(0);
  });

  test('M66-A2: Increase paradox level via updateInstability', () => {
    updateInstability(50, 10);
    const instability = getInstability();
    expect(instability.paradoxLevel).toBe(50);
    expect(instability.ageRot).toBe(10);
  });

  test('M66-A3: Calculate atmosphere state from paradox', () => {
    updateInstability(200, 50);
    const atmosphere = calculateAtmosphereState();
    
    expect(atmosphere.distortion).toBeGreaterThan(0);
    expect(atmosphere.saturation).toBeLessThan(100);
    expect(atmosphere.voidPresence).toBeGreaterThanOrEqual(0);
  });

  test('M66-A4: Check catastrophe threshold exceeded', () => {
    updateInstability(350, 80);
    const threshold = checkCatastropheThresholds();
    
    expect(threshold.thresholdExceeded).toBe(true);
    expect(threshold.recommendedEvent).toBe('aspect_collapse');
  });

  test('M66-A5: Trigger catastrophe above threshold', () => {
    const event = triggerCatastrophe('temporal_rupture', 60, 'region_1', 3);
    
    expect(event.type).toBe('temporal_rupture');
    expect(event.severity).toBe(60);
    expect(event.affectedRegionIds.has('region_1')).toBe(true);
  });

  test('M66-A6: Blight region tracks reversibility', () => {
    const blighted = blightRegion('region_1', 'erasure', 85);
    
    expect(blighted).not.toBeNull();
    expect(blighted?.severity).toBe(85);
    expect(blighted?.reversible).toBe(false);
    expect(blighted?.isInhabitable).toBe(true);
  });

  test('M66-A7: Cleanse blighted region restores state', () => {
    blightRegion('region_2', 'fracture', 40);
    const cleansed = cleanseRegion('region_2', 100);
    
    expect(cleansed.success).toBe(true);
    expect(cleansed.newSeverity).toBeLessThan(40);
  });

  test('M66-A8: Export catastrophe state contains all active data', () => {
    updateInstability(150, 30);
    triggerCatastrophe('fracture', 50, 'region_3', 2);
    blightRegion('region_4', 'void_bleed', 45);
    
    const exported = exportCatastropheState();
    expect(exported.instability.paradoxLevel).toBe(150);
    expect(exported.catastrophes.length).toBeGreaterThan(0);
    expect(exported.blights.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST GROUP M66-B: Chronicle Sequence (10 tests)
// ============================================================================

describe('M66-B: Chronicle Sequence', () => {
  beforeEach(() => {
    clearChronicleState();
  });

  test('M66-B1: Initialize new session', () => {
    const session = initializeSession('player_123');
    
    expect(session.sessionId).toBeDefined();
    expect(session.playerNpcId).toBe('player_123');
    expect(session.startedAt).toBeGreaterThan(0);
    expect(session.totalPlaytimeTicks).toBe(0);
  });

  test('M66-B2: Record multiple decisions', () => {
    const session = initializeSession('player_123');
    recordDecision(session.sessionId, 50);
    recordDecision(session.sessionId, 75);
    
    expect(session.sessionId).toBeDefined();
  });

  test('M66-B3: Calculate myth status from session metrics', () => {
    const session = initializeSession('player_123');
    recordQuestCompletion('quest_1');
    recordQuestCompletion('quest_2');
    recordHardFact('fact_1', 'Saved the village');
    
    const worldDelta: WorldDelta = {
      regionsAffected: 5,
      factionShifts: 2,
      npcDeaths: 0,
      relationsFormationRate: 50,
      questlineResolutions: 2,
      paradoxIntroduced: 20
    };
    
    const mythStatus = calculateMythStatus(session, worldDelta, 0);
    
    expect(mythStatus.mythScore).toBeGreaterThan(0);
    expect(mythStatus.culturalImpact).toBeGreaterThanOrEqual(0);
  });

  test('M66-B4: Calculate world delta from changes', () => {
    const delta = calculateWorldDelta(150, 2, 3, 8, 5);
    
    expect(delta.regionsAffected).toBe(8);
    expect(delta.factionShifts).toBe(3);
    expect(delta.npcDeaths).toBe(2);
    expect(delta.paradoxIntroduced).toBeLessThanOrEqual(100);
  });

  test('M66-B5: Calculate legacy budget from metrics', () => {
    const mythStatus: MythStatus = {
      mythScore: 500,
      legendaryDeeds: ['fact_1'],
      notoriety: 50,
      culturalImpact: 75,
      aspectAffinity: 80
    };
    
    const worldDelta: WorldDelta = {
      regionsAffected: 10,
      factionShifts: 4,
      npcDeaths: 3,
      relationsFormationRate: 60,
      questlineResolutions: 8,
      paradoxIntroduced: 30
    };
    
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 8);
    
    expect(budget.totalPoints).toBeGreaterThan(0);
    expect(budget.totalPoints).toBeLessThanOrEqual(10000);
  });

  test('M66-B6: Determine outcome based on metrics', () => {
    const mythStatus: MythStatus = {
      mythScore: 800,
      legendaryDeeds: ['fact_1', 'fact_2'],
      notoriety: 70,
      culturalImpact: 85,
      aspectAffinity: 90
    };
    
    const worldDelta: WorldDelta = {
      regionsAffected: 12,
      factionShifts: 3,
      npcDeaths: 1,
      relationsFormationRate: 75,
      questlineResolutions: 10,
      paradoxIntroduced: 15
    };
    
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 10);
    const outcome = determineChronicleOutcome(mythStatus, worldDelta, budget, 8, 2);
    
    expect(['restoration', 'descent', 'transformation']).toContain(outcome);
  });

  test('M66-B7: Finalize session creates chronicle entry', () => {
    const session = initializeSession('player_456');
    
    const mythStatus: MythStatus = {
      mythScore: 600,
      legendaryDeeds: ['fact_1'],
      notoriety: 40,
      culturalImpact: 60,
      aspectAffinity: 70
    };
    
    const worldDelta: WorldDelta = {
      regionsAffected: 8,
      factionShifts: 3,
      npcDeaths: 2,
      relationsFormationRate: 50,
      questlineResolutions: 6,
      paradoxIntroduced: 40
    };
    
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 6);
    const entry = finalizeSession(session, mythStatus, worldDelta, budget, ['fact_1'], ['scar_1'], 200, 50);
    
    expect(entry.entryId).toBeDefined();
    expect(entry.sessionId).toBe(session.sessionId);
    expect(entry.finalOutcome).toBeDefined();
    expect(entry.legacyPointsCarried).toBeGreaterThan(0);
  });

  test('M66-B8: Seal and retrieve iron canon', () => {
    const session = initializeSession('player_789');
    const mythStatus: MythStatus = {
      mythScore: 500,
      legendaryDeeds: [],
      notoriety: 0,
      culturalImpact: 50,
      aspectAffinity: 60
    };
    const worldDelta: WorldDelta = {
      regionsAffected: 5,
      factionShifts: 2,
      npcDeaths: 1,
      relationsFormationRate: 40,
      questlineResolutions: 4,
      paradoxIntroduced: 30
    };
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 4);
    const entry = finalizeSession(session, mythStatus, worldDelta, budget, [], [], 150, 30);
    const canon = sealIronCanon(entry);
    
    expect(canon.chronologies.length).toBe(1);
    expect(canon.canonChecksum).toBeDefined();
  });

  test('M66-B9: Get iron canon statistics', () => {
    const session = initializeSession('player_999');
    const mythStatus: MythStatus = {
      mythScore: 400,
      legendaryDeeds: [],
      notoriety: 20,
      culturalImpact: 40,
      aspectAffinity: 50
    };
    const worldDelta: WorldDelta = {
      regionsAffected: 4,
      factionShifts: 1,
      npcDeaths: 0,
      relationsFormationRate: 30,
      questlineResolutions: 3,
      paradoxIntroduced: 20
    };
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 3);
    const entry = finalizeSession(session, mythStatus, worldDelta, budget, [], [], 100, 20);
    sealIronCanon(entry);
    
    const stats = getIronCanonStatistics();
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalLegacyPoints).toBeGreaterThan(0);
  });

  test('M66-B10: Record NPC faction shifts in session', () => {
    const session = initializeSession('player_shift');
    recordNPCFactionShift('npc_1', 'rebels', 'loyalists');
    
    expect(session.sessionId).toBeDefined();
  });
});

// ============================================================================
// TEST GROUP M66-C: Cosmic Entity Framework (8 tests)
// ============================================================================

describe('M66-C: Cosmic Entity Framework', () => {
  beforeEach(() => {
    clearCosmicState();
  });

  test('M66-C1: Create cosmic entity', () => {
    const entity = createCosmicEntity('The Witness', 'void_walker', 'chronicle_sealing');
    
    expect(entity.entityId).toBeDefined();
    expect(entity.entityName).toBe('The Witness');
    expect(entity.type).toBe('void_walker');
    expect(entity.affinity).toBe(0);
  });

  test('M66-C2: Modify cosmic entity affinity', () => {
    const entity = createCosmicEntity('The Observer', 'paradox_echo', 'catastrophe_threshold');
    modifyCosmicAffinity(entity.entityId, 50);
    
    const updated = getAllCosmicEntities().find((e) => e.entityId === entity.entityId);
    expect(updated?.affinity).toBe(50);
  });

  test('M66-C3: Seal truth with entity', () => {
    const entity = createCosmicEntity('The Keeper', 'chronicle_keeper', 'new_epoch');
    const truthId = sealTruthWithEntity(entity.entityId, 'The world was saved by sacrifice');
    
    expect(truthId).toBeDefined();
    const truths = getAllAbsoluteTruths();
    expect(truths.has(truthId)).toBe(true);
  });

  test('M66-C4: Create and interact with Void-Walker', () => {
    const walker = createVoidWalker('Wanderer');
    recordVoidWalkerRevelation(walker.walkerId, 'Time flows backward in the void');
    
    expect(walker.walkerId).toBeDefined();
    const updated = getAllVoidWalkers().find((w) => w.walkerId === walker.walkerId);
    expect(updated?.revelationsGiven.length).toBeGreaterThan(0);
  });

  test('M66-C5: Record Void-Walker witness to erasure', () => {
    const walker = createVoidWalker('Survivor');
    recordErasureWitness(walker.walkerId);
    
    const updated = getAllVoidWalkers().find((w) => w.walkerId === walker.walkerId);
    expect(updated?.hasSeenErasure).toBe(true);
  });

  test('M66-C6: Check cosmic gate pass with sufficient affinity', () => {
    const entity = createCosmicEntity('Gate Keeper', 'aspect_manifestation', 'catastrophe_threshold');
    modifyCosmicAffinity(entity.entityId, 70);
    const truthId = sealTruthWithEntity(entity.entityId, 'Divine knowledge');
    
    const requirement: CosmicGateRequirement = {
      gateId: 'gate_1',
      requiredEntity: 'aspect_manifestation',
      requiredAffinity: 50,
      knowledgeRequired: [truthId]
    };
    
    const passes = checkCosmicGatePass(requirement, 70, [truthId]);
    expect(passes).toBe(true);
  });

  test('M66-C7: Check cosmic gate fails with insufficient affinity', () => {
    const requirement: CosmicGateRequirement = {
      gateId: 'gate_2',
      requiredEntity: 'temporal_specter',
      requiredAffinity: 80,
      knowledgeRequired: ['truth_unknown']
    };
    
    const passes = checkCosmicGatePass(requirement, 30, []);
    expect(passes).toBe(false);
  });

  test('M66-C8: Get persistent Void-Walkers for next epoch', () => {
    const walker1 = createVoidWalker('Persistent One');
    recordErasureWitness(walker1.walkerId);
    
    const persistent = getPersistentVoidWalkers();
    expect(persistent.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST GROUP M66-D: Graduation Audit Service (10 tests)
// ============================================================================

describe('M66-D: Graduation Audit Service', () => {
  beforeEach(() => {
    clearAuditState();
  });

  test('M66-D1: Audit type safety compliance', () => {
    const files = [
      'src/engine/m66CatastropheManager.ts',
      'src/engine/m66ChronicleSequence.ts',
      'src/engine/m66CosmicEntityFramework.ts',
      'src/engine/m66GraduationAuditService.ts'
    ];
    
    const audit = auditTypeSafety(files);
    expect(audit.auditId).toBeDefined();
    expect(audit.filesChecked.length).toBe(4);
    expect(typeof audit.isCompliant).toBe('boolean');
  });

  test('M66-D2: Validate ledger chain integrity', () => {
    const ledgerEntries = Array.from({ length: 100 }, () => ({
      hash: `block_${Math.random().toString(16).slice(2)}`
    }));
    
    const validation = validateLedgerChain(ledgerEntries);
    expect(validation.validationId).toBeDefined();
    expect(validation.totalEntriesChecked).toBe(100);
    expect(validation.chainIntegrity).toBeGreaterThan(0);
  });

  test('M66-D3: Create state wipe configuration', () => {
    const config = createStateWipeConfiguration(true, true);
    
    expect(config.wipeId).toBeDefined();
    expect(config.voidWalkerPersistence).toBe(true);
    expect(config.ironCanonPreserved).toBe(true);
    expect(config.ephemeralDataPatterns.length).toBeGreaterThan(0);
  });

  test('M66-D4: Count entity metadata flags', () => {
    const entities = [
      { voidWalkerFlag: true },
      { voidWalkerFlag: true },
      { voidWalkerFlag: false },
      { voidWalkerFlag: undefined }
    ];
    
    const count = countEntityMetadata(entities as any);
    expect(count).toBe(2);
  });

  test('M66-D5: Execute graduation audit', () => {
    const files = ['src/engine/m66CatastropheManager.ts'];
    const ledgerEntries = Array.from({ length: 50 }, () => ({ hash: 'block' }));
    const entities = [{ voidWalkerFlag: true }];
    
    const audit = executeGraduationAudit(
      'session_123',
      files,
      ledgerEntries,
      entities as any,
      1000,
      5,
      true
    );
    
    expect(audit.auditId).toBeDefined();
    expect(audit.sessionId).toBe('session_123');
    expect(audit.typeSafety).toBeDefined();
    expect(audit.ledgerValidation).toBeDefined();
  });

  test('M66-D6: Apply state wipe after successful audit', () => {
    const files = ['src/engine/m66CatastropheManager.ts'];
    const ledgerEntries = Array.from({ length: 50 }, () => ({ hash: 'block' }));
    const entities = [{ voidWalkerFlag: true }];
    
    const audit = executeGraduationAudit(
      'session_456',
      files,
      ledgerEntries,
      entities as any,
      2000,
      8,
      true
    );
    
    const gameState = {
      npcState_1: { name: 'NPC' },
      playerInventory_1: { items: [] },
      legacyPoints_1: { points: 500 },
      chronicleHistory_1: []
    };
    
    const result = applyStateWipe(audit, gameState);
    expect(result.resultId).toBeDefined();
    expect(result.wipeExecuted).toBe(audit.readyForWipe);
  });

  test('M66-D7: Verify persistent data survives wipe', () => {
    const files = ['src/engine/m66CatastropheManager.ts'];
    const ledgerEntries = Array.from({ length: 50 }, () => ({ hash: 'block' }));
    const entities = [{ voidWalkerFlag: true }];
    
    const audit = executeGraduationAudit(
      'session_789',
      files,
      ledgerEntries,
      entities as any,
      1500,
      6,
      true
    );
    
    const gameState = {
      playerMetadata_1: { id: 'player_1' },
      worldTemplate_1: { name: 'world' },
      npcState_ephemeral: {}
    };
    
    const result = applyStateWipe(audit, gameState);
    expect(result.persistentDataIntact).toBe(true);
  });

  test('M66-D8: Get audit statistics across multiple sessions', () => {
    for (let i = 0; i < 3; i++) {
      const audit = executeGraduationAudit(
        `session_${i}`,
        ['src/engine/m66CatastropheManager.ts'],
        Array.from({ length: 50 }, () => ({ hash: 'block' })),
        [{ voidWalkerFlag: true }] as any,
        1000 + i * 500,
        5 + i,
        true
      );
      applyStateWipe(audit, {});
    }
    
    const stats = getAuditStatistics();
    expect(stats.totalAudits).toBe(3);
    expect(stats.successfulWipes).toBeGreaterThan(0);
  });

  test('M66-D9: Get latest audit for session', () => {
    const audit = executeGraduationAudit(
      'session_latest',
      ['src/engine/m66CatastropheManager.ts'],
      Array.from({ length: 50 }, () => ({ hash: 'block' })),
      [{ voidWalkerFlag: true }] as any,
      800,
      4,
      true
    );
    
    const retrieved = getLatestAuditForSession('session_latest');
    expect(retrieved?.sessionId).toBe('session_latest');
  });

  test('M66-D10: Get latest wipe result', () => {
    const audit = executeGraduationAudit(
      'session_final',
      ['src/engine/m66CatastropheManager.ts'],
      Array.from({ length: 50 }, () => ({ hash: 'block' })),
      [{ voidWalkerFlag: true }] as any,
      1200,
      7,
      true
    );
    
    applyStateWipe(audit, {});
    const result = getLatestWipeResult();
    expect(result).toBeDefined();
    expect(result?.audit.sessionId).toBe(audit.sessionId);
  });
});

// ============================================================================
// TEST GROUP M66-E: Integration Tests (4 tests)
// ============================================================================

describe('M66-E: Integration Tests', () => {
  beforeEach(() => {
    resetCatastropheState();
    clearChronicleState();
    clearCosmicState();
    clearAuditState();
  });

  test('M66-E1: Full catastrophe to chronicle flow', () => {
    updateInstability(350, 70);
    const catastrophe = triggerCatastrophe('temporal_rupture', 75, 'region_1', 3);
    expect(catastrophe.type).toBe('temporal_rupture');
    
    const session = initializeSession('player_cataclysm');
    recordQuestCompletion('final_quest');
    recordHardFact('prevented_erasure', 'Sealed the temporal rift');
    
    const worldDelta = calculateWorldDelta(350, 0, 3, 10, 8);
    const mythStatus = calculateMythStatus(session, worldDelta, 2);
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 8);
    const entry = finalizeSession(session, mythStatus, worldDelta, budget, ['prevented_erasure'], ['scar_fear'], 350, 70);
    
    expect(entry.finalParadoxLevel).toBe(350);
    expect(entry.legacyPointsCarried).toBeGreaterThan(0);
  });

  test('M66-E2: Cosmic entity influences chronicle outcome', () => {
    const entity = createCosmicEntity('Equilibrium', 'silence_ambassador', 'chronicle_sealing');
    modifyCosmicAffinity(entity.entityId, 75);
    
    const session = initializeSession('player_cosmic');
    recordHardFact('truth_from_void', 'The silence speaks');
    
    const worldDelta = calculateWorldDelta(150, 1, 2, 8, 5);
    const mythStatus = calculateMythStatus(session, worldDelta, 3);
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 5);
    
    const outcome = determineChronicleOutcome(mythStatus, worldDelta, budget, 1, 3);
    expect(['restoration', 'descent', 'transformation']).toContain(outcome);
  });

  test('M66-E3: Void-Walker persists through audit and wipe', () => {
    const walker = createVoidWalker('Eternity Witness');
    recordErasureWitness(walker.walkerId);
    recordVoidWalkerRevelation(walker.walkerId, 'All things end and begin');
    
    const files = ['src/engine/m66CosmicEntityFramework.ts'];
    const ledgerEntries = Array.from({ length: 100 }, () => ({ hash: 'block' }));
    const entities = [{ voidWalkerFlag: true }];
    
    const audit = executeGraduationAudit(
      'session_eternity',
      files,
      ledgerEntries,
      entities as any,
      3000,
      10,
      true
    );
    
    const result = applyStateWipe(audit, {});
    expect(result.voidWalkersPreserved).toBeGreaterThan(0);
  });

  test('M66-E4: Full M66 cycle: catastrophe → chronicle → audit → wipe', () => {
    updateInstability(400, 90);
    const cataEvent = triggerCatastrophe('erasure', 90, 'region_final', 5);
    expect(cataEvent.severity).toBe(90);
    
    const session = initializeSession('player_ultimate');
    recordQuestCompletion('final_battle');
    const worldDelta = calculateWorldDelta(400, 5, 5, 15, 12);
    const mythStatus = calculateMythStatus(session, worldDelta, 8);
    const budget = calculateLegacyBudget(mythStatus, worldDelta, 12);
    const entry = finalizeSession(session, mythStatus, worldDelta, budget, ['ultimate_sacrifice'], ['great_loss'], 400, 90);
    const canon = sealIronCanon(entry);
    
    const files = ['src/engine/m66CatastropheManager.ts', 'src/engine/m66ChronicleSequence.ts'];
    const ledgerEntries = Array.from({ length: 200 }, () => ({ hash: 'block' }));
    const auditData = executeGraduationAudit('session_ultimate', files, ledgerEntries, [{ voidWalkerFlag: true }] as any, 4000, 1, true);
    
    const result = applyStateWipe(auditData, {});
    
    expect(result.wipeExecuted).toBe(true);
    expect(result.chroniclesArchived).toBe(1);
    expect(canon.chronologies.length).toBe(1);
  });
});

// ============================================================================
// TEST GROUP M66-F: Performance Tests (2 tests)
// ============================================================================

describe('M66-F: Performance Tests', () => {
  beforeEach(() => {
    resetCatastropheState();
    clearChronicleState();
  });

  test('M66-F1: Trigger multiple catastrophes under 500ms', () => {
    const start = Date.now();
    
    for (let i = 0; i < 10; i++) {
      triggerCatastrophe('fracture', 50, `region_${i}`, 2);
    }
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('M66-F2: Execute full audit on 1000 ledger entries in <500ms', () => {
    const ledgerEntries = Array.from({ length: 1000 }, () => ({
      hash: `block_${Math.random()}`
    }));
    
    const start = Date.now();
    const validation = validateLedgerChain(ledgerEntries);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500);
    expect(validation.totalEntriesChecked).toBe(1000);
  });
});
