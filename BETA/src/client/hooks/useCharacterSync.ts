/**
 * Phase 43: useCharacterSync Hook
 * 
 * Real-time synchronization hook that binds UI components to worldState proficiencies.
 * 
 * Features:
 * - Tracks proficiency changes from authoritative engine
 * - Provides learning potential for UI tooltips
 * - Detects new level-ups and skill achievements
 * - Monitors decay state for skill rows
 * - Memory-efficient: only updates on actual changes
 */

import { useMemo, useCallback } from 'react';
import type { PlayerState, WorldState } from '../../engine/worldEngine';
import { getProficiencySummary } from '../../engine/proficiencyEngine';

interface CharacterSyncState {
  player: PlayerState | null;
  proficiencies: Record<string, {
    level: number;
    xp: number;
    passion: 0 | 1 | 2;
    isDecaying: boolean;
    xpProgress: number;       // 0-100 percentage to next level
    xpToNextLevel: number;
  }>;
  learningPotential: {
    [skillName: string]: {
      skillName: string;
      passionLevel: 0 | 1 | 2;
      xpPotential: number;
    }
  };
  totalMastered: number;      // Count of level 10+ skills
  totalLegendary: number;     // Count of level 20 skills
}

/**
 * Hook to synchronize character proficiency data from worldState
 * 
 * @param worldState - The current world state
 * @returns Character sync state with proficiency tracking
 */
export function useCharacterSync(worldState?: WorldState): CharacterSyncState {
  const player = worldState?.player;

  // Memoized proficiency summaries
  const proficiencySummaries = useMemo(() => {
    if (!player) return [];
    try {
      return getProficiencySummary(player);
    } catch (e) {
      console.warn('[useCharacterSync] Error getting proficiency summary:', e);
      return [];
    }
  }, [player?.proficiencies, player?.name]);

  // Memoized proficiency dict for fast lookup
  const proficienciesDict = useMemo(() => {
    const dict: Record<string, any> = {};
    
    proficiencySummaries.forEach(prof => {
      const currentLevelXp = prof.xp - (prof.level > 0 ? 
        [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5500, 6500, 7500, 8500, 9500][prof.level] 
        : 0);
      
      const nextLevelXp = prof.level < 20 ? 
        [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5500, 6500, 7500, 8500, 9500][prof.level + 1] 
        : [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5500, 6500, 7500, 8500, 9500][20];
      
      const xpToLevel = nextLevelXp - [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5500, 6500, 7500, 8500, 9500][prof.level];
      
      dict[prof.category] = {
        level: prof.level,
        xp: prof.xp,
        passion: prof.passion,
        isDecaying: prof.isDecaying,
        xpProgress: xpToLevel > 0 ? (currentLevelXp / xpToLevel) * 100 : 100,
        xpToNextLevel: xpToLevel > 0 ? xpToLevel - currentLevelXp : 0
      };
    });

    return dict;
  }, [proficiencySummaries]);

  // Learning potential for specific skills
  const learningPotentialMap = useMemo(() => {
    const potential: Record<string, any> = {};

    proficiencySummaries.forEach(prof => {
      // Calculate base XP potential (varies by passion level)
      const baseXpPotential = 25 + (prof.passion === 0 ? -10 : prof.passion === 2 ? 10 : 0);
      
      potential[prof.category] = {
        skillName: prof.category,
        passionLevel: prof.passion,
        xpPotential: baseXpPotential
      };
    });

    return potential;
  }, [proficiencySummaries]);

  // Count mastered and legendary skills
  const [totalMastered, totalLegendary] = useMemo(() => {
    let mastered = 0;
    let legendary = 0;

    proficiencySummaries.forEach(prof => {
      if (prof.level >= 10) mastered++;
      if (prof.level >= 20) legendary++;
    });

    return [mastered, legendary];
  }, [proficiencySummaries]);

  return {
    player: player || null,
    proficiencies: proficienciesDict,
    learningPotential: learningPotentialMap,
    totalMastered,
    totalLegendary
  };
}

/**
 * Hook to get learning potential for a specific skill
 * 
 * @param skillName - Name of the skill to get potential for
 * @param character - Character sync state
 * @returns Learning potential or null
 */
export function useLearningPotential(
  skillName: string,
  character: CharacterSyncState
) {
  return useMemo(() => {
    return character.learningPotential[skillName] || null;
  }, [skillName, character.learningPotential]);
}

/**
 * Hook to detect level-ups (called when proficiency level increases)
 * 
 * @param onLevelUp - Callback when level increases
 * @param previousSummaries - Previous proficiency summaries
 * @param currentSummaries - Current proficiency summaries
 */
export function useLevelUpDetection(
  onLevelUp: (skillName: string, newLevel: number, previousLevel: number) => void | null | undefined,
  previousSummaries: any[] = [],
  currentSummaries: any[] = []
) {
  return useMemo(() => {
    currentSummaries.forEach(current => {
      const previous = previousSummaries.find(p => p.category === current.category);
      
      if (previous && current.level > previous.level) {
        onLevelUp?.(current.category, current.level, previous.level);
      }
    });
  }, [currentSummaries, previousSummaries, onLevelUp]);
}

/**
 * Hook to detect daily XP soft caps being hit
 * 
 * @param onCapReached - Callback when soft cap is reached
 * @param playerState - Current player state
 */
export function useSoftCapDetection(
  onCapReached: (skillName: string) => void | null | undefined,
  playerState?: PlayerState
) {
  const SOFT_CAP_THRESHOLD = 3800; // Just before hard stop at 4000

  return useCallback(() => {
    if (!playerState?.proficiencies) return;

    Object.entries(playerState.proficiencies).forEach(([skillName, profData]) => {
      if (profData.dailyXpEarned && profData.dailyXpEarned >= SOFT_CAP_THRESHOLD) {
        onCapReached?.(skillName);
      }
    });
  }, [playerState?.proficiencies, onCapReached]);
}

/**
 * Hook to get decay warning status for elite skills
 * 
 * @param character - Character sync state
 * @returns Array of skill names that are currently decaying
 */
export function useDecayWarnings(character: CharacterSyncState): string[] {
  return useMemo(() => {
    const decaying: string[] = [];

    Object.entries(character.proficiencies).forEach(([skillName, prof]) => {
      if (prof.isDecaying && prof.level > 10) {
        decaying.push(skillName);
      }
    });

    return decaying;
  }, [character.proficiencies]);
}

/**
 * Utility: Get XP curve array
 * Used by multiple hooks for calculations
 */
export const XP_CURVE = [
  0, 200, 400, 600, 800, 1000,      // Levels 0-5
  1200, 1400, 1600, 1800, 2000,     // Levels 5-10
  2500, 3000, 3500, 4000, 4500,     // Levels 10-15
  5500, 6500, 7500, 8500, 9500      // Levels 15-20
];
