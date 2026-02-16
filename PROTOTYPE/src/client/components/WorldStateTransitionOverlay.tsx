/**
 * M42 Task 5: World State Transition Overlay
 *
 * Purpose: Full-screen "Lore Glitch" effect during world state mutations
 * Triggers:
 * - Epoch shift (theme morphing)
 * - World reset (faction restructuring)
 * - Macro event resolution (reality shifts)
 *
 * Design:
 * - Indigo/Purple glitch effect (#6366f1 → #8b5cf6)
 * - 800ms ±100ms duration (matches stateRebuilder execution)
 * - Masks background re-rendering
 * - Coordinates with WorldState subscription
 *
 * Lifecycle:
 * 1. Mounted on state mutation
 * 2. Glitch animation plays
 * 3. Background rebuilds (hidden)
 * 4. Unmounts (reveal)
 */

import React, { useEffect, useState } from 'react';

export interface WorldStateTransitionOverlayProps {
  /**
   * Type of state transition (affects visual style)
   */
  transitionType: 'epoch_shift' | 'world_reset' | 'macro_event';

  /**
   * Duration in ms. Default: 800ms
   */
  duration?: number;

  /**
   * Called when transition completes (before unmount)
   */
  onComplete?: () => void;

  /**
   * Additional message to display during transition
   */
  message?: string;

  /**
   * Custom color scheme (hex or rgb)
   */
  glitchColor?: string;
}

/**
 * Glitch keyframe definition dynamically injected
 */
const createGlitchStyles = (color: string, duration: number) => {
  const durationS = (duration / 1000).toFixed(2);
  const keyframes = `
    @keyframes lore-glitch-horizontal {
      0% { transform: translateX(0); }
      20% { transform: translateX(-2px); }
      40% { transform: translateX(2px); }
      60% { transform: translateX(-1px); }
      80% { transform: translateX(1px); }
      100% { transform: translateX(0); }
    }

    @keyframes lore-glitch-vertical {
      0% { transform: translateY(0); }
      25% { transform: translateY(-4px); }
      50% { transform: translateY(4px); }
      75% { transform: translateY(-2px); }
      100% { transform: translateY(0); }
    }

    @keyframes lore-glitch-intensity {
      0% { opacity: 0.3; box-shadow: 0 0 40px ${color}; }
      50% { opacity: 0.8; box-shadow: 0 0 80px ${color}; }
      100% { opacity: 0; box-shadow: 0 0 0px ${color}; }
    }

    @keyframes lore-scan-lines {
      0% { background-position: 0 0; }
      100% { background-position: 0 100%; }
    }

    @keyframes lore-chromatic {
      0% { 
        text-shadow: -2px 0 ${color}, 2px 0 #d946ef;
      }
      50% {
        text-shadow: -4px 0 ${color}, 4px 0 #d946ef;
      }
      100% {
        text-shadow: -2px 0 ${color}, 2px 0 #d946ef;
      }
    }
  `;
  
  const css = `
    .world-state-transition-overlay {
      animation: lore-glitch-horizontal ${durationS}s ease-in-out,
                 lore-glitch-intensity ${durationS}s ease-in-out;
    }

    .glitch-content {
      animation: lore-scan-lines ${durationS}s linear;
    }

    .glitch-message {
      animation: lore-chromatic ${durationS}s ease-in-out;
    }
  `;

  return { keyframes, css, duration: durationS };
};

/**
 * World State Transition Overlay Component
 */
export const WorldStateTransitionOverlay: React.FC<WorldStateTransitionOverlayProps> = ({
  transitionType,
  duration = 800,
  onComplete,
  message,
  glitchColor = '#6366f1'
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [styleSheet, setStyleSheet] = useState<CSSStyleSheet | null>(null);

  // Inject dynamic keyframes
  useEffect(() => {
    const { keyframes, css } = createGlitchStyles(glitchColor, duration);
    
    // Create style element
    const style = document.createElement('style');
    style.textContent = keyframes + css;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [duration, glitchColor]);

  // Setup animation completion timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  // Get transition-specific styling
  const getTransitionStyle = () => {
    switch (transitionType) {
      case 'epoch_shift':
        return {
          background: 'radial-gradient(circle at 50% 50%, #6366f1 0%, #2d1b4e 100%)',
          borderColor: '#d4af37'
        };
      case 'world_reset':
        return {
          background: 'radial-gradient(circle at 50% 50%, #8b5cf6 0%, #1a1030 100%)',
          borderColor: '#f59e0b'
        };
      case 'macro_event':
        return {
          background: 'radial-gradient(circle at 50% 50%, #ec4899 0%, #7c2d12 100%)',
          borderColor: '#06b6d4'
        };
      default:
        return {
          background: 'radial-gradient(circle at 50% 50%, #6366f1 0%, #1a1030 100%)',
          borderColor: '#d4af37'
        };
    }
  };

  const transitionStyle = getTransitionStyle();

  return (
    <div
      className="world-state-transition-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        ...transitionStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden'
      }}
      role="status"
      aria-label={`${transitionType.replace(/_/g, ' ')} in progress`}
      aria-busy="true"
    >
      {/* Glitch content layer */}
      <div
        className="glitch-content"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
          backgroundRepeat: 'repeat',
          pointerEvents: 'none'
        }}
      />

      {/* Center glitch circle */}
      <div
        style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          border: `3px solid ${glitchColor}`,
          background: `radial-gradient(circle, ${glitchColor}20 0%, transparent 70%)`,
          boxShadow: `0 0 40px ${glitchColor}, inset 0 0 40px ${glitchColor}40`,
          animation: 'pulse 1s ease-in-out infinite'
        }}
      />

      {/* Message (if provided) */}
      {message && (
        <div
          className="glitch-message"
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            color: '#fff',
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: `0 0 20px ${glitchColor}`,
            pointerEvents: 'none'
          }}
        >
          {message}
        </div>
      )}

      {/* Fade-in/out transition text */}
      {!message && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            color: glitchColor,
            fontSize: '1.2rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            opacity: isAnimating ? 1 : 0,
            transition: 'opacity 200ms ease',
            pointerEvents: 'none'
          }}
        >
          {transitionType === 'epoch_shift' && 'Reality Shifting...'}
          {transitionType === 'world_reset' && 'World Rebuilding...'}
          {transitionType === 'macro_event' && 'Lore Glitching...'}
        </div>
      )}

      {/* Chromatic aberration effect (CSS only) */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        <filter id="chromatic-aberration">
          <feOffset in="SourceGraphic" dx="2" dy="0" result="offsetred" />
          <feOffset in="SourceGraphic" dx="-2" dy="0" result="offsetblue" />
          <feFlood floodColor={glitchColor} floodOpacity="0.3" result="red" />
          <feFlood floodColor="#d946ef" floodOpacity="0.3" result="blue" />
          <feComposite in="red" in2="offsetred" operator="in" result="redout" />
          <feComposite in="blue" in2="offsetblue" operator="in" result="blueout" />
          <feMerge>
            <feMergeNode in="redout" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="blueout" />
          </feMerge>
        </filter>
      </svg>

      {/* Loading/progress indicator (subtle) */}
      {isAnimating && (
        <div
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '0.5rem',
            zIndex: 10
          }}
        >
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: glitchColor,
                animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
                opacity: 0.7
              }}
            />
          ))}
        </div>
      )}

      {/* Accessibility: Live region for updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      >
        {isAnimating
          ? `${transitionType.replace(/_/g, ' ')} in progress`
          : `${transitionType.replace(/_/g, ' ')} complete`}
      </div>
    </div>
  );
};

/**
 * Hook for managing world state transitions
 */
export const useWorldStateTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'epoch_shift' | 'world_reset' | 'macro_event' | null>(null);
  const [transitionMessage, setTransitionMessage] = useState('');

  const triggerTransition = (
    type: 'epoch_shift' | 'world_reset' | 'macro_event',
    message?: string
  ) => {
    setTransitionType(type);
    setTransitionMessage(message || '');
    setIsTransitioning(true);
  };

  const completeTransition = () => {
    setIsTransitioning(false);
    setTransitionType(null);
    setTransitionMessage('');
  };

  return {
    isTransitioning,
    transitionType,
    transitionMessage,
    triggerTransition,
    completeTransition,
    Component: isTransitioning && transitionType ? (
      <WorldStateTransitionOverlay
        transitionType={transitionType}
        message={transitionMessage || undefined}
        onComplete={completeTransition}
        duration={800}
      />
    ) : null
  };
};

export default WorldStateTransitionOverlay;
