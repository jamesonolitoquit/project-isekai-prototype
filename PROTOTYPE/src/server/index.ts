import express from 'express';
import type { WorldState } from '../engine/worldEngine';
// Phase 16: Database layer for persistent storage
import { initializeDatabase } from './db';
// Phase 23+: JWT Auth, Beta Keys, Socket.IO, Metrics
import { generateToken } from './auth';
import { validateBetaKey, markKeyAsUsed, generateBetaKeyBatch } from './betaKeys';
import { SocketIOBroadcaster, getOrCreateBroadcaster } from './socketServer';
import { createAdminRoutes } from './routes/admin';
import { getMetricsPrometheus } from './metrics';
import * as metrics from './metrics';

// Load environment configuration
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

interface SessionData {
  sessionId: string;
  startedAt: number;
  worldState?: WorldState;
  isActive: boolean;
}

interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeSessions: number;
  persistenceStatus: 'synced' | 'pending' | 'failed';
  lastHeartbeat: number;
  databaseConnected: boolean;
}

interface ChronicleData {
  deltaId: string;
  sessionId: string;
  epochNumber: number;
  epochId: string;
  worldDelta: any; // WorldDelta interface
  timestamp: number;
  factionPowerShifts: Record<string, number>;
  locationCount: number;
  npcChangeCount: number;
  eventLogText?: string;
}

interface LegacyProfile {
  legacyId: string;
  sessionId: string;
  generationNumber: number;
  playerName?: string;
  inheritedPerks: string[];
  factionReputation: Record<string, number>;
  accumulatedMythStatus: number;
  worldScars: any[];
  bloodlineDeeds: string[];
}

// In-memory session store (replace with Redis/DB in production)
const activeSessions = new Map<string, SessionData>();
// Phase 15: Chronicle delta database (store WorldDelta packages)
const chronicleDeltas = new Map<string, ChronicleData[]>();
// Phase 16: Legacy profiles and resource control
const legacyProfiles = new Map<string, LegacyProfile[]>();
const resourceNodes = new Map<string, { nodeId: string; locationId: string; resourceType: string; controllingFactionId: string; powerContribution: number }>();

// Phase 23+: Beta keys in-memory store (would be persisted to DB)
const betaKeys = new Map<string, any>();
// Pre-generate some beta keys for testing
const initialBetaKeys = generateBetaKeyBatch(100, 30);
for (const key of initialBetaKeys) {
  betaKeys.set(key.keyId, key);
}

let serverStartTime = Date.now();
let persistenceStatus: 'synced' | 'pending' | 'failed' = 'synced';
let databaseConnected = false;

export async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Phase 16: Initialize database layer
  const dbInit = await initializeDatabase();
  databaseConnected = dbInit.initialized || false;

  // Phase 23+: Initialize Socket.IO broadcaster
  const broadcaster = getOrCreateBroadcaster({
    port: parseInt(process.env.SOCKET_IO_PORT || '3002'),
    corsOrigin: process.env.SOCKET_IO_CORS_ORIGIN || '*',
    enableRedisAdapter: process.env.REDIS_ENABLED === 'true',
    redisHost: process.env.REDIS_HOST,
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });

  // Middleware
  app.use(express.json());

  // Phase 23+: API request logging & metrics middleware
  app.use((req, express, next) => {
    const startTime = Date.now();
    const originalSend = express.send;

    express.send = function (data: any) {
      const latency = Date.now() - startTime;
      metrics.recordAPIRequest(req.method, req.path, express.statusCode || 200, latency);
      originalSend.call(this, data);
    };

    next();
  });

  // Health check endpoint  
  app.get('/api/health', (_req, res) => {
    const uptime = Date.now() - serverStartTime;
    const health: ServerHealth = {
      status: persistenceStatus === 'failed' ? 'unhealthy' : persistenceStatus === 'pending' ? 'degraded' : 'healthy',
      uptime,
      activeSessions: activeSessions.size,
      persistenceStatus,
      lastHeartbeat: Date.now(),
      databaseConnected
    };
    res.json(health);
  });

  // Phase 23+: Prometheus metrics endpoint
  if (process.env.PROMETHEUS_ENABLED === 'true') {
    app.get('/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', 'text/plain');
        const metrics = await getMetricsPrometheus();
        res.send(metrics);
      } catch (error) {
        console.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    });
  }

  // Phase 23+: Beta key validation endpoint (public, no auth required)
  app.post('/api/auth/validate-beta-key', (req, res) => {
    const { betaKey: key } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Beta key is required' });
    }

    const result = validateBetaKey(key, betaKeys);

    if (!result.isValid) {
      return res.status(401).json({ error: result.reason });
    }

    // Mark key as used
    for (const [, betaKeyObj] of betaKeys) {
      if (betaKeyObj.key === key) {
        markKeyAsUsed(betaKeyObj);
        break;
      }
    }

    res.json({
      success: true,
      message: 'Beta key validated',
      playerId: result.playerId,
    });
  });

  // Phase 23+: Moderator login endpoint
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // In production: Validate against database
    // For now: Mock validation
    if (password === 'dev-password' || process.env.NODE_ENV === 'development') {
      const moderatorId = `mod-${Date.now()}`;
      const token = generateToken(moderatorId, username, `${username}@isekai.game`, 'admin');

      res.json({
        success: true,
        token,
        moderator: {
          moderatorId,
          username,
          role: 'admin',
        },
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // Phase 23+: Admin routes (all protected by JWT auth)
  const adminRoutes = createAdminRoutes(broadcaster);
  app.use('/api/admin', adminRoutes);

  // Start session endpoint
  app.post('/api/session/start', (req, res) => {
    const { worldTemplate, seed } = req.body;
    
    if (!seed) {
      return res.status(400).json({ error: 'Seed is required' });
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create session (worldState would be initialized here)
    const session: SessionData = {
      sessionId,
      startedAt: Date.now(),
      worldState: undefined, // Would be populated from worldEngine
      isActive: true
    };

    activeSessions.set(sessionId, session);
    // Initialize chronicle deltas for this session
    chronicleDeltas.set(sessionId, []);
    persistenceStatus = 'pending';

    res.json({
      sessionId,
      status: 'session_started',
      createdAt: session.startedAt
    });
  });

  // Session snapshot endpoint
  app.get('/api/session/snapshot/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Mark persistence as synced
    persistenceStatus = 'synced';

    res.json({
      sessionId,
      isActive: session.isActive,
      startedAt: session.startedAt,
      uptime: Date.now() - session.startedAt,
      worldState: session.worldState || { /* minimal snapshot */ }
    });
  });

  // Legacy profile endpoint
  app.get('/api/legacy/profile', (_req, res) => {
    res.json({
      serverVersion: '1.0.0',
      phase: 'PHASE_16_CHRONICLES_PERSISTENT_TIMELINES',
      activeSessions: activeSessions.size,
      uptime: Date.now() - serverStartTime,
      persistence: {
        status: persistenceStatus,
        lastSync: Date.now(),
        databaseConnected
      },
      features: {
        fullTextSearch: true,
        temporalReconstruction: true,
        resourceControl: true,
        divergenceAnalytics: true
      }
    });
  });

  // Phase 16: Search chronicles by keyword (Task 2)
  app.get('/api/chronicle/search', (req, res) => {
    const { sessionId, query, limit = '50' } = req.query as { sessionId?: string; query?: string; limit?: string };

    // Validate parameters
    if (!sessionId || !query) {
      return res.status(400).json({
        error: 'sessionId and query parameters are required',
        example: '/api/chronicle/search?sessionId=session-xxx&query=Defeated&limit=50'
      });
    }

    const searchLimit = Math.min(parseInt(limit, 10) || 50, 1000);
    const deltas = chronicleDeltas.get(sessionId as string) || [];

    // Search through event logs using simple string matching
    // In production: Use PostgreSQL full-text search with GIN indexes
    const results = deltas
      .flatMap(delta => 
        (delta.worldDelta.eventLog || [])
          .map((event: string, index: number) => ({
            eventIndex: index,
            eventText: event,
            deltaId: delta.deltaId,
            epochNumber: delta.epochNumber,
            epochId: delta.epochId,
            timestamp: delta.timestamp,
            matchStrength: (event.toLowerCase().match(new RegExp((query as string).toLowerCase(), 'g')) || []).length
          }))
          .filter(e => e.matchStrength > 0)
      )
      .sort((a, b) => b.matchStrength - a.matchStrength || b.timestamp - a.timestamp)
      .slice(0, searchLimit);

    res.json({
      sessionId,
      searchQuery: query,
      resultCount: results.length,
      results: results.map(r => ({
        epochNumber: r.epochNumber,
        epochId: r.epochId,
        eventText: r.eventText,
        matchStrength: r.matchStrength,
        timestamp: r.timestamp,
        deltaId: r.deltaId
      }))
    });
  });

  // Phase 15: Store chronicle delta for a session/epoch
  app.post('/api/chronicle/delta', (req, res) => {
    const { sessionId, epochNumber, epochId, worldDelta } = req.body;

    if (!sessionId || !worldDelta) {
      return res.status(400).json({ error: 'sessionId and worldDelta are required' });
    }

    persistenceStatus = 'pending';

    // Store delta
    const deltaId = `delta-${sessionId}-${epochNumber || 0}-${Date.now()}`;
    const chronicleEntry: ChronicleData = {
      deltaId,
      sessionId,
      epochNumber: epochNumber || 0,
      epochId: epochId || 'unknown',
      worldDelta,
      timestamp: Date.now(),
      factionPowerShifts: worldDelta.factionPowerShifts || {},
      locationCount: (worldDelta.locationChanges || []).length,
      npcChangeCount: (worldDelta.npcStateShifts || []).length
    };

    // Get or create delta collection for session
    if (!chronicleDeltas.has(sessionId)) {
      chronicleDeltas.set(sessionId, []);
    }
    chronicleDeltas.get(sessionId)!.push(chronicleEntry);

    // Mark persistence as synced after storage
    persistenceStatus = 'synced';

    res.json({
      deltaId,
      sessionId,
      epochNumber,
      stored: true,
      timestamp: chronicleEntry.timestamp,
      message: `Chronicle delta stored for epoch ${epochNumber}`
    });
  });

  // Phase 15: Retrieve chronicle deltas for a session (historical archive)
  app.get('/api/chronicle/delta/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (!chronicleDeltas.has(sessionId)) {
      return res.status(404).json({ error: 'No chronicle deltas found for this session' });
    }

    const deltas = chronicleDeltas.get(sessionId) || [];

    res.json({
      sessionId,
      totalDeltas: deltas.length,
      deltas: deltas.map(d => ({
        deltaId: d.deltaId,
        epochNumber: d.epochNumber,
        epochId: d.epochId,
        timestamp: d.timestamp,
        factionShiftCount: Object.keys(d.factionPowerShifts).length,
        locationChangeCount: d.locationCount,
        npcChangeCount: d.npcChangeCount,
        eventLogLines: (d.worldDelta.eventLog || []).length
      }))
    });
  });

  // Phase 15: Reconstruct world state from specific delta (for Soul Mirror Séance lookups)
  app.get('/api/chronicle/delta/:sessionId/:epochNumber', (req, res) => {
    const { sessionId, epochNumber } = req.params;
    const epoch = parseInt(epochNumber, 10);

    if (!chronicleDeltas.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const deltas = chronicleDeltas.get(sessionId) || [];
    const targetDelta = deltas.find(d => d.epochNumber === epoch);

    if (!targetDelta) {
      return res.status(404).json({ error: `No delta found for epoch ${epoch}` });
    }

    res.json({
      sessionId,
      epochNumber: epoch,
      epochId: targetDelta.epochId,
      worldDelta: targetDelta.worldDelta,
      reconstructedAt: Date.now(),
      factionShiftCount: Object.keys(targetDelta.factionPowerShifts).length,
      message: `Reconstructed world state from epoch ${epoch}`
    });
  });

  // Phase 16: Store legacy profile (lineage tracking)
  app.post('/api/legacy/profile', (req, res) => {
    const { sessionId, generationNumber, playerName, inheritedPerks, factionReputation, mythStatus, worldScars, deeds } = req.body;

    if (!sessionId || generationNumber === undefined) {
      return res.status(400).json({ error: 'sessionId and generationNumber are required' });
    }

    const legacyId = `legacy-${sessionId}-gen-${generationNumber}-${Date.now()}`;
    const profile: LegacyProfile = {
      legacyId,
      sessionId,
      generationNumber,
      playerName,
      inheritedPerks: inheritedPerks || [],
      factionReputation: factionReputation || {},
      accumulatedMythStatus: mythStatus || 0,
      worldScars: worldScars || [],
      bloodlineDeeds: deeds || []
    };

    if (!legacyProfiles.has(sessionId)) {
      legacyProfiles.set(sessionId, []);
    }
    legacyProfiles.get(sessionId)!.push(profile);

    res.json({
      legacyId,
      sessionId,
      generationNumber,
      stored: true,
      timestamp: Date.now(),
      message: `Legacy profile stored for generation ${generationNumber}`
    });
  });

  // Phase 16: Retrieve all legacy profiles for a session
  app.get('/api/legacy/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (!legacyProfiles.has(sessionId)) {
      // Initialize empty if not found
      legacyProfiles.set(sessionId, []);
    }

    const profiles = legacyProfiles.get(sessionId) || [];

    res.json({
      sessionId,
      totalGenerations: profiles.length,
      legacies: profiles.map(p => ({
        legacyId: p.legacyId,
        generationNumber: p.generationNumber,
        playerName: p.playerName,
        inheritedPerkCount: p.inheritedPerks.length,
        factionCount: Object.keys(p.factionReputation).length,
        mythStatus: p.accumulatedMythStatus,
        scarCount: p.worldScars.length,
        deedCount: p.bloodlineDeeds.length
      }))
    });
  });

  // Phase 16: Update faction resource control (Task 5)
  app.post('/api/resources/control', (req, res) => {
    const { nodeId, locationId, resourceType, factionId, powerContribution } = req.body;

    if (!nodeId || !factionId) {
      return res.status(400).json({ error: 'nodeId and factionId are required' });
    }

    const node = {
      nodeId,
      locationId: locationId || 'unknown',
      resourceType: resourceType || 'generic',
      controllingFactionId: factionId,
      powerContribution: powerContribution || 5
    };

    resourceNodes.set(nodeId, node);

    res.json({
      nodeId,
      factionId,
      controlled: true,
      timestamp: Date.now(),
      powerContribution: node.powerContribution,
      message: `Resource node ${nodeId} now controlled by faction ${factionId}`
    });
  });

  // Phase 16: Get faction resource holdings and calculated power
  app.get('/api/resources/faction/:factionId', (req, res) => {
    const { factionId } = req.params;

    const holdings = Array.from(resourceNodes.values())
      .filter(node => node.controllingFactionId === factionId);

    const totalPower = holdings.reduce((sum, node) => sum + node.powerContribution, 0);

    res.json({
      factionId,
      nodeCount: holdings.length,
      totalPowerFromResources: totalPower,
      holdings: holdings.map(h => ({
        nodeId: h.nodeId,
        locationId: h.locationId,
        resourceType: h.resourceType,
        powerContribution: h.powerContribution
      }))
    });
  });

  // Phase 18 Task 1: Soul Echo Sync Endpoint (P2P broadcast)
  app.post('/api/soul-echo/broadcast', (req, res) => {
    const { sessionId, soulEcho, sourceClientId, isCanonical } = req.body;

    if (!sessionId || !soulEcho || !sourceClientId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Phase 18: Validate soul echo is syncable (not private)
    const { isSyncable } = require('../engine/soulEchoNetworkEngine');
    if (!isSyncable(soulEcho)) {
      return res.status(403).json({
        error: 'Echo is private and cannot be broadcast',
        echoId: soulEcho.echoId
      });
    }

    // Broadcast to other players in session
    const notification = {
      type: 'SOUL_ECHO_DISCOVERED',
      timestamp: Date.now(),
      sourceClientId,
      soulEcho,
      message: `✨ ${sourceClientId} has discovered a connection in history...`
    };

    res.json({
      status: 'broadcast_queued',
      echoId: soulEcho.echoId,
      notificationId: `notify-${Date.now()}`,
      targetSessions: 1,
      notification
    });
  });

  // Phase 18 Task 1: Soul Echo Sync Query (for subscribing players)
  app.get('/api/soul-echo/sync/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { since } = req.query as { since?: string };

    const sinceTime = since ? parseInt(since as string) : Date.now() - 3600000; // Default: last hour

    // Return syncable soul echoes discovered in this session since specified time
    res.json({
      sessionId,
      syncEchos: [],  // Would be populated from sync registry
      syncTimestamp: Date.now(),
      nextSyncIn: 30000  // Suggest checking again in 30 seconds
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('[server] Server closed');
      process.exit(0);
    });
  });

  const server = app.listen(PORT, () => {
    console.log(`[server] ✅ Express server listening on port ${PORT}`);
    console.log(`[server] Phase: PHASE_16_CHRONICLES_PERSISTENT_TIMELINES + PHASE_23_M69M70_INFRASTRUCTURE`);
    console.log(`[server] Database: ${databaseConnected ? 'CONNECTED' : 'IN-MEMORY (PROTOTYPE)'}`);
    console.log(`[server] Socket.IO: ${process.env.SOCKET_IO_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`[server] Metrics: ${process.env.PROMETHEUS_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`[server]`);
    console.log(`[server] === Health & Status ===`);
    console.log(`[server] Health: GET http://localhost:${PORT}/api/health`);
    if (process.env.PROMETHEUS_ENABLED === 'true') {
      console.log(`[server] Metrics: GET http://localhost:${PORT}/metrics`);
    }
    console.log(`[server]`);
    console.log(`[server] === Phase 23: Auth & Beta ===`);
    console.log(`[server] Login: POST http://localhost:${PORT}/api/auth/login { username, password }`);
    console.log(`[server] Beta Validate: POST http://localhost:${PORT}/api/auth/validate-beta-key { betaKey }`);
    console.log(`[server]`);
    console.log(`[server] === Phase 23: Moderator Admin (Protected) ===`);
    console.log(`[server] Reports: GET http://localhost:${PORT}/api/admin/reports`);
    console.log(`[server] Mod Action: POST http://localhost:${PORT}/api/admin/moderation/action`);
    console.log(`[server] Ban Player: POST http://localhost:${PORT}/api/admin/ban`);
    console.log(`[server] Analytics: GET http://localhost:${PORT}/api/admin/analytics`);
    console.log(`[server]`);
    console.log(`[server] === Phase 23: Socket.IO Real-Time ===`);
    console.log(`[server] Socket.IO: ws://localhost:${process.env.SOCKET_IO_PORT || 3002}`);
    console.log(`[server] Connected Moderators: ${broadcaster.getActiveConnectionCount()}`);
    console.log(`[server]`);
    console.log(`[server] === Session Management ===`);
    console.log(`[server] Session Start: POST http://localhost:${PORT}/api/session/start`);
    console.log(`[server] Session Snapshot: GET http://localhost:${PORT}/api/session/snapshot/:sessionId`);
    console.log(`[server]`);
  });

  return { app, server, broadcaster };
}
