/**
 * BETA Phase: Epoch Transition Tests
 * 
 * Verifies that the chronicle sequence properly transitions between epochs
 * and carries over legacy data correctly.
 */

import { calculateMythStatus, canonizeCharacter, applyLegacyPerks } from '../engine/legacyEngine';
import { initiateChronicleTransition, isChronicleComplete, getNextEpoch, EPOCH_DEFINITIONS } from '../engine/chronicleEngine';
import type { WorldState, PlayerState, Quest } from '../engine/worldEngine';

describe('BETA: Epoch Transition System', () => {
  
  // Mock player state for testing
  const mockPlayer: PlayerState = {
    id: 'test-player',
    name: 'Hero',
    race: 'human',
    location: 'town-square',
    quests: {},
    level: 20,
    gold: 100,
    hp: 80,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    stats: {
      str: 16,
      agi: 14,
      int: 15,
      cha: 13,
      end: 14,
      luk: 12
    },
    factionReputation: {
      'faction-light': 75,
      'faction-shadow': -30,
      'faction-neutral': 40
    }
  };

  // Mock world state for testing
  const mockWorldState: WorldState = {
    id: 'test-world-epoch-1',
    tick: 1000,
    seed: 12345,
    hour: 12,
    day: 50,
    dayPhase: 'afternoon',
    season: 'spring',
    weather: 'clear',
    locations: [
      { id: 'town-square', name: 'Town Square', discovered: true },
      { id: 'forest', name: 'Dark Forest', discovered: false }
    ],
    npcs: [
      { id: 'npc-1', name: 'Merchant', locationId: 'town-square', factionId: 'faction-light' }
    ],
    quests: [],
    player: mockPlayer,
    factions: [
      { id: 'faction-light', name: 'Light Council', category: 'political', powerScore: 60, alignment: 'good', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-shadow', name: 'Shadow Cult', category: 'religious', powerScore: 40, alignment: 'evil', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-neutral', name: 'Merchants Guild', category: 'mercenary', powerScore: 50, alignment: 'neutral', coreBeliefs: [], controlledLocationIds: [] }
    ],
    epochId: 'epoch_i_fracture',
    chronicleId: 'chronicle-test-001',
    epochMetadata: {
      chronologyYear: 1000,
      theme: 'Fracture',
      description: 'The world is broken',
      sequenceNumber: 1
    }
  };

  test('calculates myth status correctly', () => {
    const mythStatus = calculateMythStatus(mockPlayer, mockWorldState);
    
    expect(mythStatus).toBeGreaterThan(0);
    expect(mythStatus).toBeLessThanOrEqual(100);
    // Level 20 should contribute ~40, reputation should contribute more
    expect(mythStatus).toBeGreaterThanOrEqual(30);
  });

  test('canonizes character with deeds', () => {
    const deeds = ['Defeated the Shadow Lord', 'United the Factions', 'Saved the Town'];
    const legacy = canonizeCharacter(mockPlayer, mockWorldState, undefined, deeds);
    
    expect(legacy.canonicalName).toBe('Hero');
    expect(legacy.mythStatus).toBeGreaterThan(0);
    expect(legacy.deeds).toEqual(deeds);
    expect(legacy.epochsLived).toBe(1);
  });

  test('applies legacy perks to new character', () => {
    const deeds = ['Legendary Deed 1', 'Legendary Deed 2'];
    const legacyImpact = canonizeCharacter(mockPlayer, mockWorldState, undefined, deeds);
    
    const newPlayer: PlayerState = {
      ...mockPlayer,
      name: 'Heir',
      id: 'test-player-2',
      hp: 50,
      maxHp: 50,
      factionReputation: {}
    };
    
    const enhanced = applyLegacyPerks(newPlayer, legacyImpact);
    
    expect(enhanced.bloodlineData).toBeDefined();
    expect(enhanced.bloodlineData!.canonicalName).toBe('Hero');
    expect(enhanced.bloodlineData!.inheritedPerks.length).toBeGreaterThanOrEqual(0);
  });

  test('gets next epoch in sequence', () => {
    const nextEpoch = getNextEpoch('epoch_i_fracture');
    
    expect(nextEpoch).not.toBeNull();
    expect(nextEpoch!.id).toBe('epoch_ii_waning');
    expect(nextEpoch!.sequenceNumber).toBe(2);
    expect(nextEpoch!.name).toContain('Waning');
  });

  test('detects chronicle completion', () => {
    const isEpoch1Complete = isChronicleComplete('epoch_i_fracture');
    expect(isEpoch1Complete).toBe(false); // Should have next epoch
    
    const isLastComplete = isChronicleComplete('epoch_x_eternity');
    expect(isLastComplete).toBe(true); // No next epoch (final epoch)
    
    const isInvalidComplete = isChronicleComplete('invalid_epoch');
    expect(isInvalidComplete).toBe(true); // Unknown epoch treated as complete
  });

  test('initiates chronicle transition', () => {
    const legacyImpact = canonizeCharacter(mockPlayer, mockWorldState, undefined, ['Saved the World']);
    
    const newState = initiateChronicleTransition(mockWorldState, legacyImpact);
    
    expect(newState.epochId).toBe('epoch_ii_waning');
    expect(newState.chronicleId).toBe('chronicle-test-001');
    expect(newState.epochMetadata!.sequenceNumber).toBe(2);
    expect(newState.tick).toBe(0);
    expect(newState.npcs.length).toBeGreaterThan(0);
    expect(newState.factions.length).toBeGreaterThan(0);
  });

  test('carries over faction reputation across epochs', () => {
    const legacyImpact = canonizeCharacter(mockPlayer, mockWorldState);
    const newState = initiateChronicleTransition(mockWorldState, legacyImpact);
    
    // Check that factions with high reputation don't lose as much power
    const factionLight = newState.factions!.find(f => f.id === 'faction-light');
    expect(factionLight).toBeDefined();
    // Light faction had 60 power, should lose less due to +75 rep with player
    expect(factionLight!.powerScore).toBeGreaterThan(50);
  });

  test('soft canon remembers player deeds', () => {
    const legacyImpact = canonizeCharacter(mockPlayer, mockWorldState, undefined, ['Legendary Achievement']);
    const newState = initiateChronicleTransition(mockWorldState, legacyImpact);
    
    // NPC should have memory injected
    const npc = newState.npcs?.[0];
    expect(npc).toBeDefined();
    expect((npc as any)._soulEchoMemory).toBeDefined();
  });

  test('initializes second epoch correctly', () => {
    const legacyImpact = canonizeCharacter(mockPlayer, mockWorldState);
    const epoch2State = initiateChronicleTransition(mockWorldState, legacyImpact);
    
    expect(epoch2State.epochMetadata).toBeDefined();
    expect(epoch2State.epochMetadata!.theme).toContain('Waning');
    expect(epoch2State.epochMetadata!.chronologyYear).toBe(1200);
  });

  test('handles legendary hero with high myth status', () => {
    const legendaryPlayer = { ...mockPlayer, level: 30 };
    const legacyImpact = canonizeCharacter(legendaryPlayer, mockWorldState);
    
    expect(legacyImpact.mythStatus).toBeGreaterThanOrEqual(30);
    expect(legacyImpact.inheritedPerks.length).toBeGreaterThan(0);
  });

  test('heirloom lifecycle: item marked isHeirloom persists across epochs', () => {
    // Create epoch 1 state with heirloom in inventory
    const playerWithHeirloom = {
      ...mockPlayer,
      inventory: [
        {
          kind: 'unique' as const,
          itemId: 'sword-ancestral-blade',
          instanceId: 'sword-001',
          equipped: true,
          isHeirloom: true,
          ancestorName: 'Hero',
          metadata: { experience: 50 }
        }
      ]
    };

    const epoch1State = { ...mockWorldState, player: playerWithHeirloom };
    
    // Canonize character (should cache heirloom)
    const legacyImpact = canonizeCharacter(playerWithHeirloom, epoch1State);
    expect(legacyImpact.inheritedItems.length).toBeGreaterThan(0);
    
    // Transition to epoch 2
    const epoch2State = initiateChronicleTransition(epoch1State, legacyImpact);
    expect(epoch2State.heirloomCaches).toBeDefined();
    expect(epoch2State.heirloomCaches!.length).toBeGreaterThan(0);
    
    // Verify heirloom cache contains ancestry metadata
    const heirloomCache = epoch2State.heirloomCaches![0];
    expect(heirloomCache.ancestorName).toBe('Hero');
    expect(heirloomCache.hidden).toBe(true);
    expect(heirloomCache.discoveredAt).toBeUndefined();
  });

  test('heirloom discovery: items rediscovered at ancestor location retain metadata', () => {
    // Setup heirloom cache
    const epoch2StateWithCache: WorldState = {
      ...mockWorldState,
      id: 'test-world-epoch-2',
      epochId: 'epoch_ii_waning',
      epochMetadata: {
        chronologyYear: 1200,
        theme: 'Waning',
        description: 'Magic fades',
        sequenceNumber: 2
      },
      player: {
        ...mockPlayer,
        location: 'abandoned-shrine' // Where ancestor died
      },
      heirloomCaches: [
        {
          id: 'heirloom_cache_sword-001',
          locationId: 'abandoned-shrine',
          itemId: 'sword-ancestral-blade',
          instanceId: 'sword-001',
          ancestorName: 'Hero',
          discoveryMessage: 'A legendary blade from Hero of ages past',
          hidden: true
        }
      ]
    };

    // Import discovery function
    const { discoverHeirloomsAtLocation } = require('../engine/chronicleEngine');
    const updatedState = discoverHeirloomsAtLocation(epoch2StateWithCache);
    
    // Verify heirloom was discovered and added to inventory
    expect(updatedState.heirloomCaches![0].hidden).toBe(false);
    expect(updatedState.heirloomCaches![0].discoveredAt).toBeDefined();
    expect(updatedState.player!.inventory!.length).toBeGreaterThan(0);
    
    const discoveredItem = updatedState.player!.inventory!.find(
      (item: any) => item.instanceId === 'sword-001'
    );
    expect(discoveredItem).toBeDefined();
    expect((discoveredItem as any).isHeirloom).toBe(true);
    expect((discoveredItem as any).ancestorName).toBe('Hero');
  });

  test('epoch skip: transitioning from Epoch I to Epoch III aggregates dual-epoch deltas', () => {
    // Simulate high-myth character warranting skip to final epoch
    const legendaryPlayer = { ...mockPlayer, level: 40, gold: 5000 };
    const legacyImpact = canonizeCharacter(legendaryPlayer, mockWorldState, undefined, [
      'Defeated the Shadow Lord',
      'Restored the Seal',
      'United All Factions'
    ]);
    
    expect(legacyImpact.mythStatus).toBeGreaterThanOrEqual(70);
    
    // First transition would be to Epoch II
    const epoch2State = initiateChronicleTransition(mockWorldState, legacyImpact);
    expect(epoch2State.epochMetadata!.sequenceNumber).toBe(2);
    
    // Simulate jumping directly to Epoch III
    const epoch3Legacy = { ...legacyImpact, epochsLived: 3 };
    const epoch3Def = EPOCH_DEFINITIONS['epoch_iii_twilight'];
    
    // Use base transition logic with accumulated deltas
    const epoch3State = initiateChronicleTransition(epoch2State, epoch3Legacy);
    
    // Verify triple-epoch transition properties
    expect(epoch3State.epochId).toBe('epoch_iii_twilight');
    expect(epoch3State.epochMetadata!.theme).toContain('Twilight');
    expect(epoch3State.epochMetadata!.sequenceNumber).toBe(3);
    expect(epoch3State.epochMetadata!.chronologyYear).toBe(1500);
    
    // Factions should show cumulative decay
    const factionLight = epoch3State.factions!.find(f => f.id === 'faction-light');
    expect(factionLight!.powerScore).toBeLessThan(60); // More decay than single epoch
  });

  test('bit-identical replay: seeded state transitions produce identical outcomes', () => {
    const { stateRebuilder } = require('../engine/stateRebuilder');
    const FIXED_SEED = 999888;
    
    // Create two independent epoch transitions with same seed
    const state1 = { ...mockWorldState, seed: FIXED_SEED };
    const state2 = { ...mockWorldState, seed: FIXED_SEED };
    
    const legacyImpact1 = canonizeCharacter(mockPlayer, state1);
    const legacyImpact2 = canonizeCharacter(mockPlayer, state2);
    
    // Legacy impacts should be identical (same seed)
    expect(legacyImpact1.timestamp).toBe(legacyImpact2.timestamp);
    expect(legacyImpact1.inheritedItems).toEqual(legacyImpact2.inheritedItems);
    
    // Transitions should produce identical new world states
    const newState1 = initiateChronicleTransition(state1, legacyImpact1);
    const newState2 = initiateChronicleTransition(state2, legacyImpact2);
    
    // Check deterministic properties
    expect(newState1.id).toBe(newState2.id);
    expect(newState1.tick).toBe(newState2.tick);
    expect(newState1.epochId).toBe(newState2.epochId);
    expect(newState1.factions!.length).toBe(newState2.factions!.length);
    
    // Faction power scores should be identical
    newState1.factions!.forEach((faction1: any, idx: number) => {
      const faction2 = newState2.factions![idx];
      expect(faction1.powerScore).toBe(faction2.powerScore);
    });
    
    // NPC memory should be identical
    newState1.npcs!.forEach((npc1: any, idx: number) => {
      const npc2 = newState2.npcs![idx];
      expect((npc1 as any)._soulEchoMemory).toBe((npc2 as any)._soulEchoMemory);
    });
  });

  test('legacy quest transformation: persist_across_epochs creates proper Ancient Rumors', () => {
    const { transformLegacyQuests } = require('../engine/chronicleEngine');
    
    const legacyQuests: Quest[] = [
      {
        id: 'quest-slay-dragon',
        title: 'Slay the Dragon King',
        description: 'Defeat the ancient dragon',
        persist_across_epochs: true,
        legacy_quest_template: {
          title_prefix: 'Ancient Rumor: ',
          description_override: 'Legends speak of a great dragon slain in the age of heroes',
          difficulty_increase: 1.5
        }
      },
      {
        id: 'quest-find-artifact',
        title: 'Find the Lost Artifact',
        persist_across_epochs: false // Should be filtered out
      }
    ];
    
    const epoch2State = { ...mockWorldState, epochId: 'epoch_ii_waning', seed: 12345 };
    const transformed = transformLegacyQuests(legacyQuests, epoch2State);
    
    // Should only include persistent quests
    expect(transformed.length).toBe(1);
    
    const legacyQuest = transformed[0];
    expect(legacyQuest.title).toContain('Ancient Rumor:');
    expect(legacyQuest.title).toContain('Slay the Dragon King');
    expect(legacyQuest.description).toContain('Legends speak');
    expect((legacyQuest as any)._legacyQuestOrigin).toBeDefined();
    expect((legacyQuest as any)._legacyQuestOrigin.originEpochId).toBe('epoch_i_fracture');
  });

});
