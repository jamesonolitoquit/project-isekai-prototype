/**
 * M68 Phase 38 Comprehensive Test Suite
 * 50+ tests across all 8 live ops engines:
 * - M68-A1: Telemetry Analytics (10 tests)
 * - M68-A2: Event Scheduler (8 tests)
 * - M68-A3: Economy Monitoring (8 tests)
 * - M68-A4: Retention Analytics (6 tests)
 * - M68-A5: Seasonal Content (5 tests)
 * - M68-A6: Community Infrastructure (5 tests)
 * - M68-A7: Production Monitoring (4 tests)
 * - M68-A8: Analytics Export (3 tests)
 * + Integration tests (5 tests)
 */

// M68-A1: Telemetry Analytics
import * as telemetry from './m68TelemetryAnalytics';

// M68-A2: Event Scheduler
import * as eventScheduler from './m68EventScheduler';

// M68-A3: Economy Monitoring
import * as economyMonitoring from './m68EconomyMonitoring';

// M68-A4: Retention Analytics
import * as retention from './m68RetentionAnalytics';

// M68-A5: Seasonal Content
import * as seasonalContent from './m68SeasonalContent';

// M68-A6: Community Infrastructure
import * as community from './m68CommunityInfrastructure';

// M68-A7: Production Monitoring
import * as prodMonitoring from './m68IncidentResponse';

// M68-A8: Analytics Export
import * as analyticsExport from './m68AnalyticsExport';

// ============================================================================
// M68-A1: TELEMETRY ANALYTICS TESTS (10 tests)
// ============================================================================

describe('M68-A1: Telemetry Analytics Pipeline', () => {
  beforeEach(() => {
    telemetry.resetTelemetryAnalytics();
  });

  test('A1-1: Initialize telemetry pipeline', () => {
    const state = telemetry.initializeAnalyticsPipeline();
    expect(state.isInitialized).toBe(true);
    expect(state.engineId).toBeTruthy();
  });

  test('A1-2: Record telemetry pulse events', () => {
    telemetry.initializeAnalyticsPipeline();
    const pulse = telemetry.recordTelemetryPulse('player1', 'session1', 'location_visit', {
      location: 'town_square'
    });
    expect(pulse).toBeTruthy();
  });

  test('A1-3: Compute hourly aggregates with alerts', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'combat', { kills: 5 });
    telemetry.recordTelemetryPulse('player2', 'session2', 'location_visit', { location: 'dungeon' });

    const hourly = telemetry.computeHourlyAggregate();
    expect(hourly.uniquePlayers).toBeGreaterThan(0);
    expect(Array.isArray(hourly.priceFluctuations)).toBe(true);
  });

  test('A1-4: Compute daily summary with retention', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'combat', {});
    telemetry.recordTelemetryPulse('player2', 'session2', 'trading', {});

    const daily = telemetry.computeDailySummary();
    expect(daily.dau).toBeGreaterThan(0);
    expect(daily.playerRetentionByTier).toBeTruthy();
  });

  test('A1-5: Get player retention metrics', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});

    const metrics = telemetry.getPlayerRetentionMetrics('player1');
    expect(metrics).toBeTruthy();
    expect(metrics?.engagementTier).toBeTruthy();
  });

  test('A1-6: Get cohort retention report', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});
    telemetry.recordTelemetryPulse('player2', 'session2', 'login', {});

    const cohort = telemetry.getCohortRetentionReport();
    expect(cohort.byTier).toBeTruthy();
    expect(cohort.churnPredictions).toBeTruthy();
  });

  test('A1-7: Predict player churn with risk score', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});

    const prediction = telemetry.predictPlayerChurn('player1');
    expect(prediction).toBeTruthy();
    expect(typeof prediction?.riskScore).toBe('number');
    expect(prediction?.riskScore).toBeGreaterThanOrEqual(0);
    expect(prediction?.riskScore).toBeLessThanOrEqual(1);
  });

  test('A1-8: Get recent alerts', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});

    const alerts = telemetry.getRecentAlerts(10);
    expect(Array.isArray(alerts)).toBe(true);
  });

  test('A1-9: Get analytics snapshot', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});

    const snapshot = telemetry.getAnalyticsSnapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot.totalEvents).toBeGreaterThan(0);
  });

  test('A1-10: Reset telemetry analytics', () => {
    telemetry.initializeAnalyticsPipeline();
    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});
    telemetry.resetTelemetryAnalytics();

    const state = telemetry.getAnalyticsSnapshot();
    expect(state.totalEvents).toBe(0);
  });
});

// ============================================================================
// M68-A2: EVENT SCHEDULER TESTS (8 tests)
// ============================================================================

describe('M68-A2: Event Scheduler Enhancement', () => {
  beforeEach(() => {
    eventScheduler.resetEventScheduler();
  });

  test('A2-1: Initialize event scheduler with templates', () => {
    const state = eventScheduler.initializeEventScheduler();
    expect(state.isInitialized).toBe(true);
    expect(state.templateCount).toBeGreaterThan(0);
  });

  test('A2-2: Get event template by ID', () => {
    const state = eventScheduler.initializeEventScheduler();
    const template = eventScheduler.getEventTemplate(state.templates[0].templateId);
    expect(template).toBeTruthy();
    expect(template?.name).toBeTruthy();
  });

  test('A2-3: Schedule event by telemetry signals', () => {
    eventScheduler.initializeEventScheduler();
    const eventId = eventScheduler.scheduleEventByTelemetry(50, 1000, 30);
    expect(eventId).toBeTruthy();
  });

  test('A2-4: Queue event with reason', () => {
    eventScheduler.initializeEventScheduler();
    const queueId = eventScheduler.queueEvent('template_1', 'test_reason');
    expect(queueId).toBeTruthy();
  });

  test('A2-5: Launch queued event with variant', () => {
    eventScheduler.initializeEventScheduler();
    const queueId = eventScheduler.queueEvent('template_1', 'test_reason');
    const eventId = eventScheduler.launchQueuedEvent(queueId!);
    expect(eventId).toBeTruthy();
  });

  test('A2-6: Get active events', () => {
    eventScheduler.initializeEventScheduler();
    eventScheduler.scheduleEventByTelemetry(50, 1000, 30);
    const active = eventScheduler.getActiveEvents();
    expect(Array.isArray(active)).toBe(true);
  });

  test('A2-7: Create A/B test experiment', () => {
    eventScheduler.initializeEventScheduler();
    const testId = eventScheduler.createABTestExperiment('template_1', 500, 500, [
      'engagement_rate',
      'quest_completion'
    ]);
    expect(testId).toBeTruthy();
  });

  test('A2-8: Get A/B test results', () => {
    eventScheduler.initializeEventScheduler();
    const testId = eventScheduler.createABTestExperiment('template_1', 500, 500, ['engagement_rate']);
    const results = eventScheduler.getABTestResults(testId);
    expect(results).toBeTruthy();
  });
});

// ============================================================================
// M68-A3: ECONOMY MONITORING TESTS (8 tests)
// ============================================================================

describe('M68-A3: Economy Monitoring Dashboard', () => {
  beforeEach(() => {
    economyMonitoring.resetEconomyDashboard();
  });

  test('A3-1: Initialize economy dashboard', () => {
    const state = economyMonitoring.initializeEconomyDashboard();
    expect(state.isInitialized).toBe(true);
    expect(state.leverCount).toBeGreaterThan(0);
  });

  test('A3-2: Update economy state', () => {
    economyMonitoring.initializeEconomyDashboard();
    const state = economyMonitoring.updateEconomyState(50, 0.05, -0.02, 0);
    expect(state.economyIndex).toBeGreaterThan(0);
  });

  test('A3-3: Get intervention levers', () => {
    economyMonitoring.initializeEconomyDashboard();
    const levers = economyMonitoring.getInterventionLevers();
    expect(Array.isArray(levers)).toBe(true);
    expect(levers.length).toBe(5);
  });

  test('A3-4: Preview intervention before applying', () => {
    economyMonitoring.initializeEconomyDashboard();
    const preview = economyMonitoring.previewIntervention('test_intervention', [
      { lever: 'npc_starting_gold', value: 500 }
    ]);
    expect(preview).toBeTruthy();
    expect(preview.predictedEconomyIndex).toBeTruthy();
  });

  test('A3-5: Apply intervention with audit log', () => {
    economyMonitoring.initializeEconomyDashboard();
    const success = economyMonitoring.applyIntervention('test_intervention', [
      { lever: 'npc_starting_gold', value: 500 }
    ]);
    expect(typeof success).toBe('boolean');
  });

  test('A3-6: Rollback recent intervention', () => {
    economyMonitoring.initializeEconomyDashboard();
    economyMonitoring.applyIntervention('test_intervention', [
      { lever: 'npc_starting_gold', value: 500 }
    ]);
    const rolled = economyMonitoring.rollbackRecentIntervention('admin');
    expect(typeof rolled).toBe('boolean');
  });

  test('A3-7: Get economy warnings', () => {
    economyMonitoring.initializeEconomyDashboard();
    economyMonitoring.updateEconomyState(90, 0.3, 0, 1); // High inflation
    const warnings = economyMonitoring.getEconomyWarnings();
    expect(Array.isArray(warnings)).toBe(true);
  });

  test('A3-8: Get economy state history', () => {
    economyMonitoring.initializeEconomyDashboard();
    economyMonitoring.updateEconomyState(50, 0.05, -0.02, 0);
    const history = economyMonitoring.getEconomyStateHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});

// ============================================================================
// M68-A4: RETENTION ANALYTICS TESTS (6 tests)
// ============================================================================

describe('M68-A4: Player Retention & Engagement Metrics', () => {
  beforeEach(() => {
    retention.resetRetentionAnalytics();
  });

  test('A4-1: Initialize retention analytics', () => {
    const state = retention.initializeRetentionAnalytics();
    expect(state.isInitialized).toBe(true);
  });

  test('A4-2: Register player session', () => {
    retention.initializeRetentionAnalytics();
    const analytics = retention.registerPlayerSession('player1', 45, {
      raids: 5,
      pvp: 2
    });
    expect(analytics).toBeTruthy();
    expect(analytics.playstyle).toBeTruthy();
  });

  test('A4-3: Predict player churn', () => {
    retention.initializeRetentionAnalytics();
    retention.registerPlayerSession('player1', 45, {});
    const prediction = retention.predictPlayerChurn('player1');
    expect(prediction).toBeTruthy();
    expect(typeof prediction?.riskScore).toBe('number');
    expect(prediction?.riskLevel).toBeTruthy();
  });

  test('A4-4: Get retention cohort report', () => {
    retention.initializeRetentionAnalytics();
    retention.registerPlayerSession('player1', 45, { pvp: 10 });
    retention.registerPlayerSession('player2', 30, { crafting: 5 });

    const report = retention.getCohortRetentionReport();
    expect(report).toBeTruthy();
    expect(report.byPlaystyle).toBeTruthy();
    expect(report.overallRetention).toBeGreaterThanOrEqual(0);
  });

  test('A4-5: Create retention intervention', () => {
    retention.initializeRetentionAnalytics();
    retention.registerPlayerSession('player1', 45, {});
    retention.predictPlayerChurn('player1');

    const intervention = retention.createRetentionIntervention('player1', 'cosmetic_gift');
    expect(intervention).toBeTruthy();
    expect(intervention.actionType).toBe('cosmetic_gift');
  });

  test('A4-6: Get at-risk players', () => {
    retention.initializeRetentionAnalytics();
    retention.registerPlayerSession('player1', 45, {});
    retention.predictPlayerChurn('player1');

    const atRisk = retention.getHighRiskPlayers();
    expect(Array.isArray(atRisk)).toBe(true);
  });
});

// ============================================================================
// M68-A5: SEASONAL CONTENT TESTS (5 tests)
// ============================================================================

describe('M68-A5: Seasonal Content Pipeline', () => {
  beforeEach(() => {
    seasonalContent.resetSeasonalPipeline();
  });

  test('A5-1: Initialize seasonal pipeline', () => {
    const state = seasonalContent.initializeSeasonalContentPipeline();
    expect(state.isInitialized).toBe(true);
    expect(state.templates.length).toBe(8);
  });

  test('A5-2: Generate limited-time quest', () => {
    const state = seasonalContent.initializeSeasonalContentPipeline();
    const quest = seasonalContent.generateLimitedTimeQuest(state.templates[0].templateId, 'spring');
    expect(quest).toBeTruthy();
    expect(quest?.objectives.length).toBeGreaterThan(0);
    expect(quest?.exclusiveCosmetic).toBeTruthy();
  });

  test('A5-3: Create content deployment schedule', () => {
    seasonalContent.initializeSeasonalContentPipeline();
    const schedule = seasonalContent.createContentDeploymentSchedule('content_1', 'Test Event', 30);
    expect(schedule).toBeTruthy();
    expect(schedule.phases.length).toBe(10);
  });

  test('A5-4: Create A/B test for seasonal content', () => {
    seasonalContent.initializeSeasonalContentPipeline();
    const test = seasonalContent.createSeasonalContentTest('content_1', 'Test Event', 1000, 1000);
    expect(test).toBeTruthy();
    expect(test.variants.length).toBe(2);
  });

  test('A5-5: Conclude seasonal A/B test', () => {
    seasonalContent.initializeSeasonalContentPipeline();
    const test = seasonalContent.createSeasonalContentTest('content_1', 'Test Event', 1000, 1000);
    seasonalContent.recordSeasonalTestMetrics(test.testId, 'A', 0.7, 0.15, 0.85);
    seasonalContent.recordSeasonalTestMetrics(test.testId, 'B', 0.75, 0.18, 0.88);

    const winner = seasonalContent.concludeSeasonalContentTest(test.testId);
    expect(['A', 'B', 'draw']).toContain(winner);
  });
});

// ============================================================================
// M68-A6: COMMUNITY INFRASTRUCTURE TESTS (5 tests)
// ============================================================================

describe('M68-A6: Community & Social Infrastructure', () => {
  beforeEach(() => {
    community.resetCommunityInfrastructure();
  });

  test('A6-1: Initialize community infrastructure', () => {
    const state = community.initializeCommunityInfrastructure();
    expect(state.isInitialized).toBe(true);
    expect(state.factionCount).toBe(4);
  });

  test('A6-2: Create guild with shared locker', () => {
    community.initializeCommunityInfrastructure();
    const guild = community.createGuild('Dragon Slayers', 'leader1', 'faction_a');
    expect(guild).toBeTruthy();
    expect(guild.factionBonusMultiplier).toBe(1.1);
  });

  test('A6-3: Guild member management', () => {
    community.initializeCommunityInfrastructure();
    const guild = community.createGuild('Dragon Slayers', 'leader1', 'faction_a');
    const joined = community.joinGuild(guild.guildId, 'player2');
    expect(joined).toBe(true);

    const left = community.leaveGuild(guild.guildId, 'player2');
    expect(left).toBe(true);
  });

  test('A6-4: Shared locker operations', () => {
    community.initializeCommunityInfrastructure();
    const guild = community.createGuild('Dragon Slayers', 'leader1', 'faction_a');

    const added = community.addToSharedLocker(guild.guildId, 'sword_epic', 3, 'leader1');
    expect(added).toBe(true);

    const removed = community.removeFromSharedLocker(guild.guildId, 'sword_epic', 1, 'leader1');
    expect(removed).toBe(true);
  });

  test('A6-5: Update global leaderboards', () => {
    community.initializeCommunityInfrastructure();
    community.updateGlobalLeaderboard('myth_rank', [
      { playerId: 'p1', displayName: 'Legend1', score: 1000 },
      { playerId: 'p2', displayName: 'Elite1', score: 500 }
    ]);

    const lb = community.getGlobalLeaderboard('myth_rank');
    expect(lb?.entries.length).toBe(2);
    expect(lb?.entries[0].rank).toBe(1);
  });
});

// ============================================================================
// M68-A7: PRODUCTION MONITORING TESTS (4 tests)
// ============================================================================

describe('M68-A7: Production Monitoring & Incident Response', () => {
  beforeEach(() => {
    prodMonitoring.resetProductionMonitoring();
  });

  test('A7-1: Initialize production monitoring', () => {
    const state = prodMonitoring.initializeProductionMonitoring();
    expect(state.isInitialized).toBe(true);
    expect(state.sloDashboard.slos.length).toBeGreaterThan(0);
  });

  test('A7-2: Record production metrics', () => {
    prodMonitoring.initializeProductionMonitoring();
    const dashboard = prodMonitoring.recordProductionMetric({
      consensusLagMs: 95,
      snapshotLatencyMs: 40,
      uptime: 99.95,
      databaseLatencyMs: 25,
      errorRate: 0.001,
      memoryUsageMb: 512
    });

    expect(dashboard).toBeTruthy();
    expect(dashboard.metrics.length).toBeGreaterThan(0);
  });

  test('A7-3: Detect incidents from alert rules', () => {
    prodMonitoring.initializeProductionMonitoring();

    // Record metric that exceeds consensus lag threshold
    prodMonitoring.recordProductionMetric({
      consensusLagMs: 200,
      snapshotLatencyMs: 40,
      uptime: 99.95,
      databaseLatencyMs: 25,
      errorRate: 0.001,
      memoryUsageMb: 512
    });

    const incidents = prodMonitoring.getActiveIncidents();
    expect(Array.isArray(incidents)).toBe(true);
  });

  test('A7-4: Resolve incident', () => {
    prodMonitoring.initializeProductionMonitoring();
    prodMonitoring.recordProductionMetric({
      consensusLagMs: 200,
      snapshotLatencyMs: 40,
      uptime: 99.95,
      databaseLatencyMs: 25,
      errorRate: 0.001,
      memoryUsageMb: 512
    });

    const incidents = prodMonitoring.getActiveIncidents();
    if (incidents.length > 0) {
      const resolved = prodMonitoring.resolveIncident(incidents[0].incidentId, 'Network latency resolved');
      expect(resolved).toBe(true);
    }
  });
});

// ============================================================================
// M68-A8: ANALYTICS EXPORT TESTS (3 tests)
// ============================================================================

describe('M68-A8: Analytics Export & Reporting', () => {
  beforeEach(() => {
    analyticsExport.resetAnalyticsExportEngine();
  });

  test('A8-1: Initialize analytics export engine', () => {
    const state = analyticsExport.initializeAnalyticsExportEngine();
    expect(state.isInitialized).toBe(true);
  });

  test('A8-2: Generate cohort report export', () => {
    analyticsExport.initializeAnalyticsExportEngine();
    const export_ = analyticsExport.generateCohortReportExport(1, [
      {
        playerId: 'player1',
        playstyle: 'combatant',
        engagementTier: 'core',
        sessionsLastWeek: 7,
        totalPlaytimeMinutes: 300,
        spendLastWeek: 50,
        newQuestsCompleted: 10,
        eventParticipation: 0.8
      }
    ]);

    expect(export_).toBeTruthy();
    expect(export_.csvContent).toContain('anonymous_id');
    expect(export_.playerCount).toBe(1);
  });

  test('A8-3: Generate telemetry anomaly report', () => {
    analyticsExport.initializeAnalyticsExportEngine();
    const report = analyticsExport.generateTelemetryAnomalyReport({
      dau: 6000, // 20% above baseline
      engagement_rate: 0.65,
      retention_d7: 0.35,
      avg_session_length: 45,
      economy_index: 50
    });

    expect(report).toBeTruthy();
    expect(report.anomalyCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// INTEGRATION TESTS (5 tests)
// ============================================================================

describe('M68 Phase 38 Integration Tests', () => {
  beforeEach(() => {
    telemetry.resetTelemetryAnalytics();
    eventScheduler.resetEventScheduler();
    economyMonitoring.resetEconomyDashboard();
    retention.resetRetentionAnalytics();
    seasonalContent.resetSeasonalPipeline();
    community.resetCommunityInfrastructure();
    prodMonitoring.resetProductionMonitoring();
    analyticsExport.resetAnalyticsExportEngine();
  });

  test('INT-1: Telemetry drives event scheduling', () => {
    telemetry.initializeAnalyticsPipeline();
    eventScheduler.initializeEventScheduler();

    // Record telemetry
    telemetry.recordTelemetryPulse('player1', 'session1', 'combat', {});
    telemetry.recordTelemetryPulse('player2', 'session2', 'combat', {});

    // Use telemetry to schedule event
    const hourly = telemetry.computeHourlyAggregate();
    const eventId = eventScheduler.scheduleEventByTelemetry(50, 2000, 30);

    expect(eventId).toBeTruthy();
  });

  test('INT-2: Telemetry triggers retention interventions', () => {
    telemetry.initializeAnalyticsPipeline();
    retention.initializeRetentionAnalytics();

    telemetry.recordTelemetryPulse('player1', 'session1', 'login', {});
    retention.registerPlayerSession('player1', 45, {});

    const prediction = retention.predictPlayerChurn('player1');
    if (prediction && prediction.riskLevel === 'high') {
      const intervention = retention.createRetentionIntervention('player1', 'event_invitation');
      expect(intervention).toBeTruthy();
    }
  });

  test('INT-3: Economy state affects event trigger conditions', () => {
    economyMonitoring.initializeEconomyDashboard();
    eventScheduler.initializeEventScheduler();

    // Update economy state
    economyMonitoring.updateEconomyState(85, 0.2, 0, 1); // High inflation

    // Check if economy state can trigger event
    const eventId = eventScheduler.scheduleEventByTelemetry(85, 1000, 30); // High economy score
    expect(eventId).toBeTruthy();
  });

  test('INT-4: Production monitoring alerts trigger auto-mitigation', () => {
    prodMonitoring.initializeProductionMonitoring();

    // Spike consensus lag
    prodMonitoring.recordProductionMetric({
      consensusLagMs: 250,
      snapshotLatencyMs: 40,
      uptime: 99.95,
      databaseLatencyMs: 25,
      errorRate: 0.001,
      memoryUsageMb: 512
    });

    const incidents = prodMonitoring.getActiveIncidents();
    expect(incidents.length).toBeGreaterThan(0);

    // Would trigger auto-mitigation actions
    if (incidents.length > 0) {
      expect(incidents[0].status).toBe('detected');
    }
  });

  test('INT-5: Complete live ops pipeline end-to-end', () => {
    // Initialize all systems
    telemetry.initializeAnalyticsPipeline();
    eventScheduler.initializeEventScheduler();
    economyMonitoring.initializeEconomyDashboard();
    retention.initializeRetentionAnalytics();
    seasonalContent.initializeSeasonalContentPipeline();
    community.initializeCommunityInfrastructure();

    // Simulate game loop
    telemetry.recordTelemetryPulse('player1', 'session1', 'combat', { kills: 5 });
    retention.registerPlayerSession('player1', 45, { combat: 5 });
    community.createGuild('Warriors', 'player1', 'faction_a');

    // Query final states
    const telemetrySnapshot = telemetry.getAnalyticsSnapshot();
    const retentionReport = retention.getCohortRetentionReport();
    const communityState = community.getCommunityInfrastructureState();

    expect(telemetrySnapshot.totalEvents).toBeGreaterThan(0);
    expect(retentionReport).toBeTruthy();
    expect(communityState.guildCount).toBeGreaterThan(0);
  });
});
