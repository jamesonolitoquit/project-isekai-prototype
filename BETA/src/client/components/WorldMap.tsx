/**
 * ALPHA_M9: World Atlas Visual Component
 * 
 * Interactive SVG map showing:
 * - Location dots with fog of war
 * - Player position and movement
 * - Travel markers and routes
 * - Biome-based coloring
 * - Discovery state
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { WorldState, Location } from '../../engine/worldEngine';
import {
  getDiscoveredLocations,
  getMapViewport,
  getDistanceToPlayer,
  estimateTravelTime,
  type MapViewport,
} from '../../engine/mapEngine';

interface WorldMapProps {
  state?: WorldState;
  onLocationClick?: (locationId: string) => void;
  width?: number;
  height?: number;
}

// Biome colors for map visualization
const BIOME_COLORS: Record<string, string> = {
  'forest': '#2d5016',        // Dark green
  'cave': '#3d3d3d',          // Dark gray
  'village': '#8b7355',       // Brown
  'corrupted': '#8b0000',     // Dark red
  'shrine': '#4169e1',        // Royal blue
  'maritime': '#20b2aa',      // Light sea green
  'mountain': '#8b8b83',      // Gray-brown
  'plains': '#9acd32',        // Yellow-green
};

const BIOME_GLOW: Record<string, string> = {
  'forest': '#66bb6a',
  'cave': '#757575',
  'village': '#d7ccc8',
  'corrupted': '#f44336',
  'shrine': '#42a5f5',
  'maritime': '#4dd0e1',
  'mountain': '#bdbdbd',
  'plains': '#cddc39',
};

export default function WorldMap({
  state,
  onLocationClick,
  width = 800,
  height = 600,
}: WorldMapProps) {
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
  const [previousEventTick, setPreviousEventTick] = useState<number>(-1);

  // Watch for location discovery events
  useEffect(() => {
    if (!state || !state.events) return;
    
    const currentTick = state.tick ?? 0;
    
    // Process new events (events added since last render)
    const newEvents = state.events.filter(e => e.type === 'LOCATION_DISCOVERED');
    
    if (newEvents.length > 0 && currentTick !== previousEventTick) {
      newEvents.forEach(event => {
        const locationName = event.payload?.name || 'Unknown Location';
        const toastId = `${event.id}-${Date.now()}`;
        
        setToasts(prev => [
          ...prev,
          {
            id: toastId,
            message: `🗺️ ${locationName} discovered!`,
            timestamp: Date.now()
          }
        ]);
        
        // Auto-remove toast after 3 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 3000);
      });
      
      setPreviousEventTick(currentTick);
    }
  }, [state, previousEventTick]);

  if (!state) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
        World state not available
      </div>
    );
  }

  const playerLocationId = state.player?.location;
  const viewport = playerLocationId
    ? getMapViewport(state, playerLocationId, 300)
    : { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

  // Calculate SVG scale
  const scaleX = width / (viewport.maxX - viewport.minX);
  const scaleY = height / (viewport.maxY - viewport.minY);

  // Convert world coordinates to SVG coordinates
  const worldToSvg = (x: number, y: number) => ({
    x: (x - viewport.minX) * scaleX,
    y: (y - viewport.minY) * scaleY,
  });

  const discoveredLocations = getDiscoveredLocations(state);
  const allLocations = state.locations;

  // Render undiscovered locations as fog
  const undiscoveredLocations = allLocations.filter(l => !l.discovered);

  return (
    <div
      style={{
        backgroundColor: '#0a0e27',
        borderRadius: 8,
        padding: 16,
        border: '2px solid #4a5568',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', color: '#fff' }}>🗺️ World Atlas</h3>

      <svg
        width={width}
        height={height}
        style={{
          backgroundColor: '#1a1f3a',
          borderRadius: 4,
          border: '1px solid #4a5568',
          cursor: 'grab',
          display: 'block',
        }}
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f1419" />
            <stop offset="100%" stopColor="#1a2642" />
          </linearGradient>
          
          {/* Glow filters for locations */}
          <filter id="locationGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={width} height={height} fill="url(#bgGradient)" />

        {/* Fog of War: Undiscovered locations as grayed circles */}
        {undiscoveredLocations.map(loc => {
          if (loc.x === undefined || loc.y === undefined) return null;
          const svg = worldToSvg(loc.x, loc.y);
          return (
            <g key={`fog-${loc.id}`}>
              {/* Fog circle */}
              <circle
                cx={svg.x}
                cy={svg.y}
                r={12}
                fill="#4a5568"
                opacity={0.4}
                stroke="#2d3748"
                strokeWidth={1}
              />
              {/* Question mark */}
              <text
                x={svg.x}
                y={svg.y}
                textAnchor="middle"
                dy="0.3em"
                fill="#718096"
                fontSize="10"
                fontWeight="bold"
                pointerEvents="none"
              >
                ?
              </text>
            </g>
          );
        })}

        {/* Discovered locations */}
        {discoveredLocations.map(loc => {
          if (loc.x === undefined || loc.y === undefined) return null;

          const biome = (loc.biome as string) || 'forest';
          const color = BIOME_COLORS[biome];
          const glow = BIOME_GLOW[biome];
          const isHovered = hoveredLocationId === loc.id;
          const isPlayerLocation = playerLocationId === loc.id;
          const radius = isPlayerLocation ? 10 : isHovered ? 9 : 7;

          const svg = worldToSvg(loc.x, loc.y);

          return (
            <g
              key={loc.id}
              onMouseEnter={() => setHoveredLocationId(loc.id)}
              onMouseLeave={() => setHoveredLocationId(null)}
              onClick={() => onLocationClick?.(loc.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow ring when hovered */}
              {isHovered && (
                <circle
                  cx={svg.x}
                  cy={svg.y}
                  r={radius + 4}
                  fill="none"
                  stroke={glow}
                  strokeWidth={2}
                  opacity={0.6}
                  filter="url(#locationGlow)"
                />
              )}

              {/* Player indicator (star) */}
              {isPlayerLocation && (
                <polygon
                  points={`${svg.x},${svg.y - 12} ${svg.x + 4},${svg.y - 3} ${svg.x + 12},${svg.y - 3} ${svg.x + 6},${svg.y + 3} ${svg.x + 8},${svg.y + 11} ${svg.x},${svg.y + 6} ${svg.x - 8},${svg.y + 11} ${svg.x - 6},${svg.y + 3} ${svg.x - 12},${svg.y - 3} ${svg.x - 4},${svg.y - 3}`}
                  fill="#ffd700"
                  stroke="#ffed4e"
                  strokeWidth={1}
                  filter="url(#locationGlow)"
                />
              )}

              {/* Location circle */}
              <circle
                cx={svg.x}
                cy={svg.y}
                r={radius}
                fill={color}
                stroke={glow}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isPlayerLocation ? 0.9 : 0.7}
                filter={isHovered ? 'url(#locationGlow)' : undefined}
              />

              {/* Location label (only on hover) */}
              {isHovered && (
                <g>
                  {/* Label background */}
                  <rect
                    x={svg.x - 40}
                    y={svg.y - 28}
                    width={80}
                    height={24}
                    fill="#1a1f3a"
                    stroke={glow}
                    strokeWidth={1}
                    rx={4}
                  />
                  {/* Location name */}
                  <text
                    x={svg.x}
                    y={svg.y - 10}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="11"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {loc.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Travel route visualization (if traveling) */}
        {state.travelState?.isTraveling && (
          (() => {
            const fromLoc = state.locations.find(l => l.id === state.travelState?.fromLocationId);
            const toLoc = state.locations.find(l => l.id === state.travelState?.toLocationId);

            if (
              !fromLoc || !toLoc || 
              fromLoc.x === undefined || toLoc.x === undefined ||
              fromLoc.y === undefined || toLoc.y === undefined
            ) {
              return null;
            }

            const fromSvg = worldToSvg(fromLoc.x, fromLoc.y);
            const toSvg = worldToSvg(toLoc.x, toLoc.y);

            // Calculate travel progress
            const progress = state.travelState.ticksPerTravelSession
              ? 1 - state.travelState.remainingTicks / state.travelState.ticksPerTravelSession
              : 0;

            // Interpolate current position
            const currentX = fromSvg.x + (toSvg.x - fromSvg.x) * progress;
            const currentY = fromSvg.y + (toSvg.y - fromSvg.y) * progress;

            return (
              <g>
                {/* Travel line */}
                <line
                  x1={fromSvg.x}
                  y1={fromSvg.y}
                  x2={toSvg.x}
                  y2={toSvg.y}
                  stroke="#66bb6a"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  opacity={0.5}
                />

                {/* Travel marker (player in transit) */}
                <circle
                  cx={currentX}
                  cy={currentY}
                  r={8}
                  fill="#ffd700"
                  stroke="#ffed4e"
                  strokeWidth={2}
                  filter="url(#locationGlow)"
                />

                {/* Progress percentage */}
                <text
                  x={currentX}
                  y={currentY - 15}
                  textAnchor="middle"
                  fill="#66bb6a"
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {Math.round(progress * 100)}%
                </text>
              </g>
            );
          })()
        )}
      </svg>

      {/* Tooltip with location info */}
      {hoveredLocationId && (
        (() => {
          const hoveredLoc = state.locations.find(l => l.id === hoveredLocationId);
          if (!hoveredLoc) return null;

          const travelTime =
            playerLocationId !== hoveredLocationId
              ? estimateTravelTime(state, playerLocationId, hoveredLocationId)
              : null;

          return (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                backgroundColor: '#2d3748',
                borderRadius: 4,
                borderLeft: `4px solid ${BIOME_COLORS[(hoveredLoc.biome as string) || 'forest']}`,
                fontSize: 12,
                color: '#e2e8f0',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{hoveredLoc.name}</div>
              {hoveredLoc.description && (
                <div style={{ fontSize: 11, color: '#cbd5e0', marginBottom: 4 }}>
                  {hoveredLoc.description}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#a0aec0' }}>
                Biome: {hoveredLoc.biome}
              </div>
              {travelTime && (
                <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 4 }}>
                  Travel: {travelTime.label}
                </div>
              )}
              {hoveredLoc.spiritDensity !== undefined && (
                <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 4 }}>
                  Spirit Density: {Math.round(hoveredLoc.spiritDensity * 100)}%
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Map legend */}
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
          fontSize: 11,
        }}
      >
        {Object.entries(BIOME_COLORS)
          .slice(0, 6)
          .map(([biome, color]) => (
            <div key={biome} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: color,
                }}
              />
              <span style={{ color: '#a0aec0', textTransform: 'capitalize' }}>{biome}</span>
            </div>
          ))}
      </div>

      {/* Debug info */}
      {state.travelState?.isTraveling && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            backgroundColor: '#1a202c',
            borderRadius: 4,
            fontSize: 10,
            color: '#718096',
          }}
        >
          Travel: {state.travelState.fromLocationId} →{' '}
          {state.travelState.toLocationId} ({state.travelState.remainingTicks} ticks remaining)
        </div>
      )}

      {/* Toast notifications for discoveries */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '12px 16px',
              backgroundColor: '#2d5016',
              border: '2px solid #66bb6a',
              borderRadius: 6,
              color: '#66bb6a',
              fontSize: 13,
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(102, 187, 106, 0.3)',
              animation: 'slideIn 0.3s ease-out',
              minWidth: 200,
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
