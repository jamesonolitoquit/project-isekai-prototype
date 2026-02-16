/**
 * ALPHA_M17 - The Chronos Ledger: Session Continuity & Timeline Analysis
 *
 * Purpose: Provides specialized analytics for mutation logs to identify:
 * - "Turning Points": Major decisions that alter the narrative trajectory
 * - "Incremental Shifts": Normal gameplay progression that refines but doesn't redirect
 * - "Paradox Echoes": Events caused by temporal debt or metagaming consequences
 * - "Canonical Shifts": Story-defining moments that become permanent lore
 */

import type { WorldState } from './worldEngine';

export interface ChronosLedger {
  worldId: string;
  totalEvents: number;
  turningPointCount: number;
  significantShiftCount: number;
  incrementalCount: number;
  turningPoints: any[];
  narrativePath: any[];
  paradoxEchoes: any[];
  canonicalShifts: any[];
}

/**
 * ALPHA_M19: Generate resonance summary from NPC emotional states and world scars
 * Embeds emotional arcs into narrative to show long-term consequences
 */
export function generateResonanceSummary(state: WorldState, ledger?: ChronosLedger): string {
  const lines: string[] = [];
  
  lines.push('### Resonance & Emotional Echoes');
  
  // Track NPC emotional transformations
  const emotionalArcs: any[] = [];
  for (const npc of state.npcs || []) {
    const npcWithEmotion = npc as any;
    if (!npcWithEmotion.emotionalState?.emotionalHistory || npcWithEmotion.emotionalState.emotionalHistory.length === 0) {
      continue;
    }

    const history = npcWithEmotion.emotionalState.emotionalHistory;
    const mostRecent = history[history.length - 1];

    if (Math.abs(mostRecent.delta) > 10) {
      let emotionalArc = '';

      if (mostRecent.category === 'gratitude' && mostRecent.delta > 0) {
        emotionalArc = `The ${(npc as any).name} will never forget your kindness during ${mostRecent.reason}`;
      } else if (mostRecent.category === 'resentment' && mostRecent.delta > 0) {
        emotionalArc = `The ${(npc as any).name} harbors deep resentment toward you after ${mostRecent.reason}`;
      } else if (mostRecent.category === 'fear' && mostRecent.delta > 0) {
        emotionalArc = `The ${(npc as any).name} regards you with cautious fear following ${mostRecent.reason}`;
      } else if (mostRecent.category === 'trust' && mostRecent.delta > 0) {
        emotionalArc = `The ${(npc as any).name} now trusts you after ${mostRecent.reason}`;
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
 * ALPHA_M19: Calculate world tension score (0-100) based on active conflicts, scars, displacement, and NPC fear
 * Higher tension indicates greater world instability
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
    const npcWithEmotion = npc as any;
    totalFear += npcWithEmotion.emotionalState?.fear || 50;
  }
  const avgFear = state.npcs && state.npcs.length > 0 ? totalFear / state.npcs.length : 50;
  tension += (avgFear - 50) * 0.4; // Fear above neutral contributes tension

  return Math.max(0, Math.min(100, Math.round(tension)));
}
