/**
 * Combat System Schemas (Phase 4 - DSS 08)
 *
 * Implements real-time combat mechanics including initiative, contested rolls,
 * damage resolution, and injury generation.
 * Integrates with:
 * - DSS 08: Combat time (Atomic Pulse), contested resolution, damage-to-injury mapping
 * - DSS 08.2: Hit & avoidance calculus with Information Lag penalties
 * - DSS 08.3: Armor as damage filter with Hardness (DR) and Integrity
 * - DSS 08.4: Magic spells with mana saturation and misfire mechanics
 * - DSS 08.5: Environmental interaction and pacifism mechanics
 *
 * Core Concept: Combat uses contested rolls (Attacker vs Defender d20 rolls)
 * rather than static AC. Information Lag from FrictionManager applies penalties.
 * Damage is converted into persistent Injury markers.
 */

import { CoreAttributes, AttributeModifiers } from './attributes';
import { InjuryType } from './vessels';

/**
 * Initiative: DSS 08.1 - Atomic Pulse action ordering
 *
 * Initiative determines the order within a combat round.
 * Formula: d20 + AGI_MOD + (AGI / 10)
 *
 * Action Slots per character per pulse:
 * - 1 Major Action (Strike, Cast, Move)
 * - 1 Minor Action (Draw weapon, Use consumable, Interact)
 */
export interface Initiative {
  /** Unique initiative entry ID */
  id: string;

  /** Actor ID (vessel, NPC, etc.) */
  actorId: string;

  /** Base AGI for calculating initiative order */
  agilityBase: number;

  /** AGI modifier from attributes */
  agilityModifier: number;

  /** d20 roll result (1-20) */
  diceRoll: number;

  /** Total initiative score: d20 + agi_mod + (AGI/10) */
  totalInitiative: number;

  /** Initiative rank in combat (1 = first, higher number = later) */
  initiativeRank: number;

  /** Whether this actor has already acted this pulse */
  hasActed: boolean;

  /** Major actions available this pulse (typically 1) */
  majorActionsRemaining: number;

  /** Minor actions available this pulse (typically 1) */
  minorActionsRemaining: number;

  /** Whether this actor is still in initiative (false if unconscious, dead, etc.) */
  isActive: boolean;
}

/**
 * Combat Stance: DSS 08.2 - Active defense mode
 *
 * Determines how a character defends against attacks.
 * - AGGRESSIVE: High damage output, low defense (-3 AC)
 * - BALANCED: Standard defense
 * - DEFENSIVE: Reduced damage, high defense (+3 AC)
 * - DODGE: Full agility-based dodging (DEX/AGI focused)
 * - SHIELD: Armor-based protection (requires shield)
 */
export type CombatStance = 'aggressive' | 'balanced' | 'defensive' | 'dodge' | 'shield';

/**
 * Defense Stance: Active reaction to incoming attacks
 *
 * The defender can choose how to react when attacked:
 * - PARRY: Use weapon to deflect (requires weapon proficiency)
 * - DODGE: Roll away (requires AGI check)
 * - GUARD: Brace and take damage (reduces DR effectiveness)
 * - BLOCK: Use shield (if available)
 */
export type DefenseReaction = 'parry' | 'dodge' | 'guard' | 'block';

/**
 * Attack Result: DSS 08.2-08.3 - Outcome of a single attack
 *
 * Combines to-hit roll, defense roll, damage calculation, and injury generation.
 * Contested roll system:
 * - Attacker Roll: d20 + DEX/STR (weapon dependent) + Skill_Proficiency
 * - Defender Roll: Fixed_Avoidance (Base AGI) + Active_Reaction (Dodge/Parry Roll)
 * - Hit if Attacker Roll > Defender Roll
 */
export interface AttackResult {
  /** Unique attack ID */
  id: string;

  /** Attacker (actor casting the attack) */
  attackerId: string;

  /** Defender (target of the attack) */
  defenderId: string;

  /** Weapon used in attack (weapon ID, null if unarmed) */
  weaponId: string | null;

  /** Attack type: Melee, Ranged, Spell Magic, etc. */
  attackType: 'melee' | 'ranged' | 'spell' | 'ability';

  /**
   * Attacker roll result
   * = d20 + (DEX or STR modifier, weapon dependent) + Skill bonus + Information Lag penalty
   */
  attackerRoll: number;

  /** Defender roll result = d20 + AGI modifier + stance bonus/penalty */
  defenderRoll: number;

  /** Difference (positive = hit, negative = miss) */
  rollDifference: number;

  /** Whether attack connected (attackerRoll > defenderRoll) */
  isHit: boolean;

  /**
   * Critical hit: attackerRoll natural 20 or massive difference (diff > 10)
   * Multiplies damage by 1.5-2.0x
   */
  isCritical: boolean;

  /** Base weapon damage before modifiers */
  baseDamage: number;

  /** Bonus damage from attributes (STR for melee, DEX for ranged, INT for spells) */
  attributeDamageBonus: number;

  /** Damage after armor/shield reduction */
  finalDamage: number;

  /**
   * Information Lag penalty from FrictionManager
   * Applied to attacker roll: -Lag (typically -0.0 to -0.9x)
   */
  informationLagPenalty: number;

  /** Enemy armor/shield DR applied */
  armorReduction: number;

  /** Injuries generated from this attack (if damage > 0) */
  injuriesGenerated: {
    type: InjuryType;
    severity: number;
  }[];

  /** Weapon durability loss from this attack */
  weaponDurabilityLoss: number;

  /** Defender armor integrity loss (if blocked) */
  armorIntegrityLoss: number;

  /** HP damage dealt to defender */
  healthPointsDamage: number;

  /** When this attack occurred (tick number) */
  occurredAtTick: number;
}

/**
 * Combat Action: DSS 08.1 - Action executed during Atomic Pulse
 *
 * Major actions (consume 1 slot):
 * - Strike: Physical attack with weapon
 * - Cast: Spellcasting
 * - Move: Repositioning
 * - Interact: Manipulate environment
 *
 * Minor actions (consume 1 slot):
 * - Draw weapon
 * - Use consumable
 * - Shout/Communicate
 * - Change stance
 */
export type ActionType = 'strike' | 'cast' | 'move' | 'interact' | 'draw_weapon' | 'use_consumable' | 'shout' | 'change_stance' | 'flee';

export interface CombatAction {
  /** Unique action ID */
  id: string;

  /** Actor performing the action */
  actorId: string;

  /** Type of action */
  actionType: ActionType;

  /** Whether this is a Major or Minor action */
  actionSize: 'major' | 'minor';

  /** Target of action (actor ID, location, item ID, etc.) */
  targetId: string | null;

  /** Combat stance active during this action */
  activeDuringStance: CombatStance;

  /** Stamina cost for this action */
  staminaCost: number;

  /**
   * Damage dealt (if applicable)
   * Set after resolution in combatResolver
   */
  damageDealt: number | null;

  /** Success status (null = pending, true = success, false = failed) */
  wasSuccessful: boolean | null;

  /** If spell cast, mana cost incurred */
  manaCost: number | null;

  /** Cooldown ticks (if action has cooldown) */
  cooldownRemaining: number | null;

  /** Reference to any resulting AttackResult (if applicable) */
  resultingAttackId: string | null;

  /** When action was initiated (tick number) */
  initiatedAtTick: number;

  /** When action resolved (tick number, null if pending) */
  resolvedAtTick: number | null;
}

/**
 * Combat Round: Grouping of all actions in an Atomic Pulse
 *
 * During combat, actors take turns based on Initiative.
 * Each actor gets 1 Major + 1 Minor action per pulse.
 */
export interface CombatRound {
  /** Unique round ID */
  id: string;

  /** Map of actorId -> Initiative ordering */
  initiativeOrder: Initiative[];

  /** List of all actions taken this round (in order of initiative) */
  actions: CombatAction[];

  /** List of all attack results this round */
  attackResults: AttackResult[];

  /** Whether combat is still ongoing */
  isActive: boolean;

  /** When this round started (tick number) */
  startedAtTick: number;

  /** When this round ended (tick number, null if ongoing) */
  endedAtTick: number | null;

  /** Which location/tile this combat is occurring on */
  locationId: string | null;

  /** Environmental hazards affecting this combat */
  activeEnvironmentalHazards: string[];
}

/**
 * Spell Misfire: DSS 08.4 - Magic spell failure
 *
 * When casting spells, misfire mechanics apply:
 * - Misfire range is 1-3 (or higher with WIS penalty)
 * - Mana saturation of location affects misfire chance
 * - Interruptions (taking damage) require WIS + CON check to maintain focus
 * - Misfire causes Mana Backlash: Sanity damage + minor Paradox Bleed
 */
export interface SpellMisfire {
  /** Unique misfire ID */
  id: string;

  /** Actor who was casting the spell */
  casterId: string;

  /** Spell being cast (spell ID) */
  spellId: string;

  /** Misfire trigger: was it a low d20 roll, or interruption? */
  misfireType: 'low_roll' | 'interrupted' | 'overload';

  /** d20 roll that triggered the misfire (if applicable) */
  misfireRoll: number | null;

  /** Mana saturation of location (0-100) */
  manaSaturation: number;

  /** WIS check result (to save from interruption) */
  focusCheckRoll: number | null;

  /** Sanity damage from backlash */
  sanityDamage: number;

  /** Paradox debt increment from backlash */
  paradoxDebtIncrement: number;

  /** Additional effects (e.g., "summon shadow entity") */
  additionalEffects: string[];

  /** When misfire occurred (tick number) */
  occurredAtTick: number;
}

/**
 * Pacifism Resolution: DSS 08.5 - De-escalation system
 *
 * High CHA characters can attempt to de-escalate conflicts through dialogue.
 * - Success: Combat ends, converts to dialogue event
 * - Failure: Defender loses next Minor Action (confusion)
 */
export interface PacifismAttempt {
  /** Unique attempt ID */
  id: string;

  /** Character attempting de-escalation */
  initiatorId: string;

  /** Target of de-escalation attempt */
  targetId: string;

  /** CHA modifier for de-escalation */
  charismaModifier: number;

  /** Target's CHA modifier (resistance) */
  targetCharismaModifier: number;

  /** d20 roll by initiator */
  diceRoll: number;

  /** Total roll (d20 + CHA mod) */
  totalRoll: number;

  /** Target's opposing roll (resistance) */
  targetRoll: number;

  /** Whether de-escalation succeeded */
  wasSuccessful: boolean;

  /** If failed, target loses Minor Action next round */
  targetConfusedNextRound: boolean;

  /** When attempt was made (tick number) */
  attemptedAtTick: number;
}

/**
 * Environmental Interaction: DSS 08.5 - Stage-based tactics
 *
 * Players can interact with the 3D grid environment during combat:
 * - Tip hazards onto enemies (gravity-based damage)
 * - Block paths with objects
 * - Use height for PER bonuses
 * - Create cover positions
 */
export interface EnvironmentalInteraction {
  /** Unique interaction ID */
  id: string;

  /** Actor performing interaction */
  actorId: string;

  /** Type of interaction */
  interactionType: 'tip_hazard' | 'block_path' | 'use_height' | 'create_cover';

  /** Environmental object being manipulated */
  environmentalObjectId: string;

  /** Target of interaction (if applicable) */
  targetActorId: string | null;

  /** Success roll (d20 + STR for moving objects, PER for positioning) */
  successRoll: number;

  /** Difficulty class for this interaction */
  dc: number;

  /** Whether interaction succeeded */
  wasSuccessful: boolean;

  /** Effects generated (damage, cover bonuses, etc.) */
  generatedEffects: Record<string, number>;

  /** When interaction occurred (tick number) */
  occurredAtTick: number;
}

/**
 * Helper: Generate attack roll for contested combat
 * Attacker d20 + Attribute Mod + Skill Bonus vs Defender d20 + AGI Mod + Stance Bonus
 */
export interface AttackRollCoefficient {
  diceRoll: number;                    // 1-20
  attributeModifier: number;           // STR or DEX
  skillBonus: number;                  // From weapon skill proficiency
  informationLagPenalty: number;       // From FrictionManager
  totalRoll: number;                   // Sum of above
}

export interface DefenseRollCoefficient {
  diceRoll: number;                    // 1-20
  agilityModifier: number;             // AGI mod
  stanceBonus: number;                 // +3 defensive, -3 aggressive, 0 balanced
  totalRoll: number;                   // Sum of above
}

/**
 * Contested Roll threshold types for easy lookup
 */
export const COMBAT_ROLL_MODIFIERS = {
  // Stance bonuses/penalties
  aggressiveStanceDamageBonus: 0.2,      // +20% damage
  aggressiveStanceDefensePenalty: -3,    // -3 AC
  defensiveStanceDamageReduction: 0.2,   // -20% damage output
  defensiveStanceDefenseBonus: 3,        // +3 AC
  balancedStanceModifier: 0,             // No bonus

  // Weapon requirement penalties (DSS 01.2)
  insufficientAttributePenalty: -5,      // -5 to attack roll
  insufficientAttributeStaminaCost: 2.0, // 2x stamina

  // Critical thresholds
  naturalCriticalRoll: 20,               // Natural 20 automatic crit
  criticalRollDifferenceThreshold: 10,   // Hit by +10 or more = crit
  criticalDamageMultiplier: 1.5,         // 1.5x to 2.0x damage

  // Misfire thresholds (DSS 08.4)
  baseMisfireRange: 3,                   // Roll 1-3 is misfire
  wisAdjustmentPerPoint: -0.1,           // WIS reduces misfire range
  manaSaturationMisfireBonus: 0.03,      // +3% misfire per saturation point
} as const;
