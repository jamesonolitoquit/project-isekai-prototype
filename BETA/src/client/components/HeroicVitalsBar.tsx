/**
 * HeroicVitalsBar Component
 * 
 * Displays the hero's core vitals in a stylized bar.
 * Features:
 * - Health (HP): Classic red bar with numeric overlay
 * - Soul Resonance (Mana): Blue/Gold bar for mystical energy
 * - Paradox Gauge: Pulsating meter for temporal corruption
 * - XP/Level Progress: Gold progress bar toward next level
 * - Atmospheric Effects: Responds to paradoxLevel for thematic degradation
 * 
 * Phase 1: Implement persistent HUD display with all four gauges
 */

import React, { useMemo } from 'react';
import styles from '../../styles/diegetic.module.css';
import type { WorldState } from '../../engine/worldEngine';
import type { PlayerState } from '../../engine/worldEngine';
import { usePlayerTheme, type UsePlayerThemeReturn } from '../hooks/usePlayerTheme';
import { useAtmosphericFilter } from '../hooks/useAtmosphericFilter';

export interface HeroicVitalsBarProps {
  player: PlayerState;
  worldState: WorldState;
  playerThemeId?: string;
  position?: 'top' | 'bottom';
  compact?: boolean; // For mobile / reduced UI mode
}

/**
 * Calculate XP required for next level
 * Formula: 100 * level
 */
function getXpThreshold(level: number): number {
  return 100 * level;
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.floor(num).toString();
}

/**
 * Calculate paradox intensity for visual effects
 * 0-25: None
 * 25-50: Mild glow
 * 50-75: Medium pulse
 * 75-100: Severe glitch
 */
function getParadoxIntensity(paradoxLevel: number | undefined): 'none' | 'mild' | 'medium' | 'severe' {
  const level = paradoxLevel ?? 0;
  if (level < 25) return 'none';
  if (level < 50) return 'mild';
  if (level < 75) return 'medium';
  return 'severe';
}

/**
 * Get CSS animation class based on paradox intensity
 */
function getParadoxAnimation(intensity: 'none' | 'mild' | 'medium' | 'severe'): string {
  switch (intensity) {
    case 'mild':
      return 'vitals-paradox-glow-mild';
    case 'medium':
      return 'vitals-paradox-pulse-medium';
    case 'severe':
      return 'vitals-paradox-glitch-severe';
    default:
      return '';
  }
}

export const HeroicVitalsBar: React.FC<HeroicVitalsBarProps> = ({
  player,
  worldState,
  playerThemeId,
  position = 'top',
  compact = false,
}) => {
  const theme = usePlayerTheme(playerThemeId);
  const atmosphericFilters = useAtmosphericFilter({
    paradoxLevel: worldState.paradoxLevel,
    ageRotSeverity: worldState.ageRotSeverity,
  });

  // Calculate gauge values
  const hpPercent = Math.max(0, Math.min(100, ((player.hp ?? 0) / (player.maxHp ?? 1)) * 100));
  const manaPercent = Math.max(
    0,
    Math.min(100, ((player.soulResonanceLevel ?? 0) / 100) * 100)
  );
  const paradoxPercent = Math.max(0, Math.min(100, player.temporalDebt ?? 0));
  const xpThreshold = getXpThreshold(player.level ?? 1);
  const xpPercent = Math.max(0, Math.min(100, ((player.xp ?? 0) / xpThreshold) * 100));

  const paradoxIntensity = getParadoxIntensity(worldState.paradoxLevel);
  const paradoxAnimation = getParadoxAnimation(paradoxIntensity);

  // Memoize styles to avoid recalculation
  const containerStyle = useMemo(
    () => ({
      position: 'fixed' as const,
      [position]: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: compact ? 'column' as const : ('row' as const),
      gap: compact ? '4px' : '8px',
      padding: compact ? '8px 12px' : '12px 16px',
      backgroundColor: '#2a2a2e',
      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)',
      borderBottom: position === 'top' ? '2px solid #5a5a60' : 'none',
      borderTop: position === 'bottom' ? '2px solid #5a5a60' : 'none',
      borderImage: 'linear-gradient(90deg, #4a4a50, #5a5a60, #4a4a50) 1',
      backdropFilter: 'blur(4px)',
      filter: atmosphericFilters.combinedFilter,
      fontFamily: theme.fonts.primary,
      boxShadow: position === 'top' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 -4px 12px rgba(0,0,0,0.4)',
      transition: 'all 0.3s ease-out'
    }),
    [position, theme.colors.background, theme.colors.border, theme.fonts.primary, atmosphericFilters.combinedFilter, compact]
  );

  const gaugeContainerStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: compact ? '3px' : '6px',
      flex: compact ? 'none' : 1,
      minWidth: compact ? 'auto' : '180px',
      padding: compact ? '2px 4px' : '4px 8px',
      backgroundColor: 'rgba(42, 42, 46, 0.6)',
      borderRadius: '3px',
      border: '1px solid rgba(90, 90, 96, 0.5)'
    }),
    [compact]
  );

  const gaugeLabelStyle = useMemo(
    () => ({
      fontSize: compact ? '11px' : '12px',
      fontWeight: 600 as const,
      color: theme.colors.textSecondary,
      minWidth: compact ? '20px' : '35px',
      textAlign: 'right' as const,
    }),
    [compact, theme.colors.textSecondary]
  );

  const gaugeBarContainerStyle = useMemo(
    () => ({
      position: 'relative' as const,
      flex: 1,
      height: compact ? '12px' : '16px',
      backgroundColor: theme.colors.secondary,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '2px',
      overflow: 'hidden' as const,
    }),
    [compact, theme.colors.secondary, theme.colors.border]
  );

  const getGaugeBarStyle = (
    percent: number,
    barColor: string,
    bgColor: string
  ) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    height: '100%',
    width: `${percent}%`,
    backgroundColor: barColor,
    transition: 'width 0.2s ease-out',
    boxShadow: `inset 0 0 4px ${bgColor}88`,
  });

  const gaugeValueStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: compact ? '10px' : '11px',
      fontWeight: 700 as const,
      color: theme.colors.text,
      textShadow: `0 0 2px ${theme.colors.secondary}`,
      pointerEvents: 'none' as const,
      zIndex: 10,
      fontFamily: theme.fonts.mono,
    }),
    [compact, theme.colors.text, theme.colors.secondary, theme.fonts.mono]
  );

  return (
    <div 
      style={containerStyle} 
      className={`heroic-vitals-bar ${paradoxAnimation} ${styles.panelStone}`}
    >
      <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#c9a961', marginRight: '4px' }}>⚔️ VITALS</div>
        {/* HEALTH GAUGE */}
        <div style={gaugeContainerStyle}>
          <div style={gaugeLabelStyle}>HP</div>
          <div style={gaugeBarContainerStyle}>
            <div
              style={getGaugeBarStyle(hpPercent, theme.colors.health.bar, theme.colors.health.background)}
            />
            <div style={gaugeValueStyle}>
              {formatNumber(player.hp)}/{formatNumber(player.maxHp)}
            </div>
          </div>
        </div>

        {/* SOUL RESONANCE GAUGE (Mana) */}
        <div style={gaugeContainerStyle}>
          <div style={gaugeLabelStyle}>RES</div>
          <div style={gaugeBarContainerStyle}>
            <div
              style={getGaugeBarStyle(manaPercent, theme.colors.mana.bar, theme.colors.mana.background)}
            />
            <div style={gaugeValueStyle}>{Math.floor(manaPercent)}%</div>
          </div>
        </div>

        {/* PARADOX GAUGE */}
        <div style={gaugeContainerStyle}>
          <div style={gaugeLabelStyle}>PDX</div>
          <div
            style={{
              ...gaugeBarContainerStyle,
              boxShadow: `0 0 ${8 + paradoxPercent * 0.2}px ${theme.colors.paradox.glitch}${
                paradoxIntensity === 'severe' ? 'cc' : 'aa'
              }`,
            }}
          >
            <div
              style={getGaugeBarStyle(paradoxPercent, theme.colors.paradox.bar, theme.colors.paradox.background)}
            />
            <div style={gaugeValueStyle}>{Math.floor(paradoxPercent)}%</div>
          </div>
        </div>

        {/* XP/LEVEL GAUGE */}
        <div style={gaugeContainerStyle}>
          <div style={gaugeLabelStyle}>
            LV{player.level || 1}
          </div>
          <div style={gaugeBarContainerStyle}>
            <div style={getGaugeBarStyle(xpPercent, theme.colors.xp.bar, theme.colors.xp.background)} />
            <div style={gaugeValueStyle}>{Math.floor(xpPercent)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroicVitalsBar;
