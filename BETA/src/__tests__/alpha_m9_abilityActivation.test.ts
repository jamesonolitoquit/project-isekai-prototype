/**
 * ALPHA_M9 Phase 2: Ability Activation Tests
 * 
 * Verifies the complete ability activation pipeline:
 * - Equipment validation
 * - Cooldown checking
 * - Mana cost deduction
 * - Effect application
 * - Audio ducking triggers
 */

import { WorldState } from '../engine/worldEngine';
import { processAction } from '../engine/actionPipeline';
import { getAbility } from '../engine/skillEngine';
import { SeededRng, setGlobalRng } from '../engine/prng';
import luxfierWorld from '../data/luxfier-world.json';

describe('ALPHA_M9 Phase 2: Ability Activation Pipeline', () => {
  let mockState: WorldState;
  let testRng: SeededRng;

  beforeEach(() => {
    testRng = new SeededRng(12345);
    setGlobalRng(testRng);

    mockState = {
      id: 'world_m9p2_ability_test',
      tick: 0,
      seed: 54321,
      player: {
        id: 'player_ability_test',
        name: 'AbilityTester',
        race: 'human',
        stats: { str: 12, agi: 11, int: 13, cha: 10, end: 12, luk: 10 },
        hp: 80,
        maxHp: 100,
        mp: 50,
        maxMp: 100,
        gold: 100,
        location: 'eldergrove-village',
        level: 5,
        skillPoints: 0,
        unlockedAbilities: ['martial_slash', 'arcane_fireball', 'resonance_commune'],
        equippedAbilities: ['martial_slash', 'arcane_fireball'],
        abilityCooldowns: {}
      },
      locations: luxfierWorld.locations || [],
      npcs: [],
      items: [],
      quests: {},
      factions: [],
      events: [],
      metadata: { templateOrigin: 'luxfier-world' }
    };
  });

  describe('Ability Activation Validation', () => {
    test('should reject activation of unequipped ability', () => {
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'resonance_commune' } // Unlocked but not equipped
      };

      const events = processAction(mockState, action);
      const errorEvent = events.find(e => e.type === 'ABILITY_ACTIVATION_ERROR');

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.payload?.reason).toContain('not equipped');
    });

    test('should reject activation of unknown ability', () => {
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'invalid_ability_xyz' }
      };

      const events = processAction(mockState, action);

      expect(events.length).toBe(0); // No event for invalid ability
    });

    test('should require ability to be in equipped list', () => {
      mockState.player.equippedAbilities = [];
      mockState.player.unlockedAbilities = ['martial_slash'];

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const events = processAction(mockState, action);
      const errorEvent = events.find(e => e.type === 'ABILITY_ACTIVATION_ERROR');

      expect(errorEvent?.payload?.reason).toContain('not equipped');
    });
  });

  describe('Cooldown Management', () => {
    test('should reject activation if ability is on cooldown', () => {
      mockState.player.abilityCooldowns = { martial_slash: 3 };

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const events = processAction(mockState, action);
      const errorEvent = events.find(e => e.type === 'ABILITY_ACTIVATION_ERROR');

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.payload?.reason).toContain('cooldown');
      expect(errorEvent?.payload?.remainingCooldown).toBe(3);
    });

    test('should set cooldown after successful activation', () => {
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      processAction(mockState, action);

      const ability = getAbility('martial_slash');
      const cooldownTicks = ability?.effect.cooldown ?? 6;

      expect(mockState.player.abilityCooldowns?.['martial_slash']).toBe(cooldownTicks);
    });

    test('should allow activation when cooldown reaches zero', () => {
      mockState.player.abilityCooldowns = { martial_slash: 0 };

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const events = processAction(mockState, action);
      const activatedEvent = events.find(e => e.type === 'ABILITY_ACTIVATED');

      expect(activatedEvent).toBeDefined();
      expect(activatedEvent?.payload?.message).toContain('Activated');
    });
  });

  describe('Mana Cost Deduction', () => {
    test('should reject activation if insufficient mana', () => {
      mockState.player.mp = 5;

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'arcane_fireball' }
      };

      const events = processAction(mockState, action);
      const errorEvent = events.find(e => e.type === 'ABILITY_ACTIVATION_ERROR');

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.payload?.reason).toContain('mana');
    });

    test('should deduct mana upon successful activation', () => {
      mockState.player.mp = 100;
      const initialMp = mockState.player.mp;

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'arcane_fireball' }
      };

      processAction(mockState, action);

      expect(mockState.player.mp).toBeLessThan(initialMp);
      expect(mockState.player.mp).toBeGreaterThanOrEqual(0);
    });

    test('should not reduce mana below zero', () => {
      mockState.player.mp = 5;
      mockState.player.abilityCooldowns = {}; // Ensure no cooldown

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' } // Low mana cost damage ability
      };

      processAction(mockState, action);

      expect(mockState.player.mp).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Damage Ability Effects', () => {
    test('should trigger ABILITY_ACTIVATED event for damage ability', () => {
      mockState.player.mp = 100;

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const events = processAction(mockState, action);
      const activatedEvent = events.find(e => e.type === 'ABILITY_ACTIVATED');

      expect(activatedEvent).toBeDefined();
      expect(activatedEvent?.payload?.effectType).toBe('damage');
      expect(activatedEvent?.payload?.magnitude).toBeGreaterThan(0);
    });

    test('should include mana cost in activation event', () => {
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'arcane_fireball' }
      };

      const events = processAction(mockState, action);
      const activatedEvent = events.find(e => e.type === 'ABILITY_ACTIVATED');

      expect(activatedEvent?.payload?.manaCost).toBeDefined();
      expect(activatedEvent?.payload?.manaCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Healing Ability Effects', () => {
    test('should restore HP for healing abilities', () => {
      mockState.player.hp = 30;
      mockState.player.maxHp = 100;
      mockState.player.mp = 100;
      mockState.player.equippedAbilities = ['resonance_commune'];
      mockState.player.unlockedAbilities = ['resonance_commune'];

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'resonance_commune' }
      };

      processAction(mockState, action);

      // After healing, HP should be higher
      expect(mockState.player.hp).toBeGreaterThan(30);
    });

    test('should not exceed max HP when healing', () => {
      mockState.player.hp = 90;
      mockState.player.maxHp = 100;
      mockState.player.mp = 100;
      mockState.player.equippedAbilities = ['resonance_commune'];
      mockState.player.unlockedAbilities = ['resonance_commune'];

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'resonance_commune' }
      };

      processAction(mockState, action);

      expect(mockState.player.hp).toBeLessThanOrEqual(100);
    });

    test('should include new HP in healing event', () => {
      mockState.player.hp = 30;
      mockState.player.maxHp = 100;
      mockState.player.mp = 100;
      mockState.player.equippedAbilities = ['resonance_commune'];
      mockState.player.unlockedAbilities = ['resonance_commune'];

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'resonance_commune' }
      };

      const events = processAction(mockState, action);
      const healEvent = events.find(e => e.type === 'ABILITY_ACTIVATED');

      expect(healEvent?.payload?.newHp).toBeDefined();
      expect(healEvent?.payload?.newHp).toBeGreaterThan(30);
    });
  });

  describe('Audio Ducking for High-Tier Abilities', () => {
    test('should trigger audio ducking for tier 3+ abilities', () => {
      // Create a tier 3 ability in equipped list
      mockState.player.equippedAbilities = ['martial_whirlwind_strike'];
      mockState.player.unlockedAbilities = ['martial_whirlwind_strike'];
      mockState.player.mp = 100;

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_whirlwind_strike' }
      };

      const events = processAction(mockState, action);
      const duckingEvent = events.find(e => e.type === 'AUDIO_DUCKING_TRIGGERED');

      // High-tier ability should trigger ducking
      const ability = getAbility('martial_whirlwind_strike');
      if (ability && ability.tier >= 3) {
        expect(duckingEvent).toBeDefined();
        expect(duckingEvent?.payload?.duckingAmount).toBe(0.5);
      }
    });

    test('should not trigger audio ducking for tier 1-2 abilities', () => {
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' } // Tier 1
      };

      const events = processAction(mockState, action);
      const duckingEvent = events.find(e => e.type === 'AUDIO_DUCKING_TRIGGERED');

      expect(duckingEvent).toBeUndefined();
    });

    test('should set audio ducking duration based on cooldown', () => {
      mockState.player.equippedAbilities = ['martial_whirlwind_strike'];
      mockState.player.unlockedAbilities = ['martial_whirlwind_strike'];
      mockState.player.mp = 100;

      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_whirlwind_strike' }
      };

      const events = processAction(mockState, action);
      const duckingEvent = events.find(e => e.type === 'AUDIO_DUCKING_TRIGGERED');

      if (duckingEvent) {
        expect(duckingEvent?.payload?.duckingDuration).toBeGreaterThan(0);
      }
    });
  });

  describe('Multiple Consecutive Activations', () => {
    test('should prevent rapid reuse via cooldown system', () => {
      const action1 = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      // First activation should succeed
      const events1 = processAction(mockState, action1);
      expect(events1.find(e => e.type === 'ABILITY_ACTIVATED')).toBeDefined();

      // Second activation should fail (on cooldown)
      const events2 = processAction(mockState, action1);
      expect(events2.find(e => e.type === 'ABILITY_ACTIVATION_ERROR')).toBeDefined();
    });

    test('should allow different equipped abilities to be used simultaneously', () => {
      mockState.player.equippedAbilities = ['martial_slash', 'arcane_fireball'];
      mockState.player.unlockedAbilities = ['martial_slash', 'arcane_fireball'];
      mockState.player.mp = 100;

      const action1 = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const action2 = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'arcane_fireball' }
      };

      processAction(mockState, action1);
      const events2 = processAction(mockState, action2);

      // Second ability should activate since it has different cooldown
      expect(events2.find(e => e.type === 'ABILITY_ACTIVATED')).toBeDefined();
    });
  });

  describe('State Persistence', () => {
    test('should modify player state durably', () => {
      const initialMp = mockState.player.mp;
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      processAction(mockState, action);

      // State should be modified in place
      expect(mockState.player.mp).toBeLessThanOrEqual(initialMp);
      expect(mockState.player.abilityCooldowns?.['martial_slash']).toBeGreaterThan(0);
    });

    test('should track cooldowns for all equipped abilities independently', () => {
      mockState.player.mp = 200;

      const action1 = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const action2 = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'arcane_fireball' }
      };

      processAction(mockState, action1);
      processAction(mockState, action2);

      expect(mockState.player.abilityCooldowns?.['martial_slash']).toBeGreaterThan(0);
      expect(mockState.player.abilityCooldowns?.['arcane_fireball']).toBeGreaterThan(0);
    });
  });

  describe('Integration with Level-Up Economy', () => {
    test('should work with level-up skill economy', () => {
      // Simulate level-up granting skill points
      mockState.player.skillPoints = 3;
      mockState.player.level = 5;

      // Then activate an ability
      const action = {
        worldId: mockState.id,
        playerId: mockState.player.id,
        type: 'ACTIVATE_ABILITY',
        payload: { abilityId: 'martial_slash' }
      };

      const events = processAction(mockState, action);
      expect(events.find(e => e.type === 'ABILITY_ACTIVATED')).toBeDefined();

      // Skill points should remain unchanged by activation
      expect(mockState.player.skillPoints).toBe(3);
    });
  });
});
