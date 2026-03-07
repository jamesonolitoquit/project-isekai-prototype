import React, { useMemo, useState } from 'react';
import type { NPC } from '../../engine/worldEngine';
import OracleView from './OracleView';

interface DialogPanelProps {
  state?: any;
  onChoose?: (npcId: string, choiceId: string) => void;
  onPerformAction?: (action: any) => void;
  isDeveloperMode?: boolean;
}

interface ParsedDialogueEntry {
  npcId: string;
  npcName: string;
  stageDirection?: string;
  text: string;
  emotionalState?: {
    trust: number;
    fear: number;
    gratitude: number;
    resentment: number;
  };
  timestamp?: number;
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

/**
 * Parse stage directions from dialogue text
 * Format: *[stage direction]* some dialogue
 */
function parseStageDirection(text: string): { stageDirection?: string; dialogue: string } {
  const match = text.match(/^\*\[([^\]]+)\]\*\s+(.*)$/);
  if (match) {
    return {
      stageDirection: match[1],
      dialogue: match[2]
    };
  }
  return { dialogue: text };
}

/**
 * Get emotional state color indicator
 */
function getEmotionalColor(emotionalState?: any): string {
  if (!emotionalState) return '#888';

  const avgEmotion = (
    emotionalState.trust +
    (100 - emotionalState.fear) +
    emotionalState.gratitude -
    emotionalState.resentment
  ) / 4;

  if (avgEmotion > 70) return '#4ade80';
  if (avgEmotion > 50) return '#60a5fa';
  if (avgEmotion > 30) return '#fbbf24';
  return '#ef4444';
}

/**
 * Get emotional state tooltip
 */
function getEmotionalTooltip(emotionalState?: any): string {
  if (!emotionalState) return '';

  return `Trust: ${emotionalState.trust}/100\nFear: ${emotionalState.fear}/100\nGratitude: ${emotionalState.gratitude}/100\nResentment: ${emotionalState.resentment}/100`;
}

/**
 * Enhanced DialogueEntry component with stage directions and emotional context
 */
function DialogueEntry({ entry }: { entry: ParsedDialogueEntry }): React.ReactElement {
  const emotionalColor = getEmotionalColor(entry.emotionalState);
  const emotionalTooltip = getEmotionalTooltip(entry.emotionalState);

  return (
    <div className="dialog-entry" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #333' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <strong style={{ color: emotionalColor }} title={emotionalTooltip}>
          [{entry.npcName}]
        </strong>
        {entry.emotionalState && (
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: emotionalColor,
              cursor: 'help'
            }}
            title={emotionalTooltip}
          />
        )}
      </div>

      {entry.stageDirection && (
        <div
          style={{
            fontStyle: 'italic',
            color: '#aaa',
            marginBottom: '6px',
            fontSize: '0.9em'
          }}
        >
          *[{entry.stageDirection}]*
        </div>
      )}

      <p style={{ margin: '0', lineHeight: '1.4' }}>{entry.text}</p>
    </div>
  );
}

export default function DialogPanel({ state, onChoose, onPerformAction, isDeveloperMode = false }: DialogPanelProps) {
  const [showOracleView, setShowOracleView] = useState(true);
  const dialogueHistory = state?.player?.dialogueHistory ?? [];

  const parsedEntries = useMemo(() => {
    return dialogueHistory.map((entry: any) => {
      const npc = state?.npcs?.find((n: NPC) => n.id === entry.npcId) as NPC | undefined;
      const { stageDirection, dialogue } = parseStageDirection(entry.text);

      return {
        npcId: entry.npcId,
        npcName: getNpcName(entry.npcId, state),
        stageDirection,
        text: dialogue,
        emotionalState: npc?.emotionalState,
        timestamp: entry.timestamp
      } as ParsedDialogueEntry;
    });
  }, [dialogueHistory, state?.npcs, state?.player?.knowledgeBase]);

  const latestEntry = dialogueHistory.length > 0 ? dialogueHistory[dialogueHistory.length - 1] : null;

  return (
    <div className="dialog-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Dialogue</h3>
        <button
          onClick={() => setShowOracleView(!showOracleView)}
          style={{
            padding: '4px 12px',
            backgroundColor: showOracleView ? '#0f3' : '#333',
            color: showOracleView ? '#000' : '#888',
            border: '1px solid #0f3',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: showOracleView ? 'bold' : 'normal',
            transition: 'all 200ms'
          }}
        >
          {showOracleView ? '🎭 Scene' : 'Text'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        {/* Dialogue Section */}
        <div style={{ flex: showOracleView ? '1' : '1', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {dialogueHistory.length === 0 ? (
            <p style={{ color: '#888' }}>No dialogue yet.</p>
          ) : (
            <>
              {/* Scrollable Dialogue History */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: '12px',
                  paddingRight: '8px'
                }}
              >
                {parsedEntries.map((entry: ParsedDialogueEntry, idx: number) => (
                  <DialogueEntry key={idx} entry={entry} />
                ))}
              </div>

              {/* Dialogue Options */}
              {latestEntry?.options && latestEntry.options.length > 0 && (
                <div className="dialog-options" style={{ borderTop: '1px solid #444', paddingTop: '12px' }}>
                  <p style={{ fontSize: '0.85em', color: '#999', marginBottom: '8px' }}>Your response:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {latestEntry.options.map((opt: any) => (
                      <button
                        key={opt.id}
                        onClick={() => onChoose?.(latestEntry.npcId, opt.id)}
                        className="dialog-option-button"
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#2d3748',
                          color: '#e0e0e0',
                          border: '1px solid #4a5568',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLButtonElement).style.backgroundColor = '#3d4758';
                          (e.target as HTMLButtonElement).style.borderColor = '#60a5fa';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLButtonElement).style.backgroundColor = '#2d3748';
                          (e.target as HTMLButtonElement).style.borderColor = '#4a5568';
                        }}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Oracle View Section - M23 Scene Visualization */}
        {showOracleView && state && (
          <div style={{ flex: '1', display: 'flex', minWidth: 0, borderLeft: '1px solid #333' }}>
            <OracleView state={state} isDeveloperMode={isDeveloperMode} onPerformAction={onPerformAction} />
          </div>
        )}
      </div>
    </div>
  );
}
