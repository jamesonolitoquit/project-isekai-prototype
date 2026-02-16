import { WorldState } from './worldEngine';
import { Event } from '../events/mutationLog';
import { random } from './prng';
import type { DiceRollContext } from '../client/components/DiceAltar';
import { createPlayerCharacter, validateStatAllocation } from './characterCreation';
import { resolveCombat, resolveDefense, resolveParry, resolveHeal, CombatantStats, getEquipmentBonuses, applyEquipmentBonuses } from './ruleEngine';
import { isNpcAvailable, resolveDialogue } from './npcEngine';
import { resolveLootTable, validateRecipe, rollCraftingCheck, deductMaterials, addCraftResult, type Recipe } from './craftingEngine';
import { resolveSpell, getSpellById } from './magicEngine';
import { calculateDrift, validateAuthority, getParadoxSeverity, checkForSpellBackfire } from './paradoxEngine';
import { calculateMorphCost, generateRitualChallenge, performRitualCheck, handleMorphSuccess, handleMorphFailure, calculateEssenceDecay, checkMorphCooldown, findNearestAltar } from './morphEngine';
import { calculateEncounterChance, selectEncounterType, generateEncounterNpc, generateEncounterCombatant, calculateTravelDistance, hasHiddenAreas, getLocationBiome, calculateSearchDifficulty, performSearchCheck } from './encounterEngine';
import { calculateRelicBonus, shouldRelicRebel, checkInfusionStability, calculateUnbindCost, isRelicRebelling, generateRelicDialogue, applyRelicRebellion, getWieldingRequirement, calculateItemCorruption } from './artifactEngine';
import { getAbility } from './skillEngine';
import itemsData from '../data/items.json';
import encountersData from '../data/encounters.json';
import runesData from '../data/runes.json';

// Helper: Check if item exists in Set or array
function hasItem(container: Set<string> | string[] | undefined, item: string): boolean {
  if (!container) return false;
  if (Array.isArray(container)) return container.includes(item);
  return container.has(item);
}

// Build item templates map from items.json
const ITEM_TEMPLATES: Record<string, any> = {};
if (itemsData.items && Array.isArray(itemsData.items)) {
  itemsData.items.forEach((item: any) => {
    ITEM_TEMPLATES[item.id] = item;
  });
}

// Build recipe map from items.json
const RECIPES: Record<string, Recipe> = {};
if ((itemsData as any).recipes && Array.isArray((itemsData as any).recipes)) {
  (itemsData as any).recipes.forEach((recipe: any) => {
    RECIPES[recipe.id] = recipe;
  });
}

// Build loot tables map from items.json
const LOOT_TABLES: Record<string, any[]> = {};
if ((itemsData as any).loot_tables && typeof (itemsData as any).loot_tables === 'object') {
  Object.entries((itemsData as any).loot_tables).forEach(([tableId, entries]: [string, any]) => {
    LOOT_TABLES[tableId] = entries;
  });
}

/**
 * MetagameValidator checks for suspicious player actions that suggest metagaming
 * (e.g., targeting NPC before discovering them, moving to undiscovered locations)
 */
function validateMetagaming(state: WorldState, action: Action): { isSuspicious: boolean; reason?: string } {
  const knowledgeBase = state.player.knowledgeBase;
  const visitedLocations = state.player.visitedLocations;
  
  switch (action.type) {
    case 'MOVE': {
      const targetLocation = action.payload?.to;
      // Check if player hasn't discovered this location through gameplay
      if (targetLocation && !hasItem(visitedLocations, targetLocation) && !hasItem(knowledgeBase, `location:${targetLocation}`)) {
        return {
          isSuspicious: true,
          reason: 'Moved to undiscovered location - possible metagaming'
        };
      }
      break;
    }
    
    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      // Check if NPC hasn't been identified yet
      if (npcId && !hasItem(knowledgeBase, `npc:${npcId}`)) {
        return {
          isSuspicious: true,
          reason: 'Interacted with unknown NPC - possible metagaming'
        };
      }
      break;
    }
    
    case 'CAST_SPELL': {
      const targetId = action.payload?.targetId;
      // Check if targeting NPC that hasn't been identified
      if (targetId && targetId !== state.player.id) {
        const isNpc = state.npcs.some(n => n.id === targetId);
        if (isNpc && !hasItem(knowledgeBase, `npc:${targetId}`)) {
          return {
            isSuspicious: true,
            reason: 'Cast spell on unknown NPC - possible metagaming'
          };
        }
      }
      break;
    }
    
    case 'ATTACK': {
      const targetId = action.payload?.targetId;
      // Check if attacking NPC that hasn't been identified
      if (targetId && targetId !== state.player.id) {
        const isNpc = state.npcs.some(n => n.id === targetId);
        if (isNpc && !hasItem(knowledgeBase, `npc:${targetId}`)) {
          return {
            isSuspicious: true,
            reason: 'Attacked unknown NPC - possible metagaming'
          };
        }
      }
      break;
    }
  }
  
  return { isSuspicious: false };
}

export type Action = {
  worldId: string;
  playerId: string;
  type: string;
  payload: any;
  epochId?: string; // BETA: Track which epoch this action occurred in
  // M32: Multi-client authorship fields
  clientId?: string;        // Which client emitted this action
  sequenceNumber?: number;  // Monotonic sequence per client for ordering
};

function createEvent(state: WorldState, action: Action, type: string, payload: any): Event {
  const tick = state.tick || 0;
  const randTag = Math.floor(random() * 0xffffff).toString(16);
  return {
    id: `${type.toLowerCase()}-t${tick}-${randTag}`,
    worldInstanceId: state.id,
    actorId: state.player.id,
    type,
    payload,
    templateOrigin: state.metadata?.templateOrigin,
    timestamp: tick * 1000,
  };
}

/**
 * Helper: Check if action has been resolved via DiceAltar
 * Returns true if diceRollConfirmed is in payload (meaning the player confirmed the roll)
 */
function isDiceRollConfirmed(action: Action): boolean {
  return action.payload?.diceRollConfirmed === true;
}

/**
 * Helper: Creates a DICE_ROLL_REQUEST event that signals to the UI to show DiceAltar
 */
function createDiceRollRequest(state: WorldState, action: Action, context: DiceRollContext): Event {
  return createEvent(state, action, 'DICE_ROLL_REQUEST', {
    diceContext: context,
    actionType: action.type,
    actionPayload: action.payload
  });
}

export function processAction(state: WorldState, action: Action): Event[] {
  const events: Event[] = [];

  // Phase 12: Check AI DM authority - is this action permitted by the cosmos?
  const authorityCheck = validateAuthority(action, state);
  if (!authorityCheck.allowed) {
    // AI DM denies the action
    events.push(createEvent(state, action, 'AUTHORITY_INTERVENTION', {
      interventionText: authorityCheck.interventionText || 'Reality refuses.',
      action: action.type,
      payload: action.payload,
      reason: 'Metagame knowledge exploitation detected'
    }));
    return events;  // Stop processing this action
  }

  // Check for metagaming attempts
  const metagameCheck = validateMetagaming(state, action);
  if (metagameCheck.isSuspicious) {
    // Increase suspicion and potentially trigger DM interference
    if (!state.player.beliefLayer) {
      state.player.beliefLayer = {
        npcLocations: {},
        npcStats: {},
        facts: {},
        suspicionLevel: 0
      };
    }
    state.player.beliefLayer.suspicionLevel = (state.player.beliefLayer.suspicionLevel || 0) + 10;
    
    // If suspicion threshold exceeded, emit META_SUSPICION event for DM interference
    if ((state.player.beliefLayer.suspicionLevel || 0) >= 30) {
      events.push(createEvent(state, action, 'META_SUSPICION', {
        level: state.player.beliefLayer.suspicionLevel,
        reason: metagameCheck.reason,
        triggeringAction: action.type,
        dmInterference: 'Environmental anomaly or hostile entity manifestation'
      }));
      // After suspicious activity, we still process the action but with consequences
    }
  }

  switch (action.type) {
    case 'MOVE': {
      // M9 Phase 3: Enhanced movement with travel animation and distance-based time
      const to = action.payload?.to;
      if (!to || !state.locations.find(loc => loc.id === to)) {
        // Invalid location - no event
        return [];
      }

      const targetLocation = state.locations.find(loc => loc.id === to);
      const fromLocation = state.locations.find(loc => loc.id === state.player.location);

      if (!targetLocation || !fromLocation) {
        return [];
      }

      // M9 Phase 3: Calculate travel distance and time based on coordinates
      let travelDistance = 100; // Default distance in coordinate units
      let travelTicks = 30; // Default ticks (30s for typical travel)

      // If both locations have coordinates, use Euclidean distance
      if (
        fromLocation.x !== undefined && fromLocation.y !== undefined &&
        targetLocation.x !== undefined && targetLocation.y !== undefined
      ) {
        const dx = targetLocation.x - fromLocation.x;
        const dy = targetLocation.y - fromLocation.y;
        travelDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Travel time scales with distance
        // Base: 30 ticks + (distance * 0.01 ticks per coordinate unit)
        travelTicks = 30 + Math.round(travelDistance * 0.01);
      }

      // Apply terrain modifier to travel time
      const targetTerrainMod = targetLocation.terrainModifier ?? 1.0;
      travelTicks = Math.round(travelTicks * targetTerrainMod);

      // Create travel animation event
      events.push(createEvent(state, action, 'TRAVEL_STARTED', {
        from: state.player.location,
        to,
        distance: Math.round(travelDistance),
        estimatedTicks: travelTicks,
        terrainDifficulty: targetTerrainMod,
        animationType: targetLocation.biome ? `travel_${targetLocation.biome}` : 'travel_default',
      }));

      // Log the movement itself with duration
      events.push(createEvent(state, action, 'MOVE', {
        from: state.player.location,
        to,
        distance: Math.round(travelDistance),
        travelTime: travelTicks,
      }));

      break;
    }

    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      const npc = state.npcs.find(n => n.id === npcId);
      if (!npc) return [];

      // Check availability using npcEngine
      const curHour = state.hour ?? 8;
      if (!isNpcAvailable(npc, curHour)) {
        events.push(createEvent(state, action, 'NPC_UNAVAILABLE', { npcId, hour: curHour, availableFrom: npc.availability?.startHour ?? 0 }));
        return events;
      }

      // Resolve dialogue using npcEngine with full state context
      const dialogue = resolveDialogue(npc, state.player, state);

      events.push(createEvent(state, action, 'INTERACT_NPC', {
        npcId,
        text: dialogue.text,
        options: dialogue.options,
      }));
      break;
    }

    case 'DIALOG_CHOICE': {
      const npcId = action.payload?.npcId;
      const choiceId = action.payload?.choiceId;
      const npc = state.npcs.find(n => n.id === npcId);
      if (!npc) return [];

      // For now, choices just advance the dialogue
      if (choiceId === 'next') {
        // Assume they're progressing dialogue
      }

      // Check if this NPC is associated with a quest and if so, trigger quest start or other effects
      if (npc.questId) {
        const quest = state.quests.find(q => q.id === npc.questId);
        if (quest && !state.player.quests[npc.questId]) {
          // Quest not yet started; trigger it
          events.push(createEvent(state, action, 'QUEST_STARTED', { questId: npc.questId }));
        }
      }

      events.push(createEvent(state, action, 'DIALOG_CHOICE', { npcId, choiceId }));
      break;
    }

    case 'START_QUEST': {
      const questId = action.payload?.questId;
      const quest = state.quests.find(q => q.id === questId);
      if (!quest) return [];

      // Check if already started or completed
      const playerQuest = state.player.quests[questId];
      if (playerQuest && playerQuest.status !== 'not_started') {
        return events; // Already in progress or completed
      }

      // Check dependencies
      const dependencies = quest.dependencies ?? [];
      for (const depId of dependencies) {
        const depQuest = state.player.quests[depId];
        if (!depQuest || depQuest.status !== 'completed') {
          events.push(createEvent(state, action, 'QUEST_LOCKED', {
            questId,
            reason: 'dependencies-not-met',
            missingDependencies: dependencies.filter(d => {
              const depQ = state.player.quests[d];
              return !depQ || depQ.status !== 'completed';
            }),
          }));
          return events;
        }
      }

      events.push(createEvent(state, action, 'QUEST_STARTED', { questId }));
      break;
    }

    case 'COMPLETE_QUEST': {
      const questId = action.payload?.questId;
      const quest = state.quests.find(q => q.id === questId);
      if (!quest) return [];

      const playerQuest = state.player.quests[questId];
      if (!playerQuest || playerQuest.status !== 'in_progress') {
        return events; // Not in progress
      }

      // Check objective
      const objective = quest.objective;
      let objectiveMet = false;

      if (objective?.type === 'visit' && objective.location) {
        if (state.player.location === objective.location) {
          // Check time-lock if specified
          if ((objective as any).timeConstraints) {
            const tc = (objective as any).timeConstraints;
            const hourMatch = typeof tc.startHour === 'number' && typeof tc.endHour === 'number'
              ? (state.hour >= tc.startHour && state.hour <= tc.endHour)
              : true;

            if (!hourMatch) {
              events.push(createEvent(state, action, 'ACTION_REJECTED', {
                reason: 'time-constraint-not-met',
                requiredHours: `${tc.startHour}:00–${tc.endHour}:00`,
                currentHour: `${state.hour}:00`,
                message: `It is not yet the correct time for this.`
              }));
              return events;
            }
          }
          objectiveMet = true;
        }
      } else if (objective?.type === 'combat') {
        // For now, if any combat event occurred at this location, consider it met
        // More complex combat logic will be in ruleEngine
      }

      if (!objectiveMet) return [];

      events.push(createEvent(state, action, 'QUEST_COMPLETED', { questId }));

      // Add reward event
      if (quest.rewards) {
        events.push(createEvent(state, action, 'REWARD', { questId, reward: quest.rewards }));
      }

      break;
    }

    case 'ATTACK': {
      const defenderId = action.payload?.targetId;
      const defender = state.npcs.find(n => n.id === defenderId);
      if (!defender) return [];

      // Get base player stats
      let playerStats: CombatantStats = state.player && 'stats' in state.player && state.player.stats
        ? state.player.stats as CombatantStats
        : { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

      // Apply equipment bonuses
      if (state.player && state.player.equipment) {
        const equipBonuses = getEquipmentBonuses(state.player.equipment, ITEM_TEMPLATES);
        playerStats = applyEquipmentBonuses(playerStats, equipBonuses);
      }

      // M25: Check if DiceAltar has already confirmed the roll
      if (!isDiceRollConfirmed(action)) {
        // First time: send DICE_ROLL_REQUEST to show DiceAltar UI
        const diceContext: DiceRollContext = {
          actionType: 'attack',
          actionName: `Attack ${defender.name || 'Unknown'}`,
          baseValue: Math.floor(playerStats.str / 2) + 5,
          modifiers: [
            { name: 'Weapon Bonus', value: 2 },
            { name: 'Agility', value: Math.floor(playerStats.agi / 5) }
          ],
          targetValue: 10 + Math.floor((defender.stats?.agi || 10) / 5),
          targetDescription: `Defender AC: ${10 + Math.floor((defender.stats?.agi || 10) / 5)}`
        };
        return [createDiceRollRequest(state, action, diceContext)];
      }

      // Second time: player has confirmed roll, apply combat normally
      const combatEvents = resolveCombat(
        state.player.id,
        [defenderId],
        playerStats,
        { [defenderId]: (defender.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 }) },
        state.id
      );
      events.push(...combatEvents);

      // Add faction events for combat victories
      const defenderDefeatedEvent = combatEvents.find(e => 
        (e.type === 'NPC_DEFEATED' || e.type === 'COMBAT_VICTORY') && 
        e.payload?.targetId === defenderId
      );

      if (defenderDefeatedEvent && (defender as any).factionId) {
        const defenderFactionId = (defender as any).factionId;
        events.push(createEvent(state, action, 'FACTION_COMBAT_VICTORY', {
          victoryType: 'defeated_npc',
          defenderNpcId: defenderId,
          defenderFactionId: defenderFactionId,
          victoryFactionId: 'player',
          reputationGain: 10,
          powerGain: 3
        }));

        // Auto-loot
        const lootTableId = (defender as any).lootTable || 'common_npc';
        const lootTable = LOOT_TABLES[lootTableId] || LOOT_TABLES['common_npc'];
        if (lootTable && Array.isArray(lootTable)) {
          const roll = Math.floor(random() * 100);
          for (const lootEntry of lootTable) {
            if (roll >= lootEntry.chance_min && roll <= lootEntry.chance_max) {
              events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
                itemId: lootEntry.item_id,
                quantity: lootEntry.quantity || 1
              }));
              break;
            }
          }
        }
      }
      break;
    }

    case 'DEFEND': {
      const defenderId = action.payload?.targetId;
      const defender = state.npcs.find(n => n.id === defenderId);
      if (!defender) return [];

      // Get base player stats
      let playerStats: CombatantStats = state.player && 'stats' in state.player && state.player.stats
        ? state.player.stats as CombatantStats
        : { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

      // Apply equipment bonuses
      if (state.player && state.player.equipment) {
        const equipBonuses = getEquipmentBonuses(state.player.equipment, ITEM_TEMPLATES);
        playerStats = applyEquipmentBonuses(playerStats, equipBonuses);
      }

      // M25: Check if DiceAltar has already confirmed the roll
      if (!isDiceRollConfirmed(action)) {
        const diceContext: DiceRollContext = {
          actionType: 'defend',
          actionName: `Defend against ${defender.name || 'Unknown'}`,
          baseValue: Math.floor(playerStats.agi / 2) + 7,
          modifiers: [
            { name: 'Armor Bonus', value: 3 },
            { name: 'Constitution', value: Math.floor(playerStats.end / 5) }
          ],
          targetValue: 12 + Math.floor((defender.stats?.str || 10) / 4),
          targetDescription: `Incoming attack power: ${12 + Math.floor((defender.stats?.str || 10) / 4)}`
        };
        return [createDiceRollRequest(state, action, diceContext)];
      }

      // Second time: apply defense normally
      const incomingDamage = 8 + (defender.stats?.str || 10) / 10;
      const defenseResult = resolveDefense(playerStats, incomingDamage);

      events.push(createEvent(state, action, 'COMBAT_BLOCK', {
        defenderId: state.player.id,
        attackerId: defenderId,
        blocked: defenseResult.blocked,
        damageReduced: defenseResult.damageReduced,
        finalDamage: defenseResult.finalDamage,
        logs: defenseResult.logs
      }));
      break;
    }

    case 'PARRY': {
      const defenderId = action.payload?.targetId;
      const defender = state.npcs.find(n => n.id === defenderId);
      if (!defender) return [];

      // Get base player stats
      let playerStats: CombatantStats = state.player && 'stats' in state.player && state.player.stats
        ? state.player.stats as CombatantStats
        : { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

      // Apply equipment bonuses
      if (state.player && state.player.equipment) {
        const equipBonuses = getEquipmentBonuses(state.player.equipment, ITEM_TEMPLATES);
        playerStats = applyEquipmentBonuses(playerStats, equipBonuses);
      }

      const defenderStats: CombatantStats = defender.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

      // M25: Check if DiceAltar has already confirmed the roll
      if (!isDiceRollConfirmed(action)) {
        const diceContext: DiceRollContext = {
          actionType: 'defend',
          actionName: `Parry ${defender.name || 'Unknown'}`,
          baseValue: Math.floor(playerStats.agi / 2) + 6,
          modifiers: [
            { name: 'Weapon Skill', value: 2 },
            { name: 'Reflex', value: Math.floor(playerStats.agi / 4) }
          ],
          targetValue: 11 + Math.floor(defenderStats.str / 4),
          targetDescription: `Enemy attack: ${11 + Math.floor(defenderStats.str / 4)}`
        };
        return [createDiceRollRequest(state, action, diceContext)];
      }

      // Second time: apply parry normally
      const incomingDamage = 8 + defenderStats.str / 10;
      const parryResult = resolveParry(playerStats, defenderStats, incomingDamage);

      events.push(createEvent(state, action, 'COMBAT_PARRY', {
        defenderId: state.player.id,
        attackerId: defenderId,
        parried: parryResult.parried,
        counterDamage: parryResult.counterDamage,
        finalDamage: parryResult.finalDamage,
        logs: parryResult.logs
      }));
      break;
    }

    case 'HEAL': {
      const playerStats: CombatantStats = state.player && 'stats' in state.player && state.player.stats
        ? state.player.stats as CombatantStats
        : { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

      const currentHp = state.player.hp || 100;
      const maxHp = state.player.maxHp || 100;

      const healResult = resolveHeal(playerStats, maxHp, currentHp);

      events.push(createEvent(state, action, 'PLAYER_HEALED', {
        hpRestored: healResult.hpRestored,
        newHp: healResult.newHp,
        maxHp,
        logs: healResult.logs
      }));
      break;
    }

    case 'REST': {
      // Rest action: restore 10% HP per game hour spent resting, and 25% MP
      const currentHp = state.player.hp || 100;
      const maxHp = state.player.maxHp || 100;
      const hpPerRest = Math.ceil(maxHp * 0.1); // 10% per hour
      const newHp = Math.min(maxHp, currentHp + hpPerRest);
      const hpRestored = newHp - currentHp;

      // Mana restoration during rest (25% per hour)
      const currentMp = state.player.mp ?? 0;
      const maxMp = state.player.maxMp ?? 0;
      const mpPerRest = Math.ceil(maxMp * 0.25); // 25% per hour
      const newMp = Math.min(maxMp, currentMp + mpPerRest);
      const mpRestored = newMp - currentMp;

      events.push(createEvent(state, action, 'PLAYER_REST', {
        hpRestored,
        newHp,
        maxHp,
        mpRestored,
        newMp,
        maxMp,
        hoursCost: 1,
        message: `Rested 1 hour. HP restored: ${hpRestored}, MP restored: ${mpRestored}`
      }));
      break;
    }

    case 'SUBMIT_CHARACTER': {
      const { character } = action.payload;
      if (!character || !character.name || !character.race || !character.stats || !validateStatAllocation(character.stats)) {
        return []; // Invalid character creation
      }
      events.push(createEvent(state, action, 'CHARACTER_CREATED', { character }));
      break;
    }

    case 'WAIT': {
      // WAIT action doesn't produce an event; worldEngine advances tick anyway
      return [];
    }

    case 'PICKUP_ITEM': {
      const { itemId, quantity = 1 } = action.payload;
      if (!itemId) return [];

      events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
        itemId,
        quantity
      }));
      break;
    }

    case 'DROP_ITEM': {
      const { itemId, quantity = 1 } = action.payload;
      if (!itemId) return [];

      events.push(createEvent(state, action, 'ITEM_DROPPED', {
        itemId,
        quantity,
        location: state.player.location
      }));
      break;
    }

    case 'EQUIP_ITEM': {
      const { itemId } = action.payload;
      if (!itemId) return [];

      events.push(createEvent(state, action, 'ITEM_EQUIPPED', {
        itemId
      }));
      break;
    }

    case 'USE_ITEM': {
      const { itemId } = action.payload;
      if (!itemId) return [];

      events.push(createEvent(state, action, 'ITEM_USED', {
        itemId
      }));
      break;
    }

    case 'UNEQUIP_ITEM': {
      const { slot } = action.payload;
      if (!slot) return [];

      events.push(createEvent(state, action, 'ITEM_UNEQUIPPED', {
        slot
      }));
      break;
    }

    case 'GATHER_RESOURCE': {
      const playerLocation = state.player.location;
      
      // Find resource nodes at this location
      const availableNodes = (state.resourceNodes || []).filter(node => 
        node.locationId === playerLocation && (!node.depletedAt || (state.tick || 0) >= node.depletedAt + (node.regeneratesInHours * 60) * 60) // hours * 60 min * 60 sec = ticks
      );

      if (availableNodes.length === 0) {
        events.push(createEvent(state, action, 'GATHER_FAILED', {
          reason: 'no-available-nodes',
          location: playerLocation
        }));
        return events;
      }

      // Use first available node
      const node = availableNodes[0];
      const lootTable = LOOT_TABLES[node.lootTableId];

      if (!lootTable) {
        events.push(createEvent(state, action, 'GATHER_FAILED', {
          reason: 'invalid-loot-table',
          location: playerLocation
        }));
        return events;
      }

      // Resolve loot from table (weighted random selection)
      const gathered = resolveLootTable(lootTable);

      if (gathered.length === 0) {
        events.push(createEvent(state, action, 'GATHER_FAILED', {
          reason: 'no-loot-rolled',
          location: playerLocation
        }));
        return events;
      }

      // Generate items picked up
      gathered.forEach(item => {
        events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
          itemId: item.itemId,
          quantity: (item as any).quantity || 1,
          source: 'gather',
          nodeId: node.id
        }));
      });

      // Mark node as depleted and schedule regeneration
      events.push(createEvent(state, action, 'NODE_DEPLETED', {
        nodeId: node.id,
        locationId: playerLocation,
        regeneratesInHours: node.regeneratesInHours
      }));

      break;
    }

    case 'CRAFT_ITEM': {
      const { recipeId } = action.payload;
      if (!recipeId) return [];

      const recipe = RECIPES[recipeId];
      if (!recipe) {
        events.push(createEvent(state, action, 'ITEM_CRAFTED', {
          recipeId,
          success: false,
          reason: 'invalid-recipe'
        }));
        return events;
      }

      // Check if player has required materials
      const inventory = state.player.inventory || [];
      const validation = validateRecipe(inventory, recipe);

      if (!validation.valid) {
        events.push(createEvent(state, action, 'ITEM_CRAFTED', {
          recipeId,
          success: false,
          reason: 'missing-materials',
          missingMaterials: validation.missingMaterials
        }));
        return events;
      }

      // Roll crafting check (INT-based)
      const playerInt = state.player.stats?.int || 10;
      const craftingCheck = rollCraftingCheck(playerInt, recipe.difficulty);

      if (!craftingCheck.success) {
        // Failed craft - consume materials but don't create item
        events.push(createEvent(state, action, 'ITEM_CRAFTED', {
          recipeId,
          success: false,
          reason: 'crafting-failed',
          roll: craftingCheck.roll,
          difficulty: craftingCheck.difficulty
        }));
        
        // Still consume materials on failure
        recipe.materials.forEach(mat => {
          events.push(createEvent(state, action, 'ITEM_USED', {
            itemId: mat.itemId,
            quantity: mat.quantity,
            reason: 'crafting-failure'
          }));
        });
        return events;
      }

      // Success - consume materials and create result
      recipe.materials.forEach(mat => {
        events.push(createEvent(state, action, 'ITEM_USED', {
          itemId: mat.itemId,
          quantity: mat.quantity,
          reason: 'crafting'
        }));
      });

      events.push(createEvent(state, action, 'ITEM_CRAFTED', {
        recipeId,
        success: true,
        result: recipe.result,
        roll: craftingCheck.roll,
        difficulty: craftingCheck.difficulty
      }));

      events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
        itemId: recipe.result.itemId,
        quantity: recipe.result.quantity,
        source: 'craft',
        recipeId
      }));

      break;
    }

    case 'USE_ITEM': {
      const { itemId } = action.payload;
      if (!itemId) return [];

      // Item use - can trigger effects like healing
      events.push(createEvent(state, action, 'ITEM_USED', {
        itemId
      }));
      break;
    }

    case 'GAIN_XP': {
      const { xpAmount } = action.payload;
      if (!xpAmount || xpAmount <= 0) return [];

      events.push(createEvent(state, action, 'XP_GAINED', {
        xpAmount
      }));
      break;
    }

    case 'LEVEL_UP': {
      const { newLevel } = action.payload;
      if (!newLevel || newLevel <= 1) return [];

      // Grant attribute points (M7/M8 feature)
      state.player.attributePoints = (state.player.attributePoints || 0) + 2;
      
      // Grant skill points (M9 feature)
      state.player.skillPoints = (state.player.skillPoints || 0) + 3;

      events.push(createEvent(state, action, 'PLAYER_LEVELED_UP', {
        newLevel,
        attributePointsGranted: 2,
        skillPointsGranted: 3
      }));
      break;
    }

    case 'ALLOCATE_STAT': {
      const { stat, amount } = action.payload;
      if (!stat || !amount) return [];

      events.push(createEvent(state, action, 'STAT_ALLOCATED', {
        stat,
        amount
      }));
      break;
    }

    case 'ACTIVATE_ABILITY': {
      const { abilityId } = action.payload;
      if (!abilityId) return [];

      // Check if ability exists
      const ability = getAbility(abilityId);
      if (!ability) {
        return [];
      }

      // Validation 1: Check if ability is equipped
      if (!state.player.equippedAbilities?.includes(abilityId)) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          abilityId,
          reason: 'Ability is not equipped',
          message: 'You must equip this ability first.'
        }));
        break;
      }

      // Validation 2: Check cooldown
      const playerCooldowns = state.player.abilityCooldowns || {};
      const remainingCooldown = Math.max(0, playerCooldowns[abilityId] ?? 0);
      
      if (remainingCooldown > 0) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          abilityId,
          reason: 'Ability is on cooldown',
          remainingCooldown,
          message: `Ability will be ready in ${remainingCooldown} ticks.`
        }));
        break;
      }

      // Validation 3: Check mana cost
      const manaCost = Math.floor((ability.effect.magnitude || 10) * 0.5);
      const playerMp = state.player.mp ?? 0;
      
      if (playerMp < manaCost) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          abilityId,
          reason: 'Insufficient mana',
          manaCost,
          currentMana: playerMp,
          message: `Requires ${manaCost} mana. You have ${playerMp}.`
        }));
        break;
      }

      // Apply mana cost
      state.player.mp = playerMp - manaCost;

      // Apply effect based on ability type
      const effectType = ability.effect.type;
      const magnitude = ability.effect.magnitude ?? 0;

      if (effectType === 'damage') {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
          abilityId,
          abilityName: ability.name,
          effectType: 'damage',
          magnitude,
          manaCost,
          message: `Activated ${ability.name} for ${magnitude} damage!`
        }));
      } else if (effectType === 'healing' || (effectType === 'interaction' && ability.branch === 'resonance' && ability.id === 'resonance_commune')) {
        // Healing effect
        const healAmount = Math.floor(magnitude * (state.player.stats?.int || 10) / 10);
        const oldHp = state.player.hp ?? 0;
        const maxHpValue = state.player.maxHp ?? 100;
        const newHpValue = Math.min(maxHpValue, oldHp + healAmount);
        state.player.hp = newHpValue;

        events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
          abilityId,
          abilityName: ability.name,
          effectType: 'healing',
          healAmount,
          oldHp,
          newHp: newHpValue,
          manaCost,
          message: `${ability.name} restored ${newHpValue - oldHp} HP!`
        }));
      } else {
        // Utility/other effects
        events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
          abilityId,
          abilityName: ability.name,
          effectType,
          magnitude,
          manaCost,
          message: `Activated ${ability.name}!`
        }));
      }

      // Set cooldown
      const cooldownTicks = ability.effect.cooldown ?? 6;
      state.player.abilityCooldowns = state.player.abilityCooldowns || {};
      state.player.abilityCooldowns[abilityId] = cooldownTicks;

      // Trigger audio ducking for tier 3+ abilities
      if (ability.tier >= 3) {
        const duckingDuration = Math.ceil(cooldownTicks * 0.3);
        events.push(createEvent(state, action, 'AUDIO_DUCKING_TRIGGERED', {
          abilityId,
          abilityName: ability.name,
          tier: ability.tier,
          duckingAmount: 0.5,
          duckingDuration
        }));
      }

      break;
    }

    case 'ADVANCE_QUEST_OBJECTIVE': {
      const { questId } = action.payload;
      if (!questId) return [];

      const quest = state.quests.find(q => q.id === questId);
      const playerQuest = state.player.quests[questId];
      
      if (!quest || !playerQuest || playerQuest.status !== 'in_progress') return [];

      const currentObjIndex = playerQuest.currentObjectiveIndex || 0;
      const objectives = quest.objectives || (quest.objective ? [quest.objective] : []);

      // Only advance if we haven't completed all objectives
      if (currentObjIndex < objectives.length - 1) {
        events.push(createEvent(state, action, 'QUEST_OBJECTIVE_ADVANCED', {
          questId,
          previousObjective: currentObjIndex,
          newObjective: currentObjIndex + 1,
          objectiveDetails: objectives[currentObjIndex + 1]
        }));
      } else if (currentObjIndex === objectives.length - 1) {
        // All objectives complete - mark quest as completed
        events.push(createEvent(state, action, 'QUEST_COMPLETED', {
          questId,
          rewards: quest.rewards
        }));
      }
      break;
    }

    case 'TRIGGER_WORLD_EVENT': {
      const { eventId } = action.payload;
      if (!eventId) return [];

      events.push(createEvent(state, action, 'WORLD_EVENT_TRIGGERED', {
        eventId,
        triggeredAt: state.hour,
        triggeredSeason: state.season
      }));
      break;
    }

    case 'MODIFY_REPUTATION': {
      const { npcId, amount } = action.payload;
      if (!npcId || !amount) return [];

      const currentRep = state.player.reputation?.[npcId] || 0;
      const newRep = currentRep + amount;

      events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
        npcId,
        previousRep: currentRep,
        newRep,
        change: amount
      }));

      // Track reputation milestones
      if (currentRep < 50 && newRep >= 50) {
        events.push(createEvent(state, action, 'REPUTATION_MILESTONE_REACHED', {
          npcId,
          milestone: 'friendly',
          newRep
        }));
      } else if (currentRep < -50 && newRep <= -50) {
        events.push(createEvent(state, action, 'REPUTATION_MILESTONE_REACHED', {
          npcId,
          milestone: 'hostile',
          newRep
        }));
      }
      break;
    }

    case 'ENTER_COMBAT': {
      const { targetIds = [] } = action.payload;
      if (!targetIds || targetIds.length === 0) return [];

      const participants = [state.player.id, ...targetIds];
      events.push(createEvent(state, action, 'COMBAT_STARTED', {
        participants,
        initiatorId: state.player.id,
        targetIds
      }));

      events.push(createEvent(state, action, 'COMBAT_LOG_ENTRY', {
        message: `Combat started! Participants: ${participants.join(', ')}`,
        roundNumber: 0
      }));

      break;
    }

    case 'EXIT_COMBAT': {
      events.push(createEvent(state, action, 'COMBAT_ENDED', {
        exitedAt: state.tick || 0,
        combatDuration: ((state.tick || 0) - ((state.combatState?.initiator as any)?.startedAt || 0))
      }));

      events.push(createEvent(state, action, 'COMBAT_LOG_ENTRY', {
        message: 'Combat has ended.',
        roundNumber: state.combatState?.roundNumber || 0
      }));

      break;
    }

    case 'WAIT': {
      const { reason } = action.payload;
      events.push(createEvent(state, action, 'ACTOR_WAITED', {
        actorId: action.playerId,
        reason,
        roundNumber: state.combatState?.roundNumber || 0
      }));
      break;
    }

    case 'CAST_SPELL': {
      const { spellId, targetId } = action.payload;
      const spell = getSpellById(spellId);

      if (!spell) {
        events.push(createEvent(state, action, 'SPELL_CAST_FAILED', {
          spellId,
          reason: 'Spell not found'
        }));
        break;
      }

      // Find target (could be NPC or player)
      let target = state.npcs.find(n => n.id === targetId);
      if (!target && targetId === state.player.id) {
        target = state.player as any;
      }

      if (!target) {
        events.push(createEvent(state, action, 'SPELL_CAST_FAILED', {
          spellId,
          reason: 'Target not found',
          targetId
        }));
        break;
      }

      // M25: Check if DiceAltar has already confirmed the roll
      if (!isDiceRollConfirmed(action)) {
        const playerStats = state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
        const diceContext: DiceRollContext = {
          actionType: 'magic',
          actionName: `Cast ${spell.name}`,
          baseValue: Math.floor(playerStats.int / 2) + 8,
          modifiers: [
            { name: 'Mana Affinity', value: 3 },
            { name: 'Intellect', value: Math.floor(playerStats.int / 5) }
          ],
          targetValue: 11 + (target?.stats?.int ? Math.floor(target.stats.int / 6) : 0),
          targetDescription: `Spell DC: ${11 + (target?.stats?.int ? Math.floor(target.stats.int / 6) : 0)}`
        };
        return [createDiceRollRequest(state, action, diceContext)];
      }

      // Second time: apply spell resolution
      const spellResult = resolveSpell(
        spellId,
        state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
        target.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
        state.player
      );

      if (!spellResult.success) {
        events.push(createEvent(state, action, 'SPELL_CAST_FAILED', {
          spellId,
          reason: spellResult.message,
          manaCost: spell.manaCost
        }));
        break;
      }

      // Phase 12: Check for paradox-induced spell backfire
      const chaosScore = calculateDrift(state);
      const backfireCheck = checkForSpellBackfire(chaosScore);

      if (backfireCheck.backfires && backfireCheck.penalty) {
        // Spell backfires due to high paradox
        events.push(createEvent(state, action, 'PARADOX_STRIKE', {
          spellId,
          spellName: spell.name,
          targetId: state.player.id,
          damage: backfireCheck.penalty,
          temporalCost: 10,
          description: `${spell.name} backfires due to reality strain!`,
          chaosScore
        }));
        break;  // Stop spell processing - backfire instead
      }

      // Spell succeeded - emit event
      events.push(createEvent(state, action, 'SPELL_CAST', {
        spellId,
        spellName: spell.name,
        discipline: spell.discipline,
        targetId,
        targetName: target.name || 'Unknown',
        damageDealt: spellResult.damageDealt,
        healing: spellResult.healing,
        statusApplied: spellResult.statusApplied,
        manaCost: spellResult.manaConsumed,
        message: spellResult.message
      }));
      break;
    }

    case 'DRAIN_MANA': {
      const { locationId } = action.payload;
      const location = state.locations.find(loc => loc.id === locationId);

      if (!location) {
        events.push(createEvent(state, action, 'DRAIN_MANA_FAILED', {
          reason: 'Location not found',
          locationId
        }));
        break;
      }

      // Check if location has spiritDensity
      const spiritDensity = (location as any).spiritDensity ?? 0;
      if (spiritDensity <= 0) {
        events.push(createEvent(state, action, 'DRAIN_MANA_FAILED', {
          reason: 'Location has no mana',
          location: location.name
        }));
        break;
      }

      // Restore mana (20-40% of maxMp based on spiritDensity)
      const maxMp = state.player.maxMp ?? 0;
      const manaRestored = Math.floor(maxMp * (0.2 + spiritDensity * 0.2));
      const previousMp = state.player.mp ?? 0;
      const newMp = Math.min(maxMp, previousMp + manaRestored);

      events.push(createEvent(state, action, 'MANA_DRAINED', {
        location: location.name,
        locationId,
        spiritDensity,
        previousMp,
        newMp,
        maxMp,
        manaRestored,
        message: `Drained ${manaRestored} mana from ${location.name}`
      }));
      break;
    }

    case 'REVEAL_TRUTH': {
      const { entityType, entityId, entityName } = action.payload;

      // Add to knowledge base
      if (!state.player.knowledgeBase) {
        state.player.knowledgeBase = new Set();
      }
      state.player.knowledgeBase.add(`${entityType}:${entityId}`);

      events.push(createEvent(state, action, 'TRUTH_REVEALED', {
        entityType,
        entityId,
        entityName,
        message: `You have learned about ${entityName}!`
      }));
      break;
    }

    case 'IDENTIFY': {
      const { targetId } = action.payload;

      // Find the target NPC
      const targetNpc = state.npcs.find(n => n.id === targetId);

      if (!targetNpc) {
        events.push(createEvent(state, action, 'IDENTIFY_FAILED', {
          reason: 'Target not found',
          targetId
        }));
        break;
      }

      // Reveal the target's true identity
      if (!state.player.knowledgeBase) {
        state.player.knowledgeBase = new Set();
      }
      state.player.knowledgeBase.add(`npc:${targetId}`);

      events.push(createEvent(state, action, 'NPC_IDENTIFIED', {
        npcId: targetId,
        npcName: targetNpc.name,
        npcStats: targetNpc.stats,
        hp: targetNpc.hp,
        maxHp: targetNpc.maxHp,
        message: `You have identified ${targetNpc.name}! Name: ${targetNpc.name}, Health: ${targetNpc.hp}/${targetNpc.maxHp}`
      }));
      break;
    }

    case 'PERFORM_RITUAL': {
      // Phase 13: Perform a morphing ritual at an Essence Altar
      const { targetRace } = action.payload;
      const currentRace = state.player.currentRace || 'human';

      // Check if player is at an Essence Altar
      const altar = findNearestAltar(state, state.player.location);
      if (!altar) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: 'No Essence Altar at this location',
          location: state.player.location
        }));
        break;
      }

      // Check cooldown
      const cooldown = checkMorphCooldown(state.player.lastMorphTick, state.tick || 0, state.player.recentMorphCount || 0);
      if (!cooldown.canMorph) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: `Cooldown active. Wait ${cooldown.cooldownRemaining} more ticks.`,
          cooldownRemaining: cooldown.cooldownRemaining
        }));
        break;
      }

      // Calculate morph cost
      const playerStats = state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
      const morphCost = calculateMorphCost(currentRace, targetRace, playerStats, state.player.soulStrain || 0);

      if (!morphCost.isValid) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: 'Morph cost would exceed maximum soul strain (100)',
          currentSoulStrain: state.player.soulStrain || 0,
          costRequired: morphCost.soulStrainCost
        }));
        break;
      }

      // Generate ritual challenge based on altar power and soul strain
      const challenge = generateRitualChallenge(state, targetRace, altar.power);

      // Player performs ritual check (INT + END based on stats)
      const ritualResult = performRitualCheck(state, challenge);

      if (ritualResult.success) {
        // SUCCESS: Apply stat changes and soul strain
        const morphResult = handleMorphSuccess(state, {
          success: true,
          statChanges: morphCost.statChanges,
          soulStrainGain: morphCost.soulStrainCost,
          eventType: 'MORPH_SUCCESS',
          description: `Successful transformation to ${targetRace}!`,
          essenceAltar: altar.id
        });

        events.push(createEvent(state, action, 'MORPH_SUCCESS', {
          fromRace: currentRace,
          toRace: targetRace,
          statChanges: morphCost.statChanges,
          soulStrainGain: morphCost.soulStrainCost,
          newSoulStrain: Math.min(100, (state.player.soulStrain || 0) + morphCost.soulStrainCost),
          altar: altar.name,
          message: `You have successfully transformed into a ${targetRace}!`
        }));
      } else {
        // FAILURE: Check for critical vs normal failure
        const failureResult = handleMorphFailure(state, challenge, ritualResult.passMargin);

        if (failureResult.eventType === 'VESSEL_SHATTER') {
          // CRITICAL FAILURE: Reality warps, NPCs forget player
          events.push(createEvent(state, action, 'VESSEL_SHATTER', {
            severity: 'critical',
            soulStrainGain: failureResult.soulStrainGain,
            description: 'CATASTROPHIC MORPH FAILURE! Your essence shatters. Reality forgets you were here.',
            effectsApplied: [
              'NPC knowledge of you reduced',
              'Location temporarily corrupted',
              'Severe soul strain inflicted'
            ]
          }));
        } else {
          // Normal failure: ritual backlash
          events.push(createEvent(state, action, 'MORPH_FAILURE', {
            severity: 'moderate',
            soulStrainGain: failureResult.soulStrainGain,
            newSoulStrain: Math.min(100, (state.player.soulStrain || 0) + failureResult.soulStrainGain),
            message: 'The ritual destabilizes! Your form flickers but holds.',
            trickMargin: Math.abs(ritualResult.passMargin),
            passMargin: ritualResult.passMargin
          }));
        }
      }
      break;
    }

    case 'CHECK_ESSENCE_DECAY': {
      // Phase 13: Check if player suffers essence decay from high soul strain
      const soulStrain = state.player.soulStrain || 0;
      const decay = calculateEssenceDecay(soulStrain);

      if (decay.hasPenalty) {
        events.push(createEvent(state, action, 'ESSENCE_DECAY', {
          currentSoulStrain: soulStrain,
          penaltyAmount: decay.penaltyAmount,
          message: `Your essence decays. All stats reduced by ${decay.penaltyAmount}.`,
          affectedStats: ['str', 'agi', 'int', 'cha', 'end', 'luk']
        }));
      }
      break;
    }

    case 'TRAVEL': {
      // Phase 14: Begin travel to a new location
      const { targetLocationId } = action.payload;

      // Calculate travel distance
      const travelTicks = calculateTravelDistance(state.player.location, targetLocationId);

      // Create travel state
      events.push(createEvent(state, action, 'TRAVEL_STARTED', {
        fromLocation: state.player.location,
        toLocation: targetLocationId,
        estimatedTicks: travelTicks,
        message: `You begin your journey to ${targetLocationId}. It will take approximately ${travelTicks} ticks to arrive.`
      }));

      break;
    }

    case 'TRAVEL_TICK': {
      // Phase 14: Process one tick of travel
      // Check for encounters during travel
      if (!state.travelState || !state.travelState.isTraveling) {
        events.push(createEvent(state, action, 'TRAVEL_NOT_ACTIVE', {
          reason: 'No active travel in progress'
        }));
        break;
      }

      const travelState = state.travelState;
      const biome = getLocationBiome(state.player.location);

      // Get encounter table for current biome
      const encounterTables = (encountersData as any).encounters;
      const encounterTable = encounterTables[biome];

      if (!encounterTable) {
        events.push(createEvent(state, action, 'TRAVEL_TICK', {
          remainingTicks: Math.max(0, travelState.remainingTicks - 1)
        }));
        break;
      }

      // Roll for encounter on this tick
      if (!travelState.encounterRolled) {
        const encounterChance = calculateEncounterChance(state, biome, encounterTable, 1);
        const roll = random() * 100;

        if (roll < encounterChance) {
          // Encounter triggered!
          const encounter = selectEncounterType(encounterTable, state.player.level || 1);

          if (encounter) {
            let encounterNpc = null;
            let eventType = 'ENCOUNTER_TRIGGERED';

            // Generate NPC or combatant based on encounter type
            if (encounter.type === 'combat') {
              encounterNpc = generateEncounterCombatant(encounter, state);
            } else {
              encounterNpc = generateEncounterNpc(encounter, state);
            }

            events.push(createEvent(state, action, eventType, {
              encounterName: encounter.name,
              encounterType: encounter.type,
              encounterRarity: encounter.rarity,
              npcId: encounterNpc.id,
              description: encounter.description,
              message: `An encounter begins! ${encounter.description}`
            }));
          }
        } else {
          // No encounter this tick, continue traveling
          events.push(createEvent(state, action, 'TRAVEL_TICK', {
            remainingTicks: Math.max(0, travelState.remainingTicks - 1),
            message: 'You continue on your journey...'
          }));
        }
      }
      break;
    }

    case 'SEARCH_AREA': {
      // Phase 14 + M9 Phase 3: Search current location for hidden areas and sub-areas
      const currentLocation = state.player.location;
      const locationObj = state.locations.find(loc => loc.id === currentLocation);

      if (!locationObj) {
        events.push(createEvent(state, action, 'SEARCH_NO_LOCATION', {
          location: currentLocation,
          message: 'Location not found.'
        }));
        break;
      }

      // M9 Phase 3: Check for undiscovered sub-areas first
      const undiscoveredSubAreas = (locationObj.subAreas || []).filter(sa => !sa.discovered);

      if (undiscoveredSubAreas.length > 0) {
        // Calculate search difficulty (use sub-area difficulty if available)
        const targetSubArea = undiscoveredSubAreas[Math.floor(random() * undiscoveredSubAreas.length)];
        const difficulty = targetSubArea.difficulty || calculateSearchDifficulty(currentLocation);
        const playerInt = state.player.stats?.int || 10;
        const playerLuk = state.player.stats?.luk || 10;

        // Perform search check
        const searchResult = performSearchCheck(playerInt, playerLuk, difficulty);

        if (searchResult.success) {
          // Success! Discover the sub-area
          targetSubArea.discovered = true;

          events.push(createEvent(state, action, 'SUB_AREA_DISCOVERED', {
            subAreaId: targetSubArea.id,
            subAreaName: targetSubArea.name,
            subAreaDescription: targetSubArea.description,
            parentLocation: currentLocation,
            environmentalEffects: targetSubArea.environmentalEffects || [],
            roll: searchResult.roll,
            dc: searchResult.dc,
            margin: searchResult.margin,
            message: `Hidden depths revealed: ${targetSubArea.name}! ${targetSubArea.description}`
          }));
        } else {
          // Failed search
          events.push(createEvent(state, action, 'SEARCH_FAILED', {
            location: currentLocation,
            searchType: 'subarea',
            roll: searchResult.roll,
            dc: searchResult.dc,
            margin: searchResult.margin,
            message: `Your search of the area yields nothing. (Failed by ${Math.abs(searchResult.margin)})`
          }));
        }
        break;
      }

      // Fallback to legacy hidden areas if no sub-areas
      if (!hasHiddenAreas(currentLocation)) {
        events.push(createEvent(state, action, 'SEARCH_NO_SECRETS', {
          location: currentLocation,
          message: 'You search thoroughly but find nothing hidden here.'
        }));
        break;
      }

      // Calculate search difficulty
      const difficulty = calculateSearchDifficulty(currentLocation);
      const playerInt = state.player.stats?.int || 10;
      const playerLuk = state.player.stats?.luk || 10;

      // Perform search check
      const searchResult = performSearchCheck(playerInt, playerLuk, difficulty);

      if (searchResult.success) {
        // Success! Discover a random hidden area
        const hiddenAreas = (encountersData as any).hiddenAreas[currentLocation] || [];
        if (hiddenAreas.length > 0) {
          const discoveredArea = hiddenAreas[Math.floor(random() * hiddenAreas.length)];

          events.push(createEvent(state, action, 'LOCATION_DISCOVERED', {
            areaId: discoveredArea.id,
            areaName: discoveredArea.name,
            areaDescription: discoveredArea.description,
            location: currentLocation,
            roll: searchResult.roll,
            dc: searchResult.dc,
            margin: searchResult.margin,
            message: `You discover: ${discoveredArea.name}! ${discoveredArea.description}`
          }));
        }
      } else {
        // Failed search
        events.push(createEvent(state, action, 'SEARCH_FAILED', {
          location: currentLocation,
          roll: searchResult.roll,
          dc: searchResult.dc,
          margin: searchResult.margin,
          message: `Your search yields nothing. (Failed by ${Math.abs(searchResult.margin)})`
        }));
      }
      break;
    }

    case 'INFUSE_ITEM': {
      // Phase 15: Infuse a rune into a relic, granting it magical properties
      const { relicId, runeId } = action.payload;

      const relic = state.relics?.[relicId];
      if (!relic) {
        events.push(createEvent(state, action, 'INFUSION_FAILED', {
          reason: 'Relic not found',
          message: 'That relic does not exist.'
        }));
        break;
      }

      const rune = (runesData as any).runes?.find((r: any) => r.id === runeId);
      if (!rune) {
        events.push(createEvent(state, action, 'INFUSION_FAILED', {
          reason: 'Rune not found',
          message: 'That rune does not exist.'
        }));
        break;
      }

      // Check if player has the rune in inventory
      const runeInventory = state.player.runicInventory || [];
      const runeInInv = runeInventory.find((r) => r.runeId === runeId);
      if (!runeInInv || runeInInv.quantity === 0) {
        events.push(createEvent(state, action, 'INFUSION_FAILED', {
          reason: 'Rune not in inventory',
          message: 'You do not have that rune.'
        }));
        break;
      }

      // Check stability
      const stability = checkInfusionStability(relic, rune, state.player, state.player.temporalDebt || 0);
      if (!stability.stable && random() > 0.5) {
        // High-risk infusion fails
        events.push(createEvent(state, action, 'INFUSION_FAILED', {
          reason: 'Instability cascade',
          risk: stability.risk,
          message: `Infusion failed! Rune and relic backlash. ${stability.message}`
        }));
        break;
      }

      // Find empty rune slot
      const emptySlot = relic.runicSlots.find((s) => !s.runeId);
      if (!emptySlot) {
        events.push(createEvent(state, action, 'INFUSION_FAILED', {
          reason: 'No empty slots',
          message: 'This relic has no empty rune slots.'
        }));
        break;
      }

      // Success! Infuse the rune
      emptySlot.runeId = runeId;
      relic.totalComplexity = (relic.totalComplexity || 0) + rune.complexity;

      // Deduct mana if required
      if (rune.manaCost && state.player.mp) {
        state.player.mp = Math.max(0, state.player.mp - rune.manaCost);
      }

      // Track infusion history for corruption calculation
      const infusionHistory = state.player.infusionHistory || [];
      infusionHistory.push({ relicId, runeId, timestamp: state.tick || 0 });

      // Deduct rune from inventory
      if (runeInInv.quantity > 0) {
        runeInInv.quantity--;
      }

      events.push(createEvent(state, action, 'RUNE_INFUSED', {
        relicId,
        relicName: relic.name,
        runeId,
        runeName: rune.name,
        message: `You successfully infuse ${rune.name} into ${relic.name}!`,
        stability: stability.risk
      }));
      break;
    }

    case 'SOUL_BIND': {
      // Phase 15: Permanently bind a relic to the player
      // This grants massive bonuses but makes the relic impossible to unequip without high soul strain cost
      const { relicId } = action.payload;

      const relic = state.relics?.[relicId];
      if (!relic) {
        events.push(createEvent(state, action, 'BINDING_FAILED', {
          reason: 'Relic not found',
          message: 'That relic does not exist.'
        }));
        break;
      }

      if (state.player.boundRelicId) {
        events.push(createEvent(state, action, 'BINDING_FAILED', {
          reason: 'Already bound',
          message: `You are already bound to ${state.relics?.[state.player.boundRelicId]?.name || 'another relic'}.`
        }));
        break;
      }

      // Binding ritual cost in mana
      const bindingCost = (relic.sentienceLevel + 1) * 20;
      if ((state.player.mp || 0) < bindingCost) {
        events.push(createEvent(state, action, 'BINDING_FAILED', {
          reason: 'Insufficient mana',
          requiredMana: bindingCost,
          currentMana: state.player.mp,
          message: `You need ${bindingCost} mana to bind this relic. You only have ${state.player.mp || 0}.`
        }));
        break;
      }

      // Perform binding ritual (charisma check)
      const playerCha = state.player.stats?.cha || 10;
      const dc = 12 + relic.sentienceLevel; // Higher sentiency = harder to bind
      const roll = Math.floor(random() * 20) + 1;
      const totalRoll = roll + Math.floor(playerCha / 2);

      if (totalRoll < dc) {
        events.push(createEvent(state, action, 'BINDING_FAILED', {
          reason: 'Ritual rejection',
          roll,
          dc,
          message: `${relic.name} rejects your binding attempt! It resists your will.`
        }));
        break;
      }

      // Success! Bind the relic
      state.player.boundRelicId = relicId;
      relic.isBound = true;
      relic.ownerId = state.player.id;
      relic.boundSoulStrain = calculateUnbindCost(relic, state.player.temporalDebt || 0);

      // Deduct mana
      state.player.mp = (state.player.mp || 0) - bindingCost;

      // Log relic dialogue
      const dialogueMessage = generateRelicDialogue(relic, 'greeting');

      events.push(createEvent(state, action, 'RELIC_BOUND', {
        relicId,
        relicName: relic.name,
        soulStrain: relic.boundSoulStrain,
        dialogue: dialogueMessage,
        message: `You are now bound to ${relic.name}! Its power surges through you. "${dialogueMessage}"`
      }));

      // Log the dialogue in relic events
      const relicEvents = state.relicEvents || [];
      relicEvents.push({
        type: 'dialogue',
        relicId,
        tick: state.tick || 0,
        message: dialogueMessage
      });
      break;
    }

    case 'UNBIND_RELIC': {
      // Phase 15: Break the soul bond with a relic
      const boundRelicId = state.player.boundRelicId;
      if (!boundRelicId) {
        events.push(createEvent(state, action, 'UNBINDING_FAILED', {
          reason: 'Not bound',
          message: 'You are not bound to any relic.'
        }));
        break;
      }

      const relic = state.relics?.[boundRelicId];
      if (!relic) {
        events.push(createEvent(state, action, 'UNBINDING_FAILED', {
          reason: 'Relic not found',
          message: 'Your bound relic could not be found.'
        }));
        break;
      }

      const unbindCost = relic.boundSoulStrain || 0;
      const currentSoulStrain = state.player.soulStrain || 0;

      if (currentSoulStrain < unbindCost) {
        events.push(createEvent(state, action, 'UNBINDING_FAILED', {
          reason: 'Insufficient soul strain capacity',
          requiredStrain: unbindCost,
          currentStrain: currentSoulStrain,
          message: `This relic is deeply bonded to your soul. Breaking the bond requires ${unbindCost} soul strain. You only have ${currentSoulStrain}.`
        }));
        break;
      }

      // Perform unbinding ritual (wisdom check - using INT as proxy)
      const playerWis = state.player.stats?.int || 10;
      const dc = 10 + relic.sentienceLevel;
      const roll = Math.floor(random() * 20) + 1;
      const totalRoll = roll + Math.floor(playerWis / 2);

      if (totalRoll < dc) {
        events.push(createEvent(state, action, 'UNBINDING_FAILED', {
          reason: 'Ritual failure',
          roll,
          dc,
          message: `${relic.name} fights back! The unbinding ritual fails.`
        }));
        break;
      }

      // Success! Unbind the relic
      state.player.boundRelicId = undefined;
      relic.isBound = false;
      state.player.soulStrain = (state.player.soulStrain || 0) + unbindCost;

      events.push(createEvent(state, action, 'RELIC_UNBOUND', {
        relicId: boundRelicId,
        relicName: relic.name,
        soulStrainCost: unbindCost,
        message: `You have severed your bond with ${relic.name}. Soul strain increases by ${unbindCost}.`
      }));
      break;
    }

    case 'TOGGLE_SYNTHESIS': {
      // M21 Developer: Toggle AI synthesis mode for NPC dialogue
      const { enabled } = action.payload || { enabled: undefined };
      
      if (typeof enabled !== 'boolean') {
        events.push(createEvent(state, action, 'SYNTHESIS_TOGGLE_FAILED', {
          reason: 'Invalid payload',
          message: 'Payload must include "enabled": true or false'
        }));
        break;
      }

      // Import and call the setter from npcEngine
      try {
        const { setSynthesisModeEnabled } = require('./npcEngine');
        setSynthesisModeEnabled(enabled);
        
        events.push(createEvent(state, action, 'SYNTHESIS_TOGGLED', {
          enabled,
          message: `AI synthesis mode ${enabled ? 'enabled' : 'disabled'}.`
        }));
      } catch (error) {
        events.push(createEvent(state, action, 'SYNTHESIS_TOGGLE_FAILED', {
          reason: 'Module import error',
          message: 'Failed to toggle synthesis mode.'
        }));
      }
      break;
    }

  }

  // Death detection: if player HP reaches 0, emit PLAYER_DEFEATED
  if (state.player && state.player.hp !== undefined && state.player.hp <= 0 && !events.some(e => e.type === 'PLAYER_DEFEATED')) {
    events.push(createEvent(state, action, 'PLAYER_DEFEATED', {
      defeatLocation: state.player.location,
      message: 'You have been defeated! You wake up back in Eldergrove Village with 50% HP restored.'
    }));
  }

  return events;
}