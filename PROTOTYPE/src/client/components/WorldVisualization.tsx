/**
 * M43 Phase C Task C1: World Scar Visualization
 *
 * Purpose: Render persistent world fragments and environmental scars
 *
 * Design:
 * - Display all active WorldFragment objects from fragment registry
 * - Ruined fragments (durability < 0.5) render with degraded CSS filters
 * - Sealed fragments show golden/iron border indicating canonical permanence
 * - Ghost Ruins: transparent overlays of fragments from previous epochs (from Iron Canon)
 * - Hover details show fragment metadata (created epoch, durability, sealed status)
 *
 * Lifecycle:
 * 1. Component mounts, initializes fragment registry listener
 * 2. Fragment registry updates trigger re-render
 * 3. Calculate ruin state based on durability
 * 4. Render fragments with appropriate visual filters
 * 5. Display ghost overlays for historical fragments
 * 6. Cleanup on unmount
 */

import React, { useState, useEffect, useMemo } from 'react';

/**
 * Fragment interface (mirrors M43 worldFragmentEngine)
 */
interface WorldFragment {
  id: string;
  epochCreated: number;
  type: 'building' | 'garden' | 'landmark' | 'monument';
  description: string;
  position: { x: number; y: number; z?: number };
  durability: number; // 0.0-1.0
  sealed: boolean;
  sealTick?: number;
  lastWeatheredAt?: number;
  createdBy?: string;
  notes?: string;
}

/**
 * Fragment registry interface
 */
interface FragmentRegistry {
  fragments: Map<string, WorldFragment> | WorldFragment[];
}

/**
 * Props for WorldVisualization
 */
interface WorldVisualizationProps {
  fragments?: WorldFragment[];
  fragmentRegistry?: FragmentRegistry;
  showGhosts?: boolean; // Show transparent overlays from previous epochs
  worldInstanceId?: string;
  onFragmentHover?: (fragment: WorldFragment | null) => void;
}

/**
 * Calculate CSS filters for ruined fragments
 */
function getRuinedFragmentStyle(fragment: WorldFragment): React.CSSProperties {
  const isRuined = fragment.durability < 0.5;
  const isSealed = fragment.sealed;

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '8px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  if (isRuined) {
    // Apply degradation filters
    return {
      ...baseStyle,
      filter: `grayscale(${1 - fragment.durability}) opacity(${0.5 + fragment.durability * 0.5})`,
      opacity: 0.5 + fragment.durability * 0.5,
      textDecoration: 'line-through',
      color: 'rgba(200, 100, 100, 0.8)',
    };
  }

  if (isSealed) {
    // Golden/iron border for sealed fragments
    return {
      ...baseStyle,
      border: '2px solid gold',
      boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
      backgroundColor: 'rgba(255, 215, 0, 0.05)',
    };
  }

  return baseStyle;
}

/**
 * Calculate relative durability description
 */
function getDurabilityLabel(durability: number): string {
  if (durability >= 0.9) return 'Perfect';
  if (durability >= 0.7) return 'Weathered';
  if (durability >= 0.5) return 'Deteriorating';
  if (durability >= 0.3) return 'Ruined';
  if (durability >= 0.1) return 'Crumbling';
  return 'Destroyed';
}

/**
 * Fragment status badge
 */
const FragmentStatusBadge: React.FC<{ fragment: WorldFragment }> = ({ fragment }) => {
  const badges: string[] = [];

  if (fragment.sealed) {
    badges.push('🔒 Sealed');
  }

  const durability = fragment.durability;
  if (durability < 0.5) {
    badges.push(`⚠️ ${getDurabilityLabel(durability)}`);
  }

  if (badges.length === 0) {
    badges.push(`✓ ${getDurabilityLabel(durability)}`);
  }

  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
      {badges.map((badge, idx) => (
        <span
          key={idx}
          style={{
            padding: '2px 6px',
            backgroundColor: fragment.sealed ? 'rgba(255, 215, 0, 0.2)' : 'rgba(100, 150, 255, 0.2)',
            borderRadius: '3px',
            fontSize: '11px',
          }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

/**
 * Individual fragment component
 */
const FragmentCard: React.FC<{
  fragment: WorldFragment;
  isGhost?: boolean;
  onHover?: (fragment: WorldFragment | null) => void;
}> = ({ fragment, isGhost = false, onHover }) => {
  const style = getRuinedFragmentStyle(fragment);

  if (isGhost) {
    // Ghost version: transparent overlay
    return (
      <div
        style={{
          ...style,
          opacity: 0.3,
          fontStyle: 'italic',
          color: 'rgba(150, 150, 200, 0.6)',
          backgroundColor: 'rgba(100, 100, 150, 0.05)',
        }}
        title={`Ghost Ruin from Epoch ${fragment.epochCreated}`}
      >
        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
          👻 {fragment.description}
        </div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>
          Epoch {fragment.epochCreated} (Memory)
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      onMouseEnter={() => onHover?.(fragment)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {fragment.type === 'building' && '🏠'}
          {fragment.type === 'garden' && '🌳'}
          {fragment.type === 'landmark' && '⛩️'}
          {fragment.type === 'monument' && '🗿'}
          {' '}
          {fragment.description}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
          {(fragment.durability * 100).toFixed(0)}%
        </div>
      </div>

      <div style={{ fontSize: '12px', marginTop: '4px', color: 'rgba(255, 255, 255, 0.6)' }}>
        <div>Type: {fragment.type}</div>
        <div>Position: ({fragment.position.x}, {fragment.position.y})</div>
        <div>Created: Epoch {fragment.epochCreated}</div>
        {fragment.createdBy && <div>Built by: {fragment.createdBy}</div>}
        {fragment.notes && <div style={{ fontStyle: 'italic', marginTop: '4px' }}>{fragment.notes}</div>}
      </div>

      <FragmentStatusBadge fragment={fragment} />
    </div>
  );
};

/**
 * WorldVisualization Component - Render all persistent world fragments
 */
export const WorldVisualization: React.FC<WorldVisualizationProps> = ({
  fragments: fragmentsProp,
  fragmentRegistry,
  showGhosts = true,
  worldInstanceId,
  onFragmentHover,
}) => {
  const [hoveredFragment, setHoveredFragment] = useState<WorldFragment | null>(null);

  // Extract fragments from either direct prop or registry
  const fragments = useMemo(() => {
    if (fragmentsProp) {
      return fragmentsProp;
    }

    if (fragmentRegistry) {
      if (fragmentRegistry.fragments instanceof Map) {
        return Array.from(fragmentRegistry.fragments.values());
      }
      if (Array.isArray(fragmentRegistry.fragments)) {
        return fragmentRegistry.fragments;
      }
    }

    return [];
  }, [fragmentsProp, fragmentRegistry]);

  // Separate active and ghost fragments
  const activeFragments = useMemo(() => {
    return fragments.filter(f => !f.sealed || f.sealed);
  }, [fragments]);

  // Get ghost fragments (from previous epochs)
  const ghostFragments = useMemo(() => {
    if (!showGhosts) return [];
    // In real implementation, fetch from Iron Canon history
    // For now, show fragments that are heavily weathered (durability < 0.3) as "near-ghosts"
    return fragments.filter(f => f.durability < 0.3 && f.epochCreated < Math.max(...fragments.map(x => x.epochCreated)));
  }, [fragments, showGhosts]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = fragments.length;
    const sealed = fragments.filter(f => f.sealed).length;
    const ruined = fragments.filter(f => f.durability < 0.5).length;
    const avgDurability =
      fragments.length > 0
        ? (fragments.reduce((sum, f) => sum + f.durability, 0) / fragments.length * 100).toFixed(1)
        : 0;

    return { total, sealed, ruined, avgDurability };
  }, [fragments]);

  const handleFragmentHover = (fragment: WorldFragment | null) => {
    setHoveredFragment(fragment);
    onFragmentHover?.(fragment);
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: 'rgba(20, 20, 40, 0.9)',
        border: '1px solid rgba(100, 150, 255, 0.3)',
        borderRadius: '8px',
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'monospace',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: 'rgba(100, 200, 255, 1)' }}>
        🌍 World Fragment Registry
      </h2>

      {/* Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: 'rgba(50, 50, 80, 0.5)',
          borderRadius: '4px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>Total Fragments</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.total}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 215, 0, 1)' }}>🔒 Sealed</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.sealed}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 100, 100, 1)' }}>⚠️ Ruined</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.ruined}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(150, 200, 100, 1)' }}>Avg Durability</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.avgDurability}%</div>
        </div>
      </div>

      {/* Active Fragments */}
      <div>
        <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'rgba(150, 200, 255, 1)' }}>
          Active Fragments ({activeFragments.length})
        </h3>
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '8px',
          }}
        >
          {activeFragments.length === 0 ? (
            <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
              No fragments in world registry
            </div>
          ) : (
            activeFragments.map(fragment => (
              <FragmentCard
                key={fragment.id}
                fragment={fragment}
                onHover={handleFragmentHover}
              />
            ))
          )}
        </div>
      </div>

      {/* Guest Fragments (from previous epochs) */}
      {showGhosts && ghostFragments.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'rgba(150, 150, 200, 0.8)' }}>
            👻 Ghost Ruins ({ghostFragments.length})
          </h3>
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              paddingRight: '8px',
            }}
          >
            {ghostFragments.map(fragment => (
              <FragmentCard
                key={fragment.id}
                fragment={fragment}
                isGhost={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hovered Fragment Details */}
      {hoveredFragment && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: 'rgba(100, 100, 150, 0.2)',
            border: '2px solid rgba(100, 200, 255, 0.5)',
            borderRadius: '4px',
          }}
        >
          <h4 style={{ marginTop: 0, fontSize: '13px' }}>📍 Fragment Details</h4>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div><strong>ID:</strong> {hoveredFragment.id}</div>
            <div><strong>Description:</strong> {hoveredFragment.description}</div>
            <div><strong>Type:</strong> {hoveredFragment.type}</div>
            <div><strong>Position:</strong> ({hoveredFragment.position.x}, {hoveredFragment.position.y})</div>
            <div><strong>Durability:</strong> {(hoveredFragment.durability * 100).toFixed(1)}%</div>
            <div><strong>Created in Epoch:</strong> {hoveredFragment.epochCreated}</div>
            <div><strong>Status:</strong> ${hoveredFragment.sealed ? '🔒 Canonical (Sealed)' : '⚡ Mutable'}</div>
            {hoveredFragment.lastWeatheredAt && (
              <div><strong>Last Weathered:</strong> Tick {hoveredFragment.lastWeatheredAt}</div>
            )}
            {hoveredFragment.sealTick && (
              <div><strong>Sealed at Tick:</strong> {hoveredFragment.sealTick}</div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '20px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', borderTop: '1px solid rgba(100, 100, 100, 0.3)', paddingTop: '12px' }}>
        {worldInstanceId && <div>World Instance: {worldInstanceId}</div>}
        <div>Last Updated: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
};

export default WorldVisualization;
