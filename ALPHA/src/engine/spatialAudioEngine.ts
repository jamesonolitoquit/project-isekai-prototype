/**
 * Spatial Audio Synchronization Engine (ALPHA_M10 Phase 1, Step 3)
 * 
 * Watches player coordinate changes and triggers audio transitions when biomes change.
 * Integrates with the Procedural Wilderness Engine for real-time audio environment updates.
 */

import { WorldState } from './worldEngine';
import { generateWildernessNode, type WildernessNode } from './wildernessEngine';

export type AudioBiomeProfile = {
  biome: string;
  ambientTrack: string;           // Background ambient loop
  environmentReverb: number;      // 0-1: Dry to echoey
  crowdDensity: number;           // 0-1: NPC/creature audio
  windIntensity: number;          // 0-1: Environmental ambience
  spiritResonance: number;        // 0-1: Magical saturation
  targetVolume: number;           // 0-1: Master volume for this biome
};

export type AudioCrossfade = {
  id: string;
  fromBiome: string;
  toBiome: string;
  duration: number;               // Milliseconds
  startedAtTick: number;
  completedAtTick?: number;
};

export type SpatialAudioState = {
  currentBiome: string;
  currentNode: WildernessNode | null;
  lastPlayerX: number;
  lastPlayerY: number;
  activeCrossfade: AudioCrossfade | null;
  audioProfiles: Map<string, AudioBiomeProfile>;
  crossfadeHistory: AudioCrossfade[];
};

/**
 * Get audio profile for a biome
 */
export function getBiomeAudioProfile(biome: string): AudioBiomeProfile {
  const profiles: Record<string, AudioBiomeProfile> = {
    forest: {
      biome: 'forest',
      ambientTrack: 'ambient_forest_thick',
      environmentReverb: 0.3,
      crowdDensity: 0.4,           // Creatures, birds
      windIntensity: 0.5,          // Leaves rustling
      spiritResonance: 0.5,
      targetVolume: 0.8,
    },
    cave: {
      biome: 'cave',
      ambientTrack: 'ambient_cave_dripping',
      environmentReverb: 0.9,      // Caves are very echoey
      crowdDensity: 0.3,
      windIntensity: 0.1,          // No wind in caves
      spiritResonance: 0.7,        // More magical
      targetVolume: 0.7,
    },
    mountain: {
      biome: 'mountain',
      ambientTrack: 'ambient_mountain_wind',
      environmentReverb: 0.6,      // Open air
      crowdDensity: 0.2,
      windIntensity: 0.8,          // Lots of wind
      spiritResonance: 0.6,
      targetVolume: 0.75,
    },
    plains: {
      biome: 'plains',
      ambientTrack: 'ambient_plains_grassland',
      environmentReverb: 0.2,      // Very dry, open
      crowdDensity: 0.3,
      windIntensity: 0.4,
      spiritResonance: 0.3,        // Lower magic here
      targetVolume: 0.7,
    },
    corrupted: {
      biome: 'corrupted',
      ambientTrack: 'ambient_corrupted_unsettling',
      environmentReverb: 0.8,      // Distorted reflections
      crowdDensity: 0.6,           // Disturbing sounds
      windIntensity: 0.3,
      spiritResonance: 0.95,       // Very high magical saturation
      targetVolume: 0.9,
    },
    maritime: {
      biome: 'maritime',
      ambientTrack: 'ambient_maritime_waves',
      environmentReverb: 0.5,      // Ocean echo
      crowdDensity: 0.4,           // Sea creatures, gulls
      windIntensity: 0.7,
      spiritResonance: 0.5,
      targetVolume: 0.75,
    },
    shrine: {
      biome: 'shrine',
      ambientTrack: 'ambient_shrine_sacred',
      environmentReverb: 0.7,      // Reverent acoustics
      crowdDensity: 0.2,
      windIntensity: 0.2,
      spiritResonance: 0.85,       // Sacred, highly magical
      targetVolume: 0.65,
    },
    village: {
      biome: 'village',
      ambientTrack: 'ambient_village_chatter',
      environmentReverb: 0.4,
      crowdDensity: 0.8,           // Lots of NPCs/activity
      windIntensity: 0.2,
      spiritResonance: 0.2,        // Civilized, low magic
      targetVolume: 0.7,
    },
  };

  return profiles[biome] || profiles['plains']; // Default to plains
}

/**
 * Check if player has moved to a new biome
 */
export function detectBiomeChange(
  newNode: WildernessNode | null,
  currentBiome: string
): boolean {
  if (!newNode) return false;
  return newNode.biome !== currentBiome;
}

/**
 * Create a crossfade event when moving between biomes
 */
export function createAudioCrossfade(
  fromBiome: string,
  toBiome: string,
  currentTick: number,
  duration: number = 3000 // Default 3 second crossfade
): AudioCrossfade {
  return {
    id: `crossfade-${currentTick}-${fromBiome}-to-${toBiome}`,
    fromBiome,
    toBiome,
    duration,
    startedAtTick: currentTick,
  };
}

/**
 * Update spatial audio state based on player movement
 */
export function updateSpatialAudioState(
  state: SpatialAudioState,
  playerX: number,
  playerY: number,
  worldState: WorldState,
  currentTick: number
): SpatialAudioState {
  // Check if movement is significant (avoid constant updates)
  const distanceMoved = Math.sqrt(
    (playerX - state.lastPlayerX) ** 2 + (playerY - state.lastPlayerY) ** 2
  );

  // Only update if player moved more than 10 units or crossed different coordinate
  const coordinateCrossed =
    Math.floor(playerX / 50) !== Math.floor(state.lastPlayerX / 50) ||
    Math.floor(playerY / 50) !== Math.floor(state.lastPlayerY / 50);

  if (distanceMoved < 10 && !coordinateCrossed) {
    return state; // No significant movement
  }

  // Generate wilderness node at new coordinates
  const newNode = generateWildernessNode(playerX, playerY, worldState.seed);

  // Check for biome change
  if (detectBiomeChange(newNode, state.currentBiome)) {
    // Create crossfade event
    const crossfade = createAudioCrossfade(
      state.currentBiome,
      newNode.biome,
      currentTick
    );

    // Update state
    return {
      ...state,
      currentBiome: newNode.biome,
      currentNode: newNode,
      lastPlayerX: playerX,
      lastPlayerY: playerY,
      activeCrossfade: crossfade,
      crossfadeHistory: [...state.crossfadeHistory, crossfade],
    };
  }

  // No biome change, just update position
  return {
    ...state,
    currentNode: newNode,
    lastPlayerX: playerX,
    lastPlayerY: playerY,
  };
}

/**
 * Complete a crossfade event
 */
export function completeCrossfade(
  state: SpatialAudioState,
  currentTick: number
): SpatialAudioState {
  if (!state.activeCrossfade) return state;

  const completedCrossfade: AudioCrossfade = {
    ...state.activeCrossfade,
    completedAtTick: currentTick,
  };

  return {
    ...state,
    activeCrossfade: null,
    crossfadeHistory: state.crossfadeHistory.map(cf =>
      cf.id === completedCrossfade.id ? completedCrossfade : cf
    ),
  };
}

/**
 * Get current audio parameters based on spatial state and wilderness node
 */
export function getSpatialAudioParameters(
  state: SpatialAudioState
): AudioBiomeProfile & { activeTransition: boolean } {
  const profile = getBiomeAudioProfile(state.currentBiome);
  const activeTransition = state.activeCrossfade !== null;

  return {
    ...profile,
    activeTransition,
  };
}

/**
 * Calculate audio parameter interpolation during crossfade
 */
export function interpolateAudioDuringCrossfade(
  state: SpatialAudioState,
  currentTick: number
): {
  fromProfile: AudioBiomeProfile;
  toProfile: AudioBiomeProfile;
  progress: number;
} | null {
  if (!state.activeCrossfade) return null;

  const elapsed = currentTick - state.activeCrossfade.startedAtTick;
  const progress = Math.min(1, elapsed / state.activeCrossfade.duration);

  return {
    fromProfile: getBiomeAudioProfile(state.activeCrossfade.fromBiome),
    toProfile: getBiomeAudioProfile(state.activeCrossfade.toBiome),
    progress,
  };
}

/**
 * Generate a complete audio environment descriptor for current state
 */
export function getAudioEnvironment(
  state: SpatialAudioState,
  currentTick: number
): {
  profile: AudioBiomeProfile;
  transition: { progress: number; fromBiome: string; toBiome: string } | null;
  node?: WildernessNode;
} {
  const transition = interpolateAudioDuringCrossfade(state, currentTick);
  const profile = getBiomeAudioProfile(state.currentBiome);

  return {
    profile,
    transition: transition ? {
      progress: transition.progress,
      fromBiome: transition.fromProfile.biome,
      toBiome: transition.toProfile.biome,
    } : null,
    node: state.currentNode || undefined,
  };
}

/**
 * Initialize spatial audio state (usually called on world load)
 */
export function initializeSpatialAudioState(
  startX: number,
  startY: number,
  worldState: WorldState
): SpatialAudioState {
  const startNode = generateWildernessNode(startX, startY, worldState.seed);
  const profiles = new Map<string, AudioBiomeProfile>();

  // Pre-populate all biome profiles
  ['forest', 'cave', 'mountain', 'plains', 'corrupted', 'maritime', 'shrine', 'village'].forEach(
    biome => profiles.set(biome, getBiomeAudioProfile(biome))
  );

  return {
    currentBiome: startNode.biome,
    currentNode: startNode,
    lastPlayerX: startX,
    lastPlayerY: startY,
    activeCrossfade: null,
    audioProfiles: profiles,
    crossfadeHistory: [],
  };
}

/**
 * Get crossfade statistics (for analytics/tuning)
 */
export function getCrossfadeStats(state: SpatialAudioState): {
  totalCrossfades: number;
  averageDuration: number;
  biomesVisited: Set<string>;
} {
  const biomesVisited = new Set<string>();
  let totalDuration = 0;

  state.crossfadeHistory.forEach(cf => {
    biomesVisited.add(cf.fromBiome);
    biomesVisited.add(cf.toBiome);
    
    if (cf.completedAtTick) {
      const actualDuration = cf.completedAtTick - cf.startedAtTick;
      totalDuration += actualDuration;
    }
  });

  return {
    totalCrossfades: state.crossfadeHistory.length,
    averageDuration:
      state.crossfadeHistory.length > 0
        ? totalDuration / state.crossfadeHistory.length
        : 0,
    biomesVisited,
  };
}
