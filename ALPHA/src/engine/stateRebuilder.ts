import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { random } from './prng';
import { createStackableItem, isStackableItem } from './worldEngine';

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

    case 'TRAVEL_STARTED': {
      // M9 Phase 3: Track travel animation state
      const { from, to, estimatedTicks, terrainDifficulty } = event.payload;
      if (newState.player) {
        (newState.player as any).travelState = {
          isActive: true,
          from,
          to,
          estimatedTicks,
          terrainDifficulty,
          startedAt: event.timestamp,
        };
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
      const { hpRestored, newHp, mpRestored, newMp } = event.payload;
      if (newState.player) {
        newState.player.hp = Math.min(newHp || (newState.player.maxHp || 100), (newState.player.hp || 0) + (hpRestored || 0));
        // Handle mana restoration during rest
        if (newMp !== undefined) {
          newState.player.mp = newMp;
        } else if (mpRestored !== undefined) {
          newState.player.mp = Math.min(newState.player.maxMp || 0, (newState.player.mp || 0) + mpRestored);
        }
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
    case 'SOUL_DECAY': {
      const { newStrain } = event.payload;
      if (newState.player && typeof newStrain === 'number') {
        newState.player.soulStrain = newStrain;
      }
      break;
    }
    case 'NPC_SOUL_DECAY': {
      const { npcId, newStrain } = event.payload;
      if (newState.npcs && npcId) {
        const npc = newState.npcs.find(n => n.id === npcId);
        if (npc && typeof newStrain === 'number') {
          (npc as any).soulStrain = newStrain;
        }
      }
      break;
    }
    case 'MANA_REGENERATED': {
      const { newMp } = event.payload;
      if (newState.player && typeof newMp === 'number') {
        newState.player.mp = newMp;
      }
      break;
    }
    case 'STATUS_EFFECT_EXPIRED': {
      const { remainingEffects } = event.payload;
      if (newState.player && Array.isArray(remainingEffects)) {
        newState.player.statusEffects = [];
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
      const existing = newState.player.inventory.find(i => i.itemId === itemId && isStackableItem(i));
      if (existing && isStackableItem(existing)) {
        existing.quantity += quantity;
      } else {
        newState.player.inventory.push(createStackableItem(itemId, quantity));
      }
      break;
    }
    case 'ITEM_DROPPED': {
      const { itemId, quantity } = event.payload;
      if (!newState.player?.inventory) return newState;
      const idx = newState.player.inventory.findIndex(i => i.itemId === itemId && isStackableItem(i));
      if (idx !== -1) {
        const item = newState.player.inventory[idx];
        if (isStackableItem(item)) {
          item.quantity -= quantity;
          if (item.quantity <= 0) {
            newState.player.inventory.splice(idx, 1);
          }
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
      const existing = newState.player.inventory.find(i => i.itemId === resourceType && isStackableItem(i));
      if (existing && isStackableItem(existing)) {
        existing.quantity += quantity;
      } else {
        newState.player.inventory.push(createStackableItem(resourceType, quantity));
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
      const idx = newState.player.inventory.findIndex(i => i.itemId === itemId && isStackableItem(i));
      if (idx !== -1) {
        const item = newState.player.inventory[idx];
        if (isStackableItem(item)) {
          item.quantity -= quantity;
          if (item.quantity <= 0) {
            newState.player.inventory.splice(idx, 1);
          }
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
      // Flag character creation as complete - hard gate against accidental reversion
      newState.needsCharacterCreation = false;
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
    case 'COMBAT_STARTED': {
      const { participants, initiatorId } = event.payload;
      if (newState.combatState) {
        newState.combatState.active = true;
        newState.combatState.participants = participants || [];
        newState.combatState.initiator = initiatorId || '';
        newState.combatState.turnIndex = 0;
        newState.combatState.roundNumber = 0;
        newState.combatState.log = [];
      }
      break;
    }
    case 'COMBAT_ENDED': {
      if (newState.combatState) {
        newState.combatState.active = false;
        newState.combatState.participants = [];
        newState.combatState.turnIndex = 0;
      }
      break;
    }
    case 'COMBAT_LOG_ENTRY': {
      const { message } = event.payload;
      if (newState.combatState && message) {
        newState.combatState.log.push(message);
      }
      break;
    }
    case 'ACTOR_WAITED': {
      const { reason } = event.payload;
      if (newState.combatState) {
        newState.combatState.log.push(`Actor waited (${reason || 'no reason'})`);
      }
      break;
    }
    case 'SPELL_CAST': {
      const { targetId, damageDealt, healing, statusApplied } = event.payload;
      // Handle damage
      if (damageDealt && damageDealt > 0) {
        if (targetId === newState.player?.id) {
          // Spell hit the player
          newState.player.hp = Math.max(0, (newState.player.hp || 100) - damageDealt);
        } else {
          // Spell hit an NPC
          const targetNpc = newState.npcs?.find(n => n.id === targetId);
          if (targetNpc && targetNpc.hp !== undefined) {
            targetNpc.hp = Math.max(0, targetNpc.hp - damageDealt);
          }
        }
      }
      // Handle healing
      if (healing && healing > 0) {
        if (targetId === newState.player?.id) {
          // Player healed
          newState.player.hp = Math.min(newState.player.maxHp || 100, (newState.player.hp || 0) + healing);
        } else {
          // NPC healed
          const targetNpc = newState.npcs?.find(n => n.id === targetId);
          if (targetNpc && targetNpc.hp !== undefined && targetNpc.maxHp !== undefined) {
            targetNpc.hp = Math.min(targetNpc.maxHp, targetNpc.hp + healing);
          }
        }
      }
      // Handle status effect
      if (statusApplied) {
        if (targetId === newState.player?.id) {
          // Apply status to player
          if (!newState.player.statusEffects) {
            newState.player.statusEffects = [];
          }
          if (!newState.player.statusEffects.includes(statusApplied)) {
            newState.player.statusEffects.push(statusApplied);
          }
        } else {
          // Apply status to NPC
          const targetNpc = newState.npcs?.find(n => n.id === targetId);
          if (targetNpc) {
            if (!targetNpc.statusEffects) {
              targetNpc.statusEffects = [];
            }
            if (!targetNpc.statusEffects.includes(statusApplied)) {
              targetNpc.statusEffects.push(statusApplied);
            }
          }
        }
      }
      break;
    }
    case 'SPELL_CAST_FAILED': {
      // Log spell cast failure if needed
      // No state changes needed
      break;
    }
    case 'MANA_DRAINED': {
      const { newMp } = event.payload;
      if (newState.player && newMp !== undefined) {
        newState.player.mp = newMp;
      }
      break;
    }
    case 'DRAIN_MANA_FAILED': {
      // Log mana drain failure if needed
      // No state changes needed
      break;
    }
    case 'TRUTH_REVEALED': {
      const { entityType, entityId } = event.payload;
      if (newState.player) {
        if (!newState.player.knowledgeBase) {
          newState.player.knowledgeBase = new Set();
        }
        newState.player.knowledgeBase.add(`${entityType}:${entityId}`);
      }
      break;
    }
    case 'NPC_IDENTIFIED': {
      const { npcId } = event.payload;
      if (newState.player) {
        if (!newState.player.knowledgeBase) {
          newState.player.knowledgeBase = new Set();
        }
        newState.player.knowledgeBase.add(`npc:${npcId}`);
      }
      break;
    }
    case 'KNOWLEDGE_GAINED': {
      // ALPHA_M13 Step 1: Handle knowledge discovery events
      const { knowledgeKey, knowledgeType, knowledgeId } = event.payload;
      if (newState.player) {
        if (!newState.player.knowledgeBase) {
          newState.player.knowledgeBase = new Set();
        }
        // Add knowledge entry
        const key = knowledgeKey || `${knowledgeType}:${knowledgeId}`;
        newState.player.knowledgeBase.add(key);
      }
      break;
    }
    case 'IDENTIFY_FAILED': {
      // Could track failed identification attempts in beliefLayer
      // For now, just log the failure
      break;
    }
    case 'META_SUSPICION': {
      const { level } = event.payload;
      if (newState.player && newState.player.beliefLayer) {
        newState.player.beliefLayer.suspicionLevel = level;
      }
      break;
    }
    case 'FACTION_QUEST_COMPLETED': {
      const { factionId, reputationGain = 25, powerGain = 5 } = event.payload;
      
      // Apply faction reputation gain to player
      if (newState.player) {
        if (!newState.player.factionReputation) {
          newState.player.factionReputation = {};
        }
        newState.player.factionReputation[factionId] = 
          (newState.player.factionReputation[factionId] || 0) + reputationGain;
      }
      
      // Apply power shift to faction
      if (newState.factions) {
        const faction = newState.factions.find(f => f.id === factionId);
        if (faction) {
          faction.powerScore = Math.max(0, Math.min(100, faction.powerScore + powerGain));
        }
      }
      break;
    }
    case 'FACTION_COMBAT_VICTORY': {
      const { victoryFactionId, defenderFactionId, reputationGain = 10, powerGain = 3 } = event.payload;
      
      // Apply reputation change for player (if victoryFactionId is 'player')
      if (victoryFactionId === 'player' && newState.player) {
        if (!newState.player.factionReputation) {
          newState.player.factionReputation = {};
        }
        // Gain rep with friendly faction, lose rep with enemy faction
        if (defenderFactionId) {
          newState.player.factionReputation[defenderFactionId] = 
            (newState.player.factionReputation[defenderFactionId] || 0) - reputationGain;
        }
      }
      
      // Apply power shift: increase victor faction, decrease loser faction
      if (newState.factions) {
        // Decrease defeated NPC's faction power
        if (defenderFactionId) {
          const defenderFaction = newState.factions.find(f => f.id === defenderFactionId);
          if (defenderFaction) {
            defenderFaction.powerScore = Math.max(0, Math.min(100, defenderFaction.powerScore - powerGain));
          }
        }
        
        // Could increase player's faction power here if player has a faction
        // For now, just apply the penalty to defender's faction
      }
      break;
    }
    case 'FACTION_POWER_SHIFT': {
      const { factionId, delta } = event.payload;
      
      if (newState.factions) {
        const faction = newState.factions.find(f => f.id === factionId);
        if (faction) {
          faction.powerScore = Math.max(0, Math.min(100, faction.powerScore + delta));
        }
      }
      break;
    }
    case 'FACTION_STRUGGLE': {
      // FACTION_STRUGGLE events are generated by worldEngine during faction ticks
      // State rebuilder just needs to acknowledge them
      // The actual conflict resolution happens in worldEngine's advanceTick
      break;
    }
    case 'LOCATION_CONTROL_CHANGED': {
      const { locationId, newFactionId } = event.payload;
      
      if (newState.factions) {
        // Find faction that now controls this location
        const newControllingFaction = newState.factions.find(f => f.id === newFactionId);
        if (newControllingFaction) {
          // Add location to controlled list if not already there
          if (!newControllingFaction.controlledLocationIds) {
            newControllingFaction.controlledLocationIds = [];
          }
          if (!newControllingFaction.controlledLocationIds.includes(locationId)) {
            newControllingFaction.controlledLocationIds.push(locationId);
          }
          
          // Remove location from all other factions
          newState.factions.forEach(f => {
            if (f.id !== newFactionId && f.controlledLocationIds) {
              f.controlledLocationIds = f.controlledLocationIds.filter(loc => loc !== locationId);
            }
          });
        }
      }
      break;
    }
    case 'TEMPORAL_PARADOX': {
      const { debtIncrease, ticksRewound } = event.payload;
      if (newState.player) {
        // Apply temporal debt
        const currentDebt = newState.player.temporalDebt || 0;
        newState.player.temporalDebt = Math.min(100, currentDebt + (debtIncrease || 0));
        
        // Boost suspicion from rewind
        if (newState.player.beliefLayer) {
          const currentSuspicion = newState.player.beliefLayer.suspicionLevel || 0;
          const suspicionBoost = Math.floor((debtIncrease || 0) * 0.3);
          newState.player.beliefLayer.suspicionLevel = Math.min(100, currentSuspicion + suspicionBoost);
        }
      }
      break;
    }
    case 'PARADOX_STRIKE': {
      const { damage, temporalCost } = event.payload;
      if (newState.player) {
        // Apply damage to player (soul/spirit damage from paradox)
        if (damage && damage > 0) {
          newState.player.hp = Math.max(0, (newState.player.hp || 100) - damage);
        }
        // Increase temporal debt
        const currentDebt = newState.player.temporalDebt || 0;
        newState.player.temporalDebt = Math.min(100, currentDebt + (temporalCost || 5));
      }
      break;
    }
    case 'CHAOS_ANOMALY': {
      const { type: anomalyType } = event.payload;
      if (anomalyType === 'npc_location_drift') {
        // Randomly shift an NPC's location (glitch effect)
        if (newState.npcs && newState.npcs.length > 0) {
          const randomNpc = newState.npcs[Math.floor(random() * newState.npcs.length)];
          const randomLocation = newState.locations[Math.floor(random() * newState.locations.length)];
          if (randomLocation) {
            randomNpc.locationId = randomLocation.id;
          }
        }
      }
      break;
    }
    case 'GHOST_TICK': {
      const { ticksSkipped } = event.payload;
      if (ticksSkipped && ticksSkipped > 0) {
        newState.hour = (newState.hour + ticksSkipped) % 24;
        newState.tick = (newState.tick || 0) + ticksSkipped;
      }
      break;
    }
    case 'REVOLT_OF_TRUTH': {
      const { consequence } = event.payload;
      
      if (newState.player) {
        // Boost temporal debt severely
        const currentDebt = newState.player.temporalDebt || 0;
        newState.player.temporalDebt = Math.min(100, currentDebt + 20);
        
        // If OBFUSCATION_INVERSION, reset identification for some NPCs
        if (consequence === 'OBFUSCATION_INVERSION' && newState.player.knowledgeBase) {
          const npcIdentifications = Array.from(newState.player.knowledgeBase)
            .filter(item => item.startsWith('npc:'))
            .slice(0, Math.floor(newState.npcs.length * 0.3));  // Forget 30% of NPCs
          
          npcIdentifications.forEach(id => {
            newState.player.knowledgeBase!.delete(id);
          });
        }
      }
      break;
    }
    case 'AUTHORITY_INTERVENTION': {
      // Record the intervention but don't mutate state
      // The event is logged for narrative purposes
      if (newState.player?.dialogueHistory) {
        newState.player.dialogueHistory.push({
          npcId: 'COSMOS',
          text: event.payload?.interventionText || 'The universe refuses.',
          timestamp: event.timestamp
        });
      }
      break;
    }
    case 'UNNAMED_ENTITY_SPAWN': {
      // Reality glitch: entity appears briefly (visual only, doesn't interact)
      // For now just boost chaos indicators
      if (newState.player?.beliefLayer) {
        newState.player.beliefLayer.suspicionLevel = Math.min(
          100,
          (newState.player.beliefLayer.suspicionLevel || 0) + 5
        );
      }
      break;
    }
    case 'MINOR_GLITCH': {
      // Low-impact anomaly: just noise
      break;
    }
    case 'MORPH_SUCCESS': {
      // Phase 13: Successful morph - apply stat changes and soul strain
      const { toRace, statChanges, soulStrainGain, newSoulStrain } = event.payload;
      if (newState.player) {
        // Update race
        newState.player.currentRace = toRace;
        
        // Apply stat changes
        if (statChanges && newState.player.stats) {
          if (statChanges.str !== undefined) newState.player.stats.str = statChanges.str;
          if (statChanges.agi !== undefined) newState.player.stats.agi = statChanges.agi;
          if (statChanges.int !== undefined) newState.player.stats.int = statChanges.int;
          if (statChanges.cha !== undefined) newState.player.stats.cha = statChanges.cha;
          if (statChanges.end !== undefined) newState.player.stats.end = statChanges.end;
          if (statChanges.luk !== undefined) newState.player.stats.luk = statChanges.luk;
        }
        
        // Apply soul strain
        newState.player.soulStrain = newSoulStrain || 0;
        newState.player.lastMorphTick = event.timestamp;
        
        // Increment recent morph count (used for cooldown multiplier)
        newState.player.recentMorphCount = (newState.player.recentMorphCount || 0) + 1;
      }
      break;
    }
    case 'MORPH_FAILURE': {
      // Phase 13: Morph backfired - apply lesser soul strain
      const { soulStrainGain, newSoulStrain } = event.payload;
      if (newState.player) {
        newState.player.soulStrain = newSoulStrain || 0;
        newState.player.lastMorphTick = event.timestamp;
        newState.player.recentMorphCount = (newState.player.recentMorphCount || 0) + 1;
      }
      break;
    }
    case 'VESSEL_SHATTER': {
      // Phase 13: Critical morph failure - shattering reality
      const { soulStrainGain } = event.payload;
      if (newState.player) {
        // Severe soul strain
        newState.player.soulStrain = Math.min(100, (newState.player.soulStrain || 0) + soulStrainGain);
        
        // Temporarily forget some NPC identifications (30%)
        if (newState.player.knowledgeBase && newState.player.knowledgeBase.size > 0) {
          const npcEntries = Array.from(newState.player.knowledgeBase).filter(k => k.startsWith('npc:'));
          const forgotCount = Math.ceil(npcEntries.length * 0.3);
          for (let i = 0; i < forgotCount; i++) {
            const randIdx = Math.floor(random() * npcEntries.length);
            newState.player.knowledgeBase.delete(npcEntries[randIdx]);
          }
        }
        
        // Location briefly corrupted (visual effect, could track in metadata)
        newState.player.lastMorphTick = event.timestamp;
        newState.player.recentMorphCount = (newState.player.recentMorphCount || 0) + 1;
      }
      break;
    }
    case 'ESSENCE_DECAY': {
      // Phase 13: High soul strain causes permanent stat penalties
      const { penaltyAmount } = event.payload;
      if (newState.player && newState.player.stats) {
        newState.player.stats.str = Math.max(1, (newState.player.stats.str || 10) - penaltyAmount);
        newState.player.stats.agi = Math.max(1, (newState.player.stats.agi || 10) - penaltyAmount);
        newState.player.stats.int = Math.max(1, (newState.player.stats.int || 10) - penaltyAmount);
        newState.player.stats.cha = Math.max(1, (newState.player.stats.cha || 10) - penaltyAmount);
        newState.player.stats.end = Math.max(1, (newState.player.stats.end || 10) - penaltyAmount);
        newState.player.stats.luk = Math.max(1, (newState.player.stats.luk || 10) - penaltyAmount);
      }
      break;
    }
    case 'TRAVEL_STARTED': {
      // Phase 14: Begin travel to new location
      const { fromLocation, toLocation, estimatedTicks } = event.payload;
      if (newState) {
        newState.travelState = {
          isTraveling: true,
          fromLocationId: fromLocation,
          toLocationId: toLocation,
          remainingTicks: estimatedTicks,
          ticksPerTravelSession: estimatedTicks,
          encounterRolled: false
        };
      }
      break;
    }
    case 'TRAVEL_TICK': {
      // Phase 14: Process travel tick
      const { remainingTicks } = event.payload;
      if (newState && newState.travelState) {
        newState.travelState.remainingTicks = Math.max(0, remainingTicks);
        if (remainingTicks <= 0) {
          // Arrived at destination
          newState.player.location = newState.travelState.toLocationId;
          newState.travelState.isTraveling = false;
        }
      }
      break;
    }
    case 'ENCOUNTER_TRIGGERED': {
      // Phase 14: Encounter triggered during travel
      const { encounterName, npcId } = event.payload;
      if (newState) {
        newState.activeEncounter = {
          id: `encounter-${Date.now()}`,
          npcId,
          type: event.payload.encounterType,
          spawnedAt: event.timestamp
        };
      }
      break;
    }
    case 'LOCATION_DISCOVERED': {
      // Phase 14: Hidden area discovered
      const { areaId } = event.payload;
      if (newState.player && newState.player.discoveredSecrets) {
        newState.player.discoveredSecrets.add(areaId);
      }
      break;
    }
    case 'SEARCH_FAILED': {
      // Phase 14: Search attempt failed - no state change needed
      break;
    }
    case 'SEARCH_NO_SECRETS': {
      // Phase 14: No secrets at location - no state change needed
      break;
    }
    
    case 'SUB_AREA_DISCOVERED': {
      // M9 Phase 3: Sub-area (hidden depths) discovered
      const { subAreaId, parentLocation } = event.payload;
      
      // Mark sub-area as discovered in parent location
      if (newState.locations && parentLocation) {
        const location = newState.locations.find(loc => loc.id === parentLocation);
        if (location && location.subAreas) {
          const subArea = location.subAreas.find(sa => sa.id === subAreaId);
          if (subArea) {
            subArea.discovered = true;
          }
        }
      }
      
      // Also track in player's discovered secrets
      if (newState.player && newState.player.discoveredSecrets) {
        newState.player.discoveredSecrets.add(subAreaId);
      }
      break;
    }

    case 'RUNE_INFUSED': {
      // Phase 15: A rune was successfully infused into a relic
      const { relicId, runeId } = event.payload;
      if (newState.relics && newState.relics[relicId]) {
        // Update relic's corruption if provided
        if (event.payload.corruption !== undefined) {
          (newState.relics[relicId] as any).corruption = event.payload.corruption;
        }
        // Stability tracking is implicit in relicEvents
        if (!newState.relicEvents) {
          newState.relicEvents = [];
        }
        newState.relicEvents.push({
          type: 'infused',
          relicId,
          tick: event.timestamp,
          message: event.payload.message
        });
      }
      break;
    }

    case 'CORRUPTION_FLARE': {
      // ALPHA_M2: Relic corruption reached critical level
      // Payload: { relicId, relicName, corruption, message, triggerDirector }
      const { relicId } = event.payload;
      if (newState.relics && newState.relics[relicId]) {
        (newState.relics[relicId] as any).corruption = event.payload.corruption;
      }
      // Store in metadata for UI/narrative tracking
      if (!newState.metadata) {
        newState.metadata = {};
      }
      newState.metadata.lastCorruptionFlare = {
        relicId,
        relicName: event.payload.relicName,
        corruption: event.payload.corruption,
        tick: event.timestamp,
        message: event.payload.message
      };
      break;
    }

    case 'RELIC_BOUND': {
      // Phase 15: A relic was successfully bound to the player
      const { relicId, soulStrain: boundSoulStrain } = event.payload;
      if (newState.player && newState.relics?.[relicId]) {
        newState.player.boundRelicId = relicId;
        newState.relics[relicId].isBound = true;
        newState.relics[relicId].ownerId = newState.player.id;
        newState.relics[relicId].boundSoulStrain = boundSoulStrain;

        // Log the relic event
        if (!newState.relicEvents) {
          newState.relicEvents = [];
        }
        newState.relicEvents.push({
          type: 'bound',
          relicId,
          tick: event.timestamp,
          message: event.payload.message
        });
      }
      break;
    }

    case 'RELIC_UNBOUND': {
      // Phase 15: A relic was successfully unbound from the player
      const { relicId, soulStrainCost } = event.payload;
      if (newState.player && newState.relics?.[relicId]) {
        newState.player.boundRelicId = undefined;
        newState.relics[relicId].isBound = false;
        if (newState.player.soulStrain) {
          newState.player.soulStrain += soulStrainCost;
        }

        // Log the relic event
        if (!newState.relicEvents) {
          newState.relicEvents = [];
        }
        newState.relicEvents.push({
          type: 'unbound',
          relicId,
          tick: event.timestamp,
          message: event.payload.message
        });
      }
      break;
    }

    case 'INFUSION_FAILED': {
      // Phase 15: Infusion attempt failed - log but no state change
      if (!newState.relicEvents) {
        newState.relicEvents = [];
      }
      newState.relicEvents.push({
        type: 'infusion_failed',
        relicId: event.payload.relicId || 'unknown',
        tick: event.timestamp,
        message: event.payload.message
      });
      break;
    }

    case 'BINDING_FAILED': {
      // Phase 15: Binding attempt failed - log but no state change
      if (!newState.relicEvents) {
        newState.relicEvents = [];
      }
      newState.relicEvents.push({
        type: 'binding_failed',
        relicId: event.payload.relicId || 'unknown',
        tick: event.timestamp,
        message: event.payload.message
      });
      break;
    }

    case 'UNBINDING_FAILED': {
      // Phase 15: Unbinding attempt failed - log but no state change
      if (!newState.relicEvents) {
        newState.relicEvents = [];
      }
      newState.relicEvents.push({
        type: 'unbinding_failed',
        relicId: event.payload.relicId || 'unknown',
        tick: event.timestamp,
        message: event.payload.message
      });
      break;
    }

    case 'INVARIANT_VIOLATION': {
      // Log constraint violation for audit trail
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.violationLog) {
        newState.metadata.violationLog = [];
      }
      newState.metadata.violationLog.push({
        tick: event.timestamp,
        violations: event.payload.violations || [],
        errorMessage: event.payload.error
      });
      console.warn('[StateRebuilder] Invariant violation recorded:', event.payload);
      break;
    }

    case 'ITEM_USED': {
      const { itemId } = event.payload;
      if (!newState.player?.inventory) break;
      
      // Remove item from inventory
      const idx = newState.player.inventory.findIndex(i => i.itemId === itemId && isStackableItem(i));
      if (idx !== -1) {
        const item = newState.player.inventory[idx];
        if (isStackableItem(item)) {
          item.quantity -= 1;
          if (item.quantity <= 0) {
            newState.player.inventory.splice(idx, 1);
          }
        }
      }
      
      // Apply item effects based on itemId
      if (itemId === 'healing-potion-minor') {
        const healAmount = 25;
        newState.player.hp = Math.min(newState.player.maxHp || 100, (newState.player.hp || 0) + healAmount);
      } else if (itemId === 'mana-potion-minor') {
        const restoreAmount = 30;
        newState.player.mp = Math.min(newState.player.maxMp || 50, (newState.player.mp || 0) + restoreAmount);
      } else if (itemId === 'healing-potion-major') {
        const healAmount = 60;
        newState.player.hp = Math.min(newState.player.maxHp || 100, (newState.player.hp || 0) + healAmount);
      } else if (itemId === 'mana-potion-major') {
        const restoreAmount = 80;
        newState.player.mp = Math.min(newState.player.maxMp || 50, (newState.player.mp || 0) + restoreAmount);
      }
      break;
    }

    case 'PLAYER_DEFEATED': {
      // Respawn logic: teleport player back to starting location and restore HP
      const startingLocation = 'Eldergrove Village';
      newState.player.location = startingLocation;
      newState.player.hp = Math.ceil((newState.player.maxHp || 100) * 0.5); // Restore 50% HP
      break;
    }

    case 'NARRATIVE_STIMULUS': {
      // Director emitted a narrative stimulus - update tension tracking
      // Payload: { stimulus, reason, inactionDuration, currentTension }
      if (!newState.metadata) {
        newState.metadata = {};
      }
      newState.metadata.lastNarrativeStimulus = {
        type: event.payload.stimulus,
        reason: event.payload.reason,
        tick: event.timestamp,
      };
      break;
    }

    case 'TEMPORAL_ANOMALY': {
      // Director detected high temporal debt and created an anomaly
      // Payload: { anomaly, temporalDebtLevel, manifestation, locationId }
      // This should trigger hazard creation or NPC spawn at player location
      if (!newState.metadata) {
        newState.metadata = {};
      }
      newState.metadata.lastTemporalAnomaly = {
        type: event.payload.anomaly.type,
        severity: event.payload.anomaly.severity,
        tick: event.timestamp,
        locationId: event.payload.locationId,
      };
      
      // Optionally: Create a hazard at player location
      // This would be synced with hazardEngine in full implementation
      break;
    }

    case 'NPC_GUIDED_MOVEMENT': {
      // Director orchestrated NPC movement (Magnet Effect)
      // Payload: { npcId, npcName, from, to, reason, distance }
      const { npcId, to: targetLocation } = event.payload;
      const npcIdx = newState.npcs.findIndex(n => n.id === npcId);
      if (npcIdx !== -1) {
        newState.npcs[npcIdx] = {
          ...newState.npcs[npcIdx],
          locationId: targetLocation,
        };
      }
      break;
    }

    case 'RELIC_WHISPER': {
      // Sentient relic dialogue from Director
      // Payload: { relicId, relicName, dialogue, context, sentienceLevel }
      // No state change - purely narrative
      if (!newState.metadata) {
        newState.metadata = {};
      }
      newState.metadata.lastRelicWhisper = {
        relicId: event.payload.relicId,
        relicName: event.payload.relicName,
        tick: event.timestamp,
      };
      break;
    }

    case 'RELIC_REBELLION': {
      // Director-detected relic rebellion (same as RELIC_REBELLION_AUTO)
      // Payload: { relicId, relicName, message, effect, paradoxLevel, rebellionCounter }
      // Effects are handled in UI layer and stateRebuilder doesn't change core state
      break;
    }

    case 'RELIC_REBELLION_AUTO': {
      // Automatic relic rebellion from high paradox
      // Payload: { relicId, relicName, message, effect, paradoxLevel }
      if (event.payload.effect === 'strike') {
        // Apply damage to player
        newState.player.hp = Math.max(0, (newState.player.hp ?? 0) - 10);
      }
      // disable_bonuses and reverse_bonuses are UI-side effects
      break;
    }

    case 'WORLD_EVENT': {
      // ALPHA_M3: Faction-driven world events
      // Payload: { message, trigger, conflictType, tension, worldEventType }
      if (!newState.metadata) {
        newState.metadata = {};
      }
      newState.metadata.lastWorldEvent = {
        message: event.payload.message,
        worldEventType: event.payload.worldEventType,
        conflictType: event.payload.conflictType,
        tick: event.timestamp,
      };
      break;
    }

    case 'FACTION_POWER_SHIFT': {
      // ALPHA_M3: Faction power has changed
      // Payload: { factionId, factionName, reason, powerBefore, powerAfter, delta }
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.factionEvents) {
        newState.metadata.factionEvents = [];
      }
      newState.metadata.factionEvents.push({
        type: 'power-shift',
        factionId: event.payload.factionId,
        factionName: event.payload.factionName,
        delta: event.payload.delta,
        tick: event.timestamp
      });
      break;
    }

    case 'FACTION_CONFLICT_STARTED': {
      // ALPHA_M3: New faction conflict has begun
      // Payload: { conflictId, factionA, factionB, conflictType, message }
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.factionEvents) {
        newState.metadata.factionEvents = [];
      }
      newState.metadata.factionEvents.push({
        type: 'conflict-started',
        conflictId: event.payload.conflictId,
        factionA: event.payload.factionA,
        factionB: event.payload.factionB,
        conflictType: event.payload.conflictType,
        tick: event.timestamp
      });
      break;
    }

    case 'FACTION_CONFLICT_RESOLVED': {
      // ALPHA_M3: Faction conflict has ended
      // Payload: { conflictId, winner, loser, conflictType }
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.factionEvents) {
        newState.metadata.factionEvents = [];
      }
      newState.metadata.factionEvents.push({
        type: 'conflict-resolved',
        conflictId: event.payload.conflictId,
        winner: event.payload.winner,
        loser: event.payload.loser,
        conflictType: event.payload.conflictType,
        tick: event.timestamp
      });
      break;
    }

    // ALPHA_M4: Status Effect Management with Duration Tracking
    case 'STATUS_APPLIED_WITH_DURATION': {
      const { targetId, statusEffect, duration } = event.payload;
      const currentTick = newState.tick || 0;
      const expirationTick = currentTick + duration;

      // Initialize metadata for status tracking if needed
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.activeStatusEffects) {
        newState.metadata.activeStatusEffects = {};
      }

      // Track the status effect with expiration tick
      if (targetId === newState.player.id) {
        if (!newState.player.statusEffects) {
          newState.player.statusEffects = [];
        }
        if (!newState.player.statusEffects.includes(statusEffect)) {
          newState.player.statusEffects.push(statusEffect);
        }
        // Store expiration tick
        (newState.metadata.activeStatusEffects as any)[`player.${statusEffect}`] = expirationTick;
      } else {
        // Apply to NPC
        const npc = newState.npcs.find(n => n.id === targetId);
        if (npc) {
          if (!npc.statusEffects) {
            npc.statusEffects = [];
          }
          if (!npc.statusEffects.includes(statusEffect)) {
            npc.statusEffects.push(statusEffect);
          }
          // Store expiration tick
          (newState.metadata.activeStatusEffects as any)[`${targetId}.${statusEffect}`] = expirationTick;
        }
      }
      break;
    }

    // ALPHA_M4: Status Effect Expiration Check and Cleanup
    case 'STATUS_EFFECT_TICK': {
      const currentTick = newState.tick || 0;
      
      if (!newState.metadata?.activeStatusEffects) {
        break;
      }

      const activeEffects = newState.metadata.activeStatusEffects as any;
      const expiredEffects: string[] = [];

      // Check for expired status effects
      for (const key in activeEffects) {
        if (activeEffects[key] <= currentTick) {
          expiredEffects.push(key);
        }
      }

      // Remove expired status effects from player
      for (const key of expiredEffects) {
        if (key.startsWith('player.')) {
          const statusEffect = key.substring(7); // Remove 'player.' prefix
          if (newState.player.statusEffects) {
            const idx = newState.player.statusEffects.indexOf(statusEffect);
            if (idx !== -1) {
              newState.player.statusEffects.splice(idx, 1);
            }
          }
          delete activeEffects[key];
        } else {
          // Remove from NPC
          const [npcId, statusEffect] = key.split('.');
          const npc = newState.npcs.find(n => n.id === npcId);
          if (npc && npc.statusEffects) {
            const idx = npc.statusEffects.indexOf(statusEffect);
            if (idx !== -1) {
              npc.statusEffects.splice(idx, 1);
            }
          }
          delete activeEffects[key];
        }
      }
      break;
    }

    // ALPHA_M4: Track turn skips for stunned NPCs
    case 'STUNNED_NPC_SKIP': {
      const { npcId, reason } = event.payload;
      // NPC with STUNNED/DAZED status automatically skips their turn
      // This is informational; actual skip is handled in aiTacticEngine
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.stunnedSkips) {
        newState.metadata.stunnedSkips = [];
      }
      (newState.metadata.stunnedSkips as any).push({
        npcId,
        reason,
        tick: newState.tick || 0
      });
      break;
    }

    // ALPHA_M4: Apply stat penalties from status effects (info tracking)
    case 'STAT_PENALTY_APPLIED': {
      const { targetId, statusEffect, penaltyStats } = event.payload;
      // This event will be used by UI to show stat reductions
      // Actual penalty enforcement happens in combat calculation via status checks
      if (!newState.metadata) {
        newState.metadata = {};
      }
      if (!newState.metadata.statPenalties) {
        newState.metadata.statPenalties = {};
      }
      (newState.metadata.statPenalties as any)[targetId] = {
        statusEffect,
        penalties: penaltyStats,
        tick: newState.tick || 0
      };
      break;
    }

    // ALPHA_M9: Location discovery
    case 'DISCOVER_LOCATION':
    case 'LOCATION_DISCOVERED': {
      const { locationId } = event.payload;
      if (locationId && newState.locations) {
        const location = newState.locations.find(l => l.id === locationId);
        if (location) {
          location.discovered = true;
        }
      }
      break;
    }

    // ALPHA_M9: Level up grants skill points
    case 'PLAYER_LEVELED_UP': {
      const { newLevel, skillPointsGranted = 0, attributePointsGranted = 0 } = event.payload;
      if (newState.player) {
        newState.player.level = newLevel;
        newState.player.skillPoints = (newState.player.skillPoints ?? 0) + skillPointsGranted;
        newState.player.attributePoints = (newState.player.attributePoints ?? 0) + attributePointsGranted;
      }
      break;
    }

    // ALPHA_M9: Skill point spending
    case 'ABILITY_UNLOCKED': {
      const { abilityId, skillPointsSpent } = event.payload;
      if (newState.player) {
        if (!newState.player.unlockedAbilities) {
          newState.player.unlockedAbilities = [];
        }
        if (!newState.player.unlockedAbilities.includes(abilityId)) {
          newState.player.unlockedAbilities.push(abilityId);
        }
        newState.player.skillPoints = Math.max(0, (newState.player.skillPoints ?? 0) - skillPointsSpent);
      }
      break;
    }

    // ALPHA_M9: Ability equipment
    case 'ABILITY_EQUIPPED': {
      const { abilityId } = event.payload;
      if (newState.player) {
        if (!newState.player.equippedAbilities) {
          newState.player.equippedAbilities = [];
        }
        if (!newState.player.equippedAbilities.includes(abilityId)) {
          newState.player.equippedAbilities.push(abilityId);
        }
      }
      break;
    }

    // ALPHA_M9: Ability activation
    case 'ABILITY_ACTIVATED': {
      const { abilityId, manaCost, newHp } = event.payload;
      if (newState.player) {
        // Deduct mana
        if (manaCost !== undefined && manaCost > 0) {
          newState.player.mp = Math.max(0, (newState.player.mp ?? 0) - manaCost);
        }
        // Set HP if ability is healing
        if (newHp !== undefined) {
          newState.player.hp = newHp;
        }
      }
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

/**
 * Validate replay integrity against a snapshot
 * Detects bit-drift and critical state mismatches
 * Used by OracleView dev tool for determinism validation
 */
export function validateReplayIntegrity(
  replayedState: WorldState,
  snapshotState: WorldState
): { valid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];

  // Check basic state properties
  if (replayedState.tick !== snapshotState.tick) {
    discrepancies.push(`Tick mismatch: ${replayedState.tick} vs ${snapshotState.tick}`);
  }

  // Check player state (critical)
  if (replayedState.player?.hp !== snapshotState.player?.hp) {
    discrepancies.push(`Player HP mismatch: ${replayedState.player?.hp} vs ${snapshotState.player?.hp}`);
  }
  if (replayedState.player?.mp !== snapshotState.player?.mp) {
    discrepancies.push(`Player MP mismatch: ${replayedState.player?.mp} vs ${snapshotState.player?.mp}`);
  }
  if (replayedState.player?.location !== snapshotState.player?.location) {
    discrepancies.push(`Player location mismatch: ${replayedState.player?.location} vs ${snapshotState.player?.location}`);
  }
  if ((replayedState.player?.gold || 0) !== (snapshotState.player?.gold || 0)) {
    discrepancies.push(`Player gold mismatch: ${replayedState.player?.gold} vs ${snapshotState.player?.gold}`);
  }

  // Check NPC state (critical for determinism)
  if ((replayedState.npcs?.length || 0) !== (snapshotState.npcs?.length || 0)) {
    discrepancies.push(`NPC count mismatch: ${replayedState.npcs?.length} vs ${snapshotState.npcs?.length}`);
  } else {
    for (let i = 0; i < (replayedState.npcs?.length || 0); i++) {
      const rNpc = replayedState.npcs?.[i];
      const sNpc = snapshotState.npcs?.[i];

      if (rNpc?.id !== sNpc?.id) {
        discrepancies.push(`NPC[${i}] ID mismatch: ${rNpc?.id} vs ${sNpc?.id}`);
      }
      if ((rNpc?.hp || 0) !== (sNpc?.hp || 0)) {
        discrepancies.push(`NPC[${i}] HP mismatch: ${rNpc?.hp} vs ${sNpc?.hp}`);
      }
      if (rNpc?.locationId !== sNpc?.locationId) {
        discrepancies.push(`NPC[${i}] location mismatch: ${rNpc?.locationId} vs ${sNpc?.locationId}`);
      }
    }
  }

  // Check faction state
  const replayedFactionCount = Object.keys(replayedState.factions || {}).length;
  const snapshotFactionCount = Object.keys(snapshotState.factions || {}).length;
  if (replayedFactionCount !== snapshotFactionCount) {
    discrepancies.push(`Faction count mismatch: ${replayedFactionCount} vs ${snapshotFactionCount}`);
  }

  // Check inventory
  if ((replayedState.player?.inventory?.length || 0) !== (snapshotState.player?.inventory?.length || 0)) {
    discrepancies.push(`Inventory size mismatch: ${replayedState.player?.inventory?.length} vs ${snapshotState.player?.inventory?.length}`);
  }

  // Check combat state if active
  if (replayedState.combatState?.active && snapshotState.combatState?.active) {
    if ((replayedState.combatState?.roundNumber || 0) !== (snapshotState.combatState?.roundNumber || 0)) {
      discrepancies.push(`Combat round mismatch: ${replayedState.combatState?.roundNumber} vs ${snapshotState.combatState?.roundNumber}`);
    }
  }

  const valid = discrepancies.length === 0;

  return { valid, discrepancies };
}