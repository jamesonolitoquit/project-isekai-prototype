/**
 * Migration Runner for Phase 23 Database Schema
 * Automatically applies pending migrations on server startup
 * 
 * Usage: import { runMigrations } from './src/server/migrations'
 *        await runMigrations(databaseClient);
 */

import fs from 'fs';
import path from 'path';
import { DatabaseClient } from './db';

export interface MigrationResult {
  success: boolean;
  migrationsApplied: string[];
  errors: Array<{ migration: string; error: string }>;
}

/**
 * Run all pending migrations from scripts/migrations/ directory
 */
export async function runMigrations(dbClient: DatabaseClient): Promise<MigrationResult> {
  const migrationsDir = path.join(__dirname, '../scripts/migrations');
  const result: MigrationResult = {
    success: true,
    migrationsApplied: [],
    errors: [],
  };

  // Create migrations tracking table if it doesn't exist
  const createTrackingTable = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const trackingResult = await dbClient.query(createTrackingTable);
  if (!trackingResult.success) {
    console.error('❌ Failed to create schema_migrations table:', trackingResult.error);
    return {
      success: false,
      migrationsApplied: [],
      errors: [{ migration: 'schema_migrations', error: trackingResult.error || 'Unknown error' }],
    };
  }

  // Get list of migration files
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️  Migrations directory not found:', migrationsDir);
    return result;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Apply each migration
  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDir, file);

    // Check if already applied
    const checkQuery = 'SELECT 1 FROM schema_migrations WHERE name = $1';
    const checkResult = await dbClient.query(checkQuery, [file]);

    if (checkResult.success && checkResult.rows && checkResult.rows.length > 0) {
      console.log(`⏭️  Skipping migration (already applied): ${file}`);
      continue;
    }

    // Read and apply migration
    try {
      const sql = fs.readFileSync(fullPath, 'utf-8');

      // Split by semicolon and filter out empty statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        const execResult = await dbClient.query(statement);
        if (!execResult.success) {
          throw new Error(execResult.error);
        }
      }

      // Mark as applied
      const markQuery = 'INSERT INTO schema_migrations (name) VALUES ($1)';
      await dbClient.query(markQuery, [file]);

      console.log(`✅ Migration applied: ${file}`);
      result.migrationsApplied.push(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Migration failed: ${file}`, message);
      result.errors.push({ migration: file, error: message });
      result.success = false;
    }
  }

  return result;
}
