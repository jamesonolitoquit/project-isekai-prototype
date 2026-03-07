/**
 * Inventory Manager Engine (Phase 4 - DSS 09, 12)
 *
 * Manages inventory weight, equipment slots, item durability, and encumbrance penalties.
 * Integrates with:
 * - DSS 09: Production chains, market dynamics
 * - DSS 12: Workstation crafting, durability floors, material volatility
 * - DSS 01: Attribute-based weight carrying
 * - Vessels: AGI penalties from carrying too much
 *
 * Core Concept: Inventory is limited by weight (based on STR).
 * Carrying over capacity applies AGI penalties and stamina drain.
 * Equipment durability degrades with use and combat.
 */

import type { Inventory, Item, Weapon, Armor, Durability } from '../types';
import type { Vessel, CoreAttributes } from '../types';
import { ENCUMBRANCE_CONSTANTS, DURABILITY_CONSTANTS, ARMOR_DR_BY_TYPE } from '../types';

/**
 * Encumbrance Result: Weight penalties and effects
 */
export interface EncumbranceResult {
  /** Total capacity in kg */
  totalCapacity: number;

  /** Current weight being carried */
  currentWeight: number;

  /** Weight over capacity (0 if under) */
  weightOverCapacity: number;

  /** Percentage of capacity used */
  capacityPercentUsed: number;

  /** Whether character is in overcumbered state */
  isOvercumbered: boolean;

  /** AGI penalty from overcumbrance (-5% per 10kg over) */
  agiPenalty: number;

  /** Stamina drain per tick from overcumbrance (-0.2 per kg over) */
  staminaDrainPerTick: number;

  /** Movement speed reduction (-30% when overcumbered) */
  movementSpeedReduction: number;
}

/**
 * Inventory Manager: Manages weight, durability, and equipment
 */
export class InventoryManager {
  /**
   * Calculate encumbrance penalties
   *
   * Capacity Formula: 20kg base + (STR × 5kg)
   * Example:
   * - STR 10: 20 + 50 = 70kg capacity
   * - STR 15: 20 + 75 = 95kg capacity
   * - STR 5: 20 + 25 = 45kg capacity
   *
   * Over Capacity Penalties:
   * - AGI Penalty: -5% per 10kg over
   * - Stamina Drain: -0.2 per kg over per tick
   * - Movement Speed: -30% when overcumbered
   *
   * @param inventory Character's inventory
   * @param strAttribute STR attribute for capacity
   * @returns EncumbranceResult with all penalties
   */
  calculateEncumbrance(inventory: Inventory, strAttribute: number): EncumbranceResult {
    // Calculate capacity
    const baseCapacity = ENCUMBRANCE_CONSTANTS.baseCapacity;
    const strBonus = strAttribute * ENCUMBRANCE_CONSTANTS.strCapacityPerPoint;
    const totalCapacity = baseCapacity + strBonus;

    // Calculate current weight
    let currentWeight = 0;
    inventory.items.forEach((item) => {
      currentWeight += item.weight;
    });

    // Calculate overweight
    const weightOverCapacity = Math.max(0, currentWeight - totalCapacity);
    const isOvercumbered = weightOverCapacity > 0;

    // Calculate percentage
    const capacityPercentUsed = (currentWeight / totalCapacity) * 100;

    // Calculate AGI penalty (-5% per 10kg over)
    const agiPenalty = (weightOverCapacity / 10) * ENCUMBRANCE_CONSTANTS.agiPenaltyPerExtraKg;

    // Calculate stamina drain (-0.2 per kg over per tick)
    const staminaDrainPerTick =
      Math.max(0, weightOverCapacity) * ENCUMBRANCE_CONSTANTS.staminaDrainPerExtraKg;

    // Movement speed reduction (-30% when overcumbered)
    const movementSpeedReduction = isOvercumbered
      ? ENCUMBRANCE_CONSTANTS.overcumbranceSpeedReduction
      : 0;

    return {
      totalCapacity,
      currentWeight,
      weightOverCapacity,
      capacityPercentUsed,
      isOvercumbered,
      agiPenalty,
      staminaDrainPerTick,
      movementSpeedReduction,
    };
  }

  /**
   * Update item durability after use
   *
   * Durability Loss:
   * - Weapon per attack: -1 durability
   * - Armor per hit taken: -0.5 durability
   * - Brittle items (floor 0.5): 2x decay rate
   *
   * Item broken when: durability <= 0
   *
   * @param item Item to degrade
   * @param damageTaken Damage taken (for armor)
   * @param isBrittle Whether item is brittle (degraded crafting)
   * @returns Updated item with reduced durability
   */
  updateDurability(
    item: Item,
    damageTaken: number = 0,
    isBrittle: boolean = false
  ): Item {
    if (!('durability' in item)) {
      // Item doesn't have durability
      return item;
    }

    const updated = { ...item } as any;
    const durabilityData = updated.durability as any;

    if (!durabilityData) {
      // Item doesn't have durability
      return updated;
    }

    const durability = { ...durabilityData };

    // Determine decay amount
    let decayAmount = 0;

    if (item.itemType === 'weapon') {
      // Weapons: -1 per attack
      decayAmount = (updated as Weapon).durability?.decayPerUse || 1;
    } else if (item.itemType === 'armor') {
      // Armor: -0.5 per damage taken
      decayAmount = (damageTaken / 20) * DURABILITY_CONSTANTS.armorDecayPerHit; // -0.5 for ~20 damage
    }

    // Apply brittle multiplier (2x decay if floor is 0.5)
    if (isBrittle && durability.floor === 0.5) {
      decayAmount *= 2;
    }

    // Reduce durability
    durability.current = Math.max(0, durability.current - decayAmount);

    // Check if broken
    durability.isBroken = durability.current <= 0;

    updated.durability = durability;
    return updated;
  }

  /**
   * Repair an item (restore durability)
   *
   * Repair restores durability up to maximum.
   * Cost = RepairCostPerPoint × (MaxDurability - CurrentDurability)
   *
   * @param item Item to repair
   * @param repairAmount Amount of durability to restore
   * @returns Updated item with restored durability
   */
  repairItem(item: Item, repairAmount: number): Item {
    if (!('durability' in item)) {
      return item;
    }

    const updated = { ...item } as any;
    const durabilityData = updated.durability as any;

    if (!durabilityData) {
      return updated;
    }

    const durability = { ...durabilityData };

    // Restore durability (can't exceed maximum)
    durability.current = Math.min(durability.maximum, durability.current + repairAmount);
    durability.isBroken = durability.current <= 0;

    // Increment repair count
    durability.repairCount += 1;

    updated.durability = durability;
    return updated;
  }

  /**
   * Get armor stats with encumbrance penalties included
   *
   * @param armor Armor piece
   * @param encumbranceAgiPenalty AGI penalty from weight
   * @returns Effective armor stats
   */
  getEffectiveArmorStats(
    armor: Armor,
    encumbranceAgiPenalty: number = 0
  ): {
    effectiveDR: number;
    totalAgiPenalty: number;
  } {
    const totalAgiPenalty = armor.agilityPenalty + encumbranceAgiPenalty;

    return {
      effectiveDR: armor.damageReduction,
      totalAgiPenalty,
    };
  }

  /**
   * Validate that item can be equipped
   *
   * Checks:
   * - STR requirement met (for armor/weapons)
   * - Skill requirement met (for weapons)
   * - Equipment slot not already occupied
   *
   * @param inventory Current inventory
   * @param item Item to equip
   * @param vessel Character equipping
   * @returns { canEquip, reason }
   */
  validateCanEquip(
    inventory: Inventory,
    item: Item,
    vessel: Vessel
  ): { canEquip: boolean; reason?: string } {
    // Check STR requirement
    if ('requiredStrength' in item) {
      const armor = item as Armor;
      if (vessel.attributes.STR < armor.requiredStrength) {
        return {
          canEquip: false,
          reason: `Requires STR ${armor.requiredStrength} (you have ${vessel.attributes.STR})`,
        };
      }
    }

    // Check weapon STR requirement
    if ('requiredAttributeValue' in item) {
      const weapon = item as Weapon;
      const requiredAttr = vessel.attributes[weapon.requiredAttribute];
      if (requiredAttr < weapon.requiredAttributeValue) {
        return {
          canEquip: false,
          reason: `Requires ${weapon.requiredAttribute} ${weapon.requiredAttributeValue}`,
        };
      }
    }

    // Check slot availability (if armor)
    if ('equipmentSlot' in item) {
      const armor = item as Armor;
      const slotOccupied = inventory.equippedItems.some((eq) => eq.slot === armor.equipmentSlot);
      if (slotOccupied) {
        return {
          canEquip: false,
          reason: `${armor.equipmentSlot} slot already occupied`,
        };
      }
    }

    return { canEquip: true };
  }

  /**
   * Get total weight in inventory
   *
   * @param inventory Inventory to calculate
   * @returns Total weight in kg
   */
  getTotalWeight(inventory: Inventory): number {
    let total = 0;
    inventory.items.forEach((item) => {
      total += item.weight;
    });
    return total;
  }

  /**
   * Get max capacity based on STR
   *
   * Formula: 20 + (STR × 5)
   *
   * @param strAttribute STR attribute
   * @returns Max capacity in kg
   */
  getMaxCapacity(strAttribute: number): number {
    return ENCUMBRANCE_CONSTANTS.baseCapacity + strAttribute * ENCUMBRANCE_CONSTANTS.strCapacityPerPoint;
  }

  /**
   * Apply weight-based stamina drain
   *
   * If overcumbered, character loses stamina per tick
   * Loss = 0.2 × kg over capacity
   *
   * @param vessel Character to apply drain to
   * @param inventory Inventory with weight
   * @returns Updated vessel with stamina reduced
   */
  applyWeightStaminaDrain(vessel: Vessel, inventory: Inventory): Vessel {
    const encumbrance = this.calculateEncumbrance(
      inventory,
      vessel.attributes.STR
    );

    if (encumbrance.isOvercumbered) {
      const updated = { ...vessel };
      updated.stamina = Math.max(
        0,
        updated.stamina - encumbrance.staminaDrainPerTick
      );
      return updated;
    }

    return vessel;
  }

  /**
   * Calculate effective AGI with encumbrance penalty
   *
   * @param baseAgi Base AGI attribute
   * @param encumbranceAgiPenalty AGI penalty from weight
   * @returns Effective AGI for calculations
   */
  getEffectiveAgi(baseAgi: number, encumbranceAgiPenalty: number): number {
    return Math.max(0, baseAgi - encumbranceAgiPenalty);
  }

  /**
   * Get effective armor DR from equipped armor
   *
   * Sums DR from all equipped armor pieces
   *
   * @param inventory Inventory with equipped items
   * @returns Total DR value
   */
  getTotalArmorDR(inventory: Inventory): number {
    let totalDR = 0;

    inventory.equippedItems.forEach((equipped) => {
      const item = inventory.items.get(equipped.itemId);
      if (item && 'damageReduction' in item) {
        const armor = item as Armor;
        if (!armor.durability.isBroken) {
          totalDR += armor.damageReduction;
        }
      }
    });

    return totalDR;
  }
}

/**
 * Default inventory manager instance
 */
export const defaultInventoryManager = new InventoryManager();
