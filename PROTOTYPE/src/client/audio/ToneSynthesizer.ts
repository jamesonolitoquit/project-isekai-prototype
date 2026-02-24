/**
 * ToneSynthesizer.ts - Generates synthesized ambient drones using Web Audio API
 * Each location has a unique oscillator signature for immersive soundscape
 */

export interface DroneConfig {
  frequency: number;
  waveType: OscillatorType;
  baseVolume: number;
  harmonics?: Array<{ frequency: number; volume: number }>;
}

// Location-based drone signatures
export const LOCATION_DRONES: Record<string, DroneConfig> = {
  'eldergrove-village': {
    frequency: 110, // A2 - warm forest tone
    waveType: 'sine',
    baseVolume: 0.15,
    harmonics: [
      { frequency: 220, volume: 0.08 }, // octave
      { frequency: 330, volume: 0.05 } // perfect fifth
    ]
  },
  'luminara-grand-market': {
    frequency: 164.81, // E3 - bustling marketplace
    waveType: 'triangle',
    baseVolume: 0.12,
    harmonics: [
      { frequency: 329.63, volume: 0.07 }, // E4
      { frequency: 246.94, volume: 0.05 } // B3
    ]
  },
  'thornwood-depths': {
    frequency: 82.41, // E2 - dark, ominous low tone
    waveType: 'sawtooth',
    baseVolume: 0.18,
    harmonics: [
      { frequency: 164.81, volume: 0.10 },
      { frequency: 247.02, volume: 0.06 }
    ]
  },
  'moonwell-shrine': {
    frequency: 195.99, // G3 - ethereal, mystical
    waveType: 'sine',
    baseVolume: 0.10,
    harmonics: [
      { frequency: 391.99, volume: 0.06 }, // G4
      { frequency: 587.33, volume: 0.04 } // D5
    ]
  },
  'forge-summit': {
    frequency: 146.83, // D3 - resonant anvil-like tone
    waveType: 'square',
    baseVolume: 0.14,
    harmonics: [
      { frequency: 293.66, volume: 0.08 }, // D4
      { frequency: 440, volume: 0.05 } // A4
    ]
  },
  'frozen-lake': {
    frequency: 98.00, // G2 - cold, piercing
    waveType: 'sine',
    baseVolume: 0.16,
    harmonics: [
      { frequency: 196, volume: 0.09 },
      { frequency: 294, volume: 0.06 }
    ]
  }
};

export class ToneSynthesizer {
  private audioContext: AudioContext | null = null;
  private oscillators: Map<string, OscillatorNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private currentLocationDrone: string | null = null;
  private masterGain: GainNode | null = null;

  /**
   * Initialize the Web Audio API context
   */
  async initialize(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') {
      return; // Already initialized
    }

    try {
      // Create or resume audio context
      this.audioContext =
        this.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create master gain node for overall volume control
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.08; // Keep volume subtle
      this.masterGain.connect(this.audioContext.destination);

      console.log('[ToneSynthesizer] Initialized with context state:', this.audioContext.state);
    } catch (error) {
      console.error('[ToneSynthesizer] Failed to initialize:', error);
    }
  }

  /**
   * Play a drone for a specific location with smooth cross-fade
   */
  async playLocationDrone(locationId: string, fadeDuration: number = 2.0): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    const droneConfig = LOCATION_DRONES[locationId];
    if (!droneConfig) {
      console.warn(`[ToneSynthesizer] No drone config for location: ${locationId}`);
      return;
    }

    // If already playing this location, don't restart
    if (this.currentLocationDrone === locationId) {
      return;
    }

    // Fade out current drone
    if (this.currentLocationDrone) {
      await this.fadeOutDrone(this.currentLocationDrone, fadeDuration / 2);
    }

    // Fade in new drone
    await this.fadeInDrone(locationId, droneConfig, fadeDuration / 2);
    this.currentLocationDrone = locationId;
  }

  /**
   * Fade in a new drone with smooth gain ramp
   */
  private async fadeInDrone(
    locationId: string,
    config: DroneConfig,
    fadeDuration: number
  ): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;

    const startTime = this.audioContext.currentTime;
    const endTime = startTime + fadeDuration;

    // Create main oscillator
    const osc = this.audioContext.createOscillator();
    osc.type = config.waveType;
    osc.frequency.value = config.frequency;

    // Create gain node for this drone
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(config.baseVolume, endTime);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);

    // Create and connect harmonics
    const harmonicOscs: OscillatorNode[] = [];
    if (config.harmonics && config.harmonics.length > 0) {
      for (const harmonic of config.harmonics) {
        const harmOsc = this.audioContext.createOscillator();
        harmOsc.type = config.waveType;
        harmOsc.frequency.value = harmonic.frequency;

        const harmGain = this.audioContext.createGain();
        harmGain.gain.setValueAtTime(0, startTime);
        harmGain.gain.linearRampToValueAtTime(harmonic.volume, endTime);

        harmOsc.connect(harmGain);
        harmGain.connect(this.masterGain!);
        harmonicOscs.push(harmOsc);
      }
    }

    // Start oscillators
    osc.start(startTime);
    harmonicOscs.forEach(h => h.start(startTime));

    // Store for later cleanup
    this.oscillators.set(locationId, osc);
    this.gainNodes.set(locationId, gainNode);

    // Store harmonics (simple approach: just play, stop on fade out)
    (osc as any)._harmonics = harmonicOscs;

    console.log(
      `[ToneSynthesizer] Fading in drone for ${locationId} (${config.frequency}Hz) over ${fadeDuration}s`
    );
  }

  /**
   * Fade out a drone with smooth gain ramp
   */
  private async fadeOutDrone(locationId: string, fadeDuration: number): Promise<void> {
    if (!this.audioContext) return;

    const osc = this.oscillators.get(locationId);
    const gainNode = this.gainNodes.get(locationId);

    if (!osc || !gainNode) {
      return;
    }

    const startTime = this.audioContext.currentTime;
    const endTime = startTime + fadeDuration;

    // Ramp gain to zero
    gainNode.gain.setValueAtTime(gainNode.gain.value, startTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);

    // Stop after fade completes
    osc.stop(endTime);

    // Stop harmonics if present
    const harmonics = (osc as any)._harmonics || [];
    harmonics.forEach((h: OscillatorNode) => h.stop(endTime));

    // Clean up
    setTimeout(() => {
      this.oscillators.delete(locationId);
      this.gainNodes.delete(locationId);
    }, fadeDuration * 1000 + 100);

    console.log(`[ToneSynthesizer] Fading out drone for ${locationId} over ${fadeDuration}s`);
  }

  /**
   * Stop all drones and clean up
   */
  async stop(): Promise<void> {
    if (this.currentLocationDrone) {
      await this.fadeOutDrone(this.currentLocationDrone, 1.0);
      this.currentLocationDrone = null;
    }

    // Force stop any remaining oscillators
    this.oscillators.forEach((osc, locationId) => {
      try {
        osc.stop();
        const harmonics = (osc as any)._harmonics || [];
        harmonics.forEach((h: OscillatorNode) => {
          try { h.stop(); } catch (e) {}
        });
      } catch (error) {
        console.warn(`[ToneSynthesizer] Error stopping oscillator for ${locationId}:`, error);
      }
    });

    this.oscillators.clear();
    this.gainNodes.clear();

    console.log('[ToneSynthesizer] Stopped all drones');
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.08; // Cap at ~8% for safety
    }
  }

  /**
   * Get current audio context state
   */
  getState(): string {
    return this.audioContext?.state ?? 'not-initialized';
  }
}

export default ToneSynthesizer;
