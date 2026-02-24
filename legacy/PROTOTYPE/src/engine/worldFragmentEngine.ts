/**
 * worldFragmentEngine.ts — Environmental Persistence System (M43 Task A.4)
 * 
 * PURPOSE: Implement world objects that survive epoch transitions with "weathering" effects.
 * Buildings, gardens, and landmarks created by players persistence across generations.
 * 
 * MECHANICS:
 * - FragmentId tracks buildId with durability [0-1]
 * - Each EPOCH_SHIFT reduces durability by 0.2
 * - At durability 0.0, fragment destroyed (unless sealed with /seal_canon)
 * - Sealed fragments within canonical regions are permanent
 * - Visual weathering: opaque current, transparent older, ruined very old
 * 
 * PERFORMANCE: All operations <3ms per fragments
 * DETERMINISM: Fragment lifecycle is deterministic and replay-safe
 */

import type { WorldState, Location } from './worldEngine';
import { seededNow, SeededRng } from './prng';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type FragmentType = 
  | 'building' 
  | 'garden' 
  | 'landmark' 
  | 'shrine' 
  | 'monument' 
  | 'ruin' 
  | 'statue'
  | 'road'
  | 'bridge';

export type FragmentState = 'pristine' | 'weathered' | 'crumbling' | 'ruined' | 'destroyed';

export interface WorldFragment {
  id: string; // Unique fragment identifier
  type: FragmentType;
  name: string; // e.g., "Player-Built Shrine"
  locationId: string; // Which location it's in
  creatorId?: string; // NPC or player who created it
  epochCreated: string; // Epoch ID when created (e.g., "epoch_i_fracture")
  tickCreated: number; // World tick when created
  durability: number; // [0-1] Health of the fragment (1.0 = pristine, 0.0 = destroyed)
  sealed: boolean; // True if /seal_canon was used (prevents further decay)
  sealedAtTick?: number; // When it was sealed
  description: string; // "A shrine built by the player"
  visibleInEpochs: string[]; // Which epochs can see this fragment
  weatheredVariant?: string; // Alternate visual when weathered
  ruinedVariant?: string; // Alternate visual when ruined

  // Metadata for narrative
  affectedNpcs?: string[]; // NPCs who interact with this fragment
  questsAssociated?: string[]; // Quests involving this fragment
  memoryImportance?: 'minor' | 'major' | 'critical'; // Story significance
  
  // Durability tracking
  durabilityHistory?: Array<{
    tick: number;
    previousDurability: number;
    newDurability: number;
    reason: 'epoch_transition' | 'damage' | 'repair' | 'seal';
  }>;
}

export interface FragmentDurabilityState {
  fragmentId: string;
  currentDurability: number;
  durabilityState: FragmentState;
  nextDecayTick?: number; // When durability drops below threshold
  maintenancePoints?: number; // Can be spent to restore durability
}

export interface WorldFragmentRegistry {
  fragments: Map<string, WorldFragment>;
  nextFragmentId: number;
  byLocation: Map<string, string[]>; // locationId → fragmentIds
  byEpoch: Map<string, string[]>; // epochId → fragmentIds
  sealedCount: number;
  totalDurability: number; // Sum of all fragment durabilities
}

// ============================================================================
// FRAGMENT INITIALIZATION & CREATION
// ============================================================================

/**
 * Initialize world fragment registry if not present
 */
export function initializeFragmentRegistry(worldState: WorldState): WorldFragmentRegistry {
  if (!worldState.fragmentRegistry) {
    worldState.fragmentRegistry = {
      fragments: new Map(),
      nextFragmentId: 1,
      byLocation: new Map(),
      byEpoch: new Map(),
      sealedCount: 0,
      totalDurability: 0,
    };
  }
  return worldState.fragmentRegistry;
}

/**
 * Create a new world fragment (building, garden, landmark)
 * Returns the created fragment
 */
export function createFragment(
  worldState: WorldState,
  type: FragmentType,
  name: string,
  locationId: string,
  description: string,
  creatorId?: string
): WorldFragment {
  const registry = initializeFragmentRegistry(worldState);
  const currentEpoch = worldState.epochId ?? 'epoch_0';
  const worldTick = worldState.time?.tick ?? 0;

  const fragment: WorldFragment = {
    id: `fragment_${registry.nextFragmentId++}`,
    type,
    name,
    locationId,
    creatorId,
    epochCreated: currentEpoch,
    tickCreated: worldTick,
    durability: 1.0, // Pristine condition
    sealed: false,
    description,
    visibleInEpochs: [currentEpoch],
    affectedNpcs: [],
    questsAssociated: [],
    memoryImportance: 'minor',
    durabilityHistory: [
      {
        tick: worldTick,
        previousDurability: 1.0,
        newDurability: 1.0,
        reason: 'seal',
      }
    ],
  };

  registry.fragments.set(fragment.id, fragment);

  // Index by location
  if (!registry.byLocation.has(locationId)) {
    registry.byLocation.set(locationId, []);
  }
  registry.byLocation.get(locationId)!.push(fragment.id);

  // Index by epoch
  if (!registry.byEpoch.has(currentEpoch)) {
    registry.byEpoch.set(currentEpoch, []);
  }
  registry.byEpoch.get(currentEpoch)!.push(fragment.id);

  registry.totalDurability += fragment.durability;

  console.log(`[WorldFragment] Created: ${fragment.name} (${fragment.id}) at ${locationId}`);

  return fragment;
}

// ============================================================================
// DURABILITY MANAGEMENT
// ============================================================================

/**
 * Apply weathering to a fragment during epoch transition
 * Standard: -0.2 durability per epoch
 */
export function weatherFragment(
  fragment: WorldFragment,
  worldTick: number,
  amount: number = 0.2
): number {
  if (fragment.sealed) {
    return fragment.durability; // Sealed fragments don't weather
  }

  const previousDurability = fragment.durability;
  fragment.durability = Math.max(fragment.durability - amount, 0);

  // Record durability history
  if (!fragment.durabilityHistory) {
    fragment.durabilityHistory = [];
  }
  fragment.durabilityHistory.push({
    tick: worldTick,
    previousDurability,
    newDurability: fragment.durability,
    reason: 'epoch_transition',
  });

  // Keep history bounded
  if (fragment.durabilityHistory.length > 50) {
    fragment.durabilityHistory.shift();
  }

  return fragment.durability;
}

/**
 * Apply weathering to all fragments in the world during epoch transition
 */
export function weatherAllFragments(
  worldState: WorldState,
  worldTick: number
): { fragmentsDestroyed: number; fragmentsWeathered: number } {
  const registry = initializeFragmentRegistry(worldState);
  let destroyed = 0;
  let weathered = 0;

  for (const fragment of registry.fragments.values()) {
    const previousDurability = fragment.durability;
    weatherFragment(fragment, worldTick);

    if (previousDurability > 0 && fragment.durability === 0) {
      destroyed++;
      console.log(`[WorldFragment] Destroyed: ${fragment.name} (${fragment.id})`);
    } else if (fragment.durability !== previousDurability) {
      weathered++;
    }
  }

  // Recalculate total durability
  registry.totalDurability = Array.from(registry.fragments.values())
    .reduce((sum, f) => sum + f.durability, 0);

  return { fragmentsDestroyed: destroyed, fragmentsWeathered: weathered };
}

/**
 * Repair a fragment by spending maintenance points
 */
export function repairFragment(
  fragment: WorldFragment,
  worldTick: number,
  durabilityRestored: number
): number {
  const previousDurability = fragment.durability;
  fragment.durability = Math.min(fragment.durability + durabilityRestored, 1.0);

  if (!fragment.durabilityHistory) {
    fragment.durabilityHistory = [];
  }
  fragment.durabilityHistory.push({
    tick: worldTick,
    previousDurability,
    newDurability: fragment.durability,
    reason: 'repair',
  });

  return fragment.durability;
}

/**
 * Seal a fragment permanently using /seal_canon mechanism
 * Prevents further weathering
 */
export function sealFragment(
  fragment: WorldFragment,
  worldTick: number,
  description?: string
): void {
  const previousDurability = fragment.durability;
  
  fragment.sealed = true;
  fragment.sealedAtTick = worldTick;

  if (!fragment.durabilityHistory) {
    fragment.durabilityHistory = [];
  }
  fragment.durabilityHistory.push({
    tick: worldTick,
    previousDurability,
    newDurability: fragment.durability,
    reason: 'seal',
  });

  console.log(`[WorldFragment] Sealed: ${fragment.name} (${fragment.id})`);
}

// ============================================================================
// FRAGMENT STATE EVALUATION
// ============================================================================

/**
 * Calculate visual state of fragment based on durability
 * Used to determine which variant to display
 */
export function getFragmentState(fragment: WorldFragment): FragmentState {
  if (fragment.durability === 0) {
    return 'destroyed';
  } else if (fragment.durability < 0.25) {
    return 'ruined';
  } else if (fragment.durability < 0.5) {
    return 'crumbling';
  } else if (fragment.durability < 0.8) {
    return 'weathered';
  } else {
    return 'pristine';
  }
}

/**
 * Get visual variant name for UI rendering
 * Returns base name or suffixed variant
 */
export function getFragmentVisualVariant(fragment: WorldFragment): string {
  const state = getFragmentState(fragment);

  switch (state) {
    case 'pristine':
      return fragment.name;
    case 'weathered':
      return fragment.weatheredVariant || `${fragment.name} (weathered)`;
    case 'crumbling':
      return `${fragment.name} (crumbling)`;
    case 'ruined':
      return fragment.ruinedVariant || `${fragment.name} (ruined)`;
    case 'destroyed':
      return `Ruins of ${fragment.name}`;
    default:
      return fragment.name;
  }
}

/**
 * Get opacity for visual display based on durability and age
 */
export function getFragmentOpacity(
  fragment: WorldFragment,
  currentEpoch: string
): number {
  // Current epoch: fully opaque if in visible epochs
  if (fragment.visibleInEpochs.includes(currentEpoch)) {
    // Opacity decreases with durability loss
    return 0.7 + fragment.durability * 0.3;
  } else {
    // Past epochs: semi-transparent (memory/ghost)
    return 0.3 + fragment.durability * 0.2;
  }
}

/**
 * Calculate how memorable/important this fragment is
 * Affects NPC dialogue and quest generation
 */
export function getFragmentImportance(fragment: WorldFragment): number {
  let importance = 0;

  // Type-based importance
  const importanceMap: Record<FragmentType, number> = {
    'shrine': 0.8,
    'monument': 0.7,
    'building': 0.5,
    'landmark': 0.6,
    'garden': 0.3,
    'ruin': 0.6,
    'statue': 0.7,
    'road': 0.2,
    'bridge': 0.4,
  };
  importance += importanceMap[fragment.type] ?? 0.5;

  // Duration since creation
  const ageBonus = fragment.tickCreated > 0 ? 0.1 : 0;
  importance += ageBonus;

  // Known by NPCs increases importance
  const npcBonus = (fragment.affectedNpcs?.length ?? 0) * 0.05;
  importance += npcBonus;

  // Associated quests increase importance
  const questBonus = (fragment.questsAssociated?.length ?? 0) * 0.1;
  importance += questBonus;

  // Explicit memory importance
  if (fragment.memoryImportance === 'critical') {
    importance += 0.5;
  } else if (fragment.memoryImportance === 'major') {
    importance += 0.25;
  }

  return Math.min(importance, 1.0);
}

// ============================================================================
// FRAGMENT QUERIES & LISTING
// ============================================================================

/**
 * Get all fragments visible in current location
 */
export function getFragmentsAtLocation(
  worldState: WorldState,
  locationId: string
): WorldFragment[] {
  const registry = initializeFragmentRegistry(worldState);
  const fragmentIds = registry.byLocation.get(locationId) ?? [];
  return fragmentIds
    .map(id => registry.fragments.get(id))
    .filter((f): f is WorldFragment => f !== undefined && f.durability > 0); // Exclude destroyed
}

/**
 * Get all fragments created in an epoch
 */
export function getFragmentsByEpoch(
  worldState: WorldState,
  epochId: string
): WorldFragment[] {
  const registry = initializeFragmentRegistry(worldState);
  const fragmentIds = registry.byEpoch.get(epochId) ?? [];
  return fragmentIds
    .map(id => registry.fragments.get(id))
    .filter((f): f is WorldFragment => f !== undefined);
}

/**
 * Get sealed fragments (permanent canon features)
 */
export function getSealedFragments(worldState: WorldState): WorldFragment[] {
  const registry = initializeFragmentRegistry(worldState);
  return Array.from(registry.fragments.values()).filter(f => f.sealed);
}

/**
 * Get fragments by importance for quest/NPC dialogue generation
 */
export function getImportantFragments(
  worldState: WorldState,
  locationId?: string,
  minImportance: number = 0.5
): WorldFragment[] {
  const registry = initializeFragmentRegistry(worldState);
  let fragments = Array.from(registry.fragments.values());

  if (locationId) {
    fragments = fragments.filter(f => f.locationId === locationId);
  }

  return fragments
    .filter(f => f.durability > 0)
    .filter(f => getFragmentImportance(f) >= minImportance)
    .sort((a, b) => getFragmentImportance(b) - getFragmentImportance(a));
}

/**
 * Get deteriorating fragments (warning: will soon decay)
 */
export function getDeterioratingFragments(
  worldState: WorldState,
  warningThreshold: number = 0.3
): WorldFragment[] {
  const registry = initializeFragmentRegistry(worldState);
  return Array.from(registry.fragments.values()).filter(
    f => f.durability > 0 && f.durability < warningThreshold && !f.sealed
  );
}

// ============================================================================
// REGISTRY & EXPORT
// ============================================================================

/**
 * Get registry statistics for dashboard display
 */
export function getFragmentStats(worldState: WorldState): any {
  const registry = initializeFragmentRegistry(worldState);

  const stats = {
    totalFragments: registry.fragments.size,
    sealedFragments: registry.sealedCount,
    destroyedCount: 0,
    deterioratingCount: getDeterioratingFragments(worldState).length,
    averageDurability: 0,
    byType: {} as Record<FragmentType, number>,
  };

  let totalDurability = 0;
  for (const fragment of registry.fragments.values()) {
    totalDurability += fragment.durability;
    if (fragment.durability === 0) {
      stats.destroyedCount++;
    }
    stats.byType[fragment.type] = (stats.byType[fragment.type] ?? 0) + 1;
  }

  stats.averageDurability = registry.fragments.size > 0
    ? totalDurability / registry.fragments.size
    : 0;

  return stats;
}

/**
 * Export fragment state for save file
 */
export function exportFragmentRegistry(worldState: WorldState): any {
  const registry = initializeFragmentRegistry(worldState);

  return {
    fragments: Array.from(registry.fragments.entries()).map(([id, frag]) => [
      id,
      {
        ...frag,
        durabilityHistory: frag.durabilityHistory?.slice(-10), // Compact history
      }
    ]),
    stats: getFragmentStats(worldState),
  };
}

/**
 * Import fragment state from save file
 */
export function importFragmentRegistry(
  worldState: WorldState,
  exported: any
): void {
  if (!exported?.fragments) return;

  const registry = initializeFragmentRegistry(worldState);

  for (const [id, fragmentData] of exported.fragments) {
    registry.fragments.set(id, fragmentData);
  }

  // Rebuild indices
  registry.byLocation.clear();
  registry.byEpoch.clear();
  registry.sealedCount = 0;

  for (const fragment of registry.fragments.values()) {
    if (!registry.byLocation.has(fragment.locationId)) {
      registry.byLocation.set(fragment.locationId, []);
    }
    registry.byLocation.get(fragment.locationId)!.push(fragment.id);

    if (!registry.byEpoch.has(fragment.epochCreated)) {
      registry.byEpoch.set(fragment.epochCreated, []);
    }
    registry.byEpoch.get(fragment.epochCreated)!.push(fragment.id);

    if (fragment.sealed) {
      registry.sealedCount++;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
// Interfaces are already exported above
