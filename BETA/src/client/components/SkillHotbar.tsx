/**
 * SkillHotbar Component
 * 
 * Persistent ability hotbar displayed at the bottom center of the screen.
 * Features:
 * - 6-10 ability slot display
 * - Radial cooldown overlay animations
 * - Keyboard shortcut hints (1-6, or custom)
 * - Mana/Resource cost indicators
 * - Ability name tooltips on hover
 * - Click-to-cast with validation
 * 
 * Phase 3: Action RPG hotbar with real-time cooldown tracking
 */

import React, { useMemo, useState } from 'react';
import type { PlayerState } from '../../engine/worldEngine';
import { usePlayerTheme } from '../hooks/usePlayerTheme';

export interface SkillHotbarProps {
  player: PlayerState;
  worldState: { tick?: number };
  onCastSkill?: (abilityId: string) => void;
}

interface AbilityDisplay {
  id: string;
  name: string;
  icon: string;
  manaCost: number;
  cooldownTicks: number;
  description: string;
  type: 'offensive' | 'defensive' | 'utility' | 'heal';
}

// Ability database (can be moved to engine later)
const ABILITY_DATABASE: Record<string, AbilityDisplay> = {
  'fireball': {
    id: 'fireball',
    name: 'Fireball',
    icon: '🔥',
    manaCost: 30,
    cooldownTicks: 30,
    description: 'Launch a massive fireball',
    type: 'offensive',
  },
  'frost-nova': {
    id: 'frost-nova',
    name: 'Frost Nova',
    icon: '❄️',
    manaCost: 25,
    cooldownTicks: 20,
    description: 'Freeze enemies in place',
    type: 'offensive',
  },
  'healing-light': {
    id: 'healing-light',
    name: 'Healing Light',
    icon: '💚',
    manaCost: 20,
    cooldownTicks: 40,
    description: 'Restore health',
    type: 'heal',
  },
  'shield-bash': {
    id: 'shield-bash',
    name: 'Shield Bash',
    icon: '🛡️',
    manaCost: 15,
    cooldownTicks: 25,
    description: 'Stun and block',
    type: 'defensive',
  },
  'arcane-missile': {
    id: 'arcane-missile',
    name: 'Arcane Missile',
    icon: '✨',
    manaCost: 20,
    cooldownTicks: 15,
    description: 'Fire magical projectiles',
    type: 'offensive',
  },
  'blink': {
    id: 'blink',
    name: 'Blink',
    icon: '⚡',
    manaCost: 35,
    cooldownTicks: 50,
    description: 'Teleport away',
    type: 'utility',
  },
};

export const SkillHotbar: React.FC<SkillHotbarProps> = ({
  player,
  worldState,
  onCastSkill,
}) => {
  const theme = usePlayerTheme(player?.theme);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState<number | null>(null);

  // Get equipped abilities (default to first 6 if not specified)
  const equippedAbilities: AbilityDisplay[] = useMemo(() => {
    if (!player?.equippedAbilities || player.equippedAbilities.length === 0) {
      // Default loadout
      return Object.values(ABILITY_DATABASE).slice(0, 6);
    }
    return player.equippedAbilities
      .map((abilityId) => ABILITY_DATABASE[abilityId])
      .filter((ability) => !!ability);
  }, [player?.equippedAbilities]);

  // Get cooldown remaining for ability
  const getCooldownRemaining = (abilityId: string): number => {
    const cooldowns = player?.abilityCooldowns || {};
    const remaining = cooldowns[abilityId] || 0;
    return Math.max(0, remaining);
  };

  // Check if ability can be cast
  const canCastAbility = (ability: AbilityDisplay): boolean => {
    const mana = player?.soulResonanceLevel || 0;
    const onCooldown = getCooldownRemaining(ability.id) > 0;
    return mana >= ability.manaCost && !onCooldown;
  };

  // =========================================================================
  // STYLES
  // =========================================================================

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    padding: '12px',
    backgroundColor: theme.colors.background,
    border: `2px solid ${theme.colors.primary}`,
    borderRadius: '8px',
    boxShadow: theme.shadows.heavy,
    zIndex: 950,
    backgroundImage: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.1))',
    backdropFilter: 'blur(4px)',
  };

  const slotStyle = (ability: AbilityDisplay, isHovered: boolean): React.CSSProperties => {
    const canCast = canCastAbility(ability);
    const cooldownRemaining = getCooldownRemaining(ability.id);
    const isOnCooldown = cooldownRemaining > 0;

    let bgColor = theme.colors.secondary;
    let borderColor = theme.colors.border;

    if (isHovered) {
      bgColor = theme.colors.primary;
      borderColor = theme.colors.accent;
    }

    if (!canCast) {
      bgColor = theme.colors.disabled;
      borderColor = theme.colors.disabled;
    }

    return {
      position: 'relative',
      width: '56px',
      height: '56px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: bgColor,
      border: `2px solid ${borderColor}`,
      borderRadius: '6px',
      cursor: canCast ? 'pointer' : 'not-allowed',
      transition: 'all 0.2s',
      opacity: canCast ? 1 : 0.5,
      fontSize: '24px',
      fontWeight: 700,
      overflow: 'hidden',
      boxShadow: isOnCooldown ? `inset 0 0 8px ${theme.colors.warning}44` : 'none',
    };
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '28px',
    pointerEvents: 'none',
  };

  const keybindStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    right: '2px',
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: theme.colors.accent,
    color: theme.colors.primary,
    borderRadius: '3px',
    padding: '2px 4px',
    fontFamily: theme.fonts.mono,
  };

  const cooldownOverlayStyle = (cooldownRemaining: number, cooldownMax: number): React.CSSProperties => {
    const percentage = (cooldownRemaining / cooldownMax) * 100;
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.primary,
      opacity: 0.6,
      clipPath: `polygon(0 ${100 - percentage}%, 100% ${100 - percentage}%, 100% 100%, 0 100%)`,
      pointerEvents: 'none',
      transition: 'clip-path 0.1s linear',
    };
  };

  const manaIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '2px',
    left: '2px',
    right: '2px',
    height: '3px',
    backgroundColor: theme.colors.primary,
    borderRadius: '1px',
    overflow: 'hidden',
  };

  const manaFillStyle = (ability: AbilityDisplay): React.CSSProperties => {
    const mana = player?.soulResonanceLevel || 0;
    const manaPercent = Math.min(100, (mana / 100) * 100);
    const hasEnough = mana >= ability.manaCost;
    return {
      height: '100%',
      width: `${manaPercent}%`,
      backgroundColor: hasEnough ? theme.colors.mana.bar : theme.colors.error,
      transition: 'width 0.3s ease',
    };
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    padding: '8px 12px',
    backgroundColor: theme.colors.secondary,
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: '4px',
    fontSize: '11px',
    color: theme.colors.text,
    minWidth: '120px',
    textAlign: 'center',
    whiteSpace: 'wrap',
    wordWrap: 'break-word',
    pointerEvents: 'none',
    zIndex: 1000,
    fontFamily: theme.fonts.primary,
    boxShadow: theme.shadows.medium,
  };

  const tooltipNameStyle: React.CSSProperties = {
    fontWeight: 700,
    color: theme.colors.textAccent,
    marginBottom: '4px',
  };

  const tooltipCostStyle: React.CSSProperties = {
    fontSize: '10px',
    color: theme.colors.textSecondary,
    marginTop: '4px',
  };

  return (
    <div style={containerStyle}>
      {equippedAbilities.map((ability, idx) => {
        const cooldownRemaining = getCooldownRemaining(ability.id);
        const cooldownMax = ability.cooldownTicks;
        const isHovered = hoveredSlot === idx;
        const canCast = canCastAbility(ability);

        return (
          <div
            key={ability.id}
            style={slotStyle(ability, isHovered)}
            onClick={() => {
              if (canCast) {
                onCastSkill?.(ability.id);
              }
            }}
            onMouseEnter={() => {
              setHoveredSlot(idx);
              setTooltipVisible(idx);
            }}
            onMouseLeave={() => {
              setHoveredSlot(null);
              setTooltipVisible(null);
            }}
            title={ability.name}
          >
            {/* Icon */}
            <div style={iconStyle}>{ability.icon}</div>

            {/* Keybind */}
            <div style={keybindStyle}>{idx + 1}</div>

            {/* Cooldown Overlay */}
            {cooldownRemaining > 0 && (
              <div style={cooldownOverlayStyle(cooldownRemaining, cooldownMax)} />
            )}

            {/* Cooldown Timer Text */}
            {cooldownRemaining > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: theme.colors.warning,
                  textShadow: `0 0 4px ${theme.colors.primary}`,
                  pointerEvents: 'none',
                }}
              >
                {Math.ceil(cooldownRemaining / 10)}
              </div>
            )}

            {/* Mana Indicator */}
            <div style={manaIndicatorStyle}>
              <div style={manaFillStyle(ability)} />
            </div>

            {/* Tooltip */}
            {tooltipVisible === idx && (
              <div style={tooltipStyle}>
                <div style={tooltipNameStyle}>{ability.icon} {ability.name}</div>
                <div style={{ fontSize: '10px', marginBottom: '4px' }}>{ability.description}</div>
                <div style={tooltipCostStyle}>
                  Mana: {ability.manaCost} | CD: {ability.cooldownTicks / 10}s
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* MANA POOL INDICATOR */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          fontSize: '10px',
          color: theme.colors.mana.bar,
          fontWeight: 700,
          fontFamily: theme.fonts.mono,
        }}
      >
        <div>{Math.floor(player?.soulResonanceLevel || 0)}</div>
        <div style={{ fontSize: '9px', color: theme.colors.textSecondary }}>/ 100</div>
      </div>
    </div>
  );
};

export default SkillHotbar;
