/**
 * Phase 27: Patch Merge Validation Test
 * Tests the mergePatch and applyLiveOpsPatch functions
 */

import * as path from 'path';
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.NEXT_PUBLIC_FORCE_TEMPLATE = 'true';

import { mergePatch, applyLiveOpsPatch } from '../src/engine/worldEngine';
import templateJson from '../src/data/luxfier-world.json';
import patchJson from '../src/data/void-wastes-patch.json';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function recordTest(name: string, passed: boolean, message: string, details?: any): void {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
}

async function runTests(): Promise<void> {
  console.log('\n🔧 Phase 27: Patch Merge Validation Test\n');

  // Test 1: Basic patch merge
  console.log('📋 Test 1: Basic Patch Merge');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any, { dryRun: true });
    assert(merged !== null, 'Merge should succeed');
    // Patch should preserve base template structure and add patch properties
    assert(merged.injectedRules?.combatFormulas?.voidDamageAmplification === 1.8, 'Patch properties should be merged');
    recordTest('Basic Merge (Dry Run)', true, 'Patch validated and merged successfully');
  } catch (e: any) {
    recordTest('Basic Merge', false, `Error: ${e.message}`);
  }

  // Test 2: Verify seasonal rules merged
  console.log('\n📋 Test 2: Seasonal Rules Merging');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const winterMods = merged.seasonalRules?.WINTER;
    assert(winterMods !== undefined, 'Winter mods should exist in merged template');
    assert(winterMods.mechanicalModifiers?.manaRegenMult === 0.6, 'Winter mana regen override should be 0.6');
    assert(winterMods.mechanicalModifiers?.movementFatigueMult === 3.0, 'Winter fatigue mult should be 3.0');
    
    recordTest('Seasonal Rules', true, `Winter modifiers merged (manaRegen: ${winterMods.mechanicalModifiers?.manaRegenMult}x, fatigue: ${winterMods.mechanicalModifiers?.movementFatigueMult}x)`);
  } catch (e: any) {
    recordTest('Seasonal Rules Merging', false, `Error: ${e.message}`);
  }

  // Test 3: Verify custom macro events merged
  console.log('\n📋 Test 3: Custom Macro Events Merging');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const customEvents = merged.injectedRules?.customMacroEvents;
    assert(customEvents !== undefined, 'Custom events should exist in merged template');
    
    const voidConvergence = customEvents.find((e: any) => e.type === 'VOID_CONVERGENCE');
    assert(voidConvergence !== undefined, 'VOID_CONVERGENCE should be added by patch');
    assert(voidConvergence.baseSeverity === 100, 'VOID_CONVERGENCE severity should be 100');
    
    // Arrays replace entirely (not merged), so patch's custom events replace base template's
    assert(customEvents.length === 1, 'Array should be replaced (only patch events present)');
    
    recordTest('Custom Macro Events', true, `${customEvents.length} event (patch replaces entire array)`);
  } catch (e: any) {
    recordTest('Custom Macro Events Merging', false, `Error: ${e.message}`);
  }

  // Test 4: Verify combat formulas merged
  console.log('\n📋 Test 4: Combat Formulas Merging');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const combatFormulas = merged.injectedRules?.combatFormulas;
    assert(combatFormulas !== undefined, 'Combat formulas should exist');
    
    // Base should be preserved
    assert(combatFormulas.critMultiplier === 3.5, 'Base critMultiplier should be preserved');
    assert(combatFormulas.baseCritChance === 8, 'Base baseCritChance should be preserved');
    
    // New patch property should be added
    assert(combatFormulas.voidDamageAmplification === 1.8, 'New voidDamageAmplification should be added');
    
    recordTest('Combat Formulas', true, `Merged with new property (voidDamageAmplification: ${combatFormulas.voidDamageAmplification})`);
  } catch (e: any) {
    recordTest('Combat Formulas Merging', false, `Error: ${e.message}`);
  }

  // Test 5: Hard facts preservation
  console.log('\n📋 Test 5: Hard Facts Preservation');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const epicSoulEvents = merged.epicSoulEvents;
    const baseEpicSoulEvents = (templateJson as any).epicSoulEvents;
    
    assert(epicSoulEvents !== undefined, 'Epic soul events should be preserved');
    assert(epicSoulEvents.length === baseEpicSoulEvents.length, 'Hard facts should not be modified by patch');
    
    const firstFact = epicSoulEvents[0];
    assert(firstFact.isImmutable === true, 'Hard facts should remain immutable');
    
    recordTest('Hard Facts', true, `${epicSoulEvents.length} immutable hard facts preserved`);
  } catch (e: any) {
    recordTest('Hard Facts Preservation', false, `Error: ${e.message}`);
  }

  // Test 6: Patch validation (paradox check)
  console.log('\n📋 Test 6: Paradox Detection');
  try {
    // Create an extreme patch that would cause paradox
    const extremePatch = {
      ...patchJson,
      injectedRules: {
        combatFormulas: {
          critMultiplier: 1000  // 1000x variance - should be rejected
        }
      }
    };
    
    const merged = mergePatch(templateJson as any, extremePatch, {
      validateHardFacts: true,
      checkParadox: true
    });
    
    assert(merged === null, 'Extreme paradox patch should be rejected');
    recordTest('Paradox Detection', true, 'Patch with extreme variance correctly rejected');
  } catch (e: any) {
    recordTest('Paradox Detection', false, `Error: ${e.message}`);
  }

  // Test 7: Patch history tracking
  console.log('\n📋 Test 7: Patch History Tracking');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const patchHistory = merged._patchHistory;
    assert(patchHistory !== undefined, 'Patch history should be tracked');
    assert(patchHistory.length > 0, 'At least one patch should be in history');
    
    const lastPatch = patchHistory[patchHistory.length - 1];
    assert(lastPatch.status === 'applied', 'Patch should be marked as applied');
    assert(lastPatch.patchId === (patchJson as any).id, 'Patch ID should be recorded');
    
    recordTest('Patch History', true, `${patchHistory.length} patch(es) tracked (id: ${lastPatch.patchId})`);
  } catch (e: any) {
    recordTest('Patch History Tracking', false, `Error: ${e.message}`);
  }

  // Test 8: Array replacement (not merge)
  console.log('\n📋 Test 8: Array Replacement Behavior');
  try {
    const merged = mergePatch(templateJson as any, patchJson as any);
    assert(merged !== null, 'Merge should not be null');
    
    const seasonalLoot = merged.seasonalRules?.WINTER?.seasonalLoot;
    assert(seasonalLoot !== undefined, 'Seasonal loot should be added by patch');
    
    // Patch adds only void-touched-shard, should replace (not merge) the array
    const hasVoidShard = seasonalLoot.some((item: any) => item.itemId === 'void-touched-shard');
    assert(hasVoidShard === true, 'void-touched-shard should exist from patch');
    
    // Array replacement means old items like frost-touched-berries should NOT exist
    const hasFrostBerries = seasonalLoot.some((item: any) => item.itemId === 'frost-touched-berries');
    assert(hasFrostBerries === false, 'Old frost-touched-berries should not exist (array replaced)');
    
    recordTest('Array Replacement', true, `Array correctly replaced (${seasonalLoot.length} items from patch only)`);
  } catch (e: any) {
    recordTest('Array Replacement', false, `Error: ${e.message}`);
  }

  // Summary
  console.log('\n==================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`📊 TEST SUMMARY:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  console.log('==================================================\n');

  if (failed === 0) {
    console.log('🎉 Phase 27: PATCH MERGE VALIDATION PASSED!');
    console.log('\n✨ Live Ops patch system ready for deployment!');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
