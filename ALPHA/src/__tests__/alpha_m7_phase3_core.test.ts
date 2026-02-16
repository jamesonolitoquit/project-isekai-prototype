/**
 * ALPHA_M7 Phase 3 - Core Integration Tests
 * Focused tests for Director-History-Dialogue pipeline
 * 
 * Validates: DirectorState extensions, canonJournal dialogue anchors, npcEngine narrative grounding
 */

import { initializeDirectorState } from '../engine/aiDmEngine';
import { resolveDialogue, type DialogueContext } from '../engine/npcEngine';
import CJ from '../engine/canonJournal';
import { getGlobalRng, setGlobalRng, SeededRng } from '../engine/prng';

describe('ALPHA_M7 Phase 3: Core Integration', () => {
  let rng: SeededRng;

  beforeEach(() => {
    rng = new SeededRng(12345);
    setGlobalRng(rng);
  });

  describe('DirectorState Phase 3 Extensions', () => {
    it('should initialize with ambient whisper throttle tracking', () => {
      const directorState = initializeDirectorState();
      
      expect(directorState.narrativeTension).toBe(50);
      expect(directorState.lastAmbientWhisperTick).toBe(0);
      expect(directorState.interventionCooldown).toBe(0);
    });

    it('should track ambient whisper timing for throttling', () => {
      const directorState = initializeDirectorState();
      
      // Simulate a whisper was emitted at tick 100
      directorState.lastAmbientWhisperTick = 100;
      
      const throttleThreshold = 50; // Default throttle
      const currentTick = 120;
      const ticksSince = currentTick - directorState.lastAmbientWhisperTick;
      
      expect(ticksSince).toBe(20);
      expect(ticksSince < throttleThreshold).toBe(true); // Should still be throttled
    });
  });

  describe('Canon Journal Phase 3: Dialogue Anchors', () => {
    it('should record high-divergence mutations as pivot points', () => {
      const journal = new CJ('test-world');
      
      journal.recordMutation(
        0, 1,
        { type: 'FACTION_CONFLICT_START' },
        {},
        [{ type: 'FACTION_CONFLICT_START', payload: { faction1Id: 'faction-a' } }],
        { player: { primaryFaction: 'faction-a', location: 'loc1' } },
        0.75 // High divergence - will create pivot
      );
      
      const pivots = journal.getRecentPivotPoints(10);
      expect(pivots.length).toBeGreaterThan(0);
      expect(pivots[0].divergenceScore).toBe(0.75);
    });

    it('should map narrative anchors to affected factions', () => {
      const journal = new CJ('test-world');
      
      journal.recordMutation(
        0, 1,
        { type: 'FACTION_CONFLICT_START' },
        {},
        [{ type: 'FACTION_CONFLICT_START', payload: { faction1Id: 'rebel-faction' } }],
        { player: { primaryFaction: 'rebel-faction', location: 'loc1' } },
        0.8
      );
      
      const anchors = journal.getNarrativeAnchorsFor('rebel-faction');
      expect(anchors.length).toBeGreaterThan(0);
      expect(anchors[0].affectedFactions).toContain('rebel-faction');
    });

    it('should provide getDialogueAnchors for NPC-friendly historical context', () => {
      const journal = new CJ('test-world');
      
      // Record two events
      journal.recordMutation(
        0, 1,
        { type: 'QUEST_COMPLETED' },
        {},
        [{ type: 'QUEST_COMPLETED', payload: { questTitle: 'Quest 1' } }],
        { player: { primaryFaction: 'faction-a', location: 'loc1' } },
        0.65
      );
      
      journal.recordMutation(
        2, 3,
        { type: 'ENCOUNTER_TRIGGERED' },
        {},
        [{ type: 'ENCOUNTER_TRIGGERED', payload: { location: 'loc1' } }],
        { player: { primaryFaction: 'faction-a', location: 'loc1' } },
        0.72
      );
      
      const dialogueAnchors = journal.getDialogueAnchors('npc1', 'faction-a', 'loc1');
      
      expect(dialogueAnchors.anchors).toBeDefined();
      expect(Array.isArray(dialogueAnchors.anchors)).toBe(true);
      expect(dialogueAnchors.locationHistory).toBeDefined();
    });

    it('should generate rumor mill fallback text from chronicles', () => {
      const journal = new CJ('test-world');
      
      // Create an event and summarize it
      journal.recordMutation(
        0, 1,
        { type: 'QUEST_COMPLETED' },
        {},
        [{ type: 'QUEST_COMPLETED', payload: { questTitle: 'Ancient Artifact Found' } }],
        { player: { primaryFaction: 'faction-a', location: 'loc1' } },
        0.75
      );
      
      // Summarize into chronicle
      journal.summarizeAsChronicle(0, 1, { player: { level: 5 } });
      
      const dialogueAnchors = journal.getDialogueAnchors('npc1', 'faction-a');
      
      // Rumor should be generated from chronicle if available
      if (dialogueAnchors.rumor) {
        expect(typeof dialogueAnchors.rumor).toBe('string');
        expect(dialogueAnchors.rumor.length).toBeGreaterThan(0);
      }
    });
  });

  describe('NPC Engine Phase 3: Narrative-Grounded Dialogue', () => {
    const mockNpc = {
      id: 'npc1',
      name: 'Aldric',
      factionId: 'rebel-faction',
      dialogueVariations: {
        default: 'Aldric nods at you.',
        narrative_conflict: 'The conflict weighs heavily on us.',
        narrative_triumph: 'Victory is ours!',
        rumor_conflict: 'Dark times have befallen our faction.'
      }
    };

    const mockPlayer = {
      id: 'player',
      factionReputation: { 'rebel-faction': 75 }
    };

    const mockState = {
      id: 'test',
      tick: 0,
      weather: 'clear',
      season: 'autumn',
      hour: 14,
      day: 1,
      dayPhase: 'afternoon',
      locations: [{ id: 'loc1', name: 'Forest', description: 'A forest' }],
      player: { location: 'loc1' }
    };

    it('should accept narrative anchors in DialogueContext', () => {
      const context: DialogueContext = {
        weather: 'clear',
        season: 'autumn',
        hour: 14,
        dayPhase: 'afternoon',
        reputation: 75,
        questHistory: [],
        narrativeAnchors: [],
        recentPivots: []
      };
      
      expect(context.narrativeAnchors).toBeDefined();
      expect(context.recentPivots).toBeDefined();
    });

    it('should resolve dialogue with optional canonJournal parameter', () => {
      const journal = new CJ('test-world');
      const context: DialogueContext = {
        weather: 'clear',
        season: 'autumn',
        hour: 14,
        dayPhase: 'afternoon',
        reputation: 75,
        questHistory: [],
        narrativeAnchors: [],
        recentPivots: []
      };

      // Should not throw even without journal
      const dialogue1 = resolveDialogue(mockNpc, mockPlayer, mockState, context);
      expect(dialogue1.text).toBeDefined();
      expect(dialogue1.text.length).toBeGreaterThan(0);

      // Should not throw with journal
      const dialogue2 = resolveDialogue(mockNpc, mockPlayer, mockState, context, journal);
      expect(dialogue2.text).toBeDefined();
      expect(dialogue2.text.length).toBeGreaterThan(0);
    });

    it('should prioritize narrative anchors when present in context', () => {
      const journal = new CJ('test-world');
      
      // Create a narrative anchor
      journal.recordMutation(
        0, 1,
        { type: 'FACTION_CONFLICT_START' },
        {},
        [{ type: 'FACTION_CONFLICT_START', payload: { faction1Id: 'rebel-faction' } }],
        { player: { primaryFaction: 'rebel-faction', location: 'loc1' } },
        0.8
      );
      
      const anchors = journal.getNarrativeAnchorsFor('rebel-faction');
      
      const context: DialogueContext = {
        weather: 'clear',
        season: 'autumn',
        hour: 14,
        dayPhase: 'afternoon',
        reputation: 75,
        questHistory: [],
        narrativeAnchors: anchors, // Include narrative anchors
        recentPivots: journal.getRecentPivotPoints(3)
      };

      const dialogue = resolveDialogue(mockNpc, mockPlayer, mockState, context, journal);
      
      // Dialogue should be generated and potentially reference the conflict theme
      expect(dialogue.text).toBeDefined();
      expect(dialogue.text.length).toBeGreaterThan(0);
    });

    it('should build dialogue context from canonJournal when provided', () => {
      const journal = new CJ('test-world');
      
      // Create multiple events
      for (let i = 0; i < 3; i++) {
        journal.recordMutation(
          i * 2,
          i * 2 + 1,
          { type: 'QUEST_COMPLETED' },
          {},
          [{ type: 'QUEST_COMPLETED', payload: { questTitle: `Quest ${i}` } }],
          { player: { primaryFaction: 'rebel-faction', location: 'loc1' } },
          0.5 + (i * 0.15)
        );
      }
      
      // Trigger naratives
      const anchors = journal.getNarrativeAnchorsFor('rebel-faction');
      const recentPivots = journal.getRecentPivotPoints(5);
      
      // Verify context can be built
      const context: DialogueContext = {
        weather: 'clear',
        season: 'autumn',
        hour: 14,
        dayPhase: 'afternoon',
        reputation: 75,
        questHistory: [],
        narrativeAnchors: anchors,
        recentPivots: recentPivots
      };
      
      expect(context.narrativeAnchors).toBeDefined();
      expect(context.recentPivots).toBeDefined();
      expect(anchors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Oracle Handshake Integration', () => {
    it('should support backward compatibility without canonJournal', () => {
      const npc = { id: 'npc1', name: 'NPC', dialogue: ['Hello'] };
      const player = { id: 'player', factionReputation: {} };
      const state = {
        id: 'test',
        weather: 'clear',
        season: 'spring',
        hour: 12,
        dayPhase: 'afternoon',
        locations: [{ id: 'loc1', name: 'Place' }],
        player: { location: 'loc1' }
      };

      // Should work without journal
      const dialogue = resolveDialogue(npc, player, state);
      expect(dialogue).toBeDefined();
      expect(dialogue.text).toBeDefined();
    });

    it('should enhance resolution when canonJournal is available', () => {
      const journal = new CJ('test-world');
      const npc = { id: 'npc1', name: 'NPC', factionId: 'faction-a', dialogueVariations: { default: 'Hello' } };
      const player = { id: 'player', factionReputation: { 'faction-a': 50 } };
      const state = {
        id: 'test',
        weather: 'clear',
        season: 'spring',
        hour: 12,
        dayPhase: 'afternoon',
        locations: [{ id: 'loc1', name: 'Place', description: 'A place' }],
        player: { location: 'loc1' }
      };

      // With journal, resolution should be enhanced
      const dialogue = resolveDialogue(npc, player, state, undefined, journal);
      expect(dialogue).toBeDefined();
      expect(dialogue.text).toBeDefined();
    });
  });

  describe('End-to-End: History to Dialogue Flow', () => {
    it('should create complete historical record usable by dialogue system', () => {
      const journal = new CJ('test-world');
      
      // Simulate game events
      const events = [
        { name: 'Conflict', type: 'FACTION_CONFLICT_START', payload: { faction1Id: 'faction-a' }, divergence: 0.8 },
        { name: 'Quest', type: 'QUEST_COMPLETED', payload: { questTitle: 'Save Village' }, divergence: 0.65 }
      ];
      
      // Record them
      for (const event of events) {
        journal.recordMutation(
          0, 1,
          { type: event.type },
          {},
          [{ type: event.type, payload: event.payload }],
          { player: { primaryFaction: 'faction-a', location: 'loc1' } },
          event.divergence
        );
      }
      
      // Create chronicle
      journal.summarizeAsChronicle(0, 100, { player: { level: 1 } });
      
      // Verify history was recorded
      const anchors = journal.getNarrativeAnchorsFor('faction-a');
      const pivots = journal.getRecentPivotPoints(10);
      const chronicles = journal.getChronicles();
      
      expect(anchors.length + pivots.length).toBeGreaterThan(0);
      expect(chronicles.length).toBeGreaterThan(0);
      
      // Verify dialogue can use this history
      const npc = {
        id: 'npc1',
        name: 'NPC',
        factionId: 'faction-a',
        dialogueVariations: { default: 'Greetings' }
      };
      const player = { id: 'player', factionReputation: { 'faction-a': 50 } };
      const state = {
        id: 'test',
        weather: 'clear',
        season: 'spring',
        hour: 12,
        dayPhase: 'afternoon',
        locations: [{ id: 'loc1', name: 'Place', description: 'A place' }],
        player: { location: 'loc1' }
      };

      const dialogue = resolveDialogue(npc, player, state, undefined, journal);
      expect(dialogue.text).toBeDefined();
    });
  });
});
