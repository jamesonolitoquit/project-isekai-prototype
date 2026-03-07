import React, { useState, useCallback, useRef } from 'react';

interface CollapsiblePanelProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number | string;
  persistKey?: string;
  accentColor?: string;
}

function getPersistedState(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  try {
    const v = localStorage.getItem(`panel:${key}`);
    return v !== null ? v === '1' : fallback;
  } catch { return fallback; }
}

function persistState(key: string | undefined, open: boolean) {
  if (!key) return;
  try { localStorage.setItem(`panel:${key}`, open ? '1' : '0'); } catch {}
}

export function CollapsiblePanel({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
  persistKey,
  accentColor = 'rgba(139, 92, 246, 0.4)',
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(() => getPersistedState(persistKey, defaultOpen));
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      persistState(persistKey, next);
      return next;
    });
  }, [persistKey]);

  return (
    <div style={{
      borderBottom: '1px solid rgba(79,39,131,0.2)',
      background: isOpen
        ? 'linear-gradient(180deg, rgba(139,92,246,0.04), transparent)'
        : 'transparent',
      transition: 'background 0.2s',
    }}>
      {/* Compact header — 28px */}
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0 0.6rem', height: '28px', textAlign: 'left', width: '100%',
          color: '#c084fc', fontWeight: 600, fontSize: '0.72rem',
          textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none',
          transition: 'background 0.15s',
          borderLeft: isOpen ? `3px solid ${accentColor}` : '3px solid transparent',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139, 92, 246, 0.06)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        aria-expanded={isOpen}
      >
        {icon && <span style={{ fontSize: '0.8rem', filter: isOpen ? 'drop-shadow(0 0 3px rgba(139,92,246,0.4))' : 'none' }}>{icon}</span>}
        <span style={{ flex: 1 }}>{title}</span>
        {badge !== undefined && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 700,
            background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)',
            color: '#c084fc', borderRadius: '10px', padding: '0 6px', minWidth: '16px', textAlign: 'center',
            lineHeight: '16px',
          }}>{badge}</span>
        )}
        <span style={{
          fontSize: '0.5rem', opacity: 0.5, transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
        }}>▲</span>
      </button>

      {/* Collapsible body */}
      <div
        ref={contentRef}
        style={{
          maxHeight: isOpen ? '180px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease-in-out',
        }}
      >
        <div style={{
          padding: '0 0.6rem 0.5rem',
          overflowY: 'auto', maxHeight: '160px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(139,92,246,0.25) transparent',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
