/**
 * factionCommandEngine.ts - M51-A1: Faction Strategic Command System
 * 
 * Implements Merit currency system and faction strategy directives that override
 * NPC personality goals, allowing players to surgically reshape faction behavior.
 */

import type { WorldState, NPC } from './worldEngine';
import type { Faction } from './factionEngine';
import { Event } from '../events/mutationLog';

export type FactionStrategy = 'CONQUEST' | 'ESPIONAGE' | 'ISOLATIONISM';

export interface StrategyModifier {
  personality: Record<string, number>;  // Trait adjustments (boldness, caution, etc.)
  goalWeights: Record<string, number>;  // GOAP goal bias modifiers
  movementBias?: 'border' | 'defensive' | 'scattered';
}

const STRATEGY_MODIFIERS: Record<FactionStrategy, StrategyModifier> = {
  CONQUEST: {
    personality: { boldness: 30, ambition: 25, caution: -20 },
    goalWeights: { explore: 1.5, combat: 2.0, gather: 0.8 },
    movementBias: 'border'  // NPCs cluster near territorial borders
  },

  ESPIONAGE: {
    personality: { sociability: 25, caution: 20, honesty: -30 },
    goalWeights: { socialize: 2.0, gather: 1.8, explore: 1.2, combat: 0.5 },
    movementBias: 'scattered'  // Spread across regions for intelligence
  },

  ISOLATIONISM: {
    personality: { caution: 30, boldness: -20, curiosity: -25 },
    goalWeights: { rest: 1.5, gather: 1.3, explore: 0.3, combat: 0.2 },
    movementBias: 'defensive'  // Cluster around home base
  }
};

/**
 * M51-A1: Award merit to player for significant deeds
 * Deeds worth merit: faction defeats, legendary battles, rumor confirmations
 */
export function awardMerit(
  state: WorldState,
  mobileAmount: number,
  reason: string
): { newMerit: number; event: Event } {
  const newMerit = (state.player?.merit || 0) + mobileAmount;

  const event: Event = {
    id: `merit-award-${Date.now()}`,
    worldInstanceId: state.id,
    actorId: 'system',
    type: 'MERIT_AWARDED',
    payload: {
      amount: mobileAmount,
      reason,
      newTotal: newMerit
    },
    timestamp: Date.now()
  };

  return { newMerit, event };
}

/**
 * M51-A1: Check if player has sufficient merit for faction command
 */
export function canIssueFactionCommand(state: WorldState, strategyCost: number = 50): boolean {
  return (state.player?.merit || 0) >= strategyCost;
}

/**
 * M51-A1: Issue a strategic command to a faction (costs Merit)
 * @param state - Current world state
 * @param factionId - Target faction
 * @param strategy - CONQUEST, ESPIONAGE, or ISOLATIONISM
 * @param merritCost - Merit points to spend (default 50)
 */
export function issueFactionCommand(
  state: WorldState,
  factionId: string,
  strategy: FactionStrategy,
  meritCost: number = 50
): {
  success: boolean;
  newMerit: number;
  events: Event[];
  faction?: Faction;
} {
  const events: Event[] = [];

  // Check merit availability
  if ((state.player?.merit || 0) < meritCost) {
    return {
      success: false,
      newMerit: state.player?.merit || 0,
      events: [{
        id: `command-failed-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'system',
        type: 'FACTION_COMMAND_INSUFFICIENT_MERIT',
        payload: { required: meritCost, available: state.player?.merit || 0 },
        timestamp: Date.now()
      }]
    };
  }

  // Find faction
  const faction = state.factions?.find(f => f.id === factionId);
  if (!faction) {
    return {
      success: false,
      newMerit: state.player?.merit || 0,
      events: [{
        id: `command-failed-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'system',
        type: 'FACTION_COMMAND_NOT_FOUND',
        payload: { factionId },
        timestamp: Date.now()
      }]
    };
  }

  const newMerit = (state.player?.merit || 0) - meritCost;

  // Register command on faction
  faction.playerStrategy = strategy;

  // Emit command event
  const commandEvent: Event = {
    id: `faction-command-${factionId}-${Date.now()}`,
    worldInstanceId: state.id,
    actorId: 'player',
    type: 'FACTION_COMMAND_ISSUED',
    payload: {
      factionId,
      factionName: faction.name,
      strategy,
      meritSpent: meritCost,
      playerMeritRemaining: newMerit
    },
    timestamp: Date.now()
  };
  events.push(commandEvent);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[FactionCommand] ${faction.name} ordered to ${strategy} (cost: ${meritCost} merit)`);
  }

  return { success: true, newMerit, events, faction };
}

/**
 * M51-A1: Apply faction strategy modifiers to NPC personality during GOAP planning
 */
export function applyStrategyModifierToNpc(npc: NPC, faction: Faction): NPC {
  if (!faction.playerStrategy) return npc;

  const strategy = faction.playerStrategy;
  const modifier = STRATEGY_MODIFIERS[strategy];

  const updatedNpc = structuredClone(npc);

  // Apply personality trait adjustments
  if (!updatedNpc.personality) {
    updatedNpc.personality = {
      boldness: 50, caution: 50, sociability: 50,
      ambition: 50, curiosity: 50, honesty: 50
    };
  }

  for (const [trait, adjustment] of Object.entries(modifier.personality)) {
    if (trait in updatedNpc.personality) {
      (updatedNpc.personality as any)[trait] = Math.max(
        0,
        Math.min(100, (updatedNpc.personality as any)[trait] + adjustment)
      );
    }
  }

  // Store goal weight overrides for GOAP planner to use
  (updatedNpc as any).strategyGoalWeights = modifier.goalWeights;
  (updatedNpc as any).strategyMovementBias = modifier.movementBias;

  return updatedNpc;
}

/**
 * M51-A1: Calculate merit rewards for various achievements
 */
export function calculateMeritReward(achievementType: string): number {
  const rewards: Record<string, number> = {
    'FACTION_SKIRMISH_VICTORY': 25,      // Win a territorial battle
    'LEGENDARY_DEED': 40,                 // Complete impossible task
    'RUMOR_CONFIRMED': 15,                // Verify false information
    'INVESTIGATION_COMPLETED': 30,        // Solve mystery chain
    'MACRO_EVENT_SURVIVED': 20,           // Endure world catastrophe
    'ECHO_BONDED': 35,                    // Connect with soul echo
    'FACTION_BETRAYAL_EXPOSED': 50        // Reveal faction treachery
  };

  return rewards[achievementType] || 10;
}

/**
 * M51-A1: List all active faction commands with remaining duration
 */
export function getActiveFactionCommands(
  state: WorldState
): Array<{
  factionId: string;
  factionName: string;
  strategy: FactionStrategy;
  appliedAt: number;
  durationTicks: number;
}> {
  if (!state.player?.factionCommands) return [];

  return Object.entries(state.player.factionCommands).map(([factionId, command]) => {
    const faction = state.factions?.find(f => f.id === factionId);
    return {
      factionId,
      factionName: faction?.name || factionId,
      strategy: command.strategy,
      appliedAt: command.appliedAt,
      durationTicks: (state.tick || 0) - command.appliedAt
    };
  });
}

/**
 * M51-A1: Cancel a faction command (no merit refund)
 */
export function cancelFactionCommand(state: WorldState, factionId: string): boolean {
  if (!state.player?.factionCommands?.[factionId]) return false;

  const faction = state.factions?.find(f => f.id === factionId);
  if (faction) {
    faction.playerStrategy = undefined;
  }

  delete state.player.factionCommands[factionId];
  return true;
}

export const FactionCommandEngineExports = {
  awardMerit,
  canIssueFactionCommand,
  issueFactionCommand,
  applyStrategyModifierToNpc,
  calculateMeritReward,
  getActiveFactionCommands,
  cancelFactionCommand,
  STRATEGY_MODIFIERS
};
