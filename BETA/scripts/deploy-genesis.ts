/**
 * Phase 28: Genesis Deployment Script
 * Initializes a fresh production environment with Luxfier World-0
 * 
 * Steps:
 * 1. Connect to PostgreSQL and Redis
 * 2. Create database schema
 * 3. Seed initial world state from luxfier-world.json
 * 4. Initialize hard facts as immutable anchors
 * 5. Start background tick loop
 * 6. Monitor for first paradox bleed event
 */

import { PostgreSQLAdapter, DatabaseConfig, setDatabaseAdapter } from '../src/engine/databaseAdapter';
import { initializeWorld, advanceTick } from '../src/engine/worldEngine';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface GenesisConfig {
  worldName: string;
  templatePath: string;
  initialTicks?: number;
  autoAdvance?: boolean;
  monitorParadox?: boolean;
}

async function deployGenesis(config: GenesisConfig): Promise<void> {
  console.log('\n🌍 GENESIS DEPLOYMENT INITIATED');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Initialize Database
    console.log('📊 Step 1: Initializing persistence layer...');
    const dbConfig: DatabaseConfig = {
      postgres: {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE || 'luxfier_genesis',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 0,
      },
      pruning: {
        enabled: true,
        minImportanceForStorage: 7,
        archiveAfterEpochs: 10,
      },
    };

    const adapter = new PostgreSQLAdapter(dbConfig);
    await adapter.initialize();
    setDatabaseAdapter(adapter);

    console.log('   ✅ PostgreSQL schema initialized');
    console.log('   ✅ Redis connection established\n');

    // Step 2: Load Template
    console.log('📜 Step 2: Loading world template...');
    let template: any;

    try {
      const templateContent = fs.readFileSync(config.templatePath, 'utf-8');
      template = JSON.parse(templateContent);
      console.log(`   ✅ Loaded: ${config.worldName}`);
      console.log(`   📍 Factions: ${template.factions?.length || 0}`);
      console.log(`   📍 Locations: ${template.locations?.length || 0}`);
      console.log(`   📍 Hard Facts: ${template.epicSoulEvents?.length || 0}\n`);
    } catch (error: any) {
      console.error(`   ❌ Template load failed: ${error.message}`);
      throw error;
    }

    // Step 3: Initialize World State
    console.log('🌱 Step 3: Initializing world state...');
    const worldState = initializeWorld(template);
    worldState.id = `world-${Date.now()}`;
    worldState.tick = 0;

    // Save initial snapshot
    const saved = await adapter.saveWorldState(worldState.id, worldState);
    console.log(`   ✅ World created: ${worldState.id}`);
    console.log(`   📊 Initial state: Tick 0, Season ${worldState.season}`);
    console.log(`   🏘️  Locations: ${worldState.locations.length}`);
    console.log(`   👤 NPCs: ${worldState.npcs.length}\n`);

    // Step 4: Register Hard Facts as Immutable Anchors
    console.log('🔐 Step 4: Registering immutable hard facts...');
    const hardFacts = template.epicSoulEvents || [];
    let hardFactCount = 0;

    for (const fact of hardFacts) {
      await adapter.registerHardFact(worldState.id, {
        id: fact.id,
        type: 'epic_soul_event',
        eventId: fact.id,
        tick: 0,
        description: fact.description || fact.name,
        metadata: {
          isImmutable: fact.isImmutable || true,
          year: fact.year,
          significance: fact.significance,
        },
      });
      hardFactCount++;
    }

    console.log(`   ✅ Registered ${hardFactCount} immutable hard facts`);
    console.log(`   🔒 Epoch I anchors locked\n`);

    // Step 5: Start Simulation Loop (Optional)
    if (config.autoAdvance) {
      console.log('⏰ Step 5: Starting simulation engine...');
      const targetTicks = config.initialTicks || 100;
      const startTime = Date.now();

      for (let i = 0; i < targetTicks; i++) {
        advanceTick(worldState, template);

        // Log every 1000 ticks
        if ((i + 1) % 1000 === 0) {
          const elapsed = Date.now() - startTime;
          const ticksPerSecond = ((i + 1) / elapsed) * 1000;

          console.log(`   ⏳ Tick ${i + 1}/${targetTicks} | ` +
            `${ticksPerSecond.toFixed(0)} ticks/sec | ` +
            `Season: ${worldState.season}`);

          // Check for paradox bleed
          if (config.monitorParadox && (worldState.globalParadoxAverage ?? 0) > 50) {
            console.log(`   ⚠️  PARADOX BLEED DETECTED: ${(worldState.globalParadoxAverage ?? 0).toFixed(1)}%`);
            console.log(`   🎨 Tint applied: ${worldState.paradoxBleedTint}`);
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`   ✅ Simulation complete: ${targetTicks} ticks in ${totalTime}ms`);
      console.log(`   📈 Performance: ${(totalTime / targetTicks).toFixed(2)}ms/tick\n`);

      // Save final state
      await adapter.saveWorldState(worldState.id, worldState);
    }

    // Step 6: Genesis Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✨ GENESIS COMPLETE\n');
    console.log('🌍 World-0 (Luxfier) initialized and ready');
    console.log(`📍 World ID: ${worldState.id}`);
    console.log(`📊 Current Tick: ${worldState.tick}`);
    console.log(`🔐 Hard Facts Locked: ${hardFactCount}`);
    console.log(`💾 Persistence: PostgreSQL + Redis\n`);

    console.log('📊 NEXT STEPS:');
    console.log('1. Deploy frontend at http://localhost:3000');
    console.log('2. Monitor globalParadoxAverage in real-time');
    console.log('3. Watch for paradox bleed at 50%+ average');
    console.log('4. Enable community patch deployment via CLI validator\n');

  } catch (error: any) {
    console.error('❌ GENESIS FAILED:', error);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const configOverrides: Partial<GenesisConfig> = {};

// Parse CLI arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  const value = args[i + 1];

  if (key === 'name') configOverrides.worldName = value;
  if (key === 'template') configOverrides.templatePath = value;
  if (key === 'ticks') configOverrides.initialTicks = parseInt(value);
  if (key === 'auto-advance') configOverrides.autoAdvance = value === 'true';
  if (key === 'monitor-paradox') configOverrides.monitorParadox = value === 'true';
}

const genesisConfig: GenesisConfig = {
  worldName: configOverrides.worldName || 'Luxfier-Genesis',
  templatePath: configOverrides.templatePath || path.join(__dirname, '../src/data/luxfier-world.json'),
  initialTicks: configOverrides.initialTicks || 1000,
  autoAdvance: configOverrides.autoAdvance ?? true,
  monitorParadox: configOverrides.monitorParadox ?? true,
};

deployGenesis(genesisConfig).then(() => {
  console.log('🎉 Deployment successful. Ready for production.\n');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
