/**
 * ALPHA_M8 Phase 1 & 2: Web Audio API Foundation + Sample Loading
 * 
 * AudioService provides client-side Web Audio API infrastructure for:
 * - BGM playback with dual-track crossfading (M8 Phase 2)
 * - Audio sample loading with fetch + Web Audio decoding (M8 Phase 2)
 * - Ambient layer volume control (rain, wind, forest, cave, water, etc)
 * - Tension effects (humming synthesis, heartbeat procedural audio)
 * - Dynamic low-pass filtering for muffling effects (weather)
 * - Ducking automation for high-priority narrative moments
 * - Fallback to procedural oscillators if samples fail to load
 * 
 * This is deterministic client-side audio synthesis that mirrors the
 * audioEngine.ts deterministic calculations on the server.
 */

/**
 * Map track IDs to asset URLs for sample-based playback
 */
export interface AudioManifest {
  tracks: Record<string, string>; // 'forest-day' => '/sounds/bgm/forest-day.mp3'
  ambientLayers: Record<string, string>; // 'rain-light' => '/sounds/ambient/rain-light.mp3'
}

/**
 * Default audio manifest (fallback paths in public/sounds/)
 * All entries default to silence if files don't exist (ALPHA_M13: Audio Resilience)
 */
export const DEFAULT_AUDIO_MANIFEST: AudioManifest = {
  tracks: {
    'forest-day': '/sounds/bgm/forest-day.mp3',
    'forest-night': '/sounds/bgm/forest-night.mp3',
    'cave-tense': '/sounds/bgm/cave-tense.mp3',
    'village-peaceful': '/sounds/bgm/village-peaceful.mp3',
    'battle-intense': '/sounds/bgm/battle-intense.mp3',
    'exploration-curious': '/sounds/bgm/exploration-curious.mp3',
    'silence': '/sounds/bgm/silence.mp3',  // ALPHA_M13: Fallback for all biomes
  },
  ambientLayers: {
    'rain-light': '/sounds/ambient/rain-light.mp3',
    'rain-heavy': '/sounds/ambient/rain-heavy.mp3',
    'wind-light': '/sounds/ambient/wind-light.mp3',
    'wind-strong': '/sounds/ambient/wind-strong.mp3',
    'fire-crackling': '/sounds/ambient/fire-crackling.mp3',
    'forest-ambience': '/sounds/ambient/forest-ambience.mp3',
    'cave-echo': '/sounds/ambient/cave-echo.mp3',
    'water-flowing': '/sounds/ambient/water-flowing.mp3',
    'whisper-ambient': '/sounds/ambient/whisper-ambient.mp3',
    'silence': '/sounds/ambient/silence.mp3',  // ALPHA_M13: Fallback for all layers
  },
};

export type AudioNodeTopology = {
  context: AudioContext;
  masterGain: GainNode;
  bgmGain: GainNode;
  bgmNodeA: { source: AudioBufferSourceNode | null; gain: GainNode } | null;  // Dual-track mixing
  bgmNodeB: { source: AudioBufferSourceNode | null; gain: GainNode } | null;  // For crossfading
  bgmOscillator: OscillatorNode | null;  // Fallback if samples don't load
  ambientGain: GainNode;
  layerGains: Map<string, GainNode>;
  effectsGain: GainNode;
  tensionHumOscillator: OscillatorNode | null;
  heartbeatOscillator: OscillatorNode | null;
  lowPassFilter: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  isLoaded: boolean;  // True if samples successfully loaded
  audioBuffers: Map<string, AudioBuffer>;  // Cached decoded samples
  manifest: AudioManifest;  // Track ID → URL mapping
  isNarrationActive?: boolean;  // M8 Phase 3: Narration (TTS) is playing
  narrationDuckingAmount?: number;  // M8 Phase 3: How much to reduce volume (0.0-1.0)
  // ALPHA_M13: Audio resilience - procedural audio fallback
  hasAssets: boolean;  // True if samples successfully loaded
  proceduralMode: 'samples' | 'synthesis';  // Current audio mode
  biomeOscillators: Map<string, OscillatorNode>;  // Per-biome procedural oscillators
};

/**
 * Initialize Web Audio API context and build the audio node topology
 * Includes dual-track BGM nodes for crossfading (M8 Phase 2)
 */
export function initializeAudioContext(manifest: AudioManifest = DEFAULT_AUDIO_MANIFEST): AudioNodeTopology {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  // === Master Output Chain ===
  const masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);
  masterGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  // === Compressor (prevent clipping) ===
  const compressor = audioContext.createDynamicsCompressor();
  compressor.connect(masterGain);
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // === Low-Pass Filter (for weather muffling) ===
  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.setValueAtTime(18000, audioContext.currentTime); // Clear default
  lowPassFilter.Q.value = 1;
  lowPassFilter.connect(compressor);

  // === BGM Layer (Dual-Track Mixing for Crossfading) ===
  const bgmGain = audioContext.createGain();
  bgmGain.connect(lowPassFilter);
  bgmGain.gain.setValueAtTime(0.5, audioContext.currentTime);

  // Dual-track nodes: one fades out while the other fades in
  const bgmNodeA = {
    source: null as AudioBufferSourceNode | null,
    gain: audioContext.createGain(),
  };
  bgmNodeA.gain.connect(bgmGain);
  bgmNodeA.gain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const bgmNodeB = {
    source: null as AudioBufferSourceNode | null,
    gain: audioContext.createGain(),
  };
  bgmNodeB.gain.connect(bgmGain);
  bgmNodeB.gain.gain.setValueAtTime(0, audioContext.currentTime);

  // === Ambient Layers ===
  const ambientGain = audioContext.createGain();
  ambientGain.connect(lowPassFilter);
  ambientGain.gain.setValueAtTime(0.4, audioContext.currentTime);

  const layerGains = new Map<string, GainNode>();
  const layerTypes = [
    'rain-light', 'rain-heavy',
    'wind-light', 'wind-strong',
    'fire-crackling',
    'forest-ambience',
    'cave-echo',
    'water-flowing',
    'whisper-ambient'
  ];

  for (const layerType of layerTypes) {
    const layerGain = audioContext.createGain();
    layerGain.connect(ambientGain);
    layerGain.gain.setValueAtTime(0, audioContext.currentTime); // Start silent
    layerGains.set(layerType, layerGain);
  }

  // === Effects Layer (Tension/Heartbeat/Hum) ===
  const effectsGain = audioContext.createGain();
  effectsGain.connect(lowPassFilter);
  effectsGain.gain.setValueAtTime(0.3, audioContext.currentTime);

  // === Tension Hum Oscillator (sine wave synthesis) ===
  const tensionHumOscillator = audioContext.createOscillator();
  tensionHumOscillator.type = 'sine';
  tensionHumOscillator.frequency.setValueAtTime(50, audioContext.currentTime); // Sub-bass 50Hz
  tensionHumOscillator.connect(effectsGain);

  // === Heartbeat Oscillator (pulse-like) ===
  const heartbeatOscillator = audioContext.createOscillator();
  heartbeatOscillator.type = 'sine';
  heartbeatOscillator.frequency.setValueAtTime(1, audioContext.currentTime); // 1Hz = 60 bpm baseline
  heartbeatOscillator.connect(effectsGain);

  // Start oscillators running but at zero amplitude initially
  tensionHumOscillator.start();
  heartbeatOscillator.start();

  // === BGM Placeholder Oscillator (Fallback) ===
  // Used if samples don't load; will be replaced with actual samples
  const bgmOscillator = audioContext.createOscillator();
  bgmOscillator.type = 'sine';
  bgmOscillator.frequency.setValueAtTime(440, audioContext.currentTime);
  bgmOscillator.connect(bgmGain);
  bgmOscillator.start();

  return {
    context: audioContext,
    masterGain,
    bgmGain,
    bgmNodeA,
    bgmNodeB,
    bgmOscillator,
    ambientGain,
    layerGains,
    effectsGain,
    tensionHumOscillator,
    heartbeatOscillator,
    lowPassFilter,
    compressor,
    isLoaded: false,  // Initially false; set to true when samples load
    audioBuffers: new Map(),
    manifest,
    // ALPHA_M13: Audio resilience initialization
    hasAssets: true,  // Will be set to false if preload finds no samples
    proceduralMode: 'samples',  // Will switch to 'synthesis' if samples fail
    biomeOscillators: new Map(),  // Empty; populated only in synthesis mode
  };
}

/**
 * Update oscillator frequencies based on audio state
 * Used for tension hum and heartbeat effects
 */
export function updateOscillatorFrequencies(
  topology: AudioNodeTopology,
  tensionHumIntensity: number,  // 0.0 to 0.8
  heartbeatBpm: number,         // 60 to 140 bpm
  biome?: string                // ALPHA_M13: Optional biome for procedural fallback
) {
  const context = topology.context;
  const now = context.currentTime;

  // ALPHA_M13: If in synthesis mode (no samples), use biome-specific procedural frequency for BGM
  if (biome && topology.proceduralMode === 'synthesis' && !topology.hasAssets) {
    // Import would be needed at top of file: getProceduralFrequencyForBiome from audioEngine
    // For now, we map biomes to base frequencies locally to avoid circular imports
    const biomeFrequencies: Record<string, number> = {
      'forest': 880,
      'cave': 40,
      'village': 262,
      'corrupted': 55,
      'desert': 440,
      'maritime': 220,
      'shrine': 528,
    };
    const proceduralFreq = biomeFrequencies[biome] || 440;
    topology.bgmOscillator?.frequency.setTargetAtTime(proceduralFreq, now, 0.15);
  }

  // Update tension hum: higher intensity = higher frequency (subtle pitch shift)
  // Range: 45Hz (low tension) to 80Hz (high tension)
  const hummingFrequency = 45 + tensionHumIntensity * 35;
  topology.tensionHumOscillator?.frequency.setTargetAtTime(
    hummingFrequency,
    now,
    0.1  // 100ms ramp time
  );

  // Update heartbeat: convert BPM to Hz (bpm / 60)
  const heartbeatHz = heartbeatBpm / 60;
  topology.heartbeatOscillator?.frequency.setTargetAtTime(
    heartbeatHz,
    now,
    0.05  // 50ms ramp time for smooth acceleration
  );
}

/**
 * Update volume levels based on audio state
 */
export function updateVolumeLevels(
  topology: AudioNodeTopology,
  masterVolume: number,          // 0.0 to 1.0
  bgmVolume: number,             // 0.0 to 1.0
  ambientVolume: number,         // 0.0 to 1.0
  tensionHumIntensity: number,   // 0.0 to 0.8 (volume of hum effect)
  heartbeatIntensity: number,    // 0.0 to 0.8 (volume of heartbeat)
  duckingAmount: number          // 0.0 to 1.0 (ducking reduction)
) {
  const context = topology.context;
  const now = context.currentTime;
  const rampTime = 0.2; // 200ms smooth transitions

  // Apply ducking to ambient and BGM volumes (multiply by 1 - duckingAmount)
  const bgmDucked = bgmVolume * (1 - duckingAmount);
  const ambientDucked = ambientVolume * (1 - duckingAmount);

  topology.masterGain.gain.setTargetAtTime(masterVolume, now, rampTime);
  topology.bgmGain.gain.setTargetAtTime(bgmDucked, now, rampTime);
  topology.ambientGain.gain.setTargetAtTime(ambientDucked, now, rampTime);

  // Effects (hum + heartbeat) volume
  // Note: Individual frequencies are modulated; this is the combined intensity/volume
  const effectsIntensity = Math.max(tensionHumIntensity, heartbeatIntensity);
  topology.effectsGain.gain.setTargetAtTime(effectsIntensity * 0.3, now, rampTime);
}

/**
 * Update low-pass filter cutoff based on environmental filtering
 * Example: rain/snow muffle the high frequencies
 */
export function updateFilterCutoff(
  topology: AudioNodeTopology,
  cutoffFrequency: number  // 8000Hz to 18000Hz range
) {
  const context = topology.context;
  const now = context.currentTime;
  const rampTime = 0.5; // 500ms for gradual environmental filtering

  // Clamp frequency to reasonable range
  const clamped = Math.max(200, Math.min(20000, cutoffFrequency));
  topology.lowPassFilter.frequency.setTargetAtTime(clamped, now, rampTime);
}

/**
 * Control ducking countdown for ducking effects
 * Ducking fades out over duckingDuration ticks
 */
export function updateDuckingCountdown(
  topology: AudioNodeTopology,
  duckingDuration: number,  // frames remaining with ducking
  currentDuckingAmount: number,
  maxDuckingDuration: number // total duration for this ducking event
): number {
  // Each frame, decrement the countdown
  // When it reaches 0, ducking effect fades out
  if (duckingDuration <= 0) {
    return 0;
  }
  return Math.max(0, duckingDuration - 1);
}

/**
 * Set layer volume for a specific ambient layer
 */
export function setLayerVolume(
  topology: AudioNodeTopology,
  layerType: string,
  volume: number  // 0.0 to 1.0
) {
  const layerGain = topology.layerGains.get(layerType);
  if (layerGain) {
    layerGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      topology.context.currentTime,
      0.3  // 300ms smooth transition
    );
  }
}

/**
 * Disable all layers (reset to silence)
 */
export function disableAllLayers(topology: AudioNodeTopology) {
  const now = topology.context.currentTime;
  topology.layerGains.forEach((layerGain) => {
    layerGain.gain.setTargetAtTime(0, now, 0.2);
  });
}

/**
 * Switch BGM tracks with equal-power crossfading
 * Falls back to procedural oscillators if samples not loaded
 */
export async function switchBgmTrack(
  topology: AudioNodeTopology,
  trackName: string,
  fadeDuration: number = 3.0  // 3 second default crossfade
) {
  // Check for cached buffer first
  let buffer: AudioBuffer | null = topology.audioBuffers.get(trackName) || null;

  // If not cached and manifest has URL, try to load
  if (!buffer && topology.manifest.tracks[trackName]) {
    const url = topology.manifest.tracks[trackName];
    try {
      buffer = await loadSample(url, topology.context);
      if (buffer) {
        topology.audioBuffers.set(trackName, buffer);
        topology.isLoaded = true;
      }
    } catch (e) {
      console.warn(`[AudioService] Failed to load sample ${trackName}:`, e);
      // Fall through to oscillator fallback
    }
  }

  if (buffer && topology.bgmNodeA && topology.bgmNodeB) {
    // Use dual-track crossfading with real sample
    performCrossfade(topology, buffer, fadeDuration);
    topology.isLoaded = true;
  } else {
    // Fallback: use procedural oscillator with frequency mapping
    const trackFrequencies: { [key: string]: number } = {
      'forest-day': 440,          // A4
      'forest-night': 392,        // G4
      'cave-tense': 330,          // E4
      'village-peaceful': 262,    // C4
      'battle-intense': 523,      // C5
      'exploration-curious': 440, // A4
      'silence': 0                // No oscillation
    };

    const frequency = trackFrequencies[trackName] || 440;
    if (topology.bgmOscillator) {
      topology.bgmOscillator.frequency.setTargetAtTime(
        frequency,
        topology.context.currentTime,
        0.5  // 500ms fade for track switching
      );
    }
  }
}

/**
 * Load audio sample from URL using fetch + Web Audio decodeAudioData
 * Returns AudioBuffer or null if failed
 * ALPHA_M13: Suppresses 404 warnings to keep console clean
 */
export async function loadSample(
  url: string,
  audioContext: AudioContext,
  timeoutMs: number = 10000,
  suppressWarnings: boolean = false
): Promise<AudioBuffer | null> {
  try {
    // Fetch the audio file
    const response = await Promise.race([
      fetch(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Load timeout')), timeoutMs)
      ),
    ]) as Response;

    if (!response.ok) {
      // ALPHA_M13: Suppress 404 warnings during asset resilience fallback
      if (!suppressWarnings) {
        console.warn(`[AudioService] HTTP ${response.status}: ${url}`);
      }
      return null;
    }

    // Convert to ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log(`[AudioService] Loaded sample: ${url} (${audioBuffer.duration.toFixed(1)}s)`);

    return audioBuffer;
  } catch (error) {
    // ALPHA_M13: Suppress detailed error messages during preload
    if (!suppressWarnings) {
      console.warn(`[AudioService] Error loading sample ${url}:`, error);
    }
    return null;
  }
}

/**
 * Perform equal-power crossfade between two audio sources
 * Fades out the current source (bgmNodeA), fades in the new source (bgmNodeB)
 */
function performCrossfade(
  topology: AudioNodeTopology,
  nextBuffer: AudioBuffer,
  fadeDuration: number
) {
  const context = topology.context;
  const now = context.currentTime;

  if (!topology.bgmNodeA || !topology.bgmNodeB) {
    console.warn('[AudioService] Dual-track nodes not available for crossfade');
    return;
  }

  // === Fade Out Current (A) ===
  // Stop the old source if it's playing
  if (topology.bgmNodeA.source) {
    try {
      topology.bgmNodeA.source.stop(now + fadeDuration);
    } catch (e) {
      // Already stopped or never started
    }
  }

  // Ramp down A's gain
  topology.bgmNodeA.gain.gain.setValueAtTime(1.0, now);
  topology.bgmNodeA.gain.gain.exponentialRampToValueAtTime(0.01, now + fadeDuration);

  // === Fade In New (B) ===
  // Create new source with the incoming buffer
  const newSource = context.createBufferSource();
  newSource.buffer = nextBuffer;
  newSource.loop = true;  // BGM should loop
  newSource.connect(topology.bgmNodeB.gain);

  // Ramp up B's gain
  topology.bgmNodeB.gain.gain.setValueAtTime(0.01, now);
  topology.bgmNodeB.gain.gain.exponentialRampToValueAtTime(1.0, now + fadeDuration);

  // Start the new source
  newSource.start(now);
  topology.bgmNodeB.source = newSource;

  // After fade completes, swap nodes for the next transition
  setTimeout(() => {
    // Swap A and B for next crossfade
    const temp = topology.bgmNodeA!;
    topology.bgmNodeA = topology.bgmNodeB;
    topology.bgmNodeB = temp;

    // Reset the new "B" for next time
    if (topology.bgmNodeB) {
      topology.bgmNodeB.gain.gain.setValueAtTime(0, context.currentTime);
      topology.bgmNodeB.source = null;
    }
  }, fadeDuration * 1000 + 100);
}

/**
 * Preload multiple audio samples in the background
 * Used for optimizing performance during gameplay
 * ALPHA_M13: Graceful fallback with procedural synthesis if assets missing
 */
export async function preloadAudioSamples(
  urls: string[],
  audioContext: AudioContext,
  audioBuffers: Map<string, AudioBuffer>
): Promise<{ loaded: number; total: number; hasAssets: boolean }> {
  let loaded = 0;
  const suppressWarnings = true; // ALPHA_M13: Suppress 404 warnings during preload

  for (const url of urls) {
    try {
      const buffer = await loadSample(url, audioContext, 10000, suppressWarnings);
      if (buffer && audioBuffers) {
        const key = url.split('/').pop()?.replace('.mp3', '') || url;
        audioBuffers.set(key, buffer);
        loaded++;
      }
    } catch (e) {
      // Silently skip failed loads
    }
  }

  const hasAssets = loaded > 0;
  
  // ALPHA_M13: Single info message instead of per-file spam
  if (hasAssets) {
    console.log(`[AudioService] Preloaded ${loaded}/${urls.length} samples`);
  } else {
    console.info(`[AudioService] Samples missing or unavailable; falling back to procedural synthesis (no console noise)`);
  }

  return { loaded, total: urls.length, hasAssets };
}

/**
 * M8 Phase 3: Set narration active state and apply ducking
 * When narration (TTS) is playing, reduce ambient and music for clarity
 */
export function setNarrationActive(topology: AudioNodeTopology, isActive: boolean) {
  topology.isNarrationActive = isActive;
  
  if (isActive) {
    // Apply ducking: reduce ambient and BGM volumes when narration plays
    // Target: Ambient 30% (ducking 70%), BGM 60% (ducking 40%)
    topology.narrationDuckingAmount = 1.0; // Full ducking
    
    // Smooth ramp to ducking values (500ms for responsive feel)
    const now = topology.context.currentTime;
    const duckDuration = 0.5;
    
    // Ambient: duck to 30%
    topology.ambientGain.gain.linearRampToValueAtTime(
      0.3,
      now + duckDuration
    );
    
    // BGM: duck to 60%
    topology.bgmGain.gain.linearRampToValueAtTime(
      0.6,
      now + duckDuration
    );
    
    console.log('[AudioService] Narration ducking enabled');
  } else {
    // Remove ducking: restore normal volumes
    topology.narrationDuckingAmount = 0.0; // No ducking
    
    // Smooth ramp back to normal (800ms for smooth recovery)
    const now = topology.context.currentTime;
    const recoverDuration = 0.8;
    
    // Ambient: back to normal
    topology.ambientGain.gain.linearRampToValueAtTime(
      1.0,
      now + recoverDuration
    );
    
    // BGM: back to normal
    topology.bgmGain.gain.linearRampToValueAtTime(
      1.0,
      now + recoverDuration
    );
    
    console.log('[AudioService] Narration ducking disabled');
  }
}

/**
 * Cleanup and disposal for when audio is no longer needed
 */
export function disposeAudioContext(topology: AudioNodeTopology) {
  try {
    // Stop oscillators
    topology.tensionHumOscillator?.stop();
    topology.heartbeatOscillator?.stop();
    topology.bgmOscillator?.stop();

    // Stop audio buffer sources
    topology.bgmNodeA?.source?.stop();
    topology.bgmNodeB?.source?.stop();

    // Clear buffer cache
    topology.audioBuffers.clear();

    // Optional: Close the audio context if needed
    // topology.context.close();
    console.log('[AudioService] Audio context disposed');
  } catch (e) {
    console.warn('[AudioService] Error disposing audio context:', e);
  }
}

/**
 * ALPHA_Audit Hardening: Ensure audio context is started
 * 
 * Browser security policy requires user gesture to start audio context.
 * This function checks if context is suspended and attempts to resume it.
 * Called from UI button click (guaranteed user gesture).
 * 
 * Returns: Promise<boolean> - true if audio started/was already running, false if failed
 */
export async function ensureAudioStarted(topology: AudioNodeTopology): Promise<boolean> {
  try {
    if (topology.context.state === 'suspended') {
      console.log(`[AudioService] Audio context suspended. Attempting resume...`);
      await topology.context.resume();
      console.log(`[AudioService] Audio context resumed successfully`);
      return true;
    } else if (topology.context.state === 'running') {
      console.log(`[AudioService] Audio context already running`);
      return true;
    } else {
      console.warn(`[AudioService] Audio context in unexpected state: ${topology.context.state}`);
      return false;
    }
  } catch (err) {
    console.error('[AudioService] Failed to resume audio context:', err);
    return false;
  }
}

/**
 * Phase 32: Diegetic Sound Effects (Physical Board Game Interactions)
 * Synthesized sound effects for tabletop interactions
 */

/**
 * Play a synthesized dice roll sound
 * - Rapid frequency sweep (high to low)
 * - Short duration with decay envelope
 */
export function playDiceRoll(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.4;

    // Dice clatter - 3 oscillators with different frequencies
    for (let i = 0; i < 3; i++) {
      const osc = topology.context.createOscillator();
      const gain = topology.context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 - i * 150, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + duration * 0.7);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      osc.connect(gain);
      gain.connect(topology.context.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    // Add a low-frequency "impact" thump
    const bass = topology.context.createOscillator();
    const bassGain = topology.context.createGain();

    bass.type = 'sine';
    bass.frequency.setValueAtTime(150, now);
    bass.frequency.exponentialRampToValueAtTime(50, now + duration * 0.3);

    bassGain.gain.setValueAtTime(0.15, now);
    bassGain.gain.exponentialRampToValueAtTime(0, now + duration * 0.4);

    bass.connect(bassGain);
    bassGain.connect(topology.context.destination);

    bass.start(now);
    bass.stop(now + duration * 0.4);

    console.log('[AudioService] Dice roll played');
  } catch (e) {
    console.warn('[AudioService] Error playing dice roll:', e);
  }
}

/**
 * Play a paper shuffle sound
 * - Rapid white noise burst
 * - Resonant frequencies around 2-4kHz
 */
export function playPaperShuffle(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.3;

    // Create white noise buffer
    const bufferSize = topology.context.sampleRate * duration;
    const noiseBuffer = topology.context.createBuffer(1, bufferSize, topology.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = topology.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter noise to paper-like frequencies (2-4kHz)
    const filter = topology.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = topology.context.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(topology.context.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);

    console.log('[AudioService] Paper shuffle played');
  } catch (e) {
    console.warn('[AudioService] Error playing paper shuffle:', e);
  }
}

/**
 * Play a stone click sound
 * - Sharp attack with quick decay
 * - Harmonic content around 500-800Hz
 */
export function playStoneClick(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.15;

    // Two-tone click (fundamental + harmonic)
    for (const freq of [600, 1200]) {
      const osc = topology.context.createOscillator();
      const gain = topology.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0, now + duration);

      osc.connect(gain);
      gain.connect(topology.context.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    console.log('[AudioService] Stone click played');
  } catch (e) {
    console.warn('[AudioService] Error playing stone click:', e);
  }
}

/**
 * Play metal clink sound
 * - Bright, resonant tone
 * - Frequency sweep to simulate vibration decay
 */
export function playMetalClink(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.2;

    const osc = topology.context.createOscillator();
    const gain = topology.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.linearRampToValueAtTime(900, now + duration);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(topology.context.destination);

    osc.start(now);
    osc.stop(now + duration);

    console.log('[AudioService] Metal clink played');
  } catch (e) {
    console.warn('[AudioService] Error playing metal clink:', e);
  }
}

/**
 * Play ambient crystalline resonance
 * - Sustained tone with slow decay
 * - Suggests magical energy
 */
export function playCrystalResonance(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.8;

    // Main tone
    const osc1 = topology.context.createOscillator();
    const osc2 = topology.context.createOscillator();
    const gain = topology.context.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(432, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(540, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(topology.context.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);

    console.log('[AudioService] Crystal resonance played');
  } catch (e) {
    console.warn('[AudioService] Error playing crystal resonance:', e);
  }
}

/**
 * Play stone thud sound
 * - Low-frequency impact with percussive attack
 * - Reinforces the "weight" of placing objects on the table
 */
export function playStoneThud(topology: AudioNodeTopology) {
  try {
    const now = topology.context.currentTime;
    const duration = 0.25;

    // Deep bass impact
    const bass = topology.context.createOscillator();
    const bassGain = topology.context.createGain();

    bass.type = 'sine';
    bass.frequency.setValueAtTime(120, now);
    bass.frequency.exponentialRampToValueAtTime(60, now + duration * 0.6);

    bassGain.gain.setValueAtTime(0.12, now);
    bassGain.gain.exponentialRampToValueAtTime(0, now + duration);

    bass.connect(bassGain);
    bassGain.connect(topology.context.destination);

    bass.start(now);
    bass.stop(now + duration);

    // Midrange harmonic
    const mid = topology.context.createOscillator();
    const midGain = topology.context.createGain();

    mid.type = 'sine';
    mid.frequency.setValueAtTime(250, now);
    mid.frequency.exponentialRampToValueAtTime(150, now + duration * 0.5);

    midGain.gain.setValueAtTime(0.06, now);
    midGain.gain.exponentialRampToValueAtTime(0, now + duration);

    mid.connect(midGain);
    midGain.connect(topology.context.destination);

    mid.start(now);
    mid.stop(now + duration);

    console.log('[AudioService] Stone thud played');
  } catch (e) {
    console.warn('[AudioService] Error playing stone thud:', e);
  }
}

/**
 * Phase 37: Play turn resolution stinger
 * Event-driven audio to mark the end of a player action turn
 * Tone and duration vary based on action outcome
 * 
 * - Success (margin > 0): Ascending minor arpeggio (300Hz → 400Hz → 500Hz)
 * - Failure (margin < 0): Descending major arpeggio (600Hz → 400Hz → 200Hz)
 * - Critical (margin > 10): Bright 5-note flourish
 */
export function playTurnStinger(topology: AudioNodeTopology, outcome: 'success' | 'failure' | 'critical' | 'neutral' = 'neutral', margin: number = 0) {
  try {
    const now = topology.context.currentTime;
    const baseDuration = 0.15;
    
    let frequencies: number[] = [];
    let durations: number[] = [];
    
    switch (outcome) {
      case 'critical':
        // Bright 5-note flourish: 400, 500, 600, 700, 800
        frequencies = [400, 500, 600, 700, 800];
        durations = Array(5).fill(0.12);
        break;
      case 'success':
        // Ascending minor arpeggio
        frequencies = [300, 350, 400, 450];
        durations = Array(4).fill(baseDuration);
        break;
      case 'failure':
        // Descending major arpeggio
        frequencies = [600, 500, 400, 300];
        durations = Array(4).fill(baseDuration);
        break;
      default:
        // Neutral: single note
        frequencies = [440];
        durations = [0.2];
        break;
    }
    
    let currentTime = now;
    for (let i = 0; i < frequencies.length; i++) {
      const osc = topology.context.createOscillator();
      const gain = topology.context.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencies[i], currentTime);
      
      gain.gain.setValueAtTime(0.1, currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, currentTime + durations[i]);
      
      osc.connect(gain);
      gain.connect(topology.context.destination);
      
      osc.start(currentTime);
      osc.stop(currentTime + durations[i]);
      
      currentTime += durations[i] * 0.8; // Slight overlap
    }
    
    console.log(`[AudioService] Turn stinger played (${outcome})`);
  } catch (e) {
    console.warn('[AudioService] Error playing turn stinger:', e);
  }
}

/**
 * Phase 37: Play atmospheric shift sound
 * Event-driven audio to mark changes in scene state
 * Examples: time-of-day transition, location change, weather shift, paradox surge
 * 
 * @param shiftType Type of atmospheric change
 */
export function playAtmosphericShift(topology: AudioNodeTopology, shiftType: 'dawn' | 'dusk' | 'location' | 'weather' | 'paradox' = 'location') {
  try {
    const now = topology.context.currentTime;
    
    switch (shiftType) {
      case 'dawn':
        // Gentle rising tone: 200Hz → 440Hz
        const dawnOsc = topology.context.createOscillator();
        const dawnGain = topology.context.createGain();
        dawnOsc.type = 'sine';
        dawnOsc.frequency.setValueAtTime(200, now);
        dawnOsc.frequency.exponentialRampToValueAtTime(440, now + 0.5);
        dawnGain.gain.setValueAtTime(0.06, now);
        dawnGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        dawnOsc.connect(dawnGain);
        dawnGain.connect(topology.context.destination);
        dawnOsc.start(now);
        dawnOsc.stop(now + 0.5);
        console.log('[AudioService] Dawn transition played');
        break;
        
      case 'dusk':
        // Gentle falling tone: 440Hz → 200Hz
        const duskOsc = topology.context.createOscillator();
        const duskGain = topology.context.createGain();
        duskOsc.type = 'sine';
        duskOsc.frequency.setValueAtTime(440, now);
        duskOsc.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        duskGain.gain.setValueAtTime(0.06, now);
        duskGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        duskOsc.connect(duskGain);
        duskGain.connect(topology.context.destination);
        duskOsc.start(now);
        duskOsc.stop(now + 0.5);
        console.log('[AudioService] Dusk transition played');
        break;
        
      case 'location':
        // Location change: two-tone chime
        for (let i = 0; i < 2; i++) {
          const osc = topology.context.createOscillator();
          const gain = topology.context.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300 + i * 200, now + i * 0.1);
          gain.gain.setValueAtTime(0.08, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(topology.context.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        }
        console.log('[AudioService] Location shift played');
        break;
        
      case 'weather':
        // Weather change: swirling effect with frequency modulation
        const weatherOsc = topology.context.createOscillator();
        const weatherGain = topology.context.createGain();
        const lfo = topology.context.createOscillator();
        const lfoGain = topology.context.createGain();
        
        weatherOsc.type = 'sine';
        weatherOsc.frequency.setValueAtTime(350, now);
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(4, now); // 4Hz LFO
        lfoGain.gain.setValueAtTime(50, now); // ±50Hz modulation
        
        lfo.connect(lfoGain);
        lfoGain.connect(weatherOsc.frequency);
        
        weatherGain.gain.setValueAtTime(0.06, now);
        weatherGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        weatherOsc.connect(weatherGain);
        weatherGain.connect(topology.context.destination);
        
        weatherOsc.start(now);
        lfo.start(now);
        weatherOsc.stop(now + 0.4);
        lfo.stop(now + 0.4);
        console.log('[AudioService] Weather shift played');
        break;
        
      case 'paradox':
        // Paradox surge: dissonant, unsettling tone (tritone)
        for (let i = 0; i < 2; i++) {
          const osc = topology.context.createOscillator();
          const gain = topology.context.createGain();
          osc.type = 'sine';
          // Tritone interval (augmented 4th): 440Hz and 659Hz
          osc.frequency.setValueAtTime(i === 0 ? 440 : 659, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.connect(gain);
          gain.connect(topology.context.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        }
        console.log('[AudioService] Paradox surge played');
        break;
    }
  } catch (e) {
    console.warn('[AudioService] Error playing atmospheric shift:', e);
  }
}

/**
 * Singleton Audio Service Wrapper
 * Provides convenient methods without requiring topology parameter
 */
class AudioServiceWrapper {
  private topology: AudioNodeTopology | null = null;
  private initialized = false;

  initialize(manifest: AudioManifest = DEFAULT_AUDIO_MANIFEST): void {
    if (!this.initialized) {
      this.topology = initializeAudioContext(manifest);
      this.initialized = true;
      console.log('[AudioServiceWrapper] Initialized');
    }
  }

  setTopology(topology: AudioNodeTopology): void {
    this.topology = topology;
    this.initialized = true;
  }

  playDiceRoll(): void {
    if (this.topology) playDiceRoll(this.topology);
  }

  playPaperShuffle(): void {
    if (this.topology) playPaperShuffle(this.topology);
  }

  playStoneClick(): void {
    if (this.topology) playStoneClick(this.topology);
  }

  playMetalClink(): void {
    if (this.topology) playMetalClink(this.topology);
  }

  playCrystalResonance(): void {
    if (this.topology) playCrystalResonance(this.topology);
  }

  playStoneThud(): void {
    if (this.topology) playStoneThud(this.topology);
  }

  /**
   * Phase 37: Trigger turn resolution stinger
   * @param outcome - 'success', 'failure', 'critical', or 'neutral'
   * @param margin - Degree of success/failure (higher = more successful)
   */
  playTurnStinger(outcome: 'success' | 'failure' | 'critical' | 'neutral' = 'neutral', margin: number = 0): void {
    if (this.topology) playTurnStinger(this.topology, outcome, margin);
  }

  /**
   * Phase 37: Trigger atmospheric shift effect
   * @param shiftType - Type of transition (dawn, dusk, location, weather, paradox)
   */
  playAtmosphericShift(shiftType: 'dawn' | 'dusk' | 'location' | 'weather' | 'paradox' = 'location'): void {
    if (this.topology) playAtmosphericShift(this.topology, shiftType);
  }

  /**
   * Phase 37: Handle turn resolution event
   * Automatically selects appropriate audio feedback based on turn outcome
   */
  onTurnResolved(turnResult: { phase: string; tickResolved: number; eventCount: number; completed: boolean; margin?: number; isCritical?: boolean }): void {
    try {
      if (!turnResult.completed) {
        console.log('[AudioService] Turn resolution failed or incomplete, no stinger');
        return;
      }

      // Determine stinger type based on margin
      let outcome: 'success' | 'failure' | 'critical' | 'neutral' = 'neutral';
      const margin = turnResult.margin ?? 0;

      if (turnResult.isCritical || margin > 10) {
        outcome = 'critical';
      } else if (margin > 0) {
        outcome = 'success';
      } else if (margin < 0) {
        outcome = 'failure';
      }

      this.playTurnStinger(outcome, margin);
      console.log(`[AudioService] Turn stinger triggered: ${outcome} (margin: ${margin})`);
    } catch (err) {
      console.warn('[AudioService] Error in onTurnResolved:', err);
    }
  }
}

// Export singleton instance
export const audioService = new AudioServiceWrapper();
