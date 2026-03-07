/**
 * UI World Mapper Hook (Pillar 2.1 - Oracle View)
 * 
 * Purpose: Transform engine's WorldState into UI-friendly UIWorldModel.
 * Handles all the messy conversions, pre-calculations, and data flattening
 * that makes UI rendering clean and performant.
 * 
 * Memoization strategy:
 * - Full model recalculated only when worldState changes
 * - Derived data (atmosphere, paradox) computed once per state
 * - Safe to call from multiple components without performance penalty
 */

import { useMemo, useCallback } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import type {
  UIWorldModel,
  UIPlayer,
  UILocation,
  UINPC,
  UIFaction,
  UIAtmosphere,
  UILegacyMarker
} from '../types/uiModel';

/**
 * Format time value to HH:MM
 */
function formatClock(hour: number): string {
  const h = String(Math.floor(hour)).padStart(2, '0');
  const m = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format date string from day and season
 */
function formatDate(day: number, season: string): string {
  return `${season}, Day ${day}`;
}

/**
 * Get epoch name from phase/epoch number
 */
function getEpochName(epochOrPhase: number | string): string {
  const epochMap: Record<number | string, string> = {
    0: 'The First Breath',
    1: 'Echoes of Reality',
    2: 'The Veil of Belief',
    3: 'The Weight of Influence',
    4: 'Ancestral Echoes',
  };
  return epochMap[epochOrPhase] || `Phase ${epochOrPhase}`;
}

/**
 * Simplify emotional state for UI display
 */
function getEmotionalState(scarCount: number): 'stable' | 'distressed' | 'fractured' {
  if (scarCount === 0) return 'stable';
  if (scarCount <= 2) return 'distressed';
  return 'fractured';
}

/**
 * Extract visible locations based on player knowledge
 */
function extractVisibleLocations(worldState: WorldState | null): UILocation[] {
  if (!worldState?.locations) return [];
  
  return (worldState.locations as any[]).map((loc: any) => ({
    id: loc.id || 'unknown',
    name: loc.name || 'Unknown Location',
    description: loc.description || '',
    terrainType: loc.terrainType || 'neutral',
    
    displayName: loc.name || 'Unknown Location',
    atmosphereLevel: loc.atmosphereLevel || 0,
    populationCount: loc.inhabitants?.length || 0,
    factionPresence: (loc.factionControl || []).map((fc: any) => ({
      factionId: fc.factionId || '',
      factionName: fc.factionName || 'Unknown',
      control: fc.controlPercentage || 0,
    })),
    
    isActual: loc.isConfirmed !== false,
    paradoxValue: loc.paradoxAccumulation || 0,
    visualMarkers: loc.visualMarkers || [],
  }));
}

/**
 * Extract visible NPCs and their dialogue status
 */
function extractVisibleNPCs(worldState: WorldState | null): UINPC[] {
  if (!worldState?.npcs) return [];
  
  return (worldState.npcs as any[]).map((npc: any) => {
    // Get narrative attrition scars if they exist
    const scars = (npc.narrativeAttrition?.scars || []) as any[];
    const scarTypes = scars.map(s => s.type || 'unknown');
    
    return {
      id: npc.id || 'unknown',
      name: npc.name || 'Unknown NPC',
      title: npc.title || '',
      displayName: npc.name || 'Unknown',
      
      location: {
        locationId: npc.location?.id || npc.locationId || 'unknown',
        locationName: npc.location?.name || 'Unknown',
      },
      faction: {
        factionId: npc.faction?.id || npc.factionId || 'unknown',
        factionName: npc.faction?.name || 'Unknown Faction',
      },
      
      scarCount: scars.length,
      scarTypes,
      emotionalState: getEmotionalState(scars.length),
      
      dialogueAvailable: npc.dialogueAvailable !== false,
      dialogueLockedReasons: npc.dialogueLockedReasons || [],
      
      atmosphereAffected: (npc.paradoxMarkers?.length || 0) > 0,
      paradoxMarkers: npc.paradoxMarkers || [],
    };
  });
}

/**
 * Build player UI model
 */
function buildPlayerUI(worldState: WorldState | null): UIPlayer {
  if (!worldState) {
    return {
      name: 'Unknown',
      level: 0,
      currentEpoch: 0,
      currentSeason: 'winter',
      currentDayPhase: 'morning',
      formattedClock: '00:00',
      formattedDate: 'Winter, Day 1',
      currentEpochName: 'The First Breath',
      location: { locationId: 'unknown', locationName: 'Unknown' },
      inventoryCount: 0,
      equippedItems: [],
      activeEffects: [],
    };
  }

  const player = worldState.player as any;
  const hour = worldState.hour ?? 0;
  const day = worldState.day ?? 1;

  return {
    name: player?.name || 'Wanderer',
    level: player?.level || 0,
    currentEpoch: parseInt(String(worldState.epochId ?? 0), 10) || 0,
    currentSeason: worldState.season || 'winter',
    currentDayPhase: worldState.dayPhase || 'morning',
    formattedClock: formatClock(hour),
    formattedDate: formatDate(day, worldState.season || 'winter'),
    currentEpochName: getEpochName(parseInt(String(worldState.epochId ?? 0), 10) || 0),
    location: {
      locationId: player?.location || 'unknown',
      locationName: player?.locationName || 'Unknown',
    },
    inventoryCount: player?.inventory?.length || 0,
    equippedItems: (player?.equippedItems || []).map((item: any) => ({
      id: item.id || 'unknown',
      name: item.name || 'Unknown Item',
      type: item.type || 'misc',
    })),
    activeEffects: (player?.statusEffects || []).map((effect: any) => ({
      id: effect.id || 'unknown',
      name: effect.name || 'Unknown Effect',
      type: effect.type || 'buff',
      duration: effect.duration || 0,
      icon: effect.icon || 'default',
    })),
  };
}

/**
 * Extract visible factions
 */
function extractVisibleFactions(worldState: WorldState | null, playerId: string | null): UIFaction[] {
  if (!worldState?.factions) return [];
  
  return (worldState.factions as any[]).map((faction: any) => ({
    id: faction.id || 'unknown',
    name: faction.name || 'Unknown Faction',
    description: faction.description || '',
    powerLevel: faction.powerLevel || 0,
    memberCount: faction.members?.length || 0,
    controlledLocations: [],
    playerReputation: faction.playerReputation || 0,
    playerRelationship: faction.playerRelationship || 'neutral',
    isActive: faction.isActive !== false,
    isDestabilized: faction.isDestabilized || false,
  }));
}

/**
 * Build atmosphere UI model from world state
 */
function buildAtmosphereUI(worldState: WorldState | null): UIAtmosphere {
  if (!worldState) {
    return {
      paradoxLevel: 0,
      paradoxSeverity: 'stable',
      ageRotSeverity: 0,
      ageRotEffect: 'fresh',
      visualFilters: {},
      cssVariables: {
        '--paradox-level': '0',
        '--age-rot-level': '0',
        '--atmosphere-intensity': '0',
      },
    };
  }

  // Get paradox level from atmosphere tracking
  const atmosphereTracking = (worldState as any).atmosphereTracking || {};
  const paradoxLevel = Math.min(100, atmosphereTracking.paradoxLevel || 0);
  
  // Determine severity thresholds
  let paradoxSeverity: 'stable' | 'rippling' | 'fracturing' | 'shattered' = 'stable';
  if (paradoxLevel > 75) paradoxSeverity = 'shattered';
  else if (paradoxLevel > 50) paradoxSeverity = 'fracturing';
  else if (paradoxLevel > 25) paradoxSeverity = 'rippling';
  
  // Age rot calculation (legacy system)
  const ageRotSeverity = Math.min(100, (worldState as any).ageRot || 0);
  let ageRotEffect: 'fresh' | 'weathered' | 'ancient' | 'dying' = 'fresh';
  if (ageRotSeverity > 75) ageRotEffect = 'dying';
  else if (ageRotSeverity > 50) ageRotEffect = 'ancient';
  else if (ageRotSeverity > 25) ageRotEffect = 'weathered';
  
  // Calculate visual filters based on paradox
  const chromatic = paradoxLevel / 100 * 0.5; // Max 0.5
  const glitch = paradoxLevel / 100 * 0.3;
  const sepia = ageRotSeverity / 100 * 0.4;
  const blur = paradoxLevel / 100 * 0.15;
  
  return {
    paradoxLevel,
    paradoxSeverity,
    ageRotSeverity,
    ageRotEffect,
    visualFilters: {
      chromatic,
      glitch,
      sepia,
      blur,
    },
    cssVariables: {
      '--paradox-level': (paradoxLevel / 100).toFixed(2),
      '--age-rot-level': (ageRotSeverity / 100).toFixed(2),
      '--atmosphere-intensity': Math.min(1, (paradoxLevel + ageRotSeverity) / 200).toFixed(2),
    },
  };
}

/**
 * Extract legacy markers for narrative continuity display
 */
function extractLegacyMarkers(worldState: WorldState | null): UILegacyMarker[] {
  if (!worldState) return [];
  
  const legacyImpacts = (worldState as any).legacyImpacts || [];
  
  return legacyImpacts.map((legacy: any) => ({
    id: legacy.id || 'unknown',
    title: `Generation ${legacy.generationNum}`,
    description: legacy.description || 'Ancient legacy',
    generationNumber: legacy.generationNum || 0,
    deeds: legacy.deeds || [],
    inherited: legacy.inherited || false,
    bonusesApplied: legacy.bonusesApplied || [],
  }));
}

/**
 * Main hook: Transform WorldState to UIWorldModel
 * Call this once in BetaApplication, then pass UIWorldModel down to children
 */
export function useUIWorldMapper(
  worldState: WorldState | null,
  playerId: string | null = null
): UIWorldModel {
  const startMs = performance.now();

  const model = useMemo<UIWorldModel>(() => {
    const visibleLocations = extractVisibleLocations(worldState);
    const visibleNPCs = extractVisibleNPCs(worldState);
    const visibleFactions = extractVisibleFactions(worldState, playerId);

    const player = buildPlayerUI(worldState);
    const atmosphere = buildAtmosphereUI(worldState);
    const legacyMarkers = extractLegacyMarkers(worldState);

    // Find current location details
    const currentLocationDetails = visibleLocations.find(
      loc => loc.id === player.location.locationId
    ) || null;

    // Find NPCs at current location
    const npcsAtCurrentLocation = visibleNPCs.filter(
      npc => npc.location.locationId === player.location.locationId
    );

    // Find player's faction
    const playerFaction = visibleFactions.find(
      f => f.playerRelationship === 'member'
    ) || null;

    // Compile metadata
    const parentsCount = visibleNPCs.filter(npc => npc.scarCount > 0).length;
    const scarCountTotal = visibleNPCs.reduce((sum, npc) => sum + npc.scarCount, 0);
    const dialogueLockedCount = visibleNPCs.filter(npc => !npc.dialogueAvailable).length;
    const paradoxAffectedLocations = visibleLocations.filter(loc => loc.paradoxValue > 0).length;

    const renderTimeMs = Math.round(performance.now() - startMs);

    return {
      worldId: worldState?.id || 'unknown',
      timestamp: Date.now(),

      player,
      visibleLocations,
      currentLocationDetails,

      visibleNPCs,
      npcsAtCurrentLocation,

      knownFactions: visibleFactions,
      playerFaction,

      activeDialogue: null, // Will be set by dialogue-specific handler

      legacyMarkers,
      atmosphere,

      _metadata: {
        parentsCount,
        scarCountTotal,
        dialogueLockedCount,
        paradoxAffectedLocations,
        renderTimeMs,
      },
    };
  }, [worldState, playerId]);

  return model;
}

/**
 * Hook to apply atmospheric CSS variables to document root
 * Call this in BetaApplication to affect global visual system
 */
export function useApplyAtmosphericCSS(atmosphere: UIAtmosphere): void {
  useMemo(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      Object.entries(atmosphere.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }, [atmosphere.cssVariables]);
}

/**
 * Debug helper to log model changes
 */
export function useUIModelDebug(model: UIWorldModel, enabled: boolean = false): void {
  useMemo(() => {
    if (enabled && typeof console !== 'undefined') {
      console.log('[UIWorldMapper] Model updated:', {
        worldId: model.worldId,
        playerLocation: model.player.location.locationName,
        visibleNPCs: model.visibleNPCs.length,
        visibleLocations: model.visibleLocations.length,
        paradoxLevel: model.atmosphere.paradoxLevel,
        renderTimeMs: model._metadata.renderTimeMs,
      });
    }
  }, [model, enabled]);
}

