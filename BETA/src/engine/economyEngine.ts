/**
 * Economy Engine (ALPHA_M9 Phase 3)
 * 
 * Manages market prices, trade routes, and dynamic pricing based on:
 * - Location specialization (where you are buying/selling)
 * - Distance modifiers (far locations have higher markups)
 * - Supply/demand factors
 * - Seasonal effects
 * - Item rarity
 */

import type { WorldState } from './worldEngine';
import registryData from '../data/registry.json';

export type MarketValue = {
  basePrice: number;
  rarity: string;
  category: string;
  supplyMultiplier: number;
  demandMultiplier: number;
  craftingValue: number;
};

export interface PriceQuote {
  itemId: string;
  buyPrice: number;  // Vendor pays player
  sellPrice: number; // Vendor sells to player
  location: string;
  modifiers: {
    location: number;
    distance: number;
    supply: number;
    demand: number;
    seasonal: number;
  };
}

/**
 * Get the market value registry for an item
 */
export function getMarketValue(itemId: string): MarketValue | null {
  const registry = (registryData as any).marketValues;
  return registry?.[itemId] || null;
}

/**
 * Calculate buy price (what vendor pays player for item)
 */
export function calculateBuyPrice(
  itemId: string,
  vendorLocation: string,
  state: WorldState
): number {
  const marketValue = getMarketValue(itemId);
  if (!marketValue) return 0;

  let price = marketValue.basePrice * 0.7; // Merchants buy at 70% base price

  // Apply location modifier (where the vendor is)
  const locationModifiers = (registryData as any).locationPriceModifiers;
  const locMod = locationModifiers?.[vendorLocation]?.buyMultiplier ?? 1.0;
  price *= locMod;

  // Apply seasonal modifier
  const season = state.season || 'spring';
  const economyEvents = (registryData as any).economyEvents;
  Object.values(economyEvents || {}).forEach((event: any) => {
    if (event.rarity === itemId && event.season === season) {
      price *= event.priceModifier;
    }
  });

  // Apply supply multiplier (higher supply = lower buy price)
  price *= (1 / marketValue.supplyMultiplier);

  // Phase 11: Apply embargo modifier based on faction relationships
  const embargoData = applyEmbargoToPrice(
    price,
    state.player?.location || vendorLocation,
    vendorLocation,
    state,
    state.player?.factionReputation || {}
  );
  if (embargoData.isEmbargoed) {
    price *= embargoData.modifier;
  }

  return Math.round(price);
}

/**
 * Calculate sell price (what vendor charges player for item)
 */
export function calculateSellPrice(
  itemId: string,
  vendorLocation: string,
  playerLocation: string,
  state: WorldState
): number {
  const marketValue = getMarketValue(itemId);
  if (!marketValue) return 0;

  let price = marketValue.basePrice; // Start at base price

  // Apply location modifier for vendor
  const locationModifiers = (registryData as any).locationPriceModifiers;
  const locMod = locationModifiers?.[vendorLocation]?.sellMultiplier ?? 1.0;
  price *= locMod;

  // Apply distance modifier (traveling merchants add markup)
  if (playerLocation !== vendorLocation) {
    const distance = calculateLocationDistance(playerLocation, vendorLocation);
    const distanceMarkup = 1.0 + distance * 0.001; // 0.1% per coordinate unit
    price *= distanceMarkup;
  }

  // Apply demand multiplier (higher demand = higher sell price)
  price *= marketValue.demandMultiplier;

  // Apply seasonal modifier
  const season = state.season || 'spring';
  const economyEvents = (registryData as any).economyEvents;
  Object.values(economyEvents || {}).forEach((event: any) => {
    if (event.rarity === itemId && event.season === season) {
      price *= event.priceModifier;
    }
  });

  // Phase 11: Apply embargo modifier based on faction relationships
  const embargoData = applyEmbargoToPrice(
    price,
    playerLocation,
    vendorLocation,
    state,
    state.player?.factionReputation || {}
  );
  if (embargoData.isEmbargoed) {
    price *= embargoData.modifier;
  }

  return Math.round(price);
}

/**
 * Estimate distance between two locations (Euclidean)
 * Returns coordinate units (0-1000 grid)
 */
function calculateLocationDistance(locationA: string, locationB: string): number {
  // Approximation based on location names - in production, use coordinates
  const distances: Record<string, Record<string, number>> = {
    'Eldergrove Village': {
      'Shadow Keep': 250,
      'Shattered Shrine': 180,
      'Maritime Outpost': 320,
    },
    'Shadow Keep': {
      'Eldergrove Village': 250,
      'Shattered Shrine': 180,
      'Maritime Outpost': 350,
    },
    'Shattered Shrine': {
      'Eldergrove Village': 180,
      'Shadow Keep': 180,
      'Maritime Outpost': 400,
    },
    'Maritime Outpost': {
      'Eldergrove Village': 320,
      'Shadow Keep': 350,
      'Shattered Shrine': 400,
    },
  };

  return distances[locationA]?.[locationB] ?? 0;
}

/**
 * Phase 6: Calculate dynamic price modifier based on regional resource scarcity
 * Implements "Regional Market Flux" - prices fluctuate with NPC inventory supply
 */
export function calculateScarcityModifier(
  itemId: string,
  location: string,
  state: WorldState
): number {
  // Scan all NPCs at this location and aggregate their inventory quantities
  const npcsAtLocation = state.npcs.filter(npc => npc.locationId === location);
  
  let totalQuantityAtLocation = 0;
  for (const npc of npcsAtLocation) {
    const inventory = npc.inventory || [];
    const item = inventory.find((i: any) => i.itemId === itemId);
    if (item) {
      totalQuantityAtLocation += (item as any).quantity || 0;
    }
  }

  // Regional baselines: how much of each resource is "normal" at a location
  // Biome-based expectations
  const biomes = state.locations.find(l => l.id === location);
  const biome = biomes?.biome || 'Plains';
  
  const regionalBaselines: Record<string, Record<string, number>> = {
    'corrupted': { 'cursed-locus': 20 },
    'cave': { 'blessed-crystal': 30 },
    'forest': { 'moonleaf': 40 },
    'plains': { 'golden-wheat': 35 },
    'mountain': { 'iron-ore': 25 },
    'maritime': { 'sea-salt': 30 },
  };

  const baseline = regionalBaselines[biome.toLowerCase()]?.[itemId] ?? 20;
  
  // Scarcity curve:
  // - 0 items: price x 3.0 (severe scarcity)
  // - baseline items: price x 1.0 (normal)
  // - 2x baseline: price x 0.5 (surplus/glut)
  // - 3x+ baseline: price x 0.3 (severe oversupply)
  
  let scarcityRatio = totalQuantityAtLocation / baseline;
  let multiplier = 1.0;

  if (scarcityRatio === 0) {
    // No supply at all - severe premium
    multiplier = 3.0;
  } else if (scarcityRatio < 0.5) {
    // Severe scarcity: price x 2.0 to 3.0
    multiplier = 3.0 - (scarcityRatio * 2.0); // Linear from 3.0 to 2.0
  } else if (scarcityRatio < 1.0) {
    // Below baseline: price x 1.0 to 2.0
    multiplier = 2.0 - scarcityRatio; // Linear from 2.0 to 1.0
  } else if (scarcityRatio <= 2.0) {
    // Above baseline but reasonable: price x 0.5 to 1.0
    multiplier = 2.0 - scarcityRatio; // Linear from 1.0 to 0.0, clamped to 0.5
    multiplier = Math.max(0.5, multiplier);
  } else if (scarcityRatio <= 3.0) {
    // Surplus to glut: price x 0.3 to 0.5
    multiplier = Math.max(0.3, 1.0 - (scarcityRatio - 2.0) * 0.2);
  } else {
    // Severe oversupply: price x 0.3
    multiplier = 0.3;
  }

  return multiplier;
}

/**
 * Get a basic price quote for an item
 */
export function getPriceQuote(
  itemId: string,
  vendorLocation: string,
  playerLocation: string,
  state: WorldState,
  action: 'buy' | 'sell'
): PriceQuote {
  const marketValue = getMarketValue(itemId);
  const basePrice = marketValue?.basePrice || 0;

  const buyPrice = calculateBuyPrice(itemId, vendorLocation, state);
  const sellPrice = calculateSellPrice(itemId, vendorLocation, playerLocation, state);

  // Calculate modifiers for transparency
  const distance = calculateLocationDistance(playerLocation, vendorLocation);
  const distanceMod = 1.0 + distance * 0.001;

  // For now, use default location modifier
  const locMod = 1.0;

  return {
    itemId,
    buyPrice,
    sellPrice,
    location: vendorLocation,
    modifiers: {
      location: locMod,
      distance: distanceMod,
      supply: marketValue?.supplyMultiplier || 1.0,
      demand: marketValue?.demandMultiplier || 1.0,
      seasonal: 1.0, // Placeholder for seasonal effects
    },
  };
}

/**
 * Get a price quote with scarcity-based dynamic pricing (Phase 6)
 * Now factors in regional supply when calculating trade values
 */
export function getPriceQuoteWithScarcity(
  itemId: string,
  vendorLocation: string,
  playerLocation: string,
  state: WorldState,
  action: 'buy' | 'sell'
): PriceQuote {
  const baseQuote = getPriceQuote(itemId, vendorLocation, playerLocation, state, action);

  // Apply scarcity modifier to both buy and sell prices
  const scarcityMod = calculateScarcityModifier(itemId, vendorLocation, state);

  return {
    ...baseQuote,
    buyPrice: Math.round(baseQuote.buyPrice * scarcityMod),
    sellPrice: Math.round(baseQuote.sellPrice * scarcityMod),
    modifiers: {
      ...baseQuote.modifiers,
      supply: scarcityMod, // Overwrite supply with calculated scarcity
    },
  };
}

/**
 * Calculate trade profit with scarcity-aware pricing
 */
export function calculateTradeProfitWithScarcity(
  itemId: string,
  sourceLocation: string,
  targetLocation: string,
  quantity: number,
  state: WorldState
): number {
  const sourceBuyPrice = calculateScarcityModifier(itemId, sourceLocation, state) * 
    calculateBuyPrice(itemId, sourceLocation, state);
  const targetSellPrice = calculateScarcityModifier(itemId, targetLocation, state) * 
    calculateSellPrice(itemId, targetLocation, sourceLocation, state);
  
  const profitPerUnit = targetSellPrice - sourceBuyPrice;
  return Math.round(profitPerUnit * quantity);
}

/**
 * Calculate total value of player's inventory
 */
export function calculateInventoryValue(
  inventory: Record<string, number>,
  location: string,
  state: WorldState
): number {
  let totalValue = 0;

  Object.entries(inventory).forEach(([itemId, quantity]) => {
    const price = calculateBuyPrice(itemId, location, state);
    totalValue += price * quantity;
  });

  return totalValue;
}

/**
 * Apply economic event effects (seasonal pricing, shortages, etc.)
 */
export function applyEconomicEvents(state: WorldState): void {
  const economyEvents = (registryData as any).economyEvents;
  const season = state.season || 'spring';

  // Events are applied dynamically at price calculation time
  // This function is a placeholder for future event-driven pricing
}

/**
 * Get specialty items for a vendor
 */
export function getVendorSpecialty(vendorId: string): string[] {
  const vendors = (registryData as any).vendorInventories;
  return vendors?.[vendorId]?.specialty || [];
}

/**
 * Calculate trade profit between two locations
 * (useful for quest/exploration mechanics)
 */
export function calculateTradeProfit(
  itemId: string,
  sourceLocation: string,
  targetLocation: string,
  quantity: number,
  state: WorldState
): number {
  const buyPrice = calculateBuyPrice(itemId, sourceLocation, state);
  const sellPrice = calculateSellPrice(itemId, targetLocation, sourceLocation, state);
  const profitPerUnit = sellPrice - buyPrice;
  return profitPerUnit * quantity;
}

/**
 * Phase 16: Calculate macro-economic modifier (global inflation + paradox scarcity)
 * Applies inflation and paradox-based scarcity to all transactions
 * 
 * globalInflation: 0.05 = 5% price increase globally
 * scarcityBias: 1.2 = 20% additional scarcity multiplier
 * paradoxLevel: 0-100, maps to additional scarcity (0% at paradox=0, +100% at paradox=100)
 */
export function calculateMacroModifier(state: WorldState): number {
  const economics = (state as any).economics || {};
  const globalInflation = economics.globalInflation || 0;
  const scarcityBias = economics.scarcityBias || 1.0;
  
  // Paradox-driven scarcity: at 100% paradox, adds 100% scarcity on top of scarcityBias
  const paradoxLevel = (state as any).paradoxScale || 0;
  const paradoxScarcity = (paradoxLevel / 100) * scarcityBias;
  
  // Total modifier: base inflation + scarcity bias + paradox scarcity
  // Example: 0.05 (inflation) + 1.2 (scarcity) + 0.6 (paradox at 50%) = 1.85x multiplier
  const totalModifier = 1.0 + globalInflation + scarcityBias + paradoxScarcity;
  
  return totalModifier;
}

/**
 * Phase 16: Calculate taxation modifier for a location based on faction control
 * 
 * Returns tax rate applied to prices in hostile/controlled territory
 * - Essential materials: 0% tax (subsidy/favor)
 * - Regular items: baseTaxRate (e.g., 15%)
 * - Forbidden items: 300% confiscation tax
 */
export function calculateTaxModifier(
  itemId: string,
  location: string,
  state: WorldState
): number {
  // Find controlling faction for this location
  const controllingFactionId = findLocationControllingFaction(location, state);
  if (!controllingFactionId) {
    return 1.0; // No faction control = no tax
  }
  
  // Look up faction pricing rules from world state
  const factionRules = (state as any).factionPricingRules?.[controllingFactionId];
  if (!factionRules) {
    return 1.0; // No pricing rules = no tax
  }
  
  const baseTaxRate = factionRules.baseTaxRate || 0;
  
  // Check if item is forbidden by this faction
  const forbiddenItems = (state.factions || [])
    .find(f => f.id === controllingFactionId)
    ?.forbiddenItems || [];
  
  const isForbidden = forbiddenItems.some(fi => fi.itemId === itemId);
  if (isForbidden) {
    // Confiscation tax: 300% markup (item.priceMultiplier or default 3.0)
    const forbiddenItem = forbiddenItems.find(fi => fi.itemId === itemId);
    return forbiddenItem?.priceMultiplier || 3.0;
  }
  
  // Check if item is in faction's modifier list
  const modifiers = factionRules.modifiers || {};
  for (const [modKey, modData] of Object.entries(modifiers)) {
    // Check if this modifier applies to this item
    // For now, apply based on category matching (luxury, war, void, etc.)
    const data = modData as any;
    if (itemId.includes('void') && modKey.includes('void')) {
      return data.baseModifier || 1.0;
    }
    if (itemId.includes('steel') && modKey.includes('iron')) {
      return data.baseModifier || 0.8;
    }
  }
  
  // Default: apply base tax rate (1 + 0.15 = 1.15x for 15% tax)
  return 1.0 + baseTaxRate;
}

/**
 * Phase 16: Check if an item is "Essential" (has faction subsidy)
 * Essential items get reduced taxes or free trades
 */
export function isEssentialMaterial(itemId: string, factionId: string, state: WorldState): boolean {
  const essentialItems = ['copper-ore', 'starlight-iron', 'solar-steel-ingot'];
  return essentialItems.includes(itemId);
}

/**
 * Phase 16: Apply all economic modifiers to a base price
 * Combines macro inflation, taxation, scarcity, and faction modifiers
 */
export function applyAllEconomicModifiers(
  basePrice: number,
  itemId: string,
  location: string,
  state: WorldState,
  modifierContext?: {
    isSelling?: boolean; // true if player is selling to vendor
    quantity?: number;
    distanceMultiplier?: number;
  }
): { finalPrice: number; breakdown: { base: number; inflation: number; tax: number; scarcity: number; distance: number } } {
  let price = basePrice;
  
  // 1. Apply macro modifier (inflation + paradox scarcity)
  const macroMod = calculateMacroModifier(state);
  price *= macroMod;
  
  // 2. Apply taxation
  const taxMod = calculateTaxModifier(itemId, location, state);
  price *= taxMod;
  
  // 3. Apply scarcity-based dynamic pricing if available
  const scarcityMod = calculateScarcityModifier(itemId, location, state);
  price *= scarcityMod;
  
  // 4. Apply distance multiplier if provided
  const distanceMult = modifierContext?.distanceMultiplier || 1.0;
  price *= distanceMult;
  
  return {
    finalPrice: Math.round(price),
    breakdown: {
      base: basePrice,
      inflation: Math.round(basePrice * (macroMod - 1)),
      tax: Math.round(basePrice * (taxMod - 1)),
      scarcity: Math.round(basePrice * (scarcityMod - 1)),
      distance: Math.round(basePrice * (distanceMult - 1))
    }
  };
}

/**
 * Phase 16: Apply epoch-based item corruption to world state
 * Transforms loot tables and item templates when epoch transitions
 * 
 * Example: Epoch II: Fracture transforms iron-scrap → corroded-relics (5x value)
 */
export function applyEpochCorruption(state: WorldState, fromEpoch: string, toEpoch: string): WorldState {
  if (toEpoch !== 'epoch_ii_fracture') {
    return state; // Only fracture epoch has corruption rules for now
  }
  
  // Import getEpochCorruptedItem from merchantEngine
  const { getEpochCorruptedItem } = require('./merchantEngine');
  
  // Transform itemTemplates
  let updatedTemplates = (state.itemTemplates || []).map((template: any) => {
    const corruption = getEpochCorruptedItem(template.id, toEpoch);
    
    if (corruption.corruptedId) {
      // Create corrupted version with new ID and inflated value
      return {
        ...template,
        id: corruption.corruptedId,
        name: `${template.name} (Corrupted)`,
        basePrice: (template as any).basePrice * corruption.valueMultiplier,
        description: `${(template as any).description || ''} [Paradox Corrupted]`,
        kind: 'unique' // Corrupted items become unique
      };
    }
    
    return template;
  });
  
  // Add corrupted items to the list
  const corruptionMap: Record<string, { corruptedId: string; multiplier: number }> = {
    'iron-scrap': { corruptedId: 'corroded-relics', multiplier: 5.0 },
    'copper-ore': { corruptedId: 'oxidized-fragments', multiplier: 3.0 },
    'starlight-iron': { corruptedId: 'fractured-starlight', multiplier: 4.0 }
  };
  
  Object.entries(corruptionMap).forEach(([original, { corruptedId, multiplier }]) => {
    const originalTemplate = updatedTemplates.find((t: any) => t.id === original);
    if (originalTemplate && !updatedTemplates.find((t: any) => t.id === corruptedId)) {
      updatedTemplates.push({
        id: corruptedId,
        name: `${originalTemplate.name} (Fractured)`,
        rarity: 'epic',
        kind: 'unique',
        basePrice: (originalTemplate as any).basePrice * multiplier,
        description: 'Corrupted by the Fracture - extremely rare and unstable',
      });
    }
  });
  
  // Update loot tables to include corrupted items
  let updatedLootTables = (state.lootTables || []).map((table: any) => {
    const corruptedDrops = (table.drops || []).map((drop: any) => {
      const corruption = getEpochCorruptedItem(drop.itemId, toEpoch);
      if (corruption.corruptedId) {
        return {
          ...drop,
          itemId: corruption.corruptedId,
          chance: drop.chance * 0.5 // Corrupted items are half as common
        };
      }
      return drop;
    });
    
    return {
      ...table,
      drops: corruptedDrops
    };
  });
  
  return {
    ...state,
    itemTemplates: updatedTemplates,
    lootTables: updatedLootTables
  };
}
/**
 * Phase 11: Calculate trade embargo price modifier
 * When two factions are at war, markets in their locations apply embargoes:
 * - Selling TO hostile faction: 300% price increase (black market premium)
 * - Buying FROM hostile faction: Prohibited or 300% markup
 * - Allied faction: 10% discount
 */
export function calculateEmbargoModifier(
  buyerLocation: string,
  sellerLocation: string,
  state: WorldState,
  playerFactionReputation?: Record<string, number>
): {
  modifier: number;
  isEmbargoed: boolean;
  reason?: string;
} {
  // Find which factions control these locations
  const buyerLocationFaction = findLocationControllingFaction(buyerLocation, state);
  const sellerLocationFaction = findLocationControllingFaction(sellerLocation, state);

  // No embargo if locations uncontrolled or same faction
  if (!buyerLocationFaction || !sellerLocationFaction || buyerLocationFaction === sellerLocationFaction) {
    return { modifier: 1.0, isEmbargoed: false };
  }

  // Check faction relationships
  const relationship = findFactionRelationship(buyerLocationFaction, sellerLocationFaction, state);

  // War relationship = embargo (300% price increase)
  if (relationship?.type === 'war') {
    return {
      modifier: 3.0,
      isEmbargoed: true,
      reason: `Trade embargo active between ${buyerLocationFaction} and ${sellerLocationFaction}`
    };
  }

  // Alliance relationship = discount (10% off, 0.9x multiplier)
  if (relationship?.type === 'alliance') {
    return {
      modifier: 0.9,
      isEmbargoed: false,
      reason: `Allied faction discount applied`
    };
  }

  // Neutral or no relationship = normal pricing
  return { modifier: 1.0, isEmbargoed: false };
}

/**
 * Find which faction controls a location
 */
export function findLocationControllingFaction(locationId: string, state: WorldState): string | undefined {
  const factions = state.factions || [];
  return factions.find(f => f.controlledLocationIds?.includes(locationId))?.id;
}

/**
 * Find relationship between two factions
 */
export function findFactionRelationship(
  factionAId: string,
  factionBId: string,
  state: WorldState
): { type: string; weight: number } | undefined {
  const relationships = state.factionRelationships || [];
  
  const direct = relationships.find(
    r => (r.factionAId === factionAId && r.factionBId === factionBId) ||
          (r.factionAId === factionBId && r.factionBId === factionAId)
  );

  return direct ? { type: direct.type, weight: direct.weight } : undefined;
}

/**
 * Apply embargo modifier to price quote
 */
export function applyEmbargoToPrice(
  basePrice: number,
  buyerLocation: string,
  sellerLocation: string,
  state: WorldState,
  playerFactionReputation?: Record<string, number>
): { price: number; isEmbargoed: boolean; modifier: number; embargoReason?: string } {
  const embargo = calculateEmbargoModifier(buyerLocation, sellerLocation, state, playerFactionReputation);
  
  return {
    price: Math.round(basePrice * embargo.modifier),
    isEmbargoed: embargo.isEmbargoed,
    modifier: embargo.modifier,
    embargoReason: embargo.reason
  };
}