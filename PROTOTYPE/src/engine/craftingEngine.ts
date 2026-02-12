import type { InventoryItem } from './worldEngine';

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
    if (Math.random() <= entry.chance) {
      // Randomly select quantity within range
      const quantity =
        Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1)) +
        entry.minQuantity;

      loot.push({
        itemId: entry.itemId,
        quantity
      });
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

    if (!inventoryItem || inventoryItem.quantity < requiredMaterial.quantity) {
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
  const roll = Math.floor(Math.random() * 20) + 1 + Math.floor(playerInt / 3) + modifier;
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

    if (idx >= 0) {
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
    (item: InventoryItem) => item.itemId === result.itemId
  );

  if (existingIdx >= 0) {
    updated[existingIdx].quantity += result.quantity;
  } else {
    updated.push({
      itemId: result.itemId,
      quantity: result.quantity
    });
  }

  return updated;
}
