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
 * 
 * Integration:
 * - Queries NPC personality for goal determination
 * - Queries belief engine for fact/rumor classification
 * - Applies animations from M47-C1 (NpcInteraction) patterns
 */

import React, { useMemo, useState } from 'react';

/**
 * M47: Dialogue entry type
 */
export interface DialogueEntry {
  id?: string;
  npcId: string;
  npcName: string;
  text: string;
  emotionalState?: {
    trust?: number;
    fear?: number;
    gratitude?: number;
    resentment?: number;
  };
  socialTension?: number; // Phase 25 Task 3: GST value for visual breaks
}

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
  socialTension?: number; // Phase 25 Task 3: GST value for visual breaks
}

interface EnhancedDialogPanelProps {
  dialogue: ParsedDialogueEntry[];
  playerPerceptionLevel?: number;
  onDialogueSelect?: (entryIndex: number) => void;
  showOracleView?: boolean;
  enableGoalVisibility?: boolean;
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
 * Truth ripple text component - applies distortion effect
 * Phase 25 Task 3: Also applies for high social tension (socialTension > 0.8)
 */
interface TruthRippleProps {
  text: string;
  isRumor?: boolean;
  intensity?: number;
  socialTension?: number; // GST level [0-1]
}

function TruthRipple({ text, isRumor = false, intensity = 1, socialTension = 0 }: TruthRippleProps): React.ReactElement {
  if (!isRumor && socialTension <= 0.8) {
    return <span>{text}</span>;
  }

  // Use social tension intensity if applicable
  const effectIntensity = socialTension > 0.8 ? socialTension : intensity;
  const isTensionNarrative = socialTension > 0.8;

  return (
    <span style={{
      animation: `textDistortion ${0.4 + effectIntensity * 0.2}s ease-in-out infinite`,
      transformOrigin: 'center',
      display: 'inline-block',
      color: isTensionNarrative ? '#ffaa44' : '#ff6b6b', // Orange for tension, red for rumor
      textShadow: isTensionNarrative 
        ? '0 0 6px rgba(255, 170, 68, 0.7)' 
        : '0 0 4px rgba(255, 107, 107, 0.5)',
      fontStyle: 'italic',
      opacity: isTensionNarrative ? 0.9 : 1
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
        {entry.isRumor || entry.socialTension > 0.8 ? (
          <TruthRipple 
            text={entry.text} 
            isRumor={entry.isRumor || false}
            intensity={playerPerception / 100} 
            socialTension={entry.socialTension}
          />
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
  enableGoalVisibility = true
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'scene'>('text');

  const handleDialogueSelect = (index: number) => {
    setSelectedIndex(index);
    onDialogueSelect?.(index);
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
    </div>
  );
};

export default EnhancedDialogPanel;
