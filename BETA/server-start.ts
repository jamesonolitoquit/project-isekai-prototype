/**
 * Server Entry Point
 * Starts the Express + Socket.IO game server
 * 
 * Run: npx ts-node server-start.ts
 * Or:  tsx server-start.ts
 */

import { startServer } from './src/server/index';

// Start the server
startServer().catch((err: Error) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// Keep the process alive
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
