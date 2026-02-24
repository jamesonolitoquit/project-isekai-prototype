import React, { useState } from 'react';

/**
 * M30 Task 4: The "Great Weaver" Meta-UI
 * Dashboard for managing multiple parallel bloodlines and cross-world connections
 * Shows Foreign Soul Echoes that have crossed between player's own worlds
 */

interface WorldInstance {
  id: string;
  seed: number;
  template: string;
  currentEpoch: string;
  mainCharacter: string;
  totalGenerations: number;
  cumulativeMythStatus: number;
  lastPlayed: number;
}

interface ForeignSoulEcho {
  sourceWorldId: string;
  targetWorldId: string;
  ancestorName: string;
  mythStatus: number;
  crossoverTimestamp: number;
  currentLocationInTarget: string;
  isActive: boolean;
}

interface NexusData {
  worldInstances: WorldInstance[];
  foreignSoulEchoes: ForeignSoulEcho[];
  interconnectedEpochs: string[];
}

interface WeaverDashboardProps {
  nexusData: NexusData;
  activeWorldId?: string;
  onSelectWorld?: (worldId: string) => void;
}

export default function WeaverDashboard({ nexusData, activeWorldId, onSelectWorld }: WeaverDashboardProps) {
  const [selectedTab, setSelectedTab] = useState<'worlds' | 'echoes' | 'connections'>('worlds');
  const [expandedWorld, setExpandedWorld] = useState<string | null>(null);

  const getMythStatusColor = (mythStatus: number): string => {
    if (mythStatus >= 80) return '#FFD700'; // Gold
    if (mythStatus >= 60) return '#C0C0C0'; // Silver
    if (mythStatus >= 40) return '#CD7F32'; // Bronze
    return '#A9A9A9'; // Gray
  };

  const getMythStatusLabel = (mythStatus: number): string => {
    if (mythStatus >= 80) return 'Transcendent';
    if (mythStatus >= 60) return 'Legendary';
    if (mythStatus >= 40) return 'Heroic';
    return 'Notable';
  };

  const getEpochDisplayName = (epochId: string): string => {
    const epochs: Record<string, string> = {
      'epoch_i_fracture': 'Epoch I: Fracture',
      'epoch_ii_waning': 'Epoch II: Waning',
      'epoch_iii_twilight': 'Epoch III: Twilight'
    };
    return epochs[epochId] || epochId;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      backgroundColor: '#0a0a0a',
      border: '3px solid #d4af37',
      borderRadius: '8px',
      boxShadow: '0 0 30px rgba(212, 175, 55, 0.2)',
      fontFamily: "'Georgia', serif",
      color: '#e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '12px',
        borderBottom: '2px solid #d4af37'
      }}>
        <h1 style={{
          margin: 0,
          color: '#d4af37',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          ✦ The Great Weaver's Nexus ✦
        </h1>
        <span style={{
          color: '#888',
          fontSize: '12px'
        }}>
          {nexusData.worldInstances.length} parallel worlds connected
        </span>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #444'
      }}>
        {['worlds', 'echoes', 'connections'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedTab === tab ? '#2a2a2a' : '#1a1a1a',
              border: selectedTab === tab ? '1px solid #d4af37' : '1px solid #444',
              color: selectedTab === tab ? '#d4af37' : '#888',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            {tab === 'worlds' && `🌍 Worlds (${nexusData.worldInstances.length})`}
            {tab === 'echoes' && `👻 Soul Echoes (${nexusData.foreignSoulEchoes.length})`}
            {tab === 'connections' && `🔗 Connections (${nexusData.interconnectedEpochs.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content: World Instances */}
      {selectedTab === 'worlds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {nexusData.worldInstances.map(world => (
            <div
              key={world.id}
              onClick={() => {
                setExpandedWorld(expandedWorld === world.id ? null : world.id);
                if (onSelectWorld) onSelectWorld(world.id);
              }}
              style={{
                padding: '12px',
                backgroundColor: activeWorldId === world.id ? '#1f1f1f' : '#0f0f0f',
                border: `2px solid ${activeWorldId === world.id ? '#d4af37' : '#444'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {/* World Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: expandedWorld === world.id ? '12px' : 0
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flex: 1
                }}>
                  <div style={{
                    fontSize: '20px'
                  }}>
                    {activeWorldId === world.id ? '✦' : '◆'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#d4af37' }}>
                      {world.mainCharacter} — Seed #{world.seed}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {world.template} • {getEpochDisplayName(world.currentEpoch)}
                    </div>
                  </div>
                </div>
                <div style={{
                  textAlign: 'right',
                  fontSize: '11px'
                }}>
                  <div style={{
                    color: getMythStatusColor(world.cumulativeMythStatus),
                    fontWeight: 'bold'
                  }}>
                    {getMythStatusLabel(world.cumulativeMythStatus)}
                  </div>
                  <div style={{ color: '#888' }}>
                    {world.totalGenerations} generations
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedWorld === world.id && (
                <div style={{
                  paddingTop: '12px',
                  borderTop: '1px solid #444',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  fontSize: '10px'
                }}>
                  <div>
                    <span style={{ color: '#888' }}>Myth Status:</span> {world.cumulativeMythStatus}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Epochs:</span> {world.currentEpoch.split('_')[1]}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Template:</span> {world.template}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Last Played:</span> {new Date(world.lastPlayed).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Foreign Soul Echoes */}
      {selectedTab === 'echoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {nexusData.foreignSoulEchoes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '20px' }}>
              No foreign soul echoes detected. Ancestors must first cross between worlds.
            </div>
          ) : (
            nexusData.foreignSoulEchoes.map((echo, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  border: `1px solid ${getMythStatusColor(echo.mythStatus)}`,
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{
                    fontWeight: 'bold',
                    color: getMythStatusColor(echo.mythStatus)
                  }}>
                    {echo.ancestorName}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#888'
                  }}>
                    {echo.isActive ? '👻 Manifested' : '⊘ Dormant'} • {echo.currentLocationInTarget}
                  </div>
                </div>
                <div style={{
                  textAlign: 'right',
                  fontSize: '11px'
                }}>
                  <div style={{ color: getMythStatusColor(echo.mythStatus), fontWeight: 'bold' }}>
                    {getMythStatusLabel(echo.mythStatus)}
                  </div>
                  <div style={{ color: '#888', fontSize: '9px' }}>
                    {new Date(echo.crossoverTimestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Interconnected Epochs */}
      {selectedTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {nexusData.interconnectedEpochs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '20px' }}>
              No interconnected epochs yet. Time flows separately here.
            </div>
          ) : (
            nexusData.interconnectedEpochs.map((epochId, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #d4af37',
                  borderRadius: '6px'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#d4af37', marginBottom: '4px' }}>
                  {getEpochDisplayName(epochId)}
                </div>
                <div style={{ fontSize: '10px', color: '#888' }}>
                  Multiple timelines are converging in this era of history.
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer: Lore Text */}
      <div style={{
        paddingTop: '12px',
        borderTop: '1px solid #444',
        fontSize: '11px',
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center'
      }}>
        The Weaver perceives all timelines. Your bloodlines echo across parallel worlds.
        {' '}
        <span style={{ color: '#d4af37' }}>When legends cross, destinies intertwine.</span>
      </div>
    </div>
  );
}
