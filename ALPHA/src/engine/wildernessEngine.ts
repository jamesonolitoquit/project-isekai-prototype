/**
 * Wilderness Engine (ALPHA_M10 Phase 1)
 * 
 * Deterministic procedural generation of wilderness nodes using coordinate-based seeding.
 * Every (x, y) coordinate generates the same terrain, difficulty, and rewards given the same worldSeed.
 * Uses a simple Perlin-like hash to create natural-looking biome clustering.
 */

import type { WorldState, Location, SubArea } from './worldEngine';

export type BiomeType = 'forest' | 'cave' | 'mountain' | 'plains' | 'corrupted' | 'maritime' | 'shrine';

export interface WildernessNode {
  id: string;
  x: number;
  y: number;
  biome: BiomeType;
  difficulty: number;           // 1-30, relates to recommended player level
  enemyDensity: number;         // 0-1, spawn rate multiplier
  spiritDensity: number;        // 0-1, magical saturation
  resources: Array<{ itemId: string; quantity: number; rarity: number }>;
  terrainModifier: number;      // Travel difficulty (0.7-1.5)
  discovered: boolean;
  seed: number;                 // Procedural seed for this node
}

export interface ProcGenResult {
  node: WildernessNode;
  discovered: boolean;
}

/**
 * Simple hash function for deterministic coordinates
 * Adapted from Perlin noise principles - maps (x, y) to a consistent value
 */
function coordinateHash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Improved 2D hash with fractal-like persistence for better clustering
 */
function fractalHash(x: number, y: number, seed: number, octaves: number = 3): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * coordinateHash(x * frequency, y * frequency, seed + i * 100);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

/**
 * Determine biome from coordinate hash
 */
function selectBiome(hash: number, seed: number): BiomeType {
  // Seed affects biome probabilities
  const seedMod = (seed % 7) / 7;
  const adjustedHash = (hash + seedMod) % 1;

  const biomes: BiomeType[] = ['forest', 'plains', 'mountain', 'cave', 'maritime', 'corrupted', 'shrine'];
  return biomes[Math.floor(adjustedHash * biomes.length)];
}

/**
 * Generate a wilderness node at a specific coordinate
 */
export function generateWildernessNode(
  x: number,
  y: number,
  worldSeed: number,
  discovered: boolean = false
): WildernessNode {
  // Ensure coordinates are in valid range
  const cleanX = Math.max(0, Math.min(1000, Math.round(x)));
  const cleanY = Math.max(0, Math.min(1000, Math.round(y)));

  // Create session seed per coordinate
  const nodeSeed = coordinateHash(cleanX, cleanY, worldSeed) * 1000000;

  // Generate base properties from noise
  const primaryHash = fractalHash(cleanX, cleanY, worldSeed);
  const difficultyHash = coordinateHash(cleanX * 0.1, cleanY * 0.1, worldSeed + 1);
  const resourceHash = coordinateHash(cleanX * 0.2, cleanY * 0.2, worldSeed + 2);

  const biome = selectBiome(primaryHash, worldSeed);

  // Difficulty scales 1-30 based on distance from center (0, 0) and hash
  const distanceFromOrigin = Math.sqrt(cleanX * cleanX + cleanY * cleanY) / Math.sqrt(1000 * 1000 + 1000 * 1000);
  const baseDifficulty = 5 + distanceFromOrigin * 20;
  const difficulty = Math.round(baseDifficulty + difficultyHash * 10);

  // Enemy density increases with difficulty
  const enemyDensity = (difficulty / 30) * 0.8 + resourceHash * 0.2;

  // Spirit density varies by biome
  const biomeSpiritBase: Record<BiomeType, number> = {
    forest: 0.5,
    cave: 0.7,
    mountain: 0.4,
    plains: 0.3,
    corrupted: 0.9,
    maritime: 0.6,
    shrine: 0.8,
  };
  const spiritDensity = (biomeSpiritBase[biome] + primaryHash * 0.3) / 1.3;

  // Terrain modifier by biome
  const terrainMods: Record<BiomeType, { base: number; variance: number }> = {
    forest: { base: 1.2, variance: 0.2 },
    cave: { base: 1.5, variance: 0.1 },
    mountain: { base: 1.3, variance: 0.3 },
    plains: { base: 0.9, variance: 0.1 },
    corrupted: { base: 1.4, variance: 0.2 },
    maritime: { base: 1.0, variance: 0.2 },
    shrine: { base: 0.8, variance: 0.1 },
  };
  const terrainModifier = terrainMods[biome].base + (primaryHash - 0.5) * terrainMods[biome].variance;

  // Generate resources based on rarity and location
  const resources = generateWildernessResources(biome, difficulty, resourceHash);

  return {
    id: `wilderness-${cleanX}-${cleanY}`,
    x: cleanX,
    y: cleanY,
    biome,
    difficulty: Math.min(30, Math.max(1, difficulty)),
    enemyDensity: Math.max(0, Math.min(1, enemyDensity)),
    spiritDensity: Math.max(0, Math.min(1, spiritDensity)),
    resources,
    terrainModifier,
    discovered,
    seed: Math.floor(nodeSeed),
  };
}

/**
 * Generate loot table for a wilderness node
 */
function generateWildernessResources(
  biome: BiomeType,
  difficulty: number,
  hash: number
): Array<{ itemId: string; quantity: number; rarity: number }> {
  const resources: Array<{ itemId: string; quantity: number; rarity: number }> = [];

  // Biome-specific resources
  const biomeResources: Record<BiomeType, string[]> = {
    forest: ['rare-herb', 'mushroom', 'wood'],
    cave: ['iron-ore', 'crystal', 'copper-ingot'],
    mountain: ['iron-ore', 'gold-ore', 'stone'],
    plains: ['wheat', 'herbs', 'flax'],
    corrupted: ['corrupted-essence', 'void-shard', 'lich-bone'],
    maritime: ['pearl', 'sea-salt', 'coral'],
    shrine: ['sacred-rune', 'blessed-herb', 'relic-stone'],
  };

  const primaryResource = biomeResources[biome][0];
  const quantity = Math.max(1, Math.floor(difficulty / 5)) + Math.floor(hash * 3);
  const rarity = Math.max(0, Math.min(1, (difficulty / 30 + hash) / 2));

  resources.push({
    itemId: primaryResource,
    quantity,
    rarity,
  });

  // Secondary resource with lower probability
  if (hash > 0.7 && biomeResources[biome].length > 1) {
    resources.push({
      itemId: biomeResources[biome][1],
      quantity: Math.max(1, Math.floor(quantity / 2)),
      rarity: rarity * 0.8,
    });
  }

  return resources;
}

/**
 * Convert a WildernessNode into game-playable Location
 */
export function wildernessNodeToLocation(node: WildernessNode): Location {
  return {
    id: node.id,
    name: `Wilderness Node [Level ${node.difficulty}]`,
    description: `A procedurally generated ${node.biome} territory at coordinates (${node.x}, ${node.y})`,
    x: node.x,
    y: node.y,
    biome: node.biome,
    terrainModifier: node.terrainModifier,
    discovered: node.discovered,
    spiritDensity: node.spiritDensity,
    subAreas: [], // Wilderness nodes can also have sub-areas
  };
}

/**
 * Explore an area around player, generating nearby wilderness nodes
 * Returns all nodes within radius
 */
export function exploreWilderness(
  playerX: number,
  playerY: number,
  radius: number,
  worldSeed: number,
  step: number = 50 // Resolution of generation grid
): WildernessNode[] {
  const nodes: WildernessNode[] = [];

  for (let x = playerX - radius; x <= playerX + radius; x += step) {
    for (let y = playerY - radius; y <= playerY + radius; y += step) {
      const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
      if (distance <= radius) {
        const node = generateWildernessNode(x, y, worldSeed);
        nodes.push(node);
      }
    }
  }

  return nodes;
}

/**
 * Get nearest wilderness node to player
 */
export function findNearestWildernessNode(
  playerX: number,
  playerY: number,
  worldSeed: number,
  searchRadius: number = 500
): WildernessNode | null {
  const nodes = exploreWilderness(playerX, playerY, searchRadius, worldSeed, 100);

  if (nodes.length === 0) return null;

  let nearest = nodes[0];
  let nearestDistance = Infinity;

  nodes.forEach(node => {
    const distance = Math.sqrt((node.x - playerX) ** 2 + (node.y - playerY) ** 2);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = node;
    }
  });

  return nearest;
}

/**
 * Validate wilderness coordinates (not on named locations)
 */
export function isValidWildernessCoordinate(
  x: number,
  y: number,
  namedLocations: Location[]
): boolean {
  // Don't generate wilderness nodes too close to named locations
  const MIN_DISTANCE_FROM_NAMED = 150;

  for (const loc of namedLocations) {
    if (loc.x !== undefined && loc.y !== undefined) {
      const distance = Math.sqrt((x - loc.x) ** 2 + (y - loc.y) ** 2);
      if (distance < MIN_DISTANCE_FROM_NAMED) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get statistics about a wilderness area (for scouting preview)
 */
export function getWildernessStats(node: WildernessNode): string {
  return `Level ${node.difficulty} ${node.biome.toUpperCase()} · ` +
         `Enemies: ${Math.round(node.enemyDensity * 100)}% · ` +
         `Spirit: ${Math.round(node.spiritDensity * 100)}% · ` +
         `Resources: ${node.resources.length}`;
}
