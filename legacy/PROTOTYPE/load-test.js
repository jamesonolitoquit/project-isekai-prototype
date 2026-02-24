const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');

const NUM_PLAYERS = 100;
const REQUESTS_PER_PLAYER = 5;

console.log(`🎮 Load Test: ${NUM_PLAYERS} concurrent players, ${REQUESTS_PER_PLAYER} requests each`);
console.log('Starting load test...\n');

const results = {
  total_requests: 0,
  successful: 0,
  failed: 0,
  latencies: [],
  start_time: Date.now(),
  error_messages: [],
};

function makeHealthCheck(player_id) {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const req = http.get('http://localhost:5000/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = performance.now() - start;
        results.latencies.push(latency);
        results.total_requests++;
        
        if (res.statusCode === 200) {
          results.successful++;
        } else {
          results.failed++;
          results.error_messages.push(`Player ${player_id}: HTTP ${res.statusCode}`);
        }
        
        resolve(latency);
      });
    }).on('error', (err) => {
      results.failed++;
      results.total_requests++;
      results.error_messages.push(`Player ${player_id}: ${err.message}`);
      resolve(null);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      results.failed++;
      results.total_requests++;
      results.error_messages.push(`Player ${player_id}: Timeout`);
      resolve(null);
    });
  });
}

async function runLoadTest() {
  console.log(`🚀 Sending ${NUM_PLAYERS * REQUESTS_PER_PLAYER} requests from ${NUM_PLAYERS} simulated players...`);
  console.log(`   (${REQUESTS_PER_PLAYER} requests per player)\n`);
  
  // Create array of promises for concurrent requests
  const promises = [];
  
  for (let player = 0; player < NUM_PLAYERS; player++) {
    for (let req = 0; req < REQUESTS_PER_PLAYER; req++) {
      promises.push(makeHealthCheck(player));
      
      // Small stagger to avoid thundering herd
      if ((player * REQUESTS_PER_PLAYER + req) % 10 === 0) {
        await new Promise(r => setTimeout(r, 5));
      }
    }
  }
  
  // Wait for all requests
  console.log('Waiting for all requests to complete...');
  await Promise.all(promises);
  
  // Calculate statistics
  const elapsed = (Date.now() - results.start_time) / 1000;
  const avg_latency = results.latencies.length > 0 
    ? results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length
    : 0;
  const max_latency = results.latencies.length > 0 ? Math.max(...results.latencies) : 0;
  const min_latency = results.latencies.length > 0 ? Math.min(...results.latencies) : 0;
  
  results.latencies.sort((a, b) => a - b);
  const p50 = results.latencies[Math.floor(results.latencies.length * 0.50)] || 0;
  const p95 = results.latencies[Math.floor(results.latencies.length * 0.95)] || 0;
  const p99 = results.latencies[Math.floor(results.latencies.length * 0.99)] || 0;
  
  // Print results
  console.log(`\n================================================`);
  console.log(`  LOAD TEST RESULTS`);
  console.log(`================================================\n`);
  
  console.log(`⏱️  Duration: ${elapsed.toFixed(2)} seconds`);
  console.log(`\n📊 Requests:`);
  console.log(`   Total: ${results.total_requests}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);
  
  const success_rate = (results.successful / results.total_requests) * 100;
  console.log(`   Success Rate: ${success_rate.toFixed(1)}%`);
  
  console.log(`\n⏰ Latency (ms):`);
  console.log(`   Min: ${min_latency.toFixed(2)}`);
  console.log(`   P50: ${p50.toFixed(2)}`);
  console.log(`   Avg: ${avg_latency.toFixed(2)}`);
  console.log(`   P95: ${p95.toFixed(2)}`);
  console.log(`   P99: ${p99.toFixed(2)}`);
  console.log(`   Max: ${max_latency.toFixed(2)}`);
  
  console.log(`\n📈 Throughput:`);
  const throughput = results.total_requests / elapsed;
  console.log(`   ${throughput.toFixed(0)} requests/second`);
  
  if (results.error_messages.length > 0 && results.error_messages.length <= 5) {
    console.log(`\n⚠️  Errors:`);
    results.error_messages.slice(0, 5).forEach(msg => {
      console.log(`   - ${msg}`);
    });
  }
  
  // Success criteria
  const passed = results.successful === results.total_requests && avg_latency < 100;
  
  console.log(`\n================================================`);
  console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}: Load Test`);
  console.log(`================================================\n`);
  
  // Save results to file
  const report = `
LOAD TEST REPORT
================
Date: ${new Date().toISOString()}
Duration: ${elapsed.toFixed(2)}s

SUMMARY:
--------
Total Requests: ${results.total_requests}
Successful: ${results.successful}
Failed: ${results.failed}
Success Rate: ${success_rate.toFixed(1)}%

LATENCY METRICS (ms):
--------------------
Minimum: ${min_latency.toFixed(2)}
P50: ${p50.toFixed(2)}
Average: ${avg_latency.toFixed(2)}
P95: ${p95.toFixed(2)}
P99: ${p99.toFixed(2)}
Maximum: ${max_latency.toFixed(2)}

THROUGHPUT:
-----------
${throughput.toFixed(0)} requests/second

STATUS: ${passed ? 'PASS ✅' : 'FAIL ❌'}
`;
  
  fs.writeFileSync('./load-test-results.txt', report);
  console.log('Report saved to: load-test-results.txt');
  
  process.exit(passed ? 0 : 1);
}

runLoadTest();
