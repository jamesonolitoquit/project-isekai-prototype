/**
 * Intent Synthesizer Engine (Stage 8.99a)
 * 
 * Maps natural language prompts to mechanical engine effects using regex pattern matching.
 * This is the "Brain" of D&D-style Freedom - converting player intent into deterministic game actions.
 * 
 * Strategy: Fast regex-based matching (maintain 1.5s tick performance)
 * Future: Hook for LLM synthesis on "High Tension" narrative moments
 */

import type { CoreAttributes } from '../types';

/**
 * Result of intent synthesis
 * Maps natural language prompt to mechanical game effects
 */
export interface SynthesisResult {
  /** Primary effect type determined by the prompt */
  effectType: 'damage' | 'heal' | 'status_effect' | 'skill_check' | 'interaction' | 'movement' | 'unknown';
  
  /** Primary 8-stat that this action uses */
  primaryStat: keyof CoreAttributes;
  
  /** Base difficulty class for this action (10-20 range) */
  suggestedDC: number;
  
  /** Complexity of the action (affects narrative weight) */
  narrativeComplexity: number;
  
  /** Matched verb pattern (for logging/debugging) */
  matchedVerb?: string;
  
  /** Suggested ability ID if pattern matches known ability */
  suggestedAbilityId?: string;
  
  /** Whether this is a generic skill check (no specific ability) */
  isGenericSkillCheck: boolean;
}

/**
 * Verb Pattern Definition
 * Maps regex patterns to game mechanics
 */
interface VerbPattern {
  pattern: RegExp;
  stat: keyof CoreAttributes;
  effectType: SynthesisResult['effectType'];
  baseDC: number;
  suggestedAbilityId?: string;
}

/**
 * Intent Synthesizer: Maps natural language to game mechanics
 * 
 * Strategy:
 * - Fast regex-based pattern matching
 * - Normalized to 1.5s tick performance
 * - Fallback to generic skill check on no match
 */
export class IntentSynthesizer {
  /**
   * Verb patterns organized by primary stat
   * Ordered by specificity (longest patterns first)
   */
  private static readonly VERB_PATTERNS: VerbPattern[] = [
    // STR Actions: Heavy, forceful movements
    { pattern: /\b(smash|bash|crush|pound|strike|hit|slam|tackle|shove|push|lift|hoist|heave)\b/i, stat: 'STR', effectType: 'damage', baseDC: 12, suggestedAbilityId: 'attack' },
    
    // STR + Force/Power context
    { pattern: /\b(break|shatter|destroy|obliterate)\b.*\b(door|wall|chain|lock|barrier)\b/i, stat: 'STR', effectType: 'damage', baseDC: 14, suggestedAbilityId: 'attack' },
    
    // DEX Actions: Precision, finesse
    { pattern: /\b(throw|toss|pitch|hurl|fling|shoot|fire|launch)\b/i, stat: 'DEX', effectType: 'damage', baseDC: 13, suggestedAbilityId: 'attack' },
    { pattern: /\b(pick pockets?|steal|filch|swipe|pickpocket|disarm|parry|riposte)\b/i, stat: 'DEX', effectType: 'skill_check', baseDC: 15 },
    { pattern: /\b(craft|build|create|forge|construct|assemble|fix|repair|tinker)\b/i, stat: 'DEX', effectType: 'skill_check', baseDC: 13 },
    
    // AGI Actions: Speed, mobility, evasion
    { pattern: /\b(sneak|stealth|hide|slip|slink|creep|shadow|skulk)\b/i, stat: 'AGI', effectType: 'skill_check', baseDC: 14 },
    { pattern: /\b(dodge|evade|roll|vault|leap|jump|bound|bounce)\b/i, stat: 'AGI', effectType: 'skill_check', baseDC: 12 },
    { pattern: /\b(climb|scale|ascend|clamber|scramble)\b/i, stat: 'AGI', effectType: 'movement', baseDC: 13 },
    { pattern: /\b(run|sprint|dash|escape|flee)\b/i, stat: 'AGI', effectType: 'movement', baseDC: 11 },
    
    // PER/INT Actions: Observation, investigation
    { pattern: /\b(search|look|examine|inspect|scan|observe|spot|perceive|find|locate|seek)\b/i, stat: 'PER', effectType: 'skill_check', baseDC: 12 },
    { pattern: /\b(read|decipher|translate|interpret|understand|analyze|study|research)\b/i, stat: 'INT', effectType: 'skill_check', baseDC: 14 },
    
    // CHA Actions: Social interaction
    { pattern: /\b(persuade|convince|talk|negotiate|bargain|sweet talk)\b/i, stat: 'CHA', effectType: 'skill_check', baseDC: 13 },
    { pattern: /\b(intimidate|threaten|bully|coerce|demand)\b/i, stat: 'CHA', effectType: 'skill_check', baseDC: 12 },
    { pattern: /\b(lie|deceive|bluff|trick|mislead|deceive|con)\b/i, stat: 'CHA', effectType: 'skill_check', baseDC: 15 },
    { pattern: /\b(charm|flirt|seduce|woo|attract)\b/i, stat: 'CHA', effectType: 'skill_check', baseDC: 14 },
    
    // CON Actions: Endurance, resistance
    { pattern: /\b(resist|endure|tough|hold|bear|withstand|persist)\b/i, stat: 'CON', effectType: 'skill_check', baseDC: 12 },
    
    // WIS Actions: Perception, insight
    { pattern: /\b(sense|feel|perceive|intuition|notice|detect|divine|pray|meditate)\b/i, stat: 'WIS', effectType: 'skill_check', baseDC: 13 },
    
    // Health/Healing
    { pattern: /\b(heal|cure|mend|restore|revive|recover)\b/i, stat: 'WIS', effectType: 'heal', baseDC: 14 },
    
    // Status Effects
    { pattern: /\b(poison|curse|enchant|bewitch|charm|stun|paralyze|freeze|burn)\b/i, stat: 'INT', effectType: 'status_effect', baseDC: 15 },
  ];

  /**
   * Synthesize a natural language prompt into a game mechanic
   * 
   * @param prompt Raw player input (e.g., "I want to sneak past the guard")
   * @param narrativeWeight Optional narrative weight (0.0-1.0) for complexity scaling
   * @returns SynthesisResult with effect type, stat, and difficulty
   */
  static synthesize(prompt: string, narrativeWeight: number = 1.0): SynthesisResult {
    if (!prompt || prompt.trim().length === 0) {
      return IntentSynthesizer.createGenericResult();
    }

    // Try to match against known patterns
    for (const pattern of IntentSynthesizer.VERB_PATTERNS) {
      if (pattern.pattern.test(prompt)) {
        return {
          effectType: pattern.effectType,
          primaryStat: pattern.stat,
          suggestedDC: IntentSynthesizer.calculateDC(pattern.baseDC, prompt, narrativeWeight),
          narrativeComplexity: IntentSynthesizer.calculateComplexity(prompt),
          matchedVerb: IntentSynthesizer.extractMatchedVerb(prompt, pattern.pattern),
          suggestedAbilityId: pattern.suggestedAbilityId,
          isGenericSkillCheck: false,
        };
      }
    }

    // No pattern matched - return generic skill check
    return IntentSynthesizer.createGenericResult(narrativeWeight, prompt);
  }

  /**
   * Calculate difficulty class based on base DC, prompt complexity, and narrative weight
   * 
   * Formula: baseDC + (wordCount / 5) rounded down + (narrativeWeight * 5)
   * 
   * Examples:
   * - Simple "attack" (base 12, 1 word, weight 1.0) = 12
   * - Complex "swing from chandelier and kick guard" (base 12, 7 words, weight 0.8) = 12 + 1 + 4 = 17
   */
  private static calculateDC(baseDC: number, prompt: string, narrativeWeight: number): number {
    const wordCount = prompt.trim().split(/\s+/).length;
    const complexityBonus = Math.floor(wordCount / 5);
    const weightBonus = Math.floor(narrativeWeight * 5);
    
    const finalDC = baseDC + complexityBonus + weightBonus;
    
    // Clamp to reasonable range (8-25)
    return Math.max(8, Math.min(25, finalDC));
  }

  /**
   * Calculate narrative complexity from prompt characteristics
   * 
   * Returns 0.5-2.0 multiplier based on:
   * - Word count (longer = more complex)
   * - Intensifiers ("very", "extremely", "carefully")
   * - Multiple actions ("swing and kick")
   */
  private static calculateComplexity(prompt: string): number {
    let complexity = 1.0;
    const wordCount = prompt.trim().split(/\s+/).length;
    
    // Longer prompts are more complex
    complexity += Math.min(wordCount / 20, 0.5);
    
    // Intensifiers add complexity
    const intensifiers = prompt.match(/\b(very|extremely|carefully|quickly|slowly|delicately|forcefully)\b/gi);
    if (intensifiers) complexity += intensifiers.length * 0.1;
    
    // Multiple actions indicated by conjunctions
    const conjunctions = prompt.match(/\b(and|then|while|but|to)\b/gi);
    if (conjunctions && conjunctions.length > 2) complexity += 0.3;
    
    return Math.max(0.5, Math.min(2.0, complexity));
  }

  /**
   * Extract the first matched verb from the prompt
   */
  private static extractMatchedVerb(prompt: string, pattern: RegExp): string {
    const match = prompt.match(pattern);
    return match ? match[0] : 'unknown';
  }

  /**
   * Create a generic "unknown action" result
   * Used when no pattern matches - defaults to WIS check (representing common sense/judgment)
   */
  private static createGenericResult(
    narrativeWeight: number = 1.0, 
    prompt: string = ''
  ): SynthesisResult {
    return {
      effectType: 'unknown',
      primaryStat: 'WIS',  // Wisdom = "judgment call" mechanic (represents intuition & common sense)
      suggestedDC: IntentSynthesizer.calculateDC(15, prompt, narrativeWeight),
      narrativeComplexity: IntentSynthesizer.calculateComplexity(prompt),
      matchedVerb: undefined,
      suggestedAbilityId: undefined,
      isGenericSkillCheck: true,
    };
  }

  /**
   * Validate that a synthesized stat exists in CoreAttributes
   * Helper for type checking
   */
  static isValidStat(stat: string): stat is keyof CoreAttributes {
    const validStats = ['STR', 'DEX', 'AGI', 'CON', 'INT', 'WIS', 'CHA', 'PER'] as const;
    return validStats.includes(stat as any);
  }
}

// Export for use in Phase 1 (InputDecay)
export default IntentSynthesizer;
