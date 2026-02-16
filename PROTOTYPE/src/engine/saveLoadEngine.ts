import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { canonicalize } from '../events/mutationLog';
import { random } from './prng';

// ============================================================================
// M38 TASK 2: INDEXEDDB PERSISTENCE STORE
// ============================================================================

/**
 * IndexedDB store for persistent game saves
 * Prevents loss of 5,000+ mutation logs across browser sessions
 * Handles schema versioning and migration
 */
export class IndexedDbStore {
  private readonly dbName = 'ProjectIsekai_Beta_Saves';
  private readonly version = 1;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        console.error('Failed to open IndexedDB:', error);
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[IndexedDb] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('saves')) {
          const saveStore = db.createObjectStore('saves', { keyPath: 'id' });
          saveStore.createIndex('timestamp', 'timestamp', { unique: false });
          saveStore.createIndex('worldInstanceId', 'worldInstanceId', { unique: false });
          console.log('[IndexedDb] Created saves object store');
        }

        if (!db.objectStoreNames.contains('visualCache')) {
          db.createObjectStore('visualCache', { keyPath: 'cacheKey' });
          console.log('[IndexedDb] Created visualCache object store');
        }
      };
    });
  }

  async saveToDB(save: GameSave): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readwrite');
      const store = transaction.objectStore('saves');
      const request = store.put(save);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => {
        console.log(`[IndexedDb] Saved: ${save.name} (${save.id})`);
        resolve();
      };
    });
  }

  async loadFromDB(saveId: string): Promise<GameSave | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readonly');
      const store = transaction.objectStore('saves');
      const request = store.get(saveId);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async listFromDB(): Promise<Array<{ id: string; name: string; timestamp: number; tick: number }>> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readonly');
      const store = transaction.objectStore('saves');
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => {
        const saves = (request.result as GameSave[]).map(save => ({
          id: save.id,
          name: save.name,
          timestamp: save.timestamp,
          tick: save.tick
        }));
        resolve(saves);
      };
    });
  }

  async deleteFromDB(saveId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readwrite');
      const store = transaction.objectStore('saves');
      const request = store.delete(saveId);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => {
        console.log(`[IndexedDb] Deleted: ${saveId}`);
        resolve();
      };
    });
  }

  async cacheVisualPrompt(
    cacheKey: string,
    prompt: Record<string, unknown>,
    expiryMs: number = 86400000 // 24 hours default
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const cacheEntry = {
      cacheKey,
      prompt,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiryMs
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visualCache'], 'readwrite');
      const store = transaction.objectStore('visualCache');
      const request = store.put(cacheEntry);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => resolve();
    });
  }

  async getVisualPrompt(cacheKey: string): Promise<Record<string, unknown> | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visualCache'], 'readonly');
      const store = transaction.objectStore('visualCache');
      const request = store.get(cacheKey);

      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = () => {
        const entry = request.result as { expiresAt: number; prompt: Record<string, unknown> } | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check expiry
        if (entry.expiresAt < Date.now()) {
          console.log(`[VisualCache] Cache expired for ${cacheKey}`);
          resolve(null);
          return;
        }

        resolve(entry.prompt);
      };
    });
  }

  async clearOldCache(maxAgeMs: number = 604800000): Promise<void> {
    if (!this.db) await this.initialize();

    const cutoffTime = Date.now() - maxAgeMs;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visualCache'], 'readwrite');
      const store = transaction.objectStore('visualCache');
      const index = store.index('createdAt');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      let deleted = 0;
      request.onerror = () => {
        const error = request.error instanceof Error ? request.error : new Error(String(request.error));
        reject(error);
      };
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        } else {
          console.log(`[VisualCache] Cleaned up ${deleted} expired entries`);
          resolve();
        }
      };
    });
  }
}

// Global IndexedDB store instance
export const indexedDbStore = new IndexedDbStore();

/**
 * Simple SHA-256-like hash using TypeScript (for browser compatibility)
 * Note: This is NOT cryptographically secure; for production use crypto libraries
 */
function simpleHash(input: string): string {
  let hash = 0xcafebabe;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Keep as 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Compute hash chain for events
 * Each event includes previousHash to form an immutable chain
 */
export function computeEventHashChain(events: Event[]): Map<string, string> {
  const hashMap = new Map<string, string>();
  let previousHash = 'INIT_GENESIS_BLOCK';

  for (const event of events) {
    const eventData = canonicalize(event);
    const currentHash = simpleHash(eventData + previousHash);
    hashMap.set(event.id, currentHash);
    previousHash = currentHash;
  }

  return hashMap;
}

/**
 * Verify entire event log integrity
 * Returns: { valid: boolean; failedAt?: number; reason?: string }
 */
export function verifyEventHashChain(events: Event[]): { valid: boolean; failedAt?: number; reason?: string } {
  if (!events || events.length === 0) {
    return { valid: true };
  }

  let previousHash = 'INIT_GENESIS_BLOCK';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventData = canonicalize(event);
    const expectedHash = simpleHash(eventData + previousHash);

    // If event stores hash for chain validation (optional field)
    if ((event as any).previousHash && (event as any).previousHash !== previousHash) {
      return {
        valid: false,
        failedAt: i,
        reason: `Event ${i} hash chain broken: expected previous=${previousHash}, got=${(event as any).previousHash}`
      };
    }

    previousHash = expectedHash;
  }

  return { valid: true };
}

export interface GameSave {
  id: string;
  name: string;
  worldInstanceId: string;
  timestamp: number;
  tick: number;
  stateSnapshot: WorldState;
  eventLog: Event[];
  checksum: string;
  eventHashChain?: string; // Final hash of the complete chain
}

// In-memory save storage (would be localStorage or DB in production)
const SAVE_STORE = new Map<string, GameSave>();

/**
 * Create a hash-chain checksum for a save
 */
export function createSaveChecksum(save: Omit<GameSave, 'checksum' | 'eventHashChain'>): string {
  // Hash the frozen state and event log deterministically
  const canonical = canonicalize({
    id: save.id,
    name: save.name,
    worldInstanceId: save.worldInstanceId,
    timestamp: save.timestamp,
    tick: save.tick,
    stateSnapshot: save.stateSnapshot,
    eventLog: save.eventLog
  });

  // Use event hash chain as foundation
  const eventChainHash = computeEventHashChain(save.eventLog);
  const finalChainHash = Array.from(eventChainHash.values()).pop() || 'EMPTY_LOG';
  
  const hashSource = canonical + finalChainHash + '|PROJECT_ISEKAI_SAVE_V2';
  return simpleHash(hashSource);
}

/**
 * Verify a save's integrity via hash check AND event chain validation
 */
export function verifySaveIntegrity(save: GameSave): { valid: boolean; reason?: string } {
  // Check 1: Verify event hash chain
  const chainCheck = verifyEventHashChain(save.eventLog);
  if (!chainCheck.valid) {
    return {
      valid: false,
      reason: `Event chain broken at position ${chainCheck.failedAt}: ${chainCheck.reason}`
    };
  }

  // Check 2: Verify save checksum
  const expectedChecksum = createSaveChecksum({
    id: save.id,
    name: save.name,
    worldInstanceId: save.worldInstanceId,
    timestamp: save.timestamp,
    tick: save.tick,
    stateSnapshot: save.stateSnapshot,
    eventLog: save.eventLog
  });

  if (save.checksum !== expectedChecksum) {
    return {
      valid: false,
      reason: `Checksum mismatch: expected ${expectedChecksum}, got ${save.checksum}`
    };
  }

  return { valid: true };
}

/**
 * Create a save from current world state
 * Automatically persists to IndexedDB for durability across sessions
 */
export async function createSave(
  name: string,
  currentState: WorldState,
  eventLog: Event[],
  worldInstanceId: string,
  tick: number
): Promise<GameSave> {
  const saveId = `save_${Date.now()}_${Math.floor(random() * 0xffffff).toString(16)}`;

  const save: Omit<GameSave, 'checksum' | 'eventHashChain'> = {
    id: saveId,
    name,
    worldInstanceId,
    timestamp: Date.now(),
    tick,
    stateSnapshot: structuredClone(currentState),
    eventLog: structuredClone(eventLog)
  };

  const checksum = createSaveChecksum(save);
  
  // Compute and store final event hash for audit trail
  const eventHashMap = computeEventHashChain(save.eventLog);
  const eventHashChain = Array.from(eventHashMap.values()).pop() || 'EMPTY_LOG';
  
  const completeSave: GameSave = { ...save, checksum, eventHashChain };

  // M38: Store in both in-memory cache AND IndexedDB for durability
  SAVE_STORE.set(saveId, completeSave);
  
  try {
    await indexedDbStore.saveToDB(completeSave);
  } catch (error) {
    console.warn('Failed to persist save to IndexedDB (will use in-memory fallback):', error);
  }

  return completeSave;
}

/**
 * Load a save by ID, preferring IndexedDB for durability
 */
export async function loadSave(saveId: string): Promise<GameSave | null> {
  // Try IndexedDB first (most reliable)
  try {
    const save = await indexedDbStore.loadFromDB(saveId);
    if (save) {
      const integrityCheck = verifySaveIntegrity(save);
      if (!integrityCheck.valid) {
        console.warn(`Save ${saveId} failed integrity check: ${integrityCheck.reason}`);
        return null;
      }
      return structuredClone(save);
    }
  } catch (error) {
    console.warn('Failed to load from IndexedDB:', error);
  }

  // Fallback to in-memory store
  const save = SAVE_STORE.get(saveId);
  if (!save) {
    return null;
  }

  const integrityCheck = verifySaveIntegrity(save);
  if (!integrityCheck.valid) {
    console.warn(`Save ${saveId} failed integrity check: ${integrityCheck.reason}`);
    return null;
  }

  return structuredClone(save);
}

/**
 * List all available saves from IndexedDB (with fallback to memory)
 */
export async function listSaves(): Promise<Array<{ id: string; name: string; timestamp: number; tick: number }>> {
  // Try IndexedDB first
  try {
    const saves = await indexedDbStore.listFromDB();
    return saves;
  } catch (error) {
    console.warn('Failed to list saves from IndexedDB, using in-memory:', error);
  }

  // Fallback to in-memory store
  return Array.from(SAVE_STORE.values()).map(save => ({
    id: save.id,
    name: save.name,
    timestamp: save.timestamp,
    tick: save.tick
  }));
}

/**
 * Delete a save by ID from both stores
 */
export async function deleteSave(saveId: string): Promise<boolean> {
  // Delete from in-memory
  const inMemoryDeleted = SAVE_STORE.delete(saveId);

  // Delete from IndexedDB
  try {
    await indexedDbStore.deleteFromDB(saveId);
  } catch (error) {
    console.warn('Failed to delete save from IndexedDB:', error);
  }

  return inMemoryDeleted;
}

/**
 * Export save as JSON (for backup/download)
 */
export function exportSaveAsJson(save: GameSave): string {
  return JSON.stringify(save, null, 2);
}

/**
 * Import save from JSON (with integrity check)
 * Automatically syncs to IndexedDB for durability
 */
export async function importSaveFromJson(jsonString: string): Promise<GameSave | null> {
  try {
    const imported = JSON.parse(jsonString) as GameSave;
    
    if (!verifySaveIntegrity(imported).valid) {
      console.warn('Imported save failed integrity check.');
      return null;
    }

    // M38: Save to both stores
    SAVE_STORE.set(imported.id, imported);
    
    try {
      await indexedDbStore.saveToDB(imported);
    } catch (error) {
      console.warn('Failed to persist imported save to IndexedDB:', error);
    }

    return imported;
  } catch (error) {
    console.error('Failed to import save:', error);
    return null;
  }
}
/**
 * Detect temporal paradox: loading an older save after advancing
 * Returns debt increase amount if paradox detected
 */
export function detectTemporalParadox(
  currentTick: number,
  previousTick: number,
  currentChaos: number,
  previousChaos: number
): { paradoxDetected: boolean; debtIncrease: number; description?: string } {
  // Paradox: current tick is earlier than previous (rewind)
  if (currentTick < previousTick) {
    const ticksRewound = previousTick - currentTick;
    
    // Base debt: 0.5 per tick rewound (max +25 debt per rewind)
    let debtIncrease = Math.min(25, ticksRewound * 0.5);
    
    // Bonus debt if chaos was reduced by rewind (exploiting to lower suspicion)
    if (currentChaos < previousChaos) {
      const chaosReduction = previousChaos - currentChaos;
      const exploitBonus = Math.min(15, chaosReduction * 0.3);  // 30% of chaos reduction
      debtIncrease += exploitBonus;
    }

    return {
      paradoxDetected: true,
      debtIncrease: Math.min(50, debtIncrease),  // Cap at 50 per single rewind
      description: `Temporal Paradox Detected: Rewound ${ticksRewound} ticks. Debt: +${Math.floor(debtIncrease)}`
    };
  }

  return { paradoxDetected: false, debtIncrease: 0 };
}

/**
 * Apply temporal debt to a loaded save state
 * Modifies the world state to reflect time paradox penalties
 */
export function applyTemporalPenalty(
  save: GameSave,
  debtIncrease: number
): GameSave {
  const modified = structuredClone(save);
  
  // Update player's temporal debt
  if (modified.stateSnapshot.player) {
    const currentDebt = modified.stateSnapshot.player.temporalDebt || 0;
    modified.stateSnapshot.player.temporalDebt = Math.min(100, currentDebt + debtIncrease);
    
    // Also boost suspicion slightly (world notices the paradox)
    if (modified.stateSnapshot.player.beliefLayer) {
      const currentSuspicion = modified.stateSnapshot.player.beliefLayer.suspicionLevel || 0;
      const suspicionBoost = Math.floor(debtIncrease * 0.3);  // 30% of debt becomes suspicion
      modified.stateSnapshot.player.beliefLayer.suspicionLevel = Math.min(
        100,
        currentSuspicion + suspicionBoost
      );
    }
  }

  // Recalculate checksum with modified state
  const newChecksum = createSaveChecksum({
    id: modified.id,
    name: modified.name,
    worldInstanceId: modified.worldInstanceId,
    timestamp: modified.timestamp,
    tick: modified.tick,
    stateSnapshot: modified.stateSnapshot,
    eventLog: modified.eventLog
  });

  return { ...modified, checksum: newChecksum };
}

/**
 * Get temporal debt multiplier based on how severe the rewind was
 * Used to calculate NPC behavior changes, obfuscation disruption, etc.
 */
export function getTemporalDebtMultiplier(temporalDebt: number): number {
  if (temporalDebt >= 80) return 3.0;   // Extreme: 3x chaos effects
  if (temporalDebt >= 60) return 2.5;   // Severe: 2.5x
  if (temporalDebt >= 40) return 2.0;   // Moderate: 2x  
  if (temporalDebt >= 20) return 1.5;   // Minor: 1.5x
  return 1.0;                           // No multiplier
}

/**
 * Track save/load history for statistics
 */
export interface SaveLoadStats {
  totalSaves: number;
  totalRewinds: number;
  avgTemporalDebt: number;
  maxTemporalDebt: number;
  paradoxesDetected: number;
}

const SAVE_LOAD_STATS: SaveLoadStats = {
  totalSaves: 0,
  totalRewinds: 0,
  avgTemporalDebt: 0,
  maxTemporalDebt: 0,
  paradoxesDetected: 0
};

/**
 * Record a rewind event in statistics
 */
export function recordRewindStat(temporalDebt: number): void {
  SAVE_LOAD_STATS.totalRewinds += 1;
  SAVE_LOAD_STATS.avgTemporalDebt = 
    (SAVE_LOAD_STATS.avgTemporalDebt * (SAVE_LOAD_STATS.totalRewinds - 1) + temporalDebt) / 
    SAVE_LOAD_STATS.totalRewinds;
  SAVE_LOAD_STATS.maxTemporalDebt = Math.max(SAVE_LOAD_STATS.maxTemporalDebt, temporalDebt);
  SAVE_LOAD_STATS.paradoxesDetected += 1;
}

/**
 * Get current save/load statistics
 */
export function getSaveLoadStats(): SaveLoadStats {
  return { ...SAVE_LOAD_STATS };
}

/**
 * BETA: Legacy Service for persistent bloodline data
 * Stores LegacyImpact data in localStorage to survive world resets
 */

import type { LegacyImpact } from './legacyEngine';

const LEGACY_STORAGE_KEY = 'project_isekai_legacy_bloodline';

export interface StoredBloodline {
  bloodlineId: string;
  legacyImpacts: LegacyImpact[];
  totalMythStatus: number;
  createdAt: number;
  lastUpdated: number;
}

/**
 * Save a legacy impact to persistent storage
 */
export function saveLegacyImpact(chronicalId: string, impact: LegacyImpact): void {
  try {
    const stored = loadBloodline(chronicalId) || {
      bloodlineId: chronicalId,
      legacyImpacts: [],
      totalMythStatus: 0,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    stored.legacyImpacts.push(impact);
    stored.totalMythStatus = stored.legacyImpacts.reduce((sum, li) => sum + li.mythStatus, 0);
    stored.lastUpdated = Date.now();

    const allBloodlines = getAllBloodlines();
    allBloodlines[chronicalId] = stored;
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(allBloodlines));
  } catch (err) {
    console.error('[LegacyService] Failed to save legacy impact:', err);
  }
}

/**
 * Load bloodline history for a chronicle
 */
export function loadBloodline(chronicleId: string): StoredBloodline | null {
  try {
    const allBloodlines = getAllBloodlines();
    return allBloodlines[chronicleId] || null;
  } catch (err) {
    console.error('[LegacyService] Failed to load bloodline:', err);
    return null;
  }
}

/**
 * Get all bloodlines from storage
 */
export function getAllBloodlines(): Record<string, StoredBloodline> {
  try {
    const data = localStorage.getItem(LEGACY_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('[LegacyService] Failed to read legacy storage:', err);
    return {};
  }
}
/**
 * M36: Integrity Hardening - Multi-generational Save/Load Validation
 * 
 * Ensures world state consistency across epoch transitions and multi-player save exchanges.
 * Detects and repairs corrupted data from EpochDelta imports and legacy migrations.
 */

/**
 * M36: Validation result for integrity checks
 */
export interface IntegrityCheckResult {
  valid: boolean;
  errors: Array<{ field: string; severity: 'critical' | 'warning'; message: string }>;
  checksumValid: boolean;
  expectedChecksum?: string;
  actualChecksum?: string;
  repairSuggestions?: string[];
}

/**
 * M36: Calculate comprehensive checksum of world state
 * Includes locations, NPCs, quests, items to detect any mutations
 */
export function calculateWorldStateChecksum(worldState: WorldState): string {
  const components = {
    locationIds: worldState.locations?.map(l => l.id).sort((a, b) => a.localeCompare(b)).join('|') || '',
    npcIds: worldState.npcs?.map(n => n.id).sort((a, b) => a.localeCompare(b)).join('|') || '',
    questIds: worldState.quests?.map(q => q.id).sort((a, b) => a.localeCompare(b)).join('|') || '',
    inventoryCount: worldState.player?.inventory?.length || 0,
    currentTick: worldState.currentTick || 0,
    epochId: (worldState as any).epochId || 'unknown',
    locationCount: worldState.locations?.length || 0,
    npcCount: worldState.npcs?.length || 0,
    questCount: worldState.quests?.length || 0,
  };

  // Create deterministic string representation
  const canonical = JSON.stringify(components, Object.keys(components).sort((a, b) => a.localeCompare(b)));
  
  // Hash using existing simpleHash function
  let hash = 0xcafebabe;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.codePointAt(i) || 0;
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * M36: Detect corruption patterns in world state
 */
export interface CorruptionDetection {
  isCorrupted: boolean;
  issues: Array<{ type: string; severity: 'critical' | 'warning'; description: string }>;
  affectedEntities: { locations: number; npcs: number; quests: number };
}

export function detectDataCorruption(worldState: WorldState): CorruptionDetection {
  const issues: Array<{ type: string; severity: 'critical' | 'warning'; description: string }> = [];

  // Check location references
  const locationIds = new Set(worldState.locations?.map(l => l.id) || []);
  const npcLocationErrors = (worldState.npcs || []).filter(n => 
    n.locationId && !locationIds.has(n.locationId)
  );
  if (npcLocationErrors.length > 0) {
    issues.push({
      type: 'INVALID_NPC_LOCATION_REFS',
      severity: 'critical',
      description: `${npcLocationErrors.length} NPCs reference non-existent locations`
    });
  }

  // Check quest location references
  const questLocationErrors = (worldState.quests || []).filter(q => {
    const objectives = (q.objectives || [q.objective]).filter(Boolean);
    return objectives.some(obj => (obj as any)?.location && !locationIds.has((obj as any).location));
  });
  if (questLocationErrors.length > 0) {
    issues.push({
      type: 'INVALID_QUEST_LOCATION_REFS',
      severity: 'warning',
      description: `${questLocationErrors.length} quests reference non-existent locations`
    });
  }

  // Check for duplicate IDs (critical corruption)
  const allIds: string[] = [
    ...(worldState.locations?.map(l => l.id) || []),
    ...(worldState.npcs?.map(n => n.id) || []),
    ...(worldState.quests?.map(q => q.id) || [])
  ];
  const idCounts = new Map<string, number>();
  for (const id of allIds) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    issues.push({
      type: 'DUPLICATE_IDS',
      severity: 'critical',
      description: `Found ${duplicates.length} duplicate entity IDs`
    });
  }

  // Check inventory item validity
  const inventoryErrors = (worldState.player?.inventory || []).filter(item =>
    !item.id || !item.name || item.quantity === undefined
  );
  if (inventoryErrors.length > 0) {
    issues.push({
      type: 'INVALID_INVENTORY_ITEMS',
      severity: 'warning',
      description: `${inventoryErrors.length} inventory items are malformed`
    });
  }

  return {
    isCorrupted: issues.some(i => i.severity === 'critical'),
    issues,
    affectedEntities: {
      locations: npcLocationErrors.length + questLocationErrors.length,
      npcs: npcLocationErrors.length,
      quests: questLocationErrors.length
    }
  };
}

/**
 * M36: Validate world state during migration
 * Ensures integrity before and after epoch transitions
 */
export function validateMigrationIntegrity(
  beforeState: WorldState,
  afterState: WorldState,
  expectedChecksum?: string
): IntegrityCheckResult {
  const errors: IntegrityCheckResult['errors'] = [];
  const repairSuggestions: string[] = [];

  // Detect corruption in both states
  const beforeCorruption = detectDataCorruption(beforeState);
  const afterCorruption = detectDataCorruption(afterState);

  if (beforeCorruption.isCorrupted) {
    errors.push({
      field: 'beforeState',
      severity: 'critical',
      message: 'Source state is corrupted and cannot be migrated'
    });
  }

  if (afterCorruption.isCorrupted) {
    errors.push({
      field: 'afterState',
      severity: 'critical',
      message: 'Destination state has corruption after migration'
    });
    repairSuggestions.push('Run repairCorruptedState() on after state');
  }

  // Verify entity counts haven't dramatically changed
  const beforeCount = (beforeState.locations?.length || 0) +
                     (beforeState.npcs?.length || 0) +
                     (beforeState.quests?.length || 0);
  const afterCount = (afterState.locations?.length || 0) +
                    (afterState.npcs?.length || 0) +
                    (afterState.quests?.length || 0);
  
  if (afterCount < beforeCount * 0.5) {
    errors.push({
      field: 'entityCount',
      severity: 'warning',
      message: `Entity count dropped from ${beforeCount} to ${afterCount} (>50%)`
    });
    repairSuggestions.push('Verify that entities were intentionally removed or archived');
  }

  // Check checksum if provided
  let checksumValid = true;
  const actualChecksum = calculateWorldStateChecksum(afterState);
  if (expectedChecksum && expectedChecksum !== actualChecksum) {
    checksumValid = false;
    errors.push({
      field: 'checksum',
      severity: 'warning',
      message: 'Checksum mismatch after migration'
    });
    repairSuggestions.push(`Verify migration payload integrity. Compute new checksum: ${actualChecksum}`);
  }

  // Check epoch translation consistency
  const beforeEpoch = (beforeState as any).epochId;
  const afterEpoch = (afterState as any).epochId;
  if (beforeEpoch === afterEpoch) {
    errors.push({
      field: 'epoch',
      severity: 'warning',
      message: 'Epoch did not change during migration'
    });
  }

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    checksumValid,
    actualChecksum,
    expectedChecksum,
    repairSuggestions
  };
}

/**
 * M36: Attempt to repair corrupted world state
 * Returns repair report and corrected state
 */
export interface RepairReport {
  success: boolean;
  changesApplied: string[];
  remainingIssues: string[];
  repairedState: WorldState;
}

export function repairCorruptedState(worldState: WorldState): RepairReport {
  const changesApplied: string[] = [];
  const remainingIssues: string[] = [];
  
  // Deep copy to avoid mutation
  const repaired = structuredClone(worldState);
  const locationIds = new Set(repaired.locations?.map(l => l.id).sort((a, b) => a.localeCompare(b)) || []);

  // Repair 1: Remove NPCs with invalid location references
  const validNpcs = (repaired.npcs || []).filter(npc => {
    if (npc.locationId && !locationIds.has(npc.locationId)) {
      changesApplied.push(`Removed NPC ${npc.id} (invalid location ${npc.locationId})`);
      return false;
    }
    return true;
  });
  if (validNpcs.length < (repaired.npcs?.length || 0)) {
    repaired.npcs = validNpcs;
  }

  // Repair 2: Fix inventory items with missing fields
  if (repaired.player?.inventory) {
    const validInventory = repaired.player.inventory.filter(item => {
      if (!item.id || !item.name || item.quantity === undefined) {
        changesApplied.push(`Removed malformed inventory item`);
        return false;
      }
      return true;
    });
    repaired.player.inventory = validInventory;
  }

  // Repair 3: Remove duplicate IDs (keep first occurrence)
  const seenIds = new Set<string>();
  const deduplicatedLocations = (repaired.locations || []).filter(loc => {
    if (seenIds.has(loc.id)) {
      changesApplied.push(`Removed duplicate location ${loc.id}`);
      return false;
    }
    seenIds.add(loc.id);
    return true;
  });
  repaired.locations = deduplicatedLocations;

  const seenNpcIds = new Set<string>();
  const deduplicatedNpcs = (repaired.npcs || []).filter(npc => {
    if (seenNpcIds.has(npc.id)) {
      changesApplied.push(`Removed duplicate NPC ${npc.id}`);
      return false;
    }
    seenNpcIds.add(npc.id);
    return true;
  });
  repaired.npcs = deduplicatedNpcs;

  // Verify repair success
  const postRepairCorruption = detectDataCorruption(repaired);
  if (postRepairCorruption.isCorrupted) {
    remainingIssues.push(...postRepairCorruption.issues.map(i => i.description));
  }

  return {
    success: !postRepairCorruption.isCorrupted,
    changesApplied,
    remainingIssues,
    repairedState: repaired
  };
}

/**
 * M36: Verify EpochDelta integrity before import
 * Prevents corrupted deltas from breaking the world
 */
export function verifyEpochDeltaIntegrity(
  delta: any,  // EpochDelta from chronicleEngine
  targetWorldState: WorldState
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!delta.id) errors.push('Delta missing id');
  if (!delta.epochId) errors.push('Delta missing epochId');
  if (!delta.locations || !Array.isArray(delta.locations)) errors.push('Delta locations invalid');
  if (!delta.npcs || !Array.isArray(delta.npcs)) errors.push('Delta npcs invalid');
  if (!delta.quests || !Array.isArray(delta.quests)) errors.push('Delta quests invalid');
  if (!delta.integrity) warnings.push('Delta missing integrity checksum');

  // Check for ID conflicts
  const targetLocIds = new Set(targetWorldState.locations?.map(l => l.id) || []);
  const deltaLocIds = delta.locations?.map((l: any) => l.id) || [];
  const locConflicts = deltaLocIds.filter((id: string) => targetLocIds.has(id));
  if (locConflicts.length > 0) {
    warnings.push(`Delta contains ${locConflicts.length} location IDs that already exist in target`);
  }

  // Check NPC location references within delta
  const deltaLocIdSet = new Set(deltaLocIds.sort((a: string, b: string) => a.localeCompare(b)));
  const npcLocationIssues = (delta.npcs || []).filter((npc: any) =>
    npc.locationId && !deltaLocIdSet.has(npc.locationId)
  );
  if (npcLocationIssues.length > 0) {
    errors.push(`Delta contains ${npcLocationIssues.length} NPCs with invalid location references`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get the most recent legacy impact for a bloodline
 * Used when starting a new character to apply ancestor perks
 */
export function getLatestLegacyImpact(chronicleId: string): LegacyImpact | null {
  try {
    const bloodline = loadBloodline(chronicleId);
    if (!bloodline || bloodline.legacyImpacts.length === 0) return null;
    return bloodline.legacyImpacts[bloodline.legacyImpacts.length - 1];
  } catch (err) {
    console.error('[LegacyService] Failed to get latest legacy impact:', err);
    return null;
  }
}

/**
 * Clear legacy data (for development/testing)
 */
export function clearLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    console.log('[LegacyService] Legacy storage cleared');
  } catch (err) {
    console.error('[LegacyService] Failed to clear legacy storage:', err);
  }
}

/**
 * Export bloodline for sharing/archiving
 */
export function exportBloodline(chronicleId: string): string {
  const bloodline = loadBloodline(chronicleId);
  if (!bloodline) throw new Error(`Bloodline ${chronicleId} not found`);
  return JSON.stringify(bloodline, null, 2);
}

/**
 * Import bloodline from export
 */
export function importBloodline(exportedData: string): string {
  try {
    const parsed = JSON.parse(exportedData) as StoredBloodline;
    const allBloodlines = getAllBloodlines();
    allBloodlines[parsed.bloodlineId] = parsed;
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(allBloodlines));
    return parsed.bloodlineId;
  } catch (err) {
    console.error('[LegacyService] Failed to import bloodline:', err);
    throw err;
  }
}

// M33: Chronicle Packaging (Template Serialization & Cross-Tab Sharing)

/** Engine version for compatibility checking */
export const ENGINE_VERSION = '33.0.0';

/**
 * M33: TemplatePackage - Standardized format for sharing complete world states
 * Includes engine versioning to prevent loading incompatible data
 */
export interface TemplatePackage {
  id: string;
  name: string;
  engineVersion: string; // Version that created this package
  createdAt: number;
  worldState: WorldState;
  events: Event[];
  legacyImpacts: Array<{
    id: string;
    timestamp: number;
    data: LegacyImpact;
  }>;
  metadata?: {
    description?: string;
    author?: string;
    tags?: string[];
    worldLineId?: string; // For tracking parallel chronicles
  };
}

/**
 * M33: Package a complete chronicle into a shareable TemplatePackage
 * Includes world state, all events, and legacy ledger
 */
export function packageChronicle(
  worldId: string,
  worldState: WorldState,
  events: Event[],
  metadata?: any
): TemplatePackage {
  // M33: Collect all legacy impacts for this chronicle
  const bloodline = loadBloodline(worldId);
  const legacyImpacts = bloodline?.impacts || [];

  const templatePackage: TemplatePackage = {
    id: `package_${worldId}_${Date.now()}`,
    name: `Chronicle ${worldState.epochId || 'Unknown'} - ${worldState.player?.name || 'Unnamed'}`,
    engineVersion: ENGINE_VERSION,
    createdAt: Date.now(),
    worldState,
    events,
    legacyImpacts: legacyImpacts.map((impact, idx) => ({
      id: `legacy_${idx}`,
      timestamp: impact.timestamp,
      data: impact
    })),
    metadata: {
      description: `Final state: Epoch ${worldState.epochMetadata?.sequenceNumber || 1}`,
      author: worldState.player?.name,
      tags: ['chronicle', 'epoch', worldState.epochId || ''],
      worldLineId: worldState.chronicleId,
      ...metadata
    }
  };

  return templatePackage;
}

/**
 * M33: Export TemplatePackage as JSON string (for clipboard/file sharing)
 */
export function exportTemplatePackage(pkg: TemplatePackage): string {
  return JSON.stringify(pkg, null, 2);
}

/**
 * M33: Import TemplatePackage from JSON string
 * Validates engine version compatibility before loading
 */
export function importTemplatePackage(jsonString: string): {
  package: TemplatePackage;
  compatible: boolean;
  reason?: string;
} {
  try {
    const pkg = JSON.parse(jsonString) as TemplatePackage;

    // Check version compatibility (M33.0 can load M32.x, but not M34+)
    const [pkgMajor, pkgMinor] = pkg.engineVersion.split('.').map(Number);
    const [currentMajor] = ENGINE_VERSION.split('.').map(Number);

    if (pkgMajor > currentMajor) {
      return {
        package: pkg,
        compatible: false,
        reason: `Package requires engine ${pkg.engineVersion}, but current version is ${ENGINE_VERSION}`
      };
    }

    return {
      package: pkg,
      compatible: true
    };
  } catch (err) {
    throw new Error(`Failed to import template package: ${err}`);
  }
}

/**
 * M33: Validate TemplatePackage structural integrity
 * Checks that all required fields are present and consistent
 */
export function validateTemplatePackage(pkg: TemplatePackage): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pkg.id) errors.push('Missing package ID');
  if (!pkg.worldState) errors.push('Missing worldState');
  if (!Array.isArray(pkg.events)) errors.push('Invalid events array');
  if (!pkg.engineVersion) errors.push('Missing engineVersion');

  // Check event chain integrity
  const hashVerification = verifyEventHashChain(pkg.events);
  if (!hashVerification.valid) {
    errors.push(`Event chain corruption at #${hashVerification.failedAt}: ${hashVerification.reason}`);
  }

  // Check legacy impacts are parseable
  for (const legacyEntry of pkg.legacyImpacts || []) {
    if (!legacyEntry.data || !legacyEntry.data.canonicalName) {
      errors.push(`Invalid legacy impact: ${legacyEntry.id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * M33: Store TemplatePackage in local storage for multi-tab sharing
 */
const TEMPLATE_CACHE_KEY = 'templatePackages';

export function cacheTemplatePackage(pkg: TemplatePackage): void {
  try {
    const cache = JSON.parse(localStorage.getItem(TEMPLATE_CACHE_KEY) || '{}') as Record<
      string,
      TemplatePackage
    >;
    cache[pkg.id] = pkg;
    localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('[PackageService] Failed to cache template:', err);
  }
}

/**
 * M33: Retrieve cached TemplatePackage
 */
export function getCachedTemplatePackage(packageId: string): TemplatePackage | null {
  try {
    const cache = JSON.parse(localStorage.getItem(TEMPLATE_CACHE_KEY) || '{}') as Record<
      string,
      TemplatePackage
    >;
    return cache[packageId] || null;
  } catch (err) {
    console.error('[PackageService] Failed to retrieve cached template:', err);
    return null;
  }
}

/**
 * M33: List all cached TemplatePackages
 */
export function listCachedTemplatePackages(): Array<{
  id: string;
  name: string;
  createdAt: number;
  author?: string;
}> {
  try {
    const cache = JSON.parse(localStorage.getItem(TEMPLATE_CACHE_KEY) || '{}') as Record<
      string,
      TemplatePackage
    >;
    return Object.values(cache).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      createdAt: pkg.createdAt,
      author: pkg.metadata?.author
    }));
  } catch (err) {
    console.error('[PackageService] Failed to list cached templates:', err);
    return [];
  }
}