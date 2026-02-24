import { WorldState, PlayerState, SpellData, SpellsData } from './worldEngine';
import { CombatantStats } from './ruleEngine';
import { random } from './prng';
import spellsData from '../data/spells.json';

export interface Spell {
  id: string;
  name: string;
  discipline: 'ruin' | 'flux' | 'veil' | 'bind' | 'life';
  manaCost: number;
  requiredInt: number;
  description: string;
  effect: any;
  range: string;
  castTime: string;
  cooldown: number;
}

export interface SpellResolution {
  success: boolean;
  damageDealt: number;
  healing: number;
  statusApplied?: string;
  manaConsumed: number;
  message: string;
}

// Build spell templates map from spells.json
const SPELL_TEMPLATES: Record<string, Spell> = {};
if ((spellsData as unknown as SpellsData).spells && Array.isArray((spellsData as unknown as SpellsData).spells)) {
  ((spellsData as unknown as SpellsData).spells as SpellData[]).forEach((spell: SpellData) => {
    SPELL_TEMPLATES[spell.id] = spell as any; // Data import requires this adaptation
  });
}

const DISCIPLINES = spellsData.disciplines as Record<string, any>;

/**
 * Calculate spell success chance based on INT and discipline mastery
 */
function calculateSpellSuccessChance(casterStats: CombatantStats, spell: Spell): number {
  // Base success is 80%
  let successChance = 0.8;

  // Intelligence-based bonus (up to +20%)
  if (casterStats.int >= spell.requiredInt) {
    const intBonus = (casterStats.int - spell.requiredInt) * 0.02;
    successChance += Math.min(0.2, intBonus);
  } else {
    // Penalty if INT is too low (-5% per point below required)
    const intPenalty = (spell.requiredInt - casterStats.int) * 0.05;
    successChance -= Math.min(0.4, intPenalty);
  }

  // Luck-based bonus (up to +10%)
  const luckBonus = casterStats.luk * 0.005;
  successChance += Math.min(0.1, luckBonus);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, successChance));
}

/**
 * Calculate magic damage based on caster INT and spell stats
 */
function calculateMagicDamage(casterStats: CombatantStats, spell: Spell): number {
  const baseDamage = spell.effect.baseDamage || 0;
  const modifier = spell.effect.modifier || 1.0;
  const discipline = DISCIPLINES[spell.discipline];
  const disciplineMultiplier = discipline?.baseSpellDamage || 1.0;

  // INT scaling: each point of INT adds 5% damage
  const intMultiplier = 1.0 + (casterStats.int - 10) * 0.05;

  const finalDamage = Math.floor(baseDamage * modifier * disciplineMultiplier * intMultiplier);
  return Math.max(1, finalDamage);
}

/**
 * Calculate magic defense (resistance to magical damage)
 * Scales with INT and spirit/veil discipline
 */
function calculateMagicDefense(defenderStats: CombatantStats): number {
  // Base magic defense: 20% of INT
  const baseMagicDefense = defenderStats.int * 0.2;

  // AGI provides some evasion (5% per point)
  const agiDefense = defenderStats.agi * 0.05;

  // END provides resilience (3% per point)
  const endDefense = defenderStats.end * 0.03;

  return baseMagicDefense + agiDefense + endDefense;
}

/**
 * Resolve a spell cast
 * Returns the damage dealt, healing, status effects, and whether it succeeded
 */
export function resolveSpell(
  spellId: string,
  caster: Partial<CombatantStats>,
  target: Partial<CombatantStats>,
  targetState: PlayerState
): SpellResolution {
  const spell = SPELL_TEMPLATES[spellId];

  if (!spell) {
    return {
      success: false,
      damageDealt: 0,
      healing: 0,
      manaConsumed: 0,
      message: `Unknown spell: ${spellId}`
    };
  }

  const casterStats: CombatantStats = {
    str: caster.str ?? 10,
    agi: caster.agi ?? 10,
    int: caster.int ?? 10,
    cha: caster.cha ?? 10,
    end: caster.end ?? 10,
    luk: caster.luk ?? 10
  };

  const targetStats: CombatantStats = {
    str: target.str ?? 10,
    agi: target.agi ?? 10,
    int: target.int ?? 10,
    cha: target.cha ?? 10,
    end: target.end ?? 10,
    luk: target.luk ?? 10
  };

  // Check if caster has enough mana
  const playerMp = targetState.mp ?? 0;
  if (playerMp < spell.manaCost) {
    return {
      success: false,
      damageDealt: 0,
      healing: 0,
      manaConsumed: 0,
      message: `Not enough mana. Required: ${spell.manaCost}, Available: ${playerMp}`
    };
  }

  // Check success chance
  const successChance = calculateSpellSuccessChance(casterStats, spell);
  const castSucceeds = random() < successChance;

  if (!castSucceeds) {
    return {
      success: false,
      damageDealt: 0,
      healing: 0,
      manaConsumed: spell.manaCost,
      message: `${spell.name} fizzled (${Math.round(successChance * 100)}% success chance)`
    };
  }

  // Resolve spell effect
  let damageDealt = 0;
  let healing = 0;
  let statusApplied: string | undefined;

  const effectType = spell.effect.type;

  switch (effectType) {
    case 'ruin_damage': {
      const baseDamage = calculateMagicDamage(casterStats, spell);
      const magicDefense = calculateMagicDefense(targetStats);
      const defenseReduction = 1.0 - Math.min(0.7, magicDefense / 100);
      damageDealt = Math.max(1, Math.floor(baseDamage * defenseReduction));

      if (spell.effect.applyStatus) {
        statusApplied = spell.effect.applyStatus;
      }
      break;
    }

    case 'flux_damage': {
      const baseDamage = calculateMagicDamage(casterStats, spell);
      // Flux damage has higher base damage but reduced by INT-based defense
      const magicDefense = calculateMagicDefense(targetStats);
      const defenseReduction = 1.0 - Math.min(0.5, magicDefense / 150);
      damageDealt = Math.max(1, Math.floor(baseDamage * defenseReduction * 1.2));

      if (spell.effect.applyStatus) {
        statusApplied = spell.effect.applyStatus;
      }
      break;
    }

    case 'life_restoration': {
      // Healing spells scale with INT and CHR
      const baseHealing = spell.effect.healAmount || 0;
      const intBonus = casterStats.int * 0.5;
      const charBonus = casterStats.cha * 0.25;
      healing = Math.floor(baseHealing + intBonus + charBonus);
      break;
    }

    case 'life_drain': {
      // Life drain deals damage and heals the caster proportionally
      const baseDamage = calculateMagicDamage(casterStats, spell);
      const magicDefense = calculateMagicDefense(targetStats);
      const defenseReduction = 1.0 - Math.min(0.7, magicDefense / 100);
      damageDealt = Math.max(1, Math.floor(baseDamage * defenseReduction));
      healing = Math.floor(damageDealt * (spell.effect.hpRestored || 0.75));
      break;
    }

    case 'veil_defense':
    case 'flux_defense':
    case 'bind_control': {
      // These are defensive/control spells; handled elsewhere
      statusApplied = spell.effect.baseStatus || spell.effect.duration?.toString();
      break;
    }

    default: {
      return {
        success: false,
        damageDealt: 0,
        healing: 0,
        manaConsumed: spell.manaCost,
        message: `Unknown spell effect type: ${effectType}`
      };
    }
  }

  return {
    success: true,
    damageDealt,
    healing,
    statusApplied,
    manaConsumed: spell.manaCost,
    message: `${spell.name} cast successfully! ` +
      (damageDealt > 0 ? `Damage: ${damageDealt}. ` : '') +
      (healing > 0 ? `Healing: ${healing}. ` : '') +
      (statusApplied ? `Status: ${statusApplied}.` : '')
  };
}

/**
 * Get available spells for a player based on INT stat
 */
export function getAvailableSpells(playerInt: number): Spell[] {
  return Object.values(SPELL_TEMPLATES).filter(spell =>
    playerInt >= spell.requiredInt
  );
}

/**
 * Get spell by ID
 */
export function getSpellById(spellId: string): Spell | undefined {
  return SPELL_TEMPLATES[spellId];
}

/**
 * Get all spells
 */
export function getAllSpells(): Spell[] {
  return Object.values(SPELL_TEMPLATES);
}

/**
 * Get spells by discipline
 */
export function getSpellsByDiscipline(discipline: string): Spell[] {
  return Object.values(SPELL_TEMPLATES).filter(spell =>
    spell.discipline === discipline
  );
}
