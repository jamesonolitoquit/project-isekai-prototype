/**
 * M69: Moderator Console - Core moderation operations hub
 * Player report system, ban/mute/kick mechanics with audit trail
 * Real-time moderation dashboard for support team
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ModerationAction = 'mute' | 'kick' | 'ban' | 'warn' | 'restrict' | 'appeal_review';
export type ModerationReason = 'spam' | 'griefing' | 'rmt' | 'exploiting' | 'harassment' | 'toxicity' | 'inappropriate_name' | 'other';
export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'dismissed';
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ModerationAction_t {
  id: string;
  playerId: string;
  playerName: string;
  action: ModerationAction;
  reason: ModerationReason;
  severity: ModerationSeverity;
  duration?: number; // milliseconds, null for permanent
  description: string;
  reportedBy: string; // player ID or system
  moderatedBy: string; // moderator player ID
  timestamp: number;
  evidence: string[]; // chat logs, screenshot refs, ledger hashes
  executedAt?: number;
  status: 'pending' | 'approved' | 'executed' | 'appealed' | 'revoked';
  reviewedBy?: string; // secondary moderator for approval
  reviewTimestamp?: number;
}

export interface PlayerSuspension {
  playerId: string;
  playerName: string;
  suspensionType: 'mute' | 'kick' | 'ban';
  duration: number; // milliseconds from application
  reason: ModerationReason;
  startTime: number;
  endTime: number;
  permanent: boolean;
  actionId: string; // Reference to ModerationAction
}

export interface ModerationReport {
  id: string;
  reportedPlayerId: string;
  reportedPlayerName: string;
  reporterPlayerId: string;
  reporterPlayerName: string;
  reason: ModerationReason;
  description: string;
  evidence: string[];
  timestamp: number;
  location?: string; // faction, area, event name
  status: 'new' | 'reviewing' | 'actioned' | 'closed' | 'dismissed';
  assignedModerator?: string;
  actionTaken?: ModerationAction_t;
  closedAt?: number;
  notes: string[];
}

export interface BanAppeal {
  id: string;
  playerId: string;
  playerName: string;
  originalBanId: string;
  bannedAt: number;
  banReason: string;
  appealText: string;
  submittedAt: number;
  status: AppealStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewerNotes?: string;
}

export interface ModerationStats {
  totalActions: number;
  activeActions: number;
  expiredActions: number;
  appealCount: number;
  approvalRate: number; // 0-1
  averageResolutionTime: number; // ms
  topReasons: Record<ModerationReason, number>;
  topModerators: Record<string, number>;
}

export interface ModerationConsoleState {
  actions: Map<string, ModerationAction_t>;
  reports: Map<string, ModerationReport>;
  activeSuspensions: Map<string, PlayerSuspension>;
  banAppeals: Map<string, BanAppeal>;
  auditLog: Array<{ timestamp: number; moderatorId: string; action: string; result: string }>;
  stats: ModerationStats;
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: ModerationConsoleState = {
  actions: new Map(),
  reports: new Map(),
  activeSuspensions: new Map(),
  banAppeals: new Map(),
  auditLog: [],
  stats: {
    totalActions: 0,
    activeActions: 0,
    expiredActions: 0,
    appealCount: 0,
    approvalRate: 0,
    averageResolutionTime: 0,
    topReasons: { spam: 0, griefing: 0, rmt: 0, exploiting: 0, abuse: 0, harassment: 0, fraud: 0, other: 0 },
    topModerators: {},
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initModeratorConsole(): boolean {
  state.actions.clear();
  state.reports.clear();
  state.activeSuspensions.clear();
  state.banAppeals.clear();
  state.auditLog = [];
  state.stats = {
    totalActions: 0,
    activeActions: 0,
    expiredActions: 0,
    appealCount: 0,
    approvalRate: 0,
    averageResolutionTime: 0,
    topReasons: { spam: 0, griefing: 0, rmt: 0, exploiting: 0, abuse: 0, harassment: 0, fraud: 0, other: 0 },
    topModerators: {},
  };
  return true;
}

// ============================================================================
// CORE MODERATION OPERATIONS
// ============================================================================

/**
 * Submit a player report for moderator review
 */
export function submitPlayerReport(
  reportedPlayerId: string,
  reportedPlayerName: string,
  reporterPlayerId: string,
  reporterPlayerName: string,
  reason: ModerationReason,
  description: string,
  evidence: string[],
  location?: string
): ModerationReport {
  const report: ModerationReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    reportedPlayerId,
    reportedPlayerName,
    reporterPlayerId,
    reporterPlayerName,
    reason,
    description,
    evidence,
    timestamp: Date.now(),
    location,
    status: 'new',
    notes: [],
  };

  state.reports.set(report.id, report);
  logAudit(reporterPlayerId, `report_submitted`, `Report ${report.id} created against ${reportedPlayerName}`);
  return report;
}

/**
 * Assign a moderator to review a report
 */
export function assignReportToModerator(reportId: string, moderatorId: string): boolean {
  const report = state.reports.get(reportId);
  if (!report) return false;

  report.assignedModerator = moderatorId;
  report.status = 'reviewing';
  logAudit(moderatorId, `report_assigned`, `Report ${reportId} assigned to moderator`);
  return true;
}

/**
 * Create a moderation action (pending moderator approval)
 */
export function createModerationAction(
  playerId: string,
  playerName: string,
  action: ModerationAction,
  reason: ModerationReason,
  severity: ModerationSeverity,
  description: string,
  reportedBy: string,
  duration?: number,
  evidence: string[] = []
): ModerationAction_t {
  const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const modAction: ModerationAction_t = {
    id: actionId,
    playerId,
    playerName,
    action,
    reason,
    severity,
    duration,
    description,
    reportedBy,
    moderatedBy: '', // To be filled by approving moderator
    timestamp: Date.now(),
    evidence,
    status: 'pending',
  };

  state.actions.set(actionId, modAction);
  logAudit(reportedBy, `action_created`, `Moderation action ${actionId} created for ${playerName}`);
  return modAction;
}

/**
 * Approve and execute a moderation action
 */
export function approveModerationAction(actionId: string, moderatorId: string, notes?: string): boolean {
  const action = state.actions.get(actionId);
  if (!action || action.status !== 'pending') return false;

  action.moderatedBy = moderatorId;
  action.reviewedBy = moderatorId;
  action.reviewTimestamp = Date.now();
  action.status = 'approved';

  // Apply the action
  executeModerationAction(action);

  logAudit(moderatorId, `action_approved`, `Action ${actionId} approved and executed. ${notes || ''}`);
  (state.stats as any).totalActions++;
  (state.stats as any).activeActions++;

  return true;
}

/**
 * Execute a moderation action (apply suspension)
 */
function executeModerationAction(action: ModerationAction_t): void {
  action.executedAt = Date.now();
  action.status = 'executed';

  if (action.action === 'ban' || action.action === 'mute' || action.action === 'kick') {
    const suspension: PlayerSuspension = {
      playerId: action.playerId,
      playerName: action.playerName,
      suspensionType: action.action === 'kick' ? 'kick' : action.action,
      duration: action.duration || 0,
      reason: action.reason,
      startTime: Date.now(),
      endTime: action.duration ? Date.now() + action.duration : Infinity,
      permanent: !action.duration,
      actionId: action.id,
    };

    state.activeSuspensions.set(action.playerId, suspension);
    logAudit(action.moderatedBy, `suspension_applied`, `${action.action} applied to ${action.playerName}`);
  }
}

/**
 * Deny a pending moderation action
 */
export function denyModerationAction(actionId: string, moderatorId: string, reason: string): boolean {
  const action = state.actions.get(actionId);
  if (!action || action.status !== 'pending') return false;

  action.status = 'revoked';
  action.reviewedBy = moderatorId;
  action.reviewTimestamp = Date.now();

  logAudit(moderatorId, `action_denied`, `Action ${actionId} denied. Reason: ${reason}`);
  return true;
}

/**
 * Revoke an active moderation action (unsuspend a player)
 */
export function revokeModerationAction(actionId: string, moderatorId: string, reason: string): boolean {
  const action = state.actions.get(actionId);
  if (!action) return false;

  if (action.status === 'executed') {
    state.activeSuspensions.delete(action.playerId);
  }

  action.status = 'revoked';
  logAudit(moderatorId, `action_revoked`, `Action ${actionId} revoked. Reason: ${reason}`);
  (state.stats as any).activeActions--;
  return true;
}

/**
 * Check if a player is currently suspended
 */
export function isPlayerSuspended(playerId: string): PlayerSuspension | null {
  const suspension = state.activeSuspensions.get(playerId);
  if (!suspension) return null;

  // Check if suspension has expired
  if (!suspension.permanent && Date.now() > suspension.endTime) {
    state.activeSuspensions.delete(playerId);
    (state.stats as any).activeActions--;
    (state.stats as any).expiredActions++;
    return null;
  }

  return suspension;
}

/**
 * Get player suspension details if active
 */
export function getPlayerSuspensionDetails(playerId: string): {
  type: string;
  reason: string;
  timeRemaining: number | null;
  permanent: boolean;
} | null {
  const suspension = isPlayerSuspended(playerId);
  if (!suspension) return null;

  const timeRemaining = suspension.permanent ? null : suspension.endTime - Date.now();
  return {
    type: suspension.suspensionType,
    reason: suspension.reason,
    timeRemaining: timeRemaining && timeRemaining > 0 ? timeRemaining : 0,
    permanent: suspension.permanent,
  };
}

// ============================================================================
// BAN APPEAL SYSTEM
// ============================================================================

/**
 * Submit a ban appeal
 */
export function submitBanAppeal(playerId: string, playerName: string, originalBanId: string, banReason: string, appealText: string): BanAppeal {
  const appeal: BanAppeal = {
    id: `appeal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    playerName,
    originalBanId,
    bannedAt: Date.now(),
    banReason,
    appealText,
    submittedAt: Date.now(),
    status: 'pending',
  };

  state.banAppeals.set(appeal.id, appeal);
  (state.stats as any).appealCount++;
  logAudit(playerId, `appeal_submitted`, `Ban appeal ${appeal.id} submitted by ${playerName}`);
  return appeal;
}

/**
 * Review a ban appeal
 */
export function reviewBanAppeal(appealId: string, moderatorId: string, approved: boolean, notes: string): boolean {
  const appeal = state.banAppeals.get(appealId);
  if (!appeal || appeal.status !== 'pending') return false;

  appeal.status = approved ? 'approved' : 'rejected';
  appeal.reviewedBy = moderatorId;
  appeal.reviewedAt = Date.now();
  appeal.reviewerNotes = notes;

  if (approved) {
    // Revoke the ban
    const action = Array.from(state.actions.values()).find((a) => a.id === appeal.originalBanId);
    if (action) {
      revokeModerationAction(action.id, moderatorId, 'Ban appeal approved');
    }
  }

  logAudit(moderatorId, `appeal_${approved ? 'approved' : 'rejected'}`, `Appeal ${appealId} reviewed`);
  return true;
}

// ============================================================================
// REPORT MANAGEMENT
// ============================================================================

/**
 * Close a report (after action taken)
 */
export function closeReport(reportId: string, moderatorId: string, actionTaken: ModerationAction_t | null): boolean {
  const report = state.reports.get(reportId);
  if (!report) return false;

  report.status = 'closed';
  report.closedAt = Date.now();
  if (actionTaken) {
    report.actionTaken = actionTaken;
  }

  logAudit(moderatorId, `report_closed`, `Report ${reportId} closed`);
  return true;
}

/**
 * Add a note to a report
 */
export function addReportNote(reportId: string, moderatorId: string, note: string): boolean {
  const report = state.reports.get(reportId);
  if (!report) return false;

  report.notes.push(`[${moderatorId}] ${note}`);
  logAudit(moderatorId, `report_note_added`, `Note added to report ${reportId}`);
  return true;
}

/**
 * Get all reports for a specific player
 */
export function getPlayerReports(playerId: string): ModerationReport[] {
  return Array.from(state.reports.values()).filter((r) => r.reportedPlayerId === playerId);
}

/**
 * Get pending reports requiring review
 */
export function getPendingReports(): ModerationReport[] {
  return Array.from(state.reports.values())
    .filter((r) => r.status === 'new' || r.status === 'reviewing')
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get a ticket/report by ID (alias for getReport)
 */
export function getTicket(reportId: string): ModerationReport | null {
  return state.reports.get(reportId) || null;
}

// ============================================================================
// AUDIT & STATS
// ============================================================================

/**
 * Internal audit logging
 */
function logAudit(moderatorId: string, action: string, result: string): void {
  state.auditLog.push({
    timestamp: Date.now(),
    moderatorId,
    action,
    result,
  });

  // Keep last 10,000 entries
  if (state.auditLog.length > 10000) {
    state.auditLog = state.auditLog.slice(-10000);
  }
}

/**
 * Get audit log entries
 */
export function getAuditLog(limit = 100): Array<{ timestamp: number; moderatorId: string; action: string; result: string }> {
  return state.auditLog.slice(-limit).reverse();
}

/**
 * Get moderation statistics
 */
export function getModerationStats(): ModerationStats {
  (state.stats as any).activeActions = state.activeSuspensions.size;
  (state.stats as any).expiredActions = Array.from(state.actions.values()).filter((a) => a.status === 'executed').length;

  // Calculate approval rate
  const totalPending = Array.from(state.actions.values()).filter(
    (a) => a.status === 'approved' || a.status === 'revoked'
  ).length;
  (state.stats as any).approvalRate = totalPending > 0 ? Array.from(state.actions.values()).filter((a) => a.status === 'approved').length / totalPending : 0;

  // Calculate top reasons
  const reasonCounts: Record<string, number> = {};
  for (const action of state.actions.values()) {
    reasonCounts[action.reason] = (reasonCounts[action.reason] || 0) + 1;
  }
  (state.stats as any).topReasons = reasonCounts;

  // Calculate top moderators
  const modCounts: Record<string, number> = {};
  for (const action of state.actions.values()) {
    if (action.moderatedBy) {
      modCounts[action.moderatedBy] = (modCounts[action.moderatedBy] || 0) + 1;
    }
  }
  (state.stats as any).topModerators = modCounts;

  return state.stats;
}

export function getConsoleState(): ModerationConsoleState {
  return state;
}
