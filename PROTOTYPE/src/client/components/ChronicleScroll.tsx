import React, { useState } from 'react';

/**
 * M29 Task 5: Chronicle Scroll UI
 * Displays a horizontal timeline visualization of player legacy deeds
 * Each deed is an interactive node with hover tooltips and AI DM narration
 */

interface Deed {
  text: string;
  index: number;
  aiNarration: string;
}

interface ChronicleScrollProps {
  legacyImpacts: Array<{
    canonicalName: string;
    mythStatus: number;
    deeds: string[];
    epochsLived: number;
    inheritedPerks: string[];
  }>;
  currentCharacterName?: string;
}

// AI DM Narration snippets for different deed types
const NARRATION_TEMPLATES: Record<string, string[]> = {
  'combat': [
    'A clash of steel and willpower echoed across the realm.',
    'The warrior\'s blade sang a song of victory.',
    'In the heat of battle, legend was forged.',
    'Steel and sorcery collided in a spectacle of power.',
  ],
  'diplomacy': [
    'Words wove a tapestry of alliance and understanding.',
    'Through silver tongue, factions were bound together.',
    'Wisdom and patience turned enemies into allies.',
    'The hero\'s counsel shaped the course of history.',
  ],
  'discovery': [
    'A hidden path revealed secrets long buried.',
    'The veil of mystery was lifted by brave exploration.',
    'Ancient wonders were uncovered from the depths.',
    'The map of the world grew with each discovery.',
  ],
  'sacrifice': [
    'At great personal cost, the world was saved.',
    'A hero\'s devotion burned brighter than any flame.',
    'In sacrifice, true nobility was revealed.',
    'The price paid was written in the stars.',
  ],
  'transcendence': [
    'Mortal limits were shattered, power ascended.',
    'The boundaries between worlds grew thin.',
    'A new age was ushered in by this achievement.',
    'Reality itself bent to the will of legend.',
  ],
};

function getDeedNarration(deed: string, deedIndex: number): string {
  // Determine deed type from keywords
  let type = 'discovery';
  
  if (deed.toLowerCase().includes('defeated') || deed.toLowerCase().includes('slain') || deed.toLowerCase().includes('battle')) {
    type = 'combat';
  } else if (deed.toLowerCase().includes('negotiat') || deed.toLowerCase().includes('peace') || deed.toLowerCase().includes('alliance')) {
    type = 'diplomacy';
  } else if (deed.toLowerCase().includes('sacrifice') || deed.toLowerCase().includes('cost')) {
    type = 'sacrifice';
  } else if (deed.toLowerCase().includes('ascend') || deed.toLowerCase().includes('transcend') || deed.toLowerCase().includes('godlike')) {
    type = 'transcendence';
  }

  // Select narration based on type and index for variety
  const templates = NARRATION_TEMPLATES[type] || NARRATION_TEMPLATES['discovery'];
  return templates[deedIndex % templates.length];
}

function getMythStatusColor(mythStatus: number): string {
  if (mythStatus >= 90) return '#ffd700'; // Gold - Legendary
  if (mythStatus >= 70) return '#c0c0c0'; // Silver - Heroic
  if (mythStatus >= 50) return '#cd7f32'; // Bronze - Notable
  if (mythStatus >= 30) return '#90ee90'; // Light Green - Remembered
  return '#a9a9a9'; // Gray - Obscure
}

function getMythStatusLabel(mythStatus: number): string {
  if (mythStatus >= 90) return 'Transcendent';
  if (mythStatus >= 70) return 'Legendary';
  if (mythStatus >= 50) return 'Heroic';
  if (mythStatus >= 30) return 'Renowned';
  return 'Noted';
}

export default function ChronicleScroll({ legacyImpacts, currentCharacterName }: ChronicleScrollProps) {
  const [selectedDeedIndex, setSelectedDeedIndex] = useState<number | null>(null);
  const [hoveredGeneration, setHoveredGeneration] = useState<number | null>(null);
  const [hoveredDeed, setHoveredDeed] = useState<{ gen: number; deed: number } | null>(null);

  // Flatten deeds across all generations for the timeline
  const allDeeds: Array<{ deed: string; generation: number; ancestorName: string; mythStatus: number; aiNarration: string }> = [];
  
  legacyImpacts.forEach((legacy, generationIndex) => {
    legacy.deeds.forEach((deed, deedIndex) => {
      allDeeds.push({
        deed,
        generation: generationIndex,
        ancestorName: legacy.canonicalName,
        mythStatus: legacy.mythStatus,
        aiNarration: getDeedNarration(deed, deedIndex)
      });
    });
  });

  if (allDeeds.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#888',
        fontStyle: 'italic'
      }}>
        No deeds recorded yet. Begin your legend.
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      backgroundColor: '#0f0f0f',
      border: '2px solid #d4af37',
      borderRadius: '8px',
      boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
      fontFamily: "'Georgia', serif"
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '12px',
        borderBottom: '1px solid #d4af37'
      }}>
        <h2 style={{
          margin: 0,
          color: '#d4af37',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Chronicle Scroll
        </h2>
        <span style={{
          color: '#888',
          fontSize: '12px'
        }}>
          {allDeeds.length} deeds recorded
        </span>
      </div>

      {/* Horizontal Timeline */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        paddingBottom: '12px',
        alignItems: 'flex-end'
      }}>
        {allDeeds.map((deedData, globalIndex) => {
          const isSelected = selectedDeedIndex === globalIndex;
          const isHovered = hoveredDeed?.gen === deedData.generation && hoveredDeed?.deed === globalIndex;
          const color = getMythStatusColor(deedData.mythStatus);

          return (
            <div
              key={`deed-${globalIndex}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                minWidth: '60px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={() => setHoveredDeed({ gen: deedData.generation, deed: globalIndex })}
              onMouseLeave={() => setHoveredDeed(null)}
              onClick={() => setSelectedDeedIndex(isSelected ? null : globalIndex)}
            >
              {/* Deed Node */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? color : color + '33',
                  border: `2px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: color,
                  boxShadow: isHovered || isSelected ? `0 0 12px ${color}` : 'none',
                  transform: isHovered || isSelected ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.2s ease'
                }}
              >
                ✦
              </div>

              {/* Generation Label */}
              <span style={{
                fontSize: '10px',
                color: '#888',
                textAlign: 'center'
              }}>
                Gen {deedData.generation + 1}
              </span>

              {/* Hover Tooltip */}
              {(isHovered || isSelected) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '70px',
                    left: `-80px`,
                    width: '220px',
                    backgroundColor: '#1a1a1a',
                    border: `2px solid ${color}`,
                    borderRadius: '6px',
                    padding: '12px',
                    boxShadow: `0 4px 12px rgba(212, 175, 55, 0.3)`,
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Ancestor Name */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: color
                  }}>
                    {deedData.ancestorName}
                  </div>

                  {/* Deed Text */}
                  <div style={{
                    fontSize: '11px',
                    color: '#d0d0d0',
                    lineHeight: '1.4',
                    fontStyle: 'italic'
                  }}>
                    "{deedData.deed}"
                  </div>

                  {/* Myth Status Badge */}
                  <div style={{
                    fontSize: '10px',
                    color: color,
                    fontWeight: 'bold'
                  }}>
                    {getMythStatusLabel(deedData.mythStatus)} • {deedData.mythStatus}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Deed Details Panel */}
      {selectedDeedIndex !== null && allDeeds[selectedDeedIndex] && (
        <div style={{
          padding: '16px',
          backgroundColor: '#1a1a1a',
          border: `2px solid ${getMythStatusColor(allDeeds[selectedDeedIndex].mythStatus)}`,
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Ancestor Name */}
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: getMythStatusColor(allDeeds[selectedDeedIndex].mythStatus)
          }}>
            {allDeeds[selectedDeedIndex].ancestorName} — Generation {allDeeds[selectedDeedIndex].generation + 1}
          </div>

          {/* Deed Description */}
          <div style={{
            fontSize: '13px',
            color: '#d0d0d0',
            lineHeight: '1.5'
          }}>
            <span style={{ fontWeight: 'bold', color: '#d4af37' }}>Deed:</span> {allDeeds[selectedDeedIndex].deed}
          </div>

          {/* AI DM Narration */}
          <div style={{
            fontSize: '12px',
            color: '#a0a0a0',
            fontStyle: 'italic',
            lineHeight: '1.4',
            paddingLeft: '12px',
            borderLeft: `3px solid ${getMythStatusColor(allDeeds[selectedDeedIndex].mythStatus)}`,
            backgroundColor: '#0f0f0f',
            padding: '12px',
            borderRadius: '4px'
          }}>
            {allDeeds[selectedDeedIndex].aiNarration}
          </div>

          {/* Myth Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#888'
          }}>
            <span>Myth Status: <span style={{ color: getMythStatusColor(allDeeds[selectedDeedIndex].mythStatus), fontWeight: 'bold' }}>{allDeeds[selectedDeedIndex].mythStatus}%</span></span>
            <span>{getMythStatusLabel(allDeeds[selectedDeedIndex].mythStatus)}</span>
          </div>
        </div>
      )}

      {/* Generation Summary */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        paddingTop: '12px',
        borderTop: '1px solid #444'
      }}>
        {legacyImpacts.map((legacy, genIndex) => (
          <button
            key={`gen-summary-${genIndex}`}
            onClick={() => setHoveredGeneration(hoveredGeneration === genIndex ? null : genIndex)}
            style={{
              padding: '8px 12px',
              backgroundColor: hoveredGeneration === genIndex ? '#2a2a2a' : '#1a1a1a',
              border: `1px solid ${getMythStatusColor(legacy.mythStatus)}`,
              borderRadius: '4px',
              color: getMythStatusColor(legacy.mythStatus),
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: hoveredGeneration === genIndex ? `0 0 8px ${getMythStatusColor(legacy.mythStatus)}` : 'none'
            }}
          >
            {legacy.canonicalName} <span style={{ opacity: 0.7 }}>({legacy.epochsLived} epochs)</span>
          </button>
        ))}
      </div>
    </div>
  );
}
