/**
 * M44-D2: Market Economy & Faction Tax Logic
 * 
 * Creates faction-specific price scaling for items based on territory control:
 * - Emerald Syndicate: Low trade taxes (5%) but triple-cost Luxury items
 * - Silver Flame: 50% discount on Holy items, 300% tax on Shadow/Dark items
 * - Shadow Conclave: Reduced cost on Shadow/Dark items
 * 
 * Enables economic pressure as gameplay mechanic tied to faction control.
 */

import { getFactionWarfareEngine } from './factionWarfareEngine';
import type { WorldState } from './worldEngine';

export type ItemCategory = 
  | 'holy' | 'shadow' | 'nature' | 'luxury' 
  | 'common' | 'rare' | 'legendary' | 'cursed';

export type FactionId = 'silver_flame' | 'shadow_conclave' | 'emerald_syndicate';

/**
 * M44-D2: Item price modifier based on faction alignment
 */
export interface PriceModifier {
  itemCategory: ItemCategory;
  baseModifier: number; // 1.0 = no change, 0.5 = half price, 2.0 = double
  description: string;
  reason: 'faction_favor' | 'faction_tax' | 'illegal' | 'luxury_inflation';
}

/**
 * M44-D2: Faction-specific pricing rules
 */
export interface FactionPricingRules {
  factionId: FactionId;
  name: string;
  modifiers: Map<ItemCategory, PriceModifier>;
  baseTaxRate: number; // 0-1 (0.15 = 15% tax)
  ideology: string;
  economicModel: 'mercantile' | 'militant' | 'isolationist';
}

/**
 * M44-D2: Market engine for faction-based pricing
 */
export class MarketEngine {
  private factionRules: Map<FactionId, FactionPricingRules> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize faction-specific pricing rules
   */
  private initializeDefaultRules(): void {
    // Silver Flame: Holy favor, Shadow prohibition
    const silverFlame: FactionPricingRules = {
      factionId: 'silver_flame',
      name: 'Silver Flame',
      economicModel: 'militant',
      baseTaxRate: 0.12, // 12% base tax
      ideology: 'Divine Order & Purification',
      modifiers: new Map([
        ['holy', { itemCategory: 'holy', baseModifier: 0.5, description: 'Holy items 50% off', reason: 'faction_favor' }],
        ['luxury', { itemCategory: 'luxury', baseModifier: 1.0, description: 'Luxury items normal price', reason: 'faction_tax' }],
        ['shadow', { itemCategory: 'shadow', baseModifier: 3.0, description: 'Shadow items banned (300% tax)', reason: 'illegal' }],
        ['cursed', { itemCategory: 'cursed', baseModifier: 5.0, description: 'Cursed items heavy penalty', reason: 'illegal' }],
        ['common', { itemCategory: 'common', baseModifier: 1.0, description: 'Common items standard', reason: 'faction_tax' }],
      ]),
    };

    // Shadow Conclave: Shadow favor, Holy prohibition
    const shadowConclave: FactionPricingRules = {
      factionId: 'shadow_conclave',
      name: 'Shadow Conclave',
      economicModel: 'mercantile',
      baseTaxRate: 0.18, // 18% black market tax
      ideology: 'Deception & Power',
      modifiers: new Map([
        ['shadow', { itemCategory: 'shadow', baseModifier: 0.4, description: 'Shadow items 40% off', reason: 'faction_favor' }],
        ['cursed', { itemCategory: 'cursed', baseModifier: 1.2, description: 'Cursed items slight premium', reason: 'faction_tax' }],
        ['holy', { itemCategory: 'holy', baseModifier: 2.5, description: 'Holy items 250% tax', reason: 'illegal' }],
        ['luxury', { itemCategory: 'luxury', baseModifier: 1.8, description: 'Luxury items premium market', reason: 'faction_tax' }],
        ['common', { itemCategory: 'common', baseModifier: 1.0, description: 'Common items standard', reason: 'faction_tax' }],
      ]),
    };

    // Emerald Syndicate: Luxury inflation, low trade tax
    const emeraldSyndicate: FactionPricingRules = {
      factionId: 'emerald_syndicate',
      name: 'Emerald Syndicate',
      economicModel: 'mercantile',
      baseTaxRate: 0.05, // 5% trade tax (merchant favorable)
      ideology: 'Commerce & Growth',
      modifiers: new Map([
        ['luxury', { itemCategory: 'luxury', baseModifier: 3.0, description: 'Luxury items triple-cost (exclusive market)', reason: 'luxury_inflation' }],
        ['nature', { itemCategory: 'nature', baseModifier: 0.7, description: 'Nature items 30% off', reason: 'faction_favor' }],
        ['rare', { itemCategory: 'rare', baseModifier: 1.5, description: 'Rare items premium', reason: 'faction_tax' }],
        ['holy', { itemCategory: 'holy', baseModifier: 1.1, description: 'Holy items standard-ish', reason: 'faction_tax' }],
        ['shadow', { itemCategory: 'shadow', baseModifier: 1.2, description: 'Shadow items slight premium', reason: 'faction_tax' }],
        ['common', { itemCategory: 'common', baseModifier: 1.0, description: 'Common items standard', reason: 'faction_tax' }],
      ]),
    };

    this.factionRules.set('silver_flame', silverFlame);
    this.factionRules.set('shadow_conclave', shadowConclave);
    this.factionRules.set('emerald_syndicate', emeraldSyndicate);
  }

  /**
   * M44-D2: Calculate final item price with faction taxes and discounts
   * 
   * Formula: 
   * finalPrice = basePrice × factionPriceModifier × (1 + factionTaxRate)
   * 
   * Example: 100g holy item in Silver Flame zone
   * = 100 × 0.5 (holy discount) × (1 + 0.12 tax) = 56g
   */
  getItemPriceMultiplier(
    itemCategory: ItemCategory,
    factionId: FactionId,
    worldState?: WorldState
  ): number {
    const rules = this.factionRules.get(factionId);
    if (!rules) {
      console.warn(`[MarketEngine] Unknown faction: ${factionId}`);
      return 1.0;
    }

    // Get base modifier for item category
    const modifier = rules.modifiers.get(itemCategory);
    if (!modifier) {
      // Default: apply base tax rate only
      return 1.0 * (1 + rules.baseTaxRate);
    }

    // Calculate final multiplier: modifier × (1 + faction tax)
    const finalMultiplier = modifier.baseModifier * (1 + rules.baseTaxRate);

    return finalMultiplier;
  }

  /**
   * M44-D2: Get pricing breakdown for transparency
   */
  getPriceBreakdown(
    itemCategory: ItemCategory,
    basePrice: number,
    factionId: FactionId
  ): {
    basePrice: number;
    modifier: number;
    modifierReason: string;
    baseTax: number;
    finalPrice: number;
    discount: boolean;
    explanation: string;
  } {
    const rules = this.factionRules.get(factionId);
    if (!rules) {
      return {
        basePrice,
        modifier: 1.0,
        modifierReason: 'unknown_faction',
        baseTax: 0,
        finalPrice: basePrice,
        discount: false,
        explanation: `Unknown faction: ${factionId}`,
      };
    }

    const mod = rules.modifiers.get(itemCategory) || {
      itemCategory,
      baseModifier: 1.0,
      description: `${itemCategory} - standard pricing`,
      reason: 'faction_tax',
    };

    const tax = basePrice * mod.baseModifier * rules.baseTaxRate;
    const finalPrice = basePrice * mod.baseModifier + tax;
    const discount = mod.baseModifier < 1.0;

    return {
      basePrice,
      modifier: mod.baseModifier,
      modifierReason: mod.reason,
      baseTax: tax,
      finalPrice,
      discount,
      explanation: mod.description,
    };
  }

  /**
   * M44-D2: Get all active pricing rules for a location
   */
  getFactionPricingRules(factionId: FactionId): FactionPricingRules | null {
    return this.factionRules.get(factionId) || null;
  }

  /**
   * M44-D2: Check if item is illegal in faction territory (3x+ tax)
   */
  isItemIllegal(itemCategory: ItemCategory, factionId: FactionId): boolean {
    const rules = this.factionRules.get(factionId);
    if (!rules) return false;

    const mod = rules.modifiers.get(itemCategory);
    return mod?.reason === 'illegal';
  }

  /**
   * M44-D2: Get tax rate for faction
   */
  getBaseTaxRate(factionId: FactionId): number {
    return this.factionRules.get(factionId)?.baseTaxRate || 0.15;
  }

  /**
   * M44-D2: Get merchant favorability for player (affects trade prices)
   * Lower = better prices for buying
   */
  getMerchantFavorability(factionId: FactionId): number {
    const rules = this.factionRules.get(factionId);
    if (!rules) return 1.0;

    // Emerald Syndicate (mercantile) = best prices
    // Silver Flame (militant) = moderate prices
    // Shadow Conclave (mercantile but risky) = variable prices
    const favorabilityMap: Record<string, number> = {
      emerald_syndicate: 0.95, // Best merchant deals
      silver_flame: 1.0, // Standard pricing
      shadow_conclave: 1.08, // Black market premium
    };

    return favorabilityMap[factionId] || 1.0;
  }

  /**
   * M44-D2: Get all factions and their economic models
   */
  getAllFactionPricingRules(): FactionPricingRules[] {
    return Array.from(this.factionRules.values());
  }

  /**
   * M44-D2: Calculate total market value for player inventory
   * considering faction location taxes
   */
  calculateInventoryMarketValue(
    inventory: Array<{ category: ItemCategory; basePrice: number }>,
    factionId: FactionId
  ): { total: number; breakdown: Record<ItemCategory, number> } {
    const breakdown: Record<ItemCategory, number> = {
      holy: 0,
      shadow: 0,
      nature: 0,
      luxury: 0,
      common: 0,
      rare: 0,
      legendary: 0,
      cursed: 0
    };
    let total = 0;

    for (const item of inventory) {
      const multiplier = this.getItemPriceMultiplier(item.category, factionId);
      const value = item.basePrice * multiplier;
      breakdown[item.category] = (breakdown[item.category] || 0) + value;
      total += value;
    }

    return { total, breakdown };
  }
}

// Singleton instance
let marketEngineInstance: MarketEngine | null = null;

export function getMarketEngine(): MarketEngine {
  if (!marketEngineInstance) {
    marketEngineInstance = new MarketEngine();
  }
  return marketEngineInstance;
}

export function resetMarketEngine(): void {
  marketEngineInstance = null;
}
