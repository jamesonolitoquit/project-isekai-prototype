/**
 * goalOrientedPlannerEngine.ts - M46-C1: Goal-Oriented Action Planning (GOAP)
 * Provides autonomous NPC goal planning and action sequencing.
 */

import { SeededRng } from './prng';
import type { WorldState, NPC } from './worldEngine';

export interface NpcGoal {
  id: string;
  goalType: 'explore' | 'gather' | 'socialize' | 'combat' | 'flee' | 'rest' | 'trading_rumors' | 'custom';
  priority: number;
  parameters?: Record<string, any>;
  targetLocationId?: string;
  targetNpcId?: string;
  deadline?: number;
  isCompleted: boolean;
  progressValue: number;
  failureReason?: string;
}

export interface NpcAction {
  id: string;
  actionType: 'move' | 'interact' | 'craft' | 'fight' | 'rest' | 'speak' | 'investigate' | 'harvest' | 'trade' | 'custom';
  preconditions: Record<string, boolean>;
  effects: Record<string, any>;
  cost: number;
  duration: number;
  targetLocationId?: string;
  targetNpcId?: string;
  targetItemId?: string;
  parameters?: Record<string, any>;
}

export interface ActionPlan {
  id: string;
  npcId: string;
  goal: NpcGoal;
  actions: NpcAction[];
  totalCost: number;
  totalDuration: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  currentActionIndex: number;
  isExecuting: boolean;
  isPaused: boolean;
  interruptedBy?: string;
}

export interface NpcPersonality {
  boldness?: number;
  caution?: number;
  sociability?: number;
  ambition?: number;
  curiosity?: number;
  honesty?: number;
}

class GoalOrientedPlanner {
  private planCache: Map<string, ActionPlan> = new Map();
  private goalQueue: Map<string, NpcGoal[]> = new Map();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
  }

  createPlan(
    npc: NPC,
    goal: NpcGoal,
    personality: NpcPersonality,
    worldState: WorldState
  ): ActionPlan | null {
    const availableActions = this.getApplicableActions(npc, goal, worldState);

    if (availableActions.length === 0) {
      return null;
    }

    const sortedActions = this.sortActionsByHeuristic(availableActions, personality, goal);
    const selectedActions = this.selectOptimalSequence(sortedActions, goal, personality);

    const plan: ActionPlan = {
      id: `plan_${npc.id}_${Date.now()}`,
      npcId: npc.id,
      goal,
      actions: selectedActions,
      totalCost: selectedActions.reduce((sum, action) => sum + action.cost, 0),
      totalDuration: selectedActions.reduce((sum, action) => sum + action.duration, 0),
      createdAt: worldState.tick || Date.now(),
      currentActionIndex: 0,
      isExecuting: false,
      isPaused: false
    };

    this.planCache.set(plan.id, plan);
    return plan;
  }

  private getApplicableActions(npc: NPC, goal: NpcGoal, worldState: WorldState): NpcAction[] {
    const actions: NpcAction[] = [];

    switch (goal.goalType) {
      case 'explore':
        actions.push(this.createMoveAction(goal.targetLocationId || ''));
        break;
      case 'gather':
        actions.push(this.createGatherAction(goal.targetLocationId || ''));
        break;
      case 'socialize':
        actions.push(this.createSocializeAction(goal.targetNpcId || ''));
        break;
      case 'trading_rumors':
        // M55-B1: Exchange rumors with nearby NPCs
        actions.push(this.createRumorExchangeAction(goal.targetNpcId || ''));
        break;
      case 'combat':
        actions.push(this.createCombatAction(goal.targetNpcId || ''));
        break;
      case 'flee':
        actions.push(this.createFleeAction());
        break;
      case 'rest':
        actions.push(this.createRestAction());
        break;
    }

    return actions.filter(a => a !== null);
  }

  private createMoveAction(locationId: string): NpcAction {
    return {
      id: `action_move_${locationId}`,
      actionType: 'move',
      preconditions: { isAlive: true, isNotParalyzed: true },
      effects: { currentLocation: locationId },
      cost: 10,
      duration: this.rng.nextInt(50, 150),
      targetLocationId: locationId
    };
  }

  private createGatherAction(locationId: string): NpcAction {
    return {
      id: `action_gather_${locationId}`,
      actionType: 'craft',
      preconditions: { isAtLocation: true, canCraft: true },
      effects: { hasMaterials: true },
      cost: 15,
      duration: this.rng.nextInt(100, 300),
      targetLocationId: locationId,
      parameters: { resourceType: 'generic' }
    };
  }

  private createSocializeAction(npcId: string): NpcAction {
    return {
      id: `action_socialize_${npcId}`,
      actionType: 'speak',
      preconditions: { isAlive: true, canCommunicate: true },
      effects: { relationshipChanged: true },
      cost: 5,
      targetNpcId: npcId,
      duration: this.rng.nextInt(30, 120)
    };
  }

  private createRumorExchangeAction(targetNpcId: string): NpcAction {
    // M55-B1: Action to exchange rumors after >50 ticks of co-location
    return {
      id: `action_rumor_exchange_${targetNpcId}`,
      actionType: 'speak',
      preconditions: { isAlive: true, canCommunicate: true, hasCoLocationTicks: true },
      effects: { rumorExchanged: true, knowledgeUpdated: true },
      cost: 3,
      targetNpcId: targetNpcId,
      duration: this.rng.nextInt(10, 30),
      parameters: { exchangeType: 'gossip', rumorCount: 1, minCoLocationTicks: 50 }
    };
  }

  private createCombatAction(targetId: string): NpcAction {
    return {
      id: `action_combat_${targetId}`,
      actionType: 'fight',
      preconditions: { isArmed: true, isAlive: true },
      effects: { combatResolved: true },
      cost: 50,
      duration: this.rng.nextInt(200, 500),
      targetNpcId: targetId
    };
  }

  private createFleeAction(): NpcAction {
    return {
      id: 'action_flee',
      actionType: 'move',
      preconditions: { isAlive: true },
      effects: { hasEscaped: true, locationChanged: true },
      cost: 20,
      duration: this.rng.nextInt(50, 150),
      parameters: { fleeDirection: 'random' }
    };
  }

  private createRestAction(): NpcAction {
    return {
      id: 'action_rest',
      actionType: 'rest',
      preconditions: { isAlive: true },
      effects: { healthRestored: true, staminaRestored: true },
      cost: 5,
      duration: this.rng.nextInt(300, 600)
    };
  }

  private sortActionsByHeuristic(
    actions: NpcAction[],
    personality: NpcPersonality,
    goal: NpcGoal
  ): NpcAction[] {
    return actions.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (goal.goalType === 'combat') {
        scoreA += personality.boldness * (a.actionType === 'fight' ? 10 : 0);
        scoreB += personality.boldness * (b.actionType === 'fight' ? 10 : 0);
      } else if (goal.goalType === 'explore') {
        scoreA += personality.curiosity * (a.actionType === 'move' ? 10 : 0);
        scoreB += personality.curiosity * (b.actionType === 'move' ? 10 : 0);
      }

      scoreA -= a.cost;
      scoreB -= b.cost;

      return scoreB - scoreA;
    });
  }

  private selectOptimalSequence(
    actions: NpcAction[],
    goal: NpcGoal,
    personality: NpcPersonality
  ): NpcAction[] {
    const maxActions = Math.min(5, Math.ceil(personality.ambition / 20));
    return actions.slice(0, maxActions);
  }

  executePlan(plan: ActionPlan, elapsedTime: number, npc: NPC, worldState: WorldState): void {
    if (plan.isPaused || !plan.isExecuting) {
      return;
    }

    if (plan.currentActionIndex >= plan.actions.length) {
      plan.completedAt = worldState.tick || Date.now();
      plan.goal.isCompleted = true;
      plan.isExecuting = false;
      return;
    }

    const currentAction = plan.actions[plan.currentActionIndex];
    const actionProgress = elapsedTime;

    if (actionProgress >= currentAction.duration) {
      this.completeAction(currentAction, npc, worldState);
      plan.currentActionIndex++;
    }
  }

  private completeAction(action: NpcAction, npc: NPC, worldState: WorldState): void {
    // M55-B1: Handle rumor exchange for GOSSIP interactions via speak/interact actions
    if ((action.actionType === 'speak' || action.actionType === 'interact') && action.targetNpcId) {
      const targetNpc = worldState.npcs.find(n => n.id === action.targetNpcId);
      if (targetNpc) {
        // Check if this is a gossip/PERSUADE action
        const initiatorRumors = (npc as any).rumors || [];
        const targetRumors = (targetNpc as any).rumors || [];
        
        // M55-B1: If initiator has rumors, transfer one to target
        if (initiatorRumors.length > 0) {
          const randomIndex = Math.floor(Math.random() * initiatorRumors.length);
          const rumorToShare = initiatorRumors[randomIndex];
          
          if (rumorToShare) {
            // M55-B1: Increment distortion by 10% as rumor is shared
            const distortedRumor = {
              ...rumorToShare,
              distortion: ((rumorToShare as any).distortion || 0) + 10
            };
            
            // Transfer rumor to target if not already known
            if (!targetRumors.some((r: any) => r.id === rumorToShare.id)) {
              targetRumors.push(distortedRumor);
            }
          }
        }
      }
    }
  }

  getPlanForNpc(npcId: string): ActionPlan | undefined {
    return Array.from(this.planCache.values()).find(p => p.npcId === npcId && p.isExecuting);
  }

  getAllPlans(): ActionPlan[] {
    return Array.from(this.planCache.values());
  }

  enqueueGoal(npcId: string, goal: NpcGoal): void {
    if (!this.goalQueue.has(npcId)) {
      this.goalQueue.set(npcId, []);
    }
    const queue = this.goalQueue.get(npcId)!;
    queue.push(goal);
    queue.sort((a, b) => b.priority - a.priority);
  }

  dequeueGoal(npcId: string): NpcGoal | undefined {
    const queue = this.goalQueue.get(npcId);
    return queue?.shift();
  }

  getGoalQueue(npcId: string): NpcGoal[] {
    return this.goalQueue.get(npcId) || [];
  }

  pausePlan(planId: string): void {
    const plan = this.planCache.get(planId);
    if (plan) {
      plan.isPaused = true;
    }
  }

  resumePlan(planId: string): void {
    const plan = this.planCache.get(planId);
    if (plan) {
      plan.isPaused = false;
    }
  }

  interruptPlan(planId: string, reason: string): void {
    const plan = this.planCache.get(planId);
    if (plan) {
      plan.isExecuting = false;
      plan.interruptedBy = reason;
      plan.goal.failureReason = reason;
    }
  }

  clearCache(): void {
    this.planCache.clear();
    this.goalQueue.clear();
  }

  reset(): void {
    this.planCache.clear();
    this.goalQueue.clear();
  }
}

let plannerInstance: GoalOrientedPlanner | null = null;

export function getGoalOrientedPlanner(seed: number = 12345): GoalOrientedPlanner {
  if (!plannerInstance) {
    plannerInstance = new GoalOrientedPlanner(seed);
  }
  return plannerInstance;
}

export function resetGoalOrientedPlanner(): void {
  if (plannerInstance) {
    plannerInstance.reset();
    plannerInstance = null;
  }
}

export const GoalOrientedPlannerExports = {
  getGoalOrientedPlanner,
  resetGoalOrientedPlanner
};
