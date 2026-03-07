/**
 * Event Bus Sync Hook (Phase 8 - EventBus Direct Integration)
 * 
 * Lightweight hook for React components to subscribe directly to EventBus
 * and stay synchronized with engine tick updates.
 * 
 * This is a lower-level hook compared to useEngineIntegration.
 * Use this for components that need raw event data.
 * Use useEngineIntegration for components that need filtered, perceived state.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { EventBus, WorldUpdateEvent } from '../../engine/EventBus';

/**
 * Raw event subscription with filter
 */
export interface EventFilter {
  mutationTypes?: string[];
  playerOnly?: boolean;
  includingSnapshots?: boolean;
}

/**
 * useEventBusSync Hook
 * 
 * Direct subscription to EventBus with minimal overhead.
 * 
 * Usage:
 *   const { event, tick } = useEventBusSync(eventBus, {
 *     mutationTypes: ['vessel_death', 'faction_shift']
 *   });
 */
export function useEventBusSync(
  eventBus: EventBus | null | undefined,
  filter?: EventFilter,
  onEvent?: (event: WorldUpdateEvent) => void
) {
  const [lastEvent, setLastEvent] = useState<WorldUpdateEvent | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const subscriptionRef = useRef<(() => void) | null>(null);
  
  // Memoized event handler for consistency
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    setLastEvent(event);
    setTickCount(prev => prev + 1);
    onEvent?.(event);
  }, [onEvent]);
  
  // Subscribe on mount
  useEffect(() => {
    if (!eventBus) {
      return;
    }
    
    // Subscribe with filter
    const unsubscribe = eventBus.subscribe(handleEvent, filter as any);
    subscriptionRef.current = unsubscribe;
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      subscriptionRef.current = null;
    };
  }, [eventBus, filter, handleEvent]);
  
  return {
    event: lastEvent,
    tick: lastEvent?.tick ?? 0,
    epoch: lastEvent?.epochNumber ?? 0,
    mutations: lastEvent?.mutations ?? [],
    causalLocks: lastEvent?.causalLocks ?? [],
    eventCount: tickCount,
  };
}

/**
 * Hook to track specific mutation types
 */
export function useMutationTracker(
  eventBus: EventBus | null,
  mutationTypes: string[]
) {
  const [lastMutations, setLastMutations] = useState<any[]>([]);
  const [mutationCounts, setMutationCounts] = useState<Record<string, number>>({});
  const countRef = useRef<Record<string, number>>({});
  
  // Initialize counts
  useEffect(() => {
    const counts: Record<string, number> = {};
    mutationTypes.forEach(type => {
      counts[type] = 0;
    });
    countRef.current = counts;
  }, [mutationTypes]);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    const relevantMutations = event.mutations.filter(m =>
      mutationTypes.includes(m.type)
    );
    
    if (relevantMutations.length > 0) {
      setLastMutations(relevantMutations);
      
      // Update counts
      relevantMutations.forEach(m => {
        countRef.current[m.type] = (countRef.current[m.type] || 0) + 1;
      });
      
      setMutationCounts({ ...countRef.current });
    }
  }, [mutationTypes]);
  
  useEventBusSync(eventBus, { mutationTypes }, handleEvent);
  
  return {
    lastMutations,
    counts: mutationCounts,
    hasOccurred: (mutationType: string) => (countRef.current[mutationType] ?? 0) > 0,
  };
}

/**
 * Hook to monitor causal locks in real-time
 */
export function useCausalLockMonitor(
  eventBus: EventBus | null,
  onLockExpired?: (soulId: string) => void
) {
  const [activeLocks, setActiveLocks] = useState<any[]>([]);
  const [expiredLocks, setExpiredLocks] = useState<string[]>([]);
  const prevLocksRef = useRef<string[]>([]);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    if (event.causalLocks && event.causalLocks.length > 0) {
      setActiveLocks(event.causalLocks);
      
      // Detect expired locks
      const currentSoulIds = event.causalLocks.map(l => l.soulId);
      const newlyExpired = prevLocksRef.current.filter(id => !currentSoulIds.includes(id));
      
      if (newlyExpired.length > 0) {
        setExpiredLocks(newlyExpired);
        newlyExpired.forEach(soulId => onLockExpired?.(soulId));
      }
      
      prevLocksRef.current = currentSoulIds;
    }
  }, [onLockExpired]);
  
  useEventBusSync(eventBus, { playerOnly: true }, handleEvent);
  
  return {
    activeLocks,
    expiredLocks,
    lockCount: activeLocks.length,
    hasActiveLocks: activeLocks.length > 0,
  };
}

/**
 * Hook to monitor Echo Points in real-time
 */
export function useEchoPointMonitor(eventBus: EventBus | null) {
  const [echoPoints, setEchoPoints] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    if (event.echoPoints && event.echoPoints.length > 0) {
      setEchoPoints(event.echoPoints);
      
      // Calculate total
      const total = event.echoPoints.reduce((sum, ep) => sum + ep.totalPoints, 0);
      setTotalPoints(total);
    }
  }, []);
  
  useEventBusSync(eventBus, { playerOnly: true }, handleEvent);
  
  return {
    echoPoints,
    totalPoints,
    bySkill: echoPoints.reduce((acc, ep) => ({
      ...acc,
      ...ep.bySkill,
    }), {}),
  };
}

/**
 * Hook to monitor epoch transitions
 */
export function useEpochMonitor(
  eventBus: EventBus | null,
  onEpochChange?: (oldEpoch: number, newEpoch: number) => void
) {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [epochHistory, setEpochHistory] = useState<number[]>([0]);
  const prevEpochRef = useRef(0);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    if (event.epochNumber !== prevEpochRef.current) {
      const oldEpoch = prevEpochRef.current;
      prevEpochRef.current = event.epochNumber;
      
      setCurrentEpoch(event.epochNumber);
      setEpochHistory(prev => [...prev, event.epochNumber]);
      
      onEpochChange?.(oldEpoch, event.epochNumber);
    }
  }, [onEpochChange]);
  
  useEventBusSync(eventBus, undefined, handleEvent);
  
  return {
    currentEpoch,
    previousEpoch: (epochHistory.length > 1 ? epochHistory[epochHistory.length - 2] : 0),
    epochHistory,
    epochCount: epochHistory.length,
  };
}

// Helper to track history length
function useEpochMonitor_helper() {
  const [epochHistory, setEpochHistory] = useState<number[]>([]);
  return epochHistory.length;
}

/**
 * Hook for Study Mode monitoring
 */
export function useStudyModeMonitor(
  eventBus: EventBus | null
) {
  const [isInStudyMode, setIsInStudyMode] = useState(false);
  const [studyStartTick, setStudyStartTick] = useState(0);
  const [studyTargetTick, setStudyTargetTick] = useState(0);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    if (event.uiEvents) {
      const studyEvent = event.uiEvents.find(e =>
        e.type === 'study_mode_entered' || e.type === 'study_mode_exited'
      );
      
      if (studyEvent?.type === 'study_mode_entered') {
        setIsInStudyMode(true);
        setStudyStartTick(event.tick);
        setStudyTargetTick(event.tick + 10080); // Default 7 days
      } else if (studyEvent?.type === 'study_mode_exited') {
        setIsInStudyMode(false);
      }
    }
  }, []);
  
  useEventBusSync(eventBus, undefined, handleEvent);
  
  return {
    isInStudyMode,
    startTick: studyStartTick,
    targetTick: studyTargetTick,
    estimatedDuration: (studyTargetTick - studyStartTick) / 2400, // hours
  };
}

/**
 * Hook for state hash verification
 * Useful for detecting desync between client and server
 */
export function useStateHashMonitor(eventBus: EventBus | null) {
  const [lastStateHash, setLastStateHash] = useState('');
  const [hashHistory, setHashHistory] = useState<string[]>([]);
  const [isConsistent, setIsConsistent] = useState(true);
  const lastHashRef = useRef('');
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    const hash = event.stateHash.hash;
    setLastStateHash(hash);
    
    // Check for consistency (hash should change only when mutations occur)
    if (event.mutations.length === 0 && hash !== lastHashRef.current) {
      console.warn('[useStateHashMonitor] State changed without mutations!');
      setIsConsistent(false);
    }
    
    lastHashRef.current = hash;
    setHashHistory(prev => [...prev.slice(-99), hash]); // Keep last 100
  }, []);
  
  useEventBusSync(eventBus, undefined, handleEvent);
  
  return {
    lastStateHash,
    hashHistory,
    isConsistent,
    hasChanged: (prevHash: string) => prevHash !== lastStateHash,
  };
}

/**
 * Hook for fps/tick rate monitoring
 * Useful for detecting performance issues
 */
export function useTickRateMonitor(eventBus: EventBus | null) {
  const [tickRate, setTickRate] = useState(0); // ticks per second
  const [averageLatency, setAverageLatency] = useState(0); // ms between ticks
  const tickTimesRef = useRef<number[]>([]);
  
  const handleEvent = useCallback((event: WorldUpdateEvent) => {
    const now = Date.now();
    tickTimesRef.current.push(now);
    
    // Keep only last 60 ticks
    if (tickTimesRef.current.length > 60) {
      tickTimesRef.current.shift();
    }
    
    // Calculate tick rate (ticks per second)
    if (tickTimesRef.current.length > 1) {
      const timeSpan = (now - tickTimesRef.current[0]) / 1000; // seconds
      const tickCount = tickTimesRef.current.length - 1;
      const rate = tickCount / timeSpan;
      setTickRate(Math.round(rate * 100) / 100);
      
      // Calculate average latency
      let totalLatency = 0;
      for (let i = 1; i < tickTimesRef.current.length; i++) {
        totalLatency += tickTimesRef.current[i] - tickTimesRef.current[i - 1];
      }
      const avgLatency = totalLatency / (tickTimesRef.current.length - 1);
      setAverageLatency(Math.round(avgLatency * 10) / 10);
    }
  }, []);
  
  useEventBusSync(eventBus, undefined, handleEvent);
  
  return {
    tickRate,           // ticks/sec, ideally ~0.67 (1 tick every 1.5s)
    averageLatency,     // ms between ticks, ideally ~1500ms
    isHealthy: tickRate > 0.6 && tickRate < 0.8,
  };
}
