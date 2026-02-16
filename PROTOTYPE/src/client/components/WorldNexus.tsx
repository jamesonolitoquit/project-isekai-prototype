import React, { useState, useEffect } from 'react';
import { generateWorldEndProphecy } from '../engine/legacyEngine';
import { listCachedTemplatePackages, getCachedTemplatePackage } from '../engine/saveLoadEngine';
import ModdingCommunityHub from './ModdingCommunityHub';

/**
 * M33: World Nexus Lobby UI
 * 
 * Primary session manager replacing simple landing page.
 * Allows players to:
 * - View "Active Parallel Chronicles" (saved game states)
 * - Browse "Community Templates" (mocked via local file browsing)
 * - See live "Prophecy Preview" for each world line
 * - Display Myth Status and Prophecy icon for each chronicle
 */

export interface SavedChronicle {
  id: string;
  name: string;
  playerName?: string;
  epochId?: string;
  mythStatus?: number;
  tick?: number;
  createdAt?: number;
}

export interface CommunityTemplate {
  id: string;
  name: string;
  author?: string;
  description?: string;
  difficulty: 'Novice' | 'Standard' | 'Legendary';
  previewImage?: string;
}

const WorldNexus: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chronicles' | 'templates' | 'prophecy' | 'forgeLink' | 'weaveSearch' | 'galleryMap'>('chronicles');
  const [chronicles, setChronicles] = useState<SavedChronicle[]>([]);
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [selectedChronicle, setSelectedChronicle] = useState<SavedChronicle | null>(null);
  const [prophecyText, setProphecyText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  // M34: Forge Link states
  const [forgeUrl, setForgeUrl] = useState<string>('');
  const [forgeFetching, setForgeFetching] = useState(false);
  const [forgeError, setForgeError] = useState<string>('');
  const [forgeResult, setForgeResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // M35 Task 5: Great Weave Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<'timeline' | 'deeds' | 'phantoms'>('timeline');
  const [selectedEpochs, setSelectedEpochs] = useState<string[]>([]);

  // M33: Load saved chronicles from platform
  useEffect(() => {
    const loadChronicles = async () => {
      setLoading(true);
      try {
        const cached = listCachedTemplatePackages();
        const chronicleList: SavedChronicle[] = cached.map((item, idx) => ({
          id: item.id,
          name: item.name,
          playerName: item.author,
          epochId: `epoch_${idx + 1}`,
          mythStatus: Math.floor(Math.random() * 100),
          createdAt: item.createdAt
        }));
        setChronicles(chronicleList);
      } catch (err) {
        console.error('[WorldNexus] Failed to load chronicles:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChronicles();
  }, []);

  // M33: Generate prophecy preview for selected chronicle
  useEffect(() => {
    if (selectedChronicle && activeTab === 'prophecy') {
      try {
        // Simulate prophecy generation (would normally use world state)
        const prophecy = generateWorldEndProphecy(
          selectedChronicle.epochId || 'epoch_i_fracture',
          selectedChronicle.mythStatus || 50
        );
        setProphecyText(prophecy);
      } catch (err) {
        console.error('[WorldNexus] Failed to generate prophecy:', err);
        setProphecyText('The future remains shrouded in mystery...');
      }
    }
  }, [selectedChronicle, activeTab]);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#0d0d1a',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(79, 39, 131, 0.2), transparent)',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '2px solid #4f2783',
          padding: '20px',
          backgroundImage: 'linear-gradient(to bottom, rgba(79, 39, 131, 0.3), transparent)',
          marginBottom: '20px'
        }}
      >
        <h1
          style={{
            margin: '0 0 10px 0',
            fontSize: '28px',
            color: '#c084fc',
            textShadow: '0 0 10px rgba(192, 132, 252, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}
        >
          ✦ The World Nexus ✦
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: '#a78bfa' }}>
          Convergence Point of Parallel Chronicles
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          padding: '0 20px 20px 20px',
          borderBottom: '1px solid #333'
        }}
      >
        {(['chronicles', 'templates', 'prophecy', 'forgeLink', 'weaveSearch', 'galleryMap'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? '#4f2783' : 'transparent',
              border: `1px solid ${activeTab === tab ? '#c084fc' : '#666'}`,
              color: activeTab === tab ? '#c084fc' : '#999',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              borderRadius: '4px'
            }}
            onMouseEnter={e => {
              if (activeTab !== tab) {
                (e.target as HTMLElement).style.borderColor = '#c084fc';
                (e.target as HTMLElement).style.color = '#c084fc';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab) {
                (e.target as HTMLElement).style.borderColor = '#666';
                (e.target as HTMLElement).style.color = '#999';
              }
            }}
          >
            {tab === 'chronicles' && '◆ Active Chronicles'}
            {tab === 'templates' && '◇ Community Templates'}
            {tab === 'prophecy' && '◈ Prophecy Preview'}
            {tab === 'forgeLink' && '⚔ Forge Link'}
            {tab === 'weaveSearch' && '🔗 Great Weave Search'}
            {tab === 'galleryMap' && '🗺 Chronicle Gallery'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ padding: '20px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {/* Active Chronicles Tab */}
        {activeTab === 'chronicles' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              Your Parallel Chronicles
            </h2>
            {loading ? (
              <p style={{ color: '#888' }}>Loading chronicles...</p>
            ) : chronicles.length === 0 ? (
              <p style={{ color: '#888' }}>No saved chronicles yet. Begin a new journey.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {chronicles.map(chronicle => (
                  <div
                    key={chronicle.id}
                    onClick={() => {
                      setSelectedChronicle(chronicle);
                      setActiveTab('prophecy');
                    }}
                    style={{
                      padding: '16px',
                      backgroundColor: '#1a1a2e',
                      border: selectedChronicle?.id === chronicle.id ? '2px solid #c084fc' : '1px solid #333',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow:
                        selectedChronicle?.id === chronicle.id
                          ? '0 0 15px rgba(192, 132, 252, 0.5)'
                          : 'none'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#8b5cf6';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.3)';
                    }}
                    onMouseLeave={e => {
                      if (selectedChronicle?.id !== chronicle.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = '#333';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#e0e0e0' }}>
                          {chronicle.name}
                        </h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#a78bfa' }}>
                          {chronicle.playerName || 'Unknown Player'}
                        </p>
                        <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#888' }}>
                          {chronicle.epochId}
                        </p>
                      </div>
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#2a1a3a',
                          border: '1px solid #8b5cf6',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: '#c084fc',
                          fontWeight: 'bold'
                        }}
                      >
                        <div style={{ fontSize: '14px' }}>⭐</div>
                        <div>{chronicle.mythStatus}%</div>
                      </div>
                    </div>
                    {chronicle.createdAt && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '9px', color: '#666' }}>
                        Last updated: {new Date(chronicle.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Community Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              🌐 Community Templates — Remote Mod Loader
            </h2>
            {/* M39 Task 3: ModdingCommunityHub Integration */}
            <ModdingCommunityHub 
              state={null as any}
              onModLoaded={(mod) => {
                console.log('Mod loaded:', mod.id);
              }}
              onModInjected={(newState) => {
                console.log('Mods injected into world');
              }}
            />
          </div>
        )}

        {/* Prophecy Preview Tab */}
        {activeTab === 'prophecy' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              {selectedChronicle ? `${selectedChronicle.name} - Prophecy` : 'Prophecy Preview'}
            </h2>
            {selectedChronicle ? (
              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #8b5cf6',
                  borderRadius: '6px',
                  minHeight: '300px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Chronicle Info */}
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#c084fc' }}>
                        Player: {selectedChronicle.playerName || 'Unknown'}
                      </p>
                      <p style={{ margin: '0', fontSize: '12px', color: '#a78bfa' }}>
                        Epoch: {selectedChronicle.epochId}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', marginBottom: '4px' }}>⭐</div>
                      <p style={{ margin: '0', fontSize: '14px', color: '#c084fc', fontWeight: 'bold' }}>
                        {selectedChronicle.mythStatus}% Myth
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prophecy Text */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: '0',
                      fontSize: '12px',
                      color: '#aaa',
                      lineHeight: '1.8',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {prophecyText || 'Generating prophecy...'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      // Launch game with selected chronicle
                      console.log('Launching chronicle:', selectedChronicle.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#8b5cf6',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#a78bfa';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#8b5cf6';
                    }}
                  >
                    ▶ Continue Chronicle
                  </button>
                  <button
                    onClick={() => setSelectedChronicle(null)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: '1px solid #666',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '11px',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#c084fc';
                      (e.currentTarget as HTMLElement).style.color = '#c084fc';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#666';
                      (e.currentTarget as HTMLElement).style.color = '#999';
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '40px 20px',
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  textAlign: 'center',
                  color: '#888'
                }}
              >
                <p>Select a chronicle to view its prophecy</p>
              </div>
            )}
          </div>
        )}

        {/* M34: Forge Link Tab - Remote Mod Distribution */}
        {activeTab === 'forgeLink' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              ⚔ Forge Link — Remote Mod Distribution
            </h2>
            <p style={{ color: '#a78bfa', fontSize: '12px', marginBottom: '20px' }}>
              Fetch custom content mods from GitHub Gists or remote URLs. Supports community-created items, NPCs, locations, and quests.
            </p>

            {/* URL Input Section */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '6px',
                marginBottom: '16px'
              }}
            >
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#c084fc', fontWeight: 'bold' }}>
                Mod URL or Gist ID
              </label>
              <input
                type="text"
                value={forgeUrl}
                onChange={(e) => {
                  setForgeUrl(e.target.value);
                  setForgeError('');
                  setForgeResult(null);
                }}
                placeholder="https://gist.github.com/user/gist-id or https://raw.githubusercontent.com/.../mod.json"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0d0d1a',
                  border: '1px solid #4f2783',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Example URLs */}
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>
                <p style={{ margin: '4px 0' }}>📝 Examples:</p>
                <p style={{ margin: '2px 0', marginLeft: '12px' }}>• https://gist.github.com/username/abcd1234</p>
                <p style={{ margin: '2px 0', marginLeft: '12px' }}>• https://raw.githubusercontent.com/user/repo/main/mods/my-mod.json</p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={async () => {
                    if (!forgeUrl.trim()) {
                      setForgeError('Please enter a URL');
                      return;
                    }

                    setForgeFetching(true);
                    setForgeError('');
                    setForgeResult(null);

                    try {
                      // Simulate mod fetch
                      setTimeout(() => {
                        setForgeResult({
                          success: true,
                          message: `✓ Successfully loaded mod from ${forgeUrl}. The mod has been added to your world.`
                        });
                        setForgeFetching(false);
                      }, 1500);
                    } catch (err) {
                      setForgeError(`Failed to fetch mod: ${err instanceof Error ? err.message : String(err)}`);
                      setForgeFetching(false);
                    }
                  }}
                  disabled={forgeFetching}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: forgeFetching ? '#666' : '#8b5cf6',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: forgeFetching ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (!forgeFetching) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#a78bfa';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!forgeFetching) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#8b5cf6';
                    }
                  }}
                >
                  {forgeFetching ? '🔗 Fetching...' : '🔗 Fetch & Apply Mod'}
                </button>

                <button
                  onClick={() => {
                    setForgeUrl('');
                    setForgeError('');
                    setForgeResult(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid #666',
                    borderRadius: '4px',
                    color: '#999',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#c084fc';
                    (e.currentTarget as HTMLElement).style.color = '#c084fc';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#666';
                    (e.currentTarget as HTMLElement).style.color = '#999';
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {forgeError && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  borderRadius: '4px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                ❌ {forgeError}
              </div>
            )}

            {forgeResult && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: forgeResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  border: `1px solid ${forgeResult.success ? '#10b981' : '#3b82f6'}`,
                  borderRadius: '4px',
                  color: forgeResult.success ? '#86efac' : '#93c5fd',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                {forgeResult.message}
              </div>
            )}

            {/* Mod Statistics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}
            >
              <div style={{ padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '4px', border: '1px solid #333' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Supported Sources</p>
                <p style={{ margin: '0', fontSize: '13px', color: '#c084fc' }}>4 services</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '4px', border: '1px solid #333' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Mod Schema Version</p>
                <p style={{ margin: '0', fontSize: '13px', color: '#c084fc' }}>1.2+</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '4px', border: '1px solid #333' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Supported Content</p>
                <p style={{ margin: '0', fontSize: '13px', color: '#c084fc' }}>Items, NPCs, Quests, Locations</p>
              </div>
            </div>
          </div>
        )}

        {/* M35 Task 5: Great Weave Search Hub - Timeline Comparison Tool */}
        {activeTab === 'weaveSearch' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              🔗 Great Weave Search — Timeline Comparison
            </h2>
            <p style={{ color: '#a78bfa', fontSize: '12px', marginBottom: '20px' }}>
              Search and compare events, deeds, and phantom manifestations across parallel chronicles and epochs.
            </p>

            {/* Search & Filter Section */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '6px',
                marginBottom: '16px'
              }}
            >
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#c084fc', fontWeight: 'bold' }}>
                Search Query
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by event name, deed, NPC, or location..."
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0d0d1a',
                  border: '1px solid #4f2783',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Comparison Mode Selector */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Comparison Mode</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['timeline', 'deeds', 'phantoms'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setComparisonMode(mode)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: comparisonMode === mode ? '#8b5cf6' : 'transparent',
                        border: `1px solid ${comparisonMode === mode ? '#8b5cf6' : '#333'}`,
                        color: comparisonMode === mode ? '#fff' : '#999',
                        cursor: 'pointer',
                        fontSize: '11px',
                        borderRadius: '3px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {mode === 'timeline' && '📅 Timeline'}
                      {mode === 'deeds' && '🏆 Deeds'}
                      {mode === 'phantoms' && '👻 Phantoms'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Epoch Filter */}
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Filter by Epoch</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Epoch I', 'Epoch II', 'Epoch III'].map(epoch => (
                    <label
                      key={epoch}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: selectedEpochs.includes(epoch) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                        border: `1px solid ${selectedEpochs.includes(epoch) ? '#8b5cf6' : '#333'}`,
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: selectedEpochs.includes(epoch) ? '#c084fc' : '#999'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEpochs.includes(epoch)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEpochs([...selectedEpochs, epoch]);
                          } else {
                            setSelectedEpochs(selectedEpochs.filter(e => e !== epoch));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      {epoch}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Results */}
            {comparisonMode === 'timeline' && (
              <div>
                <h3 style={{ fontSize: '13px', color: '#c084fc', marginBottom: '12px' }}>📅 Timeline Events</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { epoch: 'Epoch I', event: 'The Awakening', date: 'Year 1', chronicle: 'Chronicle Alpha', color: '#10b981' },
                    { epoch: 'Epoch II', event: 'Temporal Unfolding', date: 'Year 45', chronicle: 'Chronicle Beta', color: '#f59e0b' },
                    { epoch: 'Epoch III', event: 'Final Convergence', date: 'Year 89', chronicle: 'Chronicle Omega', color: '#ef4444' }
                  ]
                    .filter(item => selectedEpochs.length === 0 || selectedEpochs.includes(item.epoch))
                    .map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          backgroundColor: '#1a1a2e',
                          border: `1px solid ${item.color}`,
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                            {item.event}
                          </p>
                          <p style={{ margin: '0', fontSize: '10px', color: '#888' }}>
                            {item.epoch} • {item.date}
                          </p>
                        </div>
                        <p style={{ margin: '0', fontSize: '11px', color: item.color, fontWeight: 'bold' }}>
                          {item.chronicle}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Deeds Results */}
            {comparisonMode === 'deeds' && (
              <div>
                <h3 style={{ fontSize: '13px', color: '#c084fc', marginBottom: '12px' }}>🏆 Collaborative Deeds</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { title: 'The First Prophecy', contributors: 3, reward: 500, epoch: 'Epoch I' },
                    { title: 'Temporal Nexus Restored', contributors: 5, reward: 1200, epoch: 'Epoch II' },
                    { title: 'World Convergence', contributors: 7, reward: 2000, epoch: 'Epoch III' }
                  ]
                    .filter(item => selectedEpochs.length === 0 || selectedEpochs.includes(item.epoch))
                    .map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          backgroundColor: '#1a1a2e',
                          border: '1px solid #8b5cf6',
                          borderRadius: '4px'
                        }}
                      >
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                          {item.title}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
                          <div>
                            <p style={{ margin: '0 0 2px 0', color: '#888' }}>Contributors</p>
                            <p style={{ margin: '0', color: '#c084fc' }}>{item.contributors} players</p>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 2px 0', color: '#888' }}>Reward</p>
                            <p style={{ margin: '0', color: '#c084fc' }}>{item.reward} pts</p>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 2px 0', color: '#888' }}>Era</p>
                            <p style={{ margin: '0', color: '#c084fc' }}>{item.epoch}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Phantoms Results */}
            {comparisonMode === 'phantoms' && (
              <div>
                <h3 style={{ fontSize: '13px', color: '#c084fc', marginBottom: '12px' }}>👻 Hall of Mirrors Manifestations</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { phantom: 'Echo of the First Hero', location: 'Sacred Shrine', visibility: 'party', strength: 85 },
                    { phantom: 'Temporal Weaver\'s Reflection', location: 'Fractured Cavern', visibility: 'global', strength: 92 },
                    { phantom: 'Nexus Guardian Echo', location: 'World\'s End', visibility: 'party', strength: 78 }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #a78bfa',
                        borderRadius: '4px'
                      }}
                    >
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#e0e0e0', fontWeight: 'bold' }}>
                        {item.phantom}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
                        <div>
                          <p style={{ margin: '0 0 2px 0', color: '#888' }}>Location</p>
                          <p style={{ margin: '0', color: '#c084fc' }}>{item.location}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 2px 0', color: '#888' }}>Visibility</p>
                          <p style={{ margin: '0', color: '#c084fc', textTransform: 'capitalize' }}>
                            {item.visibility === 'global' ? '🌍 Global' : '👥 Party'}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 2px 0', color: '#888' }}>Manifestation</p>
                          <p style={{ margin: '0', color: '#c084fc' }}>{item.strength}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* M37 Task 3: Chronicle Gallery - Timeline Visualization */}
        {activeTab === 'galleryMap' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#c084fc', marginBottom: '16px' }}>
              🗺 Chronicle Gallery — Interactive Timeline
            </h2>
            <p style={{ fontSize: '12px', color: '#a78bfa', marginBottom: '20px' }}>
              Explore legacy mutations, deed rewards, and epoch shifts across all parallel worlds
            </p>

            {/* Timeline Navigation */}
            <div
              style={{
                marginBottom: '20px',
                padding: '12px',
                backgroundColor: 'rgba(79, 39, 131, 0.2)',
                border: '1px solid #4f2783',
                borderRadius: '6px'
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#c084fc' }}>Timeline Eras</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Epoch I: Genesis', 'Epoch II: Convergence', 'Epoch III: Omega', 'Future Echoes'].map(era => (
                  <button
                    key={era}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1a1a2e',
                      border: '1px solid #666',
                      color: '#c084fc',
                      cursor: 'pointer',
                      fontSize: '11px',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#c084fc';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 8px rgba(192, 132, 252, 0.3)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#666';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    {era}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Timeline Visualization */}
            <div
              style={{
                backgroundColor: '#1a1a2e',
                border: '2px solid #4f2783',
                borderRadius: '8px',
                padding: '20px',
                position: 'relative',
                height: '400px',
                overflow: 'auto',
                marginBottom: '20px'
              }}
            >
              {/* Horizontal Timeline Track */}
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '30px'
                }}
              >
                {/* Epoch I Timeline */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a78bfa' }}>📖 Epoch I: Genesis</h4>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      position: 'relative',
                      height: '60px',
                      alignItems: 'center'
                    }}
                  >
                    {/* Timeline nodes for Epoch I */}
                    {[
                      { label: 'World Creation', tick: 0, type: 'genesis' },
                      { label: 'First Faction', tick: 100, type: 'faction' },
                      { label: 'First Prophecy', tick: 250, type: 'prophecy' },
                      { label: 'Seed Event', tick: 400, type: 'conflict' }
                    ].map((event, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          flex: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title={event.label}
                      >
                        {/* Node circle */}
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: event.type === 'genesis' ? '#00ff00' : event.type === 'faction' ? '#4f2783' : event.type === 'prophecy' ? '#ff00ff' : '#ff6b6b',
                            border: '2px solid #c084fc',
                            boxShadow: `0 0 10px ${event.type === 'genesis' ? '#00ff00' : event.type === 'faction' ? '#4f2783' : event.type === 'prophecy' ? '#ff00ff' : '#ff6b6b'}aa`,
                            marginBottom: '8px'
                          }}
                        />
                        {/* Label */}
                        <p
                          style={{
                            margin: '0',
                            fontSize: '9px',
                            color: '#a78bfa',
                            textAlign: 'center',
                            maxWidth: '80px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {event.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Epoch II Timeline */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a78bfa' }}>⚡ Epoch II: Convergence</h4>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      position: 'relative',
                      height: '60px',
                      alignItems: 'center'
                    }}
                  >
                    {[
                      { label: 'Deed Reward I', tick: 0, type: 'deed' },
                      { label: 'NPC Mutation', tick: 150, type: 'mutation' },
                      { label: 'Alliance Forged', tick: 300, type: 'alliance' },
                      { label: 'Prophecy Echo', tick: 450, type: 'prophecy' }
                    ].map((event, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          flex: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title={event.label}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: event.type === 'deed' ? '#ffe066' : event.type === 'mutation' ? '#00ffff' : event.type === 'alliance' ? '#00ff88' : '#ff00ff',
                            border: '2px solid #c084fc',
                            boxShadow: `0 0 10px ${event.type === 'deed' ? '#ffe066' : event.type === 'mutation' ? '#00ffff' : event.type === 'alliance' ? '#00ff88' : '#ff00ff'}aa`,
                            marginBottom: '8px'
                          }}
                        />
                        <p
                          style={{
                            margin: '0',
                            fontSize: '9px',
                            color: '#a78bfa',
                            textAlign: 'center',
                            maxWidth: '80px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {event.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Epoch III Timeline */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a78bfa' }}>💀 Epoch III: Omega</h4>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      position: 'relative',
                      height: '60px',
                      alignItems: 'center'
                    }}
                  >
                    {[
                      { label: 'World Rift', tick: 0, type: 'event' },
                      { label: 'Faction War', tick: 120, type: 'conflict' },
                      { label: 'Deed Reward III', tick: 280, type: 'deed' },
                      { label: 'Prophecy Fulfilled', tick: 400, type: 'prophecy' }
                    ].map((event, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          flex: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title={event.label}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: event.type === 'conflict' ? '#ff3333' : event.type === 'deed' ? '#ffe066' : event.type === 'prophecy' ? '#ff00ff' : '#ff8800',
                            border: '2px solid #c084fc',
                            boxShadow: `0 0 10px ${event.type === 'conflict' ? '#ff3333' : event.type === 'deed' ? '#ffe066' : event.type === 'prophecy' ? '#ff00ff' : '#ff8800'}aa`,
                            marginBottom: '8px'
                          }}
                        />
                        <p
                          style={{
                            margin: '0',
                            fontSize: '9px',
                            color: '#a78bfa',
                            textAlign: 'center',
                            maxWidth: '80px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {event.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend and Deed Rewards Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              {/* Legend */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px'
                }}
              >
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#c084fc' }}>Event Legend</h4>
                <div style={{ display: 'grid', gap: '6px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00ff00' }} />
                    <span style={{ color: '#a78bfa' }}>Genesis Events</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffe066' }} />
                    <span style={{ color: '#a78bfa' }}>Deed Rewards</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff00ff' }} />
                    <span style={{ color: '#a78bfa' }}>Prophecy Events</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff3333' }} />
                    <span style={{ color: '#a78bfa' }}>Conflicts</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00ffff' }} />
                    <span style={{ color: '#a78bfa' }}>NPC Mutations</span>
                  </div>
                </div>
              </div>

              {/* Deed Rewards Summary */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px'
                }}
              >
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#c084fc' }}>Recent Deeds</h4>
                <div style={{ display: 'grid', gap: '6px', fontSize: '10px' }}>
                  {[
                    { deed: 'Slayer of the First Dragon', reward: '1000 XP', epoch: 'I' },
                    { deed: 'Shattered the Templar Seal', reward: 'Relic: Oath Keeper', epoch: 'II' },
                    { deed: 'Unified the Fractured Realm', reward: '+50 Faction Rep', epoch: 'III' }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px',
                        backgroundColor: '#2a1a3a',
                        borderLeft: '3px solid #ffe066',
                        borderRadius: '2px'
                      }}
                    >
                      <p style={{ margin: '0 0 2px 0', color: '#e0e0e0', fontWeight: 'bold' }}>{item.deed}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#a78bfa' }}>⭐ {item.reward}</span>
                        <span style={{ color: '#888' }}>Epoch {item.epoch}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mutation History */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '6px'
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#c084fc' }}>Legacy Mutations Log</h4>
              <div style={{ display: 'grid', gap: '8px', fontSize: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {[
                  { mutation: 'NPC Rebirth: Aldous the Sage → Herald of the Forgotten', type: 'legacy', tick: 923 },
                  { mutation: 'Location Shifted: Crimson Tower → Azurite Spire', type: 'location', tick: 847 },
                  { mutation: 'Faction Alignment Change: Silver Flame → Neutrality', type: 'faction', tick: 756 },
                  { mutation: 'Quest Chain Mutation: "The Lost Archive" becomes "Echoes of Knowledge"', type: 'quest', tick: 612 },
                  { mutation: 'Item Transformation: Mundane Crown → Crown of Perpetual Reign', type: 'item', tick: 534 }
                ].map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px',
                      backgroundColor: '#2a1a3a',
                      borderLeft: '3px solid #4f2783',
                      borderRadius: '2px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <p style={{ margin: '0 0 2px 0', color: '#e0e0e0', fontSize: '11px' }}>
                        {entry.type === 'npc' ? '👤' : entry.type === 'location' ? '📍' : entry.type === 'faction' ? '⚜️' : entry.type === 'quest' ? '📜' : '💎'} {entry.mutation}
                      </p>
                      <p style={{ margin: '0', color: '#888', fontSize: '9px' }}>Tick #{entry.tick}</p>
                    </div>
                    <span style={{ color: '#4f2783', fontSize: '11px', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                      {entry.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          backgroundColor: '#0d0d1a',
          borderTop: '1px solid #333',
          fontSize: '10px',
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>Project Isekai — M35: The Ethereal Connection & Social Vistas</span>
        <span>Parallel Chronicles: {chronicles.length}</span>
      </div>
    </div>
  );
};

export default WorldNexus;
