/**
 * Beta Phase 5 Task 1: The Pressure Sink
 * Atmospheric Filter Hook - Connects WorldState paradoxLevel/ageRotSeverity to diegetic visual feedback
 * 
 * Creates a "Diegetic Window" effect where CSS filters and glitch animations
 * intensify as the world's paradox level increases, signaling timeline instability.
 * 
 * Paradox Levels:
 * - 0-25: Normal (no effects)
 * - 25-50: Mild (subtle grayscale, gentle glitch)
 * - 50-75: Moderate (increased saturation shift, moderate glitch)
 * - 75-100: Severe (severe glitch, heavy reality distortion)
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { WorldState } from '../../engine/worldEngine';

export interface AtmosphericFilterState {
  paradoxLevel: number;
  ageRotSeverity: number;
  glitchLevel: 'none' | 'mild' | 'moderate' | 'severe';
  filterIntensity: number; // 0-1
  grayscaleAmount: number; // 0-100 (0 = normal, 100 = full grayscale)
  saturationAmount: number; // 0-200 (100 = normal, 0 = desaturated, 200 = hypersaturated)
  hueRotationAmount: number; // 0-360 degrees
  swirlEffect: boolean;
  scanlineIntensity: number; // 0-1
  cssClasses: string[];
  manifestationText?: string; // Beta Phase 9: Diegetic text manifestation
  activeFilterType?: string; // e.g., 'void-violet', 'bleached'
  soundscapeOverride?: string; // Optional soundscape change
  // For compatibility with existing code
  glitchClass?: string;
  combinedFilter?: string;
  filterStyle: React.CSSProperties;
}

const AtmosphericFilterContext = createContext<AtmosphericFilterState | null>(null);

/**
 * Calculate atmospheric filter state based on paradox level and location sinks
 */
function calculateFilterState(
  paradoxLevel: number = 0, 
  ageRotSeverity: number = 0,
  sinks?: Array<{
    paradoxThreshold: number;
    manifestation: string;
    visualFilter: string;
    soundscapeOverride?: string;
  }>
): AtmosphericFilterState {
  const clampedParadox = Math.max(0, Math.min(100, paradoxLevel));
  const clampedAgeRot = Math.max(0, Math.min(100, ageRotSeverity));
  
  // Determine glitch level based on paradox
  let glitchLevel: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  let filterIntensity = 0;
  let grayscaleAmount = 0;
  let saturationAmount = 100;
  let hueRotationAmount = 0;
  let swirlEffect = false;
  let scanlineIntensity = 0;
  let manifestationText = '';
  let activeFilterType = '';
  let soundscapeOverride = undefined;

  // Beta Phase 9: Find the highest active sink based on current paradox
  if (sinks && sinks.length > 0) {
    const activeSink = [...sinks]
      .sort((a, b) => b.paradoxThreshold - a.paradoxThreshold)
      .find(s => clampedParadox >= s.paradoxThreshold);
    
    if (activeSink) {
      manifestationText = activeSink.manifestation;
      activeFilterType = activeSink.visualFilter;
      soundscapeOverride = activeSink.soundscapeOverride;
    }
  }
  
  if (clampedParadox > 75) {
    glitchLevel = 'severe';
    filterIntensity = (clampedParadox - 75) / 25; // 0-1 range
    grayscaleAmount = Math.min(60, filterIntensity * 60);
    saturationAmount = 100 - (filterIntensity * 50); // Desaturate to ~50
    hueRotationAmount = (filterIntensity * 15); // Up to 15° hue rotation
    swirlEffect = true;
    scanlineIntensity = filterIntensity * 0.8;
  } else if (clampedParadox > 50) {
    glitchLevel = 'moderate';
    filterIntensity = (clampedParadox - 50) / 25; // 0-1 range
    grayscaleAmount = Math.min(30, filterIntensity * 30);
    saturationAmount = 100 - (filterIntensity * 25); // Down to ~75
    hueRotationAmount = (filterIntensity * 8);
    swirlEffect = false;
    scanlineIntensity = filterIntensity * 0.4;
  } else if (clampedParadox > 25) {
    glitchLevel = 'mild';
    filterIntensity = (clampedParadox - 25) / 25; // 0-1 range
    grayscaleAmount = Math.min(15, filterIntensity * 15);
    saturationAmount = 100 - (filterIntensity * 10); // Down to ~90
    hueRotationAmount = 0;
    swirlEffect = false;
    scanlineIntensity = filterIntensity * 0.15;
  } else {
    glitchLevel = 'none';
    filterIntensity = 0;
    grayscaleAmount = 0;
    saturationAmount = 100;
    hueRotationAmount = 0;
    swirlEffect = false;
    scanlineIntensity = 0;
  }
  
  // Age Rot severity enhances the effects
  const ageRotBoost = clampedAgeRot / 100; // 0-1
  grayscaleAmount = Math.min(100, grayscaleAmount + (ageRotBoost * 20));
  saturationAmount = Math.max(50, saturationAmount - (ageRotBoost * 15));
  
  // Build CSS classes
  const cssClasses: string[] = [];
  let glitchClass = '';
  if (glitchLevel !== 'none') {
    cssClasses.push(`glitch-${glitchLevel}`);
    glitchClass = `glitch-${glitchLevel}`;
  }
  if (clampedParadox > 60) {
    cssClasses.push('chromatic-aberration');
  }
  if (clampedParadox > 40) {
    cssClasses.push('reality-pulse');
  }
  
  // Build inline CSS filter
  const filterParts: string[] = [];
  if (grayscaleAmount > 0) {
    filterParts.push(`grayscale(${grayscaleAmount}%)`);
  }
  if (saturationAmount !== 100) {
    filterParts.push(`saturate(${saturationAmount}%)`);
  }
  if (hueRotationAmount > 0) {
    filterParts.push(`hue-rotate(${hueRotationAmount}deg)`);
  }
  if (scanlineIntensity > 0) {
    // Slight brightness flicker for scanline effect
    filterParts.push(`brightness(${1 - (scanlineIntensity * 0.08)})`);
  }

  // Beta Phase 9: Apply active filter type overrides
  if (activeFilterType === 'sepia') {
    filterParts.push('sepia(60%)');
  } else if (activeFilterType === 'bleached') {
    filterParts.push('brightness(1.5) contrast(0.8) saturate(0.2)');
  } else if (activeFilterType === 'void-violet') {
    filterParts.push('hue-rotate(280deg) saturate(1.5) contrast(1.1)');
  } else if (activeFilterType === 'glitched') {
    filterParts.push('opacity(0.9) invert(0.05) contrast(1.2)');
  } else if (activeFilterType === 'static') {
    filterParts.push('contrast(1.4) brightness(1.2)');
  } else if (activeFilterType === 'pulsing-red') {
    filterParts.push('hue-rotate(340deg) saturate(2.0)');
  }
  
  const combinedFilter = filterParts.length > 0 ? filterParts.join(' ') : 'none';
  
  const filterStyle: React.CSSProperties = {
    filter: combinedFilter,
    transition: 'filter 0.3s ease-out'
  };
  
  // Add secondary effects
  if (swirlEffect || activeFilterType === 'glitched') {
    filterStyle.animation = 'reality-pulse 1.2s ease-in-out infinite';
  }
  
  return {
    paradoxLevel: clampedParadox,
    ageRotSeverity: clampedAgeRot,
    glitchLevel,
    filterIntensity,
    grayscaleAmount,
    saturationAmount,
    hueRotationAmount,
    swirlEffect,
    scanlineIntensity,
    cssClasses,
    manifestationText,
    activeFilterType,
    soundscapeOverride,
    glitchClass,
    combinedFilter,
    filterStyle
  };
}

/**
 * Context Provider for atmospheric filter state
 */
export const AtmosphericFilterProvider: React.FC<{
  children: React.ReactNode;
  state?: Partial<WorldState>;
  paradoxLevel?: number;
  ageRotSeverity?: number;
}> = ({ children, state, paradoxLevel: propParadox, ageRotSeverity: propAgeRot }) => {
  const filterState = useMemo(() => {
    const paradox = state?.paradoxLevel ?? propParadox ?? 0;
    const ageRot = state?.metadata?.ageRotSeverity ?? propAgeRot ?? 0;
    
    // Find current location's sinks from world state
    const currentLocationId = state?.player?.locationId;
    const currentLocation = state?.locations?.find(l => l.id === currentLocationId);
    const sinks = currentLocation?.atmosphericSinks;
    
    return calculateFilterState(
      paradox, 
      typeof ageRot === 'number' ? ageRot : (ageRot === 'severe' ? 90 : ageRot === 'moderate' ? 60 : ageRot === 'mild' ? 30 : 0),
      sinks
    );
  }, [state, propParadox, propAgeRot]);
  
  return (
    <AtmosphericFilterContext.Provider value={filterState}>
      {children}
    </AtmosphericFilterContext.Provider>
  );
};

/**
 * Hook to access atmospheric filter state
 * Can be called with parameters for direct calculation,
 * or without parameters to use context
 */
export function useAtmosphericFilter(params?: {
  paradoxLevel?: number;
  ageRotSeverity?: number | string;
  state?: Partial<WorldState>;
}): AtmosphericFilterState {
  // If parameters provided, calculate directly
  if (params !== undefined) {
    const paradox = params?.state?.paradoxLevel ?? params?.paradoxLevel ?? 0;
    const ageRotParam = params?.state?.metadata?.ageRotSeverity ?? params?.ageRotSeverity ?? 0;
    const ageRotNum = typeof ageRotParam === 'number' ? ageRotParam : (ageRotParam === 'severe' ? 90 : ageRotParam === 'moderate' ? 60 : ageRotParam === 'mild' ? 30 : 0);
    
    // Find current location's sinks from world state
    const currentLocationId = params?.state?.player?.locationId;
    const currentLocation = params?.state?.locations?.find(l => l.id === currentLocationId);
    const sinks = currentLocation?.atmosphericSinks;
    
    return useMemo(
      () => calculateFilterState(paradox, ageRotNum, sinks),
      [paradox, ageRotNum, sinks]
    );
  }
  
  // Otherwise try to use context
  const context = useContext(AtmosphericFilterContext);
  if (context) {
    return context;
  }
  
  // Fallback to neutral state
  return calculateFilterState(0, 0);
}

/**
 * Hook to apply atmospheric filters to a React ref or DOM element
 */
export function useApplyAtmosphericFilter(
  elementRef: React.RefObject<HTMLElement | null>,
  params?: { paradoxLevel?: number; ageRotSeverity?: number }
): void {
  const filterState = useAtmosphericFilter(params);
  
  React.useEffect(() => {
    if (!elementRef.current) return;
    
    const element = elementRef.current;
    
    // Apply filter style
    Object.assign(element.style, filterState.filterStyle);
    
    // Apply/remove CSS classes
    element.classList.remove('glitch-mild', 'glitch-moderate', 'glitch-severe', 'chromatic-aberration', 'reality-pulse');
    filterState.cssClasses.forEach(className => {
      element.classList.add(className);
    });
  }, [filterState, elementRef]);
}


