/**
 * M66: Catastrophe Manager
 * 
 * Manages world-ending events and deterministic region destruction triggered by:
 * - Paradox Level accumulation (0-500 scale)
 * - Age-Rot progression
 * - Critical narrative divergences
 * 
 * Catastrophes cascade through regions via spatial interest groups (M64 SIGs).
 * All events recorded in M62-CHRONOS ledger for deterministic replay.
 * 
 * Atmosphere state linked to visual distortion (greyscale→glitch→void).
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Catastrophe System
// ============================================================================

/**
 * Catastrophe severity levels
 */
export type CatastropheType =
  | 'void_bleed'      // Spatial anomaly, void spreading
  | 'fracture'        // Ground breaks, geography warps
  | 'temporal_rupture' // Time loops, causality breaks
  | 'aspect_collapse' // Narrative reality collapses
  | 'silence'         // All sound/communication lost
  | 'erasure'         // Locations erased from existence;

/**
 * Catastrophic event definition
 */
export interface CatastrophicEvent {
  readonly eventId: string;
  readonly type: CatastropheType;
  readonly triggeredAt: number; // Timestamp
  readonly paradoxThreshold: number; // Min paradox level to trigger (0-500)
  readonly severity: number; // 0-100
  readonly affectedRegionIds: Set<string>;
  readonly cascadeDepth: number; // How many regions to cascade to
  readonly isIrreversible: boolean; // Can this be stopped?
  readonly ledgerCheckpointId?: string; // M62-CHRONOS checkpoint
  readonly description: string;
}

/**
 * Region blight state
 */
export interface BlightedRegion {
  readonly regionId: string;
  readonly blightType: CatastropheType;
  readonly blightedAt: number;
  readonly severity: number; // 0-100, affects visual intensity
  readonly isInhabitable: boolean; // NPCs flee if true
  readonly affectedLocations: string[]; // Location IDs
  readonly reversible: boolean; // Can be cleansed?
}

/**
 * World instability metrics
 */
export interface WorldInstability {
  readonly paradoxLevel: number; // 0-500
  readonly ageRot: number; // 0-100 (independent clock)
  readonly catastropheCount: number; // Total catastrophes triggered
  readonly averageSeverity: number; // Mean severity of past events
  readonly atrophy: number; // 0-100, regions deteriorating
}

/**
 * Atmosphere state for visual rendering
 */
export interface AtmosphereState {
  readonly distortion: number; // 0-100, glitch/greyscale intensity
  readonly saturation: number; // 100 (normal) → 0 (greyscale)
  readonly glitchIntensity: number; // 0-100, visual artifacts
  readonly voidPresence: number; // 0-100, void aesthetic (black/purple)
  readonly soundIntensity: number; // 100 (normal) → 0 (silence)
}

/**
 * Catastrophe cascade status
 */
export interface CascadeStatus {
  readonly cascadeId: string;
  readonly originRegionId: string;
  readonly startedAt: number;
  readonly affected: Set<string>; // Region IDs affected so far
  readonly isActive: boolean;
  readonly remainingDepth: number;
}

// ============================================================================
// CATASTROPHE MANAGER: Core Operations
// ============================================================================

let activeCatastrophes = new Map<string, CatastrophicEvent>();
let activeBlights = new Map<string, BlightedRegion>();
let activeCascades = new Map<string, CascadeStatus>();
let currentWorldInstability: WorldInstability = {
  paradoxLevel: 0,
  ageRot: 0,
  catastropheCount: 0,
  averageSeverity: 0,
  atrophy: 0
};

/**
 * Update world instability metrics
 * 
 * @param paradoxDelta Change in paradox level
 * @param ageRotDelta Change in age rot
 * @returns Updated instability state
 */
export function updateInstability(
  paradoxDelta: number,
  ageRotDelta: number
): WorldInstability {
  const newParadox = Math.max(0, Math.min(500, currentWorldInstability.paradoxLevel + paradoxDelta));
  const newAgeRot = Math.max(0, Math.min(100, currentWorldInstability.ageRot + ageRotDelta));
  const newAtrophy = Math.max(0, Math.min(100, (newParadox / 5) + (newAgeRot / 2)));

  const updated: WorldInstability = {
    paradoxLevel: newParadox,
    ageRot: newAgeRot,
    catastropheCount: currentWorldInstability.catastropheCount,
    averageSeverity: currentWorldInstability.averageSeverity,
    atrophy: newAtrophy
  };

  currentWorldInstability = updated;
  return updated;
}

/**
 * Get current instability
 * 
 * @returns Current metrics
 */
export function getInstability(): WorldInstability {
  return { ...currentWorldInstability };
}

/**
 * Calculate atmosphere state based on catastrophe severity
 * 
 * @returns Atmosphere for rendering
 */
export function calculateAtmosphereState(): AtmosphereState {
  const instability = getInstability();

  // Distortion scales with paradox level
  const distortion = Math.min(100, (instability.paradoxLevel / 500) * 100);

  // Saturation fades as catastrophes accumulate
  const saturation = Math.max(0, 100 - distortion);

  // Glitch intensity spikes at critical thresholds
  const glitchIntensity =
    instability.paradoxLevel > 300 ? 80 : instability.paradoxLevel > 200 ? 40 : 0;

  // Void presence at apocalyptic levels
  const voidPresence = Math.max(0, (instability.paradoxLevel - 300) / 200 * 100);

  // Sound fades at extreme distortion
  const soundIntensity = Math.max(0, 100 - glitchIntensity - (voidPresence / 2));

  return {
    distortion,
    saturation,
    glitchIntensity,
    voidPresence,
    soundIntensity
  };
}

/**
 * Trigger a catastrophic event
 * 
 * @param type Event type
 * @param severity Severity (0-100)
 * @param originRegionId Starting region
 * @param cascadeDepth How many regions to affect
 * @returns Triggered event
 */
export function triggerCatastrophe(
  type: CatastropheType,
  severity: number,
  originRegionId: string,
  cascadeDepth: number = 3
): CatastrophicEvent {
  const eventId = `catastrophe_${uuid()}`;
  const paradoxThreshold = calculateParadoxThreshold(type);

  const event: CatastrophicEvent = {
    eventId,
    type,
    triggeredAt: Date.now(),
    paradoxThreshold,
    severity: Math.max(0, Math.min(100, severity)),
    affectedRegionIds: new Set([originRegionId]),
    cascadeDepth,
    isIrreversible: severity > 70,
    description: `${type.toUpperCase()} catastrophe at severity ${severity}`
  };

  activeCatastrophes.set(eventId, event);

  // Update catastrophe count and average severity
  const totalSeverity = Array.from(activeCatastrophes.values()).reduce(
    (sum, cat) => sum + cat.severity,
    0
  );
  const avgSeverity = totalSeverity / activeCatastrophes.size;

  // Reconstruct with updated values
  const updatedInstability: WorldInstability = {
    paradoxLevel: currentWorldInstability.paradoxLevel,
    ageRot: currentWorldInstability.ageRot,
    catastropheCount: currentWorldInstability.catastropheCount + 1,
    averageSeverity: avgSeverity,
    atrophy: currentWorldInstability.atrophy
  };

  currentWorldInstability = updatedInstability;

  // Start cascade
  cascadeCatastrophe(event, originRegionId, cascadeDepth);

  return event;
}

/**
 * Calculate paradox threshold for event type
 * 
 * @param type Event type
 * @returns Minimum paradox level to trigger
 */
function calculateParadoxThreshold(type: CatastropheType): number {
  const thresholds: Record<CatastropheType, number> = {
    void_bleed: 250,
    fracture: 200,
    temporal_rupture: 300,
    aspect_collapse: 350,
    silence: 200,
    erasure: 400
  };
  return thresholds[type] || 250;
}

/**
 * Cascade catastrophe through adjacent regions
 * 
 * @param event Catastrophic event
 * @param currentRegionId Current region
 * @param remainingDepth Remaining cascade depth
 */
function cascadeCatastrophe(
  event: CatastrophicEvent,
  currentRegionId: string,
  remainingDepth: number
): void {
  if (remainingDepth === 0) return;

  const cascadeId = `cascade_${uuid()}`;
  const cascade: CascadeStatus = {
    cascadeId,
    originRegionId: Array.from(event.affectedRegionIds)[0],
    startedAt: Date.now(),
    affected: new Set(event.affectedRegionIds),
    isActive: true,
    remainingDepth
  };

  activeCascades.set(cascadeId, cascade);

  // Blight current region
  blightRegion(currentRegionId, event.type, event.severity);

  // Cascading logic: next regions affected with reduced severity
  // In real implementation, would query spatial graph for adjacent regions
  const adjacentRegions = getAdjacentRegions(currentRegionId);
  for (const adjacentId of adjacentRegions) {
    if (!cascade.affected.has(adjacentId)) {
      cascade.affected.add(adjacentId);
      event.affectedRegionIds.add(adjacentId);

      // Reduced severity for cascade
      const cascadeSeverity = Math.max(10, event.severity - 20);
      cascadeCatastrophe(event, adjacentId, remainingDepth - 1);
    }
  }
}

/**
 * Blight a region (deterministic, recorded in ledger)
 * 
 * @param regionId Region to blight
 * @param blightType Type of blight
 * @param severity Blight severity (0-100)
 * @param worldInstanceId World instance for ledger
 */
export function blightRegion(
  regionId: string,
  blightType: CatastropheType,
  severity: number,
  worldInstanceId: string = 'WORLD_M66_DEFAULT'
): BlightedRegion | null {
  if (activeBlights.has(regionId)) {
    return activeBlights.get(regionId) || null;
  }

  const blightedAt = Date.now();
  const finalSeverity = Math.max(0, Math.min(100, severity));
  const blight: BlightedRegion = {
    regionId,
    blightType,
    blightedAt,
    severity: finalSeverity,
    isInhabitable: finalSeverity > 60,
    affectedLocations: [],
    reversible: finalSeverity < 50
  };

  activeBlights.set(regionId, blight);

  // Record in ledger for deterministic replay
  appendEvent({
    id: `event_${uuid()}`,
    worldInstanceId,
    actorId: 'SYSTEM_CATASTROPHE',
    type: 'region_blighted',
    payload: {
      regionId,
      blightType,
      severity: finalSeverity,
      isInhabitable: blight.isInhabitable,
      reversible: blight.reversible
    },
    timestamp: blightedAt,
    mutationClass: 'STATE_CHANGE'
  });

  return blight;
}

/**
 * Get adjacent regions (in real system, queries spatial graph)
 * 
 * @param regionId Current region
 * @returns Adjacent region IDs
 */
function getAdjacentRegions(regionId: string): string[] {
  // Stub: In production, would query spatial interest groups from M64
  // For now, return empty array - cascade stops
  return [];
}

/**
 * Check if paradox level exceeds critical thresholds
 * 
 * @returns Threshold exceeded and recommended event
 */
export function checkCatastropheThresholds(): {
  thresholdExceeded: boolean;
  recommendedEvent: CatastropheType | null;
  currentParadox: number;
} {
  const instability = getInstability();

  if (instability.paradoxLevel > 400) {
    return {
      thresholdExceeded: true,
      recommendedEvent: 'erasure',
      currentParadox: instability.paradoxLevel
    };
  }

  if (instability.paradoxLevel > 350) {
    return {
      thresholdExceeded: true,
      recommendedEvent: 'aspect_collapse',
      currentParadox: instability.paradoxLevel
    };
  }

  if (instability.paradoxLevel > 300) {
    return {
      thresholdExceeded: true,
      recommendedEvent: 'temporal_rupture',
      currentParadox: instability.paradoxLevel
    };
  }

  if (instability.paradoxLevel > 250) {
    return {
      thresholdExceeded: true,
      recommendedEvent: 'void_bleed',
      currentParadox: instability.paradoxLevel
    };
  }

  return {
    thresholdExceeded: false,
    recommendedEvent: null,
    currentParadox: instability.paradoxLevel
  };
}

/**
 * Get all blighted regions
 * 
 * @returns Map of blighted regions
 */
export function getAllBlights(): Map<string, BlightedRegion> {
  return new Map(activeBlights);
}

/**
 * Get all active catastrophes
 * 
 * @returns Map of catastrophes
 */
export function getAllCatastrophes(): Map<string, CatastrophicEvent> {
  return new Map(activeCatastrophes);
}

/**
 * Get blighted region
 * 
 * @param regionId Region to check
 * @returns Blight info or null
 */
export function getBlightStatus(regionId: string): BlightedRegion | null {
  return activeBlights.get(regionId) || null;
}

/**
 * Attempt to cleanse a blighted region
 * Uses accumulated "Restoration" points
 * 
 * @param regionId Region to cleanse
 * @param restorationPoints Points spent
 * @param worldInstanceId World instance for ledger
 * @returns Success and new severity
 */
export function cleanseRegion(
  regionId: string,
  restorationPoints: number,
  worldInstanceId: string = 'WORLD_M66_DEFAULT'
): { success: boolean; newSeverity: number } {
  const blight = activeBlights.get(regionId);
  if (!blight || !blight.reversible) {
    return { success: false, newSeverity: blight?.severity || 0 };
  }

  const reduction = Math.min(blight.severity, restorationPoints / 10);
  const newSeverity = Math.max(0, blight.severity - reduction);
  const cleansedAt = Date.now();

  if (newSeverity === 0) {
    // Fully cleansed
    activeBlights.delete(regionId);
  } else {
    // Partially cleansed - create new blight with updated values
    const updatedBlight: BlightedRegion = {
      regionId: blight.regionId,
      blightType: blight.blightType,
      blightedAt: blight.blightedAt,
      severity: newSeverity,
      isInhabitable: newSeverity > 60,
      affectedLocations: blight.affectedLocations,
      reversible: blight.reversible
    };
    activeBlights.set(regionId, updatedBlight);
  }

  // Record cleansing in ledger for deterministic replay
  appendEvent({
    id: `event_${uuid()}`,
    worldInstanceId,
    actorId: 'SYSTEM_RESTORATION',
    type: 'region_cleansed',
    payload: {
      regionId,
      previousSeverity: blight.severity,
      newSeverity,
      restorationPointsSpent: restorationPoints,
      fullyCleansed: newSeverity === 0
    },
    timestamp: cleansedAt,
    mutationClass: 'STATE_CHANGE'
  });

  return { success: true, newSeverity };
}

/**
 * Get catastrophe statistics
 * 
 * @returns Summary statistics
 */
export function getCatastropheStatistics(): {
  totalCatastrophes: number;
  blightedRegions: number;
  averageSeverity: number;
  astmosphereDistortion: number;
} {
  const atmosphere = calculateAtmosphereState();

  return {
    totalCatastrophes: activeCatastrophes.size,
    blightedRegions: activeBlights.size,
    averageSeverity: currentWorldInstability.averageSeverity,
    astmosphereDistortion: atmosphere.distortion
  };
}

/**
 * Reset catastrophe state (for testing/new world)
 */
export function resetCatastropheState(): void {
  activeCatastrophes.clear();
  activeBlights.clear();
  activeCascades.clear();
  currentWorldInstability = {
    paradoxLevel: 0,
    ageRot: 0,
    catastropheCount: 0,
    averageSeverity: 0,
    atrophy: 0
  };
}

/**
 * Export catastrophe state for ledger recording
 * 
 * @returns Serializable state snapshot
 */
export function exportCatastropheState(): {
  instability: WorldInstability;
  catastrophes: CatastrophicEvent[];
  blights: BlightedRegion[];
} {
  return {
    instability: currentWorldInstability,
    catastrophes: Array.from(activeCatastrophes.values()),
    blights: Array.from(activeBlights.values())
  };
}
