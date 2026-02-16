import React, { useMemo, useState } from 'react';

interface CombatArenaProps {
  state?: any;
  onAttack?: (targetId: string) => void;
  onDefend?: (targetId: string) => void;
  onParry?: (targetId: string) => void;
  onHeal?: () => void;
  onCastSpell?: (spellId: string, targetId: string) => void;
  onExitCombat?: () => void;
}

/**
 * Get display name for NPC - mask if not in knowledgeBase
 */
function getNpcDisplayName(npc: any, knowledgeBase?: string[]): string {
  if (knowledgeBase?.includes(`npc:${npc.id}`)) {
    return npc.name;
  }
  return '??? (Unknown)';
}

/**
 * Get health description for unknown NPCs
 */
function getHealthDescription(npc: any, knowledgeBase?: string[]): string {
  if (knowledgeBase?.includes(`npc:${npc.id}`)) {
    const percent = (npc.hp / npc.maxHp) * 100;
    if (percent > 75) return 'Unharmed';
    if (percent > 50) return 'Wounded';
    if (percent > 25) return 'Heavily Wounded';
    return 'Near Death';
  }
  return '???';
}

export default function CombatArena({
  state,
  onAttack,
  onDefend,
  onParry,
  onHeal,
  onCastSpell,
  onExitCombat
}: CombatArenaProps) {
  const [spellMenuOpen, setSpellMenuOpen] = useState(false);
  const [selectedSpellEnemy, setSelectedSpellEnemy] = useState<string | null>(null);

  if (!state?.combatState?.active) {
    return null;
  }

  const combatState = state.combatState;
  const enemies = (state.npcs || []).filter((npc: any) =>
    combatState.participants?.includes(npc.id) && npc.id !== state.player.id
  );

  const playerMaxHp = state.player?.maxHp || 100;
  const playerCurrentHp = state.player?.hp || 100;
  const playerHpPercent = (playerCurrentHp / playerMaxHp) * 100;

  const playerMaxMp = state.player?.maxMp || 0;
  const playerCurrentMp = state.player?.mp || 0;
  const playerMpPercent = playerMaxMp > 0 ? (playerCurrentMp / playerMaxMp) * 100 : 0;

  const getHealthBarColor = (current: number, max: number) => {
    const percent = (current / max) * 100;
    if (percent > 50) return '#66bb6a'; // Green
    if (percent > 25) return '#ffa726'; // Orange
    return '#d32f2f'; // Red
  };

  const getManaBarColor = (): string => {
    const percent = playerMpPercent;
    if (percent > 70) return '#2196F3'; // Blue
    if (percent > 35) return '#4CAF50'; // Green
    return '#FF9800'; // Orange
  };


  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        flexDirection: 'column',
        padding: 20
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ color: '#ffd700', margin: '0 0 10px 0' }}>⚔️ COMBAT ARENA</h1>
        <div style={{ color: '#aaa', fontSize: 14 }}>
          Round {combatState.roundNumber || 0} | Participants: {combatState.participants?.length || 0}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
          width: '100%',
          maxWidth: 1000,
          marginBottom: 30
        }}
      >
        {/* Player Status */}
        <div
          style={{
            backgroundColor: '#1a1a2e',
            border: '2px solid #ffd700',
            borderRadius: 8,
            padding: 15,
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#ffd700', fontWeight: 'bold', marginBottom: 10 }}>PLAYER</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 5 }}>HP</div>
            <div
              style={{
                width: '100%',
                height: 30,
                backgroundColor: '#000',
                border: '1px solid #555',
                borderRadius: 4,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  width: `${playerHpPercent}%`,
                  height: '100%',
                  backgroundColor: getHealthBarColor(playerCurrentHp, playerMaxHp),
                  transition: 'width 0.3s ease'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}
              >
                {playerCurrentHp}/{playerMaxHp}
              </div>
            </div>
          </div>

          {/* Mana Bar */}
          {playerMaxMp > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 5 }}>MP</div>
              <div
                style={{
                  width: '100%',
                  height: 20,
                  backgroundColor: '#000',
                  border: '1px solid #555',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    width: `${playerMpPercent}%`,
                    height: '100%',
                    backgroundColor: getManaBarColor(),
                    transition: 'width 0.3s ease'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 'bold'
                  }}
                >
                  {playerCurrentMp}/{playerMaxMp}
                </div>
              </div>
            </div>
          )}

          {state.player?.statusEffects?.length > 0 && (
            <div style={{ fontSize: 11, color: '#ff9999', marginTop: 8 }}>
              Status: {state.player.statusEffects.join(', ')}
            </div>
          )}
        </div>

        {/* Enemy Status Cards */}
        {enemies.map((enemy: any) => {
          const enemyMaxHp = enemy.maxHp || 100;
          const enemyCurrentHp = enemy.hp || enemyMaxHp;
          const enemyHpPercent = (enemyCurrentHp / enemyMaxHp) * 100;

          return (
            <div
              key={enemy.id}
              style={{
                backgroundColor: '#2a1a1a',
                border: '2px solid #d32f2f',
                borderRadius: 8,
                padding: 15,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                transform: 'scale(1)'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
              }}
            >
              <div style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: 10 }}>
                {getNpcDisplayName(enemy, state.player?.knowledgeBase)}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 5 }}>HP</div>
                <div
                  style={{
                    width: '100%',
                    height: 20,
                    backgroundColor: '#000',
                    border: '1px solid #555',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div
                    style={{
                      width: `${enemyHpPercent}%`,
                      height: '100%',
                      backgroundColor: getHealthBarColor(enemyCurrentHp, enemyMaxHp),
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 6, flexDirection: 'column', marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onAttack?.(enemy.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  >
                    ⚔️ Attack
                  </button>
                  <button
                    onClick={() => onDefend?.(enemy.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#4a90e2',
                      color: 'white',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  >
                    🛡️ Block
                  </button>
                </div>
                {playerMaxMp > 0 && (
                  <button
                    onClick={() => {
                      setSelectedSpellEnemy(enemy.id);
                      setSpellMenuOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: '#9B59B6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  >
                    ✨ Cast Spell
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Combat Log */}
      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          backgroundColor: '#000',
          border: '1px solid #333',
          borderRadius: 4,
          maxHeight: 150,
          overflowY: 'auto',
          padding: 12,
          marginBottom: 20
        }}
      >
        <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Combat Log:</div>
        {combatState.log?.slice(-10).map((entry: string, idx: number) => (
          <div key={idx} style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
            {entry}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => onHeal?.()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ❤️ Heal
        </button>
        <button
          onClick={() => onExitCombat?.()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Flee Combat
        </button>
      </div>

      {/* Spell Selection Menu */}
      {spellMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001
          }}
          onClick={() => setSpellMenuOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a2e',
              border: '2px solid #9B59B6',
              borderRadius: 8,
              padding: 20,
              maxWidth: 400,
              maxHeight: 500,
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#9B59B6', marginTop: 0 }}>Select Spell</h3>
            <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
              Current Mana: {playerCurrentMp}/{playerMaxMp}
            </p>

            {/* Spell List - would typically fetch from state or props */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SpellButton name="Fireball" cost={40} discipline="Ruin" description="30 damage strike" />
              <SpellButton name="Lightning Strike" cost={45} discipline="Flux" description="35 AOE damage" />
              <SpellButton name="Heal" cost={30} discipline="Life" description="40 healing" />
              <SpellButton name="Mystic Shield" cost={25} discipline="Veil" description="Magic defense" />
            </div>

            <button
              onClick={() => setSpellMenuOpen(false)}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '10px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpellButton({
  name,
  cost,
  discipline,
  description
}: {
  name: string;
  cost: number;
  discipline: string;
  description: string;
}) {
  const disciplineColors: Record<string, string> = {
    Ruin: '#FF6B6B',
    Flux: '#4ECDC4',
    Veil: '#9B59B6',
    Bind: '#F39C12',
    Life: '#2ECC71'
  };

  return (
    <div
      style={{
        backgroundColor: '#2a2a3e',
        border: `1px solid ${disciplineColors[discipline] || '#999'}`,
        borderRadius: 4,
        padding: 8,
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#3a3a4e';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#2a2a3e';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{name}</div>
          <div style={{ color: '#999', fontSize: 10, marginTop: 2 }}>{description}</div>
        </div>
        <div style={{ color: disciplineColors[discipline] || '#999', fontWeight: 'bold', fontSize: 12 }}>
          {cost}MP
        </div>
      </div>
      <div style={{ color: '#aaa', fontSize: 10, marginTop: 4 }}>{discipline}</div>
    </div>
  );
}

