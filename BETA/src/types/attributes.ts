/**
 * Attribute System (DSS 01: Growth System & Skill Architecture)
 * 
 * The 9 Core Attributes form the foundation of all physical and mental execution.
 * Each attribute has specific mechanical effects on character capabilities.
 */

/**
 * Core Attributes (8-Point System)
 * Values typically range from 3 (minimum viable) to 20+ (peak human/superhuman)
 * The 8 irreducible attributes represent all physical and mental capabilities.
 */
export interface CoreAttributes {
  /** Strength: Carry Weight, Melee DMG, Bow Draw Strength */
  STR: number;

  /** Dexterity: Precision, Critical Hit Window, Crafting Accuracy */
  DEX: number;

  /** Agility: Initiative, Combat Speed, Movement Speed */
  AGI: number;

  /** Constitution: Max HP, Disease Resistance, Vigor Decay Reduction */
  CON: number;

  /** Intelligence: Skill XP Gain, Spell Complexity Threshold, Knowledge Retention */
  INT: number;

  /** Wisdom: Failure Probability Floor, Intuition, Sanity Stability, Tie-Breaker for unmapped actions */
  WIS: number;

  /** Charisma: Dialogue DC Multipliers, Faction ActionBudget Contribution */
  CHA: number;

  /** Perception: Range Window, Hidden Resource/Hazard Discovery, Paradox Mitigation on Fumbles */
  PER: number;
}

/**
 * Attribute Modifiers
 * Derived from CoreAttributes, used for mechanical calculations
 */
export interface AttributeModifiers {
  /** 
   * STR Modifier: Affects carry weight capacity and melee damage
   * Formula: floor((STR - 10) / 2)
   */
  str_mod: number;

  /** 
   * DEX Modifier: Affects AC, initiative, ranged accuracy
   * Formula: floor((DEX - 10) / 2)
   */
  dex_mod: number;

  /** 
   * AGI Modifier: Affects combat speed and initiative priority
   * Formula: floor((AGI - 10) / 2)
   * Initiative = d20 + agi_mod + AGI/10
   */
  agi_mod: number;

  /** 
   * CON Modifier: Affects max HP and disease resistance
   * Formula: floor((CON - 10) / 2)
   * Max HP = base_hp + (con_mod * character_level)
   * Vigor Decay = -1%/hr * (1 - CON_MOD * 0.1%)
   */
  con_mod: number;

  /**
   * INT Modifier: Affects skill XP gain multiplier
   * Formula: 1 + (INT / 20)
   * XP Multiplier = 1 + (INT / 20) for skill usage
   * Soft Cap = Current_Level + ((INT + WIS) / 2)
   */
  int_multiplier: number;

  /**
   * WIS Modifier: Affects failure probability floor for skill checks
   * Formula: 1 + (WIS / 25)
   * Failure Floor = max(0, 1 - (WIS / 25)) for d20 checks
   * Sanity Stability bonus = WIS / 10
   */
  wis_multiplier: number;

  /**
   * CHA Modifier: Affects dialogue DC and faction budget contribution
   * Formula: (CHA - 10) / 2
   * Faction Budget += cha_mod * faction_contribution_base
   * Dialogue DC = opposing_dc - cha_mod
   */
  cha_mod: number;

  /**
   * PER Modifier: Affects perception range, discovery chances, and fumble mitigation
   * Formula: (PER - 10) / 2
   * Vision Range += per_mod * 5 meters
   * Hidden Discovery Chance += per_mod * 5%
   * Paradox Debt Reduction on Natural 1 = per_mod (represents seeing the glitch coming)
   */
  per_mod: number;
}

/**
 * Attribute Bounds (Validation constants)
 */
export const ATTRIBUTE_BOUNDS = {
  minimum: 3,      // Minimum viable attribute score
  average: 10,     // Human baseline
  maximum: 20,     // Peak human level
  superhuman: 25,  // Superhuman level (rare)
} as const;

/**
 * Calculate attribute modifiers from core attributes
 * @param attributes CoreAttributes object
 * @returns AttributeModifiers with all derived values
 */
export function calculateAttributeModifiers(
  attributes: CoreAttributes
): AttributeModifiers {
  return {
    str_mod: Math.floor((attributes.STR - 10) / 2),
    dex_mod: Math.floor((attributes.DEX - 10) / 2),
    agi_mod: Math.floor((attributes.AGI - 10) / 2),
    con_mod: Math.floor((attributes.CON - 10) / 2),
    int_multiplier: 1 + attributes.INT / 20,
    wis_multiplier: 1 + attributes.WIS / 25,
    cha_mod: Math.floor((attributes.CHA - 10) / 2),
    per_mod: Math.floor((attributes.PER - 10) / 2),
  };
}

/**
 * Learning Curve Calculation (DSS 01.2: Skill Progression)
 * 
 * The "Soft Cap" determines when XP requirements start doubling.
 * Controlled by INT and WIS to encourage specialized learning vs broad generalism.
 */
export interface LearningCurveConfig {
  /** Base XP required per skill level */
  baseXpPerLevel: number;

  /** INT/WIS learning soft cap formula */
  calculateSoftCap(int: number, wis: number): number;

  /** XP multiplier for INT-based learning */
  calculateIntMultiplier(int: number): number;

  /** XP multiplier for WIS-based learning/retention */
  calculateWisMultiplier(wis: number): number;

  /** XP penalty for failures (typically 25% of success XP) */
  failureXpMultiplier: number;

  /** Curve multiplier when level exceeds soft cap */
  softCapExceedanceDoubler: number;
}

/**
 * Default learning curve configuration per DSS 01.2
 */
export const DEFAULT_LEARNING_CURVE: LearningCurveConfig = {
  baseXpPerLevel: 1000,
  
  calculateSoftCap(int: number, wis: number): number {
    // Current_Level + ((INT + WIS) / 2)
    // This is typically called with current_level added externally
    return (int + wis) / 2;
  },

  calculateIntMultiplier(int: number): number {
    // 1 + (INT / 20) = XP gained per usage
    return 1 + int / 20;
  },

  calculateWisMultiplier(wis: number): number {
    // 1 + (WIS / 25) = knowledge retention factor
    // Affects how much learned knowledge persists
    return 1 + wis / 25;
  },

  failureXpMultiplier: 0.25, // Failed attempts grant 0.25x XP
  softCapExceedanceDoubler: 2.0, // XP required doubles every 5 levels beyond soft cap
};

/**
 * Calculate total XP required for a skill level
 * Taking into account INT/WIS soft caps
 * 
 * @param skillLevel Current skill level (0 = untrained)
 * @param currentCharacterLevel Character level for soft cap
 * @param attributes Character's core attributes
 * @param config Learning curve configuration
 * @returns XP required to reach next level
 */
export function calculateSkillXpRequired(
  skillLevel: number,
  currentCharacterLevel: number,
  attributes: CoreAttributes,
  config: LearningCurveConfig = DEFAULT_LEARNING_CURVE
): number {
  const softCap = currentCharacterLevel + config.calculateSoftCap(attributes.INT, attributes.WIS);
  
  if (skillLevel <= softCap) {
    // Below soft cap: standard progression
    return Math.floor(config.baseXpPerLevel * (skillLevel + 1));
  } else {
    // Beyond soft cap: exponential scaling every 5 levels
    const levelsAboveSoftCap = skillLevel - softCap;
    const doublingCycles = Math.floor(levelsAboveSoftCap / 5);
    const baseForLevel = Math.floor(config.baseXpPerLevel * (softCap + 1));
    return baseForLevel * Math.pow(config.softCapExceedanceDoubler, doublingCycles);
  }
}

/**
 * Validate attribute scores within game constraints
 * @param attributes Attributes to validate
 * @throws Error if any attribute is outside valid bounds
 */
export function validateAttributes(attributes: CoreAttributes): void {
  const attributeEntries = Object.entries(attributes) as Array<[keyof CoreAttributes, number]>;
  
  for (const [name, value] of attributeEntries) {
    if (value < ATTRIBUTE_BOUNDS.minimum) {
      throw new Error(`${name} (${value}) cannot be below minimum of ${ATTRIBUTE_BOUNDS.minimum}`);
    }
    // No hard maximum enforced; superhuman stats are possible
    if (!Number.isInteger(value)) {
      throw new Error(`${name} must be an integer, got ${value}`);
    }
  }
}

/**
 * Create a default attribute array for a starting character
 * Used during character creation (DSS 01.4: Character Creation)
 */
export function createDefaultAttributes(template: 'balanced' | 'strength' | 'agility' | 'intellect'): CoreAttributes {
  const base: CoreAttributes = {
    STR: 10,
    DEX: 10,
    AGI: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
    PER: 10,
  };

  switch (template) {
    case 'strength':
      base.STR = 14;
      base.CON = 12;
      base.INT = 8;
      break;
    case 'agility':
      base.AGI = 14;
      base.DEX = 13;
      base.WIS = 11;
      break;
    case 'intellect':
      base.INT = 14;
      base.WIS = 12;
      base.STR = 8;
      break;
    case 'balanced':
    default:
      // All 10s (standard human)
      break;
  }

  validateAttributes(base);
  return base;
}
