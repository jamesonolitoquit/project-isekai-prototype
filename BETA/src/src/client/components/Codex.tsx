import React, { useState } from 'react';

interface CodexProps {
  state?: any;
}

interface DiscoveredNpc {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats?: any;
  reputation?: number;
  location?: string;
}

interface DiscoveredItem {
  id: string;
  name: string;
  type: string;
  rarity?: string;
}

interface DiscoveredLocation {
  id: string;
  name: string;
  description?: string;
  visited: boolean;
}

/**
 * Phase 18: Landmark quest tracking
 */
interface LandmarkQuestEntry {
  questId: string;
  name: string;
  landmarkName: string;
  questType: 'CLEANSE_CORRUPTION' | 'RETRIEVE_RELIC' | 'WITNESS_EVENT' | 'RESOLVE_PARADOX';
  isCompleted: boolean;
  paradoxReward: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  canonLocked?: boolean;
  description: string;
}

/**
 * Codex Component - displays discovered entities and knowledge
 * Part of Phase 10 (WTOL) - allows players to review what they've learned
 */
export default function Codex({ state }: CodexProps) {
  const [activeTab, setActiveTab] = useState<'npcs' | 'items' | 'locations' | 'quests' | 'facts'>('npcs');
  
  const knowledgeBase = state?.player?.knowledgeBase || [];
  const visitedLocations = state?.player?.visitedLocations || [];
  const landmarkQuests = state?.player?.landmarkQuests || [];  // Phase 18

  // Extract discovered NPCs
  const discoveredNpcs: DiscoveredNpc[] = (state?.npcs || [])
    .filter((npc: any) => knowledgeBase.includes(`npc:${npc.id}`))
    .map((npc: any) => ({
      id: npc.id,
      name: npc.name,
      hp: npc.hp,
      maxHp: npc.maxHp,
      stats: npc.stats,
      reputation: state.player?.reputation?.[npc.id] || 0,
      location: state.locations?.find((l: any) => l.id === npc.location)?.name || 'Unknown'
    }));

  // Extract discovered items
  const discoveredItems: DiscoveredItem[] = (state?.player?.inventory || []).map((item: any) => ({
    id: item.itemId,
    name: item.name || item.itemId,
    type: item.type || 'unknown',
    rarity: item.rarity || 'common'
  }));

  // Extract discovered locations
  const discoveredLocations: DiscoveredLocation[] = (state?.locations || [])
    .filter((loc: any) => visitedLocations.includes(loc.id) || knowledgeBase.includes(`location:${loc.id}`))
    .map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      description: loc.description,
      visited: visitedLocations.includes(loc.id)
    }));

  // Extract landmark quests (Phase 18)
  const availableLandmarkQuests: LandmarkQuestEntry[] = landmarkQuests
    .filter((q: any) => !q.isCompleted)
    .map((q: any) => ({
      questId: q.questId,
      name: q.name,
      landmarkName: q.landmarkName,
      questType: q.questType,
      isCompleted: false,
      paradoxReward: q.paradoxReward,
      difficulty: q.difficulty,
      canonLocked: false,
      description: q.description
    }));

  const completedLandmarkQuests: LandmarkQuestEntry[] = landmarkQuests
    .filter((q: any) => q.isCompleted)
    .map((q: any) => ({
      questId: q.questId,
      name: q.name,
      landmarkName: q.landmarkName,
      questType: q.questType,
      isCompleted: true,
      paradoxReward: q.paradoxReward,
      difficulty: q.difficulty,
      canonLocked: q.canonLocked ?? true,  // Completed quests are canon locked
      description: q.description
    }));

  const npcProgressPercent = discoveredNpcs.length > 0 
    ? Math.round((discoveredNpcs.length / Math.max(discoveredNpcs.length, (state?.npcs || []).length)) * 100)
    : 0;

  const locationProgressPercent = discoveredLocations.length > 0
    ? Math.round((discoveredLocations.length / Math.max(discoveredLocations.length, (state?.locations || []).length)) * 100)
    : 0;

  return (
    <div className="codex-panel" style={{ padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '8px', color: '#fff' }}>
      <h2 style={{ margin: '0 0 16px 0', color: '#9B59B6' }}>📖 Codex</h2>
      
      {/* Progress indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
        <div style={{ backgroundColor: '#2a1a3a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #FF6B6B' }}>
          <div>{discoveredNpcs.length} NPCs Discovered</div>
          <div style={{ fontSize: '10px', color: '#aaa' }}>{npcProgressPercent}% complete</div>
        </div>
        <div style={{ backgroundColor: '#2a1a3a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #4ECDC4' }}>
          <div>{discoveredLocations.length} Locations Visited</div>
          <div style={{ fontSize: '10px', color: '#aaa' }}>{locationProgressPercent}% complete</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #333' }}>
        {(['npcs', 'items', 'locations', 'quests', 'facts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 12px',
              backgroundColor: activeTab === tab ? '#9B59B6' : '#2a2a3e',
              color: '#fff',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'npcs' && `NPCs (${discoveredNpcs.length})`}
            {tab === 'items' && `Items (${discoveredItems.length})`}
            {tab === 'locations' && `Locations (${discoveredLocations.length})`}
            {tab === 'quests' && `Landmarks (${completedLandmarkQuests.length})`}
            {tab === 'facts' && 'Facts'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {activeTab === 'npcs' && (
          <div>
            {discoveredNpcs.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No NPCs discovered yet. Use the IDENTIFY spell to learn about NPCs.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {discoveredNpcs.map((npc) => (
                  <div
                    key={npc.id}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '8px',
                      borderRadius: '4px',
                      borderLeft: '2px solid #FF6B6B',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#FF6B6B' }}>{npc.name}</div>
                    <div style={{ color: '#aaa', fontSize: '11px' }}>
                      HP: {npc.hp}/{npc.maxHp} | Location: {npc.location}
                    </div>
                    {npc.stats && (
                      <div style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>
                        STR:{npc.stats.str} AGI:{npc.stats.agi} INT:{npc.stats.int} CHA:{npc.stats.cha} END:{npc.stats.end}
                      </div>
                    )}
                    {npc.reputation !== undefined && (
                      <div style={{ color: npc.reputation > 0 ? '#4CAF50' : '#FF9800', fontSize: '11px', marginTop: '4px' }}>
                        Reputation: {npc.reputation > 0 ? '+' : ''}{npc.reputation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'items' && (
          <div>
            {discoveredItems.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No items in inventory.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {discoveredItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      borderLeft: '2px solid #4ECDC4',
                      fontSize: '11px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{item.name}</span>
                    <span style={{ color: '#888' }}>{item.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'locations' && (
          <div>
            {discoveredLocations.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No locations discovered yet. Explore the world to add to your map.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {discoveredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    style={{
                      backgroundColor: '#2a1a3a',
                      padding: '8px',
                      borderRadius: '4px',
                      borderLeft: `2px solid ${loc.visited ? '#4CAF50' : '#999'}`,
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: loc.visited ? '#4CAF50' : '#888' }}>
                      {loc.visited ? '✓' : '?'} {loc.name}
                    </div>
                    {loc.description && (
                      <div style={{ color: '#aaa', fontSize: '11px', marginTop: '4px' }}>
                        {loc.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'facts' && (
          <div>
            <div style={{ color: '#aaa', fontSize: '12px', padding: '8px' }}>
              <p>Key discoveries through dialogue:</p>
              <ul style={{ fontSize: '11px', paddingLeft: '16px', margin: '8px 0' }}>
                <li>You have discovered {discoveredNpcs.length} NPCs</li>
                <li>You have visited {discoveredLocations.filter(l => l.visited).length} locations</li>
                <li>Mana System: Use spells with INT-based success rates</li>
                <li>Magic Disciplines: Ruin, Flux, Veil, Bind, Life</li>
                <li>Identification: Use IDENTIFY or TRUE SIGHT spells to learn NPC identities</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'quests' && (
          <div>
            {availableLandmarkQuests.length === 0 && completedLandmarkQuests.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '12px' }}>No landmark quests discovered yet. Seek out historical landmarks.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedLandmarkQuests.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d4af37', marginTop: '8px' }}>
                      ✓ COMPLETED LANDMARKS ({completedLandmarkQuests.length})
                    </div>
                    {completedLandmarkQuests.map((q) => (
                      <div
                        key={q.questId}
                        style={{
                          backgroundColor: '#1a2a1a',
                          padding: '8px',
                          borderRadius: '4px',
                          borderLeft: '3px solid #d4af37',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#d4af37' }}>{q.landmarkName}</div>
                          {q.canonLocked && (
                            <span style={{
                              backgroundColor: '#d4af37',
                              color: '#000',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '9px',
                              fontWeight: 'bold'
                            }}>
                              🔒 CANON LOCK
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#aaa', marginTop: '4px' }}>
                          {q.questType === 'CLEANSE_CORRUPTION' ? '🗑️ Cleanse Corruption' :
                           q.questType === 'RETRIEVE_RELIC' ? '🔍 Retrieve Relic' :
                           q.questType === 'WITNESS_EVENT' ? '👁️ Witness Event' :
                           '⚖️ Resolve Paradox'}
                        </div>
                        <div style={{ color: '#4ade80', fontSize: '10px', marginTop: '4px' }}>
                          Paradox Reduced: {Math.abs(q.paradoxReward)}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {availableLandmarkQuests.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88ccee', marginTop: '8px' }}>
                      📜 AVAILABLE QUESTS ({availableLandmarkQuests.length})
                    </div>
                    {availableLandmarkQuests.map((q) => (
                      <div
                        key={q.questId}
                        style={{
                          backgroundColor: '#1a2a3a',
                          padding: '8px',
                          borderRadius: '4px',
                          borderLeft: '3px solid #88ccee',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', color: '#88ccee' }}>{q.name}</div>
                        <div style={{ color: '#aaa', marginTop: '4px', fontSize: '10px' }}>
                          {q.description}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '10px' }}>
                          <span style={{ color: '#888' }}>Difficulty: {'★'.repeat(q.difficulty)}</span>
                          <span style={{ color: '#ff9999' }}>Paradox: {Math.abs(q.paradoxReward)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '10px', color: '#666', marginTop: '12px', borderTop: '1px solid #333', paddingTop: '8px' }}>
        Knowledge Base: {knowledgeBase.length} entries | Suspicion Level: {state?.player?.beliefLayer?.suspicionLevel ?? 0}
      </div>
    </div>
  );
}
