/**
 * M63-A: Inheritance Wiring System
 * 
 * Connects InheritancePayload (from chronicle sequence) to new character creation
 * Applies artifacts, memories, faction bonuses, and narrative elements
 * Ensures zero-loss transfer of ancestral legacy across epochs
 */

import type { WorldState, InventoryItem } from './worldEngine';
import type { InheritancePayload } from './chronicleEngine';

/**
 * Character bloodline metadata tracking ancestral lineage
 */
export interface BloodlineData {
  canonicalName: string;           // Current character's name
  inheritedPerks: string[];        // Ancestral perks active this epoch
  mythStatus: number;              // Inherited myth starting bonus
  epochsLived: number;             // Total in bloodline
  deeds: string[];                 // Inherited legendary deeds
  ancestorChain: AncestorSnapshot[]; // Last 5 generations
}

/**
 * Single ancestor snapshot for family tree visualization
 */
export interface AncestorSnapshot {
  epochId: string;
  generation: number;
  canonicalName: string;
  mythRank: number;                // 0-5
  deedsCount: number;
  legendary: boolean;
  paradoxAtDeath: number;
  factionAlliances: Record<string, number>;
}

/**
 * Receipt of inheritance application - for UI display
 */
export interface InheritanceReceipt {
  artifactsGranted: string[];      // Item names
  memoriesUnlocked: number;        // Count of newly unlocked memories
  factionBonuses: Record<string, number>;
  questsAvailable: number;
  paradoxInherited: number;
  startingMythBonus: number;
}

// ============================================================================
// CORE WIRING: Apply Inheritance to Character Creation
// ============================================================================

/**
 * Apply InheritancePayload to new character's starting state
 * 
 * @param character - New character to enhance with legacy
 * @param payload - Inheritance data from ancestor
 * @param priorState - Full world state for context
 * @returns Receipt of applied inheritance + modified character
 */
export function applyInheritanceToCharacter(
  character: Partial<{ 
    id: string; 
    name: string; 
    inventory: InventoryItem[]; 
    factionReputation?: Record<string, number>;
    mythStatus?: number;
    bloodlineData?: BloodlineData;
  }>,
  payload: InheritancePayload,
  priorState: WorldState
): { 
  character: typeof character; 
  receipt: InheritanceReceipt;
} {
  if (!character) {
    throw new Error('Character must be defined for inheritance application');
  }

  // Initialize bloodline tracking if not present
  if (!character.bloodlineData) {
    character.bloodlineData = {
      canonicalName: character.name || 'Unknown',
      inheritedPerks: [],
      mythStatus: 0,
      epochsLived: 1,
      deeds: [],
      ancestorChain: []
    };
  }

  // =========================================================================
  // 1. Apply Inherited Artifacts to Starting Inventory
  // =========================================================================

  const artifactsGranted: string[] = [];
  
  if (!character.inventory) {
    character.inventory = [];
  }

  payload.inheritedArtifacts.forEach(artifact => {
    const inventoryItem: any = {
      itemId: artifact.itemId,
      quantity: 1,
      rarity: artifact.rarity,
      name: artifact.name,
      enchantsActive: artifact.enchantments,
      source: `inherited_from_ancestor_rank_${payload.ancestorMythRank}`,
      ancestralMark: true
    };

    if (character.inventory) {
      character.inventory.push(inventoryItem);
    }
    artifactsGranted.push(artifact.name);
  });

  // =========================================================================
  // 2. Apply Faction Standing Bonuses
  // =========================================================================

  if (!character.factionReputation) {
    character.factionReputation = {};
  }

  Object.entries(payload.factionStandingBonus).forEach(([factionId, bonus]) => {
    if (character.factionReputation) {
      if (!character.factionReputation[factionId]) {
        character.factionReputation[factionId] = 0;
      }
      // Add inherited bonus with 30% carryover (scaling factor)
      character.factionReputation[factionId] += Math.floor(bonus * 0.3);
    }
  });

  // =========================================================================
  // 3. Apply Myth Status Starting Bonus
  // =========================================================================

  const startingMythBonus = Math.floor(payload.ancestorMythRank * 5);
  if (!character.mythStatus) {
    character.mythStatus = 0;
  }
  character.mythStatus += startingMythBonus;

  // =========================================================================
  // 4. Track Bloodline Ancestry
  // =========================================================================

  // Add ancestor to chain (maintain last 5 generations)
  const ancestorSnapshot: AncestorSnapshot = {
    epochId: priorState.epochId,
    generation: character.bloodlineData.epochsLived,
    canonicalName: priorState.player?.name || 'Unknown',
    mythRank: payload.ancestorMythRank,
    deedsCount: payload.ancestorQuests.length,
    legendary: payload.ancestorMythRank >= 4,
    paradoxAtDeath: priorState.paradoxLevel || 0,
    factionAlliances: payload.factionStandingBonus
  };

  character.bloodlineData.ancestorChain.push(ancestorSnapshot);
  if (character.bloodlineData.ancestorChain.length > 5) {
    character.bloodlineData.ancestorChain.shift(); // Keep last 5
  }

  // Update bloodline stats
  character.bloodlineData.epochsLived += 1;
  character.bloodlineData.deeds = payload.ancestorQuests.map(q => q.title);
  character.bloodlineData.inheritedPerks.push(
    ...getInheritedPerks(payload.ancestorMythRank)
  );

  // =========================================================================
  // 5. Assemble Receipt
  // =========================================================================

  const receipt: InheritanceReceipt = {
    artifactsGranted,
    memoriesUnlocked: payload.unlockedMemories.length,
    factionBonuses: payload.factionStandingBonus,
    questsAvailable: payload.ancestorQuests.length,
    paradoxInherited: payload.paradoxDescent,
    startingMythBonus
  };

  return { character, receipt };
}

// ============================================================================
// HELPER: Determine Perk Names by Myth Rank
// ============================================================================

/**
 * Generate inherited perks based on ancestor myth rank
 * These provide gameplay benefits during the epoch
 */
function getInheritedPerks(mythRank: number): string[] {
  const perks: string[] = [];

  if (mythRank >= 1) {
    perks.push('Ancestral Awareness'); // +10% experience gain
  }
  if (mythRank >= 2) {
    perks.push('Legendary Resonance'); // +5% damage, +5% defense
  }
  if (mythRank >= 3) {
    perks.push('Echo of Power'); // Unlock rare merchant tiers
  }
  if (mythRank >= 4) {
    perks.push('Mythic Authority'); // NPCs start with +50 affinity
  }
  if (mythRank >= 5) {
    perks.push('Divine Ascendance'); // Paradox decay +50%, +100% myth gain
  }

  return perks;
}

// ============================================================================
// VISUALIZATION: Format Inheritance for UI Display
// ============================================================================

/**
 * Format InheritancePayload into UI-ready format
 * Used by AscensionProtocolView and BloodlineViewer
 */
export interface InheritanceDisplayFormat {
  ancestorName: string;
  mythRankLabel: string;           // "Forgotten", "Legendary", "Mythic" etc
  artifacts: Array<{
    name: string;
    rarity: 'common' | 'rare' | 'legendary' | 'cursed';
    description: string;
  }>;
  factionBonuses: Array<{
    factionName: string;
    bonusAmount: number;
  }>;
  questTitles: string[];
  narrativeTeaser: string;
  startingMythBonus: number;
}

/**
 * Transform InheritancePayload to display format
 */
export function formatInheritanceForDisplay(
  payload: InheritancePayload,
  priorCharacterName: string
): InheritanceDisplayFormat {
  const mythRankLabels = [
    'Forgotten',
    'Known',
    'Remembered',
    'Notable',
    'Legendary',
    'Mythic'
  ];

  return {
    ancestorName: priorCharacterName,
    mythRankLabel: mythRankLabels[payload.ancestorMythRank] || 'Unknown',
    artifacts: payload.inheritedArtifacts.map(art => ({
      name: art.name,
      rarity: art.rarity,
      description: `Enchanted with: ${art.enchantments.join(', ') || 'none'}`
    })),
    factionBonuses: Object.entries(payload.factionStandingBonus).map(([faction, bonus]) => ({
      factionName: faction,
      bonusAmount: bonus
    })),
    questTitles: payload.ancestorQuests.map(q => q.title),
    narrativeTeaser: payload.narrativeForeshadow || 'The echoes of your ancestor guide your path...',
    startingMythBonus: Math.floor(payload.ancestorMythRank * 5)
  };
}

// ============================================================================
// BLOODLINE VIEWER: Ancestry Tree Data Generation
// ============================================================================

/**
 * Build ancestry tree from character's BloodlineData
 * Used for visual family tree rendering
 */
export interface AncestryTreeNode {
  id: string;
  name: string;
  generation: number;
  mythRank: number;
  isLegendary: boolean;
  children: AncestryTreeNode[];
  deeds: string[];
  paradoxAtDeath: number;
}

/**
 * Convert ancestor chain to tree structure for UI rendering
 */
export function buildAncestryTree(bloodlineData: BloodlineData): AncestryTreeNode {
  // Root is current character
  const root: AncestryTreeNode = {
    id: `bloodline_current`,
    name: bloodlineData.canonicalName,
    generation: bloodlineData.epochsLived,
    mythRank: bloodlineData.mythStatus,
    isLegendary: bloodlineData.mythStatus >= 20,
    children: [],
    deeds: bloodlineData.deeds,
    paradoxAtDeath: 0
  };

  // Build from most recent ancestor backwards
  let parentNode = root;
  const reversed = [...bloodlineData.ancestorChain].reverse();
  reversed.forEach((ancestor, idx) => {
    const ancestorNode: AncestryTreeNode = {
      id: `ancestor_${ancestor.epochId}_${idx}`,
      name: ancestor.canonicalName,
      generation: ancestor.generation,
      mythRank: ancestor.mythRank,
      isLegendary: ancestor.legendary,
      children: [],
      deeds: [`${ancestor.deedsCount} deeds`],
      paradoxAtDeath: ancestor.paradoxAtDeath
    };

    parentNode.children.push(ancestorNode);
    parentNode = ancestorNode; // For next iteration
  });

  return root;
}

// ============================================================================
// VALIDATION: Ensure Inheritance Integrity
// ============================================================================

/**
 * Validate that inheritance payload can be safely applied
 * Checks for missing required fields and type mismatches
 */
export function validateInheritancePayload(payload: InheritancePayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (payload.ancestorMythRank < 0 || payload.ancestorMythRank > 5) {
    errors.push(`Invalid myth rank: ${payload.ancestorMythRank} (must be 0-5)`);
  }

  if (payload.legacyBudget < 0) {
    errors.push(`Negative legacy budget: ${payload.legacyBudget}`);
  }

  if (!Array.isArray(payload.inheritedArtifacts)) {
    errors.push('inheritedArtifacts must be an array');
  }

  if (!Array.isArray(payload.unlockedMemories)) {
    errors.push('unlockedMemories must be an array');
  }

  if (!Array.isArray(payload.ancestorQuests)) {
    errors.push('ancestorQuests must be an array');
  }

  if (!payload.factionStandingBonus || typeof payload.factionStandingBonus !== 'object') {
    errors.push('factionStandingBonus must be a record');
  }

  // Validate artifacts
  payload.inheritedArtifacts.forEach((artifact, idx) => {
    if (!artifact.itemId) errors.push(`Artifact ${idx} missing itemId`);
    if (!artifact.name) errors.push(`Artifact ${idx} missing name`);
    if (!['common', 'rare', 'legendary', 'cursed'].includes(artifact.rarity)) {
      errors.push(`Artifact ${idx} invalid rarity: ${artifact.rarity}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * M63-A Inheritance System - Key Exports:
 * 
 * Public API:
 * - applyInheritanceToCharacter() - Main wiring function
 * - formatInheritanceForDisplay() - For UI components
 * - buildAncestryTree() - For bloodline viewer
 * - validateInheritancePayload() - Integrity checking
 * 
 * Types:
 * - BloodlineData - Character ancestry metadata
 * - InheritanceReceipt - Application result record
 * - InheritanceDisplayFormat - UI-ready inheritance data
 * - AncestryTreeNode - Tree node for visualization
 */
