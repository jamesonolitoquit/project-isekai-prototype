/**
 * personalityEngine.ts — NPC Personality Evaluation System (M43 Task A.1)
 * 
 * PURPOSE: Replace hardcoded NPC responses with personality-driven AI decisions
 * based on a four-dimensional personality vector model.
 * 
 * PERSONALITY DIMENSIONS:
 * - Compassion [0-1]: How much NPC cares about others (higher → helps player more)
 * - Ambition [0-1]: Drive to gain power/resources (higher → bids higher, seeks advantage)
 * - Prudence [0-1]: Risk aversion (higher → avoids dangers, questions authority)
 * - Mystique [0-1]: Faith in magic/paradoxes (higher → believes weird explanations)
 * 
 * DETERMINISM: All personality evaluations use SeededRng for replay-safe decisions
 * PERFORMANCE: All calculations complete in <5ms per request
 */

import type { NPC, WorldState, PlayerState } from './worldEngine';
import { SeededRng, seededNow } from './prng';
import { getNpcMemoryEngine } from './npcMemoryEngine';

// ============================================================================
// PERSONALITY VECTOR SYSTEM
// ============================================================================

export interface PersonalityVector {
  compassion: number;   // [0-1] Care for others
  ambition: number;     // [0-1] Drive for power/resources
  prudence: number;     // [0-1] Risk aversion
  mystique: number;     // [0-1] Belief in magic/paradox
}

export interface PersonalityHistory {
  timestamp: number;    // worldTick * 10 (seededNow format)
  tick: number;
  previousVector: PersonalityVector;
  newVector: PersonalityVector;
  trigger: 'paradox_detected' | 'director_override' | 'success' | 'ambient_drift' | 'faction_event';
  reason: string;
}

/**
 * Extended NPC type with personality tracking
 * Augments the existing NPC type with personality system fields
 */
export interface NpcWithPersonalityState extends NPC {
  personalityVector?: PersonalityVector;
  personalityHistory?: PersonalityHistory[];
  currentPersonalitySeed?: number; // Seeded based on npcId + worldSeed
}

// ============================================================================
// PERSONALITY INITIALIZATION
// ============================================================================

/**
 * Initialize or retrieve NPC personality vector
 * Seeds from bloodline data when available, uses fallback defaults otherwise
 * 
 * DETERMINISM: Same NPC with same playerBloodlineData will always produce same vector
 */
export function initializePersonality(
  npc: NpcWithPersonalityState,
  playerBloodlineData?: any,
  worldSeed?: number
): PersonalityVector {
  // Check if already initialized
  if (npc.personalityVector) {
    return npc.personalityVector;
  }

  // Create seeded RNG for this NPC's personality derivation
  const npcSeed = worldSeed 
    ? hashCombine(worldSeed, hashString(npc.id))
    : hashString(npc.id);
  const rng = new SeededRng(npcSeed);
  npc.currentPersonalitySeed = npcSeed;

  // Seed from bloodline data if available
  if (playerBloodlineData && typeof playerBloodlineData === 'object') {
    const mythStatus = playerBloodlineData.mythStatus ?? 0;  // 0-100
    const epochsLived = playerBloodlineData.epochsLived ?? 0;

    // Myth status influences NPC respect (compassion/ambition)
    const legacyMod = mythStatus / 100;

    // Epochs lived increase mystique (believe in reincarnation/magic)
    const epochMod = Math.min(epochsLived / 10, 1);

    npc.personalityVector = {
      compassion: clamp(rng.nextFloat(0.3, 0.7) + legacyMod * 0.2),
      ambition: clamp(rng.nextFloat(0.4, 0.8) - legacyMod * 0.1),
      prudence: clamp(rng.nextFloat(0.5, 0.9) - legacyMod * 0.15),
      mystique: clamp(rng.nextFloat(0.3, 0.7) + epochMod * 0.3),
    };
  } else {
    // Fallback: all random, seeded by NPC id
    npc.personalityVector = {
      compassion: clamp(rng.nextFloat(0.2, 0.8)),
      ambition: clamp(rng.nextFloat(0.2, 0.8)),
      prudence: clamp(rng.nextFloat(0.2, 0.8)),
      mystique: clamp(rng.nextFloat(0.2, 0.8)),
    };
  }

  // Initialize history tracking
  npc.personalityHistory = [];

  return npc.personalityVector;
}

// ============================================================================
// PERSONALITY DRIFT
// ============================================================================

/**
 * Apply personality drift when paradox is detected
 * High mystique NPCs are more likely to accept paradox explanations
 * DETERMINISM: Uses seeded RNG for consistent results on replay
 */
export function driftOnParadox(
  npc: NpcWithPersonalityState,
  worldTick: number,
  severity: 'minor' | 'major' | 'severe'
): void {
  const vector = npc.personalityVector || initializePersonality(npc);
  const driftRng = createDriftRng(npc.currentPersonalitySeed ?? 0, worldTick, 'paradox');
  
  const driftAmount = severity === 'severe' ? 0.15 : severity === 'major' ? 0.10 : 0.05;
  
  const prevVector = { ...vector };
  
  // Paradoxes increase mystique (NPC accepts weird explanations)
  vector.mystique = clamp(vector.mystique + driftAmount);
  
  // High mystique NPCs become less prudent (less planning-focused)
  if (vector.mystique > 0.6) {
    vector.prudence = clamp(vector.prudence - driftAmount * 0.5);
  }

  recordDriftHistory(npc, worldTick, prevVector, vector, 'paradox_detected', 
    `Paradox [${severity}] detected - mystique shifted`);
}

/**
 * Apply personality drift when Director issues override command
 * NPCs become more resistant (increased prudence) or questioning (increased mystique)
 */
export function driftOnDirectorOverride(
  npc: NpcWithPersonalityState,
  worldTick: number,
  overrideType: 'command' | 'force_epoch' | 'seal_canon'
): void {
  const vector = npc.personalityVector || initializePersonality(npc);

  const prevVector = { ...vector };

  // Director overrides increase prudence (NPC questions authority)
  vector.prudence = clamp(vector.prudence + 0.10);

  // Specific override reactions
  if (overrideType === 'force_epoch') {
    // NPCs become more mystical when time is forced forward
    vector.mystique = clamp(vector.mystique + 0.08);
  } else if (overrideType === 'seal_canon') {
    // Canon seals make NPCs question reality
    vector.mystique = clamp(vector.mystique + 0.12);
    vector.prudence = clamp(vector.prudence + 0.05);
  }

  recordDriftHistory(npc, worldTick, prevVector, vector, 'director_override',
    `Director ${overrideType} - prudence increased, mystique drifted`);
}

/**
 * Apply ambient personality drift (slow evolution over time)
 * NPCs gradually develop as they experience the world
 */
export function driftAmbient(
  npc: NpcWithPersonalityState,
  worldTick: number,
  factionInfluence?: number
): void {
  const vector = npc.personalityVector || initializePersonality(npc);
  const driftRng = createDriftRng(npc.currentPersonalitySeed ?? 0, worldTick, 'ambient');

  const prevVector = { ...vector };

  // Small random walk for personality evolution
  const drift = 0.02;
  vector.compassion = clamp(vector.compassion + driftRng.nextFloat(-drift, drift));
  vector.ambition = clamp(vector.ambition + driftRng.nextFloat(-drift, drift));
  vector.prudence = clamp(vector.prudence + driftRng.nextFloat(-drift, drift));
  vector.mystique = clamp(vector.mystique + driftRng.nextFloat(-drift, drift));

  // Faction influence: leaders become more ambitious, soldiers more prudent
  if (factionInfluence !== undefined) {
    if (factionInfluence > 0.5) {
      vector.ambition = clamp(vector.ambition + 0.01);
      vector.compassion = clamp(vector.compassion + 0.01);
    } else if (factionInfluence < -0.5) {
      vector.prudence = clamp(vector.prudence - 0.01);
      vector.ambition = clamp(vector.ambition - 0.01);
    }
  }

  recordDriftHistory(npc, worldTick, prevVector, vector, 'ambient_drift',
    'Ambient personality evolution from experience');
}

/**
 * Apply drift from faction event (war, treaty, etc.)
 */
export function driftOnFactionEvent(
  npc: NpcWithPersonalityState,
  worldTick: number,
  eventType: 'joined_faction' | 'betrayed_faction' | 'defeated_rival'
): void {
  const vector = npc.personalityVector || initializePersonality(npc);
  const prevVector = { ...vector };

  if (eventType === 'joined_faction') {
    // Joining faction increases ambition and mystique (belief in cause)
    vector.ambition = clamp(vector.ambition + 0.08);
    vector.mystique = clamp(vector.mystique + 0.06);
    vector.prudence = clamp(vector.prudence - 0.05);
  } else if (eventType === 'betrayed_faction') {
    // Betrayal increases prudence (cautious about trust) and resentment
    vector.prudence = clamp(vector.prudence + 0.12);
    vector.compassion = clamp(vector.compassion - 0.10);
    vector.ambition = clamp(vector.ambition - 0.05);
  } else if (eventType === 'defeated_rival') {
    // Victory increases ambition and confidence
    vector.ambition = clamp(vector.ambition + 0.10);
    vector.prudence = clamp(vector.prudence - 0.08);
  }

  recordDriftHistory(npc, worldTick, prevVector, vector, 'faction_event',
    `Faction event: ${eventType}`);
}

// ============================================================================
// PERSONALITY IMPACT EVALUATION
// ============================================================================

/**
 * Evaluate NPC's likelihood to cooperate with player
 * Used to determine if NPC will accept quests, trades, etc.
 * 
 * Returns probability [0-1]
 * PERFORMANCE: <2ms
 */
export function evaluateCooperationLikelihood(
  npc: NpcWithPersonalityState,
  playerReputation: number,
  playerMythStatus: number,
  playerId?: string
): number {
  const vector = npc.personalityVector || initializePersonality(npc);
  
  // Base from compassion dimension
  let likelihood = vector.compassion * 0.5;

  // Reputation with NPC (assuming -100 to +100 scale, normalize to 0-1)
  const repBonus = Math.max((playerReputation + 100) / 200, 0) * 0.3;
  likelihood += repBonus;

  // Myth status makes ambitious NPCs more likely to cooperate
  const mythBonus = Math.max(playerMythStatus / 100, 0) * vector.ambition * 0.2;
  likelihood += mythBonus;

  // Very prudent NPCs are skeptical
  const prudencePenalty = vector.prudence * 0.1;
  likelihood -= prudencePenalty;

  // M44 SOCIAL SCAR INTEGRATION
  if (playerId) {
    const memoryEngine = getNpcMemoryEngine();
    const impact = memoryEngine.getMemoryImpactOnDialogue(npc.id, playerId);
    
    // Scars amplify the reaction (Trust increases likelihood, Caution decreases it)
    likelihood += (impact.trustLevel * 0.2);
    likelihood -= (impact.cautionLevel * 0.15);
    likelihood += (impact.sentiment * 0.1);
  }

  return clamp(likelihood);
}

/**
 * Evaluate NPC's risk tolerance for combat/dangerous tasks
 * Higher = more willing to take risks
 * PERFORMANCE: <1ms
 */
export function evaluateRiskTolerance(npc: NpcWithPersonalityState, playerId?: string): number {
  const vector = npc.personalityVector || initializePersonality(npc);

  // Ambition drives risk-taking (want rewards)
  let tolerance = vector.ambition * 0.4;

  // Compassion makes NPCs take risks for others
  tolerance += vector.compassion * 0.3;

  // Prudence is opposite of risk tolerance
  tolerance -= vector.prudence * 0.6;

  // Mystique: weird faith can make them reckless
  tolerance += (vector.mystique > 0.5 ? vector.mystique * 0.1 : -0.05);

  // M44 SOCIAL SCAR INTEGRATION
  if (playerId) {
    const memoryEngine = getNpcMemoryEngine();
    const impact = memoryEngine.getMemoryImpactOnDialogue(npc.id, playerId);
    
    // Grudges (cautionLevel) make NPCs less likely to take risks for the player
    tolerance -= (impact.cautionLevel * 0.2);
    // Favors (trustLevel) can encourage them if they trust the player's lead
    tolerance += (impact.trustLevel * 0.1);
  }

  return clamp(tolerance);
}

/**
 * Evaluate NPC's openness to unusual/mystical activities
 * Higher = more open to paradoxes, magic, weird situations
 * PERFORMANCE: <1ms
 */
export function evaluateMysticalOpenness(npc: NpcWithPersonalityState): number {
  const vector = npc.personalityVector || initializePersonality(npc);

  // Direct mystique dimension
  let openness = vector.mystique * 0.7;

  // Low prudence makes them believe weird things more easily
  openness += (1 - vector.prudence) * 0.2;

  // Compassion can drive belief in magic if it helps others
  openness += vector.compassion * 0.1;

  return clamp(openness);
}

/**
 * Evaluate NPC's greed/desire for resources
 * Used for trading, auction bidding, theft likelihood
 * PERFORMANCE: <1ms
 */
export function evaluateGreedFactor(npc: NpcWithPersonalityState, playerId?: string): number {
  const vector = npc.personalityVector || initializePersonality(npc);

  // Ambition is direct greed driver
  let greed = vector.ambition * 0.7;

  // Compassion reduces greed
  greed -= vector.compassion * 0.2;

  // Prudence can drive hoarding behavior
  greed += vector.prudence * 0.1;

  // M44 SOCIAL SCAR INTEGRATION
  if (playerId) {
    const memoryEngine = getNpcMemoryEngine();
    const impact = memoryEngine.getMemoryImpactOnDialogue(npc.id, playerId);
    
    // Negative sentiment increases greed (NPC wants to squeeze the player)
    greed += (impact.cautionLevel * 0.15);
    // Trust reduces greed (NPC gives "friendship discount")
    greed -= (impact.trustLevel * 0.1);
  }

  return clamp(greed);
}

/**
 * Evaluate NPC's obedience/resistance to authority
 * High = resistant to commands, questions orders
 * PERFORMANCE: <1ms
 */
export function evaluateAuthorityResistance(npc: NpcWithPersonalityState): number {
  const vector = npc.personalityVector || initializePersonality(npc);

  // Prudence makes NPCs question authority
  let resistance = vector.prudence * 0.5;

  // High ambition also drives resistance (want own goals)
  resistance += vector.ambition * 0.3;

  // Mystique can drive resistance (believe in their own special truth)
  resistance += vector.mystique * 0.15;

  // Compassion reduces resistance if they like you
  resistance -= vector.compassion * 0.1;

  return clamp(resistance);
}

// ============================================================================
// PERSONALITY QUERY & EXPORT
// ============================================================================

/**
 * Get human-readable personality profile for debugging/display
 * PERFORMANCE: <2ms
 */
export function getPersonalityProfile(npc: NpcWithPersonalityState): string {
  const vector = npc.personalityVector || { compassion: 0.5, ambition: 0.5, prudence: 0.5, mystique: 0.5 };

  const primaryTraits = [];
  
  if (vector.compassion > 0.6) primaryTraits.push('compassionate');
  if (vector.compassion < 0.4) primaryTraits.push('selfish');
  if (vector.ambition > 0.6) primaryTraits.push('ambitious');
  if (vector.ambition < 0.4) primaryTraits.push('humble');
  if (vector.prudence > 0.6) primaryTraits.push('cautious');
  if (vector.prudence < 0.4) primaryTraits.push('reckless');
  if (vector.mystique > 0.6) primaryTraits.push('mystical');
  if (vector.mystique < 0.4) primaryTraits.push('skeptical');

  return primaryTraits.join(', ') || 'balanced';
}

/**
 * Get personality dimension name for UI display
 */
export function getDimensionName(dimension: keyof PersonalityVector): string {
  const names: Record<keyof PersonalityVector, string> = {
    compassion: 'Compassion',
    ambition: 'Ambition',
    prudence: 'Prudence',
    mystique: 'Mystique',
  };
  return names[dimension];
}

/**
 * Export personality state for serialization to save file
 */
export function exportPersonalityState(npc: NpcWithPersonalityState): any {
  return {
    currentVector: npc.personalityVector,
    historyLength: npc.personalityHistory?.length ?? 0,
    recentDrift: npc.personalityHistory?.[npc.personalityHistory.length - 1],
    profile: getPersonalityProfile(npc),
  };
}

/**
 * Import personality state from save file
 */
export function importPersonalityState(npc: NpcWithPersonalityState, state: any): void {
  if (state.currentVector) {
    npc.personalityVector = { ...state.currentVector };
  }
  if (state.history) {
    npc.personalityHistory = [...state.history];
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function hashCombine(a: number, b: number): number {
  // XOR-based hash combine (deterministic)
  return a ^ (b * 2654435761);
}

function createDriftRng(baseSeed: number, worldTick: number, driftType: string): SeededRng {
  // Create unique seed for this drift event
  const typeSeed = hashString(driftType);
  const eventSeed = hashCombine(baseSeed, typeSeed ^ worldTick);
  return new SeededRng(eventSeed);
}

function recordDriftHistory(
  npc: NpcWithPersonalityState,
  worldTick: number,
  prevVector: PersonalityVector,
  newVector: PersonalityVector,
  trigger: PersonalityHistory['trigger'],
  reason: string
): void {
  if (!npc.personalityHistory) {
    npc.personalityHistory = [];
  }

  npc.personalityHistory.push({
    timestamp: seededNow(worldTick),
    tick: worldTick,
    previousVector: { ...prevVector },
    newVector: { ...newVector },
    trigger,
    reason,
  });

  // Keep history size bounded (last 100 events)
  if (npc.personalityHistory.length > 100) {
    npc.personalityHistory.shift();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
// Interfaces are already exported above
