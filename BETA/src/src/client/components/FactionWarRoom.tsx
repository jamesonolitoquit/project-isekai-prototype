/**
 * M44-T5: FactionWarRoom.tsx - Faction Warfare Visualization
 * 
 * Displays faction influence across locations, recent skirmishes, and contention levels.
 * Used in CoDmDashboard as a strategic view of the living world's faction dynamics.
 */

import React, { useState, useMemo } from 'react';
import type { LocationInfluence, Faction, WarZoneStatus } from '../../engine/factionWarfareEngine';

interface FactionWarRoomProps {
  influenceStates: LocationInfluence[];
  factions: Faction[];
  allLocations: Array<{ id: string; name: string }>;
  onLocationClick?: (locationId: string) => void;
}

const FactionWarRoom: React.FC<FactionWarRoomProps> = ({
  influenceStates,
  factions,
  allLocations,
  onLocationClick,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [filterContention, setFilterContention] = useState<'all' | 'contested' | 'stable'>(
    'all'
  );

  // Build faction color map
  const factionColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const faction of factions) {
      map[faction.id] = faction.color;
    }
    return map;
  }, [factions]);

  // Build faction name map
  const factionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const faction of factions) {
      map[faction.id] = faction.name;
    }
    return map;
  }, [factions]);

  // Filter locations based on contention level
  const filteredStates = useMemo(() => {
    return influenceStates.filter((state) => {
      const influenceValues = Array.from(state.factionInfluenceMap.values() as any) as number[];
      const maxInfluence = influenceValues.length > 0 ? Math.max(...influenceValues) : 0;
      const minInfluence = influenceValues.length > 0 ? Math.min(...influenceValues) : 0;
      const contention = factions.length > 1 ? maxInfluence - minInfluence : 0;

      if (filterContention === 'contested') {
        return contention > 0.3; // Significantly contested
      }
      if (filterContention === 'stable') {
        return contention <= 0.3; // Relatively stable
      }
      return true; // all
    });
  }, [influenceStates, factions, filterContention]);

  // Get location name
  const getLocationName = (locationId: string): string => {
    return allLocations.find((loc) => loc.id === locationId)?.name || locationId;
  };

  // Calculate contention level (gap between top factions)
  const getContentionLevel = (state: LocationInfluence): number => {
    const sorted = Array.from(state.factionInfluenceMap.values() as any).sort(
      (a: number, b: number) => b - a
    );
    if (sorted.length < 2) return 0;
    return Math.max(0, 1 - ((sorted[0] as number) - (sorted[1] as number)));
  };

  // Get contention color (green=stable, yellow=contested, red=very contested)
  const getContentionColor = (contention: number): string => {
    if (contention < 0.2) return '#2ecc71'; // green - very stable
    if (contention < 0.4) return '#f39c12'; // orange - moderately contested
    if (contention < 0.6) return '#e74c3c'; // red - highly contested
    return '#c0392b'; // dark red - extremely contested
  };

  // Render influence bar for a faction at a location
  const renderInfluenceBar = (
    factionId: string,
    influence: number,
    isSelected: boolean
  ): JSX.Element => {
    const color = factionColorMap[factionId] || '#999';
    const width = `${influence * 100}%`;

    return (
      <div
        key={factionId}
        style={{
          display: 'inline-block',
          width,
          height: '24px',
          backgroundColor: color,
          opacity: isSelected ? 1.0 : 0.7,
          transition: 'opacity 0.3s',
          borderRight: '1px solid rgba(0,0,0,0.2)',
          position: 'relative',
        }}
        title={`${factionNameMap[factionId]}: ${(influence * 100).toFixed(1)}%`}
      >
        {influence > 0.15 && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '11px',
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 0 2px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            {(influence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  // Render a location card
  const renderLocationCard = (state: LocationInfluence): JSX.Element => {
    const contention = getContentionLevel(state);
    const contentionColor = getContentionColor(contention);
    const dominant = state.dominantFactionId || 'None';
    const isSelected = selectedLocation === state.locationId;

    return (
      <div
        key={state.locationId}
        onClick={() => {
          setSelectedLocation(state.locationId);
          onLocationClick?.(state.locationId);
        }}
        style={{
          padding: '12px',
          marginBottom: '8px',
          border: isSelected ? '2px solid #3498db' : '1px solid #34495e',
          borderRadius: '4px',
          backgroundColor: isSelected ? 'rgba(52, 152, 219, 0.1)' : '#1a1a2e',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {/* Location header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ecf0f1' }}>
            {getLocationName(state.locationId)}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: contentionColor,
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Contention: {(contention * 100).toFixed(0)}%
          </span>
        </div>

        {/* Dominant faction indicator */}
        <div style={{ marginBottom: '8px', fontSize: '11px', color: '#bdc3c7' }}>
          Dominant: <span style={{ color: factionColorMap[dominant] || '#999' }}>
            {factionNameMap[dominant] || dominant}
          </span>
        </div>

        {/* Influence stacked bar */}
        <div
          style={{
            display: 'flex',
            height: '24px',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '8px',
            border: '1px solid rgba(0,0,0,0.3)',
          }}
        >
          {Array.from(state.factionInfluenceMap.entries()).map(([factionId, influence]) =>
            renderInfluenceBar(factionId, influence, isSelected)
          )}
        </div>

        {/* Contention description */}
        <div style={{ fontSize: '10px', color: '#95a5a6', fontStyle: 'italic' }}>
          {contention < 0.2 && '✓ Stable - one faction dominates'}
          {contention >= 0.2 && contention < 0.4 && '⚠ Moderately contested'}
          {contention >= 0.4 && contention < 0.6 && '⚠⚠ Highly contested - risk of warfare'}
          {contention >= 0.6 && '🔥 Extremely contested - active conflict'}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#0f0f1f',
        borderRadius: '6px',
        border: '1px solid #34495e',
        fontFamily: 'Courier New, monospace',
        color: '#ecf0f1',
        maxHeight: '600px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
          ⚔ FACTION WAR ROOM
        </h3>
        <p style={{ margin: '0', fontSize: '11px', color: '#95a5a6' }}>
          Real-time faction influence across all locations. Green = stable, Red = contested.
        </p>
      </div>

      {/* Filter buttons */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        {(['all', 'contested', 'stable'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setFilterContention(filter)}
            style={{
              padding: '6px 12px',
              borderRadius: '3px',
              border: filterContention === filter ? '2px solid #3498db' : '1px solid #34495e',
              backgroundColor:
                filterContention === filter ? 'rgba(52, 152, 219, 0.2)' : '#1a1a2e',
              color: filterContention === filter ? '#3498db' : '#95a5a6',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
          >
            {filter === 'all' && `All (${influenceStates.length})`}
            {filter === 'contested' && `Contested (${influenceStates.filter((s) => getContentionLevel(s) > 0.3).length})`}
            {filter === 'stable' && `Stable (${influenceStates.filter((s) => getContentionLevel(s) <= 0.3).length})`}
          </button>
        ))}
      </div>

      {/* Faction legend */}
      <div
        style={{
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '3px',
          fontSize: '11px',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Factions:</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {factions.map((faction) => (
            <div key={faction.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: factionColorMap[faction.id],
                  borderRadius: '2px',
                }}
              />
              <span>{faction.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Location cards */}
      <div style={{ marginTop: '12px' }}>
        {filteredStates.length > 0 ? (
          filteredStates.map((state) => renderLocationCard(state))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>
            No locations match the selected filter.
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #34495e',
          fontSize: '10px',
          color: '#95a5a6',
        }}
      >
        <div>
          ✓ <strong>{influenceStates.filter((s) => getContentionLevel(s) < 0.2).length}</strong> stable
        </div>
        <div>
          ⚠ <strong>{influenceStates.filter((s) => getContentionLevel(s) >= 0.2 && getContentionLevel(s) < 0.4).length}</strong> contested
        </div>
        <div>
          🔥 <strong>{influenceStates.filter((s) => getContentionLevel(s) >= 0.4).length}</strong> critical
        </div>
      </div>
    </div>
  );
};

export default FactionWarRoom;
