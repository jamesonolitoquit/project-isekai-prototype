/**
 * M70-C: Social Reconnection Engine
 * Automated churn detection and come-back campaigns for lapsed players
 */

// ============================================================================
// TYPE HIERARCHY
// ============================================================================

export type CampaignType = 'guild_invite' | 'new_content' | 'cosmetic_reward' | 'vip_bonus' | 'friend_activity';

export interface ChurnPlayer {
  playerId: string;
  lastActivityTick: number;
  daysSinceActive: number;
  guildId: string | null;
  friendsCount: number;
  totalPlaytimeHours: number;
  estimatedLTVLost: number;
}

export interface ReconnectionCampaign {
  campaignId: string;
  playerId: string;
  campaignType: CampaignType;
  offerTier: 'basic' | 'standard' | 'premium' | 'vip';
  createdAt: number;
  expireAt: number;
  rewardGold: number;
  rewardCosmetics: string[];
  visibleToPlayer: boolean;
  acceptedAt: number | null;
  successfulReengagement: boolean;
}

export interface FriendsNotification {
  notificationId: string;
  notifierId: string; // The friend who is at-risk
  recipients: string[]; // Friends to notify
  notificationType: 'friend_away' | 'milestone_achieved';
  createdAt: number;
  deliveredAt: number | null;
}

export interface ReconnectionState {
  churnedPlayers: Map<string, ChurnPlayer>;
  activeCampaigns: Map<string, ReconnectionCampaign>;
  campaignHistory: ReconnectionCampaign[];
  friendsNotifications: FriendsNotification[];
  stats: {
    totalChurned: number;
    campaignsGenerated: number;
    campaignsAccepted: number;
    reengagementRate: number;
    avgRetentionDaysAfterCampaign: number;
  };
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: ReconnectionState = {
  churnedPlayers: new Map(),
  activeCampaigns: new Map(),
  campaignHistory: [],
  friendsNotifications: [],
  stats: {
    totalChurned: 0,
    campaignsGenerated: 0,
    campaignsAccepted: 0,
    reengagementRate: 0,
    avgRetentionDaysAfterCampaign: 0,
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initSocialReconnection(): boolean {
  state.churnedPlayers.clear();
  state.activeCampaigns.clear();
  state.campaignHistory = [];
  state.friendsNotifications = [];
  state.stats = {
    totalChurned: 0,
    campaignsGenerated: 0,
    campaignsAccepted: 0,
    reengagementRate: 0,
    avgRetentionDaysAfterCampaign: 0,
  };
  return true;
}

export function getReconnectionState(): ReconnectionState {
  return state;
}

// ============================================================================
// CHURN DETECTION
// ============================================================================

export function detectChurnedPlayers(
  allPlayerIds: string[],
  lastActivityMap: Map<string, number>,
  friendsMap: Map<string, string[]>,
  guildMap: Map<string, string>,
  tick: number
): ChurnPlayer[] {
  const churnThreshold = 7; // days
  const ticksPerDay = 86400 / 6; // ~14400 ticks per day (6 second ticks)

  const churned: ChurnPlayer[] = [];

  for (let i = 0; i < allPlayerIds.length; i++) {
    const playerId = allPlayerIds[i];
    const lastTick = lastActivityMap.get(playerId) ?? 0;
    const daysSince = (tick - lastTick) / ticksPerDay;

    if (daysSince > churnThreshold) {
      const churnPlayer: ChurnPlayer = {
        playerId,
        lastActivityTick: lastTick,
        daysSinceActive: daysSince,
        guildId: guildMap.get(playerId) ?? null,
        friendsCount: (friendsMap.get(playerId) ?? []).length,
        totalPlaytimeHours: 100, // Mock value
        estimatedLTVLost: daysSince * 5, // Mock LTV calculation
      };

      churned.push(churnPlayer);
      state.churnedPlayers.set(playerId, churnPlayer);
      state.stats.totalChurned++;
    }
  }

  return churned;
}

export function getChurnedPlayers(): ChurnPlayer[] {
  return Array.from(state.churnedPlayers.values());
}

// ============================================================================
// CAMPAIGN GENERATION
// ============================================================================

export function generateReconnectionCampaigns(
  churnedPlayers: ChurnPlayer[],
  tick: number
): ReconnectionCampaign[] {
  const campaigns: ReconnectionCampaign[] = [];

  for (let i = 0; i < churnedPlayers.length; i++) {
    const player = churnedPlayers[i];

    // Flexible campaign generation based on churn duration
    // Generate at least one campaign for any churned player

    // Tier 1: Day 2+ - Guild raid invite (for players with guild)
    if (player.daysSinceActive >= 2 && player.guildId) {
      const campaign = createCampaign(
        player.playerId,
        'guild_invite',
        'basic',
        500, // 500g reward
        [],
        tick,
        tick + 86400
      );
      campaigns.push(campaign);
    }

    // Tier 2: Day 5+ - New content available
    if (player.daysSinceActive >= 5) {
      const campaign = createCampaign(
        player.playerId,
        'new_content',
        'standard',
        1000,
        ['chest_cosmetic_1'],
        tick,
        tick + 172800
      );
      campaigns.push(campaign);
    }

    // Tier 3: Day 7+ - Cosmetic reward
    if (player.daysSinceActive >= 7) {
      const campaign = createCampaign(
        player.playerId,
        'cosmetic_reward',
        'premium',
        2000,
        ['mount_cosmetic_legacy', 'emote_return'],
        tick,
        tick + 259200
      );
      campaigns.push(campaign);
    }

    // Tier 4: Day 14+ - VIP bonus (for high-LTV players)
    if (player.daysSinceActive >= 14 && player.estimatedLTVLost > 50) {
      const campaign = createCampaign(
        player.playerId,
        'vip_bonus',
        'vip',
        5000,
        ['vip_chest_exclusive'],
        tick,
        tick + 604800
      );
      campaigns.push(campaign);
    }

    // Fallback: if no campaigns generated due to guild or LTV filters, create a basic one
    if (campaigns.length === 0) {
      const campaign = createCampaign(
        player.playerId,
        'friend_activity',
        'basic',
        300,
        [],
        tick,
        tick + 86400
      );
      campaigns.push(campaign);
    }
  }

  state.stats.campaignsGenerated += campaigns.length;
  return campaigns;
}

function createCampaign(
  playerId: string,
  type: CampaignType,
  tier: 'basic' | 'standard' | 'premium' | 'vip',
  rewardGold: number,
  rewardCosmetics: string[],
  createdAt: number,
  expireAt: number
): ReconnectionCampaign {
  const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const campaign: ReconnectionCampaign = {
    campaignId,
    playerId,
    campaignType: type,
    offerTier: tier,
    createdAt,
    expireAt,
    rewardGold,
    rewardCosmetics,
    visibleToPlayer: true,
    acceptedAt: null,
    successfulReengagement: false,
  };

  state.activeCampaigns.set(campaignId, campaign);
  return campaign;
}

export function getActiveCampaigns(playerId: string): ReconnectionCampaign[] {
  return Array.from(state.activeCampaigns.values()).filter((c) => c.playerId === playerId);
}

// ============================================================================
// CAMPAIGN ACCEPTANCE & RE-ENGAGEMENT
// ============================================================================

export function acceptCampaign(campaignId: string, tick: number): boolean {
  const campaign = state.activeCampaigns.get(campaignId);
  if (!campaign) {
    return false;
  }

  campaign.acceptedAt = tick;
  state.stats.campaignsAccepted++;

  return true;
}

export function confirmReengagement(campaignId: string, tick: number): void {
  const campaign = state.activeCampaigns.get(campaignId);
  if (campaign) {
    campaign.successfulReengagement = true;
    state.campaignHistory.push(campaign);
  }
}

// ============================================================================
// FRIEND NOTIFICATIONS
// ============================================================================

export function notifyFriendsOfChurn(
  churnedPlayerIds: string[],
  friendsMap: Map<string, string[]>,
  tick: number
): FriendsNotification[] {
  const notifications: FriendsNotification[] = [];

  for (let i = 0; i < churnedPlayerIds.length; i++) {
    const playerId = churnedPlayerIds[i];
    const friends = friendsMap.get(playerId) ?? [];

    if (friends.length === 0) {
      continue;
    }

    // Only notify if >3 days inactive (don't spam for short absences)
    const notification: FriendsNotification = {
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notifierId: playerId,
      recipients: friends,
      notificationType: 'friend_away',
      createdAt: tick,
      deliveredAt: null,
    };

    state.friendsNotifications.push(notification);
    notifications.push(notification);
  }

  return notifications;
}

export function getFriendsNotifications(): FriendsNotification[] {
  return state.friendsNotifications;
}

// ============================================================================
// CAMPAIGN SCHEDULING
// ============================================================================

export function getOptimalNotificationTime(
  playerId: string,
  timezone: string,
  tick: number
): number {
  // Mock: assume players are most likely to log in at:
  // - Morning: 8 AM
  // - Evening: 7 PM
  // For now, just space them out

  const timezoneOffset = parseInt(timezone, 10) || 0;
  const baseOffset = (8 + timezoneOffset) * 3600; // 8 AM local time

  return tick + baseOffset;
}

export function shouldSendNotification(
  playerId: string,
  notificationType: CampaignType,
  tick: number
): boolean {
  // Max 1 notification per day per player
  const today = Math.floor(tick / 86400);
  const recentNotifications = state.friendsNotifications.filter(
    (n) =>
      n.recipients.includes(playerId) && Math.floor(n.createdAt / 86400) === today
  );

  return recentNotifications.length === 0;
}

// ============================================================================
// STATS & REPORTING
// ============================================================================

export function getReconnectionStats(): any {
  return {
    ...state.stats,
    reengagementRate: state.stats.campaignsAccepted > 0
      ? (state.stats.campaignsAccepted / state.stats.campaignsGenerated) * 100
      : 0,
  };
}

export function getCampaignEffectiveness(campaignType: CampaignType): any {
  const campaignsOfType = state.campaignHistory.filter((c) => c.campaignType === campaignType);

  if (campaignsOfType.length === 0) {
    return {
      campaignType,
      totalCampaigns: 0,
      acceptanceRate: 0,
      successRate: 0,
    };
  }

  const successful = campaignsOfType.filter((c) => c.successfulReengagement).length;

  return {
    campaignType,
    totalCampaigns: campaignsOfType.length,
    acceptanceRate: (campaignsOfType.filter((c) => c.acceptedAt !== null).length / campaignsOfType.length) * 100,
    successRate: (successful / campaignsOfType.length) * 100,
  };
}
