/**
 * Analytics Engine (Phase 2: Alpha) + Temporal Divergence (ALPHA_M5)
 * 
 * Purpose: 
 * 1. Track player decisions and feedback patterns for AI adaptation
 * 2. Measure temporal divergence (Golden Path → how far reality has strayed)
 * 3. Detect bit-drift in replay integrity
 * 4. Provide dev tools for state analysis and determinism validation
 * 
 * Key Features:
 * - Log player actions and choices
 * - Track success/failure patterns
 * - Identify player preferences (combat vs. social, etc.)
 * - Generate heatmaps of exploration patterns
 * - Calculate temporal divergence score (0-100)
 * - Validate replay integrity (bit-identical detection)
 * - Provide dev-only dashboard for decision analysis
 * - Use analytics to improve AI DM adaptation
 */

import type { Action } from './actionPipeline';
import type { Event } from '../events/mutationLog';
import type { WorldState } from './worldEngine';

export interface DecisionAnalytic {
  tick: number;
  actionType: string;
  context: string;
  outcome: 'success' | 'failure' | 'neutral';
  engagementScore: number; // 0-100, how engaged was player
}

/**
 * ALPHA_M14: Playstyle Vectors - Tracks player behavior across three axes
 * Each value is 0.0 to 1.0, representing player tendency:
 * - combatant: 1.0 = combat-focused, 0.0 = avoids combat
 * - diplomat: 1.0 = dialogue-heavy, 0.0 = avoids social
 * - explorer: 1.0 = discovery-focused, 0.0 = stays in familiar areas
 */
export interface PlaystyleVector {
  combatant: number;    // 0.0-1.0: Combat engagement
  diplomat: number;     // 0.0-1.0: Social engagement
  explorer: number;     // 0.0-1.0: Exploration engagement
  dominant: 'combatant' | 'diplomat' | 'explorer' | 'hybrid';
}

export interface PlayerPreferences {
  preferredActionType: string; // 'combat', 'social', 'exploration'
  playstyleVector: PlaystyleVector;
  combatEngagement: number;
  socialEngagement: number;
  explorationEngagement: number;
  preferredDifficulty: number;
}

export interface EngagementHeatmap {
  locationId: string;
  visits: number;
  durationTicks: number;
  eventCount: number;
  engagementScore: number;
}

/**
 * M26: Playstyle Profile Interfaces
 * Tracks player behavior patterns for AI DM adaptation
 */
export interface CharacterProfile {
  combatFrequency: number;      // 0.0-1.0: How often fights
  socialFrequency: number;       // 0.0-1.0: How often converses
  explorationFrequency: number;  // 0.0-1.0: How often explores
  ritualFrequency: number;       // 0.0-1.0: How often performs rituals
  craftingFrequency: number;     // 0.0-1.0: How often crafts
}

export interface RiskAssessment {
  lowRollRiskTaking: number;    // Willingness to gamble on low rolls
  highRollConfidence: number;   // Confidence when rolling high
  riskTakingRatio: number;      // 0.0-1.0: Overall risk tolerance
  averageSuccessRate: number;   // 0.0-1.0: Player success percentage
}

export interface MoralAlignment {
  goodChoices: number;          // Count of compassionate decisions
  evilChoices: number;          // Count of cruel decisions
  neutralChoices: number;       // Count of pragmatic decisions
  alignment: number;            // -100 to +100: -100 evil, +100 good, 0 neutral
}

export interface PlaystyleProfile {
  characterProfile: CharacterProfile;
  riskAssessment: RiskAssessment;
  moralAlignment: MoralAlignment;
  generatedAt: string;          // ISO timestamp
  dominantPlaystyle: string;    // 'combatant' | 'socialite' | 'explorer' | 'ritualist' | 'crafter' | 'balanced'
  profileVersion: number;       // Version for schema evolution
}

/**
 * Record a player action with outcome
 * ALPHA_M14: Enhanced with engagement score calculation
 */
export function recordDecision(
  action: Action,
  outcome: 'success' | 'failure' | 'neutral',
  context: string,
  tick: number
): DecisionAnalytic {
  // Calculate engagement score based on action type and outcome
  let engagementScore = 50; // Baseline neutral
  
  // Action type engagement boost
  if (action.type === 'ATTACK' || action.type === 'CAST_SPELL') {
    engagementScore = 85; // Combat is highly engaging
  } else if (action.type === 'TALK' || action.type === 'PERSUADE') {
    engagementScore = 80; // Dialogue is engaging
  } else if (action.type === 'EXAMINE' || action.type === 'INTERACT') {
    engagementScore = 70; // Exploration is moderately engaging
  } else if (action.type === 'MOVE' || action.type === 'WAIT') {
    engagementScore = 30; // Movement/waiting is low engagement
  }
  
  // Outcome modifier
  if (outcome === 'success') {
    engagementScore = Math.min(100, engagementScore + 15);
  } else if (outcome === 'failure') {
    engagementScore = Math.min(100, engagementScore + 10); // Even failures are engaging
  }
  
  return {
    tick,
    actionType: action.type,
    context,
    outcome,
    engagementScore: Math.max(0, Math.min(100, engagementScore))
  };
}

/**
 * Analyze player preferences from history
 * ALPHA_M14: Implements Playstyle Vector analysis
 * Returns normalized vectors (0.0-1.0) for player archetypes
 */
export function calculatePlayerPreferences(
  analytics: DecisionAnalytic[]
): PlayerPreferences {
  const total = analytics.length || 1;
  
  // Count actions by type
  let combatActions = 0;
  let socialActions = 0;
  let explorationActions = 0;
  let combatEngagement = 0;
  let socialEngagement = 0;
  let explorationEngagement = 0;
  let totalEngagement = 0;
  let difficultySum = 5; // Base difficulty 5
  
  for (const analytic of analytics) {
    totalEngagement += analytic.engagementScore;
    
    // Categorize action type
    if (analytic.actionType === 'ATTACK' || analytic.actionType === 'CAST_SPELL' || analytic.actionType === 'DEFEND') {
      combatActions++;
      combatEngagement += analytic.engagementScore;
    } else if (analytic.actionType === 'TALK' || analytic.actionType === 'PERSUADE' || analytic.actionType === 'INTIMIDATE') {
      socialActions++;
      socialEngagement += analytic.engagementScore;
    } else if (analytic.actionType === 'EXAMINE' || analytic.actionType === 'INSPECT' || analytic.actionType === 'MOVE') {
      explorationActions++;
      explorationEngagement += analytic.engagementScore;
    }
    
    // Track success/failure for difficulty adjustment
    if (analytic.outcome === 'failure') {
      difficultySum -= 0.5; // Failures suggest difficulty too high
    } else if (analytic.outcome === 'success') {
      difficultySum += 0.2; // Successes are good, minor boost
    }
  }
  
  // Calculate playstyle vector normalized to 0.0-1.0
  const combatVector = combatActions > 0 ? Math.min(1.0, combatActions / total) : 0;
  const socialVector = socialActions > 0 ? Math.min(1.0, socialActions / total) : 0;
  const explorerVector = explorationActions > 0 ? Math.min(1.0, explorationActions / total) : 0;
  
  // Determine dominant playstyle
  let dominant: 'combatant' | 'diplomat' | 'explorer' | 'hybrid' = 'hybrid';
  if (combatVector > 0.5 && combatVector > socialVector && combatVector > explorerVector) {
    dominant = 'combatant';
  } else if (socialVector > 0.5 && socialVector > combatVector && socialVector > explorerVector) {
    dominant = 'diplomat';
  } else if (explorerVector > 0.5 && explorerVector > combatVector && explorerVector > socialVector) {
    dominant = 'explorer';
  }
  
  // Clamp difficulty to valid range
  const preferredDifficulty = Math.max(1, Math.min(10, Math.floor(difficultySum)));
  
  // Calculate average engagement per category
  const avgCombatEngagement = combatActions > 0 ? Math.floor(combatEngagement / combatActions) : 0;
  const avgSocialEngagement = socialActions > 0 ? Math.floor(socialEngagement / socialActions) : 0;
  const avgExplorationEngagement = explorationActions > 0 ? Math.floor(explorationEngagement / explorationActions) : 0;
  
  return {
    preferredActionType: dominant,
    playstyleVector: {
      combatant: combatVector,
      diplomat: socialVector,
      explorer: explorerVector,
      dominant
    },
    combatEngagement: avgCombatEngagement,
    socialEngagement: avgSocialEngagement,
    explorationEngagement: avgExplorationEngagement,
    preferredDifficulty
  };
}

/**
 * Create heatmap of player exploration
 * ALPHA_M14: Enhanced with engagement tracking
 */
export function generateExplorationHeatmap(
  analytics: DecisionAnalytic[],
  locations: any[]
): EngagementHeatmap[] {
  // Group analytics by location context
  const locationMap = new Map<string, DecisionAnalytic[]>();
  
  for (const analytic of analytics) {
    const locId = analytic.context || 'unknown';
    if (!locationMap.has(locId)) {
      locationMap.set(locId, []);
    }
    locationMap.get(locId)!.push(analytic);
  }
  
  // Generate heatmap for each location
  const heatmaps: EngagementHeatmap[] = [];
  
  for (const loc of locations) {
    const analytics = locationMap.get(loc.id) || [];
    const engagementAvg = analytics.length > 0 
      ? Math.floor(analytics.reduce((sum, a) => sum + a.engagementScore, 0) / analytics.length)
      : 0;
    
    heatmaps.push({
      locationId: loc.id,
      visits: analytics.length,
      durationTicks: analytics.length * 5, // Rough estimate: 5 ticks per action
      eventCount: analytics.length,
      engagementScore: engagementAvg
    });
  }
  
  return heatmaps;
}

/**
 * Identify struggle points (high failure rate areas)
 * ALPHA_M14: Returns areas where player struggles
 */
export function identifyStrugglePoints(
  analytics: DecisionAnalytic[]
): { actionType: string; failureRate: number; location: string }[] {
  // Group by action type and location
  const combinations = new Map<string, { total: number; failures: number; location: string }>();
  
  for (const analytic of analytics) {
    const key = `${analytic.actionType}:${analytic.context}`;
    
    if (!combinations.has(key)) {
      combinations.set(key, { total: 0, failures: 0, location: analytic.context });
    }
    
    const entry = combinations.get(key)!;
    entry.total++;
    if (analytic.outcome === 'failure') {
      entry.failures++;
    }
  }
  
  // Calculate failure rates and filter for struggle points
  const struggles: { actionType: string; failureRate: number; location: string }[] = [];
  
  for (const [key, entry] of Array.from(combinations.entries())) {
    if (entry.total >= 3) { // Need at least 3 attempts to qualify
      const failureRate = entry.failures / entry.total;
      if (failureRate > 0.4) { // > 40% failure rate
        const [actionType] = key.split(':');
        struggles.push({
          actionType,
          failureRate,
          location: entry.location
        });
      }
    }
  }
  
  // Sort by failure rate (worst first)
  return struggles.sort((a, b) => b.failureRate - a.failureRate);
}

/**
 * Generate AI adaptation recommendations
 * ALPHA_M14: Uses playstyle vectors to suggest Director nudges
 */
export function suggestAIAdaptations(
  preferences: PlayerPreferences,
  analytics: DecisionAnalytic[]
): {
  suggestedPacing: 'slow' | 'normal' | 'fast';
  suggestedEncounterType: string;
  adaptDifficulty: number; // multiplier: 0.8 = easier, 1.2 = harder
  directorNudge?: string;
} {
  const vector = preferences.playstyleVector;
  let pacing: 'slow' | 'normal' | 'fast' = 'normal';
  let encounterType = 'exploration';
  let difficulty = 1.0;
  let directorNudge = '';
  
  // Analyze engagement trends from recent actions
  const recentAnalytics = analytics.slice(-20); // Last 20 actions
  const avgRecentEngagement = recentAnalytics.length > 0
    ? recentAnalytics.reduce((sum, a) => sum + a.engagementScore, 0) / recentAnalytics.length
    : 50;
  
  // COMBATANT: High combat vector -> more combat encounters
  if (vector.combatant > 0.6) {
    if (avgRecentEngagement < 40) {
      pacing = 'fast'; // Combatant is bored -> escalate
      directorNudge = 'combatant-idle'; // Director should emit more combat encounters
    }
    encounterType = 'combat';
    difficulty = 1.0 + (vector.combatant - 0.5) * 0.4; // Scale difficulty with combatant tendency
  }
  
  // DIPLOMAT: High social vector -> more dialogue and faction encounters
  if (vector.diplomat > 0.6) {
    if (avgRecentEngagement < 40) {
      pacing = 'fast';
      directorNudge = 'diplomat-idle'; // Director should emit faction/social encounters
    }
    encounterType = 'social';
    difficulty = 0.9; // Diplomats prefer lower difficulty
  }
  
  // EXPLORER: High exploration vector -> more discovery and mysteries
  if (vector.explorer > 0.6) {
    if (avgRecentEngagement < 40) {
      pacing = 'fast';
      directorNudge = 'explorer-idle'; // Director should emit relic whispers and hidden areas
    }
    encounterType = 'exploration';
    difficulty = 0.8 + (vector.explorer - 0.5) * 0.4;
  }
  
  // HYBRID: Balanced playstyle -> maintain normal pacing
  if (vector.dominant === 'hybrid') {
    pacing = 'normal';
    encounterType = 'mixed';
  }
  
  // Difficulty adjustment based on failure rate
  const struggles = identifyStrugglePoints(analytics);
  if (struggles.length > 0 && struggles[0].failureRate > 0.6) {
    difficulty *= 0.8; // Reduce difficulty if player struggles heavily
  }
  
  // If overall engagement is dropping, increase pacing
  if (avgRecentEngagement < 50) {
    pacing = 'fast';
  }
  
  return {
    suggestedPacing: pacing,
    suggestedEncounterType: encounterType,
    adaptDifficulty: Math.max(0.5, Math.min(1.5, difficulty)),
    directorNudge
  };
}

/**
 * Track engagement score over time
 */
export function getEngagementTrend(
  analytics: DecisionAnalytic[],
  windowSize: number = 10
): number[] {
  // STUB: Phase 2 implementation will:
  // 1. Calculate rolling average of engagement
  // 2. Return trend data (increasing, decreasing, stable)
  // 3. Use for pacing adjustments
  
  const trend: number[] = [];
  
  for (let i = 0; i < analytics.length - windowSize; i++) {
    const window = analytics.slice(i, i + windowSize);
    const avg = window.reduce((sum, a) => sum + a.engagementScore, 0) / windowSize;
    trend.push(avg);
  }
  
  return trend;
}

/**
 * Export analytics (dev-only)
 */
export function exportAnalytics(analytics: DecisionAnalytic[]): string {
  // STUB: Phase 2 implementation will:
  // 1. Format analytics for display/export
  // 2. Generate CSV or JSON
  // 3. Include summary statistics
  
  return JSON.stringify({
    totalActions: analytics.length,
    analytics
  }, null, 2);
}

/**
 * Clear analytics (for testing or new sessions)
 */
export function clearAnalytics(): void {
  // STUB: Phase 2 implementation
}

// ===============================
// ALPHA_M5: Temporal Divergence
// ===============================

export interface DivergenceSnapshot {
  tick: number;
  score: number; // 0-100
  factionShift: number;
  npcLocationShift: number;
  reputationShift: number;
  timestamp: number;
}

export interface TemporalAnalytics {
  currentDivergence: number;
  history: DivergenceSnapshot[];
  maxDivergence: number;
  divergenceAccel: number; // Rate of change (divergence/tick)
  temporalAnomaly: boolean; // True if state has impossible divergence pattern
}

/**
 * Calculate temporal divergence between current state and initial state
 * Returns score 0-100:
 * 0 = Perfect replica (bit-identical replay)
 * 50 = Moderate divergence (some choices differ)
 * 100 = Catastrophic divergence (world unrecognizable)
 */
export function calculateTemporalDivergence(
  currentState: WorldState,
  initialState: WorldState
): number {
  let divergenceScore = 0;

  // Component 1: Faction Power Shifts (0-40 points max)
  const factionDivergence = calculateFactionDivergence(currentState, initialState);
  divergenceScore += Math.min(factionDivergence, 40);

  // Component 2: NPC Location Divergence (0-35 points max)
  const npcLocationDivergence = calculateNpcLocationDivergence(currentState, initialState);
  divergenceScore += Math.min(npcLocationDivergence, 35);

  // Component 3: Player Reputation Divergence (0-25 points max)
  const reputationDivergence = calculateReputationDivergence(currentState, initialState);
  divergenceScore += Math.min(reputationDivergence, 25);

  return Math.min(divergenceScore, 100);
}

/**
 * Calculate faction power divergence
 * Compares faction power scores between current and initial state
 */
function calculateFactionDivergence(currentState: WorldState, initialState: WorldState): number {
  if (!currentState.factions || !initialState.factions) return 0;

  let totalDelta = 0;
  let factionCount = 0;

  for (const factionId in initialState.factions) {
    const initial = initialState.factions[factionId];
    const current = currentState.factions[factionId];

    if (initial && current) {
      const initialPower = initial.powerScore || 0;
      const currentPower = current.powerScore || 0;
      const delta = Math.abs(currentPower - initialPower);

      // Normalize to 0-1 range (assuming power scores 0-100)
      totalDelta += Math.min(delta / 30, 1); // 30 point swing = full divergence
      factionCount++;
    }
  }

  if (factionCount === 0) return 0;
  const avgDelta = totalDelta / factionCount;
  return avgDelta * 40; // Scale to 0-40
}

/**
 * Calculate NPC location divergence
 * Compares NPC locations between current and initial state
 */
function calculateNpcLocationDivergence(currentState: WorldState, initialState: WorldState): number {
  if (!currentState.npcs || !initialState.npcs) return 0;

  let divergedNpcs = 0;
  let totalNpcs = 0;

  for (const npc of initialState.npcs) {
    if (!npc.id) continue;

    const currentNpc = currentState.npcs.find(n => n.id === npc.id);
    if (!currentNpc) continue;

    totalNpcs++;

    // If NPC location differs from initial
    if (npc.locationId !== currentNpc.locationId) {
      divergedNpcs++;
    }

    // If NPC is dead but was alive initially
    if ((npc.hp ?? 0) > 0 && (currentNpc.hp ?? 0) <= 0) {
      divergedNpcs += 0.5; // Partial divergence credit
    }
  }

  if (totalNpcs === 0) return 0;
  const percentDiverged = divergedNpcs / totalNpcs;
  return percentDiverged * 35; // Scale to 0-35
}

/**
 * Calculate reputation divergence
 * Compares player reputation with NPCs between current and initial state
 */
function calculateReputationDivergence(currentState: WorldState, initialState: WorldState): number {
  if (!currentState.player?.reputation || !initialState.player?.reputation) return 0;

  let totalRepDelta = 0;
  let npcCount = 0;

  for (const npcId in initialState.player.reputation) {
    const initialRep = initialState.player.reputation[npcId] || 0;
    const currentRep = currentState.player?.reputation?.[npcId] || 0;
    const delta = Math.abs(currentRep - initialRep);

    // Normalize delta: 100 points of reputation change = full divergence
    totalRepDelta += Math.min(delta / 100, 1);
    npcCount++;
  }

  if (npcCount === 0) return 0;
  const avgDelta = totalRepDelta / npcCount;
  return avgDelta * 25; // Scale to 0-25
}

/**
 * Track divergence across entire game history
 * Creates a timeline of how divergence score has evolved
 */
export function buildDivergenceTimeline(
  currentState: WorldState,
  initialState: WorldState,
  prevTimeline: DivergenceSnapshot[] = []
): TemporalAnalytics {
  const currentDivergence = calculateTemporalDivergence(currentState, initialState);
  const currentTick = currentState.tick || 0;

  // Add new snapshot
  const newSnapshot: DivergenceSnapshot = {
    tick: currentTick,
    score: currentDivergence,
    factionShift: calculateFactionDivergence(currentState, initialState),
    npcLocationShift: calculateNpcLocationDivergence(currentState, initialState),
    reputationShift: calculateReputationDivergence(currentState, initialState),
    timestamp: Date.now()
  };

  const updatedHistory = [...prevTimeline, newSnapshot];

  // Limit history to last 100 snapshots to avoid memory bloat
  const history = updatedHistory.slice(-100);

  // Calculate acceleration (change in divergence rate)
  let divergenceAccel = 0;
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const prevRate = prev.score;
    const currentRate = currentDivergence;
    divergenceAccel = currentRate - prevRate;
  }

  // Detect temporal anomaly: if divergence jumps or reverses unexpectedly
  let temporalAnomaly = false;
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const jump = Math.abs(currentDivergence - prev.score);
    if (jump > 15) {
      // Sudden jump of > 15 points is anomalous
      temporalAnomaly = true;
    }
    // Divergence should never decrease (once world changes, can't undo without replay)
    if (currentDivergence < prev.score) {
      temporalAnomaly = true;
    }
  }

  const maxDivergence = Math.max(...history.map(s => s.score), currentDivergence);

  return {
    currentDivergence,
    history,
    maxDivergence,
    divergenceAccel,
    temporalAnomaly
  };
}

/**
 * Validate replay integrity
 * Compares a replayed state against a snapshot to detect bit-drift
 * Returns true if states are bit-identical within tolerance
 */
export function validateReplayIntegrity(
  replayedState: WorldState,
  snapshotState: WorldState
): { valid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];

  // Check basic state properties
  if (replayedState.tick !== snapshotState.tick) {
    discrepancies.push(`Tick mismatch: ${replayedState.tick} vs ${snapshotState.tick}`);
  }

  // Check player state
  if (replayedState.player?.hp !== snapshotState.player?.hp) {
    discrepancies.push(`Player HP mismatch: ${replayedState.player?.hp} vs ${snapshotState.player?.hp}`);
  }
  if (replayedState.player?.location !== snapshotState.player?.location) {
    discrepancies.push(`Player location mismatch: ${replayedState.player?.location} vs ${snapshotState.player?.location}`);
  }

  // Check NPC state (critical for determinism)
  if (replayedState.npcs?.length !== snapshotState.npcs?.length) {
    discrepancies.push(`NPC count mismatch: ${replayedState.npcs?.length} vs ${snapshotState.npcs?.length}`);
  } else {
    for (let i = 0; i < (replayedState.npcs?.length || 0); i++) {
      const rNpc = replayedState.npcs?.[i];
      const sNpc = snapshotState.npcs?.[i];

      if (rNpc?.id !== sNpc?.id) {
        discrepancies.push(`NPC[${i}] ID mismatch: ${rNpc?.id} vs ${sNpc?.id}`);
      }
      if (rNpc?.hp !== sNpc?.hp) {
        discrepancies.push(`NPC[${i}] HP mismatch: ${rNpc?.hp} vs ${sNpc?.hp}`);
      }
      if (rNpc?.locationId !== sNpc?.locationId) {
        discrepancies.push(`NPC[${i}] location mismatch: ${rNpc?.locationId} vs ${sNpc?.locationId}`);
      }
    }
  }

  // Check faction state
  if (Object.keys(replayedState.factions || {}).length !== Object.keys(snapshotState.factions || {}).length) {
    discrepancies.push(`Faction count mismatch`);
  }

  // Check inventory
  if (replayedState.player?.inventory?.length !== snapshotState.player?.inventory?.length) {
    discrepancies.push(`Inventory size mismatch: ${replayedState.player?.inventory?.length} vs ${snapshotState.player?.inventory?.length}`);
  }

  const valid = discrepancies.length === 0;

  return { valid, discrepancies };
}

/**
 * Calculate divergence threshold
 * Returns true if divergence has crossed "point of no return"
 * (Affects AI Director's behavior - high divergence = more interventions)
 */
export function calculateDivergenceThreshold(analytics: TemporalAnalytics): {
  level: 'stable' | 'drifting' | 'fractured' | 'catastrophic';
  temporalDebt: number;
} {
  const score = analytics.currentDivergence;

  if (score < 10) {
    return { level: 'stable', temporalDebt: 0 };
  } else if (score < 35) {
    return { level: 'drifting', temporalDebt: Math.floor((score - 10) * 0.5) };
  } else if (score < 70) {
    return { level: 'fractured', temporalDebt: Math.floor(25 + (score - 35) * 1.5) };
  } else {
    return { level: 'catastrophic', temporalDebt: 100 };
  }
}

/**
 * M26: Generate default playstyle profile
 * Returns balanced defaults for new players or when history unavailable
 */
export function generateDefaultPlaystyleProfile(): PlaystyleProfile {
  return {
    characterProfile: {
      combatFrequency: 0.30,
      socialFrequency: 0.20,
      explorationFrequency: 0.30,
      ritualFrequency: 0.15,
      craftingFrequency: 0.05
    },
    riskAssessment: {
      lowRollRiskTaking: 0.40,
      highRollConfidence: 0.60,
      riskTakingRatio: 0.5,
      averageSuccessRate: 0.65
    },
    moralAlignment: {
      goodChoices: 0,
      evilChoices: 0,
      neutralChoices: 0,
      alignment: 0
    },
    generatedAt: new Date().toISOString(),
    dominantPlaystyle: 'balanced',
    profileVersion: 1
  };
}

// M59-B1: Check event type for specific category
function isCombatAction(eventType: string): boolean {
  return eventType === 'COMBAT' || eventType === 'ATTACK' || eventType === 'CAST_SPELL' || eventType === 'DEFEND';
}

// M59-B1: Check event type for social category
function isSocialAction(eventType: string): boolean {
  return eventType === 'TALK' || eventType === 'DIALOGUE' || eventType === 'PERSUADE' || eventType === 'INTIMIDATE' || eventType === 'NEGOTIATE';
}

// M59-B1: Check event type for exploration category
function isExplorationAction(eventType: string): boolean {
  return eventType === 'EXPLORE' || eventType === 'EXAMINE' || eventType === 'INSPECT' || eventType === 'DISCOVER' || eventType === 'MOVE';
}

// M59-B1: Check event type for ritual category
function isRitualAction(eventType: string): boolean {
  return eventType === 'RITUAL' || eventType === 'MAGIC' || eventType === 'SPELL_CAST';
}

// M59-B1: Check event type for crafting category
function isCraftAction(eventType: string): boolean {
  return eventType === 'CRAFT' || eventType === 'HARVEST' || eventType === 'GATHER';
}

// M59-B1: Helper to categorize and count a single event action
function countEventAction(eventType: string, payload: Record<string, unknown>, counts: Record<string, number>): void {
  if (isCombatAction(eventType)) {
    counts.combatActions++;
  } else if (isSocialAction(eventType)) {
    counts.socialActions++;
  } else if (isExplorationAction(eventType)) {
    counts.explorationActions++;
  } else if (isRitualAction(eventType)) {
    counts.ritualActions++;
  } else if (isCraftAction(eventType)) {
    counts.craftingActions++;
  }
  
  const isSuccess = (payload.outcome as string) === 'success' || (payload.result as string) === 'success' || (payload.discovered as boolean) === true;
  const isFailure = (payload.outcome as string) === 'failure';
  
  if (isSuccess) {
    counts.successCount++;
    if (isSocialAction(eventType)) {
      trackMoralChoice(payload, counts);
    }
  }
  if (isFailure) {
    counts.failureCount++;
  }
}

// M59-B1: Track moral choice from persuasion type
function trackMoralChoice(payload: Record<string, unknown>, counts: Record<string, number>): void {
  const persuasionType = payload.persuasionType as string;
  if (persuasionType === 'helpful' || persuasionType === 'good') {
    counts.goodChoices++;
  } else if (persuasionType === 'harmful' || persuasionType === 'evil') {
    counts.evilChoices++;
  } else {
    counts.neutralChoices++;
  }
}

// M59-B1: Helper to categorize event types and count action occurrences
function categorizeEventActions(allEvents: any[]): Record<string, number> {
  const counts = { combatActions: 0, socialActions: 0, explorationActions: 0, ritualActions: 0, craftingActions: 0, successCount: 0, failureCount: 0, goodChoices: 0, evilChoices: 0, neutralChoices: 0 };
  
  for (const event of allEvents) {
    const payload = (event.payload as Record<string, unknown>) || {};
    countEventAction(event.type || '', payload, counts);
  }
  
  return counts;
}

// M59-B1: Helper to determine dominant playstyle from normalized frequencies
function determineDominantPlaystyle(combatFreq: number, socialFreq: number, explorationFreq: number, ritualFreq: number, craftingFreq: number): string {
  if (combatFreq > 0.4 && combatFreq > socialFreq && combatFreq > explorationFreq) return 'combatant';
  if (socialFreq > 0.4 && socialFreq > combatFreq && socialFreq > explorationFreq) return 'socialite';
  if (explorationFreq > 0.4 && explorationFreq > combatFreq && explorationFreq > socialFreq) return 'explorer';
  if (ritualFreq > 0.4) return 'ritualist';
  if (craftingFreq > 0.4) return 'crafter';
  return 'balanced';
}

/**
 * M26: Generate playstyle profile from world state
 * M59-B1: Now scans mutation log to generate accurate behavioral analysis
 */
export function generatePlaystyleProfile(state: WorldState): PlaystyleProfile {
  const { getEventsForWorld } = require('../events/mutationLog');
  const allEvents = getEventsForWorld(state.id) || [];
  
  if (allEvents.length === 0) {
    return generateDefaultPlaystyleProfile();
  }
  
  const { combatActions, socialActions, explorationActions, ritualActions, craftingActions, successCount, failureCount, goodChoices, evilChoices, neutralChoices } = categorizeEventActions(allEvents);
  
  const totalActions = combatActions + socialActions + explorationActions + ritualActions + craftingActions;
  const combatFreq = totalActions > 0 ? combatActions / totalActions : 0.3;
  const socialFreq = totalActions > 0 ? socialActions / totalActions : 0.2;
  const explorationFreq = totalActions > 0 ? explorationActions / totalActions : 0.3;
  const ritualFreq = totalActions > 0 ? ritualActions / totalActions : 0.15;
  const craftingFreq = totalActions > 0 ? craftingActions / totalActions : 0.05;
  
  const dominantPlaystyle = determineDominantPlaystyle(combatFreq, socialFreq, explorationFreq, ritualFreq, craftingFreq);
  const totalOutcomes = successCount + failureCount;
  const averageSuccessRate = totalOutcomes > 0 ? successCount / totalOutcomes : 0.65;
  const totalChoices = goodChoices + evilChoices + neutralChoices;
  const moralAlignment = totalChoices > 0 ? Math.round(((goodChoices - evilChoices) / totalChoices) * 100) : 0;
  const riskTakingRatio = combatFreq * 0.5 + (failureCount / (totalOutcomes || 1)) * 0.5;
  
  return {
    characterProfile: {
      combatFrequency: Math.min(1, combatFreq),
      socialFrequency: Math.min(1, socialFreq),
      explorationFrequency: Math.min(1, explorationFreq),
      ritualFrequency: Math.min(1, ritualFreq),
      craftingFrequency: Math.min(1, craftingFreq)
    },
    riskAssessment: {
      lowRollRiskTaking: Math.min(1, (failureCount / (totalOutcomes || 1)) * 1.5),
      highRollConfidence: Math.min(1, successCount / (totalOutcomes || 1)),
      riskTakingRatio: Math.min(1, riskTakingRatio),
      averageSuccessRate: Math.min(1, averageSuccessRate)
    },
    moralAlignment: { goodChoices, evilChoices, neutralChoices, alignment: moralAlignment },
    generatedAt: new Date().toISOString(),
    dominantPlaystyle,
    profileVersion: 1
  };
}

/**
 * M26: Generate narrative description of playstyle for AI DM context
 */
export function getPlaystyleDescription(profile: PlaystyleProfile): string {
  const alignment = profile.moralAlignment.alignment;
  const riskRatio = profile.riskAssessment.riskTakingRatio;
  
  const alignmentDescriptor = 
    alignment > 20 ? 'good-hearted' :
    alignment < -20 ? 'ruthless' :
    'pragmatic';
  
  const riskDescriptor = riskRatio > 0.3 ? 'reckless' : 'cautious';
  
  return `Player character is ${riskDescriptor} and ${alignmentDescriptor}. ` +
    `They favor ${profile.dominantPlaystyle} approach. ` +
    `Success rate: ${Math.round(profile.riskAssessment.averageSuccessRate * 100)}%.`;
}
