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

/**
 * Phase 17: Check for possession-triggered hazards
 * Scans player inventory for items with high paradoxScale
 * Triggers environmental effects (Void Surge, Reality Flicker) if threshold exceeded
 */
export function checkPossessionHazards(
  state: WorldState,
  player: PlayerState,
  paradoxThreshold: number = 0.5
): HazardCheckResult[] {
  const results: HazardCheckResult[] = [];

  if (!player.inventory || player.inventory.length === 0) {
    return results;
  }

  // Sum paradoxScale from all items in inventory
  let totalParadox = 0;
  const itemTemplates = (state as any).itemTemplates || [];

  for (const invItem of player.inventory) {
    const itemId = (invItem as any).itemId || (invItem as any).id;
    const template = itemTemplates.find((it: any) => it.id === itemId);
    
    if (template?.stats?.paradoxScale) {
      totalParadox += template.stats.paradoxScale;
    }
  }

  // Phase 17: Check for soul echo resistance that reduces paradox sensitivity
  let effectiveThreshold = paradoxThreshold;
  const unlockedEchoes = (state as any).unlockedSoulEchoes || [];
  
  // Soul echoes that reduce possession hazard threshold (increase resistance)
  const hazardResistanceEchoes = unlockedEchoes.filter((echo: any) => 
    echo.id?.includes('void_affinity') || 
    echo.id?.includes('paradox_resistance') ||
    echo.mechanicalEffect?.includes('Reduces') && echo.mechanicalEffect?.includes('Paradox')
  );
  
  // Each hazard resistance echo reduces the effective threshold by 25%
  if (hazardResistanceEchoes.length > 0) {
    effectiveThreshold = paradoxThreshold * Math.pow(0.75, hazardResistanceEchoes.length);
  }

  // If total paradox exceeds effective threshold, trigger possession hazard
  if (totalParadox > effectiveThreshold) {
    const tick = state.tick ?? 0;
    
    // Determine hazard intensity based on how far over threshold
    const intensity = totalParadox > 1.5 ? 'severe' : totalParadox > 1.0 ? 'moderate' : 'minor';
    const hazardType = totalParadox > 1.5 ? 'void_surge' : 'reality_flicker';
    const damage = intensity === 'severe' ? 25 : intensity === 'moderate' ? 15 : 5;
    const statusEffect = intensity === 'severe' ? 'mana_burn' : 'paradox_weakness';

    // Deterministic chance based on tick
    const rng = (tick * 19 + totalParadox * 100) % 100 / 100;
    const triggerChance = 0.3; // 30% chance each tick if over threshold

    if (rng < triggerChance) {
      results.push({
        triggered: true,
        hazardId: `possession_${hazardType}`,
        hazardName: hazardType === 'void_surge' ? 'Void Surge' : 'Reality Flicker',
        damage,
        statusApplied: statusEffect
      });
    }
  }

  return results;
}
