/**
 * Phase 22: Live Ops Smoke Test
 * 
 * Verifies that dynamic rule injection and hot-swapping work correctly
 * Run: npx ts-node BETA/scripts/live-ops-smoke-test.ts
 */

import { getRuleIngestionEngine, resetRuleIngestionEngine } from '../src/engine/ruleIngestionEngine';
import { getWorldTemplate, hotSwapTemplate } from '../src/engine/worldEngine';
import { rollCriticalStrike } from '../src/engine/ruleEngine';
import { SeededRng, setGlobalRng } from '../src/engine/prng';
import type { CombatantStats } from '../src/engine/ruleEngine';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, testName: string): void {
  if (!condition) {
    results.push({ name: testName, passed: false, message });
    console.log(`  ❌ FAIL: ${message}`);
  } else {
    results.push({ name: testName, passed: true, message });
    console.log(`  ✅ PASS: ${message}`);
  }
}

function testInitialRuleLoading(): void {
  console.log('\n📋 Test 1: Initial Rule Loading');
  
  resetRuleIngestionEngine();
  const template = getWorldTemplate();
  
  assert(template !== null, 'Template is loaded', 'Initial Template Load');
  
  const engine = getRuleIngestionEngine();
  engine.initialize(template);
  
  const critMult = engine.getCombatFormulaOverride('critMultiplier');
  assert(critMult === 3.5, `Critical multiplier override is 3.5 (got ${critMult})`, 'Crit Multiplier Override');
  
  const baseCrit = engine.getCombatFormulaOverride('baseCritChance');
  assert(baseCrit === 8, `Base critical chance is 8 (got ${baseCrit})`, 'Base Crit Chance Override');
}

function testCustomMacroEvents(): void {
  console.log('\n📋 Test 2: Custom Macro Events');
  
  const engine = getRuleIngestionEngine();
  
  const hasLiveFestival = engine.hasCustomMacroEvent('LIVE_FESTIVAL');
  assert(hasLiveFestival, 'LIVE_FESTIVAL event is registered', 'LIVE_FESTIVAL Registered');
  
  const hasVoidIncursion = engine.hasCustomMacroEvent('VOID_INCURSION');
  assert(hasVoidIncursion, 'VOID_INCURSION event is registered', 'VOID_INCURSION Registered');
  
  const festivalDef = engine.getCustomMacroEvent('LIVE_FESTIVAL');
  assert(festivalDef?.name === 'The Golden Age Festival', 'LIVE_FESTIVAL has correct name', 'Festival Name');
  assert(festivalDef?.modifierEffects?.length === 2, 'LIVE_FESTIVAL has 2 modifier effects', 'Festival Effects Count');
}

function testCombatFormulaImpact(): void {
  console.log('\n📋 Test 3: Combat Formula Impact');
  
  // Initialize RNG for this test
  const rng = new SeededRng(42);
  setGlobalRng(rng);
  
  const attacker: CombatantStats = {
    str: 15,
    agi: 12,
    int: 10,
    cha: 10,
    end: 14,
    luk: 20
  };

  let critCount = 0;
  for (let i = 0; i < 100; i++) {
    const result = rollCriticalStrike(attacker);
    if (result.critical) {
      critCount++;
    }
  }
  
  assert(critCount > 5, `Got ${critCount} crits out of 100 (increased from default)`, 'Increased Crit Rate');
  
  const engine = getRuleIngestionEngine();
  const critMult = engine.getCombatFormulaOverride('critMultiplier');
  assert(critMult === 3.5, 'Crit multiplier override is active at 3.5x', 'Crit Multiplier Active');
}

function testHotSwap(): void {
  console.log('\n📋 Test 4: Hot-Swap Template');
  
  const originalTemplate = getWorldTemplate();
  const modifiedTemplate = JSON.parse(JSON.stringify(originalTemplate));
  
  if (!modifiedTemplate.injectedRules) {
    modifiedTemplate.injectedRules = {};
  }
  if (!modifiedTemplate.injectedRules.combatFormulas) {
    modifiedTemplate.injectedRules.combatFormulas = {};
  }
  
  modifiedTemplate.injectedRules.combatFormulas.critMultiplier = 5.0;
  
  console.log('  🔄 Hot-swapping template...');
  hotSwapTemplate(modifiedTemplate);
  
  const engine = getRuleIngestionEngine();
  const newCritMult = engine.getCombatFormulaOverride('critMultiplier');
  assert(newCritMult === 5.0, `After hot-swap, crit multiplier is 5.0 (got ${newCritMult})`, 'Hot-Swap Crit Multiplier');
}

function testDiagnostics(): void {
  console.log('\n📋 Test 5: Diagnostics & Logging');
  
  const engine = getRuleIngestionEngine();
  const log = engine.getInjectionLog();
  
  assert(log.length > 0, `Injection log has ${log.length} entries`, 'Log Has Entries');
  
  const hasRuleLogging = log.some(entry => entry.type === 'COMBAT_FORMULA');
  assert(hasRuleLogging, 'Log contains COMBAT_FORMULA entries', 'Combat Formula Logged');
  
  const hasMacroEventLogging = log.some(entry => entry.type === 'MACRO_EVENT');
  assert(hasMacroEventLogging, 'Log contains MACRO_EVENT entries', 'Macro Event Logged');
}

async function runTests(): Promise<void> {
  console.log('🚀 Phase 22: Live Ops Smoke Test');
  console.log('==================================================\n');
  
  try {
    testInitialRuleLoading();
    testCustomMacroEvents();
    testCombatFormulaImpact();
    testHotSwap();
    testDiagnostics();
  } catch (error) {
    console.error('❌ Test suite crashed:', error);
    results.push({
      name: 'Test Suite',
      passed: false,
      message: `Crashed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
  
  console.log('\n==================================================');
  console.log('📊 TEST SUMMARY:');
  console.log('==================================================\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }
  
  const allPassed = failed === 0;
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 PHASE 22 LIVE OPS SMOKE TEST PASSED!');
  } else {
    console.log('⚠️  Some tests failed - review above');
  }
  console.log('='.repeat(50) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
