/**
 * RAID ENGINE — World Raids & Macro-Anomaly Events
 *
 * Manages large-scale multi-player encounters triggered by critical paradox levels.
 * Features: Boss AI with phase scaling, cooperative stabilization rituals, real-time
 * network synchronization, and paradox reduction rewards.
 *
 * Phase 24 Task 2: Sovereignty Expansion
 */

import { WorldState, LocationSnapshot } from './worldEngine';
import { WorldAction } from './actionPipeline';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export enum RaidParticipantRole {
  TANK = 'TANK',           // High aggro, defensive
  DAMAGE_DEALER = 'DAMAGE_DEALER',  // High damage output
  HEALER = 'HEALER',       // Restores ally HP
  RITUALIST = 'RITUALIST',  // Channels stabilization
  SUPPORT = 'SUPPORT',     // Buffs/debuffs
}

export enum RaidBossPhase {
  PHASE_1 = 1,  // 100-75% HP
  PHASE_2 = 2,  // 75-50% HP
  PHASE_3 = 3,  // 50-25% HP
  ENRAGE = 4,   // <25% HP - increased damage
}

export enum MacroAnomalyIntensity {
  MINOR = 1,
  MODERATE = 2,
  CRITICAL = 3,
  CATASTROPHIC = 4,
}

export enum RaidStatus {
  PREPARING = 'PREPARING',      // Waiting for participants
  IN_PROGRESS = 'IN_PROGRESS',  // Combat active
  STABILIZING = 'STABILIZING',  // Boss HP < 10%, players channeling
  RESOLVED_SUCCESS = 'RESOLVED_SUCCESS',
  RESOLVED_FAILURE = 'RESOLVED_FAILURE',
  TIME_LOCKED = 'TIME_LOCKED',  // Location inaccessible after failure
}

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface RaidParticipant {
  playerId: string;
  playerName: string;
  role: RaidParticipantRole;
  currentHp: number;
  maxHp: number;
  damage: number;  // Per tick
  threat: number;  // Aggro tracker
  contributionScore: number;  // Total damage, heals, stabilization
  status: 'ACTIVE' | 'DEAD' | 'CHANNELING' | 'DAZED';
  lastActionAt: number;
  joinedAt: number;
}

export interface BossAbility {
  id: string;
  name: string;
  description: string;
  unlockedAtPhase: RaidBossPhase;
  cooldownTicks: number;
  ticksSinceLastUse: number;
  damagePerParticipant: number;  // Scales by participant count
  areaOfEffect: boolean;
  execute: (participants: RaidParticipant[], boss: RaidBoss) => void;
}

export interface RaidBoss {
  id: string;
  templateId: string;
  name: string;
  biome: string;
  currentPhase: RaidBossPhase;
  health: number;
  maxHealth: number;
  baseDamage: number;
  baseAttackSpeed: number;  // Attacks per 10 ticks
  currentTarget: string | null;
  aggroMap: Map<string, number>;  // playerId -> threat level
  activeAbilities: BossAbility[];
  vulnerabilityMultiplier: number;  // Paradox siphon reduces boss shield
  environmentalHazard: {
    name: string;
    damagePerTick: number;
    affectsPlayers: boolean;
  };
}

export interface CooperativeRitual {
  id: string;
  name: string;
  requiredParticipants: number;
  currentParticipants: string[];  // Player IDs
  stabilizationProgressPerTick: number;
  channelRadius: number;  // Must be near sub-location
  subLocationId: string;
  activatedAt: number;
  isActive: boolean;
}

export interface MacroAnomalyEvent {
  id: string;
  locationId: string;
  intensity: MacroAnomalyIntensity;
  paradoxThreshold: number;  // Local paradox that triggered
  stabilizationProgress: number;
  maxStabilization: number;
  createdAt: number;
  resolvedAt?: number;
  raidIdAssociated?: string;
}

export interface RaidState {
  id: string;
  anomalyId: string;
  locationId: string;
  status: RaidStatus;
  boss: RaidBoss;
  participants: Map<string, RaidParticipant>;
  ritual?: CooperativeRitual;
  createdAt: number;
  lastTickAt: number;
  totalTicksElapsed: number;
  participantCount: number;
}

export interface RaidTemplate {
  id: string;
  name: string;
  description: string;
  biomeTriggers: string[];  // 'forest', 'mountain', 'void'
  minParticipants: number;
  maxParticipants: number;
  baseMaxHealth: number;
  baseDamage: number;
  abilityPool: BossAbility[];
  environmentalHazards: Array<{
    name: string;
    damagePerTick: number;
  }>;
  rewardLegacyPoints: number;
  rewardEchoRarity: 'rare' | 'epic' | 'legendary';
}

export interface RaidStatusUpdate {
  raidId: string;
  locationId: string;
  bossHealth: number;
  bossMaxHealth: number;
  currentPhase: RaidBossPhase;
  participantCount: number;
  status: RaidStatus;
  stabilizationProgress?: number;
  timestamp: number;
}

// ============================================================================
// RAID ENGINE CLASS
// ============================================================================

export class RaidEngine {
  private raids: Map<string, RaidState> = new Map();
  private anomalies: Map<string, MacroAnomalyEvent> = new Map();
  private raidTemplates: Map<string, RaidTemplate> = new Map();
  private timeLockDuration = 500;  // Ticks location is inaccessible after failure
  private timeLocks: Map<string, number> = new Map();  // locationId -> unlockAt tick

  constructor() {
    this.initializeRaidTemplates();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeRaidTemplates(): void {
    // Template 1: The Chronos Devourer
    this.raidTemplates.set('chronos-devourer', {
      id: 'chronos-devourer',
      name: 'The Chronos Devourer',
      description: 'Ancient entity that consumes time itself, warping reality around it',
      biomeTriggers: ['void', 'mountain'],
      minParticipants: 3,
      maxParticipants: 8,
      baseMaxHealth: 500,
      baseDamage: 15,
      abilityPool: [
        {
          id: 'time-warp',
          name: 'Temporal Warp',
          description: 'Freezes all players briefly, dealing area damage',
          unlockedAtPhase: RaidBossPhase.PHASE_1,
          cooldownTicks: 20,
          ticksSinceLastUse: 0,
          damagePerParticipant: 8,
          areaOfEffect: true,
          execute: () => {},
        },
        {
          id: 'paradox-cascade',
          name: 'Paradox Cascade',
          description: 'Releases cascading paradox waves',
          unlockedAtPhase: RaidBossPhase.PHASE_2,
          cooldownTicks: 30,
          ticksSinceLastUse: 0,
          damagePerParticipant: 12,
          areaOfEffect: true,
          execute: () => {},
        },
        {
          id: 'timeline-split',
          name: 'Timeline Split',
          description: 'Boss attacks multiple targets simultaneously',
          unlockedAtPhase: RaidBossPhase.PHASE_3,
          cooldownTicks: 40,
          ticksSinceLastUse: 0,
          damagePerParticipant: 20,
          areaOfEffect: false,
          execute: () => {},
        },
      ],
      environmentalHazards: [
        { name: 'Temporal Bleed', damagePerTick: 2 },
        { name: 'Causality Collapse', damagePerTick: 1 },
      ],
      rewardLegacyPoints: 500,
      rewardEchoRarity: 'legendary',
    });

    // Template 2: Void Rift Singularity
    this.raidTemplates.set('void-singularity', {
      id: 'void-singularity',
      name: 'Void Rift Singularity',
      description: 'A tear in reality consuming everything nearby',
      biomeTriggers: ['void'],
      minParticipants: 4,
      maxParticipants: 10,
      baseMaxHealth: 600,
      baseDamage: 18,
      abilityPool: [
        {
          id: 'void-pull',
          name: 'Void Pull',
          description: 'Draws players toward the singularity',
          unlockedAtPhase: RaidBossPhase.PHASE_1,
          cooldownTicks: 25,
          ticksSinceLastUse: 0,
          damagePerParticipant: 10,
          areaOfEffect: true,
          execute: () => {},
        },
        {
          id: 'dimension-fracture',
          name: 'Dimension Fracture',
          description: 'Splits the battlefield into separate zones',
          unlockedAtPhase: RaidBossPhase.PHASE_2,
          cooldownTicks: 35,
          ticksSinceLastUse: 0,
          damagePerParticipant: 15,
          areaOfEffect: true,
          execute: () => {},
        },
      ],
      environmentalHazards: [
        { name: 'Void Corruption', damagePerTick: 3 },
      ],
      rewardLegacyPoints: 600,
      rewardEchoRarity: 'epic',
    });
  }

  // ========================================================================
  // ANOMALY DETECTION & TRIGGER
  // ========================================================================

  public triggerMacroAnomaly(
    locationId: string,
    worldState: WorldState,
    localParadox: number,
    generationalParadox: number
  ): MacroAnomalyEvent | null {
    // Check if location already has active raid
    if (this.raids.values()) {
      for (const raid of this.raids.values()) {
        if (raid.locationId === locationId && raid.status === RaidStatus.IN_PROGRESS) {
          return null;  // Raid already active
        }
      }
    }

    // Determine intensity based on paradox levels
    let intensity = MacroAnomalyIntensity.MINOR;
    if (localParadox > 250 && generationalParadox > 300) {
      intensity = MacroAnomalyIntensity.CATASTROPHIC;
    } else if (localParadox > 200) {
      intensity = MacroAnomalyIntensity.CRITICAL;
    } else if (localParadox > 150) {
      intensity = MacroAnomalyIntensity.MODERATE;
    }

    const anomalyId = generateId('anomaly');
    const anomaly: MacroAnomalyEvent = {
      id: anomalyId,
      locationId,
      intensity,
      paradoxThreshold: Math.max(localParadox, generationalParadox),
      stabilizationProgress: 0,
      maxStabilization: 100 + intensity * 50,
      createdAt: Date.now(),
    };

    this.anomalies.set(anomalyId, anomaly);

    // Auto-initialize raid if intensity is critical or above
    if (intensity >= MacroAnomalyIntensity.CRITICAL) {
      const raidId = this.initializeRaidInstance(anomalyId, locationId, worldState);
      anomaly.raidIdAssociated = raidId;
    }

    return anomaly;
  }

  public initializeRaidInstance(
    anomalyId: string,
    locationId: string,
    worldState: WorldState
  ): string {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) throw new Error(`Anomaly ${anomalyId} not found`);

    // Select raid template based on biome
    const location = worldState.locations.get(locationId);
    const biome = location?.biome || 'void';
    let templateId = 'chronos-devourer';

    if (biome === 'void') {
      templateId = Math.random() > 0.5 ? 'chronos-devourer' : 'void-singularity';
    } else if (biome === 'mountain') {
      templateId = 'chronos-devourer';
    }

    const template = this.raidTemplates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // Scale boss health by anomaly intensity
    const healthMultiplier = 1 + anomaly.intensity * 0.25;
    const maxHealth = Math.floor(template.baseMaxHealth * healthMultiplier);

    const boss: RaidBoss = {
      id: generateId('boss'),
      templateId,
      name: template.name,
      biome,
      currentPhase: RaidBossPhase.PHASE_1,
      health: maxHealth,
      maxHealth,
      baseDamage: template.baseDamage,
      baseAttackSpeed: 0.5,
      currentTarget: null,
      aggroMap: new Map(),
      activeAbilities: template.abilityPool.map(a => ({ ...a })),
      vulnerabilityMultiplier: 1.0,
      environmentalHazard: template.environmentalHazards[0] || {
        name: 'Generic Hazard',
        damagePerTick: 0,
        affectsPlayers: true,
      },
    };

    const raidId = generateId('raid');
    const raid: RaidState = {
      id: raidId,
      anomalyId,
      locationId,
      status: RaidStatus.PREPARING,
      boss,
      participants: new Map(),
      createdAt: Date.now(),
      lastTickAt: Date.now(),
      totalTicksElapsed: 0,
      participantCount: 0,
    };

    this.raids.set(raidId, raid);
    return raidId;
  }

  // ========================================================================
  // RAID PARTICIPATION
  // ========================================================================

  public joinRaid(
    raidId: string,
    playerId: string,
    playerName: string,
    selectedRole: RaidParticipantRole
  ): boolean {
    const raid = this.raids.get(raidId);
    if (!raid) throw new Error(`Raid ${raidId} not found`);

    if (raid.status !== RaidStatus.PREPARING && raid.status !== RaidStatus.IN_PROGRESS) {
      return false;  // Raid already resolved or time-locked
    }

    if (raid.participants.has(playerId)) {
      return false;  // Already joined
    }

    const participant: RaidParticipant = {
      playerId,
      playerName,
      role: selectedRole,
      currentHp: 100,
      maxHp: 100,
      damage: selectedRole === RaidParticipantRole.DAMAGE_DEALER ? 12 : 8,
      threat: 0,
      contributionScore: 0,
      status: 'ACTIVE',
      lastActionAt: Date.now(),
      joinedAt: Date.now(),
    };

    raid.participants.set(playerId, participant);
    raid.participantCount = raid.participants.size;

    // Auto-start raid if minimum participants reached
    if (raid.participantCount >= 3 && raid.status === RaidStatus.PREPARING) {
      raid.status = RaidStatus.IN_PROGRESS;
    }

    return true;
  }

  public leaveRaid(raidId: string, playerId: string): void {
    const raid = this.raids.get(raidId);
    if (!raid) return;

    raid.participants.delete(playerId);
    raid.participantCount = raid.participants.size;

    // Clear from boss aggro
    raid.boss.aggroMap.delete(playerId);
    if (raid.boss.currentTarget === playerId) {
      raid.boss.currentTarget = null;
    }
  }

  // ========================================================================
  // BOSS AI & PHASE LOGIC
  // ========================================================================

  public processBossTick(raidId: string, worldState: WorldState): void {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== RaidStatus.IN_PROGRESS) return;

    raid.totalTicksElapsed++;
    raid.lastTickAt = Date.now();

    const boss = raid.boss;
    const participants = Array.from(raid.participants.values());

    if (participants.length === 0) {
      raid.status = RaidStatus.RESOLVED_FAILURE;
      return;
    }

    // ~~~~~ PHASE TRANSITIONS ~~~~~
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent < 0.25) {
      boss.currentPhase = RaidBossPhase.ENRAGE;
    } else if (healthPercent < 0.5) {
      boss.currentPhase = RaidBossPhase.PHASE_3;
    } else if (healthPercent < 0.75) {
      boss.currentPhase = RaidBossPhase.PHASE_2;
    } else {
      boss.currentPhase = RaidBossPhase.PHASE_1;
    }

    // ~~~~~ BOSS ACTIONS ~~~~~
    // Select target based on highest threat
    const targets = participants.filter(p => p.status === 'ACTIVE');
    if (targets.length === 0) {
      raid.status = RaidStatus.RESOLVED_FAILURE;
      return;
    }

    let highestThreat = targets[0];
    for (const target of targets) {
      const threat = boss.aggroMap.get(target.playerId) || 0;
      const currentHighest = boss.aggroMap.get(highestThreat.playerId) || 0;
      if (threat > currentHighest) {
        highestThreat = target;
      }
    }

    boss.currentTarget = highestThreat.playerId;

    // Execute auto attack scaled by participant count
    const scaledDamage = boss.baseDamage * (1 + participants.length * 0.15) * boss.vulnerabilityMultiplier;
    if (raid.totalTicksElapsed % Math.ceil(10 / boss.baseAttackSpeed) === 0) {
      highestThreat.currentHp -= Math.floor(scaledDamage);
      if (highestThreat.currentHp <= 0) {
        highestThreat.status = 'DEAD';
      }
    }

    // Try to execute ability (cooldown-based)
    const availableAbilities = boss.activeAbilities.filter(
      a => a.ticksSinceLastUse >= a.cooldownTicks && a.unlockedAtPhase <= boss.currentPhase
    );
    if (availableAbilities.length > 0 && Math.random() > 0.4) {
      const ability = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
      this.executeBossAbility(ability.id, raidId, worldState);
      ability.ticksSinceLastUse = 0;
    }

    // Increment cooldowns
    for (const ability of boss.activeAbilities) {
      ability.ticksSinceLastUse++;
    }

    // Environmental hazard damage
    if (boss.environmentalHazard.affectsPlayers) {
      for (const participant of targets) {
        participant.currentHp -= boss.environmentalHazard.damagePerTick;
        if (participant.currentHp <= 0) {
          participant.status = 'DEAD';
        }
      }
    }

    // ~~~~~ CHECK WIN/LOSS CONDITIONS ~~~~~
    if (boss.health <= 0) {
      raid.status = RaidStatus.STABILIZING;  // Start stabilization phase
      return;
    }

    const aliveCount = participants.filter(p => p.status === 'ACTIVE').length;
    if (aliveCount === 0) {
      raid.status = RaidStatus.RESOLVED_FAILURE;
    }
  }

  private executeBossAbility(
    abilityId: string,
    raidId: string,
    worldState: WorldState
  ): void {
    const raid = this.raids.get(raidId);
    if (!raid) return;

    const boss = raid.boss;
    const ability = boss.activeAbilities.find(a => a.id === abilityId);
    if (!ability) return;

    const participants = Array.from(raid.participants.values());

    if (ability.areaOfEffect) {
      // Damage all active participants
      for (const participant of participants) {
        if (participant.status === 'ACTIVE') {
          const damage = ability.damagePerParticipant * participants.length * 0.3;
          participant.currentHp -= Math.floor(damage);
          if (participant.currentHp <= 0) {
            participant.status = 'DEAD';
          }
        }
      }
    } else {
      // Damage current target
      if (boss.currentTarget) {
        const target = raid.participants.get(boss.currentTarget);
        if (target && target.status === 'ACTIVE') {
          const damage = ability.damagePerParticipant * participants.length * 0.5;
          target.currentHp -= Math.floor(damage);
          if (target.currentHp <= 0) {
            target.status = 'DEAD';
          }
        }
      }
    }
  }

  // ========================================================================
  // COOPERATIVE STABILIZATION RITUALS
  // ========================================================================

  public channelStabilization(
    raidId: string,
    playerId: string,
    subLocationId: string
  ): boolean {
    const raid = this.raids.get(raidId);
    if (!raid) return false;

    const participant = raid.participants.get(playerId);
    if (!participant) return false;

    if (!raid.ritual) {
      raid.ritual = {
        id: generateId('ritual'),
        name: 'Soul Sync Channeling',
        requiredParticipants: 3,
        currentParticipants: [playerId],
        stabilizationProgressPerTick: 5,
        channelRadius: 50,
        subLocationId,
        activatedAt: Date.now(),
        isActive: true,
      };
    } else if (!raid.ritual.currentParticipants.includes(playerId)) {
      raid.ritual.currentParticipants.push(playerId);
    }

    participant.status = 'CHANNELING';
    return true;
  }

  public stopChanneling(raidId: string, playerId: string): void {
    const raid = this.raids.get(raidId);
    if (!raid) return;

    const participant = raid.participants.get(playerId);
    if (!participant) return;

    if (raid.ritual) {
      raid.ritual.currentParticipants = raid.ritual.currentParticipants.filter(
        id => id !== playerId
      );
      if (raid.ritual.currentParticipants.length === 0) {
        raid.ritual.isActive = false;
      }
    }

    participant.status = 'ACTIVE';
  }

  public siphonParadox(raidId: string, playerId: string, paradoxAmount: number): void {
    const raid = this.raids.get(raidId);
    if (!raid) return;

    const participant = raid.participants.get(playerId);
    if (!participant) return;

    // Player takes "Temporal Corruption" damage
    participant.currentHp -= Math.floor(paradoxAmount * 0.5);
    if (participant.currentHp <= 0) {
      participant.status = 'DEAD';
    }

    // Boss shield weakened
    raid.boss.vulnerabilityMultiplier = Math.max(
      0.5,
      raid.boss.vulnerabilityMultiplier - paradoxAmount * 0.01
    );

    participant.contributionScore += paradoxAmount * 2;
  }

  public processRitualTick(raidId: string): void {
    const raid = this.raids.get(raidId);
    if (!raid || !raid.ritual) return;

    if (raid.ritual.currentParticipants.length >= raid.ritual.requiredParticipants) {
      const anomaly = this.anomalies.get(raid.anomalyId);
      if (anomaly) {
        anomaly.stabilizationProgress += raid.ritual.stabilizationProgressPerTick;
        if (anomaly.stabilizationProgress >= anomaly.maxStabilization) {
          // Stabilization complete
          raid.status = RaidStatus.RESOLVED_SUCCESS;
        }
      }
    }
  }

  // ========================================================================
  // RAID RESOLUTION & REWARDS
  // ========================================================================

  public resolveRaid(
    raidId: string,
    outcome: 'success' | 'failure',
    worldState: WorldState
  ): void {
    const raid = this.raids.get(raidId);
    if (!raid) return;

    const anomaly = this.anomalies.get(raid.anomalyId);
    if (!anomaly) return;

    if (outcome === 'success') {
      raid.status = RaidStatus.RESOLVED_SUCCESS;

      // Reduce world paradox
      const reduction = Math.floor(100 + anomaly.intensity * 25);
      const location = worldState.locations.get(raid.locationId);
      if (location) {
        (location as any).paradoxLevel = Math.max(
          0,
          ((location as any).paradoxLevel || 0) - reduction
        );
      }

      // Award participants
      for (const participant of raid.participants.values()) {
        participant.contributionScore += 100;  // Base reward
      }

      // Award to guild if applicable
      // (Integration with guildEngine.ts for treasury bonuses)
      anomaly.resolvedAt = Date.now();

    } else {
      raid.status = RaidStatus.RESOLVED_FAILURE;

      // Time-lock location
      this.timeLocks.set(raid.locationId, Date.now() + this.timeLockDuration * 50);  // ~50ms per tick
      (worldState.locations.get(raid.locationId) as any).isTimeLocked = true;

      // Increase paradox
      const location = worldState.locations.get(raid.locationId);
      if (location) {
        (location as any).paradoxLevel = Math.min(
          500,
          ((location as any).paradoxLevel || 0) + 50
        );
      }

      anomaly.resolvedAt = Date.now();
    }
  }

  // ========================================================================
  // NETWORK INTEGRATION
  // ========================================================================

  public getRaidStatusUpdate(raidId: string): RaidStatusUpdate | null {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    return {
      raidId,
      locationId: raid.locationId,
      bossHealth: raid.boss.health,
      bossMaxHealth: raid.boss.maxHealth,
      currentPhase: raid.boss.currentPhase,
      participantCount: raid.participantCount,
      status: raid.status,
      stabilizationProgress: this.anomalies.get(raid.anomalyId)?.stabilizationProgress,
      timestamp: Date.now(),
    };
  }

  public getActiveRaidsForLocation(locationId: string): string[] {
    const activeRaids: string[] = [];
    for (const raid of this.raids.values()) {
      if (raid.locationId === locationId && raid.status === RaidStatus.IN_PROGRESS) {
        activeRaids.push(raid.id);
      }
    }
    return activeRaids;
  }

  public getParticipantsList(raidId: string): RaidParticipant[] {
    const raid = this.raids.get(raidId);
    return raid ? Array.from(raid.participants.values()) : [];
  }

  // ========================================================================
  // ACCESSORS & UTILITIES
  // ========================================================================

  public getRaid(raidId: string): RaidState | undefined {
    return this.raids.get(raidId);
  }

  public getAnomaly(anomalyId: string): MacroAnomalyEvent | undefined {
    return this.anomalies.get(anomalyId);
  }

  public isLocationTimeLocked(locationId: string, currentTick: number): boolean {
    const unlockAt = this.timeLocks.get(locationId);
    if (!unlockAt) return false;
    if (currentTick * 50 >= unlockAt) {
      this.timeLocks.delete(locationId);
      return false;
    }
    return true;
  }

  public getAllActiveRaids(): RaidState[] {
    const active: RaidState[] = [];
    for (const raid of this.raids.values()) {
      if (raid.status === RaidStatus.IN_PROGRESS || raid.status === RaidStatus.STABILIZING) {
        active.push(raid);
      }
    }
    return active;
  }
}

// ============================================================================
// SINGLETON & ID GENERATOR
// ============================================================================

let raidEngineInstance: RaidEngine | null = null;

export function getRaidEngine(): RaidEngine {
  if (!raidEngineInstance) {
    raidEngineInstance = new RaidEngine();
  }
  return raidEngineInstance;
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `${prefix}-${timestamp}-${random}`;
}
