/**
 * useSocialScarReactivity.ts - Phase 5 Task 2: Social Scar Dialogue Reactivity
 * 
 * Hook that enables NPCs to perceive and react to player's social scars,
 * creating alternative dialogue branches when NPCs become aware of or triggered by scars.
 * 
 * Integrates with:
 * - npcMemoryEngine: Tracks revealed/active scars
 * - branchingDialogueEngine: Branches dialogue based on scar discovery
 * - worldEngine: Provides globalParadoxAverage for dissonance dialogue
 */

import { useMemo } from 'react';
import type { SocialScar } from '../../engine/npcMemoryEngine';
import type { DialogueNode, DialogueOption, DialogueConsequence } from '../../engine/branchingDialogueEngine';
import type { PlayerState, NPC } from '../../engine/worldEngine';

export interface ScarReactivityContext {
  /** Scars that are currently active/revealed to this NPC */
  activeScarIds: string[];
  
  /** Scars that are dormant but could be triggered */
  dormantScarIds: string[];
  
  /** Current NPC emotional resonance to scars (0-1) */
  scarEmotionalResonance: number;
  
  /** Whether to inject dissonance dialogue (paradox > 50%) */
  injectDissonanceDialogue: boolean;
}

export interface ReactiveDialogueInjection {
  /** Alternative branch to present instead of standard dialogue */
  alternativeNode?: DialogueNode;
  
  /** Additional dialogue options to inject */
  injectedOptions: DialogueOption[];
  
  /** Narrative context explaining the reactivity */
  reactivityNarrative: string;
  
  /** Whether this makes the dialogue irreversible */
  lockDialogueAfter: boolean;
}

/**
 * Check if an NPC has revealed/active social scars from the player
 * @param playerScars - Player's social scars
 * @param npc - The NPC to check scarring against
 * @returns Active + dormant scar IDs that this NPC might know about
 */
function getScarsTriggerableByNpc(playerScars: SocialScar[], npc: NPC): { active: string[]; dormant: string[] } {
  const active: string[] = [];
  const dormant: string[] = [];

  for (const scar of playerScars) {
    // NPC can detect scars caused by them (revealed)
    if (scar.causedByNpcId === npc.id && scar.discoveryStatus !== 'dormant') {
      active.push(scar.id);
    }
    // NPCs with high perception might notice emerging scars
    else if (scar.discoveryStatus === 'emerging' && npc.stats?.cha && npc.stats.cha >= 14) {
      active.push(scar.id);
    }
    // Otherwise, scars remain dormant until discovery event
    else if (scar.discoveryStatus === 'dormant') {
      dormant.push(scar.id);
    }
  }

  return { active, dormant };
}

/**
 * Calculate emotional resonance - how emotionally triggered the NPC is by the scars
 * @param activeScars - Active scars detected by NPC
 * @param npc - The NPC reacting to scars
 * @returns 0-1 resonance value (higher = more emotionally turbulent)
 */
function calculateScarEmotionalResonance(activeScars: SocialScar[], npc: NPC): number {
  if (activeScars.length === 0) return 0;

  // Average severity of active scars
  const avgSeverity = activeScars.reduce((sum, s) => sum + s.severity, 0) / activeScars.length / 100;
  
  // NPC empathy reduces resonance (higher charisma = more socially aware/empathetic)
  const empathyModifier = Math.max(0, 1 - ((npc.stats?.cha ?? 10) - 10) / 20);
  
  // Scars caused by NPC themselves create maximum resonance (guilt/defensiveness)
  const guiltyOfCausing = activeScars.some(s => s.causedByNpcId === npc.id) ? 0.3 : 0;
  
  return Math.min(1, (avgSeverity * empathyModifier) + guiltyOfCausing);
}

/**
 * Generate an alternative dialogue node when NPC detects player's social scar
 * @param originalNode - The dialogue node being presented
 * @param triggeredScars - Scars that triggered this alternative
 * @param npc - The NPC responding
 * @param emotionalResonance - How emotionally activated the NPC is
 * @returns Alternative dialogue node
 */
function generateScarReactiveNode(
  originalNode: DialogueNode,
  triggeredScars: SocialScar[],
  npc: NPC,
  emotionalResonance: number
): DialogueNode {
  // Determine NPC's tone based on emotional resonance and relationship
  const tone = emotionalResonance > 0.7 
    ? 'accusatory' 
    : emotionalResonance > 0.4 
    ? 'confrontational' 
    : 'knowing';
  
  const scarDescriptions = triggeredScars.map(s => s.description).join('; ');
  
  const scarAwareText = {
    accusatory: `I see the damage I've caused you... ${scarDescriptions}. How can you even look at me?`,
    confrontational: `We both know what happened between us. The scars run deep: ${scarDescriptions}.`,
    knowing: `You carry marks from our past. I see: ${scarDescriptions}. Perhaps we can heal this.`
  };

  return {
    ...originalNode,
    id: `${originalNode.id}_scar_reactive`,
    text: scarAwareText[tone as keyof typeof scarAwareText],
    npcState: tone as 'neutral' | 'suspicious' | 'allied' | 'hostile' | 'romantic' | 'patronizing',
    emotionalWeight: Math.min(1, emotionalResonance + 0.2),
    revealsSocialScar: true,
    branchingOptions: [
      ...originalNode.branchingOptions,
      // Add scar-specific dialogue options
      {
        id: `${originalNode.id}_scar_acknowledge`,
        text: 'Yes, I carry these scars. But maybe we can move past this.',
        nextNodeId: `${originalNode.id}_forgiveness_path`,
        skillCheck: {
          skill: 'empathy',
          dc: 12 + (emotionalResonance * 8) // Harder when NPC more triggered
        },
        consequenceAction: {
          type: 'revealSocialScar',
          payload: {
            scarId: triggeredScars[0]?.id || 'unknown',
            npcId: npc.id,
            revealedAt: Date.now(),
            discoveryNarrative: `${npc.name} acknowledged the scars between us.`
          }
        } as DialogueConsequence
      },
      {
        id: `${originalNode.id}_scar_deflect`,
        text: 'Let\'s not dwell on the past. We have bigger problems now.',
        nextNodeId: originalNode.branchingOptions[0]?.nextNodeId,
        skillCheck: {
          skill: 'deception',
          dc: 13 + (emotionalResonance * 6)
        }
      },
      {
        id: `${originalNode.id}_scar_confront`,
        text: 'This is exactly why I don\'t trust you. What you did was inexcusable.',
        nextNodeId: undefined, // Ends dialogue with tension
        consequenceAction: {
          type: 'damageReputation',
          payload: {
            npcId: npc.id,
            factionId: npc.factionId || 'neutral',
            change: -15,
            reason: 'Player directly confronted NPC about social scar'
          }
        } as DialogueConsequence
      }
    ]
  };
}

/**
 * Main hook: Check if player scars should trigger reactive dialogue
 * @param playerState - Current player state
 * @param npc - NPC being talked to
 * @param playerScars - Player's social scars
 * @param globalParadoxAverage - Current world paradox level (0-1)
 * @param originalDialogueNode - The dialogue being presented
 * @returns Reactive dialogue injection (if any) or null
 */
export function useSocialScarReactivity(
  playerState: PlayerState | null,
  npc: NPC | null,
  playerScars: SocialScar[],
  globalParadoxAverage: number,
  originalDialogueNode: DialogueNode | null
): ReactiveDialogueInjection | null {
  return useMemo(() => {
    if (!playerState || !npc || !originalDialogueNode) {
      return null;
    }

    // Get scars that this NPC might detect
    const { active: activeScarIds, dormant: dormantScarIds } = getScarsTriggerableByNpc(playerScars, npc);
    
    if (activeScarIds.length === 0 && dormantScarIds.length === 0) {
      return null; // No applicable scars
    }

    const activeScarObjects = playerScars.filter(s => activeScarIds.includes(s.id));
    const emotionalResonance = calculateScarEmotionalResonance(activeScarObjects, npc);
    
    // If emotional resonance is too low, NPC doesn't react
    if (emotionalResonance < 0.3 && activeScarObjects.length < 2) {
      return null;
    }

    // Generate reactive alternative node
    const alternativeNode = generateScarReactiveNode(
      originalDialogueNode,
      activeScarObjects,
      npc,
      emotionalResonance
    );

    // Determine if dissonance should be injected (high paradox makes scars trigger more easily)
    const injectDissonanceDialogue = globalParadoxAverage > 0.5;

    return {
      alternativeNode,
      injectedOptions: alternativeNode.branchingOptions.filter(
        opt => opt.id.includes('scar_')
      ),
      reactivityNarrative: `${npc.name} perceives your scars and reacts with emotional resonance: ${Math.round(emotionalResonance * 100)}%${injectDissonanceDialogue ? ' (paradox amplifies reaction)' : ''}`,
      lockDialogueAfter: emotionalResonance > 0.75 // High emotion locks dialogue path
    };
  }, [playerState, npc, playerScars, globalParadoxAverage, originalDialogueNode]);
}

/**
 * Hook to track which scars have been discovered during a dialogue session
 * @param playerScars - Current scars
 * @returns IDs of scars revealed this session
 */
export function useSessionScarDiscoveries(playerScars: SocialScar[]): Set<string> {
  return useMemo(() => {
    const discovered = new Set<string>();
    
    for (const scar of playerScars) {
      if (scar.discoveryStatus === 'active' || scar.discoveryStatus === 'processing') {
        discovered.add(scar.id);
      }
    }
    
    return discovered;
  }, [playerScars]);
}
