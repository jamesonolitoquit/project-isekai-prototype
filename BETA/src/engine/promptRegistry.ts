/**
 * Prompt Registry - Centralized AI prompt management
 * 
 * Loads and manages the Weaver DM system prompt, providing utilities for:
 * - Paradox-aware narrative synthesis
 * - NPC dialogue glitch tier application
 * - Item flavor generation
 * - World event contextualization
 */

export type SynthesisType = 
  | 'quest_prologue' 
  | 'npc_dialogue_glitch' 
  | 'story_origin' 
  | 'story_refinement' 
  | 'world_event'
  | 'item_flavor';

export type GlitchTier = 'none' | 'subtle' | 'moderate' | 'severe';

export interface PromptContext {
  synthesisType: SynthesisType;
  contextFactors: Record<string, any>;
  paradoxLevel: number; // 0-100
  tolerateLatency?: boolean;
  maximumTokens?: number;
}

export interface ItemFlavorRequest {
  itemName: string;
  baseDescription: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  paradoxLevel: number;
  mood?: string; // For artifacts: 'bloodthirsty', 'curious', 'neutral'
}

export interface NpcDialogueRequest {
  baseDialogue: string;
  npcName: string;
  emotionalState?: {
    trust?: number;
    fear?: number;
    gratitude?: number;
    resentment?: number;
  };
  paradoxLevel: number;
}

/**
 * PromptRegistry manages all narrative synthesis rules
 * Acts as centralized configuration to prevent "Prompt Drift"
 */
export class PromptRegistry {
  private static instance: PromptRegistry;
  private paradoxTiers: Map<string, { threshold: number; description: string }>;
  private atmosphericRules: {
    low: string[];
    medium: string[];
    high: string[];
  };
  private glitchIntensity: Map<GlitchTier, { range: [number, number]; characteristics: string[] }>;

  private constructor() {
    this.paradoxTiers = new Map([
      ['coherent', { threshold: 30, description: 'Narrative coherent, factions predictable' }],
      ['fractured', { threshold: 70, description: 'Subtle inconsistencies, NPC uncertainty' }],
      ['broken', { threshold: 100, description: 'Severe breaks, temporal glitches, meta-references' }],
    ]);

    this.atmosphericRules = {
      low: [
        'Dark, mystical, contemplative tone',
        'Evocative without overwrought language',
        'References to fate, destiny, consequence',
        'World-appropriate high-fantasy vocabulary',
        'Factions behave predictably',
        'NPCs speak with confidence and consistency',
      ],
      medium: [
        'Subtle inconsistencies in NPC statements',
        'Uncertain phrasing: "I think I told you..."',
        'Brief pauses and self-corrections',
        'Some awareness of paradoxes',
        'Factions show hesitation or doubt',
        'Reality feels slightly off-kilter',
      ],
      high: [
        'Stutter repetitions in dialogue',
        'Mixed tenses: past/present/future confusion',
        'Awareness of alternate statements: "...no, I will say..."',
        'Meta-references to other timelines',
        'NPCs speak of outcomes that "might happen"',
        'World events have paradoxical qualities',
      ],
    };

    this.glitchIntensity = new Map([
      ['none', {
        range: [0, 29],
        characteristics: ['No modification', 'Dialogue plays straight', 'Clear coherence'],
      }],
      ['subtle', {
        range: [30, 59],
        characteristics: ['Uncertainty markers', 'Brief pauses', 'Self-correction', 'Minor glitches'],
      }],
      ['moderate', {
        range: [60, 84],
        characteristics: ['Stutter repetitions', 'Mixed tense', 'Alternate statement awareness', 'Visible distortion'],
      }],
      ['severe', {
        range: [85, 100],
        characteristics: ['Repeated syllables', 'Fragmented thoughts', 'Meta-references', 'UI instability'],
      }],
    ]);
  }

  /**
   * Singleton accessor
   */
  static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry();
    }
    return PromptRegistry.instance;
  }

  /**
   * Determine glitch tier from paradox level
   */
  getGlitchTier(paradoxLevel: number): GlitchTier {
    if (paradoxLevel < 30) return 'none';
    if (paradoxLevel < 60) return 'subtle';
    if (paradoxLevel < 85) return 'moderate';
    return 'severe';
  }

  /**
   * Get atmospheric rules for current paradox state
   */
  getAtmosphericRules(paradoxLevel: number): string[] {
    if (paradoxLevel < 30) return this.atmosphericRules.low;
    if (paradoxLevel < 70) return this.atmosphericRules.medium;
    return this.atmosphericRules.high;
  }

  /**
   * Generate item flavor text with paradox modulation
   */
  getItemFlavor(request: ItemFlavorRequest): string {
    const tier = this.getGlitchTier(request.paradoxLevel);
    const rules = this.getAtmosphericRules(request.paradoxLevel);
    
    let flavor = request.baseDescription;

    // Apply glitch effects based on tier
    switch (tier) {
      case 'none':
        // Keep description as-is
        break;

      case 'subtle':
        // Add slight uncertainty
        flavor = this.applySubtleGlitch(flavor);
        break;

      case 'moderate':
        // Add visible distortion
        flavor = this.applyModerateGlitch(flavor, request.itemName);
        break;

      case 'severe':
        // Add severe corruption
        flavor = this.applySevereGlitch(flavor, request.itemName);
        break;
    }

    // Add mood context for unique artifacts
    if (request.mood) {
      flavor += ` [Mood: ${request.mood}]`;
    }

    // Add rarity indicator with atmospheric coloring
    const rarityPrefix = this.getRarityPrefix(request.rarity, tier);
    flavor = `${rarityPrefix}: ${flavor}`;

    return flavor;
  }

  /**
   * Apply subtle paradox glitches to text
   */
  private applySubtleGlitch(text: string): string {
    const markers = ["I think...", "or was it...", "possibly...", "then again..."];
    const randomMarker = markers[Math.floor(Math.random() * markers.length)];
    const sentences = text.split('. ');
    
    if (sentences.length > 1) {
      sentences.splice(
        Math.floor(Math.random() * sentences.length),
        0,
        randomMarker
      );
    }
    
    return sentences.join('. ');
  }

  /**
   * Apply moderate glitches (visible distortion)
   */
  private applyModerateGlitch(text: string, itemName: string): string {
    // Stutter effect on key word
    const stutteredItem = itemName.charAt(0) + '-' + itemName.charAt(0) + itemName.substring(1);
    
    // Mixed tense
    const words = text.split(' ');
    const glitchIndex = Math.floor(Math.random() * (words.length - 1));
    
    if (glitchIndex > 0) {
      // Insert alternate timeline reference
      words.splice(glitchIndex, 0, '[in other timelines...]');
    }
    
    return words.join(' ').replace(itemName, stutteredItem);
  }

  /**
   * Apply severe glitches (broken reality)
   */
  private applySevereGlitch(text: string, itemName: string): string {
    // Severe corruption effects
    const glitches = [
      (t: string) => t.split('').reverse().join(''), // Reverse text
      (t: string) => t.toUpperCase().split('').join(' '), // Spaced capitals
      (t: string) => t.replace(/[aeiou]/gi, '█'), // Replace vowels with blocks
    ];
    
    const randomGlitch = glitches[Math.floor(Math.random() * glitches.length)];
    const glitchedSegment = text.substring(0, Math.floor(text.length / 2));
    
    return text.substring(0, Math.floor(text.length / 2)) + 
           '(' + randomGlitch(glitchedSegment) + ')' +
           text.substring(Math.floor(text.length / 2));
  }

  /**
   * Get rarity prefix with glitch effects
   */
  private getRarityPrefix(rarity: string, tier: GlitchTier): string {
    const prefixes: Record<string, string> = {
      common: 'Common',
      uncommon: 'Uncommon',
      rare: '⚔ Rare',
      epic: '✦ Epic',
      legendary: '✧✦✧ Legendary',
    };

    let prefix = prefixes[rarity] || rarity;

    if (tier === 'severe') {
      prefix = prefix.split('').join('█').substring(0, prefix.length);
    } else if (tier === 'moderate') {
      prefix = prefix + ' [?]';
    }

    return prefix;
  }

  /**
   * Apply NPC dialogue glitch synthesis
   */
  synthesizeNpcDialogue(request: NpcDialogueRequest): string {
    const tier = this.getGlitchTier(request.paradoxLevel);
    let dialogue = request.baseDialogue;

    switch (tier) {
      case 'none':
        // Return unmodified
        return dialogue;

      case 'subtle':
        // Add uncertainty markers
        return this.applySubtleDialogueGlitch(dialogue);

      case 'moderate':
        // Add stutter and mixed tense
        return this.applyModerateDialogueGlitch(dialogue);

      case 'severe':
        // Add severe corruption
        return this.applySevereDialogueGlitch(dialogue, request.npcName);
    }
  }

  /**
   * Subtle dialogue glitch: uncertainty markers
   */
  private applySubtleDialogueGlitch(dialogue: string): string {
    const uncertaintyPhrases = [
      "I think I said...",
      "Unless... no, I did tell you...",
      "Or did I...",
      "I *believe* I said...",
    ];
    
    const phrase = uncertaintyPhrases[Math.floor(Math.random() * uncertaintyPhrases.length)];
    return `${phrase} "${dialogue}"`;
  }

  /**
   * Moderate dialogue glitch: stutters and mixed tense
   */
  private applyModerateDialogueGlitch(dialogue: string): string {
    // Stutter first significant word
    const words = dialogue.split(' ');
    if (words.length > 0) {
      const firstWord = words[0];
      words[0] = firstWord.charAt(0) + '-' + firstWord;
    }

    // Add mixed tense reference
    const tenseVariations = [
      "...or was I...",
      "...no, I will...",
      "...did I ever...",
    ];
    
    const variation = tenseVariations[Math.floor(Math.random() * tenseVariations.length)];
    
    return words.join(' ') + variation;
  }

  /**
   * Severe dialogue glitch: fractured, meta-aware
   */
  private applySevereDialogueGlitch(dialogue: string, npcName: string): string {
    const fragments = dialogue.split(/[.,!?]/);
    const glitched = fragments.map((f, i) => 
      i % 2 === 0 ? f : `[${i % 3 === 0 ? 'future' : 'past'}] ${f}`
    ).join(' ');

    return `"${glitched}..." —${npcName} [speaking across timelines]`;
  }

  /**
   * Create synthesis context for AI service
   */
  createSynthesisContext(request: PromptContext): Record<string, any> {
    const atmosphericRules = this.getAtmosphericRules(request.paradoxLevel);
    const glitchTier = this.getGlitchTier(request.paradoxLevel);

    return {
      ...request,
      atmosphericRules,
      glitchTier,
      synthesisGuidelines: this.getSynthesisGuidelines(request.synthesisType),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get synthesis guidelines for synthesis type
   */
  private getSynthesisGuidelines(synthesisType: SynthesisType): string {
    const guidelines: Record<SynthesisType, string> = {
      quest_prologue: 'Single paragraph. Sets scene, hints stakes, implies player agency. 2-3 sentences.',
      npc_dialogue_glitch: 'Apply glitch effects. Maintain character voice while distorting perception.',
      story_origin: 'First person, intimate. Leave room for secrets. Reference factions and locations.',
      story_refinement: 'Deepen existing narrative. Maintain consistency with established lore.',
      world_event: 'Describe what happens as if chronicling history. Leave mechanical effects to engine.',
      item_flavor: 'Evocative, brief. Reference material properties and world context.',
    };

    return guidelines[synthesisType];
  }

  /**
   * Get fallback response for synthesis failure
   */
  getFallback(synthesisType: SynthesisType): string {
    const fallbacks: Record<SynthesisType, string> = {
      quest_prologue: 'The threads of fate draw tight. A challenge awaits, woven from your world\'s unfolding tapestry.',
      npc_dialogue_glitch: 'The Weaver is contemplating your question. A response is forming.',
      story_origin: 'Your story is written in the margins between worlds. Details will emerge in time.',
      story_refinement: 'The narrative shifts, adapting to your choices. History is not yet settled.',
      world_event: 'The world holds its breath. Something significant stirs beneath the surface.',
      item_flavor: 'An object of power and mystery. Its true nature remains veiled.',
    };

    return fallbacks[synthesisType];
  }
}

export const promptRegistry = PromptRegistry.getInstance();
