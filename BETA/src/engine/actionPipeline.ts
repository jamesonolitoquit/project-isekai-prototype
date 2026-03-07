import { WorldState, StackableItem } from './worldEngine';
import type { NPC, InventoryItem, CraftingRecipe } from './worldEngine';
import { Event } from '../events/mutationLog';
import { random } from './prng';
import { validateStatAllocation } from './characterCreation';
import { resolveCombat, resolveDefense, resolveParry, resolveHeal, CombatantStats, getEquipmentBonuses, applyEquipmentBonuses } from './ruleEngine';
import { getLegacyEngine } from './legacyEngine';
import { isNpcAvailable, resolveDialogue, type DialogueOption } from './npcEngine';
import { BranchingDialogueEngine } from './branchingDialogueEngine';
import { resolveLootTable, validateRecipe, rollCraftingCheck } from './craftingEngine';
import { resolveSpell, getSpellById } from './magicEngine';
import { calculateDrift, validateAuthority, checkForSpellBackfire } from './paradoxEngine';
import { calculateMorphCost, generateRitualChallenge, performRitualCheck, handleMorphSuccess, handleMorphFailure, calculateEssenceDecay, checkMorphCooldown, findNearestAltar } from './morphEngine';
import { calculateEncounterChance, selectEncounterType, generateEncounterNpc, generateEncounterCombatant, calculateTravelDistance, hasHiddenAreas, getLocationBiome, calculateSearchDifficulty, performSearchCheck } from './encounterEngine';
import { checkInfusionStability, calculateUnbindCost, calculateItemCorruption } from './artifactEngine';
import { checkLocationHazards } from './hazardEngine';
import { checkLocationDiscovery, discoverLocation } from './mapEngine';
import { canUnlockAbility, unlockAbility, equipAbility, getAbility } from './skillEngine';
import { getLocationControllingFaction, calculateFactionTax } from './factionTerritoryEngine';
import { getInvestigationPipeline } from './investigationPipelineEngine';
import { awardMerit, calculateMeritReward } from './factionCommandEngine';
import { initiateChronicleTransition, getNextEpoch, EPOCH_DEFINITIONS } from './chronicleEngine';
import { healWorldScar, restoreScarLocation, createWorldScar } from './worldScarsEngine';
import { resolveSpatialInteraction, createSpatialInteractionEvents } from './spatialInteractionEngine';
import { resolveAbility, canUseAbility, ABILITY_DATABASE } from './abilityResolver';
import { getSeasonalModifiers, getSeasonalLoot } from './seasonEngine';
import { multiverseAdapter } from './multiverseAdapter';
import { grantProficiencyXP, ActionSignificanceContext } from './proficiencyEngine';

// Helper function to check knowledge base (handles Map or Array)
function hasKnowledge(kb: any, key: string): boolean {
  if (!kb) return false;
  if (kb instanceof Map) return kb.has(key);
  if (Array.isArray(kb)) return kb.includes(key);
  return (kb as Record<string, any>)[key] !== undefined;
}

// Helper function to add knowledge to knowledge base (handles Map or Array)
function addKnowledge(kb: any, key: string, value: any = true): any {
  if (!kb) {
    kb = new Map();
  }
  if (kb instanceof Map) {
    (kb as Map<string, any>).set(key, value);
  } else if (Array.isArray(kb)) {
    if (!kb.includes(key)) {
      kb.push(key);
    }
  } else {
    (kb as Record<string, any>)[key] = value;
  }
  return kb;
}

// Helper function to generate relic dialogue (stub implementation)
function generateRelicDialogue(relic: any, type: string): string {
  const relicName = relic?.name || 'Unknown Relic';
  const dialogues: Record<string, string[]> = {
    greeting: [
      `Greetings, Bound One. I am ${relicName}.`,
      `At last... I sense your presence, ${relicName}.`,
      `Welcome to my eternal service.`,
      `Your soul and mine are now entwined.`
    ],
    farewell: [
      `Our bond weakens...`,
      `Until we meet again...`,
      `The strain fades, but our connection remains.`
    ],
    power: [
      `My power flows through you!`,
      `Feel the strength of ages!`,
      `Tap into true power now.`
    ]
  };
  
  const typeDialogues = dialogues[type] || dialogues['greeting'];
  return typeDialogues[Math.floor(Math.random() * typeDialogues.length)];
}

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

/**
 * M57-A1: Item template structure from items.json
 */
interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  rarity: string;
  description: string;
  equipmentSlot?: string;
  stats?: Record<string, number>;
  baseDamage?: number;
  effect?: Record<string, any>;
  stackable: boolean;
  weight: number;
}

/**
 * M57-A1: Loot table entry structure
 */
interface LootTableEntry {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

/**
 * M57-A1: Items data structure
 */
interface ItemsDataStructure {
  items: ItemTemplate[];
  recipes: CraftingRecipe[];
  loot_tables: Record<string, LootTableEntry[]>;
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
 * Phase 23: Apply seasonal modifiers to a base value
 * @param baseValue The base value to modify
 * @param modifierKey The key of the modifier (e.g., 'manaRegenMult', 'staminaDecayMult')
 * @param seasonalModifiers The current seasonal modifiers from the world state
 * @returns The modified value
 */
function applySeasonalModifier(baseValue: number, modifierKey: string, seasonalModifiers: Record<string, number> | undefined): number {
  if (!seasonalModifiers || !seasonalModifiers[modifierKey]) {
    return baseValue;
  }
  const modifier = seasonalModifiers[modifierKey];
  if (modifierKey.endsWith('Mult')) {
    return Math.ceil(baseValue * modifier);
  } else if (modifierKey.endsWith('Base') || modifierKey === 'luckBonus') {
    return baseValue + modifier;
  }
  return baseValue;
}

/**
 * Phase 23: Inject seasonal loot into loot table drops
 * @param originalLoot The original loot array from resolveLootTable
 * @param seasonalLoot The seasonal loot entries to inject
 * @returns The combined loot array
 */
function injectSeasonalLoot(originalLoot: InventoryItem[], seasonalLoot: any[]): InventoryItem[] {
  if (!seasonalLoot || seasonalLoot.length === 0) {
    return originalLoot;
  }

  const injectedLoot = [...originalLoot];
  for (const seasonalEntry of seasonalLoot) {
    if (random() <= (seasonalEntry.dropRate || 0.1)) {
      injectedLoot.push({
        kind: 'stackable',
        itemId: seasonalEntry.itemId,
        quantity: 1
      } as any);
    }
  }

  // Phase 29: Inject Multiverse Leaked Loot
  const leakedItems = multiverseAdapter.getLeakedItems();
  if (leakedItems.length > 0) {
    for (const leaked of leakedItems) {
      // Very rare 1% chance for a multiverse leak item per loot event
      if (random() <= 0.01) {
        injectedLoot.push({
          kind: 'stackable',
          itemId: leaked.id,
          quantity: 1
        } as any);
      }
    }
  }

  return injectedLoot;
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
 * ALPHA_M4: Apply hazard damage during combat
 * Called after each combat round to check and apply environmental hazards
 */
function applyHazardsInCombat(state: WorldState, action: Action): Event[] {
  const hazardEvents: Event[] = [];
  
  // Get hazards from world state (if available)
  const hazards = state.hazards || [];
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

// Build item templates map from items.json (DEPRECATED: Use state.itemTemplates instead)
const ITEM_TEMPLATES: Record<string, any> = {};

// Build recipe map from items.json (DEPRECATED: Use state.craftingRecipes instead)
const RECIPES: Record<string, any> = {};

// Build loot tables map from items.json (DEPRECATED: Use state.lootTables instead)
const LOOT_TABLES: Record<string, any> = {};

/**
 * MetagameValidator checks for suspicious player actions that suggest metagaming
 * (e.g., targeting NPC before discovering them, moving to undiscovered locations)
 * 
 * ALPHA_M18: Enhanced with WTOL enforcement and Temporal Fog status effects
 * - Blocks ATTACK/TALK on masked entities unless discovered via IDENTIFY
 * - Applies Temporal Fog status when suspicion > 30 (reduces accuracy, increases spell failure)
 */
// sonarqube-disable sonar/cognitive-complexity
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
      const hasKnowledge = knowledgeBase instanceof Map 
        ? knowledgeBase.has(`location:${targetLocation}`)
        : (knowledgeBase as any)?.[`location:${targetLocation}`];
      
      if (targetLocation && !hasItem(visitedLocations, targetLocation) && !hasKnowledge) {
        isSuspicious = true;
        reason = 'Moved to undiscovered location - possible metagaming';
        suspicionIncrement = 15;
      }
      break;
    }
    
    case 'INTERACT_NPC': {
      const npcId = action.payload?.npcId;
      // Check if NPC hasn't been identified yet
      if (npcId && !hasKnowledge(knowledgeBase, `npc:${npcId}`)) {
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
        if (targetNpc && !hasKnowledge(knowledgeBase, `npc:${targetId}`)) {
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
        if (isNpc && !hasKnowledge(knowledgeBase, `npc:${targetId}`)) {
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
        const isIdentified = hasKnowledge(knowledgeBase, `npc:${targetId}`);
        const isProximityRevealed = hasKnowledge(knowledgeBase, `proximity:${targetId}`);
        
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
    
    const previousLevel = state.player?.suspicionLevel;
    const newLevel = previousLevel + suspicionIncrement;
    (state.player as any).suspicionLevel = newLevel;
    
    // ALPHA_M18: Apply Temporal Fog when suspicion crosses 30 threshold
    if (previousLevel < 30 && newLevel >= 30 && !hasItem(state.player.statusEffects, 'temporal_fog')) {
      statusEffectApplied = 'temporal_fog';
      if (!state.player.statusEffects) {
        (state.player as any).statusEffects = [];
      }
      state.player.statusEffects?.push('temporal_fog');
      
      events.push(createEvent(state, action, 'STATUS_EFFECT_APPLIED', {
        effect: 'temporal_fog',
        reason: 'Metagaming detection threshold reached',
        modifiers: {
          accuracyPenalty: -0.25,
          spellFailureChance: 0.3,
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
  isDirector?: boolean; // Phase 4 Task 5: Director privilege flag
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

// sonarqube-disable sonar/cognitive-complexity,sonar/switch-without-default
export function processAction(state: WorldState, action: Action): Event[] {
  const events: Event[] = [];

  // Phase 12: Check AI DM authority - is this action permitted by the cosmos?
  // M55-E1: Skip authority check for Director-only actions
  if (action.type !== 'APPLY_ARCHITECT_CHANGES') {
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

  // Phase 4 Task 5: Handle Director-exclusive architectural mutations
  if (action.type === 'APPLY_ARCHITECT_CHANGES') {
    // Authorization: Only Directors can apply architectural changes
    if (!action.isDirector) {
      events.push(createEvent(state, action, 'AUTHORIZATION_DENIED', {
        action: action.type,
        reason: 'Only Directors can apply architectural changes',
        payload: action.payload
      }));
      return events;
    }

    const { locations, factions, climate } = action.payload || {};
    
    // Log the architectural mutation as a SYSTEM event (survives snapshots)
    const mutationEvent: Event = createEvent(state, action, 'WORLD_STRUCTURE_MUTATION', {
      locations,
      factions,
      climate,
      changedBy: state.player.id,
      appliedAt: state.tick || 0
    });
    mutationEvent.mutationClass = 'ARCHITECT';
    events.push(mutationEvent);
    
    // Log faction seed mutations separately for auditing
    if (factions && factions.length > 0) {
      const factionEvent: Event = createEvent(state, action, 'FACTION_SEED_MUTATION', {
        factions,
        changedBy: state.player.id,
        appliedAt: state.tick || 0
      });
      factionEvent.mutationClass = 'ARCHITECT';
      events.push(factionEvent);
    }
    
    // Log climate changes separately
    if (climate) {
      const climateEvent: Event = createEvent(state, action, 'CLIMATE_OVERRIDE', {
        climate,
        changedBy: state.player.id,
        appliedAt: state.tick || 0
      });
      climateEvent.mutationClass = 'ARCHITECT';
      events.push(climateEvent);
    }
    
    return events; // Return immediately - mutations are applied via stateRebuilder
  }

  switch (action.type) {
    case 'MOVE': {
      // M9 Phase 3: Enhanced movement with travel animation and distance-based time
      const to = action.payload?.to;
      if (!to?.length || !state.locations.some(loc => loc.id === to)) {
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
        travelDistance = Math.hypot(dx, dy);
        
        // Travel time scales with distance
        // Base: 30 ticks + (distance * 0.01 ticks per coordinate unit)
        travelTicks = 30 + Math.round(travelDistance * 0.01);
      }

      // Apply terrain modifier to travel time
      const targetTerrainMod = targetLocation.terrainModifier ?? 1;
      travelTicks = Math.round(travelTicks * targetTerrainMod);

      // ALPHA_M15: Apply environmental fatigue (MP cost for movement)
      let weather: 'clear' | 'snow' | 'rain' = 'clear';
      const baseWeather = state.weather || 'clear';
      if (baseWeather === 'snow') weather = 'snow';
      else if (baseWeather === 'rain') weather = 'rain';
      else if (baseWeather === 'ash_storm') weather = 'rain';
      else if (baseWeather === 'cinder_fog') weather = 'rain';
      else if (baseWeather === 'mana_static') weather = 'clear';
      
      const season = state.season || 'spring';
      const weatherResult = resolveWeather(season, state.hour || 12, weather);
      const fatigueMult = calculateEnvironmentalFatigue(weatherResult.current, weatherResult.intensity);
      
      // Phase 7: Clear target when moving to a new location
      if (state.player.activeTargetId) {
        events.push(createEvent(state, action, 'TARGET_LOCKED', {
          targetId: null,
          reason: 'player-moved'
        }));
      }

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
        if (targetLoc?.id && state.influenceMap?.[to]) {
          const territoryInfluence = state.influenceMap[to];
          
          // Find dominant faction at this location
          let dominantFaction: string | null = null;
          let maxInfluence = 0;
          Object.entries(territoryInfluence).forEach(([factionId, influence]) => {
            if ((influence ?? 0) > maxInfluence) {
              maxInfluence = (influence ?? 0);
              dominantFaction = factionId;
            }
          });
          
          // If location is dominated by faction (>60 influence), emit territory narration
          if (dominantFaction && maxInfluence > 60) {
            const controllingFaction = state.factions?.find(f => f.id === dominantFaction);
            if (controllingFaction) {
              let narration = '';
              let narrativeType: string;
              
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
      
      // M49-A1: Faction territory taxation/bounty system
      {
        const controllingFaction = getLocationControllingFaction(state, to);
        if (controllingFaction) {
          const playerRep = state.player.factionReputation?.[controllingFaction.id] || 0;
          
          // Check if location is hostile territory
          if (playerRep < -20) {
            // Trigger bounty/tax event
            const taxResult = calculateFactionTax(state, to);
            
            if (taxResult) {
              // Check if player has enough gold
              const goldInventory = state.player.inventory?.find(item => 
                (item.kind === 'stackable' && item.itemId === 'gold')
              ) as any;
              const playerGold = goldInventory?.quantity || 0;
              
              if (playerGold >= taxResult.amount) {
                // Apply tax
                if (goldInventory) {
                  goldInventory.quantity = (goldInventory.quantity || 0) - taxResult.amount;
                }
                
                events.push(createEvent(state, action, 'FACTION_TAX_PAID', {
                  factionId: taxResult.factionId,
                  factionName: taxResult.factionName,
                  amount: taxResult.amount,
                  playerReputation: playerRep,
                  message: `${taxResult.factionName} tax collectors demand ${taxResult.amount} gold to allow passage through their territory.`
                }));
              } else {
                // Insufficient gold - trigger bounty/combat encounter
                events.push(createEvent(state, action, 'FACTION_BOUNTY_TRIGGERED', {
                  factionId: taxResult.factionId,
                  factionName: taxResult.factionName,
                  requiredGold: taxResult.amount,
                  playerGold: playerGold,
                  playerReputation: playerRep,
                  message: `${taxResult.factionName} patrols catch you trying to enter their territory without proper payment! A bounty has been placed on your head!`
                }));
              }
            }
          } else if (playerRep < 0 && playerRep > -20) {
            // Neutral/uncertain stance - minor annoyance but no tax
            const minorAnnoyance = controllingFaction.name + ' patrols eye you suspiciously as you pass through their territory.';
            events.push(createEvent(state, action, 'FACTION_SUSPICIOUS', {
              factionId: controllingFaction.id,
              factionName: controllingFaction.name,
              playerReputation: playerRep,
              message: minorAnnoyance
            }));
          }
        }
      }
      
      break;
    }

    case 'SET_TARGET': {
      // Phase 7: Targeting System - Mechanics for combat and interaction
      const targetId = action.payload?.targetId;
      
      // Validation: Target must exist in world (NPC, Object, or Location)
      const targetNpc = state.npcs.find(n => n.id === targetId);
      const targetLocation = state.locations.find(l => l.id === targetId);
      
      if (!targetId) {
        // Clearing target
        events.push(createEvent(state, action, 'TARGET_LOCKED', {
          targetId: null,
          reason: 'manual-clear'
        }));
        return events;
      }

      if (!targetNpc && !targetLocation) {
        // Invalid target
        return [];
      }

      events.push(createEvent(state, action, 'TARGET_LOCKED', {
        targetId,
        targetType: targetNpc ? 'npc' : 'location',
        targetName: targetNpc?.name || targetLocation?.name,
        timestamp: Date.now()
      }));

      return events;
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

      // Phase 11: Check faction reputation gate before dialogue
      const factionReputation = state.player.factionReputation?.[npc.factionId] ?? 0;
      if (npc.factionId && factionReputation < -50) {
        events.push(createEvent(state, action, 'FACTION_REJECTION', {
          npcId,
          npcName: npc.name,
          npcFaction: npc.factionId,
          playerReputation: factionReputation,
          threshold: -50,
          message: `The ${npc.factionId} faction rejects you. ${npc.name} will not speak with you.`
        }));
        return events;
      }

      // Phase 8: Check if NPC has typed dialogue tree from template
      let dialogue: { text: string; options: DialogueOption[] };
      
      if ((npc as any).branchingDialogue) {
        // Use typed BranchingDialogueEngine for template-driven dialogue
        try {
          const dialogueTree = (npc as any).branchingDialogue;
          // Start with the greeting node (or first available node)
          const initialNodeId = 'greeting';
          const initialNode = dialogueTree[initialNodeId];
          
          if (initialNode) {
            // Resolve dialogue branch with strict type validation
            const resolution = BranchingDialogueEngine.resolveDialogueBranch(
              initialNode as any, // Type cast needed for dialogueTree from template
              state.player,
              npc,
              state
            );
            
            // Calculate NPC response tone based on reputation
            const toneMult = BranchingDialogueEngine.calculateNpcResponseTone(npc, state.player);
            
            // Build dialogue from resolved options
            const optionTexts = resolution.accessibleOptions.map(opt => ({
              id: opt.id,
              text: opt.text
            }));
            
            dialogue = {
              text: `${npc.name}: ${initialNode.text}${toneMult > 0.5 ? ' (warmly)' : toneMult < -0.5 ? ' (coldly)' : ''}`,
              options: optionTexts
            };
          } else {
            // Fallback if greeting node not found
            dialogue = resolveDialogue(npc, state.player, state);
          }
        } catch (err) {
          // Fall back to legacy dialogue if typed resolution fails
          console.warn(`[ActionPipeline] Dialogue engine error for ${npcId}:`, err);
          dialogue = resolveDialogue(npc, state.player, state);
        }
      } else {
        // Use legacy dialogue resolution for NPCs without typed dialogue trees
        dialogue = resolveDialogue(npc, state.player, state);
      }

      events.push(createEvent(state, action, 'INTERACT_NPC', {
        npcId,
        npcName: npc.name,
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

      // Phase 8: Check if choice involves a skill check (from branching dialogue)
      let skillCheckResult: any = null;
      const choice = action.payload?.choice; // Optional full choice object for rich data
      
      if (choice && choice.skillCheck) {
        // Resolve skill check with reputation multiplier
        const playerFame = state.player.factionReputation?.[npc.factionId] ?? 0;
        skillCheckResult = BranchingDialogueEngine.resolveSkillCheck(
          state.player,
          choice.skillCheck.skill,
          choice.skillCheck.dc,
          playerFame
        );
        
        // Emit skill check event
        events.push(createEvent(state, action, 'SKILL_CHECK_RESOLVED', {
          npcId: npcId,
          npcName: npc.name,
          skill: choice.skillCheck.skill,
          baseDC: choice.skillCheck.dc,
          playerRoll: skillCheckResult.roll,
          skillBonus: skillCheckResult.skillBonus,
          modifiedDC: skillCheckResult.modifiedDC,
          success: skillCheckResult.success,
          margin: skillCheckResult.margin,
          message: skillCheckResult.success 
            ? `✓ You succeeded by ${skillCheckResult.margin}!`
            : `✗ You failed by ${Math.abs(skillCheckResult.margin)}.`
        }));
        
        // If skill check failed, don't apply consequences
        if (!skillCheckResult.success) {
          events.push(createEvent(state, action, 'DIALOG_CHOICE', { npcId, choiceId, skillCheckFailed: true }));
          break;
        }
      }

      // Phase 8: Apply dialogue consequences from branching dialogue engine
      if (choice && choice.consequenceAction) {
        const consequences = BranchingDialogueEngine.applyDialogueConsequence(
          choice,
          state.player,
          npc,
          state
        );
        
        // Process each consequence
        for (const consequence of consequences) {
          switch (consequence.actionType) {
            case 'START_QUEST':
              if (consequence.payload.questId && !state.player.quests[consequence.payload.questId]) {
                events.push(createEvent(state, action, 'QUEST_STARTED', { questId: consequence.payload.questId }));
              }
              break;
              
            case 'GAIN_REPUTATION':
              if (consequence.payload.factionId) {
                state.player.factionReputation = state.player.factionReputation || {};
                state.player.factionReputation[consequence.payload.factionId] = 
                  (state.player.factionReputation[consequence.payload.factionId] || 0) + (consequence.payload.delta || 10);
                
                events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
                  factionId: consequence.payload.factionId,
                  delta: consequence.payload.delta || 10,
                  newReputation: state.player.factionReputation[consequence.payload.factionId]
                }));
              }
              break;
              
            case 'DAMAGE_REPUTATION':
              if (consequence.payload.factionId) {
                state.player.factionReputation = state.player.factionReputation || {};
                state.player.factionReputation[consequence.payload.factionId] = 
                  (state.player.factionReputation[consequence.payload.factionId] || 0) - (consequence.payload.delta || 10);
                
                events.push(createEvent(state, action, 'REPUTATION_CHANGED', {
                  factionId: consequence.payload.factionId,
                  delta: -(consequence.payload.delta || 10),
                  newReputation: state.player.factionReputation[consequence.payload.factionId]
                }));
              }
              break;
              
            case 'ADD_KNOWLEDGE':
              if (consequence.payload.knowledgeTag) {
                // Ensure player has knowledge base
                if (!state.player.knowledgeBase) {
                  state.player.knowledgeBase = [];
                }
                // Add to knowledge base if it's an array
                if (Array.isArray(state.player.knowledgeBase)) {
                  if (!state.player.knowledgeBase.includes(consequence.payload.knowledgeTag)) {
                    state.player.knowledgeBase.push(consequence.payload.knowledgeTag);
                  }
                }
                
                events.push(createEvent(state, action, 'KNOWLEDGE_GAINED', {
                  knowledgeTag: consequence.payload.knowledgeTag,
                  description: consequence.payload.description || 'New knowledge discovered'
                }));
              }
              break;
              
            case 'COMBAT_START':
              // Combat initiation handled by separate combat action
              events.push(createEvent(state, action, 'COMBAT_INITIATED_BY_DIALOGUE', {
                npcId: npcId,
                npcName: npc.name,
                reason: consequence.payload.reason || 'Dialogue escalated to combat'
              }));
              break;
          }
        }
      } 
      
      // Legacy handling for Soul Echo merit transfer
      if (npc.type === 'SOUL_ECHO' && choiceId === 'inherit_merit' && npc.soulEchoData?.inheritableMerit) {
        const inheritedMerit = npc.soulEchoData.inheritableMerit;
        state.player.merit = (state.player.merit || 0) + inheritedMerit;
        
        events.push(createEvent(state, action, 'SOUL_ECHO_MERIT_TRANSFERRED', {
          npcId,
          npcName: npc.name,
          meritTransferred: inheritedMerit,
          totalMerit: state.player.merit,
          message: `✨ You absorbed the ancestral wisdom of ${npc.name}. Gained ${inheritedMerit} Merit!`
        }));
      }

      // Legacy quest triggering
      if (npc.questId) {
        const quest = state.quests.find(q => q.id === npc.questId);
        if (quest && !state.player.quests[npc.questId]) {
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
      const beliefRegistry = state.beliefRegistry || {};
      if (!beliefRegistry[rumorId]) {
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
      const investigationPipeline = getInvestigationPipeline(state.seed);
      const investigation = investigationPipeline.createInvestigation(rumorId, undefined, state.player.id);

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
        if (!depQuest || (depQuest as any).status !== 'completed') {
          events.push(createEvent(state, action, 'QUEST_LOCKED', {
            questId,
            reason: 'dependencies-not-met',
            missingDependencies: dependencies.filter(d => {
              const depQ = state.player.quests[d];
              return !depQ || (depQ as any).status !== 'completed';
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
          if (objective.timeConstraints) {
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

      // M51-A1: Award merit for quest completion (deeds that advance the narrative)
      const meritReward = calculateMeritReward('QUEST_COMPLETED');
      if (meritReward > 0) {
        const meritResult = awardMerit(state, meritReward, `quest_completed:${questId}`);
        events.push(meritResult.event);
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
        const equipBonuses = getEquipmentBonuses(state.player.equipment, (state as any).itemTemplates || {});
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

      // M49-A5: Apply resonance bonuses if an ancestral echo is active
      const activeEchoId = (state.player as any).activeResonanceEchoId;
      const resonanceLevel = (state.player as any).soulResonanceLevel || 0;
      let resonanceBonus: Record<string, number> = {};
      let resonanceEventPayload: any = {};

      if (activeEchoId && resonanceLevel > 0) {
        const legacyEngine = getLegacyEngine(state.seed);
        const activeEcho = legacyEngine.getSoulEcho(activeEchoId);

        if (activeEcho) {
          // M49-A5: Echo Feedback Multipliers
          // Apply stat bonuses based on echo type and resonance level
          const multiplier = Math.floor(resonanceLevel / 30); // 0-3 bonus ranks at levels 0, 30, 60, 90
          let echoTypeBonus: number;
          if (activeEcho.echoType === 'overwhelming') echoTypeBonus = 4;
          else if (activeEcho.echoType === 'resonant') echoTypeBonus = 3;
          else if (activeEcho.echoType === 'clear') echoTypeBonus = 2;
          else echoTypeBonus = 1;

          resonanceBonus = {
            str: multiplier * echoTypeBonus,
            agi: Math.floor(multiplier * (echoTypeBonus / 2)),
            end: multiplier * 2
          };

          // Apply bonuses to player stats
          playerStats.str = (playerStats.str || 10) + (resonanceBonus.str || 0);
          playerStats.agi = (playerStats.agi || 10) + (resonanceBonus.agi || 0);
          playerStats.end = (playerStats.end || 10) + (resonanceBonus.end || 0);

          resonanceEventPayload = {
            echoId: activeEchoId,
            echoName: activeEcho.originalNpcName,
            resonanceLevel,
            bonusesApplied: resonanceBonus
          };
        }
      }

      // Resolve combat using ruleEngine
      const combatEvents = resolveCombat(
        state.player.id,
        [defenderId],
        playerStats,
        defenderStats,
        state.id
      );
      events.push(...combatEvents);

      // Emit resonance bonus event if active
      if (Object.keys(resonanceBonus).length > 0) {
        events.push(createEvent(state, action, 'RESONANCE_COMBAT_BONUS', resonanceEventPayload));
      }

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
            const entry = lootEntry as any;
            if (roll >= (entry.chance_min || 0) && roll <= (entry.chance_max || 100)) {
              events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
                itemId: entry.item_id,
                quantity: entry.quantity || 1
              }));
              break;
            }
          }
        }

        // Phase 15: Trigger artifact mood update on combat victory
        events.push(createEvent(state, action, 'ARTIFACT_MOOD_TRIGGERED', {
          mood: 'combat_kill',
          targetId: defenderId,
          targetName: defender.name,
          intensity: 1.0,
          message: 'Your equipped artifact senses the victory and pulses with approval.'
        }));
      }

      // Phase 15: Check if player took damage during combat and trigger damage mood
      const combatDamageEvent = combatEvents.find(e => 
        e.type === 'COMBAT_DAMAGE' && e.payload?.targetId === state.player.id
      );
      if (combatDamageEvent) {
        const damageAmount = combatDamageEvent.payload?.amount || 0;
        events.push(createEvent(state, action, 'ARTIFACT_MOOD_TRIGGERED', {
          mood: 'combat_damage_taken',
          damageAmount: damageAmount,
          intensity: Math.min(1, damageAmount / 30), // Normalize to 0-1
          message: 'Your equipped artifact feels your pain and responds with protective instinct.'
        }));
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
        const equipBonuses = getEquipmentBonuses(state.player.equipment, (state as any).itemTemplates || {});
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
        const equipBonuses = getEquipmentBonuses(state.player.equipment, (state as any).itemTemplates || {});
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

    case 'HEAL_WORLD_SCAR': {
      // M54-A1: Heal a world scar at current location using Resonance + Merit
      const playerLocation = action.payload?.locationId || state.player.location;
      const worldScars = (state as any).worldScars || [];
      const scarAtLocation = worldScars.find((s: any) => s.locationId === playerLocation);

      if (!scarAtLocation) {
        events.push(createEvent(state, action, 'HEAL_SCAR_FAILED', {
          reason: 'NO_SCAR_AT_LOCATION',
          message: 'There is no world scar to heal at this location.'
        }));
        break;
      }

      // M54-A1: Cost check - 50 Resonance + 20 Merit
      const playerResonance = (state.player as any).soulResonanceLevel ?? 0;
      const playerMerit = state.player.merit ?? 0;
      const RESONANCE_COST = 50;
      const MERIT_COST = 20;

      if (playerResonance < RESONANCE_COST) {
        events.push(createEvent(state, action, 'HEAL_SCAR_FAILED', {
          reason: 'INSUFFICIENT_RESONANCE',
          currentResonance: playerResonance,
          requiredResonance: RESONANCE_COST,
          message: `You need ${RESONANCE_COST} Soul Resonance to heal this scar. You have ${playerResonance}.`
        }));
        break;
      }

      if (playerMerit < MERIT_COST) {
        events.push(createEvent(state, action, 'HEAL_SCAR_FAILED', {
          reason: 'INSUFFICIENT_MERIT',
          currentMerit: playerMerit,
          requiredMerit: MERIT_COST,
          message: `You need ${MERIT_COST} Merit to heal this scar. You have ${playerMerit}.`
        }));
        break;
      }

      // Deduct costs
      state.player.soulResonanceLevel = playerResonance - RESONANCE_COST;
      state.player.merit = playerMerit - MERIT_COST;

      // Heal the scar
      const healResult = healWorldScar(scarAtLocation, RESONANCE_COST, MERIT_COST);
      const healedScar = healResult.healed;
      const fullyRestored = healResult.fullyRestored;

      // Update scar in state
      (state as any).worldScars = worldScars.map((s: any) => s.id === scarAtLocation.id ? healedScar : s);

      // M54-A1: If fully restored, restore the biome
      if (fullyRestored) {
        const restoration = restoreScarLocation(playerLocation);
        
        // Update location biome
        const location = state.locations.find(l => l.id === playerLocation);
        if (location) {
          location.biome = restoration.restoredBiome as any;
          location.description = restoration.description;
          location.spiritDensity = Math.max(0.3, (location.spiritDensity ?? 0.5) - 0.2); // Healing reduces spirit density
        }

        events.push(createEvent(state, action, 'WORLD_SCAR_FULLY_HEALED', {
          scarId: healedScar.id,
          scarType: healedScar.type,
          locationId: playerLocation,
          restoredBiome: restoration.restoredBiome,
          restorationMessage: restoration.description,
          resonanceSpent: RESONANCE_COST,
          meritSpent: MERIT_COST,
          message: `✨ The ${healedScar.type} scar has been fully healed! ${restoration.description}`
        }));
      } else {
        events.push(createEvent(state, action, 'WORLD_SCAR_HEALED', {
          scarId: healedScar.id,
          scarType: healedScar.type,
          locationId: playerLocation,
          previousHealing: scarAtLocation.healingProgress,
          newHealing: healedScar.healingProgress,
          resonanceSpent: RESONANCE_COST,
          meritSpent: MERIT_COST,
          message: `You channeled healing energy into the scar. Healing progress: ${scarAtLocation.healingProgress.toFixed(0)}% → ${healedScar.healingProgress.toFixed(0)}%`
        }));
      }
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
      // Phase 23: Apply seasonal mana regen modifier (e.g., 1.3x in spring, 0.8x in winter)
      const currentMp = state.player.mp ?? 0;
      const maxMp = state.player.maxMp ?? 0;
      const mpPerRest = Math.ceil(maxMp * 0.25); // 25% per hour base
      const seasonalModifiers = state.currentSeasonalModifiers || {};
      const seasonalMpPerRest = applySeasonalModifier(mpPerRest, 'manaRegenMult', seasonalModifiers);
      const newMp = Math.min(maxMp, currentMp + seasonalMpPerRest);
      const mpRestored = newMp - currentMp;

      events.push(createEvent(state, action, 'PLAYER_REST', {
        hpRestored,
        newHp,
        maxHp,
        mpRestored,
        newMp,
        maxMp,
        hoursCost: 1,
        seasonalModifier: seasonalModifiers.manaRegenMult ? `(${seasonalModifiers.manaRegenMult}x seasonal)` : '',
        message: `Rested 1 hour. HP restored: ${hpRestored}, MP restored: ${mpRestored}${seasonalModifiers.manaRegenMult ? ` (${seasonalModifiers.manaRegenMult}x seasonal modifier)` : ''}`
      }));
      break;
    }

    case 'SUBMIT_CHARACTER': {
      const { character } = action.payload;
      if (!character?.name || !character?.race || !character?.stats || !validateStatAllocation(character.stats)) {
        return []; // Invalid character creation
      }
      events.push(createEvent(state, action, 'CHARACTER_CREATED', { character }));
      break;
    }

    case 'INITIALIZE_PLAYER_ORIGIN': {
      // Phase 5: Heroic Awakening - Wire narrative data to AI Weaver
      // This action processes the character's origin story, archetype, and talents
      // and seeds them into the narrative engine for quest generation
      const { originStory, archetype, talents, character } = action.payload;
      
      if (!state.player) {
        events.push(createEvent(state, action, 'ORIGIN_INITIALIZATION_FAILED', {
          reason: 'NO_PLAYER',
          message: 'Character must be created before initializing origin.'
        }));
        break;
      }

      // Update player with narrative data
      if (originStory) state.player.originStory = originStory;
      if (archetype) state.player.archetype = archetype;
      if (talents && Array.isArray(talents)) {
        state.player.talents = talents;
      }

      // Broadcast origin initialization event to AI Weaver
      events.push(createEvent(state, action, 'PLAYER_ORIGIN_INITIALIZED', {
        playerId: state.player.id,
        playerName: state.player.name,
        originStory: originStory || '',
        archetype: archetype || 'adventurer',
        talents: talents || [],
        stats: state.player.stats,
        currentRace: state.player.currentRace || 'human',
        location: state.player.location,
        message: `${state.player.name} awakens as a ${archetype}! AI Weaver beginning narrative synthesis...`
      }));

      console.log(`[ActionPipeline] Player origin initialized: ${state.player.name} (${archetype})`);
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

    case 'HARVEST_RESOURCE': {
      // M55-C1: Harvest resources from current biome (mutated resources from scars)
      const playerLocation = state.player.location;
      const location = state.locations.find(l => l.id === playerLocation);

      if (!location) {
        events.push(createEvent(state, action, 'HARVEST_FAILED', {
          reason: 'UNKNOWN_LOCATION',
          message: 'You are not at a valid location to harvest.'
        }));
        break;
      }

      // M55-C1: Define resources by biome type
      const biomeResourceMap: Record<string, { resourceId: string; name: string; rarity: string }[]> = {
        'corrupted': [
          { resourceId: 'cursed_locus', name: 'Cursed Locus', rarity: 'rare' },
          { resourceId: 'tainted_essence', name: 'Tainted Essence', rarity: 'uncommon' },
          { resourceId: 'mourning_moss', name: 'Mourning Moss', rarity: 'common' }
        ],
        'cave': [
          { resourceId: 'blessed_crystal', name: 'Blessed Crystal', rarity: 'rare' },
          { resourceId: 'stone_fragment', name: 'Stone Fragment', rarity: 'common' }
        ],
        'mountain': [
          { resourceId: 'blessed_crystal', name: 'Blessed Crystal', rarity: 'rare' },
          { resourceId: 'stone_fragment', name: 'Stone Fragment', rarity: 'common' }
        ],
        'forest': [
          { resourceId: 'radiant_herbs', name: 'Radiant Herbs', rarity: 'common' },
          { resourceId: 'ancient_wood', name: 'Ancient Wood', rarity: 'uncommon' }
        ]
      };

      const biome = location.biome || 'forest';
      const availableResources = biomeResourceMap[biome] || biomeResourceMap['forest'];

      if (availableResources.length === 0) {
        events.push(createEvent(state, action, 'HARVEST_FAILED', {
          reason: 'NO_RESOURCES',
          message: 'There are no harvestable resources at this location.'
        }));
        break;
      }

      // Select random resource from biome
      const harvestedResourceIdx = Math.floor(Math.random() * availableResources.length);
      const harvestedResource = availableResources[harvestedResourceIdx];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity

      // Add to inventory
      if (!state.player.inventory) {
        state.player.inventory = [];
      }

      const existingItem = state.player.inventory.find(item => 
        'stackable' in item && item.itemId === harvestedResource.resourceId
      );

      if (existingItem && 'stackable' in existingItem) {
        (existingItem as any).quantity += quantity;
      } else {
        state.player.inventory.push({
          kind: 'stackable',
          itemId: harvestedResource.resourceId,
          quantity
        });
      }

      events.push(createEvent(state, action, 'RESOURCE_HARVESTED', {
        resourceId: harvestedResource.resourceId,
        resourceName: harvestedResource.name,
        quantity,
        rarity: harvestedResource.rarity,
        biome,
        message: `Harvested ${quantity}x ${harvestedResource.name} (${harvestedResource.rarity})`
      }));
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

    case 'USE_ABILITY': {
      // Phase 4: AbilityResolver integration
      // Cast an equipped ability, using stat-driven formulas and cooldown management
      const { abilityId } = action.payload;
      if (!abilityId) {
        events.push(createEvent(state, action, 'ABILITY_ERROR', {
          reason: 'No ability specified',
          message: 'Ability ID is required to cast'
        }));
        return events;
      }

      const ability = ABILITY_DATABASE[abilityId];
      if (!ability) {
        events.push(createEvent(state, action, 'ABILITY_ERROR', {
          reason: 'Unknown ability',
          abilityId,
          message: `Ability not found: ${abilityId}`
        }));
        return events;
      }

      // Check if ability is equipped
      const isEquipped = (state.player.equippedAbilities || []).includes(abilityId);
      if (!isEquipped) {
        events.push(createEvent(state, action, 'ABILITY_ERROR', {
          reason: 'Ability not equipped',
          abilityId,
          message: `${ability.name} is not equipped. Cannot cast unequipped abilities.`
        }));
        return events;
      }

      // Check if ability can be used
      const abilityCheck = canUseAbility(ability, state.player);
      if (!abilityCheck.canUse) {
        events.push(createEvent(state, action, 'ABILITY_ERROR', {
          reason: 'Cannot use ability',
          abilityId,
          message: abilityCheck.reason || `Cannot cast ${ability.name}`
        }));
        return events;
      }

      // Resolve ability execution
      const result = resolveAbility(abilityId, state.player, state);
      if (!result.success) {
        events.push(createEvent(state, action, 'ABILITY_ERROR', {
          reason: result.reason || 'Ability failed',
          abilityId,
          message: result.reason || `Failed to cast ${ability.name}`
        }));
        return events;
      }

      // Apply effects
      // Deduct mana
      state.player.soulResonanceLevel = Math.max(
        0,
        (state.player.soulResonanceLevel || 0) - result.manaCost
      );

      // Apply paradox debt if applicable
      if (result.paradoxIncurred > 0) {
        state.player.temporalDebt = Math.min(
          100,
          (state.player.temporalDebt || 0) + result.paradoxIncurred
        );
      }

      // Apply damage/healing
      if (result.damage && result.damage > 0) {
        // For now, log the damage. In full combat context, this would apply to a target
        events.push(createEvent(state, action, 'ABILITY_DAMAGE', {
          abilityId,
          abilityName: ability.name,
          damage: Math.round(result.damage),
          targetType: ability.effect.targetType,
          message: `${ability.name} dealt ${Math.round(result.damage)} damage!`
        }));
      }

      if (result.healing && result.healing > 0) {
        state.player.hp = Math.min(
          state.player.maxHp || 100,
          (state.player.hp || 100) + result.healing
        );
        events.push(createEvent(state, action, 'ABILITY_HEALING', {
          abilityId,
          abilityName: ability.name,
          healing: Math.round(result.healing),
          newHp: Math.round(state.player.hp),
          message: `${ability.name} healed for ${Math.round(result.healing)} HP!`
        }));
      }

      // Apply cooldown
      state.player.abilityCooldowns = {
        ...(state.player.abilityCooldowns || {}),
        [abilityId]: result.cooldownApplied
      };

      // Main ability cast event
      events.push(createEvent(state, action, 'ABILITY_CAST_SUCCESS', {
        abilityId,
        abilityName: ability.name,
        manaCost: result.manaCost,
        cooldownTicks: result.cooldownApplied,
        paradoxIncurred: result.paradoxIncurred,
        effectLog: result.effectLog,
        message: `✨ ${ability.name} cast successfully! ${result.effectLog.join(' ')}`
      }));

      break;
    }

    case 'SET_TARGET': {
      // Phase 7: Set current combat target for hostile/friendly actions
      const { targetNpcId, targetingMode = 'hostile' } = action.payload;
      
      if (targetNpcId) {
        const targetNpc = state.npcs.find((npc: NPC) => npc.id === targetNpcId);
        if (!targetNpc) {
          events.push(createEvent(state, action, 'TARGET_NOT_FOUND', {
            targetId: targetNpcId,
            message: 'Target NPC not found.'
          }));
          return events;
        }
        
        // Update player's active target
        if (state.player) {
          state.player.activeTargetId = targetNpcId;
          state.player.targetingMode = targetingMode;
        }
        
        events.push(createEvent(state, action, 'TARGET_ACQUIRED', {
          targetId: targetNpcId,
          targetName: targetNpc.name,
          targetHp: targetNpc.hp || targetNpc.maxHp || 100,
          targetMaxHp: targetNpc.maxHp || 100,
          targetingMode,
          message: `Selected ${targetNpc.name} as target.`
        }));
      } else {
        // Clear target
        if (state.player) {
          state.player.activeTargetId = undefined;
          state.player.targetingMode = 'none';
        }
        
        events.push(createEvent(state, action, 'TARGET_CLEARED', {
          message: 'Target cleared.'
        }));
      }
      break;
    }

    case 'START_ENCOUNTER': {
      // Phase 8: Initiate combat encounter with targeted NPC
      const { targetNpcId } = action.payload;
      
      if (!targetNpcId || !state.player.activeTargetId) {
        events.push(createEvent(state, action, 'ENCOUNTER_FAILED', {
          reason: 'No valid target selected',
          message: 'You must target an NPC to start combat.'
        }));
        return events;
      }
      
      const targetNpc = state.npcs.find((npc: NPC) => npc.id === targetNpcId);
      if (!targetNpc) {
        events.push(createEvent(state, action, 'ENCOUNTER_FAILED', {
          reason: 'Target not found',
          message: 'Target NPC has left the area.'
        }));
        return events;
      }
      
      // Transition to combat state
      state.player.inCombat = true;
      state.player.combatStartedAt = state.tick || 0;
      state.player.combatRound = 1;
      state.player.combatLog = [];
      
      // Log initial encounter
      state.player.combatLog!.push({
        tick: state.tick || 0,
        actor: state.player.name,
        action: 'ENCOUNTER_START',
        target: targetNpc.name,
        result: `Combat with ${targetNpc.name} initiated!`
      });
      
      events.push(createEvent(state, action, 'ENCOUNTER_STARTED', {
        playerId: state.player.id,
        targetId: targetNpcId,
        targetName: targetNpc.name,
        targetHp: targetNpc.hp || targetNpc.maxHp || 100,
        combatRound: 1,
        message: `⚔️ COMBAT INITIATED: You face ${targetNpc.name}!`
      }));
      break;
    }

    case 'END_ENCOUNTER': {
      // Phase 8: Exit combat encounter (victory or retreat)
      const { reason = 'victory', defeatedNpcId } = action.payload;
      
      if (!state.player.inCombat) {
        events.push(createEvent(state, action, 'ENCOUNTER_NOT_ACTIVE', {
          message: 'No active encounter to end.'
        }));
        return events;
      }
      
      state.player.inCombat = false;
      
      let resultMessage = '';
      switch (reason) {
        case 'victory':
          resultMessage = `✓ VICTORY! Defeated ${state.npcs.find((n: NPC) => n.id === state.player.activeTargetId)?.name || 'enemy'}!`;
          break;
        case 'retreat':
          resultMessage = '⏻ You retreated from combat.';
          break;
        case 'fled':
          resultMessage = '⚡ You fled from combat!';
          break;
        default:
          resultMessage = 'Combat ended.';
      }
      
      // Log end of encounter
      state.player.combatLog?.push({
        tick: state.tick || 0,
        actor: state.player.name,
        action: 'ENCOUNTER_END',
        result: reason.toUpperCase()
      });
      
      // Clear target on encounter end
      state.player.activeTargetId = undefined;
      state.player.targetingMode = 'none';
      state.player.combatRound = undefined;
      
      events.push(createEvent(state, action, 'ENCOUNTER_ENDED', {
        reason,
        duration: (state.tick || 0) - (state.player.combatStartedAt || 0),
        message: resultMessage
      }));
      break;
    }

    case 'AUTO_LOOT': {
      // Phase 7: Automatically loot items from defeated NPC
      const { defeatedNpcId } = action.payload;
      
      if (!defeatedNpcId) return [];
      
      const defeatedNpc = state.npcs.find((npc: NPC) => npc.id === defeatedNpcId);
      if (!defeatedNpc || !defeatedNpc.inventory) {
        return [];
      }
      
      const lootedItems: any[] = [];
      const goldBonus = Math.floor(10 + (defeatedNpc.stats?.luk ?? 10) * 2); // Gold varies by NPC luck stat
      
      // Add all NPC inventory items to player
      if (defeatedNpc.inventory && defeatedNpc.inventory.length > 0) {
        defeatedNpc.inventory.forEach((item: InventoryItem) => {
          if (!state.player.inventory) {
            state.player.inventory = [];
          }
          state.player.inventory.push(item);
          lootedItems.push(item);
        });
        // Clear NPC inventory
        defeatedNpc.inventory = [];
      }
      
      // Add gold reward
      if (!state.player.gold) state.player.gold = 0;
      state.player.gold += goldBonus;
      
      events.push(createEvent(state, action, 'AUTO_LOOT', {
        npcId: defeatedNpcId,
        npcName: defeatedNpc.name,
        itemsLooted: lootedItems.length,
        goldRewarded: goldBonus,
        totalGold: state.player.gold,
        message: `Looted ${lootedItems.length} items and ${goldBonus} gold from ${defeatedNpc.name}!`
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
      const { itemId, instanceId, targetId } = action.payload;
      if (!itemId && !instanceId) return [];

      const inventory = state.player.inventory || [];
      const item = instanceId 
        ? inventory.find((i: any) => i.instanceId === instanceId)
        : inventory.find(i => i.itemId === itemId);

      if (!item) {
        events.push(createEvent(state, action, 'ITEM_USE_FAILED', {
          itemId,
          reason: 'not-in-inventory'
        }));
        return events;
      }

      const template = (state as any).itemTemplates?.find((t: any) => t.id === item.itemId);
      
      // Generic item use event
      events.push(createEvent(state, action, 'ITEM_USED', {
        itemId: item.itemId,
        instanceId: (item as any).instanceId,
        template: template
      }));

      // 1. Apply healing/stat effects if template has them
      if (template?.effect) {
        const effect = template.effect;
        if (effect.type === 'heal_hp') {
          events.push(createEvent(state, action, 'PLAYER_HEALED', {
            amount: effect.amount || 10,
            source: 'item',
            sourceId: item.itemId,
            message: `You consumed ${template.name} and recovered ${effect.amount} HP.`
          }));
        } else if (effect.type === 'stat_buff') {
          events.push(createEvent(state, action, 'PLAYER_BUFFED', {
            stat: effect.stat,
            amount: effect.amount,
            duration: effect.duration,
            source: item.itemId,
            message: `You feel a surge of ${effect.stat} from the ${template.name}!`
          }));
        }
      }

      // 2. Special Case: Aegis Restoration Kit
      if (item.itemId === 'aegis-restoration-kit') {
        const targetRelicId = targetId || (state as any).player.boundRelicId;
        if (targetRelicId) {
          events.push(createEvent(state, action, 'ARTIFACT_RESTORED', {
            relicId: targetRelicId,
            kitId: item.itemId,
            stabilityBonus: 25,
            message: `Using the ${template.name}, you carefully maintain the ancient lattice of the Solar Aegis artifact.`
          }));
        } else {
          events.push(createEvent(state, action, 'ITEM_USE_FAILED', {
            itemId: item.itemId,
            reason: 'no-relic-target',
            message: `You have no artifact to restore with this kit.`
          }));
          return events;
        }
      }

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

    case 'TRADE_ITEMS': {
      // Phase 6: NPC-to-NPC or Player-to-NPC item exchange during NEGOTIATE intent
      const { initiatorId, targetId, offeredItems, requestedItems } = action.payload;
      
      if (!initiatorId || !targetId) {
        events.push(createEvent(state, action, 'TRADE_FAILED', {
          reason: 'missing-participants',
          message: 'Trade requires both initiator and target NPCs.'
        }));
        return events;
      }

      // Find both NPCs
      const initiator = state.npcs.find(n => n.id === initiatorId);
      const target = state.npcs.find(n => n.id === targetId);

      if (!initiator || !target) {
        events.push(createEvent(state, action, 'TRADE_FAILED', {
          reason: 'npc-not-found',
          initiatorId,
          targetId,
          message: 'One or both NPCs not found in world.'
        }));
        return events;
      }

      // Validate both NPCs are at same location
      if (initiator.locationId !== target.locationId) {
        events.push(createEvent(state, action, 'TRADE_FAILED', {
          reason: 'npc-not-colocated',
          initiatorLocation: initiator.locationId,
          targetLocation: target.locationId,
          message: 'NPCs must be at the same location to trade.'
        }));
        return events;
      }

      // Validate initiator has offered items
      const initiatorInventory = initiator.inventory || [];
      const offeredItemsArray = offeredItems || [];
      const targetInventory = target.inventory || [];
      const requestedItemsArray = requestedItems || [];

      let initiatorCanTrade = true;
      let targetCanTrade = true;
      const validationIssues: string[] = [];

      // Check initiator has all offered items
      for (const offer of offeredItemsArray) {
        const item = initiatorInventory.find((i: any) => i.itemId === offer.itemId);
        const available = (item as any)?.quantity || 0;
        if (available < offer.quantity) {
          initiatorCanTrade = false;
          validationIssues.push(`${initiator.name} lacks ${offer.quantity}x ${offer.itemId} (has ${available})`);
        }
      }

      // Check target has all requested items
      for (const request of requestedItemsArray) {
        const item = targetInventory.find((i: any) => i.itemId === request.itemId);
        const available = (item as any)?.quantity || 0;
        if (available < request.quantity) {
          targetCanTrade = false;
          validationIssues.push(`${target.name} lacks ${request.quantity}x ${request.itemId} (has ${available})`);
        }
      }

      if (!initiatorCanTrade || !targetCanTrade) {
        events.push(createEvent(state, action, 'TRADE_FAILED', {
          reason: 'insufficient-items',
          validationIssues,
          message: `Trade cannot proceed: ${validationIssues.join('; ')}`
        }));
        return events;
      }

      // Execute trade: Remove from initiator, add to target
      for (const offer of offeredItemsArray) {
        const idx = initiatorInventory.findIndex((i: any) => i.itemId === offer.itemId);
        if (idx >= 0) {
          (initiatorInventory[idx] as any).quantity -= offer.quantity;
          if ((initiatorInventory[idx] as any).quantity <= 0) {
            initiatorInventory.splice(idx, 1);
          }
        }
      }

      // Add offered items to target
      for (const offer of offeredItemsArray) {
        const existingItem = targetInventory.find((i: any) => i.itemId === offer.itemId);
        if (existingItem) {
          (existingItem as any).quantity += offer.quantity;
        } else {
          targetInventory.push({
            itemId: offer.itemId,
            quantity: offer.quantity,
            kind: 'stackable'
          } as any);
        }
      }

      // Execute reverse: Remove from target, add to initiator
      for (const request of requestedItemsArray) {
        const idx = targetInventory.findIndex((i: any) => i.itemId === request.itemId);
        if (idx >= 0) {
          (targetInventory[idx] as any).quantity -= request.quantity;
          if ((targetInventory[idx] as any).quantity <= 0) {
            targetInventory.splice(idx, 1);
          }
        }
      }

      // Add requested items to initiator
      for (const request of requestedItemsArray) {
        const existingItem = initiatorInventory.find((i: any) => i.itemId === request.itemId);
        if (existingItem) {
          (existingItem as any).quantity += request.quantity;
        } else {
          initiatorInventory.push({
            itemId: request.itemId,
            quantity: request.quantity,
            kind: 'stackable'
          } as any);
        }
      }

      // Record successful trade event
      events.push(createEvent(state, action, 'TRADE_ITEMS_COMPLETED', {
        initiatorId,
        targetId,
        initiatorName: initiator.name,
        targetName: target.name,
        offeredItems: offeredItemsArray,
        receivedItems: requestedItemsArray,
        location: initiator.locationId,
        tradeType: 'regional_resources',
        message: `${initiator.name} traded ${offeredItemsArray.map((o: any) => `${o.quantity}x ${o.itemId}`).join(', ')} with ${target.name} for ${requestedItemsArray.map((r: any) => `${r.quantity}x ${r.itemId}`).join(', ')}`
      }));

      break;
    }

    case 'GATHER_RESOURCE': {
      const playerLocation = state.player.location;
      
      // Find resource nodes at this location with remaining resources
      const availableNodes = (state.resourceNodes || []).filter(node => 
        node.locationId === playerLocation && (node.remainingResources || 0) > 0
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
      
      // Build loot based on node type and resourcefulness
      const gathered: InventoryItem[] = [];
      const baseItemId = node.type === 'ore' ? 'ore' : node.type === 'herb' ? 'herb' : 'raw-material';
      const quantity = Math.max(1, Math.floor((node.remainingResources || 1) * 0.1)); // Gather ~10% of remaining
      
      gathered.push({
        itemId: baseItemId,
        quantity: quantity,
        kind: 'stackable'
      });

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

    case 'HARVEST_RESOURCE': {
      // M55-C1: NPC harvest action - adds biome-specific resources to NPC inventory
      const { npcId } = action.payload;
      if (!npcId) return [];

      const npc = state.npcs.find(n => n.id === npcId);
      if (!npc) {
        events.push(createEvent(state, action, 'HARVEST_FAILED', {
          reason: 'npc-not-found',
          npcId
        }));
        return events;
      }

      // Determine biome from location
      const location = state.locations.find(l => l.id === npc.locationId);
      const biome = location?.biome || 'Plains';
      
      // M55-C1: Define harvest yields by biome
      const biomeHarvests: Record<string, { name: string; quantity: number; rarity: string }[]> = {
        'Corrupted': [{ name: 'Cursed Locus', quantity: 1, rarity: 'rare' }],
        'Caves': [{ name: 'Blessed Crystal', quantity: 2, rarity: 'uncommon' }],
        'Forest': [{ name: 'Moonleaf', quantity: 3, rarity: 'common' }],
        'Plains': [{ name: 'Golden Wheat', quantity: 2, rarity: 'common' }],
        'Mountains': [{ name: 'Iron Ore', quantity: 1, rarity: 'uncommon' }],
        'Swamp': [{ name: 'Marsh Herb', quantity: 2, rarity: 'common' }],
        'Coast': [{ name: 'Sea Salt', quantity: 3, rarity: 'common' }]
      };

      const harvests = biomeHarvests[biome] || biomeHarvests['Plains'];
      
      // M55-C1: Add harvested items to NPC inventory (random selection)
      if (!npc.inventory) {
        npc.inventory = [];
      }

      harvests.forEach((harvest) => {
        const newItem: StackableItem = {
          kind: 'stackable',
          itemId: `harvest_${harvest.name.replaceAll(' ', '_')}`,
          quantity: harvest.quantity
        };

        // Try to stack with existing stackable item or add new
        const existing = npc.inventory?.find((item: any) => 
          item.kind === 'stackable' && item.itemId === newItem.itemId
        ) as StackableItem | undefined;
        
        if (existing) {
          existing.quantity += harvest.quantity;
        } else {
          npc.inventory?.push(newItem);
        }

        events.push(createEvent(state, action, 'NPC_HARVESTED', {
          npcId,
          npcName: npc.name,
          biome,
          itemName: harvest.name,
          quantity: harvest.quantity,
          rarity: harvest.rarity
        }));
      });

      break;
    }

    case 'CRAFT_ITEM': {
      const { recipeId } = action.payload;
      if (!recipeId) return [];

      const recipe = (state as any).craftingRecipes?.find((r: any) => r.id === recipeId);
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
      const craftingCheck = rollCraftingCheck(playerInt, recipe.difficulty || 10);

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
        recipe.ingredients.forEach((mat: any) => {
          events.push(createEvent(state, action, 'ITEM_USED', {
            itemId: mat.itemId,
            quantity: mat.quantity,
            reason: 'crafting-failure'
          }));
        });
        return events;
      }

      // Success - consume materials and create result
      recipe.ingredients.forEach((mat: any) => {
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
      let qualityMultiplier = 1;
      
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
      const seasonalMods = calculateSeasonalModifiers(state.season || 'spring');
      const seasonalQualityBonus = (seasonalMods.itemQualityMult - 1) * 0.5; // 50% of seasonal effect applies to items
      qualityMultiplier = qualityMultiplier * (1 + seasonalQualityBonus);

      if (seasonalMods.itemQualityMult > 1.1) {
        // Autumn boost
        events.push(createEvent(state, action, 'SEASONAL_CRAFTING_BONUS', {
          season: state.season || 'spring',
          bonusMultiplier: 1 + seasonalQualityBonus,
          message: `The autumn harvest strengthens your craftsmanship!`
        }));
      }

      // Build crafted item with quality modifier
      const craftedResult = {
        itemId: recipe.resultItemId,
        quantity: recipe.resultQuantity,
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
        itemId: recipe.resultItemId,
        quantity: recipe.resultQuantity,
        source: 'craft',
        recipeId,
        quality: qualityTier,
        bonusMultiplier: qualityMultiplier
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
            visualElement = 'arcane';
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
      if (state.player.knowledgeBase instanceof Map) {
        (state.player.knowledgeBase as Map<string, any>).set(`${entityType}:${entityId}`, true);
      } else {
        (state.player.knowledgeBase as string[]).push(`${entityType}:${entityId}`);
      }

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
      state.player.knowledgeBase = addKnowledge(state.player.knowledgeBase, `npc:${targetId}`, true);

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
      const alreadyKnown = hasKnowledge(state.player.knowledgeBase, knowledgeKey);
      state.player.knowledgeBase = addKnowledge(state.player.knowledgeBase, knowledgeKey, true);

const knowledgeTypeLabel = knowledgeType === 'recipe' ? 'Recipe' : 'Lore';
      const learnMessage = `You learned: ${knowledgeTypeLabel} - ${knowledgeId}!`;

      events.push(createEvent(state, action, 'KNOWLEDGE_GAINED', {
        scrollItemId,
        knowledgeType,
        knowledgeId,
        knowledgeKey,
        alreadyKnown,
        message: alreadyKnown
          ? `You already knew about ${knowledgeId}.`
          : learnMessage
      }));

      events.push(createEvent(state, action, 'ITEM_USED', {
        itemId: scrollItemId,
        quantity: 1,
        reason: 'study-scroll'
      }));
      break;
    }

    case 'TRUE_SIGHT': {
      /**
       * Phase 10: True Sight Spell (Discovery Revelation)
       * - Reveals all NPCs and items in the target area for a limited time (100 ticks)
       * - Does NOT add them to knowledgeBase permanently
       * - Only reveals positions, not full stats
       * - Creates temporary "revelation" entries in beliefLayer
       */
      const { locationId, duration = 100 } = action.payload || {};

      if (!locationId) {
        events.push(createEvent(state, action, 'TRUE_SIGHT_FAILED', {
          reason: 'No target location specified',
          message: 'True Sight requires a location target.'
        }));
        break;
      }

      // Find the location
      const targetLocation = state.locations.find(loc => loc.id === locationId);
      if (!targetLocation) {
        events.push(createEvent(state, action, 'TRUE_SIGHT_FAILED', {
          reason: 'Location not found',
          locationId,
          message: 'That location does not exist.'
        }));
        break;
      }

      // Get all NPCs and items at this location
      const revealedNpcs = state.npcs
        .filter(npc => npc.locationId === locationId)
        .map(npc => ({
          id: npc.id,
          name: npc.name,
          hp: npc.hp,
          maxHp: npc.maxHp,
          visible: true
        }));

      const revealedItems = (state.activeEvents || [])
        .filter(evt => (evt as any).locationId === locationId && (evt as any).type === 'item')
        .map(evt => ({
          id: (evt as any).itemId,
          name: (evt as any).itemName,
          rarity: (evt as any).rarity
        }));

      // Add to beliefLayer as temporary revelation
      if (!state.player.beliefLayer) {
        state.player.beliefLayer = {
          npcLocations: {},
          npcStats: {},
          facts: {},
          suspicionLevel: 0
        };
      }

      // Store revelation info
      const beliefLayer = state.player.beliefLayer;
      revealedNpcs.forEach(npc => {
        beliefLayer.npcLocations[npc.id] = locationId;
        beliefLayer.npcStats[npc.id] = { hp: npc.hp, maxHp: npc.maxHp, visible: true, revealedAt: state.tick || 0 };
      });

      events.push(createEvent(state, action, 'TRUE_SIGHT_CAST', {
        locationId,
        locationName: targetLocation.name,
        revealedNpcs: revealedNpcs.map(n => ({ id: n.id, name: n.name })),
        revealedItemCount: revealedItems.length,
        durationTicks: duration,
        message: `True Sight reveals ${revealedNpcs.length} entities in ${targetLocation.name}!`
      }));

      // Schedule revelation expiration
      events.push(createEvent(state, action, 'TRUE_SIGHT_EXPIRES', {
        locationId,
        scheduledTick: (state.tick || 0) + duration,
        revealedNpcIds: revealedNpcs.map(n => n.id)
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
      const alreadyKnown = hasKnowledge(state.player.knowledgeBase, recipeKey);
      state.player.knowledgeBase = addKnowledge(state.player.knowledgeBase, recipeKey, true);

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
        handleMorphSuccess(state, {
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
      if (!state.travelState?.isTraveling) {
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
      // M9 Phase 3 + Phase 14: Search current location for hidden areas, sub-areas, and material loot
      const currentLocation = state.player.location;
      const locationObj = state.locations.find(loc => loc.id === currentLocation);

      if (!locationObj) {
        events.push(createEvent(state, action, 'SEARCH_NO_LOCATION', {
          location: currentLocation,
          message: 'Location not found.'
        }));
        break;
      }

      // 1. Check for undiscovered sub-areas first
      const undiscoveredSubAreas = (locationObj.subAreas || []).filter(sa => !sa.discovered);
      const difficulty = locationObj.subAreas?.[0]?.difficulty || calculateSearchDifficulty(currentLocation);
      const playerInt = state.player.stats?.int || 10;
      const playerLuk = state.player.stats?.luk || 10;
      const searchResult = performSearchCheck(playerInt, playerLuk, difficulty);

      if (undiscoveredSubAreas.length > 0 && searchResult.success) {
        // Success! Discover a random sub-area
        const targetSubArea = undiscoveredSubAreas[Math.floor(random() * undiscoveredSubAreas.length)];
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

        // Phase 15: Trigger artifact mood update on exploration discovery
        events.push(createEvent(state, action, 'ARTIFACT_MOOD_TRIGGERED', {
          mood: 'exploration_discovery',
          discoveryType: 'sub_area',
          discoveryId: targetSubArea.id,
          discoveryName: targetSubArea.name,
          intensity: 1.0,
          message: 'Your equipped artifact trembles with excitement at the hidden discovery.'
        }));
        break;
      }

      // 2. Phase 14: Fallback to searching for materials/loot in the environment
      const regionalTables = (state as any).lootTables?.filter((t: any) => 
        t.locationId === currentLocation || t.biome === locationObj.biome
      ) || [];

      if (regionalTables.length > 0 && searchResult.success) {
        const selectedTable = regionalTables[Math.floor(random() * regionalTables.length)];
        let foundLoot = resolveLootTable(selectedTable.drops);

        // Phase 23: Inject seasonal loot into the found loot
        const tpl = state.metadata?.template || {};
        const seasonalRules = tpl.seasonalRules;
        const currentSeason = state.season as any;
        const seasonalLoot = getSeasonalLoot(currentSeason, seasonalRules);
        foundLoot = injectSeasonalLoot(foundLoot, seasonalLoot);

        if (foundLoot.length > 0) {
          foundLoot.forEach(item => {
            events.push(createEvent(state, action, 'ITEM_PICKED_UP', {
              itemId: item.itemId,
              quantity: (item as any).quantity || 1,
              source: 'search_area',
              location: currentLocation,
              isSeasonal: seasonalLoot.some(sl => sl.itemId === item.itemId),
              message: `You found: ${item.itemId} (x${(item as any).quantity || 1}) while searching the area.${seasonalLoot.some(sl => sl.itemId === item.itemId) ? ' [Seasonal]' : ''}`
            }));
          });

          // Phase 15: Trigger artifact mood update on loot discovery
          events.push(createEvent(state, action, 'ARTIFACT_MOOD_TRIGGERED', {
            mood: 'exploration_discovery',
            discoveryType: 'loot',
            discoveryCount: foundLoot.length,
            firstLootId: foundLoot[0].itemId,
            intensity: 0.7,
            message: 'Your equipped artifact stirs as treasure is uncovered.'
          }));
          break;
        }
      }

      // 3. Fallback to generic message if nothing discovered or found
      if (searchResult.success) {
        events.push(createEvent(state, action, 'SEARCH_NO_SECRETS', {
          location: currentLocation,
          message: 'You search thoroughly but find nothing of immediate interest.'
        }));
      } else {
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
              const distance = Math.hypot(dx, dy);
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
            state.player.knowledgeBase = addKnowledge(state.player.knowledgeBase, knowledgeKey, true);
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

    case 'PERFORM_GRAND_RITUAL': {
      // M53-C1: Grand Ritual Engine - Player-driven epoch transition via séance at World Scars
      const playerLocation = state.player.location;
      const currentResonance = (state.player as any).soulResonanceLevel || 0;
      const currentSoulStrain = (state.player as any).soulStrain || 0;

      // Pre-flight check 1: Must be at a location with an active WorldScar
      const worldScars = (state as any).worldScars || [];
      const scarAtLocation = worldScars.find((s: any) => s.locationId === playerLocation);
      
      if (!scarAtLocation) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: 'NO_SCAR_AT_LOCATION',
          message: 'You cannot perform a Grand Ritual here. No World Scar is present at this location.'
        }));
        break;
      }

      // Pre-flight check 2: Must have enough Resonance (50 minimum)
      if (currentResonance < 50) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: 'INSUFFICIENT_RESONANCE',
          currentResonance,
          required: 50,
          message: `You do not have enough Resonance. Required: 50, Current: ${currentResonance}`
        }));
        break;
      }

      // Pre-flight check 3: Soul Strain must be below Sunder Threshold (80)
      if (currentSoulStrain >= 80) {
        events.push(createEvent(state, action, 'RITUAL_FAILED', {
          reason: 'SOUL_STRAIN_TOO_HIGH',
          currentSoulStrain,
          threshold: 80,
          message: `Your soul is too corrupted to attempt a Grand Ritual. Soul Strain: ${currentSoulStrain}/80`
        }));
        break;
      }

      // Calculate ritual success probability
      let successChance = 30; // Base 30%
      const resonanceBonus = Math.min(currentResonance - 50, 50); // +1% per point above 50, max +50%
      successChance += resonanceBonus;

      // Scar synergy: +10% (in future, map scarType to faction for dynamic bonus)
      successChance += 10;

      // Soul Strain penalty: -5% per 10 points of existing strain
      const strainPenalty = Math.floor((currentSoulStrain / 10) * 5);
      successChance -= strainPenalty;

      // Cap success chance between 5% and 95%
      successChance = Math.max(5, Math.min(95, successChance));

      // Roll success
      const ritualRoll = random() * 100;
      const ritualSucceeded = ritualRoll < successChance;

      if (ritualSucceeded) {
        // ===== SUCCESS: Trigger epoch transition =====
        (state.player as any).soulResonanceLevel = Math.max(0, currentResonance - 50);
        (state.player as any).soulStrain = Math.min(100, currentSoulStrain + 10);

        events.push(createEvent(state, action, 'GRAND_RITUAL_SUCCESS', {
          locationId: playerLocation,
          scarType: scarAtLocation.type,
          scarSeverity: scarAtLocation.severity,
          resonanceConsumed: 50,
          soulStrainGained: 10,
          successChance,
          roll: Math.round(ritualRoll),
          message: `✦ The Grand Ritual succeeds! Reality trembles as you pierce the veil between epochs.`
        }));

        // Attempt epoch transition
        try {
          const currentEpoch = EPOCH_DEFINITIONS[state.epochId || 'epoch_i_fracture'];
          
          // Create minimal legacy for this transition
          const currentLegacy = {
            id: `legacy_ritual_${state.tick}`,
            chronicleId: state.chronicleId || `chronicle_${state.id}`,
            canonicalName: 'The Wanderer', // No player name stored in PlayerState
            bloodlineOrigin: 'ritual_summoned',
            mythStatus: Math.min(100, currentSoulStrain + 50), // Use soul strain as proxy for power
            deeds: [],
            factionInfluence: state.player.factionReputation || {},
            inheritedPerks: [],
            ancestralCurses: currentSoulStrain >= 60 ? ['soul_corrupted'] : [],
            epochsLived: 1,
            totalGenerations: 1,
            soulEchoCount: 0,
            finalWorldState: 'neutral' as const,
            paradoxDebt: 0,
            timestamp: Date.now()
          };

          // Trigger epoch transition
          const nextState = initiateChronicleTransition(state, currentLegacy);
          Object.assign(state, nextState);

          events.push(createEvent(state, action, 'EPOCH_TRANSITIONED', {
            fromEpochId: currentEpoch.id,
            toEpochId: (getNextEpoch(currentEpoch.id))?.id,
            ritualInitiated: true,
            message: `The world transforms. A new epoch begins.`
          }));
        } catch (error) {
          console.error('[M53-C1] Failed to initiate chronicle transition:', error);
          events.push(createEvent(state, action, 'TRANSITION_ERROR', {
            reason: 'epoch_transition_failed',
            error: String(error),
            message: 'The ritual began but something went wrong. Reality stabilizes without change.'
          }));
        }
      } else {
        // ===== FAILURE: Ritual backlash =====
        (state.player as any).soulResonanceLevel = Math.max(0, currentResonance - 25);
        (state.player as any).soulStrain = Math.min(100, currentSoulStrain + 30); // Harsh penalty

        events.push(createEvent(state, action, 'GRAND_RITUAL_FAILURE', {
          locationId: playerLocation,
          scarType: scarAtLocation.type,
          resonanceConsumed: 25,
          soulStrainGained: 30,
          successChance,
          roll: Math.round(ritualRoll),
          message: `✗ The Grand Ritual fails catastrophically! Your soul is torn by the backlash.`
        }));

        // Generate Ritual Backlash macro-event at location
        if (state.macroEvents) {
          state.macroEvents.push({
            id: `ritual_backlash_${state.tick}`,
            type: 'RITUAL_BACKLASH',
            locationId: playerLocation,
            message: `A failed Grand Ritual unleashed chaotic forces, scarring reality further.`,
            tick: state.tick || 0,
            severity: currentSoulStrain + 30
          });
        }
      }
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

    case 'RESOLVE_CHRONICLE_EPOCH': {
      // Phase 12 Task 4: Chronicle Resolution - End of session/epoch trigger
      const getLegacyEngine = (): any => {
        try {
          const { getLegacyEngine: importedGetLegacyEngine } = require('./legacyEngine');
          return importedGetLegacyEngine(state.seed);
        } catch (e) {
          return null;
        }
      };

      try {
        const legacyEngine = getLegacyEngine();
        if (!legacyEngine) {
          events.push(createEvent(state, action, 'RESOLVE_CHRONICLE_FAILED', {
            reason: 'legacy_engine_unavailable',
            message: 'Could not access legacy system.'
          }));
          break;
        }

        // Step 1: Transmit soul echoes (Grand Deeds + Relics of Virtue)
        const playerName = (state.player as any).name || 'The Wanderer';
        const legacy = legacyEngine.transmitSoulEchoes(state, playerName);

        // Step 2: Generate Universal Historical Summary
        const historicalSummary = {
          id: `summary_${state.chronicleId}_${state.tick}`,
          name: `Chronicle of ${playerName} - Epoch ${state.epochId}`,
          totalEpochsSpanned: ((state.metadata as any).epochsSpanned || 1),
          totalGenerations: ((state.metadata as any).totalGenerations || 1),
          cumulativeMythStatus: legacy.mythStatus,
          greatestAncestor: {
            name: playerName,
            mythStatus: legacy.mythStatus,
            dominantDeeds: legacy.deeds.slice(0, 3),
            epochsLived: legacy.epochsLived
          },
          factionLegacies: Object.entries(legacy.factionInfluence).reduce((acc: any, [fId, rep]: any) => {
            const faction = state.factions?.find(f => f.id === fId);
            acc[fId] = {
              reputation: rep,
              finalPower: faction?.powerScore || 50,
              primaryInteraction: rep > 50 ? 'allied' : rep < -50 ? 'hostile' : 'neutral'
            };
            return acc;
          }, {}),
          paradoxCost: legacy.paradoxDebt,
          blightedBiomes: state.locations
            .filter(l => !l.spiritDensity || l.spiritDensity < 20)
            .map(l => l.id),
          restoredLocations: state.locations
            .filter(l => l.spiritDensity && l.spiritDensity > 80)
            .map(l => l.id),
          finalEventLog: [],
          timestamp: Date.now(),
          trueNewGameSeed: state.seed + (state.tick || 0)
        };

        // Step 3: Emit Soul Mirror Séance event (bridges to next character's bloodline)
        events.push(createEvent(state, action, 'SOUL_MIRROR_SEANCE', {
          legacyId: legacy.id,
          historicalSummary,
          inheritanceReady: true,
          bridgingMessage: `The echoes of ${playerName} call out across the centuries. A new bloodline awakens...`,
          nextCharacterBonus: {
            startingMerit: Math.floor(legacy.mythStatus * 0.1),
            inheritedFactionReputation: legacy.factionInfluence,
            unlockableRecipes: `learned_from_${legacy.id}`,
            soulEchoAvailable: true
          }
        }));

        events.push(createEvent(state, action, 'CHRONICLE_RESOLVED', {
          epochId: state.epochId,
          legacyId: legacy.id,
          deeds: legacy.deeds.length,
          relics: legacy.inheritedItems?.length || 0,
          message: `Chronicle resolved. Legacy: ${legacy.id}`
        }));

      } catch (error) {
        console.error('[Phase 12] Failed to resolve chronicle:', error);
        events.push(createEvent(state, action, 'RESOLVE_CHRONICLE_FAILED', {
          reason: 'resolution_error',
          error: String(error),
          message: 'An error occurred while resolving the chronicle.'
        }));
      }
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
        const completedQuests = ((state.player as any).questsCompleted?.length) ?? 0;
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
          bloodlineOrigin: (state as any).bloodlineOrigin || 'unknown',
          mythStatus: mythStatus,
          deeds: selectedDeeds.length > 0 ? selectedDeeds : ['core_existence'],
          factionInfluence: state.player.factionReputation || {},
          inheritedPerks: (state.player as any).abilities || [],
          epochsLived: (state as any).epochCount ?? 1,
          totalGenerations: (state.metadata as any)?.totalGenerations ?? 1,
          soulEchoCount: (state.player as any).soulEchoCount ?? 0,
          finalWorldState: (state as any).spiritDensity && (state as any).spiritDensity > 50 ? 'improved' : 'neutral',
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
            spiritDensity: (state as any).spiritDensity ?? 50,
            generationalParadox: (state as any).generationalParadox ?? 0,
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
          soulEchoesTransmitted: soulEchoes.soulEchoCount,
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
        if (soulEchoes.soulEchoCount > 0) {
          events.push(createEvent(state, action, 'SOUL_ECHOES_TRANSMITTED', {
            count: soulEchoes.soulEchoCount,
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

    case 'PLAY_CARD': {
      // Phase 38/39: Play a narrative card from hand
      // Phase 40: Apply codec mechanical modifiers (cost multiplier, power bonus)
      // Integrates with turn-based heartbeat (Phase 37), ability system, and AP economy (Phase 39)
      
      const { abilityId } = action.payload || {};
      if (!abilityId) {
        events.push(createEvent(state, action, 'CARD_PLAY_FAILED', {
          reason: 'No ability specified',
          message: 'Cannot play card without an ability ID.'
        }));
        break;
      }

      // Phase 39: Check if ability is valid and can be used
      const ability = ABILITY_DATABASE[abilityId];
      if (!ability) {
        events.push(createEvent(state, action, 'CARD_PLAY_FAILED', {
          reason: 'Unknown ability',
          abilityId,
          message: `Ability "${abilityId}" not found in registry.`
        }));
        break;
      }

      // Phase 40: Get codec mechanical modifiers
      // Default multipliers for each codec (matched with themeManager definitions)
      const CODEC_MULTIPLIERS: Record<string, { costMultiplier: number; powerBonus: number }> = {
        'CODENAME_MEDIEVAL': { costMultiplier: 1.0, powerBonus: 1.0 },
        'CODENAME_GLITCH': { costMultiplier: 1.25, powerBonus: 1.2 },
        'CODENAME_MINIMAL': { costMultiplier: 0.9, powerBonus: 0.95 },
        'CODENAME_CYBERPUNK': { costMultiplier: 1.1, powerBonus: 1.15 },
        'CODENAME_SOLARPUNK': { costMultiplier: 0.95, powerBonus: 1.05 },
        'CODENAME_VOIDSYNC': { costMultiplier: 1.0, powerBonus: 1.1 },
        'CODENAME_NOIR': { costMultiplier: 0.95, powerBonus: 1.0 },
        'CODENAME_OVERLAND': { costMultiplier: 1.05, powerBonus: 1.05 },
        'CODENAME_VINTAGE': { costMultiplier: 0.95, powerBonus: 1.0 },
        'CODENAME_STORYBOOK': { costMultiplier: 1.0, powerBonus: 1.2 },
        'CODENAME_DREAMSCAPE': { costMultiplier: 1.15, powerBonus: 1.25 }
      };

      let costMultiplier = 1.0;
      let powerBonus = 1.0;
      const currentCodec = state.player.currentCodec || 'CODENAME_MEDIEVAL';
      const codecMults = CODEC_MULTIPLIERS[currentCodec];
      if (codecMults) {
        costMultiplier = codecMults.costMultiplier;
        powerBonus = codecMults.powerBonus;
      }

      // Phase 39/40: Check AP cost first (primary resource)
      // Phase 40: Apply codec cost multiplier
      const playerAp = state.player.ap ?? 3;
      const baseApCost = ability.apCost ?? 1; // Default 1 AP per card
      const finalApCost = Math.ceil(baseApCost * costMultiplier); // Round up after multiplier
      if (playerAp < finalApCost) {
        events.push(createEvent(state, action, 'INSUFFICIENT_RESOURCES', {
          resourceType: 'ap',
          required: finalApCost,
          available: playerAp,
          baseApCost,
          codecMultiplier: costMultiplier,
          currentCodec,
          message: `Not enough Action Points to play ${ability.name}. Required: ${finalApCost} AP (${baseApCost} × ${costMultiplier.toFixed(2)}), Have: ${playerAp} AP`
        }));
        break;
      }

      // Phase 38/40: Check mana cost (secondary resource, also affected by codec multiplier)
      const playerMp = state.player.mp ?? 100;
      const baseManaCost = ability.manaCost ?? 0;
      const finalManaCost = Math.ceil(baseManaCost * costMultiplier);
      if (playerMp < finalManaCost) {
        events.push(createEvent(state, action, 'CARD_PLAY_FAILED', {
          reason: 'Insufficient mana',
          required: finalManaCost,
          available: playerMp,
          baseManaCost,
          codecMultiplier: costMultiplier,
          currentCodec,
          message: `Not enough mana to play ${ability.name}. Required: ${finalManaCost}, Have: ${playerMp}`
        }));
        break;
      }

      // Phase 39: Resolve the ability using the abilityResolver
      // Phase 40: Apply powerBonus to resolve result
      try {
        const abilityResult = resolveAbility(abilityId, state.player, state);

        if (abilityResult.success) {
          // Phase 39: Deduct AP first
          state.player.ap = Math.max(0, (state.player.ap ?? 3) - finalApCost);
          
          // Phase 38: Deduct mana (using final cost after codec multiplier)
          state.player.mp = (state.player.mp ?? 100) - finalManaCost;

          // Move card from hand to discard (Phase 39 authoritative hand tracking)
          if (state.player.hand && state.player.hand.length > 0) {
            const cardIndex = state.player.hand.indexOf(abilityId);
            if (cardIndex >= 0) {
              state.player.hand.splice(cardIndex, 1);
              state.player.discard = state.player.discard || [];
              state.player.discard.push(abilityId);
            }
          }

          // Phase 41: Calculate stance modifiers
          let stanceDamageModifier = 1.0;
          let stanceDefenseModifier = 1.0;
          const currentStance = state.player.combatStance || 'balanced';
          
          if (currentStance === 'aggressive') {
            stanceDamageModifier = 1.2;  // +20% damage
            stanceDefenseModifier = 0.9; // -10% defense
          } else if (currentStance === 'defensive') {
            stanceDamageModifier = 0.9;  // -10% damage
            stanceDefenseModifier = 1.2; // +20% defense
          }
          // 'balanced' keeps both at 1.0

          // Apply effect
          if (ability.effect.type === 'damage' && action.payload?.targetId) {
            // Apply damage to target NPC
            // Phase 40: Apply codec powerBonus to damage
            // Phase 41: Apply stance modifier to damage
            const targetNpc = state.npcs.find(n => n.id === action.payload.targetId);
            if (targetNpc) {
              const boostedDamage = Math.round(abilityResult.damage * powerBonus * stanceDamageModifier);
              targetNpc.hp = (targetNpc.hp || 100) - boostedDamage;
              events.push(createEvent(state, action, 'ABILITY_HIT', {
                abilityId,
                abilityName: ability.name,
                targetId: action.payload.targetId,
                targetName: targetNpc.name,
                damageDealt: boostedDamage,
                baseDamage: abilityResult.damage,
                codecPowerBonus: powerBonus,
                stanceDamageModifier,
                currentStance,
                currentCodec,
                message: `${ability.name} hits ${targetNpc.name} for ${boostedDamage} damage!`
              }));
            }
          } else if (ability.effect.type === 'healing') {
            // Heal the player
            // Phase 40: Apply codec powerBonus to healing
            // Phase 41: Apply stance modifier (aggressive stance reduces healing slightly)
            const maxHp = state.player.maxHp || 100;
            const boostedHealing = Math.round(abilityResult.healing * powerBonus * (currentStance === 'aggressive' ? 0.95 : 1.0));
            state.player.hp = Math.min(maxHp, (state.player.hp || 50) + boostedHealing);
            events.push(createEvent(state, action, 'ABILITY_HEAL', {
              abilityId,
              abilityName: ability.name,
              healingAmount: boostedHealing,
              baseHealing: abilityResult.healing,
              codecPowerBonus: powerBonus,
              currentStance,
              currentCodec,
              newHp: state.player.hp,
              message: `${ability.name} restores ${boostedHealing} HP!`
            }));
          }

          // Register card played event for turn tracking
          events.push(createEvent(state, action, 'CARD_PLAYED', {
            abilityId,
            abilityName: ability.name,
            cardType: ability.type,
            apCost: finalApCost,
            baseApCost,
            manaCost: finalManaCost,
            baseManaCost,
            codecMultiplier: costMultiplier,
            codecPowerBonus: powerBonus,
            currentCodec,
            cooldownApplied: ability.cooldownTicks,
            newAp: state.player.ap,
            newMana: state.player.mp,
            message: `You played ${ability.name}! (${finalApCost} AP, ${finalManaCost} MP)`
          }));

          // Phase 42: Grant proficiency XP based on ability type
          // Map ability types to proficiency categories
          let profCategory: string = '';
          let baseXpAmount = 25; // Base XP for ability usage
          let actionContext: ActionSignificanceContext = {
            actionType: 'casting',
            damageDealt: 0,
            targetMaxHp: 0
          };

          if (ability.type.includes('damage') || ability.type.includes('attack')) {
            profCategory = 'Blades'; // Default to Blades for physical attacks
            actionContext.actionType = 'combat';
            if (abilityResult.damage) {
              actionContext.damageDealt = Math.round(abilityResult.damage * powerBonus * (currentStance === 'aggressive' ? 1.2 : 0.9));
            }
            baseXpAmount = 30 + (abilityResult.damage ? Math.min(20, Math.floor(abilityResult.damage / 5)) : 0);
            // Find target to get max HP for significance check
            const targetNpc = state.npcs.find(n => n.id === action.payload?.targetId);
            if (targetNpc) {
              actionContext.targetMaxHp = targetNpc.hp || 100;
              actionContext.proficiencyLevel = state.player.proficiencies?.['Blades']?.level || 0;
            }
          } else if (ability.type.includes('magic') || ability.type.includes('spell') || ability.type.includes('arcane')) {
            profCategory = 'Arcane';
            actionContext.actionType = 'casting';
            baseXpAmount = 35 + (abilityResult.damage ? Math.min(25, Math.floor(abilityResult.damage / 4)) : 0);
            actionContext.proficiencyLevel = state.player.proficiencies?.['Arcane']?.level || 0;
          } else if (ability.type.includes('heal')) {
            profCategory = 'Arcane'; // Healing is also arcane (restoration magic)
            actionContext.actionType = 'casting';
            baseXpAmount = 20 + (abilityResult.healing ? Math.min(20, Math.floor(abilityResult.healing / 5)) : 0);
            actionContext.proficiencyLevel = state.player.proficiencies?.['Arcane']?.level || 0;
          } else if (ability.type.includes('buff') || ability.type.includes('support')) {
            profCategory = 'Performance';
            actionContext.actionType = 'casting';
            baseXpAmount = 15;
            actionContext.proficiencyLevel = state.player.proficiencies?.['Performance']?.level || 0;
          }

          if (profCategory && state.player.proficiencies) {
            // Get tempo multiplier from codec (default 1.0 if not specified)
            let tempoMultiplier = 1.0;
            // TODO: Get this from themeManager when step 6 is complete
            
            const xpGranted = grantProficiencyXP(
              profCategory as any,
              baseXpAmount,
              state.player,
              actionContext,
              state,
              tempoMultiplier
            );

            if (xpGranted) {
              const profData = state.player.proficiencies[profCategory];
              events.push(createEvent(state, action, 'PROFICIENCY_XP_GAINED', {
                proficiency: profCategory,
                xpGained: baseXpAmount,
                newLevel: profData?.level || 0,
                newXp: profData?.xp || 0,
                message: `Your ${profCategory} proficiency increased!`
              }));
            }
          }

        } else {
          events.push(createEvent(state, action, 'CARD_PLAY_FAILED', {
            reason: abilityResult.reason || 'Ability resolution failed',
            abilityId,
            abilityName: ability.name,
            message: `Failed to play ${ability.name}: ${abilityResult.reason || 'unknown error'}`
          }));
        }
      } catch (err) {
        console.error('[actionPipeline] PLAY_CARD error:', err);
        events.push(createEvent(state, action, 'CARD_PLAY_FAILED', {
          reason: 'Internal error',
          abilityId,
          message: `Error playing ${ability.name}: ${(err as any).message}`
        }));
      }
      break;
    }

    case 'SWITCH_CODEC': {
      // Phase 40: Switch the active narrative codec
      // Codecs provide mechanical modifiers (cost multiplier, power bonus) and visual style shifts
      
      const { codecName } = action.payload || {};
      if (!codecName) {
        events.push(createEvent(state, action, 'CODEC_SWITCH_FAILED', {
          reason: 'No codec specified',
          message: 'Cannot switch codec without a codec name.'
        }));
        break;
      }

      // Codec multiplier definitions (Phase 40)
      const VALID_CODECS: Record<string, { costMultiplier: number; powerBonus: number }> = {
        'CODENAME_MEDIEVAL': { costMultiplier: 1.0, powerBonus: 1.0 },
        'CODENAME_GLITCH': { costMultiplier: 1.25, powerBonus: 1.2 },
        'CODENAME_MINIMAL': { costMultiplier: 0.9, powerBonus: 0.95 },
        'CODENAME_CYBERPUNK': { costMultiplier: 1.1, powerBonus: 1.15 },
        'CODENAME_SOLARPUNK': { costMultiplier: 0.95, powerBonus: 1.05 },
        'CODENAME_VOIDSYNC': { costMultiplier: 1.0, powerBonus: 1.1 },
        'CODENAME_NOIR': { costMultiplier: 0.95, powerBonus: 1.0 },
        'CODENAME_OVERLAND': { costMultiplier: 1.05, powerBonus: 1.05 },
        'CODENAME_VINTAGE': { costMultiplier: 0.95, powerBonus: 1.0 },
        'CODENAME_STORYBOOK': { costMultiplier: 1.0, powerBonus: 1.2 },
        'CODENAME_DREAMSCAPE': { costMultiplier: 1.15, powerBonus: 1.25 }
      };

      // Validate codec exists
      const codecDef = VALID_CODECS[codecName];
      if (!codecDef) {
        events.push(createEvent(state, action, 'CODEC_SWITCH_FAILED', {
          reason: 'Unknown codec',
          codecName,
          message: `Codec "${codecName}" not found in registry. Valid codecs: ${Object.keys(VALID_CODECS).join(', ')}`
        }));
        break;
      }

      // Update player's current codec
      const oldCodec = state.player.currentCodec || 'CODENAME_MEDIEVAL';
      state.player.currentCodec = codecName;

      // Emit event for UI updates (display transition overlay)
      events.push(createEvent(state, action, 'CODEC_SHIFTED', {
        oldCodec,
        newCodec: codecName,
        costMultiplier: codecDef.costMultiplier,
        powerBonus: codecDef.powerBonus,
        message: `Codec shifted from ${oldCodec} to ${codecName}`
      }));

      // Log codec switch for narrative tracking
      events.push(createEvent(state, action, 'NARRATIVE_CODEC_CHANGED', {
        codec: codecName,
        tick: state.tick,
        location: state.player.location
      }));

      break;
    }

    case 'SET_COMBAT_STANCE': {
      // Phase 41: Set player's combat stance (aggressive, defensive, balanced)
      // Stances modify damage and defense stats
      const { stance } = action.payload || {};
      
      const validStances: Array<'aggressive' | 'defensive' | 'balanced'> = ['aggressive', 'defensive', 'balanced'];
      if (!stance || !validStances.includes(stance)) {
        events.push(createEvent(state, action, 'STANCE_CHANGE_FAILED', {
          reason: 'Invalid stance',
          stance,
          validStances,
          message: `Invalid stance "${stance}". Valid stances: ${validStances.join(', ')}`
        }));
        break;
      }

      const oldStance = state.player.combatStance || 'balanced';
      state.player.combatStance = stance;

      // Describe stance effect
      let stanceDescription = '';
      if (stance === 'aggressive') {
        stanceDescription = 'Aggressive: +20% Damage, -10% Defense';
      } else if (stance === 'defensive') {
        stanceDescription = 'Defensive: -10% Damage, +20% Defense';
      } else {
        stanceDescription = 'Balanced: Standard damage and defense';
      }

      events.push(createEvent(state, action, 'STANCE_CHANGED', {
        oldStance,
        newStance: stance,
        stanceEffect: stanceDescription,
        message: `Combat stance changed to ${stance}. ${stanceDescription}`
      }));

      break;
    }

    // Phase 45: Spatial Interaction - Tactical World Interaction (SEARCH, HARVEST, INTERACT)
    case 'SPATIAL_SEARCH':
    case 'SPATIAL_HARVEST':
    case 'SPATIAL_INTERACT': {
      const actionType = action.type.replace('SPATIAL_', '') as 'SEARCH' | 'HARVEST' | 'INTERACT';
      const locationId = action.payload?.locationId;
      const tileX = action.payload?.tileX ?? 0;
      const tileY = action.payload?.tileY ?? 0;

      // Find location by ID
      const location = state.locations.find(l => l.id === locationId);
      if (!location) {
        events.push(createEvent(state, action, 'SPATIAL_ACTION_FAILED', {
          reason: 'Location not found',
          locationId,
          action: actionType
        }));
        break;
      }

      // Resolve spatial interaction
      const result = resolveSpatialInteraction(state, actionType, location, tileX, tileY);
      
      // Create events from result
      const spatialEvents = createSpatialInteractionEvents(state, result);
      events.push(...spatialEvents);

      // Add items to inventory if successful
      if (result.success && result.loof.length > 0) {
        result.loof.forEach(loot => {
          const newItem: StackableItem = {
            kind: 'stackable',
            itemId: loot.name.toLowerCase().replace(/\s+/g, '-'),
            quantity: loot.quantity
          };
          
          // Add to inventory or increment existing
          const existing = state.player.inventory?.find(i => 
            i.kind === 'stackable' && i.itemId === newItem.itemId
          ) as StackableItem | undefined;
          
          if (existing) {
            existing.quantity = (existing.quantity || 0) + newItem.quantity;
          } else {
            state.player.inventory = state.player.inventory || [];
            state.player.inventory.push(newItem);
          }
        });
      }

      // Grant proficiency XP if available
      if (result.proficiencyUsed && result.proficiencyXpGained) {
        // Map spatial action types to significance context types
        const contextTypeMap: Record<'SEARCH' | 'HARVEST' | 'INTERACT', 'gathering' | 'social'> = {
          'SEARCH': 'gathering',
          'HARVEST': 'gathering',
          'INTERACT': 'social'
        };
        
        const context: ActionSignificanceContext = {
          actionType: contextTypeMap[actionType]
        };
        grantProficiencyXP(
          result.proficiencyUsed as any,
          result.proficiencyXpGained,
          state.player,
          context,
          state,
          1.0
        );
      }

      // Phase 46: Handle workstation interaction
      if (result.workstationData) {
        state.player.activeWorkstationId = `ws-${tileX}-${tileY}`;
        state.player.blindFusingItems = [];
        
        events.push(createEvent(state, action, 'OPEN_WORKSTATION_UI', {
          stationType: result.workstationData.stationType,
          quality: result.workstationData.quality,
          bonusToRoll: result.workstationData.bonusToRoll,
          discoveryChance: result.workstationData.discoveryChance,
          message: result.narrativeResult
        }));
      }

      // World Erosion: High-impact actions (HARVEST) can create scars
      const shouldCreateScar = actionType === 'HARVEST' && result.success && result.loof.some(l => 
        l.name.includes('Ore') || l.name.includes('Crystal')
      );

      if (shouldCreateScar && typeof locationId === 'string') {
        // Mark tile as scarred/harvested
        const epochNum = state.epochId ? parseInt(state.epochId) : 0;
        const scarResult = createWorldScar(state, 'RESOURCE_EXTRACTION', locationId, epochNum);
        if (scarResult.events) {
          events.push(...scarResult.events);
        }

        // Add scar to location's active scars
        if (!location.activeScars) {
          location.activeScars = [];
        }
        location.activeScars.push({
          description: `Harvested resource site - the land shows signs of extraction`
        });
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