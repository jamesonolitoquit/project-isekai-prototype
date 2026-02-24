/**
 * Phase 9: Pressure Sink Panel
 * 
 * Compact control panel for testing Pressure Sink visuals.
 * Allows manual override of paradoxLevel and ageRotSeverity.
 * 
 * Features:
 * - Paradox level slider (0-100)
 * - Age rot severity selector
 * - Real-time visual feedback
 * - Filter preview
 */

import React, { useMemo, useState } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { useAtmosphericFilter } from '../hooks/useAtmosphericFilter';

interface PressureSinkPanelProps {
  state: WorldState | null;
  onParadoxChange?: (level: number) => void;
  onAgeRotChange?: (severity: 'mild' | 'moderate' | 'severe' | undefined) => void;
}

export const PressureSinkPanel: React.FC<PressureSinkPanelProps> = ({
  state,
  onParadoxChange,
  onAgeRotChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [paradoxOverride, setParadoxOverride] = useState<number | null>(null);
  const [ageRotOverride, setAgeRotOverride] = useState<'mild' | 'moderate' | 'severe' | undefined>(undefined);
  
  // Use overrides if set, otherwise use state values
  const effectiveParadox = paradoxOverride ?? state?.paradoxLevel ?? 0;
  const effectiveAgeRot = ageRotOverride ?? state?.ageRotSeverity;
  
  const filters = useAtmosphericFilter({
    paradoxLevel: effectiveParadox,
    ageRotSeverity: effectiveAgeRot
  });

  const handleParadoxChange = (value: number) => {
    setParadoxOverride(value);
    onParadoxChange?.(value);
    console.log(`[PressureSink] paradoxLevel: ${value}%`);
  };

  const handleAgeRotChange = (severity: 'mild' | 'moderate' | 'severe' | undefined) => {
    setAgeRotOverride(severity);
    onAgeRotChange?.(severity);
    console.log(`[PressureSink] ageRotSeverity: ${severity ?? 'none'}`);
  };

  const statusColor = useMemo(() => {
    if (effectiveParadox < 25) return '#4ade80'; // Green
    if (effectiveParadox < 50) return '#fbbf24'; // Amber
    if (effectiveParadox < 75) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }, [effectiveParadox]);

  const statusLabel = useMemo(() => {
    if (effectiveParadox < 25) return '🟢 CLEAR';
    if (effectiveParadox < 50) return '🟡 MILD';
    if (effectiveParadox < 75) return '🟠 MODERATE';
    return '🔴 SEVERE';
  }, [effectiveParadox]);

  if (!state) {
    return (
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 49,
        padding: '8px 12px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '4px',
        color: '#888',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}>
        Awaiting world state...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 49,
        fontFamily: 'monospace',
        fontSize: '12px',
        backgroundColor: '#1a1a1a',
        border: `2px solid ${statusColor}`,
        borderRadius: '4px',
        boxShadow: '0 0 12px rgba(0, 0, 0, 0.8)',
        transition: 'all 0.3s ease',
        maxWidth: isExpanded ? '300px' : '150px'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: '#0f0f0f',
          borderBottom: isExpanded ? `1px solid ${statusColor}` : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none'
        }}
      >
        <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '11px' }}>
          ◆ PRESSURE SINK
        </span>
        <span style={{ color: statusColor, fontSize: '10px', fontWeight: 'bold' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Collapsed Status */}
      {!isExpanded && (
        <div style={{ padding: '6px 12px', color: statusColor, fontSize: '10px', fontWeight: 'bold' }}>
          {statusLabel}
          <br />
          {effectiveParadox}% | {effectiveAgeRot ?? 'none'}
        </div>
      )}

      {/* Expanded Controls */}
      {isExpanded && (
        <div style={{ padding: '12px', color: '#e0e0e0' }}>
          {/* Paradox Control */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: '10px'
            }}>
              <span style={{ color: '#8a8a8a' }}>Paradox Level</span>
              <span style={{ color: statusColor, fontWeight: 'bold' }}>{effectiveParadox}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={effectiveParadox}
              onChange={(e) => handleParadoxChange(parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                accentColor: statusColor,
                cursor: 'pointer',
                height: '4px'
              }}
            />
            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px', textAlign: 'center' }}>
              {statusLabel}
            </div>
          </div>

          {/* Age Rot Control */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', color: '#8a8a8a', fontSize: '10px' }}>
              Age Rot Severity
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {(['none', 'mild', 'moderate', 'severe'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => handleAgeRotChange(sev === 'none' ? undefined : sev)}
                  style={{
                    padding: '4px 6px',
                    backgroundColor: effectiveAgeRot === (sev === 'none' ? undefined : sev)
                      ? '#3b82f6'
                      : '#222',
                    color: effectiveAgeRot === (sev === 'none' ? undefined : sev)
                      ? '#fff'
                      : '#888',
                    border: `1px solid ${effectiveAgeRot === (sev === 'none' ? undefined : sev)
                      ? '#60a5fa'
                      : '#333'}`,
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {sev === 'none' ? 'None' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Preview */}
          <div style={{
            padding: '8px',
            backgroundColor: '#222',
            borderRadius: '2px',
            marginBottom: '8px',
            fontSize: '9px'
          }}>
            <div style={{ color: '#666', marginBottom: '4px' }}>Filter Preview:</div>
            <div
              style={{
                filter: filters.combinedFilter !== 'none' ? filters.combinedFilter : undefined,
                padding: '4px',
                backgroundColor: '#1a1a1a',
                borderRadius: '2px',
                color: '#a8d5a8',
                textAlign: 'center',
                fontSize: '10px',
                textShadow: '0 0 4px rgba(168, 213, 168, 0.5)',
                minHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Sample Text
            </div>
            {filters.glitchClass && (
              <div style={{ fontSize: '8px', color: '#f97316', marginTop: '4px', textAlign: 'center' }}>
                ⚡ {filters.glitchClass}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{
            fontSize: '9px',
            color: '#666',
            borderTop: '1px solid #333',
            paddingTop: '8px',
            lineHeight: '1.4'
          }}>
            <div>• Live UI preview</div>
            <div>• Logged to console</div>
            <div>• Testing only</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PressureSinkPanel;
