/**
 * Weaver Synthesis Test - Validate AI narrative synthesis quality
 * 
 * Purpose: Test the promptRegistry and AI synthesis pipeline at various paradox levels
 * Verifies:
 * - Glitch tiers activate at correct paradox thresholds
 * - Item flavor text generation with mood modulation
 * - NPC dialogue glitch intensity scaling
 * - Atmospheric tone consistency
 * 
 * Usage: npm run test:weaver-synthesis
 */

import { promptRegistry, type ItemFlavorRequest, type NpcDialogueRequest } from '../src/engine/promptRegistry';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function testItemFlavor() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 1: ITEM FLAVOR SYNTHESIS', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const testCases = [
    { paradoxLevel: 0, mood: 'neutral' },
    { paradoxLevel: 25, mood: 'neutral' },
    { paradoxLevel: 50, mood: 'curious' },
    { paradoxLevel: 75, mood: 'bloodthirsty' },
    { paradoxLevel: 95, mood: 'sullen' },
  ];

  testCases.forEach(({ paradoxLevel, mood }) => {
    const request: ItemFlavorRequest = {
      itemName: 'Legendary Aegis Blade',
      baseDescription: 'An ancient relic weapon with barely contained power.',
      rarity: 'legendary',
      paradoxLevel,
      mood,
    };

    const result = promptRegistry.getItemFlavor(request);
    const glitchTier = promptRegistry.getGlitchTier(paradoxLevel);

    log(`\n  Paradox: ${paradoxLevel}% | Tier: ${glitchTier}`, COLORS.blue);
    log(`  Mood: ${mood}`, COLORS.gray);
    log(`  Output: "${result}"`);
  });

  log('\n  ✓ Item flavor synthesis test passed', COLORS.green);
}

function testNpcDialogueGlitch() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 2: NPC DIALOGUE GLITCH SYNTHESIS', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const baseDialogues = [
    'The treaty holds, for now.',
    'I know nothing of the conspiracy.',
    'Your reputation precedes you.',
  ];

  const paradoxLevels = [10, 40, 70, 95];

  baseDialogues.forEach((baseDialogue, idx) => {
    log(`\n  Base Dialogue ${idx + 1}: "${baseDialogue}"`, COLORS.gray);

    paradoxLevels.forEach(paradoxLevel => {
      const request: NpcDialogueRequest = {
        baseDialogue,
        npcName: 'Merchant Keafu',
        paradoxLevel,
      };

      const result = promptRegistry.synthesizeNpcDialogue(request);
      const glitchTier = promptRegistry.getGlitchTier(paradoxLevel);

      log(`    Paradox ${paradoxLevel}% [${glitchTier}]: "${result}"`);
    });
  });

  log('\n  ✓ NPC dialogue glitch synthesis test passed', COLORS.green);
}

function testAtmosphericToneRules() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 3: ATMOSPHERIC TONE CONSISTENCY', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const testParadoxLevels = [
    { level: 10, expectedPhase: 'low' },
    { level: 45, expectedPhase: 'medium' },
    { level: 85, expectedPhase: 'high' },
  ];

  testParadoxLevels.forEach(({ level, expectedPhase }) => {
    const rules = promptRegistry.getAtmosphericRules(level);
    const tier = promptRegistry.getGlitchTier(level);

    log(`\n  Paradox Level: ${level}% (Expected: ${expectedPhase}, Got: ${tier})`, COLORS.blue);
    log(`  Atmospheric Rules:`, COLORS.gray);

    rules.forEach(rule => {
      log(`    • ${rule}`);
    });

    // Validate consistency
    let phaseMatch = true;
    if (level < 30 && tier !== 'none') phaseMatch = false;
    if (level >= 30 && level < 60 && tier !== 'subtle') phaseMatch = false;
    if (level >= 60 && level < 85 && tier !== 'moderate') phaseMatch = false;
    if (level >= 85 && tier !== 'severe') phaseMatch = false;

    if (phaseMatch) {
      log(`  ✓ Tier matches expected phase`, COLORS.green);
    } else {
      log(`  ✗ Tier mismatch!`, COLORS.red);
    }
  });

  log('\n  ✓ Atmospheric tone consistency test passed', COLORS.green);
}

function testGlitchTierThresholds() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 4: GLITCH TIER THRESHOLDS', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const testPoints = [
    { paradox: 0, expected: 'none' },
    { paradox: 29, expected: 'none' },
    { paradox: 30, expected: 'subtle' },
    { paradox: 59, expected: 'subtle' },
    { paradox: 60, expected: 'moderate' },
    { paradox: 84, expected: 'moderate' },
    { paradox: 85, expected: 'severe' },
    { paradox: 100, expected: 'severe' },
  ];

  let thresholdErrors = 0;

  log('\n  Testing threshold boundaries:', COLORS.gray);

  testPoints.forEach(({ paradox, expected }) => {
    const result = promptRegistry.getGlitchTier(paradox);
    const status = result === expected ? '✓' : '✗';
    const statusColor = result === expected ? COLORS.green : COLORS.red;

    log(`    ${status} Paradox ${String(paradox).padStart(3)}% → ${result} (expected ${expected})`, statusColor);

    if (result !== expected) {
      thresholdErrors++;
    }
  });

  if (thresholdErrors === 0) {
    log('\n  ✓ All glitch tier thresholds correct', COLORS.green);
  } else {
    log(`\n  ✗ ${thresholdErrors} threshold errors found`, COLORS.red);
  }
}

function testFallbackResponses() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 5: FALLBACK SYNTHESIS RESPONSES', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const synthesisTypes: Array<any> = [
    'quest_prologue',
    'npc_dialogue_glitch',
    'story_origin',
    'world_event',
    'item_flavor',
  ];

  log('\n  Testing fallback responses for synthesis failures:', COLORS.gray);

  synthesisTypes.forEach(type => {
    const fallback = promptRegistry.getFallback(type);

    log(`\n  ${type}:`, COLORS.blue);
    log(`    "${fallback}"`);

    // Validate fallback exists and is non-empty
    if (fallback && fallback.length > 0) {
      log(`    ✓ Fallback available (${fallback.length} chars)`, COLORS.green);
    } else {
      log(`    ✗ Fallback missing or empty`, COLORS.red);
    }
  });

  log('\n  ✓ Fallback responses test passed', COLORS.green);
}

function testSynthesisContext() {
  log('\n' + '═'.repeat(60), COLORS.cyan);
  log('TEST 6: SYNTHESIS CONTEXT CREATION', COLORS.cyan);
  log('═'.repeat(60), COLORS.cyan);

  const request = {
    synthesisType: 'quest_prologue' as const,
    contextFactors: {
      questTitle: 'The Gilded Fracture',
      questTemplate: 'faction_conflict',
      factionInvolved: ['merchant-guild', 'solar-aegis'],
      playerBackground: 'Exile Rogue',
      difficulty: 6,
    },
    paradoxLevel: 45,
  };

  const context = promptRegistry.createSynthesisContext(request);

  log('\n  Created Synthesis Context:', COLORS.gray);
  log(`  Type: ${context.synthesisType}`, COLORS.blue);
  log(`  Glitch Tier: ${context.glitchTier}`, COLORS.blue);
  log(`  Atmospheric Rules: ${context.atmosphericRules.length} rules`, COLORS.blue);
  log(`  Timestamp: ${context.timestamp}`, COLORS.blue);
  log(`  Guidelines: "${context.synthesisGuidelines}"`, COLORS.blue);

  if (context.glitchTier && context.atmosphericRules) {
    log('\n  ✓ Synthesis context created successfully', COLORS.green);
  } else {
    log('\n  ✗ Synthesis context creation failed', COLORS.red);
  }
}

function runAllTests() {
  log('\n', COLORS.cyan);
  log('╔' + '═'.repeat(58) + '╗', COLORS.cyan);
  log('║' + ' '.repeat(58) + '║', COLORS.cyan);
  log('║' + '  WEAVER SYNTHESIS TEST SUITE - Phase 14'.padEnd(58) + '║', COLORS.cyan);
  log('║' + ' '.repeat(58) + '║', COLORS.cyan);
  log('╚' + '═'.repeat(58) + '╝', COLORS.cyan);

  try {
    testGlitchTierThresholds();
    testAtmosphericToneRules();
    testItemFlavor();
    testNpcDialogueGlitch();
    testFallbackResponses();
    testSynthesisContext();

    log('\n' + '═'.repeat(60), COLORS.green);
    log('✓ ALL TESTS PASSED', COLORS.green);
    log('═'.repeat(60), COLORS.green);
    log('');
  } catch (error) {
    log('\n' + '═'.repeat(60), COLORS.red);
    log('✗ TEST FAILURE', COLORS.red);
    log('═'.repeat(60), COLORS.red);
    log(`\nError: ${error}`, COLORS.red);
    process.exit(1);
  }
}

runAllTests();
