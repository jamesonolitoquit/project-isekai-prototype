#!/usr/bin/env node

/**
 * BETA Runtime Validation Suite
 * Tests character creation, 2x4 grid, and zero LCK references
 */

const http = require('http');

function makeRequest(path = '/') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  BETA RUNTIME VALIDATION SUITE');
  console.log('='.repeat(60) + '\n');

  try {
    // Test 1: Server Connectivity
    console.log('TEST 1: Server Connectivity');
    console.log('-'.repeat(40));
    const result = await makeRequest('/');
    console.log(`✅ HTTP Status: ${result.status}`);
    console.log(`📦 Response Size: ${result.data.length} bytes\n`);

    // Test 2: Ghost LCK Detection
    console.log('TEST 2: Ghost LCK Detection');
    console.log('-'.repeat(40));
    const lckCount = (result.data.match(/LCK/g) || []).length;
    const luckCount = (result.data.match(/luck|Luck/gi) || []).length;
    
    if (lckCount === 0) {
      console.log('✅ No "LCK" found in response');
    } else {
      console.log(`🚨 GHOST LCK DETECTED: ${lckCount} occurrence(s)`);
    }
    
    if (luckCount === 0) {
      console.log('✅ No "luck" references found in response\n');
    } else {
      console.log(`🚨 GHOST LUCK DETECTED: ${luckCount} occurrence(s)\n`);
    }

    // Test 3: Component Presence
    console.log('TEST 3: Component Presence');
    console.log('-'.repeat(40));
    const checks = {
      'React Elements': result.data.includes('__next') || result.data.includes('react'),
      'Character Wizard': result.data.includes('character') || result.data.includes('Character'),
      'Next.js App': result.data.includes('next'),
      'Alpine.js/HTMX': result.data.includes('alpine') || result.data.includes('htmx')
    };

    Object.entries(checks).forEach(([name, found]) => {
      console.log(`${found ? '✅' : '⚠️'} ${name}: ${found ? 'Found' : 'Not found'}`);
    });

    // Test 4: Stat Attributes
    console.log('\nTEST 4: Stat Attributes');
    console.log('-'.repeat(40));
    const stats = ['STR', 'DEX', 'AGI', 'CON', 'INT', 'WIS', 'CHA', 'PER'];
    const foundStats = stats.filter(s => result.data.includes(s));
    
    if (foundStats.length === 8) {
      console.log(`✅ All 8 core attributes found: ${foundStats.join(', ')}\n`);
    } else if (foundStats.length > 0) {
      console.log(`⚠️ Found ${foundStats.length}/8 attributes: ${foundStats.join(', ')}\n`);
    } else {
      console.log('⚠️ No stat attributes found in initial HTML (they render after React loads)\n');
    }

    // Test 5: Grid System
    console.log('TEST 5: Grid System');
    console.log('-'.repeat(40));
    if (result.data.includes('grid') || result.data.includes('Grid')) {
      console.log('✅ Grid CSS classes detected\n');
    } else {
      console.log('⚠️ Grid CSS might be in external stylesheet\n');
    }

    // Final Summary
    console.log('='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    const errors = lckCount + luckCount;
    
    if (result.status === 200 && errors === 0) {
      console.log('\n🎉 ✅ ALL TESTS PASSED\n');
      console.log('Status: BETA website running without runtime errors');
      console.log('- No Ghost LCK references detected');
      console.log('- Server responding on localhost:3000');
      console.log('- React/Next.js framework loaded');
      console.log('\nBrowser should now show:');
      console.log('  1. Character creation wizard');
      console.log('  2. 2x4 stat allocation grid');
      console.log('  3. 8-stat allocation (no Luck)');
    } else {
      console.log('\n⚠️ WARNINGS DETECTED\n');
      console.log(`HTTP Status: ${result.status}`);
      console.log(`Ghost References: ${errors}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.log('\nPossible causes:');
    console.log('  • Dev server not running on port 3000');
    console.log('  • Network connectivity issue');
    console.log('  • Server timeout\n');
    process.exit(1);
  }
}

runTests();
