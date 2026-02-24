import React, { useEffect, useState } from 'react';

interface ParadoxIndicatorProps {
  state?: any;
}

/**
 * ParadoxIndicator Component — Phase 12: The Paradox Engine
 * 
 * Displays real-time chaos/paradox levels with glitchy visual effects.
 * Intensifies as suspicion and temporal debt increase.
 * 
 * Visual Effects:
 * - Green (0-30): Stable world
 * - Yellow (30-60): Unstable anomalies start
 * - Red (60-85): Critical chaos
 * - Purple (85-100): Reality in revolt
 */
export default function ParadoxIndicator({ state }: ParadoxIndicatorProps) {
  const suspicionLevel = state?.player?.beliefLayer?.suspicionLevel || 0;
  const temporalDebt = state?.player?.temporalDebt || 0;

  // Calculate combined chaos score (same formula as paradoxEngine)
  const chaosScore = Math.min(100, (suspicionLevel * 0.6) + (temporalDebt * 0.4));

  // Determine severity level
  const getSeverity = (): 'stable' | 'unstable' | 'critical' | 'revolt' => {
    if (chaosScore >= 90) return 'revolt';
    if (chaosScore >= 70) return 'critical';
    if (chaosScore >= 40) return 'unstable';
    return 'stable';
  };

  const severity = getSeverity();

  // Get color based on severity
  const getColor = (): string => {
    switch (severity) {
      case 'stable': return '#4CAF50';    // Green
      case 'unstable': return '#FFB933';   // Yellow
      case 'critical': return '#FF6B6B';   // Red
      case 'revolt': return '#9945FF';     // Purple
      default: return '#888';
    }
  };

  // Get glitch intensity (0-1)
  const glitchIntensity = chaosScore / 100;

  // Animation state for glitchy effect
  const [glitchOffset, setGlitchOffset] = useState(0);

  useEffect(() => {
    if (glitchIntensity < 0.3) return; // No glitch for stable

    const interval = setInterval(() => {
      setGlitchOffset(Math.random() * (glitchIntensity * 4));
    }, 100 + (1 - glitchIntensity) * 200);

    return () => clearInterval(interval);
  }, [glitchIntensity]);

  // Different omen messages based on chaos level
  const getOmenMessage = (): string => {
    if (chaosScore >= 90) {
      return '⚠️ REALITY FRACTURING';
    }
    if (chaosScore >= 70) {
      return '⚠️ TEMPORAL ECHOES';
    }
    if (chaosScore >= 40) {
      return '⚠️ AWARENESS RISING';
    }
    return '✓ WORLD STABLE';
  };

  const displayColor = getColor();

  return (
    <div
      className="paradox-indicator"
      style={{
        padding: '12px 16px',
        backgroundColor: '#1a1a2e',
        borderRadius: '8px',
        border: `1px solid ${displayColor}`,
        marginTop: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Glitch effect layer */}
      {glitchIntensity > 0.2 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${displayColor}15 50%, transparent)`,
            opacity: glitchIntensity * 0.5,
            pointerEvents: 'none',
            animation: glitchIntensity > 0.5 ? 'pulse 0.2s infinite' : 'none'
          }}
        />
      )}

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          color: displayColor,
          transform:
            glitchIntensity > 0.5
              ? `translate(${glitchOffset * (Math.random() - 0.5) * 2}px, 0)`
              : 'none',
          transition: 'transform 0.05s ease-out'
        }}
      >
        {/* Omen message */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '8px',
            letterSpacing: glitchIntensity > 0.7 ? '1px' : '0px',
            textShadow:
              glitchIntensity > 0.5
                ? `0 0 ${glitchIntensity * 4}px ${displayColor}`
                : 'none'
          }}
        >
          {getOmenMessage()}
        </div>

        {/* Chaos score bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '6px'
          }}
        >
          <span style={{ fontSize: '11px', color: '#aaa', minWidth: '60px' }}>Chaos</span>
          <div
            style={{
              flex: 1,
              height: '6px',
              backgroundColor: '#0a0a1a',
              borderRadius: '3px',
              overflow: 'hidden',
              border: `1px solid ${displayColor}40`
            }}
          >
            <div
              style={{
                width: `${chaosScore}%`,
                height: '100%',
                backgroundColor: displayColor,
                transition: 'width 0.3s ease',
                boxShadow:
                  glitchIntensity > 0.5
                    ? `0 0 ${glitchIntensity * 3}px ${displayColor}`
                    : 'none'
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: displayColor, minWidth: '30px' }}>
            {Math.floor(chaosScore)}%
          </span>
        </div>

        {/* Suspicion vs Temporal Debt breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: '#888' }}>
            <div>Suspicion</div>
            <div style={{ color: '#FFB933', fontSize: '12px', fontWeight: 'bold' }}>
              {suspicionLevel.toFixed(0)}/100
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#888' }}>
            <div>Temporal Debt</div>
            <div style={{ color: '#9945FF', fontSize: '12px', fontWeight: 'bold' }}>
              {temporalDebt.toFixed(0)}/100
            </div>
          </div>
        </div>

        {/* Warning messages based on level */}
        {chaosScore >= 40 && (
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: `1px solid ${displayColor}40`,
              fontSize: '10px',
              color: '#aaa',
              fontStyle: 'italic'
            }}
          >
            {chaosScore >= 90 &&
              '⚠️ Reality resists. The cosmos refuses your actions.'}
            {chaosScore >= 70 &&
              chaosScore < 90 &&
              '⚠️ Your knowledge creates paradoxes. Beware spell backfires.'}
            {chaosScore >= 40 &&
              chaosScore < 70 &&
              '⚠️ Anomalies manifest. The world grows unstable.'}
          </div>
        )}
      </div>

      {/* CSS for glitch animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        
        @keyframes glitch {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}
