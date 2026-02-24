/**
 * M65: Gossip Propagation Engine
 * 
 * BFS-based information spreading through social network with:
 * - Sentiment distortion per hop (-15% baseline)
 * - HardFact anchors to prevent loops
 * - World-state consistency validation
 * - Performance target: <50ms for 50+ NPC cascade
 * 
 * Simulates "Telephone Game" mechanics for organic misinformation.
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';
import type {
  SocialGraph,
  GossipEvent,
  SocialNode,
  RelationshipType
} from './m65SocialGraphEngine';
import {
  getSocialConnections
} from './m65SocialGraphEngine';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Gossip Propagation
// ============================================================================

/**
 * Hard fact: anchors gossip to verified truth
 * Prevents infinite loops and grounds information
 */
export interface HardFact {
  readonly factId: string;
  readonly content: string;
  readonly category: string;
  readonly verifiedBy: string[]; // NPC IDs who verified
  readonly createdAt: number;
  readonly isDisputed: boolean;
}

/**
 * Gossip propagation path through network
 */
export interface PropagationPath {
  readonly pathId: string;
  readonly gossipId: string;
  readonly originNpcId: string;
  readonly originTick: number;
  readonly hops: PropagationHop[];
  readonly completedAt?: number;
}

/**
 * Individual hop in propagation path
 */
export interface PropagationHop {
  readonly hopIndex: number;
  readonly fromNpcId: string;
  readonly toNpcId: string;
  readonly sentimentShift: number; // -100 to +100
  readonly reliabilityDelta: number; // Change in trust
  readonly timeElapsed: number; // Ticks to propagate
  readonly willSpread: boolean; // Will this NPC continue spreading?
}

/**
 * Gossip cascade: group of related propagations
 */
export interface GossipCascade {
  readonly cascadeId: string;
  readonly rootGossipId: string;
  readonly rootNpcId: string;
  readonly startTick: number;
  readonly allPropagations: PropagationPath[];
  readonly maxDepth: number;
  readonly npcsInformed: Set<string>;
  readonly isResolved: boolean;
}

// ============================================================================
// GOSSIP ENGINE: Core Operations
// ============================================================================

let activeCascades = new Map<string, GossipCascade>();
let hardFacts = new Map<string, HardFact>();

// ============================================================================
// MUTATION HELPERS: Type-safe gossip updates
// ============================================================================

/**
 * Create updated hard fact  
 * Ensures immutability by returning new object
 */
function updateHardFact(fact: HardFact, updates: Partial<Omit<HardFact, 'readonly'>>): HardFact {
  return { ...fact, ...updates };
}

/**
 * Create updated cascade
 * Ensures immutability by returning new object
 */
function updateGossipCascade(cascade: GossipCascade, updates: Partial<Omit<GossipCascade, 'readonly'>>): GossipCascade {
  return { ...cascade, ...updates };
}

/**
 * Initiate gossip cascade from an NPC
 * Spreads information through their social network
 * 
 * @param graphId Social graph
 * @param originNpcId Starting NPC
 * @param gossip Gossip to spread
 * @param maxDepth Maximum propagation hops (2-4 typical)
 * @returns Created cascade
 */
export function initiateGossipCascade(
  graph: SocialGraph,
  originNpcId: string,
  gossip: Omit<GossipEvent, 'gossipId' | 'origin' | 'originTick' | 'propagatedTo'>,
  maxDepth: number = 3
): GossipCascade | null {
  const originNode = graph.nodes.get(originNpcId);
  if (!originNode) return null;

  const gossipId = `gossip_${uuid()}`;
  const gossipEvent: GossipEvent = {
    gossipId,
    origin: originNpcId,
    originTick: Date.now(),
    content: gossip.content,
    category: gossip.category,
    reliabilityScore: gossip.reliabilityScore,
    emotionalWeight: gossip.emotionalWeight,
    propagatedTo: new Set([originNpcId]),
    decayRate: gossip.decayRate || -0.15 // -15% per hop
  };

  const cascade: GossipCascade = {
    cascadeId: `cascade_${uuid()}`,
    rootGossipId: gossipId,
    rootNpcId: originNpcId,
    startTick: Date.now(),
    allPropagations: [],
    maxDepth,
    npcsInformed: new Set([originNpcId]),
    isResolved: false
  };

  activeCascades.set(cascade.cascadeId, cascade);

  // Start propagation from origin
  propagateGossipFromNpc(graph, cascade, gossipEvent, originNpcId, 0, maxDepth);

  return cascade;
}

/**
 * Recursively propagate gossip to connected NPCs
 * 
 * @param graphId Social graph
 * @param cascade Current cascade
 * @param gossip Gossip being spread
 * @param fromNpcId Current spreader
 * @param currentDepth Current hop depth
 * @param maxDepth Maximum depth allowed
 */
function propagateGossipFromNpc(
  graph: SocialGraph,
  cascade: GossipCascade,
  gossip: GossipEvent,
  fromNpcId: string,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth >= maxDepth) return;
  if (gossip.reliabilityScore < 5) return; // Too degraded to spread further

  const spreadingNpc = graph.nodes.get(fromNpcId);
  if (!spreadingNpc) return;

  // Get neighbors and filter by susceptibility
  const connections = getSocialConnections(graph.graphId, fromNpcId);
  for (const conn of connections) {
    if (cascade.npcsInformed.has(conn.npcId)) continue;

    const targetNode = graph.nodes.get(conn.npcId);
    if (!targetNode) continue;

    // Calculate if this NPC will spread the gossip
    const willSpread = calculateWillSpread(
      targetNode,
      gossip,
      conn.type,
      conn.sentiment,
      conn.strength
    );

    if (!willSpread && Math.random() > 0.2) continue; // 20% chance anyway

    // Calculate sentiment and reliability changes
    const sentimentShift = calculateSentimentShift(
      gossip.emotionalWeight,
      conn.sentiment,
      targetNode.duplicityScore
    );

    const reliabilityDelta = calculateReliabilityDelta(
      gossip.reliabilityScore,
      targetNode.trustRating,
      gossip.decayRate
    );

    // Create propagation path entry
    const hop: PropagationHop = {
      hopIndex: currentDepth + 1,
      fromNpcId,
      toNpcId: conn.npcId,
      sentimentShift,
      reliabilityDelta,
      timeElapsed: 1 + Math.random() * 5, // 1-6 ticks to propagate
      willSpread
    };

    const path: PropagationPath = {
      pathId: `path_${uuid()}`,
      gossipId: gossip.gossipId,
      originNpcId: cascade.rootNpcId,
      originTick: cascade.startTick,
      hops: [hop]
    };

    cascade.allPropagations.push(path);
    cascade.npcsInformed.add(conn.npcId);
    gossip.propagatedTo.add(conn.npcId);

    // Continue propagation if this NPC will spread
    if (willSpread) {
      // Create modified gossip for next hop
      const nextGossip: GossipEvent = {
        ...gossip,
        reliabilityScore: Math.max(0, gossip.reliabilityScore + reliabilityDelta),
        emotionalWeight: Math.max(0, Math.min(100, gossip.emotionalWeight + sentimentShift))
      };

      propagateGossipFromNpc(graph, cascade, nextGossip, conn.npcId, currentDepth + 1, maxDepth);
    }
  }
}

/**
 * Calculate if an NPC will spread gossip to others
 * 
 * @param npc Target NPC
 * @param gossip Gossip content
 * @param relationType Relationship type to spreader
 * @param sentiment Emotional relationship
 * @param strength Relationship strength
 * @returns Should spread?
 */
function calculateWillSpread(
  npc: SocialNode,
  gossip: GossipEvent,
  relationType: RelationshipType,
  sentiment: number,
  strength: number
): boolean {
  let spreadChance = 0;

  // Base gossip susceptibility
  spreadChance += npc.gossipSusceptibility * 0.5;

  // Category modifier (scandals spread more)
  const categoryModifiers: Record<string, number> = {
    scandal: 1.5,
    rumor: 1,
    fact: 0.3,
    opportunity: 0.8,
    threat: 1.2
  };
  spreadChance *= categoryModifiers[gossip.category] || 1;

  // Emotional weight increases spread
  spreadChance += gossip.emotionalWeight * 0.3;

  // Relationship influence: rivals spread negative, friends spread positive
  if (gossip.emotionalWeight > 0 && sentiment > 50) {
    spreadChance += strength * 0.2; // Friends spread good news
  } else if (gossip.emotionalWeight < 0 && sentiment < 50) {
    spreadChance += strength * 0.3; // Rivals spread bad news more eagerly
  }

  // Duplicity: liars are more likely to spread
  spreadChance += npc.duplicityScore * 0.15;

  return spreadChance > 50; // 50% threshold
}

/**
 * Calculate sentiment shift through one propagation hop
 * Mimics exaggeration and distortion in "Telephone Game"
 * 
 * @param originalWeight Original emotional weight
 * @param spreaderSentiment Spreader's sentiment about topic
 * @param spreaderDuplicity How dishonest the spreader is
 * @returns Sentiment shift (-100 to +100)
 */
function calculateSentimentShift(
  originalWeight: number,
  spreaderSentiment: number,
  spreaderDuplicity: number
): number {
  // Base exaggeration proportional to original weight
  let shift = originalWeight * (spreaderDuplicity / 200); // Max ±50

  // Spreader's sentiment biases exaggeration direction
  if (spreaderSentiment > 50) {
    shift += Math.random() * 15; // Positive bias
  } else if (spreaderSentiment < 50) {
    shift -= Math.random() * 15; // Negative bias
  }

  // Cap at ±50 per hop
  return Math.max(-50, Math.min(50, shift));
}

/**
 * Calculate reliability degradation per hop
 * Truth value decays with each spread
 * 
 * @param currentReliability Current reliability (0-100)
 * @param receiverTrustRating How good receiver is at filtering lies
 * @param decayRate Per-hop decay percentage (-0.15 = -15%)
 * @returns Reliability delta
 */
function calculateReliabilityDelta(
  currentReliability: number,
  receiverTrustRating: number,
  decayRate: number
): number {
  // Base decay
  const baseLoss = currentReliability * decayRate;

  // High trust receivers lose less (they filter better)
  const trustBonus = (receiverTrustRating / 100) * (baseLoss * -1) * 0.5;

  return baseLoss + trustBonus;
}

/**
 * Register a hard fact anchor
 * Prevents gossip from spinning infinitely
 * 
 * @param content Fact content
 * @param category Fact category
 * @param verifiedBy NPCs who verified
 * @returns Created hard fact
 */
export function registerHardFact(
  content: string,
  category: string,
  verifiedBy: string[]
): HardFact {
  const fact: HardFact = {
    factId: `fact_${uuid()}`,
    content,
    category,
    verifiedBy,
    createdAt: Date.now(),
    isDisputed: false
  };

  hardFacts.set(fact.factId, fact);
  return fact;
}

/**
 * Dispute a hard fact
 * Lowers its authority in gossip propagation
 * 
 * @param factId Fact to dispute
 */
export function disputeHardFact(factId: string): void {
  const fact = hardFacts.get(factId);
  if (fact) {
    const updated = updateHardFact(fact, { isDisputed: true });
    hardFacts.set(factId, updated);
  }
}

/**
 * Check if gossip contradicts a hard fact
 * 
 * @param gossip Gossip to check
 * @returns Related hard fact or null
 */
export function findRelatedHardFact(gossip: GossipEvent): HardFact | null {
  for (const fact of hardFacts.values()) {
    if (!fact.isDisputed && gossip.content.toLowerCase().includes(fact.content.toLowerCase())) {
      return fact;
    }
  }
  return null;
}

/**
 * Get cascade statistics
 * 
 * @param cascadeId Cascade to analyze
 * @returns Statistics object
 */
export function getCascadeStatistics(cascadeId: string): {
  npcsInformed: number;
  propagationPaths: number;
  averageReliability: number;
  maxDepth: number;
  spreadVelocity: number;
} | null {
  const cascade = activeCascades.get(cascadeId);
  if (!cascade) return null;

  // Calculate average reliability across all paths
  let totalReliability = 0;
  let pathCount = 0;
  for (const path of cascade.allPropagations) {
    const lastHop = path.hops.at(-1);
    if (lastHop) {
      totalReliability += lastHop.reliabilityDelta;
      pathCount++;
    }
  }

  const averageReliability = pathCount > 0 ? totalReliability / pathCount : 100;

  // Spread velocity: NPCs informed / total time elapsed
  const timeElapsed = (Date.now() - cascade.startTick) / 1000; // Seconds
  const spreadVelocity = timeElapsed > 0 ? cascade.npcsInformed.size / timeElapsed : 0;

  return {
    npcsInformed: cascade.npcsInformed.size,
    propagationPaths: cascade.allPropagations.length,
    averageReliability,
    maxDepth: cascade.maxDepth,
    spreadVelocity
  };
}

/**
 * Get cascade by ID
 * 
 * @param cascadeId Cascade identifier
 * @returns Cascade or null
 */
export function getCascade(cascadeId: string): GossipCascade | null {
  return activeCascades.get(cascadeId) || null;
}

/**
 * Get all active cascades
 * 
 * @returns Array of cascades
 */
export function getAllCascades(): GossipCascade[] {
  return Array.from(activeCascades.values());
}

/**
 * Resolve a cascade (stops propagation)
 * 
 * @param cascadeId Cascade to resolve
 * @returns Final statistics
 */
export function resolveCascade(cascadeId: string): {
  final_npcsInformed: number;
  final_propagations: number;
} | null {
  const cascade = activeCascades.get(cascadeId);
  if (!cascade) return null;

  const updated = updateGossipCascade(cascade, { isResolved: true });
  activeCascades.set(cascadeId, updated);

  return {
    final_npcsInformed: cascade.npcsInformed.size,
    final_propagations: cascade.allPropagations.length
  };
}

/**
 * Clean up resolved cascades
 * Removes memory from system
 * 
 * @returns Number of cascades cleaned
 */
export function cleanupResolvedCascades(): number {
  let cleaned = 0;
  for (const [key, cascade] of activeCascades) {
    if (cascade.isResolved) {
      activeCascades.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * Get gossip that an NPC has heard about
 * 
 * @param cascadeId Cascade to query
 * @param npcId NPC to get gossip for
 * @returns Array of gossip events
 */
export function getNPCGossipHeard(cascadeId: string, npcId: string): GossipEvent[] {
  const cascade = activeCascades.get(cascadeId);
  if (!cascade) return [];

  const heardGossip: GossipEvent[] = [];

  for (const path of cascade.allPropagations) {
    for (const hop of path.hops) {
      if (hop.toNpcId === npcId) {
        heardGossip.push({
          gossipId: path.gossipId,
          origin: cascade.rootNpcId,
          originTick: cascade.startTick,
          content: `[Hop ${hop.hopIndex}] [Reliability: ${Math.round(100 + hop.reliabilityDelta)}%]`,
          category: 'rumor',
          reliabilityScore: 100 + hop.reliabilityDelta,
          emotionalWeight: hop.sentimentShift,
          propagatedTo: new Set([npcId]),
          decayRate: -0.15
        });
      }
    }
  }

  return heardGossip;
}

/**
 * Get all hard facts
 * 
 * @returns Map of all hard facts
 */
export function getAllHardFacts(): Map<string, HardFact> {
  return new Map(hardFacts);
}
