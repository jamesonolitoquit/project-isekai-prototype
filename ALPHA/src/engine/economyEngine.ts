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
 * Get a price quote for buying or selling an item at a specific vendor
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

  const locationModifiers = (registryData as any).locationPriceModifiers;
  const locMod = locationModifiers?.[vendorLocation]?.sellMultiplier ?? 1.0;

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
