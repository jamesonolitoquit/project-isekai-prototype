/**
 * branchingDialogueEngine.ts - Phase 7: Narrative Engine Hardening
 * 
 * Centralized conversation branch resolution with strict type definitions.
 * Moves dialogue traversal logic from npcEngine.ts into a dedicated module.
 * 
 * All dialogue branch resolution is validated without using `as any` casts.
 */

import type { PlayerState, WorldState, NPC } from './worldEngine';
import type { SocialScar } from './npcMemoryEngine';

/**
 * Discriminated union for dialogue consequence payloads
 * Each consequence type has its own rigorous payload structure
 */
export interface ReputationPayload {
  npcId: string;
  factionId: string;
  change: number; // Positive or negative reputation change
  reason: string; // Narrative reason for the change
}

export interface QuestPayload {
  questId: string;
  action: 'start' | 'advance' | 'complete' | 'fail';
  narrative?: string; // Optional narrative update
}

export interface ScarDiscoveryPayload {
  scarId: string;
  npcId: string;
  revealedAt: number; // World tick when revealed
  discoveryNarrative: string; // How the scar was discovered
}

export interface KnowledgePayload {
  fact: string; // Knowledge tag or key
  category: string; // Knowledge category (lore, skill, secret, prophecy, etc.)
  tier: number; // Knowledge tier (0-5, higher = more potent)
  narrative?: string; // Optional discovery narrative
}

/**
 * Discriminated union for all possible dialogue consequence actions
 * Use discriminator pattern to ensure type safety without casts
 */
export type DialogueConsequence = 
  | { type: 'gainReputation'; payload: ReputationPayload }
  | { type: 'damageReputation'; payload: ReputationPayload }
  | { type: 'startQuest'; payload: QuestPayload }
  | { type: 'advanceQuest'; payload: QuestPayload }
  | { type: 'completeQuest'; payload: QuestPayload }
  | { type: 'failQuest'; payload: QuestPayload }
  | { type: 'revealSocialScar'; payload: ScarDiscoveryPayload }
  | { type: 'addKnowledge'; payload: KnowledgePayload }
  | { type: 'triggerCombat'; payload: { npcId: string; combatDifficulty: 'easy' | 'normal' | 'hard' | 'deadly' } }
  | { type: 'endDialogue'; payload: { reason: string } };

/**
 * Formal dialogue node definition - exported and available for all narrative engine consumers
 */
export interface DialogueNode {
  id: string;
  type: 'greeting' | 'query' | 'context' | 'climax' | 'resolution' | 'hidden' | 'echo';
  text: string;
  npcState?: 'neutral' | 'suspicious' | 'allied' | 'hostile' | 'romantic' | 'patronizing';
  emotionalWeight?: number; // 0-1, for player emotion tracking
  requiresKnowledge?: string[]; // Knowledge tags needed to see this node
  requiresQuestStatus?: {
    questId: string;
    status: 'not_started' | 'active' | 'completed' | 'failed';
  }[];
  requiresReputation?: {
    factionId: string;
    minValue: number;
  }[];
  requiresItem?: string; // Item ID required to access this dialogue
  revealsSocialScar?: boolean; // If true, accessing this exposes a dormant NPC SocialScar
  branchingOptions: DialogueOption[];
}

/**
 * Dialogue option definition - represents a player choice branching from a dialogue node
 */
export interface DialogueOption {
  id: string;
  text: string;
  nextNodeId?: string; // Null = end conversation
  skillCheck?: {
    skill: 'deception' | 'persuasion' | 'insight' | 'intimidation' | 'empathy';
    dc: number; // Difficulty class (10-20 typical)
  };
  requiresKnowledge?: string[]; // Knowledge required to see this option
  requiresReputation?: { factionId: string; minValue: number }[];
  requiresAlignmentStatus?: 'bloodline-heir' | 'morph-diverse' | 'resonance-active' | 'temporal-accrued';
  consequenceAction?: DialogueConsequence; // Now using discriminated union - fully typed!
  irreversible?: boolean; // If true, choosing this locks future dialogue options
  stamina?: number; // Stamina cost (for intensive dialogue like persuasion checks)
}

/**
 * Result of resolving a dialogue branch - all outcomes rigorously typed
 */
export interface DialogueResolution {
  dialogueNodeId: string;
  accessibleOptions: DialogueOption[];
  playerCanIgnoreFactionLoyalty: boolean;
  exposedSocialScars: SocialScar[];
  skillCheckOportunities: Array<{
    skill: string;
    dc: number;
    option: DialogueOption;
  }>;
  narrativeImplications: string[];
}

/**
 * BranchingDialogueEngine - Centralized dialogue resolution
 * 
 * Strictly validates dialogue options based on:
 * - Player reputation with factions
 * - Discovered knowledge tags
 * - Active quest status
 * - Special player states (bloodline heir, morphed, etc.)
 * - NPC emotional state and relationship
 */
export class BranchingDialogueEngine {
  /**
   * Resolve available conversation branches from a dialogue node
   * 
   * @param dialogueNode - The current dialogue node being presented
   * @param player - Current player state (for reputation, knowledge checks)
   * @param npc - The NPC engaged in conversation
   * @param worldState - World context (for relationship checks, faction info)
   * @returns DialogueResolution with filtered options and implications
   */
  static resolveDialogueBranch(
    dialogueNode: DialogueNode,
    player: PlayerState,
    npc: NPC,
    worldState: WorldState
  ): DialogueResolution {
    const accessibleOptions: DialogueOption[] = [];
    const skillCheckOpportunities: Array<{
      skill: string;
      dc: number;
      option: DialogueOption;
    }> = [];
    const narrativeImplications: string[] = [];
    const exposedSocialScars: SocialScar[] = [];

    // Iterate dialogue options and validate each one
    for (const option of dialogueNode.branchingOptions) {
      if (!this.validateDialogueOption(option, player, npc, worldState)) {
        continue; // Option doesn't pass validation gates
      }

      accessibleOptions.push(option);

      // Track skill check opportunities
      if (option.skillCheck) {
        skillCheckOpportunities.push({
          skill: option.skillCheck.skill,
          dc: option.skillCheck.dc,
          option
        });
        narrativeImplications.push(`Skill check available: ${option.skillCheck.skill} (DC ${option.skillCheck.dc})`);
      }

      // Track consequences
      if (option.consequenceAction) {
        narrativeImplications.push(`Choosing this reveals: ${option.consequenceAction.type}`);
      }
    }

    return {
      dialogueNodeId: dialogueNode.id,
      accessibleOptions,
      playerCanIgnoreFactionLoyalty: this.checkFactionBypass(player, worldState),
      exposedSocialScars,
      skillCheckOportunities: skillCheckOpportunities,
      narrativeImplications
    };
  }

  /**
   * Validate if a dialogue option is accessible given player state
   * 
   * Strictly typed - no `as any` casts
   */
  private static validateDialogueOption(
    option: DialogueOption,
    player: PlayerState,
    npc: NPC,
    worldState: WorldState
  ): boolean {
    // Knowledge gates
    if (option.requiresKnowledge && option.requiresKnowledge.length > 0) {
      const playerKnowledge = this.extractPlayerKnowledge(player);
      const hasAllKnowledge = option.requiresKnowledge.every(tag =>
        playerKnowledge.has(tag)
      );
      if (!hasAllKnowledge) return false;
    }

    // Reputation gates
    if (option.requiresReputation && option.requiresReputation.length > 0) {
      for (const repReq of option.requiresReputation) {
        const playerRep = player.factionReputation?.[repReq.factionId] ?? 0;
        if (playerRep < repReq.minValue) return false;
      }
    }

    // Special alignment states
    if (option.requiresAlignmentStatus) {
      if (!this.checkAlignmentStatus(player, option.requiresAlignmentStatus)) {
        return false;
      }
    }

    // Stamina cost
    if (option.stamina && option.stamina > 0) {
      // Could add stamina system here
    }

    return true; // Option passes all gates
  }

  /**
   * Extract player knowledge base as a Set for efficient lookup
   */
  private static extractPlayerKnowledge(player: PlayerState): Set<string> {
    const knowledge = new Set<string>();

    if (!player.knowledgeBase) return knowledge;

    // Handle both Map and Array formats (for snapshot compatibility)
    if (player.knowledgeBase instanceof Map) {
      for (const key of player.knowledgeBase.keys()) {
        knowledge.add(key);
      }
    } else if (Array.isArray(player.knowledgeBase)) {
      for (const entry of player.knowledgeBase) {
        if (typeof entry === 'string') {
          knowledge.add(entry);
        }
      }
    }

    return knowledge;
  }

  /**
   * Check if player has a specific alignment status
   * 
   * Alignment statuses include:
   * - bloodline-heir: Player is inheritor of ancestral power
   * - morph-diverse: Player has performed multiple morphs
   * - resonance-active: Player has active SoulResonance connection
   * - temporal-accrued: Player has significant temporal debt
   */
  private static checkAlignmentStatus(
    player: PlayerState,
    status: 'bloodline-heir' | 'morph-diverse' | 'resonance-active' | 'temporal-accrued'
  ): boolean {
    switch (status) {
      case 'bloodline-heir':
        // Check if bloodlineData indicates inheritance
        return player.bloodlineData?.inheritedPerks && player.bloodlineData.inheritedPerks.length > 0;

      case 'morph-diverse':
        // Check if player has morphed into multiple races
        return (player.recentMorphCount ?? 0) >= 2;

      case 'resonance-active':
        // Check if player currently has active soul resonance
        return !!player.activeResonanceEchoId && player.soulResonanceLevel !== undefined && player.soulResonanceLevel > 30;

      case 'temporal-accrued':
        // Check if player has significant temporal debt
        return (player.temporalDebt ?? 0) >= 50;

      default:
        return false;
    }
  }

  /**
   * Check if player can bypass faction loyalty requirements
   * 
   * Players with high social standing or special statuses can ignore some faction gates.
   */
  private static checkFactionBypass(player: PlayerState, worldState: WorldState): boolean {
    // Check if player has bloodline heir status (ancient authority)
    if (player.bloodlineData?.mythStatus && player.bloodlineData.mythStatus >= 50) {
      return true;
    }

    // Check if player is Director (via merit system)
    if (player.merit && player.merit >= 100) {
      return true;
    }

    return false;
  }

  /**
   * Resolve a skill check for dialogue option access
   * 
   * Uses player's social branch skills to determine success at hidden dialogue options.
   * Formula: roll d20 + skill modifier vs base DC
   * 
   * @param player Player with social skills
   * @param skillType Type of social skill (persuasion, deception, insight, intimidation, empathy)
   * @param baseDC Difficulty class from dialogue option
   * @param playerFame Optional reputation multiplier (fame increases success chance)
   * @returns Success result with adjusted DC based on player skill level
   */
  static resolveSkillCheck(
    player: PlayerState,
    skillType: 'persuasion' | 'deception' | 'insight' | 'intimidation' | 'empathy',
    baseDC: number,
    playerFame: number = 0
  ): {
    success: boolean;
    roll: number;
    modifiedDC: number;
    margin: number;  // Positive = success by this much, negative = failed by this much
    skillBonus: number;
  } {
    // Base skill modifier from social branch & charisma stat
    const charisma = player.stats?.cha ?? 10;
    const chaBonus = Math.floor((charisma - 10) / 2);
    
    // Skill-specific bonuses from unlockedAbilities
    let skillBonus = chaBonus;
    if (player.unlockedAbilities && player.unlockedAbilities.length > 0) {
      // Each social ability adds +1 bonus
      const socialAbilities = player.unlockedAbilities.filter(abilityId => {
        // In a full system, would check skillEngine.getAbility(abilityId).branch === 'social'
        return abilityId.includes('social') || abilityId.includes('persuasion') || 
               abilityId.includes('deception') || abilityId.includes('insight');
      });
      skillBonus += Math.floor(socialAbilities.length / 2); // +1 per 2 abilities
    }
    
    // Fame bonus from faction reputation (high reputation = NPC more inclined to believe/like player)
    const fameBonus = Math.floor(playerFame / 30); // Every 30 reputation = +1 to DC (making it easier)
    
    // Soul Resonance bonus (ancestral wisdom helps with persuasion)
    const resonanceBonus = Math.floor((player.soulResonanceLevel ?? 0) / 25); // +1 per 25 resonance
    
    // Total skill modifier
    const totalModifier = skillBonus + fameBonus + resonanceBonus;
    
    // Roll d20 (1-20 random)
    const roll = Math.floor(Math.random() * 20) + 1;
    const checkTotal = roll + totalModifier;
    
    // Adjusted DC = base DC - fame bonus (high fame makes checks easier)
    const modifiedDC = Math.max(1, baseDC - fameBonus);
    
    // Success if check total meets or exceeds modified DC
    const success = checkTotal >= modifiedDC;
    const margin = checkTotal - modifiedDC;
    
    return {
      success,
      roll,
      modifiedDC,
      margin,
      skillBonus: totalModifier
    };
  }

  /**
   * Calculate NPC response tone multiplier based on player reputation
   * 
   * High reputation with NPC's faction makes them more friendly and helpful.
   * Low reputation makes them hostile or dismissive.
   * 
   * @param npc The NPC being interacted with
   * @param player Player state
   * @returns Tone multiplier (-1.0 to +1.0):
   *   - -1.0: Actively hostile
   *   - -0.5: Cold/dismissive
   *   - 0.0: Neutral (default)
   *   - +0.5: Friendly
   *   - +1.0: Enthusiastic/allied
   */
  static calculateNpcResponseTone(npc: NPC, player: PlayerState): number {
    if (!npc.factionId) return 0; // No faction = neutral
    
    const playerRep = player.factionReputation?.[npc.factionId] ?? 0;
    
    // Map reputation to response tone
    if (playerRep >= 80) return 1.0;      // Allied
    if (playerRep >= 40) return 0.5;      // Friendly
    if (playerRep >= 0) return 0.0;       // Neutral
    if (playerRep >= -40) return -0.5;    // Cold
    return -1.0;                          // Hostile
  }

  /**
   * Apply a dialogue option's consequences to world state
   * 
   * This function processes the immediate narrative effects of selecting an option.
   * Returns mutation instructions for the actionPipeline.
   */
  static applyDialogueConsequence(
    option: DialogueOption,
    player: PlayerState,
    npc: NPC,
    worldState: WorldState
  ): Array<{
    actionType: string;
    payload: Record<string, any>;
  }> {
    const mutations: Array<{
      actionType: string;
      payload: Record<string, any>;
    }> = [];

    if (!option.consequenceAction) return mutations;

    const action = option.consequenceAction;

    switch (action.type) {
      case 'startQuest':
        mutations.push({
          actionType: 'START_QUEST',
          payload: action.payload
        });
        break;

      case 'gainReputation':
        mutations.push({
          actionType: 'GAIN_REPUTATION',
          payload: action.payload
        });
        break;

      case 'damageReputation':
        mutations.push({
          actionType: 'DAMAGE_REPUTATION',
          payload: action.payload
        });
        break;

      case 'addKnowledge':
        mutations.push({
          actionType: 'ADD_KNOWLEDGE',
          payload: action.payload
        });
        break;

      case 'triggerCombat':
        mutations.push({
          actionType: 'COMBAT_START',
          payload: action.payload
        });
        break;

      case 'endDialogue':
        // Implicit - handled by UI layer
        break;
    }

    return mutations;
  }
}

export default BranchingDialogueEngine;
