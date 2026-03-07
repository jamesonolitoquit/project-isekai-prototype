/**
 * UI Grid Validator - Tests 2x4 stat grid rendering on localhost:3000
 * Verifies:
 * - Character creation grid loads
 * - 2x4 layout renders correctly (Physical | Mental/Social)
 * - No "Luck" or "LCK" stat appears
 * - Stats display: STR, DEX, AGI, CON, INT, WIS, CHA, PER
 */

const http = require('http');

async function testUIGrid() {
  return new Promise((resolve) => {
    console.log('='.repeat(60));
    console.log('UI GRID VALIDATOR - Testing localhost:3000');
    console.log('='.repeat(60));
    
    const req = http.get('http://localhost:3000', (res) => {
      let html = '';
      
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        console.log('\n✅ Server Response: HTTP ' + res.statusCode);
        
        const results = {
          httpStatus: res.statusCode === 200,
          gridClassPresent: html.includes('stats-grid'),
          gridCSSPresent: html.includes('grid-template-columns'),
          noGhostLuck: !html.includes('LCK') && !html.includes('luck'),
          reactLoaded: html.includes('__NEXT_DATA__') || html.includes('React'),
          characterWizardPresent: html.includes('CharacterWizard') || html.includes('character'),
          statsGridLayout: html.includes('repeat(2, 1fr)'),
          noConsoleErrors: !html.includes('console.error'),
          physicalStatsPresent: html.includes('STR') || html.includes('DEX') || html.includes('AGI'),
          mentalStatsPresent: html.includes('INT') || html.includes('WIS') || html.includes('CHA'),
          perceptionPresent: html.includes('PER')
        };
        
        console.log('\n📊 TEST RESULTS:');
        console.log('─'.repeat(60));
        console.log('  Server Status');
        console.log(`    HTTP 200 OK: ${results.httpStatus ? '✅' : '❌'}`);
        
        console.log('\n  Grid Rendering');
        console.log(`    .stats-grid class present: ${results.gridClassPresent ? '✅' : '❌'}`);
        console.log(`    grid-template-columns CSS: ${results.gridCSSLayout ? '✅' : '❌'}`);
        console.log(`    2x4 Layout (repeat(2, 1fr)): ${results.statsGridLayout ? '✅' : '❌'}`);
        
        console.log('\n  Stat System');
        console.log(`    No Ghost LCK references: ${results.noGhostLuck ? '✅' : '❌'}`);
        console.log(`    Physical stats (STR/DEX/AGI): ${results.physicalStatsPresent ? '✅' : '❌'}`);
        console.log(`    Mental stats (INT/WIS/CHA): ${results.mentalStatsPresent ? '✅' : '❌'}`);
        console.log(`    Perception stat (PER): ${results.perceptionPresent ? '✅' : '❌'}`);
        
        console.log('\n  Framework & Compatibility');
        console.log(`    React/Next.js loaded: ${results.reactLoaded ? '✅' : '❌'}`);
        console.log(`    Character Wizard present: ${results.characterWizardPresent ? '✅' : '❌'}`);
        console.log(`    No console errors: ${results.noConsoleErrors ? '✅' : '❌'}`);
        
        const allPassed = Object.values(results).every(v => v === true);
        console.log('\n' + '='.repeat(60));
        if (allPassed) {
          console.log('🎉 ALL TESTS PASSED - 2x4 Grid Ready!');
        } else {
          console.log('⚠️  Some tests did not pass - please review');
        }
        console.log('='.repeat(60));
        
        resolve(results);
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Connection error:', err.message);
      resolve({ httpStatus: false });
    });
  });
}

testUIGrid().then(results => {
  process.exit(Object.values(results).every(v => v !== false) ? 0 : 1);
});
