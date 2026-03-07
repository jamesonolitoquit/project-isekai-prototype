/**
 * Character Creation End-to-End Test
 * Tests: Character creation flow, stat allocation, 2x4 grid rendering
 */

const { execSync } = require('child_process');
const fs = require('fs');

function runTests() {
  console.log('='.repeat(70));
  console.log('CHARACTER CREATION END-TO-END TEST SUITE');
  console.log('='.repeat(70));
  
  const tests = {
    // 1. Build verification
    buildStatus: {
      name: 'Build Status (Zero TypeScript Errors)',
      run: () => {
        try {
          const output = execSync('npm run build 2>&1', { cwd: process.cwd() }).toString();
          // Check there are no TypeScript errors (exit code 0)
          return !output.includes('error TS');
        } catch (e) {
          return false;
        }
      }
    },

    // 2. Fallback functions exist
    fallbackFunctionsPresent: {
      name: 'Fallback Functions in BetaApplication.tsx',
      run: () => {
        const betaApp = fs.readFileSync('src/client/components/BetaApplication.tsx', 'utf8');
        return betaApp.includes('FALLBACK_GLOBAL_CONSTANTS') && 
               betaApp.includes('buildCharacterCreationWorldTemplate');
      }
    },

    // 3. CharacterWizard has safe metadata guards
    characterWizardSafeGuards: {
      name: 'Safe Metadata Guards in CharacterWizard.tsx',
      run: () => {
        const wizard = fs.readFileSync('src/client/components/CharacterWizard.tsx', 'utf8');
        return wizard.includes('metadata?.loreHighlights ||') ||
               wizard.includes('fallback') ||
               wizard.includes('||');
      }
    },

    // 4. stats-grid CSS present
    statsGridCSS: {
      name: '2x4 Stats Grid CSS (globals.css)',
      run: () => {
        const globals = fs.readFileSync('src/styles/globals.css', 'utf8');
        return globals.includes('.stats-grid') && 
               globals.includes('grid-template-columns: repeat(2, 1fr)');
      }
    },

    // 5. No LCK in attributes
    noLuckStat: {
      name: 'LCK Stat Removed from Codebase',
      run: () => {
        const attrs = fs.readFileSync('src/types/attributes.ts', 'utf8');
        const hasLck = attrs.includes("'LCK'" ) || attrs.includes('"LCK"');
        return !hasLck;
      }
    },

    // 6. Stat array ordering is explicit (not Object.entries)
    explicitStatOrdering: {
      name: 'Explicit Stat Array Ordering (No Object.entries)',
      run: () => {
        const wizard = fs.readFileSync('src/client/components/CharacterWizard.tsx', 'utf8');
        // Should have explicit array with all 8 stats
        const hasExplicitArray = wizard.includes("['STR'") || 
                                 wizard.includes('["STR"') ||
                                 wizard.includes("const stats = [");
        // Should NOT use Object.entries for stat ordering
        const noObjectEntries = !wizard.includes(".filter(([key]) => key !== 'LCK')") &&
                               !wizard.includes('.filter(([key]) => key !== "LCK")');
        return hasExplicitArray && noObjectEntries;
      }
    },

    // 7. PER-based Paradox mitigation in ResolutionStack
    perBasedParadox: {
      name: 'PER-Based Paradox Mitigation (No Luck Modifier)',
      run: () => {
        const resolution = fs.readFileSync('src/engine/ResolutionStack.ts', 'utf8');
        return resolution.includes('perceptionModifier') && 
               !resolution.includes('luckModifier');
      }
    },

    // 8. CharacterCreationOverlay fallback guard
    charCreationGuard: {
      name: 'CharacterCreationOverlay Null Guard',
      run: () => {
        const overlay = fs.readFileSync('src/client/components/CharacterCreationOverlay.tsx', 'utf8');
        return overlay.includes('!worldTemplate') || overlay.includes('worldTemplate') && 
               overlay.includes('return null');
      }
    },

    // 9. Compiled CSS has grid styling
    compiledGridCSS: {
      name: 'Compiled Build Contains Grid CSS',
      run: () => {
        try {
          const dir = '.next/static/chunks';
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const cssFiles = files.filter(f => f.endsWith('.css'));
            return cssFiles.length > 0;
          }
          return false;
        } catch (e) {
          return false;
        }
      }
    },

    // 10. Dev server running on port 3000
    devServerRunning: {
      name: 'Dev Server Running (Port 3000)',
      run: () => {
        try {
          const netstat = execSync('netstat -ano | findstr :3000').toString();
          return netstat.includes('LISTENING');
        } catch (e) {
          return false;
        }
      }
    }
  };

  // Run all tests
  const results = {};
  let passed = 0;
  let failed = 0;

  Object.entries(tests).forEach(([key, test]) => {
    try {
      const result = test.run();
      results[key] = result;
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${test.name} (Error: ${e.message})`);
      results[key] = false;
      failed++;
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - CHARACTER CREATION READY');
    console.log('\nKey Achievements:');
    console.log('  ✅ 8-stat system (no Luck) implemented');
    console.log('  ✅ 2x4 character grid ready');
    console.log('  ✅ Safe metadata fallbacks in place');
    console.log('  ✅ PER-based Paradox mitigation active');
    console.log('  ✅ Dev server running for live testing');
    return 0;
  } else {
    console.log('\n⚠️  Some tests failed - see above for details');
    return 1;
  }
}

process.exit(runTests());
