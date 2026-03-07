/**
 * ALPHA_M9: World Atlas & Map Engine
 * 
 * Handles coordinate-based spatial simulation for Luxfier:
 * - Distance calculations with terrain modifiers
 * - Travel time estimation
 * - Location discovery (fog of war)
 * - Adjacent location detection for exploration
 * 
 * Coordinate System:
 * - Grid: 0-1000 (x, y) normalized coordinates
 * - Allows sub-pixel precision for future expansion
 * - Biome-based terrain modifiers (1.0 normal → 1.5 difficult)
 */

import type { WorldState, Location } from './worldEngine';

/**
 * ALPHA_M9 Type: Spatial metadata for locations
 */
export interface LocationCoordinates {
  id: string;
  x: number;
  y: number;
  biome: 'forest' | 'cave' | 'village' | 'corrupted' | 'shrine' | 'maritime' | 'mountain' | 'plains';
  terrainModifier: number;  // 1.0 normal, 1.5 mountains/swamps, 0.8 roads/plains
}

/**
 * ALPHA_M9 Type: Travel route segment
 */
export interface TravelRoute {
  from: LocationCoordinates;
  to: LocationCoordinates;
  baseDistance: number;      // Euclidean distance
  terrainDistance: number;   // Distance with terrain modifier
  estimatedTravelTicks: number;
  biomeTransitions: string[];  // Biomes crossed during travel
}

/**
 * Calculate Euclidean distance between two points
 */
export function calculateEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get terrain modifier for a biome
 * Represents how difficult/easy it is to traverse
 */
export function getTerrainModifier(biome: string): number {
  const modifiers: Record<string, number> = {
    'plains': 0.8,        // Easy traversal
    'village': 0.7,       // Roads, infrastructure
    'forest': 1.0,        // Standard traversal
    'shrine': 1.1,        // Slightly elevated, contemplative pace
    'maritime': 1.2,      // Water crossings
    'mountain': 1.5,      // Difficult terrain
    'cave': 1.3,          // Underground complexity
    'corrupted': 1.4,     // Hazardous environment
  };
  
  return modifiers[biome] ?? 1.0;
}

/**
 * Calculate travel distance accounting for terrain
 * Returns: distance in "travel units" (normalized 0-1000 grid)
 */
export function calculateTerrainDistance(
  from: LocationCoordinates,
  to: LocationCoordinates
): number {
  const baseDistance = calculateEuclideanDistance(from.x, from.y, to.x, to.y);
  
  // Apply average terrain modifier (blend of source and destination)
  const avgModifier = (from.terrainModifier + to.terrainModifier) / 2;
  
  return baseDistance * avgModifier;
}

/**
 * Convert terrain distance to travel ticks
 * 1 tick ≈ 1 second game time
 * 1 unit distance ≈ 5 ticks movement
 */
export function getTravelTicks(terrainDistance: number): number {
  const BASE_TICKS_PER_UNIT = 5;  // Ticks per distance unit
  return Math.ceil(terrainDistance * BASE_TICKS_PER_UNIT);
}

/**
 * Build full travel route information
 */
export function calculateTravelRoute(
  from: LocationCoordinates,
  to: LocationCoordinates
): TravelRoute {
  const baseDistance = calculateEuclideanDistance(from.x, from.y, to.x, to.y);
  const terrainDistance = calculateTerrainDistance(from, to);
  const travelTicks = getTravelTicks(terrainDistance);
  
  return {
    from,
    to,
    baseDistance,
    terrainDistance,
    estimatedTravelTicks: travelTicks,
    biomeTransitions: [from.biome, to.biome],  // TODO: Calculate intermediate biomes
  };
}

/**
 * Find locations within discovery radius (fog of war mechanics)
 * Default radius: 150 units
 */
export function getAdjacentLocations(
  state: WorldState,
  centerLocationId: string,
  discoveryRadius: number = 150
): Location[] {
  const centerLoc = state.locations.find(l => l.id === centerLocationId);
  if (!centerLoc || centerLoc.x === undefined || centerLoc.y === undefined) {
    return [];
  }

  const centerX = centerLoc.x;
  const centerY = centerLoc.y;

  return state.locations.filter(loc => {
    if (loc.id === centerLocationId || loc.x === undefined || loc.y === undefined) {
      return false;
    }

    const distance = calculateEuclideanDistance(centerX, centerY, loc.x, loc.y);
    return distance <= discoveryRadius;
  });
}

/**
 * ALPHA_M9: Discovery mechanics
 * Check if player should discover adjacent locations based on current location
 * Returns: array of newly discovered location IDs
 */
export function checkLocationDiscovery(
  state: WorldState,
  playerLocationId: string,
  discoveryRadius: number = 150
): string[] {
  const adjacent = getAdjacentLocations(state, playerLocationId, discoveryRadius);
  const newDiscoveries: string[] = [];

  for (const loc of adjacent) {
    if (!loc.discovered) {
      newDiscoveries.push(loc.id);
    }
  }

  return newDiscoveries;
}

/**
 * Mark a location as discovered in the world state
 * Returns: true if location was newly discovered
 */
export function discoverLocation(state: WorldState, locationId: string): boolean {
  const loc = state.locations.find(l => l.id === locationId);
  if (!loc || loc.discovered) {
    return false;
  }

  loc.discovered = true;
  return true;
}

/**
 * Get all discovered locations (for map rendering)
 */
export function getDiscoveredLocations(state: WorldState): Location[] {
  return state.locations.filter(l => l.discovered);
}

/**
 * [Phase 12] Attempts to discover a hidden sub-area within the current location.
 * Success depends on player perception vs sub-area difficulty.
 */
export function discoverSubArea(
  state: WorldState,
  locationId: string,
  subAreaId: string,
  playerPerception: number = 10
): { success: boolean; margin: number; subArea?: any } {
  const loc = state.locations.find(l => l.id === locationId);
  if (!loc || !loc.subAreas) return { success: false, margin: 0 };

  const subArea = loc.subAreas.find(sa => sa.id === subAreaId);
  if (!subArea || subArea.discovered) return { success: false, margin: 0 };

  const dc = subArea.difficulty || 15;
  // Simple check: perception + 1d20 >= DC
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = playerPerception + roll;
  const margin = total - dc;

  if (total >= dc) {
    subArea.discovered = true;
    return { success: true, margin, subArea };
  }

  return { success: false, margin };
}

/**
 * Get map viewport bounds based on player location
 * Returns: { minX, maxX, minY, maxY } for SVG rendering
 */
export interface MapViewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getMapViewport(
  state: WorldState,
  centerLocationId: string,
  viewportSize: number = 300  // Radius around player
): MapViewport {
  const centerLoc = state.locations.find(l => l.id === centerLocationId);
  
  if (!centerLoc || centerLoc.x === undefined || centerLoc.y === undefined) {
    // Default viewport if location not found
    return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  }

  return {
    minX: Math.max(0, centerLoc.x - viewportSize),
    maxX: Math.min(1000, centerLoc.x + viewportSize),
    minY: Math.max(0, centerLoc.y - viewportSize),
    maxY: Math.min(1000, centerLoc.y + viewportSize),
  };
}

/**
 * Get location distance to player (for UI tooltips)
 */
export function getDistanceToPlayer(
  state: WorldState,
  playerLocationId: string,
  targetLocationId: string
): number | null {
  const playerLoc = state.locations.find(l => l.id === playerLocationId);
  const targetLoc = state.locations.find(l => l.id === targetLocationId);

  if (!playerLoc || !targetLoc || playerLoc.x === undefined || playerLoc.y === undefined || targetLoc.x === undefined || targetLoc.y === undefined) {
    return null;
  }

  const playerX = playerLoc.x;
  const playerY = playerLoc.y;
  const targetX = targetLoc.x;
  const targetY = targetLoc.y;

  return calculateEuclideanDistance(playerX, playerY, targetX, targetY);
}

/**
 * Estimate travel time between any two locations (for travel UI)
 */
export function estimateTravelTime(
  state: WorldState,
  fromLocationId: string,
  toLocationId: string
): { ticks: number; seconds: number; label: string } | null {
  const from = state.locations.find(l => l.id === fromLocationId);
  const to = state.locations.find(l => l.id === toLocationId);

  if (!from || !to || from.x === undefined || to.x === undefined) {
    return null;
  }

  const fromCoord: LocationCoordinates = {
    id: from.id,
    x: from.x,
    y: from.y ?? 0,
    biome: (from.biome as any) ?? 'forest',
    terrainModifier: from.terrainModifier ?? 1.0,
  };

  const toCoord: LocationCoordinates = {
    id: to.id,
    x: to.x,
    y: to.y ?? 0,
    biome: (to.biome as any) ?? 'forest',
    terrainModifier: to.terrainModifier ?? 1.0,
  };

  const route = calculateTravelRoute(fromCoord, toCoord);
  const seconds = route.estimatedTravelTicks;  // 1 tick = 1 second
  
  // Generate human-readable label
  let label = 'Very Short';
  if (seconds < 30) label = 'Very Short';
  else if (seconds < 60) label = 'Short';
  else if (seconds < 300) label = 'Medium';
  else if (seconds < 600) label = 'Long';
  else label = 'Very Long';

  return {
    ticks: route.estimatedTravelTicks,
    seconds,
    label,
  };
}
/**
 * Determine biome at given coordinates
 * Checks proximity to named locations first (within 100 units)
 * Falls back to nearest location's biome if in wilderness
 */
export function getBiomeAtCoordinates(
  state: WorldState,
  playerX: number | undefined,
  playerY: number | undefined
): string {
  if (playerX === undefined || playerY === undefined) {
    return 'forest'; // Default fallback
  }

  // Find closest location
  let closestLocation: Location | null = null;
  let closestDistance = Infinity;

  for (const loc of state.locations) {
    if (loc.x === undefined || loc.y === undefined) continue;

    const distance = calculateEuclideanDistance(playerX, playerY, loc.x, loc.y);
    
    // If within 100 units, strongly prefer this location's biome
    if (distance < 100 && distance < closestDistance) {
      closestLocation = loc;
      closestDistance = distance;
    }
  }

  // If no close location found, find the nearest one
  if (!closestLocation) {
    for (const loc of state.locations) {
      if (loc.x === undefined || loc.y === undefined) continue;

      const distance = calculateEuclideanDistance(playerX, playerY, loc.x, loc.y);
      if (distance < closestDistance) {
        closestLocation = loc;
        closestDistance = distance;
      }
    }
  }

  // Return the closest location's biome, or default to forest
  return closestLocation?.biome || 'forest';
}