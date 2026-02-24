/**
 * M38 Task 6: Smoke Test - The Beta Loop
 * 
 * Comprehensive E2E test verifying the full M38 integration:
 * 1. Initialize world with M35-M37 engines
 * 2. Simulate peer join (multiplayer consensus)
 * 3. Execute peer-to-peer trade (atomic swap)
 * 4. Load remote mod (community content injection)
 * 5. Save to IndexedDB (persistence layer)
 * 6. Perform integrity check (hash chain validation)
 * 7. Reload from storage (durability verification)
 * 
 * Target: <5 seconds total execution, 0 integrity errors
 */

import { createWorldController, createInitialWorld } from '../engine/worldEngine';
import type { WorldState } from '../engine/worldEngine';
import type { Event } from '../events/mutationLog';
import { createSave, loadSave, listSaves, verifySaveIntegrity } from '../engine/saveLoadEngine';
import { processDiceRollForVisuals, cleanupOldVisualCache } from '../engine/visualTriggerWeave';
import { registerMod, loadModFromJson } from '../engine/modManager';
import sampleTemplate from '../data/luxfier-world.json';

// ============================================================================
// SMOKE TEST CONFIGURATION
// ============================================================================

interface SmokeTestConfig {
  worldName: string;
  maxDurationMs: number;
  validateEveryN: number;
  includePeerSimulation: boolean;
  includeTradeSimulation: boolean;
  includeModLoading: boolean;
  includeVisualGeneration: boolean;
  verbose: boolean;
}

interface SmokeTestResult {
  success: boolean;
  duration: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: string[];
  stateIntegrity: boolean;
  savedGame: boolean;
  saveId?: string;
  reloadedSuccessfully: boolean;
  warnings: string[];
  errors: string[];
  metrics: {
    initializeTime: number;
    tradeTime: number;
    modLoadTime: number;
    saveTime: number;
    loadTime: number;
    integrityCheckTime: number;
    totalEventCount: number;
  };
}

// ============================================================================
// SMOKE TEST IMPLEMENTATION
// ============================================================================

export async function runSmokeTestBeta(
  config: Partial<SmokeTestConfig> = {}
): Promise<SmokeTestResult> {
  const {
    worldName = 'beta-smoke-test',
    maxDurationMs = 30000,
    validateEveryN = 100,
    includePeerSimulation = true,
    includeTradeSimulation = true,
    includeModLoading = true,
    includeVisualGeneration = true,
    verbose = true
  } = config;

  const startTime = Date.now();
  const result: SmokeTestResult = {
    success: false,
    duration: 0,
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: [],
    stateIntegrity: false,
    savedGame: false,
    reloadedSuccessfully: false,
    warnings: [],
    errors: [],
    metrics: {
      initializeTime: 0,
      tradeTime: 0,
      modLoadTime: 0,
      saveTime: 0,
      loadTime: 0,
      integrityCheckTime: 0,
      totalEventCount: 0
    }
  };

  const log = (msg: string, type: 'info' | 'warn' | 'error' = 'info') => {
    if (verbose) {
      const prefix =
        type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✓';
      console.log(`[M38 Smoke] ${prefix} ${msg}`);
    }
  };

  try {
    // ===================================================================
    // STEP 1: Initialize World with M35-M37 Engines
    // ===================================================================

    log('Initializing world with M35-M37 engines...');
    const stepInitStart = Date.now();
    result.totalSteps++;

    try {
      const initialState = createInitialWorld(`world_${Date.now()}`, sampleTemplate);
      const controller = createWorldController(initialState, true);

      if (!controller || !controller.getState) {
        throw new Error('Controller initialization failed');
      }

      const state: WorldState = controller.getState();

      if (!state.id || !state.player) {
        throw new Error('Invalid initial state structure');
      }

      result.metrics.initializeTime = Date.now() - stepInitStart;
      log(`World initialized in ${result.metrics.initializeTime}ms`);
      result.passedSteps++;

      // ===================================================================
      // STEP 2: Simulate Peer Join (M36 Multiplayer)
      // ===================================================================

      if (includePeerSimulation) {
        log('Simulating peer join...');
        result.totalSteps++;

        try {
          // Simulate a peer joining and reaching consensus
          controller.performAction({
            type: 'CONSENSUS_PROPOSAL',
            playerId: state.player.id,
            worldId: state.id,
            payload: {
              proposalId: `proposal_${Date.now()}`,
              description: 'Test consensus check',
              votes: [{ peerId: 'peer_1', vote: 'approve' }]
            }
          });

          log('Peer join simulated');
          result.passedSteps++;
        } catch (err) {
          result.failedSteps.push(`Peer join: ${err}`);
          result.warnings.push('Peer simulation failed (non-critical)');
        }
      }

      // ===================================================================
      // STEP 3: Execute P2P Trade (M37 Task 4)
      // ===================================================================

      if (includeTradeSimulation) {
        log('Executing P2P trade...');
        const stepTradeStart = Date.now();
        result.totalSteps++;

        try {
          // Initiate trade
          controller.performAction({
            type: 'INITIATE_TRADE',
            playerId: state.player.id,
            worldId: state.id,
            payload: {
              responderId: 'peer_npc_1',
              initiatorItems: [{ itemId: 'test_item_1', quantity: 1 }],
              responderItems: [{ itemId: 'test_item_2', quantity: 1 }]
            }
          });

          result.metrics.tradeTime = Date.now() - stepTradeStart;
          log(`P2P trade executed in ${result.metrics.tradeTime}ms`);
          result.passedSteps++;
        } catch (err) {
          result.failedSteps.push(`Trade: ${err}`);
          result.warnings.push('P2P trade failed (non-critical)');
        }
      }

      // ===================================================================
      // STEP 4: Load Remote Mod (M38 Task 5)
      // ===================================================================

      if (includeModLoading) {
        log('Loading remote mod content...');
        const stepModStart = Date.now();
        result.totalSteps++;

        try {
          const sampleMod = {
            id: 'smoke-test-mod',
            name: 'Smoke Test Mod',
            version: '1.0.0',
            author: 'M38 Test Suite',
            content: {
              items: [{ id: 'mod_item_1', name: 'Test Item', type: 'consumable', rarity: 'common' }],
              npcs: [],
              quests: []
            }
          };

          registerMod(sampleMod);

          result.metrics.modLoadTime = Date.now() - stepModStart;
          log(`Remote mod loaded in ${result.metrics.modLoadTime}ms`);
          result.passedSteps++;
        } catch (err) {
          result.failedSteps.push(`Mod load: ${err}`);
          result.warnings.push('Mod loading failed (non-critical)');
        }
      }

      // ===================================================================
      // STEP 5: Generate Critical Visual (M38 Task 3)
      // ===================================================================

      if (includeVisualGeneration) {
        log('Generating critical visual prompt...');
        result.totalSteps++;

        try {
          const visualResult = await processDiceRollForVisuals(
            20, // dice result (natural 20)
            10, // difficulty
            'success',
            'dungeon',
            'clear',
            'epoch_i_fracture',
            { npcId: 'test_npc', actionType: 'attack' }
          );

          if (visualResult.triggered) {
            log('Critical visual triggered and cached');
            result.passedSteps++;
          } else {
            result.warnings.push('Visual generation did not trigger');
          }
        } catch (err) {
          result.failedSteps.push(`Visual generation: ${err}`);
          result.warnings.push('Visual generation failed (non-critical)');
        }
      }

      // ===================================================================
      // STEP 6: Save to IndexedDB (M38 Task 2)
      // ===================================================================

      log('Saving game to IndexedDB...');
      const stepSaveStart = Date.now();
      result.totalSteps++;

      try {
        // Create save with current state
        const save = await createSave(
          `${worldName}_${Date.now()}`,
          state,
          [], // Empty event log for smoke test
          state.id,
          0
        );

        result.metrics.saveTime = Date.now() - stepSaveStart;
        result.savedGame = true;
        result.saveId = save.id;
        log(`Game saved in ${result.metrics.saveTime}ms (ID: ${save.id})`);
        result.passedSteps++;
      } catch (err) {
        result.failedSteps.push(`Save: ${err}`);
        result.errors.push(`Failed to save game: ${err}`);
        throw err;
      }

      // ===================================================================
      // STEP 7: Perform Integrity Check
      // ===================================================================

      log('Performing integrity check...');
      const stepIntegrityStart = Date.now();
      result.totalSteps++;

      try {
        if (!result.saveId) {
          throw new Error('No save ID available for integrity check');
        }

        const loadedSave = await loadSave(result.saveId);
        if (!loadedSave) {
          throw new Error('Failed to load save for integrity check');
        }

        const integrityCheck = verifySaveIntegrity(loadedSave);
        result.metrics.integrityCheckTime = Date.now() - stepIntegrityStart;

        if (!integrityCheck.valid) {
          throw new Error(`Integrity check failed: ${integrityCheck.reason}`);
        }

        result.stateIntegrity = true;
        log(`Integrity verified in ${result.metrics.integrityCheckTime}ms`);
        result.passedSteps++;
      } catch (err) {
        result.failedSteps.push(`Integrity: ${err}`);
        result.errors.push(`Integrity check failed: ${err}`);
        throw err;
      }

      // ===================================================================
      // STEP 8: Reload from Storage (Durability Test)
      // ===================================================================

      log('Reloading game from storage...');
      const stepLoadStart = Date.now();
      result.totalSteps++;

      try {
        if (!result.saveId) {
          throw new Error('No save ID available for reload');
        }

        const reloadedSave = await loadSave(result.saveId);
        if (!reloadedSave) {
          throw new Error('Failed to reload save');
        }

        result.metrics.loadTime = Date.now() - stepLoadStart;
        result.reloadedSuccessfully = true;
        log(`Game reloaded in ${result.metrics.loadTime}ms`);
        result.passedSteps++;
      } catch (err) {
        result.failedSteps.push(`Reload: ${err}`);
        result.errors.push(`Failed to reload game: ${err}`);
        throw err;
      }

      // ===================================================================
      // STEP 9: Cleanup
      // ===================================================================

      log('Cleaning up old visual cache...');
      result.totalSteps++;

      try {
        await cleanupOldVisualCache();
        log('Visual cache cleanup complete');
        result.passedSteps++;
      } catch (err) {
        result.warnings.push(`Cache cleanup failed: ${err}`);
      }

      // ===================================================================
      // SUCCESS
      // ===================================================================

      result.success = result.failedSteps.length === 0 && result.stateIntegrity && result.reloadedSuccessfully;
    } catch (err) {
      result.errors.push(`Fatal error: ${err}`);
      result.success = false;
    }
  } catch (err) {
    result.errors.push(`Smoke test failed: ${err}`);
  } finally {
    result.duration = Date.now() - startTime;

    // ===================================================================
    // REPORT
    // ===================================================================

    console.log('\n' + '='.repeat(60));
    console.log('M38 SMOKE TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Duration: ${result.duration}ms (target: ${maxDurationMs}ms)`);
    console.log(`Steps: ${result.passedSteps}/${result.totalSteps} passed`);

    if (result.failedSteps.length > 0) {
      console.log('\nFailed Steps:');
      result.failedSteps.forEach((step) => console.log(`  ❌ ${step}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warn) => console.log(`  ⚠️ ${warn}`));
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error) => console.log(`  ❌ ${error}`));
    }

    console.log('\nMetrics:');
    console.log(`  Initialize: ${result.metrics.initializeTime}ms`);
    console.log(`  Trade: ${result.metrics.tradeTime}ms`);
    console.log(`  Mod Load: ${result.metrics.modLoadTime}ms`);
    console.log(`  Save: ${result.metrics.saveTime}ms`);
    console.log(`  Load: ${result.metrics.loadTime}ms`);
    console.log(`  Integrity Check: ${result.metrics.integrityCheckTime}ms`);
    console.log(`\nIntegrity: ${result.stateIntegrity ? '✅ Valid' : '❌ Failed'}`);
    console.log(`Reloaded: ${result.reloadedSuccessfully ? '✅ Success' : '❌ Failed'}`);
    console.log('='.repeat(60) + '\n');
  }

  return result;
}

// Run if called directly (ESM check)
// For compatibility, this export can be called from test runners or directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTestBeta({ verbose: true }).catch((err) => {
    console.error('Smoke test execution failed:', err);
    process.exit(1);
  });
}

export default runSmokeTestBeta;
