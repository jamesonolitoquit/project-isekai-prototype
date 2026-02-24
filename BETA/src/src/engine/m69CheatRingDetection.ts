/**
 * M69: Cheat Ring Detection Engine
 * Network analysis for coordinated exploitation and RMT rings
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type RingType = 'alt_accounts' | 'rmt_ring' | 'raid_group' | 'trading_syndicate' | 'unknown';

export interface PlayerNode {
  playerId: string;
  riskScore: number;
  tradeCount: number;
  raidCount: number;
  lastActivityTick: number;
}

export interface EdgeWeight {
  count: number;
  lastTick: number;
  amounts: number[];
  types: string[]; // 'trade', 'raid', etc.
}

export interface CheatRing {
  id: string;
  type: RingType;
  members: string[];
  confidence: number; // 0-100
  description: string;
  connectedToRMT: boolean;
  goldFlowPattern: string;
  detectedAt: number;
  investigatedAt: number | null;
  actionTaken: string | null;
}

export interface AltAccountLink {
  account1: string;
  account2: string;
  confidence: number; // 0-100
  evidence: string[]; // fingerprints
}

export interface CheatRingDetectionState {
  nodes: Map<string, PlayerNode>;
  edges: Map<string, Map<string, EdgeWeight>>; // adjacency matrix
  rings: Map<string, CheatRing>;
  altAccountLinks: Map<string, AltAccountLink>;
  stats: {
    totalRingsDetected: number;
    altAccountsLinked: number;
    rmtRingsDetected: number;
    highConfidenceRings: number;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: CheatRingDetectionState = {
  nodes: new Map(),
  edges: new Map(),
  rings: new Map(),
  altAccountLinks: new Map(),
  stats: {
    totalRingsDetected: 0,
    altAccountsLinked: 0,
    rmtRingsDetected: 0,
    highConfidenceRings: 0,
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initCheatRingDetection(): boolean {
  state.nodes.clear();
  state.edges.clear();
  state.rings.clear();
  state.altAccountLinks.clear();
  state.stats = {
    totalRingsDetected: 0,
    altAccountsLinked: 0,
    rmtRingsDetected: 0,
    highConfidenceRings: 0,
  };
  return true;
}

// ============================================================================
// GRAPH CONSTRUCTION
// ============================================================================

export function recordPlayerAction(
  playerId: string,
  tick: number,
  riskScore: number = 0
): void {
  let node = state.nodes.get(playerId);
  if (!node) {
    node = {
      playerId,
      riskScore: riskScore,
      tradeCount: 0,
      raidCount: 0,
      lastActivityTick: tick,
    };
    state.nodes.set(playerId, node);
  }

  node.lastActivityTick = tick;
  node.riskScore = Math.max(node.riskScore, riskScore);
}

export function recordTrade(
  playerId1: string,
  playerId2: string,
  amount: number,
  tick: number,
  type: string = 'trade'
): void {
  // Ensure both players exist in graph
  recordPlayerAction(playerId1, tick);
  recordPlayerAction(playerId2, tick);

  // Create edge from playerId1 to playerId2
  if (!state.edges.has(playerId1)) {
    state.edges.set(playerId1, new Map());
  }
  const fromMap = state.edges.get(playerId1)!;

  let edge = fromMap.get(playerId2);
  if (!edge) {
    edge = { count: 0, lastTick: tick, amounts: [], types: [] };
    fromMap.set(playerId2, edge);
  }

  edge.count++;
  edge.lastTick = tick;
  edge.amounts.push(amount);
  edge.types.push(type);

  // Update trade count
  const node = state.nodes.get(playerId1)!;
  if (type === 'trade') node.tradeCount++;
  else if (type === 'raid') node.raidCount++;
}

// ============================================================================
// ANOMALY CLUSTERING
// ============================================================================

export function detectAnomalyClusters(): CheatRing[] {
  const newRings: CheatRing[] = [];

  // Strategy 1: Find tight trading clusters (high inter-connectivity)
  const tradeClusters = findDenseSubgraphs();
  for (const cluster of tradeClusters) {
    const ring = createCheatRing(
      cluster,
      'trading_syndicate',
      `Dense trading cluster: ${cluster.length} players with high inter-trade frequency`
    );
    newRings.push(ring);
  }

  // Strategy 2: Find synchronized RMT patterns (many players -> 1 collector)
  const rmtRings = findRMTPatterns();
  for (const ring of rmtRings) {
    newRings.push(ring);
  }

  // Strategy 3: Find alt account clusters (low inter-action, but consistent IP/pattern)
  const altClusters = findAltAccountClusters();
  for (const cluster of altClusters) {
    const ring = createCheatRing(
      cluster,
      'alt_accounts',
      `Suspected alt account network: ${cluster.length} accounts with identical playstyle`
    );
    newRings.push(ring);
  }

  return newRings;
}

function findDenseSubgraphs(): string[][] {
  const clusters: string[][] = [];
  const visited = new Set<string>();

  // Simple Bron-Kerbosch-inspired approach
  const nodeKeys = Array.from(state.nodes.keys());
  for (let i = 0; i < nodeKeys.length; i++) {
    const playerId = nodeKeys[i];
    if (visited.has(playerId)) continue;

    const neighbors = getNeighbors(playerId, 'both');
    if (neighbors.length >= 3) {
      // Candidate clique
      const clique = findClique([playerId, ...neighbors]);
      if (clique.length >= 4) {
        clusters.push(clique);
        for (let j = 0; j < clique.length; j++) {
          visited.add(clique[j]);
        }
      }
    }
  }

  return clusters;
}

function getNeighbors(playerId: string, direction: 'in' | 'out' | 'both' = 'both'): string[] {
  const neighbors = new Set<string>();

  if (direction === 'out' || direction === 'both') {
    const outgoing = state.edges.get(playerId);
    if (outgoing) {
      const keysArray = Array.from(outgoing.keys());
      for (let i = 0; i < keysArray.length; i++) {
        neighbors.add(keysArray[i]);
      }
    }
  }

  if (direction === 'in' || direction === 'both') {
    const edgesArray = Array.from(state.edges.entries());
    for (let i = 0; i < edgesArray.length; i++) {
      const [from, toMap] = edgesArray[i];
      if (toMap.has(playerId)) {
        neighbors.add(from);
      }
    }
  }

  return Array.from(neighbors);
}

function findClique(candidates: string[], current: string[] = []): string[] {
  if (candidates.length === 0) {
    return current;
  }

  const first = candidates[0];
  const rest = candidates.slice(1);

  // Optimization: check if first candidate is connected to all in current clique
  let isConnected = true;
  for (let i = 0; i < current.length; i++) {
    const member = current[i];
    if (
      !areConnected(first, member) &&
      !areConnected(member, first)
    ) {
      isConnected = false;
      break;
    }
  }

  if (isConnected) {
    const clique1 = findClique(rest, [...current, first]);
    if (clique1.length > current.length) {
      return clique1;
    }
  }

  return findClique(rest, current);
}

function areConnected(from: string, to: string): boolean {
  const fromMap = state.edges.get(from);
  return fromMap ? fromMap.has(to) : false;
}

function findRMTPatterns(): CheatRing[] {
  const rings: CheatRing[] = [];

  // Pattern: Many players (5+) all trading large amounts to 1 collector in short time window
  // Check ALL nodes as potential collectors, not just those with outgoing edges
  const allPlayerIds = Array.from(state.nodes.keys());
  for (let i = 0; i < allPlayerIds.length; i++) {
    const collectorId = allPlayerIds[i];
    const incomingEdges: [string, EdgeWeight][] = [];

    // Find all incoming edges to this potential collector
    const edgesArray = Array.from(state.edges.entries());
    for (let j = 0; j < edgesArray.length; j++) {
      const [from, toMap] = edgesArray[j];
      if (toMap.has(collectorId)) {
        const edge = toMap.get(collectorId);
        if (edge) {
          incomingEdges.push([from, edge]);
        }
      }
    }

    if (incomingEdges.length >= 5) {
      // Check for synchronized large transfers
      const largeTransfers = incomingEdges.filter((e) => {
        const avgAmount =
          e[1].amounts.reduce((a, b) => a + b, 0) / e[1].amounts.length;
        return avgAmount > 500; // Large transfer threshold
      });

      if (largeTransfers.length >= 5) {
        const ring: CheatRing = {
          id: `rmt_ring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'rmt_ring',
          members: [collectorId, ...largeTransfers.map((e) => e[0])],
          confidence: Math.min(100, 50 + largeTransfers.length * 10),
          description: `RMT ring: ${largeTransfers.length} players trading large amounts to collector ${collectorId}`,
          connectedToRMT: true,
          goldFlowPattern: `${largeTransfers.length}-to-1 convergence`,
          detectedAt: Date.now(),
          investigatedAt: null,
          actionTaken: null,
        };
        rings.push(ring);
        (state.stats as any).rmtRingsDetected++;
      }
    }
  }

  return rings;
}

function findAltAccountClusters(): string[][] {
  const clusters: string[][] = [];

  // Simple heuristic: accounts with very similar behavior
  const playerIds = Array.from(state.nodes.keys());

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const playerId1 = playerIds[i];
      const playerId2 = playerIds[j];

      const similarity = calculateBehaviorSimilarity(playerId1, playerId2);
      if (similarity >= 0.72) {
        // High similarity threshold: 0.72 captures accounts with consistent behavior + shared contacts
        // Check if already in a cluster
        let foundCluster = false;
        for (let k = 0; k < clusters.length; k++) {
          const cluster = clusters[k];
          if (cluster.includes(playerId1)) {
            if (!cluster.includes(playerId2)) {
              cluster.push(playerId2);
            }
            foundCluster = true;
            break;
          }
          if (cluster.includes(playerId2)) {
            if (!cluster.includes(playerId1)) {
              cluster.push(playerId1);
            }
            foundCluster = true;
            break;
          }
        }

        if (!foundCluster) {
          clusters.push([playerId1, playerId2]);
        }

        linkAltAccounts(playerId1, playerId2, Math.round(similarity * 100));
      }
    }
  }

  return clusters.filter((c) => c.length >= 2);
}

function calculateBehaviorSimilarity(playerId1: string, playerId2: string): number {
  const node1 = state.nodes.get(playerId1);
  const node2 = state.nodes.get(playerId2);

  if (!node1 || !node2) return 0;

  let score = 0;

  // Similarity metric 1: Trade count similarity (0-0.25)
  const tradeCountDiff = Math.abs(node1.tradeCount - node2.tradeCount);
  if (tradeCountDiff === 0) {
    score += 0.25;
  } else if (tradeCountDiff <= 1) {
    score += 0.23;
  } else if (tradeCountDiff <= 2) {
    score += 0.20;
  } else {
    const tradeRatio = Math.min(node1.tradeCount, node2.tradeCount) / Math.max(node1.tradeCount, node2.tradeCount || 1);
    score += tradeRatio * 0.25;
  }

  // Similarity metric 2: Risk score proximity (0-0.25)
  const riskDiff = Math.abs(node1.riskScore - node2.riskScore);
  score += Math.max(0, 0.25 - riskDiff / 100) * 0.25;

  // Similarity metric 3: Shared connections OR isolated pair (0-0.5)
  const neighbors1 = new Set(getNeighbors(playerId1));
  const neighbors2 = new Set(getNeighbors(playerId2));
  
  // Check if they only trade with each other (classic alt account pattern)
  const onlyTradeWithEachOther = 
    neighbors1.size === 1 && neighbors2.size === 1 && 
    neighbors1.has(playerId2) && neighbors2.has(playerId1);
  
  if (onlyTradeWithEachOther) {
    // Heavy weight for isolated pair pattern (classic alt accounts)
    score += 0.5;
  } else {
    // Standard shared connections scoring
    const shared: string[] = [];
    const neighbors1Array = Array.from(neighbors1);
    for (let i = 0; i < neighbors1Array.length; i++) {
      const n = neighbors1Array[i];
      if (neighbors2.has(n)) {
        shared.push(n);
      }
    }
    const combined = new Set([...Array.from(neighbors1), ...Array.from(neighbors2)]).size;
    const connectionScore = combined > 0 ? shared.length / combined : 0;
    score += connectionScore * 0.5;
  }

  return Math.min(1, score);
}

function linkAltAccounts(account1: string, account2: string, confidence: number): void {
  const linkId = [account1, account2].sort().join('_');
  const link: AltAccountLink = {
    account1,
    account2,
    confidence,
    evidence: ['behavior_similarity', 'shared_connections'],
  };

  state.altAccountLinks.set(linkId, link);
  (state.stats as any).altAccountsLinked++;
}

// ============================================================================
// RING CREATION & MANAGEMENT
// ============================================================================

function createCheatRing(
  memberIds: string[],
  type: RingType,
  description: string
): CheatRing {
  // Calculate confidence based on membership and connections
  let confidence = 50;
  if (memberIds.length >= 5) confidence += 20;
  if (memberIds.length >= 10) confidence += 15;
  if (memberIds.length >= 20) confidence += 15;

  const ring: CheatRing = {
    id: `ring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    members: memberIds,
    confidence: Math.min(100, confidence),
    description,
    connectedToRMT: type === 'rmt_ring',
    goldFlowPattern: analyzeGoldFlow(memberIds),
    detectedAt: Date.now(),
    investigatedAt: null,
    actionTaken: null,
  };

  state.rings.set(ring.id, ring);
  (state.stats as any).totalRingsDetected++;

  if (ring.confidence >= 80) {
    (state.stats as any).highConfidenceRings++;
  }

  return ring;
}

function analyzeGoldFlow(memberIds: string[]): string {
  if (memberIds.length === 0) return 'unknown';

  // Analyze trading patterns among members
  let internalTrades = 0;
  let externalTrades = 0;

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i];
    const outgoing = state.edges.get(memberId);
    if (outgoing) {
      const outgoingArray = Array.from(outgoing.entries());
      for (let j = 0; j < outgoingArray.length; j++) {
        const [to, edge] = outgoingArray[j];
        if (memberIds.includes(to)) {
          internalTrades += edge.count;
        } else {
          externalTrades += edge.count;
        }
      }
    }
  }

  if (internalTrades > externalTrades) {
    return 'internal_circulation';
  } else if (externalTrades > internalTrades) {
    return 'converging_to_external';
  } else {
    return 'balanced';
  }
}

// ============================================================================
// QUERIES & RETRIEVAL
// ============================================================================

export function getDetectedRings(): CheatRing[] {
  return Array.from(state.rings.values());
}

export function getRingsByType(type: RingType): CheatRing[] {
  return Array.from(state.rings.values()).filter((r) => r.type === type);
}

export function getHighConfidenceRings(minConfidence: number = 80): CheatRing[] {
  return Array.from(state.rings.values())
    .filter((r) => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

export function getAltAccountLinks(): AltAccountLink[] {
  return Array.from(state.altAccountLinks.values());
}

export function getLinksForAccount(accountId: string): AltAccountLink[] {
  return Array.from(state.altAccountLinks.values()).filter(
    (link) => link.account1 === accountId || link.account2 === accountId
  );
}

export function getGraphStats() {
  const edgesArray = Array.from(state.edges.values());
  let totalEdges = 0;
  for (let i = 0; i < edgesArray.length; i++) {
    totalEdges += edgesArray[i].size;
  }

  return {
    totalNodes: state.nodes.size,
    totalEdges,
    ringsDetected: state.rings.size,
    highConfidenceRings: state.stats.highConfidenceRings,
    altAccountLinksFound: state.altAccountLinks.size,
    rmtRingsDetected: state.stats.rmtRingsDetected,
  };
}

export function getDetectionStats() {
  return state.stats;
}

export function getDetectionState(): CheatRingDetectionState {
  return state;
}
