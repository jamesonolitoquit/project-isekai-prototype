import React, { useState } from 'react';
import styles from './CharacterWizard.module.css';

interface Props {
  worldTemplate: any;
  selectedLocationId?: string;
  onSelectLocation: (id: string) => void;
  onHoverRegion: (id: string | null) => void;
}

/**
 * WorldAnchorMap - SVG-based Tactical Map
 * 
 * Features:
 * - Stylized region hexagons (Diablo/PoE style)
 * - Theme-responsive accent colors
 * - Hover effects with lore panels
 * - Smooth transitions
 * - RPG aesthetic with glow effects
 */
export default function WorldAnchorMap({
  worldTemplate,
  selectedLocationId,
  onSelectLocation,
  onHoverRegion,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const regions = worldTemplate?.locations || [];

  if (regions.length === 0) {
    return (
      <div className={styles.map_empty_state}>
        <p>No regions available in this world.</p>
      </div>
    );
  }

  // Calculate SVG positions for hexagonal grid (Diablo-style)
  const getHexPosition = (index: number) => {
    const cols = 3;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const hexWidth = 160;
    const hexHeight = 140;
    const x = col * hexWidth + (row % 2 ? hexWidth / 2 : 0);
    const y = row * hexHeight;
    return { x, y };
  };

  // Hexagon path (6-pointed star shape for RPG feel)
  const hexPath = (cx: number, cy: number, size: number = 50) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * (Math.PI / 180);
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      points.push([px, py]);
    }
    return points.map(p => p.join(',')).join(' ');
  };

  const maxWidth = `${(regions.length > 3 ? 3 : regions.length) * 160 + 40}px`;

  return (
    <div className={styles.world_anchor_map_container} style={{ maxWidth }}>
      <svg
        viewBox="0 0 600 500"
        className={styles.world_anchor_map_svg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid background */}
        <defs>
          <radialGradient id="hexGrad" cx="30%" cy="30%">
            <stop offset="0%" stopColor="var(--ui-accent-bright)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity="0.05" />
          </radialGradient>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Render region hexagons */}
        {regions.slice(0, 9).map((region: any, idx: number) => {
          const { x, y } = getHexPosition(idx);
          const isSelected = selectedLocationId === region.id;
          const isHovered = hoveredId === region.id;

          return (
            <g key={region.id} onClick={() => onSelectLocation(region.id)}>
              {/* Hexagon background */}
              <polygon
                points={hexPath(x, y, 50)}
                className={styles.hex_region_bg}
                fill={isSelected ? 'url(#hexGrad)' : 'none'}
                stroke="var(--ui-accent)"
                strokeWidth={isSelected ? '3' : isHovered ? '2' : '1'}
                opacity={isSelected ? 1 : isHovered ? 0.8 : 0.5}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              />

              {/* Glow on selection */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r="60"
                  fill="none"
                  stroke="var(--ui-accent)"
                  strokeWidth="1"
                  opacity="0.3"
                  style={{
                    animation: 'pulse 2s infinite',
                  }}
                />
              )}

              {/* Icon/Label clickable area */}
              <circle
                cx={x}
                cy={y}
                r="35"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredId(region.id);
                  onHoverRegion(region.id);
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  onHoverRegion(null);
                }}
              />

              {/* Region icon (emoji or placeholder) */}
              <text
                x={x}
                y={y + 8}
                textAnchor="middle"
                className={styles.hex_region_icon}
                fontSize="32"
                style={{
                  cursor: 'pointer',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.5))',
                }}
              >
                {region.icon || '📍'}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tactical Insight Panel (renders below map) */}
      {hoveredId && (
        <div className={styles.tactical_insight_panel}>
          {regions.map((r: any) =>
            r.id === hoveredId ? (
              <div key={r.id} className={styles.tactical_insight_content}>
                <h4 className={styles.tactical_insight_name}>{r.name}</h4>
                <p className={styles.tactical_insight_lore}>{r.description}</p>
                {r.startingBonus && (
                  <div className={styles.tactical_insight_bonus}>
                    <strong>Bonus:</strong> {r.startingBonus}
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0% {
            r: 60px;
            opacity: 0;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            r: 75px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
