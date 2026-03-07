/**
 * Faction AI Manager (Phase 3 Engine - Part 1)
 * 
 * Executes Phase 2 (World AI Drift) of the ResolutionStack.
 * Handles all autonomous faction actions, budget spending, and inter-faction conflicts.
 * 
 * Integrated into ResolutionStack.phase2_WorldAIDrift() during game tick.
 * 
 * DSS Rules Applied:
 * - DSS 04: Faction autonomy, action budgeting, social weight
 * - DSS 05: Territory influence and control mechanics
 * - DSS 06: Divine miracle execution
 * - DSS 16: Matriarchal social authority and lineage effects
 */

import type {
  ActiveFaction,
  ActionBudget,
  FactionAIState,
  SocialWeightClass,
  FactionRelationship,
} from '../types/factions';
import { FACTION_ACTION_TYPES } from '../types/factions';
import type { TerritoryNode } from '../types/geography';
import type { Deity } from '../types/divine';
import {
  calculateDailyBudgetGeneration,
  applySocialWeightModifier,
  canAffordAction,
  isActionOnCooldown,
} from '../types/factions';
import { getControlThreshold, updateTerritoryStability } from '../types/geography';

/**
 * Result of faction AI decision-making
 */
export interface FactionAIDecision {
  factionId: string;
  actionType: string;  // Key from FACTION_ACTION_TYPES
  targetId?: string;
  budgetCost: number;
  probability: number;  // Whether this action actually executes (0-1)
  rationale: string;
}

/**
 * Result of Phase 2 World AI Drift execution
 */
export interface Phase2WorldDriftResult {
  tick: number;
  factionDecisions: FactionAIDecision[];
  territoryInfluenceShifts: Array<{
    territoryId: string;
    factionId: string;
    influenceDelta: number;
  }>;
  conflictEvents: Array<{
    initiator: string;
    target: string;
    type: string;
    tick: number;
  }>;
  budgetUpdates: Array<{
    factionId: string;
    oldPoints: number;
    newPoints: number;
    delta: number;
  }>;
}

/**
 * Faction AI Manager: Autonomous faction decision-making
 */
export class FactionAIManager {
  private rng: { next(): number };

  constructor(rng?: { next(): number }) {
    this.rng = rng || { next: () => Math.random() };
  }

  /**
   * Execute Phase 2: World AI Drift for all factions
   * 
   * Called during ResolutionStack.phase2_WorldAIDrift()
   * 
   * Process:
   * 1. Regenerate all faction action budgets
   * 2. Recalculate faction AI states based on world events from Phase 1
   * 3. Make strategic decisions (expand, defend, negotiate, attack)
   * 4. Execute affordable actions
   * 5. Update territory influence based on actions
   * 6. Return list of events for UI and Phase 5 processing
   */
  async processFactionTurn(
    factions: ActiveFaction[],
    territories: Map<string, TerritoryNode>,
    relationships: Map<string, FactionRelationship>,
    deities: Map<string, Deity>,
    worldStability: number,
    currentTick: number
  ): Promise<Phase2WorldDriftResult> {
    const result: Phase2WorldDriftResult = {
      tick: currentTick,
      factionDecisions: [],
      territoryInfluenceShifts: [],
      conflictEvents: [],
      budgetUpdates: [],
    };

    // Process each faction
    for (const faction of factions) {
      // Step 1: Regenerate budget
      this.regenerateActionBudget(faction, worldStability, currentTick);

      // Record budget update
      result.budgetUpdates.push({
        factionId: faction.id,
        oldPoints: faction.actionBudget.currentPoints - this.calculateBudgetRegen(faction, worldStability),
        newPoints: faction.actionBudget.currentPoints,
        delta: this.calculateBudgetRegen(faction, worldStability),
      });

      // Step 2: Update AI state
      this.updateFactionAIState(faction, factions, territories, relationships, currentTick);

      // Step 3: Make strategic decisions
      let decidedActions = this.decideFactionActions(
        faction,
        factions,
        territories,
        relationships,
        deities,
        currentTick
      );

      // Step 4: Execute actions and record outcomes
      for (const decision of decidedActions) {
        // Check if affordable and on-cooldown
        if (!canAffordAction(faction.actionBudget, decision.actionType)) {
          continue;  // Can't afford
        }

        if (isActionOnCooldown(faction.actionBudget, decision.actionType, currentTick)) {
          continue;  // On cooldown
        }

        // Resolve RNG (some actions are probabilistic)
        if (this.rng.next() > decision.probability) {
          continue;  // Failed random check
        }

        // Execute action
        this.executeAction(
          faction,
          decision,
          territories,
          relationships,
          currentTick,
          result
        );

        result.factionDecisions.push(decision);
      }
    }

    return result;
  }

  /**
   * Regenerate faction action budget based on:
   * - Territory control (+10 per location)
   * - Active covenants
   * - Divine faith
   * - World stability
   * - Social weight modifier (DSS 16)
   */
  private regenerateActionBudget(
    faction: ActiveFaction,
    worldStability: number,
    currentTick: number
  ): void {
    const regen = this.calculateBudgetRegen(faction, worldStability);

    faction.actionBudget.currentPoints = Math.min(
      faction.actionBudget.maxCapacity,
      faction.actionBudget.currentPoints + regen
    );

    faction.actionBudget.lastRegenTick = currentTick;

    // Update breakdown
    faction.actionBudget.generationBreakdown = {
      territoryControl: faction.controlledLocationIds.length * 10,
      covenantParticipation: faction.activeCovenants.length * 5,
      divineFaith: Math.floor(faction.faithMassInDeity * 2),
      factionCharism: faction.charismaBonus * 0.5,
      stability: Math.floor(worldStability * 40),
      socialWeight: (faction.actionBudget.generationBreakdown.socialWeight || 0),
    };
  }

  /**
   * Calculate daily budget regeneration amount
   */
  private calculateBudgetRegen(faction: ActiveFaction, worldStability: number): number {
    const base = calculateDailyBudgetGeneration({
      controlledLocations: faction.controlledLocationIds.length,
      activeCovenantCount: faction.activeCovenants.length,
      divineFaith: faction.faithMassInDeity,
      factionChaBonus: faction.charismaBonus,
      worldStability,
      leaderSocialWeight: faction.leaderSocialWeight,
    });

    return Math.floor(base / 2400);  // Divide by ticks per day for per-tick regen
  }

  /**
   * Update faction AI state based on world conditions
   */
  private updateFactionAIState(
    faction: ActiveFaction,
    allFactions: ActiveFaction[],
    territories: Map<string, TerritoryNode>,
    relationships: Map<string, FactionRelationship>,
    currentTick: number
  ): void {
    const aiState = faction.aiState;

    // Assess threats from other factions
    for (const other of allFactions) {
      if (other.id === faction.id) continue;

      let threatLevel = 0;

      // Is this faction a military rival?
      const rel = relationships.get(`${faction.id}-${other.id}`);
      if (rel?.isHostile) {
        threatLevel += 40;
      }

      // How many territories do they control nearby?
      const nearbyThreats = Array.from(territories.values()).filter(
        t =>
          t.controllingFactionId === other.id &&
          faction.controlledLocationIds.some(
            ownId => {
              const ownTerritory = territories.get(ownId);
              return ownTerritory && ownTerritory.connectedLocationIds.includes(t.id);
            }
          )
      ).length;

      threatLevel += nearbyThreats * 15;

      aiState.threatAssessment.set(other.id, Math.min(100, threatLevel));
    }

    // Calculate military confidence based on territory and garrison
    let militaryStrength = 0;
    for (const territoryId of faction.controlledLocationIds) {
      const territory = territories.get(territoryId);
      if (!territory) continue;
      militaryStrength += territory.fortificationLevel * 10;
      militaryStrength += territory.garrisonSize / 10;
    }
    aiState.militaryConfidence = Math.min(100, militaryStrength);

    // Calculate diplomacy reputation (average from social record)
    const reputations = Array.from(aiState.threatAssessment.values());
    aiState.diplomacyReputation = reputations.length > 0
      ? reputations.reduce((a, b) => a + b, 0) / reputations.length - 50
      : 0;

    // Determine state based on conditions
    if (aiState.militaryConfidence > 70 && aiState.threatAssessment.size > 0) {
      aiState.state = 'aggressive';
    } else if (Math.max(...aiState.threatAssessment.values()) > 60) {
      aiState.state = 'defensive';
    } else if (faction.controlledLocationIds.length < 3) {
      aiState.state = 'aggressive';  // Try to expand
    } else {
      aiState.state = 'diplomatic';
    }

    aiState.lastDecisionTick = currentTick;
  }

  /**
   * Decide which actions faction should take
   * 
   * Decision-making based on:
   * - Current AI state (aggressive/defensive/diplomatic)
   * - Available budget
   * - Strategic objectives
   * - Threat assessments
   */
  private decideFactionActions(
    faction: ActiveFaction,
    allFactions: ActiveFaction[],
    territories: Map<string, TerritoryNode>,
    relationships: Map<string, FactionRelationship>,
    deities: Map<string, Deity>,
    currentTick: number
  ): FactionAIDecision[] {
    const decisions: FactionAIDecision[] = [];

    // If dormant, decide whether to activate
    if (faction.aiState.state === 'dormant') {
      if (this.rng.next() > 0.8) {
        faction.aiState.state = 'diplomatic';
      } else {
        return decisions;
      }
    }

    // Strategy 1: Aggressive - seek territory expansion
    if (faction.aiState.state === 'aggressive') {
      const expandTargets = this.getExpansionTargets(faction, territories, allFactions);

      for (const target of expandTargets.slice(0, 2)) {
        // Try to conquer or skirmish
        const canConquer = this.canConquerTerritory(faction, target, territories, allFactions);

        if (canConquer && canAffordAction(faction.actionBudget, 'CONQUER_TERRITORY')) {
          decisions.push({
            factionId: faction.id,
            actionType: 'CONQUER_TERRITORY',
            targetId: target.id,
            budgetCost: 50,
            probability: 0.7,
            rationale: `Expanding into ${target.name}`,
          });
        } else if (canAffordAction(faction.actionBudget, 'SKIRMISH')) {
          decisions.push({
            factionId: faction.id,
            actionType: 'SKIRMISH',
            targetId: target.id,
            budgetCost: 20,
            probability: 0.6,
            rationale: `Testing defenses of ${target.name}`,
          });
        }
      }
    }

    // Strategy 2: Defensive - fortify and defend
    if (faction.aiState.state === 'defensive') {
      const underAttack = Array.from(territories.values()).filter(
        t =>
          t.controllingFactionId === faction.id &&
          Array.from(t.influenceMap.values()).some(inf => inf > 30 && inf < 60)
      );

      for (const territory of underAttack.slice(0, 1)) {
        decisions.push({
          factionId: faction.id,
          actionType: 'FORTIFY',
          targetId: territory.id,
          budgetCost: 30,
          probability: 0.9,
          rationale: `Defending ${territory.name} from threats`,
        });
      }
    }

    // Strategy 3: Diplomatic - build relationships
    if (faction.aiState.state === 'diplomatic' && this.rng.next() > 0.6) {
      const potentialAllies = allFactions.filter(
        f =>
          f.id !== faction.id &&
          !relationships.get(`${faction.id}-${f.id}`)?.isHostile
      );

      if (potentialAllies.length > 0) {
        const ally = potentialAllies[Math.floor(this.rng.next() * potentialAllies.length)];

        if (canAffordAction(faction.actionBudget, 'NEGOTIATE_ALLIANCE')) {
          decisions.push({
            factionId: faction.id,
            actionType: 'NEGOTIATE_ALLIANCE',
            targetId: ally.id,
            budgetCost: 15,
            probability: 0.5,
            rationale: `Proposing alliance with ${ally.name}`,
          });
        }
      }
    }

    // Strategy 4: Economic - trade and production
    if (this.rng.next() > 0.7) {
      if (canAffordAction(faction.actionBudget, 'TRADE_CARAVAN')) {
        decisions.push({
          factionId: faction.id,
          actionType: 'TRADE_CARAVAN',
          budgetCost: 25,
          probability: 0.8,
          rationale: 'Establishing trade routes',
        });
      }
    }

    // Strategy 5: Divine - if aligned with deity and have faith
    if (faction.patronDeityId && faction.faithMassInDeity > 100) {
      const deity = deities.get(faction.patronDeityId);
      if (deity?.canGrantMiracles && this.rng.next() > 0.85) {
        decisions.push({
          factionId: faction.id,
          actionType: 'DIVINE_MIRACLE',
          budgetCost: 100,
          probability: 0.3,
          rationale: `Requesting miracle from ${deity.name}`,
        });
      }
    }

    return decisions;
  }

  /**
   * Find territories this faction should try to expand into
   */
  private getExpansionTargets(
    faction: ActiveFaction,
    territories: Map<string, TerritoryNode>,
    allFactions: ActiveFaction[]
  ): TerritoryNode[] {
    const targets: TerritoryNode[] = [];
    const threshold = getControlThreshold(
      Array.from(territories.values())[0],  // Generic territory for threshold
      50
    );

    for (const territory of territories.values()) {
      if (territory.controllingFactionId === faction.id) {
        continue;  // Already controlled
      }

      // Check adjacent territories
      const isAdjacent = faction.controlledLocationIds.some(ownId => {
        const ownTerritory = territories.get(ownId);
        return ownTerritory?.connectedLocationIds.includes(territory.id);
      });

      if (!isAdjacent) continue;

      // Check if favorable
      const myInfluence = territory.influenceMap.get(faction.id) || 0;
      if (myInfluence > threshold * 0.7) {
        targets.push(territory);
      }
    }

    return targets.sort((a, b) => (b.influenceMap.get(faction.id) || 0) - (a.influenceMap.get(faction.id) || 0));
  }

  /**
   * Check if faction can conquer a territory
   */
  private canConquerTerritory(
    faction: ActiveFaction,
    territory: TerritoryNode,
    territories: Map<string, TerritoryNode>,
    allFactions: ActiveFaction[]
  ): boolean {
    const threshold = getControlThreshold(territory);
    const myInfluence = territory.influenceMap.get(faction.id) || 0;

    // Need influence above threshold AND military superiority
    const militaryScore = faction.aiState.militaryConfidence;
    const defenderScore = 50;  // TODO: Calculate from territory garrison

    return myInfluence > threshold && militaryScore > defenderScore;
  }

  /**
   * Execute a faction action and update world state
   */
  private executeAction(
    faction: ActiveFaction,
    decision: FactionAIDecision,
    territories: Map<string, TerritoryNode>,
    relationships: Map<string, FactionRelationship>,
    currentTick: number,
    result: Phase2WorldDriftResult
  ): void {
    // Deduct from budget
    faction.actionBudget.currentPoints -= decision.budgetCost;

    // Set cooldown
    const actionConfig = FACTION_ACTION_TYPES[decision.actionType as keyof typeof FACTION_ACTION_TYPES];
    if (actionConfig) {
      faction.actionBudget.actionCooldowns.set(
        decision.actionType,
        currentTick + actionConfig.cooldownTicks
      );
    }

    // Process action effects
    switch (decision.actionType) {
      case 'CONQUER_TERRITORY':
        if (decision.targetId) {
          const territory = territories.get(decision.targetId);
          if (territory) {
            // Increase influence dramatically
            const currentInfluence = territory.influenceMap.get(faction.id) || 0;
            territory.influenceMap.set(faction.id, Math.min(100, currentInfluence + 25));

            result.territoryInfluenceShifts.push({
              territoryId: territory.id,
              factionId: faction.id,
              influenceDelta: 25,
            });
          }
        }
        break;

      case 'SKIRMISH':
        if (decision.targetId) {
          const territory = territories.get(decision.targetId);
          if (territory) {
            const currentInfluence = territory.influenceMap.get(faction.id) || 0;
            territory.influenceMap.set(faction.id, Math.min(100, currentInfluence + 10));

            result.territoryInfluenceShifts.push({
              territoryId: territory.id,
              factionId: faction.id,
              influenceDelta: 10,
            });

            result.conflictEvents.push({
              initiator: faction.id,
              target: territory.controllingFactionId || 'neutral',
              type: 'skirmish',
              tick: currentTick,
            });
          }
        }
        break;

      case 'FORTIFY':
        if (decision.targetId) {
          const territory = territories.get(decision.targetId);
          if (territory) {
            territory.fortificationLevel = Math.min(5, territory.fortificationLevel + 1);
            updateTerritoryStability(territory, 5, currentTick);  // +5 stability
          }
        }
        break;

      // Additional action types would be handled similarly
    }

    faction.lastActionTick = currentTick;
  }
}

/**
 * Helper function: Create FactionAIManager
 */
export function createFactionAIManager(rng?: { next(): number }): FactionAIManager {
  return new FactionAIManager(rng);
}
