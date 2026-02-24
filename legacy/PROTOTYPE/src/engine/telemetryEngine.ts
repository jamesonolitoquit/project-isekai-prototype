/**
 * Phase 25 Task 4: Telemetry Engine
 * Live Ops & Analytics - Bridge between MetricsCollector (technical) and WorldState (narrative)
 * 
 * Purpose: Monitor Public Beta health through anonymous aggregate telemetry
 * - Location hotspots: Identify player clustering
 * - Economy vitality: Track resource flow
 * - Adaptive scaling: Link metrics to P2P throttle
 * - Live Ops triggers: Auto-emit world events based on density thresholds
 * 
 * Design: Lightweight, privacy-preserving telemetry with 10-second pulse intervals
 */

import type { WorldState } from './worldEngine';
import type { MetricsSnapshot, MetricsCollector } from '../server/metricsCollector';
import type { ClientRegistry, LocationRegistry } from '../server/p2pNetworkEngine';
import type { LiveOpsEngine } from './liveOpsEngine';

/**
 * Hotspot entry: Location with player density
 */
export interface LocationHotspot {
  locationId: string;
  locationName: string;
  playerCount: number;
  density: 'low' | 'moderate' | 'high' | 'critical';
}

/**
 * Telemetry pulse: Compressed anonymous data packet (sent every 10 seconds)
 */
export interface TelemetryPulse {
  timestamp: number;
  totalPlayers: number;
  activeConnections: number;
  consensusLagMs: number;
  hotspots: LocationHotspot[];  // Abbreviated: only locationId + count
  economyHealth: number;         // 0-100 score
  socialTension: number;         // 0-1 (from WorldState)
  adaptiveThrottleMultiplier: number; // 0.2-1.0 (broadcast frequency adjustment)
  // Phase 25 Task 6: Snapshot performance metrics
  snapshotWriteLatencyMs?: number;  // Average write latency
  snapshotReadLatencyMs?: number;   // Average read latency
  deltReplayCountAverage?: number;  // Average delta event count per rebuild
  // Phase 27 Task 1: Paradox engine metrics
  totalParadoxPoints?: number;  // Total paradox points accumulated
  activeAnomalies?: number;     // Number of active Age Rot anomalies
}

/**
 * Telemetry Engine singleton
 */
export class TelemetryEngine {
  private lastPulseTick: number = 0;
  private pulseInterval: number = 10; // 10-second broadcast interval
  private hotspotCache: LocationHotspot[] = [];
  private lastCacheUpdateTick: number = 0;
  private readonly cacheExpireTicks = 5; // Recalculate hotspots every 5 ticks
  
  // Thresholds for live ops triggers
  private readonly HOTSPOT_CRITICAL_THRESHOLD = 15; // Players per location for SOCIAL_OUTBURST
  private readonly HOTSPOT_FLASH_MERCHANT_THRESHOLD = 8; // Players per location for FLASH_MERCHANT
  private readonly HOTSPOT_DIVERSITY_THRESHOLD = 5; // Minimum locations with activity

  constructor() {}

  /**
   * Get location hotspots from LocationRegistry
   * Phase 25 Task 4 Step 2: Hotspot Aggregator
   */
  getLocationHotspots(
    locationRegistry: LocationRegistry,
    worldState: WorldState
  ): LocationHotspot[] {
    try {
      const hotspots: LocationHotspot[] = [];

      // Query all locations from worldState
      if (!worldState.locations) {
        return [];
      }

      for (const location of worldState.locations) {
        // Use LocationRegistry to get client count at this location
        const clientsAtLocation = locationRegistry.getClientsAtLocation(location.id);
        
        if (clientsAtLocation && clientsAtLocation.length > 0) {
          const density = this.calculateDensity(clientsAtLocation.length);
          
          hotspots.push({
            locationId: location.id,
            locationName: location.name || location.id,
            playerCount: clientsAtLocation.length,
            density
          });
        }
      }

      // Sort by player count (descending)
      hotspots.sort((a, b) => b.playerCount - a.playerCount);

      return hotspots;
    } catch (error) {
      console.error('[TelemetryEngine] Error calculating hotspots:', error);
      return [];
    }
  }

  /**
   * Calculate density category from player count
   */
  private calculateDensity(playerCount: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (playerCount >= 15) return 'critical';
    if (playerCount >= 8) return 'high';
    if (playerCount >= 4) return 'moderate';
    return 'low';
  }

  /**
   * Generate Telemetry Pulse - Compressed anonymous data packet
   * Phase 25 Task 4 Step 3: 10-second TELEMETRY_PULSE broadcast
   * Phase 25 Task 6: Include snapshot performance metrics
   */
  generateTelemetryPulse(
    worldState: WorldState,
    metricsCollector: MetricsCollector,
    clientRegistry: ClientRegistry,
    locationRegistry: LocationRegistry,
    currentTick: number
  ): TelemetryPulse {
    try {
      const metrics = metricsCollector.getCurrentMetrics();
      const hotspots = this.getLocationHotspots(locationRegistry, worldState);
      
      // Calculate economy health (0-100 scale)
      const economyHealth = this.calculateEconomyHealth(worldState, hotspots);
      
      // Calculate adaptive throttle multiplier
      const throttleMultiplier = this.calculateAdaptiveThrottle(metrics);

      // Phase 25 Task 6: Gather snapshot metrics
      let snapshotWriteLatencyMs: number | undefined;
      let snapshotReadLatencyMs: number | undefined;
      let deltReplayCountAverage: number | undefined;
      
      try {
        const { getSnapshotEngine } = require('./snapshotEngine');
        const snapshotEngine = getSnapshotEngine();
        snapshotWriteLatencyMs = snapshotEngine.getAverageWriteLatency();
        snapshotReadLatencyMs = snapshotEngine.getAverageReadLatency();
        deltReplayCountAverage = snapshotEngine.getAverageDeltaReplayCount();
      } catch (err) {
        // Snapshot metrics unavailable - not fatal
        console.debug('[TelemetryEngine] Snapshot metrics unavailable:', err);
      }

      const pulse: TelemetryPulse = {
        timestamp: Date.now(),
        totalPlayers: clientRegistry.getClientCount(),
        activeConnections: metrics.activeConnections,
        consensusLagMs: metrics.consensusLagMs,
        hotspots: hotspots.slice(0, 10), // Only top 10 hotspots
        economyHealth,
        socialTension: worldState.socialTension ?? 0,
        adaptiveThrottleMultiplier: throttleMultiplier,
        snapshotWriteLatencyMs,
        snapshotReadLatencyMs,
        deltReplayCountAverage,
        // Phase 27 Task 1: Paradox engine metrics
        totalParadoxPoints: worldState.paradoxState?.totalParadoxPoints ?? 0,
        activeAnomalies: worldState.paradoxState?.activeAnomalies?.size ?? 0
      };

      this.lastPulseTick = currentTick;
      return pulse;
    } catch (error) {
      console.error('[TelemetryEngine] Error generating telemetry pulse:', error);
      return {
        timestamp: Date.now(),
        totalPlayers: 0,
        activeConnections: 0,
        consensusLagMs: 0,
        hotspots: [],
        economyHealth: 50,
        socialTension: 0,
        adaptiveThrottleMultiplier: 1.0
      };
    }
  }

  /**
   * Calculate economy health based on NPC wealth and trade activity
   */
  private calculateEconomyHealth(worldState: WorldState, hotspots: LocationHotspot[]): number {
    try {
      let score = 50; // Base score
      
      // Increase score if NPCs have gold
      const totalNpcWealth = (worldState.npcs || []).reduce((sum, npc) => sum + (npc.gold || 0), 0);
      if (totalNpcWealth > 10000) score += 20;
      else if (totalNpcWealth > 5000) score += 10;
      
      // Increase score if economic hubs are active
      const tradingHubs = hotspots.filter(h => 
        h.playerCount >= 3 && ['village', 'market', 'tavern', 'guild'].some(t => 
          h.locationName.toLowerCase().includes(t)
        )
      );
      score += Math.min(tradingHubs.length * 5, 20);
      
      // Check for active factions (indicates active warfare/trade)
      if (worldState._factionMetadata) {
        const activeConflicts = (worldState._factionMetadata.active_conflicts as number | undefined) ?? 0;
        if (activeConflicts > 0) score += 10;
      }
      
      return Math.min(100, score);
    } catch (error) {
      return 50;
    }
  }

  /**
   * Phase 25 Task 4 Step 4: Adaptive Scaling Feedback
   * Link metricsCollector.consensusLagMs to broadcast throttle
   * 
   * Returns throttle multiplier:
   * - 1.0: Fully responsive (lag < 50ms)
   * - 0.7: Reduced (lag 50-100ms)
   * - 0.4: Throttled (lag 100-200ms)
   * - 0.2: Minimal (lag > 200ms)
   */
  calculateAdaptiveThrottle(metrics: MetricsSnapshot): number {
    const lag = metrics.consensusLagMs ?? 0;
    
    if (lag < 50) {
      return 1.0; // 20 Hz broadcast
    } else if (lag < 100) {
      return 0.7; // 14 Hz broadcast
    } else if (lag < 200) {
      return 0.4; // 8 Hz broadcast
    } else {
      return 0.2; // 4 Hz broadcast (minimal)
    }
  }

  /**
   * Phase 25 Task 4 Step 5: Live Ops Hook
   * Evaluate telemetry and emit live ops events via LiveOpsEngine
   * Phase 25 Task 6: Monitor snapshot health via telemetry
   * 
   * Triggers:
   * - FLASH_MERCHANT: 1+ location with 8+ players (commerce opportunity)
   * - SOCIAL_OUTBURST: 1+ location with 15+ players + high GST (crowd dynamics)
   * - ECONOMY_BOOM: Multiple hubs active (general prosperity)
   * - ECONOMY_STAGNATION: No hubs active + low GST (depression event)
   * - SNAPSHOT_HEALTH_WARNING: High delta replay or latency detected
   */
  emitLiveOpsEvents(
    pulse: TelemetryPulse,
    worldState: WorldState,
    liveOpsEngine: LiveOpsEngine,
    currentTick: number
  ): void {
    try {
      // Phase 25 Task 6: Monitor snapshot health from telemetry pulse
      if (pulse.deltReplayCountAverage !== undefined && pulse.deltReplayCountAverage > 150) {
        console.warn(`[TelemetryEngine] Snapshot health warning: Average delta replay count ${pulse.deltReplayCountAverage?.toFixed(1)} exceeds 150 - possible missed snapshots`);
      }
      if (pulse.snapshotWriteLatencyMs !== undefined && pulse.snapshotWriteLatencyMs > 50) {
        console.warn(`[TelemetryEngine] Snapshot health warning: Write latency ${pulse.snapshotWriteLatencyMs?.toFixed(2)}ms exceeds 50ms threshold`);
      }
      if (pulse.snapshotReadLatencyMs !== undefined && pulse.snapshotReadLatencyMs > 30) {
        console.warn(`[TelemetryEngine] Snapshot health warning: Read latency ${pulse.snapshotReadLatencyMs?.toFixed(2)}ms exceeds 30ms threshold`);
      }

      // Find density tiers
      const criticalHotspots = pulse.hotspots.filter(h => h.density === 'critical');
      const highHotspots = pulse.hotspots.filter(h => h.density === 'high' || h.density === 'critical');
      
      // Event 1: FLASH_MERCHANT (commercial opportunity)
      if (highHotspots.length > 0 && pulse.economyHealth < 70) {
        liveOpsEngine.scheduleEvent(
          'flash_merchant',
          'Flash Merchant Arrival',
          'commerce_event',
          300, // 5 minute delay
          currentTick,
          60,
          `A traveling merchant appears in ${highHotspots[0]?.locationName || 'the region'} offering rare wares!`,
          {
            icon: '🛍️',
            createdBy: 'telemetry'
          }
        );
      }
      
      // Event 2: SOCIAL_OUTBURST (crowd dynamics, already defined in macro events)
      if (criticalHotspots.length > 0 && pulse.socialTension > 0.85) {
        // This would be auto-triggered by macroEventEngine based on GST
        // Telemetry just amplifies the signal
        // (No action needed - macro events already handle this)
      }
      
      // Event 3: ECONOMY_BOOM (prosperity)
      if (highHotspots.length >= this.HOTSPOT_DIVERSITY_THRESHOLD && pulse.economyHealth >= 75) {
        liveOpsEngine.scheduleEvent(
          'economy_boom',
          'Golden Times',
          'economy_event',
          600, // 10 minute delay
          currentTick,
          40,
          'The realm enters a period of unprecedented prosperity. Trade flourishes!',
          {
            icon: '💰',
            createdBy: 'telemetry'
          }
        );
      }
      
      // Event 4: ECONOMY_STAGNATION (depression)
      if (highHotspots.length === 0 && pulse.socialTension < 0.2 && pulse.economyHealth < 40) {
        liveOpsEngine.scheduleEvent(
          'economy_stagnation',
          'The Doldrums',
          'economy_event',
          1200, // 20 minute delay
          currentTick,
          35,
          'Economic activity has ceased. The realm enters a period of stagnation.',
          {
            icon: '📉',
            createdBy: 'telemetry'
          }
        );
      }
    } catch (error) {
      console.error('[TelemetryEngine] Error emitting live ops events:', error);
    }
  }

  /**
   * Check if telemetry pulse should be emitted this tick
   */
  shouldEmitPulse(currentTick: number): boolean {
    const ticksSinceLastPulse = currentTick - this.lastPulseTick;
    return ticksSinceLastPulse >= this.pulseInterval;
  }

  /**
   * Reset pulse interval (useful for testing)
   */
  setPulseInterval(ticks: number): void {
    this.pulseInterval = Math.max(1, ticks);
  }

  /**
   * Get last pulse data (for debugging)
   */
  getLastPulseTick(): number {
    return this.lastPulseTick;
  }
}

/**
 * Singleton instance
 */
let telemetryEngineInstance: TelemetryEngine | null = null;

export function getTelemetryEngine(): TelemetryEngine {
  if (!telemetryEngineInstance) {
    telemetryEngineInstance = new TelemetryEngine();
  }
  return telemetryEngineInstance;
}
