/**
 * audioEngine.ts - Deterministic Audio State Engine (ALPHA_M8 Phase 1)
 * 
 * Purpose: Calculate and track audio parameters based on world state
 * - Biome/weather-based background music and ambient layers
 * - Tension-driven audio effects (heartbeat, filtering, ducking)
 * - Narrative audio triggers from Director and other systems
 * - Deterministic output for reproducible audio behavior
 * 
 * Philosophy: All audio calculations are deterministic; they depend only on:
 * - Time of day, season, weather
 * - Current location/biome
 * - Narrative tension level
 * - Explicit audio mutations (SET_AUDIO_PARAM events)
 */

import type { WorldState } from './worldEngine';
import { getBiomeAtCoordinates } from './mapEngine';

/**
 * Unique identifier for an audio layer type
 */
export type AudioLayerType = 
  | 'rain-light' | 'rain-heavy'
  | 'wind-light' | 'wind-heavy'
  | 'fire-crackling'
  | 'forest-ambience'
  | 'cave-echo'
  | 'water-flowing'
  | 'heartbeat'
  | 'ominous-hum'
  | 'whisper-ambient';

/**
 * Audio background music track by emotion/biome/time
 */
export type AudioBgmTrack = 
  | 'forest-day' | 'forest-night'
  | 'cave-tense'
  | 'village-peaceful'
  | 'battle-intense'
  | 'exploration-curious'
  | 'silence';

/**
 * Current audio state - what the system thinks should be playing
 */
export interface AudioState {
  tick: number;
  bgm: AudioBgmTrack;                      // Main background music track
  layers: AudioLayerType[];                // Active ambient/environmental layers
  masterVolume: number;                    // 0.0-1.0: overall output volume
  bgmVolume: number;                       // 0.0-1.0: background music channel
  ambientVolume: number;                   // 0.0-1.0: ambient layers (rain, wind, forest)
  sfxVolume: number;                       // 0.0-1.0: sound effects volume
  tensionHum: number;                      // 0.0-1.0: intensity of ominous hum (based on tension)
  heartbeatBpm: number;                    // 60-180: heartbeat tempo when tension > 80
  lowPassCutoff: number;                   // Hz (20-20000): audio filter cutoff (higher = brighter)
  activeNarrationAudio?: {                 // M7 Phase 3 integration: Ambient whisper audio
    whisperVolume: number;                 // 0.0-1.0
    whisperModulation: 'none' | 'reverb' | 'underwater' | 'echo';
  };
  duckingEnabled: boolean;                 // True if high-priority audio (relic whisper) is playing
  duckingAmount: number;                   // 0.0-1.0: how much to reduce ambient volume
  lastMutationTick: number;                // Tick of last SET_AUDIO_PARAM event
  mutationOverrides?: {                    // Manual overrides from SET_AUDIO_PARAM
    bgm?: AudioBgmTrack;
    masterVolume?: number;
    duckingAmount?: number;
    duckingDuration?: number;              // Ticks to apply ducking (countdown)
  };
  // ALPHA_M13: Audio resilience
  hasAssets: boolean;                      // True if sample files loaded successfully
  proceduralMode: 'samples' | 'synthesis'; // 'samples' = audio files, 'synthesis' = oscillators
}

/**
 * Soundscape manifest: maps game conditions to audio signatures
 */
export interface SoundscapeManifest {
  biomes: Record<string, BiomeSoundscape>;
  weather: Record<string, WeatherSoundscape>;
  tensions: TensionAudioStages;
  timeOfDay: Record<string, TimeAudioProfile>;
}

interface BiomeSoundscape {
  bgm: AudioBgmTrack;
  layers: AudioLayerType[];
  atmosphere: 'peaceful' | 'tense' | 'dangerous';
}

interface WeatherSoundscape {
  layers: AudioLayerType[];
  bgmShift?: AudioBgmTrack;  // Override BGM for severe weather
  audioMuffleFactor: number; // 0-1: how much to reduce high frequency
}

interface TensionAudioStages {
  low: { tensionHum: number; heartbeatBpm: number; lowPassCutoff: number };     // 0-30
  moderate: { tensionHum: number; heartbeatBpm: number; lowPassCutoff: number }; // 30-60
  high: { tensionHum: number; heartbeatBpm: number; lowPassCutoff: number };     // 60-80
  critical: { tensionHum: number; heartbeatBpm: number; lowPassCutoff: number }; // 80-100
}

interface TimeAudioProfile {
  bgmVariant: string;  // Day vs night version of tracks
  ambientLayers: AudioLayerType[];
  lightLevel: number;  // 0-1: affects audio brightness/saturation
}

/**
 * Default soundscape definitions
 */
const DEFAULT_SOUNDSCAPE: SoundscapeManifest = {
  biomes: {
    'forest': {
      bgm: 'forest-day',
      layers: ['forest-ambience'],
      atmosphere: 'peaceful'
    },
    'cave': {
      bgm: 'cave-tense',
      layers: ['cave-echo'],
      atmosphere: 'tense'
    },
    'village': {
      bgm: 'village-peaceful',
      layers: [],
      atmosphere: 'peaceful'
    },
    'desert': {
      bgm: 'exploration-curious',
      layers: ['wind-light'],
      atmosphere: 'peaceful'
    },
    'corrupted': {
      bgm: 'battle-intense',
      layers: ['ominous-hum'],
      atmosphere: 'dangerous'
    }
  },
  weather: {
    'clear': {
      layers: [],
      audioMuffleFactor: 0.0
    },
    'rain': {
      layers: ['rain-light'],
      audioMuffleFactor: 0.15
    },
    'snow': {
      layers: ['wind-light'],
      bgmShift: 'exploration-curious',
      audioMuffleFactor: 0.25
    }
  },
  tensions: {
    low: {
      tensionHum: 0.0,
      heartbeatBpm: 0,
      lowPassCutoff: 18000
    },
    moderate: {
      tensionHum: 0.1,
      heartbeatBpm: 0,
      lowPassCutoff: 16000
    },
    high: {
      tensionHum: 0.4,
      heartbeatBpm: 100,
      lowPassCutoff: 12000
    },
    critical: {
      tensionHum: 0.8,
      heartbeatBpm: 140,
      lowPassCutoff: 8000
    }
  },
  timeOfDay: {
    'night': {
      bgmVariant: 'night',
      ambientLayers: ['wind-light'],
      lightLevel: 0.2
    },
    'morning': {
      bgmVariant: 'day',
      ambientLayers: [],
      lightLevel: 0.7
    },
    'afternoon': {
      bgmVariant: 'day',
      ambientLayers: [],
      lightLevel: 1.0
    },
    'evening': {
      bgmVariant: 'evening',
      ambientLayers: ['wind-light'],
      lightLevel: 0.5
    }
  }
};

/**
 * Initialize audio state for a new world
 */
export function initializeAudioState(): AudioState {
  return {
    tick: 0,
    bgm: 'exploration-curious',
    layers: [],
    masterVolume: 0.8,
    bgmVolume: 0.7,
    ambientVolume: 0.6,
    sfxVolume: 0.9,
    tensionHum: 0.0,
    heartbeatBpm: 0,
    lowPassCutoff: 18000,
    duckingEnabled: false,
    duckingAmount: 0.0,
    lastMutationTick: 0,
    // ALPHA_M13: Audio resilience
    hasAssets: true, // Assume assets available; AudioService will correct this if needed
    proceduralMode: 'samples', // Default to sample-based; fallback to synthesis if needed
  };
}

/**
 * Determine which audio stage applies based on tension
 */
export function getTensionStage(tension: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (tension < 30) return 'low';
  if (tension < 60) return 'moderate';
  if (tension < 80) return 'high';
  return 'critical';
}

/**
 * Infer biome from location name
 */
export function detectBiome(locationName: string): string {
  const name = locationName.toLowerCase();
  if (name.includes('void') || name.includes('corrupted') || name.includes('reality') || name.includes('breach') || name.includes('rift')) return 'corrupted';
  if (name.includes('cave') || name.includes('dungeon') || name.includes('cavern')) return 'cave';
  if (name.includes('village') || name.includes('town') || name.includes('settlement')) return 'village';
  if (name.includes('desert') || name.includes('sand') || name.includes('dune')) return 'desert';
  if (name.includes('forest') || name.includes('wood') || name.includes('grove')) return 'forest';
  return 'forest'; // Default biome
}

/**
 * Core deterministic audio calculation function
 * Called each tick to determine what should be playing
 */
export function calculateRequiredAudio(
  state: WorldState,
  currentAudio: AudioState,
  customManifest: SoundscapeManifest = DEFAULT_SOUNDSCAPE
): AudioState {
  const newAudio: AudioState = { ...currentAudio };
  const tension = (state as any).directorState?.narrativeTension ?? 50;
  
  // ALPHA_M9: Use coordinates-based biome detection, fallback to location name detection
  // This supports smooth transitions between named locations and wilderness
  const playerLocation = state.locations.find(l => l.id === state.player.location);
  const playerX = playerLocation?.x;
  const playerY = playerLocation?.y;
  let biome = 'forest';
  
  // Try coordinate-based detection first (for wilderness)
  if (playerX !== undefined && playerY !== undefined) {
    biome = getBiomeAtCoordinates(state, playerX, playerY);
  }
  // Fallback to location name detection (for named locations)
  else if (playerLocation?.name) {
    biome = detectBiome(playerLocation.name);
  }

  newAudio.tick = state.tick ?? 0;

  // === BGM Selection ===
  const biomeSoundscape = customManifest.biomes[biome] || customManifest.biomes['forest'];
  const weatherSoundscape = customManifest.weather[state.weather] || customManifest.weather['clear'];
  
  // Weather can override BGM (severe weather)
  if (weatherSoundscape.bgmShift) {
    newAudio.bgm = weatherSoundscape.bgmShift;
  } else {
    newAudio.bgm = biomeSoundscape.bgm;
  }

  // === Audio Layers (Ambient) ===
  const layers: Set<AudioLayerType> = new Set();

  // Add biome-specific layers
  biomeSoundscape.layers.forEach(l => layers.add(l));

  // Add weather layers
  weatherSoundscape.layers.forEach(l => layers.add(l));

  // Add time-of-day layers
  const timeProfile = customManifest.timeOfDay[state.dayPhase] || customManifest.timeOfDay['afternoon'];
  timeProfile.ambientLayers.forEach(l => layers.add(l));

  // Add tension-based layers
  const tensionStage = getTensionStage(tension);
  if (tensionStage === 'high' || tensionStage === 'critical') {
    layers.add('ominous-hum');
    if (tensionStage === 'critical') {
      layers.add('heartbeat');
    }
  }

  newAudio.layers = Array.from(layers);

  // === Volume Levels ===
  // Weather reduces volume (muffle effect)
  const muffleFactor = weatherSoundscape.audioMuffleFactor;
  newAudio.masterVolume = 0.8 * (1 - muffleFactor * 0.3); // Up to -30% volume in heavy weather

  // Tension affects individual channel volumes
  if (tension > 80) {
    newAudio.ambientVolume = 0.5; // Keep ambience low during critical tension
    newAudio.bgmVolume = 0.85;
  } else if (tension > 60) {
    newAudio.ambientVolume = 0.6;
    newAudio.bgmVolume = 0.75;
  } else {
    newAudio.ambientVolume = 0.7;
    newAudio.bgmVolume = 0.7;
  }

  // === Tension-Based Audio Effects ===
  const tensionAudio = customManifest.tensions[tensionStage];
  newAudio.tensionHum = tensionAudio.tensionHum;
  newAudio.heartbeatBpm = tensionAudio.heartbeatBpm;
  newAudio.lowPassCutoff = tensionAudio.lowPassCutoff;

  // === Ducking (for high-priority events like relic whispers) ===
  // If ducking is active, countdown the duration
  if (currentAudio.mutationOverrides?.duckingDuration && currentAudio.mutationOverrides.duckingDuration > 0) {
    newAudio.duckingEnabled = true;
    newAudio.duckingAmount = currentAudio.mutationOverrides.duckingAmount ?? 0.5;
    const nextDuration = currentAudio.mutationOverrides.duckingDuration - 1;
    newAudio.mutationOverrides = {
      ...currentAudio.mutationOverrides,
      duckingDuration: nextDuration
    };
    // If this was the last tick (duration now 0), disable ducking next time
    if (nextDuration === 0) {
      newAudio.duckingEnabled = false;
    }
  } else {
    newAudio.duckingEnabled = false;
    newAudio.duckingAmount = 0.0;
    // Clear expired mutation overrides
    newAudio.mutationOverrides = undefined;
  }

  // Apply manual overrides if they exist
  if (currentAudio.mutationOverrides) {
    if (currentAudio.mutationOverrides.bgm) newAudio.bgm = currentAudio.mutationOverrides.bgm;
    if (currentAudio.mutationOverrides.masterVolume !== undefined) {
      newAudio.masterVolume = currentAudio.mutationOverrides.masterVolume;
    }
  }

  return newAudio;
}

/**
 * Apply a SET_AUDIO_PARAM mutation to override audio state temporarily
 * Properly stacks/merges with existing overrides
 */
export function applyAudioParameterMutation(
  currentAudio: AudioState,
  mutation: {
    bgm?: AudioBgmTrack;
    masterVolume?: number;
    duckingAmount?: number;
    duckingDuration?: number;
  }
): AudioState {
  // Merge with existing overrides instead of replacing them
  const merged = {
    ...currentAudio.mutationOverrides,
    ...(mutation.bgm !== undefined && { bgm: mutation.bgm }),
    ...(mutation.masterVolume !== undefined && { masterVolume: mutation.masterVolume }),
    ...(mutation.duckingAmount !== undefined && { duckingAmount: mutation.duckingAmount }),
    ...(mutation.duckingDuration !== undefined && { duckingDuration: mutation.duckingDuration }),
  };

  return {
    ...currentAudio,
    mutationOverrides: merged,
    lastMutationTick: currentAudio.tick
  };
}

/**
 * Get audio description for UI/diagnostic purposes
 */
export function describeAudioState(audio: AudioState): string {
  const parts = [
    `BGM: ${audio.bgm}`,
    `Layers: ${audio.layers.length > 0 ? audio.layers.join(', ') : 'none'}`,
    `Tension Hum: ${(audio.tensionHum * 100).toFixed(0)}%`,
    audio.heartbeatBpm > 0 ? `Heartbeat: ${audio.heartbeatBpm}bpm` : 'No heartbeat',
    `Filter: ${audio.lowPassCutoff.toFixed(0)}Hz`,
    audio.duckingEnabled ? `Ducking: ${(audio.duckingAmount * 100).toFixed(0)}%` : ''
  ].filter(Boolean);

  return parts.join(' | ');
}

/**
 * ALPHA_M13: Get procedural oscillator frequency for a biome when samples are unavailable
 * This creates "Sine-scapes" that maintain immersion even without external audio files
 */
export function getProceduralFrequencyForBiome(biome: string): {
  baseFrequency: number;
  modulation: 'low-drone' | 'mid-chirp' | 'high-shimmer' | 'pulse';
  description: string;
} {
  // Map biomes to distinct procedural signatures
  const proceduralScapes: Record<string, any> = {
    'forest': {
      baseFrequency: 880,        // A5 - bright, chirping
      modulation: 'high-shimmer',
      description: 'Forest: high-pitched whisper-chirp'
    },
    'cave': {
      baseFrequency: 40,         // Low sub-bass
      modulation: 'low-drone',
      description: 'Cave: deep, resonant drone'
    },
    'village': {
      baseFrequency: 262,        // C4 - warm, grounding
      modulation: 'mid-chirp',
      description: 'Village: warm, steady pulse'
    },
    'corrupted': {
      baseFrequency: 55,         // A1 - unsettling
      modulation: 'pulse',
      description: 'Corrupted: stuttering, ominous pulse'
    },
    'desert': {
      baseFrequency: 440,        // A4 - clear, wind-like
      modulation: 'high-shimmer',
      description: 'Desert: ethereal wind shimmer'
    },
    'maritime': {
      baseFrequency: 220,        // A3 - deep, wave-like
      modulation: 'low-drone',
      description: 'Maritime: rolling, oceanic drone'
    },
    'shrine': {
      baseFrequency: 528,        // "Healing" frequency
      modulation: 'high-shimmer',
      description: 'Shrine: sacred, shimmering tone'
    }
  };

  return proceduralScapes[biome] || {
    baseFrequency: 440,
    modulation: 'mid-chirp',
    description: 'Default: neutral tone'
  };
}

/**
 * ALPHA_M13: Generate biome-specific procedural audio description for diagnostics
 * Shows what oscillators would play if samples fail to load
 */
export function describeProcedurallAudioFallback(biome: string): string {
  const scape = getProceduralFrequencyForBiome(biome);
  return `[Procedural] ${scape.description} (${scape.baseFrequency}Hz ${scape.modulation})`;
}
