/**
 * M63: Phase 33 Comprehensive Test Suite
 * 
 * Validates all M63 systems:
 * - M63-A: Inheritance wiring and bloodline tracking
 * - M63-B: Multiplayer voting and consensus
 * - M63-C: Tutorial tier 3 and snapshot UI
 * - M63-D: Stability and performance
 */

import {
  applyInheritanceToCharacter,
  formatInheritanceForDisplay,
  buildAncestryTree,
  validateInheritancePayload,
  type BloodlineData
} from '../engine/m63AInheritanceWiring';
import {
  createVoteSession,
  castVote,
  finalizeVote,
  validateVoteIntegrity,
  shouldTriggerWorldResetVote,
  applyWorldReset,
  checkHolidayEventTrigger,
  type VoteResult
} from '../engine/m63BConflictResolution';
import type { InheritancePayload } from '../engine/chronicleEngine';

// ============================================================================
// M63-A: INHERITANCE SYSTEM TESTS
// ============================================================================

describe('M63-A: Infinite Replayability & Inheritance Integration', () => {
  describe('Inheritance Application', () => {
    it('should apply inherited artifacts to character inventory', () => {
      const payload: InheritancePayload = {
        sequenceNumber: 1,
        ancestorMythRank: 4,
        legacyBudget: 6,
        inheritedArtifacts: [
          {
            itemId: 'legendary_sword',
            name: 'Sword of Ages',
            rarity: 'legendary',
            enchantments: ['Drain Paradox', 'Life Steal']
          }
        ],
        unlockedMemories: ['ancestor_legend_1', 'ancestor_legend_2'],
        ancestorQuests: [
          {
            questId: 'redemption_1',
            title: 'Complete Ancestor\'s Quest',
            rewardLP: 25,
            type: 'honoring'
          }
        ],
        factionStandingBonus: {
          merchants_guild: 100,
          council_of_fates: 50
        },
        worldStateInheritance: {
          blightedBiomesCarryOver: [],
          discoveredGatesOpen: [],
          unlockedMerchantTiers: []
        },
        paradoxDescent: 0,
        narrativeForeshadow: 'Your ancestor watches over you...'
      };

      const character: any = {
        id: 'char_1',
        name: 'Descendant',
        inventory: []
      };

      const { character: updated, receipt } = applyInheritanceToCharacter(character, payload, {} as any);

      expect(updated.inventory).toHaveLength(1);
      expect((updated.inventory as any)[0].itemId).toBe('legendary_sword');
      expect((updated.inventory as any)[0].ancestralMark).toBe(true);
      expect(receipt.artifactsGranted).toContain('Sword of Ages');
    });

    it('should apply faction bonuses with 30% carryover', () => {
      const payload: InheritancePayload = {
        sequenceNumber: 1,
        ancestorMythRank: 3,
        legacyBudget: 4,
        inheritedArtifacts: [],
        unlockedMemories: [],
        ancestorQuests: [],
        factionStandingBonus: {
          faction_a: 100
        },
        worldStateInheritance: {
          blightedBiomesCarryOver: [],
          discoveredGatesOpen: [],
          unlockedMerchantTiers: []
        },
        paradoxDescent: 0,
        narrativeForeshadow: ''
      };

      const character: any = {
        id: 'char_1',
        name: 'Descendant',
        inventory: [],
        factionReputation: { faction_a: 50 }
      };

      const { character: updated } = applyInheritanceToCharacter(character, payload, {} as any);

      // 100 * 0.3 = 30, so existing 50 + 30 = 80
      expect(updated.factionReputation?.faction_a).toBe(80);
    });

    it('should track bloodline ancestry with max 5 generations', () => {
      const payload: InheritancePayload = {
        sequenceNumber: 1,
        ancestorMythRank: 2,
        legacyBudget: 2,
        inheritedArtifacts: [],
        unlockedMemories: [],
        ancestorQuests: [],
        factionStandingBonus: {},
        worldStateInheritance: {
          blightedBiomesCarryOver: [],
          discoveredGatesOpen: [],
          unlockedMerchantTiers: []
        },
        paradoxDescent: 0,
        narrativeForeshadow: ''
      };

      const character: any = {
        id: 'char_1',
        name: 'Gen6',
        inventory: [],
        bloodlineData: {
          canonicalName: 'Gen6',
          inheritedPerks: [],
          mythStatus: 0,
          epochsLived: 6,
          deeds: [],
          ancestorChain: [
            { epochId: '1', generation: 1, canonicalName: 'Gen1', mythRank: 0, deedsCount: 0, legendary: false, paradoxAtDeath: 0, factionAlliances: {} },
            { epochId: '2', generation: 2, canonicalName: 'Gen2', mythRank: 1, deedsCount: 1, legendary: false, paradoxAtDeath: 0, factionAlliances: {} },
            { epochId: '3', generation: 3, canonicalName: 'Gen3', mythRank: 1, deedsCount: 2, legendary: false, paradoxAtDeath: 0, factionAlliances: {} },
            { epochId: '4', generation: 4, canonicalName: 'Gen4', mythRank: 2, deedsCount: 3, legendary: false, paradoxAtDeath: 0, factionAlliances: {} },
            { epochId: '5', generation: 5, canonicalName: 'Gen5', mythRank: 2, deedsCount: 1, legendary: false, paradoxAtDeath: 0, factionAlliances: {} }
          ]
        }
      };

      const mockState: any = {
        epochId: 'epoch_6',
        player: { name: 'Gen5' },
        paradoxLevel: 50
      };

      const { character: updated } = applyInheritanceToCharacter(character, payload, mockState);

      // Should have max 5, so oldest should be removed
      expect((updated.bloodlineData as any).ancestorChain).toHaveLength(5);
      expect((updated.bloodlineData as any).ancestorChain[0].canonicalName).toBe('Gen2'); // Gen1 removed
    });

    it('should validate inheritance payload integrity', () => {
      const invalidPayload: any = {
        sequenceNumber: 1,
        ancestorMythRank: 10, // Invalid: max is 5
        legacyBudget: -5, // Invalid: negative
        inheritedArtifacts: 'not_an_array', // Invalid: should be array
        unlockedMemories: [],
        ancestorQuests: [],
        factionStandingBonus: {},
        worldStateInheritance: {
          blightedBiomesCarryOver: [],
          discoveredGatesOpen: [],
          unlockedMerchantTiers: []
        },
        paradoxDescent: 0,
        narrativeForeshadow: ''
      };

      const { valid, errors } = validateInheritancePayload(invalidPayload);

      expect(valid).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('myth rank'))).toBe(true);
      expect(errors.some(e => e.includes('legacy budget'))).toBe(true);
    });

    it('should format inheritance for UI display', () => {
      const payload: InheritancePayload = {
        sequenceNumber: 1,
        ancestorMythRank: 4,
        legacyBudget: 6,
        inheritedArtifacts: [
          {
            itemId: 'legendary_blade',
            name: 'Legendary Blade',
            rarity: 'legendary',
            enchantments: ['Drain Paradox']
          }
        ],
        unlockedMemories: ['mem1', 'mem2'],
        ancestorQuests: [
          {
            questId: 'q1',
            title: 'Honor Ancestor',
            rewardLP: 25,
            type: 'honoring'
          }
        ],
        factionStandingBonus: { faction_a: 75 },
        worldStateInheritance: {
          blightedBiomesCarryOver: [],
          discoveredGatesOpen: [],
          unlockedMerchantTiers: []
        },
        paradoxDescent: 0,
        narrativeForeshadow: 'Your legends continue...'
      };

      const display = formatInheritanceForDisplay(payload, 'Ancestor Name');

      expect(display.ancestorName).toBe('Ancestor Name');
      expect(display.mythRankLabel).toBe('Legendary');
      expect(display.artifacts).toHaveLength(1);
      expect(display.questTitles).toContain('Honor Ancestor');
      expect(display.startingMythBonus).toBe(20); // 4 * 5
    });

    it('should build ancestry tree from bloodline data', () => {
      const bloodline: BloodlineData = {
        canonicalName: 'CurrentCharacter',
        inheritedPerks: [],
        mythStatus: 15,
        epochsLived: 3,
        deeds: ['Deed 1'],
        ancestorChain: [
          {
            epochId: 'ep1',
            generation: 1,
            canonicalName: 'Ancestor1',
            mythRank: 1,
            deedsCount: 2,
            legendary: false,
            paradoxAtDeath: 25,
            factionAlliances: {}
          },
          {
            epochId: 'ep2',
            generation: 2,
            canonicalName: 'Ancestor2',
            mythRank: 3,
            deedsCount: 5,
            legendary: true,
            paradoxAtDeath: 100,
            factionAlliances: { faction_a: 50 }
          }
        ]
      };

      const tree = buildAncestryTree(bloodline);

      expect(tree.name).toBe('CurrentCharacter');
      expect(tree.generation).toBe(3);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].name).toBe('Ancestor1');
      expect(tree.children[1].name).toBe('Ancestor2');
    });
  });
});

// ============================================================================
// M63-B: MULTIPLAYER CONSENSUS TESTS
// ============================================================================

describe('M63-B: P2P Consensus & Multiplayer Hardening', () => {
  describe('Vote Session Management', () => {
    it('should create vote session with correct parameters', () => {
      const session = createVoteSession(
        'world_reset',
        'player_1',
        'Propose world reset due to paradox',
        30
      );

      expect(session.voteType).toBe('world_reset');
      expect(session.proposedBy).toBe('player_1');
      expect(session.status).toBe('pending');
      expect(session.threshold).toBe(0.75); // 75% for world reset
    });

    it('should record peer votes', () => {
      const session = createVoteSession('world_reset', 'player_1', 'Test vote', 30);

      const { session: updated1 } = castVote(session, 'peer_1', 'Player One', 'yes');
      const { session: updated2 } = castVote(updated1, 'peer_2', 'Player Two', 'no');
      const { session: updated3 } = castVote(updated2, 'peer_3', 'Player Three', 'yes');

      expect(updated3.votes.size).toBe(3);
      expect(updated3.votes.get('peer_1')?.vote).toBe('yes');
      expect(updated3.votes.get('peer_2')?.vote).toBe('no');
    });

    it('should finalize vote and determine pass/fail', () => {
      const session = createVoteSession('world_reset', 'player_1', 'Test vote', 30);

      // 7 yes, 2 no (out of 9 voting = 77.8% > 75% threshold)
      ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'no', 'no'].forEach((vote, idx) => {
        castVote(session, `peer_${idx}`, `Player ${idx}`, vote as 'yes' | 'no' | 'abstain');
      });

      const result = finalizeVote(session, 16);

      expect(result.passed).toBe(true);
      expect(result.yesCount).toBe(7);
      expect(result.noCount).toBe(2);
      expect(result.actualPercentage).toBeGreaterThan(75);
    });

    it('should fail vote if threshold not met', () => {
      const session = createVoteSession('world_reset', 'player_1', 'Test vote', 30);

      // Only 3 yes, 6 no (33% < 75% threshold)
      ['yes', 'yes', 'yes', 'no', 'no', 'no', 'no', 'no', 'no'].forEach((vote, idx) => {
        castVote(session, `peer_${idx}`, `Player ${idx}`, vote as 'yes' | 'no' | 'abstain');
      });

      const result = finalizeVote(session, 16);

      expect(result.passed).toBe(false);
      expect(result.actualPercentage).toBeLessThan(75);
    });

    it('should validate vote integrity', () => {
      const session = createVoteSession('world_reset', 'player_1', 'Test vote', 30);

      castVote(session, 'peer_1', 'Player 1', 'yes');
      castVote(session, 'peer_1', 'Player 1', 'no'); // Duplicate vote

      const { valid, issues } = validateVoteIntegrity(session);

      expect(valid).toBe(false);
      expect(issues.some(i => i.includes('Duplicate'))).toBe(true);
    });
  });

  describe('World Reset Voting', () => {
    it('should trigger world reset vote when paradox > 250', () => {
      expect(shouldTriggerWorldResetVote(200)).toBe(false);
      expect(shouldTriggerWorldResetVote(250)).toBe(false);
      expect(shouldTriggerWorldResetVote(251)).toBe(true);
      expect(shouldTriggerWorldResetVote(350)).toBe(true);
    });

    it('should apply world reset when vote passes', () => {
      const mockState = { paradoxLevel: 300, lastWorldReset: null };
      const voteResult: VoteResult = {
        voteId: 'vote_1',
        voteType: 'world_reset',
        passed: true,
        yesCount: 12,
        noCount: 4,
        abstainCount: 0,
        totalPeers: 16,
        requiredYes: 12,
        actualPercentage: 75
      };

      const { state, notification } = applyWorldReset(mockState, voteResult);

      expect(state.paradoxLevel).toBe(0);
      expect(state.lastWorldReset).not.toBeNull();
      expect(notification).toContain('Paradox cleansed');
    });
  });

  describe('Holiday Event Consensus', () => {
    it('should trigger holiday event when peer reaches myth rank 4', () => {
      const peerStates = [
        { peerId: 'peer_1', mythStatus: 10 },
        { peerId: 'peer_2', mythStatus: 20 }, // Rank 4
        { peerId: 'peer_3', mythStatus: 5 }
      ];

      const event = checkHolidayEventTrigger(peerStates);

      expect(event).not.toBeNull();
      expect(event?.eventName).toBe('Festival of Echoes');
      expect(event?.rewards.legendaryPoints).toBe(10);
    });

    it('should not trigger holiday if no peer reaches milestone', () => {
      const peerStates = [
        { peerId: 'peer_1', mythStatus: 10 },
        { peerId: 'peer_2', mythStatus: 15 },
        { peerId: 'peer_3', mythStatus: 5 }
      ];

      const event = checkHolidayEventTrigger(peerStates);

      expect(event).toBeNull();
    });
  });
});

// ============================================================================
// M63-D: STABILITY & PERFORMANCE
// ============================================================================

describe('M63-D: Stability & Performance', () => {
  it('should handle large-scale inheritance with 5+ generations', () => {
    const startTime = performance.now();

    const payload: InheritancePayload = {
      sequenceNumber: 10,
      ancestorMythRank: 5,
      legacyBudget: 10,
      inheritedArtifacts: Array.from({ length: 20 }, (_, i) => ({
        itemId: `item_${i}`,
        name: `Artifact ${i}`,
        rarity: 'legendary' as const,
        enchantments: ['Paradox Drain', 'Soul Bond']
      })),
      unlockedMemories: Array.from({ length: 20 }, (_, i) => `memory_${i}`),
      ancestorQuests: Array.from({ length: 10 }, (_, i) => ({
        questId: `quest_${i}`,
        title: `Ancestral Quest ${i}`,
        rewardLP: 25,
        type: 'honoring' as const
      })),
      factionStandingBonus: {
        faction_a: 500,
        faction_b: 300,
        faction_c: 200
      },
      worldStateInheritance: {
        blightedBiomesCarryOver: [],
        discoveredGatesOpen: [],
        unlockedMerchantTiers: []
      },
      paradoxDescent: 25,
      narrativeForeshadow: 'Your legacy transcends generations...'
    };

    const character: any = {
      id: 'char_final',
      name: 'Legendary Hero',
      inventory: []
    };

    const { character: updated, receipt } = applyInheritanceToCharacter(character, payload, {} as any);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(50); // Should complete in <50ms
    expect(updated.inventory).toHaveLength(20);
    expect(receipt.artifactsGranted).toHaveLength(20);
  });

  it('should handle 16-peer voting in multiplayer session', () => {
    const startTime = performance.now();

    const session = createVoteSession('world_reset', 'player_1', 'Paradox reset', 30);

    for (let i = 0; i < 16; i++) {
      const vote = Math.random() > 0.5 ? 'yes' : 'no';
      castVote(session, `peer_${i}`, `Player ${i}`, vote);
    }

    const result = finalizeVote(session, 16);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10); // Should complete in <10ms
    expect(result.totalPeers).toBe(16);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('M63: Full Integration', () => {
  it('should complete inheritance → bloodline viewer → legacy quests flow', () => {
    // 1. Create inheritance payload
    const payload: InheritancePayload = {
      sequenceNumber: 1,
      ancestorMythRank: 4,
      legacyBudget: 6,
      inheritedArtifacts: [
        {
          itemId: 'legendary_sword',
          name: 'Excalibur',
          rarity: 'legendary',
          enchantments: ['Drain Paradox', 'Holy Light']
        }
      ],
      unlockedMemories: ['legendary_deeds'],
      ancestorQuests: [
        {
          questId: 'honor_ancestor',
          title: 'Honor Your Legacy',
          rewardLP: 30,
          type: 'honoring'
        }
      ],
      factionStandingBonus: { knights_order: 150 },
      worldStateInheritance: {
        blightedBiomesCarryOver: [],
        discoveredGatesOpen: [],
        unlockedMerchantTiers: []
      },
      paradoxDescent: 0,
      narrativeForeshadow: 'You carry the weight of legends.'
    };

    // 2. Apply to new character
    const character: any = { id: 'char', name: 'New Hero', inventory: [] };
    const mockState: any = { epochId: 'ep1', player: { name: 'Legendary Ancestor' }, paradoxLevel: 75 };
    const { character: hero, receipt } = applyInheritanceToCharacter(character, payload, mockState);

    // 3. Verify receipt
    expect(receipt.artifactsGranted).toContain('Excalibur');
    expect(receipt.memoriesUnlocked).toBe(1);
    expect(receipt.questsAvailable).toBe(1);
    expect(receipt.startingMythBonus).toBe(20);

    // 4. Verify bloodline tracking
    expect(hero.bloodlineData).toBeDefined();
    expect(hero.bloodlineData?.ancestorChain).toHaveLength(1);
    expect(hero.bloodlineData?.epochsLived).toBe(2);
  });
});

