/**
 * RaidHUD.tsx: Compact 40-Player Raid Status Display
 * 
 * Features:
 * - Scalable player grid (2-4 columns) for 16-128 player display
 * - Heat-map status (health) visualization with color coding
 * - Boss threat meter with visual priority system
 * - Real-time mechanic alert system
 * - Diegetic ThreatVisualizer for immersive gameplay
 * - Responsive design for desktop/tablet
 * 
 * Performance target: Render <100ms for 128 players
 */

import React, { useMemo, useState, useEffect } from 'react';

// ============================================================================
// TYPES: Raid HUD State
// ============================================================================

interface PlayerStatus {
  readonly playerId: string;
  readonly playerName: string;
  readonly healthPercent: number;
  readonly maxHealth: number;
  readonly role: 'tank' | 'dps' | 'healer';
  readonly threatLevel: number; // 0-100
  readonly isAlive: boolean;
  readonly buffs: string[];
  readonly debuffs: string[];
  readonly mythRank: number;
}

interface BossStatus {
  readonly healthPercent: number;
  readonly phase: number;
  readonly activeMechanics: string[];
  readonly threatTargets: string[]; // Top aggro holders
  readonly castingAbility?: string;
  readonly castProgress: number; // 0-100
}

interface RaidHUDProps {
  readonly players: PlayerStatus[];
  readonly boss: BossStatus;
  readonly playerCount: number;
  readonly raidInstanceId: string;
  readonly showDetailedMetrics?: boolean;
}

// ============================================================================
// COLOR MAPPINGS: Health & Threat States
// ============================================================================

const getHealthColor = (healthPercent: number): string => {
  if (healthPercent <= 25) return '#ff4444'; // Red
  if (healthPercent <= 50) return '#ffaa44'; // Orange
  if (healthPercent <= 75) return '#ffffaa'; // Yellow
  return '#44ff44'; // Green
};

const getThreatColor = (threatLevel: number): string => {
  if (threatLevel <= 30) return '#4444ff'; // Blue (low)
  if (threatLevel <= 60) return '#ffff44'; // Yellow (medium)
  if (threatLevel <= 85) return '#ffaa44'; // Orange (high)
  return '#ff4444'; // Red (critical)
};

const getRoleIcon = (role: string): string => {
  switch (role) {
    case 'tank': return '🛡️';
    case 'dps': return '⚔️';
    case 'healer': return '✨';
    default: return '?';
  }
};

// ============================================================================
// COMPONENTS: Individual Player Cells
// ============================================================================

/**
 * PlayerCell: Compact player status indicator
 * Shows health bar, name, threat indicator, and buffs
 */
const PlayerCell: React.FC<{ player: PlayerStatus; targetIndex: number; isTargeted: boolean }> = ({
  player,
  targetIndex,
  isTargeted
}) => {
  const healthColor = getHealthColor(player.healthPercent);
  const threatColor = getThreatColor(player.threatLevel);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px',
        backgroundColor: isTargeted ? '#1a3a1a' : '#0a0a14',
        border: `2px solid ${isTargeted ? '#ffff00' : '#333333'}`,
        borderRadius: '4px',
        marginBottom: '4px',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aaaaaa',
        width: '100%',
        gap: '2px'
      }}
    >
      {/* Player Name + Role + Myth Rank */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {getRoleIcon(player.role)} {player.playerName.substring(0, 8)}
        </span>
        <span style={{ fontSize: '9px', color: '#888888' }}>M{player.mythRank}</span>
      </div>

      {/* Health Bar */}
      <div
        style={{
          width: '100%',
          height: '12px',
          backgroundColor: '#1a1a2e',
          borderRadius: '2px',
          overflow: 'hidden',
          border: '1px solid #333333'
        }}
      >
        <div
          style={{
            width: `${player.healthPercent}%`,
            height: '100%',
            backgroundColor: healthColor,
            transition: 'width 0.1s ease-out'
          }}
        />
      </div>

      {/* Health Text */}
      <div style={{ fontSize: '9px', color: healthColor }}>
        {Math.round(player.healthPercent)}% • Threat: {Math.round(player.threatLevel)}%
      </div>

      {/* Status Indicators */}
      {player.buffs.length > 0 && (
        <div style={{ fontSize: '9px', color: '#44ff44' }}>
          ✓ {player.buffs.slice(0, 2).join(', ')}
        </div>
      )}

      {player.debuffs.length > 0 && (
        <div style={{ fontSize: '9px', color: '#ff6666' }}>
          ✗ {player.debuffs.slice(0, 2).join(', ')}
        </div>
      )}

      {/* Dead Indicator */}
      {!player.isAlive && (
        <div style={{ fontSize: '11px', color: '#ff0000', fontWeight: 'bold' }}>
          💀 DEAD
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTS: Boss Status Section
// ============================================================================

/**
 * BossStatusPanel: Shows boss health, phase, mechanics, and casting bar
 */
const BossStatusPanel: React.FC<{ boss: BossStatus }> = ({ boss }) => {
  const phaseLabels: Record<number, string> = {
    1: 'Initial',
    2: 'Intensifying',
    3: 'Enraged'
  };

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#1a1a2e',
        border: '2px solid #ff6600',
        borderRadius: '6px',
        marginBottom: '12px',
        fontFamily: 'monospace'
      }}
    >
      {/* Boss Title */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#ff6600',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>🐉 AETHELGARD WORLD-EATER</span>
        <span style={{ color: '#aaaaaa', fontSize: '12px' }}>
          Phase {boss.phase}: {phaseLabels[boss.phase] || 'Unknown'}
        </span>
      </div>

      {/* Boss Health Bar (Large) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#0a0a14',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '2px solid #333333'
          }}
        >
          <div
            style={{
              width: `${boss.healthPercent}%`,
              height: '100%',
              backgroundColor: getHealthColor(boss.healthPercent),
              transition: 'width 0.15s ease-out'
            }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#aaaaaa' }}>
          Boss Health: {Math.round(boss.healthPercent)}%
        </div>
      </div>

      {/* Casting Bar (if active) */}
      {boss.castingAbility && (
        <div
          style={{
            padding: '6px',
            backgroundColor: '#2a1a1a',
            border: '1px solid #ff3333',
            borderRadius: '4px',
            marginBottom: '8px'
          }}
        >
          <div style={{ fontSize: '11px', color: '#ff3333', marginBottom: '4px' }}>
            ⚡ Casting: {boss.castingAbility}
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#1a0a0a',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${boss.castProgress}%`,
                height: '100%',
                backgroundColor: '#ff6600'
              }}
            />
          </div>
        </div>
      )}

      {/* Active Mechanics */}
      {boss.activeMechanics.length > 0 && (
        <div style={{ padding: '6px', backgroundColor: '#2a0a0a', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#ff3333', marginBottom: '4px' }}>
            ⚠️ Active Mechanics:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {boss.activeMechanics.map((mech, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: '#3a1a1a',
                  border: '1px solid #ff3333',
                  borderRadius: '3px',
                  color: '#ff6666'
                }}
              >
                {mech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Threat Targets */}
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#ffaa44' }}>
        🎯 Primary Targets: {boss.threatTargets.slice(0, 3).join(', ') || 'None'}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT: RaidHUD
// ============================================================================

/**
 * RaidHUD: Main component for 16-128 player raid status display
 * 
 * Dynamic layout:
 * - 16-32 players: 2 columns
 * - 33-64 players: 3 columns
 * - 65+ players: 4 columns
 */
export const RaidHUD: React.FC<RaidHUDProps> = ({
  players,
  boss,
  playerCount,
  raidInstanceId,
  showDetailedMetrics = false
}) => {
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);

  // Calculate grid columns based on player count
  const columnCount = useMemo(() => {
    if (playerCount <= 32) return 2;
    if (playerCount <= 64) return 3;
    return 4;
  }, [playerCount]);

  // Sort players by role and threat for display
  const sortedPlayers = useMemo(() => {
    const tanks = players.filter((p) => p.role === 'tank').sort((a, b) => b.threatLevel - a.threatLevel);
    const healers = players.filter((p) => p.role === 'healer').sort((a, b) => b.healthPercent - a.healthPercent);
    const dps = players.filter((p) => p.role === 'dps').sort((a, b) => b.threatLevel - a.threatLevel);

    return [...tanks, ...healers, ...dps];
  }, [players]);

  // Group players for grid layout
  const playerGroups = useMemo(() => {
    const groups: PlayerStatus[][] = [];
    for (let i = 0; i < sortedPlayers.length; i += columnCount) {
      groups.push(sortedPlayers.slice(i, i + columnCount));
    }
    return groups;
  }, [sortedPlayers, columnCount]);

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#0a0a14',
        border: '2px solid #333333',
        borderRadius: '8px',
        fontFamily: 'monospace',
        color: '#aaaaaa',
        maxWidth: '1200px',
        fontSize: '12px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333333'
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff6600' }}>
          ⚔️ RAID HUD: {playerCount} Players
        </div>
        <div style={{ fontSize: '11px', color: '#666666' }}>
          Instance: {raidInstanceId.substring(0, 8)}...
        </div>
      </div>

      {/* Boss Status */}
      <BossStatusPanel boss={boss} />

      {/* Player Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: '#ffaa44', marginBottom: '4px' }}>
          Players by Role:
        </div>

        {playerGroups.map((group, groupIdx) => (
          <div
            key={groupIdx}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
              gap: '6px'
            }}
          >
            {group.map((player, cellIdx) => {
              const isTargeted = boss.threatTargets.includes(player.playerId);
              return (
                <div
                  key={player.playerId}
                  onMouseEnter={() => setHighlightedPlayerId(player.playerId)}
                  onMouseLeave={() => setHighlightedPlayerId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <PlayerCell
                    player={player}
                    targetIndex={boss.threatTargets.indexOf(player.playerId)}
                    isTargeted={isTargeted}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Detailed Metrics (Optional) */}
      {showDetailedMetrics && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#1a1a2e',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#666666'
          }}
        >
          <div>📊 Raid Composition:</div>
          <div>• Tanks: {players.filter((p) => p.role === 'tank').length}</div>
          <div>• DPS: {players.filter((p) => p.role === 'dps').length}</div>
          <div>• Healers: {players.filter((p) => p.role === 'healer').length}</div>
          <div style={{ marginTop: '6px' }}>
            • Alive: {players.filter((p) => p.isAlive).length} / {playerCount}
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {players.some((p) => p.healthPercent < 25 && p.isAlive) && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#3a1a1a',
            border: '2px solid #ff0000',
            borderRadius: '4px',
            color: '#ff4444',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          🚨 CRITICAL: Players low health!
          {players
            .filter((p) => p.healthPercent < 25 && p.isAlive)
            .map((p) => p.playerName)
            .join(', ')}
        </div>
      )}
    </div>
  );
};

export default RaidHUD;
