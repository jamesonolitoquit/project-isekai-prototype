/**
 * alpha_m15_diffusion.test.ts - M15 Step 5: Geopolitical Influence Diffusion Tests
 * 
 * Comprehensive test suite for:
 * - Influence initialization
 * - Daily influence gains at faction HQ
 * - Influence spread to adjacent locations
 * - Entropy decay from territories
 * - Territory capture (>60 influence)
 * - Territory loss (<30 influence)
 * - Adjacency map detection from coordinates
 */

import { processDailyInfluenceDiffusion, buildAdjacencyMap } from '../engine/influenceDiffusionEngine';
import { WorldState, Location } from '../engine/worldEngine';
import { Faction } from '../engine/factionEngine';

describe('M15 Step 5: Geopolitical Influence Diffusion', () => {
  
  // Helper to create test locations with coordinates
  const createTestLocations = (): Location[] => [
    { id: 'hq-a', name: 'Faction A HQ', x: 500, y: 500, biome: 'village' },
    { id: 'loc-b1', name: 'Adjacent B1', x: 650, y: 500, biome: 'forest' }, // 150 units away
    { id: 'loc-b2', name: 'Adjacent B2', x: 500, y: 650, biome: 'mountain' }, // 150 units away
    { id: 'loc-far', name: 'Far Location', x: 800, y: 800, biome: 'cave' }, // 424 units away
  ];

  const createTestFactions = (): Faction[] => [
    {
      id: 'faction-a',
      name: 'Faction A',
      category: 'political',
      powerScore: 60,
      alignment: 'good',
      primaryLocationId: 'hq-a',
      coreBeliefs: ['power', 'expansion'],
      controlledLocationIds: ['hq-a'],
      influenceTheme: { color: '#ff6600', ambiance: 'industrial' }
    }
  ];

  // Helper to create minimal test world state
  const createTestWorldState = (locations: Location[], factions: Faction[]): WorldState => ({
    id: 'test-world',
    tick: 0,
    seed: 12345,
    hour: 12,
    day: 1,
    dayPhase: 'afternoon',
    season: 'spring',
    weather: 'clear',
    locations,
    npcs: [],
    quests: [],
    factions,
    factionRelationships: [],
    factionConflicts: [],
    influenceMap: (() => {
      const map: Record<string, Record<string, number>> = {};
      locations.forEach(loc => {
        map[loc.id] = {};
        factions.forEach(faction => {
          map[loc.id][faction.id] = faction.primaryLocationId === loc.id ? 50 : 0;
        });
      });
      return map;
    })(),
    combatState: { active: false, participants: [], turnIndex: 0, roundNumber: 0, log: [], initiator: '' },
    audio: { parameters: {}, eventsThisTick: [], lastEventId: '' },
    player: {
      id: 'player1',
      location: 'hq-a',
      hp: 100,
      maxHp: 100,
      quests: {},
      dialogueHistory: [],
      npcDialogueIndex: {},
      gold: 0,
      experience: 0,
      xp: 0,
      level: 1,
      attributePoints: 0,
      reputation: {},
      statusEffects: [],
      stats: { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
      inventory: [],
      equipment: {},
      factionReputation: {}
    }
  });

  describe('Adjacency Map Building', () => {
    test('should detect adjacent locations within 250 units', () => {
      const locations = createTestLocations();
      const adjacency = buildAdjacencyMap(locations);

      expect(adjacency['hq-a']).toContain('loc-b1'); // 150 units
      expect(adjacency['hq-a']).toContain('loc-b2'); // 150 units
      expect(adjacency['hq-a']).not.toContain('loc-far'); // 424 units
    });

    test('should create bidirectional adjacency relationships', () => {
      const locations = createTestLocations();
      const adjacency = buildAdjacencyMap(locations);

      // If A is adjacent to B, then B should be adjacent to A
      if (adjacency['hq-a'].includes('loc-b1')) {
        expect(adjacency['loc-b1']).toContain('hq-a');
      }
    });

    test('should handle locations without coordinates', () => {
      const locations: Location[] = [
        { id: 'loc1', name: 'Location 1' },
        { id: 'loc2', name: 'Location 2' },
        { id: 'loc3', name: 'Location 3' }
      ];
      const adjacency = buildAdjacencyMap(locations);

      // All should be adjacent to each other (fallback behavior)
      expect(adjacency['loc1'].length).toBeGreaterThan(0);
      expect(adjacency['loc2'].length).toBeGreaterThan(0);
    });
  });

  describe('Influence Initialization', () => {
    test('should initialize with 50 influence at faction HQ', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      const state = createTestWorldState(locations, factions);

      const hqInfluence = state.influenceMap?.['hq-a']?.['faction-a'] ?? 0;
      expect(hqInfluence).toBe(50);
    });

    test('should initialize with 0 influence at non-HQ locations', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      const state = createTestWorldState(locations, factions);

      const adjacentInfluence = state.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;
      expect(adjacentInfluence).toBe(0);
    });
  });

  describe('Daily Influence Gain at HQ', () => {
    test('should gain +10 influence daily at faction HQ', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      const initialInfluence = state.influenceMap?.['hq-a']?.['faction-a'] ?? 0;
      expect(initialInfluence).toBe(50);

      // Process one day of diffusion
      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      const newInfluence = updatedState.influenceMap?.['hq-a']?.['faction-a'] ?? 0;

      expect(newInfluence).toBe(60);
    });

    test('should cap influence at 100', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Manually set influence to 95
      state.influenceMap!['hq-a']['faction-a'] = 95;

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      const newInfluence = updatedState.influenceMap?.['hq-a']?.['faction-a'] ?? 0;

      expect(newInfluence).toBeLessThanOrEqual(100);
      expect(newInfluence).toBe(100);
    });
  });

  describe('Influence Spread to Adjacent Locations', () => {
    test('should spread 25% influence to adjacent locations', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Set initial high influence at HQ
      state.influenceMap!['hq-a']['faction-a'] = 80;

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      
      // Adjacent locations should receive 10% of 25% = 2.5
      const adjacentInfluence = updatedState.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;
      expect(adjacentInfluence).toBeGreaterThan(0);
      expect(adjacentInfluence).toBeLessThan(10);
    });

    test('should not spread to non-adjacent locations', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['hq-a']['faction-a'] = 80;

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      
      // Far location should remain unaffected
      const farInfluence = updatedState.influenceMap?.['loc-far']?.['faction-a'] ?? 0;
      expect(farInfluence).toBe(0);
    });
  });

  describe('Entropy Decay', () => {
    test('should reduce influence by 5% daily (decay)', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Set influence to 100 at a non-HQ location
      state.influenceMap!['loc-b1']['faction-a'] = 100;

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      const newInfluence = updatedState.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;

      // 100 * 0.95 = 95
      expect(newInfluence).toBe(95);
    });

    test('should decay to zero (never negative)', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['loc-b1']['faction-a'] = 2; // Very small value

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);
      const newInfluence = updatedState.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;

      expect(newInfluence).toBeGreaterThanOrEqual(0);
      expect(newInfluence).toBeLessThan(2);
    });
  });

  describe('Territory Capture (>60 threshold)', () => {
    test('should capture territory when influence exceeds 60', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Manually set influence above threshold
      state.influenceMap!['loc-b1']['faction-a'] = 65;
      state.factions![0].controlledLocationIds = ['hq-a']; // Initially only HQ

      const { updatedState, events } = processDailyInfluenceDiffusion(state, state.id);
      
      // Territory should now be controlled
      expect(updatedState.factions![0].controlledLocationIds).toContain('loc-b1');
      
      // Should emit INFLUENCE_SHIFT event with control change
      const captureEvent = events.find(e => 
        e.payload.locationId === 'loc-b1' && e.payload.nowControls === true
      );
      expect(captureEvent).toBeDefined();
    });

    test('should only capture once when threshold is crossed', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['loc-b1']['faction-a'] = 65;
      state.factions![0].controlledLocationIds = ['hq-a', 'loc-b1']; // Already controlled

      const { events } = processDailyInfluenceDiffusion(state, state.id);
      
      // Should not emit another capture event
      const captureEvents = events.filter(e => 
        e.payload.locationId === 'loc-b1' && e.payload.controlChanged === true
      );
      expect(captureEvents.length).toBe(0);
    });
  });

  describe('Territory Loss (<30 threshold)', () => {
    test('should lose territory when influence falls below 30', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Manually set influence below threshold
      state.influenceMap!['loc-b1']['faction-a'] = 25;
      state.factions![0].controlledLocationIds = ['hq-a', 'loc-b1']; // Currently controlled

      const { updatedState, events } = processDailyInfluenceDiffusion(state, state.id);
      
      // Territory should no longer be controlled
      expect(updatedState.factions![0].controlledLocationIds).not.toContain('loc-b1');
      
      // Should emit INFLUENCE_SHIFT event with loss
      const lossEvent = events.find(e => 
        e.payload.locationId === 'loc-b1' && e.payload.nowControls === false
      );
      expect(lossEvent).toBeDefined();
    });

    test('should use hysteresis to prevent rapid toggling', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['loc-b1']['faction-a'] = 50; // Between thresholds
      state.factions![0].controlledLocationIds = ['hq-a']; // Not controlled initially

      const { updatedState: state1 } = processDailyInfluenceDiffusion(state, state.id);
      
      // Influence should not jump between capture/loss
      expect(state1.factions![0].controlledLocationIds).not.toContain('loc-b1');
    });
  });

  describe('Multi-Day Influence Cycles', () => {
    test('should progressively expand faction territory over 60+ ticks from HQ', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Simulate many days of diffusion
      for (let day = 0; day < 60; day++) {
        const result = processDailyInfluenceDiffusion(state, state.id);
        state = result.updatedState;
      }

      // Adjacent location should have significant influence
      const adjacentInfluence = state.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;
      expect(adjacentInfluence).toBeGreaterThan(30);
    });

    test('should reach stable state where HQ influence plateaus and spreads outward', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      // Simulate many days
      for (let day = 0; day < 120; day++) {
        const result = processDailyInfluenceDiffusion(state, state.id);
        state = result.updatedState;
      }

      // HQ should be at 100 (capped)
      const hqInfluence = state.influenceMap?.['hq-a']?.['faction-a'] ?? 0;
      expect(hqInfluence).toBe(100);

      // Adjacent should have spread significantly
      const adjacentInfluence = state.influenceMap?.['loc-b1']?.['faction-a'] ?? 0;
      expect(adjacentInfluence).toBeGreaterThan(50);
    });
  });

  describe('Event Emissions', () => {
    test('should emit INFLUENCE_SHIFT event on control change', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['loc-b1']['faction-a'] = 65; // Above capture threshold

      const { events } = processDailyInfluenceDiffusion(state, state.id);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('INFLUENCE_SHIFT');
      expect(events[0].payload.factionId).toBe('faction-a');
      expect(events[0].payload.locationId).toBe('loc-b1');
      expect(events[0].payload.controlChanged).toBe(true);
    });

    test('should include influence delta in event', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);

      state.influenceMap!['loc-b1']['faction-a'] = 65;

      const { events } = processDailyInfluenceDiffusion(state, state.id);
      const event = events[0];

      expect(event.payload.oldInfluence).toBe(0);
      expect(event.payload.newInfluence).toBe(65);
      expect(event.payload.nowControls).toBe(true);
    });
  });

  describe('Multiple Factions', () => {
    test('should process multiple factions independently', () => {
      const locations = createTestLocations();
      const factions: Faction[] = [
        {
          id: 'faction-a',
          name: 'Faction A',
          category: 'political',
          powerScore: 60,
          alignment: 'good',
          primaryLocationId: 'hq-a',
          coreBeliefs: ['power'],
          controlledLocationIds: ['hq-a'],
          influenceTheme: { color: '#ff6600', ambiance: 'industrial' }
        },
        {
          id: 'faction-b',
          name: 'Faction B',
          category: 'religious',
          powerScore: 50,
          alignment: 'neutral',
          primaryLocationId: 'loc-b1',
          coreBeliefs: ['harmony'],
          controlledLocationIds: ['loc-b1'],
          influenceTheme: { color: '#00aa00', ambiance: 'ethereal' }
        }
      ];

      let state = createTestWorldState(locations, factions);

      const { updatedState } = processDailyInfluenceDiffusion(state, state.id);

      // Both factions should have gained influence at their HQ
      expect(updatedState.influenceMap?.['hq-a']?.['faction-a']).toBe(60);
      expect(updatedState.influenceMap?.['loc-b1']?.['faction-b']).toBe(60);
    });

    test('should compete for territories when influences overlap', () => {
      const locations = createTestLocations();
      const factions: Faction[] = [
        {
          id: 'faction-a',
          name: 'Faction A',
          category: 'political',
          powerScore: 60,
          alignment: 'good',
          primaryLocationId: 'hq-a',
          coreBeliefs: ['power'],
          controlledLocationIds: ['hq-a'],
          influenceTheme: { color: '#ff6600', ambiance: 'industrial' }
        },
        {
          id: 'faction-b',
          name: 'Faction B',
          category: 'religious',
          powerScore: 50,
          alignment: 'neutral',
          primaryLocationId: 'loc-b1',
          coreBeliefs: ['harmony'],
          controlledLocationIds: ['loc-b1'],
          influenceTheme: { color: '#00aa00', ambiance: 'ethereal' }
        }
      ];

      let state = createTestWorldState(locations, factions);

      // Set contested influence at loc-b2
      state.influenceMap!['loc-b2']['faction-a'] = 50;
      state.influenceMap!['loc-b2']['faction-b'] = 40;

      const { events } = processDailyInfluenceDiffusion(state, state.id);

      // First time no one has enough influence to capture
      expect(events.filter(e => e.payload.locationId === 'loc-b2').length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty influence map gracefully', () => {
      const locations = createTestLocations();
      const factions = createTestFactions();
      let state = createTestWorldState(locations, factions);
      state.influenceMap = {};

      expect(() => {
        processDailyInfluenceDiffusion(state, state.id);
      }).not.toThrow();
    });

    test('should handle missing factions gracefully', () => {
      const locations = createTestLocations();
      let state = createTestWorldState(locations, []);
      state.factions = undefined;

      expect(() => {
        processDailyInfluenceDiffusion(state, state.id);
      }).not.toThrow();
    });

    test('should handle missing locations gracefully', () => {
      const factions = createTestFactions();
      let state = createTestWorldState([], factions);
      state.locations = [];

      expect(() => {
        processDailyInfluenceDiffusion(state, state.id);
      }).not.toThrow();
    });
  });
});
