/**
 * M42 Phase 4 Task 4.3: Narrative Intervention Overlay
 * Phase 35 Extension: Paradox Ripple synchronization with Director Whispers
 *
 * Purpose: Display "Director Whispers" as diegetic visions to targeted players
 * Triggered by: `/announce <message>` command from DirectorConsole
 * Design: Ethereal edge-screen glitch effect with message display
 * Lifecycle: 5 seconds display + 1.5s fade, non-rollable (canonical truth)
 *
 * Features:
 * - Whisper queue for multiple messages
 * - Priority system (Director messages override others)
 * - Fade in/out animations
 * - Voice synthesis (optional, requires audio engine)
 * - Timestamp and read status tracking
 * - Style adapts to epoch (theme colors)
 * - Phase 35: Paradox Ripple glitch effects on whisper text
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface DirectorWhisper {
  id: string;                        // Unique message ID
  fromDirector: string;              // "director_primary" or peer ID
  message: string;                   // The whisper text
  timestamp: number;                 // When sent
  duration?: number;                 // Display duration (default 5000ms)
  priority: 'normal' | 'urgent' | 'critical';
  readAt?: number;                   // When player saw it
  isCanonical: boolean;              // Non-rollable (true for all Director whispers)
}

export interface NarrativeInterventionOverlayProps {
  /**
   * Queue of whispers to display
   */
  whisperQueue: DirectorWhisper[];

  /**
   * Remove whisper from queue after display
   */
  onWhisperComplete?: (whisperId: string) => void;

  /**
   * Current epoch (for theme color)
   */
  currentEpoch?: number;

  /**
   * Player's current name (for personalization)
   */
  playerName?: string;

  /**
   * Whether to play audio cue
   */
  enableAudio?: boolean;

  /**
   * Phase 35: Current paradox level (0-100) for ripple effects
   */
  paradoxLevel?: number;

  /**
   * Phase 35: Intervention severity level for screen shake intensity
   */
  interventionLevel?: 'minor' | 'major' | 'catastrophic';
}

/**
 * Create ethereal glitch styles for whisper effects
 */
const createWhisperStyles = (duration: number, epoch: number) => {
  const durationS = (duration / 1000).toFixed(2);
  const fadeS = ((duration * 1.5) / 1000).toFixed(2);

  // Get color scheme by epoch
  const getEpochColors = () => {
    switch (epoch) {
      case 1: // Dawn
        return { primary: '#fbbf24', secondary: '#78350f', glow: '#fcd34d' };
      case 2: // Twilight
        return { primary: '#a78bfa', secondary: '#3f0f5c', glow: '#c4b5fd' };
      case 3: // Midnight
        return { primary: '#0ea5e9', secondary: '#0c2d48', glow: '#06b6d4' };
      default:
        return { primary: '#a78bfa', secondary: '#3f0f5c', glow: '#c4b5fd' };
    }
  };

  const colors = getEpochColors();

  const keyframes = `
    @keyframes whisper-fade-in {
      0% { opacity: 0; transform: translateY(10px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes whisper-fade-out {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-10px) scale(0.95); }
    }

    @keyframes whisper-subtle-glitch {
      0% { text-shadow: 1px 1px 0 ${colors.primary}, -1px -1px 0 ${colors.secondary}; }
      50% { text-shadow: -1px 1px 0 ${colors.primary}, 1px -1px 0 ${colors.secondary}; }
      100% { text-shadow: 1px 1px 0 ${colors.primary}, -1px -1px 0 ${colors.secondary}; }
    }

    @keyframes whisper-glow {
      0% { box-shadow: 0 0 20px ${colors.glow}, inset 0 0 10px ${colors.primary}; }
      50% { box-shadow: 0 0 40px ${colors.glow}, inset 0 0 20px ${colors.primary}; }
      100% { box-shadow: 0 0 20px ${colors.glow}, inset 0 0 10px ${colors.primary}; }
    }

    @keyframes whisper-shimmer {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }

    @keyframes whisper-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
  `;

  const css = `
    .narrative-whisper-overlay {
      animation: whisper-fade-in 0.5s ease-out, whisper-fade-out 1.5s ease-in ${durationS}s forwards;
      animation-composition: auto;
    }

    .whisper-message {
      animation: whisper-subtle-glitch 3s infinite, whisper-glow 2s infinite, whisper-pulse 4s infinite;
    }

    .whisper-badge {
      animation: whisper-shimmer 3s linear infinite;
    }

    .whisper-frame {
      border-image: linear-gradient(135deg, ${colors.primary}, ${colors.secondary}) 1;
    }
  `;

  return { keyframes, css };
};

/**
 * Single Whisper Display Component
 */
const WhisperMessage: React.FC<{
  whisper: DirectorWhisper;
  epoch: number;
  totalDuration: number;
  onComplete: () => void;
  paradoxLevel?: number;
  interventionLevel?: 'minor' | 'major' | 'catastrophic';
}> = ({ whisper, epoch, totalDuration, onComplete, paradoxLevel = 0, interventionLevel = 'minor' }) => {
  const { keyframes, css } = createWhisperStyles(totalDuration, epoch || 2);

  // Phase 35: Determine if paradox ripple should apply
  const applyParadoxRipple = (paradoxLevel ?? 0) > 75;
  const applyScreenShake = interventionLevel === 'major' || interventionLevel === 'catastrophic';

  useEffect(() => {
    // Inject dynamic styles once
    const style = document.createElement('style');
    style.textContent = keyframes + css;
    document.head.appendChild(style);

    // Timer to remove message
    const timer = setTimeout(onComplete, totalDuration + 1500);

    return () => {
      style.remove();
      clearTimeout(timer);
    };
  }, [totalDuration, epoch, keyframes, css, onComplete]);

  // Color scheme by priority
  const getPriorityColor = () => {
    switch (whisper.priority) {
      case 'urgent':
        return '#f59e0b';
      case 'critical':
        return '#ef4444';
      default:
        return '#a78bfa';
    }
  };

  const priorityColor = getPriorityColor();

  return (
    <div
      className={`narrative-whisper-overlay ${applyParadoxRipple ? 'fxParadoxRipple' : ''} ${applyScreenShake ? 'fxScreenShake' : ''}`}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '600px',
        padding: '24px 32px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: '8px',
        borderLeft: `4px solid ${priorityColor}`,
        zIndex: 9998,
        backdropFilter: 'blur(8px)',
        boxShadow: `0 8px 32px rgba(167, 139, 250, 0.3), inset 0 0 20px ${priorityColor}33`
      }}
      role="alert"
      aria-label={`Director message: ${whisper.message}`}
    >
      {/* Whisper Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '12px'
        }}
      >
        <div
          className="whisper-badge"
          style={{
            padding: '4px 8px',
            backgroundColor: priorityColor,
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: '700',
            borderRadius: '4px',
            letterSpacing: '0.05em',
            backgroundImage: `linear-gradient(90deg, ${priorityColor}, rgba(167, 139, 250, 0.5))`,
            backgroundSize: '200% center'
          }}
        >
          ✧ DIRECTOR INTERVENTION ✧
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#a0aec0',
            fontStyle: 'italic'
          }}
        >
          Canonical Truth (Non-Rollable)
        </div>
      </div>

      {/* Message Content */}
      <div
        className="whisper-message"
        style={{
          fontSize: '1.125rem',
          lineHeight: '1.6',
          color: '#e2e8f0',
          fontFamily: '"Crimson Text", serif',
          marginBottom: '12px',
          letterSpacing: '0.01em'
        }}
      >
        {whisper.message}
      </div>

      {/* Metadata Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(148, 163, 184, 0.2)',
          fontSize: '0.75rem',
          color: '#64748b'
        }}
      >
        <span>From: {whisper.fromDirector}</span>
        <span>{new Date(whisper.timestamp).toLocaleTimeString()}</span>
      </div>

      {/* Ambient Glow Effect */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: '-20px',
          right: '-20px',
          bottom: '-20px',
          borderRadius: 'inherit',
          opacity: 0.3,
          filter: 'blur(12px)',
          background: priorityColor,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />
    </div>
  );
};

/**
 * Narrative Intervention Overlay Component
 */
export const NarrativeInterventionOverlay: React.FC<NarrativeInterventionOverlayProps> = ({
  whisperQueue,
  onWhisperComplete,
  currentEpoch = 2,
  playerName = 'Wanderer',
  enableAudio = true,
  paradoxLevel = 0,
  interventionLevel = 'minor'
}) => {
  const [displayedWhisper, setDisplayedWhisper] = useState<DirectorWhisper | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Process queue
  useEffect(() => {
    if (isProcessing || displayedWhisper) return;
    if (whisperQueue.length === 0) return;

    // Get next whisper (sorted by priority)
    const sorted = [...whisperQueue].sort((a, b) => {
      const priorityOrder = { critical: 0, urgent: 1, normal: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const nextWhisper = sorted[0];
    
    setIsProcessing(true);
    setDisplayedWhisper(nextWhisper);

    // Play audio cue if enabled
    if (enableAudio) {
      try {
        // Simple beep using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.frequency.value = 528; // Healing frequency
        oscillator.type = 'sine';

        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.debug('Audio cue unavailable:', error);
      }
    }
  }, [whisperQueue, displayedWhisper, isProcessing, enableAudio]);

  // Handle whisper completion
  const handleWhisperComplete = useCallback(() => {
    if (!displayedWhisper) return;

    const whisperId = displayedWhisper.id;
    
    // Record read timestamp
    const whisperWithRead: DirectorWhisper = {
      ...displayedWhisper,
      readAt: Date.now()
    };

    // Notify parent
    onWhisperComplete?.(whisperId);

    // Clear display
    setDisplayedWhisper(null);
    setIsProcessing(false);
  }, [displayedWhisper, onWhisperComplete]);

  if (!displayedWhisper) {
    return null;
  }

  return (
    <WhisperMessage
      whisper={displayedWhisper}
      epoch={currentEpoch}
      totalDuration={displayedWhisper.duration || 5000}
      onComplete={handleWhisperComplete}
      paradoxLevel={paradoxLevel}
      interventionLevel={interventionLevel}
    />
  );
};

/**
 * Hook for managing narrative whispers
 */
export const useNarrativeWhispers = () => {
  const [whisperQueue, setWhisperQueue] = useState<DirectorWhisper[]>([]);

  const addWhisper = useCallback((
    message: string,
    fromDirector: string = 'director_primary',
    priority: 'normal' | 'urgent' | 'critical' = 'normal',
    duration: number = 5000
  ) => {
    const whisper: DirectorWhisper = {
      id: `whisper_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromDirector,
      message,
      timestamp: Date.now(),
      duration,
      priority,
      isCanonical: true
    };

    setWhisperQueue(prev => [...prev, whisper]);
    return whisper.id;
  }, []);

  const removeWhisper = useCallback((whisperId: string) => {
    setWhisperQueue(prev => prev.filter(w => w.id !== whisperId));
  }, []);

  const clearQueue = useCallback(() => {
    setWhisperQueue([]);
  }, []);

  return {
    whisperQueue,
    addWhisper,
    removeWhisper,
    clearQueue
  };
};

export default NarrativeInterventionOverlay;
