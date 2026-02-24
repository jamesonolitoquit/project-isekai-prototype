/**
 * eventCompactionEngine.ts - M50-A2: Great Ledger Persistence
 * 
 * Event compaction system that summarizes high-frequency events while preserving
 * significant narrative events. Prevents save-file bloat while maintaining chronological
 * integrity and supporting echo generation from historical deeds.
 */

import type { Event } from '../events/mutationLog';

/** Events considered "noise" that can be compacted */
const COMPACTABLE_EVENT_TYPES = new Set([
  'TICK',
  'NPC_MOVE',
  'NPC_LOCATION_UPDATE',
  'WEATHER_TICK',
  'AUDIO_PARAM_CHANGE',
  'MUSIC_LOOP'
]);

/** Events that should ALWAYS be preserved */
const PRESERVE_EVENT_TYPES = new Set([
  'PLAYER_ACTION',
  'PLAYER_DEATH',
  'NPC_DEATH',
  'FACTION_SKIRMISH',
  'FACTION_CONFLICT_START',
  'FACTION_CONFLICT_END',
  'SOUL_ECHO_TRIGGERED',
  'LEGENDARY_DEED',
  'WORLD_EVENT',
  'MACRO_EVENT_STARTED',
  'MACRO_EVENT_ENDED',
  'QUEST_COMPLETED',
  'QUEST_FAILED'
]);

export interface EventCompactionStats {
  inputCount: number;
  outputCount: number;
  compactedCount: number;
  preservedCount: number;
  reductionRatio: number;  // % reduction: (1 - output/input) * 100
}

export interface EpochSummary {
  id: string;
  type: 'EPOCH_SUMMARY';
  startTick: number;
  endTick: number;
  eventTypeFrequency: Record<string, number>;  // e.g., { TICK: 24, NPC_MOVE: 47 }
  worldInstanceId: string;
  actorId: string;
  payload: {
    summary: string;  // Human-readable summary
    daysCovered: number;
    distinctLocations: number;
    npcMovementCount: number;
    tickCount: number;
    averageTicksPerHour: number;
  };
  timestamp: number;
}

/**
 * M50-A2: Compact event log by summarizing high-frequency events
 * Preserves all "significant" events and groups noise into summaries
 *
 * @param events - Full event log
 * @param maxNoisyEventsPerEpoch - GroupSize for creating summaries (e.g., 24 = group by day)
 * @returns Compacted event log with EpochSummary events replacing groups of noise
 */
export function compactEventLog(
  events: Event[],
  maxNoisyEventsPerEpoch: number = 24
): Event[] {
  if (!events.length) return [];

  const preserved: Event[] = [];
  let currentEpochBuffer: Event[] = [];
  let currentWorldId = '';

  for (const event of events) {
    // Start new epoch if world changes
    if (event.worldInstanceId !== currentWorldId && currentEpochBuffer.length > 0) {
      const summary = createEpochSummary(currentEpochBuffer, currentWorldId);
      if (summary) preserved.push(summary);
      currentEpochBuffer = [];
    }
    currentWorldId = event.worldInstanceId;

    // Always preserve significant events
    if (PRESERVE_EVENT_TYPES.has(event.type)) {
      // First, flush any buffered noise
      if (currentEpochBuffer.length > 0) {
        const summary = createEpochSummary(currentEpochBuffer, currentWorldId);
        if (summary) preserved.push(summary);
        currentEpochBuffer = [];
      }
      preserved.push(event);
      continue;
    }

    // Buffer compactable events
    if (COMPACTABLE_EVENT_TYPES.has(event.type)) {
      currentEpochBuffer.push(event);
      
      // Flush epoch if buffer reaches threshold
      if (currentEpochBuffer.length >= maxNoisyEventsPerEpoch) {
        const summary = createEpochSummary(currentEpochBuffer, currentWorldId);
        if (summary) preserved.push(summary);
        currentEpochBuffer = [];
      }
      continue;
    }

    // Events not in compactable or preserve lists go through as-is
    if (currentEpochBuffer.length > 0) {
      const summary = createEpochSummary(currentEpochBuffer, currentWorldId);
      if (summary) preserved.push(summary);
      currentEpochBuffer = [];
    }
    preserved.push(event);
  }

  // Flush any remaining buffered events
  if (currentEpochBuffer.length > 0) {
    const summary = createEpochSummary(currentEpochBuffer, currentWorldId);
    if (summary) preserved.push(summary);
  }

  return preserved;
}

/**
 * Create an EpochSummary event from a batch of low-importance events
 */
function createEpochSummary(events: Event[], worldInstanceId: string): EpochSummary | null {
  if (!events.length) return null;

  // Analyze event frequencies and extract metrics
  const typeFrequency: Record<string, number> = {};
  const locationsSeen = new Set<string>();
  let npcMoveCount = 0;

  for (const event of events) {
    typeFrequency[event.type] = (typeFrequency[event.type] || 0) + 1;

    if (event.type === 'NPC_MOVE' && event.payload?.toLocationId) {
      locationsSeen.add(event.payload.toLocationId);
      npcMoveCount++;
    } else if (event.type === 'TICK' && event.payload?.time?.hour !== undefined) {
      // Track hour from first TICK event (all TICKs in epoch should have same hour locally)
    }
  }

  const startEvent = events[0];
  const endEvent = events[events.length - 1];
  const startTick = startEvent.payload?.time?.tick || 0;
  const endTick = endEvent.payload?.time?.tick || startTick;
  
  const daysCovered = Math.ceil((endTick - startTick) / 24);  // Rough estimate: 24 ticks per day
  const tickCount = typeFrequency['TICK'] || 0;
  const avgTicksPerHour = tickCount > 0 ? (tickCount / (daysCovered || 1)) : 0;

  const summaryText = `[Epoch] ${daysCovered} day(s) with ${npcMoveCount} NPC movements across ${locationsSeen.size} locations. ` +
    `${tickCount} world ticks processed.`;

  return {
    id: `epoch-${worldInstanceId}-${startTick}-${endTick}`,
    type: 'EPOCH_SUMMARY',
    startTick,
    endTick,
    eventTypeFrequency: typeFrequency,
    worldInstanceId,
    actorId: 'system',
    payload: {
      summary: summaryText,
      daysCovered,
      distinctLocations: locationsSeen.size,
      npcMovementCount: npcMoveCount,
      tickCount,
      averageTicksPerHour: Math.round(avgTicksPerHour * 100) / 100
    },
    timestamp: Date.now()
  };
}

/**
 * Get compaction statistics for analysis
 */
export function getCompactionStats(original: Event[], compacted: Event[]): EventCompactionStats {
  const compactedCount = original.length - compacted.length;
  const reductionRatio = original.length > 0
    ? Math.round(((original.length - compacted.length) / original.length) * 10000) / 100
    : 0;

  return {
    inputCount: original.length,
    outputCount: compacted.length,
    compactedCount,
    preservedCount: compacted.length,
    reductionRatio
  };
}

/**
 * Identify "Grand Deeds" from event log that should generate soul echoes
 * M50-A3 integration point
 */
export function extractGrandDeeds(events: Event[]): Event[] {
  return events.filter(event => {
    // Grand deeds are significant events with important consequences
    const isSignificant = [
      'PLAYER_ACTION',
      'FACTION_SKIRMISH',
      'NPC_DEATH',
      'PLAYER_DEATH',
      'LEGENDARY_DEED',
      'WORLD_EVENT',
      'QUEST_COMPLETED'
    ].includes(event.type);

    if (!isSignificant) return false;

    // Additional constraints: player actions with major consequences
    if (event.type === 'PLAYER_ACTION') {
      return event.payload?.consequenceLevel === 'LEGENDARY' || 
             event.payload?.divergenceRating > 75;
    }

    if (event.type === 'FACTION_SKIRMISH') {
      return event.payload?.powerShift > 10;  // Significant territorial shift
    }

    return true;
  });
}

/**
 * Decompress a compacted event log by expanding summaries
 * Note: Expansion is approximate since original tick details are lost
 */
export function decompressEventLog(compactedEvents: Event[]): Event[] {
  const expanded: Event[] = [];

  for (const event of compactedEvents) {
    if (event.type === 'EPOCH_SUMMARY') {
      const summary = event as EpochSummary;
      
      // Expand EPOCH_SUMMARY back into approximate component events
      const tickCount = summary.payload.tickCount || 0;
      for (let i = 0; i < tickCount; i++) {
        expanded.push({
          id: `${summary.id}-tick-${i}`,
          worldInstanceId: summary.worldInstanceId,
          actorId: 'system',
          type: 'TICK',
          payload: { approximated: true, fromEpochSummary: summary.id },
          timestamp: summary.timestamp + (i * 1000)  // Approximate timestamps
        });
      }
      
      // Add NPC_MOVE events
      for (let i = 0; i < summary.payload.npcMovementCount; i++) {
        expanded.push({
          id: `${summary.id}-move-${i}`,
          worldInstanceId: summary.worldInstanceId,
          actorId: 'system',
          type: 'NPC_MOVE',
          payload: { approximated: true, fromEpochSummary: summary.id },
          timestamp: summary.timestamp + (i * 500)
        });
      }
    } else {
      expanded.push(event);
    }
  }

  return expanded;
}

export const EventCompactionEngineExports = {
  compactEventLog,
  getCompactionStats,
  extractGrandDeeds,
  decompressEventLog,
  COMPACTABLE_EVENT_TYPES,
  PRESERVE_EVENT_TYPES
};
