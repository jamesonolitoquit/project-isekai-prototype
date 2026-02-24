/**
 * DivergenceHeatmap.tsx - Phase 16, Task 4
 * Divergence Analytics UI: Visualizes critical decision points in timeline
 * 
 * Shows where different timeline branches split, highlighting decisions that
 * significantly altered faction power or geography. Part of the "Infinite Recursion"
 * persistent timeline visualization system.
 * 
 * Features:
 * - Heatmap grid showing divergence frequency across epochs
 * - Color intensity correlates with change magnitude
 * - Interactive nodes reveal decision details
 * - Legend explaining divergence types
 * - Support for multiple decision axes (faction, location, NPC)
 */

import React, { useState, useEffect } from 'react';

interface Divergence {
  epochNumber: number;
  divergenceType: 'faction' | 'location' | 'npc' | 'environmental' | 'legacy';
  magnitude: number; // 0-100 scale
  description: string;
  affectedEntity: string;
  decisionCount: number;
}

interface DivergenceHeatmapProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  chronicles?: any[];
}

interface HeatmapCell {
  epochNumber: number;
  divergenceCount: number;
  maxMagnitude: number;
  types: Set<string>;
  divergences: Divergence[];
}

const DIVERGENCE_COLORS: Record<string, string> = {
  faction: '#FF6B6B',      // Red - faction power shifts
  location: '#4ECDC4',     // Teal - geography changes
  npc: '#FFE66D',          // Yellow - NPC state changes
  environmental: '#95E1D3', // Mint - world scars/effects
  legacy: '#A8E6CF'        // Light green - inheritance impacts
};

export const DivergenceHeatmap: React.FC<DivergenceHeatmapProps> = ({
  isOpen,
  onClose,
  sessionId,
  chronicles = []
}) => {
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'magnitude' | 'frequency' | 'types'>('magnitude');
  const [paradoxLevel, setParadoxLevel] = useState(0);  // Phase 18: Paradox level highlighting

  // Fetch and analyze divergences from chronicle deltas
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const analyzeChronicles = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch chronicle deltas
        const response = await fetch(`/api/chronicle/delta/${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chronicles');
        }

        const data = await response.json();
        const deltas = data.deltas || [];

        // Build divergence heatmap
        const cells = new Map<number, HeatmapCell>();

        deltas.forEach((delta: any, index: number) => {
          const epochNumber = delta.epochNumber;
          const eventLogLines = delta.eventLogLines || 0;
          const factionShiftCount = delta.factionShiftCount || 0;
          const locationChangeCount = delta.locationChangeCount || 0;
          const npcChangeCount = delta.npcChangeCount || 0;

          const divergences: Divergence[] = [];
          let maxMagnitude = 0;
          const types = new Set<string>();

          // Faction divergences
          if (factionShiftCount > 0) {
            const magnitude = Math.min(factionShiftCount * 15, 100);
            maxMagnitude = Math.max(maxMagnitude, magnitude);
            types.add('faction');
            divergences.push({
              epochNumber,
              divergenceType: 'faction',
              magnitude,
              description: `${factionShiftCount} faction power shifts detected`,
              affectedEntity: 'Multiple factions',
              decisionCount: factionShiftCount
            });
          }

          // Location divergences
          if (locationChangeCount > 0) {
            const magnitude = Math.min(locationChangeCount * 20, 100);
            maxMagnitude = Math.max(maxMagnitude, magnitude);
            types.add('location');
            divergences.push({
              epochNumber,
              divergenceType: 'location',
              magnitude,
              description: `${locationChangeCount} location changes (biome, discovery, effects)`,
              affectedEntity: 'World geography',
              decisionCount: locationChangeCount
            });
          }

          // NPC divergences
          if (npcChangeCount > 0) {
            const magnitude = Math.min(npcChangeCount * 12, 100);
            maxMagnitude = Math.max(maxMagnitude, magnitude);
            types.add('npc');
            divergences.push({
              epochNumber,
              divergenceType: 'npc',
              magnitude,
              description: `${npcChangeCount} NPC state changes (deaths, relocations, titles)`,
              affectedEntity: 'NPC Populace',
              decisionCount: npcChangeCount
            });
          }

          // Environmental divergences (from event log)
          if (eventLogLines > 5) {
            const magnitude = Math.min(eventLogLines * 5, 100);
            maxMagnitude = Math.max(maxMagnitude, magnitude);
            types.add('environmental');
            divergences.push({
              epochNumber,
              divergenceType: 'environmental',
              magnitude,
              description: `${eventLogLines} significant environmental events recorded`,
              affectedEntity: 'World state',
              decisionCount: eventLogLines
            });
          }

          if (divergences.length > 0) {
            cells.set(epochNumber, {
              epochNumber,
              divergenceCount: divergences.length,
              maxMagnitude,
              types,
              divergences
            });
          }
        });

        // Convert to sorted array
        const sorted = Array.from(cells.values()).sort((a, b) => a.epochNumber - b.epochNumber);
        setHeatmapData(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    analyzeChronicles();
  }, [isOpen, sessionId]);

  const getHeatIntensity = (cell: HeatmapCell): number => {
    if (viewMode === 'magnitude') {
      return cell.maxMagnitude / 100;
    } else if (viewMode === 'frequency') {
      return Math.min(cell.divergenceCount / 5, 1);
    } else {
      return cell.types.size / 5;
    }
  };

  const getBackgroundColor = (cell: HeatmapCell): string => {
    const intensity = getHeatIntensity(cell);
    
    // Phase 18: Highlight high-paradox zones in red
    if (paradoxLevel > 200) {
      return '#8B0000';  // Dark red for critical paradox
    } else if (paradoxLevel > 100) {
      return '#DC143C';  // Crimson for high paradox
    }
    
    // Color gradient: Light → Dark based on intensity
    if (intensity === 0) return '#f5f5f5';
    
    // Interpolate between light and dark
    const hue = 0; // Red hue
    const saturation = intensity * 100;
    const lightness = 100 - intensity * 70; // Light to darker
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'monospace'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f0f0f',
          border: '2px solid #d4af37',
          borderRadius: '4px',
          padding: '20px',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)',
          color: '#e0e0e0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#d4af37' }}>📊 Divergence Heatmap</h2>
          {/* Phase 18: Paradox Level Display */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            backgroundColor: paradoxLevel > 200 ? '#8B0000' : paradoxLevel > 100 ? '#DC143C' : '#2a2a2a',
            borderRadius: '3px',
            border: '1px solid #d4af37'
          }}>
            <span style={{ fontSize: '12px', color: '#d4af37' }}>⚠️ Paradox Level:</span>
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: paradoxLevel > 200 ? '#fff' : paradoxLevel > 100 ? '#ffcccc' : '#d4af37'
            }}>
              {paradoxLevel}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#d4af37',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* View Mode Selector */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setViewMode('magnitude')}
            style={{
              padding: '5px 10px',
              backgroundColor: viewMode === 'magnitude' ? '#d4af37' : '#1a1a1a',
              color: viewMode === 'magnitude' ? '#0f0f0f' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Change Magnitude
          </button>
          <button
            onClick={() => setViewMode('frequency')}
            style={{
              padding: '5px 10px',
              backgroundColor: viewMode === 'frequency' ? '#d4af37' : '#1a1a1a',
              color: viewMode === 'frequency' ? '#0f0f0f' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Event Frequency
          </button>
          <button
            onClick={() => setViewMode('types')}
            style={{
              padding: '5px 10px',
              backgroundColor: viewMode === 'types' ? '#d4af37' : '#1a1a1a',
              color: viewMode === 'types' ? '#0f0f0f' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Divergence Types
          </button>
        </div>

        {/* Legend */}
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '3px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Legend:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {Object.entries(DIVERGENCE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: color,
                    borderRadius: '2px'
                  }}
                />
                <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap Grid */}
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Loading divergence data...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', color: '#ff6b6b', textAlign: 'center' }}>
            Error: {error}
          </div>
        ) : heatmapData.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            No divergence data available for this session.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(60px, 1fr))`,
                gap: '8px',
                marginBottom: '20px'
              }}
            >
              {heatmapData.map((cell) => (
                <div
                  key={cell.epochNumber}
                  onClick={() => setSelectedCell(cell)}
                  style={{
                    padding: '12px',
                    backgroundColor: getBackgroundColor(cell),
                    border: selectedCell?.epochNumber === cell.epochNumber ? '2px solid #d4af37' : '1px solid #333',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    minHeight: '50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}
                  title={`Epoch ${cell.epochNumber}: ${cell.divergenceCount} divergence types`}
                >
                  <div style={{ fontWeight: 'bold' }}>E{cell.epochNumber}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    {cell.divergenceCount} types
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Cell Details */}
            {selectedCell && (
              <div
                style={{
                  padding: '15px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #d4af37',
                  borderRadius: '4px',
                  marginTop: '15px'
                }}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#d4af37' }}>
                  Epoch {selectedCell.epochNumber} - Critical Decision Points
                </h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {selectedCell.divergences.map((div, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px',
                        backgroundColor: '#0f0f0f',
                        borderLeft: `4px solid ${DIVERGENCE_COLORS[div.divergenceType]}`,
                        borderRadius: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div style={{ fontWeight: 'bold', textTransform: 'capitalize', color: DIVERGENCE_COLORS[div.divergenceType] }}>
                          {div.divergenceType} Divergence
                        </div>
                        <div style={{ color: '#d4af37', fontSize: '12px' }}>
                          Magnitude: {Math.round(div.magnitude)}%
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>
                        {div.description}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Affected: {div.affectedEntity} • Decisions: {div.decisionCount}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Stats */}
                <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#0f0f0f', borderRadius: '2px', fontSize: '12px', color: '#888' }}>
                  <div>Total Divergence Types: {selectedCell.types.size}/5</div>
                  <div>Max Change Magnitude: {Math.round(selectedCell.maxMagnitude)}%</div>
                  <div>Critical Decision Count: {selectedCell.divergences.reduce((sum, d) => sum + d.decisionCount, 0)}</div>
                </div>
              </div>
            )}

            {/* Summary Footer */}
            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '3px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
              Showing {heatmapData.length} epochs with {heatmapData.reduce((sum, c) => sum + c.divergenceCount, 0)} total divergence types across timeline
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DivergenceHeatmap;
