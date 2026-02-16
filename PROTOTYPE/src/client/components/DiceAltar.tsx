import React, { useState } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import type { VisualTriggerResult } from '../../engine/visualTriggerWeave';
import { processDiceRollForVisuals } from '../../engine/visualTriggerWeave';

/**
 * DiceAltar.tsx - M25: The Dice Altar (Tactile Resolution UI)
 * 
 * Ritualistic center-bottom UI for all action resolutions.
 * Shows transparent math, dice animation, and resolution results.
 * M39 Task 1: Integrated with visualTriggerWeave for critical moment visuals.
 */

export interface DiceRollContext {
  actionType: 'attack' | 'defend' | 'skillcheck' | 'ritual' | 'magic' | 'craft';
  actionName: string;
  baseValue: number;
  modifiers: Array<{ name: string; value: number }>;
  staticResult?: number; // DC or target number
  targetValue: number;
  targetDescription?: string;
}

export interface DiceAltarProps {
  context: DiceRollContext | null;
  onResolved?: (success: boolean, roll: number, totalValue: number) => void;
  isVisible?: boolean;
  // M32: Multiplayer spectator mode
  sessionRegistry?: any; // SessionRegistry from multiplayerEngine
  currentClientId?: string; // Current player's client ID
  spectatorMode?: boolean; // True if viewing another player's roll
  spectatorData?: {
    clientId: string;
    playerName?: string;
    roll?: number;
    totalValue?: number;
    success?: boolean;
  };
  // M39 Task 1: World state for visual triggers
  worldState?: WorldState;
  onCriticalVisualTriggered?: (triggerResult: VisualTriggerResult) => void;
}

export interface DiceRollResult {
  roll: number;
  baseValue: number;
  totalValue: number;
  success: boolean;
  resultMessage: string;
  detailedBreakdown: string;
  criticalVisual?: VisualTriggerResult;
}

const DiceAltar: React.FC<DiceAltarProps> = ({ 
  context, 
  onResolved, 
  isVisible = true,
  sessionRegistry,
  currentClientId,
  spectatorMode = false,
  spectatorData,
  worldState,
  onCriticalVisualTriggered
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(0);
  const [result, setResult] = useState<DiceRollResult | null>(null);
  const [displayedRoll, setDisplayedRoll] = useState(0);

  // Trigger roll animation
  const performRoll = async () => {
    if (!context) return;
    
    setIsRolling(true);
    setResult(null);
    let animationFrame = 0;
    const animationFrames = 40; // 40 frames for smooth animation

    const rollAnimation = setInterval(async () => {
      animationFrame++;
      const randomValue = Math.floor(Math.random() * 20) + 1;
      setDisplayedRoll(randomValue);

      if (animationFrame >= animationFrames) {
        clearInterval(rollAnimation);
        
        // Final roll value
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        setDiceValue(finalRoll);

        // Calculate total
        const modifiersTotal = context.modifiers.reduce((sum, mod) => sum + mod.value, 0);
        const totalValue = context.baseValue + modifiersTotal + finalRoll;
        const success = totalValue >= context.targetValue;

        const resultMessage = success
          ? `✅ Success! (${totalValue} vs DC ${context.targetValue})`
          : `❌ Failed. (${totalValue} vs DC ${context.targetValue})`;

        const breakdown = [
          `Base: ${context.baseValue}`,
          ...context.modifiers.map(m => `${m.name}: ${m.value > 0 ? '+' : ''}${m.value}`),
          `Die Roll: ${finalRoll}`,
          `---`,
          `Total: ${totalValue}`,
          `Target: ${context.targetValue}`,
          success ? 'RESULT: SUCCESS' : 'RESULT: FAILURE'
        ].join('\n');

        // M39 Task 1: Trigger visual weave if conditions met
        let criticalVisual: VisualTriggerResult | undefined;
        if (worldState) {
          try {
            const triggerResult = await processDiceRollForVisuals(
              finalRoll,
              context.targetValue,
              success ? 'success' : 'failure',
              worldState.player?.currentLocation || 'unknown',
              worldState.currentWeather || 'clear',
              worldState.currentEpoch || 'epoch_i',
              {
                actionType: context.actionType,
                actionName: context.actionName,
                baseValue: context.baseValue,
                modifiersTotal
              }
            );

            if (triggerResult.triggered) {
              criticalVisual = triggerResult;
              onCriticalVisualTriggered?.(triggerResult);
            }
          } catch (error) {
            console.warn('[DiceAltar] Visual trigger failed:', error);
          }
        }

        setResult({
          roll: finalRoll,
          baseValue: context.baseValue,
          totalValue,
          success,
          resultMessage,
          detailedBreakdown: breakdown,
          criticalVisual
        });

        setIsRolling(false);

        // M32: Emit SYNC_DICE_ROLL for high-stakes rolls in multiplayer
        if (sessionRegistry && currentClientId) {
          const isDifficultRoll = context.targetValue > 15;
          if (isDifficultRoll) {
            try {
              const syncEvent = {
                type: 'SYNC_DICE_ROLL',
                payload: {
                  clientId: currentClientId,
                  roll: finalRoll,
                  totalValue,
                  success,
                  actionType: context.actionType,
                  actionName: context.actionName,
                  difficulty: context.targetValue,
                  timestamp: Date.now()
                }
              };
              
              // Broadcast to all active peers (these peers will see "Witness Mode")
              if (sessionRegistry.broadcastToActivePeers) {
                sessionRegistry.broadcastToActivePeers(sessionRegistry, syncEvent);
              }
            } catch (err) {
              // Silently fail if broadcast unavailable (solo mode)
            }
          }
        }

        onResolved?.(success, finalRoll, totalValue);
      }
    }, 30);
  };

  if (!isVisible) {
    return null;
  }

  // M32: Render spectator mode if enabled
  if (spectatorMode && spectatorData) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          maxWidth: '90vw',
          backgroundColor: '#0a0a14',
          border: '3px solid #8b5cf6',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)',
          fontFamily: 'monospace',
          color: '#e0e0e0',
          zIndex: 9999
        }}
      >
        {/* Witness Mode Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#3f2c70',
            borderRadius: '6px',
            border: '1px solid #8b5cf6'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#c084fc', textTransform: 'uppercase' }}>
            👁 WITNESS MODE
          </div>
          <div style={{ fontSize: '11px', color: '#a78bfa' }}>
            {spectatorData.playerName || `Player #${spectatorData.clientId.substring(0, 8)}`}
          </div>
        </div>

        {/* Spectator Result Display */}
        <div
          style={{
            backgroundColor: spectatorData.success ? '#1a3a1a' : '#3a1a1a',
            border: `2px solid ${spectatorData.success ? '#4ade80' : '#ef4444'}`,
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: spectatorData.success ? '#4ade80' : '#ef4444',
              marginBottom: '12px'
            }}
          >
            {spectatorData.success ? '✅ SUCCESS' : '❌ FAILURE'}
          </div>
          
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>
            Rolled: <span style={{ fontSize: '16px', color: spectatorData.success ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
              {spectatorData.roll}
            </span>
          </div>

          <div style={{ 
            fontSize: '11px', 
            color: '#888',
            borderTop: '1px solid #555',
            paddingTop: '12px',
            marginTop: '12px'
          }}>
            Total: {spectatorData.totalValue}
          </div>
        </div>
      </div>
    );
  }

  if (!context) {
    return null;
  }

  const modifiersTotal = context.modifiers.reduce((sum, mod) => sum + mod.value, 0);
  const projectedTotal = context.baseValue + modifiersTotal;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        maxWidth: '90vw',
        backgroundColor: '#0a0a14',
        border: '3px solid #0f3',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
        fontFamily: 'monospace',
        color: '#e0e0e0',
        zIndex: 9999
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f3', textTransform: 'uppercase' }}>
          ▪ {context.actionName}
        </div>
        <div style={{ fontSize: '10px', color: '#0f3' }}>
          {context.actionType}
        </div>
      </div>

      {/* Transparent Math Breakdown */}
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '11px'
        }}
      >
        <div style={{ marginBottom: '8px', color: '#60a5fa', fontWeight: 'bold' }}>Calculation Breakdown:</div>
        <div style={{ marginBottom: '4px' }}>
          Base Value: <span style={{ color: '#4ade80' }}>{context.baseValue}</span>
        </div>
        {context.modifiers.map((modifier, idx) => (
          <div key={idx} style={{ marginBottom: '4px' }}>
            {modifier.name}:{' '}
            <span style={{ color: modifier.value > 0 ? '#4ade80' : '#ef4444' }}>
              {modifier.value > 0 ? '+' : ''}{modifier.value}
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '8px', color: '#60a5fa' }}>
          Projected Total (without die): {projectedTotal}
          <br />
          Target DC: <span style={{ color: '#fbbf24' }}>{context.targetValue}</span>
          {context.targetDescription && (
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              {context.targetDescription}
            </div>
          )}
        </div>
      </div>

      {/* Dice Roll Animation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            width: '120px',
            height: '120px',
            border: '2px solid #0f3',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#0f3',
            backgroundColor: '#0f0f1a',
            boxShadow: isRolling ? '0 0 20px rgba(0, 255, 136, 0.5)' : 'none',
            transition: 'all 0.1s',
            transform: isRolling ? 'scale(1.05)' : 'scale(1)'
          }}
        >
          {isRolling ? displayedRoll : diceValue || '?'}
        </div>
      </div>

      {/* Roll Button */}
      {!result && (
        <button
          onClick={performRoll}
          disabled={isRolling}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: isRolling ? '#666' : '#0f3',
            color: isRolling ? '#999' : '#000',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: isRolling ? 'wait' : 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
          }}
        >
          {isRolling ? '⛛ Rolling...' : '♦ Roll the Dice'}
        </button>
      )}

      {/* Result Display */}
      {result && (
        <div
          style={{
            animation: 'fadeIn 0.5s ease-in',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 }
            }
          }}
        >
          <div
            style={{
              backgroundColor: result.success ? '#1a3a1a' : '#3a1a1a',
              border: `2px solid ${result.success ? '#4ade80' : '#ef4444'}`,
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '12px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: result.success ? '#4ade80' : '#ef4444',
                marginBottom: '8px'
              }}
            >
              {result.resultMessage}
            </div>
            <div style={{ fontSize: '10px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
              {result.detailedBreakdown}
            </div>
          </div>

          {/* M39 Task 1: Critical Visual Prompt Display */}
          {result.criticalVisual?.triggered && result.criticalVisual.moment && (
            <div
              style={{
                backgroundColor: '#2a1a3a',
                border: '2px solid #c084fc',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '12px',
                fontSize: '10px'
              }}
            >
              <div
                style={{
                  color: '#c084fc',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}
              >
                ✨ {result.criticalVisual.moment.type.replace('-', ' ')}
              </div>
              <div style={{ color: '#a78bfa', marginBottom: '6px' }}>
                {result.criticalVisual.moment.description}
              </div>
              {result.criticalVisual.promptData && (
                <div style={{ color: '#888', whiteSpace: 'pre-wrap', fontSize: '9px', marginTop: '8px' }}>
                  <div style={{ borderTop: '1px solid #555', paddingTop: '6px', fontStyle: 'italic' }}>
                    Visual: {String(result.criticalVisual.promptData.mainScene).substring(0, 120)}...
                  </div>
                </div>
              )}
              <div style={{ fontSize: '8px', color: '#666', marginTop: '6px' }}>
                {result.criticalVisual.cachedPrompt ? '(cached)' : '(new)'}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setDiceValue(0);
              setDisplayedRoll(0);
            }}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#2d3748',
              color: '#e0e0e0',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            ✓ Confirm Resolution
          </button>
        </div>
      )}
    </div>
  );
};

export default DiceAltar;
