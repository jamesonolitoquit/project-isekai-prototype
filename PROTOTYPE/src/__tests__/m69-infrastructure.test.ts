/**
 * M69: Player Support & Moderation Infrastructure Test Suite
 * 40+ tests covering moderation console, chat filtering, behavior tracking, and support ticketing
 */

import * as ModConsole from '../engine/m69ModeratorConsole';
import * as ChatMod from '../engine/m69ChatModeration';
import * as BehaviorTracking from '../engine/m69PlayerBehaviorTracking';
import * as SupportTickets from '../engine/m69CustomerSupportTicketing';

describe('M69: Player Support & Moderation Infrastructure', () => {
  // ========================================================================
  // M69 MODERATOR CONSOLE TESTS (10)
  // ========================================================================

  describe('M69-PartA: Moderator Console', () => {
    beforeEach(() => {
      ModConsole.initModeratorConsole();
    });

    test('Should initialize moderator console', () => {
      const state = ModConsole.getConsoleState();
      expect(state.actions.size).toBe(0);
      expect(state.reports.size).toBe(0);
      expect(state.stats.totalActions).toBe(0);
    });

    test('Should submit player report', () => {
      const report = ModConsole.submitPlayerReport(
        'player_123',
        'Toxic_Player',
        'reporter_456',
        'Reporter_Name',
        'toxicity',
        'Used slurs in faction chat',
        ['chat_log_ref_123']
      );

      expect(report.id).toBeDefined();
      expect(report.status).toBe('new');
      expect(report.reportedPlayerId).toBe('player_123');
    });

    test('Should create moderation action', () => {
      const action = ModConsole.createModerationAction(
        'player_123',
        'Toxic_Player',
        'mute',
        'toxicity',
        'high',
        'Mute for 24 hours',
        'mod_system',
        24 * 60 * 60 * 1000
      );

      expect(action.status).toBe('pending');
      expect(action.action).toBe('mute');
      expect(action.duration).toBe(24 * 60 * 60 * 1000);
    });

    test('Should approve and execute moderation action', () => {
      const action = ModConsole.createModerationAction(
        'player_123',
        'Bad_Player',
        'mute',
        'spam',
        'medium',
        'Mute for spam',
        'mod_system',
        1 * 60 * 60 * 1000
      );

      const approved = ModConsole.approveModerationAction(action.id, 'mod_001', 'Approved');
      expect(approved).toBe(true);

      const suspension = ModConsole.isPlayerSuspended('player_123');
      expect(suspension).not.toBeNull();
      expect(suspension?.suspensionType).toBe('mute');
    });

    test('Should revoke moderation action', () => {
      const action = ModConsole.createModerationAction(
        'player_123',
        'Bad_Player',
        'ban',
        'griefing',
        'high',
        'Permanent ban',
        'mod_system'
      );

      ModConsole.approveModerationAction(action.id, 'mod_001');
      const suspended = ModConsole.isPlayerSuspended('player_123');
      expect(suspended).not.toBeNull();

      const revoked = ModConsole.revokeModerationAction(action.id, 'mod_002', 'Appeal approved');
      expect(revoked).toBe(true);

      const suspended2 = ModConsole.isPlayerSuspended('player_123');
      expect(suspended2).toBeNull();
    });

    test('Should handle ban appeals', () => {
      const action = ModConsole.createModerationAction(
        'player_123',
        'Banned_Player',
        'ban',
        'exploiting',
        'critical',
        'Permanent ban for exploiting',
        'mod_system'
      );
      ModConsole.approveModerationAction(action.id, 'mod_001');

      const appeal = ModConsole.submitBanAppeal(
        'player_123',
        'Banned_Player',
        action.id,
        'exploiting',
        'I did not intentionally exploit.'
      );

      expect(appeal.status).toBe('pending');

      const reviewed = ModConsole.reviewBanAppeal(appeal.id, 'mod_002', true, 'Explanation accepted');
      expect(reviewed).toBe(true);

      const suspension = ModConsole.isPlayerSuspended('player_123');
      expect(suspension).toBeNull();
    });

    test('Should get audit log', () => {
      ModConsole.submitPlayerReport('player_123', 'Player', 'reporter_456', 'Reporter', 'spam', 'Spam', []);
      const log = ModConsole.getAuditLog(10);
      expect(log.length).toBeGreaterThan(0);
    });

    test('Should get moderation statistics', () => {
      for (let i = 0; i < 5; i++) {
        const action = ModConsole.createModerationAction(
          `player_${i}`,
          `Player_${i}`,
          'mute',
          'spam',
          'low',
          'Too spammy',
          'mod_system'
        );
        ModConsole.approveModerationAction(action.id, 'mod_001');
      }

      const stats = ModConsole.getModerationStats();
      expect(stats.totalActions).toBe(5);
      expect(stats.activeActions).toBe(5);
    });

    test('Should handle report notes and closure', () => {
      const report = ModConsole.submitPlayerReport(
        'player_123',
        'Player',
        'reporter_456',
        'Reporter',
        'harassment',
        'Sent threatening messages',
        []
      );

      ModConsole.addReportNote(report.id, 'mod_001', 'Reviewed chat logs, confirmed');
      const action = ModConsole.createModerationAction(
        'player_123',
        'Player',
        'kick',
        'harassment',
        'high',
        'Kicked',
        'mod_001'
      );
      ModConsole.approveModerationAction(action.id, 'mod_001');
      ModConsole.closeReport(report.id, 'mod_001', action);

      const reports = ModConsole.getPlayerReports('player_123');
      expect(reports.some((r) => r.status === 'closed')).toBe(true);
    });

    test('Should get pending reports', () => {
      for (let i = 0; i < 3; i++) {
        ModConsole.submitPlayerReport(
          `player_${i}`,
          `Player_${i}`,
          'reporter',
          'Reporter',
          'spam',
          'Spam message',
          []
        );
      }

      const pending = ModConsole.getPendingReports();
      expect(pending.length).toBe(3);
    });
  });

  // ========================================================================
  // M69 CHAT MODERATION TESTS (8)
  // ========================================================================

  describe('M69-PartB: Chat Moderation', () => {
    beforeEach(() => {
      ChatMod.initChatModeration();
    });

    test('Should initialize chat moderation', () => {
      const state = ChatMod.getChatModerationState();
      expect(state.profanityDictionary.size).toBeGreaterThan(0);
      expect(state.rtmKeywords.size).toBeGreaterThan(0);
    });

    test('Should filter profanity', () => {
      const message: ChatMod.ChatMessage = {
        id: 'msg_1',
        playerId: 'player_123',
        playerName: 'Player',
        channel: 'faction',
        content: 'this is so toxic and offensive',
        timestamp: Date.now(),
        factionId: 'faction_1',
      };

      const filtered = ChatMod.filterChatMessage(message);
      expect(filtered.violations.length).toBeGreaterThan(0);
      expect(filtered.violations.some((v) => v.type === 'profanity')).toBe(true);
    });

    test('Should detect RMT keywords', () => {
      const message: ChatMod.ChatMessage = {
        id: 'msg_2',
        playerId: 'player_456',
        playerName: 'Seller',
        channel: 'general',
        content: 'Selling items for real money. PayPal only!',
        timestamp: Date.now(),
      };

      const filtered = ChatMod.filterChatMessage(message);
      expect(filtered.violations.some((v) => v.type === 'rmt_keywords')).toBe(true);
      expect(filtered.action).toBe('escalate');
    });

    test('Should enforce rate limits', () => {
      let rateLimitCount = 0;
      for (let i = 0; i < 12; i++) {
        const ok = ChatMod.checkRateLimit('player_123', 'faction');
        if (!ok) rateLimitCount++;
      }
      expect(rateLimitCount).toBeGreaterThan(0);
    });

    test('Should detect caps spam', () => {
      const message: ChatMod.ChatMessage = {
        id: 'msg_3',
        playerId: 'player_789',
        playerName: 'Shouting',
        channel: 'general',
        content: 'AAAAAHHHHH THIS IS SO COOL!!!',
        timestamp: Date.now(),
      };

      const filtered = ChatMod.filterChatMessage(message);
      expect(filtered.violations.some((v) => v.type === 'caps_spam')).toBe(true);
    });

    test('Should handle trusted players', () => {
      ChatMod.trustPlayer('player_trusted');

      const message: ChatMod.ChatMessage = {
        id: 'msg_4',
        playerId: 'player_trusted',
        playerName: 'Trusted',
        channel: 'general',
        content: 'this toxic badword1 content',
        timestamp: Date.now(),
      };

      const filtered = ChatMod.filterChatMessage(message);
      expect(filtered.action).toBe('allow');
      expect(filtered.violations.length).toBe(0);
    });

    test('Should get flagged players', () => {
      for (let i = 0; i < 5; i++) {
        const message: ChatMod.ChatMessage = {
          id: `msg_${i}`,
          playerId: 'bad_player',
          playerName: 'Bad',
          channel: 'general',
          content: `toxic badword1 message ${i}`,
          timestamp: Date.now() + i * 1000,
        };
        ChatMod.filterChatMessage(message);
      }

      const flagged = ChatMod.getFlaggedPlayers();
      expect(flagged.some((f) => f.playerId === 'bad_player')).toBe(true);
    });

    test('Should get moderation dashboard summary', () => {
      const message: ChatMod.ChatMessage = {
        id: 'msg_escalate',
        playerId: 'player_bad',
        playerName: 'Bad',
        channel: 'general',
        content: 'Buying gold with paypal',
        timestamp: Date.now(),
      };

      ChatMod.filterChatMessage(message);

      const summary = ChatMod.getChatModerationSummary();
      expect(summary.escalationQueueSize).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // M69 PLAYER BEHAVIOR TRACKING TESTS (8)
  // ========================================================================

  describe('M69-PartC: Player Behavior Tracking', () => {
    beforeEach(() => {
      BehaviorTracking.initPlayerBehaviorTracking();
    });

    test('Should initialize behavior tracking', () => {
      const state = BehaviorTracking.getBehaviorTrackingState();
      expect(state.incidents.size).toBe(0);
      expect(state.playerProfiles.size).toBe(0);
    });

    test('Should record behavior incidents', () => {
      const incident = BehaviorTracking.recordBehaviorIncident(
        'player_123',
        'Griever',
        'griefing',
        'Sabotaged raid',
        'high',
        ['raid_log'],
        false,
        ['reporter_456']
      );

      expect(incident.id).toBeDefined();
      expect(incident.type).toBe('griefing');
    });

    test('Should calculate risk scores', () => {
      for (let i = 0; i < 3; i++) {
        BehaviorTracking.recordBehaviorIncident(
          'risky_player',
          'Risky',
          'exploiting',
          `Exploit ${i}`,
          'high',
          [],
          true
        );
      }

      const profile = BehaviorTracking.getPlayerBehaviorProfile('risky_player');
      expect(profile).not.toBeNull();
      expect(profile!.riskScore).toBeGreaterThan(0);
      expect(profile!.riskLevel).toBe('high');
    });

    test('Should get high risk players', () => {
      for (let i = 0; i < 5; i++) {
        BehaviorTracking.recordBehaviorIncident(
          'bad_player_1',
          'Bad',
          'rmt',
          'RMT',
          'high',
          [],
          true
        );
      }

      const highRisk = BehaviorTracking.getHighRiskPlayers();
      expect(highRisk.some((p) => p.playerId === 'bad_player_1')).toBe(true);
    });

    test('Should flag ledger anomalies', () => {
      const anomaly = BehaviorTracking.flagLedgerAnomaly(
        'player_exploit',
        'ledger_hash',
        'impossible_state',
        'Gold decreased',
        ['tx_1'],
        'critical'
      );

      expect(anomaly.id).toBeDefined();
      const anomalies = BehaviorTracking.getPlayerLedgerAnomalies('player_exploit');
      expect(anomalies.length).toBe(1);
    });

    test('Should record chargebacks', () => {
      const count1 = BehaviorTracking.recordChargeback('charger_1');
      const count2 = BehaviorTracking.recordChargeback('charger_1');

      expect(count1).toBe(1);
      expect(count2).toBe(2);

      const history = BehaviorTracking.getChargebackHistory('charger_1');
      expect(history?.count).toBe(2);
    });

    test('Should detect correlations', () => {
      BehaviorTracking.recordBehaviorIncident(
        'player_a',
        'PlayerA',
        'rmt',
        'RMT',
        'high',
        [],
        false,
        ['player_b']
      );

      BehaviorTracking.recordBehaviorIncident(
        'player_b',
        'PlayerB',
        'rmt',
        'RMT',
        'high',
        [],
        false,
        ['player_a']
      );

      const clusters = BehaviorTracking.getCorrelationClusters();
      expect(clusters.length).toBeGreaterThan(0);
    });

    test('Should get watchlist players', () => {
      for (let i = 0; i < 8; i++) {
        BehaviorTracking.recordBehaviorIncident(
          'watch_player',
          'Watched',
          'exploiting',
          `Exploit ${i}`,
          'high',
          [],
          true
        );
      }

      const watchlist = BehaviorTracking.getWatchlistPlayers();
      expect(watchlist.some((p) => p.playerId === 'watch_player')).toBe(true);
    });
  });

  // ========================================================================
  // M69 SUPPORT TICKETING TESTS (8)
  // ========================================================================

  describe('M69-PartD: Customer Support Ticketing', () => {
    beforeEach(() => {
      SupportTickets.initCustomerSupportTicketing();
    });

    test('Should initialize support ticketing', () => {
      const metrics = SupportTickets.getSupportDashboardMetrics();
      expect(metrics.totalTickets).toBe(0);
    });

    test('Should create support ticket', () => {
      const ticket = SupportTickets.createSupportTicket(
        'player_123',
        'Player_Name',
        'bug_report',
        'Game crashes',
        'Game crashes on login',
        []
      );

      expect(ticket.id).toBeDefined();
      expect(ticket.status).toBe('open');
      expect(ticket.assignedTeam).toBe('technical');
    });

    test('Should auto-route tickets', () => {
      const abuse = SupportTickets.createSupportTicket(
        'p1',
        'P1',
        'abuse_report',
        'Harassment',
        'Harassment report',
        []
      );

      const billing = SupportTickets.createSupportTicket(
        'p2',
        'P2',
        'payment_issue',
        'Payment failed',
        'Failed charge',
        []
      );

      expect(abuse.assignedTeam).toBe('moderation');
      expect(billing.assignedTeam).toBe('billing');
    });

    test('Should assign and track ticket status', () => {
      const ticket = SupportTickets.createSupportTicket(
        'p1',
        'P1',
        'bug_report',
        'Bug',
        'Bug description',
        []
      );

      SupportTickets.assignTicketToMember(ticket.id, 'agent_001');
      const updated = SupportTickets.getTicket(ticket.id);
      expect(updated?.status).toBe('in_progress');
    });

    test('Should resolve tickets', () => {
      const ticket = SupportTickets.createSupportTicket(
        'p1',
        'P1',
        'gameplay_question',
        'Question',
        'Game question',
        []
      );

      SupportTickets.resolveTicket(ticket.id, 'Here is the answer...');
      const updated = SupportTickets.getTicket(ticket.id);
      expect(updated?.status).toBe('resolved');
      expect(updated?.timeSpentMinutes).toBeGreaterThan(0);
    });

    test('Should handle ticket feedback', () => {
      const ticket = SupportTickets.createSupportTicket(
        'p1',
        'P1',
        'technical_support',
        'Help',
        'Help needed',
        []
      );

      SupportTickets.resolveTicket(ticket.id, 'Solution provided');
      SupportTickets.submitTicketFeedback(ticket.id, 'p1', 5, 'Very helpful!');

      const feedback = SupportTickets.getTicketFeedback(ticket.id);
      expect(feedback?.rating).toBe(5);
    });

    test('Should track SLA compliance', () => {
      const ticket = SupportTickets.createSupportTicket(
        'p1',
        'P1',
        'payment_issue',
        'Payment',
        'Cannot process',
        []
      );

      const compliance = SupportTickets.checkSLACompliance(ticket.id);
      expect(compliance).not.toBeNull();
      expect(compliance!.compliant).toBe(true);
    });

    test('Should get dashboard metrics', () => {
      for (let i = 0; i < 10; i++) {
        const ticket = SupportTickets.createSupportTicket(
          `p${i}`,
          `Player${i}`,
          'bug_report',
          `Bug ${i}`,
          `Description`,
          []
        );

        if (i % 2 === 0) {
          SupportTickets.resolveTicket(ticket.id, 'Fixed');
        }
      }

      const metrics = SupportTickets.getSupportDashboardMetrics();
      expect(metrics.totalTickets).toBe(10);
      expect(metrics.openTickets).toBe(5);
    });
  });

  // ========================================================================
  // M69 INTEGRATION TESTS (5)
  // ========================================================================

  describe('M69: Integration Scenarios', () => {
    beforeEach(() => {
      ModConsole.initModeratorConsole();
      ChatMod.initChatModeration();
      BehaviorTracking.initPlayerBehaviorTracking();
      SupportTickets.initCustomerSupportTicketing();
    });

    test('Should flow: Chat violation -> Report -> Moderation', () => {
      const msg: ChatMod.ChatMessage = {
        id: 'msg_1',
        playerId: 'toxic',
        playerName: 'Toxic',
        channel: 'faction',
        content: 'toxic badword1',
        timestamp: Date.now(),
      };

      const filtered = ChatMod.filterChatMessage(msg);
      expect(filtered.violations.length).toBeGreaterThan(0);

      const report = ModConsole.submitPlayerReport(
        'toxic',
        'Toxic',
        'witness',
        'Witness',
        'toxicity',
        'Toxic message',
        []
      );

      const action = ModConsole.createModerationAction(
        'toxic',
        'Toxic',
        'mute',
        'toxicity',
        'high',
        'Mute',
        'mod_001',
        24 * 60 * 60 * 1000
      );

      ModConsole.approveModerationAction(action.id, 'mod_001');
      expect(ModConsole.isPlayerSuspended('toxic')).not.toBeNull();
    });

    test('Should track RMT ring across platforms', () => {
      BehaviorTracking.recordBehaviorIncident('seller_1', 'S1', 'rmt', 'RMT', 'high', [], false, ['buyer_1']);
      BehaviorTracking.recordBehaviorIncident('seller_2', 'S2', 'rmt', 'RMT', 'high', [], false, ['buyer_1']);

      const clusters = BehaviorTracking.getCorrelationClusters();
      expect(clusters.length).toBeGreaterThan(0);
    });

    test('Should create support ticket from behavior incident', () => {
      const ticket = SupportTickets.createSupportTicket(
        'player',
        'Player',
        'bug_report',
        'Lost items',
        'Items disappeared',
        []
      );

      BehaviorTracking.recordBehaviorIncident(
        'player_x',
        'PlayerX',
        'fraud',
        'Trade scam',
        'high',
        [ticket.id],
        false
      );

      expect(BehaviorTracking.getPlayerBehaviorProfile('player_x')).not.toBeNull();
    });

    test('Should escalate aging support tickets', () => {
      for (let i = 0; i < 3; i++) {
        SupportTickets.createSupportTicket(`p${i}`, `P${i}`, 'bug_report', `Bug`, `Desc`, []);
      }

      const backlog = SupportTickets.getBacklogTickets();
      expect(backlog.length).toBe(3);
    });

    test('Should track comprehensive moderation metrics', () => {
      for (let i = 0; i < 5; i++) {
        const action = ModConsole.createModerationAction(
          `p${i}`,
          `P${i}`,
          i % 2 === 0 ? 'mute' : 'kick',
          'spam',
          'high',
          'Action',
          'mod_sys'
        );
        ModConsole.approveModerationAction(action.id, `mod_${i}`);
      }

      const stats = ModConsole.getModerationStats();
      expect(stats.totalActions).toBe(5);
      expect(stats.topModerators).toBeDefined();
    });
  });
});
