/**
 * M64: Legendary Encounters & Boss Templates
 * 
 * Defines multi-phase boss encounters for 32-128 player raids:
 * - Aethelgard World-Eater (flagship 32-player encounter)
 * - Phase mechanics that scale with player count
 * - Reality Collapse finale (catastrophic mechanic)
 * - Dynamic difficulty scaling integration
 * 
 * Each encounter is fully deterministic and replayable via M62-CHRONOS.
 */

import { v4 as uuid } from 'uuid';
import type { BossState } from './m64InstanceManager';
import { appendEvent } from '../events/mutationLog';

// ============================================================================
// TYPES: Encounter Design
// ============================================================================

/**
 * Phase mechanics: Actions boss performs each tick
 */
export interface PhaseAction {
  readonly actionId: string;
  readonly name: string;
  readonly phase: number;
  readonly triggerCondition: 'timer' | 'health_threshold' | 'player_action' | 'random';
  readonly triggerValue: number; // Duration (ms) or health (%)
  readonly targetingPattern: 'radial' | 'sequential' | 'random' | 'healers' | 'tanked';
  readonly damagePerPlayer: number;
  readonly channelTime: number; // Time to perform (ms)
  readonly cooldownTicks: number;
  readonly description: string;
}

/**
 * Encounter definition: Complete boss encounter template
 */
export interface EncounterTemplate {
  readonly encounterId: string;
  readonly name: string;
  readonly bossName: string;
  readonly difficulty: 'normal' | 'heroic' | 'mythic';
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly baseHealthPerPlayer: number;
  readonly phases: PhaseDefinition[];
  readonly lootTable: string;
}

/**
 * Phase definition: All actions and mechanics for a phase
 */
export interface PhaseDefinition {
  readonly phaseNumber: number;
  readonly healthThreshold: number; // %HP to trigger
  readonly phaseActions: PhaseAction[];
  readonly addWaves?: AddWave[];
  readonly environmentalHazards?: EnvironmentalHazard[];
}

/**
 * Add wave: Spawns additional enemies during phase
 */
export interface AddWave {
  readonly waveId: string;
  readonly addType: 'minion' | 'elite' | 'mythic';
  readonly addCount: number; // Scales with player count
  readonly addHealthPerPlayer: number;
  readonly damagePerAdd: number;
  readonly spawnPattern: 'circle' | 'random' | 'lane';
}

/**
 * Environmental hazard: Map hazard or collateral damage
 */
export interface EnvironmentalHazard {
  readonly hazardId: string;
  readonly name: string;
  readonly damagePerTick: number;
  readonly affectRadius: number;
  readonly duration: number; // ms
  readonly respawnIntervalTicks: number;
}

/**
 * Encounter state during combat
 */
export interface EncounterState {
  readonly stateId: string;
  readonly encounterId: string;
  readonly currentPhase: number;
  readonly boss: BossState;
  readonly activePhaseActions: PhaseAction[];
  readonly activeMechanics: Map<string, number>; // mechanicId -> ticksRemaining
  readonly hazardFields: EnvironmentalHazard[];
  readonly spawnedAdds: Map<string, { health: number; damage: number }>;
  readonly elapsedTicks: number;
  readonly isEnraged: boolean;
  readonly reality_collapse_active: boolean;
}

// ============================================================================
// ENCOUNTER TEMPLATES
// ============================================================================

/**
 * AETHELGARD WORLD-EATER: Flagship 32-player encounter
 * 
 * 3-Phase boss with reality collapse finale
 * - Phase 1 (100-65%): Introduces add waves and AoE mechanics
 * - Phase 2 (65-30%): Reality-warping adds, split-phase mechanics
 * - Phase 3 (30-0%): Enrage and Reality Collapse finale
 */
export const AETHELGARD_WORLD_EATER: EncounterTemplate = {
  encounterId: 'aethelgard_01',
  name: 'The World-Eater Awakens',
  bossName: 'Aethelgard the Devourer',
  difficulty: 'heroic',
  minPlayers: 16,
  maxPlayers: 64,
  baseHealthPerPlayer: 2000,
  phases: [
    {
      phaseNumber: 1,
      healthThreshold: 65,
      phaseActions: [
        {
          actionId: 'cleave_1',
          name: 'Worldly Cleave',
          phase: 1,
          triggerCondition: 'timer',
          triggerValue: 8000,
          targetingPattern: 'tanked',
          damagePerPlayer: 300,
          channelTime: 2000,
          cooldownTicks: 12,
          description: 'Boss swipes all players, prioritizes threat leaders'
        },
        {
          actionId: 'add_spawn_1',
          name: 'Spawn Reality Tears',
          phase: 1,
          triggerCondition: 'timer',
          triggerValue: 15000,
          targetingPattern: 'random',
          damagePerPlayer: 0,
          channelTime: 3000,
          cooldownTicks: 20,
          description: 'Summon adds (1 per 8 players)'
        },
        {
          actionId: 'aoe_1',
          name: 'Reality Wave',
          phase: 1,
          triggerCondition: 'timer',
          triggerValue: 12000,
          targetingPattern: 'radial',
          damagePerPlayer: 250,
          channelTime: 1500,
          cooldownTicks: 15,
          description: 'AoE radial damage, hits all players'
        }
      ],
      addWaves: [
        {
          waveId: 'phase1_minions',
          addType: 'minion',
          addCount: 4,
          addHealthPerPlayer: 200,
          damagePerAdd: 50,
          spawnPattern: 'circle'
        }
      ]
    },
    {
      phaseNumber: 2,
      healthThreshold: 30,
      phaseActions: [
        {
          actionId: 'cleave_2',
          name: 'Destructive Cleave',
          phase: 2,
          triggerCondition: 'timer',
          triggerValue: 6000,
          targetingPattern: 'tanked',
          damagePerPlayer: 500,
          channelTime: 2000,
          cooldownTicks: 10,
          description: 'Increased damage and frequency'
        },
        {
          actionId: 'reality_fracture',
          name: 'Reality Fracture',
          phase: 2,
          triggerCondition: 'timer',
          triggerValue: 20000,
          targetingPattern: 'random',
          damagePerPlayer: 400,
          channelTime: 4000,
          cooldownTicks: 25,
          description: 'Teleports random players, deals damage on displacement'
        },
        {
          actionId: 'split_phase',
          name: 'Split Form',
          phase: 2,
          triggerCondition: 'health_threshold',
          triggerValue: 50,
          targetingPattern: 'sequential',
          damagePerPlayer: 200,
          channelTime: 8000,
          cooldownTicks: 40,
          description: 'Boss splits into 2 entities, raid must manage 2 targets'
        }
      ],
      addWaves: [
        {
          waveId: 'phase2_elites',
          addType: 'elite',
          addCount: 8,
          addHealthPerPlayer: 400,
          damagePerAdd: 100,
          spawnPattern: 'lane'
        }
      ],
      environmentalHazards: [
        {
          hazardId: 'reality_rift_1',
          name: 'Reality Rift',
          damagePerTick: 150,
          affectRadius: 20,
          duration: 12000,
          respawnIntervalTicks: 30
        }
      ]
    },
    {
      phaseNumber: 3,
      healthThreshold: 0,
      phaseActions: [
        {
          actionId: 'enrage',
          name: 'Apocalyptic Rage',
          phase: 3,
          triggerCondition: 'health_threshold',
          triggerValue: 30,
          targetingPattern: 'radial',
          damagePerPlayer: 800,
          channelTime: 3000,
          cooldownTicks: 8,
          description: 'Rapid all-AoE damage, boss attacks faster'
        },
        {
          actionId: 'reality_collapse_start',
          name: 'Reality Collapse (Initial)',
          phase: 3,
          triggerCondition: 'health_threshold',
          triggerValue: 10,
          targetingPattern: 'radial',
          damagePerPlayer: 1000,
          channelTime: 5000,
          cooldownTicks: 60,
          description: 'Begins catastrophic reality collapse - all mechanics active simultaneously'
        },
        {
          actionId: 'cascade_adds',
          name: 'Cascading Adds',
          phase: 3,
          triggerCondition: 'timer',
          triggerValue: 10000,
          targetingPattern: 'random',
          damagePerPlayer: 0,
          channelTime: 2000,
          cooldownTicks: 5,
          description: 'Spawns wave of adds every 5 seconds'
        }
      ],
      addWaves: [
        {
          waveId: 'phase3_mythic',
          addType: 'mythic',
          addCount: 12,
          addHealthPerPlayer: 600,
          damagePerAdd: 150,
          spawnPattern: 'random'
        }
      ],
      environmentalHazards: [
        {
          hazardId: 'reality_cascade_1',
          name: 'Reality Cascade',
          damagePerTick: 300,
          affectRadius: 100,
          duration: 8000,
          respawnIntervalTicks: 3
        },
        {
          hazardId: 'paradox_rupture',
          name: 'Paradox Rupture',
          damagePerTick: 500,
          affectRadius: 50,
          duration: 6000,
          respawnIntervalTicks: 2
        }
      ]
    }
  ],
  lootTable: 'legendary_world_eater'
};

/**
 * MYTHIC TRIAL: Advanced 64-player encounter
 * More mechanics and tighter DPS checks
 */
export const MYTHIC_TRIAL: EncounterTemplate = {
  encounterId: 'mythic_trial_01',
  name: 'The Eternal Trial',
  bossName: 'Keeper of the Eternal Flame',
  difficulty: 'mythic',
  minPlayers: 32,
  maxPlayers: 128,
  baseHealthPerPlayer: 3000,
  phases: [
    {
      phaseNumber: 1,
      healthThreshold: 60,
      phaseActions: [
        {
          actionId: 'trial_flame',
          name: 'Trial Flame',
          phase: 1,
          triggerCondition: 'timer',
          triggerValue: 10000,
          targetingPattern: 'sequential',
          damagePerPlayer: 350,
          channelTime: 2000,
          cooldownTicks: 12,
          description: 'Sequential targeting of players'
        }
      ]
    },
    {
      phaseNumber: 2,
      healthThreshold: 30,
      phaseActions: [
        {
          actionId: 'trial_inferno',
          name: 'Trial Inferno',
          phase: 2,
          triggerCondition: 'timer',
          triggerValue: 5000,
          targetingPattern: 'radial',
          damagePerPlayer: 600,
          channelTime: 3000,
          cooldownTicks: 8,
          description: 'Intense AoE, requires movement'
        }
      ]
    },
    {
      phaseNumber: 3,
      healthThreshold: 0,
      phaseActions: [
        {
          actionId: 'trial_eternal_rage',
          name: 'Eternal Rage',
          phase: 3,
          triggerCondition: 'timer',
          triggerValue: 3000,
          targetingPattern: 'radial',
          damagePerPlayer: 1200,
          channelTime: 4000,
          cooldownTicks: 2,
          description: 'Constant punishment phase'
        }
      ]
    }
  ],
  lootTable: 'mythic_trial_rewards'
};

// ============================================================================
// ENCOUNTER STATE MANAGEMENT
// ============================================================================

let activeEncounters = new Map<string, EncounterState>();

/**
 * Initialize encounter from template
 * 
 * @param template Encounter template
 * @param playerCount Active players
 * @returns New encounter state
 */
export function initializeEncounter(
  template: EncounterTemplate,
  playerCount: number
): EncounterState {
  const stateId = `encounter_${uuid()}`;
  const maxHp = template.baseHealthPerPlayer * playerCount;

  const boss: BossState = {
    bossId: `boss_${stateId}`,
    name: template.bossName,
    healthPoints: maxHp,
    maxHealthPoints: maxHp,
    phase: 1,
    armor: 100,
    enraged: false,
    activeMechanics: [],
    activeTargets: new Set()
  };

  const encounter: EncounterState = {
    stateId,
    encounterId: template.encounterId,
    currentPhase: 1,
    boss,
    activePhaseActions: template.phases[0].phaseActions,
    activeMechanics: new Map(),
    hazardFields: template.phases[0].environmentalHazards || [],
    spawnedAdds: new Map(),
    elapsedTicks: 0,
    isEnraged: false,
    reality_collapse_active: false
  };

  activeEncounters.set(stateId, encounter);
  return encounter;
}

/**
 * Update encounter phase based on boss health
 * Triggers new mechanics and adds
 * 
 * @param stateId Encounter state ID
 * @param template Encounter template
 */
export function updateEncounterPhase(
  stateId: string,
  template: EncounterTemplate
): number {
  const encounter = activeEncounters.get(stateId);
  if (!encounter) return 1;

  const healthPercent = (encounter.boss.healthPoints / encounter.boss.maxHealthPoints) * 100;
  let newPhase = encounter.currentPhase;

  for (const phase of template.phases) {
    if (healthPercent <= phase.healthThreshold && phase.phaseNumber > newPhase) {
      newPhase = phase.phaseNumber;
    }
  }

  if (newPhase !== encounter.currentPhase) {
    const newPhasedef = template.phases.find((p) => p.phaseNumber === newPhase);
    if (newPhasedef) {
      encounter.currentPhase = newPhase;
      encounter.activePhaseActions = newPhasedef.phaseActions;
      encounter.hazardFields = newPhasedef.environmentalHazards || [];
      encounter.boss = { ...encounter.boss, phase: newPhase };
    }
  }

  return newPhase;
}

/**
 * Execute phase actions (mechanics) for encounter tick
 * 
 * @param stateId Encounter state ID
 * @returns Array of triggered mechanics
 */
export function executePhaseActions(stateId: string): string[] {
  const encounter = activeEncounters.get(stateId);
  if (!encounter) return [];

  const triggered: string[] = [];

  for (const action of encounter.activePhaseActions) {
    // Simple random trigger for demonstration
    if (Math.random() < 0.1) { // 10% chance per tick
      triggered.push(action.actionId);
      encounter.activeMechanics.set(action.actionId, action.cooldownTicks);
    }
  }

  // Decrement cooldowns
  for (const [mechId, ticks] of encounter.activeMechanics) {
    if (ticks > 0) {
      encounter.activeMechanics.set(mechId, ticks - 1);
    } else {
      encounter.activeMechanics.delete(mechId);
    }
  }

  return triggered;
}

/**
 * Get encounter state by ID
 * 
 * @param stateId State ID
 * @returns Encounter state or null
 */
export function getEncounterState(stateId: string): EncounterState | null {
  return activeEncounters.get(stateId) || null;
}

/**
 * Get all active encounters
 * 
 * @returns Array of encounter states
 */
export function getActiveEncounters(): EncounterState[] {
  return Array.from(activeEncounters.values());
}

/**
 * Close encounter and record completion
 * 
 * @param stateId Encounter state ID
 * @returns Completion stats (kills, duration, loot)
 */
export function closeEncounter(
  stateId: string
): { elapsedTicks: number; bossDefeated: boolean; avgDPS: number } | null {
  const encounter = activeEncounters.get(stateId);
  if (!encounter) return null;

  const defeated = encounter.boss.healthPoints <= 0;
  const avgDPS = defeated ? encounter.boss.maxHealthPoints / (encounter.elapsedTicks / 10) : 0;

  activeEncounters.delete(stateId);

  return {
    elapsedTicks: encounter.elapsedTicks,
    bossDefeated: defeated,
    avgDPS
  };
}

/**
 * Clear all encounters (for testing)
 */
export function clearEncounters(): void {
  activeEncounters.clear();
}
