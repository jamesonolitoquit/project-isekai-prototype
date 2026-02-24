/**
 * M70-A: Quest Recommendation Engine
 * ML-based quest suggestions personalized to player playstyle and progression
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type PlaystyleType = 'combatant' | 'socialite' | 'explorer' | 'ritualist';

export interface PlayerProfile {
  playerId: string;
  playstyle: PlaystyleType;
  level: number;
  playtimeHours: number;
  questsCompleted: number;
  lastActivityTick: number;
}

export interface Quest {
  questId: string;
  name: string;
  type: 'combat' | 'social' | 'exploration' | 'ritual';
  difficulty: number; // 1-100
  reward: { gold: number; xp: number; items: string[] };
  requiredFactions?: string[];
  minLevel: number;
}

export interface QuestAffinityScore {
  questId: string;
  affinity: number; // 0-100
  reasons: string[];
  estimatedCompletionTime: number; // ticks
}

export interface DailyRecommendationFeed {
  playerId: string;
  topQuests: QuestAffinityScore[];
  generatedAt: number;
  refreshNeededAt: number;
}

export interface QuestEngagementMetric {
  playerId: string;
  questId: string;
  recommendedAt: number;
  acceptedAt: number | null;
  completedAt: number | null;
  satisfactionRating: number | null; // 1-5
}

export interface QuestRecommendationState {
  playerProfiles: Map<string, PlayerProfile>;
  questCatalog: Map<string, Quest>;
  dailyFeeds: Map<string, DailyRecommendationFeed>;
  engagementMetrics: QuestEngagementMetric[];
  affinityCache: Map<string, QuestAffinityScore[]>; // questId -> scores
  stats: {
    totalRecommendations: number;
    totalAcceptances: number;
    acceptanceRate: number;
    averageCompletionRate: number;
    topQuestsByPlaystyle: Record<PlaystyleType, string>;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: QuestRecommendationState = {
  playerProfiles: new Map(),
  questCatalog: new Map(),
  dailyFeeds: new Map(),
  engagementMetrics: [],
  affinityCache: new Map(),
  stats: {
    totalRecommendations: 0,
    totalAcceptances: 0,
    acceptanceRate: 0,
    averageCompletionRate: 0,
    topQuestsByPlaystyle: {
      combatant: '',
      socialite: '',
      explorer: '',
      ritualist: '',
    },
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initQuestRecommendationEngine(): boolean {
  state.playerProfiles.clear();
  state.questCatalog.clear();
  state.dailyFeeds.clear();
  state.engagementMetrics = [];
  state.affinityCache.clear();
  state.stats = {
    totalRecommendations: 0,
    totalAcceptances: 0,
    acceptanceRate: 0,
    averageCompletionRate: 0,
    topQuestsByPlaystyle: {
      combatant: '',
      socialite: '',
      explorer: '',
      ritualist: '',
    },
  };
  return true;
}

export function getRecommendationState(): QuestRecommendationState {
  return state;
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

export function registerPlayerProfile(
  playerId: string,
  playstyle: PlaystyleType,
  level: number,
  playtimeHours: number,
  tick: number
): void {
  const profile: PlayerProfile = {
    playerId,
    playstyle,
    level,
    playtimeHours,
    questsCompleted: 0,
    lastActivityTick: tick,
  };

  state.playerProfiles.set(playerId, profile);
}

export function updatePlayerProgress(
  playerId: string,
  level: number,
  questsCompleted: number,
  tick: number
): void {
  let profile = state.playerProfiles.get(playerId);
  if (!profile) {
    profile = {
      playerId,
      playstyle: 'explorer',
      level: 1,
      playtimeHours: 0,
      questsCompleted: 0,
      lastActivityTick: tick,
    };
    state.playerProfiles.set(playerId, profile);
  }

  profile.level = level;
  profile.questsCompleted = questsCompleted;
  profile.lastActivityTick = tick;
}

// ============================================================================
// QUEST CATALOG MANAGEMENT
// ============================================================================

export function registerQuest(quest: Quest): void {
  state.questCatalog.set(quest.questId, quest);
}

export function getQuestCatalog(): Quest[] {
  return Array.from(state.questCatalog.values());
}

// ============================================================================
// AFFINITY SCORING
// ============================================================================

function calculateQuestAffinity(
  profile: PlayerProfile,
  quest: Quest
): QuestAffinityScore {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Playstyle match (0-25 points)
  const playstyleBonus = calculatePlaystyleBonus(profile.playstyle, quest.type);
  score += playstyleBonus;
  if (playstyleBonus > 0) {
    reasons.push(`Playstyle match for ${profile.playstyle}`);
  }

  // Difficulty progression (0-25 points)
  const difficultyScore = calculateDifficultyScore(profile.level, quest.difficulty);
  score += difficultyScore;
  if (difficultyScore > 0) {
    reasons.push(`Appropriate difficulty (${quest.difficulty}/100)`);
  }

  // Progression incentive (0-15 points)
  const progressionBonus = calculateProgressionBonus(profile.questsCompleted, quest.reward);
  score += progressionBonus;
  if (progressionBonus > 0) {
    reasons.push(`Strong rewards (${quest.reward.gold}g, ${quest.reward.xp}xp)`);
  }

  // Recency discount (0 to -15 points)
  const recencyPenalty = calculateRecencyPenalty(profile.lastActivityTick);
  score = Math.max(0, score + recencyPenalty);

  // Cap at 100
  score = Math.min(100, score);

  const estimatedTime = Math.max(100, 500 - quest.difficulty * 3);

  return {
    questId: quest.questId,
    affinity: score,
    reasons,
    estimatedCompletionTime: estimatedTime,
  };
}

function calculatePlaystyleBonus(playstyle: PlaystyleType, questType: string): number {
  const bonusMatrix: Record<PlaystyleType, Record<string, number>> = {
    combatant: { combat: 25, exploration: 10, social: 0, ritual: 5 },
    explorer: { exploration: 25, combat: 15, ritual: 10, social: 0 },
    socialite: { social: 25, ritual: 15, exploration: 5, combat: 0 },
    ritualist: { ritual: 25, social: 10, combat: 5, exploration: 0 },
  };

  return bonusMatrix[playstyle][questType] || 5;
}

function calculateDifficultyScore(level: number, difficulty: number): number {
  const levelDifficulty = level * 1.5; // Expected difficulty for player level

  // Sweet spot: difficulty within 80-120% of expected
  if (difficulty >= levelDifficulty * 0.8 && difficulty <= levelDifficulty * 1.2) {
    return 25;
  }

  // Close: 60-80% or 120-140%
  if (difficulty >= levelDifficulty * 0.6 && difficulty <= levelDifficulty * 1.4) {
    return 12;
  }

  // Too easy or too hard
  return 0;
}

function calculateProgressionBonus(questsCompleted: number, reward: any): number {
  const baseBonus = 10;
  const rewardMultiplier = Math.min(1, reward.xp / 1000);
  return Math.round(baseBonus * rewardMultiplier + 5);
}

function calculateRecencyPenalty(lastActivityTick: number): number {
  // No penalty if recently active
  const currentEstimatedTick = 10000; // Mock current tick
  const timeSinceActive = currentEstimatedTick - lastActivityTick;

  if (timeSinceActive > 5000) {
    // Player hasn't been active for a while
    return -10;
  }

  return 0;
}

// ============================================================================
// RECOMMENDATION GENERATION
// ============================================================================

export function generateDailyRecommendations(playerId: string, tick: number): DailyRecommendationFeed {
  const profile = state.playerProfiles.get(playerId);
  if (!profile) {
    throw new Error(`Player ${playerId} not found`);
  }

  const scores: QuestAffinityScore[] = [];
  const questsArray = Array.from(state.questCatalog.values());

  for (let i = 0; i < questsArray.length; i++) {
    const quest = questsArray[i];

    // Filter by level requirement
    if (quest.minLevel > profile.level) {
      continue;
    }

    const score = calculateQuestAffinity(profile, quest);
    scores.push(score);
  }

  // Sort by affinity descending
  scores.sort((a, b) => b.affinity - a.affinity);

  // Take top 5
  const topQuests = scores.slice(0, 5);

  const feed: DailyRecommendationFeed = {
    playerId,
    topQuests,
    generatedAt: tick,
    refreshNeededAt: tick + 5000,
  };

  state.dailyFeeds.set(playerId, feed);
  state.stats.totalRecommendations += topQuests.length;

  // Cache the scores
  state.affinityCache.set(`recommendations_${playerId}`, topQuests);

  return feed;
}

export function getDailyRecommendations(playerId: string): DailyRecommendationFeed | undefined {
  return state.dailyFeeds.get(playerId);
}

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

export function trackQuestAcceptance(
  playerId: string,
  questId: string,
  tick: number
): void {
  const metric: QuestEngagementMetric = {
    playerId,
    questId,
    recommendedAt: tick,
    acceptedAt: tick,
    completedAt: null,
    satisfactionRating: null,
  };

  state.engagementMetrics.push(metric);
  state.stats.totalAcceptances++;
}

export function trackQuestCompletion(
  playerId: string,
  questId: string,
  satisfaction: number,
  tick: number
): void {
  const metrics = state.engagementMetrics.filter(
    (m) => m.playerId === playerId && m.questId === questId
  );

  if (metrics.length > 0) {
    const metric = metrics[metrics.length - 1];
    metric.completedAt = tick;
    metric.satisfactionRating = satisfaction;
  }
}

export function getEngagementMetrics(): QuestEngagementMetric[] {
  return state.engagementMetrics;
}

export function getPlayerAcceptanceRate(playerId: string): number {
  const playerMetrics = state.engagementMetrics.filter((m) => m.playerId === playerId);

  if (playerMetrics.length === 0) return 0;

  const accepted = playerMetrics.filter((m) => m.acceptedAt !== null).length;
  return (accepted / playerMetrics.length) * 100;
}

export function getPlayerCompletionRate(playerId: string): number {
  const playerMetrics = state.engagementMetrics.filter((m) => m.playerId === playerId);

  if (playerMetrics.length === 0) return 0;

  const completed = playerMetrics.filter((m) => m.completedAt !== null).length;
  return (completed / playerMetrics.length) * 100;
}

// ============================================================================
// STATS & REPORTING
// ============================================================================

export function getRecommendationStats(): any {
  const metrics = state.engagementMetrics;

  if (metrics.length === 0) {
    return state.stats;
  }

  const accepted = metrics.filter((m) => m.acceptedAt !== null).length;
  const completed = metrics.filter((m) => m.completedAt !== null).length;

  return {
    ...state.stats,
    acceptanceRate: (accepted / metrics.length) * 100,
    averageCompletionRate: (completed / metrics.length) * 100,
  };
}

export function getTopQuestsByPlaystyle(playstyle: PlaystyleType): string[] {
  const metrics = state.engagementMetrics;
  const playstyleMetrics = metrics.filter((m) => {
    const profile = state.playerProfiles.get(m.playerId);
    return profile && profile.playstyle === playstyle;
  });

  if (playstyleMetrics.length === 0) {
    return [];
  }

  // Group by questId and count completions
  const questCompletions = new Map<string, number>();
  for (let i = 0; i < playstyleMetrics.length; i++) {
    const metric = playstyleMetrics[i];
    if (metric.completedAt !== null) {
      questCompletions.set(metric.questId, (questCompletions.get(metric.questId) ?? 0) + 1);
    }
  }

  // Sort by completion count
  const sorted = Array.from(questCompletions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  return sorted;
}
