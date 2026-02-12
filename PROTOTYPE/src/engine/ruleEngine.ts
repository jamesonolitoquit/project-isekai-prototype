import type { Event } from '../events/mutationLog';

export interface CombatantStats {
  str: number;
  agi: number;
  int: number;
  cha: number;
  end: number;
  luk: number;
}

/**
 * Calculate total stat bonuses from equipped items
 * @param equipment Object with equipment slot IDs
 * @param itemTemplates Map of item ID to item template
 * @returns Combined stat bonuses
 */
export function getEquipmentBonuses(
  equipment: Record<string, string>,
  itemTemplates: Record<string, any>
): Partial<CombatantStats> {
  const bonuses = { str: 0, agi: 0, int: 0, cha: 0, end: 0, luk: 0 };
  
  if (!equipment) return bonuses;
  
  Object.values(equipment).forEach((itemId: string) => {
    if (!itemId) return;
    const template = itemTemplates[itemId];
    if (!template || !template.stats) return;
    
    // Add up all stat bonuses from equipped items
    (Object.keys(template.stats) as (keyof typeof bonuses)[]).forEach((stat) => {
      bonuses[stat] = (bonuses[stat] || 0) + (template.stats[stat] || 0);
    });
  });
  
  return bonuses;
}

/**
 * Apply equipment bonuses to base stats
 */
export function applyEquipmentBonuses(baseStats: CombatantStats, bonuses: Partial<CombatantStats>): CombatantStats {
  return {
    str: baseStats.str + (bonuses.str || 0),
    agi: baseStats.agi + (bonuses.agi || 0),
    int: baseStats.int + (bonuses.int || 0),
    cha: baseStats.cha + (bonuses.cha || 0),
    end: baseStats.end + (bonuses.end || 0),
    luk: baseStats.luk + (bonuses.luk || 0)
  };
}

export interface CombatResult {
  attacker: string;
  defenders: string[];
  winner: 'attacker' | 'defender';
  logs: string[];
  damageDealt: number;
  combatantsHealth?: Record<string, number>;
}

/**
 * Roll a check against a difficulty with optional stat modifier
 */
export function rollCheck(stat: number, difficulty: number, modifier: number = 0): { success: boolean; roll: number } {
  const roll = Math.floor(Math.random() * 20) + 1 + Math.floor(stat / 3) + modifier;
  return {
    success: roll >= difficulty,
    roll
  };
}

/**
 * Calculate damage based on attacker and defender stats
 */
export function calculateDamage(attackerStats: CombatantStats, defenderStats: CombatantStats): number {
  const attackerMultiplier = 1 + attackerStats.str / 100;
  const defenseMultiplier = 1 + Math.max(0, defenderStats.end / 150);
  
  const baseDamage = 8 + attackerStats.str / 10;
  const luckBonus = attackerStats.luk > 10 ? 2 : attackerStats.luk < 5 ? -2 : 0;
  
  const finalDamage = Math.max(1, Math.floor((baseDamage + luckBonus) * attackerMultiplier / defenseMultiplier));
  
  return finalDamage;
}

/**
 * Resolve a BLOCK defense action - reduces incoming damage based on stats
 * Block roll is against an unarmed combat check DC
 */
export function resolveDefense(
  defenderStats: CombatantStats,
  incomingDamage: number
): { blocked: boolean; damageReduced: number; finalDamage: number; logs: string[] } {
  const logs: string[] = [];
  
  // Block roll is based on END + AGI
  const blockRoll = rollCheck(defenderStats.end + defenderStats.agi / 2, 11);
  logs.push(`Defender attempts block: ${blockRoll.roll} vs DC 11. ${blockRoll.success ? 'Blocked!' : 'Unblocked!'}`);
  
  if (!blockRoll.success) {
    return {
      blocked: false,
      damageReduced: 0,
      finalDamage: incomingDamage,
      logs
    };
  }
  
  // On successful block, reduce damage by 30-50% based on END
  const reductionPercent = 0.3 + (Math.min(20, defenderStats.end) / 100);
  const damageReduced = Math.floor(incomingDamage * reductionPercent);
  const finalDamage = Math.max(1, incomingDamage - damageReduced);
  
  logs.push(`Block reduces damage by ${damageReduced} (${Math.round(reductionPercent * 100)}%)`);
  
  return {
    blocked: true,
    damageReduced,
    finalDamage,
    logs
  };
}

/**
 * Resolve a PARRY defense action - chance to negate damage and counter-attack
 * Parry is AGI-based and can trigger a counter-attack
 */
export function resolveParry(
  defenderStats: CombatantStats,
  attackerStats: CombatantStats,
  incomingDamage: number
): {
  parried: boolean;
  counterDamage: number;
  finalDamage: number;
  logs: string[];
} {
  const logs: string[] = [];
  
  // Parry roll is based on AGI
  const parryRoll = rollCheck(defenderStats.agi, 12);
  logs.push(`Defender attempts parry: ${parryRoll.roll} vs DC 12. ${parryRoll.success ? 'Parried!' : 'Parry failed!'}`);
  
  if (!parryRoll.success) {
    return {
      parried: false,
      counterDamage: 0,
      finalDamage: incomingDamage,
      logs
    };
  }
  
  // On successful parry, damage is negated and counter-attack is triggered
  const counterDamage = Math.max(1, Math.floor(calculateDamage(defenderStats, attackerStats) * 0.6));
  logs.push(`Parry successful! Counter-attack deals ${counterDamage} damage!`);
  
  return {
    parried: true,
    counterDamage,
    finalDamage: 0,
    logs
  };
}

/**
 * Resolve a HEAL action - restore HP based on INT + CHA stats
 */
export function resolveHeal(
  healerStats: CombatantStats,
  targetMaxHp: number,
  targetCurrentHp: number
): { hpRestored: number; newHp: number; logs: string[] } {
  const logs: string[] = [];
  
  // Healing roll based on INT + CHA
  const healRoll = rollCheck(healerStats.int + healerStats.cha / 2, 10);
  
  // Base healing is 15 + INT modifier, with CHA providing bonus
  let baseHeal = 15 + Math.floor(healerStats.int / 5);
  const chaBonus = Math.floor(healerStats.cha / 10);
  let totalHeal = baseHeal + chaBonus;
  
  if (!healRoll.success) {
    // Failed heal: only half effectiveness
    totalHeal = Math.floor(totalHeal / 2);
    logs.push(`Heal attempt partially succeeded: ${totalHeal} HP restored (roll: ${healRoll.roll})`);
  } else {
    logs.push(`Successful heal: ${totalHeal} HP restored (roll: ${healRoll.roll})`);
  }
  
  const newHp = Math.min(targetMaxHp, targetCurrentHp + totalHeal);
  const hpRestored = newHp - targetCurrentHp;
  
  return {
    hpRestored,
    newHp,
    logs
  };
}

/**
 * Resolve a multi-combatant attack scenario and generate combat events
 * For now: simplified attacker vs defender(s) resolution with stat checks
 */
export function resolveCombat(
  attackerId: string,
  defenderIds: string[],
  attackerStats: CombatantStats,
  defenderStats: Record<string, CombatantStats>,
  worldInstanceId: string
): Event[] {
  const events: Event[] = [];
  const logs: string[] = [];

  if (defenderIds.length === 0) {
    logs.push('No defenders found.');
    return events;
  }

  // Defender gets to dodge/parry check (AGI-based)
  const primaryDefender = defenderIds[0];
  const primaryDefenderStats = defenderStats[primaryDefender];

  if (!primaryDefenderStats) {
    logs.push(`Defender ${primaryDefender} has no stats.`);
    return events;
  }

  // Attack roll
  const attackRoll = rollCheck(attackerStats.agi, 10);
  logs.push(`Attacker rolls: ${attackRoll.roll} vs DC 10. ${attackRoll.success ? 'Hit!' : 'Miss!'}`);

  if (!attackRoll.success) {
    events.push({
      type: 'COMBAT_MISS',
      payload: {
        attackerId,
        defenderIds,
        logs
      },
      id: crypto.randomUUID(),
      worldInstanceId,
      actorId: attackerId,
      templateOrigin: 'combat',
      timestamp: Date.now()
    });
    return events;
  }

  // Defender rolls dodge (AGI-based)
  const dodgeRoll = rollCheck(primaryDefenderStats.agi, 8);
  logs.push(`Defender rolls dodge: ${dodgeRoll.roll} vs DC 8. ${dodgeRoll.success ? 'Dodged!' : 'Hit!'}`);

  if (dodgeRoll.success) {
    events.push({
      type: 'COMBAT_DODGE',
      payload: {
        attackerId,
        defenderId: primaryDefender,
        logs
      },
      id: crypto.randomUUID(),
      worldInstanceId,
      actorId: attackerId,
      templateOrigin: 'combat',
      timestamp: Date.now()
    });
    return events;
  }

  // Calculate and apply damage
  const damage = calculateDamage(attackerStats, primaryDefenderStats);
  logs.push(`Damage dealt: ${damage} HP.`);

  events.push({
    type: 'COMBAT_HIT',
    payload: {
      attackerId,
      defenderId: primaryDefender,
      damage,
      logs
    },
    id: crypto.randomUUID(),
    worldInstanceId,
    actorId: attackerId,
    templateOrigin: 'combat',
    timestamp: Date.now()
  });

  return events;
}

/**
 * Determine if a stat check succeeds (for general rule resolution)
 */
export function statCheck(stat: number, difficulty: number): boolean {
  return rollCheck(stat, difficulty).success;
}
