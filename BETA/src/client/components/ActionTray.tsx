/**
 * Phase 38/39: ActionTray Component
 * 
 * Displays player's hand of narrative cards in a "fan-out" layout
 * - Cards overlap slightly, arranged in arc
 * - Lift on hover (translateZ)
 * - Plays selected card when clicked
 * - Shows deck/discard count + AP meter (Phase 39)
 * - Integrated with turn-based heartbeat (Phase 37)
 * 
 * Layout:
 * - Container: width 450px, height 180px (fixed)
 * - Cards: 140px wide, 200px tall, slight overlap
 * - Arc angle: ~20° total spread
 * 
 * Phase 39 Changes:
 * - Display AP meter with current/max AP
 * - Accept optional GameContext with worldState/dispatch
 * - Show card AP costs and validation feedback
 */

import React, { useCallback, useEffect, useContext } from 'react';
import NarrativeCard from './NarrativeCard';
import { usePlayerHand, type PlayerHandContextDeps } from '../hooks/usePlayerHand';
import { getGlobalBurstEmitter } from './ParticleSurface';

// Optional: GameContext for engine integration (Phase 39)
// For now, we'll pass deps as props
interface ActionTrayProps {
  engineContext?: PlayerHandContextDeps;
}

export default function ActionTray({ engineContext }: ActionTrayProps) {
  const { hand, playCard, selectCard, canPlayCard } = usePlayerHand(engineContext);

  // Emit particle burst when card is played for visual feedback
  const playCardWithEffects = useCallback(async (cardIndex: number) => {
    try {
      // Validate before attempting to play
      const validation = canPlayCard(cardIndex);
      if (!validation.canPlay) {
        console.warn(`[ActionTray] Cannot play card: ${validation.reason}`);
        // Optional: Shake animation or error flash
        return;
      }

      // Emit particle burst at center of tray
      const emitter = getGlobalBurstEmitter();
      emitter?.emitBurst(225, 100, 'spell-impact', 0.8);

      // Play card
      await playCard(cardIndex);
    } catch (err) {
      console.error('[ActionTray] Error playing card:', err);
    }
  }, [playCard, canPlayCard]);

  // Calculate card position in fan-out arc layout
  const getCardTransform = (index: number, total: number): string => {
    if (total === 0) return 'translate(0, 0)';
    
    // Spread cards across 20° arc
    const maxAngle = 20; // degrees
    const angle = (index - (total - 1) / 2) * (maxAngle / Math.max(total - 1, 1));
    const rotation = angle * 0.3; // Subtle rotation per card
    const yOffset = Math.abs(angle) * 0.5; // Cards at edges lift slightly

    // Arrange horizontally with slight overlap
    const cardWidth = 140;
    const overlap = cardWidth * 0.25; // 25% overlap
    const xPos = index * (cardWidth - overlap);

    return `translate(${xPos}px, ${yOffset}px) rotateZ(${rotation}deg)`;
  };

  // Phase 39: Determine AP meter color based on availability
  const getApMeterColor = (): string => {
    if (hand.ap === 0) return '#ef4444'; // Red: no AP
    if (hand.ap <= hand.maxAp * 0.33) return '#f97316'; // Orange: low AP
    if (hand.ap <= hand.maxAp * 0.66) return '#eab308'; // Yellow: medium AP
    return '#22c55e'; // Green: full AP
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%'
      }}
    >
      {/* Header: Deck stats, AP meter, and codec indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
          color: '#a855f7',
          letterSpacing: '1px',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}
      >
        {/* Deck stats */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span title="Deck remaining">📚 {hand.deckRemaining}</span>
          <span title="Discard pile">🗑️ {hand.discardCount}</span>
        </div>

        {/* Phase 39: AP Meter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: 'rgba(168, 85, 247, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
          title={`Action Points: ${hand.ap}/${hand.maxAp}`}
        >
          <span style={{ fontSize: '10px' }}>⚡</span>
          <div
            style={{
              display: 'flex',
              gap: '2px',
              alignItems: 'center'
            }}
          >
            {Array.from({ length: hand.maxAp }).map((_, i) => (
              <div
                key={`ap-${i}`}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: i < hand.ap ? getApMeterColor() : '#333',
                  border: '1px solid ' + (i < hand.ap ? getApMeterColor() : '#555'),
                  transition: 'background 0.2s'
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: '9px', marginLeft: '4px' }}>{hand.ap}/{hand.maxAp}</span>
        </div>

        {/* Codec indicator */}
        <div
          style={{
            fontSize: '9px',
            padding: '2px 8px',
            background: 'rgba(168, 85, 247, 0.2)',
            borderRadius: '4px',
            border: '1px solid rgba(168, 85, 247, 0.4)',
          }}
        >
          {hand.activeCodec.toUpperCase()}
        </div>
      </div>

      {/* Card container with fan-out layout */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '220px',
          perspective: '1000px',
          display: 'flex',
          alignItems: 'flex-end',
          paddingBottom: '20px'
        }}
      >
        {hand.currentHand.length === 0 ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic'
            }}
          >
            No cards in hand. Waiting for draw phase...
          </div>
        ) : (
          hand.currentHand.map((card, index) => (
            <div
              key={`${card.abilityId}-${index}`}
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                zIndex: hand.selectedCardIndex === index ? 10 : hand.currentHand.length - index,
                transform: getCardTransform(index, hand.currentHand.length),
                transition: 'transform 0.2s ease-out, z-index 0.2s',
                cursor: 'pointer'
              }}
            >
              <NarrativeCard
                card={card}
                isSelected={hand.selectedCardIndex === index}
                isHighlighted={hand.selectedCardIndex === null} // Highlight all cards when no selection
                onClick={() => {
                  if (hand.selectedCardIndex === index) {
                    // Double-click: play card
                    playCardWithEffects(index);
                  } else {
                    // Single-click: select card
                    selectCard(index);
                  }
                }}
                isPlayable={!hand.isPlayingCard}
              />
            </div>
          ))
        )}
      </div>

      {/* Action instructions */}
      <div
        style={{
          fontSize: '9px',
          color: '#888',
          textAlign: 'center',
          fontStyle: 'italic',
          letterSpacing: '0.5px'
        }}
      >
        {hand.selectedCardIndex !== null
          ? '✓ Click again to play card'
          : 'Click card to preview, click again to play'}
      </div>

      {/* Last played card feedback */}
      {hand.lastPlayedCard && (
        <div
          style={{
            padding: '8px',
            background: 'rgba(100, 200, 100, 0.1)',
            border: '1px solid rgba(100, 200, 100, 0.3)',
            borderRadius: '6px',
            fontSize: '10px',
            color: '#a0d0a0',
            textAlign: 'center'
          }}
        >
          ✓ Played: {hand.lastPlayedCard.cardTitle}
        </div>
      )}
    </div>
  );
}
