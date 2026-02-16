import React, { useMemo, useState } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import type { Event } from '../../events/mutationLog';
import { rebuildState } from '../../engine/stateRebuilder';
import {
  calculateTemporalDivergence,
  buildDivergenceTimeline,
  validateReplayIntegrity,
  calculateDivergenceThreshold,
  type DivergenceSnapshot,
  type TemporalAnalytics
} from '../../engine/analyticsEngine';

interface OracleViewProps {
  currentState: WorldState;
  initialState: WorldState;
  mutationLog: Event[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Oracle View - Dev Tool for Determinism & Temporal Divergence Analysis
 * 
 * Features:
 * 1. Timeline Scrubber - navigate through mutation log
 * 2. Divergence Graph - visualize temporal divergence over time
 * 3. Integrity Check - validate replay consistency (bit-drift detection)
 * 4. State Inspector - examine worlds at different ticks
 */
export default function OracleView({
  currentState,
  initialState,
  mutationLog,
  isOpen,
  onClose
}: OracleViewProps) {
  const [selectedTick, setSelectedTick] = useState<number>(currentState.tick || 0);
  const [showIntegrityCheck, setShowIntegrityCheck] = useState(false);
  const [integrityResults, setIntegrityResults] = useState<any>(null);
  const [divergenceHistory, setDivergenceHistory] = useState<DivergenceSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'divergence' | 'integrity'>('timeline');

  // Build divergence timeline
  const analytics = useMemo(() => {
    const timeline = buildDivergenceTimeline(currentState, initialState, divergenceHistory);
    return timeline;
  }, [currentState, initialState, divergenceHistory]);

  // Rebuild state at selected tick for inspection
  const stateAtTick = useMemo(() => {
    const eventsUpToTick = mutationLog.filter(e => {
      const eventId = typeof e.id === 'string' ? parseInt(e.id) : (e.id || 0);
      return eventId <= selectedTick;
    });
    const result = rebuildState(initialState, eventsUpToTick, selectedTick);
    return result.candidateState;
  }, [selectedTick, mutationLog, initialState]);

  // Run integrity check
  const handleIntegrityCheck = () => {
    const result = validateReplayIntegrity(currentState, stateAtTick);
    setIntegrityResults(result);
    setShowIntegrityCheck(true);
  };

  // Get divergence threshold level
  const divergenceLevel = useMemo(() => {
    return calculateDivergenceThreshold(analytics);
  }, [analytics]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        fontFamily: 'monospace'
      }}
    >
      {/* Header */}
      <div style={{ padding: 20, backgroundColor: '#0a0a0a', borderBottom: '2px solid #00ff88' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, color: '#00ff88' }}>⌛ ORACLE VIEW - Temporal Divergence Analysis</h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff4444',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: 4
            }}
          >
            Close
          </button>
        </div>

        {/* Current Stats */}
        <div style={{ display: 'flex', gap: 30, fontSize: 12 }}>
          <div>
            <span style={{ color: '#aaa' }}>Current Tick:</span>
            <span style={{ color: '#00ff88', marginLeft: 8, fontWeight: 'bold' }}>{currentState.tick}</span>
          </div>
          <div>
            <span style={{ color: '#aaa' }}>Divergence:</span>
            <span style={{ color: '#ffff00', marginLeft: 8, fontWeight: 'bold' }}>
              {analytics.currentDivergence.toFixed(2)}%
            </span>
          </div>
          <div>
            <span style={{ color: '#aaa' }}>Level:</span>
            <span
              style={{
                marginLeft: 8,
                fontWeight: 'bold',
                color:
                  divergenceLevel.level === 'stable'
                    ? '#00ff88'
                    : divergenceLevel.level === 'drifting'
                      ? '#ffff00'
                      : divergenceLevel.level === 'fractured'
                        ? '#ff9900'
                        : '#ff0000'
              }}
            >
              {divergenceLevel.level.toUpperCase()}
            </span>
          </div>
          <div>
            <span style={{ color: '#aaa' }}>Temporal Debt:</span>
            <span style={{ color: '#ff8800', marginLeft: 8, fontWeight: 'bold' }}>{divergenceLevel.temporalDebt}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '10px 20px',
          backgroundColor: '#111',
          borderBottom: '1px solid #333'
        }}
      >
        {(['timeline', 'divergence', 'integrity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? '#00ff88' : '#333',
              color: activeTab === tab ? '#000' : '#aaa',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 4,
              fontWeight: 'bold'
            }}
          >
            {tab === 'timeline' ? '📍 Timeline' : tab === 'divergence' ? '📊 Divergence' : '✓ Integrity'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeTab === 'timeline' && <TimelineTab selectedTick={selectedTick} onTickChange={setSelectedTick} mutationLog={mutationLog} stateAtTick={stateAtTick} />}

        {activeTab === 'divergence' && <DivergenceTab analytics={analytics} />}

        {activeTab === 'integrity' && (
          <IntegrityTab
            showCheck={showIntegrityCheck}
            onCheck={handleIntegrityCheck}
            results={integrityResults}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: 15, backgroundColor: '#0a0a0a', borderTop: '1px solid #333', fontSize: 11, color: '#666' }}>
        <div>
          💾 Total Ticks: {mutationLog.length} | 🔄 Events: {mutationLog.length} | ✨ Determinism: {analytics.history.length} snapshots tracked
        </div>
      </div>
    </div>
  );
}

/**
 * Timeline Tab - Scrub through mutation log and inspect state at specific ticks
 */
function TimelineTab({
  selectedTick,
  onTickChange,
  mutationLog,
  stateAtTick
}: {
  selectedTick: number;
  onTickChange: (tick: number) => void;
  mutationLog: Event[];
  stateAtTick: WorldState;
}) {
  const maxTick = Math.max(
    ...mutationLog.map(e => {
      const id = typeof e.id === 'string' ? parseInt(e.id) : (e.id || 0);
      return id;
    }),
    selectedTick
  );

  return (
    <div>
      <h3 style={{ color: '#00ff88', marginTop: 0 }}>📍 Timeline Scrubber</h3>

      {/* Slider */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span>Tick:</span>
          <input
            type="range"
            min="0"
            max={maxTick}
            value={selectedTick}
            onChange={e => onTickChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ color: '#ffff00', fontWeight: 'bold', minWidth: 50 }}>{selectedTick}</span>
        </div>

        <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
          <button onClick={() => onTickChange(Math.max(0, selectedTick - 10))} style={buttonStyle}>
            -10
          </button>
          <button onClick={() => onTickChange(Math.max(0, selectedTick - 1))} style={buttonStyle}>
            -1
          </button>
          <button onClick={() => onTickChange(Math.min(maxTick, selectedTick + 1))} style={buttonStyle}>
            +1
          </button>
          <button onClick={() => onTickChange(Math.min(maxTick, selectedTick + 10))} style={buttonStyle}>
            +10
          </button>
          <button onClick={() => onTickChange(0)} style={buttonStyle}>
            Start
          </button>
          <button onClick={() => onTickChange(maxTick)} style={buttonStyle}>
            End
          </button>
        </div>
      </div>

      {/* State Inspector */}
      <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #333', padding: 15, borderRadius: 4 }}>
        <h4 style={{ color: '#00ff88', marginTop: 0 }}>State at Tick {selectedTick}</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, fontSize: 11 }}>
          <div>
            <div style={{ color: '#aaa', marginBottom: 5 }}>📍 Player</div>
            <div>
              Location: <span style={{ color: '#ffff00' }}>{stateAtTick.player?.location}</span>
            </div>
            <div>
              HP: <span style={{ color: '#00ff00' }}>{stateAtTick.player?.hp}/{stateAtTick.player?.maxHp}</span>
            </div>
            <div>
              MP: <span style={{ color: '#0099ff' }}>{stateAtTick.player?.mp}/{stateAtTick.player?.maxMp}</span>
            </div>
            <div>
              Gold: <span style={{ color: '#ffdd00' }}>{stateAtTick.player?.gold}</span>
            </div>
          </div>

          <div>
            <div style={{ color: '#aaa', marginBottom: 5 }}>👥 NPCs</div>
            <div>Total: {stateAtTick.npcs?.length}</div>
            {stateAtTick.npcs?.slice(0, 3).map(npc => (
              <div key={npc.id} style={{ fontSize: 10, color: (npc.hp ?? 0) > 0 ? '#88ff88' : '#ff8888' }}>
                {npc.name}: {npc.hp ?? 0}/{npc.maxHp} @ {npc.locationId}
              </div>
            ))}
          </div>

          <div>
            <div style={{ color: '#aaa', marginBottom: 5 }}>⚔️ Combat</div>
            <div>
              Active:
              <span style={{ color: stateAtTick.combatState?.active ? '#ff0000' : '#00ff00' }}>
                {' '}
                {stateAtTick.combatState?.active ? 'YES' : 'NO'}
              </span>
            </div>
            {stateAtTick.combatState?.active && (
              <div>
                Round: <span style={{ color: '#ffaa00' }}>{stateAtTick.combatState?.roundNumber}</span>
              </div>
            )}
          </div>

          <div>
            <div style={{ color: '#aaa', marginBottom: 5 }}>📦 Inventory</div>
            <div>Items: {stateAtTick.player?.inventory?.length}</div>
            {stateAtTick.player?.inventory?.slice(0, 2).map((item: any, idx: number) => (
              <div key={idx} style={{ fontSize: 10, color: '#aaaaff' }}>
                {item.name || item.itemId || 'Unknown'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Log for this Tick */}
      <div style={{ marginTop: 15, backgroundColor: '#1a1a2e', border: '1px solid #333', padding: 15, borderRadius: 4 }}>
        <h4 style={{ color: '#00ff88', marginTop: 0 }}>Events at Tick {selectedTick}</h4>
        <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 10 }}>
          {mutationLog
            .filter(e => {
              const eventId = typeof e.id === 'string' ? parseInt(e.id) : (e.id || 0);
              return eventId === selectedTick;
            })
            .map((event, idx) => (
              <div key={idx} style={{ padding: 5, borderBottom: '1px solid #333', color: '#aaa' }}>
                <span style={{ color: '#ffff00' }}>{event.type}</span>
                {event.payload && (
                  <div style={{ marginLeft: 10, fontSize: 9, color: '#666' }}>
                    {JSON.stringify(event.payload).substring(0, 100)}...
                  </div>
                )}
              </div>
            ))}
          {mutationLog.filter(e => (e.id || 0) === selectedTick).length === 0 && (
            <div style={{ color: '#666' }}>No events at this tick</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Divergence Tab - Visualize divergence score over time
 */
function DivergenceTab({ analytics }: { analytics: TemporalAnalytics }) {
  const maxScore = Math.max(...analytics.history.map(s => s.score), analytics.currentDivergence);

  return (
    <div>
      <h3 style={{ color: '#00ff88', marginTop: 0 }}>📊 Divergence Timeline</h3>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 20, fontSize: 12 }}>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10 }}>Current</div>
          <div style={{ color: '#ffff00', fontWeight: 'bold' }}>{analytics.currentDivergence.toFixed(2)}%</div>
        </div>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10 }}>Max</div>
          <div style={{ color: '#ff9900', fontWeight: 'bold' }}>{analytics.maxDivergence.toFixed(2)}%</div>
        </div>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10 }}>Acceleration</div>
          <div style={{ color: analytics.divergenceAccel > 0 ? '#ff6666' : '#66ff66', fontWeight: 'bold' }}>
            {analytics.divergenceAccel.toFixed(3)}/tick
          </div>
        </div>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10 }}>Anomaly</div>
          <div style={{ color: analytics.temporalAnomaly ? '#ff0000' : '#00ff00', fontWeight: 'bold' }}>
            {analytics.temporalAnomaly ? 'DETECTED' : 'None'}
          </div>
        </div>
      </div>

      {/* Graph */}
      <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #333', padding: 15, borderRadius: 4, height: 300, position: 'relative' }}>
        <svg width="100%" height="100%" style={{ backgroundColor: '#0a0a0a' }}>
          {/* Grid */}
          {[0, 25, 50, 75, 100].map(y => (
            <React.Fragment key={y}>
              <line x1="30" y1={(100 - y) * 2.7 + 15} x2="100%" y2={(100 - y) * 2.7 + 15} stroke="#333" strokeWidth="1" />
              <text x="5" y={(100 - y) * 2.7 + 20} fontSize="10" fill="#666">
                {y}
              </text>
            </React.Fragment>
          ))}

          {/* Plot line */}
          <polyline
            points={analytics.history
              .map(
                (s, i) =>
                  `${30 + (i / Math.max(analytics.history.length - 1, 1)) * (100 - 50)}%,${300 - (s.score / 100) * 270}`
              )
              .join(' ')}
            fill="none"
            stroke="#ffff00"
            strokeWidth="2"
          />

          {/* Current point */}
          {analytics.history.length > 0 && (
            <circle
              cx={`${30 + ((analytics.history.length - 1) / Math.max(analytics.history.length - 1, 1)) * (100 - 50)}%`}
              cy={300 - (analytics.currentDivergence / 100) * 270}
              r="4"
              fill="#00ff88"
            />
          )}
        </svg>
      </div>

      {/* Detailed breakdown */}
      <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4, fontSize: 11 }}>
          <div style={{ color: '#aaa', marginBottom: 5 }}>Faction Shift</div>
          <div style={{ color: '#ff8888', fontWeight: 'bold' }}>
            {analytics.history[analytics.history.length - 1]?.factionShift.toFixed(2)}
          </div>
        </div>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4, fontSize: 11 }}>
          <div style={{ color: '#aaa', marginBottom: 5 }}>NPC Location Shift</div>
          <div style={{ color: '#88ff88', fontWeight: 'bold' }}>
            {analytics.history[analytics.history.length - 1]?.npcLocationShift.toFixed(2)}
          </div>
        </div>
        <div style={{ backgroundColor: '#1a1a2e', padding: 10, borderRadius: 4, fontSize: 11 }}>
          <div style={{ color: '#aaa', marginBottom: 5 }}>Reputation Shift</div>
          <div style={{ color: '#8888ff', fontWeight: 'bold' }}>
            {analytics.history[analytics.history.length - 1]?.reputationShift.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Integrity Tab - Bit-drift detection and replay validation
 */
function IntegrityTab({
  showCheck,
  onCheck,
  results
}: {
  showCheck: boolean;
  onCheck: () => void;
  results: any;
}) {
  return (
    <div>
      <h3 style={{ color: '#00ff88', marginTop: 0 }}>✓ Replay Integrity Check</h3>

      <p style={{ color: '#aaa', fontSize: 12 }}>
        Run a bit-drift detection to verify the replayed state matches the live state exactly. This checks for determinism violations.
      </p>

      <button
        onClick={onCheck}
        style={{
          padding: '12px 24px',
          backgroundColor: showCheck ? '#ff8800' : '#00ff88',
          color: showCheck ? '#fff' : '#000',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 4,
          fontWeight: 'bold',
          fontSize: 12,
          marginBottom: 20
        }}
      >
        {showCheck ? '⟳ Running Check...' : '▶ Start Integrity Check'}
      </button>

      {results && (
        <div style={{ backgroundColor: '#1a1a2e', border: `2px solid ${results.valid ? '#00ff00' : '#ff0000'}`, padding: 15, borderRadius: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <span style={{ fontSize: 20 }}>{results.valid ? '✓' : '✗'}</span>
            <h4 style={{ margin: 0, color: results.valid ? '#00ff00' : '#ff0000' }}>
              {results.valid ? 'REPLAY VALID - No bit-drift detected' : `DISCREPANCIES FOUND (${results.discrepancies.length})`}
            </h4>
          </div>

          {results.discrepancies.length > 0 && (
            <div style={{ backgroundColor: '#0a0a0a', padding: 10, borderRadius: 4, maxHeight: 300, overflowY: 'auto' }}>
              {results.discrepancies.map((disc: string, idx: number) => (
                <div key={idx} style={{ color: '#ff6666', fontSize: 11, padding: 5, borderBottom: '1px solid #333' }}>
                  {disc}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: '6px 12px',
  backgroundColor: '#333',
  color: '#aaa',
  border: '1px solid #555',
  cursor: 'pointer',
  borderRadius: 3,
  fontSize: 11
};
