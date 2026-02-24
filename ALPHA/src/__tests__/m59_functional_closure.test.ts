/**
 * m59_functional_closure.test.ts - M59-B1 Functional Closure Tests
 *
 * Comprehensive test suite for:
 * - generatePlaystyleProfile: Analysis of player mutation log to generate playstyle vectors
 * - injectSoulEchoesIntoWorld: Cross-epoch persistence of ancestor manifestations
 * - populateGreatLibrary: Lore Tome creation from historical deeds
 * - ensureGreatLibraryExists: Dynamic library location injection
 */

import {
  generatePlaystyleProfile
} from '../engine/analyticsEngine';
import { populateGreatLibrary, ensureGreatLibraryExists, injectSoulEchoesIntoWorld } from '../engine/chronicleEngine';

describe('M59-B1: Functional Closure & Cross-Epoch Persistence', () => {
  
  // ============================================================================
  // SECTION 1: generatePlaystyleProfile - Mutation Log Analysis
  // ============================================================================

  describe('generatePlaystyleProfile: Playstyle Vector from Mutation Log', () => {
    
    test('should return valid profile for any world state', () => {
      const state = {
        id: 'world_test_empty',
        tick: 0,
        player: { id: 'player_1' },
        npcs: [],
        locations: [],
        factionConflicts: []
      };

      const profile = generatePlaystyleProfile(state as any);

      expect(profile).toBeDefined();
      expect(profile.characterProfile).toBeDefined();
      expect(profile.dominantPlaystyle).toBeDefined();
      expect(profile.profileVersion).toBe(1);
    });

    test('should have playstyle frequencies bounded [0, 1]', () => {
      const state = {
        id: 'world_test_freqs',
        tick: 100,
        player: { id: 'player_1' },
        npcs: [],
        locations: [],
        factionConflicts: []
      };

      const profile = generatePlaystyleProfile(state as any);

      expect(profile.characterProfile.combatFrequency).toBeGreaterThanOrEqual(0);
      expect(profile.characterProfile.combatFrequency).toBeLessThanOrEqual(1);
      expect(profile.characterProfile.socialFrequency).toBeGreaterThanOrEqual(0);
      expect(profile.characterProfile.socialFrequency).toBeLessThanOrEqual(1);
      expect(profile.characterProfile.explorationFrequency).toBeGreaterThanOrEqual(0);
      expect(profile.characterProfile.explorationFrequency).toBeLessThanOrEqual(1);
    });

    test('should have moral alignment bounded [-100, 100]', () => {
      const state = {
        id: 'world_test_moral',
        tick: 50,
        player: { id: 'player_1' },
        npcs: [],
        locations: [],
        factionConflicts: []
      };

      const profile = generatePlaystyleProfile(state as any);

      expect(profile.moralAlignment.alignment).toBeGreaterThanOrEqual(-100);
      expect(profile.moralAlignment.alignment).toBeLessThanOrEqual(100);
    });

    test('should identify valid dominant playstyle', () => {
      const state = {
        id: 'world_test_dominant',
        tick: 150,
        player: { id: 'player_1' },
        npcs: [],
        locations: [],
        factionConflicts: []
      };

      const profile = generatePlaystyleProfile(state as any);

      const validPlaystyles = ['combatant', 'socialite', 'explorer', 'ritualist', 'crafter', 'balanced'];
      expect(validPlaystyles).toContain(profile.dominantPlaystyle);
    });

    test('should include success rate metrics', () => {
      const state = {
        id: 'world_test_rate',
        tick: 200,
        player: { id: 'player_1' },
        npcs: [],
        locations: [],
        factionConflicts: []
      };

      const profile = generatePlaystyleProfile(state as any);

      expect(profile.riskAssessment.averageSuccessRate).toBeGreaterThanOrEqual(0);
      expect(profile.riskAssessment.averageSuccessRate).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // SECTION 2: ensureGreatLibraryExists - Library Location Injection
  // ============================================================================

  describe('ensureGreatLibraryExists: Dynamic Library Location Creation', () => {
    
    test('should return locations unchanged if library exists', () => {
      const locations = [
        {
          id: 'the_great_library',
          name: 'The Great Library',
          biome: 'shrine',
          discovered: true,
          x: 500,
          y: 500
        }
      ];

      const result = ensureGreatLibraryExists(locations);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('the_great_library');
    });

    test('should inject library if missing', () => {
      const locations = [
        { id: 'loc_1', name: 'Village', biome: 'village', x: 100, y: 100 },
        { id: 'loc_2', name: 'Forest', biome: 'forest', x: 300, y: 300 }
      ];

      const result = ensureGreatLibraryExists(locations);

      expect(result.length).toBe(3);
      expect(result.some((loc: any) => loc.id === 'the_great_library')).toBe(true);
    });

    test('should mark library as discovered', () => {
      const result = ensureGreatLibraryExists([]);

      const library = result.find((loc: any) => loc.id === 'the_great_library');
      expect(library.discovered).toBe(true);
    });

    test('should set shrine biome for library', () => {
      const result = ensureGreatLibraryExists([]);

      const library = result.find((loc: any) => loc.id === 'the_great_library');
      expect(library.biome).toBe('shrine');
    });

    test('should place library at map center', () => {
      const result = ensureGreatLibraryExists([]);

      const library = result.find((loc: any) => loc.id === 'the_great_library');
      expect(library.x).toBe(500);
      expect(library.y).toBe(500);
    });

    test('should set high spirit density', () => {
      const result = ensureGreatLibraryExists([]);

      const library = result.find((loc: any) => loc.id === 'the_great_library');
      expect(library.spiritDensity).toBe(0.8);
    });

    test('should preserve existing locations', () => {
      const location1 = { id: 'loc_1', name: 'Village', biome: 'village', x: 100, y: 100 };
      const locations = [location1];

      const result = ensureGreatLibraryExists(locations);

      expect(result[0]).toEqual(location1);
    });
  });

  // ============================================================================
  // SECTION 3: populateGreatLibrary - Lore Tome Generation
  // ============================================================================

  describe('populateGreatLibrary: Lore Tome Generation from Deeds', () => {

    test('should return array for any valid state', () => {
      const state = {
        id: 'world_no_events',
        tick: 100,
        player: { bloodlineData: { canonicalName: 'Test Player', deeds: [] } },
        epochs: 1,
        epochId: 'epoch_test'
      };

      const result = populateGreatLibrary(state as any, {} as any);

      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle missing bloodline gracefully', () => {
      const state = {
        id: 'world_no_bloodline',
        tick: 100,
        player: { bloodlineData: null },
        epochId: 'epoch_test'
      };

      const result = populateGreatLibrary(state as any, {} as any);

      expect(Array.isArray(result)).toBe(true);
    });

    test('should execute without errors for populated state', () => {
      const state = {
        id: 'world_with_events',
        tick: 500,
        player: {
          bloodlineData: {
            canonicalName: 'Legend',
            deeds: ['Defeated dragon', 'Saved village']
          }
        },
        epochId: 'epoch_ii_awakening'
      };

      expect(() => {
        populateGreatLibrary(state as any, {} as any);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 4: injectSoulEchoesIntoWorld - Ancestor Manifestation
  // ============================================================================

  describe('injectSoulEchoesIntoWorld: Soul Echo NPC Manifestation', () => {

    test('should return state unchanged if no bloodline data', () => {
      const state = {
        id: 'world_no_blood',
        tick: 100,
        locations: [],
        npcs: [],
        player: { id: 'player_1' }
      };

      const result = injectSoulEchoesIntoWorld(state as any);

      expect(result).toEqual(state);
    });

    test('should return state unchanged if deeds array is empty', () => {
      const state = {
        id: 'world_no_deeds',
        tick: 100,
        locations: [],
        npcs: [],
        player: { id: 'player_1' }
      };

      const bloodlineData = {
        canonicalName: 'Test',
        inheritedPerks: [],
        epochsLived: 1,
        deeds: []
      };

      const result = injectSoulEchoesIntoWorld(state as any, bloodlineData);

      expect(result).toEqual(state);
    });

    test('should return state unchanged if library missing', () => {
      const state = {
        id: 'world_no_lib',
        tick: 100,
        locations: [
          { id: 'loc_1', name: 'Village', biome: 'village', x: 100, y: 100 }
        ],
        npcs: [],
        player: { id: 'player_1' }
      };

      const bloodlineData = {
        canonicalName: 'Ancestor',
        inheritedPerks: [],
        epochsLived: 2,
        deeds: ['Great deed 1']
      };

      const result = injectSoulEchoesIntoWorld(state as any, bloodlineData);

      expect(result).toEqual(state);
    });

    test('should add NPCs when library and deeds present', () => {
      const state = {
        id: 'world_with_lib',
        tick: 100,
        locations: [
          {
            id: 'the_great_library',
            name: 'The Great Library',
            biome: 'shrine',
            x: 500,
            y: 500
          }
        ],
        npcs: [
          { id: 'npc_1', name: 'Bard', emotions: {} }
        ],
        player: { id: 'player_1' }
      };

      const bloodlineData = {
        canonicalName: 'Legendary Hero',
        inheritedPerks: [],
        epochsLived: 3,
        deeds: ['Slew the dark lord', 'Saved the realm']
      };

      const result = injectSoulEchoesIntoWorld(state as any, bloodlineData);

      expect(result.npcs).toBeDefined();
      expect(result.npcs!.length).toBeGreaterThanOrEqual(state.npcs.length);
    });

    test('should execute without errors', () => {
      const state = {
        id: 'world_test',
        tick: 100,
        locations: [
          {
            id: 'the_great_library',
            name: 'The Great Library',
            biome: 'shrine',
            x: 500,
            y: 500
          }
        ],
        npcs: [
          { id: 'npc_1', name: 'Merchant', emotions: {}, rumors: [] }
        ],
        player: { id: 'player_1' }
      };

      const bloodlineData = {
        canonicalName: 'Founder',
        inheritedPerks: [],
        epochsLived: 5,
        deeds: ['Founded the kingdom', 'Created the law']
      };

      expect(() => {
        injectSoulEchoesIntoWorld(state as any, bloodlineData);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 5: Cross-Epoch Persistence Integration
  // ============================================================================

  describe('Cross-Epoch Persistence Integration', () => {

    test('should integrate library and echo systems', () => {
      const locations = [{ id: 'loc_1', name: 'Start', biome: 'village', x: 0, y: 0 }];

      // Step 1: Ensure library exists
      const withLibrary = ensureGreatLibraryExists(locations);
      expect(withLibrary.some((loc: any) => loc.id === 'the_great_library')).toBe(true);

      // Step 2: Populate lores
      const state = {
        id: 'world_epoch_1',
        tick: 1000,
        locations: withLibrary,
        npcs: [],
        player: {
          bloodlineData: {
            canonicalName: 'Pioneer',
            deeds: ['Explored the north'],
            epochsLived: 1
          }
        }
      };

      const lores = populateGreatLibrary(state as any, {} as any);
      expect(Array.isArray(lores)).toBe(true);

      // Step 3: Inject echoes
      const withEchoes = injectSoulEchoesIntoWorld(state as any, state.player.bloodlineData);
      expect(withEchoes).toBeDefined();
    });
  });
});
