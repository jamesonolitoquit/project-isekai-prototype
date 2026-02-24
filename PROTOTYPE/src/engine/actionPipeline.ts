import { WorldState, type ItemsDataFile, type EncountersDataFile, type RunesDataFile } from './worldEngine';
import { Event } from '../events/mutationLog';
import { random } from './prng';
import type { DiceRollContext } from '../client/components/DiceAltar';
import { createPlayerCharacter, validateStatAllocation } from './characterCreation';
import { resolveCombat, resolveDefense, resolveParry, resolveHeal, CombatantStats, getEquipmentBonuses, applyEquipmentBonuses } from './ruleEngine';
import { isNpcAvailable, resolveDialogue } from './npcEngine';
import { resolveLootTable, validateRecipe, rollCraftingCheck, deductMaterials, addCraftResult, type Recipe, type LootTableEntry } from './craftingEngine';
import { resolveSpell, getSpellById } from './magicEngine';
import { calculateDrift, validateAuthority, getParadoxSeverity, checkForSpellBackfire } from './paradoxEngine';
import { calculateMorphCost, generateRitualChallenge, performRitualCheck, handleMorphSuccess, handleMorphFailure, calculateEssenceDecay, checkMorphCooldown, findNearestAltar } from './morphEngine';
import { calculateEncounterChance, selectEncounterType, generateEncounterNpc, generateEncounterCombatant, calculateTravelDistance, hasHiddenAreas, getLocationBiome, calculateSearchDifficulty, performSearchCheck } from './encounterEngine';
import { calculateRelicBonus, shouldRelicRebel, checkInfusionStability, calculateUnbindCost, isRelicRebelling, generateRelicDialogue, applyRelicRebellion, getWieldingRequirement, calculateItemCorruption } from './artifactEngine';
import { getAbility } from './skillEngine';
import { getNpcMemoryEngine } from './npcMemoryEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import { getLocationControllingFaction, isHostileTerritory, calculateFactionTax } from './factionTerritoryEngine';
import { getQuestSynthesisAI } from './questSynthesisAI';
import { getInvestigationPipeline } from './investigationPipelineEngine';
import { beliefEngine } from './beliefEngine';
import { isStackable } from './worldEngine'; // Phase 19: For resource harvesting
import { MarketEngine, type ItemCategory } from './marketEngine';
// Phase 27 Task 2: Oracle Consensus for multiplayer action validation
import { isConsentProposal, type ConsentProposal } from './oracleConsensusEngine';
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
const ITEM_TEMPLATES: Record<string, unknown> = {};
const loadedItemsData = itemsData as ItemsDataFile;
if (loadedItemsData.items && Array.isArray(loadedItemsData.items)) {
  loadedItemsData.items.forEach((item) => {
    ITEM_TEMPLATES[item.id] = item;
  });
}

// Build recipe map from items.json
const RECIPES: Record<string, Recipe> = {};
if (loadedItemsData.recipes && Array.isArray(loadedItemsData.recipes)) {
  loadedItemsData.recipes.forEach((recipe) => {
    RECIPES[recipe.id] = recipe as Recipe;
  });
}

// Build loot tables map from items.json
const LOOT_TABLES: Record<string, Array<{ itemId: string; weight: number; quantity?: number }>> = {};
if (loadedItemsData.loot_tables && typeof loadedItemsData.loot_tables === 'object') {
  Object.entries(loadedItemsData.loot_tables).forEach(([tableId, entries]) => {
    LOOT_TABLES[tableId] = entries;
  });
}

// M44-E1: Initialize Market Engine singleton
let marketEngineInstance: MarketEngine | null = null;
function getMarketEngine(): MarketEngine {
  if (!marketEngineInstance) {
    marketEngineInstance = new MarketEngine();
  }
  return marketEngineInstance;
}

// Phase 13: Legacy Engine singleton
let legacyEngineInstance: any = null;
function getLegacyEngine(): any {
  if (!legacyEngineInstance) {
    try {
      const { getLegacyEngine: importedGetLegacyEngine } = require('./legacyEngine');
      legacyEngineInstance = importedGetLegacyEngine(12345);
    } catch (e) {
      console.warn('[actionPipeline] Failed to initialize legacy engine:', e);
      return null;
    }
  }
  return legacyEngineInstance;
}

/**
 * Phase 13: Calculate ancestral boons based on selected deeds and myth status
 */
function calculateAncestralBoonsForAscension(mythStatus: number, selectedDeeds: string[]): any[] {
  const boons: any[] = [];
  
  // Base boon from myth status
  if (mythStatus >= 50) {
    boons.push({
      id: 'ancestral_resonance_soul',
      name: 'Resonant Soul',
      description: `Your lineage echoes with power. +${Math.floor(mythStatus * 0.1)} to mental stats.`,
      bonusType: 'stat',
      targetStat: 'int',
      magnitude: Math.floor(mythStatus * 0.1),
      duration: 'permanent',
      deedSource: selectedDeeds[0] || 'legacy_start'
    });
  }
  
  if (mythStatus >= 75) {
    boons.push({
      id: 'ancestral_warrior_strength',
      name: 'Warrior\'s Inheritance',
      description: 'Battle-forged lineage grants martial prowess. +15% critical chance.',
      bonusType: 'ability',
      magnitude: 0.15,
      duration: 'permanent',
      deedSource: selectedDeeds[1] || 'legacy_combat'
    });
  }
  
  if (mythStatus >= 100) {
    boons.push({
      id: 'ancestral_legendary_echo',
      name: 'Legendary Resonance',
      description: 'Your bloodline has shaped epochs. +25% to all faction reputation gains.',
      bonusType: 'special',
      magnitude: 0.25,
      duration: 'permanent',
      deedSource: selectedDeeds[2] || 'legend_maker'
    });
  }
  
  return boons;
}

/**
 * Phase 13: Generate curses from accumulated generational paradox
 */
function generateCursesFromParadox(generationalParadox: number): any[] {
  const curses: any[] = [];
  
  if (generationalParadox >= 150 && generationalParadox < 225) {
    // Minor curse
    curses.push({
      id: 'paradox_curse_minor',
      name: 'Tainted Bloodline',
      description: 'The paradox of your lineage manifests as frailty. -5 to physical stats.',
      penaltyType: 'stat',
      targetStat: 'str',
      magnitude: 5,
      duration: 'epoch',
      paradoxSource: generationalParadox
    });
  }
  
  if (generationalParadox >= 225 && generationalParadox < 300) {
    // Major curses
    curses.push({
      id: 'paradox_curse_echo_conflict',
      name: 'Echo Conflict',
      description: 'Ancestor voices whisper contradictory guidance. -10 to wisdom.',
      penaltyType: 'stat',
      targetStat: 'wis',
      magnitude: 10,
      duration: 'temporary',
      paradoxSource: generationalParadox
    });
    
    curses.push({
      id: 'paradox_curse_fate_marked',
      name: 'Marked by Fate',
      description: 'You are cursed by temporal anomalies. -15% to all resistances.',
      penaltyType: 'vulnerability',
      magnitude: 0.15,
      duration: 'epoch',
      paradoxSource: generationalParadox
    });
  }
  
  if (generationalParadox >= 300) {
    // Catastrophic curse
    curses.push({
      id: 'paradox_curse_catastrophic',
      name: 'Paradox Unbound',
      description: 'Your timeline fractures. Reality itself rejects your existence. -20% to all stats.',
      penaltyType: 'curse',
      magnitude: 0.20,
      duration: 'permanent',
      paradoxSource: generationalParadox
    });
  }
  
  return curses;
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
  // Phase 27 Task 2: Oracle Consensus fields
  pendingConsentVerdictId?: string;  // If action awaits Oracle verdict, track verdict ID
  consentStatus?: 'PENDING' | 'GRANTED' | 'DENIED';  // Multiplayer consent state
};

/**
 * Phase 27 Task 2: Identify if an action requires Oracle Consensus
 * Contestable actions target shared entities (items, NPCs, resources)
 */
function isContestableAction(actionType: string): boolean {
  const contestableActions = [
    'PICK_UP_ITEM',      // Unique items can only be picked by one player
    'INTERACT_NPC',      // Each NPC can be interacted with by one player per tick
    'BUY_ITEM',          // Prevent overbuy from limited shop stocks
    'USE_RESOURCE_NODE', // Resource harvesting is not fully shareable initially
  ];
  return contestableActions.includes(actionType);
}

/**
 * Phase 27 Task 2: Get consensus target info for contestable action
 * Returns the entity ID and type that needs Oracle approval
 */
function getConsensusTarget(action: Action): { targetId: string; targetType: 'ITEM' | 'NPC' | 'SHOP_STOCK' | 'RESOURCE_NODE' } | null {
  switch (action.type) {
    case 'PICK_UP_ITEM': {
      const itemId = action.payload?.itemId;
      const item = action.payload?.item;
      if (!itemId || !item) return null;
      return { targetId: itemId, targetType: 'ITEM' };
    }
    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      if (!npcId) return null;
      return { targetId: npcId, targetType: 'NPC' };
    }
    case 'BUY_ITEM': {
      const shopId = action.payload?.shopId || 'market-default';
      const itemId = action.payload?.itemId;
      if (!itemId) return null;
      return { targetId: `${shopId}:${itemId}`, targetType: 'SHOP_STOCK' };
    }
    case 'USE_RESOURCE_NODE': {
      const nodeId = action.payload?.nodeId;
      if (!nodeId) return null;
      return { targetId: nodeId, targetType: 'RESOURCE_NODE' };
    }
    default:
      return null;
  }
}

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

  // M44-T1: Sync memory and warfare engines with current state
  // This ensures deterministic calculations based on event-rebuilt state
  getNpcMemoryEngine().syncWithState(state);
  getFactionWarfareEngine().syncWithState(state);

  // Phase 27 Task 2: Oracle Consensus Check for Multiplayer Actions
  // If action is contestable (targets shared entity) and we're in multiplayer mode,
  // check if the action has Oracle consent
  if (action.clientId && isContestableAction(action.type)) {
    const consensusTarget = getConsensusTarget(action);

    if (consensusTarget) {
      // Check if we're waiting for a verdict
      if (action.consentStatus === 'PENDING') {
        // Oracle verdict hasn't arrived yet; emit PENDING_CONSENT event
        events.push(createEvent(state, action, 'ACTION_PENDING_CONSENT', {
          actionType: action.type,
          targetId: consensusTarget.targetId,
          targetType: consensusTarget.targetType,
          verdictId: action.pendingConsentVerdictId,
          message: 'Waiting for Oracle consensus...'
        }));
        return events;  // Stop processing until verdict arrives
      }

      if (action.consentStatus === 'DENIED') {
        // Oracle denied this action; emit conflict resolution event
        events.push(createEvent(state, action, 'ACTION_FAILED_RESOLVED_CONFLICT', {
          actionType: action.type,
          targetId: consensusTarget.targetId,
          reason: action.payload?.conflictReason || 'Oracle consensus denied due to simultaneous action',
          verdictId: action.payload?.verdictId
        }));
        return events;  // Stop processing; action rejected
      }

      // If consentStatus === 'GRANTED' or undefined, continue processing normally
      // The action is either pre-approved or doesn't need multiplayer consensus
    }
  }  // Phase 12: Check AI DM authority - is this action permitted by the cosmos?
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

      // M44-T1: Log memory of this choice if it has sentiment/impact
      const dialogueResult = resolveDialogue(npc, state.player, state);
      const chosenOption = dialogueResult.options.find(opt => opt.id === choiceId);

      if (chosenOption && (chosenOption.sentiment !== undefined || chosenOption.impact !== undefined)) {
        events.push(createEvent(state, action, 'NPC_MEMORY_LOGGED', {
          npcId,
          interaction: {
            timestamp: state.tick || 0,
            npcId,
            playerId: state.player.id,
            action: `dialogue_${choiceId}`,
            sentiment: chosenOption.sentiment || 0,
            impactScore: chosenOption.impact || 0.1,
            description: `Player chose: "${chosenOption.text}"`
          }
        }));
      }

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

    case 'START_INVESTIGATION': {
      // M49-A2: Rumor Investigation Pipeline
      const rumorId = action.payload?.rumorId;
      
      // Validate rumor exists in belief registry
      const believeRegistry = state.beliefRegistry || {};
      if (!believeRegistry[rumorId]) {
        events.push(createEvent(state, action, 'INVESTIGATION_FAILED', {
          reason: 'rumor-not-found',
          rumorId,
          message: 'This rumor cannot be found in your knowledge.'
        }));
        return events;
      }

      // Check if investigation already active for this rumor
      const existingInvestigation = (state.investigations || []).find(inv => inv.targetRumorId === rumorId && inv.status === 'active');
      if (existingInvestigation) {
        events.push(createEvent(state, action, 'INVESTIGATION_ALREADY_ACTIVE', {
          rumorId,
          investigationId: existingInvestigation.id,
          message: 'You are already investigating this rumor.'
        }));
        return events;
      }

      // Determine cost: 50 Gold or 20 MP fallback
      const goldItem = state.player.inventory?.find(item => 
        (item as any).kind === 'stackable' && (item as any).itemId === 'gold'
      ) as any;
      const playerGold = goldItem?.quantity || 0;
      const INVESTIGATION_COST_GOLD = 50;
      const INVESTIGATION_COST_MP = 20;

      let costUsed: 'gold' | 'mp';
      let costAmount: number;

      if (playerGold >= INVESTIGATION_COST_GOLD) {
        // Use gold
        if (goldItem) {
          goldItem.quantity = (goldItem.quantity || 0) - INVESTIGATION_COST_GOLD;
        }
        costUsed = 'gold';
        costAmount = INVESTIGATION_COST_GOLD;
      } else if ((state.player.mp || 0) >= INVESTIGATION_COST_MP) {
        // Fallback to MP (scrying cost)
        state.player.mp = (state.player.mp || 0) - INVESTIGATION_COST_MP;
        costUsed = 'mp';
        costAmount = INVESTIGATION_COST_MP;
      } else {
        // Insufficient resources
        events.push(createEvent(state, action, 'INVESTIGATION_INSUFFICIENT_RESOURCES', {
          rumorId,
          requiredGold: INVESTIGATION_COST_GOLD,
          availableGold: playerGold,
          requiredMp: INVESTIGATION_COST_MP,
          availableMp: state.player.mp || 0,
          message: 'You lack sufficient Gold (50) or MP (20) to begin this investigation.'
        }));
        return events;
      }

      // Create investigation via pipeline
      const investigationPipeline = getInvestigationPipeline();
      const rumor = beliefEngine.getRumorById(rumorId);
      const hardFact = beliefEngine.getOriginalFact(rumorId);
      
      if (!rumor || !hardFact) {
        events.push(createEvent(state, action, 'INVESTIGATION_FAILED', {
          reason: 'rumor-or-fact-not-found',
          rumorId,
          message: 'Cannot start investigation: rumor or associated fact not found.'
        }));
        return events;
      }
      
      const investigation = investigationPipeline.startInvestigation(
        `quest_${rumorId}_${Date.now()}`, // questId
        rumor,
        hardFact,
        state.tick || 0
      );

      // Add to world state investigations
      if (!state.investigations) {
        state.investigations = [];
      }
      state.investigations.push(investigation);

      // Emit event
      const costMessage = costUsed === 'gold' ? `${costAmount} Gold` : `${costAmount} MP`;
      events.push(createEvent(state, action, 'INVESTIGATION_STARTED', {
        rumorId,
        investigationId: investigation.id,
        costUsed,
        costAmount,
        message: `You begin investigating the rumor. (${costMessage} invested)`
      }));

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
          if (objective?.timeConstraints) {
            const tc = objective.timeConstraints;
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

      if (defenderDefeatedEvent && defender.factionId) {
        const defenderFactionId = defender.factionId;
        events.push(createEvent(state, action, 'FACTION_COMBAT_VICTORY', {
          victoryType: 'defeated_npc',
          defenderNpcId: defenderId,
          defenderFactionId: defenderFactionId,
          victoryFactionId: 'player',
          reputationGain: 10,
          powerGain: 3
        }));

        // Auto-loot
        const lootTableId = defender.lootTable || 'common_npc';
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
      // M44-T4: Enhanced REST with Chrono-Action time advancement
      // Support for SHORT_REST (60 ticks = 1 hour) and LONG_REST (480 ticks = 8 hours)
      const restType = action.payload?.restType || 'SHORT_REST'; // default: 1 hour
      const tickAdvance = restType === 'LONG_REST' ? 480 : 60; // 8 hours or 1 hour
      const hoursAdvanced = tickAdvance / 60;

      // Calculate HP recovery based on duration
      const currentHp = state.player.hp || 100;
      const maxHp = state.player.maxHp || 100;
      const hpRecoveryPercentPerHour = restType === 'LONG_REST' ? 0.125 : 0.05; // 100%/8h or 20%/1h
      const hpPercentRestored = Math.min(1.0, hpRecoveryPercentPerHour * hoursAdvanced);
      const hpRestored = Math.ceil(maxHp * hpPercentRestored);
      const newHp = Math.min(maxHp, currentHp + hpRestored);

      // Calculate MP recovery (faster than HP)
      const currentMp = state.player.mp ?? 0;
      const maxMp = state.player.maxMp ?? 0;
      const mpRecoveryPercentPerHour = restType === 'LONG_REST' ? 0.25 : 0.125; // 100%/4h or 50%/1h
      const mpPercentRestored = Math.min(1.0, mpRecoveryPercentPerHour * hoursAdvanced);
      const mpRestored = Math.ceil(maxMp * mpPercentRestored);
      const newMp = Math.min(maxMp, currentMp + mpRestored);

      // M44-T2: Trigger faction skirmishes during the time jump
      const factionEngine = getFactionWarfareEngine();
      const locationIds = (state.locations || []).map((loc) => loc.id);
      const skirmishes = factionEngine.processChronoActionSkirmishes(
        locationIds,
        tickAdvance,
        (state.tick || 0),
        state.seed
      );

      // Create individual FACTION_SKIRMISH events for each processed skirmish
      for (const skirmish of skirmishes) {
        events.push(createEvent(state, action, 'FACTION_SKIRMISH', {
          locationId: skirmish.locationId,
          aggressor: skirmish.aggressor,
          defender: skirmish.defender,
          outcome: skirmish.outcome,
          influenceShift: skirmish.influenceShift,
          casualties: skirmish.casualties
        }));
      }

      // M44-T3: Synthesize quests from faction changes
      const questSynthesis = getQuestSynthesisAI();
      const newQuests: any[] = [];

      for (const location of state.locations || []) {
        const warZone = factionEngine.getWarZoneStatus(location.id);
        const nearbyNpcs = (state.npcs || [])
          .filter((npc) => npc.locationId === location.id)
          .map((npc) => npc.id);

        if (nearbyNpcs.length > 0) {
          const generatedQuests = questSynthesis.synthesizeQuestsFromWarfare(
            location.id,
            warZone,
            nearbyNpcs,
            (state.tick || 0) + tickAdvance
          );
          newQuests.push(...generatedQuests);
          for (const quest of generatedQuests) {
            (questSynthesis as any).registerGeneratedQuest(quest);
            events.push(createEvent(state, action, 'QUEST_DISCOVERED', { quest }));
          }
        }
      }

      // Generate the event
      events.push(createEvent(state, action, 'CHRONO_ACTION_REST', {
        restType,
        ticksAdvanced: tickAdvance,
        hoursAdvanced,
        hpRestored,
        newHp,
        maxHp,
        mpRestored,
        newMp,
        maxMp,
        skirmishesTriggered: skirmishes.length,
        skirmishDetails: skirmishes.map((s) => ({
          location: s.locationId,
          outcome: s.outcome,
          casualties: s.casualties,
        })),
        questsGenerated: newQuests.length,
        message: `${restType === 'LONG_REST' ? 'Long rested' : 'Rested'} ${hoursAdvanced}h. HP +${hpRestored}, MP +${mpRestored}. ${skirmishes.length} faction skirmishes occurred nearby.`,
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
      // M44-T4: Enhanced WAIT - similar to REST but no recovery
      // WAIT is used for active observation/listening; time still passes
      const tickAdvance = action.payload?.tickCount || 60; // default: 1 hour
      const hoursAdvanced = tickAdvance / 60;

      // M44-T2: Trigger faction skirmishes during the time jump
      const factionEngine = getFactionWarfareEngine();
      const locationIds = (state.locations || []).map((loc) => loc.id);
      const skirmishes = factionEngine.processChronoActionSkirmishes(
        locationIds,
        tickAdvance,
        (state.tick || 0),
        state.seed
      );

      // Create individual FACTION_SKIRMISH events for each processed skirmish
      for (const skirmish of skirmishes) {
        events.push(createEvent(state, action, 'FACTION_SKIRMISH', {
          locationId: skirmish.locationId,
          aggressor: skirmish.aggressor,
          defender: skirmish.defender,
          outcome: skirmish.outcome,
          influenceShift: skirmish.influenceShift,
          casualties: skirmish.casualties
        }));
      }

      // M44-T3: Synthesize quests from faction changes
      const questSynthesis = getQuestSynthesisAI();
      const newQuests: any[] = [];

      for (const location of state.locations || []) {
        const warZone = factionEngine.getWarZoneStatus(location.id);
        const nearbyNpcs = (state.npcs || [])
          .filter((npc) => npc.locationId === location.id)
          .map((npc) => npc.id);

        if (nearbyNpcs.length > 0) {
          const generatedQuests = questSynthesis.synthesizeQuestsFromWarfare(
            location.id,
            warZone,
            nearbyNpcs,
            (state.tick || 0) + tickAdvance
          );
          newQuests.push(...generatedQuests);
          for (const quest of generatedQuests) {
            (questSynthesis as any).registerGeneratedQuest(quest);
            events.push(createEvent(state, action, 'QUEST_DISCOVERED', { quest }));
          }
        }
      }

      events.push(createEvent(state, action, 'CHRONO_ACTION_WAIT', {
        ticksAdvanced: tickAdvance,
        hoursAdvanced,
        skirmishesTriggered: skirmishes.length,
        skirmishDetails: skirmishes.map((s) => ({
          location: s.locationId,
          outcome: s.outcome,
          casualties: s.casualties,
        })),
        questsGenerated: newQuests.length,
        message: `Waited ${hoursAdvanced}h. ${skirmishes.length} faction skirmishes occurred nearby. ${newQuests.length} new rumors heard.`,
      }));
      break;
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
          quantity: item.quantity || 1,
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

    case 'HARVEST_RESOURCE': {
      // Phase 19: NPC resource harvesting from biome locations
      const { locationId } = action.payload;
      const location = state.locations.find(l => l.id === locationId);
      
      if (!location) {
        events.push(createEvent(state, action, 'HARVEST_FAILED', {
          reason: 'invalid-location'
        }));
        break;
      }

      // Determine biome type and loot table
      const biomeType = location.biome || 'grassland';
      const lootTableId = location.lootTableId || `biome_${biomeType}`;
      
      // Define biome loot tables
      const biomeLootTables: Record<string, LootTableEntry[]> = {
        'biome_forest': [
          { itemId: 'wood_log', chance: 0.8, minQuantity: 2, maxQuantity: 5 },
          { itemId: 'herb_sample', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mushroom', chance: 0.3, minQuantity: 1, maxQuantity: 2 }
        ],
        'biome_grassland': [
          { itemId: 'fiber_bundle', chance: 0.7, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'herb_sample', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'wildflower_seed', chance: 0.3, minQuantity: 1, maxQuantity: 1 }
        ],
        'biome_mountain': [
          { itemId: 'stone_chunk', chance: 0.8, minQuantity: 3, maxQuantity: 6 },
          { itemId: 'ore_iron', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'crystal_shard', chance: 0.2, minQuantity: 1, maxQuantity: 1 }
        ],
        'biome_water': [
          { itemId: 'water_sample', chance: 0.9, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'shell_fragment', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'seaweed_bundle', chance: 0.4, minQuantity: 2, maxQuantity: 3 }
        ]
      };

      // Get loot table for this biome
      const lootTable = biomeLootTables[lootTableId] || biomeLootTables['biome_grassland'];
      const harvestedItems = resolveLootTable(lootTable);

      if (harvestedItems.length === 0) {
        events.push(createEvent(state, action, 'HARVEST_FAILED', {
          location: locationId,
          biome: biomeType,
          reason: 'no-resources'
        }));
        break;
      }

      // Add harvested items to player inventory
      state.player.inventory = state.player.inventory || [];
      harvestedItems.forEach(item => {
        state.player.inventory!.push(item);
      });

      events.push(createEvent(state, action, 'RESOURCE_HARVESTED', {
        location: locationId,
        biome: biomeType,
        items: harvestedItems.map(i => ({ 
          itemId: i.itemId, 
          quantity: isStackable(i) ? i.quantity : 1 
        }))
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
        combatDuration: ((state.tick || 0) - (state.combatState?.startedAt || 0))
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
        target = state.player;
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
      const spiritDensity = location?.spiritDensity ?? 0;
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
      const loadedEncountersData = encountersData as EncountersDataFile;
      const encounterTables = loadedEncountersData.encounters;
      const encounterTable = encounterTables?.find(e => e.id === biome);

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
        const loadedEncountersData = encountersData as EncountersDataFile;
        const hiddenAreas = loadedEncountersData.hiddenAreas?.[currentLocation] || [];
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

      const loadedRunesData = runesData as RunesDataFile;
      const rune = loadedRunesData.runes?.find((r) => r.id === runeId);
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

    // M44-E1: Buy Item with faction market pricing
    case 'BUY_ITEM': {
      const { itemId, quantity = 1, vendorLocationId } = action.payload;
      if (!itemId) return [];

      const item = ITEM_TEMPLATES[itemId];
      if (!item) {
        events.push(createEvent(state, action, 'PURCHASE_FAILED', {
          reason: 'item-not-found',
          itemId,
          message: 'That item does not exist.'
        }));
        return events;
      }

      const basePrice = item.price || 100;
      const vendorLocation = state.locations.find(loc => loc.id === vendorLocationId);
      if (!vendorLocation) {
        events.push(createEvent(state, action, 'PURCHASE_FAILED', {
          reason: 'vendor-location-not-found',
          message: 'Vendor location not found.'
        }));
        return events;
      }

      // M44-E1: Get faction controlling this location
      const controllingFaction = getLocationControllingFaction(state, vendorLocationId);
      const dominantFactionId = controllingFaction?.id || 'silver_flame';

      // M44-E1: Calculate price with faction multiplier
      const marketEngine = getMarketEngine();
      const itemCategory = (item.category || 'common') as ItemCategory;
      const priceMultiplier = marketEngine.getItemPriceMultiplier(itemCategory, dominantFactionId, state);
      const finalUnitPrice = Math.ceil(basePrice * priceMultiplier);
      const totalCost = finalUnitPrice * quantity;

      // Check if player has enough gold
      const playerGold = state.player.gold || 0;
      if (playerGold < totalCost) {
        events.push(createEvent(state, action, 'PURCHASE_FAILED', {
          reason: 'insufficient-gold',
          requiredGold: totalCost,
          currentGold: playerGold,
          shortage: totalCost - playerGold,
          message: `You need ${totalCost}g but only have ${playerGold}g.`
        }));
        return events;
      }

      // Success! Deduct gold and add item
      state.player.gold = playerGold - totalCost;

      // Get price breakdown for display
      const breakdown = marketEngine.getPriceBreakdown(itemCategory, basePrice, dominantFactionId);

      events.push(createEvent(state, action, 'ITEM_PURCHASED', {
        itemId,
        itemName: item.name,
        quantity,
        unitPrice: finalUnitPrice,
        totalCost,
        dominantFactionId,
        factionName: controllingFaction?.name || 'Unknown',
        discount: Math.round((1 - (priceMultiplier || 1)) * 100),
        message: `Purchased ${quantity}x ${item.name} for ${totalCost}g.`
      }));

      events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
        itemId,
        quantity,
        source: 'purchase'
      }));
      break;
    }

    // M44-E1: Repair Equipment with faction cost modifiers
    case 'REPAIR_EQUIPMENT': {
      const { equipmentId, repairType = 'full' } = action.payload;
      if (!equipmentId) return [];

      const equipment = state.relics?.[equipmentId];
      if (!equipment) {
        events.push(createEvent(state, action, 'REPAIR_FAILED', {
          reason: 'equipment-not-found',
          message: 'Equipment not found in inventory.'
        }));
        return events;
      }

      // M44-E1: Get current location faction
      const playerLocationId = state.player.location;
      const controllingFaction = getLocationControllingFaction(state, playerLocationId);
      const dominantFactionId = controllingFaction?.id || 'silver_flame';

      // Calculate repair cost based on equipment rarity/condition
      const baseCost = (equipment.sentienceLevel + 1) * 50; // Scale with power
      const marketEngine = getMarketEngine();
      
      // Treat repair service as "common" with faction multiplier
      const costMultiplier = marketEngine.getItemPriceMultiplier('common', dominantFactionId, state);
      const finalCost = Math.ceil(baseCost * costMultiplier);

      // Check if player has enough gold
      const playerGold = state.player.gold || 0;
      if (playerGold < finalCost) {
        events.push(createEvent(state, action, 'REPAIR_FAILED', {
          reason: 'insufficient-gold',
          requiredGold: finalCost,
          currentGold: playerGold,
          message: `Repair costs ${finalCost}g. You only have ${playerGold}g.`
        }));
        return events;
      }

      // Success! Apply repair
      state.player.gold = playerGold - finalCost;
      
      // Restore equipment durability (represented as reducing sentienceLevel temporary penalty)
      const durabilityCost = equipment.totalComplexity || 0;
      
      events.push(createEvent(state, action, 'EQUIPMENT_REPAIRED', {
        equipmentId,
        equipmentName: equipment.name,
        repairCost: finalCost,
        dominantFactionId,
        durabilityRestored: durabilityCost,
        message: `${equipment.name} has been repaired for ${finalCost}g.`
      }));
      break;
    }

    // M44-E1: Upgrade Property with faction investment modifiers
    case 'UPGRADE_PROPERTY': {
      const { propertyId, upgradeType } = action.payload;
      if (!propertyId || !upgradeType) return [];

      // Note: Assumes properties exist in state (from M44-C3 propertyUpgradeEngine)
      const properties = state.properties || {};
      const property = properties[propertyId];

      if (!property) {
        events.push(createEvent(state, action, 'UPGRADE_FAILED', {
          reason: 'property-not-found',
          message: 'Property not found.'
        }));
        return events;
      }

      // M44-E1: Get faction effect on upgrades
      const playerLocationId = state.player.location;
      const controllingFaction = getLocationControllingFaction(state, playerLocationId);
      const dominantFactionId = controllingFaction?.id || 'silver_flame';

      // Calculate upgrade cost (based on upgrade type and current property level)
      const baseCost = (property.level || 1) * 500; // Scales with upgrades
      const marketEngine = getMarketEngine();
      
      // Treat upgrades as "luxury" investment (faction-dependent pricing)
      const costMultiplier = marketEngine.getItemPriceMultiplier('luxury', dominantFactionId, state);
      const finalCost = Math.ceil(baseCost * costMultiplier);

      // Check player has enough gold
      const playerGold = state.player.gold || 0;
      if (playerGold < finalCost) {
        events.push(createEvent(state, action, 'UPGRADE_FAILED', {
          reason: 'insufficient-gold',
          requiredGold: finalCost,
          currentGold: playerGold,
          message: `Upgrade costs ${finalCost}g. Shortage: ${finalCost - playerGold}g.`
        }));
        return events;
      }

      // Success! Apply upgrade
      state.player.gold = playerGold - finalCost;
      property.level = (property.level || 1) + 1;
      property.lastUpgradeAt = state.tick || 0;

      events.push(createEvent(state, action, 'PROPERTY_UPGRADED', {
        propertyId,
        propertyName: property.name,
        upgradeType,
        newLevel: property.level,
        upgradeCost: finalCost,
        dominantFactionId,
        message: `${property.name} upgraded to level ${property.level}! Cost: ${finalCost}g.`
      }));
      break;
    }

    case 'INITIATE_ASCENSION': {
      // Phase 13 Task 4: Initiate Ascension Protocol
      // Validate requirements and prepare legacy for transcendence
      
      if (!state.player) {
        events.push(createEvent(state, action, 'ASCENSION_FAILED', {
          reason: 'player_not_found',
          message: 'No player character to ascend.'
        }));
        break;
      }

      try {
        const legacyEngine = getLegacyEngine();
        if (!legacyEngine) {
          events.push(createEvent(state, action, 'ASCENSION_FAILED', {
            reason: 'legacy_engine_unavailable',
            message: 'Legacy system unavailable for ascension.'
          }));
          break;
        }

        // Check ascension requirements
        const playerMerit = state.player.merit ?? 0;
        const playerResonance = (state.player as any).soulResonanceLevel ?? 0;
        const completedQuests = state.player.questsCompleted?.length ?? 0;
        const mythStatus = (state.player as any).mythStatus ?? 0;
        
        // Requirement: Resonance >= 50 OR completed major quest OR myth status >= 50
        const meetsResonanceReq = playerResonance >= 50;
        const meetsMeritReq = playerMerit >= 100;
        const meetsMythReq = mythStatus >= 50;
        const meetsQuestReq = completedQuests >= 5;
        
        if (!meetsResonanceReq && !meetsMeritReq && !meetsMythReq && !meetsQuestReq) {
          events.push(createEvent(state, action, 'ASCENSION_BLOCKED', {
            reason: 'insufficient_legacy',
            resonance: playerResonance,
            merit: playerMerit,
            mythology: mythStatus,
            quests: completedQuests,
            message: 'Your character has not achieved sufficient legacy to ascend. Build more mythology or resonance.'
          }));
          break;
        }

        // Gather deeds and heirlooms from payload
        const selectedDeeds = action.payload?.selectedDeeds || [];
        const selectedHeirloom = action.payload?.selectedHeirloom;
        const generationalParadox = state.generationalParadox ?? 0;

        // Calculate ancestral legacy impact
        const legacy: any = {
          id: `ascend_${state.player.id}_${state.tick}`,
          canonicalName: state.player.name,
          bloodlineOrigin: state.bloodlineOrigin || 'unknown',
          mythStatus: mythStatus,
          deeds: selectedDeeds.length > 0 ? selectedDeeds : ['core_existence'],
          factionInfluence: state.player.factionReputation || {},
          inheritedPerks: state.player.abilities || [],
          epochsLived: state.epochCount ?? 1,
          totalGenerations: (state.metadata as any)?.totalGenerations ?? 1,
          soulEchoCount: (state.player as any).soulEchoCount ?? 0,
          finalWorldState: state.spiritDensity && state.spiritDensity > 50 ? 'improved' : 'neutral',
          paradoxDebt: generationalParadox,
          timestamp: Date.now(),
          
          // Phase 13: Ancestral mechanics
          canonicalDeeds: selectedDeeds,
          heirlooms: selectedHeirloom ? [{ itemId: selectedHeirloom }] : [],
          ancestralBooms: calculateAncestralBoonsForAscension(mythStatus, selectedDeeds),
          ancestralBlights: generationalParadox >= 150 
            ? generateCursesFromParadox(generationalParadox)
            : []
        };

        // Emit ascension initiated event (shows UI to player)
        events.push(createEvent(state, action, 'ASCENSION_PROTOCOL_INITIATED', {
          legacyId: legacy.id,
          playerName: state.player.name,
          mythStatus: mythStatus,
          generationalParadox: generationalParadox,
          selectedDeeds: selectedDeeds.length,
          selectedHeirloom: selectedHeirloom ? 'selected' : 'none',
          ancestralBoons: legacy.ancestralBooms.length,
          ancestralBlights: legacy.ancestralBlights.length,
          message: `${state.player.name} begins the Ascension Protocol. The veil between generations grows thin...`,
          uiReady: true
        }));

        // Store prepared legacy for next phase
        (state as any).pendingAscensionLegacy = legacy;

      } catch (error) {
        console.error('[Phase 13] Failed to initiate ascension:', error);
        events.push(createEvent(state, action, 'ASCENSION_FAILED', {
          reason: 'initiation_error',
          error: String(error),
          message: 'An error occurred while initiating ascension.'
        }));
      }
      break;
    }

    case 'FINALIZE_TRANSCENDENCE': {
      // Phase 13 Task 4: Finalize Transcendence and advance to next generation
      
      if (!state.player) {
        events.push(createEvent(state, action, 'TRANSCENDENCE_FAILED', {
          reason: 'player_not_found',
          message: 'No player character to transcend.'
        }));
        break;
      }

      try {
        const legacyEngine = getLegacyEngine();
        if (!legacyEngine) {
          events.push(createEvent(state, action, 'TRANSCENDENCE_FAILED', {
            reason: 'legacy_engine_unavailable',
            message: 'Legacy system unavailable for transcendence.'
          }));
          break;
        }

        // Retrieve prepared legacy
        const ascendingLegacy = (state as any).pendingAscensionLegacy;
        if (!ascendingLegacy) {
          events.push(createEvent(state, action, 'TRANSCENDENCE_FAILED', {
            reason: 'legacy_not_prepared',
            message: 'Legacy was not properly prepared. Run INITIATE_ASCENSION first.'
          }));
          break;
        }

        // Step 1: Apply legacy to world state
        const currentPlayer = state.player;
        const ascensionLegacy: any = ascendingLegacy;
        
        // Store legacy in world metadata for next generation
        if (!state.metadata) (state as any).metadata = {};
        if (!(state.metadata as any).ancestralLegacies) {
          (state.metadata as any).ancestralLegacies = [];
        }
        (state.metadata as any).ancestralLegacies.push(ascensionLegacy);

        // Step 2: Transmit soul echoes
        const soulEchoes = legacyEngine.transmitSoulEchoes(state, currentPlayer.name);
        
        // Step 3: Create historical chronicle summary
        const epochTransitionData = {
          precedingCharacter: {
            name: currentPlayer.name,
            mythStatus: (currentPlayer as any).mythStatus ?? 0,
            canonicalDeeds: ascensionLegacy.canonicalDeeds,
            factionLegacy: ascensionLegacy.factionInfluence
          },
          generationNumber: state.epochGenerationIndex ?? 1,
          worldState: {
            spiritDensity: state.spiritDensity ?? 50,
            generationalParadox: state.generationalParadox ?? 0,
            primaryFaction: (state.metadata as any)?.dominateFaction || 'none'
          },
          transcendenceTimestamp: Date.now()
        };

        // Step 4: Advance to next epoch (new generation)
        let updatedState = { ...state };
        try {
          const chronicle = require('./chronicleEngine');
          updatedState = chronicle.advanceToNextEpoch(state, soulEchoes);
        } catch (epochError) {
          console.warn('[Phase 13] Could not auto-advance epoch:', epochError);
          // Continue even if epoch advancement fails
        }

        // Step 5: Emit transcendence completed event (triggers new character creation)
        events.push(createEvent(state, action, 'TRANSCENDENCE_COMPLETE', {
          precedingCharacterId: currentPlayer.id,
          precedingCharacterName: currentPlayer.name,
          legacyId: ascensionLegacy.id,
          newGeneration: (state.epochGenerationIndex ?? 1) + 1,
          soulEchoesTransmitted: soulEchoes.length,
          epochTransitionData: epochTransitionData,
          inheritancePayload: {
            startingMerit: Math.floor(ascensionLegacy.mythStatus * 0.1),
            inheritedFactionReputation: ascensionLegacy.factionInfluence,
            startingHeirloom: ascensionLegacy.heirlooms?.[0]?.itemId,
            ancestralBoons: ascensionLegacy.ancestralBooms,
            ancestralBlights: ascensionLegacy.ancestralBlights,
            knownDeeds: ascensionLegacy.canonicalDeeds
          },
          message: `${currentPlayer.name} ascends into legend. A new generation awakens with their blessing...`,
          nextCharacterReady: true
        }));

        // Step 6: Emit soul echo manifestation for atmosphere
        if (soulEchoes.length > 0) {
          events.push(createEvent(state, action, 'SOUL_ECHOES_TRANSMITTED', {
            count: soulEchoes.length,
            transcendedCharacter: currentPlayer.name,
            message: `The echoes of ${currentPlayer.name} ripple through the generations...`
          }));
        }

        // Clean up pending legacy
        delete (state as any).pendingAscensionLegacy;

      } catch (error) {
        console.error('[Phase 13] Failed to finalize transcendence:', error);
        events.push(createEvent(state, action, 'TRANSCENDENCE_FAILED', {
          reason: 'finalization_error',
          error: String(error),
          message: 'An error occurred while finalizing transcendence.'
        }));
      }
      break;
    }

    case 'RESOLVE_APEX_CONVERGENCE': {
      /**
       * PHASE 14: Apex Convergence - The final narrative beat where the player resolves
       * their encounter with the Apex Entity. Triggers WORLD_REBORN event.
       * 
       * Payload should include:
       * - apexId: The Apex entity being resolved
       * - outcome: 'victory' | 'compromise' | 'sacrifice'
       * - playerChoice: narrative choice made by the player
       */
      const apexId = action.payload?.apexId;
      const outcome = action.payload?.outcome || 'victory';
      const playerChoice = action.payload?.playerChoice || '';

      if (!apexId) {
        events.push(createEvent(state, action, 'APEX_CONVERGENCE_FAILED', {
          reason: 'no-apex-id',
          message: 'No Apex entity specified for convergence.'
        }));
        return events;
      }

      // Calculate world transformation based on outcome
      let worldRebornData: any = {
        apexId,
        outcome,
        playerChoice,
        mythStatusGained: 0,
        paradoxResolved: 0,
        factionShifts: {},
        worldStateChanges: []
      };

      // Outcome-specific calculations
      if (outcome === 'victory') {
        // Player defeated the Apex - gain significant Myth Status
        worldRebornData.mythStatusGained = Math.floor((state.player.mythStatus || 0) * 0.5) + 20;
        worldRebornData.paradoxResolved = Math.min(state.player.generationalParadox || 0, 50);
        worldRebornData.message = 'You have triumphed over the Apex. The world recognizes your legend.';
        
        // Victory affects faction power - heroes gain reputation
        state.factions?.forEach((faction: any) => {
          if (faction.ideologyAlignment === 'lawful' || faction.ideologyAlignment === 'neutral') {
            worldRebornData.factionShifts[faction.id] = 5; // +5 power
          }
        });
      } else if (outcome === 'compromise') {
        // Player negotiated with the Apex - moderate gains
        worldRebornData.mythStatusGained = Math.floor((state.player.mythStatus || 0) * 0.25) + 10;
        worldRebornData.paradoxResolved = Math.floor((state.player.generationalParadox || 0) * 0.5);
        worldRebornData.message = 'You have reached an accord with the Apex. The world shifts into a new balance.';
        
        // Compromise affects all factions equally
        state.factions?.forEach((faction: any) => {
          worldRebornData.factionShifts[faction.id] = 3; // +3 power
        });
      } else if (outcome === 'sacrifice') {
        // Player sacrificed something important - philosophical victory
        worldRebornData.mythStatusGained = (state.player.mythStatus || 0) * 0.75; // Lesser gain but permanent mark
        worldRebornData.paradoxResolved = state.player.generationalParadox || 0; // All paradox resolved
        worldRebornData.message = 'You have sacrificed greatly. The world will remember your choice.';
        
        // Sacrifice unlocks secret faction shifts
        state.factions?.forEach((faction: any) => {
          if (faction.ideologyAlignment === 'chaotic' || faction.ideologyAlignment === 'good') {
            worldRebornData.factionShifts[faction.id] = 8; // +8 power for aligned factions
          }
        });
      }

      // Update player stats
      state.player.mythStatus = (state.player.mythStatus || 0) + worldRebornData.mythStatusGained;
      state.player.generationalParadox = Math.max(0, (state.player.generationalParadox || 0) - worldRebornData.paradoxResolved);

      // Apply faction shifts
      Object.entries(worldRebornData.factionShifts).forEach(([factionId, powerShift]) => {
        const faction = state.factions?.find(f => f.id === factionId);
        if (faction && typeof powerShift === 'number') {
          faction.power = (faction.power || 0) + powerShift;
        }
      });

      // Emit primary narrative event
      events.push(createEvent(state, action, 'WORLD_REBORN', {
        ...worldRebornData,
        playerMythStatusBefore: state.player.mythStatus - worldRebornData.mythStatusGained,
        playerMythStatusAfter: state.player.mythStatus,
        timestamp: state.tick || 0
      }));

      // Emit atmospheric event if this is a major convergence
      events.push(createEvent(state, action, 'APEX_CONVERGENCE_RESOLVED', {
        narrativeContext: `The Apex fades from reality as you make your choice: "${playerChoice}"`,
        worldStateShifted: true,
        newEpochReady: outcome === 'victory' // Victory might trigger epoch transition
      }));

      break;
    }

    case 'PLANETARY_RESET': {
      /**
       * Phase 15: New Game+ (NG+) - Planetary Reset
       * Triggered after 5th generation's Apex Convergence
       * Resets world to Epoch I but with accumulated Legacy Perks and World Scars
       * 
       * Payload should include:
       * - confirm: boolean (must be true to prevent accidental reset)
       * - inheritPerks: boolean (whether to inherit ancestral perks)
       * - keepScars: boolean (whether to preserve world scars from previous eras)
       */
      
      const confirmed = action.payload?.confirm === true;
      if (!confirmed) {
        events.push(createEvent(state, action, 'PLANETARY_RESET_CANCELLED', {
          reason: 'not-confirmed',
          message: 'Planetary reset requires explicit confirmation.'
        }));
        break;
      }

      const inheritPerks = action.payload?.inheritPerks !== false; // Default true
      const keepScars = action.payload?.keepScars !== false; // Default true

      // Collect all ancestral legacies for inheritance
      const ancestralLegacies = (state.metadata as any)?.ancestralLegacies || [];
      const totalGenerations = ancestralLegacies.length + 1; // +1 for current generation
      
      // Calculate cumulative legacy benefits
      const cumulativeMythStatus = ancestralLegacies.reduce((sum, leg) => sum + (leg.mythStatus || 0), 0);
      const inheritedPerks = inheritPerks ? ancestralLegacies.flatMap(leg => leg.inheritedPerks || []) : [];
      const inheritedFactionReputations: Record<string, number> = {};
      
      // Accumulate faction influence from all generations
      ancestralLegacies.forEach(leg => {
        Object.entries(leg.factionInfluence || {}).forEach(([factionId, rep]) => {
          inheritedFactionReputations[factionId] = (inheritedFactionReputations[factionId] || 0) + (rep as number || 0);
        });
      });

      // Prepare reset state: return to Epoch I with accumulated changes
      const resetState = {
        ...state,
        epochGenerationIndex: totalGenerations, // Track we're on generation N+1
        epochId: 'epoch_i_fracture', // Back to Epoch I
        tick: 0,
        hour: 6,
        day: 1,
        dayPhase: 'morning',
        season: 'spring',
        weather: 'clear',
        
        // Preserve world scars if keepScars is true
        worldScars: keepScars ? state.worldScars : [],
        
        // Apply legacy perks to new character
        player: {
          ...state.player,
          // Keep player name but reset stats
          hp: state.player.maxHp || 100,
          mp: state.player.maxMp || 0,
          
          // Inherit perks from ancestors
          abilities: inheritPerks ? inheritedPerks : [],
          
          // Inherit reputation with factions
          factionReputation: inheritedFactionReputations,
          
          // Reset generation counter for new playthrough
          generationCount: 1,
          
          // But keep some memory of previous lives (meta)
          _previousGenerations: totalGenerations - 1,
          _cumulativeMythStatusFromLineage: cumulativeMythStatus
        }
      };

      // Preserve heirloom caches for discovery
      if (state.heirloomCaches) {
        resetState.heirloomCaches = state.heirloomCaches;
      }

      // Emit primary reset event
      events.push(createEvent(state, action, 'PLANETARY_RESET_INITIATED', {
        previousGenerationCount: totalGenerations - 1,
        newGenerationNumber: totalGenerations,
        inheritedPerks: inheritedPerks.length,
        inheritedFactionBonuses: Object.keys(inheritedFactionReputations).length,
        worldScarsPreserved: keepScars ? (state.worldScars || []).length : 0,
        message: `The planet resets. You awaken as a new incarnation, carrying the strength of ${totalGenerations - 1} ancestors.`
      }));

      // Emit atmospheric events for each preserved legacy
      if (ancestralLegacies.length > 0) {
        events.push(createEvent(state, action, 'ANCESTRAL_BLESSING_APPLIED', {
          ancestorCount: ancestralLegacies.length,
          cumulativeMythStatus,
          ancestorNames: ancestralLegacies.map((leg: any) => leg.canonicalName),
          message: `The spirits of ${ancestralLegacies.length} ancestors guide your new path. Their combined might flows through you.`
        }));
      }

      // Emit world continuity event if scars are preserved
      if (keepScars && state.worldScars && state.worldScars.length > 0) {
        events.push(createEvent(state, action, 'WORLD_SCARS_PRESERVED', {
          scarCount: state.worldScars.length,
          scars: state.worldScars.map(s => s.type),
          message: `The wounds of previous eras remain as testament to trials overcome. The world carries its history.`
        }));
      }

      // Emit completion event
      events.push(createEvent(state, action, 'PLANETARY_RESET_COMPLETE', {
        newEpochId: 'epoch_i_fracture',
        generationNumber: totalGenerations,
        readyForNewPlaythrough: true,
        timestamp: Date.now()
      }));

      break;
    }

    case 'DISMISS_TUTORIAL': {
      // Phase 24 Task 4: Dismiss a tutorial overlay and mark milestone as acknowledged
      const { milestoneId } = action.payload;
      
      if (!milestoneId) {
        events.push(createEvent(state, action, 'TUTORIAL_DISMISS_FAILED', {
          reason: 'No milestone ID provided',
          message: 'Tutorial dismiss action requires a milestone ID.'
        }));
        break;
      }

      // Import tutorial functions
      const {
        triggerGuildJoinMilestone,
        triggerRaidMilestone,
        triggerParadoxWarningMilestone,
        triggerHighDensitySyncMilestone
      } = require('./tutorialEngine');

      // Update tutorial state based on milestone
      if (!state.player.tutorialProgress) {
        events.push(createEvent(state, action, 'TUTORIAL_DISMISS_FAILED', {
          reason: 'Tutorial state not initialized',
          message: 'Player tutorial progress not found.'
        }));
        break;
      }

      const tutorialState = state.player.tutorialProgress;
      
      // Mark milestone as achieved
      try {
        switch (milestoneId) {
          case 'first_guild_join':
            triggerGuildJoinMilestone(tutorialState);
            break;
          case 'first_raid_enter':
            triggerRaidMilestone(tutorialState);
            break;
          case 'paradox_warning':
            triggerParadoxWarningMilestone(tutorialState);
            break;
          case 'high_density_sync':
            triggerHighDensitySyncMilestone(tutorialState);
            break;
          default:
            // Handle Tier 1-2 milestones if needed
            if (tutorialState[milestoneId]) {
              tutorialState[milestoneId].achieved = true;
              tutorialState[milestoneId].achievedAtTick = state.tick || 0;
            }
        }

        events.push(createEvent(state, action, 'TUTORIAL_DISMISSED', {
          milestoneId,
          achievedAt: state.tick || 0,
          message: `Tutorial milestone "${milestoneId}" acknowledged.`
        }));

      } catch (error) {
        events.push(createEvent(state, action, 'TUTORIAL_DISMISS_FAILED', {
          reason: String(error),
          message: 'Error dismissing tutorial milestone.'
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

/**
 * M56-T3: Validate action before execution
 * Checks actor state, target validity, resource costs, and location constraints
 * Returns {valid, errorMessage} tuple
 */
export function validateAction(action: Action, state: WorldState): { valid: boolean; errorMessage?: string } {
  // Check 1: Actor is alive and not in invalid state
  const actor = state.player;
  if (!actor) {
    return { valid: false, errorMessage: 'Player character not found' };
  }

  if ((actor.hp ?? 0) <= 0) {
    return { valid: false, errorMessage: 'Actor is dead and cannot act' };
  }

  // Check 2: Target exists (if applicable)
  const targetId = action.payload?.targetId;
  if (targetId && targetId !== state.player.id) {
    const target = state.npcs.find(n => n.id === targetId);
    if (!target) {
      return { valid: false, errorMessage: `Target ${targetId} not found` };
    }
  }

  // Check 3: Resource costs (mana, stamina, inventory space)
  const actionType = action.type;
  let resourceCost = 0;

  if (actionType === 'CAST_SPELL') {
    const spellId = action.payload?.spellId;
    const spell = getSpellById(spellId);
    resourceCost = spell?.manaCost || 10;
    if ((state.player.mp ?? 0) < resourceCost) {
      return { valid: false, errorMessage: `Insufficient mana. Requires ${resourceCost}, have ${state.player.mp ?? 0}` };
    }
  } else if (actionType === 'CRAFT_ITEM') {
    const recipeId = action.payload?.recipeId;
    const recipe = RECIPES[recipeId];
    if (!recipe) {
      return { valid: false, errorMessage: `Recipe ${recipeId} not found` };
    }
    
    // Check material availability
    const inventory = state.player.inventory || [];
    const validation = validateRecipe(inventory, recipe);
    if (!validation.valid) {
      return { valid: false, errorMessage: `Missing materials: ${validation.missingMaterials?.join(', ') || 'unknown'}` };
    }
  }

  // Check 4: Action valid for location/time of day
  if (actionType === 'PERFORM_RITUAL') {
    const altar = findNearestAltar(state, state.player.location);
    if (!altar) {
      return { valid: false, errorMessage: 'No Essence Altar at this location. Rituals require an altar.' };
    }
  }

  if (actionType === 'START_INVESTIGATION') {
    // Investigations can happen at any location but require cost
    const goldItem = state.player.inventory?.find((item: any) => item.itemId === 'gold') as any;
    const playerGold = goldItem?.quantity || 0;
    if (playerGold < 50) {
      return { valid: false, errorMessage: `Investigation requires 50 Gold, you have ${playerGold}` };
    }
  }

  return { valid: true };
}

/**
 * M56-T3: Resolve action outcome with dice rolls, stat modifiers, and environment effects
 * Returns {success, damageDealt, reputationDelta, logs}
 */
export function resolveActionOutcome(
  action: Action,
  state: WorldState,
  diceRoll?: number
): { 
  success: boolean; 
  damageDealt?: number; 
  reputationDelta?: number;
  logs: string[];
} {
  const logs: string[] = [];
  const roll = diceRoll ?? Math.floor(random() * 20) + 1;
  logs.push(`Rolled d20: ${roll}`);

  const actor = state.player;
  const actionType = action.type;

  if (actionType === 'ATTACK') {
    const targetId = action.payload?.targetId;
    const target = state.npcs.find(n => n.id === targetId);
    if (!target) {
      return { success: false, logs: [...logs, 'Target not found'] };
    }

    // Calculate attack modifier (STR-based)
    const strModifier = Math.floor((actor.stats?.str || 10) / 3);
    const weaponBonus = 2; // Base weapon bonus
    const environmentalModifier = getEnvironmentalModifier(state, 'combat');
    const totalModifier = strModifier + weaponBonus + environmentalModifier;

    logs.push(`STR modifier: +${strModifier}, Weapon: +${weaponBonus}, Environment: ${environmentalModifier >= 0 ? '+' : ''}${environmentalModifier}`);

    // Target AC = 10 + target AGI modifier
    const targetAC = 10 + Math.floor((target.stats?.agi || 10) / 5);
    const attackTotal = roll + totalModifier;

    logs.push(`Attack total: ${roll} + ${totalModifier} = ${attackTotal} vs AC ${targetAC}`);

    if (attackTotal >= targetAC) {
      // Hit! Roll damage
      const damageDice = 1; // 1d8 base
      const damageRoll = Math.floor(random() * 8) + 1;
      const damageModifier = Math.floor((actor.stats?.str || 10) / 4);
      const baseDamage = damageRoll + damageModifier;

      logs.push(`Damage roll: 1d8 (${damageRoll}) + STR (${damageModifier}) = ${baseDamage} total`);

      return {
        success: true,
        damageDealt: baseDamage,
        reputationDelta: -5, // Attacking reduces rep
        logs
      };
    } else {
      logs.push('Attack missed!');
      return { success: false, logs };
    }
  }

  if (actionType === 'PERSUADE' || actionType === 'DECEIVE' || actionType === 'CHARM') {
    const targetId = action.payload?.targetId;
    const target = state.npcs.find(n => n.id === targetId);
    if (!target) {
      return { success: false, logs: [...logs, 'Target not found'] };
    }

    // Calculate social DC based on NPC disposition
    const baseDC = 10 + (target.resistance ?? 0);
    
    // Apply CHA modifier
    const chaModifier = Math.floor((actor.stats?.cha || 10) / 3);
    const actionModifier = actionType === 'PERSUADE' ? 2 : (actionType === 'CHARM' ? 1 : -1); // Lying is risky
    const totalModifier = chaModifier + actionModifier;

    logs.push(`CHA modifier: +${chaModifier}, Action modifier: ${actionModifier > 0 ? '+' : ''}${actionModifier}`);

    const socialTotal = roll + totalModifier;
    logs.push(`Social check: ${roll} + ${totalModifier} = ${socialTotal} vs DC ${baseDC}`);

    if (socialTotal >= baseDC) {
      const repGain = actionType === 'PERSUADE' ? 10 : 15; // Charm/Deceive gain more
      return {
        success: true,
        reputationDelta: repGain,
        logs: [...logs, `${actionType} succeeded! NPC response is favorable.`]
      };
    } else {
      return {
        success: false,
        reputationDelta: actionType === 'DECEIVE' ? -10 : -5, // Failing to deceive hurts more
        logs: [...logs, `${actionType} failed. NPC sees through your attempt.`]
      };
    }
  }

  // Default success for unimplemented action types
  return { success: true, logs };
}

/**
 * M56-T3: Skill check system with difficulty tiers
 * DC tiers: 5 (trivial), 10 (easy), 15 (medium), 20 (hard), 25 (nearly impossible)
 * Returns {success, passMargin, skillXpGain}
 */
export function resolveSkillCheck(
  actor: any,
  skill: string,
  difficulty: number,
  diceRoll?: number
): {
  success: boolean;
  passMargin: number;
  skillXpGain: number;
  logs: string[];
} {
  const logs: string[] = [];
  const roll = diceRoll ?? Math.floor(random() * 20) + 1;
  logs.push(`Skill check [${skill}]: d20 = ${roll}`);

  // Get skill bonus based on actor stats (simplified - real system uses skill XP)
  const skillBonusMap: Record<string, number> = {
    'acrobatics': Math.floor((actor.stats?.agi || 10) / 3),
    'arcana': Math.floor((actor.stats?.int || 10) / 3),
    'athletics': Math.floor((actor.stats?.str || 10) / 3),
    'deception': Math.floor((actor.stats?.cha || 10) / 3),
    'investigation': Math.floor((actor.stats?.int || 10) / 3),
    'perception': Math.floor((actor.stats?.wis || actor.stats?.int || 10) / 3),
    'persuasion': Math.floor((actor.stats?.cha || 10) / 3),
    'sleight_of_hand': Math.floor((actor.stats?.agi || 10) / 3),
    'stealth': Math.floor((actor.stats?.agi || 10) / 3),
    'survival': Math.floor((actor.stats?.wis || 10) / 3),
    'crafting': Math.floor((actor.stats?.int || 10) / 3),
    'medicine': Math.floor((actor.stats?.wis || 10) / 3)
  };

  const skillBonus = skillBonusMap[skill] || 0;
  const totalRoll = roll + skillBonus;
  const passMargin = totalRoll - difficulty;

  logs.push(`${skill} bonus: +${skillBonus}, total: ${totalRoll} vs DC ${difficulty}`);

  const success = totalRoll >= difficulty;

  // Calculate XP gain (higher difficulty = more XP)
  let skillXpGain = 0;
  if (success) {
    skillXpGain = Math.max(5, difficulty - 5); // 5 XP minimum, scales with difficulty
    logs.push(`Success! Gained ${skillXpGain} skill XP. (Margin: +${passMargin})`);
  } else {
    skillXpGain = Math.ceil((difficulty - 5) / 2); // Half XP for failures
    logs.push(`Failed by ${Math.abs(passMargin)}. Gained ${skillXpGain} skill XP anyway (learning).`);
  }

  return {
    success,
    passMargin,
    skillXpGain,
    logs
  };
}

/**
 * Get environmental modifier for actions (weather, time of day, location)
 */
function getEnvironmentalModifier(state: WorldState, actionType: string): number {
  let modifier = 0;

  // Weather effects
  if (state.weather === 'rain') modifier -= 1; // Slippery
  if (state.weather === 'storm') modifier -= 2;
  if (state.weather === 'clear') modifier += 1; // Visibility bonus

  // Time of day effects
  if (state.dayPhase === 'night' && actionType === 'investigation') modifier -= 1;
  if (state.dayPhase === 'night' && actionType === 'stealth') modifier += 1; // Darkness helps

  // Location effects  
  const currentLocation = state.locations.find(l => l.id === state.player.location);
  if (currentLocation?.biome === 'mountain' && actionType === 'climbing') modifier += 2;
  if (currentLocation?.biome === 'forest' && actionType === 'stealth') modifier += 1;
  if (currentLocation?.biome === 'water' && actionType === 'swimming') modifier += 1;

  return modifier;
}

// Export for use in worldEngine
export function completeAction(state: WorldState, action: Action): Event[] {
  return processAction(state, action);
}