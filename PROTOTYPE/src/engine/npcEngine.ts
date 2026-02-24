import type { WorldState, NPC } from './worldEngine';
import { random } from './prng';
import { generateNpcPrompt, parseNpcResponse, callLlmApi, type DialogueContext as AiDialogueContext, type NpcKnowledgeScope, type LlmConfig } from './aiDmEngine';
import { getGoalOrientedPlanner, type NpcPersonality } from './goalOrientedPlannerEngine';
import { EconomicCycle, getEconomicSynthesisEngine } from './economicSynthesisEngine';

export interface DialogueContext {
  weather: 'clear' | 'snow' | 'rain';
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  hour: number;
  dayPhase: 'night' | 'morning' | 'afternoon' | 'evening';
  reputation: number;
  questHistory: { questId: string; status: 'completed' | 'in_progress' | 'failed' }[];
  // Phase 28 Task 3: Economic and world state awareness for situational dialogue
  currentEconomicCycle?: 'BOOM' | 'STABLE' | 'RECESSION';
  economyScore?: number;
  activeAnomalies?: Array<{ id: string; type: string; locationId: string; severity: number }>;
  recentOutbursts?: Array<{ id: string; description: string; severity: number; tick: number }>;
  paradoxLevel?: number;
  socialTension?: number;
}

export interface DialogueOption {
  id: string;
  text: string;
  requiresQuestStatus?: string;
  consequence?: 'quest_start' | 'reputation_change' | 'item_give' | 'social_scar';
  itemId?: string; // For item_give consequences
  sentiment?: number; // M44: -1.0 to +1.0
  impact?: number; // M44: 0.0 to 1.0
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
      questState: 'conversation', // Could be more specific
      reputationDelta: 0 // Could calculate recent changes
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
      provider: (process.env.LLM_PROVIDER as 'openai' | 'claude' | 'mock') || 'openai',
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
    return { text: getStaticFallbackResponse(npc), synthesized: false };
  }
}

/**
 * Get static fallback response when synthesis is unavailable
 */
function getStaticFallbackResponse(npc: NPC): string {
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
 * Phase 28 Task 3: Build dialogue context from world state
 * Extracts economic cycle, anomalies, and recent outbursts for situational dialogue
 * 
 * NPCs should adapt their dialogue based on:
 * - BOOM economy: Optimistic, talking about trade
 * - RECESSION: Worried, talking about survival  
 * - Age Rot zones nearby: Anxious, warning about dangers
 * - Recent outbursts: Emotional, discussing community trauma
 */
export function buildDialogueContext(
  npc: NPC,
  state: WorldState,
  questHistory: { questId: string; status: 'completed' | 'in_progress' | 'failed' }[] = []
): DialogueContext {
  // Base context
  const context: DialogueContext = {
    weather: (state.weather?.condition as 'clear' | 'snow' | 'rain') || 'clear',
    season: (state.season as 'winter' | 'spring' | 'summer' | 'autumn') || 'spring',
    hour: state.hour ?? 12,
    dayPhase: getDayPhase(state.hour ?? 12),
    reputation: npc.trust ?? 50,
    questHistory
  };

  // Phase 28 Task 3: Economic cycle awareness
  if (state.telemetryState?.economyHealth !== undefined) {
    const economyScore = state.telemetryState.economyHealth;
    context.economyScore = economyScore;
    
    if (economyScore > 75) {
      context.currentEconomicCycle = 'BOOM';
    } else if (economyScore < 25) {
      context.currentEconomicCycle = 'RECESSION';
    } else {
      context.currentEconomicCycle = 'STABLE';
    }
  }

  // Phase 28 Task 3: Active anomalies (Age Rot zones)
  if (state.paradoxState?.anomalies && state.paradoxState.anomalies.length > 0) {
    // Focus on anomalies near the NPC's location
    const nearbyAnomalies = state.paradoxState.anomalies.filter(
      (a: any) => a.locationId === npc.locationId || a.radius > 100
    );
    context.activeAnomalies = nearbyAnomalies.map((a: any) => ({
      id: a.id,
      type: a.type || 'reality_distortion',
      locationId: a.locationId,
      severity: a.severity || 0.5
    }));
    context.paradoxLevel = state.paradoxState.totalParadoxPoints ?? 0;
  }

  // Phase 28 Task 3: Recent outbursts (social scars from Phase 26)
  if (state.events && state.events.length > 0) {
    const recentOutbursts = state.events
      .filter((e: any) => {
        return e.type === 'SOCIAL_OUTBURST' && 
               (state.tick ?? 0) - e.timestamp < 1000; // Within last 1000 ticks
      })
      .slice(0, 3)
      .map((e: any) => ({
        id: e.id,
        description: e.payload?.description || 'Unknown incident',
        severity: e.payload?.severity || 0.5,
        tick: e.timestamp
      }));
    
    if (recentOutbursts.length > 0) {
      context.recentOutbursts = recentOutbursts;
    }
  }

  // Phase 28 Task 3: Social tension
  context.socialTension = state.socialTension ?? 0;

  return context;
}

/**
 * Helper: Determine day phase from hour
 */
function getDayPhase(hour: number): 'night' | 'morning' | 'afternoon' | 'evening' {
  if (hour < 6 || hour >= 22) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Phase 28 Task 3: Generate economy-driven dialogue branches
 * Returns different dialogue options based on economic cycle
 */
export function getEconomyDrivenDialogueOptions(
  cycle: 'BOOM' | 'STABLE' | 'RECESSION' | undefined
): DialogueOption[] {
  if (!cycle) return [];

  switch (cycle) {
    case 'BOOM':
      return [
        {
          id: 'boom-1',
          text: "How's business treating you?",
          sentiment: 0.5,
          impact: 0.3,
          consequence: 'quest_start'
        },
        {
          id: 'boom-2',
          text: 'Heard the caravans are doing well.',
          sentiment: 0.3,
          impact: 0.2,
          consequence: 'reputation_change'
        }
      ];
    case 'RECESSION':
      return [
        {
          id: 'recession-1',
          text: 'How are you managing with the downturn?',
          sentiment: -0.2,
          impact: 0.4,
          consequence: 'quest_start'
        },
        {
          id: 'recession-2',
          text: 'Things look tough. Need help?',
          sentiment: 0.4,
          impact: 0.3,
          consequence: 'reputation_change'
        }
      ];
    default:
      return [];
  }
}

/**
 * Phase 28 Task 3: Generate paradox-aware dialogue branches
 * Returns different dialogue options when near Age Rot zones
 */
export function getParadoxAwareDialogueOptions(
  paradoxLevel: number | undefined,
  hasNearbyAnomalies: boolean
): DialogueOption[] {
  if (!paradoxLevel || paradoxLevel < 50 || !hasNearbyAnomalies) {
    return [];
  }

  return [
    {
      id: 'paradox-1',
      text: 'Do you feel it? Reality is tearing apart.',
      sentiment: -0.7,
      impact: 0.6,
      consequence: 'quest_start'
    },
    {
      id: 'paradox-2',
      text: 'We should stay away from that zone. Something is wrong.',
      sentiment: -0.5,
      impact: 0.4,
      consequence: 'reputation_change'
    },
    {
      id: 'paradox-3',
      text: 'Those anomalies... they grow stronger each day.',
      sentiment: -0.6,
      impact: 0.5,
      consequence: 'reputation_change'
    }
  ];
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
 * NOTE: This is the Legacy Rule-Based engine. 
 * The PRIMARY dialogue engine is the AI DM context-injection layer.
 * Use this as a fallback or for deterministic tutorial prompts.
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
      weather: (state.weather || 'clear') as 'clear' | 'snow' | 'rain',
      season: (state.season || 'winter') as 'winter' | 'spring' | 'summer' | 'autumn',
      hour: state.hour,
      dayPhase: (state.dayPhase || 'afternoon') as 'night' | 'morning' | 'afternoon' | 'evening',
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
  const dialogueNode = dialogueText as Record<string, unknown>;
  const text = typeof dialogueNode?.text === 'string' ? dialogueNode.text : `${npc.name} says something.`;
  const options = Array.isArray(dialogueNode?.options) ? dialogueNode.options as DialogueOption[] : [{ id: 'acknowledge', text: 'Continue' }];
  return {
    text,
    options
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
      delete state.npcDisplacements[npc.id];
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

/**
 * M46-C1: Extract personality traits from NPC data
 * Personality influences goal prioritization and action selection
 */
export function extractNpcPersonality(npc: any): NpcPersonality {
  // Extract from NPC properties or use WTOL obfuscation hints
  const obfuscationLevel = npc.obfuscationTier || 0.5; // 0 = transparent, 1 = very hidden
  const emotionalState = npc.emotionalState || { trust: 50, fear: 50, gratitude: 50, resentment: 50 };

  // Greediness: affected by emotional resentment (greedy when resentful), reputation
  const greediness = Math.max(0, Math.min(1,
    ((npc.reputationAsTrader || 0.5) + (emotionalState.resentment / 200)) / 1.5
  ));

  // Piety: affected by resentment (low piety when resentful), faction religion scores
  const piety = Math.max(0, Math.min(1,
    (npc.religiousScore || 0.3) - (emotionalState.resentment / 200)
  ));

  // Ambition: affected by power stat, fear (low ambition when scared)
  const ambition = Math.max(0, Math.min(1,
    ((npc.power || 30) / 100) - (Math.max(0, emotionalState.fear - 50) / 200)
  ));

  // Loyalty: affected by trust/gratitude
  const loyalty = Math.max(0, Math.min(1,
    ((emotionalState.trust + emotionalState.gratitude) / 200)
  ));

  // Risk: inverse of fear, scaled by reputation
  const risk = Math.max(0, Math.min(1,
    (1 - (emotionalState.fear / 100)) * (npc.reputationAsWarrior || 0.5)
  ));

  // Sociability: affected by gratitude and status
  const sociability = Math.max(0, Math.min(1,
    ((emotionalState.gratitude / 100) + (npc.importance ? 0.3 : 0)) / 1.3
  ));

  return { greediness, piety, ambition, loyalty, risk, sociability };
}

/**
 * M46-C1: Initialize autonomous goals for an NPC
 * Called when NPC enters the world or at epoch reset
 */
export function initializeNpcGoals(
  npc: any,
  personality: NpcPersonality,
  currentTick: number
): void {
  const planner = getGoalOrientedPlanner();

  // Initialize goals based on personality
  const goals = planner.initializeGoalsForNpc(npc.id, personality, currentTick);

  // Store personality on NPC for later reference
  npc.personality = personality;
  npc.goals = goals;
  npc.autonomousPlans = [];
}

/**
 * M46-C1: Plan next actions for an NPC based on their goals
 * Called periodically (every 100 ticks or when goal changes)
 */
export function planNpcActions(
  npc: any,
  state: WorldState,
  currentTick: number
): any {
  const planner = getGoalOrientedPlanner();

  if (!npc.personality) {
    npc.personality = extractNpcPersonality(npc);
  }

  if (!npc.goals) {
    const goals = planner.getGoalsForNpc(npc.id);
    if (goals.length === 0) {
      initializeNpcGoals(npc, npc.personality, currentTick);
    }
  }

  // Update goal progress based on current state
  planner.updateGoalsForNpc(npc.id, npc, state, currentTick);

  // Plan new actions
  const plan = planner.planActionsForNpc(npc.id, npc, state, currentTick, 3);

  if (plan.status === 'planned') {
    // Mark plan as executing and store it
    plan.status = 'executing';
    plan.startedAt = currentTick;
    if (!npc.autonomousPlans) {
      npc.autonomousPlans = [];
    }
    npc.autonomousPlans.push(plan);

    // Store on NPC for reference
    npc.currentPlan = plan;
  }

  return plan;
}

/**
 * M46-C1: Execute next step in an NPC's action plan
 * Called when sufficient ticks have passed for action completion
 */
export function executeNpcPlanStep(
  npc: any,
  state: WorldState,
  currentTick: number
): { actionCompleted: boolean; nextAction?: any; effects?: any; description?: string } {
  const planner = getGoalOrientedPlanner();
  const currentPlan = npc.currentPlan;

  if (!currentPlan || currentPlan.status !== 'executing') {
    return { actionCompleted: false };
  }

  const result = planner.executeActionStep(currentPlan.id, npc.id, npc, currentTick);

  let description = '';
  if (result.success) {
    const action = currentPlan.actions[result.nextStepIndex - 1];
    description = generateActionDescription(npc, action, state);

    if (result.nextStepIndex >= currentPlan.actions.length) {
      currentPlan.status = 'completed';
      npc.currentPlan = null; // Ready for new plan
    }
  } else {
    description = `${npc.name}'s plan failed at step ${currentPlan.executingStep + 1}.`;
    currentPlan.status = 'failed';
    npc.currentPlan = null;
  }

  return {
    actionCompleted: result.success,
    nextAction: currentPlan.actions[result.nextStepIndex],
    effects: result.effectsApplied,
    description
  };
}

/**
 * M46-C1: Generate narrative description of an NPC's action
 */
function generateActionDescription(npc: any, action: any, state: WorldState): string {
  const templates: Record<string, string> = {
    trade: `${npc.name} conducted a trade, gaining ${action.effects.goldDelta} gold.`,
    preach: `${npc.name} has been preaching, spreading their faith.`,
    scout: `${npc.name} scouted the land, gathering intelligence.`,
    recruit: `${npc.name} recruited new followers, spending ${-action.effects.goldDelta || 0} gold.`,
    negotiate: `${npc.name} negotiated with an ally.`,
    sabotage: `${npc.name} worked behind the scenes to undermine a rival.`,
    research: `${npc.name} conducted research into hidden knowledge.`,
    build: `${npc.name} oversaw construction of a structure.`
  };

  return templates[action.type] || `${npc.name} performed action: ${action.type}`;
}

/**
 * M46-C1: Process all NPC autonomous activity for the world tick
 * This is called from worldEngine each tick
 */
export function processNpcAutonomy(
  npcs: any[],
  state: WorldState,
  currentTick: number
): {
  plansMade: number;
  stepsExecuted: number;
  descriptions: string[];
} {
  let plansMade = 0;
  let stepsExecuted = 0;
  const descriptions: string[] = [];

  for (const npc of npcs) {
    // Skip if no personality (not initialized for autonomy)
    if (!npc.personality) {
      npc.personality = extractNpcPersonality(npc);
      if (!npc.goals) {
        initializeNpcGoals(npc, npc.personality, currentTick);
      }
    }

    // Plan every 200 ticks or when current plan is done
    if (!npc.currentPlan || npc.lastPlanTick === undefined || currentTick - npc.lastPlanTick > 200) {
      const plan = planNpcActions(npc, state, currentTick);
      if (plan.status === 'executing') {
        plansMade++;
        npc.lastPlanTick = currentTick;
      }
    }

    // Execute action steps based on tick budget per action
    if (npc.currentPlan && npc.currentPlan.status === 'executing') {
      const nextAction = npc.currentPlan.actions[npc.currentPlan.executingStep];

      if (nextAction) {
        // Track elapsed ticks for this action
        if (npc.currentActionStartTick === undefined) {
          npc.currentActionStartTick = currentTick;
        }

        const elapsedTicks = currentTick - npc.currentActionStartTick;

        // When enough ticks have passed, execute the action
        if (elapsedTicks >= nextAction.costInTicks) {
          const result = executeNpcPlanStep(npc, state, currentTick);
          if (result.actionCompleted) {
            stepsExecuted++;
            if (result.description) {
              descriptions.push(result.description);
            }
            npc.currentActionStartTick = undefined; // Reset for next action
          }
        }
      }
    }
  }

  return { plansMade, stepsExecuted, descriptions };
}

/**
 * Phase 26 Task 2: NPC Migration Logic
 * NPCs in high-tension locations (GST > 0.8) attempt to migrate to safer biomes
 * 
 * Migration Logic:
 * - Check every 100 ticks (every 5 minutes of gameplay)
 * - 5% chance per NPC when conditions met
 * - NPC must be in location where GST > 0.8
 * - NPC relocates to lower-tension location controlled by friendly faction
 * - Triggers NPC_MIGRATED event for world state consistency
 * 
 * @param state Current WorldState
 * @returns Array of migration events for the event log
 */
export function triggerMigrationChecks(state: WorldState): Array<{
  npcId: string;
  npcName: string;
  fromLocationId: string;
  toLocationId: string;
  reason: string;
}> {
  const migrations: Array<{
    npcId: string;
    npcName: string;
    fromLocationId: string;
    toLocationId: string;
    reason: string;
  }> = [];

  if (!state.npcs || !state.locations) {
    return migrations;
  }

  const currentTick = state.tick ?? 0;
  const socialTension = state.socialTension ?? 0;

  // Only check migrations every 100 ticks (~5 minutes at 1 tick/3s)
  if (currentTick % 100 !== 0) {
    return migrations;
  }

  // High-tension check: only trigger if GST > 0.8
  if (socialTension <= 0.8) {
    return migrations;
  }

  // Iterate through NPCs and check migration eligibility
  for (const npc of state.npcs) {
    // Skip if NPC has no location
    if (!npc.locationId) continue;

    // Get current NPC location
    const currentLocation = state.locations.find(l => l.id === npc.locationId);
    if (!currentLocation) continue;

    // 5% migration chance
    if (random() > 0.05) continue;

    // Find safer destination: lower-tension location controlled by friendly faction
    const saferLocation = findSaferMigrationDestination(
      currentLocation,
      npc,
      state,
      socialTension
    );

    if (saferLocation) {
      // Record migration
      const oldLocationId = npc.locationId;
      npc.locationId = saferLocation.id;

      migrations.push({
        npcId: npc.id,
        npcName: npc.name,
        fromLocationId: oldLocationId,
        toLocationId: saferLocation.id,
        reason: `Escaped high-tension zone (GST ${socialTension.toFixed(2)}) to ${saferLocation.name}`
      });

      console.log(
        `[NpcEngine] NPC Migration: ${npc.name} migrated from ${currentLocation.name} to ${saferLocation.name}`
      );
    }
  }

  return migrations;
}

/**
 * Phase 26 Task 2: Find safer migration destination for NPC
 * Looks for locations that:
 * 1. Have lower population density (fewer active events)
 * 2. Are controlled by faction with whom NPC has positive reputation
 * 3. Have compatible biome for NPC residence
 * 
 * @param currentLocation Current NPC location
 * @param npc The NPC seeking migration
 * @param state Current WorldState
 * @param currentTension Current Global Social Tension
 * @returns Safer location if found, null otherwise
 */
function findSaferMigrationDestination(
  currentLocation: any,
  npc: NPC,
  state: WorldState,
  currentTension: number
): any | null {
  if (!state.locations || !state.factions || !state.player) {
    return null;
  }

  // Criteria for safer location:
  // 1. Different from current location
  // 2. Lower population (proxy: fewer active encounters)
  // 3. Controlled by faction NPC has positive reputation with
  // 4. Not corrupted/dangerous biome

  const safeLocations = state.locations.filter(loc => {
    // Skip current location
    if (loc.id === currentLocation.id) return false;

    // Skip dangerous/corrupted biomes during migration
    if (loc.biome === 'corrupted' || loc.biome === 'void') return false;

    // Find controlling faction
    const controllingFaction = state.factions?.find(
      f => f.controlledLocationIds?.includes(loc.id)
    );

    if (!controllingFaction) {
      // Uncontrolled (neutral) locations are acceptable fallbacks
      return true;
    }

    // NPC must have friendly relationship with controlling faction
    const npcReputation = state.player.factionReputation?.[controllingFaction.id] ?? 0;
    return npcReputation >= 0;  // Neutral or better
  });

  if (safeLocations.length === 0) {
    return null;
  }

  // Pick random safer location (or could prioritize by distance, biome compatibility, etc.)
  return safeLocations[Math.floor(random() * safeLocations.length)];
}

/**
 * Phase 26 Task 2: Register NPC_MIGRATED event in event log
 * Ensures UI and other systems reflect the population shift
 * 
 * @param migrations Array of migration records from triggerMigrationChecks()
 * @returns Array of Event objects for the mutation log
 */
export function createMigrationEvents(migrations: Array<{
  npcId: string;
  npcName: string;
  fromLocationId: string;
  toLocationId: string;
  reason: string;
}>): any[] {
  return migrations.map(m => ({
    id: `npc-migrated-${Date.now()}-${m.npcId}`,
    worldInstanceId: undefined, // Filled in by caller
    actorId: m.npcId,
    type: 'NPC_MIGRATED',
    payload: {
      npcId: m.npcId,
      npcName: m.npcName,
      fromLocationId: m.fromLocationId,
      toLocationId: m.toLocationId,
      reason: m.reason,
      timestamp: Date.now()
    },
    templateOrigin: undefined, // Filled in by caller
    timestamp: Date.now(),
    mutationClass: 'WORLD_EVENT'
  }));
}

/**
 * Phase 26 Task 2: Apply population decay modifier to abandoned locations
 * Locations where NPCs have migrated away suffer reduced trade/resource generation
 * 
 * @param state Current WorldState
 * @param abandonedLocationIds Array of location IDs where NPCs migrated from
 */
export function applyPopulationDecay(state: WorldState, abandonedLocationIds: string[]): void {
  if (!state.locations) return;

  for (const locId of abandonedLocationIds) {
    const location = state.locations.find(l => l.id === locId);
    if (!location) continue;

    // Apply decay modifier (reduces resource generation, trade activity)
    location._PopulationDecay ??= 0;
    location._PopulationDecay += 0.1;  // 10% decay per migration event

    // Cap decay at 50%
    location._PopulationDecay = Math.min(0.5, location._PopulationDecay);

    console.log(
      `[NpcEngine] Population decay applied to ${location.name}: ${(location._PopulationDecay * 100).toFixed(1)}%`
    );
  }
}

/**
 * M46-C1: Reset NPC autonomy state when epoch changes
 */
export function resetNpcAutonomy(): void {
  const planner = getGoalOrientedPlanner();
  planner.clearPlans();
}

/**
 * Phase 27 Task 3: Generate NPC trade inventory scaled by economic cycle
 */
export function generateTradeInventory(npc: NPC, state: WorldState): Array<{
  itemId: string;
  quantity: number;
  basePrice: number;
  finalPrice: number;
}> {
  const economicEngine = getEconomicSynthesisEngine();
  const getTelemetryEngine = require('./telemetryEngine').getTelemetryEngine;
  const telemetry = getTelemetryEngine().generateTelemetryPulse(state);
  const economyScore = telemetry.economyHealth ?? 50;
  const cycle = economicEngine.getEconomicCycle(economyScore);

  const baseInventory = [
    { itemId: 'potion_health', rarity: 'common', basePrice: 10, defaultQty: 5 },
    { itemId: 'potion_mana', rarity: 'common', basePrice: 10, defaultQty: 5 },
    { itemId: 'herb_bundle', rarity: 'common', basePrice: 5, defaultQty: 10 },
    { itemId: 'iron_ore', rarity: 'common', basePrice: 15, defaultQty: 3 },
    { itemId: 'copper_ingot', rarity: 'uncommon', basePrice: 25, defaultQty: 2 },
    { itemId: 'silk_cloth', rarity: 'uncommon', basePrice: 20, defaultQty: 3 },
    { itemId: 'rare_spice', rarity: 'rare', basePrice: 50, defaultQty: 1 },
    { itemId: 'enchanted_gem', rarity: 'rare', basePrice: 100, defaultQty: 1 },
    { itemId: 'ancient_scroll', rarity: 'epic', basePrice: 200, defaultQty: 1 }
  ];

  let priceMultiplier = 1.0;
  let rarityWeights = { common: 1, uncommon: 1, rare: 1, epic: 0.5 };
  let quantityScale = 1.0;

  if (cycle === EconomicCycle.BOOM) {
    priceMultiplier = 0.85;
    rarityWeights = { common: 0.8, uncommon: 1.2, rare: 1.4, epic: 0.8 };
    quantityScale = 1.3;
  } else if (cycle === EconomicCycle.RECESSION) {
    priceMultiplier = 1.3;
    rarityWeights = { common: 1.5, uncommon: 0.8, rare: 0.4, epic: 0.1 };
    quantityScale = 0.7;
  }

  const inventory: Array<{
    itemId: string;
    quantity: number;
    basePrice: number;
    finalPrice: number;
  }> = [];

  for (const item of baseInventory) {
    const weight = rarityWeights[item.rarity as keyof typeof rarityWeights] || 0;
    if (random() < weight * 0.7) {
      const quantity = Math.max(1, Math.floor(item.defaultQty * quantityScale));
      const finalPrice = Math.floor(item.basePrice * priceMultiplier);
      inventory.push({
        itemId: item.itemId,
        quantity,
        basePrice: item.basePrice,
        finalPrice
      });
    }
  }

  return inventory.length > 0 ? inventory : baseInventory.slice(0, 3);
}

/**
 * Phase 27 Task 3: Update NPC emotional state based on economic cycle
 */
export function updateNpcEconomicEmotions(npcs: NPC[], state: WorldState): void {
  if (!npcs || npcs.length === 0) return;

  const economicEngine = getEconomicSynthesisEngine();
  const getTelemetryEngine = require('./telemetryEngine').getTelemetryEngine;
  const telemetry = getTelemetryEngine().generateTelemetryPulse(state);
  const economyScore = telemetry.economyHealth ?? 50;
  const cycle = economicEngine.getEconomicCycle(economyScore);

  for (const npc of npcs) {
    if (!npc.emotionalState) {
      npc.emotionalState = {
        trust: 50,
        fear: 50,
        gratitude: 50,
        resentment: 50
      };
    }

    if (cycle === EconomicCycle.BOOM) {
      npc.emotionalState.trust = Math.min(100, npc.emotionalState.trust + 5);
      npc.emotionalState.resentment = Math.max(0, npc.emotionalState.resentment - 5);
    } else if (cycle === EconomicCycle.RECESSION) {
      npc.emotionalState.trust = Math.max(0, npc.emotionalState.trust - 5);
      npc.emotionalState.resentment = Math.min(100, npc.emotionalState.resentment + 10);
    }
  }
}
