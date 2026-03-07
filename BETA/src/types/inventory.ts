/**
 * Inventory & Equipment Schemas (Phase 4 - DSS 09, DSS 12)
 *
 * Implements item management, equipment stats, durability mechanics, and encumbrance.
 * Integrates with:
 * - DSS 09: Production chains, finished items with durability and market value
 * - DSS 12: Workstation-based crafting, material volatility, durability floors
 * - DSS 08: Armor DR (Damage Reduction) and Integrity tracking
 * - DSS 01: Weapon skill requirements and attribute-based usage penalties
 *
 * Core Concept: Inventory is a limited resource (encumbrance system).
 * Equipment has durability that degrades with use. Items are produced through
 * crafting pipelines and have market values that fluctuate by region/faction.
 */

/**
 * Item Rarity: Classification of item commonality and power
 */
export type ItemRarity =
  | 'common'      // Wood, leather, stone
  | 'uncommon'    // Iron, steel, herbs
  | 'rare'        // Enchanted, masterwork, rare materials
  | 'very_rare'   // Artifact-grade components
  | 'legendary'   // Unique items, god-touched
  | 'cursed';     // Paradox-linked items (Black Market)

/**
 * Item Slot: Where in equipment this item goes
 */
export type EquipmentSlot =
  | 'head'
  | 'neck'
  | 'chest'
  | 'hands'
  | 'waist'
  | 'legs'
  | 'feet'
  | 'main_hand'
  | 'off_hand'
  | 'back'
  | 'ring_1'
  | 'ring_2'
  | 'ring_3'
  | 'ring_4';

/**
 * Weapon Category: Classification of weapons by type and scaling
 */
export type WeaponCategory =
  | 'sword'
  | 'axe'
  | 'hammer'
  | 'polearm'
  | 'bow'
  | 'crossbow'
  | 'dagger'
  | 'staff'
  | 'spear'
  | 'shield'
  | 'fist'
  | 'exotic';

/**
 * Armor Type: Classification of armor by protection type and coverage
 */
export type ArmorType =
  | 'light_armor'    // Leather, studded (AGI penalty: 0)
  | 'medium_armor'   // Chain, scale (AGI penalty: -1)
  | 'heavy_armor'    // Plate mail (AGI penalty: -2)
  | 'robes'          // Cloth, wizard robes (no penalty, low DR)
  | 'shield';        // Shields (stacks with armor)

/**
 * Damage Type: What kind of damage the weapon deals
 */
export type DamageType =
  | 'physical'
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'necrotic';

/**
 * Base Item: Minimum structure for any object in inventory
 *
 * Items are persistent objects with weight, value, and durability.
 * All items can be dropped, traded, enchanted, or destroyed.
 */
export interface Item {
  /** Unique item ID */
  id: string;

  /** Human-readable item name */
  name: string;

  /** Item classification */
  itemType:
    | 'weapon'
    | 'armor'
    | 'consumable'
    | 'resource'
    | 'quest'
    | 'tool'
    | 'spell_component'
    | 'currency';

  /** Rarity classification */
  rarity: ItemRarity;

  /** Item weight in kg */
  weight: number;

  /** Base market value in Currency (fluctuates by faction/region) */
  baseMarketValue: number;

  /** Current market value (may differ from base) */
  currentMarketValue: number;

  /** Faction/region where value is current (for market fluctuation) */
  marketValueRegion: string | null;

  /**
   * If this item is part of a production chain, which source materials are required?
   * Example: "Iron Sword" = ["Iron Ore × 2", "Wood × 1", "Leather × 0.5"]
   */
  materialRequirements: {
    materialId: string;
    quantity: number;
    wasteMultiplier: number; // 1.1 (Tier 1), 1.0 (Tier 2), 0.9 (Tier 3)
  }[];

  /** Workstation tier required to produce this item */
  requiredWorkstationTier: 1 | 2 | 3 | 5 | null; // null = cannot be crafted

  /** Skill required to craft this item (e.g., "blacksmithing") */
  requiredCraftingSkill: string | null;

  /** DC (Difficulty Class) for crafting this item */
  craftingDC: number | null;

  /** Description for UI/tooltips */
  description: string;

  /** Flavor/narrative text */
  lore: string;

  /** When this item was created (tick number) */
  createdAtTick: number;

  /** Owner's vessel ID (if in someone's inventory) */
  owningVesselId: string | null;

  /** Location where item is dropped (if not in inventory) */
  droppedLocationId: string | null;
}

/**
 * Durability: Tracking for item integrity over time
 *
 * Items break or degrade when durability reaches 0.
 * Durability loss depends on item type and usage frequency.
 */
export interface Durability {
  /** Current durability points (0 = broken) */
  current: number;

  /** Maximum durability (baseline) */
  maximum: number;

  /**
   * Durability floor from crafting
   * Determines how low durability can degrade per use
   * Failed DEX check during crafting sets this to 0.5x (brittle)
   */
  floor: number; // 0.5 = brittle (breaks 2x faster), 1.0 = normal

  /** Decay rate per use (depends on item type) */
  decayPerUse: number;

  /** Last time durability was repaired */
  lastRepairedAtTick: number;

  /** How many times this item has been repaired (for crafting XP) */
  repairCount: number;

  /** Whether item is broken and non-functional */
  isBroken: boolean;
}

/**
 * Weapon: Equipment piece that deals damage in combat
 *
 * Weapons are defined by:
 * - Damage (base + attribute scaling)
 * - Reach (melee vs ranged)
 * - Skill requirement (STR/DEX/INT etc.)
 * - Attribute requirement (can't use 15 STR greatsword with 5 STR)
 * - Durability (degrades with use)
 */
export interface Weapon extends Item {
  itemType: 'weapon';

  /** Weapon category (sword, bow, etc.) */
  weaponCategory: WeaponCategory;

  /** Base damage (before attribute modifiers) */
  baseDamage: number;

  /** Type of damage dealt (slashing, piercing, fire, etc.) */
  damageType: DamageType;

  /** Which attribute scales damage (STR for melee, DEX for daggers/bows, INT for staves) */
  damageStat: 'STR' | 'DEX' | 'INT' | 'WIS';

  /** Damage scaling multiplier (0.5 = 0.5x attribute bonus, 1.0 = full bonus) */
  damageScaling: number; // 0.5, 0.75, 1.0, 1.5

  /** Minimum attribute requirement (if not met, -5 penalty and 2x stamina) */
  requiredAttribute: 'STR' | 'DEX' | 'AGI' | 'INT' | 'WIS';
  requiredAttributeValue: number;

  /** Skill proficiency bonus (from Weapon Proficiency skill) */
  skillProficiencyBonus: number;

  /**
   * Reach in meters (melee weapons 1-2m, polearms 3m, ranged 20-100m)
   * Used for targeting in 3D grid
   */
  reach: number;

  /** Attack speed (attacks per second) */
  attacksPerSecond: number;

  /** Critical hit chance modifier (0.05 = +5% crit chance) */
  criticalChanceModifier: number;

  /** Critical damage multiplier (1.5x to 3.0x) */
  criticalMultiplier: number;

  /** Stamina cost per attack */
  staminaCostPerAttack: number;

  /** Whether weapon requires two hands to wield */
  requiresTwoHands: boolean;

  /** Alternative one-hand damage (if can be wielded one-handed) */
  oneHandDamage: number | null;

  /** Durability: tracks integrity (degrades with use) */
  durability: Durability;

  /** Special properties (enchantments, etc.) */
  specialProperties: Map<string, number>; // e.g., "fire_damage": 1d6, "speed_bonus": 1
}

/**
 * Armor: Protective equipment that reduces incoming damage
 *
 * Armor is defined by:
 * - DR (Damage Reduction): flat damage reduction
 * - Integrity: durability of the armor itself
 * - Encumbrance penalty: AGI penalty from wearing heavy armor
 * - Skill requirement: heavier armor needs more STR to wear effectively
 */
export interface Armor extends Item {
  itemType: 'armor';

  /** Armor type (light, medium, heavy) */
  armorType: ArmorType;

  /** Equipment slot this armor occupies */
  equipmentSlot: EquipmentSlot;

  /**
   * Damage Reduction: Flat damage reduction per hit
   * Example: Plate Armor DR = 5 means every hit is reduced by 5 damage
   * Applied BEFORE converting damage to injuries
   */
  damageReduction: number; // 1-10 typically

  /** Type of damage this armor protects against (if specialized) */
  resistantToDamageType: DamageType | 'all';

  /** AGI penalty from wearing this armor (-0 for light, -1 for medium, -2 for heavy) */
  agilityPenalty: number;

  /** STR requirement to wear this armor without penalty */
  requiredStrength: number;

  /** If STR is too low, additional penalty stacks on AGI */
  insufficientStrengthAgiPenalty: number;

  /** Armor integrity (durability) */
  durability: Durability;

  /** Any special properties (magical enchantments, etc.) */
  specialProperties: Map<string, number>;
}

/**
 * Container: Item that holds other items (backpack, chest, etc.)
 *
 * Containers increase inventory capacity but add weight.
 * Can be equipped or placed in the world.
 */
export interface Container extends Item {
  itemType: 'tool'; // Containers are classified as tools

  /** Capacity in kg */
  capacityKg: number;

  /** Currently stored items */
  containedItemIds: string[];

  /** Current weight of contents */
  currentWeight: number;

  /** Whether container is locked (requires lockpicking to access) */
  isLocked: boolean;

  /** Requirement to unlock (if locked) */
  lockDC: number | null;
}

/**
 * Consumable: One-use items (potions, food, spells scrolls)
 *
 * Consumables are destroyed when used.
 * Effects depend on type:
 * - Potions: Restore vitals or apply buffs
 * - Food: Restore Nourishment
 * - Scrolls: Cast a spell once
 */
export interface Consumable extends Item {
  itemType: 'consumable';

  /** Consumable type */
  consumableType: 'potion' | 'food' | 'scroll' | 'ingredient' | 'ammunition';

  /** Effect of using this item */
  effects: {
    attribute: string; // "vigor", "nourishment", "sanity", "health", etc.
    amount: number;    // Amount restored (positive) or damaged (negative)
  }[];

  /** Quantity available (for consumables stacked together) */
  quantity: number;

  /** Whether item stacks (multiple can occupy 1 slot) */
  isStackable: boolean;
}

/**
 * QuestItem: Non-droppable items essential to quest progression
 *
 * Quest items cannot be dropped or traded (until quest complete).
 * They count toward encumbrance even though they "don't matter" narratively.
 */
export interface QuestItem extends Item {
  itemType: 'quest';

  /** Associated quest ID */
  questId: string;

  /** Can this item be dropped early? */
  isDroppable: boolean;

  /** Can this item be traded/sold? */
  isTradeble: boolean;

  /** Quest step this item is used for */
  questStep: number;
}

/**
 * Inventory: Character's collection of items
 *
 * Inventory has total weight limit (encumbrance system).
 * Excess weight applies AGI penalty and stamina drain.
 * See InventoryManager.calculateEncumbrance() for penalty calculations.
 */
export interface Inventory {
  /** Character/Vessel ID this inventory belongs to */
  vesselId: string;

  /** Map of itemId -> Item for all carried items */
  items: Map<string, Item>;

  /** Equipment slots: which item is equipped where */
  equippedItems: {
    slot: EquipmentSlot;
    itemId: string;
  }[];

  /** Total capacity in kg (based on STR: base 20kg + STR * 5) */
  capacityKg: number;

  /** Current weight carried */
  currentWeight: number;

  /** Whether inventory is over capacity */
  isOvercumbered: boolean;

  /** AGI penalty from carrying too much weight */
  encumbranceAgiPenalty: number;

  /** Stamina drain per tick from overcumbrance */
  encumbranceStaminaDrain: number;

  /** When inventory was last modified */
  lastModifiedAtTick: number;

  /** Loot filter preferences (auto-pickup rules) */
  lootFilterPreferences: {
    autoPickup: boolean;
    minimumRarity: ItemRarity;
    excludedItemTypes: string[];
  };
}

/**
 * EncumbranceCalculation: DSS 12.4 - Weight carrying mechanics
 *
 * Capacity = 20kg base + (STR * 5kg)
 * Weight penalty if over capacity = 5% AGI penalty per 10kg over
 * Stamina drain if overcumbered = 1 stamina per tick per 5kg over
 */
export interface EncumbranceCalculation {
  /** Base capacity from STR */
  baseCapacity: number;

  /** STR-based capacity bonus */
  strCapacityBonus: number;

  /** Total capacity */
  totalCapacity: number;

  /** Current weight carried */
  currentWeight: number;

  /** Weight over capacity (0 if under) */
  weightOverCapacity: number;

  /** AGI penalty from weight (-5% per 10kg over) */
  agiPenaltyPercent: number;

  /** Stamina drain per tick from overcumbrance */
  staminaDrainPerTick: number;

  /** Whether character is overcumbered */
  isOvercumbered: boolean;

  /** Percentage of capacity used (0-100+) */
  capacityPercentUsed: number;
}

/**
 * Market Dynamics: DSS 09.2-09.3 - Price fluctuation based on supply/demand
 *
 * When large quantities of an item are sold, local prices drop.
 * Black Market prices are higher but don't affect main economy.
 */
export interface MarketFluctuation {
  /** Item ID that fluctuated */
  itemId: string;

  /** Region/faction where price changed */
  regionId: string;

  /** Original base price */
  originalPrice: number;

  /** Current adjusted price */
  currentPrice: number;

  /** Price multiplier (0.5 = 50% off, 1.5 = 150% markup) */
  priceMultiplier: number;

  /** Quantity sold that triggered this fluctuation */
  quantitySoldTrigger: number;

  /** When price recovers back to normal (tick number) */
  recoveryAtTick: number;

  /** Whether this is Black Market pricing (illegal items) */
  isBlackMarket: boolean;
}

/**
 * Encumbrance constants per DSS 12.4
 */
export const ENCUMBRANCE_CONSTANTS = {
  baseCapacity: 20,                      // Base 20kg
  strCapacityPerPoint: 5,                // +5kg per STR
  agiPenaltyPerExtraKg: 0.005,           // -0.5% per kg over
  agiPenaltyThreshold: 10,               // Penalty kicks in at 10kg over
  staminaDrainPerExtraKg: 0.002,         // -0.2 stamina per kg over per tick
  overcumbranceSpeedReduction: 0.3,      // -30% movement speed when overcumbered
} as const;

/**
 * Durability constants for different item types
 */
export const DURABILITY_CONSTANTS = {
  weaponDecayPerUse: 1.0,
  armorDecayPerHit: 0.5,
  consumableDecayPerUse: 1.0,            // Consumables destroyed completely
  repairCostPerDurabilityPoint: 0.5,     // 0.5 currency per durability point
  britloDurabilityFloor: 0.5,            // Failed crafting = 2x decay rate
} as const;

/**
 * Damage Reduction (DR) constants by armor type
 */
export const ARMOR_DR_BY_TYPE = {
  light_armor: 2,         // Leather, studded
  medium_armor: 4,        // Chain, scale
  heavy_armor: 6,         // Plate mail
  robes: 0,               // No armor bonus
  shield: 1,              // Shield adds 1 DR (stacks with armor)
} as const;

/**
 * AGI penalties by armor type
 */
export const ARMOR_AGI_PENALTY_BY_TYPE = {
  light_armor: 0,         // No penalty
  medium_armor: -1,       // -1 AGI
  heavy_armor: -2,        // -2 AGI
  robes: 0,               // No penalty
  shield: 0,              // No penalty
} as const;
