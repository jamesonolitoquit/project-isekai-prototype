/**
 * Phase 31: Seasonal Merchant Integration
 * 
 * Applies seasonal discounts to merchant inventory based on active festivals
 * Integrates seasonalEventEngine with NPC merchant systems
 */

import type { WorldState, NPC, InventoryItem } from './worldEngine';
import { getSeasonalEventEngine } from './seasonalEventEngine';

export interface MerchantDiscount {
  itemId: string;
  basePrice: number;
  discountedPrice: number;
  discountPercent: number;
  eventId: string;
  eventName: string;
}

/**
 * Get active seasonal discounts for an NPC merchant
 * 
 * @param npc Merchant NPC
 * @param state Current world state (for season, tick, etc)
 * @returns Array of applicable discounts for this tick
 */
export function getActiveMerchantDiscounts(
  npc: NPC,
  state: WorldState
): MerchantDiscount[] {
  if (!npc.isShopkeeper) return [];

  const seasonalEngine = getSeasonalEventEngine();
  const activeEvents = seasonalEngine.activeEvents || [];
  const discounts: MerchantDiscount[] = [];

  // Get NPC's merchant type/faction
  const npcFaction = npc.faction || 'neutral';

  for (const event of activeEvents) {
    // Check if this event has merchant discounts
    if (!event.effects || !event.effects.length) continue;

    for (const effect of event.effects) {
      if (effect.type !== 'merchant_discount') continue;

      // Check if discount applies to this merchant's faction
      const appliesToFaction = !effect.targetFactions || 
        effect.targetFactions.length === 0 ||
        effect.targetFactions.includes(npcFaction);

      if (!appliesToFaction) continue;

      // Build discount entry
      const discount = effect.payload as { percent?: number; itemTypes?: string[] } || {};
      const discountPercent = discount.percent ?? 15;  // Default 15% off

      // If specific item types are targeted, create discounts for those
      if (discount.itemTypes && discount.itemTypes.length > 0) {
        // Filter NPC inventory by item type
        const matchingItems = (npc.inventory || []).filter(item => {
          // Simple item type detection from ID
          return discount.itemTypes!.some(type => 
            item.itemId && item.itemId.includes(type)
          );
        });

        for (const item of matchingItems) {
          const basePrice = item.price || calculateDefaultPrice(item);
          const discountedPrice = Math.floor(basePrice * (1 - discountPercent / 100));

          discounts.push({
            itemId: item.itemId,
            basePrice,
            discountedPrice,
            discountPercent,
            eventId: event.eventId,
            eventName: event.name
          });
        }
      }
    }
  }

  return discounts;
}

/**
 * Apply seasonal discounts to merchant inventory display
 * 
 * @param npc Merchant NPC
 * @param state Current world state
 * @returns Modified inventory with discount prices applied
 */
export function getMerchantInventoryWithDiscounts(
  npc: NPC,
  state: WorldState
): InventoryItem[] {
  if (!npc.inventory) return [];

  const discounts = getActiveMerchantDiscounts(npc, state);
  const discountMap = new Map(
    discounts.map(d => [d.itemId, d.discountedPrice])
  );

  return npc.inventory.map(item => {
    const discountedPrice = discountMap.get(item.itemId);
    return discountedPrice !== undefined
      ? { ...item, price: discountedPrice, _originalPrice: item.price }
      : item;
  });
}

/**
 * Calculate default price for an item based on rarity/type
 * Used when item doesn't have explicit price
 */
function calculateDefaultPrice(item: InventoryItem): number {
  const basePrices: Record<string, number> = {
    'common': 10,
    'rare': 50,
    'legendary': 200,
    'artifact': 500,
    'cursed': 100
  };

  // Try to detect rarity from item ID
  for (const [rarity, price] of Object.entries(basePrices)) {
    if (item.itemId.toLowerCase().includes(rarity)) {
      return price;
    }
  }

  return 25;  // Default price
}

/**
 * Get filtered merchant inventory for category
 * Used by the UI to display sorted/categorized items
 */
export function getMerchantInventoryByCategory(
  npc: NPC,
  state: WorldState,
  category: string
): InventoryItem[] {
  const inventory = getMerchantInventoryWithDiscounts(npc, state);
  
  return inventory.filter(item => {
    // Simple category detection from item ID
    const itemIdLower = item.itemId.toLowerCase();
    return itemIdLower.includes(category.toLowerCase());
  });
}

/**
 * Get merchant UI display data with seasonal effects
 * Returns merchant info + active discounts + atmosphere
 */
export function getMerchantDisplayData(
  npc: NPC,
  state: WorldState
) {
  const discounts = getActiveMerchantDiscounts(npc, state);
  const inventory = getMerchantInventoryWithDiscounts(npc, state);
  
  return {
    merchant: {
      id: npc.id,
      name: npc.name,
      location: npc.currentLocation,
      faction: npc.faction,
      greeting: npc.dialogue?.[0]?.text || 'Greetings, traveler!'
    },
    inventory,
    activeDiscounts: discounts,
    discountCount: discounts.length,
    totalDiscountSavings: discounts.reduce((sum, d) => 
      sum + (d.basePrice - d.discountedPrice), 0
    ),
    atmosphereEffect: state.atmosphereState,
    seasonalContext: {
      season: state.currentSeason,
      dayOfYear: state.tick % 360,  // Rough day calculation
      hasActiveEvents: discounts.length > 0
    }
  };
}

/**
 * Apply seasonal event effect to NPC state
 * Used to modify NPC behavior/appearance during festivals
 */
export function applySeasonalEventEffectToNpc(
  npc: NPC,
  state: WorldState
): Partial<NPC> {
  const seasonalEngine = getSeasonalEventEngine();
  const activeEvents = seasonalEngine.activeEvents || [];
  
  const updates: Partial<NPC> = {};

  for (const event of activeEvents) {
    if (!event.effects || !event.effects.length) continue;

    for (const effect of event.effects) {
      // Apply atmosphere shift
      if (effect.type === 'atmosphere_shift') {
        const payload = effect.payload as Record<string, any>;
        if (payload.description) {
          updates.description = (updates.description || npc.description || '') + 
            ` [${payload.description}]`;
        }
      }

      // Apply cosmetic changes
      if (effect.type === 'cosmetic_change') {
        const payload = effect.payload as Record<string, any>;
        if (payload.appearance) {
          updates.appearance = payload.appearance;
        }
        if (payload.emotion) {
          updates.currentEmotion = payload.emotion;
        }
      }

      // Override dialogue
      if (effect.type === 'dialogue_override') {
        const payload = effect.payload as Record<string, any>;
        if (payload.greeting) {
          const festivalDialogue = [{
            id: `festival_${event.eventId}`,
            text: payload.greeting,
            choices: [],
            isSecret: false
          }];
          updates.dialogue = festivalDialogue;
        }
      }
    }
  }

  return updates;
}

/**
 * Get merchant discount info for UI tooltip
 * Shows why a discount is applied and by which event
 */
export function getMerchantDiscountTooltip(
  itemId: string,
  npc: NPC,
  state: WorldState
): string | null {
  const discounts = getActiveMerchantDiscounts(npc, state);
  const itemDiscount = discounts.find(d => d.itemId === itemId);

  if (!itemDiscount) return null;

  return `${itemDiscount.discountPercent}% off during ${itemDiscount.eventName}`;
}
