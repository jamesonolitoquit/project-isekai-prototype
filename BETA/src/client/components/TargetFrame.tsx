import React from 'react';
import type { WorldState, NPC } from '../../engine/worldEngine';

interface TargetFrameProps {
  state: WorldState;
  isDiegetic?: boolean; // Apply "Diegetic Glitch" effect if true
}

const TargetFrame: React.FC<TargetFrameProps> = ({ state, isDiegetic = false }) => {
  const targetId = state.player?.activeTargetId;
  if (!targetId) {
    return null; // Don't render if no target
  }

  const target = state.npcs?.find((npc) => npc.id === targetId) as NPC | undefined;
  if (!target) {
    return null;
  }

  const hpPercent = ((target.hp || target.maxHp || 100) / (target.maxHp || 100)) * 100;
  const healthStatus = hpPercent > 75 ? '✓' : hpPercent > 50 ? '◐' : hpPercent > 25 ? '◑' : '◔';
  const healthColor = hpPercent > 50 ? '#0f0' : hpPercent > 25 ? '#f80' : '#f00';

  // Determine if target has high paradox (for diegetic glitch effect)
  const targetParadox = target.paradoxLevel ?? 0;
  const playerParadox = state.player?.soulResonanceLevel || 0;
  const showGlitch = isDiegetic && targetParadox > playerParadox;

  const styles = {
    container: {
      position: 'fixed' as const,
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '280px',
      backgroundColor: showGlitch ? '#1a0a1a' : '#0a0a1a',
      border: `2px solid ${showGlitch ? '#ff00ff' : '#0f3'}`,
      borderRadius: '4px',
      padding: '12px',
      fontFamily: 'monospace',
      color: showGlitch ? '#ff00ff' : '#0f3',
      zIndex: 1000,
      boxShadow: showGlitch 
        ? '0 0 20px rgba(255, 0, 255, 0.4)' 
        : '0 0 10px rgba(0, 255, 51, 0.2)',
      animation: showGlitch ? 'diegetic-glitch 0.3s infinite' : 'none',
      textShadow: showGlitch ? '0 0 10px rgba(255, 0, 255, 0.5)' : 'none'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      letterSpacing: '2px'
    },
    name: {
      flex: 1
    },
    level: {
      fontSize: '12px',
      opacity: 0.7
    },
    hpBar: {
      width: '100%',
      height: '20px',
      backgroundColor: '#0a0a14',
      border: `1px solid ${showGlitch ? '#ff00ff' : '#0f3'}`,
      borderRadius: '2px',
      marginBottom: '6px',
      overflow: 'hidden' as const,
      position: 'relative' as const
    },
    hpFill: {
      height: '100%',
      width: `${hpPercent}%`,
      backgroundColor: healthColor,
      transition: 'width 200ms',
      boxShadow: `0 0 10px ${healthColor}`
    },
    hpText: {
      position: 'absolute' as const,
      top: '2px',
      left: '4px',
      fontSize: '11px',
      fontWeight: 'bold' as const,
      color: '#000',
      textShadow: `0 0 2px ${healthColor}`,
      pointerEvents: 'none' as const
    },
    statusRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      opacity: 0.8
    },
    threatIndicator: {
      fontSize: '12px',
      color: '#f80',
      fontWeight: 'bold' as const
    }
  };

  // CSS for diegetic glitch animation
  const glitchStyle = `
    @keyframes diegetic-glitch {
      0% { transform: translateX(-50%) translateY(0) skewX(0deg); }
      20% { transform: translateX(-50%) translateY(-2px) skewX(-1deg); }
      40% { transform: translateX(-50%) translateY(1px) skewX(1deg); }
      60% { transform: translateX(-50%) translateY(0) skewX(-1deg); }
      80% { transform: translateX(-50%) translateY(-1px) skewX(0deg); }
      100% { transform: translateX(-50%) translateY(0) skewX(0deg); }
    }
  `;

  return (
    <>
      <style>{glitchStyle}</style>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.name}>{target.name}</div>
          <div style={styles.level}>LVL {target.stats?.level ?? '?'}</div>
        </div>

        <div style={styles.hpBar}>
          <div style={styles.hpFill} />
          <div style={styles.hpText}>
            {healthStatus} {Math.round(target.hp || target.maxHp || 100)} / {target.maxHp || 100}
          </div>
        </div>

        <div style={styles.statusRow}>
          <div>
            {target.statusEffects && target.statusEffects.length > 0 
              ? `Status: ${target.statusEffects.slice(0, 2).join(', ')}`
              : 'Status: Normal'
            }
          </div>
          {target.factionRole && (
            <div style={styles.threatIndicator}>
              ⚠ {target.factionRole.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TargetFrame;
