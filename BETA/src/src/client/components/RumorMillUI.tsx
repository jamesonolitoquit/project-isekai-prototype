import React, { useState, useMemo } from 'react';
import type { Rumor, HardFact } from '../../engine/beliefEngine';
import type { WorldState } from '../../engine/worldEngine';

/**
 * M47-A1: The Rumor Mill (Journal Panel)
 * 
 * Visualizes the belief layer for the player.
 * Displays known rumors with confidence bars, distortion levels,
 * and lets players see how rumors crystallize into hard facts
 * as investigation evidence accumulates.
 */

interface RumorMillProps {
  state?: WorldState;
  playerPerceptionLevel?: number; // 0-100: how much can player perceive?
  investigationConfidence?: Record<string, number>; // investigationId -> confidence %
  onRumorClick?: (rumorId: string) => void;
  isDeveloperMode?: boolean;
}

interface DisplayRumor {
  id: string;
  description: string;
  location: string;
  confidence: number; // 0-100
  distortionLevel: number; // 0-100 (higher = more distorted)
  age: number; // ticks old
  source?: string; // Who first heard this?
  investigationProgress?: number; // 0-100, if being investigated
  status: 'rumor' | 'investigating' | 'crystallized';
  crystallizationThreshold?: number; // What confidence needed?
}

interface RumorCategoryGroup {
  category: string;
  rumors: DisplayRumor[];
  count: number;
}

/**
 * Categorize rumors by their theme
 */
function categorizeRumors(rumors: DisplayRumor[]): RumorCategoryGroup[] {
  const groups: Record<string, DisplayRumor[]> = {};

  for (const rumor of rumors) {
    const keywords = rumor.description.toLowerCase();
    let category = 'Other';

    if (keywords.includes('death') || keywords.includes('died') || keywords.includes('killed')) {
      category = 'Deaths & Disappearances';
    } else if (keywords.includes('treasure') || keywords.includes('gold') || keywords.includes('artifact')) {
      category = 'Treasures & Artifacts';
    } else if (keywords.includes('faction') || keywords.includes('war') || keywords.includes('battle')) {
      category = 'Faction & Conflict';
    } else if (keywords.includes('magic') || keywords.includes('curse') || keywords.includes('spell')) {
      category = 'Magic & Mysteries';
    } else if (keywords.includes('location') || keywords.includes('path') || keywords.includes('ruin')) {
      category = 'Locations & Routes';
    } else if (keywords.includes('npc') || keywords.includes('person')) {
      category = 'Character Rumors';
    }

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(rumor);
  }

  return Object.entries(groups)
    .map(([category, rumors]) => ({
      category,
      rumors: rumors.sort((a, b) => b.confidence - a.confidence),
      count: rumors.length
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get color based on confidence level
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#fbbf24'; // Gold - highly believed
  if (confidence >= 60) return '#60a5fa'; // Blue - well-known
  if (confidence >= 40) return '#a78bfa'; // Purple - somewhat known
  if (confidence >= 20) return '#94a3b8'; // Gray - whispers only
  return '#64748b'; // Dark gray - very obscure
}

/**
 * Get opacity based on distortion level
 */
function getDistortionOpacity(distortion: number): number {
  // Higher distortion = more "glitchy" appearance
  return Math.max(0.4, 1 - distortion / 200);
}

/**
 * Format rumor age into readable string
 */
function formatRumorAge(ticks: number): string {
  const days = Math.floor(ticks / 1440); // 1440 ticks per day
  const hours = Math.floor((ticks % 1440) / 60);

  if (days > 7) {
    return `${Math.floor(days / 7)} weeks ago`;
  }
  if (days > 0) {
    return `${days}d ${hours}h ago`;
  }
  return `${hours}h ago`;
}

/**
 * Individual rumor card component
 */
function RumorCard({
  rumor,
  isExpanded,
  onToggle,
  isDeveloperMode
}: {
  rumor: DisplayRumor;
  isExpanded: boolean;
  onToggle: () => void;
  isDeveloperMode?: boolean;
}) {
  const confidenceColor = getConfidenceColor(rumor.confidence);
  const distortionOpacity = getDistortionOpacity(rumor.distortionLevel);
  const isCrystallized = rumor.status === 'crystallized';
  const isInvestigating = rumor.status === 'investigating';

  return (
    <div
      style={{
        backgroundColor: isCrystallized ? '#1f2937' : '#111827',
        border: isCrystallized ? '2px solid #fbbf24' : '1px solid #374151',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        opacity: distortionOpacity,
        filter: rumor.distortionLevel > 50 ? 'blur(0.5px)' : 'none'
      }}
      onClick={onToggle}
      title={`Distortion: ${rumor.distortionLevel}% | Confidence: ${rumor.confidence}%`}
    >
      {/* Header: Title + Status Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>
            {rumor.description}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {rumor.location && `📍 ${rumor.location}`}
            {rumor.source && ` • Heard from: ${rumor.source}`}
            {` • ${formatRumorAge(rumor.age)}`}
          </div>
        </div>

        {/* Status Badge */}
        <div
          style={{
            paddingRight: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px'
          }}
        >
          {isCrystallized && (
            <div style={{
              backgroundColor: '#fbbf24',
              color: '#000',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              ✧ FACT ✧
            </div>
          )}
          {isInvestigating && (
            <div style={{
              backgroundColor: '#60a5fa',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              🔍 INVESTIGATING
            </div>
          )}
        </div>
      </div>

      {/* Confidence Bar */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
          Confidence: <span style={{ color: confidenceColor }}>{rumor.confidence}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
            overflow: 'hidden',
            border: `1px solid ${confidenceColor}`
          }}
        >
          <div
            style={{
              width: `${rumor.confidence}%`,
              height: '100%',
              backgroundColor: confidenceColor,
              transition: 'width 0.5s ease'
            }}
          />
        </div>
      </div>

      {/* Investigation Progress (if applicable) */}
      {isInvestigating && rumor.investigationProgress !== undefined && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
            Investigation Progress: <span style={{ color: '#60a5fa' }}>{rumor.investigationProgress}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#1e293b',
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid #60a5fa'
            }}
          >
            <div
              style={{
                width: `${rumor.investigationProgress}%`,
                height: '100%',
                backgroundColor: '#60a5fa',
                transition: 'width 0.5s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Distortion Display */}
      <div>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          Distortion: <span style={{ color: '#a78bfa' }}>{rumor.distortionLevel}%</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #374151' }}>
          <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.6' }}>
            <p>
              This rumor has spread across {Math.ceil(rumor.location.length)} locations with varying degrees of
              distortion. The more people who tell the story, the more it changes.
            </p>

            {isDeveloperMode && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#1e293b',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontFamily: 'monospace'
                }}
              >
                <strong>DEBUG:</strong> Distortion: {rumor.distortionLevel}% | Threshold to crystallize:{' '}
                {rumor.crystallizationThreshold}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main RumorMillUI Component
 */
export default function RumorMillUI({
  state,
  playerPerceptionLevel = 50,
  investigationConfidence = {},
  onRumorClick,
  isDeveloperMode
}: RumorMillProps): React.ReactElement {
  const [expandedRumorId, setExpandedRumorId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Generate mock rumor data if no state provided (for development)
  const mockRumors: DisplayRumor[] = useMemo(() => {
    if (!state) {
      return [
        {
          id: 'rumor_dragon_death',
          description: 'The great dragon has been slain by a wanderer',
          location: 'Northern Mountains',
          confidence: 72,
          distortionLevel: 35,
          age: 120,
          status: 'rumor',
          crystallizationThreshold: 80,
          investigationProgress: undefined
        },
        {
          id: 'rumor_treasure',
          description: 'A merchant\'s gold was cursed and brought ruin',
          location: 'Market Square',
          confidence: 45,
          distortionLevel: 62,
          age: 840,
          status: 'investigating',
          investigationProgress: 55,
          crystallizationThreshold: 75
        },
        {
          id: 'rumor_faction_war',
          description: 'Two factions are secretly negotiating a truce',
          location: 'Political Circles',
          confidence: 38,
          distortionLevel: 78,
          age: 200,
          status: 'rumor',
          crystallizationThreshold: 70
        },
        {
          id: 'rumor_artifact',
          description: 'An ancient artifact of power has awakened',
          location: 'Eastern Ruins',
          confidence: 22,
          distortionLevel: 85,
          age: 1200,
          status: 'rumor',
          crystallizationThreshold: 85
        },
        {
          id: 'hard_fact_murder',
          description: 'The village elder was murdered by moonlight',
          location: 'Village Square',
          confidence: 91,
          distortionLevel: 5,
          age: 72,
          status: 'crystallized',
          crystallizationThreshold: 85
        }
      ];
    }
    return [];
  }, [state]);

  const rumors = mockRumors.length > 0 ? mockRumors : [];
  const categorized = useMemo(() => categorizeRumors(rumors), [rumors]);

  // Apply perception filter
  const filteredRumors = useMemo(() => {
    return rumors.filter(rumor => {
      // Hard facts are always visible
      if (rumor.status === 'crystallized') {
        return true;
      }
      // Rumors depend on perception and confidence
      return rumor.confidence > 100 - playerPerceptionLevel;
    });
  }, [rumors, playerPerceptionLevel]);

  const accessibleCategories = useMemo(() => {
    const used = new Set<string>();
    for (const rumor of filteredRumors) {
      const group = categorized.find(g => g.rumors.includes(rumor));
      if (group) used.add(group.category);
    }
    return Array.from(used);
  }, [filteredRumors, categorized]);

  const displayedCategory = selectedCategory || accessibleCategories[0];
  const categoryRumors = categorized.find(c => c.category === displayedCategory)?.rumors || [];
  const displayRumors = categoryRumors.filter(r => filteredRumors.includes(r));

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#0f172a',
        color: '#e5e7eb',
        borderRadius: '8px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px', borderBottom: '2px solid #374151', paddingBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#fbbf24' }}>
          📜 The Rumor Mill
        </h2>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>
          Track what the world believes vs. what is true
        </p>
      </div>

      {/* Perception Info */}
      {isDeveloperMode && (
        <div
          style={{
            padding: '8px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '11px',
            color: '#94a3b8'
          }}
        >
          <strong>Perception Level:</strong> {playerPerceptionLevel}% | <strong>Visible Rumors:</strong>{' '}
          {filteredRumors.length} / {rumors.length}
        </div>
      )}

      {/* Category Tabs */}
      {accessibleCategories.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
          {accessibleCategories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedCategory === category || (!selectedCategory && category === accessibleCategories[0])
                  ? '#374151'
                  : '#1e293b',
                color: '#e5e7eb',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: selectedCategory === category || (!selectedCategory && category === accessibleCategories[0])
                  ? 'bold'
                  : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Rumors List */}
      {displayRumors.length > 0 ? (
        <div>
          {displayRumors.map(rumor => (
            <RumorCard
              key={rumor.id}
              rumor={rumor}
              isExpanded={expandedRumorId === rumor.id}
              onToggle={() => {
                setExpandedRumorId(expandedRumorId === rumor.id ? null : rumor.id);
                onRumorClick?.(rumor.id);
              }}
              isDeveloperMode={isDeveloperMode}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#6b7280',
            fontSize: '14px'
          }}
        >
          ✧ No rumors at this perception level ✧
          <br />
          <span style={{ fontSize: '12px' }}>Increase your awareness to hear whispers...</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #374151' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          <div style={{ marginBottom: '6px' }}>
            <strong>Legend:</strong>
          </div>
          <div>
            ✧ <span style={{ color: '#fbbf24' }}>Crystallized</span> = Confirmed fact
          </div>
          <div>
            🔍 <span style={{ color: '#60a5fa' }}>Investigating</span> = Being researched
          </div>
          <div>
            📊 Bars show confidence level and distortion
          </div>
        </div>
      </div>
    </div>
  );
}
