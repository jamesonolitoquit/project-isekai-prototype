/**
 * Phase 9: Director Orchestration Engine
 * 
 * Consolidates "Magnet Effect" NPC orchestration and Director state management.
 * Purpose: Centralized "Director" state that controls NPC density and world-pressure shifts.
 * 
 * Features:
 * - DirectorZone definitions for NPC congregation
 * - Magnet Effect orchestration (draws NPCs together during narrative pacing shifts)
 * - Pressure level management (controls world paradoxLevel based on events)
 * - Narrative momentum tracking
 */

import type { WorldState, NPC, Location, DirectorZone } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { calculateEuclideanDistance } from './mapEngine';
import { SeededRng } from './prng';

/**
 * Centralized Director orchestration state
 */
export interface DirectorOrchestrationState {
  // Narrative momentum
  narrativeMomentum: number;         // 0-100: escalates with activity, decays during inactivity
  pacingTrend: 'stagnant' | 'active' | 'escalating';
  lastEventTick: number;
  
  // Zone management
  zones: DirectorZone[];
  primaryZoneId: string;
  
  // Pressure control
  targetPressureLevel: number;       // Desired paradoxLevel (0-100)
  pressureVelocity: number;          // How fast pressure changes (-2 to +2 per tick)
  
  // Orchestration state
  activeOrchestratedNpcIds: Set<string>;
  nextOrchestrationTick: number;
}

/**
 * Initialize Director orchestration state
 */
export function initializeDirectorOrchestration(): DirectorOrchestrationState {
  return {
    narrativeMomentum: 50,
    pacingTrend: 'active',
    lastEventTick: 0,
    zones: [],
    primaryZoneId: 'director-primary-zone',
    targetPressureLevel: 0,
    pressureVelocity: 0,
    activeOrchestratedNpcIds: new Set(),
    nextOrchestrationTick: 100
  };
}

/**
 * Update Director zones based on player location
 * Creates zones around the player for NPC orchestration
 */
export function updateDirectorZones(state: WorldState, maestro: DirectorOrchestrationState): DirectorZone[] {
  // PlayerState.location is a string ID, not a locationId property
  const playerLocId = typeof state.player?.location === 'string' ? state.player.location : undefined;
  const playerLocation = playerLocId ? state.locations.find(loc => loc.id === playerLocId) : undefined;
  if (!playerLocation || playerLocation.x === undefined || playerLocation.y === undefined) {
    return maestro.zones;
  }

  // Primary zone: cluster radius around player
  const primaryZone: DirectorZone = {
    id: 'director-primary-zone',
    centerX: playerLocation.x,
    centerY: playerLocation.y,
    radius: 150,
    occupants: state.npcs
      .filter(npc => {
        const npcLoc = state.locations.find(l => l.id === npc.locationId);
        if (!npcLoc || npcLoc.x === undefined || npcLoc.y === undefined) return false;
        const dist = calculateEuclideanDistance(playerLocation.x!, playerLocation.y!, npcLoc.x, npcLoc.y);
        return dist <= 150;
      })
      .map(npc => npc.id),
    magnetLevel: maestro.narrativeMomentum / 100
  };

  // Secondary zone: expanded exploration zone
  const secondaryZone: DirectorZone = {
    id: 'director-secondary-zone',
    centerX: playerLocation.x,
    centerY: playerLocation.y,
    radius: 300,
    occupants: state.npcs
      .filter(npc => {
        const npcLoc = state.locations.find(l => l.id === npc.locationId);
        if (!npcLoc || npcLoc.x === undefined || npcLoc.y === undefined) return false;
        const dist = calculateEuclideanDistance(playerLocation.x!, playerLocation.y!, npcLoc.x, npcLoc.y);
        return dist <= 300 && dist > 150;
      })
      .map(npc => npc.id),
    magnetLevel: maestro.narrativeMomentum / 150
  };

  return [primaryZone, secondaryZone];
}

/**
 * Check NPC orchestration - the "Magnet Effect"
 * When pacing is stagnant, draws NPCs closer to create narrative opportunities
 */
export function checkNpcOrchestration(
  state: WorldState,
  maestro: DirectorOrchestrationState,
  rng: SeededRng
): Event | null {
  // Only trigger during stagnant pacing with sufficient momentum
  if (maestro.pacingTrend !== 'stagnant' || maestro.narrativeMomentum < 30) {
    return null;
  }

  // Update zones
  const zones = updateDirectorZones(state, maestro);
  const primaryZone = zones.find(z => z.id === 'director-primary-zone');

  if (!primaryZone || primaryZone.occupants.length === state.npcs.length) {
    return null; // All NPCs already in zone
  }

  // Find an NPC outside the zone
  const targetNpc = findDistantNpcForOrchestration(state, primaryZone);
  if (!targetNpc) return null;

  const npcLocation = state.locations.find(loc => loc.id === targetNpc.locationId);
  if (!npcLocation || npcLocation.x === undefined || npcLocation.y === undefined) {
    return null;
  }

  const distance = calculateEuclideanDistance(
    primaryZone.centerX,
    primaryZone.centerY,
    npcLocation.x,
    npcLocation.y
  );

  // If NPC is significantly outside zone, generate movement event
  if (distance > primaryZone.radius * 1.5) {
    maestro.lastEventTick = state.tick ?? 0;
    maestro.activeOrchestratedNpcIds.add(targetNpc.id);

    return {
      id: `director-magnet-${state.tick ?? 0}`,
      worldInstanceId: state.id,
      actorId: 'director-orchestration',
      type: 'NPC_GUIDED_MOVEMENT',
      payload: {
        npcId: targetNpc.id,
        npcName: targetNpc.name,
        from: targetNpc.locationId,
        reason: 'conductor_clustering',
        distance: Math.round(distance),
        magnetStrength: primaryZone.magnetLevel,
        targetZone: primaryZone.id
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Find an NPC outside the zone that's far enough to warrant orchestration
 */
function findDistantNpcForOrchestration(state: WorldState, zone: DirectorZone): NPC | null {
  const outsideNpcs = state.npcs.filter(npc => !zone.occupants.includes(npc.id));
  if (outsideNpcs.length === 0) return null;

  // Pick one with bias towards farther ones
  const sorted = outsideNpcs.sort((a, b) => {
    const locA = state.locations.find(l => l.id === a.locationId);
    const locB = state.locations.find(l => l.id === b.locationId);
    if (!locA || locA.x === undefined || !locB || locB.x === undefined) return 0;

    const distA = calculateEuclideanDistance(zone.centerX, zone.centerY, locA.x, locA.y);
    const distB = calculateEuclideanDistance(zone.centerX, zone.centerY, locB.x, locB.y);
    return distB - distA; // Descending
  });

  return sorted[0] ?? null;
}

/**
 * Update narrative momentum based on world events
 * Higher momentum makes Director more likely to orchestrate events
 */
export function updateNarrativeMomentum(
  maestro: DirectorOrchestrationState,
  state: WorldState,
  decayRate: number = 1
): void {
  // Decay momentum over time (towards baseline ~40)
  const baseline = 40;
  const decay = decayRate;

  if (maestro.narrativeMomentum > baseline) {
    maestro.narrativeMomentum = Math.max(baseline, maestro.narrativeMomentum - decay);
  } else if (maestro.narrativeMomentum < baseline) {
    maestro.narrativeMomentum = Math.min(baseline, maestro.narrativeMomentum + decay * 0.5);
  }

  // Update pacing trend
  const recentActivityTickWindow = 50;
  const ticksSinceLastEvent = (state.tick ?? 0) - maestro.lastEventTick;

  if (ticksSinceLastEvent > recentActivityTickWindow) {
    maestro.pacingTrend = 'stagnant';
  } else if (maestro.narrativeMomentum > 70) {
    maestro.pacingTrend = 'escalating';
  } else if (maestro.narrativeMomentum > 40) {
    maestro.pacingTrend = 'active';
  }
}

/**
 * Calculate target pressure level based on narrative state
 * Pressure levels affect visual filters and NPC behavior
 */
export function calculateTargetPressureLevel(
  maestro: DirectorOrchestrationState,
  state: WorldState
): number {
  // Base pressure from narrative momentum
  let target = (maestro.narrativeMomentum / 100) * 50;

  // Add pressure from accumulated paradoxDebt
  const paradoxDebt = state.paradoxDebt ?? 0;
  target += Math.min(50, paradoxDebt / 10);

  // Add pressure from active conflicts (FactionConflict uses 'active' property, not 'stage')
  const activeConflicts = state.factionConflicts?.filter(c => c.active)?.length ?? 0;
  target += activeConflicts * 5;

  // Clamp to 0-100
  return Math.min(100, Math.max(0, target));
}

/**
 * Apply pressure towards target level (with velocity limiting)
 */
export function applyPressureVelocity(maestro: DirectorOrchestrationState, state: WorldState): number {
  const targetPressure = calculateTargetPressureLevel(maestro, state);
  const currentPressure = state.paradoxLevel ?? 0;
  const diff = targetPressure - currentPressure;

  // Velocity limiter: 0-2 per tick towards target
  const maxVelocity = 2;
  if (diff > 0) {
    maestro.pressureVelocity = Math.min(maxVelocity, diff);
  } else if (diff < 0) {
    maestro.pressureVelocity = Math.max(-maxVelocity, diff);
  } else {
    maestro.pressureVelocity = 0;
  }

  const newPressure = currentPressure + maestro.pressureVelocity;
  return Math.min(100, Math.max(0, newPressure));
}

/**
 * Orchestrate Director effects for a tick
 */
export function orchestrateDirectorEffects(
  state: WorldState,
  maestro: DirectorOrchestrationState,
  rng: SeededRng
): Event[] {
  const events: Event[] = [];

  // Update momentum and pacing
  updateNarrativeMomentum(maestro, state);

  // Check for NPC orchestration (Magnet Effect)
  const orchestrationEvent = checkNpcOrchestration(state, maestro, rng);
  if (orchestrationEvent) {
    events.push(orchestrationEvent);
  }

  return events;
}
