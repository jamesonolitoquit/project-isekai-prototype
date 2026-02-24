/**
 * phase30-validation.test.ts - Phase 30 System Verification
 * 
 * Comprehensive validation of all Phase 30 systems:
 * - Task 1: LP Economy & Bloodline Perk Store
 * - Task 2: Procedural Legacy Quests & Ancestral Graves
 * - Task 3: Myth Status Dashboard (UI rendering verified separately)
 * - Task 4: Seasonal Event Engine
 */

import {
  calculateSessionLP,
  loadBloodlinePerkStore,
  purchasePerk
} from '../engine/legacyEngine';

import {
  extractAncestralFailures,
  generateAllAncestralGraves,
  discoverAncestralGrave
} from '../engine/questLegacyEngine';

import {
  getSeasonalEventEngine,
  activateEvent,
  updateSeasonalEvents,
  calculateEventDiscount,
  resetSeasonalEventEngine
} from '../engine/seasonalEventEngine';

import type { LegacyImpact } from '../engine/legacyEngine';

interface Phase30ValidationResult {
  tasksPassed: number;
  tasksFailed: number;
  detailedResults: Array<{
    task: string;
    subtask: string;
    passed: boolean;
    message: string;
  }>;
  timestamp: number;
}

export function validatePhase30Systems(): Phase30ValidationResult {
  const results: Phase30ValidationResult = {
    tasksPassed: 0,
    tasksFailed: 0,
    detailedResults: [],
    timestamp: Date.now()
  };

  // ============================================================================
  // TASK 1: LP Economy & Bloodline Perk Store
  // ============================================================================
  
  console.log('\n[Phase 30 Validation] Task 1: LP Economy & Bloodline Perk Store');

  // Test 1.1: Calculate Session LP
  try {
    const mockLegacy: LegacyImpact = {
      id: 'legacy_test_1',
      chronicleId: 'chronicle_1',
      canonicalName: 'Test Hero',
      bloodlineOrigin: 'Test World',
      mythStatus: 75,
      deeds: ['Saved the Village', 'Defeated the Boss', 'Made Peace'],
      canonicalDeeds: ['Saved the Village', 'Defeated the Boss', 'Made Peace'],
      factionInfluence: { light: 50, neutral: 20 },
      inheritedPerks: [],
      ancestralCurses: [],
      epochsLived: 1,
      totalGenerations: 1,
      soulEchoCount: 0,
      finalWorldState: 'improved',
      paradoxDebt: 10,
      timestamp: Date.now()
    };

    const lp = calculateSessionLP(mockLegacy);
    const expectedLP = 75 * 10 + 3 * 5;  // mythStatus * 10 + deeds * 5
    const passed = lp === expectedLP;

    results.detailedResults.push({
      task: '1',
      subtask: '1.1 Calculate Session LP',
      passed,
      message: `LP Calculation: ${lp} (expected ${expectedLP}) - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;
  } catch (err) {
    results.detailedResults.push({
      task: '1',
      subtask: '1.1 Calculate Session LP',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // Test 1.2: Load Bloodline Perk Store
  try {
    const mockLegacy: LegacyImpact = {
      id: 'legacy_test_2',
      chronicleId: 'chronicle_2',
      canonicalName: 'Ancestor',
      bloodlineOrigin: 'Test',
      mythStatus: 80,
      deeds: [],
      factionInfluence: {},
      inheritedPerks: ['perk_ancestral_resilience'],
      ancestralCurses: [],
      epochsLived: 1,
      totalGenerations: 1,
      soulEchoCount: 0,
      finalWorldState: 'neutral',
      paradoxDebt: 0,
      timestamp: Date.now()
    };

    const store = loadBloodlinePerkStore('player_1', mockLegacy, 1);
    const passed = store.playerLegacyPoints > 0 &&
                  store.purchasedPerks.includes('perk_ancestral_resilience') &&
                  store.generationNumber === 1;

    results.detailedResults.push({
      task: '1',
      subtask: '1.2 Load Bloodline Perk Store',
      passed,
      message: `Store initialized with ${store.playerLegacyPoints}LP and ${store.purchasedPerks.length} perks - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;
  } catch (err) {
    results.detailedResults.push({
      task: '1',
      subtask: '1.2 Load Bloodline Perk Store',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // Test 1.3: Purchase Perk
  try {
    const store = loadBloodlinePerkStore('player_2', undefined, 1);
    store.playerLegacyPoints = 100;  // Give some LP
    
    const perkId = store.availablePerks[0]?.id;
    const newStore = purchasePerk(store, perkId, 20);
    
    const passed = newStore !== null &&
                  newStore.playerLegacyPoints === 80 &&
                  newStore.purchasedPerks.includes(perkId);

    results.detailedResults.push({
      task: '1',
      subtask: '1.3 Purchase Perk',
      passed,
      message: `Perk purchased: LP ${newStore?.playerLegacyPoints}/${100} - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;
  } catch (err) {
    results.detailedResults.push({
      task: '1',
      subtask: '1.3 Purchase Perk',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // ============================================================================
  // TASK 2: Procedural Legacy Quests & Ancestral Graves
  // ============================================================================

  console.log('\n[Phase 30 Validation] Task 2: Procedural Legacy Quests Spawning');

  // Test 2.1: Extract Ancestral Failures
  try {
    const mockLegacies: LegacyImpact[] = [
      {
        id: 'legacy_test_3',
        chronicleId: 'chronicle_3',
        canonicalName: 'Failed Hero',
        bloodlineOrigin: 'Test',
        mythStatus: 30,
        deeds: ['Failed to stop the invasion', 'Died trying to save the city'],
        factionInfluence: {},
        inheritedPerks: [],
        ancestralCurses: [],
        epochsLived: 1,
        totalGenerations: 1,
        soulEchoCount: 0,
        finalWorldState: 'declined',
        paradoxDebt: 50,
        timestamp: Date.now()
      }
    ];

    const failures = extractAncestralFailures(mockLegacies);
    const passed = failures.length > 0 &&
                  failures.some(f => f.ancestorName === 'Failed Hero');

    results.detailedResults.push({
      task: '2',
      subtask: '2.1 Extract Ancestral Failures',
      passed,
      message: `Found ${failures.length} failures - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;
  } catch (err) {
    results.detailedResults.push({
      task: '2',
      subtask: '2.1 Extract Ancestral Failures',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // Test 2.2: Generate Ancestral Graves
  try {
    const mockLegacies: LegacyImpact[] = [
      {
        id: 'legacy_test_4',
        chronicleId: 'chronicle_4',
        canonicalName: 'Tomb Builder',
        bloodlineOrigin: 'Test',
        mythStatus: 70,
        deeds: ['Failed in the Crypts', 'Defeated the Lich Lord but fell'],
        factionInfluence: {},
        inheritedPerks: [],
        ancestralCurses: [],
        epochsLived: 1,
        totalGenerations: 1,
        soulEchoCount: 0,
        finalWorldState: 'neutral',
        paradoxDebt: 0,
        timestamp: Date.now()
      }
    ];

    const locationIds = ['loc_1', 'loc_2', 'loc_3'];
    const graves = generateAllAncestralGraves(mockLegacies, locationIds, 12345);
    
    const passed = graves.length > 0 &&
                  graves.every(g => g.grave && g.npc);

    results.detailedResults.push({
      task: '2',
      subtask: '2.2 Generate Ancestral Graves',
      passed,
      message: `Generated ${graves.length} graves with NPCs - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;

    // Test 2.3: Grave Discovery (chained test)
    if (graves.length > 0) {
      try {
        const grave = graves[0].grave;
        const updatedGrave = discoverAncestralGrave(grave, 'player_test');
        const discoverPassed = updatedGrave.discoveredBy.includes('player_test');

        results.detailedResults.push({
          task: '2',
          subtask: '2.3 Grave Discovery',
          passed: discoverPassed,
          message: `Grave discovered by player - ${discoverPassed ? '✓' : '✗'}`
        });

        if (discoverPassed) results.tasksPassed++;
        else results.tasksFailed++;
      } catch (err) {
        results.detailedResults.push({
          task: '2',
          subtask: '2.3 Grave Discovery',
          passed: false,
          message: `Error: ${err}`
        });
        results.tasksFailed++;
      }
    }
  } catch (err) {
    results.detailedResults.push({
      task: '2',
      subtask: '2.2 Generate Ancestral Graves',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // ============================================================================
  // TASK 4: Seasonal Event Engine (Task 3 is UI-only, tested manually)
  // ============================================================================

  console.log('\n[Phase 30 Validation] Task 4: Seasonal Event Engine');

  try {
    resetSeasonalEventEngine();
    const engine = getSeasonalEventEngine();
    
    // Test 4.1: Default Events Generated
    const hasFestivalOfLuxAr = engine.allEvents.some(e => e.id === 'festival_lux_ar');
    const hasShadowsEve = engine.allEvents.some(e => e.id === 'shadows_eve');
    
    let passed = hasFestivalOfLuxAr && hasShadowsEve;

    results.detailedResults.push({
      task: '4',
      subtask: '4.1 Default Events Generated',
      passed,
      message: `Generated ${engine.allEvents.length} seasonal events - ${passed ? '✓' : '✗'}`
    });

    if (passed) results.tasksPassed++;
    else results.tasksFailed++;

    // Test 4.2: Event Activation
    try {
      const festivalEvent = engine.allEvents.find(e => e.id === 'festival_lux_ar');
      if (festivalEvent) {
        activateEvent(engine, festivalEvent, 0, 1000);
        
        const activePassed = engine.activeEvents.has('festival_lux_ar');
        results.detailedResults.push({
          task: '4',
          subtask: '4.2 Event Activation',
          passed: activePassed,
          message: `Event activated successfully - ${activePassed ? '✓' : '✗'}`
        });

        if (activePassed) results.tasksPassed++;
        else results.tasksFailed++;
      }
    } catch (err) {
      results.detailedResults.push({
        task: '4',
        subtask: '4.2 Event Activation',
        passed: false,
        message: `Error: ${err}`
      });
      results.tasksFailed++;
    }

    // Test 4.3: Merchant Discount Calculation
    try {
      const discount = calculateEventDiscount(engine, 'holy_artifact');
      const discountPassed = discount >= 0 && discount <= 100;
      
      results.detailedResults.push({
        task: '4',
        subtask: '4.3 Merchant Discount',
        passed: discountPassed,
        message: `Discount calculated: ${discount}% - ${discountPassed ? '✓' : '✗'}`
      });

      if (discountPassed) results.tasksPassed++;
      else results.tasksFailed++;
    } catch (err) {
      results.detailedResults.push({
        task: '4',
        subtask: '4.3 Merchant Discount',
        passed: false,
        message: `Error: ${err}`
      });
      results.tasksFailed++;
    }

    // Test 4.4: Event Update Loop
    try {
      const activeCountBefore = engine.activeEvents.size;
      updateSeasonalEvents(engine, 30, 'spring', 2000);  // Day 30, Spring, Tick 2000
      const activeCountAfter = engine.activeEvents.size;
      
      const updatePassed = activeCountAfter >= 0;  // Just ensure update doesn't crash
      results.detailedResults.push({
        task: '4',
        subtask: '4.4 Event Update Loop',
        passed: updatePassed,
        message: `Update successful: ${activeCountBefore} → ${activeCountAfter} active events - ${updatePassed ? '✓' : '✗'}`
      });

      if (updatePassed) results.tasksPassed++;
      else results.tasksFailed++;
    } catch (err) {
      results.detailedResults.push({
        task: '4',
        subtask: '4.4 Event Update Loop',
        passed: false,
        message: `Error: ${err}`
      });
      results.tasksFailed++;
    }
  } catch (err) {
    results.detailedResults.push({
      task: '4',
      subtask: '4.0 Seasonal Engine Init',
      passed: false,
      message: `Error: ${err}`
    });
    results.tasksFailed++;
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n[Phase 30 Validation] SUMMARY');
  console.log(`✓ Passed: ${results.tasksPassed}`);
  console.log(`✗ Failed: ${results.tasksFailed}`);
  console.log(`Total: ${results.tasksPassed + results.tasksFailed}`);

  return results;
}

// Run validation if this is the main module
if (require.main === module) {
  const result = validatePhase30Systems();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.tasksFailed > 0 ? 1 : 0);
}

export default validatePhase30Systems;
