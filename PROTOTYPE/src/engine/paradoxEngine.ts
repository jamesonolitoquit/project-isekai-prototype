/**
 * paradoxEngine.ts — Phase 12: The Paradox Engine
 *
 * This is the AI DM's "authority enforcement" layer that translates metagame
 * knowledge (suspicion) and save-scumming (temporal debt) into tangible
 * world consequences.
 *
 * Core Concept: The world "remembers" and "resists" attempts to rewind or
 * exploit metagame knowledge. High Paradox causes:
 * - Unstable obfuscation (wrong truths shown)
 * - Anomalies (NPCs spawn wrong, weather glitches)
 * - Authority interventions (AI DM denies extreme actions)
 * - Temporal debt penalties (world state drift)
 */

import { random } from './prng';

import type { WorldState } from './worldEngine';
import type { Action } from './actionPipeline';
import type { Event } from '../events/mutationLog';

// Helper: Check if item exists in Set or array
function hasItem(container: Set<string> | string[] | undefined, item: string): boolean {
  if (!container) return false;
  if (Array.isArray(container)) return container.includes(item);
  return container.has(item);
}

/**
 * Paradox state tracking
 * Combines suspicion (metagaming detection) and temporal debt (save-scumming)
 * to calculate overall "Chaos" or "Discord" in the world
 */
export interface ParadoxState {
  suspicionLevel: number;      // 0-100: player's metagame knowledge detected
  temporalDebt: number;        // 0-100: accumulated from rewinding/save-scumming
  chaosScore: number;          // 0-100: combined drift calculation
  lastParadoxTick: number;     // when paradox was last evaluated
  anomalyQueue: string[];      // pending world-state mutations
}

/**
 * Calculate total Chaos/Discord in the world
 * Formula: suspicion_level * 0.6 + temporal_debt * 0.4 + soul_strain * 0.3
 * Phase 13: Morphing adds soul strain as "Phased Vessel" factor
 * Higher Chaos = more severe consequences
 */
export function calculateDrift(state: WorldState): number {
  if (!state.player?.beliefLayer) {
    return 0;
  }

  const suspicionLevel = state.player.beliefLayer.suspicionLevel || 0;
  const temporalDebt = state.player.temporalDebt || 0;
  const soulStrain = state.player.soulStrain || 0; // Phase 13: morphing strain

  // Weighted combination:
  // - Detection of metagaming (suspicion) weighted most (0.6)
  // - Pattern of rewinding (temporal debt) secondary (0.4) 
  // - Form instability from morphing (soul strain) tertiary (0.3)
  // A "Phased Vessel" with high strain is less "Canonical" to the world
  const drift = (suspicionLevel * 0.6) + (temporalDebt * 0.4) + (soulStrain * 0.3);

  return Math.min(100, Math.max(0, drift));
}

/**
 * Determine severity of paradox manifestation
 * Returns category for how world responds to high chaos
 */
export function getParadoxSeverity(
  chaosScore: number
): 'stable' | 'unstable' | 'critical' | 'revolt' {
  if (chaosScore >= 90) return 'revolt';      // Extreme: AI DM actively interferes
  if (chaosScore >= 70) return 'critical';    // Severe: major world mutations
  if (chaosScore >= 40) return 'unstable';    // Moderate: minor anomalies
  return 'stable';                            // Low: no paradox effects
}

/**
 * Calculate probability of anomaly manifestation based on chaos
 * Higher chaos = higher chance of glitches
 */
export function getAnomalyProbability(chaosScore: number): number {
  if (chaosScore >= 90) return 0.8;   // 80% chance per tick
  if (chaosScore >= 70) return 0.6;   // 60% chance
  if (chaosScore >= 40) return 0.3;   // 30% chance
  return 0.05;                        // 5% baseline (background chaos)
}

/**
 * Check if AI DM should intervene to deny an action
 * Returns whether action should be blocked and an intervention message
 */
export function validateAuthority(
  action: Action,
  state: WorldState
): { allowed: boolean; interventionText?: string; eventType?: string } {
  const chaosScore = calculateDrift(state);
  const severity = getParadoxSeverity(chaosScore);

  // At critical/revolt levels, AI DM can deny extreme or suspicious actions
  if (severity === 'revolt' || severity === 'critical') {
    // Check for metagame indicators in the action
    const metagameIndicators = detectMetagameAction(action, state);

    if (metagameIndicators.isSuspicious) {
      return {
        allowed: false,
        interventionText: generateInterventionText(metagameIndicators, severity),
        eventType: 'AUTHORITY_INTERVENTION'
      };
    }
  }

  return { allowed: true };
}

/**
 * Detect signs of metagaming in the player's action
 */
export function detectMetagameAction(
  action: Action,
  state: WorldState
): { isSuspicious: boolean; reason?: string; confidence?: number } {
  const knowledgeBase = state.player?.knowledgeBase;
  const beliefLayer = state.player?.beliefLayer;

  switch (action.type) {
    case 'MOVE': {
      const targetLocation = action.payload?.to;
      // Moving to undiscovered location without reason (no quests pointing there)
      if (targetLocation && !hasItem(knowledgeBase, `location:${targetLocation}`)) {
        const hasQuestReason = Object.values(state.player?.quests || {}).some(
          (q: any) => q.objective?.location === targetLocation
        );
        if (!hasQuestReason) {
          return {
            isSuspicious: true,
            reason: 'Moved to unknown location without quest hint',
            confidence: 0.6
          };
        }
      }
      break;
    }

    case 'ATTACK': {
      const targetId = action.payload?.targetId;
      const target = state.npcs.find(n => n.id === targetId);
      // Attacking NPC without prior discovery or faction knowledge
      if (target && !hasItem(knowledgeBase, `npc:${targetId}`)) {
        return {
          isSuspicious: true,
          reason: 'Attacked unknown entity without identification',
          confidence: 0.5
        };
      }
      break;
    }

    case 'CAST_SPELL': {
      // Spell casting suspicion is handled through action validation elsewhere
      break;
    }

    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      const npc = state.npcs.find(n => n.id === npcId);
      // Interacting with NPC at wrong faction level
      if (npc && npc.factionId) {
        const factionRep = state.player?.factionReputation?.[npc.factionId] || 0;
        if (factionRep < -50) {
          // Trying to interact with hostile faction NPC
          return {
            isSuspicious: true,
            reason: 'Attempted interaction with hostile faction member',
            confidence: 0.4
          };
        }
      }
      break;
    }

    default:
      break;
  }

  return { isSuspicious: false };
}

/**
 * Generate AI DM intervention message based on metagame detection
 */
function generateInterventionText(
  indicators: { reason?: string; confidence?: number },
  severity: string
): string {
  const interventions = {
    revolt: [
      "A strange force stops you. Reality itself seems to refuse your action.",
      "The cosmos shudders. 'No,' it whispers. 'That path is not yours.'",
      "Your muscles freeze. Something impossibly large watches from beyond.",
      "You feel reality's eye upon you. It is *not* amused."
    ],
    critical: [
      "A moment of terrible clarity: something is profoundly wrong.",
      "The world shudders. The air tastes of copper and paradox.",
      "A voice without sound reverberates through your soul: 'Not yet. Not ever.'",
      "Strange geometries block your way. The world has changed its mind."
    ]
  };

  const messages = interventions[severity as keyof typeof interventions] || interventions.critical;
  return messages[Math.floor(random() * messages.length)];
}

/**
 * Generate anomalies that manifest as world state mutations
 * These are the "glitches" player sees: NPCs in wrong places, weather shifts, etc
 */
export function generateAnomalies(
  chaosScore: number,
  state: WorldState
): Event[] {
  const anomalies: Event[] = [];

  if (random() > getAnomalyProbability(chaosScore)) {
    return anomalies; // No anomaly this tick
  }

  const severity = getParadoxSeverity(chaosScore);

  if (severity === 'stable') {
    // Minimal background chaos - very rare glitches
    if (random() < 0.3) {
      anomalies.push(createEvent(state, 'MINOR_GLITCH', {
        description: 'An unexplained flicker in your perception.',
        type: 'perceptual'
      }));
    }
  } else if (severity === 'unstable') {
    // Moderate anomalies
    const anomalyType = Math.floor(random() * 3);
    if (anomalyType === 0) {
      // NPC location glitch
      anomalies.push(createEvent(state, 'CHAOS_ANOMALY', {
        description: 'An NPC suddenly appears in an unexpected location.',
        type: 'npc_location_drift'
      }));
    } else if (anomalyType === 1) {
      // Weather shift
      anomalies.push(createEvent(state, 'CHAOS_ANOMALY', {
        description: 'The weather shifts unnaturally.',
        type: 'weather_drift'
      }));
    } else {
      // Time glitch
      anomalies.push(createEvent(state, 'CHAOS_ANOMALY', {
        description: 'You lose track of time. A moment felt like an hour.',
        type: 'time_drift'
      }));
    }
  } else if (severity === 'critical') {
    // Severe anomalies
    anomalies.push(createEvent(state, 'UNNAMED_ENTITY_SPAWN', {
      description: 'Something that should not exist manifests for a moment.',
      type: 'entity_glitch',
      temporalCost: 5
    }));
  } else if (severity === 'revolt') {
    // Extreme: the world actively hostile
    anomalies.push(createEvent(state, 'REVOLT_OF_TRUTH', {
      description: 'Reality tears. The world rejects your illicit knowledge.',
      type: 'full_convergence',
      temporalCost: 20,
      consequence: 'OBFUSCATION_INVERSION'  // Inverts what player knows
    }));
  }

  return anomalies;
}

/**
 * Apply temporal penalty when save-scumming detected
 * Returns debt increase amount
 */
export function applyTemporalDebt(
  currentDebt: number,
  previousTick: number,
  currentTick: number,
  previousChaos: number,
  currentChaos: number
): number {
  // Detect rewind: current tick is earlier than previous
  if (currentTick < previousTick) {
    // The player reloaded to an earlier save
    const ticksRewound = previousTick - currentTick;
    const debtIncrease = Math.min(25, ticksRewound * 0.5);  // Max +25 per rewind

    // If chaos was reduced by rewind, add extra debt
    if (currentChaos < previousChaos) {
      const chaosReduction = previousChaos - currentChaos;
      const extraDebt = chaosReduction * 0.3;  // 30% of chaos reduction becomes debt
      return debtIncrease + extraDebt;
    }

    return debtIncrease;
  }

  return 0; // No rewind detected
}

/**
 * SPELL_BACKFIRE event: high chaos causes magic to fail catastrophically
 */
export function checkForSpellBackfire(
  chaosScore: number
): { backfires: boolean; backfireChance: number; penalty?: number } {
  let backfireChance = 0;

  if (chaosScore >= 90) {
    backfireChance = 0.5;    // 50% chance of backfire
  } else if (chaosScore >= 70) {
    backfireChance = 0.3;    // 30% chance
  } else if (chaosScore >= 40) {
    backfireChance = 0.1;    // 10% chance
  }

  const backfires = random() < backfireChance;

  return {
    backfires,
    backfireChance,
    penalty: backfires ? Math.floor(chaosScore * 0.5) : undefined  // Damage = half chaos score
  };
}

/**
 * Helper: create event for mutation log
 */
function createEvent(
  state: WorldState,
  eventType: string,
  payload: any
): Event {
  const tick = state.tick || 0;
  const randTag = Math.floor(random() * 0xffffff).toString(16);
  return {
    type: eventType,
    id: `${eventType.toLowerCase()}-t${tick}-${randTag}`,
    worldInstanceId: state.id,
    actorId: state.player.id,
    timestamp: tick * 1000,
    payload,
    templateOrigin: 'paradox-engine'  // AI-generated, not player action
  };
}

/**
 * GHOST_TICK event: time skips forward due to paradox
 * The world "corrects" itself by skipping ahead
 */
export function generateGhostTick(
  chaosScore: number,
  state: WorldState
): Event | null {
  // Only at extreme chaos levels
  if (chaosScore < 80) {
    return null;
  }

  const ticksToSkip = 1 + Math.floor(random() * 3);  // Skip 1-3 ticks

  return createEvent(state, 'GHOST_TICK', {
    description: `Time skips forward ${ticksToSkip} hours due to temporal instability.`,
    ticksSkipped: ticksToSkip,
    temporalCost: ticksToSkip * 2
  });
}

/**
 * Check if paradox has reached critical threshold requiring world-state intervention
 */
export function shouldTriggerParadoxCrisis(chaosScore: number): boolean {
  // At 85+, world actively intervenes
  return chaosScore >= 85;
}

/**
 * Apply OBFUSCATION_INVERSION at high chaos
 * This flips what's true: identifies become unidentifies, friendly becomes hostile
 */
export function getObfuscationInversion(
  chaosScore: number
): { inverted: boolean; severity: number } {
  if (chaosScore >= 90) {
    return { inverted: true, severity: 1.0 };  // Full inversion
  }
  if (chaosScore >= 75) {
    return { inverted: true, severity: 0.7 };  // Partial inversion
  }
  if (chaosScore >= 50) {
    return { inverted: false, severity: 0.3 }; // Unstable but not inverted
  }

  return { inverted: false, severity: 0 };
}

/**
 * Calculate obfuscation disruption effect
 * Shows "wrong" truth to exploit/punish metagaming
 */
export function calculateObfuscationDisruption(
  npcId: string,
  chaosScore: number,
  state: WorldState
): { disrupted: boolean; wrongInfo?: string } {
  if (chaosScore < 40) {
    return { disrupted: false };
  }

  const npc = state.npcs.find(n => n.id === npcId);
  if (!npc) {
    return { disrupted: false };
  }

  const disruptionChance = chaosScore / 100;
  if (random() > disruptionChance) {
    return { disrupted: false };
  }

  // Generate wrong information
  const wrongInfoTemplates = [
    `${npc.name}'s HP appears to be ${Math.floor(random() * 100)}%`,
    `${npc.name} seems to be in ${state.locations[Math.floor(random() * state.locations.length)]?.name || 'unknown'}`,
    `${npc.name} feels ${['hostile', 'friendly', 'afraid', 'angry'][Math.floor(random() * 4)]} towards you`
  ];

  return {
    disrupted: true,
    wrongInfo: wrongInfoTemplates[Math.floor(random() * wrongInfoTemplates.length)]
  };
}

/**
 * M30 Task 6: Temporal Debt & Paradox Resolution
 * Calculate "Age Rot" effect: high temporal debt causes blighting during epoch transitions
 */
export function calculateAgeRot(temporalDebt: number): {
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  blightPercent: number;
  enemyDifficultyBonus: number;
  description: string;
} {
  // Age Rot scales linearly with temporal debt (0-100)
  if (temporalDebt < 20) {
    return {
      severity: 'none',
      blightPercent: 0,
      enemyDifficultyBonus: 0,
      description: 'The timeline flows naturally. No temporal damage detected.'
    };
  }

  if (temporalDebt < 40) {
    return {
      severity: 'mild',
      blightPercent: 15,
      enemyDifficultyBonus: 0.1, // +10% enemy difficulty
      description: 'Minor temporal distortions. A few areas show signs of age rot.'
    };
  }

  if (temporalDebt < 70) {
    return {
      severity: 'moderate',
      blightPercent: 35,
      enemyDifficultyBonus: 0.25, // +25% enemy difficulty
      description: 'Significant temporal decay. Many regions corrupted by time rifts.'
    };
  }

  return {
    severity: 'severe',
    blightPercent: 60,
    enemyDifficultyBonus: 0.5, // +50% enemy difficulty
    description: 'Catastrophic temporal damage. Reality fractures. The world itself is dying.'
  };
}

/**
 * Apply Age Rot effects to biome data during epoch transition
 * Blights X% of biomes and increases enemy spawns
 */
export function applyAgeRotToEpoch(
  nextEpochLocations: any[], // Location[]
  ageRotSeverity: ReturnType<typeof calculateAgeRot>
): any[] {
  if (ageRotSeverity.severity === 'none') {
    return nextEpochLocations;
  }

  const { SeededRng } = require('./prng');

  // Calculate which locations get blighted
  const blightCount = Math.ceil(nextEpochLocations.length * (ageRotSeverity.blightPercent / 100));
  const indicesToBlight = new Set<number>();

  // Randomly select locations to blight
  const rng = new SeededRng(Math.floor(random() * 1000000));
  while (indicesToBlight.size < blightCount) {
    indicesToBlight.add(rng.nextInt(0, nextEpochLocations.length - 1));
  }

  // Apply blight effects
  return nextEpochLocations.map((location, idx) => {
    if (indicesToBlight.has(idx)) {
      return {
        ...location,
        biome: 'blighted_wasteland',
        description: `${location.description} (corrupted by temporal decay)`,
        _corruptionLevel: 100,
        _blightedByAgeRot: true,
        environmentalEffects: [
          ...(location.environmentalEffects || []),
          'temporal_distortion',
          'reality_fractures',
          'age-accelerated creatures'
        ]
      };
    }
    return location;
  });
}

/**
 * Calculate enemy spawn difficulty modifier based on age rot
 * Higher difficulty = stronger enemies, more spawns
 */
export function getAgeRotEnemyModifier(temporalDebt: number): {
  spawnRateMultiplier: number;
  levelBonus: number;
  statMultiplier: number;
  statusEffectChance: number;
} {
  const ageRot = calculateAgeRot(temporalDebt);
  const baseBonus = ageRot.enemyDifficultyBonus;

  return {
    spawnRateMultiplier: 1 + baseBonus * 0.5, // Up to +25% spawn rate
    levelBonus: Math.floor(baseBonus * 10), // Up to +5 levels
    statMultiplier: 1 + baseBonus, // Up to +50% stats
    statusEffectChance: baseBonus * 0.6 // Up to 30% chance for status effects
  };
}

/**
 * Generate "Age Rot Anomalies" - temporal paradoxes that manifest as special encounters
 */
export function generateAgeRotAnomalies(
  temporalDebt: number,
  maxAnomalies: number = 3
): Array<{
  id: string;
  name: string;
  description: string;
  location: string;
  threat: 'minor' | 'moderate' | 'severe';
  reward: Record<string, number>;
}> {
  if (temporalDebt < 40) {
    return []; // Must have moderate age rot
  }

  const { SeededRng } = require('./prng');
  const rng = new SeededRng(temporalDebt + Date.now());

  const anomalyTypes = [
    {
      name: 'Temporal Echo',
      description: 'A ghostly version of yourself from a failed timeline.',
      threat: 'moderate' as const,
      reward: { experience: 300, items: ['temporal_shard'] }
    },
    {
      name: 'Age-Accelerated Beast',
      description: 'A creature aged to impossible maturity by time rifts.',
      threat: 'severe' as const,
      reward: { experience: 500, items: ['ancient_fang'] }
    },
    {
      name: 'Fractured Memory',
      description: 'A manifestation of your own forgotten past.',
      threat: 'minor' as const,
      reward: { experience: 150, insight: 1 }
    },
    {
      name: 'Causality Breach',
      description: 'An impossible event that defies the laws of time.',
      threat: 'severe' as const,
      reward: { experience: 600, paradoxResolution: 10 }
    }
  ];

  const selectedCount = Math.min(maxAnomalies, Math.floor(temporalDebt / 30));
  const anomalies = [];

  for (let i = 0; i < selectedCount; i++) {
    const anomalyType = anomalyTypes[rng.nextInt(0, anomalyTypes.length - 1)];
    anomalies.push({
      id: `age_rot_anomaly_${i}_${temporalDebt}`,
      name: anomalyType.name,
      description: anomalyType.description,
      location: `Temporal Convergence ${i + 1}`,
      threat: anomalyType.threat,
      reward: anomalyType.reward
    });
  }

  return anomalies;
}

/**
 * Check if temporal debt warrants a "Debt Collector" NPC encounter
 * At very high temporal debt, a mysterious figure appears to demand "payment"
 */
export function shouldSpawnDebtCollector(temporalDebt: number): boolean {
  return temporalDebt >= 80 && random() < (temporalDebt - 80) / 20; // ~10-100% chance at 80-100
}

/**
 * Create the Debt Collector NPC
 */
export function createDebtCollectorNpc(temporalDebt: number) {
  return {
    id: 'npc_debt_collector',
    name: 'The Chronometer',
    title: 'Collector of Temporal Debts',
    description: 'A figure cloaked in shadow and starlight, tracking the cost of meddling with time.',
    level: 25 + Math.floor(temporalDebt / 4),
    stats: {
      str: 14,
      agi: 12,
      int: 20, // High intellect for time manipulation
      cha: 18, // Charismatic but threatening
      end: 16,
      luk: 8
    },
    factionId: 'faction_temporal',
    dialogue: [
      `Your debt has grown too large. Time demands payment.`,
      `Every moment you rewound costs the world. Now I collect.`,
      `Reality remembers. And I am Reality\'s creditor.`,
      `The price of running the clock backward is finally due.`
    ],
    _isTimeAnomalies: true,
    _temporalDebtTarget: temporalDebt,
    quests: [{
      id: 'settle_temporal_debt',
      title: 'Settle Your Temporal Debt',
      description: `Defeat The Chronometer or pay ${temporalDebt * 10} gold to settle your debt with time itself.`
    }]
  };
}

/**
 * Phase 17, Task 4: Temporal Anomaly Generation
 * 
 * When generationalParadox > 200, manifest "Historical Glitches"—
 * NPCs from previous generations appearing as ghosts, or locations temporarily
 * reverting to their "Epoch I" biome state.
 */

export interface TemporalAnomaly {
  anomalyId: string;
  anomalyType: 'npc_ghost' | 'location_glitch' | 'time_reversal' | 'paradox_storm';
  description: string;
  affectedEntity: string;       // NPC ID or Location ID
  originalState: any;           // What it used to be
  ghostState: any;              // What it appears as (ghost)
  severity: number;             // 1-10
  duration: number;             // Ticks the anomaly persists
  generationalParadox: number;  // Paradox level that triggered it
}

/**
 * Apply temporal anomalies based on paradox accumulation
 */
export function applyTemporalAnomalies(
  state: WorldState,
  generationalParadox: number = 0
): TemporalAnomaly[] {
  const anomalies: TemporalAnomaly[] = [];

  // Threshold: > 200 generational paradox triggers anomalies
  if (generationalParadox <= 200) {
    return anomalies;
  }

  const anomalyStrength = Math.floor((generationalParadox - 200) / 50); // Scales with excess paradox
  const baseProbability = Math.min(0.1 * anomalyStrength, 0.8); // 0-80% chance

  // Manifest NPC ghosts from previous generations
  if (state.npcs && Math.random() < baseProbability) {
    const victimNpc = state.npcs[Math.floor(Math.random() * state.npcs.length)];
    if (victimNpc && victimNpc.hp && victimNpc.hp <= 0) {
      const anomaly: TemporalAnomaly = {
        anomalyId: `temporal-npc-${victimNpc.id}-${Date.now()}`,
        anomalyType: 'npc_ghost',
        description: `${victimNpc.name} appears as a ghostly echo from a previous generation`,
        affectedEntity: victimNpc.id,
        originalState: { hp: 0, alive: false },
        ghostState: {
          hp: Math.floor(victimNpc.maxHp || 100 * 0.3), // Appear at 30% health
          isGhost: true,
          transparency: 0.5,
          cannotInteract: true,
          vanishesAt: Math.floor(Math.random() * 200) + 100 // Ticks
        },
        severity: Math.min(anomalyStrength, 10),
        duration: Math.floor(Math.random() * 300) + 200,
        generationalParadox
      };

      anomalies.push(anomaly);

      // Add ghost to world temporarily
      if (!state.npcs.find(n => n.id === victimNpc.id + '_ghost')) {
        state.npcs.push({
          ...victimNpc,
          id: victimNpc.id + '_ghost',
          name: `Ghost of ${victimNpc.name}`,
          isGhost: true,
          hp: anomaly.ghostState.hp,
          _temporalAnomaly: true,
          _anomalyDuration: anomaly.duration
        });
      }
    }
  }

  // Create location biome glitches (revert to Epoch I state)
  if (state.locations && Math.random() < baseProbability * 0.7) {
    const glitchLocation = state.locations[Math.floor(Math.random() * state.locations.length)];
    if (glitchLocation) {
      const originalBiome = glitchLocation.biome || 'unknown';

      const anomaly: TemporalAnomaly = {
        anomalyId: `temporal-loc-${glitchLocation.id}-${Date.now()}`,
        anomalyType: 'location_glitch',
        description: `${glitchLocation.name} flickers between biomes as time becomes unstable`,
        affectedEntity: glitchLocation.id,
        originalState: { biome: originalBiome, discovered: glitchLocation.discovered },
        ghostState: {
          biome: 'corrupted', // Epoch I default or corrupted
          flickeringBiome: true,
          temporalDistortion: true,
          navigationHazard: Math.random() < 0.3
        },
        severity: Math.min(anomalyStrength + 2, 10),
        duration: Math.floor(Math.random() * 250) + 150,
        generationalParadox
      };

      anomalies.push(anomaly);

      // Temporarily change biome
      glitchLocation._temporalGlitch = true;
      glitchLocation._glitchBiome = anomaly.ghostState.biome;
      glitchLocation._glitchDuration = anomaly.duration;
      glitchLocation.biome = anomaly.ghostState.biome;
    }
  }

  // Paradox storms - massive reality distortions
  if (generationalParadox > 350 && Math.random() < (baseProbability * 0.4)) {
    const affectedLocations = state.locations ? state.locations.length : 0;

    const anomaly: TemporalAnomaly = {
      anomalyId: `temporal-storm-${Date.now()}`,
      anomalyType: 'paradox_storm',
      description: 'A paradox storm sweeps across the world, corrupting time and space',
      affectedEntity: 'world_global',
      originalState: { factionPowers: (state.factions || []).map(f => ({ id: f.id, power: f.powerScore })) },
      ghostState: {
        allLocationsAffected: affectedLocations,
        powerRandomization: true,
        npcCollocationAnomaly: true,
        itemDuplication: Math.random() < 0.3,
        factionPowerFlux: Math.floor(Math.random() * 30) - 15 // ±15 power
      },
      severity: Math.floor(Math.min((generationalParadox - 350) / 50, 10)),
      duration: Math.floor(Math.random() * 400) + 300,
      generationalParadox
    };

    anomalies.push(anomaly);

    // Apply faction power flux
    if (state.factions) {
      state.factions.forEach(faction => {
        const flux = anomaly.ghostState.factionPowerFlux as number;
        faction.powerScore = Math.max(1, (faction.powerScore || 50) + flux);
      });
    }
  }

  // Record anomalies in events
  if (anomalies.length > 0) {
    if (!state.metadata) state.metadata = {};
    state.metadata._recordedTemporalAnomalies = (state.metadata._recordedTemporalAnomalies || 0) + anomalies.length;
  }

  return anomalies;
}

/**
 * Clean up expired temporal anomalies from world state
 */
export function cleanExpiredAnomalies(state: WorldState, ticksElapsed: number = 1): void {
  if (state.npcs) {
    state.npcs = state.npcs.filter(npc => {
      if (npc._temporalAnomaly && npc._anomalyDuration) {
        npc._anomalyDuration -= ticksElapsed;
        return npc._anomalyDuration > 0;
      }
      return true;
    });
  }

  if (state.locations) {
    state.locations.forEach(loc => {
      if (loc._temporalGlitch && loc._glitchDuration) {
        loc._glitchDuration -= ticksElapsed;
        if ((loc._glitchDuration as number) <= 0) {
          // Restore original biome
          loc.biome = (loc as any)._originalBiome || 'plains';
          loc._temporalGlitch = false;
          loc._glitchBiome = undefined;
          loc._glitchDuration = undefined;
        }
      }
    });
  }
}
/**
 * Phase 18 Task 4: Sentinel of Time NPC - spawned when paradox > 200
 * Offers quest to stabilize timeline by pruning corrupted branches
 */
export interface SentinelOfTime {
  id: string;
  name: string;
  faction: 'Neutral';
  maxHp: number;
  hp: number;
  stats: {
    str: number;
    agi: number;
    int: number;
    cha: number;
    end: number;
  };
  knownAbilities: string[];     // TIMELINE_PRUNE, PARADOX_DRAIN
  location: string;
  questOffer: string;
  isTemporalSentinel: boolean;
  generationalParadoxTrigger: number;
}

/**
 * Phase 18 Task 4: Create Sentinel of Time NPC template
 */
export function createSentinelOfTime(locationId: string, generationalParadox: number): SentinelOfTime {
  return {
    id: `sentinel-${locationId}-${Date.now()}`,
    name: 'Sentinel of Time',
    faction: 'Neutral',
    maxHp: 150,
    hp: 150,
    stats: {
      str: 12,
      agi: 18,
      int: 20,
      cha: 16,
      end: 14
    },
    knownAbilities: ['TIMELINE_PRUNE', 'PARADOX_DRAIN'],
    location: locationId,
    questOffer: 'Prune a corrupted timeline branch (select from BranchingTimeline UI)',
    isTemporalSentinel: true,
    generationalParadoxTrigger: generationalParadox
  };
}

/**
 * Phase 18 Task 4: Check if Sentinel should appear at a location
 * Returns true if paradox > 200 and needs manifestation
 */
export function shouldSpawnSentinel(state: WorldState, generationalParadox: number): boolean {
  return generationalParadox > 200 && 
         !state.npcs?.some(n => (n as any).isTemporalSentinel === true);
}

/**
 * Phase 18 Task 4: Manifest Sentinel of Time in world
 * Should be called during location entry or anomaly spawning
 */
export function manifestSentinelOfTime(
  state: WorldState,
  currentLocationId: string,
  generationalParadox: number
): SentinelOfTime | null {
  if (!shouldSpawnSentinel(state, generationalParadox)) {
    return null;
  }

  const sentinel = createSentinelOfTime(currentLocationId, generationalParadox);

  // Add to world NPCs
  if (!state.npcs) {
    state.npcs = [];
  }
  state.npcs.push(sentinel as any);

  // Record event
  if (!state.metadata) {
    state.metadata = {};
  }
  if (state.metadata._temporalAnomalies) {
    state.metadata._temporalAnomalies.sentinelAppearances = 
      (state.metadata._temporalAnomalies.sentinelAppearances || 0) + 1;
  }

  return sentinel;
}

/**
 * Phase 18 Task 4: Process timeline prune quest reward
 * Player selects divergence node to collapse
 */
export interface TimelinePruneReward {
  legacyPointsRecovered: number;      // 50-100
  branchesCollapsed: number;  
  generationalParadoxReduction: number;  // -20 to -40
  description: string;
}

/**
 * Phase 18 Task 4: Complete timeline prune quest
 * Player collapses corrupted timeline branch
 */
export function completeTimelinePrune(
  state: WorldState,
  collapsedNodeId: string,
  branchDepth: number = 1
): TimelinePruneReward {
  const legacyPointsRecovered = 50 + Math.floor(Math.random() * 50);
  const paradoxReduction = Math.min(40, 20 + (branchDepth * 5));
  const branchesCollapsed = 2 + branchDepth;

  const reward: TimelinePruneReward = {
    legacyPointsRecovered,
    branchesCollapsed,
    generationalParadoxReduction: -paradoxReduction,
    description: `Successfully pruned ${branchesCollapsed} corrupted timeline branches, recovered ${legacyPointsRecovered} Legacy Points`
  };

  // Apply paradox reduction
  if (state.metadata) {
    state.metadata.generationalParadox = Math.max(
      0,
      (state.metadata.generationalParadox || 0) - paradoxReduction
    );
  }

  // Mark node as collapsed
  if (!state.metadata) {
    state.metadata = {};
  }
  if (!state.metadata._prunedBranches) {
    state.metadata._prunedBranches = [];
  }
  (state.metadata._prunedBranches as string[]).push(collapsedNodeId);

  return reward;
}

/**
 * Phase 18 Task 4: Get Sentinel encounter text
 */
export function getSentinelEncounterText(generationalParadox: number): string {
  const severity = generationalParadox > 350 ? 'critical' : 'severe';
  return `A shimmering figure materializes before you... "The timeline is fracturing. I am the Sentinel of Time. ${severity === 'critical' ? 'Reality itself trembles.' : 'The damage is still contained.'} Will you help me prune the corrupted branches?"`;
}

/**
 * ============================================================================
 * PHASE 27 TASK 1: The Paradox Engine - Age Rot Manifestation
 * ============================================================================
 * Focus: Invariant violations → Paradox Points → Age Rot Anomalies
 */

/**
 * Phase 27 Task 1: Age Rot Anomaly Types
 */
export enum Phase27AgeRotAnomalyType {
  INVERTED_HEALING = 'INVERTED_HEALING',
  IDENTITY_SWAP = 'IDENTITY_SWAP',
  TIME_LOOP = 'TIME_LOOP',
  STAT_INVERSION = 'STAT_INVERSION',
  PROPHECY_BREAK = 'PROPHECY_BREAK',
  LOOT_DUPLICATION = 'LOOT_DUPLICATION',
  NPC_MULTIPLICATION = 'NPC_MULTIPLICATION'
}

/**
 * Phase 27 Task 1: Harvested paradox points from specific violations
 */
export interface ParadoxHarvestResult {
  pointsAdded: number;
  sources: Array<{ reason: string; points: number }>;
  totalPoints: number;
}

/**
 * Phase 27 Task 1: Check for duplicated unique items in player inventory
 * Returns paradox points if violations found
 */
function checkForDuplicatedItems(player: any): { points: number; violations: string[] } {
  const violations: string[] = [];
  let points = 0;

  if (!player.inventory) return { points, violations };

  const seenInstanceIds = new Map<string, number>();

  player.inventory.forEach((item: any) => {
    // Only check unique items (have instanceId)
    if (item.unique && item.instanceId) {
      const count = (seenInstanceIds.get(item.instanceId) ?? 0) + 1;
      seenInstanceIds.set(item.instanceId, count);

      if (count > 1) {
        violations.push(`Duplicate unique item: ${item.name} (instance ${item.instanceId})`);
        points += 50; // Major violation: +50 per duplicate
      }
    }
  });

  return { points, violations };
}

/**
 * Phase 27 Task 1: Check for quest state conflicts
 * Returns paradox points if violations found
 */
function checkForQuestConflicts(player: any): { points: number; violations: string[] } {
  const violations: string[] = [];
  let points = 0;

  if (!player.quests) return { points, violations };

  Object.entries(player.quests).forEach(([questId, questState]: [string, any]) => {
    // Conflict: Quest marked both in_progress and completed
    if (questState.status === 'in_progress' && questState.completedAt) {
      violations.push(`Quest conflict: ${questId} marked both in_progress and completed`);
      points += 20; // Moderate violation: +20
    }

    // Conflict: Quest has contradictory objectives
    if (questState.objectives && Array.isArray(questState.objectives)) {
      const completed = questState.objectives.filter((obj: any) => obj.completed).length;
      if (completed === questState.objectives.length && questState.status !== 'completed') {
        violations.push(`Quest conflict: ${questId} all objectives done but not marked complete`);
        points += 15;
      }
    }
  });

  return { points, violations };
}

/**
 * Phase 27 Task 1: Check for NPC timeline violations
 * Detects if an NPC was in two locations simultaneously
 */
function checkForTimelineViolations(state: WorldState): { points: number; violations: string[] } {
  const violations: string[] = [];
  let points = 0;

  if (!state.npcs) return { points, violations };

  // Build NPC location history from recent events
  const recentEvents = (state as any)._recentEvents ?? [];
  const npcLocationUpdates = new Map<string, Array<{ tick: number; locationId: string }>>();

  recentEvents.forEach((evt: any) => {
    if (evt.type === 'NPC_LOCATION_CHANGED') {
      const npcId = evt.payload?.npcId;
      if (npcId) {
        if (!npcLocationUpdates.has(npcId)) {
          npcLocationUpdates.set(npcId, []);
        }
        npcLocationUpdates.get(npcId)?.push({
          tick: evt.payload?.tick ?? 0,
          locationId: evt.payload?.to ?? ''
        });
      }
    }
  });

  // Check for overlapping location updates at same tick
  npcLocationUpdates.forEach((updates, npcId) => {
    const tickToLocations = new Map<number, string[]>();
    updates.forEach(update => {
      if (!tickToLocations.has(update.tick)) {
        tickToLocations.set(update.tick, []);
      }
      tickToLocations.get(update.tick)?.push(update.locationId);
    });

    tickToLocations.forEach((locations, tick) => {
      if (locations.length > 1 && new Set(locations).size > 1) {
        violations.push(`NPC ${npcId} reported at multiple locations in same tick`);
        points += 30; // Severe violation: +30
      }
    });
  });

  return { points, violations };
}

/**
 * Phase 27 Task 1: Harvest paradox points from invariant violations
 * Call every 100 ticks from advanceTick()
 */
export function harvestPhase27ParadoxPoints(
  state: WorldState
): ParadoxHarvestResult {
  const sources: Array<{ reason: string; points: number }> = [];
  let pointsAdded = 0;

  // Check 1: Duplicated unique items
  const duplicationCheck = checkForDuplicatedItems(state.player ?? {});
  if (duplicationCheck.points > 0) {
    sources.push({
      reason: `Item duplication: ${duplicationCheck.violations.join('; ')}`,
      points: duplicationCheck.points
    });
    pointsAdded += duplicationCheck.points;
  }

  // Check 2: Quest state conflicts
  const questCheck = checkForQuestConflicts(state.player ?? {});
  if (questCheck.points > 0) {
    sources.push({
      reason: `Quest conflict: ${questCheck.violations.join('; ')}`,
      points: questCheck.points
    });
    pointsAdded += questCheck.points;
  }

  // Check 3: Timeline violations
  const timelineCheck = checkForTimelineViolations(state);
  if (timelineCheck.points > 0) {
    sources.push({
      reason: `Timeline violation: ${timelineCheck.violations.join('; ')}`,
      points: timelineCheck.points
    });
    pointsAdded += timelineCheck.points;
  }

  // Initialize paradoxState if not present
  if (!state.paradoxState) {
    state.paradoxState = {
      totalParadoxPoints: 0,
      activeAnomalies: new Map(),
      lastManifestationTick: -1000,
      manifestationThreshold: 100,
      paradoxHistory: []
    };
  }

  // Update paradox state
  state.paradoxState.totalParadoxPoints += pointsAdded;
  state.paradoxState.paradoxHistory.push({
    tick: state.tick ?? 0,
    points: state.paradoxState.totalParadoxPoints,
    reason: sources.map(s => s.reason).join(' | ') || 'No violations'
  });

  return {
    pointsAdded,
    sources,
    totalPoints: state.paradoxState.totalParadoxPoints
  };
}

/**
 * Phase 27 Task 1: Determine if we should manifest an anomaly
 * Thresholds: 100, 200, 300...
 */
export function shouldManifestPhase27Anomaly(state: WorldState): boolean {
  if (!state.paradoxState) return false;
  if (state.paradoxState.totalParadoxPoints < 100) return false;

  // Check if we've crossed a new 100-point threshold
  const currentThreshold = Math.floor(state.paradoxState.totalParadoxPoints / 100) * 100;
  const manifestationThreshold = state.paradoxState.manifestationThreshold;

  return currentThreshold > manifestationThreshold;
}

/**
 * Phase 27 Task 1: Select a random anomaly type
 */
function selectPhase27AnomalyType(): Phase27AgeRotAnomalyType {
  const types = Object.values(Phase27AgeRotAnomalyType);
  return types[Math.floor(random() * types.length)];
}

/**
 * Phase 27 Task 1: Generate anomaly narrative based on type
 */
function generatePhase27AnomalyNarrative(type: Phase27AgeRotAnomalyType): string {
  switch (type) {
    case Phase27AgeRotAnomalyType.INVERTED_HEALING:
      return 'Healing energies twist inward. Mending becomes wounding.';
    case Phase27AgeRotAnomalyType.IDENTITY_SWAP:
      return 'Souls become untethered. Identities shift like sand.';
    case Phase27AgeRotAnomalyType.TIME_LOOP:
      return 'Time spirals. The last hour repeats endlessly.';
    case Phase27AgeRotAnomalyType.STAT_INVERSION:
      return 'Causality inverts. All damage rebounds upon the caster.';
    case Phase27AgeRotAnomalyType.PROPHECY_BREAK:
      return 'Fate fractures. Contradictions become manifest.';
    case Phase27AgeRotAnomalyType.LOOT_DUPLICATION:
      return 'Greed manifests. Dropped items stack infinitely.';
    case Phase27AgeRotAnomalyType.NPC_MULTIPLICATION:
      return 'Identities multiply. Each NPC spawns duplicates hourly.';
    default:
      return 'Reality wavers at the edges.';
  }
}

/**
 * Phase 27 Task 1: Trigger Age Rot Anomaly when paradox points reach threshold
 */
export interface Phase27AgeRotAnomaly {
  id: string;
  type: Phase27AgeRotAnomalyType;
  locationId: string;
  severity: number;
  createdAtTick: number;
  expiresAtTick: number;
  narrative: string;
  affectedNpcIds: string[];
  playerWarningsIssued: boolean;
}

export function triggerPhase27AgeRotAnomaly(
  state: WorldState
): Phase27AgeRotAnomaly | null {
  if (!state.paradoxState) return null;
  if (!state.locations || state.locations.length === 0) return null;

  // Select random location
  const corruptedLocation = state.locations[Math.floor(random() * state.locations.length)];
  if (!corruptedLocation) return null;

  // Select anomaly type
  const anomalyType = selectPhase27AnomalyType();

  // Calculate severity (0-100)
  const severity = Math.min(100, Math.floor((state.paradoxState.totalParadoxPoints / 100) * 30) + 20);

  // Create anomaly object
  const anomaly: Phase27AgeRotAnomaly = {
    id: `phase27_anomaly_${corruptedLocation.id}_${state.tick ?? 0}_${Math.floor(random() * 0xffffff).toString(16)}`,
    type: anomalyType,
    locationId: corruptedLocation.id,
    severity,
    createdAtTick: state.tick ?? 0,
    expiresAtTick: (state.tick ?? 0) + 1000, // ~15-20 minutes game time
    narrative: generatePhase27AnomalyNarrative(anomalyType),
    affectedNpcIds: (state.npcs ?? [])
      .filter(n => n.locationId === corruptedLocation.id)
      .map(n => n.id),
    playerWarningsIssued: false
  };

  // Add paradox scar to location
  if (!corruptedLocation.activeScars) {
    corruptedLocation.activeScars = [];
  }
  corruptedLocation.activeScars.push(anomaly.id);

  // Update paradox state
  state.paradoxState.activeAnomalies.set(anomaly.id, anomaly as any);
  state.paradoxState.lastManifestationTick = state.tick ?? 0;
  state.paradoxState.manifestationThreshold = Math.floor((state.paradoxState.totalParadoxPoints / 100) + 1) * 100;

  return anomaly;
}

/**
 * Phase 27 Task 1: Get active anomaly at a specific location
 */
export function getPhase27AnomalyAtLocation(
  state: WorldState,
  locationId: string
): Phase27AgeRotAnomaly | undefined {
  if (!state.paradoxState) return undefined;

  for (const anomaly of state.paradoxState.activeAnomalies.values()) {
    if ((anomaly as any).locationId === locationId) {
      return anomaly as Phase27AgeRotAnomaly;
    }
  }

  return undefined;
}

/**
 * Phase 27 Task 1: Check if player is in an anomaly zone
 */
export function isPlayerInPhase27AnomalyZone(state: WorldState): Phase27AgeRotAnomaly | undefined {
  const playerLocationId = state.player?.location;
  if (!playerLocationId) return undefined;

  return getPhase27AnomalyAtLocation(state, playerLocationId);
}

/**
 * Phase 27 Task 1: Get summary of all active paradoxes
 */
export function getPhase27ParadoxSummary(state: WorldState): {
  totalPoints: number;
  activeAnomalies: number;
  locations: string[];
  severity: number;
} {
  if (!state.paradoxState) {
    return { totalPoints: 0, activeAnomalies: 0, locations: [], severity: 0 };
  }

  const locations = Array.from(state.paradoxState.activeAnomalies.values()).map((a: any) => a.locationId);
  const severity =
    Array.from(state.paradoxState.activeAnomalies.values()).reduce((sum, a: any) => sum + a.severity, 0) /
      Math.max(1, state.paradoxState.activeAnomalies.size) || 0;

  return {
    totalPoints: state.paradoxState.totalParadoxPoints,
    activeAnomalies: state.paradoxState.activeAnomalies.size,
    locations: [...new Set(locations)],
    severity: Math.floor(severity)
  };
}

/**
 * Phase 29 Task 2: Reduce paradox points (Time Repair mechanics)
 * Called when "Time Repair" quests are completed successfully
 */
export function reduceParadoxPoints(
  state: WorldState,
  amount: number,
  reason: string
): {
  pointsReduced: number;
  newTotal: number;
  anomaliesDecayed: number;
  description: string;
} {
  if (!state.paradoxState) {
    state.paradoxState = {
      totalParadoxPoints: 0,
      activeAnomalies: new Map(),
      lastManifestationTick: -1000,
      manifestationThreshold: 100,
      paradoxHistory: []
    };
  }

  const oldTotal = state.paradoxState.totalParadoxPoints;
  const reduction = Math.min(amount, oldTotal); // Can't reduce below 0
  state.paradoxState.totalParadoxPoints = Math.max(0, oldTotal - reduction);

  // Record in paradox history
  state.paradoxState.paradoxHistory.push({
    tick: state.tick ?? 0,
    points: state.paradoxState.totalParadoxPoints,
    reason: `Time Repair: ${reason} (-${reduction} points)`
  });

  // When paradox points reduced significantly, potentially decay anomalies
  const anomaliesDecayed = decayMinorAnomalies(state);

  return {
    pointsReduced: reduction,
    newTotal: state.paradoxState.totalParadoxPoints,
    anomaliesDecayed,
    description: `Paradox reduced by ${reduction} (${oldTotal} → ${state.paradoxState.totalParadoxPoints}). ${anomaliesDecayed} anomalies decayed.`
  };
}

/**
 * Phase 29 Task 2: Decay minor anomalies over time
 * If paradoxLevel < 25 for extended period (500+ ticks tracking), minor anomalies fade
 */
export function decayMinorAnomalies(state: WorldState): number {
  if (!state.paradoxState || !state.paradoxState.activeAnomalies || state.paradoxState.activeAnomalies.size === 0) {
    return 0;
  }

  const currentTick = state.tick ?? 0;
  const currentParadoxLevel = calculateDrift(state);
  let anomaliesDecayed = 0;

  // Only decay if paradox is low enough
  if (currentParadoxLevel > 25) {
    return 0; // No decay if paradox is still significant
  }

  // Track how long paradox has been low (in state.paradoxState metadata)
  if (!state.paradoxState.lowParadoxStartTick) {
    state.paradoxState.lowParadoxStartTick = currentTick;
    return 0; // Just started tracking low paradox, don't decay yet
  }

  const ticksAtLowParadox = currentTick - (state.paradoxState.lowParadoxStartTick ?? 0);

  // After 500 ticks of low paradox, start decaying minor anomalies
  if (ticksAtLowParadox < 500) {
    return 0;
  }

  // Calculate decay: 5% chance per tick after 500-tick threshold for minor anomalies (severity < 50)
  const decayChance = 0.05; // 5% per tick
  const anomaliesArray = Array.from(state.paradoxState.activeAnomalies.entries());

  for (const [anomalyId, anomaly] of anomaliesArray) {
    const anom = anomaly as any;
    
    // Only decay minor anomalies (severity < 50)
    if (anom.severity && anom.severity < 50) {
      if (Math.random() < decayChance) {
        // Remove this minor anomaly
        state.paradoxState.activeAnomalies.delete(anomalyId);
        anomaliesDecayed++;
      }
    }
  }

  return anomaliesDecayed;
}

/**
 * Phase 29 Task 2: Reset low paradox tracking when paradox becomes high again
 */
export function resetLowParadoxTracking(state: WorldState): void {
  if (!state.paradoxState) return;

  const currentParadoxLevel = calculateDrift(state);
  
  // If paradox has increased above 25, reset the low paradox tracking
  if (currentParadoxLevel > 25) {
    state.paradoxState.lowParadoxStartTick = undefined;
  }
}
