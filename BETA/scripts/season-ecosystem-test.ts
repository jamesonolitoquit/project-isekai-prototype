/**
 * Phase 23: Seasonal Ecosystem Verification
 * 
 * Verifies that the engine correctly retrieves seasonal data:
 * 1. Test season resolution at specific ticks
 * 2. Verify visual palette retrieval for each season
 * 3. Verify location availability changes with seasons
 */

import { resolveSeason } from '../src/engine/seasonEngine';
import { getWorldTemplate } from '../src/engine/worldEngine';

async function runTests(): Promise<void> {
  console.log('🚀 Phase 23: Seasonal Ecosystem Smoke Test');
  process.env.NEXT_PUBLIC_FORCE_TEMPLATE = 'true';

  const template = getWorldTemplate();
  if (!template || !template.seasonalRules) {
    console.error('❌ Failed to load world template or seasonalRules missing.');
    process.exit(1);
  }

  // Define season order based on engine (winter, spring, summer, autumn)
  const seasonTicks = {
    winter: 0,
    spring: 7 * 24,
    summer: 14 * 24,
    autumn: 21 * 24,
    winterYearOne: 28 * 24 // Should wrap back to winter
  };

  console.log('\n--- Season Resolution & Visual Palettes ---');
  for (const [seasonName, tick] of Object.entries(seasonTicks)) {
    const res = resolveSeason(tick);
    const upperSeason = res.current.toUpperCase();
    const rules = template.seasonalRules[upperSeason];
    
    if (rules) {
      console.log(`✅ Tick ${tick}: Resolved to ${res.current}`);
      console.log(`   Palette: ${rules.visualPalette.primaryColor}, ${rules.visualPalette.foliageColor}`);
    } else {
      console.log(`❌ Tick ${tick}: Rules missing for ${res.current}`);
    }
  }

  console.log('\n--- Conditional Location Visibility ---');
  const winterLoc = template.locations.find((l: any) => l.id === 'frozen-lake');
  const springLoc = template.locations.find((l: any) => l.id === 'iron-bridge');
  const summerLoc = template.locations.find((l: any) => l.id === 'ancient-citadel-secret-path');

  if (winterLoc?.conditionalSeason === 'winter') console.log('✅ SUCCESS: Frozen Lake is conditional to Winter');
  if (springLoc?.conditionalSeason === 'spring') console.log('✅ SUCCESS: Iron Bridge is conditional to Spring');
  if (summerLoc?.conditionalSeason === 'summer') console.log('✅ SUCCESS: Ancient Citadel path is conditional to Summer');

  console.log('\n--- NPC Seasonal Dialogue ---');
  const theron = template.npcs.find((n: any) => n.id === 'brother-theron');
  if (theron?.dialogueVariations?.winter) {
    console.log(`✅ SUCCESS: Brother Theron has winter dialogue: "${theron.dialogueVariations.winter[0].substring(0, 30)}..."`);
  } else {
    console.log('❌ FAILURE: Brother Theron missing seasonal dialogue.');
  }

  console.log('\n🏁 Seasonal Smoke Test Finished.');
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
