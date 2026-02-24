/**
 * M53-E1: Chronicle History Timeline Component
 * 
 * Purpose: Visualize the timeline of Grand Deeds as a vertical scroll
 * Shows historical events across epochs with thematic styling
 * 
 * Features:
 * - Vertical timeline with event markers
 * - Epoch transitions highlighted
 * - Grand deed descriptions with thematic icons
 * - Soul Echo manifestations marked
 * - Sortable by date or importance
 * - Expandable deed details
 */

import React, { useMemo, useState } from 'react';

interface MacroEvent {
  id: string;
  message: string;
  tick: number;
  type?: string;
  locationId?: string;
}

interface LoreTome {
  id: string;
  title: string;
  description: string;
  deedCategory?: string;
  timestamp?: number;
}

interface PlayerLineage {
  generationNumber?: number;
  incarnationName?: string;
  canonicalName?: string;
  mythStatus?: number; // M57-E1: Myth status for lineage visualization
}

interface AncestorImpact {
  canonicalName?: string;
  mythStatus: number;
  inheritedPerks?: string[];
}

interface BloodlineData {
  canonicalName?: string;
  legacyImpacts?: AncestorImpact[];
  totalMythStatus?: number;
}

interface ChronicleHistoryProps {
  macroEvents?: MacroEvent[];
  loreTomes?: LoreTome[];
  currentEpoch?: string;
  compact?: boolean;
  maxEvents?: number;
  playerLineages?: Record<string, PlayerLineage>; // M54-E1: Map event IDs to ancestor information
  bloodlineData?: BloodlineData; // M57-E1: Bloodline visualization data
}

/**
 * Get icon and color for event type
 */
function getEventTheme(eventType?: string): { icon: string; color: string; label: string } {
  const themes: Record<string, { icon: string; color: string; label: string }> = {
    'LIBRARY_POPULATED': { icon: '📚', color: '#a8d5a8', label: 'Library Entry' },
    'SOUL_ECHO_MANIFESTED': { icon: '👻', color: '#9d8ef0', label: 'Soul Echo' },
    'SOUL_ECHO_MERIT_TRANSFERRED': { icon: '✨', color: '#ffd700', label: 'Ancestral Wisdom' },
    'EPOCH_TRANSITION': { icon: '⏳', color: '#ff6b6b', label: 'Epoch Shift' },
    'GRAND_DEED': { icon: '⚔️', color: '#fbbf24', label: 'Grand Deed' },
    'QUEST_COMPLETED': { icon: '✅', color: '#4ade80', label: 'Quest Complete' },
    'WORLD_SCAR': { icon: '⛰️', color: '#ef4444', label: 'World Scar' },
    'FACTION_VICTORY': { icon: '🏆', color: '#fbbf24', label: 'Faction Victory' },
    'RITUAL_PERFORMED': { icon: '🔮', color: '#a78bfa', label: 'Ritual' },
    'DISCOVERY': { icon: '🗺️', color: '#60a5fa', label: 'Discovery' }
  };

  return themes[eventType ?? 'GRAND_DEED'] ?? { icon: '📜', color: '#888', label: 'Event' };
}

/**
 * M57-E1: Get color for myth status tier (from PROTOTYPE ChronicleArchive)
 */
function getMythStatusColor(mythStatus: number): string {
  if (mythStatus >= 80) return '#ffd700'; // Gold - Legendary
  if (mythStatus >= 60) return '#c0c0c0'; // Silver - Heroic
  if (mythStatus >= 40) return '#cd7f32'; // Bronze - Notable
  if (mythStatus >= 20) return '#90ee90'; // Light green - Remembered
  return '#a9a9a9'; // Gray - Obscure
}

/**
 * M57-E1: Get tier name for myth status
 */
function getMythStatusTier(mythStatus: number): string {
  if (mythStatus >= 90) return 'Legendary';
  if (mythStatus >= 70) return 'Heroic';
  if (mythStatus >= 50) return 'Notable';
  if (mythStatus >= 30) return 'Remembered';
  return 'Obscure';
}

/**
 * Parse deed category from lore tome or macro event
 */
function getDeedCategory(event: MacroEvent | LoreTome): string {
  if ('deedCategory' in event) {
    return event.deedCategory || 'deed';
  }
  const messageType = (event as MacroEvent).type || 'GRAND_DEED';
  return messageType.toLowerCase();
}

/**
 * Format tick/timestamp to readable date
 */
function formatEventDate(tick: number): string {
  if (tick === undefined || tick === null) return 'Unknown';
  const hours = Math.floor(tick / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `Day ${days}, Hour ${hours % 24}`;
  }
  return `Hour ${hours}`;
}

/**
 * M57-E1: Lineage Ascension Tree Component
 * Visualizes ancestor myth status as horizontal bar chart
 * Ported from PROTOTYPE ChronicleArchive.tsx
 */
interface LineageAscensionTreeProps {
  bloodlineData?: BloodlineData;
  compact?: boolean;
}

function LineageAscensionTree({ bloodlineData, compact = false }: LineageAscensionTreeProps): React.ReactElement | null {
  if (!bloodlineData?.legacyImpacts || bloodlineData.legacyImpacts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: compact ? '12px' : '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid #333',
        marginBottom: compact ? '12px' : '20px',
      }}
    >
      <h3
        style={{
          color: '#d4af37',
          margin: '0 0 16px 0',
          fontSize: compact ? '12px' : '14px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        ⚔️ LINEAGE ASCENSION TREE
      </h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: 12,
          padding: compact ? '12px' : '20px',
          backgroundColor: 'rgba(212, 175, 55, 0.05)',
          borderRadius: 8,
          border: '1px solid rgba(212, 175, 55, 0.15)',
          minHeight: compact ? '120px' : '200px',
        }}
      >
        {bloodlineData.legacyImpacts.map((impact, idx) => {
          const mythPercent = (impact.mythStatus / 100) * 100;
          const tierColor = getMythStatusColor(impact.mythStatus);
          const tier = getMythStatusTier(impact.mythStatus);

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}
              title={`${impact.canonicalName || `Gen ${idx + 1}`}: ${impact.mythStatus} myth (${tier})`}
            >
              {/* Branch connector */}
              {idx > 0 && (
                <div
                  style={{
                    width: 2,
                    height: 16,
                    backgroundColor: '#666',
                    marginBottom: 8,
                  }}
                />
              )}

              {/* Myth Status Bar */}
              <div
                style={{
                  width: '100%',
                  height: Math.max(20, mythPercent * 1.5),
                  backgroundColor: tierColor,
                  borderRadius: 4,
                  opacity: 0.7,
                  transition: 'all 0.3s ease',
                  boxShadow: `0 0 10px ${tierColor}80`,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 4,
                  fontSize: compact ? '9px' : '10px',
                  fontWeight: 'bold',
                  color: '#000',
                }}
              >
                {impact.mythStatus}
              </div>

              {/* Generation Label */}
              <div
                style={{
                  marginTop: 12,
                  fontSize: compact ? '9px' : '11px',
                  color: '#999',
                  textAlign: 'center',
                }}
              >
                Gen {idx + 1}
              </div>
              <div
                style={{
                  fontSize: compact ? '9px' : '10px',
                  color: tierColor,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {tier}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Timeline entry card
 */
interface TimelineEntryProps {
  event: MacroEvent | LoreTome;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  lineage?: PlayerLineage; // M54-E1: Ancestor information
}

function TimelineEntry({ event, isExpanded, onToggle, index, lineage }: TimelineEntryProps): React.ReactElement {
  const isLoreTome = 'description' in event;
  const message = isLoreTome ? (event as LoreTome).title : (event as MacroEvent).message;
  const description = isLoreTome ? (event as LoreTome).description : undefined;
  const eventType = isLoreTome ? 'LIBRARY_POPULATED' : (event as MacroEvent).type;
  const theme = getEventTheme(eventType);
  const timestamp = isLoreTome ? (event as LoreTome).timestamp : (event as MacroEvent).tick;

  return (
    <div
      style={{
        display: 'flex',
        marginBottom: '20px',
        position: 'relative',
        opacity: isExpanded ? 1 : 0.85,
        transition: 'all 0.3s ease'
      }}
    >
      {/* Timeline connector line */}
      <div
        style={{
          width: '3px',
          backgroundColor: theme.color,
          marginRight: '20px',
          position: 'relative',
          marginTop: '8px'
        }}
      >
        {/* Timeline node */}
        <div
          style={{
            position: 'absolute',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: theme.color,
            border: '2px solid rgba(0,0,0,0.5)',
            left: '-7px',
            top: '-12px',
            boxShadow: `0 0 8px ${theme.color}80`,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${theme.color}`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${theme.color}80`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
          onClick={onToggle}
          title={theme.label}
        />
      </div>

      {/* Event card */}
      <div
        onClick={onToggle}
        style={{
          flex: 1,
          padding: '12px',
          borderRadius: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          border: `1px solid ${isExpanded ? theme.color : 'rgba(100, 100, 100, 0.3)'}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isExpanded ? `inset 0 0 12px ${theme.color}20` : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = theme.color;
            el.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'rgba(100, 100, 100, 0.3)';
            el.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
          }
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isExpanded ? '8px' : '0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span style={{ fontSize: '18px' }}>{theme.icon}</span>
            <span
              style={{
                fontSize: '12px',
                color: theme.color,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {theme.label}
            </span>
            {/* M54-E1: Player lineage badge */}
            {lineage && lineage.canonicalName && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#aaa',
                  backgroundColor: 'rgba(168, 213, 168, 0.15)',
                  border: '1px solid rgba(168, 213, 168, 0.4)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  marginLeft: '8px'
                }}
                title={`Generation ${lineage.generationNumber || '?'}`}
              >
                🧬 {lineage.canonicalName}
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span style={{ fontSize: '10px', color: '#888', marginRight: '8px' }}>
            {formatEventDate(timestamp || 0)}
          </span>

          {/* Expand indicator */}
          <span
            style={{
              color: theme.color,
              fontSize: '16px',
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            ▼
          </span>
        </div>

        {/* Title/message */}
        <div
          style={{
            fontSize: '13px',
            color: '#a8d5a8',
            marginBottom: isExpanded ? '8px' : '0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {message}
        </div>

        {/* Expanded details */}
        {isExpanded && description && (
          <div
            style={{
              fontSize: '11px',
              color: '#888',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: `1px solid ${theme.color}40`,
              fontStyle: 'italic',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {description}
          </div>
        )}

        {/* Entry ID for reference */}
        {isExpanded && (
          <div
            style={{
              fontSize: '9px',
              color: '#555',
              marginTop: '8px',
              paddingTop: '4px',
              borderTop: `1px solid rgba(100, 100, 100, 0.2)`,
              fontFamily: 'monospace'
            }}
          >
            ID: {event.id}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Chronicle History Timeline
 */
export default function ChronicleHistory({
  macroEvents = [],
  loreTomes = [],
  currentEpoch,
  compact = false,
  maxEvents = 50,
  playerLineages = {}, // M54-E1: Player lineages mapping
  bloodlineData, // M57-E1: Bloodline visualization data
}: ChronicleHistoryProps): React.ReactElement {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Combine and sort events and lore tomes
  const allEntries = useMemo(() => {
    const combined: (MacroEvent | LoreTome)[] = [
      ...macroEvents,
      ...loreTomes
    ];

    // Sort by timestamp descending (most recent first)
    combined.sort((a, b) => {
      const aTime = 'tick' in a ? a.tick : a.timestamp || 0;
      const bTime = 'tick' in b ? b.tick : b.timestamp || 0;
      return bTime - aTime;
    });

    return combined.slice(0, maxEvents);
  }, [macroEvents, loreTomes, maxEvents]);

  if (allEntries.length === 0) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: '#888',
          fontSize: '12px'
        }}
      >
        📜 No historical events recorded yet. Begin your journey to create history!
      </div>
    );
  }

  return (
    <div
      style={{
        padding: compact ? '12px' : '20px',
        maxHeight: compact ? '300px' : 'auto',
        overflowY: compact ? 'auto' : 'visible',
        scrollBehavior: 'smooth',
        fontFamily: 'monospace'
      }}
    >
      {/* Timeline header */}
      <div
        style={{
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '2px solid rgba(168, 213, 168, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            color: '#a8d5a8',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          📜 CHRONICLE OF AGES
        </h3>
        {currentEpoch && (
          <span
            style={{
              fontSize: '10px',
              color: '#888',
              textTransform: 'uppercase'
            }}
          >
            {currentEpoch}
          </span>
        )}
      </div>

      {/* M57-E1: Lineage Ascension Tree */}
      <LineageAscensionTree bloodlineData={bloodlineData} compact={compact} />

      {/* Timeline entries */}
      <div>
        {allEntries.map((entry, index) => (
          <TimelineEntry
            key={entry.id}
            event={entry}
            index={index}
            isExpanded={expandedIds.has(entry.id)}
            onToggle={() => toggleExpanded(entry.id)}
            lineage={playerLineages?.[entry.id]} // M54-E1: Pass lineage to entry
          />
        ))}
      </div>

      {/* Footer info */}
      {allEntries.length === maxEvents && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(100, 100, 100, 0.2)',
            fontSize: '10px',
            color: '#555',
            textAlign: 'center'
          }}
        >
          Showing {maxEvents} most recent events. More history exists.
        </div>
      )}
    </div>
  );
}
