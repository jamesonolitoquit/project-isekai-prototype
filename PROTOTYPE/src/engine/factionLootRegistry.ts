/**
 * M44-C4: Faction-Themed Loot Registry
 * 
 * Creates faction-specific item pools for dungeon drops:
 * - Each faction has thematic loot reflecting ideology/power
 * - Elite enemies scale rewards by faction baseStrength
 * - Integrates with dungeonGenerator for deterministic drops
 */

import type { SeededRng } from './prng';
import type { WorldState } from './worldEngine';

/**
 * M44-C4: Item tier and faction association
 */
export interface FactionLoot {
  itemId: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  value: number; // gold
  traits?: string[]; // special traits: holy, shadow, nature, etc
  affinity?: string; // works best with faction
}

/**
 * M44-C4: Faction loot pool with item distribution
 */
export interface FactionLootPool {
  factionId: string;
  commonLoot: FactionLoot[];
  uncommonLoot: FactionLoot[];
  rareLoot: FactionLoot[];
  epicLoot: FactionLoot[];
  legendaryLoot: FactionLoot[];
}

/**
 * M44-C4: Registry for faction-specific loot
 */
export class FactionLootRegistry {
  private static pools: Map<string, FactionLootPool> = new Map();
  private static initialized = false;

  /**
   * Initialize default faction loot pools
   */
  static initializeDefaultPools(): void {
    if (this.initialized) return;

    // Silver Flame faction - Holy light-based loot
    this.registerFactionLoot(
      'silver_flame',
      {
        commonLoot: [
          { itemId: 'holy_scroll', name: 'Holy Scripture', rarity: 'common', value: 50, description: 'Blessed parchment' },
          { itemId: 'faith_token', name: 'Token of Faith', rarity: 'common', value: 75, description: 'Grants light affinity' },
        ],
        uncommonLoot: [
          { itemId: 'blessed_mail', name: 'Blessed Chainmail', rarity: 'uncommon', value: 200, description: 'Grants light resistance', traits: ['holy'] },
          { itemId: 'cleansing_potion', name: 'Holy Water Vial', rarity: 'uncommon', value: 150, description: 'Removes curses' },
        ],
        rareLoot: [
          { itemId: 'holy_relic', name: 'Holy Relic', rarity: 'rare', value: 500, description: 'Powerful holy artifact', traits: ['holy', 'blessed'], affinity: 'silver_flame' },
          { itemId: 'sacred_sword', name: 'Sacred Sword', rarity: 'rare', value: 600, description: 'Divine blade', traits: ['holy'] },
        ],
        epicLoot: [
          { itemId: 'blessed_armor', name: 'Blessed Plate Armor', rarity: 'epic', value: 1500, description: 'Complete holy knight set', traits: ['holy', 'blessed', 'protective'] },
          { itemId: 'radiance_orb', name: 'Orb of Radiance', rarity: 'epic', value: 1800, description: 'Emits divine light', traits: ['holy', 'illumination'] },
        ],
        legendaryLoot: [
          { itemId: 'sanctum_guardian', name: 'Sanctum Guardian Mantle', rarity: 'legendary', value: 5000, description: 'Grants divine protection', traits: ['holy', 'blessed', 'protective', 'epic'] },
          { itemId: 'light_sovereign', name: 'Crown of Light Sovereignty', rarity: 'legendary', value: 6000, description: 'Ultimate holy symbol', traits: ['holy', 'regal'], affinity: 'silver_flame' },
        ],
      },
      { factionId: 'silver_flame', commonLoot: [], uncommonLoot: [], rareLoot: [], epicLoot: [], legendaryLoot: [] }
    );

    // Shadow Conclave - Dark intrigue-based loot
    this.registerFactionLoot(
      'shadow_conclave',
      {
        commonLoot: [
          { itemId: 'shadow_herb', name: 'Shadowfruit Herb', rarity: 'common', value: 50, description: 'Grants stealth' },
          { itemId: 'dark_token', name: 'Obsidian Token', rarity: 'common', value: 70, description: 'Shadow currency' },
        ],
        uncommonLoot: [
          { itemId: 'shadow_cloak', name: 'Shadow Cloak', rarity: 'uncommon', value: 220, description: 'Concealment garment', traits: ['shadow', 'stealth'] },
          { itemId: 'poison_vial', name: 'Poison Vial', rarity: 'uncommon', value: 180, description: 'Toxic compound', traits: ['toxic'] },
        ],
        rareLoot: [
          { itemId: 'assassin_blade', name: "Assassin's Fang", rarity: 'rare', value: 550, description: 'Silenced killing weapon', traits: ['shadow', 'silent', 'deadly'], affinity: 'shadow_conclave' },
          { itemId: 'nightveil_ring', name: 'Nightveil Ring', rarity: 'rare', value: 520, description: 'Grants invisibility', traits: ['shadow'] },
        ],
        epicLoot: [
          { itemId: 'shadow_armor', name: 'Shadow Plate Armor', rarity: 'epic', value: 1600, description: 'Obsidian armor set', traits: ['shadow', 'stealth', 'protective'] },
          { itemId: 'void_orb', name: 'Void Orb', rarity: 'epic', value: 1900, description: 'Absorbs light', traits: ['shadow', 'void'] },
        ],
        legendaryLoot: [
          { itemId: 'shadow_sovereign', name: 'Shadow Sovereign Cloak', rarity: 'legendary', value: 5500, description: 'Ultimate concealment', traits: ['shadow', 'stealth', 'protective', 'epic'] },
          { itemId: 'night_throne', name: 'Crown of Night', rarity: 'legendary', value: 6200, description: 'Master of darkness', traits: ['shadow', 'regal'], affinity: 'shadow_conclave' },
        ],
      },
      { factionId: 'shadow_conclave', commonLoot: [], uncommonLoot: [], rareLoot: [], epicLoot: [], legendaryLoot: [] }
    );

    // Emerald Syndicate - Nature/wealth-based loot
    this.registerFactionLoot(
      'emerald_syndicate',
      {
        commonLoot: [
          { itemId: 'forest_herb', name: 'Forest Herb', rarity: 'common', value: 60, description: 'Restores vitality' },
          { itemId: 'gold_coin', name: 'Emerald Coin', rarity: 'common', value: 100, description: 'Merchant currency' },
        ],
        uncommonLoot: [
          { itemId: 'nature_cloak', name: 'Verdant Cloak', rarity: 'uncommon', value: 210, description: 'Blend with nature', traits: ['nature', 'camouflage'] },
          { itemId: 'gold_ring', name: 'Emerald Ring', rarity: 'uncommon', value: 190, description: 'Increases wealth gain', traits: ['wealth'] },
        ],
        rareLoot: [
          { itemId: 'forest_bow', name: 'Bow of the Woods', rarity: 'rare', value: 520, description: 'Nature archer weapon', traits: ['nature'], affinity: 'emerald_syndicate' },
          { itemId: 'merchant_gem', name: 'Merchant Gem', rarity: 'rare', value: 700, description: 'Doubles trade profit', traits: ['wealth'] },
        ],
        epicLoot: [
          { itemId: 'nature_armor', name: 'Dragon Scale Armor', rarity: 'epic', value: 1700, description: 'Living armor', traits: ['nature', 'protective', 'defensive'] },
          { itemId: 'wealth_crown', name: 'Crown of Prosperity', rarity: 'epic', value: 2000, description: 'Attracts fortune', traits: ['wealth', 'fortune'] },
        ],
        legendaryLoot: [
          { itemId: 'nature_sovereign', name: 'Sovereign Mantle of Growth', rarity: 'legendary', value: 5300, description: 'Legendary guardian of nature', traits: ['nature', 'protective', 'epic'] },
          { itemId: 'merchant_crown', name: 'Crown of Commerce', rarity: 'legendary', value: 6500, description: 'Master merchant insignia', traits: ['wealth', 'regal'], affinity: 'emerald_syndicate' },
        ],
      },
      { factionId: 'emerald_syndicate', commonLoot: [], uncommonLoot: [], rareLoot: [], epicLoot: [], legendaryLoot: [] }
    );

    this.initialized = true;
  }

  /**
   * Register a faction loot pool
   */
  private static registerFactionLoot(factionId: string, loots: Record<string, any>, poolTemplate: FactionLootPool): void {
    const pool: FactionLootPool = {
      factionId,
      commonLoot: loots.commonLoot || [],
      uncommonLoot: loots.uncommonLoot || [],
      rareLoot: loots.rareLoot || [],
      epicLoot: loots.epicLoot || [],
      legendaryLoot: loots.legendaryLoot || [],
    };
    this.pools.set(factionId, pool);
  }

  /**
   * Get loot pool for a faction
   */
  static getPool(factionId: string): FactionLootPool | null {
    return this.pools.get(factionId) || null;
  }

  /**
   * M44-C4: Select loot item from faction pool by rarity
   * Integrates with dungeonGenerator for enemy drops
   */
  static selectLoot(
    factionId: string,
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary',
    rng: SeededRng,
    factionStrengthBonus: number = 1.0
  ): FactionLoot | null {
    const pool = this.getPool(factionId);
    if (!pool) return null;

    const rarityTier: Record<string, FactionLoot[]> = {
      common: pool.commonLoot,
      uncommon: pool.uncommonLoot,
      rare: pool.rareLoot,
      epic: pool.epicLoot,
      legendary: pool.legendaryLoot,
    };

    const items = rarityTier[rarity] || [];
    if (items.length === 0) return null;

    // Select random item
    const idx = Math.floor(rng.next() * items.length);
    return items[idx];
  }

  /**
   * M44-C4: Generate loot table for dungeon room
   * Elite enemies get bonus rarity by faction strength
   */
  static generateRoomLoot(
    factionId: string,
    isEliteRoom: boolean,
    factionBaseStrength: number,
    rng: SeededRng
  ): FactionLoot[] {
    const loot: FactionLoot[] = [];

    // Common loot (always drops)
    let commonItem = this.selectLoot(factionId, 'common', rng);
    if (commonItem) loot.push(commonItem);

    // Uncommon loot (70% chance)
    if (rng.next() < 0.7) {
      let uncommonItem = this.selectLoot(factionId, 'uncommon', rng, factionBaseStrength);
      if (uncommonItem) loot.push(uncommonItem);
    }

    // Rare loot (40% base, increased for elite)
    const rareChance = 0.4 + (isEliteRoom ? 0.3 : 0) + factionBaseStrength * 0.2;
    if (rng.next() < rareChance) {
      let rareItem = this.selectLoot(factionId, 'rare', rng, factionBaseStrength);
      if (rareItem) loot.push(rareItem);
    }

    // Epic loot (elite only, faction strength scaled)
    if (isEliteRoom && rng.next() < factionBaseStrength * 0.4) {
      let epicItem = this.selectLoot(factionId, 'epic', rng, factionBaseStrength);
      if (epicItem) loot.push(epicItem);
    }

    // Legendary (very rare, <1% even for elite)
    if (isEliteRoom && rng.next() < 0.01 * factionBaseStrength) {
      let legItem = this.selectLoot(factionId, 'legendary', rng, factionBaseStrength);
      if (legItem) loot.push(legItem);
    }

    return loot;
  }
}
