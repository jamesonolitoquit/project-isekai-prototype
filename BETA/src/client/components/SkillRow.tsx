/**
 * Phase 43: Skill Row Component
 * 
 * Displays a single skill with:
 * - Skill name and current level (0-20)
 * - Passion indicator (0, 1, or 2 flames/icons)
 * - Segmented progress bar (20 segments representing mastery progression)
 * - Decay warning for elite levels (11-20)
 * - Sub-pixel XP progress line toward next level
 * - Codec-aware styling for thematic presentation
 */

import React, { useMemo } from 'react';
import { themeManager } from '../services/themeManager';
import type { NarrativeCodec } from '../services/themeManager';

interface SkillRowProps {
  skillName: string;
  currentLevel: number;        // 0-20
  currentXp: number;           // Total XP in this skill
  xpForNextLevel: number;      // XP needed to reach next level
  passion?: 0 | 1 | 2;         // 0=cold, 1=normal, 2=burning
  isDecaying?: boolean;        // Is this skill currently losing XP?
  lastUsageTick?: number;      // Last tick used (for decay visualization)
  currentCodec?: NarrativeCodec;
}

export default function SkillRow({
  skillName,
  currentLevel,
  currentXp,
  xpForNextLevel,
  passion = 1,
  isDecaying = false,
  lastUsageTick,
  currentCodec
}: SkillRowProps) {
  const codecName = currentCodec || (themeManager.getCodec() as NarrativeCodec);
  const codecDef = themeManager.getCodecDefinition(codecName);
  
  // Get passion icons from codec definition
  const passionIcons = useMemo(() => {
    const icons = codecDef.passionIcons || {
      low: '❄️',
      medium: '🔥',
      high: '🔥🔥'
    };
    return [icons.low || '○', icons.medium || '◐', icons.high || '●'];
  }, [codecDef.passionIcons]);

  // Calculate XP progress as percentage (0-100)
  const xpProgress = useMemo(() => {
    if (xpForNextLevel <= 0) return 0;
    return Math.min(100, (currentXp / xpForNextLevel) * 100);
  }, [currentXp, xpForNextLevel]);

  // Determine which segments are filled (0-20 scale)
  const filledSegments = Math.floor(currentLevel);
  const partialSegment = currentLevel % 1; // Decimal portion for interpolation

  // Render segmented progress bar
  const segments = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const segmentIndex = i;
      const isElite = segmentIndex >= 10; // Segments 11-20 are "Elite Mastery"
      const isFilled = segmentIndex < filledSegments;
      const isPartial = segmentIndex === filledSegments && partialSegment > 0;
      const isDecayingSegment = isElite && isDecaying;

      return (
        <div
          key={segmentIndex}
          style={{
            flex: 1,
            height: '12px',
            background: isFilled
              ? isDecayingSegment
                ? 'radial-gradient(circle, rgba(139,92,246,0.8), rgba(139,92,246,0.3))'
                : 'rgba(139, 92, 246, 0.9)'
              : isPartial
              ? `linear-gradient(90deg, rgba(139, 92, 246, ${partialSegment * 0.9}), rgba(139, 92, 246, 0))`
              : 'rgba(50, 50, 80, 0.4)',
            border: isElite
              ? '1px solid rgba(236, 72, 153, 0.5)' // Elite segments have pink/magenta border
              : '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '2px',
            marginRight: i < 19 ? '2px' : '0',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease-out',
            animation: isDecayingSegment ? 'entropic-pulse 2s ease-in-out infinite' : 'none'
          }}
        >
          {/* Sub-pixel XP progress line */}
          {isFilled && (
            <div
              style={{
                position: 'absolute',
                height: '100%',
                width: '2px',
                background: 'rgba(255, 200, 100, 0.8)',
                left: 0,
                top: 0,
                boxShadow: '0 0 4px rgba(255, 200, 100, 0.6)'
              }}
            />
          )}
        </div>
      );
    });
  }, [filledSegments, partialSegment, isDecaying]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px',
        borderRadius: '4px',
        background: 'rgba(20, 20, 40, 0.5)',
        borderLeft: `3px solid rgba(139, 92, 246, 0.6)`,
        backdropFilter: 'blur(2px)'
      }}
    >
      {/* Header: Skill name + Passion icons + Level */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(230, 230, 250, 0.9)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
          }}>
            {skillName}
          </span>
          {/* Passion indicator */}
          <span 
            title={`Passion: ${passion === 0 ? 'Cold' : passion === 1 ? 'Normal' : 'Burning'}`}
            style={{
              fontSize: '10px',
              opacity: passion > 0 ? 0.9 : 0.5,
              cursor: 'help'
            }}>
            {passionIcons[passion]}
          </span>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'rgba(168, 85, 247, 0.8)',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
        }}>
          {currentLevel.toFixed(1)}/20
        </span>
      </div>

      {/* Segmented progress bar */}
      <div
        style={{
          display: 'flex',
          gap: '0px',
          alignItems: 'center',
          height: '14px',
          background: 'rgba(10, 10, 20, 0.6)',
          padding: '2px',
          borderRadius: '2px',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}
      >
        {segments}
      </div>

      {/* XP Progress indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '10px'
      }}>
        <div style={{
          flex: 1,
          height: '2px',
          background: `linear-gradient(90deg, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, ${xpProgress / 100 * 0.8}) ${xpProgress}%, rgba(50, 50, 80, 0.3) ${xpProgress}%, rgba(50, 50, 80, 0.3) 100%)`,
          borderRadius: '1px',
          marginRight: '8px'
        }} />
        <span style={{
          color: 'rgba(139, 92, 246, 0.7)',
          whiteSpace: 'nowrap'
        }}>
          {Math.round(xpProgress)}%
        </span>
      </div>

      {/* Decay warning for elite skills */}
      {isDecaying && currentLevel > 10 && (
        <div style={{
          fontSize: '9px',
          color: 'rgba(236, 72, 153, 0.8)',
          fontStyle: 'italic',
          opacity: 0.7,
          userSelect: 'none'
        }}>
          ⚠ Skill decaying - use to maintain mastery
        </div>
      )}
    </div>
  );
}

// Add CSS animation for entropic pulse
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes entropic-pulse {
      0%, 100% { opacity: 0.6; box-shadow: inset 0 0 0 1px rgba(236, 72, 153, 0.3); }
      50% { opacity: 0.9; box-shadow: inset 0 0 4px 1px rgba(236, 72, 153, 0.5); }
    }
  `;
  document.head.appendChild(styleSheet);
}
