/**
 * M67: Atmospheric & Sensory Feedback Pipeline
 * 
 * Connects worldEngine paradoxLevel, ageRot, and catastrophe metrics to
 * immersive visual and audio effects. Implements "Diegetic Window" rendering:
 * - Visual: CSS filters scale with catastrophe proximity
 * - Audio: Reverb/frequency modulation based on resonanceDepth
 * - Unified: Both scale from same worldEngine state source
 * 
 * Ensures players FEEL the world falling apart through sensory intensification.
 */

import { randomUUID } from 'node:crypto';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Sensory State Model
// ============================================================================

/**
 * Visual filter state (CSS-based effects)
 */
export interface VisualFilterStack {
  readonly filterId: string;
  readonly desaturation: number;      // 0-100%: grayscale intensity
  readonly blur: number;               // 0-20px
  readonly glitch: number;             // 0-100%: pixel displacement
  readonly flicker: number;            // 0-100%: screen flicker
  readonly vignette: number;           // 0-100%: edge darkening
  readonly hueShift: number;           // 0-360°
  readonly isActive: boolean;
}

/**
 * Audio modulation state
 */
export interface AudioModulation {
  readonly modulationId: string;
  readonly reverbAmount: number;       // 0-1.0
  readonly reverbDecay: number;        // Seconds
  readonly lowFreqBoost: number;       // dB (-12 to +12)
  readonly highFreqCut: number;        // 0-1.0 (inverse)
  readonly resonanceDepth: number;     // 0-1.0
  readonly isActive: boolean;
}

/**
 * Atmospheric feedback state
 */
export interface AtmosphericState {
  readonly atmosphereId: string;
  readonly paradoxLevel: number;       // 0-500 (from M66 catastrophe engine)
  readonly ageRot: number;             // 0-1.0 (from world engine)
  readonly resonanceDepth: number;     // 0-1.0 (audio/visual coupling)
  readonly visualFilters: VisualFilterStack;
  readonly audioModulation: AudioModulation;
  readonly updatedAt: number;
}

/**
 * Sensory feedback configuration
 */
export interface SensoryFeedbackConfig {
  readonly enableVisual: boolean;
  readonly enableAudio: boolean;
  readonly visualIntensity: number;    // 0-1.0 scaling factor
  readonly audioIntensity: number;     // 0-1.0 scaling factor
  readonly responseLatencyMs: number;   // Milliseconds until effects apply
}

// ============================================================================
// ATMOSPHERIC PIPELINE ENGINE
// ============================================================================

let atmosphericState: AtmosphericState | null = null;
let feedbackConfig: SensoryFeedbackConfig = {
  enableVisual: true,
  enableAudio: true,
  visualIntensity: 1.0,
  audioIntensity: 1.0,
  responseLatencyMs: 50
};

/**
 * Initialize atmospheric feedback pipeline
 * 
 * @param paradoxLevel Initial paradox from M66 catastrophe engine
 * @param ageRot Initial age rot from world engine
 * @returns Initialized atmospheric state
 */
export function initializeAtmosphere(paradoxLevel: number, ageRot: number): AtmosphericState {
  const atmosphereId = `atmo_${uuid()}`;

  const visualFilters = calculateVisualFilters(paradoxLevel, ageRot);
  const audioModulation = calculateAudioModulation(paradoxLevel, ageRot);
  const resonanceDepth = calculateResonanceDepth(paradoxLevel, ageRot);

  atmosphericState = {
    atmosphereId,
    paradoxLevel,
    ageRot,
    resonanceDepth,
    visualFilters,
    audioModulation,
    updatedAt: Date.now()
  };

  return atmosphericState;
}

/**
 * Calculate visual filter stack based on catastrophe metrics
 * 
 * Maps paradoxLevel and ageRot to CSS filter effects:
 * - 0-100 paradox: Subtle desaturation
 * - 100-250 paradox: Increasing glitch
 * - 250-400 paradox: Heavy distortion + blur
 * - 400+ paradox: Full apocalypse rendering
 * 
 * @param paradoxLevel Current paradox (0-500)
 * @param ageRot Current age rot (0-1.0)
 * @returns Configured visual filters
 */
function calculateVisualFilters(paradoxLevel: number, ageRot: number): VisualFilterStack {
  const normalizedParadox = Math.min(paradoxLevel / 500, 1.0);
  const combinedIntensity = normalizedParadox * feedbackConfig.visualIntensity;

  // Layer desaturation based on age rot
  const desaturation = Math.min(ageRot * 50 + normalizedParadox * 50, 100);

  // Glitch increases with paradox
  const glitch = normalizedParadox < 0.2 ? 0 : normalizedParadox * 80;

  // Blur scales with catastrophe proximity
  const blur = normalizedParadox * 20;

  // Flicker intensifies at critical thresholds
  const flicker =
    normalizedParadox < 0.5 ? 0 : normalizedParadox < 0.8 ? (normalizedParadox - 0.5) * 100 : 100;

  // Vignette darkens world as it falls apart
  const vignette = normalizedParadox * 60;

  // Hue shift reddish as catastrophe approaches
  const hueShift = normalizedParadox * 30; // +0 to +30° (reddish)

  return {
    filterId: `filter_${uuid()}`,
    desaturation: Math.min(desaturation, 100),
    blur: Math.min(blur, 20),
    glitch: Math.min(glitch, 100),
    flicker: Math.min(flicker, 100),
    vignette: Math.min(vignette, 100),
    hueShift: Math.min(hueShift, 360),
    isActive: combinedIntensity > 0
  };
}

/**
 * Calculate audio modulation based on catastrophe metrics
 * 
 * @param paradoxLevel Current paradox (0-500)
 * @param ageRot Current age rot (0-1.0)
 * @returns Configured audio modulation
 */
function calculateAudioModulation(paradoxLevel: number, ageRot: number): AudioModulation {
  const normalizedParadox = Math.min(paradoxLevel / 500, 1.0);
  const combinedIntensity = normalizedParadox * feedbackConfig.audioIntensity;

  // Reverb increases with paradox (world feels "hollow")
  const reverbAmount = Math.min(normalizedParadox * 0.9, 1.0);

  // Reverb decay extends as catastrophe approaches
  const reverbDecay = 0.5 + normalizedParadox * 4.5; // 0.5 → 5.0 seconds

  // Low frequency boost creates subsonic dread
  const lowFreqBoost = Math.min(ageRot * 8 - 4 + normalizedParadox * 8, 12);

  // High frequency cut creates "muffled" apocalypse
  const highFreqCut = Math.min(normalizedParadox * 0.8, 1.0);

  // Resonance depth couples visual intensity to audio
  const resonanceDepth = normalizedParadox * 0.8 + ageRot * 0.2;

  return {
    modulationId: `audio_${uuid()}`,
    reverbAmount: Math.min(reverbAmount, 1.0),
    reverbDecay: Math.min(reverbDecay, 5.0),
    lowFreqBoost: Math.min(lowFreqBoost, 12),
    highFreqCut: Math.min(highFreqCut, 1.0),
    resonanceDepth: Math.min(resonanceDepth, 1.0),
    isActive: combinedIntensity > 0
  };
}

/**
 * Calculate visual-audio coupling depth
 * Used for synchronized transitions
 * 
 * @param paradoxLevel Current paradox (0-500)
 * @param ageRot Current age rot (0-1.0)
 * @returns Resonance depth (0-1.0)
 */
function calculateResonanceDepth(paradoxLevel: number, ageRot: number): number {
  const normalizedParadox = Math.min(paradoxLevel / 500, 1.0);
  // Weighted average: paradox is 80% of coupling, age rot is 20%
  return normalizedParadox * 0.8 + ageRot * 0.2;
}

/**
 * Update atmospheric state with new world metrics
 * Called when worldEngine updates paradoxLevel or ageRot
 * 
 * @param paradoxLevel Updated paradox level
 * @param ageRot Updated age rot
 * @returns Updated atmospheric state
 */
export function updateAtmosphericState(paradoxLevel: number, ageRot: number): AtmosphericState {
  if (!atmosphericState) {
    return initializeAtmosphere(paradoxLevel, ageRot);
  }

  const visualFilters = calculateVisualFilters(paradoxLevel, ageRot);
  const audioModulation = calculateAudioModulation(paradoxLevel, ageRot);
  const resonanceDepth = calculateResonanceDepth(paradoxLevel, ageRot);

  atmosphericState = {
    ...atmosphericState,
    paradoxLevel,
    ageRot,
    resonanceDepth,
    visualFilters,
    audioModulation,
    updatedAt: Date.now()
  };

  return atmosphericState;
}

/**
 * Configure sensory feedback intensity
 * 
 * @param config New feedback configuration
 */
export function configureSensoryFeedback(config: Partial<SensoryFeedbackConfig>): void {
  feedbackConfig = {
    ...feedbackConfig,
    ...config
  };
}

/**
 * Get current atmospheric state
 * 
 * @returns Current atmosphere or null if not initialized
 */
export function getAtmosphericState(): AtmosphericState | null {
  return atmosphericState ? { ...atmosphericState } : null;
}

/**
 * Get CSS filter string for visual effects
 * Generates the exact CSS filter value for AtmosphericFilterProvider
 * 
 * @returns CSS filter string
 */
export function generateVisualFilterCSS(): string {
  if (!atmosphericState || !feedbackConfig.enableVisual) return '';

  const f = atmosphericState.visualFilters;

  const filters = [
    `saturate(${100 - f.desaturation}%)`,
    `blur(${f.blur}px)`,
    `hue-rotate(${f.hueShift}deg)`,
    f.glitch > 0 ? `brightness(${100 - f.glitch * 0.1}%)` : null,
    f.flicker > 0 ? `contrast(${100 + f.flicker * 0.1}%)` : null
  ].filter((f) => f !== null);

  return filters.join(' ');
}

/**
 * Get CSS backdrop-filter for vignette effect
 * 
 * @returns CSS value
 */
export function generateVignetteCSS(): string {
  if (!atmosphericState || !feedbackConfig.enableVisual) return '';

  const vignetteOpacity = (atmosphericState.visualFilters.vignette / 100) * 0.6;
  return `radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,${vignetteOpacity}) 100%)`;
}

/**
 * Get audio modulation parameters for audioEngine integration
 * 
 * @returns Audio modulation config
 */
export function getAudioModulationParams(): AudioModulation | null {
  if (!atmosphericState || !feedbackConfig.enableAudio) return null;
  return { ...atmosphericState.audioModulation };
}

/**
 * Check if visual intensity threshold crossed
 * Used for triggering special effects (screen glitch, etc.)
 * 
 * @param threshold Intensity threshold (0-1.0)
 * @returns True if current intensity exceeds threshold
 */
export function checkVisualThreshold(threshold: number): boolean {
  if (!atmosphericState) return false;

  const normalizedParadox = Math.min(atmosphericState.paradoxLevel / 500, 1.0);
  const intensity = normalizedParadox * feedbackConfig.visualIntensity;

  return intensity > threshold;
}

/**
 * Check if audio intensity threshold crossed
 * Used for triggering audio cues (distortion, etc.)
 * 
 * @param threshold Intensity threshold (0-1.0)
 * @returns True if current intensity exceeds threshold
 */
export function checkAudioThreshold(threshold: number): boolean {
  if (!atmosphericState) return false;

  const normalizedParadox = Math.min(atmosphericState.paradoxLevel / 500, 1.0);
  const intensity = normalizedParadox * feedbackConfig.audioIntensity;

  return intensity > threshold;
}

/**
 * Get current feedback configuration
 * 
 * @returns Current sensory feedback config
 */
export function getFeedbackConfig(): SensoryFeedbackConfig {
  return { ...feedbackConfig };
}

/**
 * Reset atmospheric state (for testing)
 */
export function resetAtmosphericState(): void {
  atmosphericState = null;
  feedbackConfig = {
    enableVisual: true,
    enableAudio: true,
    visualIntensity: 1.0,
    audioIntensity: 1.0,
    responseLatencyMs: 50
  };
}

/**
 * Synchronize visual and audio effects
 * Returns coupling metrics for synchronized rendering
 * 
 * @returns Synchronization metrics
 */
export function getSynchronizationMetrics(): {
  visualAudioCoupling: number;
  isInSync: boolean;
  latencyCompensation: number;
} {
  if (!atmosphericState) {
    return {
      visualAudioCoupling: 0,
      isInSync: false,
      latencyCompensation: 0
    };
  }

  const coupling = atmosphericState.resonanceDepth;
  const timeSinceUpdate = Date.now() - atmosphericState.updatedAt;

  return {
    visualAudioCoupling: coupling,
    isInSync: timeSinceUpdate < feedbackConfig.responseLatencyMs,
    latencyCompensation: Math.max(0, timeSinceUpdate - feedbackConfig.responseLatencyMs)
  };
}
