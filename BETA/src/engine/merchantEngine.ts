/**
 * Merchant Engine (Phase 16: Economic Pressure)
 * 
 * Manages:
 * - NPC trade logic and validation
 * - Market flux (supply/demand fluctuations)
 * - NPC trading preferences and barriers
 * - Dynamic inventory pricing
 */

import type { WorldState, NPC } from './worldEngine';

export interface MerchantProfile {
  npcId: string;
  tradeThreshold: number; // CHA requirement to trade with this NPC
  preferredBarters: string[]; // Items this NPC wants (void-shards, ancient-fragments, etc.)
  baseMultiplier: number; // Price multiplier for this NPC's goods (1.0 = normal, 1.5 = expensive)
  restrictions: {
    willNotBuyCertain?: string[]; // Item IDs this NPC refuses to buy
    willNotSellCertain?: string[]; // Item IDs this NPC refuses to sell
    requiresReputation?: number; // Minimum faction reputation to trade
  };
}

export interface MarketFlux {
  locationId: string;
  timestamp: number;
  volatility: number; // 0-1, higher = more price swings
  demandedItems: Array<{
    itemId: string;
    supplyMultiplier: number; // Current scarcity/glut multiplier
    trend: 'rising' | 'falling' | 'stable'; // Price direction
  }>;
}

export interface TradeValidation {
  canTrade: boolean;
  reason?: string;
  missingCha?: number; // How much CHA needed to reach threshold
  recommendedItems?: string[]; // Items this NPC prefers
}

/**
 * Get merchant profile for an NPC from template data
 */
export function getMerchantProfile(npcId: string, npc: NPC): MerchantProfile {
  const template = (npc as any).tradeLogic || {};
  
  return {
    npcId,
    tradeThreshold: template.tradeThreshold || 12,
    preferredBarters: template.preferredBarter || [],
    baseMultiplier: template.baseMultiplier || 1.0,
    restrictions: {
      willNotBuyCertain: template.willNotBuy || [],
      willNotSellCertain: template.willNotSell || [],
      requiresReputation: template.minimumReputation || undefined
    }
  };
}

/**
 * Validate if player can trade with NPC based on CHA and reputation
 */
export function validatePlayerTrade(
  player: any,
  npc: NPC,
  state: WorldState
): TradeValidation {
  const profile = getMerchantProfile(npc.id, npc);
  
  // Check CHA requirement
  const playerCha = player.stats?.cha || 10;
  if (playerCha < profile.tradeThreshold) {
    return {
      canTrade: false,
      reason: `Requires Charisma ${profile.tradeThreshold} (you have ${playerCha})`,
      missingCha: profile.tradeThreshold - playerCha
    };
  }
  
  // Check faction reputation requirement if specified
  if (profile.restrictions.requiresReputation !== undefined && npc.factionId) {
    const playerRep = player.factionReputation?.[npc.factionId] || 0;
    if (playerRep < profile.restrictions.requiresReputation) {
      return {
        canTrade: false,
        reason: `Requires ${profile.restrictions.requiresReputation}+ reputation with ${npc.factionId} (you have ${playerRep})`
      };
    }
  }
  
  return {
    canTrade: true,
    recommendedItems: profile.preferredBarters
  };
}

/**
 * Check if NPC will buy an item from player
 */
export function willNpcBuyItem(itemId: string, npc: NPC): boolean {
  const profile = getMerchantProfile(npc.id, npc);
  
  // Check if item is explicitly refused
  if (profile.restrictions.willNotBuyCertain?.includes(itemId)) {
    return false;
  }
  
  return true;
}

/**
 * Check if NPC will sell an item to player
 */
export function willNpcSellItem(itemId: string, npc: NPC): boolean {
  const profile = getMerchantProfile(npc.id, npc);
  
  // Check if item is explicitly restricted
  if (profile.restrictions.willNotSellCertain?.includes(itemId)) {
    return false;
  }
  
  return true;
}

/**
 * Calculate NPC price multiplier for an item
 * Includes base multiplier + preferred barter bonus + rarity bonus
 */
export function calculateNpcPriceMultiplier(
  itemId: string,
  npc: NPC,
  isBuying: boolean = false
): number {
  const profile = getMerchantProfile(npc.id, npc);
  let multiplier = profile.baseMultiplier || 1.0;
  
  // If buying FROM player and item is in preferred barters, offer better prices
  if (isBuying && profile.preferredBarters.includes(itemId)) {
    multiplier *= 1.2; // 20% bonus for preferred items when buying from player
  }
  
  // If selling TO player and item is in preferred barters, increase price
  if (!isBuying && profile.preferredBarters.includes(itemId)) {
    multiplier *= 0.8; // Actually discount when selling preferred items to player (strategic trading)
  }
  
  return multiplier;
}

/**
 * Update market flux for a location
 * Called during world ticks to create supply/demand fluctuations
 */
export function updateMarketFlux(
  location: string,
  state: WorldState,
  previousFlux?: MarketFlux
): MarketFlux {
  const paradoxLevel = (state as any).paradoxScale || 0;
  
  // Higher paradox = more volatile markets
  const baseVolatility = 0.1 + (paradoxLevel / 100) * 0.4; // 0.1-0.5
  const volatility = Math.random() * baseVolatility;
  
  // Randomly shift demand for key items
  const demandedItems = [
    'starlight-iron',
    'void-ash',
    'luminous-gem',
    'solar-steel-ingot',
    'cursed-shard'
  ];
  
  const updates = demandedItems.map(itemId => {
    const current = previousFlux?.demandedItems.find(d => d.itemId === itemId);
    const currentMult = current?.supplyMultiplier || 1.0;
    
    // Random walk: shift by ±(0.1 to 0.3) * volatility
    const shift = (Math.random() - 0.5) * volatility * 2;
    const newMult = Math.max(0.3, Math.min(3.0, currentMult + shift));
    
    // Determine trend based on shift
    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    if (shift > 0.1) trend = 'rising';
    else if (shift < -0.1) trend = 'falling';
    
    return {
      itemId,
      supplyMultiplier: newMult,
      trend
    };
  });
  
  return {
    locationId: location,
    timestamp: Date.now(),
    volatility,
    demandedItems: updates
  };
}

/**
 * Apply market flux to item prices
 */
export function applyMarketFluxToPrice(
  basePrice: number,
  itemId: string,
  flux: MarketFlux
): number {
  const demandItem = flux.demandedItems.find(d => d.itemId === itemId);
  if (!demandItem) {
    return basePrice; // Item not affected by flux
  }
  
  return Math.round(basePrice * demandItem.supplyMultiplier);
}

/**
 * Phase 16: Handle epoch-based item corruption
 * During epoch transitions (e.g., Epoch II: Fracture), transform item availability
 * 
 * Example: Replace iron-scrap with corroded-relics, increase value 500%
 */
export function getEpochCorruptedItem(
  originalItemId: string,
  epoch: string
): { corruptedId?: string; valueMultiplier: number; reason: string } {
  // Epoch II: Fracture corruption rules
  if (epoch === 'epoch_ii_fracture') {
    const corruptionMap: Record<string, { corruptedId: string; multiplier: number }> = {
      'iron-scrap': { corruptedId: 'corroded-relics', multiplier: 5.0 },
      'copper-ore': { corruptedId: 'oxidized-fragments', multiplier: 3.0 },
      'starlight-iron': { corruptedId: 'fractured-starlight', multiplier: 4.0 }
    };
    
    if (corruptionMap[originalItemId]) {
      const mapping = corruptionMap[originalItemId];
      return {
        corruptedId: mapping.corruptedId,
        valueMultiplier: mapping.multiplier,
        reason: 'Epoch II: Fracture - material corruption'
      };
    }
  }
  
  // No corruption for this epoch/item
  return {
    valueMultiplier: 1.0,
    reason: 'No epoch corruption'
  };
}

/**
 * Check if a location's market is affected by an embargo
 * Returns true if player reputation is hostile to controlling faction
 */
export function isLocationUnderEmbargo(
  location: string,
  playerReputation: Record<string, number>,
  state: WorldState
): boolean {
  const controllingFaction = (state.factions || []).find(f => 
    f.controlledLocationIds?.includes(location)
  );
  
  if (!controllingFaction) return false;
  
  const playerRep = playerReputation[controllingFaction.id] || 0;
  
  // Embargo if hostile (reputation < -50)
  return playerRep < -50;
}

/**
 * Generate market alert message (narrative feedback)
 */
export function generateMarketAlert(
  flux: MarketFlux,
  state: WorldState
): { message: string; affectedItems: string[]; severity: 'low' | 'medium' | 'high' } {
  const risingItems = flux.demandedItems.filter(d => d.trend === 'rising');
  const fallingItems = flux.demandedItems.filter(d => d.trend === 'falling');
  
  const severity = flux.volatility > 0.35 ? 'high' : flux.volatility > 0.2 ? 'medium' : 'low';
  
  let message = '';
  if (risingItems.length > 0) {
    message += `Prices rising for: ${risingItems.map(d => d.itemId).join(', ')}. `;
  }
  if (fallingItems.length > 0) {
    message += `Market glut: ${fallingItems.map(d => d.itemId).join(', ')}.`;
  }
  
  return {
    message: message || 'Markets stable.',
    affectedItems: flux.demandedItems.map(d => d.itemId),
    severity
  };
}
