/**
 * M46-C1: NPC Goal-Oriented Action Planning (GOAP) Engine
 * 
 * Purpose: Give NPCs autonomous goals and let them plan actions to achieve them.
 * 
 * Core Philosophy:
 * - NPCs have goals (Accumulate Wealth, Spread Faith, Fortify Borders, Build Relationships, Gain Power)
 * - Each goal has preconditions and expected outcomes
 * - GOAP planner finds action sequences to achieve goals
 * - Actions are constrained by economy, faction rules, and NPC capabilities
 * - World state changes when NPCs execute their plans
 */

import type { WorldState, NPC } from './worldEngine';

/**
 * A goal an NPC can have
 */
export interface NpcGoal {
  id: string;
  type: 'wealth' | 'faith' | 'border' | 'relationship' | 'power' | 'discovery';
  priority: number; // 0-100, higher = more important
  targetValue: number; // Goal-specific (gold amount, faith level, border control %, etc.)
  currentValue: number; // How close are we to the goal?
  deadline?: number; // World tick when goal expires
  weight: number; // How much this NPC cares (influences action selection)
  status: 'inactive' | 'active' | 'completed' | 'failed' | 'abandoned';
}

/**
 * An action an NPC can take toward a goal
 */
export interface NpcAction {
  id: string;
  type: 'trade' | 'preach' | 'scout' | 'recruit' | 'negotiate' | 'sabotage' | 'research' | 'build';
  goal: string; // Which goal does this serve?
  targetNpcId?: string; // If social action
  targetLocationId?: string; // If location-based
  targetFactionId?: string; // If faction-related
  
  // Preconditions: what must be true for this action
  preconditions: {
    minGold?: number;
    minFaith?: number;
    minPower?: number;
    requiredFactionRelationship?: number;
  };
  
  // Effects: what happens if action succeeds
  effects: {
    goldDelta?: number;
    faithDelta?: number;
    powerDelta?: number;
    relationshipDelta?: Record<string, number>; // NPC ID -> reputation change
  };
  
  // Execution
  successProbability: number; // 0-1
  costInTicks: number; // How many world ticks to execute
  maxUses?: number; // How many times can this be used?
  usedCount?: number;
}

/**
 * A plan: sequence of actions to achieve a goal
 */
export interface ActionPlan {
  id: string;
  npcId: string;
  goalId: string;
  actions: NpcAction[]; // Ordered sequence
  estimatedCost: number; // Total ticks to execute
  estimatedSuccess: number; // Probability of success (0-1)
  startedAt?: number;
  executingStep: number; // Which action in sequence are we on?
  status: 'planned' | 'executing' | 'completed' | 'failed';
}

/**
 * NPC personality traits that influence goal prioritization
 */
export interface NpcPersonality {
  greediness: number; // 0-1: preference for wealth goals
  piety: number; // 0-1: preference for faith goals
  ambition: number; // 0-1: preference for power goals
  loyalty: number; // 0-1: how much they stick to plans vs jumping to new goals
  risk: number; // 0-1: willingness to take risky actions
  sociability: number; // 0-1: preference for relationship goals
}

class GoalOrientedPlanner {
  private npcGoals: Map<string, NpcGoal[]> = new Map(); // NPC ID -> their goals
  private actionPlans: Map<string, ActionPlan[]> = new Map(); // NPC ID -> their plans
  private npcPersonalities: Map<string, NpcPersonality> = new Map(); // NPC ID -> personality
  private globalActionLibrary: NpcAction[] = [];

  constructor() {
    this.initializeActionLibrary();
  }

  /**
   * Initialize library of all possible NPC actions
   */
  private initializeActionLibrary(): void {
    this.globalActionLibrary = [
      // Wealth-focused actions
      {
        id: 'action_trade',
        type: 'trade',
        goal: 'wealth',
        preconditions: { minGold: 100 },
        effects: { goldDelta: 50 },
        successProbability: 0.8,
        costInTicks: 100
      },
      {
        id: 'action_sell_loot',
        type: 'trade',
        goal: 'wealth',
        preconditions: {},
        effects: { goldDelta: 150 },
        successProbability: 0.95,
        costInTicks: 50,
        maxUses: 3
      },
      // Faith-focused actions
      {
        id: 'action_preach',
        type: 'preach',
        goal: 'faith',
        preconditions: { minFaith: 20 },
        effects: { faithDelta: 30 },
        successProbability: 0.6,
        costInTicks: 200
      },
      {
        id: 'action_build_shrine',
        type: 'build',
        goal: 'faith',
        preconditions: { minGold: 500, minFaith: 50 },
        effects: { goldDelta: -500, faithDelta: 100, powerDelta: 10 },
        successProbability: 0.7,
        costInTicks: 500,
        maxUses: 1
      },
      // Border/Power-focused actions
      {
        id: 'action_scout',
        type: 'scout',
        goal: 'power',
        preconditions: {},
        effects: { powerDelta: 15 },
        successProbability: 0.75,
        costInTicks: 150
      },
      {
        id: 'action_recruit',
        type: 'recruit',
        goal: 'power',
        preconditions: { minGold: 200 },
        effects: { goldDelta: -200, powerDelta: 40 },
        successProbability: 0.65,
        costInTicks: 200
      },
      {
        id: 'action_negotiate',
        type: 'negotiate',
        goal: 'relationship',
        preconditions: {},
        effects: { relationshipDelta: { 'other_npc': 20 } },
        successProbability: 0.5,
        costInTicks: 100
      },
      // Multi-goal actions
      {
        id: 'action_research',
        type: 'research',
        goal: 'discovery',
        preconditions: { minGold: 50 },
        effects: { goldDelta: -50, powerDelta: 20, faithDelta: 10 },
        successProbability: 0.7,
        costInTicks: 300
      }
    ];
  }

  /**
   * Initialize goals for an NPC based on their personality
   */
  initializeGoalsForNpc(
    npcId: string,
    personality: NpcPersonality,
    currentTick: number
  ): NpcGoal[] {
    const goals: NpcGoal[] = [];

    // Wealth goal (if greedy)
    if (personality.greediness > 0.3) {
      goals.push({
        id: `goal_wealth_${npcId}`,
        type: 'wealth',
        priority: Math.floor(personality.greediness * 100),
        targetValue: 1000,
        currentValue: 100, // Start with base amount
        weight: personality.greediness,
        status: 'active'
      });
    }

    // Faith goal (if pious)
    if (personality.piety > 0.3) {
      goals.push({
        id: `goal_faith_${npcId}`,
        type: 'faith',
        priority: Math.floor(personality.piety * 100),
        targetValue: 100,
        currentValue: 20,
        weight: personality.piety,
        status: 'active'
      });
    }

    // Power goal (if ambitious)
    if (personality.ambition > 0.3) {
      goals.push({
        id: `goal_power_${npcId}`,
        type: 'power',
        priority: Math.floor(personality.ambition * 100),
        targetValue: 200,
        currentValue: 50,
        weight: personality.ambition,
        status: 'active'
      });
    }

    // Relationship goal (if social)
    if (personality.sociability > 0.3) {
      goals.push({
        id: `goal_relationship_${npcId}`,
        type: 'relationship',
        priority: Math.floor(personality.sociability * 100),
        targetValue: 50,
        currentValue: 10,
        weight: personality.sociability,
        status: 'active'
      });
    }

    this.npcGoals.set(npcId, goals);
    this.npcPersonalities.set(npcId, personality);

    return goals;
  }

  /**
   * Plan actions for an NPC to achieve their highest priority goal
   */
  planActionsForNpc(
    npcId: string,
    npc: NPC,
    state: WorldState,
    currentTick: number,
    plannerMaxSteps: number = 5
  ): ActionPlan {
    const goals = this.npcGoals.get(npcId) || [];
    const personality = this.npcPersonalities.get(npcId);

    if (goals.length === 0 || !personality) {
      return {
        id: `plan_${npcId}_empty`,
        npcId,
        goalId: '',
        actions: [],
        estimatedCost: 0,
        estimatedSuccess: 0,
        executingStep: 0,
        status: 'failed'
      };
    }

    // Find highest priority active goal
    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length === 0) {
      return {
        id: `plan_${npcId}_no_active`,
        npcId,
        goalId: '',
        actions: [],
        estimatedCost: 0,
        estimatedSuccess: 0,
        executingStep: 0,
        status: 'failed'
      };
    }

    const targetGoal = activeGoals.reduce((best, current) =>
      current.priority > best.priority ? current : best
    );

    // Find actions that lead to this goal
    const applicableActions = this.globalActionLibrary.filter(
      action => action.goal === targetGoal.type
    );

    // Plan: greedy selection of actions (could be enhanced with A* search)
    const selectedActions: NpcAction[] = [];
    let totalCost = 0;
    let totalSuccessProb = 1.0;

    for (let i = 0; i < Math.min(plannerMaxSteps, applicableActions.length); i++) {
      const action = applicableActions[i];

      // Check if action's preconditions are met
      if (this.canExecuteAction(action, npc, state)) {
        selectedActions.push(action);
        totalCost += action.costInTicks;
        totalSuccessProb *= action.successProbability;
      }
    }

    const plan: ActionPlan = {
      id: `plan_${npcId}_${targetGoal.id}_${currentTick}`,
      npcId,
      goalId: targetGoal.id,
      actions: selectedActions,
      estimatedCost: totalCost,
      estimatedSuccess: totalSuccessProb,
      executingStep: 0,
      status: selectedActions.length > 0 ? 'planned' : 'failed'
    };

    // Store or replace existing plan
    if (!this.actionPlans.has(npcId)) {
      this.actionPlans.set(npcId, []);
    }
    this.actionPlans.get(npcId)!.push(plan);

    return plan;
  }

  /**
   * Check if NPC can execute an action (preconditions met)
   */
  private canExecuteAction(
    action: NpcAction,
    npc: NPC,
    state: WorldState
  ): boolean {
    // Check gold requirement
    if (action.preconditions.minGold && (state.player.gold || 0) < action.preconditions.minGold) {
      return false;
    }

    // Check max uses
    if (action.maxUses && (action.usedCount || 0) >= action.maxUses) {
      return false;
    }

    return true;
  }

  /**
   * Execute next step in a plan
   */
  executeActionStep(
    planId: string,
    npcId: string,
    npc: NPC,
    currentTick: number
  ): {
    success: boolean;
    effectsApplied: any;
    nextStepIndex: number;
  } {
    const plans = this.actionPlans.get(npcId) || [];
    const plan = plans.find(p => p.id === planId);

    if (!plan || plan.status !== 'executing') {
      return { success: false, effectsApplied: {}, nextStepIndex: 0 };
    }

    const currentAction = plan.actions[plan.executingStep];
    if (!currentAction) {
      plan.status = 'completed';
      return { success: true, effectsApplied: {}, nextStepIndex: plan.executingStep };
    }

    // Roll for success
    const succeeds = Math.random() < currentAction.successProbability;

    if (succeeds) {
      // Apply effects to NPC
      if (currentAction.effects.goldDelta) {
        npc.gold = (npc.gold || 0) + currentAction.effects.goldDelta;
      }
      if (currentAction.effects.powerDelta) {
        npc.power = (npc.power || 0) + currentAction.effects.powerDelta;
      }

      // Track usage
      if (currentAction.maxUses) {
        currentAction.usedCount = (currentAction.usedCount || 0) + 1;
      }

      plan.executingStep++;

      if (plan.executingStep >= plan.actions.length) {
        plan.status = 'completed';
      }

      return {
        success: true,
        effectsApplied: currentAction.effects,
        nextStepIndex: plan.executingStep
      };
    } else {
      // Action failed
      plan.status = 'failed';
      return { success: false, effectsApplied: {}, nextStepIndex: plan.executingStep };
    }
  }

  /**
   * Get current plan for an NPC
   */
  getCurrentPlan(npcId: string): ActionPlan | null {
    const plans = this.actionPlans.get(npcId) || [];
    const executingPlans = plans.filter(p => p.status === 'executing');
    if (executingPlans.length > 0) {
      return executingPlans[0];
    }
    return plans[plans.length - 1] || null;
  }

  /**
   * Update NPC goals based on world state changes
   */
  updateGoalsForNpc(
    npcId: string,
    npc: NPC,
    state: WorldState,
    currentTick: number
  ): void {
    const goals = this.npcGoals.get(npcId) || [];

    for (const goal of goals) {
      // Update current values based on world state
      switch (goal.type) {
        case 'wealth':
          goal.currentValue = npc.gold || 0;
          if (goal.currentValue >= goal.targetValue) {
            goal.status = 'completed';
          }
          break;

        case 'power':
          goal.currentValue = npc.power || 0;
          if (goal.currentValue >= goal.targetValue) {
            goal.status = 'completed';
          }
          break;

        // Other goal types would update similarly
      }

      // Check if goal deadline has passed
      if (goal.deadline && currentTick > goal.deadline && goal.status === 'active') {
        goal.status = 'failed';
      }

      // Completed/failed goals become inactive after a while
      if ((goal.status === 'completed' || goal.status === 'failed') && 
          currentTick > (goal.deadline || 0) + 1000) {
        goal.status = 'inactive';
      }
    }
  }

  /**
   * Get all goals for an NPC
   */
  getGoalsForNpc(npcId: string): NpcGoal[] {
    return this.npcGoals.get(npcId) || [];
  }

  /**
   * Clear plans when epoch changes
   */
  clearPlans(): void {
    this.actionPlans.clear();
  }
}

// Singleton instance
let instance: GoalOrientedPlanner | null = null;

export function getGoalOrientedPlanner(): GoalOrientedPlanner {
  if (!instance) {
    instance = new GoalOrientedPlanner();
  }
  return instance;
}

/**
 * Convenience exports
 */
export const goalPlannerEngine = {
  initializeGoalsForNpc: (npcId: string, personality: NpcPersonality, tick: number) =>
    getGoalOrientedPlanner().initializeGoalsForNpc(npcId, personality, tick),
  planActionsForNpc: (npcId: string, npc: NPC, state: WorldState, tick: number, steps?: number) =>
    getGoalOrientedPlanner().planActionsForNpc(npcId, npc, state, tick, steps),
  executeActionStep: (planId: string, npcId: string, npc: NPC, tick: number) =>
    getGoalOrientedPlanner().executeActionStep(planId, npcId, npc, tick),
  getCurrentPlan: (npcId: string) =>
    getGoalOrientedPlanner().getCurrentPlan(npcId),
  updateGoalsForNpc: (npcId: string, npc: NPC, state: WorldState, tick: number) =>
    getGoalOrientedPlanner().updateGoalsForNpc(npcId, npc, state, tick),
  getGoalsForNpc: (npcId: string) =>
    getGoalOrientedPlanner().getGoalsForNpc(npcId),
  clearPlans: () =>
    getGoalOrientedPlanner().clearPlans()
};
