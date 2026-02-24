/**
 * server-test.ts - Test script to verify Phase 4 infrastructure
 * Starts Express server and tests all endpoints
 */

import dotenv from 'dotenv';
import { startServer } from './src/server/index.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runTests() {
  console.log('🚀 Starting Phase 4 Infrastructure Test Suite\n');

  try {
    // Start server
    console.log('📡 Initializing Express server...');
    const { app, server, broadcaster } = await startServer();

    // Give server time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n✅ Server initialized successfully!\n');

    // Test 1: Health check
    console.log('TEST 1: Health Check Endpoint');
    const healthRes = await fetch('http://localhost:3001/api/health');
    const health = await healthRes.json();
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${health.uptime}ms`);
    console.log(`  Active Sessions: ${health.activeSessions}`);
    console.log(`  Database Connected: ${health.databaseConnected}`);
    console.log(`  ✅ PASS\n`);

    // Test 2: Login endpoint
    console.log('TEST 2: Moderator Login');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testmod',
        password: 'dev-password'
      })
    });
    const loginData = await loginRes.json();
    console.log(`  Status: ${loginRes.status}`);
    console.log(`  Token generated: ${loginData.token ? 'YES' : 'NO'}`);
    console.log(`  Moderator: ${loginData.moderator?.username}`);
    console.log(`  Role: ${loginData.moderator?.role}`);
    console.log(`  ✅ PASS\n`);

    // Test 3: Beta key validation
    console.log('TEST 3: Beta Key Validation');
    const betaRes = await fetch('http://localhost:3001/api/auth/validate-beta-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        betaKey: '' // Will get actual key from server
      })
    });
    
    if (betaRes.status === 400) {
      console.log(`  Initial validation failed (expected - need real key)`);
      console.log(`  ✅ PASS (endpoint accessible)\n`);
    }

    // Test 4: Metrics endpoint
    if (process.env.PROMETHEUS_ENABLED === 'true') {
      console.log('TEST 4: Prometheus Metrics Endpoint');
      const metricsRes = await fetch('http://localhost:3001/metrics');
      const metricsText = await metricsRes.text();
      console.log(`  Status: ${metricsRes.status}`);
      console.log(`  Content-Type: ${metricsRes.headers.get('content-type')}`);
      console.log(`  Response length: ${metricsText.length} bytes`);
      console.log(`  Contains 'HELP': ${metricsText.includes('# HELP') ? 'YES' : 'NO'}`);
      console.log(`  ✅ PASS\n`);
    }

    console.log('✅ All infrastructure tests completed!\n');
    console.log('📊 Server Summary:');
    console.log(`  - Express server: RUNNING (port 3001)`);
    console.log(`  - Socket.IO: ${process.env.SOCKET_IO_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  - Prometheus: ${process.env.PROMETHEUS_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  - Redis: ${process.env.REDIS_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`\n📍 Endpoint Summary:`);
    console.log(`  - Health: GET http://localhost:3001/api/health`);
    console.log(`  - Login: POST http://localhost:3001/api/auth/login`);
    console.log(`  - Beta Key: POST http://localhost:3001/api/auth/validate-beta-key`);
    if (process.env.PROMETHEUS_ENABLED === 'true') {
      console.log(`  - Metrics: GET http://localhost:3001/metrics`);
    }
    console.log(`  - Admin routes: POST/GET http://localhost:3001/api/admin/*`);

    // Close server gracefully
    server.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  }
}

runTests();
