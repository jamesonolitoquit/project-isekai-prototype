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
  const temporalDebt = (state.player as any).temporalDebt || 0;
  const soulStrain = (state.player as any).soulStrain || 0; // Phase 13: morphing strain

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
      if (npc && (npc as any).factionId) {
        const factionRep = state.player?.factionReputation?.[(npc as any).factionId] || 0;
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
