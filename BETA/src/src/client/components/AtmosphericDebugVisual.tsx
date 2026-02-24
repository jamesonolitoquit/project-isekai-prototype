/**
 * Atmospheric Debug Visual - M57-T5 (Enhanced Phase 25 Task 1)
 * 
 * Makes paradox debt (reality corruption) and environmental decay visually visible
 * through progressive CSS filters and sensory feedback.
 * 
 * World visually distorts as player accumulates paradox/anomalies + ageRotSeverity increases.
 * 
 * Paradox tiers (0-300):
 * - 0-50: Clear baseline
 * - 50-100: Subtle blur (2-4px)
 * - 100-150: Color shift (sepia tone)
 * - 150-200: Wavy distortion (5px displacement)
 * - 200+: Severe glitch (strobe, inversion, 10px)
 * 
 * Phase 25 Task 1: Enhanced with:
 * - ageRotSeverity multi-layer filtering (mild/moderate/severe)
 * - Dynamic color palette shifts based on combined stress
 * - Sensory pulse effects at high paradox
 * - Background gradient animations reflecting world decay
 */

import React, { useContext, useMemo } from 'react';

/**
 * Atmospheric context for paradox level, age rot, social tension, and filters
 * Phase 25: Extended with socialTension for hostile visual feedback
 */
interface AtmosphericContextType {
  paradoxLevel: number;
  paradoxMax: number;
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';
  socialTension?: number;  // 0.0 (harmony) to 1.0 (chaos) - drives hostile red hue
  intensityMultiplier: number;
}

const AtmosphericContext = React.createContext<AtmosphericContextType>({
  paradoxLevel: 0,
  paradoxMax: 300,
  ageRotSeverity: 'mild',
  socialTension: 0,
  intensityMultiplier: 1.0
});

/**
 * Hook to access atmospheric state
 */
export function useAtmosphericFilter(): AtmosphericContextType {
  return useContext(AtmosphericContext);
}

/**
 * Provider component - wrap around main game UI
 * Phase 25 Task 2: Now includes socialTension parameter
 */
export function AtmosphericFilterProvider({
  paradoxLevel,
  ageRotSeverity = 'mild',
  socialTension = 0,
  paradoxMax = 300,
  intensityMultiplier = 1.0,
  children
}: {
  paradoxLevel: number;
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';
  socialTension?: number;
  paradoxMax?: number;
  intensityMultiplier?: number;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({
    paradoxLevel,
    ageRotSeverity,
    socialTension,
    paradoxMax,
    intensityMultiplier
  }), [paradoxLevel, ageRotSeverity, socialTension, paradoxMax, intensityMultiplier]);

  return (
    <AtmosphericContext.Provider value={value}>
      {children}
    </AtmosphericContext.Provider>
  );
}

/**
 * Phase 25 Task 1+2: Calculate combined stress factor from paradoxLevel, ageRotSeverity, and socialTension
 * 
 * Formula: stressFactor = (paradoxLevel/300) + ageRotWeight + (socialTension * 0.4)
 * - socialTension adds up to 0.4 to the base calculation
 * - This allows high social tension alone to push toward Tier 3 (wavy, hostile)
 * - Combined with paradox/ageRot, can fast-track to Tier 4 (apocalypse)
 */
function calculateStressFactor(
  paradoxLevel: number,
  ageRotSeverity?: 'mild' | 'moderate' | 'severe',
  socialTension?: number
): number {
  const normalizedAgeRot = ageRotSeverity ?? 'mild';
  const normalizedTension = Math.min(Math.max(socialTension ?? 0, 0), 1); // Clamp 0-1
  
  const paradoxFactor = Math.min(paradoxLevel / 300, 1);
  const ageRotFactor = normalizedAgeRot === 'mild' ? 0.2 : normalizedAgeRot === 'moderate' ? 0.5 : 0.8;
  const tensionFactor = normalizedTension * 0.4; // Social tension contributes up to 0.4
  
  return Math.min(paradoxFactor + ageRotFactor + tensionFactor, 1);
}

/**
 * Calculate filter intensity based on paradox level + Age Rot severity + Social Tension (Phase 25)
 * Phase 25 Task 2: High socialTension (>0.7) triggers hostile red hue shift and contrast boost
 */
function getFilterTier(
  paradoxLevel: number,
  ageRotSeverity?: 'mild' | 'moderate' | 'severe',
  socialTension?: number
): {
  tier: number;
  blurAmount: number;
  hueRotation: number;
  saturation: number;
  wavyAmount: number;
  invertAmount: number;
  strobeAmount: number;
  contrast: number;
  brightness: number;
  ageRotModifier: number;
  hostileTensionHue: number;  // Additional hue rotation for social tension (-30 for red shift)
} {
  const normalizedAgeRot: 'mild' | 'moderate' | 'severe' = ageRotSeverity ?? 'mild';
  const normalizedTension = Math.min(Math.max(socialTension ?? 0, 0), 1);
  const stressFactor = calculateStressFactor(paradoxLevel, normalizedAgeRot, normalizedTension);
  const ageRotModifier = normalizedAgeRot === 'mild' ? 1 : normalizedAgeRot === 'moderate' ? 1.3 : 1.6;
  
  // Phase 25 Task 2: Hostile red hue shift when social tension is high (>0.7)
  // Formula: -30 * (tension - 0.3) clamped to -30 max (deep red shift)
  const hostileTensionHue = Math.max(-30, -30 * Math.max(0, normalizedTension - 0.3) / 0.7);

  if (paradoxLevel < 50 && normalizedAgeRot !== 'severe') {
    return { tier: 0, blurAmount: 0, hueRotation: 0, saturation: 1, wavyAmount: 0, invertAmount: 0, strobeAmount: 0, contrast: 1, brightness: 1, ageRotModifier, hostileTensionHue };
  } else if (paradoxLevel < 100 || (normalizedAgeRot === 'moderate' && paradoxLevel < 70)) {
    // Subtle blur + age rot baseline
    const progress = (paradoxLevel - 50) / 50;
    const baseBlur = progress * 4;
    return {
      tier: 1,
      blurAmount: baseBlur + (normalizedAgeRot === 'moderate' ? 1 : 0),
      hueRotation: normalizedAgeRot === 'moderate' ? progress * 10 : 0,
      saturation: 1 - (progress * 0.1) - (ageRotModifier === 1.3 ? 0.05 : 0),
      wavyAmount: 0,
      invertAmount: 0,
      strobeAmount: 0,
      contrast: 1 + (ageRotModifier === 1.3 ? 0.05 : 0),
      brightness: 1,
      ageRotModifier,
      hostileTensionHue
    };
  } else if (paradoxLevel < 150 || (normalizedAgeRot === 'moderate' && paradoxLevel < 120)) {
    // Color shift (sepia/yellow-shift) + Age Rot
    const progress = (paradoxLevel - 100) / 50;
    const baseHue = progress * 20;
    return {
      tier: 2,
      blurAmount: 4 + (ageRotModifier - 1) * 2,
      hueRotation: baseHue + (ageRotModifier - 1) * 15,
      saturation: Math.max(0.6, 0.9 - (progress * 0.3) - (ageRotModifier - 1) * 0.1),
      wavyAmount: 0,
      invertAmount: 0,
      strobeAmount: 0,
      contrast: 1 + (ageRotModifier - 1) * 0.1,
      brightness: 1 - (ageRotModifier - 1) * 0.05,
      ageRotModifier,
      hostileTensionHue
    };
  } else if (paradoxLevel < 200 || normalizedAgeRot === 'severe') {
    // Wavy distortion + Age Rot intensity
    const progress = (paradoxLevel - 150) / 50;
    const ageRotExtra = normalizedAgeRot === 'severe' ? 0.3 : 0;
    return {
      tier: 3,
      blurAmount: Math.min(6 + (progress * 2) + ageRotExtra * 2, 8),
      hueRotation: 20 + (progress * 10) + ageRotExtra * 20,
      saturation: Math.max(0.3, 0.6 - (progress * 0.2) - ageRotExtra * 0.1),
      wavyAmount: progress * 5 + ageRotExtra,
      invertAmount: progress * 0.2 + ageRotExtra * 0.1,
      strobeAmount: 0,
      contrast: 1.1 + ageRotExtra * 0.15,
      brightness: 1 - ageRotExtra * 0.1,
      ageRotModifier,
      hostileTensionHue
    };
  } else {
    // Severe glitch + Age Rot max
    const progress = Math.min((paradoxLevel - 200) / 100, 1);
    // Ensure we handle all severity levels in this final else branch
    const isSevereAgeRot = (normalizedAgeRot as 'mild' | 'moderate' | 'severe') === 'severe';
    const ageRotExtra = isSevereAgeRot ? 0.5 : 0.35;
    return {
      tier: 4,
      blurAmount: Math.min(6 + (progress * 4) + ageRotExtra * 3, 15),
      hueRotation: 30 + (progress * 30) + ageRotExtra * 30,
      saturation: Math.max(0.1, 0.4 - (progress * 0.3) - ageRotExtra * 0.2),
      wavyAmount: 5 + (progress * 5) + ageRotExtra * 2,
      invertAmount: 0.2 + (progress * 0.3) + ageRotExtra * 0.2,
      strobeAmount: progress * 0.5 + ageRotExtra * 0.3,
      contrast: 1.2 + ageRotExtra * 0.3,
      brightness: 1 - ageRotExtra * 0.2,
      ageRotModifier,
      hostileTensionHue
    };
  }
}

/**
 * Phase 25: Dynamic palette based on anomaly level and age rot
 */
function getDynamicPalette(paradoxLevel: number, ageRotSeverity?: 'mild' | 'moderate' | 'severe'): {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
} {
  const normalizedAgeRot: 'mild' | 'moderate' | 'severe' = ageRotSeverity ?? 'mild';
  // Age Rot adds "vintage" or "corrupted" tones
  const hasModerateAgeRot = normalizedAgeRot === 'moderate';
  const hasSevereAgeRot = normalizedAgeRot === 'severe';

  if (paradoxLevel < 50) {
    return {
      primary: hasSevereAgeRot ? '#c084fc' : '#a78bfa',
      secondary: '#6366f1',
      accent: '#4f2783',
      background: hasModerateAgeRot ? 'radial-gradient(circle at 20% 50%, rgba(120, 81, 169, 0.15), transparent)' : 'radial-gradient(circle at 20% 50%, rgba(79, 39, 131, 0.2), transparent)'
    };
  } else if (paradoxLevel < 100) {
    return {
      primary: hasModerateAgeRot ? '#f97316' : '#facc15',
      secondary: hasSevereAgeRot ? '#ea580c' : '#eab308',
      accent: '#ca8a04',
      background: 'radial-gradient(circle at 20% 50%, rgba(217, 119, 6, 0.15), transparent)'
    };
  } else if (paradoxLevel < 150) {
    return {
      primary: hasSevereAgeRot ? '#dc2626' : '#ef4444',
      secondary: '#f87171',
      accent: '#b91c1c',
      background: 'radial-gradient(circle at 20% 50%, rgba(220, 38, 38, 0.15), transparent)'
    };
  } else if (paradoxLevel < 200) {
    return {
      primary: '#8b5cf6',
      secondary: '#a78bfa',
      accent: '#7c3aed',
      background: 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.2), transparent)'
    };
  } else {
    return {
      primary: hasSevereAgeRot ? '#f0abfc' : '#e879f9',
      secondary: '#d946ef',
      accent: '#c026d3',
      background: 'radial-gradient(circle at 20% 50%, rgba(229, 29, 238, 0.25), transparent)'
    };
  }
}

/**
 * Main atmospheric visual component (Phase 25 enhanced)
 */
export default function AtmosphericDebugVisual({
  paradoxLevel = 0,
  ageRotSeverity = 'mild',
  paradoxMax = 300,
  intensityMultiplier = 1.0,
  showLabel = true,
  showIntensityControl = true,
  onIntensityChange = () => {}
}: {
  paradoxLevel?: number;
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';
  paradoxMax?: number;
  intensityMultiplier?: number;
  socialTension?: number;
  showLabel?: boolean;
  showIntensityControl?: boolean;
  onIntensityChange?: (value: number) => void;
}) {
  const normalizedTension = Math.min(Math.max(socialTension ?? 0, 0), 1);
  const filter = getFilterTier(paradoxLevel, ageRotSeverity, normalizedTension);
  const palette = getDynamicPalette(paradoxLevel, ageRotSeverity);
  const adjustedIntensity = intensityMultiplier || 1.0;
  const stressFactor = calculateStressFactor(paradoxLevel, ageRotSeverity, normalizedTension);

  // Phase 25 Task 2: Boost contrast when socialTension is high (hostile environment)
  const tensionContrastBoost = normalizedTension > 0.7 ? (normalizedTension - 0.7) / 0.3 * 0.4 : 0;

  // Build CSS filter string with brightness and contrast
  // Phase 25: Now includes hostile red hue shift when socialTension > 0.7
  const filterString = [
    `blur(${filter.blurAmount * adjustedIntensity}px)`,
    `hue-rotate(${(filter.hueRotation + filter.hostileTensionHue) * adjustedIntensity}deg)`,
    `saturate(${filter.saturation * (1 - (filter.invertAmount * adjustedIntensity * 0.3))})`,
    `brightness(${filter.brightness * adjustedIntensity})`,
    `contrast(${filter.contrast + tensionContrastBoost})`,
    filter.invertAmount > 0 ? `invert(${filter.invertAmount * adjustedIntensity})` : '',
    filter.wavyAmount > 0 ? `contrast(${1 + (filter.wavyAmount * adjustedIntensity * 0.1)})` : ''
  ].filter(Boolean).join(' ');

  // Severity color based on paradox level, Age Rot, and Social Tension (Phase 25 Task 2)
  const getSeverityColor = (): string => {
    const hasAgeRot = ageRotSeverity && ageRotSeverity !== 'mild';
    const hasHostileTension = normalizedTension > 0.7;
    
    // High tension forces red tones
    if (hasHostileTension) {
      if (paradoxLevel < 100) return '#ef4444'; // RED
      if (paradoxLevel < 150) return '#991b1b'; // DARK RED
      return '#7c2d12'; // BURNT RED
    }
    
    // Standard progression
    if (paradoxLevel < 50) return hasAgeRot ? '#a78bfa' : '#4ade80'; // GREEN or PURPLE if aged
    if (paradoxLevel < 100) return hasAgeRot ? '#f97316' : '#facc15'; // YELLOW or ORANGE if aged
    if (paradoxLevel < 150) return hasAgeRot ? '#dc2626' : '#f97316'; // ORANGE or RED if aged
    if (paradoxLevel < 200) return '#ef4444'; // RED
    return '#8b5cf6'; // PURPLE (severe)
  };

  const severityColor = getSeverityColor();
  const paradoxPercent = Math.round((paradoxLevel / paradoxMax) * 100);
  const stressStr = stressFactor > 0.7 ? 'CRITICAL' : stressFactor > 0.4 ? 'HIGH' : 'MODERATE';

  return (
    <>
      {/* Global filter overlay (attached to root if using provider) */}
      <style>{`
        @keyframes glitch-strobe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.95; }
        }

        .atmospheric-filter-root {
          filter: ${filterString};
          ${filter.strobeAmount > 0 ? `animation: glitch-strobe ${200 * (1 - filter.strobeAmount)}ms infinite;` : ''}
        }

        @supports (backdrop-filter: blur(1px)) {
          .atmospheric-filter-overlay {
            backdrop-filter: ${filterString};
          }
        }
      `}</style>

      {/* Paradox indicator display (Phase 25 enhanced) */}
      {showLabel && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 50,
          backgroundColor: `rgba(0, 0, 0, ${0.8 + stressFactor * 0.2})`,
          border: `2px solid ${severityColor}`,
          borderRadius: '8px',
          padding: '12px 16px',
          minWidth: '200px',
          backdropFilter: 'blur(10px)',
          boxShadow: `0 0 ${10 + stressFactor * 10}px ${severityColor}40`
        }}>
          {/* Label */}
          <div style={{
            fontSize: '11px',
            color: '#aaa',
            marginBottom: '6px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            World Resonance
          </div>

          {/* Numerical display */}
          <div style={{
            fontSize: '18px',
            color: severityColor,
            fontWeight: 'bold',
            marginBottom: '4px',
            fontFamily: 'monospace'
          }}>
            {paradoxLevel.toFixed(0)} / {paradoxMax}
          </div>

          {/* Age Rot Severity indicator (Phase 25) */}
          {ageRotSeverity && ageRotSeverity !== 'mild' && (
            <div style={{
              fontSize: '10px',
              color: palette.accent,
              marginBottom: '6px',
              fontStyle: 'italic',
              textTransform: 'capitalize'
            }}>
              ⏳ Decay: {ageRotSeverity}
            </div>
          )}

          {/* Progress bar with gradient */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px',
            border: `1px solid ${severityColor}`
          }}>
            <div style={{
              width: `${paradoxPercent}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary}, ${severityColor})`,
              transition: 'width 0.3s ease',
              boxShadow: `inset 0 0 ${stressFactor * 5}px rgba(255, 255, 255, ${stressFactor * 0.5})`
            }} />
          </div>

          {/* Severity text */}
          <div style={{
            fontSize: '10px',
            color: severityColor,
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            {filter.tier === 0 && '✓ Clear'}
            {filter.tier === 1 && '≈ Subtle Distortion'}
            {filter.tier === 2 && '⊕ Reality Warping'}
            {filter.tier === 3 && '≈ Severe Instability'}
            {filter.tier === 4 && `✕ CRITICAL ${stressStr}`}
          </div>

          {/* Stress indicator */}
          <div style={{
            fontSize: '9px',
            color: palette.accent,
            marginBottom: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 6px',
            borderRadius: '3px',
            borderLeft: `2px solid ${palette.primary}`
          }}>
            Stress: {(stressFactor * 100).toFixed(0)}% ({stressStr})
          </div>

          {/* Intensity slider (optional) */}
          {showIntensityControl && (
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <label style={{ fontSize: '9px', color: '#999' }}>Intensity:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={intensityMultiplier}
                onChange={(e) => onIntensityChange?.(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  accentColor: severityColor
                }}
              />
              <span style={{ fontSize: '9px', color: '#999', minWidth: '20px' }}>
                {Math.round(intensityMultiplier * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Phase 25: Enhanced Atmospheric description with Age Rot context */}
      {(paradoxLevel > 80 || ageRotSeverity === 'severe') && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 40,
          maxWidth: '280px',
          fontSize: '11px',
          color: palette.primary,
          backgroundColor: `rgba(0, 0, 0, ${0.7 + stressFactor * 0.2})`,
          border: `1px solid ${palette.accent}`,
          borderRadius: '6px',
          padding: '12px',
          lineHeight: '1.5',
          fontStyle: 'italic'
        }}>
          {filter.tier === 1 && ageRotSeverity === 'mild' && '🌫️ A subtle haze clouds your vision... the world feels slightly off.'}
          {filter.tier === 1 && ageRotSeverity === 'moderate' && '🌫️ Faint distortions shimmer at the edges of reality. Something ancient stirs...'}
          {filter.tier === 2 && ageRotSeverity === 'mild' && '🌫️ Reality grows hazy and distorted. Sepia tones cloud your vision.'}
          {filter.tier === 2 && ageRotSeverity === 'moderate' && '⚡ The world takes on aged, faded hues. Paradox seeps through time itself.'}
          {filter.tier === 2 && ageRotSeverity === 'severe' && '💥 Crimson ruptures tear through faded reality. The past bleeds into the present.'}
          {filter.tier === 3 && ageRotSeverity === 'mild' && '⚡ The world ripples around you. Reality feels unstable and unreliable.'}
          {filter.tier === 3 && ageRotSeverity === 'moderate' && '⚡ Violent ripples cascade through reality. Temporal decay accelerates!'}
          {filter.tier === 3 && ageRotSeverity === 'severe' && '💥 WARPING: Reality folds upon itself. The boundary between eras SHATTERS!'}
          {filter.tier === 4 && ageRotSeverity === 'mild' && '💥 CRITICAL: Reality is collapsing! Intense glitches consume the world!'}
          {filter.tier === 4 && ageRotSeverity === 'moderate' && '💥 APOCALYPSE: Time itself fractures! The Void hungers for all!'}
          {filter.tier === 4 && ageRotSeverity === 'severe' && '💥 ⚠️ VOID BREACH: All eras collapse into singularity. THE END.'}
        </div>
      )}
    </>
  );
}
