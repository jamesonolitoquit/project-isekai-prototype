/**
 * M70-B: Content Personalization Engine
 * Dynamic event scheduling and difficulty scaling per player segment
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type PlayerSegment = 'ultra_core' | 'core' | 'regular' | 'casual' | 'at_risk';
export type ContentEventType = 'raid' | 'tournament' | 'seasonal' | 'world_boss' | 'festival';

export interface ContentEvent {
  eventId: string;
  name: string;
  type: ContentEventType;
  difficulty: number; // 1-100
  duration: number; // ticks
  reward: { gold: number; prestige: number };
  startTick: number;
  endTick: number;
}

export interface PlayerSegmentProfile {
  playerId: string;
  segment: PlayerSegment;
  engagementScore: number; // 0-100
  lastEventParticipation: number; // ticks
  burnoutRisk: number; // 0-100
  eventFrequencyPreference: number; // events per week
}

export interface SegmentTargetingStrategy {
  segment: PlayerSegment;
  maxEventsPerWeek: number;
  difficultyRange: [number, number]; // min-max
  preferredTypes: ContentEventType[];
  rewardMultiplier: number;
  cooldownBetweenEvents: number; // ticks
}

export interface ABTestVariant {
  variantId: string;
  eventId: string;
  segment: PlayerSegment;
  variant: 'control' | 'treatment';
  startTick: number;
  endTick: number;
  metrics: {
    impressions: number;
    participations: number;
    completions: number;
    revenue: number;
  };
}

export interface PersonalizationState {
  playerSegments: Map<string, PlayerSegmentProfile>;
  segmentStrategies: Map<PlayerSegment, SegmentTargetingStrategy>;
  activeEvents: Map<string, ContentEvent>;
  abTests: ABTestVariant[];
  eventSchedule: Map<string, string[]>; // playerId -> eventIds scheduled
  stats: {
    totalEventsScheduled: number;
    totalParticipations: number;
    totalRevenue: number;
    burnoutRate: number;
    averageEngagementScore: number;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: PersonalizationState = {
  playerSegments: new Map(),
  segmentStrategies: new Map(),
  activeEvents: new Map(),
  abTests: [],
  eventSchedule: new Map(),
  stats: {
    totalEventsScheduled: 0,
    totalParticipations: 0,
    totalRevenue: 0,
    burnoutRate: 0,
    averageEngagementScore: 0,
  },
};

const defaultStrategies: Record<PlayerSegment, SegmentTargetingStrategy> = {
  ultra_core: {
    segment: 'ultra_core',
    maxEventsPerWeek: 7,
    difficultyRange: [80, 100],
    preferredTypes: ['raid', 'tournament', 'world_boss'],
    rewardMultiplier: 1.5,
    cooldownBetweenEvents: 500,
  },
  core: {
    segment: 'core',
    maxEventsPerWeek: 5,
    difficultyRange: [60, 85],
    preferredTypes: ['raid', 'seasonal', 'tournament'],
    rewardMultiplier: 1.2,
    cooldownBetweenEvents: 1000,
  },
  regular: {
    segment: 'regular',
    maxEventsPerWeek: 3,
    difficultyRange: [40, 70],
    preferredTypes: ['seasonal', 'tournament', 'festival'],
    rewardMultiplier: 1.0,
    cooldownBetweenEvents: 2000,
  },
  casual: {
    segment: 'casual',
    maxEventsPerWeek: 1,
    difficultyRange: [20, 50],
    preferredTypes: ['festival', 'seasonal'],
    rewardMultiplier: 0.8,
    cooldownBetweenEvents: 5000,
  },
  at_risk: {
    segment: 'at_risk',
    maxEventsPerWeek: 2,
    difficultyRange: [10, 40],
    preferredTypes: ['festival'],
    rewardMultiplier: 2.0,
    cooldownBetweenEvents: 10000,
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initContentPersonalization(): boolean {
  state.playerSegments.clear();
  state.activeEvents.clear();
  state.abTests = [];
  state.eventSchedule.clear();

  // Initialize segment strategies
  state.segmentStrategies.clear();
  const segmentKeys = Object.keys(defaultStrategies) as PlayerSegment[];
  for (let i = 0; i < segmentKeys.length; i++) {
    const segment = segmentKeys[i];
    state.segmentStrategies.set(segment, defaultStrategies[segment]);
  }

  state.stats = {
    totalEventsScheduled: 0,
    totalParticipations: 0,
    totalRevenue: 0,
    burnoutRate: 0,
    averageEngagementScore: 0,
  };

  return true;
}

export function getPersonalizationState(): PersonalizationState {
  return state;
}

// ============================================================================
// PLAYER SEGMENTATION
// ============================================================================

export function classifyPlayerSegment(
  playerId: string,
  engagementScore: number,
  daysSinceActive: number
): PlayerSegment {
  if (daysSinceActive > 7) {
    return 'at_risk';
  }

  if (engagementScore >= 80) {
    return 'ultra_core';
  }

  if (engagementScore >= 60) {
    return 'core';
  }

  if (engagementScore >= 40) {
    return 'regular';
  }

  return 'casual';
}

export function registerPlayerSegment(
  playerId: string,
  engagementScore: number,
  daysSinceActive: number,
  tick: number
): PlayerSegmentProfile {
  const segment = classifyPlayerSegment(playerId, engagementScore, daysSinceActive);

  const profile: PlayerSegmentProfile = {
    playerId,
    segment,
    engagementScore,
    lastEventParticipation: tick,
    burnoutRisk: Math.max(0, daysSinceActive * 10),
    eventFrequencyPreference: defaultStrategies[segment].maxEventsPerWeek,
  };

  state.playerSegments.set(playerId, profile);
  return profile;
}

export function getPlayerSegment(playerId: string): PlayerSegmentProfile | undefined {
  return state.playerSegments.get(playerId);
}

// ============================================================================
// EVENT SCHEDULING
// ============================================================================

export function registerContentEvent(event: ContentEvent): void {
  state.activeEvents.set(event.eventId, event);
}

export function scheduleEventForSegment(
  eventId: string,
  segment: PlayerSegment,
  targetPlayerIds: string[]
): Map<string, boolean> {
  const results = new Map<string, boolean>();
  const strategy = state.segmentStrategies.get(segment);

  if (!strategy) {
    return results;
  }

  const event = state.activeEvents.get(eventId);
  if (!event) {
    return results;
  }

  // Check if event difficulty is within segment range
  if (
    event.difficulty < strategy.difficultyRange[0] ||
    event.difficulty > strategy.difficultyRange[1]
  ) {
    for (let i = 0; i < targetPlayerIds.length; i++) {
      results.set(targetPlayerIds[i], false);
    }
    return results;
  }

  // Schedule events with cooldown checking
  for (let i = 0; i < targetPlayerIds.length; i++) {
    const playerId = targetPlayerIds[i];
    const profile = state.playerSegments.get(playerId);

    if (!profile) {
      results.set(playerId, false);
      continue;
    }

    // Check event frequency limit
    const scheduled = state.eventSchedule.get(playerId) ?? [];
    if (scheduled.length >= strategy.maxEventsPerWeek) {
      results.set(playerId, false);
      continue;
    }

    // Check cooldown
    const timeSinceLastEvent = event.startTick - profile.lastEventParticipation;
    if (timeSinceLastEvent < strategy.cooldownBetweenEvents) {
      results.set(playerId, false);
      continue;
    }

    // Schedule the event
    scheduled.push(eventId);
    state.eventSchedule.set(playerId, scheduled);
    results.set(playerId, true);
    state.stats.totalEventsScheduled++;
  }

  return results;
}

export function getPlayerEventSchedule(playerId: string): ContentEvent[] {
  const eventIds = state.eventSchedule.get(playerId) ?? [];
  const events: ContentEvent[] = [];

  for (let i = 0; i < eventIds.length; i++) {
    const event = state.activeEvents.get(eventIds[i]);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

// ============================================================================
// A/B TESTING
// ============================================================================

export function createABTest(
  eventId: string,
  segment: PlayerSegment,
  startTick: number,
  endTick: number
): ABTestVariant {
  const variantId = `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const variant: ABTestVariant = {
    variantId,
    eventId,
    segment,
    variant: Math.random() > 0.5 ? 'control' : 'treatment',
    startTick,
    endTick,
    metrics: {
      impressions: 0,
      participations: 0,
      completions: 0,
      revenue: 0,
    },
  };

  state.abTests.push(variant);
  return variant;
}

export function recordABTestMetric(
  variantId: string,
  metric: 'impressions' | 'participations' | 'completions',
  amount: number = 1
): void {
  const variant = state.abTests.find((v) => v.variantId === variantId);
  if (variant) {
    (variant.metrics as any)[metric] += amount;
  }
}

export function getActiveABTests(): ABTestVariant[] {
  const currentTick = 10000; // Mock current tick
  return state.abTests.filter((v) => v.startTick <= currentTick && v.endTick >= currentTick);
}

export function analyzeABTestResults(): Record<string, any> {
  const results: Record<string, any> = {};

  for (let i = 0; i < state.abTests.length; i++) {
    const variant = state.abTests[i];

    if (variant.startTick > 10000) continue; // Skip future tests

    const winnerKey = `${variant.eventId}_${variant.segment}`;
    if (!results[winnerKey]) {
      results[winnerKey] = {
        control: null,
        treatment: null,
      };
    }

    const participationRate =
      variant.metrics.impressions > 0
        ? (variant.metrics.participations / variant.metrics.impressions) * 100
        : 0;
    const completionRate =
      variant.metrics.participations > 0
        ? (variant.metrics.completions / variant.metrics.participations) * 100
        : 0;

    results[winnerKey][variant.variant] = {
      participationRate,
      completionRate,
      revenue: variant.metrics.revenue,
    };
  }

  return results;
}

// ============================================================================
// DIFFICULTY SCALING
// ============================================================================

export function scaleDifficultyForSegment(
  baseDifficulty: number,
  segment: PlayerSegment
): number {
  const strategy = state.segmentStrategies.get(segment);
  if (!strategy) {
    return baseDifficulty;
  }

  // Scale difficulty to be within segment range
  const avgDifficulty = (strategy.difficultyRange[0] + strategy.difficultyRange[1]) / 2;
  const targetDifficulty = Math.min(
    strategy.difficultyRange[1],
    Math.max(strategy.difficultyRange[0], baseDifficulty)
  );

  return targetDifficulty;
}

export function applyRewardMultiplier(baseReward: number, segment: PlayerSegment): number {
  const strategy = state.segmentStrategies.get(segment);
  if (!strategy) {
    return baseReward;
  }

  return Math.round(baseReward * strategy.rewardMultiplier);
}

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

export function trackSegmentParticipation(
  playerId: string,
  eventId: string,
  reward: number,
  tick: number
): void {
  const profile = state.playerSegments.get(playerId);
  if (profile) {
    profile.lastEventParticipation = tick;
    state.stats.totalParticipations++;
    state.stats.totalRevenue += reward;
  }
}

export function updateBurnoutRisk(playerId: string, daysSinceActive: number): void {
  const profile = state.playerSegments.get(playerId);
  if (profile) {
    profile.burnoutRisk = Math.max(0, daysSinceActive * 10);

    // Recalculate segment based on new metrics
    const newSegment = classifyPlayerSegment(playerId, profile.engagementScore, daysSinceActive);
    if (newSegment !== profile.segment) {
      profile.segment = newSegment;
    }
  }
}

// ============================================================================
// STATS & REPORTING
// ============================================================================

export function getPersonalizationStats(): any {
  const profiles = Array.from(state.playerSegments.values());

  if (profiles.length === 0) {
    return state.stats;
  }

  const avgEngagement =
    profiles.reduce((sum, p) => sum + p.engagementScore, 0) / profiles.length;
  const atRiskCount = profiles.filter((p) => p.segment === 'at_risk').length;
  const burnoutRate = (atRiskCount / profiles.length) * 100;

  return {
    ...state.stats,
    averageEngagementScore: avgEngagement,
    burnoutRate,
    totalPlayers: profiles.length,
  };
}

export function getSegmentDistribution(): Record<PlayerSegment, number> {
  const distribution: Record<PlayerSegment, number> = {
    ultra_core: 0,
    core: 0,
    regular: 0,
    casual: 0,
    at_risk: 0,
  };

  const profiles = Array.from(state.playerSegments.values());
  for (let i = 0; i < profiles.length; i++) {
    distribution[profiles[i].segment]++;
  }

  return distribution;
}
