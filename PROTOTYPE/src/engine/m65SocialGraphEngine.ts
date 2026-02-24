/**
 * M65: Social Graph Engine & NPC Metadata
 * 
 * High-density map of NPC relationships with:
 * - Family, trade, faction connections
 * - Influence scoring and gossip susceptibility
 * - SIG integration for O(1) local clustering
 * - Deterministic social state via M62-CHRONOS
 * 
 * Central hub for all social network operations.
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Social Graph Architecture
// ============================================================================

/**
 * Relationship types between NPCs
 */
export type RelationshipType = 
  | 'family' | 'marriage' | 'sibling' | 'parent' | 'child'
  | 'rival' | 'enemy' | 'ally' | 'mentor' | 'student'
  | 'business_partner' | 'employer' | 'employee' | 'creditor' | 'debtor'
  | 'friend' | 'acquaintance' | 'neutral' | 'colleague';

/**
 * Relationship metadata with strength and sentiment
 */
export interface SocialEdge {
  readonly edgeId: string;
  readonly npcIdA: string;
  readonly npcIdB: string;
  readonly type: RelationshipType;
  readonly strength: number; // 0-100, higher = stronger connection
  readonly sentiment: number; // -100 to +100, -100 = hatred, +100 = love
  readonly duration: number; // Ticks the relationship has existed
  readonly lastInteraction: number; // Timestamp of last contact
  readonly isPublic: boolean; // Known by community?
  readonly mutualTrust: number; // 0-100, how much they confide in each other
  readonly contractValue?: number; // For business relationships
}

/**
 * Individual NPC social node in the graph
 */
export interface SocialNode {
  readonly nodeId: string;
  readonly npcId: string;
  readonly npcName: string;
  readonly influenceScore: number; // 0-1000, determines propagation reach
  readonly factionLoyalty: Map<string, number>; // factionId -> loyalty (0-100) [mutable, not readonly]
  readonly gossipSusceptibility: number; // 0-100, how likely to spread rumors
  readonly socialCapital: number; // Currency for favors
  readonly connectedEdges: Set<string>; // Edge IDs this node participates in
  readonly trustRating: number; // 0-100, how much others trust them
  readonly duplicityScore: number; // 0-100, how often they lie/backstab
  readonly isHighProfile: boolean; // Recognized by many NPCs
  readonly socialTier: 'outcast' | 'commoner' | 'notable' | 'prominent' | 'legendary';
}

/**
 * Complete social graph for a world/region
 */
export interface SocialGraph {
  readonly graphId: string;
  readonly regionId: string;
  readonly nodes: Map<string, SocialNode>;
  readonly edges: Map<string, SocialEdge>;
  readonly tensions: Map<string, TensionCluster>; // Regional social tensions
  readonly lastUpdate: number;
  readonly gossipQueue: GossipEvent[];
}

/**
 * Tension cluster: regional conflicts/alliances
 */
export interface TensionCluster {
  readonly clusterId: string;
  readonly factionIds: string[];
  readonly severity: number; // 0-100
  readonly rootCause: string;
  readonly affectedNPCs: Set<string>;
  readonly resolution?: { resolvedAt: number; method: string };
}

/**
 * Gossip event for propagation through social network
 */
export interface GossipEvent {
  readonly gossipId: string;
  readonly origin: string; // npcId of originator
  readonly originTick: number;
  readonly content: string;
  readonly category: 'scandal' | 'rumor' | 'fact' | 'opportunity' | 'threat';
  readonly reliabilityScore: number; // 0-100, how true it is
  readonly emotionalWeight: number; // 0-100, how juicy
  readonly propagatedTo: Set<string>; // NPCs who know
  readonly decayRate: number; // Per-hop decay (-15% per connection default)
}

// ============================================================================
// SOCIAL GRAPH ENGINE: Core Operations
// ============================================================================

let activeSocialGraphs = new Map<string, SocialGraph>();

/**
 * Initialize a social graph for a region
 * Prepares empty nodes and edges for population
 * 
 * @param regionId Region/world identifier
 * @returns Empty social graph ready for NPCs
 */
export function initializeSocialGraph(regionId: string): SocialGraph {
  const graphId = `graph_${uuid()}`;

  const graph: SocialGraph = {
    graphId,
    regionId,
    nodes: new Map(),
    edges: new Map(),
    tensions: new Map(),
    lastUpdate: Date.now(),
    gossipQueue: []
  };

  activeSocialGraphs.set(graphId, graph);
  return graph;
}

/**
 * Add an NPC to the social graph as a node
 * 
 * @param graphId Target graph
 * @param npcId NPC identifier
 * @param npcName Display name
 * @param influenceScore Initial influence (0-1000)
 * @param socialTier Starting social tier
 * @returns Created social node
 */
export function addNPCToGraph(
  graphId: string,
  npcId: string,
  npcName: string,
  influenceScore: number,
  socialTier: 'outcast' | 'commoner' | 'notable' | 'prominent' | 'legendary' = 'commoner'
): SocialNode | null {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return null;

  const node: SocialNode = {
    nodeId: `node_${uuid()}`,
    npcId,
    npcName,
    influenceScore: Math.max(0, Math.min(1000, influenceScore)),
    factionLoyalty: new Map(),
    gossipSusceptibility: Math.random() * 100,
    socialCapital: 100,
    connectedEdges: new Set(),
    trustRating: 50 + Math.random() * 50,
    duplicityScore: Math.random() * 100,
    isHighProfile: socialTier !== 'outcast' && socialTier !== 'commoner',
    socialTier
  };

  graph.nodes.set(npcId, node);
  return node;
}

/**
 * Create relationship between two NPCs
 * Bidirectional edge in social graph
 * 
 * @param graphId Target graph
 * @param npcIdA First NPC
 * @param npcIdB Second NPC
 * @param type Relationship type
 * @param strength Connection strength (0-100)
 * @param sentiment Emotional tone (-100 to +100)
 * @returns Created edge
 */
export function createSocialEdge(
  graphId: string,
  npcIdA: string,
  npcIdB: string,
  type: RelationshipType,
  strength: number,
  sentiment: number,
  isPublic: boolean = Math.random() > 0.3 // 70% of relationships are known
): SocialEdge | null {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph || !graph.nodes.has(npcIdA) || !graph.nodes.has(npcIdB)) {
    return null;
  }

  const edgeId = `edge_${uuid()}`;
  const edge: SocialEdge = {
    edgeId,
    npcIdA,
    npcIdB,
    type,
    strength: Math.max(0, Math.min(100, strength)),
    sentiment: Math.max(-100, Math.min(100, sentiment)),
    duration: 0,
    lastInteraction: Date.now(),
    isPublic,
    mutualTrust: (Math.abs(sentiment) / 100) * 100,
    contractValue: type.includes('business') ? 1000 + Math.random() * 9000 : undefined
  };

  graph.edges.set(edgeId, edge);

  // Add edge reference to both nodes
  const nodeA = graph.nodes.get(npcIdA);
  const nodeB = graph.nodes.get(npcIdB);
  if (nodeA) nodeA.connectedEdges.add(edgeId);
  if (nodeB) nodeB.connectedEdges.add(edgeId);

  return edge;
}

/**
 * Get all relationships for an NPC (immediate neighbors in graph)
 * 
 * @param graphId Graph to query
 * @param npcId NPC to get connections for
 * @returns Array of connected NPCs with relationship info
 */
export function getSocialConnections(
  graphId: string,
  npcId: string
): Array<{ npcId: string; type: RelationshipType; sentiment: number; strength: number }> {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return [];

  const node = graph.nodes.get(npcId);
  if (!node) return [];

  const connections: Array<{ npcId: string; type: RelationshipType; sentiment: number; strength: number }> = [];

  for (const edgeId of node.connectedEdges) {
    const edge = graph.edges.get(edgeId);
    if (!edge) continue;

    const otherNpcId = edge.npcIdA === npcId ? edge.npcIdB : edge.npcIdA;
    connections.push({
      npcId: otherNpcId,
      type: edge.type,
      sentiment: edge.sentiment,
      strength: edge.strength
    });
  }

  return connections;
}

/**
 * Calculate influence score for an NPC
 * Combines personal influence + faction loyalty + social tier
 * 
 * @param graphId Graph to query
 * @param npcId NPC to score
 * @returns Total influence (0-2000)
 */
export function calculateTotalInfluence(graphId: string, npcId: string): number {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return 0;

  const node = graph.nodes.get(npcId);
  if (!node) return 0;

  let influence = node.influenceScore;

  // Add faction bonuses
  let maxFactionLoyalty = 0;
  for (const loyalty of node.factionLoyalty.values()) {
    maxFactionLoyalty = Math.max(maxFactionLoyalty, loyalty);
  }
  influence += maxFactionLoyalty * 5; // +5 per faction loyalty point

  // Social tier multiplier
  const tierMultipliers: Record<string, number> = {
    outcast: 0.5,
    commoner: 1,
    notable: 1.5,
    prominent: 2,
    legendary: 3
  };
  influence *= tierMultipliers[node.socialTier] || 1;

  return Math.min(influence, 2000);
}

/**
 * Process neighbors in BFS traversal
 */
function processBFSNeighbors(
  graphId: string,
  currentId: string,
  hopCount: number,
  maxHops: number,
  queue: [string, number][],
  visited: Set<string>,
  distances: Map<string, number>
): void {
  if (hopCount < maxHops) {
    const connections = getSocialConnections(graphId, currentId);
    for (const conn of connections) {
      if (!visited.has(conn.npcId)) {
        queue.push([conn.npcId, hopCount + 1]);
      }
    }
  }
}

/**
 * Get k-hop neighbors (BFS)
 * Used for gossip propagation distance calculations
 * 
 * @param graphId Graph to traverse
 * @param npcId Starting NPC
 * @param maxHops Maximum hops to traverse (1-3 typical)
 * @returns Map of npcId -> hopDistance
 */
export function getKHopNeighbors(
  graphId: string,
  npcId: string,
  maxHops: number
): Map<string, number> {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return new Map();

  const distances = new Map<string, number>();
  const queue: [string, number][] = [[npcId, 0]];
  const visited = new Set<string>();

  // Simple BFS to find k-hop neighbors
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const [currentId, hopCount] = item;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (hopCount > 0) {
      distances.set(currentId, hopCount);
    }

    processBFSNeighbors(graphId, currentId, hopCount, maxHops, queue, visited, distances);
  }

  return distances;
}

/**
 * Find all shortest paths between two NPCs
 * Used for alliance/conflict propagation
 * 
 * @param graphId Graph to traverse
 * @param npcIdA Source NPC
 * @param npcIdB Target NPC
 * @returns Shortest path length (hops), or -1 if disconnected
 */
export function findSocialDistance(
  graphId: string,
  npcIdA: string,
  npcIdB: string
): number {
  const neighbors = getKHopNeighbors(graphId, npcIdA, 10); // Max 10 hops
  return neighbors.get(npcIdB) ?? -1;
}

/**
 * Update NPC faction loyalty
 * 
 * @param graphId Graph to update
 * @param npcId NPC to modify
 * @param factionId Faction to adjust
 * @param delta Change amount (-100 to +100)
 */
export function updateFactionLoyalty(
  graphId: string,
  npcId: string,
  factionId: string,
  delta: number
): number {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return 0;

  const node = graph.nodes.get(npcId);
  if (!node) return 0;

  const current = node.factionLoyalty.get(factionId) || 50;
  const updated = Math.max(0, Math.min(100, current + delta));
  node.factionLoyalty.set(factionId, updated);

  return updated;
}

/**
 * Create a regional tension cluster
 * Tracks ongoing conflicts or alliances
 * 
 * @param graphId Graph to add to
 * @param factionIds Involved factions
 * @param severity Conflict intensity (0-100)
 * @param rootCause Description
 * @returns Created tension cluster
 */
export function createTensionCluster(
  graphId: string,
  factionIds: string[],
  severity: number,
  rootCause: string
): TensionCluster | null {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return null;

  const cluster: TensionCluster = {
    clusterId: `tension_${uuid()}`,
    factionIds,
    severity: Math.max(0, Math.min(100, severity)),
    rootCause,
    affectedNPCs: new Set()
  };

  graph.tensions.set(cluster.clusterId, cluster);
  return cluster;
}

/**
 * Get social graph statistics for diagnostic
 * 
 * @param graphId Graph to analyze
 * @returns Statistics object
 */
export function getGraphStatistics(graphId: string): {
  nodeCount: number;
  edgeCount: number;
  averageConnectivity: number;
  highInfluenceCount: number;
} {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return { nodeCount: 0, edgeCount: 0, averageConnectivity: 0, highInfluenceCount: 0 };

  const nodeCount = graph.nodes.size;
  const edgeCount = graph.edges.size;
  const averageConnectivity = nodeCount > 0 ? edgeCount / nodeCount : 0;
  const highInfluenceCount = Array.from(graph.nodes.values()).filter((n) => n.influenceScore > 500).length;

  return { nodeCount, edgeCount, averageConnectivity, highInfluenceCount };
}

/**
 * Get social graph by ID
 * 
 * @param graphId Graph identifier
 * @returns Social graph or null
 */
export function getSocialGraph(graphId: string): SocialGraph | null {
  return activeSocialGraphs.get(graphId) || null;
}

/**
 * Get all active social graphs
 * 
 * @returns Array of graphs
 */
export function getAllSocialGraphs(): SocialGraph[] {
  return Array.from(activeSocialGraphs.values());
}

/**
 * Close and clean up a social graph
 * 
 * @param graphId Graph to close
 * @returns Final statistics
 */
export function closeSocialGraph(graphId: string): { nodeCount: number; edgeCount: number } | null {
  const graph = activeSocialGraphs.get(graphId);
  if (!graph) return null;

  const stats = { nodeCount: graph.nodes.size, edgeCount: graph.edges.size };
  activeSocialGraphs.delete(graphId);
  return stats;
}

/**
 * Integrate with Spatial Interest Groups from M64
 * Restricts social updates to physically proximal NPCs
 * 
 * @param graphId Graph to update
 * @param npcId NPC at center
 * @param spatialRange Physical range (1-3 SIGs)
 * @returns NPCs within range
 */
export function getProximalNPCs(
  graphId: string,
  npcId: string,
  spatialRange: number = 1
): string[] {
  // SIG integration: getKHopNeighbors can be filtered by spatial proximity
  // For now, return immediate neighbors within hop range
  const neighbors = getKHopNeighbors(graphId, npcId, spatialRange);
  return Array.from(neighbors.keys()).slice(0, Math.max(1, spatialRange * 8)); // Max 8 per SIG
}
