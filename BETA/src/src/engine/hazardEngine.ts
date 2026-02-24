/**
 * hazardEngine.ts - Environmental Hazard System
 * Manages location-based hazards that affect player health/status over time
 */

import type { WorldState, PlayerState } from './worldEngine';

export interface HazardCondition {
  season?: 'winter' | 'spring' | 'summer' | 'autumn';
  weather?: 'clear' | 'snow' | 'rain';
  maxDayPhase?: 'night' | 'morning' | 'afternoon' | 'evening';
}

export interface HazardEffect {
  type: 'health_drain' | 'status_apply';
  severity: 'minor' | 'moderate' | 'severe';
  chance: number; // 0-1 per 10 ticks
  damagePerTick?: number;
  statusEffect?: string;
}

export interface Hazard {
  id: string;
  name: string;
  affectedLocationId: string;
  condition: HazardCondition;
  effect: HazardEffect;
}

export interface HazardCheckResult {
  triggered: boolean;
  hazardId: string;
  hazardName: string;
  damage: number;
  statusApplied?: string;
}

/**
 * Check if conditions match for a hazard to be active
 */
function hazardConditionsMatch(hazard: Hazard, state: WorldState): boolean {
  if (hazard.condition.season && hazard.condition.season !== state.season) {
    return false;
  }
  if (hazard.condition.weather && hazard.condition.weather !== state.weather) {
    return false;
  }
  if (hazard.condition.maxDayPhase && hazard.condition.maxDayPhase !== state.dayPhase) {
    return false;
  }
  return true;
}

/**
 * Check for hazards affecting the player at their current location
 * Deterministic based on tick (ensures event-sourcing replay consistency)
 */
export function checkLocationHazards(
  state: WorldState,
  hazards: Hazard[],
  tickDivisor: number = 10
): HazardCheckResult[] {
  const results: HazardCheckResult[] = [];
  const tick = state.tick ?? 0;

  // Only check hazards every 10 ticks
  if (tick % tickDivisor !== 0) {
    return results;
  }

  for (const hazard of hazards) {
    // Check if hazard applies to current location
    if (hazard.affectedLocationId !== state.player.location) {
      continue;
    }

    // Check if conditions are met
    if (!hazardConditionsMatch(hazard, state)) {
      continue;
    }

    // Deterministic chance based on tick (same tick always produces same result)
    const rng = (tick * 17 + hazard.id.charCodeAt(0)) % 100 / 100;
    if (rng < hazard.effect.chance) {
      const damage = hazard.effect.damagePerTick || 0;
      results.push({
        triggered: true,
        hazardId: hazard.id,
        hazardName: hazard.name,
        damage,
        statusApplied: hazard.effect.statusEffect
      });
    }
  }

  return results;
}

/**
 * Apply hazard damage to player state
 */
export function applyHazardDamage(player: PlayerState, damage: number): PlayerState {
  if (damage <= 0) return player;

  const currentHp = player.hp || 100;
  const newHp = Math.max(0, currentHp - damage);

  return {
    ...player,
    hp: newHp
  };
}

/**
 * Apply status effects from hazards
 */
export function applyHazardStatus(player: PlayerState, statusEffect: string): PlayerState {
  if (!statusEffect) return player;

  const currentStatuses = player.statusEffects || [];

  // Check if status already exists
  if (!currentStatuses.includes(statusEffect)) {
    return {
      ...player,
      statusEffects: [...currentStatuses, statusEffect]
    };
  }

  return player;
}
