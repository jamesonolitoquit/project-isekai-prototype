/**
 * World Validation Script - Verify Alchemical Manifest integrity
 * 
 * Purpose: Validate that all itemTemplates, lootTables, and craftingRecipes
 * are properly connected and have no orphaned references.
 * 
 * Usage: npm run verify-world
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ItemTemplate {
  id: string;
  name: string;
  rarity: string;
  kind: 'stackable' | 'unique';
}

interface LootDrop {
  itemId: string;
  chance: number;
}

interface LootTable {
  id: string;
  locationId?: string;
  biome?: string;
  drops: LootDrop[];
}

interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

interface CraftingRecipe {
  id: string;
  resultItemId: string;
  ingredients: RecipeIngredient[];
  requiredFacility?: string;
}

interface WorldTemplate {
  name: string;
  itemTemplates?: ItemTemplate[];
  lootTables?: LootTable[];
  craftingRecipes?: CraftingRecipe[];
  locations?: Array<{ id: string; biome?: string }>;
}

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function verifyWorld() {
  log('\n═══════════════════════════════════════════════════════', COLORS.cyan);
  log('  ALCHEMICAL MANIFEST VALIDATION - Phase 14', COLORS.cyan);
  log('═══════════════════════════════════════════════════════', COLORS.cyan);

  // Load demo world
  const demoWorldPath = path.join(__dirname, '../src/data/demo-fantasy-world.json');
  let world: WorldTemplate;

  try {
    const content = fs.readFileSync(demoWorldPath, 'utf-8');
    world = JSON.parse(content);
    log(`\n✓ Loaded world: "${world.name}"`, COLORS.green);
  } catch (error) {
    log(`\n✗ Failed to load world template: ${error}`, COLORS.red);
    process.exit(1);
  }

  // Initialize validation state
  let errorCount = 0;
  let warningCount = 0;

  // ============ 1. Validate Item Templates ============
  log(`\n${'─'.repeat(50)}`, COLORS.blue);
  log('1. ITEM TEMPLATES VALIDATION', COLORS.blue);
  log('─'.repeat(50), COLORS.blue);

  const itemTemplates = world.itemTemplates || [];
  const itemIds = new Map<string, ItemTemplate>();

  if (itemTemplates.length === 0) {
    log(`  ✗ No item templates found`, COLORS.red);
    errorCount++;
  } else {
    log(`  Found ${itemTemplates.length} item templates`, COLORS.green);

    itemTemplates.forEach((item, index) => {
      if (!item.id) {
        log(`    ✗ Template ${index} missing 'id' field`, COLORS.red);
        errorCount++;
      } else if (!item.name) {
        log(`    ✗ Template '${item.id}' missing 'name' field`, COLORS.red);
        errorCount++;
      } else if (!item.rarity) {
        log(`    ✗ Template '${item.id}' missing 'rarity' field`, COLORS.red);
        errorCount++;
      } else if (!item.kind) {
        log(`    ✗ Template '${item.id}' missing 'kind' field`, COLORS.red);
        errorCount++;
      } else {
        itemIds.set(item.id, item);
        log(`    ✓ ${item.id} (${item.rarity} ${item.kind})`);
      }
    });
  }

  // ============ 2. Validate Loot Tables ============
  log(`\n${'─'.repeat(50)}`, COLORS.blue);
  log('2. LOOT TABLES VALIDATION', COLORS.blue);
  log('─'.repeat(50), COLORS.blue);

  const lootTables = world.lootTables || [];
  const locations = (world.locations || []).map(l => l.id);

  if (lootTables.length === 0) {
    log(`  ✗ No loot tables found`, COLORS.red);
    errorCount++;
  } else {
    log(`  Found ${lootTables.length} loot tables`, COLORS.green);

    lootTables.forEach((table, index) => {
      if (!table.id) {
        log(`    ✗ Loot table ${index} missing 'id'`, COLORS.red);
        errorCount++;
      } else if (!table.drops || table.drops.length === 0) {
        log(`    ✗ Loot table '${table.id}' has no drops`, COLORS.red);
        errorCount++;
      } else if (!table.locationId && !table.biome) {
        log(`    ⚠ Loot table '${table.id}' missing both locationId and biome`, COLORS.yellow);
        warningCount++;
      } else {
        log(`    ✓ ${table.id}`, COLORS.green);

        // Check location reference
        if (table.locationId && !locations.includes(table.locationId)) {
          log(`      ⚠ References unknown location: '${table.locationId}'`, COLORS.yellow);
          warningCount++;
        }

        // Check item references
        table.drops.forEach(drop => {
          if (!itemIds.has(drop.itemId)) {
            log(`      ✗ References unknown item: '${drop.itemId}'`, COLORS.red);
            errorCount++;
          }
          if (drop.chance < 0 || drop.chance > 1) {
            log(`      ✗ Invalid chance for '${drop.itemId}': ${drop.chance}`, COLORS.red);
            errorCount++;
          }
        });
      }
    });
  }

  // ============ 3. Validate Crafting Recipes ============
  log(`\n${'─'.repeat(50)}`, COLORS.blue);
  log('3. CRAFTING RECIPES VALIDATION', COLORS.blue);
  log('─'.repeat(50), COLORS.blue);

  const recipes = world.craftingRecipes || [];

  if (recipes.length === 0) {
    log(`  ⚠ No crafting recipes found`, COLORS.yellow);
    warningCount++;
  } else {
    log(`  Found ${recipes.length} crafting recipes`, COLORS.green);

    recipes.forEach((recipe, index) => {
      if (!recipe.id) {
        log(`    ✗ Recipe ${index} missing 'id'`, COLORS.red);
        errorCount++;
      } else if (!recipe.resultItemId) {
        log(`    ✗ Recipe '${recipe.id}' missing 'resultItemId'`, COLORS.red);
        errorCount++;
      } else if (!recipe.ingredients || recipe.ingredients.length === 0) {
        log(`    ✗ Recipe '${recipe.id}' has no ingredients`, COLORS.red);
        errorCount++;
      } else {
        log(`    ✓ ${recipe.id} → ${recipe.resultItemId}`, COLORS.green);

        // Check result item exists
        if (!itemIds.has(recipe.resultItemId)) {
          log(`      ✗ Result item '${recipe.resultItemId}' not found in templates`, COLORS.red);
          errorCount++;
        }

        // Check ingredient items exist
        recipe.ingredients.forEach(ingredient => {
          if (!itemIds.has(ingredient.itemId)) {
            log(`      ✗ Ingredient '${ingredient.itemId}' not found (qty: ${ingredient.quantity})`, COLORS.red);
            errorCount++;
          } else if (ingredient.quantity < 1) {
            log(`      ✗ Invalid quantity for '${ingredient.itemId}': ${ingredient.quantity}`, COLORS.red);
            errorCount++;
          }
        });

        // Check facility
        if (recipe.requiredFacility && !['none', 'forge', 'alchemy_bench'].includes(recipe.requiredFacility)) {
          log(`      ⚠ Unknown facility type: '${recipe.requiredFacility}'`, COLORS.yellow);
          warningCount++;
        }
      }
    });
  }

  // ============ 4. Cross-Reference Validation ============
  log(`\n${'─'.repeat(50)}`, COLORS.blue);
  log('4. CROSS-REFERENCE VALIDATION', COLORS.blue);
  log('─'.repeat(50), COLORS.blue);

  // Find items not used in any loot table or recipe
  const usedInLoot = new Set<string>();
  const usedInRecipes = new Set<string>();

  lootTables.forEach(table => {
    table.drops.forEach(drop => usedInLoot.add(drop.itemId));
  });

  recipes.forEach(recipe => {
    usedInRecipes.add(recipe.resultItemId);
    recipe.ingredients.forEach(ing => usedInRecipes.add(ing.itemId));
  });

  let unusedCount = 0;
  itemIds.forEach((item, itemId) => {
    if (!usedInLoot.has(itemId) && !usedInRecipes.has(itemId)) {
      log(`  ⚠ Item '${itemId}' not referenced in loot tables or recipes`, COLORS.yellow);
      unusedCount++;
      warningCount++;
    }
  });

  if (unusedCount === 0) {
    log(`  ✓ All items referenced in loot tables or recipes`, COLORS.green);
  }

  // ============ 5. Summary ============
  log(`\n${'═'.repeat(50)}`, COLORS.cyan);
  log('VALIDATION SUMMARY', COLORS.cyan);
  log('═'.repeat(50), COLORS.cyan);

  log(`\nItems:        ${itemIds.size}`, COLORS.green);
  log(`Loot Tables:  ${lootTables.length}`, COLORS.green);
  log(`Recipes:      ${recipes.length}`, COLORS.green);

  if (errorCount > 0) {
    log(`\n✗ ERRORS:   ${errorCount}`, COLORS.red);
  } else {
    log(`\n✓ ERRORS:   0`, COLORS.green);
  }

  if (warningCount > 0) {
    log(`⚠ WARNINGS: ${warningCount}`, COLORS.yellow);
  } else {
    log(`✓ WARNINGS: 0`, COLORS.green);
  }

  if (errorCount === 0 && warningCount === 0) {
    log(`\n${'═'.repeat(50)}`, COLORS.green);
    log('✓ ALCHEMICAL MANIFEST VALIDATED SUCCESSFULLY', COLORS.green);
    log('═'.repeat(50), COLORS.green);
  } else if (errorCount === 0) {
    log(`\n${'═'.repeat(50)}`, COLORS.yellow);
    log('✓ VALIDATION PASSED (with warnings)', COLORS.yellow);
    log('═'.repeat(50), COLORS.yellow);
  } else {
    log(`\n${'═'.repeat(50)}`, COLORS.red);
    log('✗ VALIDATION FAILED', COLORS.red);
    log('═'.repeat(50), COLORS.red);
    process.exit(1);
  }

  console.log('');
}

verifyWorld();
