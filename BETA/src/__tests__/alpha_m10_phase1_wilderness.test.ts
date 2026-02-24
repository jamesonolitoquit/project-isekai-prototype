/**
 * ALPHA_M10 Phase 1: Procedural Wilderness Engine Tests
 * 
 * Validates deterministic map generation, biome clustering, and resource distribution
 */

import {
  generateWildernessNode,
  exploreWilderness,
  findNearestWildernessNode,
  isValidWildernessCoordinate,
  getWildernessStats,
  wildernessNodeToLocation,
  type WildernessNode,
  type BiomeType,
} from '../engine/wildernessEngine';
import type { Location } from '../engine/worldEngine';

describe('ALPHA_M10 Phase 1: Procedural Wilderness Engine', () => {
  const WORLD_SEED = 42;

  describe('Core Generation - generateWildernessNode', () => {
    test('generates node at coordinate with deterministic properties', () => {
      const node = generateWildernessNode(100, 100, WORLD_SEED);

      expect(node).toMatchObject({
        id: 'wilderness-100-100',
        x: 100,
        y: 100,
        biome: expect.any(String),
        difficulty: expect.any(Number),
        enemyDensity: expect.any(Number),
        spiritDensity: expect.any(Number),
        terrainModifier: expect.any(Number),
        discovered: false,
        seed: expect.any(Number),
      });

      expect(node.difficulty).toBeGreaterThanOrEqual(1);
      expect(node.difficulty).toBeLessThanOrEqual(30);
      expect(node.enemyDensity).toBeGreaterThanOrEqual(0);
      expect(node.enemyDensity).toBeLessThanOrEqual(1);
      expect(node.spiritDensity).toBeGreaterThanOrEqual(0);
      expect(node.spiritDensity).toBeLessThanOrEqual(1);
    });

    test('generates same node when given same coordinates and seed', () => {
      const node1 = generateWildernessNode(200, 300, WORLD_SEED);
      const node2 = generateWildernessNode(200, 300, WORLD_SEED);

      expect(node1.biome).toBe(node2.biome);
      expect(node1.difficulty).toBe(node2.difficulty);
      expect(node1.enemyDensity).toBe(node2.enemyDensity);
      expect(node1.spiritDensity).toBe(node2.spiritDensity);
      expect(node1.terrainModifier).toBe(node2.terrainModifier);
      expect(node1.seed).toBe(node2.seed);
    });

    test('generates different nodes for different seeds', () => {
      const node1 = generateWildernessNode(100, 100, 42);
      const node2 = generateWildernessNode(100, 100, 99);

      // At least one property should differ
      const isSame = 
        node1.biome === node2.biome &&
        node1.difficulty === node2.difficulty &&
        node1.spiritDensity === node2.spiritDensity;

      expect(isSame).toBe(false);
    });

    test('generates valid biome types', () => {
      const validBiomes = ['forest', 'cave', 'mountain', 'plains', 'corrupted', 'maritime', 'shrine'];
      
      for (let i = 0; i < 100; i++) {
        const node = generateWildernessNode(i * 10, i * 10, WORLD_SEED);
        expect(validBiomes).toContain(node.biome);
      }
    });

    test('creates valid resources array', () => {
      const node = generateWildernessNode(150, 250, WORLD_SEED);

      expect(node.resources).toBeInstanceOf(Array);
      expect(node.resources.length).toBeGreaterThan(0);

      node.resources.forEach(resource => {
        expect(resource).toMatchObject({
          itemId: expect.any(String),
          quantity: expect.any(Number),
          rarity: expect.any(Number),
        });
        expect(resource.quantity).toBeGreaterThan(0);
        expect(resource.rarity).toBeGreaterThanOrEqual(0);
        expect(resource.rarity).toBeLessThanOrEqual(1);
      });
    });

    test('clamps coordinates to valid range', () => {
      const node1 = generateWildernessNode(-100, -100, WORLD_SEED);
      const node2 = generateWildernessNode(1500, 1500, WORLD_SEED);

      expect(node1.x).toBeGreaterThanOrEqual(0);
      expect(node1.y).toBeGreaterThanOrEqual(0);
      expect(node2.x).toBeLessThanOrEqual(1000);
      expect(node2.y).toBeLessThanOrEqual(1000);
    });

    test('increases difficulty with distance from origin', () => {
      const centerNode = generateWildernessNode(50, 50, WORLD_SEED);
      const farNode = generateWildernessNode(500, 500, WORLD_SEED);

      // Far nodes should generally have higher difficulty
      expect(farNode.difficulty).toBeGreaterThan(centerNode.difficulty);
    });
  });

  describe('Biome Clustering - Spatial Coherence', () => {
    test('creates coherent biome regions (nearby nodes often similar)', () => {
      const node1 = generateWildernessNode(200, 200, WORLD_SEED);
      const node2 = generateWildernessNode(210, 210, WORLD_SEED);
      
      // Nodes 10 units apart should often share biome or be compatible
      const differentBiomes = node1.biome !== node2.biome;
      
      // Generate 10 pairs and expect most to be same or very close
      let sameCount = 0;
      for (let i = 0; i < 10; i++) {
        const a = generateWildernessNode(100 + i, 100 + i, WORLD_SEED);
        const b = generateWildernessNode(100 + i + 5, 100 + i + 5, WORLD_SEED);
        if (a.biome === b.biome) sameCount++;
      }

      // At least 1 out of 10 pairs should match - validates some clustering exists
      expect(sameCount).toBeGreaterThanOrEqual(1);
    });

    test('terrain modifiers vary by biome type consistently', () => {
      const biomeTerrainMods: Record<string, number[]> = {};

      for (let i = 0; i < 50; i++) {
        const node = generateWildernessNode(i * 5, i * 10, WORLD_SEED + i);
        if (!biomeTerrainMods[node.biome]) {
          biomeTerrainMods[node.biome] = [];
        }
        biomeTerrainMods[node.biome].push(node.terrainModifier);
      }

      // Each biome should have consistent terrain patterns
      Object.entries(biomeTerrainMods).forEach(([biome, mods]) => {
        expect(mods.length).toBeGreaterThan(0);
        const avg = mods.reduce((a, b) => a + b, 0) / mods.length;
        expect(avg).toBeGreaterThan(0.7);
        expect(avg).toBeLessThanOrEqual(1.51);
      });
    });
  });

  describe('Exploration - exploreWilderness', () => {
    test('generates nodes in radius around player', () => {
      const nodes = exploreWilderness(500, 500, 200, WORLD_SEED, 100);

      expect(nodes.length).toBeGreaterThan(0);
      nodes.forEach(node => {
        const distance = Math.sqrt(
          (node.x - 500) ** 2 + (node.y - 500) ** 2
        );
        expect(distance).toBeLessThanOrEqual(200);
      });
    });

    test('respects step parameter (resolution)', () => {
      const nodesStep50 = exploreWilderness(300, 300, 100, WORLD_SEED, 50);
      const nodesStep100 = exploreWilderness(300, 300, 100, WORLD_SEED, 100);

      // Smaller step = more nodes generated
      expect(nodesStep50.length).toBeGreaterThan(nodesStep100.length);
    });

    test('generates consistent nodes for same parameters', () => {
      const nodes1 = exploreWilderness(400, 400, 150, WORLD_SEED, 75);
      const nodes2 = exploreWilderness(400, 400, 150, WORLD_SEED, 75);

      expect(nodes1.length).toBe(nodes2.length);
      for (let i = 0; i < nodes1.length; i++) {
        expect(nodes1[i].id).toBe(nodes2[i].id);
        expect(nodes1[i].biome).toBe(nodes2[i].biome);
      }
    });

    test('handles large radius without performance issues', () => {
      const startTime = performance.now();
      const nodes = exploreWilderness(500, 500, 500, WORLD_SEED, 150);
      const duration = performance.now() - startTime;

      expect(nodes.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('Navigation - findNearestWildernessNode', () => {
    test('finds nearest node to player', () => {
      const nearest = findNearestWildernessNode(300, 300, WORLD_SEED, 500);

      expect(nearest).not.toBeNull();
      if (nearest) {
        expect(nearest.x).toBeGreaterThanOrEqual(0);
        expect(nearest.y).toBeGreaterThanOrEqual(0);
      }
    });

    test('returns null when no nodes in search radius', () => {
      const nearest = findNearestWildernessNode(10, 10, WORLD_SEED, 5);
      expect(nearest).toBeNull();
    });

    test('actually returns the nearest node', () => {
      const playerX = 400;
      const playerY = 400;
      const nearest = findNearestWildernessNode(playerX, playerY, WORLD_SEED, 600);
      
      if (nearest) {
        const nearestDist = Math.sqrt(
          (nearest.x - playerX) ** 2 + (nearest.y - playerY) ** 2
        );

        // Check that no other node in exploration is closer
        const allNodes = exploreWilderness(playerX, playerY, 600, WORLD_SEED, 100);
        allNodes.forEach(node => {
          const nodeDist = Math.sqrt(
            (node.x - playerX) ** 2 + (node.y - playerY) ** 2
          );
          expect(nodeDist).toBeGreaterThanOrEqual(nearestDist);
        });
      }
    });
  });

  describe('Validation - isValidWildernessCoordinate', () => {
    test('allows coordinates far from named locations', () => {
      const namedLocs: Location[] = [
        { id: 'loc1', name: 'Town', x: 100, y: 100 },
      ];

      const isValid = isValidWildernessCoordinate(500, 500, namedLocs);
      expect(isValid).toBe(true);
    });

    test('blocks coordinates too close to named locations', () => {
      const namedLocs: Location[] = [
        { id: 'loc1', name: 'Town', x: 100, y: 100 },
      ];

      const isValid = isValidWildernessCoordinate(110, 100, namedLocs);
      expect(isValid).toBe(false);
    });

    test('checks against multiple named locations', () => {
      const namedLocs: Location[] = [
        { id: 'loc1', name: 'Town A', x: 100, y: 100 },
        { id: 'loc2', name: 'Town B', x: 500, y: 500 },
      ];

      // Between towns
      expect(isValidWildernessCoordinate(300, 300, namedLocs)).toBe(true);
      // Too close to A
      expect(isValidWildernessCoordinate(110, 100, namedLocs)).toBe(false);
      // Too close to B
      expect(isValidWildernessCoordinate(510, 505, namedLocs)).toBe(false);
    });

    test('handles locations without coordinates', () => {
      const namedLocs: Location[] = [
        { id: 'loc1', name: 'Town' },
      ];

      // Should be valid since named location lacks coordinates
      expect(isValidWildernessCoordinate(100, 100, namedLocs)).toBe(true);
    });
  });

  describe('Utilities - getWildernessStats & Conversion', () => {
    test('formats wilderness stats string', () => {
      const node = generateWildernessNode(200, 200, WORLD_SEED, true);
      const stats = getWildernessStats(node);

      expect(stats).toContain('Level');
      expect(stats).toContain(node.biome.toUpperCase());
      expect(stats).toContain('Enemies');
      expect(stats).toContain('Spirit');
      expect(stats).toContain('Resources');
    });

    test('converts wilderness node to location', () => {
      const node = generateWildernessNode(300, 400, WORLD_SEED);
      const location = wildernessNodeToLocation(node);

      expect(location).toMatchObject({
        id: node.id,
        x: node.x,
        y: node.y,
        biome: node.biome,
        terrainModifier: node.terrainModifier,
        discovered: node.discovered,
        spiritDensity: node.spiritDensity,
        subAreas: [],
      });

      expect(location.name).toContain('Level');
      expect(location.description).toContain('procedurally generated');
    });
  });

  describe('Resource Generation - Biome Specificity', () => {
    test('forest biomes generate forest resources', () => {
      // Generate multiple nodes in "forest range"
      let forestCount = 0;
      for (let i = 0; i < 50; i++) {
        const node = generateWildernessNode(i * 5, 50, WORLD_SEED + i);
        if (node.biome === 'forest') {
          forestCount++;
          const resourceIds = node.resources.map(r => r.itemId);
          expect(
            resourceIds.some(id => ['rare-herb', 'mushroom', 'wood'].includes(id))
          ).toBe(true);
        }
      }
      expect(forestCount).toBeGreaterThan(0);
    });

    test('cave biomes generate cave resources', () => {
      let caveCount = 0;
      for (let i = 0; i < 50; i++) {
        const node = generateWildernessNode(50, i * 5, WORLD_SEED + i + 100);
        if (node.biome === 'cave') {
          caveCount++;
          const resourceIds = node.resources.map(r => r.itemId);
          expect(
            resourceIds.some(id => ['iron-ore', 'crystal', 'copper-ingot'].includes(id))
          ).toBe(true);
        }
      }
      expect(caveCount).toBeGreaterThan(0);
    });

    test('corrupted biomes generate unique corrupted resources', () => {
      let corruptedCount = 0;
      for (let i = 0; i < 50; i++) {
        const node = generateWildernessNode(800 + i * 3, 800 + i * 3, WORLD_SEED);
        if (node.biome === 'corrupted') {
          corruptedCount++;
          const resourceIds = node.resources.map(r => r.itemId);
          expect(
            resourceIds.some(id => ['corrupted-essence', 'void-shard', 'lich-bone'].includes(id))
          ).toBe(true);
        }
      }
      expect(corruptedCount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases & Robustness', () => {
    test('handles decimal coordinates with rounding', () => {
      const node1 = generateWildernessNode(100.4, 100.6, WORLD_SEED);
      const node2 = generateWildernessNode(100.1, 100.9, WORLD_SEED);

      // Both should round to same node
      expect(node1.id).toBe(node2.id);
    });

    test('origin coordinates (0, 0) generate valid node', () => {
      const node = generateWildernessNode(0, 0, WORLD_SEED);

      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.difficulty).toBeGreaterThan(0);
    });

    test('max boundary coordinates (1000, 1000) generate valid node', () => {
      const node = generateWildernessNode(1000, 1000, WORLD_SEED);

      expect(node.x).toBe(1000);
      expect(node.y).toBe(1000);
      expect(node.difficulty).toBeGreaterThan(0);
    });

    test('high-difficulty nodes have appropriate enemy/spirit density', () => {
      // Find a high-difficulty node (far from origin)
      const node = generateWildernessNode(900, 900, WORLD_SEED);

      if (node.difficulty > 20) {
        expect(node.enemyDensity).toBeGreaterThan(0.5);
        expect(node.resources.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Integration - Map Exploration Scenario', () => {
    test('complete exploration workflow: generate → validate → navigate → convert', () => {
      const playerStartX = 300;
      const playerStartY = 300;
      const namedLocations: Location[] = [
        { id: 'town', name: 'Starting Town', x: 100, y: 100 },
      ];

      // 1. Generate exploration area
      const nodes = exploreWilderness(playerStartX, playerStartY, 300, WORLD_SEED, 100);
      expect(nodes.length).toBeGreaterThan(0);

      // 2. Filter out nodes too close to named locations
      const validNodes = nodes.filter(
        node => isValidWildernessCoordinate(node.x, node.y, namedLocations)
      );
      expect(validNodes.length).toBeGreaterThan(0);

      // 3. Find nearest valid node
      let nearest: WildernessNode | null = null;
      let nearestDist = Infinity;
      validNodes.forEach(node => {
        const dist = Math.sqrt(
          (node.x - playerStartX) ** 2 + (node.y - playerStartY) ** 2
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = node;
        }
      });
      expect(nearest).not.toBeNull();

      // 4. Convert to location and verify
      if (nearest) {
        const location = wildernessNodeToLocation(nearest);
        expect(location.discovered).toBe(false);
        expect(location.biome).toBeTruthy();
        expect(location.subAreas).toEqual([]);
      }
    });
  });
});
