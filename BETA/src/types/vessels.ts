/**
 * Vessel System (DSS 02: Survival Mechanics & Vitals)
 * 
 * A Vessel is the physical embodiment of a character.
 * Vessels must maintain three core Vitals to survive: Vigor, Nourishment, and Sanity.
 * Vessels accumulate Injuries that persist as debuffs until healed.
 */

import { CoreAttributes } from './attributes';
import type { Skill } from './skills';

/**
 * Injury Type: Persistent damage effects
 * Different from HP damage; injuries cause attribute/speed debuffs and require medical treatment
 */
export enum InjuryType {
  LACERATION = 'laceration',      // DEX penalty (-1 to -3)
  FRACTURE = 'fracture',          // AGI/STR penalty (-1 to -3)
  SCAR = 'scar',                  // Permanent -1 attribute cap
  BLEED = 'bleed',                // Active HP drain (-1 HP/tick)
  CONTUSION = 'contusion',        // CON penalty (-1 to -2)
  DEEP_WOUND = 'deep_wound',      // Persistent WIS/CHA penalty
  POISON = 'poison',              // Per-tick Vigor drain
  CURSE = 'curse',                // Sanity drain per action
}

/**
 * Individual Injury Marker
 * Tracks a specific injury and its debuff effects
 */
export interface Injury {
  /** Unique identifier for this injury instance */
  id: string;

  /** Type of injury (laceration, fracture, etc.) */
  type: InjuryType;

  /** Severity/Rank: 1 (minor) to 5 (critical) */
  severity: number;

  /** Which attribute is primarily affected */
  affectedAttribute: keyof CoreAttributes;

  /** Penalty applied to affected attribute (negative number) */
  attributePenalty: number;

  /** When this injury occurred (tick number) */
  createdAtTick: number;

  /** How many ticks until this injury heals naturally (null = permanent) */
  ticksUntilHealed: number | null;

  /** Whether medical treatment is required (workstation: Medical) */
  requiresMedicalTreatment: boolean;

  /** Active status: ongoing effects or resolved */
  isActive: boolean;

  /** Description for UI/narrative purposes */
  description: string;
}

/**
 * The Triad of Vitals (Individual Entropy per DSS 02.1)
 * Characters must maintain these three reserves or face debilitating effects
 */
export interface VitalStats {
  /**
   * Vigor: Physical energy reserve (0-100 scale)
   * Decay: -1%/hr * CON_Modifier
   * Regeneration: Resting at High-Stability Tile (Inn/Safehouse)
   * 
   * Effects at low Vigor:
   * - 0-20: "Exhaustion" (-25% damage output)
   * - 0: Character falls asleep (uncontrollable)
   */
  vigor: number;

  /**
   * Nourishment: Biological fuel (0-100 scale)
   * Decay: -2%/hr * Biome_Modifier (desert biomes decay faster)
   * Recovery: Eating food items
   * 
   * Effects at low Nourishment:
   * - 0-30: "Hunger" (-1% HP cap, -1% Stamina cap per 10 ticks)
   * - 0: Character enters "Starvation State" (unplayable)
   */
  nourishment: number;

  /**
   * Sanity: Psychological anchor (0-100 scale)
   * Drift: f(Paradox_Debt, Horror_Index) from DSS 03
   * Recovery: Rest, meditation, social interaction
   * 
   * Effects at low Sanity:
   * - 0-30: "Anxiety" (-10% skill success, +5% failure chance)
   * - 0-20: "Fugue State" (AI Director takes control for 10 ticks)
   * - Sanity < 0: Immediately triggers Liberation Check (DSS 02)
   */
  sanity: number;
}

/**
 * Maximum/Baseline Vitals (determined by attributes + equipment)
 */
export interface MaximumVitals {
  maxVigor: number;     // Base = 50 + (CON * 2)
  maxNourishment: number; // Base = 100 (universal)
  maxSanity: number;    // Base = 50 + (WIS * 3)
}

/**
 * Vessel State: The complete physical embodiment
 */
export interface Vessel {
  /** Unique identifier for this vessel instance */
  id: string;

  /** Player ID who controls this vessel (Soul binding in DSS 03.2) */
  playerId?: string;

  /** Character name */
  name: string;

  /** Character level (1-20+) */
  level: number;

  /** Current experience points */
  experience: number;

  /** Core attributes (8-stat irreducible: STR, DEX, CON, INT, WIS, CHA, PER, AGI) */
  attributes: CoreAttributes;

  /** Current health points (0 triggers Conservation_Check per DSS 02.2) */
  healthPoints: number;

  /** Maximum health points (base + CON modifier * level) */
  maxHealthPoints: number;

  /** Current stamina (used for physical actions) */
  stamina: number;

  /** Maximum stamina (base + STR/CON modifier * level) */
  maxStamina: number;

  /** Current tri-vital reserves */
  vitals: VitalStats;

  /** Maximum capacities for vitals */
  maximumVitals: MaximumVitals;

  /** Array of all active and historical injuries */
  injuries: Injury[];

  /** Ancestry type (from DSS 01.3 Genesis Constraint) */
  ancestry: string;

  /** Talent assigned at creation (from DSS 01.3) */
  talent: string;

  /** Gender identity (affects faction multipliers in matriarchal templates) */
  gender: 'male' | 'female' | 'non-binary';

  /** Vessel creation tick (world age at creation) */
  createdAtTick: number;

  /** Is this vessel currently alive? (false triggers reincarnation) */
  isAlive: boolean;

  /** Current tier of the vessel (fragile/standard/robust) */
  vesselTier: 'fragile' | 'standard' | 'robust';

  /** Active status effects (temporary buffs/debuffs) */
  statusEffects: StatusEffect[];

  /** Skills learned by this vessel (proficiency tracking, DSS 15) */
  skills?: Skill[];

  /** Inventory items carried by this vessel */
  inventory?: any[]; // TODO: Define InventoryItem interface
}

/**
 * Status Effect: Temporary buff or debuff
 */
export interface StatusEffect {
  id: string;
  name: string;
  type: 'buff' | 'debuff';
  
  /** Which attribute(s) are affected */
  affectedAttributes?: Partial<CoreAttributes>;
  
  /** Flat attribute modifiers */
  attributeModifiers?: Partial<Record<keyof CoreAttributes, number>>;
  
  /** Vital multipliers (0.8 = -20%) */
  vitalMultipliers?: Partial<Record<keyof VitalStats, number>>;
  
  /** Ticks remaining on this effect */
  duration: number;
  
  /** Description for UI */
  description: string;
}

/**
 * Conservation Check (DSS 02.2: Death Threshold)
 * When HP reaches 0, a vessel triggers this check to determine fate
 */
export interface ConservationCheck {
  /** Actor ID performing the check */
  actorId: string;

  /** d20 roll result */
  d20Roll: number;

  /** Constitution modifier bonus */
  constitutionBonus: number;

  /** Total check value = d20 + CON */
  totalValue: number;

  /** Difficulty class (usually 10) */
  difficultyClass: number;

  /** Success = Fragile State, Failure = Vessel Destruction */
  success: boolean;

  /** Tick when check was performed */
  performedAtTick: number;
}

/**
 * Calculate maximum health based on attributes and level
 * Formula: Base HP + (CON_Mod * Level)
 */
export function calculateMaxHealthPoints(
  conAttribute: number,
  level: number,
  baseHp: number = 50
): number {
  const conMod = Math.floor((conAttribute - 10) / 2);
  return baseHp + conMod * level;
}

/**
 * Calculate maximum stamina based on attributes and level
 * Formula: Base + ((STR + CON) / 2) * 0.5 * Level
 */
export function calculateMaxStamina(
  strAttribute: number,
  conAttribute: number,
  level: number,
  baseStamina: number = 30
): number {
  const strMod = Math.floor((strAttribute - 10) / 2);
  const conMod = Math.floor((conAttribute - 10) / 2);
  return baseStamina + ((strMod + conMod) / 2) * level;
}

/**
 * Calculate maximum Vigor based on attributes
 * Formula: 50 + (CON * 2)
 */
export function calculateMaxVigor(conAttribute: number): number {
  return 50 + conAttribute * 2;
}

/**
 * Calculate maximum Sanity based on attributes
 * Formula: 50 + (WIS * 3)
 */
export function calculateMaxSanity(wisAttribute: number): number {
  return 50 + wisAttribute * 3;
}

/**
 * Create a new vessel with given attributes
 */
export function createVessel(options: {
  name: string;
  level: number;
  attributes: CoreAttributes;
  ancestry: string;
  talent: string;
  gender: 'male' | 'female' | 'non-binary';
  createdAtTick: number;
  vesselId?: string;
}): Vessel {
  const maxHp = calculateMaxHealthPoints(options.attributes.CON, options.level);
  const maxStamina = calculateMaxStamina(options.attributes.STR, options.attributes.CON, options.level);
  const maxVigor = calculateMaxVigor(options.attributes.CON);
  const maxSanity = calculateMaxSanity(options.attributes.WIS);

  return {
    id: options.vesselId || `vessel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: options.name,
    level: options.level,
    experience: 0,
    attributes: options.attributes,
    healthPoints: maxHp,
    maxHealthPoints: maxHp,
    stamina: maxStamina,
    maxStamina: maxStamina,
    vitals: {
      vigor: maxVigor,
      nourishment: 100,
      sanity: maxSanity,
    },
    maximumVitals: {
      maxVigor,
      maxNourishment: 100,
      maxSanity,
    },
    injuries: [],
    ancestry: options.ancestry,
    talent: options.talent,
    gender: options.gender,
    createdAtTick: options.createdAtTick,
    isAlive: true,
    vesselTier: 'standard',
    statusEffects: [],
  };
}

/**
 * Apply an injury to a vessel
 */
export function addInjury(vessel: Vessel, injury: Injury): void {
  vessel.injuries.push(injury);
  if (injury.attributePenalty !== 0) {
    // In a real implementation, would apply attribute penalty
    // This is tracked separately from the injury object for calculations
  }
}

/**
 * Get all active injuries
 */
export function getActiveInjuries(vessel: Vessel): Injury[] {
  return vessel.injuries.filter(inj => inj.isActive);
}

/**
 * Calculate total attribute penalties from active injuries
 */
export function calculateTotalAttributePenalties(vessel: Vessel): Partial<CoreAttributes> {
  const penalties: Partial<CoreAttributes> = {};

  for (const injury of getActiveInjuries(vessel)) {
    const attr = injury.affectedAttribute;
    penalties[attr] = (penalties[attr] ?? 0) + injury.attributePenalty;
  }

  return penalties;
}

/**
 * Heal an injury
 */
export function healInjury(vessel: Vessel, injuryId: string): void {
  const injury = vessel.injuries.find(i => i.id === injuryId);
  if (injury) {
    injury.isActive = false;
  }
}

/**
 * Perform a Conservation Check (Death Save)
 * Returns success (Fragile State) or failure (Vessel Destruction/Reincarnation)
 */
export function performConservationCheck(
  vessel: Vessel,
  difficultyClass: number = 10,
  currentTick: number,
  d20Roll?: number
): ConservationCheck {
  const roll = d20Roll ?? Math.floor(Math.random() * 20) + 1;
  const conMod = Math.floor((vessel.attributes.CON - 10) / 2);
  const total = roll + conMod;
  const success = total >= difficultyClass;

  return {
    actorId: vessel.id,
    d20Roll: roll,
    constitutionBonus: conMod,
    totalValue: total,
    difficultyClass,
    success,
    performedAtTick: currentTick,
  };
}

/**
 * Causal Lock (DSS 02.2.1 Security Patch)
 * Prevents Timeline Warp on actors who just triggered Conservation_Check
 */
export interface CausalLock {
  actorId: string;
  startedAtTick: number;
  durationTicks: number; // Typically 1 tick (1.5 seconds)
  reason: 'conservation_check' | 'temporal_danger';
}

/**
 * Check if a vessel is currently causally locked
 */
export function isCausallyLocked(vessel: Vessel, locks: CausalLock[], currentTick: number): boolean {
  return locks.some(
    lock =>
      lock.actorId === vessel.id &&
      currentTick < lock.startedAtTick + lock.durationTicks
  );
}
