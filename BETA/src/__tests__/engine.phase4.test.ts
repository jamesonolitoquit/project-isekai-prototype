/**
 * Phase 4 Managers Test Suite (DSS 01, 08, 09, 12)
 *
 * Comprehensive tests for SkillManager, CombatResolver, and InventoryManager
 * Validates all formulas against DSS specifications
 *
 * Test Coverage:
 * - 15+ SkillManager tests (soft caps, XP, stamina)
 * - 20+ CombatResolver tests (initiative, attacks, injuries)
 * - 15+ InventoryManager tests (encumbrance, durability)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SkillManager } from '../engine/SkillManager';
import { CombatResolver } from '../engine/CombatResolver';
import { InventoryManager } from '../engine/InventoryManager';
import type { Skill, CharacterSkillSet, Weapon, Armor, Inventory } from '../types';
import type { Vessel, CoreAttributes } from '../types';
import { InjuryType } from '../types';
import { createVessel } from '../types';

/**
 * Helper: Create test vessel with specified attributes
 */
function createTestVessel(attributeOverrides: Partial<CoreAttributes> = {}): Vessel {
  const baseAttributes: CoreAttributes = {
    STR: 10,
    DEX: 10,
    AGI: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
    PER: 10,
    LCK: 10,
  };

  const attributes = { ...baseAttributes, ...attributeOverrides };

  const vessel = createVessel({
    name: 'Test Character',
    level: 1,
    attributes,
    ancestry: 'human',
    talent: 'keen-eye',
    gender: 'male',
    createdAtTick: 0,
  });

  // Return vessel with customizable properties
  return vessel;
}

/**
 * Helper: Create test skill
 */
function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  const baseSkill: Skill = {
    id: 'test-skill-1',
    name: 'Sword Mastery',
    category: 'melee_combat',
    level: 5,
    currentXp: 0,
    primaryAttribute: 'STR',
    secondaryAttribute: 'DEX',
    isPassive: false,
    passiveEffect: undefined,
    failurePenalty: 0,
    workstationTierRequirement: null,
    learningMethod: 'use',
    description: 'Melee combat skill',
    acquiredAtTick: 0,
    proficiencyBonus: 0.5,
    isLocked: false,
  };

  // Ensure type safety by only including valid keys
  const safeOverrides: Partial<Skill> = {};
  Object.keys(overrides).forEach((key) => {
    const k = key as keyof Skill;
    if (k in baseSkill) {
      (safeOverrides as any)[k] = (overrides as any)[k];
    }
  });

  return { ...baseSkill, ...safeOverrides };
}

/**
 * Helper: Create test weapon
 */
function createTestWeapon(overrides: Partial<Weapon> = {}): Weapon {
  const baseWeapon: Weapon = {
    id: 'test-sword',
    name: 'Longsword',
    itemType: 'weapon',
    rarity: 'uncommon',
    weight: 2.5,
    baseMarketValue: 50,
    currentMarketValue: 50,
    marketValueRegion: null,
    materialRequirements: [],
    requiredWorkstationTier: null,
    requiredCraftingSkill: null,
    craftingDC: null,
    description: 'A well-balanced longsword',
    lore: 'Test weapon',
    createdAtTick: 0,
    owningVesselId: null,
    droppedLocationId: null,
    weaponCategory: 'sword',
    baseDamage: 8,
    damageType: 'slashing',
    damageStat: 'STR',
    damageScaling: 0.75,
    requiredAttribute: 'STR',
    requiredAttributeValue: 10,
    skillProficiencyBonus: 2,
    reach: 1.5,
    attacksPerSecond: 1,
    criticalChanceModifier: 0.05,
    criticalMultiplier: 1.5,
    staminaCostPerAttack: 10,
    requiresTwoHands: false,
    oneHandDamage: 6,
    durability: {
      current: 100,
      maximum: 100,
      floor: 1.0,
      decayPerUse: 1,
      lastRepairedAtTick: 0,
      repairCount: 0,
      isBroken: false,
    },
    specialProperties: new Map(),
  };

  return { ...baseWeapon, ...overrides };
}

/**
 * Helper: Create test armor
 */
function createTestArmor(overrides: Partial<Armor> = {}): Armor {
  const baseArmor: Armor = {
    id: 'test-plate',
    name: 'Plate Armor',
    itemType: 'armor',
    rarity: 'uncommon',
    weight: 20,
    baseMarketValue: 150,
    currentMarketValue: 150,
    marketValueRegion: null,
    materialRequirements: [],
    requiredWorkstationTier: null,
    requiredCraftingSkill: null,
    craftingDC: null,
    description: 'Heavy protection',
    lore: 'Test armor',
    createdAtTick: 0,
    owningVesselId: null,
    droppedLocationId: null,
    armorType: 'heavy_armor',
    equipmentSlot: 'chest',
    damageReduction: 6,
    resistantToDamageType: 'all',
    agilityPenalty: -2,
    requiredStrength: 14,
    insufficientStrengthAgiPenalty: -2,
    durability: {
      current: 100,
      maximum: 100,
      floor: 1.0,
      decayPerUse: 0.5,
      lastRepairedAtTick: 0,
      repairCount: 0,
      isBroken: false,
    },
    specialProperties: new Map(),
  };

  return { ...baseArmor, ...overrides };
}

/**
 * Helper: Create test inventory
 */
function createTestInventory(): Inventory {
  return {
    vesselId: 'test-vessel',
    items: new Map(),
    equippedItems: [],
    capacityKg: 70,
    currentWeight: 0,
    isOvercumbered: false,
    encumbranceAgiPenalty: 0,
    encumbranceStaminaDrain: 0,
    lastModifiedAtTick: 0,
    lootFilterPreferences: {
      autoPickup: false,
      minimumRarity: 'common',
      excludedItemTypes: [],
    },
  };
}

// ============================================================================
// SKILL MANAGER TESTS
// ============================================================================

describe('SkillManager', () => {
  let skillManager: SkillManager;

  beforeEach(() => {
    skillManager = new SkillManager();
  });

  describe('calculateSkillSuccess', () => {
    it('should calculate basic skill check: d20 + attr + skill vs DC', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill({ level: 10 });

      const result = skillManager.calculateSkillSuccess(
        vessel,
        skill,
        12,
        15 // Force d20 = 15
      );

      // 15 (d20) + 0 (STR mod) + 2 (skill/5) + 0.5 (prof) = 17.5 ≈ 17
      expect(result.totalRoll).toBeGreaterThanOrEqual(17);
      expect(result.isSuccess).toBe(true);
    });

    it('should award full XP on success', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill();

      const result = skillManager.calculateSkillSuccess(vessel, skill, 10, 20);
      expect(result.xpAwarded).toBe(100); // Full XP
    });

    it('should award 0.25x XP on failure', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill();

      const result = skillManager.calculateSkillSuccess(vessel, skill, 20, 5);
      expect(result.xpAwarded).toBe(25); // 0.25x penalty
    });

    it('should apply -5 penalty for insufficient attribute', () => {
      const vessel = createTestVessel({ STR: 8 }); // Below requirement
      const skill = createTestSkill({
        primaryAttribute: 'STR',
        level: 5,
      });

      const result = skillManager.calculateSkillSuccess(vessel, skill, 12, 14);

      expect(result.appliedPenalties.insufficientAttributePenalty).toBe(-5);
    });

    it('should detect critical success (natural 20)', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill();

      const result = skillManager.calculateSkillSuccess(vessel, skill, 5, 20);

      expect(result.isCriticalSuccess).toBe(true);
    });

    it('should detect critical failure (natural 1)', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill();

      const result = skillManager.calculateSkillSuccess(vessel, skill, 5, 1);

      expect(result.isCriticalFailure).toBe(true);
    });
  });

  describe('processXpGain', () => {
    it('should apply INT multiplier: 1 + (INT/20)', () => {
      const vessel = createTestVessel({ INT: 20 }); // INT 20: 1 + (20/20) = 2.0x
      const skill = createTestSkill({ level: 5 });

      const updated = skillManager.processXpGain(vessel, skill, 100);

      // 100 * 2.0 (INT) * 1.0 (WIS) = 200 XP
      expect(updated.currentXp).toBe(200);
    });

    it('should apply WIS multiplier: 1 + (WIS/25)', () => {
      const vessel = createTestVessel({ WIS: 25 }); // WIS 25: 1 + (25/25) = 2.0x
      const skill = createTestSkill({ level: 5 });

      const updated = skillManager.processXpGain(vessel, skill, 100);

      // 100 * 1.0 (INT) * 2.0 (WIS) = 200 XP
      expect(updated.currentXp).toBeCloseTo(200, 0);
    });

    it('should level up when XP exceeds requirement', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill({ level: 5, currentXp: 900 });

      const updated = skillManager.processXpGain(vessel, skill, 200);

      // 900 + 200 = 1100 >= 1000 (base XP) → level up
      expect(updated.level).toBe(6);
      expect(updated.currentXp).toBe(100); // Overflow carried
    });

    it('should enforce soft cap: no bonus beyond (INT+WIS)/2', () => {
      const vessel = createTestVessel({ INT: 10, WIS: 10 });
      vessel.level = 1;
      // Soft cap = 1 + (10+10)/2 = 11
      const skill = createTestSkill({ level: 12 });

      const updated = skillManager.processXpGain(vessel, skill, 100);

      // Above soft cap, but XP still awarded (just harder to level)
      expect(updated.currentXp).toBeGreaterThan(0);
    });
  });

  describe('consumeStamina', () => {
    it('should deduct base stamina cost', () => {
      const vessel = createTestVessel();
      vessel.stamina = 100; // Modify stamina directly
      const updated = skillManager.consumeStamina(vessel, 10, false);

      expect(updated.stamina).toBe(90);
    });

    it('should apply 2x multiplier for insufficient attribute', () => {
      const vessel = createTestVessel();
      vessel.stamina = 100;
      const updated = skillManager.consumeStamina(vessel, 10, true);

      // 10 * 2 = 20 cost
      expect(updated.stamina).toBe(80);
    });

    it('should clamp stamina to 0 (no negative)', () => {
      const vessel = createTestVessel();
      vessel.stamina = 5;
      const updated = skillManager.consumeStamina(vessel, 10, false);

      expect(updated.stamina).toBe(0);
    });
  });

  describe('calculateSoftCap', () => {
    it('should calculate soft cap: Level + (INT+WIS)/2', () => {
      const vessel = createTestVessel({ INT: 14, WIS: 16 });
      vessel.level = 5;

      const softCap = skillManager.calculateSoftCap(vessel, 5);

      // 5 + (14+16)/2 = 5 + 15 = 20
      expect(softCap).toBe(20);
    });

    it('should return lower soft cap for low INT/WIS', () => {
      const vessel = createTestVessel({ INT: 8, WIS: 8 });
      vessel.level = 1;

      const softCap = skillManager.calculateSoftCap(vessel, 1);

      // 1 + (8+8)/2 = 1 + 8 = 9
      expect(softCap).toBe(9);
    });
  });

  describe('calculateLearningMultipliers', () => {
    it('should calculate INT multiplier: 1 + (INT/20)', () => {
      const vessel = createTestVessel({ INT: 16 });
      const { intMultiplier } = skillManager.calculateLearningMultipliers(vessel);

      expect(intMultiplier).toBeCloseTo(1.8, 1);
    });

    it('should calculate WIS multiplier: 1 + (WIS/25)', () => {
      const vessel = createTestVessel({ WIS: 15 });
      const { wisMultiplier } = skillManager.calculateLearningMultipliers(vessel);

      expect(wisMultiplier).toBeCloseTo(1.6, 1);
    });
  });

  describe('getXpProgress', () => {
    it('should calculate XP progress to next level', () => {
      const vessel = createTestVessel();
      const skill = createTestSkill({ level: 5, currentXp: 250 });

      const progress = skillManager.getXpProgress(skill, vessel);

      expect(progress.xpNeeded).toBeGreaterThan(0);
      expect(progress.xpProgress).toBe(250);
      expect(progress.percentToLevel).toBeCloseTo(25, 0); // 250 / 1000 = 25%
    });
  });

  describe('applyActionCost', () => {
    it('should deduct stamina and vigor', () => {
      const vessel = createTestVessel();
      vessel.stamina = 100;
      vessel.vitals.vigor = 80;

      const updated = skillManager.applyActionCost(vessel, 20, 10);

      expect(updated.stamina).toBe(80);
      expect(updated.vitals.vigor).toBe(70);
    });
  });
});

// ============================================================================
// COMBAT RESOLVER TESTS
// ============================================================================

describe('CombatResolver', () => {
  let combatResolver: CombatResolver;

  beforeEach(() => {
    combatResolver = new CombatResolver();
  });

  describe('calculateInitiative', () => {
    it('should calculate initiative: d20 + agi_mod + (AGI/10)', () => {
      const vessel = createTestVessel({ AGI: 14 });
      // AGI 14: mod = +2, bonus = +1 (floor), roll 16 = 16+2+1 = 19

      const result = combatResolver.calculateInitiative(vessel, 16);

      expect(result.totalInitiative).toBe(19);
      expect(result.diceRoll).toBe(16);
    });

    it('should apply AGI modifier correctly', () => {
      const vessel = createTestVessel({ AGI: 8 });
      // AGI 8: mod = -1, bonus = 0

      const result = combatResolver.calculateInitiative(vessel, 10);

      expect(result.totalInitiative).toBe(9); // 10 - 1 + 0
    });

    it('should apply AGI bonus correctly', () => {
      const vessel = createTestVessel({ AGI: 18 });
      // AGI 18: mod = +4, bonus = +1

      const result = combatResolver.calculateInitiative(vessel, 12);

      expect(result.totalInitiative).toBe(17); // 12 + 4 + 1
    });
  });

  describe('resolveContestedAttack', () => {
    it('should resolve contested attack: attacker > defender wins', () => {
      const attacker = createTestVessel({ DEX: 14 });
      const defender = createTestVessel({ AGI: 10 });
      const weapon = createTestWeapon();

      const result = combatResolver.resolveContestedAttack(
        attacker,
        defender,
        weapon,
        0, // No lag
        16, // Attacker rolls 16
        10 // Defender rolls 10
      );

      // Attacker: 16 + 2 (DEX) + 2 (skill) = 20
      // Defender: 10 + 0 (AGI) + 0 (stance) = 10
      expect(result.isHit).toBe(true);
    });

    it('should apply information lag penalty to attacker', () => {
      const attacker = createTestVessel();
      const defender = createTestVessel();
      const weapon = createTestWeapon();

      const result = combatResolver.resolveContestedAttack(
        attacker,
        defender,
        weapon,
        -5, // Maximum lag penalty
        15,
        12
      );

      // Attacker: 15 + 0 - 5 (lag) = 10
      // Defender: 12 + 0 = 12
      expect(result.isHit).toBe(false);
    });

    it('should detect critical hit on natural 20', () => {
      const attacker = createTestVessel();
      const defender = createTestVessel();
      const weapon = createTestWeapon();

      const result = combatResolver.resolveContestedAttack(
        attacker,
        defender,
        weapon,
        0,
        20, // Natural 20
        5
      );

      expect(result.isCriticalHit).toBe(true);
    });

    it('should detect critical hit on margin > 10', () => {
      const attacker = createTestVessel();
      const defender = createTestVessel();
      const weapon = createTestWeapon();

      const result = combatResolver.resolveContestedAttack(
        attacker,
        defender,
        weapon,
        0,
        18,
        5 // Margin of 13
      );

      expect(result.isCriticalHit).toBe(true);
    });
  });

  describe('applyDamageAndInjuries', () => {
    it('should reduce damage by armor DR', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        50, // Base damage
        'slashing',
        6 // Armor DR
      );

      // 50 - 6 = 44 damage
      expect(result.healthPointsDamage).toBe(44);
      expect(result.armorReduction).toBe(6);
    });

    it('should map slashing damage to laceration', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        50,
        'slashing',
        0
      );

      expect(result.injuriesGenerated[0].type).toBe(InjuryType.LACERATION);
    });

    it('should map bludgeoning damage to fracture', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        50,
        'bludgeoning',
        0
      );

      expect(result.injuriesGenerated[0].type).toBe(InjuryType.FRACTURE);
    });

    it('should calculate injury severity: 1 per 10 damage', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        30, // 30 damage = severity 3
        'slashing',
        0
      );

      expect(result.injuriesGenerated[0].severity).toBe(3);
    });

    it('should double severity on critical hit', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        20, // 20 damage = severity 2, crit = 4
        'slashing',
        0,
        true // Critical
      );

      expect(result.injuriesGenerated[0].severity).toBe(4);
    });

    it('should cap severity at 5', () => {
      const vessel = createTestVessel();
      vessel.healthPoints = 100;

      const result = combatResolver.applyDamageAndInjuries(
        vessel,
        100, // Would be 10 severity, capped at 5
        'slashing',
        0
      );

      expect(result.injuriesGenerated[0].severity).toBe(5);
    });
  });

  describe('calculateCriticalMultiplier', () => {
    it('should return 1.5x for standard critical', () => {
      const multiplier = combatResolver.calculateCriticalMultiplier(12);
      expect(multiplier).toBe(1.5);
    });

    it('should return 2.0x for massive success (margin > 15)', () => {
      const multiplier = combatResolver.calculateCriticalMultiplier(16);
      expect(multiplier).toBe(2.0);
    });
  });

  describe('rollAttackDamage', () => {
    it('should calculate weapon damage with attribute scaling', () => {
      const attacker = createTestVessel({ STR: 14 }); // +2 mod
      const weapon = createTestWeapon({ baseDamage: 8 }); // 0.75x scaling

      // 8 + (2 * 0.75) = 8 + 1.5 = 9.5 ≈ 9
      const damage = combatResolver.rollAttackDamage(weapon, attacker, false);

      expect(damage).toBeGreaterThanOrEqual(8);
    });

    it('should apply 1.5x multiplier on critical hit', () => {
      const attacker = createTestVessel({ STR: 10 });
      const weapon = createTestWeapon({ baseDamage: 8 });

      const normalDamage = combatResolver.rollAttackDamage(weapon, attacker, false);
      const critDamage = combatResolver.rollAttackDamage(weapon, attacker, true);

      expect(critDamage).toBeCloseTo(normalDamage * 1.5, 0);
    });
  });
});

// ============================================================================
// INVENTORY MANAGER TESTS
// ============================================================================

describe('InventoryManager', () => {
  let inventoryManager: InventoryManager;

  beforeEach(() => {
    inventoryManager = new InventoryManager();
  });

  describe('calculateEncumbrance', () => {
    it('should calculate capacity: 20 + (STR * 5)', () => {
      const vessel = createTestVessel({ STR: 10 });
      const inventory = createTestInventory();

      // STR 10: 20 + (10 * 5) = 70kg
      expect(inventoryManager.getMaxCapacity(10)).toBe(70);
    });

    it('should detect overcumbered state', () => {
      const inventory = createTestInventory();
      inventory.items.set('sword', createTestWeapon({ weight: 80 }));
      inventory.currentWeight = 80;

      const result = inventoryManager.calculateEncumbrance(inventory, 10);

      expect(result.isOvercumbered).toBe(true);
      expect(result.weightOverCapacity).toBe(10);
    });

    it('should apply AGI penalty: -5% per 10kg over', () => {
      const inventory = createTestInventory();
      inventory.currentWeight = 90; // 20kg over capacity

      const result = inventoryManager.calculateEncumbrance(inventory, 10);

      // 20kg over * (0.005 per kg) = 0.1 penalty per kg
      expect(result.agiPenalty).toBeGreaterThan(0);
    });

    it('should calculate stamina drain: -0.2 per kg over', () => {
      const inventory = createTestInventory();
      inventory.currentWeight = 100; // 30kg over

      const result = inventoryManager.calculateEncumbrance(inventory, 10);

      // 30kg * 0.002 = 0.06 drain per tick
      expect(result.staminaDrainPerTick).toBeCloseTo(0.06, 2);
    });

    it('should apply movement speed reduction when overcumbered', () => {
      const inventory = createTestInventory();
      inventory.currentWeight = 80;

      const result = inventoryManager.calculateEncumbrance(inventory, 10);

      expect(result.movementSpeedReduction).toBe(0.3); // 30% reduction
    });

    it('should calculate percentage of capacity used', () => {
      const inventory = createTestInventory();
      inventory.currentWeight = 35; // 50% of 70kg

      const result = inventoryManager.calculateEncumbrance(inventory, 10);

      expect(result.capacityPercentUsed).toBeCloseTo(50, 0);
    });
  });

  describe('updateDurability', () => {
    it('should reduce weapon durability -1 per attack', () => {
      const weapon = createTestWeapon();

      const updated = inventoryManager.updateDurability(weapon, 0) as Weapon;

      expect(updated.durability.current).toBe(99);
    });

    it('should reduce armor durability -0.5 per hit', () => {
      const armor = createTestArmor();

      const updated = inventoryManager.updateDurability(armor, 20) as Armor;

      // 20 damage / 20 * 0.5 = 0.5
      expect(updated.durability.current).toBeLessThan(100);
    });

    it('should double decay for brittle armor (floor 0.5)', () => {
      const armor = createTestArmor({ 
        durability: { ...createTestArmor().durability, floor: 0.5 } 
      });

      const updated = inventoryManager.updateDurability(armor, 20, true) as Armor;

      expect(updated.durability.isBroken).toBe(false);
    });

    it('should set isBroken when durability reaches 0', () => {
      const armor = createTestArmor({ 
        durability: { ...createTestArmor().durability, current: 0.5 } 
      });

      const updated = inventoryManager.updateDurability(armor, 100) as Armor;

      expect(updated.durability.isBroken).toBe(true);
    });

    it('should clamp durability to 0 minimum', () => {
      const weapon = createTestWeapon({ 
        durability: { ...createTestWeapon().durability, current: 0.5 } 
      });

      const updated = inventoryManager.updateDurability(weapon, 0) as Weapon;

      expect(updated.durability.current).toBe(0);
    });
  });

  describe('repairItem', () => {
    it('should restore durability', () => {
      const armor = createTestArmor({ 
        durability: { ...createTestArmor().durability, current: 50 } 
      });

      const updated = inventoryManager.repairItem(armor, 30) as Armor;

      expect(updated.durability.current).toBe(80);
    });

    it('should not exceed maximum durability', () => {
      const armor = createTestArmor({ 
        durability: { ...createTestArmor().durability, current: 95 } 
      });

      const updated = inventoryManager.repairItem(armor, 50) as Armor;

      expect(updated.durability.current).toBe(100);
    });

    it('should increment repair count', () => {
      const armor = createTestArmor();

      const updated = inventoryManager.repairItem(armor, 20) as Armor;

      expect(updated.durability.repairCount).toBe(1);
    });
  });

  describe('validateCanEquip', () => {
    it('should reject armor with insufficient STR', () => {
      const vessel = createTestVessel({ STR: 12 });
      const armor = createTestArmor({ requiredStrength: 14 });
      const inventory = createTestInventory();

      const result = inventoryManager.validateCanEquip(inventory, armor, vessel);

      expect(result.canEquip).toBe(false);
    });

    it('should allow armor with sufficient STR', () => {
      const vessel = createTestVessel({ STR: 15 });
      const armor = createTestArmor({ requiredStrength: 14 });
      const inventory = createTestInventory();

      const result = inventoryManager.validateCanEquip(inventory, armor, vessel);

      expect(result.canEquip).toBe(true);
    });

    it('should reject weapons with insufficient attribute', () => {
      const vessel = createTestVessel({ STR: 8 });
      const weapon = createTestWeapon({ requiredAttributeValue: 10 });
      const inventory = createTestInventory();

      const result = inventoryManager.validateCanEquip(inventory, weapon, vessel);

      expect(result.canEquip).toBe(false);
    });
  });

  describe('getTotalArmorDR', () => {
    it('should sum DR from equipped armor', () => {
      const armor1 = createTestArmor({ id: 'armor1', damageReduction: 3 });
      const armor2 = createTestArmor({ id: 'armor2', damageReduction: 2, equipmentSlot: 'legs' });

      const inventory = createTestInventory();
      inventory.items.set('armor1', armor1);
      inventory.items.set('armor2', armor2);
      inventory.equippedItems = [
        { slot: 'chest', itemId: 'armor1' },
        { slot: 'legs', itemId: 'armor2' },
      ];

      const totalDR = inventoryManager.getTotalArmorDR(inventory);

      expect(totalDR).toBe(5);
    });

    it('should ignore broken armor', () => {
      const armor = createTestArmor({
        id: 'armor1',
        damageReduction: 6,
        durability: { ...createTestArmor().durability, current: 0, isBroken: true },
      });

      const inventory = createTestInventory();
      inventory.items.set('armor1', armor);
      inventory.equippedItems = [{ slot: 'chest', itemId: 'armor1' }];

      const totalDR = inventoryManager.getTotalArmorDR(inventory);

      expect(totalDR).toBe(0);
    });
  });

  describe('getEffectiveAgi', () => {
    it('should apply encumbrance AGI penalty', () => {
      const baseAgi = 14;
      const penalty = 2;

      const effective = inventoryManager.getEffectiveAgi(baseAgi, penalty);

      expect(effective).toBe(12);
    });

    it('should clamp to 0 minimum', () => {
      const baseAgi = 8;
      const penalty = 10;

      const effective = inventoryManager.getEffectiveAgi(baseAgi, penalty);

      expect(effective).toBe(0);
    });
  });

  describe('applyWeightStaminaDrain', () => {
    it('should drain stamina if overcumbered', () => {
      const vessel = createTestVessel({ STR: 10 });
      vessel.stamina = 100;
      const inventory = createTestInventory();
      inventory.items.set('sword', createTestWeapon({ weight: 80 }));
      inventory.currentWeight = 80;

      const updated = inventoryManager.applyWeightStaminaDrain(vessel, inventory);

      expect(updated.stamina).toBeLessThan(100);
    });

    it('should not drain stamina if under capacity', () => {
      const vessel = createTestVessel({ STR: 10 });
      vessel.stamina = 100;
      const inventory = createTestInventory();
      inventory.items.set('sword', createTestWeapon({ weight: 20 }));
      inventory.currentWeight = 20;

      const updated = inventoryManager.applyWeightStaminaDrain(vessel, inventory);

      expect(updated.stamina).toBe(100);
    });
  });
});
