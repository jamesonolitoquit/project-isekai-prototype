/**
 * Reincarnation Engine (Phase 5 Core)
 *
 * Handles death, rebirth, and ancestral memory systems.
 * Implements the 72-hour Causal Lock, Flash Learning (10x XP),
 * and Ancestral Echo Points for skill inheritance.
 *
 * Key Formula:
 * - Ancestral Echo Points: AEP = (PeakLevel * 0.1) + AchievementTierValue
 * - Flash Learning: 10x XP gain until skill reaches 50% of previous peak
 * - XP Retention: Base 25% × (1 - ParadoxDebtFraction) × RarityMultiplier
 */

import type {
  PlayerSoul,
  VesselIncarnation,
  Achievement,
  AncestralEchoPoint,
  VesselRebinding,
  ReincarnationConfig,
  VesselTerminationCause,
} from '../types';
import type { Vessel, CharacterSkillSet, Skill } from '../types';

/**
 * Reincarnation Engine: Manages death/rebirth cycles and ancestral memory
 */
export class ReincarnationEngine {
  private soulsRegistry: Map<string, PlayerSoul> = new Map();
  private echoPointsRegistry: Map<string, AncestralEchoPoint[]> = new Map();
  private rebindingHistory: VesselRebinding[] = [];
  private config: ReincarnationConfig;
  private nextSoulId: number = 0;
  private nextEchoPointId: number = 0;

  // Rarity multipliers for XP retention and echo points
  private readonly SKILL_RARITY_MULTIPLIERS = {
    melee: 1.0,
    magic: 0.8,
    stealth: 1.2,
    survival: 1.6,
    prophecy: 0.6,
  };

  // Achievement tier values for echo point calculation
  private readonly ACHIEVEMENT_TIER_VALUES = {
    common: 1,
    uncommon: 3,
    rare: 7,
    epic: 15,
    legendary: 30,
  };

  constructor(config?: Partial<ReincarnationConfig>) {
    this.config = {
      baseXpRetentionPercent: 25,
      baseReputationRetentionPercent: 10,
      retainAchievements: true,
      baseSkillRetentionPercent: 25,
      maxEchoPointsPerLifetime: 500,
      echoXpMultiplier: 10,
      causalLockDurationTicks: 72 * 3600 * 1.5, // 72 hours in ticks (1.5s per tick)
      paradoxDebtCarries: true,
      paradoxDebtReductionPercent: 20,
      maxCausalVaultItems: 25,
      vaultMaintenanceFuelPerTick: 0.01,
      useInheritedAttributes: true,
      ...config,
    };
  }

  /**
   * Create a new PlayerSoul for a player account
   */
  createPlayerSoul(playerId: string): PlayerSoul {
    const soul: PlayerSoul = {
      id: `soul-${this.nextSoulId++}`,
      playerId,
      vesselLineage: [],
      totalAncestralEchoPoints: 0,
      availableAncestralEchoPoints: 0,
      lifetimeAchievements: [],
      incarnationCount: 0,
      createdAt: Date.now(),
      causalVaultIds: [],
      inheritedModifiers: {
        matriarchalLineageBonus: 0,
        factionReputationBonus: 0,
        skillXpBonus: 0,
      },
      currentParadoxDebt: 0,
      inCausalLock: false,
      lockTicks: 0,
    };

    this.soulsRegistry.set(soul.id, soul);
    return soul;
  }

  /**
   * Process a vessel death and trigger reincarnation prep
   * Calculates Ancestral Echo Points (AEP = PeakLevel * 0.1 + AchievementTierValue)
   * Applies 72-hour Causal Lock to prevent immediate rebirth
   */
  processVesselDeath(
    vessel: Vessel,
    soul: PlayerSoul,
    terminationCause: VesselTerminationCause,
    currentTick: number,
    achievements: Achievement[]
  ): {
    incarnationRecord: VesselIncarnation;
    echoPointsEarned: AncestralEchoPoint[];
    causalLockExpires: number;
  } {
    // Calculate ancestral echo points
    let totalEchoPoints = 0;
    const earnedEchoPoints: AncestralEchoPoint[] = [];

    for (const achievement of achievements) {
      if (!achievement.isPersistent) continue;

      const baseTierValue = this.ACHIEVEMENT_TIER_VALUES[achievement.tier] || 1;
      const levelScaling = Math.pow(vessel.level / 99, 1.5);
      const echoValue = Math.floor(baseTierValue * levelScaling * (achievement.value || 1));

      totalEchoPoints += echoValue;

      const echoPoint: AncestralEchoPoint = {
        id: `echo-${this.nextEchoPointId++}`,
        sourceVesselId: vessel.id,
        generation: soul.incarnationCount,
        xpValue: echoValue,
        skillId: '', // Will be assigned during rebinding
        isSpent: false,
        usesRemaining: 1,
        createdAt: currentTick,
      };

      earnedEchoPoints.push(echoPoint);
    }

    // Cap echo points at max per lifetime
    const cappedEchoPoints = Math.min(totalEchoPoints, this.config.maxEchoPointsPerLifetime);

    // Record incarnation in soul lineage
    const incarnation: VesselIncarnation = {
      vesselId: vessel.id,
      vesselName: vessel.name,
      ancestry: vessel.ancestry,
      incarnationStarted: vessel.createdAtTick,
      incarnationEnded: currentTick,
      lifespan: currentTick - vessel.createdAtTick,
      peakLevel: vessel.level,
      terminationCause,
      achievements,
      finalSkills: (vessel.skills || []).map(skill => ({
        skillId: skill.id,
        level: skill.level,
        xp: skill.currentXp || 0,
      })),
      xpInherited: [],
      reputationInherited: [],
      inventoryValue: vessel.inventory?.reduce((sum, item) => sum + (item.value || 0), 0) || 0,
      finalParadoxDebt: soul.currentParadoxDebt,
      echoPointsEarned: cappedEchoPoints,
      epitaph: `Fell to ${terminationCause}. Level ${vessel.level} ${vessel.ancestry}.`,
    };

    soul.vesselLineage.push(incarnation);
    soul.incarnationCount += 1;
    soul.totalAncestralEchoPoints += cappedEchoPoints;
    soul.availableAncestralEchoPoints += cappedEchoPoints;

    // Store echo points in registry
    this.echoPointsRegistry.set(soul.id, earnedEchoPoints);

    // Apply 72-hour Causal Lock
    const causalLockDuration = this.config.causalLockDurationTicks;
    const lockExpiresTick = currentTick + causalLockDuration;

    soul.inCausalLock = true;
    soul.causalLockExpires = lockExpiresTick;
    soul.lockTicks += causalLockDuration;

    return {
      incarnationRecord: incarnation,
      echoPointsEarned: earnedEchoPoints,
      causalLockExpires: lockExpiresTick,
    };
  }

  /**
   * Calculate XP retention when character dies
   * Formula: Base × (1 - ParadoxDebtFraction) × SkillRarityMultiplier
   */
  calculateXpRetention(
    skillId: string,
    currentXp: number,
    paradoxDebtFraction: number,
    skillCategory: keyof typeof this.SKILL_RARITY_MULTIPLIERS = 'melee'
  ): number {
    const baseRetention = this.config.baseXpRetentionPercent / 100;
    const paradoxPenalty = 1 - Math.min(paradoxDebtFraction, 1); // Reduced by debt
    const rarityMultiplier = this.SKILL_RARITY_MULTIPLIERS[skillCategory] || 1.0;

    const retained = currentXp * baseRetention * paradoxPenalty * rarityMultiplier;
    return Math.floor(retained);
  }

  /**
   * Apply Flash Learning multiplier during skill training in new life
   * 10x XP gain until skill reaches 50% of previous peak level
   */
  applyFlashLearningBoost(
    currentSkillLevel: number,
    previousPeakLevel: number,
    skillXpGained: number
  ): number {
    const flashLearningThreshold = (previousPeakLevel * 0.5);

    if (currentSkillLevel < flashLearningThreshold) {
      return skillXpGained * this.config.echoXpMultiplier;
    }

    return skillXpGained;
  }

  /**
   * Rebind a soul to a new vessel after death
   * Transfers XP (25% base), reputation (10% base), and echo points
   */
  rebindSoulToVessel(
    soul: PlayerSoul,
    previousVessel: Vessel,
    newVessel: Vessel,
    currentTick: number,
    causalVaultItems?: string[]
  ): VesselRebinding {
    // Check if causal lock is still active
    if (soul.inCausalLock && soul.causalLockExpires && currentTick < soul.causalLockExpires) {
      throw new Error(
        `Cannot rebind: Soul in Causal Lock until tick ${soul.causalLockExpires}`
      );
    }

    // Clear causal lock
    soul.inCausalLock = false;
    soul.causalLockExpires = undefined;

    const paradoxDebtFraction = Math.max(0, Math.min(soul.currentParadoxDebt / 100, 1));

    // Calculate XP retention for each skill
    const skillXpRetained = (previousVessel.skills || []).map(skill => ({
      skillId: skill.id,
      amount: this.calculateXpRetention(
        skill.id,
        skill.currentXp || 0,
        paradoxDebtFraction,
        'melee' // TODO: determine skill category
      ),
    }));

    // Calculate reputation retention
    const reputationRetained = [
      // TODO: populate from previous vessel's faction reputation
    ];

    // Calculate echo points to apply
    const echoPointsAvailable = soul.availableAncestralEchoPoints;
    const echoPointsApplied = [];

    // Distribute echo points across primary skills
    let pointsRemaining = Math.floor(echoPointsAvailable * 0.5); // Use 50% of available
    for (const skill of newVessel.skills || []) {
      if (pointsRemaining <= 0) break;

      const pointsForThisSkill = Math.floor(pointsRemaining / (newVessel.skills?.length || 1));
      echoPointsApplied.push({
        skillId: skill.id,
        pointsApplied: pointsForThisSkill,
      });

      pointsRemaining -= pointsForThisSkill;
    }

    // Transfer paradox debt (usually 25% carried over)
    const paradoxTransferred = Math.floor(soul.currentParadoxDebt * 0.25);

    // Update soul state
    soul.availableAncestralEchoPoints -= echoPointsApplied.reduce((sum, e) => sum + e.pointsApplied, 0);

    // Record rebinding transaction
    const rebinding: VesselRebinding = {
      id: `rebind-${Date.now()}`,
      soulId: soul.id,
      previousVesselId: previousVessel.id,
      newVesselId: newVessel.id,
      newAncestry: newVessel.ancestry,
      rebindingTick: currentTick,
      isSuccessful: true,
      skillXpRetained,
      reputationRetained,
      itemsRetrieved: causalVaultItems || [],
      echoPointsUsed: echoPointsApplied.reduce((sum, e) => sum + e.pointsApplied, 0),
      echoPointsApplied,
      paradoxDebtTransferred: paradoxTransferred,
      notes: `Successful rebinding to new ${newVessel.ancestry} vessel`,
    };

    this.rebindingHistory.push(rebinding);
    return rebinding;
  }

  /**
   * Check if soul is still in causal lock
   */
  isInCausalLock(soul: PlayerSoul, currentTick: number): boolean {
    if (!soul.inCausalLock) return false;
    if (soul.causalLockExpires && currentTick >= soul.causalLockExpires) {
      soul.inCausalLock = false;
      return false;
    }
    return true;
  }

  /**
   * Get remaining lock time in ticks
   */
  getRemainingLockTime(soul: PlayerSoul, currentTick: number): number {
    if (!soul.causalLockExpires) return 0;
    return Math.max(0, soul.causalLockExpires - currentTick);
  }

  /**
   * Get ancestral echo points for a soul
   */
  getAncestralEchoPoints(soul: PlayerSoul): AncestralEchoPoint[] {
    return this.echoPointsRegistry.get(soul.id) || [];
  }

  /**
   * Get soul by ID
   */
  getSoul(soulId: string): PlayerSoul | undefined {
    return this.soulsRegistry.get(soulId);
  }

  /**
   * Get rebinding history for a soul
   */
  getRebindingHistory(soulId: string): VesselRebinding[] {
    return this.rebindingHistory.filter(r => r.soulId === soulId);
  }

  /**
   * Update soul's paradox debt (called from global paradox tracker)
   */
  updateParadoxDebt(soul: PlayerSoul, newDebtValue: number): void {
    soul.currentParadoxDebt = Math.max(0, Math.min(newDebtValue, 100));
  }

  /**
   * Finalize a lifetime achievement for the soul
   * This persists achievements across reincarnations
   */
  recordLifetimeAchievement(soul: PlayerSoul, achievement: Achievement): void {
    // Check if already recorded
    if (!soul.lifetimeAchievements.find(a => a.id === achievement.id)) {
      soul.lifetimeAchievements.push(achievement);
    }
  }
}
