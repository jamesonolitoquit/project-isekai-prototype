/**
 * AI DM Engine - M26: Narrative Synthesis Layer with Playstyle Adaptation
 * 
 * Transforms game state into nuanced LLM prompts for dynamic NPC dialogue generation
 * 
 * Architecture:
 * 1. Character Blueprint: Persona, quirks, voice descriptor from NPC definition
 * 2. Environmental Data: Location context, weather, season, time of day
 * 3. Resonance Weights: Trust/fear/gratitude/resentment modulation
 * 4. WTOL Filters: Information pruning based on NPC KnowledgeOf player actions
 * 5. M26: Playstyle Context: Adapt NPC dialogue based on player behavior profile
 * 
 * Example usage:
 *   const playstyle = generatePlaystyleProfile(gameState);
 *   const prompt = generateNpcPrompt('npc-1', gameState, { 
 *     playerAction: 'greeted',
 *     dialogue: 'Tell me about the merchant guild' 
 *   }, undefined, playstyle);
 *   const response = await callOpenAI(prompt);
 */

import type { WorldState, NPC } from './worldEngine';
import type { PlaystyleProfile } from './analyticsEngine';
import crypto from 'node:crypto';

/**
 * Dialogue context from player interaction
 */
export interface DialogueContext {
  playerAction?: string; // 'greeted', 'attacked', 'gave_gift', etc.
  dialogue?: string; // Player's spoken text
  questState?: string; // Phase of any active quest with this NPC
  reputationDelta?: number; // Recent reputation changes
  previousMessages?: Array<{ role: 'npc' | 'player'; text: string }>; // Conversation history
  socialTension?: number; // GST value [0-1] for narrative mutation (Task 3)
}

/**
 * NPC knowledge scope - what the NPC knows/doesn't know (WTOL - What They Ought To Learn)
 */
export interface NpcKnowledgeScope {
  seenLocations: string[]; // Locations NPC has been to
  knownNpcs: string[]; // Other NPCs they know
  heardQuests: string[]; // Quests they've heard rumors about
  playerReputation: boolean; // Do they know player's general reputation?
  playerClass: boolean; // Do they know player's class/role?
}

/**
 * Character voice blueprint
 */
export interface CharacterVoice {
  tone: 'formal' | 'casual' | 'mysterious' | 'aggressive' | 'friendly';
  speechPattern: string; // Quirks like "aye", "m'lady", repetition, etc.
  vocabulary: 'simple' | 'educated' | 'archaic' | 'technical';
  personalityAdjective: string; // "paranoid", "optimistic", "sarcastic", etc.
}

/**
 * LLM API Configuration
 */
export interface LlmConfig {
  provider: 'openai' | 'claude' | 'groq' | 'ollama' | 'mock';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Dialogue cache entry for M56-B1
 * Tracks cached NPC responses to reduce API calls
 */
export interface DialogueCacheEntry {
  promptHash: string;      // SHA-256 hash of prompt
  response: string;        // Cached LLM response
  provider: string;        // Provider that generated it
  timestamp: number;       // When it was cached (tick)
  expiresAt: number;       // Cache expiry tick (30 min / 1800 ticks)
  npcId: string;           // Associated NPC
}

/**
 * Provider health status for failover chain
 */
export interface ProviderHealthStatus {
  provider: string;        // 'openai' | 'groq' | 'ollama' | etc.
  healthy: boolean;        // Current health status
  lastCheckTick: number;   // When last health check ran
  errorCount: number;      // Consecutive errors
  responseTimeMs: number;  // Average response time
}

/**
 * Dialogue cache metrics for session analytics
 */
export interface DialogueCacheMetrics {
  totalCalls: number;      // Total LLM calls made
  cacheHits: number;       // Successful cache hits
  cacheMisses: number;     // Cache misses requiring API call
  hitRate: number;         // Percentage of hits (0-100)
  averageResponseTimeMs: number; // Avg time for API calls
  providersUsed: Record<string, number>; // Provider call count
}

/**
 * Global dialogue cache and metrics - M56-B1
 */
const dialogueCache = new Map<string, DialogueCacheEntry>();
const dialogueCacheMetrics: DialogueCacheMetrics = {
  totalCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  hitRate: 0,
  averageResponseTimeMs: 0,
  providersUsed: {}
};
const providerHealthStatus: Map<string, ProviderHealthStatus> = new Map([
  ['openai', { provider: 'openai', healthy: true, lastCheckTick: 0, errorCount: 0, responseTimeMs: 0 }],
  ['groq', { provider: 'groq', healthy: true, lastCheckTick: 0, errorCount: 0, responseTimeMs: 0 }],
  ['ollama', { provider: 'ollama', healthy: true, lastCheckTick: 0, errorCount: 0, responseTimeMs: 0 }],
  ['claude', { provider: 'claude', healthy: true, lastCheckTick: 0, errorCount: 0, responseTimeMs: 0 }]
]);

/**
 * Generate SHA-256 hash of prompt for cache key
 */
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

/**
 * Check provider health via HTTP endpoint
 */
export async function checkProviderHealth(provider: string, baseUrl?: string, apiKey?: string): Promise<boolean> {
  try {
    let endpoint = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (provider === 'openai') {
      endpoint = 'https://api.openai.com/v1/models';
      headers['Authorization'] = `Bearer ${apiKey || process.env.OPENAI_API_KEY}`;
    } else if (provider === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/models';
      headers['Authorization'] = `Bearer ${apiKey || process.env.GROQ_API_KEY}`;
    } else if (provider === 'ollama') {
      endpoint = (baseUrl || 'http://localhost:11434') + '/api/tags';
    } else if (provider === 'claude') {
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey || process.env.ANTHROPIC_API_KEY || '';
      headers['anthropic-version'] = '2023-06-01';
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      timeout: 5000
    } as any);

    const healthy = response.ok;
    const status = providerHealthStatus.get(provider);
    if (status) {
      status.healthy = healthy;
      status.errorCount = healthy ? 0 : Math.min(status.errorCount + 1, 3);
      status.lastCheckTick = Date.now();
    }
    return healthy;
  } catch {
    const status = providerHealthStatus.get(provider);
    if (status) {
      status.healthy = false;
      status.errorCount = Math.min(status.errorCount + 1, 3);
    }
    return false;
  }
}

/**
 * Get current dialogue cache metrics - M56-B1
 */
export function getDialogueCacheMetrics(): DialogueCacheMetrics {
  return { ...dialogueCacheMetrics };
}

/**
 * Clear dialogue cache (for session reset or memory management)
 */
export function clearDialogueCache(): void {
  dialogueCache.clear();
  dialogueCacheMetrics.totalCalls = 0;
  dialogueCacheMetrics.cacheHits = 0;
  dialogueCacheMetrics.cacheMisses = 0;
  dialogueCacheMetrics.hitRate = 0;
}

/**
 * Load provider configuration from localStorage (set via WeaverSettings)
 * Uses base64 encryption for sensitive fields
 */
function loadProviderConfigFromStorage(): Partial<LlmConfig> | null {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null; // Server-side rendering or no localStorage
    }
    const stored = localStorage.getItem('isekai_weaver_config');
    if (!stored) return null;
    const config = JSON.parse(Buffer.from(stored, 'base64').toString('utf-8'));
    return {
      provider: config.provider as any,
      apiKey: config.apiKey,
      model: config.modelName,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    };
  } catch {
    return null;
  }
}

/**
 * Call LLM API to generate NPC dialogue response
 * Supports multiple providers with priority fallback chain: OpenAI → Groq → Ollama → Template Mock
 * Implements dialogue cache with M56-B1 cache tracking (target: >90% hit rate)
 */
export async function callLlmApi(
  prompt: string,
  config?: Partial<LlmConfig>,
  currentTick: number = Date.now()
): Promise<string> {
  // Try to load player config from WeaverSettings (localStorage)
  const playerConfig = loadProviderConfigFromStorage();
  
  const fullConfig: LlmConfig = {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.8,
    maxTokens: 150,
    ...playerConfig,  // Override with player config if available
    ...config         // Override with explicit config if provided
  };
  
  dialogueCacheMetrics.totalCalls++;

  // Check cache first (M56-B1 optimization)
  const promptHash = hashPrompt(prompt);
  const cachedEntry = dialogueCache.get(promptHash);
  if (cachedEntry && cachedEntry.expiresAt > currentTick) {
    dialogueCacheMetrics.cacheHits++;
    dialogueCacheMetrics.hitRate = Math.round((dialogueCacheMetrics.cacheHits / dialogueCacheMetrics.totalCalls) * 100);
    return cachedEntry.response;
  }
  dialogueCacheMetrics.cacheMisses++;
  dialogueCacheMetrics.hitRate = Math.round((dialogueCacheMetrics.cacheHits / dialogueCacheMetrics.totalCalls) * 100);

  // If mock mode, return a procedural response
  if (fullConfig.provider === 'mock') {
    return mockLlmResponse(prompt);
  }

  // Get API key from environment or config
  const apiKey = fullConfig.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey && (fullConfig.provider as string) !== 'mock') {
    console.warn('LLM API key not found. Using mock response.');
    return mockLlmResponse(prompt);
  }

  try {
    let response = '';
    const startTime = Date.now();
    const provider = fullConfig.provider as string;

    // Priority fallback chain: OpenAI → Groq → Ollama → Template Mock
    if (fullConfig.provider === 'openai') {
      response = await callOpenAiApi(prompt, apiKey || '', fullConfig);
      dialogueCacheMetrics.providersUsed.openai = (dialogueCacheMetrics.providersUsed.openai || 0) + 1;
    } else if (fullConfig.provider === 'claude') {
      response = await callClaudeApi(prompt, apiKey || '', fullConfig);
      dialogueCacheMetrics.providersUsed.claude = (dialogueCacheMetrics.providersUsed.claude || 0) + 1;
    } else if (fullConfig.provider === 'groq') {
      response = await callGroqApi(prompt, apiKey || '', fullConfig);
      dialogueCacheMetrics.providersUsed.groq = (dialogueCacheMetrics.providersUsed.groq || 0) + 1;
    } else if (fullConfig.provider === 'ollama') {
      response = await callOllamaApi(prompt, fullConfig);
      dialogueCacheMetrics.providersUsed.ollama = (dialogueCacheMetrics.providersUsed.ollama || 0) + 1;
    }

    if (!response) {
      // Fallback to next provider in chain
      if (fullConfig.provider !== 'ollama') {
        console.warn(`${provider} failed, falling back to next provider`);
        return await callLlmApi(prompt, { ...config, provider: fullConfig.provider === 'openai' ? 'groq' : 'ollama' }, currentTick);
      }
      return mockLlmResponse(prompt);
    }

    // Cache the response (30 min expiry = 1800 ticks at 1 tick/sec)
    const responseTimeMs = Date.now() - startTime;
    dialogueCache.set(promptHash, {
      promptHash,
      response,
      provider,
      timestamp: currentTick,
      expiresAt: currentTick + 1800,
      npcId: 'unknown'
    });

    // Update provider metrics
    const status = providerHealthStatus.get(provider);
    if (status) {
      status.responseTimeMs = (status.responseTimeMs + responseTimeMs) / 2;
      status.errorCount = 0;
    }

    return response;
  } catch (error) {
    const provider = fullConfig.provider as string;
    console.error(`LLM API error (${provider}):`, error);
    
    // Update provider error count
    const status = providerHealthStatus.get(provider);
    if (status) {
      status.errorCount = Math.min(status.errorCount + 1, 3);
    }

    // Fallback to next provider in chain
    if (fullConfig.provider !== 'ollama' && fullConfig.provider !== 'mock') {
      return await callLlmApi(prompt, { ...config, provider: fullConfig.provider === 'openai' ? 'groq' : 'ollama' }, currentTick);
    }

    return mockLlmResponse(prompt);
  }
}

/**
 * Call OpenAI API (GPT-4 or GPT-3.5-turbo)
 */
async function callOpenAiApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const model = config.model || 'gpt-4-turbo-preview';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  return data?.choices?.[0]?.message?.content || mockLlmResponse(prompt);
}

/**
 * Call Claude/Anthropic API
 */
async function callClaudeApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  const model = config.model || 'claude-3-sonnet-20240229';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error (${response.status}): ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  return data?.content?.[0]?.text || mockLlmResponse(prompt);
}

/**
 * Call Groq API (LLaMA 3 via fast inference)
 * M56-B1: Provider chain support with Mixtral-8x7b-32768
 */
async function callGroqApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1';
  const model = config.model || 'mixtral-8x7b-32768';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9,
      frequency_penalty: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  return (data?.choices?.[0]?.message?.content as string) || '';
}

/**
 * Call Ollama API (local inference endpoint)
 * M56-B1: Local provider for offline/self-hosted deployments
 */
async function callOllamaApi(
  prompt: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  const model = config.model || 'llama2';
  const temperature = config.temperature ?? 0.8;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  return (data?.response as string) || '';
}

/**
 * Generate mock LLM response when API is unavailable
 * Uses procedural generation to create plausible NPC dialogue
 */
function mockLlmResponse(prompt: string): string {
  const tones = [
    '*nods thoughtfully* ',
    '*sighs* ',
    '*grins* ',
    '*looks serious* ',
    '*chuckles* ',
    '*shifts uncomfortably* ',
    '*holds your gaze* '
  ];

  const responses = [
    'I understand. That matters to me.',
    'Interesting. What brings it up?',
    'Perhaps you\'re right about that.',
    'I hadn\'t thought of it that way before.',
    'That\'s... a fair point.',
    'Very well. As you wish.',
    'Time will tell what comes of this.'
  ];

  const randomStage = tones[Math.floor(Math.random() * tones.length)];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  return `${randomStage}"${randomResponse}"`;
}

/**
 * Generate the Character Blueprint section of the prompt
 * Describes who the NPC is and how they speak
 */
function generateCharacterBlueprint(npc: NPC, voice?: CharacterVoice): string {
  const factionNote = npc.factionId ? `You are a ${npc.factionRole || 'member'} of the ${npc.factionId}.` : '';
  const toneDesc = voice?.tone || 'neutral';
  const vocabLevel = voice?.vocabulary || 'educated';
  const personalityNote = voice?.personalityAdjective ? `Your personality could be described as ${voice.personalityAdjective}.` : '';
  
  return `
## Character Blueprint: ${npc.name}
### Identity
- Role: ${npc.factionRole || 'Independent'}
- Importance Level: ${npc.importance || 'minor'}
${factionNote ? `- Faction Affiliation: ${factionNote}` : ''}

### Voice & Speech
- Tone: ${toneDesc} (speak in a ${toneDesc} manner)
- Vocabulary: ${vocabLevel} (use ${vocabLevel} language)
- Speech Pattern: ${voice?.speechPattern || 'standard'}
${personalityNote ? `- Personality: ${personalityNote}` : ''}

### Dialogue Guidelines
- Stay in character at all times
- React authentically to the player's actions and words
- Remember your relationship with the player (see Emotional State below)
`.trim();
}

/**
 * Generate the Environmental Context section
 * Situational awareness for the NPC
 */
function generateEnvironmentalContext(state: WorldState, npc: NPC, dialogueContext?: DialogueContext): string {
  const currentLocation = state.locations?.find(l => l.id === npc.locationId);
  const weather = state.weather || 'clear';
  const dayPhase = state.dayPhase || 'day';
  const season = state.season || 'spring';
  const currentHour = state.hour || 12;
  
  let environmentNote = '';
  if (currentLocation) {
    environmentNote = `You are currently in ${currentLocation.name}.`;
  }

  // BETA: Add epoch context
  let epochNote = '';
  if (state.epochMetadata) {
    epochNote = `\n- Epoch: ${state.epochMetadata.theme} (Year ${state.epochMetadata.chronologyYear})`;
  }
  
  return `
## Environmental Context
### Setting
${environmentNote}${epochNote}
- Weather: ${weather}
- Time: ${currentHour}:00 (${dayPhase})
- Season: ${season}

### Atmosphere
- The world feels: ${generateAtmosphereFromTension(state)}
- Recent events in this area: ${generateRecentEventsNote(state, npc)}
`.trim();
}

/**
 * Generate description of world tension/atmosphere
 */
function generateAtmosphereFromTension(state: WorldState): string {
  const tension =  calculateQuickTension(state);
  
  if (tension > 75) return 'tense and dangerous, on the edge of conflict';
  if (tension > 50) return 'uneasy, with undercurrents of unrest';
  if (tension > 25) return 'somewhat unsettled, with occasional rumors';
  return 'peaceful and calm';
}

/**
 * Quick tension calculation helper
 */
function calculateQuickTension(state: WorldState): number {
  let tension = 0;
  const activeConflicts = state.factionConflicts?.filter((c: any) => c.active) || [];
  tension += activeConflicts.length * 15;
  
  let activeScarCount = 0;
  for (const location of state.locations || []) {
    const scars = location.activeScars || [];
    activeScarCount += scars.length;
  }
  tension += Math.min(30, activeScarCount * 10);
  
  return Math.max(0, Math.min(100, tension));
}

/**
 * Generate recent events context
 */
function generateRecentEventsNote(state: WorldState, npc: NPC): string {
  const conflicts = state.factionConflicts?.filter((c: any) => c.active) || [];
  if (conflicts.some(c => c.factionIds?.includes(npc.factionId))) {
    return 'Armed conflict involving your faction';
  }
  
  const scars = state.locations?.flatMap((l: any) => (l.activeScars || []).map(s => s.description)) || [];
  if (scars.length > 0) {
    return scars.slice(0, 2).join('; ');
  }
  
  return 'No major disturbances';
}

/**
 * Generate the Resonance/Emotional State section
 * Modulates NPC behavior based on emotional state toward player
 */
function generateResonanceWeights(npc: NPC, dialogueContext?: DialogueContext): string {
  const emotionalState = npc.emotionalState || {
    trust: 50,
    fear: 50,
    gratitude: 50,
    resentment: 50
  };

  const { trust, fear, gratitude, resentment } = emotionalState;
  
  let emotionalTone = '';
  if (trust > 70 && gratitude > 70) {
    emotionalTone = 'The NPC genuinely likes you and wants to help.';
  } else if (fear > 70) {
    emotionalTone = 'The NPC is visibly nervous or wary around you.';
  } else if (resentment > 70) {
    emotionalTone = 'The NPC holds a grudge and speaks with underlying hostility.';
  } else if (trust > 60) {
    emotionalTone = 'The NPC is friendly and open.';
  } else if (fear > 60 || resentment > 60) {
    emotionalTone = 'The NPC is guarded and somewhat suspicious.';
  } else {
    emotionalTone = 'The NPC is neutral, polite but distant.';
  }

  // Dynamic reaction modifiers based on player action
  let reactionModifier = '';
  if (dialogueContext?.playerAction === 'gave_gift' && gratitude > 60) {
    reactionModifier = 'The NPC is particularly pleased and friendly right now.';
  } else if (dialogueContext?.playerAction === 'attacked') {
    reactionModifier = `The NPC is clearly disturbed and may refuse to talk. React with appropriate alarm/anger.`;
  } else if (dialogueContext?.reputationDelta && dialogueContext.reputationDelta > 10) {
    reactionModifier = `The NPC recently heard something positive about you. Respond with cautious optimism.`;
  } else if (dialogueContext?.reputationDelta && dialogueContext.reputationDelta < -10) {
    reactionModifier = `The NPC recently heard something negative about you. Show appropriate skepticism or hostility.`;
  }

  return `
## Resonance & Emotional State
### Current Feelings Toward Player
- Trust level: ${trust}/100 ${trustDescriptor(trust)}
- Fear level: ${fear}/100 ${fearDescriptor(fear)}
- Gratitude: ${gratitude}/100
- Resentment: ${resentment}/100

### Emotional Tone
${emotionalTone}
${reactionModifier ? `\n### Recent Context\n${reactionModifier}` : ''}

### Behavioral Modulation
Based on the above emotional state, respond with authenticity:
- Do NOT ignore or override your feelings toward this player
- If afraid, show nervousness in your mannerisms and speech
- If grateful, be more helpful and open
- If resentful, let it show in subtle ways (withholding info, reluctance, sarcasm)
`.trim();
}

/**
 * Quick descriptor for trust level
 */
function trustDescriptor(trust: number): string {
  if (trust > 75) return '(Very High - treats you like an ally)';
  if (trust > 50) return '(Moderate - sees you as generally trustworthy)';
  if (trust < 25) return '(Very Low - views you with suspicion)';
  if (trust < 50) return '(Low - cautious around you)';
  return '(Neutral - no strong feelings)';
}

/**
 * Quick descriptor for fear level
 */
function fearDescriptor(fear: number): string {
  if (fear > 75) return '(Very High - acutely afraid of you)';
  if (fear > 50) return '(Moderate - somewhat nervous)';
  if (fear < 25) return '(Very Low - completely at ease)';
  if (fear < 50) return '(Low - mildly cautious)';
  return '(Neutral - no particular fear)';
}

/**
 * Generate WTOL (What They Ought To Learn) filters
 * Restricts what NPCs can know about the world
 */
function generateWTOLFilters(npc: NPC, state: WorldState, knowledgeScope?: NpcKnowledgeScope): string {
  const seenLocations = knowledgeScope?.seenLocations || [];
  const knownNpcs = knowledgeScope?.knownNpcs || [];

  return `
## Information Boundaries (WTOL - What They Ought To Learn)
### What This NPC Knows
- Locations they've been: ${seenLocations.length > 0 ? seenLocations.join(', ') : 'only their current location'}
- Other NPCs they know about: ${knownNpcs.length > 0 ? knownNpcs.join(', ') : 'few people'}
- Rumors they've heard: Basic gossip from their local area only
${knowledgeScope?.playerReputation ? '- They know your general reputation in town' : '- They know little about your background'}
${knowledgeScope?.playerClass ? '- They can see/know your class/profession' : '- Your abilities are somewhat mysterious to them'}

### Strict Constraints
- DO NOT reveal information outside this NPC's knowledge scope
- DO NOT break character to explain game mechanics
- DO NOT confirm player theories unless this NPC would reasonably know
- DO NOT fabricate detailed lore beyond what fits this NPC's life
- DO describe physical details, emotions, and sensory information
- DO respond authentically to the player's actions and tone
`.trim();
}

/**
 * Generate conversation history context
 */
function generateConversationHistory(context: DialogueContext): string {
  if (!context.previousMessages || context.previousMessages.length === 0) {
    return '### First Meeting\nThis is the first time the player has spoken to you in this conversation.';
  }

  let history = '### Recent Conversation\n';
  for (const msg of context.previousMessages.slice(-4)) { // Last 4 messages only
    const speaker = msg.role === 'npc' ? 'You' : 'Player';
    history += `**${speaker}**: ${msg.text}\n`;
  }

  return history;
}

/**
 * M26: Generate playstyle context for adaptive NPC dialogue
 * Adapts NPC tone and behavior based on observed player behavior patterns
 */
function generatePlaystyleContext(npc: NPC, playstyle: PlaystyleProfile): string {
  const { dominantPlaystyle, characterProfile, moralAlignment, riskAssessment } = playstyle;
  
  let npcAdjustment = '';
  let toneShift = '';
  let responseStrategy = '';

  // Adjust NPC behavior based on player playstyle
  switch (dominantPlaystyle) {
    case 'combatant':
      npcAdjustment = `The player shows strong combat prowess and prefers direct action (${characterProfile.combatFrequency}% combat).`;
      toneShift = 'Respect physical capability; mention combat credentials. Be direct and honor strength.';
      responseStrategy = 'They appreciate straightforward conversation and military/tactical discussion. Avoid lengthy philosophy.';
      break;

    case 'socialite':
      npcAdjustment = `The player is a skilled negotiator and conversationalist (${characterProfile.socialFrequency}% social interactions).`;
      toneShift = 'Use more intricate language and social subtext. Engage in gossip and relationship dynamics.';
      responseStrategy = 'They read social cues well; use indirect statements and layered meaning. Include rumors and faction politics.';
      break;

    case 'explorer':
      npcAdjustment = `The player is an adventurer and explorer (${characterProfile.explorationFrequency}% exploration).`;
      toneShift = 'Show wonder and mystery. Reference distant lands and undiscovered places.';
      responseStrategy = 'They value curiosity; provide cryptic clues and environmental details. Hint at hidden areas and secrets.';
      break;

    case 'ritualist':
      npcAdjustment = `The player commands arcane and ritual magic (${characterProfile.ritualFrequency}% magical actions).`;
      toneShift = 'Acknowledge supernatural understanding. Use mystical language and cosmic references.';
      responseStrategy = 'They understand complex consequences; reference paradox, mana, and otherworldly effects. Be verbose about magical theory.';
      break;

    case 'crafter':
      npcAdjustment = `The player focuses on creation and crafting (${characterProfile.craftingFrequency}% crafting).`;
      toneShift = 'Discuss materials, techniques, and creation. Show respect for craftsmanship.';
      responseStrategy = 'They appreciate practical knowledge; discuss recipe details and material sources. Ask about their creations.';
      break;

    case 'balanced':
      npcAdjustment = `The player is well-rounded with diverse interests.`;
      toneShift = 'Remain adaptable; mix conversational styles based on topic.';
      responseStrategy = 'They approach situations from multiple angles. Offer varied options and acknowledge flexibility.';
      break;
  }

  // Moral alignment affect
  let alignmentInfluence = '';
  if (moralAlignment.alignment > 20) {
    alignmentInfluence = 'The player\'s actions suggest good intentions; they might respond to appeals to honor or mercy. Good NPCs trust them.';
  } else if (moralAlignment.alignment < -20) {
    alignmentInfluence = 'The player\'s actions are self-serving or cruel; they are feared. Evil NPCs respect ruthlessness.';
  } else {
    alignmentInfluence = 'The player is pragmatic; they act based on circumstances rather than principle.';
  }

  // Risk profile affect
  const riskInfluence = riskAssessment.riskTakingRatio > 0.3
    ? 'This player takes bold risks: they might attempt unlikely actions. Show respect for bravery, even if foolish.'
    : 'This player is careful and methodical: they calculate before acting. They appreciate strategic advice.';

  const sections = [
    `## Player Persona (Observed Behavioral Profile)`,
    npcAdjustment,
    '',
    `### Adjust Your Dialogue Tone`,
    toneShift,
    '',
    `### How You Respond`,
    responseStrategy,
    '',
    `### Moral Reading`,
    alignmentInfluence,
    '',
    `### Risk Profile`,
    riskInfluence
  ];

  return sections.join('\n');
}

/**
 * BETA: Generate epoch-specific context for NPC dialogue
 * Flavors dialogue based on the current era's theme and narrative focus
 */
function generateEpochContext(state: WorldState): string {
  if (!state.epochMetadata) {
    return ''; // No epoch context if not defined
  }

  const { theme, chronologyYear, description } = state.epochMetadata;
  let epochDialogueFlavor = '';

  // Generate tone/message based on epoch theme
  if (theme.includes('Fracture')) {
    epochDialogueFlavor = 'The world reels from paradox. NPCs feel uncertainty and fear. References to "the breaking" and "before the fracture" are common.';
  } else if (theme.includes('Waning')) {
    epochDialogueFlavor = 'Magic fades. NPCs speak of "the old ways" with nostalgia. There\'s a sense of entropy—things are quieter, slower, dimmer.';
  } else if (theme.includes('Twilight')) {
    epochDialogueFlavor = 'The age of magic has ended. A new darkness rises. NPCs are desperate, pragmatic. Old legends are invoked; new powers are feared.';
  } else if (theme.includes('Restoration')) {
    epochDialogueFlavor = 'The world rebuilds. NPCs speak of hope but also loss. Recent scars are visible; community is rebuilding.';
  } else {
    epochDialogueFlavor = `The world is in flux. The current era is marked by: ${theme}.`;
  }

  return `
## Epoch Context (BETA: Chronicle Awareness)
### Current Era
- **Theme**: ${theme}
- **Year**: ${chronologyYear}
- **Historical Note**: ${description || 'Check the lore for context'}

### Dialogue Flavor
${epochDialogueFlavor}

**Important**: You are a being living in Year ${chronologyYear}. You know the history up to this point but not beyond. Reference events and attitudes appropriate to this era.
`.trim();
}

/**
 * Phase 25 Task 3: Generate Global Social Tension narrative context
 * Modifies NPC dialogue based on world social state
 * 
 * Thresholds:
 * - GST > 0.75: Paranoid mode (distrust, short sentences, defensive)
 * - 0.4 < GST <= 0.75: Cautious mode (measured, careful)
 * - GST <= 0.4: Peaceful mode (warm, welcoming, open)
 */
function generateGstNarrativeContext(socialTension?: number): string {
  if (socialTension === undefined || socialTension <= 0) {
    return '';
  }

  const gstLevel = Math.min(1.0, socialTension);
  let modeInstruction = '';
  let emotionalState = '';
  let speechModifier = '';

  if (gstLevel > 0.75) {
    // PARANOID MODE - High social chaos
    modeInstruction = `
## Social Tension Context: PARANOID MODE
The world is in social chaos (Tension: ${(gstLevel * 100).toFixed(1)}%). Trust is fragile. People are suspicious.`;
    emotionalState = `
**Your Emotional State**: Guarded, anxious, defensive. You suspect hidden motives. You second-guess friendly overtures.
**Your Assumptions**: People are unreliable. Betrayal is always possible. Information is currency and leverage.`;
    speechModifier = `
**Speech Adjustments**:
- Use short, clipped sentences
- Express suspicion overtly ("Trust? That's a luxury.")
- Withhold information unless absolutely necessary
- Question the player's motives frequently
- References to danger, betrayal, or deception are natural`;
  } else if (gstLevel > 0.4) {
    // CAUTIOUS MODE - Moderate tension
    modeInstruction = `
## Social Tension Context: CAUTIOUS MODE
The world feels uncertain (Tension: ${(gstLevel * 100).toFixed(1)}%). People are careful with trust.`;
    emotionalState = `
**Your Emotional State**: Measured, thoughtful, reserved. You're weighing the player's trustworthiness. You reveal information slowly.
**Your Assumptions**: Caution is wisdom. Not all offers are genuine. Verify intentions before committing.`;
    speechModifier = `
**Speech Adjustments**:
- Use measured, deliberate tone
- Express conditional cooperation ("Help me first, then we'll talk")
- Ask probing questions before responding
- Reference recent tensions or conflicts in the world
- Show interest but maintain boundaries`;
  } else {
    // PEACEFUL MODE - Low tension
    modeInstruction = `
## Social Tension Context: PEACEFUL MODE
The world feels harmonious (Tension: ${(gstLevel * 100).toFixed(1)}%). People are more open and trusting.`;
    emotionalState = `
**Your Emotional State**: Open, friendly, willing to help. You assume good intentions. You're eager to connect.
**Your Assumptions**: Cooperation benefits everyone. The player's quest likely aligns with the greater good.`;
    speechModifier = `
**Speech Adjustments**:
- Use warm, welcoming tone
- Offer help readily ("I'd be happy to assist")
- Share information freely unless sensitive
- Reference community and shared purpose
- Show genuine interest in the player's wellbeing`;
  }

  return `${modeInstruction}${emotionalState}${speechModifier}`;
}

/**
 * Main synthesis function: Generates a comprehensive LLM prompt for NPC dialogue
 * 
 * @param npcId - The NPC's ID
 * @param state - Current WorldState
 * @param context - Dialogue context from player interaction

 * @param knowledgeScope - Optional WTOL scope limiting NPC knowledge
 * @returns Full prompt string for LLM
 */
export function generateNpcPrompt(
  npcId: string,
  state: WorldState,
  context?: DialogueContext,
  knowledgeScope?: NpcKnowledgeScope,
  playstyleProfile?: PlaystyleProfile
): string {
  const npc = state.npcs?.find(n => n.id === npcId);
  if (!npc) {
    throw new Error(`NPC with ID ${npcId} not found in world state`);
  }

  // Build voice descriptor from NPC faction/personality
  const voice = deriveVoiceFromNpc(npc);

  const sections = [
    '# NPC Dialogue Synthesis Prompt',
    '## System Instructions',
    'You are roleplaying an NPC in a fantasy RPG. Generate authentic, in-character dialogue that:',
    '- Reflects the character sheet below',
    '- Acknowledges the current emotional state toward the player',
    '- Respects information boundaries (you don\'t know things outside your experience)',
    '- Uses sensory details and authentic emotional reactions',
    '- Never breaks character or acknowledges this prompt',
    '',
    generateCharacterBlueprint(npc, voice),
    '',
    generateEnvironmentalContext(state, npc, context),
    '',
    // BETA: Add epoch context
    generateEpochContext(state),
    '',
    // BETA: Add legend/ancestor context for Soul Echo NPCs and faction leaders
    generateLegendContext(npc, state),
    '',
    generateResonanceWeights(npc, context),
    '',
    // Phase 25 Task 3: Add GST narrative mutation context
    generateGstNarrativeContext(context?.socialTension),
    '',
    generateWTOLFilters(npc, state, knowledgeScope),
  ];

  // M26: Add playstyle context if available
  if (playstyleProfile) {
    sections.push('');
    sections.push(generatePlaystyleContext(npc, playstyleProfile));
  }

  // Add conversation history if present
  if (context?.previousMessages) {
    sections.push('');
    sections.push(generateConversationHistory(context));
  }

  // Add current dialogue prompt
  if (context?.dialogue) {
    sections.push('');
    sections.push('## Current Dialogue');
    sections.push(`**Player says**: "${context.dialogue}"`);
    sections.push('');
    sections.push('**Output your response below.** Include stage directions like *[sighs]* or *[looks away]* for narrative flavor:');
  }

  return sections.join('\n');
}

/**
 * Derive voice characteristics from NPC faction/personality
 */
function deriveVoiceFromNpc(npc: NPC): CharacterVoice {
  const personality = npc.personality || {};
  const factionRole = npc.factionRole || 'member';

  // Derive tone from faction and personality
  let tone: CharacterVoice['tone'] = 'casual';
  if (factionRole === 'leader') tone = 'formal';
  if (factionRole === 'soldier') tone = 'aggressive';
  if (factionRole === 'informant') tone = 'mysterious';
  if (factionRole === 'merchant') tone = 'friendly';

  // Vocabulary level from importance/role
  let vocabulary: CharacterVoice['vocabulary'] = 'educated';
  if (factionRole === 'peasant' || factionRole === 'guard') vocabulary = 'simple';
  if (factionRole === 'scholar' || factionRole === 'noble') vocabulary = 'archaic';

  // Speech pattern quirk
  const quirks = ['', 'aye', 'm\'lord/m\'lady', 'eh?', '*chuckles*', 'forsooth', 'innit'];
  const speechPattern = quirks[Math.floor(Math.random() * quirks.length)];

  return {
    tone,
    vocabulary,
    speechPattern,
    personalityAdjective: derivePersonalityFromEmotions(npc)
  };
}

/**
 * Derive personality adjective from NPC emotional state
 */
function derivePersonalityFromEmotions(npc: any): string {
  const emotions = npc.emotionalState || { trust: 50, fear: 50, resentment: 50 };

  if (emotions.fear > 70) return 'anxious';
  if (emotions.resentment > 70) return 'bitter';
  if (emotions.trust > 70) return 'optimistic';
  if (emotions.gratitude > 70) return 'grateful';

  return 'neutral';
}

/**
 * Parse LLM response into structured dialogue
 * Separates narrative stage directions from spoken dialogue
 * 
 * Example input:
 *   "*looks around nervously* I... I didn't expect to see you here. What do you want?"
 * 
 * Returns:
 *   { stageDirection: 'looks around nervously', dialogue: 'I... I didn\'t expect to see you here. What do you want?' }
 */
export function parseNpcResponse(response: string): { stageDirection?: string; dialogue: string } {
  const stageDirectionRegex = /^\*([^*]+)\*\s+(.*)$/;
  const match = response.match(stageDirectionRegex);

  if (match) {
    return {
      stageDirection: match[1],
      dialogue: match[2]
    };
  }

  return {
    dialogue: response.trim()
  };
}

/**
 * Utility: Apply emotional decay over time
 * Safe to call on every dialogue resolution - only decays if enough time passed
 */
export function applyEmotionalDecay(npc: any, state: WorldState, decayPerDay: number = 2): void {
  if (!npc.emotionalState) return;

  const lastDecay = npc.lastEmotionalDecay || 0;
  const ticksPerDay = 1440;
  const timeSinceDecay = (state.tick ?? 0) - lastDecay;

  if (timeSinceDecay >= ticksPerDay) {
    const daysElapsed = Math.floor(timeSinceDecay / ticksPerDay);
    const totalDecay = decayPerDay * daysElapsed;

    // Move all emotions toward neutral (50)
    npc.emotionalState.trust = Math.max(0, Math.min(100, npc.emotionalState.trust + (npc.emotionalState.trust < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.fear = Math.max(0, Math.min(100, npc.emotionalState.fear + (npc.emotionalState.fear < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.gratitude = Math.max(0, Math.min(100, npc.emotionalState.gratitude + (npc.emotionalState.gratitude < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.resentment = Math.max(0, Math.min(100, npc.emotionalState.resentment + (npc.emotionalState.resentment < 50 ? totalDecay : -totalDecay)));

    npc.lastEmotionalDecay = state.tick;
  }
}

/**
 * Generate legend/ancestor context for NPC dialogue
 * Soul Echo NPCs and high-ranking faction leaders reference player ancestors
 */
export function generateLegendContext(npc: NPC, state: WorldState): string {
  const sections: string[] = [];

  // Check if NPC is a Soul Echo or high-ranking faction member
  const isSoulEcho = npc.id?.includes('soul_echo');
  const isLeader = npc.factionRole === 'leader' || npc.factionRole === 'commander';

  if (!isSoulEcho && !isLeader) {
    return ''; // Regular NPCs don't reference ancestry
  }

  // Try to load bloodline data
  try {
    const { getAllBloodlines } = require('./saveLoadEngine');
    const allBloodlines = getAllBloodlines();

    if (!allBloodlines || Object.keys(allBloodlines).length === 0) {
      return ''; // No bloodlines recorded
    }

    // Get first/only bloodline (can extend for multi-character campaigns)
    const bloodlineId = Object.keys(allBloodlines)[0];
    const bloodline = allBloodlines[bloodlineId];

    if (!bloodline?.legacyImpacts || bloodline.legacyImpacts.length === 0) {
      return '';
    }

    sections.push('## Legend Context (Ancestor References)');

    if (isSoulEcho) {
      // Soul Echo NPC IS an ancestor
      sections.push(`**You are ${npc.name}, a legendary ancestor**`);
      sections.push(`Your myth status was significant. You carry the weight of ages witnessed.`);
      
      // Find matching ancestor in deeds
      const legacyImpact = bloodline.legacyImpacts[bloodline.legacyImpacts.length - 1];
      if (legacyImpact?.deeds?.length > 0) {
        sections.push(`\nYour greatest deeds include:`);
        legacyImpact.deeds.slice(0, 2).forEach((deed: string) => {
          sections.push(`- ${deed}`);
        });
      }
    } else if (isLeader) {
      // Leader NPC acknowledges player's lineage
      sections.push('## Ancestral Knowledge');
      const mostRecentAncestor = bloodline.legacyImpacts[bloodline.legacyImpacts.length - 1];
      if (mostRecentAncestor) {
        sections.push(
          `The player carries the bloodline of ${mostRecentAncestor.canonicalName}.`
        );
        sections.push(
          `That ancestor had a myth status of ${mostRecentAncestor.mythStatus}/100.`
        );
        
        if (mostRecentAncestor.deeds?.length > 0) {
          sections.push(`\nNotable deed: "${mostRecentAncestor.deeds[0]}"`);
          sections.push(
            `You may reference this legacy in dialogue if it feels natural to the conversation.`
          );
        }
      }
    }

    return sections.join('\n');
  } catch (err) {
    console.error('[aiDmEngine] Failed to generate legend context:', err);
    return '';
  }
}

/**
 * Generate narrative flourishes for legacy discovery events
 * Triggers special narration when:
 * - Player discovers an ancestor's heirloom
 * - Player meets a Soul Echo of previous character
 * - Player visits location of ancestor's legendary deed
 */
export function generateLegacyWhisper(
  eventType: 'heirloom_discovery' | 'soul_echo_meeting' | 'legendary_location',
  context: {
    ancestorName?: string;
    itemName?: string;
    deedDescription?: string;
    locationName?: string;
    mythStatus?: number;
  }
): string {
  const sections: string[] = [];

  if (eventType === 'heirloom_discovery') {
    const { ancestorName, itemName, mythStatus } = context;
    sections.push('## Heirloom Discovery Narration');
    sections.push(`A familiar warmth emanates from the ${itemName || 'artifact'}...`);
    
    if (mythStatus && mythStatus >= 80) {
      sections.push(
        `This weapon of legend once belonged to ${ancestorName || 'a legendary hero'}.`
      );
      sections.push(
        `You feel their strength guide your hand as you lift it. The weight feels... balanced. Meant for you.`
      );
    } else if (mythStatus && mythStatus >= 50) {
      sections.push(
        `${ancestorName || 'An ancestor'} wielded this with honor.`
      );
      sections.push(
        `Holding it, you sense echoes of battles fought and victories earned.`
      );
    } else {
      sections.push(
        `Time has weathered this relic, yet it endures—a testament to ${ancestorName || 'those who came before'}.`
      );
    }
    
    sections.push(
      '\n**The player may feel compelled to use this item in critical moments, as if guided by ancestral memory.**'
    );
  } else if (eventType === 'soul_echo_meeting') {
    const { ancestorName, mythStatus } = context;
    sections.push('## Soul Echo Encounter Narration');
    sections.push(
      `Among the mists, a figure takes form—spectral, yet undeniably familiar.`
    );
    
    if (mythStatus && mythStatus >= 70) {
      sections.push(
        `"${ancestorName}..." whispers through ages. "I have waited for one of my bloodline who carries such promise."`
      );
      sections.push(
        `The spirit's form shimmers with golden light, and you sense overwhelming power restrained by time itself.`
      );
    } else {
      sections.push(
        `"${ancestorName}," the spirit speaks, recognition dawning. "Your tale is mine, yet written anew."`
      );
      sections.push(
        `There is sorrow in its voice—echoes of roads not taken, enemies not conquered.`
      );
    }
    
    sections.push(
      '\n**In this moment, the boundary between eras feels thin. Ask what you will of this phantom.**'
    );
  } else if (eventType === 'legendary_location') {
    const { deedDescription, locationName, ancestorName } = context;
    sections.push('## Legendary Location Awakening');
    sections.push(
      `You stand where ${ancestorName || 'a legend'} once stood.`
    );
    sections.push(
      `The very stones seem to remember: ${deedDescription || 'a deed of great power'}.`
    );
    
    sections.push(
      `Faint impressions linger in the air—phantom echoes of struggle, triumph, sacrifice.`
    );
    sections.push(
      `Do you feel it? The world here is different. History is alive.`
    );
    
    sections.push(
      '\n**Perception checks in this location gain +2. Enemies may sense the presence of ancestral power.**'
    );
  }

  return sections.join('\n');
}

/**
 * Check if a location contains a legendary deed marker
 */
export function getLegendaryLocationNarrative(
  locationId: string,
  state?: any
): string | null {
  // This would integrate with the world template to check for marked locations
  // For now, returns a placeholder that implementations can extend
  try {
    if (!state) return null;
    
    const deedMarkers: Record<string, { deed: string; ancestorName: string }> = {
      'dragonsfang-peak': {
        deed: 'Slew the ancient dragon that ruled these peaks',
        ancestorName: 'Unknown Hero'
      },
      'seal-of-lies': {
        deed: "Broke the curse that sealed the Oracle's lips",
        ancestorName: 'Unknown Hero'
      }
    };

    if (locationId in deedMarkers) {
      const marker = deedMarkers[locationId];
      return generateLegacyWhisper('legendary_location', {
        locationName: locationId,
        deedDescription: marker.deed,
        ancestorName: marker.ancestorName
      });
    }
  } catch (err) {
    console.error('[aiDmEngine] Failed to get legendary location narrative:', err);
  }

  return null;
}

// ============================================================================
// M31 Task 3: Co-DM Narrative Orchestration
// ============================================================================

/**
 * Represents a DM's narrative intent/directive
 */
export interface DmIntent {
  authority: 'narrator' | 'chaos' | 'neutral'; // Role/archetype
  desiredTone: 'serious' | 'dark' | 'mysterious' | 'comedic' | 'heroic';
  narrativeGoal: string; // What this DM wants to happen in the story
  constraints?: string[]; // "No sudden deaths", "Emphasize player agency", etc.
}

/**
 * Result of Co-DM synthesis
 */
export interface CoDmResponse {
  synthesizedNarrative: string;
  directionConflict: number;           // 0-1 : how much intents conflicted
  dominantAuthority: 'narrator' | 'chaos' | 'balanced';
  recommendedAction: string;           // What should happen next
  playerAgencyScore: number;            // 0-1 : how much choice player has
  dramaticIntensity: number;           // 0-1 : how intense/high-stakes
}

/**
 * Synthesize a narrative response from two DM intents
 * Useful for co-DM sessions (human + AI, or two AIs)
 *
 * Example:
 *   const narratorIntent: DmIntent = {
 *     authority: 'narrator',
 *     desiredTone: 'heroic',
 *     narrativeGoal: 'The party discovers the lost temple'
 *   };
 *   const chaosIntent: DmIntent = {
 *     authority: 'chaos',
 *     desiredTone: 'mysterious',
 *     narrativeGoal: 'An unexpected guardian blocks their path'
 *   };
 *   const response = generateCoDmResponse(narratorIntent, chaosIntent, gameState);
 */
export function generateCoDmResponse(
  intent1: DmIntent,
  intent2: DmIntent,
  gameState: WorldState
): CoDmResponse {
  // Measure conflict between intents (0 = fully aligned, 1 = fully opposed)
  const toneConflict = intent1.desiredTone !== intent2.desiredTone ? 0.3 : 0;
  const authorityConflict = intent1.authority !== intent2.authority ? 0.5 : 0;
  const directionConflict = Math.min(1, toneConflict + authorityConflict);

  // Determine dominant authority based on conflict resolution
  let dominantAuthority: 'narrator' | 'chaos' | 'balanced';
  if (directionConflict < 0.2) {
    dominantAuthority = 'balanced'; // Intents align
  } else if (intent1.authority === 'narrator' && intent2.authority === 'chaos') {
    // Classic conflict: Narrator wants structure, Chaos wants unpredictability
    dominantAuthority = directionConflict > 0.7 ? 'chaos' : 'narrator';
  } else {
    dominantAuthority = intent1.authority === 'narrator' ? 'narrator' : 
                       intent1.authority === 'neutral' ? 'balanced' : 'chaos';
  }

  // Build synthesized narrative sections
  const sections: string[] = [];

  // Opening: Acknowledge both intents
  if (dominantAuthority === 'balanced') {
    sections.push(
      `The two forces of narrative pull in harmony here—structure and uncertainty dance together.`
    );
  } else if (dominantAuthority === 'narrator') {
    sections.push(
      `The narrative arc unfolds with purpose, though whispers of chaos lurk at the edges.`
    );
  } else {
    sections.push(
      `Reality feels unstable here. Patterns collapse. Possibilities multiply without warning.`
    );
  }

  // Weave together the narrative goals
  if (intent1.narrativeGoal && intent2.narrativeGoal) {
    sections.push(
      `\n**Dual Directive:** ${intent1.narrativeGoal} ${dominantAuthority === 'balanced' ? 'alongside' : 'while'} ${intent2.narrativeGoal}`
    );
  } else {
    sections.push(`\n**Directive:** ${intent1.narrativeGoal || intent2.narrativeGoal}`);
  }

  // Generate tone-appropriate narration
  const narration = synthesizeToneNarration(intent1.desiredTone, intent2.desiredTone, dominantAuthority);
  sections.push(`\n${narration}`);

  // Merge constraints intelligently
  const mergedConstraints = [...(intent1.constraints || []), ...(intent2.constraints || [])];
  if (mergedConstraints.length > 0) {
    sections.push(`\n**Constraints:** ${mergedConstraints.join('; ')}`);
  }

  // Determine player agency based on dominant authority
  let playerAgencyScore = 0.5; // Default middle ground
  if (dominantAuthority === 'narrator') {
    playerAgencyScore = 0.7; // Narrator allows more player choice
  } else if (dominantAuthority === 'chaos') {
    playerAgencyScore = 0.4; // Chaos restricts some options
  }

  // Dramatic intensity based on tone
  const tones = [intent1.desiredTone, intent2.desiredTone];
  let dramaticIntensity = 0.5;
  if (tones.includes('dark') || tones.includes('serious')) dramaticIntensity = 0.8;
  if (tones.includes('comedic')) dramaticIntensity = 0.3;
  if (dominantAuthority === 'chaos') dramaticIntensity = Math.min(1, dramaticIntensity + 0.2);

  // Generate recommended action
  const recommendedAction = generateCoAction(intent1, intent2, dominantAuthority, gameState);

  return {
    synthesizedNarrative: sections.join('\n'),
    directionConflict,
    dominantAuthority,
    recommendedAction,
    playerAgencyScore,
    dramaticIntensity
  };
}

/**
 * Synthesize tone-appropriate narration when blending two intents
 */
function synthesizeToneNarration(tone1: string, tone2: string, dominantAuthority: string): string {
  const tones = [tone1, tone2];

  if (tones.includes('dark') && tones.includes('mysterious')) {
    return 'Shadows obscure truth. What once was clear now hides terrible secrets.';
  }

  if (tones.includes('heroic') && tones.includes('serious')) {
    return 'This moment demands courage. The stakes have never been higher.';
  }

  if (tones.includes('comedic') && tones.includes('mysterious')) {
    return 'Something ridiculous is happening, but you can\'t quite figure out what.';
  }

  if (dominantAuthority === 'chaos') {
    return 'Logic falters. Cause and effect mingle in bewildering ways.';
  }

  if (dominantAuthority === 'narrator') {
    return 'The story moves forward with purpose, revealing itself step by careful step.';
  }

  return 'Two competing realities jostle for dominance in this space.';
}

/**
 * Generate recommended action that respects both DM intents
 */
function generateCoAction(
  intent1: DmIntent,
  intent2: DmIntent,
  dominantAuthority: string,
  gameState: WorldState
): string {
  if (dominantAuthority === 'balanced') {
    return `Allow both intents to manifest: ${intent1.narrativeGoal} AND ${intent2.narrativeGoal}. Weave them together.`;
  }

  if (dominantAuthority === 'narrator') {
    return `Prioritize: ${intent1.narrativeGoal}. Use ${intent2.narrativeGoal} as a complication or subplot.`;
  }

  // dominantAuthority === 'chaos'
  return `Disrupt expectations: ${intent2.narrativeGoal} interrupts or transforms ${intent1.narrativeGoal}.`;
}

/**
 * Validate two DM intents for coherence
 * Returns list of potential conflicts
 */
export function validateCoDmIntents(intent1: DmIntent, intent2: DmIntent): string[] {
  const conflicts: string[] = [];

  // Check for direct contradictions
  if (intent1.narrativeGoal.toLowerCase() === intent2.narrativeGoal.toLowerCase()) {
    conflicts.push('Both DMs want identical outcomes—consider delegating authority to one.');
  }

  // Check for tone conflicts that might confuse players
  if (
    intent1.desiredTone === 'comedic' &&
    (intent2.desiredTone === 'dark' || intent2.desiredTone === 'serious')
  ) {
    conflicts.push('Tone clash: comedic + dark/serious may confuse player emotional investment.');
  }

  // Authority conflicts
  if (intent1.authority === intent2.authority) {
    conflicts.push('Both authorities are same type—no creative tension.');
  }

  // Constraint conflicts
  const allConstraints = [...(intent1.constraints || []), ...(intent2.constraints || [])];
  for (let i = 0; i < allConstraints.length; i++) {
    for (let j = i + 1; j < allConstraints.length; j++) {
      if (
        allConstraints[i].toLowerCase().includes('death') &&
        allConstraints[j].toLowerCase().includes('death')
      ) {
        conflicts.push(
          `Constraint conflict: "${allConstraints[i]}" and "${allConstraints[j]}" both about mortality.`
        );
      }
    }
  }

  return conflicts;
}

/**
 * M36: Adaptive Tension - Dashboard Metrics Integration
 * 
 * Links AI DM pacing to CoDmDashboard narrative metrics (Narrative Stress, Chaos Level, etc)
 * to create adaptive difficulty and pacing that responds to player engagement and story tension.
 */

/**
 * M36: Dashboard narrative metrics (consumed from CoDmDashboard.tsx)
 */
export interface DashboardNarrativeMetrics {
  narrativeStress: number;        // 0-100: Story tension accumulation
  chaosLevel: number;             // 0-100: World unpredictability
  playerEngagement: number;       // 0-100: Player activity/engagement
  interventionIntensity: number;  // 0-100: AI Director intensity
  anticipationMeter: number;      // 0-100: Expected event momentum
  resolutionProgress: number;     // 0-100: Story arc completion
  npcMoralAlignment: number;      // -100 to 100: World morality tendency
  prophecyAccuracy: number;       // 0-100: How well prophecies match events
}

/**
 * M36: Adaptive pacing configuration based on metrics
 */
export interface AdaptivePacingConfig {
  minEventFrequencyMs: number;    // Minimum time between events
  maxEventFrequencyMs: number;    // Maximum time between events
  stressScaleFactor: number;      // How much narrative stress influences pacing
  chaosScaleFactor: number;       // How much chaos influences pacing
  engagementBoost: number;        // Pacing boost when player is highly engaged
  exhaustionThreshold: number;    // Narrative stress level that triggers cooldown
}

/**
 * M36: Get the next adaptive event intensity level based on dashboard metrics
 * Returns intensity 0-100 where higher = more intense/frequent events
 */
export function getAdaptiveEventIntensity(
  metrics: DashboardNarrativeMetrics,
  config: AdaptivePacingConfig = {
    minEventFrequencyMs: 3000,
    maxEventFrequencyMs: 45000,
    stressScaleFactor: 0.4,
    chaosScaleFactor: 0.3,
    engagementBoost: 1.2,
    exhaustionThreshold: 85
  }
): number {
  // Base intensity: average of story tension metrics
  let baseIntensity = (
    metrics.narrativeStress * config.stressScaleFactor +
    metrics.chaosLevel * config.chaosScaleFactor +
    metrics.anticipationMeter * 0.2 +
    metrics.interventionIntensity * 0.1
  ) / (config.stressScaleFactor + config.chaosScaleFactor + 0.2 + 0.1);

  // Player engagement multiplier: high engagement = faster pacing
  const engagementMultiplier = 0.5 + (metrics.playerEngagement / 100) * config.engagementBoost;
  baseIntensity *= engagementMultiplier;

  // Exhaustion penalty: if stress too high, cool down pacing
  if (metrics.narrativeStress > config.exhaustionThreshold) {
    const exhaustionReduction = 0.3 + (metrics.narrativeStress - config.exhaustionThreshold) / 100 * 0.5;
    baseIntensity *= (1 - exhaustionReduction);
  }

  // Resolution progress: slow down as story arc concludes
  const resolutionDamping = 0.5 + (100 - metrics.resolutionProgress) / 100 * 0.5;
  baseIntensity *= resolutionDamping;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, baseIntensity));
}

/**
 * M36: Convert intensity (0-100) to event frequency (ms between events)
 */
export function intensityToEventFrequency(
  intensity: number,
  minMs: number = 3000,
  maxMs: number = 45000
): number {
  // Higher intensity = lower frequency (more events, closer together)
  const normalizedIntensity = Math.max(0, Math.min(100, intensity)) / 100;
  return maxMs - (maxMs - minMs) * normalizedIntensity;
}

/**
 * M36: Determine if chaos should spike (sudden event intensity jump)
 * Returns true if conditions warrant a chaos spike
 */
export function shouldSpikeChaos(
  metrics: DashboardNarrativeMetrics,
  timeSinceLastSpike: number,
  chaosSpikeCooldownMs: number = 30000
): boolean {
  // Don't spike too frequently
  if (timeSinceLastSpike < chaosSpikeCooldownMs) {
    return false;
  }

  // Spike conditions:
  // 1. Narrative stress rising fast + anticipation high
  const antStressCondition =
    metrics.narrativeStress > 70 &&
    metrics.anticipationMeter > 60 &&
    metrics.interventionIntensity < 50;

  // 2. Chaos and engagement convergence (world and player in sync)
  const convergenceCondition =
    Math.abs(metrics.chaosLevel - metrics.playerEngagement) < 20 &&
    metrics.chaosLevel > 60;

  // 3. Prophecy accuracy spike (forecasted event should happen now)
  const prophecyCondition =
    metrics.prophecyAccuracy > 75 &&
    metrics.narrativeStress > 50 &&
    metrics.anticipationMeter > 70;

  // 4. Moral inversion (world alignment flips, chaos opportunity)
  const moralFlipCondition =
    Math.abs(metrics.npcMoralAlignment) > 80 &&
    metrics.chaosLevel > 55;

  return antStressCondition || convergenceCondition || prophecyCondition || moralFlipCondition;
}

/**
 * M36: Calculate AI pacing metrics from dashboard state
 * Returns timing guidance for AI event generator
 */
export interface AIPacingGuidance {
  nextEventDelayMs: number;
  eventIntensity: number;        // 0-100
  shouldTriggerBoss: boolean;
  shouldIntroduceNpcConflict: boolean;
  shouldResolveSubplot: boolean;
  recommendedTone: 'rising' | 'plateau' | 'climax' | 'falling';
  urgencyLevel: 'calm' | 'concerned' | 'urgent' | 'critical';
  interventionStrength: number;  // How much AI should intervene (0-1)
}

export function calculateAIPacingFromMetrics(
  metrics: DashboardNarrativeMetrics,
  timeSinceLastEvent: number
): AIPacingGuidance {
  const intensity = getAdaptiveEventIntensity(metrics);
  const nextEventDelay = intensityToEventFrequency(intensity);

  // Ready for event if delay passed
  const shouldTriggerEvent = timeSinceLastEvent > nextEventDelay;

  // Boss trigger: narrative stress very high + player engaged
  const shouldTriggerBoss =
    metrics.narrativeStress > 85 &&
    metrics.playerEngagement > 70 &&
    metrics.chaosLevel > 75;

  // NPC conflict: morality divided + engagement high
  const shouldIntroduceNpcConflict =
    Math.abs(metrics.npcMoralAlignment) > 60 &&
    metrics.playerEngagement > 75 &&
    metrics.interventionIntensity < 40;

  // Subplot resolution: resolution progress high + chaos low
  const shouldResolveSubplot =
    metrics.resolutionProgress > 70 &&
    metrics.chaosLevel < 40 &&
    metrics.narrativeStress < 60;

  // Narrative tone progression
  let recommendedTone: 'rising' | 'plateau' | 'climax' | 'falling';
  if (metrics.resolutionProgress > 80) {
    recommendedTone = 'falling';  // Winding down
  } else if (metrics.narrativeStress > 85) {
    recommendedTone = 'climax';   // Peak tension
  } else if (metrics.narrativeStress > 60) {
    recommendedTone = 'plateau';  // Maintain plateau
  } else {
    recommendedTone = 'rising';   // Building
  }

  // Urgency level
  let urgencyLevel: 'calm' | 'concerned' | 'urgent' | 'critical';
  if (metrics.narrativeStress > 85) {
    urgencyLevel = 'critical';
  } else if (metrics.narrativeStress > 70) {
    urgencyLevel = 'urgent';
  } else if (metrics.narrativeStress > 50) {
    urgencyLevel = 'concerned';
  } else {
    urgencyLevel = 'calm';
  }

  // Intervention strength: how much AI should meddle (0-1)
  // High when chaos/engagement are unbalanced, low when aligned
  const chaosEngagementBalance = Math.abs(metrics.chaosLevel - metrics.playerEngagement) / 100;
  const interventionStrength = Math.min(1, chaosEngagementBalance * 1.5 + metrics.interventionIntensity / 100);

  return {
    nextEventDelayMs: Math.max(1000, nextEventDelay),
    eventIntensity: intensity,
    shouldTriggerBoss,
    shouldIntroduceNpcConflict,
    shouldResolveSubplot,
    recommendedTone,
    urgencyLevel,
    interventionStrength,
  };
}

/**
 * M36: Get AI pacing diagnostics for UI display
 */
export function getAIPacingDiagnostics(
  metrics: DashboardNarrativeMetrics,
  timeSinceLastEvent: number
): Record<string, any> {
  const guidance = calculateAIPacingFromMetrics(metrics, timeSinceLastEvent);
  const intensity = getAdaptiveEventIntensity(metrics);

  return {
    intensity,
    pacing: guidance,
    metricsSnapshot: {
      narrativeStress: metrics.narrativeStress,
      chaosLevel: metrics.chaosLevel,
      playerEngagement: metrics.playerEngagement,
      anticipationMeter: metrics.anticipationMeter,
      resolutionProgress: metrics.resolutionProgress,
    },
    eventFrequency: {
      nextEventInMs: guidance.nextEventDelayMs,
      eventsPerMinute: (60000 / guidance.nextEventDelayMs).toFixed(2),
    },
  };
}

/**
 * M36: Create default dashboard metrics (neutral state)
 */
export function createDefaultMetrics(): DashboardNarrativeMetrics {
  return {
    narrativeStress: 40,
    chaosLevel: 30,
    playerEngagement: 50,
    interventionIntensity: 25,
    anticipationMeter: 35,
    resolutionProgress: 0,
    npcMoralAlignment: 0,
    prophecyAccuracy: 50,
  };
}

