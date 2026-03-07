/**
 * Phase 48-Chronos: ChronosStudyEngine
 * 
 * Module 2 & 3: Interruption Logic + Faction Advancement Multiplier
 * 
 * Module 2: Determines whether a time-skip can proceed or should be interrupted.
 * Pre-flight checks before executeBatchTicks begins.
 * 
 * Module 3: Scales faction advancement based on duration (more days = more faction change)
 * 
 * Interruption conditions:
 * - Active quest with imminent deadline (< 24 ticks remaining)
 * - NPC scheduled event in next 60 ticks (romance, betrayal, ambush)
 * - Faction conflict escalation risk (unstable relations)
 * - Paradox level too high (> 75)
 * - Active combat or turn-in-progress
 * - Temporal debt affecting world state (> 50)
 * 
 * Faction advancement multiplier:
 * - Base multiplier: ticks / 1440 (standard day = 1440 ticks)
 * - Applied to: power gains, relationship changes, conflict progression
 * - Clamped: min 1x, max 7x (don't allow skipping more than 1 week safely)
 */

import type { WorldState } from './worldEngine';
import { getEventsForWorld } from '../events/mutationLog';

export interface InterruptionCheck {
  canProceed: boolean;
  reason?: string; // Human-readable explanation if blocked
  warningLevel: 'safe' | 'caution' | 'danger'; // Visual feedback level
  recommendation?: string; // Suggested action
  blockedBy?: string[]; // Array of blocking condition IDs
}

/**
 * Check if time-skip should be interrupted or allowed
 * @param state The current world state
 * @param durationTicks How many ticks the player wants to skip
 * @returns InterruptionCheck result
 */
export function checkStudyInterruption(state: WorldState, durationTicks: number): InterruptionCheck {
  const blockedBy: string[] = [];
  let warningLevel: 'safe' | 'caution' | 'danger' = 'safe';

  // ===== CHECK 1: Active Combat or Turn-in-Progress =====
  if ((state as any).isTurnInProgress || (state as any).inCombat) {
    blockedBy.push('COMBAT_ACTIVE');
    return {
      canProceed: false,
      reason: '⚔️ Cannot study during combat or active turn',
      warningLevel: 'danger',
      recommendation: 'Resolve the current turn or combat first',
      blockedBy
    };
  }

  // ===== CHECK 2: Paradox Level Too High =====
  if ((state.paradoxLevel ?? 0) > 75) {
    blockedBy.push('PARADOX_CRITICAL');
    warningLevel = 'danger';
    // Still allowed but highly risky
  }

  // ===== CHECK 3: Temporal Debt Affecting World =====
  if ((state.player?.temporalDebt ?? 0) > 50) {
    warningLevel = warningLevel === 'danger' ? 'danger' : 'caution';
    blockedBy.push('TEMPORAL_DEBT_HIGH');
  }

  // ===== CHECK 4: Active Quest with Imminent Deadline =====
  const activeQuests = Object.entries(state.player?.quests ?? {})
    .filter(([_, quest]: any) => quest.state === 'active' || quest.state === 'in_progress');

  for (const [questId, quest] of activeQuests) {
    const questData = quest as any;
    const deadline = questData.deadline ?? questData.dueAtTick;
    if (deadline && deadline > 0) {
      const ticksUntilDue = deadline - (state.tick ?? 0);
      if (ticksUntilDue > 0 && ticksUntilDue < 24) {
        // Quest due within 24 ticks (less than 1 hour in standard time)
        blockedBy.push(`QUEST_DEADLINE_IMMINENT:${questId}`);
        warningLevel = 'danger';
        
        return {
          canProceed: false,
          reason: `⏰ Quest "${questData.title || questId}" due in ${ticksUntilDue} ticks`,
          warningLevel: 'danger',
          recommendation: 'Complete or abandon the quest before studying',
          blockedBy
        };
      } else if (ticksUntilDue > 24 && ticksUntilDue < 60) {
        // Quest due within 1 hour - warning level
        warningLevel = warningLevel === 'danger' ? 'danger' : 'caution';
        blockedBy.push(`QUEST_DEADLINE_NEAR:${questId}`);
      }
    }
  }

  // ===== CHECK 5: NPC Scheduled Event in Next 60 Ticks =====
  const recentEvents = getEventsForWorld(state.id).filter((e: any) => {
    const eventTick = e.tick ?? 0;
    const currentTick = state.tick ?? 0;
    return eventTick > currentTick && eventTick <= currentTick + Math.min(durationTicks, 60);
  });

  const highPriorityEvents = recentEvents.filter((e: any) =>
    e.type === 'NPC_BETRAYAL' ||
    e.type === 'ROMANCE_PROGRESSION' ||
    e.type === 'AMBUSH_TRIGGERED' ||
    e.type === 'NPC_DEATH' ||
    e.type === 'FACTION_CONFLICT_ESCALATED'
  );

  if (highPriorityEvents.length > 0) {
    warningLevel = 'caution';
    blockedBy.push(`UPCOMING_EVENT:${highPriorityEvents[0].type}`);
  }

  // ===== CHECK 6: Faction Stability =====
  const factionReps = state.player?.factionReputation ?? {};
  const factionStability = Object.entries(factionReps).map(([factionId, rep]) => ({
    factionId,
    rep: rep as number,
    isUnstable: (rep as number) > 80 || (rep as number) < -80 // Too high or too low
  }));

  const unstableFactions = factionStability.filter(f => f.isUnstable);
  if (unstableFactions.length > 0) {
    warningLevel = warningLevel === 'danger' ? 'danger' : 'caution';
    for (const faction of unstableFactions) {
      blockedBy.push(`FACTION_UNSTABLE:${faction.factionId}:${faction.rep > 0 ? 'LOVE' : 'HATE'}`);
    }
  }

  // ===== All checks complete =====
  const recommendation = generateRecommendation(blockedBy, durationTicks, warningLevel);

  return {
    canProceed: blockedBy.length === 0 || !blockedBy.some(b => b.includes('IMMINENT') || b.includes('COMBAT') || b.includes('CRITICAL')),
    reason: warningLevel === 'danger' && blockedBy.length > 0 
      ? `⚠️ Proceeding with caution: ${blockedBy.join(', ')}`
      : undefined,
    warningLevel,
    recommendation,
    blockedBy
  };
}

/**
 * Generate human-readable recommendation based on interruption checks
 */
function generateRecommendation(blockedBy: string[], durationTicks: number, warningLevel: string): string | undefined {
  if (blockedBy.length === 0) {
    return warningLevel === 'safe' ? '✨ Ideal conditions for study' : '⚠️ Proceed cautiously';
  }

  // Suggest shorter duration if there are warnings
  if (durationTicks > 240 && warningLevel !== 'safe') {
    return `Consider studying for fewer ticks (suggested: ${Math.min(60, durationTicks / 4)} ticks)`;
  }

  if (blockedBy.some(b => b.includes('FACTION'))) {
    return 'Stabilize faction relations before extended study';
  }

  if (blockedBy.some(b => b.includes('DEBT'))) {
    return 'Resolve temporal debt before time-skipping (use meditation)';
  }

  return undefined;
}

/**
 * Calculate the "safety score" for a study skip (0-100)
 * Used for visual feedback: green (75+), yellow (50-74), red (<50)
 */
export function calculateStudySafetyScore(state: WorldState, durationTicks: number): number {
  let score = 100;

  // Paradox level impact
  score -= Math.max(0, state.paradoxLevel ?? 0) * 0.5; // Up to -50 points

  // Temporal debt impact
  score -= Math.max(0, (state.player?.temporalDebt ?? 0)) * 0.2; // Up to -20 points

  // Duration impact (longer skips are riskier)
  if (durationTicks > 1440) score -= 10; // 1 day+
  if (durationTicks > 4320) score -= 15; // 3 days+
  if (durationTicks > 10080) score -= 20; // 7 days+

  // Faction instability penalty
  const factionCount = Object.keys(state.player?.factionReputation ?? {}).length;
  if (factionCount > 0) {
    const unstable = Object.values(state.player?.factionReputation ?? {})
      .filter(rep => (rep as number) > 80 || (rep as number) < -80);
    score -= (unstable.length / Math.max(factionCount, 1)) * 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get color for safety score visualization
 */
export function getSafetyScoreColor(score: number): string {
  if (score >= 75) return '#22c55e'; // Green (safe)
  if (score >= 50) return '#eab308'; // Yellow (caution)
  return '#ef4444'; // Red (danger)
}

/**
 * Phase 48-Chronos Module 3: Calculate faction advancement multiplier
 * 
 * Scales faction changes (power gains, relationship changes, conflicts) based on time-skip duration.
 * Prevents compression of multi-day events into unrealistic single-day outcomes.
 * 
 * @param durationTicks How many ticks are being skipped
 * @returns Multiplier value (clamped 1.0-7.0)
 */
export function calculateFactionAdvancementMultiplier(durationTicks: number): number {
  // 1440 ticks = 1 day in standard game time
  const STANDARD_DAY_TICKS = 1440;
  
  const baseMultiplier = durationTicks / STANDARD_DAY_TICKS;
  
  // Clamp to reasonable range: min 1x, max ~7 days
  return Math.max(1.0, Math.min(7.0, baseMultiplier));
}

/**
 * Apply faction advancement multiplier to a power gain value
 * Used when recalculating faction turns during batch ticks
 * 
 * @param basePowerGain Power gain for one standard turn
 * @param multiplier Faction advancement multiplier (from calculateFactionAdvancementMultiplier)
 * @returns Scaled power gain
 */
export function applyFactionMultiplier(basePowerGain: number, multiplier: number): number {
  // Power gains scale logarithmically to prevent runaway snowballing
  // (7 days of growth doesn't = 7x the single-day gain, more like 3-4x)
  const logarithmicScale = Math.log(multiplier + 1); // +1 to avoid log(1)=0
  return basePowerGain * logarithmicScale;
}

export default {
  checkStudyInterruption,
  calculateStudySafetyScore,
  getSafetyScoreColor,
  calculateFactionAdvancementMultiplier,
  applyFactionMultiplier
};
