import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipData {
  title: string;
  description: string;
  meta?: string;      // e.g. mechanics or bonus info
  secondary?: string;  // e.g. current value or lore
  icon?: string;
}

interface HoverTooltipProps {
  data: TooltipData | null;
  anchorRect: DOMRect | null;
}

/**
 * Floating tooltip that appears near the hovered element.
 * Positions itself above or below the anchor, centered horizontally.
 * Uses CSS from layout-components.css (.tooltip-container).
 */
export default function HoverTooltip({ data, anchorRect }: HoverTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!data || !anchorRect || !tooltipRef.current) {
      setPosition(null);
      return;
    }

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 12;

    // Try above first
    let top = anchorRect.top - tooltipRect.height - padding;
    let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

    // If above goes offscreen, place below
    if (top < padding) {
      top = anchorRect.bottom + padding;
    }

    // Clamp horizontal position
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    // Clamp vertical
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

    setPosition({ top, left });
  }, [data, anchorRect]);

  if (!data) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="tooltip-container"
      data-visible={position ? "true" : "false"}
      style={{
        position: 'fixed',
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        opacity: position ? 1 : 0,
        zIndex: 10001,
        pointerEvents: 'none',
        maxWidth: 300,
        background: 'var(--tooltip-bg, rgba(10, 15, 25, 0.95))',
        border: 'var(--tooltip-border, 1px solid #74b9ff)',
        borderRadius: 'var(--layout-radius, 12px)',
        padding: '1rem',
        boxShadow: 'var(--tooltip-shadow, 0 8px 32px rgba(0, 0, 0, 0.5))',
        backdropFilter: 'blur(12px)',
      }}
    >
      {data.icon && (
        <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{data.icon}</div>
      )}
      <div className="tooltip-title" style={{ fontWeight: 600, color: 'var(--wizard-accent, #74b9ff)', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
        {data.title}
      </div>
      <div className="tooltip-desc" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: data.meta ? '0.5rem' : 0 }}>
        {data.description}
      </div>
      {data.meta && (
        <div className="tooltip-meta" style={{ fontSize: '0.78rem', color: 'rgba(160,217,149,0.9)', fontStyle: 'italic', fontWeight: 600, marginBottom: data.secondary ? '0.3rem' : 0 }}>
          ⚙️ {data.meta}
        </div>
      )}
      {data.secondary && (
        <div className="tooltip-secondary" style={{ fontSize: '0.78rem', color: 'rgba(116,185,255,0.8)' }}>
          {data.secondary}
        </div>
      )}
    </div>,
    document.body
  );
}
