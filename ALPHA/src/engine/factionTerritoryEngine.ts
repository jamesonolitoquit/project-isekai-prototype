/**
 * factionTerritoryEngine.ts
 * 
 * M49-A1: Faction Territory Sovereignty
 * 
 * Handles faction territorial control visualization and mechanics:
 * - Determines controlling factions at locations
 * - Calculates territory color overlays
 * - Manages bounty/tax mechanics for player movement
 * - Tracks faction influence changes
 */

import { WorldState, Location } from './worldEngine';
import { Faction } from './factionEngine';

/**
 * Determines the dominant controlling faction at a location based on influenceMap
 * Returns the faction with highest influence score at the location, or null if no dominant control
 */
export function getLocationControllingFaction(
  state: WorldState,
  locationId: string
): Faction | null {
  if (!state.influenceMap || !state.influenceMap[locationId]) {
    return null;
  }

  const locationInfluence = state.influenceMap[locationId];
  let maxInfluence = 0;
  let controllingFactionId: string | null = null;

  // Find faction with highest influence
  for (const [factionId, influence] of Object.entries(locationInfluence)) {
    if (influence > maxInfluence) {
      maxInfluence = influence;
      controllingFactionId = factionId;
    }
  }

  // Require meaningful influence threshold (>30) to consider faction "controlling"
  if (maxInfluence < 30) {
    return null;
  }

  if (!controllingFactionId) {
    return null;
  }

  return state.factions?.find(f => f.id === controllingFactionId) || null;
}

/**
 * Gets all factions with presence at a location
 */
export function getLocationFactions(
  state: WorldState,
  locationId: string
): Array<{ faction: Faction; influence: number }> {
  if (!state.influenceMap || !state.influenceMap[locationId]) {
    return [];
  }

  const locationInfluence = state.influenceMap[locationId];
  const result: Array<{ faction: Faction; influence: number }> = [];

  for (const [factionId, influence] of Object.entries(locationInfluence)) {
    const faction = state.factions?.find(f => f.id === factionId);
    if (faction && influence > 0) {
      result.push({ faction, influence });
    }
  }

  return result.sort((a, b) => b.influence - a.influence);
}

/**
 * Determines if player is entering hostile territory
 * Hostile = controlling faction that player has low reputation with
 */
export function isHostileTerritory(
  state: WorldState,
  targetLocationId: string
): boolean {
  const controllingFaction = getLocationControllingFaction(state, targetLocationId);
  if (!controllingFaction) {
    return false;
  }

  // Check player reputation with controlling faction
  const playerReputation = ((state as any).factionReputation || {})[controllingFaction.id] || 0;
  
  // Hostile if player has clearly negative or no reputation with controlling faction
  return playerReputation < -20;
}

/**
 * Calculates tax/bounty cost for entering a faction's territory
 * Higher alignment mismatch = higher cost
 */
export function calculateFactionTax(
  state: WorldState,
  targetLocationId: string
): { amount: number; factionId: string; factionName: string } | null {
  const controllingFaction = getLocationControllingFaction(state, targetLocationId);
  if (!controllingFaction) {
    return null;
  }

  const playerReputation = ((state as any).factionReputation || {})[controllingFaction.id] || 0;
  
  // No tax if friendly
  if (playerReputation > 0) {
    return null;
  }

  // Neutral stance: minimal tax (1-5 gold)
  if (playerReputation >= -20) {
    return {
      amount: 3,
      factionId: controllingFaction.id,
      factionName: controllingFaction.name
    };
  }

  // Unfriendly: moderate tax (10-20 gold)
  if (playerReputation >= -50) {
    return {
      amount: 15,
      factionId: controllingFaction.id,
      factionName: controllingFaction.name
    };
  }

  // Hostile: high tax (30+ gold) or trigger combat encounter
  return {
    amount: 35,
    factionId: controllingFaction.id,
    factionName: controllingFaction.name
  };
}

/**
 * Gets the visual color for a faction (used for territory tinting on map)
 */
export function getFactionTerritoryColor(faction: Faction | null): string {
  if (!faction) {
    return 'rgba(128, 128, 128, 0.1)'; // Gray for unclaimed
  }

  return faction.influenceTheme?.color || '#999999';
}

/**
 * Gets the opacity level for territory tinting based on faction influence strength
 */
export function getTerritoryOpacity(
  state: WorldState,
  locationId: string,
  faction: Faction
): number {
  if (!state.influenceMap || !state.influenceMap[locationId]) {
    return 0;
  }

  const influence = state.influenceMap[locationId][faction.id] || 0;
  
  // Map influence (0-100) to opacity (0.1-0.4)
  return Math.min(0.4, 0.1 + (influence / 100) * 0.3);
}

/**
 * Determines if location is contested (multiple factions with significant presence)
 */
export function isLocationContested(state: WorldState, locationId: string): boolean {
  const factions = getLocationFactions(state, locationId);
  
  if (factions.length < 2) {
    return false;
  }

  // Check if top 2 factions have close influence (within 20 points)
  const [first, second] = factions;
  return Math.abs(first.influence - second.influence) < 20;
}

/**
 * Get all factions that control territory (have controlledLocationIds)
 */
export function getTerritoralFactions(state: WorldState): Faction[] {
  return (state.factions || []).filter(f => (f.controlledLocationIds?.length || 0) > 0);
}

/**
 * Helper: Apply faction tax to player gold/resources
 * Returns remaining gold after tax
 */
export function applyFactionTax(
  state: WorldState,
  taxAmount: number
): { applied: boolean; goldRemaining: number; goldSpent: number } {
  const goldItem = (state.player?.inventory || []).find(item => 
    (item as any).kind === 'stackable' && (item as any).itemId === 'gold'
  ) as any;
  
  const currentGold = goldItem?.quantity || 0;
  
  if (currentGold < taxAmount) {
    return {
      applied: false,
      goldRemaining: currentGold,
      goldSpent: 0
    };
  }

  // Deduct tax from inventory
  if (goldItem) {
    goldItem.quantity = (goldItem.quantity || 0) - taxAmount;
  }

  return {
    applied: true,
    goldRemaining: currentGold - taxAmount,
    goldSpent: taxAmount
  };
}
