/**
 * Combat Resolver Engine (Phase 4 - DSS 08)
 *
 * Manages real-time combat resolution including initiative, contested attacks,
 * damage calculation, and injury generation.
 * Integrates with:
 * - DSS 08: Atomic Pulse, contested rolls, damage-to-injury mapping
 * - FrictionManager: Information Lag penalties on attack rolls
 * - ParadoxCalculator: Spell misfire tracking
 * - Vessels: Injury application and tracking
 *
 * Core Concept: Combat uses contested d20 rolls rather than static AC.
 * Information Lag from FrictionManager applies penalties.
 * Damage is converted into persistent Injury markers.
 */

import type { AttackResult, Initiative, CombatAction, CombatRound } from '../types';
import type { Weapon, Armor } from '../types';
import type { Vessel, Injury, InjuryType } from '../types';
import type { CoreAttributes } from '../types';
import { InjuryType as InjuryTypeEnum } from '../types';
import { calculateAttributeModifiers } from '../types';
import { COMBAT_ROLL_MODIFIERS } from '../types';

/**
 * Initiative Result: Calculated initiative order
 */
export interface InitiativeResult {
  actorId: string;
  agilityScore: number;
  agilityModifier: number;
  diceRoll: number;
  totalInitiative: number;
}

/**
 * Contested Roll Result: Attacker vs Defender outcome
 */
export interface ContestedRollResult {
  attackerRoll: number;
  defenderRoll: number;
  isHit: boolean;
  isCriticalHit: boolean;
  rollMargin: number; // Positive = attacker wins by X
}

/**
 * Combat Resolver: Manages all combat calculations
 */
export class CombatResolver {
  /**
   * Calculate initiative for an actor
   *
   * Formula: d20 + floor((AGI - 10) / 2) + (AGI / 10)
   *
   * Example:
   * - AGI 14: mod = +2, bonus = +1.4 (floor 1), roll 15 = 14 + 2 + 1 = 17 initiative
   * - AGI 10: mod = 0, bonus = 0, roll 12 = 12 initiative
   * - AGI 8: mod = -1, bonus = -0, roll 18 = 17 initiative
   *
   * @param vessel Character calculating initiative for
   * @param diceRoll Optional d20 roll (for testing)
   * @returns InitiativeResult with total initiative score
   */
  calculateInitiative(vessel: Vessel, diceRoll?: number): InitiativeResult {
    const roll = diceRoll ?? Math.floor(Math.random() * 20) + 1;

    const modifiers = calculateAttributeModifiers(vessel.attributes);
    const agiBonus = Math.floor(vessel.attributes.AGI / 10);

    const totalInitiative = roll + modifiers.agi_mod + agiBonus;

    return {
      actorId: vessel.id,
      agilityScore: vessel.attributes.AGI,
      agilityModifier: modifiers.agi_mod,
      diceRoll: roll,
      totalInitiative,
    };
  }

  /**
   * Resolve a contested attack roll
   *
   * Attacker Roll: d20 + (DEX or STR mod) + Skill Bonus - Information Lag Penalty
   * Defender Roll: d20 + AGI mod + Stance Bonus
   *
   * Hit if: Attacker Roll > Defender Roll
   * Critical if: Natural 20 OR Attacker Roll > Defender Roll by 10+
   *
   * Information Lag Penalty:
   * - From FrictionManager (typically 0.0 to 0.9 as multiplier, -5 to +0 to attack roll)
   * - Represents difficulty seeing exact target position
   *
   * @param attacker Attacking character
   * @param defender Defending character
   * @param weapon Weapon being used (for DEX/STR scaling)
   * @param informationLagPenalty Penalty from FrictionManager (0 to -5)
   * @param attackerDiceRoll Optional d20 roll
   * @param defenderDiceRoll Optional d20 roll for defender
   * @returns ContestedRollResult with hit determination
   */
  resolveContestedAttack(
    attacker: Vessel,
    defender: Vessel,
    weapon: Weapon | null,
    informationLagPenalty: number = 0, // 0 = no penalty, -5 = worst penalty
    attackerDiceRoll?: number,
    defenderDiceRoll?: number
  ): ContestedRollResult {
    const attackModifiers = calculateAttributeModifiers(attacker.attributes);
    const defendModifiers = calculateAttributeModifiers(defender.attributes);

    // Attacker roll
    const atkRoll = attackerDiceRoll ?? Math.floor(Math.random() * 20) + 1;
    let atkMod = 0;

    if (weapon) {
      // Use weapon's primary damage stat
      if (weapon.damageStat === 'STR') {
        atkMod = attackModifiers.str_mod;
      } else if (weapon.damageStat === 'DEX') {
        atkMod = attackModifiers.dex_mod;
      } else if (weapon.damageStat === 'INT') {
        atkMod = attackModifiers.int_multiplier - 1; // Convert multiplier to modifier
      }
    } else {
      // Unarmed: use DEX
      atkMod = attackModifiers.dex_mod;
    }

    // Skill bonus from weapon skill (if weapon provided)
    const skillBonus = weapon ? weapon.skillProficiencyBonus : 0;

    // Attacker total (with Information Lag penalty)
    const attackerTotal =
      atkRoll + atkMod + skillBonus + informationLagPenalty;

    // Defender roll
    const defRoll = defenderDiceRoll ?? Math.floor(Math.random() * 20) + 1;
    const defMod = defendModifiers.agi_mod;
    const stanceBonus = 0; // Could be -3 (aggressive), 0 (balanced), +3 (defensive)

    // Defender total
    const defenderTotal = defRoll + defMod + stanceBonus;

    // Determine hit
    const isHit = attackerTotal > defenderTotal;
    const rollMargin = attackerTotal - defenderTotal;

    // Determine critical hit (natural 20 or margin > 10)
    const isCriticalHit =
      isHit && (atkRoll === 20 || rollMargin >= 10);

    return {
      attackerRoll: attackerTotal,
      defenderRoll: defenderTotal,
      isHit,
      isCriticalHit,
      rollMargin,
    };
  }

  /**
   * Apply damage and convert to injuries
   *
   * Damage Flow:
   * 1. Armor DR reduces incoming damage (flat reduction)
   * 2. Remaining damage goes to HP
   * 3. Excess damage (over remaining HP) converts to injuries
   *
   * Injury Mapping:
   * - Slashing: Laceration (DEX penalty)
   * - Piercing: Laceration (DEX penalty, deeper than slashing)
   * - Bludgeoning: Fracture (AGI/STR penalty)
   * - Fire/Cold/Lightning: Internal damage (CON penalty)
   * - Poison: Persistent DOT (Bleed)
   * - Psychic: Sanity damage + WIS penalty
   *
   * Injury Severity Formula:
   * - Severity = floor(DamageAfterArmor / 10) (1 per 10 damage)
   * - Capped at severity 5 (critical)
   *
   * @param vessel Vessel taking damage
   * @param baseDamage Raw damage value before modifiers
   * @param damageType Type of damage (slashing, piercing, etc.)
   * @param armorDR Armor damage reduction (from Armor.damageReduction)
   * @param isCritical Whether this is a critical hit (2x injury severity)
   * @returns { healthPointsDamage, armorReduction, injuriesGenerated }
   */
  applyDamageAndInjuries(
    vessel: Vessel,
    baseDamage: number,
    damageType: 'slashing' | 'piercing' | 'bludgeoning' | 'fire' | 'cold' | 'poison' | 'psychic',
    armorDR: number = 0,
    isCritical: boolean = false
  ): {
    healthPointsDamage: number;
    armorReduction: number;
    injuriesGenerated: { type: InjuryType; severity: number }[];
  } {
    // Apply armor DR
    const armorReduction = Math.min(armorDR, baseDamage);
    const damageAfterArmor = baseDamage - armorReduction;

    // Calculate HP damage
    const hpDamage = Math.min(damageAfterArmor, vessel.healthPoints);

    // Calculate injury severity (1 per 10 damage, capped at 5)
    let baseSeverity = Math.floor(damageAfterArmor / 10);
    if (isCritical) {
      baseSeverity = Math.min(5, baseSeverity * 2); // Double severity on crit
    }
    const severity = Math.min(5, Math.max(1, baseSeverity));

    // Determine injury type based on damage type
    const injuries: { type: InjuryType; severity: number }[] = [];

    switch (damageType) {
      case 'slashing':
      case 'piercing':
        // Laceration: affects DEX
        injuries.push({
          type: InjuryTypeEnum.LACERATION,
          severity: Math.min(severity, 3), // Lacerations typically 1-3
        });
        break;

      case 'bludgeoning':
        // Fracture: affects AGI/STR
        injuries.push({
          type: InjuryTypeEnum.FRACTURE,
          severity: Math.min(severity, 3), // Fractures typically 1-3
        });
        break;

      case 'fire':
      case 'cold':
      case 'poison':
        // Elemental: persistent damage (Bleed/Burn)
        injuries.push({
          type: InjuryTypeEnum.BLEED,
          severity: Math.min(severity, 3),
        });
        break;

      case 'psychic':
        // Psychic: sanity damage + WIS penalty
        // Would also trigger sanity damage separately
        injuries.push({
          type: InjuryTypeEnum.DEEP_WOUND,
          severity: Math.min(severity, 2),
        });
        break;
    }

    return {
      healthPointsDamage: hpDamage,
      armorReduction,
      injuriesGenerated: injuries,
    };
  }

  /**
   * Calculate critical damage multiplier
   *
   * Base critical: 1.5x damage
   * Massive success (margin > 15): 2.0x damage
   *
   * @param rollMargin Attacker roll - Defender roll
   * @returns Damage multiplier (1.5-2.0)
   */
  calculateCriticalMultiplier(rollMargin: number): number {
    if (rollMargin >= 15) return 2.0;
    return 1.5;
  }

  /**
   * Get injury type from damage type
   * Helper for mapping damage to injuries
   *
   * @param damageType Type of damage
   * @param isCritical If critical, may affect injury selection
   * @returns Primary injury type
   */
  getInjuryTypeForDamage(
    damageType: string,
    isCritical: boolean = false
  ): InjuryType {
    const mapping: Record<string, InjuryType> = {
      slashing: InjuryTypeEnum.LACERATION,
      piercing: InjuryTypeEnum.LACERATION,
      bludgeoning: InjuryTypeEnum.FRACTURE,
      fire: InjuryTypeEnum.BLEED,
      cold: InjuryTypeEnum.BLEED,
      lightning: InjuryTypeEnum.BLEED,
      poison: InjuryTypeEnum.POISON,
      psychic: InjuryTypeEnum.DEEP_WOUND,
    };

    return mapping[damageType] || InjuryTypeEnum.CONTUSION;
  }

  /**
   * Roll attack damage
   *
   * Damage = Weapon Base Damage + Attribute Scaling + Bonuses
   * Attribute Scaling: (STR/DEX/INT mod) * Weapon.damageScaling
   *
   * @param weapon Weapon being used
   * @param attacker Attacking character
   * @param isCritical If true, multiply by critical multiplier
   * @returns Total damage
   */
  rollAttackDamage(
    weapon: Weapon,
    attacker: Vessel,
    isCritical: boolean = false
  ): number {
    const modifiers = calculateAttributeModifiers(attacker.attributes);

    // Base damage
    let damage = weapon.baseDamage;

    // Attribute scaling bonus
    let attrBonus = 0;
    if (weapon.damageStat === 'STR') {
      attrBonus = modifiers.str_mod * weapon.damageScaling;
    } else if (weapon.damageStat === 'DEX') {
      attrBonus = modifiers.dex_mod * weapon.damageScaling;
    } else if (weapon.damageStat === 'INT') {
      attrBonus = ((modifiers.int_multiplier - 1) * 5) * weapon.damageScaling; // INT multiplier to bonus
    }

    damage += attrBonus;

    // Apply critical multiplier
    if (isCritical) {
      damage *= 1.5; // Standard 1.5x critical
    }

    return Math.floor(damage);
  }
}

/**
 * Default combat resolver instance
 */
export const defaultCombatResolver = new CombatResolver();
