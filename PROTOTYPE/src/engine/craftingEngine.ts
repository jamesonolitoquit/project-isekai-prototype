import type { InventoryItem } from './worldEngine';
import { createStackableItem, isStackable, getStackableQuantity } from './worldEngine';
import { random } from './prng';

/**
 * Crafting Engine - handles recipe validation and material management
 */

export interface RecipeMaterial {
  itemId: string;
  quantity: number;
}

export interface RecipeResult {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  materials: RecipeMaterial[];
  result: RecipeResult;
  difficulty: number;
  description?: string;
  tier?: 'basic' | 'advanced' | 'runic' | 'legendary'; // M28: Tier for epoch-gating
}

export interface LootTableEntry {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

/**
 * Resolve a loot table to generate items with weighted random selection
 */
export function resolveLootTable(
  tableEntries: LootTableEntry[]
): InventoryItem[] {
  const loot: InventoryItem[] = [];

  tableEntries.forEach((entry) => {
    // Check if this item drops based on its chance
    if (random() <= entry.chance) {
      // Randomly select quantity within range
      const quantity =
        Math.floor(random() * (entry.maxQuantity - entry.minQuantity + 1)) +
        entry.minQuantity;

      loot.push(createStackableItem(entry.itemId, quantity));
    }
  });

  return loot;
}

/**
 * Validate if the player has all required materials for a recipe
 */
export function validateRecipe(
  inventory: InventoryItem[],
  recipe: Recipe
): { valid: boolean; missingMaterials: RecipeMaterial[] } {
  const missingMaterials: RecipeMaterial[] = [];

  recipe.materials.forEach((requiredMaterial) => {
    const inventoryItem = inventory.find(
      (item) => item.itemId === requiredMaterial.itemId
    );

    // For stackable items, check quantity
    if (!inventoryItem || !isStackable(inventoryItem) || inventoryItem.quantity < requiredMaterial.quantity) {
      missingMaterials.push(requiredMaterial);
    }
  });

  return {
    valid: missingMaterials.length === 0,
    missingMaterials
  };
}

/**
 * Calculate crafting success based on player's INT or other stat
 * Returns a difficulty check result
 */
export function rollCraftingCheck(
  playerInt: number,
  recipedifficulty: number,
  modifier: number = 0
): { success: boolean; roll: number; difficulty: number } {
  const roll = Math.floor(random() * 20) + 1 + Math.floor(playerInt / 3) + modifier;
  return {
    success: roll >= recipedifficulty,
    roll,
    difficulty: recipedifficulty
  };
}

/**
 * Deduct materials from inventory after successful craft
 * Returns updated inventory
 */
export function deductMaterials(
  inventory: InventoryItem[],
  recipe: Recipe
): InventoryItem[] {
  const updated = JSON.parse(JSON.stringify(inventory));

  recipe.materials.forEach((requiredMaterial) => {
    const idx = updated.findIndex(
      (item: InventoryItem) => item.itemId === requiredMaterial.itemId
    );

    if (idx >= 0 && isStackable(updated[idx])) {
      updated[idx].quantity -= requiredMaterial.quantity;
      if (updated[idx].quantity <= 0) {
        updated.splice(idx, 1);
      }
    }
  });

  return updated;
}

/**
 * Add crafting result to inventory
 * Stacks with existing items if possible
 */
export function addCraftResult(
  inventory: InventoryItem[],
  recipe: Recipe
): InventoryItem[] {
  const updated = JSON.parse(JSON.stringify(inventory));
  const result = recipe.result;

  const existingIdx = updated.findIndex(
    (item: InventoryItem) => item.itemId === result.itemId && isStackable(item)
  );

  if (existingIdx >= 0 && isStackable(updated[existingIdx])) {
    updated[existingIdx].quantity += result.quantity;
  } else {
    updated.push({
      itemId: result.itemId,
      quantity: result.quantity
    });
  }

  return updated;
}

/**
 * Epoch-Gated Crafting System (M28: Runic Decay)
 * 
 * Rules:
 * - Epoch I (Fracture): High-tier runic infusions have 100% success rate
 * - Epoch II (Waning): Success rates decline
 * - Epoch III (Twilight): Runic recipes have 50% fail rate unless Primal Flux is used
 * 
 * Primal Flux: A legacy ingredient that stabilizes runic crafting across epochs
 */
export type EpochType = 'epoch_i_fracture' | 'epoch_ii_waning' | 'epoch_iii_twilight';

/**
 * Calculate epoch-adjusted crafting success
 * Higher success in early epochs, declining through time
 */
export function calculateEpochAdjustedSuccess(
  baseSuccessChance: number,
  recipe: Recipe,
  epochId: EpochType,
  hasPrimalFlux: boolean = false
): number {
  // Non-runic recipes are unaffected by epochs
  if (recipe.tier !== 'runic' && recipe.tier !== 'legendary') {
    return baseSuccessChance;
  }

  // Map epoch to multiplier
  const epochMultipliers: Record<EpochType, number> = {
    'epoch_i_fracture': 1.0,      // 100% (no penalty in Fracture)
    'epoch_ii_waning': 0.85,      // 15% penalty - magic is fading
    'epoch_iii_twilight': 0.5     // 50% base fail in Twilight (unless Primal Flux used)
  };

  let adjustedChance = baseSuccessChance * epochMultipliers[epochId];

  // Primal Flux ingredient stabilizes crafting across epochs
  if (hasPrimalFlux && epochId === 'epoch_iii_twilight') {
    adjustedChance = Math.max(adjustedChance, 0.9); // 90% success with Primal Flux in Twilight
  }

  return Math.min(1.0, adjustedChance);
}

/**
 * Check if player has Primal Flux ingredient
 */
export function hasPrimalFluxIngredient(inventory: InventoryItem[]): boolean {
  return inventory.some(item => isStackable(item) && item.itemId === 'primal_flux' && item.quantity > 0);
}

/**
 * Primal Flux consumption: if used, deduct one from inventory
 */
export function consumePrimalFlux(inventory: InventoryItem[]): InventoryItem[] {
  return inventory.map(item => {
    if (isStackable(item) && item.itemId === 'primal_flux') {
      return {
        ...item,
        quantity: Math.max(0, item.quantity - 1)
      };
    }
    return item;
  }).filter(item => !isStackable(item) || item.quantity > 0);
}

/**
 * Perform epoch-gated crafting check
 * Returns success/failure, accounting for epoch decay and Primal Flux stabilization
 */
export function rollEpochAdjustedCraft(
  playerInt: number,
  recipe: Recipe,
  epochId: EpochType,
  modifier: number = 0,
  hasPrimalFlux: boolean = false
): { success: boolean; roll: number; difficulty: number; epochPenalty?: number } {
  // Base crafting roll (d20 + INT bonus + modifier)
  const roll = Math.floor(random() * 20) + 1 + Math.floor(playerInt / 3) + modifier;
  const baseDifficulty = recipe.difficulty;

  // Apply epoch adjustment
  const epochMultiplier = calculateEpochAdjustedSuccess(
    1.0,
    recipe,
    epochId,
    hasPrimalFlux
  );

  // Adjusted difficulty represents the "current age's resistance" to runic crafting
  const adjustedDifficulty = Math.ceil(baseDifficulty / epochMultiplier);

  const success = roll >= adjustedDifficulty;

  return {
    success,
    roll,
    difficulty: baseDifficulty,
    epochPenalty: baseDifficulty * (1 - epochMultiplier)
  };
}
