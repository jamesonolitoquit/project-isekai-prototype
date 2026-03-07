/**
 * intentResolverEngine.ts - M45-B1: Complex Social Intent Resolution
 * Resolves social interactions, persuasion checks, deception, and interpersonal conflicts with DC mechanics.
 */

import { SeededRng } from './prng';
import type { NPC } from './worldEngine';

export type SocialIntent = 
  | 'PERSUADE' 
  | 'DECEIVE' 
  | 'INTIMIDATE' 
  | 'CHARM' 
  | 'NEGOTIATE' 
  | 'BLUFF' 
  | 'INSPIRE' 
  | 'SEDUCE' 
  | 'MANIPULATE' 
  | 'THREATEN'
  | 'GOSSIP';

export interface ComplexIntent {
  id: string;
  intentType: SocialIntent;
  initiatorNpcId: string;
  targetNpcId: string;
  description: string;
  stakes: 'low' | 'medium' | 'high';
  desiredOutcome: string;
  penalty?: number;
}

export interface DcContext {
  baseDc: number;
  modifiers: Record<string, number>;
  totalDc: number;
  difficulty: 'trivial' | 'easy' | 'moderate' | 'hard' | 'very_hard';
}

export interface SkillCheckResult {
  roll: number;
  modifier: number;
  total: number;
  isSuccess: boolean;
  margin: number;
  dc: number;
}

export interface IntentOutcome {
  id: string;
  intent: ComplexIntent;
  skillCheck: SkillCheckResult;
  narrativeResult: string;
  emotionalEffect: Record<string, number>;
  consequentialShift: string;
  relationship_impact: number;
  consequenceDescription?: string;
  reputation_impact?: Record<string, number>;
}

export interface NpcSkills {
  persuasion: number;
  deception: number;
  intimidation: number;
  charm: number;
  negotiation: number;
  bluff: number;
  inspiration: number;
  seduction: number;
  manipulation: number;
  threats: number;
}

export interface NpcDefenses {
  wisdom: number;
  insight: number;
  defiance: number;
  resolve: number;
  skepticism: number;
}

class IntentResolverEngine {
  private rng: SeededRng;
  private outcomes: Map<string, IntentOutcome> = new Map();

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
  }

  private mapIntentToSkill(intent: SocialIntent): keyof NpcSkills {
    const mapping: Record<SocialIntent, keyof NpcSkills> = {
      'PERSUADE': 'persuasion',
      'DECEIVE': 'deception',
      'INTIMIDATE': 'intimidation',
      'CHARM': 'charm',
      'NEGOTIATE': 'negotiation',
      'BLUFF': 'bluff',
      'INSPIRE': 'inspiration',
      'SEDUCE': 'seduction',
      'MANIPULATE': 'manipulation',
      'THREATEN': 'threats',
      'GOSSIP': 'persuasion' // Treat gossip as persuasion-based (social skill)
    };
    return mapping[intent];
  }

  private calculateBaseDc(targetNpc: NPC, intent: SocialIntent): number {
    const baseDifficulty: Record<SocialIntent, number> = {
      'PERSUADE': 12,
      'DECEIVE': 13,
      'INTIMIDATE': 11,
      'CHARM': 12,
      'NEGOTIATE': 13,
      'BLUFF': 14,
      'INSPIRE': 12,
      'SEDUCE': 15,
      'MANIPULATE': 14,
      'THREATEN': 10,
      'GOSSIP': 10  // GOSSIP is relatively easy (just sharing information)
    };

    let baseDc = baseDifficulty[intent] || 12;

    const dispositionModifier = ((targetNpc as any).disposition || 0) / 10;
    baseDc -= dispositionModifier;

    return Math.max(5, baseDc);
  }

  private calculateDcContext(
    initiatorNpc: NPC,
    targetNpc: NPC,
    intent: SocialIntent,
    stakes: 'low' | 'medium' | 'high'
  ): DcContext {
    let baseDc = this.calculateBaseDc(targetNpc, intent);

    const modifiers: Record<string, number> = {};

    if (stakes === 'high') {
      modifiers['high_stakes'] = 3;
    } else if (stakes === 'medium') {
      modifiers['medium_stakes'] = 1;
    }

    const relationshipShift = ((initiatorNpc as any).reputation || 0) - ((targetNpc as any).reputation || 0);
    if (relationshipShift > 20) {
      modifiers['strong_rapport'] = -2;
    } else if (relationshipShift < -20) {
      modifiers['poor_rapport'] = 2;
    }

    const totalDc = baseDc + Object.values(modifiers).reduce((a, b) => a + b, 0);

    let difficulty: DcContext['difficulty'];
    if (totalDc <= 8) difficulty = 'trivial';
    else if (totalDc <= 11) difficulty = 'easy';
    else if (totalDc <= 14) difficulty = 'moderate';
    else if (totalDc <= 19) difficulty = 'hard';
    else difficulty = 'very_hard';

    return {
      baseDc,
      modifiers,
      totalDc,
      difficulty
    };
  }

  performSkillCheck(
    initiatorNpc: NPC,
    skillLevel: number,
    dcContext: DcContext
  ): SkillCheckResult {
    const roll = this.rng.nextInt(1, 20);
    const modifier = Math.floor(skillLevel / 5);
    const total = roll + modifier;
    const isSuccess = total >= dcContext.totalDc;
    const margin = total - dcContext.totalDc;

    return {
      roll,
      modifier,
      total,
      isSuccess,
      margin,
      dc: dcContext.totalDc
    };
  }

  resolveIntent(
    intent: ComplexIntent,
    initiatorNpc: NPC,
    targetNpc: NPC
  ): IntentOutcome {
    const skillKey = this.mapIntentToSkill(intent.intentType);
    const initiatorSkillLevel = ((initiatorNpc as any).skills?.[skillKey] as number) || 5;

    const dcContext = this.calculateDcContext(initiatorNpc, targetNpc, intent.intentType, intent.stakes);
    const skillCheck = this.performSkillCheck(initiatorNpc, initiatorSkillLevel, dcContext);

    const narrativeResult = this.generateNarrative(
      intent.intentType,
      skillCheck.isSuccess,
      skillCheck.margin,
      initiatorNpc,
      targetNpc
    );

    const emotionalEffect = this.calculateEmotionalEffect(
      intent.intentType,
      skillCheck.isSuccess,
      skillCheck.margin,
      targetNpc
    );

    const relationshipImpact = this.calculateRelationshipImpact(
      intent.intentType,
      skillCheck.isSuccess,
      skillCheck.margin,
      intent.stakes
    );

    const consequentialShift = this.determineConsequentialShift(
      intent.intentType,
      skillCheck.isSuccess,
      skillCheck.margin
    );

    const outcome: IntentOutcome = {
      id: `outcome_${intent.id}_${Date.now()}`,
      intent,
      skillCheck,
      narrativeResult,
      emotionalEffect,
      consequentialShift,
      relationship_impact: relationshipImpact,
      reputation_impact: this.calculateReputationImpact(
        intent.intentType,
        skillCheck.isSuccess,
        skillCheck.margin
      )
    };

    this.outcomes.set(outcome.id, outcome);
    return outcome;
  }

  private generateNarrative(
    intent: SocialIntent,
    success: boolean,
    margin: number,
    initiator: NPC,
    target: NPC
  ): string {
    const messages: Record<SocialIntent, { success: string[]; failure: string[]; }> = {
      'PERSUADE': {
        success: [
          `${initiator.name} convinced ${target.name} to agree.`,
          `${target.name} was swayed by ${initiator.name}'s argument.`
        ],
        failure: [
          `${target.name} remained unconvinced by ${initiator.name}'s words.`,
          `The attempt to persuade failed.`
        ]
      },
      'DECEIVE': {
        success: [
          `${target.name} believed ${initiator.name}'s story.`,
          `The deception went undetected.`
        ],
        failure: [
          `${target.name} saw through the lie.`,
          `The deception was discovered.`
        ]
      },
      'INTIMIDATE': {
        success: [
          `${target.name} was frightened by ${initiator.name}'s presence.`,
          `Fear gripped ${target.name}.`
        ],
        failure: [
          `${target.name} refused to be intimidated.`,
          `The intimidation had no effect.`
        ]
      },
      'CHARM': {
        success: [
          `${target.name} found ${initiator.name} charming.`,
          `${initiator.name}'s charm worked perfectly.`
        ],
        failure: [
          `${target.name} was unmoved by the charm attempt.`,
          `The charm failed to work.`
        ]
      },
      'NEGOTIATE': {
        success: [
          `${initiator.name} and ${target.name} reached an agreement.`,
          `Negotiations succeeded.`
        ],
        failure: [
          `The negotiations broke down.`,
          `No agreement could be reached.`
        ]
      },
      'BLUFF': {
        success: [
          `${target.name} fell for the bluff.`,
          `${initiator.name}'s bluff was believed.`
        ],
        failure: [
          `${target.name} called the bluff.`,
          `The ruse was exposed.`
        ]
      },
      'INSPIRE': {
        success: [
          `${target.name} was inspired by ${initiator.name}'s words.`,
          `Inspiration stirred in ${target.name}'s heart.`
        ],
        failure: [
          `The words had no inspirational effect.`,
          `No inspiration took hold.`
        ]
      },
      'SEDUCE': {
        success: [
          `${target.name} was captivated by ${initiator.name}.`,
          `Seduction proved effective.`
        ],
        failure: [
          `The seduction attempt failed.`,
          `${target.name} rebuffed the advance.`
        ]
      },
      'MANIPULATE': {
        success: [
          `${target.name} was manipulated by ${initiator.name}.`,
          `Manipulation succeeded perfectly.`
        ],
        failure: [
          `The manipulation attempt failed.`,
          `${target.name} resisted being manipulated.`
        ]
      },
      'THREATEN': {
        success: [
          `${target.name} heeded the threat.`,
          `The threat was taken seriously.`
        ],
        failure: [
          `${target.name} dismissed the threat.`,
          `The threat had no effect.`
        ]
      },
      'GOSSIP': {
        success: [
          `${target.name} listened intently to ${initiator.name}'s gossip.`,
          `The gossip was shared successfully.`
        ],
        failure: [
          `${target.name} showed little interest in the gossip.`,
          `The gossip fell on deaf ears.`
        ]
      }
    };

    const msgArray = success ? messages[intent].success : messages[intent].failure;
    return msgArray[this.rng.nextInt(0, msgArray.length - 1)];
  }

  private calculateEmotionalEffect(
    intent: SocialIntent,
    success: boolean,
    margin: number,
    targetNpc: NPC
  ): Record<string, number> {
    const effects: Record<string, number> = {};

    if (success) {
      if (intent === 'CHARM' || intent === 'SEDUCE') {
        effects['affection'] = 5 + margin;
        effects['trust'] = margin > 0 ? 3 : 0;
      } else if (intent === 'INTIMIDATE' || intent === 'THREATEN') {
        effects['fear'] = 5 + margin;
        effects['respect'] = margin > 0 ? 2 : -5;
      } else if (intent === 'INSPIRE') {
        effects['inspiration'] = 5 + margin;
        effects['morale'] = 3 + margin;
      } else if (intent === 'MANIPULATE') {
        effects['distrust'] = -3;
        effects['compliance'] = 5 + margin;
      }
    } else {
      if (intent === 'DECEIVE' || intent === 'BLUFF') {
        effects['suspicion'] = 5;
        effects['distrust'] = 5;
      } else if (intent === 'INTIMIDATE' || intent === 'THREATEN') {
        effects['resentment'] = 5;
        effects['defiance'] = 5;
      } else if (intent === 'MANIPULATE') {
        effects['anger'] = 3;
        effects['wariness'] = 5;
      }
    }

    return effects;
  }

  private calculateRelationshipImpact(
    intent: SocialIntent,
    success: boolean,
    margin: number,
    stakes: 'low' | 'medium' | 'high'
  ): number {
    let baseImpact = 0;

    if (success) {
      baseImpact = 5 + margin;
      if (stakes === 'high') baseImpact *= 2;
      else if (stakes === 'medium') baseImpact *= 1.5;
    } else {
      baseImpact = -3 - Math.abs(margin);
      if (stakes === 'high') baseImpact *= 2;
    }

    return Math.round(baseImpact);
  }

  private determineConsequentialShift(
    intent: SocialIntent,
    success: boolean,
    margin: number
  ): string {
    if (success && margin >= 5) {
      return 'critical_success';
    } else if (success) {
      return 'moderate_success';
    } else if (margin <= -5) {
      return 'critical_failure';
    } else {
      return 'moderate_failure';
    }
  }

  private calculateReputationImpact(
    intent: SocialIntent,
    success: boolean,
    margin: number
  ): Record<string, number> {
    const repImpact: Record<string, number> = {};

    if (success && margin >= 5) {
      repImpact['legendary'] = margin;
      repImpact['charismatic'] = 2;
    } else if (success) {
      repImpact['impressive'] = 1;
    } else if (margin <= -5) {
      repImpact['shameful'] = Math.abs(margin);
    }

    return repImpact;
  }

  getOutcome(outcomeId: string): IntentOutcome | undefined {
    return this.outcomes.get(outcomeId);
  }

  getAllOutcomes(): IntentOutcome[] {
    return Array.from(this.outcomes.values());
  }

  clearHistory(): void {
    this.outcomes.clear();
  }

  reset(): void {
    this.outcomes.clear();
  }
}

let resolverInstance: IntentResolverEngine | null = null;

export function getIntentResolverEngine(seed?: number): IntentResolverEngine {
  if (!resolverInstance) {
    resolverInstance = new IntentResolverEngine(seed);
  }
  return resolverInstance;
}

export function resetIntentResolverEngine(): void {
  if (resolverInstance) {
    resolverInstance.reset();
    resolverInstance = null;
  }
}

export const IntentResolverExports = {
  getIntentResolverEngine,
  resetIntentResolverEngine
};
