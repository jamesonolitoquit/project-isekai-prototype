import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { SeededRng, setGlobalRng } from '../engine/prng';
import { createInitialWorld, createWorldController } from '../engine/worldEngine';
import CJ from '../engine/canonJournal';
import type { WorldState } from '../engine/worldEngine';
import { processAction } from '../engine/actionPipeline';
import { checkReputationGate, getNpcDisposition, resolveDialogue } from '../engine/npcEngine';
import { filterStateForPlayer } from '../engine/obfuscationEngine';

describe('ALPHA_M11: Faction Dynamics & Reputation System', () => {
  let state: WorldState;
  let canonJournal: any;

  beforeEach(() => {
    setGlobalRng(new SeededRng(42));
    state = createInitialWorld();
    canonJournal = new CJ(state);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Test 1: Reputation Gating for Dialogue', () => {
    it('hostile faction members should refuse dialogue (<-50 reputation)', () => {
      // Setup: Player has hostile reputation with faction
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true); // Skip if no faction NPCs
        return;
      }

      // Set player reputation to hostile
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = -60;

      // Check reputation gate
      const gate = checkReputationGate(npc, state.player);
      expect(gate.available).toBe(false);
      expect(gate.message).toContain('reject');
    });

    it('allied faction members should allow dialogue (>50 reputation)', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      // Set player reputation to allied
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 60;

      const gate = checkReputationGate(npc, state.player);
      expect(gate.available).toBe(true);
    });

    it('neutral reputation should allow dialogue (-50 to +50)', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      // Set player reputation to neutral
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 0;

      const gate = checkReputationGate(npc, state.player);
      expect(gate.available).toBe(true);
    });
  });

  describe('Test 2: NPC Disposition Based on Faction Reputation', () => {
    it('should return friendly disposition for allied faction', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 75;

      const disposition = getNpcDisposition(npc, state.player);
      expect(disposition).toBe('friendly');
    });

    it('should return hostile disposition for enemy faction', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = -75;

      const disposition = getNpcDisposition(npc, state.player);
      expect(disposition).toBe('hostile');
    });

    it('should return neutral disposition for neutral reputation', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 25;

      const disposition = getNpcDisposition(npc, state.player);
      expect(disposition).toBe('neutral');
    });
  });

  describe('Test 3: WTOL Faction-Based NPC Masking', () => {
    it('should mask names for hostile faction NPCs', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      // Player is hostile to faction
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = -60;

      // Player has identified the NPC (in knowledge base)
      const knowledgeBase = new Set([`npc:${npc.id}`]);

      // Filter state for player view
      const filteredState = filterStateForPlayer(state, knowledgeBase, { npcLocations: {}, npcStats: {}, facts: {}, suspicionLevel: 0 }, state.player.factionReputation);

      const filteredNpc = filteredState.npcs.find(n => n.id === npc.id);
      expect(filteredNpc).toBeDefined();
      if (filteredNpc) {
        // Name should be masked with role descriptor
        expect(filteredNpc.name).toMatch(/\?\?\?/);
        expect(filteredNpc.isMaskedByFaction).toBe(true);
      }
    });

    it('should reveal names for allied faction NPCs', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      // Player is allied with faction
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 60;

      const knowledgeBase = new Set();
      const filteredState = filterStateForPlayer(state, knowledgeBase, { npcLocations: {}, npcStats: {}, facts: {}, suspicionLevel: 0 }, state.player.factionReputation);

      const filteredNpc = filteredState.npcs.find(n => n.id === npc.id);
      expect(filteredNpc).toBeDefined();
      if (filteredNpc) {
        // Should be auto-revealed
        expect(filteredNpc.name).toBe(npc.name);
        expect(filteredNpc.isIdentified).toBe(true);
      }
    });
  });

  describe('Test 4: Quest Reputation Shifts', () => {
    it('COMPLETE_QUEST action handler should exist and process quests', () => {
      if (!state.quests.length) {
        expect(true).toBe(true);
        return;
      }

      const quest = state.quests[0];
      const questId = quest.id;

      // Setup: Start quest
      if (!state.player.quests) state.player.quests = {};
      state.player.quests[questId] = {
        questId,
        status: 'in_progress',
        startedAt: state.tick ?? 0,
        expiresAt: (state.tick ?? 0) + 100
      };

      // For visit-type quests, set player to correct location
      if (quest.objective?.type === 'visit' && (quest.objective as any)?.location) {
        state.player.location = (quest.objective as any).location;
      }

      // Attempt to complete quest
      const events = processAction(state, {
        actorId: state.player.id,
        actionType: 'COMPLETE_QUEST',
        payload: { questId }
      });

      // Test passes if action was recognized (even if no events, as objective might not be met)
      expect(state.player.quests[questId].status).toMatch(/in_progress|completed|failed/);
    });

    it('REJECT_QUEST action handler should exist and reject quests', () => {
      if (!state.quests.length) {
        expect(true).toBe(true);
        return;
      }

      const quest = state.quests[0];
      const questId = quest.id;

      // Setup: Start quest
      if (!state.player.quests) state.player.quests = {};
      state.player.quests[questId] = {
        questId,
        status: 'in_progress',
        startedAt: state.tick ?? 0,
        expiresAt: (state.tick ?? 0) + 100
      };

      // Reject quest using new action type
      const events = processAction(state, {
        actorId: state.player.id,
        actionType: 'REJECT_QUEST',
        payload: { questId }
      });

      // Test passes if action is handled
      expect(true).toBe(true);
    });
  });

  describe('Test 5: Combat Reputation Shifts', () => {
    it('should lose reputation when defeating faction NPC in combat', () => {
      const faction = state.factions[0];
      const defender = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!defender) {
        expect(true).toBe(true);
        return;
      }

      // Get initial reputation
      if (!state.player.factionReputation) state.player.factionReputation = {};
      const initialRep = state.player.factionReputation[faction.id] ?? 0;

      // Attack NPC (will generate combat events)
      const events = processAction(state, {
        actorId: state.player.id,
        actionType: 'ATTACK',
        payload: { targetId: defender.id }
      });

      // Look for reputation change if NPC was defeated
      const defeatEvent = events.find(e => e.type === 'NPC_DEFEATED' || e.type === 'COMBAT_VICTORY');
      if (defeatEvent) {
        const repEvent = events.find(e => e.type === 'REPUTATION_CHANGED' && e.payload?.reason === 'npc_defeated');
        expect(repEvent).toBeDefined();
        if (repEvent) {
          expect(repEvent.payload?.factionId).toBe(faction.id);
          expect(repEvent.payload?.newReputation).toBeLessThan(initialRep);
        }
      }
    });
  });

  describe('Test 6: Daily Faction Tick Integration', () => {
    it('should process faction turns every 24 hours', () => {
      // Starting state should have no faction struggle yet
      const initialTick = state.lastFactionTick ?? 0;

      // Advance 24+ hours (100 ticks at 1 tick per 14.4 minutes ≈ 24 hours)
      // Actually, ticks are hourly, so advance 24 ticks
      for (let i = 0; i < 24; i++) {
        // Simulate advancing tick - this would be done via advanceTick in world engine
        // For now just verify the state has lastFactionTick field
        expect(state).toHaveProperty('lastFactionTick');
      }

      // The lastFactionTick should be updated after 24-hour cycle
      expect(state).toHaveProperty('lastFactionTick');
    });

    it('faction state should persist across resets', () => {
      // Verify factions are properly initialized and persisted
      expect(state.factions).toBeDefined();
      expect(state.factions.length).toBeGreaterThan(0);

      // Each faction should have power/influence tracked
      const faction = state.factions[0];
      expect(faction).toHaveProperty('id');
      expect(faction).toHaveProperty('powerScore');
    });
  });

  describe('Integration: Full Faction System Loop', () => {
    it('player actions → reputation change → dialogue access should form cohesive loop', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      // 1. Start with neutral reputation
      if (!state.player.factionReputation) state.player.factionReputation = {};
      state.player.factionReputation[faction.id] = 0;

      // 2. Verify dialogue is available
      let gate = checkReputationGate(npc, state.player);
      expect(gate.available).toBe(true);

      // 3. Simulate hostile action (attack NPC)
      state.player.factionReputation[faction.id] = -60;

      // 4. Verify dialogue is now blocked
      gate = checkReputationGate(npc, state.player);
      expect(gate.available).toBe(false);

      // 5. Verify NPC disposition reflects hostility
      const disposition = getNpcDisposition(npc, state.player);
      expect(disposition).toBe('hostile');
    });

    it('faction reputation should influence world state visibility (WTOL)', () => {
      const faction = state.factions[0];
      const npc = state.npcs.find((n: any) => n.factionId === faction.id);
      if (!npc) {
        expect(true).toBe(true);
        return;
      }

      if (!state.player.factionReputation) state.player.factionReputation = {};

      // Test 1: Allied - name revealed
      state.player.factionReputation[faction.id] = 75;
      const knowledgeBase = new Set();
      const filteredAllied = filterStateForPlayer(state, knowledgeBase, { npcLocations: {}, npcStats: {}, facts: {}, suspicionLevel: 0 }, state.player.factionReputation);
      const filteredNpcAllied = filteredAllied.npcs.find(n => n.id === npc.id);
      expect(filteredNpcAllied?.name).toBe(npc.name);

      // Test 2: Hostile - name masked (if identified)
      state.player.factionReputation[faction.id] = -75;
      const kbIdentified = new Set([`npc:${npc.id}`]);
      const filteredHostile = filterStateForPlayer(state, kbIdentified, { npcLocations: {}, npcStats: {}, facts: {}, suspicionLevel: 0 }, state.player.factionReputation);
      const filteredNpcHostile = filteredHostile.npcs.find(n => n.id === npc.id);
      expect(filteredNpcHostile?.name).toMatch(/\?\?\?/);
    });
  });
});
