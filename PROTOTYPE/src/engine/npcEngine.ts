import type { WorldState, NPC } from './worldEngine';
import { random } from './prng';

export interface DialogueContext {
  weather: 'clear' | 'snow' | 'rain';
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  hour: number;
  dayPhase: 'night' | 'morning' | 'afternoon' | 'evening';
  reputation: number;
  questHistory: { questId: string; status: 'completed' | 'in_progress' | 'failed' }[];
}

export interface DialogueOption {
  id: string;
  text: string;
  requiresQuestStatus?: string;
  consequence?: 'quest_start' | 'reputation_change' | 'item_give';
}

export interface DialogueNode {
  id: string;
  text: string;
  npcId: string;
  options: DialogueOption[];
  requiresReputation?: number;
  requiresQuestStatus?: string;
}

/**
 * Check if an NPC is available based on faction reputation
 * Uses player's faction reputation (not per-NPC reputation) for access gating
 */
export function checkReputationGate(npc: any, player: any): { available: boolean; requiredReputation?: number; currentReputation?: number; message?: string } {
  // If NPC has no faction, allow access
  if (!npc.factionId) {
    return { available: true };
  }

  // Get faction reputation (0 = neutral)
  const factionReputation = player.factionReputation?.[npc.factionId] ?? 0;

  // Threshold logic: <-50 hostile, -50 to +50 neutral/unrestricted, >50 friendly
  if (factionReputation < -50) {
    // Hostile: NPC refuses dialogue
    return {
      available: false,
      requiredReputation: -50,
      currentReputation: factionReputation,
      message: `The ${npc.factionId} faction rejects you. ${npc.name} will not speak with you.`
    };
  }

  // Neutral or friendly - dialogue available
  return { available: true, currentReputation: factionReputation };
}

/**
 * Check if an NPC is under active world event restrictions
 */
export function checkWorldEventRestrictions(npc: any, state: WorldState): { available: boolean; reason?: string } {
  if (!state.activeEvents || state.activeEvents.length === 0) {
    return { available: true };
  }

  // Check if any active event locks the NPC's location
  for (const event of state.activeEvents) {
    if (event.effects?.locationLocked?.includes(npc.locationId)) {
      return {
        available: false,
        reason: `${event.name} has locked this location`
      };
    }
  }

  return { available: true };
}

/**
 * Check if an NPC is available at the current game hour
 * NPC availability is defined as hour intervals [start, end)
 */
export function isNpcAvailable(npc: any, hour: number): boolean {
  if (!npc.availability) {
    return true; // Available all day if no availability specified
  }

  const { start, end } = npc.availability;
  if (start === undefined || end === undefined) {
    return true;
  }

  // Handle wrap-around (e.g., 22:00 to 06:00 crosses midnight)
  if (start < end) {
    return hour >= start && hour < end;
  } else {
    return hour >= start || hour < end;
  }
}

/**
 * Get NPC disposition towards player based on faction reputation
 */
export function getNpcDisposition(npc: any, player: any): 'friendly' | 'neutral' | 'hostile' {
  // If NPC has no faction, default to neutral
  if (!npc.factionId) {
    return 'neutral';
  }

  const factionReputation = player.factionReputation?.[npc.factionId] ?? 0;

  if (factionReputation > 50) {
    return 'friendly';
  } else if (factionReputation < -50) {
    return 'hostile';
  }
  return 'neutral';
}

/**
 * Select appropriate dialogue based on context (weather, season, quest status)
 */
function selectContextualDialogue(npc: any, context: DialogueContext): string {
  if (!npc.dialogueVariations) {
    // Fallback to legacy dialogue array
    return npc.dialogue?.[0] || `${npc.name} looks at you.`;
  }

  const variations = npc.dialogueVariations;

  // Priority: quest completion → weather → season → default
  const completedQuests = context.questHistory.filter(q => q.status === 'completed').map(q => q.questId);
  for (const questId of completedQuests) {
    const key = `quest_completed_${questId}`;
    if (variations[key]) {
      const options = Array.isArray(variations[key]) ? variations[key] : [variations[key]];
      return options[Math.floor(random() * options.length)];
    }
  }

  // Check weather variations
  if (variations[context.weather]) {
    const options = Array.isArray(variations[context.weather]) ? variations[context.weather] : [variations[context.weather]];
    return options[Math.floor(random() * options.length)];
  }

  // Check season variations
  if (variations[context.season]) {
    const options = Array.isArray(variations[context.season]) ? variations[context.season] : [variations[context.season]];
    return options[Math.floor(random() * options.length)];
  }

  // Default variations
  if (variations.default) {
    const options = Array.isArray(variations.default) ? variations.default : [variations.default];
    return options[Math.floor(random() * options.length)];
  }

  // Ultimate fallback to legacy dialogue
  return npc.dialogue?.[0] || `${npc.name} looks at you.`;
}

/**
 * Select the appropriate dialogue node for an NPC based on context
 */
export function resolveDialogue(
  npc: any,
  player: any,
  state: WorldState,
  context?: DialogueContext
): { text: string; options: DialogueOption[] } {
  // Check reputation gate first
  const repGate = checkReputationGate(npc, player);
  if (!repGate.available) {
    return {
      text: repGate.message || `${npc.name} will not speak with you right now.`,
      options: []
    };
  }

  // Check world event restrictions
  const eventRestriction = checkWorldEventRestrictions(npc, state);
  if (!eventRestriction.available) {
    return {
      text: eventRestriction.reason || `${npc.name} is unavailable due to world events.`,
      options: []
    };
  }

  // Default fallback dialogue
  const defaultDialogue = {
    text: `${npc.name} looks at you.`,
    options: [{ id: 'greet', text: 'Hello' }]
  };

  // Build context if not provided
  if (!context) {
    const questHistory = Object.entries(state.player.quests || {})
      .map(([questId, questState]: [string, any]) => ({
        questId,
        status: questState.status || 'not_started'
      }));

    const factionRep = npc.factionId ? (player.factionReputation?.[npc.factionId] ?? 0) : 0;

    context = {
      weather: state.weather as any,
      season: state.season as any,
      hour: state.hour,
      dayPhase: state.dayPhase as any,
      reputation: factionRep,  // Now uses faction reputation
      questHistory
    };
  }

  // If NPC has no dialogue array, return default
  if (!npc.dialogue && !npc.dialogueVariations) {
    return defaultDialogue;
  }

  // Get contextual text
  const dialogueText = selectContextualDialogue(npc, context);

  if (typeof dialogueText === 'string') {
    // Simple string dialogue
    return {
      text: dialogueText,
      options: [{ id: 'acknowledge', text: 'Continue' }]
    };
  }

  // Structured dialogue node
  const dialogueNode = dialogueText as any;
  return {
    text: dialogueNode?.text || `${npc.name} says something.`,
    options: dialogueNode?.options || [{ id: 'acknowledge', text: 'Continue' }]
  };
}

/**
 * Get NPC greeting text based on disposition and faction
 */
export function getNpcGreeting(npc: any, disposition: 'friendly' | 'neutral' | 'hostile'): string {
  const baseGreeting = npc.dialogue?.[0] || `Greetings, traveler.`;
  
  if (disposition === 'friendly') {
    return `${npc.name} smiles warmly. "Welcome, ally."`;
  } else if (disposition === 'hostile') {
    return `${npc.name} narrows their eyes. "We have nothing to discuss."`;
  }
  return baseGreeting;
}

/**
 * Get faction-based dialogue state (for hostile interactions)
 */
export function getFactionBlockedDialogue(npc: any, player: any): { blocked: boolean; replacementText?: string } {
  if (!npc.factionId) {
    return { blocked: false };
  }

  const factionReputation = player.factionReputation?.[npc.factionId] ?? 0;

  if (factionReputation < -50) {
    return {
      blocked: true,
      replacementText: `${npc.name} will not speak with you. The ${npc.factionId} faction views you as an enemy.`
    };
  }

  return { blocked: false };
}

/**
 * Process a dialogue choice and determine consequences
 */
export function processDialogueChoice(
  npc: any,
  choiceId: string,
  player: any,
  state: WorldState
): { reputationChange?: number; questId?: string; itemGiven?: string } {
  const consequence: { reputationChange?: number; questId?: string; itemGiven?: string } = {};

  // Find the choice option
  const dialogueNode = npc.dialogue?.[0];
  if (!dialogueNode || typeof dialogueNode === 'string') {
    return consequence;
  }

  const option = dialogueNode.options?.find((opt: any) => opt.id === choiceId);
  if (!option) {
    return consequence;
  }

  // Apply consequences
  if (option.consequence === 'reputation_change') {
    consequence.reputationChange = option.reputationDelta ?? 5;
  }

  if (option.consequence === 'quest_start' && npc.questId) {
    consequence.questId = npc.questId;
  }

  if (option.consequence === 'item_give') {
    consequence.itemGiven = option.itemId ?? 'item_unknown';
  }

  return consequence;
}
