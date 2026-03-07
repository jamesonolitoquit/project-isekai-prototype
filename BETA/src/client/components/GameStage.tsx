import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dice3D } from './Dice3D';
import { NarrativeView } from './NarrativeView';
import { CombatView } from './CombatView';
import { TravelView } from './TravelView';
import DialogPanel from './DialogPanel';
import type { WorldController } from '../../types/engines';

/** Pending action that waits for a dice roll to resolve */
interface PendingAction {
  type: 'explore' | 'talk' | 'custom' | 'attack' | 'defend' | 'cast' | 'flee';
  label: string;
  dc: number;
  npcId?: string;
}

// StageMode removed in Phase 7 — no tab system

interface GameStageProps {
  worldState?: any; // WorldState
  controller?: WorldController;
}

/* ── Quick-action slot for the action bar ── */
interface QuickSlot {
  id: string;
  label: string;
  icon: string;
  hotkey: string;
  disabled?: boolean;
  onActivate: () => void;
}

const panelStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  color: '#e2d4f0',
  fontFamily: "'Georgia', serif",
  position: 'relative',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 0.6rem',
  height: '40px',
  borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
  background: 'linear-gradient(180deg, rgba(10, 5, 20, 0.7), rgba(10, 5, 20, 0.5))',
  flexShrink: 0,
};

// Tab bar removed in Phase 7 — combat renders inline via combatState

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem 0.6rem',
};

// TAB_LABELS removed in Phase 7 — no more tab bar

// --- Narrative Panel ---
function NarrativePanel({ worldState }: { worldState?: any }) {
  const player = worldState?.player;
  const location = worldState?.locations?.find((l: any) => l.id === player?.location);
  const locationName = location?.name || player?.location || 'Unknown Location';
  const locationDesc = location?.description || 'Silence fills the space around you. The world holds its breath.';
  const weather = worldState?.weather || 'clear';
  const dayPhase = worldState?.dayPhase || 'morning';
  const season = worldState?.season || 'spring';
  const hour = worldState?.hour ?? 0;
  const npcsHere = (worldState?.npcs || []).filter((n: any) =>
    (n.locationId === player?.location || n.location === player?.location)
    && !n.isDead
    && !n.isHidden
    && !['SOUL_ECHO', 'SHADOW', 'ANOMALY', 'PHANTOM'].includes(n.type)
  );

  const weatherEmoji: Record<string, string> = { clear: '☀️', snow: '❄️', rain: '🌧️', ash_storm: '🌪️', cinder_fog: '🌫️', mana_static: '⚡' };
  const phaseEmoji: Record<string, string> = { morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙' };

  return (
    <div style={contentAreaStyle}>
      {/* Location Block */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ color: '#c084fc', fontSize: '1.1rem', margin: '0 0 0.2rem', fontFamily: 'serif' }}>
          📍 {locationName}
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'rgba(200, 180, 220, 0.6)', marginBottom: '0.75rem' }}>
          <span>{phaseEmoji[dayPhase]} {dayPhase} &bull; {hour.toString().padStart(2, '0')}:00</span>
          <span>{weatherEmoji[weather] || '🌤️'} {weather.replace('_', ' ')}</span>
          <span>🍃 {season}</span>
        </div>
        <p style={{ color: 'rgba(200, 180, 220, 0.8)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
          {locationDesc}
        </p>
      </div>

      {/* NPCs present */}
      {npcsHere.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#a78bfa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>
            Present
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {npcsHere.map((npc: any) => (
              <span key={npc.id} style={{
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.78rem',
                color: '#d8b4fe',
              }}>
                {npc.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active Quests snapshot */}
      {player?.quests && Object.keys(player.quests).length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#a78bfa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>
            Active Objectives
          </h4>
          {Object.entries(player.quests)
            .filter(([, qs]: [string, any]) => ['none', 'active'].includes(qs.status))
            .slice(0, 3)
            .map(([qid, qs]: [string, any]) => {
              const questDef = (worldState?.quests || []).find((q: any) => q.id === qid);
              return (
                <div key={qid} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#c084fc', marginTop: '2px' }}>◈</span>
                  <span style={{ fontSize: '0.83rem', color: 'rgba(200, 180, 220, 0.85)' }}>
                    {questDef?.title || qid}
                    {qs.progress !== undefined && (
                      <span style={{ color: '#a78bfa', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                        [{qs.progress}/{qs.required ?? 1}]
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Placeholder prompt when new */}
      {!player && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(200, 180, 220, 0.4)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          The world awaits your first step...
        </div>
      )}
    </div>
  );
}

// --- Travel Panel ---
function TravelPanel({ worldState }: { worldState?: any }) {
  const player = worldState?.player;
  const locations = worldState?.locations || [];
  const travelState = worldState?.travelState;

  return (
    <div style={contentAreaStyle}>
      {travelState?.isTraveling ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚶</div>
          <p style={{ color: '#c084fc', fontSize: '1rem', margin: '0 0 0.5rem' }}>Traveling…</p>
          <p style={{ color: 'rgba(200, 180, 220, 0.6)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Heading to {locations.find((l: any) => l.id === travelState.toLocationId)?.name || travelState.toLocationId}
          </p>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px', height: '6px', overflow: 'hidden', maxWidth: '300px', margin: '0 auto' }}>
            <div style={{
              background: 'linear-gradient(90deg, #8b5cf6, #c084fc)',
              height: '100%',
              width: `${Math.max(5, 100 - (travelState.remainingTicks / travelState.ticksPerTravelSession) * 100)}%`,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      ) : (
        <>
          <h4 style={{ color: '#a78bfa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.75rem' }}>
            Known Locations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {locations.slice(0, 10).map((loc: any) => {
              const isCurrent = loc.id === player?.location;
              return (
                <div key={loc.id} style={{
                  padding: '0.5rem 0.75rem',
                  background: isCurrent ? 'rgba(139, 92, 246, 0.2)' : 'rgba(10, 5, 20, 0.4)',
                  border: `1px solid ${isCurrent ? 'rgba(139, 92, 246, 0.5)' : 'rgba(79, 39, 131, 0.2)'}`,
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.85rem', color: isCurrent ? '#c084fc' : 'rgba(200, 180, 220, 0.8)' }}>
                    {isCurrent ? '📍 ' : ''}{loc.name}
                  </span>
                  {loc.biome && (
                    <span style={{ fontSize: '0.7rem', color: 'rgba(167, 139, 250, 0.6)', textTransform: 'capitalize' }}>
                      {loc.biome}
                    </span>
                  )}
                </div>
              );
            })}
            {locations.length === 0 && (
              <p style={{ color: 'rgba(200, 180, 220, 0.4)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No locations discovered yet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --- Combat Panel ---
function CombatPanel({ worldState }: { worldState?: any }) {
  const combat = worldState?.combatState;
  const player = worldState?.player;

  if (!combat) {
    return (
      <div style={{ ...contentAreaStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(200, 180, 220, 0.4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚔️</div>
          <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No active combat.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>The world is (momentarily) peaceful.</p>
        </div>
      </div>
    );
  }

  const enemies = combat.enemies || [];
  return (
    <div style={contentAreaStyle}>
      <h3 style={{ color: '#f87171', fontSize: '1rem', margin: '0 0 1rem' }}>⚔️ Combat Active</h3>
      {/* Player row */}
      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ color: '#c084fc', fontWeight: 600 }}>{player?.name || 'You'}</span>
          <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Turn {combat.turn ?? 1}</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem' }}>
          <span>❤️ {player?.hp ?? '?'}/{player?.maxHp ?? '?'}</span>
          <span>🔵 {player?.mp ?? '?'}/{player?.maxMp ?? '?'}</span>
        </div>
      </div>
      {/* Enemies */}
      {enemies.map((e: any, i: number) => (
        <div key={e.id ?? i} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(248, 113, 113, 0.08)', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 600 }}>{e.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(200, 180, 220, 0.5)' }}>
              ❤️ {e.hp ?? '?'}/{e.maxHp ?? '?'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Combat Log (scrollable, appended entries) ---
function CombatLog({ worldState }: { worldState?: any }) {
  const entries = worldState?.player?.combatLog || [];
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries.length]);

  if (entries.length === 0) return null;
  return (
    <div style={{
      margin: '0.75rem 0 0',
      borderTop: '1px solid rgba(139,92,246,0.2)',
      paddingTop: '0.5rem',
    }}>
      <h4 style={{ color: '#a78bfa', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.35rem' }}>
        Combat Log
      </h4>
      <div ref={logRef} style={{
        maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem',
        fontSize: '0.72rem', color: 'rgba(200,180,220,0.7)', fontFamily: 'monospace',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent',
      }}>
        {entries.slice(-30).map((e: any, i: number) => (
          <div key={`${e.tick}-${i}`} style={{ padding: '0.1rem 0.3rem', borderLeft: '2px solid rgba(139,92,246,0.2)' }}>
            <span style={{ color: '#a78bfa' }}>[T{e.tick}]</span>{' '}
            <span style={{ color: '#fbbf24' }}>{e.actor}</span>{' '}
            <span>{e.action}</span>
            {e.target && <span style={{ color: '#fca5a5' }}> → {e.target}</span>}
            {e.result && <span style={{ color: 'rgba(200,180,220,0.5)' }}> ({e.result})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Action Bar (quick-slots with hotkeys) ---
function ActionBar({ worldState }: { worldState?: any }) {
  const player = worldState?.player;
  const equipped = player?.equippedAbilities || [];
  const cooldowns = player?.abilityCooldowns || {};
  const currentTick = worldState?.tick ?? 0;
  const ap = player?.ap ?? 3;
  const maxAp = player?.maxAp ?? 3;

  const slots: QuickSlot[] = equipped.slice(0, 6).map((aid: string, i: number) => {
    const onCooldown = (cooldowns[aid] ?? 0) > currentTick;
    return {
      id: aid,
      label: aid.replace(/_/g, ' '),
      icon: '⚡',
      hotkey: String(i + 1),
      disabled: onCooldown || ap <= 0,
      onActivate: () => console.log(`[ActionBar] Activate ability: ${aid}`),
    };
  });

  // Fill empty slots to always show 6
  while (slots.length < 6) {
    const n = slots.length;
    slots.push({ id: `empty-${n}`, label: 'Empty', icon: '·', hotkey: String(n + 1), disabled: true, onActivate: () => {} });
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < slots.length && !slots[idx].disabled) {
        slots[idx].onActivate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem',
      height: '50px',
      background: 'linear-gradient(0deg, rgba(10,5,20,0.8), rgba(10,5,20,0.4))',
      borderTop: '1px solid rgba(139,92,246,0.25)',
      flexShrink: 0,
    }}>
      {/* AP Meter */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2px', marginRight: '0.35rem',
        padding: '0.15rem 0.4rem', background: 'rgba(139,92,246,0.1)', borderRadius: '4px',
        border: '1px solid rgba(139,92,246,0.2)',
      }}>
        <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AP</span>
        {Array.from({ length: maxAp }).map((_, i) => (
          <div key={i} style={{
            width: '7px', height: '12px', borderRadius: '2px',
            background: i < ap ? '#8b5cf6' : 'rgba(79,39,131,0.25)',
            border: `1px solid ${i < ap ? '#a78bfa' : 'rgba(79,39,131,0.3)'}`,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Quick Slots */}
      {slots.map(slot => (
        <button key={slot.id} onClick={slot.onActivate} disabled={slot.disabled}
          title={`${slot.label} [${slot.hotkey}]`}
          style={{
            width: '36px', height: '36px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: slot.disabled ? 'rgba(30,20,50,0.5)' : 'rgba(139,92,246,0.15)',
            border: slot.disabled ? '1px solid rgba(79,39,131,0.2)' : '1px solid rgba(139,92,246,0.4)',
            borderRadius: '5px', cursor: slot.disabled ? 'not-allowed' : 'pointer',
            color: slot.disabled ? 'rgba(200,180,220,0.25)' : '#d8b4fe',
            transition: 'all 0.15s', position: 'relative',
            opacity: slot.disabled ? 0.5 : 1,
          }}>
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{slot.icon}</span>
          <span style={{
            position: 'absolute', bottom: '-1px', right: '2px',
            fontSize: '0.5rem', color: 'rgba(167,139,250,0.5)', fontWeight: 700,
          }}>{slot.hotkey}</span>
        </button>
      ))}

      {/* Stance indicator */}
      {player?.combatStance && (
        <div style={{
          marginLeft: 'auto', padding: '0.2rem 0.6rem',
          background: 'rgba(139,92,246,0.1)', borderRadius: '4px',
          border: '1px solid rgba(139,92,246,0.2)',
          fontSize: '0.7rem', color: '#a78bfa', textTransform: 'capitalize',
        }}>
          {player.combatStance === 'aggressive' ? '🗡️' : player.combatStance === 'defensive' ? '🛡️' : '⚖️'}{' '}
          {player.combatStance}
        </div>
      )}
    </div>
  );
}

// --- Dice Tray (center-bottom glowing dice) ---
function DiceTray({ worldState, onRollResult }: { worldState?: any; onRollResult?: (result: number) => void }) {
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    setLastResult(null);
  }, [isRolling]);

  const handleRollComplete = useCallback(() => {
    const result = Math.floor(Math.random() * 20) + 1; // d20 roll
    setLastResult(result);
    setIsRolling(false);
    if (onRollResult) onRollResult(result);
  }, [onRollResult]);

  return (
    <div style={{
      height: '140px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.3rem 0.6rem',
      background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1), transparent 70%)',
      borderTop: '1px solid rgba(139,92,246,0.3)',
      borderBottom: '1px solid rgba(139,92,246,0.3)',
      position: 'relative',
    }}>
      {/* "Roll for Fate" header label */}
      <span style={{
        fontSize: '0.6rem', color: 'rgba(167,139,250,0.5)', textTransform: 'uppercase',
        letterSpacing: '0.15em', fontWeight: 700, marginBottom: '0.25rem',
      }}>
        ⚡ Roll for Fate
      </span>

      {/* Dice container with glow */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '0.5rem 1.5rem',
        border: isRolling ? '2px solid rgba(139,92,246,0.6)' : '2px solid rgba(139,92,246,0.25)',
        borderRadius: '12px',
        boxShadow: isRolling
          ? '0 0 20px rgba(139,92,246,0.4), inset 0 0 15px rgba(139,92,246,0.1)'
          : '0 0 8px rgba(139,92,246,0.15), inset 0 0 8px rgba(139,92,246,0.05)',
        background: 'rgba(10,5,20,0.4)',
        transition: 'all 0.3s ease',
        animation: !isRolling && !lastResult ? 'dicePulse 3s ease-in-out infinite' : 'none',
        cursor: 'pointer',
      }} onClick={handleRoll} title="Click to roll (or press R)">
        <div style={{
          filter: isRolling ? 'drop-shadow(0 0 12px rgba(139,92,246,0.6))' : 'drop-shadow(0 0 4px rgba(139,92,246,0.2))',
          transition: 'filter 0.3s',
        }}>
          <Dice3D isRolling={isRolling} onRollComplete={handleRollComplete} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
          {lastResult && (
            <span style={{
              fontSize: '1.3rem', fontWeight: 700, color: '#c084fc',
              textShadow: '0 0 10px rgba(139,92,246,0.6)',
              animation: 'fadeIn 0.3s ease-out',
            }}>
              {lastResult}
            </span>
          )}
        </div>
      </div>

      {/* Hint text */}
      <span style={{
        fontSize: '0.55rem', color: 'rgba(200,180,220,0.3)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginTop: '0.25rem',
      }}>
        {isRolling ? 'Rolling…' : lastResult ? `Rolled ${lastResult}` : 'Click to roll your next action'}
      </span>
    </div>
  );
}

// --- Compact HUD button ---
function HudButton({ icon, label, sub, color, textColor, onClick }: {
  icon: string; label: string; sub: string; color: string; textColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '0.45rem 0.5rem',
        background: `rgba(${color},0.13)`,
        border: `1px solid rgba(${color},0.4)`,
        color: textColor,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.72rem',
        fontWeight: 600,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.15rem',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = `rgba(${color},0.25)`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 10px rgba(${color},0.3)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = `rgba(${color},0.13)`;
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
      <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{sub}</span>
    </button>
  );
}

// --- Diegetic Action HUD: left buttons | D20 | right buttons ---
function ActionHUD({ worldState, inCombat, pendingAction, onAction, onSwitchToTravel, onRollResult }: {
  worldState?: any;
  inCombat: boolean;
  pendingAction: PendingAction | null;
  onAction: (action: PendingAction) => void;
  onSwitchToTravel: () => void;
  onRollResult: (result: number) => void;
}) {
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [preRolled, setPreRolled] = useState<number | null>(null);

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    const roll = Math.floor(Math.random() * 20) + 1;
    setPreRolled(roll);
    setLastResult(null);
    setIsRolling(true);
  }, [isRolling]);

  const handleRollComplete = useCallback((finalResult: number) => {
    setLastResult(finalResult);
    setIsRolling(false);
    onRollResult(finalResult);
  }, [onRollResult]);

  // Compute NPCs at current location for talk buttons
  const player = worldState?.player;
  const location = worldState?.locations?.find((l: any) => l.id === player?.location);
  const npcsHere = (worldState?.npcs || []).filter((npc: any) => {
    if (npc.location !== location?.id) return false;
    if (npc.isDead || npc.isHidden) return false;
    const tag = (npc.archetype || '').toUpperCase();
    if (['SOUL_ECHO', 'SHADOW', 'ANOMALY', 'PHANTOM'].includes(tag)) return false;
    return true;
  });

  // Left + right button sets
  let leftButtons: React.ReactNode;
  let rightButtons: React.ReactNode;

  if (inCombat) {
    leftButtons = (
      <>
        <HudButton icon="⚔️" label="Attack" sub="DC 12" color="239,68,68" textColor="#fca5a5"
          onClick={() => onAction({ type: 'attack', label: 'Attack', dc: 12 })} />
        <HudButton icon="🛡️" label="Defend" sub="DC 8" color="96,165,250" textColor="#93c5fd"
          onClick={() => onAction({ type: 'defend', label: 'Defend', dc: 8 })} />
      </>
    );
    rightButtons = (
      <>
        <HudButton icon="✨" label="Cast" sub="DC 15" color="192,132,252" textColor="#e9d5ff"
          onClick={() => onAction({ type: 'cast', label: 'Cast Spell', dc: 15 })} />
        <HudButton icon="💨" label="Flee" sub="DC 10" color="251,191,36" textColor="#fde68a"
          onClick={() => onAction({ type: 'flee', label: 'Flee', dc: 10 })} />
      </>
    );
  } else {
    leftButtons = (
      <>
        <HudButton icon="🔍" label="Explore" sub="DC 12" color="132,204,22" textColor="#86efac"
          onClick={() => onAction({ type: 'explore', label: 'Explore Area', dc: 12 })} />
        {npcsHere.length > 0 ? (
          <HudButton
            icon="🗣️"
            label={npcsHere.length === 1 ? npcsHere[0].name : `Talk (${npcsHere.length})`}
            sub="DC 10"
            color="168,85,247"
            textColor="#d8b4fe"
            onClick={() => onAction({ type: 'talk', label: `Talk to ${npcsHere[0].name}`, dc: 10, npcId: npcsHere[0].id })}
          />
        ) : (
          <HudButton icon="🗣️" label="Talk" sub="—" color="168,85,247" textColor="rgba(216,180,254,0.3)"
            onClick={() => {}} />
        )}
      </>
    );
    rightButtons = (
      <>
        <HudButton icon="🗺️" label="Travel" sub="map" color="96,165,250" textColor="#93c5fd"
          onClick={onSwitchToTravel} />
        <HudButton icon="🏕️" label="Rest" sub="heal" color="74,222,128" textColor="#86efac"
          onClick={() => onAction({ type: 'custom', label: 'Rest', dc: 5 })} />
      </>
    );
  }

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(139,92,246,0.3)',
      background: 'linear-gradient(0deg, rgba(10,5,20,0.85), rgba(10,5,20,0.5))',
      padding: '0.4rem 0.5rem',
    }}>
      {/* Pending roll indicator */}
      {pendingAction && (
        <div style={{
          marginBottom: '0.35rem',
          padding: '0.35rem 0.75rem',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: '6px',
          color: '#fde68a',
          fontSize: '0.78rem',
          fontWeight: 600,
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          🎲 Rolling for {pendingAction.label}…
        </div>
      )}

      {/* Horizontal layout: Left Wing | D20 | Right Wing */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        {/* Left Wing */}
        <div style={{ flex: '1 1 0', display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
          {leftButtons}
        </div>

        {/* Center: D20 Dice */}
        <div
          data-dice-tray
          onClick={handleRoll}
          title="Click to roll (or press R)"
          style={{
            flexShrink: 0,
            width: '90px',
            height: '90px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: isRolling ? '2px solid rgba(139,92,246,0.6)' : '2px solid rgba(139,92,246,0.25)',
            borderRadius: '50%',
            boxShadow: isRolling
              ? '0 0 20px rgba(139,92,246,0.4), inset 0 0 15px rgba(139,92,246,0.1)'
              : '0 0 8px rgba(139,92,246,0.15)',
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.12), transparent 70%)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            animation: !isRolling && !lastResult ? 'dicePulse 3s ease-in-out infinite' : 'none',
          }}
        >
          <div style={{
            filter: isRolling ? 'drop-shadow(0 0 12px rgba(139,92,246,0.6))' : 'drop-shadow(0 0 4px rgba(139,92,246,0.2))',
            transition: 'filter 0.3s',
          }}>
            <Dice3D isRolling={isRolling} result={preRolled ?? undefined} onRollComplete={handleRollComplete} />
          </div>
        </div>

        {/* Right Wing */}
        <div style={{ flex: '1 1 0', display: 'flex', gap: '0.35rem', justifyContent: 'flex-start' }}>
          {rightButtons}
        </div>
      </div>

      {/* Subtle hint */}
      <div style={{
        textAlign: 'center',
        fontSize: '0.5rem',
        color: 'rgba(200,180,220,0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginTop: '0.25rem',
      }}>
        {pendingAction ? 'Roll the d20 to resolve' : inCombat ? '⚔️ Choose your action' : 'What do you do?'}
      </div>
    </div>
  );
}

// --- Main GameStage ---
export function GameStage({ worldState, controller }: GameStageProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [narrativeLog, setNarrativeLog] = useState<Array<{ id: string; type: string; message: string; tick: number }>>([]);
  const [activeDialogueNpcId, setActiveDialogueNpcId] = useState<string | null>(null);
  const [showTravel, setShowTravel] = useState(false);
  const player = worldState?.player;
  const location = worldState?.locations?.find((l: any) => l.id === player?.location);
  const inCombat = !!worldState?.combatState?.active || !!worldState?.combatState;

  // Close dialogue when combat starts
  useEffect(() => {
    if (inCombat) setActiveDialogueNpcId(null);
  }, [inCombat]);

  // R key triggers dice roll (delegated to DiceTray via DOM event)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        const diceArea = document.querySelector('[data-dice-tray]');
        if (diceArea) (diceArea as HTMLElement).click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Handle dice result: resolve pending action → dispatch to engine pipeline + add to narrative log
  const handleDiceResult = useCallback((roll: number) => {
    if (!pendingAction) return;
    const success = roll >= pendingAction.dc;
    const tick = worldState?.tick ?? 0;
    const entry = {
      id: `action-${Date.now()}`,
      type: success ? 'miracle' : 'temporal_anomaly',
      tick,
      message: '',
    };

    if (pendingAction.type === 'explore') {
      // ── Ambush mechanic: 15% chance the Director interrupts with combat ──
      const ambushRoll = Math.random();
      if (ambushRoll < 0.15) {
        entry.type = 'temporal_anomaly';
        entry.message = `[Rolled ${roll} — AMBUSH!] Something lurks in the shadows! You disturbed a hostile presence while searching. Brace yourself!`;
        setNarrativeLog(prev => [...prev, entry]);
        setPendingAction(null);
        // Dispatch ENTER_COMBAT to the pipeline
        if (controller) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'ENTER_COMBAT',
            payload: { targetIds: [`ambush_creature_${Date.now()}`] },
          });
        }
        return;
      }

      if (success) {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — Success!] Your keen senses pick up something others would miss. You discover a hidden detail about this place.`;
        // Dispatch SEARCH_AREA to the engine pipeline → items added to inventory
        if (controller) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'SEARCH_AREA',
            payload: { location: player?.location },
          });
        }
      } else {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — Fail] You search the area but find nothing of note. The world keeps its secrets… for now.`;
      }
    } else if (pendingAction.type === 'talk') {
      if (success) {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — Success!] The conversation flows naturally. They seem willing to share what they know.`;
        // Dispatch INTERACT_NPC to the engine pipeline → opens dialogue
        if (controller && pendingAction.npcId) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'INTERACT_NPC',
            payload: { npcId: pendingAction.npcId },
          });
          setActiveDialogueNpcId(pendingAction.npcId);
        }
      } else {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — Fail] Your words fall flat. They eye you with suspicion and offer nothing useful.`;
      }
    } else if (pendingAction.type === 'attack' || pendingAction.type === 'defend' || pendingAction.type === 'cast' || pendingAction.type === 'flee') {
      // ── Combat tactical actions ──
      if (pendingAction.type === 'flee' && success) {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — Escaped!] You disengage and flee from combat!`;
        if (controller) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'END_COMBAT',
            payload: { reason: 'flee' },
          });
        }
      } else if (success) {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — ${pendingAction.label} Success!] Your ${pendingAction.label.toLowerCase()} strikes true!`;
        if (controller) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'COMBAT_ACTION',
            payload: { actionType: pendingAction.type, roll, success: true },
          });
        }
      } else {
        entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — ${pendingAction.label} Failed] Your ${pendingAction.label.toLowerCase()} misses the mark.`;
        if (controller) {
          controller.performAction({
            worldId: worldState?.id || '',
            playerId: player?.id || 'player_0',
            type: 'COMBAT_ACTION',
            payload: { actionType: pendingAction.type, roll, success: false },
          });
        }
      }
    } else {
      entry.message = `[Rolled ${roll} vs DC ${pendingAction.dc} — ${success ? 'Success' : 'Fail'}] ${pendingAction.label}`;
    }

    setNarrativeLog(prev => [...prev, entry]);
    setPendingAction(null);
  }, [pendingAction, worldState?.tick, worldState?.id, player?.id, player?.location, controller]);

  return (
    <div style={panelStyle}>
      {/* Top Status Bar: location / time / status */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🌍</span>
          <span style={{ color: '#c084fc', fontWeight: 600, fontSize: '0.9rem' }}>
            {location?.name || player?.location || 'The World'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'rgba(200, 180, 220, 0.5)' }}>
          {worldState?.hour !== undefined && (
            <span>🕐 {String(worldState.hour).padStart(2, '0')}:{String(worldState?.time?.minute ?? 0).padStart(2, '0')}</span>
          )}
          {worldState?.season && <span>🍃 {worldState.season}</span>}
          {player?.level !== undefined && <span>Lv {player.level}</span>}
          {player?.gold !== undefined && <span>💰 {player.gold}g</span>}
        </div>
      </div>

      {/* Phase 7: No tab bar — content driven by state */}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Combat view — renders on top when active */}
        {inCombat && (
          <CombatView worldState={worldState} />
        )}

        {/* Travel overlay */}
        {showTravel && !inCombat && (
          <TravelView worldState={worldState} />
        )}

        {/* Narrative is always present underneath (even in combat for action buttons) */}
        {!showTravel && (
          <>
            {/* Active Dialogue Panel — shown when an NPC conversation is open */}
            {activeDialogueNpcId && !inCombat && (
              <div style={{
                margin: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(168,85,247,0.08)',
                border: '1px solid rgba(168,85,247,0.3)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#d8b4fe', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🗣️ Dialogue
                  </span>
                  <button
                    onClick={() => setActiveDialogueNpcId(null)}
                    style={{
                      background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
                      color: '#fca5a5', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer',
                      fontSize: '0.7rem',
                    }}
                  >
                    ✕ End Conversation
                  </button>
                </div>
                <DialogPanel
                  state={worldState}
                  onChoose={(npcId, choiceId) => {
                    if (controller) {
                      controller.performAction({
                        worldId: worldState?.id || '',
                        playerId: player?.id || 'player_0',
                        type: 'DIALOG_CHOICE',
                        payload: { npcId, choiceId },
                      });
                    }
                  }}
                />
              </div>
            )}
            {/* Narrative view (pure chronicle) */}
            <NarrativeView
              worldState={worldState}
              narrativeLog={narrativeLog}
            />
          </>
        )}
      </div>

      {/* ── DIEGETIC ACTION HUD: buttons flanking the D20 ── */}
      <ActionHUD
        worldState={worldState}
        inCombat={inCombat}
        pendingAction={pendingAction}
        onAction={(action) => {
          setPendingAction(action);
        }}
        onSwitchToTravel={() => setShowTravel(true)}
        onRollResult={handleDiceResult}
      />

      {/* keyframe for pulse */}
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes dicePulse {
          0%, 100% { box-shadow: 0 0 8px rgba(139,92,246,0.15), inset 0 0 8px rgba(139,92,246,0.05); border-color: rgba(139,92,246,0.25); }
          50% { box-shadow: 0 0 16px rgba(139,92,246,0.3), inset 0 0 12px rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.4); }
        }
      `}</style>
    </div>
  );
}
