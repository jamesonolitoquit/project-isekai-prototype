/**
 * M64: Real-Time Dynamic Difficulty Scaling (RTDS)
 * 
 * Adjusts boss difficulty, abilities, and mechanics in real-time based on:
 * - Current active (non-dead) player count
 * - Average player myth rank
 * - Current phase and enrage status
 * - Participation score and DPS metrics
 * 
 * Thresholds:
 * - 16 players: Normal difficulty
 * - 32 players: Add mechanic threshold (split phases)
 * - 64 players: Reality-warping abilities
 * - 100+ players: Catastrophic enrage finale
 */

import type { RaidInstance, BossState } from './m64InstanceManager';
import { appendEvent } from '../events/mutationLog';

// ============================================================================
// TYPES: RTDS Configuration & Scaling
// ============================================================================

/**
 * RTDS Config per boss (tuned for 4+ mythic encounters)
 */
export interface RTDSConfig {
  readonly baseHealthPerPlayer: number;
  readonly baseArmorPerPlayer: number;
  readonly baseDpsPerPlayer: number;
  readonly scaleFactors: {
    readonly at16Players: number;
    readonly at32Players: number;
    readonly at64Players: number;
    readonly at100Plus: number;
  };
  readonly mechanicThresholds: {
    readonly addPhase: number; // Triggers at player count
    readonly realityWarping: number;
    readonly catastrophicEnrage: number;
  };
  readonly healthRegenerationPerTick: number;
  readonly enrageThresholdMs: number; // Time until enrage
}

/**
 * Boss ability definition (triggered by thresholds)
 */
export interface BossAbility {
  readonly abilityId: string;
  readonly name: string;
  readonly triggerThreshold: number; // Player count
  readonly triggerPhase: number;
  readonly duration: number;
  readonly cooldownTicks: number;
  readonly description: string;
  readonly affectedPlayerPercentage: number; // 0-100
}

/**
 * Participation metrics for contribution tracking
 */
export interface ParticipationMetrics {
  readonly playerId: string;
  readonly damageDealt: number;
  readonly healingProvided: number;
  readonly mechanicsAvoided: number;
  readonly uptime: number; // Time alive / total time
  readonly mythRank: number;
}

/**
 * Difficulty adjustment info (applied per tick)
 */
export interface DifficultyAdjustment {
  readonly tickNumber: number;
  readonly activePlayerCount: number;
  readonly adjustedHealthPercentage: number;
  readonly adjustedArmorPercentage: number;
  readonly newMechanicsTriggered: string[];
  readonly scaleFactor: number;
}

// ============================================================================
// RTDS ENGINE: Real-Time Scaling Logic
// ============================================================================

const DEFAULT_RTDS_CONFIG: RTDSConfig = {
  baseHealthPerPlayer: 1000,
  baseArmorPerPlayer: 10,
  baseDpsPerPlayer: 150,
  scaleFactors: {
    at16Players: 1.0,
    at32Players: 1.15,
    at64Players: 1.35,
    at100Plus: 1.55
  },
  mechanicThresholds: {
    addPhase: 32,
    realityWarping: 64,
    catastrophicEnrage: 100
  },
  healthRegenerationPerTick: 500,
  enrageThresholdMs: 600000 // 10 minutes
};

let adjustmentHistory: DifficultyAdjustment[] = [];

/**
 * Calculate scale factor based on active player count
 * 
 * @param activeCount Non-dead players in raid
 * @param config RTDS config
 * @returns Scale multiplier (1.0 = baseline 16 players)
 */
export function calculateScaleFactor(
  activeCount: number,
  config: RTDSConfig = DEFAULT_RTDS_CONFIG
): number {
  if (activeCount <= 16) return config.scaleFactors.at16Players;
  if (activeCount <= 32) return config.scaleFactors.at32Players;
  if (activeCount <= 64) return config.scaleFactors.at64Players;
  return config.scaleFactors.at100Plus;
}

/**
 * Apply RTDS scaling to a boss during tick processing
 * Adjusts HP, armor, and triggers new mechanics
 * 
 * @param boss Boss to scale
 * @param activePlayerCount Active (alive) players
 * @param instance Raid instance for context
 * @param config RTDS scaling config
 * @param tickNumber Current tick for tracking
 */
export function processBossTick(
  boss: BossState,
  activePlayerCount: number,
  instance: RaidInstance,
  config: RTDSConfig = DEFAULT_RTDS_CONFIG,
  tickNumber: number = 0
): { adjustedBoss: BossState; adjustment: DifficultyAdjustment } {
  const scaleFactor = calculateScaleFactor(activePlayerCount, config);

  // Calculate target health and armor
  const targetHealth = config.baseHealthPerPlayer * activePlayerCount * scaleFactor;
  const targetArmor = config.baseArmorPerPlayer * activePlayerCount * scaleFactor;

  // Smoothly adjust toward target (don't spike instantly)
  const healthAdjust = targetHealth * 0.02; // 2% per tick convergence
  const armorAdjust = targetArmor * 0.02;

  // New mechanics trigger at thresholds
  const newMechanics: string[] = [];

  if (activePlayerCount >= config.mechanicThresholds.addPhase &&
      !boss.activeMechanics.includes('add_phase')) {
    newMechanics.push('add_phase');
  }

  if (activePlayerCount >= config.mechanicThresholds.realityWarping &&
      !boss.activeMechanics.includes('reality_warp')) {
    newMechanics.push('reality_warp');
  }

  if (activePlayerCount >= config.mechanicThresholds.catastrophicEnrage &&
      !boss.enraged) {
    newMechanics.push('catastrophic_enrage');
  }

  // Apply regeneration (health naturally recovers if unchallenged)
  const healthAfterRegen = Math.min(
    boss.maxHealthPoints,
    boss.healthPoints + config.healthRegenerationPerTick
  );

  // Apply adjustments
  const adjustedBoss: BossState = {
    ...boss,
    healthPoints: healthAfterRegen + healthAdjust,
    armor: Math.min(boss.armor + armorAdjust, targetArmor * 1.1), // Cap at 110% target
    activeMechanics: Array.from(new Set([...boss.activeMechanics, ...newMechanics])),
    enraged: boss.enraged || newMechanics.includes('catastrophic_enrage')
  };

  const adjustment: DifficultyAdjustment = {
    tickNumber,
    activePlayerCount,
    adjustedHealthPercentage: (adjustedBoss.healthPoints / adjustedBoss.maxHealthPoints) * 100,
    adjustedArmorPercentage: (adjustedBoss.armor / (targetArmor * 1.1)) * 100,
    newMechanicsTriggered: newMechanics,
    scaleFactor
  };

  adjustmentHistory.push(adjustment);

  return { adjustedBoss, adjustment };
}

/**
 * Recalculate bucket-based priority targeting for 100+ players
 * O(1) targeting instead of O(n) threat list searches
 * 
 * Buckets:
 * - Tank bucket: High threat, low rank
 * - DPS bucket: Medium threat, high rank
 * - Healer bucket: Variable threat, support role
 * 
 * @param boss Boss whose aggro to update
 * @param playerMetrics All active player metrics
 * @returns Map of bucket -> [playerId, threat]
 */
export function recalculateAggro(
  boss: BossState,
  playerMetrics: Map<string, ParticipationMetrics>
): Map<string, [string, number][]> {
  const buckets = new Map<string, [string, number][]>();
  buckets.set('tank', []);
  buckets.set('dps', []);
  buckets.set('healer', []);

  const entries = Array.from(playerMetrics.entries());

  for (const [playerId, metrics] of entries) {
    const threat = metrics.damageDealt + (metrics.healingProvided * 0.5);
    const bucket =
      metrics.damageDealt > 5000 ? 'tank' :
      metrics.healingProvided > 1000 ? 'healer' :
      'dps';

    const bucketList = buckets.get(bucket) || [];
    bucketList.push([playerId, threat]);
    buckets.set(bucket, bucketList);
  }

  // Sort each bucket by threat
  buckets.forEach((targets) => {
    targets.sort((a, b) => b[1] - a[1]);
    targets.splice(5); // Keep only top 5 per bucket
  });

  return buckets;
}

/**
 * Get current boss abilities active for given player count
 * 
 * @param playerCount Active players
 * @param phase Current boss phase
 * @returns Array of active abilities
 */
export function getActiveAbilities(
  playerCount: number,
  phase: number
): BossAbility[] {
  const abilities: BossAbility[] = [
    {
      abilityId: 'power_attack',
      name: 'Power Attack',
      triggerThreshold: 16,
      triggerPhase: 1,
      duration: 3000,
      cooldownTicks: 8,
      description: 'Boss attacks for 2x damage',
      affectedPlayerPercentage: 20
    },
    {
      abilityId: 'add_wave',
      name: 'Spawn Adds',
      triggerThreshold: 32,
      triggerPhase: 1,
      duration: 5000,
      cooldownTicks: 15,
      description: 'Spawn 8-12 adds (1 per player)',
      affectedPlayerPercentage: 100
    },
    {
      abilityId: 'reality_fracture',
      name: 'Reality Fracture',
      triggerThreshold: 64,
      triggerPhase: 2,
      duration: 8000,
      cooldownTicks: 20,
      description: 'Players randomly teleported, AoE damage',
      affectedPlayerPercentage: 40
    },
    {
      abilityId: 'catastrophic_event',
      name: 'Catastrophic Enrage',
      triggerThreshold: 100,
      triggerPhase: 3,
      duration: 15000,
      cooldownTicks: 60,
      description: 'Boss enters enrage: 5x damage, all mechanics active',
      affectedPlayerPercentage: 100
    }
  ];

  return abilities.filter(
    (a) => playerCount >= a.triggerThreshold && phase >= a.triggerPhase
  );
}

/**
 * Calculate contribution score for a player
 * Used for loot distribution and rewards
 * 
 * @param metrics Player participation metrics
 * @returns Score (0-1000)
 */
export function calculateContributionScore(metrics: ParticipationMetrics): number {
  const damageScore = Math.min(metrics.damageDealt / 100, 300);
  const healingScore = Math.min(metrics.healingProvided / 50, 300);
  const survivalScore = metrics.uptime * 200;
  const avoidanceScore = metrics.mechanicsAvoided * 50;

  const baseScore = damageScore + healingScore + survivalScore + avoidanceScore;
  const mythRankMultiplier = 1 + (metrics.mythRank * 0.1); // 10% per rank

  return Math.min(baseScore * mythRankMultiplier, 1000);
}

/**
 * Determine phase transition based on boss health
 * 
 * @param boss Boss to check
 * @returns New phase (1, 2, 3, or unchanged)
 */
export function calculatePhaseTransition(boss: BossState): number {
  const healthPercent = (boss.healthPoints / boss.maxHealthPoints) * 100;

  if (healthPercent > 65 && boss.phase !== 1) return 1;
  if (healthPercent > 30 && healthPercent <= 65 && boss.phase !== 2) return 2;
  if (healthPercent <= 30 && boss.phase !== 3) return 3;

  return boss.phase;
}

/**
 * Apply enrage mechanics (triggered when time exceeded or health too high)
 * 
 * @param boss Boss to enrage
 * @param timeSinceStart Milliseconds since encounter started
 * @param config RTDS config
 * @returns Enraged boss
 */
export function applyEnrageMechanics(
  boss: BossState,
  timeSinceStart: number,
  config: RTDSConfig = DEFAULT_RTDS_CONFIG
): BossState {
  if (timeSinceStart < config.enrageThresholdMs) {
    return boss;
  }

  return {
    ...boss,
    enraged: true,
    activeMechanics: Array.from(new Set([...boss.activeMechanics, 'permanent_enrage'])),
    armor: boss.armor * 2, // Double armor when enraged
    healthPoints: boss.healthPoints + (boss.maxHealthPoints * 0.25) // Heal to 25% more
  };
}

/**
 * Get raid difficulty adjustment data for a time window
 * Used for balancing and telemetry
 * 
 * @param startTick Start tick number
 * @param endTick End tick number
 * @returns Adjustments during window
 */
export function getAdjustmentWindow(
  startTick: number,
  endTick: number
): DifficultyAdjustment[] {
  return adjustmentHistory.filter(
    (a) => a.tickNumber >= startTick && a.tickNumber <= endTick
  );
}

/**
 * Clear adjustment history (call after raid closes)
 */
export function clearAdjustmentHistory(): void {
  adjustmentHistory = [];
}

/**
 * Export for testing: create custom RTDS config
 */
export function createCustomRTDSConfig(
  overrides: Partial<RTDSConfig>
): RTDSConfig {
  return {
    ...DEFAULT_RTDS_CONFIG,
    ...overrides
  };
}
