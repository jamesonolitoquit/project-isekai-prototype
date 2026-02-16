/**
 * ALPHA_M17 - The Chronos Ledger: Session Continuity & Timeline Analysis
 *
 * Purpose: Provides specialized analytics for mutation logs to identify:
 * - "Turning Points": Major decisions that alter the narrative trajectory
 * - "Incremental Shifts": Normal gameplay progression that refines but doesn't redirect
 * - "Paradox Echoes": Events caused by temporal debt or metagaming consequences
 * - "Canonical Shifts": Story-defining moments that become permanent lore
 *
 * Turning Points Scoring Algorithm:
 * A Turning Point is detected by measuring impact across multiple axes:
 * 1. GRAVITY: Does the event affect game state significantly? (quests, NPCs, factions)
 * 2. IRREVERSIBILITY: Can the effect be undone? (temporal debt, permanent choices)
 * 3. NARRATIVE_WEIGHT: Does the event carry story significance? (unique events, rare outcomes)
 * 4. FACTION_IMPACT: Does it shift alliance/reputation by >20 points?
 *
 * Score ≥ 75: "Turning Point" (major decision)
 * Score 40-74: "Significant Shift" (meaningful progress)
 * Score < 40: "Incremental" (normal gameplay beat)
 */

import type { Event } from '../events/mutationLog';
import type { WorldState } from './worldEngine';

export interface TurningPoint {
  eventId: string;
  eventIndex: number;
  tick: number;
  type: string;
  description: string;
  impactScore: number; // 0-100
  category: 'turning_point' | 'significant_shift' | 'incremental';
  axes: {
    gravity: number;        // 0-100: State mutation severity
    irreversibility: number; // 0-100: Permanent consequence
    narrativeWeight: number; // 0-100: Story significance
    factionImpact: number;   // 0-100: Relationship shift
  };
  payload: any;
  affectedSystems: string[]; // Which game systems were impacted (quest, faction, npc, location, etc.)
}

export interface ChronosLedger {
  worldId: string;
  totalEvents: number;
  turningPointCount: number;
  significantShiftCount: number;
  incrementalCount: number;
  turningPoints: TurningPoint[];
  narrativePath: Array<{
    phase: number;
    startTick: number;
    endTick: number;
    description: string;
    majorEvents: TurningPoint[];
  }>;
  paradoxEchoes: Array<{
    eventId: string;
    causedBy: string; // parent event ID
    type: 'reality_glitch' | 'hazard_manifestation' | 'temporal_recursion';
    depth: number; // nesting level of consequence
  }>;
      canonicalShifts: Array<{
    eventId: string;
    loreId: string;
    discovered: true;
    permanence: 'permanent' | 'temporary' | 'conditional';
  }>;
}

/**
 * Analyze event gravity: How much state mutation did the event cause?
 * Inspects event type to estimate state impact
 */
function analyzeGravity(event: Event): number {
  const type = event.type.toUpperCase();
  
  // High gravity events (75-100): Core systems affected
  if (type.includes('QUEST') && (type.includes('COMPLETE') || type.includes('FAIL'))) return 90;
  if (type === 'FACTION_REPUTATION_CHANGED' && Math.abs(event.payload?.amount || 0) > 20) return 85;
  if (type === 'NPC_DEPARTED' || type === 'FACTION_CONTROL_LOST') return 80;
  if (type === 'LORE_DISCOVERED' && event.payload?.accessLevel === 'secret') return 85;
  if (type === 'TEMPORAL_DEBT_ACCRUED' && event.payload?.amount > 10) return 80;
  
  // Medium gravity events (45-74): Significant progression
  if (type === 'FACTION_REPUTATION_CHANGED') return 65;
  if (type === 'QUEST_UPDATED') return 60;
  if (type === 'LOCATION_DISCOVERED') return 55;
  if (type === 'NPC_ARRIVED') return 50;
  if (type === 'INFLUENCE_SHIFT') return 60;
  if (type === 'LORE_DISCOVERED') return 70;
  
  // Low gravity events (< 45): Normal gameplay
  if (type === 'MOVE' || type === 'TRAVEL_STARTED') return 15;
  if (type === 'TICK' || type === 'WEATHER_CHANGED') return 10;
  if (type === 'STATUS_EFFECT_TICK') return 20;
  if (type === 'HAZARD_DAMAGE' && event.payload?.damage < 10) return 30;
  
  // Default: moderate
  return 40;
}

/**
 * Analyze irreversibility: Can the player undo or mitigate this effect?
 */
function analyzeIrreversibility(event: Event): number {
  const type = event.type.toUpperCase();
  
  // Irreversible (90-100): Permanent changes
  if (type === 'TEMPORAL_DEBT_ACCRUED') return 95; // Cannot reduce debt without specific means
  if (type === 'QUEST_FAILED' || type === 'QUEST_COMPLETE') return 85;
  if (type === 'LORE_DISCOVERED' && event.payload?.accessLevel === 'secret') return 90;
  if (type === 'FACTION_CONTROL_CAPTURED') return 75; // Can be lost to other factions
  
  // Reversible/Mitigable (40-74): Can be undone with effort
  if (type === 'LOCATION_DISCOVERED') return 20; // Can be "forgotten" (resetting state)
  if (type === 'NPC_DIED') return 95; // Permanent character death
  if (type === 'FACTION_REPUTATION_CHANGED') return 50; // Can improve/degrade reputation
  
  // Reversible (< 40): Easily undone
  if (type === 'MOVE' || type === 'TRAVEL_STARTED') return 5;
  if (type === 'STATUS_EFFECT_APPLIED') return 30; // Can wear off
  
  return 30;
}

/**
 * Analyze narrative weight: Does the event carry story significance?
 */
function analyzeNarrativeWeight(event: Event): number {
  const type = event.type.toUpperCase();
  
  // High narrative weight (80-100): Story-defining moments
  if (type === 'QUEST_COMPLETE' && event.payload?.questType === 'major') return 95;
  if (type === 'FACTION_CONTROL_CAPTURED' || type === 'FACTION_CONTROL_LOST') return 85;
  if (type === 'NPC_DIED' && event.payload?.npcImportance === 'critical') return 90;
  if (type === 'LORE_DISCOVERED' && event.payload?.accessLevel === 'secret') return 85;
  if (type === 'AUTHORITY_INTERVENTION') return 90; // DM interferes = major narrative moment
  if (type === 'REALITY_REBELLION') return 95; // Player reaches rebellion state
  
  // Medium narrative weight (40-79): Meaningful story beats
  if (type === 'QUEST_COMPLETE') return 70;
  if (type === 'LOCATION_DISCOVERED') return 60;
  if (type === 'DIALOGUE_CHOICE' && event.payload?.isSecretPath) return 75;
  if (type === 'META_SUSPICION' && event.payload?.thresholdCrossed === 60) return 70;
  if (type === 'INFLUENCE_SHIFT') return 65;
  if (type === 'NPC_ARRIVED' && event.payload?.npcImportance === 'primary') return 60;
  
  // Low narrative weight (< 40): Routine progression
  if (type === 'TICK' || type === 'WEATHER_CHANGED') return 5;
  if (type === 'MOVE' || type === 'TRAVEL_STARTED') return 10;
  if (type === 'STATUS_EFFECT_TICK') return 15;
  
  return 25;
}

/**
 * Analyze faction impact: Does the event significantly shift relationships?
 */
function analyzeFactionImpact(event: Event): number {
  const type = event.type.toUpperCase();
  
  if (type === 'FACTION_REPUTATION_CHANGED') {
    const amount = Math.abs(event.payload?.amount || 0);
    if (amount >= 30) return 90;
    if (amount >= 20) return 75;
    if (amount >= 10) return 50;
    return 30;
  }
  
  if (type === 'FACTION_CONTROL_CAPTURED') return 85;
  if (type === 'FACTION_CONTROL_LOST') return 85;
  if (type === 'INFLUENCE_SHIFT') {
    const shift = Math.abs(event.payload?.amount || 0);
    return Math.min(100, 40 + shift);
  }
  
  // Events that might indicate faction-related consequences
  if (type === 'NPC_DIED' && event.payload?.npcFactionId) return 60;
  if (type === 'QUEST_COMPLETE' && event.payload?.questGiver) return 50;
  if (type === 'QUEST_FAILED' && event.payload?.questGiver) return 40;
  
  return 0;
}

/**
 * Calculate overall impact score for turning point detection
 */
function calculateImpactScore(event: Event): number {
  const gravity = analyzeGravity(event);
  const irreversibility = analyzeIrreversibility(event);
  const narrativeWeight = analyzeNarrativeWeight(event);
  const factionImpact = analyzeFactionImpact(event);
  
  // Weighted average (gravity and narrative weight are most important)
  return (gravity * 0.35 + narrativeWeight * 0.35 + irreversibility * 0.20 + factionImpact * 0.10);
}

/**
 * Classify event into category based on impact score
 */
function classifyEventCategory(impactScore: number): 'turning_point' | 'significant_shift' | 'incremental' {
  if (impactScore >= 75) return 'turning_point';
  if (impactScore >= 40) return 'significant_shift';
  return 'incremental';
}

/**
 * Extract affected systems from event type
 */
function extractAffectedSystems(eventType: string): string[] {
  const systems: string[] = [];
  const type = eventType.toUpperCase();
  
  if (type.includes('QUEST')) systems.push('quest');
  if (type.includes('FACTION')) systems.push('faction');
  if (type.includes('NPC')) systems.push('npc');
  if (type.includes('LOCATION')) systems.push('location');
  if (type.includes('LORE')) systems.push('lore');
  if (type.includes('TEMPORAL') || type.includes('DEBT')) systems.push('temporal');
  if (type.includes('META_SUSPICION')) systems.push('suspicion');
  if (type.includes('INFLUENCE')) systems.push('geopolitical');
  if (type.includes('WEATHER') || type.includes('SEASON')) systems.push('environment');
  if (type.includes('AUTHORITY') || type.includes('REBELLION')) systems.push('reality');
  
  return systems.length > 0 ? systems : ['gameplay'];
}

/**
 * Analyze all events for a world and generate Chronos Ledger
 */
export function analyzeChronosLedger(worldId: string, events: Event[]): ChronosLedger {
  const turningPoints: TurningPoint[] = [];
  const paradoxEchoes: Array<{ eventId: string; causedBy: string; type: 'reality_glitch' | 'hazard_manifestation' | 'temporal_recursion'; depth: number }> = [];
  const canonicalShifts: Array<{ eventId: string; loreId: string; discovered: true; permanence: 'permanent' | 'temporary' | 'conditional' }> = [];
  
  // Filter events for this world only
  const worldEvents = events.filter(e => e.worldInstanceId === worldId);
  
  // Analyze each event
  worldEvents.forEach((event, index) => {
    const impactScore = calculateImpactScore(event);
    const category = classifyEventCategory(impactScore);
    
    // Create turning point record for analyzed events
    const turn: TurningPoint = {
      eventId: event.id,
      eventIndex: event.eventIndex || index,
      tick: event.timestamp ? Math.floor(event.timestamp / 1000) : 0,
      type: event.type,
      description: generateEventDescription(event),
      impactScore,
      category,
      axes: {
        gravity: analyzeGravity(event),
        irreversibility: analyzeIrreversibility(event),
        narrativeWeight: analyzeNarrativeWeight(event),
        factionImpact: analyzeFactionImpact(event)
      },
      payload: event.payload,
      affectedSystems: extractAffectedSystems(event.type)
    };
    
    turningPoints.push(turn);
    
    // Detect paradox echoes (consequences of meta-suspicion or authority intervention)
    if (event.type === 'META_SUSPICION' || event.type === 'AUTHORITY_INTERVENTION') {
      // Look for subsequent hazard or glitch events
      const nextIndex = index + 1;
      if (nextIndex < worldEvents.length) {
        const nextEvent = worldEvents[nextIndex];
        if (nextEvent.type === 'HAZARD_DAMAGE' || nextEvent.type === 'ENVIRONMENTAL_HAZARD') {
          paradoxEchoes.push({
            eventId: nextEvent.id,
            causedBy: event.id,
            type: 'reality_glitch',
            depth: 1
          });
        }
      }
    }
    
    // Detect canonical shifts (lore discoveries)
    if (event.type === 'LORE_DISCOVERED') {
      canonicalShifts.push({
        eventId: event.id,
        loreId: event.payload?.loreId || '',
        discovered: true,
        permanence: event.payload?.accessLevel === 'secret' ? 'permanent' : 'conditional'
      });
    }
  });
  
  // Organize turning points into narrative phases
  const narrativePath = buildNarrativePath(turningPoints);
  
  // Count categories
  const turningPointCount = turningPoints.filter(t => t.category === 'turning_point').length;
  const significantShiftCount = turningPoints.filter(t => t.category === 'significant_shift').length;
  const incrementalCount = turningPoints.filter(t => t.category === 'incremental').length;
  
  return {
    worldId,
    totalEvents: worldEvents.length,
    turningPointCount,
    significantShiftCount,
    incrementalCount,
    turningPoints,
    narrativePath,
    paradoxEchoes,
    canonicalShifts
  };
}

/**
 * Build narrative phases from turning points
 * Groups events into chapters based on major turning points
 */
function buildNarrativePath(turningPoints: TurningPoint[]): Array<{
  phase: number;
  startTick: number;
  endTick: number;
  description: string;
  majorEvents: TurningPoint[];
}> {
  const phases: Array<{
    phase: number;
    startTick: number;
    endTick: number;
    description: string;
    majorEvents: TurningPoint[];
  }> = [];
  
  const majorEvents = turningPoints.filter(t => t.category === 'turning_point');
  
  if (majorEvents.length === 0) {
    // No major turning points - entire game is one phase
    const allEvents = turningPoints;
    if (allEvents.length > 0) {
      phases.push({
        phase: 1,
        startTick: allEvents[0].tick,
        endTick: allEvents[allEvents.length - 1].tick,
        description: 'The Beginning',
        majorEvents: []
      });
    }
    return phases;
  }
  
  let phasesCount = 1;
  
  // First phase: from start to first turning point
  if (majorEvents.length > 0) {
    const firstMajor = majorEvents[0];
    const phaseEvents = turningPoints.filter(t => t.tick <= firstMajor.tick);
    phases.push({
      phase: phasesCount,
      startTick: turningPoints[0]?.tick || 0,
      endTick: firstMajor.tick,
      description: `Chapter ${phasesCount}: ${generatePhaseDescription(phaseEvents)}`,
      majorEvents: phaseEvents.filter(t => t.category === 'turning_point')
    });
    phasesCount++;
  }
  
  // Intermediate phases: between turning points
  for (let i = 0; i < majorEvents.length - 1; i++) {
    const current = majorEvents[i];
    const next = majorEvents[i + 1];
    const phaseEvents = turningPoints.filter(t => t.tick > current.tick && t.tick <= next.tick);
    
    phases.push({
      phase: phasesCount,
      startTick: current.tick,
      endTick: next.tick,
      description: `Chapter ${phasesCount}: ${generatePhaseDescription(phaseEvents)}`,
      majorEvents: phaseEvents.filter(t => t.category === 'turning_point')
    });
    phasesCount++;
  }
  
  // Final phase: after last turning point
  const lastMajor = majorEvents[majorEvents.length - 1];
  const finalEvents = turningPoints.filter(t => t.tick > lastMajor.tick);
  if (finalEvents.length > 0) {
    phases.push({
      phase: phasesCount,
      startTick: lastMajor.tick,
      endTick: finalEvents[finalEvents.length - 1].tick,
      description: `Chapter ${phasesCount}: ${generatePhaseDescription(finalEvents)}`,
      majorEvents: finalEvents.filter(t => t.category === 'turning_point')
    });
  }
  
  return phases;
}

/**
 * Generate human-readable event description
 */
function generateEventDescription(event: Event): string {
  const type = event.type;
  const payload = event.payload || {};
  
  switch (type) {
    case 'QUEST_COMPLETE':
      return `Completed quest: ${payload.questName || 'Unknown'}`;
    case 'QUEST_FAILED':
      return `Failed quest: ${payload.questName || 'Unknown'}`;
    case 'FACTION_REPUTATION_CHANGED':
      return `${payload.factionName || 'Faction'} reputation ${payload.amount > 0 ? 'increased' : 'decreased'} by ${Math.abs(payload.amount || 0)}`;
    case 'FACTION_CONTROL_CAPTURED':
      return `${payload.factionName || 'Faction'} captured ${payload.locationName || 'territory'}`;
    case 'FACTION_CONTROL_LOST':
      return `${payload.factionName || 'Faction'} lost ${payload.locationName || 'territory'}`;
    case 'LOCATION_DISCOVERED':
      return `Discovered: ${payload.locationName || 'new location'}`;
    case 'LORE_DISCOVERED':
      return `Discovered lore: ${payload.title || 'hidden knowledge'}`;
    case 'NPC_DIED':
      return `${payload.npcName || 'NPC'} died`;
    case 'META_SUSPICION':
      return `Reality glitch (suspicion: ${payload.level || 0})`;
    case 'AUTHORITY_INTERVENTION':
      return `The DM intervenes: "${payload.interventionText || 'something impossible happens'}"`;
    case 'TEMPORAL_DEBT_ACCRUED':
      return `Temporal debt increased by ${payload.amount || 0}`;
    case 'REALITY_REBELLION':
      return `REALITY REBELLION: The DM fully rejects metagaming`;
    default:
      return `${type}: ${JSON.stringify(payload).substring(0, 50)}`;
  }
}

/**
 * Generate phase description from events in that phase
 */
function generatePhaseDescription(events: TurningPoint[]): string {
  if (events.length === 0) return 'An Uncertain Beginning';
  
  const primarySystems = new Set<string>();
  events.forEach(e => e.affectedSystems.forEach(s => primarySystems.add(s)));
  
  const systemNames = Array.from(primarySystems).slice(0, 3);
  const systemStr = systemNames.join(', ');
  
  const majorEvents = events.filter(e => e.category === 'turning_point');
  if (majorEvents.length > 0) {
    return `${systemStr || 'Progress'} - ${majorEvents[0].description}`;
  }
  
  return systemStr || 'Progression';
}

/**
 * Generate a text summary of the entire session's narrative arc
 */
export function generateChronosSummary(ledger: ChronosLedger): string {
  const lines: string[] = [];
  
  lines.push(`## Session Chronicle: ${ledger.worldId}`);
  lines.push(`Total Events: ${ledger.totalEvents}`);
  lines.push(`Turning Points: ${ledger.turningPointCount} | Significant Shifts: ${ledger.significantShiftCount} | Incremental: ${ledger.incrementalCount}`);
  lines.push('');
  
  lines.push('### Narrative Arc');
  ledger.narrativePath.forEach(phase => {
    lines.push(`**${phase.description}**`);
    if (phase.majorEvents.length > 0) {
      phase.majorEvents.forEach(event => {
        lines.push(`  - ${event.description} (Impact: ${Math.round(event.impactScore)}/100)`);
      });
    }
  });
  
  if (ledger.paradoxEchoes.length > 0) {
    lines.push('');
    lines.push('### Reality Distortions');
    ledger.paradoxEchoes.forEach(echo => {
      lines.push(`  - ${echo.type.replace(/_/g, ' ')}: Caused by metagaming or temporal interference`);
    });
  }
  
  if (ledger.canonicalShifts.length > 0) {
    lines.push('');
    lines.push('### Canonical Discoveries');
    ledger.canonicalShifts.slice(0, 5).forEach(shift => {
      lines.push(`  - Lore unlocked: ${shift.loreId}`);
    });
    if (ledger.canonicalShifts.length > 5) {
      lines.push(`  ... and ${ledger.canonicalShifts.length - 5} more discoveries`);
    }
  }
  
  return lines.join('\n');
}

/**
 * ALPHA_M19: Generate resonance summary including emotional arcs and warfare scars
 * Integrates NPC emotional changes and faction conflict consequences into narrative
 */
export function generateResonanceSummary(state: WorldState, ledger: ChronosLedger): string {
  const lines: string[] = [];
  
  lines.push('### Resonance & Emotional Echoes');
  
  // Track NPC emotional transformations
  const emotionalArcs: any[] = [];
  for (const npc of state.npcs || []) {
    if (!npc.emotionalState?.emotionalHistory || npc.emotionalState.emotionalHistory.length === 0) {
      continue;
    }

    const history = npc.emotionalState.emotionalHistory;
    const mostRecent = history[history.length - 1];

    if (Math.abs(mostRecent.delta) > 10) {
      let emotionalArc = '';

      if (mostRecent.category === 'gratitude' && mostRecent.delta > 0) {
        emotionalArc = `The ${npc.name} will never forget your kindness during ${mostRecent.reason}`;
      } else if (mostRecent.category === 'resentment' && mostRecent.delta > 0) {
        emotionalArc = `The ${npc.name} harbors deep resentment toward you after ${mostRecent.reason}`;
      } else if (mostRecent.category === 'fear' && mostRecent.delta > 0) {
        emotionalArc = `The ${npc.name} regards you with cautious fear following ${mostRecent.reason}`;
      } else if (mostRecent.category === 'trust' && mostRecent.delta > 0) {
        emotionalArc = `The ${npc.name} now trusts you after ${mostRecent.reason}`;
      }

      if (emotionalArc) {
        emotionalArcs.push(emotionalArc);
      }
    }
  }

  if (emotionalArcs.length > 0) {
    emotionalArcs.slice(0, 5).forEach(arc => {
      lines.push(`  - ${arc}`);
    });
    if (emotionalArcs.length > 5) {
      lines.push(`  ... and ${emotionalArcs.length - 5} other emotional bonds shaped`);
    }
  }

  // Track warfare scars
  lines.push('');
  lines.push('### World Scars from Conflict');
  
  let scarCount = 0;
  for (const location of state.locations || []) {
    const scars = (location as any).activeScars || [];
    if (scars.length > 0) {
      scarCount += scars.length;
      lines.push(`  - ${location.name}: ${scars[0].description}`);
    }
  }

  if (scarCount === 0) {
    lines.push('  The world has not yet been scarred by conflict.');
  }

  // Track faction warfare impact
  lines.push('');
  lines.push('### Faction Warfare Summary');
  
  const defectionEvents = ledger?.paradoxEchoes?.filter((e: any) => e.type === 'npc_defected') || [];
  const displacementEvents = ledger?.paradoxEchoes?.filter((e: any) => e.type === 'npc_displaced') || [];

  if (defectionEvents.length > 0) {
    lines.push(`  - ${defectionEvents.length} NPC(s) defected to rival factions`);
  }

  if (displacementEvents.length > 0) {
    lines.push(`  - ${displacementEvents.length} NPC(s) displaced by conflict`);
  }

  if (defectionEvents.length === 0 && displacementEvents.length === 0) {
    lines.push('  No major faction warfare has occurred.');
  }

  return lines.join('\n');
}

/**
 * ALPHA_M19: Calculate world tension score (0-100) based on active conflicts
 */
export function calculateWorldTension(state: WorldState): number {
  let tension = 0;

  // Count active conflicts
  const activeConflicts = state.factionConflicts?.filter((c: any) => c.active) || [];
  tension += activeConflicts.length * 15; // Each conflict adds 15 tension

  // Count active location scars
  let activeScarCount = 0;
  for (const location of state.locations || []) {
    const scars = (location as any).activeScars || [];
    activeScarCount += scars.length;
  }
  tension += Math.min(30, activeScarCount * 10); // Scars add up to 30 tension

  // Count displaced NPCs
  const displacedCount = (state.npcs || []).filter((npc: any) => npc.isDisplaced).length;
  tension += Math.min(15, displacedCount * 5); // Displaced NPCs add up to 15 tension

  // Average NPC fear across world
  let totalFear = 0;
  for (const npc of state.npcs || []) {
    totalFear += npc.emotionalState?.fear || 50;
  }
  const avgFear = state.npcs && state.npcs.length > 0 ? totalFear / state.npcs.length : 50;
  tension += (avgFear - 50) * 0.4; // Fear above neutral contributes tension

  return Math.max(0, Math.min(100, Math.round(tension)));
}

/**
 * ALPHA_M18: Reload Tracking & World-State Drift
 * 
 * Tracks reload count and applies "Drift" to discourage save-scumming
 * If reloads > 3 in a 24-hour cycle, apply permanent world mutations:
 * - Change one non-essential NPC's location
 * - Swap clear weather to rain
 * 
 * This creates negative consequences for excessive reloading
 */
export interface ReloadTracker {
  worldId: string;
  reloadCount: number;
  reloadTimestamps: number[];
  lastDriftAppliedTick?: number;
  driftHistory: Array<{
    tick: number;
    driftType: string;
    description: string;
  }>;
}

export function initializeReloadTracker(worldId: string): ReloadTracker {
  return {
    worldId,
    reloadCount: 0,
    reloadTimestamps: [],
    driftHistory: []
  };
}

/**
 * Record a reload event and check if drift should be applied
 */
export function recordReload(
  state: WorldState,
  tracker: ReloadTracker,
  tick: number
): { driftApplied: boolean; driftEvent?: Event } {
  const now = Date.now();
  tracker.reloadCount++;
  tracker.reloadTimestamps.push(now);
  
  // Keep only reloads from the last 24 hours (86400000 ms)
  const dayAgo = now - 86400000;
  tracker.reloadTimestamps = tracker.reloadTimestamps.filter(ts => ts > dayAgo);
  
  // Check if drift should apply
  if (tracker.reloadTimestamps.length > 3 && (!tracker.lastDriftAppliedTick || tick - (tracker.lastDriftAppliedTick ?? 0) > 500)) {
    // Apply world-state drift
    const driftEvent = applyWorldStateDrift(state, tracker, tick);
    tracker.lastDriftAppliedTick = tick;
    
    return {
      driftApplied: true,
      driftEvent
    };
  }
  
  return { driftApplied: false };
}

/**
 * Apply permanent world mutations as consequence of excessive reloading
 */
function applyWorldStateDrift(state: WorldState, tracker: ReloadTracker, tick: number): Event {
  const driftTypes: ('npc_relocation' | 'weather_mutation')[] = ['npc_relocation', 'weather_mutation'];
  const driftType = driftTypes[Math.floor(Math.random() * driftTypes.length)];
  
  let description = '';
  let payload: any = {
    driftType,
    reason: 'reload_drift_consequence',
    reloadCount: tracker.reloadTimestamps.length,
    discouragement: 'Excessive save-scumming causes reality to shift unpredictably'
  };
  
  if (driftType === 'npc_relocation') {
    // Select a non-essential NPC and move them
    const nonEssentialNpcs = state.npcs.filter(npc => !((npc as any).importance === 'critical'));
    if (nonEssentialNpcs.length > 0) {
      const randomNpc = nonEssentialNpcs[Math.floor(Math.random() * nonEssentialNpcs.length)];
      const availableLocations = state.locations.filter(loc => loc.id !== randomNpc.locationId);
      
      if (availableLocations.length > 0) {
        const newLocation = availableLocations[Math.floor(Math.random() * availableLocations.length)];
        description = `${randomNpc.name} mysteriously relocates to ${newLocation.name} - reality is unstable`;
        
        payload.npcId = randomNpc.id;
        payload.npcName = randomNpc.name;
        payload.fromLocation = randomNpc.locationId;
        payload.toLocation = newLocation.id;
        payload.toLocationName = newLocation.name;
        
        // Apply the change
        randomNpc.locationId = newLocation.id;
      }
    }
  } else if (driftType === 'weather_mutation') {
    // Swap weather: if clear->rain, if rain->clear
    const currentWeather = (state as any).weather || 'clear';
    const newWeather = currentWeather === 'clear' ? 'rain' : 'clear';
    
    description = `Weather shifts permanently from ${currentWeather} to ${newWeather} - time is fractured`;
    payload.fromWeather = currentWeather;
    payload.toWeather = newWeather;
    
    // Apply the change
    (state as any).weather = newWeather;
  }
  
  // Record drift in history
  tracker.driftHistory.push({
    tick,
    driftType,
    description
  });
  
  return {
    id: `drift-${tick}`,
    worldInstanceId: state.id,
    actorId: 'director-ai',
    type: 'RELOAD_WORLD_DRIFT',
    payload,
    mutationClass: 'SYSTEM',
    timestamp: Date.now(),
  };
}

