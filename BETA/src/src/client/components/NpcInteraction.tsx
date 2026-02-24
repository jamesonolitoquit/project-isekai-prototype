/**
 * M47-C1: Personality Insight UI with Micro-Expression Cues
 *
 * Purpose: Display NPC personality vectors during interactions (M46 GOAP system)
 *
 * Design:
 * - Show 6-bar meter visualization for GOAP personality dimensions
 * - Greediness (Gold): preference for wealth goals
 * - Piety (Purple): preference for faith goals
 * - Ambition (Red): preference for power goals
 * - Loyalty (Blue): tendency to stick to plans
 * - Risk (Orange): willingness to take risky actions
 * - Sociability (Green): preference for relationship goals
 *
 * M47-C1 Enhancements:
 * - Goal Flashes: Display current GOAP goal icon based on personality weights
 * - Stress Indicators: Pulsing border when NPC is stressed (high risk personality + danger)
 * - Truth Distortion: Ripple effect on text when NPC relays low-confidence rumors
 * - Micro-Expressions: Subtle eye/mouth icons that shift with sentiment
 *
 * Lifecycle:
 * 1. Player interacts with NPC
 * 2. Load NPC's GOAP personality vector
 * 3. Display meters updating in real-time as personality shifts
 * 4. Show current GOAP goal icon based on mood/context
 * 5. Apply stress indicator if NPC in danger/conflict
 * 6. Show dialogue options weighted by personality
 * 7. Track personality changes from decisions
 * 8. Close on interaction end
 */

import React, { useState, useEffect, useMemo } from 'react';

/**
 * NPC Personality Vector (M46 GOAP system - 6 dimensions)
 */
interface PersonalityVector {
  greediness: number;   // [0-1] preference for wealth goals
  piety: number;        // [0-1] preference for faith goals
  ambition: number;     // [0-1] preference for power goals
  loyalty: number;      // [0-1] how much they stick to plans vs jumping to new goals
  risk: number;         // [0-1] willingness to take risky actions
  sociability: number;  // [0-1] preference for relationship goals
}

/**
 * Personality-influenced dialogue option
 */
interface DialogueOption {
  id: string;
  text: string;
  personalityReqs?: Partial<PersonalityVector>; // Minimum personality values to show
  personalityShifts?: Partial<PersonalityVector>; // Changes from selecting this
  consequence?: string; // What happens if chosen
  difficulty?: 'easy' | 'medium' | 'hard'; // Based on personality match
}

/**
 * NPC for interaction
 */
interface NpcInteractionData {
  npcId: string;
  npcName: string;
  personality: PersonalityVector;
  currentMood: string;
  dialogueOptions: DialogueOption[];
  onDialogueSelect?: (optionId: string) => void;
  onClose?: () => void;
}

/**
 * Props for NpcInteraction component
 */
interface NpcInteractionProps {
  npc: NpcInteractionData;
  isOpen?: boolean;
}

/**
 * Get dominant personality trait
 */
function getDominantTrait(personality: PersonalityVector): {
  trait: 'greediness' | 'piety' | 'ambition' | 'loyalty' | 'risk' | 'sociability';
  value: number;
} {
  const values = {
    greediness: personality.greediness,
    piety: personality.piety,
    ambition: personality.ambition,
    loyalty: personality.loyalty,
    risk: personality.risk,
    sociability: personality.sociability,
  };
  const dominant = Object.entries(values).reduce((acc, [trait, value]) =>
    value > acc.value ? { trait: trait as keyof typeof values, value } : acc,
    { trait: 'ambition' as const, value: 0 }
  );
  return dominant as { trait: 'greediness' | 'piety' | 'ambition' | 'loyalty' | 'risk' | 'sociability'; value: number };
}

/**
 * Get goal icon based on highest personality trait
 */
function getGoalIcon(personality: PersonalityVector): string {
  const dominant = getDominantTrait(personality);
  const icons = {
    greediness: '💰',
    piety: '🕯️',
    ambition: '⚔️',
    loyalty: '💎',
    risk: '🎲',
    sociability: '💞',
  };
  return icons[dominant.trait];
}

/**
 * Get trait color
 */
function getTraitColor(trait: 'greediness' | 'piety' | 'ambition' | 'loyalty' | 'risk' | 'sociability'): string {
  const colors = {
    greediness: '#FFD700',   // Gold
    piety: '#9B59B6',         // Purple
    ambition: '#E74C3C',      // Red
    loyalty: '#3498DB',       // Blue
    risk: '#F39C12',          // Orange
    sociability: '#2ECC71',   // Green
  };
  return colors[trait];
}

/**
 * Get trait label
 */
function getTraitLabel(trait: 'greediness' | 'piety' | 'ambition' | 'loyalty' | 'risk' | 'sociability'): string {
  const labels = {
    greediness: 'Greediness',
    piety: 'Piety',
    ambition: 'Ambition',
    loyalty: 'Loyalty',
    risk: 'Risk',
    sociability: 'Sociability',
  };
  return labels[trait];
}

/**
 * Personality Meter Bar
 */
const PersonalityMeter: React.FC<{
  trait: 'greediness' | 'piety' | 'ambition' | 'loyalty' | 'risk' | 'sociability';
  value: number;
  label: string;
  icon: string;
}> = ({ trait, value, label, icon }) => {
  const color = getTraitColor(trait);
  const percentage = Math.round(value * 100);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          marginBottom: '4px',
          color: 'rgba(255, 255, 255, 0.9)',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>{icon} {label}</span>
        <span style={{ color }}>{percentage}%</span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'rgba(50, 50, 80, 0.8)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: `1px solid ${color}`,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: color,
            transition: 'width 0.3s ease',
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
};

/**
 * Dialogue Option Button
 */
const DialogueOptionButton: React.FC<{
  option: DialogueOption;
  personality: PersonalityVector;
  onSelect: (optionId: string) => void;
}> = ({ option, personality, onSelect }) => {
  // Determine if option matches personality
  const matchScore = useMemo(() => {
    if (!option.personalityReqs) return 1.0;

    const reqs = option.personalityReqs;
    const traits = (Object.keys(reqs) as (keyof PersonalityVector)[]);
    const matches = traits.filter(trait =>
      personality[trait] >= (reqs[trait] ?? 0)
    ).length;

    return matches / Math.max(traits.length, 1);
  }, [option, personality]);

  // Determine text distortion based on rumor confidence
  const hasRipple = option.consequence?.includes('rumor') || 
                   option.consequence?.includes('whisper') ||
                   option.consequence?.includes('uncertain');

  // Calculate difficulty indicator
  let difficultyColor = '#4AE24A'; // Easy - green
  let difficultyLabel = 'Easy';

  if (option.difficulty === 'medium') {
    difficultyColor = '#E2C24A'; // Medium - yellow
    difficultyLabel = 'Moderate';
  } else if (option.difficulty === 'hard') {
    difficultyColor = '#E24A4A'; // Hard - red
    difficultyLabel = 'Risky';
  }

  const disabled = matchScore < 0.5;

  return (
    <button
      onClick={() => onSelect(option.id)}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px',
        marginBottom: '8px',
        backgroundColor: disabled
          ? 'rgba(100, 100, 100, 0.3)'
          : 'rgba(70, 100, 150, 0.6)',
        border: `1px solid ${disabled ? 'rgba(150, 150, 150, 0.3)' : 'rgba(100, 150, 200, 0.8)'}`,
        color: disabled ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.95)',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'monospace',
        fontSize: '12px',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        animation: hasRipple ? 'textDistortion 0.4s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(100, 130, 180, 0.8)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(100, 150, 200, 0.5)';
        }
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(70, 100, 150, 0.6)';
        (e.target as HTMLButtonElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{option.text}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '10px' }}>
          {matchScore >= 0.8 && <span style={{ color: '#4AE24A' }}>✓ Fits</span>}
          {matchScore < 0.8 && matchScore >= 0.5 && <span style={{ color: '#E2C24A' }}>◐ Partial</span>}
          {matchScore < 0.5 && <span style={{ color: '#E24A4A' }}>✗ Difficult</span>}
          {option.difficulty && (
            <span style={{ color: difficultyColor }}>({difficultyLabel})</span>
          )}
        </div>
      </div>
      {option.consequence && (
        <div style={{ fontSize: '10px', marginTop: '4px', color: 'rgba(200, 200, 255, 0.7)' }}>
          → {option.consequence}
        </div>
      )}
    </button>
  );
};

/**
 * NpcInteraction Component - Show personality-driven NPC interaction UI with micro-expressions
 */
export const NpcInteraction: React.FC<NpcInteractionProps> = ({
  npc,
  isOpen = true,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [interactionLog, setInteractionLog] = useState<string[]>([]);
  const [isStressed, setIsStressed] = useState(false);

  const dominantTrait = useMemo(() => {
    return getDominantTrait(npc.personality);
  }, [npc.personality]);

  const goalIcon = useMemo(() => {
    return getGoalIcon(npc.personality);
  }, [npc.personality]);

  const borderColor = getTraitColor(dominantTrait.trait);

  // Simulate stress based on risk personality
  useEffect(() => {
    setIsStressed(npc.personality.risk > 0.7);
  }, [npc.personality.risk]);

  const handleDialogueSelect = (optionId: string) => {
    const option = npc.dialogueOptions.find(o => o.id === optionId);
    if (option) {
      setSelectedOption(optionId);
      setInteractionLog(prev => [...prev, `You: ${option.text}`]);
      npc.onDialogueSelect?.(optionId);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes textDistortion {
          0%, 100% { transform: skewX(0deg); letter-spacing: 0px; }
          25% { transform: skewX(1deg); letter-spacing: 0.5px; }
          50% { transform: skewX(-1deg); letter-spacing: -0.5px; }
          75% { transform: skewX(0.5deg); letter-spacing: 0.5px; }
        }

        @keyframes stressPulse {
          0%, 100% { border-color: ${borderColor}; box-shadow: 0 0 15px ${borderColor}40, inset 0 0 15px ${borderColor}20; }
          50% { border-color: #FF4444; box-shadow: 0 0 25px rgba(255, 68, 68, 0.6), inset 0 0 15px rgba(255, 68, 68, 0.3); }
        }

        @keyframes microExpression {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }

        @keyframes goalFlash {
          0%, 100% { opacity: 0.5; transform: translateY(0px); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '500px',
          maxHeight: '700px',
          backgroundColor: 'rgba(20, 20, 40, 0.95)',
          border: `2px solid ${borderColor}`,
          boxShadow: isStressed 
            ? `0 0 25px rgba(255, 68, 68, 0.6), inset 0 0 15px rgba(255, 68, 68, 0.3)`
            : `0 0 20px ${borderColor}40, inset 0 0 20px ${borderColor}20`,
          borderRadius: '8px',
          padding: '20px',
          fontFamily: 'monospace',
          color: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 1000,
          animation: isStressed ? `stressPulse 0.5s ease-in-out` : 'none',
          overflow: 'hidden',
        }}
      >
        {/* NPC Header with Micro-Expressions and Goal Flash */}
        <div
          style={{
            borderBottom: `1px solid ${borderColor}`,
            paddingBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: borderColor }}>
              🎭 {npc.npcName}
            </h3>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontStyle: 'italic',
              }}
            >
              Mood: {npc.currentMood}
            </div>
          </div>

          {/* Goal Flash and Stress Indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {/* Goal Icon Flash */}
            <div
              title={`Current Goal Direction: ${getTraitLabel(dominantTrait.trait)}`}
              style={{
                fontSize: '28px',
                animation: 'goalFlash 0.8s ease-in-out infinite',
                cursor: 'help',
              }}
            >
              {goalIcon}
            </div>

            {/* Stress Indicator - Pulsing when high risk */}
            {isStressed && (
              <div
                style={{
                  fontSize: '10px',
                  color: '#FF4444',
                  fontWeight: 'bold',
                  animation: 'microExpression 0.6s ease-in-out infinite',
                  textShadow: '0 0 8px rgba(255, 68, 68, 0.8)',
                }}
              >
                ⚡ STRESSED
              </div>
            )}
          </div>
        </div>

        {/* Personality Meters (6 dimensions of GOAP) */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)' }}>
            📊 GOAP Personality Profile
          </div>
          <PersonalityMeter
            trait="greediness"
            value={npc.personality.greediness}
            label="Greediness"
            icon="💰"
          />
          <PersonalityMeter
            trait="piety"
            value={npc.personality.piety}
            label="Piety"
            icon="🕯️"
          />
          <PersonalityMeter
            trait="ambition"
            value={npc.personality.ambition}
            label="Ambition"
            icon="⚔️"
          />
          <PersonalityMeter
            trait="loyalty"
            value={npc.personality.loyalty}
            label="Loyalty"
            icon="💎"
          />
          <PersonalityMeter
            trait="risk"
            value={npc.personality.risk}
            label="Risk"
            icon="🎲"
          />
          <PersonalityMeter
            trait="sociability"
            value={npc.personality.sociability}
            label="Sociability"
            icon="💞"
          />
        </div>

        {/* Interaction Log */}
        {interactionLog.length > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(50, 50, 80, 0.5)',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '11px',
              maxHeight: '80px',
              overflowY: 'auto',
              borderLeft: `2px solid ${borderColor}`,
              color: 'rgba(200, 200, 255, 0.8)',
            }}
          >
            {interactionLog.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {/* Dialogue Options */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)' }}>
            💬 Dialogue Options
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {npc.dialogueOptions.map(option => (
              <DialogueOptionButton
                key={option.id}
                option={option}
                personality={npc.personality}
                onSelect={handleDialogueSelect}
              />
            ))}
          </div>
        </div>

        {/* Dominant Trait Indicator */}
        <div
          style={{
            backgroundColor: `${borderColor}20`,
            padding: '8px',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 'bold',
          }}
        >
          Dominant Trait: {getTraitLabel(dominantTrait.trait).toUpperCase()} ({(dominantTrait.value * 100).toFixed(0)}%)
        </div>

        {/* Close Button */}
        <button
          onClick={() => npc.onClose?.()}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(100, 50, 50, 0.6)',
            border: '1px solid rgba(200, 100, 100, 0.8)',
            color: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(150, 70, 70, 0.8)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(100, 50, 50, 0.6)';
          }}
        >
          × Close Interaction
        </button>
      </div>
    </>
  );
};

export default NpcInteraction;
