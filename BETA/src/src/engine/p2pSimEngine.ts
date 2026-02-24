/**
 * M35 Task 6: Network P2P Mockery - Latency Simulation Engine
 * 
 * Simulates realistic network conditions for multiplayer testing and demonstration.
 * Allows developers to test game behavior under various network scenarios:
 * - High latency connections (200-500ms)
 * - Packet loss (5-20%)
 * - Jitter and variance
 * - Connection drops and reconnection
 * - Bandwidth throttling
 * 
 * Used for multiplayer session testing without requiring actual poor network conditions.
 */

/**
 * Network condition profiles for realistic simulation
 */
export type NetworkProfile = 
  | 'LAN'           // Ideal local network (5-10ms latency)
  | 'Broadband'     // Good home internet (20-50ms latency)
  | 'Mobile4G'      // Mobile connection (50-150ms latency)
  | 'Mobile3G'      // Slow mobile (150-400ms latency)
  | 'Satellite'     // Satellite internet (500-1000ms latency)
  | 'Rural'         // Poor rural connection (100-300ms, high packet loss)
  | 'Crisis'        // Emergency network conditions (250-800ms, heavy loss);

/**
 * Network simulation configuration
 */
export interface NetworkSimConfig {
  enabled: boolean;
  profile: NetworkProfile;
  
  // Latency simulation (milliseconds)
  baseLatency: number;
  latencyVariance: number;  // Random jitter (±ms)
  
  // Packet loss simulation
  packetLossRate: number;   // 0-1.0 (percentage)
  burstLossProbability: number;  // Chance of burst loss (multiple packets)
  
  // Bandwidth simulation
  maxBandwidth: number;     // KB/s
  
  // Connection stability
  disconnectProbability: number;  // Chance of random disconnect per second
  reconnectDelay: number;   // ms to wait before reconnection attempt
}

/**
 * Network event that occurred during simulation
 */
export interface NetworkEvent {
  type: 'latency' | 'loss' | 'disconnect' | 'reconnect' | 'jitter';
  timestamp: number;
  duration?: number;  // For disconnect events
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
}

/**
 * State tracking for ongoing network simulation session
 */
export interface NetworkSimState {
  config: NetworkSimConfig;
  isActive: boolean;
  connectedSessions: Map<string, number>;  // sessionId -> lastSeenTime
  disconnectedSessions: Set<string>;
  pendingReconnections: Map<string, number>;  // sessionId -> reconnectTime
  eventLog: NetworkEvent[];
  packetsSent: number;
  packetsDropped: number;
  avgLatency: number;
}

/**
 * Predefined network condition profiles
 */
const NETWORK_PROFILES: Record<NetworkProfile, Partial<NetworkSimConfig>> = {
  'LAN': {
    baseLatency: 7,
    latencyVariance: 2,
    packetLossRate: 0.001,
    burstLossProbability: 0.01,
    disconnectProbability: 0.00001,
    maxBandwidth: 10000  // KB/s
  },
  'Broadband': {
    baseLatency: 35,
    latencyVariance: 10,
    packetLossRate: 0.005,
    burstLossProbability: 0.05,
    disconnectProbability: 0.00005,
    maxBandwidth: 5000
  },
  'Mobile4G': {
    baseLatency: 100,
    latencyVariance: 30,
    packetLossRate: 0.02,
    burstLossProbability: 0.1,
    disconnectProbability: 0.0001,
    maxBandwidth: 1000
  },
  'Mobile3G': {
    baseLatency: 275,
    latencyVariance: 100,
    packetLossRate: 0.05,
    burstLossProbability: 0.2,
    disconnectProbability: 0.0005,
    maxBandwidth: 300
  },
  'Satellite': {
    baseLatency: 750,
    latencyVariance: 150,
    packetLossRate: 0.1,
    burstLossProbability: 0.3,
    disconnectProbability: 0.001,
    maxBandwidth: 100
  },
  'Rural': {
    baseLatency: 200,
    latencyVariance: 80,
    packetLossRate: 0.08,
    burstLossProbability: 0.15,
    disconnectProbability: 0.0002,
    maxBandwidth: 200
  },
  'Crisis': {
    baseLatency: 525,
    latencyVariance: 250,
    packetLossRate: 0.25,
    burstLossProbability: 0.4,
    disconnectProbability: 0.001,
    maxBandwidth: 50
  }
};

/**
 * M35: Create network simulation state with specified profile
 */
export function createNetworkSimState(profile: NetworkProfile = 'Broadband'): NetworkSimState {
  const profileConfig = NETWORK_PROFILES[profile];

  return {
    config: {
      enabled: false,
      profile,
      baseLatency: profileConfig.baseLatency ?? 35,
      latencyVariance: profileConfig.latencyVariance ?? 10,
      packetLossRate: profileConfig.packetLossRate ?? 0.005,
      burstLossProbability: profileConfig.burstLossProbability ?? 0.05,
      maxBandwidth: profileConfig.maxBandwidth ?? 5000,
      disconnectProbability: profileConfig.disconnectProbability ?? 0.0001,
      reconnectDelay: 5000
    },
    isActive: false,
    connectedSessions: new Map(),
    disconnectedSessions: new Set(),
    pendingReconnections: new Map(),
    eventLog: [],
    packetsSent: 0,
    packetsDropped: 0,
    avgLatency: profileConfig.baseLatency ?? 35
  };
}

/**
 * M35: Simulate latency for a network packet
 * Returns actual latency that would be experienced
 */
export function simulatePacketLatency(state: NetworkSimState): number {
  if (!state.config.enabled) return 0;

  // Base latency + random jitter
  const variance = (Math.random() - 0.5) * 2 * state.config.latencyVariance;
  const latency = Math.max(0, state.config.baseLatency + variance);

  // Update rolling average
  state.avgLatency = (state.avgLatency * 0.8) + (latency * 0.2);

  return Math.round(latency);
}

/**
 * M35: Determine if a packet should be dropped based on loss rate
 */
export function shouldDropPacket(state: NetworkSimState): boolean {
  if (!state.config.enabled) return false;

  // Check for packet loss
  if (Math.random() < state.config.packetLossRate) {
    state.packetsDropped++;
    return true;
  }

  return false;
}

/**
 * M35: Check if a connection should be simulated as disconnected
 */
export function checkConnectionStability(state: NetworkSimState, sessionId: string): {
  isConnected: boolean;
  willReconnectAt?: number;
} {
  if (!state.config.enabled) {
    return { isConnected: true };
  }

  // Check for random disconnection
  if (Math.random() < state.config.disconnectProbability) {
    if (!state.disconnectedSessions.has(sessionId)) {
      // Mark session as disconnected
      state.disconnectedSessions.add(sessionId);
      state.connectedSessions.delete(sessionId);

      // Schedule reconnection
      const reconnectTime = Date.now() + state.config.reconnectDelay;
      state.pendingReconnections.set(sessionId, reconnectTime);

      // Log event
      state.eventLog.push({
        type: 'disconnect',
        timestamp: Date.now(),
        severity: 'moderate',
        description: `Session ${sessionId.substring(0, 8)}... disconnected`,
        duration: state.config.reconnectDelay
      });
    }
  }

  // Check for reconnection
  if (state.pendingReconnections.has(sessionId)) {
    const reconnectTime = state.pendingReconnections.get(sessionId)!;
    if (Date.now() >= reconnectTime) {
      state.disconnectedSessions.delete(sessionId);
      state.pendingReconnections.delete(sessionId);
      state.connectedSessions.set(sessionId, Date.now());

      // Log reconnection
      state.eventLog.push({
        type: 'reconnect',
        timestamp: Date.now(),
        severity: 'minor',
        description: `Session ${sessionId.substring(0, 8)}... reconnected`
      });

      return { isConnected: true };
    }
  }

  const isConnected = !state.disconnectedSessions.has(sessionId);
  return {
    isConnected,
    willReconnectAt: isConnected ? undefined : state.pendingReconnections.get(sessionId)
  };
}

/**
 * M35: Get network diagnostics for UI display
 */
export function getNetworkDiagnostics(state: NetworkSimState): {
  profile: NetworkProfile;
  latency: number;
  packetLoss: string;
  bandwidth: number;
  connectionStatus: 'stable' | 'degraded' | 'critical';
  recentEvents: NetworkEvent[];
} {
  const lossPercentage = state.packetsSent > 0
    ? ((state.packetsDropped / state.packetsSent) * 100).toFixed(2)
    : '0.00';

  // Determine connection status
  let connectionStatus: 'stable' | 'degraded' | 'critical' = 'stable';
  if (state.avgLatency > 200 || parseFloat(lossPercentage) > 10) {
    connectionStatus = 'critical';
  } else if (state.avgLatency > 100 || parseFloat(lossPercentage) > 5) {
    connectionStatus = 'degraded';
  }

  return {
    profile: state.config.profile,
    latency: Math.round(state.avgLatency),
    packetLoss: `${lossPercentage}%`,
    bandwidth: state.config.maxBandwidth,
    connectionStatus,
    recentEvents: state.eventLog.slice(-10)
  };
}

/**
 * M35: Get human-readable description of network condition
 */
export function getNetworkConditionDescription(state: NetworkSimState): string {
  const profile = state.config.profile;
  const latency = Math.round(state.avgLatency);

  const descriptions: Record<NetworkProfile, string> = {
    'LAN': '🟢 Excellent LAN connection (ideal for local gaming)',
    'Broadband': '🟢 Good broadband connection (typical home internet)',
    'Mobile4G': '🟡 Mobile 4G connection (moderate latency)',
    'Mobile3G': '🟠 Mobile 3G connection (slow, noticeable delays)',
    'Satellite': '🔴 Satellite connection (high latency and loss)',
    'Rural': '🟠 Rural connection (variable quality)',
    'Crisis': '🔴 Crisis mode (severely degraded network)'
  };

  return `${descriptions[profile]} — ${latency}ms latency`;
}

/**
 * M35: Calculate expected sync delay for multiplayer actions
 */
export function calculateSyncDelay(state: NetworkSimState, isMultiplayer: boolean = true): number {
  if (!state.config.enabled || !isMultiplayer) {
    return 0;
  }

  // One-way trip = latency, but accounting for packet loss requiring retransmission
  let delayMs = state.avgLatency;

  // If packet loss > 5%, account for likely retransmission
  if (state.config.packetLossRate > 0.05) {
    const retransmissionChance = 1 - Math.pow(1 - state.config.packetLossRate, 3);
    delayMs += state.avgLatency * retransmissionChance;
  }

  return Math.round(delayMs);
}

/**
 * M35: Log network event for debugging
 */
export function logNetworkEvent(
  state: NetworkSimState,
  type: NetworkEvent['type'],
  severity: NetworkEvent['severity'],
  description: string
): void {
  state.eventLog.push({
    type,
    timestamp: Date.now(),
    severity,
    description
  });

  // Keep only last 100 events
  if (state.eventLog.length > 100) {
    state.eventLog = state.eventLog.slice(-100);
  }
}

/**
 * M35: Switch network profile (simulates changing network conditions)
 */
export function switchNetworkProfile(state: NetworkSimState, newProfile: NetworkProfile): void {
  const profileConfig = NETWORK_PROFILES[newProfile];

  state.config.profile = newProfile;
  state.config.baseLatency = profileConfig.baseLatency ?? 35;
  state.config.latencyVariance = profileConfig.latencyVariance ?? 10;
  state.config.packetLossRate = profileConfig.packetLossRate ?? 0.005;
  state.config.burstLossProbability = profileConfig.burstLossProbability ?? 0.05;
  state.config.maxBandwidth = profileConfig.maxBandwidth ?? 5000;
  state.config.disconnectProbability = profileConfig.disconnectProbability ?? 0.0001;

  logNetworkEvent(
    state,
    'latency',
    'moderate',
    `Network profile changed to ${newProfile}`
  );
}

/**
 * M35: Reset network simulation state (clear stats and events)
 */
export function resetNetworkSimState(state: NetworkSimState): void {
  state.eventLog = [];
  state.packetsSent = 0;
  state.packetsDropped = 0;
  state.avgLatency = state.config.baseLatency;
  state.disconnectedSessions.clear();
  state.pendingReconnections.clear();
}

/**
 * M35: Get realistic network loss burst (multiple consecutive packet losses)
 */
export function checkBurstLoss(state: NetworkSimState): boolean {
  if (!state.config.enabled) return false;

  // Burst loss is more likely if already experiencing loss
  if (Math.random() < state.config.burstLossProbability) {
    logNetworkEvent(
      state,
      'loss',
      'severe',
      'Burst packet loss detected (multiple consecutive dropped packets)'
    );
    return true;
  }

  return false;
}
