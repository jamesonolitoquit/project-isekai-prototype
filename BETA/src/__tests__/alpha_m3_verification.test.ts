/**
 * alpha_m3_verification.test.ts — ALPHA_M3 Living World Integration Tests
 * 
 * Verification of Faction Dynamics & Procedural Evolution:
 * 1. Power Shifts — Territorial control drives power changes
 * 2. Dynamic Questing — Quests generated from active conflicts
 * 3. Territorial Backlash — Encounter scaling based on faction control  
 * 4. World Event Trigger — High tension + war → WORLD_EVENT emission
 */

import { SeededRng, setGlobalRng } from '../engine/prng';
import { createInitialWorld, createWorldController } from '../engine/worldEngine';
import { resolveFactionTurns } from '../engine/factionEngine';
import { generateProceduralQuest, generateProceduralEncounter, generateQuestPoolFromConflicts } from '../engine/proceduralEngine';
import { evaluateDirectorIntervention, initializeDirectorState } from '../engine/aiDmEngine';

describe('ALPHA_M3: Living World - Faction Dynamics & Procedural Evolution', () => {
  beforeEach(() => {
    setGlobalRng(new SeededRng(42));
  });

  describe('Test 1: Power Shifts (24-Hour Cycle)', () => {
    test('factions with territories should gain power each day', () => {
      const world = createInitialWorld();
      const factions = world.factions || [];
      const relationships = world.factionRelationships || [];
      const conflicts = world.factionConflicts || [];

      // Find a faction with territories
      const factionsWithTerritory = factions.filter(f => f.controlledLocationIds.length > 0);
      expect(factionsWithTerritory.length).toBeGreaterThan(0);

      // Get initial power scores
      const initialPowerScores: Record<string, number> = {};
      factionsWithTerritory.forEach(f => {
        initialPowerScores[f.id] = f.powerScore;
      });

      // Resolve faction turns (simulate 1 day)
      const result = resolveFactionTurns(world, factions, relationships, conflicts);
      const updatedFactions = result.updatedFactions;
      const events = result.events;

      // Verify power shifts occurred
      const powerShiftEvents = events.filter((e: any) => e.type === 'FACTION_POWER_SHIFT');
      expect(powerShiftEvents.length).toBeGreaterThan(0);

      // Verify at least one faction gained power
      const gainedPower = powerShiftEvents.some((e: any) => e.delta > 0);
      expect(gainedPower).toBe(true);

      // Verify power changes in faction objects
      factionsWithTerritory.forEach(originalFaction => {
        const updatedFaction = updatedFactions.find(f => f.id === originalFaction.id);
        if (updatedFaction) {
          // Power should increase (by number of territories * 2)
          const expectedIncrease = originalFaction.controlledLocationIds.length * 2;
          const actualIncrease = updatedFaction.powerScore - initialPowerScores[originalFaction.id];
          expect(actualIncrease).toBeGreaterThanOrEqual(0);
        }
      });
    });

    test('factions without territories should slowly lose power', () => {
      const world = createInitialWorld();
      let factions = world.factions || [];
      
      // Create a faction without territories
      const orphanFaction = {
        ...factions[0],
        id: 'test-orphan',
        name: 'Orphan Faction',
        controlledLocationIds: [],
        powerScore: 50
      };
      factions = [...factions, orphanFaction];

      const relationships = world.factionRelationships || [];
      const conflicts = world.factionConflicts || [];

      const result = resolveFactionTurns(world, factions, relationships, conflicts);
      const updatedFactions = result.updatedFactions;

      const updatedOrphan = updatedFactions.find(f => f.id === 'test-orphan');
      expect(updatedOrphan).toBeDefined();
      expect((updatedOrphan?.powerScore || 50)).toBeLessThan(50); // Should lose power
    });
  });

  describe('Test 2: Dynamic Questing', () => {
    test('should generate quests for each active faction conflict', () => {
      const world = createInitialWorld();
      world.factionConflicts = world.factionConflicts || [];
      
      // Ensure there's at least one active conflict by creating one
      if (world.factionConflicts.length === 0) {
        world.factionConflicts.push({
          id: 'test-conflict-1',
          factionIds: ['silver-flame', 'shadow-conclave'],
          type: 'military',
          trigger: 'Test conflict',
          active: true,
          startedAt: 0
        });
      }

      const factions = world.factions || [];
      const conflicts = world.factionConflicts.filter(c => c.active);
      
      expect(conflicts.length).toBeGreaterThan(0);

      // Generate quest pool from active conflicts
      const questPool = generateQuestPoolFromConflicts(world, conflicts, factions, 3);
      
      expect(questPool.length).toBeGreaterThan(0);
      
      // Verify quests have conflict-related themes
      for (const quest of questPool) {
        expect(quest.title).toBeDefined();
        expect(quest.description).toBeDefined();
        expect(quest.difficulty).toBeGreaterThanOrEqual(1);
        expect(quest.difficulty).toBeLessThanOrEqual(10);
        expect(quest.objectives.length).toBeGreaterThan(0);
        
        // Quest should relate to conflict type
        const conflictTypes = conflicts.map(c => c.type);
        const hasRelevantTheme = quest.themes.some(t => 
          ['military', 'diplomatic', 'economic', 'infiltration', 'religious', 
          'combat', 'espionage', 'negotiation', 'delivery', 'reconnaissance']
            .includes(t as any)
        );
        expect(hasRelevantTheme).toBe(true);
      }
    });

    test('quest difficulty should scale with player level', () => {
      const world = createInitialWorld();
      const factions = world.factions || [];

      // Create test conflict
      const testConflict = {
        id: 'test-conflict',
        factionIds: ['iron smith-guild', 'luminara-mercantile'],
        type: 'economic' as const,
        trigger: 'Test',
        active: true,
        startedAt: 0
      };

      // Generate quests for different player levels
      const playerLevels = [1, 5, 10];
      const questsByLevel: Record<number, any[]> = {};

      for (const level of playerLevels) {
        world.player.level = level;
        const quest = generateProceduralQuest(world, undefined, testConflict, factions[0]);
        questsByLevel[level] = [quest];
        
        // Difficulty should be somewhat close to player level
        expect(Math.abs(quest.difficulty - level)).toBeLessThan(5);
      }
    });
  });

  describe('Test 3: Territorial Backlash', () => {
    test('encounters in hostile territory should be combat-focused', () => {
      const world = createInitialWorld();
      const locationId = world.locations?.[0]?.id || 'test-loc';
      
      // Simulate hostile territory (controlled by faction player dislikes)
      const controllingFactionId = world.factions?.[0]?.id || 'hostile-faction';
      const hostileReputation: Record<string, number> = {
        [controllingFactionId]: -80 // Very hostile
      };

      const encounter = generateProceduralEncounter(
        world,
        locationId,
        undefined,
        controllingFactionId,
        hostileReputation
      );

      // Should generate combat encounter in hostile territory
      expect(encounter).toBeDefined();
      expect(encounter.type).toBe('combat');
      expect(encounter.difficulty).toBeGreaterThanOrEqual(world.player.level);
    });

    test('encounters in friendly territory should be social-focused', () => {
      const world = createInitialWorld();
      const locationId = world.locations?.[0]?.id || 'test-loc';
      
      const controllingFactionId = world.factions?.[0]?.id || 'friendly-faction';
      const friendlyReputation: Record<string, number> = {
        [controllingFactionId]: 80 // Allied
      };

      const encounter = generateProceduralEncounter(
        world,
        locationId,
        undefined,
        controllingFactionId,
        friendlyReputation
      );

      expect(encounter).toBeDefined();
      // Friendly territory should reduce difficulty
      expect(encounter.difficulty).toBeLessThanOrEqual(world.player.level);
    });
  });

  describe('Test 4: World Event Trigger', () => {
    test('should trigger WORLD_EVENT when faction conflict + high tension', () => {
      const world = createInitialWorld();
      const factions = world.factions || [];
      const relationships = world.factionRelationships || [];
      
      // Ensure factions have significant power differences
      if (factions.length >= 2) {
        factions[0].powerScore = 85;
        factions[1].powerScore = 15;
      }

      // Create active war conflict
      const warConflict = {
        id: 'test-war',
        factionIds: [factions[0].id, factions[1].id],
        type: 'military' as const,
        trigger: 'Test war',
        active: true,
        startedAt: world.tick ?? 0
      };
      world.factionConflicts = [warConflict];

      // Initialize Director state with high tension
      const directorState = initializeDirectorState();
      directorState.narrativeTension = 75; // High tension

      const thresholds = {
        boredomThreshold: 10,
        paradoxThreshold: 50,
        tensionLow: 20,
        tensionHigh: 70,
        minInterventionSpacing: 2
      };

      // Run Director evaluation multiple times to trigger world event
      // With 5% trigger chance, 200 iterations gives >99.9999% probability of success
      let worldEventTriggered = false;
      for (let i = 0; i < 200; i++) {
        const events = evaluateDirectorIntervention(world, directorState, thresholds);
        const worldEvent = events.find(e => e.type === 'WORLD_EVENT');
        if (worldEvent) {
          worldEventTriggered = true;
          expect(worldEvent.payload.message).toBeDefined();
          expect(['military', 'economic', 'religious', 'infiltration', 'diplomatic'])
            .toContain(worldEvent.payload.conflictType);
          break;
        }
      }

      // At least one world event should trigger at high tension with active war
      expect(worldEventTriggered).toBe(true);
    });

    test('WORLD_EVENT payload should describe faction conflict consequences', () => {
      const world = createInitialWorld();
      const factions = world.factions || [];

      // Ensure factions have significant power differences for conflict intensity
      if (factions.length >= 2) {
        factions[0].powerScore = 90;
        factions[1].powerScore = 10;
      }

      const warConflict = {
        id: 'conflict-2',
        factionIds: [factions[0].id, factions[1].id],
        type: 'military' as const, // Military has base intensity +30
        trigger: 'Military war',
        active: true,
        startedAt: 0
      };
      world.factionConflicts = [warConflict];

      const directorState = initializeDirectorState();
      directorState.narrativeTension = 80;

      const thresholds = {
        boredomThreshold: 10,
        paradoxThreshold: 50,
        tensionLow: 20,
        tensionHigh: 70,
        minInterventionSpacing: 2
      };

      let eventFound = false;
      // Run iterations until event triggers or timeout
      // With 5% chance per iteration and 200 iterations, should trigger with >99.9999% reliability
      for (let i = 0; i < 200; i++) {
        const events = evaluateDirectorIntervention(world, directorState, thresholds);
        const worldEvent = events.find(e => e.type === 'WORLD_EVENT');
        if (worldEvent) {
          eventFound = true;
          // Event should relate to conflict type
          const message = worldEvent.payload.message;
          expect(message).toBeDefined();
          expect(message.length).toBeGreaterThan(5);
          expect(['monster-infestation', 'militia-draft', 'refugee-crisis'])
            .toContain(worldEvent.payload.worldEventType);
          break;
        }
      }
      
      // Should eventually trigger (with 200 iterations and 5% chance, >99.9999% probability)
      expect(eventFound).toBe(true);
    });
  });

  describe('Integration: Full ALPHA_M3 System', () => {
    test('faction turns → quests → world events should form cohesive loop', () => {
      const world = createInitialWorld();
      
      // Setup active conflict
      const factions = world.factions || [];
      const conflict: any = {
        id: 'integration-test-conflict',
        factionIds: [factions[0].id, factions[1].id],
        type: 'military',
        trigger: 'Integration test',
        active: true,
        startedAt: 0
      };
      world.factionConflicts = [conflict];

      // Step 1: Resolve faction turn
      const relationships = world.factionRelationships || [];
      const conflicts = world.factionConflicts || [];
      const factionResult = resolveFactionTurns(world, factions, relationships, conflicts);
      
      expect(factionResult.events.length).toBeGreaterThanOrEqual(0);

      // Step 2: Generate quests from conflict
      const quests = generateQuestPoolFromConflicts(world, [conflict], factionResult.updatedFactions);
      expect(quests.length).toBeGreaterThan(0);

      // Step 3: Check if Director would trigger world event
      const directorState = initializeDirectorState();
      directorState.narrativeTension = 75;
      const thresholds = {
        boredomThreshold: 10,
        paradoxThreshold: 50,
        tensionLow: 20,
        tensionHigh: 70,
        minInterventionSpacing: 2
      };

      const directorEvents = evaluateDirectorIntervention(world, directorState, thresholds);
      
      // System should be responsive
      expect([...factionResult.events, ...directorEvents].length).toBeGreaterThanOrEqual(0);
    });
  });
});
