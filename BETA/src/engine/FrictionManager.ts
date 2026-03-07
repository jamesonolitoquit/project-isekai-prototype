/**
 * Friction Manager Engine (Phase 2 Core)
 * 
 * Manages "realism friction" - the mechanical overhead that prevents power-gaming
 * and enforces simulation constraints.
 * 
 * Key Systems:
 * 1. Vitals Decay: Vigor, Nourishment, Sanity degrade per tick
 * 2. Information Lag: Perception (PER/WIS) determines what exact data player sees
 * 3. Perceived State: Generate vague or exact descriptors for UI
 * 4. Injury Visibility: When player becomes aware of injuries/conditions
 */

import type { Vessel, VitalStats, MaximumVitals, Injury, CoreAttributes } from '../types';

/**
 * Perceived Health State: What the player sees instead of exact HP
 */
export enum HealthDescriptor {
  PERFECT = 'Perfect health',
  MINOR_WOUNDS = 'Minor scratches and bruises',
  MANAGEABLE = 'Manageable wounds',
  SIGNIFICANT = 'Significant injuries',
  CRITICAL = 'Critical condition',
  DYING = 'On death\'s door',
  DEAD = 'Vessel destroyed',
}

/**
 * Perceived Vital State: Vague vs exact based on PER/WIS
 */
export enum VitalDescriptor {
  VIBRANT = 'Vibrant',
  NORMAL = 'Normal',
  WEAKENED = 'Weakened',
  DEPLETED = 'Depleted',
  CRITICAL = 'Critical',
}

/**
 * Information Lag Result: What exact data to show player
 */
export interface PerceivedVesselState {
  /** Whether exact HP is visible (high PER/WIS) or vague (low PER/WIS) */
  hasExactHealth: boolean;
  healthDescriptor: HealthDescriptor;
  healthPercent?: number; // Only if hasExactHealth

  /** Vigor perception */
  hasExactVigor: boolean;
  vigorDescriptor: VitalDescriptor;
  vigorPercent?: number;

  /** Nourishment perception */
  hasExactNourishment: boolean;
  nourishmentDescriptor: VitalDescriptor;
  nourishmentPercent?: number;

  /** Sanity perception */
  hasExactSanity: boolean;
  sanityDescriptor: VitalDescriptor;
  sanityPercent?: number;

  /** Active injuries (visible if character has high PER/WIS or explicitly examined) */
  visibleInjuries: Injury[];
  hasExamined: boolean; // Did player take a "Self-Examine" action?
}

/**
 * Vital Decay Rates (DSS 02.1)
 * Per 1.5-second tick
 */
export const VITAL_DECAY_RATES = {
  /** Vigor: -1%/hr * CON_Modifier */
  vigorPercentPerHour: 1,

  /** Nourishment: -2%/hr * Biome_Modifier */
  nourishmentPercentPerHour: 2,

  /** Sanity: Affected by Paradox Debt and Horror Index (varies) */
  sanityBasePerHour: 0.5,

  /** Ticks per hour (60 * 60 / 1.5) */
  ticksPerHour: 2400,
};

/**
 * Calculate decay per single tick
 */
function calculateTickDecay(percentPerHour: number): number {
  return percentPerHour / VITAL_DECAY_RATES.ticksPerHour;
}

/**
 * CON Modifier for Vigor decay
 * Higher CON = slower decay
 * Formula: 1 - (CON_MOD * 0.1%)
 */
function getConstitutionVigorModifier(conAttribute: number): number {
  const conMod = Math.floor((conAttribute - 10) / 2);
  return Math.max(0.1, 1 - conMod * 0.001); // Min 10% decay, even with huge CON
}

/**
 * Friction Manager: Handles vitals decay and information perception
 */
export class FrictionManager {
  /**
   * Apply vitals decay to a vessel for one tick
   * (DSS 02.1: Triad of Vitals)
   * 
   * @param vessel Vessel to apply decay to
   * @param biomeModifier Affects Nourishment decay (desert = 1.5x, forest = 0.8x, etc.)
   * @param sanityModifier Additional modifier based on Paradox Debt, Horror Index, etc.
   */
  static applyVitalsDecay(
    vessel: Vessel,
    biomeModifier: number = 1.0,
    sanityModifier: number = 1.0
  ): void {
    const vitals = vessel.vitals;
    const maxVitals = vessel.maximumVitals;

    // Vigor Decay: -1%/hr * CON_Modifier
    const vigorDecayRate = calculateTickDecay(VITAL_DECAY_RATES.vigorPercentPerHour);
    const conMod = getConstitutionVigorModifier(vessel.attributes.CON);
    vitals.vigor = Math.max(
      0,
      vitals.vigor - vigorDecayRate * conMod * maxVitals.maxVigor
    );

    // Nourishment Decay: -2%/hr * Biome_Modifier
    const nourishmentDecayRate = calculateTickDecay(VITAL_DECAY_RATES.nourishmentPercentPerHour);
    vitals.nourishment = Math.max(
      0,
      vitals.nourishment - nourishmentDecayRate * biomeModifier * maxVitals.maxNourishment
    );

    // Sanity Decay: Affected by Paradox Debt + Horror Index
    // Base: -0.5%/hr, modified by external factors
    const sanityDecayRate = calculateTickDecay(VITAL_DECAY_RATES.sanityBasePerHour);
    vitals.sanity = Math.max(
      0,
      vitals.sanity - sanityDecayRate * sanityModifier * maxVitals.maxSanity
    );

    // Starvation Effect: If Nourishment < 30%, reduce HP/Stamina cap
    if (vitals.nourishment < maxVitals.maxNourishment * 0.3) {
      const hungerPercent = vitals.nourishment / (maxVitals.maxNourishment * 0.3);
      const hpCap = vessel.maxHealthPoints * hungerPercent;
      if (vessel.healthPoints > hpCap) {
        vessel.healthPoints = hpCap;
      }
    }

    // Exhaustion Effect: If Vigor < 20%, reduce damage output
    // (This is status effect territory, would be handled by status effect system)

    // Anxiety Effect: If Sanity < 30%, reduce skill success
    // (Also status effect territory)
  }

  /**
   * Get the Information Lag Multiplier for a vessel
   * Lower value = more information visible
   * Higher value = more obscured
   * 
   * Formula: 1 - ((PER + WIS) / 40) clamped to [0, 1]
   * 
   * @param vessel Vessel to calculate lag for
   * @returns Number 0-1 representing lag intensity
   */
  static getInformationLagMultiplier(vessel: Vessel): number {
    const perceptionAverage = (vessel.attributes.PER + vessel.attributes.WIS) / 2;
    const lagMultiplier = 1 - perceptionAverage / 20; // Normalize against average attribute (10)
    return Math.max(0, Math.min(1, lagMultiplier));
  }

  /**
   * Generate perceived vessel state for UI display
   * This respects player knowledge and information lag
   * 
   * @param vessel Vessel to get state for
   * @param hasExamined Whether player took a "Self-Examine" action this tick
   * @returns PerceivedVesselState with visibility rules applied
   */
  static getPerceivedVesselState(
    vessel: Vessel,
    hasExamined: boolean = false
  ): PerceivedVesselState {
    const lagMultiplier = this.getInformationLagMultiplier(vessel);

    // Determine visibility thresholds
    const exactThreshold = 0.3; // If lag < 30%, show exact values
    const examinedThreshold = 0.7; // If lag < 70% OR examined, show injuries

    const hasExactData = lagMultiplier < exactThreshold;
    const canSeeInjuries = hasExamined || lagMultiplier < examinedThreshold;

    const hpPercent = (vessel.healthPoints / vessel.maxHealthPoints) * 100;
    const vigorPercent = (vessel.vitals.vigor / vessel.maximumVitals.maxVigor) * 100;
    const nourPercent = (vessel.vitals.nourishment / vessel.maximumVitals.maxNourishment) * 100;
    const sanityPercent = (vessel.vitals.sanity / vessel.maximumVitals.maxSanity) * 100;

    return {
      hasExactHealth: hasExactData,
      healthDescriptor: this.getHealthDescriptor(hpPercent),
      healthPercent: hasExactData ? hpPercent : undefined,

      hasExactVigor: hasExactData,
      vigorDescriptor: this.getVitalDescriptor(vigorPercent),
      vigorPercent: hasExactData ? vigorPercent : undefined,

      hasExactNourishment: hasExactData,
      nourishmentDescriptor: this.getVitalDescriptor(nourPercent),
      nourishmentPercent: hasExactData ? nourPercent : undefined,

      hasExactSanity: hasExactData,
      sanityDescriptor: this.getVitalDescriptor(sanityPercent),
      sanityPercent: hasExactData ? sanityPercent : undefined,

      visibleInjuries: canSeeInjuries ? vessel.injuries.filter(inj => inj.isActive) : [],
      hasExamined,
    };
  }

  /**
   * Convert HP percentage to descriptor
   */
  static getHealthDescriptor(hpPercent: number): HealthDescriptor {
    if (hpPercent <= 0) return HealthDescriptor.DEAD;
    if (hpPercent < 10) return HealthDescriptor.DYING;
    if (hpPercent < 25) return HealthDescriptor.CRITICAL;
    if (hpPercent < 50) return HealthDescriptor.SIGNIFICANT;
    if (hpPercent < 75) return HealthDescriptor.MANAGEABLE;
    if (hpPercent < 90) return HealthDescriptor.MINOR_WOUNDS;
    return HealthDescriptor.PERFECT;
  }

  /**
   * Convert vital percentage to descriptor
   */
  static getVitalDescriptor(percent: number): VitalDescriptor {
    if (percent <= 0) return VitalDescriptor.CRITICAL;
    if (percent < 20) return VitalDescriptor.CRITICAL;
    if (percent < 40) return VitalDescriptor.DEPLETED;
    if (percent < 60) return VitalDescriptor.WEAKENED;
    if (percent < 85) return VitalDescriptor.NORMAL;
    return VitalDescriptor.VIBRANT;
  }

  /**
   * Apply information lag penalties to d20 rolls
   * 
   * If player's perception is poor, they make worse decisions due to incomplete info
   * This manifests as a penalty to skill checks
   * 
   * @param vessel Actor making the roll
   * @param baseRoll Base d20 result
   * @returns Modified roll based on lag multiplier
   */
  static applyInformationLagToRoll(vessel: Vessel, baseRoll: number): number {
    const lag = this.getInformationLagMultiplier(vessel);
    const penalty = Math.floor(lag * 5); // Up to -5 penalty
    return Math.max(1, baseRoll - penalty);
  }

  /**
   * Determine if an action should be interrupted by an event
   * Used for Batch Ticking (Study Mode) - player is vulnerable during time skip
   * 
   * @param vessel Character studying
   * @param interruptChance Base chance to be interrupted (0-1)
   * @returns true if action should be interrupted
   */
  static shouldInterruptBatchTick(
    vessel: Vessel,
    interruptChance: number,
    perceptionBonus: number = 0
  ): boolean {
    // Higher PER/WIS = higher chance to notice ambush
    const perceptionMultiplier = 1 + (perceptionBonus * 0.1);
    const adjustedChance = interruptChance * perceptionMultiplier;
    return Math.random() < adjustedChance;
  }

  /**
   * Check if an injury is "invisible" due to information lag
   * 
   * @param injury Injury to check visibility of
   * @param lagMultiplier Information lag (0-1)
   * @returns true if injury should not be reported to player
   */
  static isInjuryHidden(injury: Injury, lagMultiplier: number): boolean {
    // Minor injuries (severity 1-2) are hidden if lag > 0.5
    if (injury.severity <= 2 && lagMultiplier > 0.5) {
      return true;
    }

    // Moderate injuries (severity 3) are hidden if lag > 0.7
    if (injury.severity === 3 && lagMultiplier > 0.7) {
      return true;
    }

    // Severe injuries (severity 4+) are always visible
    return false;
  }

  /**
   * Generate a "fog of war" map for player perception
   * Locations within PER range are visible, outside are obscured
   * 
   * @param vessel Observer
   * @param allLocations All locations in world
   * @returns Map of location ID -> visibility percent
   */
  static getPerceptionMap(
    vessel: Vessel,
    allLocations: Array<{ id: string; distance: number }>
  ): Map<string, number> {
    const perceptionRange = vessel.attributes.PER * 5; // Base 50m per PER point
    const perceptMap = new Map<string, number>();

    for (const location of allLocations) {
      if (location.distance <= perceptionRange) {
        // Fully visible
        perceptMap.set(location.id, 1.0);
      } else if (location.distance <= perceptionRange * 1.5) {
        // Fuzzy visibility
        const visibility = 1 - (location.distance - perceptionRange) / (perceptionRange * 0.5);
        perceptMap.set(location.id, Math.max(0, visibility));
      } else {
        // Out of range
        perceptMap.set(location.id, 0);
      }
    }

    return perceptMap;
  }

  /**
   * Validate vital state constraints
   */
  static validateVitals(vessel: Vessel): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (vessel.vitals.vigor < 0 || vessel.vitals.vigor > vessel.maximumVitals.maxVigor) {
      errors.push(`Vigor out of bounds: ${vessel.vitals.vigor}`);
    }

    if (
      vessel.vitals.nourishment < 0 ||
      vessel.vitals.nourishment > vessel.maximumVitals.maxNourishment
    ) {
      errors.push(`Nourishment out of bounds: ${vessel.vitals.nourishment}`);
    }

    if (vessel.vitals.sanity < 0 || vessel.vitals.sanity > vessel.maximumVitals.maxSanity) {
      errors.push(`Sanity out of bounds: ${vessel.vitals.sanity}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Enum for biome modifiers (affects Nourishment decay)
 */
export const BIOME_MODIFIERS = {
  grassland: 1.0, // Normal decay
  forest: 0.8,    // Easier to find food
  desert: 1.5,    // Harder to find food
  mountain: 1.2,  // Slightly harder
  cave: 1.3,      // Underground, limited resources
  city: 0.6,      // Abundant food
  ocean: 1.8,     // Extreme scarcity
} as const;

/**
 * Export for external use
 */
export function createFrictionManager(): typeof FrictionManager {
  return FrictionManager;
}
