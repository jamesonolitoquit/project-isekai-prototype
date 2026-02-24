/**
 * M35 Task 4: Epoch-Unique Audio Synthesis
 * 
 * Generates epoch-specific soundscapes for each era of Luxfier.
 * Rather than pre-recorded audio, synthesizes layered compositions dynamically
 * based on location, biome, and current epoch phase.
 * 
 * Epoch I (Awakening): Orchestral, hopeful, crystalline bells
 * Epoch II (Unfolding): Electronic blend, temporal echoes, lo-fi undertones
 * Epoch III (Convergence): Glitched orchestral, distorted synth, fracturing ambient
 */

import type { WorldState, Location } from './worldEngine';

/**
 * M37 Task 5: Faction leitmotif mapping
 * Each faction has a unique musical theme that overlays on the biome audio
 */
export interface FactionLeitmotif {
  factionId: string;
  factionName: string;
  baseFrequency: number;          // Hz
  leitmotifName: string;
  description: string;
  primaryInstrument: 'orchestral' | 'synth' | 'percussion' | 'choir' | 'drone';
  characteristics: {
    bright: number;               // 0-100 (bright vs dark)
    energetic: number;             // 0-100 (calm vs energetic)
    magical: number;               // 0-100 (mundane vs magical)
  };
  baseVolume: number;             // Default layer volume (0-100)
  themeLayerColor: string;        // Hex color for UI visualization
}

/**
 * Sovereign Blend: Crossfade between biome and faction audio
 * Creates atmospheric overlay combining environmental sound with faction leitmotif
 */
export interface SovereignBlend {
  biomeAudioIntensity: number;    // 0-100 how much biome audio is present
  factionAudioIntensity: number;  // 0-100 how much faction theme is present
  blendType: 'fade' | 'harmony' | 'contrast'; // How themes interact
  playerReputation: number;        // -100 to +100 determines prominence of faction theme
  dominanceShift: number;          // 0-100 how firmly faction controls this area
}

/**
 * M37 Task 5: Get all faction leitmotifs
 */
export function getFactionLeitmotifs(): FactionLeitmotif[] {
  return [
    {
      factionId: 'silver-flame',
      factionName: 'The Silver Flame',
      baseFrequency: 523,            // C5 - bright, high pitch
      leitmotifName: 'Choral Ascendance',
      description: 'Sacred choir with crystalline harmonies, hopeful crescendos',
      primaryInstrument: 'choir',
      characteristics: {
        bright: 95,                  // Very bright and luminous
        energetic: 70,               // Uplifting, positive energy
        magical: 85                  // Highly magical/divine
      },
      baseVolume: 60,
      themeLayerColor: '#FFD700'     // Gold
    },
    {
      factionId: 'ironsmith-guild',
      factionName: 'Ironsmith Guild',
      baseFrequency: 110,            // A2 - deep, percussive
      leitmotifName: 'Rhythmic Forge',
      description: 'Hammer strikes, rhythmic metalwork, driving percussion',
      primaryInstrument: 'percussion',
      characteristics: {
        bright: 40,                  // Darker, grounded
        energetic: 90,               // Very energetic and driving
        magical: 10                  // Mundane, crafted
      },
      baseVolume: 65,
      themeLayerColor: '#C0C0C0'     // Silver
    },
    {
      factionId: 'luminara-mercantile',
      factionName: 'Luminara Mercantile Consortium',
      baseFrequency: 440,            // A4 - bright, transactional
      leitmotifName: 'Commercial Aria',
      description: 'Quick merchant jingles, trade bells, bustling marketplace sounds',
      primaryInstrument: 'orchestral',
      characteristics: {
        bright: 75,                  // Bright and eye-catching
        energetic: 80,               // Active, mercantile energy
        magical: 20                  // Practical, few magical elements
      },
      baseVolume: 55,
      themeLayerColor: '#FFA500'     // Orange
    },
    {
      factionId: 'shadow-conclave',
      factionName: 'Shadow Conclave',
      baseFrequency: 55,             // A1 - very deep, ominous
      leitmotifName: 'Eldritch Drone',
      description: 'Deep ambient drones, forbidden whispers, arcane reverberations',
      primaryInstrument: 'drone',
      characteristics: {
        bright: 10,                  // Very dark
        energetic: 30,               // Slow, ominous energy
        magical: 95                  // Intensely magical/forbidden
      },
      baseVolume: 50,
      themeLayerColor: '#4B0082'     // Indigo
    },
    {
      factionId: 'adventurers-league',
      factionName: "Adventurers' League",
      baseFrequency: 330,            // E4 - mid-range, adventurous
      leitmotifName: 'Wanderer\'s March',
      description: 'Upbeat adventuring jingles, fiddle reels, travel motifs',
      primaryInstrument: 'orchestral',
      characteristics: {
        bright: 65,                  // Bright and inviting
        energetic: 85,               // Highly energetic
        magical: 40                  // Some magical, some mundane
      },
      baseVolume: 60,
      themeLayerColor: '#228B22'     // Forest Green
    }
  ];
}

/**
 * M37 Task 5: Get faction leitmotif by faction ID
 */
export function getFactionLeitmotif(factionId: string): FactionLeitmotif | null {
  const leitmotifs = getFactionLeitmotifs();
  return leitmotifs.find(l => l.factionId === factionId) || null;
}

/**
 * M37 Task 5: Get controlling faction for a location
 * Returns faction ID if location is controlled, null if neutral
 */
export function getTerritoryControllingFaction(
  location: Location,
  state: WorldState
): string | null {
  if (!state.factions) return null;

  // Find faction that controls this location
  for (const faction of state.factions) {
    if (faction.controlledLocationIds?.includes(location.id)) {
      return faction.id;
    }
  }

  return null;
}

/**
 * M37 Task 5: Calculate Sovereign Blend parameters
 * Determines how much faction theme overlays the biome audio
 */
export function calculateSovereignBlend(
  location: Location,
  state: WorldState,
  playerReputation: Record<string, number>,
  dominanceLevel: number = 1  // 0-1, how firmly faction controls area
): SovereignBlend {
  const controllingFactionId = getTerritoryControllingFaction(location, state);

  if (!controllingFactionId) {
    // Neutral territory - all biome audio
    return {
      biomeAudioIntensity: 100,
      factionAudioIntensity: 0,
      blendType: 'fade',
      playerReputation: 0,
      dominanceShift: 0
    };
  }

  // Get player's reputation with controlling faction
  const playerRep = playerReputation[controllingFactionId] || 0;

  // Clamp reputation to -100 to +100
  const clampedRep = Math.max(-100, Math.min(100, playerRep));

  // Dominance shifts based on faction control strength (0-100)
  const dominanceShift = Math.min(100, dominanceLevel * 100);

  // If player has negative reputation, they hear less faction theme
  // If player has positive reputation, they hear more faction theme
  const reputationFactor = (clampedRep + 100) / 200; // 0-1 scale

  // Faction audio intensity: high when player likes faction AND faction dominates area
  const factionAudioIntensity = dominanceShift * 0.4 + reputationFactor * 60;

  // Biome audio fills the rest
  const biomeAudioIntensity = 100 - factionAudioIntensity;

  // Determine blend type based on reputation
  let blendType: 'fade' | 'harmony' | 'contrast';
  if (clampedRep > 0) {
    blendType = 'harmony';
  } else if (clampedRep < 0) {
    blendType = 'contrast';
  } else {
    blendType = 'fade';
  }

  return {
    biomeAudioIntensity,
    factionAudioIntensity,
    blendType,
    playerReputation: clampedRep,
    dominanceShift
  };
}

/**
/**
 * Map faction instrument types to audio synth types
 */
function mapInstrumentToSynth(instrument: FactionLeitmotif['primaryInstrument']): AudioLayer['synth'] {
  const mapping: Record<FactionLeitmotif['primaryInstrument'], AudioLayer['synth']> = {
    'orchestral': 'orchestral',
    'synth': 'synth',
    'percussion': 'percussion',
    'choir': 'ambient',      // Vocal sounds map to ambient
    'drone': 'ambient'       // Drone sounds map to ambient
  };
  return mapping[instrument];
}

/**
 * M37 Task 5: Morph soundscape to include faction leitmotif (Sovereign Blend implementation)
 * Adds faction theme layer to existing biome soundscape
 */
export function morphSoundscapeWithFactionTheme(
  baseSoundscape: EpochSoundscape,
  factionLeitmotif: FactionLeitmotif | null,
  blend: SovereignBlend
): EpochSoundscape {
  if (!factionLeitmotif) {
    // No faction control - return base soundscape unchanged
    return baseSoundscape;
  }

  // Create faction theme layer
  const factionLayer: AudioLayer = {
    id: `faction-${factionLeitmotif.factionId}`,
    name: factionLeitmotif.leitmotifName,
    synth: mapInstrumentToSynth(factionLeitmotif.primaryInstrument),
    frequency: factionLeitmotif.baseFrequency,
    volume: (factionLeitmotif.baseVolume * blend.factionAudioIntensity) / 100,
    intensity: blend.factionAudioIntensity,
    modulation: blend.blendType === 'harmony' ? 'sine' : 'square',
    envelope: {
      attack: 500,
      decay: 300,
      sustain: 70,
      release: 400
    }
  };

  // Adjust base layers' intensity based on biome audio factor
  const adjustedLayers = baseSoundscape.layers.map(layer => ({
    ...layer,
    volume: (layer.volume * blend.biomeAudioIntensity) / 100,
    intensity: (layer.intensity * blend.biomeAudioIntensity) / 100
  }));

  return {
    ...baseSoundscape,
    layers: [...adjustedLayers, factionLayer],
    // Adjust master volume to account for additional layer
    masterVolume: Math.min(100, baseSoundscape.masterVolume * 0.9)
  };
}

/**
 * M37 Task 5: Get complete audio state with faction orchestration
 * Combines base epoch soundscape with faction leitmotif
 */
export function getAdaptiveAudioState(
  state: WorldState,
  location: Location,
  playerReputation: Record<string, number> = {}
): { soundscape: EpochSoundscape; blend: SovereignBlend; factionTheme: FactionLeitmotif | null } {
  // Generate base soundscape (existing logic)
  const currentEpoch = (state.epochId?.includes('epoch_i') ? 1 : state.epochId?.includes('epoch_ii') ? 2 : 3) || 1;
  const baseSoundscape = generateEpochSoundscape(state, currentEpoch, location);

  // Calculate blend parameters
  const blend = calculateSovereignBlend(location, state, playerReputation);

  // Get faction theme if territory controlled
  const controllingFactionId = getTerritoryControllingFaction(location, state);
  const factionTheme = controllingFactionId ? getFactionLeitmotif(controllingFactionId) : null;

  // Apply faction theme via Sovereign Blend
  const finalSoundscape = morphSoundscapeWithFactionTheme(baseSoundscape, factionTheme, blend);

  return {
    soundscape: finalSoundscape,
    blend,
    factionTheme
  };
}

/**
 * Audio layer definition - represents a single synthesized track component
 */
export interface AudioLayer {
  id: string;
  name: string;
  synth: 'orchestral' | 'synth' | 'glitch' | 'ambient' | 'percussion';
  frequency: number;           // Hz - base frequency
  volume: number;              // 0-100
  intensity: number;           // 0-100 - how prominent in mix
  modulation: 'sine' | 'square' | 'sawtooth' | 'noise';
  envelope: {
    attack: number;            // milliseconds
    decay: number;             // milliseconds
    sustain: number;           // 0-100
    release: number;           // milliseconds
  };
}

/**
 * Complete soundscape for a moment in time
 */
export interface EpochSoundscape {
  id: string;
  epoch: number;                             // 1, 2, or 3
  biome: string;                             // Location biome
  timeOfDay: 'night' | 'morning' | 'afternoon' | 'evening';
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  layers: AudioLayer[];
  masterVolume: number;                      // 0-100
  glitchIntensity: number;                   // How much temporal distortion
  spiritResonance: number;                   // 0-100 - magical atmosphere
  generatedAt: number;
  durationMs: number;                        // Length of composition
}

/**
 * M35: Generate base layers for epoch I (Awakening)
 * Clean, orchestral, hopeful tones
 */
function generateEpochILayers(): AudioLayer[] {
  return [
    {
      id: 'epoch1-strings',
      name: 'Orchestral Strings',
      synth: 'orchestral',
      frequency: 220,            // A3
      volume: 70,
      intensity: 75,
      modulation: 'sine',
      envelope: {
        attack: 200,
        decay: 100,
        sustain: 80,
        release: 300
      }
    },
    {
      id: 'epoch1-bells',
      name: 'Crystalline Bells',
      synth: 'orchestral',
      frequency: 880,            // A5
      volume: 50,
      intensity: 40,
      modulation: 'sine',
      envelope: {
        attack: 50,
        decay: 500,
        sustain: 10,
        release: 200
      }
    },
    {
      id: 'epoch1-ambient',
      name: 'Ethereal Pad',
      synth: 'ambient',
      frequency: 110,            // A2
      volume: 30,
      intensity: 50,
      modulation: 'sine',
      envelope: {
        attack: 1000,
        decay: 500,
        sustain: 70,
        release: 1000
      }
    }
  ];
}

/**
 * M35: Generate base layers for epoch II (Unfolding)
 * Blend of orchestral and electronic, temporal echoes
 */
function generateEpochIILayers(): AudioLayer[] {
  return [
    {
      id: 'epoch2-synth-lead',
      name: 'Electronic Lead',
      synth: 'synth',
      frequency: 440,            // A4
      volume: 75,
      intensity: 80,
      modulation: 'square',
      envelope: {
        attack: 100,
        decay: 200,
        sustain: 60,
        release: 250
      }
    },
    {
      id: 'epoch2-lofi-bass',
      name: 'Lo-Fi Bass',
      synth: 'synth',
      frequency: 55,             // A1
      volume: 65,
      intensity: 70,
      modulation: 'sawtooth',
      envelope: {
        attack: 150,
        decay: 300,
        sustain: 50,
        release: 200
      }
    },
    {
      id: 'epoch2-echo',
      name: 'Temporal Echo',
      synth: 'ambient',
      frequency: 220,            // A3
      volume: 40,
      intensity: 45,
      modulation: 'sine',
      envelope: {
        attack: 300,
        decay: 800,
        sustain: 20,
        release: 500
      }
    },
    {
      id: 'epoch2-pad',
      name: 'Glitchy Pad',
      synth: 'glitch',
      frequency: 110,            // A2
      volume: 35,
      intensity: 35,
      modulation: 'noise',
      envelope: {
        attack: 200,
        decay: 400,
        sustain: 40,
        release: 300
      }
    }
  ];
}

/**
 * M35: Generate base layers for epoch III (Convergence)
 * Glitched orchestral, distorted synth, fracturing ambient
 */
function generateEpochIIILayers(): AudioLayer[] {
  return [
    {
      id: 'epoch3-glitch-strings',
      name: 'Fractured Strings',
      synth: 'glitch',
      frequency: 220,            // A3
      volume: 80,
      intensity: 85,
      modulation: 'square',
      envelope: {
        attack: 50,
        decay: 150,
        sustain: 30,
        release: 100
      }
    },
    {
      id: 'epoch3-distort-bass',
      name: 'Distorted Low End',
      synth: 'synth',
      frequency: 55,             // A1
      volume: 75,
      intensity: 80,
      modulation: 'sawtooth',
      envelope: {
        attack: 100,
        decay: 200,
        sustain: 40,
        release: 150
      }
    },
    {
      id: 'epoch3-void',
      name: 'Void Ambient',
      synth: 'ambient',
      frequency: 27,             // A0
      volume: 50,
      intensity: 60,
      modulation: 'noise',
      envelope: {
        attack: 800,
        decay: 1000,
        sustain: 50,
        release: 1000
      }
    },
    {
      id: 'epoch3-glitch-hi',
      name: 'Glitch High Freq',
      synth: 'glitch',
      frequency: 1760,           // A6
      volume: 30,
      intensity: 40,
      modulation: 'noise',
      envelope: {
        attack: 10,
        decay: 100,
        sustain: 20,
        release: 50
      }
    }
  ];
}

/**
 * M35: Adjust layer intensity based on biome
 * Different environments have different audio character
 */
function getBiomeLayerModifiers(biome: string): Record<string, number> {
  const modifiers: Record<string, Record<string, number>> = {
    'forest': {
      orchestral: 0.9,
      synth: 0.6,
      glitch: 0.5,
      ambient: 1.2,
      percussion: 0.7
    },
    'cave': {
      orchestral: 0.5,
      synth: 1.1,
      glitch: 1.0,
      ambient: 1.3,
      percussion: 1.2
    },
    'village': {
      orchestral: 1.1,
      synth: 0.8,
      glitch: 0.3,
      ambient: 0.8,
      percussion: 1.3
    },
    'corrupted': {
      orchestral: 0.4,
      synth: 1.3,
      glitch: 1.4,
      ambient: 0.9,
      percussion: 0.9
    },
    'shrine': {
      orchestral: 1.3,
      synth: 0.5,
      glitch: 0.2,
      ambient: 1.4,
      percussion: 0.8
    },
    'maritime': {
      orchestral: 0.8,
      synth: 0.7,
      glitch: 0.6,
      ambient: 1.1,
      percussion: 0.9
    },
    'mountain': {
      orchestral: 1.0,
      synth: 0.6,
      glitch: 0.7,
      ambient: 1.0,
      percussion: 1.1
    }
  };

  return modifiers[biome] || modifiers['forest']; // Default to forest
}

/**
 * M35: Generate time-of-day audio modifiers
 */
function getTimeOfDayModifiers(timeOfDay: WorldState['dayPhase']): {
  volumeShift: number;
  spiritResonance: number;
} {
  const modifiers = {
    'night': { volumeShift: -10, spiritResonance: 90 },
    'morning': { volumeShift: 0, spiritResonance: 60 },
    'afternoon': { volumeShift: 5, spiritResonance: 40 },
    'evening': { volumeShift: -5, spiritResonance: 75 }
  };

  return modifiers[timeOfDay] || modifiers['afternoon'];
}

/**
 * M35: Generate complete soundscape for current world state
 */
export function generateEpochSoundscape(
  state: WorldState,
  epoch: number,
  location: Location
): EpochSoundscape {
  const biome = location.biome || 'forest';
  const timeOfDay = state.dayPhase;
  const season = state.season;
  const now = Date.now();

  // Select base layers for epoch
  let baseLayers: AudioLayer[] = [];
  if (epoch === 1) baseLayers = generateEpochILayers();
  else if (epoch === 2) baseLayers = generateEpochIILayers();
  else if (epoch === 3) baseLayers = generateEpochIIILayers();

  // Apply biome modifiers to layers
  const biomeModifiers = getBiomeLayerModifiers(biome);
  const modifiedLayers = baseLayers.map(layer => {
    const synthType = layer.synth;
    const volumeModifier = biomeModifiers[synthType] || 1.0;
    return {
      ...layer,
      volume: Math.min(100, layer.volume * volumeModifier),
      intensity: Math.min(100, layer.intensity * volumeModifier)
    };
  });

  // Apply time-of-day modifiers
  const timeModifiers = getTimeOfDayModifiers(timeOfDay);
  const finalLayers = modifiedLayers.map(layer => ({
    ...layer,
    volume: Math.max(0, layer.volume + timeModifiers.volumeShift)
  }));

  // Phase 26 Task 1: Calculate glitch intensity from Global Social Tension
  const socialTension = state.socialTension ?? 0;
  const glitchIntensity = calculateGlitchIntensityFromGST(socialTension);

  // Spirit resonance influenced by location magic concentration
  const spiritResonance = Math.min(100, (location.spiritDensity || 50) + timeModifiers.spiritResonance);
  
  // Phase 26 Task 1: Add Tension Dissonance layer if GST > ~0.5
  const dissonanceLayer = generateTensionDissonanceLayer(glitchIntensity);
  const allLayers = dissonanceLayer ? [...finalLayers, dissonanceLayer] : finalLayers;

  // Duration based on epoch (longer in later epochs)
  const durationMs = (epoch === 1 ? 60000 : epoch === 2 ? 90000 : 120000);

  return {
    id: `soundscape-${epoch}-${location.id}-${now}`,
    epoch,
    biome,
    timeOfDay,
    season,
    layers: allLayers,
    masterVolume: epoch === 3 ? 85 : 75,
    glitchIntensity,
    spiritResonance,
    generatedAt: now,
    durationMs
  };
}

/**
 * M35: Get audio synthesis settings for Web Audio API playback
 * Phase 26 Task 1: Enhanced with GST-adaptive dynamic filtering
 */
export function getAudioSynthSettings(soundscape: EpochSoundscape): {
  audioContext: any; // AudioContext
  oscillators: any[]; // OscillatorNode[]
  gainNodes: any[];   // GainNode[]
  filters: any[];     // BiquadFilterNode[]
} {
  // This returns the configuration needed for actual audio synthesis
  // Real implementation would use Web Audio API

  // Phase 26 Task 1: Dynamic filter frequency based on glitch intensity
  // High glitch intensity = lower filter frequency = "smothered" feeling
  let filterFrequency = 4000;  // Default: open, clear
  let filterType: 'highpass' | 'lowpass' = 'lowpass';
  
  if (soundscape.glitchIntensity > 30) {
    // Tension range: low-pass acts as "choking" filter
    // Maps 30-100 glitch to 4000-800 Hz range
    filterFrequency = 4000 - (soundscape.glitchIntensity - 30) * (3200 / 70);
  }
  
  if (soundscape.glitchIntensity > 80) {
    // Extreme tension: switch to high-pass for brittle, harsh effect
    filterType = 'highpass';
    filterFrequency = 200 + (soundscape.glitchIntensity - 80) * 10;  // 200-400 Hz
  }

  return {
    audioContext: undefined,
    oscillators: soundscape.layers.map(layer => ({
      frequency: layer.frequency,
      type: layer.modulation,
      detune: 0
    })),
    gainNodes: soundscape.layers.map(layer => ({
      initialValue: layer.volume / 100,
      attack: layer.envelope.attack,
      decay: layer.envelope.decay,
      sustain: layer.envelope.sustain / 100,
      release: layer.envelope.release
    })),
    filters: [
      {
        type: filterType,
        frequency: filterFrequency,
        Q: Math.min(10, soundscape.glitchIntensity / 10)  // Q increases with intensity for sharper curve
      }
    ]
  };
}

/**
 * M35: Get narrative description of the current soundscape
 * Phase 26 Task 1: Enhanced tension-dependent descriptions
 */
export function getSoundscapeNarrative(soundscape: EpochSoundscape): string {
  const epochNames = {
    1: 'Awakening',
    2: 'Unfolding',
    3: 'Convergence'
  };

  const biomeNames: Record<string, string> = {
    'forest': 'a verdant grove',
    'cave': 'a cavernous depths',
    'village': 'a bustling settlement',
    'corrupted': 'a twisted wasteland',
    'shrine': 'a sacred sanctuary',
    'maritime': 'a coastal realm',
    'mountain': 'a lofty peak'
  };

  const timeDescriptions: Record<string, string> = {
    'night': 'under starless skies',
    'morning': 'as dawn breaks',
    'afternoon': 'bathed in daylight',
    'evening': 'as twilight falls'
  };

  // Phase 26 Task 1: Tension-dependent narrative descriptions
  const tensionDescriptions: Record<string, string> = {
    'harmonic': 'hopeful bells and clear harmonies',
    'balanced': 'flowing harmonies',
    'tense': 'discordant tones with underlying dread',
    'fractured': 'fractured, glitched harmonies wreathed in temporal echoes',
    'shattered': '✨ SHATTERED REALITY: Cacophonous noise and impossible harmonies ✨'
  };

  let tensionDescKey: string;
  if (soundscape.glitchIntensity < 10) {
    tensionDescKey = 'harmonic';
  } else if (soundscape.glitchIntensity < 30) {
    tensionDescKey = 'balanced';
  } else if (soundscape.glitchIntensity < 60) {
    tensionDescKey = 'tense';
  } else if (soundscape.glitchIntensity < 100) {
    tensionDescKey = 'fractured';
  } else {
    tensionDescKey = 'shattered';
  }

  const descriptions = [
    `The songs of ${epochNames[soundscape.epoch as 1 | 2 | 3]} resonate through ${biomeNames[soundscape.biome] || 'the land'} ${timeDescriptions[soundscape.timeOfDay]}—${tensionDescriptions[tensionDescKey]}.`,
    `A soundscape of ${tensionDescriptions[tensionDescKey]} surrounds you in ${biomeNames[soundscape.biome] || 'your current location'}.`,
    `${soundscape.spiritResonance > 70 ? '✨ Ethereal' : 'Contemplative'} melodies ${soundscape.glitchIntensity > 50 ? 'twisted and warped' : 'resonate'} ${timeDescriptions[soundscape.timeOfDay]}.`
  ];

  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

/**
 * M35: Determine if current soundscape should trigger audio events (NPC speech, ambient sounds)
 */
export function shouldTriggerAudioEvent(soundscape: EpochSoundscape): boolean {
  // Chance of audio event based on spirit resonance
  const eventChance = soundscape.spiritResonance / 100 * 0.3; // Up to 30% chance
  return Math.random() < eventChance;
}

/**
 * Phase 26 Task 1: Calculate glitch intensity from Global Social Tension
 * Maps socialTension (0-1) to glitchIntensity (0-100)
 * 
 * GST Impact:
 * - GST 0-0.3: Harmonious (glitchIntensity 0-10)
 * - GST 0.3-0.7: Tense (glitchIntensity 10-50)
 * - GST 0.7-1.0: Dissonant (glitchIntensity 50-100)
 * - GST >= 1.0: Fractured (glitchIntensity 100+)
 */
export function calculateGlitchIntensityFromGST(socialTension: number): number {
  // Clamp social tension to 0-1 range (but allow >1 for extreme cases)
  const baseTension = Math.max(0, Math.min(1, socialTension));
  
  // Non-linear mapping: tension increases exponentially for dramatic effect
  // This creates a "cliff" effect at higher tensions
  const glitchIntensity = Math.pow(baseTension, 0.8) * 100;
  
  // If tension exceeds 1.0 (critical state), add extra intensity
  const extremeBoost = Math.max(0, (socialTension - 1.0) * 50);
  
  return Math.min(150, glitchIntensity + extremeBoost); // Cap at 150 for extreme cases
}

/**
 * Phase 26 Task 1: Generate Tension Dissonance Layer
 * Activated when GST > 0.7 to create unsettling high-frequency noise and discordant strings
 */
function generateTensionDissonanceLayer(glitchIntensity: number): AudioLayer | null {
  // Only activate when glitchIntensity > 35 (roughly GST > 0.5)
  if (glitchIntensity < 35) {
    return null;
  }
  
  // Intensity of dissonance scales with glitch intensity
  const dissonanceVolume = Math.min(100, (glitchIntensity - 35) * 0.8);
  
  return {
    id: 'tension-dissonance',
    name: 'Tension Dissonance',
    synth: 'glitch',
    frequency: 3000 + glitchIntensity * 10,  // High-frequency, rises with tension
    volume: dissonanceVolume,
    intensity: dissonanceVolume,
    modulation: 'noise',  // Noise creates unsettling effect
    envelope: {
      attack: 100 + glitchIntensity * 2,      // Slower attack = more unsettling
      decay: 200 + glitchIntensity * 1.5,
      sustain: Math.max(20, 100 - glitchIntensity),  // Less sustain at high tension
      release: 300 + glitchIntensity * 3       // Longer release for lingering effect
    }
  };
}

/**
 * Phase 26 Task 1: Apply reverb decay modulation based on GST
 * Higher tension = longer reverb decay (unnatural temporal echo effect)
 * 
 * Returns reverb decay multiplier (1.0 = normal, 2.0+ = extreme echo)
 */
export function calculateReverbDecayFromGST(socialTension: number): number {
  const baseTension = Math.max(0, Math.min(1, socialTension));
  
  // Base reverb: 1.0 (normal)
  // At GST 0.7: reverb = 1.5x
  // At GST 1.0: reverb = 2.5x (creates "temporal echo" feeling)
  return 1.0 + baseTension * 1.5;
}
