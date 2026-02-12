import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';

export interface RebuildResult {
  candidateState: WorldState;
}

/**
 * Rebuild world state by replaying events from a checkpoint
 */
export function rebuildState(initialState: WorldState, events: Event[], upToTick?: number): RebuildResult {
  let state = structuredClone(initialState);

  for (const event of events) {
    if (upToTick !== undefined && event.id > upToTick.toString()) {
      break;
    }
    state = applyEventToState(state, event);
  }

  return { candidateState: state };
}

/**
 * Apply event to state
 */
function applyEventToState(state: WorldState, event: Event): WorldState {
  const newState = structuredClone(state);

  switch (event.type) {
    case 'MOVE': {
      const { playerId, to } = event.payload;
      if (newState.player) {
        newState.player.location = to;
      }
      break;
    }
    case 'INTERACT_NPC': {
      const { npcId, dialogueText, options } = event.payload;
      if (newState.player) {
        if (!newState.player.dialogueHistory) {
          newState.player.dialogueHistory = [];
        }
        newState.player.dialogueHistory.push({ npcId, text: dialogueText, options, timestamp: event.timestamp });
      }
      break;
    }
    case 'QUEST_STARTED': {
      const { questId } = event.payload;
      if (newState.player && newState.player.quests) {
        newState.player.quests[questId] = { status: 'in_progress', startedAt: event.timestamp };
      }
      break;
    }
    case 'QUEST_COMPLETED': {
      const { questId } = event.payload;
      if (newState.player && newState.player.quests) {
        newState.player.quests[questId] = { status: 'completed' };
      }
      break;
    }
    case 'REWARD': {
      const { type: rewardType, amount } = event.payload;
      if (newState.player) {
        if (rewardType === 'gold') {
          newState.player.gold = (newState.player.gold || 0) + amount;
        }
      }
      break;
    }
    case 'REPUTATION_CHANGED': {
      const { npcId, delta } = event.payload;
      if (newState.player) {
        if (!newState.player.reputation) {
          newState.player.reputation = {};
        }
        newState.player.reputation[npcId] = (newState.player.reputation[npcId] || 0) + delta;
      }
      break;
    }
    case 'COMBAT_HIT': {
      const { damage } = event.payload;
      if (newState.player) {
        newState.player.hp = Math.max(0, (newState.player.hp || 100) - damage);
      }
      break;
    }
    case 'COMBAT_BLOCK': {
      const { finalDamage } = event.payload;
      if (newState.player && finalDamage > 0) {
        newState.player.hp = Math.max(0, (newState.player.hp || 100) - finalDamage);
      }
      break;
    }
    case 'COMBAT_PARRY': {
      const { finalDamage } = event.payload;
      if (newState.player && finalDamage > 0) {
        newState.player.hp = Math.max(0, (newState.player.hp || 100) - finalDamage);
      }
      break;
    }
    case 'PLAYER_HEALED': {
      const { hpRestored, newHp, maxHp } = event.payload;
      if (newState.player) {
        newState.player.hp = Math.min(newHp || (newState.player.maxHp || 100), (newState.player.hp || 0) + (hpRestored || 0));
      }
      break;
    }
    case 'PLAYER_REST': {
      const { hpRestored, newHp } = event.payload;
      if (newState.player) {
        newState.player.hp = Math.min(newHp || (newState.player.maxHp || 100), (newState.player.hp || 0) + (hpRestored || 0));
      }
      break;
    }
    case 'HAZARD_DAMAGE': {
      const { damage, statusApplied } = event.payload;
      if (newState.player) {
        if (damage && damage > 0) {
          newState.player.hp = Math.max(0, (newState.player.hp || 100) - damage);
        }
        if (statusApplied) {
          if (!newState.player.statusEffects) {
            newState.player.statusEffects = [];
          }
          if (!newState.player.statusEffects.includes(statusApplied)) {
            newState.player.statusEffects.push(statusApplied);
          }
        }
      }
      break;
    }
    case 'STATUS_APPLIED': {
      const { statusEffect } = event.payload;
      if (newState.player && statusEffect) {
        if (!newState.player.statusEffects) {
          newState.player.statusEffects = [];
        }
        if (!newState.player.statusEffects.includes(statusEffect)) {
          newState.player.statusEffects.push(statusEffect);
        }
      }
      break;
    }
    case 'TICK': {
      const { newHour, newDay, newSeason } = event.payload;
      if (newHour !== undefined) newState.hour = newHour;
      if (newDay !== undefined) newState.day = newDay;
      if (newSeason !== undefined) newState.season = newSeason;
      newState.tick! = (newState.tick || 0) + 1;
      break;
    }
    case 'ITEM_PICKED_UP': {
      const { itemId, quantity } = event.payload;
      if (!newState.player?.inventory) {
        newState.player!.inventory = [];
      }
      const existing = newState.player.inventory.find(i => i.itemId === itemId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        newState.player.inventory.push({ itemId, quantity });
      }
      break;
    }
    case 'ITEM_DROPPED': {
      const { itemId, quantity } = event.payload;
      if (!newState.player?.inventory) return newState;
      const idx = newState.player.inventory.findIndex(i => i.itemId === itemId);
      if (idx !== -1) {
        newState.player.inventory[idx].quantity -= quantity;
        if (newState.player.inventory[idx].quantity <= 0) {
          newState.player.inventory.splice(idx, 1);
        }
      }
      break;
    }
    case 'ITEM_EQUIPPED': {
      const { itemId } = event.payload;
      if (!newState.player?.equipment) {
        newState.player!.equipment = {};
      }
      // Simplified: determine slot from item type (would need items.json lookup in real impl)
      // For now, default to mainHand
      const slot = 'mainHand';
      newState.player.equipment[slot as keyof typeof newState.player.equipment] = itemId;
      break;
    }
    case 'ITEM_UNEQUIPPED': {
      const { slot } = event.payload;
      if (newState.player?.equipment) {
        (newState.player.equipment as any)[slot] = undefined;
      }
      break;
    }
    case 'RESOURCE_GATHERED': {
      const { resourceType, quantity } = event.payload;
      if (!newState.player?.inventory) {
        newState.player!.inventory = [];
      }
      const existing = newState.player.inventory.find(i => i.itemId === resourceType);
      if (existing) {
        existing.quantity += quantity;
      } else {
        newState.player.inventory.push({ itemId: resourceType, quantity });
      }
      break;
    }
    case 'ITEM_CRAFTED': {
      const { recipeId, success } = event.payload;
      // Would need to apply recipe results from items.json
      // For now, just record that something was crafted
      break;
    }
    case 'ITEM_USED': {
      const { itemId, quantity = 1 } = event.payload;
      if (!newState.player?.inventory) return newState;
      const idx = newState.player.inventory.findIndex(i => i.itemId === itemId);
      if (idx !== -1) {
        newState.player.inventory[idx].quantity -= quantity;
        if (newState.player.inventory[idx].quantity <= 0) {
          newState.player.inventory.splice(idx, 1);
        }
      }
      break;
    }
    case 'NODE_DEPLETED': {
      const { nodeId } = event.payload;
      if (!newState.resourceNodes) return newState;
      const node = newState.resourceNodes.find(n => n.id === nodeId);
      if (node) {
        node.depletedAt = newState.tick || 0; // Mark depletion time (in ticks)
      }
      break;
    }
    case 'XP_GAINED': {
      const { xpAmount } = event.payload;
      if (newState.player) {
        const currentXp = (newState.player.xp || 0) + xpAmount;
        newState.player.xp = currentXp;
        // Calculate level-up if XP exceeds threshold
        const level = newState.player.level || 1;
        const xpThreshold = level * 100; // Simple formula: 100 * level
        if (currentXp >= xpThreshold) {
          newState.player.level = level + 1;
          newState.player.xp = 0;
          newState.player.attributePoints = (newState.player.attributePoints || 0) + 2;
        }
      }
      break;
    }
    case 'STAT_ALLOCATED': {
      const { stat, amount } = event.payload;
      if (newState.player?.stats && (stat in newState.player.stats)) {
        (newState.player.stats as any)[stat] += amount;
        newState.player.attributePoints = Math.max(0, (newState.player.attributePoints || 0) - amount);
      }
      break;
    }
    case 'CHARACTER_CREATED': {
      const { character } = event.payload;
      const newPlayer = structuredClone(character);
      // Initialize HP based on END stat if not already set
      if (!newPlayer.hp || !newPlayer.maxHp) {
        const endStat = newPlayer.stats?.end || 10;
        const baseHp = 80 + endStat * 2; // Base 80 + 2 per END
        newPlayer.hp = baseHp;
        newPlayer.maxHp = baseHp;
      }
      if (!newPlayer.statusEffects) {
        newPlayer.statusEffects = [];
      }
      // Preserve quests, gold, reputation, etc. from current state
      newPlayer.quests = newState.player?.quests || {};
      newPlayer.gold = newState.player?.gold ?? 0;
      newPlayer.reputation = newPlayer.reputation || {};
      newState.player = newPlayer;
      break;
    }
    case 'QUEST_OBJECTIVE_ADVANCED': {
      const { questId, newObjective } = event.payload;
      if (newState.player?.quests) {
        if (!newState.player.quests[questId]) {
          newState.player.quests[questId] = { status: 'in_progress' };
        }
        newState.player.quests[questId].currentObjectiveIndex = newObjective;
      }
      break;
    }
    case 'QUEST_COMPLETED': {
      const { questId } = event.payload;
      if (newState.player?.quests) {
        if (!newState.player.quests[questId]) {
          newState.player.quests[questId] = { status: 'completed' };
        }
        newState.player.quests[questId].status = 'completed';
        newState.player.quests[questId].completedAt = newState.tick || 0;
      }
      break;
    }
    case 'WORLD_EVENT_TRIGGERED': {
      const { eventId } = event.payload;
      if (!newState.activeEvents) {
        newState.activeEvents = [];
      }
      const eventExists = newState.activeEvents.find(e => e.id === eventId);
      if (!eventExists) {
        newState.activeEvents.push({
          id: eventId,
          name: eventId,
          type: 'climate-change',
          activeFrom: newState.tick || 0,
          activeTo: (newState.tick || 0) + 3600, // 1 hour duration
          effects: {}
        });
      }
      break;
    }
    case 'REPUTATION_CHANGED': {
      const { npcId, newRep } = event.payload;
      if (!newState.player?.reputation) {
        newState.player.reputation = {};
      }
      newState.player.reputation[npcId] = newRep;
      break;
    }
    case 'REPUTATION_MILESTONE_REACHED': {
      // Already tracked in REPUTATION_CHANGED, this is just a log event
      break;
    }
    default:
      break;
  }

  return newState;
}

/**
 * Verify state consistency
 */
export function verifyStateConsistency(
  initialState: WorldState,
  events: Event[],
  currentState: WorldState
): { consistent: boolean; rebuiltState: WorldState } {
  const result = rebuildState(initialState, events);
  const rebuiltState = result.candidateState;
  const currentJson = JSON.stringify(currentState);
  const rebuiltJson = JSON.stringify(rebuiltState);

  return {
    consistent: currentJson === rebuiltJson,
    rebuiltState
  };
}