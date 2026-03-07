/**
 * Quest Engine - Phase 8: The Sentinel's Pulse
 * 
 * Monitors gameplay events and automatically evaluates quest objectives.
 * Tracks completion of "Visit", "Explore", "Combat", and "Gather" objectives
 * by listening to MutationLog events.
 */

import type { WorldState, PlayerQuestState, Quest } from './worldEngine';
import type { Event } from '../events/mutationLog';

export interface ObjectiveEvaluationResult {
  questId: string;
  completed: boolean;
  progressMessage: string;
}

/**
 * Evaluates a single objective against the current game state and recent events
 * Phase 11: Supports plural objectives, investigation types, and social debts
 */
export function evaluateObjectiveCompletion(
  quest: Quest,
  playerState: {
    location: string;
    visitedLocations?: Set<string> | string[];
    gold?: number;
    knowledgeBase?: any[];
  },
  recentEvents: Event[]
): ObjectiveEvaluationResult | null {
  // Handle both single 'objective' and plural 'objectives'
  const objectives = quest.objectives || (quest.objective ? [quest.objective] : []);
  if (objectives.length === 0) {
    return null;
  }

  let allCompleted = true;
  let summaryMessage = '';

  for (const objective of objectives) {
    // If objective is already marked as completed in the quest definition, skip
    if (objective.status === 'completed') continue;

    let isObjectiveDone = false;
    let objMessage = '';

    switch (objective.type) {
      case 'visit': {
        if (objective.location && playerState.location === objective.location) {
          isObjectiveDone = true;
          objMessage = `Visited ${objective.location}`;
        }
        break;
      }

      case 'exploration': {
        const hasExplored = recentEvents.some(
          (evt: Event) =>
            evt.type === 'LOCATION_CHANGED' && evt.payload?.newLocationId === objective.location
        );
        if (hasExplored) {
          isObjectiveDone = true;
          objMessage = `Explored ${objective.location}`;
        }
        break;
      }

      case 'combat': {
        const targetNpcId = objective.target || objective.location;
        const hasDefeated = recentEvents.some(
          (evt: Event) =>
            evt.type === 'AUTO_LOOT' && evt.payload?.npcId === targetNpcId
        );
        if (hasDefeated) {
          isObjectiveDone = true;
          objMessage = `Defeated target`;
        }
        break;
      }

      case 'gather': {
        const targetItemId = objective.target || objective.location;
        const itemCount = recentEvents.filter(
          (evt: Event) =>
            evt.type === 'ITEM_PICKED_UP' && evt.payload?.itemId === targetItemId
        ).length;
        if (itemCount >= (objective.quantity || 1)) {
          isObjectiveDone = true;
          objMessage = `Gathered ${targetItemId}`;
        }
        break;
      }

      case 'craft': {
        const targetItemId = objective.target || objective.location;
        const success = recentEvents.some(
          (evt: Event) =>
            evt.type === 'ITEM_CRAFTED' && 
            evt.payload?.success === true &&
            evt.payload?.result?.itemId === targetItemId
        );
        if (success) {
          isObjectiveDone = true;
          objMessage = `Successfully crafted ${targetItemId}`;
        }
        break;
      }

      case 'challenge': {
        // M25: Check for skill check successes or ritual completions
        const challengePassed = recentEvents.some(
          (evt: Event) =>
            (evt.type === 'SKILL_CHECK_SUCCESS' || evt.type === 'RITUAL_COMPLETED') &&
            evt.payload?.targetId === objective.target
        );
        if (challengePassed) {
          isObjectiveDone = true;
          objMessage = `Passed challenge: ${objective.description}`;
        }
        break;
      }

      case 'investigation': {
        // [Phase 10] Check if required clues are in player knowledge base
        if (objective.requiredClues) {
          const kb = playerState.knowledgeBase || [];
          const foundClues = objective.requiredClues.filter(clueId => 
            kb.includes(clueId) || (kb as any[]).some(k => k === clueId || k.id === clueId)
          );
          if (foundClues.length >= objective.requiredClues.length) {
            isObjectiveDone = true;
            objMessage = `Investigated all clues`;
          } else {
            allCompleted = false;
            objMessage = `Collected ${foundClues.length}/${objective.requiredClues.length} clues`;
          }
        }
        break;
      }

      case 'social': {
        // [Phase 11] Social debt or relationship triggers
        const hasSocialWin = recentEvents.some(
          (evt: Event) => evt.type === 'RELATIONSHIP_CHANGED' && evt.payload?.questId === quest.id
        );
        if (hasSocialWin) {
          isObjectiveDone = true;
          objMessage = `Resolved social debt`;
        } else {
          allCompleted = false;
        }
        break;
      }

      case 'challenge':
      case 'craft':
      default: {
        // Fallback: search for manual completion event or dialogue trigger
        const spoken = recentEvents.some(
          (evt: Event) => evt.type === 'DIALOGUE_COMPLETED' && evt.payload?.npcId === objective.target
        );
        if (spoken) {
          isObjectiveDone = true;
          objMessage = `Spoken with ${objective.target}`;
        } else {
          allCompleted = false;
        }
        break;
      }
    }

    if (isObjectiveDone) {
      objective.status = 'completed';
    } else {
      allCompleted = false;
    }
    
    if (objMessage) summaryMessage += (summaryMessage ? '; ' : '') + objMessage;
  }

  return {
    questId: quest.id,
    completed: allCompleted,
    progressMessage: summaryMessage || (allCompleted ? 'All objectives met' : 'Objectives pending...')
  };
}

/**
 * Batch evaluate multiple quests against recent events
 * Returns list of newly completed quests
 */
export function evaluateAllObjectives(
  playerState: any,
  playerQuests: Record<string, PlayerQuestState>,
  allQuests: Quest[],
  recentEvents: Event[]
): ObjectiveEvaluationResult[] {
  const evaluations: ObjectiveEvaluationResult[] = [];

  for (const [questId, questState] of Object.entries(playerQuests)) {
    // Skip completed or failed quests
    if (questState.status === 'completed' || questState.status === 'failed') {
      continue;
    }

    // Find quest definition
    const questDef = allQuests.find((q: Quest) => q.id === questId);
    if (!questDef) {
      continue;
    }

    // Evaluate objective
    const evaluation = evaluateObjectiveCompletion(questDef, playerState, recentEvents);
    if (evaluation && evaluation.completed && questState.status === 'in_progress') {
      evaluations.push(evaluation);
    }
  }

  return evaluations;
}

/**
 * Initialize a new quest in player state
 * Called when accepting a quest from an NPC
 */
export function initializePlayerQuest(questId: string, worldTick: number = 0): PlayerQuestState {
  return {
    status: 'in_progress',
    startedAt: worldTick,
    currentObjectiveIndex: 0
  };
}

/**
 * Complete a quest and record completion
 */
export function completeQuest(
  questState: PlayerQuestState,
  worldTick: number = 0
): PlayerQuestState {
  return {
    ...questState,
    status: 'completed',
    completedAt: worldTick
  };
}
