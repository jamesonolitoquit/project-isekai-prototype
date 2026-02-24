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

import type { WorldState, UniqueItem, MarketRegistry } from './worldEngine';
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
  const registry = (registryData as unknown as MarketRegistry).marketValues;
  const basePrice = registry?.[itemId];
  if (!basePrice || typeof basePrice !== 'number') return null;
  
  // Construct MarketValue from base price
  return {
    basePrice,
    rarity: 'common',
    category: 'trade_good',
    supplyMultiplier: 1.0,
    demandMultiplier: 1.0,
    craftingValue: basePrice * 0.5
  };
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
  const locationModifiers = (registryData as unknown as MarketRegistry).locationPriceModifiers;
  const locMod = locationModifiers?.[vendorLocation]?.buyMultiplier ?? 1.0;
  price *= locMod;

  // Apply seasonal modifier
  const season = state.season || 'spring';
  const economyEvents = (registryData as unknown as MarketRegistry).economyEvents;
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
  const locationModifiers = (registryData as unknown as MarketRegistry).locationPriceModifiers;
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
  const economyEvents = (registryData as unknown as MarketRegistry).economyEvents;
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

  const locationModifiers = (registryData as unknown as MarketRegistry).locationPriceModifiers;
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
  const economyEvents = (registryData as unknown as MarketRegistry).economyEvents;
  const season = state.season || 'spring';

  // Events are applied dynamically at price calculation time
  // This function is a placeholder for future event-driven pricing
}

/**
 * Get specialty items for a vendor
 */
export function getVendorSpecialty(vendorId: string): string[] {
  // Specialty data is not stored in vendor inventories
  // For now, return empty - would need a separate specialtyMap in registry
  return [];
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
  const registry = (registryData as unknown as MarketRegistry).marketValues;
  return registry?.[itemId] ?? 100;
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

/**
 * Phase 16, Task 5: Advanced Trade & Resource Control
 * 
 * Resource Pool logic enabling factions to gain/lose powerScore based on
 * control of regional resource nodes (e.g., "Forge Summit Iron") across generations.
 * Creates economic drivers for world aging and factional warfare.
 */

export interface ResourceNode {
  nodeId: string;
  locationId: string;
  resourceType: string; // e.g., "iron", "timber", "herbs", "gems"
  resourceName: string; // e.g., "Forge Summit Iron", "Shadowwood Logs"
  basePowerContribution: number; // Power value of this node (typically 3-10)
  controllingFactionId: string | null;
  controlHistory: Array<{
    factionId: string;
    acquiredAt: number;
    lostAt?: number;
    duration: number;
  }>;
}

// Global resource node registry
const resourceNodeRegistry = new Map<string, ResourceNode[]>();

/**
 * Register a resource node in the world
 */
export function registerResourceNode(
  nodeId: string,
  locationId: string,
  resourceType: string,
  resourceName: string,
  basePowerContribution: number = 5
): ResourceNode {
  const node: ResourceNode = {
    nodeId,
    locationId,
    resourceType,
    resourceName,
    basePowerContribution,
    controllingFactionId: null,
    controlHistory: []
  };

  // Get or create node list for this world
  if (!resourceNodeRegistry.has(locationId)) {
    resourceNodeRegistry.set(locationId, []);
  }

  resourceNodeRegistry.get(locationId)!.push(node);
  return node;
}

/**
 * Initialize default resource nodes for a world
 * Creates diverse resource deposits across key locations
 */
export function initializeWorldResources(): ResourceNode[] {
  const nodes: ResourceNode[] = [];

  // Override existing nodes for this world
  resourceNodeRegistry.clear();

  // Define resource nodes across world locations
  const resourceDefinitions = [
    { id: 'iron-forge', location: 'Forge Summit', type: 'metal', name: 'Forge Summit Iron', power: 8 },
    { id: 'timber-shadow', location: 'Shadowwood Forest', type: 'timber', name: 'Shadowwood Logs', power: 6 },
    { id: 'herbs-elder', location: 'Eldergrove Village', type: 'herbs', name: 'Eldergrove Moonflora', power: 5 },
    { id: 'gems-shatter', location: 'Shattered Shrine', type: 'gems', name: 'Shattered Amethysts', power: 7 },
    { id: 'fish-maritime', location: 'Maritime Outpost', type: 'fish', name: 'Deepwater Catch', power: 4 },
    { id: 'coal-volcanic', location: 'Volcanic Wastes', type: 'coal', name: 'Volcanic Coal Seam', power: 9 },
    { id: 'salt-frozen', location: 'Frozen Peaks', type: 'salt', name: 'Frozen Salt Crystals', power: 3 },
    { id: 'rare-mystical', location: 'Mystical Spire', type: 'rare', name: 'Arcane Essence', power: 10 }
  ];

  resourceDefinitions.forEach(def => {
    const node = registerResourceNode(
      def.id,
      def.location,
      def.type,
      def.name,
      def.power
    );
    nodes.push(node);
  });

  return nodes;
}

/**
 * Transfer resource node control to a faction
 * Records control history for analytical purposes
 */
export function setResourceControl(
  nodeId: string,
  factionId: string,
  timestamp: number = Date.now()
): boolean {
  // Find node across all locations
  for (const nodes of resourceNodeRegistry.values()) {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (node) {
      // Record previous control if exists
      if (node.controllingFactionId) {
        const previous = node.controlHistory[node.controlHistory.length - 1];
        if (previous) {
          previous.lostAt = timestamp;
          previous.duration = timestamp - previous.acquiredAt;
        }
      }

      // Set new control
      node.controllingFactionId = factionId;
      node.controlHistory.push({
        factionId,
        acquiredAt: timestamp
      });

      return true;
    }
  }

  return false;
}

/**
 * Get all resource nodes controlled by a faction
 */
export function getFactionResources(factionId: string): ResourceNode[] {
  const controlled: ResourceNode[] = [];

  for (const nodes of resourceNodeRegistry.values()) {
    controlled.push(...nodes.filter(n => n.controllingFactionId === factionId));
  }

  return controlled;
}

/**
 * Calculate faction power bonus from resource control
 * Used during epoch progression to adjust faction powerScore
 */
export function calculateResourcePowerBonus(factionId: string): number {
  const resources = getFactionResources(factionId);
  return resources.reduce((sum, resource) => sum + resource.basePowerContribution, 0);
}

/**
 * Apply resource-based power adjustments to factions during epoch transition
 * Integrates with chronicleEngine to continuously cycle economic power
 */
export function applyResourcePowerToFactions(
  state: WorldState,
  resourcePowerMultiplier: number = 0.3 // 30% of resource power added to faction powerScore
): void {
  if (!state.factions) return;

  state.factions.forEach(faction => {
    const resourceBonus = calculateResourcePowerBonus(faction.id);
    const powerIncrease = resourceBonus * resourcePowerMultiplier;

    // Apply bonus to faction power (capped at reasonable limits)
    const newPower = (faction.powerScore || 50) + powerIncrease;
    faction.powerScore = Math.min(newPower, 150); // Cap at 150 for balance
  });
}

/**
 * Simulate resource control conflict during epoch
 * Factions with weaker powerScore may lose resource control
 */
export function simulateResourceConflict(
  state: WorldState,
  volatilityFactor: number = 0.1 // 10% chance of conflict per epoch
): Array<{ nodeId: string; lostBy: string; wonBy: string }> {
  const changes: Array<{ nodeId: string; lostBy: string; wonBy: string }> = [];

  if (!state.factions) return changes;

  // For each controlled resource
  for (const nodes of resourceNodeRegistry.values()) {
    for (const node of nodes) {
      if (!node.controllingFactionId) continue;

      // Calculate control vulnerability based on faction power
      const controllingFaction = state.factions.find(f => f.id === node.controllingFactionId);
      if (!controllingFaction) continue;

      const factionStrength = controllingFaction.powerScore || 50;

      // Conflict chance based on faction strength relative to average
      const avgFactionPower = (state.factions.reduce((sum, f) => sum + (f.powerScore || 50), 0)) / state.factions.length;
      const relativeStrength = factionStrength / avgFactionPower;
      const conflictChance = volatilityFactor / relativeStrength;

      if (Math.random() < conflictChance) {
        // Find strongest challenger faction
        const challenger = state.factions
          .filter(f => f.id !== node.controllingFactionId)
          .sort((a, b) => (b.powerScore || 50) - (a.powerScore || 50))[0];

        if (challenger) {
          const oldController = node.controllingFactionId;
          setResourceControl(node.nodeId, challenger.id);
          changes.push({
            nodeId: node.nodeId,
            lostBy: oldController,
            wonBy: challenger.id
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Get resource control statistics for analytics
 */
export function getResourceControlStats(): {
  totalNodes: number;
  controlledNodes: number;
  factionControl: Record<string, { count: number; totalPower: number }>;
} {
  const stats = {
    totalNodes: 0,
    controlledNodes: 0,
    factionControl: {} as Record<string, { count: number; totalPower: number }>
  };

  for (const nodes of resourceNodeRegistry.values()) {
    stats.totalNodes += nodes.length;

    for (const node of nodes) {
      if (node.controllingFactionId) {
        stats.controlledNodes++;

        if (!stats.factionControl[node.controllingFactionId]) {
          stats.factionControl[node.controllingFactionId] = { count: 0, totalPower: 0 };
        }

        stats.factionControl[node.controllingFactionId].count++;
        stats.factionControl[node.controllingFactionId].totalPower += node.basePowerContribution;
      }
    }
  }

  return stats;
}

/**
 * Phase 17, Task 3: AI-Driven Faction Economic Simulation
 * 
 * Every 720 ticks (12 hours), the AI simulates trade route competition between factions,
 * adjusting their powerScore and resourcePool based on territorial control and market embargos.
 */

export interface TradeRoute {
  routeId: string;
  fromFactionId: string;
  toLocationId: string;
  resourceType: string;
  profitPerRoute: number;
  embargoed: boolean;
}

export interface EconomicCycleResult {
  cycleTimestamp: number;
  ticksProcessed: number;
  factionEconomicChanges: Record<string, {
    powerGain: number;
    finalPower: number;
    tradeRoutesActive: number;
    resourceIncome: number;
  }>;
  marketEmbargoes: Array<{ from: string; to: string; reason: string }>;
  volatilityIndex: number;
}

// Track active trade routes
const activeTradeRoutes = new Map<string, TradeRoute[]>();

// Track embargo status between factions
const tradeEmbargoes = new Map<string, Set<string>>();

/**
 * Simulate economic cycles during world aging
 * Called every 720 ticks (12 hours in-game time)
 */
export function simulateEconomicCycles(
  state: WorldState,
  ticksElapsed: number = 720
): EconomicCycleResult {
  const result: EconomicCycleResult = {
    cycleTimestamp: Date.now(),
    ticksProcessed: ticksElapsed,
    factionEconomicChanges: {},
    marketEmbargoes: [],
    volatilityIndex: 0
  };

  if (!state.factions || state.factions.length === 0) {
    return result;
  }

  // Calculate trade income for each faction
  const resourcePowerMap = getResourceControlStats();

  state.factions.forEach(faction => {
    const resourceControl = resourcePowerMap.factionControl[faction.id] || { count: 0, totalPower: 0 };
    
    // Base economic power: resources controlled
    const resourceIncome = resourceControl.totalPower * 2; // 2 power per each base contribution
    
    // Calculate active trade routes
    const tradeRoutes = getActiveTradeRoutes(faction.id);
    const tradeIncome = tradeRoutes.reduce((sum, route) => {
      // Check if embargoed
      if (isTradeEmbargoed(route.fromFactionId, faction.id)) {
        return sum; // Embargoed routes generate 0 income
      }
      return sum + route.profitPerRoute;
    }, 0);

    // Total economic gain this cycle
    const totalIncome = resourceIncome + tradeIncome;
    const powerGain = Math.floor(totalIncome * 0.15); // 15% of income becomes power

    // Apply power gain
    const oldPower = faction.powerScore || 50;
    const newPower = Math.min(oldPower + powerGain, 150); // Cap at 150
    
    faction.powerScore = newPower;

    result.factionEconomicChanges[faction.id] = {
      powerGain,
      finalPower: newPower,
      tradeRoutesActive: tradeRoutes.filter(t => !isTradeEmbargoed(t.fromFactionId, faction.id)).length,
      resourceIncome
    };
  });

  // Simulate embargo dynamics (weak factions embargo strong competitors)
  result.marketEmbargoes = simulateTradeEmbargoes(state);

  // Calculate market volatility (0-1)
  const powerVariance = calculatePowerVariance(state);
  result.volatilityIndex = Math.min(powerVariance / 50, 1); // Normalize to 0-1

  return result;
}

/**
 * Get all active trade routes for a faction
 */
function getActiveTradeRoutes(factionId: string): TradeRoute[] {
  return activeTradeRoutes.get(factionId) || [];
}

/**
 * Register a new trade route between faction and location
 */
export function registerTradeRoute(
  routeId: string,
  factionId: string,
  toLocationId: string,
  resourceType: string,
  profitPerRoute: number = 5
): TradeRoute {
  const route: TradeRoute = {
    routeId,
    fromFactionId: factionId,
    toLocationId,
    resourceType,
    profitPerRoute,
    embargoed: false
  };

  if (!activeTradeRoutes.has(factionId)) {
    activeTradeRoutes.set(factionId, []);
  }
  activeTradeRoutes.get(factionId)!.push(route);

  return route;
}

/**
 * Check if trade is embargoed between two factions
 */
function isTradeEmbargoed(fromFactionId: string, toFactionId: string): boolean {
  if (!tradeEmbargoes.has(fromFactionId)) {
    return false;
  }
  return tradeEmbargoes.get(fromFactionId)!.has(toFactionId);
}

/**
 * Simulate embargo dynamics
 * Weak factions form trade blocs to embargo stronger competitors
 */
function simulateTradeEmbargoes(state: WorldState): Array<{ from: string; to: string; reason: string }> {
  const embargoes: Array<{ from: string; to: string; reason: string }> = [];

  if (!state.factions || state.factions.length < 2) {
    return embargoes;
  }

  const sortedByPower = [...state.factions].sort((a, b) => (b.powerScore || 50) - (a.powerScore || 50));
  const strongestFaction = sortedByPower[0];

  // Weaker factions form embargo coalition against dominant faction
  const embargoThreshold = (strongestFaction.powerScore || 50) * 0.7;

  sortedByPower.forEach(faction => {
    if (faction.id !== strongestFaction.id && (faction.powerScore || 50) < embargoThreshold) {
      // This faction should embargo the strongest
      if (!tradeEmbargoes.has(faction.id)) {
        tradeEmbargoes.set(faction.id, new Set());
      }

      if (!tradeEmbargoes.get(faction.id)!.has(strongestFaction.id)) {
        tradeEmbargoes.get(faction.id)!.add(strongestFaction.id);
        embargoes.push({
          from: faction.name || faction.id,
          to: strongestFaction.name || strongestFaction.id,
          reason: 'Economic power imbalance - forming trade bloc'
        });
      }
    }
  });

  return embargoes;
}

/**
 * Calculate variance in faction power (for volatility index)
 */
function calculatePowerVariance(state: WorldState): number {
  if (!state.factions || state.factions.length === 0) return 0;

  const powers = state.factions.map(f => f.powerScore || 50);
  const mean = powers.reduce((a, b) => a + b, 0) / powers.length;
  const variance = powers.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / powers.length;

  return Math.sqrt(variance);
}

/**
 * Clear all trade routes and embargoes (for new chronicle or reset)
 */
export function resetEconomicState(): void {
  activeTradeRoutes.clear();
  tradeEmbargoes.clear();
}
/**
 * Phase 18 Task 2: Faction Strategy Interface
 * AI-driven economic strategies for autonomous faction behavior
 */
export interface FactionStrategy {
  strategyId: string;
  factionId: string;
  type: 'embargo' | 'trade_expansion' | 'hoarding' | 'dominance';
  targetFactionId?: string;           // For embargo/dominance strategies
  duration: number;                   // Ticks this strategy remains active
  startTick: number;
  priority: number;                   // 1-10 (1=low, 10=critical)
  expectedReturn?: number;            // Estimated profit/power gain
}

// Track active faction strategies
const factionStrategies = new Map<string, FactionStrategy[]>();

// Track hoarding status per faction
const hoardingStatus = new Map<string, { enabled: boolean; since: number; priceMultiplier: number }>();

/**
 * Phase 18 Task 2: Generate AI strategy for a faction
 * Considers scarcity metrics and relative power to decide economic moves
 */
export function generateFactionStrategy(
  state: WorldState,
  factionId: string,
  scarcityLevel: number = 0.5 // 0-1
): FactionStrategy | null {
  const faction = state.factions?.find(f => f.id === factionId);
  if (!faction) return null;

  const sortedFactions = [...(state.factions || [])].sort((a, b) => (b.powerScore || 50) - (a.powerScore || 50));
  const strongestFaction = sortedFactions[0];
  const isWeaker = (faction.powerScore || 50) < ((strongestFaction?.powerScore || 50) * 0.7);

  // Determine strategy based on economic conditions
  let type: FactionStrategy['type'] = 'trade_expansion'; // Default
  let targetFactionId: string | undefined;
  let expectedReturn = 0;

  if (isWeaker && scarcityLevel > 0.4) {
    // Weak faction in scarce times → embargo strong competitors
    type = 'embargo';
    targetFactionId = strongestFaction?.id;
    expectedReturn = 5; // Modest benefit from slowing competitors
  } else if (scarcityLevel > 0.7) {
    // High scarcity → enter hoarding mode
    type = 'hoarding';
    expectedReturn = 15; // High price markups during scarcity
  } else if (!isWeaker && scarcityLevel < 0.3) {
    // Strong faction in stable times → aggressive expansion
    type = 'dominance';
    expectedReturn = 20; // Significant power gain from market control
  } else {
    // Normal conditions → trade expansion
    type = 'trade_expansion';
    expectedReturn = 8;
  }

  const strategy: FactionStrategy = {
    strategyId: `strat-${factionId}-${Date.now()}`,
    factionId,
    type,
    targetFactionId,
    duration: 500 + Math.random() * 500, // 500-1000 ticks
    startTick: Date.now(),
    priority: isWeaker ? 8 : 5,
    expectedReturn
  };

  // Store strategy
  if (!factionStrategies.has(factionId)) {
    factionStrategies.set(factionId, []);
  }
  factionStrategies.get(factionId)!.push(strategy);

  return strategy;
}

/**
 * Phase 18 Task 2: Apply embargo multiplier to trade pricing
 * Embargoed routes incur 3.0x markup (3x normal profit)
 */
export function applyEmbargoPriceMultiplier(
  basePrice: number,
  fromFactionId: string,
  toFactionId: string
): number {
  if (isTradeEmbargoed(fromFactionId, toFactionId)) {
    // Embargo in effect: 3.0x markup on base price
    return basePrice * 3.0;
  }
  return basePrice;
}

/**
 * Phase 18 Task 2: Propose trade deal between factions
 * With counter-offer logic for negotiation
 */
export interface TradeDealProposal {
  dealId: string;
  initiatorFactionId: string;
  targetFactionId: string;
  resources: Array<{ type: string; quantity: number }>;
  requestedReturn: Array<{ type: string; quantity: number }>;
  proposedAt: number;
  acceptanceDeadline: number;
  counterOfferActive?: boolean;
  counterOffer?: TradeDealProposal;
  status: 'proposed' | 'counter_offered' | 'accepted' | 'rejected' | 'expired';
}

const activeTradeDealProposals = new Map<string, TradeDealProposal>();

/**
 * Phase 18 Task 2: Create trade deal proposal
 */
export function proposeTradeDeal(
  initiatorId: string,
  targetId: string,
  resources: Array<{ type: string; quantity: number }>,
  requestedReturn: Array<{ type: string; quantity: number }>,
  durationTicks: number = 300
): TradeDealProposal {
  const deal: TradeDealProposal = {
    dealId: `deal-${initiatorId}-${targetId}-${Date.now()}`,
    initiatorFactionId: initiatorId,
    targetFactionId: targetId,
    resources,
    requestedReturn,
    proposedAt: Date.now(),
    acceptanceDeadline: Date.now() + (durationTicks * 50), // Rough conversion to ms
    status: 'proposed'
  };

  activeTradeDealProposals.set(deal.dealId, deal);
  return deal;
}

/**
 * Phase 18 Task 2: Create counter-offer for active trade deal
 */
export function createCounterOffer(
  originalDealId: string,
  counterResources: Array<{ type: string; quantity: number }>,
  counterReturn: Array<{ type: string; quantity: number }>
): TradeDealProposal | null {
  const original = activeTradeDealProposals.get(originalDealId);
  if (!original) return null;

  const counter: TradeDealProposal = {
    dealId: `counter-${originalDealId}-${Date.now()}`,
    initiatorFactionId: original.targetFactionId,   // Responder becomes initiator
    targetFactionId: original.initiatorFactionId,   // Proposer becomes target
    resources: counterResources,
    requestedReturn: counterReturn,
    proposedAt: Date.now(),
    acceptanceDeadline: original.acceptanceDeadline,
    status: 'counter_offered'
  };

  original.counterOfferActive = true;
  original.counterOffer = counter;
  activeTradeDealProposals.set(counter.dealId, counter);

  return counter;
}

/**
 * Phase 18 Task 2: Accept trade deal
 */
export function acceptTradeDeal(dealId: string): boolean {
  const deal = activeTradeDealProposals.get(dealId);
  if (!deal || deal.status !== 'proposed') {
    return false;
  }

  deal.status = 'accepted';
  // Would trigger resource transfer in actual game loop
  return true;
}

/**
 * Phase 18 Task 2: Check and apply resource hoarding
 * If scarcity > 80%, faction enters hoarding mode with 50% price markup
 */
export function applyResourceHoarding(
  state: WorldState,
  factionId: string,
  scarcityLevel: number
): { hoardingActive: boolean; priceMultiplier: number } {
  const hoardingThreshold = 0.8; // 80% scarcity triggers hoarding

  if (scarcityLevel > hoardingThreshold) {
    // Enable hoarding
    if (!hoardingStatus.has(factionId)) {
      hoardingStatus.set(factionId, {
        enabled: true,
        since: Date.now(),
        priceMultiplier: 1.5 // 50% price increase
      });
    }

    const status = hoardingStatus.get(factionId)!;
    status.enabled = true;
    return { hoardingActive: true, priceMultiplier: status.priceMultiplier };
  } else {
    // Disable hoarding if scarcity drops
    const status = hoardingStatus.get(factionId);
    if (status) {
      status.enabled = false;
      return { hoardingActive: false, priceMultiplier: 1.0 };
    }
  }

  return { hoardingActive: false, priceMultiplier: 1.0 };
}

/**
 * Phase 18 Task 2: Get current faction economic strategy
 */
export function getCurrentFactionStrategy(factionId: string): FactionStrategy | null {
  const strategies = factionStrategies.get(factionId);
  if (!strategies || strategies.length === 0) return null;

  // Return most recent active strategy
  return strategies[strategies.length - 1];
}

/**
 * Phase 18 Task 2: Get hoarding status for faction
 */
export function getHoardingStatus(factionId: string): { hoardingActive: boolean; priceMultiplier: number } | null {
  return hoardingStatus.get(factionId) || null;
}

/**
 * Phase 18 Task 2: Update active trade deals (expire old ones, progress negotiations)
 */
export function updateTrackedTradeDealProposals(): void {
  const now = Date.now();

  for (const [dealId, deal] of activeTradeDealProposals.entries()) {
    // Expire old proposals
    if (deal.status === 'proposed' && now > deal.acceptanceDeadline) {
      deal.status = 'expired';
    }

    // Similarly for counter offers
    if (deal.status === 'counter_offered' && now > deal.acceptanceDeadline) {
      deal.status = 'expired';
    }
  }
}