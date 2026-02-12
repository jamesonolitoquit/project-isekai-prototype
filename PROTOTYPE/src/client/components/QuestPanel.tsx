import React from 'react';

interface QuestPanelProps {
  state?: any;
}

export default function QuestPanel({ state }: QuestPanelProps) {
  const quests = state?.quests ?? [];
  const playerQuests = state?.player?.quests ?? {};

  return (
    <div className="quest-panel">
      <h3>Quests</h3>
      {quests.length === 0 ? (
        <p>No quests available.</p>
      ) : (
        <ul>
          {quests.map((quest: any) => (
            <li key={quest.id}>
              {quest.title} - {playerQuests[quest.id]?.status || 'not_started'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
