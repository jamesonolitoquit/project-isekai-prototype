import type { WorldState, NPC } from './worldEngine';
import { random } from './prng';
import type { NarrativePivot } from './canonJournal';
import { generateNpcPrompt, parseNpcResponse, callLlmApi, type DialogueContext as AiDialogueContext, type NpcKnowledgeScope, type LlmConfig } from './aiDmEngine';
import { multiverseAdapter } from './multiverseAdapter';

export interface DialogueContext {
  weather: 'clear' | 'snow' | 'rain' | 'ash_storm' | 'cinder_fog' | 'mana_static'; // Phase 17: Extended causal weather types
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  hour: number;
  dayPhase: 'night' | 'morning' | 'afternoon' | 'evening';
  reputation: number;
  questHistory: { questId: string; status: 'completed' | 'in_progress' | 'failed' }[];
  narrativeAnchors?: NarrativePivot[]; // M7 Phase 3: Historical pivot points for context
  recentPivots?: NarrativePivot[]; // M7 Phase 3: Most recent high-impact events NPC might reference
}

export interface DialogueOption {
  id: string;
  text: string;
  requiresQuestStatus?: string;
  consequence?: 'quest_start' | 'reputation_change' | 'item_give';
  itemId?: string; // For item_give consequences
  // M16: Dialogue gating system
  gateType?: 'reputation' | 'knowledge' | 'quest' | 'none';
  minimumTier?: ReputationTier; // For reputation gates
  requiresKnowledge?: string; // Lore entry ID required
  isSecret?: boolean; // Only shows if player is allied (tier 5)
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
 * ====== AI SYNTHESIS INTEGRATION LAYER ======
 * ALPHA_M21: Bridge between static dialogue and LLM-synthesized responses
 */

/**
 * Global flag to enable/disable AI synthesis (can be toggled by developer)
 */
export let SYNTHESIS_MODE_ENABLED = false;

/**
 * Set synthesis mode globally (called by game initialization or developer commands)
 */
export function setSynthesisModeEnabled(enabled: boolean): void {
  SYNTHESIS_MODE_ENABLED = enabled;
}

/**
 * Synthesize NPC dialogue using LLM if synthesis mode is enabled
 * Falls back to static dialogue if synthesis fails or is disabled
 * 
 * @param npcId NPC ID
 * @param state Current WorldState
 * @param playerMessage The player's input text
 * @param previousMessages Conversation history in this session
 * @returns Synthesized dialogue with optional stage direction
 */
export async function synthesizeNpcDialogue(
  npcId: string,
  state: WorldState,
  playerMessage: string,
  previousMessages?: Array<{ role: 'npc' | 'player'; text: string }>
): Promise<{ text: string; stageDirection?: string; synthesized: boolean }> {
  // Return static dialogue if synthesis disabled
  if (!SYNTHESIS_MODE_ENABLED) {
    return { text: 'Static dialogue fallback.', synthesized: false };
  }

  const npc = state.npcs?.find(n => n.id === npcId);
  if (!npc) {
    return { text: 'I... I cannot remember who you are.', synthesized: false };
  }

  try {
    // Build the AI dialogue context
    const aiContext: AiDialogueContext = {
      dialogue: playerMessage,
      previousMessages: previousMessages || [],
      playerAction: 'spoke',
      questState: 'conversation',
      reputationDelta: 0
    };

    // Build knowledge scope (WTOL)
    const knowledgeScope: NpcKnowledgeScope = {
      seenLocations: [npc.locationId],
      knownNpcs: state.npcs?.map(n => n.id).slice(0, 5) || [],
      heardQuests: [],
      playerReputation: true,
      playerClass: false
    };

    // Generate LLM prompt
    const prompt = generateNpcPrompt(npcId, state, aiContext, knowledgeScope);

    // Call LLM API with configuration (provider defaults to 'openai', can be overridden)
    const llmConfig: LlmConfig = {
      provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'claude' | 'gemini' | 'groq' | 'ollama' | 'mock',
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
      temperature: 0.8,
      maxTokens: 150
    };

    const response = await callLlmApi(prompt, llmConfig);

    // Parse it
    const parsed = parseNpcResponse(response);

    return {
      text: parsed.dialogue,
      stageDirection: parsed.stageDirection,
      synthesized: true
    };
  } catch (error) {
    console.error(`Failed to synthesize dialogue for NPC ${npcId}:`, error);
    return { text: getStaticFallbackResponse(npc, state), synthesized: false };
  }
}

/**
 * Get static fallback response when synthesis is unavailable
 */
function getStaticFallbackResponse(npc: NPC, state?: WorldState): string {
  // Phase 29: Multiverse Dissonance Injection
  if (state && npc.id === 'chronicler_main') {
    const playerParadox = (state as any).player?.paradoxCount || 0;
    const dissonanceLines = multiverseAdapter.getDissonanceDialogue(npc.id, playerParadox);
    if (dissonanceLines.length > 0) {
      // 30% chance to say a dissonance line instead of static response
      if (Math.random() < 0.3) {
        return dissonanceLines[Math.floor(Math.random() * dissonanceLines.length)];
      }
    }
  }

  const emotion = npc.emotionalState;
  if (!emotion) return `${npc.name} looks at you curiously.`;

  if (emotion.trust > 70) {
    return `*smiles warmly* Hello, friend. What do you need?`;
  } else if (emotion.fear > 70) {
    return `*steps back nervously* What... what do you want?`;
  } else if (emotion.resentment > 70) {
    return `*crosses arms* I have nothing for you.`;
  }

  return `${npc.name} nods politely.`;
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
 * M7 Phase 3: Prioritizes narrative anchors (Pivot Points) for historical grounding
 */
function selectContextualDialogue(npc: any, context: DialogueContext): string {
  if (!npc.dialogueVariations) {
    // Fallback to legacy dialogue array
    return npc.dialogue?.[0] || `${npc.name} looks at you.`;
  }

  const variations = npc.dialogueVariations;

  // M7 Phase 3: Check narrative anchors first (highest priority)
  // NPCs reference significant historical events their faction was involved in
  if (context.narrativeAnchors && context.narrativeAnchors.length > 0) {
    // Get the most recent anchor affecting this NPC's faction
    const relevantAnchor = context.narrativeAnchors.find(
      anchor => npc.factionId && anchor.affectedFactions.includes(npc.factionId)
    );

    if (relevantAnchor) {
      // Use the thematic category as key (e.g., 'conflict', 'triumph')
      const anchorKey = `narrative_${relevantAnchor.thematicCategory}`;
      if (variations[anchorKey]) {
        const options = Array.isArray(variations[anchorKey]) ? variations[anchorKey] : [variations[anchorKey]];
        return options[Math.floor(random() * options.length)];
      }
      // Fallback: if no specific category variation, use the pivot's narrative hook
      return relevantAnchor.narrative;
    }
  }

  // M7 Phase 3: Secondary check - if we have recent pivots, maybe reference them generically
  if (context.recentPivots && context.recentPivots.length > 0) {
    const rumor = context.recentPivots[0];
    const rumor_key = `rumor_${rumor.thematicCategory}`;
    if (variations[rumor_key]) {
      const options = Array.isArray(variations[rumor_key]) ? variations[rumor_key] : [variations[rumor_key]];
      return options[Math.floor(random() * options.length)];
    }
  }

  // Priority: quest completion (high) → time-of-day → weather → season → default
  const completedQuests = context.questHistory.filter(q => q.status === 'completed').map(q => q.questId);
  for (const questId of completedQuests) {
    const key = `quest_completed_${questId}`;
    if (variations[key]) {
      const options = Array.isArray(variations[key]) ? variations[key] : [variations[key]];
      return options[Math.floor(random() * options.length)];
    }
  }

  // ALPHA_M15 Step 2: Check time-of-day variations (morning, afternoon, evening, night)
  // NPCs may greet player differently based on time of day
  const timeOfDayKey = context.dayPhase;
  if (variations[timeOfDayKey]) {
    const options = Array.isArray(variations[timeOfDayKey]) ? variations[timeOfDayKey] : [variations[timeOfDayKey]];
    return options[Math.floor(random() * options.length)];
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
 * M7 Phase 3: Accepts optional canonJournal for historical context
 */
export function resolveDialogue(
  npc: any,
  player: any,
  state: WorldState,
  context?: DialogueContext,
  canonJournal?: any // M7 Phase 3: Optional CJ instance for narrative anchors
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

    // M7 Phase 3: Build narrative anchors if canonJournal provided
    const narrativeAnchors = canonJournal && npc.factionId 
      ? canonJournal.getNarrativeAnchorsFor(npc.factionId)
      : undefined;
    
    const recentPivots = canonJournal
      ? canonJournal.getRecentPivotPoints(3)
      : undefined;

    context = {
      weather: state.weather,
      season: state.season,
      hour: state.hour,
      dayPhase: state.dayPhase,
      reputation: factionRep,  // Now uses faction reputation
      questHistory,
      narrativeAnchors,  // M7 Phase 3
      recentPivots,      // M7 Phase 3
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
  const dialogueNode = dialogueText as unknown as DialogueNode;
  return {
    text: dialogueNode?.text || `${npc.name} says something.`,
    options: dialogueNode?.options || [{ id: 'acknowledge', text: 'Continue' }]
  };
}

/**
 * M16: Map reputation to tier level for dialogue gating
 * Tiers: Hostile (-100 to -60), Unfriendly (-59 to -20), Neutral (-19 to 20), Friendly (21 to 60), Allied (61 to 100)
 */
export type ReputationTier = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';

export function getReputationTier(reputation: number): ReputationTier {
  if (reputation <= -60) return 'hostile';
  if (reputation <= -20) return 'unfriendly';
  if (reputation <= 20) return 'neutral';
  if (reputation <= 60) return 'friendly';
  return 'allied';
}

/**
 * M16: Get available dialogue lines filtered by player knowledge/reputation
 * Filters dialogue options based on:
 * - Faction reputation tier (gated dialogue for hostile/allied tiers)
 * - Player knowledge base (lore entries unlocked)
 * - Specific quest prerequisites
 */
export function getAvailableDialogueLines(
  npc: any,
  player: any,
  options?: { knowledgeBase?: Set<string>; influenceMap?: Record<string, number> }
): DialogueOption[] {
  const dialogueNode = npc.dialogue?.[0];
  if (!dialogueNode || typeof dialogueNode === 'string') {
    return [];
  }

  if (!Array.isArray(dialogueNode.options)) {
    return [];
  }

  const factionReputation = npc.factionId ? (player.factionReputation?.[npc.factionId] ?? 0) : 0;
  const tier = getReputationTier(factionReputation);
  const knowledgeBase = options?.knowledgeBase || new Set();

  return dialogueNode.options.filter((opt: DialogueOption) => {
    // If no gates, option is available
    if (!opt.gateType) {
      return true;
    }

    // REPUTATION_GATE: Only certain tiers can see this
    if (opt.gateType === 'reputation' && opt.minimumTier) {
      const tierRanking = { hostile: 0, unfriendly: 1, neutral: 2, friendly: 3, allied: 4 };
      const minimumRanking = tierRanking[opt.minimumTier as ReputationTier] ?? 0;
      return tierRanking[tier] >= minimumRanking;
    }

    // KNOWLEDGE_GATE: Player must have discovered specific lore entry
    if (opt.gateType === 'knowledge' && opt.requiresKnowledge) {
      return knowledgeBase.has(opt.requiresKnowledge);
    }

    // QUEST_GATE: Player must have specific quest progress
    if (opt.gateType === 'quest' && opt.requiresQuestStatus) {
      const questState = player.quests?.[opt.requiresQuestStatus];
      return questState?.status === 'in_progress' || questState?.status === 'completed';
    }

    // SECRET_GATE: Requires high ally tier (61+) to even see dangerous options
    if (opt.isSecret && tier !== 'allied') {
      return false;
    }

    return true;
  });
}

/**
 * M16: Get NPC greeting text based on disposition and faction
 * Enhanced with faction influence modifier (M15 integration)
 */
export function getNpcGreeting(
  npc: any,
  disposition: 'friendly' | 'neutral' | 'hostile',
  options?: { influenceMap?: Record<string, Record<string, number>>; locationId?: string }
): string {
  const baseGreeting = npc.dialogue?.[0] || `Greetings, traveler.`;
  
  // M16: Check if NPC is in faction-dominated territory
  if (options?.influenceMap && options?.locationId && npc.factionId) {
    const locationInfluence = options.influenceMap[options.locationId] || {};
    const factionInfluence = locationInfluence[npc.factionId] ?? 0;
    const dominantFactionId = Object.entries(locationInfluence).reduce((max, [factionId, score]) => 
      (score as number) > (locationInfluence[max.id] ?? 0) ? { id: factionId, score: score as number } : max,
      { id: '', score: 0 }
    ).id;

    // Confidence boost: NPC in own faction's territory
    if (npc.factionId === dominantFactionId && factionInfluence > 50) {
      if (disposition === 'friendly') {
        return `${npc.name} stands confidently on home ground. "Welcome, trusted ally!"`;
      } else if (disposition === 'neutral') {
        return `${npc.name} glances around confidently. "What brings you here?"`;
      }
    }

    // Wary penalty: NPC in enemy faction territory
    if (npc.factionId !== dominantFactionId && locationInfluence[dominantFactionId] >= 60) {
      if (disposition === 'friendly') {
        return `${npc.name} lowers voice nervously. "I'm glad to see a familiar face in this place..."`;
      } else if (disposition === 'neutral') {
        return `${npc.name} glances around cautiously. "Be careful what you say here."`;
      }
    }
  }

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

/**
 * ALPHA_M19: Update NPC emotional state based on player interactions
 * Emotions (trust, fear, gratitude, resentment) each range 0-100
 */
export function updateNpcEmotion(
  npc: any,
  category: 'trust' | 'fear' | 'gratitude' | 'resentment',
  delta: number,
  reason: string,
  tick: number
): void {
  // Initialize emotional state if missing
  if (!npc.emotionalState) {
    npc.emotionalState = {
      trust: 50,
      fear: 50,
      gratitude: 50,
      resentment: 50,
      emotionalHistory: []
    };
  }

  // Apply delta and clamp to 0-100
  npc.emotionalState[category] = Math.max(0, Math.min(100, npc.emotionalState[category] + delta));
  npc.emotionalState.lastEmotionalEventTick = tick;

  // Record in history
  if (!npc.emotionalState.emotionalHistory) {
    npc.emotionalState.emotionalHistory = [];
  }

  npc.emotionalState.emotionalHistory.push({
    tick,
    category,
    delta,
    reason
  });

  // Keep only last 20 emotional events
  if (npc.emotionalState.emotionalHistory.length > 20) {
    npc.emotionalState.emotionalHistory = npc.emotionalState.emotionalHistory.slice(-20);
  }
}

/**
 * ALPHA_M19: Decay emotional states toward neutral (50) at 2 points per 24h cycle
 * Prevents permanent emotional lock-in, allows relationship recovery
 */
export function decayNpcEmotions(npc: any, ticksDelta: number): void {
  if (!npc.emotionalState) {
    return;
  }

  // 1 tick ≈ 1 minute, 24h = 1440 minutes = 1440 ticks
  // Decay: 2 points per 24h = 2/1440 = 0.00139 per tick
  const decayPerTick = 2 / 1440;
  const totalDecay = decayPerTick * ticksDelta;

  const emotions = ['trust', 'fear', 'gratitude', 'resentment'] as const;
  for (const emotion of emotions) {
    const current = npc.emotionalState[emotion];
    const target = 50; // Neutral baseline
    const distance = current - target;

    if (Math.abs(distance) > 0.01) {
      // Move toward neutral by decay amount (up to totalDecay)
      const direction = distance > 0 ? -1 : 1;
      const decay = Math.min(Math.abs(distance), totalDecay);
      npc.emotionalState[emotion] = current + (decay * direction);
    }
  }
}

/**
 * ALPHA_M19: Get emotional dialogue prefix based on NPC's dominant emotional state
 */
export function getEmotionalDialogueTone(npc: any): 'warm' | 'neutral' | 'cold' | 'snide' {
  if (!npc.emotionalState) {
    return 'neutral';
  }

  const { resentment, gratitude, trust, fear } = npc.emotionalState;

  // Snide: high resentment + low gratitude
  if (resentment > 70 && gratitude < 40) {
    return 'snide';
  }

  // Cold: high fear or resentment
  if (fear > 70 || resentment > 60) {
    return 'cold';
  }

  // Warm: high gratitude + high trust
  if (gratitude > 70 && trust > 60) {
    return 'warm';
  }

  return 'neutral';
}

/**
 * ALPHA_M19: Calculate NPC defection probability during faction warfare
 * Non-critical NPCs with high fear + low trust may switch sides
 * FIXED: Better weighting so fear=90, trust=20 gives >50 risk
 */
export function calculateDefectionRisk(npc: any): number {
  if (!npc.emotionalState || npc.importance === 'critical') {
    return 0; // Critical NPCs never defect
  }

  const { fear, trust } = npc.emotionalState;
  // Weighting: fear is primary factor (0.6), low trust amplifies (0.4)
  // High fear (90) + low trust (20) = 54 + 16 = 70%
  const riskFactor = (fear * 0.6) + ((60 - trust) * 0.4);
  return Math.min(100, riskFactor);
}

/**
 * ALPHA_M19: Process NPC defection and displacement during faction warfare
 * Non-critical NPCs may switch factions or go missing temporarily
 * FIXED: Corrected return type from 'deplaced' to 'displaced'
 */
export function processNpcAttrition(
  npcs: any[],
  conflict: any,
  state: any
): { displaced: any[]; defected: any[]; events: any[] } {
  const displaced: any[] = [];
  const defected: any[] = [];
  const events: any[] = [];

  for (const npc of npcs) {
    // Skip critical NPCs
    if (npc.importance === 'critical') continue;

    // Skip if not in a conflict zone
    if (!conflict.factionIds.includes(npc.factionId)) continue;

    // Calculate defection risk
    const defectionRisk = calculateDefectionRisk(npc);

    // Defection chance
    if (random() * 100 < defectionRisk && !npc.defectedFactionId) {
      const rivalFactions = conflict.factionIds.filter((fId: string) => fId !== npc.factionId);
      if (rivalFactions.length > 0) {
        const newFaction = rivalFactions[Math.floor(random() * rivalFactions.length)];
        npc.defectedFactionId = newFaction;

        defected.push(npc);
        events.push({
          type: 'NPC_DEFECTED',
          npcId: npc.id,
          npcName: npc.name,
          fromFaction: npc.factionId,
          toFaction: newFaction,
          reason: npc.emotionalState?.resentment > 70 ? 'resentment' : 'fear',
          tick: state.tick
        });
      }
    }

    // Displacement chance (high fear makes NPC flee conflict)
    if (npc.emotionalState?.fear > 75 && !npc.isDisplaced && random() < 0.4) {
      npc.isDisplaced = true;
      displaced.push(npc);

      // Initialize npcDisplacements tracking if needed
      if (!state.npcDisplacements) {
        state.npcDisplacements = {};
      }
      const expectedReturnTick = (state.tick ?? 0) + (1440 + Math.floor(random() * 1440));
      state.npcDisplacements[npc.id] = {
        displacedAt: state.tick,
        originalLocation: npc.locationId,
        expectedReturnTick: expectedReturnTick
      };

      events.push({
        type: 'NPC_DISPLACED',
        npcId: npc.id,
        npcName: npc.name,
        previousLocation: npc.locationId,
        reason: 'fled_conflict',
        expectedReturnTick: expectedReturnTick,
        tick: state.tick
      });
    }
  }

  return { displaced, defected, events };
}

/**
 * ALPHA_M19: Return displaced NPCs to their original locations after conflict passes
 * Returns NPCs when expectedReturnTick is reached
 */
export function restoreDisplacedNpcs(npcs: any[], state: any): Array<{ npcId: string; npcName: string; reason: string }> {
  const returned: Array<{ npcId: string; npcName: string; reason: string }> = [];
  
  for (const npc of npcs) {
    if (!npc.isDisplaced) continue;

    const displacement = state.npcDisplacements?.[npc.id];
    if (!displacement) continue;

    // Check if enough time has passed for NPC to return
    if ((state.tick ?? 0) >= displacement.expectedReturnTick) {
      npc.isDisplaced = false;
      npc.locationId = displacement.originalLocation;
      returned.push({
        npcId: npc.id,
        npcName: npc.name,
        reason: 'returned_from_displacement'
      });
      if (state.npcDisplacements) {
        delete state.npcDisplacements[npc.id];
      }
    }
  }
  
  return returned;
}
/**
 * ALPHA_M19: Filter dialogue options based on NPC emotional state
 * NPCs with resentment >70 may refuse dialogue or offer only hostile options
 * NPCs with gratitude >70 may offer unique "Ally Gift" options
 */
export function filterDialogueByEmotion(
  dialogueOptions: DialogueOption[],
  npc: any
): DialogueOption[] {
  if (!npc.emotionalState) {
    return dialogueOptions;
  }

  const { resentment, gratitude, fear } = npc.emotionalState;
  const filteredOptions = [...dialogueOptions];

  // High resentment: Remove friendly/gift options
  if (resentment > 70) {
    return filteredOptions.filter(opt => !opt.text?.toLowerCase().includes('gift'));
  }

  // High fear: Remove aggressive dialogue options
  if (fear > 75) {
    return filteredOptions.filter(opt => !opt.text?.toLowerCase().includes('threaten'));
  }

  return filteredOptions;
}

/**
 * ALPHA_M19: Generate emotion-based dialogue prefix or special greetings
 */
export function getEmotionalGreeting(npc: any): string {
  if (!npc.emotionalState) {
    return `${npc.name} greets you.`;
  }

  const tone = getEmotionalDialogueTone(npc);
  const { resentment, gratitude, fear, trust } = npc.emotionalState;

  if (tone === 'snide' && resentment > 70) {
    return `${npc.name} looks at you with thinly veiled contempt. "Well, well... if it isn't you."`;
  }

  if (tone === 'cold' && fear > 70) {
    return `${npc.name} takes a step back, eyes wary. "I... I didn't expect to see you here."`;
  }

  if (tone === 'warm' && gratitude > 70 && trust > 60) {
    return `${npc.name}'s face lights up with genuine warmth. "Friend! It's so good to see you again!"`;
  }

  if (gratitude > 70) {
    return `${npc.name} smiles genuinely. "It's good to see you. I haven't forgotten your kindness."`;
  }

  return `${npc.name} regards you carefully.`;
}

/**
 * ALPHA_M19: Special "Ally Gift" option for NPCs with very high gratitude
 * Can only appear if gratitude >70 and no active quest requirement
 */
export function maybeAddAllyGiftOption(npc: any): DialogueOption | null {
  if (!npc.emotionalState) {
    return null;
  }

  const { gratitude } = npc.emotionalState;

  if (gratitude > 70 && random() < 0.3) {
    return {
      id: 'ally_gift',
      text: 'Accept Ally Gift',
      consequence: 'item_give',
      itemId: `gift_from_${npc.id}`,
      requiresQuestStatus: 'none' // No quest requirement for ally gifts
    };
  }

  return null;
}

