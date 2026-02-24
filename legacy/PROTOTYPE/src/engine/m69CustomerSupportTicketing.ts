/**
 * M69: Customer Support Ticketing - Support ticket system with auto-routing
 * Automatic categorization, SLA tracking, resolution workflows
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type TicketCategory = 'bug_report' | 'account_issue' | 'abuse_report' | 'gameplay_question' | 'payment_issue' | 'technical_support' | 'content_feedback';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_player' | 'resolved' | 'closed';
export type TicketTeam = 'general' | 'moderation' | 'billing' | 'technical' | 'game_balance';

export interface SupportTicket {
  id: string;
  playerId: string;
  playerName: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  attachments: string[]; // File refs/hashes
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  assignedTo?: string; // Team member ID
  assignedTeam: TicketTeam;
  notes: string[];
  timeSpentMinutes: number;
  slaBreached: boolean;
  playerResponses: Array<{ timestamp: number; message: string; attachments?: string[] }>;
  resolution?: string;
}

export interface SLAConfig {
  category: TicketCategory;
  responseTimeMinutes: number; // First response target
  resolutionTimeHours: number;
  escalationThreshold: number;
}

export interface TeamStats {
  teamId: TicketTeam;
  openTickets: number;
  averageResolutionTime: number;
  averageResponseTime: number;
  satisfactionScore: number; // 0-100 per feedback
  slaCompliance: number; // 0-1
}

export interface SupportDashboardMetrics {
  totalTickets: number;
  openTickets: number;
  averageWaitTime: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
  teamMetrics: Record<TicketTeam, TeamStats>;
  backlog: SupportTicket[];
}

export interface SupportTicketingState {
  tickets: Map<string, SupportTicket>;
  slaConfigs: Map<TicketCategory, SLAConfig>;
  teamStats: Map<TicketTeam, TeamStats>;
  automationRules: Array<{
    condition: string;
    action: 'auto_assign' | 'auto_resolve' | 'priority_escalate';
    targetTeam?: TicketTeam;
  }>;
  playerFeedback: Map<string, { ticketId: string; rating: number; comment: string }>;
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: SupportTicketingState = {
  tickets: new Map(),
  slaConfigs: new Map(),
  teamStats: new Map(),
  automationRules: [],
  playerFeedback: new Map(),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initCustomerSupportTicketing(): boolean {
  state.tickets.clear();
  state.playerFeedback.clear();

  // Initialize SLA configs
  const slaConfigs: SLAConfig[] = [
    { category: 'bug_report', responseTimeMinutes: 120, resolutionTimeHours: 48, escalationThreshold: 3 },
    { category: 'account_issue', responseTimeMinutes: 60, resolutionTimeHours: 24, escalationThreshold: 2 },
    { category: 'abuse_report', responseTimeMinutes: 30, resolutionTimeHours: 8, escalationThreshold: 1 },
    { category: 'gameplay_question', responseTimeMinutes: 240, resolutionTimeHours: 72, escalationThreshold: 5 },
    { category: 'payment_issue', responseTimeMinutes: 30, resolutionTimeHours: 12, escalationThreshold: 2 },
    { category: 'technical_support', responseTimeMinutes: 120, resolutionTimeHours: 48, escalationThreshold: 3 },
    { category: 'content_feedback', responseTimeMinutes: 480, resolutionTimeHours: 168, escalationThreshold: 10 },
  ];

  for (const config of slaConfigs) {
    state.slaConfigs.set(config.category, config);
  }

  // Initialize team stats
  const teams: TicketTeam[] = ['general', 'moderation', 'billing', 'technical', 'game_balance'];
  for (const team of teams) {
    state.teamStats.set(team, {
      teamId: team,
      openTickets: 0,
      averageResolutionTime: 0,
      averageResponseTime: 0,
      satisfactionScore: 85,
      slaCompliance: 0.9,
    });
  }

  // Initialize automation rules
  state.automationRules = [
    {
      condition: 'category === "gameplay_question" && priority === "low"',
      action: 'auto_assign',
      targetTeam: 'general',
    },
    {
      condition: 'category === "abuse_report"',
      action: 'auto_assign',
      targetTeam: 'moderation',
    },
    {
      condition: 'category === "payment_issue"',
      action: 'auto_assign',
      targetTeam: 'billing',
    },
    {
      condition: 'waitTime > 24 * 60 && category !== "content_feedback"',
      action: 'priority_escalate',
    },
  ];

  return true;
}

// ============================================================================
// TICKET CREATION & SUBMISSION
// ============================================================================

/**
 * Create a support ticket
 */
export function createSupportTicket(
  playerId: string,
  playerName: string,
  category: TicketCategory,
  title: string,
  description: string,
  attachments: string[] = []
): SupportTicket {
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Auto-categorize priority based on type
  let priority: TicketPriority = 'normal';
  if (category === 'abuse_report' || category === 'payment_issue') {
    priority = 'high';
  } else if (category === 'bug_report') {
    priority = 'normal';
  }

  // Assign team
  let assignedTeam: TicketTeam = 'general';
  if (category === 'abuse_report') assignedTeam = 'moderation';
  else if (category === 'payment_issue') assignedTeam = 'billing';
  else if (category === 'technical_support' || category === 'bug_report') assignedTeam = 'technical';
  else if (category === 'gameplay_question') assignedTeam = 'game_balance';

  const ticket: SupportTicket = {
    id: ticketId,
    playerId,
    playerName,
    category,
    priority,
    status: 'open',
    title,
    description,
    attachments,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    assignedTeam,
    notes: [],
    timeSpentMinutes: 0,
    slaBreached: false,
    playerResponses: [],
  };

  state.tickets.set(ticketId, ticket);

  // Update team stats
  updateTeamStats(assignedTeam);

  return ticket;
}

/**
 * Get a ticket by ID
 */
export function getTicket(ticketId: string): SupportTicket | null {
  return state.tickets.get(ticketId) || null;
}

/**
 * Get all tickets for a player
 */
export function getPlayerTickets(playerId: string): SupportTicket[] {
  return Array.from(state.tickets.values()).filter((t) => t.playerId === playerId);
}

/**
 * Get all open tickets
 */
export function getOpenTickets(): SupportTicket[] {
  return Array.from(state.tickets.values()).filter((t) => t.status === 'open' || t.status === 'in_progress');
}

/**
 * Get tickets by team
 */
export function getTeamTickets(team: TicketTeam): SupportTicket[] {
  return Array.from(state.tickets.values()).filter((t) => t.assignedTeam === team && t.status !== 'closed');
}

/**
 * Get high-priority backlog
 */
export function getBacklogTickets(limit = 50): SupportTicket[] {
  return Array.from(state.tickets.values())
    .filter((t) => t.status === 'open' || t.status === 'waiting_player')
    .sort((a, b) => {
      // Sort by priority, then by age
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = (priorityOrder as any)[a.priority] - (priorityOrder as any)[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    })
    .slice(0, limit);
}

// ============================================================================
// TICKET ASSIGNMENT & ROUTING
// ============================================================================

/**
 * Assign a ticket to a team member
 */
export function assignTicketToMember(ticketId: string, memberId: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.assignedTo = memberId;
  ticket.status = 'in_progress';
  ticket.updatedAt = Date.now();

  return true;
}

/**
 * Re-route a ticket to a different team
 */
export function rerouteTicket(ticketId: string, newTeam: TicketTeam, reason: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  const oldTeam = ticket.assignedTeam;
  ticket.assignedTeam = newTeam;
  ticket.notes.push(`[SYSTEM] Rerouted from ${oldTeam} to ${newTeam}: ${reason}`);
  ticket.updatedAt = Date.now();

  updateTeamStats(oldTeam);
  updateTeamStats(newTeam);

  return true;
}

// ============================================================================
// TICKET UPDATES & RESPONSES
// ============================================================================

/**
 * Add a support team response to a ticket
 */
export function addTicketResponse(ticketId: string, memberName: string, message: string, attachments: string[] = []): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.notes.push(`[${memberName}] ${message}`);
  ticket.updatedAt = Date.now();
  ticket.status = 'in_progress';

  return true;
}

/**
 * Add a player response to a ticket
 */
export function addPlayerResponse(ticketId: string, message: string, attachments: string[] = []): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.playerResponses.push({
    timestamp: Date.now(),
    message,
    attachments,
  });

  ticket.status = 'waiting_player';
  ticket.updatedAt = Date.now();

  return true;
}

/**
 * Update ticket priority
 */
export function updateTicketPriority(ticketId: string, newPriority: TicketPriority, reason: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.priority = newPriority;
  ticket.notes.push(`[SYSTEM] Priority updated to ${newPriority}: ${reason}`);
  ticket.updatedAt = Date.now();

  return true;
}

// ============================================================================
// TICKET RESOLUTION
// ============================================================================

/**
 * Mark ticket as resolved with resolution text
 */
export function resolveTicket(ticketId: string, resolution: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.status = 'resolved';
  ticket.resolution = resolution;
  ticket.resolvedAt = Date.now();
  ticket.updatedAt = Date.now();

  // Calculate time spent (minimum 1 minute for immediate resolutions)
  const timeElapsed = ticket.resolvedAt - ticket.createdAt;
  ticket.timeSpentMinutes = Math.max(1, Math.round(timeElapsed / 60000));

  // Check SLA
  const slaConfig = state.slaConfigs.get(ticket.category);
  if (slaConfig && ticket.timeSpentMinutes > slaConfig.resolutionTimeHours * 60) {
    ticket.slaBreached = true;
  }

  updateTeamStats(ticket.assignedTeam);

  return true;
}

/**
 * Close a ticket (after player confirmation)
 */
export function closeTicket(ticketId: string, closeReason: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return false;

  ticket.status = 'closed';
  ticket.notes.push(`[SYSTEM] Ticket closed: ${closeReason}`);
  ticket.updatedAt = Date.now();

  return true;
}

/**
 * Reopen a closed ticket
 */
export function reopenTicket(ticketId: string, reason: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket || ticket.status !== 'closed') return false;

  ticket.status = 'open';
  ticket.notes.push(`[SYSTEM] Ticket reopened: ${reason}`);
  ticket.updatedAt = Date.now();

  updateTeamStats(ticket.assignedTeam);

  return true;
}

// ============================================================================
// PLAYER FEEDBACK & SATISFACTION
// ============================================================================

/**
 * Submit ticket satisfaction feedback
 */
export function submitTicketFeedback(ticketId: string, playerId: string, rating: number, comment: string): boolean {
  const ticket = state.tickets.get(ticketId);
  if (!ticket || ticket.status !== 'resolved') return false;

  state.playerFeedback.set(ticketId, {
    ticketId,
    rating: Math.max(1, Math.min(5, rating)), // Clamp 1-5
    comment,
  });

  // Update team satisfaction
  if (ticket.assignedTeam) {
    const teamStats = state.teamStats.get(ticket.assignedTeam);
    if (teamStats) {
      // Weighted average of satisfaction
      (teamStats as any).satisfactionScore = (teamStats.satisfactionScore * 0.8) + (rating / 5 * 100 * 0.2);
    }
  }

  return true;
}

/**
 * Get feedback for a ticket
 */
export function getTicketFeedback(ticketId: string): { rating: number; comment: string } | null {
  const feedback = state.playerFeedback.get(ticketId);
  return feedback ? { rating: feedback.rating, comment: feedback.comment } : null;
}

// ============================================================================
// SLA TRACKING
// ============================================================================

/**
 * Check SLA compliance for a ticket
 */
export function checkSLACompliance(ticketId: string): { compliant: boolean; minutesRemaining: number; deadline: number } | null {
  const ticket = state.tickets.get(ticketId);
  if (!ticket) return null;

  const slaConfig = state.slaConfigs.get(ticket.category);
  if (!slaConfig) return null;

  const resolutionDeadline = ticket.createdAt + slaConfig.resolutionTimeHours * 60 * 60 * 1000;
  const minutesRemaining = Math.round((resolutionDeadline - Date.now()) / 60000);

  return {
    compliant: minutesRemaining > 0,
    minutesRemaining,
    deadline: resolutionDeadline,
  };
}

/**
 * Get SLA breached tickets
 */
export function getSLABreachedTickets(): SupportTicket[] {
  const breached: SupportTicket[] = [];

  for (const ticket of state.tickets.values()) {
    if (ticket.status === 'open' || ticket.status === 'in_progress') {
      const compliance = checkSLACompliance(ticket.id);
      if (compliance && !compliance.compliant) {
        breached.push(ticket);
      }
    }
  }

  return breached;
}

// ============================================================================
// TEAM STATISTICS
// ============================================================================

function updateTeamStats(team: TicketTeam): void {
  const teamTickets = Array.from(state.tickets.values()).filter((t) => t.assignedTeam === team);
  const openTeamTickets = teamTickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const resolvedTeamTickets = teamTickets.filter((t) => t.status === 'resolved');

  let avgResolutionTime = 0;
  if (resolvedTeamTickets.length > 0) {
    avgResolutionTime =
      resolvedTeamTickets.reduce((sum, t) => sum + t.timeSpentMinutes, 0) / resolvedTeamTickets.length;
  }

  let slaCompliance = 1;
  if (resolvedTeamTickets.length > 0) {
    const compliant = resolvedTeamTickets.filter((t) => !t.slaBreached).length;
    slaCompliance = compliant / resolvedTeamTickets.length;
  }

  const stats = state.teamStats.get(team);
  if (stats) {
    (stats as any).openTickets = openTeamTickets.length;
    (stats as any).averageResolutionTime = Math.round(avgResolutionTime);
    (stats as any).slaCompliance = slaCompliance;
  }
}

/**
 * Get team statistics
 */
export function getTeamStats(team: TicketTeam): TeamStats | null {
  return state.teamStats.get(team) || null;
}

/**
 * Get dashboard metrics
 */
export function getSupportDashboardMetrics(): SupportDashboardMetrics {
  const allTickets = Array.from(state.tickets.values());
  const openTickets = getOpenTickets();
  const backlog = getBacklogTickets(100);

  let totalWaitTime = 0;
  for (const ticket of openTickets) {
    totalWaitTime += Date.now() - ticket.createdAt;
  }

  const avgWaitTime = openTickets.length > 0 ? Math.round(totalWaitTime / openTickets.length / 60000) : 0;

  let totalResolutionTime = 0;
  let resolutionCount = 0;
  for (const ticket of allTickets) {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      totalResolutionTime += ticket.timeSpentMinutes;
      resolutionCount++;
    }
  }

  const avgResolutionTime = resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : 0;

  // Calculate overall SLA compliance
  const breashedCount = getSLABreachedTickets().length;
  const slaCompliance = allTickets.length > 0 ? 1 - (breashedCount / allTickets.length) : 1;

  // Update all team stats
  const teams: TicketTeam[] = ['general', 'moderation', 'billing', 'technical', 'game_balance'];
  const teamMetrics: Record<TicketTeam, TeamStats> = {} as any;
  for (const team of teams) {
    updateTeamStats(team);
    const stats = state.teamStats.get(team);
    if (stats) {
      teamMetrics[team] = stats;
    }
  }

  return {
    totalTickets: allTickets.length,
    openTickets: openTickets.length,
    averageWaitTime: avgWaitTime,
    averageResolutionTime: avgResolutionTime,
    slaComplianceRate: slaCompliance,
    teamMetrics,
    backlog,
  };
}

export function getSupportTicketingState(): SupportTicketingState {
  return state;
}
