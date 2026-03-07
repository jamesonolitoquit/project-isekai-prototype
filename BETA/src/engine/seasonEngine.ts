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

export interface SeasonalModifiers {
  manaRegenMult?: number;
  staminaRegenMult?: number;
  staminaDecayMult?: number;
  fireResistanceBase?: number;
  luckBonus?: number;
  expGainMult?: number;
  movementFatigueMult?: number;
  [key: string]: number | undefined;
}

export interface SeasonalLootEntry {
  itemId: string;
  dropRate: number;
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
 * Hardcoded default visual palette per season
 */
const DEFAULT_SEASONAL_VISUALS: Record<Season, { primaryColor: string; accentColor: string; foliageColor: string }> = {
  winter: { primaryColor: '#b8d4e8', accentColor: '#e8f4f8', foliageColor: '#ffffff' },
  spring: { primaryColor: '#a8e6c9', accentColor: '#d4f8e8', foliageColor: '#7fd88f' },
  summer: { primaryColor: '#f9d56e', accentColor: '#fff9e6', foliageColor: '#2d5016' },
  autumn: { primaryColor: '#ff9a56', accentColor: '#ffe6cc', foliageColor: '#c85a17' }
};

/**
 * Get seasonal color palette for UI/particle theming
 * Prioritizes template-defined visualPalette over hardcoded defaults
 * 
 * @param season The current season
 * @param templateSeasonalRules Optional template.seasonalRules object with per-season configs
 */
export function getSeasonalVisuals(
  season: Season, 
  templateSeasonalRules?: Record<string, any>
) {
  // If template provides seasonal rules, use template's visualPalette
  if (templateSeasonalRules && templateSeasonalRules[season.toUpperCase()]) {
    const seasonConfig = templateSeasonalRules[season.toUpperCase()];
    if (seasonConfig.visualPalette) {
      return seasonConfig.visualPalette;
    }
  }

  // Fall back to hardcoded defaults
  return DEFAULT_SEASONAL_VISUALS[season];
}

/**
 * Get mechanical modifiers for the current season
 * e.g., manaRegenMult, staminaDecayMult, etc.
 * 
 * @param season The current season
 * @param templateSeasonalRules Optional template.seasonalRules object
 * @returns SeasonalModifiers for the active season
 */
export function getSeasonalModifiers(
  season: Season,
  templateSeasonalRules?: Record<string, any>
): SeasonalModifiers {
  if (templateSeasonalRules && templateSeasonalRules[season.toUpperCase()]) {
    const seasonConfig = templateSeasonalRules[season.toUpperCase()];
    return seasonConfig.mechanicalModifiers || {};
  }
  return {};
}

/**
 * Get seasonal loot entries for the current season
 * 
 * @param season The current season
 * @param templateSeasonalRules Optional template.seasonalRules object
 * @returns Array of SeasonalLootEntry for the active season
 */
export function getSeasonalLoot(
  season: Season,
  templateSeasonalRules?: Record<string, any>
): SeasonalLootEntry[] {
  if (templateSeasonalRules && templateSeasonalRules[season.toUpperCase()]) {
    const seasonConfig = templateSeasonalRules[season.toUpperCase()];
    return seasonConfig.seasonalLoot || [];
  }
  return [];
}
