/**
 * WeaverProcessingIndicator.tsx - Phase 30: AI Synthesis Latency Visualization
 *
 * Displays a subtle "Reality Recalculating..." glitch effect when the AI Weaver
 * is synthesizing narrative content (quest prologues, tutorials, etc).
 *
 * Features:
 * - Monitors AIService latency (5ms-5000ms typical)
 * - Progressive visual intensity based on latency
 * - Accessible: prefers-reduced-motion support
 * - Auto-dismisses when synthesis completes
 * - Integrates with atmosphere filters for paradox awareness
 */

import React, { useEffect, useState } from 'react';

export interface WeaverProcessingState {
  isProcessing: boolean;
  latencyMs: number;
  synthesisType: 'quest_prologue' | 'tutorial' | 'npc_dialogue' | 'world_event';
  progress: number; // 0-100, estimated completion %
}

export interface WeaverProcessingIndicatorProps {
  state: WeaverProcessingState | null;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  theme?: 'diegetic' | 'hud' | 'minimal';
  compact?: boolean;
}

const LATENCY_TIERS = {
  fast: { threshold: 100, intensity: 'subtle', color: '#6ae5ff' },        // Groq typical
  normal: { threshold: 500, intensity: 'moderate', color: '#9d4edd' },    // Acceptable
  slow: { threshold: 2000, intensity: 'visible', color: '#ff006e' },      // Notable
  critical: { threshold: 5000, intensity: 'severe', color: '#ffbe0b' }    // Fallback soon
};

/**
 * Calculate processing intensity based on latency
 */
function getLatencyIntensity(latencyMs: number): {
  tier: 'fast' | 'normal' | 'slow' | 'critical';
  intensity: number; // 0-1
  icon: string;
} {
  if (latencyMs <= LATENCY_TIERS.fast.threshold) {
    return { tier: 'fast', intensity: 0.2, icon: '✓' };
  }
  if (latencyMs <= LATENCY_TIERS.normal.threshold) {
    return { tier: 'normal', intensity: 0.4, icon: '◆' };
  }
  if (latencyMs <= LATENCY_TIERS.slow.threshold) {
    return { tier: 'slow', intensity: 0.6, icon: '⚠' };
  }
  return { tier: 'critical', intensity: 0.9, icon: '●' };
}

/**
 * Get human-readable synthesis type label
 */
function getSynthesisLabel(type: WeaverProcessingState['synthesisType']): string {
  const labels = {
    quest_prologue: 'Weaving Quest...',
    tutorial: 'Calibrating Knowledge...',
    npc_dialogue: 'Listening to Echoes...',
    world_event: 'Reshaping Reality...'
  };
  return labels[type];
}

/**
 * WeaverProcessingIndicator - Main component
 */
const WeaverProcessingIndicator: React.FC<WeaverProcessingIndicatorProps> = ({
  state,
  position = 'bottom-right',
  theme = 'diegetic',
  compact = false
}) => {
  const [displayLatency, setDisplayLatency] = useState(0);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Update latency display periodically
  useEffect(() => {
    if (!state?.isProcessing) return;

    const interval = setInterval(() => {
      setDisplayLatency(prev => Math.min(prev + 50, state.latencyMs || 0));
      setAnimationPhase(prev => (prev + 1) % 8);
    }, 100);

    return () => clearInterval(interval);
  }, [state?.isProcessing, state?.latencyMs]);

  // Reset when processing stops
  useEffect(() => {
    if (!state?.isProcessing) {
      setDisplayLatency(0);
      setAnimationPhase(0);
    }
  }, [state?.isProcessing]);

  if (!state?.isProcessing) {
    return null;
  }

  const { tier, intensity, icon } = getLatencyIntensity(displayLatency);
  const label = getSynthesisLabel(state.synthesisType);
  const tierColor = LATENCY_TIERS[tier].color;

  const containerClass = `weaver-processing weaver-processing-${position} weaver-processing-${theme} weaver-processing-${tier}`;
  const glitchClass = intensity > 0.6 ? 'weaver-glitch-active' : '';

  return (
    <div className={containerClass} style={{
      '--weaver-intensity': intensity,
      '--weaver-color': tierColor,
      '--weaver-phase': animationPhase
    } as React.CSSProperties}>
      {/* Diegetic Mode: Full immersive UI */}
      {theme === 'diegetic' && !compact && (
        <div className="weaver-diegetic-panel">
          <div className="weaver-header">
            <span className={`weaver-icon ${glitchClass}`}>{icon}</span>
            <span className="weaver-label">{label}</span>
          </div>

          <div className="weaver-progress-bar">
            <div 
              className="weaver-progress-fill" 
              style={{ width: `${state.progress}%` }}
            />
          </div>

          <div className="weaver-latency">
            <span className="weaver-latency-value">{displayLatency}ms</span>
            <span className="weaver-latency-tier">{tier.toUpperCase()}</span>
          </div>

          <div className="weaver-status-text">
            {state.progress < 30 && "Reality recalculating..."}
            {state.progress >= 30 && state.progress < 70 && "Weaver contemplating..."}
            {state.progress >= 70 && "Finalizing narrative..."}
          </div>
        </div>
      )}

      {/* HUD Mode: Compact corner indicator */}
      {theme === 'hud' || compact && (
        <div className="weaver-hud-badge">
          <span className={`weaver-spinner ${glitchClass}`} style={{
            animationDuration: `${0.5 + intensity * 0.5}s`
          }}>
            ⟳
          </span>
          <div className="weaver-tooltip">
            {label} ({displayLatency}ms)
          </div>
        </div>
      )}

      {/* Minimal Mode: Just a subtle glow */}
      {theme === 'minimal' && (
        <div className="weaver-pulse" style={{
          opacity: 0.3 + intensity * 0.7,
          borderColor: tierColor
        }} />
      )}

      {/* Glitch effect overlay (visible at high latency) */}
      {intensity > 0.5 && (
        <div className="weaver-glitch-overlay" style={{
          opacity: (intensity - 0.5) * 0.4
        }}>
          <div className="weaver-glitch-line" style={{
            top: `${animationPhase * 12.5}%`,
            opacity: (intensity - 0.5) * 0.6
          }} />
        </div>
      )}
    </div>
  );
};

export default WeaverProcessingIndicator;
