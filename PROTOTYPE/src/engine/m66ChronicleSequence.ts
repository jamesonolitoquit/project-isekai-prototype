/**
 * M66: Chronicle Sequence
 * 
 * Evaluates player's total impact across Myth Status, World Delta, and Legacy Budget.
 * Produces one of three deterministic world-reset outcomes.
 * Seals session as Iron Canon (read-only historical record).
 * 
 * Integration with M62-CHRONOS for deterministic replay.
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Chronicle & Finale System
// ============================================================================

/**
 * Three possible world-ending outcomes
 */
export type ChronicleFinalOutcome = 'restoration' | 'descent' | 'transformation';

/**
 * Player's impact across session
 */
export interface SessionMetrics {
  readonly sessionId: string;
  readonly playerNpcId: string; // Player's character ID
  readonly startedAt: number;
  readonly concludedAt?: number;
  readonly totalPlaytimeTicks: number;
  readonly decisionsCount: number;
  readonly questsCompleted: number;
  readonly npcsFactionShiftCount: number; // How many NPCs changed faction
  readonly relationsFormedCount: number;
  readonly socCialsScarsCreated: number; // Negative reputation events
  readonly hardFactsEstablished: string[]; // Immutable facts player created
}

/**
 * Myth Status: how legendary is the player?
 */
export interface MythStatus {
  readonly mythScore: number; // 0-1000
  readonly legendaryDeeds: string[];
  readonly notoriety: number; // -100 (infamous) to +100 (heroic)
  readonly culturalImpact: number; // 0-100, how much NPCs talk about them
  readonly aspectAffinity: number; // 0-100, alignment with world forces
}

/**
 * World Delta: magnitude of changes made
 */
export interface WorldDelta {
  readonly regionsAffected: number;
  readonly factionShifts: number;
  readonly npcDeaths: number;
  readonly relationsFormationRate: number; // 0-100
  readonly questlineResolutions: number;
  readonly paradoxIntroduced: number; // 0-100
}

/**
 * Legacy Budget: points for impactful decisions
 */
export interface LegacyBudget {
  readonly totalPoints: number; // 0-10000
  readonly mortalityWeight: number; // Points from life/death decisions
  readonly diplomacyWeight: number; // Points from alliance/conflict
  readonly sacrificeWeight: number; // Points from self-sacrifice
  readonly discoveryWeight: number; // Points from exploration/learning
  readonly multiplicativeLeader: number; // Cascade effect multiplier
}

/**
 * Complete chronicle entry for a session
 */
export interface ChromicleEntry {
  readonly entryId: string;
  readonly sessionId: string;
  readonly playerCharacterName: string;
  readonly playedAt: number;
  readonly concludedAt: number;
  readonly durationTicks: number;
  readonly finalOutcome: ChronicleFinalOutcome;
  readonly mythStatus: MythStatus;
  readonly worldDelta: WorldDelta;
  readonly legacyBudget: LegacyBudget;
  readonly keyHardFacts: string[];
  readonly keyScars: string[]; // Most impactful social scars
  readonly finalParadoxLevel: number;
  readonly finalAgeRot: number;
  readonly legacyPointsCarried: number; // Preserved for next epoch
}

/**
 * Iron Canon: sealed historical record
 */
export interface IronCanon {
  readonly canonId: string;
  readonly createdAt: number;
  readonly chronologies: ChromicleEntry[];
  readonly isSealed: boolean;
  readonly canonChecksum: string; // Integrity hash
  readonly storageLocation: 'localStorage' | 'indexeddb';
}

// ============================================================================
// CHRONICLE ENGINE: Core Operations
// ============================================================================

let currentSession: SessionMetrics | null = null;
let allChronicles: ChromicleEntry[] = [];
let ironCanon: IronCanon | null = null;

const IRON_CANON_KEY = 'project_isekai_iron_canon';

// ============================================================================
// SESSION MUTATION HELPER: Type-safe session updates
// ============================================================================

/**
 * Create updated session with new values
 * Maintains immutability by returning new SessionMetrics object
 */
function updateSession(updates: Partial<Omit<SessionMetrics, 'readonly'>>): SessionMetrics {
  if (!currentSession) throw new Error('No active session');
  return {
    ...currentSession,
    ...updates
  };
}

/**
 * Initialize a new session
 * 
 * @param playerNpcId Player's character ID
 * @returns Session metrics
 */
export function initializeSession(playerNpcId: string): SessionMetrics {
  const sessionId = `session_${uuid()}`;

  currentSession = {
    sessionId,
    playerNpcId,
    startedAt: Date.now(),
    totalPlaytimeTicks: 0,
    decisionsCount: 0,
    questsCompleted: 0,
    npcsFactionShiftCount: 0,
    relationsFormedCount: 0,
    socCialsScarsCreated: 0,
    hardFactsEstablished: []
  };

  return currentSession;
}

/**
 * Record a player decision
 * 
 * @param sessionId Session ID
 * @param impactScore Impact of this decision (0-100)
 * @param worldInstanceId World instance for ledger
 */
export function recordDecision(sessionId: string, impactScore: number, worldInstanceId: string = 'WORLD_M66_DEFAULT'): void {
  if (!currentSession || currentSession.sessionId !== sessionId) return;

  const recordedAt = Date.now();

  currentSession = updateSession({
    decisionsCount: currentSession.decisionsCount + 1,
    totalPlaytimeTicks: currentSession.totalPlaytimeTicks + 1
  });

  // Record in ledger for deterministic replay
  appendEvent({
    id: `event_${uuid()}`,
    worldInstanceId,
    actorId: currentSession.playerNpcId,
    type: 'player_decision_recorded',
    payload: {
      sessionId,
      impactScore,
      decisionNumber: currentSession.decisionsCount,
      totalTicks: currentSession.totalPlaytimeTicks
    },
    timestamp: recordedAt,
    mutationClass: 'STATE_CHANGE'
  });
}

/**
 * Record completed quest
 * 
 * @param questId Quest identifier
 * @param impactScore Quest importance (0-100)
 */
export function recordQuestCompletion(questId: string, impactScore: number): void {
  if (!currentSession) return;

  currentSession = updateSession({
    questsCompleted: currentSession.questsCompleted + 1
  });
}

/**
 * Record NPC faction shift
 * 
 * @param npcId NPC who shifted
 * @param fromFaction Previous faction
 * @param toFaction New faction
 */
export function recordNPCFactionShift(npcId: string, fromFaction: string, toFaction: string): void {
  if (!currentSession) return;

  currentSession = updateSession({
    npcsFactionShiftCount: currentSession.npcsFactionShiftCount + 1
  });
}

/**
 * Record social scar creation
 * 
 * @param scarId Scar identifier
 * @param severity Scar severity (0-100)
 */
export function recordSocialScar(scarId: string, severity: number): void {
  if (!currentSession) return;

  currentSession = updateSession({
    socCialsScarsCreated: currentSession.socCialsScarsCreated + 1,
    hardFactsEstablished: [...currentSession.hardFactsEstablished, `scar_${scarId}`]
  });
}

/**
 * Record established hard fact
 * 
 * @param factId Fact identifier
 * @param content Fact description
 */
export function recordHardFact(factId: string, content: string): void {
  if (!currentSession) return;

  currentSession = updateSession({
    hardFactsEstablished: [...currentSession.hardFactsEstablished, factId]
  });
}

/**
 * Calculate Myth Status
 * 
 * @param metrics Session metrics
 * @param worldDelta World changes
 * @param scarsCreated Number of social scars
 * @returns Myth Status evaluation
 */
export function calculateMythStatus(
  metrics: SessionMetrics,
  worldDelta: WorldDelta,
  scarsCreated: number
): MythStatus {
  // Myth score from decisions + quests + regional impact
  const decisionScore = Math.min(100, metrics.decisionsCount * 2);
  const questScore = metrics.questsCompleted * 50;
  const regionalScore = worldDelta.regionsAffected * 60;
  const mythScore = Math.min(1000, decisionScore + questScore + regionalScore);

  // Notoriety: positive for heroic deeds, negative for damage
  const notoriety = Math.max(
    -100,
    Math.min(100, (metrics.questsCompleted * 10) - (scarsCreated * 15))
  );

  // Cultural impact from NPC relationships
  const culturalImpact = Math.min(100, metrics.relationsFormedCount * 5);

  // Aspect affinity from paradox management
  const aspectAffinity = Math.max(0, 100 - (worldDelta.paradoxIntroduced || 0));

  return {
    mythScore,
    legendaryDeeds: metrics.hardFactsEstablished.slice(0, 5),
    notoriety,
    culturalImpact,
    aspectAffinity
  };
}

/**
 * Calculate World Delta
 * 
 * @param finalParadox Final paradox level
 * @param npcDeaths NPCs who died
 * @param factionChanges Faction shifts
 * @returns World Delta measurement
 */
export function calculateWorldDelta(
  finalParadox: number,
  npcDeaths: number,
  factionChanges: number,
  regionsAffected: number,
  questsCompleted: number
): WorldDelta {
  return {
    regionsAffected,
    factionShifts: factionChanges,
    npcDeaths,
    relationsFormationRate: factionChanges > 0 ? 50 : 0,
    questlineResolutions: questsCompleted,
    paradoxIntroduced: Math.max(0, Math.min(100, finalParadox / 5))
  };
}

/**
 * Calculate Legacy Budget
 * 
 * @param mythStatus Myth score
 * @param worldDelta World changes
 * @param questsCompleted Quests finished
 * @returns Legacy points earned
 */
export function calculateLegacyBudget(
  mythStatus: MythStatus,
  worldDelta: WorldDelta,
  questsCompleted: number
): LegacyBudget {
  // Base calculations
  const mortalityWeight = worldDelta.npcDeaths > 0 ? 500 : 100;
  const diplomacyWeight = worldDelta.factionShifts * 200;
  const sacrificeWeight = mythStatus.notoriety < 0 ? 300 : 50;
  const discoveryWeight = worldDelta.regionsAffected * 100;

  // Cascade multiplier from quest completion
  const multiplicativeLeader = Math.max(1, questsCompleted / 5);

  const totalPoints = Math.round(
    (mortalityWeight + diplomacyWeight + sacrificeWeight + discoveryWeight) * multiplicativeLeader
  );

  return {
    totalPoints: Math.min(10000, totalPoints),
    mortalityWeight,
    diplomacyWeight,
    sacrificeWeight,
    discoveryWeight,
    multiplicativeLeader
  };
}

/**
 * Determine finale outcome based on integrated metrics
 * 
 * @param mythStatus Myth status
 * @param worldDelta World changes
 * @param legacyBudget Legacy points
 * @param hardFactsCount Hard facts established
 * @param scarsCount Social scars
 * @returns Determined outcome
 */
export function determineChronicleOutcome(
  mythStatus: MythStatus,
  worldDelta: WorldDelta,
  legacyBudget: LegacyBudget,
  hardFactsCount: number,
  scarsCount: number
): ChronicleFinalOutcome {
  // Scoring system for outcomes
  let restorationScore = 0;
  let descentScore = 0;
  let transformationScore = 0;

  // Restoration: Healing, low paradox, positive notoriety
  restorationScore += mythStatus.notoriety > 0 ? 50 : 0;
  restorationScore += worldDelta.paradoxIntroduced < 30 ? 50 : 0;
  restorationScore += hardFactsCount > 5 ? 50 : 0;
  restorationScore += legacyBudget.sacrificeWeight > 300 ? 50 : 0;

  // Descent: Damage, failures, negative reputation
  descentScore += worldDelta.npcDeaths > 5 ? 50 : 0;
  descentScore += scarsCount > 10 ? 50 : 0;
  descentScore += worldDelta.paradoxIntroduced > 50 ? 50 : 0;
  descentScore += mythStatus.notoriety < -50 ? 50 : 0;

  // Transformation: High impact, mixed morality, many changes
  transformationScore += worldDelta.factionShifts > 3 ? 50 : 0;
  transformationScore += worldDelta.regionsAffected > 8 ? 50 : 0;
  transformationScore += hardFactsCount > 10 ? 50 : 0;
  transformationScore += worldDelta.paradoxIntroduced > 40 && mythStatus.notoriety > 0 ? 50 : 0;

  // Determine winner
  const scores = { restorationScore, descentScore, transformationScore };
  const maxScore = Math.max(...Object.values(scores));
  const [outcome] = Object.entries(scores).find(([_, score]) => score === maxScore) || ['transformation'];

  return outcome.replace('Score', '') as ChronicleFinalOutcome;
}

/**
 * Finalize session and create chronicle entry
 * 
 * @param metrics Session metrics
 * @param mythStatus Myth status
 * @param worldDelta World changes
 * @param legacyBudget Legacy points
 * @param hardFacts Hard facts array
 * @param scars Scars array
 * @param finalParadox Final paradox level
 * @param finalAgeRot Final age rot
 * @returns Chronicle entry
 */
export function finalizeSession(
  metrics: SessionMetrics,
  mythStatus: MythStatus,
  worldDelta: WorldDelta,
  legacyBudget: LegacyBudget,
  hardFacts: string[],
  scars: string[],
  finalParadox: number,
  finalAgeRot: number,
  worldInstanceId: string = 'WORLD_M66_DEFAULT'
): ChromicleEntry {
  const concludedAt = metrics.concludedAt ?? Date.now();

  const outcome = determineChronicleOutcome(
    mythStatus,
    worldDelta,
    legacyBudget,
    hardFacts.length,
    scars.length
  );

  // Legacy points to carry: 20% of total
  const legacyPointsCarried = Math.round(legacyBudget.totalPoints * 0.2);

  const entry: ChromicleEntry = {
    entryId: `chronicle_${uuid()}`,
    sessionId: metrics.sessionId,
    playerCharacterName: `Player_${metrics.playerNpcId.slice(0, 8)}`,
    playedAt: metrics.startedAt,
    concludedAt: concludedAt,
    durationTicks: metrics.totalPlaytimeTicks,
    finalOutcome: outcome,
    mythStatus,
    worldDelta,
    legacyBudget,
    keyHardFacts: hardFacts.slice(0, 10),
    keyScars: scars.slice(0, 10),
    finalParadoxLevel: finalParadox,
    finalAgeRot: finalAgeRot,
    legacyPointsCarried
  };

  // Record session finalization in ledger for deterministic replay
  appendEvent({
    id: `event_${uuid()}`,
    worldInstanceId,
    actorId: metrics.playerNpcId,
    type: 'session_finalized',
    payload: {
      sessionId: metrics.sessionId,
      chronicleId: entry.entryId,
      finalOutcome: outcome,
      mythScore: mythStatus.mythScore,
      legacyPointsCarried,
      hardFactsCount: hardFacts.length,
      scarsCount: scars.length,
      durationTicks: metrics.totalPlaytimeTicks,
      finalParadox,
      finalAgeRot
    },
    timestamp: concludedAt,
    mutationClass: 'STATE_CHANGE'
  });

  allChronicles.push(entry);
  currentSession = null;

  return entry;
}

/**
 * Seal a chronicle entry as part of Iron Canon
 * 
 * @param entry Chronicle entry to seal
 * @returns Sealed Iron Canon
 */
export function sealIronCanon(entry: ChromicleEntry): IronCanon {
  if (!ironCanon) {
    ironCanon = {
      canonId: `canon_${uuid()}`,
      createdAt: Date.now(),
      chronologies: [],
      isSealed: false,
      canonChecksum: '',
      storageLocation: 'localStorage'
    };
  }

  ironCanon.chronologies.push(entry);

  // Calculate checksum (simplified CRC)
  const checkData = JSON.stringify(ironCanon.chronologies);
  let checksum = 0;
  for (const char of checkData) {
    checksum = (checksum * 31 + char.charCodeAt(0)) & 0xffffffff;
  }

  // Recreate with updated checksum
  const updatedCanon: IronCanon = {
    canonId: ironCanon.canonId,
    createdAt: ironCanon.createdAt,
    chronologies: [...ironCanon.chronologies],
    isSealed: ironCanon.isSealed,
    canonChecksum: checksum.toString(16),
    storageLocation: ironCanon.storageLocation
  };

  ironCanon = updatedCanon;

  // Attempt to persist to storage
  ironCanon = persistCanonToStorage(ironCanon);

  return ironCanon;
}

/**
 * Persist Iron Canon to localStorage/IndexedDB
 * 
 * @param canon Iron Canon to persist
 * @returns Iron Canon with updated storage location
 */
function persistCanonToStorage(canon: IronCanon): IronCanon {
  try {
    const serialized = JSON.stringify(canon);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(IRON_CANON_KEY, serialized);
      // Return new Iron Canon with updated storageLocation
      return {
        ...canon,
        storageLocation: 'localStorage'
      };
    }
  } catch (error) {
    console.warn('Failed to persist Iron Canon:', error);
  }
  return canon;
}

/**
 * Load Iron Canon from storage
 * 
 * @returns Iron Canon or null
 */
export function loadIronCanonFromStorage(): IronCanon | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(IRON_CANON_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (error) {
    console.warn('Failed to load Iron Canon:', error);
  }
  return null;
}

/**
 * Get all chronicle entries
 * 
 * @returns Array of chronicles
 */
export function getAllChronicles(): ChromicleEntry[] {
  return [...allChronicles];
}

/**
 * Get chronicle by session ID
 * 
 * @param sessionId Session ID
 * @returns Chronicle entry or null
 */
export function getChronicleBySession(sessionId: string): ChromicleEntry | null {
  return allChronicles.find((c) => c.sessionId === sessionId) || null;
}

/**
 * Get Iron Canon statistics
 * 
 * @returns Canon summary
 */
export function getIronCanonStatistics(): {
  totalSessions: number;
  totalLegacyPoints: number;
  outcomeCounts: Record<ChronicleFinalOutcome, number>;
} {
  const outcomeCounts: Record<ChronicleFinalOutcome, number> = {
    restoration: 0,
    descent: 0,
    transformation: 0
  };

  for (const chronicle of allChronicles) {
    outcomeCounts[chronicle.finalOutcome]++;
  }

  const totalLegacyPoints = allChronicles.reduce((sum, c) => sum + c.legacyPointsCarried, 0);

  return {
    totalSessions: allChronicles.length,
    totalLegacyPoints,
    outcomeCounts
  };
}

/**
 * Clear all chronicle data (for testing)
 */
export function clearChronicleState(): void {
  currentSession = null;
  allChronicles = [];
  ironCanon = null;
}
