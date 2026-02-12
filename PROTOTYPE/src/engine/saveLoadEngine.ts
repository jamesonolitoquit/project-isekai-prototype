import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { canonicalize } from '../events/mutationLog';

export interface GameSave {
  id: string;
  name: string;
  worldInstanceId: string;
  timestamp: number;
  tick: number;
  stateSnapshot: WorldState;
  eventLog: Event[];
  checksum: string;
}

// In-memory save storage (would be localStorage or DB in production)
const SAVE_STORE = new Map<string, GameSave>();

/**
 * Create a hash-chain checksum for a save
 */
export function createSaveChecksum(save: Omit<GameSave, 'checksum'>): string {
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

  // Simple hash: SHA256-style hash of canonical JSON (for prototype, just base64 hash indicator)
  const hashSource = canonical + '|PROJECT_ISEKAI_SAVE_V1';
  let hash = 0;
  for (let i = 0; i < hashSource.length; i++) {
    const char = (hashSource.codePointAt(i) ?? 0);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Verify a save's integrity via hash check
 */
export function verifySaveIntegrity(save: GameSave): boolean {
  const expectedChecksum = createSaveChecksum({
    id: save.id,
    name: save.name,
    worldInstanceId: save.worldInstanceId,
    timestamp: save.timestamp,
    tick: save.tick,
    stateSnapshot: save.stateSnapshot,
    eventLog: save.eventLog
  });

  return save.checksum === expectedChecksum;
}

/**
 * Create a save from current world state
 */
export function createSave(
  name: string,
  currentState: WorldState,
  eventLog: Event[],
  worldInstanceId: string,
  tick: number
): GameSave {
  const saveId = `save_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const save: Omit<GameSave, 'checksum'> = {
    id: saveId,
    name,
    worldInstanceId,
    timestamp: Date.now(),
    tick,
    stateSnapshot: structuredClone(currentState),
    eventLog: structuredClone(eventLog)
  };

  const checksum = createSaveChecksum(save);
  const completeSave: GameSave = { ...save, checksum };

  SAVE_STORE.set(saveId, completeSave);
  return completeSave;
}

/**
 * Load a save by ID
 */
export function loadSave(saveId: string): GameSave | null {
  const save = SAVE_STORE.get(saveId);
  if (!save) {
    return null;
  }

  // Verify integrity before returning
  if (!verifySaveIntegrity(save)) {
    console.warn(`Save ${saveId} failed integrity check.`);
    return null;
  }

  return structuredClone(save);
}

/**
 * List all available saves (summaries)
 */
export function listSaves(): Array<{ id: string; name: string; timestamp: number; tick: number }> {
  return Array.from(SAVE_STORE.values()).map(save => ({
    id: save.id,
    name: save.name,
    timestamp: save.timestamp,
    tick: save.tick
  }));
}

/**
 * Delete a save by ID
 */
export function deleteSave(saveId: string): boolean {
  return SAVE_STORE.delete(saveId);
}

/**
 * Export save as JSON (for backup/download)
 */
export function exportSaveAsJson(save: GameSave): string {
  return JSON.stringify(save, null, 2);
}

/**
 * Import save from JSON (with integrity check)
 */
export function importSaveFromJson(jsonString: string): GameSave | null {
  try {
    const imported = JSON.parse(jsonString) as GameSave;
    
    if (!verifySaveIntegrity(imported)) {
      console.warn('Imported save failed integrity check.');
      return null;
    }

    SAVE_STORE.set(imported.id, imported);
    return imported;
  } catch (error) {
    console.error('Failed to import save:', error);
    return null;
  }
}
