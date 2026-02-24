/**
 * M63-A Bloodline Viewer Component
 * 
 * Visualizes ancestral lineage - shows family tree with myth ranks,
 * legendary status, and key deeds. Clickable to show full ancestor profiles.
 */

import React, { useState } from 'react';
import type { BloodlineData, AncestorSnapshot } from '../engine/m63AInheritanceWiring';
import { buildAncestryTree } from '../engine/m63AInheritanceWiring';

export interface BloodlineViewerProps {
  bloodlineData: BloodlineData;
  onSelectAncestor?: (ancestor: AncestorSnapshot) => void;
}

/**
 * Main bloodline viewer component
 */
export const BloodlineViewer: React.FC<BloodlineViewerProps> = ({
  bloodlineData,
  onSelectAncestor
}) => {
  const [selectedAncestor, setSelectedAncestor] = useState<AncestorSnapshot | null>(null);
  const [expandedGeneration, setExpandedGeneration] = useState<number>(bloodlineData.epochsLived);

  const tree = buildAncestryTree(bloodlineData);

  const handleSelectAncestor = (ancestor: AncestorSnapshot) => {
    setSelectedAncestor(ancestor);
    onSelectAncestor?.(ancestor);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Bloodline Lineage</h2>
        <div style={styles.summary}>
          <span>Epochs: {bloodlineData.epochsLived}</span>
          <span>Legacy Perks: {bloodlineData.inheritedPerks.length}</span>
        </div>
      </div>

      <div style={styles.treeContainer}>
        {/* Current Character (Root) */}
        <div style={styles.currentCharacter}>
          <div style={styles.characterCard}>
            <div style={styles.characterName}>{bloodlineData.canonicalName}</div>
            <div style={styles.characterMeta}>
              <div>Current Epoch</div>
              <div style={{ color: '#a78bfa' }}>Myth: {bloodlineData.mythStatus}</div>
            </div>
            <div style={styles.perks}>
              {bloodlineData.inheritedPerks.map((perk, idx) => (
                <span key={idx} style={styles.perkBadge}>
                  {perk}
                </span>
              ))}
            </div>
          </div>

          {/* Arrow pointing to ancestors */}
          {bloodlineData.ancestorChain.length > 0 && (
            <div style={styles.ancestorArrow}>↓</div>
          )}
        </div>

        {/* Ancestor Chain */}
        <div style={styles.ancestorChain}>
          {bloodlineData.ancestorChain.reverse().map((ancestor, idx) => (
            <AncestorCard
              key={`${ancestor.epochId}_${idx}`}
              ancestor={ancestor}
              isSelected={selectedAncestor?.epochId === ancestor.epochId}
              onSelect={() => handleSelectAncestor(ancestor)}
              isExpanded={expandedGeneration === ancestor.generation}
              onToggleExpanded={() =>
                setExpandedGeneration(
                  expandedGeneration === ancestor.generation ? -1 : ancestor.generation
                )
              }
            />
          ))}
        </div>
      </div>

      {/* Ancestor Details Panel */}
      {selectedAncestor && (
        <AncestorDetailPanel
          ancestor={selectedAncestor}
          onClose={() => setSelectedAncestor(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// ANCESTOR CARD COMPONENT
// ============================================================================

interface AncestorCardProps {
  ancestor: AncestorSnapshot;
  isSelected: boolean;
  onSelect: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const AncestorCard: React.FC<AncestorCardProps> = ({
  ancestor,
  isSelected,
  onSelect,
  isExpanded,
  onToggleExpanded
}) => {
  const mythRankLabels = [
    'Forgotten',
    'Known',
    'Remembered',
    'Notable',
    'Legendary',
    'Mythic'
  ];

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 5:
        return '#fbbf24'; // Gold - Mythic
      case 4:
        return '#a78bfa'; // Purple - Legendary
      case 3:
        return '#60a5fa'; // Blue - Notable
      case 2:
        return '#34d399'; // Green - Remembered
      case 1:
        return '#9ca3af'; // Gray - Known
      default:
        return '#6b7280'; // Darker gray - Forgotten
    }
  };

  return (
    <div
      style={{
        ...styles.ancestorCard,
        borderLeft: `4px solid ${getRankColor(ancestor.mythRank)}`,
        backgroundColor: isSelected ? 'rgba(167, 139, 250, 0.1)' : 'transparent'
      }}
      onClick={onSelect}
    >
      <div style={styles.ancestorHeader}>
        <div>
          <div style={styles.ancestorName}>{ancestor.canonicalName}</div>
          <div style={{ ...styles.ancestorMeta, color: getRankColor(ancestor.mythRank) }}>
            {mythRankLabels[ancestor.mythRank]} {ancestor.legendary && '⭐'}
          </div>
        </div>
        <button
          style={styles.expandButton}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded();
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div style={styles.ancestorDetails}>
          <div>
            <span style={{ color: '#9ca3af' }}>Generation:</span> {ancestor.generation}
          </div>
          <div>
            <span style={{ color: '#9ca3af' }}>Deeds:</span> {ancestor.deedsCount}
          </div>
          <div>
            <span style={{ color: '#9ca3af' }}>Paradox at Death:</span> {ancestor.paradoxAtDeath}
          </div>
          {Object.entries(ancestor.factionAlliances).length > 0 && (
            <div style={styles.factionRow}>
              <span style={{ color: '#9ca3af' }}>Alliances:</span>
              <div style={styles.factionList}>
                {Object.entries(ancestor.factionAlliances)
                  .filter(([, rep]) => rep > 0)
                  .map(([faction, rep]) => (
                    <span key={faction} style={styles.factionTag}>
                      {faction} (+{rep})
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ANCESTOR DETAIL PANEL
// ============================================================================

interface AncestorDetailPanelProps {
  ancestor: AncestorSnapshot;
  onClose: () => void;
}

const AncestorDetailPanel: React.FC<AncestorDetailPanelProps> = ({
  ancestor,
  onClose
}) => {
  const mythRankLabels = [
    'Forgotten',
    'Known',
    'Remembered',
    'Notable',
    'Legendary',
    'Mythic'
  ];

  const getRankDescription = (rank: number): string => {
    const descriptions = [
      'Your ancestor was forgotten by history, yet echoes remain.',
      'Your ancestor was known in their time.',
      'Your ancestor is remembered by those who knew them.',
      'Your ancestor was notable - their deeds shaped their era.',
      'Your ancestor was legendary - songs still tell of their glory.',
      'Your ancestor ascended to myth - they were divine.'
    ];
    return descriptions[rank] || 'Unknown';
  };

  return (
    <div style={styles.detailPanel}>
      <div style={styles.detailHeader}>
        <h3>{ancestor.canonicalName}</h3>
        <button style={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={styles.detailContent}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Status:</span>
          <span style={styles.detailValue}>
            {mythRankLabels[ancestor.mythRank]}
            {ancestor.legendary && ' ⭐'}
          </span>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Generation:</span>
          <span style={styles.detailValue}>{ancestor.generation}</span>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Legendary Deeds:</span>
          <span style={styles.detailValue}>{ancestor.deedsCount}</span>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Paradox Level at Death:</span>
          <span style={styles.detailValue}>{ancestor.paradoxAtDeath}</span>
        </div>

        <p style={styles.detailDescription}>{getRankDescription(ancestor.mythRank)}</p>

        {Object.entries(ancestor.factionAlliances).length > 0 && (
          <div style={styles.detailSection}>
            <div style={styles.detailLabel}>Faction Alliances:</div>
            <div style={styles.allianceList}>
              {Object.entries(ancestor.factionAlliances)
                .sort(([, a], [, b]) => b - a)
                .map(([faction, reputation]) => (
                  <div key={faction} style={styles.allianceItem}>
                    <span>{faction}</span>
                    <span style={{ color: reputation > 0 ? '#34d399' : '#ef4444' }}>
                      {reputation > 0 ? '+' : ''}{reputation}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid #374151',
    fontFamily: 'monospace',
    color: '#e5e7eb'
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #374151',
    paddingBottom: '12px'
  },

  summary: {
    display: 'flex',
    gap: '20px',
    fontSize: '12px',
    color: '#9ca3af'
  },

  treeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxHeight: '500px',
    overflowY: 'auto'
  },

  currentCharacter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },

  characterCard: {
    padding: '16px',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    border: '2px solid #fbbf24',
    borderRadius: '6px',
    textAlign: 'center',
    minWidth: '200px'
  },

  characterName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: '8px'
  },

  characterMeta: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '8px'
  },

  perks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center'
  },

  perkBadge: {
    padding: '4px 8px',
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    border: '1px solid #a78bfa',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#a78bfa'
  },

  ancestorArrow: {
    fontSize: '20px',
    color: '#fbbf24',
    textAlign: 'center'
  },

  ancestorChain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  ancestorCard: {
    padding: '12px',
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  ancestorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },

  ancestorName: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: '4px'
  },

  ancestorMeta: {
    fontSize: '11px',
    fontWeight: 'bold'
  },

  expandButton: {
    background: 'none',
    border: '1px solid #4b5563',
    color: '#9ca3af',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },

  ancestorDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #374151',
    fontSize: '11px'
  },

  factionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },

  factionList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '4px'
  },

  factionTag: {
    padding: '2px 6px',
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    border: '1px solid #60a5fa',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#60a5fa'
  },

  detailPanel: {
    padding: '16px',
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    border: '1px solid #4b5563',
    borderRadius: '6px',
    marginTop: '8px'
  },

  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid #374151',
    paddingBottom: '8px'
  },

  closeButton: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 8px'
  },

  detailContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '12px'
  },

  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0'
  },

  detailLabel: {
    color: '#9ca3af',
    fontWeight: 'bold'
  },

  detailValue: {
    color: '#e5e7eb'
  },

  detailDescription: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#d1d5db',
    margin: '0'
  },

  detailSection: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #374151'
  },

  allianceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '8px'
  },

  allianceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: '4px'
  }
};

export default BloodlineViewer;
