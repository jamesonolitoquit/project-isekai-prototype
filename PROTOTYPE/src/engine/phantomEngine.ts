/**
 * M42 Task 7: Phantom Engine
 *
 * Purpose: Render "ghost players" (phantom entities) from anonymized historical path logs
 * Design:
 * - Fetch anonymized movement/action data from other completed sessions
 * - Render as low-opacity (30-40%), blue-glowing ECS entities
 * - Deterministic playback (same seed = same ghost path every time)
 * - Non-interactive (collision-less, untargetable)
 * - Prevents temporal duplication paradoxes (ghosts aren't real players)
 *
 * Lifecycle:
 * 1. Phantoms spawned when world loads
 * 2. Play back movement frames at scaled time rate
 * 3. Render with ethereal shader (blue glow, transparency)
 * 4. Despawn when playback completes or player leaves
 *
 * Integration:
 * - entityManager: Create phantom entities
 * - sessionManager: Fetch anonymized session logs
 * - renderEngine: Apply ethereal shader + glow
 */

/**
 * Anonymized session path log (no PII)
 */
export interface AnonymizedSessionLog {
  sessionId: string;                    // Hash of original session ID
  completedAt: number;                  // When session ended (Unix ms)
  worldSeed: number;                    // World seed for deterministic rendering
  pathFrames: PhantomPathFrame[];        // Movement snapshots
  actionEvents: PhantomActionEvent[];    // Skill/emote/animation frames
}

/**
 * Single movement snapshots
 */
export interface PhantomPathFrame {
  frameIndex: number;                   // 0-based frame number
  timestamp: number;                    // Relative ms from session start
  x: number;                            // World X position
  y: number;                            // World Y position
  z: number;                            // World Z position
  direction: 'north' | 'south' | 'east' | 'west' | 'idle'; // Facing direction
  animation: 'walk' | 'run' | 'idle' | 'interact';
  speed: number;                        // Movement speed (0.0-1.0)
}

/**
 * Action/animation event
 */
export interface PhantomActionEvent {
  frameIndex: number;                   // When this happens
  timestamp: number;                    // Relative ms from session start
  actionType: 'emote' | 'skill' | 'cast' | 'item_use';
  actionName: string;                   // "wave", "dice_roll", "fireball", etc.
  targetPos?: { x: number; y: number; z: number };
  durationMs: number;                   // How long animation plays
}

/**
 * Runtime phantom entity instance
 */
export interface PhantomEntity {
  phantomId: string;                    // Unique phantom ID
  sessionId: string;                    // Which session spawned this
  entityId: string;                     // ECS entity handle
  currentFrame: number;                 // Current playback frame
  currentAction?: PhantomActionEvent;   // Currently playing action
  activeWhen: number;                   // Now timestamp when active
  despawnAt: number;                    // Unix ms when to remove this phantom
  playbackSpeed: number;                // Time multiplier (1.0 = real-time)
}

/**
 * Phantom engine configuration
 */
export interface PhantomEngineConfig {
  /**
   * How many ghosts to render simultaneously (memory limit)
   */
  maxConcurrentPhantoms?: number;

  /**
   * Base glow color (RGB hex)
   */
  glowColor?: string;

  /**
   * Opacity of phantom (0.0-1.0)
   */
  opacity?: number;

  /**
   * Playback speed multiplier (1.0 = real-time)
   */
  playbackSpeed?: number;

  /**
   * How long between spawning new phantoms (ms)
   */
  spawnIntervalMs?: number;

  /**
   * Function to create ECS entity
   */
  createEntity?: (pos: { x: number; y: number; z: number }) => string;

  /**
   * Function to update ECS entity position/animation
   */
  updateEntity?: (entityId: string, update: any) => void;

  /**
   * Function to remove ECS entity
   */
  removeEntity?: (entityId: string) => void;

  /**
   * Function to fetch session logs (returns Promise)
   */
  fetchSessionLogs?: () => Promise<AnonymizedSessionLog[]>;
}

/**
 * State manager for all active phantoms
 */
export interface PhantomEngineState {
  phantoms: Map<string, PhantomEntity>;
  sessionLogs: Map<string, AnonymizedSessionLog>;
  config: Required<PhantomEngineConfig>;
  isRunning: boolean;
  updateInterval?: NodeJS.Timeout;
}

/**
 * Create new phantom engine
 */
export function createPhantomEngine(config: PhantomEngineConfig): PhantomEngineState {
  const defaults: Required<PhantomEngineConfig> = {
    maxConcurrentPhantoms: 10,
    glowColor: '#0084ff', // Blue
    opacity: 0.35,
    playbackSpeed: 1.0,
    spawnIntervalMs: 2000,
    createEntity: () => `entity_phantom_${Math.random().toString(36).slice(2)}`,
    updateEntity: () => {},
    removeEntity: () => {},
    fetchSessionLogs: async () => [],
    ...config
  };

  return {
    phantoms: new Map(),
    sessionLogs: new Map(),
    config: defaults,
    isRunning: false
  };
}

/**
 * Start phantom engine (spawn and animate ghosts)
 */
export function startPhantomEngine(engine: PhantomEngineState): void {
  if (engine.isRunning) return;

  engine.isRunning = true;

  // Fetch session logs
  engine.config.fetchSessionLogs?.().then(logs => {
    for (const log of logs) {
      engine.sessionLogs.set(log.sessionId, log);
    }
  });

  // Update loop: advance all phantom frames and render
  engine.updateInterval = setInterval(() => {
    updatePhantoms(engine);
  }, 16); // ~60 FPS
}

/**
 * Stop phantom engine
 */
export function stopPhantomEngine(engine: PhantomEngineState): void {
  if (!engine.isRunning) return;

  engine.isRunning = false;

  // Clear all phantoms
  for (const phantom of engine.phantoms.values()) {
    engine.config.removeEntity?.(phantom.entityId);
  }
  engine.phantoms.clear();

  if (engine.updateInterval) {
    clearInterval(engine.updateInterval);
  }
}

/**
 * Core update loop: progress phantom playback
 */
function updatePhantoms(engine: PhantomEngineState): void {
  const now = Date.now();

  // Remove expired phantoms
  for (const [phantomId, phantom] of engine.phantoms.entries()) {
    if (now > phantom.despawnAt) {
      engine.config.removeEntity?.(phantom.entityId);
      engine.phantoms.delete(phantomId);
    }
  }

  // Update active phantoms
  for (const phantom of engine.phantoms.values()) {
    updatePhantomFrame(engine, phantom, now);
  }

  // Spawn new phantoms if under limit
  if (engine.phantoms.size < engine.config.maxConcurrentPhantoms) {
    const newPhantom = trySpawnPhantom(engine, now);
    if (newPhantom) {
      engine.phantoms.set(newPhantom.phantomId, newPhantom);
    }
  }
}

/**
 * Update a single phantom's frame
 */
function updatePhantomFrame(engine: PhantomEngineState, phantom: PhantomEntity, now: number): void {
  const log = engine.sessionLogs.get(phantom.sessionId);
  if (!log) return;

  // Calculate elapsed time since phantom became active
  const elapsedMs = (now - phantom.activeWhen) * engine.config.playbackSpeed;

  // Find current frame in path
  let frameIdx = 0;
  for (let i = 0; i < log.pathFrames.length; i++) {
    if (log.pathFrames[i].timestamp <= elapsedMs) {
      frameIdx = i;
    } else {
      break;
    }
  }

  phantom.currentFrame = frameIdx;

  if (frameIdx >= log.pathFrames.length) {
    phantom.despawnAt = now; // Mark for removal
    return;
  }

  const frame = log.pathFrames[frameIdx];

  // Check for action events at this frame
  const action = log.actionEvents.find(
    a => a.frameIndex === frameIdx
  );

  if (action && action !== phantom.currentAction) {
    phantom.currentAction = action;
  }

  // Apply animation/emote
  let animation: 'walk' | 'run' | 'idle' | 'interact' | 'attack' | 'emote' | 'cast' | 'defend' = frame.animation;
  if (phantom.currentAction && now - phantom.activeWhen < phantom.currentAction.durationMs) {
    animation = (phantom.currentAction.actionName as any) || 'idle';
  }

  // Update ECS entity
  engine.config.updateEntity?.(phantom.entityId, {
    position: { x: frame.x, y: frame.y, z: frame.z },
    direction: frame.direction,
    animation,
    speed: frame.speed,
    opacity: engine.config.opacity,
    glowColor: engine.config.glowColor,
    shader: 'ethereal' // Low-poly, transparent, blue-glowing shader
  });
}

/**
 * Attempt to spawn a new phantom
 */
function trySpawnPhantom(engine: PhantomEngineState, now: number): PhantomEntity | null {
  if (engine.sessionLogs.size === 0) return null;

  // Pick random session log
  const logs = Array.from(engine.sessionLogs.values());
  const log = logs[Math.floor(Math.random() * logs.length)];

  if (!log.pathFrames.length) return null;

  const startFrame = log.pathFrames[0];
  const entityId = engine.config.createEntity?.({ x: startFrame.x, y: startFrame.y, z: startFrame.z }) || '';

  const phantomId = `phantom_${now}_${Math.random().toString(36).slice(2, 11)}`;
  const lastFrame = log.pathFrames[log.pathFrames.length - 1];

  return {
    phantomId,
    sessionId: log.sessionId,
    entityId,
    currentFrame: 0,
    activeWhen: now,
    despawnAt: now + lastFrame.timestamp + 5000, // Despawn 5s after playback ends
    playbackSpeed: engine.config.playbackSpeed
  };
}

/**
 * Convert real session data to anonymized log
 * (Called serverside before sending to client)
 */
export function anonymizeSessionLog(
  sessionId: string,
  movements: Array<{ ts: number; x: number; y: number; z: number; dir: string; anim: string; speed: number }>,
  actions: Array<{ ts: number; type: string; name: string; targetX?: number; targetY?: number; targetZ?: number; durationMs: number }>,
  completedAt: number,
  worldSeed: number
): AnonymizedSessionLog {
  return {
    sessionId: hashSessionId(sessionId),
    completedAt,
    worldSeed,
    pathFrames: movements.map((m, idx) => ({
      frameIndex: idx,
      timestamp: m.ts,
      x: m.x,
      y: m.y,
      z: m.z,
      direction: (m.dir || 'idle') as 'north' | 'south' | 'east' | 'west' | 'idle',
      animation: (m.anim || 'idle') as 'walk' | 'run' | 'idle' | 'interact',
      speed: m.speed || 0
    })),
    actionEvents: actions.map((a, idx) => ({
      frameIndex: idx,
      timestamp: a.ts,
      actionType: (a.type || 'emote') as string,
      actionName: a.name,
      targetPos: a.targetX ? { x: a.targetX, y: a.targetY ?? 0, z: a.targetZ ?? 0 } : undefined,
      durationMs: a.durationMs
    }))
  };
}

/**
 * Hash session ID to prevent PII leakage
 */
function hashSessionId(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    const char = sessionId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `session_${Math.abs(hash).toString(16)}`;
}

/**
 * Get phantom statistics
 */
export function getPhantomStats(engine: PhantomEngineState): {
  activeCount: number;
  totalSessions: number;
  maxConcurrent: number;
  isRunning: boolean;
} {
  return {
    activeCount: engine.phantoms.size,
    totalSessions: engine.sessionLogs.size,
    maxConcurrent: engine.config.maxConcurrentPhantoms,
    isRunning: engine.isRunning
  };
}

/**
 * Manually despawn all phantoms
 */
export function clearAllPhantoms(engine: PhantomEngineState): void {
  for (const phantom of engine.phantoms.values()) {
    engine.config.removeEntity?.(phantom.entityId);
  }
  engine.phantoms.clear();
}

/**
 * Load new session logs
 */
export function loadSessionLogs(engine: PhantomEngineState, logs: AnonymizedSessionLog[]): void {
  engine.sessionLogs.clear();
  for (const log of logs) {
    engine.sessionLogs.set(log.sessionId, log);
  }
}

/**
 * Deterministic rendering: use world seed for reproducible ghost paths
 * (ensures same ghosts appear in same places across server resets)
 */
export function seedPhantomEngine(engine: PhantomEngineState, seed: number): void {
  // Set PRNG seed for ghost spawn distribution
  // This ensures deterministic phantom placement across restarts
  const seededRandom = (index: number) => {
    const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Re-shuffle session logs by seed
  const logs = Array.from(engine.sessionLogs.values());
  logs.sort((a, b) => seededRandom(a.sessionId.charCodeAt(0)) - seededRandom(b.sessionId.charCodeAt(0)));

  engine.sessionLogs.clear();
  for (const log of logs) {
    engine.sessionLogs.set(log.sessionId, log);
  }
}

/**
 * Prevent temporal paradox detection
 * (Ensure phantoms don't interact with living players)
 */
export function isPhantomEntity(entityId: string): boolean {
  return entityId.startsWith('entity_phantom_');
}

/**
 * Get phantom info for debug/stats
 */
export function getPhantomInfo(engine: PhantomEngineState, phantomId: string): PhantomEntity | null {
  return engine.phantoms.get(phantomId) || null;
}

// ============================================================================
// M43 PHASE C ADDITION: PHANTOM DETECTION & DIRECTOR REPUTATION
// ============================================================================

/**
 * Director phantom score (data drift detection)
 * M43 Phase C: Detect if a Director's world state diverges from peers
 */
export interface DirectorPhantomScore {
  directorId: string;
  directorName: string;
  phantomScore: number;              // 0-1, where 1.0 = high drift risk
  lastHashCheck: number;             // When last validation occurred
  calculatedWorldHash: string;       // Local hash of world state
  reportedHashes: Map<string, string>; // Other directors' reported hashes
  driftEvents: Array<{
    timestamp: number;
    type: 'drift_detected' | 'hash_mismatch' | 'event_divergence';
    description: string;
  }>;
  votingPower: number;               // 1.0 = full vote, reduced if phantom score high
}

/**
 * Calculate phantom score for a director
 * Detects data drift by comparing world hashes
 */
export function calculatePhantomScore(
  directorId: string,
  localWorldHash: string,
  peerReports: Map<string, string>
): { score: number; driftDetected: boolean; mismatchCount: number } {
  if (peerReports.size === 0) {
    // No peer data to compare
    return { score: 0, driftDetected: false, mismatchCount: 0 };
  }

  // Find most common hash (consensus)
  const hashFrequency = new Map<string, number>();
  for (const hash of peerReports.values()) {
    hashFrequency.set(hash, (hashFrequency.get(hash) ?? 0) + 1);
  }

  const consensusHash = Array.from(hashFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (!consensusHash) {
    return { score: 0, driftDetected: false, mismatchCount: 0 };
  }

  // Check if this director's hash matches consensus
  const isOutOfSync = localWorldHash !== consensusHash;
  const mismatchCount = Array.from(peerReports.values()).filter(h => h !== localWorldHash).length;
  const totalPeers = peerReports.size;
  const mismatchRatio = mismatchCount / totalPeers;

  // Score: 0 = synced, 1.0 = completely diverged
  const score = isOutOfSync ? Math.min(mismatchRatio * 1.2, 1.0) : 0;

  console.log(
    `[PhantomDetection] Director ${directorId}: score=${score.toFixed(3)}, ` +
    `consensus=${consensusHash.slice(0, 8)}..., local=${localWorldHash.slice(0, 8)}..., ` +
    `mismatches=${mismatchCount}/${totalPeers}`
  );

  return {
    score,
    driftDetected: isOutOfSync,
    mismatchCount
  };
}

/**
 * Calculate world state hash for phantom detection
 * Deterministic hash of critical world properties
 */
export function calculateWorldStateHash(worldState: any): string {
  // Hash key properties of world state (tick, epoch, entity count)
  const hashInput = JSON.stringify({
    tick: worldState.tick,
    epoch: worldState.currentEpoch,
    entityCount: worldState.entities?.length ?? 0,
    eventLogLength: worldState.eventLog?.length ?? 0,
    fragmentCount: worldState.fragmentRegistry?.fragments?.size ?? 0,
    // Add more properties as needed for comprehensive detection
  });

  return simpleHash(hashInput);
}

/**
 * Simple 32-bit hash function for world state
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Update director phantom score based on drift
 */
export function updateDirectorPhantomScore(
  score: DirectorPhantomScore,
  driftDetected: boolean,
  driftDescription?: string
): void {
  if (driftDetected) {
    score.phantomScore = Math.min(score.phantomScore + 0.15, 1.0);
    score.driftEvents.push({
      timestamp: Date.now(),
      type: 'drift_detected',
      description: driftDescription ?? 'World state divergence detected'
    });
    console.warn(`[PhantomDetection] Drift flagged for ${score.directorId}: ${driftDescription}`);
  } else {
    // Gradually reduce phantom score if synced
    score.phantomScore = Math.max(score.phantomScore - 0.05, 0);
  }

  // Adjust voting power based on phantom score
  score.votingPower = 1.0 - (score.phantomScore * 0.5); // 50% power reduction at max drift

  score.lastHashCheck = Date.now();
}

/**
 * Check if director is "phantom" (too much drift)
 * GMs with high phantom score can't vote on sealed actions
 */
export function isDirectorPhantom(score: DirectorPhantomScore, threshold: number = 0.7): boolean {
  return score.phantomScore >= threshold;
}

/**
 * Get phantom detection status for dashboard
 */
export function getPhantomDetectionStatus(
  directors: DirectorPhantomScore[]
): {
  synced: number;
  drifted: number;
  criticalDrift: number;
  averageScore: number;
} {
  const driftedDirectors = directors.filter(d => d.phantomScore > 0.3);
  const criticalDirectors = directors.filter(d => isDirectorPhantom(d));

  return {
    synced: directors.length - driftedDirectors.length,
    drifted: driftedDirectors.length,
    criticalDrift: criticalDirectors.length,
    averageScore: directors.reduce((sum, d) => sum + d.phantomScore, 0) / Math.max(directors.length, 1)
  };
}
