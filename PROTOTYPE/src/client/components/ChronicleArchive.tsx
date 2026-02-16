import React, { useState, useEffect } from 'react';
import { getAllBloodlines } from '../../engine/saveLoadEngine';

interface ExpandedAncestor {
  generation: number;
  ancestor: any;
  bloodlineId: string;
}

export default function ChronicleArchive() {
  const [bloodlines, setBloodlines] = useState<Record<string, any>>({});
  const [selectedBloodline, setSelectedBloodline] = useState<string | null>(null);
  const [expandedAncestors, setExpandedAncestors] = useState<Set<string>>(new Set());

  useEffect(() => {
    const allBloodlines = getAllBloodlines();
    setBloodlines(allBloodlines);
    if (Object.keys(allBloodlines).length > 0) {
      setSelectedBloodline(Object.keys(allBloodlines)[0]);
    }
  }, []);

  const toggleAncestorExpanded = (id: string) => {
    const newExpanded = new Set(expandedAncestors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAncestors(newExpanded);
  };

  const getMythStatusColor = (mythStatus: number): string => {
    if (mythStatus >= 80) return '#ffd700'; // Gold
    if (mythStatus >= 60) return '#c0c0c0'; // Silver
    if (mythStatus >= 40) return '#cd7f32'; // Bronze
    if (mythStatus >= 20) return '#90ee90'; // Light green
    return '#a9a9a9'; // Gray
  };

  const getMythStatusTier = (mythStatus: number): string => {
    if (mythStatus >= 90) return 'Legendary';
    if (mythStatus >= 70) return 'Heroic';
    if (mythStatus >= 50) return 'Notable';
    if (mythStatus >= 30) return 'Remembered';
    return 'Obscure';
  };

  const currentBloodline = selectedBloodline ? bloodlines[selectedBloodline] : null;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: "'Georgia', serif",
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)',
    }}>
      {/* Sidebar with Bloodline List */}
      <div style={{
        width: '250px',
        backgroundColor: '#0f0f0f',
        borderRight: '2px solid #d4af37',
        overflowY: 'auto',
        padding: 16,
      }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#d4af37', fontSize: 18 }}>
          Bloodlines
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(bloodlines).map(([bloodlineId, bloodline]) => (
            <button
              key={bloodlineId}
              onClick={() => setSelectedBloodline(bloodlineId)}
              style={{
                padding: 12,
                backgroundColor: selectedBloodline === bloodlineId ? '#2a2a2a' : '#1a1a1a',
                border: selectedBloodline === bloodlineId ? '2px solid #d4af37' : '1px solid #444',
                borderRadius: 4,
                color: '#e0e0e0',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                fontFamily: "'Georgia', serif",
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {bloodline.canonicalName || bloodlineId}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {bloodline.legacyImpacts?.length || 0} generation{(bloodline.legacyImpacts?.length || 0) !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#d4af37' }}>
                Myth: {bloodline.totalMythStatus || 0}
              </div>
            </button>
          ))}
        </div>
        {Object.keys(bloodlines).length === 0 && (
          <div style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
            No bloodlines recorded yet.<br />
            Canonize a character in the Legacy Oracle DevTool to begin.
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 32,
        backgroundImage: 'linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, rgba(212, 175, 55, 0) 100%)',
      }}>
        {currentBloodline ? (
          <>
            {/* Bloodline Header */}
            <div style={{ marginBottom: 40 }}>
              <h1 style={{
                fontSize: 36,
                margin: '0 0 8px 0',
                color: '#d4af37',
                fontWeight: 'normal',
                textShadow: '0 0 10px rgba(212, 175, 55, 0.3)',
              }}>
                {currentBloodline.canonicalName || 'Unknown Bloodline'}
              </h1>
              <div style={{
                fontSize: 14,
                color: '#999',
                marginBottom: 16,
              }}>
                A chronicle of {currentBloodline.legacyImpacts?.length || 0} generation{(currentBloodline.legacyImpacts?.length || 0) !== 1 ? 's' : ''}
              </div>
              
              {/* Aggregate Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 16,
                padding: 20,
                backgroundColor: 'rgba(212, 175, 55, 0.05)',
                borderRadius: 8,
                border: '1px solid rgba(212, 175, 55, 0.15)',
              }}>
                <div>
                  <div style={{ color: '#999', fontSize: 12 }}>Total Myth Power</div>
                  <div style={{ fontSize: 20, color: '#ffd700', fontWeight: 'bold' }}>
                    {currentBloodline.totalMythStatus || 0}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#999', fontSize: 12 }}>Generations</div>
                  <div style={{ fontSize: 20, color: '#d4af37', fontWeight: 'bold' }}>
                    {currentBloodline.legacyImpacts?.length || 0}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#999', fontSize: 12 }}>Unique Perks</div>
                  <div style={{
                    fontSize: 20,
                    color: '#90ee90',
                    fontWeight: 'bold',
                  }}>
                    {new Set(
                      currentBloodline.legacyImpacts?.flatMap((impact: any) => impact.inheritedPerks || []) || []
                    ).size}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Branch Visualization */}
            <div style={{
              padding: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderBottom: '1px solid #333',
            }}>
              <h3 style={{ color: '#d4af37', margin: '0 0 16px 0', fontSize: 14 }}>
                LINEAGE ASCENSION TREE
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                gap: 12,
                padding: 20,
                backgroundColor: 'rgba(212, 175, 55, 0.05)',
                borderRadius: 8,
                border: '1px solid rgba(212, 175, 55, 0.15)',
                minHeight: 200,
              }}>
                {currentBloodline.legacyImpacts && currentBloodline.legacyImpacts.length > 0 ? (
                  currentBloodline.legacyImpacts.map((impact: any, idx: number) => {
                    const mythPercent = (impact.mythStatus / 100) * 100;
                    const tierColor = getMythStatusColor(impact.mythStatus);
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        title={`${impact.canonicalName || `Gen ${idx + 1}`}: ${impact.mythStatus} myth (${getMythStatusTier(impact.mythStatus)})`}
                      >
                        {/* Branch connector */}
                        {idx > 0 && (
                          <div style={{
                            width: 2,
                            height: 16,
                            backgroundColor: '#666',
                            marginBottom: 8,
                          }} />
                        )}
                        
                        {/* Myth Status Bar */}
                        <div style={{
                          width: '100%',
                          height: Math.max(20, mythPercent * 1.5),
                          backgroundColor: tierColor,
                          borderRadius: 4,
                          opacity: 0.7,
                          transition: 'all 0.3s ease',
                          boxShadow: `0 0 10px ${tierColor}80`,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: 4,
                          fontSize: 10,
                          fontWeight: 'bold',
                          color: '#000',
                        }}>
                          {impact.mythStatus}
                        </div>
                        
                        {/* Generation Label */}
                        <div style={{
                          marginTop: 12,
                          fontSize: 11,
                          color: '#999',
                          textAlign: 'center',
                        }}>
                          Gen {idx + 1}
                        </div>
                        <div style={{
                          fontSize: 10,
                          color: tierColor,
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}>
                          {getMythStatusTier(impact.mythStatus)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#666', fontSize: 12 }}>
                    No lineage data available yet.
                  </div>
                )}
              </div>
            </div>

            {/* World Summary - Era States */}
            <div style={{
              padding: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderBottom: '1px solid #333',
            }}>
              <h3 style={{ color: '#d4af37', margin: '0 0 16px 0', fontSize: 14 }}>
                WORLD EPOCHS & SUMMARIES
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}>
                {[
                  { id: 'epoch_i_fracture', name: 'Epoch I: Fracture', summary: 'Age of Recovery & Order' },
                  { id: 'epoch_ii_waning', name: 'Epoch II: Waning', summary: 'Age of Decline & Mystery' },
                  { id: 'epoch_iii_twilight', name: 'Epoch III: Twilight', summary: 'Age of Endings & Void' },
                ].map((epoch) => (
                  <div
                    key={epoch.id}
                    style={{
                      padding: 12,
                      backgroundColor: 'rgba(212, 175, 55, 0.08)',
                      borderLeft: '4px solid #d4af37',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>
                      {epoch.name}
                    </div>
                    <div style={{ color: '#999', fontSize: 11 }}>
                      {epoch.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ancestors Chronicle */}
            <div>
              <h2 style={{
                fontSize: 24,
                color: '#d4af37',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '2px solid #d4af37',
              }}>
                Hall of Legends
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {currentBloodline.legacyImpacts && currentBloodline.legacyImpacts.length > 0 ? (
                  currentBloodline.legacyImpacts.map((impact: any, idx: number) => {
                    const ancestorId = `ancestor_${currentBloodline.bloodlineId}_${idx}`;
                    const isExpanded = expandedAncestors.has(ancestorId);
                    const mythColor = getMythStatusColor(impact.mythStatus);
                    const mythTier = getMythStatusTier(impact.mythStatus);

                    return (
                      <div
                        key={ancestorId}
                        style={{
                          backgroundColor: 'rgba(212, 175, 55, 0.05)',
                          border: `2px solid ${mythColor}`,
                          borderRadius: 8,
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {/* Ancestor Header */}
                        <button
                          onClick={() => toggleAncestorExpanded(ancestorId)}
                          style={{
                            width: '100%',
                            padding: 16,
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            textAlign: 'left',
                          }}
                        >
                          <div>
                            <div style{{
                              fontSize: 18,
                              fontWeight: 'bold',
                              color: mythColor,
                              marginBottom: 4,
                            }}>
                              {impact.canonicalName || `Generation ${idx + 1}`}
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
                              <span>🏛️ {mythTier} (Myth: {impact.mythStatus})</span>
                              <span>⚔️ {impact.epochsLived} era{impact.epochsLived !== 1 ? 's' : ''}</span>
                              <span>✨ {impact.inheritedPerks?.length || 0} perk{(impact.inheritedPerks?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: 20,
                            color: '#999',
                            transition: 'transform 0.3s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}>
                            ▼
                          </div>
                        </button>

                        {/* Ancestor Details */}
                        {isExpanded && (
                          <div style={{
                            padding: 16,
                            borderTop: '1px solid #333',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          }}>
                            {/* Inherited Perks */}
                            {impact.inheritedPerks && impact.inheritedPerks.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <h4 style={{ color: '#90ee90', margin: '0 0 8px 0', fontSize: 12 }}>
                                  INHERITED PERKS
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                                  {impact.inheritedPerks.map((perk: string, pIdx: number) => (
                                    <div
                                      key={pIdx}
                                      style={{
                                        padding: 8,
                                        backgroundColor: 'rgba(144, 238, 144, 0.1)',
                                        borderLeft: '3px solid #90ee90',
                                        fontSize: 11,
                                        color: '#90ee90',
                                      }}
                                    >
                                      {perk.replaceAll('_', ' ')}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Deeds */}
                            {impact.deeds && impact.deeds.length > 0 && (
                              <div>
                                <h4 style={{ color: '#d4af37', margin: '0 0 12px 0', fontSize: 12 }}>
                                  CHRONICLE OF DEEDS
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {impact.deeds.map((deed: string, dIdx: number) => (
                                    <div
                                      key={dIdx}
                                      style={{
                                        padding: 12,
                                        backgroundColor: 'rgba(212, 175, 55, 0.08)',
                                        borderLeft: '3px solid #d4af37',
                                        fontSize: 12,
                                        color: '#e0e0e0',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      ✦ {deed}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Empty State */}
                            {(!impact.inheritedPerks || impact.inheritedPerks.length === 0) &&
                              (!impact.deeds || impact.deeds.length === 0) && (
                              <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
                                No recorded perks or deeds.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#666', padding: 32, textAlign: 'center' }}>
                    No ancestors recorded in this bloodline yet.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: 16,
          }}>
            Select a bloodline to view its chronicle.
          </div>
        )}
      </div>
    </div>
  );
}
