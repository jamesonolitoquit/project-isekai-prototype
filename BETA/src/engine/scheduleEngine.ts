/**
 * scheduleEngine.ts - NPC Daily Routine Resolution
 * Determines NPC location based on time of day and predefined routine.
 * Routines are structured as:
 *   { "6-12": "location-a", "12-18": "location-b", "18-24": "location-c", "0-6": "home" }
 */

export interface NpcRoutine {
  [timeRange: string]: string; // "6-12" → "location-id"
}

export interface ScheduleResult {
  currentLocationId: string;
  nextTransitionHour?: number;
}

/**
 * Resolve the current location of an NPC based on their action plan or routine and current hour
 */
export function resolveNpcLocation(npc: any, hour: number): ScheduleResult {
  // M49-A3: Check for active action plan first
  if (npc.currentActionPlan && npc.currentActionPlan.actions && npc.currentActionPlan.currentActionIndex !== undefined) {
    const currentAction = npc.currentActionPlan.actions[npc.currentActionPlan.currentActionIndex];
    if (currentAction && currentAction.targetLocationId) {
      return {
        currentLocationId: currentAction.targetLocationId,
        nextTransitionHour: undefined
      };
    }
  }

  const routine: NpcRoutine | undefined = npc.routine;

  if (!routine || typeof routine !== 'object') {
    // No routine defined; use static locationId
    return {
      currentLocationId: npc.locationId || 'unknown',
      nextTransitionHour: undefined
    };
  }

  // Find the matching time range for current hour
  let currentLocation = npc.locationId; // fallback to default
  let nextTransition: number | undefined;

  for (const [timeRange, locationId] of Object.entries(routine)) {
    const [startStr, endStr] = timeRange.split('-').map(s => parseInt(s, 10));
    if (isNaN(startStr) || isNaN(endStr)) continue;

    const start = startStr;
    const end = endStr;

    // Handle wrap-around (e.g., 22-6 crosses midnight)
    let isInRange = false;
    if (start < end) {
      isInRange = hour >= start && hour < end;
      if (isInRange && !nextTransition) {
        nextTransition = end;
      }
    } else {
      // Wrap-around case
      isInRange = hour >= start || hour < end;
      if (isInRange && !nextTransition) {
        nextTransition = start < hour ? start + 24 : start;
      }
    }

    if (isInRange) {
      currentLocation = locationId as string;
      break;
    }
  }

  return {
    currentLocationId: currentLocation,
    nextTransitionHour: nextTransition
  };
}

/**
 * Update all NPCs' locations based on their routines and current hour
 */
export function updateNpcLocations(npcs: any[], hour: number): { [npcId: string]: string } {
  const updates: { [npcId: string]: string } = {};

  for (const npc of npcs) {
    const result = resolveNpcLocation(npc, hour);
    if (result.currentLocationId !== npc.locationId) {
      updates[npc.id] = result.currentLocationId;
    }
  }

  return updates;
}

/**
 * Apply location updates to NPC array
 */
export function applyLocationUpdates(npcs: any[], updates: { [npcId: string]: string }): any[] {
  return npcs.map(npc => {
    if (updates[npc.id]) {
      return { ...npc, locationId: updates[npc.id] };
    }
    return npc;
  });
}
