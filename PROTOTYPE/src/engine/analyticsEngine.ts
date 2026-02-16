import { WorldState } from './worldEngine';

/**
 * analyticsEngine.ts - M26: Playstyle Analytics
 * 
 * Analyzes player actions and behavior patterns to generate a PlaystyleProfile.
 * This profile is used by the AI DM to adapt NPC dialogue and behavior.
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
  // TODO: Implement full analytics when event history becomes accessible
  // For now, return a balanced default profile
  return generateDefaultPlaystyleProfile(state);
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
