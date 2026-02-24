/**
 * M70: Telemetry Integration Module
 * Bridges M68 telemetry data with M70 retention systems
 * - Adjusts quest recommendations based on engagement trends
 * - Triggers churn predictions and reconnection campaigns
 * - Syncs engagement metrics with lifecycle progression
 */

import type { QuestRecommendation } from './m70QuestRecommendationEngine';
import { getQuestRecommendationEngine } from './m70QuestRecommendationEngine';
import { getContentPersonalization } from './m70ContentPersonalization';
import { getSocialReconnection } from './m70SocialReconnection';
import type { EngagementMetrics } from './telemetryEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ChurnPrediction {
  playerId: string;
  riskScore: number; // 0-100
  confidence: number; // 0-100
  daysUntilChurn: number; // Predicted days
  topReasons: string[];
  recommendedIntervention: 'none' | 'quest_boost' | 'event_offer' | 'social_reconnection' | 'vip_treatment';
}

export interface EngagementAdjustment {
  playerId: string;
  originalEngagementScore: number;
  adjustedEngagementScore: number;
  adjustmentReason: string;
  questAffinityBoost: number; // Percentage increase
  eventMultiplier: number; // Reward multiplier
}

// ============================================================================
// QUEST RECOMMENDATION ADJUSTMENT
// ============================================================================

/**
 * Adjust quest recommendations based on player engagement trends
 * - Low engagement (<40): Boost affinity by 15% to make recommendations more appealing
 * - Declining engagement: Recommend easier quests to rebuild momentum
 * - High engagement (>70): Recommend challenging quests to retain core players
 */
export function adjustRecommendationsBasedOnEngagement(
  playerId: string,
  engagement: EngagementMetrics,
  recommendations: QuestRecommendation[]
): QuestRecommendation[] {
  if (!recommendations || recommendations.length === 0) {
    return [];
  }

  const adjustedRecs = [...recommendations];
  const questEngine = getQuestRecommendationEngine();

  // Case 1: Player at-risk, boost recommendations
  if (engagement.engagementScore < 40) {
    return adjustedRecs.map((q) => ({
      ...q,
      affinity: Math.min(100, q.affinity + 15),
      reward: {
        ...q.reward,
        gold: Math.floor(q.reward.gold * 1.2), // 20% gold bonus
        xp: Math.floor(q.reward.xp * 1.15), // 15% XP bonus
      },
    }));
  }

  // Case 2: Declining engagement, prioritize engagement quests
  if (engagement.daysSinceLogin > 1) {
    return adjustedRecs.map((q) => {
      const isEngagementQuest = ['social', 'exploration'].includes(q.type);
      return {
        ...q,
        affinity: isEngagementQuest ? Math.min(100, q.affinity + 10) : q.affinity - 5,
      };
    });
  }

  return adjustedRecs;
}

// ============================================================================
// CHURN PREDICTION ENGINE
// ============================================================================

/**
 * Predict churn risk for a player based on engagement metrics
 * Factors:
 * - Days since login (>7 = high risk)
 * - Session length trend (declining = risk)
 * - Quest completion rate (low = risk)
 * - Engagement tier (at_risk already flagged = critical)
 */
export function predictChurnRisk(
  playerId: string,
  engagement: EngagementMetrics,
  engagementTier: string
): ChurnPrediction {
  let riskScore = 0;
  const reasons: string[] = [];

  // Factor 1: Days since login (0-40 points)
  if (engagement.daysSinceLogin >= 7) {
    riskScore += 40;
    reasons.push(`No playtime for ${engagement.daysSinceLogin} days`);
  } else if (engagement.daysSinceLogin >= 3) {
    riskScore += 25;
    reasons.push(`Limited playtime (${engagement.daysSinceLogin} days since login)`);
  }

  // Factor 2: Session length trend (0-30 points)
  if (engagement.sessionLengthTrend === 'declining') {
    riskScore += 30;
    reasons.push('Session duration declining');
  } else if (engagement.sessionLengthTrend === 'stable_low') {
    riskScore += 15;
    reasons.push('Consistently short sessions');
  }

  // Factor 3: Engagement tier (0-30 points)
  if (engagementTier === 'at_risk') {
    riskScore += 30;
    reasons.push('Low overall engagement score');
  } else if (engagementTier === 'casual') {
    riskScore += 15;
    reasons.push('Casual engagement pattern');
  }

  // Factor 4: Quest completion (0-20 points)
  if (engagement.questCompletionRate < 0.3) {
    riskScore += 20;
    reasons.push('Low quest completion rate');
  } else if (engagement.questCompletionRate < 0.5) {
    riskScore += 10;
    reasons.push('Moderate quest completion');
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  // Predict days until churn
  let daysUntilChurn = 14; // Default
  if (riskScore > 80) {
    daysUntilChurn = 1;
  } else if (riskScore > 60) {
    daysUntilChurn = 3;
  } else if (riskScore > 40) {
    daysUntilChurn = 7;
  }

  // Determine intervention
  let intervention: ChurnPrediction['recommendedIntervention'] = 'none';
  if (riskScore > 80) {
    intervention = 'vip_treatment'; // Last-ditch effort
  } else if (riskScore > 65) {
    intervention = 'social_reconnection'; // Friend-based reconnection
  } else if (riskScore > 40) {
    intervention = 'event_offer'; // Special event/content
  } else if (riskScore > 20) {
    intervention = 'quest_boost'; // Just boost recommendations
  }

  return {
    playerId,
    riskScore,
    confidence: Math.max(50, 100 - Math.abs(riskScore - 50) * 0.5), // Higher confidence at extremes
    daysUntilChurn,
    topReasons: reasons,
    recommendedIntervention: intervention,
  };
}

// ============================================================================
// ENGAGEMENT ADJUSTMENT FOR LIFECYCLE
// ============================================================================

/**
 * Adjusts event frequency and difficulty based on engagement tier
 * - at_risk: High event frequency (7+/week), premium rewards
 * - casual: Moderate frequency (3-4/week), standard rewards
 * - regular: Standard frequency (2-3/week), varying rewards
 * - core: Lower frequency (1-2/week), challenging content
 * - ultra_core: Sparse (0.5/week), end-game content
 */
export function adjustEventSchedulingBasedOnTier(
  engagementTier: string,
  baseFrequency: number
): { frequency: number; difficulty: number; rewardMultiplier: number } {
  switch (engagementTier) {
    case 'at_risk':
      return {
        frequency: Math.ceil(baseFrequency * 2.5), // 2.5x events
        difficulty: Math.max(1, baseFrequency * 0.5), // Easier
        rewardMultiplier: 2.5, // 2.5x rewards
      };

    case 'casual':
      return {
        frequency: Math.ceil(baseFrequency * 1.5), // 1.5x events
        difficulty: baseFrequency * 0.75,
        rewardMultiplier: 1.8,
      };

    case 'regular':
      return {
        frequency: baseFrequency, // Normal
        difficulty: baseFrequency,
        rewardMultiplier: 1.0,
      };

    case 'core':
      return {
        frequency: Math.ceil(baseFrequency * 0.5), // 0.5x events
        difficulty: baseFrequency * 1.5,
        rewardMultiplier: 0.8,
      };

    case 'ultra_core':
      return {
        frequency: Math.ceil(baseFrequency * 0.25), // 0.25x events
        difficulty: baseFrequency * 2.0,
        rewardMultiplier: 0.6,
      };

    default:
      return {
        frequency: baseFrequency,
        difficulty: baseFrequency,
        rewardMultiplier: 1.0,
      };
  }
}

// ============================================================================
// RECONNECTION CAMPAIGN TRIGGER
// ============================================================================

/**
 * Trigger reconnection campaigns based on churn predictions
 * Routes to appropriate campaign type based on risk level
 */
export function triggerReconnectionCampaignIfNeeded(
  playerId: string,
  churnPrediction: ChurnPrediction
): boolean {
  const socialReconnection = getSocialReconnection();

  // Only trigger for high-risk players
  if (churnPrediction.riskScore < 40) {
    return false;
  }

  try {
    const campaignType = churnPrediction.recommendedIntervention;

    // Map intervention to campaign type
    let campaignName = '';
    let campaignTier: 'basic' | 'standard' | 'premium' | 'vip' = 'basic';

    switch (campaignType) {
      case 'quest_boost':
        campaignName = 'quest_difficulty_ramp';
        campaignTier = 'basic';
        break;

      case 'event_offer':
        campaignName = 'limited_event_access';
        campaignTier = 'standard';
        break;

      case 'social_reconnection':
        campaignName = 'friend_activity';
        campaignTier = 'premium';
        break;

      case 'vip_treatment':
        campaignName = 'vip_exclusive_access';
        campaignTier = 'vip';
        break;

      default:
        return false;
    }

    // Queue the campaign
    socialReconnection.generateReconnectionCampaigns([{ id: playerId, engagementTier: 'at_risk' }], {
      daysSinceInactive: churnPrediction.daysUntilChurn,
    });

    return true;
  } catch (error) {
    console.error('[M70TelemetryIntegration] Failed to trigger reconnection campaign:', error);
    return false;
  }
}

// ============================================================================
// BATCH COHORT ANALYSIS
// ============================================================================

/**
 * Analyze entire cohort for churn predictions and engagement patterns
 * Called hourly from telemetry aggregation
 */
export function analyzeCohortEngagement(
  cohort: Array<{ id: string; engagementTier: string }>,
  engagementMetricsMap: Map<string, EngagementMetrics>
): {
  predictions: ChurnPrediction[];
  adjustments: EngagementAdjustment[];
  campaignsTriggered: number;
} {
  const predictions: ChurnPrediction[] = [];
  const adjustments: EngagementAdjustment[] = [];
  let campaignsTriggered = 0;

  for (const player of cohort) {
    const metrics = engagementMetricsMap.get(player.id);
    if (!metrics) continue;

    // Predict churn
    const churnPred = predictChurnRisk(player.id, metrics, player.engagementTier);
    predictions.push(churnPred);

    // Trigger campaign if needed
    if (triggerReconnectionCampaignIfNeeded(player.id, churnPred)) {
      campaignsTriggered++;
    }

    // Record engagement adjustment
    const adjustment: EngagementAdjustment = {
      playerId: player.id,
      originalEngagementScore: metrics.engagementScore,
      adjustedEngagementScore: Math.max(
        0,
        Math.min(100, metrics.engagementScore + (churnPred.riskScore > 60 ? 10 : -5))
      ),
      adjustmentReason: churnPred.topReasons[0] || 'Normal progression',
      questAffinityBoost: metrics.engagementScore < 40 ? 15 : 0,
      eventMultiplier: adjustEventSchedulingBasedOnTier(
        player.engagementTier,
        1
      ).rewardMultiplier,
    };
    adjustments.push(adjustment);
  }

  return {
    predictions,
    adjustments,
    campaignsTriggered,
  };
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

let instance: typeof module;

export function getM70TelemetryIntegration() {
  if (!instance) {
    instance = module;
  }
  return instance;
}

export default {
  adjustRecommendationsBasedOnEngagement,
  predictChurnRisk,
  adjustEventSchedulingBasedOnTier,
  triggerReconnectionCampaignIfNeeded,
  analyzeCohortEngagement,
};
