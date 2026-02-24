/**
 * M70: Retention Dashboard
 * Player-facing dashboard showing personalized quests, events, lifecycle progression, and engagement tracking
 * 
 * **Phase 4 Update**: Integrated with Socket.IO real-time event streaming from server
 * - Listens to Socket.IO events: m70:campaign-fired, m70:churn-prediction-updated, m70:engagement-score-updated
 * - Shows campaigns as they fire with real-time progress
 * - Live churn prediction and re-engagement recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSocketIO } from '../hooks/useSocketIO';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RecommendedQuest {
  questId: string;
  name: string;
  type: 'combat' | 'exploration' | 'social' | 'ritual';
  difficulty: number; // 0-100
  affinity: number; // 0-100 (recommendation strength)
  reward: { gold: number; xp: number; items: string[] };
  minLevel: number;
}

interface ScheduledEvent {
  eventId: string;
  name: string;
  difficulty: number;
  reward: number;
  startTime: number;
  endTime: number;
  segment: string; // which player segment this is for
}

interface LifecycleStage {
  stage: 'onboarding' | 'exploration' | 'engagement' | 'mastery' | 'legacy';
  progress: number; // 0-100% to next stage
  hint: string;
}

interface CampaignEvent {
  campaignId: string;
  type: 'reconnection_email' | 'exclusive_reward' | 'event_invitation' | 'milestone_celebration';
  targetPlayerId: string;
  reward?: string;
  firedAt: number;
  responseCount: number;
  responseRate: number;
}

interface AtRiskPlayer {
  playerId: string;
  riskLevel: 'high' | 'medium' | 'low';
  inactivityDays: number;
  lastEngagementScore: number;
  recommendedActions: string[];
}

// ============================================================================
// RETENTION DASHBOARD COMPONENT
// ============================================================================

export const RetentionDashboard: React.FC<{}> = () => {
  // =========================================================================
  // Socket.IO Connection for Real-Time Events
  // =========================================================================
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  const { socket, isConnected, events } = useSocketIO({
    url: 'http://localhost:3002',
    token: token || undefined,
    autoConnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [activePanel, setActivePanel] = useState<'campaigns' | 'atrisk' | 'progress'>('campaigns');
  const [activeCampaigns, setActiveCampaigns] = useState<CampaignEvent[]>([]);
  const [atRiskPlayers, setAtRiskPlayers] = useState<AtRiskPlayer[]>([]);
  const [engagementScore, setEngagementScore] = useState(75);
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>({
    stage: 'engagement',
    progress: 45,
    hint: 'Complete daily quests to reach mastery'
  });

  // =========================================================================
  // Socket.IO Event Listeners & Processing
  // =========================================================================

  useEffect(() => {
    if (events.length === 0) return;

    // Process latest event
    const latestEvent = events[events.length - 1];
    const eventData = (latestEvent as any).data || latestEvent;

    // Route events to appropriate state
    if ((latestEvent as any).type === 'campaign_triggered') {
      const newCampaign: CampaignEvent = {
        campaignId: `campaign-${Date.now()}`,
        type: eventData.campaignType || 'reconnection_email',
        targetPlayerId: eventData.playerId || 'unknown',
        reward: eventData.reward,
        firedAt: Date.now(),
        responseCount: 0,
        responseRate: 0
      };

      setActiveCampaigns(prev => [newCampaign, ...prev.slice(0, 49)]);
    }

    if ((latestEvent as any).type === 'churn_predicted') {
      const atRiskPlayer: AtRiskPlayer = {
        playerId: eventData.playerId || 'unknown',
        riskLevel: eventData.riskScore > 80 ? 'high' : eventData.riskScore > 50 ? 'medium' : 'low',
        inactivityDays: eventData.inactiveDays || 7,
        lastEngagementScore: eventData.currentEngagementScore || 30,
        recommendedActions: eventData.recommendedActions || ['Send exclusive reward', 'Host special event']
      };

      setAtRiskPlayers(prev => {
        // Remove if already exists, then add fresh
        const filtered = prev.filter(p => p.playerId !== atRiskPlayer.playerId);
        return [atRiskPlayer, ...filtered.slice(0, 49)];
      });
    }

    if ((latestEvent as any).type === 'engagement_updated') {
      setEngagementScore(Math.min(100, eventData.engagementScore || engagementScore));
    }

    if ((latestEvent as any).type === 'campaign_response_received') {
      setActiveCampaigns(prev =>
        prev.map(c => {
          if (c.campaignId === eventData.campaignId) {
            return {
              ...c,
              responseCount: c.responseCount + 1,
              responseRate: Math.min(100, ((c.responseCount + 1) / 50) * 100)
            };
          }
          return c;
        })
      );
    }
  }, [events]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2>🎯 Your Personal Adventure</h2>
          {/* Socket.IO Connection Indicator */}
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#00ff00' : '#888',
            boxShadow: isConnected ? '0 0 8px #00ff00' : 'none'
          }} title={isConnected ? 'Connected to server' : 'Disconnected from server'} />
        </div>
        <div style={styles.engagementBar}>
          <div
            style={{
              ...styles.engagementFill,
              width: `${engagementScore}%`,
              backgroundColor: engagementScore > 70 ? '#32CD32' : engagementScore > 40 ? '#FFD700' : '#FF6B6B',
            }}
          />
          <span style={{ marginLeft: '8px' }}>Engagement: {engagementScore.toFixed(0)}%</span>
        </div>
      </div>

      {/* PANEL NAVIGATION */}
      <div style={styles.panelNav}>
        {(['campaigns', 'atrisk', 'progress'] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => setActivePanel(panel)}
            style={{
              ...styles.panelButton,
              backgroundColor: activePanel === panel ? '#4CAF50' : '#444',
            }}
          >
            {panel === 'campaigns' && '📢 Active Campaigns'}
            {panel === 'atrisk' && '⚠️ At-Risk Players'}
            {panel === 'progress' && '📈 Your Progress'}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={styles.content}>
        {activePanel === 'campaigns' && (
          <CampaignsPanel campaigns={activeCampaigns} />
        )}

        {activePanel === 'atrisk' && (
          <AtRiskPanel players={atRiskPlayers} />
        )}

        {activePanel === 'progress' && (
          <ProgressPanel stage={lifecycleStage} engagementScore={engagementScore} />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CAMPAIGNS PANEL
// ============================================================================

const CampaignsPanel: React.FC<{
  campaigns: CampaignEvent[];
}> = ({ campaigns }) => (
  <div>
    <h3>📢 Active Campaigns</h3>
    {campaigns.length === 0 ? (
      <p style={{ color: '#aaa' }}>No active campaigns right now. Check back later!</p>
    ) : (
      <div style={styles.campaignList}>
        {campaigns.map((campaign) => (
          <div key={campaign.campaignId} style={styles.campaignCard}>
            <div style={styles.campaignHeader}>
              <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                {campaign.type === 'reconnection_email' && '📧 Reconnection Offer'}
                {campaign.type === 'exclusive_reward' && '🎁 Exclusive Reward'}
                {campaign.type === 'event_invitation' && '🎉 Event Invitation'}
                {campaign.type === 'milestone_celebration' && '🏆 Milestone'}
              </span>
              <span style={{ color: '#aaa', fontSize: '0.9em' }}>
                {new Date(campaign.firedAt).toLocaleTimeString()}
              </span>
            </div>

            {campaign.reward && (
              <p style={{ fontSize: '0.95em', color: '#4CAF50', margin: '8px 0' }}>
                🎁 Reward: {campaign.reward}
              </p>
            )}

            <div style={styles.responseProgress}>
              <div style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                Response Rate: {campaign.responseRate.toFixed(0)}% ({campaign.responseCount} responses)
              </div>
              <div style={{
                backgroundColor: '#1a2a1a',
                height: '8px',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${campaign.responseRate}%`,
                  height: '100%',
                  backgroundColor: '#4CAF50',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// AT-RISK PLAYERS PANEL
// ============================================================================

const AtRiskPanel: React.FC<{
  players: AtRiskPlayer[];
}> = ({ players }) => (
  <div>
    <h3>⚠️ At-Risk Players Requiring Attention</h3>
    {players.length === 0 ? (
      <p style={{ color: '#aaa' }}>No players at immediate risk. Keep monitoring engagement!</p>
    ) : (
      <div style={styles.playerList}>
        {players.map((player) => (
          <div key={player.playerId} style={{
            ...styles.playerCard,
            borderLeftColor: player.riskLevel === 'high' ? '#ff0000' : player.riskLevel === 'medium' ? '#ffa500' : '#ffd700'
          }}>
            <div style={styles.playerHeader}>
              <span style={{ fontWeight: 'bold' }}>
                {player.riskLevel === 'high' && '🚨'}
                {player.riskLevel === 'medium' && '⚠️'}
                {player.riskLevel === 'low' && '📊'}
                {' '}
                {player.playerId}
              </span>
              <span style={{
                backgroundColor: player.riskLevel === 'high' ? '#4a1a1a' : player.riskLevel === 'medium' ? '#4a3a1a' : '#4a4a1a',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.8em'
              }}>
                {player.riskLevel.toUpperCase()} RISK
              </span>
            </div>

            <div style={{ fontSize: '0.9em', color: '#aaa', margin: '8px 0' }}>
              Inactive: {player.inactivityDays} days | Engagement: {player.lastEngagementScore}%
            </div>

            <div style={{ fontSize: '0.85em', color: '#ccc' }}>
              <strong>Recommended Actions:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {player.recommendedActions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// PROGRESS PANEL
// ============================================================================

const ProgressPanel: React.FC<{
  stage: LifecycleStage;
  engagementScore: number;
}> = ({ stage, engagementScore }) => {
  const stageDescriptions = {
    onboarding: 'Get familiar with the world and meet key NPCs',
    exploration: 'Explore new regions and uncover secrets',
    engagement: 'Master challenging quests and competitions',
    mastery: 'Become a legendary hero and influence the world',
    legacy: 'Shape the future with your legend',
  };

  return (
    <div>
      <h3>📈 Your Adventure Progress</h3>

      <div style={styles.progressSection}>
        <h4>Current Stage: {stage.stage.toUpperCase()}</h4>
        <p style={{ color: '#aaa' }}>{stageDescriptions[stage.stage]}</p>

        <div style={styles.progressBar}>
          <div
            style={{
              width: `${stage.progress}%`,
              height: '100%',
              backgroundColor: '#4CAF50',
              borderRadius: '4px',
              transition: 'width 0.3s',
            }}
          />
          <span style={{ marginLeft: '8px' }}>{stage.progress}% to next stage</span>
        </div>

        <p style={{ fontSize: '0.9em', marginTop: '12px', color: '#aaa' }}>
          💡 {stage.hint}
        </p>
      </div>

      <div style={styles.sessionStats}>
        <h4>Engagement Health</h4>
        <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: engagementScore > 70 ? '#32CD32' : engagementScore > 40 ? '#FFD700' : '#FF6B6B' }}>
          {engagementScore.toFixed(0)}% / 100%
        </p>
        <p style={{ fontSize: '0.9em', color: '#aaa' }}>
          {engagementScore > 70 ? '🎉 Great! Keep up the engagement!' : engagementScore > 40 ? '📊 Moderate engagement. Try new content!' : '⚠️ Engagement dropping. Consider new activities.'}
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#0a1a14',
    color: '#fff',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: 'sans-serif',
    border: '1px solid #2a5a3a',
  },
  header: {
    marginBottom: '16px',
    borderBottom: '2px solid #2a5a3a',
    paddingBottom: '12px',
  },
  engagementBar: {
    display: 'flex',
    alignItems: 'center',
    height: '24px',
    backgroundColor: '#1a2a1a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
    border: '1px solid #2a5a3a',
  },
  engagementFill: {
    height: '100%',
    transition: 'width 0.5s',
  },
  panelNav: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  panelButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'sans-serif',
    fontSize: '0.95em',
    transition: 'background-color 0.2s',
  },
  content: {
    backgroundColor: '#0a1a14',
    borderRadius: '4px',
    padding: '12px',
    minHeight: '400px',
  },
  questList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  questCard: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #2a5a3a',
    transition: 'background-color 0.2s',
  },
  questHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  affinityBadge: (affinity: number) => ({
    backgroundColor: affinity > 70 ? '#32CD32' : affinity > 40 ? '#FFD700' : '#FF6B6B',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.85em',
    fontWeight: 'bold' as const,
  }),
  questDetails: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '0.9em',
  },
  badge: {
    backgroundColor: '#2a4a2a',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#aaa',
  },
  typeIcon: (type: string) => ({
    marginLeft: 'auto',
    fontSize: '1.2em',
  }),
  questReward: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
    fontSize: '0.9em',
    color: '#FFD700',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
    transition: 'background-color 0.2s',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  eventCard: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #2a5a3a',
  },
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  eventDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontSize: '0.9em',
    marginBottom: '8px',
  },
  progressSection: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
    border: '1px solid #2a5a3a',
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    height: '20px',
    backgroundColor: '#0a1a14',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
    border: '1px solid #2a5a3a',
  },
  sessionStats: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #2a5a3a',
    fontSize: '0.9em',
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  campaignCard: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #2a5a3a',
    borderLeft: '4px solid #4CAF50',
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  responseProgress: {
    marginTop: '8px',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  playerCard: {
    backgroundColor: '#1a2a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #2a5a3a',
    borderLeft: '4px solid #ffa500',
  },
  playerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
};

export default RetentionDashboard;
