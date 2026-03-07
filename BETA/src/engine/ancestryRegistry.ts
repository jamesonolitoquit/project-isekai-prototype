/**
 * ancestryRegistry.ts
 * 
 * Phase 47: Ancestral Tapestry - World-Aware Passive Skill Trees
 * Manages context-dependent passive trees where race (constant) but content varies by WorldTemplate/codec.
 * 
 * Example: Elf in Fantasy has "Ley-Weaver" tree (+Mana nodes)
 *          Elf in Cyberpunk has "Data-Link" tree (+Network nodes)
 * 
 * Core Pattern:
 * - AncestryNode: Single passive ability node (cost, requirements, modifiers)
 * - AncestryTree: Collection of nodes for a race in a specific template
 * - Provides functions for tree lookup, validation, and modifier injection
 */

import type { PlayerState, AncestryTree, AncestryNode, AncestryModifier, WorldTemplate } from './worldEngine';

// Re-export types from worldEngine for convenience
export type { AncestryTree, AncestryNode, AncestryModifier };

/**
 * Returns the ancestry tree for a given race in a specific world template
 * Returns null if template lacks ancestry data or race not found
 */
export function getAncestryTree(template: WorldTemplate | undefined, race: string | undefined): AncestryTree | null {
  if (!template?.ancestryTrees || !race) {
    return null;
  }

  const matchingTree = template.ancestryTrees.find(
    tree => tree.race.toLowerCase() === race.toLowerCase()
  );

  return matchingTree || null;
}

/**
 * Returns a single node from a tree by ID
 */
export function getAncestryNode(tree: AncestryTree, nodeId: string): AncestryNode | null {
  return tree.nodes.find(node => node.id === nodeId) || null;
}

/**
 * Validates whether a player meets all requirements to unlock a specific node
 */
export function validateNodeUnlock(
  player: PlayerState,
  tree: AncestryTree,
  nodeId: string
): { valid: boolean; reason?: string } {
  const node = getAncestryNode(tree, nodeId);
  if (!node) {
    return { valid: false, reason: `Node ${nodeId} not found in tree` };
  }

  // Check if already unlocked
  if (player.ancestryNodes?.includes(nodeId)) {
    return { valid: false, reason: 'Node already unlocked' };
  }

  // Check level requirement
  if (node.requirements.minimumLevel && (player.level || 0) < node.requirements.minimumLevel) {
    return {
      valid: false,
      reason: `Requires level ${node.requirements.minimumLevel} (you are ${player.level || 1})`,
    };
  }

  // Check prerequisite nodes
  if (node.requirements.prerequisiteNodeIds) {
    for (const prereq of node.requirements.prerequisiteNodeIds) {
      if (!player.ancestryNodes?.includes(prereq)) {
        const prereqNode = getAncestryNode(tree, prereq);
        return {
          valid: false,
          reason: `Requires unlocking "${prereqNode?.name || prereq}" first`,
        };
      }
    }
  }

  // Check proficiency requirements
  if (node.requirements.minimumProficiency) {
    for (const profReq of node.requirements.minimumProficiency) {
      const profData = player.proficiencies?.[profReq.proficiencyName];
      const profLevel = profData?.level || 0;

      if (profLevel < profReq.level) {
        return {
          valid: false,
          reason: `Requires ${profReq.proficiencyName} level ${profReq.level} (you have ${profLevel})`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Attempts to unlock a node for the player.
 * Deducts XP cost and adds node ID to ancestryNodes array.
 * Returns success/failure with reason.
 */
export function unlockAncestryNode(
  player: PlayerState,
  tree: AncestryTree,
  nodeId: string
): { success: boolean; reason?: string } {
  const validation = validateNodeUnlock(player, tree, nodeId);
  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  const node = getAncestryNode(tree, nodeId)!;

  // Check if player has enough XP
  const totalXp = Object.values(player.proficiencies || {}).reduce((sum, prof) => sum + (prof.xp || 0), 0);
  if (totalXp < node.cost) {
    return { success: false, reason: `Insufficient XP (need ${node.cost}, have ${totalXp})` };
  }

  // Initialize ancestryNodes if needed
  if (!player.ancestryNodes) {
    player.ancestryNodes = [];
  }

  // Add node to unlocked list
  player.ancestryNodes.push(nodeId);

  return { success: true };
}

/**
 * Calculates and returns all active modifiers from unlocked ancestry nodes
 * Sums all modifier values from nodes in the ancestryNodes array
 */
export function getActiveAncestryModifiers(
  player: PlayerState,
  tree: AncestryTree
): Record<string, number> {
  const modifiers: Record<string, number> = {};

  if (!player.ancestryNodes || player.ancestryNodes.length === 0) {
    return modifiers;
  }

  for (const nodeId of player.ancestryNodes) {
    const node = getAncestryNode(tree, nodeId);
    if (!node) continue;

    for (const mod of node.modifiers) {
      modifiers[mod.statName] = (modifiers[mod.statName] || 0) + mod.value;
    }
  }

  return modifiers;
}

/**
 * Applies all active ancestry modifiers to a player's stats
 * Typically called during stat calculation phase
 */
export function applyAncestryModifiers(
  player: PlayerState,
  stats: Record<string, number>,
  tree: AncestryTree
): Record<string, number> {
  const modifiers = getActiveAncestryModifiers(player, tree);

  const result = { ...stats };
  for (const [statName, delta] of Object.entries(modifiers)) {
    result[statName] = (result[statName] || 0) + delta;
  }

  return result;
}

/**
 * Returns all nodes that are currently available (not yet unlocked, requirements met)
 * Useful for UI to show purchasable nodes
 */
export function getAvailableNodes(player: PlayerState, tree: AncestryTree): AncestryNode[] {
  return tree.nodes.filter(node => {
    // Already unlocked
    if (player.ancestryNodes?.includes(node.id)) {
      return false;
    }

    // Check all requirements to see if this node can be unlocked
    const validation = validateNodeUnlock(player, tree, node.id);
    return validation.valid;
  });
}

/**
 * Returns all nodes that have unmet requirements (locked but not unlocked yet)
 */
export function getLockedNodes(player: PlayerState, tree: AncestryTree): AncestryNode[] {
  return tree.nodes.filter(node => {
    // Already unlocked
    if (player.ancestryNodes?.includes(node.id)) {
      return false;
    }

    // Check if requirements are NOT met
    const validation = validateNodeUnlock(player, tree, node.id);
    return !validation.valid;
  });
}

/**
 * Returns analytics about the player's ancestry progress
 */
export function getAncestryProgress(player: PlayerState, tree: AncestryTree) {
  const totalNodes = tree.nodes.length;
  const unlockedCount = player.ancestryNodes?.length || 0;
  const availableCount = getAvailableNodes(player, tree).length;
  const lockedCount = getLockedNodes(player, tree).length;

  return {
    totalNodes,
    unlockedCount,
    percentComplete: totalNodes > 0 ? Math.round((unlockedCount / totalNodes) * 100) : 0,
    availableCount,
    lockedCount,
  };
}

/**
 * Calculate total stats with ancestry modifiers applied
 * Merges base stats with all modifier values from unlocked nodes
 */
export function calculateTotalStats(
  player: PlayerState,
  baseStats: Record<string, number>,
  tree?: AncestryTree
): Record<string, number> {
  if (!tree) {
    return { ...baseStats };
  }

  const modifiers = getActiveAncestryModifiers(player, tree);
  const result = { ...baseStats };

  for (const [statName, delta] of Object.entries(modifiers)) {
    result[statName] = (result[statName] || 0) + delta;
  }

  return result;
}

/**
 * Get XP multiplier from ancestry modifiers (e.g., xpMultiplier: 0.1 = 10% bonus)
 * Returns the total XP multiplier as a decimal (1.0 = baseline, 1.15 = +15%)
 */
export function getAncestryXpMultiplier(player: PlayerState, tree?: AncestryTree): number {
  if (!tree) {
    return 1.0;
  }

  const modifiers = getActiveAncestryModifiers(player, tree);
  const xpBonus = modifiers['xpMultiplier'] || 0;
  
  // xpMultiplier is stored as a decimal (0.1 = 10%), so add it to baseline 1.0
  return 1.0 + xpBonus;
}
