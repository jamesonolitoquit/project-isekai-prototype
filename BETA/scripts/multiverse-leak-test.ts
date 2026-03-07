import createWorldController from '../src/engine/worldEngine';
import { multiverseAdapter } from '../src/engine/multiverseAdapter';
import * as npcEngine from '../src/engine/npcEngine';
import { DatabaseAdapter, getDatabaseAdapter } from '../src/engine/databaseAdapter';

/**
 * Phase 29 verification script: Multiverse Leak Test
 * 
 * Tests that high global paradox levels correctly trigger:
 * 1. Multiverse visuals in the world state.
 * 2. Dissonance dialogue from the Chronicler NPC.
 * 3. Accurate sync between DB and world instances.
 */
async function runTest() {
  console.log('--- STARTING MULTIVERSE LEAK TEST ---');

  // 1. Mock the database adapter's global paradox average
  // We use a high paradox value to trigger "PARADOX_CASCADE" and visual/dialogue effects
  const dbAdapter = getDatabaseAdapter();
  if (dbAdapter) {
    (dbAdapter as any).getGlobalParadoxAverage = async () => 0.95;
    console.log('[TEST] Mocked Global Paradox Average set to: 0.95');
  } else {
    console.log('[TEST] No database adapter found, skipping mock');
  }

  // 2. Initialize the world controller
  const controller = createWorldController(undefined, true);
  
  // 3. Advance the tick to trigger the sync poll
  console.log('[TEST] Advancing tick to trigger multiverse sync...');
  await (controller as any).advanceTick(1);

  const state = (controller as any).state;
  const currentTick = state.tick;
  console.log(`[TEST] Current Tick: ${currentTick}`);

  // 4. Verify Visual Overrides
  console.log('[TEST] Checking visual overrides...');
  const bleed = state.visualOverrides?.multiverseBleed;
  if (bleed && bleed.tint === '#inverse_rgb') {
    console.log('✅ Visual Check PASSED: Correctly active paradoxBleedEffects detected.');
  } else {
    console.warn('❌ Visual Check FAILED: No multiversal bleed detected in world state.', state.visualOverrides);
  }

  // 5. Verify Dialogue Dissonance
  console.log('[TEST] Checking chronicler dialogue dissonance...');
  // Force simulate dialogue for the Chronicler
  const npc = state.npcs?.find(n => n.id === 'chronicler_main');
  if (npc) {
    const dialogue = (npcEngine as any).getStaticFallbackResponse(npc, state);
    const hasDissonanceText = dialogue.includes('thousand blacksmiths') || dialogue.includes('shadows are bleeding');
    if (hasDissonanceText) {
      console.log('✅ Dialogue Check PASSED: Chronicler spoke multiversal dissonance.');
      console.log(` > ${dialogue}`);
    } else {
      // Since it's probabilistic (30%), we might need to try a few times or force mock
      console.log('[TEST] First dialogue attempt was normal static line. Retrying with force probability...');
      // Temporarily override Math.random to force true
      const oldRandom = Math.random;
      Math.random = () => 0.1; 
      const forcedDialogue = (npcEngine as any).getStaticFallbackResponse(npc, state);
      Math.random = oldRandom;
      
      if (forcedDialogue.includes('thousand blacksmiths') || forcedDialogue.includes('shadows are bleeding')) {
        console.log('✅ Dialogue Check PASSED: Forced probability yielded dissonance correctly.');
      } else {
        console.warn('❌ Dialogue Check FAILED: No dissonance found in dialogue pool.');
      }
    }
  } else {
    console.warn('❌ Setup Error: Chronicler NPC not found in template.');
  }

  // 6. Verify Active Triggers
  const triggers = multiverseAdapter.getActiveTriggers();
  const hasCascade = triggers.some(t => t.id === 'PARADOX_CASCADE');
  if (hasCascade) {
    console.log('✅ Trigger Check PASSED: PARADOX_CASCADE active.');
  } else {
    console.warn('❌ Trigger Check FAILED: PARADOX_CASCADE not active at 0.95 paradox.');
  }

  console.log('--- TEST COMPLETE ---');
}

runTest().catch(console.error);
