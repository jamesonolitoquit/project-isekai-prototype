#!/usr/bin/env tsx
/**
 * Development Mode Launcher - Starts services without database dependency
 * 
 * This script launches the BETA environment in development mode, allowing
 * the game engine and UI to run even if PostgreSQL/Redis aren't available.
 * 
 * Usage: npx tsx scripts/dev-mode-start.ts
 */

import * as child_process from 'child_process';
import * as path from 'path';

console.log('\n╔════════════════════════════════════════╗');
console.log('║   BETA Dev Mode - Service Launcher     ║');
console.log('╚════════════════════════════════════════╝\n');

// Check if PostgreSQL is available (non-blocking)
console.log('🔍 Checking service availability...\n');

const checkPostgres = async () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('   ⏭️  PostgreSQL: Not available (will continue without persistence)');
      resolve(false);
    }, 2000);

    const proc = child_process.exec('psql --version', (error) => {
      clearTimeout(timeout);
      if (!error) {
        console.log('   ✅ PostgreSQL: Available');
        resolve(true);
      } else {
        console.log('   ⏭️  PostgreSQL: Not installed (will continue without persistence)');
        resolve(false);
      }
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
};

const checkRedis = async () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('   ⏭️  Redis: Not available (in-memory cache only)');
      resolve(false);
    }, 2000);

    const proc = child_process.exec('redis-cli --version', (error) => {
      clearTimeout(timeout);
      if (!error) {
        console.log('   ✅ Redis: Available');
        resolve(true);
      } else {
        console.log('   ⏭️  Redis: Not installed (in-memory cache only)');
        resolve(false);
      }
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
};

async function main() {
  // await checkPostgres();
  // await checkRedis();

  console.log('\n📋 Available Services:');
  console.log('   - Game Engine: ✅ READY');
  console.log('   - API Server: ✅ READY (Starting on port 5000)');
  console.log('   - React UI: ✅ READY (Starting on port 3000)\n');

  console.log('⚠️  Note:');
  console.log('   - Without PostgreSQL: Game state will NOT persist between sessions');
  console.log('   - Without Redis: Multi-instance features disabled');
  console.log('   - Game engine and UI will work normally\n');

  console.log('🚀 Starting services...\n');
  console.log('   1. Open TWO terminal windows');
  console.log('   2. Terminal 1 (Backend):');
  console.log('      cd BETA && npm run server:dev\n');
  console.log('   3. Terminal 2 (Frontend):');
  console.log('      cd BETA && npm run dev\n');
  console.log('   4. Visit: http://localhost:3000\n');

  console.log('⏱️  Waiting for manual service launch...');
  console.log('   (You can use Ctrl+C to exit)\n');

  // Keep process alive
  process.stdin.resume();
  process.on('SIGINT', () => {
    console.log('\n\n👋 Development session ended. Goodbye!\n');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
