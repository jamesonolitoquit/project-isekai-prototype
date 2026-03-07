import type { InventoryItem, LootTable, CraftingRecipe, PlayerState } from './worldEngine';
import { createStackableItem } from './worldEngine';
import { random } from './prng';
import { calculateEquipmentEffectiveness, shouldBotch } from './proficiencyEngine';
import type { WorldState } from './worldEngine';

/**
 * Phase 46: Blind Fusing Result
 */
export interface BlindFusingResult {
  success: boolean;
  discoveredRecipe?: CraftingRecipe;
  resultItem?: InventoryItem;
  discoveryXp: number;
  narrativeDescription: string;
  isNewDiscovery: boolean; // true if this recipe was never found before
}

/**
 * Crafting Engine - handles recipe validation and material management
 * Phase 42: Updated to use proficiency system instead of just base stats
 * Phase 46: Added blind fusing for discovery-based crafting
 */

/**
 * Resolve a loot table to generate items with weighted random selection
 */
export function resolveLootTable(
  tableEntries: LootTable['drops']
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
  recipe: CraftingRecipe
): { valid: boolean; missingMaterials: Array<{ itemId: string; quantity: number }> } {
  const missingMaterials: Array<{ itemId: string; quantity: number }> = [];

  recipe.ingredients.forEach((requiredMaterial) => {
    const inventoryItem = inventory.find(
      (item) => item.itemId === requiredMaterial.itemId
    );

    // For stackable items, check quantity
    const currentQty = inventoryItem && inventoryItem.kind === 'stackable' ? inventoryItem.quantity : 0;
    if (currentQty < requiredMaterial.quantity) {
      missingMaterials.push(requiredMaterial);
    }
  });

  return {
    valid: missingMaterials.length === 0,
    missingMaterials
  };
}

/**
 * Phase 42: Calculate crafting success based on proficiency level
 * Also incorporates base stats as fallback for characters with no proficiencies
 * Returns a difficulty check result
 */
export function rollCraftingCheck(
  playerInt: number,
  recipedifficulty: number,
  modifier: number = 0,
  player?: PlayerState,
  craftingProficiency: string = 'Smithing',
  worldState?: WorldState
): { success: boolean; roll: number; difficulty: number; botched?: boolean } {
  let profBonus = 0;
  let isBotch = false;

  // Phase 42: Use proficiency level if available
  if (player && player.proficiencies) {
    const profData = player.proficiencies[craftingProficiency];
    if (profData) {
      // Proficiency level (0-20) is converted to a bonus (-10 to +10, where 10 = +10 to roll)
      profBonus = (profData.level - 10) * 0.5;  // Each proficiency level = +0.5 to roll

      // Check for botch based on proficiency vs recipe difficulty
      if (worldState && worldState.player) {
        // Recipe difficulty is typically 1-20, proficiency is 0-20
        // Botch if proficiency tier is much lower than recipe requirement
        const tierGap = Math.max(0, recipedifficulty - profData.level);
        const botchChance = Math.min(0.9, tierGap * 0.1);
        if (random() < botchChance) {
          isBotch = true;
        }
      }
    }
  }

  // Base roll from D&D-style: 1d20 + INT modifier
  const intModifier = Math.floor(playerInt / 3);
  const roll = Math.floor(random() * 20) + 1 + intModifier + Math.floor(profBonus) + modifier;

  return {
    success: !isBotch && roll >= recipedifficulty,
    roll,
    difficulty: recipedifficulty,
    botched: isBotch
  };
}

/**
 * Deduct materials from inventory after successful craft
 * Returns updated inventory
 */
export function deductMaterials(
  inventory: InventoryItem[],
  recipe: CraftingRecipe
): InventoryItem[] {
  const updated = JSON.parse(JSON.stringify(inventory));

  recipe.ingredients.forEach((requiredMaterial) => {
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
  recipe: CraftingRecipe
): InventoryItem[] {
  const updated = JSON.parse(JSON.stringify(inventory));
  const resultItemId = recipe.resultItemId;
  const resultQuantity = recipe.resultQuantity;

  const existingIdx = updated.findIndex(
    (item: InventoryItem) => item.itemId === resultItemId
  );

  if (existingIdx >= 0) {
    updated[existingIdx].quantity += resultQuantity;
  } else {
    updated.push({
      itemId: resultItemId,
      quantity: resultQuantity
    });
  }

  return updated;
}

/**
 * Phase 46: Attempt blind fusing of 2-5 items to discover new recipes
 * This is a discovery-based crafting mechanic that encourages experimentation
 */
export function tryBlindFuse(
  itemsToFuse: InventoryItem[],
  player: PlayerState,
  state: WorldState
): BlindFusingResult {
  // Validate item count
  if (itemsToFuse.length < 2 || itemsToFuse.length > 5) {
    return {
      success: false,
      discoveryXp: 0,
      narrativeDescription: 'Blind fusing requires 2-5 items.',
      isNewDiscovery: false
    };
  }

  // Calculate base discovery chance from proficiencies
  const alchemyProf = player.proficiencies?.['Alchemy'];
  const smithingProf = player.proficiencies?.['Smithing'];
  const artificeProf = player.proficiencies?.['Artifice'];

  const bestProf = Math.max(
    alchemyProf?.level ?? 0,
    smithingProf?.level ?? 0,
    artificeProf?.level ?? 0
  );

  // Base discovery chance 10-40% depending on item count and proficiency
  const baseChance = 0.1 + (itemsToFuse.length * 0.05) + (bestProf * 0.01);
  const discoveryChance = Math.min(0.8, baseChance);
  const successRoll = random() < discoveryChance;

  if (!successRoll) {
    return {
      success: false,
      discoveryXp: 10,
      narrativeDescription: `Your fusing attempt yields nothing but smoke and disappointment.`,
      isNewDiscovery: false
    };
  }

  // Generate a plausible hybrid item name
  const itemNames = itemsToFuse.map(i => i.itemId).join(' + ');
  const hybrids = [
    'Composite Material',
    'Hybrid Alloy',
    'Fusion Catalyst',
    'Transmuted Essence',
    'Blended Compound',
    'Synergized Fragment',
    'Harmonized Extract'
  ];

  const resultName = hybrids[Math.floor(random() * hybrids.length)];
  const resultItem: InventoryItem = {
    kind: 'stackable',
    itemId: `discovery-${Math.random().toString(16).slice(2)}`,
    quantity: 1
  };

  // Determine if this is a new discovery or a known recipe
  const isNewDiscovery = random() < 0.6; // 60% chance of entirely new recipe

  return {
    success: true,
    discoveredRecipe: {
      id: `recipe-${Math.random().toString(16).slice(2)}`,
      resultItemId: resultItem.itemId,
      resultQuantity: 1,
      ingredients: itemsToFuse.map(i => ({ itemId: i.itemId, quantity: 1 })),
      requiredFacility: 'none',
      discoveryHardFactId: isNewDiscovery ? `discovery-${Date.now()}` : undefined
    },
    resultItem,
    discoveryXp: 40 + (itemsToFuse.length * 10),
    narrativeDescription: isNewDiscovery
      ? `Magical energies swirl as your items merge into something entirely new! You've discovered an unknown recipe!`
      : `Your items combine successfully into ${resultName}. The technique feels familiar, yet novel.`,
    isNewDiscovery
  };
}
