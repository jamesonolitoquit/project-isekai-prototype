/**
 * Phase 29 Task 4: UIWorldModel - Read-only interface for client UI
 * 
 * Decouples the UI layer from internal engine state to prevent accidental
 * state corruption and ensure type safety. The UI should ONLY read from 
 * this interface, never write to it directly.
 * 
 * This is the "Oracle View Extraction" — selective synchronization of the 
 * safe world model to the UI without exposing internal engine details.
 */

import type { WorldState, Location, NPC, SubArea, DirectorZone, WorldScar, WorldFragment } from './worldEngine';

/**
 * Read-only interface for a Location as presented to the UI
 */
export interface UILocation {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly x?: number;
  readonly y?: number;
  readonly biome?: string;
  readonly discovered?: boolean;
  readonly spiritDensity?: number;
  readonly activeScars?: readonly string[];
  readonly geopoliticalInfluence?: Readonly<Record<string, number>>;
  readonly ageRotSeverity?: number;
  readonly isBlessed?: boolean;
  readonly blessedStrength?: number;
}

/**
 * Read-only interface for an NPC as presented to the UI
 */
export interface UINPC {
  readonly id: string;
  readonly name: string;
  readonly locationId: string;
  readonly questId?: string;
  readonly availability?: Readonly<{ startHour?: number; endHour?: number }>;
  readonly personality?: Readonly<any>;
  readonly factionId?: string;
  readonly factionRole?: string;
  readonly currentGoal?: string;
  readonly emotionalState?: Readonly<any>;
  readonly importance?: 'minor' | 'major' | 'critical';
  readonly hp?: number;
  readonly maxHp?: number;
}

/**
 * Read-only interface for player state as presented to the UI
 */
export interface UIPlayerState {
  readonly id: string;
  readonly location: string;
  readonly gold: number;
  readonly experience: number;
  readonly xp: number;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly stats?: Readonly<Record<string, number>>;
  readonly reputation?: Readonly<Record<string, number>>;
  readonly statusEffects?: readonly string[];
  readonly quests?: Readonly<Record<string, any>>;
  readonly inventory?: any; // Intentionally generic for now
}

/**
 * Read-only interface for paradox/anomaly state as presented to the UI
 */
export interface UIParadoxState {
  readonly totalParadoxPoints: number;
  readonly activeAnomalies?: ReadonlyMap<string, any>;
  readonly manifestationThreshold?: number;
  readonly lastManifestationTick?: number;
}

/**
 * Read-only interface for time/season state as presented to the UI
 */
export interface UITimeState {
  readonly tick: number;
  readonly hour: number;
  readonly minute: number;
  readonly day: number;
  readonly season: 'spring' | 'summer' | 'autumn' | 'winter';
  readonly dayPhase: 'night' | 'morning' | 'afternoon' | 'evening';
}

/**
 * Read-only interface for telemetry/economy state as presented to the UI
 */
export interface UITelemetry {
  readonly economyHealth?: number; // 0-100 score
  readonly socialTension?: number; // 0-1
  readonly factionConflictLevel?: number; // 0-100
}

/**
 * Phase 29 Task 4: UIWorldModel
 * Complete read-only representation of world state for UI consumption
 * No `any` types, fully type-safe
 */
export interface UIWorldModel {
  /** Immutable world identifier */
  readonly id: string;

  /** Current game tick */
  readonly tick: number;

  /** Player state (read-only) */
  readonly player: Readonly<UIPlayerState>;

  /** All locations (read-only) */
  readonly locations: readonly UILocation[];

  /** All NPCs (read-only) */
  readonly npcs: readonly UINPC[];

  /** All quests (read-only) */
  readonly quests?: readonly any[];

  /** Time and season information */
  readonly time: Readonly<UITimeState>;

  /** Current season */
  readonly season: 'spring' | 'summer' | 'autumn' | 'winter';

  /** Current weather */
  readonly weather: string;

  /** Current hour of day */
  readonly hour: number;

  /** Day phase (night/morning/afternoon/evening) */
  readonly dayPhase: 'night' | 'morning' | 'afternoon' | 'evening';

  /** Social tension in the world (0-1) */
  readonly socialTension: number;

  /** Paradox and anomaly state */
  readonly paradoxState: Readonly<UIParadoxState>;

  /** Economy and faction telemetry */
  readonly telemetryState?: Readonly<UITelemetry>;

  /** Metadata */
  readonly metadata?: Readonly<Record<string, any>>;
}

/**
 * Phase 29 Task 4: Extract UI-safe model from full world state
 * Converts mutable engine state into immutable UI model
 * This is the "gating function" that prevents UI layer from corrupting engine state
 */
export function extractUIWorldModel(engineState: WorldState): UIWorldModel {
  return Object.freeze({
    id: engineState.id,
    tick: engineState.tick ?? 0,
    player: Object.freeze({
      id: engineState.player?.id ?? '',
      location: engineState.player?.location ?? '',
      gold: engineState.player?.gold ?? 0,
      experience: engineState.player?.experience ?? 0,
      xp: engineState.player?.xp ?? 0,
      level: engineState.player?.level ?? 1,
      hp: engineState.player?.hp ?? 100,
      maxHp: engineState.player?.maxHp ?? 100,
      stats: engineState.player?.stats ? Object.freeze({ ...engineState.player.stats }) : undefined,
      reputation: engineState.player?.reputation ? Object.freeze({ ...engineState.player.reputation }) : undefined,
      statusEffects: engineState.player?.statusEffects ? Object.freeze([...engineState.player.statusEffects]) : undefined,
      quests: engineState.player?.quests ? Object.freeze({ ...engineState.player.quests }) : undefined,
      inventory: engineState.player?.inventory
    }) as any,
    locations: Object.freeze(
      (engineState.locations ?? []).map((loc: Location) =>
        Object.freeze({
          id: loc.id,
          name: loc.name,
          description: loc.description,
          x: loc.x,
          y: loc.y,
          biome: loc.biome,
          discovered: loc.discovered,
          spiritDensity: loc.spiritDensity,
          activeScars: loc.activeScars ? Object.freeze([...loc.activeScars]) : undefined,
          geopoliticalInfluence: loc.geopoliticalInfluence ? Object.freeze({ ...loc.geopoliticalInfluence }) : undefined,
          ageRotSeverity: loc.ageRotSeverity,
          isBlessed: loc.isBlessed,
          blessedStrength: loc.blessedStrength
        } as UILocation)
      )
    ),
    npcs: Object.freeze(
      (engineState.npcs ?? []).map((npc: NPC) =>
        Object.freeze({
          id: npc.id,
          name: npc.name,
          locationId: npc.locationId,
          questId: npc.questId,
          availability: npc.availability ? Object.freeze({ ...npc.availability }) : undefined,
          personality: npc.personality ? Object.freeze({ ...npc.personality }) : undefined,
          factionId: npc.factionId,
          factionRole: npc.factionRole,
          currentGoal: npc.currentGoal,
          emotionalState: npc.emotionalState ? Object.freeze({ ...npc.emotionalState }) : undefined,
          importance: npc.importance,
          hp: npc.hp,
          maxHp: npc.maxHp
        } as UINPC)
      )
    ),
    quests: engineState.quests ? Object.freeze([...engineState.quests]) : undefined,
    time: Object.freeze({
      tick: engineState.time?.tick ?? 0,
      hour: engineState.time?.hour ?? engineState.hour ?? 0,
      minute: engineState.time?.minute ?? 0,
      day: engineState.time?.day ?? engineState.day ?? 1,
      season: (engineState.time?.season ?? engineState.season ?? 'winter') as any,
      dayPhase: (engineState.dayPhase ?? 'morning') as any
    }),
    season: (engineState.season ?? 'winter') as any,
    weather: engineState.weather ?? 'clear',
    hour: engineState.hour ?? 0,
    dayPhase: (engineState.dayPhase ?? 'morning') as any,
    socialTension: engineState.socialTension ?? 0,
    paradoxState: Object.freeze({
      totalParadoxPoints: engineState.paradoxState?.totalParadoxPoints ?? 0,
      activeAnomalies: engineState.paradoxState?.activeAnomalies
        ? new Map(engineState.paradoxState.activeAnomalies)
        : new Map(),
      manifestationThreshold: engineState.paradoxState?.manifestationThreshold,
      lastManifestationTick: engineState.paradoxState?.lastManifestationTick
    }),
    telemetryState: (engineState as any)?.telemetryState
      ? Object.freeze({
          economyHealth: (engineState as any).telemetryState?.economyHealth,
          socialTension: (engineState as any).telemetryState?.socialTension,
          factionConflictLevel: (engineState as any).telemetryState?.factionConflictLevel
        } as UITelemetry)
      : undefined,
    metadata: engineState.metadata ? Object.freeze({ ...engineState.metadata }) : undefined
  } as UIWorldModel);
}

/**
 * Phase 29 Task 4: Type guard for UI model
 * Ensures that code consuming this interface can't accidentally treat it as mutable
 */
export function isUIWorldModel(obj: any): obj is UIWorldModel {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.tick === 'number' &&
    obj.player &&
    Array.isArray(obj.locations) &&
    Array.isArray(obj.npcs)
  );
}
