import React, { useEffect, useRef } from 'react';

interface CombatViewProps {
  worldState?: any;
}

export function CombatView({ worldState }: CombatViewProps) {
  const combat = worldState?.combatState;
  const player = worldState?.player;
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combat?.turn, player?.combatLog?.length]);

  if (!combat) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'rgba(200, 180, 220, 0.4)',
        padding: '2rem',
      }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚔️</div>
          <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>No active combat.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>The world is (momentarily) peaceful.</p>
        </div>
      </div>
    );
  }

  const enemies = combat.enemies || [];
  const entries = player?.combatLog || [];

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      padding: '0.75rem 0.6rem',
      gap: '1rem',
    }}>
      {/* Combat Header */}
      <div style={{
        padding: '0.75rem',
        background: 'linear-gradient(180deg, rgba(248,113,113,0.15), rgba(239,68,68,0.08))',
        border: '1px solid rgba(248,113,113,0.3)',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#f87171', fontSize: '1rem', fontWeight: 700 }}>
          ⚔️ Combat Active
        </span>
        <span style={{
          fontSize: '0.8rem',
          color: '#fbbf24',
          background: 'rgba(251,191,36,0.15)',
          padding: '0.25rem 0.6rem',
          borderRadius: '4px',
          fontFamily: 'monospace',
        }}>
          Turn {combat.turn ?? 1}
        </span>
      </div>

      {/* Player Status */}
      <div style={{
        padding: '0.75rem',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '6px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: '#c084fc', fontWeight: 600 }}>
            {player?.name || 'You'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(200,180,220,0.6)' }}>Player</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem' }}>
          <span style={{ color: '#ef4444' }}>❤️ {player?.hp ?? '?'}/{player?.maxHp ?? '?'}</span>
          <span style={{ color: '#60a5fa' }}>🔵 {player?.mp ?? '?'}/{player?.maxMp ?? '?'}</span>
          {player?.grit !== undefined && (
            <span style={{ color: '#fbbf24' }}>⚡ {player.grit ?? '?'}/{player.maxGrit ?? '?'}</span>
          )}
        </div>
      </div>

      {/* Enemy Cards */}
      {enemies.map((enemy: any, idx: number) => (
        <div key={enemy.id ?? idx} style={{
          padding: '0.75rem',
          background: 'rgba(248, 113, 113, 0.08)',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          borderRadius: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#fca5a5', fontSize: '0.9rem', fontWeight: 600 }}>
              {enemy.name || `Enemy ${idx + 1}`}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(200, 180, 220, 0.5)' }}>
              ❤️ {Math.max(0, enemy.hp ?? 0)}/{enemy.maxHp ?? '?'}
            </span>
          </div>

          {/* Enemy HP Bar */}
          <div style={{
            height: '6px',
            background: 'rgba(79,39,131,0.4)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '0.4rem',
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #ef4444, #f87171)',
              width: `${Math.max(0, Math.min(100, ((enemy.hp ?? 0) / (enemy.maxHp ?? 1)) * 100))}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Enemy Status Effects */}
          {enemy.statusEffects && enemy.statusEffects.length > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', fontSize: '0.7rem' }}>
              {enemy.statusEffects.map((effect: string) => (
                <span key={effect} style={{
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '3px',
                  padding: '0.1rem 0.3rem',
                  color: '#d8b4fe',
                }}>
                  {effect}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Combat Log */}
      {entries.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(139,92,246,0.2)',
        }}>
          <div style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#a78bfa',
            fontWeight: 600,
          }}>
            Combat Log
          </div>
          <div ref={logRef} style={{
            maxHeight: '180px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            fontSize: '0.72rem',
            color: 'rgba(200,180,220,0.7)',
            fontFamily: 'monospace',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139,92,246,0.3) transparent',
          }}>
            {entries.slice(-10).map((e: any, i: number) => (
              <div key={`${e.tick}-${i}`} style={{
                padding: '0.1rem 0.3rem',
                borderLeft: '2px solid rgba(139,92,246,0.2)',
                paddingLeft: '0.5rem',
              }}>
                <span style={{ color: '#a78bfa' }}>[T{e.tick}]</span>{' '}
                <span style={{ color: '#fbbf24' }}>{e.actor}</span>{' '}
                <span>{e.action}</span>
                {e.target && <span style={{ color: '#fca5a5' }}> → {e.target}</span>}
                {e.result && (
                  <span style={{ color: 'rgba(200,180,220,0.5)' }}>
                    {' '}({e.result})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
