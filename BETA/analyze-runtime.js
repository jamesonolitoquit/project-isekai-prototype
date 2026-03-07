const http = require('http');

console.log('🔍 BETA Runtime Error Analyzer\n');
console.log('Testing localhost:3000...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ HTTP Response received (Status: ' + res.statusCode + ')\n');
    
    // Check for errors
    const errors = [];
    const warnings = [];
    
    if (data.includes('error') || data.includes('Error') || data.includes('ERROR')) {
      errors.push('Found "error" keywords in HTML');
    }
    
    if (data.includes('LCK') || data.includes('lck')) {
      errors.push('🚨 GHOST LCK DETECTED: Found "LCK" in page source!');
    }
    
    if (data.includes('luck') || data.includes('Luck')) {
      errors.push('🚨 GHOST LUCK DETECTED: Found "Luck" in page source!');
    }
    
    if (data.includes('stats-grid')) {
      console.log('✅ Found stats-grid element (2x4 grid CSS class present)');
    }
    
    if (data.includes('STR') && data.includes('DEX') && data.includes('AGI') && data.includes('CON')) {
      console.log('✅ Found physical attributes (STR, DEX, AGI, CON)');
    }
    
    if (data.includes('INT') && data.includes('WIS') && data.includes('CHA') && data.includes('PER')) {
      console.log('✅ Found mental/social attributes (INT, WIS, CHA, PER)');
    }
    
    if (data.includes('characterWizard') || data.includes('CharacterWizard')) {
      console.log('✅ CharacterWizard component loaded');
    }
    
    console.log('\n📊 HTML Content Analysis:');
    console.log('   Bytes received: ' + data.length);
    console.log('   Contains "stats-grid": ' + (data.includes('stats-grid') ? 'YES' : 'NO'));
    console.log('   Contains "LCK": ' + (data.includes('LCK') ? 'YES ⚠️' : 'NO ✅'));
    console.log('   Contains "luck": ' + (data.includes('luck') ? 'YES ⚠️' : 'NO ✅'));
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.forEach(e => console.log('   • ' + e));
    } else {
      console.log('\n✅ NO ERRORS DETECTED');
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      warnings.forEach(w => console.log('   • ' + w));
    } else {
      console.log('✅ NO WARNINGS');
    }
    
    console.log('\n🎮 Runtime Status: RUNNING');
  });
});

req.on('error', (e) => {
  console.error('❌ ERROR: ' + e.message);
  console.log('\n💔 Dev server may not be responding on localhost:3000');
});

req.on('timeout', () => {
  console.error('❌ TIMEOUT: Request exceeded 5000ms');
  req.destroy();
});

req.end();
