/**
 * useDialogueResolver Hook - Phase 9: Universal Dialogue Resolver
 * 
 * Integrates the branchingDialogueEngine into React components for type-safe,
 * player-state-aware dialogue filtering and resolution.
 * 
 * Usage:
 *   const resolution = useDialogueResolver(dialogueNode, player, npc, worldState);
 *   resolution.accessibleOptions // Filtered options only player can see
 *   resolution.lockedOptions     // Options player cannot access yet
 */

import { useMemo } from 'react';
import { BranchingDialogueEngine, type DialogueNode, type DialogueOption, type DialogueResolution } from '../../engine/branchingDialogueEngine';
import type { PlayerState, NPC, WorldState } from '../../engine/worldEngine';

export interface FilteredDialogueResolution extends DialogueResolution {
  lockedOptions: Array<{
    option: DialogueOption;
    lockReason: 'knowledge' | 'reputation' | 'alignment' | 'stamina' | 'unknown';
    lockMessage: string;
  }>;
}

/**
 * React hook for resolving and filtering dialogue options based on player state
 * 
 * Returns both accessible and locked options, allowing UI to show:
 * - Available options in full detail
 * - Locked options with lock indicators and hints
 */
export function useDialogueResolver(
  dialogueNode: DialogueNode | null,
  player: PlayerState | null,
  npc: NPC | null,
  worldState: WorldState | null
): FilteredDialogueResolution | null {
  return useMemo(() => {
    if (!dialogueNode || !player || !npc || !worldState) {
      return null;
    }

    // Resolve dialogue using engine
    const resolution = BranchingDialogueEngine.resolveDialogueBranch(
      dialogueNode,
      player,
      npc,
      worldState
    );

    // Determine which options are locked and why
    const lockedOptions: FilteredDialogueResolution['lockedOptions'] = [];

    for (const option of dialogueNode.branchingOptions) {
      // Skip if already accessible
      if (resolution.accessibleOptions.some(opt => opt.id === option.id)) {
        continue;
      }

      // Determine lock reason
      let lockReason: 'knowledge' | 'reputation' | 'alignment' | 'stamina' | 'unknown' = 'unknown';
      let lockMessage = 'Option locked';

      // Check knowledge gate
      if (option.requiresKnowledge && option.requiresKnowledge.length > 0) {
        const playerKnowledge = extractPlayerKnowledge(player);
        const missingKnowledge = option.requiresKnowledge.filter(tag => !playerKnowledge.has(tag));
        
        if (missingKnowledge.length > 0) {
          lockReason = 'knowledge';
          lockMessage = `Discover: ${missingKnowledge.join(', ')}`;
        }
      }

      // Check reputation gate
      if (lockReason === 'unknown' && option.requiresReputation && option.requiresReputation.length > 0) {
        for (const repReq of option.requiresReputation) {
          const playerRep = player.factionReputation?.[repReq.factionId] ?? 0;
          if (playerRep < repReq.minValue) {
            lockReason = 'reputation';
            lockMessage = `Needs ${repReq.factionId} reputation (${playerRep}/${repReq.minValue})`;
            break;
          }
        }
      }

      // Check alignment
      if (lockReason === 'unknown' && option.requiresAlignmentStatus) {
        if (!checkAlignmentStatus(player, option.requiresAlignmentStatus)) {
          lockReason = 'alignment';
          lockMessage = `Requires: ${option.requiresAlignmentStatus}`;
        }
      }

      lockedOptions.push({
        option,
        lockReason,
        lockMessage
      });
    }

    return {
      ...resolution,
      lockedOptions
    };
  }, [dialogueNode, player, npc, worldState]);
}

/**
 * Extract player knowledge base as a Set for efficient lookup
 */
function extractPlayerKnowledge(player: PlayerState): Set<string> {
  const knowledge = new Set<string>();

  if (!player.knowledgeBase) return knowledge;

  // Handle both Map and Array formats
  if (player.knowledgeBase instanceof Map) {
    for (const key of player.knowledgeBase.keys()) {
      knowledge.add(key);
    }
  } else if (Array.isArray(player.knowledgeBase)) {
    for (const entry of player.knowledgeBase) {
      if (typeof entry === 'string') {
        knowledge.add(entry);
      } else if (typeof entry === 'object' && 'tag' in entry) {
        knowledge.add((entry as any).tag);
      }
    }
  }

  return knowledge;
}

/**
 * Check if player has required alignment status
 */
function checkAlignmentStatus(player: PlayerState, status: string): boolean {
  switch (status) {
    case 'bloodline-heir':
      // Check if player has bloodline data indicating heir status
      return (player.bloodlineData as any)?.isHeir === true || (player.bloodlineData as any)?.status === 'heir';
    case 'morph-diverse':
      // Check if player has any morph-related characteristics
      return (player as any).soulStrain > 0 || (player as any).currentRace !== undefined;
    case 'resonance-active':
      // Check if player has active soul resonance
      return (player.soulResonanceLevel ?? 0) > 0;
    case 'temporal-accrued':
      // Check if player has accumulated age rot
      return (player as any).ageRotSeverity !== undefined && (player as any).ageRotSeverity !== 'none';
    default:
      return false;
  }
}

/**
 * Get a human-readable lock message for UI display
 */
export function getLockedOptionDisplay(lockReason: string, lockMessage: string): { icon: string; text: string; color: string } {
  switch (lockReason) {
    case 'knowledge':
      return {
        icon: '🔍',
        text: lockMessage,
        color: '#4488ff'
      };
    case 'reputation':
      return {
        icon: '👑',
        text: lockMessage,
        color: '#ffaa44'
      };
    case 'alignment':
      return {
        icon: '✨',
        text: lockMessage,
        color: '#ff44ff'
      };
    case 'stamina':
      return {
        icon: '💨',
        text: lockMessage,
        color: '#ff4444'
      };
    default:
      return {
        icon: '🔒',
        text: 'Locked',
        color: '#888888'
      };
  }
}
