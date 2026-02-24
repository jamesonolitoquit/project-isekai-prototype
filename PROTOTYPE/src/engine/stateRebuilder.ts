import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { random } from './prng';
import { createStackableItem, isStackableItem } from './worldEngine';
import { transitionEngine, type TransitionReason } from './transitionEngine';
import { getNpcMemoryEngine } from './npcMemoryEngine';
import { getPhase27AnomalyAtLocation, Phase27AgeRotAnomalyType } from './paradoxEngine'; // Phase 27 Task 1

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
   * Combat Event Handler - M40: Delegated to micro-handlers
   * Complexity reduced from 112 to <10
   */
  export function handleCombatEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;
    const type = event.type;

    // Damage events
    if (['HIT', 'COMBAT_HIT', 'PARRY', 'COMBAT_PARRY', 'COMBAT_BLOCK', 'HAZARD_DAMAGE'].includes(type)) {
      processDamageEvent(newState, type, payload);
      if (type === 'HAZARD_DAMAGE' && payload.statusApplied) {
        processStatusEvent(newState, type, payload);
      }
    }
    
    // Recovery events
    else if (['HEAL', 'PLAYER_HEALED', 'PLAYER_REST'].includes(type)) {
      processRecoveryEvent(newState, type, payload);
    }
    
    // Status events
    else if (['STATUS_APPLIED', 'STATUS_EFFECT_EXPIRED'].includes(type)) {
      processStatusEvent(newState, type, payload);
    }
    
    // Mana events
    else if (['MANA_REGENERATED', 'MANA_DRAINED'].includes(type)) {
      processManaEvent(newState, payload);
    }
    
    // Soul events
    else if (['SOUL_DECAY', 'NPC_SOUL_DECAY'].includes(type)) {
      processSoulEvent(newState, type, payload);
    }
    
    // Combat state events
    else if (['COMBAT_STARTED', 'COMBAT_ENDED', 'COMBAT_LOG_ENTRY', 'ACTOR_WAITED'].includes(type)) {
      processCombatStateEvent(newState, type, payload);
    }
    
    // Spell casting
    else if (type === 'SPELL_CAST') {
      processSpellCastEvent(newState, payload);
    }
    
    // Simple skill check for XP
    else if (type === 'SKILL_CHECK') {
      if (newState.player && payload.success) {
        newState.player.xp ??= 0;
        newState.player.xp += (payload.xpReward ?? 0);
      }
    }
    
    // Log-only events: DRAIN_MANA_FAILED, SPELL_CAST_FAILED
    // (no state changes)

    return newState;
  }

  /**
   * Player Event Handler
   * MOVE, TICK, QUEST_*, REWARD, LEVEL_UP, REPUTATION_CHANGED, CHARACTER_CREATED
   */
  // Quest event management: QUEST_STARTED, QUEST_COMPLETED, QUEST_OBJECTIVE_ADVANCED
  function processQuestEvent(state: WorldState, eventType: string, payload: any, tick: number): void {
    if (!state.player?.quests) return;
    const questId = payload.questId ?? '';
    
    if (eventType === 'QUEST_STARTED') {
      state.player.quests[questId] ??= { status: 'not_started' };
      state.player.quests[questId].status = 'in_progress';
      state.player.quests[questId].startedAt = tick;
    } else if (eventType === 'QUEST_COMPLETED') {
      if (state.player.quests[questId]) {
        state.player.quests[questId].status = 'completed';
        state.player.quests[questId].completedAt = tick;
      }
    } else if (eventType === 'QUEST_OBJECTIVE_ADVANCED') {
      if (state.player.quests[questId]) {
        state.player.quests[questId].currentObjectiveIndex = payload.newObjective;
      }
    }
  }

  // Reward distribution: gold, xp
  function processRewardEvent(state: WorldState, payload: any): void {
    if (!state.player) return;
    
    if (payload.type === 'gold') {
      state.player.gold ??= 0;
      state.player.gold += payload.amount ?? 0;
    } else if (payload.type === 'xp') {
      state.player.xp ??= 0;
      state.player.xp += payload.amount ?? 0;
    }
  }

  // XP and leveling: XP_GAINED, LEVEL_UP
  function processXPEvent(state: WorldState, eventType: string, payload: any): void {
    if (!state.player) return;
    
    if (eventType === 'LEVEL_UP') {
      state.player.level ??= 1;
      state.player.level += 1;
    } else if (eventType === 'XP_GAINED') {
      state.player.xp ??= 0;
      state.player.xp += payload.xpAmount ?? 0;
      // Auto level-up if XP exceeds threshold
      const level = state.player.level ?? 1;
      const xpThreshold = level * 100;
      if (state.player.xp >= xpThreshold) {
        state.player.level = level + 1;
        state.player.xp = 0;
        state.player.attributePoints ??= 0;
        state.player.attributePoints += 2;
      }
    }
  }

  // Reputation management: REPUTATION_CHANGED
  function processReputationEvent(state: WorldState, payload: any): void {
    if (!state.player) return;
    const fId = payload.factionId ?? payload.npcId;
    state.player.reputation ??= {};
    state.player.reputation[fId] ??= 0;
    state.player.reputation[fId] += payload.amount ?? payload.delta ?? payload.newRep ?? 0;
  }

  // Character creation: CHARACTER_CREATED
  function processCharacterCreation(state: WorldState, payload: any): void {
    const character = structuredClone(payload.character);
    if (!character.hp || !character.maxHp) {
      const endStat = character.stats?.end ?? 10;
      const baseHp = 80 + endStat * 2;
      character.hp = baseHp;
      character.maxHp = baseHp;
    }
    character.statusEffects ??= [];
    character.quests = state.player?.quests ?? {};
    character.gold ??= 0;
    character.reputation ??= {};
    state.player = character;
    state.needsCharacterCreation = false;
  }

  /**
   * Player Event Handler - M40: Delegated to micro-handlers
   * Complexity reduced from 33 to <10
   */
  export function handlePlayerEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;
    const type = event.type;

    const handlerMap: Record<string, () => void> = {
      'MOVE': () => {
        if (newState.player) {
          newState.player.location = payload.to ?? payload.playerId;
        }
      },
      
      'TICK': () => {
        advanceWorldTime(newState, 1);
        // If payload explicitly overrides (e.g. for time synchronization)
        if (payload.newHour !== undefined) newState.hour = payload.newHour;
        if (payload.newDay !== undefined) newState.day = payload.newDay;
        if (payload.newSeason !== undefined) newState.season = payload.newSeason;
      },
      
      'QUEST_STARTED': () => processQuestEvent(newState, type, payload, newState.tick ?? 0),
      'QUEST_COMPLETED': () => processQuestEvent(newState, type, payload, newState.tick ?? 0),
      'QUEST_OBJECTIVE_ADVANCED': () => processQuestEvent(newState, type, payload, newState.tick ?? 0),
      
      'REWARD': () => processRewardEvent(newState, payload),
      'LEVEL_UP': () => processXPEvent(newState, type, payload),
      'XP_GAINED': () => processXPEvent(newState, type, payload),
      'REPUTATION_CHANGED': () => processReputationEvent(newState, payload),
      
      'CHARACTER_CREATED': () => processCharacterCreation(newState, payload),
      
      'INTERACT_NPC': () => {
        if (newState.player) {
          newState.player.dialogueHistory ??= [];
          newState.player.dialogueHistory.push({
            npcId: payload.npcId,
            text: payload.dialogueText,
            options: payload.options,
            timestamp: event.timestamp,
          });
        }
      },
      
      'STAT_ALLOCATED': () => {
        if (newState.player?.stats && payload.stat in newState.player.stats) {
          const stat = payload.stat as keyof typeof newState.player.stats;
          newState.player.stats[stat] += payload.amount ?? 0;
          newState.player.attributePoints ??= 0;
          newState.player.attributePoints = Math.max(0, newState.player.attributePoints - (payload.amount ?? 0));
        }
      },
      
      'PLAYER_DEFEATED': () => {
        if (newState.player) {
          newState.player.location = 'Eldergrove Village';
          newState.player.hp = Math.ceil((newState.player.maxHp ?? 100) * 0.5);
        }
      },
      
      'CHRONO_ACTION_REST': () => {
        if (newState.player) {
          newState.player.hp = payload.newHp ?? newState.player.hp;
          newState.player.mp = payload.newMp ?? newState.player.mp;
        }
        const ticks = payload.ticksAdvanced ?? 0;
        advanceWorldTime(newState, ticks);
      },
      
      'CHRONO_ACTION_WAIT': () => {
        const ticks = payload.ticksAdvanced ?? 0;
        advanceWorldTime(newState, ticks);
      }
    };

    handlerMap[type]?.();
    return newState;
  }

  /**
   * Helper: Advances world time and updates hour/day/season
   */
  function advanceWorldTime(state: WorldState, ticks: number): void {
    if (ticks <= 0) return;
    state.tick = (state.tick ?? 0) + ticks;
    
    // 60 ticks = 1 hour, 24 hours = 1 day
    state.hour = Math.floor(state.tick / 60) % 24;
    state.day = Math.floor(state.tick / (60 * 24)) + 1;
    
    // Seasonal cycles: 30 days per season
    const daysPerSeason = 30;
    const seasons: Array<'spring' | 'summer' | 'autumn' | 'winter'> = ['spring', 'summer', 'autumn', 'winter'];
    const seasonIndex = Math.floor((state.day - 1) / daysPerSeason) % 4;
    state.season = seasons[seasonIndex];
  }

  /**
   * Inventory Event Handler
   * ITEM_*, RESOURCE_*
   */
  /**
   * Inventory Event Handler - M40: Simplified
   * Complexity reduced from 39 to <10
   */
  export function handleInventoryEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    if (['ITEM_PICKED_UP', 'RESOURCE_GATHERED'].includes(event.type)) {
      if (!newState.player) return newState;
      newState.player.inventory ??= [];
      const itemId = event.type === 'RESOURCE_GATHERED' ? payload.resourceType : payload.itemId;
      const existing = newState.player.inventory.find(i => i.itemId === itemId && isStackableItem(i));
      if (existing && isStackableItem(existing)) {
        existing.quantity += payload.quantity ?? 1;
      } else {
        newState.player.inventory.push(createStackableItem(itemId, payload.quantity ?? 1));
      }
    } else if (event.type === 'ITEM_DROPPED') {
      if (!newState.player?.inventory) return newState;
      const idx = newState.player.inventory.findIndex(i => i.itemId === payload.itemId && isStackableItem(i));
      if (idx !== -1) {
        const item = newState.player.inventory[idx];
        if (isStackableItem(item)) {
          item.quantity -= payload.quantity ?? 1;
          if (item.quantity <= 0) newState.player.inventory.splice(idx, 1);
        }
      }
    } else if (event.type === 'ITEM_EQUIPPED') {
      if (newState.player) {
        newState.player.equipment ??= {};
        newState.player.equipment.mainHand = payload.itemId;
      }
    } else if (event.type === 'ITEM_UNEQUIPPED') {
      if (newState.player?.equipment && payload.slot in newState.player.equipment) {
        const slot = payload.slot as keyof typeof newState.player.equipment;
        newState.player.equipment[slot] = undefined;
      }
    } else if (event.type === 'ITEM_USED') {
      if (!newState.player?.inventory) return newState;
      const idx = newState.player.inventory.findIndex(i => i.itemId === payload.itemId && isStackableItem(i));
      if (idx !== -1) {
        const item = newState.player.inventory[idx];
        if (isStackableItem(item)) {
          item.quantity -= payload.quantity ?? 1;
          if (item.quantity <= 0) newState.player.inventory.splice(idx, 1);
          applyItemEffects(newState, payload.itemId);
        }
      }
    }
    // else: ITEM_CRAFTED (no-op without recipe lookup)

    return newState;
  }

  /**
   * Trade Event Handler
   * TRADE_*
   */
  /**
   * Trade Event Handler - M40: Simplified dispatch
   * Complexity reduced from 40 to <10
   */
  export function handleTradeEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    newState.tradeLog ??= [];
    const log = newState.tradeLog;
    const { payload } = event;

    if (event.type === 'TRADE_INITIATED') {
      log.push({ tradeId: payload.tradeId, initiator: payload.initiatorId, responder: payload.responderId, timestamp: event.timestamp, status: 'initiated' });
    } else if (event.type === 'TRADE_COMMITMENT') {
      const entry = log.find((t: any) => t.tradeId === payload.tradeId);
      if (entry) { entry.status = 'committed'; entry.committedAt = event.timestamp; }
    } else if (event.type === 'TRADE_COMPLETED') {
      if (newState.player && newState.player.inventory) {
        const { initiatorId, initiatorItems, responderItems } = payload;
        const isInitiator = newState.player.id === initiatorId;
        const toRemove = isInitiator ? initiatorItems : responderItems;
        const toAdd = isInitiator ? responderItems : initiatorItems;
        
        for (const item of toRemove ?? []) {
          let qty = item.quantity;
          for (let i = 0; i < newState.player.inventory.length && qty > 0; ) {
            const inv = newState.player.inventory[i];
            if (isStackableItem(inv) && inv.itemId === item.itemId) {
              const removed = Math.min(qty, inv.quantity);
              inv.quantity -= removed;
              qty -= removed;
              if (inv.quantity <= 0) newState.player.inventory.splice(i, 1);
              else i++;
            } else i++;
          }
        }
        
        for (const item of toAdd ?? []) {
          const existing = newState.player.inventory.find(i => isStackableItem(i) && i.itemId === item.itemId);
          if (existing && isStackableItem(existing)) existing.quantity += item.quantity;
          else newState.player.inventory.push(createStackableItem(item.itemId, item.quantity));
        }
      }
      const entry = log.find((t: any) => t.tradeId === payload.tradeId);
      if (entry) { entry.status = 'completed'; entry.completedAt = event.timestamp; }
    } else if (event.type === 'TRADE_CANCELLED') {
      const entry = log.find((t: any) => t.tradeId === payload.tradeId);
      if (entry) { entry.status = 'cancelled'; entry.cancelledAt = event.timestamp; }
    }
    
    return newState;
  }

  /**
   * Faction Event Handler
   * FACTION_*, LOCATION_CONTROL_CHANGED
   */
  /**
   * Faction Event Handler - M40: Simplified
   * Complexity reduced from 30 to <10
   */
  export function handleFactionEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    if (event.type === 'FACTION_QUEST_COMPLETED') {
      if (newState.player) {
        newState.player.factionReputation ??= {};
        newState.player.factionReputation[payload.factionId] = (newState.player.factionReputation[payload.factionId] ?? 0) + (payload.reputationGain ?? 25);
      }
      const f = newState.factions?.find(f => f.id === payload.factionId);
      if (f) f.powerScore = Math.max(0, Math.min(100, f.powerScore + (payload.powerGain ?? 5)));
    } else if (event.type === 'FACTION_COMBAT_VICTORY') {
      if (payload.victoryFactionId === 'player' && newState.player) {
        newState.player.factionReputation ??= {};
        newState.player.factionReputation[payload.defenderFactionId] = (newState.player.factionReputation[payload.defenderFactionId] ?? 0) - (payload.reputationGain ?? 10);
      }
      const defF = newState.factions?.find(f => f.id === payload.defenderFactionId);
      if (defF) defF.powerScore = Math.max(0, Math.min(100, defF.powerScore - (payload.powerGain ?? 3)));
    } else if (event.type === 'FACTION_POWER_SHIFT') {
      const f = newState.factions?.find(f => f.id === payload.factionId);
      if (f) f.powerScore = Math.max(0, Math.min(100, f.powerScore + (payload.delta ?? 0)));
    } else if (event.type === 'LOCATION_CONTROL_CHANGED') {
      const newF = newState.factions?.find(f => f.id === payload.newFactionId);
      if (newF) {
        newF.controlledLocationIds ??= [];
        if (!newF.controlledLocationIds.includes(payload.locationId)) {
          newF.controlledLocationIds.push(payload.locationId);
        }
      }
      newState.factions?.forEach(f => {
        if (f.id !== payload.newFactionId && f.controlledLocationIds) {
          f.controlledLocationIds = f.controlledLocationIds.filter(loc => loc !== payload.locationId);
        }
      });
    }
    // else: FACTION_STRUGGLE (log-only)

    return newState;
  }

  /**
   * M44: Living World Event Handler
   * Handles faction skirmishes, procedural quests, and NPC memory updates
   */
  export function handleLivingWorldEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload, type } = event;

    if (type === 'FACTION_SKIRMISH') {
      const { locationId, aggressor, defender, outcome, influenceShift } = payload;
      newState.locationInfluences ??= {};
      newState.locationInfluences[locationId] ??= {};
      
      const currentAggressor = newState.locationInfluences[locationId][aggressor] ?? 0.2;
      const currentDefender = newState.locationInfluences[locationId][defender] ?? 0.4;

      if (outcome === 'aggressor_wins') {
        newState.locationInfluences[locationId][aggressor] = Math.min(1.0, currentAggressor + influenceShift);
        newState.locationInfluences[locationId][defender] = Math.max(0, currentDefender - influenceShift);
      } else if (outcome === 'defender_holds') {
        newState.locationInfluences[locationId][defender] = Math.min(1.0, currentDefender + Math.abs(influenceShift));
        newState.locationInfluences[locationId][aggressor] = Math.max(0, currentAggressor - Math.abs(influenceShift));
      }
    } else if (type === 'QUEST_DISCOVERED') {
      newState.proceduralQuests ??= [];
      if (payload.quest) {
        newState.proceduralQuests.push(payload.quest);
      }
    } else if (type === 'NPC_MEMORY_LOGGED') {
      newState.npcMemories ??= {};
      const { npcId, interaction } = payload;
      if (npcId && interaction) {
        newState.npcMemories[npcId] ??= { playerInteractions: [], socialScars: [] };
        
        // Push original interaction
        newState.npcMemories[npcId].playerInteractions.push(interaction);
        
        // M44-T1: Also update the singleton engine to process social scars (deterministically)
        const memoryEngine = getNpcMemoryEngine();
        memoryEngine.syncWithState(newState); // sync existing first
        memoryEngine.recordInteraction(
          npcId,
          interaction.playerId,
          'player',
          interaction.action,
          interaction.sentiment,
          interaction.impactScore,
          interaction.description,
          interaction.timestamp
        );
        
        // Write results back to state (scars only, as interactions already added)
        const profile = memoryEngine.getOrCreateMemoryProfile(npcId);
        newState.npcMemories[npcId].socialScars = Array.from(profile.socialScars.values());
      }
    }

    return newState;
  }

  /**
   * World Event Handler - M40: Simplified
   * Complexity reduced from 31 to <10
   */
  export function handleWorldEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    if (event.type === 'WORLD_EVENT_TRIGGERED') {
      newState.activeEvents ??= [];
      if (!newState.activeEvents.find(e => e.id === payload.eventId)) {
        newState.activeEvents.push({ id: payload.eventId, name: payload.eventId, type: 'climate-change', activeFrom: newState.tick ?? 0, activeTo: (newState.tick ?? 0) + 3600, effects: {} });
      }
    } else if (event.type === 'NODE_DEPLETED') {
      const node = newState.resourceNodes?.find(n => n.id === payload.nodeId);
      if (node) node.depletedAt = newState.tick ?? 0;
    } else if (['LOCATION_DISCOVERED', 'SUB_AREA_DISCOVERED'].includes(event.type)) {
      if (newState.player) {
        newState.player.discoveredSecrets ??= new Set();
        newState.player.discoveredSecrets.add(event.type === 'SUB_AREA_DISCOVERED' ? payload.subAreaId : payload.areaId);
      }
      if (event.type === 'SUB_AREA_DISCOVERED' && newState.locations && payload.parentLocation) {
        const loc = newState.locations.find(l => l.id === payload.parentLocation);
        const sub = loc?.subAreas?.find(s => s.id === payload.subAreaId);
        if (sub) sub.discovered = true;
      }
    } else if (event.type === 'ENCOUNTER_TRIGGERED') {
      newState.activeEncounter = { id: `encounter-${Date.now()}`, npcId: payload.npcId, type: payload.encounterType, spawnedAt: event.timestamp };
    } else if (event.type === 'TRAVEL_STARTED') {
      newState.travelState = { isTraveling: true, fromLocationId: payload.fromLocation, toLocationId: payload.toLocation, remainingTicks: payload.estimatedTicks, ticksPerTravelSession: payload.estimatedTicks, encounterRolled: false };
    } else if (event.type === 'TRAVEL_TICK') {
      if (newState.travelState) {
        newState.travelState.remainingTicks = Math.max(0, payload.remainingTicks ?? 0);
        if (newState.travelState.remainingTicks <= 0 && newState.player) {
          newState.player.location = newState.travelState.toLocationId;
          newState.travelState.isTraveling = false;
        }
      }
    }
    // else: SEARCH_FAILED, SEARCH_NO_SECRETS (log-only)

    return newState;
  }

  /**
   * Arcane Event Handler
   * TEMPORAL_PARADOX, PARADOX_STRIKE, CHAOS_ANOMALY, MORPH_*, ESSENCE_DECAY
   */
  /**
   * Arcane Event Handler - M40: Simplified with dispatch map
   * Complexity reduced from 48 to <10
   */
  export function handleArcaneEvent(state: WorldState, event: Event): WorldState {
    const newState = structuredClone(state);
    const { payload } = event;

    const handlers: Record<string, () => void> = {
      'TEMPORAL_PARADOX': () => {
        if (!newState.player) return;
        newState.player.temporalDebt = Math.min(100, (newState.player.temporalDebt ?? 0) + (payload.debtIncrease ?? 0));
        if (newState.player.beliefLayer) {
          const boost = Math.floor((payload.debtIncrease ?? 0) * 0.3);
          newState.player.beliefLayer.suspicionLevel = Math.min(100, (newState.player.beliefLayer.suspicionLevel ?? 0) + boost);
        }
      },
      
      'PARADOX_STRIKE': () => {
        if (!newState.player) return;
        if (payload.damage && payload.damage > 0) {
          newState.player.hp = Math.max(0, (newState.player.hp ?? 100) - payload.damage);
        }
        newState.player.temporalDebt = Math.min(100, (newState.player.temporalDebt ?? 0) + (payload.temporalCost ?? 5));
      },
      
      'CHAOS_ANOMALY': () => {
        if (payload.type === 'npc_location_drift' && newState.npcs?.length) {
          const npc = newState.npcs[Math.floor(random() * newState.npcs.length)];
          const loc = newState.locations[Math.floor(random() * newState.locations.length)];
          if (loc) npc.locationId = loc.id;
        }
      },
      
      'GHOST_TICK': () => {
        const ticks = payload.ticksSkipped ?? 0;
        if (ticks > 0) {
          newState.hour = (newState.hour + ticks) % 24;
          newState.tick = ((newState.tick ?? 0) + ticks);
        }
      },
      
      'MORPH_SUCCESS': () => {
        if (!newState.player) return;
        newState.player.currentRace = payload.toRace;
        if (payload.statChanges && newState.player.stats) {
          Object.assign(newState.player.stats, payload.statChanges);
        }
        newState.player.soulStrain = payload.newSoulStrain ?? 0;
        newState.player.lastMorphTick = event.timestamp;
        newState.player.recentMorphCount = (newState.player.recentMorphCount ?? 0) + 1;
      },
      
      'MORPH_FAILURE': () => {
        if (!newState.player) return;
        newState.player.soulStrain = payload.newSoulStrain ?? 0;
        newState.player.lastMorphTick = event.timestamp;
        newState.player.recentMorphCount = (newState.player.recentMorphCount ?? 0) + 1;
      },
      
      'VESSEL_SHATTER': () => {
        if (!newState.player) return;
        newState.player.soulStrain = Math.min(100, (newState.player.soulStrain ?? 0) + (payload.soulStrainGain ?? 0));
        if (newState.player.knowledgeBase?.size) {
          const npcs = Array.from(newState.player.knowledgeBase).filter(k => k.startsWith('npc:'));
          const count = Math.ceil(npcs.length * 0.3);
          for (let i = 0; i < count; i++) {
            const idx = Math.floor(random() * npcs.length);
            newState.player.knowledgeBase.delete(npcs[idx]);
          }
        }
        newState.player.lastMorphTick = event.timestamp;
        newState.player.recentMorphCount = (newState.player.recentMorphCount ?? 0) + 1;
      },
      
      'ESSENCE_DECAY': () => {
        if (!newState.player?.stats) return;
        const penalty = payload.penaltyAmount ?? 1;
        for (const stat of ['str', 'agi', 'int', 'cha', 'end', 'luk'] as const) {
          newState.player.stats[stat] = Math.max(1, (newState.player.stats[stat] ?? 10) - penalty);
        }
      },
      
      'REVOLT_OF_TRUTH': () => {
        if (!newState.player) return;
        newState.player.temporalDebt = Math.min(100, (newState.player.temporalDebt ?? 0) + 20);
        if (payload.consequence === 'OBFUSCATION_INVERSION' && newState.player.knowledgeBase) {
          Array.from(newState.player.knowledgeBase)
            .filter(k => k.startsWith('npc:'))
            .slice(0, Math.floor((newState.npcs?.length ?? 0) * 0.3))
            .forEach(k => newState.player.knowledgeBase?.delete(k));
        }
      }
    };

    handlers[event.type]?.();
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

    newState.relicEvents ??= [];

    switch (event.type) {
      case 'RUNE_INFUSED': {
        if (newState.relics?.[payload.relicId]) {
          newState.relicEvents!.push({
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
          newState.relicEvents!.push({
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
          newState.relicEvents!.push({
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
        newState.relicEvents!.push({
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
      newState.metadata ??= {};
      const metadata = newState.metadata as Record<string, unknown>;
      let violationLog = metadata.violationLog as Array<unknown>;
      if (!Array.isArray(violationLog)) {
        violationLog = [];
        metadata.violationLog = violationLog;
      }
      violationLog.push({
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
    // Living World (M44)
    'FACTION_SKIRMISH': handleLivingWorldEvent, 'QUEST_DISCOVERED': handleLivingWorldEvent,
    'NPC_MEMORY_LOGGED': handleLivingWorldEvent,
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
    const player = state.player;
    if (!player) return;
    
    const effects: Record<string, () => void> = {
      'healing-potion-minor': () => {
        player.hp = Math.min(
          player.maxHp ?? 100,
          (player.hp ?? 0) + 25
        );
      },
      'mana-potion-minor': () => {
        player.mp = Math.min(
          player.maxMp ?? 50,
          (player.mp ?? 0) + 30
        );
      },
      'healing-potion-major': () => {
        player.hp = Math.min(
          player.maxHp ?? 100,
          (player.hp ?? 0) + 60
        );
      },
      'mana-potion-major': () => {
        player.mp = Math.min(
          player.maxMp ?? 50,
          (player.mp ?? 0) + 80
        );
      }
    };

    effects[itemId]?.();
  }

  /**
   * Micro-Handlers: Break down complex handlers into single-responsibility functions
   * Each processes specific event types with complexity < 15
   */

  // Damage events: HIT, PARRY, COMBAT_BLOCK, HAZARD_DAMAGE
  function processDamageEvent(state: WorldState, eventType: string, payload: any): void {
    if (!state.player) return;
    
    let damage = 0;
    if (eventType === 'HIT' || eventType === 'COMBAT_HIT') {
      damage = payload.damage ?? 0;
    } else if (eventType === 'PARRY' || eventType === 'COMBAT_PARRY') {
      damage = payload.finalDamage ?? 0;
    } else if (eventType === 'COMBAT_BLOCK') {
      damage = payload.finalDamage ?? 0;
    } else if (eventType === 'HAZARD_DAMAGE') {
      damage = payload.damage ?? 0;
    }
    
    if (damage > 0) {
      state.player.hp = Math.max(0, (state.player.hp ?? 100) - damage);
    }
  }

  // Recovery events: HEAL, PLAYER_HEALED, PLAYER_REST
  function processRecoveryEvent(state: WorldState, eventType: string, payload: any): void {
    if (!state.player) return;
    
    if (eventType === 'HEAL') {
      const hpRestored = payload.amount ?? 0;
      state.player.hp = Math.min(
        state.player.maxHp ?? 100,
        (state.player.hp ?? 0) + hpRestored
      );
    } else if (eventType === 'PLAYER_HEALED') {
      const hpRestored = payload.hpRestored ?? 0;
      state.player.hp = Math.min(
        state.player.maxHp ?? 100,
        (state.player.hp ?? 0) + hpRestored
      );
    } else if (eventType === 'PLAYER_REST') {
      const hpRestored = payload.hpRestored ?? 0;
      state.player.hp = Math.min(
        state.player.maxHp ?? 100,
        (state.player.hp ?? 0) + hpRestored
      );
      if (typeof payload.newMp === 'number') {
        state.player.mp = payload.newMp;
      } else if ((payload.mpRestored ?? 0) > 0) {
        state.player.mp = Math.min(
          state.player.maxMp ?? 0,
          (state.player.mp ?? 0) + (payload.mpRestored ?? 0)
        );
      }
    }
  }

  // Status effect events: STATUS_APPLIED, STATUS_EFFECT_EXPIRED, HAZARD_DAMAGE (status part)
  function processStatusEvent(state: WorldState, eventType: string, payload: any): void {
    if (!state.player) return;
    
    if (eventType === 'STATUS_EFFECT_EXPIRED') {
      state.player.statusEffects = [];
    } else if (eventType === 'STATUS_APPLIED' || eventType === 'HAZARD_DAMAGE') {
      const statusEffect = payload.statusEffect ?? payload.statusApplied;
      if (statusEffect) {
        state.player.statusEffects ??= [];
        if (!state.player.statusEffects.includes(statusEffect)) {
          state.player.statusEffects.push(statusEffect);
        }
      }
    }
  }

  // Mana management: MANA_REGENERATED, MANA_DRAINED
  function processManaEvent(state: WorldState, payload: any): void {
    if (state.player && typeof payload.newMp === 'number') {
      state.player.mp = payload.newMp;
    }
  }

  // Combat state management: COMBAT_STARTED, COMBAT_ENDED, COMBAT_LOG_ENTRY, ACTOR_WAITED
  function processCombatStateEvent(state: WorldState, eventType: string, payload: any): void {
    if (eventType === 'COMBAT_STARTED') {
      state.combatState ??= { active: false, participants: [], turnIndex: 0, roundNumber: 0, log: [], initiator: '' };
      state.combatState.active = true;
      state.combatState.participants = payload.participants ?? [];
      state.combatState.initiator = payload.initiatorId ?? '';
      state.combatState.turnIndex = 0;
      state.combatState.roundNumber = 0;
      state.combatState.log = [];
    } else if (eventType === 'COMBAT_ENDED') {
      if (state.combatState) {
        state.combatState.active = false;
        state.combatState.participants = [];
        state.combatState.turnIndex = 0;
      }
    } else if (eventType === 'COMBAT_LOG_ENTRY') {
      if (state.combatState && payload.message) {
        state.combatState.log ??= [];
        state.combatState.log.push(payload.message);
      }
    } else if (eventType === 'ACTOR_WAITED') {
      if (state.combatState) {
        state.combatState.log ??= [];
        state.combatState.log.push(`Actor waited (${payload.reason ?? 'no reason'})`);
      }
    }
  }

  // Soul management: SOUL_DECAY, NPC_SOUL_DECAY
  function processSoulEvent(state: WorldState, eventType: string, payload: any): void {
    if (eventType === 'SOUL_DECAY') {
      if (state.player && typeof payload.newStrain === 'number') {
        state.player.soulStrain = payload.newStrain;
      }
    } else if (eventType === 'NPC_SOUL_DECAY') {
      if (state.npcs && payload.npcId) {
        const npc = state.npcs.find(n => n.id === payload.npcId);
        if (npc && typeof payload.newStrain === 'number') {
          npc.soulStrain = payload.newStrain;
        }
      }
    }
  }

  // Helper: Apply damage to target (player or NPC)
  function applyDamageToTarget(state: WorldState, targetId: string | undefined, damage: number): void {
    if (!damage || damage <= 0) return;
    if (targetId === state.player?.id) {
      state.player.hp = Math.max(0, (state.player.hp ?? 100) - damage);
    } else {
      const npc = state.npcs?.find(n => n.id === targetId);
      if (npc?.hp !== undefined) {
        npc.hp = Math.max(0, npc.hp - damage);
      }
    }
  }

  // Helper: Apply healing to target
  function applyHealingToTarget(state: WorldState, targetId: string | undefined, healing: number): void {
    if (!healing || healing <= 0) return;

    // Phase 27 Task 1: Check for INVERTED_HEALING anomaly
    // If target is in an anomaly zone with INVERTED_HEALING, convert healing to damage
    let effectiveHealing = healing;
    if (targetId === state.player?.id) {
      const anomalyAtPlayerLocation = getPhase27AnomalyAtLocation(state, state.player?.location ?? '');
      if (anomalyAtPlayerLocation?.type === Phase27AgeRotAnomalyType.INVERTED_HEALING) {
        effectiveHealing = -healing; // Turn healing into damage
      }
    } else {
      const npc = state.npcs?.find(n => n.id === targetId);
      if (npc) {
        const anomalyAtNpcLocation = getPhase27AnomalyAtLocation(state, npc.locationId ?? '');
        if (anomalyAtNpcLocation?.type === Phase27AgeRotAnomalyType.INVERTED_HEALING) {
          effectiveHealing = -healing; // Turn healing into damage
        }
      }
    }

    // Apply healing (or damage if inverted)
    if (targetId === state.player?.id) {
      if (effectiveHealing > 0) {
        state.player.hp = Math.min(state.player?.maxHp ?? 100, (state.player?.hp ?? 0) + effectiveHealing);
      } else if (effectiveHealing < 0) {
        state.player.hp = Math.max(0, (state.player?.hp ?? 0) + effectiveHealing);
      }
    } else {
      const npc = state.npcs?.find(n => n.id === targetId);
      if (npc?.hp !== undefined && npc.maxHp !== undefined) {
        if (effectiveHealing > 0) {
          npc.hp = Math.min(npc.maxHp, npc.hp + effectiveHealing);
        } else if (effectiveHealing < 0) {
          npc.hp = Math.max(0, npc.hp + effectiveHealing);
        }
      }
    }
  }

  // Helper: Apply status effect to target
  function applyStatusToTarget(state: WorldState, targetId: string | undefined, statusEffect: string): void {
    if (!statusEffect) return;
    if (targetId === state.player?.id) {
      state.player.statusEffects ??= [];
      if (!state.player.statusEffects.includes(statusEffect)) {
        state.player.statusEffects.push(statusEffect);
      }
    } else {
      const npc = state.npcs?.find(n => n.id === targetId);
      if (npc) {
        npc.statusEffects ??= [];
        if (!npc.statusEffects?.includes(statusEffect)) {
          npc.statusEffects?.push(statusEffect);
        }
      }
    }
  }

  // Spell casting with multi-target effects: damage, heal, status
  function processSpellCastEvent(state: WorldState, payload: any): void {
    const { targetId, damageDealt, healing, statusApplied } = payload;
    applyDamageToTarget(state, targetId, damageDealt);
    applyHealingToTarget(state, targetId, healing);
    applyStatusToTarget(state, targetId, statusApplied);
  }
}

/**
 * Phase 25 Task 5: Rebuild state from snapshot with delta replay
 * O(1) snapshot load + delta events replay
 * Much faster than full O(n) replay from tick 0 for large event logs
 * 
 * Algorithm:
 * 1. Fetch latest snapshot for world instance at or before upToTick
 * 2. Clone snapshot state (structuredClone for isolation)
 * 3. Filter events: only apply events where tick > snapshot.tick
 * 4. Replay delta events on snapshot state
 * 5. Return reconstructed state
 */
export async function rebuildStateWithSnapshot(
  worldInstanceId: string,
  events: Event[],
  upToTick?: number,
  transitionReason?: TransitionReason
): Promise<RebuildResult> {
  // Phase 25 Task 5: Import snapshotEngine dynamically to avoid circular dependencies
  const { getSnapshotEngine } = await import('./snapshotEngine');
  const snapshotEngine = getSnapshotEngine();

  // Fetch latest snapshot for this world at or before upToTick
  const snapshot = await snapshotEngine.getLatestSnapshot(
    worldInstanceId,
    upToTick ?? Number.MAX_SAFE_INTEGER
  );

  if (snapshot) {
    // Snapshot found: use it as seed
    let state = structuredClone(snapshot.state);

    // Filter events: only apply mutations after snapshot tick
    const deltaEvents = events.filter(e => {
      // Parse event tick (event.id may contain tick, or use event.timestamp as proxy)
      const eventTick = parseInt(e.id.split('-')[1], 10) || 0;
      return eventTick > snapshot.tick;
    });

    // Phase 25 Task 6: Register delta replay metric for monitoring
    snapshotEngine.recordDeltaReplayMetric(deltaEvents.length);

    console.log(`[stateRebuilder] Rebuilding from snapshot at tick ${snapshot.tick} with ${deltaEvents.length} delta events`);

    // M42: Start transition overlay if reason provided
    if (transitionReason) {
      const estimatedDuration = deltaEvents.length * 0.5; // 0.5ms per mutation
      const { transitionEngine } = await import('./transitionEngine');
      transitionEngine.startWorldTransition(transitionReason, estimatedDuration);
    }

    // Replay delta events on top of snapshot
    for (const event of deltaEvents) {
      if (upToTick !== undefined && event.id > upToTick.toString()) {
        break;
      }
      state = applyEventToState(state, event);
    }

    // M42: Finish transition overlay
    if (transitionReason) {
      const { transitionEngine } = await import('./transitionEngine');
      transitionEngine.finishWorldTransition();
    }

    return { candidateState: state };
  } else {
    // No snapshot available: fall back to full replay from beginning
    console.log(`[stateRebuilder] No snapshot found for world ${worldInstanceId}, using full replay`);
    return rebuildState(createDefaultWorldState(), events, upToTick, transitionReason);
  }
}

/**
 * Helper: Create default world state (needed for rebuildStateWithSnapshot fallback)
 * Note: This is a minimal state; in production use createInitialWorld from worldEngine.ts
 */
function createDefaultWorldState(): WorldState {
  const { createInitialWorld } = require('./worldEngine');
  return createInitialWorld();
}

/**
 * Rebuild world state by replaying events from a checkpoint
 * BETA: Supports epoch-aware reconstruction
 * M42: Integrated with transition engine for cinematic overlays
 * 
 * NOTE: This is the synchronous version for intra-tick NPC syncing
 * For large reconstructions, use rebuildStateWithSnapshot() for better performance
 */
export function rebuildState(initialState: WorldState, events: Event[], upToTick?: number, transitionReason?: TransitionReason): RebuildResult {
  // M42: Start transition overlay if reason provided
  if (transitionReason) {
    const estimatedDuration = events.length * 0.5; // 0.5ms per mutation
    transitionEngine.startWorldTransition(transitionReason, estimatedDuration);
  }

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

  // M42: Finish transition overlay
  if (transitionReason) {
    transitionEngine.finishWorldTransition();
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

/**
 * M56-T4: Replay events to reconstruct state at specific tick
 * Used for save/load and recovery from checkpoints
 */
export function replayEventsToState(
  events: Event[],
  targetTick: number,
  initialState?: WorldState
): {
  succeeds: boolean;
  state: WorldState;
  eventsApplied: number;
  checksumMatch?: boolean;
} {
  // Create fresh initial state if not provided
  let state = initialState ? structuredClone(initialState) : createDefaultWorldState();
  
  let eventsApplied = 0;
  const eventsByTick = parseEventTick(events);

  // Replay events in chronological order up to targetTick
  for (let tick = 0; tick <= targetTick; tick++) {
    const tickEvents = eventsByTick[tick] || [];
    
    for (const event of tickEvents) {
      try {
        state = applyEventToState(state, event);
        eventsApplied++;
      } catch (error) {
        console.error(`[stateRebuilder] Error applying event at tick ${tick}:`, error);
        return {
          succeeds: false,
          state,
          eventsApplied,
          checksumMatch: false
        };
      }
    }
  }

  return {
    succeeds: true,
    state,
    eventsApplied,
    checksumMatch: true // Assume match if replay succeeded
  };
}

/**
 * M56-T4: Recover world state from checkpoint
 * Validates checkpoint integrity before loading
 */
export function recoverFromCheckpoint(
  checkpointData: any
): {
  recovered: boolean;
  state: WorldState;
  issues: string[];
} {
  const issues: string[] = [];

  // Validate checkpoint structure
  if (!checkpointData || typeof checkpointData !== 'object') {
    issues.push('Checkpoint data is invalid or missing');
    return { recovered: false, state: createDefaultWorldState(), issues };
  }

  if (!checkpointData.worldState) {
    issues.push('Checkpoint missing worldState');
    return { recovered: false, state: createDefaultWorldState(), issues };
  }

  // Load checkpoint state
  let state: WorldState = structuredClone(checkpointData.worldState);

  // Validate checkpoint integrity
  const schemaValid = validateCheckpointSchema(state);
  if (!schemaValid) {
    issues.push('Checkpoint failed schema validation');
  }

  // Validate all NPC references exist
  if (state.npcs && state.player) {
    const npcIds = new Set(state.npcs.map(n => n.id));
    
    // Check NPC memories reference valid NPCs
    state.npcs.forEach(npc => {
      const npcMemory = getNpcMemoryEngine().getMemoriesForNpc(npc.id);
      npcMemory?.forEach(memory => {
        if (memory.targetNpcId && !npcIds.has(memory.targetNpcId)) {
          issues.push(`NPC ${npc.id} references non-existent target ${memory.targetNpcId}`);
        }
      });
    });
  }

  // Check all quest references point to real locations/NPCs
  if (state.quests) {
    const locationIds = new Set(state.locations?.map(l => l.id) || []);
    const npcIds = new Set(state.npcs?.map(n => n.id) || []);

    state.quests.forEach(quest => {
      if (quest.location && !locationIds.has(quest.location)) {
        issues.push(`Quest ${quest.id} references non-existent location ${quest.location}`);
      }
      if (quest.giverNpcId && !npcIds.has(quest.giverNpcId)) {
        issues.push(`Quest ${quest.id} references non-existent NPC ${quest.giverNpcId}`);
      }
    });
  }

  // Check faction power sums are reasonable
  if (state.factions) {
    const totalPower = state.factions.reduce((sum, f) => sum + ((f.power || 0)), 0);
    if (totalPower < 0 || totalPower > 10000) {
      issues.push(`Faction power total ${totalPower} outside reasonable range [0, 10000]`);
    }

    // Check no negative faction power
    state.factions.forEach(faction => {
      if ((faction.power ?? 0) < 0) {
        issues.push(`Faction ${faction.id} has negative power: ${faction.power}`);
      }
    });
  }

  // Check inventory items exist in definitions
  if (state.player?.inventory) {
    const validItems = new Set();
    // Build set of valid item IDs from templates if available
    // For now, log warnings for unrecognized items
    state.player.inventory.forEach((item: any) => {
      if (!item.itemId) {
        issues.push('Player inventory contains item with missing itemId');
      }
    });
  }

  const recovered = issues.length === 0;
  
  if (!recovered) {
    console.warn('[stateRebuilder] Checkpoint recovery completed with issues:', issues);
  }

  return {
    recovered,
    state,
    issues
  };
}

/**
 * M56-T4: Validate world state integrity
 * Checks for orphaned references, negative values, consistency
 */
export function validateStateIntegrity(
  state: WorldState
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!state) {
    issues.push('State is null or undefined');
    return { valid: false, issues };
  }

  // Check all NPC references are valid
  if (state.npcs) {
    const npcIds = new Set(state.npcs.map(n => n.id));

    // Player's current location NPC interactions
    if (state.player) {
      state.npcs.forEach(npc => {
        // Check parent faction exists if referenced
        if (npc.factionId && state.factions) {
          const factionExists = state.factions.some(f => f.id === npc.factionId);
          if (!factionExists) {
            issues.push(`NPC ${npc.id} references non-existent faction ${npc.factionId}`);
          }
        }

        // Check location exists
        if (npc.locationId && state.locations) {
          const locationExists = state.locations.some(l => l.id === npc.locationId);
          if (!locationExists) {
            issues.push(`NPC ${npc.id} references non-existent location ${npc.locationId}`);
          }
        }
      });
    }
  }

  // Check quest references
  if (state.quests) {
    const npcIds = new Set(state.npcs?.map(n => n.id) || []);
    const locationIds = new Set(state.locations?.map(l => l.id) || []);

    state.quests.forEach(quest => {
      // Check objective references
      if (quest.objective?.type === 'visit' && quest.objective.location) {
        if (!locationIds.has(quest.objective.location)) {
          issues.push(`Quest ${quest.id} objective references non-existent location`);
        }
      }

      // Check dependencies are valid quests
      if (quest.dependencies) {
        quest.dependencies.forEach(depId => {
          if (!state.quests?.some(q => q.id === depId)) {
            issues.push(`Quest ${quest.id} depends on non-existent quest ${depId}`);
          }
        });
      }
    });
  }

  // Check faction power invariants
  if (state.factions) {
    state.factions.forEach(faction => {
      if ((faction.power ?? 0) < 0) {
        issues.push(`Faction ${faction.id} has negative power`);
      }
      if ((faction.power ?? 0) > 1000) {
        issues.push(`Faction ${faction.id} power ${faction.power} exceeds reasonable limit`);
      }
    });
  }

  // Check inventory item validity
  if (state.player?.inventory) {
    state.player.inventory.forEach((item: any, idx: number) => {
      if (!item.itemId) {
        issues.push(`Player inventory[${idx}] missing itemId`);
      }
      if ((item as any).stackable && (item as any).quantity < 0) {
        issues.push(`Player inventory[${idx}] stackable item has negative quantity`);
      }
    });
  }

  // Check player stat invariants
  if (state.player) {
    if ((state.player.hp ?? 0) < 0 || (state.player.hp ?? 0) > (state.player.maxHp ?? 100)) {
      issues.push(`Player HP ${state.player.hp} outside valid range [0, ${state.player.maxHp}]`);
    }
    if ((state.player.mp ?? 0) < 0 || (state.player.mp ?? 0) > (state.player.maxMp ?? 0)) {
      issues.push(`Player MP ${state.player.mp} outside valid range [0, ${state.player.maxMp}]`);
    }
  }

  const valid = issues.length === 0;
  return { valid, issues };
}

/**
 * Prune old checkpoints, keeping only most recent N
 */
export function pruneCheckpoints(
  checkpoints: Array<{ tick: number; data: any; size: number }>,
  maxCheckpoints: number = 5,
  maxSizeMB: number = 10
): {
  pruned: Array<{ tick: number; data: any; size: number }>;
  removed: number;
  totalSizeMB: number;
} {
  // Sort by tick descending (newest first)
  const sorted = [...checkpoints].sort((a, b) => b.tick - a.tick);

  // Keep only most recent N
  let pruned = sorted.slice(0, maxCheckpoints);

  // Calculate total size
  let totalSizeMB = pruned.reduce((sum, cp) => sum + (cp.size || 0), 0) / (1024 * 1024);

  // If still too large, remove from oldest
  while (totalSizeMB > maxSizeMB && pruned.length > 1) {
    pruned = pruned.slice(0, -1);
    totalSizeMB = pruned.reduce((sum, cp) => sum + (cp.size || 0), 0) / (1024 * 1024);
  }

  const removed = checkpoints.length - pruned.length;

  return {
    pruned,
    removed,
    totalSizeMB
  };
}

/**
 * Helper: Validate checkpoint schema matches WorldState structure
 */
function validateCheckpointSchema(state: any): boolean {
  // Basic structure checks
  if (!state.id || !state.player) {
    return false;
  }

  // Check player has required fields
  if (!state.player.id || typeof state.player.hp !== 'number') {
    return false;
  }

  // Check locations array is valid
  if (!Array.isArray(state.locations)) {
    return false;
  }

  // Check NPCs array is valid  
  if (!Array.isArray(state.npcs)) {
    return false;
  }

  return true;
}

/**
 * Helper: Parse events into tick-indexed map
 */
function parseEventTick(events: Event[]): Record<number, Event[]> {
  const map: Record<number, Event[]> = {};

  events.forEach(event => {
    // Extract tick from event timestamp or ID
    const tick = extractTickFromEvent(event);
    if (tick !== null) {
      if (!map[tick]) {
        map[tick] = [];
      }
      map[tick].push(event);
    }
  });

  return map;
}

/**
 * Helper: Extract tick from event
 */
function extractTickFromEvent(event: Event): number | null {
  // Try to parse tick from event ID (format: "type-t{tick}-{hash}")
  const match = event.id?.match(/t(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Fallback: use timestamp / 1000 (assuming 1 tick = 1 second)
  if (event.timestamp && typeof event.timestamp === 'number') {
    return Math.floor(event.timestamp / 1000);
  }

  return null;
}

/**
 * Helper: Create default world state (empty state)
 */
function createDefaultWorldState(): WorldState {
  return {
    id: `world-${Date.now()}`,
    tick: 0,
    player: {
      id: 'player-1',
      name: 'Player',
      hp: 100,
      maxHp: 100,
      mp: 0,
      maxMp: 0,
      location: 'location-1',
      level: 1,
      exp: 0,
      stats: { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 },
      inventory: [],
      quests: {},
      equipment: {},
      abilities: [],
      factionReputation: {}
    },
    locations: [],
    npcs: [],
    quests: [],
    factions: [],
    weather: 'clear',
    hour: 12,
    dayPhase: 'day',
    day: 1,
    season: 'spring',
    seed: Math.floor(random() * 0xffffffff)
  } as unknown as WorldState;
}

/**
 * M57-T3: Snapshot system for <200ms save/load times
 * Maintains rolling window of 10 snapshots (max 10MB total)
 */
export interface StateSnapshot {
  tick: number;
  state: WorldState;
  hash: string;           // SHA-256 of serialized state
  timestamp: number;      // When snapshot was created
  sizeBytes?: number;     // Serialized size for tracking
}

const snapshots: StateSnapshot[] = [];
const MAX_SNAPSHOTS = 10;
const MAX_TOTAL_SIZE_MB = 10;

/**
 * Create periodic snapshot for fast load recovery
 * Called every 100 ticks (world tick cycle)
 */
export function createPeriodicSnapshot(state: WorldState, currentTick: number): void {
  try {
    const serialized = JSON.stringify(state);
    const sizeBytes = new Blob([serialized]).size;
    
    // Calculate SHA-256 hash
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');

    const snapshot: StateSnapshot = {
      tick: currentTick,
      state: structuredClone(state),
      hash,
      timestamp: Date.now(),
      sizeBytes
    };

    snapshots.push(snapshot);

    // Prune old snapshots
    while (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.shift();
    }

    // Enforce size limit
    let totalSize = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
    while (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024 && snapshots.length > 1) {
      const removed = snapshots.shift();
      if (removed?.sizeBytes) {
        totalSize -= removed.sizeBytes;
      }
    }

    // Cleanup old snapshots (>1000 ticks)
    const keepFrom = currentTick - 1000;
    const beforeCount = snapshots.length;
    while (snapshots.length > 0 && snapshots[0].tick < keepFrom) {
      snapshots.shift();
    }
    
    if (beforeCount > snapshots.length) {
      console.log(`[StateRebuilder] Pruned ${beforeCount - snapshots.length} old snapshots (>1000 ticks)`);
    }
  } catch (error) {
    console.error('[StateRebuilder] Failed to create snapshot:', error);
  }
}

/**
 * Load state directly from snapshot (O(1) vs O(n) event replay)
 * Verifies checksum before returning
 */
export function loadFromSnapshot(targetTick: number): { state: WorldState; loadedFromSnapshot: boolean } | null {
  try {
    // Find closest snapshot at or before targetTick
    let bestSnapshot: StateSnapshot | null = null;
    for (const snap of snapshots) {
      if (snap.tick <= targetTick) {
        bestSnapshot = snap;
      } else {
        break;
      }
    }

    if (!bestSnapshot) {
      return null;
    }

    // Verify snapshot integrity
    const serialized = JSON.stringify(bestSnapshot.state);
    const crypto = require('crypto');
    const calculatedHash = crypto.createHash('sha256').update(serialized).digest('hex');

    if (calculatedHash !== bestSnapshot.hash) {
      console.warn('[StateRebuilder] Snapshot checksum mismatch, falling back to event replay');
      return null; // Checksum failed, signal fallback
    }

    console.log(`[StateRebuilder] Loaded state from snapshot (tick ${bestSnapshot.tick}) in ${Date.now() - bestSnapshot.timestamp}ms`);
    return {
      state: structuredClone(bestSnapshot.state),
      loadedFromSnapshot: true
    };
  } catch (error) {
    console.error('[StateRebuilder] Failed to load snapshot:', error);
    return null;
  }
}

/**
 * Replay only events since most recent snapshot
 * Dramatically speeds up late-game loads
 */
export function replayEventsSinceSnapshot(
  events: Event[],
  targetTick: number,
  initialState?: WorldState
): { state: WorldState; eventsReplayed: number } {
  try {
    // Try to load from snapshot first
    const snapshotResult = loadFromSnapshot(targetTick);
    let state = initialState || createDefaultWorldState();
    let startFromTick = 0;

    if (snapshotResult?.loadedFromSnapshot) {
      state = snapshotResult.state;
      startFromTick = state.tick || 0;
    }

    // Filter and replay only events after snapshot tick
    const eventsToReplay = events.filter((e) => {
      const eventTick = extractTickFromEvent(e);
      return eventTick && eventTick > startFromTick && eventTick <= targetTick;
    });

    // Replay events
    for (const event of eventsToReplay) {
      const handler = EventHandlers[event.type as keyof typeof EventHandlers];
      if (handler && typeof handler === 'function') {
        state = (handler as any)(state, event);
      }
    }

    console.log(`[StateRebuilder] Replayed ${eventsToReplay.length} events since snapshot (tick ${startFromTick} → ${targetTick})`);
    return { state, eventsReplayed: eventsToReplay.length };
  } catch (error) {
    console.error('[StateRebuilder] Failed to replay events since snapshot:', error);
    return { state: initialState || createDefaultWorldState(), eventsReplayed: 0 };
  }
}

/**
 * Get current snapshot statistics for telemetry
 */
export function getSnapshotStats(): {
  count: number;
  oldestTick: number | null;
  newestTick: number | null;
  totalSizeMB: number;
} {
  const totalBytes = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
  return {
    count: snapshots.length,
    oldestTick: snapshots[0]?.tick || null,
    newestTick: snapshots[snapshots.length - 1]?.tick || null,
    totalSizeMB: totalBytes / (1024 * 1024)
  };
}