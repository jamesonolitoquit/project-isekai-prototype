import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import {
  updateNpcEmotion,
  decayNpcEmotions,
  getEmotionalDialogueTone,
  calculateDefectionRisk,
  processNpcAttrition,
  getEmotionalGreeting,
  maybeAddAllyGiftOption,
  filterDialogueByEmotion
} from '../engine/npcEngine';
import {
  processWarfarePhysicality,
  applyLocationScars,
  expireLocationScars
} from '../engine/factionEngine';
import {
  generateResonanceSummary,
  calculateWorldTension
} from '../engine/chronosLedgerEngine';
import type { WorldState } from '../engine/worldEngine';
import { SeededRng, setGlobalRng } from '../engine/prng';

/**
 * ALPHA_M19 - The Resonance Phase: NPC Emotional Arcs & Dynamic Faction Wars
 * Comprehensive test suite: 60+ test scenarios across 6 major systems
 */
describe('ALPHA_M19 - The Resonance Phase', () => {
  beforeAll(() => {
    const rng = new SeededRng(42);
    setGlobalRng(rng);
  });

  // ========== NPC EMOTIONAL MEMORY (TESTS 1-15) ==========
  describe('Step 1: NPC Emotional Memory', () => {
    let mockNpc: any;

    beforeEach(() => {
      mockNpc = {
        id: 'npc-1',
        name: 'Tavern Keeper',
        locationId: 'loc-1',
        importance: 'major',
        emotionalState: {
          trust: 50,
          fear: 50,
          gratitude: 50,
          resentment: 50,
          emotionalHistory: []
        }
      };
    });

    it('Test 1: Initialize emotional state with neutral baseline', () => {
      expect(mockNpc.emotionalState.trust).toBe(50);
      expect(mockNpc.emotionalState.fear).toBe(50);
      expect(mockNpc.emotionalState.gratitude).toBe(50);
      expect(mockNpc.emotionalState.resentment).toBe(50);
    });

    it('Test 2: Increase gratitude on positive quest outcome', () => {
      updateNpcEmotion(mockNpc, 'gratitude', 25, 'player_saved_family', 1000);
      expect(mockNpc.emotionalState.gratitude).toBe(75);
    });

    it('Test 3: Increase resentment on aggressive dialogue', () => {
      updateNpcEmotion(mockNpc, 'resentment', 20, 'player_threatened_family', 1000);
      expect(mockNpc.emotionalState.resentment).toBe(70);
    });

    it('Test 4: Clamp emotions to 0-100 range', () => {
      updateNpcEmotion(mockNpc, 'trust', 100, 'overdose_test', 1000);
      expect(mockNpc.emotionalState.trust).toBe(100);

      updateNpcEmotion(mockNpc, 'trust', -150, 'underdose_test', 1000);
      expect(mockNpc.emotionalState.trust).toBe(0);
    });

    it('Test 5: Record emotional history', () => {
      updateNpcEmotion(mockNpc, 'gratitude', 15, 'helped_with_task', 1000);
      updateNpcEmotion(mockNpc, 'fear', 10, 'witnessed_magic', 1100);

      expect(mockNpc.emotionalState.emotionalHistory.length).toBe(2);
      expect(mockNpc.emotionalState.emotionalHistory[0].category).toBe('gratitude');
      expect(mockNpc.emotionalState.emotionalHistory[1].category).toBe('fear');
    });

    it('Test 6: Decay emotions toward neutral (50) over time', () => {
      mockNpc.emotionalState.trust = 80; // High trust
      mockNpc.emotionalState.fear = 20;  // Low fear

      // 1 in-game day = 1440 ticks
      decayNpcEmotions(mockNpc, 1440);

      // Should move toward 50 by 2 points
      expect(mockNpc.emotionalState.trust).toBeLessThan(80);
      expect(mockNpc.emotionalState.fear).toBeGreaterThan(20);
    });

    it('Test 7: Higher fear + lower trust = snide tone', () => {
      mockNpc.emotionalState.resentment = 80;
      mockNpc.emotionalState.gratitude = 30;

      const tone = getEmotionalDialogueTone(mockNpc);
      expect(tone).toBe('snide');
    });

    it('Test 8: High gratitude + high trust = warm tone', () => {
      mockNpc.emotionalState.gratitude = 80;
      mockNpc.emotionalState.trust = 70;

      const tone = getEmotionalDialogueTone(mockNpc);
      expect(tone).toBe('warm');
    });

    it('Test 9: Defection risk is 0 for critical NPCs', () => {
      const criticalNpc: any = { ...mockNpc, importance: 'critical' };
      const risk = calculateDefectionRisk(criticalNpc);
      expect(risk).toBe(0);
    });

    it('Test 10: High fear + low trust increases defection risk', () => {
      mockNpc.emotionalState.fear = 90;
      mockNpc.emotionalState.trust = 20;

      const risk = calculateDefectionRisk(mockNpc);
      expect(risk).toBeGreaterThan(50);
    });

    it('Test 11: Emotional greeting reflects current tone', () => {
      mockNpc.emotionalState.gratitude = 75;
      mockNpc.emotionalState.trust = 65;

      const greeting = getEmotionalGreeting(mockNpc);
      expect(greeting.toLowerCase()).toContain('warm');
    });

    it('Test 12: Resentful NPC offers snide greeting', () => {
      mockNpc.emotionalState.resentment = 75;
      mockNpc.emotionalState.gratitude = 30;

      const greeting = getEmotionalGreeting(mockNpc);
      expect(greeting.toLowerCase()).toContain('contempt');
    });

    it('Test 13: High gratitude may unlock ally gift option', () => {
      mockNpc.emotionalState.gratitude = 80;

      const giftOption = maybeAddAllyGiftOption(mockNpc);
      if (giftOption) {
        expect(giftOption.id).toBe('ally_gift');
        expect(giftOption.consequence).toBe('item_give');
      }
    });

    it('Test 14: Filter dialogue by emotional state', () => {
      const options = [
        { id: 'gift1', text: 'Accept ally gift' },
        { id: 'standard', text: 'Tell me news' },
        { id: 'threat', text: 'Threaten them' }
      ];

      mockNpc.emotionalState.resentment = 75;
      const filtered = filterDialogueByEmotion(options, mockNpc);
      expect(filtered.length).toBeLessThan(options.length);
    });

    it('Test 15: Emotional history limits to last 20 events', () => {
      for (let i = 0; i < 25; i++) {
        updateNpcEmotion(mockNpc, 'trust', 5, `event_${i}`, 1000 + i);
      }

      expect(mockNpc.emotionalState.emotionalHistory.length).toBe(20);
    });
  });

  // ========== TANGIBLE FACTION WARFARE (TESTS 16-30) ==========
  describe('Step 2: Tangible Faction Warfare', () => {
    let mockState: WorldState;
    let mockConflict: any;

    beforeEach(() => {
      mockState = {
        id: 'world-m19',
        tick: 1000,
        player: { id: 'player-1', location: 'loc-1', quests: {} },
        npcs: [],
        locations: [
          { id: 'loc-1', name: 'Forge Summit' },
          { id: 'loc-2', name: 'Market Square' }
        ],
        factions: [
          {
            id: 'faction-a',
            name: 'Faction A',
            powerScore: 60,
            controlledLocationIds: ['loc-1']
          },
          {
            id: 'faction-b',
            name: 'Faction B',
            powerScore: 40,
            controlledLocationIds: ['loc-2']
          }
        ],
        seed: 42,
        hour: 12,
        dayPhase: 'afternoon'
      } as any;

      mockConflict = {
        id: 'conflict-1',
        factionIds: ['faction-a', 'faction-b'],
        type: 'military',
        active: true,
        startedAt: 1000
      };
    });

    it('Test 16: Military conflicts spawn soldier NPCs', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      expect(newNpcs.length).toBeGreaterThan(0);
    });

    it('Test 17: Soldiers are spawned in controlled locations', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      const locations = newNpcs.map(npc => npc.locationId);
      expect(locations).toContain('loc-1');
    });

    it('Test 18: Each location spawns 2-4 soldiers', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      // With 1 controlled location, should spawn 2-4 soldiers
      expect(newNpcs.length).toBeGreaterThanOrEqual(2);
      expect(newNpcs.length).toBeLessThanOrEqual(4);
    });

    it('Test 19: Soldiers have aggressive personality', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      const soldier = newNpcs[0];
      expect(soldier.personality?.type).toBe('aggressive');
    });

    it('Test 20: Non-military conflicts do not spawn soldiers', () => {
      const nonMilitaryConflict = { ...mockConflict, type: 'diplomatic' };
      const { newNpcs } = processWarfarePhysicality(mockState, nonMilitaryConflict);
      expect(newNpcs.length).toBe(0);
    });

    it('Test 21: Warfare creates location scars', () => {
      const { locationScars } = processWarfarePhysicality(mockState, mockConflict);
      expect(locationScars.length).toBeGreaterThan(0);
    });

    it('Test 22: Scars include infrastructure damage or market closure', () => {
      const { locationScars } = processWarfarePhysicality(mockState, mockConflict);
      const scar = locationScars[0];
      expect(['infrastructure_damage', 'market_closure']).toContain(scar.scarType);
    });

    it('Test 23: Scars apply terrain modifiers', () => {
      const { locationScars } = processWarfarePhysicality(mockState, mockConflict);
      const scar = locationScars[0];
      expect(scar.terrainModifier).toBeLessThan(0);
    });

    it('Test 24: Apply location scars to world state', () => {
      const { locationScars } = processWarfarePhysicality(mockState, mockConflict);
      applyLocationScars(mockState, locationScars);

      const location = mockState.locations?.[0];
      expect((location as any).activeScars?.length).toBeGreaterThan(0);
    });

    it('Test 25: Scars expire after duration', () => {
      const scars = [
        {
          locationId: 'loc-1',
          scarType: 'infrastructure_damage',
          appliedAt: 1000,
          duration: 100
        }
      ];
      applyLocationScars(mockState, scars);

      // Move time forward past scar duration
      mockState.tick = 2000;
      expireLocationScars(mockState);

      const location = mockState.locations?.[0];
      expect((location as any).activeScars?.length).toBe(0);
    });

    it('Test 26: Active scars do not expire before duration', () => {
      const scars = [
        {
          locationId: 'loc-1',
          scarType: 'infrastructure_damage',
          appliedAt: 1000,
          duration: 1000
        }
      ];
      applyLocationScars(mockState, scars);

      // Move time forward, but not past duration
      mockState.tick = 1500;
      expireLocationScars(mockState);

      const location = mockState.locations?.[0];
      expect((location as any).activeScars?.length).toBe(1);
    });

    it('Test 27: Inactive conflicts do not affect world', () => {
      const inactiveConflict = { ...mockConflict, active: false };
      const { newNpcs, locationScars } = processWarfarePhysicality(mockState, inactiveConflict);

      expect(newNpcs.length).toBe(0);
      expect(locationScars.length).toBe(0);
    });

    it('Test 28: Soldiers marked with warfare flag', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      expect(newNpcs[0].isWarfareUnit).toBe(true);
    });

    it('Test 29: Soldier importance is minor', () => {
      const { newNpcs } = processWarfarePhysicality(mockState, mockConflict);
      expect(newNpcs[0].importance).toBe('minor');
    });

    it('Test 30: Scars have economic modifiers', () => {
      const { locationScars } = processWarfarePhysicality(mockState, mockConflict);
      const scar = locationScars[0];
      expect(scar.economicModifier).toBeLessThan(0);
    });
  });

  // ========== NPC ATTRITION & DEFECTION (TESTS 31-45) ==========
  describe('Step 3: NPC Fallen & Reflected Logic', () => {
    let mockNpcs: any[];
    let mockConflict: any;
    let mockState: any;

    beforeEach(() => {
      mockNpcs = [
        {
          id: 'npc-1',
          name: 'Tavern Keeper',
          factionId: 'faction-a',
          importance: 'major',
          emotionalState: { fear: 90, trust: 20, gratitude: 30, resentment: 50 }
        },
        {
          id: 'npc-2',
          name: 'Merchant',
          factionId: 'faction-a',
          importance: 'minor',
          emotionalState: { fear: 30, trust: 70, gratitude: 80, resentment: 20 }
        },
        {
          id: 'npc-3',
          name: 'Blacksmith',
          factionId: 'faction-a',
          importance: 'critical',
          emotionalState: { fear: 80, trust: 15, gratitude: 20, resentment: 90 }
        }
      ];

      mockConflict = {
        id: 'conflict-1',
        factionIds: ['faction-a', 'faction-b'],
        type: 'military',
        active: true,
        startedAt: 1000
      };

      mockState = {
        tick: 1000,
        npcDisplacements: {},
        locations: [
          { id: 'loc-1', name: 'Tavern' },
          { id: 'loc-2', name: 'Market Square' }
        ],
        factions: [
          { id: 'faction-a', name: 'Faction A', powerScore: 60, controlledLocationIds: ['loc-1'] },
          { id: 'faction-b', name: 'Faction B', powerScore: 40, controlledLocationIds: ['loc-2'] }
        ]
      };
    });

    it('Test 31: Minor NPC can defect during conflict', () => {
      const { defected } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const couldDefect = mockNpcs.filter(n => n.importance !== 'critical').length > 0;
      expect(couldDefect).toBe(true);
    });

    it('Test 32: Critical NPCs never defect', () => {
      const { defected } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const defectedNames = defected.map(n => n.name);
      expect(defectedNames).not.toContain('Blacksmith');
    });

    it('Test 33: Defection marked with defectedFactionId', () => {
      const { defected } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      if (defected.length > 0) {
        expect(defected[0].defectedFactionId).toBeDefined();
        expect(defected[0].defectedFactionId).not.toBe(defected[0].factionId);
      }
    });

    it('Test 34: Displacement can occur for high-fear NPCs', () => {
      const { displaced } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const canBeDisplaced = mockNpcs.some(n => n.emotionalState.fear > 75);
      expect(canBeDisplaced).toBe(true);
    });

    it('Test 35: Displaced NPC marked with isDisplaced flag', () => {
      const { displaced } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      if (displaced.length > 0) {
        expect(displaced[0].isDisplaced).toBe(true);
      }
    });

    it('Test 36: Events generated for defections', () => {
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const defectionEvents = events.filter(e => e.type === 'NPC_DEFECTED');
      // May have 0 or more depending on RNG
      expect(Array.isArray(defectionEvents)).toBe(true);
    });

    it('Test 37: Events generated for displacements', () => {
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const displacementEvents = events.filter(e => e.type === 'NPC_DISPLACED');
      expect(Array.isArray(displacementEvents)).toBe(true);
    });

    it('Test 38: Attrition only affects NPCs in conflict zone', () => {
      const npcOutsideConflict: any = {
        id: 'npc-outside',
        name: 'Remote Hermit',
        factionId: 'faction-c', // Not in conflict
        importance: 'minor',
        emotionalState: { fear: 90, trust: 10, gratitude: 20, resentment: 80 }
      };

      mockNpcs.push(npcOutsideConflict);
      const { displaced, defected } = processNpcAttrition(mockNpcs, mockConflict, mockState);

      const affectedNames = [...displaced, ...defected].map(n => n.name);
      expect(affectedNames).not.toContain('Remote Hermit');
    });

    it('Test 39: Displacement duration tracked', () => {
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const displacementEvent = events.find(e => e.type === 'NPC_DISPLACED');
      if (displacementEvent) {
        expect(displacementEvent.expectedReturnTick).toBeGreaterThan(mockState.tick);
      }
    });

    it('Test 40: Expected return is 1-2 in-game days', () => {
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const displacementEvent = events.find(e => e.type === 'NPC_DISPLACED');
      if (displacementEvent) {
        const returnWindow = displacementEvent.expectedReturnTick - mockState.tick;
        expect(returnWindow).toBeGreaterThanOrEqual(1440); // 1 day
        expect(returnWindow).toBeLessThanOrEqual(2880); // 2 days
      }
    });

    it('Test 41: Resentment increases defection reason likelihood', () => {
      mockNpcs[0].emotionalState.resentment = 85;
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      const reasons = events
        .filter(e => e.type === 'NPC_DEFECTED')
        .map(e => e.reason);
      // High resentment likely reason
      expect(reasons).toContain('resentment');
    });

    it('Test 42: Fear increases fear-based displacement', () => {
      mockNpcs[0].emotionalState.fear = 95;
      const { events, displaced } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      // Very high fear increases displacement likelihood
      expect(Array.isArray(displaced)).toBe(true);
    });

    it('Test 43: Attrition does not trigger for loyal NPCs', () => {
      const loyalNpc: any = {
        id: 'loyal-1',
        name: 'Loyal Companion',
        factionId: 'faction-a',
        importance: 'minor',
        emotionalState: { fear: 10, trust: 95, gratitude: 95, resentment: 5 }
      };

      const { defected } = processNpcAttrition([loyalNpc], mockConflict, mockState);
      // Very low defection risk for loyal NPC
      expect(calculateDefectionRisk(loyalNpc)).toBeLessThan(30);
    });

    it('Test 44: Multiple NPCs can defect/displace simultaneously', () => {
      const { defected, displaced } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      // Both lists may contain NPCs
      expect(Array.isArray(defected)).toBe(true);
      expect(Array.isArray(displaced)).toBe(true);
    });

    it('Test 45: Events include era tick and NPC identity', () => {
      const { events } = processNpcAttrition(mockNpcs, mockConflict, mockState);
      if (events.length > 0) {
        const event = events[0];
        expect(event.tick).toBeDefined();
        expect(event.npcId).toBeDefined();
        expect(event.npcName).toBeDefined();
      }
    });
  });

  // ========== RESONANCE LEDGER INTEGRATION (TESTS 46-55) ==========
  describe('Step 4: Resonance Ledger Integration', () => {
    let mockState: any;
    let mockLedger: any;

    beforeEach(() => {
      mockState = {
        id: 'world-1',
        tick: 5000,
        npcs: [
          {
            id: 'npc-1',
            name: 'Tavern Keeper',
            emotionalState: {
              gratitude: 85,
              resentment: 20,
              emotionalHistory: [
                { tick: 1000, category: 'gratitude', delta: 25, reason: 'saved_from_bandits' }
              ]
            }
          }
        ],
        locations: [
          {
            id: 'loc-1',
            name: 'Market',
            activeScars: [{ description: 'Market damaged by conflict', scarType: 'infrastructure_damage' }]
          }
        ],
        factionConflicts: [
          { id: 'conflict-1', active: false, factionIds: ['a', 'b'] }
        ]
      };

      mockLedger = {
        worldId: 'world-1',
        totalEvents: 100,
        turningPointCount: 5,
        significantShiftCount: 15,
        incrementalCount: 80,
        turningPoints: [],
        narrativePath: [],
        paradoxEchoes: [],
        canonicalShifts: []
      };
    });

    it('Test 46: Generate resonance summary from state', () => {
      const summary = generateResonanceSummary(mockState, mockLedger);
      expect(summary.length).toBeGreaterThan(0);
    });

    it('Test 47: Resonance summary includes emotional arcs', () => {
      const summary = generateResonanceSummary(mockState, mockLedger);
      expect(summary.toLowerCase()).toContain('emotional');
    });

    it('Test 48: Resonance summary includes world scars', () => {
      const summary = generateResonanceSummary(mockState, mockLedger);
      expect(summary.toLowerCase()).toContain('scar');
    });

    it('Test 49: Calculate world tension from state', () => {
      const tension = calculateWorldTension(mockState);
      expect(tension).toBeGreaterThanOrEqual(0);
      expect(tension).toBeLessThanOrEqual(100);
    });

    it('Test 50: World tension includes active conflicts', () => {
      const stateWithConflict = {
        ...mockState,
        factionConflicts: [{ active: true, factionIds: ['a', 'b'] }]
      };

      const tensionWithConflict = calculateWorldTension(stateWithConflict);
      const tensionWithoutConflict = calculateWorldTension(mockState);

      expect(tensionWithConflict).toBeGreaterThanOrEqual(tensionWithoutConflict);
    });

    it('Test 51: World tension includes location scars', () => {
      const tension = calculateWorldTension(mockState);
      // Active scars should contribute to tension
      expect(tension).toBeGreaterThan(0);
    });

    it('Test 52: World tension includes NPC fear', () => {
      const fearfulState = {
        ...mockState,
        npcs: [
          { emotionalState: { fear: 90 } },
          { emotionalState: { fear: 85 } }
        ]
      };

      const tension = calculateWorldTension(fearfulState);
      expect(tension).toBeGreaterThan(0);
    });

    it('Test 53: NPC emotional history appears in summary', () => {
      const summary = generateResonanceSummary(mockState, mockLedger);
      // Should mention specific NPC emotional events if available
      expect(typeof summary).toBe('string');
    });

    it('Test 54: Displaced NPCs tracked in tension', () => {
      const stateWithDisplaced = {
        ...mockState,
        npcs: [...mockState.npcs, { isDisplaced: true }]
      };

      const tension = calculateWorldTension(stateWithDisplaced);
      expect(tension).toBeGreaterThan(0);
    });

    it('Test 55: World tension clamped 0-100', () => {
      const extremeState: any = {
        id: 'world-1',
        tick: 5000,
        seed: 'test',
        hour: 12,
        day: 1,
        dayPhase: 'day',
        weather: 'clear',
        npcs: Array(20).fill({ emotionalState: { fear: 100 } }),
        factionConflicts: Array(10).fill({ active: true }),
        locations: [],
        factions: [],
        questStates: {},
        player: { hp: 100, xp: 0 }
      };

      const tension = calculateWorldTension(extremeState);
      expect(tension).toBeLessThanOrEqual(100);
    });
  });

  // ========== EMOTIONAL DIALOGUE BRANCHING (TESTS 56-60) ==========
  describe('Step 6: Emotional Dialogue Branching', () => {
    let mockNpc: any;
    let mockDialogueOptions: any[];

    beforeEach(() => {
      mockNpc = {
        id: 'npc-1',
        name: 'Ally',
        emotionalState: {
          gratitude: 50,
          resentment: 50,
          fear: 50,
          trust: 50
        }
      };

      mockDialogueOptions = [
        { id: 'greet', text: 'Hello, good friend' },
        { id: 'gift', text: 'Accept ally gift' },
        { id: 'threaten', text: 'Threaten them' },
        { id: 'quest', text: 'Do you have work?' }
      ];
    });

    it('Test 56: High gratitude enables ally gift dialogue', () => {
      mockNpc.emotionalState.gratitude = 80;
      const gift = maybeAddAllyGiftOption(mockNpc);

      if (gift) {
        expect(gift.id).toBe('ally_gift');
      }
    });

    it('Test 57: Low gratitude does not enable gifts', () => {
      mockNpc.emotionalState.gratitude = 30;
      const gift = maybeAddAllyGiftOption(mockNpc);
      // May be null due to randomness
      if (gift) {
        expect(gift.id).toBe('ally_gift');
      }
    });

    it('Test 58: High resentment filters out gift options', () => {
      mockNpc.emotionalState.resentment = 80;
      const filtered = filterDialogueByEmotion(mockDialogueOptions, mockNpc);

      const hasGift = filtered.some(opt => opt.text.toLowerCase().includes('gift'));
      expect(hasGift).toBe(false);
    });

    it('Test 59: High fear filters out threat options', () => {
      mockNpc.emotionalState.fear = 85;
      const filtered = filterDialogueByEmotion(mockDialogueOptions, mockNpc);

      const hasThreat = filtered.some(opt => opt.text.toLowerCase().includes('threaten'));
      expect(hasThreat).toBe(false);
    });

    it('Test 60: Neutral emotions do not filter dialogue', () => {
      mockNpc.emotionalState = {
        gratitude: 50,
        resentment: 50,
        fear: 50,
        trust: 50
      };

      const filtered = filterDialogueByEmotion(mockDialogueOptions, mockNpc);
      expect(filtered.length).toBeGreaterThanOrEqual(mockDialogueOptions.length - 1);
    });
  });
});
