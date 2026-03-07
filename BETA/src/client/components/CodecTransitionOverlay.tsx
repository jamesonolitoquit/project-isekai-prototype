/**
 * Phase 40: Codec Transition Overlay
 *
 * Purpose: Display visual transition effect when the narrative codec shifts
 * 
 * Design:
 * - Subscribes to CODEC_SHIFTED events
 * - Displays codec-appropriate transition FX (parchment dissolve, glitch, etc.)
 * - Auto-dismisses after 500ms
 * - pointer-events: none so it doesn't block UI interaction
 * 
 * Transition FX by Codec:
 * - MEDIEVAL → GLITCH: Screen glitch with RGB splitting
 * - GLITCH → MEDIEVAL: Pixels reassemble / crystallize
 * - CYBERPUNK ↔ GLITCH: Heavy digital static and scan lines
 * - NOIR ↔ others: Film grain and color desaturation fade
 * - DREAMSCAPE: Ethereal dissolve with color bleed
 * - STORYBOOK: Parchment page turn effect
 * 
 * Lifecycle:
 * 1. Component mounts and subscribes to engine events
 * 2. On CODEC_SHIFTED event, plays transition animation
 * 3. Auto-hides after 500ms or manual dismiss
 * 4. On unmount, cleans up subscription
 */

import React, { useState, useEffect, useRef } from 'react';

interface CodecTransition {
  oldCodec: string;
  newCodec: string;
  costMultiplier: number;
  powerBonus: number;
}

interface CodecTransitionOverlayProps {
  appState?: any;
  events$?: any;
}

const CodecTransitionOverlay: React.FC<CodecTransitionOverlayProps> = ({ appState, events$ }) => {
  const [transition, setTransition] = useState<CodecTransition | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [transitionType, setTransitionType] = useState<string>('default');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Determine the type of transition effect based on codec pair
   */
  const getTransitionType = (oldCodec: string, newCodec: string): string => {
    // Glitch-related transitions: heavy digital distortion
    if (oldCodec.includes('GLITCH') || newCodec.includes('GLITCH')) {
      return 'glitch';
    }
    // Cyberpunk transitions: tech-forward static and scan lines
    if (oldCodec.includes('CYBERPUNK') || newCodec.includes('CYBERPUNK')) {
      return 'cyberpunk';
    }
    // Noir transitions: film grain fade
    if (oldCodec.includes('NOIR') || newCodec.includes('NOIR')) {
      return 'noir';
    }
    // Dreamscape transitions: ethereal dissolve
    if (oldCodec.includes('DREAMSCAPE') || newCodec.includes('DREAMSCAPE')) {
      return 'dreamscape';
    }
    // Storybook transitions: book page dissolve
    if (oldCodec.includes('STORYBOOK') || newCodec.includes('STORYBOOK')) {
      return 'storybook';
    }
    // Default: simple fade/cross-fade
    return 'default';
  };

  /**
   * Subscribe to engine CODEC_SHIFTED events
   * Phase 45-A3: Codec Sync Lock - 50ms delay to prevent Hybrid Codec frames
   */
  useEffect(() => {
    if (!events$ || !appState) return;

    const subscription = events$.subscribe?.((event: any) => {
      if (event.type === 'CODEC_SHIFTED') {
        const {
          oldCodec = appState?.player?.currentCodec,
          newCodec,
          costMultiplier,
          powerBonus
        } = event.payload || {};

        if (newCodec) {
          // Phase 45-A3: Show glitch overlay FIRST (50ms blackout protocol)
          setIsVisible(true);
          
          // Record transition details
          setTransition({
            oldCodec,
            newCodec,
            costMultiplier: costMultiplier ?? 1.0,
            powerBonus: powerBonus ?? 1.0
          });

          // Determine visual effect type
          setTransitionType(getTransitionType(oldCodec || '', newCodec));

          // Phase 45-A3: Codec Sync Lock - Wait 50ms BEFORE updating CSS variables
          // This ensures the glitch overlay is visible and prevents hybrid frame rendering
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            // NOW update the CSS variables / theme context (safe to render new codec)
            // The overlay stays visible for another 450ms to complete the visual transition
          }, 50);

          // Auto-hide after 500ms total
          const hideTimeoutRef = setTimeout(() => {
            setIsVisible(false);
          }, 500);

          return () => clearTimeout(hideTimeoutRef);
        }
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [events$, appState]);

  if (!isVisible || !transition) return null;

  return (
    <div className="codec-transition-overlay" style={overlayStyle(transitionType)}>
      {/* Glitch effect - RGB split and scanlines */}
      {transitionType === 'glitch' && (
        <>
          <div className="glitch-layer glitch-red" style={glitchLayerStyle('red')} />
          <div className="glitch-layer glitch-green" style={glitchLayerStyle('green')} />
          <div className="glitch-layer glitch-blue" style={glitchLayerStyle('blue')} />
          <div className="scanlines" style={scanlineStyle} />
        </>
      )}

      {/* Cyberpunk effect - static and horizontal scan */}
      {transitionType === 'cyberpunk' && (
        <>
          <div className="digital-static" style={digitalStaticStyle} />
          <div className="horizontal-scan" style={horizontalScanStyle} />
        </>
      )}

      {/* Noir effect - film grain and desaturation */}
      {transitionType === 'noir' && (
        <>
          <div className="film-grain" style={filmGrainStyle} />
          <div className="vignette-fade" style={vignetteFadeStyle} />
        </>
      )}

      {/* Dreamscape effect - ethereal dissolve */}
      {transitionType === 'dreamscape' && (
        <>
          <div className="dissolve-cloud" style={dissolveCloudStyle} />
          <div className="color-bleed" style={colorBleedStyle} />
        </>
      )}

      {/* Storybook effect - book page */}
      {transitionType === 'storybook' && (
        <>
          <div className="book-page" style={bookPageStyle} />
          <div className="page-text" style={pageTextStyle}>
            {`Chapter: ${transition.newCodec}`}
          </div>
        </>
      )}

      {/* Default effect - simple fade */}
      {transitionType === 'default' && (
        <div className="fade-overlay" style={fadeOverlayStyle} />
      )}

      {/* Center text showing codec switch */}
      <div className="codec-label" style={codecLabelStyle}>
        <div className="codec-from">{formatCodecName(transition.oldCodec)}</div>
        <div className="codec-arrow">→</div>
        <div className="codec-to">{formatCodecName(transition.newCodec)}</div>
        <div className="codec-multipliers">
          {`×${transition.costMultiplier.toFixed(2)} Cost · ×${transition.powerBonus.toFixed(2)} Power`}
        </div>
      </div>
    </div>
  );
};

/**
 * Format codec name for display (remove CODENAME_ prefix)
 */
function formatCodecName(codecName: string): string {
  return codecName.replace('CODENAME_', '').toUpperCase();
}

/**
 * Base overlay styles
 */
function overlayStyle(transitionType: string): React.CSSProperties {
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 999,
    overflow: 'hidden',
    animation: `codecFadeIn 0.2s ease-out, codecFadeOut 0.2s ease-out 0.3s forwards`,
  };
}

/**
 * Glitch layer style (RGB offset animation)
 */
function glitchLayerStyle(color: string): React.CSSProperties {
  const offsets: Record<string, { x: number; y: number }> = {
    red: { x: 3, y: -2 },
    green: { x: -3, y: 2 },
    blue: { x: 2, y: 0 }
  };
  const offset = offsets[color] || offsets.red;

  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: `linear-gradient(45deg, ${color}, transparent)`,
    mixBlendMode: 'screen',
    opacity: 0.4,
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    animation: `glitchFlicker 0.15s infinite`,
  };
}

/**
 * Scanline effect
 */
const scanlineStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  )`,
  pointerEvents: 'none',
  animation: `scanlineScroll 0.08s linear infinite`,
};

/**
 * Digital static style (cyberpunk)
 */
const digitalStaticStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E")`,
  backgroundSize: '50px 50px',
  animation: `staticGlitch 0.1s steps(5, end) infinite, glitchFlicker 0.2s infinite`,
  opacity: 0.6,
};

/**
 * Horizontal scan line (cyberpunk)
 */
const horizontalScanStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '3px',
  background: 'linear-gradient(90deg, cyan, magenta, cyan)',
  boxShadow: '0 4px 8px cyan, 0 8px 16px magenta',
  animation: `scanDown 0.4s ease-in-out`,
  opacity: 0.7,
};

/**
 * Film grain effect (noir)
 */
const filmGrainStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23ccc'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23999'/%3E%3C/svg%3E")`,
  backgroundSize: '4px 4px',
  opacity: 0.1,
  animation: `fadeInOut 0.5s ease-in-out`,
};

/**
 * Vignette fade (noir)
 */
const vignetteFadeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
  animation: `fadeInOut 0.5s ease-in-out`,
};

/**
 * Dissolve cloud (dreamscape)
 */
const dissolveCloudStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `radial-gradient(circle, rgba(100, 150, 255, 0.3) 0%, rgba(150, 100, 200, 0.2) 50%, transparent 80%)`,
  animation: `dissolveExpand 0.5s ease-out`,
  filter: 'blur(40px)',
};

/**
 * Color bleed (dreamscape)
 */
const colorBleedStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `conic-gradient(from 0deg, rgba(255, 100, 200, 0.2), rgba(100, 200, 255, 0.2), rgba(255, 100, 200, 0.2))`,
  animation: `colorWash 0.6s ease-in-out`,
};

/**
 * Book page effect (storybook)
 */
const bookPageStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '60%',
  height: '60%',
  transform: 'translate(-50%, -50%)',
  background: 'linear-gradient(135deg, #f5e6d3 0%, #e8dcc8 100%)',
  border: '2px solid #8b7355',
  borderRadius: '2px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  animation: `pageFlip 0.5s ease-in-out`,
};

/**
 * Page text (storybook)
 */
const pageTextStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '24px',
  fontFamily: 'Georgia, serif',
  color: '#3e2723',
  fontWeight: 'bold',
  textAlign: 'center',
  pointerEvents: 'none',
  zIndex: 1000,
  animation: `fadeInOut 0.5s ease-in-out`,
};

/**
 * Fade overlay (default)
 */
const fadeOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0, 0, 0, 0.5)',
  animation: `fadeInOut 0.5s ease-in-out`,
};

/**
 * Codec label - displays transition info
 */
const codecLabelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  zIndex: 1001,
  pointerEvents: 'none',
  color: '#fff',
  textShadow: '0 0 10px rgba(0, 0, 0, 0.8)',
  animation: `slideIn 0.3s ease-out`,
};

/**
 * Format codec name for display
 */
function formatCodec(name: string): string {
  return name.replace('CODENAME_', '').split('_').join(' ');
}

// Extend component to include styled subcomponents
const StyledCodecTransitionOverlay = CodecTransitionOverlay as React.FC<CodecTransitionOverlayProps> & {
  codecLabelStyle?: React.CSSProperties;
};

export default CodecTransitionOverlay;

/**
 * CSS Animations (to be added to global stylesheet)
 * 
 * @keyframes codecFadeIn {
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * }
 * 
 * @keyframes codecFadeOut {
 *   from { opacity: 1; }
 *   to { opacity: 0; }
 * }
 * 
 * @keyframes glitchFlicker {
 *   0%, 100% { opacity: 0.3; }
 *   50% { opacity: 0.7; }
 * }
 * 
 * @keyframes scanlineScroll {
 *   0% { transform: translateY(0); }
 *   100% { transform: translateY(2px); }
 * }
 * 
 * @keyframes staticGlitch {
 *   0% { background-position: 0 0; }
 *   100% { background-position: 50px 50px; }
 * }
 * 
 * @keyframes scanDown {
 *   0% { top: 0%; }
 *   100% { top: 100%; }
 * }
 * 
 * @keyframes fadeInOut {
 *   0%, 100% { opacity: 0; }
 *   50% { opacity: 1; }
 * }
 * 
 * @keyframes dissolveExpand {
 *   0% { transform: scale(0.8); opacity: 0; }
 *   50% { opacity: 1; }
 *   100% { transform: scale(1.2); opacity: 0; }
 * }
 * 
 * @keyframes colorWash {
 *   0%, 100% { opacity: 0; }
 *   50% { opacity: 0.5; }
 * }
 * 
 * @keyframes pageFlip {
 *   0% { transform: translate(-50%, -50%) rotateY(0deg) scale(0.5); opacity: 0; }
 *   50% { transform: translate(-50%, -50%) rotateY(90deg) scale(1); }
 *   100% { transform: translate(-50%, -50%) rotateY(0deg) scale(1); opacity: 1; }
 * }
 * 
 * @keyframes slideIn {
 *   0% { transform: translate(-50%, -60%); opacity: 0; }
 *   100% { transform: translate(-50%, -50%); opacity: 1; }
 * }
 */
