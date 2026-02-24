import React, { useState, useEffect } from 'react';
import type { WorldState } from '../../engine/worldEngine';

/**
 * Phase 30 Task 3: Myth Status Dashboard - The Chronicle UI
 * Real-time visualization of player's myth rank progression
 * and world delta summary from player actions
 */

interface MythRank {
  tier: number;
  name: 'Forgotten' | 'Noticed' | 'Heroic' | 'Infamous' | 'Mythic';
  minStatus: number;
  maxStatus: number;
  description: string;
  icon: string;
}

const MYTH_RANKS: MythRank[] = [
  {
    tier: 0,
    name: 'Forgotten',
    minStatus: 0,
    maxStatus: 20,
    description: 'A name lost to time',
    icon: '👤'
  },
  {
    tier: 1,
    name: 'Noticed',
    minStatus: 21,
    maxStatus: 40,
    description: 'Whispers speak your name',
    icon: '👁️'
  },
  {
    tier: 2,
    name: 'Heroic',
    minStatus: 41,
    maxStatus: 65,
    description: 'Songs of your deeds echo',
    icon: '⚔️'
  },
  {
    tier: 3,
    name: 'Infamous',
    minStatus: 41,
    maxStatus: 65,
    description: 'Your name brings dread or hope',
    icon: '💀'
  },
  {
    tier: 4,
    name: 'Mythic',
    minStatus: 66,
    maxStatus: 100,
    description: 'You are legend incarnate',
    icon: '✨'
  }
];

interface WorldDelta {
  type: 'location_changed' | 'faction_shift' | 'npc_death' | 'quest_completed' | 'landmark_discovery' | 'epidemic' | 'war';
  description: string;
  magnitude: number;  // 1-10 scale of impact
  timestamp: number;
}

interface MythStatusDashboardProps {
  state: WorldState;
  isOpen: boolean;
  onClose: () => void;
}

export default function MythStatusDashboard({ state, isOpen, onClose }: MythStatusDashboardProps) {
  const [mythStatus, setMythStatus] = useState(0);
  const [currentRank, setCurrentRank] = useState<MythRank>(MYTH_RANKS[0]);
  const [rankProgress, setRankProgress] = useState(0);  // 0-100% to next rank
  const [worldDeltas, setWorldDeltas] = useState<WorldDelta[]>([]);
  const [selectedDeltaType, setSelectedDeltaType] = useState<string | null>(null);

  // Update myth status from game state
  useEffect(() => {
    if (!state || !state.player) return;

    const playerMythStatus = state.player.mythStatus || 0;
    setMythStatus(playerMythStatus);

    // Determine current rank
    const rank = MYTH_RANKS.find(r => playerMythStatus >= r.minStatus && playerMythStatus <= r.maxStatus) || MYTH_RANKS[0];
    setCurrentRank(rank);

    // Calculate progress to next rank
    if (rank.tier < MYTH_RANKS.length - 1) {
      const nextRank = MYTH_RANKS[rank.tier + 1];
      const rangeSize = nextRank.minStatus - rank.minStatus;
      const progressInRange = playerMythStatus - rank.minStatus;
      const progress = Math.min(100, Math.floor((progressInRange / rangeSize) * 100));
      setRankProgress(progress);
    } else {
      setRankProgress(100);  // At max rank
    }

    // Extract world deltas from chronicle
    const deltas = extractWorldDeltas(state);
    setWorldDeltas(deltas);
  }, [state]);

  /**
   * Extract world delta events that were caused by player actions
   */
  function extractWorldDeltas(state: WorldState): WorldDelta[] {
    const deltas: WorldDelta[] = [];

    // Phase 27-28 legacy: Use event history from macro events system
    const eventHistory = (state as any)._eventHistory || [];
    if (Array.isArray(eventHistory)) {
      const recentEvents = eventHistory.slice(-50);  // Last 50 events
      
      recentEvents.forEach((event: any) => {
        if (event.type === 'FACTION_SKIRMISH') {
          deltas.push({
            type: 'faction_shift',
            description: `${event.payload?.factionA} clashed with ${event.payload?.factionB}`,
            magnitude: event.payload?.powerShift || 5,
            timestamp: event.timestamp || Date.now()
          });
        } else if (event.type === 'LOCATION_CORRUPTED' || event.type === 'LOCATION_HEALED') {
          deltas.push({
            type: 'location_changed',
            description: `A location was ${event.type === 'LOCATION_CORRUPTED' ? 'corrupted' : 'healed'}`,
            magnitude: 3,
            timestamp: event.timestamp || Date.now()
          });
        } else if (event.type === 'NPC_DIED') {
          deltas.push({
            type: 'npc_death',
            description: `${event.payload?.npcName} perished`,
            magnitude: event.payload?.importance === 'critical' ? 8 : 4,
            timestamp: event.timestamp || Date.now()
          });
        } else if (event.type === 'QUEST_COMPLETED') {
          deltas.push({
            type: 'quest_completed',
            description: `A great deed was accomplished`,
            magnitude: 5,
            timestamp: event.timestamp || Date.now()
          });
        }
      });
    }

    // Phase 29: Paradox anomalies as world delta
    const paradoxState = (state as any).paradoxState;
    if (paradoxState?.activeAnomalies && Array.isArray(paradoxState.activeAnomalies)) {
      const anomalySeverity = paradoxState.activeAnomalies
        .reduce((sum: number, a: any) => sum + (a.severity || 0), 0) / paradoxState.activeAnomalies.length;
      
      if (anomalySeverity > 50) {
        deltas.push({
          type: 'epidemic',
          description: `Reality fractures under paradox strain`,
          magnitude: Math.min(10, Math.floor(anomalySeverity / 10)),
          timestamp: state.tick || Date.now()
        });
      }
    }

    // Sort by timestamp (newest first)
    return deltas.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get delta icon and color by type
   */
  function getDeltaVisuals(type: WorldDelta['type']): { icon: string; color: string } {
    switch (type) {
      case 'faction_shift':
        return { icon: '⚔️', color: '#ff6b6b' };
      case 'location_changed':
        return { icon: '🏛️', color: '#ffd93d' };
      case 'npc_death':
        return { icon: '💀', color: '#a8dadc' };
      case 'quest_completed':
        return { icon: '🎯', color: '#06ffa5' };
      case 'landmark_discovery':
        return { icon: '🗺️', color: '#457b9d' };
      case 'epidemic':
        return { icon: '⚡', color: '#e63946' };
      case 'war':
        return { icon: '🔥', color: '#d62828' };
      default:
        return { icon: '•', color: '#888' };
    }
  }

  /**
   * Calculate the impact score of all deltas combined
   */
  function calculateWorldImpact(): number {
    return Math.min(100, worldDeltas.reduce((sum, d) => sum + d.magnitude, 0));
  }

  if (!isOpen || !state) return null;

  const nextRank = currentRank.tier < MYTH_RANKS.length - 1 
    ? MYTH_RANKS[currentRank.tier + 1]
    : null;
  
  const filteredDeltas = selectedDeltaType
    ? worldDeltas.filter(d => d.type === selectedDeltaType)
    : worldDeltas;

  return (
    <div className="myth-dashboard-overlay">
      <div className="myth-dashboard-modal">
        <div className="myth-dashboard-header">
          <h1>Chronicle of Legends</h1>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="myth-dashboard-content">
          {/* Myth Rank Progression Section */}
          <div className="myth-rank-section">
            <div className="rank-display">
              <div className="rank-icon">{currentRank.icon}</div>
              <div className="rank-info">
                <h2>{currentRank.name}</h2>
                <p className="rank-description">{currentRank.description}</p>
                <p className="rank-status">{mythStatus}/100</p>
              </div>
            </div>

            {/* Progression Bar */}
            <div className="progression-container">
              <div className="progression-label">
                <span>{currentRank.name}</span>
                <span>{rankProgress}%</span>
                {nextRank && <span>{nextRank.name}</span>}
              </div>
              <div className="progression-bar">
                <div 
                  className="progression-fill" 
                  style={{ width: `${rankProgress}%` }}
                />
              </div>
            </div>

            {/* All Ranks Display */}
            <div className="all-ranks-display">
              {MYTH_RANKS.map((rank) => (
                <div
                  key={rank.tier}
                  className={`rank-tier ${rank.tier === currentRank.tier ? 'active' : ''}`}
                  title={rank.name}
                >
                  {rank.icon}
                </div>
              ))}
            </div>
          </div>

          {/* World Delta Summary Section */}
          <div className="world-delta-section">
            <h3>World Changes</h3>
            
            <div className="delta-impact-summary">
              <div className="impact-meter">
                <p>World Impact: {calculateWorldImpact()}/100</p>
                <div className="impact-bar">
                  <div 
                    className="impact-fill" 
                    style={{ width: `${Math.min(100, calculateWorldImpact())}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Delta Type Filters */}
            <div className="delta-filters">
              <button
                className={`filter-btn ${selectedDeltaType === null ? 'active' : ''}`}
                onClick={() => setSelectedDeltaType(null)}
              >
                All ({worldDeltas.length})
              </button>
              <button
                className={`filter-btn ${selectedDeltaType === 'faction_shift' ? 'active' : ''}`}
                onClick={() => setSelectedDeltaType('faction_shift')}
              >
                ⚔️ Factions
              </button>
              <button
                className={`filter-btn ${selectedDeltaType === 'quest_completed' ? 'active' : ''}`}
                onClick={() => setSelectedDeltaType('quest_completed')}
              >
                🎯 Quests
              </button>
              <button
                className={`filter-btn ${selectedDeltaType === 'epidemic' ? 'active' : ''}`}
                onClick={() => setSelectedDeltaType('epidemic')}
              >
                ⚡ Paradox
              </button>
            </div>

            {/* Delta Events List */}
            <div className="delta-events-list">
              {filteredDeltas.length === 0 ? (
                <div className="no-deltas">No world changes recorded yet.</div>
              ) : (
                filteredDeltas.slice(0, 15).map((delta, idx) => {
                  const visuals = getDeltaVisuals(delta.type);
                  return (
                    <div key={idx} className="delta-event">
                      <div className="delta-icon" style={{ color: visuals.color }}>
                        {visuals.icon}
                      </div>
                      <div className="delta-content">
                        <p className="delta-description">{delta.description}</p>
                        <div className="delta-magnitude">
                          Impact: {Array(Math.ceil(delta.magnitude / 2)).fill('●').join('')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Deeds Section */}
          <div className="deeds-section">
            <h3>Canonical Deeds</h3>
            <div className="deeds-list">
              {state.player?.bloodlineData?.deeds && Array.isArray(state.player.bloodlineData.deeds) ? (
                state.player.bloodlineData.deeds.slice(-5).map((deed: string, idx: number) => (
                  <div key={idx} className="deed-item">
                    <span className="deed-number">{idx + 1}.</span>
                    <span className="deed-text">{deed}</span>
                  </div>
                ))
              ) : (
                <p className="no-deeds">No deeds recorded yet. Make your mark on the world!</p>
              )}
            </div>
          </div>
        </div>

        <style jsx>{`
          .myth-dashboard-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .myth-dashboard-modal {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #0f3460;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          }

          .myth-dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 2px solid #0f3460;
            background: rgba(15, 52, 96, 0.3);
          }

          .myth-dashboard-header h1 {
            margin: 0;
            color: #ffd93d;
            font-size: 24px;
          }

          .close-button {
            background: none;
            border: none;
            color: #888;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-button:hover {
            color: #ffd93d;
          }

          .myth-dashboard-content {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 30px;
          }

          .myth-rank-section {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .rank-display {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 15px;
            background: rgba(15, 52, 96, 0.2);
            border-radius: 8px;
            border-left: 4px solid #ffd93d;
          }

          .rank-icon {
            font-size: 48px;
          }

          .rank-info {
            flex: 1;
          }

          .rank-info h2 {
            margin: 0;
            color: #ffd93d;
            font-size: 20px;
          }

          .rank-description {
            margin: 5px 0;
            color: #ccc;
            font-style: italic;
          }

          .rank-status {
            margin: 5px 0;
            color: #888;
            font-size: 12px;
          }

          .progression-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .progression-label {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #888;
          }

          .progression-bar {
            height: 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #0f3460;
          }

          .progression-fill {
            height: 100%;
            background: linear-gradient(90deg, #06ffa5 0%, #ffd93d 100%);
            transition: width 0.3s ease;
          }

          .all-ranks-display {
            display: flex;
            justify-content: space-around;
            gap: 10px;
          }

          .rank-tier {
            font-size: 24px;
            opacity: 0.4;
            transition: opacity 0.3s ease;
          }

          .rank-tier.active {
            opacity: 1;
            transform: scale(1.2);
          }

          .world-delta-section {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .world-delta-section h3 {
            margin: 0;
            color: #ffd93d;
            font-size: 16px;
          }

          .delta-impact-summary {
            padding: 12px;
            background: rgba(15, 52, 96, 0.2);
            border-radius: 6px;
          }

          .impact-meter p {
            margin: 0 0 8px 0;
            color: #888;
            font-size: 12px;
          }

          .impact-bar {
            height: 12px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            overflow: hidden;
          }

          .impact-fill {
            height: 100%;
            background: linear-gradient(90deg, #06ffa5 0%, #e63946 100%);
          }

          .delta-filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .filter-btn {
            padding: 6px 12px;
            background: rgba(15, 52, 96, 0.3);
            border: 1px solid #0f3460;
            color: #ccc;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .filter-btn:hover {
            border-color: #ffd93d;
          }

          .filter-btn.active {
            background: rgba(255, 217, 61, 0.2);
            border-color: #ffd93d;
            color: #ffd93d;
          }

          .delta-events-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: 300px;
            overflow-y: auto;
          }

          .no-deltas {
            text-align: center;
            color: #888;
            padding: 20px;
            font-size: 12px;
          }

          .delta-event {
            display: flex;
            gap: 12px;
            padding: 10px;
            background: rgba(15, 52, 96, 0.1);
            border-radius: 6px;
            border-left: 3px solid #0f3460;
          }

          .delta-icon {
            font-size: 20px;
            flex-shrink: 0;
          }

          .delta-content {
            flex: 1;
            min-width: 0;
          }

          .delta-description {
            margin: 0;
            color: #ccc;
            font-size: 13px;
          }

          .delta-magnitude {
            margin: 4px 0 0 0;
            color: #888;
            font-size: 11px;
          }

          .deeds-section h3 {
            margin: 0 0 10px 0;
            color: #ffd93d;
            font-size: 16px;
          }

          .deeds-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .no-deeds {
            color: #888;
            font-size: 13px;
            font-style: italic;
            margin: 0;
          }

          .deed-item {
            display: flex;
            gap: 10px;
            padding: 8px;
            background: rgba(15, 52, 96, 0.1);
            border-radius: 4px;
            color: #ccc;
            font-size: 13px;
          }

          .deed-number {
            color: #ffd93d;
            font-weight: bold;
            flex-shrink: 0;
          }

          .deed-text {
            flex: 1;
          }
        `}</style>
      </div>
    </div>
  );
}
