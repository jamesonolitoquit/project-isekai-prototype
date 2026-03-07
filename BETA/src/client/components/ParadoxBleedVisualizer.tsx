/**
 * Paradox Bleed Visualizer
 * 
 * Beta Phase 5 Task 1: The Diegetic Pressure Sink
 * Adds visual artifacts and color distortion throughout the UI as paradox increases
 * 
 * Effect progression:
 * - 0-25%: Imperceptible 
 * - 25-50%: Subtle tint shift
 * - 50-75%: Noticeable color banding
 * - 75-90%: Aggressive glitch artifacts
 * - 90%+: Reality breakdown (severe glitch + inverted colors + noise)
 */

import React, { useMemo, useEffect, useState } from 'react';
// Import from the .tsx version which has the full capabilities
import { useAtmosphericFilter } from '../hooks/useAtmosphericFilter';
import type { WorldState } from '../../engine/worldEngine';

export interface ParadoxBleedVisualizerProps {
  state: WorldState;
}

/**
 * Generate random noise data for texture-based paradox visualization
 */
function generateNoiseTexture(width: number, height: number, intensity: number): string {
  // Create a visual noise pattern using CSS noise simulation
  // In a production app, this would use WebGL/Canvas for performant noise generation
  const segments = Math.ceil(width / 20);
  const svgParts: string[] = [];
  
  for (let i = 0; i < segments; i++) {
    const x = i * 20;
    const opacity = Math.random() * intensity * 0.3;
    svgParts.push(
      `<rect x="${x}" y="0" width="20" height="${height}" fill="white" opacity="${opacity}" />`
    );
  }
  
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}')`;
}

/**
 * Calculate CSS filter string for paradox intensity
 */
function getParadoxFilter(paradoxLevel: number): string {
  const intensity = Math.max(0, Math.min(1, paradoxLevel / 100));
  
  // Progressive effects
  const hueShift = intensity * 45; // 0 to 45 degrees
  const saturation = Math.max(100 - (intensity * 50), 50); // 100 to 50%
  const contrast = Math.min(100 + (intensity * 40), 140); // 100 to 140%
  const brightness = intensity > 0.7 ? Math.max(0.9 - ((intensity - 0.7) * 0.4), 0.6) : 1;
  
  const filters = [
    `hue-rotate(${hueShift}deg)`,
    `saturate(${saturation}%)`,
    `contrast(${contrast}%)`,
    `brightness(${brightness})`
  ];
  
  return filters.join(' ');
}

/**
 * ParadoxBleedVisualizer Component
 * 
 * Renders as a full-screen overlay with effects that get stronger as paradox increases
 */
export const ParadoxBleedVisualizer: React.FC<ParadoxBleedVisualizerProps> = ({ state }) => {
  const [noiseTexture, setNoiseTexture] = useState<string>('');
  const atmosphericFilters = useAtmosphericFilter({
    paradoxLevel: state.paradoxLevel ?? 0,
    ageRotSeverity: state.ageRotSeverity ?? 'mild'
  }) as any;

  // Generate noise texture on mount and update based on paradox
  useEffect(() => {
    const texture = generateNoiseTexture(400, 300, atmosphericFilters.filterIntensity);
    setNoiseTexture(texture);
  }, [atmosphericFilters.filterIntensity]);

  const paradoxLevel = atmosphericFilters.paradoxLevel;
  const intensity = paradoxLevel / 100;
  
  // Determine which visual layer to show
  const showSubtleBleed = paradoxLevel > 20;
  const showModerateArtifacts = paradoxLevel > 50;
  const showSevereDistortion = paradoxLevel > 75;
  const showVoidBreakdown = paradoxLevel > 90;

  const bleedFilter = getParadoxFilter(paradoxLevel);

  return (
    <>
      {/* Subtle color bleed (25-50% paradox) */}
      {showSubtleBleed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Void violet tint that intensifies
            backgroundColor: `rgba(26, 10, 46, ${Math.min(0.15, intensity * 0.3)})`,
            pointerEvents: 'none',
            zIndex: 9985,
            animation: paradoxLevel > 40 ? 'paradox-tint-shift 2s ease-in-out infinite' : 'none',
            transition: 'background-color 0.5s ease-out'
          }}
          aria-hidden="true"
        />
      )}

      {/* Moderate artifacts (50-75% paradox) */}
      {showModerateArtifacts && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9984,
            background: noiseTexture,
            backgroundSize: '200px 200px',
            opacity: Math.max(0, (paradoxLevel - 50) / 25 * 0.15),
            mixBlendMode: 'screen',
            animation: 'fracture-shimmer 1s ease-in-out infinite'
          }}
          aria-hidden="true"
        />
      )}

      {/* Severe distortion bands (75-90% paradox) */}
      {showSevereDistortion && (
        <>
          {/* Horizontal scan lines */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(192, 132, 252, 0.03) 2px, rgba(192, 132, 252, 0.03) 4px)',
              pointerEvents: 'none',
              zIndex: 9983,
              opacity: (paradoxLevel - 75) / 15 * 0.4,
              animation: 'screen-tear 0.3s ease-in-out infinite'
            }}
            aria-hidden="true"
          />

          {/* Color shift overlay */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 9982,
              mixBlendMode: 'difference',
              opacity: (paradoxLevel - 75) / 15 * 0.2,
              backgroundColor: `rgba(200, 64, 64, ${(paradoxLevel - 75) / 15 * 0.15})`,
              transition: 'opacity 0.3s ease-out'
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Void breakdown (90%+ paradox) */}
      {showVoidBreakdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9981,
            background: 'radial-gradient(circle at 50% 50%, rgba(26, 10, 46, 0.4), rgba(26, 10, 46, 0.1))',
            animation: 'void-pulse 2s ease-in-out infinite',
            boxShadow: 'inset 0 0 100px rgba(26, 10, 46, 0.3)',
            transition: 'all 0.2s ease-out'
          }}
          aria-hidden="true"
        />
      )}

      {/* Chromatic aberration bands (high intensity) */}
      {paradoxLevel > 60 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9980,
            // Red channel shift
            backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255, 0, 0, 0.05) 50%, transparent 100%)',
            opacity: `${(paradoxLevel - 60) / 40 * 0.2}`,
            transition: 'opacity 0.3s ease-out',
            filter: 'blur(1px)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Glitch stabilization indicator (only visible at extreme paradox) */}
      {paradoxLevel > 85 && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            padding: '8px 16px',
            backgroundColor: 'rgba(26, 10, 46, 0.8)',
            border: '2px solid #c84040',
            borderRadius: '4px',
            color: '#c84040',
            fontSize: '11px',
            fontWeight: 'bold',
            textAlign: 'center',
            animation: 'static-flicker 0.5s infinite',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            whiteSpace: 'nowrap'
          }}
          role="status"
          aria-live="polite"
        >
          ⚠️ REALITY CRITICAL ⚠️
        </div>
      )}
    </>
  );
};

export default ParadoxBleedVisualizer;
