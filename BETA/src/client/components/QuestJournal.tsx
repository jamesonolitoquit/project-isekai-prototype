/**
 * QuestJournal Component
 * 
 * Displays player quests organized by status.
 * Features:
 * - Active Quests: Current objectives with progress
 * - Completed Quests: Archives with rewards earned
 * - Failed Quests: Tracking failed objectives
 * - Quest Details: Flavor text, rewards, and tracking info
 * - Diegetic UI: Parchment-style presentation
 * 
 * Phase 3: Full quest management UI with filtering and tracking
 */

import React, { useMemo, useState } from 'react';
import type { PlayerState, Quest, PlayerQuestState } from '../../engine/worldEngine';
import { useHUDContext } from './PlayerHUDContainer';

export interface QuestJournalProps {
  player: PlayerState;
  quests: Quest[];
  onCompleteQuest?: (questId: string) => void;
  onAbandonQuest?: (questId: string) => void;
}

type QuestTabType = 'active' | 'completed' | 'failed';

export const QuestJournal: React.FC<QuestJournalProps> = ({
  player,
  quests,
  onCompleteQuest,
  onAbandonQuest,
}) => {
  const { theme } = useHUDContext();
  const [activeTab, setActiveTab] = useState<QuestTabType>('active');

  // Categorize quests by status
  const categorizedQuests = useMemo(() => {
    const active: (Quest & { playerState: PlayerQuestState | undefined })[] = [];
    const completed: (Quest & { playerState: PlayerQuestState | undefined })[] = [];
    const failed: (Quest & { playerState: PlayerQuestState | undefined })[] = [];

    quests.forEach((quest) => {
      const playerQuestState = player.quests?.[quest.id];
      const questWithState = { ...quest, playerState: playerQuestState };

      if (!playerQuestState) {
        // Not started yet
        return;
      }

      if (playerQuestState.status === 'completed') {
        completed.push(questWithState);
      } else if (playerQuestState.status === 'failed') {
        failed.push(questWithState);
      } else {
        active.push(questWithState);
      }
    });

    return { active, completed, failed };
  }, [player.quests, quests]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    color: theme.colors.text,
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0',
    borderBottom: `2px solid ${theme.colors.border}`,
    marginBottom: '12px',
    backgroundColor: theme.colors.primary,
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px',
    backgroundColor: isActive ? theme.colors.secondary : 'transparent',
    border: 'none',
    borderBottom: isActive ? `3px solid ${theme.colors.accent}` : 'none',
    color: isActive ? theme.colors.accent : theme.colors.textSecondary,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    transition: 'all 0.2s',
    fontFamily: theme.fonts.heading,
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const questItemStyle: React.CSSProperties = {
    backgroundColor: theme.colors.secondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    padding: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const questHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  };

  const questTitleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontFamily: theme.fonts.heading,
  };

  const questTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    marginBottom: '8px',
    lineHeight: 1.4,
  };

  const questRewardStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const rewardBadgeStyle = (type: 'gold' | 'xp' | 'reputation'): React.CSSProperties => {
    const colors = {
      gold: { bg: theme.colors.xp.bar, text: theme.colors.primary },
      xp: { bg: theme.colors.mana.bar, text: theme.colors.primary }, 
      reputation: { bg: theme.colors.health.bar, text: theme.colors.primary },
    };
    const color = colors[type];
    return {
      padding: '4px 8px',
      backgroundColor: color.bg,
      color: color.text,
      borderRadius: '3px',
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: theme.fonts.mono,
    };
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textSecondary,
    fontSize: '14px',
    padding: '40px 20px',
    textAlign: 'center',
  };

  const renderQuest = (quest: Quest & { playerState: PlayerQuestState | undefined }, index: number) => {
    if (!quest.playerState) return null;

    const questType = activeTab;
    const statusIcon = questType === 'completed' ? '✓' : questType === 'failed' ? '✗' : '◉';

    const rewards = quest.rewards as any || {};
    const goldReward = rewards.gold || (quest as any).goldReward || 0;
    const xpReward = rewards.xp || (quest as any).xpReward || 0;
    const reputationReward = rewards.reputation || (quest as any).reputationReward || 0;

    return (
      <div
        key={quest.id || index}
        style={questItemStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primary;
          (e.currentTarget as HTMLElement).style.borderColor = theme.colors.accent;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.secondary;
          (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
        }}
      >
        {/* Quest Header */}
        <div style={questHeaderStyle}>
          <div style={{ flex: 1 }}>
            <div style={questTitleStyle}>
              <span style={{ marginRight: '8px', color: theme.colors.accent }}>{statusIcon}</span>
              {quest.title || quest.id}
            </div>
          </div>
          {activeTab === 'active' && (
            <button
              style={{
                padding: '4px 8px',
                backgroundColor: theme.colors.warning,
                border: 'none',
                borderRadius: '2px',
                color: theme.colors.primary,
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={() => onAbandonQuest?.(quest.id)}
            >
              Abandon
            </button>
          )}
        </div>

        {/* Quest Description */}
        {quest.description && (
          <div style={questTextStyle}>{quest.description}</div>
        )}

        {/* Quest Progress (for active quests) */}
        {activeTab === 'active' && quest.playerState && (
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
            Progress: {quest.playerState.currentObjectiveIndex ?? 0}%  Complete
          </div>
        )}

        {/* Rewards */}
        {(goldReward || xpReward) && (
          <div style={questRewardStyle}>
            {goldReward > 0 && (
              <div style={rewardBadgeStyle('gold')}>💰 {goldReward} Gold</div>
            )}
            {xpReward > 0 && (
              <div style={rewardBadgeStyle('xp')}>⭐ {xpReward} XP</div>
            )}
            {reputationReward > 0 && (
              <div style={rewardBadgeStyle('reputation')}>
                🏆 {reputationReward} Rep
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const activeQuests = categorizedQuests.active;
  const completedQuests = categorizedQuests.completed;
  const failedQuests = categorizedQuests.failed;

  const currentQuests =
    activeTab === 'active'
      ? activeQuests
      : activeTab === 'completed'
        ? completedQuests
        : failedQuests;

  return (
    <div style={containerStyle}>
      {/* TAB NAVIGATION */}
      <div style={tabsStyle}>
        <button
          style={tabButtonStyle(activeTab === 'active')}
          onClick={() => setActiveTab('active')}
        >
          Active ({activeQuests.length})
        </button>
        <button
          style={tabButtonStyle(activeTab === 'completed')}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({completedQuests.length})
        </button>
        <button
          style={tabButtonStyle(activeTab === 'failed')}
          onClick={() => setActiveTab('failed')}
        >
          Failed ({failedQuests.length})
        </button>
      </div>

      {/* QUEST LIST */}
      <div style={contentStyle}>
        {currentQuests.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📜</div>
            <div>
              {activeTab === 'active' ? 'No active quests' : activeTab === 'completed' ? 'No completed quests' : 'No failed quests'}
            </div>
          </div>
        ) : (
          currentQuests.map((quest, idx) => renderQuest(quest, idx))
        )}
      </div>
    </div>
  );
};

export default QuestJournal;
