/**
 * M37: Macro-Event Engine
 * 
 * Handles world-wide phenomena and cataclysmic events that modify biome variables
 * across all regions and affect the entire game world simultaneously.
 * 
 * Examples:
 * - Plagues: Reduce NPC health/morale globally, increase mortality
 * - Holy Wars: Faction conflicts spread across multiple regions
 * - Mana Depletion: Reduce magic efficacy globally, disable spells
 * - Cursed Flowers: Environmental corruption spreads
 * - The Sundering: Dimensional rifts appear across world
 * - Prophecy Convergence: Multiple NPCs affected simultaneously
 */

import { WorldState } from './worldEngine';

/**
 * M37: Macro event types affecting the entire world
 */
export type MacroEventType =
  | 'plague'
  | 'holy_war'
  | 'mana_depletion'
  | 'environmental_corruption'
  | 'dimensional_rift'
  | 'prophecy_convergence'
  | 'faction_collapse'
  | 'resource_abundance'
  | 'celestial_event'
  | 'magical_storm';

/**
 * M37: Global effect modifier that persists across regions
 */
export interface GlobalEffectModifier {
  type: MacroEventType;
  severity: number;              // 0-100: intensity of effect
  affectedBiomes: string[];      // Biome IDs affected (empty = all)
  affectedFactions?: string[];   // Faction IDs affected (empty = all)
  effectProperties: {
    npcMortalityMultiplier?: number;   // 1.0 = normal, 2.0 = double deaths
    manaEfficiencyMultiplier?: number; // 0.5 = half magic power
    resourceMultiplier?: number;       // 2.0 = double resources available
    moraleDelta?: number;              // -20 = reduce morale 20 points
    conflictChance?: number;           // 0-1: chance of conflict triggering
  };
  startsAt: number;              // Tick when effect begins
  durationTicks: number;         // How long effect persists
  expiresAt: number;             // Calculated: startsAt + durationTicks
  isActive: boolean;
}

/**
 * M37: Macro event that can trigger with specific conditions
 */
export interface MacroEventTrigger {
  id: string;
  type: MacroEventType;
  name: string;
  description: string;
  triggerCondition: (worldState: WorldState) => boolean;  // Condition to activate
  severity: number;              // 0-100
  durationTicks: number;
  baseProbability?: number;      // 0-1: chance per turn if conditions met
  effectProperties: GlobalEffectModifier['effectProperties'];
}

/**
 * M37: Macro event history entry
 */
export interface MacroEventHistoryEntry {
  timestamp: number;
  tick: number;
  eventType: MacroEventType;
  severity: number;
  triggeredBy?: string;          // Description of cause
  affectedRegions: number;
  npcsDied?: number;
  economicImpact?: number;       // Gold/resource loss
  factionConflictCount?: number;
}

/**
 * M37: Get default macro event triggers
 */
export function getDefaultMacroEventTriggers(worldState: WorldState): MacroEventTrigger[] {
  return [
    {
      id: 'trigger-plague',
      type: 'plague',
      name: 'The Wasting Sickness',
      description: 'A disease spreads across the realm, claiming lives',
      triggerCondition: (state: WorldState) => {
        // Trigger if NPC death count high or many locations corrupted
        const totalNpcs = state.npcs?.length || 0;
        return totalNpcs > 50;  // Trigger in populated worlds
      },
      severity: 60,
      durationTicks: 500,
      baseProbability: 0.02,
      effectProperties: {
        npcMortalityMultiplier: 2.5,
        moraleDelta: -30,
      },
    },
    {
      id: 'trigger-holy-war',
      type: 'holy_war',
      name: 'The Divine Schism',
      description: 'Religious factions clash in holy war',
      triggerCondition: (state: WorldState) => {
        // Trigger if many religious factions exist
        return (state as any)._factionMetadata?.religious_count > 2;
      },
      severity: 75,
      durationTicks: 300,
      baseProbability: 0.03,
      effectProperties: {
        conflictChance: 0.6,
        moraleDelta: -25,
      },
    },
    {
      id: 'trigger-mana-depletion',
      type: 'mana_depletion',
      name: 'The Silent Blight',
      description: 'Magic fades from the world',
      triggerCondition: (state: WorldState) => {
        // Trigger if many magic nodes have been depleted
        const magicLocations = (state.locations || []).filter(l => (l as any).magicNode);
        return magicLocations.length > 0;
      },
      severity: 50,
      durationTicks: 400,
      baseProbability: 0.015,
      effectProperties: {
        manaEfficiencyMultiplier: 0.3,
      },
    },
    {
      id: 'trigger-environmental-corruption',
      type: 'environmental_corruption',
      name: 'The Creeping Blight',
      description: 'Nature itself becomes twisted and hostile',
      triggerCondition: (state: WorldState) => {
        // Trigger if heavy environmental damage detected
        const corruptedLocations = (state.locations || []).filter(l => (l as any)._glitchLevel > 50);
        return corruptedLocations.length > 5;
      },
      severity: 55,
      durationTicks: 600,
      baseProbability: 0.02,
      effectProperties: {
        resourceMultiplier: 0.5,
        moraleDelta: -20,
      },
    },
    {
      id: 'trigger-dimensional-rift',
      type: 'dimensional_rift',
      name: 'The Sundering',
      description: 'Reality fractures, revealing other dimensions',
      triggerCondition: (state: WorldState) => {
        // Trigger if paradox events accumulated
        const paradoxEvents = ((state as any)._eventHistory || []).filter((e: any) => e.type === 'paradox');
        return paradoxEvents.length > 10;
      },
      severity: 80,
      durationTicks: 250,
      baseProbability: 0.01,
      effectProperties: {
        conflictChance: 0.5,
        moraleDelta: -40,
      },
    },
    {
      id: 'trigger-prophecy-convergence',
      type: 'prophecy_convergence',
      name: 'The Awakening',
      description: 'Multiple prophecies manifest at once',
      triggerCondition: (state: WorldState) => {
        // Trigger if many prophecies have been made
        const prophecies = ((state as any)._prophecies || []).filter((p: any) => !p.fulfilled);
        return prophecies.length > 3;
      },
      severity: 65,
      durationTicks: 200,
      baseProbability: 0.025,
      effectProperties: {
        conflictChance: 0.4,
      },
    },
  ];
}

/**
 * M37: Evaluate if a macro event should trigger this turn
 */
export function evaluateMacroEventTrigger(
  trigger: MacroEventTrigger,
  worldState: WorldState,
  activeEffects: GlobalEffectModifier[]
): { shouldTrigger: boolean; reason?: string } {
  // Don't trigger if similar event already active
  const similarActive = activeEffects.find(e => e.type === trigger.type && e.isActive);
  if (similarActive) {
    return { shouldTrigger: false, reason: `${trigger.type} already active` };
  }

  // Check trigger condition
  if (!trigger.triggerCondition(worldState)) {
    return { shouldTrigger: false, reason: 'Conditions not met' };
  }

  // Check probability
  const roll = Math.random();
  if (roll > (trigger.baseProbability || 0.01)) {
    return { shouldTrigger: false, reason: 'Probability check failed' };
  }

  return { shouldTrigger: true, reason: 'All conditions met and probability check passed' };
}

/**
 * M37: Create a global effect from a macro event trigger
 */
export function createMacroEventEffect(
  trigger: MacroEventTrigger,
  worldState: WorldState
): GlobalEffectModifier {
  // Determine affected biomes (currently affects all if empty)
  const affectedBiomes = trigger.effectProperties.manaEfficiencyMultiplier !== undefined
    ? ['all_magic']
    : trigger.effectProperties.npcMortalityMultiplier !== undefined
    ? ['all']
    : [];

  return {
    type: trigger.type,
    severity: trigger.severity,
    affectedBiomes,
    effectProperties: trigger.effectProperties,
    startsAt: worldState.currentTick || 0,
    durationTicks: trigger.durationTicks,
    expiresAt: (worldState.currentTick || 0) + trigger.durationTicks,
    isActive: true,
  };
}

/**
 * M37: Apply global effect modifiers to world state
 */
export function applyMacroEventEffects(
  worldState: WorldState,
  activeEffects: GlobalEffectModifier[]
): {
  modifiedState: WorldState;
  appliedEffects: string[];
  eventLog: MacroEventHistoryEntry[];
} {
  const modifiedState = structuredClone(worldState);
  const appliedEffects: string[] = [];
  const eventLog: MacroEventHistoryEntry[] = [];

  // Filter active effects
  const activeNow = activeEffects.filter(e => e.isActive && e.expiresAt > (worldState.currentTick || 0));

  for (const effect of activeNow) {
    let regionsAffected = 0;
    let npcsDied = 0;
    let economicImpact = 0;

    if (effect.effectProperties.npcMortalityMultiplier) {
      // Apply plague effects
      const mortalityMult = effect.effectProperties.npcMortalityMultiplier;
      const originalNpcCount = modifiedState.npcs?.length || 0;

      modifiedState.npcs = (modifiedState.npcs || []).filter(npc => {
        // Increase death chance based on multiplier
        const deathChance = (mortalityMult - 1) * 0.1; // Convert multiplier to probability
        if (Math.random() < deathChance) {
          npcsDied++;
          return false;
        }
        return true;
      });

      if (npcsDied > 0) {
        appliedEffects.push(`Plague: ${npcsDied} NPCs died`);
        regionsAffected = modifiedState.locations?.length || 0;
      }
    }

    if (effect.effectProperties.manaEfficiencyMultiplier && effect.effectProperties.manaEfficiencyMultiplier < 1) {
      // Reduce magic resource availability
      const efficiency = effect.effectProperties.manaEfficiencyMultiplier;
      modifiedState.locations = (modifiedState.locations || []).map(loc => {
        if ((loc as any).magicNode) {
          const loot = (loc as any).lootTableId;
          economicImpact += Math.floor(100 * (1 - efficiency));
          regionsAffected++;
          return {
            ...loc,
            _magicFade: (loc as any)._magicFade ? (loc as any)._magicFade + effect.severity : effect.severity,
          };
        }
        return loc;
      });

      if (regionsAffected > 0) {
        appliedEffects.push(`Mana Depletion: ${regionsAffected} magic locations affected`);
      }
    }

    if (effect.effectProperties.resourceMultiplier && effect.effectProperties.resourceMultiplier < 1) {
      // Reduce global resources
      const multiplier = effect.effectProperties.resourceMultiplier;
      modifiedState.locations = (modifiedState.locations || []).map(loc => {
        const loot = (loc as any).lootTableId;
        economicImpact += Math.floor(100 * (1 - multiplier) * effect.severity / 100);
        regionsAffected++;
        return {
          ...loc,
          _resourceDepletion: (loc as any)._resourceDepletion ? (loc as any)._resourceDepletion + 1 : 1,
        };
      });

      if (regionsAffected > 0) {
        appliedEffects.push(`Resource Scarcity: ${regionsAffected} regions affected`);
      }
    }

    // Log the event
    eventLog.push({
      timestamp: Date.now(),
      tick: worldState.currentTick || 0,
      eventType: effect.type,
      severity: effect.severity,
      affectedRegions: regionsAffected,
      npcsDied,
      economicImpact,
    });
  }

  return {
    modifiedState,
    appliedEffects,
    eventLog,
  };
}

/**
 * M37: Update active effects (remove expired, keep current)
 */
export function updateActiveMacroEffects(
  currentEffects: GlobalEffectModifier[],
  currentTick: number
): GlobalEffectModifier[] {
  return currentEffects.map(effect => ({
    ...effect,
    isActive: effect.expiresAt > currentTick,
  })).filter(e => e.isActive || e.expiresAt > currentTick - 100); // Keep recent for history
}

/**
 * M37: Get macro event diagnostics for dashboard
 */
export function getMacroEventDiagnostics(
  activeEffects: GlobalEffectModifier[],
  eventHistory: MacroEventHistoryEntry[]
): Record<string, any> {
  const activeNow = activeEffects.filter(e => e.isActive);
  const totalNpcsDied = eventHistory.reduce((sum, e) => sum + (e.npcsDied || 0), 0);
  const totalEconomicImpact = eventHistory.reduce((sum, e) => sum + (e.economicImpact || 0), 0);

  return {
    activeEventsCount: activeNow.length,
    activeEventTypes: activeNow.map(e => e.type),
    maxSeverity: activeNow.length > 0 ? Math.max(...activeNow.map(e => e.severity)) : 0,
    totalNpcsDiedThisEpoch: totalNpcsDied,
    totalEconomicImpact: totalEconomicImpact,
    eventHistoryCount: eventHistory.length,
    averageSeverity: activeNow.length > 0 ? activeNow.reduce((sum, e) => sum + e.severity, 0) / activeNow.length : 0,
    recentEvents: eventHistory.slice(-5).map(e => ({
      type: e.eventType,
      severity: e.severity,
      tick: e.tick,
      impact: `${e.npcsDied || 0} deaths, ${e.economicImpact || 0} resources lost`,
    })),
  };
}

/**
 * M37: Process macro events for a game world tick
 */
export function processMacroEventTick(
  worldState: WorldState,
  activeEffects: GlobalEffectModifier[],
  triggers: MacroEventTrigger[]
): {
  updatedState: WorldState;
  newEffects: GlobalEffectModifier[];
  eventLog: MacroEventHistoryEntry[];
  eventsTriggered: string[];
} {
  let newEffects: GlobalEffectModifier[] = [...activeEffects];
  const eventsTriggered: string[] = [];

  // Evaluate triggers and potentially create new effects
  for (const trigger of triggers) {
    const { shouldTrigger, reason } = evaluateMacroEventTrigger(trigger, worldState, newEffects);
    if (shouldTrigger) {
      const newEffect = createMacroEventEffect(trigger, worldState);
      newEffects.push(newEffect);
      eventsTriggered.push(`${trigger.name} triggered (${reason})`);
    }
  }

  // Update active effects
  newEffects = updateActiveMacroEffects(newEffects, worldState.currentTick || 0);

  // Apply effects to world state
  const { modifiedState, appliedEffects, eventLog } = applyMacroEventEffects(worldState, newEffects);

  return {
    updatedState: modifiedState,
    newEffects,
    eventLog,
    eventsTriggered: [...eventsTriggered, ...appliedEffects],
  };
}
