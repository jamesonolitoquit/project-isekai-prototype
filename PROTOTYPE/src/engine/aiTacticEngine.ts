import type { NPC, WorldState } from './worldEngine';
import type { Action } from './actionPipeline';
import type { CombatantStats } from './ruleEngine';

export type PersonalityType = 'aggressive' | 'cautious' | 'tactical' | 'healer' | 'balanced';

export interface NpcPersonality {
  type: PersonalityType;
  attackThreshold: number; // HP % to switch to defensive
  defendThreshold: number; // HP % to start healing
  riskTolerance: number; // 0-1, higher = riskier
}

/**
 * Get default personality for an NPC based on type or explicit personality field
 */
export function getNpcPersonality(npc: NPC & { personality?: NpcPersonality }): NpcPersonality {
  if (npc.personality) {
    return npc.personality;
  }

  // Default personality based on NPC class
  const personalityMap: Record<string, NpcPersonality> = {
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

  return personalityMap[npc.personality?.type || 'balanced'] || personalityMap.balanced;
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
  return (
    state.combatState?.active &&
    state.combatState?.participants?.includes(npc.id) &&
    state.combatState?.participants?.includes(state.player.id)
  );
}

/**
 * Decide NPC action based on personality, health, and combat situation
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

  // Healing priority for healer personalities
  if (
    personality.type === 'healer' &&
    healthPercent < personality.defendThreshold &&
    npcStats.int > 8
  ) {
    return {
      worldId: state.id,
      playerId: npc.id,
      type: 'HEAL',
      payload: { targetId: npc.id }
    };
  }

  // Defensive behavior when wounded
  if (healthPercent < personality.defendThreshold) {
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
      // Strong NPC - block
      return {
        worldId: state.id,
        playerId: npc.id,
        type: 'DEFEND',
        payload: { targetId: state.player.id }
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

  // Tactical: mixed approach
  if (personality.type === 'tactical') {
    const attackChance = 0.4 + healthPercent * 0.4;
    if (Math.random() < attackChance) {
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
        payload: { targetId: state.player.id }
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
