/**
 * FloatingItemTooltip Component
 * 
 * Hover-based tooltip for displaying detailed item information.
 * Features:
 * - Dynamic positioning (follows mouse or anchors to slot)
 * - Item rarity color highlighting
 * - Stat bonus display with +/- indicators
 * - Level and attribute requirements
 * - Paradox cost for artifacts
 * - Item type badges
 * - Smooth fade in/out animations
 * 
 * Phase 3: Item information onmouseover display
 */

import React, { useMemo } from 'react';
import type { PlayerState } from '../../engine/worldEngine';
import { usePlayerTheme } from '../hooks/usePlayerTheme';

export interface ItemTooltipData {
  itemId: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'artifact';
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'quest';
  description: string;
  statBonus?: {
    str?: number;
    agi?: number;
    int?: number;
    cha?: number;
    end?: number;
    luk?: number;
    perception?: number;
  };
  requirements?: {
    minimumLevel?: number;
    str?: number;
    agi?: number;
    int?: number;
    cha?: number;
    end?: number;
    luk?: number;
    perception?: number;
  };
  paradoxCost?: number;
  quantity?: number;
  stackable?: boolean;
  maxStack?: number;
  value?: number; // Gold value
}

export interface FloatingItemTooltipProps {
  item: ItemTooltipData | null;
  visible: boolean;
  mousePos?: { x: number; y: number };
  anchorPos?: { x: number; y: number; width: number; height: number };
  player: PlayerState;
}

const STAT_NAMES: Record<string, string> = {
  str: 'Strength',
  agi: 'Agility',
  int: 'Intelligence',
  cha: 'Charisma',
  end: 'Endurance',
  luk: 'Luck',
  perception: 'Perception',
};

export const FloatingItemTooltip: React.FC<FloatingItemTooltipProps> = ({
  item,
  visible,
  mousePos,
  anchorPos,
  player,
}) => {
  const theme = usePlayerTheme(player?.theme);

  // Calculate tooltip position
  const tooltipPos = useMemo(() => {
    let x = 0;
    let y = 0;

    if (anchorPos) {
      // Anchor to item slot (bottom of slot, centered)
      x = anchorPos.x + anchorPos.width / 2;
      y = anchorPos.y + anchorPos.height + 8;
    } else if (mousePos) {
      // Follow mouse with offset
      x = mousePos.x + 12;
      y = mousePos.y - 12;
    }

    return { x, y };
  }, [mousePos, anchorPos]);

  // Check if requirements are met
  const requirementsMet = useMemo(() => {
    if (!item?.requirements) return true;

    const currentLevel = player?.level || 1;
    const playerStats = player?.stats || {};

    const minLevelMet = !item.requirements.minimumLevel || currentLevel >= item.requirements.minimumLevel;

    const statsMet = Object.entries(item.requirements).every(([stat, required]) => {
      if (stat === 'minimumLevel') return true;
      const playerStatValue = playerStats[stat as keyof typeof playerStats] || 0;
      return playerStatValue >= required;
    });

    return minLevelMet && statsMet;
  }, [item, player]);

  // Get rarity color scheme
  const getRarityStyle = (rarity: string) => {
    const rarityMap: Record<string, { color: string; bg: string; border: string }> = {
      common: {
        color: theme.colors.rarity.common,
        bg: theme.colors.rarity.common + '11',
        border: theme.colors.rarity.common + '44',
      },
      uncommon: {
        color: theme.colors.rarity.uncommon,
        bg: theme.colors.rarity.uncommon + '11',
        border: theme.colors.rarity.uncommon + '44',
      },
      rare: {
        color: theme.colors.rarity.rare,
        bg: theme.colors.rarity.rare + '11',
        border: theme.colors.rarity.rare + '44',
      },
      epic: {
        color: theme.colors.rarity.epic,
        bg: theme.colors.rarity.epic + '11',
        border: theme.colors.rarity.epic + '44',
      },
      legendary: {
        color: theme.colors.rarity.legendary,
        bg: theme.colors.rarity.legendary + '11',
        border: theme.colors.rarity.legendary + '44',
      },
      artifact: {
        color: theme.colors.rarity.artifact,
        bg: theme.colors.rarity.artifact + '11',
        border: theme.colors.rarity.artifact + '44',
      },
    };

    return rarityMap[rarity] || rarityMap.common;
  };

  const rarityStyle = item ? getRarityStyle(item.rarity) : null;

  if (!item || !visible) {
    return null;
  }

  // =========================================================================
  // STYLES
  // =========================================================================

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${tooltipPos.x}px`,
    top: `${tooltipPos.y}px`,
    transform: 'translate(-50%, 0)',
    padding: '12px',
    backgroundColor: theme.colors.secondary,
    border: `2px solid ${rarityStyle.border}`,
    borderRadius: '8px',
    minWidth: '240px',
    maxWidth: '320px',
    fontSize: '12px',
    color: theme.colors.text,
    fontFamily: theme.fonts.primary,
    boxShadow: theme.shadows.heavy,
    zIndex: 1001,
    backdropFilter: 'blur(4px)',
    animation: 'tooltip-fade-in 0.15s ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${rarityStyle.border}`,
  };

  const nameStyle: React.CSSProperties = {
    fontWeight: 700,
    color: rarityStyle.color,
    fontSize: '13px',
  };

  const rarityBadgeStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: rarityStyle.bg,
    color: rarityStyle.color,
    padding: '2px 6px',
    borderRadius: '3px',
    border: `1px solid ${rarityStyle.border}`,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const typeBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: theme.colors.primary + '44',
    color: theme.colors.textAccent,
    padding: '2px 6px',
    borderRadius: '3px',
    border: `1px solid ${theme.colors.primary}88`,
    textTransform: 'uppercase',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${theme.colors.border}44`,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontSize: '11px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const statBonusStyle = (value: number): React.CSSProperties => {
    const isPositive = value > 0;
    return {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: isPositive ? theme.colors.success : theme.colors.error,
      marginBottom: '3px',
    };
  };

  const requirementStyle = (isMet: boolean): React.CSSProperties => {
    return {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: isMet ? theme.colors.textSecondary : theme.colors.error,
      marginBottom: '3px',
      opacity: isMet ? 1 : 0.7,
      textDecoration: isMet ? 'none' : 'line-through',
    };
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: '8px',
    lineHeight: '1.4',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '10px',
    color: theme.colors.textSecondary,
    paddingTop: '6px',
    borderTop: `1px solid ${theme.colors.border}44`,
  };

  return (
    <>
      <style>{`
        @keyframes tooltip-fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -8px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>

      <div style={containerStyle}>
        {/* HEADER: Name + Rarity */}
        <div style={headerStyle}>
          <div style={nameStyle}>{item.name}</div>
          <div style={rarityBadgeStyle}>{item.rarity}</div>
        </div>

        {/* Type Badge */}
        <div style={typeBadgeStyle}>{item.type}</div>

        {/* DESCRIPTION */}
        {item.description && <div style={descriptionStyle}>{item.description}</div>}

        {/* STAT BONUSES */}
        {item.statBonus && Object.keys(item.statBonus).length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Stat Bonuses</div>
            {Object.entries(item.statBonus).map(([stat, bonus]) => {
              if (bonus === 0 || bonus === undefined) return null;
              return (
                <div key={stat} style={statBonusStyle(bonus)}>
                  <span>+{STAT_NAMES[stat] || stat}</span>
                  <span style={{ fontWeight: 700 }}>{bonus > 0 ? '+' : ''}{bonus}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* REQUIREMENTS */}
        {item.requirements && Object.keys(item.requirements).length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Requirements</div>
            {item.requirements.minimumLevel && (
              <div style={requirementStyle(player?.level ? player.level >= item.requirements.minimumLevel : false)}>
                <span>Level</span>
                <span>{item.requirements.minimumLevel}+</span>
              </div>
            )}
            {Object.entries(item.requirements).map(([stat, required]) => {
              if (stat === 'minimumLevel' || !required) return null;
              const playerStatValue = player?.stats?.[stat as keyof typeof player.stats] || 0;
              const isMet = playerStatValue >= required;
              return (
                <div key={stat} style={requirementStyle(isMet)}>
                  <span>{STAT_NAMES[stat] || stat}</span>
                  <span>
                    {playerStatValue}/{required}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* PARADOX COST */}
        {item.paradoxCost && item.paradoxCost > 0 && (
          <div style={sectionStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: theme.colors.warning,
              }}
            >
              <span style={sectionLabelStyle}>Paradox Cost</span>
              <span style={{ fontWeight: 700 }}>{item.paradoxCost}</span>
            </div>
          </div>
        )}

        {/* FOOTER: Value + Quantity */}
        <div style={footerStyle}>
          {item.value && (
            <span>
              💰 {item.value}
              {item.stackable && item.quantity && item.quantity > 1 && ` (× ${item.quantity})`}
            </span>
          )}
          {!requirementsMet && (
            <span style={{ color: theme.colors.error, fontWeight: 700 }}>⚠️ Cannot equip</span>
          )}
        </div>
      </div>
    </>
  );
};

export default FloatingItemTooltip;
