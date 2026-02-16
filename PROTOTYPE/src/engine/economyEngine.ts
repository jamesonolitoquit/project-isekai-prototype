/**
 * Economy Engine (ALPHA_M9 Phase 3) + Milestone 31 Task 2
 * 
 * Manages market prices, trade routes, and dynamic pricing based on:
 * - Location specialization (where you are buying/selling)
 * - Distance modifiers (far locations have higher markups)
 * - Supply/demand factors
 * - Seasonal effects
 * - Item rarity
 * 
 * M31 Addition: World Vault
 * - Persistent global shared economy keyed by WorldTemplateId
 * - Items "donated" or lost in one chronicle appear as expensive relics for all generations
 * - Supports "Community Content" beta goal—shared world heritage
 */

import type { WorldState, UniqueItem } from './worldEngine';
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

// ============================================================================
// M31 Task 2: The "Shadow Market" (World-Level Shared Economy)
// ============================================================================

/**
 * Represents an item in the World Vault (persistent across epochs)
 */
export interface WorldVaultItem {
  itemId: string;
  originalOwnerName: string;       // Name of character who "donated" it
  originalEpochId: string;         // Which epoch it was added
  originalWorldTemplateId: string; // Keyed by template, not world instance
  loreTag: string;                 // "Historical Relic", "Ancestral Heirloom", "Lost Legend"
  basePrice: number;               // Original price
  relicMultiplier: number;         // 2.0 = 2x price (increases with age)
  addedTimestamp: number;          // When it was added to vault
  description: string;             // Fluff text about the item's history
}

/**
 * Global World Vault indexed by WorldTemplateId
 * In a real implementation, this would be in a database
 * For now, persists as part of game state metadata
 */
export interface WorldVault {
  worldTemplateId: string;
  vaultItems: WorldVaultItem[];
  lastPruned: number;              // When old items were archived
  totalValueArchived: number;      // Sum of all relic prices
}

/**
 * Global registry of all world vaults (keyed by templateId)
 * This is a singleton shared across all game instances for the same template
 */
const globalWorldVaults = new Map<string, WorldVault>();

/**
 * Get or create World Vault for a template
 */
export function getOrCreateWorldVault(worldTemplateId: string): WorldVault {
  if (!globalWorldVaults.has(worldTemplateId)) {
    globalWorldVaults.set(worldTemplateId, {
      worldTemplateId,
      vaultItems: [],
      lastPruned: Date.now(),
      totalValueArchived: 0
    });
  }
  return globalWorldVaults.get(worldTemplateId)!;
}

/**
 * Add an item to the World Vault
 * Called when:
 * - Player leaves an item at a shrine/statue
 * - Player dies and item is "lost to time"
 * - Character completes a quest and "donates" reward to history
 */
export function addItemToWorldVault(
  worldTemplateId: string,
  item: UniqueItem | any,
  characterName: string,
  currentEpochId: string,
  loreTag: string = 'Historical Artifact'
): WorldVaultItem {
  const vault = getOrCreateWorldVault(worldTemplateId);
  const basePrice = calculateMarketPrice(item.id || item.itemId);
  
  const vaultItem: WorldVaultItem = {
    itemId: item.id || item.itemId,
    originalOwnerName: characterName,
    originalEpochId: currentEpochId,
    originalWorldTemplateId: worldTemplateId,
    loreTag,
    basePrice,
    relicMultiplier: 2.0,  // Starts at 2x price, increases over time
    addedTimestamp: Date.now(),
    description: `Once wielded by ${characterName} in the ${currentEpochId}. Now a relic of ages past.`
  };

  vault.vaultItems.push(vaultItem);
  vault.totalValueArchived += Math.floor(basePrice * vaultItem.relicMultiplier);

  return vaultItem;
}

/**
 * Get all items currently in World Vault
 * Can filter by lore tag or time period
 */
export function getWorldVaultItems(
  worldTemplateId: string,
  filter?: { loreTag?: string; maxAge?: number }
): WorldVaultItem[] {
  const vault = getOrCreateWorldVault(worldTemplateId);
  
  if (!filter) return vault.vaultItems;

  return vault.vaultItems.filter(item => {
    if (filter.loreTag && item.loreTag !== filter.loreTag) return false;
    if (filter.maxAge) {
      const ageMs = Date.now() - item.addedTimestamp;
      if (ageMs > filter.maxAge) return false;
    }
    return true;
  });
}

/**
 * Calculate relic price (base price × multiplier × age factor)
 * Price increases as items age and become more legendary
 */
export function calculateRelicPrice(vaultItem: WorldVaultItem): number {
  const ageMs = Date.now() - vaultItem.addedTimestamp;
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365); // Rough conversion
  
  // Age multiplier: starts at 1x, increases 0.1x per year (capped at 5x)
  const ageMultiplier = Math.min(5, 1 + (ageYears * 0.1));
  
  return Math.floor(vaultItem.basePrice * vaultItem.relicMultiplier * ageMultiplier);
}

/**
 * Search World Vault for items by criteria
 * Useful for quest hooks ("Find the legendary sword of Kaelith")
 */
export function searchWorldVault(
  worldTemplateId: string,
  query: {
    ownerName?: string;
    itemId?: string;
    loreTag?: string;
    minPrice?: number;
    maxPrice?: number;
  }
): WorldVaultItem[] {
  const vault = getOrCreateWorldVault(worldTemplateId);
  
  return vault.vaultItems.filter(item => {
    if (query.ownerName && !item.originalOwnerName.toLowerCase().includes(query.ownerName.toLowerCase())) {
      return false;
    }
    if (query.itemId && item.itemId !== query.itemId) return false;
    if (query.loreTag && item.loreTag !== query.loreTag) return false;
    
    if (query.minPrice || query.maxPrice) {
      const price = calculateRelicPrice(item);
      if (query.minPrice && price < query.minPrice) return false;
      if (query.maxPrice && price > query.maxPrice) return false;
    }
    
    return true;
  });
}

/**
 * Calculate market price for an item (helper)
 * Falls back to base registry value
 */
function calculateMarketPrice(itemId: string): number {
  const registry = (registryData as any).marketValues;
  return registry?.[itemId]?.basePrice ?? 100;
}

/**
 * Get a formatted description of a vault item for NPC dialogue
 */
export function describeVaultItem(vaultItem: WorldVaultItem): string {
  const ageMs = Date.now() - vaultItem.addedTimestamp;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageStr = ageDays > 365 ? `${Math.floor(ageDays / 365)} years` : `${ageDays} days`;
  
  return `"${vaultItem.description}" (${ageStr} old, ${vaultItem.loreTag})`;
}

/**
 * Remove item from vault (e.g., when character retrieves it)
 */
export function removeFromWorldVault(
  worldTemplateId: string,
  itemId: string,
  ownerName: string
): WorldVaultItem | null {
  const vault = getOrCreateWorldVault(worldTemplateId);
  const index = vault.vaultItems.findIndex(
    item => item.itemId === itemId && item.originalOwnerName === ownerName
  );
  
  if (index === -1) return null;
  
  const [removed] = vault.vaultItems.splice(index, 1);
  vault.totalValueArchived -= Math.floor(calculateRelicPrice(removed));
  
  return removed;
}

/**
 * Prune old items from vault (optional cleanup)
 * Items older than maxAgeDays are archived
 */
export function pruneWorldVault(
  worldTemplateId: string,
  maxAgeDays: number = 365
): { removedCount: number; recoveredValue: number } {
  const vault = getOrCreateWorldVault(worldTemplateId);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  const toRemove = vault.vaultItems.filter(
    item => (now - item.addedTimestamp) > maxAgeMs
  );
  
  let recoveredValue = 0;
  for (const item of toRemove) {
    recoveredValue += calculateRelicPrice(item);
  }
  
  vault.vaultItems = vault.vaultItems.filter(
    item => (now - item.addedTimestamp) <= maxAgeMs
  );
  
  vault.lastPruned = now;
  vault.totalValueArchived = Math.max(0, vault.totalValueArchived - recoveredValue);
  
  return {
    removedCount: toRemove.length,
    recoveredValue
  };
}

/**
 * Export vault state for persistence (to be saved to DB)
 */
export function exportWorldVaults(): Record<string, WorldVault> {
  const exported: Record<string, WorldVault> = {};
  for (const [templateId, vault] of globalWorldVaults.entries()) {
    exported[templateId] = vault;
  }
  return exported;
}

/**
 * Import vault state from persistence (load from DB)
 */
export function importWorldVaults(data: Record<string, WorldVault>): void {
  globalWorldVaults.clear();
  for (const [templateId, vault] of Object.entries(data)) {
    globalWorldVaults.set(templateId, vault);
  }
}
