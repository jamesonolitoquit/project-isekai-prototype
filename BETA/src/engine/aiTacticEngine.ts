import type { NPC, WorldState, NpcPersonality, PersonalityType } from './worldEngine';
import type { Action } from './actionPipeline';
import type { CombatantStats } from './ruleEngine';
import { random } from './prng';
import { getSpellsByDiscipline, getSpellById } from './magicEngine';
import { ABILITY_DATABASE } from './abilityResolver';

export { PersonalityType, NpcPersonality };

/**
 * Get default personality for an NPC based on type or explicit personality field
 */
export function getNpcPersonality(npc: NPC): NpcPersonality {
  if (npc.personality) {
    return npc.personality;
  }

  // Default personality based on NPC class
  const personalityMap: Record<PersonalityType, NpcPersonality> = {
    aggressive: {
      type: 'aggressive',
      attackThreshold: 0.3, // Attack until 30% HP
      defendThreshold: 0.15,
      riskTolerance: 0.8
    },
    cautious: {
      type: 'cautious',
      attackThreshold: 0.6, // Start defending at 60% HP
      defendThreshold: 0.4,
      riskTolerance: 0.3
    },
    tactical: {
      type: 'tactical',
      attackThreshold: 0.5,
      defendThreshold: 0.35,
      riskTolerance: 0.6
    },
    healer: {
      type: 'healer',
      attackThreshold: 0.4,
      defendThreshold: 0.5,
      riskTolerance: 0.2
    },
    balanced: {
      type: 'balanced',
      attackThreshold: 0.4,
      defendThreshold: 0.35,
      riskTolerance: 0.5
    }
  };

  return personalityMap.balanced;
}

/**
 * Calculate NPC health percentage
 */
function getHealthPercent(npc: NPC): number {
  const maxHp = npc.maxHp || 100;
  const currentHp = npc.hp || maxHp;
  return currentHp / maxHp;
}

/**
 * Check if NPC is in combat with player
 */
function isInCombatWithPlayer(npc: NPC, state: WorldState): boolean {
  return !!(
    state.combatState?.active &&
    state.combatState?.participants?.includes(npc.id) &&
    state.combatState?.participants?.includes(state.player.id)
  );
}

/**
 * Decide NPC action based on personality, health, stats, and combat situation
 * Enhanced with spell casting and flee/surrender logic
 */
export function decideNpcAction(npc: NPC, state: WorldState): Action {
  const personality = getNpcPersonality(npc as NPC & { personality?: NpcPersonality });
  const healthPercent = getHealthPercent(npc);
  const npcStats: CombatantStats = npc.stats || {
    str: 10,
    agi: 10,
    int: 10,
    cha: 10,
    end: 10,
    luk: 10
  };

  // Check for status effects that prevent action
  if (npc.statusEffects?.includes('STUNNED') || npc.statusEffects?.includes('DAZED')) {
    return {
      worldId: state.id,
      playerId: npc.id,
      type: 'WAIT',
      payload: { reason: 'status-effect' }
    };
  }

  // ALPHA_M4: Flee/Surrender logic for cautious NPCs at critical HP
  if (personality.type === 'cautious' && healthPercent < 0.15) {
    // Attempt surrender with bribe offer
    if (random() < 0.6) {
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'ATTEMPT_SURRENDER',
        payload: {
          targetId: state.player.id,
          message: `${npc.name || 'NPC'} attempts to flee or offer a bribe!`,
          offeringGold: Math.floor(npcStats.cha * 10)
        }
      };
    }
    // Otherwise try to flee
    return {
      worldId: state.id,
      playerId: npc.id,
      type: 'FLEE',
      payload: { reason: 'low-health', targetLocation: state.player.location }
    };
  }

  // ALPHA_M4: Healing priority for healer personalities
  if (personality.type === 'healer' && healthPercent < personality.defendThreshold && npcStats.int > 8) {
    // Check if healer has mana for healing spell
    const npcMp = (npc as any).mp || 0;
    const healingSpells = getSpellsByDiscipline('life');
    
    // Find a healing spell the healer can cast
    const castableHealSpell = healingSpells.find(spell => 
      spell.manaCost <= npcMp && npcStats.int >= spell.requiredInt
    );

    if (castableHealSpell) {
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'CAST_SPELL',
        payload: {
          spellId: castableHealSpell.id,
          targetId: npc.id,
          reason: 'self-heal'
        }
      };
    }

    // Fallback to basic heal action if available
    return {
      worldId: state.id,
      playerId: npc.id,
      type: 'HEAL',
      payload: { targetId: npc.id }
    };
  }

  // ALPHA_M4: Spell casting for tactical NPCs when healthy
  if (personality.type === 'tactical' && healthPercent > 0.6) {
    const npcMp = (npc as any).mp || 0;
    if (npcMp > 0 && npcStats.int > 10) {
      // Get offensive spells tactician can cast
      const offensiveSpells = getSpellsByDiscipline('ruin').filter(spell => 
        spell.manaCost <= npcMp && npcStats.int >= spell.requiredInt
      );

      if (offensiveSpells.length > 0) {
        // Pick a random offensive spell
        const selectedSpell = offensiveSpells[Math.floor(random() * offensiveSpells.length)];
        return {
          worldId: state.id,
          playerId: npc.id,
          type: 'CAST_SPELL',
          payload: {
            spellId: selectedSpell.id,
            targetId: state.player.id,
            reason: 'tactical-offense'
          }
        };
      }
    }
  }

  // Defensive behavior when wounded
  if (healthPercent < personality.defendThreshold) {
    // Check for defensive spells or abilities
    if (npcStats.int > 8 && ((npc as any).mp || 0) > 10) {
      const defensiveSpells = getSpellsByDiscipline('veil').filter(spell =>
        spell.manaCost <= ((npc as any).mp || 0) && npcStats.int >= spell.requiredInt
      );
      if (defensiveSpells.length > 0) {
        const selectedSpell = defensiveSpells[Math.floor(random() * defensiveSpells.length)];
        return {
          worldId: state.id,
          playerId: npc.id,
          type: 'CAST_SPELL',
          payload: {
            spellId: selectedSpell.id,
            targetId: npc.id,
            reason: 'defensive-buff'
          }
        };
      }
    }

    // Choose defense based on stats
    if (npcStats.agi > npcStats.str) {
      // Agile NPC - parry
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'PARRY',
        payload: { targetId: state.player.id }
      };
    } else {
      // Strong NPC - block, also recovers mana (5% of maxMp)
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'DEFEND',
        payload: { targetId: state.player.id, manaRecovery: true }
      };
    }
  }

  // Aggressive behavior when healthy or low risk tolerance
  if (healthPercent > personality.attackThreshold || personality.riskTolerance > 0.7) {
    return {
      worldId: state.id,
      playerId: npc.id,
      type: 'ATTACK',
      payload: { targetId: state.player.id }
    };
  }

  // Tactical: mixed approach with occasional spell casting or ability usage (Phase 7)
  if (personality.type === 'tactical') {
    const npcMp = (npc as any).mp || 0;
    
    // Phase 7: 20% chance to use an ability if available
    if (random() < 0.2 && npcMp > 10) {
      const availableAbilities = Object.values(ABILITY_DATABASE).filter(ability => {
        // Check if NPC has enough mana and stats to use this ability
        return ability.manaCost <= npcMp && npcStats.int >= 10;
      });
      
      if (availableAbilities.length > 0) {
        const selectedAbility = availableAbilities[Math.floor(random() * availableAbilities.length)];
        return {
          worldId: state.id,
          playerId: npc.id,
          type: 'USE_ABILITY',
          payload: {
            abilityId: selectedAbility.id,
            targetId: state.player.id,
            reason: 'tactical-ability'
          }
        };
      }
    }
    
    // 30% chance to cast a spell if mana available
    if (random() < 0.3 && npcMp > 15 && npcStats.int > 12) {
      const tacticalSpells = getSpellsByDiscipline('ruin').filter(spell =>
        spell.manaCost <= npcMp && npcStats.int >= spell.requiredInt
      );
      if (tacticalSpells.length > 0) {
        const selectedSpell = tacticalSpells[Math.floor(random() * tacticalSpells.length)];
        return {
          worldId: state.id,
          playerId: npc.id,
          type: 'CAST_SPELL',
          payload: {
            spellId: selectedSpell.id,
            targetId: state.player.id,
            reason: 'tactical-spell'
          }
        };
      }
    }

    // Default tactical behavior
    const attackChance = 0.4 + healthPercent * 0.4;
    if (random() < attackChance) {
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'ATTACK',
        payload: { targetId: state.player.id }
      };
    } else {
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'DEFEND',
        payload: { targetId: state.player.id, manaRecovery: true }
      };
    }
  }

  // Default: attack
  return {
    worldId: state.id,
    playerId: npc.id,
    type: 'ATTACK',
    payload: { targetId: state.player.id }
  };
}

/**
 * Phase 41: Predict NPC's next action and update their intent field
 * This allows the player to see what the NPC will do, enabling tactical card play
 * The intent is computed at the end of the turn and displayed until the next turn
 */
export function predictNextNpcAction(npc: NPC, state: WorldState): void {
  // Only predict intents for NPCs actively in combat
  if (!state.combatState?.active || !state.combatState?.participants?.includes(npc.id)) {
    npc.intent = undefined;
    return;
  }

  // Decide what action the NPC would take
  const plannedAction = decideNpcAction(npc, state);
  
  // Map action type to human-readable intent
  const intentTypeMap: Record<string, string> = {
    'ATTACK': 'attack',
    'CAST_SPELL': 'cast-spell',
    'HEAL': 'heal',
    'ATTEMPT_SURRENDER': 'surrender',
    'FLEE': 'flee',
    'WAIT': 'wait',
    'DEFEND': 'defend'
  };

  const actionTypeId = intentTypeMap[plannedAction.type] || 'unknown';
  const targetId = plannedAction.payload?.targetId || state.player.id;
  
  // Get personality to determine intensity
  const personality = getNpcPersonality(npc);
  const healthPercent = getHealthPercent(npc);
  
  // Calculate intensity based on health and personality
  let intensity = 50; // Base intensity
  if (healthPercent > personality.attackThreshold) {
    intensity = 75; // High intensity when healthy
  } else if (healthPercent < personality.defendThreshold) {
    intensity = 30; // Low intensity when wounded
  }
  
  // Estimate predicted damage (simplified)
  let predictedDamage = 0;
  if (actionTypeId === 'attack') {
    const npcStats = npc.stats || { str: 10 };
    predictedDamage = Math.floor(npcStats.str * 0.5 + 5); // Rough estimate
  }

  // Update the NPC's intent for the UI to display
  npc.intent = {
    actionTypeId,
    targetId,
    intensity,
    predictedDamage,
    predictedCost: 1, // Most NPC actions cost 1 AP in Phase 41
    lastComputedTick: state.tick
  };
}

/**
 * Generate actions for all combatants except the player in the current turn
 */
export function resolveNpcTurns(state: WorldState): Action[] {
  if (!state.combatState?.active) {
    return [];
  }

  const actions: Action[] = [];
  const npcsInCombat = state.npcs.filter(npc =>
    state.combatState?.participants?.includes(npc.id)
  );

  npcsInCombat.forEach(npc => {
    // Skip player and already acting this turn
    if (npc.id === state.player.id) return;

    const action = decideNpcAction(npc, state);
    actions.push(action);
  });

  return actions;
}
