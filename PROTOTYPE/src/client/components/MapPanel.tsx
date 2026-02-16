/**
 * MapPanel.tsx — Milestone 31, Task 4
 * 
 * Visual Mapping: "Chronicle Cartography"
 * Displays world map with dynamic "Age Rot" filters
 * 
 * Features:
 * - Location grid with interactive exploration
 * - Dynamic CSS filters based on epochId and ageRot severity
 * - Visual degradation in later epochs (Twilight era)
 * - Road fracture visualization in Epoch III
 * - Tooltip lore for each location
 */

import React, { useMemo } from 'react';
import type { WorldState, Location } from '../../engine/worldEngine';

interface MapNodeStyle {
  opacity: number;
  filter: string;  // CSS filter string
  borderStyle: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

interface MapPanelProps {
  worldState: WorldState;
  onLocationSelect?: (locationId: string) => void;
  showLegend?: boolean;
}

/**
 * Calculate CSS filters based on Age Rot severity
 * Epoch I (Fracture): Minimal degradation
 * Epoch II (Waning): Moderate sepia, slight blur
 * Epoch III (Twilight): Heavy sepia, grayscale, blur, reduced opacity
 */
function calculateAgeRotFilter(epochId: string, ageRotSeverity?: string): string {
  const filters: Record<string, string> = {
    'epoch_i_fracture': 'sepia(0%) grayscale(0%) blur(0px) brightness(100%)',
    'epoch_ii_waning': 'sepia(20%) grayscale(15%) blur(1px) brightness(95%)',
    'epoch_iii_twilight': 'sepia(40%) grayscale(40%) blur(2px) brightness(85%)'
  };

  // Override with explicit ageRot severity if present
  if (ageRotSeverity === 'severe') {
    return 'sepia(60%) grayscale(60%) blur(3px) brightness(70%)';
  }
  if (ageRotSeverity === 'moderate') {
    return 'sepia(35%) grayscale(35%) blur(2px) brightness(80%)';
  }
  if (ageRotSeverity === 'mild') {
    return 'sepia(15%) grayscale(10%) blur(1px) brightness(90%)';
  }

  return filters[epochId] ?? filters['epoch_i_fracture'];
}

/**
 * Get color scheme for location based on biome
 */
function getBiomeColors(biome: string): { bg: string; text: string; border: string } {
  const schemes: Record<string, { bg: string; text: string; border: string }> = {
    'forest': { bg: '#2d5016', text: '#a8d5a8', border: '#6ba86b' },
    'village': { bg: '#8b7355', text: '#f0e68c', border: '#d2b48c' },
    'cave': { bg: '#36454f', text: '#a9a9a9', border: '#696969' },
    'shrine': { bg: '#4a3f8f', text: '#e6ccff', border: '#9370db' },
    'maritime': { bg: '#1e6bb8', text: '#87ceeb', border: '#4a90e2' },
    'mountain': { bg: '#5c4033', text: '#d2a679', border: '#a0826d' },
    'corrupted': { bg: '#4b0000', text: '#ff6b6b', border: '#cc0000' },
    'plains': { bg: '#8b8b00', text: '#ffff99', border: '#cccc00' }
  };

  return schemes[biome] ?? { bg: '#333333', text: '#cccccc', border: '#666666' };
}

/**
 * Generate node style based on epoch and Age Rot
 */
function generateMapNodeStyle(
  location: Location,
  epochId: string,
  ageRotSeverity?: string
): MapNodeStyle {
  const biomeColors = getBiomeColors(location.biome || 'plains');
  const filter = calculateAgeRotFilter(epochId, ageRotSeverity);

  let opacity = 1;
  let borderStyle = 'solid';

  // In Twilight era, roads "fracture"
  if (epochId === 'epoch_iii_twilight') {
    borderStyle = 'dashed';
    opacity = 0.85;
  }

  // If location is blighted (part of Age Rot effect), increase degradation
  if ((location as any).biome === 'corrupted') {
    opacity = 0.7;
  }

  return {
    opacity,
    filter,
    borderStyle,
    colors: biomeColors
  };
}

/**
 * MapPanel Component
 */
export const MapPanel: React.FC<MapPanelProps> = ({
  worldState,
  onLocationSelect,
  showLegend = true
}) => {
  const locations = useMemo(() => worldState.locations || [], [worldState.locations]);
  const epochId = worldState.epochId || 'epoch_i_fracture';

  // Determine Age Rot severity from metadata
  const ageRotSeverity = (worldState as any).ageRotSeverity || undefined;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>The Known Lands ({epochId})</h2>

      {/* Age Rot Indicator */}
      {ageRotSeverity && (
        <div style={{ ...styles.warning, fontSize: '12px', marginBottom: '12px' }}>
          ⚠️ Age Rot: {ageRotSeverity.toUpperCase()} — Time itself decays
        </div>
      )}

      {/* Map Grid */}
      <div style={styles.mapGrid}>
        {locations.map((location: Location) => {
          const nodeStyle = generateMapNodeStyle(location, epochId, ageRotSeverity);

          return (
            <div
              key={location.id}
              style={{
                ...styles.mapNode,
                backgroundColor: nodeStyle.colors.bg,
                borderColor: nodeStyle.colors.border,
                borderStyle: nodeStyle.borderStyle,
                opacity: nodeStyle.opacity,
                filter: nodeStyle.filter,
                cursor: onLocationSelect ? 'pointer' : 'default'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${nodeStyle.colors.border}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              onClick={() => onLocationSelect?.(location.id)}
              title={`${location.name} (${location.biome})`}
            >
              <div style={{ ...styles.locationName, color: nodeStyle.colors.text }}>
                {location.name}
              </div>
              <div style={{ fontSize: '10px', color: nodeStyle.colors.text, opacity: 0.7 }}>
                {location.biome}
              </div>

              {/* Visual indicator for discovery status */}
              {!location.discovered && (
                <div style={styles.fogOfWar}>Undiscovered</div>
              )}

              {/* Show Age Rot danger indicator in Twilight */}
              {epochId === 'epoch_iii_twilight' && (location as any).biome === 'corrupted' && (
                <div style={styles.dangerIndicator}>⚡ BLIGHTED</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={styles.legend}>
          <h3 style={{ fontSize: '12px', marginBottom: '8px' }}>Legend</h3>
          <div style={styles.legendRow}>
            <div style={{ ...styles.legendItem, backgroundColor: '#2d5016' }}>Forest</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#8b7355' }}>Village</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#1e6bb8' }}>Maritime</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#4a3f8f' }}>Shrine</div>
          </div>
          <div style={styles.legendRow}>
            <div style={{ ...styles.legendItem, backgroundColor: '#5c4033' }}>Mountain</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#36454f' }}>Cave</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#4b0000' }}>Corrupted</div>
            <div style={{ ...styles.legendItem, backgroundColor: '#8b8b00' }}>Plains</div>
          </div>

          {/* Epoch effects legend */}
          <div style={{ marginTop: '8px', fontSize: '11px', borderTop: '1px solid #666', paddingTop: '8px' }}>
            <div>📍 Epoch I: Vibrant, stable</div>
            <div>🌅 Epoch II: Faded, uncertain</div>
            <div>🌙 Epoch III: Decayed, fractured roads</div>
          </div>
        </div>
      )}

      {/* Age Rot Info Tooltip (Epoch III) */}
      {epochId === 'epoch_iii_twilight' && (
        <div style={styles.epochWarning}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>The Twilight Era</h4>
          <p style={{ margin: '0', fontSize: '12px', lineHeight: '1.4' }}>
            Age Rot has advanced. Roads crumble. Biomes wither. The Debt Collector walks these lands.
            Corrupted zones spread as temporal paradoxes take root. Seek the Chronometer before all is lost.
          </p>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#1a1a1a',
    color: '#e6e6e6',
    borderRadius: '8px',
    border: '1px solid #444',
    fontFamily: 'monospace',
    maxHeight: '600px',
    overflowY: 'auto' as const,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
  } as React.CSSProperties,

  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    color: '#a8d5a8',
    textShadow: '0 0 4px rgba(168, 213, 168, 0.5)'
  } as React.CSSProperties,

  mapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '8px',
    marginBottom: '16px'
  } as React.CSSProperties,

  mapNode: {
    padding: '12px',
    border: '2px solid',
    borderRadius: '4px',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    minHeight: '80px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center'
  } as React.CSSProperties,

  locationName: {
    fontWeight: 'bold' as const,
    fontSize: '13px',
    marginBottom: '4px'
  } as React.CSSProperties,

  fogOfWar: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#999',
    fontSize: '11px',
    fontStyle: 'italic' as const,
    opacity: 0.6
  } as React.CSSProperties,

  dangerIndicator: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    backgroundColor: '#ff0000',
    color: '#fff',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    boxShadow: '0 0 8px #ff0000'
  } as React.CSSProperties,

  legend: {
    fontSize: '11px',
    padding: '10px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    marginBottom: '12px'
  } as React.CSSProperties,

  legendRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    marginBottom: '6px'
  } as React.CSSProperties,

  legendItem: {
    padding: '4px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#fff',
    textAlign: 'center' as const,
    border: '1px solid #555'
  } as React.CSSProperties,

  warning: {
    backgroundColor: '#4b2400',
    color: '#ff9900',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ff6600',
    textAlign: 'center' as const
  } as React.CSSProperties,

  epochWarning: {
    backgroundColor: '#3d0000',
    color: '#ff6b6b',
    padding: '12px',
    borderRadius: '4px',
    border: '2px solid #cc0000',
    marginTop: '12px',
    boxShadow: '0 0 8px rgba(255, 0, 0, 0.3)'
  } as React.CSSProperties
};

export default MapPanel;
