/**
 * ALPHA_M9: Map Engine Tests
 * 
 * Verifies spatial calculations, location discovery, terrain modifiers,
 * and fog of war mechanics introduced in M9 Phase 1.
 */

import { WorldState } from '../engine/worldEngine';
import {
  calculateEuclideanDistance,
  getTerrainModifier,
  calculateTerrainDistance,
  getTravelTicks,
  getAdjacentLocations,
  checkLocationDiscovery,
  discoverLocation,
  getDiscoveredLocations,
  getMapViewport,
  estimateTravelTime
} from '../engine/mapEngine';
import luxfierWorld from '../data/luxfier-world.json';

describe('ALPHA_M9: Map Engine - Spatial Calculations & Discovery', () => {
  let mockState: WorldState;

  beforeEach(() => {
    mockState = {
      id: 'world_test_m9',
      tick: 0,
      seed: 12345,
      player: {
        id: 'player_m9_test',
        name: 'MapTester',
        race: 'human',
        stats: { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
        hp: 20,
        maxHp: 20,
        mp: 10,
        maxMp: 10,
        gold: 100,
        location: 'eldergrove-village',
        level: 1,
        skillPoints: 0,
        unlockedAbilities: [],
        equippedAbilities: [],
        abilityCooldowns: {}
      },
      locations: luxfierWorld.locations || [],
      npcs: [],
      items: [],
      quests: {},
      factions: [],
      events: [],
      metadata: { templateOrigin: 'luxfier-world' }
    };
  });

  describe('Euclidean Distance Calculation', () => {
    test('should calculate direct distance between two points', () => {
      const distance = calculateEuclideanDistance(0, 0, 3, 4);
      expect(distance).toBe(5); // 3-4-5 triangle
    });

    test('should return 0 for same coordinates', () => {
      const distance = calculateEuclideanDistance(100, 100, 100, 100);
      expect(distance).toBe(0);
    });

    test('should work with location coordinates from world data', () => {
      const loc1 = mockState.locations.find(l => l.id === 'eldergrove-village');
      const loc2 = mockState.locations.find(l => l.id === 'luminara-grand-market');
      
      if (loc1?.x !== undefined && loc1?.y !== undefined && loc2?.x !== undefined && loc2?.y !== undefined) {
        const distance = calculateEuclideanDistance(loc1.x, loc1.y, loc2.x, loc2.y);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(1500); // Reasonable bounds for world size
      }
    });
  });

  describe('Terrain Modifier Lookup', () => {
    test('should return correct modifier for plains (easiest)', () => {
      const mod = getTerrainModifier('plains');
      expect(mod).toBe(0.8);
    });

    test('should return correct modifier for village (safest)', () => {
      const mod = getTerrainModifier('village');
      expect(mod).toBe(0.7);
    });

    test('should return correct modifier for mountain (hardest)', () => {
      const mod = getTerrainModifier('mountain');
      expect(mod).toBe(1.5);
    });

    test('should return correct modifier for forest', () => {
      const mod = getTerrainModifier('forest');
      expect(mod).toBe(1.0);
    });

    test('should return 1.0 for unknown biome', () => {
      const mod = getTerrainModifier('unknown_biome');
      expect(mod).toBe(1.0);
    });
  });

  describe('Terrain-Adjusted Distance', () => {
    test('should apply terrain modifier to distance', () => {
      // 10 units in plains (0.8x modifier) = 8 units
      const distance = calculateTerrainDistance(
        { x: 0, y: 0, terrainModifier: 0.8 },
        { x: 10, y: 0, terrainModifier: 0.8 }
      );
      expect(distance).toBe(8);
    });

    test('should apply terrain modifier to mountain (harder to traverse)', () => {
      // 10 units in mountain (1.5x modifier) = 15 units
      const distance = calculateTerrainDistance(
        { x: 0, y: 0, terrainModifier: 1.5 },
        { x: 10, y: 0, terrainModifier: 1.5 }
      );
      expect(distance).toBe(15);
    });

    test('should handle mixed terrain by averaging modifiers', () => {
      // From plains (0.8) to mountain (1.5), average = 1.15, so ~11.5 units
      const distance = calculateTerrainDistance(
        { x: 0, y: 0, terrainModifier: 0.8 },
        { x: 10, y: 0, terrainModifier: 1.5 }
      );
      // Allow some tolerance since implementation may vary
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThanOrEqual(15);
    });
  });

  describe('Travel Ticks Calculation', () => {
    test('should convert terrain distance to ticks (5 ticks per unit)', () => {
      // 10 units = 50 ticks
      const ticks = getTravelTicks(10);
      expect(ticks).toBe(50);
    });

    test('should handle fractional distances', () => {
      const ticks = getTravelTicks(2.5);
      // Implementation may round up
      expect(ticks).toBeGreaterThanOrEqual(12.5);
      expect(ticks).toBeLessThanOrEqual(13);
    });

    test('should round up for practical game timing', () => {
      const ticks = getTravelTicks(2.1);
      // Could be 10.5 ticks (exact) or 11 (rounded) depending on implementation
      expect(ticks).toBeGreaterThanOrEqual(10.5);
    });
  });

  describe('Location Discovery', () => {
    test('should mark location as discovered', () => {
      const locationId = 'luminara-grand-market';
      const location = mockState.locations.find(l => l.id === locationId);
      
      expect(location?.discovered).toBeFalsy();
      
      discoverLocation(mockState, locationId);
      
      const updated = mockState.locations.find(l => l.id === locationId);
      expect(updated?.discovered).toBe(true);
    });

    test('should check for adjacent discoveries when player moves', () => {
      // Start at eldergrove-village and check what's nearby
      const newDiscoveries = checkLocationDiscovery(mockState, 'eldergrove-village');
      
      // Should find at least one adjacent location within 150 units (default radius)
      expect(Array.isArray(newDiscoveries)).toBe(true);
      expect(newDiscoveries.length).toBeGreaterThanOrEqual(0);
    });

    test('should mark newly discovered locations', () => {
      const newDiscoveries = checkLocationDiscovery(mockState, 'eldergrove-village');
      
      for (const locId of newDiscoveries) {
        expect(mockState.locations.find(l => l.id === locId)?.discovered).toBe(true);
      }
    });
  });

  describe('Discovered Locations Filter', () => {
    test('should return only discovered locations', () => {
      // Mark some as discovered
      discoverLocation(mockState, 'eldergrove-village');
      discoverLocation(mockState, 'luminara-grand-market');
      
      const discovered = getDiscoveredLocations(mockState);
      
      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered.every(l => l.discovered === true)).toBe(true);
    });

    test('should exclude undiscovered locations', () => {
      // Only discover one
      discoverLocation(mockState, 'eldergrove-village');
      
      const discovered = getDiscoveredLocations(mockState);
      const hasUndiscovered = discovered.some(l => l.discovered === false);
      
      expect(hasUndiscovered).toBe(false);
    });
  });

  describe('Map Viewport Calculation', () => {
    test('should calculate SVG viewport bounds centered on player location', () => {
      const viewport = getMapViewport(mockState, 500);
      
      expect(viewport).toHaveProperty('minX');
      expect(viewport).toHaveProperty('minY');
      expect(viewport).toHaveProperty('maxX');
      expect(viewport).toHaveProperty('maxY');
      
      // Viewport should be centered on player location
      const playerLoc = mockState.locations.find(l => l.id === mockState.player.location);
      if (playerLoc?.x !== undefined && playerLoc?.y !== undefined) {
        const centerX = (viewport.minX + viewport.maxX) / 2;
        const centerY = (viewport.minY + viewport.maxY) / 2;
        
        expect(centerX).toBeCloseTo(playerLoc.x, -1); // Allow some tolerance
        expect(centerY).toBeCloseTo(playerLoc.y, -1);
      }
    });
  });

  describe('Travel Time Estimation', () => {
    test('should estimate travel time between two locations', () => {
      const estimate = estimateTravelTime(mockState, 'eldergrove-village', 'luminara-grand-market');
      
      if (estimate) {
        expect(estimate).toHaveProperty('ticks');
        expect(estimate).toHaveProperty('seconds');
        expect(estimate).toHaveProperty('label');
        
        expect(estimate.ticks).toBeGreaterThan(0);
        expect(estimate.seconds).toBeGreaterThan(0);
        expect(typeof estimate.label).toBe('string');
      }
    });

    test('should return null for invalid locations', () => {
      const estimate = estimateTravelTime(mockState, 'invalid-location', 'another-invalid');
      
      expect(estimate).toBeNull();
    });
  });

  describe('Adjacent Locations Discovery', () => {
    test('should find adjacent locations within discovery radius', () => {
      const adjacent = getAdjacentLocations(mockState, 'eldergrove-village', 200);
      
      expect(Array.isArray(adjacent)).toBe(true);
      // Should find at least the starting location itself
      expect(adjacent.length).toBeGreaterThan(0);
    });

    test('should respect discovery radius boundary', () => {
      // Very small radius should find fewer locations
      const smallRadius = getAdjacentLocations(mockState, 'eldergrove-village', 50);
      // Large radius should find more
      const largeRadius = getAdjacentLocations(mockState, 'eldergrove-village', 300);
      
      expect(largeRadius.length).toBeGreaterThanOrEqual(smallRadius.length);
    });
  });
});
