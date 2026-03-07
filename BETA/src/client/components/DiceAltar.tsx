import React, { useState, useEffect } from 'react';
import { audioService } from '../services/AudioService';

interface DiceAltarProps {
  state: any;
}

interface RollBreakdown {
  d20Roll: number;
  statMod: number;
  skillMod: number;
  relicBonus: number;
  environmentBonus: number;
  temporalDebrisModifier: number;
  total: number;
  dc: number;
  margin: number;
  success: boolean;
}

export default function DiceAltar({ state }: DiceAltarProps) {
  const [activeRoll, setActiveRoll] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [rollBreakdown, setRollBreakdown] = useState<RollBreakdown | null>(null);

  // Poll for the latest roll event
  useEffect(() => {
    if (!state?.events || state.events.length === 0) return;

    // Find the latest event that has a roll in its payload
    const latestEvent = [...state.events].reverse().find(e => e.payload && e.payload.roll !== undefined);

    if (latestEvent && (!activeRoll || latestEvent.id !== activeRoll.id)) {
      setActiveRoll(latestEvent);
      setShowResult(false);
      setShowBreakdown(false);

      // Parse roll breakdown from event payload
      if (latestEvent.payload.breakdown) {
        setRollBreakdown(latestEvent.payload.breakdown);
      }

      // Play dice roll sound immediately when roll detected
      try {
        audioService.playDiceRoll();
      } catch (e) {
        console.warn('[DiceAltar] Failed to play dice roll sound:', e);
      }

      // Trigger "Ritual Animation"
      const timer = setTimeout(() => {
        setShowResult(true);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [state.events, activeRoll]);

  // Calculate temporal debt visual intensity (Stability Sparks)
  const temporalDebt = state?.player?.temporalDebt ?? 0;
  const debtIntensity = Math.min(1, temporalDebt / 100);
  const sparkGlow = `0 0 ${8 + debtIntensity * 12}px rgba(255, 215, 0, ${0.3 + debtIntensity * 0.5})`;

  if (!activeRoll) {
    return (
      <div style={{
        width: '100%',
        height: '180px',
        background: 'linear-gradient(180deg, #161625 0%, #0a0a12 100%)',
        border: '2px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 0 10px rgba(139, 92, 246, 0.05)',
        position: 'relative',
        fontFamily: '"JetBrains Mono", monospace'
      }}>
        {/* The D20 Visual - Centered, stationary */}
        <div style={{
          width: '64px',
          height: '64px',
          background: '#0d0d15',
          border: '2.5px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '10px',
          transform: 'rotate(45deg)', // The Iconic D20 Square-on-point
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 'bold',
          color: 'rgba(139, 92, 246, 0.2)',
          boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.1)',
          marginBottom: '20px'
        }}>
          <span style={{ transform: 'rotate(-45deg)' }}>?</span>
        </div>

        <div style={{
          fontSize: '10px',
          color: 'rgba(139, 92, 246, 0.5)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: '4px'
        }}>Awaiting Challenge</div>
        
        <div style={{
          fontSize: '8px',
          color: 'rgba(139, 92, 246, 0.3)',
          letterSpacing: '1px'
        }}>INVOKE THE DICE ALTAR</div>
      </div>
    );
  }

  const { roll, dc, margin, success } = activeRoll.payload;
  const isCritical = roll === 20;
  const isFumble = roll === 1;
  const resultColor = success ? '#4ade80' : '#ef4444';

  return (
    <div style={{
      width: '100%',
      minHeight: '180px',
      background: 'linear-gradient(180deg, #2a1f3d 0%, #1a0f2a 100%)',
      border: `2px solid ${showResult ? resultColor : '#8b5cf6'}`,
      boxShadow: `inset 0 0 15px rgba(0,0,0,0.5), 0 0 20px ${showResult ? resultColor : '#8b5cf6'}44, ${sparkGlow}`,
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      fontFamily: '"JetBrains Mono", monospace',
      transition: 'all 0.5s ease-out',
      transformStyle: 'preserve-3d'
    }}>
      {/* Altar Header */}
      <div style={{
        fontSize: '10px',
        color: '#c084fc',
        letterSpacing: '1px',
        marginBottom: '8px',
        borderBottom: '1px solid rgba(79, 39, 131, 0.3)',
        width: '100%',
        textAlign: 'center',
        paddingBottom: '4px',
        fontWeight: 'bold'
      }}>
        🎲 ALTAR
      </div>

      {/* The D20 Visual - Centered, compact */}
      <div style={{
        width: '56px',
        height: '56px',
        background: showResult ? (isCritical ? 'linear-gradient(135deg, #ffd700, #ffed4e)' : isFumble ? 'linear-gradient(135deg, #5a1111, #8b0000)' : '#2a1f3d') : '#1a0f2a',
        border: `2px solid ${showResult ? resultColor : '#8b5cf6'}`,
        borderRadius: '8px',
        transform: showResult ? 'rotate(0deg)' : 'rotate(45deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        fontWeight: 'bold',
        color: showResult ? (isCritical ? '#000' : isFumble ? '#ff6b6b' : '#c084fc') : '#8b5cf6',
        transition: 'all 0.6s ease-out',
        boxShadow: showResult ? `0 4px 12px ${resultColor}66, 0 0 16px ${resultColor}44` : 'inset 0 0 8px rgba(0,0,0,0.5)',
        marginBottom: '8px'
      }}>
        {showResult ? roll : '?'}
      </div>

      {/* Roll vs. DC Comparison - Compact */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center', width: '100%' }}>
        <div style={{ fontSize: '9px', color: '#888' }}>TOTAL vs DC</div>
        <div style={{
          fontSize: '14px',
          color: success ? '#4ade80' : '#ef4444',
          fontWeight: 'bold'
        }}>
          {roll + (rollBreakdown?.total ?? 0)}
        </div>
        <div style={{
          fontSize: '10px',
          color: '#888'
        }}>
          DC {dc}
        </div>
        <div style={{
          fontSize: '10px',
          color: success ? '#4ade80' : '#ef4444',
          marginTop: '4px'
        }}>
          {success ? `+${margin}` : `-${Math.abs(margin)}`}
        </div>
      </div>

      {/* ALPHA_M18: Full Breakdown Display with Arcane Math - Compact */}
      {showResult && rollBreakdown && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(30, 41, 59, 0.5)',
          width: '100%',
          fontSize: '8px',
          color: '#aaa'
        }}>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '8px',
              padding: '0',
              marginBottom: '4px',
              textDecoration: 'underline'
            }}
          >
            {showBreakdown ? '▼' : '▶'} BREAKDOWN
          </button>

          {showBreakdown && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
              paddingTop: '4px',
              fontSize: '7px'
            }}>
              <div style={{ color: '#4ade80' }}>
                <div>D20:</div>
                <div style={{ fontWeight: 'bold' }}>{rollBreakdown.d20Roll}</div>
              </div>
              <div style={{ color: '#3b82f6' }}>
                <div>Stat:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.statMod}</div>
              </div>
              <div style={{ color: '#3b82f6' }}>
                <div>Skill:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.skillMod}</div>
              </div>
              <div style={{ color: '#a78bfa' }}>
                <div>Relic:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.relicBonus}</div>
              </div>
              <div style={{
                gridColumn: '1 / -1',
                borderTop: '1px solid rgba(30, 41, 59, 0.5)',
                paddingTop: '2px',
                color: success ? '#4ade80' : '#ef4444',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>TOTAL</span>
                <span style={{ fontWeight: 'bold' }}>{rollBreakdown.total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temporal Debt Indicator (Stability Sparks) */}
      {debtIntensity > 0 && (
        <div style={{
          marginTop: '8px',
          fontSize: '9px',
          color: '#ff6b6b',
          opacity: 0.7 + debtIntensity * 0.3
        }}>
          ⚡ TEMPORAL_INSTABILITY: {Math.round(temporalDebt)}%
        </div>
      )}
    </div>
  );
}
