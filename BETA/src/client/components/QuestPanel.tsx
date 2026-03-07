import React, { useMemo } from 'react';
import PhysicalChronicle from './PhysicalChronicle';

interface QuestPanelProps {
  state?: any;
  position?: 'left' | 'right' | 'center';
}

/**
 * Phase 32: QuestPanel refactored to use PhysicalChronicle
 * Transforms quests into parchment scroll entries rendered in world-space
 */
export default function QuestPanel({ state, position = 'right' }: QuestPanelProps) {
  const quests = state?.quests ?? [];
  const playerQuests = state?.player?.quests ?? {};

  // Transform quest data into PhysicalChronicle entries
  const questEntries = useMemo(() => {
    return quests
      .filter((quest: any) => quest.id && quest.title)
      .map((quest: any, index: number) => {
        const questStatus = playerQuests[quest.id];
        const statusIcon = !questStatus 
          ? '📋' 
          : questStatus === 'completed' 
            ? '✨' 
            : questStatus === 'failed'
              ? '💔'
              : '🎯';

        return {
          id: quest.id,
          timestamp: questStatus?.startedAt || new Date().toISOString(),
          text: quest.title + (quest.description ? `\n${quest.description}` : ''),
          icon: statusIcon
        };
      });
  }, [quests, playerQuests]);

  return (
    <PhysicalChronicle
      title="📜 Active Deeds"
      entries={questEntries}
      position={position}
      maxHeight="350px"
    />
  );
}

