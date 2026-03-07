/**
 * AncestralTapestry.tsx
 * 
 * Phase 47: World-Aware Passive Skill Tree UI
 * Displays branching ancestry trees with codec-specific aesthetics.
 * 
 * Features:
 * - SVG-based node graph with smooth connections
 * - Interactive nodes (hover for details, click to unlock)
 * - Codec-specific visual themes (fantasy=golden roots, cyberpunk=cyan data, etc.)
 * - 3D translateZ perspective matching WorkstationOverlay from Phase 46
 * - CSS animations for smooth transitions
 * - Cost/requirement validation with visual lock states
 */

import React, { useMemo, useState } from 'react';
import type { PlayerState, AncestryTree, AncestryNode } from '../../engine/worldEngine';
import {
  getAncestryNode,
  validateNodeUnlock,
  unlockAncestryNode,
  getAvailableNodes,
  getLockedNodes,
} from '../../engine/ancestryRegistry';
import styles from './AncestralTapestry.module.css';

interface AncestralTapestryProps {
  player: PlayerState;
  tree: AncestryTree;
  onNodeUnlock?: (nodeId: string, success: boolean) => void;
  isOpen?: boolean;
  codec?: string; // e.g., 'CODENAME_MEDIEVAL', 'CODENAME_CYBERPUNK'
}

/**
 * Position calculations for tree layout
 * Arranges nodes in tiers for visual clarity
 */
function calculateNodePositions(tree: AncestryTree): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const visited = new Set<string>();
  const tierMap: Record<number, string[]> = {};

  // Depth-first traversal to assign tiers
  function assignTiers(nodeId: string, tier: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    if (!tierMap[tier]) tierMap[tier] = [];
    tierMap[tier].push(nodeId);

    const node = getAncestryNode(tree, nodeId);
    if (node?.unlocks) {
      for (const unlockedId of node.unlocks) {
        assignTiers(unlockedId, tier + 1);
      }
    }
  }

  // Start from root
  assignTiers(tree.rootNodeId, 0);

  // Convert tiers to positions
  let yOffset = 0;
  for (const [tier, nodeIds] of Object.entries(tierMap)) {
    const tierNum = parseInt(tier);
    const nodeCount = nodeIds.length;
    const startX = 50 + tierNum * 200; // Progressive horizontal offset

    for (let i = 0; i < nodeCount; i++) {
      const nodeId = nodeIds[i];
      const ySpacing = 800 / Math.max(nodeCount, 2); // Vertical spacing
      const yPos = 100 + i * ySpacing;

      positions[nodeId] = { x: startX, y: yPos };
    }
  }

  return positions;
}

/**
 * SVG connector line between two nodes
 */
function ConnectorLine({
  x1,
  y1,
  x2,
  y2,
  isActive,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isActive: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className={`${styles.connector} ${isActive ? styles.connectorActive : ''}`}
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * Individual ancestry node component
 */
function AncestryNodeComponent({
  node,
  position,
  isUnlocked,
  isAvailable,
  isLocked,
  player,
  tree,
  codec,
  onUnlock,
}: {
  node: AncestryNode;
  position: { x: number; y: number };
  isUnlocked: boolean;
  isAvailable: boolean;
  isLocked: boolean;
  player: PlayerState;
  tree: AncestryTree;
  codec?: string;
  onUnlock: (nodeId: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleNode = async () => {
    if (isUnlocked || isProcessing) return;

    if (isAvailable) {
      setIsProcessing(true);
      const result = unlockAncestryNode(player, tree, node.id);
      onUnlock(node.id);
      setIsProcessing(false);
    } else {
      setShowDetails(true);
    }
  };

  // Determine node appearance based on codec
  const getNodeColor = () => {
    if (isUnlocked) {
      if (codec?.includes('CYBERPUNK')) return '#00FF88'; // Cyan for cyberpunk
      return '#FFD700'; // Golden for fantasy
    }
    if (isAvailable) {
      if (codec?.includes('CYBERPUNK')) return '#00CCFF';
      return '#FFA500'; // Orange for purchasable
    }
    if (codec?.includes('CYBERPUNK')) return '#333366';
    return '#8B7355'; // Brown/bronze for locked
  };

  const nodeColor = getNodeColor();
  const aestheticColor = node.aesthetics?.color || nodeColor;
  const radius = isHovering && !isUnlocked && isAvailable ? 38 : 30;

  return (
    <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
      {/* Node circle */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill={isUnlocked ? aestheticColor : nodeColor}
        stroke={showDetails ? '#FFFFFF' : aestheticColor}
        strokeWidth={showDetails ? 3 : 2}
        className={styles.node}
        style={{
          cursor: isUnlocked ? 'default' : isAvailable ? 'pointer' : 'not-allowed',
          opacity: isUnlocked ? 1 : isAvailable ? 0.8 : 0.5,
          transition: 'r 0.2s ease, stroke-width 0.2s ease',
          filter: isUnlocked ? `drop-shadow(0 0 10px ${aestheticColor})` : `drop-shadow(0 0 5px ${nodeColor})`,
        }}
        onMouseEnter={() => {
          setShowDetails(true);
          setIsHovering(true);
        }}
        onMouseLeave={() => {
          setShowDetails(false);
          setIsHovering(false);
        }}
        onClick={handleNode}
      />

      {/* Node icon/tier indicator */}
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dy="0.35em"
        className={styles.nodeIcon}
        fontSize="24"
        pointerEvents="none"
      >
        {node.aesthetics?.icon || '✦'}
      </text>

      {/* Lock indicator for locked nodes */}
      {isLocked && (
        <circle
          cx="0"
          cy="0"
          r="30"
          fill="none"
          stroke="rgba(200, 0, 0, 0.6)"
          strokeWidth="1"
          strokeDasharray="5,5"
        />
      )}

      {/* Detail tooltip on hover */}
      {showDetails && (
        <g style={{ opacity: 1, transition: 'opacity 0.2s ease' }}>
          <rect
            x="-80"
            y="-120"
            width="160"
            height="110"
            fill="rgba(20, 20, 40, 0.95)"
            rx="8"
            stroke={aestheticColor}
            strokeWidth="1"
          />
          <text
            x="0"
            y="-100"
            textAnchor="middle"
            className={styles.tooltipTitle}
            fontSize="12"
            fontWeight="bold"
            fill={aestheticColor}
          >
            {node.name}
          </text>
          <text
            x="-75"
            y="-80"
            className={styles.tooltipText}
            fontSize="10"
            fill="#CCCCCC"
          >
            {node.description.length > 50 ? node.description.substring(0, 47) + '...' : node.description}
          </text>
          <text
            x="-75"
            y="-55"
            className={styles.tooltipText}
            fontSize="9"
            fill="#FFAA00"
          >
            Cost: {node.cost} XP
          </text>
          {isAvailable && (
            <text
              x="-75"
              y="-40"
              className={styles.tooltipText}
              fontSize="9"
              fill="#00FF00"
            >
              Click to unlock
            </text>
          )}
          {!isAvailable && !isUnlocked && (
            <text
              x="-75"
              y="-40"
              className={styles.tooltipText}
              fontSize="9"
              fill="#FF6666"
            >
              Locked
            </text>
          )}
        </g>
      )}
    </g>
  );
}

/**
 * Main AncestralTapestry component
 */
export const AncestralTapestry: React.FC<AncestralTapestryProps> = ({
  player,
  tree,
  onNodeUnlock,
  isOpen = true,
  codec = 'CODENAME_MEDIEVAL',
}) => {
  const positions = useMemo(() => calculateNodePositions(tree), [tree]);
  const availableNodes = useMemo(() => getAvailableNodes(player, tree), [player, tree]);
  const lockedNodes = useMemo(() => getLockedNodes(player, tree), [player, tree]);
  const unlockedSet = new Set(player.ancestryNodes || []);

  const handleUnlock = (nodeId: string) => {
    onNodeUnlock?.(nodeId, unlockedSet.has(nodeId));
  };

  // Calculate SVG dimensions
  const maxX = Math.max(...Object.values(positions).map(p => p.x)) + 60;
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + 60;

  const isCyberpunk = codec?.includes('CYBERPUNK');

  return (
    <div
      className={`${styles.container} ${isCyberpunk ? styles.cyberpunkTheme : styles.fantasyTheme}`}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
        transform: 'translateZ(50px)',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Title */}
      <div className={styles.header}>
        <h2 className={styles.title}>{tree.name}</h2>
        <p className={styles.subtitle}>Ancestral Bloodline</p>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{
            width: `${((player.ancestryNodes?.length || 0) / tree.nodes.length) * 100}%`,
          }}
        />
        <span className={styles.progressText}>
          {player.ancestryNodes?.length || 0} / {tree.nodes.length} nodes unlocked
        </span>
      </div>

      {/* SVG Tree */}
      <div className={styles.treeContainer}>
        <svg viewBox={`0 0 ${maxX} ${maxY}`} className={styles.treeSvg}>
          <defs>
            <filter id="glow-fantasy" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-cyberpunk" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Draw connector lines first (behind nodes) */}
          {tree.nodes.map(node => {
            if (!node.unlocks) return null;
            return node.unlocks.map(unlockedId => {
              const parentPos = positions[node.id];
              const childPos = positions[unlockedId];
              if (!parentPos || !childPos) return null;

              const isActive = unlockedSet.has(node.id);

              return (
                <ConnectorLine
                  key={`${node.id}-${unlockedId}`}
                  x1={parentPos.x}
                  y1={parentPos.y}
                  x2={childPos.x}
                  y2={childPos.y}
                  isActive={isActive}
                />
              );
            });
          })}

          {/* Draw nodes */}
          {tree.nodes.map(node => {
            const isUnlocked = unlockedSet.has(node.id);
            const isAvailable = availableNodes.some(n => n.id === node.id);
            const isLocked = lockedNodes.some(n => n.id === node.id);
            const pos = positions[node.id];

            if (!pos) return null;

            return (
              <AncestryNodeComponent
                key={node.id}
                node={node}
                position={pos}
                isUnlocked={isUnlocked}
                isAvailable={isAvailable}
                isLocked={isLocked}
                player={player}
                tree={tree}
                codec={codec}
                onUnlock={handleUnlock}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot}`} style={{ backgroundColor: '#FFD700' }} />
          <span>Unlocked</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot}`} style={{ backgroundColor: '#FFA500' }} />
          <span>Available</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot}`} style={{ backgroundColor: '#8B7355' }} />
          <span>Locked</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className={styles.statsSummary}>{tree.description}</div>
    </div>
  );
};

export default AncestralTapestry;
