import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ── Toast system ── */
export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // ms, default 4000
}

interface GameFooterProps {
  worldState?: any;
  toasts?: Toast[];
  onDismissToast?: (id: string) => void;
}

const SHORTCUTS = [
  { keys: '1–6', desc: 'Quick slot' },
  { keys: 'R', desc: 'Roll dice' },
  { keys: 'I', desc: 'Inventory' },
  { keys: 'J', desc: 'Journal' },
  { keys: 'Esc', desc: 'Close panel' },
];

/* ── Autosave indicator logic ── */
function useAutosaveIndicator(worldState: any) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastTick = useRef<number>(0);

  useEffect(() => {
    const tick = worldState?.tick ?? 0;
    // Simulate autosave pulse every ~60 ticks
    if (tick > 0 && tick % 60 === 0 && tick !== lastTick.current) {
      lastTick.current = tick;
      setStatus('saving');
      const t = setTimeout(() => setStatus('saved'), 800);
      const t2 = setTimeout(() => setStatus('idle'), 3000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [worldState?.tick]);

  return status;
}

export function GameFooter({ worldState, toasts = [], onDismissToast }: GameFooterProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const autosave = useAutosaveIndicator(worldState);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0 || !onDismissToast) return;
    const timers = toasts.map(t => {
      const dur = t.duration ?? 4000;
      return setTimeout(() => onDismissToast(t.id), dur);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismissToast]);

  const typeColor: Record<string, string> = {
    info: '#60a5fa',
    success: '#86efac',
    warning: '#fbbf24',
    error: '#f87171',
  };

  return (
    <>
      {/* Toast Stack — bottom-center */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column-reverse', gap: '0.4rem',
          zIndex: 1100, pointerEvents: 'none', maxWidth: '420px', width: '90%',
        }}>
          {toasts.slice(-5).map(t => (
            <div key={t.id} style={{
              pointerEvents: 'auto',
              padding: '0.5rem 1rem',
              background: 'rgba(15,10,30,0.92)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${typeColor[t.type] ?? '#8b5cf6'}40`,
              borderLeft: `3px solid ${typeColor[t.type] ?? '#8b5cf6'}`,
              borderRadius: '6px',
              color: '#e2d4f0',
              fontSize: '0.78rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              cursor: 'pointer',
              animation: 'slideUp 0.3s ease-out',
            }} onClick={() => onDismissToast?.(t.id)}>
              <span style={{ color: typeColor[t.type], fontSize: '0.9rem' }}>
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
              </span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1rem',
        background: 'linear-gradient(180deg, rgba(10,5,20,0.85), rgba(5,2,12,0.95))',
        borderTop: '1px solid rgba(139,92,246,0.15)',
        fontSize: '0.68rem',
        color: 'rgba(200,180,220,0.45)',
        zIndex: 1000,
        fontFamily: "'Consolas', 'Monaco', monospace",
      }}>
        {/* Left: autosave indicator + ping */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: autosave === 'saving' ? '#fbbf24' : autosave === 'saved' ? '#86efac' : 'rgba(200,180,220,0.35)',
            transition: 'color 0.3s',
          }}>
            {autosave === 'saving' ? '⏳' : autosave === 'saved' ? '✓' : '💾'}
            {autosave === 'saving' ? 'Saving…' : autosave === 'saved' ? 'Saved' : 'Autosave'}
          </span>
          {worldState?.tick !== undefined && (
            <span>T:{worldState.tick}</span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#86efac', display: 'inline-block',
              boxShadow: '0 0 4px rgba(134,239,172,0.5)',
            }} />
            <span style={{ color: 'rgba(200,180,220,0.4)' }}>12ms</span>
          </span>
        </div>

        {/* Center: epoch + shortcuts toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {worldState?.currentEpoch && (
            <span>Epoch: {worldState.currentEpoch}</span>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShortcuts(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(200,180,220,0.45)', fontSize: '0.68rem',
                padding: '0.15rem 0.4rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              ⌨ Shortcuts
            </button>
            {showShortcuts && (
              <div style={{
                position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(15,10,30,0.95)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px',
                padding: '0.6rem 0.8rem', minWidth: '160px',
                display: 'flex', flexDirection: 'column', gap: '0.3rem',
                zIndex: 1200,
              }}>
                <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Keyboard Shortcuts
                </div>
                {SHORTCUTS.map(s => (
                  <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.7rem' }}>
                    <span style={{
                      background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                      borderRadius: '3px', padding: '0.05rem 0.35rem', color: '#d8b4fe',
                      fontFamily: 'monospace', fontSize: '0.65rem',
                    }}>{s.keys}</span>
                    <span style={{ color: 'rgba(200,180,220,0.6)' }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: settings + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={() => console.log('[Footer] Settings requested')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(200,180,220,0.45)', fontSize: '0.72rem',
              padding: '0.1rem 0.3rem',
            }}
            title="Settings"
          >
            ⚙️
          </button>
          <span style={{ color: 'rgba(200,180,220,0.3)' }}>v0.8.2-beta</span>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
