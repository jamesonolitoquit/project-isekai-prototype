/**
 * Phase 3 Task 8: World History Console
 * 
 * Director-only dashboard showing:
 * - Timeline of key events and snapshots
 * - Snapshot pruning statistics
 * - Social memory audit trail
 * - Temporal debt progression
 * - Event log size and performance metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Event } from '../../events/mutationLog';
import type { WorldState } from '../../engine/worldEngine';

export interface WorldHistoryEntry {
  tick: number;
  type: 'SNAPSHOT' | 'DIRECTOR_WHISPER' | 'TEMPORAL_PARADOX' | 'SOCIAL_SCAR' | 'SYSTEM';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedEvent?: Event;
}

export interface WorldHistoryConsoleProps {
  /**
   * Current world state
   */
  state: WorldState;

  /**
   * All events from mutation log
   */
  allEvents: Event[];

  /**
   * Callback for pruning action
   */
  onPruneSnapshots?: () => Promise<{ removed: number; savings: number }>;

  /**
   * Callback for status messages
   */
  onStatusChange?: (message: string) => void;
}

/**
 * Build history entries from events
 */
function buildHistoryEntries(events: Event[], state: WorldState): WorldHistoryEntry[] {
  const entries: WorldHistoryEntry[] = [];

  // SNAPSHOT events
  const snapshots = events.filter(e => e.mutationClass === 'SNAPSHOT' || e.type === 'SNAPSHOT');
  snapshots.forEach(snap => {
    entries.push({
      tick: snap.payload?.currentTick || 0,
      type: 'SNAPSHOT',
      description: `Checkpoint at tick ${snap.payload?.currentTick || 0}`,
      severity: 'low',
      relatedEvent: snap
    });
  });

  // DIRECTOR_WHISPER events
  const whispers = events.filter(e => e.type === 'DIRECTOR_WHISPER');
  whispers.forEach(whisper => {
    entries.push({
      tick: whisper.payload?.currentTick || 0,
      type: 'DIRECTOR_WHISPER',
      description: `Director whisper: "${whisper.payload?.message?.slice(0, 50)}..."`,
      severity: whisper.payload?.intensity >= 75 ? 'critical' : whisper.payload?.intensity >= 50 ? 'high' : 'medium',
      relatedEvent: whisper
    });
  });

  // TEMPORAL_PARADOX events
  const paradoxes = events.filter(e => e.type === 'TEMPORAL_PARADOX_SIGNAL');
  paradoxes.forEach(paradox => {
    entries.push({
      tick: paradox.payload?.currentTick || 0,
      type: 'TEMPORAL_PARADOX',
      description: `Paradox (severity ${paradox.payload?.severity}): ${paradox.payload?.message?.slice(0, 40)}...`,
      severity: paradox.payload?.severity >= 75 ? 'critical' : 'high',
      relatedEvent: paradox
    });
  });

  // Sort by tick descending (most recent first)
  return entries.sort((a, b) => b.tick - a.tick);
}

/**
 * Get event log statistics
 */
function getEventStats(events: Event[]) {
  const snapshots = events.filter(e => e.mutationClass === 'SNAPSHOT' || e.type === 'SNAPSHOT');
  const whispers = events.filter(e => e.type === 'DIRECTOR_WHISPER' || e.type === 'RELIC_WHISPER');
  const paradoxes = events.filter(e => e.type === 'TEMPORAL_PARADOX_SIGNAL');
  
  const totalSize = JSON.stringify(events).length;

  return {
    totalEvents: events.length,
    snapshots: snapshots.length,
    whispers: whispers.length,
    paradoxes: paradoxes.length,
    sizeKb: (totalSize / 1024).toFixed(2),
    avgEventSize: totalSize / Math.max(events.length, 1)
  };
}

/**
 * WorldHistoryConsole Component
 */
export const WorldHistoryConsole: React.FC<WorldHistoryConsoleProps> = ({
  state,
  allEvents,
  onPruneSnapshots,
  onStatusChange
}) => {
  const [selectedEntry, setSelectedEntry] = useState<WorldHistoryEntry | null>(null);
  const [isPruning, setIsPruning] = useState(false);

  const entries = useMemo(() => buildHistoryEntries(allEvents, state), [allEvents, state]);
  const stats = useMemo(() => getEventStats(allEvents), [allEvents]);

  const handlePruneSnapshots = async () => {
    if (isPruning) return;
    setIsPruning(true);

    try {
      const result = await onPruneSnapshots?.();
      if (result) {
        onStatusChange?.(`✓ Pruned ${result.removed} old snapshots, saved ~${(result.savings / 1024).toFixed(1)} KB`);
      }
    } catch (err) {
      onStatusChange?.(`❌ Pruning failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPruning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#fbbf24';
      case 'low':
      default:
        return '#10b981';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'SNAPSHOT':
        return '📸';
      case 'DIRECTOR_WHISPER':
        return '👂';
      case 'TEMPORAL_PARADOX':
        return '⚡';
      case 'SOCIAL_SCAR':
        return '💔';
      default:
        return '📝';
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid #8b5cf6',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '11px'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#c084fc' }}>
          📖 World History Archive
        </h3>

        {/* Statistics Panel */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            marginBottom: '12px'
          }}
        >
          <div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Total Events</div>
            <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>{stats.totalEvents}</div>
          </div>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Snapshots</div>
            <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>{stats.snapshots}</div>
          </div>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Whispers</div>
            <div style={{ color: '#06b6d4', fontWeight: 'bold' }}>{stats.whispers}</div>
          </div>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Paradoxes</div>
            <div style={{ color: '#ef4444', fontWeight: 'bold' }}>{stats.paradoxes}</div>
          </div>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>Log Size</div>
            <div style={{ color: '#10b981', fontWeight: 'bold' }}>{stats.sizeKb} KB</div>
          </div>
        </div>
      </div>

      {/* Pruning Controls */}
      <div
        style={{
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid #374151',
          borderRadius: '4px'
        }}
      >
        <button
          onClick={handlePruneSnapshots}
          disabled={isPruning || stats.snapshots < 50}
          style={{
            padding: '6px 12px',
            backgroundColor: stats.snapshots < 50 ? '#374151' : '#8b5cf6',
            border: `1px solid ${stats.snapshots < 50 ? '#1f2937' : '#a78bfa'}`,
            color: stats.snapshots < 50 ? '#6b7280' : '#e0e0e0',
            borderRadius: '4px',
            cursor: stats.snapshots < 50 || isPruning ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          {isPruning ? '⏳ Pruning...' : '🗑️ Prune Snapshots'}
        </button>
        {stats.snapshots < 50 && (
          <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '10px' }}>
            (Need {50 - stats.snapshots} more snapshots to prune)
          </span>
        )}
      </div>

      {/* Timeline Header */}
      <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #374151' }}>
        <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>Timeline (Most Recent)</span>
      </div>

      {/* Timeline */}
      {entries.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
          No events recorded yet
        </div>
      ) : (
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {entries.slice(0, 50).map((entry, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedEntry(selectedEntry?.tick === entry.tick ? null : entry)}
              style={{
                padding: '8px',
                backgroundColor: selectedEntry?.tick === entry.tick ? 'rgba(167, 139, 250, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                border: selectedEntry?.tick === entry.tick ? '1px solid #a78bfa' : '1px solid #374151',
                borderRadius: '3px',
                borderLeft: `3px solid ${getSeverityColor(entry.severity)}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {getEventTypeIcon(entry.type)} {entry.description}
                </span>
                <span style={{ color: '#6b7280', fontSize: '10px' }}>Tick {entry.tick}</span>
              </div>

              {selectedEntry?.tick === entry.tick && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #6b7280',
                    fontSize: '10px',
                    color: '#9ca3af'
                  }}
                >
                  <div><strong>Type:</strong> {entry.type}</div>
                  <div><strong>Severity:</strong> {entry.severity}</div>
                  {entry.relatedEvent?.payload?.message && (
                    <div><strong>Message:</strong> {entry.relatedEvent.payload.message}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div
        style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderLeft: '2px solid #8b5cf6',
          fontSize: '10px',
          color: '#d1d5db'
        }}
      >
        💡 <strong>Archive Functions:</strong> View world history, monitor temporal paradoxes, track director interventions, and optimize snapshot storage.
      </div>
    </div>
  );
};

export default WorldHistoryConsole;
