import { WorldState, StackableItem } from './worldEngine';
import { Event } from '../events/mutationLog';
import { random } from './prng';
import { createPlayerCharacter, validateStatAllocation } from './characterCreation';
import { resolveCombat, resolveDefense, resolveParry, resolveHeal, CombatantStats, getEquipmentBonuses, applyEquipmentBonuses } from './ruleEngine';
import { isNpcAvailable, resolveDialogue } from './npcEngine';
import { resolveLootTable, validateRecipe, rollCraftingCheck, deductMaterials, addCraftResult, type Recipe } from './craftingEngine';
import { resolveSpell, getSpellById } from './magicEngine';
import { calculateDrift, validateAuthority, getParadoxSeverity, checkForSpellBackfire } from './paradoxEngine';
import { calculateMorphCost, generateRitualChallenge, performRitualCheck, handleMorphSuccess, handleMorphFailure, calculateEssenceDecay, checkMorphCooldown, findNearestAltar } from './morphEngine';
import { calculateEncounterChance, selectEncounterType, generateEncounterNpc, generateEncounterCombatant, calculateTravelDistance, hasHiddenAreas, getLocationBiome, calculateSearchDifficulty, performSearchCheck } from './encounterEngine';
import { calculateRelicBonus, shouldRelicRebel, checkInfusionStability, calculateUnbindCost, isRelicRebelling, generateRelicDialogue, applyRelicRebellion, getWieldingRequirement, calculateItemCorruption } from './artifactEngine';
import { checkLocationHazards } from './hazardEngine';
import { checkLocationDiscovery, discoverLocation, getAdjacentLocations } from './mapEngine';
import { canUnlockAbility, unlockAbility, equipAbility, getAbility } from './skillEngine';

// Dice roll context for action resolution
interface DiceRollContext {
  actionType: 'attack' | 'defend' | 'skillcheck' | 'ritual' | 'magic' | 'craft';
  actionName: string;
  baseValue: number;
  modifiers: Array<{ name: string; value: number }>;
  staticResult?: number; // DC or target number
  targetValue: number;
  targetDescription?: string;
}
import { calculateEnvironmentalFatigue, calculateSeasonalModifiers, checkEnvironmentalHazard, isLocationSheltered } from './environmentalModifierEngine';
import { resolveWeather } from './weatherEngine';
import itemsData from '../data/items.json';
import encountersData from '../data/encounters.json';
import runesData from '../data/runes.json';

// Helper: Check if item exists in Set or array
function hasItem(container: Set<string> | string[] | undefined, item: string): boolean {
  if (!container) return false;
  if (Array.isArray(container)) return container.includes(item);
  return container.has(item);
}

/**
 * ALPHA_M4: Apply hazard damage during combat
 * Called after each combat round to check and apply environmental hazards
 */
function applyHazardsInCombat(state: WorldState, action: Action): Event[] {
  const hazardEvents: Event[] = [];
  
  // Get hazards from world state (if available)
  const hazards = (state as any).hazards || [];
  if (hazards.length === 0) {
    return hazardEvents;
  }

  // Only check hazards every 3 combat rounds (simulating environmental degradation)
  const combatRoundCount = state.combatState?.roundNumber || 0;
  if (combatRoundCount % 3 !== 0) {
    return hazardEvents;
  }

  // Check for active hazards at player's current location
  const hazardResults = checkLocationHazards(state, hazards, 1); // tickDivisor=1 for combat, always check
  
  for (const result of hazardResults) {
    if (result.triggered && result.damage > 0) {
      hazardEvents.push(createEvent(state, action, 'HAZARD_DAMAGE', {
        hazardId: result.hazardId,
        hazardName: result.hazardName,
        damage: result.damage,
        statusApplied: result.statusApplied,
        affectedCombatants: ['player'] // In ALPHA_M4, hazards affect all combatants equally
      }));
    }
  }

  return hazardEvents;
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
 * 
 * ALPHA_M18: Enhanced with WTOL enforcement and Temporal Fog status effects
 * - Blocks ATTACK/TALK on masked entities unless discovered via IDENTIFY
 * - Applies Temporal Fog status when suspicion > 30 (reduces accuracy, increases spell failure)
 */
function validateMetagaming(state: WorldState, action: Action): { 
  isSuspicious: boolean; 
  reason?: string;
  suspicionIncrement?: number;
  suspicionEvents?: Event[];
  actionAllowed?: boolean;
  statusEffectApplied?: string;
} {
  const knowledgeBase = state.player.knowledgeBase;
  const visitedLocations = state.player.visitedLocations;
  const suspicionLevel = (state.player as any).suspicionLevel ?? 0;
  const events: Event[] = [];
  let suspicionIncrement = 0;
  let isSuspicious = false;
  let actionAllowed = true;
  let reason: string | undefined;
  let statusEffectApplied: string | undefined;
  
  switch (action.type) {
    case 'MOVE': {
      const targetLocation = action.payload?.to;
      // Check if player hasn't discovered this location through gameplay
      if (targetLocation && !hasItem(visitedLocations, targetLocation) && !knowledgeBase?.has(`location:${targetLocation}`)) {
        isSuspicious = true;
        reason = 'Moved to undiscovered location - possible metagaming';
        suspicionIncrement = 15;
      }
      break;
    }
    
    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      // Check if NPC hasn't been identified yet
      if (npcId && !knowledgeBase?.has(`npc:${npcId}`)) {
        isSuspicious = true;
        reason = 'Interacted with unknown NPC - possible metagaming';
        suspicionIncrement = 10;
      }
      break;
    }
    
    case 'TALK': {
      const targetId = action.payload?.targetId;
      // WTOL Enforcement: Block dialogue with masked NPCs
      if (targetId && targetId !== state.player.id) {
        const targetNpc = state.npcs.find(n => n.id === targetId);
        if (targetNpc && !knowledgeBase?.has(`npc:${targetId}`)) {
          isSuspicious = true;
          actionAllowed = false;
          reason = 'Attempted dialogue with masked NPC - Ground Truth violation';
          suspicionIncrement = 18; // Higher penalty for direct action
          
          events.push(createEvent(state, action, 'METAGAME_VIOLATION', {
            violationType: 'masked_npc_interaction',
            targetNpc: targetNpc.name,
            action: 'TALK',
            blockReason: 'NPC identity not yet discovered'
          }));
        }
      }
      break;
    }
    
    case 'CAST_SPELL': {
      const targetId = action.payload?.targetId;
      // Check if targeting NPC that hasn't been identified
      if (targetId && targetId !== state.player.id) {
        const isNpc = state.npcs.some(n => n.id === targetId);
        if (isNpc && !knowledgeBase?.has(`npc:${targetId}`)) {
          isSuspicious = true;
          reason = 'Cast spell on unknown NPC - possible metagaming';
          suspicionIncrement = 12;
        }
      }
      break;
    }
    
    case 'ATTACK': {
      const targetId = action.payload?.targetId;
      // WTOL Enforcement: Block attacks on masked NPCs (unless proximity revealed)
      if (targetId && targetId !== state.player.id) {
        const targetNpc = state.npcs.find(n => n.id === targetId);
        const isIdentified = knowledgeBase?.has(`npc:${targetId}`);
        const isProximityRevealed = knowledgeBase?.has(`proximity:${targetId}`);
        
        if (targetNpc && !isIdentified && !isProximityRevealed) {
          isSuspicious = true;
          actionAllowed = false;
          reason = 'Attacked masked NPC - Ground Truth violation';
          suspicionIncrement = 20; // Higher penalty for attack
          
          events.push(createEvent(state, action, 'METAGAME_VIOLATION', {
            violationType: 'masked_entity_targeting',
            targetNpc: targetNpc.name,
            action: 'ATTACK',
            blockReason: 'NPC identity not yet discovered or not in proximity'
          }));
        }
      }
      break;
    }
  }
  
  // M16/M18: If suspicious, emit suspicion events on threshold crossings
  if (isSuspicious && suspicionIncrement > 0) {
    // Initialize suspicion if not present
    if (!state.player.suspicionLevel) {
      (state.player as any).suspicionLevel = 0;
    }
    
    const previousLevel = (state.player as any).suspicionLevel;
    const newLevel = previousLevel + suspicionIncrement;
    (state.player as any).suspicionLevel = newLevel;
    
    // ALPHA_M18: Apply Temporal Fog when suspicion crosses 30 threshold
    if (previousLevel < 30 && newLevel >= 30 && !hasItem(state.player.statusEffects, 'temporal_fog')) {
      statusEffectApplied = 'temporal_fog';
      if (!state.player.statusEffects) {
        (state.player as any).statusEffects = [];
      }
      state.player.statusEffects!.push('temporal_fog');
      
      events.push(createEvent(state, action, 'STATUS_EFFECT_APPLIED', {
        effect: 'temporal_fog',
        reason: 'Metagaming detection threshold reached',
        modifiers: {
          accuracyPenalty: -0.25,
          spellFailureChance: 0.30,
          temporalFogDuration: 100 // ticks
        }
      }));
    }
    
    // Determine which thresholds were crossed
    const thresholds = [30, 60, 90];
    for (const threshold of thresholds) {
      if (previousLevel < threshold && newLevel >= threshold) {
        // Threshold crossed!
        const matchThreshold = threshold;
        let suspicionType = 'minor_glitch';
        let manifestation = 'Environmental flicker or minor reality distortion';
        
        if (matchThreshold === 60) {
          suspicionType = 'hazard_spawn';
          manifestation = 'Hostile entity or environmental hazard manifests nearby';
        } else if (matchThreshold === 90) {
          suspicionType = 'reality_rebellion';
          manifestation = 'Reality begins to fully reject exploitative knowledge - cannot proceed';
          actionAllowed = false; // At 90% suspicion, block most actions
        }
        
        events.push(createEvent(state, action, 'META_SUSPICION', {
          level: newLevel,
          reason: reason,
          triggeringAction: action.type,
          triggeringReason: reason,
          thresholdCrossed: matchThreshold,
          suspicionType: suspicionType,
          dmInterference: manifestation,
          previousLevel: previousLevel
        }));
      }
    }
    
    (state.player as any).metaSuspicionLastTriggeredAt = state.tick || 0;
  }
  
  return { 
    isSuspicious, 
    reason,
    suspicionIncrement,
    suspicionEvents: events,
    actionAllowed,
    statusEffectApplied
  };
}

export type Action = {
  worldId: string;
  playerId: string;
  type: string;
  payload: any;
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
    // M16: Suspicion events are already created and state.player.suspicionLevel already updated
    // by validateMetagaming() - just add them to the event list
    if (metagameCheck.suspicionEvents && metagameCheck.suspicionEvents.length > 0) {
      events.push(...metagameCheck.suspicionEvents);
    }
    
    // Check if reality rebellion threshold (90+) has been crossed
    if (state.player.suspicionLevel && state.player.suspicionLevel >= 90) {
      // At 90+ suspicion, action fails - reality refuses
      events.push(createEvent(state, action, 'AUTHORITY_INTERVENTION', {
        interventionText: 'The very fabric of reality rejects your exploitative knowledge. This action cannot proceed.',
        action: action.type,
        payload: action.payload,
        reason: 'Metagaming suspicion exceeds 90 - Reality Rebellion',
        suspicionLevel: state.player.suspicionLevel
      }));
      return events;  // Stop processing this action
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

      // ALPHA_M15: Apply environmental fatigue (MP cost for movement)
      const weather = (state as any).weather || 'clear';
      const season = (state as any).season || 'spring';
      const weatherResult = resolveWeather(season as 'winter' | 'spring' | 'summer' | 'autumn', (state as any).hour || 12, weather);
      const fatigueMult = calculateEnvironmentalFatigue(weatherResult.current, weatherResult.intensity);
      
      // Base MP cost: 10 + distance/10
      let mpCost = 10 + Math.round(travelDistance / 10);
      mpCost = Math.round(mpCost * fatigueMult);
      
      const hasEnoughMp = (state.player.mp || 0) >= mpCost;
      if (!hasEnoughMp) {
        events.push(createEvent(state, action, 'TRAVEL_FAILED', {
          reason: 'insufficient-mp',
          required: mpCost,
          available: state.player.mp || 0,
          fatigue: fatigueMult
        }));
        return events;
      }

      // Deduct MP from player
      state.player.mp = (state.player.mp || 0) - mpCost;

      // ALPHA_M15: Check for environmental hazards (blizzard chill)
      const isSheltered = isLocationSheltered(targetLocation.biome);
      const hazard = checkEnvironmentalHazard(
        weatherResult.current,
        weatherResult.intensity,
        (state as any).hour || 12,
        targetLocation,
        isSheltered
      );

      if (hazard && !isSheltered) {
        // Apply hazard damage
        state.player.hp = Math.max(0, (state.player.hp || 100) - hazard.damageTicks);
        events.push(createEvent(state, action, 'ENVIRONMENTAL_HAZARD', {
          type: hazard.hazardType,
          damage: hazard.damageTicks,
          weather: weatherResult.current,
          intensity: weatherResult.intensity
        }));
      }

      // Create travel animation event
      events.push(createEvent(state, action, 'TRAVEL_STARTED', {
        from: state.player.location,
        to,
        distance: Math.round(travelDistance),
        estimatedTicks: travelTicks,
        terrainDifficulty: targetTerrainMod,
        animationType: targetLocation.biome ? `travel_${targetLocation.biome}` : 'travel_default',
        mpCost,
        fatigue: fatigueMult,
        weather: weatherResult.current,
        hazardApplied: hazard ? hazard.hazardType : null
      }));

      // Log the movement itself with duration
      events.push(createEvent(state, action, 'MOVE', {
        from: state.player.location,
        to,
        distance: Math.round(travelDistance),
        travelTime: travelTicks,
        mpCost,
        weatherCondition: weatherResult.current
      }));
      
      // Check for adjacent location discoveries
      const newDiscoveries = checkLocationDiscovery(state, to);
      if (newDiscoveries && newDiscoveries.length > 0) {
        for (const locId of newDiscoveries) {
          const discoveredLoc = state.locations.find(l => l.id === locId);
          if (discoveredLoc) {
            discoverLocation(state, locId);
            events.push(createEvent(state, action, 'DISCOVER_LOCATION', {
              locationId: locId,
              name: discoveredLoc.name,
              description: discoveredLoc.description,
              biome: discoveredLoc.biome,
              spiritDensity: discoveredLoc.spiritDensity,
              message: `You discovered a new location: ${discoveredLoc.name}!`
            }));
          }
        }
      }

      // M16 Step 6: Context-aware narration for territory transitions
      {
        const targetLoc = state.locations.find(l => l.id === to);
        if (targetLoc && state.influenceMap && state.influenceMap[to]) {
          const territoryInfluence = state.influenceMap[to];
          
          // Find dominant faction at this location
          let dominantFaction: string | null = null;
          let maxInfluence = 0;
          Object.entries(territoryInfluence).forEach(([factionId, influence]) => {
            if ((influence as number) > maxInfluence) {
              maxInfluence = influence as number;
              dominantFaction = factionId;
            }
          });
          
          // If location is dominated by faction (>60 influence), emit territory narration
          if (dominantFaction && maxInfluence > 60) {
            const controllingFaction = state.factions?.find(f => f.id === dominantFaction);
            if (controllingFaction) {
              let narration = '';
              let narrativeType = 'territorial_shift';
              
              // Check if player is aligned with this faction
              const playerRep = state.player.factionReputation?.[dominantFaction] || 0;
              const isAligned = playerRep >= 20;
              const isHostile = playerRep <= -20;
              
              if (isAligned) {
                narration = `You enter ${controllingFaction.name} territory. The atmosphere feels familiar and secure. ${controllingFaction.name}'s influence is palpable here.`;
                narrativeType = 'territory_friendly';
              } else if (isHostile) {
                narration = `You enter ${controllingFaction.name} territory. Hostile presence fills the air. Tread carefully—you are not welcome here.`;
                narrativeType = 'territory_hostile';
              } else {
                narration = `You cross into ${controllingFaction.name}-controlled territory. ${controllingFaction.name} banners mark their dominion. Proceed with caution.`;
                narrativeType = 'territory_neutral';
              }
              
              events.push(createEvent(state, action, 'SYSTEM_NARRATION', {
                narrativeType: narrativeType,
                narration: narration,
                locationId: to,
                factionId: dominantFaction,
                factionName: controllingFaction.name,
                factionInfluence: maxInfluence,
                playerReputation: playerRep
              }));
            }
          }
        }
      }
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

      // M11: Add reputation gain to quest giver's faction
      if ((quest as any).giverNpcId) {
        const giverNpc = state.npcs.find(n => n.id === (quest as any).giverNpcId);
        if (giverNpc && (giverNpc as any).factionId) {
          const reputationGain = 10; // Base reputation gain for quest completion
          events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
            factionId: (giverNpc as any).factionId,
            previousReputation: state.player.factionReputation?.[(giverNpc as any).factionId] ?? 0,
            newReputation: (state.player.factionReputation?.[(giverNpc as any).factionId] ?? 0) + reputationGain,
            reason: 'quest_completed',
            questId,
            giverNpcId: (quest as any).giverNpcId
          }));
        }
      }

      // Add reward event
      if (quest.rewards) {
        events.push(createEvent(state, action, 'REWARD', { questId, reward: quest.rewards }));
      }

      break;
    }

    case 'REJECT_QUEST': {
      // M11: Handle quest rejection with reputation penalty
      const questId = action.payload?.questId;
      const quest = state.quests.find(q => q.id === questId);
      if (!quest) return [];

      const playerQuest = state.player.quests[questId];
      if (!playerQuest || playerQuest.status !== 'in_progress') {
        return events; // Not in progress
      }

      // Emit quest rejected event
      events.push(createEvent(state, action, 'QUEST_REJECTED', { questId }));

      // Apply reputation penalty to quest giver's faction
      if ((quest as any).giverNpcId) {
        const giverNpc = state.npcs.find(n => n.id === (quest as any).giverNpcId);
        if (giverNpc && (giverNpc as any).factionId) {
          const reputationPenalty = -5; // Penalty for quest rejection
          events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
            factionId: (giverNpc as any).factionId,
            previousReputation: state.player.factionReputation?.[(giverNpc as any).factionId] ?? 0,
            newReputation: (state.player.factionReputation?.[(giverNpc as any).factionId] ?? 0) + reputationPenalty,
            reason: 'quest_rejected',
            questId,
            giverNpcId: (quest as any).giverNpcId
          }));
        }
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

      // Add faction events for combat victories
      // Check if defender was defeated and has a faction
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
          victoryFactionId: 'player',  // Could be replaced with player faction
          reputationGain: 10,           // Faction reputation for defeating enemy
          powerGain: 3                  // Faction power for defeating enemy
        }));

        // M11: Add reputation penalty with defeated NPC's faction
        const currentRep = state.player.factionReputation?.[defenderFactionId] ?? 0;
        const reputationPenalty = -15; // Strong penalty for killing faction member
        events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
          factionId: defenderFactionId,
          previousReputation: currentRep,
          newReputation: currentRep + reputationPenalty,
          reason: 'npc_defeated',
          npcId: defenderId,
          npcFactionId: defenderFactionId
        }));

        // Auto-loot: Roll on loot table and grant items
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

      // ALPHA_M4: Apply hazard damage during combat
      const hazardEvents = applyHazardsInCombat(state, action);
      events.push(...hazardEvents);

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

    case 'DISCOVER_LOCATION': {
      // Discovery event triggered after entering adjacent area
      const locationId = action.payload?.locationId;
      if (!locationId) return events;
      
      const location = state.locations.find(l => l.id === locationId);
      if (!location) return events;
      
      // Mark as discovered if not already
      if (!location.discovered) {
        discoverLocation(state, locationId);
        events.push(createEvent(state, action, 'LOCATION_DISCOVERED', {
          locationId,
          name: location.name,
          description: location.description,
          biome: location.biome,
          message: `New location discovered: ${location.name}`
        }));
      }
      break;
    }

    case 'SPEND_SKILL_POINT': {
      // Spend a skill point to unlock an ability
      const { abilityId } = action.payload;
      if (!abilityId) return events;
      
      const ability = getAbility(abilityId);
      if (!ability) return events;
      
      // Build PlayerAbilities object from player state
      const playerAbilities = {
        unlockedAbilities: state.player.unlockedAbilities ?? [],
        equippedAbilities: state.player.equippedAbilities ?? [],
        abilityCooldowns: state.player.abilityCooldowns ?? {}
      };
      
      // Check if ability can be unlocked
      const unlockCheck = canUnlockAbility(
        playerAbilities,
        abilityId,
        state.player.level ?? 1,
        state.player.skillPoints ?? 0
      );
      
      if (!unlockCheck.canUnlock) {
        events.push(createEvent(state, action, 'SKILL_POINT_ERROR', {
          reason: unlockCheck.reason || 'Cannot unlock ability',
          abilityId,
          message: unlockCheck.reason || `Cannot unlock ${ability.name}.`
        }));
        return events;
      }
      
      // Unlock the ability
      unlockAbility(playerAbilities, abilityId);
      state.player.unlockedAbilities = playerAbilities.unlockedAbilities;
      state.player.skillPoints = (state.player.skillPoints ?? 0) - ability.skillPointCost;
      
      events.push(createEvent(state, action, 'ABILITY_UNLOCKED', {
        abilityId,
        abilityName: ability.name,
        skillPointsSpent: ability.skillPointCost,
        skillPointsRemaining: state.player.skillPoints,
        message: `Learned skill: ${ability.name}!`
      }));
      break;
    }

    case 'EQUIP_ABILITY': {
      // Equip an unlocked ability to an active slot
      const { abilityId } = action.payload;
      if (!abilityId) return events;
      
      const ability = getAbility(abilityId);
      if (!ability) return events;
      
      // Build PlayerAbilities object
      const playerAbilities = {
        unlockedAbilities: state.player.unlockedAbilities ?? [],
        equippedAbilities: state.player.equippedAbilities ?? [],
        abilityCooldowns: state.player.abilityCooldowns ?? {}
      };
      
      // Check if ability is already unlocked
      if (!playerAbilities.unlockedAbilities.includes(abilityId)) {
        events.push(createEvent(state, action, 'ABILITY_EQUIP_ERROR', {
          reason: 'Ability not unlocked',
          abilityId,
          message: `Cannot equip ${ability.name}. Unlock it first.`
        }));
        return events;
      }
      
      // Check if slots are available
      if (playerAbilities.equippedAbilities.length >= 6) {
        events.push(createEvent(state, action, 'ABILITY_EQUIP_ERROR', {
          reason: 'No equip slots available',
          message: 'All ability slots are full. Unequip an ability first.'
        }));
        return events;
      }
      
      // Equip the ability
      equipAbility(playerAbilities, abilityId);
      state.player.equippedAbilities = playerAbilities.equippedAbilities;
      
      events.push(createEvent(state, action, 'ABILITY_EQUIPPED', {
        abilityId,
        abilityName: ability.name,
        slotsUsed: state.player.equippedAbilities?.length ?? 0,
        message: `Equipped: ${ability.name}`
      }));
      break;
    }

    case 'ACTIVATE_ABILITY': {
      // Activate (use) an equipped ability
      const { abilityId } = action.payload;
      if (!abilityId) return events;
      
      const ability = getAbility(abilityId);
      if (!ability) return events;
      
      const equipped = state.player.equippedAbilities ?? [];
      const cooldowns = state.player.abilityCooldowns ?? {};
      
      // Check if ability is equipped
      if (!equipped.includes(abilityId)) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          reason: 'Ability not equipped',
          abilityId,
          message: `Cannot activate ${ability.name}. Equip it first.`
        }));
        return events;
      }
      
      // Check if ability is off cooldown
      const remainingCooldown = cooldowns[abilityId] ?? 0;
      if (remainingCooldown > 0) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          reason: 'Ability on cooldown',
          abilityId,
          remainingCooldown,
          message: `${ability.name} is on cooldown for ${remainingCooldown} ticks`
        }));
        return events;
      }
      
      // Check mana cost if ability uses mana
      let manaCost = 0;
      if (ability.effect.type === 'damage' || ability.effect.type === 'healing') {
        manaCost = Math.ceil((ability.effect.magnitude ?? 20) * 0.5); // Rough mana calc
      }
      
      const currentMp = state.player.mp ?? 0;
      if (currentMp < manaCost) {
        events.push(createEvent(state, action, 'ABILITY_ACTIVATION_ERROR', {
          reason: 'Not enough mana',
          required: manaCost,
          available: currentMp,
          message: `Not enough mana. Required: ${manaCost}, Available: ${currentMp}`
        }));
        return events;
      }
      
      // Apply ability effect
      let damageDealt = 0;
      let healingDealt = 0;
      let statusApplied = '';
      
      switch (ability.effect.type) {
        case 'damage': {
          // Damage effect: reduce player hp of a target (for now, self-damage for testing)
          damageDealt = ability.effect.magnitude ?? 20;
          // In combat context, this would hit an enemy
          events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
            abilityId,
            abilityName: ability.name,
            effectType: 'damage',
            magnitude: damageDealt,
            manaCost,
            message: `Activated ${ability.name}! Dealt ${damageDealt} damage.`
          }));
          break;
        }
        
        case 'healing': {
          // Healing effect: restore hp
          healingDealt = ability.effect.magnitude ?? 15;
          const maxHp = state.player.maxHp ?? 100;
          const currentHp = state.player.hp ?? 50;
          const newHp = Math.min(maxHp, currentHp + healingDealt);
          state.player.hp = newHp;
          
          events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
            abilityId,
            abilityName: ability.name,
            effectType: 'healing',
            magnitude: healingDealt,
            manaCost,
            newHp,
            message: `Activated ${ability.name}! Healed ${healingDealt} HP.`
          }));
          break;
        }
        
        case 'utility': {
          // Utility effect: teleport or movement
          events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
            abilityId,
            abilityName: ability.name,
            effectType: 'utility',
            message: `Activated ${ability.name}! Used utility effect.`
          }));
          break;
        }
        
        default: {
          events.push(createEvent(state, action, 'ABILITY_ACTIVATED', {
            abilityId,
            abilityName: ability.name,
            effectType: ability.effect.type,
            manaCost,
            message: `Activated ${ability.name}!`
          }));
        }
      }
      
      // Deduct mana
      state.player.mp = Math.max(0, currentMp - manaCost);
      
      // Start cooldown
      const cooldownTicks = ability.effect.cooldown ?? 6;
      state.player.abilityCooldowns = {
        ...state.player.abilityCooldowns,
        [abilityId]: cooldownTicks
      };
      
      // Audio ducking for high-tier abilities
      if (ability.tier >= 3) {
        events.push(createEvent(state, action, 'AUDIO_DUCKING_TRIGGERED', {
          abilityId,
          abilityName: ability.name,
          duckingAmount: 0.5,
          duckingDuration: Math.ceil(cooldownTicks * 0.3), // Duck for 30% of cooldown
          message: `High-tier ability ${ability.name} triggered audio emphasis!`
        }));
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

      // === M12: Mastery Roll for Quality Items ===
      // Roll for "Fine" or "Exquisite" quality crafted items
      // Uses INT check to potentially produce higher-quality version
      const playerWis = state.player.stats?.int || 10;
      const masteryRoll = Math.floor(random() * 20) + 1;
      const masteryMod = Math.floor((playerInt + playerWis) / 2) / 3; // Average of INT stats
      const masteryTotal = masteryRoll + masteryMod;
      
      let qualityTier: 'normal' | 'fine' | 'exquisite' = 'normal';
      let qualityMultiplier = 1.0;
      
      if (masteryTotal >= 18) {
        // Exquisite: +20% stat bonus, rare quality
        qualityTier = 'exquisite';
        qualityMultiplier = 1.2;
        events.push(createEvent(state, action, 'CRAFTING_MASTERY_SUCCESS', {
          tier: 'exquisite',
          roll: masteryRoll,
          modifier: masteryMod,
          total: masteryTotal,
          message: `Masterful craftsmanship! You created an EXQUISITE item!`
        }));
      } else if (masteryTotal >= 12) {
        // Fine: +10% stat bonus, uncommon quality
        qualityTier = 'fine';
        qualityMultiplier = 1.1;
        events.push(createEvent(state, action, 'CRAFTING_MASTERY_SUCCESS', {
          tier: 'fine',
          roll: masteryRoll,
          modifier: masteryMod,
          total: masteryTotal,
          message: `You crafted a FINE item with excellent quality.`
        }));
      }

      // ALPHA_M15: Apply seasonal bonus to item quality (autumn boost)
      const seasonalMods = calculateSeasonalModifiers((state as any).season || 'spring');
      const seasonalQualityBonus = (seasonalMods.itemQualityMult - 1.0) * 0.5; // 50% of seasonal effect applies to items
      qualityMultiplier = qualityMultiplier * (1.0 + seasonalQualityBonus);

      if (seasonalMods.itemQualityMult > 1.1) {
        // Autumn boost
        events.push(createEvent(state, action, 'SEASONAL_CRAFTING_BONUS', {
          season: state.season || 'spring',
          bonusMultiplier: 1.0 + seasonalQualityBonus,
          message: `The autumn harvest strengthens your craftsmanship!`
        }));
      }

      // Build crafted item with quality modifier
      const craftedResult = {
        ...recipe.result,
        quality: qualityTier,
        bonusMultiplier: qualityMultiplier
      };

      events.push(createEvent(state, action, 'ITEM_CRAFTED', {
        recipeId,
        success: true,
        result: craftedResult,
        quality: qualityTier,
        qualityMultiplier,
        roll: craftingCheck.roll,
        difficulty: craftingCheck.difficulty,
        masteryRoll,
        masteryTotal
      }));

      events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
        itemId: recipe.result.itemId,
        quantity: recipe.result.quantity,
        source: 'craft',
        recipeId,
        quality: qualityTier,
        bonusMultiplier: qualityMultiplier
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

      // Second time: apply spell resolution with all ALPHA enhancements
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

      // ALPHA_M15: Apply seasonal modifiers to mana cost
      const seasonalMods = calculateSeasonalModifiers((state as any).season || 'spring');
      const baseManaRequired = spell.manaCost || 10;
      const manaRequired = Math.round(baseManaRequired / seasonalMods.manaRegenMult);
      
      if ((state.player.mp || 0) < manaRequired) {
        events.push(createEvent(state, action, 'SPELL_CAST_FAILED', {
          spellId,
          reason: 'insufficient-mana',
          required: manaRequired,
          available: state.player.mp || 0,
          seasonalModifier: seasonalMods.manaRegenMult
        }));
        break;
      }

      // Deduct mana
      state.player.mp = (state.player.mp || 0) - manaRequired;

      // ALPHA_M15: Check for blizzard hazard while casting
      const playerLocation = state.locations.find(l => l.id === state.player.location);
      const weather = (state as any).weather || 'clear';
      const seasonVal = (state as any).season || 'spring';
      const weatherResult = resolveWeather(seasonVal as 'winter' | 'spring' | 'summer' | 'autumn', (state as any).hour || 12, weather);
      const isSheltered = playerLocation ? isLocationSheltered(playerLocation.biome) : false;
      const hazard = checkEnvironmentalHazard(
        weatherResult.current,
        weatherResult.intensity,
        (state as any).hour || 12,
        playerLocation || { id: 'unknown', name: 'Unknown', biome: 'forest' },
        isSheltered
      );

      if (hazard && !isSheltered) {
        // Blizzard interrupts spell or damages caster
        state.player.hp = Math.max(0, (state.player.hp || 100) - hazard.damageTicks);
        events.push(createEvent(state, action, 'SPELL_INTERRUPTED_BY_HAZARD', {
          spellId,
          hazardType: hazard.hazardType,
          damage: hazard.damageTicks,
          weather: weatherResult.current
        }));
        break;
      }

      // Spell succeeded - emit event
      // ALPHA_M15: Map spell discipline to visual element for particle effects
      let visualElement = 'arcane'; // Default
      if (spell.discipline) {
        switch (spell.discipline.toLowerCase()) {
          case 'ruin':
          case 'fire':
            visualElement = 'fire';
            break;
          case 'flux':
          case 'lightning':
            visualElement = 'arcane';
            break;
          case 'life':
          case 'healing':
            visualElement = 'arcane'; // Healing uses arcane particles
            break;
          case 'veil':
          case 'shadow':
          case 'void':
            visualElement = 'shadow';
            break;
          case 'frost':
          case 'ice':
            visualElement = 'frost';
            break;
          default:
            visualElement = 'arcane';
        }
      }

      events.push(createEvent(state, action, 'SPELL_CAST', {
        spellId,
        spellName: spell.name,
        discipline: spell.discipline,
        visualElement, // ALPHA_M15: For particle effects
        targetId,
        targetName: target.name || 'Unknown',
        damageDealt: spellResult.damageDealt,
        healing: spellResult.healing,
        statusApplied: spellResult.statusApplied,
        manaCost: spellResult.manaConsumed,
        message: spellResult.message,
        seasonalManaModifier: seasonalMods.manaRegenMult,
        actualManaCost: manaRequired
      }));

      // ALPHA_M4: If spell applies a status effect, emit status effect event with duration
      if (spellResult.statusApplied) {
        const statusDurations: Record<string, number> = {
          'FROZEN': 3,
          'STUNNED': 2,
          'BURNING': 4,
          'POISONED': 5,
          'SILENCED': 2,
          'WEAKENED': 3,
          'DAZED': 1
        };
        const duration = statusDurations[spellResult.statusApplied] || 2;
        
        events.push(createEvent(state, action, 'STATUS_APPLIED_WITH_DURATION', {
          targetId,
          targetName: target.name || 'Unknown',
          statusEffect: spellResult.statusApplied,
          duration,
          source: `spell:${spellId}`,
          message: `${target.name || 'Target'} is now ${spellResult.statusApplied.toLowerCase()} for ${duration} rounds!`
        }));

        // Also emit stat penalty info for UI display
        const statPenalties: Record<string, any> = {
          'FROZEN': { agi: -50, str: -25 },
          'STUNNED': { all: -100 }, // Can't act
          'BURNING': { end: -25 },
          'POISONED': { end: -15 },
          'SILENCED': { int: -50 }, // Can't cast spells
          'WEAKENED': { str: -40 },
          'DAZED': { agi: -30 }
        };
        if (statPenalties[spellResult.statusApplied]) {
          events.push(createEvent(state, action, 'STAT_PENALTY_APPLIED', {
            targetId,
            statusEffect: spellResult.statusApplied,
            penaltyStats: statPenalties[spellResult.statusApplied],
            message: `${target.name || 'Target'}'s stats are reduced by ${spellResult.statusApplied}!`
          }));
        }
      }
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
        state.player.knowledgeBase = new Map();
      }
      state.player.knowledgeBase.set(`${entityType}:${entityId}`, true);

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
        state.player.knowledgeBase = new Map();
      }
      state.player.knowledgeBase.set(`npc:${targetId}`, true);

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

    case 'STUDY_SCROLL': {
      // ALPHA_M13 Step 1: Consume a scroll or tome to unlock knowledge
      // Grants a specific knowledgeBase entry (recipe:X, lore:X, etc.)
      const { scrollItemId, knowledgeType, knowledgeId } = action.payload;

      if (!scrollItemId || !knowledgeType || !knowledgeId) {
        events.push(createEvent(state, action, 'STUDY_SCROLL_FAILED', {
          reason: 'Invalid scroll or knowledge target',
          message: 'Cannot study that scroll.'
        }));
        break;
      }

      // Check if player has the scroll in inventory
      const inventory = state.player.inventory || [];
      const scrollItem = inventory.find(item => 
        item.kind === 'stackable' && item.itemId === scrollItemId && item.quantity > 0
      ) as StackableItem | undefined;

      if (!scrollItem || scrollItem.quantity === 0) {
        events.push(createEvent(state, action, 'STUDY_SCROLL_FAILED', {
          reason: 'Scroll not in inventory',
          message: `You don't have ${scrollItemId}.`
        }));
        break;
      }

      // Consume the scroll
      (scrollItem as any).quantity--;

      // Add knowledge to knowledgeBase
      if (!state.player.knowledgeBase) {
        state.player.knowledgeBase = new Map();
      }
      const knowledgeKey = `${knowledgeType}:${knowledgeId}`;
      const alreadyKnown = state.player.knowledgeBase.has(knowledgeKey);
      state.player.knowledgeBase.set(knowledgeKey, true);

      events.push(createEvent(state, action, 'KNOWLEDGE_GAINED', {
        scrollItemId,
        knowledgeType,
        knowledgeId,
        knowledgeKey,
        alreadyKnown,
        message: alreadyKnown
          ? `You already knew about ${knowledgeId}.`
          : `You learned: ${knowledgeType === 'recipe' ? 'Recipe' : 'Lore'} - ${knowledgeId}!`
      }));

      events.push(createEvent(state, action, 'ITEM_USED', {
        itemId: scrollItemId,
        quantity: 1,
        reason: 'study-scroll'
      }));
      break;
    }

    case 'OBSERVE_CRAFTING': {
      // ALPHA_M13 Step 1: Interact with a crafter NPC to learn a recipe
      // Uses INT check; success discovers a recipe tied to that NPC
      const { npcId, recipeId } = action.payload;

      if (!npcId || !recipeId) {
        events.push(createEvent(state, action, 'OBSERVE_CRAFTING_FAILED', {
          reason: 'Invalid observation target',
          message: 'Cannot observe that crafting.'
        }));
        break;
      }

      // Find the NPC
      const npc = state.npcs.find(n => n.id === npcId);
      if (!npc) {
        events.push(createEvent(state, action, 'OBSERVE_CRAFTING_FAILED', {
          reason: 'NPC not found',
          npcId,
          message: 'That crafter is not here.'
        }));
        break;
      }

      // Check if NPC is available
      const curHour = state.hour ?? 8;
      if (!isNpcAvailable(npc, curHour)) {
        events.push(createEvent(state, action, 'OBSERVE_CRAFTING_FAILED', {
          reason: 'NPC unavailable',
          npcId,
          message: `${npc.name} is not available right now.`
        }));
        break;
      }

      // Perform INT check with DC 12 (difficulty of learning by observation)
      const playerInt = state.player.stats?.int || 10;
      const observationRoll = Math.floor(random() * 20) + 1;
      const observationTotal = observationRoll + Math.floor(playerInt / 2);
      const observationDc = 12;
      const observationSuccess = observationTotal >= observationDc;

      if (!observationSuccess) {
        events.push(createEvent(state, action, 'OBSERVE_CRAFTING_FAILED', {
          npcId,
          npcName: npc.name,
          recipeId,
          roll: observationRoll,
          check: Math.floor(playerInt / 2),
          dc: observationDc,
          margin: observationTotal - observationDc,
          message: `You watch ${npc.name} work but learn nothing. (Failed by ${Math.abs(observationTotal - observationDc)})`
        }));
        break;
      }

      // Success! Discover the recipe
      if (!state.player.knowledgeBase) {
        state.player.knowledgeBase = new Map();
      }
      const recipeKey = `recipe:${recipeId}`;
      const alreadyKnown = state.player.knowledgeBase.has(recipeKey);
      state.player.knowledgeBase.set(recipeKey, true);

      events.push(createEvent(state, action, 'KNOWLEDGE_GAINED', {
        npcId,
        npcName: npc.name,
        recipeId,
        knowledgeType: 'recipe',
        knowledgeKey: recipeKey,
        alreadyKnown,
        roll: observationRoll,
        check: Math.floor(playerInt / 2),
        dc: observationDc,
        margin: observationTotal - observationDc,
        message: alreadyKnown
          ? `You review ${npc.name}'s crafting technique once more.`
          : `You carefully observe ${npc.name}'s technique and learn the recipe: ${recipeId}!`
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
      // M9 Phase 3 + Phase 14: Search current location for hidden areas and sub-areas
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

      // Fallback to legacy hidden areas
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

    case 'SCOUT_TERRITORY': {
      // M10 Phase 5: Scout wilderness nodes via Perception/Wisdom check
      // Reveals nearby wilderness nodes within a radius, exposing their biome and difficulty
      const { radius } = action.payload || { radius: 50 };

      // Import for type safety
      type WildernessNode = any; // Avoid circular dependency
      
      // Get current player location coordinates
      const playerLoc = state.locations.find(l => l.id === state.player.location);
      if (!playerLoc) {
        events.push(createEvent(state, action, 'SCOUT_FAILED', {
          reason: 'Location not found',
          message: 'Cannot scout from an unknown location.'
        }));
        break;
      }

      const playerX = playerLoc.x || 0;
      const playerY = playerLoc.y || 0;

      // Perform wilderness scouting check (INT-based)
      const playerWis = state.player.stats?.int || 10;
      const playerPer = state.player.stats?.int || 10;
      const totalCheck = playerWis + playerPer;

      // DC scales with radius (further = harder to spot)
      const baseDC = 12;
      const radiusMod = Math.floor(radius / 25); // +1 DC per 25 units
      const scoutDC = baseDC + radiusMod;

      // Roll scout check
      const scoutRoll = Math.floor(random() * 20) + 1;
      const scoutTotal = scoutRoll + totalCheck;
      const isSuccess = scoutTotal >= scoutDC;

      if (isSuccess) {
        // Successful scout! Generate discovery data
        // In a full implementation, this would call wildernessEngine to generate nodes in radius
        const discoveredCount = Math.ceil((scoutTotal - scoutDC) / 5) + 1; // 1+ nodes per 5 margin
        
        events.push(createEvent(state, action, 'SCOUT_SUCCESS', {
          radius,
          roll: scoutRoll,
          check: totalCheck,
          dc: scoutDC,
          margin: scoutTotal - scoutDC,
          discoveredCount,
          message: `You scout the area successfully and discover ${discoveredCount} nearby territory site(s)!`
        }));

        // Mark nearby wilderness nodes as discovered if they exist in state
        if ((state as any).wildernessNodes) {
          const wildenessNodes = (state as any).wildernessNodes as WildernessNode[];
          const nearestNodes = wildenessNodes
            .filter(node => {
              const dx = node.x - playerX;
              const dy = node.y - playerY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              return distance <= radius;
            })
            .slice(0, discoveredCount);

          // Mark nodes as discovered
          nearestNodes.forEach((node: any) => {
            node.discovered = true;
          });

          // Track discovered wilderness nodes in knowledge base
          if (!state.player.knowledgeBase) {
            state.player.knowledgeBase = new Map();
          }
          nearestNodes.forEach((node: any) => {
            const knowledgeKey = `wilderness:${node.id}`;
            if (!state.player.knowledgeBase!.has(knowledgeKey)) {
              state.player.knowledgeBase!.set(knowledgeKey, true);
            }
          });
        }
      } else {
        // Failed scout
        events.push(createEvent(state, action, 'SCOUT_FAILED', {
          roll: scoutRoll,
          check: totalCheck,
          dc: scoutDC,
          margin: scoutTotal - scoutDC,
          message: `Your scouting reveals nothing new. (Failed by ${Math.abs(scoutTotal - scoutDC)})`
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

      // === ALPHA_M2: Calculate and track corruption ===
      // Count runes infused on this relic (after adding new one)
      const infusedRuneCount = relic.runicSlots.filter((s) => s.runeId).length;
      const paradoxLevel = (state.player as any).temporalDebt ?? 0;
      const corruptionCalc = calculateItemCorruption(infusedRuneCount, paradoxLevel);
      
      // Store corruption value on relic
      (relic as any).corruption = corruptionCalc.corruption;

      // === M12: Sentience Increase on Successful Infusion ===
      // Each infusion has a chance to increase relic sentience
      // Higher-tier runes increase sentience more
      const runeComplexityBonus = rune.complexity * 5; // 5% per complexity point
      const sentinceIncreaseChance = Math.min(25 + runeComplexityBonus, 95); // 25-95% chance based on rune tier
      const sentenceRoll = Math.floor(random() * 100);
      let sentinceIncreased = false;
      let newSentienceLevel = relic.sentienceLevel;

      if (sentenceRoll < sentinceIncreaseChance) {
        sentinceIncreased = true;
        newSentienceLevel = (relic.sentienceLevel || 0) + 1;
        relic.sentienceLevel = newSentienceLevel;

        // If relic reaches high sentience (4+), emit special event
        if (newSentienceLevel >= 4) {
          events.push(createEvent(state, action, 'RELIC_SENTIENCE_SURGE', {
            relicId,
            relicName: relic.name,
            newSentienceLevel,
            message: `${relic.name} awakens! Its sentience surges with divine awareness!`
          }));
        }
      }

      events.push(createEvent(state, action, 'RUNE_INFUSED', {
        relicId,
        relicName: relic.name,
        runeId,
        runeName: rune.name,
        message: `You successfully infuse ${rune.name} into ${relic.name}!`,
        stability: stability.risk,
        corruption: corruptionCalc.corruption,
        corruptionStatus: corruptionCalc.status,
        sentinceIncreased,
        newSentienceLevel
      }));

      // ALPHA_M2: Emit CORRUPTION_FLARE if relic becomes corrupted
      if (corruptionCalc.status === 'corrupted') {
        events.push(createEvent(state, action, 'CORRUPTION_FLARE', {
          relicId,
          relicName: relic.name,
          corruption: corruptionCalc.corruption,
          message: `${relic.name} surges with corrupting power! A paradoxical flare erupts!`,
          triggerDirector: true
        }));
      }
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