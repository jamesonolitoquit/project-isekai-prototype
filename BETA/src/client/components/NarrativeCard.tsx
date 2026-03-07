/**
 * Phase 38: NarrativeCard Component
 * Phase 43: Extended with Learning Potential indicators
 * 
 * 3D physical card with CSS transforms
 * - CSS 3D flip animation on hover
 * - Material-aware styling based on codec theme
 * - Displays ability title, cost, effect, rarity
 * - Accessible (no WebGL, DOM-based)
 * - Phase 43: Shows learning potential passion indicators
 * 
 * Features:
 * - rotateY transform for flip effect
 * - Front: card face (title, glyph, effect)
 * - Back: ability flavor text
 * - Hover lift: translateZ(+20px)
 * - Rarity glow: legendary > rare > uncommon > common
 * - Learning passion icons: fire flames for passion bonus
 */

import React, { useState } from 'react';
import type { NarrativeCard } from '../../engine/narrativeCardRegistry';

interface NarrativeCardProps {
  card: NarrativeCard;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onHover?: (isHovering: boolean) => void;
  isPlayable?: boolean;
  learningPotential?: {
    skillName?: string;
    passionLevel?: 0 | 1 | 2;  // 0 = cold, 1 = normal, 2 = burning
    xpPotential?: number;      // Base XP this card could grant
  };
}

export default function NarrativeCardComponent({
  card,
  isSelected = false,
  isHighlighted = false,
  onClick,
  onHover,
  isPlayable = true,
  learningPotential
}: NarrativeCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Passion icons for learning potential indicator
  const passionIcons = ['❄️', '🔥', '🔥🔥'];
  const passionLevel = learningPotential?.passionLevel ?? 1;

  const rarityColors: Record<string, { glow: string; border: string; background: string }> = {
    common: { glow: 'rgba(100, 100, 100, 0.3)', border: 'rgba(150, 150, 150, 0.4)', background: 'rgba(50, 50, 50, 0.1)' },
    uncommon: { glow: 'rgba(0, 200, 0, 0.3)', border: 'rgba(0, 255, 0, 0.5)', background: 'rgba(0, 100, 0, 0.1)' },
    rare: { glow: 'rgba(0, 0, 255, 0.4)', border: 'rgba(0, 100, 255, 0.6)', background: 'rgba(0, 50, 150, 0.15)' },
    legendary: { glow: 'rgba(255, 200, 0, 0.5)', border: 'rgba(255, 215, 0, 0.8)', background: 'rgba(150, 100, 0, 0.2)' }
  };

  const rarity = rarityColors[card.rarity] || rarityColors['common'];

  return (
    <div
      style={{
        perspective: '1200px',
        width: '140px',
        height: '200px',
        cursor: isPlayable ? 'pointer' : 'not-allowed',
        position: 'relative',
        filter: isPlayable ? 'opacity(1)' : 'opacity(0.5) grayscale(0.3)',
        transform: isHovering ? 'translateZ(20px) scale(1.05)' : 'translateZ(0px)',
        transition: 'transform 0.2s ease-out',
        userSelect: 'none'
      }}
      onMouseEnter={() => {
        if (isPlayable) {
          setIsHovering(true);
          onHover?.(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        onHover?.(false);
      }}
      onClick={() => {
        if (isPlayable) {
          setIsFlipped(!isFlipped);
          onClick?.();
        }
      }}
    >
      {/* 3D Flip Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transition: isFlipped ? 'transform 0.4s' : 'transform 0.2s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* FRONT FACE - Card Display */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            background: card.materialProfile.background,
            border: `2px solid ${card.materialProfile.borderColor}`,
            borderRadius: '12px',
            padding: '10px',
            boxShadow: `0 0 20px ${rarity.glow}, ${isSelected ? '0 0 30px rgba(200, 100, 255, 0.8)' : '0 4px 12px rgba(0, 0, 0, 0.4)'}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Rarity indicator stripe */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: rarity.border,
              backgroundImage: 
                card.rarity === 'legendary' 
                  ? 'linear-gradient(90deg, gold 0%, yellow 50%, gold 100%)'
                  : 'linear-gradient(90deg, transparent, ' + rarity.border + ', transparent)'
            }}
          />

          {/* Header: Glyph + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '30px' }}>
            <div style={{ fontSize: '20px', lineHeight: 1 }}>
              {card.materialProfile.glyphEmoji}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: card.materialProfile.textColor,
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {card.cardTitle}
            </div>
          </div>

          {/* Middle: Effect Summary */}
          <div
            style={{
              fontSize: '9px',
              color: card.materialProfile.accentColor,
              fontStyle: 'italic',
              textAlign: 'center',
              lineHeight: '1.3',
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}
          >
            {card.effectSummary}
          </div>

          {/* Footer: Cost + Cooldown + Learning Potential */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '9px',
              color: card.materialProfile.textColor,
              borderTop: `1px solid ${card.materialProfile.borderColor}`,
              paddingTop: '6px'
            }}
          >
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span title="Mana cost">💙</span>
              <span>{card.manaCost}</span>
            </div>
            
            {/* Phase 43: Learning Potential Indicator */}
            {learningPotential?.skillName && (
              <div
                title={`${learningPotential.skillName} XP: ${learningPotential.xpPotential || '?'} potential`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 4px',
                  background: passionLevel > 1 
                    ? 'rgba(255, 100, 100, 0.3)' 
                    : 'rgba(100, 100, 255, 0.2)',
                  borderRadius: '2px',
                  fontSize: '8px'
                }}
              >
                <span>{passionIcons[passionLevel]}</span>
              </div>
            )}
            
            <div
              style={{
                padding: '2px 6px',
                background: card.materialProfile.borderColor,
                borderRadius: '3px',
                color: card.materialProfile.accentColor,
                fontWeight: 'bold'
              }}
            >
              {card.rarity.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span title="Cooldown ticks">⏱️</span>
              <span>{card.cooldownTicks}</span>
            </div>
          </div>

          {/* Selection highlight */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                inset: '2px',
                borderRadius: '10px',
                border: '2px solid rgba(200, 100, 255, 0.8)',
                pointerEvents: 'none',
                background: 'rgba(200, 100, 255, 0.1)',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            />
          )}

          {/* Highlight for playable state */}
          {isHighlighted && (
            <div
              style={{
                position: 'absolute',
                inset: '1px',
                borderRadius: '11px',
                border: '2px dashed rgba(100, 200, 255, 0.6)',
                pointerEvents: 'none'
              }}
            />
          )}
        </div>

        {/* BACK FACE - Flavor Text */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, ' + card.materialProfile.background + ' 0%, rgba(30, 30, 30, 0.5) 100%)',
            border: `2px solid ${card.materialProfile.borderColor}`,
            borderRadius: '12px',
            padding: '12px',
            boxShadow: `0 0 20px ${rarity.glow}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Codec Label */}
          <div
            style={{
              fontSize: '8px',
              color: card.materialProfile.accentColor,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              opacity: 0.7
            }}
          >
            [{card.codecId}]
          </div>

          {/* Flavor Text */}
          <div
            style={{
              fontSize: '10px',
              color: card.materialProfile.textColor,
              lineHeight: '1.4',
              fontStyle: 'italic',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            {card.cardDescription}
          </div>

          {/* Flip instruction */}
          <div
            style={{
              fontSize: '8px',
              color: card.materialProfile.accentColor,
              textAlign: 'center',
              opacity: 0.6,
              letterSpacing: '1px'
            }}
          >
            ← CLICK TO FLIP →
          </div>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
