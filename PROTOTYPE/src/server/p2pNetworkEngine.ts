/**
 * Phase 22 Task 1: P2P Network Foundation
 * 
 * WebSocket-based real-time communication for multiplayer synchronization.
 * Manages concurrent player connections, message routing, and server health.
 * 
 * Architecture:
 * - ClientRegistry: Track all connected clients with metadata
 * - Connection lifecycle: connect → authenticate → heartbeat → disconnect
 * - Message queue: Priority-based routing (STATE_UPDATE > ACTION > CHAT)
 * - Graceful shutdown: Notify clients, flush pending ops
 * - Telemetry: Connection metrics, latency tracking, error logging
 */

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { getOracleConsensusEngine, isConsentProposal, type ConsentProposal, type OracleVerdict } from '../engine/oracleConsensusEngine';

/**
 * Client connection metadata and socket (Phase 24: Enhanced with spatial data)
 */
export interface ClientSocket {
  clientId: string;
  sessionId: string;
  lastHeartbeat: number;
  socket: WebSocket;
  isAlive: boolean;
  messageCount: number;
  lastMessageTime: number;
  // Phase 24: Spatial interest management
  locationId?: string;  // Current location ID
  lastSyncTick?: number;  // Last world tick synced to this client
  x?: number;  // Player X coordinate (0-1000)
  y?: number;  // Player Y coordinate (0-1000)
  lastStateDiff?: any;  // Last state snapshot for delta compression
}

/**
 * Message priority levels for queue ordering
 */
export enum MessagePriority {
  STATE_UPDATE = 0, // Highest priority - world state synchronization
  ACTION = 1,       // Player actions
  CHAT = 2,         // Chat/social messages (lowest priority)
}

/**
 * Queued message with metadata
 */
interface QueuedMessage {
  clientId: string;
  data: any;
  priority: MessagePriority;
  timestamp: number;
}

/**
 * Client registry for tracking connected clients
 */
export class ClientRegistry {
  private clients = new Map<string, ClientSocket>();
  private sessionToClient = new Map<string, string>(); // Session ID → Client ID mapping

  /**
   * Register a new client
   */
  register(clientSocket: ClientSocket): void {
    this.clients.set(clientSocket.clientId, clientSocket);
    this.sessionToClient.set(clientSocket.sessionId, clientSocket.clientId);
  }

  /**
   * Unregister a client
   */
  unregister(clientId: string): ClientSocket | undefined {
    const client = this.clients.get(clientId);
    if (client) {
      this.sessionToClient.delete(client.sessionId);
      this.clients.delete(clientId);
    }
    return client;
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): ClientSocket | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get client by session ID
   */
  getClientBySession(sessionId: string): ClientSocket | undefined {
    const clientId = this.sessionToClient.get(sessionId);
    return clientId ? this.clients.get(clientId) : undefined;
  }

  /**
   * Get all connected clients
   */
  getAllClients(): ClientSocket[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get count of active clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if client exists
   */
  hasClient(clientId: string): boolean {
    return this.clients.has(clientId);
  }
}

/**
 * Location-based Interest Registry (Phase 24: Interest Groups)
 * Tracks which clients are in each location for optimized broadcasting
 */
export class LocationRegistry {
  private locationToClients = new Map<string, Set<string>>();
  private clientToLocation = new Map<string, string>();
  private zonalCache = new Map<string, any[]>();
  private readonly maxCachePerLocation = 50;

  registerClientAtLocation(clientId: string, locationId: string): void {
    const oldLocation = this.clientToLocation.get(clientId);
    if (oldLocation && oldLocation !== locationId) {
      const oldClients = this.locationToClients.get(oldLocation);
      if (oldClients) {
        oldClients.delete(clientId);
      }
    }

    if (!this.locationToClients.has(locationId)) {
      this.locationToClients.set(locationId, new Set());
    }
    this.locationToClients.get(locationId)!.add(clientId);
    this.clientToLocation.set(clientId, locationId);
  }

  unregisterClient(clientId: string): void {
    const locationId = this.clientToLocation.get(clientId);
    if (locationId) {
      const clients = this.locationToClients.get(locationId);
      if (clients) {
        clients.delete(clientId);
      }
    }
    this.clientToLocation.delete(clientId);
  }

  getClientsInLocation(locationId: string): string[] {
    const clients = this.locationToClients.get(locationId);
    return clients ? Array.from(clients) : [];
  }

  getClientLocation(clientId: string): string | undefined {
    return this.clientToLocation.get(clientId);
  }

  getClientCountInLocation(locationId: string): number {
    return this.locationToClients.get(locationId)?.size || 0;
  }

  /**
   * Phase 25 Task 4: Get all clients at a location (for telemetry)
   */
  getClientsAtLocation(locationId: string): string[] {
    return this.getClientsInLocation(locationId);
  }

  cacheMutation(locationId: string, mutation: any): void {
    if (!this.zonalCache.has(locationId)) {
      this.zonalCache.set(locationId, []);
    }
    const cache = this.zonalCache.get(locationId)!;
    cache.push(mutation);
    if (cache.length > this.maxCachePerLocation) {
      cache.shift();
    }
  }

  getLocationCache(locationId: string): any[] {
    return this.zonalCache.get(locationId) || [];
  }

  clearLocationCache(locationId: string): void {
    this.zonalCache.delete(locationId);
  }
}

/**
 * P2P Network Engine - WebSocket server and client management (Phase 24: Enhanced with scaling)
 */
export class P2pNetworkEngine extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clientRegistry = new ClientRegistry();
  private locationRegistry = new LocationRegistry();
  private messageQueue: QueuedMessage[] = [];
  private isProcessingQueue = false;
  private heartbeatInterval: NodeJS.Timer | null = null;
  private messageProcessInterval: NodeJS.Timer | null = null;
  private isShuttingDown = false;

  // Phase 27 Task 2: Oracle Consensus Engine integration
  private oracleConsensus = getOracleConsensusEngine();
  private oracleClientId = '0';  // Host acts as Oracle

  // Phase 23: Player queue for max capacity
  private waitingQueue: Array<{ socket: WebSocket; clientId: string; timestamp: number }> = [];
  private maxActivePlayers = 20;

  // Phase 24: Spatial scaling parameters
  private proximityRadius = 200;
  private adaptiveThrottleThreshold = 50;
  private highDensityThrottleHz = 2;
  private normalThrottleHz = 10;

  // Telemetry
  private stats = {
    totalConnections: 0,
    totalDisconnections: 0,
    messagesProcessed: 0,
    heartbeatFailures: 0,
    reconnects: 0,
    // Phase 27 Task 2: Oracle Consensus metrics
    consensusLagMs: 0,
    verdicts: { granted: 0, denied: 0, malformed: 0 },
    lastConflictResolution: Date.now(),
  };

  /**
   * Initialize WebSocket server
   */
  async initializeP2pServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket server
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (socket: WebSocket, req) => {
          this.handleNewConnection(socket, req);
        });

        this.wss.on('error', (error) => {
          console.error('[P2P] WebSocket server error:', error);
          this.emit('error', error);
        });

        // Start heartbeat check every 10 seconds
        this.heartbeatInterval = setInterval(() => {
          this.checkHeartbeats();
        }, 10000);

        // Phase 27 Task 2: Optimize for 6-player sync: reduced message processing interval
        // At 6 players with high action frequency, process messages every 30ms instead of 50ms
        this.messageProcessInterval = setInterval(() => {
          this.processMessageQueue();
        }, 30);

        console.log(`[P2P] WebSocket server initialized on port ${port}`);
        resolve();
      } catch (error) {
        console.error('[P2P] Failed to initialize WebSocket server:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle new client connection (Phase 23: With player queue)
   */
  private handleNewConnection(socket: WebSocket, req: any): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = req.url?.split('?sessionId=')[1] || `session-${Date.now()}`;

    console.log(`[P2P] New connection: ${clientId} from session ${sessionId}`);

    // Check if at capacity (Phase 23: Graceful queuing)
    if (this.clientRegistry.getClientCount() >= this.maxActivePlayers) {
      const queuePosition = this.waitingQueue.length + 1;
      const estimatedWait = Math.ceil((queuePosition * 120) / this.maxActivePlayers); // Rough estimate

      console.log(`[P2P] Server at capacity: queuing ${clientId} (position ${queuePosition})`);

      // Send queued message
      this.sendToClient_Raw(socket, {
        type: 'QUEUE_WAIT',
        clientId,
        position: queuePosition,
        estimatedWaitSeconds: estimatedWait,
        activeClients: this.clientRegistry.getClientCount(),
        maxCapacity: this.maxActivePlayers,
      });

      // Add to waiting queue
      this.waitingQueue.push({
        socket,
        clientId,
        timestamp: Date.now(),
      });

      // Set up timeout (disconnect if wait > 5 minutes)
      const waitTimeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex((q) => q.clientId === clientId);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
          socket.close(1008, 'Queue timeout');
          console.log(`[P2P] Queued client ${clientId} timed out`);
        }
      }, 5 * 60 * 1000);

      socket.on('close', () => {
        clearTimeout(waitTimeout);
        const index = this.waitingQueue.findIndex((q) => q.clientId === clientId);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
      });

      return;
    }

    // Create client socket metadata
    const clientSocket: ClientSocket = {
      clientId,
      sessionId,
      lastHeartbeat: Date.now(),
      socket,
      isAlive: true,
      messageCount: 0,
      lastMessageTime: Date.now(),
      locationId: undefined,
      lastSyncTick: 0,
      x: 500,
      y: 500,
      lastStateDiff: null,
    };

    // Register client
    this.clientRegistry.register(clientSocket);
    this.stats.totalConnections++;

    // Send welcome message with initial state
    this.sendToClient(clientId, {
      type: 'WELCOME',
      clientId,
      sessionId,
      timestamp: Date.now(),
      activeClients: this.clientRegistry.getClientCount(),
    });

    // Broadcast "player joined" to all other clients
    this.broadcastToOthers(clientId, {
      type: 'CLIENT_JOINED',
      joinedClientId: clientId,
      activeClients: this.clientRegistry.getClientCount(),
      timestamp: Date.now(),
    }, MessagePriority.ACTION);

    // Handle incoming messages
    socket.on('message', (data: WebSocket.Data) => {
      this.handleClientMessage(clientId, data);
    });

    // Handle pong (heartbeat response)
    socket.on('pong', () => {
      const client = this.clientRegistry.getClient(clientId);
      if (client) {
        client.lastHeartbeat = Date.now();
        client.isAlive = true;
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[P2P] Client error (${clientId}):`, error);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleClientMessage(clientId: string, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clientRegistry.getClient(clientId);

      if (!client) {
        console.warn(`[P2P] Message from unknown client: ${clientId}`);
        return;
      }

      // Update client metadata
      client.lastMessageTime = Date.now();
      client.messageCount++;

      // Phase 27 Task 2: Handle Consent Proposals (Oracle Consensus)
      if (message.type === 'CONSENT_PROPOSAL' && isConsentProposal(message)) {
        this.handleConsentProposal(clientId, message);
        return;
      }

      // Determine message priority
      let priority = MessagePriority.CHAT; // Default
      if (message.type === 'STATE_UPDATE' || message.type === 'WORLD_DIFF') {
        priority = MessagePriority.STATE_UPDATE;
      } else if (message.type === 'ACTION' || message.type === 'PLAYER_ACTION') {
        priority = MessagePriority.ACTION;
      }

      // Queue message for broadcast or processing
      message.clientId = clientId; // Attach sender ID
      message.timestamp = Date.now();

      this.messageQueue.push({
        clientId,
        data: message,
        priority,
        timestamp: Date.now(),
      });

      // Emit event for other systems to handle
      this.emit('message', { clientId, message });

    } catch (error) {
      console.error(`[P2P] Failed to parse message from ${clientId}:`, error);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clientRegistry.unregister(clientId);
    if (!client) return;

    this.stats.totalDisconnections++;
    console.log(`[P2P] Client disconnected: ${clientId} (session: ${client.sessionId})`);

    // Phase 24: Unregister from location
    if (client.locationId) {
      this.locationRegistry.unregisterClient(clientId);
    }

    // Broadcast "player left" to remaining clients
    if (!this.isShuttingDown) {
      if (client.locationId) {
        this.broadcastToLocation(client.locationId, {
          type: 'CLIENT_LEFT',
          leftClientId: clientId,
          activeClients: this.clientRegistry.getClientCount(),
          timestamp: Date.now(),
        }, MessagePriority.ACTION);
      } else {
        this.broadcast({
          type: 'CLIENT_LEFT',
          leftClientId: clientId,
          activeClients: this.clientRegistry.getClientCount(),
          timestamp: Date.now(),
        }, clientId, MessagePriority.ACTION);
      }
    }

    // Phase 23: Process waiting queue when space opens up
    if (this.waitingQueue.length > 0 && this.clientRegistry.getClientCount() < this.maxActivePlayers) {
      const nextWaiting = this.waitingQueue.shift();
      if (nextWaiting && nextWaiting.socket.readyState === WebSocket.OPEN) {
        console.log(`[P2P] Admitting queued client: ${nextWaiting.clientId}`);
        // Note: Re-trigger connection with the next socket
        this.handleNewConnection(nextWaiting.socket, { url: `?sessionId=${nextWaiting.clientId}` });
      }
    }

    // Emit disconnect event
    this.emit('clientDisconnected', { clientId, sessionId: client.sessionId });
  }

  /**
   * Phase 27 Task 2: Handle Consent Proposal from client
   * Oracle processes proposal and broadcasts verdict to all clients
   */
  private handleConsentProposal(clientId: string, proposal: ConsentProposal): void {
    const proposalStart = Date.now();
    
    // Get current server tick (placeholder; should sync with world engine)
    const currentServerTick = proposal.serverTick;

    // Request verdict from Oracle
    const verdict = this.oracleConsensus.requestActionConsent(proposal, currentServerTick);

    // Track consensus lag (round-trip time for judgment)
    const consensusLagMs = Date.now() - proposalStart;
    this.stats.consensusLagMs = consensusLagMs;

    // Update verdict statistics
    if (verdict.verdict === 'GRANTED') {
      this.stats.verdicts.granted++;
    } else if (verdict.verdict === 'DENIED') {
      this.stats.verdicts.denied++;
      this.stats.lastConflictResolution = Date.now();
    } else if (verdict.verdict === 'MALFORMED') {
      this.stats.verdicts.malformed++;
    }

    // Broadcast verdict to all clients
    // GRANTED: Actor client receives approval, others get notification
    // DENIED: Actor client receives denial, others get conflict resolution notification
    this.broadcast({
      type: 'ORACLE_VERDICT',
      verdict: verdict.verdict,
      verdictId: verdict.verdictId,
      clientId: verdict.clientId,
      targetId: verdict.targetId,
      reason: verdict.reason,
      consensusLagMs,
      conflictingClientId: verdict.conflictingClientId,
      lockNonce: verdict.lockNonce,
      timestamp: Date.now()
    }, undefined, MessagePriority.ACTION);

    // Emit event for telemetry/logging
    this.emit('consensusVerdict', { verdict, consensusLagMs, proposalStart });

    // Log consensus activity
    if (verdict.verdict === 'DENIED') {
      console.log(`[P2P] Consensus conflict resolved: ${clientId} denied for ${proposal.targetId} (conflict with ${verdict.conflictingClientId})`);
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: any): boolean {
    const client = this.clientRegistry.getClient(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[P2P] Failed to send message to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send message to raw WebSocket (Phase 23: for queued clients)
   */
  private sendToClient_Raw(socket: WebSocket, message: any): boolean {
    if (socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[P2P] Failed to send message to raw socket:', error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: any, excludeClientId?: string, priority = MessagePriority.ACTION): void {
    this.messageQueue.push({
      clientId: 'BROADCAST',
      data: { ...message, excludeClientId },
      priority,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast to all clients except sender
   */
  broadcastToOthers(clientId: string, message: any, priority = MessagePriority.ACTION): void {
    this.broadcast(message, clientId, priority);
  }

  /**
   * Phase 24: Broadcast message to specific location (Interest Group)
   */
  broadcastToLocation(locationId: string, message: any, priority = MessagePriority.ACTION): void {
    this.messageQueue.push({
      clientId: `LOCATION:${locationId}`,
      data: { ...message, broadcastType: 'location', targetLocation: locationId },
      priority,
      timestamp: Date.now(),
    });
  }

  /**
   * Phase 24: Broadcast message to clients within proximity radius
   */
  broadcastToProximity(
    centerX: number,
    centerY: number,
    message: any,
    locationId: string,
    priority = MessagePriority.ACTION
  ): void {
    this.messageQueue.push({
      clientId: `PROXIMITY:${locationId}:${centerX}:${centerY}`,
      data: { ...message, broadcastType: 'proximity', targetLocation: locationId, centerX, centerY },
      priority,
      timestamp: Date.now(),
    });
  }

  /**
   * Phase 25 Task 4 Step 3: Broadcast telemetry pulse
   * 10-second compressed anonymous data packet for live ops
   */
  broadcastTelemetryPulse(telemetryPulse: any): void {
    this.messageQueue.push({
      clientId: 'TELEMETRY_PULSE',
      data: {
        type: 'TELEMETRY_PULSE',
        payload: telemetryPulse,
        broadcastType: 'telemetry'
      },
      priority: MessagePriority.CHAT, // Lowest priority
      timestamp: Date.now(),
    });
  }

  /**
   * Process queued messages (Phase 24: Enhanced with location-aware broadcasting)
   * Messages sorted by priority (STATE_UPDATE first)
   */
  private processMessageQueue(): void {
    if (this.isProcessingQueue || this.messageQueue.length === 0) return;

    this.isProcessingQueue = true;

    // Sort by priority (lower number = higher priority)
    this.messageQueue.sort((a, b) => a.priority - b.priority);

    // Process up to 100 messages per interval
    const toProcess = this.messageQueue.splice(0, 100);

    for (const queuedMsg of toProcess) {
      if (queuedMsg.clientId === 'BROADCAST') {
        // Global broadcast to all (except excluded)
        const exclude = queuedMsg.data.excludeClientId;
        const msg = { ...queuedMsg.data };
        delete msg.excludeClientId;

        for (const client of this.clientRegistry.getAllClients()) {
          if (exclude !== client.clientId) {
            this.sendToClient(client.clientId, msg);
          }
        }
      } else if (queuedMsg.clientId.startsWith('LOCATION:')) {
        // Phase 24: Location-based broadcast
        const locationId = queuedMsg.clientId.substring(9);
        const clientIds = this.locationRegistry.getClientsInLocation(locationId);
        const msg = { ...queuedMsg.data };
        delete msg.broadcastType;
        delete msg.targetLocation;

        for (const clientId of clientIds) {
          this.sendToClient(clientId, msg);
        }
      } else if (queuedMsg.clientId.startsWith('PROXIMITY:')) {
        // Phase 24: Proximity-based broadcast
        const parts = queuedMsg.clientId.split(':');
        const locationId = parts[1];
        const centerX = parseFloat(parts[2]);
        const centerY = parseFloat(parts[3]);

        const clientIds = this.locationRegistry.getClientsInLocation(locationId);
        const msg = { ...queuedMsg.data };
        delete msg.broadcastType;
        delete msg.targetLocation;
        delete msg.centerX;
        delete msg.centerY;

        for (const clientId of clientIds) {
          const client = this.clientRegistry.getClient(clientId);
          if (client && this.isClientInProximity(client, centerX, centerY)) {
            this.sendToClient(clientId, msg);
          }
        }
      } else if (queuedMsg.clientId === 'TELEMETRY_PULSE') {
        // Phase 25 Task 4 Step 3: Broadcast telemetry pulse to all connected clients
        const msg = { ...queuedMsg.data };
        delete msg.broadcastType;

        for (const client of this.clientRegistry.getAllClients()) {
          this.sendToClient(client.clientId, msg);
        }
      } else {
        // Send to specific client
        this.sendToClient(queuedMsg.clientId, queuedMsg.data);
      }

      this.stats.messagesProcessed++;
    }

    this.isProcessingQueue = false;
  }

  /**
   * Check heartbeat status and disconnect stale clients
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeoutMs = 30000; // 30 second timeout

    for (const client of this.clientRegistry.getAllClients()) {
      if (now - client.lastHeartbeat > timeoutMs) {
        console.warn(`[P2P] Heartbeat timeout for ${client.clientId}, disconnecting`);
        this.stats.heartbeatFailures++;
        client.socket.close(1000, 'Heartbeat timeout');
      } else {
        // Send ping
        try {
          client.socket.ping();
        } catch (error) {
          console.error(`[P2P] Failed to send ping to ${client.clientId}:`, error);
        }
      }
    }
  }

  /**
   * Phase 27 Task 2: Advance Oracle consensus state (cleanup expired locks)
   * Call this every tick from the world engine game loop
   */
  advanceOracleConsensus(currentServerTick: number): void {
    const cleanedLocks = this.oracleConsensus.cleanupTick(currentServerTick);
    if (cleanedLocks > 0) {
      // Optionally broadcast cleanup event for debug purposes
      // this.broadcast({ type: 'ORACLE_CLEANUP', expiredLocks: cleanedLocks, tick: currentServerTick }, undefined, MessagePriority.CHAT);
    }
  }

  /**
   * Phase 27 Task 2: Set Oracle designation (for host changes)
   */
  setOracleClientId(clientId: string): void {
    this.oracleClientId = clientId;
    this.oracleConsensus.setOracleClientId(clientId);
    console.log(`[P2P] Oracle designation changed to: ${clientId}`);
  }

  /**
   * Phase 27 Task 2: Get Oracle consensus statistics for telemetry
   */
  getOracleStats(): any {
    return this.oracleConsensus.getConsensusStats();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[P2P] Starting graceful shutdown...');
    this.isShuttingDown = true;

    // Stop accepting new messages
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval as any);
    if (this.messageProcessInterval) clearInterval(this.messageProcessInterval as any);

    // Notify all clients of shutdown
    const clients = this.clientRegistry.getAllClients();
    console.log(`[P2P] Notifying ${clients.length} clients of server shutdown...`);

    const shutdownMessage = {
      type: 'SERVER_SHUTDOWN',
      message: 'Server is shutting down. Please save your progress.',
      timestamp: Date.now(),
    };

    for (const client of clients) {
      this.sendToClient(client.clientId, shutdownMessage);
    }

    // Wait 3 seconds for clients to disconnect gracefully
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Force close any remaining connections
    if (this.wss) {
      this.wss.close();
    }

    console.log('[P2P] P2P Network Engine shutdown complete');
  }

  /**
   * Get telemetry statistics
   */
  getStats(): any {
    return {
      ...this.stats,
      activeClients: this.clientRegistry.getClientCount(),
      messageQueueLength: this.messageQueue.length,
      isShuttingDown: this.isShuttingDown,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all active clients
   */
  getActiveClients(): ClientSocket[] {
    return this.clientRegistry.getAllClients();
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clientRegistry.getClientCount();
  }

  // ========================================================================
  // PHASE 24: SPATIAL & SCALING METHODS
  // ========================================================================

  /**
   * Update client's location and coordinates (Phase 24: Handoff execution)
   */
  updateClientLocation(
    clientId: string,
    newLocationId: string,
    x?: number,
    y?: number
  ): void {
    const client = this.clientRegistry.getClient(clientId);
    if (!client) return;

    const oldLocationId = client.locationId;
    if (oldLocationId) {
      this.locationRegistry.unregisterClient(clientId);
      this.broadcastToLocation(oldLocationId, {
        type: 'PLAYER_LEFT_LOCATION',
        playerId: clientId,
        timestamp: Date.now(),
      }, MessagePriority.ACTION);
    }

    this.locationRegistry.registerClientAtLocation(clientId, newLocationId);

    client.locationId = newLocationId;
    client.x = x ?? client.x ?? 500;
    client.y = y ?? client.y ?? 500;
    client.lastSyncTick = 0;

    const locationCache = this.locationRegistry.getLocationCache(newLocationId);
    this.sendToClient(clientId, {
      type: 'LOCATION_LOADED',
      locationId: newLocationId,
      x: client.x,
      y: client.y,
      recentMutations: locationCache.slice(-20),
      timestamp: Date.now(),
    });

    this.broadcastToLocation(newLocationId, {
      type: 'PLAYER_JOINED_LOCATION',
      playerId: clientId,
      x: client.x,
      y: client.y,
      timestamp: Date.now(),
    }, MessagePriority.ACTION);
  }

  /**
   * Update client coordinates within same location
   */
  updateClientCoordinates(clientId: string, x: number, y: number): void {
    const client = this.clientRegistry.getClient(clientId);
    if (!client) return;

    client.x = x;
    client.y = y;
  }

  /**
   * Calculate distance between two points in coordinate space
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if client is within proximity radius of a point
   */
  private isClientInProximity(client: ClientSocket, centerX: number, centerY: number): boolean {
    if (!client.x || !client.y) return false;
    const distance = this.calculateDistance(client.x, client.y, centerX, centerY);
    return distance <= this.proximityRadius;
  }

  /**
   * Compress state delta (only changed fields) relative to last sync
   */
  compressDelta(clientId: string, newState: any): any {
    const client = this.clientRegistry.getClient(clientId);
    if (!client || !client.lastStateDiff) {
      client!.lastStateDiff = newState;
      return { type: 'FULL_STATE', data: newState };
    }

    const delta: any = { type: 'STATE_DELTA', changes: {} };
    const lastState = client.lastStateDiff;

    for (const key in newState) {
      if (JSON.stringify(newState[key]) !== JSON.stringify(lastState[key])) {
        delta.changes[key] = newState[key];
      }
    }

    client.lastStateDiff = newState;
    return delta;
  }

  /**
   * Determine throttle frequency based on server load (Phase 24: Adaptive throttle)
   */
  getThrottleFrequencyHz(messageType: string): number {
    const totalClients = this.clientRegistry.getClientCount();

    if (messageType === 'ACTION' || messageType === 'COMBAT') {
      return this.normalThrottleHz;
    }

    if (totalClients > this.adaptiveThrottleThreshold) {
      return this.highDensityThrottleHz;
    }

    return this.normalThrottleHz;
  }

  /**
   * Get clients in location for raid/event broadcasting
   */
  getClientsInLocation(locationId: string): ClientSocket[] {
    const clientIds = this.locationRegistry.getClientsInLocation(locationId);
    return clientIds
      .map(id => this.clientRegistry.getClient(id))
      .filter((c): c is ClientSocket => c !== undefined);
  }

  /**
   * Get number of concurrent players in a location
   */
  getLocationPlayerCount(locationId: string): number {
    return this.locationRegistry.getClientCountInLocation(locationId);
  }

  /**
   * Cache mutation for location handoff optimization
   */
  cacheMutationForLocation(locationId: string, mutation: any): void {
    this.locationRegistry.cacheMutation(locationId, mutation);
  }

  /**
   * Get scaling metrics for monitoring
   */
  getScalingMetrics(): any {
    const clients = this.clientRegistry.getAllClients();
    const locationDistribution: Record<string, number> = {};

    for (const client of clients) {
      if (client.locationId) {
        locationDistribution[client.locationId] = (locationDistribution[client.locationId] || 0) + 1;
      }
    }

    return {
      totalClients: this.clientRegistry.getClientCount(),
      messageQueueLength: this.messageQueue.length,
      locationDistribution,
      proximityRadius: this.proximityRadius,
      adaptiveThrottleThreshold: this.adaptiveThrottleThreshold,
      maxActivePlayers: this.maxActivePlayers,
      waitingQueueLength: this.waitingQueue.length,
    };
  }
}

// Singleton instance
let p2pEngine: P2pNetworkEngine | null = null;

/**
 * Get or create P2P engine singleton
 */
export function getP2pEngine(): P2pNetworkEngine {
  if (!p2pEngine) {
    p2pEngine = new P2pNetworkEngine();
  }
  return p2pEngine;
}

/**
 * Initialize and start P2P server
 */
export async function initializeP2pNetworkEngine(port: number = 8080): Promise<P2pNetworkEngine> {
  const engine = getP2pEngine();
  await engine.initializeP2pServer(port);
  return engine;
}
