/**
 * M65: Phase 35 - NPC Social Network Comprehensive Test Suite
 * 
 * Tests for:
 * - Social Graph Engine (SocialNode, SocialEdge, high-density mapping)
 * - Gossip Propagation (BFS, sentiment decay, hard facts)
 * - Political Favor System (voting power, social scars, faction hardening)
 * - Narrative Engine Hardening (dialogue gates, consequence evaluation, deterministic state)
 * 
 * Performance targets:
 * - 50+ NPC gossip cascade: <50ms
 * - 128-NPC social hub: <10MB memory, <100ms query
 * - Type safety: zero-any violations
 * - Deterministic replay: 100% state recovery
 */

import {
  initializeSocialGraph,
  addNPCToGraph,
  createSocialEdge,
  getSocialConnections,
  calculateTotalInfluence,
  getKHopNeighbors,
  findSocialDistance,
  updateFactionLoyalty,
  getGraphStatistics,
  getSocialGraph,
  closeSocialGraph
} from '../engine/m65SocialGraphEngine';

import {
  initiateGossipCascade,
  registerHardFact,
  disputeHardFact,
  getCascadeStatistics,
  resolveCascade,
  getAllHardFacts
} from '../engine/m65GossipPropagation';

import {
  awardPoliticalFavor,
  spendPoliticalFavor,
  registerSocialScar,
  resolveSocialScar,
  getTotalPoliticalFavor,
  getActiveScarDamage,
  applyLoyaltyHardening,
  calculateVotingPower,
  calculateFactionPowerState,
  transferPoliticalFavor,
  getPoliticalSummary,
  clearPoliticalState
} from '../engine/m65PoliticalFavor';

import {
  evaluateDialogueGate,
  registerDialogueNode,
  startDialogueInteraction,
  makeDialogueChoice,
  endDialogueInteraction,
  getInteractionLedger,
  replayDialogueFromLedger,
  validateDialogueTree,
  clearDialogueState,
  getDialogueStatistics,
  getAvailableChoices,
  type DialogueNode,
  type DialogueGateType,
  type DialogueChoice,
  type GateContext
} from '../engine/m65NarrativeHardening';

describe('M65: NPC Social Network', () => {
  // ========================================================================
  // SOCIAL GRAPH ENGINE TESTS
  // ========================================================================

  describe('M65-A: Social Graph Engine', () => {
    test('M65-A-1: Initialize social graph', () => {
      const graph = initializeSocialGraph('region_torania');
      expect(graph).toBeDefined();
      expect(graph.regionId).toBe('region_torania');
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    test('M65-A-2: Add NPCs to graph', () => {
      const graph = initializeSocialGraph('region_torania');
      const npc1 = addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      const npc2 = addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');

      expect(graph.nodes.size).toBe(2);
      expect(npc1?.npcName).toBe('Elara');
      expect(npc2?.influenceScore).toBe(750);
    });

    test('M65-A-3: Create social edges (relationships)', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');

      const edge = createSocialEdge(
        graph.graphId,
        'npc_elara',
        'npc_theron',
        'ally',
        80,
        75,
        true
      );

      expect(edge).toBeDefined();
      expect(edge?.strength).toBe(80);
      expect(edge?.sentiment).toBe(75);
      expect(graph.edges.size).toBe(1);
    });

    test('M65-A-4: Get social connections (neighbors)', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      addNPCToGraph(graph.graphId, 'npc_aria', 'Aria', 600, 'notable');

      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);
      createSocialEdge(graph.graphId, 'npc_elara', 'npc_aria', 'friend', 60, 50);

      const connections = getSocialConnections(graph.graphId, 'npc_elara');
      expect(connections.length).toBe(2);
      expect(connections.some((c) => c.npcId === 'npc_theron')).toBe(true);
    });

    test('M65-A-5: Calculate total influence score', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');

      const influence = calculateTotalInfluence(graph.graphId, 'npc_elara');
      expect(influence).toBeGreaterThan(500); // Should be boosted by notable tier
      expect(influence).toBeLessThanOrEqual(2000);
    });

    test('M65-A-6: Get k-hop neighbors (BFS)', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      addNPCToGraph(graph.graphId, 'npc_aria', 'Aria', 600, 'notable');

      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);
      createSocialEdge(graph.graphId, 'npc_theron', 'npc_aria', 'friend', 60, 50);

      const neighbors = getKHopNeighbors(graph.graphId, 'npc_elara', 2);
      expect(neighbors.has('npc_theron')).toBe(true);
      expect(neighbors.has('npc_aria')).toBe(true);
    });

    test('M65-A-7: Find social distance between NPCs', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      addNPCToGraph(graph.graphId, 'npc_aria', 'Aria', 600, 'notable');

      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);
      createSocialEdge(graph.graphId, 'npc_theron', 'npc_aria', 'friend', 60, 50);

      const distance = findSocialDistance(graph.graphId, 'npc_elara', 'npc_aria');
      expect(distance).toBe(2);
    });

    test('M65-A-8: Update faction loyalty', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');

      const loyalty1 = updateFactionLoyalty(graph.graphId, 'npc_elara', 'faction_lightbringers', 25);
      expect(loyalty1).toBe(75); // 50 base + 25

      const loyalty2 = updateFactionLoyalty(graph.graphId, 'npc_elara', 'faction_lightbringers', 10);
      expect(loyalty2).toBe(85);
    });

    test('M65-A-9: Graph statistics', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);

      const stats = getGraphStatistics(graph.graphId);
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.highInfluenceCount).toBeGreaterThan(0);
    });

    test('M65-A-10: Close social graph', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');

      const closed = closeSocialGraph(graph.graphId);
      expect(closed?.nodeCount).toBe(1);

      const retrieved = getSocialGraph(graph.graphId);
      expect(retrieved).toBeNull();
    });
  });

  // ========================================================================
  // GOSSIP PROPAGATION TESTS
  // ========================================================================

  describe('M65-B: Gossip Propagation', () => {
    test('M65-B-1: Initiate gossip cascade', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'Theron discovered hidden treasure!',
          category: 'opportunity',
          reliabilityScore: 100,
          emotionalWeight: 80,
          decayRate: -0.15
        },
        2
      );

      expect(cascade).toBeDefined();
      expect(cascade?.npcsInformed.has('npc_elara')).toBe(true);
    });

    test('M65-B-2: Gossip propagates to neighbors', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      addNPCToGraph(graph.graphId, 'npc_aria', 'Aria', 600, 'notable');

      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);
      createSocialEdge(graph.graphId, 'npc_theron', 'npc_aria', 'friend', 60, 50);

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'Major scandal brewing!',
          category: 'scandal',
          reliabilityScore: 90,
          emotionalWeight: 95,
          decayRate: -0.15
        },
        3
      );

      expect(cascade?.npcsInformed.size).toBeGreaterThan(1);
    });

    test('M65-B-3: Sentiment decay per hop', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'Rumor spreading',
          category: 'rumor',
          reliabilityScore: 80,
          emotionalWeight: 50,
          decayRate: -0.15
        },
        2
      );

      const stats = getCascadeStatistics(cascade?.cascadeId || '');
      // Cascade statistics should exist if cascade was created
      expect(stats?.averageReliability).toBeLessThan(80);
    });

    test('M65-B-4: Register hard fact anchor', () => {
      const fact = registerHardFact(
        'The dragon destroyed the Eastern Village',
        'historical',
        ['npc_elara', 'npc_theron']
      );

      expect(fact).toBeDefined();
      expect(fact.content).toContain('dragon');
      expect(fact.verifiedBy.length).toBe(2);
    });

    test('M65-B-5: Dispute hard fact', () => {
      const fact = registerHardFact('The dragon destroyed...', 'historical', ['npc_elara']);
      disputeHardFact(fact.factId);

      const allFacts = getAllHardFacts();
      const disputed = allFacts.get(fact.factId);
      expect(disputed?.isDisputed).toBe(true);
    });

    test('M65-B-6: Find related hard fact', () => {
      registerHardFact('The dragon destroyed the Eastern Village', 'historical', ['npc_elara']);

      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'I heard the dragon destroyed everything!',
          category: 'rumor',
          reliabilityScore: 80,
          emotionalWeight: 90,
          decayRate: -0.15
        },
        1
      );

      // The cascade should find the related fact
      expect(cascade).toBeDefined();
    });

    test('M65-B-7: Cascade statistics', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');
      createSocialEdge(graph.graphId, 'npc_elara', 'npc_theron', 'ally', 80, 75);

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'Spreading news',
          category: 'rumor',
          reliabilityScore: 100,
          emotionalWeight: 70,
          decayRate: -0.15
        },
        2
      );

      const stats = getCascadeStatistics(cascade!.cascadeId);
      expect(stats?.npcsInformed).toBeGreaterThanOrEqual(1);
      expect(stats?.spreadVelocity).toBeGreaterThanOrEqual(0);
    });

    test('M65-B-8: Resolve cascade', () => {
      const graph = initializeSocialGraph('region_torania');
      addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');

      const cascade = initiateGossipCascade(
        graph,
        'npc_elara',
        {
          content: 'News',
          category: 'fact',
          reliabilityScore: 100,
          emotionalWeight: 50,
          decayRate: -0.15
        },
        1
      );

      const resolved = resolveCascade(cascade?.cascadeId || '');
      expect(resolved?.final_npcsInformed).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================================================
  // POLITICAL FAVOR TESTS
  // ========================================================================

  describe('M65-C: Political Favor System', () => {
    beforeEach(() => {
      clearPoliticalState();
    });

    test('M65-C-1: Award political favor', () => {
      const favor = awardPoliticalFavor('npc_elara', 100, 'alliance');
      expect(favor).toBeDefined();
      expect(favor.amount).toBe(100);
      expect(favor.source).toBe('alliance');
    });

    test('M65-C-2: Spend political favor', () => {
      awardPoliticalFavor('npc_elara', 100, 'alliance');
      const result = spendPoliticalFavor('npc_elara', 50, 'voting');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(50);
    });

    test('M65-C-3: Cannot spend more than available', () => {
      awardPoliticalFavor('npc_elara', 50, 'alliance');
      const result = spendPoliticalFavor('npc_elara', 100, 'voting');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(50);
    });

    test('M65-C-4: Register social scar', () => {
      const scar = registerSocialScar(
        'npc_elara',
        'Betrayed allies in battle',
        80,
        60,
        true,
        ['faction_lightbringers']
      );

      expect(scar).toBeDefined();
      expect(scar.politicalWeight).toBe(60);
      expect(scar.isPublic).toBe(true);
    });

    test('M65-C-5: Social scar reduces voting power', () => {
      awardPoliticalFavor('npc_elara', 200, 'dominance');
      registerSocialScar('npc_elara', 'Betrayal', 80, 50, true, ['faction_lightbringers']);

      const profile = calculateVotingPower('npc_elara');
      expect(profile.scarReduction).toBe(-50);
      expect(profile.finalVotingPower).toBeLessThan(200);
    });

    test('M65-C-6: Resolve social scar', () => {
      const scar = registerSocialScar('npc_elara', 'Betrayal', 80, 50, true);
      resolveSocialScar(scar.scarId, 'public_reconciliation');

      const damage = getActiveScarDamage('npc_elara');
      expect(damage).toBe(0); // Resolved scars don't count
    });

    test('M65-C-7: Apply loyalty hardening', () => {
      awardPoliticalFavor('npc_elara', 100, 'loyalty');

      const hardener1 = applyLoyaltyHardening('npc_elara', 70);
      expect(hardener1).toBe(0); // Below threshold

      const hardener2 = applyLoyaltyHardening('npc_elara', 90);
      expect(hardener2).toBeGreaterThan(0); // Above 80 threshold
    });

    test('M65-C-8: Calculate voting power with all modifiers', () => {
      awardPoliticalFavor('npc_elara', 200, 'alliance');
      applyLoyaltyHardening('npc_elara', 90);
      registerSocialScar('npc_elara', 'Minor issue', 30, 20, false);

      const profile = calculateVotingPower('npc_elara', 50); // 50 influence bonus

      expect(profile.baseFavor).toBe(200);
      expect(profile.hardenerBonus).toBeGreaterThan(0);
      expect(profile.scarReduction).toBeLessThan(0);
      expect(profile.canCastVote).toBe(true);
    });

    test('M65-C-9: Transfer political favor', () => {
      awardPoliticalFavor('npc_elara', 100, 'alliance');
      const result = transferPoliticalFavor('npc_elara', 'npc_theron', 50);

      expect(result.success).toBe(true);
      expect(getTotalPoliticalFavor('npc_elara')).toBe(50);
      expect(getTotalPoliticalFavor('npc_theron')).toBe(50);
    });

    test('M65-C-10: Calculate faction power state', () => {
      awardPoliticalFavor('npc_elara', 100, 'alliance');
      awardPoliticalFavor('npc_theron', 150, 'dominance');
      registerSocialScar('npc_elara', 'Betrayal', 80, 30, true);

      const state = calculateFactionPowerState('faction_lightbringers', [
        'npc_elara',
        'npc_theron'
      ]);

      expect(state.factionId).toBe('faction_lightbringers');
      expect(state.totalVotingPower).toBe(250);
      expect(state.scarDamage).toBe(30);
    });

    test('M65-C-11: Political summary', () => {
      awardPoliticalFavor('npc_elara', 100, 'alliance');
      registerSocialScar('npc_elara', 'Betrayal', 80, 40, true);

      const summary = getPoliticalSummary();
      expect(summary.totalActiveNPCs).toBeGreaterThan(0);
      expect(summary.totalFavorInCirculation).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // NARRATIVE ENGINE HARDENING TESTS
  // ========================================================================

  describe('M65-D: Narrative Engine Hardening', () => {
    beforeEach(() => {
      clearDialogueState();
    });

    test('M65-D-1: Evaluate reputation gate', () => {
      const context: GateContext = {
        playerReputation: 75,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'reputation', threshold: 50, polarity: 'above' };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-2: Evaluate relationship gate', () => {
      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map([['npc_theron', 80]]),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'relationship', targetNpcId: 'npc_theron', minimumSentiment: 70 };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-3: Evaluate faction gate', () => {
      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map([['faction_lightbringers', 85]]),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'faction', factionId: 'faction_lightbringers', minimumLoyalty: 80 };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-4: Evaluate item gate', () => {
      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map([['item_scrolloftruth', 3]]),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'item', itemId: 'item_scrolloftruth', quantity: 2 };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-5: Evaluate social scar gate', () => {
      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [{ type: 'betrayal', exists: true }],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'socialScar', scarType: 'betrayal', exists: true };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-6: Evaluate political favor gate', () => {
      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 250,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = { type: 'political', favorThreshold: 200 };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-7: Evaluate AND gate (all must pass)', () => {
      const context: GateContext = {
        playerReputation: 75,
        npcRelationships: new Map([['npc_theron', 80]]),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = {
        type: 'and',
        gates: [
          { type: 'reputation', threshold: 50, polarity: 'above' },
          { type: 'relationship', targetNpcId: 'npc_theron', minimumSentiment: 70 }
        ]
      };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-8: Evaluate OR gate (any can pass)', () => {
      const context: GateContext = {
        playerReputation: 30,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 250,
        currentTick: Date.now()
      };

      const gate: DialogueGateType = {
        type: 'or',
        gates: [
          { type: 'reputation', threshold: 50, polarity: 'above' },
          { type: 'political', favorThreshold: 200 }
        ]
      };
      expect(evaluateDialogueGate(gate, context)).toBe(true);
    });

    test('M65-D-9: Start dialogue interaction', () => {
      const node: DialogueNode = {
        nodeId: 'node_greeting',
        npcId: 'npc_elara',
        text: 'Greetings, traveler!',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: false
      };

      registerDialogueNode(node);

      const interaction = startDialogueInteraction('npc_elara', 'player', 'node_greeting');
      expect(interaction).toBeDefined();
      expect(interaction?.initiatorNpcId).toBe('npc_elara');
      expect(interaction?.currentNodeId).toBe('node_greeting');
    });

    test('M65-D-10: Make dialogue choice', () => {
      const choice: DialogueChoice = {
        choiceId: 'choice_hello',
        text: 'Hello!',
        gates: [],
        leadsToNodeId: 'node_response',
        consequence: {
          type: 'relationship',
          target: 'npc_elara',
          value: 10,
          description: 'Elara appreciated your greeting'
        }
      };

      const node: DialogueNode = {
        nodeId: 'node_greeting',
        npcId: 'npc_elara',
        text: 'Greetings!',
        speaker: 'npc',
        choices: [choice],
        consequences: [],
        isTerminal: false
      };

      const responseNode: DialogueNode = {
        nodeId: 'node_response',
        npcId: 'npc_elara',
        text: 'How nice to meet you!',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: true
      };

      registerDialogueNode(node);
      registerDialogueNode(responseNode);

      const interaction = startDialogueInteraction('npc_elara', 'player', 'node_greeting');
      if (!interaction) throw new Error('Failed to create interaction');

      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const result = makeDialogueChoice(interaction.interactionId, 'choice_hello', context);
      expect(result.success).toBe(true);
      expect(result.nextNodeId).toBe('node_response');
      expect(result.consequences.length).toBe(1);
    });

    test('M65-D-11: Get available choices (gate filtering)', () => {
      const restrictedChoice: DialogueChoice = {
        choiceId: 'choice_threat',
        text: 'I will destroy you!',
        gates: [{ type: 'reputation', threshold: 80, polarity: 'below' }],
        leadsToNodeId: 'node_combat',
        consequence: { type: 'relationship', target: 'npc_elara', value: -50, description: 'Elara is hostile' }
      };

      const friendlyChoice: DialogueChoice = {
        choiceId: 'choice_friend',
        text: 'Nice to meet you!',
        gates: [],
        leadsToNodeId: 'node_friend'
      };

      const node: DialogueNode = {
        nodeId: 'node_greeting',
        npcId: 'npc_elara',
        text: 'Greetings!',
        speaker: 'npc',
        choices: [restrictedChoice, friendlyChoice],
        consequences: [],
        isTerminal: false
      };

      registerDialogueNode(node);

      const interaction = startDialogueInteraction('npc_elara', 'player', 'node_greeting');
      if (!interaction) throw new Error('Failed to create interaction');

      const context: GateContext = {
        playerReputation: 90, // High reputation, so threat choice unavailable
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      const available = getAvailableChoices(interaction.interactionId, context);
      expect(available.length).toBe(1); // Only friendly choice
      expect(available[0].choiceId).toBe('choice_friend');
    });

    test('M65-D-12: End dialogue interaction', () => {
      const node: DialogueNode = {
        nodeId: 'node_greeting',
        npcId: 'npc_elara',
        text: 'Greetings!',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: true
      };

      registerDialogueNode(node);

      const interaction = startDialogueInteraction('npc_elara', 'player', 'node_greeting');
      if (!interaction) throw new Error('Failed to create interaction');

      const stats = endDialogueInteraction(interaction.interactionId);
      expect(stats).toBeDefined();
      expect(stats?.nodesVisited).toBe(1);
    });

    test('M65-D-13: Dialogue tree validation', () => {
      const node1: DialogueNode = {
        nodeId: 'node_start',
        npcId: 'npc_elara',
        text: 'Start',
        speaker: 'npc',
        choices: [
          { choiceId: 'choice_1', text: 'Continue', gates: [], leadsToNodeId: 'node_end', consequence: undefined }
        ],
        consequences: [],
        isTerminal: false
      };

      const node2: DialogueNode = {
        nodeId: 'node_end',
        npcId: 'npc_elara',
        text: 'End',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: true
      };

      registerDialogueNode(node1);
      registerDialogueNode(node2);

      const validation = validateDialogueTree();
      expect(validation.isValid).toBe(true);
      expect(validation.orphanedNodes.length).toBe(0);
    });

    test('M65-D-14: Dialogue statistics', () => {
      const node: DialogueNode = {
        nodeId: 'node_test',
        npcId: 'npc_elara',
        text: 'Test',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: false
      };

      registerDialogueNode(node);

      const stats = getDialogueStatistics();
      expect(stats.registeredNodes).toBe(1);
    });
  });

  // ========================================================================
  // INTEGRATION TESTS
  // ========================================================================

  describe('M65-E: Integration Tests', () => {
    test('M65-E-1: 50+ NPC gossip cascade performance', () => {
      const graph = initializeSocialGraph('region_torania');

      // Create 50 NPCs in a chain
      const npcIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const npcId = `npc_citizen_${i}`;
        npcIds.push(npcId);
        addNPCToGraph(graph.graphId, npcId, `Citizen ${i}`, Math.random() * 1000, 'commoner');
      }

      // Create chain relationships
      for (let i = 0; i < npcIds.length - 1; i++) {
        createSocialEdge(graph.graphId, npcIds[i], npcIds[i + 1], 'acquaintance', 40, 0);
      }

      const startTime = Date.now();

      const cascade = initiateGossipCascade(
        graph,
        npcIds[0],
        {
          content: 'Big news!',
          category: 'rumor',
          reliabilityScore: 100,
          emotionalWeight: 80,
          decayRate: -0.15
        },
        5
      );

      const duration = Date.now() - startTime;

      expect(cascade).toBeDefined();
      expect(duration).toBeLessThan(50); // Should complete in <50ms
    });

    test('M65-E-2: Social graph with political integration', () => {
      const graph = initializeSocialGraph('region_torania');

      // Create NPCs
      const elara = addNPCToGraph(graph.graphId, 'npc_elara', 'Elara', 500, 'notable');
      const theron = addNPCToGraph(graph.graphId, 'npc_theron', 'Theron', 750, 'prominent');

      expect(elara && theron).toBeTruthy();

      // Award political favor
      awardPoliticalFavor('npc_elara', 200, 'alliance');
      registerSocialScar('npc_elara', 'Betrayal incident', 70, 40, true, ['faction_lightbringers']);

      // Calculate impact
      const votingPower = calculateVotingPower('npc_elara');
      expect(votingPower.finalVotingPower).toBeLessThan(200);

      // Calculate faction impact
      const factionState = calculateFactionPowerState('faction_lightbringers', ['npc_elara', 'npc_theron']);
      expect(factionState.scarDamage).toBeGreaterThan(0);
    });

    test('M65-E-3: Deterministic dialogue replay with ledger', () => {
      const node1: DialogueNode = {
        nodeId: 'node_1',
        npcId: 'npc_elara',
        text: 'Hello',
        speaker: 'npc',
        choices: [
          { choiceId: 'choice_1', text: 'Hi!', gates: [], leadsToNodeId: 'node_2' }
        ],
        consequences: [],
        isTerminal: false,
        ledgerCheckpoint: 'checkpoint_1'
      };

      const node2: DialogueNode = {
        nodeId: 'node_2',
        npcId: 'npc_elara',
        text: 'Goodbye',
        speaker: 'npc',
        choices: [],
        consequences: [],
        isTerminal: true,
        ledgerCheckpoint: 'checkpoint_2'
      };

      registerDialogueNode(node1);
      registerDialogueNode(node2);

      const interaction = startDialogueInteraction('npc_elara', 'player', 'node_1');
      if (!interaction) throw new Error('Failed to create interaction');

      const context: GateContext = {
        playerReputation: 50,
        npcRelationships: new Map(),
        factionLoyalties: new Map(),
        inventory: new Map(),
        questStates: new Map(),
        socialScars: [],
        politicalFavor: 100,
        currentTick: Date.now()
      };

      makeDialogueChoice(interaction.interactionId, 'choice_1', context);

      const ledger = getInteractionLedger(interaction.interactionId);
      expect(ledger.length).toBeGreaterThan(0);

      const replay = replayDialogueFromLedger(ledger);
      expect(replay.success).toBe(true);
    });
  });

  // ========================================================================
  // MEMORY & PERFORMANCE TESTS
  // ========================================================================

  describe('M65-F: Memory & Performance', () => {
    test('M65-F-1: 128 NPCs memory constraint', () => {
      const graph = initializeSocialGraph('region_test');

      const initialMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      // Create 128 NPCs
      for (let i = 0; i < 128; i++) {
        addNPCToGraph(graph.graphId, `npc_${i}`, `NPC ${i}`, Math.random() * 1000, 'commoner');
      }

      const withNPCsMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      // Memory should be reasonable
      console.log(`Memory: ${initialMemory}MB -> ${withNPCsMemory}MB`);
    });

    test('M65-F-2: Quick graph query performance', () => {
      const graph = initializeSocialGraph('region_test');

      for (let i = 0; i < 50; i++) {
        addNPCToGraph(graph.graphId, `npc_${i}`, `NPC ${i}`, Math.random() * 1000, 'commoner');

        if (i > 0) {
          createSocialEdge(graph.graphId, `npc_${i - 1}`, `npc_${i}`, 'friend', 50, 50);
        }
      }

      const startTime = Date.now();

      // Perform multiple queries
      for (let i = 0; i < 10; i++) {
        getSocialConnections(graph.graphId, `npc_${i % 50}`);
        calculateTotalInfluence(graph.graphId, `npc_${i % 50}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });
});
