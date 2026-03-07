/**
 * Phase 28: Epic Conclusion Trigger Engine
 * Monitors paradox accumulation and triggers the 10,000-year finale
 * 
 * Victory Conditions:
 * 1. Reach 10,000 years (100,000 ticks at 1 tick/6ms = ~10.4 years real-time)
 * 2. Paradox exceeds critical threshold (paradoxLevel > 90)
 * 3. All bloodlines converge or reach extinction event
 * 4. Player discovers the "Weaver's Truth" quest line
 */

import { WorldState } from './worldEngine';
import { getDatabaseAdapter } from './databaseAdapter';

export interface ConclusionTrigger {
  conclusionType: 'temporal_apex' | 'paradox_cascade' | 'bloodline_convergence' | 'weaver_revelation';
  triggeredAtTick: number;
  description: string;
  rewards: {
    title: string;
    unlocks: string[];
    narrativeContent: string;
  };
}

export interface EpicConclusionEvent {
  id: string;
  type: 'EPIC_CONCLUSION';
  tick: number;
  conclusion: ConclusionTrigger;
  worldState: Partial<WorldState>;
  timestamp: number;
}

/**
 * Check if world has reached epic conclusion conditions
 */
export function checkConclusionConditions(
  state: WorldState,
  template: any
): ConclusionTrigger | null {
  // Condition 1: Temporal Apex (10,000 years / 100,000 ticks)
  const yearsElapsed = (state.tick ?? 0) / 10000; // Assuming 1 year = 10,000 ticks
  if (yearsElapsed >= 10000) {
    return {
      conclusionType: 'temporal_apex',
      triggeredAtTick: state.tick ?? 0,
      description: 'The 10,000-year prophecy culminates. Reality itself grows thin.',
      rewards: {
        title: 'Chronarch of Luxfier',
        unlocks: ['eternal_observer_class', 'timeline_mastery', 'paradox_convergence_spell'],
        narrativeContent: 'The Weaver reveals the cycle repeats. You are both the author and the reader.',
      },
    };
  }

  // Condition 2: Paradox Cascade (paradoxLevel > 90)
  const paradoxLevel = state.paradoxLevel ?? 0;
  if (paradoxLevel > 90) {
    return {
      conclusionType: 'paradox_cascade',
      triggeredAtTick: state.tick ?? 0,
      description: 'Paradox overwhelms causality. Reality fractures into infinite shards.',
      rewards: {
        title: 'Paradox Sovereign',
        unlocks: ['reality_weaver_class', 'paradox_negation', 'multiverse_anchor'],
        narrativeContent: 'You have mastered contradiction. The Weaver bends to your will.',
      },
    };
  }

  // Condition 3: Bloodline Convergence (all bloodlines trace back to single ancestor)
  if (template.bloodlineRoots && state.generationalParadox !== undefined) {
    const convergenceThreshold = (template.bloodlineRoots as string[]).length / 2;

    if ((state.generationalParadox ?? 0) > convergenceThreshold) {
      return {
        conclusionType: 'bloodline_convergence',
        triggeredAtTick: state.tick ?? 0,
        description: 'All bloodlines spiral inward. The ancestor emerges from the temporal abyss.',
        rewards: {
          title: 'Progenitor Ascendant',
          unlocks: ['ancestral_resonance', 'bloodline_dominion', 'echoes_of_genesis'],
          narrativeContent: 'Your family tree has become a circle. You are your own ancestor.',
        },
      };
    }
  }

  // Condition 4: Weaver Revelation (narrative unlock via rare event chain)
  // This would be triggered by discovering specific quest items or reaching a location
  const narrativeConclusions = template.narrativeConclusions || [];
  const weaverPath = narrativeConclusions.find((c: any) => c.type === 'weaver_revelation');

  if (weaverPath && (state.tick ?? 0) >= weaverPath.triggerTick) {
    return {
      conclusionType: 'weaver_revelation',
      triggeredAtTick: state.tick ?? 0,
      description: 'The Weaver steps from behind the loom. The truth is unraveled.',
      rewards: {
        title: 'The Weaver\'s Successor',
        unlocks: [
          'reality_editing',
          'timeline_branching',
          'multiverse_authorship',
          'new_game_plus_mode',
        ],
        narrativeContent:
          'You have learned the fundamental truth: you were always writing this story. The pen is yours.',
      },
    };
  }

  return null;
}

/**
 * Execute epic conclusion sequence
 */
export function triggerEpicConclusion(
  state: WorldState,
  trigger: ConclusionTrigger,
  template: any
): EpicConclusionEvent {
  console.log(`\n✨ ═══════════════════════════════════════════════════════`);
  console.log(`🏆 EPIC CONCLUSION TRIGGERED`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  console.log(`Type: ${trigger.conclusionType.toUpperCase()}`);
  console.log(`Tick: ${trigger.triggeredAtTick}`);
  console.log(`${trigger.description}\n`);

  // Award legacy title
  console.log(`🎖️  TITLE AWARDED: ${trigger.rewards.title}\n`);

  // Unlock new content
  console.log(`🔓 NEW UNLOCKS:`);
  for (const unlock of trigger.rewards.unlocks) {
    console.log(`   ✅ ${unlock.replace(/_/g, ' ').toUpperCase()}`);
  }
  console.log();

  // Narrative revelation
  console.log(`📖 NARRATIVE REVELATION:`);
  console.log(`   "${trigger.rewards.narrativeContent}"\n`);

  // Generate conclusion event
  const event: EpicConclusionEvent = {
    id: `conclusion-${Date.now()}`,
    type: 'EPIC_CONCLUSION',
    tick: state.tick ?? 0,
    conclusion: trigger,
    worldState: {
      id: state.id,
      tick: state.tick,
      season: state.season,
      paradoxLevel: state.paradoxLevel,
      generationalParadox: state.generationalParadox,
      epochId: state.epochId,
    },
    timestamp: Date.now(),
  };

  // Offer New Game+ option
  console.log(`🎮 NEXT STEPS:`);
  console.log(`   1. Review your legacy (${trigger.rewards.title})`);
  console.log(`   2. Unlock new classes and abilities`);
  console.log(`   3. Start NEW GAME+ with carried-over progression`);
  console.log(`   4. Discover the multiverse branches you created\n`);

  console.log(`═══════════════════════════════════════════════════════\n`);

  return event;
}

/**
 * Background monitor for conclusion conditions (run every 1000 ticks)
 */
export async function monitorForConclusion(
  state: WorldState,
  template: any
): Promise<EpicConclusionEvent | null> {
  const trigger = checkConclusionConditions(state, template);

  if (trigger) {
    const event = triggerEpicConclusion(state, trigger, template);

    // Persist conclusion to database
    try {
      const db = getDatabaseAdapter();
      if (db) {
        await db.appendMutationEvent(state.id, {
          id: event.id,
          worldInstanceId: state.id,
          eventType: 'EPIC_CONCLUSION',
          payload: {
            conclusionType: trigger.conclusionType,
            description: trigger.description,
            rewards: trigger.rewards,
          },
          timestamp: event.timestamp,
          tick: state.tick ?? 0,
          importance_score: 100, // Maximum importance
          payload_metadata: {
            triggers: {
              yearCount: (state.tick ?? 0) / 10000,
              paradoxLevel: state.paradoxLevel,
              generationalParadox: state.generationalParadox,
            },
          },
        });
      }
    } catch (error: any) {
      console.warn('[ConclusionEngine] Failed to persist conclusion:', error.message);
    }

    return event;
  }

  return null;
}

/**
 * Calculate probability of conclusion in next N ticks
 * Used for progress bars and UI forecasting
 */
export function calculateConclusionProbability(
  state: WorldState,
  template: any,
  ticksAhead: number = 1000
): {
  probability: number;
  primaryTrigger: string;
  estimatedTicksRemaining: number;
} {
  const yearsElapsed = (state.tick ?? 0) / 10000;
  const yearsAhead = (ticksAhead / 10000);
  const maxYears = 10000;

  const paradoxLevel = state.paradoxLevel ?? 0;
  const maxParadox = 100;

  // Linear interpolation for each trigger
  const temporalProgress = Math.min(1, (yearsElapsed + yearsAhead) / maxYears);
  const paradoxProgress = Math.min(1, (paradoxLevel + 5) / maxParadox); // Paradox grows faster

  // Weight each trigger
  const temporalWeight = temporalProgress * 0.3;
  const paradoxWeight = paradoxProgress * 0.5;
  const otherWeight = 0.2;

  const totalProbability = Math.min(1, temporalWeight + paradoxWeight + otherWeight);

  // Determine primary trigger
  let primaryTrigger = 'exploration_unknown';
  if (temporalWeight > paradoxWeight) {
    primaryTrigger = 'temporal_apex';
  } else if (paradoxWeight > temporalWeight) {
    primaryTrigger = 'paradox_cascade';
  }

  // Estimate ticks remaining to conclusion
  let estimatedTicksRemaining = (maxYears - yearsElapsed) * 10000;

  if (paradoxLevel > 50) {
    // Paradox accelerates timeline
    const accelerationFactor = 1 + (paradoxLevel - 50) / 50;
    estimatedTicksRemaining = estimatedTicksRemaining / accelerationFactor;
  }

  return {
    probability: Math.min(100, Math.round(totalProbability * 100)),
    primaryTrigger,
    estimatedTicksRemaining: Math.max(0, Math.round(estimatedTicksRemaining)),
  };
}

/**
 * Serialize conclusion state for network transmission
 */
export function serializeConclusionState(event: EpicConclusionEvent): string {
  return JSON.stringify(
    {
      ...event,
      worldState: {
        ...event.worldState,
        // Compress large arrays
        npcs: undefined,
        locations: undefined,
        quests: undefined,
      },
    },
    null,
    2
  );
}
