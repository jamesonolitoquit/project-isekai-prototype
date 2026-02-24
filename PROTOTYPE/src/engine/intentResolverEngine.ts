/**
 * M45-B1: Intent Resolver Engine
 * 
 * Purpose: Expand the action pipeline to handle complex intents that result in
 * nuanced outcomes instead of binary success/fail. 
 * 
 * Examples of complex intents:
 * - "Convince the guard I'm the King's brother" 
 * - "Negotiate a discount from the merchant"
 * - "Persuade the NPC to help me"
 * - "Attempt to deceive the faction scout"
 * 
 * For each intent, the system:
 * 1. Evaluates the world context (weather, faction power, reputation)
 * 2. Calculates a DC (Difficulty Check) based on context
 * 3. Rolls player's relevant skills against DC
 * 4. Returns a nuanced result (critical success, success, partial success, failure, critical failure)
 */

import type { WorldState, PlayerState } from './worldEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import { random } from './prng';

/**
 * Complex Intent: What the player is trying to do and how
 */
export interface ComplexIntent {
  type: 'PERSUADE' | 'DECEIVE' | 'INTIMIDATE' | 'CHARM' | 'NEGOTIATE' | 'BLUFF' | 'INSPIRE' | 'SEDUCE' | 'MANIPULATE' | 'THREATEN';
  targetNpcId?: string;
  targetFactionId?: string;
  description: string; // "Convince the guard I'm the King's brother"
  playerSkill: 'charisma' | 'deception' | 'intimidation' | 'insight' | 'persuasion' | 'sleight_of_hand';
  proposedOutcome: string; // What does success look like?
}

/**
 * DC Context: Factors that make the intent easier or harder
 */
export interface DcContext {
  baseDeception: number; // 0-100: How hard is the lie to tell?
  targetSuspicion: number; // 0-100: How suspicious is the target already?
  environmentalMod: number; // Weather, faction control, mood of location
  targetReputationMod: number; // How much trust/distrust does target have for player?
  relationshipMod: number; // History with this NPC
  loyaltyMod: number; // Faction loyalty of target
  stressLevel: number; // 0-100: Is the target stressed/emotional?
}

/**
 * Intent Outcome: Nuanced result with emotional/narrative implications
 */
export interface IntentOutcome {
  criticalityLevel: 'critical_failure' | 'failure' | 'partial_success' | 'success' | 'critical_success';
  DC: number;
  playerRoll: number;
  margin: number; // Player roll - DC (can be negative)
  
  // Narrative outcome
  narrative: string; // What actually happened
  emotionalShift: Record<string, number>; // NPC emotion changes (gratitude, resentment, fear, etc.)
  reputationDelta: number; // How much reputation changed
  npcTrustsPlayerNow: boolean;
  
  // Mechanical consequences
  successWithCost: boolean; // Success but something bad happened too
  extraSideEffect?: string; // Unexpected consequence (good or bad)
  
  // Memory impact
  npcWillRememberThis: boolean;
  npcSuspicionIncreases: boolean;
  
  timestamp: number;
}

class IntentResolverImpl {
  /**
   * Main entry point: Resolve a complex intent
   */
  resolveIntent(
    intent: ComplexIntent,
    state: WorldState,
    playerStats: { charisma?: number; dexterity?: number; strength?: number; wisdom?: number; intelligence?: number }
  ): IntentOutcome {
    // 1. Calculate the DC based on context
    const dcContext = this.calculateDcContext(intent, state, playerStats);
    const dc = this.calculateDC(dcContext);

    // 2. Roll player's relevant skill
    const playerRoll = this.rollPlayerSkill(playerStats, intent.playerSkill);

    // 3. Determine outcome level
    const margin = playerRoll - dc;
    const criticalityLevel = this.determineCriticalityLevel(margin);

    // 4. Generate narrative outcome
    const narrative = this.generateNarrative(intent, criticalityLevel, margin, state);

    // 5. Calculate emotional shifts
    const emotionalShift = this.calculateEmotionalShift(intent, criticalityLevel, state);

    // 6. Determine NPC memory impact
    const npcWillRememberThis = criticalityLevel !== 'partial_success' && criticalityLevel !== 'failure';
    const npcSuspicionIncreases = criticalityLevel === 'critical_failure' || 
                                  (intent.type === 'DECEIVE' && criticalityLevel === 'failure');

    // 7. Build outcome
    const outcome: IntentOutcome = {
      criticalityLevel,
      DC: dc,
      playerRoll,
      margin,
      narrative,
      emotionalShift,
      reputationDelta: this.calculateReputationDelta(criticalityLevel, intent.type),
      npcTrustsPlayerNow: criticalityLevel === 'success' || criticalityLevel === 'critical_success',
      successWithCost: criticalityLevel === 'partial_success',
      extraSideEffect: this.generateSideEffect(criticalityLevel, intent, state),
      npcWillRememberThis,
      npcSuspicionIncreases,
      timestamp: state.tick ?? 0
    };

    return outcome;
  }

  /**
   * Evaluate the DC context for an intent
   */
  private calculateDcContext(
    intent: ComplexIntent,
    state: WorldState,
    playerStats: any
  ): DcContext {
    const targetNpc = intent.targetNpcId 
      ? state.npcs.find(n => n.id === intent.targetNpcId)
      : null;

    // Base difficulty of the lie/attempt
    let baseDeception = 50; // Medium difficulty by default
    if (intent.type === 'PERSUADE') baseDeception = 45;
    if (intent.type === 'CHARM') baseDeception = 60;
    if (intent.type === 'INTIMIDATE') baseDeception = 40;
    if (intent.type === 'DECEIVE') baseDeception = 70;
    if (intent.type === 'BLUFF') baseDeception = 75;

    // Target suspension: how obvious is the lie?
    let targetSuspicion = 40; // Default: moderately suspicious
    if (targetNpc) {
      // Higher wisdom targets are more suspicious
      targetSuspicion += Math.min(20, (targetNpc.stats?.int || 10) / 2);
    }

    // Environmental modifier: weather and faction control
    let environmentalMod = 0;
    const playerLocationId = state.player.location;
    const locationFactionControl = getFactionWarfareEngine().getOrCreateLocationInfluence(playerLocationId);
    
    // If player is in allied faction territory, easier social checks
    // if (locationFactionControl?.dominantFactionId === state.player.factionId) {
    //   environmentalMod -= 10; // Makes DC 10 lower (easier)
    // }
    // If in hostile territory, harder social checks
    // if (locationFactionControl?.contentionLevel > 0.7) {
    //   environmentalMod += 15; // Makes DC 15 higher (harder)
    // }

    // Weather effects
    // const weather = state.weather;
    // if (weather === 'Ash Storm' || weather === 'Blizzard') {
    //   environmentalMod += 5; // Chaos makes persuasion harder
    // }

    // Target reputation/relationship mod
    let targetReputationMod = 0;
    if (targetNpc && state.player.factionReputation) {
      const playerFactionRep = state.player.factionReputation[targetNpc.factionId || 'neutral'] || 0;
      // Aligned faction members are easier to convince
      if (playerFactionRep > 50) {
        targetReputationMod -= 15;
      }
      // Hostile faction members are harder
      else if (playerFactionRep < -50) {
        targetReputationMod += 20;
      }
    }

    // Loyalty mod: how loyal is the target to their faction?
    let loyaltyMod = 0;
    if (targetNpc?.factionRole) {
      // High-ranking faction members are less likely to betray faction
      loyaltyMod = 10;
    }

    // Stress level: are they emotional/unstable?
    let stressLevel = 40; // Default moderate stress
    if (targetNpc?.hp && targetNpc?.maxHp && targetNpc.hp < targetNpc.maxHp * 0.3) {
      stressLevel = 80; // Badly wounded = emotional
    }

    return {
      baseDeception,
      targetSuspicion,
      environmentalMod,
      targetReputationMod,
      relationshipMod: 0, // Would be calculated from NPC memory in full implementation
      loyaltyMod,
      stressLevel
    };
  }

  /**
   * Calculate final DC from context
   */
  private calculateDC(context: DcContext): number {
    let dc = 50; // Baseline DC

    // Add context modifiers
    dc += context.baseDeception / 2; // Half the deception difficulty
    dc += context.targetSuspicion / 3; // Target's suspicion matters but not fully
    dc += context.environmentalMod;
    dc += context.targetReputationMod;
    dc -= context.stressLevel / 10; // Stressed targets are easier to convince

    // Clamp between 15 and 85
    return Math.max(15, Math.min(85, dc));
  }

  /**
   * Roll player's relevant skill
   */
  private rollPlayerSkill(playerStats: any, skill: string): number {
    let skillValue = 10; // Base value

    // Map skill to ability
    switch (skill) {
      case 'charisma':
        skillValue = Math.max(skillValue, playerStats.charisma || 10);
        break;
      case 'deception':
        skillValue = Math.max(skillValue, playerStats.intelligence || 10);
        break;
      case 'intimidation':
        skillValue = Math.max(skillValue, playerStats.strength || 10);
        break;
      case 'insight':
        skillValue = Math.max(skillValue, playerStats.wisdom || 10);
        break;
      case 'persuasion':
        skillValue = Math.max(skillValue, playerStats.charisma || 10);
        break;
      case 'sleight_of_hand':
        skillValue = Math.max(skillValue, playerStats.dexterity || 10);
        break;
    }

    // Roll d20 + skill modifier + proficiency
    const d20 = Math.floor(Math.random() * 20) + 1;
    const modifier = (skillValue - 10) / 2; // D&D style: (ability - 10) / 2
    const proficiency = 2; // Would be calculated from player level in full implementation

    return d20 + modifier + proficiency;
  }

  /**
   * Determine criticality level based on margin
   */
  private determineCriticalityLevel(margin: number): 'critical_failure' | 'failure' | 'partial_success' | 'success' | 'critical_success' {
    if (margin >= 20) return 'critical_success';
    if (margin >= 5) return 'success';
    if (margin >= -5) return 'partial_success';
    if (margin >= -15) return 'failure';
    return 'critical_failure';
  }

  /**
   * Generate narrative for outcome
   */
  private generateNarrative(
    intent: ComplexIntent,
    criticalityLevel: string,
    margin: number,
    state: WorldState
  ): string {
    const narratives: Record<string, Record<string, string>> = {
      PERSUADE: {
        critical_success: 'The NPC is totally convinced and becomes enthusiastic about your proposal.',
        success: 'The NPC believes you and agrees to help.',
        partial_success: 'The NPC is somewhat convinced, but has lingering doubts.',
        failure: 'The NPC is skeptical of your claims.',
        critical_failure: 'The NPC sees through your persuasion attempt and becomes suspicious.'
      },
      DECEIVE: {
        critical_success: 'Your deception is flawless - the NPC believes every word.',
        success: 'Your lie works; the NPC accepts it without question.',
        partial_success: 'The NPC mostly believes you, but seems to have some doubt.',
        failure: 'The NPC senses something is off about your story.',
        critical_failure: 'The NPC catches you in the act of lying. Your deception completely backfires.'
      },
      INTIMIDATE: {
        critical_success: 'The NPC is terrified and will do anything to appease you.',
        success: 'The NPC backs down and agrees to your demands.',
        partial_success: 'The NPC is afraid, but not completely cowed.',
        failure: 'The NPC stands their ground despite your threats.',
        critical_failure: 'The NPC laughs at your intimidation and becomes hostile!'
      },
      CHARM: {
        critical_success: 'The NPC is absolutely charmed and sees you in the best possible light.',
        success: 'The NPC is flattered and looks upon you favorably.',
        partial_success: 'The NPC appreciates the gesture but remains mostly neutral.',
        failure: 'Your charm falls flat and seems forced.',
        critical_failure: 'Your attempt at charm seems manipulative and offends the NPC.'
      }
    };

    const intentNarratives = narratives[intent.type] || narratives.PERSUADE;
    return intentNarratives[criticalityLevel] || 'Something happens...';
  }

  /**
   * Calculate emotional shifts in the NPC
   */
  private calculateEmotionalShift(intent: ComplexIntent, criticalityLevel: string, state: WorldState): Record<string, number> {
    const emotions: Record<string, number> = {
      gratitude: 0,
      resentment: 0,
      fear: 0,
      trust: 0
    };

    switch (criticalityLevel) {
      case 'critical_success':
        emotions.gratitude = 20;
        emotions.trust = 15;
        break;
      case 'success':
        emotions.gratitude = 10;
        emotions.trust = 10;
        break;
      case 'partial_success':
        emotions.trust = 5;
        break;
      case 'failure':
        emotions.resentment = 5;
        emotions.trust = -5;
        break;
      case 'critical_failure':
        emotions.resentment = 15;
        emotions.fear = 10;
        emotions.trust = -15;
        break;
    }

    // Modify based on intent type
    if (intent.type === 'INTIMIDATE') {
      emotions.fear += 10;
      emotions.trust -= 5;
    }

    return emotions;
  }

  /**
   * Calculate reputation delta
   */
  private calculateReputationDelta(criticalityLevel: string, intentType: string): number {
    const deltas: Record<string, number> = {
      critical_success: 15,
      success: 8,
      partial_success: 2,
      failure: -4,
      critical_failure: -12
    };

    return deltas[criticalityLevel] || 0;
  }

  /**
   * Generate side effects
   */
  private generateSideEffect(
    criticalityLevel: string,
    intent: ComplexIntent,
    state: WorldState
  ): string | undefined {
    if (criticalityLevel === 'critical_success') {
      return 'The NPC offers unexpected additional help.';
    }
    if (criticalityLevel === 'critical_failure' && intent.type === 'DECEIVE') {
      return 'Everyone nearby heard about your failed deception. Your reputation takes additional damage.';
    }
    return undefined;
  }
}

// Singleton instance
let instance: IntentResolverImpl | null = null;

export function getIntentResolver(): IntentResolverImpl {
  if (!instance) {
    instance = new IntentResolverImpl();
  }
  return instance;
}

/**
 * Export convenience function
 */
export const intentResolver = {
  resolveIntent: (intent: ComplexIntent, state: WorldState, playerStats: any) =>
    getIntentResolver().resolveIntent(intent, state, playerStats)
};
