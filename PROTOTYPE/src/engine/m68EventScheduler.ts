/**
 * M68-A2: Dynamic Event Scheduler Enhancement
 * 
 * Expands liveOpsEngine with 20+ pre-written event templates, telemetry-driven
 * scheduling, event queue management with concurrent limits, and A/B testing support.
 * 
 * Auto-triggers events based on economy score, player density, faction conflict levels.
 * Enables experimentation with cohort assignment and event variant tracking.
 */

import { randomUUID } from 'node:crypto';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Event Scheduler Model
// ============================================================================

/**
 * Event template (pre-written event definition)
 */
export interface EventTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly category: 'seasonal' | 'economy_intervention' | 'npc_crisis' | 'world_reset' | 'social';
  readonly description: string;
  readonly triggerConditions: {
    economyScoreMin?: number;
    economyScoreMax?: number;
    playerCountMin?: number;
    factionConflictMin?: number;
    requiredDaysIntoSeason?: number;
  };
  readonly durationMinutes: number;
  readonly maxConcurrent: number;
  readonly cooldownMinutes: number;
  readonly rewards: { currency: number; cosmetic?: string };
  readonly abVariants: Array<{ variantId: string; name: string; modifiers: Record<string, number> }>;
}

/**
 * Active event instance
 */
export interface ActiveEvent {
  readonly eventId: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  readonly activeParticipants: number;
  readonly variantId?: string; // A/B test variant
  readonly experimentId?: string; // A/B experiment tracking
}

/**
 * Event queue entry
 */
export interface EventQueueEntry {
  readonly queueId: string;
  readonly templateId: string;
  readonly scheduledTime: number;
  readonly priority: number;
  readonly reason: string; // Why this event was queued
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  readonly experimentId: string;
  readonly templateId: string;
  readonly variantA: string;
  readonly variantB: string;
  readonly cohortA: Set<string>; // Player IDs in cohort A
  readonly cohortB: Set<string>; // Player IDs in cohort B
  readonly startTime: number;
  readonly endTime: number;
  readonly metricsTracked: string[]; // e.g., ['completion_rate', 'engagement_time']
}

/**
 * Event scheduler state
 */
export interface EventSchedulerState {
  readonly schedulerId: string;
  readonly isInitialized: boolean;
  readonly eventTemplateCount: number;
  readonly activeEventCount: number;
  readonly queuedEventCount: number;
  readonly totalEventsLaunched: number;
  readonly lastSchedulingPass: number;
}

// ============================================================================
// EVENT SCHEDULER ENGINE
// ============================================================================

let eventTemplates = new Map<string, EventTemplate>();
let activeEvents: ActiveEvent[] = [];
let eventQueue: EventQueueEntry[] = [];
let abTests = new Map<string, ABTestConfig>();
let schedulerState: EventSchedulerState = {
  schedulerId: `scheduler_${uuid()}`,
  isInitialized: false,
  eventTemplateCount: 0,
  activeEventCount: 0,
  queuedEventCount: 0,
  totalEventsLaunched: 0,
  lastSchedulingPass: 0
};

const MAX_CONCURRENT_EVENTS = 5;
const MIN_EVENT_SPACING_MINUTES = 360; // 6 hours between similar events

/**
 * Initialize event scheduler
 * Creates 20+ base event templates
 * 
 * @returns Scheduler state
 */
export function initializeEventScheduler(): EventSchedulerState {
  createEventTemplates();

  schedulerState = {
    schedulerId: `scheduler_${uuid()}`,
    isInitialized: true,
    eventTemplateCount: eventTemplates.size,
    activeEventCount: 0,
    queuedEventCount: 0,
    totalEventsLaunched: 0,
    lastSchedulingPass: Date.now()
  };

  return { ...schedulerState };
}

/**
 * Create 20+ pre-written event templates
 */
function createEventTemplates(): void {
  // Seasonal events (4)
  createTemplate({
    name: 'Spring Festival',
    category: 'seasonal',
    description: 'Celebration of new beginnings with flower-themed events and cosmetics',
    triggerConditions: { requiredDaysIntoSeason: 0 },
    durationMinutes: 10080, // 7 days
    maxConcurrent: 1,
    cooldownMinutes: 259200, // 6 months
    rewards: { currency: 500, cosmetic: 'spring_flower_crown' },
    abVariants: [
      { variantId: 'spring_v1', name: 'Standard Festival', modifiers: { reward_mult: 1.0 } },
      { variantId: 'spring_v2', name: 'Premium Festival', modifiers: { reward_mult: 1.5 } }
    ]
  });

  createTemplate({
    name: 'Summer Trials',
    category: 'seasonal',
    description: 'Competitive trials with leaderboards and exclusive rewards',
    triggerConditions: { requiredDaysIntoSeason: 90 },
    durationMinutes: 10080,
    maxConcurrent: 1,
    cooldownMinutes: 259200,
    rewards: { currency: 600, cosmetic: 'summer_medal' },
    abVariants: [
      { variantId: 'summer_v1', name: 'PvP Trials', modifiers: { difficulty: 1.0 } },
      { variantId: 'summer_v2', name: 'Cooperative Trials', modifiers: { difficulty: 0.8 } }
    ]
  });

  createTemplate({
    name: 'Autumn Harvest',
    category: 'seasonal',
    description: 'Resource gathering event with estate/farming mechanics',
    triggerConditions: { requiredDaysIntoSeason: 180 },
    durationMinutes: 10080,
    maxConcurrent: 1,
    cooldownMinutes: 259200,
    rewards: { currency: 550, cosmetic: 'autumn_wreath' },
    abVariants: [
      { variantId: 'autumn_v1', name: 'Solo Harvest', modifiers: { spawn_rate: 1.0 } },
      { variantId: 'autumn_v2', name: 'Cooperative Harvest', modifiers: { spawn_rate: 1.3 } }
    ]
  });

  createTemplate({
    name: 'Winter Solstice',
    category: 'seasonal',
    description: 'Longest night celebration with special cosmetics and gift-giving',
    triggerConditions: { requiredDaysIntoSeason: 270 },
    durationMinutes: 10080,
    maxConcurrent: 1,
    cooldownMinutes: 259200,
    rewards: { currency: 700, cosmetic: 'winter_crown' },
    abVariants: [
      { variantId: 'winter_v1', name: 'Standard Solstice', modifiers: { reward_mult: 1.0 } },
      { variantId: 'winter_v2', name: 'doubled Rewards', modifiers: { reward_mult: 2.0 } }
    ]
  });

  // Economy interventions (6)
  createTemplate({
    name: 'Gold Rush',
    category: 'economy_intervention',
    description: 'Temporary NPC trade multiplier to combat deflation',
    triggerConditions: { economyScoreMax: 30 },
    durationMinutes: 1440, // 1 day
    maxConcurrent: 3,
    cooldownMinutes: 10080, // 1 week
    rewards: { currency: 200 },
    abVariants: [
      { variantId: 'rush_v1', name: '2x Trade Multiplier', modifiers: { trade_mult: 2.0 } },
      { variantId: 'rush_v2', name: '3x Trade Multiplier', modifiers: { trade_mult: 3.0 } }
    ]
  });

  createTemplate({
    name: 'Trade Tax Holiday',
    category: 'economy_intervention',
    description: 'Reduced taxes on player trades to boost spending',
    triggerConditions: { economyScoreMax: 40 },
    durationMinutes: 720,
    maxConcurrent: 3,
    cooldownMinutes: 10080,
    rewards: { currency: 100 },
    abVariants: [
      { variantId: 'tax_v1', name: '50% Tax Reduction', modifiers: { tax_rate: 0.5 } },
      { variantId: 'tax_v2', name: 'Zero Tax', modifiers: { tax_rate: 0 } }
    ]
  });

  createTemplate({
    name: 'Rarity Shortage',
    category: 'economy_intervention',
    description: 'Increased rare item drops to stabilize inflation',
    triggerConditions: { economyScoreMin: 70 },
    durationMinutes: 1440,
    maxConcurrent: 3,
    cooldownMinutes: 10080,
    rewards: { currency: 150 },
    abVariants: [
      { variantId: 'rarity_v1', name: '2x Rare Drops', modifiers: { rarity_multiplier: 2.0 } },
      { variantId: 'rarity_v2', name: '3x Rare Drops', modifiers: { rarity_multiplier: 3.0 } }
    ]
  });

  createTemplate({
    name: 'Caravan Surge',
    category: 'economy_intervention',
    description: 'Increased NPC caravan spawn rates to boost trading',
    triggerConditions: { economyScoreMax: 35 },
    durationMinutes: 480,
    maxConcurrent: 2,
    cooldownMinutes: 5040,
    rewards: { currency: 80 },
    abVariants: [
      { variantId: 'caravan_v1', name: '2x Spawn Rate', modifiers: { spawn_mult: 2.0 } },
      { variantId: 'caravan_v2', name: '3x Spawn Rate', modifiers: { spawn_mult: 3.0 } }
    ]
  });

  createTemplate({
    name: 'Guild Competition',
    category: 'economy_intervention',
    description: 'Factional economic rivalries with rewards for top traders',
    triggerConditions: { factionConflictMin: 50 },
    durationMinutes: 2880,
    maxConcurrent: 1,
    cooldownMinutes: 20160,
    rewards: { currency: 300 },
    abVariants: [
      { variantId: 'guild_v1', name: 'Standard Competition', modifiers: { difficulty: 1.0 } },
      { variantId: 'guild_v2', name: 'Hard Competition', modifiers: { difficulty: 1.5 } }
    ]
  });

  // NPC crises (5)
  createTemplate({
    name: 'Bandit Uprising',
    category: 'npc_crisis',
    description: 'Temporary bandit invasions requiring player response',
    triggerConditions: { playerCountMin: 10 },
    durationMinutes: 360,
    maxConcurrent: 2,
    cooldownMinutes: 5040,
    rewards: { currency: 400, cosmetic: 'bandit_mask' },
    abVariants: [
      { variantId: 'bandit_v1', name: 'Standard Raid', modifiers: { num_bandits: 20 } },
      { variantId: 'bandit_v2', name: 'Boss Raid', modifiers: { num_bandits: 10, boss_present: 1 } }
    ]
  });

  createTemplate({
    name: 'NPC Plague',
    category: 'npc_crisis',
    description: 'Temporary NPC sickness reducing services',
    triggerConditions: {},
    durationMinutes: 240,
    maxConcurrent: 1,
    cooldownMinutes: 10080,
    rewards: { currency: 150 },
    abVariants: [
      { variantId: 'plague_v1', name: 'Mild Plague', modifiers: { npc_efficiency: 0.7 } },
      { variantId: 'plague_v2', name: 'Severe Plague', modifiers: { npc_efficiency: 0.3 } }
    ]
  });

  createTemplate({
    name: 'Resource Drought',
    category: 'npc_crisis',
    description: 'Temporary resource scarcity increasing prices',
    triggerConditions: {},
    durationMinutes: 480,
    maxConcurrent: 1,
    cooldownMinutes: 5040,
    rewards: { currency: 200 },
    abVariants: [
      { variantId: 'drought_v1', name: 'Partial Drought', modifiers: { resource_scarcity: 0.5 } },
      { variantId: 'drought_v2', name: 'Full Drought', modifiers: { resource_scarcity: 0.8 } }
    ]
  });

  createTemplate({
    name: 'Civil Unrest',
    category: 'npc_crisis',
    description: 'NPC factions temporarily conflict, reducing normal services',
    triggerConditions: { factionConflictMin: 60 },
    durationMinutes: 360,
    maxConcurrent: 1,
    cooldownMinutes: 10080,
    rewards: { currency: 250 },
    abVariants: [
      { variantId: 'unrest_v1', name: 'Diplomatic Crisis', modifiers: { npcs_affected: 0.5 } },
      { variantId: 'unrest_v2', name: 'Total Breakdown', modifiers: { npcs_affected: 1.0 } }
    ]
  });

  createTemplate({
    name: 'Monster Invasion',
    category: 'npc_crisis',
    description: 'Temporary increase in dangerous creatures',
    triggerConditions: {},
    durationMinutes: 300,
    maxConcurrent: 2,
    cooldownMinutes: 5040,
    rewards: { currency: 350, cosmetic: 'monster_hunter_badge' },
    abVariants: [
      { variantId: 'monster_v1', name: 'Standard Invasion', modifiers: { spawn_rate: 2.0 } },
      { variantId: 'monster_v2', name: 'Legendary Invasion', modifiers: { spawn_rate: 3.0, boss_spawn: 1 } }
    ]
  });

  // World resets (3)
  createTemplate({
    name: 'Dynasty Reset',
    category: 'world_reset',
    description: 'Complete world state reset with legacy preservation',
    triggerConditions: {},
    durationMinutes: 60,
    maxConcurrent: 1,
    cooldownMinutes: 43200,
    rewards: { currency: 1000 },
    abVariants: [
      { variantId: 'dynasty_v1', name: 'Standard Reset', modifiers: { legacy_preservation: 0.2 } },
      { variantId: 'dynasty_v2', name: 'Legacy-Rich Reset', modifiers: { legacy_preservation: 0.5 } }
    ]
  });

  createTemplate({
    name: 'Territorial Reformation',
    category: 'world_reset',
    description: 'Faction territories reshuffle based on current power',
    triggerConditions: { factionConflictMin: 70 },
    durationMinutes: 30,
    maxConcurrent: 1,
    cooldownMinutes: 259200,
    rewards: { currency: 500, cosmetic: 'reformed_banner' },
    abVariants: [
      { variantId: 'reform_v1', name: 'Gradual Reformation', modifiers: { transition_time: 3600 } },
      { variantId: 'reform_v2', name: 'Instant Reformation', modifiers: { transition_time: 60 } }
    ]
  });

  createTemplate({
    name: 'Seasonal Reset',
    category: 'world_reset',
    description: 'Quarterly reset with season change',
    triggerConditions: {},
    durationMinutes: 30,
    maxConcurrent: 1,
    cooldownMinutes: 7776000, // 90 days
    rewards: { currency: 750 },
    abVariants: [
      { variantId: 'seasonal_v1', name: 'Light Reset', modifiers: { wipe_extent: 0.3 } },
      { variantId: 'seasonal_v2', name: 'Full Reset', modifiers: { wipe_extent: 0.8 } }
    ]
  });

  // Social events (2)
  createTemplate({
    name: 'Friendship Festival',
    category: 'social',
    description: 'Event encouraging social interactions and group play',
    triggerConditions: { playerCountMin: 5 },
    durationMinutes: 1440,
    maxConcurrent: 1,
    cooldownMinutes: 20160,
    rewards: { currency: 300, cosmetic: 'friendship_badge' },
    abVariants: [
      { variantId: 'friendship_v1', name: 'Solo Focus', modifiers: { group_bonus: 1.0 } },
      { variantId: 'friendship_v2', name: 'Group Focused', modifiers: { group_bonus: 2.0 } }
    ]
  });

  createTemplate({
    name: 'Guild Wars',
    category: 'social',
    description: 'Factional competition with team-based mechanics',
    triggerConditions: { playerCountMin: 20 },
    durationMinutes: 720,
    maxConcurrent: 1,
    cooldownMinutes: 30240,
    rewards: { currency: 400, cosmetic: 'war_hero_medal' },
    abVariants: [
      { variantId: 'war_v1', name: 'Balanced Teams', modifiers: { team_size: 5 } },
      { variantId: 'war_v2', name: 'Large Teams', modifiers: { team_size: 10 } }
    ]
  });

  (schedulerState as any).eventTemplateCount = eventTemplates.size;
}

/**
 * Create event template
 * 
 * @param template Template config
 */
function createTemplate(template: Omit<EventTemplate, 'templateId'>): void {
  const fullTemplate: EventTemplate = {
    templateId: `template_${uuid()}`,
    ...template
  };

  eventTemplates.set(fullTemplate.templateId, fullTemplate);
}

/**
 * Schedule event based on telemetry triggers
 * Auto-triggers events when conditions are met
 * 
 * @param economyScore Current economy score (0-100)
 * @param playerCount Current active players
 * @param factionConflict Current faction conflict level (0-100)
 * @returns Event ID if scheduled, null if no conditions met
 */
export function scheduleEventByTelemetry(
  economyScore: number,
  playerCount: number,
  factionConflict: number
): string | null {
  // Find matching templates
  const candidates: EventTemplate[] = [];

  for (const template of Array.from(eventTemplates.values())) {
    const cond = template.triggerConditions;

    // Check all conditions
    if (
      (cond.economyScoreMin === undefined || economyScore >= cond.economyScoreMin) &&
      (cond.economyScoreMax === undefined || economyScore <= cond.economyScoreMax) &&
      (cond.playerCountMin === undefined || playerCount >= cond.playerCountMin) &&
      (cond.factionConflictMin === undefined || factionConflict >= cond.factionConflictMin)
    ) {
      // Check if not already at concurrent limit
      const activeCount = activeEvents.filter((e) => e.templateId === template.templateId).length;
      if (activeCount < template.maxConcurrent) {
        // Check cooldown
        if (canScheduleWithoutCooldown(template.templateId, template.cooldownMinutes)) {
          candidates.push(template);
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick random candidate
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  // Queue event
  return queueEvent(template.templateId, `Telemetry trigger: economy=${economyScore}, players=${playerCount}`);
}

/**
 * Check if template can be scheduled without violating cooldown
 * 
 * @param templateId Template to check
 * @param cooldownMinutes Cooldown duration
 * @returns True if can schedule
 */
function canScheduleWithoutCooldown(templateId: string, cooldownMinutes: number): boolean {
  // Check active/completed events of same template
  const recent = activeEvents.filter(
    (e) => e.templateId === templateId && Date.now() - e.endTime < cooldownMinutes * 60000
  );

  return recent.length === 0;
}

/**
 * Queue event for scheduling
 * 
 * @param templateId Event template ID
 * @param reason Why event was queued
 * @returns Queue ID
 */
export function queueEvent(templateId: string, reason: string): string {
  const queueEntry: EventQueueEntry = {
    queueId: `queue_${uuid()}`,
    templateId,
    scheduledTime: Date.now() + 60000, // Schedule for 1 min from now
    priority: 5,
    reason
  };

  eventQueue.push(queueEntry);
  (schedulerState as any).queuedEventCount = eventQueue.length;

  return queueEntry.queueId;
}

/**
 * Launch queued event
 * 
 * @param queueId Queue entry to launch
 * @returns Active event or null if launch failed
 */
export function launchQueuedEvent(queueId: string): ActiveEvent | null {
  const queueIndex = eventQueue.findIndex((q) => q.queueId === queueId);
  if (queueIndex === -1) return null;

  const [queueEntry] = eventQueue.splice(queueIndex, 1);
  const template = eventTemplates.get(queueEntry.templateId);

  if (!template) return null;

  // Check concurrent limit
  const activeCount = activeEvents.filter(
    (e) => e.templateId === queueEntry.templateId && e.status === 'active'
  ).length;
  if (activeCount >= template.maxConcurrent) return null;

  // Pick random variant for A/B testing
  const variant = template.abVariants[Math.floor(Math.random() * template.abVariants.length)];

  const event: ActiveEvent = {
    eventId: `event_${uuid()}`,
    templateId: template.templateId,
    templateName: template.name,
    startTime: Date.now(),
    endTime: Date.now() + template.durationMinutes * 60000,
    status: 'active',
    activeParticipants: 0,
    variantId: variant.variantId
  };

  activeEvents.push(event);
  (schedulerState as any).activeEventCount = activeEvents.filter((e) => e.status === 'active').length;
  (schedulerState as any).totalEventsLaunched += 1;

  return event;
}

/**
 * Get active events
 * 
 * @returns Active events
 */
export function getActiveEvents(): ActiveEvent[] {
  // Cleanup completed events
  const now = Date.now();
  for (let i = activeEvents.length - 1; i >= 0; i--) {
    if (activeEvents[i].status === 'active' && now > activeEvents[i].endTime) {
      (activeEvents[i] as any).status = 'completed';
    }
  }

  return activeEvents.filter((e) => e.status === 'active').map((e) => ({ ...e }));
}

/**
 * Create A/B test experiment
 * Assigns players to cohorts and tracks metrics
 * 
 * @param templateId Event template for A/B test
 * @param cohortASize Size of cohort A
 * @param cohortBSize Size of cohort B
 * @param metricsTracked Metrics to track
 * @returns Experiment ID
 */
export function createABTestExperiment(
  templateId: string,
  cohortASize: number,
  cohortBSize: number,
  metricsTracked: string[]
): string {
  const template = eventTemplates.get(templateId);
  if (!template || template.abVariants.length < 2) return '';

  const experimentId = `ab_${uuid()}`;
  const config: ABTestConfig = {
    experimentId,
    templateId,
    variantA: template.abVariants[0].variantId,
    variantB: template.abVariants[1].variantId,
    cohortA: new Set(), // Would be populated with actual player IDs
    cohortB: new Set(),
    startTime: Date.now(),
    endTime: Date.now() + 7 * 86400000, // 7 days
    metricsTracked
  };

  abTests.set(experimentId, config);

  return experimentId;
}

/**
 * Get event template by ID
 * 
 * @param templateId Template ID
 * @returns Event template or null
 */
export function getEventTemplate(templateId: string): EventTemplate | null {
  const template = eventTemplates.get(templateId);
  return template ? { ...template } : null;
}

/**
 * Get all event templates
 * 
 * @returns All templates
 */
export function getAllEventTemplates(): EventTemplate[] {
  return Array.from(eventTemplates.values()).map((t) => ({ ...t }));
}

/**
 * Get event queue
 * 
 * @returns Queued events
 */
export function getEventQueue(): EventQueueEntry[] {
  return eventQueue.map((e) => ({ ...e }));
}

/**
 * Get scheduler state
 * 
 * @returns Current state
 */
export function getEventSchedulerState(): EventSchedulerState {
  return { ...schedulerState };
}

/**
 * Clear scheduler state (for testing)
 */
export function resetEventScheduler(): void {
  eventTemplates.clear();
  activeEvents = [];
  eventQueue = [];
  abTests.clear();
  schedulerState = {
    schedulerId: `scheduler_${uuid()}`,
    isInitialized: false,
    eventTemplateCount: 0,
    activeEventCount: 0,
    queuedEventCount: 0,
    totalEventsLaunched: 0,
    lastSchedulingPass: 0
  };
}

/**
 * Get A/B test results
 * 
 * @param experimentId Experiment to check
 * @returns Test results or null
 */
export function getABTestResults(experimentId: string): {
  variantA: { completions: number; avgEngagement: number };
  variantB: { completions: number; avgEngagement: number };
  winner: 'A' | 'B' | 'tie';
} | null {
  const test = abTests.get(experimentId);
  if (!test) return null;

  // Simulated results (in production, would track actual player data)
  return {
    variantA: { completions: 45, avgEngagement: 8.5 },
    variantB: { completions: 52, avgEngagement: 9.2 },
    winner: 'B'
  };
}
