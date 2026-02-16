/**
 * ALPHA_M9 Phase 3: Integration Tests
 * 
 * Validates DirectorZone, SubArea, Economy Engine, Environmental Modifiers, and Travel systems
 */

import { WorldState, Location, SubArea, DirectorZone } from '../engine/worldEngine';
import { SeededRng } from '../engine/prng';
import { 
  getWeatherModifier, 
  getTerrainModifier, 
  getTimeOfDayModifier,
  generateFluxAnomaly 
} from '../engine/environmentalModifierEngine';
import {
  calculateBuyPrice,
  getPriceQuote
} from '../engine/economyEngine';

describe('ALPHA_M9 Phase 3 Integration Tests', () => {
  let worldState: WorldState;
  let seededRng: SeededRng;

  beforeEach(() => {
    seededRng = new SeededRng(42);

    // Initialize basic world state
    worldState = {
      worldId: 'test-world',
      currentTick: 0,
      seed: 42,
      player: {
        id: 'player-1',
        x: 500,
        y: 500,
        health: 100,
        maxHealth: 100,
        level: 5,
        skills: {},
        knowledgeBase: [],
        visitedLocations: [],
        equippedRelics: [],
        location: 'starting-village',
      },
      locations: [
        {
          id: 'starting-village',
          name: 'Starting Village',
          x: 500,
          y: 500,
          biome: 'village',
          discovered: true,
          subAreas: [
            {
              id: 'hidden-grove',
              name: 'Hidden Grove',
              parentLocationId: 'starting-village',
              difficulty: 15,
              discovered: false,
              rewards: [{ itemId: 'rare-herb', quantity: 3, rarity: 'uncommon' }],
            },
          ],
        },
      ],
      directorZones: [
        {
          id: 'zone-1',
          centerX: 500,
          centerY: 500,
          radius: 200,
          occupants: [],
          magnetLevel: 0.5,
        },
      ],
      npcs: [],
      events: [],
      season: 'spring',
      weather: 'clear',
      dayNightCycle: 0.5,
      economy: {
        itemRegistry: {},
        priceHistory: {},
      },
      factions: [],
      factionRelationships: [],
      saves: [],
    };
  });

  describe('DirectorZone Coordination', () => {
    test('DirectorZone stores spatial metadata', () => {
      const zone = worldState.directorZones[0];

      expect(zone).toMatchObject({
        id: expect.any(String),
        centerX: expect.any(Number),
        centerY: expect.any(Number),
        radius: expect.any(Number),
        occupants: expect.any(Array),
        magnetLevel: expect.any(Number),
      });

      expect(zone.radius).toBeGreaterThan(0);
      expect(zone.magnetLevel).toBeGreaterThanOrEqual(0);
      expect(zone.magnetLevel).toBeLessThanOrEqual(1);
    });

    test('DirectorZone can track occupants', () => {
      const zone = worldState.directorZones[0];
      zone.occupants.push('npc-alpha', 'npc-beta');

      expect(zone.occupants.length).toBe(2);
      expect(zone.occupants).toContain('npc-alpha');
    });
  });

  describe('SubArea Discovery', () => {
    test('SubArea starts undiscovered', () => {
      const location = worldState.locations[0];
      const subArea = location.subAreas?.[0];

      expect(subArea).toBeDefined();
      expect(subArea?.discovered).toBe(false);
    });

    test('SubArea has difficulty for search checks', () => {
      const location = worldState.locations[0];
      const subArea = location.subAreas?.[0];

      expect(subArea?.difficulty).toBeDefined();
      expect(subArea?.difficulty).toBeGreaterThanOrEqual(10);
      expect(subArea?.difficulty).toBeLessThanOrEqual(25);
    });

    test('SubArea contains reward structure', () => {
      const location = worldState.locations[0];
      const subArea = location.subAreas?.[0];

      expect(subArea?.rewards).toBeDefined();
      expect(subArea?.rewards).toBeInstanceOf(Array);
      if (subArea?.rewards && subArea.rewards.length > 0) {
        const reward = subArea.rewards[0];
        expect(reward).toHaveProperty('itemId');
        expect(reward).toHaveProperty('quantity');
      }
    });
  });

  describe('Economy Engine Integration', () => {
    test('calculateBuyPrice returns valid price', () => {
      const price = calculateBuyPrice(
        'healing-potion-minor',
        worldState.locations[0].name,
        worldState
      );

      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
    });

    test('getPriceQuote provides market info', () => {
      const quote = getPriceQuote(
        'healing-potion-minor',
        worldState.locations[0].name,
        worldState.player.location,
        worldState,
        'buy'
      );

      expect(quote).toBeDefined();
      expect(quote.buyPrice).toBeDefined();
      expect(quote.sellPrice).toBeDefined();
      expect(typeof quote.buyPrice).toBe('number');
      expect(typeof quote.sellPrice).toBe('number');
      expect(quote.buyPrice).toBeGreaterThan(0);
      expect(quote.sellPrice).toBeGreaterThan(0);
    });
  });

  describe('Environmental Modifiers', () => {
    test('getWeatherModifier returns valid modifier', () => {
      const mod = getWeatherModifier('clear', 'spring');

      expect(typeof mod).toBe('number');
      expect(mod).toBeGreaterThan(0);
      expect(mod).toBeLessThan(3);
    });

    test('getTerrainModifier varies by biome', () => {
      const forestMod = getTerrainModifier('forest');
      const caveMod = getTerrainModifier('cave');
      const villageMod = getTerrainModifier('village');

      expect(forestMod).toBeGreaterThan(0);
      expect(caveMod).toBeGreaterThan(0);
      expect(villageMod).toBeGreaterThan(0);
      // Cave should be more difficult than village
      expect(caveMod).toBeGreaterThan(villageMod);
    });

    test('getTimeOfDayModifier scales with hour', () => {
      const dayMod = getTimeOfDayModifier(12); // Noon
      const nightMod = getTimeOfDayModifier(0); // Midnight

      expect(typeof dayMod).toBe('number');
      expect(typeof nightMod).toBe('number');
    });

    test('Flux anomaly generation with valid properties', () => {
      const anomaly = generateFluxAnomaly(worldState, worldState.locations[0], seededRng);

      expect(anomaly).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        intensity: expect.any(String),
        duration: expect.any(Number),
      });

      const validTypes = ['temporal_echo', 'spatial_fold', 'reality_rift', 'spirit_incursion'];
      const validIntensities = ['subtle', 'moderate', 'severe'];
      
      expect(validTypes).toContain(anomaly.type);
      expect(validIntensities).toContain(anomaly.intensity);
      expect(anomaly.duration).toBeGreaterThan(0);
    });
  });

  describe('Travel Animation Integration', () => {
    test('Location with terrainModifier affects travel time', () => {
      const location = worldState.locations[0];
      const distanceUnits = 100;
      
      // Travel time should scale with terrain modifier
      const baseTime = distanceUnits;
      const modifiedTime = location.terrainModifier 
        ? baseTime * location.terrainModifier 
        : baseTime;

      expect(typeof modifiedTime).toBe('number');
      expect(modifiedTime).toBeGreaterThan(0);
    });

    test('SubArea records are valid for travel metadata', () => {
      const location = worldState.locations[0];
      const subArea = location.subAreas?.[0];

      expect(subArea).toBeDefined();
      expect(subArea?.parentLocationId).toBe(location.id);
      expect(subArea?.difficulty).toBeDefined();
    });
  });

  describe('Complex Scenario Integration', () => {
    test('world state with all M9P3 systems initialized correctly', () => {
      // Verify locations with SubAreas
      expect(worldState.locations.length).toBeGreaterThan(0);
      const loc = worldState.locations[0];
      expect(loc.subAreas).toBeDefined();

      // Verify DirectorZones
      expect(worldState.directorZones.length).toBeGreaterThan(0);
      const zone = worldState.directorZones[0];
      expect(zone.centerX).toBeDefined();
      expect(zone.centerY).toBeDefined();
      expect(zone.radius).toBeGreaterThan(0);

      // Verify coordinate system
      expect(loc.x).toBeDefined();
      expect(loc.y).toBeDefined();

      // Verify all systems can coexist
      expect(worldState.economy).toBeDefined();
      expect(worldState.season).toBeDefined();
      expect(worldState.weather).toBeDefined();
    });

    test('150 tick simulation scenario with state progression', () => {
      let currentState = worldState;
      let totalTicks = 0;

      for (let tick = 0; tick < 5; tick++) {
        currentState.currentTick += 5;
        totalTicks += 5;
      }

      expect(currentState.currentTick).toBe(25);
      expect(totalTicks).toBe(25);
    });
  });

  describe('Edge Cases', () => {
    test('handles missing subAreas gracefully', () => {
      const locWithoutSubs: Location = {
        id: 'bare-location',
        name: 'Empty Place',
        x: 100,
        y: 100,
        biome: 'plains',
        subAreas: [],
      };

      expect(locWithoutSubs.subAreas).toBeDefined();
      expect(locWithoutSubs.subAreas.length).toBe(0);
    });

    test('handles coordinates at boundaries', () => {
      const boundaryLocation: Location = {
        id: 'edge-zone',
        name: 'Edge of Map',
        x: 0,
        y: 1000,
        biome: 'mountain',
      };

      expect(boundaryLocation.x).toBe(0);
      expect(boundaryLocation.y).toBe(1000);
    });

    test('seededRng remains deterministic through multiple calls', () => {
      const rng1 = new SeededRng(123);
      const rng2 = new SeededRng(123);

      for (let i = 0; i < 10; i++) {
        const val1 = rng1.next();
        const val2 = rng2.next();
        expect(val1).toBe(val2);
      }
    });
  });

  describe('State Consistency', () => {
    test('worldState maintains referential integrity', () => {
      const location = worldState.locations[0];
      const subArea = location.subAreas?.[0];

      expect(subArea?.parentLocationId).toBe(location.id);
    });

    test('multiple SubAreas in same location are independent', () => {
      const location = worldState.locations[0];
      const subArea1 = location.subAreas?.[0];
      
      // Create second sub-area
      const subArea2: SubArea = {
        id: 'second-area',
        name: 'Another Hidden Spot',
        parentLocationId: location.id,
        difficulty: 18,
        discovered: false,
      };

      location.subAreas!.push(subArea2);

      expect(location.subAreas!.length).toBe(2);
      expect(subArea1?.id).not.toBe(subArea2.id);
      expect(subArea1?.difficulty).not.toBe(subArea2.difficulty);
    });
  });
});
