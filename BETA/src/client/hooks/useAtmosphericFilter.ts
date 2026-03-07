/**
 * BETA Phase 1: Pressure Sink Atmospheric Filter Hook
 * 
 * Maps paradoxLevel (0-100) and ageRotSeverity to real-time CSS filter effects
 * for visual feedback on world degradation and temporal instability.
 * 
 * Usage:
 *   const filters = useAtmosphericFilter();
 *   filters.getParadoxFilter(paradoxLevel) // Returns CSS filter string
 *   filters.getAgeRotFilter(severity)      // Returns CSS filter string
 *   filters.getCombinedFilter(...)          // Returns combined effects
 */

import { useMemo, createContext, useContext, ReactNode } from 'react';
import type { WorldState } from '../../engine/worldEngine';

export interface AtmosphericFilters {
  paradoxFilter: string;
  ageRotFilter: string;
  combinedFilter: string;
  glitchClass: string;
}

/**
 * Get CSS filter for Seer's Vision (whisper overlay effect)
 * Phase 3: Applies sepia + low-intensity glitch for narrative intervention
 * intensity: 0-100 (controls filter strength)
 */
function getWhisperSeerFilter(intensity: number): string {
  // Normalize intensity to 0-1
  const norm = Math.min(100, Math.max(0, intensity)) / 100;
  
  // Sepia increases with intensity
  const sepiaAmount = 30 + norm * 40; // 30-70%
  
  // Brightness reduces slightly
  const brightnessAmount = 100 - norm * 15; // 85-100%
  
  // Slight desaturation for ethereal effect
  const saturateAmount = 100 - norm * 20; // 80-100%
  
  return `sepia(${sepiaAmount}%) brightness(${brightnessAmount}%) saturate(${saturateAmount}%)`;
}

/**
 * Hook: useAtmosphericFilter
 * 
 * Returns filter strings and classes for real-time atmospheric effects
 * based on world state paradoxLevel and ageRotSeverity.
 * 
 * Phase 3: Also supports getWhisperFilter for narrative intervention effects
 */
export interface AtmosphericFiltersExtended extends AtmosphericFilters {
  paradoxLevel: number;
  ageRotSeverity: 'mild' | 'moderate' | 'severe' | undefined;
  filterIntensity: number; // 0-1 normalized paradox level
  manifestationText?: string; // Diegetic text manifestation for paradox effects
  getWhisperFilter: (intensity: number) => string;
}

/**
 * Calculate paradox-based visual distortion
 * 0-25:   Clear (no effect)
 * 25-50:  Mild desaturation + slight chromatic aberration
 * 50-75:  Moderate grayscale + glitch lines
 * 75-100: Severe reality fracture + heavy distortion
 */

function getParadoxFilter(paradoxLevel: number): string {
  if (paradoxLevel < 25) {
    return 'none';
  }

  const normalized = Math.min(100, Math.max(0, paradoxLevel));
  const grayscaleAmount = ((normalized - 25) / 75) * 100;
  const hueRotateAmount = ((normalized - 25) / 75) * 15;

  // Progressive desaturation + hue shift
  return `grayscale(${grayscaleAmount}%) hue-rotate(${hueRotateAmount}deg) brightness(${100 - grayscaleAmount * 0.1}%)`;
}

/**
 * Calculate age rot decay visual effects
 * mild:     Subtle sepia wash (-5% brightness)
 * moderate: Increased sepia + bloom effect (-10% brightness)
 * severe:   Heavy sepia + color fade + glow (-20% brightness)
 */
function getAgeRotFilter(severity: 'mild' | 'moderate' | 'severe' | undefined): string {
  switch (severity) {
    case 'mild':
      return 'sepia(25%) brightness(95%) contrast(1.05)';
    case 'moderate':
      return 'sepia(50%) brightness(90%) contrast(0.95) saturate(0.8)';
    case 'severe':
      return 'sepia(75%) brightness(85%) contrast(0.85) saturate(0.6)';
    default:
      return 'none';
  }
}

/**
 * Get CSS class for glitch animation based on paradox intensity
 */
function getGlitchClass(paradoxLevel: number): string {
  if (paradoxLevel > 75) return 'glitch-severe';
  if (paradoxLevel > 50) return 'glitch-moderate';
  if (paradoxLevel > 25) return 'glitch-mild';
  return '';
}

/**
 * Combine multiple atmospheric effects into single filter string
 */
function getCombinedFilter(
  paradoxLevel: number | undefined,
  ageRotSeverity: 'mild' | 'moderate' | 'severe' | undefined
): string {
  const paradoxFilter = paradoxLevel ? getParadoxFilter(paradoxLevel) : 'none';
  const ageRotFilter = ageRotSeverity ? getAgeRotFilter(ageRotSeverity) : 'none';

  if (paradoxFilter === 'none' && ageRotFilter === 'none') {
    return 'none';
  }

  // Combine filters: age rot applies base tone, paradox applies distortion
  const filters = [ageRotFilter, paradoxFilter].filter((f) => f !== 'none');
  return filters.join(' ');
}

/**
 * Hook: useAtmosphericFilter
 * 
 * Returns filter strings and classes for real-time atmospheric effects
 * based on world state paradoxLevel and ageRotSeverity.
 */
export function useAtmosphericFilter(
  state?: Partial<Pick<WorldState, 'paradoxLevel' | 'ageRotSeverity'>>
): AtmosphericFiltersExtended {
  return useMemo(() => {
    const paradoxLevel = state?.paradoxLevel ?? 0;
    const ageRotSeverity = state?.ageRotSeverity;
    const filterIntensity = Math.min(1, paradoxLevel / 100);

    // Generate manifestation text based on paradox level
    let manifestationText: string | undefined;
    if (paradoxLevel > 75) {
      manifestationText = 'Reality fractures—the world remembers multiple timelines at once.';
    } else if (paradoxLevel > 50) {
      manifestationText = 'The fabric of existence thins—echoes of alternate realities bleed through.';
    } else if (paradoxLevel > 25) {
      manifestationText = 'Time stutters—moments repeat like a broken record.';
    }

    return {
      paradoxLevel,
      ageRotSeverity,
      filterIntensity,
      manifestationText,
      paradoxFilter: getParadoxFilter(paradoxLevel),
      ageRotFilter: getAgeRotFilter(ageRotSeverity),
      combinedFilter: getCombinedFilter(paradoxLevel, ageRotSeverity),
      glitchClass: getGlitchClass(paradoxLevel),
      getWhisperFilter: getWhisperSeerFilter // Phase 3: Seer's Vision for narrative intervention
    };
  }, [state?.paradoxLevel, state?.ageRotSeverity]);
}

/**
 *Context Provider for atmospheric filters (optional for global application)
 * Note: Stub implementation (full JSX-based context provider disabled to avoid TypeScript issues in .ts file)
 */

export interface AtmosphericFilterProviderProps {
  state: Partial<Pick<WorldState, 'paradoxLevel' | 'ageRotSeverity'>>;
  children: ReactNode;
}

// Stub export to satisfy imports
export function AtmosphericFilterProvider({
  state,
  children
}: AtmosphericFilterProviderProps) {
  return children as any;
}

/**
 * CSS Keyframes for glitch animations (to be added to global styles)
 * 
 * @keyframes glitch-mild {
 *   0%, 100% { transform: translate(0); }
 *   20% { transform: translate(-2px, -2px); }
 *   40% { transform: translate(-1px, 1px); }
 *   60% { transform: translate(1px, -1px); }
 *   80% { transform: translate(2px, 1px); }
 * }
 * 
 * @keyframes glitch-moderate {
 *   0%, 100% { transform: translate(0); }
 *   10% { transform: translate(-3px, -3px); }
 *   20% { transform: translate(-2px, 2px); }
 *   30% { transform: translate(2px, -2px); }
 *   40% { transform: translate(1px, 3px); }
 *   50% { transform: translate(-1px, -1px); }
 *   60% { transform: translate(3px, 1px); }
 *   70% { transform: translate(-2px, 2px); }
 *   80% { transform: translate(2px, -3px); }
 *   90% { transform: translate(-1px, 1px); }
 * }
 * 
 * @keyframes glitch-severe {
 *   0%, 100% { transform: translate(0); clip-path: inset(0); opacity: 1; }
 *   5% { transform: translate(-5px, -5px); clip-path: inset(0 0 65% 0); opacity: 0.8; }
 *   10% { transform: translate(-3px, 3px); clip-path: inset(0 0 25% 0); opacity: 1; }
 *   15% { transform: translate(3px, -3px); clip-path: inset(0 0 58% 0); opacity: 0.9; }
 *   20% { transform: translate(2px, 2px); clip-path: inset(0); opacity: 1; }
 *   ...more frames for severe glitch...
 * }
 */
