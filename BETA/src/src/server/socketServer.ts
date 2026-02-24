/**
 * socketServer.ts - Real-time Socket.IO server for M69+M70 broadcast events
 * 
 * Handles:
 * - Moderator console real-time updates
 * - Event subscription/unsubscription
 * - Multi-server synchronization via Redis adapter
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import type { Server as HTTPServer } from 'http';
import type { JWTPayload } from './auth';

export interface BroadcastEvent {
  eventId: string;
  type:
    | 'exploit_detected'
    | 'anomaly_flagged'
    | 'churn_predicted'
    | 'campaign_triggered'
    | 'engagement_updated'
    | 'cohort_metrics_updated'
    | 'rollback_executed'
    | 'chat_flagged'
    | 'player_muted'
    | 'player_banned';
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  targets?: string[]; // Socket room names (moderator, ops, analyst)
}

interface SocketServerConfig {
  port: number;
  corsOrigin?: string;
  enableRedisAdapter?: boolean;
  redisHost?: string;
  redisPort?: number;
}

interface SocketUser extends JWTPayload {
  socketId: string;
}

export class SocketIOBroadcaster {
  private io: SocketIOServer | null = null;
  private config: SocketServerConfig;
  private activeConnections = new Map<string, SocketUser>();
  private eventHistory: BroadcastEvent[] = [];
  private maxHistorySize = 500;

  constructor(config: SocketServerConfig) {
    this.config = config;
  }

  /**
   * Initialize Socket.IO server
   */
  async initialize(httpServer?: HTTPServer): Promise<SocketIOServer> {
    try {
      // Use provided HTTP server or create new one (for standalone usage)
      const server = httpServer || createServer();

      this.io = new SocketIOServer(server, {
        cors: {
          origin: this.config.corsOrigin || '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      });

      // Setup Redis adapter for multi-server synchronization
      if (this.config.enableRedisAdapter) {
        try {
          const { createAdapter } = await import('@socket.io/redis-adapter');
          const { createClient } = require('redis');

          const pubClient = createClient({
            host: this.config.redisHost || 'localhost',
            port: this.config.redisPort || 6379,
          });

          const subClient = pubClient.duplicate();

          await pubClient.connect();
          await subClient.connect();

          this.io.adapter(createAdapter(pubClient, subClient));
          console.log('✅ Socket.IO Redis adapter initialized');
        } catch (err) {
          console.warn('⚠️ Redis adapter not available, using in-memory adapter:', err);
        }
      }

      // Setup connection handler
      this.setupConnectionHandler();

      // Start HTTP server (if we created one)
      if (!httpServer) {
        server.listen(this.config.port, () => {
          console.log(`🚀 Socket.IO server listening on port ${this.config.port}`);
        });
      }

      return this.io;
    } catch (err) {
      console.error('Failed to initialize Socket.IO:', err);
      throw err;
    }
  }

  /**
   * Setup connection/disconnection handlers
   */
  private setupConnectionHandler(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`📱 Socket connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', (data: { token: string }, callback) => {
        try {
          const user = data as any; // In production, validate JWT here
          const socketUser: SocketUser = { ...user, socketId: socket.id };

          this.activeConnections.set(socket.id, socketUser);

          // Join role-based rooms
          socket.join(`${user.role}`); // admin, viewer, support
          socket.join('all_moderators');

          console.log(`✅ Authenticated: ${user.username} (${user.role})`);

          // Send recent event history
          callback({ success: true, history: this.getRecentEvents(20) });
        } catch (err) {
          console.error('Authentication failed:', err);
          callback({ success: false, error: 'Authentication failed' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.activeConnections.delete(socket.id);
        console.log(`📴 Socket disconnected: ${socket.id}`);
      });

      // Handle subscribe to specific event type
      socket.on('subscribe', (data: { eventType: string }, callback) => {
        socket.join(`event:${data.eventType}`);
        callback({ success: true });
      });

      // Handle unsubscribe
      socket.on('unsubscribe', (data: { eventType: string }, callback) => {
        socket.leave(`event:${data.eventType}`);
        callback({ success: true });
      });
    });
  }

  /**
   * Emit broadcast event to subscribed clients
   */
  emitBroadcast(event: BroadcastEvent): void {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to target rooms or all if not specified
    const rooms = event.targets || ['all_moderators'];
    for (const room of rooms) {
      this.io.to(room).emit('event', event);
    }

    console.log(`📤 Broadcast: ${event.type} → ${rooms.join(', ')}`);
  }

  /**
   * Emit to specific socket
   */
  emitToSocket(socketId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Emit to room
   */
  emitToRoom(room: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }

  /**
   * Get recent events (for dashboard initialization)
   */
  getRecentEvents(count: number): BroadcastEvent[] {
    return this.eventHistory.slice(-count);
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Get active moderators
   */
  getActiveModerators(): SocketUser[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * Broadcast exploit detection event
   */
  broadcastExploitDetected(playerId: string, exploitType: string, severity: 'high' | 'medium' | 'low'): void {
    this.emitBroadcast({
      eventId: `exploit-${Date.now()}-${Math.random()}`,
      type: 'exploit_detected',
      timestamp: Date.now(),
      severity: severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
      data: { playerId, exploitType },
      targets: ['admin', 'moderator'],
    });
  }

  /**
   * Broadcast churn prediction event
   */
  broadcastChurnPredicted(playerId: string, riskScore: number, recommendation: string): void {
    this.emitBroadcast({
      eventId: `churn-${Date.now()}-${Math.random()}`,
      type: 'churn_predicted',
      timestamp: Date.now(),
      severity: riskScore > 80 ? 'high' : riskScore > 60 ? 'medium' : 'low',
      data: { playerId, riskScore, recommendation },
      targets: ['analyst', 'admin'],
    });
  }

  /**
   * Broadcast campaign triggered event
   */
  broadcastCampaignTriggered(playerId: string, campaignType: string, reward: string): void {
    this.emitBroadcast({
      eventId: `campaign-${Date.now()}-${Math.random()}`,
      type: 'campaign_triggered',
      timestamp: Date.now(),
      severity: 'low',
      data: { playerId, campaignType, reward },
      targets: ['analyst', 'admin'],
    });
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      this.io.close();
      console.log('🛑 Socket.IO server shutdown');
    }
  }
}

// Singleton instance
let broadcasterInstance: SocketIOBroadcaster | null = null;

/**
 * Get or create Socket.IO broadcaster singleton
 */
export function getOrCreateBroadcaster(config?: SocketServerConfig): SocketIOBroadcaster {
  if (!broadcasterInstance && config) {
    broadcasterInstance = new SocketIOBroadcaster(config);
  }
  if (!broadcasterInstance) {
    throw new Error('Broadcaster not initialized. Call getOrCreateBroadcaster with config first.');
  }
  return broadcasterInstance;
}

export default { SocketIOBroadcaster, getOrCreateBroadcaster };
