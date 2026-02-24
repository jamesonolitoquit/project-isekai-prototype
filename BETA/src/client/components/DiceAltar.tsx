import React, { useState, useEffect } from 'react';

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
        width: '300px',
        height: '120px',
        background: 'rgba(20, 25, 35, 0.4)',
        border: '1px dashed #3b82f6',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#444',
        fontSize: '12px',
        fontFamily: '"JetBrains Mono", monospace'
      }}>
        <div style={{ opacity: 0.5 }}>WAITING_FOR_DICE_ALTAR_INVOCATION</div>
        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.3 }}>RITUAL_LOG_IDLE</div>
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
      maxWidth: '500px',
      background: 'linear-gradient(180deg, #151a23 0%, #0a0f14 100%)',
      border: `2px solid ${showResult ? resultColor : '#3b82f6'}`,
      boxShadow: `0 -10px 30px rgba(0,0,0,0.8), 0 0 15px ${showResult ? resultColor : '#3b82f6'}33, ${sparkGlow}`,
      borderRadius: '20px 20px 0 0',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      fontFamily: '"JetBrains Mono", monospace',
      transition: 'all 0.5s ease-out'
    }}>
      {/* Altar Header */}
      <div style={{
        fontSize: '10px',
        color: '#3b82f6',
        letterSpacing: '3px',
        marginBottom: '12px',
        borderBottom: '1px solid #1e293b',
        width: '100%',
        textAlign: 'center',
        paddingBottom: '4px'
      }}>
        DICE_ALTAR_RESOLUTION
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
        {/* The D20 Visual */}
        <div style={{
          width: '64px',
          height: '64px',
          background: showResult ? (isCritical ? 'gold' : isFumble ? '#5a1111' : '#1e293b') : '#1e1e1e',
          border: `2px solid ${showResult ? resultColor : '#3b82f6'}`,
          borderRadius: '12px',
          transform: showResult ? 'rotate(0deg)' : 'rotate(45deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          fontWeight: 'bold',
          color: showResult ? (isCritical ? '#000' : isFumble ? '#ff4444' : '#888') : '#3b82f6',
          transition: 'all 0.6s ease-out',
          boxShadow: showResult ? `0 0 20px ${resultColor}55` : 'none'
        }}>
          {showResult ? roll : '?'}
        </div>

        {/* Roll vs. DC Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#888' }}>TOTAL vs DC</div>
          <div style={{
            fontSize: '16px',
            color: success ? '#4ade80' : '#ef4444',
            fontWeight: 'bold',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span>{roll + (rollBreakdown?.total ?? 0)} vs {dc}</span>
            <span style={{ fontSize: '12px', opacity: 0.7 }}>
              {success ? `+${margin}` : `-${Math.abs(margin)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ALPHA_M18: Full Breakdown Display with Arcane Math */}
      {showResult && rollBreakdown && (
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #1e293b',
          width: '100%',
          fontSize: '10px',
          color: '#aaa'
        }}>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '0',
              marginBottom: '8px',
              textDecoration: 'underline'
            }}
          >
            {showBreakdown ? '▼' : '▶'} ARCANE_MATH_BREAKDOWN
          </button>

          {showBreakdown && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              paddingTop: '8px',
              fontSize: '9px'
            }}>
              <div style={{ color: '#4ade80' }}>
                <div>D20 Roll:</div>
                <div style={{ fontWeight: 'bold' }}>{rollBreakdown.d20Roll}</div>
              </div>
              <div style={{ color: '#3b82f6' }}>
                <div>Stat Modifier:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.statMod}</div>
              </div>
              <div style={{ color: '#3b82f6' }}>
                <div>Skill Bonus:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.skillMod}</div>
              </div>
              <div style={{ color: '#a78bfa' }}>
                <div>Relic Bonus:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.relicBonus}</div>
              </div>
              <div style={{ color: '#60a5fa' }}>
                <div>Environment:</div>
                <div style={{ fontWeight: 'bold' }}>+{rollBreakdown.environmentBonus}</div>
              </div>
              <div style={{ color: temporalDebt > 50 ? '#ff6b6b' : '#888' }}>
                <div>Temporal Debris:</div>
                <div style={{ fontWeight: 'bold' }}>{rollBreakdown.temporalDebrisModifier >= 0 ? '+' : ''}{rollBreakdown.temporalDebrisModifier}</div>
              </div>
              <div style={{
                gridColumn: '1 / -1',
                borderTop: '1px solid #1e293b',
                paddingTop: '4px',
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
