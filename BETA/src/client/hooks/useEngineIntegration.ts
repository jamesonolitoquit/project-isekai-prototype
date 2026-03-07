/**
 * Engine Integration Hook (Phase 8 - EventBus Integration)
 * 
 * React hook that subscribes to the EventBus and maintains a synchronized
 * copy of the world state in UI component state.
 * 
 * This hook:
 * 1. Subscribes to EventBus updates on mount
 * 2. Maps WorldUpdateEvent to UIWorldModel
 * 3. Applies perception filtering via UIPerceptionManager
 * 4. Tracks causal locks and visible state changes
 * 5. Handles Study Mode updates (time-lapse display)
 * 6. Emits UI notifications for important events (death, epoch, etc.)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { EventBus, WorldUpdateEvent, CausalLockInfo } from '../../engine/EventBus';
import { UIPerceptionManager } from '../managers/UIPerceptionManager';
import type { UIWorldModel, UINotification } from '../types/uiModel';
import type { Vessel } from '../../types';

/**
 * Engine integration state
 */
export interface EngineIntegrationState {
  // Event stream
  lastEvent: WorldUpdateEvent | null;
  eventCount: number;
  lastEventTick: number;
  
  // Player state
  playerVessel: Vessel | null;
  
  // Perceived state (after filtering)
  perceivedState: {
    playerPerception: number;
    playerWisdom: number;
    lagMultiplier: number;
  } | null;
  
  // Active causal locks
  causalLocks: CausalLockInfo[];
  
  // Study Mode state
  studyMode: {
    isActive: boolean;
    startTick: number;
    targetTick: number;
    currentTick: number;
  } | null;
  
  // Notifications (for alerts/popups)
  notifications: UINotification[];
  
  // Connection state
  isConnected: boolean;
  lastSyncTime: number;
  syncLatency: number; // ms since last event
}

/**
 * Hook Configuration
 */
export interface UseEngineIntegrationConfig {
  eventBus: EventBus;
  filterMutationTypes?: string[];      // Only listen to certain mutation types
  includeSnapshots?: boolean;          // Request full world snapshots (heavy)
  notificationTimeout?: number;        // How long to keep notifications (ms)
  onCausalLockUpdate?: (locks: CausalLockInfo[]) => void;
  onStudyModeUpdate?: (mode: any) => void;
  onMajorEvent?: (type: string, data: any) => void; // Death, epoch, etc.
}

/**
 * useEngineIntegration Hook
 * 
 * Main hook for UI components to subscribe to engine updates.
 * 
 * Usage:
 *   const { lastEvent, causalLocks, notifications } = useEngineIntegration({
 *     eventBus: globalEventBus,
 *     filterMutationTypes: ['vessel_death', 'epoch_transition']
 *   });
 */
export function useEngineIntegration(config: UseEngineIntegrationConfig) {
  const { eventBus, filterMutationTypes, includeSnapshots, notificationTimeout = 5000, onCausalLockUpdate, onStudyModeUpdate, onMajorEvent } = config;
  
  const [state, setState] = useState<EngineIntegrationState>({
    lastEvent: null,
    eventCount: 0,
    lastEventTick: 0,
    playerVessel: null,
    perceivedState: null,
    causalLocks: [],
    studyMode: null,
    notifications: [],
    isConnected: false,
    lastSyncTime: Date.now(),
    syncLatency: 0,
  });
  
  // Track subscriptions for cleanup
  const subscriptionRef = useRef<(() => void) | null>(null);
  const notificationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  /**
   * Handle incoming WorldUpdateEvent from EventBus
   */
  const handleWorldUpdate = useCallback((event: WorldUpdateEvent) => {
    const now = Date.now();
    const latency = now - state.lastSyncTime;
    
    // Update event history
    setState(prev => ({
      ...prev,
      lastEvent: event,
      eventCount: prev.eventCount + 1,
      lastEventTick: event.tick,
      lastSyncTime: now,
      syncLatency: latency,
      isConnected: true,
    }));
    
    // Update causal locks
    if (event.causalLocks && event.causalLocks.length > 0) {
      setState(prev => ({
        ...prev,
        causalLocks: event.causalLocks,
      }));
      onCausalLockUpdate?.(event.causalLocks);
    }
    
    // Detect major events (death, epoch transition, etc.)
    const hasDeath = event.mutations.some(m => m.type === 'death_event');
    const hasEpochTransition = !!event.epochTransition;
    const hasParadox = event.mutations.some(m => m.type === 'paradox_shift');
    
    if (hasDeath || hasEpochTransition || hasParadox) {
      // Create notification
      let notificationMessage = '';
      let notificationType: 'death' | 'epoch' | 'paradox' | 'warning' = 'warning';
      
      if (hasDeath) {
        notificationMessage = 'Your vessel has been destroyed!';
        notificationType = 'death';
        onMajorEvent?.('vessel_death', event.mutations.find(m => m.type === 'death_event'));
      }
      
      if (hasEpochTransition) {
        notificationMessage = `Epoch ${event.epochTransition?.oldEpoch} has ended. Welcome to Epoch ${event.epochTransition?.newEpoch}.`;
        notificationType = 'epoch';
        onMajorEvent?.('epoch_transition', event.epochTransition);
      }
      
      if (hasParadox) {
        notificationMessage = 'Paradoxical anomaly detected!';
        notificationType = 'paradox';
        onMajorEvent?.('paradox_event', event.mutations.find(m => m.type === 'paradox_shift'));
      }
      
      if (notificationMessage) {
        addNotification({
          id: `${event.tick}_${notificationType}`,
          type: notificationType,
          message: notificationMessage,
          timestamp: now,
          duration: notificationTimeout,
        });
      }
    }
    
    // Handle Study Mode updates
    if (event.uiEvents) {
      const studyModeEvent = event.uiEvents.find(e => e.type === 'study_mode_entered' || e.type === 'study_mode_exited');
      if (studyModeEvent) {
        if (studyModeEvent.type === 'study_mode_entered') {
          setState(prev => ({
            ...prev,
            studyMode: {
              isActive: true,
              startTick: event.tick,
              targetTick: event.tick + 10080, // Default 7 days
              currentTick: event.tick,
            },
          }));
        } else {
          setState(prev => ({
            ...prev,
            studyMode: null,
          }));
        }
        
        onStudyModeUpdate?.({
          isActive: studyModeEvent.type === 'study_mode_entered',
          tick: event.tick,
        });
      }
    }
  }, [state.lastSyncTime, onCausalLockUpdate, onStudyModeUpdate, onMajorEvent, notificationTimeout]);
  
  /**
   * Add a UI notification with auto-cleanup
   */
  const addNotification = useCallback((notification: UINotification) => {
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
    }));
    
    // Auto-remove notification after timeout
    if (notification.duration) {
      // Clear existing timer if any
      const existingTimer = notificationTimersRef.current.get(notification.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.filter(n => n.id !== notification.id),
        }));
        notificationTimersRef.current.delete(notification.id);
      }, notification.duration);
      
      notificationTimersRef.current.set(notification.id, timer);
    }
  }, []);
  
  /**
   * Manual notification firing (for custom events)
   */
  const notify = useCallback((
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    duration: number = 3000
  ) => {
    addNotification({
      id: `manual_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
      duration,
    });
  }, [addNotification]);
  
  /**
   * Remove a specific notification
   */
  const dismissNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
    }));
    
    const timer = notificationTimersRef.current.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      notificationTimersRef.current.delete(notificationId);
    }
  }, []);
  
  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
    
    // Clear all timers
    notificationTimersRef.current.forEach(timer => clearTimeout(timer));
    notificationTimersRef.current.clear();
  }, []);
  
  /**
   * Subscribe to EventBus on mount
   */
  useEffect(() => {
    if (!eventBus) {
      console.warn('[useEngineIntegration] No EventBus provided');
      return;
    }
    
    // Subscribe with optional filtering
    const unsubscribe = eventBus.subscribe(handleWorldUpdate, {
      mutationTypes: filterMutationTypes as any,
      includingSnapshots: includeSnapshots,
    });
    
    subscriptionRef.current = unsubscribe;
    
    // Mark as connected
    setState(prev => ({
      ...prev,
      isConnected: true,
    }));
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      subscriptionRef.current = null;
      
      // Clear all notification timers
      notificationTimersRef.current.forEach(timer => clearTimeout(timer));
      notificationTimersRef.current.clear();
    };
  }, [eventBus, filterMutationTypes, includeSnapshots, handleWorldUpdate]);
  
  /**
   * Track connection latency (detect when events stop arriving)
   */
  useEffect(() => {
    const connectionCheck = setInterval(() => {
      const now = Date.now();
      const timeSinceLastEvent = now - state.lastSyncTime;
      
      if (timeSinceLastEvent > 5000) {
        // No events in 5 seconds, likely disconnected
        setState(prev => ({
          ...prev,
          isConnected: false,
        }));
      }
    }, 1000);
    
    return () => clearInterval(connectionCheck);
  }, [state.lastSyncTime]);
  
  return {
    // Event state
    lastEvent: state.lastEvent,
    eventCount: state.eventCount,
    lastEventTick: state.lastEventTick,
    
    // Player state
    playerVessel: state.playerVessel,
    
    // Perception state
    perceivedState: state.perceivedState,
    
    // Causal locks
    causalLocks: state.causalLocks,
    
    // Study mode
    studyMode: state.studyMode,
    
    // Notifications
    notifications: state.notifications,
    notify,
    dismissNotification,
    clearNotifications,
    
    // Connection state
    isConnected: state.isConnected,
    syncLatency: state.syncLatency,
    lastSyncTime: state.lastSyncTime,
  };
}

/**
 * Specialized hook for monitoring causal locks with countdown timer
 */
export function useCausalLockCountdown(causalLocks: CausalLockInfo[], currentTick: number) {
  const [displayLocks, setDisplayLocks] = useState<Array<{
    soulId: string;
    sessionName: string;
    remainingTicks: number;
    remainingHours: number;
    remainingMinutes: number;
    progressPercent: number;
  }>>([]);
  
  useEffect(() => {
    const locks = causalLocks.map(lock => UIPerceptionManager.formatCausalLock(
      lock.soulId,
      lock.lockExpiresTick,
      currentTick,
      '' // TODO: Get session name from soul data
    ));
    
    setDisplayLocks(locks as any);
  }, [causalLocks, currentTick]);
  
  return displayLocks;
}

/**
 * Specialized hook for monitoring Study Mode progress
 */
export function useStudyModeProgress(studyMode: any, playerHealth: number, maxHealth: number) {
  const [displayMode, setDisplayMode] = useState(studyMode);
  
  useEffect(() => {
    if (!studyMode?.isActive) {
      return;
    }
    
    const updateInterval = setInterval(() => {
      // Update display progress
      // TODO: Calculate vitals decay
    }, 500);
    
    return () => clearInterval(updateInterval);
  }, [studyMode]);
  
  return displayMode;
}
