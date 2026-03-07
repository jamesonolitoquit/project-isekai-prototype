/**
 * Phase 20: 1,000-Year Dry Run Verification
 * 
 * Purpose: Verify Material Evolution and Bloodline Divergence during Epoch transitions.
 * Run: cd BETA; npx ts-node scripts/phase20-dry-run.ts
 */

import { advanceToNextEpoch } from '../src/engine/chronicleEngine';
import { getLegacyEngine } from '../src/engine/legacyEngine';
import { getWorldTemplate } from '../src/engine/worldEngine';

async function runPhase20DryRun() {
  console.log('🚀 Starting Phase 20 Dry Run: Material & Bloodline Evolution');
  console.log('==========================================================\n');

  const legacyEngine = getLegacyEngine(42);
  const ticksPerEpoch = 1440;

  // 1. Setup Initial State (Epoch I)
  // We include a Valerius NPC to test bloodline divergence
  const initialState: any = {
    id: 'world_phase20_test',
    tick: ticksPerEpoch,
    epochId: 'epoch_i_awakening',
    chronicleId: 'chronicle_p20',
    seed: 42,
    player: {
      id: 'player_p20',
      location: 'astral_nexus',
      level: 10,
      factionReputation: { 'Solar Aegis': 50 },
      statusEffects: [],
      inventory: [
        { itemId: 'starlight-iron', quantity: 5 },
        { itemId: 'common-iron', quantity: 10 }
      ]
    },
    playerAlignment: 80, // High alignment for Blessed mutation
    npcs: [
      {
        id: 'npc_valerius_elder',
        name: 'Elder Valerius',
        family: 'Valerius',
        location: 'astral_nexus',
        traits: ['noble']
      }
    ]
  };

  console.log('📦 Initial Inventory:', JSON.stringify(initialState.player.inventory));
  console.log('👥 Initial NPCs:', initialState.npcs.map((n: any) => `${n.name} (${n.family})`).join(', '));

  // 2. Generate Legacy (Simulate player actions)
  // We'll give high myth status to trigger "Blessed" evolutions
  const legacy = legacyEngine.transmitSoulEchoes(initialState, 'Protagonist');
  (legacy as any).mythStatus = 150; 

  console.log(`\n✨ Legacy Generated: ${legacy.id} (Myth Status: 150)`);

  // 3. Advance to Epoch II
  console.log('\n🔄 Advancing to Next Epoch...');
  const agedState = advanceToNextEpoch(initialState, legacy);

  // 4. Verify Results
  console.log('\n📊 Transition Results:');
  console.log('---------------------');

  // Check Item Evolution
  const finalInventory = (agedState as any).player?.inventory || [];
  const fossilized = finalInventory.find((i: any) => i.itemId === 'fossilized-starlight');
  const commonIron = finalInventory.find((i: any) => i.itemId === 'common-iron');

  if (fossilized) {
    console.log(`✅ SUCCESS: starlight-iron evolved into fossilized-starlight (Qty: ${fossilized.quantity})`);
  } else {
    console.log('❌ FAILURE: starlight-iron did not evolve.');
  }

  if (commonIron) {
    console.log(`ℹ️ common-iron remained common-iron (as expected).`);
  }

  // Check Bloodline Divergence
  const finalNpcs = (agedState as any).npcs || [];
  const valeriusDescendant = finalNpcs.find((n: any) => n.family === 'Valerius');

  if (valeriusDescendant) {
    console.log(`✅ SUCCESS: Valerius lineage persisted as: ${valeriusDescendant.name}`);
    if (valeriusDescendant.traits.includes('Blessed Protector')) {
      console.log(`🌟 SUCCESS: Lineage mutated to "Blessed Protector" due to high Myth Status.`);
    } else {
      console.log(`⚠️  Lineage persisted but did not mutate Expected Trait. Traits: ${valeriusDescendant.traits.join(', ')}`);
    }
  } else {
    console.log('❌ FAILURE: Valerius lineage was lost during transition.');
  }

  console.log(`\n🏁 Dry Run Finished. New Epoch: ${(agedState as any).epochId}`);
}

runPhase20DryRun().catch(console.error);
