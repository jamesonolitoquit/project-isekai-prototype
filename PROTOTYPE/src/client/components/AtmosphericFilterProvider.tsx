import React, { useMemo, useEffect, useState } from 'react';

/**
 * Phase 31: AtmosphericFilterProvider
 * 
 * Applies dynamic CSS filters to visualize world decay metrics:
 * - visualDistortion: Screen shake + blur
 * - desaturation: Color saturation loss
 * - glitchIntensity: Reality glitch particles
 */

interface AtmosphericState {
  visualDistortion: number;      // 0-100
  desaturation: number;          // 0-100
  glitchIntensity: number;       // 0-100
  lastUpdatedTick: number;
}

interface AtmosphericFilterProviderProps {
  readonly atmosphereState?: AtmosphericState;
  readonly children: React.ReactNode;
}

export default function AtmosphericFilterProvider({ 
  atmosphereState, 
  children 
}: Readonly<AtmosphericFilterProviderProps>) {
  const [glitchActive, setGlitchActive] = useState(false);

  // Trigger glitch animation when intensity is high
  useEffect(() => {
    if (!atmosphereState || atmosphereState.glitchIntensity < 20) {
      setGlitchActive(false);
      return;
    }

    const glitchChance = atmosphereState.glitchIntensity / 100;
    const interval = setInterval(() => {
      if (Math.random() < glitchChance * 0.1) {  // Trigger 10% of the time
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 100);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [atmosphereState?.glitchIntensity]);

  // Calculate CSS filter values
  const filterStyle = useMemo(() => {
    if (!atmosphereState) return {};

    const distortion = atmosphereState.visualDistortion / 100;
    const desaturation = atmosphereState.desaturation / 100;
    const glitch = atmosphereState.glitchIntensity / 100;

    // Build filter chain
    const filters: string[] = [];

    // Blur increases with distortion
    const blurAmount = Math.floor(distortion * 8);
    if (blurAmount > 0) {
      filters.push(`blur(${blurAmount}px)`);
    }

    // Saturation decreases with world decay
    const saturation = Math.max(0, 1 - desaturation);
    filters.push(`saturate(${saturation})`);

    // Hue shift with high paradox (toward red/nightmare)
    if (glitch > 0.5) {
      const hueShift = Math.floor(glitch * 40);  // Up to 40deg red shift
      filters.push(`hue-rotate(${hueShift}deg)`);
    }

    // Brightness reduction with very high distortion
    if (distortion > 0.7) {
      const brightness = Math.max(0.7, 1 - (distortion - 0.7) * 0.8);
      filters.push(`brightness(${brightness})`);
    }

    // Contrast loss with age rot
    if (desaturation > 0.5) {
      const contrast = Math.max(0.6, 1 - desaturation * 0.5);
      filters.push(`contrast(${contrast})`);
    }

    return {
      filter: filters.join(' '),
      transition: 'filter 0.5s ease-out'
    };
  }, [atmosphereState]);

  // Glitch effect via transform
  const glitchStyle = useMemo(() => {
    if (!glitchActive) return {};

    const offsetX = Math.random() * 4 - 2;  // -2px to 2px
    const offsetY = Math.random() * 4 - 2;

    return {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
      filter: 'invert(0.3) saturate(2)'
    };
  }, [glitchActive]);

  // Render intensity indicator for debug
  const showDebugOverlay = atmosphereState && atmosphereState.visualDistortion > 30;

  return (
    <div
      style={{
        ...filterStyle,
        ...glitchStyle,
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    >
      {/* Reality Glitch Particle Effect */}
      {atmosphereState && atmosphereState.glitchIntensity > 20 && (
        <GlitchParticleEffect
          intensity={atmosphereState.glitchIntensity}
        />
      )}

      {/* Main content */}
      {children}

      {/* Debug Overlay - Shows atmospheric metrics */}
      {showDebugOverlay && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#0f0',
            fontSize: '10px',
            fontFamily: 'monospace',
            zIndex: 10000,
            border: '1px solid #0f0',
            pointerEvents: 'none',
            lineHeight: '1.4'
          }}
        >
          <div>Distortion: {atmosphereState.visualDistortion}%</div>
          <div>Desaturation: {atmosphereState.desaturation}%</div>
          <div>Glitch: {atmosphereState.glitchIntensity}%</div>
          <div>Tick: {atmosphereState.lastUpdatedTick}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Glitch Particle Effect - Visual manifestation of paradox
 * Renders random chromatic aberration artifacts across screen
 */
function GlitchParticleEffect({ intensity }: { intensity: number }) {
  const particleCount = Math.ceil(intensity / 10);  // 2-10 particles

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden'
      }}
    >
      {Array.from({ length: particleCount }).map((_, idx) => {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 40 + 20;
        const duration = Math.random() * 500 + 300;
        const delay = Math.random() * 2000;

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: `linear-gradient(45deg, 
                rgba(255, 0, 0, ${intensity / 200}),
                rgba(0, 255, 255, ${intensity / 200})
              )`,
              filter: 'blur(8px)',
              animation: `glitchFlash ${duration}ms infinite`,
              animationDelay: `${delay}ms`,
              mixBlendMode: 'screen'
            }}
          />
        );
      })}

      <style>{`
        @keyframes glitchFlash {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.6;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.5);
          }
        }

        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-2px, -2px); }
          50% { transform: translate(2px, 2px); }
          75% { transform: translate(-2px, 2px); }
        }
      `}</style>
    </div>
  );
}

/**
 * Get current atmosphere filter CSS for external use
 * Useful for applying atmosphere effects to specific UI elements
 */
export function getAtmosphereFilterCSS(atmosphereState?: AtmosphericState): string {
  if (!atmosphereState) return '';

  const distortion = atmosphereState.visualDistortion / 100;
  const desaturation = atmosphereState.desaturation / 100;
  const glitch = atmosphereState.glitchIntensity / 100;

  const filters: string[] = [];
  const blur = Math.floor(distortion * 8);
  if (blur > 0) filters.push(`blur(${blur}px)`);

  const saturation = Math.max(0, 1 - desaturation);
  filters.push(`saturate(${saturation})`);

  if (glitch > 0.5) {
    const hueShift = Math.floor(glitch * 40);
    filters.push(`hue-rotate(${hueShift}deg)`);
  }

  return filters.join(' ');
}
