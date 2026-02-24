/**
 * uiModel.ts - Phase 8: Diegetic Integrity & UI World Model Adapter
 * 
 * Provides a presentation-ready view of the world state for UI components.
 * Decouples UI rendering from engine internals and handles paradox-based
 * data corruption/obscuration for diegetic feedback.
 * 
 * UI components should accept UIWorldModel rather than WorldState directly,
 * ensuring type safety and enabling narrative-based information hiding.
 */

import type { WorldState, NPC, Location } from '../engine/worldEngine';

/**
 * UI-safe Location type with guaranteed coordinate properties
 * Ensures ChronicleMap and other spatial components have typed access
 */
export interface UILocation {
  id: string;
  name: string;
  x: number;  // Guaranteed coordinate
  y: number;  // Guaranteed coordinate
  biome: string;
  npcIds: string[];
  resourceCount: number;
}

/**
 * UI-safe NPC type with essential properties for rendering
 */
export interface UINPC {
  id: string;
  name: string;
  locationId: string;
  type?: 'NORMAL' | 'SOUL_ECHO';
  importance?: 'critical' | 'major' | 'minor';
  emotionalState?: {
    trust: number;
    fear: number;
    gratitude: number;
    resentment: number;
  };
  factionId?: string;
  isDisplaced?: boolean;
}

/**
 * World fragment (corrupted reality zone) for UI rendering
 */
export interface UIWorldFragment {
  id: string;
  locationId: string;
  corruptionLevel: number;  // 0-100
  type: 'spatial-distortion' | 'temporal-glitch' | 'narrative-void';
  remainingTicks?: number;
}

/**
 * UI-safe World Model
 * Aggregates WorldState data into presentation-ready structures
 * with paradox-aware data filtering and diegetic obscuration
 */
export interface UIWorldModel {
  tick: number;
  hour: number;
  dayPhase: 'morning' | 'afternoon' | 'evening' | 'night';
  weather: string;
  season: string;
  
  // Spatial data
  locations: UILocation[];
  npcs: UINPC[];
  
  // Corruption/paradox state (for UI feedback)
  paradoxLevel: number;          // 0-100: World corruption severity
  ageRotSeverity?: 'mild' | 'moderate' | 'severe';
  worldFragments: UIWorldFragment[];  // Corrupted zones affecting map rendering
  
  // Data reliability indicator
  dataIntegrity: number;  // 0-100: How much to trust the displayed data (inverse of corruption)
}

/**
 * Convert WorldState to UIWorldModel
 * Applies diegetic filtering based on paradox level and world state
 * 
 * At high paradoxLevel (>60), some data becomes unreliable/hidden:
 * - Location coordinates become approximate
 * - NPC positions become uncertain
 * - Some NPCs may vanish from the map entirely (is Displaced)
 */
export function toUIModel(state: WorldState): UIWorldModel {
  const paradoxLevel = state.paradoxLevel ?? 0;
  const dataIntegrity = Math.max(0, 100 - paradoxLevel);
  
  // Convert locations with coordinate guarantee
  const locations: UILocation[] = (state.locations ?? []).map(loc => ({
    id: loc.id,
    name: loc.name,
    x: (loc as any).x ?? Math.random() * 500,  // Fallback if x missing
    y: (loc as any).y ?? Math.random() * 500,  // Fallback if y missing
    biome: (loc as any).biome ?? 'unknown',
    npcIds: (state.npcs ?? [])
      .filter(npc => npc.locationId === loc.id && !npc.isDisplaced)
      .map(npc => npc.id),
    resourceCount: (state.resourceNodes ?? [])
      .filter(node => node.locationId === loc.id && !node.depletedAt)
      .length
  }));
  
  // Convert NPCs with optional data filtering at high corruption
  const shouldOscurateNpc = (npc: NPC) => {
    // At high paradoxLevel, some NPCs randomly vanish from perception
    if (paradoxLevel > 70 && Math.random() < (paradoxLevel - 70) / 30) {
      return true;
    }
    return npc.isDisplaced ?? false;
  };
  
  const npcs: UINPC[] = (state.npcs ?? [])
    .filter(npc => !shouldOscurateNpc(npc))
    .map(npc => ({
      id: npc.id,
      name: npc.name,
      locationId: npc.locationId,
      type: npc.type,
      importance: npc.importance,
      emotionalState: npc.emotionalState ? {
        trust: npc.emotionalState.trust ?? 0,
        fear: npc.emotionalState.fear ?? 0,
        gratitude: npc.emotionalState.gratitude ?? 0,
        resentment: npc.emotionalState.resentment ?? 0
      } : undefined,
      factionId: npc.factionId,
      isDisplaced: npc.isDisplaced
    }));
  
  // Convert world fragments (corrupted zones)
  const worldFragments: UIWorldFragment[] = (state.worldFragments ?? []).map(frag => ({
    id: frag.id,
    locationId: frag.locationId ?? '',
    corruptionLevel: frag.corruptionLevel ?? 0,
    type: frag.type ?? 'spatial-distortion',
    remainingTicks: frag.remainingTicks
  }));
  
  return {
    tick: state.tick ?? 0,
    hour: state.hour ?? 0,
    dayPhase: (state.dayPhase ?? 'morning') as 'morning' | 'afternoon' | 'evening' | 'night',
    weather: state.weather ?? 'clear',
    season: state.season ?? 'spring',
    
    locations,
    npcs,
    
    paradoxLevel,
    ageRotSeverity: state.ageRotSeverity,
    worldFragments,
    
    dataIntegrity
  };
}

/**
 * Get a location from UIWorldModel by ID
 */
export function getUILocation(model: UIWorldModel, locationId: string): UILocation | undefined {
  return model.locations.find(loc => loc.id === locationId);
}

/**
 * Get an NPC from UIWorldModel by ID
 */
export function getUINpc(model: UIWorldModel, npcId: string): UINPC | undefined {
  return model.npcs.find(npc => npc.id === npcId);
}
