import { WorldState } from './worldEngine';
import { Event } from '../events/mutationLog';
import { createPlayerCharacter, validateStatAllocation } from './characterCreation';
import { resolveCombat, resolveDefense, resolveParry, resolveHeal, CombatantStats, getEquipmentBonuses, applyEquipmentBonuses } from './ruleEngine';
import { isNpcAvailable, resolveDialogue } from './npcEngine';
import { resolveLootTable, validateRecipe, rollCraftingCheck, deductMaterials, addCraftResult, type Recipe } from './craftingEngine';
import itemsData from '../data/items.json';

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

export type Action = {
  worldId: string;
  playerId: string;
  type: string;
  payload: any;
};

function createEvent(state: WorldState, action: Action, type: string, payload: any): Event {
  return {
    id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    worldInstanceId: state.id,
    actorId: state.player.id,
    type,
    payload,
    templateOrigin: state.metadata?.templateOrigin,
    timestamp: Date.now(),
  };
}

export function processAction(state: WorldState, action: Action): Event[] {
  const events: Event[] = [];

  switch (action.type) {
    case 'MOVE': {
      const to = action.payload?.to;
      if (!to || !state.locations.find(loc => loc.id === to)) {
        // Invalid location - no event
        return [];
      }
      events.push(createEvent(state, action, 'MOVE', { from: state.player.location, to }));
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

      // Get defender stats
      const defenderStats: Record<string, CombatantStats> = {
        [defenderId]: (defender.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 })
      };

      // Resolve combat using ruleEngine
      const combatEvents = resolveCombat(
        state.player.id,
        [defenderId],
        playerStats,
        defenderStats,
        state.id
      );
      events.push(...combatEvents);
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

      // Simulate an incoming attack of moderate damage
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

      // Simulate incoming damage
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
      // Rest action: restore 10% HP per game hour spent resting
      const currentHp = state.player.hp || 100;
      const maxHp = state.player.maxHp || 100;
      const hpPerRest = Math.ceil(maxHp * 0.1); // 10% per hour
      const newHp = Math.min(maxHp, currentHp + hpPerRest);
      const hpRestored = newHp - currentHp;

      events.push(createEvent(state, action, 'PLAYER_REST', {
        hpRestored,
        newHp,
        maxHp,
        hoursCost: 1,
        message: `Rested 1 hour. HP restored: ${hpRestored}`
      }));
      break;
    }

    case 'SUBMIT_CHARACTER': {
      const { name, race, stats } = action.payload;
      if (!name || !race || !stats || !validateStatAllocation(stats)) {
        return []; // Invalid character creation
      }
      try {
        const character = createPlayerCharacter(name, race, stats);
        events.push(createEvent(state, action, 'CHARACTER_CREATED', { character }));
      } catch {
        return []; // Error creating character
      }
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
          quantity: item.quantity,
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

      events.push(createEvent(state, action, 'PLAYER_LEVELED_UP', {
        newLevel,
        attributePointsGranted: 2
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

  }

  return events;
}