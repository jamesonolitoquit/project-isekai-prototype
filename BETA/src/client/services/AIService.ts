/**
 * AIService.ts - Centralized AI Weaver Service (Pillar 2.3)
 *
 * Purpose: Bridge the deterministic engine logic with live AI synthesis.
 * Provides multi-provider routing (Groq → Gemini fallback), intelligent retries,
 * timeout handling, and graceful fallback to static generation.
 *
 * Providers: Groq (primary), Google Gemini (fallback)
 * 
 * Phase 14 Update: Integrated promptRegistry for paradox-aware synthesis
 */

import { promptRegistry, type ItemFlavorRequest, type NpcDialogueRequest } from '../../engine/promptRegistry';

export interface AIServiceConfig {
  provider?: 'groq' | 'gemini';
  timeout?: number; // ms, default 5000
  maxRetries?: number; // default 2
  temperature?: number; // 0-1, default 0.8
  maxTokens?: number; // default 256
}

export interface SynthesisContext {
  type: 'quest_prologue' | 'npc_dialogue_glitch' | 'story_origin' | 'story_refinement' | 'world_event' | 'knowledge_gated_tutorial';
  factors: Record<string, any>;
  paradoxLevel?: number; // 0-100, affects glitch intensity
  signal?: AbortSignal; // For cancelling synthesis operations
}

export interface SynthesisResult {
  content: string;
  provider: 'groq' | 'gemini' | 'static_fallback';
  latency: number; // ms
  isRetry?: boolean;
  error?: string;
}

export interface DiagnosticResult {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  groqStatus: 'available' | 'unavailable' | 'misconfigured';
  geminiStatus: 'available' | 'unavailable' | 'misconfigured';
  groqLatency?: number; // ms
  geminiLatency?: number; // ms
  rateLimitStatus: 'available' | 'approaching_limit' | 'rate_limited';
  rateLimitRemaining: number;
  errors: string[];
  timestamp: number;
}

// Rate limiting: track API calls per provider
class RateLimiter {
  private callTimestamps: number[] = [];
  private readonly windowSize = 60000; // 1 minute
  private readonly maxCallsPerWindow = 20; // Groq free tier limit

  canMakeCall(): boolean {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(ts => now - ts < this.windowSize);
    return this.callTimestamps.length < this.maxCallsPerWindow;
  }

  recordCall(): void {
    this.callTimestamps.push(Date.now());
  }

  getAvailableInWindow(): number {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(ts => now - ts < this.windowSize);
    return Math.max(0, this.maxCallsPerWindow - this.callTimestamps.length);
  }
}

class AIService {
  private config: Required<AIServiceConfig>;
  private rateLimiter = new RateLimiter();
  private lastError: { message: string; timestamp: number } | null = null;

  constructor(config?: AIServiceConfig) {
    this.config = {
      provider: config?.provider ?? 'groq',
      timeout: config?.timeout ?? 5000,
      maxRetries: config?.maxRetries ?? 2,
      temperature: config?.temperature ?? 0.8,
      maxTokens: config?.maxTokens ?? 256,
    };
  }

  /**
   * Synthesize content based on context factors
   * Intelligently routes to appropriate synthesis method
   */
  async synthesize(context: SynthesisContext): Promise<SynthesisResult> {
    const startTime = Date.now();

    try {
      // Check if already aborted before starting
      if (context.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Route to appropriate synthesis method
      let result: string;
      let provider: SynthesisResult['provider'] = this.config.provider;

      switch (context.type) {
        case 'quest_prologue':
          result = await this.synthesizeQuestPrologue(context.factors, context.signal);
          break;
        case 'npc_dialogue_glitch':
          result = await this.synthesizeDialogueGlitch(context.factors, context.paradoxLevel ?? 0, context.signal);
          break;
        case 'story_origin':
          result = await this.synthesizeOriginStory(context.factors, context.signal);
          break;
        case 'story_refinement':
          result = await this.refineStory(context.factors, context.signal);
          break;
        case 'knowledge_gated_tutorial':
          result = await this.synthesizeKnowledgeGatedTutorial(context.factors, context.signal);
          break;
        case 'world_event':
          result = await this.synthesizeWorldEvent(context.factors, context.signal);
          break;
        default:
          throw new Error(`Unknown synthesis type: ${context.type}`);
      }

      return {
        content: result,
        provider,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      // Re-throw AbortError without fallback (component is unmounting)
      if ((error as any).name === 'AbortError') {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.lastError = { message, timestamp: Date.now() };

      // Fall back to static generation
      const fallbackContent = this.generateStaticFallback(context);
      return {
        content: fallbackContent,
        provider: 'static_fallback',
        latency: Date.now() - startTime,
        error: message,
      };
    }
  }

  /**
   * Phase 30 Task 6: Diagnostic Verification
   * Verify API connectivity and configuration before gameplay
   * Returns detailed diagnostics to help troubleshoot AI issues
   */
  async verifyConnectivity(): Promise<DiagnosticResult> {
    const diagnostics: DiagnosticResult = {
      overallStatus: 'healthy',
      groqStatus: 'available',
      geminiStatus: 'available',
      rateLimitStatus: 'available',
      rateLimitRemaining: this.rateLimiter.getAvailableInWindow(),
      errors: [],
      timestamp: Date.now()
    };

    // Check Groq connectivity
    try {
      const startTime = Date.now();
      const groqKey = this.getApiKey('GROQ');
      
      if (!groqKey) {
        diagnostics.groqStatus = 'misconfigured';
        diagnostics.errors.push('Groq API key not found (set GROQ_API_KEY env var)');
      } else {
        // Perform lightweight ping
        const response = await this.fetchWithTimeout(
          'https://api.groq.com/openai/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
          },
          3000
        );

        if (response.ok) {
          diagnostics.groqLatency = Date.now() - startTime;
          diagnostics.groqStatus = 'available';
        } else if (response.status === 401 || response.status === 403) {
          diagnostics.groqStatus = 'misconfigured';
          diagnostics.errors.push('Groq API key is invalid or expired');
        } else {
          diagnostics.groqStatus = 'unavailable';
          diagnostics.errors.push(`Groq API returned: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      diagnostics.groqStatus = 'unavailable';
      diagnostics.errors.push(`Groq connectivity error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check Gemini connectivity
    try {
      const startTime = Date.now();
      const geminiKey = this.getApiKey('GEMINI');
      
      if (!geminiKey) {
        diagnostics.geminiStatus = 'misconfigured';
        diagnostics.errors.push('Gemini API key not found (set GEMINI_API_KEY env var)');
      } else {
        // Perform lightweight ping
        const response = await this.fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          3000
        );

        if (response.ok) {
          diagnostics.geminiLatency = Date.now() - startTime;
          diagnostics.geminiStatus = 'available';
        } else if (response.status === 401 || response.status === 403) {
          diagnostics.geminiStatus = 'misconfigured';
          diagnostics.errors.push('Gemini API key is invalid or expired');
        } else {
          diagnostics.geminiStatus = 'unavailable';
          diagnostics.errors.push(`Gemini API returned: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      diagnostics.geminiStatus = 'unavailable';
      diagnostics.errors.push(`Gemini connectivity error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check rate limiting status
    if (!this.rateLimiter.canMakeCall()) {
      diagnostics.rateLimitStatus = 'rate_limited';
      diagnostics.errors.push('Rate limited: no calls available in current window');
    } else if (this.rateLimiter.getAvailableInWindow() < 5) {
      diagnostics.rateLimitStatus = 'approaching_limit';
    }

    // Set overall status
    if (diagnostics.errors.length > 0) {
      if (diagnostics.groqStatus === 'available' || diagnostics.geminiStatus === 'available') {
        diagnostics.overallStatus = 'degraded';
      } else {
        diagnostics.overallStatus = 'critical';
      }
    }

    return diagnostics;
  }

  /**
   * Synthesize a quest prologue based on context factors
   */
  private async synthesizeQuestPrologue(factors: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const { questTitle, questTemplate, factionInvolved, playerBackground, difficulty } = factors;

    const systemPrompt = `You are the Weaver's Eye, an AI narrator for Project Isekai.
Your role is to synthesize contextual quest prologues that feel unique and memorable.
Generate prologues that:
- Reference specific factions and the player's background when relevant
- Match the difficulty tone (epic for high difficulty, intimate for low)
- Are 2-3 sentences maximum, vivid and atmospheric
Keep the language dark, mystical, and world-appropriate.`;

    const userPrompt = `Synthesize a quest prologue:
- Title: ${questTitle}
- Template: ${questTemplate}
- Factions Involved: ${factionInvolved?.join(', ') || 'none'}
- Player Background: ${playerBackground || 'unknown'}
- Difficulty: ${difficulty || 'medium'}

Create a single, evocative prologue sentence that sets the scene.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Synthesize NPC dialogue with paradox-driven glitches
   * At high paradox, dialogue should repeat, stutter, or show temporal confusion
   */
  private async synthesizeDialogueGlitch(factors: Record<string, any>, paradoxLevel: number, signal?: AbortSignal): Promise<string> {
    const { baseDialogue, npcName, emotionalState, paradoxMarkers } = factors;
    const glitchIntensity = Math.min(100, Math.max(0, paradoxLevel));

    // If paradox is very high, apply glitch post-processing
    const glitchTrigger = glitchIntensity > 60;

    if (!glitchTrigger) {
      // Low-to-medium paradox: return base dialogue with slight uncertainty
      return baseDialogue;
    }

    const systemPrompt = `You are simulating temporal distortion in an NPC's speech patterns.
At high paradox levels, NPCs experience fractured timelines and may:
- Repeat words or stutters
- Mix past/present tense
- Show awareness of timeline splits
- Reference "what I said" vs "what I will say"
Your output should be the SAME dialogue but with glitch artifacts applied.
Keep it 1-2 sentences maximum.`;

    const userPrompt = `Apply paradox glitch effect to this NPC dialogue (intensity: ${glitchIntensity}%):
"${baseDialogue}"

NPC: ${npcName}
Emotional State: ${emotionalState || 'neutral'}
Paradox Markers: ${paradoxMarkers?.join(', ') || 'none'}

Apply glitch effects proportional to the paradox intensity. Higher intensity = more severe stuttering/repetition.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Synthesize character origin story
   */
  private async synthesizeOriginStory(factors: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const { characterName, race, archetype, additionalContext } = factors;

    const systemPrompt = `You are a creative fantasy writer specializing in character backstories.
Generate immersive, concise yet evocative origin stories for tabletop RPG characters.
Stories should be 100-200 words, written in first person, and capture the essence of the character's archetype.
Keep the tone dark and mystical, befitting Project Isekai's setting.`;

    const userPrompt = `Generate an origin story for:
- Character Name: ${characterName}
- Race: ${race}
- Archetype: ${archetype}
${additionalContext ? `- Additional Context: ${additionalContext}` : ''}

Write a compelling first-person backstory that explains how they arrived at this moment. Be creative and evocative.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Refine an existing story based on feedback
   */
  private async refineStory(factors: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const { currentStory, refinementPrompt, archetype } = factors;

    const systemPrompt = `You are a creative fantasy writer specializing in refining character backstories.
Improve stories based on user feedback while maintaining immersion and fitting the character archetype.
Keep refined stories between 100-200 words, written in first person.`;

    const userPrompt = `Please refine this origin story for a ${archetype}:

Current Story: "${currentStory}"

Refinement Request: ${refinementPrompt}

Provide an improved version that incorporates the feedback while keeping it within 100-200 words.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Phase 19 Task 4: Knowledge-Gated Tutorial Synthesis
   * Modulates tutorial guidance based on player knowledge stat
   */
  private async synthesizeKnowledgeGatedTutorial(factors: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const { milestoneId, baseText, knowledgeLevel, paradoxLevel = 0, itemCorruption = 0 } = factors;

    // Knowledge levels: 0-5 (novice), 5-10 (intermediate), 10-15 (advanced), 15+ (master)
    let difficultyTone = '';
    let guidance = '';
    
    if (knowledgeLevel < 5) {
      // Novice: Simple, hands-on instructions
      difficultyTone = 'beginner-friendly, concrete, action-focused';
      guidance = 'Provide step-by-step instructions with simple words. Focus on immediate actions.';
    } else if (knowledgeLevel < 10) {
      // Intermediate: Explanatory with light theory
      difficultyTone = 'informative, practical, with light theoretical background';
      guidance = 'Explain the "why" behind actions while keeping it practical.';
    } else if (knowledgeLevel < 15) {
      // Advanced: Meta-narrative and strategic depth
      difficultyTone = 'sophisticated, insightful, with strategic implications';
      guidance = 'Discuss strategies, implications, and deeper mechanics.';
    } else {
      // Master: Esoteric knowledge and lore-rich
      difficultyTone = 'esoteric, lore-rich, with metaphysical commentary';
      guidance = 'Discuss arcane implications, paradoxes, and the nature of reality within this world.';
    }

    // Add paradox flavor if present
    let paradoxNote = '';
    if (paradoxLevel > 60) {
      paradoxNote = '\n- The guidance should occasionally stutter or have glitch effects (use brackets for [glitched text] patterns)';
    }

    const systemPrompt = `You are the Chronicler, an AI guide in Project Isekai. Your role is to provide tutorial guidance that adapts to player knowledge.
Current Setting: Tutorial milestone for "${milestoneId}"
Knowledge Level: ${knowledgeLevel}/20 (${difficultyTone})
${paradoxNote}

Keep responses concise (1-3 sentences), atmospheric, and in-character.`;

    const userPrompt = `Base tutorial text:
"${baseText}"

Rewrite this tutorial guidance to be appropriate for a player with knowledge level ${knowledgeLevel}. ${guidance}
Keep the lore-compliant tone from the base text but adjust complexity level appropriately.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Synthesize world events based on faction interactions, paradox level, etc.
   */
  private async synthesizeWorldEvent(factors: Record<string, any>, signal?: AbortSignal): Promise<string> {
    const { eventType, factions, location, paradoxLevel, timeline } = factors;

    const systemPrompt = `You are the chronicler of Project Isekai's world events.
Synthesize atmospheric world events that reflect faction tensions and paradox levels.
Events should be brief (1-2 sentences), vivid, and impact the world state.`;

    const userPrompt = `Synthesize a world event:
- Type: ${eventType}
- Factions: ${factions?.join(', ') || 'internal'}
- Location: ${location || 'unknown'}
- Paradox Level: ${paradoxLevel || 'stable'}
- Timeline: ${timeline || 'present'}

Create a brief event description that feels momentous and world-changing.`;

    return this.callLLM(systemPrompt, userPrompt, 0, signal);
  }

  /**
   * Call LLM API with retry logic and failover
   * Primary: Groq, Fallback: Google Gemini
   * Supports AbortSignal for cancellation during component unmount
   */
  private async callLLM(systemPrompt: string, userPrompt: string, attempt = 0, signal?: AbortSignal): Promise<string> {
    // Check if signal has been aborted before starting
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Rate limiting check
    if (!this.rateLimiter.canMakeCall()) {
      throw new Error(`Rate limited: ${this.rateLimiter.getAvailableInWindow()} calls available in next minute`);
    }

    try {
      // Try primary provider (Groq)
      if (this.config.provider === 'groq') {
        const result = await this.callGroqAPI(systemPrompt, userPrompt, signal);
        this.rateLimiter.recordCall();
        return result;
      }

      // Try Gemini if Groq is not primary
      const result = await this.callGeminiAPI(systemPrompt, userPrompt, signal);
      this.rateLimiter.recordCall();
      return result;
    } catch (error) {
      // Pass through abort errors without retry
      if ((error as any).name === 'AbortError') {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      // Retry logic
      if (attempt < this.config.maxRetries) {
        console.warn(`LLM attempt ${attempt + 1} failed, retrying...`, message);
        await this.delay(1000 * (attempt + 1)); // Exponential backoff
        return this.callLLM(systemPrompt, userPrompt, attempt + 1, signal);
      }

      // All retries exhausted, throw error for fallback handling
      throw new Error(`LLM synthesis failed after ${attempt + 1} attempts: ${message}`);
    }
  }

  /**
   * Groq API call
   */
  private async callGroqAPI(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    const apiKey = this.getApiKey('GROQ');
    if (!apiKey) {
      throw new Error('No Groq API key configured');
    }

    const response = await this.fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
      },
      this.config.timeout
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Google Gemini API call (fallback)
   */
  private async callGeminiAPI(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    const apiKey = this.getApiKey('GEMINI');
    if (!apiKey) {
      throw new Error('No Gemini API key configured');
    }

    const response = await this.fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: {
              text: systemPrompt
            }
          },
          contents: {
            role: 'user',
            parts: {
              text: userPrompt
            }
          },
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          },
        }),
      },
      this.config.timeout
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Fetch with timeout
   */
  private fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error(`API request timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Generate static fallback content when AI fails
   */
  private generateStaticFallback(context: SynthesisContext): string {
    switch (context.type) {
      case 'quest_prologue':
        return `The threads of fate draw tight. A new challenge awaits, woven from the tapestry of your world.`;

      case 'npc_dialogue_glitch':
        // Apply weak glitch effect to base dialogue
        const baseDialogue = context.factors.baseDialogue || context.factors.dialogue;
        const paradoxLevel = context.paradoxLevel ?? 0;
        if (paradoxLevel > 60) {
          return `${baseDialogue}... w-wait, did I... no, I... I'm saying this for the first time, aren't I?`;
        }
        return baseDialogue;

      case 'story_origin':
        return `I was born in shadow, shaped by forces beyond mortal comprehension, and now stand upon the threshold of something greater.`;

      case 'story_refinement':
        return `My path was marked by choices both deliberate and drawn by fate, each step bringing me closer to understanding my true purpose.`;

      case 'world_event':
        return `A ripple spreads across the world, touching lives and fates in ways both seen and unseen. Change is upon the land.`;

      default:
        return `The Weaver is silent. Draw from your own imagination.`;
    }
  }

  /**
   * Get API key from environment variables
   */
  private getApiKey(provider: 'GROQ' | 'GEMINI'): string | null {
    if (typeof process === 'undefined' || typeof process.env === 'undefined') {
      // Client-side: check window env or localStorage
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return localStorage.getItem(`ai_${provider.toLowerCase()}_key`) || null;
      }
      return null;
    }

    // Server-side: check process.env
    const envKey = `${provider}_API_KEY`;
    const nextEnvKey = `NEXT_PUBLIC_${envKey}`;
    return process.env[envKey] || process.env[nextEnvKey] || null;
  }

  /**
   * Simple delay for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Synthesize item flavor text using promptRegistry (Phase 14)
   * Generates narrative-rich descriptions with paradox modulation
   */
  async synthesizeItemDescription(request: ItemFlavorRequest): Promise<string> {
    try {
      // Use promptRegistry for deterministic glitch effects first
      const registryFlavor = promptRegistry.getItemFlavor(request);

      // If paradox is high and AI is available, enhance with AI synthesis
      if (request.paradoxLevel > 60 && this.rateLimiter.canMakeCall()) {
        const systemPrompt = `You are the Weaver of Project Isekai's material realm.
Generate brief, evocative item descriptions that match the world's dark fantasy tone.
Keep descriptions 1-2 sentences maximum.`;

        const userPrompt = `Enhance this item description for a ${request.rarity} ${request.itemName}:
Base description: "${request.baseDescription}"
Current text: "${registryFlavor}"

At paradox level ${request.paradoxLevel}%, add atmospheric flavor that hints at reality distortion.`;

        try {
          const enhanced = await this.callLLM(systemPrompt, userPrompt);
          this.rateLimiter.recordCall();
          return enhanced;
        } catch {
          // Fall back to registry-generated flavor
          return registryFlavor;
        }
      }

      return registryFlavor;
    } catch (error) {
      // Return fallback
      return promptRegistry.getFallback('item_flavor');
    }
  }

  /**
   * Analyze story for mechanical seeds (Phase 7 → Phase 14)
   * Migrated from aiStoryService.analyzeStoryForSeeds
   * Extracts faction reputation and narrative flags from player backstory
   */
  async analyzeStoryForSeeds(story: string, archetype: string): Promise<{
    reputation: Record<string, number>;
    startingLocations: string[];
    narrativeFlags: Record<string, boolean>;
    reasoning: string;
  }> {
    const systemPrompt = `You are the Eye of the Weaver, an AI engine for a high-fidelity RPG. 
Your task is to analyze a player's backstory and extract mechanical seeds for the world state.
Focus specifically on identifying factions the player might have history with and the nature of their relationship.
Factions include: 'solar-aegis', 'merchant-guild', 'void-cult', 'mercenary-band', 'city-watch', 'clergy', 'druid-circle', 'outcasts', 'traveler-camp', 'shadow-syndicate'.
Output MUST be valid JSON in this format:
{
  "reputation": { "faction-id": repModValue (-50 to 50) },
  "startingLocations": ["location-id"],
  "narrativeFlags": { "flag-name": true },
  "reasoning": "short explanation"
}`;

    const userPrompt = `Analyze this backstory for a ${archetype}:
"${story}"

Extract the corresponding faction reputation modifiers and any narrative seeds.`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);
      
      // Attempt to parse JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse AI response as JSON');
    } catch (error) {
      console.warn('AI seed analysis failed, using fallback:', error);
      return {
        reputation: {},
        startingLocations: [],
        narrativeFlags: { 'ai-analysis-failed': true },
        reasoning: 'Fallback to static analysis',
      };
    }
  }

  /**
   * Synthesize NPC dialogue with paradox glitches using promptRegistry
   * Overridden to use promptRegistry for deterministic glitch tiers
   */
  async synthesizeNpcDialogueEnhanced(request: NpcDialogueRequest): Promise<string> {
    try {
      // First apply deterministic glitches via promptRegistry
      const glitched = promptRegistry.synthesizeNpcDialogue(request);

      // If paradox is extreme and AI is available, further enhance
      if (request.paradoxLevel > 80 && this.rateLimiter.canMakeCall()) {
        try {
          const systemPrompt = `You are simulating extreme temporal fracture in an NPC's consciousness.
The speaker exists in multiple timelines simultaneously and cannot fully reconcile them.
Make the dialogue unsettling but comprehensible.`;

          const userPrompt = `Further distort this already-glitched dialogue for paradox level ${request.paradoxLevel}%:
"${glitched}"

NPC: ${request.npcName}
Keep it brief and deeply unsettling.`;

          const enhanced = await this.callLLM(systemPrompt, userPrompt);
          this.rateLimiter.recordCall();
          return enhanced;
        } catch {
          // Fall back to registry glitch
          return glitched;
        }
      }

      return glitched;
    } catch (error) {
      return promptRegistry.getFallback('npc_dialogue_glitch');
    }
  }

  /**
   * Get service health information
   */
  getHealth(): {
    provider: string;
    isHealthy: boolean;
    rateLimitAvailable: number;
    lastError: { message: string; timestamp: number } | null;
  } {
    return {
      provider: this.config.provider,
      isHealthy: !this.lastError || Date.now() - this.lastError.timestamp > 60000,
      rateLimitAvailable: this.rateLimiter.getAvailableInWindow(),
      lastError: this.lastError,
    };
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(config?: AIServiceConfig): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService(config);
  }
  return aiServiceInstance;
}

export function resetAIService(): void {
  aiServiceInstance = null;
}
