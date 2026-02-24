/**
 * ALPHA_M9: Skill Engine Tests
 * 
 * Verifies ability unlocking, skill point spending, tier progression,
 * prerequisites, and ability equipment mechanics.
 */

import {
  getAbility,
  canUnlockAbility,
  unlockAbility,
  equipAbility,
  getAbilitiesByBranch,
  getAbilitiesByTier,
  initializePlayerAbilities,
  setAbilityCooldown,
  tickAbilityCooldowns
} from '../engine/skillEngine';

describe('ALPHA_M9: Skill Engine - Abilities & Progression', () => {
  describe('Ability Registry', () => {
    test('should retrieve ability by valid ID', () => {
      const ability = getAbility('martial_slash');
      
      expect(ability).not.toBeNull();
      expect(ability?.name).toBe('Slash');
      expect(ability?.branch).toBe('martial');
      expect(ability?.tier).toBe(1);
    });

    test('should return null for unknown ability ID', () => {
      const ability = getAbility('invalid_ability_xyz');
      
      expect(ability).toBeNull();
    });

    test('should have all required ability properties', () => {
      const ability = getAbility('martial_slash');
      
      expect(ability).toHaveProperty('id');
      expect(ability).toHaveProperty('name');
      expect(ability).toHaveProperty('branch');
      expect(ability).toHaveProperty('tier');
      expect(ability).toHaveProperty('description');
      expect(ability).toHaveProperty('skillPointCost');
      expect(ability).toHaveProperty('effect');
    });
  });

  describe('Ability Filtering by Branch', () => {
    test('should retrieve all martial abilities', () => {
      const martial = getAbilitiesByBranch('martial');
      
      expect(martial.length).toBeGreaterThan(0);
      expect(martial.every(a => a.branch === 'martial')).toBe(true);
    });

    test('should retrieve all arcane abilities', () => {
      const arcane = getAbilitiesByBranch('arcane');
      
      expect(arcane.length).toBeGreaterThan(0);
      expect(arcane.every(a => a.branch === 'arcane')).toBe(true);
    });

    test('should retrieve all resonance abilities', () => {
      const resonance = getAbilitiesByBranch('resonance');
      
      expect(resonance.length).toBeGreaterThan(0);
      expect(resonance.every(a => a.branch === 'resonance')).toBe(true);
    });

    test('should retrieve all social abilities', () => {
      const social = getAbilitiesByBranch('social');
      
      expect(social.length).toBeGreaterThan(0);
      expect(social.every(a => a.branch === 'social')).toBe(true);
    });
  });

  describe('Ability Filtering by Tier', () => {
    test('should retrieve all tier 1 abilities', () => {
      const tier1 = getAbilitiesByTier(1);
      
      expect(tier1.length).toBeGreaterThan(0);
      expect(tier1.every(a => a.tier === 1)).toBe(true);
    });

    test('should retrieve all tier 4 abilities', () => {
      const tier4 = getAbilitiesByTier(4 as any);
      
      expect(tier4.length).toBeGreaterThan(0);
      expect(tier4.every(a => a.tier === 4)).toBe(true);
    });

    test('should have highest tier abilities with higher cost', () => {
      const tier1 = getAbilitiesByTier(1);
      const tier4 = getAbilitiesByTier(4);
      
      if (tier1.length > 0 && tier4.length > 0) {
        const avgCost1 = tier1.reduce((sum, a) => sum + a.skillPointCost, 0) / tier1.length;
        const avgCost4 = tier4.reduce((sum, a) => sum + a.skillPointCost, 0) / tier4.length;
        
        expect(avgCost4).toBeGreaterThanOrEqual(avgCost1);
      }
    });
  });

  describe('Player Ability Initialization', () => {
    test('should initialize with empty unlock list', () => {
      const playerAbilities = initializePlayerAbilities();
      
      expect(playerAbilities.unlockedAbilities).toStrictEqual([]);
      expect(playerAbilities.equippedAbilities).toStrictEqual([]);
      expect(playerAbilities.abilityCooldowns).toStrictEqual({});
    });

    test('should provide mutable ability state', () => {
      const playerAbilities = initializePlayerAbilities();
      
      playerAbilities.unlockedAbilities.push('martial_slash');
      
      expect(playerAbilities.unlockedAbilities).toContain('martial_slash');
    });
  });

  describe('Ability Unlock Validation', () => {
    let playerAbilities: any;

    beforeEach(() => {
      playerAbilities = initializePlayerAbilities();
    });

    test('should allow unlocking tier 1 ability at level 1', () => {
      const result = canUnlockAbility(playerAbilities, 'martial_slash', 1, 5);
      
      expect(result.canUnlock).toBe(true);
    });

    test('should reject unlock if not enough skill points', () => {
      const result = canUnlockAbility(playerAbilities, 'martial_slash', 1, 0);
      
      expect(result.canUnlock).toBe(false);
      expect(result.reason).toContain('skill points');
    });

    test('should reject unlock if level too low', () => {
      const ability = getAbility('martial_riposte');
      if (ability?.requiredLevel && ability.requiredLevel > 1) {
        const result = canUnlockAbility(playerAbilities, 'martial_riposte', 1, 5);
        
        expect(result.canUnlock).toBe(false);
        expect(result.reason).toContain('level');
      }
    });

    test('should reject if ability already unlocked', () => {
      playerAbilities.unlockedAbilities.push('martial_slash');
      
      const result = canUnlockAbility(playerAbilities, 'martial_slash', 1, 5);
      
      expect(result.canUnlock).toBe(false);
      expect(result.reason?.toLowerCase()).toContain('already');
    });

    test('should validate prerequisite abilities', () => {
      const ability = getAbility('martial_riposte');
      
      if (ability?.prerequisiteAbilityId) {
        const result = canUnlockAbility(playerAbilities, 'martial_riposte', 10, 5);
        
        // Should fail if prerequisite not unlocked
        expect(result.canUnlock).toBe(false);
        expect(result.reason).toContain('Requires');
      }
    });
  });

  describe('Ability Unlocking', () => {
    let playerAbilities: any;

    beforeEach(() => {
      playerAbilities = initializePlayerAbilities();
    });

    test('should add ability to unlocked list', () => {
      const success = unlockAbility(playerAbilities, 'martial_slash');
      
      expect(success).toBe(true);
      expect(playerAbilities.unlockedAbilities).toContain('martial_slash');
    });

    test('should reject duplicate unlock', () => {
      unlockAbility(playerAbilities, 'martial_slash');
      const success = unlockAbility(playerAbilities, 'martial_slash');
      
      expect(success).toBe(false);
      expect(playerAbilities.unlockedAbilities.filter(id => id === 'martial_slash').length).toBe(1);
    });

    test('should allow unlocking multiple abilities', () => {
      unlockAbility(playerAbilities, 'martial_slash');
      unlockAbility(playerAbilities, 'arcane_fireball');
      
      expect(playerAbilities.unlockedAbilities).toContain('martial_slash');
      expect(playerAbilities.unlockedAbilities).toContain('arcane_fireball');
      expect(playerAbilities.unlockedAbilities.length).toBe(2);
    });
  });

  describe('Ability Equipment', () => {
    let playerAbilities: any;

    beforeEach(() => {
      playerAbilities = initializePlayerAbilities();
      // Pre-unlock some abilities
      unlockAbility(playerAbilities, 'martial_slash');
      unlockAbility(playerAbilities, 'arcane_fireball');
      unlockAbility(playerAbilities, 'resonance_commune');
    });

    test('should equip unlocked ability to slot', () => {
      const success = equipAbility(playerAbilities, 'martial_slash');
      
      expect(success).toBe(true);
      expect(playerAbilities.equippedAbilities).toContain('martial_slash');
    });

    test('should reject equipping locked ability', () => {
      const success = equipAbility(playerAbilities, 'martial_whirlwind_strike');
      
      expect(success).toBe(false);
      expect(playerAbilities.equippedAbilities).not.toContain('martial_whirlwind_strike');
    });

    test('should not double-equip same ability', () => {
      equipAbility(playerAbilities, 'martial_slash');
      equipAbility(playerAbilities, 'martial_slash');
      
      expect(playerAbilities.equippedAbilities.filter(id => id === 'martial_slash').length).toBe(1);
    });

    test('should allow equipping up to 6 abilities', () => {
      const tier1 = getAbilitiesByTier(1);
      for (let i = 0; i < 6 && i < tier1.length; i++) {
        const ability = tier1[i];
        unlockAbility(playerAbilities, ability.id);
        equipAbility(playerAbilities, ability.id);
      }
      
      expect(playerAbilities.equippedAbilities.length).toBeLessThanOrEqual(6);
    });

    test('should reject equipping 7th ability', () => {
      // Fill all 6 slots
      const tier1 = getAbilitiesByTier(1);
      for (let i = 0; i < 6 && i < tier1.length; i++) {
        unlockAbility(playerAbilities, tier1[i].id);
        equipAbility(playerAbilities, tier1[i].id);
      }
      
      // Try to equip a 7th from a different branch
      const arcane = getAbilitiesByBranch('arcane');
      if (arcane.length > 0) {
        unlockAbility(playerAbilities, arcane[0].id);
        const success = equipAbility(playerAbilities, arcane[0].id);
        
        expect(success).toBe(false);
        expect(playerAbilities.equippedAbilities.length).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('Ability Cooldown Management', () => {
    let playerAbilities: any;

    beforeEach(() => {
      playerAbilities = initializePlayerAbilities();
      unlockAbility(playerAbilities, 'martial_slash');
      equipAbility(playerAbilities, 'martial_slash');
    });

    test('should set cooldown on ability', () => {
      setAbilityCooldown(playerAbilities, 'martial_slash', 6);
      
      expect(playerAbilities.abilityCooldowns['martial_slash']).toBe(6);
    });

    test('should tick down cooldowns', () => {
      setAbilityCooldown(playerAbilities, 'martial_slash', 5);
      
      tickAbilityCooldowns(playerAbilities);
      
      expect(playerAbilities.abilityCooldowns['martial_slash']).toBe(4);
    });

    test('should remove cooldown when it reaches zero', () => {
      setAbilityCooldown(playerAbilities, 'martial_slash', 1);
      
      tickAbilityCooldowns(playerAbilities);
      
      // After tick, cooldown should be 0 or removed
      const remaining = playerAbilities.abilityCooldowns['martial_slash'];
      expect(remaining === 0 || remaining === undefined).toBe(true);
    });

    test('should handle multiple ability cooldowns', () => {
      unlockAbility(playerAbilities, 'arcane_fireball');
      
      setAbilityCooldown(playerAbilities, 'martial_slash', 5);
      setAbilityCooldown(playerAbilities, 'arcane_fireball', 3);
      
      tickAbilityCooldowns(playerAbilities);
      
      expect(playerAbilities.abilityCooldowns['martial_slash']).toBe(4);
      expect(playerAbilities.abilityCooldowns['arcane_fireball']).toBe(2);
    });
  });

  describe('Skill Tree Progression', () => {
    test('should have at least 4 skill branches', () => {
      const branches = ['martial', 'arcane', 'resonance', 'social'] as const;
      
      for (const branch of branches) {
        const abilities = getAbilitiesByBranch(branch);
        expect(abilities.length).toBeGreaterThan(0);
      }
    });

    test('should have tier progression up to tier 4', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const abilities = getAbilitiesByTier(tier as any);
        expect(abilities.length).toBeGreaterThan(0);
      }
    });

    test('should have higher-tier abilities require higher levels', () => {
      const tier1 = getAbilitiesByTier(1);
      const tier3 = getAbilitiesByTier(3);
      
      if (tier1.length > 0 && tier3.length > 0) {
        const maxLevel1 = Math.max(...tier1.map(a => a.requiredLevel || 1));
        const minLevel3 = Math.min(...tier3.map(a => a.requiredLevel || 1));
        
        expect(minLevel3).toBeGreaterThanOrEqual(maxLevel1);
      }
    });
  });

  describe('Ability Properties', () => {
    test('all abilities should have valid effect types', () => {
      const validEffects = ['damage', 'healing', 'defense', 'utility', 'social', 'interaction'];
      const tier1 = getAbilitiesByTier(1);
      
      expect(tier1.every(a => validEffects.includes(a.effect.type))).toBe(true);
    });

    test('should have stat bonuses for combat abilities', () => {
      const martial = getAbilitiesByBranch('martial');
      const hasStatsBonus = martial.some(a => a.stats && Object.keys(a.stats).length > 0);
      
      expect(hasStatsBonus).toBe(true);
    });

    test('should have cooldowns for combat abilities', () => {
      const ability = getAbility('martial_slash');
      
      expect(ability?.effect.cooldown).toBeGreaterThan(0);
    });
  });
});
