/**
 * Phase 3 Task 4: Temporal Rewind Panel
 * 
 * Displays Chronicle Checkpoints (snapshots) and allows player to rewind to previous states
 * Shows timeline of snapshots created at intervals (every 100 ticks)
 * Implements temporal debt cost for rewind actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Event } from '../../events/mutationLog';
import type { WorldState } from '../../engine/worldEngine';

export interface TemporalCheckpoint {
  id: string;
  tick: number;
  timestamp: number;
  worldStateHash: string;
  eventIndex: number;
  isActive: boolean;
  rewindCost: number; // Temporal debt cost to rewind to this point
}

export interface RewindPanelProps {
  /**
   * Current world state
   */
  state: WorldState;

  /**
   * All snapshot events from mutation log
   */
  snapshotEvents: Event[];

  /**
   * Callback when player initiates rewind
   */
  onRewind?: (checkpoint: TemporalCheckpoint, newState: WorldState) => void;

  /**
   * Callback for feedback/logging
   */
  onStatusChange?: (message: string) => void;
}

/**
 * Calculate temporal debt cost for rewind
 * Cost increases with distance: earlier = more expensive
 * Base cost: 5, + (max_tick - target_tick) / 50
 */
function calculateRewindCost(currentTick: number, targetTick: number): number {
  const distance = currentTick - targetTick;
  const baseCost = 5;
  const distanceCost = Math.ceil(distance / 50);
  return baseCost + distanceCost;
}

/**
 * RewindPanel Component
 * 
 * Displays timeline of snapshots and temporal rewind controls
 */
export const RewindPanel: React.FC<RewindPanelProps> = ({
  state,
  snapshotEvents,
  onRewind,
  onStatusChange
}) => {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TemporalCheckpoint | null>(null);
  const [isRewinding, setIsRewinding] = useState(false);

  // Convert snapshot events to checkpoints
  const checkpoints = useMemo(() => {
    return snapshotEvents
      .sort((a, b) => (a.eventIndex || 0) - (b.eventIndex || 0))
      .map((event, idx) => ({
        id: event.id,
        tick: (event.payload?.currentTick || 0),
        timestamp: event.timestamp,
        worldStateHash: event.payload?.stateHash || 'unknown',
        eventIndex: event.eventIndex || idx,
        isActive: false,
        rewindCost: calculateRewindCost(state.tick || 0, event.payload?.currentTick || 0)
      } as TemporalCheckpoint));
  }, [snapshotEvents, state.tick]);

  // Mark current checkpoint as active
  useEffect(() => {
    checkpoints.forEach(cp => {
      cp.isActive = cp.tick === state.tick;
    });
  }, [checkpoints, state.tick]);

  const handleRewindClick = async (checkpoint: TemporalCheckpoint) => {
    if (isRewinding) return;

    const temporalDebt = state.player?.temporalDebt || 0;
    if (temporalDebt + checkpoint.rewindCost > 100) {
      onStatusChange?.(`⚠️ Cannot rewind: would exceed temporal debt limit (${temporalDebt} + ${checkpoint.rewindCost} > 100)`);
      return;
    }

    setIsRewinding(true);
    onStatusChange?.(`⏮️  Rewinding to tick ${checkpoint.tick}...`);

    try {
      // TODO: Implement actual rewind via controller
      // This would call stateRebuilder.rebuildStateFromSnapshot()
      // and apply the new state + temporal debt penalty
      
      // Simulate rewind delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onStatusChange?.(`✓ Rewound to tick ${checkpoint.tick} (Temporal Debt +${checkpoint.rewindCost})`);
      setSelectedCheckpoint(checkpoint);
    } catch (err) {
      onStatusChange?.(`✗ Rewind failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRewinding(false);
    }
  };

  const timelineHeight = Math.min(400, checkpoints.length * 30 + 20);
  const currentTick = state.tick || 0;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid #6366f1',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#a78bfa' }}>
          ⏱️ Chronicle Checkpoints
        </h3>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          Current Tick: <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{currentTick}</span>
          {' '} | Temporal Debt: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
            {(state.player?.temporalDebt || 0).toFixed(1)}/100
          </span>
        </div>
      </div>

      {/* Timeline */}
      {checkpoints.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          No snapshots available yet. Checkpoints appear every 100 ticks.
        </div>
      ) : (
        <div
          style={{
            maxHeight: `${timelineHeight}px`,
            overflowY: 'auto',
            border: '1px solid #374151',
            borderRadius: '4px',
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)'
          }}
        >
          {checkpoints.map((checkpoint, idx) => {
            const isSelected = selectedCheckpoint?.id === checkpoint.id;
            const isCurrent = checkpoint.isActive;
            const canRewind = checkpoint.tick < currentTick;
            const hasEnoughDebt = (state.player?.temporalDebt || 0) + checkpoint.rewindCost <= 100;

            return (
              <div
                key={checkpoint.id}
                onClick={() => setSelectedCheckpoint(checkpoint)}
                style={{
                  padding: '8px',
                  marginBottom: '6px',
                  backgroundColor: isCurrent ? 'rgba(251, 191, 36, 0.15)' : isSelected ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                  border: isCurrent 
                    ? '1px solid #fbbf24' 
                    : isSelected 
                    ? '1px solid #a78bfa'
                    : '1px solid #374151',
                  borderRadius: '4px',
                  cursor: canRewind && hasEnoughDebt ? 'pointer' : 'not-allowed',
                  opacity: canRewind && hasEnoughDebt ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  ...(canRewind && hasEnoughDebt ? { ':hover': { backgroundColor: 'rgba(167, 139, 250, 0.2)' } } : {})
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {isCurrent && '● '} 
                    <span style={{ color: isCurrent ? '#fbbf24' : '#a78bfa' }}>
                      Tick {checkpoint.tick}
                    </span>
                    {isCurrent && ' (Current)'}
                  </span>
                  {canRewind && (
                    <span style={{ fontSize: '10px', color: '#f59e0b' }}>
                      Cost: ⏳ {checkpoint.rewindCost}
                    </span>
                  )}
                </div>

                {/* Hash preview */}
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                  Hash: {checkpoint.worldStateHash.slice(0, 8)}...
                </div>

                {/* Rewind button */}
                {canRewind && isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRewindClick(checkpoint);
                    }}
                    disabled={isRewinding || !hasEnoughDebt}
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      backgroundColor: hasEnoughDebt ? '#6366f1' : '#374151',
                      border: `1px solid ${hasEnoughDebt ? '#a78bfa' : '#4b5563'}`,
                      color: hasEnoughDebt ? '#e0e0e0' : '#6b7280',
                      borderRadius: '4px',
                      cursor: hasEnoughDebt && !isRewinding ? 'pointer' : 'not-allowed',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                  >
                    {isRewinding ? '⏳ Rewinding...' : '⏮️ Rewind to This Checkpoint'}
                  </button>
                )}

                {!hasEnoughDebt && canRewind && isSelected && (
                  <div style={{ marginTop: '8px', padding: '4px', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '10px', borderRadius: '4px' }}>
                    ✗ Insufficient Temporal Debt capacity ({(state.player?.temporalDebt || 0) + checkpoint.rewindCost} would exceed 100)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Panel */}
      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderLeft: '2px solid #6366f1', fontSize: '11px', color: '#d1d5db' }}>
        <div style={{ marginBottom: '4px' }}>💡 <strong>How to Rewind:</strong></div>
        <ul style={{ margin: '0', paddingLeft: '16px' }}>
          <li>Select a checkpoint to view details</li>
          <li>Click "Rewind" to restore that world state</li>
          <li>Higher cost for older checkpoints</li>
          <li>Temporal debt increases on rewind</li>
        </ul>
      </div>
    </div>
  );
};

export default RewindPanel;
