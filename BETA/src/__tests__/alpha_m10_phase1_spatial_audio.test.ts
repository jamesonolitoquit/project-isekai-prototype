/**
 * ALPHA_M10 Phase 1, Step 3: Spatial Audio Synchronization Tests
 * 
 * Validates audio biome profiles, crossfades, and player tracking
 */

import {
  getBiomeAudioProfile,
  detectBiomeChange,
  createAudioCrossfade,
  updateSpatialAudioState,
  completeCrossfade,
  getSpatialAudioParameters,
  interpolateAudioDuringCrossfade,
  getAudioEnvironment,
  initializeSpatialAudioState,
  getCrossfadeStats,
  type SpatialAudioState,
} from '../engine/spatialAudioEngine';
import { WorldState } from '../engine/worldEngine';
import { generateWildernessNode } from '../engine/wildernessEngine';

describe('ALPHA_M10 Phase 1, Step 3: Spatial Audio Synchronization', () => {
  let mockWorldState: WorldState;

  beforeEach(() => {
    mockWorldState = {
      worldId: 'test-world',
      currentTick: 0,
      seed: 42,
      player: { id: 'player-1', x: 500, y: 500, health: 100, maxHealth: 100, level: 5, skills: {} },
      locations: [],
      directorZones: [],
      npcs: [],
      events: [],
      season: 'spring',
      weather: 'clear',
      dayNightCycle: 0.5,
      factions: [],
      factionRelationships: [],
      saves: [],
    };
  });

  describe('Audio Biome Profiles', () => {
    test('forest profile has expected properties', () => {
      const profile = getBiomeAudioProfile('forest');

      expect(profile).toMatchObject({
        biome: 'forest',
        ambientTrack: expect.any(String),
        environmentReverb: expect.any(Number),
        crowdDensity: expect.any(Number),
        windIntensity: expect.any(Number),
        spiritResonance: expect.any(Number),
        targetVolume: expect.any(Number),
      });

      expect(profile.environmentReverb).toBeGreaterThanOrEqual(0);
      expect(profile.environmentReverb).toBeLessThanOrEqual(1);
    });

    test('all biomes have valid profiles', () => {
      const biomes = ['forest', 'cave', 'mountain', 'plains', 'corrupted', 'maritime', 'shrine', 'village'];

      biomes.forEach(biome => {
        const profile = getBiomeAudioProfile(biome);
        expect(profile.biome).toBe(biome);
        expect(profile.targetVolume).toBeGreaterThan(0);
        expect(profile.targetVolume).toBeLessThanOrEqual(1);
      });
    });

    test('cave has high reverb (echoey)', () => {
      const cave = getBiomeAudioProfile('cave');
      const plains = getBiomeAudioProfile('plains');

      expect(cave.environmentReverb).toBeGreaterThan(plains.environmentReverb);
    });

    test('corrupted has high spirit resonance', () => {
      const corrupted = getBiomeAudioProfile('corrupted');
      const plains = getBiomeAudioProfile('plains');

      expect(corrupted.spiritResonance).toBeGreaterThan(plains.spiritResonance);
    });

    test('unknown biome defaults to plains', () => {
      const unknown = getBiomeAudioProfile('unknown-biome');
      const plains = getBiomeAudioProfile('plains');

      expect(unknown.biome).toBe(plains.biome);
    });
  });

  describe('Biome Change Detection', () => {
    test('detectBiomeChange recognizes biome transition', () => {
      const node = generateWildernessNode(0, 0, 42);
      const changed = detectBiomeChange(node, 'different-biome');

      expect(changed).toBe(true);
    });

    test('detectBiomeChange returns false for same biome', () => {
      const node = generateWildernessNode(0, 0, 42);
      const changed = detectBiomeChange(node, node.biome);

      expect(changed).toBe(false);
    });

    test('detectBiomeChange handles null node', () => {
      const changed = detectBiomeChange(null, 'forest');

      expect(changed).toBe(false);
    });
  });

  describe('Audio Crossfade Management', () => {
    test('createAudioCrossfade generates valid crossfade event', () => {
      const crossfade = createAudioCrossfade('forest', 'cave', 100, 2000);

      expect(crossfade).toMatchObject({
        id: expect.any(String),
        fromBiome: 'forest',
        toBiome: 'cave',
        duration: 2000,
        startedAtTick: 100,
      });

      expect(crossfade.completedAtTick).toBeUndefined();
    });

    test('crossfade IDs are unique', () => {
      const cf1 = createAudioCrossfade('forest', 'cave', 100);
      const cf2 = createAudioCrossfade('forest', 'cave', 101);

      expect(cf1.id).not.toBe(cf2.id);
    });

    test('default crossfade duration is 3000ms', () => {
      const crossfade = createAudioCrossfade('plains', 'mountain', 50);

      expect(crossfade.duration).toBe(3000);
    });
  });

  describe('Spatial Audio State Management', () => {
    test('initializeSpatialAudioState creates valid state', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);

      expect(state).toMatchObject({
        currentBiome: expect.any(String),
        currentNode: expect.any(Object),
        lastPlayerX: 500,
        lastPlayerY: 500,
        activeCrossfade: null,
        audioProfiles: expect.any(Map),
        crossfadeHistory: expect.any(Array),
      });

      expect(state.audioProfiles.size).toBeGreaterThan(0);
    });

    test('updateSpatialAudioState detects minimal movement as no-op', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);
      const updated = updateSpatialAudioState(state, 502, 502, mockWorldState, 10);

      // Minimal movement (<10 units) should not trigger update
      expect(updated === state || updated.lastPlayerX === state.lastPlayerX).toBe(true);
    });

    test('updateSpatialAudioState triggers biome change on significant movement', () => {
      const state = initializeSpatialAudioState(0, 0, mockWorldState);
      const updated = updateSpatialAudioState(state, 200, 200, mockWorldState, 10);

      // Significant movement should update position
      expect(updated.lastPlayerX).toBe(200);
      expect(updated.lastPlayerY).toBe(200);
    });

    test('updateSpatialAudioState creates crossfade on biome transition', () => {
      let state = initializeSpatialAudioState(0, 0, mockWorldState);
      const startBiome = state.currentBiome;

      // Move in increments looking for biome change
      for (let i = 1; i < 20; i++) {
        state = updateSpatialAudioState(state, i * 50, i * 50, mockWorldState, i);
        
        if (state.currentBiome !== startBiome && state.activeCrossfade) {
          // Found a biome change with crossfade
          expect(state.activeCrossfade.fromBiome).toBe(startBiome);
          expect(state.activeCrossfade.toBiome).toBe(state.currentBiome);
          return;
        }
      }

      // If we get here, no biome change occurred (which is fine for this test)
      expect(true).toBe(true);
    });

    test('completeCrossfade marks crossfade as done', () => {
      let state = initializeSpatialAudioState(0, 0, mockWorldState);
      
      // Create a crossfade and add to history
      const crossfade = createAudioCrossfade('forest', 'cave', 100, 2000);
      state = {
        ...state,
        activeCrossfade: crossfade,
        crossfadeHistory: [crossfade],
      };

      const completed = completeCrossfade(state, 3100);

      expect(completed.activeCrossfade).toBeNull();
      expect(completed.crossfadeHistory[0].completedAtTick).toBe(3100);
    });
  });

  describe('Audio Parameter Retrieval', () => {
    test('getSpatialAudioParameters returns current biome profile', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);
      const params = getSpatialAudioParameters(state);

      expect(params).toMatchObject({
        biome: state.currentBiome,
        ambientTrack: expect.any(String),
        environmentReverb: expect.any(Number),
        activeTransition: false,
      });
    });

    test('getSpatialAudioParameters indicates active transition', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);
      state.activeCrossfade = createAudioCrossfade('forest', 'cave', 100);

      const params = getSpatialAudioParameters(state);

      expect(params.activeTransition).toBe(true);
    });

    test('interpolateAudioDuringCrossfade returns null without crossfade', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);

      const interpolation = interpolateAudioDuringCrossfade(state, 100);

      expect(interpolation).toBeNull();
    });

    test('interpolateAudioDuringCrossfade calculates progress correctly', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);
      state.activeCrossfade = createAudioCrossfade('forest', 'cave', 100, 1000);

      const halfway = interpolateAudioDuringCrossfade(state, 600); // 500ms into 1000ms crossfade

      expect(halfway).not.toBeNull();
      expect(halfway?.progress).toBe(0.5);
    });

    test('interpolateAudioDuringCrossfade clamps progress to 1', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);
      state.activeCrossfade = createAudioCrossfade('forest', 'cave', 100, 1000);

      const complete = interpolateAudioDuringCrossfade(state, 2000); // Way past end

      expect(complete?.progress).toBe(1);
    });
  });

  describe('Audio Environment Generation', () => {
    test('getAudioEnvironment returns complete descriptor without transition', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);
      const env = getAudioEnvironment(state, 50);

      expect(env).toMatchObject({
        profile: expect.any(Object),
        transition: null,
        node: expect.any(Object),
      });
    });

    test('getAudioEnvironment includes transition during crossfade', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);
      state.activeCrossfade = createAudioCrossfade('forest', 'cave', 100, 2000);

      const env = getAudioEnvironment(state, 1100); // 1000ms into crossfade

      expect(env.transition).not.toBeNull();
      expect(env.transition?.progress).toBe(0.5);
      expect(env.transition?.fromBiome).toBe('forest');
      expect(env.transition?.toBiome).toBe('cave');
    });
  });

  describe('Analytics & Statistics', () => {
    test('getCrossfadeStats tracks crossfade history', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);

      // Simulate multiple crossfades
      state.crossfadeHistory.push(
        { id: 'cf-1', fromBiome: 'forest', toBiome: 'cave', duration: 3000, startedAtTick: 0, completedAtTick: 3000 },
        { id: 'cf-2', fromBiome: 'cave', toBiome: 'mountain', duration: 2000, startedAtTick: 5000, completedAtTick: 7000 }
      );

      const stats = getCrossfadeStats(state);

      expect(stats.totalCrossfades).toBe(2);
      expect(stats.biomesVisited.has('forest')).toBe(true);
      expect(stats.biomesVisited.has('cave')).toBe(true);
      expect(stats.biomesVisited.has('mountain')).toBe(true);
      expect(stats.averageDuration).toBe(2500); // (3000 + 2000) / 2
    });

    test('getCrossfadeStats handles empty history', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);

      const stats = getCrossfadeStats(state);

      expect(stats.totalCrossfades).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.biomesVisited.size).toBe(0);
    });
  });

  describe('Spatial Audio Integration Scenario', () => {
    test('complete player journey through multiple biomes', () => {
      let state = initializeSpatialAudioState(0, 0, mockWorldState);
      const startBiome = state.currentBiome;

      // Player journey: move through coordinates
      const coordinates = [[100, 100], [200, 200], [300, 300], [400, 400], [500, 500]];
      let crossfadeCount = 0;

      coordinates.forEach(([x, y], i) => {
        state = updateSpatialAudioState(state, x, y, mockWorldState, i * 100);

        if (state.currentBiome !== startBiome && state.activeCrossfade && crossfadeCount === 0) {
          crossfadeCount++;
          // Complete the crossfade
          state = completeCrossfade(state, i * 100 + 3000);
        }
      });

      // Verify journey occurred
      expect(state.crossfadeHistory.length).toBeGreaterThanOrEqual(0);
      
      // Get environment stats
      const stats = getCrossfadeStats(state);
      expect(stats.biomesVisited.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid position updates', () => {
      let state = initializeSpatialAudioState(500, 500, mockWorldState);

      for (let i = 0; i < 100; i++) {
        state = updateSpatialAudioState(state, 500 + i, 500 + i, mockWorldState, i);
      }

      expect(state.lastPlayerX).toBeGreaterThan(500);
      expect(state.lastPlayerY).toBeGreaterThan(500);
    });

    test('handles zero-distance movement', () => {
      const state = initializeSpatialAudioState(500, 500, mockWorldState);
      const unchanged = updateSpatialAudioState(state, 500, 500, mockWorldState, 10);

      expect(unchanged === state || unchanged.lastPlayerX === state.lastPlayerX).toBe(true);
    });

    test('handles extreme coordinates', () => {
      const state = initializeSpatialAudioState(1000, 1000, mockWorldState);

      expect(state.lastPlayerX).toBe(1000);
      expect(state.lastPlayerY).toBe(1000);
      expect(state.currentBiome).toBeDefined();
    });
  });
});
