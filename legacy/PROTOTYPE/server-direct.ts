import express from 'express';
import dotenv from 'dotenv';
import type { WorldState } from './engine/worldEngine';
import { initializeDatabase } from './server/db';
import { startServer } from './server/index';

// Load environment
dotenv.config({ path: '.env.local' });

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    console.log('🚀 Starting Phase 5A API Server...');
    console.log(`📦 Environment: NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`💾 Database: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`);
    
    await startServer();
    
    console.log(`✅ API Server ready on http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
