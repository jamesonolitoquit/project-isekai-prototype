import React, { useMemo } from 'react';

interface ResonanceViewProps {
  state: any;
  worldTension: number; // 0-100
}

/**
 * ALPHA_M19: World Tension & Resonance View
 * Visualizes faction conflict intensity, emotional echoes, and world scars
 * Designed as a sub-tab of the existing FactionPanel
 */
export default function ResonanceView({ state, worldTension }: ResonanceViewProps) {
  // Calculate emotional distribution across NPCs
  const emotionalMetrics = useMemo(() => {
    const emotions = { avgTrust: 0, avgFear: 0, avgGratitude: 0, avgResentment: 0 };
    let count = 0;

    for (const npc of state.npcs || []) {
      if (npc.emotionalState) {
        emotions.avgTrust += npc.emotionalState.trust || 50;
        emotions.avgFear += npc.emotionalState.fear || 50;
        emotions.avgGratitude += npc.emotionalState.gratitude || 50;
        emotions.avgResentment += npc.emotionalState.resentment || 50;
        count++;
      }
    }

    if (count > 0) {
      emotions.avgTrust = Math.round(emotions.avgTrust / count);
      emotions.avgFear = Math.round(emotions.avgFear / count);
      emotions.avgGratitude = Math.round(emotions.avgGratitude / count);
      emotions.avgResentment = Math.round(emotions.avgResentment / count);
    }

    return emotions;
  }, [state.npcs]);

  // Count world scars
  const activeScarCount = useMemo(() => {
    let count = 0;
    for (const location of state.locations || []) {
      count += (location as any).activeScars?.length || 0;
    }
    return count;
  }, [state.locations]);

  // List displaced NPCs
  const displacedNpcs = useMemo(() => {
    return (state.npcs || []).filter((npc: any) => npc.isDisplaced);
  }, [state.npcs]);

  // List defected NPCs
  const defectedNpcs = useMemo(() => {
    return (state.npcs || []).filter((npc: any) => npc.defectedFactionId);
  }, [state.npcs]);

  // Get tension bar color
  const getTensionColor = (tension: number): string => {
    if (tension < 25) return '#4ade80'; // Green - peaceful
    if (tension < 50) return '#fbbf24'; // Amber - uneasy
    if (tension < 75) return '#f97316'; // Orange - tense
    return '#ef4444'; // Red - critical
  };

  const getTensionLabel = (tension: number): string => {
    if (tension < 25) return 'PEACEFUL';
    if (tension < 50) return 'UNEASY';
    if (tension < 75) return 'TENSE';
    return 'CRITICAL';
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, #1e1e1e 0%, #0a0a0a 100%)',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: '"JetBrains Mono", monospace',
      color: '#aaa',
      fontSize: '11px',
      lineHeight: '1.6'
    }}>
      {/* World Tension Meter */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '10px'
        }}>
          <span>WORLD_TENSION</span>
          <span style={{ color: getTensionColor(worldTension), fontWeight: 'bold' }}>
            {getTensionLabel(worldTension)} ({worldTension}%)
          </span>
        </div>

        {/* Tension bar */}
        <div style={{
          width: '100%',
          height: '12px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${worldTension}%`,
            height: '100%',
            background: getTensionColor(worldTension),
            boxShadow: `0 0 ${Math.max(0, (worldTension / 100) * 8)}px ${getTensionColor(worldTension)}`,
            transition: 'width 0.3s ease-out'
          }} />
        </div>
      </div>

      {/* Emotional Distribution */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #222' }}>
        <div style={{ fontSize: '10px', color: '#3b82f6', marginBottom: '8px', letterSpacing: '2px' }}>
          NPC_EMOTIONAL_RESONANCE
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          {/* Trust */}
          <div>
            <div style={{ fontSize: '9px', color: '#60a5fa', marginBottom: '2px' }}>Trust</div>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: emotionalMetrics.avgTrust > 60 ? '#4ade80' : emotionalMetrics.avgTrust < 40 ? '#ef4444' : '#fbbf24'
            }}>
              {emotionalMetrics.avgTrust}%
            </div>
          </div>

          {/* Fear */}
          <div>
            <div style={{ fontSize: '9px', color: '#f87171', marginBottom: '2px' }}>Fear</div>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: emotionalMetrics.avgFear > 60 ? '#ef4444' : emotionalMetrics.avgFear < 40 ? '#4ade80' : '#fbbf24'
            }}>
              {emotionalMetrics.avgFear}%
            </div>
          </div>

          {/* Gratitude */}
          <div>
            <div style={{ fontSize: '9px', color: '#a78bfa', marginBottom: '2px' }}>Gratitude</div>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: emotionalMetrics.avgGratitude > 60 ? '#4ade80' : emotionalMetrics.avgGratitude < 40 ? '#ef4444' : '#fbbf24'
            }}>
              {emotionalMetrics.avgGratitude}%
            </div>
          </div>

          {/* Resentment */}
          <div>
            <div style={{ fontSize: '9px', color: '#fb923c', marginBottom: '2px' }}>Resentment</div>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: emotionalMetrics.avgResentment > 60 ? '#ef4444' : emotionalMetrics.avgResentment < 40 ? '#4ade80' : '#fbbf24'
            }}>
              {emotionalMetrics.avgResentment}%
            </div>
          </div>
        </div>
      </div>

      {/* World Scars */}
      {activeScarCount > 0 && (
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #222' }}>
          <div style={{ fontSize: '10px', color: '#ef4444', marginBottom: '8px', letterSpacing: '2px' }}>
            WORLD_SCARS ({activeScarCount})
          </div>
          {(state.locations || []).map((location: any) => {
            const scars = (location as any).activeScars || [];
            if (scars.length === 0) return null;

            return (
              <div key={location.id} style={{ fontSize: '9px', marginBottom: '4px', opacity: 0.8 }}>
                <span style={{ color: '#fbbf24' }}>{location.name}:</span> {scars[0].description}
              </div>
            );
          })}
        </div>
      )}

      {/* Displaced NPCs */}
      {displacedNpcs.length > 0 && (
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #222' }}>
          <div style={{ fontSize: '10px', color: '#60a5fa', marginBottom: '8px', letterSpacing: '2px' }}>
            DISPLACED_NPCS ({displacedNpcs.length})
          </div>
          {displacedNpcs.slice(0, 5).map((npc: any) => (
            <div key={npc.id} style={{ fontSize: '9px', marginBottom: '4px', opacity: 0.7 }}>
              {npc.name} fled conflict — expected to return in ~2 in-game days
            </div>
          ))}
          {displacedNpcs.length > 5 && (
            <div style={{ fontSize: '9px', opacity: 0.5 }}>
              ... and {displacedNpcs.length - 5} others
            </div>
          )}
        </div>
      )}

      {/* Defected NPCs */}
      {defectedNpcs.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: '#f87171', marginBottom: '8px', letterSpacing: '2px' }}>
            FACTION_DEFECTORS ({defectedNpcs.length})
          </div>
          {defectedNpcs.slice(0, 5).map((npc: any) => (
            <div key={npc.id} style={{ fontSize: '9px', marginBottom: '4px', opacity: 0.7 }}>
              {npc.name} switched to {npc.defectedFactionId}
            </div>
          ))}
          {defectedNpcs.length > 5 && (
            <div style={{ fontSize: '9px', opacity: 0.5 }}>
              ... and {defectedNpcs.length - 5} others
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {activeScarCount === 0 && displacedNpcs.length === 0 && defectedNpcs.length === 0 && (
        <div style={{ fontSize: '9px', opacity: 0.5, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          The world remains at peace. No scars or echoes of conflict.
        </div>
      )}
    </div>
  );
}
