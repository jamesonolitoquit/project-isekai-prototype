/**
 * M69: Chat Moderation & Automation - Real-time content filtering
 * Profanity filtering, spam detection, rate-limiting per faction channel
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ChatChannel = 'general' | 'faction' | 'party' | 'whisper' | 'event';
export type FilterAction = 'allow' | 'warn' | 'mute' | 'escalate';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  channel: ChatChannel;
  content: string;
  timestamp: number;
  factionId?: string;
  partyId?: string;
  recipientId?: string;
}

export interface FilteredMessage {
  original: ChatMessage;
  sanitized: string;
  violations: {
    type: 'profanity' | 'spam' | 'caps_spam' | 'rate_limit' | 'suspicious_links' | 'rmt_keywords';
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }[];
  action: FilterAction;
  escalated: boolean;
}

export interface RateLimitBucket {
  playerId: string;
  channel: ChatChannel;
  messageCount: number;
  windowStart: number;
  warnings: number;
}

export interface PlayerChatStats {
  playerId: string;
  totalMessagesFiltered: number;
  totalWarnings: number;
  lastViolation?: number;
  violationStreak: number;
  flagged: boolean;
  violationHistory: { violationType: string; timestamp: number }[];
}

export interface ChatModerationState {
  profanityDictionary: Set<string>;
  rtmKeywords: Set<string>;
  suspiciousPatterns: RegExp[];
  rateLimitBuckets: Map<string, RateLimitBucket>;
  playerStats: Map<string, PlayerChatStats>;
  filteredMessages: ChatMessage[];
  trustedPlayers: Set<string>; // Never filtered
  escalationQueue: FilteredMessage[];
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: ChatModerationState = {
  profanityDictionary: new Set(),
  rtmKeywords: new Set(),
  suspiciousPatterns: [],
  rateLimitBuckets: new Map(),
  playerStats: new Map(),
  filteredMessages: [],
  trustedPlayers: new Set(),
  escalationQueue: [],
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initChatModeration(): boolean {
  // Profanity dictionary (base list - would be extended)
  state.profanityDictionary = new Set([
    'badword1',
    'badword2',
    'slur1',
    'slur2',
    'offensive',
    'toxic',
    'hate',
    'discriminate',
  ]);

  // RMT (Real Money Trading) keywords
  state.rtmKeywords = new Set([
    'pmsg',
    'paypal',
    'venmo',
    'giftcard',
    'irl money',
    'irl cash',
    'real money',
    'buying gold',
    'selling items for',
    'discord only',
  ]);

  // Suspicious patterns
  state.suspiciousPatterns = [
    /https?:\/\/[^\s]+(\.tk|\.ru|\.xyz|\.top)/i, // Suspicious TLDs
    /\b(bit\.ly|tinyurl|short\.link)\b/i, // URL shorteners
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, // IP addresses
  ];

  state.rateLimitBuckets.clear();
  state.playerStats.clear();
  state.filteredMessages = [];
  state.trustedPlayers.clear();
  state.escalationQueue = [];

  return true;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const MESSAGES_PER_MINUTE = 10;
const GRACE_PERIOD_MS = 60000; // 1 minute

/**
 * Check if player exceeds rate limit
 */
export function checkRateLimit(playerId: string, channel: ChatChannel): boolean {
  const bucketKey = `${playerId}_${channel}`;
  let bucket = state.rateLimitBuckets.get(bucketKey);
  const now = Date.now();

  if (!bucket || now - bucket.windowStart > GRACE_PERIOD_MS) {
    // New bucket
    bucket = {
      playerId,
      channel,
      messageCount: 1,
      windowStart: now,
      warnings: 0,
    };
    state.rateLimitBuckets.set(bucketKey, bucket);
    return true; // OK
  }

  bucket.messageCount++;
  if (bucket.messageCount > MESSAGES_PER_MINUTE) {
    bucket.warnings++;
    return false; // Rate limited
  }

  return true; // OK
}

/**
 * Clear rate limit for a player (e.g., after time window)
 */
export function clearRateLimit(playerId: string, channel?: ChatChannel): void {
  if (channel) {
    state.rateLimitBuckets.delete(`${playerId}_${channel}`);
  } else {
    // Clear all channels for player
    for (const key of Array.from(state.rateLimitBuckets.keys())) {
      if (key.startsWith(playerId)) {
        state.rateLimitBuckets.delete(key);
      }
    }
  }
}

// ============================================================================
// CONTENT FILTERING
// ============================================================================

/**
 * Process a chat message through all filters
 */
export function filterChatMessage(message: ChatMessage): FilteredMessage {
  const violations: FilteredMessage['violations'] = [];

  // Check if player is trusted (skip filtering)
  if (state.trustedPlayers.has(message.playerId)) {
    return {
      original: message,
      sanitized: message.content,
      violations: [],
      action: 'allow',
      escalated: false,
    };
  }

  // Get player stats
  let playerStats = state.playerStats.get(message.playerId);
  if (!playerStats) {
    playerStats = {
      playerId: message.playerId,
      totalMessagesFiltered: 0,
      totalWarnings: 0,
      violationStreak: 0,
      flagged: false,
      violationHistory: [],
    };
    state.playerStats.set(message.playerId, playerStats);
  }

  let sanitized = message.content;

  // 1. Profanity check
  const profanityMatch = checkProfanity(message.content);
  if (profanityMatch) {
    violations.push({
      type: 'profanity',
      severity: 'high',
      reason: `Profanity detected: "${profanityMatch}"`,
    });
    sanitized = replaceProfanity(sanitized);
  }

  // 2. RMT keywords
  const rtmMatch = checkRMTKeywords(message.content);
  if (rtmMatch) {
    violations.push({
      type: 'rmt_keywords',
      severity: 'high',
      reason: `RMT keyword detected: "${rtmMatch}"`,
    });
  }

  // 3. Suspicious links
  const linkMatch = checkSuspiciousLinks(message.content);
  if (linkMatch) {
    violations.push({
      type: 'suspicious_links',
      severity: 'medium',
      reason: `Suspicious link detected: "${linkMatch}"`,
    });
  }

  // 4. Caps spam (>50% caps in message >10 chars)
  if (message.content.length > 10) {
    const capsRatio = (message.content.match(/[A-Z]/g) || []).length / message.content.length;
    if (capsRatio > 0.5) {
      violations.push({
        type: 'caps_spam',
        severity: 'low',
        reason: `Excessive caps (${Math.round(capsRatio * 100)}%)`,
      });
      sanitized = sanitized.toLowerCase();
    }
  }

  // 5. Spam detection (repeated characters)
  if (checkCharacterSpam(message.content)) {
    violations.push({
      type: 'spam',
      severity: 'medium',
      reason: 'Character spam detected',
    });
  }

  // 6. Rate limiting
  const rateLimitOK = checkRateLimit(message.playerId, message.channel);
  if (!rateLimitOK) {
    violations.push({
      type: 'rate_limit',
      severity: 'medium',
      reason: `Rate limit exceeded (${MESSAGES_PER_MINUTE}/min)`,
    });
  }

  // Determine action
  let action: FilterAction = 'allow';
  const maxSeverity = violations.length > 0 ? Math.max(
    ...violations.map(v => v.severity === 'high' ? 3 : v.severity === 'medium' ? 2 : 1)
  ) : 0;

  if (maxSeverity >= 3) {
    action = 'escalate';
  } else if (maxSeverity === 2) {
    action = violations.some(v => v.type === 'rate_limit') ? 'mute' : 'warn';
  } else if (violations.length > 0) {
    action = 'warn';
  }

  // Update player stats
  (playerStats as any).totalMessagesFiltered++;
  if (violations.length > 0) {
    (playerStats as any).totalWarnings++;
    (playerStats as any).violationStreak++;
    (playerStats as any).lastViolation = Date.now();

    for (const v of violations) {
      playerStats.violationHistory.push({
        violationType: v.type,
        timestamp: Date.now(),
      });
    }

    // Keep only last 100 violations
    if (playerStats.violationHistory.length > 100) {
      playerStats.violationHistory = playerStats.violationHistory.slice(-100);
    }
  } else {
    (playerStats as any).violationStreak = 0;
  }

  const filtered: FilteredMessage = {
    original: message,
    sanitized,
    violations,
    action,
    escalated: action === 'escalate',
  };

  if (filtered.escalated) {
    state.escalationQueue.push(filtered);
  }

  state.filteredMessages.push(message);
  if (state.filteredMessages.length > 10000) {
    state.filteredMessages = state.filteredMessages.slice(-10000);
  }

  return filtered;
}

// ============================================================================
// FILTER UTILITIES
// ============================================================================

function checkProfanity(content: string): string | null {
  const words = content.toLowerCase().split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (state.profanityDictionary.has(cleanWord)) {
      return word;
    }
  }
  return null;
}

function replaceProfanity(content: string): string {
  let result = content;
  for (const badWord of state.profanityDictionary) {
    const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
    result = result.replace(regex, '*'.repeat(badWord.length));
  }
  return result;
}

function checkRMTKeywords(content: string): string | null {
  const lowerContent = content.toLowerCase();
  for (const keyword of state.rtmKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

function checkSuspiciousLinks(content: string): string | null {
  for (const pattern of state.suspiciousPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function checkCharacterSpam(content: string): boolean {
  // Check for 5+ repeated characters
  const repeatedChars = /(.)\1{4,}/;
  return repeatedChars.test(content);
}

// ============================================================================
// MODERATION ACTIONS
// ============================================================================

/**
 * Add a player to the trusted list (no filtering)
 */
export function trustPlayer(playerId: string): void {
  state.trustedPlayers.add(playerId);
}

/**
 * Remove player from trusted list
 */
export function untrustPlayer(playerId: string): void {
  state.trustedPlayers.delete(playerId);
}

/**
 * Get escalated messages requiring human review
 */
export function getEscalationQueue(): FilteredMessage[] {
  return state.escalationQueue;
}

/**
 * Acknowledge and clear an escalation
 */
export function acknowledgeEscalation(messageId: string): void {
  state.escalationQueue = state.escalationQueue.filter((m) => m.original.id !== messageId);
}

// ============================================================================
// PLAYER STATS & MONITORING
// ============================================================================

/**
 * Get chat stats for a player
 */
export function getPlayerChatStats(playerId: string): PlayerChatStats | null {
  return state.playerStats.get(playerId) || null;
}

/**
 * Get flagged players (high violation history)
 */
export function getFlaggedPlayers(): PlayerChatStats[] {
  const flagged: PlayerChatStats[] = [];
  for (const stats of state.playerStats.values()) {
    if (stats.violationHistory.length >= 5 || (stats as any).violationStreak >= 3) {
      (stats as any).flagged = true;
      flagged.push(stats);
    }
  }
  return flagged;
}

/**
 * Reset player stats
 */
export function resetPlayerChatStats(playerId: string): void {
  state.playerStats.delete(playerId);
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Add a word to the profanity dictionary
 */
export function addToProfanityDictionary(word: string): void {
  state.profanityDictionary.add(word.toLowerCase());
}

/**
 * Add an RMT keyword
 */
export function addRMTKeyword(keyword: string): void {
  state.rtmKeywords.add(keyword.toLowerCase());
}

/**
 * Get moderation dashboard summary
 */
export function getChatModerationSummary(): {
  escalationQueueSize: number;
  flaggedPlayerCount: number;
  totalMessagesFiltered: number;
  averageViolationsPerPlayer: number;
} {
  const flagged = getFlaggedPlayers();
  const totalMessages = Array.from(state.playerStats.values()).reduce((sum, s) => sum + s.totalMessagesFiltered, 0);
  const avgViolations = state.playerStats.size > 0
    ? Array.from(state.playerStats.values()).reduce((sum, s) => sum + s.totalWarnings, 0) / state.playerStats.size
    : 0;

  return {
    escalationQueueSize: state.escalationQueue.length,
    flaggedPlayerCount: flagged.length,
    totalMessagesFiltered: totalMessages,
    averageViolationsPerPlayer: avgViolations,
  };
}

export function getChatModerationState(): ChatModerationState {
  return state;
}
