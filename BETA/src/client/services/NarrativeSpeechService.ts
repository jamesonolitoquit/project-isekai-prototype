/**
 * ALPHA_M8 Phase 3: Narrative Speech Service
 * 
 * Manages Web Speech API (text-to-speech) for the AI Director's ethereal voice.
 * 
 * Features:
 * - Singleton wrapper for window.speechSynthesis
 * - Dynamic voice selection (ethereal/whispery voices)
 * - Tension-to-voice mapping (pitch, rate variation)
 * - Automatic ducking integration with audio system
 * - Throttling to prevent overlapping speeches
 * - Voice-ready detection with fallback
 * - Browser compatibility detection
 */

import type { AudioNodeTopology } from './AudioService';
import { setNarrationActive } from './AudioService';

/**
 * Vocal tension profiles: pitch and rate based on narrative tension
 */
export interface TensionVoiceProfile {
  pitch: number;        // 0.5-2.0 (0.8 = deep, 1.0 = normal, 1.3 = high)
  rate: number;        // 0.5-2.0 (0.8 = slow, 1.0 = normal, 1.2 = faster)
  description: string; // For debugging
}

export interface NarrativeSpeechConfig {
  enabled?: boolean;
  debug?: boolean;
  preferredVoiceKeywords?: string[];  // e.g., ['whisper', 'neutral', 'calm']
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Singleton manager for ethereal narrative voice
 */
class NarrativeSpeechServiceImpl {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private isAvailable: boolean = false;
  private isInitialized: boolean = false;
  private isNarrationActive: boolean = false;
  private voicesReady: boolean = false;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private config: Required<NarrativeSpeechConfig>;
  private throttleUntil: number = 0;
  private lastTension: number = 50;

  constructor() {
    // Default config
    this.config = {
      enabled: true,
      debug: false,
      preferredVoiceKeywords: ['whisper', 'ethereal', 'neutral', 'calm'],
      onStart: () => {},
      onEnd: () => {},
      onError: (err: Error) => console.warn('[NarrativeSpeechService]', err.message),
    };

    this.detectAvailability();
  }

  /**
   * Detect if browser supports Web Speech API
   */
  private detectAvailability() {
    if (typeof window === 'undefined') return;

    const synth = (window as any).speechSynthesis || (window as any).webkitSpeechSynthesis;
    const SpeechSynthesisUtterance = (window as any).SpeechSynthesisUtterance || (window as any).webkitSpeechSynthesisUtterance;

    if (synth && SpeechSynthesisUtterance) {
      this.synth = synth;
      this.isAvailable = true;

      // Listen for voice list updates
      if (this.synth) {
        this.synth.onvoiceschanged = () => {
          this.availableVoices = this.synth!.getVoices();
          this.voicesReady = this.availableVoices.length > 0;
          if (this.config.debug) {
            console.log(`[NarrativeSpeechService] Voices ready: ${this.voicesReady} (${this.availableVoices.length} available)`);
          }
        };

        // Trigger initial voice loading
        if (this.synth.getVoices) {
          this.availableVoices = this.synth.getVoices();
          this.voicesReady = this.availableVoices.length > 0;
        }
      }

      this.isInitialized = true;
      if (this.config.debug) {
        console.log('[NarrativeSpeechService] Initialized successfully');
      }
    } else {
      this.isAvailable = false;
      console.warn('[NarrativeSpeechService] Web Speech API not available');
    }
  }

  /**
   * Configure the speech service
   */
  public configure(config: Partial<NarrativeSpeechConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get tension-based vocal profile
   */
  private getTensionVoiceProfile(tension: number): TensionVoiceProfile {
    const tensionClamped = Math.max(0, Math.min(100, tension));

    if (tensionClamped < 40) {
      // Calm: deep, slow whisper
      return {
        pitch: 0.7,
        rate: 0.75,
        description: 'Calm whisper (deep, slow)',
      };
    } else if (tensionClamped < 75) {
      // Standard: normal voice
      const t = (tensionClamped - 40) / 35; // 0-1
      return {
        pitch: 0.9 + t * 0.2,  // 0.9 to 1.1
        rate: 0.85 + t * 0.25, // 0.85 to 1.1
        description: `Standard tension (pitch: ${(0.9 + t * 0.2).toFixed(1)}, rate: ${(0.85 + t * 0.25).toFixed(1)})`,
      };
    } else {
      // Critical: urgent, high-pitched, fast
      const t = (tensionClamped - 75) / 25; // 0-1
      return {
        pitch: 1.1 + t * 0.4,  // 1.1 to 1.5
        rate: 1.1 + t * 0.3,   // 1.1 to 1.4
        description: `Critical tension (pitch: ${(1.1 + t * 0.4).toFixed(1)}, rate: ${(1.1 + t * 0.3).toFixed(1)})`,
      };
    }
  }

  /**
   * Select an appropriate voice for narration
   */
  private selectNarrativeVoice(): SpeechSynthesisVoice | null {
    if (!this.voicesReady || this.availableVoices.length === 0) {
      return null;
    }

    // Try to find a voice matching preferred keywords
    for (const keyword of this.config.preferredVoiceKeywords) {
      const match = this.availableVoices.find((v) =>
        v.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (match) {
        if (this.config.debug) {
          console.log(`[NarrativeSpeechService] Selected voice: "${match.name}" (matched keyword: "${keyword}")`);
        }
        return match;
      }
    }

    // Fallback: return first available female voice, or just first voice
    const femaleVoice = this.availableVoices.find((v) => v.name.toLowerCase().includes('female'));
    const selected = femaleVoice || this.availableVoices[0];

    if (this.config.debug) {
      console.log(`[NarrativeSpeechService] Selected fallback voice: "${selected.name}"`);
    }

    return selected;
  }

  /**
   * Queue a whisper with automatic sound ducking
   * Tension value determines voice characteristics
   */
  /**
   * Speak narrative text with tension-driven voice modulation
   * M8 Phase 3: Coordinates with audio ducking when topology provided
   *
   * @param text - Narrative text to speak
   * @param tension - Tension level (0-100) affects pitch and rate
   * @param duration - Expected speech duration in ms (auto-estimated if omitted)
   * @param topology - Optional audio topology for ducking coordination
   * @returns Promise that resolves when speech completes
   */
  public speak(text: string, tension: number = 50, duration?: number, topology?: AudioNodeTopology): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.enabled || !this.isAvailable || !this.isInitialized) {
        const err = new Error('Speech service not available');
        this.config.onError?.(err);
        reject(err);
        return;
      }

      // Throttle to prevent overlapping speeches
      const now = Date.now();
      if (now < this.throttleUntil) {
        if (this.config.debug) {
          console.log('[NarrativeSpeechService] Speech throttled, canceling previous utterance');
        }
        // Cancel the current utterance if one is playing
        this.synth!.cancel();
      }

      this.lastTension = tension;
      const voiceProfile = this.getTensionVoiceProfile(tension);

      try {
        const SpeechSynthesisUtterance = (window as any).SpeechSynthesisUtterance || (window as any).webkitSpeechSynthesisUtterance;
        this.utterance = new SpeechSynthesisUtterance(text);
        
        if (!this.utterance) {
          throw new Error('Failed to create SpeechSynthesisUtterance');
        }

        // Get voice
        const voice = this.selectNarrativeVoice();
        if (voice) {
          this.utterance.voice = voice;
        }

        // Apply tension-based voice profile
        this.utterance.pitch = voiceProfile.pitch;
        this.utterance.rate = voiceProfile.rate;
        this.utterance.volume = 1.0;
        this.utterance.lang = 'en-US';

        // Set event handlers
        this.utterance.onstart = () => {
          this.isNarrationActive = true;
          
          // M8 Phase 3: Activate ducking if topology provided
          if (topology) {
            setNarrationActive(topology, true);
          }
          
          this.config.onStart?.();
          if (this.config.debug) {
            console.log(`[NarrativeSpeechService] Speaking (${voiceProfile.description})`);
          }
        };

        this.utterance.onend = () => {
          this.isNarrationActive = false;
          
          // M8 Phase 3: Deactivate ducking if topology provided
          if (topology) {
            setNarrationActive(topology, false);
          }
          
          this.config.onEnd?.();
          if (this.config.debug) {
            console.log('[NarrativeSpeechService] Speech ended');
          }
          resolve();
        };

        this.utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          this.isNarrationActive = false;
          
          // M8 Phase 3: Deactivate ducking on error
          if (topology) {
            setNarrationActive(topology, false);
          }
          
          const error = new Error(`Speech synthesis error: ${event.error}`);
          this.config.onError?.(error);
          reject(error);
        };

        // Speak
        this.synth!.speak(this.utterance);

        // Set throttle until speech completes or times out
        // Estimate duration or use provided value (default 3 seconds per typical utterance)
        const estimatedDuration = duration || Math.max(text.length * 50, 1500); // ~50ms per character, minimum 1.5s
        this.throttleUntil = now + estimatedDuration + 200; // Add 200ms buffer

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.config.onError?.(err);
        reject(err);
      }
    });
  }

  /**
   * Check if narration is currently playing
   */
  public isActive(): boolean {
    return this.isNarrationActive;
  }

  /**
   * Cancel current narration
   */
  public cancel() {
    if (this.synth) {
      this.synth.cancel();
      this.isNarrationActive = false;
    }
  }

  /**
   * Check if service is available and ready
   */
  public isReady(): boolean {
    return this.isAvailable && this.isInitialized && this.voicesReady;
  }

  /**
   * Get diagnostic information
   */
  public diagnostics(): Record<string, any> {
    return {
      available: this.isAvailable,
      initialized: this.isInitialized,
      voicesReady: this.voicesReady,
      voiceCount: this.availableVoices.length,
      isActive: this.isNarrationActive,
      lastTension: this.lastTension,
      availableVoices: this.availableVoices.map((v) => ({ name: v.name, lang: v.lang })),
    };
  }
}

/**
 * Singleton instance
 */
const instance = new NarrativeSpeechServiceImpl();

/**
 * Export singleton and factory
 */
export const NarrativeSpeechService = instance;

export function getNarrativeSpeechService(): NarrativeSpeechServiceImpl {
  return instance;
}

/**
 * Export type for testing
 */
export type INarrativeSpeechService = NarrativeSpeechServiceImpl;
