/**
 * Phase 43: Diegetic Stat Sheet Component
 * 
 * A physical, codec-aware character sheet that sits on the 3D tabletop.
 * Updated in real-time with proficiency data from worldState.
 * 
 * Visual Themes:
 * - Medieval: Weathered parchment with wax seal
 * - Cyberpunk: Cracked glass tablet with neon scanning lines
 * - Noir: Weathered manila folder with typewriter fonts and coffee stains
 * - Others: Codec-specific material definitions from themeManager
 * 
 * Displays all 11 proficiency categories with:
 * - Real-time level/XP sync from engine
 * - Passion indicators (codec-specific icons)
 * - Decay warnings for elite skills
 * - Material-based styling for diegetic immersion
 */

import React, { useMemo } from 'react';
import SkillRow from './SkillRow';
import { themeManager } from '../services/themeManager';
import { getProficiencySummary } from '../../engine/proficiencyEngine';
import type { WorldState } from '../../engine/worldEngine';
import type { NarrativeCodec } from '../services/themeManager';

interface DiegeticStatSheetProps {
  worldState?: WorldState;
  currentCodec?: NarrativeCodec;
}

export default function DiegeticStatSheet({
  worldState,
  currentCodec
}: DiegeticStatSheetProps) {
  const codecName = currentCodec || (themeManager.getCodec() as NarrativeCodec);
  const codecDef = themeManager.getCodecDefinition(codecName);
  const player = worldState?.player;

  // Get proficiency summaries for display
  const proficiencySummaries = useMemo(() => {
    if (!player || !player.proficiencies) return [];
    
    try {
      return getProficiencySummary(player);
    } catch (e) {
      console.warn('[DiegeticStatSheet] Error getting proficiency summary:', e);
      return [];
    }
  }, [player]);

  // Determine sheet styling based on codec
  const sheetStyle = useMemo<React.CSSProperties>(() => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      borderRadius: '8px',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      background: 'rgba(15, 15, 30, 0.4)',
      transform: 'translateZ(50px)',
      perspective: '1000px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      maxHeight: '600px',
      overflow: 'hidden'
    };

    // Apply codec-specific material styling
    if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(244, 228, 188, 0.15), rgba(200, 180, 140, 0.1))',
        border: '2px solid rgba(139, 99, 45, 0.5)',
        borderRadius: '4px',
        boxShadow: '0 8px 32px rgba(139, 99, 45, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        color: 'rgba(200, 180, 140, 0.9)'
      };
    } else if (codecName === 'CODENAME_CYBERPUNK' || codecName === 'CODENAME_GLITCH') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(50, 0, 100, 0.4))',
        border: '1px solid rgba(0, 255, 255, 0.5)',
        borderRadius: '2px',
        boxShadow: '0 0 16px rgba(0, 255, 255, 0.3), inset 0 0 16px rgba(0, 255, 255, 0.1)',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)',
        filter: codecName === 'CODENAME_GLITCH' ? 'drop-shadow(2px 2px 0 rgba(255, 0, 255, 0.3))' : 'none'
      };
    } else if (codecName === 'CODENAME_NOIR') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(100, 80, 60, 0.2), rgba(60, 50, 40, 0.2))',
        border: '2px solid rgba(100, 80, 60, 0.5)',
        borderRadius: '2px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.3)',
        opacity: 0.95
      };
    }

    return baseStyle;
  }, [codecName]);

  // Header styling based on codec
  const headerStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
      marginBottom: '12px'
    };

    if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        ...base,
        borderBottom: '1px solid rgba(139, 99, 45, 0.4)',
        fontFamily: '"Crimson Text", serif'
      };
    } else if (codecName === 'CODENAME_NOIR') {
      return {
        ...base,
        borderBottom: '1px dashed rgba(100, 80, 60, 0.5)',
        fontFamily: '"Courier Prime", monospace',
        letterSpacing: '0.5px'
      };
    }

    return base;
  }, [codecName]);

  // Scroll container for skills
  const scrollContainerStyle = useMemo<React.CSSProperties>(() => ({
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingRight: '4px',
    // Thin scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(139, 92, 246, 0.5) rgba(20, 20, 40, 0.3)'
  }), []);

  // Player name styling
  const titleStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 700,
      color: 'rgba(230, 230, 250, 0.9)',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
    };

    if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        ...base,
        fontSize: '16px',
        color: 'rgba(139, 99, 45, 0.9)',
        fontStyle: 'italic',
        fontFamily: '"Crimson Text", serif'
      };
    } else if (codecName === 'CODENAME_NOIR') {
      return {
        ...base,
        fontSize: '14px',
        letterSpacing: '1px',
        fontFamily: '"Courier Prime", monospace',
        color: 'rgba(150, 130, 110, 0.9)'
      };
    }

    return base;
  }, [codecName]);

  // Level counter styling
  const levelStyle = useMemo<React.CSSProperties>(() => ({
    fontSize: '12px',
    color: 'rgba(168, 85, 247, 0.7)',
    fontWeight: 600,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
  }), []);

  if (!player || !player.proficiencies || proficiencySummaries.length === 0) {
    return (
      <div style={sheetStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>Character Sheet</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '120px',
          color: 'rgba(139, 92, 246, 0.4)',
          fontSize: '12px'
        }}>
          No proficiency data
        </div>
      </div>
    );
  }

  return (
    <div style={sheetStyle}>
      {/* Header with player name and level summary */}
      <div style={headerStyle}>
        <span style={titleStyle}>
          {player.name || 'Adventurer'}'s Record
        </span>
        <span style={levelStyle}>
          Skills: {proficiencySummaries.length}
        </span>
      </div>

      {/* Scrollable skills list */}
      <div style={scrollContainerStyle}>
        {proficiencySummaries.map((prof) => (
          <SkillRow
            key={prof.category}
            skillName={prof.category}
            currentLevel={prof.level}
            currentXp={prof.xp}
            xpForNextLevel={prof.xpToNextLevel}
            passion={prof.passion}
            isDecaying={prof.isDecaying}
            currentCodec={codecName}
          />
        ))}
      </div>

      {/* Footer: Total mastery count */}
      <div style={{
        paddingTop: '8px',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        fontSize: '11px',
        color: 'rgba(139, 92, 246, 0.5)',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        {proficiencySummaries.filter(p => p.level >= 10).length} mastered, {proficiencySummaries.filter(p => p.level >= 20).length} legend
      </div>
    </div>
  );
}
