/**
 * seasonEngine.ts - Seasonal Progression & Transitions
 * Determines current season based on deterministic tick progression.
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface SeasonResult {
  current: Season;
  dayOfSeason: number;
  daysInSeason: number;
  hasChanged: boolean;
  transitionEvent?: string;
}

export const DAYS_PER_SEASON = 7;

/**
 * Resolve current season based on tick (deterministic)
 * Seasons cycle every 7 days: Winter (0-7), Spring (7-14), Summer (14-21), Autumn (21-28), repeat
 */
export function resolveSeason(
  tick: number,
  previousSeason?: Season
): SeasonResult {
  const seasonOrder: Season[] = ['winter', 'spring', 'summer', 'autumn'];
  const seasonIndex = Math.floor((tick / (24 * DAYS_PER_SEASON)) % 4);
  const current = seasonOrder[seasonIndex];

  const dayOfSeason = Math.floor((tick / 24) % DAYS_PER_SEASON);
  const hasChanged = previousSeason !== undefined && current !== previousSeason;
  const transitionEvent = hasChanged ? `SEASON_CHANGED_TO_${current.toUpperCase()}` : undefined;

  return {
    current,
    dayOfSeason,
    daysInSeason: DAYS_PER_SEASON,
    hasChanged,
    transitionEvent
  };
}

/**
 * Get seasonal color palette for UI/particle theming
 */
export function getSeasonalVisuals(season: Season) {
  switch (season) {
    case 'winter':
      return { primaryColor: '#b8d4e8', accentColor: '#e8f4f8', foliageColor: '#ffffff' };
    case 'spring':
      return { primaryColor: '#a8e6c9', accentColor: '#d4f8e8', foliageColor: '#7fd88f' };
    case 'summer':
      return { primaryColor: '#f9d56e', accentColor: '#fff9e6', foliageColor: '#2d5016' };
    case 'autumn':
      return { primaryColor: '#ff9a56', accentColor: '#ffe6cc', foliageColor: '#c85a17' };
  }
}
