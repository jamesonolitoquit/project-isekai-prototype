/**
 * CharacterSheet Component
 * 
 * Displays and manages player character progression.
 * Features:
 * - Core D&D 7 stats (STR, AGI, INT, CHA, END, LUK, PERCEPTION)
 * - Experience and Level tracking
 * - Attribute point allocation system
 * - Stat growth visualization
 * - Ancestry/Bloodline display (optional)
 * - Phase 47: Ancestral Tapestry integration
 * 
 * Phase 3: Full character creation and advancement UI
 */

import React, { useState, useMemo } from 'react';
import type { PlayerState } from '../../engine/worldEngine';
import { useHUDContext } from './PlayerHUDContainer';
import AncestralTapestry from './AncestralTapestry';
import { getAncestryTree } from '../../engine/ancestryRegistry';

export interface CharacterSheetProps {
  player: PlayerState;
  onAllocatePoints?: (statName: string, points: number) => void;
}

const STAT_ORDER: Array<keyof Exclude<PlayerState['stats'], undefined>> = [
  'str',
  'agi',
  'int',
  'cha',
  'end',
  'luk',
  'perception'
];

const STAT_NAMES: Record<string, { short: string; full: string; icon: string; description: string }> = {
  str: {
    short: 'STR',
    full: 'Strength',
    icon: '⚔️',
    description: 'Physical power and melee damage'
  },
  agi: {
    short: 'AGI',
    full: 'Agility',
    icon: '🏃',
    description: 'Speed, dodge, and ranged accuracy'
  },
  int: {
    short: 'INT',
    full: 'Intelligence',
    icon: '🧠',
    description: 'Arcane power and spell effectiveness'
  },
  cha: {
    short: 'CHA',
    full: 'Charisma',
    icon: '💬',
    description: 'Persuasion, deception, and social power'
  },
  end: {
    short: 'END',
    full: 'Endurance',
    icon: '❤️',
    description: 'Health pool and stamina'
  },
  luk: {
    short: 'LUK',
    full: 'Luck',
    icon: '✨',
    description: 'Critical chance and loot quality'
  },
  perception: {
    short: 'PER',
    full: 'Perception',
    icon: '👁️',
    description: 'Awareness and hidden object detection'
  }
};

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ player, onAllocatePoints }) => {
  const { theme } = useHUDContext();
  const [allocating, setAllocating] = useState<string | null>(null);
  const [allocationAmount, setAllocationAmount] = useState(0);
  const [showAncestralTapestry, setShowAncestralTapestry] = useState(false);

  const stats = player.stats || {
    str: 10,
    agi: 10,
    int: 10,
    cha: 10,
    end: 10,
    luk: 10,
    perception: 10
  };

  const attributePoints = player.attributePoints || 0;

  // Phase 47: Get ancestry tree if available
  const ancestryTree = useMemo(() => {
    if (player.ancestryTree) {
      // Note: This would ideally load from the world template
      // For now, we rely on player.ancestryTree being already set
      return null; // Would be loaded from engine context in real implementation
    }
    return null;
  }, [player.ancestryTree]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    color: theme.colors.text,
    fontSize: '14px'
  };

  const sectionStyle: React.CSSProperties = {
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: '12px'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '16px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontFamily: theme.fonts.heading
  };

  const levelInfoStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px'
  };

  const infoBoxStyle: React.CSSProperties = {
    backgroundColor: theme.colors.secondary,
    padding: '10px',
    borderRadius: '4px',
    border: `1px solid ${theme.colors.border}`
  };

  const infoLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontWeight: 600,
    marginBottom: '4px'
  };

  const infoValueStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono
  };

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px'
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: theme.colors.secondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    padding: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const statValueStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  };

  const statNameStyle: React.CSSProperties = {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    fontWeight: 600
  };

  const statNumberStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontFamily: theme.fonts.mono
  };

  const statBarStyle: React.CSSProperties = {
    height: '6px',
    backgroundColor: theme.colors.primary,
    borderRadius: '3px',
    overflow: 'hidden'
  };

  const statFillStyle = (value: number): React.CSSProperties => ({
    height: '100%',
    width: `${Math.min(100, (Math.max(value - 8, 0) / 12) * 100)}%`,
    backgroundColor: theme.colors.accent,
    transition: 'width 0.3s ease'
  });

  // Calculate ability score modifier (D&D 5e style: (score - 10) / 2)
  const getModifier = (score: number): number => Math.floor((score - 10) / 2);

  const xpThreshold = 100 * (player.level || 1);
  const xpProgress = Math.min(100, ((player.xp || 0) / xpThreshold) * 100);

  return (
    <div style={containerStyle}>
      {/* CHARACTER HEADER */}
      <div style={headerStyle}>
        <span>{player.name || 'Character'}</span>
        <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
          Generation {player.generation}
        </span>
      </div>

      {/* LEVEL & PROGRESSION SECTION */}
      <div style={sectionStyle}>
        <div style={levelInfoStyle}>
          <div style={infoBoxStyle}>
            <div style={infoLabelStyle}>Level</div>
            <div style={infoValueStyle}>{player.level || 1}</div>
          </div>
          <div style={infoBoxStyle}>
            <div style={infoLabelStyle}>Experience</div>
            <div style={infoValueStyle}>{player.xp || 0}</div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div style={{ ...statNameStyle, marginBottom: '6px' }}>
          Progress to Level {(player.level || 1) + 1}
        </div>
        <div style={statBarStyle}>
          <div
            style={{
              height: '100%',
              width: `${xpProgress}%`,
              backgroundColor: theme.colors.xp.bar,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* AVAILABLE POINTS */}
      {attributePoints > 0 && (
        <div
          style={{
            ...sectionStyle,
            backgroundColor: theme.colors.primary,
            padding: '12px',
            borderRadius: '4px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
            Available Attribute Points
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: theme.colors.warning }}>
            +{attributePoints}
          </div>
        </div>
      )}

      {/* STATS SECTION */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.textSecondary, marginBottom: '8px' }}>
          CORE ATTRIBUTES
        </div>
        <div style={statsGridStyle}>
          {STAT_ORDER.map((statKey) => {
            const statInfo = STAT_NAMES[statKey] || { short: statKey, full: statKey, icon: '?', description: '' };
            const currentValue = stats[statKey] || 10;
            const modifier = getModifier(currentValue);

            return (
              <div
                key={statKey}
                style={{
                  ...statCardStyle,
                  borderColor: allocating === statKey ? theme.colors.accent : theme.colors.border,
                  backgroundColor: allocating === statKey ? theme.colors.primary : theme.colors.secondary
                }}
                onClick={() => {
                  if (attributePoints > 0) {
                    setAllocating(allocating === statKey ? null : statKey);
                    setAllocationAmount(0);
                  }
                }}
                onMouseEnter={(e) => {
                  if (attributePoints > 0) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primary;
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (allocating !== statKey) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.secondary;
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
                  }
                }}
              >
                {/* Stat Name and Icon */}
                <div style={statValueStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{statInfo.icon}</span>
                    <div style={statNameStyle}>{statInfo.short}</div>
                  </div>
                  <div style={statNumberStyle}>{currentValue}</div>
                </div>

                {/* Stat Bar */}
                <div style={statBarStyle}>
                  <div style={statFillStyle(currentValue)} />
                </div>

                {/* Modifier Display */}
                <div style={{ ...statNameStyle, textAlign: 'center', marginTop: '4px' }}>
                  {modifier >= 0 ? '+' : ''}{modifier}
                </div>

                {/* Allocation Panel */}
                {allocating === statKey && (
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: `1px solid ${theme.colors.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when interacting
                  >
                    <div style={{ ...statNameStyle, textAlign: 'center' }}>
                      Allocate Points
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        style={{
                          flex: 1,
                          padding: '4px',
                          backgroundColor: theme.colors.accent,
                          color: theme.colors.primary,
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                        onClick={() => {
                          if (allocationAmount < attributePoints) {
                            setAllocationAmount(allocationAmount + 1);
                          }
                        }}
                      >
                        +
                      </button>
                      <div
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          fontWeight: 700,
                          color: theme.colors.accent,
                          fontFamily: theme.fonts.mono
                        }}
                      >
                        {allocationAmount}
                      </div>
                      <button
                        style={{
                          flex: 1,
                          padding: '4px',
                          backgroundColor: theme.colors.warning,
                          color: theme.colors.primary,
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                        onClick={() => {
                          onAllocatePoints?.(statKey, allocationAmount);
                          setAllocating(null);
                          setAllocationAmount(0);
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOODLINE / ANCESTRY SECTION */}
      <div style={sectionStyle}>
        {/* Phase 47: Ancestry Information */}
        {player.ancestryTree && (
          <div>
            <div style={{ ...statNameStyle, marginBottom: '8px' }}>ANCESTRAL TAPESTRY</div>
            <div style={{ fontSize: '13px', color: theme.colors.text, marginBottom: '12px' }}>
              <div>
                <strong>Bloodline:</strong> {player.race || 'Unknown'}
              </div>
              <div style={{ marginTop: '4px', color: theme.colors.textSecondary, fontSize: '12px' }}>
                Nodes Unlocked: {player.ancestryNodes?.length || 0}
              </div>
            </div>
            <button
              onClick={() => setShowAncestralTapestry(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: theme.colors.accent,
                color: theme.colors.primary,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              View Tapestry
            </button>
            <div style={{ borderTop: `1px solid ${theme.colors.border}`, marginTop: '12px', paddingTop: '12px' }} />
          </div>
        )}

        {/* Legacy Bloodline Data */}
        {player.bloodlineData && (
          <div>
            <div style={{ ...statNameStyle, marginBottom: '8px' }}>ANCESTRAL LEGACY</div>
            <div style={{ fontSize: '13px', color: theme.colors.text }}>
              <div>
                <strong>Lineage:</strong> {player.bloodlineData.canonicalName}
              </div>
              <div style={{ marginTop: '4px', color: theme.colors.textSecondary, fontSize: '12px' }}>
                Epochs: {player.bloodlineData.epochsLived} | Myth: {player.bloodlineData.mythStatus}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 47: Ancestral Tapestry Modal */}
      {showAncestralTapestry && player.ancestryTree && ancestryTree && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowAncestralTapestry(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AncestralTapestry
              player={player}
              tree={ancestryTree}
              isOpen={showAncestralTapestry}
              codec={player.currentCodec || 'CODENAME_MEDIEVAL'}
              onNodeUnlock={() => {
                // Force re-render to show updated stats
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterSheet;
