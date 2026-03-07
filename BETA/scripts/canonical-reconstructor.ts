/**
 * Phase 24: Canonical Reconstruction Smoke Test
 * 
 * Verifies the weights and immutable anchors of world history:
 * 1. Test pruning logic (minImportanceForCanonicalStatus)
 * 2. Verify Epic Soul Events (isImmutable check)
 * 3. Verify name mutations across epochs
 */

import { getWorldTemplate } from '../src/engine/worldEngine';

async function runTests(): Promise<void> {
  console.log('🚀 Phase 24: Canonical Persistence Smoke Test');
  process.env.NEXT_PUBLIC_FORCE_TEMPLATE = 'true';

  const template = getWorldTemplate();
  if (!template) {
    console.error('❌ Failed to load world template.');
    process.exit(1);
  }

  // 1. Verify Pruning Weights
  console.log('\n--- Narrative Pruning Weights ---');
  const weights = template.narrativePruningWeights;
  if (weights && weights.minImportanceForCanonicalStatus === 7) {
    console.log('✅ SUCCESS: Retention threshold detected (7)');
    if (weights.eventTypeWeights.FACTION_COLLAPSE === 10) {
      console.log('✅ SUCCESS: Faction collapse weight is max (10)');
    }
  } else {
    console.log('❌ FAILURE: Pruning weights missing or incorrect.');
  }

  // 2. Verify Epic Soul Events
  console.log('\n--- Epic Soul Events (Fixed Points) ---');
  const soulEvents = template.epicSoulEvents;
  if (soulEvents && soulEvents.length >= 3) {
    const immutableCount = soulEvents.filter((e: any) => e.isImmutable).length;
    console.log(`✅ SUCCESS: ${soulEvents.length} soul events detected (${immutableCount} immutable).`);
    const purge = soulEvents.find((e: any) => e.id === 'great-iron-purge');
    if (purge?.year === -500) {
      console.log(`✅ SUCCESS: "Great Iron Purge" fixed at Year -500.`);
    }
  } else {
    console.log('❌ FAILURE: Epic soul events missing or incomplete.');
  }

  // 3. Verify Name Mutations (Cultural Drift)
  console.log('\n--- Cultural Drift (Name Mutations) ---');
  const fracture = template.epochs['epoch_ii_fracture'];
  const starlight = template.epochs['epoch_iii_starlight'];

  if (fracture?.nameMutations?.['moonwell-shrine'] === 'The Pale Ruin') {
    console.log('✅ SUCCESS: Epoch II Mutation: Moonwell Shrine -> The Pale Ruin');
  } else {
    console.log('❌ FAILURE: Epoch II name mutations missing.');
  }

  if (starlight?.nameMutations?.['moonwell-shrine'] === 'Glint-Stone Crater') {
    console.log('✅ SUCCESS: Epoch III Mutation: Moonwell Shrine -> Glint-Stone Crater');
  } else {
    console.log('❌ FAILURE: Epoch III name mutations missing.');
  }

  // 4. Verify Legacy Echoes
  console.log('\n--- Legacy Echo Templates ---');
  if (template.legacyEchoTemplates && template.legacyEchoTemplates.length > 0) {
    console.log(`✅ SUCCESS: ${template.legacyEchoTemplates.length} echo templates defined.`);
  } else {
    console.log('❌ FAILURE: Legacy echo templates missing.');
  }

  console.log('\n🏁 Canonical Smoke Test Finished.');
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
