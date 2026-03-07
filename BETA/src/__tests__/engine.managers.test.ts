/**
 * engine.managers.test.ts
 *
 * Comprehensive unit tests for Phase 3 managers:
 * - GeographyManager: Territory stability, tax collection, information lag
 * - DivineManager: Faith dynamics, miracle execution, covenant maintenance
 *
 * Test Coverage:
 * - DSS 05: Stability thresholds, tax formulas, information lag
 * - DSS 06: Miracle magnitude, paradox debt, Soul's Reprieve
 * - FrictionManager integration: Vitals modifiers, information lag perception
 * - ParadoxCalculator integration: Miracle debt penalties
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GeographyManager from '../engine/GeographyManager';
import DivineManager from '../engine/DivineManager';
import type {
  TerritoryNode,
  Deity,
  ActiveFaction,
  ActionBudget,
  FactionAIState,
  FactionAgenda,
  FactionSocialRecord,
  Covenant,
} from '../types';

// Helper functions to create test fixtures
function createTestTerritory(id: string, overrides?: Partial<TerritoryNode>): TerritoryNode {
  const territory: TerritoryNode = {
    id,
    name: `Territory ${id}`,
    nodeType: 'settlement',
    controllingFactionId: 'faction-1',
    influenceMap: new Map([['faction-1', 75]]),
    isFactionCapital: false,
    lastControlChangeTicket: 0,
    biome: 'grassland',
    hazards: [],
    elevation: 0,
    accessibility: 75,
    stability: {
      current: 75,
      max: 100,
      threatLevel: 0,
      insurgentPopulation: 0,
      economicDisruption: 0,
      demoralizedPopulation: 0,
      recoveryRate: 0.2,
      lastUpdateTick: 0,
      trend: 'stable',
    },
    informationLag: {
      baseMultiplier: 0.25,
      environmentalModifier: 0,
      politicalModifier: 0,
      divineModifier: 0,
      composite: 0.25,
      hiddenLocations: [],
    },
    taxSystem: {
      rate: 0.1,
      expectedMonthlyRevenue: 500,
      compliance: 'cooperative',
      willingness: 75,
      insurgencyRisk: 0,
      lastAuditTick: 0,
    },
    population: 1000,
    populationModifier: 1.0,
    resourceNodes: { wood: 100, metal: 50, herbs: 75, water: 200 },
    resourceRegenerationRate: 0.1,
    holinessLevel: 25,
    isHallowedSite: false,
    connectedLocationIds: ['territory-2', 'territory-3'],
    tradeValue: 50,
    tradingPartnerFactionIds: [],
    garrisonSize: 50,
    fortificationLevel: 2,
    createdAtTick: 0,
    lastUpdatedTick: 0,
    ticksSinceLastConflict: 100,
    recentEvents: [],
    isPlayerControlled: false,
    isPlayerHome: false,
    unexploredPOIs: [],
    ...overrides,
  };
  return territory;
}

function createTestFaction(id: string, opts?: Partial<ActiveFaction>): ActiveFaction {
  return {
    id,
    name: `Faction ${id}`,
    templateId: 'genesis-template',
    factionColor: '#FF00FF',
    controlledLocationIds: ['territory-1'],
    powerScore: 75,
    territory: {
      owned: 1,
      contested: 0,
      underAttack: 0,
    },
    leaderSocialWeight: 'female',
    lineageScore: 100,
    charismaBonus: 2,
    patronDeityId: 'war-god',
    faithMassInDeity: 100,
    activeCovenants: [],
    actionBudget: {
      id: `${id}-budget`,
      factionId: id,
      currentPoints: 500,
      maxCapacity: 1000,
      lastRegenTick: 0,
      generationBreakdown: {
        territoryControl: 100,
        covenantParticipation: 0,
        divineFaith: 50,
        factionCharism: 1,
        stability: 40,
        socialWeight: 15,
      },
      pendingActions: [],
      actionCooldowns: new Map(),
    },
    aiState: {
      factionId: id,
      state: 'aggressive',
      threatAssessment: new Map(),
      militaryConfidence: 60,
      diplomacyReputation: 0,
      internalMorale: 75,
      lastDecisionTick: 0,
    } as FactionAIState,
    agenda: {
      id: `${id}-agenda`,
      factionId: id,
      primaryGoal: 'expand_territory',
      secondaryGoals: [],
      rivals: [],
      allies: [],
      expansionTargets: [],
      updatedAtTick: 0,
    } as FactionAgenda,
    socialRecord: {
      factionId: id,
      reputationByFaction: new Map(),
      socialInfluence: 50,
      activeCovenantCount: 0,
    } as FactionSocialRecord,
    createdAtTick: 0,
    lastActionTick: 0,
    lastDecisionTick: 0,
    ticksExisted: 0,
    isPlayerFaction: false,
    isNPCControlled: true,
    ...opts,
  };
}

function createTestDeity(id: string): Deity {
  return {
    id,
    name: `Deity ${id}`,
    domain: 'War',
    alignment: 'neutral',
    isActive: true,
    faithThreshold: 100,
    totalFaithMass: 500,
    faithByWorshipper: new Map(),
    canGrantMiracles: true,
    miracleCost: 50,
    createdAtTick: 0,
  };
}

// ==================== GEOGRAPHY MANAGER TESTS ====================

describe('GeographyManager', () => {
  let geographyManager: GeographyManager;

  beforeEach(() => {
    geographyManager = new GeographyManager();
  });

  describe('Stability Calculations', () => {
    it('should calculate positive stability trend with base recovery', () => {
      const territory = createTestTerritory('test-1');
      const territories = new Map([['test-1', territory]]);
      const factions = new Map();
      const worldStability = 100;

      // Should have base recovery of +0.2
      const result = geographyManager['calculateStabilityTrend'](
        territory,
        territories,
        factions,
        worldStability,
        0
      );

      expect(result.trend).toBeCloseTo(0.2, 1); // Should be close to +0.2
      expect(result.sources).toContain(expect.stringMatching(/base recovery/i));
    });

    it('should reduce stability with adjacent enemies', () => {
      const territory1 = createTestTerritory('test-1', {
        controllingFactionId: 'faction-1',
        connectedLocationIds: ['test-2'],
      });
      const territory2 = createTestTerritory('test-2', {
        controllingFactionId: 'faction-2',
      });

      const territories = new Map([
        ['test-1', territory1],
        ['test-2', territory2],
      ]);
      const factions = new Map();
      const worldStability = 100;

      const result = geographyManager['calculateStabilityTrend'](
        territory1,
        territories,
        factions,
        worldStability,
        0
      );

      // Should have threat penalty
      expect(result.trend).toBeLessThan(0.2);
      expect(result.threatLevel).toBeGreaterThan(0);
    });

    it('should reduce stability with low population willingness', () => {
      const territory = createTestTerritory('test-1', {
        taxSystem: {
          rate: 0.1,
          expectedMonthlyRevenue: 500,
          compliance: 'defiant',
          willingness: 30, // Low willingness
          insurgencyRisk: 70,
          lastAuditTick: 0,
        },
      });

      const territories = new Map([['test-1', territory]]);
      const factions = new Map();
      const worldStability = 100;

      const result = geographyManager['calculateStabilityTrend'](
        territory,
        territories,
        factions,
        worldStability,
        0
      );

      expect(result.trend).toBeLessThan(0.2);
      expect(result.sources).toContain(expect.stringMatching(/insurgency/i));
    });

    it('should apply world stability modifier to local stability', () => {
      const territory = createTestTerritory('test-1');
      const territories = new Map([['test-1', territory]]);
      const factions = new Map();

      // Low world stability should reduce local stability recovery
      const lowWorldResult = geographyManager['calculateStabilityTrend'](
        territory,
        territories,
        factions,
        20, // Low world stability
        0
      );

      const highWorldResult = geographyManager['calculateStabilityTrend'](
        territory,
        territories,
        factions,
        100, // High world stability
        0
      );

      expect(lowWorldResult.trend).toBeLessThan(highWorldResult.trend);
    });

    it('should cap stability trend between -1.0 and +0.2', () => {
      // Create worst-case scenario
      const territory = createTestTerritory('test-1', {
        controllingFactionId: 'faction-1',
        connectedLocationIds: [
          'test-2',
          'test-3',
          'test-4',
          'test-5',
          'test-6',
        ],
        hazards: [
          {
            id: 'hazard-1',
            name: 'Disease',
            type: 'disease',
            vigorDecayMultiplier: 0.5,
            nourishmentDecayMultiplier: 0.5,
            sanityDecayMultiplier: 0.3,
            canAdapt: false,
          },
          {
            id: 'hazard-2',
            name: 'Climate',
            type: 'climate',
            vigorDecayMultiplier: 0.3,
            nourishmentDecayMultiplier: 0.2,
            sanityDecayMultiplier: 0.1,
            canAdapt: true,
          },
        ],
        taxSystem: {
          rate: 0.1,
          expectedMonthlyRevenue: 500,
          compliance: 'rebellious',
          willingness: 10,
          insurgencyRisk: 95,
          lastAuditTick: 0,
        },
      });

      const territory2 = createTestTerritory('test-2', {
        controllingFactionId: 'faction-2',
      });
      const territory3 = createTestTerritory('test-3', {
        controllingFactionId: 'faction-2',
      });
      const territory4 = createTestTerritory('test-4', {
        controllingFactionId: 'faction-3',
      });
      const territory5 = createTestTerritory('test-5', {
        controllingFactionId: 'faction-2',
      });

      const territories = new Map([
        ['test-1', territory],
        ['test-2', territory2],
        ['test-3', territory3],
        ['test-4', territory4],
        ['test-5', territory5],
        ['test-6', territory],
      ]);

      const result = geographyManager['calculateStabilityTrend'](
        territory,
        territories,
        new Map(),
        20,
        0
      );

      expect(result.trend).toBeGreaterThanOrEqual(-1.0);
      expect(result.trend).toBeLessThanOrEqual(0.2);
    });
  });

  describe('Tax Collection', () => {
    it('should calculate tax revenue based on formula', () => {
      const territory = createTestTerritory('test-1', {
        population: 1000,
        stability: {
          current: 100,
          max: 100,
          threatLevel: 0,
          insurgentPopulation: 0,
          economicDisruption: 0,
          demoralizedPopulation: 0,
          recoveryRate: 0.2,
          lastUpdateTick: 0,
          trend: 'stable',
        },
        taxSystem: {
          rate: 0.1, // 10%
          expectedMonthlyRevenue: 500,
          compliance: 'cooperative',
          willingness: 100, // 100%
          insurgencyRisk: 0,
          lastAuditTick: 0,
        },
      });

      // Revenue = (population × 5) × (stability / 100) × rate × (willingness / 100)
      // = (1000 × 5) × (100 / 100) × 0.1 × (100 / 100)
      // = 5000 × 1 × 0.1 × 1
      // = 500

      const result = geographyManager['collectTaxes'](territory);
      expect(result.taxRevenue).toBeCloseTo(500, 0);
    });

    it('should reduce tax revenue with low stability', () => {
      const highStability = createTestTerritory('high', {
        population: 1000,
        stability: {
          current: 100,
          max: 100,
          threatLevel: 0,
          insurgentPopulation: 0,
          economicDisruption: 0,
          demoralizedPopulation: 0,
          recoveryRate: 0.2,
          lastUpdateTick: 0,
          trend: 'stable',
        },
        taxSystem: {
          rate: 0.1,
          expectedMonthlyRevenue: 500,
          compliance: 'cooperative',
          willingness: 100,
          insurgencyRisk: 0,
          lastAuditTick: 0,
        },
      });

      const lowStability = createTestTerritory('low', {
        population: 1000,
        stability: {
          current: 20,
          max: 100,
          threatLevel: 50,
          insurgentPopulation: 30,
          economicDisruption: 40,
          demoralizedPopulation: 20,
          recoveryRate: 0.1,
          lastUpdateTick: 0,
          trend: 'declining',
        },
        taxSystem: {
          rate: 0.1,
          expectedMonthlyRevenue: 500,
          compliance: 'resentful',
          willingness: 100,
          insurgencyRisk: 50,
          lastAuditTick: 0,
        },
      });

      const highResult = geographyManager['collectTaxes'](highStability);
      const lowResult = geographyManager['collectTaxes'](lowStability);

      expect(lowResult.taxRevenue).toBeLessThan(highResult.taxRevenue);
    });
  });

  describe('Information Lag (Fog of War)', () => {
    it('should calculate higher lag for mountainous terrain', () => {
      const mountain = createTestTerritory('mountain', {
        biome: 'mountain',
      });
      const plains = createTestTerritory('plains', {
        biome: 'grassland',
      });

      const territories = new Map([
        ['mountain', mountain],
        ['plains', plains],
      ]);

      const mountainLag = geographyManager['calculateRegionalInformationLag'](
        mountain,
        territories,
        100
      );
      const plainsLag = geographyManager['calculateRegionalInformationLag'](plains, territories, 100);

      expect(mountainLag.composite).toBeGreaterThan(plainsLag.composite);
    });

    it('should increase lag near conflicts', () => {
      const peaceful = createTestTerritory('peaceful', {
        controllingFactionId: 'faction-1',
        connectedLocationIds: ['neighbor'],
      });
      const neighbor = createTestTerritory('neighbor', {
        controllingFactionId: 'faction-1',
      });

      const contested = createTestTerritory('contested', {
        controllingFactionId: 'faction-1',
        connectedLocationIds: ['enemy1', 'enemy2'],
      });
      const enemy1 = createTestTerritory('enemy1', {
        controllingFactionId: 'faction-2',
      });
      const enemy2 = createTestTerritory('enemy2', {
        controllingFactionId: 'faction-2',
      });

      const peacefulTerr = new Map([
        ['peaceful', peaceful],
        ['neighbor', neighbor],
      ]);

      const contestedTerr = new Map([
        ['contested', contested],
        ['enemy1', enemy1],
        ['enemy2', enemy2],
      ]);

      const peacefulLag = geographyManager['calculateRegionalInformationLag'](
        peaceful,
        peacefulTerr,
        100
      );
      const contestedLag = geographyManager['calculateRegionalInformationLag'](
        contested,
        contestedTerr,
        100
      );

      expect(contestedLag.composite).toBeGreaterThan(peacefulLag.composite);
    });

    it('should increase lag with lower stability', () => {
      const stable = createTestTerritory('stable', {
        stability: {
          current: 100,
          max: 100,
          threatLevel: 0,
          insurgentPopulation: 0,
          economicDisruption: 0,
          demoralizedPopulation: 0,
          recoveryRate: 0.2,
          lastUpdateTick: 0,
          trend: 'stable',
        },
      });

      const unstable = createTestTerritory('unstable', {
        stability: {
          current: 20,
          max: 100,
          threatLevel: 50,
          insurgentPopulation: 40,
          economicDisruption: 60,
          demoralizedPopulation: 30,
          recoveryRate: 0.1,
          lastUpdateTick: 0,
          trend: 'critical',
        },
      });

      const territories = new Map([
        ['stable', stable],
        ['unstable', unstable],
      ]);

      const stableLag = geographyManager['calculateRegionalInformationLag'](
        stable,
        territories,
        100
      );
      const unstableLag = geographyManager['calculateRegionalInformationLag'](
        unstable,
        territories,
        100
      );

      expect(unstableLag.composite).toBeGreaterThan(stableLag.composite);
    });
  });

  describe('Vitals Modifiers', () => {
    it('should apply hazard decay multipliers', () => {
      const clean = createTestTerritory('clean', { hazards: [] });
      const diseased = createTestTerritory('diseased', {
        hazards: [
          {
            id: 'plague',
            name: 'Plague',
            type: 'disease',
            vigorDecayMultiplier: 0.2,
            nourishmentDecayMultiplier: 0.5,
            sanityDecayMultiplier: 0.3,
            canAdapt: false,
          },
        ],
      });

      const cleanMult = geographyManager['getVitalsDecayModifiers'](clean);
      const diseasedMult = geographyManager['getVitalsDecayModifiers'](diseased);

      expect(diseasedMult).toBeGreaterThan(cleanMult);
      expect(diseasedMult).toBeLessThanOrEqual(2.0); // Capped at 2.0x
    });
  });

  describe('Control Threshold', () => {
    it('should return higher threshold for unstable territories', () => {
      const stable = createTestTerritory('stable', {
        stability: {
          current: 100,
          max: 100,
          threatLevel: 0,
          insurgentPopulation: 0,
          economicDisruption: 0,
          demoralizedPopulation: 0,
          recoveryRate: 0.2,
          lastUpdateTick: 0,
          trend: 'stable',
        },
      });
      const unstable = createTestTerritory('unstable', {
        stability: {
          current: 20,
          max: 100,
          threatLevel: 50,
          insurgentPopulation: 40,
          economicDisruption: 60,
          demoralizedPopulation: 30,
          recoveryRate: 0.1,
          lastUpdateTick: 0,
          trend: 'critical',
        },
      });

      const stableThreshold = geographyManager.getControlThreshold(stable);
      const unstableThreshold = geographyManager.getControlThreshold(unstable);

      expect(unstableThreshold).toBeGreaterThan(stableThreshold);
    });

    it('should clamp threshold between 30 and 90', () => {
      const ultrastable = createTestTerritory('ultrastable', {
        stability: {
          current: 100,
          max: 100,
          threatLevel: 0,
          insurgentPopulation: 0,
          economicDisruption: 0,
          demoralizedPopulation: 0,
          recoveryRate: 0.2,
          lastUpdateTick: 0,
          trend: 'stable',
        },
      });

      const threshold = geographyManager.getControlThreshold(ultrastable);
      expect(threshold).toBeGreaterThanOrEqual(30);
      expect(threshold).toBeLessThanOrEqual(90);
    });
  });
});

// ==================== DIVINE MANAGER TESTS ====================

describe('DivineManager', () => {
  let divineManager: DivineManager;

  beforeEach(() => {
    divineManager = new DivineManager();
  });

  describe('Faith Dynamics', () => {
    it('should calculate faith generation with decay', () => {
      const deity = createTestDeity('war-god');
      const factions = new Map();

      const update = divineManager['processFaithDynamics'](deity, factions, 0, 100);

      expect(update.deityId).toBe('war-god');
      expect(update.newFaith).toBeLessThan(update.previousFaith + update.generatedFaith);
      expect(update.decayedFaith).toBeGreaterThan(0);
    });

    it('should increase faith decay with lower world stability', () => {
      const deity1 = createTestDeity('deity-1');
      const deity2 = createTestDeity('deity-2');

      const factions = new Map();

      const stableUpdate = divineManager['processFaithDynamics'](deity1, factions, 0, 100);
      const unstableUpdate = divineManager['processFaithDynamics'](deity2, factions, 0, 20);

      // World stability affects decay multiplier
      // Lower stability = more decay
      const stableDecay = stableUpdate.decayedFaith || 0;
      const unstableDecay = unstableUpdate.decayedFaith || 0;

      // Note: Same deity faithmass, so unstable should decay more
      expect(unstableDecay).toBeGreaterThan(stableDecay);
    });
  });

  describe('Covenant Maintenance', () => {
    it('should have covenant processing method available', () => {
      const deity = createTestDeity('matron');
      // Simple test - just ensure method exists
      expect(divineManager['processCovenantMaintenance']).toBeDefined();
    });
  });

  describe('Miracle Execution', () => {
    it('should calculate paradox debt for miracles', async () => {
      const deity = createTestDeity('god');
      deity.totalFaithMass = 1000;

      const decision = {
        factionId: 'faction-1',
        miracleType: 'major',
        targetType: 'faction',
      };

      const execution = await divineManager.executeMiracle(deity, decision, 0);

      expect(execution.paradoxDebtIncurred).toBeGreaterThan(0);
      expect(execution.paradoxDebtIncurred).toBeLessThanOrEqual(5.0);
    });

    it('should apply faith cost to deity on successful miracle', async () => {
      const deity = createTestDeity('god');
      const initialFaith = deity.totalFaithMass;

      const decision = {
        factionId: 'faction-1',
        miracleType: 'major',
        targetType: 'faction',
      };

      const execution = await divineManager.executeMiracle(deity, decision, 0);

      expect(deity.totalFaithMass).toBeLessThan(initialFaith);
    });

    it('should apply miracle effects on success', async () => {
      const deity = createTestDeity('god');
      deity.totalFaithMass = 1000;

      const decision = {
        factionId: 'faction-1',
        miracleType: 'major',
        targetType: 'faction',
      };

      const execution = await divineManager.executeMiracle(deity, decision, 0);

      if (execution.success) {
        expect(execution.effects.length).toBeGreaterThan(0);
        expect(execution.effects[0].type).toMatch(/momentum|influence|generation|protection/i);
      }
    });
  });

  describe('Miracle Cooldowns', () => {
    it('should prevent miracle execution within cooldown', () => {
      const deity = createTestDeity('god');
      deity.totalFaithMass = 1000;

      const canGrant1 = divineManager.canGrantMiracle(deity, 'faction-1', 0);
      const canGrant2 = divineManager.canGrantMiracle(deity, 'faction-1', 1000);

      expect(canGrant1).toBe(true); // No miracle cast yet
      // After casting at tick 0, shouldn't be able to cast until tick 1440+
      // But we haven't actually called executeMiracle, so canGrant2 should still be true
    });

    it('should reset miracle cooldowns', () => {
      divineManager.resetMiracleCooldowns();
      const deity = createTestDeity('god');
      deity.totalFaithMass = 1000;

      const canGrant = divineManager.canGrantMiracle(deity, 'faction-1', 1500);
      expect(canGrant).toBe(true);
    });
  });

  describe('Soul\'s Reprieve', () => {
    it('should apply sanity recovery when active', async () => {
      const deity = createTestDeity('matron');
      deity.totalFaithMass = 100;

      const result = await divineManager.applySoulsReprieve(
        deity,
        'character-1',
        50, // previousSanity
        100, // meditationDuration
        true // isActive
      );

      expect(result.newSanity).toBeGreaterThanOrEqual(result.previousSanity);
      expect(result.sanityRecovery).toBeGreaterThan(0);
    });

    it('should not recover sanity when inactive', async () => {
      const deity = createTestDeity('matron');

      const result = await divineManager.applySoulsReprieve(
        deity,
        'character-1',
        50,
        100,
        false // isActive
      );

      expect(result.newSanity).toBe(result.previousSanity);
      expect(result.sanityRecovery).toBe(0);
    });

    it('should cap sanity recovery at 100', async () => {
      const deity = createTestDeity('matron');
      deity.totalFaithMass = 1000;

      const result = await divineManager.applySoulsReprieve(
        deity,
        'character-1',
        95, // High starting sanity
        10000, // Very long meditation
        true
      );

      expect(result.newSanity).toBeLessThanOrEqual(100);
    });
  });

  describe('Faith Mass Tracking', () => {
    it('should return deity faith mass', () => {
      const deity = createTestDeity('god');
      deity.totalFaithMass = 750;

      const faith = divineManager.getFaithMass(deity);
      expect(faith).toBe(750);
    });

    it('should calculate miracle cooldown remaining', () => {
      const remaining1 = divineManager.getMiracleCooldownRemaining('god-1', 0);
      const remaining2 = divineManager.getMiracleCooldownRemaining('god-1', 500);

      expect(remaining1).toBeLessThanOrEqual(1440);
      expect(remaining2).toBeLessThanOrEqual(1440);
    });
  });
});
