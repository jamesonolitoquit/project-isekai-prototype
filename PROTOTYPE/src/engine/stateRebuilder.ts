import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { random } from './prng';
import { createStackableItem, isStackableItem } from './worldEngine';

export interface RebuildResult {
  candidateState: WorldState;
}

/**
 * M40: Comprehensive event handler modularization
 * Reduces cognitive complexity, eliminates 84-case switch statement
 * Domain-specific handlers with clean dispatch pattern
 */
namespace EventHandlers {
  /**
   * Combat Event Handler
   * HIT, PARRY, SKILL_CHECK, HEAL, COMBAT_*, SPELL_CAST, MANA_*, STATUS_*
   */
  export function handleCombatEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'HIT':
      case 'COMBAT_HIT':
        if (newState.player) {
          newState.player.hp = Math.max(0, (newState.player.hp ?? 0) - (payload.damage ?? 0));
        }
        break;

      case 'PARRY':
      case 'COMBAT_PARRY': {
        if (newState.player) {
          const finalDmg = payload.finalDamage ?? 0;
          if (finalDmg > 0) {
            newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - finalDmg);
          }
        }
        break;
      }

      case 'COMBAT_BLOCK': {
        if (newState.player && payload.finalDamage && payload.finalDamage > 0) {
          newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - payload.finalDamage);
        }
        break;
      }

      case 'SKILL_CHECK':
        if (newState.player && payload.success) {
          newState.player.xp ??= 0;
          newState.player.xp += (payload.xpReward ?? 0);
        }
        break;

      case 'HEAL':
        if (newState.player) {
          newState.player.hp = Math.min(
            newState.player.maxHp ?? 100,
            (newState.player.hp ?? 0) + (payload.amount ?? 0)
          );
        }
        break;

      case 'PLAYER_HEALED': {
        if (newState.player) {
          const hpRestored = payload.hpRestored ?? 0;
          newState.player.hp = Math.min(
            newState.player.maxHp ?? 100,
            (newState.player.hp ?? 0) + hpRestored
          );
        }
        break;
      }

      case 'PLAYER_REST': {
        if (newState.player) {
          const hpRestored = payload.hpRestored ?? 0;
          newState.player.hp = Math.min(
            newState.player.maxHp ?? 100,
            (newState.player.hp ?? 0) + hpRestored
          );
          if (typeof payload.newMp === 'number') {
            newState.player.mp = payload.newMp;
          } else if (payload.mpRestored ?? 0 > 0) {
            newState.player.mp = Math.min(
              newState.player.maxMp ?? 0,
              (newState.player.mp ?? 0) + (payload.mpRestored ?? 0)
            );
          }
        }
        break;
      }

      case 'HAZARD_DAMAGE': {
        if (newState.player) {
          if (payload.damage && payload.damage > 0) {
            newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - payload.damage);
          }
          if (payload.statusApplied) {
            newState.player.statusEffects ??= [];
            if (!newState.player.statusEffects.includes(payload.statusApplied)) {
              newState.player.statusEffects.push(payload.statusApplied);
            }
          }
        }
        break;
      }

      case 'MANA_REGENERATED':
        if (newState.player && typeof payload.newMp === 'number') {
          newState.player.mp = payload.newMp;
        }
        break;

      case 'MANA_DRAINED':
        if (newState.player && typeof payload.newMp === 'number') {
          newState.player.mp = payload.newMp;
        }
        break;

      case 'DRAIN_MANA_FAILED':
      case 'SPELL_CAST_FAILED':
        // Log-only events
        break;

      case 'STATUS_APPLIED': {
        if (newState.player && payload.statusEffect) {
          newState.player.statusEffects ??= [];
          if (!newState.player.statusEffects.includes(payload.statusEffect)) {
            newState.player.statusEffects.push(payload.statusEffect);
          }
        }
        break;
      }

      case 'STATUS_EFFECT_EXPIRED':
        if (newState.player) {
          newState.player.statusEffects = [];
        }
        break;

      case 'SOUL_DECAY': {
        if (newState.player && typeof payload.newStrain === 'number') {
          newState.player.soulStrain = payload.newStrain;
        }
        break;
      }

      case 'NPC_SOUL_DECAY': {
        if (newState.npcs && payload.npcId) {
          const npc = newState.npcs.find(n => n.id === payload.npcId);
          if (npc && typeof payload.newStrain === 'number') {
            (npc as any).soulStrain = payload.newStrain;
          }
        }
        break;
      }

      case 'COMBAT_STARTED': {
        if (!newState.combatState) {
          newState.combatState = {} as any;
        }
        newState.combatState.active = true;
        newState.combatState.participants = payload.participants ?? [];
        newState.combatState.initiator = payload.initiatorId ?? '';
        newState.combatState.turnIndex = 0;
        newState.combatState.roundNumber = 0;
        newState.combatState.log = [];
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
        if (newState.combatState && payload.message) {
          newState.combatState.log ??= [];
          newState.combatState.log.push(payload.message);
        }
        break;
      }

      case 'ACTOR_WAITED': {
        if (newState.combatState) {
          newState.combatState.log ??= [];
          newState.combatState.log.push(`Actor waited (${payload.reason ?? 'no reason'})`);
        }
        break;
      }

      case 'SPELL_CAST': {
        const { targetId, damageDealt, healing, statusApplied } = payload;
        // Handle damage
        if (damageDealt && damageDealt > 0) {
          if (targetId === newState.player?.id) {
            newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - damageDealt);
          } else {
            const npc = newState.npcs?.find(n => n.id === targetId);
            if (npc?.hp !== undefined) {
              npc.hp = Math.max(0, npc.hp - damageDealt);
            }
          }
        }
        // Handle healing
        if (healing && healing > 0) {
          if (targetId === newState.player?.id) {
            newState.player.hp = Math.min(newState.player?.maxHp ?? 100, (newState.player?.hp ?? 0) + healing);
          } else {
            const npc = newState.npcs?.find(n => n.id === targetId);
            if (npc?.hp !== undefined && npc.maxHp !== undefined) {
              npc.hp = Math.min(npc.maxHp, npc.hp + healing);
            }
          }
        }
        // Handle status
        if (statusApplied) {
          if (targetId === newState.player?.id) {
            newState.player.statusEffects ??= [];
            if (!newState.player.statusEffects.includes(statusApplied)) {
              newState.player.statusEffects.push(statusApplied);
            }
          } else {
            const npc = newState.npcs?.find(n => n.id === targetId);
            if (npc) {
              npc.statusEffects ??= [];
              if (!npc.statusEffects?.includes(statusApplied)) {
                npc.statusEffects?.push(statusApplied);
              }
            }
          }
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Player Event Handler
   * MOVE, TICK, QUEST_*, REWARD, LEVEL_UP, REPUTATION_CHANGED, CHARACTER_CREATED
   */
  export function handlePlayerEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'MOVE': {
        if (newState.player) {
          newState.player.location = payload.to ?? payload.playerId;
        }
        break;
      }

      case 'TICK': {
        newState.hour = payload.newHour ?? newState.hour;
        newState.day = payload.newDay ?? newState.day;
        newState.season = payload.newSeason ?? newState.season;
        newState.tick ??= 0;
        newState.tick += 1;
        break;
      }

      case 'QUEST_STARTED': {
        if (newState.player?.quests) {
          const qId = payload.questId ?? '';
          newState.player.quests[qId] ??= {};
          newState.player.quests[qId].status = 'in_progress';
          newState.player.quests[qId].startedAt = event.timestamp;
        }
        break;
      }

      case 'QUEST_COMPLETED': {
        if (newState.player?.quests?.[payload.questId]) {
          newState.player.quests[payload.questId].status = 'completed';
          newState.player.quests[payload.questId].completedAt = newState.tick ?? 0;
        }
        break;
      }

      case 'QUEST_OBJECTIVE_ADVANCED': {
        if (newState.player?.quests?.[payload.questId]) {
          newState.player.quests[payload.questId].currentObjectiveIndex = payload.newObjective;
        }
        break;
      }

      case 'REWARD': {
        if (newState.player) {
          if (payload.type === 'gold') {
            newState.player.gold ??= 0;
            newState.player.gold += payload.amount ?? 0;
          } else if (payload.type === 'xp') {
            newState.player.xp ??= 0;
            newState.player.xp += payload.amount ?? 0;
          }
        }
        break;
      }

      case 'LEVEL_UP': {
        if (newState.player) {
          newState.player.level ??= 1;
          newState.player.level += 1;
        }
        break;
      }

      case 'XP_GAINED': {
        if (newState.player) {
          newState.player.xp ??= 0;
          newState.player.xp += payload.xpAmount ?? 0;
          // Auto level-up if XP exceeds threshold
          const level = newState.player.level ?? 1;
          const xpThreshold = level * 100;
          if (newState.player.xp >= xpThreshold) {
            newState.player.level = level + 1;
            newState.player.xp = 0;
            newState.player.attributePoints ??= 0;
            newState.player.attributePoints += 2;
          }
        }
        break;
      }

      case 'REPUTATION_CHANGED': {
        if (newState.player) {
          const fId = payload.factionId ?? payload.npcId;
          newState.player.reputation ??= {};
          newState.player.reputation[fId] ??= 0;
          newState.player.reputation[fId] += payload.amount ?? payload.delta ?? payload.newRep ?? 0;
        }
        break;
      }

      case 'REPUTATION_MILESTONE_REACHED':
        // Log-only event
        break;

      case 'CHARACTER_CREATED': {
        const character = structuredClone(payload.character);
        if (!character.hp || !character.maxHp) {
          const endStat = character.stats?.end ?? 10;
          const baseHp = 80 + endStat * 2;
          character.hp = baseHp;
          character.maxHp = baseHp;
        }
        character.statusEffects ??= [];
        character.quests = newState.player?.quests ?? {};
        character.gold ??= 0;
        character.reputation ??= {};
        newState.player = character;
        newState.needsCharacterCreation = false;
        break;
      }

      case 'INTERACT_NPC': {
        if (newState.player) {
          newState.player.dialogueHistory ??= [];
          newState.player.dialogueHistory.push({
            npcId: payload.npcId,
            text: payload.dialogueText,
            options: payload.options,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case 'STAT_ALLOCATED': {
        if (newState.player?.stats && payload.stat in newState.player.stats) {
          (newState.player.stats as any)[payload.stat] += payload.amount ?? 0;
          newState.player.attributePoints ??= 0;
          newState.player.attributePoints = Math.max(0, newState.player.attributePoints - (payload.amount ?? 0));
        }
        break;
      }

      case 'PLAYER_DEFEATED': {
        if (newState.player) {
          newState.player.location = 'Eldergrove Village';
          newState.player.hp = Math.ceil((newState.player.maxHp ?? 100) * 0.5);
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Inventory Event Handler
   * ITEM_*, RESOURCE_*
   */
  export function handleInventoryEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'ITEM_PICKED_UP': {
        if (!newState.player) break;
        newState.player.inventory ??= [];
        const existing = newState.player.inventory.find(
          i => i.itemId === payload.itemId && isStackableItem(i)
        );
        if (existing && isStackableItem(existing)) {
          existing.quantity += payload.quantity ?? 1;
        } else {
          newState.player.inventory.push(createStackableItem(payload.itemId, payload.quantity ?? 1));
        }
        break;
      }

      case 'ITEM_DROPPED': {
        if (!newState.player?.inventory) break;
        const idx = newState.player.inventory.findIndex(
          i => i.itemId === payload.itemId && isStackableItem(i)
        );
        if (idx !== -1) {
          const item = newState.player.inventory[idx];
          if (isStackableItem(item)) {
            item.quantity -= payload.quantity ?? 1;
            if (item.quantity <= 0) {
              newState.player.inventory.splice(idx, 1);
            }
          }
        }
        break;
      }

      case 'ITEM_EQUIPPED': {
        if (newState.player) {
          newState.player.equipment ??= {};
          const slot = 'mainHand';
          newState.player.equipment[slot as keyof typeof newState.player.equipment] = payload.itemId;
        }
        break;
      }

      case 'ITEM_UNEQUIPPED': {
        if (newState.player?.equipment) {
          (newState.player.equipment as any)[payload.slot] = undefined;
        }
        break;
      }

      case 'RESOURCE_GATHERED': {
        if (!newState.player) break;
        newState.player.inventory ??= [];
        const existing = newState.player.inventory.find(
          i => i.itemId === payload.resourceType && isStackableItem(i)
        );
        if (existing && isStackableItem(existing)) {
          existing.quantity += payload.quantity ?? 1;
        } else {
          newState.player.inventory.push(createStackableItem(payload.resourceType, payload.quantity ?? 1));
        }
        break;
      }

      case 'ITEM_CRAFTED':
        // Recipe application would require items.json lookup
        break;

      case 'ITEM_USED': {
        if (!newState.player?.inventory) break;
        const idx = newState.player.inventory.findIndex(
          i => i.itemId === payload.itemId && isStackableItem(i)
        );
        if (idx !== -1) {
          const item = newState.player.inventory[idx];
          if (isStackableItem(item)) {
            item.quantity -= payload.quantity ?? 1;
            if (item.quantity <= 0) {
              newState.player.inventory.splice(idx, 1);
            }
            // Apply item effects
            applyItemEffects(newState, payload.itemId);
          }
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Trade Event Handler
   * TRADE_*
   */
  export function handleTradeEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    (newState as any).tradeLog ??= [];

    switch (event.type) {
      case 'TRADE_INITIATED': {
        (newState as any).tradeLog.push({
          tradeId: payload.tradeId,
          initiator: payload.initiatorId,
          responder: payload.responderId,
          timestamp: event.timestamp,
          status: 'initiated'
        });
        break;
      }

      case 'TRADE_COMMITMENT': {
        const entry = (newState as any).tradeLog?.find((t: any) => t.tradeId === payload.tradeId);
        if (entry) {
          entry.status = 'committed';
          entry.committedAt = event.timestamp;
        }
        break;
      }

      case 'TRADE_COMPLETED': {
        if (!newState.player) break;
        const { initiatorId, responderId, initiatorItems, responderItems } = payload;
        const playerId = newState.player.id;
        const isInitiator = playerId === initiatorId;

        if (!newState.player.inventory) break;

        const itemsToRemove = isInitiator ? initiatorItems : responderItems;
        const itemsToAdd = isInitiator ? responderItems : initiatorItems;

        // Remove items
        for (const removeItem of itemsToRemove ?? []) {
          let qty = removeItem.quantity;
          for (let i = 0; i < newState.player.inventory.length && qty > 0; i++) {
            const item = newState.player.inventory[i];
            if (isStackableItem(item) && item.itemId === removeItem.itemId) {
              const removed = Math.min(qty, item.quantity);
              item.quantity -= removed;
              qty -= removed;
              if (item.quantity <= 0) {
                newState.player.inventory.splice(i, 1);
                i--;
              }
            }
          }
        }

        // Add items
        for (const addItem of itemsToAdd ?? []) {
          const existing = newState.player.inventory.find(
            i => i.itemId === addItem.itemId && isStackableItem(i)
          );
          if (existing && isStackableItem(existing)) {
            existing.quantity += addItem.quantity;
          } else {
            newState.player.inventory.push(createStackableItem(addItem.itemId, addItem.quantity));
          }
        }

        // Log completion
        const entry = (newState as any).tradeLog?.find((t: any) => t.tradeId === payload.tradeId);
        if (entry) {
          entry.status = 'completed';
          entry.completedAt = event.timestamp;
        }
        break;
      }

      case 'TRADE_CANCELLED': {
        const entry = (newState as any).tradeLog?.find((t: any) => t.tradeId === payload.tradeId);
        if (entry) {
          entry.status = 'cancelled';
          entry.cancelledAt = event.timestamp;
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Faction Event Handler
   * FACTION_*, LOCATION_CONTROL_CHANGED
   */
  export function handleFactionEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'FACTION_QUEST_COMPLETED': {
        if (newState.player) {
          newState.player.factionReputation ??= {};
          newState.player.factionReputation[payload.factionId] ??= 0;
          newState.player.factionReputation[payload.factionId] += payload.reputationGain ?? 25;
        }
        if (newState.factions) {
          const faction = newState.factions.find(f => f.id === payload.factionId);
          if (faction) {
            faction.powerScore = Math.max(0, Math.min(100, faction.powerScore + (payload.powerGain ?? 5)));
          }
        }
        break;
      }

      case 'FACTION_COMBAT_VICTORY': {
        if (payload.victoryFactionId === 'player' && newState.player) {
          newState.player.factionReputation ??= {};
          newState.player.factionReputation[payload.defenderFactionId] ??= 0;
          newState.player.factionReputation[payload.defenderFactionId] -= payload.reputationGain ?? 10;
        }
        if (newState.factions) {
          const defenderFaction = newState.factions.find(f => f.id === payload.defenderFactionId);
          if (defenderFaction) {
            defenderFaction.powerScore = Math.max(0, Math.min(100, defenderFaction.powerScore - (payload.powerGain ?? 3)));
          }
        }
        break;
      }

      case 'FACTION_POWER_SHIFT': {
        if (newState.factions) {
          const faction = newState.factions.find(f => f.id === payload.factionId);
          if (faction) {
            faction.powerScore = Math.max(0, Math.min(100, faction.powerScore + (payload.delta ?? 0)));
          }
        }
        break;
      }

      case 'FACTION_STRUGGLE':
        // Log-only event
        break;

      case 'LOCATION_CONTROL_CHANGED': {
        if (newState.factions) {
          const newFaction = newState.factions.find(f => f.id === payload.newFactionId);
          if (newFaction) {
            newFaction.controlledLocationIds ??= [];
            if (!newFaction.controlledLocationIds.includes(payload.locationId)) {
              newFaction.controlledLocationIds.push(payload.locationId);
            }
          }
          // Remove from other factions
          newState.factions.forEach(f => {
            if (f.id !== payload.newFactionId && f.controlledLocationIds) {
              f.controlledLocationIds = f.controlledLocationIds.filter(loc => loc !== payload.locationId);
            }
          });
        }
        break;
      }
    }
    return newState;
  }

  /**
   * World Event Handler
   * WORLD_EVENT_TRIGGERED, NODE_DEPLETED, LOCATION_DISCOVERED, etc.
   */
  export function handleWorldEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'WORLD_EVENT_TRIGGERED': {
        newState.activeEvents ??= [];
        const eventExists = newState.activeEvents.find(e => e.id === payload.eventId);
        if (!eventExists) {
          newState.activeEvents.push({
            id: payload.eventId,
            name: payload.eventId,
            type: 'climate-change',
            activeFrom: newState.tick ?? 0,
            activeTo: (newState.tick ?? 0) + 3600,
            effects: {}
          });
        }
        break;
      }

      case 'NODE_DEPLETED': {
        if (newState.resourceNodes) {
          const node = newState.resourceNodes.find(n => n.id === payload.nodeId);
          if (node) {
            node.depletedAt = newState.tick ?? 0;
          }
        }
        break;
      }

      case 'LOCATION_DISCOVERED': {
        if (newState.player) {
          newState.player.discoveredSecrets ??= new Set();
          newState.player.discoveredSecrets.add(payload.areaId);
        }
        break;
      }

      case 'SEARCH_FAILED':
      case 'SEARCH_NO_SECRETS':
        // Log-only
        break;

      case 'SUB_AREA_DISCOVERED': {
        if (newState.locations && payload.parentLocation) {
          const location = newState.locations.find(loc => loc.id === payload.parentLocation);
          if (location?.subAreas) {
            const subArea = location.subAreas.find(sa => sa.id === payload.subAreaId);
            if (subArea) {
              subArea.discovered = true;
            }
          }
        }
        if (newState.player) {
          newState.player.discoveredSecrets ??= new Set();
          newState.player.discoveredSecrets.add(payload.subAreaId);
        }
        break;
      }

      case 'ENCOUNTER_TRIGGERED': {
        newState.activeEncounter = {
          id: `encounter-${Date.now()}`,
          npcId: payload.npcId,
          type: payload.encounterType,
          spawnedAt: event.timestamp
        };
        break;
      }

      case 'TRAVEL_STARTED': {
        newState.travelState = {
          isTraveling: true,
          fromLocationId: payload.fromLocation,
          toLocationId: payload.toLocation,
          remainingTicks: payload.estimatedTicks,
          ticksPerTravelSession: payload.estimatedTicks,
          encounterRolled: false
        };
        break;
      }

      case 'TRAVEL_TICK': {
        if (newState.travelState) {
          newState.travelState.remainingTicks = Math.max(0, payload.remainingTicks ?? 0);
          if ((newState.travelState.remainingTicks ?? 0) <= 0) {
            if (newState.player) {
              newState.player.location = newState.travelState.toLocationId;
            }
            newState.travelState.isTraveling = false;
          }
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Arcane Event Handler
   * TEMPORAL_PARADOX, PARADOX_STRIKE, CHAOS_ANOMALY, MORPH_*, ESSENCE_DECAY
   */
  export function handleArcaneEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'TEMPORAL_PARADOX': {
        if (newState.player) {
          newState.player.temporalDebt ??= 0;
          newState.player.temporalDebt = Math.min(100, newState.player.temporalDebt + (payload.debtIncrease ?? 0));
          if (newState.player.beliefLayer) {
            const suspicionBoost = Math.floor((payload.debtIncrease ?? 0) * 0.3);
            newState.player.beliefLayer.suspicionLevel = Math.min(
              100,
              (newState.player.beliefLayer.suspicionLevel ?? 0) + suspicionBoost
            );
          }
        }
        break;
      }

      case 'PARADOX_STRIKE': {
        if (newState.player) {
          if (payload.damage && payload.damage > 0) {
            newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - payload.damage);
          }
          newState.player.temporalDebt ??= 0;
          newState.player.temporalDebt = Math.min(100, newState.player.temporalDebt + (payload.temporalCost ?? 5));
        }
        break;
      }

      case 'CHAOS_ANOMALY': {
        if (payload.type === 'npc_location_drift' && newState.npcs?.length) {
          const randomNpc = newState.npcs[Math.floor(random() * newState.npcs.length)];
          const randomLocation = newState.locations[Math.floor(random() * newState.locations.length)];
          if (randomLocation) {
            randomNpc.locationId = randomLocation.id;
          }
        }
        break;
      }

      case 'GHOST_TICK': {
        const ticksSkipped = payload.ticksSkipped ?? 0;
        if (ticksSkipped > 0) {
          newState.hour = (newState.hour + ticksSkipped) % 24;
          newState.tick ??= 0;
          newState.tick += ticksSkipped;
        }
        break;
      }

      case 'MORPH_SUCCESS': {
        if (newState.player) {
          newState.player.currentRace = payload.toRace;
          if (payload.statChanges && newState.player.stats) {
            Object.assign(newState.player.stats, payload.statChanges);
          }
          newState.player.soulStrain = payload.newSoulStrain ?? 0;
          newState.player.lastMorphTick = event.timestamp;
          newState.player.recentMorphCount ??= 0;
          newState.player.recentMorphCount += 1;
        }
        break;
      }

      case 'MORPH_FAILURE': {
        if (newState.player) {
          newState.player.soulStrain = payload.newSoulStrain ?? 0;
          newState.player.lastMorphTick = event.timestamp;
          newState.player.recentMorphCount ??= 0;
          newState.player.recentMorphCount += 1;
        }
        break;
      }

      case 'VESSEL_SHATTER': {
        if (newState.player) {
          newState.player.soulStrain ??= 0;
          newState.player.soulStrain = Math.min(100, newState.player.soulStrain + (payload.soulStrainGain ?? 0));
          // Forget 30% of NPCs
          if (newState.player.knowledgeBase?.size) {
            const npcEntries = Array.from(newState.player.knowledgeBase).filter(k => k.startsWith('npc:'));
            const forgotCount = Math.ceil(npcEntries.length * 0.3);
            for (let i = 0; i < forgotCount; i++) {
              const idx = Math.floor(random() * npcEntries.length);
              newState.player.knowledgeBase.delete(npcEntries[idx]);
            }
          }
          newState.player.lastMorphTick = event.timestamp;
          newState.player.recentMorphCount ??= 0;
          newState.player.recentMorphCount += 1;
        }
        break;
      }

      case 'ESSENCE_DECAY': {
        if (newState.player?.stats) {
          const penalty = payload.penaltyAmount ?? 1;
          for (const stat of ['str', 'agi', 'int', 'cha', 'end', 'luk'] as const) {
            newState.player.stats[stat] = Math.max(1, (newState.player.stats[stat] ?? 10) - penalty);
          }
        }
        break;
      }

      case 'REVOLT_OF_TRUTH': {
        if (newState.player) {
          newState.player.temporalDebt ??= 0;
          newState.player.temporalDebt = Math.min(100, newState.player.temporalDebt + 20);
          if (payload.consequence === 'OBFUSCATION_INVERSION' && newState.player.knowledgeBase) {
            const npcIds = Array.from(newState.player.knowledgeBase)
              .filter(item => item.startsWith('npc:'))
              .slice(0, Math.floor((newState.npcs?.length ?? 0) * 0.3));
            npcIds.forEach(id => newState.player.knowledgeBase?.delete(id));
          }
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Knowledge Event Handler
   * TRUTH_REVEALED, NPC_IDENTIFIED, META_SUSPICION
   */
  export function handleKnowledgeEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'TRUTH_REVEALED': {
        if (newState.player) {
          newState.player.knowledgeBase ??= new Set();
          newState.player.knowledgeBase.add(`${payload.entityType}:${payload.entityId}`);
        }
        break;
      }

      case 'NPC_IDENTIFIED': {
        if (newState.player) {
          newState.player.knowledgeBase ??= new Set();
          newState.player.knowledgeBase.add(`npc:${payload.npcId}`);
        }
        break;
      }

      case 'IDENTIFY_FAILED':
        // Log-only
        break;

      case 'META_SUSPICION': {
        if (newState.player?.beliefLayer) {
          newState.player.beliefLayer.suspicionLevel = payload.level ?? 0;
        }
        break;
      }
    }
    return newState;
  }

  /**
   * Relic Event Handler
   * RUNE_INFUSED, RELIC_BOUND, RELIC_UNBOUND, *_FAILED
   */
  export function handleRelicEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    (newState as any).relicEvents ??= [];

    switch (event.type) {
      case 'RUNE_INFUSED': {
        if (newState.relics?.[payload.relicId]) {
          ((newState as any).relicEvents as any[]).push({
            type: 'infused',
            relicId: payload.relicId,
            tick: event.timestamp,
            message: payload.message
          });
        }
        break;
      }

      case 'RELIC_BOUND': {
        if (newState.player && newState.relics?.[payload.relicId]) {
          newState.player.boundRelicId = payload.relicId;
          newState.relics[payload.relicId].isBound = true;
          newState.relics[payload.relicId].ownerId = newState.player.id;
          newState.relics[payload.relicId].boundSoulStrain = payload.soulStrain;
          ((newState as any).relicEvents as any[]).push({
            type: 'bound',
            relicId: payload.relicId,
            tick: event.timestamp,
            message: payload.message
          });
        }
        break;
      }

      case 'RELIC_UNBOUND': {
        if (newState.player && newState.relics?.[payload.relicId]) {
          newState.player.boundRelicId = undefined;
          newState.relics[payload.relicId].isBound = false;
          newState.player.soulStrain ??= 0;
          newState.player.soulStrain += payload.soulStrainCost ?? 0;
          ((newState as any).relicEvents as any[]).push({
            type: 'unbound',
            relicId: payload.relicId,
            tick: event.timestamp,
            message: payload.message
          });
        }
        break;
      }

      case 'INFUSION_FAILED':
      case 'BINDING_FAILED':
      case 'UNBINDING_FAILED': {
        ((newState as any).relicEvents as any[]).push({
          type: event.type.toLowerCase(),
          relicId: payload.relicId ?? 'unknown',
          tick: event.timestamp,
          message: payload.message
        });
        break;
      }
    }
    return newState;
  }

  /**
   * Narrative Event Handler
   * AUTHORITY_INTERVENTION, UNNAMED_ENTITY_SPAWN, MINOR_GLITCH
   */
  export function handleNarrativeEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    switch (event.type) {
      case 'AUTHORITY_INTERVENTION': {
        if (newState.player) {
          newState.player.dialogueHistory ??= [];
          newState.player.dialogueHistory.push({
            npcId: 'COSMOS',
            text: payload.interventionText ?? 'The universe refuses.',
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case 'UNNAMED_ENTITY_SPAWN': {
        if (newState.player?.beliefLayer) {
          newState.player.beliefLayer.suspicionLevel = Math.min(
            100,
            (newState.player.beliefLayer.suspicionLevel ?? 0) + 5
          );
        }
        break;
      }

      case 'MINOR_GLITCH':
        // No state change
        break;
    }
    return newState;
  }

  /**
   * Validation Event Handler
   * INVARIANT_VIOLATION
   */
  export function handleValidationEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);

    if (event.type === 'INVARIANT_VIOLATION') {
      (newState as any).metadata ??= {};
      ((newState as any).metadata as any).violationLog ??= [];
      ((newState as any).metadata.violationLog as any[]).push({
        tick: event.timestamp,
        violations: event.payload.violations ?? [],
        errorMessage: event.payload.error
      });
      console.warn('[StateRebuilder] Invariant violation:', event.payload);
    }
    return newState;
  }

  /**
   * Main Dispatch Router - Optimized with CaseMap for high-frequency events
   */
  const FastPathMap: Record<string, (s: WorldState, e: Event) => WorldState> = {
    'TICK': handlePlayerEvent,
    'MOVE': handlePlayerEvent
  };

  const HandlerMap: Record<string, (s: WorldState, e: Event) => WorldState> = {
    // Combat
    'HIT': handleCombatEvent, 'PARRY': handleCombatEvent, 'SKILL_CHECK': handleCombatEvent,
    'HEAL': handleCombatEvent, 'COMBAT_HIT': handleCombatEvent, 'COMBAT_BLOCK': handleCombatEvent,
    'COMBAT_PARRY': handleCombatEvent, 'PLAYER_HEALED': handleCombatEvent, 'PLAYER_REST': handleCombatEvent,
    'HAZARD_DAMAGE': handleCombatEvent, 'MANA_REGENERATED': handleCombatEvent, 'MANA_DRAINED': handleCombatEvent,
    'STATUS_APPLIED': handleCombatEvent, 'STATUS_EFFECT_EXPIRED': handleCombatEvent, 'SOUL_DECAY': handleCombatEvent,
    'NPC_SOUL_DECAY': handleCombatEvent, 'DRAIN_MANA_FAILED': handleCombatEvent, 'SPELL_CAST': handleCombatEvent,
    'SPELL_CAST_FAILED': handleCombatEvent, 'COMBAT_STARTED': handleCombatEvent, 'COMBAT_ENDED': handleCombatEvent,
    'COMBAT_LOG_ENTRY': handleCombatEvent, 'ACTOR_WAITED': handleCombatEvent,
    // Player
    'QUEST_STARTED': handlePlayerEvent, 'QUEST_COMPLETED': handlePlayerEvent, 'QUEST_OBJECTIVE_ADVANCED': handlePlayerEvent,
    'REWARD': handlePlayerEvent, 'LEVEL_UP': handlePlayerEvent, 'XP_GAINED': handlePlayerEvent,
    'REPUTATION_CHANGED': handlePlayerEvent, 'REPUTATION_MILESTONE_REACHED': handlePlayerEvent,
    'CHARACTER_CREATED': handlePlayerEvent, 'INTERACT_NPC': handlePlayerEvent, 'STAT_ALLOCATED': handlePlayerEvent,
    'PLAYER_DEFEATED': handlePlayerEvent,
    // Inventory
    'ITEM_PICKED_UP': handleInventoryEvent, 'ITEM_DROPPED': handleInventoryEvent, 'ITEM_EQUIPPED': handleInventoryEvent,
    'ITEM_UNEQUIPPED': handleInventoryEvent, 'RESOURCE_GATHERED': handleInventoryEvent, 'ITEM_CRAFTED': handleInventoryEvent,
    'ITEM_USED': handleInventoryEvent,
    // Trade
    'TRADE_INITIATED': handleTradeEvent, 'TRADE_COMMITMENT': handleTradeEvent, 'TRADE_COMPLETED': handleTradeEvent,
    'TRADE_CANCELLED': handleTradeEvent,
    // Faction
    'FACTION_QUEST_COMPLETED': handleFactionEvent, 'FACTION_COMBAT_VICTORY': handleFactionEvent,
    'FACTION_POWER_SHIFT': handleFactionEvent, 'FACTION_STRUGGLE': handleFactionEvent,
    'LOCATION_CONTROL_CHANGED': handleFactionEvent,
    // World
    'WORLD_EVENT_TRIGGERED': handleWorldEvent, 'NODE_DEPLETED': handleWorldEvent, 'LOCATION_DISCOVERED': handleWorldEvent,
    'SEARCH_FAILED': handleWorldEvent, 'SEARCH_NO_SECRETS': handleWorldEvent, 'SUB_AREA_DISCOVERED': handleWorldEvent,
    'ENCOUNTER_TRIGGERED': handleWorldEvent, 'TRAVEL_STARTED': handleWorldEvent, 'TRAVEL_TICK': handleWorldEvent,
    // Arcane
    'TEMPORAL_PARADOX': handleArcaneEvent, 'PARADOX_STRIKE': handleArcaneEvent, 'CHAOS_ANOMALY': handleArcaneEvent,
    'GHOST_TICK': handleArcaneEvent, 'MORPH_SUCCESS': handleArcaneEvent, 'MORPH_FAILURE': handleArcaneEvent,
    'VESSEL_SHATTER': handleArcaneEvent, 'ESSENCE_DECAY': handleArcaneEvent, 'REVOLT_OF_TRUTH': handleArcaneEvent,
    // Knowledge
    'TRUTH_REVEALED': handleKnowledgeEvent, 'NPC_IDENTIFIED': handleKnowledgeEvent,
    'IDENTIFY_FAILED': handleKnowledgeEvent, 'META_SUSPICION': handleKnowledgeEvent,
    // Relic
    'RUNE_INFUSED': handleRelicEvent, 'RELIC_BOUND': handleRelicEvent, 'RELIC_UNBOUND': handleRelicEvent,
    'INFUSION_FAILED': handleRelicEvent, 'BINDING_FAILED': handleRelicEvent, 'UNBINDING_FAILED': handleRelicEvent,
    // Narrative
    'AUTHORITY_INTERVENTION': handleNarrativeEvent, 'UNNAMED_ENTITY_SPAWN': handleNarrativeEvent,
    'MINOR_GLITCH': handleNarrativeEvent,
    // Validation
    'INVARIANT_VIOLATION': handleValidationEvent
  };

  export function handleEvent(state: WorldState, event: Event): WorldState {
    // Fast-path for TICK and MOVE (high-frequency)
    const fastHandler = FastPathMap[event.type];
    if (fastHandler) {
      return fastHandler(state, event);
    }

    // Standard dispatch
    const handler = HandlerMap[event.type];
    if (handler) {
      return handler(state, event);
    }

    // Unknown event type - return unchanged
    return state;
  }

  // Helper: Apply item effects
  function applyItemEffects(state: WorldState, itemId: string): void {
    if (!state.player) return;
    
    const effects: Record<string, () => void> = {
      'healing-potion-minor': () => {
        state.player!.hp = Math.min(
          state.player!.maxHp ?? 100,
          (state.player!.hp ?? 0) + 25
        );
      },
      'mana-potion-minor': () => {
        state.player!.mp = Math.min(
          state.player!.maxMp ?? 50,
          (state.player!.mp ?? 0) + 30
        );
      },
      'healing-potion-major': () => {
        state.player!.hp = Math.min(
          state.player!.maxHp ?? 100,
          (state.player!.hp ?? 0) + 60
        );
      },
      'mana-potion-major': () => {
        state.player!.mp = Math.min(
          state.player!.maxMp ?? 50,
          (state.player!.mp ?? 0) + 80
        );
      }
    };

    effects[itemId]?.();
  }
}

/**
 * Rebuild world state by replaying events from a checkpoint
 * BETA: Supports epoch-aware reconstruction
 */
export function rebuildState(initialState: WorldState, events: Event[], upToTick?: number): RebuildResult {
  let state = structuredClone(initialState);

  // BETA: Preserve epoch metadata during rebuild
  const originalEpochId = state.epochId;
  const originalChronicleId = state.chronicleId;
  const originalEpochMetadata = state.epochMetadata;

  for (const event of events) {
    if (upToTick !== undefined && event.id > upToTick.toString()) {
      break;
    }
    state = applyEventToState(state, event);
  }

  // BETA: Restore epoch context if it was present
  if (originalEpochId) {
    state.epochId = originalEpochId;
    state.chronicleId = originalChronicleId;
    state.epochMetadata = originalEpochMetadata;
  }

  return { candidateState: state };
}

/**
 * Apply event to state - M40: Clean delegation to domain-specific handlers
 * Eliminates 84-case switch statement, reduces complexity from 501 to <10
 */
function applyEventToState(state: WorldState, event: Event): WorldState {
  return EventHandlers.handleEvent(state, event);
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