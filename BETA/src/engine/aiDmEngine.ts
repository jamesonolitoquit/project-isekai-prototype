/**
 * AI Dungeon Master Engine (Phase 2: Alpha - ALPHA_M1)
 * 
 * Purpose: Proactive narrative direction, tension management, and deterministic
 *          story pacing. The Director observes the world and emits SYSTEM events
 *          to maintain engagement and narrative coherence.
 * 
 * Key Features:
 * - Monitor world state for engagement and tension
 * - Detect pacing droughts (boredom detection)
 * - Translate paradox debt into narrative consequences (Temporal Anomalies)
 * - Orchestrate NPC positioning for narrative resonance (Magnet Effect)
 * - Emit deterministic DIRECTOR_EVENT mutations
 * 
 * Architecture:
 * - Director receives WorldState and returns Event[] (never modifies state directly)
 * - All events tagged mutationClass: 'SYSTEM' for deterministic replay
 * - Logic-first approach (no LLM calls in Alpha) for stability
 */

import type { WorldState, NPC, Location, DirectorZone, PlaystyleVector, PlayerAnalytics, FactionConflict } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { generateRelicDialogue, shouldRelicRebel, applyRelicRebellion, type Relic } from './artifactEngine';
import { generateAtmosphericText, generateVisualPrompt } from './assetGenerator';
import CJ, { type NarrativePivot } from './canonJournal';
import { SeededRng, getGlobalRng } from './prng';
import { calculateEuclideanDistance } from './mapEngine';
import { suggestAIAdaptations, calculatePlayerPreferences } from './analyticsEngine';
import type { PlaystyleProfile } from './analyticsEngine';

/**
 * Tracks Director state across multiple ticks to detect trends
 */
export interface DirectorState {
  narrativeTension: number;      // 0-100: escalates with activity, decays during inactivity
  playerFocus: string;           // ID of NPC/entity player has focused on
  pacingTrend: 'stagnant' | 'active' | 'escalating';
  lastEventTick: number;         // Tick of last non-TICK event
  inactionCounter: number;       // Ticks of continuous no-op activity
  interventionCooldown: number;  // Prevents directive spam (ticks remaining)
  lastAmbientWhisperTick: number; // M7 Phase 3: Throttles ambient whisper frequency (ticks)
}

// Re-export commonly used types (source of truth in worldEngine)
export type { FactionConflict, PlaystyleVector, PlayerAnalytics } from './worldEngine';

export interface Faction {
  id: string;
  name: string;
  powerScore: number;
}

export interface TemporalAnomaly {
  type: 'glitched_npc' | 'reality_rift' | 'time_distortion' | 'paradox_echo';
  severity: number;
  description: string;
  duration: number;
}

export interface WorldStatus {
  narrativePace: 'climax' | 'fast' | 'normal';
  tension: number;
  focusArea: string;
  nextEventTick: number;
  suggestedEncounter?: string;
}

/**
 * Encapsulates threshold-based decisions for Director interventions
 */
interface DirectorThresholds {
  boredomThreshold: number;      // Inaction counter before narrative stimulus (~10 ticks)
  paradoxThreshold: number;      // temporalDebt > this triggers anomalies (50)
  tensionLow: number;            // Below this is "stagnant" (20)
  tensionHigh: number;           // Above this is "escalating" (70)
  minInterventionSpacing: number; // Cooldown between events (2 ticks)
  ambientAtmosphereThreshold: number; // M7 Phase 3: Min tension for ambient whispers (70)
  ambientWhisperThrottleMs: number;   // M7 Phase 3: Min ticks between whispers (45-60 seconds of game time)
}

export const DEFAULT_THRESHOLDS: DirectorThresholds = {
  boredomThreshold: 10,
  paradoxThreshold: 50,
  tensionLow: 20,
  tensionHigh: 70,
  minInterventionSpacing: 2,
  ambientAtmosphereThreshold: 70,      // M7 Phase 3
  ambientWhisperThrottleMs: 50,        // M7 Phase 3: ~45-60 ticks = seconds of game time
};

/**
 * Initialize Director state (called once at world creation)
 */
export function initializeDirectorState(): DirectorState {
  return {
    narrativeTension: 50,
    playerFocus: '',
    pacingTrend: 'active',
    lastEventTick: 0,
    inactionCounter: 0,
    interventionCooldown: 0,
    lastAmbientWhisperTick: 0, // M7 Phase 3: Initialize ambient whisper throttle
  };
}

/**
 * Core Director evaluation function
 * Called at the end of each tick to generate proactive narrative events
 */
export function evaluateDirectorIntervention(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds = DEFAULT_THRESHOLDS
): Event[] {
  const generatedEvents: Event[] = [];
  
  // Try to use global RNG if available (M11 determinism in tests)
  // Fall back to seed-based local RNG if not (M8 backwards compatibility)
  let rng: SeededRng;
  try {
    rng = getGlobalRng();
  } catch {
    // Not initialized - create local RNG for this call
    rng = new SeededRng(state.seed);
  }

  // Decay intervention cooldown
  directorState.interventionCooldown = Math.max(0, directorState.interventionCooldown - 1);
  if (directorState.interventionCooldown > 0) {
    return []; // Still cooling down, skip evaluation
  }

  // === Module 1: Boredom Detection ===
  const boredEvent = checkBoredomAndStimulus(state, directorState, thresholds, rng);
  if (boredEvent) {
    generatedEvents.push(boredEvent);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
  }

  // === Module 2: Paradox Translation ===
  const paradoxEvent = checkParadoxTranslation(state, directorState, thresholds, rng);
  if (paradoxEvent) {
    generatedEvents.push(paradoxEvent);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
  }

  // === Module 3: NPC Orchestration (Magnet Effect) ===
  const npcOrchestraEvent = checkNpcOrchestration(state, directorState, thresholds, rng);
  if (npcOrchestraEvent) {
    generatedEvents.push(npcOrchestraEvent);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
  }

  // === Module 4: Artifact Whispers (Sentient Relics) ===
  const whisperEvent = checkArtifactWhispers(state, directorState, thresholds, rng);
  if (whisperEvent) {
    generatedEvents.push(whisperEvent);
    directorState.interventionCooldown = Math.max(directorState.interventionCooldown, 1);
  }

  // === Module 5: Relic Rebellion (High Paradox) ===
  const rebellionEvent = checkRelicRebellion(state, directorState, thresholds, rng);
  if (rebellionEvent) {
    generatedEvents.push(rebellionEvent);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
    directorState.narrativeTension = Math.min(100, directorState.narrativeTension + 25);
  }

  // === Module 6: Faction World Events (ALPHA_M3) ===
  const worldEventEv = checkFactionWorldEvents(state, directorState, thresholds, rng);
  if (worldEventEv) {
    generatedEvents.push(worldEventEv);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
  }

  // === Module 9: Playstyle-Adaptive Nudges (ALPHA_M14) ===
  // Adjusts Director behavior based on player's observed playstyle (combatant, diplomat, explorer)
  const playstyleNudgeEvent = checkPlaystyleAdaptation(state, directorState, thresholds, rng);
  if (playstyleNudgeEvent) {
    generatedEvents.push(playstyleNudgeEvent);
    directorState.interventionCooldown = Math.max(directorState.interventionCooldown, 1);
  }

  // === Module 7: Ambient Atmosphere & Sensory Whispers (ALPHA_M7 Phase 3) ===
  const ambientAudioEvent = checkAmbientAtmosphere(state, directorState, thresholds);
  if (ambientAudioEvent) {
    generatedEvents.push(ambientAudioEvent);
    directorState.interventionCooldown = Math.max(directorState.interventionCooldown, 1);
  }

  // === Module 8: Narrative Resonance (ALPHA_M13 Step 4) ===
  // Check for combinations of events that trigger rare, thematic moments
  const resonanceEvent = checkNarrativeResonance(state, directorState, thresholds, rng);
  if (resonanceEvent) {
    generatedEvents.push(resonanceEvent);
    directorState.interventionCooldown = thresholds.minInterventionSpacing;
  }

  // === Update Tension and Trend ===
  updateTensionAndTrend(state, directorState, thresholds);

  return generatedEvents;
}

/**
 * Boredom Detection Module
 * Detects if player has taken no actions for N ticks
 * If true, emits NARRATIVE_STIMULUS event (weather shift, NPC greeting, etc.)
 * ALPHA_M14: Enhanced with playstyle-aware nudges
 */
function checkBoredomAndStimulus(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  const currentTick = state.tick ?? 0;
  const timeSinceLastEvent = currentTick - directorState.lastEventTick;

  if (timeSinceLastEvent >= thresholds.boredomThreshold) {
    // Get player analytics to determine playstyle (M57-A1: strict typing)
    const playerAnalytics = state.player.analytics || [];
    const playstyleVector = state.player.playstyleVector || { 
      combatant: 0.33, 
      diplomat: 0.33, 
      explorer: 0.34,
      dominant: 'hybrid'
    };
    
    // Select stimulus based on playstyle
    let stimulus = selectNarrativeStimulus(state, currentTick, rng);
    let nudgeType = 'generic';
    
    // ALPHA_M14: Apply playstyle-based nudges
    if (playstyleVector.combatant > 0.6) {
      // Combatant: Emit combat encounters or faction struggles
      stimulus = rng.next() > 0.5 ? 'faction_struggle' : 'random_encounter';
      nudgeType = 'combatant-idle';
    } else if (playstyleVector.diplomat > 0.6) {
      // Diplomat: Emit social/faction events
      stimulus = 'faction_event';
      nudgeType = 'diplomat-idle';
    } else if (playstyleVector.explorer > 0.6) {
      // Explorer: Emit discovery/relic events
      stimulus = 'relic_whisper';
      nudgeType = 'explorer-idle';
    }
    
    directorState.inactionCounter = 0; // Reset counter
    directorState.narrativeTension = Math.min(100, directorState.narrativeTension + 15); // Boost tension
    directorState.lastEventTick = currentTick;

    return {
      id: `director-stimulus-${currentTick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'DIRECTOR_NUDGE',
      payload: {
        stimulus,
        reason: 'boredom_detection',
        nudgeType,
        playstyleDominant: playstyleVector.dominant,
        inactionDuration: timeSinceLastEvent,
        currentTension: directorState.narrativeTension,
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Paradox Translation Module
 * Monitors player's temporalDebt (from save-scumming/rewinding)
 * If debt > threshold, emits TEMPORAL_ANOMALY with hazards
 */
function checkParadoxTranslation(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  const temporalDebt = state.player.temporalDebt ?? 0;

  if (temporalDebt > thresholds.paradoxThreshold) {
    // High temporal debt -> reality distortions
    const anomaly = generateTemporalAnomaly(state, temporalDebt, rng);

    directorState.narrativeTension = Math.min(100, directorState.narrativeTension + 20);
    directorState.lastEventTick = state.tick ?? 0;

    return {
      id: `director-paradox-${state.tick ?? 0}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'TEMPORAL_ANOMALY',
      payload: {
        anomaly,
        temporalDebtLevel: temporalDebt,
        manifestation: anomaly.type,
        locationId: state.player.location,
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Director Zone Management (ALPHA_M9 Phase 3)
 * Maintains spatial zones for NPC orchestration using coordinate-based detection
 */
function updateDirectorZones(state: WorldState, directorState: DirectorState): DirectorZone[] {
  if (!state.directorZones) {
    state.directorZones = [];
  }

  const currentTick = state.tick ?? 0;
  const playerX = state.player.x ?? 500;
  const playerY = state.player.y ?? 500;

  // Create or update primary zone centered on player
  const primaryZoneId = 'director-primary-zone';
  let primaryZone = state.directorZones.find(z => z.id === primaryZoneId);

  if (!primaryZone) {
    primaryZone = {
      id: primaryZoneId,
      centerX: playerX,
      centerY: playerY,
      radius: 150, // Coordinate units for NPC interaction range
      occupants: [],
      magnetLevel: 0.5,
      activeUntilTick: currentTick + 1000,
    };
    state.directorZones.push(primaryZone);
  } else {
    primaryZone.centerX = playerX;
    primaryZone.centerY = playerY;
    primaryZone.lastPlayerX = playerX;
    primaryZone.lastPlayerY = playerY;
  }

  // Identify NPCs in primary zone
  primaryZone.occupants = [];
  state.npcs.forEach(npc => {
    const npcLocation = state.locations.find(loc => loc.id === npc.locationId);
    if (npcLocation && npcLocation.x !== undefined && npcLocation.y !== undefined) {
      const distance = calculateEuclideanDistance(playerX, playerY, npcLocation.x, npcLocation.y);
      if (distance <= primaryZone.radius) {
        primaryZone.occupants.push(npc.id);
      }
    }
  });

  // Remove expired zones
  state.directorZones = state.directorZones.filter(zone => !zone.activeUntilTick || zone.activeUntilTick > currentTick);

  return state.directorZones;
}

/**
 * Find nearest NPC outside current zone to draw into narrative
 */
function findDistantNpcForOrchestration(
  state: WorldState,
  primaryZone: DirectorZone
): NPC | null {
  const outsideZone = state.npcs.filter(npc => !primaryZone.occupants.includes(npc.id));
  
  if (outsideZone.length === 0) return null;

  // Find closest among distant NPCs
  const playerX = primaryZone.centerX;
  const playerY = primaryZone.centerY;

  let closest = outsideZone[0];
  let closestDistance = Infinity;

  outsideZone.forEach(npc => {
    const npcLocation = state.locations.find(loc => loc.id === npc.locationId);
    if (npcLocation && npcLocation.x !== undefined && npcLocation.y !== undefined) {
      const distance = calculateEuclideanDistance(playerX, playerY, npcLocation.x, npcLocation.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = npc;
      }
    }
  });

  return closest;
}

/**
 * NPC Orchestration Module (Magnet Effect) - Updated for Coordinates
 * Uses DirectorZones to detect positioning and nudges NPCs closer when pacing is stagnant
 */
function checkNpcOrchestration(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  // Only trigger if player is in "stagnant" pacing trend
  if (directorState.pacingTrend !== 'stagnant') {
    return null;
  }

  // Update director zones (coordinates-based)
  const zones = updateDirectorZones(state, directorState);
  const primaryZone = zones.find(z => z.id === 'director-primary-zone');

  if (!primaryZone || primaryZone.occupants.length === state.npcs.length) {
    return null; // All NPCs are already in zone
  }

  // Find an NPC outside the zone to draw closer
  const targetNpc = findDistantNpcForOrchestration(state, primaryZone);
  if (!targetNpc) return null;

  const npcLocation = state.locations.find(loc => loc.id === targetNpc.locationId);
  if (!npcLocation || npcLocation.x === undefined || npcLocation.y === undefined) {
    return null;
  }

  // Calculate Euclidean distance from NPC to player
  const distance = calculateEuclideanDistance(
    primaryZone.centerX,
    primaryZone.centerY,
    npcLocation.x,
    npcLocation.y
  );

  // If NPC is significantly outside zone, generate movement event
  if (distance > primaryZone.radius * 1.5) {
    directorState.lastEventTick = state.tick ?? 0;

    return {
      id: `director-magnet-${state.tick ?? 0}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'NPC_GUIDED_MOVEMENT',
      payload: {
        npcId: targetNpc.id,
        npcName: targetNpc.name,
        from: targetNpc.locationId,
        reason: 'narrative_pacing',
        distance: Math.round(distance), // Euclidean distance
        magnetStrength: primaryZone.magnetLevel,
        targetZone: primaryZone.id,
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Artifact Whispers Module (ALPHA_M2)
 * Sentient relics speak to the player through Director intermediation
 * Scaled by narrativeTension (higher tension = more likely to hear whispers)
 */
function checkArtifactWhispers(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  // Get equipped relic IDs and look them up in the relics registry
  const equippedRelicIds = state.player.equippedRelics || [];
  if (equippedRelicIds.length === 0) {
    return null;
  }

  const equippedRelics: Relic[] = equippedRelicIds
    .map(id => state.relics?.[id])
    .filter((r): r is Relic => r !== undefined);

  // Filter to sentient relics only
  const sentientRelics = equippedRelics.filter(r => r.sentienceLevel > 0);
  if (sentientRelics.length === 0) {
    return null;
  }

  // Chance to whisper scales with narrative tension
  // At tension 50: 5% chance, at tension 100: 50% chance
  const whisperChance = (directorState.narrativeTension - 40) / 120;
  if (rng.next() > whisperChance) {
    return null;
  }

  // Pick a random sentient relic
  const relic = sentientRelics[rng.nextInt(0, sentientRelics.length - 1)];
  
  // Determine context for dialogue
  const context = determineRelicContext(state, directorState);
  
  // Generate dialogue
  const dialogue = generateRelicDialogue(relic, context);

  directorState.lastEventTick = state.tick ?? 0;

  return {
    id: `director-whisper-${state.tick ?? 0}`,
    worldInstanceId: state.id,
    actorId: 'director-ai',
    type: 'RELIC_WHISPER',
    payload: {
      relicId: relic.id,
      relicName: relic.name,
      dialogue,
      context,
      sentienceLevel: relic.sentienceLevel,
    },
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * Relic Rebellion Module (ALPHA_M2)
 * High paradox can cause equipped relics to rebel against the player
 */
function checkRelicRebellion(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  const paradoxLevel = state.player.temporalDebt ?? 0;

  // Only rebel with high paradox
  if (paradoxLevel <= thresholds.paradoxThreshold) {
    return null;
  }

  // Check each equipped relic
  const equippedRelicIds = state.player.equippedRelics || [];
  const equippedRelics: Relic[] = equippedRelicIds
    .map(id => state.relics?.[id])
    .filter((r): r is Relic => r !== undefined);

  for (const relic of equippedRelics) {
    if (shouldRelicRebel(relic, paradoxLevel)) {
      const rebellionInfo = applyRelicRebellion(relic);

      directorState.lastEventTick = state.tick ?? 0;

      return {
        id: `director-rebellion-${state.tick ?? 0}`,
        worldInstanceId: state.id,
        actorId: 'director-ai',
        type: 'RELIC_REBELLION',
        payload: {
          relicId: relic.id,
          relicName: relic.name,
          message: rebellionInfo.message,
          effect: rebellionInfo.effect,
          paradoxLevel,
          rebellionCounter: relic.rebellionCounter || 0,
        },
        mutationClass: 'SYSTEM',
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Determine the narrative context for relic dialogue
 */
function determineRelicContext(
  state: WorldState,
  directorState: DirectorState
): 'danger' | 'rival_killed' | 'paradox_surge' | 'greeting' {
  const paradoxLevel = state.player.temporalDebt ?? 0;
  const tension = directorState.narrativeTension;

  if (paradoxLevel > 70) {
    return 'paradox_surge';
  }
  if (tension > 80) {
    return 'danger';
  }
  if (tension < 30) {
    return 'greeting';
  }
  return 'danger';
}

/**
 * Update Director's internal tension and trend metrics
 */
function updateTensionAndTrend(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds
): void {
  // === ALPHA_M2: Soul Strain affects tension ===
  // High soul strain (from morphing) drives narrative intensity
  const soulStrain = state.player.soulStrain ?? 0;
  const soulStrainTension = Math.floor(soulStrain * 0.5); // 0-50% of tension from soul strain

  // Tension naturally decays (unless recently stimulated)
  const ticksSinceEvent = (state.tick ?? 0) - directorState.lastEventTick;
  if (ticksSinceEvent > 3) {
    directorState.narrativeTension = Math.max(0, directorState.narrativeTension - 2);
  }

  // Apply soul strain as minimum tension floor (protects from decay during transformations)
  if (soulStrain > 50) {
    directorState.narrativeTension = Math.max(directorState.narrativeTension, soulStrainTension);
  }

  // Cap tension at 100
  directorState.narrativeTension = Math.min(100, directorState.narrativeTension);

  // Update pacing trend based on tension
  if (directorState.narrativeTension < thresholds.tensionLow) {
    directorState.pacingTrend = 'stagnant';
  } else if (directorState.narrativeTension > thresholds.tensionHigh) {
    directorState.pacingTrend = 'escalating';
  } else {
    directorState.pacingTrend = 'active';
  }
}

/**
 * Select a random narrative stimulus based on world state
 */
function selectNarrativeStimulus(state: WorldState, currentTick: number, rng: SeededRng): string {
  const stimuli = [
    { type: 'weather_shift', weight: 3 },
    { type: 'npc_greeting', weight: 2 },
    { type: 'ambient_event', weight: 2 },
    { type: 'wildlife_encounter', weight: 1 },
  ];

  // Weighted random selection
  const totalWeight = stimuli.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng.nextInt(0, totalWeight - 1);

  for (const stimulus of stimuli) {
    roll -= stimulus.weight;
    if (roll < 0) {
      return stimulus.type;
    }
  }

  return 'ambient_event';
}

/**
 * Generate a temporal anomaly manifestation
 */
function generateTemporalAnomaly(state: WorldState, debtLevel: number, rng: SeededRng): TemporalAnomaly {
  const debtSeverity = Math.min(1, debtLevel / 100);
  const anomalyTypes: Array<{ type: TemporalAnomaly['type']; severity: number }> = [
    { type: 'glitched_npc', severity: 0.4 },
    { type: 'reality_rift', severity: 0.6 },
    { type: 'time_distortion', severity: 0.8 },
    { type: 'paradox_echo', severity: 1.0 },
  ];

  const eligible = anomalyTypes.filter(a => debtSeverity >= a.severity);
  const chosen = eligible[rng.nextInt(0, eligible.length - 1)] || anomalyTypes[0];

  return {
    type: chosen.type,
    severity: debtSeverity,
    description: `A ${chosen.type} manifestation of temporal instability`,
    duration: Math.ceil(3 * debtSeverity),
  };
}

/**
 * Calculate Manhattan distance between two locations
 */
function calculateLocationDistance(fromId: string, toId: string, locations: Location[]): number {
  // Simple implementation: count hops
  // In full game, could use graph pathfinding
  if (fromId === toId) return 0;
  return 2; // Default: 2 hops apart (simplified)
}

/**
 * Find the next location closer to player
 */
function getLocationCloserToPlayer(
  npcLocationId: string,
  playerLocationId: string,
  locations: Location[]
): string | null {
  // Simplified: just return a different location
  // In full game, use actual pathfinding
  if (npcLocationId === playerLocationId) return null;

  const allLocationIds = locations.map(l => l.id);
  const candidates = allLocationIds.filter(id => id !== npcLocationId);
  
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Playstyle Adaptation Module (ALPHA_M14)
 * Detects player's dominant playstyle and triggers targeted Director nudges
 * 
 * Examples:
 * - Combatant (>60% combat): If idle, emit RANDOM_ENCOUNTER or FACTION_STRUGGLE
 * - Diplomat (>60% social): If idle, emit FACTION_EVENT or NPC_GREETING
 * - Explorer (>60% exploration): If idle, emit RELIC_WHISPER with hidden SubArea coordinates
 */
function checkPlaystyleAdaptation(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  const currentTick = state.tick ?? 0;
  
  // Get player analytic history
  const playerAnalytics = state.player.analytics || [];
  if (playerAnalytics.length < 5) {
    return null; // Not enough data to assess playstyle
  }
  
  // Calculate playstyle vector
  const preferences = calculatePlayerPreferences(playerAnalytics);
  const vector = preferences.playstyleVector;
  
  // Store playstyle vector in player state for later reference
  state.player.playstyleVector = vector;
  
  // Check if player is stuck in current location (for explorers)
  const playerLocation = state.player.location;
  const recentLocations = playerAnalytics.slice(-10).map((a: any) => a.context);
  const locationsInRecent = new Set(recentLocations);
  const isStuck = locationsInRecent.size === 1;
  
  // Only trigger nudge if player has been idle for a while
  const timeSinceLastEvent = currentTick - directorState.lastEventTick;
  if (timeSinceLastEvent < thresholds.boredomThreshold * 0.5) {
    return null;
  }
  
  // COMBATANT: Nudge toward combat if idle
  if (vector.combatant > 0.6 && vector.combatant > vector.diplomat && vector.combatant > vector.explorer) {
    const nudgeText = `A shadow passes overhead—the air grows tense. Danger lurks nearby.`;
    return {
      id: `director-nudge-combatant-${currentTick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'DIRECTOR_NUDGE',
      payload: {
        nudgeType: 'combatant-idle',
        playstyle: 'combatant',
        suggestion: nudgeText,
        recommendedEncounter: rng.next() > 0.5 ? 'FACTION_STRUGGLE' : 'RANDOM_ENCOUNTER',
        currentTension: directorState.narrativeTension,
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now(),
    };
  }
  
  // DIPLOMAT: Nudge toward social encounters if idle
  if (vector.diplomat > 0.6 && vector.diplomat > vector.combatant && vector.diplomat > vector.explorer) {
    const nudgeText = `Whispers reach your ears—rumors spreading through the districts. A faction stirs.`;
    return {
      id: `director-nudge-diplomat-${currentTick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'DIRECTOR_NUDGE',
      payload: {
        nudgeType: 'diplomat-idle',
        playstyle: 'diplomat',
        suggestion: nudgeText,
        recommendedEncounter: 'FACTION_EVENT',
        currentTension: directorState.narrativeTension,
      },
      mutationClass: 'SYSTEM',
      timestamp: Date.now(),
    };
  }
  
  // EXPLORER: Nudge toward discovery if stuck in one location
  if (vector.explorer > 0.6 && vector.explorer > vector.combatant && vector.explorer > vector.diplomat) {
    if (isStuck && timeSinceLastEvent > thresholds.boredomThreshold) {
      // Generate hidden SubArea coordinates
      const hiddenX = 300 + rng.nextInt(0, 400);
      const hiddenY = 300 + rng.nextInt(0, 400);
      const nudgeText = `A faint shimmer catches your eye—something hidden beyond the veil of common sight.`;
      
      return {
        id: `director-nudge-explorer-${currentTick}`,
        worldInstanceId: state.id,
        actorId: 'director-ai',
        type: 'DIRECTOR_NUDGE',
        payload: {
          nudgeType: 'explorer-idle',
          playstyle: 'explorer',
          suggestion: nudgeText,
          recommendedEncounter: 'RELIC_WHISPER',
          hiddenCoordinates: { x: hiddenX, y: hiddenY },
          currentTension: directorState.narrativeTension,
        },
        mutationClass: 'SYSTEM',
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Ambient Atmosphere Module (ALPHA_M7 Phase 3)
 * Emits AMBIENT_WHISPER events with sensory texture when tension is high
 * Integrates assetGenerator to create rich atmospheric feedback
 * 
 * Features:
 * - Generates multi-sensory atmospheric prose (sounds, scents, visual details)
 * - Throttled to prevent UI spam (30-60 seconds between whispers)
 * - Prioritizes atmospheric immersion over mechanical feedback
 * - Escalates intensity with narrative tension
 */
function checkAmbientAtmosphere(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds
): Event | null {
  // Only emit ambient whispers when tension is high enough
  if (directorState.narrativeTension < thresholds.ambientAtmosphereThreshold) {
    return null;
  }

  // Check throttle: prevent spam by enforcing minimum time between whispers
  const currentTick = state.tick ?? 0;
  const ticksSinceLastWhisper = currentTick - directorState.lastAmbientWhisperTick;
  
  if (ticksSinceLastWhisper < thresholds.ambientWhisperThrottleMs) {
    return null;
  }

  // Generate rich sensory description using assetGenerator
  const atmosphericText = generateAtmosphericText(state);

  // Update throttle timer
  directorState.lastAmbientWhisperTick = currentTick;
  directorState.lastEventTick = currentTick;

  return {
    id: `director-ambient-${currentTick}`,
    worldInstanceId: state.id,
    actorId: 'director-ai',
    type: 'AMBIENT_WHISPER',
    payload: {
      sensoryText: atmosphericText,
      tension: directorState.narrativeTension,
      atmosphereSource: 'ambient_environment',
      timestamp: Date.now(),
    },
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * ALPHA_M3: Check for faction-driven world events
 * Triggers events when faction conflicts create world consequences
 * 
 * Examples:
 * - War → Monster Infestation (borders neglected)
 * - Economic conflict → Market Closure or Price Inflation
 * - Religious conflict → Temple Desecration or Holy Pilgrimage
 */
function checkFactionWorldEvents(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  // Only trigger world events at high tension
  if (directorState.narrativeTension < thresholds.tensionHigh - 10) {
    return null;
  }

  const conflicts: FactionConflict[] = state.factionConflicts || [];
  const factions: Faction[] = state.factions || [];
  
  if (conflicts.length === 0 || factions.length === 0) {
    return null;
  }

  // Find the most intense active conflict
  let maxIntensity = 0;
  let selectedConflict: FactionConflict | null = null;

  for (const conflict of conflicts.filter((c) => c.active)) {
    // Compute conflict intensity
    const factionsInvolved: Faction[] = factions.filter((f) => conflict.factionIds.includes(f.id));
    const powerDiff = factionsInvolved.length > 1 
      ? Math.abs(factionsInvolved[0].powerScore - factionsInvolved[1].powerScore)
      : 0;
    
    const intensity = powerDiff + (conflict.type === 'military' ? 30 : 10);
    
    if (intensity > maxIntensity) {
      maxIntensity = intensity;
      selectedConflict = conflict;
    }
  }

  if (!selectedConflict || maxIntensity < 40) {
    return null;
  }

  // Only trigger occasionally (1 in 20 check when conditions met)
  if (rng.next() > 0.05) {
    return null;
  }

  // Determine world event based on conflict type
  let eventName = 'WORLD_EVENT';
  let eventMessage = 'The world shifts around you.';
  let eventDetails: Record<string, any> = {
    trigger: 'faction-conflict',
    conflictType: selectedConflict.type,
    tension: directorState.narrativeTension
  };

  switch (selectedConflict.type) {
    case 'military': {
      const events = [
        { name: 'monster-infestation', msg: 'War has drawn dangerous monsters to unguarded borders.' },
        { name: 'militia-draft', msg: 'Local militia are conscripting adventurers for the war effort.' },
        { name: 'refugee-crisis', msg: 'Refugees from the war are flooding into nearby settlements.' }
      ];
      const selected = events[rng.nextInt(0, events.length - 1)];
      eventMessage = selected.msg;
      eventDetails.worldEventType = selected.name;
      break;
    }
    case 'economic': {
      const events = [
        { name: 'market-closure', msg: 'Markets have been forcibly closed due faction economic war.' },
        { name: 'supply-shortage', msg: 'Supply shortages are driving up prices everywhere.' },
        { name: 'trade-embargo', msg: 'A trade embargo blocks essential goods from reaching settlements.' }
      ];
      const selected = events[rng.nextInt(0, events.length - 1)];
      eventMessage = selected.msg;
      eventDetails.worldEventType = selected.name;
      break;
    }
    case 'religious': {
      const events = [
        { name: 'temple-desecration', msg: 'Sacred temples have been desecrated by rival factions!' },
        { name: 'pilgrimage-surge', msg: 'Religious pilgrims flood the roads seeking protection.' },
        { name: 'holy-war', msg: 'A holy war has been declared between factions.' }
      ];
      const selected = events[rng.nextInt(0, events.length - 1)];
      eventMessage = selected.msg;
      eventDetails.worldEventType = selected.name;
      break;
    }
    case 'infiltration': {
      const events = [
        { name: 'spy-network-exposed', msg: 'Spy networks have been exposed! Trust is breaking down.' },
        { name: 'sabotage-campaign', msg: 'Sabotage is spreading throughout the region.' }
      ];
      const selected = events[rng.nextInt(0, events.length - 1)];
      eventMessage = selected.msg;
      eventDetails.worldEventType = selected.name;
      break;
    }
    case 'diplomatic': {
      const events = [
        { name: 'diplomatic-breakdown', msg: 'Diplomatic relations are crumbling. War looms.' },
        { name: 'hostage-crisis', msg: 'Hostages have been taken to pressure negotiations.' }
      ];
      const selected = events[rng.nextInt(0, events.length - 1)];
      eventMessage = selected.msg;
      eventDetails.worldEventType = selected.name;
      break;
    }
  }

  directorState.lastEventTick = state.tick ?? 0;

  return {
    id: `world-event-${Date.now()}`,
    worldInstanceId: state.id,
    actorId: 'director-faction',
    type: 'WORLD_EVENT',
    payload: {
      message: eventMessage,
      ...eventDetails
    },
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * Analyze current world state and generate AI DM guidance
 */
export function analyzeWorldStatus(state: WorldState): WorldStatus {
  const temporalDebt = state.player.temporalDebt ?? 0;
  const tension = Math.min(
    100,
    (temporalDebt * 0.5) + ((state.player.hp ?? 100) < 30 ? 30 : 0)
  );

  return {
    narrativePace: tension > 70 ? 'climax' : tension > 50 ? 'fast' : 'normal',
    tension: Math.round(tension),
    focusArea: 'exploration',
    nextEventTick: (state.tick ?? 0) + 10,
    suggestedEncounter: undefined,
  };
}

/**
 * ALPHA_M13 Step 4: Narrative Resonance Module
 * Detects thematic combinations and emits rare TIMELINE_GAZING events
 */
function checkNarrativeResonance(
  state: WorldState,
  directorState: DirectorState,
  thresholds: DirectorThresholds,
  rng: SeededRng
): Event | null {
  const player = state.player;
  const temporalDebt = player.temporalDebt ?? 0;
  const factionRep = player.factionReputation || {};

  // === Check for thematic resonance combinations ===

  // Pattern 1: High Shadow Faction + Dark weapon + Night = Prophecy
  const shadowRep = factionRep['shadow'] ?? 0;
  const isNight = (state.hour ?? 12) >= 20 || (state.hour ?? 12) < 6;
  
  if (shadowRep >= 50 && temporalDebt >= 40 && isNight && rng.next() < 0.15) {
    return {
      id: `narrative-resonance-shadow-${state.tick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'TIMELINE_GAZING',
      payload: {
        resonanceType: 'shadow_prophecy',
        message: 'The night deepens... visions of possible futures flicker before your eyes.',
        prophecy: 'A shadow path converges. What will you choose?',
        factionId: 'shadow',
        temporalCost: 5,
        tension: 25
      },
      timestamp: state.tick ?? 0
    };
  }

  // Pattern 2: High Light Faction + Healing + Day = Divine Intervention
  const lightRep = factionRep['light'] ?? 0;
  const isDay = (state.hour ?? 12) >= 6 && (state.hour ?? 12) < 20;
  
  if (lightRep >= 50 && isDay && temporalDebt <= 20 && rng.next() < 0.1) {
    return {
      id: `narrative-resonance-light-${state.tick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'TIMELINE_GAZING',
      payload: {
        resonanceType: 'light_guidance',
        message: 'Divine light bathes the world. A sense of purpose fills you.',
        prophecy: 'The path is illuminated. Move forward with conviction.',
        factionId: 'light',
        temporalCost: -5, // Light reduces debt!
        tension: -10
      },
      timestamp: state.tick ?? 0
    };
  }

  // Pattern 3: High Paradox + Artifact Corruption = Temporal Cascade
  const artifactCorruption = (state.relics && Object.values(state.relics).some(r => ((r).corruption as number | undefined ?? 0) > 70));
  
  if (temporalDebt >= 70 && artifactCorruption && rng.next() < 0.12) {
    return {
      id: `narrative-resonance-cascade-${state.tick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'TIMELINE_GAZING',
      payload: {
        resonanceType: 'temporal_cascade',
        message: 'Reality fractures! Paradox and corruption interweave.',
        prophecy: 'Each echo of your actions ripples through time. Choose wisely.',
        temporalCost: 10,
        tension: 50
      },
      timestamp: state.tick ?? 0
    };
  }

  // Pattern 4: Relic Sentience Surge + Player at Location = Relic Quest
  const equippedRelics = player.inventory?.filter(item =>
    item.kind === 'unique' && item.equipped && (item.metadata?.sentience ?? 0) >= 4
  ) || [];

  if (equippedRelics.length > 0 && rng.next() < 0.08) {
    // Generate relic quest event
    return {
      id: `narrative-resonance-relic-quest-${state.tick}`,
      worldInstanceId: state.id,
      actorId: 'director-ai',
      type: 'TIMELINE_GAZING',
      payload: {
        resonanceType: 'relic_awakening',
        message: 'Your artifact suddenly speaks with unprecedented clarity.',
        prophecy: 'A task emerges from the depths of its being.',
        triggersRelicQuest: true,
        relicItemId: equippedRelics[0].itemId,
        tension: 15
      },
      timestamp: state.tick ?? 0
    };
  }

  return null;
}

/**
 * Generate NPC reactions based on world state
 */
export function generateNpcReaction(
  state: WorldState,
  npcId: string,
  eventContext: string
): string {
  return `The NPC reacts to: ${eventContext}`;
}

/**
 * Monitor pacing and suggest interventions
 * ALPHA_M18: Proactive Narrative Intervention
 * 
 * Detects narrative "pacing droughts" when engagement falls below 40% for 50 ticks
 * Emits DIRECTOR_EVENT mutations: weather shifts, NPC whispers, paradox ambushes
 */
export function suggestPacingIntervention(state: WorldState): Event | null {
  const currentTick = state.tick ?? 0;
  const playerAnalytics = state.player.analytics || [];
  const inactionCounter = state.player.inactionCounter ?? 0;
  const temporalDebt = state.player.temporalDebt ?? 0;
  
  // Calculate engagement score from recent actions (last 10 analytics)
  const recentAnalytics = playerAnalytics.slice(-10);
  let avgEngagement = 50; // Default baseline
  
  if (recentAnalytics.length > 0) {
    const totalEngagement = recentAnalytics.reduce((sum: number, a: any) => sum + (a.engagementScore ?? 0), 0);
    avgEngagement = Math.round(totalEngagement / recentAnalytics.length);
  }
  
  // Trigger intervention when: engagement < 40% AND inaction > 50 ticks
  if (avgEngagement >= 40 || inactionCounter < 50) {
    return null;
  }
  
  const rng = getGlobalRng();
  
  // Select intervention type weighted by temporal debt
  let interventionType: 'weather_shift' | 'npc_whisper' | 'paradox_ambush';
  const debtThreshold = temporalDebt / 100; // 0.0-1.0 scale
  const roll = rng.next();
  
  if (roll < 0.3 || debtThreshold > 0.6) {
    interventionType = 'paradox_ambush'; // Higher probability with high debt
  } else if (roll < 0.65) {
    interventionType = 'weather_shift';
  } else {
    interventionType = 'npc_whisper';
  }
  
  // Create event based on intervention type
  let eventPayload: Record<string, unknown> = {
    interventionType,
    reason: 'pacing_drought',
    engagementScore: avgEngagement,
    inactionDuration: inactionCounter,
    temporalDebt,
    pacingRecoveryTarget: 65, // Target engagement to restore
  };
  
  let eventDescription = '';
  
  if (interventionType === 'weather_shift') {
    const weather = ['sudden_storm', 'thick_fog', 'unseasonal_snow', 'aurora_shimmer'][rng.nextInt(0, 3)];
    eventPayload.weather = weather;
    eventDescription = `Sudden ${weather} disrupts the peaceful atmosphere`;
  } else if (interventionType === 'npc_whisper') {
    const whispers: string[] = [
      'A distant voice calls out: "Something is changing..."',
      'You hear urgent whispering from an unseen source',
      'An NPC nearby seems to know something you do not',
      'A mysterious figure materializes from the mist'
    ];
    eventPayload.whisper = whispers[rng.nextInt(0, whispers.length - 1)];
    eventDescription = eventPayload.whisper as string;
  } else if (interventionType === 'paradox_ambush') {
    const ambushType = ['temporal_rifts', 'reality_glitch', 'shadow_duplicate', 'echo_attacker'][rng.nextInt(0, 3)];
    eventPayload.ambushType = ambushType;
    eventPayload.difficulty = Math.max(1, Math.floor(debtThreshold * 5));
    eventDescription = `Paradox manifestation: ${ambushType} emerges!`;
  }
  
  return {
    id: `director-pacing-${currentTick}`,
    worldInstanceId: state.id,
    actorId: 'director-ai',
    type: 'DIRECTOR_INTERVENTION',
    payload: eventPayload,
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * Adaptive difficulty adjustment
 * ALPHA_M18: Dynamic scaling based on playstyle vectors and win rate
 * 
 * If dominant combatant with >80% win rate: scale NPC health/damage by 1.1x
 * Uses 3-combat "memory" (hysteresis) to prevent wild swings during luck streaks
 */
export function calculateAdaptiveDifficulty(
  state: WorldState,
  encounterType: string
): number {
  const temporalDebt = state.player.temporalDebt ?? 0;
  const playstyleVector = state.player.playstyleVector || { 
    combatant: 0.33, 
    diplomat: 0.33, 
    explorer: 0.34,
    dominant: 'hybrid'
  };
  
  // Base difficulty from temporal debt
  let difficultyMultiplier = 1.0 + (temporalDebt * 0.005);
  
  // Combat-focused playstyle scaling
  if (playstyleVector.dominant === 'combatant' && playstyleVector.combatant > 0.7) {
    // Track recent combat outcomes
    const combatHistory = state.player.recentCombatOutcomes || [];
    const recentCombats = combatHistory.slice(-3); // Last 3 combats (3-combat memory window)
    
    if (recentCombats.length >= 2) {
      const winRate = recentCombats.filter((outcome: any) => outcome.won).length / recentCombats.length;
      
      // If win rate > 80%, scale up difficulty
      if (winRate >= 0.8) {
        difficultyMultiplier *= 1.1; // 10% harder
        
        // Apply encounter-specific scaling
        if (encounterType === 'combat') {
          difficultyMultiplier *= 1.15; // Additional 15% for combat encounters
        }
      }
      // If win rate < 40%, scale down (player struggling)
      else if (winRate < 0.4) {
        difficultyMultiplier *= 0.85; // 15% easier
      }
    }
  }
  
  // Diplomat scaling: increase NPC resistance to dialogue if too successful
  if (playstyleVector.dominant === 'diplomat' && playstyleVector.diplomat > 0.7) {
    const socialHistory = state.player.recentDialogueOutcomes || [];
    const recentDialogues = socialHistory.slice(-3);
    
    if (recentDialogues.length >= 2) {
      const successRate = recentDialogues.filter((outcome: any) => outcome.succeeded).length / recentDialogues.length;
      if (successRate >= 0.85) {
        difficultyMultiplier *= 1.05; // Slightly increase NPC resistance
      }
    }
  }
  
  // Explorer scaling: increase hazard density and trap severity if too successful
  if (playstyleVector.dominant === 'explorer' && playstyleVector.explorer > 0.7) {
    const discoveryRate = state.player.locationsDiscoveredRecently || [];
    if (discoveryRate.length > 5) { // Too many discoveries recently
      difficultyMultiplier *= 1.08;
    }
  }
  
  return Math.min(3.0, Math.max(0.5, difficultyMultiplier)); // Clamp to 0.5x - 3.0x
}

/**
 * ALPHA_M8 Phase 2: Emit Audio Ducking for Narrative Moments
 * 
 * When the Director speaks important dialogue (relic whispers, ambient whispers),
 * this function emits SET_AUDIO_PARAM events to duck background audio for clarity.
 * 
 * This creates a clear audio focus on the narrative voice without interrupting playback.
 */
export function emitAudioDuckingForNarrative(
  state: WorldState,
  directorState: DirectorState,
  duckingDuration: number = 30  // Ticks to maintain ducking (approx 30-60 seconds game time)
): Event | null {
  // Trigger ducking only during high-tension narrative moments
  if (directorState.narrativeTension < 70) {
    return null;
  }

  // Check if we just emitted an ambient whisper
  const ticksSinceWhisper = (state.tick ?? 0) - directorState.lastAmbientWhisperTick;
  if (ticksSinceWhisper > duckingDuration) {
    return null; // No recent whisper to emphasize
  }

  return {
    id: `audio-ducking-${state.tick}`,
    worldInstanceId: state.id,
    actorId: 'director-audio',
    type: 'SET_AUDIO_PARAM',
    payload: {
      duckingAmount: 0.7,  // Reduce ambient to 30% volume (70% ducking)
      duckingDuration: Math.min(duckingDuration, Math.max(5, duckingDuration - ticksSinceWhisper)),
    },
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * ALPHA_M8 Phase 2: Emit "Paradox Hum" Audio Warning
 * 
 * When the player has accumulated high temporal debt (divergence > 0.7),
 * trigger a distinct audio signature: a low-frequency "paradox hum" that
 * gradually increases in intensity to warn of timeline instability.
 * 
 * This audio cue indicates reality is breaking down and consequences loom.
 */
export function emitParadoxHumWarning(
  state: WorldState,
  directorState: DirectorState
): Event | null {
  const temporalDebt = state.player.temporalDebt ?? 0;
  const divergenceRatio = temporalDebt / 100;  // Normalized to 0-1 (assuming max debt is ~100)

  // Only trigger if divergence is high (>70%)
  if (divergenceRatio < 0.7) {
    return null;
  }

  // Map divergence to audio effects
  // High divergence = higher frequency shift and more intense ducking
  const humIntensity = Math.min(0.8, divergenceRatio * 1.14);  // Scale to 0.0-0.8 range
  const frequencyShift = 50 + (divergenceRatio * 30);  // 50Hz baseline, up to 80Hz at high divergence

  // Emit SET_AUDIO_PARAM event to shift the ambient hum frequency
  return {
    id: `paradox-hum-${state.tick}`,
    worldInstanceId: state.id,
    actorId: 'director-paradox',
    type: 'SET_AUDIO_PARAM',
    payload: {
      // Future: could add 'tensionHumFrequency' when supported
      // For now, communicate via event that paradox hum should activate
      duckingAmount: Math.min(0.5, divergenceRatio * 0.7),  // Slight ducking during high divergence
      masterVolume: 1.0 - (divergenceRatio * 0.2),  // Subtle volume reduction under paradox
    },
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

/**
 * ====== NPC DIALOGUE SYNTHESIS LAYER ======
 * ALPHA_M21: Dynamic character-specific LLM prompts
 * Separates Director logic (system narrative) from NPC dialogue synthesis
 */

/**
 * Dialogue context from player interaction
 */
export interface DialogueContext {
  playerAction?: string; // 'greeted', 'attacked', 'gave_gift', etc.
  dialogue?: string; // Player's spoken text
  questState?: string; // Phase of any active quest with this NPC
  reputationDelta?: number; // Recent reputation changes
  previousMessages?: Array<{ role: 'npc' | 'player'; text: string }>; // Conversation history
}

/**
 * NPC knowledge scope - what the NPC knows/doesn't know (WTOL - What They Ought To Learn)
 */
export interface NpcKnowledgeScope {
  seenLocations: string[]; // Locations NPC has been to
  knownNpcs: string[]; // Other NPCs they know
  heardQuests: string[]; // Quests they've heard rumors about
  playerReputation: boolean; // Do they know player's general reputation?
  playerClass: boolean; // Do they know player's class/role?
  // M54-B1: Historical context
  ancestralGrandDeeds?: string[]; // Grand deeds from previous generations
  worldScarsInRange?: string[]; // World scars affecting current location or nearby
  ancestralCanonicalNames?: string[]; // Names of known ancestors/previous incarnations
}

/**
 * Character voice blueprint
 */
export interface CharacterVoice {
  tone: 'formal' | 'casual' | 'mysterious' | 'aggressive' | 'friendly';
  speechPattern: string;
  vocabulary: 'simple' | 'educated' | 'archaic' | 'technical';
  personalityAdjective: string;
}

/**
 * LLM API Configuration
 */
export interface LlmConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'groq' | 'ollama' | 'mock';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // M55-A1: BYOK support - fetch from localStorage if in browser
  useLocalStorageKey?: boolean;
  localStorageKeyName?: string; // e.g., 'gemini_api_key'
  // M55-A1: Fallback chain support
  fallbackProviders?: Array<'openai' | 'claude' | 'gemini' | 'groq' | 'ollama'>;
}

/**
 * M55-A1: Fetch NPC dialogue with global cache to prevent duplicate API hits
 * Uses Gemini 1.5 Flash by default for cost-effective BYOK deployment
 * 
 * @param prompt - The dialogue prompt to send to LLM
 * @param npcId - ID of the NPC for tracking purposes
 * @param dialogueCache - Reference to global dialogue cache in WorldState
 * @param config - LLM configuration (provider, model, API key strategy)
 * @returns Dialogue response from LLM or cache
 */
export async function fetchNpcDialogue(
  prompt: string,
  npcId: string,
  dialogueCache: Record<string, { response: string; timestamp: number }> = {},
  config: LlmConfig = {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    temperature: 0.8,
    maxTokens: 150,
    useLocalStorageKey: true,
    localStorageKeyName: 'gemini_api_key'
  }
): Promise<string> {
  // M55-A1: Generate simple hash of prompt for cache key
  const promptHash = simpleHashPrompt(prompt);
  const cacheKey = `${npcId}_${promptHash}`;

  // M55-A1: Check cache first
  if (dialogueCache[cacheKey]) {
    const cached = dialogueCache[cacheKey];
    const cacheAgeMs = Date.now() - cached.timestamp;
    const maxCacheAgeMs = 24 * 60 * 60 * 1000; // 24 hours

    if (cacheAgeMs < maxCacheAgeMs) {
      return cached.response;
    }
  }

  // Not in cache, call LLM API
  const response = await callLlmApi(prompt, config);

  // Store in cache with timestamp
  dialogueCache[cacheKey] = {
    response,
    timestamp: Date.now()
  };

  return response;
}

/**
 * M55-A1: Simple hash function for prompt caching
 * Generates a deterministic short hash from a string
 */
function simpleHashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 12);
}

/**
 * Call LLM API to generate NPC dialogue response
 * Supports multiple providers: OpenAI GPT-4, Claude, Gemini, or mock responses
 */
export async function callLlmApi(
  prompt: string,
  config: LlmConfig = { provider: 'openai', model: 'gpt-4', temperature: 0.8, maxTokens: 150 }
): Promise<string> {
  // If mock mode, return a procedural response
  if (config.provider === 'mock') {
    return mockLlmResponse(prompt);
  }

  // M55-A1: Attempt to get API key from browser localStorage if BYOK enabled
  let apiKey = config.apiKey;
  if (config.useLocalStorageKey && typeof localStorage !== 'undefined') {
    const keyName = config.localStorageKeyName || `${config.provider}_api_key`;
    const storageKey = localStorage.getItem(keyName);
    if (storageKey) {
      apiKey = storageKey;
    }
  }

  // Get API key from environment or config
  if (!apiKey) {
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
  }

  // M55-A1: Try primary provider first, then fallback chain
  const providersToTry: Array<'openai' | 'claude' | 'gemini' | 'groq' | 'ollama'> = [config.provider as unknown as 'openai' | 'claude' | 'gemini' | 'groq' | 'ollama'];
  
  // Add configured fallbacks
  if (config.fallbackProviders) {
    providersToTry.push(...config.fallbackProviders);
  } else {
    // Default fallback chain: Gemini -> Groq -> Ollama -> Template
    providersToTry.push('gemini', 'groq', 'ollama');
  }

  for (const provider of providersToTry) {
    try {
      let providerApiKey = apiKey;
      
      // Try to get provider-specific API key from localStorage
      if (typeof localStorage !== 'undefined') {
        const specificKey = localStorage.getItem(`${provider}_api_key`);
        if (specificKey) {
          providerApiKey = specificKey;
        }
      }

      // Ollama doesn't need an API key
      if (provider === 'ollama' || providerApiKey) {
        if (provider === 'openai') {
          return await callOpenAiApi(prompt, providerApiKey || '', config);
        } else if (provider === 'claude') {
          return await callClaudeApi(prompt, providerApiKey || '', config);
        } else if (provider === 'gemini') {
          return await callGeminiApi(prompt, providerApiKey || '', config);
        } else if (provider === 'groq') {
          return await callGroqApi(prompt, providerApiKey || '', config);
        } else if (provider === 'ollama') {
          return await callOllamaApi(prompt, '', config);
        }
      }
    } catch (error) {
      console.warn(`[M55-A1] ${provider} provider failed, trying next fallback:`, error);
      // Continue to next provider
    }
  }

  // All providers failed, return template fallback
  console.warn('[M55-A1] All LLM providers exhausted, using template fallback');
  return mockLlmResponse(prompt);
}

/**
 * Call OpenAI API (GPT-4 or GPT-3.5-turbo)
 */
async function callOpenAiApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const model = config.model || 'gpt-4-turbo-preview';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json() as unknown;
  return data?.choices?.[0]?.message?.content || mockLlmResponse(prompt);
}

/**
 * Call Claude/Anthropic API
 */
async function callClaudeApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  const model = config.model || 'claude-3-sonnet-20240229';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error (${response.status}): ${error}`);
  }

  const data = await response.json() as unknown;
  return data?.content?.[0]?.text || mockLlmResponse(prompt);
}

/**
 * M55-A1: Call Google Gemini API (1.5 Flash) for cost-effective NPC dialogue
 */
async function callGeminiApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
  const model = config.model || 'gemini-1.5-flash';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.9,
        topK: 40
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE'
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = await response.json() as unknown;
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    console.warn('[M55-A1] Gemini API returned empty response, returning mock');
    return mockLlmResponse(prompt);
  }

  return generatedText;
}

/**
 * M55-A1: Call Groq API (Llama 3 inference via cloud)
 * Cost-effective alternative to Gemini with fast inference
 */
async function callGroqApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1';
  const model = config.model || 'llama-3-70b-versatile';
  const temperature = config.temperature ?? 0.8;
  const maxTokens = config.maxTokens ?? 150;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Groq API error (${response.status}): ${error}`);
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }

  const data = await response.json() as unknown;
  const generatedText = data?.choices?.[0]?.message?.content;
  
  if (!generatedText) {
    console.warn('[M55-A1] Groq API returned empty response');
    return mockLlmResponse(prompt);
  }

  return generatedText;
}

/**
 * M55-A1: Call Ollama API (local LLM inference)
 * Requires Ollama running locally at specified baseUrl (default: http://localhost:11434)
 */
async function callOllamaApi(
  prompt: string,
  apiKey: string,
  config: LlmConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  const model = config.model || 'llama2';
  const temperature = config.temperature ?? 0.8;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: `System: You are a dynamic NPC in a fantasy RPG game. Respond concisely with emotion and personality.\n\nUser: ${prompt}`,
        temperature,
        stream: false,
        num_predict: config.maxTokens ?? 150
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Ollama API error (${response.status}): ${error}`);
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = await response.json() as unknown;
    const generatedText = data?.response?.trim();
    
    if (!generatedText) {
      console.warn('[M55-A1] Ollama API returned empty response');
      return mockLlmResponse(prompt);
    }

    return generatedText;
  } catch (error) {
    console.error('[M55-A1] Ollama connection failed (is it running at ' + baseUrl + '?)', error);
    throw error;
  }
}

/**
 * Generate mock LLM response when API is unavailable
 * Uses procedural generation to create plausible NPC dialogue
 */
function mockLlmResponse(prompt: string): string {
  const tones = [
    '*nods thoughtfully* ',
    '*sighs* ',
    '*grins* ',
    '*looks serious* ',
    '*chuckles* ',
    '*shifts uncomfortably* ',
    '*holds your gaze* '
  ];

  const responses = [
    'I understand. That matters to me.',
    'Interesting. What brings it up?',
    'Perhaps you\'re right about that.',
    'I hadn\'t thought of it that way before.',
    'That\'s... a fair point.',
    'Very well. As you wish.',
    'Time will tell what comes of this.'
  ];

  const randomStage = tones[Math.floor(Math.random() * tones.length)];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  return `${randomStage}"${randomResponse}"`;
}

/**
 * Generate the Character Blueprint section of the prompt
 */
function generateCharacterBlueprint(npc: NPC, voice?: CharacterVoice): string {
  const factionNote = npc.factionId ? `You are a ${npc.factionRole || 'member'} of the ${npc.factionId}.` : '';
  const toneDesc = voice?.tone || 'neutral';
  const vocabLevel = voice?.vocabulary || 'educated';
  const personalityNote = voice?.personalityAdjective ? `Your personality could be described as ${voice.personalityAdjective}.` : '';
  
  return `
## Character Blueprint: ${npc.name}
### Identity
- Role: ${npc.factionRole || 'Independent'}
- Importance Level: ${npc.importance || 'minor'}
${factionNote ? `- Faction Affiliation: ${factionNote}` : ''}

### Voice & Speech
- Tone: ${toneDesc} (speak in a ${toneDesc} manner)
- Vocabulary: ${vocabLevel} (use ${vocabLevel} language)
- Speech Pattern: ${voice?.speechPattern || 'standard'}
${personalityNote ? `- Personality: ${personalityNote}` : ''}

### Dialogue Guidelines
- Stay in character at all times
- React authentically to the player's actions and words
- Remember your relationship with the player (see Emotional State below)
`.trim();
}

/**
 * Generate the Environmental Context section
 */
function generateEnvironmentalContext(state: WorldState, npc: NPC, dialogueContext?: DialogueContext): string {
  const currentLocation = state.locations?.find(l => l.id === npc.locationId);
  const weather = state.weather || 'clear';
  const dayPhase = state.dayPhase || 'day';
  const season = state.season || 'spring';
  const currentHour = state.hour || 12;
  
  let environmentNote = '';
  if (currentLocation) {
    environmentNote = `You are currently in ${currentLocation.name}.`;
  }
  
  return `
## Environmental Context
### Setting
${environmentNote}
- Weather: ${weather}
- Time: ${currentHour}:00 (${dayPhase})
- Season: ${season}

### Atmosphere
- The world feels: ${generateAtmosphereFromTension(state)}
- Recent events in this area: ${generateRecentEventsNote(state, npc)}
`.trim();
}

/**
 * Generate description of world tension/atmosphere
 */
function generateAtmosphereFromTension(state: WorldState): string {
  const tension = calculateQuickTension(state);
  
  if (tension > 75) return 'tense and dangerous, on the edge of conflict';
  if (tension > 50) return 'uneasy, with undercurrents of unrest';
  if (tension > 25) return 'somewhat unsettled, with occasional rumors';
  return 'peaceful and calm';
}

/**
 * Quick tension calculation helper
 */
function calculateQuickTension(state: WorldState): number {
  let tension = 0;
  const activeConflicts = state.factionConflicts?.filter((c: FactionConflict) => c.active) || [];
  tension += activeConflicts.length * 15;
  
  let activeScarCount = 0;
  for (const location of state.locations || []) {
    const scars = location.activeScars || [];
    activeScarCount += scars.length;
  }
  tension += Math.min(30, activeScarCount * 10);
  
  return Math.max(0, Math.min(100, tension));
}

/**
 * Generate recent events context
 */
function generateRecentEventsNote(state: WorldState, npc: NPC): string {
  const conflicts = state.factionConflicts?.filter((c: FactionConflict) => c.active) || [];
  if (conflicts.some(c => c.factionIds?.includes(npc.factionId))) {
    return 'Armed conflict involving your faction';
  }
  
  const scars = state.locations?.flatMap((l: Location) => (l.activeScars || []).map(s => s.description)) || [];
  if (scars.length > 0) {
    return scars.slice(0, 2).join('; ');
  }
  
  return 'No major disturbances';
}

/**
 * Generate the Resonance/Emotional State section
 */
function generateResonanceWeights(npc: NPC, dialogueContext?: DialogueContext): string {
  const emotionalState = npc.emotionalState || {
    trust: 50,
    fear: 50,
    gratitude: 50,
    resentment: 50
  };

  const { trust, fear, gratitude, resentment } = emotionalState;
  
  let emotionalTone = '';
  if (trust > 70 && gratitude > 70) {
    emotionalTone = 'The NPC genuinely likes you and wants to help.';
  } else if (fear > 70) {
    emotionalTone = 'The NPC is visibly nervous or wary around you.';
  } else if (resentment > 70) {
    emotionalTone = 'The NPC holds a grudge and speaks with underlying hostility.';
  } else if (trust > 60) {
    emotionalTone = 'The NPC is friendly and open.';
  } else if (fear > 60 || resentment > 60) {
    emotionalTone = 'The NPC is guarded and somewhat suspicious.';
  } else {
    emotionalTone = 'The NPC is neutral, polite but distant.';
  }

  let reactionModifier = '';
  if (dialogueContext?.playerAction === 'gave_gift' && gratitude > 60) {
    reactionModifier = 'The NPC is particularly pleased and friendly right now.';
  } else if (dialogueContext?.playerAction === 'attacked') {
    reactionModifier = `The NPC is clearly disturbed and may refuse to talk. React with appropriate alarm/anger.`;
  } else if (dialogueContext?.reputationDelta && dialogueContext.reputationDelta > 10) {
    reactionModifier = `The NPC recently heard something positive about you. Respond with cautious optimism.`;
  } else if (dialogueContext?.reputationDelta && dialogueContext.reputationDelta < -10) {
    reactionModifier = `The NPC recently heard something negative about you. Show appropriate skepticism or hostility.`;
  }

  return `
## Resonance & Emotional State
### Current Feelings Toward Player
- Trust level: ${trust}/100 ${trustDescriptor(trust)}
- Fear level: ${fear}/100 ${fearDescriptor(fear)}
- Gratitude: ${gratitude}/100
- Resentment: ${resentment}/100

### Emotional Tone
${emotionalTone}
${reactionModifier ? `\n### Recent Context\n${reactionModifier}` : ''}

### Behavioral Modulation
Based on the above emotional state, respond with authenticity:
- Do NOT ignore or override your feelings toward this player
- If afraid, show nervousness in your mannerisms and speech
- If grateful, be more helpful and open
- If resentful, let it show in subtle ways (withholding info, reluctance, sarcasm)
`.trim();
}

/**
 * Quick descriptor for trust level
 */
function trustDescriptor(trust: number): string {
  if (trust > 75) return '(Very High - treats you like an ally)';
  if (trust > 50) return '(Moderate - sees you as generally trustworthy)';
  if (trust < 25) return '(Very Low - views you with suspicion)';
  if (trust < 50) return '(Low - cautious around you)';
  return '(Neutral - no strong feelings)';
}

/**
 * Quick descriptor for fear level
 */
function fearDescriptor(fear: number): string {
  if (fear > 75) return '(Very High - acutely afraid of you)';
  if (fear > 50) return '(Moderate - somewhat nervous)';
  if (fear < 25) return '(Very Low - completely at ease)';
  if (fear < 50) return '(Low - mildly cautious)';
  return '(Neutral - no particular fear)';
}

/**
 * Generate WTOL (What They Ought To Learn) filters
 */
function generateWTOLFilters(npc: NPC, state: WorldState, knowledgeScope?: NpcKnowledgeScope): string {
  const seenLocations = knowledgeScope?.seenLocations || [];
  const knownNpcs = knowledgeScope?.knownNpcs || [];

  return `
## Information Boundaries (WTOL - What They Ought To Learn)
### What This NPC Knows
- Locations they've been: ${seenLocations.length > 0 ? seenLocations.join(', ') : 'only their current location'}
- Other NPCs they know about: ${knownNpcs.length > 0 ? knownNpcs.join(', ') : 'few people'}
- Rumors they've heard: Basic gossip from their local area only
${knowledgeScope?.playerReputation ? '- They know your general reputation in town' : '- They know little about your background'}
${knowledgeScope?.playerClass ? '- They can see/know your class/profession' : '- Your abilities are somewhat mysterious to them'}

### Strict Constraints
- DO NOT reveal information outside this NPC's knowledge scope
- DO NOT break character to explain game mechanics
- DO NOT confirm player theories unless this NPC would reasonably know
- DO NOT fabricate detailed lore beyond what fits this NPC's life
- DO describe physical details, emotions, and sensory information
- DO respond authentically to the player's actions and tone
`.trim();
}

/**
 * M54-B1: Generate historical context from ancestral deeds and world scars
 */
function generateHistoricalContext(npc: NPC, knowledgeScope?: NpcKnowledgeScope): string {
  const ancestralDeeds = knowledgeScope?.ancestralGrandDeeds || [];
  const worldScars = knowledgeScope?.worldScarsInRange || [];
  const ancestorNames = knowledgeScope?.ancestralCanonicalNames || [];

  if (ancestralDeeds.length === 0 && worldScars.length === 0) {
    return '';
  }

  let context = '\n## Historical Context (M54-B1)';
  
  if (ancestorNames.length > 0) {
    context += `\n### Known Ancestors\n${ancestorNames.map(name => `- ${name}`).join('\n')}`;
  }

  if (ancestralDeeds.length > 0) {
    context += `\n### Ancestral Deeds (Legends from times past)\n${ancestralDeeds.map(deed => `- ${deed}`).join('\n')}`;
  }

  if (worldScars.length > 0) {
    context += `\n### World Scars (Places of historical significance)\n${worldScars.map(scar => `- ${scar}`).join('\n')}\nNote: These scars may deeply affect this NPC's emotional responses and recollections.`;
  }

  return context.trim();
}

/**
 * Generate conversation history context
 */
function generateConversationHistory(context: DialogueContext): string {
  if (!context.previousMessages || context.previousMessages.length === 0) {
    return '### First Meeting\nThis is the first time the player has spoken to you in this conversation.';
  }

  let history = '### Recent Conversation\n';
  for (const msg of context.previousMessages.slice(-4)) {
    const speaker = msg.role === 'npc' ? 'You' : 'Player';
    history += `**${speaker}**: ${msg.text}\n`;
  }

  return history;
}

/**
 * M26: Generate playstyle context for adaptive NPC dialogue
 * Adapts NPC tone and behavior based on observed player behavior patterns
 */
function generatePlaystyleContext(npc: NPC, playstyle: PlaystyleProfile): string {
  const { dominantPlaystyle, characterProfile, moralAlignment, riskAssessment } = playstyle;
  
  let npcAdjustment = '';
  let toneShift = '';
  let responseStrategy = '';

  // Adjust NPC behavior based on player playstyle
  switch (dominantPlaystyle) {
    case 'combatant':
      npcAdjustment = `The player shows strong combat prowess and prefers direct action (${characterProfile.combatFrequency}% combat).`;
      toneShift = 'Respect physical capability; mention combat credentials. Be direct and honor strength.';
      responseStrategy = 'They appreciate straightforward conversation and military/tactical discussion. Avoid lengthy philosophy.';
      break;

    case 'socialite':
      npcAdjustment = `The player is a skilled negotiator and conversationalist (${characterProfile.socialFrequency}% social interactions).`;
      toneShift = 'Use more intricate language and social subtext. Engage in gossip and relationship dynamics.';
      responseStrategy = 'They read social cues well; use indirect statements and layered meaning. Include rumors and faction politics.';
      break;

    case 'explorer':
      npcAdjustment = `The player is an adventurer and explorer (${characterProfile.explorationFrequency}% exploration).`;
      toneShift = 'Show wonder and mystery. Reference distant lands and undiscovered places.';
      responseStrategy = 'They value curiosity; provide cryptic clues and environmental details. Hint at hidden areas and secrets.';
      break;

    case 'ritualist':
      npcAdjustment = `The player commands arcane and ritual magic (${characterProfile.ritualFrequency}% magical actions).`;
      toneShift = 'Acknowledge supernatural understanding. Use mystical language and cosmic references.';
      responseStrategy = 'They understand complex consequences; reference paradox, mana, and otherworldly effects. Be verbose about magical theory.';
      break;

    case 'crafter':
      npcAdjustment = `The player focuses on creation and crafting (${characterProfile.craftingFrequency}% crafting).`;
      toneShift = 'Discuss materials, techniques, and creation. Show respect for craftsmanship.';
      responseStrategy = 'They appreciate practical knowledge; discuss recipe details and material sources. Ask about their creations.';
      break;

    case 'balanced':
      npcAdjustment = `The player is well-rounded with diverse interests.`;
      toneShift = 'Remain adaptable; mix conversational styles based on topic.';
      responseStrategy = 'They approach situations from multiple angles. Offer varied options and acknowledge flexibility.';
      break;
  }

  // Moral alignment affect
  let alignmentInfluence = '';
  if (moralAlignment.alignment > 20) {
    alignmentInfluence = 'The player\'s actions suggest good intentions; they might respond to appeals to honor or mercy. Good NPCs trust them.';
  } else if (moralAlignment.alignment < -20) {
    alignmentInfluence = 'The player\'s actions are self-serving or cruel; they are feared. Evil NPCs respect ruthlessness.';
  } else {
    alignmentInfluence = 'The player is pragmatic; they act based on circumstances rather than principle.';
  }

  // Risk profile affect
  const riskInfluence = riskAssessment.riskTakingRatio > 0.3
    ? 'This player takes bold risks: they might attempt unlikely actions. Show respect for bravery, even if foolish.'
    : 'This player is careful and methodical: they calculate before acting. They appreciate strategic advice.';

  const sections = [
    `## Player Persona (Observed Behavioral Profile)`,
    npcAdjustment,
    '',
    `### Adjust Your Dialogue Tone`,
    toneShift,
    '',
    `### How You Respond`,
    responseStrategy,
    '',
    `### Moral Reading`,
    alignmentInfluence,
    '',
    `### Risk Profile`,
    riskInfluence
  ];

  return sections.join('\n');
}

/**
 * Main synthesis function: Generates a comprehensive LLM prompt for NPC dialogue
 * 
 * @param npcId - The NPC's ID
 * @param state - Current WorldState
 * @param context - Dialogue context from player interaction
 * @param knowledgeScope - Optional WTOL scope limiting NPC knowledge
 * @returns Full prompt string for LLM
 */
export function generateNpcPrompt(
  npcId: string,
  state: WorldState,
  context?: DialogueContext,
  knowledgeScope?: NpcKnowledgeScope,
  playstyleProfile?: PlaystyleProfile
): string {
  const npc = state.npcs?.find(n => n.id === npcId);
  if (!npc) {
    throw new Error(`NPC with ID ${npcId} not found in world state`);
  }

  const voice = deriveVoiceFromNpc(npc);

  const sections = [
    '# NPC Dialogue Synthesis Prompt',
    '## System Instructions',
    'You are roleplaying an NPC in a fantasy RPG. Generate authentic, in-character dialogue that:',
    '- Reflects the character sheet below',
    '- Acknowledges the current emotional state toward the player',
    '- Respects information boundaries (you don\'t know things outside your experience)',
    '- Uses sensory details and authentic emotional reactions',
    '- Never breaks character or acknowledges this prompt',
    '',
    generateCharacterBlueprint(npc, voice),
    '',
    generateEnvironmentalContext(state, npc, context),
    '',
    generateResonanceWeights(npc, context),
    '',
    generateWTOLFilters(npc, state, knowledgeScope),
    '',
    generateHistoricalContext(npc, knowledgeScope), // M54-B1: Add ancestral/scar context
  ];

  // Filter out empty strings from sections
  const filteredSections = sections.filter(s => s && s.trim().length > 0);

  // M26: Add playstyle context if available
  if (playstyleProfile) {
    filteredSections.push('');
    filteredSections.push(generatePlaystyleContext(npc, playstyleProfile));
  }

  if (context?.previousMessages) {
    filteredSections.push('');
    filteredSections.push(generateConversationHistory(context));
  }

  if (context?.dialogue) {
    filteredSections.push('');
    filteredSections.push('## Current Dialogue');
    filteredSections.push(`**Player says**: "${context.dialogue}"`);
    filteredSections.push('');
    filteredSections.push('**Output your response below.** Include stage directions like *[sighs]* or *[looks away]* for narrative flavor:');
  }

  return filteredSections.join('\n');
}

/**
 * Derive voice characteristics from NPC faction/personality
 */
function deriveVoiceFromNpc(npc: NPC): CharacterVoice {
  const factionRole = npc.factionRole || 'member';

  let tone: CharacterVoice['tone'] = 'casual';
  if (factionRole === 'leader') tone = 'formal';
  if (factionRole === 'soldier') tone = 'aggressive';
  if (factionRole === 'informant') tone = 'mysterious';
  if (factionRole === 'merchant') tone = 'friendly';

  let vocabulary: CharacterVoice['vocabulary'] = 'educated';
  if (factionRole === 'peasant' || factionRole === 'guard') vocabulary = 'simple';
  if (factionRole === 'scholar' || factionRole === 'noble') vocabulary = 'archaic';

  const quirks = ['', 'aye', 'm\'lord/m\'lady', 'eh?', '*chuckles*', 'forsooth', 'innit'];
  const speechPattern = quirks[Math.floor(Math.random() * quirks.length)];

  return {
    tone,
    vocabulary,
    speechPattern,
    personalityAdjective: derivePersonalityFromEmotions(npc)
  };
}

/**
 * Derive personality adjective from NPC emotional state
 */
function derivePersonalityFromEmotions(npc: NPC & Partial<{ emotionalState: Record<string, number> }>): string {
  const emotions = npc.emotionalState || { trust: 50, fear: 50, resentment: 50, gratitude: 50 };

  if (emotions.fear > 70) return 'anxious';
  if (emotions.resentment > 70) return 'bitter';
  if (emotions.trust > 70) return 'optimistic';
  if ((emotions as Record<string, number>).gratitude > 70) return 'grateful';

  return 'neutral';
}

/**
 * Parse LLM response into structured dialogue
 */
export function parseNpcResponse(response: string): { stageDirection?: string; dialogue: string } {
  const stageDirectionRegex = /^\*([^*]+)\*\s+(.*)$/;
  const match = response.match(stageDirectionRegex);

  if (match) {
    return {
      stageDirection: match[1],
      dialogue: match[2]
    };
  }

  return {
    dialogue: response.trim()
  };
}

/**
 * Utility: Apply emotional decay over time
 */
export function applyEmotionalDecay(npc: NPC & Partial<{ lastEmotionalDecay: number }>, state: WorldState, decayPerDay: number = 2): void {
  if (!npc.emotionalState) return;

  const lastDecay = npc.lastEmotionalDecay || 0;
  const ticksPerDay = 1440;
  const timeSinceDecay = (state.tick ?? 0) - lastDecay;

  if (timeSinceDecay >= ticksPerDay) {
    const daysElapsed = Math.floor(timeSinceDecay / ticksPerDay);
    const totalDecay = decayPerDay * daysElapsed;

    npc.emotionalState.trust = Math.max(0, Math.min(100, npc.emotionalState.trust + (npc.emotionalState.trust < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.fear = Math.max(0, Math.min(100, npc.emotionalState.fear + (npc.emotionalState.fear < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.gratitude = Math.max(0, Math.min(100, npc.emotionalState.gratitude + (npc.emotionalState.gratitude < 50 ? totalDecay : -totalDecay)));
    npc.emotionalState.resentment = Math.max(0, Math.min(100, npc.emotionalState.resentment + (npc.emotionalState.resentment < 50 ? totalDecay : -totalDecay)));

    npc.lastEmotionalDecay = state.tick;
  }
}
