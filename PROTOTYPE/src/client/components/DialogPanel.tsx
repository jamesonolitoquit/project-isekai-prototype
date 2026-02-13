import React from 'react';

interface DialogPanelProps {
  state?: any;
  onChoose?: (npcId: string, choiceId: string) => void;
}

/**
 * Get NPC display name - mask if not identified
 */
function getNpcName(npcId: string, state: any): string {
  const knowledgeBase = state?.player?.knowledgeBase || [];
  if (knowledgeBase?.includes(`npc:${npcId}`)) {
    const npc = state?.npcs?.find((n: any) => n.id === npcId);
    return npc?.name || npcId;
  }
  return '??? (Unknown)';
}

export default function DialogPanel({ state, onChoose }: DialogPanelProps) {
  const dialogueHistory = state?.player?.dialogueHistory ?? [];
  const latestEntry = dialogueHistory.length > 0 ? dialogueHistory[dialogueHistory.length - 1] : null;

  return (
    <div className="dialog-panel">
      <h3>Dialogue</h3>
      {dialogueHistory.length === 0 ? (
        <p>No dialogue yet.</p>
      ) : (
        <div>
          {dialogueHistory.map((entry: any, idx: number) => (
            <div key={idx} className="dialog-entry">
              <p>
                <strong>[{getNpcName(entry.npcId, state)}]:</strong> {entry.text}
              </p>
            </div>
          ))}
          {latestEntry?.options && latestEntry.options.length > 0 && (
            <div className="dialog-options">
              {latestEntry.options.map((opt: any) => (
                <button
                  key={opt.id}
                  onClick={() => onChoose?.(latestEntry.npcId, opt.id)}
                  className="dialog-option-button"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
