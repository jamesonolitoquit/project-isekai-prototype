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
