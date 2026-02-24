/**
 * questGenerator.ts - Phase 18 Task 3: Landmark Quest Generation
 * 
 * Anchors procedural quests to Historical Landmarks, enabling "Soft Canon" 
 * quest completion to reduce generational paradox and stabilize timelines.
 * 
 * Quest Types:
 * - CLEANSE_CORRUPTION: Remove temporal anomalies from a landmark
 * - RETRIEVE_RELIC: Find and restore a sacred artifact tied to landmark
 * - WITNESS_EVENT: Observe or recreate a historical moment at landmark
 * - RESOLVE_PARADOX: Stabilize timeline branches near landmark
 */

import type { WorldState } from './worldEngine';

/**
 * Landmark quest with soft canon properties
 */
export interface LandmarkQuest {
  questId: string;
  name: string;
  landmarkName: string;                 // "The Coronation of the Silver King"
  description: string;
  questType: 'CLEANSE_CORRUPTION' | 'RETRIEVE_RELIC' | 'WITNESS_EVENT' | 'RESOLVE_PARADOX';
  targetLocationId: string;             // Where the landmark is situated
  epochBound?: number;                  // Optional: only available in specific epoch
  paradoxReward: number;                // -5 to -15 paradox reduction
  legacyPointsReward: number;           // Additional reward in legacy currency
  isSoftCanon: boolean;                 // Affects timeline branching when completed
  difficulty: 1 | 2 | 3 | 4 | 5;        // Quest difficulty (1=trivial, 5=legendary)
  objectives: Array<{
    id: string;
    description: string;
    completed: boolean;
  }>;
  isCompleted: boolean;
  completedAt?: number;
  affectedBranchCount?: number;         // How many timeline branches this stabilizes
  canonLocked?: boolean;                // "Canon Lock" badge - prevents branch divergence at this node
}

/**
 * Soft canon result when quest is completed
 */
export interface SoftCanonEffect {
  questId: string;
  paradoxReduction: number;             // Applied to generationalParadox
  stabilizedBranches: number;           // Timeline branches locked to canonical path
  timelineEffect: 'minor' | 'moderate' | 'major';  // Scale of timeline impact
  description: string;                  // What changed in the timeline
}

// Registry of generated landmark quests
const landmarkQuestRegistry = new Map<string, LandmarkQuest>();

// Track completed landmark quests for soft canon tracking
const completedLandmarkQuests = new Map<string, {
  questId: string;
  completedAt: number;
  paradoxReduced: number;
  canonLocked: boolean;
}>();

/**
 * Generate a landmark quest from a historical landmark
 */
export function generateLandmarkQuest(
  landmarkName: string,
  state: WorldState,
  locationId?: string,
  difficulty: 1 | 2 | 3 | 4 | 5 = 2
): LandmarkQuest | null {
  const location = state.locations?.find(l => l.id === locationId || l.name?.includes(landmarkName));
  if (!location) {
    return null;
  }

  // Determine quest type based on landmark class
  const questType: LandmarkQuest['questType'] = selectQuestType(landmarkName);
  const { paradoxReward, description, objectives } = buildQuestDetails(
    landmarkName,
    questType,
    difficulty,
    state.metadata?.generationalParadox || 0
  );

  const quest: LandmarkQuest = {
    questId: `landmark-quest-${landmarkName.replace(/\s+/g, '_')}-${Date.now()}`,
    name: `${questType === 'CLEANSE_CORRUPTION' ? 'Cleanse' : 
           questType === 'RETRIEVE_RELIC' ? 'Retrieve' :
           questType === 'WITNESS_EVENT' ? 'Witness' : 'Resolve'} the ${landmarkName}`,
    landmarkName,
    description,
    questType,
    targetLocationId: location.id,
    epochBound: undefined,  // Available in all epochs by default
    paradoxReward,          // Negative = reduction (healing)
    legacyPointsReward: Math.max(10, Math.min(50, difficulty * 10)),
    isSoftCanon: true,
    difficulty,
    objectives,
    isCompleted: false,
    affectedBranchCount: difficulty * 3 + Math.floor(Math.random() * 5)
  };

  landmarkQuestRegistry.set(quest.questId, quest);
  return quest;
}

/**
 * Determine quest type based on landmark characteristics
 */
function selectQuestType(
  landmarkName: string
): LandmarkQuest['questType'] {
  const lower = landmarkName.toLowerCase();

  if (lower.includes('corruption') || lower.includes('paradox') || lower.includes('void')) {
    return 'CLEANSE_CORRUPTION';
  } else if (lower.includes('artifact') || lower.includes('relic') || lower.includes('relic')) {
    return 'RETRIEVE_RELIC';
  } else if (lower.includes('coronation') || lower.includes('event') || lower.includes('gathering')) {
    return 'WITNESS_EVENT';
  } else {
    return 'RESOLVE_PARADOX';
  }
}

/**
 * Build quest details with objectives and descriptions
 */
function buildQuestDetails(
  landmarkName: string,
  questType: LandmarkQuest['questType'],
  difficulty: number,
  currentParadox: number
): {
  paradoxReward: number;
  description: string;
  objectives: Array<{ id: string; description: string; completed: boolean }>;
} {
  // Reward: 5-15 point paradox reduction (more for high paradox)
  const baseReward = 5 + Math.min(10, Math.floor(currentParadox / 50));
  const paradoxReward = -baseReward; // Negative = reduction

  let description = '';
  let objectives: Array<{ id: string; description: string; completed: boolean }> = [];

  switch (questType) {
    case 'CLEANSE_CORRUPTION':
      description = `The essence of ${landmarkName} is corrupted. Restore its temporal integrity and heal the timeline fractures.`;
      objectives = [
        { id: 'investigate', description: 'Investigate the source of corruption', completed: false },
        { id: 'purify', description: 'Perform a purification ritual at the landmark', completed: false },
        { id: 'stabilize', description: 'Stabilize the timeline fractures', completed: false }
      ];
      break;

    case 'RETRIEVE_RELIC':
      description = `A sacred relic tied to ${landmarkName} has been lost to time. Seek it out and restore it to its rightful place.`;
      objectives = [
        { id: 'discover', description: 'Discover where the relic is hidden', completed: false },
        { id: 'retrieve', description: 'Retrieve the relic from its hiding place', completed: false },
        { id: 'restore', description: `Return the relic to ${landmarkName}`, completed: false }
      ];
      break;

    case 'WITNESS_EVENT':
      description = `Witness the historical echo of ${landmarkName} and understand its significance in the timeline.`;
      objectives = [
        { id: 'meditate', description: 'Meditate at the landmark to attune to its history', completed: false },
        { id: 'witness', description: 'Observe the historical vision', completed: false },
        { id: 'record', description: 'Record your understanding in the Chronicle', completed: false }
      ];
      break;

    case 'RESOLVE_PARADOX':
      description = `Paradoxical timelines threaten to unravel ${landmarkName}. Resolve the conflicting histories and restore canonical flow.`;
      objectives = [
        { id: 'identify', description: 'Identify all timeline branches near this landmark', completed: false },
        { id: 'harmonize', description: 'Harmonize the conflicting histories', completed: false },
        { id: 'converge', description: 'Collapse paradoxical branches back to canon', completed: false }
      ];
      break;
  }

  return { paradoxReward, description, objectives };
}

/**
 * Complete a landmark quest and apply soft canon effects
 */
export function completeLandmarkQuest(
  quest: LandmarkQuest,
  state: WorldState
): SoftCanonEffect | null {
  if (quest.isCompleted) {
    return null;  // Already completed
  }

  // Mark quest as completed
  quest.isCompleted = true;
  quest.completedAt = Date.now();
  quest.canonLocked = true;

  // Track completion
  completedLandmarkQuests.set(quest.questId, {
    questId: quest.questId,
    completedAt: Date.now(),
    paradoxReduced: Math.abs(quest.paradoxReward),
    canonLocked: true
  });

  // Determine timeline effect scale
  const timelineEffect: 'minor' | 'moderate' | 'major' =
    quest.difficulty <= 2 ? 'minor' :
    quest.difficulty <= 4 ? 'moderate' : 'major';

  const effect: SoftCanonEffect = {
    questId: quest.questId,
    paradoxReduction: Math.abs(quest.paradoxReward),
    stabilizedBranches: quest.affectedBranchCount || 0,
    timelineEffect,
    description: `"${quest.landmarkName}" is now locked to canonical history. ${quest.affectedBranchCount} timeline branches have been stabilized.`
  };

  // Apply paradox reduction to world state
  if (state.metadata) {
    state.metadata.generationalParadox = Math.max(
      0,
      (state.metadata.generationalParadox || 0) + quest.paradoxReward
    );
  }

  return effect;
}

/**
 * Get all available landmark quests
 */
export function getAllLandmarkQuests(): LandmarkQuest[] {
  return Array.from(landmarkQuestRegistry.values());
}

/**
 * Get quest by ID
 */
export function getLandmarkQuestById(questId: string): LandmarkQuest | null {
  return landmarkQuestRegistry.get(questId) || null;
}

/**
 * Get completed landmark quests
 */
export function getCompletedLandmarkQuests(): Array<{
  questId: string;
  completedAt: number;
  paradoxReduced: number;
  canonLocked: boolean;
}> {
  return Array.from(completedLandmarkQuests.values());
}

/**
 * Check if a landmark quest is available (allows filtering by epoch, location, etc)
 */
export function isLandmarkQuestAvailable(
  quest: LandmarkQuest,
  currentEpoch?: number,
  currentLocationId?: string
): boolean {
  // Check epoch binding
  if (quest.epochBound && currentEpoch && quest.epochBound !== currentEpoch) {
    return false;
  }

  // Check location (optional - can start quest from anywhere)
  // if (quest.targetLocationId && currentLocationId && quest.targetLocationId !== currentLocationId) {
  //   return false;
  // }

  // Check if already completed
  if (quest.isCompleted) {
    return false;
  }

  return true;
}

/**
 * Get soft canon status - summary of how many landmarks have been locked
 */
export function getSoftCanonStatus(): {
  totalCompletedQuests: number;
  totalParadoxReduced: number;
  totalBranchesStabilized: number;
  majorLandmarksLocked: number;
} {
  const completed = Array.from(completedLandmarkQuests.values());
  const totalParadoxReduced = completed.reduce((sum, c) => sum + c.paradoxReduced, 0);
  const totalBranchesStabilized = completed.reduce((sum, c) => sum + (c.paradoxReduced / 5), 0); // Rough estimate

  return {
    totalCompletedQuests: completed.length,
    totalParadoxReduced,
    totalBranchesStabilized: Math.floor(totalBranchesStabilized),
    majorLandmarksLocked: completed.filter(c => c.canonLocked).length
  };
}

/**
 * Clear quest registry (for new chronicle or testing)
 */
export function clearLandmarkQuestRegistry(): void {
  landmarkQuestRegistry.clear();
  completedLandmarkQuests.clear();
}

