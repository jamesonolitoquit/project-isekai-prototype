/**
 * Atmospheric Pressure Indicator
 * 
 * Beta Phase 5 Task 1: The Diegetic Pressure Sink
 * Visualizes world corruption levels through animated gauge, warning text, and reality distortion
 * 
 * Purpose: Make paradox VISUALLY TANGIBLE to the player as they accumulate debt/anomalies
 */

import React, { useMemo } from 'react';
// Import from the .tsx version which has the full capabilities
import { useAtmosphericFilter } from '../hooks/useAtmosphericFilter';
import type { WorldState } from '../../engine/worldEngine';

export interface AtmosphericPressureIndicatorProps {
  state: WorldState;
  compact?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Get warning text based on paradox level
 * These messages represent the "voice of the corrupted world"
 */
function getCorruptionMessage(paradoxLevel: number, ageRotSeverity: string | number): string {
  const num = typeof ageRotSeverity === 'string' 
    ? (ageRotSeverity === 'severe' ? 90 : ageRotSeverity === 'moderate' ? 60 : ageRotSeverity === 'mild' ? 30 : 0)
    : ageRotSeverity;

  if (paradoxLevel > 90) {
    return '⚔️ REALITY FRACTURES ⚔️';
  } else if (paradoxLevel > 75) {
    return '🌀 THE VOID BECKONS 🌀';
  } else if (paradoxLevel > 60) {
    return '👁️ WATCHED BY ECHOES 👁️';
  } else if (paradoxLevel > 45) {
    return '🔮 TIMELINES CONVERGE 🔮';
  } else if (paradoxLevel > 30) {
    return '⚡ REALITY SHIVERS ⚡';
  } else if (paradoxLevel > 15) {
    return '✨ WHISPERS IN THE STATIC ✨';
  } else if (paradoxLevel > 5) {
    return '💫 SOMETHING STIRS... 💫';
  }
  
  return '🌍 THE WORLD HOLDS STEADY 🌍';
}

/**
 * Calculate radial gradient color based on paradox level
 * Progression: Calm (blue) → Strained (yellow) → Critical (red) → Broken (void violet)
 */
function getGlitchGradient(paradoxLevel: number): string {
  if (paradoxLevel > 85) {
    // Void state - deep void violet with corruption
    return 'conic-gradient(from 0deg, #1a0a2e 0%, #2d1b4e 25%, #1a0a2e 50%, #2d1b4e 75%, #1a0a2e 100%)';
  } else if (paradoxLevel > 70) {
    // Severe - red to violet
    return 'conic-gradient(from 0deg, #c84040 0%, #8b3a8b 50%, #c84040 100%)';
  } else if (paradoxLevel > 50) {
    // Moderate - yellow to orange
    return 'conic-gradient(from 0deg, #fbbf24 0%, #f97316 50%, #fbbf24 100%)';
  } else if (paradoxLevel > 30) {
    // Mild - cyan to yellow
    return 'conic-gradient(from 0deg, #06b6d4 0%, #eab308 50%, #06b6d4 100%)';
  } else if (paradoxLevel > 10) {
    // Alert - cyan
    return 'conic-gradient(from 0deg, #06b6d4 0%, #0891b2 50%, #06b6d4 100%)';
  }
  
  // Normal - blue
  return 'conic-gradient(from 0deg, #3b82f6 0%, #1e40af 50%, #3b82f6 100%)';
}

/**
 * Get intensity percentage for various visual effects
 */
function getIntensity(value: number, min = 0, max = 100): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Main Atmospheric Pressure Indicator Component
 */
export const AtmosphericPressureIndicator: React.FC<AtmosphericPressureIndicatorProps> = ({
  state,
  compact = false,
  position = 'top-right'
}) => {
  const atmosphericFilters = useAtmosphericFilter({
    paradoxLevel: state.paradoxLevel ?? 0,
    ageRotSeverity: state.ageRotSeverity ?? 'mild'
  }) as any;

  const positionStyles = useMemo(() => {
    const positions: Record<string, React.CSSProperties> = {
      'top-left': { top: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-right': { bottom: '20px', right: '20px' }
    };
    return positions[position] || positions['top-right'];
  }, [position]);

  const corruptionMessage = useMemo(
    () => getCorruptionMessage(atmosphericFilters.paradoxLevel, atmosphericFilters.ageRotSeverity),
    [atmosphericFilters.paradoxLevel, atmosphericFilters.ageRotSeverity]
  );

  const glitchGradient = useMemo(
    () => getGlitchGradient(atmosphericFilters.paradoxLevel),
    [atmosphericFilters.paradoxLevel]
  );

  const intensity = getIntensity(atmosphericFilters.paradoxLevel, 0, 100);
  const glitchIntensity = getIntensity(atmosphericFilters.filterIntensity, 0, 1);

  if (compact) {
    // Compact mode: Just show a small glitching indicator
    return (
      <div
        style={{
          position: 'fixed',
          ...positionStyles,
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: glitchGradient,
          border: `3px solid ${intensity > 0.5 ? '#c084fc' : '#3b82f6'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: `0 0 ${10 * intensity}px currentColor`,
          zIndex: 9997,
          boxShadow: `0 0 ${20 * intensity}px rgba(192, 132, 252, ${0.5 * intensity}), inset 0 0 ${10 * intensity}px rgba(0, 0, 0, 0.5)`,
          animation: intensityToAnimation(intensity),
          transition: 'all 0.3s ease-out'
        }}
        title={`Paradox Level: ${atmosphericFilters.paradoxLevel.toFixed(1)}%`}
        aria-label={`Paradox level indicator: ${atmosphericFilters.paradoxLevel.toFixed(0)} percent`}
      >
        {Math.round(atmosphericFilters.paradoxLevel)}%
      </div>
    );
  }

  // Full mode: Detailed pressure gauge with warnings
  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles,
        width: '280px',
        backgroundColor: 'rgba(13, 13, 26, 0.85)',
        border: `2px solid ${intensity > 0.7 ? '#c84040' : intensity > 0.4 ? '#fbbf24' : '#3b82f6'}`,
        borderRadius: '8px',
        padding: '16px',
        zIndex: 9997,
        boxShadow: `0 0 ${20 * intensity}px rgba(192, 132, 252, ${0.3 * intensity}), inset 0 0 10px rgba(192, 132, 252, ${0.1 * intensity})`,
        backdropFilter: 'blur(4px)',
        transition: 'all 0.3s ease-out'
      }}
      role="region"
      aria-label="Atmospheric pressure indicator"
      aria-live="polite"
    >
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#a78bfa',
          letterSpacing: '1px',
          marginBottom: '4px',
          textTransform: 'uppercase'
        }}>
          ⚙️ Atmospheric Pressure
        </div>
        <div style={{
          fontSize: '11px',
          color: '#888',
          fontStyle: 'italic'
        }}>
          Reality Integrity Monitor
        </div>
      </div>

      {/* Main Gauge */}
      <div
        style={{
          width: '100%',
          height: '60px',
          borderRadius: '6px',
          background: glitchGradient,
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid rgba(192, 132, 252, ${0.5 * intensity})`,
          marginBottom: '12px',
          boxShadow: `inset 0 0 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(192, 132, 252, ${0.2 * intensity})`
        }}
      >
        {/* Animated fill indicator */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${atmosphericFilters.paradoxLevel}%`,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0))',
            transition: 'width 0.2s ease-out',
            animation: intensityToAnimation(intensity)
          }}
          aria-hidden="true"
        />

        {/* Percentage Text Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: `0 0 ${10 * intensity}px rgba(0, 0, 0, 0.8), 0 0 ${5 * intensity}px currentColor`,
            zIndex: 10
          }}
        >
          {atmosphericFilters.paradoxLevel.toFixed(0)}%
        </div>
      </div>

      {/* Status Indicators */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
        <div style={{
          flex: 1,
          backgroundColor: 'rgba(79, 39, 131, 0.3)',
          padding: '6px',
          borderRadius: '4px',
          border: `1px solid ${intensity > 0.5 ? '#c084fc' : '#666'}`
        }}>
          <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>Paradox</div>
          <div style={{ color: '#e0e0e0', fontWeight: 'bold' }}>
            {atmosphericFilters.paradoxLevel.toFixed(1)}%
          </div>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: 'rgba(79, 39, 131, 0.3)',
          padding: '6px',
          borderRadius: '4px',
          border: `1px solid ${intensity > 0.3 ? '#c084fc' : '#666'}`
        }}>
          <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>Age Rot</div>
          <div style={{ color: '#e0e0e0', fontWeight: 'bold' }}>
            {atmosphericFilters.ageRotSeverity}
          </div>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: 'rgba(79, 39, 131, 0.3)',
          padding: '6px',
          borderRadius: '4px',
          border: `1px solid ${atmosphericFilters.glitchLevel !== 'none' ? '#c084fc' : '#666'}`
        }}>
          <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>Glitch</div>
          <div style={{ color: '#e0e0e0', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {atmosphericFilters.glitchLevel}
          </div>
        </div>
      </div>

      {/* Warning Message - The "voice" of the corrupted world */}
      <div
        style={{
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          padding: '8px',
          borderRadius: '4px',
          border: `1px dashed ${intensity > 0.4 ? '#c084fc' : '#666'}`,
          fontSize: '10px',
          color: '#a78bfa',
          fontStyle: 'italic',
          textAlign: 'center',
          letterSpacing: '0.5px',
          minHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: `${intensity > 0.3 ? 'reality-pulse' : 'none'} 1.2s ease-in-out infinite`
        }}
        aria-label={`World status: ${corruptionMessage}`}
      >
        {corruptionMessage}
      </div>

      {/* Active Filter Classes */}
      {atmosphericFilters.cssClasses.length > 0 && (
        <div style={{
          marginTop: '12px',
          fontSize: '9px',
          color: '#888',
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '3px',
          maxHeight: '40px',
          overflow: 'auto',
          fontFamily: 'monospace'
        }}>
          {/* Show active visual effects */}
          {atmosphericFilters.cssClasses.map((cls, idx) => (
            <div key={idx} style={{ color: '#fbbf24' }}>
              ✓ {cls}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Map intensity (0-1) to appropriate animation
 */
function intensityToAnimation(intensity: number): string {
  if (intensity > 0.8) {
    return 'glitch-severe 0.25s infinite';
  } else if (intensity > 0.5) {
    return 'glitch-moderate 0.3s infinite';
  } else if (intensity > 0.2) {
    return 'glitch-mild 0.4s infinite';
  }
  return 'none';
}

export default AtmosphericPressureIndicator;
