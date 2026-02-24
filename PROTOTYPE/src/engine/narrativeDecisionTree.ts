/**
 * narrativeDecisionTree.ts — NPC Decision Tree Engine (M43 Task A.2)
 * 
 * PURPOSE: Replace static NPC choices with probability distributions driven by
 * the AI Personality Vector. Generate deterministic action selection using SeededRng.
 * 
 * ARCHITECTURE:
 * 1. Conversation prompt → Decision node
 * 2. NPC Personality Vector evaluation → Decision weights
 * 3. SeededRng probability selection → Deterministic action
 * 4. Record in mutationLog as NPC_DECISION event
 * 
 * DETERMINISM: Same NPC + same seed + same personality = identical decisions
 * PERFORMANCE: All decisions complete in <5ms
 */

import type { NPC, WorldState, PlayerState } from './worldEngine';
import { SeededRng, seededNow } from './prng';
import type { NpcWithPersonalityState, PersonalityVector } from './personalityEngine';
import type { Event } from '../events/mutationLog';
import { 
  initializePersonality, 
  evaluateCooperationLikelihood,
  evaluateRiskTolerance,
  evaluateMysticalOpenness,
  evaluateGreedFactor,
  evaluateAuthorityResistance 
} from './personalityEngine';
import { getNpcMemoryEngine } from './npcMemoryEngine';

// ============================================================================
// DECISION TREE TYPES
// ============================================================================

export type DecisionOutcome = 
  | 'accept_quest' 
  | 'refuse_quest' 
  | 'accept_trade' 
  | 'refuse_trade' 
  | 'give_information' 
  | 'withhold_information' 
  | 'hostility' 
  | 'friendship' 
  | 'neutral' 
  | 'betrayal'
  | 'custom_action';

export interface DecisionWeight {
  outcome: DecisionOutcome;
  weight: number; // Relative probability (normalized during selection)
  personalityFactors: string[]; // e.g., 'high_compassion', 'low_prudence'
}

export interface DecisionNode {
  id: string;
  prompt: string; // The conversation/action prompt
  outcomes: DecisionWeight[]; // Possible outcomes with weights
  minPersonalityThreshold?: Partial<PersonalityVector>; // Gate: require minimum trait levels
  maxPersonalityThreshold?: Partial<PersonalityVector>; // Gate: require below maximum trait levels
  questPrerequisite?: string; // Optional: require specific quest state
  reputationMinimum?: number; // Optional: minimum player reputation required
  factionBased?: boolean; // True if outcome varies by NPC's faction alignment
}

export interface NpcDecision {
  npcId: string;
  decisionNodeId: string;
  timestamp: number; // seededNow(worldTick)
  tick: number;
  outcomeSelected: DecisionOutcome;
  outcomeDescription: string; // Human-readable why this outcome
  personalityState: PersonalityVector;
  confidenceScore: number; // [0-1] How confident was this decision
  seed: number; // RNG seed used for determinism verification
}

// ============================================================================
// PRESET DECISION NODES
// ============================================================================

/**
 * Common decision templates that NPCs use repeatedly
 * These can be customized per NPC in world instance
 */
export const DECISION_NODES: Record<string, DecisionNode> = {
  'quest_acceptance': {
    id: 'quest_acceptance',
    prompt: 'Will you help the player with a quest?',
    outcomes: [
      { 
        outcome: 'accept_quest', 
        weight: 1,
        personalityFactors: ['compassion', 'not_too_prudent'] 
      },
      { 
        outcome: 'refuse_quest', 
        weight: 1,
        personalityFactors: ['high_prudence', 'low_compassion'] 
      },
      { 
        outcome: 'neutral', 
        weight: 0.5, 
        personalityFactors: ['balanced'] 
      },
    ],
  },

  'trade_negotiation': {
    id: 'trade_negotiation',
    prompt: 'Will you accept this trade?',
    outcomes: [
      { 
        outcome: 'accept_trade', 
        weight: 1,
        personalityFactors: ['fair_price', 'compassion'] 
      },
      { 
        outcome: 'refuse_trade', 
        weight: 1,
        personalityFactors: ['greedy', 'low_compassion'] 
      },
      { 
        outcome: 'custom_action', // Counter-offer
        weight: 0.8, 
        personalityFactors: ['ambitious', 'not_foolish'] 
      },
    ],
  },

  'information_sharing': {
    id: 'information_sharing',
    prompt: 'Do you trust the player with this information?',
    outcomes: [
      { 
        outcome: 'give_information', 
        weight: 1,
        personalityFactors: ['high_compassion', 'player_trusted'] 
      },
      { 
        outcome: 'withhold_information', 
        weight: 1,
        personalityFactors: ['high_prudence', 'low_reputation'] 
      },
      { 
        outcome: 'custom_action', // Cryptic hints
        weight: 0.7, 
        personalityFactors: ['mystical', 'mysterious'] 
      },
    ],
  },

  'combat_decision': {
    id: 'combat_decision',
    prompt: 'Will you fight alongside the player?',
    outcomes: [
      { 
        outcome: 'friendship', 
        weight: 1.0, 
        personalityFactors: ['companion_trust', 'risk_tolerance'] 
      },
      { 
        outcome: 'neutral', 
        weight: 1.0, 
        personalityFactors: ['high_prudence', 'no_obligation'] 
      },
      { 
        outcome: 'refuse_quest', // Won't help
        weight: 0.8, 
        personalityFactors: ['cowardly', 'selfish'] 
      },
    ],
  },

  'paradox_response': {
    id: 'paradox_response',
    prompt: 'How does the NPC react to a paradox/timeline anomaly?',
    outcomes: [
      { 
        outcome: 'give_information', 
        weight: 1.0, 
        personalityFactors: ['high_mystique', 'knowledgeable'] 
      },
      { 
        outcome: 'custom_action', // Denial/confusion
        weight: 1.0, 
        personalityFactors: ['low_mystique', 'skeptical'] 
      },
      { 
        outcome: 'hostility', 
        weight: 0.6, 
        personalityFactors: ['frightened', 'defensive'] 
      },
    ],
  },

  'authority_challenge': {
    id: 'authority_challenge',
    prompt: 'Does the NPC question/obey a Director override?',
    outcomes: [
      { 
        outcome: 'neutral', 
        weight: 1.0, 
        personalityFactors: ['high_obedience', 'low_prudence'] 
      },
      { 
        outcome: 'hostility', 
        weight: 1.0, 
        personalityFactors: ['high_resistance', 'ambitious'] 
      },
      { 
        outcome: 'custom_action', // Questioning/suspicious
        weight: 0.8, 
        personalityFactors: ['cautious', 'intelligent'] 
      },
    ],
  },
};

// ============================================================================
// DECISION EVALUATION
// ============================================================================

/**
 * Evaluate which decision outcome an NPC will choose
 * 
 * DETERMINISM: Uses SeededRng(npcSeed, conversationId) for replay-safe decisions
 * PERFORMANCE: Completes in <3ms
 * Phase 25 Task 3: Accepts socialTension parameter for GST-driven behavior
 */
export function evaluateNpcDecision(
  npc: NpcWithPersonalityState,
  worldState: WorldState,
  decisionNodeId: string,
  conversationId: string,
  playerReputation?: number,
  questState?: string,
  playerId?: string,
  socialTension?: number
): NpcDecision {
  const worldTick = worldState.time?.tick ?? 0;
  const decisionNode = DECISION_NODES[decisionNodeId];

  if (!decisionNode) {
    throw new Error(`Unknown decision node: ${decisionNodeId}`);
  }

  // Initialize NPC personality if needed
  const personality = npc.personalityVector || 
    initializePersonality(npc, worldState.player?.bloodlineData, worldState.seed);

  // Check gate conditions
  if (decisionNode.minPersonalityThreshold) {
    for (const [key, minValue] of Object.entries(decisionNode.minPersonalityThreshold)) {
      if (personality[key as keyof PersonalityVector] < minValue) {
        // Personality doesn't meet minimum, return neutral or refuse
        return {
          npcId: npc.id,
          decisionNodeId,
          timestamp: seededNow(worldTick),
          tick: worldTick,
          outcomeSelected: 'neutral',
          outcomeDescription: 'Personality gate condition not met',
          personalityState: personality,
          confidenceScore: 0.5,
          seed: 0,
        };
      }
    }
  }

  // Gate: reputation check
  if (decisionNode.reputationMinimum !== undefined && playerReputation !== undefined) {
    if (playerReputation < decisionNode.reputationMinimum) {
      return {
        npcId: npc.id,
        decisionNodeId,
        timestamp: seededNow(worldTick),
        tick: worldTick,
        outcomeSelected: 'refuse_quest',
        outcomeDescription: 'Player reputation too low',
        personalityState: personality,
        confidenceScore: 0.7,
        seed: 0,
      };
    }
  }

  // Create deterministic RNG for this decision
  const npcSeed = npc.currentPersonalitySeed ?? 0;
  const conversationSeed = hashString(conversationId);
  const decisionSeed = hashCombine(npcSeed, conversationSeed ^ worldTick);
  const rng = new SeededRng(decisionSeed);

  // Weight outcomes based on personality AND memory AND social tension
  const weightedOutcomes = decisionNode.outcomes.map(outcome => ({
    ...outcome,
    adjustedWeight: calculateOutcomeWeight(outcome, personality, rng, npc.id, playerId, socialTension),
  }));

  // Normalize weights
  const totalWeight = weightedOutcomes.reduce((sum, o) => sum + o.adjustedWeight, 0);
  const normalizedOutcomes = weightedOutcomes.map(o => ({
    ...o,
    normalizedWeight: o.adjustedWeight / totalWeight,
  }));

  // Select outcome probabilistically
  const roll = rng.next(); // [0, 1)
  let cumulative = 0;
  const selected = normalizedOutcomes.find(o => {
    cumulative += o.normalizedWeight;
    return roll < cumulative;
  }) || normalizedOutcomes[normalizedOutcomes.length - 1];

  // Calculate confidence (how aligned was this decision with personality)
  const confidenceScore = calculateDecisionConfidence(
    selected,
    personality,
    playerReputation,
    npc.id,
    playerId
  );

  return {
    npcId: npc.id,
    decisionNodeId,
    timestamp: seededNow(worldTick),
    tick: worldTick,
    outcomeSelected: selected.outcome,
    outcomeDescription: describeOutcome(selected.outcome, personality, npc.id, playerId),
    personalityState: personality,
    confidenceScore,
    seed: decisionSeed,
  };
}

// ============================================================================
// OUTCOME WEIGHTING
// ============================================================================

/**
 * Calculate weight adjustment based on personality vector and social tension
 * Higher weight = more likely to be selected
 * 
 * Phase 25 Task 3: GST multipliers modify NPC behavior under social pressure
 * - High tension (GST > 0.75): boosts hostility, reduces friendship
 * - Low tension (GST < 0.3): boosts friendship, reduces hostility
 */
function calculateOutcomeWeight(
  outcome: DecisionWeight,
  personality: PersonalityVector,
  rng: SeededRng,
  npcId: string,
  playerId?: string,
  socialTension?: number
): number {
  let weight = outcome.weight;

  // Adjust based on personality factors
  for (const factor of outcome.personalityFactors) {
    if (factor === 'compassion') {
      weight *= 1 + personality.compassion * 0.5;
    } else if (factor === 'high_compassion') {
      weight *= personality.compassion > 0.6 ? 1.5 : 0.7;
    } else if (factor === 'low_compassion') {
      weight *= personality.compassion < 0.4 ? 1.5 : 0.7;
    } else if (factor === 'ambition') {
      weight *= 1 + personality.ambition * 0.5;
    } else if (factor === 'ambitious') {
      weight *= personality.ambition > 0.6 ? 1.5 : 0.7;
    } else if (factor === 'high_prudence') {
      weight *= personality.prudence > 0.6 ? 1.5 : 0.7;
    } else if (factor === 'not_too_prudent') {
      weight *= personality.prudence < 0.7 ? 1.5 : 0.7;
    } else if (factor === 'mystical') {
      weight *= personality.mystique > 0.6 ? 1.5 : 0.7;
    } else if (factor === 'high_mystique') {
      weight *= personality.mystique > 0.7 ? 1.8 : 0.6;
    } else if (factor === 'skeptical') {
      weight *= personality.mystique < 0.4 ? 1.5 : 0.7;
    } else if (factor === 'greedy') {
      weight *= personality.ambition > 0.6 ? 1.4 : 0.7;
    } else if (factor === 'cowardly') {
      weight *= personality.prudence > 0.7 ? 1.5 : 0.6;
    } else if (factor === 'not_foolish') {
      weight *= personality.prudence > 0.4 ? 1.3 : 0.8;
    } else if (factor === 'balanced') {
      // Balanced personalities: neutral outcomes more likely
      const balanceScore = 1 - (
        Math.abs(personality.compassion - 0.5) +
        Math.abs(personality.ambition - 0.5) +
        Math.abs(personality.prudence - 0.5) +
        Math.abs(personality.mystique - 0.5)
      ) / 2;
      weight *= 1 + balanceScore * 0.5;
    }
  }

  // M44 SOCIAL MEMORY ADJUSTMENTS
  if (playerId) {
    const impact = getNpcMemoryEngine().getMemoryImpactOnDialogue(npcId, playerId);
    
    for (const factor of outcome.personalityFactors) {
      if (factor === 'player_trusted') {
        weight *= 1 + (impact.trustLevel * 0.8);
      } else if (factor === 'companion_trust') {
        weight *= 1 + (impact.trustLevel * 1.2);
      } else if (factor === 'no_obligation') {
        // CautionLevel (from grudges) reduces sense of obligation
        weight *= 1 + (impact.cautionLevel * 0.5);
      } else if (factor === 'frightened') {
        // High caution makes NPC more "frightened" of player
        weight *= 1 + (impact.cautionLevel * 0.6);
      }
    }
  }

  // Phase 25 Task 3: Global Social Tension (GST) multipliers
  if (socialTension !== undefined && socialTension > 0) {
    const gstLevel = Math.min(1.0, socialTension);
    
    if (gstLevel > 0.75) {
      // HIGH TENSION: Hostility boosted, Friendship reduced
      if (outcome.outcome === 'hostility') {
        weight *= 1.5; // 50% more likely to be hostile
      } else if (outcome.outcome === 'friendship' || outcome.outcome === 'accept_quest' || outcome.outcome === 'accept_trade') {
        weight *= 0.7; // 30% less likely to cooperate
      }
    } else if (gstLevel > 0.4) {
      // MODERATE TENSION: Slight hostility boost, slight friendship reduction
      if (outcome.outcome === 'hostility') {
        weight *= 1.2; // 20% more likely to be hostile
      } else if (outcome.outcome === 'friendship' || outcome.outcome === 'accept_quest') {
        weight *= 0.85; // 15% less likely to cooperate
      }
    } else if (gstLevel < 0.3) {
      // LOW TENSION / PEACEFUL: Friendship boosted, Hostility reduced
      if (outcome.outcome === 'friendship' || outcome.outcome === 'accept_quest' || outcome.outcome === 'give_information') {
        weight *= 1.3; // 30% more likely to cooperate
      } else if (outcome.outcome === 'hostility') {
        weight *= 0.8; // 20% less likely to be hostile
      }
    }
  }

  return Math.max(weight, 0.1); // Prevent zero weights
}

/**
 * Calculate decision confidence score [0-1]
 * Higher = better aligned with personality
 */
function calculateDecisionConfidence(
  selected: DecisionWeight & { normalizedWeight: number },
  personality: PersonalityVector,
  playerReputation: number | undefined,
  npcId: string,
  playerId?: string
): number {
  // Base confidence from normalized weight
  let confidence = Math.min(selected.normalizedWeight * 2, 1);

  // Adjust by personality factor alignment
  const alignmentCount = selected.personalityFactors.filter(
    factor => isPersonalityAligned(factor, personality, npcId, playerId)
  ).length;
  
  const alignmentBonus = (alignmentCount / Math.max(selected.personalityFactors.length, 1)) * 0.3;
  confidence = Math.min(confidence + alignmentBonus, 1);

  return confidence;
}

function isPersonalityAligned(
  factor: string, 
  personality: PersonalityVector,
  npcId: string,
  playerId?: string
): boolean {
  // Check social factors first
  if (playerId) {
    const impact = getNpcMemoryEngine().getMemoryImpactOnDialogue(npcId, playerId);
    if (factor === 'player_trusted' || factor === 'companion_trust') {
      return impact.trustLevel > 0.5;
    }
    if (factor === 'frightened') {
      return impact.cautionLevel > 0.6;
    }
  }

  switch (factor) {
    case 'compassion':
    case 'high_compassion':
      return personality.compassion > 0.5;
    case 'low_compassion':
      return personality.compassion < 0.5;
    case 'ambitious':
      return personality.ambition > 0.6;
    case 'high_prudence':
      return personality.prudence > 0.6;
    case 'not_too_prudent':
      return personality.prudence < 0.7;
    case 'mystical':
    case 'high_mystique':
      return personality.mystique > 0.6;
    case 'skeptical':
      return personality.mystique < 0.4;
    default:
      return true;
  }
}

/**
 * Generate human-readable description of why this outcome was selected
 */
function describeOutcome(
  outcome: DecisionOutcome, 
  personality: PersonalityVector,
  npcId: string,
  playerId?: string
): string {
  const comps = [
    personality.compassion > 0.6 ? 'compassionate' : '',
    personality.ambition > 0.6 ? 'ambitious' : '',
    personality.prudence > 0.6 ? 'cautious' : '',
    personality.mystique > 0.6 ? 'mystical' : '',
  ].filter(s => s);

  // M44 memory flavor
  let memoryFlavor = '';
  if (playerId) {
    const impact = getNpcMemoryEngine().getMemoryImpactOnDialogue(npcId, playerId);
    if (impact.trustLevel > 0.7) memoryFlavor = 'with deep trust';
    else if (impact.cautionLevel > 0.7) memoryFlavor = 'with visible suspicion';
    else if (impact.sentiment > 0.5) memoryFlavor = 'warmly';
    else if (impact.sentiment < -0.5) memoryFlavor = 'coldly';
  }

  const reason = comps.length > 0 
    ? `As a ${comps.join(', ')} NPC, ` 
    : 'The NPC ';

  const flavor = memoryFlavor ? ` ${memoryFlavor}` : '';

  switch (outcome) {
    case 'accept_quest':
      return reason + 'accepts the quest' + flavor + '.';
    case 'refuse_quest':
      return reason + 'refuses the quest' + flavor + '.';
    case 'accept_trade':
      return reason + 'accepts the trade' + flavor + '.';
    case 'refuse_trade':
      return reason + 'refuses the trade' + flavor + '.';
    case 'give_information':
      return reason + 'shares the information' + flavor + '.';
    case 'withhold_information':
      return reason + 'keeps the information secret' + flavor + '.';
    case 'hostility':
      return reason + 'becomes hostile' + flavor + '.';
    case 'friendship':
      return reason + 'becomes friendly' + flavor + '.';
    case 'neutral':
      return reason + 'remains neutral' + flavor + '.';
    case 'betrayal':
      return reason + 'betrays the player' + flavor + '.';
    case 'custom_action':
      return reason + 'performs a custom action' + flavor + '.';
    default:
      return 'Unknown outcome.';
  }
}

// ============================================================================
// MUTATION LOG INTEGRATION
// ============================================================================

/**
 * Record decision in mutation log for audit trail
 */
export function recordDecisionMutation(
  decision: NpcDecision,
  mutationLog: Event[]
): void {
  if (mutationLog) {
    mutationLog.push({
      type: 'NPC_DECISION',
      npcId: decision.npcId,
      tick: decision.tick,
      timestamp: decision.timestamp,
      decisionNodeId: decision.decisionNodeId,
      outcome: decision.outcomeSelected,
      description: decision.outcomeDescription,
      confidence: decision.confidenceScore,
      seed: decision.seed,
      payload: {
        confidence: decision.confidenceScore,
        personalityState: decision.personalityState
      }
    } as Event);
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function hashCombine(a: number, b: number): number {
  return a ^ (b * 2654435761);
}

// ============================================================================
// EXPORTS
// ============================================================================
// Interfaces are already exported above
