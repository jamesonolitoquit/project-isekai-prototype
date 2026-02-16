/**
 * Legacy Oracle - Developer Tool for BETA Epoch Framework
 * 
 * Allows developers to:
 * - Trigger character canonization
 * - Skip to next epoch
 * - Manage bloodline storage
 * - View legacy impact records
 */

import React, { useState, useEffect } from 'react';
import { 
  saveLegacyImpact, 
  loadBloodline, 
  getAllBloodlines, 
  clearLegacyStorage,
  getLatestLegacyImpact
} from '../../engine/saveLoadEngine';
import { 
  canonizeCharacter, 
  calculateMythStatus,
  createSoulEchoNpc 
} from '../../engine/legacyEngine';
import { 
  initiateChronicleTransition, 
  isChronicleComplete,
  getNextEpoch 
} from '../../engine/chronicleEngine';

interface LegacyOracleProps {
  state?: any;
  controller?: any;
  onChronicleTransitioned?: (newState: any) => void;
}

export default function LegacyOracle({ state, controller, onChronicleTransitioned }: LegacyOracleProps) {
  const [bloodlines, setBloodlines] = useState<any>({});
  const [selectedBloodline, setSelectedBloodline] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setBloodlines(getAllBloodlines());
  }, []);

  const handleCanonizeCharacter = () => {
    if (!state?.player || !controller) {
      alert('No active character to canonize');
      return;
    }

    const deeds = [
      'Defeated 10+ enemies',
      'Completed 5+ quests',
      'Explored major locations',
      'Built alliance with faction'
    ];

    const legacy = canonizeCharacter(state.player, state, undefined, deeds);
    const chronicleId = state.chronicleId || `chronicle-${Date.now()}`;
    
    saveLegacyImpact(chronicleId, legacy);
    setBloodlines(getAllBloodlines());
    
    alert(`✅ Character canonized!\nMyth Status: ${legacy.mythStatus}/100\nPerks Unlocked: ${legacy.inheritedPerks.length}`);
  };

  const handleSkipToNextEpoch = () => {
    if (!state || !controller) {
      alert('No active world to transition');
      return;
    }

    if (isChronicleComplete(state.epochId || 'epoch_i_fracture')) {
      alert('⚠️ This chronicle sequence is complete.');
      return;
    }

    const nexEpoch = getNextEpoch(state.epochId || 'epoch_i_fracture');
    if (!nexEpoch) {
      alert('No next epoch available');
      return;
    }

    // Get legacy from current character
    const deeds = ['Development transition'];
    const legacy = canonizeCharacter(state.player, state, undefined, deeds);
    
    try {
      const newState = initiateChronicleTransition(state, legacy);
      onChronicleTransitioned?.(newState);
      alert(`✅ Transitioned to ${nexEpoch.name}!`);
    } catch (e) {
      alert(`❌ Transition failed: ${e}`);
    }
  };

  const handleWipeBloodline = () => {
    if (!confirm('⚠️ Really wipe ALL bloodline data? This cannot be undone.')) {
      return;
    }
    clearLegacyStorage();
    setBloodlines({});
    setSelectedBloodline(null);
    alert('✅ Bloodline storage cleared');
  };

  const handleExportBloodline = (chronicleId: string) => {
    try {
      const exported = JSON.stringify(bloodlines[chronicleId], null, 2);
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bloodline-${chronicleId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`❌ Export failed: ${e}`);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(13, 65, 55, 0.9) 0%, rgba(15, 40, 35, 0.95) 100%)',
      border: '2px solid #2d6b5f',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px',
      color: '#ddd',
      fontFamily: 'monospace'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80', marginBottom: '12px' }}>
        ⚡ LEGACY ORACLE (BETA Dev Tool)
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={handleCanonizeCharacter}
          style={{
            background: '#1e5a47',
            border: '1px solid #4ade80',
            color: '#4ade80',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as any).style.background = '#2d7a5f';
            (e.target as any).style.boxShadow = '0 0 8px #4ade80';
          }}
          onMouseLeave={(e) => {
            (e.target as any).style.background = '#1e5a47';
            (e.target as any).style.boxShadow = 'none';
          }}
        >
          🏛️ CANONIZE CHARACTER
        </button>

        <button
          onClick={handleSkipToNextEpoch}
          style={{
            background: '#3d3d1e',
            border: '1px solid #facc15',
            color: '#facc15',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as any).style.background = '#5a5a3d';
            (e.target as any).style.boxShadow = '0 0 8px #facc15';
          }}
          onMouseLeave={(e) => {
            (e.target as any).style.background = '#3d3d1e';
            (e.target as any).style.boxShadow = 'none';
          }}
        >
          ⏭️ SKIP TO NEXT EPOCH
        </button>

        <button
          onClick={handleWipeBloodline}
          style={{
            background: '#3d1e1e',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as any).style.background = '#5a3d3d';
            (e.target as any).style.boxShadow = '0 0 8px #ef4444';
          }}
          onMouseLeave={(e) => {
            (e.target as any).style.background = '#3d1e1e';
            (e.target as any).style.boxShadow = 'none';
          }}
        >
          🗑️ WIPE BLOODLINE
        </button>
      </div>

      {/* Bloodline List */}
      <div style={{ fontSize: '12px', marginBottom: '12px' }}>
        <div style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '8px' }}>
          📜 SAVED BLOODLINES ({Object.keys(bloodlines).length})
        </div>
        
        {Object.keys(bloodlines).length === 0 ? (
          <div style={{ color: '#666', fontSize: '11px' }}>No bloodlines recorded</div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.2)', padding: '8px', borderRadius: '4px' }}>
            {Object.entries(bloodlines).map(([chronicleId, bloodline]: [string, any]) => (
              <div
                key={chronicleId}
                onClick={() => {
                  setSelectedBloodline(chronicleId);
                  setShowDetails(!showDetails && selectedBloodline === chronicleId);
                }}
                style={{
                  padding: '8px',
                  background: selectedBloodline === chronicleId ? '#2d6b5f' : 'transparent',
                  borderLeft: selectedBloodline === chronicleId ? '3px solid #4ade80' : 'none',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  borderRadius: '2px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{chronicleId}</span>
                    {' '}
                    <span style={{ color: '#999', fontSize: '10px' }}>
                      • {bloodline.legacyImpacts?.length || 0} generations
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportBloodline(chronicleId);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #666',
                      color: '#999',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Export
                  </button>
                </div>

                {/* Expanded Details */}
                {showDetails && selectedBloodline === chronicleId && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa' }}>
                    <div style={{ paddingLeft: '8px', borderLeft: '2px solid #4ade80' }}>
                      {bloodline.legacyImpacts?.map((impact: any, idx: number) => (
                        <div key={idx} style={{ marginBottom: '6px' }}>
                          <div style={{ color: '#c9a961' }}>
                            📖 {impact.canonicalName} (Myth: {impact.mythStatus})
                          </div>
                          <div style={{ color: '#666', marginLeft: '8px' }}>
                            Perks: {impact.inheritedPerks?.join(', ') || 'none'}
                          </div>
                          {impact.deeds?.length > 0 && (
                            <div style={{ color: '#666', marginLeft: '8px' }}>
                              Deeds: {impact.deeds.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current State Info */}
      {state && (
        <div style={{ fontSize: '10px', color: '#666', borderTop: '1px solid #2d6b5f', paddingTop: '8px' }}>
          <div>📍 Current Epoch: <span style={{ color: '#4ade80' }}>{state.epochId}</span></div>
          {state.epochMetadata && (
            <div>📅 Year: <span style={{ color: '#4ade80' }}>{state.epochMetadata.chronologyYear}</span></div>
          )}
          <div>👤 Player: <span style={{ color: '#4ade80' }}>{state.player?.name}</span></div>
          <div>⭐ Myth Potential: <span style={{ color: '#4ade80' }}>{Math.round(calculateMythStatus(state.player, state))}/100</span></div>
        </div>
      )}
    </div>
  );
}
