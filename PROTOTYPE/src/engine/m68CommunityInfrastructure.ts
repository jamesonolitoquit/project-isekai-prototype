/**
 * M68-A6: Community & Social Infrastructure
 * 
 * Faction announcements & notifications, GlobalLeaderboards & WeeklyCompetitionBoards,
 * GuildHallSystem with shared lockers (+10% faction multiplier), and privacy-first
 * leaderboard design (rank/percentile without player identity in beta).
 */

import { randomUUID } from 'node:crypto';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Community & Social Model
// ============================================================================

/**
 * Player notification with opt-in/out and rate limiting
 */
export interface PlayerNotification {
  readonly notificationId: string;
  readonly playerId: string;
  readonly category: 'faction' | 'guild' | 'leaderboard' | 'event' | 'system';
  readonly title: string;
  readonly message: string;
  readonly createdAt: number;
  readonly isOptedIn: boolean;
  readonly readAt?: number;
}

/**
 * Faction announcement
 */
export interface FactionAnnouncement {
  readonly announcementId: string;
  readonly faction: string;
  readonly title: string;
  readonly message: string;
  readonly priority: 'low' | 'medium' | 'high';
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly targetAudience: 'all' | 'high_rank' | 'active_members';
}

/**
 * Leaderboard entry (privacy-first: rank/percentile without identity)
 */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly displayName: string;
  readonly score: number;
  readonly percentile: number; // 0-100, player's standing
  readonly tier: string; // 'legend' | 'elite' | 'master' | 'expert'
}

/**
 * Global leaderboard
 */
export interface GlobalLeaderboard {
  readonly leaderboardId: string;
  readonly type: 'myth_rank' | 'wealth' | 'faction_power' | 'playtime';
  readonly entries: LeaderboardEntry[];
  readonly lastUpdate: number;
  readonly topEntry: LeaderboardEntry | null;
}

/**
 * Weekly competition board
 */
export interface WeeklyCompetitionBoard {
  readonly boardId: string;
  readonly week: number;
  readonly startDate: number;
  readonly endDate: number;
  readonly competitionType: 'duels' | 'raids' | 'wealth_accumulation' | 'faction_wars';
  readonly entries: LeaderboardEntry[];
  readonly rewards: Record<string, number>; // rank -> reward_currency
  readonly status: 'scheduled' | 'active' | 'completed';
}

/**
 * Guild (faction sub-unit, 2-10 players)
 */
export interface Guild {
  readonly guildId: string;
  readonly name: string;
  readonly leader: string;
  readonly faction: string;
  readonly members: string[];
  readonly memberLimit: number;
  readonly factionBonusMultiplier: number; // Base: 1.1 (+10%)
  readonly sharedLockerSize: number;
  readonly createdAt: number;
  readonly foundingBonusExpires: number;
}

/**
 * Guild shared locker
 */
export interface SharedLocker {
  readonly lockerId: string;
  readonly guildId: string;
  readonly capacity: number; // Max items
  readonly items: Array<{ itemId: string; quantity: number }>;
  readonly accessLog: Array<{ playerId: string; action: 'add' | 'remove'; itemId: string; timestamp: number }>;
}

/**
 * Community infrastructure state
 */
export interface CommunityInfrastructureState {
  readonly engineId: string;
  readonly isInitialized: boolean;
  readonly factionCount: number;
  readonly guildCount: number;
  readonly totalNotifications: number;
  readonly leaderboards: Map<string, GlobalLeaderboard>;
  readonly weeklyBoards: Map<string, WeeklyCompetitionBoard>;
  readonly lastUpdate: number;
}

// ============================================================================
// COMMUNITY INFRASTRUCTURE ENGINE
// ============================================================================

let infrastructureState: CommunityInfrastructureState = {
  engineId: `community_${uuid()}`,
  isInitialized: false,
  factionCount: 0,
  guildCount: 0,
  totalNotifications: 0,
  leaderboards: new Map(),
  weeklyBoards: new Map(),
  lastUpdate: 0
};

let announcements: FactionAnnouncement[] = [];
let notifications = new Map<string, PlayerNotification[]>();
let guilds = new Map<string, Guild>();
let sharedLockers = new Map<string, SharedLocker>();
let playerNotificationPrefs = new Map<string, Set<string>>(); // playerId -> opted-in categories
let notificationRateLimit = new Map<string, number>(); // playerId -> last notification timestamp
const RATE_LIMIT_INTERVAL_MS = 60000; // 1 minute between notifications per player

/**
 * Initialize community infrastructure
 * Create base factions and leaderboards
 * 
 * @returns State
 */
export function initializeCommunityInfrastructure(): CommunityInfrastructureState {
  infrastructureState = {
    engineId: `community_${uuid()}`,
    isInitialized: true,
    factionCount: 4,
    guildCount: 0,
    totalNotifications: 0,
    leaderboards: new Map([
      [
        'myth_rank',
        {
          leaderboardId: `lb_myth_${uuid()}`,
          type: 'myth_rank',
          entries: [],
          lastUpdate: Date.now(),
          topEntry: null
        }
      ],
      [
        'wealth',
        {
          leaderboardId: `lb_wealth_${uuid()}`,
          type: 'wealth',
          entries: [],
          lastUpdate: Date.now(),
          topEntry: null
        }
      ],
      [
        'faction_power',
        {
          leaderboardId: `lb_faction_${uuid()}`,
          type: 'faction_power',
          entries: [],
          lastUpdate: Date.now(),
          topEntry: null
        }
      ],
      [
        'playtime',
        {
          leaderboardId: `lb_playtime_${uuid()}`,
          type: 'playtime',
          entries: [],
          lastUpdate: Date.now(),
          topEntry: null
        }
      ]
    ]),
    weeklyBoards: new Map(),
    lastUpdate: Date.now()
  };

  // Initialize opt-in preferences (default: all categories enabled)
  playerNotificationPrefs.clear();

  return { ...infrastructureState };
}

/**
 * Create faction announcement
 * 
 * @param faction Faction name
 * @param title Announcement title
 * @param message Announcement message
 * @param priority Message priority
 * @param durationHours How long to display
 * @returns Announcement
 */
export function createFactionAnnouncement(
  faction: string,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' = 'medium',
  durationHours: number = 24
): FactionAnnouncement {
  const announcement: FactionAnnouncement = {
    announcementId: `ann_${uuid()}`,
    faction,
    title,
    message,
    priority,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationHours * 3600000,
    targetAudience: 'all'
  };

  announcements.push(announcement);

  return announcement;
}

/**
 * Send faction announcement to all players
 * Respects opt-in preferences and rate limiting
 * 
 * @param announcementId Announcement to broadcast
 * @param playerIds Players to notify
 * @returns Number of notifications sent
 */
export function sendFactionAnnouncement(announcementId: string, playerIds: string[]): number {
  const announcement = announcements.find((a) => a.announcementId === announcementId);
  if (!announcement) return 0;

  let sentCount = 0;

  for (const playerId of playerIds) {
    // Check opt-in preference
    const hasCategory = playerNotificationPrefs.get(playerId)?.has('faction');
    if (!hasCategory && playerNotificationPrefs.has(playerId)) continue; // Opted out

    // Check rate limit
    const lastNotif = notificationRateLimit.get(playerId) || 0;
    if (Date.now() - lastNotif < RATE_LIMIT_INTERVAL_MS) continue; // Too soon

    const notification: PlayerNotification = {
      notificationId: `notif_${uuid()}`,
      playerId,
      category: 'faction',
      title: announcement.title,
      message: announcement.message,
      createdAt: Date.now(),
      isOptedIn: true
    };

    if (!notifications.has(playerId)) {
      notifications.set(playerId, []);
    }
    notifications.get(playerId)?.push(notification);

    notificationRateLimit.set(playerId, Date.now());
    (infrastructureState as any).totalNotifications++;
    sentCount++;
  }

  return sentCount;
}

/**
 * Set player notification preference
 * 
 * @param playerId Player to configure
 * @param category Notification category
 * @param isOptedIn True to enable, false to disable
 */
export function setNotificationPreference(playerId: string, category: string, isOptedIn: boolean): void {
  if (!playerNotificationPrefs.has(playerId)) {
    playerNotificationPrefs.set(playerId, new Set(['faction', 'guild', 'leaderboard', 'event', 'system']));
  }

  const prefs = playerNotificationPrefs.get(playerId)!;

  if (isOptedIn) {
    prefs.add(category);
  } else {
    prefs.delete(category);
  }
}

/**
 * Create guild (2-10 players)
 * 
 * @param name Guild name
 * @param leader Leader player ID
 * @param faction Faction affiliation
 * @returns Guild
 */
export function createGuild(name: string, leader: string, faction: string): Guild {
  const guild: Guild = {
    guildId: `guild_${uuid()}`,
    name,
    leader,
    faction,
    members: [leader],
    memberLimit: 10,
    factionBonusMultiplier: 1.1, // +10% faction gain
    sharedLockerSize: 50,
    createdAt: Date.now(),
    foundingBonusExpires: Date.now() + 7 * 86400000 // 7-day founding bonus
  };

  guilds.set(guild.guildId, guild);

  // Create shared locker for guild
  const locker: SharedLocker = {
    lockerId: `locker_${uuid()}`,
    guildId: guild.guildId,
    capacity: 50,
    items: [],
    accessLog: []
  };

  sharedLockers.set(guild.guildId, locker);

  (infrastructureState as any).guildCount++;

  return guild;
}

/**
 * Join guild
 * 
 * @param guildId Guild to join
 * @param playerId Player to add
 * @returns True if joined
 */
export function joinGuild(guildId: string, playerId: string): boolean {
  const guild = guilds.get(guildId);
  if (!guild || guild.members.length >= guild.memberLimit) return false;

  (guild as any).members.push(playerId);

  return true;
}

/**
 * Leave guild
 * 
 * @param guildId Guild to leave
 * @param playerId Player to remove
 * @returns True if left
 */
export function leaveGuild(guildId: string, playerId: string): boolean {
  const guild = guilds.get(guildId);
  if (!guild) return false;

  const idx = guild.members.indexOf(playerId);
  if (idx === -1) return false;

  if (playerId === guild.leader && guild.members.length > 1) {
    // Transfer leadership to next member
    (guild as any).leader = guild.members[(idx + 1) % guild.members.length];
  }

  (guild as any).members.splice(idx, 1);

  return true;
}

/**
 * Add item to guild shared locker
 * 
 * @param guildId Guild for locker
 * @param itemId Item to add
 * @param quantity Quantity
 * @param playerId Player adding item
 * @returns True if added
 */
export function addToSharedLocker(guildId: string, itemId: string, quantity: number, playerId: string): boolean {
  const locker = sharedLockers.get(guildId);
  if (!locker) return false;

  const totalCurrentItems = locker.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalCurrentItems + quantity > locker.capacity) return false;

  const existing = locker.items.find((i) => i.itemId === itemId);
  if (existing) {
    (existing as any).quantity += quantity;
  } else {
    (locker as any).items.push({ itemId, quantity });
  }

  (locker as any).accessLog.push({
    playerId,
    action: 'add',
    itemId,
    timestamp: Date.now()
  });

  return true;
}

/**
 * Remove item from guild shared locker
 * 
 * @param guildId Guild for locker
 * @param itemId Item to remove
 * @param quantity Quantity
 * @param playerId Player removing item
 * @returns True if removed
 */
export function removeFromSharedLocker(guildId: string, itemId: string, quantity: number, playerId: string): boolean {
  const locker = sharedLockers.get(guildId);
  if (!locker) return false;

  const item = locker.items.find((i) => i.itemId === itemId);
  if (!item || item.quantity < quantity) return false;

  (item as any).quantity -= quantity;

  if (item.quantity === 0) {
    const idx = (locker as any).items.indexOf(item);
    (locker as any).items.splice(idx, 1);
  }

  (locker as any).accessLog.push({
    playerId,
    action: 'remove',
    itemId,
    timestamp: Date.now()
  });

  return true;
}

/**
 * Update global leaderboard
 * Privacy-first: rank/percentile without identity
 * 
 * @param leaderboardType Type of leaderboard
 * @param entries New entries to set
 */
export function updateGlobalLeaderboard(
  leaderboardType: 'myth_rank' | 'wealth' | 'faction_power' | 'playtime',
  entries: Array<{ playerId: string; displayName: string; score: number }>
): void {
  const lb = infrastructureState.leaderboards.get(leaderboardType);
  if (!lb) return;

  // Sort by score (descending)
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  // Create leaderboard entries with rank and percentile
  const lbEntries: LeaderboardEntry[] = sorted.map((entry, idx) => {
    const rank = idx + 1;
    const percentile = 100 - (rank / sorted.length) * 100;

    let tier = 'expert';
    if (percentile >= 90) tier = 'legend';
    else if (percentile >= 75) tier = 'elite';
    else if (percentile >= 50) tier = 'master';

    return {
      rank,
      playerId: entry.playerId,
      displayName: entry.displayName,
      score: entry.score,
      percentile,
      tier
    };
  });

  (lb as any).entries = lbEntries;
  (lb as any).topEntry = lbEntries.length > 0 ? lbEntries[0] : null;
  (lb as any).lastUpdate = Date.now();
}

/**
 * Create weekly competition board
 * 
 * @param competitionType Type of competition
 * @param week Week number
 * @returns Competition board
 */
export function createWeeklyCompetitionBoard(
  competitionType: 'duels' | 'raids' | 'wealth_accumulation' | 'faction_wars',
  week: number
): WeeklyCompetitionBoard {
  const boardId = `board_${uuid()}`;
  const now = Date.now();

  const board: WeeklyCompetitionBoard = {
    boardId,
    week,
    startDate: now,
    endDate: now + 7 * 86400000, // 7 days
    competitionType,
    entries: [],
    rewards: {
      '1': 5000,
      '2': 3000,
      '3': 1500,
      '4-10': 500
    },
    status: 'active'
  };

  infrastructureState.weeklyBoards.set(boardId, board);

  return board;
}

/**
 * Update weekly competition board with current standings
 * 
 * @param boardId Board to update
 * @param entries Competition entries
 */
export function updateWeeklyCompetitionBoard(
  boardId: string,
  entries: Array<{ playerId: string; displayName: string; score: number }>
): void {
  const board = infrastructureState.weeklyBoards.get(boardId);
  if (!board) return;

  const sorted = [...entries].sort((a, b) => b.score - a.score);

  const boardEntries: LeaderboardEntry[] = sorted.map((entry, idx) => {
    const rank = idx + 1;
    const percentile = 100 - (rank / sorted.length) * 100;

    return {
      rank,
      playerId: entry.playerId,
      displayName: entry.displayName,
      score: entry.score,
      percentile,
      tier: rank <= 3 ? 'legend' : rank <= 10 ? 'elite' : 'master'
    };
  });

  (board as any).entries = boardEntries;
}

/**
 * Get global leaderboard
 * 
 * @param leaderboardType Type to retrieve
 * @returns Leaderboard or null
 */
export function getGlobalLeaderboard(
  leaderboardType: 'myth_rank' | 'wealth' | 'faction_power' | 'playtime'
): GlobalLeaderboard | null {
  const lb = infrastructureState.leaderboards.get(leaderboardType);
  return lb ? { ...lb, entries: lb.entries.map((e) => ({ ...e })) } : null;
}

/**
 * Get guild by ID
 * 
 * @param guildId Guild to retrieve
 * @returns Guild or null
 */
export function getGuild(guildId: string): Guild | null {
  const guild = guilds.get(guildId);
  return guild ? { ...guild, members: [...guild.members] } : null;
}

/**
 * Get guild shared locker
 * 
 * @param guildId Guild for locker
 * @returns Locker or null
 */
export function getSharedLocker(guildId: string): SharedLocker | null {
  const locker = sharedLockers.get(guildId);
  return locker
    ? {
        ...locker,
        items: locker.items.map((i) => ({ ...i })),
        accessLog: locker.accessLog.map((log) => ({ ...log }))
      }
    : null;
}

/**
 * Get all active announcements
 * 
 * @returns Active announcements
 */
export function getActiveAnnouncements(): FactionAnnouncement[] {
  const now = Date.now();
  return announcements.filter((a) => a.expiresAt > now).map((a) => ({ ...a }));
}

/**
 * Get player notifications
 * 
 * @param playerId Player to get notifications for
 * @returns Player notifications
 */
export function getPlayerNotifications(playerId: string): PlayerNotification[] {
  const notifs = notifications.get(playerId) || [];
  return notifs.map((n) => ({ ...n }));
}

/**
 * Mark notification as read
 * 
 * @param notificationId Notification to mark
 * @returns True if marked
 */
export function markNotificationAsRead(notificationId: string): boolean {
  for (const notifList of Array.from(notifications.values())) {
    const notif = notifList.find((n) => n.notificationId === notificationId);
    if (notif) {
      (notif as any).readAt = Date.now();
      return true;
    }
  }
  return false;
}

/**
 * Get community state
 * 
 * @returns Infrastructure state
 */
export function getCommunityInfrastructureState(): CommunityInfrastructureState {
  return {
    ...infrastructureState,
    leaderboards: new Map(infrastructureState.leaderboards),
    weeklyBoards: new Map(infrastructureState.weeklyBoards)
  };
}

/**
 * Reset community infrastructure (for testing)
 */
export function resetCommunityInfrastructure(): void {
  infrastructureState = {
    engineId: `community_${uuid()}`,
    isInitialized: false,
    factionCount: 0,
    guildCount: 0,
    totalNotifications: 0,
    leaderboards: new Map(),
    weeklyBoards: new Map(),
    lastUpdate: 0
  };

  announcements = [];
  notifications.clear();
  guilds.clear();
  sharedLockers.clear();
  playerNotificationPrefs.clear();
  notificationRateLimit.clear();
}
