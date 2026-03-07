/**
 * Faction System Schemas (Phase 3 - DSS 04)
 * 
 * Implements high-level faction governance, action budgeting, and social mechanics.
 * Integrates with:
 * - DSS 04: Faction autonomy, social weight, action budgets
 * - DSS 16: Matriarchal social weight modifiers (+15% female, -10% male)
 * 
 * Core Concept: Factions compete for territory and influence by spending
 * an ActionBudget each tick. Budget generation depends on territory control,
 * covenant participation, and divine faith.
 */

/**
 * Social Weight Modifier: Gender-based ActionBudget contribution (DSS 16)
 */
export type SocialWeightClass = 'female' | 'male' | 'non-binary';

export interface SocialWeightModifier {
  class: SocialWeightClass;
  actionBudgetMultiplier: number;  // Female: 1.15, Male: 0.90, Non-binary: 1.0
  reputationMultiplier: number;    // When aligned with matriarchy deity
  chasRequirement: number;          // CHA bonus contribution to social authority
}

/**
 * Action Budget: Resource for Faction AI to execute high-impact actions
 * 
 * Budget replenishes daily based on:
 * - Territory control (+10 per location)
 * - Active covenants participation
 * - Divine faith mass in faction's deity
 * - World stability (linear 0-40 scaling)
 * - Faction charm stat (CHA-based)
 */
export interface ActionBudget {
  /** Unique budget ID, typically faction-id-budget */
  id: string;

  /** Faction this budget belongs to */
  factionId: string;

  /** Current available action points (0-1000) */
  currentPoints: number;

  /** Maximum capacity for the budget */
  maxCapacity: number;

  /** When this budget was last regenerated */
  lastRegenTick: number;

  /**
   * Budget generation breakdown (per tick)
   * Used for diagnostics and player queries
   */
  generationBreakdown: {
    territoryControl: number;       // +10 per controlled location
    covenantParticipation: number;  // +5 per active covenant
    divineFaith: number;            // +2 per Faith point in faction deity
    factionCharism: number;         // CHA bonus (0.5x CHA modifier)
    stability: number;              // Linear 0-40 scaling with world stability
    socialWeight: number;           // +15% for female-led, -10% for male-led
  };

  /** Actions pending execution from this budget */
  pendingActions: string[];  // array of action IDs

  /** Cooldown tracking for high-impact actions */
  actionCooldowns: Map<string, number>;  // action_type -> end_tick
}

/**
 * Faction Agenda: Strategic goals and action priorities
 */
export interface FactionAgenda {
  /** Unique agenda ID */
  id: string;

  /** Faction this agenda belongs to */
  factionId: string;

  /** Primary strategic goal ('expand_territory' | 'consolidate' | 'convert_population' | 'gather_artifacts') */
  primaryGoal: 'expand_territory' | 'consolidate' | 'convert_population' | 'gather_artifacts';

  /** Secondary goals (lower priority) */
  secondaryGoals: string[];

  /** Threat/rivalry targets (faction IDs) */
  rivals: string[];

  /** Allied faction IDs */
  allies: string[];

  /** Territory targets for expansion (location IDs) */
  expansionTargets: string[];

  /** Updated each tick based on world events */
  updatedAtTick: number;
}

/**
 * Faction AI State: Decision-making context for autonomous factions
 * (Executed in Phase 2 World AI Drift)
 */
export interface FactionAIState {
  /** Faction ID */
  factionId: string;

  /** Current mood/state ('aggressive' | 'defensive' | 'diplomatic' | 'dormant') */
  state: 'aggressive' | 'defensive' | 'diplomatic' | 'dormant';

  /** Perception of each other faction's threat level (0-100) */
  threatAssessment: Map<string, number>;

  /** Confidence in military capability (0-100) */
  militaryConfidence: number;

  /** Diplomatic reputation across other factions (average -100 to +100) */
  diplomacyReputation: number;

  /** Internal morale (0-100, affects action efficiency) */
  internalMorale: number;

  /** Tick when state was last updated */
  lastDecisionTick: number;

  /** Next planned action (for predictability at this phase) */
  nextPlannedAction?: {
    type: string;
    targetId?: string;
    budgetCost: number;
  };
}

/**
 * Faction Social Record: Tracks relationships and reputation
 */
export interface FactionSocialRecord {
  /** Faction ID */
  factionId: string;

  /** Pairwise reputation with all other factions (-100 to +100) */
  reputationByFaction: Map<string, number>;

  /** Total "social influence" accumulated through treaties/pacts */
  socialInfluence: number;

  /** Number of active covenants this faction participates in */
  activeCovenantCount: number;

  /** Latest social event affecting this faction */
  latestSocialEvent?: {
    type: string;
    otherFactionId?: string;
    impact: number;  // +/- reputation change
    timestamp: number;
  };
}

/**
 * Enhanced Faction Type: Combines template seed with AI state and budget
 * (Represents a Faction in the active game world)
 */
export interface ActiveFaction {
  // -- Template/Seed Data --
  id: string;
  name: string;
  templateId: string;           // Reference to original MatriarchalGenesisTemplate
  description?: string;
  factionColor: string;         // RGB hex for UI rendering

  // -- Territory Control --
  controlledLocationIds: string[];
  powerScore: number;           // 0-100 faction strength
  territory: {
    owned: number;              // Count of controlled locations
    contested: number;          // Count of influenced but not owned
    underAttack: number;        // Territory at risk
  };

  // -- Leadership & Social --
  leaderCharacterId?: string;   // NPC leader ID (if any)
  leaderSocialWeight: SocialWeightClass;  // Used for ActionBudget multiplier
  lineageScore: number;         // Matriarchal lineage (0-200)
  charismaBonus: number;        // CHA modifier of primary leader

  // -- AI & Resources --
  actionBudget: ActionBudget;
  aiState: FactionAIState;
  agenda: FactionAgenda;
  socialRecord: FactionSocialRecord;

  // -- Divine Connection --
  patronDeityId?: string;       // Deity the faction is aligned with
  faithMassInDeity: number;     // 0-1000 accumulated faith points
  activeCovenants: string[];    // Covenant IDs this faction participates in

  // -- Temporal Tracking --
  createdAtTick: number;
  lastActionTick: number;
  lastDecisionTick: number;
  ticksExisted: number;

  // -- Metadata --
  isPlayerFaction: boolean;
  isNPCControlled: boolean;
}

/**
 * Faction Relationship Type
 */
export interface FactionRelationship {
  /** Unique relationship ID */
  id: string;

  /** Faction A ID */
  factionAId: string;

  /** Faction B ID */
  factionBId: string;

  /** Relationship type */
  type: 'alliance' | 'neutral' | 'rival' | 'enemy' | 'vassal';

  /** Intensity of relationship (0-100) */
  intensity: number;

  /** Accumulated reputation between factions (-1000 to +1000) */
  cumulativeReputation: number;

  /** Treaties or agreements (string IDs) */
  activeAgreements: string[];

  /** When this relationship was established */
  establishedAtTick: number;

  /** Whether relationship is hostile */
  isHostile: boolean;

  /** Whether relationship is alliance-like */
  isAllied: boolean;
}

/**
 * Faction Action Types (executable from ActionBudget)
 */
export const FACTION_ACTION_TYPES = {
  // Military
  CONQUER_TERRITORY: { name: 'Conquer Territory', cost: 50, cooldownTicks: 1800 },    // 48 hours
  SKIRMISH: { name: 'Minor Skirmish', cost: 20, cooldownTicks: 900 },                 // 24 hours
  FORTIFY: { name: 'Fortify Hold', cost: 30, cooldownTicks: 900 },

  // Diplomatic
  NEGOTIATE_ALLIANCE: { name: 'Propose Alliance', cost: 15, cooldownTicks: 600 },    // 16 hours
  OFFER_VASSAL_PACT: { name: 'Offer Vassal Pact', cost: 35, cooldownTicks: 1200 },
  DECLARE_RIVALRY: { name: 'Declare Rivalry', cost: 10, cooldownTicks: 300 },

  // Economic
  TRADE_CARAVAN: { name: 'Send Trade Caravan', cost: 25, cooldownTicks: 600 },
  TAX_TERRITORY: { name: 'Impose Tax', cost: 15, cooldownTicks: 450 },
  STIMULATE_PRODUCTION: { name: 'Stimulate Production', cost: 40, cooldownTicks: 1200 },

  // Divine
  DIVINE_MIRACLE: { name: 'Request Divine Miracle', cost: 100, cooldownTicks: 720 },  // 12 hours
  MASS_AWAKENING: { name: 'Mass Echo Awakening', cost: 75, cooldownTicks: 1440 },    // 24 hours
  COVENANT_RITUAL: { name: 'Perform Covenant Ritual', cost: 50, cooldownTicks: 600 },
} as const;

/**
 * Helper function: Apply social weight modifier to budget generation
 */
export function applySocialWeightModifier(
  baseGeneration: number,
  socialWeightClass: SocialWeightClass
): number {
  const modifiers: Record<SocialWeightClass, number> = {
    female: 1.15,      // +15% (DSS 16)
    male: 0.90,        // -10% (DSS 16)
    'non-binary': 1.0, // Baseline
  };
  return baseGeneration * modifiers[socialWeightClass];
}

/**
 * Helper function: Calculate daily ActionBudget regeneration
 * 
 * Formula: (Territory × 10 + CovenantCount × 5 + Faith × 2 + CHA × 0.5 + Stability × 40) × SocialWeight
 */
export function calculateDailyBudgetGeneration(options: {
  controlledLocations: number;
  activeCovenantCount: number;
  divineFaith: number;
  factionChaBonus: number;
  worldStability: number;  // 0-1
  leaderSocialWeight: SocialWeightClass;
}): number {
  const base =
    options.controlledLocations * 10 +
    options.activeCovenantCount * 5 +
    Math.floor(options.divineFaith * 2) +
    options.factionChaBonus * 0.5 +
    Math.floor(options.worldStability * 40);

  return applySocialWeightModifier(base, options.leaderSocialWeight);
}

/**
 * Helper function: Create a new ActionBudget for a faction
 */
export function createActionBudget(
  factionId: string,
  maxCapacity: number = 500
): ActionBudget {
  return {
    id: `${factionId}-budget`,
    factionId,
    currentPoints: maxCapacity * 0.5,  // Start at 50% capacity
    maxCapacity,
    lastRegenTick: 0,
    generationBreakdown: {
      territoryControl: 0,
      covenantParticipation: 0,
      divineFaith: 0,
      factionCharism: 0,
      stability: 0,
      socialWeight: 0,
    },
    pendingActions: [],
    actionCooldowns: new Map(),
  };
}

/**
 * Helper function: Check if an action is on cooldown
 */
export function isActionOnCooldown(
  budget: ActionBudget,
  actionType: string,
  currentTick: number
): boolean {
  const cooldownEnd = budget.actionCooldowns.get(actionType);
  return cooldownEnd ? currentTick < cooldownEnd : false;
}

/**
 * Helper function: Can faction afford an action?
 */
export function canAffordAction(
  budget: ActionBudget,
  actionType: string
): boolean {
  const action = FACTION_ACTION_TYPES[actionType as keyof typeof FACTION_ACTION_TYPES];
  if (!action) return false;
  return budget.currentPoints >= action.cost;
}
