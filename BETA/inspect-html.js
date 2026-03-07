/**
 * HTML Content Inspector - Debug what's being served from localhost:3000
 */

const http = require('http');
const fs = require('fs');

async function inspectHTML() {
  return new Promise((resolve) => {
    console.log('Fetching HTML from localhost:3000...');
    
    const req = http.get('http://localhost:3000', (res) => {
      let html = '';
      
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        // Save to file for inspection
        fs.writeFileSync('page-content.html', html);
        
        console.log(`\nHTML Content: ${html.length} bytes`);
        console.log('\nFirst 2000 characters:');
        console.log(html.substring(0, 2000));
        
        console.log('\n\nSearching for key indicators:');
        console.log(`  - Contains "stats-grid": ${html.includes('stats-grid')}`);
        console.log(`  - Contains "CharacterWizard": ${html.includes('CharacterWizard')}`);
        console.log(`  - Contains "characterCreation": ${html.includes('characterCreation')}`);
        console.log(`  - Contains "__NEXT_DATA__": ${html.includes('__NEXT_DATA__')}`);
        console.log(`  - Contains "STR": ${html.includes('STR')}`);
        console.log(`  - Contains "LCK": ${html.includes('LCK')}`);
        console.log(`  - Contains "luck": ${html.includes('luck')}`);
        console.log(`  - Contains "React": ${html.includes('React')}`);
        console.log(`  - Contains "//_next/": ${html.includes('//_next/')}`);
        console.log(`  - Contains "<script": ${html.includes('<script')}`);
        
        // Look for Next.js data
        if (html.includes('__NEXT_DATA__')) {
          const startIdx = html.indexOf('__NEXT_DATA__');
          console.log('\nNext.js Data section:');
          console.log(html.substring(startIdx, startIdx + 500));
        }
        
        resolve(html);
      });
    });
    
    req.on('error', (err) => {
      console.error('Connection error:', err.message);
      resolve('');
    });
  });
}

inspectHTML();
