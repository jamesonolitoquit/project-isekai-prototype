import { WorldState } from './worldEngine';
import { getEventsForWorld, type Event } from '../events/mutationLog';

/**
 * analyticsEngine.ts - M26: Playstyle Analytics (Phase 19 Extension)
 * 
 * Analyzes player actions and behavior patterns to generate a PlaystyleProfile.
 * This profile is used by the AI DM to adapt NPC dialogue and behavior.
 * Phase 19 extension: Calculate metrics from actual event history.
 */

/**
 * Character combat preferences and action frequencies
 */
export interface CharacterProfile {
  combatFrequency: number; // 0-100: % of actions that are combat
  socialFrequency: number; // 0-100: % of actions that are dialogue/negotiation
  explorationFrequency: number; // 0-100: % of actions that are movement/discovery
  ritualFrequency: number; // 0-100: % of actions that are magic/ritual
  craftingFrequency: number; // 0-100: % of actions that are crafting
}

/**
 * Risk-taking behavior assessment
 */
export interface RiskAssessment {
  lowRollRiskTaking: number; // Count: actions attempted with <50% success chance
  highRollConfidence: number; // Count: actions attempted with >80% success chance
  riskTakingRatio: number; // Ratio: (low+high) / total actions (higher = more varied risk profile)
  averageSuccessRate: number; // 0-100: average success rate of completed actions
}

/**
 * Moral alignment tracking from dialogue choices and actions
 */
export interface MoralAlignment {
  goodChoices: number; // Cumulative good alignment points
  evilChoices: number; // Cumulative evil alignment points
  neutralChoices: number; // Cumulative neutral alignment points
  alignment: number; // -100 (evil) to +100 (good), calculated from ratio
}

/**
 * Complete playstyle profile derived from historical behavior
 */
export interface PlaystyleProfile {
  characterProfile: CharacterProfile;
  riskAssessment: RiskAssessment;
  moralAlignment: MoralAlignment;
  generatedAt: number; // Timestamp when profile was generated
  dominantPlaystyle: 'combatant' | 'socialite' | 'explorer' | 'ritualist' | 'crafter' | 'balanced';
  profileVersion: number; // Incremented each time profile is recalculated
}

/**
 * Generate a default/minimal PlaystyleProfile
 * Used when there's insufficient event history to calculate accurate profile
 */
export function generateDefaultPlaystyleProfile(state: WorldState): PlaystyleProfile {
  return {
    characterProfile: {
      combatFrequency: 30,
      socialFrequency: 20,
      explorationFrequency: 30,
      ritualFrequency: 15,
      craftingFrequency: 5
    },
    riskAssessment: {
      lowRollRiskTaking: 0,
      highRollConfidence: 0,
      riskTakingRatio: 0.5,
      averageSuccessRate: 50
    },
    moralAlignment: {
      goodChoices: 0,
      evilChoices: 0,
      neutralChoices: 0,
      alignment: 0
    },
    generatedAt: state.tick || 0,
    dominantPlaystyle: 'balanced',
    profileVersion: 1
  };
}

/**
 * Generate a PlaystyleProfile from player history
 * For now, returns default profile. Production implementation would scan event history.
 */
export function generatePlaystyleProfile(state: WorldState): PlaystyleProfile {
  // Phase 19: Calculate metrics from actual event history
  const events = getEventsForWorld(state.id);
  
  if (!events || events.length < 10) {
    // Insufficient history - use default
    return generateDefaultPlaystyleProfile(state);
  }

  // Count action types from events
  let combatCount = 0;
  let socialCount = 0;
  let explorationCount = 0;
  let ritualCount = 0;
  let craftingCount = 0;
  let totalActions = 0;

  // Track moral choices
  let goodChoices = 0;
  let evilChoices = 0;
  let neutralChoices = 0;

  // Track risk-taking
  let lowRollRiskCount = 0;
  let highRollConfidenceCount = 0;
  let successfulActions = 0;
  let totalCompletedActions = 0;

  for (const event of events) {
    // Categorize by event type
    switch (event.type) {
      case 'COMBAT_INITIATED':
      case 'ATTACK':
      case 'PARRY':
      case 'DEFEND':
      case 'SPELL_CAST':
        combatCount++;
        totalActions++;
        break;
      case 'TALK_TO_NPC':
      case 'DIALOGUE':
      case 'NEGOTIATE':
      case 'PERSUADE':
      case 'DECEIVE':
      case 'CHARM':
        socialCount++;
        totalActions++;
        break;
      case 'MOVE':
      case 'EXPLORE':
      case 'DISCOVER':
      case 'SEARCH':
        explorationCount++;
        totalActions++;
        break;
      case 'RITUAL_PERFORM':
      case 'MORPH':
      case 'CAST_SPELL':
      case 'CHANNEL_ESSENCE':
        ritualCount++;
        totalActions++;
        break;
      case 'CRAFT_ITEM':
      case 'ITEM_CRAFTED':
        craftingCount++;
        totalActions++;
        break;
    }

    // Track moral choices
    if (event.type === 'CHOICE_MADE' || event.type === 'DIALOGUE') {
      const alignment = (event.payload as any)?.moralAlignment;
      if (alignment === 'good') goodChoices++;
      else if (alignment === 'evil') evilChoices++;
      else neutralChoices++;
    }

    // Track success/failure
    if (event.type.includes('SUCCESS') || event.type.includes('SUCCESS') || (event.payload as any)?.success === true) {
      successfulActions++;
    }
    if (event.type.includes('COMPLETED') || event.type.includes('FAILED')) {
      totalCompletedActions++;
    }

    // Track risk-taking from dice rolls
    if (event.type === 'DICE_ROLL') {
      const roll = (event.payload as any)?.roll;
      const difficulty = (event.payload as any)?.difficulty;
      if (roll && difficulty) {
        const successChance = (roll / 20) * 100;
        if (successChance < 50) lowRollRiskCount++;
        else if (successChance > 80) highRollConfidenceCount++;
      }
    }
  }

  // Prevent division by zero
  if (totalActions === 0) {
    return generateDefaultPlaystyleProfile(state);
  }

  // Calculate frequencies (0-100)
  const combatFrequency = Math.round((combatCount / totalActions) * 100);
  const socialFrequency = Math.round((socialCount / totalActions) * 100);
  const explorationFrequency = Math.round((explorationCount / totalActions) * 100);
  const ritualFrequency = Math.round((ritualCount / totalActions) * 100);
  const craftingFrequency = Math.round((craftingCount / totalActions) * 100);

  // Calculate moral alignment
  const totalChoices = goodChoices + evilChoices + neutralChoices;
  const moralAlignment = totalChoices > 0 ?
    ((goodChoices - evilChoices) / totalChoices) * 100 : 0;

  // Calculate risk-taking ratio
  const riskTakingRatio = totalActions > 0 ? (lowRollRiskCount + highRollConfidenceCount) / totalActions : 0;

  // Calculate average success rate
  const averageSuccessRate = totalCompletedActions > 0 ?
    Math.round((successfulActions / totalCompletedActions) * 100) : 50;

  // Determine dominant playstyle
  const freqs = {
    combatant: combatFrequency,
    socialite: socialFrequency,
    explorer: explorationFrequency,
    ritualist: ritualFrequency,
    crafter: craftingFrequency
  };
  
  let dominantPlaystyle: 'combatant' | 'socialite' | 'explorer' | 'ritualist' | 'crafter' | 'balanced' = 'balanced';
  let maxFreq = 0;
  for (const [style, freq] of Object.entries(freqs)) {
    if (freq > maxFreq && freq > 25) { // Must be >25% to be dominant
      dominantPlaystyle = style as any;
      maxFreq = freq;
    }
  }

  return {
    characterProfile: {
      combatFrequency,
      socialFrequency,
      explorationFrequency,
      ritualFrequency,
      craftingFrequency
    },
    riskAssessment: {
      lowRollRiskTaking: lowRollRiskCount,
      highRollConfidence: highRollConfidenceCount,
      riskTakingRatio,
      averageSuccessRate
    },
    moralAlignment: {
      goodChoices,
      evilChoices,
      neutralChoices,
      alignment: moralAlignment
    },
    generatedAt: state.tick || 0,
    dominantPlaystyle,
    profileVersion: 2
  };
}

/**
 * Get description text for a playstyle (for AI DM context)
 */
export function getPlaystyleDescription(profile: PlaystyleProfile): string {
  const style = profile.dominantPlaystyle;
  const risk = profile.riskAssessment.riskTakingRatio > 0.3 ? 'reckless' : 'cautious';
  const align = profile.moralAlignment.alignment > 20 ? 'good-hearted' : 
                profile.moralAlignment.alignment < -20 ? 'ruthless' :
                'pragmatic';

  const descriptions: Record<string, string> = {
    combatant: `A ${risk}, ${align} warrior who favors direct action and combat (${profile.characterProfile.combatFrequency}% combat). Success rate: ${profile.riskAssessment.averageSuccessRate}%.`,
    socialite: `A ${risk}, ${align} diplomat who prefers dialogue and social intrigue (${profile.characterProfile.socialFrequency}% social). Success rate: ${profile.riskAssessment.averageSuccessRate}%.`,
    explorer: `A ${risk}, ${align} wanderer who seeks discovery and adventure (${profile.characterProfile.explorationFrequency}% exploration). Success rate: ${profile.riskAssessment.averageSuccessRate}%.`,
    ritualist: `A ${risk}, ${align} magus who commands arcane and ritual power (${profile.characterProfile.ritualFrequency}% rituals). Success rate: ${profile.riskAssessment.averageSuccessRate}%.`,
    crafter: `A ${risk}, ${align} craftsperson focused on creation and construction (${profile.characterProfile.craftingFrequency}% crafting). Success rate: ${profile.riskAssessment.averageSuccessRate}%.`,
    balanced: `A versatile, ${align} adventurer with diverse interests. Combat: ${profile.characterProfile.combatFrequency}%, Social: ${profile.characterProfile.socialFrequency}%, Exploration: ${profile.characterProfile.explorationFrequency}%. Success rate: ${profile.riskAssessment.averageSuccessRate}%.`
  };

  return descriptions[style] || descriptions.balanced;
}
/**
 * Phase 19: Calculate AI DM adaptation parameters based on playstyle
 * Used to modify quest difficulty, NPC reactions, and world state
 */
export function getAiDmAdaptation(profile: PlaystyleProfile): {
  questDifficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  npcReactionType: 'sympathetic' | 'neutral' | 'antagonistic' | 'reactive';
  worldMutationFrequency: number; // 0-1: how often world state changes
  factorAlignmentBonus: Record<string, number>; // Faction ID -> reputation modifier
} {
  // Quest difficulty based on average success rate and risk-taking
  let questDifficulty: 'easy' | 'normal' | 'hard' | 'extreme' = 'normal';
  if (profile.riskAssessment.averageSuccessRate > 85 && profile.riskAssessment.riskTakingRatio > 0.4) {
    questDifficulty = 'hard';
  } else if (profile.riskAssessment.averageSuccessRate > 90 && profile.riskAssessment.riskTakingRatio > 0.5) {
    questDifficulty = 'extreme';
  } else if (profile.riskAssessment.averageSuccessRate < 40) {
    questDifficulty = 'easy';
  }

  // NPC reaction based on moral alignment
  let npcReactionType: 'sympathetic' | 'neutral' | 'antagonistic' | 'reactive' = 'neutral';
  if (profile.moralAlignment.alignment > 40) {
    npcReactionType = 'sympathetic';
  } else if (profile.moralAlignment.alignment < -40) {
    npcReactionType = 'antagonistic';
  } else if (Math.abs(profile.moralAlignment.alignment) <= 20) {
    npcReactionType = 'reactive';
  }

  // World mutation frequency based on exploration rate
  const worldMutationFrequency = Math.min(0.8, profile.characterProfile.explorationFrequency / 100);

  // Faction alignment bonuses based on playstyle
  const factorAlignmentBonus: Record<string, number> = {};
  
  // Combat-focused players get military faction favor
  if (profile.characterProfile.combatFrequency > 40) {
    factorAlignmentBonus.military = 25;
    factorAlignmentBonus.merchant = -15;
  }
  
  // Social players get merchant/nobility favor
  if (profile.characterProfile.socialFrequency > 35) {
    factorAlignmentBonus.merchant = 25;
    factorAlignmentBonus.military = -10;
  }
  
  // Ritual/crafting players get arcane/artisan favor
  if (profile.characterProfile.ritualFrequency + profile.characterProfile.craftingFrequency > 40) {
    factorAlignmentBonus.arcane = 30;
  }

  // Apply moral alignment
  if (profile.moralAlignment.alignment > 30) {
    factorAlignmentBonus.holy = 20;
    factorAlignmentBonus.shadow = -25;
  } else if (profile.moralAlignment.alignment < -30) {
    factorAlignmentBonus.shadow = 20;
    factorAlignmentBonus.holy = -25;
  }

  return {
    questDifficulty,
    npcReactionType,
    worldMutationFrequency,
    factorAlignmentBonus
  };
}