import React, { useRef, useEffect, useMemo } from 'react';

interface NarrativeViewProps {
  worldState?: any; // WorldState
  narrativeLog?: Array<{ id: string; type: string; message: string; tick: number }>;
  pendingAction?: { type: string; label: string; dc: number; npcId?: string } | null;
  onRequestAction?: (action: { type: 'explore' | 'talk' | 'custom'; label: string; dc: number; npcId?: string }) => void;
  onSwitchToTravel?: () => void;
}

type ChronicleKind = 'scene' | 'npc' | 'action_success' | 'action_fail' | 'ambush' | 'director' | 'system';

interface ChronicleEntry {
  id: string;
  kind: ChronicleKind;
  text: string;
  title?: string;
  meta?: string;
  tick?: number;
}

function classifyKind(entry: any): ChronicleKind {
  const t: string = (entry?.type || entry?.eventType || '').toLowerCase();
  if (/ambush|combat_init|enter_combat/i.test(t)) return 'ambush';
  if (/miracle|bless|divine|ascend|success/i.test(t)) return 'action_success';
  if (/fail|miss|block|resist/i.test(t)) return 'action_fail';
  if (/temporal|paradox|anomaly|glitch|rewind/i.test(t)) return 'director';
  return 'director';
}

// ─── Narrative Card ─────────────────────────────────────────────────────────
function NarrativeCard({ entry }: { entry: ChronicleEntry }) {
  const { kind, text, title, meta, tick } = entry;

  if (kind === 'scene') {
    // Opening scene: parchment-style, large typography with drop cap
    const firstChar = text[0] || '';
    const rest = text.slice(1);
    return (
      <div style={{
        padding: '1.5rem 1.75rem',
        background: 'linear-gradient(160deg, rgba(20,10,40,0.7), rgba(15,8,30,0.5))',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '10px',
        boxShadow: 'inset 0 0 40px rgba(10,5,20,0.5)',
        position: 'relative',
      }}>
        {/* Location nameplate */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: '0.85rem',
        }}>
          <span style={{
            fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em',
            color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace',
          }}>
            ◈ {title}
          </span>
          {meta && (
            <span style={{
              fontSize: '0.6rem', color: 'rgba(167,139,250,0.4)', fontFamily: 'monospace',
            }}>
              {meta}
            </span>
          )}
        </div>
        {/* Body with drop cap */}
        <p style={{
          margin: 0, lineHeight: 1.9, fontSize: '1.1rem',
          color: 'rgba(220,200,240,0.9)', fontFamily: 'Georgia, serif', fontStyle: 'italic',
        }}>
          <span style={{
            float: 'left', fontSize: '3rem', lineHeight: 0.75, fontWeight: 700,
            marginRight: '0.12rem', marginTop: '0.2rem',
            color: '#c084fc', fontFamily: 'Georgia, serif', fontStyle: 'normal',
            textShadow: '0 0 20px rgba(192,132,252,0.4)',
          }}>
            {firstChar}
          </span>
          {rest}
        </p>
      </div>
    );
  }

  if (kind === 'npc') {
    return (
      <div style={{
        padding: '0.85rem 1.1rem',
        background: 'rgba(139,92,246,0.07)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderLeft: '3px solid rgba(168,85,247,0.6)',
        borderRadius: '6px',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: '0.1rem' }}>🧑</span>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d8b4fe', marginBottom: '0.25rem' }}>
            {title}
          </div>
          <p style={{
            margin: 0, fontSize: '0.9rem', color: 'rgba(200,180,220,0.8)',
            fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.6,
          }}>
            "{text}"
          </p>
        </div>
      </div>
    );
  }

  if (kind === 'ambush') {
    return (
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(248,113,113,0.1))',
        border: '2px solid rgba(248,113,113,0.55)',
        borderRadius: '8px',
        boxShadow: '0 0 18px rgba(239,68,68,0.25)',
        animation: 'ambushFlash 0.6s ease-out',
      }}>
        <div style={{
          fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em',
          color: '#fca5a5', fontWeight: 700, marginBottom: '0.4rem',
        }}>
          ⚔️ AMBUSH
        </div>
        <p style={{
          margin: 0, fontSize: '1rem', color: '#fecaca',
          fontFamily: 'Georgia, serif', fontWeight: 600, lineHeight: 1.7,
        }}>
          {text}
        </p>
        {tick !== undefined && <span style={{ fontSize: '0.6rem', color: 'rgba(252,165,165,0.35)', fontFamily: 'monospace', display: 'block', marginTop: '0.35rem' }}>T{tick}</span>}
      </div>
    );
  }

  if (kind === 'action_success') {
    return (
      <div style={{
        padding: '0.75rem 1.1rem',
        background: 'rgba(251,191,36,0.07)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderLeft: '3px solid rgba(251,191,36,0.7)',
        borderRadius: '6px',
      }}>
        <p style={{
          margin: 0, fontSize: '0.92rem', color: '#fde68a',
          fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.7,
        }}>
          ✦ {text}
        </p>
        {tick !== undefined && <span style={{ fontSize: '0.6rem', color: 'rgba(253,230,138,0.35)', fontFamily: 'monospace', display: 'block', marginTop: '0.25rem' }}>T{tick}</span>}
      </div>
    );
  }

  if (kind === 'action_fail') {
    return (
      <div style={{
        padding: '0.75rem 1.1rem',
        background: 'rgba(96,165,250,0.07)',
        border: '1px solid rgba(96,165,250,0.25)',
        borderLeft: '3px solid rgba(96,165,250,0.5)',
        borderRadius: '6px',
      }}>
        <p style={{
          margin: 0, fontSize: '0.88rem', color: 'rgba(147,197,253,0.8)',
          fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.7,
        }}>
          ◦ {text}
        </p>
        {tick !== undefined && <span style={{ fontSize: '0.6rem', color: 'rgba(147,197,253,0.3)', fontFamily: 'monospace', display: 'block', marginTop: '0.25rem' }}>T{tick}</span>}
      </div>
    );
  }

  // Default: director / system entry
  const isParadox = /temporal|paradox|anomaly|glitch/i.test(entry.id + (entry.kind || ''));
  return (
    <div style={{
      padding: '0.7rem 1rem',
      background: 'rgba(10,5,20,0.45)',
      border: `1px solid ${isParadox ? 'rgba(168,85,247,0.35)' : 'rgba(139,92,246,0.18)'}`,
      borderLeft: `3px solid ${isParadox ? 'rgba(168,85,247,0.7)' : 'rgba(139,92,246,0.4)'}`,
      borderRadius: '5px',
      boxShadow: isParadox ? '0 0 10px rgba(168,85,247,0.15)' : 'none',
    }}>
      <p style={{
        margin: 0, fontSize: '0.88rem',
        color: isParadox ? '#e9d5ff' : 'rgba(200,180,220,0.75)',
        fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.65,
      }}>
        {isParadox && <span style={{ marginRight: '0.35rem' }}>🌀</span>}
        {text}
      </p>
      {tick !== undefined && <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.35)', fontFamily: 'monospace', display: 'block', marginTop: '0.25rem' }}>T{tick}</span>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function NarrativeView({ worldState, narrativeLog = [], pendingAction, onRequestAction, onSwitchToTravel }: NarrativeViewProps) {
  const player = worldState?.player;
  const location = worldState?.locations?.find((l: any) => l.id === player?.location);
  const locationName = location?.name || 'The Wilderness';
  const locationDesc = location?.description || 'Silence fills the space around you. The world holds its breath.';
  const weather = worldState?.weather || 'clear';
  const dayPhase = worldState?.dayPhase || 'morning';
  const season = worldState?.season || 'spring';
  const hour = worldState?.hour ?? 0;
  const npcsHere = (worldState?.npcs || []).filter((n: any) => n.locationId === player?.location || n.location === player?.location);
  const isInCombat = !!worldState?.combatState;

  const weatherEmoji: Record<string, string> = {
    clear: '☀️', snow: '❄️', rain: '🌧️',
    ash_storm: '🌪️', cinder_fog: '🌫️', mana_static: '⚡',
  };
  const phaseEmoji: Record<string, string> = {
    morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙',
  };

  // Build unified Chronicle stream
  const chronicle = useMemo<ChronicleEntry[]>(() => {
    const entries: ChronicleEntry[] = [];

    // 1. Scene opener
    entries.push({
      id: 'scene-open',
      kind: 'scene',
      text: locationDesc,
      title: locationName,
      meta: `${phaseEmoji[dayPhase] || '🌥️'} ${String(hour).padStart(2, '0')}:00 · ${season} · ${weatherEmoji[weather] || '🌤️'} ${weather.replace('_', ' ')}`,
    });

    // 2. NPCs present
    npcsHere.forEach((npc: any) => {
      entries.push({
        id: `npc-${npc.id}`,
        kind: 'npc',
        text: npc.dialogue || 'They stand nearby, watching.',
        title: npc.name,
      });
    });

    // 3. Director interventions + narrative log (merged timeline)
    const interventions: ChronicleEntry[] = (worldState?.narrativeInterventions || []).map((e: any) => ({
      id: e.id || `dir-${Math.random()}`,
      kind: classifyKind(e),
      text: e.message || e.text || e.description || `[${e.type || 'event'}]`,
      tick: e.tick,
    }));

    const logEntries: ChronicleEntry[] = narrativeLog.map(e => ({
      id: e.id,
      kind: classifyKind(e),
      text: e.message,
      tick: e.tick,
    }));

    entries.push(...interventions, ...logEntries);
    return entries;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationDesc, locationName, dayPhase, hour, season, weather, npcsHere.length, worldState?.narrativeInterventions?.length, narrativeLog.length]);

  const feedEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chronicle.length]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── THE CHRONICLE (scrolling narrative canvas, 70% of space) ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem 1rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(139,92,246,0.3) transparent',
      }}>

        {/* Combat banner inline in chronicle */}
        {isInCombat && (
          <div style={{
            padding: '0.75rem 1.1rem',
            background: 'linear-gradient(135deg, rgba(248,113,113,0.2), rgba(239,68,68,0.12))',
            border: '2px solid rgba(248,113,113,0.5)',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(248,113,113,0.2)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fca5a5' }}>
              ⚔️ Combat is active — see Combat tab
            </span>
          </div>
        )}

        {/* All chronicle cards */}
        {chronicle.map(entry => (
          <NarrativeCard key={entry.id} entry={entry} />
        ))}

        <div ref={feedEndRef} />
      </div>

      {/* ── "WHAT DO YOU DO?" ACTION ANCHOR (bottom 30%) ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(139,92,246,0.15)',
        background: 'linear-gradient(0deg, rgba(10,5,20,0.7) 0%, rgba(10,5,20,0) 100%)',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}>
        {/* Pending roll indicator */}
        {pendingAction ? (
          <div style={{
            padding: '0.65rem 1rem',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: '6px',
            color: '#fde68a',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            🎲 Rolling for {pendingAction.label}…
          </div>
        ) : (
          <>
            {/* Section label */}
            <div style={{
              fontSize: '0.6rem', color: 'rgba(167,139,250,0.4)', textTransform: 'uppercase',
              letterSpacing: '0.15em', fontWeight: 700, textAlign: 'center',
            }}>
              What do you do?
            </div>

            {/* Action buttons row */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* Explore Area */}
              <ActionButton
                icon="🔍"
                label="Explore"
                sub="DC 12"
                color="132,204,22"
                textColor="#86efac"
                onClick={() => onRequestAction?.({ type: 'explore', label: 'Explore Area', dc: 12 })}
              />
              {/* Travel */}
              <ActionButton
                icon="🗺️"
                label="Travel"
                sub="map"
                color="96,165,250"
                textColor="#93c5fd"
                onClick={() => onSwitchToTravel?.()}
              />
              {/* Talk to NPCs */}
              {npcsHere.map((npc: any) => (
                <ActionButton
                  key={npc.id}
                  icon="🗣️"
                  label={`Talk: ${npc.name}`}
                  sub="DC 10"
                  color="168,85,247"
                  textColor="#d8b4fe"
                  onClick={() => onRequestAction?.({ type: 'talk', label: `Talk to ${npc.name}`, dc: 10, npcId: npc.id })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes ambushFlash {
          0% { opacity: 0; transform: scaleY(0.85); }
          60% { opacity: 1; transform: scaleY(1.02); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Compact action button ────────────────────────────────────────────────────
function ActionButton({ icon, label, sub, color, textColor, onClick }: {
  icon: string; label: string; sub: string; color: string; textColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 auto',
        minWidth: '100px',
        padding: '0.55rem 0.75rem',
        background: `rgba(${color},0.13)`,
        border: `1px solid rgba(${color},0.4)`,
        color: textColor,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.78rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        transition: 'all 0.15s',
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
      <span>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: '0.6rem', opacity: 0.5, flexShrink: 0 }}>{sub}</span>
    </button>
  );
}
  const isInCombat = !!worldState?.combatState;
  const directorFeed: any[] = [...(worldState?.narrativeInterventions || []), ...narrativeLog];

  const feedEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [directorFeed.length]);

  const weatherEmoji: Record<string, string> = {
    clear: '☀️',
    snow: '❄️',
    rain: '🌧️',
    ash_storm: '🌪️',
    cinder_fog: '🌫️',
    mana_static: '⚡',
  };
  const phaseEmoji: Record<string, string> = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌇',
    night: '🌙',
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem 0.6rem',
        gap: '1.5rem',
      }}
    >
      {/* Combat Alert (if active) */}
      {isInCombat && (
        <div style={{
          width: '100%',
          maxWidth: '600px',
          padding: '1rem',
          background: 'linear-gradient(135deg, rgba(248,113,113,0.2), rgba(239,68,68,0.15))',
          border: '2px solid #f87171',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 0 20px rgba(248,113,113,0.3)',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fca5a5', marginBottom: '0.25rem' }}>
            ⚔️ COMBAT INITIATED!
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
            A hostile encounter has triggered.
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(252,165,165,0.7)' }}>
            Switch to the Combat tab to engage.
          </div>
        </div>
      )}

      {/* Location Header Card */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        padding: '1rem',
        background: 'linear-gradient(180deg, rgba(139,92,246,0.12), rgba(79,39,131,0.08))',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.2rem',
            color: '#c084fc',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
          }}>
            📍 {locationName}
          </h2>
          <div style={{
            fontSize: '0.7rem',
            color: 'rgba(200,180,220,0.6)',
            textAlign: 'right',
            fontFamily: 'monospace',
          }}>
            <div>{String(hour).padStart(2, '0')}:00</div>
            <div>{season}</div>
          </div>
        </div>

        {/* Weather and time info */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.75rem',
          color: 'rgba(200,180,220,0.6)',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
        }}>
          <span>{phaseEmoji[dayPhase] || '🌥️'} {dayPhase}</span>
          <span>{weatherEmoji[weather] || '🌤️'} {weather.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Story/Narrative Text */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        padding: '1.5rem',
        background: 'rgba(10,5,20,0.4)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0,
          color: 'rgba(200,180,220,0.9)',
          fontSize: '0.95rem',
          lineHeight: 1.8,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
        }}>
          {locationDesc}
        </p>
      </div>

      {/* AI Director Narrative Feed */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        padding: '0.75rem 1rem',
        background: 'rgba(10,5,20,0.5)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.6rem',
        }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a78bfa', fontWeight: 700 }}>
            ◈ Director Feed
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.2)' }} />
        </div>

        {directorFeed.length === 0 ? (
          <p style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'rgba(200,180,220,0.3)',
            fontStyle: 'italic',
            fontFamily: 'monospace',
            textAlign: 'center',
            padding: '0.5rem 0',
          }}>
            — Ambient silence... —
          </p>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            maxHeight: '220px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139,92,246,0.4) transparent',
          }}>
            {directorFeed.slice(-12).map((entry: any, idx: number) => {
              const type: string = entry?.type || entry?.eventType || '';
              const isTemporal = /temporal|glitch|paradox|anomaly|rewind/i.test(type);
              const isMiracle = /miracle|bless|divine|wish|ascend/i.test(type);
              const glowColor = isMiracle
                ? 'rgba(251,191,36,0.6)'
                : isTemporal
                ? 'rgba(168,85,247,0.7)'
                : 'rgba(139,92,246,0.25)';
              const textColor = isMiracle ? '#fde68a' : isTemporal ? '#e9d5ff' : 'rgba(200,180,220,0.75)';
              const borderColor = isMiracle
                ? 'rgba(251,191,36,0.45)'
                : isTemporal
                ? 'rgba(168,85,247,0.5)'
                : 'rgba(139,92,246,0.2)';

              return (
                <div
                  key={entry?.id ?? idx}
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: `rgba(10,5,20,0.6)`,
                    border: `1px solid ${borderColor}`,
                    borderLeft: `3px solid ${glowColor}`,
                    borderRadius: '4px',
                    boxShadow: (isTemporal || isMiracle) ? `0 0 8px ${glowColor}` : 'none',
                    fontSize: '0.78rem',
                    color: textColor,
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}
                >
                  {isMiracle && <span style={{ marginRight: '0.35rem' }}>✨</span>}
                  {isTemporal && <span style={{ marginRight: '0.35rem' }}>🌀</span>}
                  {entry?.message || entry?.text || entry?.description || `[${type}]`}
                  {entry?.tick !== undefined && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: 'rgba(167,139,250,0.4)', fontFamily: 'monospace', fontStyle: 'normal' }}>
                      T{entry.tick}
                    </span>
                  )}
                </div>
              );
            })}
            <div ref={feedEndRef} />
          </div>
        )}
      </div>

      {/* NPCs Present Section */}
      {npcsHere.length > 0 && (
        <div style={{
          width: '100%',
          maxWidth: '600px',
          padding: '1rem',
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#a78bfa',
            marginBottom: '0.75rem',
          }}>
            Present in this location
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {npcsHere.map((npc: any) => (
              <div key={npc.id} style={{
                padding: '0.75rem',
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: '6px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.4rem',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>🧑</span>
                  <span style={{ fontWeight: 600, color: '#d8b4fe' }}>{npc.name}</span>
                  {npc.role && (
                    <span style={{
                      fontSize: '0.65rem',
                      color: 'rgba(167,139,250,0.6)',
                      textTransform: 'capitalize',
                    }}>
                      {npc.role}
                    </span>
                  )}
                </div>
                <p style={{
                  margin: '0.3rem 0',
                  fontSize: '0.8rem',
                  color: 'rgba(200,180,220,0.7)',
                  fontStyle: 'italic',
                }}>
                  "{npc.dialogue || 'Hello, traveler...'}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── "What do you do?" Contextual Action Menu ─── */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        <div style={{
          fontSize: '0.72rem', color: 'rgba(200,180,220,0.5)', textTransform: 'uppercase',
          letterSpacing: '0.12em', fontWeight: 700, marginBottom: '0.15rem', textAlign: 'center',
        }}>
          What do you do?
        </div>

        {/* Pending action indicator */}
        {pendingAction && (
          <div style={{
            padding: '0.65rem 1rem',
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: '6px',
            color: '#fde68a',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            🎲 Rolling for {pendingAction.label}…
          </div>
        )}

        {/* Action buttons (hidden while a roll is pending) */}
        {!pendingAction && (
          <>
            {/* Explore Area */}
            <button style={{
              padding: '0.75rem 1rem',
              background: 'rgba(132,204,22,0.15)',
              border: '1px solid rgba(132,204,22,0.4)',
              color: '#86efac',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(132,204,22,0.25)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(132,204,22,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(132,204,22,0.15)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              onClick={() => onRequestAction?.({ type: 'explore', label: 'Explore Area', dc: 12 })}
            >
              <span>🔍</span>
              <span>Explore Area</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(134,239,172,0.5)' }}>Perception DC 12</span>
            </button>

            {/* Travel */}
            <button style={{
              padding: '0.75rem 1rem',
              background: 'rgba(96,165,250,0.15)',
              border: '1px solid rgba(96,165,250,0.4)',
              color: '#93c5fd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.25)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(96,165,250,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.15)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              onClick={() => onSwitchToTravel?.()}
            >
              <span>🗺️</span>
              <span>Travel</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(147,197,253,0.5)' }}>View map</span>
            </button>

            {/* Talk to NPCs (one button per NPC present) */}
            {npcsHere.map((npc: any) => (
              <button key={npc.id} style={{
                padding: '0.75rem 1rem',
                background: 'rgba(168,85,247,0.15)',
                border: '1px solid rgba(168,85,247,0.4)',
                color: '#d8b4fe',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.25)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(168,85,247,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.15)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                onClick={() => onRequestAction?.({ type: 'talk', label: `Talk to ${npc.name}`, dc: 10, npcId: npc.id })}
              >
                <span>🗣️</span>
                <span>Talk to {npc.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(216,180,254,0.5)' }}>Charisma DC 10</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
