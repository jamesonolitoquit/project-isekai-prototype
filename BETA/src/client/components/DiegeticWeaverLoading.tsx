/**
 * DiegeticWeaverLoading.tsx - Narrative Loading UI (Pillar 2.3)
 *
 * Purpose: Replace generic spinners with diegetic "Weaver Resonating" status
 * that visually represents the AI synthesis process and paradox intensity.
 *
 * When the AI is synthesizing narrative content (quests, dialogue, events),
 * this component shows an immersive loading state that:
 * - Pulses with intensity matching the current paradox level
 * - Displays atmospheric messages about the Weaver's contemplation
 * - Provides feedback on synthesis progress (retries, fallback, etc.)
 */

import React, { useEffect, useState } from 'react';

export interface DiegeticWeaverLoadingProps {
  isLoading: boolean;
  paradoxLevel?: number; // 0-100
  synthesisType?: 'quest' | 'dialogue' | 'story' | 'event';
  estimatedLatency?: number; // ms
  showDetailedStatus?: boolean;
  style?: React.CSSProperties;
}

const DiegeticWeaverLoading: React.FC<DiegeticWeaverLoadingProps> = ({
  isLoading,
  paradoxLevel = 0,
  synthesisType = 'quest',
  estimatedLatency = 3000,
  showDetailedStatus = false,
  style,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pulsatePhase, setPulsatePhase] = useState(0);

  // Update elapsed time and pulsate phase while loading
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(t => t + 100);
      setPulsatePhase(p => (p + 1) % 10);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) {
    return null;
  }

  // Determine visual intensity from paradox level
  const glitchIntensity = Math.min(100, Math.max(0, paradoxLevel));
  const pulseRate = 0.5 + (glitchIntensity / 100) * 1.5; // 0.5-2.0 pulses/sec
  const glitchOpacity = 0.3 + (glitchIntensity / 100) * 0.7; // 0.3-1.0

  // Determine status messages
  const messages = {
    quest: [
      'The Weaver is contemplating the threads of fate...',
      'Weaving a new narrative challenge into existence...',
      'The loom turns, threads align with your destiny...',
      'A quest is being synthesized from the world\'s unfolding tapestry...',
    ],
    dialogue: [
      'The Weaver resonates with the NPC\'s consciousness...',
      'Echoes of speech across the timeline...',
      'A voice emerges from the Weaver\'s thread...',
      'The NPC\'s words are being woven into being...',
    ],
    story: [
      'The Weaver examines your origins...',
      'Your tale is being written across infinite timelines...',
      'Threads of destiny converge on your story...',
      'The Weaver inscribes your legend...',
    ],
    event: [
      'The Weaver perceives a shift in the world...',
      'Reality folds and reshapes itself...',
      'An event cascades through the timeline...',
      'The world\'s story advances...',
    ],
  };

  const messageArray = messages[synthesisType];
  const messageIndex = Math.floor((elapsedTime / 1000) % messageArray.length);
  const currentMessage = messageArray[messageIndex];

  // Progress bar styling
  const progressPercent = Math.min(100, (elapsedTime / estimatedLatency) * 100);
  const isRetry = elapsedTime > estimatedLatency * 1.2;

  // Visual glitch text shadow intensifies with paradox
  const glitchShadow = glitchIntensity > 60
    ? `0 0 8px rgba(200, 100, 255, ${glitchOpacity}), 2px 2px 0 rgba(100, 200, 255, ${glitchOpacity * 0.5})`
    : 'none';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 12px',
    borderRadius: '4px',
    backgroundColor: glitchIntensity > 60 
      ? 'rgba(20, 10, 30, 0.8)' 
      : 'rgba(10, 20, 40, 0.8)',
    border: `1px solid rgba(150, 100, 200, ${0.3 + (glitchIntensity / 100) * 0.7})`,
    backdropFilter: 'blur(4px)',
    color: '#e0e0e0',
    fontSize: '12px',
    fontFamily: 'monospace',
    animation: glitchIntensity > 70 
      ? `paradox-text-glitch ${0.3 + (1 - glitchIntensity / 100) * 0.2}s infinite`
      : 'none',
    ...style,
  };

  const messageStyle: React.CSSProperties = {
    color: glitchIntensity > 50 ? 'rgba(200, 120, 255, 1)' : 'rgba(150, 150, 200, 1)',
    textShadow: glitchShadow,
    textAlign: 'center',
    fontStyle: glitchIntensity > 60 ? 'italic' : 'normal',
    opacity: 0.9,
    fontSize: '13px',
    letterSpacing: glitchIntensity > 70 ? '1px' : '0',
  };

  const barContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(50, 40, 80, 0.6)',
    borderRadius: '3px',
    overflow: 'hidden',
    border: `1px solid rgba(150, 100, 200, 0.3)`,
  };

  const barFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    backgroundColor: glitchIntensity > 60
      ? '#ff00ff'
      : '#8844ff',
    boxShadow: glitchIntensity > 60
      ? `0 0 6px rgba(255, 0, 255, ${0.5 + pulsatePhase / 20})`
      : `0 0 4px rgba(136, 68, 255, 0.5)`,
    transition: 'width 0.3s ease-out',
    animation: isRetry 
      ? 'pulse-retry 0.5s infinite'
      : glitchIntensity > 50
      ? 'pulse-intense 0.4s ease-in-out infinite'
      : 'pulse-normal 0.6s ease-in-out infinite',
  };

  const statusLineStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: 'rgba(150, 150, 150, 0.7)',
    lineHeight: '1.4',
  };

  return (
    <>
      <style>{`
        @keyframes paradox-text-glitch {
          0%, 100% { transform: translateX(0) skewX(0deg); opacity: 1; }
          20% { transform: translateX(-1px) skewX(-0.5deg); opacity: 0.8; }
          40% { transform: translateX(1px) skewX(0.5deg); opacity: 1; }
          60% { transform: translateX(-0.5px) skewX(-0.2deg); opacity: 0.9; }
          80% { transform: translateX(0.5px) skewX(0.2deg); opacity: 1; }
        }

        @keyframes pulse-normal {
          0%, 100% { box-shadow: 0 0 4px rgba(136, 68, 255, 0.5); }
          50% { box-shadow: 0 0 8px rgba(136, 68, 255, 0.9); }
        }

        @keyframes pulse-intense {
          0%, 100% { box-shadow: 0 0 6px rgba(255, 0, 255, 0.6); }
          50% { box-shadow: 0 0 12px rgba(255, 0, 255, 1); }
        }

        @keyframes pulse-retry {
          0%, 100% { width: 100%; opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes weaver-contemplation {
          0% { content: '...'; }
          33% { content: ':.'; }
          66% { content: '..'; }
        }
      `}</style>

      <div style={containerStyle}>
        <div style={messageStyle}>
          {glitchIntensity > 70 && '['}
          {currentMessage}
          {glitchIntensity > 70 && ']'}
        </div>

        <div style={barContainerStyle}>
          <div style={barFillStyle} />
        </div>

        {showDetailedStatus && (
          <div style={statusLineStyle}>
            <span>
              {isRetry ? '⚠ Retry' : 'Weaver'} 
              {glitchIntensity > 50 && ` [Paradox: ${Math.round(glitchIntensity)}%]`}
            </span>
            <span>
              {Math.round(elapsedTime)}ms / ~{Math.round(estimatedLatency)}ms
            </span>
          </div>
        )}

        {glitchIntensity > 80 && (
          <div style={{
            fontSize: '9px',
            color: 'rgba(255, 100, 255, 0.5)',
            textAlign: 'center',
            marginTop: '4px',
          }}>
            [SEVERE PARADOX DETECTED - TIMELINE INSTABILITY DETECTED]
          </div>
        )}
      </div>
    </>
  );
};

export default DiegeticWeaverLoading;
