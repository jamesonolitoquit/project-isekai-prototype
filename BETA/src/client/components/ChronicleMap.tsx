/**
 * M49-A1: Chronicle Map Integration + Faction Territory Sovereignty
 * 
 * Purpose: Display world map with faction territory control visualization
 * 
 * Features:
 * - Absolute positioning using Location.x/y coordinates
 * - Faction territory coloring based on influenceMap dominance
 * - Interactive world fragment markers (ruins, shrines, monuments)
 * - Historical tooltips from chronicle engine
 * - Fragment type icons and durability visualization
 * - Age rot visual degradation per epoch
 * - Territory ownership indicators and faction legends
 * - M52-D1: World scars visualization with healing progress
 * 
 * Integration:
 * - Queries worldFragmentEngine for fragments by location
 * - Queries chronicleEngine for historical events linked to fragments
 * - Subscribes to state.worldFragments and state.epochs
 * - M49-A1: Integrates factionTerritoryEngine for territory visualization
 * - M52-D1: Integrates worldScarsEngine for scar visualization
 */

import React, { useMemo, useState } from 'react';
import type { WorldState, Location } from '../../engine/worldEngine';
import type { WorldScar } from '../../engine/worldScarsEngine';
import type { UIWorldModel, UILocation } from '../../types/uiModel';
import { toUIModel } from '../../types/uiModel';
import { getLocationControllingFaction, getTerritoryOpacity, isLocationContested } from '../../engine/factionTerritoryEngine';

interface MapNodeStyle {
  opacity: number;
  filter: string;
  borderStyle: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

interface WorldFragment {
  id: string;
  type: 'building' | 'garden' | 'landmark' | 'shrine' | 'monument' | 'ruin' | 'statue' | 'road' | 'bridge';
  name: string;
  locationId: string;
  durability: number;
  description: string;
  creatorId?: string;
  historicalEvent?: {
    description: string;
    narrative: string;
    type: string;
  };
}

interface FragmentMarkerProps {
  fragment: WorldFragment;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

interface ChronicleMapProps {
  worldState: WorldState | null;
  onLocationSelect?: (locationId: string) => void;
  showLegend?: boolean;
  useAbsolutePositioning?: boolean;
  // M52-D1: World scars visualization
  worldScars?: WorldScar[];
}

/**
 * Get fragment icon based on type
 */
function getFragmentIcon(type: string): string {
  const icons: Record<string, string> = {
    'ruin': '🏚️',
    'shrine': '⛩️',
    'monument': '🗿',
    'statue': '📿',
    'building': '🏛️',
    'garden': '🌿',
    'landmark': '⭐',
    'road': '🛣️',
    'bridge': '🌉',
  };
  return icons[type] ?? '📍';
}

/**
 * Get fragment color based on durability
 */
function getFragmentColor(durability: number): string {
  if (durability >= 0.8) return '#4ade80'; // Green - pristine
  if (durability >= 0.6) return '#fbbf24'; // Amber - weathered
  if (durability >= 0.4) return '#f97316'; // Orange - crumbling
  if (durability >= 0.2) return '#ef4444'; // Red - ruined
  return '#6b7280'; // Gray - destroyed
}

/**
 * Fragment state label
 */
function getFragmentState(durability: number): string {
  if (durability >= 0.8) return 'pristine';
  if (durability >= 0.6) return 'weathered';
  if (durability >= 0.4) return 'crumbling';
  if (durability >= 0.2) return 'ruined';
  return 'destroyed';
}

/**
 * M52-D1: Get scar icon based on type
 */
function getScarIcon(scarType: string): string {
  const icons: Record<string, string> = {
    'BATTLEFIELD': '⚔️',
    'PLAGUE': '🪦',
    'INVASION': '🔥',
    'CELESTIAL': '✨',
    'FAMINE': '💀',
    'CORRUPTION': '🌑',
    'CATACLYSM': '⛓️'
  };
  return icons[scarType] ?? '✦';
}

/**
 * M52-D1: Get scar color based on healing progress
 */
function getScarColor(healingProgress: number): string {
  if (healingProgress >= 0.7) return '#4ade80'; // Green - mostly healed
  if (healingProgress >= 0.4) return '#fbbf24'; // Amber - healing
  return '#ef4444'; // Red - fresh/severe
}

/**
 * FragmentMarker component - Interactive fragment overlay
 */
function FragmentMarker({ fragment, isHovered, onHover }: FragmentMarkerProps): React.ReactElement {
  const icon = getFragmentIcon(fragment.type);
  const color = getFragmentColor(fragment.durability);
  const state = getFragmentState(fragment.durability);

  return (
    <div
      style={{
        position: 'absolute',
        fontSize: '20px',
        cursor: 'help',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'scale(1.3)' : 'scale(1)',
        filter: isHovered ? 'drop-shadow(0 0 12px rgba(255,255,255,0.8))' : 'drop-shadow(0 0 4px rgba(0,0,0,0.5))',
        zIndex: isHovered ? 100 : 1,
      }}
      onMouseEnter={() => onHover(fragment.id)}
      onMouseLeave={() => onHover(null)}
      title={`${fragment.name} (${state})`}
    >
      {icon}
    </div>
  );
}

/**
 * Fragment tooltip - Historical context
 */
function FragmentTooltip({ fragment }: { fragment: WorldFragment }): React.ReactElement {
  const state = getFragmentState(fragment.durability);
  const color = getFragmentColor(fragment.durability);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1f2937',
        border: `2px solid ${color}`,
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '8px',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        boxShadow: `0 4px 12px rgba(0,0,0,0.5), 0 0 20px ${color}40`,
        fontSize: '11px',
        color: '#e6e6e6',
        maxWidth: '200px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 'bold', color, marginBottom: '4px' }}>
        {getFragmentIcon(fragment.type)} {fragment.name}
      </div>
      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>
        State: {state} ({Math.round(fragment.durability * 100)}%)
      </div>
      <div style={{ fontSize: '10px', lineHeight: '1.3', color: '#bbb' }}>
        {fragment.description}
      </div>
      {fragment.historicalEvent && (
        <div style={{ fontSize: '10px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #444', fontStyle: 'italic', color: '#888' }}>
          "{fragment.historicalEvent.narrative}"
        </div>
      )}
    </div>
  );
}

/**
 * Calculate Age Rot filter based on epoch
 */
function calculateAgeRotFilter(epochId: string): string {
  const filters: Record<string, string> = {
    'epoch_i_fracture': 'sepia(0%) grayscale(0%) blur(0px) brightness(100%)',
    'epoch_ii_waning': 'sepia(20%) grayscale(15%) blur(1px) brightness(95%)',
    'epoch_iii_twilight': 'sepia(40%) grayscale(40%) blur(2px) brightness(85%)'
  };
  return filters[epochId] ?? filters['epoch_i_fracture'];
}

/**
 * Get biome colors
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
 * Generate map node style
 */
function generateMapNodeStyle(location: UILocation, epochId: string): MapNodeStyle {
  const biomeColors = getBiomeColors(location.biome || 'plains');
  const filter = calculateAgeRotFilter(epochId);
  let opacity = 1;
  let borderStyle = 'solid';

  if (epochId === 'epoch_iii_twilight') {
    borderStyle = 'dashed';
    opacity = 0.85;
  }

  if (location.biome === 'corrupted') {
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
 * ChronicleMap Component - Absolute positioning with fragments
 */
export const ChronicleMap: React.FC<ChronicleMapProps> = ({
  worldState,
  onLocationSelect,
  showLegend = true,
  useAbsolutePositioning = true,
  worldScars = []
}) => {
  // Handle null worldState
  if (!worldState) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#1a1a1a',
        color: '#e0e0e0',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p>Loading world map...</p>
      </div>
    );
  }

  // Convert to UI model for type-safe spatial access
  const uiModel = useMemo(() => toUIModel(worldState), [worldState]);
  const locations = useMemo(() => uiModel.locations, [uiModel]);
  const worldFragments = useMemo(() => uiModel.worldFragments, [uiModel]);
  const epochId = 'epoch_i_fracture'; // [M48-A4: Disabled - epochId not on WorldState]
  const [hoveredFragmentId, setHoveredFragmentId] = useState<string | null>(null);
  // M52-D1: Track hovered scar
  const [hoveredScarId, setHoveredScarId] = useState<string | null>(null);

  // Fragments already available from UIModel
  const fragments = worldFragments;

  // Group fragments by location
  const fragmentsByLocation = useMemo(() => {
    const map = new Map<string, any[]>();
    fragments.forEach((frag: any) => {
      if (!map.has(frag.locationId)) {
        map.set(frag.locationId, []);
      }
      map.get(frag.locationId)!.push(frag);
    });
    return map;
  }, [fragments]);

  // M52-D1: Group scars by location
  const scarsByLocation = useMemo(() => {
    const map = new Map<string, WorldScar[]>();
    worldScars.forEach((scar) => {
      if (!map.has(scar.locationId)) {
        map.set(scar.locationId, []);
      }
      map.get(scar.locationId)!.push(scar);
    });
    return map;
  }, [worldScars]);

  // Calculate map dimensions for absolute positioning
  const mapDimensions = useMemo(() => {
    if (!useAbsolutePositioning) {
      return { width: 'auto', height: 'auto', minWidth: '400px', minHeight: '400px' };
    }

    const maxX = Math.max(...locations.map(l => l.x || 0), 100);
    const maxY = Math.max(...locations.map(l => l.y || 0), 100);
    return {
      width: Math.max(400, maxX + 100),
      height: Math.max(400, maxY + 100),
      minWidth: '400px',
      minHeight: '400px'
    };
  }, [locations, useAbsolutePositioning]);

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#1a1a1a',
      color: '#e6e6e6',
      borderRadius: '8px',
      border: '1px solid #444',
      fontFamily: 'monospace',
      maxHeight: '700px',
      overflowY: 'auto'
    }}>
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: '18px',
        color: '#a8d5a8',
        textShadow: '0 0 4px rgba(168, 213, 168, 0.5)'
      }}>
        The Known Lands - {epochId} ({fragments.length} fragments)
      </h2>

      {/* Map Container */}
      <div style={{
        position: useAbsolutePositioning ? 'relative' : 'static',
        width: useAbsolutePositioning ? mapDimensions.width : 'auto',
        height: useAbsolutePositioning ? mapDimensions.height : 'auto',
        backgroundColor: '#0f0f0f',
        border: '2px solid #333',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '16px',
        display: useAbsolutePositioning ? 'block' : 'grid',
        gridTemplateColumns: useAbsolutePositioning ? undefined : 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: useAbsolutePositioning ? undefined : '8px',
        overflow: useAbsolutePositioning ? 'auto' : 'visible',
      }}>
        {locations.map((location: UILocation) => {
          const nodeStyle = generateMapNodeStyle(location, epochId);
          const locationFragments = fragmentsByLocation.get(location.id) || [];
          
          // M49-A1: Get faction territory for this location
          const controllingFaction = getLocationControllingFaction(worldState, location.id);
          const isContested = isLocationContested(worldState, location.id);
          const territoryColor = controllingFaction?.influenceTheme?.color || 'rgba(128, 128, 128, 0.1)';
          const territoryOpacity = controllingFaction ? getTerritoryOpacity(worldState, location.id, controllingFaction) : 0;

          // Absolute positioning coordinates - guaranteed from UILocation
          const x = useAbsolutePositioning ? location.x : undefined;
          const y = useAbsolutePositioning ? location.y : undefined;

          return (
            <div
              key={location.id}
              style={{
                position: useAbsolutePositioning ? 'absolute' : 'relative',
                left: useAbsolutePositioning ? x : undefined,
                top: useAbsolutePositioning ? y : undefined,
                padding: '12px',
                border: `2px solid ${nodeStyle.colors.border}`,
                borderStyle: nodeStyle.borderStyle,
                borderRadius: '4px',
                backgroundColor: nodeStyle.colors.bg,
                backgroundImage: controllingFaction ? `linear-gradient(135deg, ${nodeStyle.colors.bg} 0%, ${territoryColor}${Math.round(territoryOpacity * 255).toString(16).padStart(2, '0')} 100%)` : 'none',
                opacity: nodeStyle.opacity,
                filter: nodeStyle.filter,
                cursor: onLocationSelect ? 'pointer' : 'default',
                minHeight: '80px',
                minWidth: '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isContested ? `0 0 8px rgba(255, 215, 0, 0.6), inset 0 0 8px ${territoryColor}${Math.round(territoryOpacity * 255).toString(16).padStart(2, '0')}` : 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                (e.currentTarget as HTMLElement).style.boxShadow = isContested 
                  ? `0 0 12px rgba(255, 215, 0, 0.8), inset 0 0 12px ${territoryColor}${Math.round(territoryOpacity * 255).toString(16).padStart(2, '0')}` 
                  : `0 0 12px ${nodeStyle.colors.border}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = isContested ? `0 0 8px rgba(255, 215, 0, 0.6), inset 0 0 8px ${territoryColor}${Math.round(territoryOpacity * 255).toString(16).padStart(2, '0')}` : 'none';
              }}
              onClick={() => onLocationSelect?.(location.id)}
              title={`${location.name} (${location.biome})${controllingFaction ? ` - Controlled by ${controllingFaction.name}` : ''}`}
            >
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: nodeStyle.colors.text }}>
                {location.name}
              </div>
              <div style={{ fontSize: '10px', color: nodeStyle.colors.text, opacity: 0.7 }}>
                {location.biome}
              </div>
              
              {/* M49-A1: Faction territory indicator */}
              {controllingFaction && (
                <div style={{
                  marginTop: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: controllingFaction.influenceTheme?.color || '#999999',
                  textShadow: `0 0 4px ${controllingFaction.influenceTheme?.color || '#999999'}80`,
                }}>
                  {isContested ? '⚔ ' : '🏛 '}
                  {controllingFaction.name}
                </div>
              )}

              {/* Fragment markers overlay */}
              {locationFragments.length > 0 && (
                <div style={{
                  marginTop: '6px',
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}>
                  {locationFragments.map((frag: WorldFragment) => (
                    <div
                      key={frag.id}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                      }}
                    >
                      <FragmentMarker
                        fragment={frag}
                        isHovered={hoveredFragmentId === frag.id}
                        onHover={setHoveredFragmentId}
                      />
                      {hoveredFragmentId === frag.id && <FragmentTooltip fragment={frag} />}
                    </div>
                  ))}
                </div>
              )}

              {/* M52-D1: World Scars Display */}
              {(scarsByLocation.get(location.id) || []).length > 0 && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  {(scarsByLocation.get(location.id) || []).map((scar) => (
                    <div
                      key={scar.id}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '14px',
                        cursor: 'pointer',
                        opacity: hoveredScarId === scar.id ? 1 : 0.7,
                        filter: hoveredScarId === scar.id ? 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={() => setHoveredScarId(scar.id)}
                      onMouseLeave={() => setHoveredScarId(null)}
                      title={`${scar.type} - Healing: ${Math.round(scar.healingProgress * 100)}%`}
                    >
                      <span>{getScarIcon(scar.type)}</span>

                      {/* M52-D1: Scar tooltip */}
                      {hoveredScarId === scar.id && (
                        <div style={{
                          position: 'absolute',
                          bottom: '24px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#0f0f0f',
                          border: `1px solid ${getScarColor(scar.healingProgress)}`,
                          borderRadius: '4px',
                          padding: '8px',
                          zIndex: 1001,
                          whiteSpace: 'nowrap',
                          fontSize: '10px',
                          color: '#e5e7eb'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: getScarColor(scar.healingProgress) }}>
                            {scar.type}
                          </div>
                          <div>Healing: {Math.round(scar.healingProgress * 100)}%</div>
                          <div style={{ fontSize: '9px', color: '#aaa', marginTop: '4px' }}>
                            Age: {scar.createdAt} → Epoch {scar.epochCreated}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Undiscovered indicator */}
              {!(location as any).discovered && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '10px',
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  Undiscovered
                </div>
              )}

              {/* Blight indicator [M48-A4: Disabled - epochId now hardcoded] */}
              {false && location.biome === 'corrupted' && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '11px',
                  color: '#ff6b6b',
                  fontWeight: 'bold',
                  textShadow: '0 0 8px rgba(255, 107, 107, 0.8)'
                }}>
                  ⚡ BLIGHTED
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* M57-E1: Ghost Ruins - Transparent overlays from previous epochs */}
      {(worldState as any)?.chronicleHistory && (worldState as any).chronicleHistory.length > 1 && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px dashed rgba(150, 150, 200, 0.3)',
          borderRadius: '4px',
          padding: '16px',
          marginTop: '16px',
          marginBottom: '16px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: 'rgba(150, 150, 200, 0.8)',
            textTransform: 'uppercase',
            textShadow: '0 0 4px rgba(150, 150, 200, 0.4)',
            fontStyle: 'italic'
          }}>
            👻 GHOST RUINS - Memories from Fallen Epochs
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px'
          }}>
            {(worldState as any).chronicleHistory.slice(0, -1).map((epochHistory: any, epochIdx: number) => {
              // Get fragments from historical epoch
              const historicalFragments = (epochHistory.worldFragments || []) as any[];
              return historicalFragments.map((ghostFrag: any) => (
                <div
                  key={`ghost-${epochHistory.epochId}-${ghostFrag.id}`}
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(100, 100, 150, 0.05)',
                    border: '1px solid rgba(150, 150, 200, 0.2)',
                    borderRadius: '4px',
                    opacity: 0.3,
                    fontStyle: 'italic',
                    color: 'rgba(150, 150, 200, 0.6)',
                    fontSize: '11px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.opacity = '0.6';
                    el.style.backgroundColor = 'rgba(100, 100, 150, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.opacity = '0.3';
                    el.style.backgroundColor = 'rgba(100, 100, 150, 0.05)';
                  }}
                  title={`Ghost Ruin from ${epochHistory.epochId}`}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    👻 {ghostFrag.name}
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    {ghostFrag.type} • Epoch {epochIdx + 1}
                  </div>
                  {ghostFrag.description && (
                    <div style={{ fontSize: '9px', marginTop: '4px', color: 'rgba(150, 150, 200, 0.5)' }}>
                      {ghostFrag.description}
                    </div>
                  )}
                </div>
              ));
            })}
          </div>
          {(!(worldState as any).unlockedSoulEchoes || (worldState as any).unlockedSoulEchoes.length <= 1) && (
            <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
              No previous epochs yet. Create history to build the ghost realm.
            </div>
          )}
        </div>
      )}

      {/* Fragment Legend */}
      {showLegend && (
        <div style={{
          backgroundColor: '#0f0f0f',
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '12px',
          marginTop: '12px'
        }}>
          {/* M49-A1: Faction Territory Legend */}
          {(worldState.factions || []).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '12px', marginBottom: '8px', color: '#e6ccff' }}>Faction Territories</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '10px',
                marginBottom: '8px'
              }}>
                {(worldState.factions || []).filter(f => (f.controlledLocationIds?.length || 0) > 0).slice(0, 8).map(faction => (
                  <div key={faction.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: faction.influenceTheme?.color || '#999999',
                      borderRadius: '2px',
                      opacity: 0.7
                    }} />
                    <span>{faction.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '9px', color: '#888', marginBottom: '12px' }}>
                🏛 = Controlled | ⚔ = Contested territory
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '8px' }} />
            </div>
          )}
          
          <h3 style={{ fontSize: '12px', marginBottom: '8px' }}>Fragment Types</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            fontSize: '11px'
          }}>
            <div>🏚️ Ruin - destroyed structure</div>
            <div>⛩️ Shrine - sacred place</div>
            <div>🗿 Monument - memorial</div>
            <div>📿 Statue - honored figure</div>
            <div>🏛️ Building - intact structure</div>
            <div>🌿 Garden - cultivated space</div>
            <div>⭐ Landmark - notable location</div>
            <div>🛣️ Road - travel route</div>
            <div>🌉 Bridge - crossing point</div>
          </div>
          <div style={{
            marginTop: '12px',
            fontSize: '10px',
            color: '#888',
            paddingTop: '8px',
            borderTop: '1px solid #333'
          }}>
            <div>Durability: <span style={{ color: '#4ade80' }}>■</span> Pristine 
              <span style={{ color: '#fbbf24' }}>■</span> Weathered 
              <span style={{ color: '#f97316' }}>■</span> Crumbling 
              <span style={{ color: '#ef4444' }}>■</span> Ruined</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChronicleMap;
