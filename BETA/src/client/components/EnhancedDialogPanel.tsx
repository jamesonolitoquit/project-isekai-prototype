/**
 * M47-E1: Enhanced Dialog Panel with Sensory Cues
 * 
 * Purpose: Integrate M47 sensory layer into dialogue visualization
 * 
 * Features:
 * - Goal icons showing NPC's dominant GOAP trait
 * - Stress feedback (visual glow when NPC under pressure)
 * - Truth ripple effect (text distortion for rumors vs facts)
 * - Perception-based visibility (goals hidden by default)
 * - Emotional state color coding
 * - M52-A1: Clue interrogation (Present Evidence to NPCs)
 * 
 * Integration:
 * - Queries NPC personality for goal determination
 * - Queries belief engine for fact/rumor classification
 * - Applies animations from M47-C1 (NpcInteraction) patterns
 * - M52-A1: Integrates clueExchangeEngine for evidence presentation
 */

import React, { useMemo, useState } from 'react';
import type { ClueItem } from '../../engine/clueExchangeEngine';

interface NpcPersonality {
  greediness: number;
  piety: number;
  ambition: number;
  loyalty: number;
  risk: number;
  sociability: number;
}

interface ParsedDialogueEntry {
  npcId: string;
  npcName: string;
  text: string;
  emotionalState?: {
    trust?: number;
    fear?: number;
    gratitude?: number;
    resentment?: number;
  };
  timestamp?: number;
  isRumor?: boolean;
  isFact?: boolean;
  npcStressed?: boolean;
  npcPersonality?: NpcPersonality;
}

interface EnhancedDialogPanelProps {
  dialogue: ParsedDialogueEntry[];
  playerPerceptionLevel?: number;
  onDialogueSelect?: (entryIndex: number) => void;
  showOracleView?: boolean;
  enableGoalVisibility?: boolean;
  // M52-A1: Clue interrogation
  playerClues?: ClueItem[];
  activeNpcId?: string;
  onPresentClue?: (npcId: string, clueId: string, targetBeliefId?: string) => void;
}

/**
 * Get dominant trait from personality vector
 */
function getDominantTrait(personality: NpcPersonality): string {
  const traits = [
    { name: 'greediness', value: personality.greediness },
    { name: 'piety', value: personality.piety },
    { name: 'ambition', value: personality.ambition },
    { name: 'loyalty', value: personality.loyalty },
    { name: 'risk', value: personality.risk },
    { name: 'sociability', value: personality.sociability }
  ];
  return traits.reduce((max, trait) => trait.value > max.value ? trait : max).name;
}

/**
 * Get goal icon from trait name
 */
function getGoalIcon(trait: string): string {
  const icons: Record<string, string> = {
    'greediness': '💰',
    'piety': '🕯️',
    'ambition': '⚔️',
    'loyalty': '💎',
    'risk': '🎲',
    'sociability': '💞'
  };
  return icons[trait] ?? '💭';
}

/**
 * Get trait color for UI
 */
function getTraitColor(trait: string): string {
  const colors: Record<string, string> = {
    'greediness': '#FFD700',
    'piety': '#9B59B6',
    'ambition': '#E74C3C',
    'loyalty': '#3498DB',
    'risk': '#F39C12',
    'sociability': '#2ECC71'
  };
  return colors[trait] ?? '#E6E6E6';
}

/**
 * Get emotional color
 */
function getEmotionalColor(emotionalState?: Record<string, number>): string {
  if (!emotionalState) return '#808080';

  const trust = emotionalState.trust || 0;
  const fear = emotionalState.fear || 0;
  const gratitude = emotionalState.gratitude || 0;
  const resentment = emotionalState.resentment || 0;

  if (gratitude > 70) return '#4ade80';      // Green - positive
  if (trust > 70) return '#60a5fa';          // Blue - trusting
  if (resentment > 70) return '#ef4444';     // Red - negative
  if (fear > 70) return '#f97316';           // Orange - afraid
  if (trust > 30) return '#a3e635';          // Light green
  if (fear > 30) return '#fbbf24';           // Light amber
  return '#808080';                           // Gray - neutral
}

/**
 * M52-A1: Get clue reliability color
 */
function getClueReliabilityColor(reliability: unknown): string {
  if (typeof reliability === 'number') {
    if (reliability >= 0.7) return '#4ade80';  // Green - high reliability
    if (reliability >= 0.4) return '#fbbf24';  // Amber - medium reliability
    return '#ef4444';                           // Red - low reliability
  }
  return '#888';                                // Gray - unknown
}

/**
 * M52-A1: Get clue reliability percent
 */
function getClueReliabilityPercent(reliability: unknown): string {
  if (typeof reliability === 'number') {
    return String(Math.round(reliability * 100));
  }
  if (typeof reliability === 'string') {
    return reliability;
  }
  return String(reliability);
}

/**
 * Truth ripple text component - applies distortion effect
 */
interface TruthRippleProps {
  text: string;
  isRumor?: boolean;
  intensity?: number;
}

function TruthRipple({ text, isRumor = false, intensity = 1 }: TruthRippleProps): React.ReactElement {
  if (!isRumor) {
    return <span>{text}</span>;
  }

  return (
    <span style={{
      animation: `textDistortion ${0.4 + intensity * 0.2}s ease-in-out infinite`,
      transformOrigin: 'center',
      display: 'inline-block',
      color: '#ff6b6b',
      textShadow: '0 0 4px rgba(255, 107, 107, 0.5)',
      fontStyle: 'italic'
    }}>
      {text}
    </span>
  );
}

/**
 * Goal flash badge
 */
interface GoalBadgeProps {
  trait: string;
  visible: boolean;
  pulse?: boolean;
}

function GoalBadge({ trait, visible, pulse = true }: GoalBadgeProps): React.ReactElement | null {
  if (!visible) return null;

  const icon = getGoalIcon(trait);
  const color = getTraitColor(trait);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '8px',
        padding: '2px 6px',
        borderRadius: '3px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        border: `1px solid ${color}`,
        color: color,
        fontSize: '11px',
        fontWeight: 'bold',
        animation: pulse ? 'goalFlash 0.8s ease-in-out infinite' : 'none',
        textShadow: `0 0 4px ${color}80`
      }}
      title={`Goal: ${trait}`}
    >
      {icon}
    </span>
  );
}

/**
 * Stress indicator badge
 */
interface StressBadgeProps {
  stressed: boolean;
  stressLevel?: number;
}

function StressBadge({ stressed, stressLevel = 0.7 }: StressBadgeProps): React.ReactElement | null {
  if (!stressed) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        padding: '2px 6px',
        borderRadius: '3px',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        border: '1px solid #ef4444',
        color: '#ef4444',
        fontSize: '11px',
        fontWeight: 'bold',
        animation: 'stressPulse 0.5s ease-in-out infinite',
        textShadow: '0 0 4px rgba(239, 68, 68, 0.8)'
      }}
      title={`Stress Level: ${Math.round(stressLevel * 100)}%`}
    >
      ⚡ STRESSED
    </span>
  );
}

/**
 * Dialogue entry card with sensory cues
 */
interface DialogueCardProps {
  entry: ParsedDialogueEntry;
  index: number;
  playerPerception: number;
  enableGoalVisibility: boolean;
  onSelect?: (index: number) => void;
  isSelected?: boolean;
}

function DialogueCard({
  entry,
  index,
  playerPerception,
  enableGoalVisibility,
  onSelect,
  isSelected = false
}: DialogueCardProps): React.ReactElement {
  const emotionalColor = getEmotionalColor(entry.emotionalState as any);
  const shouldShowGoal = enableGoalVisibility && playerPerception >= 60 && entry.npcPersonality;
  const dominantTrait = shouldShowGoal ? getDominantTrait(entry.npcPersonality!) : null;
  
  // Parse dialogue text for rumor keywords
  const rumorKeywords = ['rumor', 'heard', 'supposedly', 'allegedly', 'they say', 'apparently'];
  const textContainsRumor = rumorKeywords.some(keyword => 
    entry.text.toLowerCase().includes(keyword)
  );

  return (
    <div
      onClick={() => onSelect?.(index)}
      style={{
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '6px',
        backgroundColor: isSelected ? 'rgba(168, 213, 168, 0.15)' : 'rgba(0, 0, 0, 0.3)',
        border: `2px solid ${isSelected ? emotionalColor : 'rgba(100, 100, 100, 0.5)'}`,
        borderLeftWidth: '4px',
        borderLeftColor: emotionalColor,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        animation: entry.npcStressed ? 'stressPulse 0.5s ease-in-out infinite' : 'none',
        boxShadow: entry.npcStressed 
          ? '0 0 12px rgba(239, 68, 68, 0.3), inset 0 0 8px rgba(239, 68, 68, 0.1)'
          : 'none'
      }}
      onMouseEnter={(e) => {
        if (onSelect) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.2)';
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${emotionalColor}40`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? 'rgba(168, 213, 168, 0.15)' : 'rgba(0, 0, 0, 0.3)';
        (e.currentTarget as HTMLElement).style.boxShadow = entry.npcStressed 
          ? '0 0 12px rgba(239, 68, 68, 0.3), inset 0 0 8px rgba(239, 68, 68, 0.1)'
          : 'none';
      }}
    >
      {/* NPC name with goal icon and stress indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        fontWeight: 'bold',
        color: emotionalColor,
        textShadow: `0 0 4px ${emotionalColor}60`
      }}>
        <span>{entry.npcName}</span>
        {dominantTrait && (
          <GoalBadge 
            trait={dominantTrait} 
            visible={true}
            pulse={true}
          />
        )}
        <StressBadge 
          stressed={entry.npcStressed || false}
          stressLevel={entry.npcPersonality?.risk || 0.5}
        />
      </div>

      {/* Dialogue text with truth ripple */}
      <div style={{
        fontSize: '13px',
        lineHeight: '1.4',
        color: '#e6e6e6',
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap'
      }}>
        {entry.isRumor ? (
          <TruthRipple text={entry.text} isRumor={true} intensity={playerPerception / 100} />
        ) : (
          entry.text
        )}
      </div>

      {/* Fact/Rumor indicator */}
      {(entry.isRumor || entry.isFact) && (
        <div style={{
          marginTop: '6px',
          fontSize: '10px',
          color: entry.isFact ? '#4ade80' : '#ff6b6b',
          fontStyle: 'italic'
        }}>
          {entry.isFact && '✓ Verified Fact'}
          {entry.isRumor && '⚠ Rumor (unverified)'}
        </div>
      )}

      {/* Emotional state detail */}
      {entry.emotionalState && (
        <div style={{
          marginTop: '6px',
          fontSize: '9px',
          color: '#999',
          display: 'flex',
          gap: '12px'
        }}>
          {entry.emotionalState.trust !== undefined && (
            <span>Trust: {Math.round(entry.emotionalState.trust)}%</span>
          )}
          {entry.emotionalState.fear !== undefined && (
            <span>Fear: {Math.round(entry.emotionalState.fear)}%</span>
          )}
          {entry.emotionalState.gratitude !== undefined && (
            <span>Gratitude: {Math.round(entry.emotionalState.gratitude)}%</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EnhancedDialogPanel Component
 */
export const EnhancedDialogPanel: React.FC<EnhancedDialogPanelProps> = ({
  dialogue,
  playerPerceptionLevel = 50,
  onDialogueSelect,
  showOracleView = true,
  enableGoalVisibility = true,
  playerClues = [],
  activeNpcId,
  onPresentClue
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'scene'>('text');
  // M52-A1: Clue interrogation state
  const [showClueModal, setShowClueModal] = useState(false);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);

  const handleDialogueSelect = (index: number) => {
    setSelectedIndex(index);
    onDialogueSelect?.(index);
  };

  // M52-A1: Handle clue presentation
  const handlePresentClue = (clueId: string) => {
    if (activeNpcId && onPresentClue) {
      onPresentClue(activeNpcId, clueId);
      setShowClueModal(false);
      setSelectedClueId(null);
    }
  };

  // Add CSS animations to document
  useMemo(() => {
    if (typeof document !== 'undefined' && !document.getElementById('dialogPanelStyles')) {
      const style = document.createElement('style');
      style.id = 'dialogPanelStyles';
      style.textContent = `
        @keyframes goalFlash {
          0%, 100% { opacity: 0.8; transform: scale(1) translateY(0px); }
          50% { opacity: 1; transform: scale(1.1) translateY(-2px); }
        }
        
        @keyframes stressPulse {
          0%, 100% { border-color: #ef4444; background-color: rgba(239, 68, 68, 0.1); }
          50% { border-color: #ff6b6b; background-color: rgba(255, 107, 107, 0.2); box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
        }
        
        @keyframes textDistortion {
          0%, 100% { transform: skewX(0deg); letter-spacing: 0px; }
          25% { transform: skewX(-1deg); letter-spacing: 1px; }
          50% { transform: skewX(1deg); letter-spacing: -1px; }
          75% { transform: skewX(-1deg); letter-spacing: 1px; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#1a1a1a',
      color: '#e6e6e6',
      borderRadius: '8px',
      border: '1px solid #444',
      fontFamily: 'monospace',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid #333'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '16px',
          color: '#a8d5a8',
          textShadow: '0 0 4px rgba(168, 213, 168, 0.5)'
        }}>
          Dialogue History ({dialogue.length})
        </h2>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          {/* M52-A1: Present Evidence button */}
          {activeNpcId && playerClues.length > 0 && (
            <button
              onClick={() => setShowClueModal(!showClueModal)}
              style={{
                padding: '6px 12px',
                backgroundColor: showClueModal ? 'rgba(168, 213, 168, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                border: showClueModal ? '1px solid #a8d5a8' : '1px solid #555',
                borderRadius: '4px',
                color: showClueModal ? '#a8d5a8' : '#ccc',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168, 213, 168, 0.3)';
                (e.currentTarget as HTMLElement).style.border = '1px solid #a8d5a8';
              }}
              onMouseLeave={(e) => {
                if (!showClueModal) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
                  (e.currentTarget as HTMLElement).style.border = '1px solid #555';
                }
              }}
              title="Present clues and evidence to the NPC"
            >
              🔍 Present Evidence
            </button>
          )}

          {/* View mode toggle */}
          {showOracleView && (
            <button
              onClick={() => setViewMode(viewMode === 'text' ? 'scene' : 'text')}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(100, 100, 100, 0.3)',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#a8d5a8',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
              }}
            >
              {viewMode === 'text' ? '🎭 Scene' : '📜 Text'}
            </button>
          )}
        </div>
      </div>

      {/* Perception indicator */}
      <div style={{
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '4px',
        fontSize: '10px',
        color: '#888',
        borderLeft: `3px solid ${playerPerceptionLevel >= 60 ? '#a8d5a8' : '#ff6b6b'}`
      }}>
        Player Perception: {Math.round(playerPerceptionLevel)}% 
        {playerPerceptionLevel >= 60 && ' (Goals visible)'}
        {playerPerceptionLevel < 60 && ' (Goals hidden)'}
      </div>

      {/* Dialogue list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingRight: '8px',
        marginBottom: '8px'
      }}>
        {dialogue.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '24px',
            fontStyle: 'italic'
          }}>
            No dialogue recorded yet...
          </div>
        ) : (
          dialogue.map((entry, index) => (
            <DialogueCard
              key={index}
              entry={entry}
              index={index}
              playerPerception={playerPerceptionLevel}
              enableGoalVisibility={enableGoalVisibility}
              onSelect={handleDialogueSelect}
              isSelected={selectedIndex === index}
            />
          ))
        )}
      </div>

      {/* Footer info */}
      <div style={{
        paddingTop: '8px',
        borderTop: '1px solid #333',
        fontSize: '9px',
        color: '#666'
      }}>
        <div>💰 Greed | 🕯️ Piety | ⚔️ Ambition | 💎 Loyalty | 🎲 Risk | 💞 Sociability</div>
        <div>⚡ STRESSED = NPC under pressure | ⚠ Rumor = Text distorted</div>
      </div>

      {/* M52-A1: Clue Selection Modal */}
      {showClueModal && activeNpcId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => {
          setShowClueModal(false);
          setSelectedClueId(null);
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #a8d5a8',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            maxHeight: '70vh',
            overflowY: 'auto',
            boxShadow: '0 0 20px rgba(168, 213, 168, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              margin: '0 0 16px 0',
              color: '#a8d5a8',
              textShadow: '0 0 4px rgba(168, 213, 168, 0.5)',
              fontSize: '16px'
            }}>
              🔍 Select Evidence to Present
            </h3>

            {playerClues.length === 0 ? (
              <div style={{
                color: '#888',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '20px'
              }}>
                No clues available
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px'
              }}>
                {playerClues.map((clue) => (
                  <div
                    key={clue.id}
                    onClick={() => {
                      handlePresentClue(clue.id);
                    }}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedClueId === clue.id ? 'rgba(168, 213, 168, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                      border: selectedClueId === clue.id ? '1px solid #a8d5a8' : '1px solid #555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      color: '#e6e6e6'
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168, 213, 168, 0.2)';
                      (e.currentTarget as HTMLElement).style.border = '1px solid #a8d5a8';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedClueId !== clue.id) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.2)';
                        (e.currentTarget as HTMLElement).style.border = '1px solid #555';
                      }
                    }}
                  >
                    <div style={{
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      fontSize: '13px'
                    }}>
                      {clue.name}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#aaa',
                      marginBottom: '6px'
                    }}>
                      {clue.description}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#888',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Topics: {clue.relevantTopics.join(', ')}</span>
                      <span style={{
                        color: getClueReliabilityColor(clue.reliability)
                      }}>
                        Reliability: {getClueReliabilityPercent(clue.reliability)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowClueModal(false);
                  setSelectedClueId(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(100, 100, 100, 0.3)',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDialogPanel;
