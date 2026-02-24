/**
 * M44-D3: useAtmosphericFilter React Hook
 * 
 * Adjusts CSS filters on the screen based on local world state:
 * - High contention (>0.7): Desaturate + grain effect
 * - Shadow Conclave zone: Violet/darkness tint
 * - Silver Flame zone: Amber glow + high exposure
 * - Emerald Syndicate zone: Green filter
 * 
 * Provides diegetic visual feedback of faction control without overlay UI.
 */

import React, { useEffect, useState, useRef } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { getFactionWarfareEngine } from '../../engine/factionWarfareEngine';

export interface AtmosphericFilterState {
  filterCSS: string;
  contentionLevel: number;
  dominantFaction?: string;
  tint: string;
  desaturation: number;
  grain: number;
  blur: number;
  paradoxLevel?: number;
  socialTension?: number;
}

/**
 * M44-D3: Hook to apply atmospheric filters based on world state
 */
export function useAtmosphericFilter(state: WorldState, playerLocationId?: string): AtmosphericFilterState {
  const [filterState, setFilterState] = useState<AtmosphericFilterState>({
    filterCSS: 'none',
    contentionLevel: 0,
    dominantFaction: undefined,
    tint: '#ffffff',
    desaturation: 0,
    grain: 0,
    blur: 0,
  });

  const nextFrameRef = useRef<number>();

  useEffect(() => {
    const updateFilters = () => {
      if (!playerLocationId || !state) {
        setFilterState(prev => ({ ...prev, filterCSS: 'none' }));
        return;
      }

      const factionEngine = getFactionWarfareEngine();
      const warZone = factionEngine.getWarZoneStatus(playerLocationId);
      const contentionLevel = warZone.contentionLevel || 0.3;
      const dominantFaction = warZone.currentDominant;

      // Phase 27 Task 2: Extract paradox metrics from state
      const paradoxLevel = state.paradoxState?.totalParadoxPoints ?? 0;
      const socialTension = state.socialTension ?? 0;

      // Build filter chain
      let filters: string[] = [];
      let tint = '#ffffff';
      let desaturation = 0;
      let grain = 0;

      // M44-D3: High contention effect
      if (contentionLevel > 0.7) {
        desaturation = 30; // 30% desaturation
        grain = 15; // 15% grain
        filters.push('saturate(0.7)');
        filters.push('brightness(0.95)');
        filters.push(`url(#grain_heavy)`); // SVG filter reference

        // Extra saturation boost during heavy conflict
        if (contentionLevel > 0.85) {
          filters.push('brightness(0.85)');
          grain = 25;
        }
      } else if (contentionLevel > 0.5) {
        desaturation = 15;
        grain = 8;
        filters.push('saturate(0.85)');
        filters.push(`url(#grain_light)`);
      }

      // Phase 27 Task 2: Paradox Aberration - Reality fracturing effect
      if (paradoxLevel > 75) {
        // High paradox: Hue shift + saturation increase (reality warping)
        const hueShift = Math.min(90, (paradoxLevel - 75) * 1.5); // Scale from 0-90 deg
        filters.push(`hue-rotate(${hueShift}deg)`);
        filters.push('saturate(2)');
        filters.push('contrast(1.2)');
        desaturation = Math.max(desaturation, 40);
        grain = Math.max(grain, 20);
      }

      // Phase 27 Task 2: High social tension - Red tint + contrast
      if (socialTension > 0.8) {
        filters.push('brightness(0.9)');
        filters.push('contrast(1.3)');
        filters.push('hue-rotate(15deg)'); // Slight red tint
      }

      // M44-D3: Faction color tint
      switch (dominantFaction) {
        case 'silver_flame':
          tint = '#ffaa00'; // Amber glow
          filters.push('hue-rotate(15deg)');
          filters.push('brightness(1.1)'); // Extra exposure
          filters.push('contrast(1.1)');
          break;

        case 'shadow_conclave':
          tint = '#6600cc'; // Violet/darkness
          filters.push('hue-rotate(300deg)');
          filters.push('brightness(0.85)'); // Darker
          filters.push('saturate(1.2)'); // More saturated purples
          break;

        case 'emerald_syndicate':
          tint = '#00aa44'; // Green filter
          filters.push('hue-rotate(120deg)');
          filters.push('brightness(1.05)');
          break;

        default:
          // Neutral: no faction
          tint = '#ffffff';
          break;
      }

      // Build final CSS filter
      const filterCSS = filters.length > 0 ? filters.join(' ') : 'none';

      setFilterState({
        filterCSS,
        contentionLevel,
        dominantFaction,
        tint,
        desaturation,
        grain,
        blur: 0,
        paradoxLevel,
        socialTension,
      });
    };

    // Update on next animation frame for smooth transitions
    nextFrameRef.current = requestAnimationFrame(updateFilters);

    return () => {
      if (nextFrameRef.current) {
        cancelAnimationFrame(nextFrameRef.current);
      }
    };
  }, [state, playerLocationId]);

  return filterState;
}

/**
 * M44-D3: CSS for grain and noise SVG filters
 * Use in <defs> section of main app
 */
export const ATMOSPHERIC_FILTER_DEFS = `
<defs>
  <filter id="grain_light" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" seed="42" />
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feBlend in="SourceGraphic" in2="noise" mode="overlay" result="filter"/>
  </filter>
  
  <filter id="grain_heavy" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="2.5" numOctaves="5" result="noise" seed="42" />
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feBlend in="SourceGraphic" in2="noise" mode="hard-light" result="filter"/>
  </filter>

  <filter id="vignette" x="0%" y="0%" width="100%" height="100%">
    <radialGradient id="vignette_grad">
      <stop offset="0%" style="stop-color:white;stop-opacity:1" />
      <stop offset="100%" style="stop-color:black;stop-opacity:0.4" />
    </radialGradient>
    <feFlood flood-color="black" flood-opacity="0.3"/>
    <feImage href="#vignette_grad" preserveAspectRatio="none"/>
    <feBlend in="SourceGraphic" in2="vignette_grad" mode="multiply"/>
  </filter>
</defs>
`;

/**
 * M44-D3: Apply atmospheric filters to element
 */
export function applyAtmosphericFilters(element: HTMLElement, filterState: AtmosphericFilterState): void {
  if (!element) return;

  element.style.filter = filterState.filterCSS;

  // Store tint color for background effects if needed
  element.setAttribute('data-atmospheric-tint', filterState.tint);
  element.setAttribute('data-contention-level', filterState.contentionLevel.toString());
}

/**
 * M44-D3: Component helper to apply filters automatically
 */
export const AtmosphericFilterProvider = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    state: WorldState;
    playerLocationId?: string;
  }
>(({ children, state, playerLocationId }, ref) => {
  const filterState = useAtmosphericFilter(state, playerLocationId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      applyAtmosphericFilters(containerRef.current, filterState);
    }
  }, [filterState]);

  return (
    <div
      ref={ref || containerRef}
      style={{
        transition: 'filter 0.5s ease-in-out', // Smooth transitions
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
});
