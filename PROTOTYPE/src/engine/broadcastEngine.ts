/**
 * Broadcast Engine: Real-Time WebSocket Updates
 * Emits M69/M70 events to connected clients (moderators, analysts, ops team)
 * Enables <1 second latency for dashboard updates
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

export type BroadcastEventType =
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

export interface BroadcastEvent {
  type: BroadcastEventType;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, any>;
  targetRoles?: string[]; // ['moderator', 'analyst', 'ops']
}

// ============================================================================
// BROADCAST MANAGER (In-Memory for Local Testing)
// ============================================================================

class BroadcastManager {
  private listeners: Map<string, Set<(event: BroadcastEvent) => void>> = new Map();
  private eventHistory: BroadcastEvent[] = [];
  private maxHistorySize = 1000;

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: BroadcastEventType, callback: (event: BroadcastEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(callback: (event: BroadcastEvent) => void): () => void {
    // Use special '*' key for all events
    if (!this.listeners.has('*')) {
      this.listeners.set('*', new Set());
    }

    this.listeners.get('*')?.add(callback);

    return () => {
      this.listeners.get('*')?.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: BroadcastEvent): void {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Call specific event listeners
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[BroadcastManager] Error in event handler for ${event.type}:`, err);
        }
      });
    }

    // Call all-events listener
    const allHandlers = this.listeners.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error('[BroadcastManager] Error in all-events handler:', err);
        }
      });
    }
  }

  /**
   * Get event history (for initial UI population)
   */
  getHistory(eventType?: BroadcastEventType, limit = 20): BroadcastEvent[] {
    if (!eventType) {
      return this.eventHistory.slice(-limit);
    }

    return this.eventHistory.filter((e) => e.type === eventType).slice(-limit);
  }

  /**
   * Clear listeners and history
   */
  reset(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let broadcastManagerInstance: BroadcastManager;

export function getBroadcastManager(): BroadcastManager {
  if (!broadcastManagerInstance) {
    broadcastManagerInstance = new BroadcastManager();
  }
  return broadcastManagerInstance;
}

// ============================================================================
// FACTORY FUNCTIONS FOR COMMON EVENTS
// ============================================================================

/**
 * Emit exploit detection event
 */
export function emitExploitDetected(playerId: string, exploitType: string, severity: string): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'exploit_detected',
    timestamp: Date.now(),
    severity: (severity === 'critical' ? 'critical' : severity === 'high' ? 'warning' : 'info') as any,
    data: {
      playerId,
      exploitType,
      severityLevel: severity,
      detectedAt: new Date().toISOString(),
    },
    targetRoles: ['moderator', 'ops'],
  });
}

/**
 * Emit churn prediction event
 */
export function emitChurnPredicted(
  playerId: string,
  riskScore: number,
  daysUntilChurn: number,
  intervention: string
): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'churn_predicted',
    timestamp: Date.now(),
    severity: riskScore > 80 ? 'critical' : riskScore > 60 ? 'warning' : 'info',
    data: {
      playerId,
      riskScore,
      daysUntilChurn,
      recommendedIntervention: intervention,
      predictedAt: new Date().toISOString(),
    },
    targetRoles: ['analyst', 'ops'],
  });
}

/**
 * Emit campaign triggered event
 */
export function emitCampaignTriggered(
  playerId: string,
  campaignType: string,
  tier: string,
  reward: string
): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'campaign_triggered',
    timestamp: Date.now(),
    severity: 'info',
    data: {
      playerId,
      campaignType,
      tier,
      reward,
      triggeredAt: new Date().toISOString(),
    },
    targetRoles: ['analyst'],
  });
}

/**
 * Emit engagement metrics update
 */
export function emitEngagementUpdated(cohortMetrics: {
  dau: number;
  mau: number;
  sessionLength: number;
  retention: { day1: number; day7: number; day30: number };
}): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'engagement_updated',
    timestamp: Date.now(),
    severity: 'info',
    data: {
      cohortMetrics,
      updatedAt: new Date().toISOString(),
    },
    targetRoles: ['analyst', 'ops'],
  });
}

/**
 * Emit rollback executed event
 */
export function emitRollbackExecuted(
  playerId: string,
  targetTick: number,
  reason: string,
  compensationGold: number
): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'rollback_executed',
    timestamp: Date.now(),
    severity: 'warning',
    data: {
      playerId,
      targetTick,
      reason,
      compensationGold,
      executedAt: new Date().toISOString(),
    },
    targetRoles: ['moderator', 'ops'],
  });
}

/**
 * Emit chat flag event
 */
export function emitChatFlagged(
  playerId: string,
  messageId: string,
  reason: string,
  severity: string
): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'chat_flagged',
    timestamp: Date.now(),
    severity: (severity === 'high' ? 'warning' : 'info') as any,
    data: {
      playerId,
      messageId,
      reason,
      flaggedAt: new Date().toISOString(),
    },
    targetRoles: ['moderator'],
  });
}

/**
 * Emit player status change (mute/ban)
 */
export function emitPlayerStatusChanged(
  playerId: string,
  action: 'muted' | 'banned' | 'unmuted',
  reason: string,
  duration?: number
): void {
  const manager = getBroadcastManager();
  const eventType = action === 'muted' ? 'player_muted' : action === 'banned' ? 'player_banned' : action;

  manager.emit({
    type: eventType as BroadcastEventType,
    timestamp: Date.now(),
    severity: action === 'banned' ? 'critical' : 'warning',
    data: {
      playerId,
      action,
      reason,
      duration: duration || null,
      changedAt: new Date().toISOString(),
    },
    targetRoles: ['moderator', 'ops'],
  });
}

/**
 * Emit anomaly flag event
 */
export function emitAnomalyFlagged(anomalyType: string, playersAffected: string[], severity: string): void {
  const manager = getBroadcastManager();
  manager.emit({
    type: 'anomaly_flagged',
    timestamp: Date.now(),
    severity: (severity === 'critical' ? 'critical' : 'warning') as any,
    data: {
      anomalyType,
      playersAffected,
      count: playersAffected.length,
      flaggedAt: new Date().toISOString(),
    },
    targetRoles: ['moderator', 'analyst'],
  });
}

// ============================================================================
// CLIENT HOOK FOR REACT
// ============================================================================

import { useEffect, useState } from 'react';

export function useBroadcastListener(
  eventType: BroadcastEventType | '*' = '*',
  onEvent?: (event: BroadcastEvent) => void
): BroadcastEvent[] {
  const [events, setEvents] = useState<BroadcastEvent[]>([]);
  const manager = getBroadcastManager();

  useEffect(() => {
    // Get initial history
    if (eventType === '*') {
      setEvents(manager.getHistory(undefined, 20));
    } else {
      setEvents(manager.getHistory(eventType, 20));
    }

    // Subscribe to new events
    const unsubscribe =
      eventType === '*'
        ? manager.subscribeAll((event) => {
            setEvents((prev) => [...prev.slice(-19), event]);
            onEvent?.(event);
          })
        : manager.subscribe(eventType, (event) => {
            setEvents((prev) => [...prev.slice(-19), event]);
            onEvent?.(event);
          });

    return () => unsubscribe();
  }, [eventType, manager]);

  return events;
}

// ============================================================================
// EXPORT SINGLETON FUNCTION
// ============================================================================

export function initBroadcastEngine(): void {
  // Ensure manager is initialized
  getBroadcastManager();
  console.log('[BroadcastEngine] Initialized');
}

export default {
  getBroadcastManager,
  emitExploitDetected,
  emitChurnPredicted,
  emitCampaignTriggered,
  emitEngagementUpdated,
  emitRollbackExecuted,
  emitChatFlagged,
  emitPlayerStatusChanged,
  emitAnomalyFlagged,
  useBroadcastListener,
  initBroadcastEngine,
};
