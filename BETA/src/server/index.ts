import express, { Request, Response } from 'express';
import * as http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { createAdapter } from '@socket.io/redis-adapter';

// Try to import redis client  
let redisModule: any;
try {
  const redis = require('redis');
  redisModule = redis;
} catch {
  console.warn('⚠️  Redis module not available - server will work without Redis adapter');
}

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with Redis adapter (for multi-instance support)
const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Global server instance for Socket.IO cleanup
let pgPool: Pool | null = null;
let redisClient: any = null;
let socketConnections = new Map<string, any>();

// ============================================
// MIDDLEWARE
// ============================================

// CORS headers middleware
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// DATABASE & REDIS CONNECTIONS
// ============================================

async function initializeConnections() {
  try {
    // PostgreSQL connection pool
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on('error', (err: Error) => {
      console.error('[pg] Unexpected error on idle client:', err);
    });

    // Test connection
    const client = await pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connected');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err);
    // Don't exit - allow server to run without DB for testing
  }

  try {
    // Redis connection (if module available)
    if (redisModule) {
      redisClient = redisModule.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      redisClient.on('error', (err: Error) => {
        console.error('[redis] Error:', err);
      });

      await redisClient.connect();
      console.log('✅ Redis connected');

      // Setup Socket.IO Redis adapter for scaling
      const pubClient = redisClient.duplicate();
      await pubClient.connect();
      io.adapter(createAdapter(redisClient, pubClient));
    } else {
      console.warn('⚠️  Redis not available - Socket.IO will use in-memory adapter');
    }
  } catch (err) {
    console.error('⚠️  Redis connection failed:', err);
    // Allow server to continue without Redis
  }
}

// ============================================
// REST API ENDPOINTS
// ============================================

/**
 * Health check endpoint (required by docker-compose healthcheck)
 */
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = pgPool ? 'connected' : 'unavailable';
    const redisStatus = redisClient ? 'connected' : 'unavailable';

    // Try to check database if available
    if (pgPool) {
      try {
        const client = await pgPool.connect();
        await client.query('SELECT 1');
        client.release();
      } catch (dbErr) {
        return res.status(503).json({
          status: 'unhealthy',
          database: 'error',
          error: String(dbErr)
        });
      }
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbStatus,
      redis: redisStatus,
      connections: {
        socketIO: socketConnections.size,
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: String(err)
    });
  }
});

/**
 * Game state endpoint
 */
app.get('/api/game/state', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'BETA Game Server',
    worldState: 'initialized',
    activePlayers: socketConnections.size,
    lastUpdate: new Date().toISOString(),
    environment: NODE_ENV
  });
});

/**
 * Auth endpoint (stub)
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  res.status(200).json({
    success: true,
    token: 'mock-jwt-token-' + Date.now(),
    userId: 'player-' + Date.now(),
    message: 'Login successful (stub)'
  });
});

/**
 * Auth endpoint (stub)
 */
app.post('/api/auth/signup', (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  res.status(201).json({
    success: true,
    userId: 'player-' + Date.now(),
    message: 'Account created (stub)'
  });
});

// ============================================
// SOCKET.IO EVENTS
// ============================================

io.on('connection', (socket) => {
  const socketId = socket.id;
  socketConnections.set(socketId, socket);
  
  console.log(`📡 Socket connected: ${socketId} (total: ${socketConnections.size})`);

  socket.emit('connect:success', {
    socketId,
    message: 'Connected to game server',
    timestamp: Date.now()
  });

  // Handle player join
  socket.on('player:join', (data: any) => {
    console.log(`🎮 Player joined:`, data);
    socket.emit('player:join:ack', { success: true });
    io.emit('world:update', { activePlayers: socketConnections.size });
  });

  // Handle player action
  socket.on('player:action', (action: any) => {
    console.log(`⚡ Action received:`, action);
    socket.emit('action:processed', { success: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    socketConnections.delete(socketId);
    console.log(`📴 Socket disconnected: ${socketId} (remaining: ${socketConnections.size})`);
  });

  // Handle errors
  socket.on('error', (error: any) => {
    console.error(`❌ Socket error (${socketId}):`, error);
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[error]', err);
  res.status(500).json({
    error: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  // Close Socket.IO
  io.close();
  socketConnections.clear();

  // Close database connections
  if (pgPool) {
    await pgPool.end();
    console.log('✅ PostgreSQL pool closed');
  }

  // Close Redis connection
  if (redisClient) {
    await redisClient.quit();
    console.log('✅ Redis connection closed');
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// SERVER STARTUP
// ============================================

export async function startServer() {
  try {
    console.log(`🚀 Starting BETA server (${NODE_ENV})...`);
    
    // Initialize connections
    await initializeConnections();

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Socket.IO listening on ws://localhost:${PORT}`);
      console.log(`✅ Health check: GET http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// ============================================
// EXPORT FOR MODULE USAGE
// ============================================

export { app, server, io, pgPool, redisClient };
