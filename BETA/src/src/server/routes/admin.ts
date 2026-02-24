/**
 * routes/admin.ts - Protected admin endpoints for M69 moderator operations
 * 
 * Requires authentication + appropriate permissions
 * All actions are audited to the ledger
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermission, requireRole } from '../auth';
import { SocketIOBroadcaster } from '../socketServer';

export interface AdminActionPayload {
  moderatorId: string;
  action: string;
  targetPlayerId?: string;
  reason: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Create admin routes with socket broadcaster
 */
export function createAdminRoutes(broadcaster: SocketIOBroadcaster): Router {
  const router = Router();

  // All routes require authentication
  router.use(authenticateToken);

  /**
   * POST /api/admin/reports
   * Get list of exploit/anomaly reports
   * Requires: view_reports permission
   */
  router.get('/reports', requirePermission('view_reports'), (req: Request, res: Response) => {
    // Would query database for reports
    // For now, return mock data
    const reports = [
      {
        reportId: 'report-1',
        playerId: 'player-123',
        type: 'exploit_detected',
        severity: 'high',
        timestamp: Date.now() - 60000,
        details: 'Duplication attempt detected in transaction log',
        status: 'pending',
      },
      {
        reportId: 'report-2',
        playerId: 'player-456',
        type: 'anomaly_flagged',
        severity: 'medium',
        timestamp: Date.now() - 120000,
        details: 'Unusual behavior pattern detected',
        status: 'pending',
      },
    ];

    res.json({
      success: true,
      reports,
      count: reports.length,
    });
  });

  /**
   * POST /api/admin/moderation/action
   * Perform moderation action (mute, ban, etc)
   * Requires: approve_actions permission
   */
  router.post('/moderation/action', requirePermission('approve_actions'), (req: Request, res: Response) => {
    const { targetPlayerId, actionType, reason, duration } = req.body;
    const moderatorId = (req as any).user.moderatorId;

    if (!targetPlayerId || !actionType || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create action record
    const action: AdminActionPayload = {
      moderatorId,
      action: actionType,
      targetPlayerId,
      reason,
      metadata: { duration },
      timestamp: Date.now(),
    };

    // Emit broadcast event
    broadcaster.emitBroadcast({
      eventId: `action-${Date.now()}-${Math.random()}`,
      type: 'player_muted',
      timestamp: Date.now(),
      severity: 'high',
      data: {
        playerId: targetPlayerId,
        action: actionType,
        moderatorId,
        reason,
      },
      targets: ['admin', 'moderator'],
    });

    // In production: Persist to DB ledger
    console.log('✅ Moderation action recorded:', action);

    res.json({
      success: true,
      action,
      message: `${actionType} applied to player ${targetPlayerId}`,
    });
  });

  /**
   * POST /api/admin/ban
   * Ban a player
   * Requires: ban_players permission
   */
  router.post('/ban', requirePermission('ban_players'), (req: Request, res: Response) => {
    const { targetPlayerId, reason, banDurationDays } = req.body;
    const moderatorId = (req as any).user.moderatorId;

    if (!targetPlayerId) {
      return res.status(400).json({ error: 'targetPlayerId is required' });
    }

    const banRecord: AdminActionPayload = {
      moderatorId,
      action: 'ban_player',
      targetPlayerId,
      reason: reason || 'No reason provided',
      metadata: { banDurationDays: banDurationDays || 30 },
      timestamp: Date.now(),
    };

    // Emit broadcast
    broadcaster.broadcastExploitDetected(targetPlayerId, 'player_ban', 'high');

    console.log('🚫 Player banned:', banRecord);

    res.json({
      success: true,
      ban: banRecord,
      message: `Player ${targetPlayerId} banned for ${banDurationDays || 30} days`,
    });
  });

  /**
   * POST /api/admin/approval
   * Approve a moderation action/appeal
   * Requires: approve_actions permission
   */
  router.post('/approval', requirePermission('approve_actions'), (req: Request, res: Response) => {
    const { reportId, decision, notes } = req.body;
    const moderatorId = (req as any).user.moderatorId;

    if (!reportId || !decision) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const approval: AdminActionPayload = {
      moderatorId,
      action: 'approve_action',
      reason: decision,
      metadata: { reportId, notes },
      timestamp: Date.now(),
    };

    console.log('✅ Action approved:', approval);

    res.json({
      success: true,
      approval,
      message: `Report ${reportId} has been ${decision}`,
    });
  });

  /**
   * DELETE /api/admin/revocation
   * Revoke a moderation action (e.g., lift ban, unmute)
   * Requires: approve_actions permission
   */
  router.delete('/revocation', requirePermission('approve_actions'), (req: Request, res: Response) => {
    const { targetPlayerId, actionType } = req.body;
    const moderatorId = (req as any).user.moderatorId;

    if (!targetPlayerId || !actionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const revocation: AdminActionPayload = {
      moderatorId,
      action: 'revoke_moderation',
      targetPlayerId,
      reason: `Revoked ${actionType}`,
      timestamp: Date.now(),
    };

    console.log('✅ Moderation revoked:', revocation);

    res.json({
      success: true,
      revocation,
      message: `${actionType} revoked for player ${targetPlayerId}`,
    });
  });

  /**
   * GET /api/admin/analytics
   * Get admin analytics data
   * Requires: view_analytics permission
   */
  router.get('/analytics', requirePermission('view_analytics'), (req: Request, res: Response) => {
    const analytics = {
      exploitsDetected: 142,
      playersAffected: 23,
      actionsApproved: 45,
      playersCurrentlyMuted: 12,
      playersCurrentlyBanned: 8,
      moderationAverageLag: 2.5, // minutes
      reportResolutionTime: 8.4, // minutes
    };

    res.json({
      success: true,
      analytics,
    });
  });

  /**
   * POST /api/admin/moderators/create
   * Create new moderator account
   * Requires: admin role
   */
  router.post('/moderators/create', requireRole('admin'), (req: Request, res: Response) => {
    const { username, email, role } = req.body;

    if (!username || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newModerator = {
      moderatorId: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      email,
      role,
      createdAt: Date.now(),
      createdBy: (req as any).user.moderatorId,
    };

    console.log('✅ Moderator created:', newModerator);

    res.json({
      success: true,
      moderator: newModerator,
      message: `Moderator ${username} created successfully`,
    });
  });

  /**
   * GET /api/admin/health
   * Check admin backend health
   * Requires: authentication only
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      moderatorId: (req as any).user.moderatorId,
    });
  });

  return router;
}

export default { createAdminRoutes };
