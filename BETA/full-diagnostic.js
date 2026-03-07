/**
 * Full Runtime Diagnostic for BETA Application
 * Tests character creation stability, 2x4 grid, and zero LCK references
 */

const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 BETA Full Runtime Diagnostic\n');
  console.log('Launching headless browser...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console messages
    const consoleLogs = [];
    const consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    
    page.on('error', err => {
      consoleErrors.push(`Page Error: ${err.message}`);
    });
    
    console.log('📡 Navigating to localhost:3000...');
    const response = await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log(`✅ Page loaded (Status: ${response.status()})\n`);
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Check DOM for character creation elements
    const diagnostics = await page.evaluate(() => {
      const checks = {
        timestamp: new Date().toISOString(),
        pageTitle: document.title,
        statsGrid: !!document.querySelector('.stats-grid'),
        statRows: document.querySelectorAll('.stat-row').length,
        hasLCKinDOM: document.documentElement.innerHTML.includes('LCK'),
        hasLuckInDOM: document.documentElement.innerHTML.toLowerCase().includes('luck'),
        hasErrorElements: !!document.querySelector('[role="alert"]'),
        reactMounted: !!document.querySelector('[data-reactroot], #__next'),
        characterWizard: !!document.querySelector('[class*="character"]'),
        consoleErrors: [],
        statNames: []
      };
      
      // Check stat names in grid
      document.querySelectorAll('.stat-name').forEach(el => {
        checks.statNames.push(el.textContent.trim());
      });
      
      return checks;
    });
    
    console.log('📊 DOM Analysis:');
    console.log(`   Page Title: "${diagnostics.pageTitle}"`);
    console.log(`   Stats Grid Found: ${diagnostics.statsGrid ? '✅ YES' : '❌ NO'}`);
    console.log(`   Stat Rows: ${diagnostics.statRows}`);
    console.log(`   React Mounted: ${diagnostics.reactMounted ? '✅ YES' : '⚠️ UNCLEAR'}`);
    console.log(`   LCK in DOM: ${diagnostics.hasLCKinDOM ? '🚨 YES (GHOST LCK!)' : '✅ NO'}`);
    console.log(`   "luck" in DOM: ${diagnostics.hasLuckInDOM ? '🚨 YES (GHOST LUCK!)' : '✅ NO'}`);
    
    if (diagnostics.statNames.length > 0) {
      console.log(`\n📈 Detected Stats (${diagnostics.statNames.length}):`);
      diagnostics.statNames.forEach(name => {
        console.log(`   • ${name}`);
      });
    }
    
    console.log('\n📋 Console Output:');
    if (consoleErrors.length > 0) {
      console.log('   ❌ CONSOLE ERRORS:');
      consoleErrors.slice(0, 5).forEach(e => console.log(`      • ${e}`));
    } else {
      console.log('   ✅ No console errors detected');
    }
    
    // Screenshot the page
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'beta-runtime-check.png' });
    console.log('   Screenshot saved: beta-runtime-check.png');
    
    console.log('\n✅ DIAGNOSTIC COMPLETE');
    
  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error.message);
    console.log('\nNote: Puppeteer may not be installed. Install with: npm install puppeteer');
  } finally {
    if (browser) await browser.close();
  }
})();
