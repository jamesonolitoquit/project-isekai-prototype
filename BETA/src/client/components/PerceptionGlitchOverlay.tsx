/**
 * M47-B1: Perception Glitch Overlay
 *
 * Purpose: Render visual distortions based on paradoxEngine anomalies
 * 
 * Design:
 * - Subscribes to state.paradox.chaosScore
 * - Applies CSS-based chromatic aberration at screen edges when chaos spikes
 * - Digital static 100ms flicker on MINOR_GLITCH or OBFUSCATION_INVERSION events
 * - pointer-events: none so it doesn't block UI interaction
 * 
 * Visual Effects:
 * - STABLE (chaos 0-40): subtle shimmer (1px offset, 0.1s)
 * - UNSTABLE (chaos 40-70): 2-3px RGB splitting, periodic (0.2s frequency)
 * - CRITICAL (chaos 70-90): aggressive glitch with scan lines, 0.1s pulses
 * - REVOLT (chaos 90-100): full screen inversion, heavy static, disorienting
 * 
 * Lifecycle:
 * 1. Component mounts and subscribes to worldState
 * 2. Monitors chaos level changes
 * 3. Triggers glitch intensity animation frames
 * 4. On unmount, cleans up subscription
 */

import React, { useState, useEffect, useRef } from 'react';

interface GlitchState {
  intensity: 'stable' | 'unstable' | 'critical' | 'revolt';
  chaosScore: number;
  itemCorruption: number; // Phase 18: Corruption from equipped items
  relicRebellion: number; // Phase 18: Max rebellion counter from equipped relics
  lastAnomalyType?: string;
}

interface PerceptionGlitchOverlayProps {
  appState?: any;
}

const PerceptionGlitchOverlay: React.FC<PerceptionGlitchOverlayProps> = ({ appState }) => {
  const [glitch, setGlitch] = useState<GlitchState>({
    intensity: 'stable',
    chaosScore: 0,
    itemCorruption: 0,
    relicRebellion: 0,
  });

  const animationFrameRef = useRef<number | null>(null);
  const scanlineOffsetRef = useRef(0);

  /**
   * Calculate glitch intensity based on chaos score
   */
  const getGlitchIntensity = (chaos: number): 'stable' | 'unstable' | 'critical' | 'revolt' => {
    if (chaos >= 90) return 'revolt';
    if (chaos >= 70) return 'critical';
    if (chaos >= 40) return 'unstable';
    return 'stable';
  };

  /**
   * Monitor state changes and update glitch effect
   */
  useEffect(() => {
    if (!appState) return;

    const chaosScore = appState?.paradox?.chaosScore ?? 0;
    
    // Phase 18: Calculate item corruption from inventory
    let totalItemCorruption = 0;
    if (appState?.player?.itemCorruption) {
      totalItemCorruption = (Object.values(appState.player.itemCorruption) as any[]).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
    }

    // Phase 18: Find maximum rebellion counter from equipped relics
    let maxRelicRebellion = 0;
    if (appState?.relics && appState?.player?.equippedRelics) {
      for (const relicId of appState.player.equippedRelics) {
        const relic = appState.relics[relicId];
        if (relic && relic.rebellionCounter && relic.rebellionCounter > maxRelicRebellion) {
          maxRelicRebellion = relic.rebellionCounter;
        }
      }
    }

    // Phase 18: Enhanced chaos calculation including item corruption and relic rebellion
    const enhancedChaos = chaosScore + (totalItemCorruption * 0.15) + (maxRelicRebellion * 0.2);
    const intensity = getGlitchIntensity(enhancedChaos);

    setGlitch({
      intensity,
      chaosScore: enhancedChaos,
      itemCorruption: totalItemCorruption,
      relicRebellion: maxRelicRebellion,
      lastAnomalyType: appState?.paradox?.lastAnomalyType,
    });
  }, [appState?.paradox?.chaosScore, appState?.player?.itemCorruption, appState?.player?.equippedRelics, appState?.relics, appState?.paradox?.lastAnomalyType]);

  /**
   * Animate scanlines for critical/revolt states
   */
  useEffect(() => {
    if (glitch.intensity === 'stable' || glitch.intensity === 'unstable') {
      return;
    }

    const animate = () => {
      scanlineOffsetRef.current = (scanlineOffsetRef.current + 1) % 128;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [glitch.intensity]);

  /**
   * CSS for different glitch intensities
   */
  const getGlitchStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 9998,
      mixBlendMode: 'screen',
    };

    switch (glitch.intensity) {
      case 'stable':
        return {
          ...baseStyle,
          opacity: 0,
          transition: 'opacity 0.5s ease-out',
        };

      case 'unstable':
        return {
          ...baseStyle,
          opacity: 0.05,
          filter: 'hue-rotate(2deg)',
          animation: 'glitchShimmer 0.3s infinite',
          backdropFilter: 'brightness(0.98)',
        };

      case 'critical':
        return {
          ...baseStyle,
          opacity: 0.15,
          filter: 'hue-rotate(5deg) brightness(0.95)',
          animation: 'glitchPulse 0.15s infinite',
          backdropFilter: 'saturate(0.8)',
        };

      case 'revolt':
        return {
          ...baseStyle,
          opacity: 0.3,
          filter: 'invert(0.15) hue-rotate(10deg) brightness(0.85)',
          animation: 'glitchRevolt 0.1s infinite',
          backdropFilter: 'contrast(1.2)',
        };

      default:
        return baseStyle;
    }
  };

  /**
   * Render chromatic aberration effect for higher chaos
   */
  const renderChromaticAberration = () => {
    if (glitch.intensity === 'stable' || glitch.intensity === 'unstable') {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            linear-gradient(
              90deg,
              rgba(255, 0, 150, 0.1) 0%,
              transparent 30%,
              transparent 70%,
              rgba(0, 150, 255, 0.1) 100%
            )
          `,
          pointerEvents: 'none',
          opacity: glitch.intensity === 'revolt' ? 0.2 : 0.1,
        }}
      />
    );
  };

  /**
   * Render scanlines for critical/revolt states
   */
  const renderScanlines = () => {
    if (glitch.intensity === 'stable' || glitch.intensity === 'unstable') {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.03),
              rgba(0, 0, 0, 0.03) 1px,
              transparent 1px,
              transparent 2px
            )
          `,
          pointerEvents: 'none',
          animation: glitch.intensity === 'revolt' 
            ? 'scanlineScroll 0.2s linear infinite' 
            : 'scanlineScroll 0.4s linear infinite',
          opacity: glitch.intensity === 'revolt' ? 0.15 : 0.08,
        }}
      />
    );
  };

  /**
   * Render static noise for revolt state
   */
  const renderStaticNoise = () => {
    if (glitch.intensity !== 'revolt') {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="9" numOctaves="4" /></filter><rect width="200" height="200" fill="rgba(255,255,255,0.2)" filter="url(%23noise)" /></svg>')
          `,
          pointerEvents: 'none',
          opacity: 0.08,
          animation: 'staticFlicker 0.05s infinite',
        }}
      />
    );
  };

  /**
   * Render digital glitch text artifacts for critical/revolt
   */
  const renderGlitchArtifacts = () => {
    if (glitch.intensity !== 'critical' && glitch.intensity !== 'revolt') {
      return null;
    }

    const artifacts = [];
    const artifactCount = glitch.intensity === 'revolt' ? 3 : 1;

    for (let i = 0; i < artifactCount; i++) {
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      const duration = Math.random() * 200 + 100;

      artifacts.push(
        <div
          key={`glitch-${i}`}
          style={{
            position: 'absolute',
            top: `${top}%`,
            left: `${left}%`,
            width: `${20 + Math.random() * 30}%`,
            height: '2px',
            background: `linear-gradient(90deg, rgba(255,0,150,0.5), transparent)`,
            pointerEvents: 'none',
            animation: `glitchLine ${duration}ms ease-in-out infinite`,
            opacity: glitch.intensity === 'revolt' ? 0.4 : 0.2,
          }}
        />
      );
    }

    return artifacts;
  };

  /**
   * Render info text indicator for high chaos
   */
  const renderChaosIndicator = () => {
    if (glitch.intensity === 'stable' || glitch.chaosScore < 70) {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          fontSize: '10px',
          color: 'rgba(255, 50, 100, 0.6)',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          textShadow: '0 0 10px rgba(255, 0, 150, 0.5)',
          animation: glitch.intensity === 'revolt' ? 'textGlitch 0.1s infinite' : 'textGlitch 0.3s infinite',
          opacity: glitch.intensity === 'revolt' ? 0.8 : 0.4,
        }}
      >
        ??? CHAOS {Math.floor(glitch.chaosScore)} ???
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes glitchShimmer {
          0%, 100% { transform: translateX(0px); }
          25% { transform: translateX(1px); }
          50% { transform: translateX(-1px); }
          75% { transform: translateX(0.5px); }
        }

        @keyframes glitchPulse {
          0%, 100% { filter: hue-rotate(5deg) brightness(0.95); opacity: 0.15; }
          50% { filter: hue-rotate(15deg) brightness(0.85); opacity: 0.25; }
        }

        @keyframes glitchRevolt {
          0%, 100% { filter: invert(0.15) hue-rotate(10deg); opacity: 0.3; }
          33% { filter: invert(0.35) hue-rotate(20deg); opacity: 0.4; }
          66% { filter: invert(0.1) hue-rotate(5deg); opacity: 0.25; }
        }

        @keyframes scanlineScroll {
          0% { transform: translateY(-2px); }
          100% { transform: translateY(2px); }
        }

        @keyframes staticFlicker {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.12; }
        }

        @keyframes glitchLine {
          0%, 100% { transform: translateX(-10px) scaleX(0); opacity: 0; }
          25% { transform: translateX(0px) scaleX(1); opacity: 0.8; }
          75% { transform: translateX(10px) scaleX(1); opacity: 0.3; }
        }

        @keyframes textGlitch {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 0, 150, 0.5); }
          50% { text-shadow: 2px 2px 20px rgba(255, 0, 150, 0.8), -2px -2px 20px rgba(0, 150, 255, 0.5); }
        }
      `}</style>

      <div style={getGlitchStyles()}>
        {renderChromaticAberration()}
        {renderScanlines()}
        {renderStaticNoise()}
        {renderGlitchArtifacts()}
        {renderChaosIndicator()}
      </div>
    </>
  );
};

export default PerceptionGlitchOverlay;
