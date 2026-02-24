/**
 * M69: Player Behavior Tracking - Griefing, exploit, and RMT detection
 * Tracks suspicious patterns and correlates player reports
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type BehaviorFlag = 'griefing' | 'exploiting' | 'rmt' | 'account_sharing' | 'raid_sabotage' | 'fraud';
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface BehaviorIncident {
  id: string;
  playerId: string;
  playerName: string;
  type: BehaviorFlag;
  description: string;
  evidence: string[];
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  reporters: string[]; // Player IDs who reported it
  autoFlagged: boolean; // System-detected vs player-reported
  investigated: boolean;
  resolution?: string;
}

export interface PlayerBehaviorProfile {
  playerId: string;
  playerName: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  incidentCount: number;
  reportedByCount: number; // Unique reporters
  recidivismScore: number; // 0-1, how likely to reoffend
  lastIncident?: number;
  behaviors: {
    griefingCount: number;
    exploitCount: number;
    rmtCount: number;
    AccountSharingCount: number;
    fraudCount: number;
  };
  linkedAccounts: string[]; // Suspected alt accounts
  behaviorTrends: {
    oneWeek: number; // incident count last 7 days
    oneMonth: number;
    allTime: number;
  };
}

export interface CorrelationCluster {
  id: string;
  playerIds: Set<string>;
  correlationType: 'likely_alts' | 'rmt_ring' | 'raid_griefing_group' | 'fraud_network';
  confidence: number; // 0-1
  correlationReasons: string[];
  firstDetected: number;
  severity: 'low' | 'medium' | 'high';
}

export interface LedgerAnomalyFlag {
  id: string;
  playerId: string;
  ledgerHash: string;
  anomalyType: 'impossible_state' | 'determinism_violation' | 'infinite_loop' | 'timestamp_inconsistency';
  description: string;
  affectedTransactionIds: string[];
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BehaviorTrackingState {
  incidents: Map<string, BehaviorIncident>;
  playerProfiles: Map<string, PlayerBehaviorProfile>;
  correlationClusters: Map<string, CorrelationCluster>;
  ledgerAnomalies: Map<string, LedgerAnomalyFlag>;
  chargebackIndicators: Map<string, { count: number; lastChargeback: number }>;
  watchlist: Set<string>; // Higher scrutiny
}

// ============================================================================
// MODULE STATE
// ============================================================================

const state: BehaviorTrackingState = {
  incidents: new Map(),
  playerProfiles: new Map(),
  correlationClusters: new Map(),
  ledgerAnomalies: new Map(),
  chargebackIndicators: new Map(),
  watchlist: new Set(),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initPlayerBehaviorTracking(): boolean {
  state.incidents.clear();
  state.playerProfiles.clear();
  state.correlationClusters.clear();
  state.ledgerAnomalies.clear();
  state.chargebackIndicators.clear();
  state.watchlist.clear();
  return true;
}

// ============================================================================
// INCIDENT REPORTING & TRACKING
// ============================================================================

/**
 * Record a behavior incident
 */
export function recordBehaviorIncident(
  playerId: string,
  playerName: string,
  type: BehaviorFlag,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  evidence: string[],
  autoFlagged: boolean,
  reporterIds: string[] = []
): BehaviorIncident {
  const incident: BehaviorIncident = {
    id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    playerName,
    type,
    description,
    severity,
    evidence,
    timestamp: Date.now(),
    reporters: reporterIds,
    autoFlagged,
    investigated: autoFlagged, // System incidents auto-investigated
  };

  state.incidents.set(incident.id, incident);

  // Update player profile
  updatePlayerProfile(playerId, playerName, type);

  // Check for correlations
  if (reporterIds.length > 0) {
    checkCorrelations(playerId);
  }

  return incident;
}

/**
 * Get all incidents for a player
 */
export function getPlayerIncidents(playerId: string): BehaviorIncident[] {
  return Array.from(state.incidents.values()).filter((i) => i.playerId === playerId);
}

/**
 * Get incidents by type
 */
export function getIncidentsByType(type: BehaviorFlag): BehaviorIncident[] {
  return Array.from(state.incidents.values()).filter((i) => i.type === type);
}

/**
 * Get unresolved incidents
 */
export function getUnresolvedIncidents(): BehaviorIncident[] {
  return Array.from(state.incidents.values()).filter((i) => !i.investigated || !i.resolution);
}

// ============================================================================
// PLAYER PROFILE MANAGEMENT
// ============================================================================

/**
 * Update player behavior profile
 */
function updatePlayerProfile(playerId: string, playerName: string, behaviorType: BehaviorFlag): void {
  let profile = state.playerProfiles.get(playerId);

  if (!profile) {
    profile = {
      playerId,
      playerName,
      riskLevel: 'safe',
      riskScore: 0,
      incidentCount: 0,
      reportedByCount: 0,
      recidivismScore: 0,
      behaviors: {
        griefingCount: 0,
        exploitCount: 0,
        rmtCount: 0,
        AccountSharingCount: 0,
        fraudCount: 0,
      },
      linkedAccounts: [],
      behaviorTrends: {
        oneWeek: 0,
        oneMonth: 0,
        allTime: 0,
      },
    };
    state.playerProfiles.set(playerId, profile);
  }

  // Increment behavior counter
  (profile as any).incidentCount++;
  (profile as any).lastIncident = Date.now();

  switch (behaviorType) {
    case 'griefing':
      (profile as any).behaviors.griefingCount++;
      break;
    case 'exploiting':
      (profile as any).behaviors.exploitCount++;
      break;
    case 'rmt':
      (profile as any).behaviors.rmtCount++;
      break;
    case 'account_sharing':
      (profile as any).behaviors.AccountSharingCount++;
      break;
    case 'fraud':
      (profile as any).behaviors.fraudCount++;
      break;
  }

  // Calculate risk score (0-100)
  (profile as any).riskScore = calculateRiskScore(profile);

  // Update recidivism
  (profile as any).recidivismScore = calculateRecidivism(profile);

  // Update risk level
  (profile as any).riskLevel = getRiskLevel(profile.riskScore);

  // Update trends
  updateBehaviorTrends(profile);

  // Add to watchlist if necessary
  if (profile.riskScore >= 50) {
    state.watchlist.add(playerId);
  }
}

function calculateRiskScore(profile: PlayerBehaviorProfile): number {
  let score = 0;

  // Incident count (max 40 points)
  score += Math.min((profile as any).incidentCount * 5, 40);

  // Recency (max 30 points)
  if (profile.lastIncident) {
    const daysSinceLastIncident = (Date.now() - profile.lastIncident) / (1000 * 60 * 60 * 24);
    if (daysSinceLastIncident < 7) score += 30;
    else if (daysSinceLastIncident < 30) score += 15;
  }

  // Behavior variety (max 20 points)
  const behaviorTypes = Object.values(profile.behaviors).filter((count) => (count as number) > 0).length;
  score += behaviorTypes * 5;

  // RMT/Fraud severity (max 30 points - can exceed 100)
  score += (profile as any).behaviors.rmtCount * 10;
  score += (profile as any).behaviors.fraudCount * 15;

  return Math.min(score, 100);
}

function calculateRecidivism(profile: PlayerBehaviorProfile): number {
  // Simple model: players with multiple incidents are more likely to reoffend
  const incidentCount = (profile as any).incidentCount;
  if (incidentCount === 0) return 0;
  if (incidentCount === 1) return 0.2;
  if (incidentCount <= 3) return 0.5;
  if (incidentCount <= 5) return 0.7;
  return 0.9;
}

function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore < 10) return 'safe';
  if (riskScore < 25) return 'low';
  if (riskScore < 50) return 'medium';
  if (riskScore < 75) return 'high';
  return 'critical';
}

function updateBehaviorTrends(profile: PlayerBehaviorProfile): void {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  let oneWeekCount = 0;
  let oneMonthCount = 0;

  for (const incident of Array.from(state.incidents.values())) {
    if (incident.playerId === profile.playerId) {
      if (incident.timestamp > oneWeekAgo) oneWeekCount++;
      if (incident.timestamp > oneMonthAgo) oneMonthCount++;
    }
  }

  (profile as any).behaviorTrends.oneWeek = oneWeekCount;
  (profile as any).behaviorTrends.oneMonth = oneMonthCount;
  (profile as any).behaviorTrends.allTime = (profile as any).incidentCount;
}

/**
 * Get player behavior profile
 */
export function getPlayerBehaviorProfile(playerId: string): PlayerBehaviorProfile | null {
  return state.playerProfiles.get(playerId) || null;
}

/**
 * Get all players flagged as high risk
 */
export function getHighRiskPlayers(): PlayerBehaviorProfile[] {
  return Array.from(state.playerProfiles.values()).filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical');
}

/**
 * Get all players on watchlist
 */
export function getWatchlistPlayers(): PlayerBehaviorProfile[] {
  const profiles: PlayerBehaviorProfile[] = [];
  for (const playerId of state.watchlist) {
    const profile = state.playerProfiles.get(playerId);
    if (profile) profiles.push(profile);
  }
  return profiles;
}

// ============================================================================
// CORRELATION & CLUSTERING
// ============================================================================

/**
 * Check for correlated suspicious activity
 * Links possible alt accounts, RMT rings, griefing groups
 */
function checkCorrelations(playerId: string): void {
  const playerIncidents = getPlayerIncidents(playerId);
  const incidents = Array.from(state.incidents.values());

  // Look for accounts with similar reporting patterns
  const similarReporterPatterns = findSimilarReporters(playerIncidents);
  if (similarReporterPatterns.length > 0) {
    createOrUpdateCluster(
      [playerId, ...similarReporterPatterns],
      'likely_alts',
      ['Similar reporting patterns', 'Potential account sharing']
    );
  }

  // Look for RMT network patterns
  const rmtIncidents = playerIncidents.filter((i) => i.type === 'rmt');
  if (rmtIncidents.length > 0) {
    const rmtCorrelates = findRMTCorrelates(playerId);
    if (rmtCorrelates.length > 0) {
      createOrUpdateCluster(
        [playerId, ...rmtCorrelates],
        'rmt_ring',
        [`${rmtCorrelates.length} accounts with RMT patterns`]
      );
    }
  }

  // Look for raid sabotage groups
  const griefingIncidents = playerIncidents.filter((i) => i.type === 'raid_sabotage' || i.type === 'griefing');
  if (griefingIncidents.length > 1) {
    const griefingPartners = findGriefingPartners(playerId);
    if (griefingPartners.length > 0) {
      createOrUpdateCluster(
        [playerId, ...griefingPartners],
        'raid_griefing_group',
        [`Coordinated griefing in ${griefingIncidents.length} raids`]
      );
    }
  }
}

function findSimilarReporters(incidents: BehaviorIncident[]): string[] {
  const reporterMap = new Map<string, Set<string>>();

  for (const incident of incidents) {
    for (const reporter of incident.reporters) {
      if (!reporterMap.has(reporter)) {
        reporterMap.set(reporter, new Set());
      }
      reporterMap.get(reporter)!.add(incident.playerId);
    }
  }

  // Find reporters who report same players
  const similar: string[] = [];
  for (const others of reporterMap.values()) {
    if (others.size > 1) {
      for (const otherId of others) {
        if (otherId !== incidents[0]?.playerId) {
          similar.push(otherId);
        }
      }
    }
  }

  return [...new Set(similar)];
}

function findRMTCorrelates(playerId: string): string[] {
  const rmtIncidents = getIncidentsByType('rmt');
  const correlates = new Set<string>();
  const playerIncidents = getPlayerIncidents(playerId);
  const playerReporters = new Set(playerIncidents.flatMap((i) => i.reporters));

  for (const incident of rmtIncidents) {
    if (incident.playerId !== playerId) {
      // Check if they share reporters or if there's bidirectional reporting
      const otherIncidents = getPlayerIncidents(incident.playerId);
      const otherReporters = otherIncidents.flatMap((i) => i.reporters);

      const sharedReporters = otherReporters.filter((r) => playerReporters.has(r));
      const bidirectional = playerReporters.has(incident.playerId) || otherReporters.includes(playerId);

      if (sharedReporters.length > 0 || bidirectional) {
        correlates.add(incident.playerId);
      }
    }
  }

  return Array.from(correlates);
}

function findGriefingPartners(playerId: string): string[] {
  const griefingIncidents = getPlayerIncidents(playerId).filter(
    (i) => i.type === 'griefing' || i.type === 'raid_sabotage'
  );

  const partners = new Set<string>();
  for (const incident of griefingIncidents) {
    // Find other incidents at similar timestamps in same location
    for (const otherIncident of Array.from(state.incidents.values())) {
      if (
        otherIncident.playerId !== playerId &&
        Math.abs(otherIncident.timestamp - incident.timestamp) < 60000 && // Within 1 minute
        otherIncident.description.includes(incident.description.split(' ')[0]) // Rough location match
      ) {
        partners.add(otherIncident.playerId);
      }
    }
  }

  return Array.from(partners);
}

function createOrUpdateCluster(playerIds: string[], type: CorrelationCluster['correlationType'], reasons: string[]): void {
  const clusterKey = Array.from(playerIds).sort().join('_');
  let cluster = state.correlationClusters.get(clusterKey);

  if (!cluster) {
    cluster = {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerIds: new Set(playerIds),
      correlationType: type,
      confidence: 0.5,
      correlationReasons: reasons,
      firstDetected: Date.now(),
      severity: 'low',
    };
    state.correlationClusters.set(clusterKey, cluster);
  } else {
    cluster.correlationReasons.push(...reasons);
    cluster.correlationReasons = [...new Set(cluster.correlationReasons)];
    cluster.confidence = Math.min(cluster.confidence + 0.1, 0.95);
  }

  // Calculate severity
  const avgRiskScore = Array.from(cluster.playerIds)
    .map((id) => state.playerProfiles.get(id)?.riskScore || 0)
    .reduce((a, b) => a + b, 0) / cluster.playerIds.size;

  cluster.severity = avgRiskScore > 70 ? 'high' : avgRiskScore > 40 ? 'medium' : 'low';

  state.correlationClusters.set(clusterKey, cluster);
}

/**
 * Get all correlation clusters
 */
export function getCorrelationClusters(): CorrelationCluster[] {
  return Array.from(state.correlationClusters.values());
}

/**
 * Get players in a cluster
 */
export function getClusterMembers(clusterId: string): string[] {
  for (const cluster of state.correlationClusters.values()) {
    if (cluster.id === clusterId) {
      return Array.from(cluster.playerIds);
    }
  }
  return [];
}

// ============================================================================
// LEDGER ANOMALY DETECTION
// ============================================================================

/**
 * Flag a ledger anomaly
 */
export function flagLedgerAnomaly(
  playerId: string,
  ledgerHash: string,
  anomalyType: LedgerAnomalyFlag['anomalyType'],
  description: string,
  affectedTransactionIds: string[],
  severity: 'low' | 'medium' | 'high' | 'critical'
): LedgerAnomalyFlag {
  const flag: LedgerAnomalyFlag = {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    ledgerHash,
    anomalyType,
    description,
    affectedTransactionIds,
    timestamp: Date.now(),
    severity,
  };

  state.ledgerAnomalies.set(flag.id, flag);

  // Record as behavior incident
  recordBehaviorIncident(
    playerId,
    '',
    'exploiting',
    `Ledger anomaly: ${description}`,
    severity,
    [ledgerHash, ...affectedTransactionIds],
    true // Auto-flagged
  );

  return flag;
}

/**
 * Get all ledger anomalies for a player
 */
export function getPlayerLedgerAnomalies(playerId: string): LedgerAnomalyFlag[] {
  return Array.from(state.ledgerAnomalies.values()).filter((a) => a.playerId === playerId);
}

/**
 * Get critical ledger anomalies
 */
export function getCriticalLedgerAnomalies(): LedgerAnomalyFlag[] {
  return Array.from(state.ledgerAnomalies.values()).filter((a) => a.severity === 'critical');
}

// ============================================================================
// CHARGEBACK DETECTION
// ============================================================================

/**
 * Record a chargeback for a player
 */
export function recordChargeback(playerId: string): number {
  let indicator = state.chargebackIndicators.get(playerId);
  if (!indicator) {
    indicator = { count: 0, lastChargeback: 0 };
  }

  (indicator as any).count++;
  (indicator as any).lastChargeback = Date.now();
  state.chargebackIndicators.set(playerId, indicator);

  // Record as behavior incident
  recordBehaviorIncident(
    playerId,
    '',
    'fraud',
    `Chargeback #${indicator.count}`,
    'high',
    [`chargeback_record_${Date.now()}`],
    true
  );

  return indicator.count;
}

/**
 * Get chargeback history for a player
 */
export function getChargebackHistory(playerId: string): { count: number; lastChargeback: number } | null {
  return state.chargebackIndicators.get(playerId) || null;
}

/**
 * Get all players with chargebacks
 */
export function getChargebackPlayers(): Array<[string, { count: number; lastChargeback: number }]> {
  return Array.from(state.chargebackIndicators.entries());
}

// ============================================================================
// STATE EXPORT
// ============================================================================

export function getBehaviorTrackingState(): BehaviorTrackingState {
  return state;
}
