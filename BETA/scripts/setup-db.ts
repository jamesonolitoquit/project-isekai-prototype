/**
 * BETA Database Setup Script
 * 
 * Purpose: Initialize PostgreSQL database with core schema for local development
 * Run: npx tsx scripts/setup-db.ts
 * 
 * Creates tables:
 * - players: User accounts and progression
 * - world_states: Game world snapshots for save/load
 * - mutation_events: Event log for deterministic replay
 * - saves: Save file metadata and checksums
 * - lore_tomes: Narrative assets for WTOL
 */

import pg from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface SetupResult {
  success: boolean;
  tablesCreated: string[];
  indexesCreated: string[];
  errors: string[];
}

async function setupDatabase(): Promise<SetupResult> {
  const result: SetupResult = {
    success: false,
    tablesCreated: [],
    indexesCreated: [],
    errors: []
  };

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://isekai:isekai_beta_password@localhost:5432/isekai'
  });

  try {
    console.log(`\n🔌 Connecting to database: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost:5432/isekai'}`);
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create players table
    console.log('\n📋 Creating table: players');
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        passwordHash VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastLogin TIMESTAMP,
        worldInstanceId UUID,
        currentSaveId UUID,
        metadata JSONB DEFAULT '{}',
        
        CONSTRAINT fk_world_instance FOREIGN KEY (worldInstanceId) REFERENCES world_states(id) ON DELETE SET NULL
      );
    `);
    result.tablesCreated.push('players');

    // Create world_states table
    console.log('📋 Creating table: world_states');
    await client.query(`
      CREATE TABLE IF NOT EXISTS world_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worldInstanceId UUID NOT NULL,
        epochId VARCHAR(255),
        tick INT DEFAULT 0,
        seed INT,
        stateSnapshot JSONB NOT NULL,
        chronologyYear INT DEFAULT 1000,
        epochsSpanned INT DEFAULT 1,
        generationalParadox FLOAT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(worldInstanceId, tick)
      );
    `);
    result.tablesCreated.push('world_states');

    // Create mutation_events table
    console.log('📋 Creating table: mutation_events');
    await client.query(`
      CREATE TABLE IF NOT EXISTS mutation_events (
        id VARCHAR(255) PRIMARY KEY,
        worldInstanceId UUID NOT NULL,
        tick INT DEFAULT 0,
        type VARCHAR(100),
        npcId VARCHAR(255),
        factionId VARCHAR(255),
        locationId VARCHAR(255),
        details JSONB DEFAULT '{}',
        eventTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (worldInstanceId) REFERENCES world_states(id) ON DELETE CASCADE
      );
    `);
    result.tablesCreated.push('mutation_events');

    // Create saves table
    console.log('📋 Creating table: saves');
    await client.query(`
      CREATE TABLE IF NOT EXISTS saves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        playerId UUID NOT NULL,
        worldInstanceId UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        tick INT,
        timestamp BIGINT,
        checksum VARCHAR(255),
        eventHashChain VARCHAR(255),
        stateSnapshotId UUID,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (worldInstanceId) REFERENCES world_states(id) ON DELETE CASCADE,
        FOREIGN KEY (stateSnapshotId) REFERENCES world_states(id) ON DELETE SET NULL
      );
    `);
    result.tablesCreated.push('saves');

    // Create lore_tomes table
    console.log('📋 Creating table: lore_tomes');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lore_tomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worldInstanceId UUID NOT NULL,
        narrativeKey VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        discovered BOOLEAN DEFAULT FALSE,
        discoveredAt TIMESTAMP,
        category VARCHAR(100),
        tier INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (worldInstanceId) REFERENCES world_states(id) ON DELETE CASCADE
      );
    `);
    result.tablesCreated.push('lore_tomes');

    // Create indexes for performance
    console.log('\n📊 Creating indexes');
    
    console.log('  ├─ Index on world_states(worldInstanceId)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_world_states_world_instance_id 
      ON world_states(worldInstanceId);
    `);
    result.indexesCreated.push('idx_world_states_world_instance_id');

    console.log('  ├─ Index on world_states(tick)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_world_states_tick 
      ON world_states(tick);
    `);
    result.indexesCreated.push('idx_world_states_tick');

    console.log('  ├─ Index on mutation_events(worldInstanceId, tick)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mutation_events_world_tick 
      ON mutation_events(worldInstanceId, tick);
    `);
    result.indexesCreated.push('idx_mutation_events_world_tick');

    console.log('  ├─ Index on mutation_events(npcId)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mutation_events_npc_id 
      ON mutation_events(npcId);
    `);
    result.indexesCreated.push('idx_mutation_events_npc_id');

    console.log('  ├─ Index on saves(playerId, createdAt)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saves_player_created 
      ON saves(playerId, createdAt DESC);
    `);
    result.indexesCreated.push('idx_saves_player_created');

    console.log('  └─ Index on lore_tomes(worldInstanceId, discovered)');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lore_tomes_discovery 
      ON lore_tomes(worldInstanceId, discovered);
    `);
    result.indexesCreated.push('idx_lore_tomes_discovery');

    result.success = true;
    console.log('\n✅ Database setup completed successfully!');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Check if error is about already existing tables (which is fine)
    if (errorMsg.includes('already exists')) {
      result.success = true;
      console.log('ℹ️  Tables already exist (skipped creation)');
    } else {
      result.success = false;
      result.errors.push(errorMsg);
      console.error('❌ Database setup failed:', errorMsg);
    }
  } finally {
    await client.end();
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║        DATABASE SETUP SUMMARY        ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`\n📊 Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (result.tablesCreated.length > 0) {
    console.log(`\n📋 Tables Created (${result.tablesCreated.length}):`);
    result.tablesCreated.forEach(t => console.log(`   ✓ ${t}`));
  }
  
  if (result.indexesCreated.length > 0) {
    console.log(`\n📊 Indexes Created (${result.indexesCreated.length}):`);
    result.indexesCreated.forEach(i => console.log(`   ✓ ${i}`));
  }
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️  Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.log(`   ✗ ${e}`));
  }

  console.log(`\n📋 Verify tables with: psql -d isekai -c \"\\dt\"`);
  console.log('');

  return result;
}

// Run setup
setupDatabase()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
