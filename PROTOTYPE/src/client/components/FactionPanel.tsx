import React, { useState, useMemo } from 'react';
import ResonanceView from './ResonanceView';
import { calculateWorldTension } from '../../engine/chronosLedgerEngine';

interface FactionPanelProps {
  state?: any;
}

interface DisplayFaction {
  id: string;
  name: string;
  powerScore: number;
  alignment: string;
  category: string;
  playerReputation: number;
  attitude: 'allied' | 'neutral' | 'hostile';
}

interface DisplayRelationship {
  factionAId: string;
  factionBId: string;
  type: 'alliance' | 'war' | 'neutral';
  weight: number;
}

/**
 * FactionPanel Component - displays factions, relationships, reputation, and political news
 * Part of Phase 11 (The Weight of Influence) - allows players to track political dynamics
 */
export default function FactionPanel({ state }: FactionPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'relationships' | 'news' | 'resonance'>('overview');
  
  const factions = state?.factions || [];
  const factionReputation = state?.player?.factionReputation || {};
  const factionRelationships = state?.factionRelationships || [];
  
  // Calculate world tension for Resonance tab
  const worldTension = useMemo(() => {
    try {
      return calculateWorldTension(state);
    } catch (e) {
      return 0;
    }
  }, [state]);
  
  // Convert factions to display format
  const displayFactions: DisplayFaction[] = factions.map((faction: any) => {
    const playerRep = factionReputation[faction.id] || 0;
    const attitude: 'allied' | 'neutral' | 'hostile' = 
      playerRep >= 50 ? 'allied' : playerRep <= -50 ? 'hostile' : 'neutral';
    
    return {
      id: faction.id,
      name: faction.name,
      powerScore: faction.powerScore || 0,
      alignment: faction.alignment,
      category: faction.category,
      playerReputation: playerRep,
      attitude
    };
  });
  
  // Get relationships for a faction
  const getRelationships = (factionId: string): DisplayRelationship[] => {
    return factionRelationships
      .filter((rel: any) => rel.factionAId === factionId || rel.factionBId === factionId)
      .map((rel: any) => ({
        factionAId: rel.factionAId,
        factionBId: rel.factionBId,
        type: rel.type || 'neutral',
        weight: rel.weight || 0
      }));
  };
  
  // Get attitude color
  const getAttitudeColor = (attitude: string): string => {
    switch (attitude) {
      case 'allied': return '#4CAF50';
      case 'hostile': return '#FF6B6B';
      case 'neutral': return '#FFB933';
      default: return '#aaa';
    }
  };
  
  // Get attitude text
  const getAttitudeText = (attitude: string): string => {
    switch (attitude) {
      case 'allied': return 'Allied ✓';
      case 'hostile': return 'Hostile ✗';
      case 'neutral': return 'Neutral —';
      default: return 'Unknown';
    }
  };
  
  // Get relationship icon
  const getRelationshipIcon = (type: string): string => {
    switch (type) {
      case 'alliance': return '🤝';
      case 'war': return '⚔️';
      case 'neutral': return '—';
      default: return '?';
    }
  };
  
  // Generate recent faction events (simulated)
  const getRecentEvents = (): string[] => {
    const events: string[] = [];
    
    // Simulate recent events based on faction state
    displayFactions.forEach(faction => {
      if (faction.attitude === 'allied') {
        events.push(`✓ You have gained favor with ${faction.name}`);
      } else if (faction.attitude === 'hostile') {
        events.push(`✗ ${faction.name} views you as an enemy`);
      }
    });
    
    // Add power score changes (simulated)
    displayFactions.forEach(faction => {
      if (faction.powerScore >= 70) {
        events.push(`📈 ${faction.name} grows stronger (Power: ${faction.powerScore})`);
      } else if (faction.powerScore <= 30) {
        events.push(`📉 ${faction.name} is losing influence (Power: ${faction.powerScore})`);
      }
    });
    
    return events.slice(0, 5);
  };

  return (
    <div className="faction-panel" style={{ 
      padding: '16px', 
      backgroundColor: '#1a1a2e', 
      borderRadius: '8px', 
      color: '#fff',
      maxHeight: '500px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{ margin: '0 0 16px 0', color: '#FFB933' }}>⚔️ Political Landscape</h2>
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #333' }}>
        {(['overview', 'details', 'relationships', 'resonance', 'news'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 12px',
              backgroundColor: activeTab === tab ? '#FFB933' : '#2a2a3e',
              color: activeTab === tab ? '#1a1a2e' : '#fff',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'overview' && `Overview (${displayFactions.length})`}
            {tab === 'details' && 'Your Reputation'}
            {tab === 'relationships' && 'Alliances'}
            {tab === 'resonance' && `Resonance (${Math.ceil(worldTension / 25)})`}
            {tab === 'news' && 'Recent Events'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
        {activeTab === 'overview' && (
          <div>
            {displayFactions.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No factions discovered yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayFactions.map((faction) => (
                  <div
                    key={faction.id}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '12px',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${getAttitudeColor(faction.attitude)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 'bold', color: '#FFB933' }}>{faction.name}</div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{faction.category}</div>
                    </div>
                    
                    {/* Power Score Bar */}
                    <div style={{ fontSize: '11px', color: '#bbb', marginBottom: '4px' }}>Power Score</div>
                    <div style={{ 
                      backgroundColor: '#1a0a2a', 
                      height: '8px', 
                      borderRadius: '4px', 
                      overflow: 'hidden',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        width: `${Math.max(5, faction.powerScore)}%`,
                        height: '100%',
                        backgroundColor: faction.powerScore >= 70 ? '#4CAF50' : faction.powerScore >= 40 ? '#FFB933' : '#FF6B6B',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#999' }}>{faction.powerScore.toFixed(1)}/100</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div>
            {displayFactions.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No factions to display.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayFactions.map((faction) => (
                  <div
                    key={faction.id}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '10px',
                      borderRadius: '4px',
                      borderLeft: `3px solid ${getAttitudeColor(faction.attitude)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 'bold' }}>{faction.name}</div>
                      <div style={{ 
                        color: getAttitudeColor(faction.attitude),
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {getAttitudeText(faction.attitude)}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '12px', color: '#ddd', marginBottom: '4px' }}>
                      Your Reputation: <span style={{ 
                        color: faction.playerReputation > 0 ? '#4CAF50' : faction.playerReputation < 0 ? '#FF6B6B' : '#FFB933',
                        fontWeight: 'bold'
                      }}>
                        {faction.playerReputation > 0 ? '+' : ''}{faction.playerReputation}
                      </span>
                    </div>
                    
                    {/* Reputation Thresholds */}
                    <div style={{ fontSize: '10px', color: '#888' }}>
                      <div>Threshold ranges:</div>
                      <div style={{ paddingLeft: '8px', marginTop: '2px' }}>
                        <div>🟢 Allied: +50 or higher</div>
                        <div>🟡 Neutral: -50 to +50</div>
                        <div>🔴 Hostile: -50 or lower</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'relationships' && (
          <div>
            {factionRelationships.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No faction relationships tracked yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayFactions.map((factionA) => {
                  const relationships = getRelationships(factionA.id);
                  return relationships.length > 0 ? (
                    <div key={factionA.id}>
                      <div style={{ fontWeight: 'bold', color: '#FFB933', marginBottom: '6px', fontSize: '12px' }}>
                        {factionA.name}
                      </div>
                      <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {relationships.map((rel, idx) => {
                          const otherFactionId = rel.factionAId === factionA.id ? rel.factionBId : rel.factionAId;
                          const otherFaction = displayFactions.find(f => f.id === otherFactionId);
                          return (
                            <div key={idx} style={{ fontSize: '11px', color: '#bbb' }}>
                              <span style={{ marginRight: '8px' }}>{getRelationshipIcon(rel.type)}</span>
                              {otherFaction?.name || otherFactionId}
                              <span style={{ color: '#888', fontSize: '10px', marginLeft: '8px' }}>
                                ({rel.type})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resonance' && (
          <ResonanceView state={state} worldTension={worldTension} />
        )}

        {activeTab === 'news' && (
          <div>
            {getRecentEvents().length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No recent faction events.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getRecentEvents().map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '8px',
                      borderRadius: '4px',
                      borderLeft: '2px solid #FFB933',
                      fontSize: '11px',
                      color: '#ddd'
                    }}
                  >
                    {event}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        fontSize: '10px', 
        color: '#666', 
        marginTop: '12px', 
        borderTop: '1px solid #333', 
        paddingTop: '8px',
        textAlign: 'center'
      }}>
        Tracked Factions: {displayFactions.length} | Relationships: {factionRelationships.length}
      </div>
    </div>
  );
}
