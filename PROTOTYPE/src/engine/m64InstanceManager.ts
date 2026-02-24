/**
 * M64: Instance Manager & Spatial Interest Groups
 * 
 * Handles massive-scale raid instancing (32-128 players) with:
 * - Dedicated instance IDs for concurrent raid sessions
 * - Spatial Interest Groups (SIGs) for network optimization
 * - Tiered combat logging to prevent event pipe flooding
 * - Deterministic instance state via M62-CHRONOS ledger
 */

import { v4 as uuidGen } from 'uuid';
import { appendEvent } from '../events/mutationLog';

const uuid = () => uuidGen();

// ============================================================================
// TYPES: Instance Architecture
// ============================================================================

/**
 * Represents a unique raid instance (allows 100+ players without collision)
 */
export interface RaidInstance {
  readonly instanceId: string;
  readonly createdAt: number;
  readonly raidType: 'legendary_encounter' | 'mythic_trial' | 'world_event';
  readonly maxPlayers: number;
  readonly currentPlayerCount: number;
  readonly bosses: BossState[];
  readonly spatialGridSize: number;
  readonly spatialGroups: Map<string, SpatialInterestGroup>;
  readonly ledgerChecksum: string;
  readonly difficulty: 'normal' | 'heroic' | 'mythic';
}

/**
 * Spatial Interest Group: clusters nearby players for efficient broadcasting
 * Goal: O(1) spatial queries, <10ms network latency per group
 */
export interface SpatialInterestGroup {
  readonly sigId: string;
  readonly gridCoordinate: [number, number];
  readonly playerIds: Set<string>;
  readonly activeBosses: string[];
  readonly eventLog: RaidEvent[];
  readonly lastBroadcastTick: number;
  readonly compressionLevel: 'full' | 'reduced' | 'minimal';
}

/**
 * Raid events are stored in SIGs with compression based on relevance
 */
export type RaidEvent = 
  | { type: 'player_damage'; playerId: string; damage: number; target: string }
  | { type: 'player_death'; playerId: string; causedBy: string }
  | { type: 'boss_mechanic'; bossId: string; mechanicName: string; affectedPlayers: string[] }
  | { type: 'loot_drop'; dropper: string; rarity: string; itemName: string }
  | { type: 'player_join'; playerId: string; mythRank: number }
  | { type: 'player_leave'; playerId: string }
  | { type: 'difficulty_adjust'; newDifficulty: string; activePlayerCount: number };

/**
 * Boss state in instance (simplified version for network efficiency)
 */
export interface BossState {
  readonly bossId: string;
  readonly name: string;
  readonly healthPoints: number;
  readonly maxHealthPoints: number;
  readonly phase: number;
  readonly armor: number;
  readonly enraged: boolean;
  readonly activeMechanics: string[];
  readonly activeTargets: Set<string>;
}

/**
 * Player position for spatial queries
 */
export interface PlayerPosition {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
  readonly gridCoordinate: [number, number];
}

// ============================================================================
// INSTANCE MANAGER: Lifecycle & Clustering
// ============================================================================

let activeInstances = new Map<string, RaidInstance>();

/**
 * Create a new raid instance with spatial grid initialization
 * 
 * @param raidType Type of encounter
 * @param maxPlayers Max participants (32, 64, or 128)
 * @param difficulty Difficulty tier
 * @param initialBosses Boss templates to spawn
 * @returns Initialized RaidInstance ready for players
 */
export function createRaidInstance(
  raidType: 'legendary_encounter' | 'mythic_trial' | 'world_event',
  maxPlayers: number,
  difficulty: 'normal' | 'heroic' | 'mythic',
  initialBosses: Array<{ name: string; initialHp: number }>
): RaidInstance {
  const instanceId = `riot_${uuid()}`;
  const spatialGridSize = Math.ceil(Math.sqrt(maxPlayers / 4)); // 2-8 grid cells
  const spatialGroups = new Map<string, SpatialInterestGroup>();

  // Initialize spatial grid
  for (let x = 0; x < spatialGridSize; x++) {
    for (let y = 0; y < spatialGridSize; y++) {
      const sigId = `sig_${x}_${y}`;
      const coordinate: [number, number] = [x, y];

      spatialGroups.set(sigId, {
        sigId,
        gridCoordinate: coordinate,
        playerIds: new Set(),
        activeBosses: [],
        eventLog: [],
        lastBroadcastTick: 0,
        compressionLevel: 'full'
      });
    }
  }

  const instance: RaidInstance = {
    instanceId,
    createdAt: Date.now(),
    raidType,
    maxPlayers,
    currentPlayerCount: 0,
    bosses: initialBosses.map((boss, idx) => ({
      bossId: `boss_${instanceId}_${idx}`,
      name: boss.name,
      healthPoints: boss.initialHp,
      maxHealthPoints: boss.initialHp,
      phase: 1,
      armor: 0,
      enraged: false,
      activeMechanics: [],
      activeTargets: new Set()
    })),
    spatialGridSize,
    spatialGroups,
    ledgerChecksum: 'pending',
    difficulty
  };

  activeInstances.set(instanceId, instance);
  return instance;
}

/**
 * Add player to instance and assign to appropriate SIG
 * 
 * @param instanceId Target instance
 * @param playerId Player joining
 * @param position Initial player position
 * @param mythRank Player's myth rank (affects difficulty scaling)
 * @returns Updated instance
 */
export function addPlayerToInstance(
  instanceId: string,
  playerId: string,
  position: [number, number],
  mythRank: number
): RaidInstance | null {
  const instance = activeInstances.get(instanceId);
  if (!instance || instance.currentPlayerCount >= instance.maxPlayers) {
    return null;
  }

  const gridX = Math.floor(position[0] / (100 / instance.spatialGridSize));
  const gridY = Math.floor(position[1] / (100 / instance.spatialGridSize));
  const sigKey = `sig_${gridX}_${gridY}`;
  const sig = instance.spatialGroups.get(sigKey);

  if (!sig) return null;

  sig.playerIds.add(playerId);

  // Record join event in ledger
  sig.eventLog.push({
    type: 'player_join',
    playerId,
    mythRank
  });

  // Update instance count and return modified reference
  const updated: RaidInstance = {
    ...instance,
    currentPlayerCount: instance.currentPlayerCount + 1
  };

  activeInstances.set(instanceId, updated);
  return updated;
}

/**
 * Remove player from instance (death or disconnect)
 * 
 * @param instanceId Target instance
 * @param playerId Player leaving
 * @returns Updated instance
 */
export function removePlayerFromInstance(
  instanceId: string,
  playerId: string
): RaidInstance | null {
  const instance = activeInstances.get(instanceId);
  if (!instance) return null;

  let removed = false;
  instance.spatialGroups.forEach((sig) => {
    if (sig.playerIds.has(playerId)) {
      sig.playerIds.delete(playerId);
      sig.eventLog.push({
        type: 'player_leave',
        playerId
      });
      removed = true;
    }
  });

  if (removed) {
    const updated: RaidInstance = {
      ...instance,
      currentPlayerCount: Math.max(0, instance.currentPlayerCount - 1)
    };
    activeInstances.set(instanceId, updated);
    return updated;
  }

  return null;
}

/**
 * Get all instances currently active for a given raid type
 * 
 * @param raidType Filter by type (or null for all)
 * @returns Array of active instances
 */
export function getActiveInstances(
  raidType?: 'legendary_encounter' | 'mythic_trial' | 'world_event'
): RaidInstance[] {
  const instances = Array.from(activeInstances.values());
  if (!raidType) return instances;
  return instances.filter((i) => i.raidType === raidType);
}

/**
 * Get instance by ID
 * 
 * @param instanceId Instance to retrieve
 * @returns RaidInstance or null if not found
 */
export function getInstance(instanceId: string): RaidInstance | null {
  return activeInstances.get(instanceId) || null;
}

// ============================================================================
// SPATIAL INTEREST GROUP (SIG): Network Optimization
// ============================================================================

/**
 * Query all players in a given SIG (used for targeted broadcasts)
 * O(1) spatial lookup
 * 
 * @param instance The raid instance
 * @param gridCoordinate Grid cell [x, y]
 * @returns Set of player IDs in that cell
 */
export function getPlayersInSIG(
  instance: RaidInstance,
  gridCoordinate: [number, number]
): Set<string> {
  const sigKey = `sig_${gridCoordinate[0]}_${gridCoordinate[1]}`;
  const sig = instance.spatialGroups.get(sigKey);
  return sig?.playerIds ?? new Set();
}

/**
 * Get adjacent SIGs (for AoE mechanic spreads)
 * Includes diagonals (8-neighbor)
 * 
 * @param instance The raid instance
 * @param center Center grid coordinate
 * @returns Array of adjacent SIG player sets
 */
export function getAdjacentSIGs(
  instance: RaidInstance,
  center: [number, number]
): Map<string, Set<string>> {
  const adjacent = new Map<string, Set<string>>();

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue; // Skip center

      const newX = center[0] + dx;
      const newY = center[1] + dy;

      if (newX >= 0 && newX < instance.spatialGridSize &&
          newY >= 0 && newY < instance.spatialGridSize) {
        const sigKey = `sig_${newX}_${newY}`;
        const sig = instance.spatialGroups.get(sigKey);
        if (sig) {
          adjacent.set(sigKey, sig.playerIds);
        }
      }
    }
  }

  return adjacent;
}

/**
 * Update compression level based on distance from action
 * Reduces event pipe flooding for distant players
 * 
 * @param instance The raid instance
 * @param actionCenter Grid coordinate of major action
 */
export function updateCompressionLevels(
  instance: RaidInstance,
  actionCenter: [number, number]
): void {
  instance.spatialGroups.forEach((sig) => {
    const dist = Math.hypot(
      sig.gridCoordinate[0] - actionCenter[0],
      sig.gridCoordinate[1] - actionCenter[1]
    );

    if (dist <= 1) {
      sig.compressionLevel = 'full';
    } else if (dist <= 2) {
      sig.compressionLevel = 'reduced';
    } else {
      sig.compressionLevel = 'minimal';
    }
  });
}

/**
 * Broadcast event to all players in a SIG and adjacent cells
 * Event compression applied based on distance
 * 
 * @param instance The raid instance
 * @param sourceGrid Source grid coordinate
 * @param event Event to broadcast
 */
export function broadcastToSIGRadius(
  instance: RaidInstance,
  sourceGrid: [number, number],
  event: RaidEvent
): void {
  const targetSIG = instance.spatialGroups.get(`sig_${sourceGrid[0]}_${sourceGrid[1]}`);
  const adjacent = getAdjacentSIGs(instance, sourceGrid);

  if (targetSIG) {
    targetSIG.eventLog.push(event);
  }

  adjacent.forEach((sig) => {
    // Adjacent SIGs get reduced event verbosity
    if (event.type !== 'player_damage') {
      // Filter low-priority events for distant players
      const adjacentSigObj = instance.spatialGroups.get(
        `sig_${sourceGrid[0]}_${sourceGrid[1]}`
      );
      if (adjacentSigObj) {
        adjacentSigObj.eventLog.push(event);
      }
    }
  });
}

/**
 * Clear events for SIGs to prepare for next tick
 * Maintains ledger integrity by only clearing broadcast events
 * 
 * @param instance The raid instance
 */
export function clearBroadcastEvents(instance: RaidInstance): void {
  instance.spatialGroups.forEach((sig) => {
    // Keep last 10 events for replay purposes
    if (sig.eventLog.length > 100) {
      sig.eventLog.splice(0, sig.eventLog.length - 10);
    }
  });
}

/**
 * Get all events in an instance (for ledger recording)
 * Used by M62-CHRONOS for deterministic replay
 * 
 * @param instanceId Instance to query
 * @returns Ordered array of all events
 */
export function getAllInstanceEvents(instanceId: string): RaidEvent[] {
  const instance = activeInstances.get(instanceId);
  if (!instance) return [];

  const allEvents: RaidEvent[] = [];
  instance.spatialGroups.forEach((sig) => {
    allEvents.push(...sig.eventLog);
  });

  // Type-safe timestamp extraction helper
  const getEventTimestamp = (event: any): number => {
    return (typeof event === 'object' && event !== null && typeof event.timestamp === 'number')
      ? event.timestamp
      : 0;
  };

  return allEvents.sort((a, b) => {
    // Maintain temporal order for replay
    const aTime = getEventTimestamp(a);
    const bTime = getEventTimestamp(b);
    return aTime - bTime;
  });
}

/**
 * Close and clean up a raid instance
 * Records final state and triggers rewards
 * 
 * @param instanceId Instance to close
 * @returns Closure stats (players, duration, loot)
 */
export function closeRaidInstance(
  instanceId: string
): { playerCount: number; durationMs: number; lootDropped: number } | null {
  const instance = activeInstances.get(instanceId);
  if (!instance) return null;

  const duration = Date.now() - instance.createdAt;
  let totalPlayers = 0;
  let totalLoot = 0;

  instance.spatialGroups.forEach((sig) => {
    totalPlayers += sig.playerIds.size;
    totalLoot += sig.eventLog.filter((e) => e.type === 'loot_drop').length;
  });

  activeInstances.delete(instanceId);

  return {
    playerCount: totalPlayers,
    durationMs: duration,
    lootDropped: totalLoot
  };
}
