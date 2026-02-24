/**
 * M70-D: Dynamic Lifecycle Engine
 * Per-player engagement lifecycle management and progression pacing
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type LifecycleStage = 'onboarding' | 'exploration' | 'engagement' | 'mastery' | 'legacy';

export interface LifecycleThresholds {
  onboarding: [number, number]; // tick range
  exploration: [number, number];
  engagement: [number, number];
  mastery: [number, number];
  legacy: [number, number];
}

export interface PlayerLifecycleProfile {
  playerId: string;
  currentStage: LifecycleStage;
  stageStartTick: number;
  totalPlaytimeTicks: number;
  level: number;
  questsCompleted: number;
  progressionVelocity: number; // ticks per level
  engagementStreak: number; // consecutive days active
  lastMilestoneAchieved: string;
}

export interface StagedContentUnlock {
  contentId: string;
  requiredStage: LifecycleStage;
  minLevel: number;
  description: string;
  unlockedAt: number | null;
}

export interface DifficultyScalingProfile {
  stage: LifecycleStage;
  baseHealth: number;
  attackPower: number;
  spellResistance: number;
  rewardScalar: number;
}

export interface LifecycleMetric {
  playerId: string;
  stage: LifecycleStage;
  completionRate: number; // 0-100%
  timeToProgression: number; // ticks
  churnRiskAtStage: number; // 0-100%
  engagementScore: number; // 0-100%
}

export interface LifecycleState {
  playerProfiles: Map<string, PlayerLifecycleProfile>;
  contentUnlocks: Map<string, StagedContentUnlock>;
  difficultyScaling: Map<LifecycleStage, DifficultyScalingProfile>;
  stageMetrics: LifecycleMetric[];
  thresholds: LifecycleThresholds;
  stats: {
    totalPlayersOnboarded: number;
    totalTransitions: number;
    avgTimePerStage: Record<LifecycleStage, number>;
    stageChurnRates: Record<LifecycleStage, number>;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const defaultThresholds: LifecycleThresholds = {
  onboarding: [0, 1000],
  exploration: [1000, 5000],
  engagement: [5000, 20000],
  mastery: [20000, 100000],
  legacy: [100000, Infinity],
};

const defaultDifficultyScaling: Record<LifecycleStage, DifficultyScalingProfile> = {
  onboarding: {
    stage: 'onboarding',
    baseHealth: 10,
    attackPower: 2,
    spellResistance: 0,
    rewardScalar: 0.5,
  },
  exploration: {
    stage: 'exploration',
    baseHealth: 30,
    attackPower: 5,
    spellResistance: 5,
    rewardScalar: 1.0,
  },
  engagement: {
    stage: 'engagement',
    baseHealth: 80,
    attackPower: 15,
    spellResistance: 15,
    rewardScalar: 1.5,
  },
  mastery: {
    stage: 'mastery',
    baseHealth: 200,
    attackPower: 40,
    spellResistance: 30,
    rewardScalar: 2.0,
  },
  legacy: {
    stage: 'legacy',
    baseHealth: 500,
    attackPower: 100,
    spellResistance: 50,
    rewardScalar: 2.5,
  },
};

const state: LifecycleState = {
  playerProfiles: new Map(),
  contentUnlocks: new Map(),
  difficultyScaling: new Map(),
  stageMetrics: [],
  thresholds: defaultThresholds,
  stats: {
    totalPlayersOnboarded: 0,
    totalTransitions: 0,
    avgTimePerStage: {
      onboarding: 0,
      exploration: 0,
      engagement: 0,
      mastery: 0,
      legacy: 0,
    },
    stageChurnRates: {
      onboarding: 0,
      exploration: 0,
      engagement: 0,
      mastery: 0,
      legacy: 0,
    },
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initDynamicLifecycle(): boolean {
  state.playerProfiles.clear();
  state.contentUnlocks.clear();
  state.stageMetrics = [];

  // Initialize difficulty scaling
  state.difficultyScaling.clear();
  const stageKeys = Object.keys(defaultDifficultyScaling) as LifecycleStage[];
  for (let i = 0; i < stageKeys.length; i++) {
    const stage = stageKeys[i];
    state.difficultyScaling.set(stage, defaultDifficultyScaling[stage]);
  }

  state.stats = {
    totalPlayersOnboarded: 0,
    totalTransitions: 0,
    avgTimePerStage: {
      onboarding: 0,
      exploration: 0,
      engagement: 0,
      mastery: 0,
      legacy: 0,
    },
    stageChurnRates: {
      onboarding: 0,
      exploration: 0,
      engagement: 0,
      mastery: 0,
      legacy: 0,
    },
  };

  return true;
}

export function getLifecycleState(): LifecycleState {
  return state;
}

// ============================================================================
// LIFECYCLE STAGE CLASSIFICATION
// ============================================================================

function classifyLifecycleStage(totalPlaytimeTicks: number): LifecycleStage {
  const thresholds = state.thresholds;

  if (totalPlaytimeTicks < thresholds.exploration[0]) return 'onboarding';
  if (totalPlaytimeTicks < thresholds.engagement[0]) return 'exploration';
  if (totalPlaytimeTicks < thresholds.mastery[0]) return 'engagement';
  if (totalPlaytimeTicks < thresholds.legacy[0]) return 'mastery';
  return 'legacy';
}

export function registerPlayer(
  playerId: string,
  tick: number
): PlayerLifecycleProfile {
  const profile: PlayerLifecycleProfile = {
    playerId,
    currentStage: 'onboarding',
    stageStartTick: tick,
    totalPlaytimeTicks: 0,
    level: 1,
    questsCompleted: 0,
    progressionVelocity: 500, // ticks per level
    engagementStreak: 1,
    lastMilestoneAchieved: 'account_created',
  };

  state.playerProfiles.set(playerId, profile);
  state.stats.totalPlayersOnboarded++;

  return profile;
}

export function updatePlayerProgress(
  playerId: string,
  totalPlaytimeTicks: number,
  level: number,
  questsCompleted: number,
  tick: number
): LifecycleStage | null {
  let profile = state.playerProfiles.get(playerId);
  if (!profile) {
    profile = registerPlayer(playerId, tick);
  }

  profile.totalPlaytimeTicks = totalPlaytimeTicks;
  profile.level = level;
  profile.questsCompleted = questsCompleted;

  // Calculate velocity
  if (profile.level > 1) {
    profile.progressionVelocity = Math.round(totalPlaytimeTicks / (level - 1));
  }

  // Check for stage transition
  const newStage = classifyLifecycleStage(totalPlaytimeTicks);
  if (newStage !== profile.currentStage) {
    const oldStage = profile.currentStage;
    profile.currentStage = newStage;
    profile.stageStartTick = tick;
    state.stats.totalTransitions++;

    // Update stage transition stats
    state.stats.avgTimePerStage[oldStage] = tick - profile.stageStartTick;

    return newStage;
  }

  return null;
}

export function getPlayerLifecycleProfile(playerId: string): PlayerLifecycleProfile | undefined {
  return state.playerProfiles.get(playerId);
}

// ============================================================================
// CONTENT UNLOCKING
// ============================================================================

export function registerStagedContent(content: StagedContentUnlock): void {
  state.contentUnlocks.set(content.contentId, content);
}

export function unlockContentForStage(
  contentId: string,
  stage: LifecycleStage
): boolean {
  const content = state.contentUnlocks.get(contentId);
  if (!content) {
    return false;
  }

  // Check if content should be unlocked for this stage
  if (content.requiredStage === stage) {
    content.unlockedAt = Date.now();
    return true;
  }

  return false;
}

export function getAvailableContent(playerId: string): StagedContentUnlock[] {
  const profile = state.playerProfiles.get(playerId);
  if (!profile) {
    return [];
  }

  const available: StagedContentUnlock[] = [];
  const contentsArray = Array.from(state.contentUnlocks.values());

  for (let i = 0; i < contentsArray.length; i++) {
    const content = contentsArray[i];
    if (
      content.requiredStage === profile.currentStage ||
      (content.minLevel <= profile.level && content.unlockedAt !== null)
    ) {
      available.push(content);
    }
  }

  return available;
}

// ============================================================================
// DIFFICULTY SCALING
// ============================================================================

export function getScaledDifficulty(stage: LifecycleStage): DifficultyScalingProfile | undefined {
  return state.difficultyScaling.get(stage);
}

export function scaleDifficultyForPlayer(
  playerId: string,
  baseEncounter: {
    health: number;
    attackPower: number;
    spellResistance: number;
    reward: number;
  }
): any {
  const profile = state.playerProfiles.get(playerId);
  if (!profile) {
    return baseEncounter;
  }

  const scaling = state.difficultyScaling.get(profile.currentStage);
  if (!scaling) {
    return baseEncounter;
  }

  // Apply player level scaling (every 5 levels, increase difficulty by 10%)
  const levelScalar = 1 + (profile.level / 5) * 0.1;

  return {
    health: Math.round(baseEncounter.health * (scaling.baseHealth / 100) * levelScalar),
    attackPower: Math.round(
      baseEncounter.attackPower * (scaling.attackPower / 100) * levelScalar
    ),
    spellResistance: Math.round(
      baseEncounter.spellResistance * (scaling.spellResistance / 100) * levelScalar
    ),
    reward: Math.round(baseEncounter.reward * scaling.rewardScalar),
  };
}

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

export function recordLifecycleMetric(
  playerId: string,
  stage: LifecycleStage,
  completionRate: number,
  timeToProgression: number,
  churnRisk: number,
  engagementScore: number
): void {
  const metric: LifecycleMetric = {
    playerId,
    stage,
    completionRate,
    timeToProgression,
    churnRiskAtStage: churnRisk,
    engagementScore,
  };

  state.stageMetrics.push(metric);
}

export function getLifecycleMetrics(playerId?: string): LifecycleMetric[] {
  if (playerId) {
    return state.stageMetrics.filter((m) => m.playerId === playerId);
  }
  return state.stageMetrics;
}

// ============================================================================
// PACING & PROGRESSION
// ============================================================================

export function getProgressionPace(playerId: string): {
  estimatedTimeToNextLevel: number;
  estimatedTimeToNextStage: number;
} {
  const profile = state.playerProfiles.get(playerId);
  if (!profile) {
    return { estimatedTimeToNextLevel: 0, estimatedTimeToNextStage: 0 };
  }

  const timeToNextLevel = profile.progressionVelocity;

  // Time to next stage boundary
  const nextStageBoundary =
    Object.values(state.thresholds).find(([min, max]) => profile.totalPlaytimeTicks < max)?.[1] || Infinity;

  const timeToNextStage = nextStageBoundary - profile.totalPlaytimeTicks;

  return {
    estimatedTimeToNextLevel: timeToNextLevel,
    estimatedTimeToNextStage: timeToNextStage,
  };
}

export function shouldBoostProgression(playerId: string): boolean {
  const profile = state.playerProfiles.get(playerId);
  if (!profile) {
    return false;
  }

  // Boost progression for at-risk players (long in exploration stage)
  if (
    profile.currentStage === 'exploration' &&
    profile.totalPlaytimeTicks > state.thresholds.exploration[1] * 1.5
  ) {
    return true;
  }

  // Boost for players stuck at level ceiling
  if (profile.progressionVelocity > 2000) {
    return true;
  }

  return false;
}

// ============================================================================
// STATS & REPORTING
// ============================================================================

export function getLifecycleStats(): any {
  const profiles = Array.from(state.playerProfiles.values());

  if (profiles.length === 0) {
    return state.stats;
  }

  // Calculate stage distribution
  const stageDistribution: Record<LifecycleStage, number> = {
    onboarding: 0,
    exploration: 0,
    engagement: 0,
    mastery: 0,
    legacy: 0,
  };

  for (let i = 0; i < profiles.length; i++) {
    stageDistribution[profiles[i].currentStage]++;
  }

  return {
    ...state.stats,
    stageDistribution,
    totalPlayers: profiles.length,
    avgProgressionVelocity:
      profiles.reduce((sum, p) => sum + p.progressionVelocity, 0) / profiles.length,
  };
}

export function getChurnRiskByStage(): Record<LifecycleStage, number> {
  const riskByStage: Record<LifecycleStage, number> = {
    onboarding: 0,
    exploration: 0,
    engagement: 0,
    mastery: 0,
    legacy: 0,
  };

  const metrics = state.stageMetrics;
  const metricsByStage = new Map<LifecycleStage, LifecycleMetric[]>();

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    if (!metricsByStage.has(metric.stage)) {
      metricsByStage.set(metric.stage, []);
    }
    metricsByStage.get(metric.stage)!.push(metric);
  }

  const stageKeys = Object.keys(riskByStage) as LifecycleStage[];
  for (let i = 0; i < stageKeys.length; i++) {
    const stage = stageKeys[i];
    const stageMetrics = metricsByStage.get(stage) ?? [];

    if (stageMetrics.length > 0) {
      const avgChurnRisk =
        stageMetrics.reduce((sum, m) => sum + m.churnRiskAtStage, 0) / stageMetrics.length;
      riskByStage[stage] = avgChurnRisk;
    }
  }

  return riskByStage;
}
