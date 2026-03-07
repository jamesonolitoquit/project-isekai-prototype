/**
 * Temporal Mechanics System (DSS 03: Temporal Mechanics & Reincarnation)
 * 
 * Paradox Debt tracks the accumulation of causal inconsistencies.
 * As debt increases, reality becomes increasingly unstable, eventually triggering
 * a Vessel Reset or Reality Fault.
 */

/**
 * Paradox Debt States (DSS 03.1)
 * Each state represents a severity level with specific mechanical effects
 */
export enum ParadoxDebtState {
  /** 0-25%: Minor d20 roll bias (-1) */
  WHISPER = 'whisper',

  /** 26-50%: Environmental NPCs react with "Unrest" */
  BLEED = 'bleed',

  /** 51-75%: "Shadow" entities attract to the player */
  BLEACH = 'bleach',

  /** 76%+: Reality begins to fault, Vessel Reset triggered */
  REALITY_FAULT = 'reality-fault',
}

/**
 * Paradox Event: Records a single causal manipulation
 */
export interface ParadoxEvent {
  /** Unique event identifier */
  id: string;

  /** Actor who caused this paradox event */
  actorId: string;

  /** Type of temporal manipulation */
  eventType:
    | 'timeline-warp'
    | 'snapshot-rewind'
    | 'decision-undo'
    | 'item-duplication'
    | 'death-undo'
    | 'other';

  /** Magnitude of the event (0-100 scale) */
  magnitude: number;

  /** Information gained by this manipulation */
  informationGained: number;

  /** Temporal divergence created (how much reality was altered) */
  temporalDivergence: number;

  /** Tick when this event occurred */
  occurredAtTick: number;

  /** Description for audit trail */
  description: string;
}

/**
 * ParadoxTracker: Manages accumulated causal debt per actor
 * 
 * Formula: Debt = EventMagnitude * (InformationGained / TemporalDivergence)
 *   - Higher magnitude = more debt
 *   - More information gained = more debt
 *   - Higher divergence = less debt (more "spread out" in timelines)
 */
export interface ParadoxTracker {
  /** Actor this tracker monitors */
  actorId: string;

  /** Current paradox debt (0-100+) */
  currentDebt: number;

  /** Maximum paradox debt capacity before forced reset */
  debtCapacity: number;

  /** Current state based on debt percentage */
  currentState: ParadoxDebtState;

  /** All paradox events in chronological order */
  eventHistory: ParadoxEvent[];

  /** When this tracker was created */
  createdAtTick: number;

  /** Accumulated penalties/effects from high debt */
  activePenalties: ParadoxPenalty[];

  /** Shadow entities attracted to this actor (at BLEACH state) */
  attractedShadows: string[];

  /** Last time debt was reduced (natural decay) */
  lastDecayAtTick: number;

  /** Total decay applied (for statistics) */
  totalDecayApplied: number;

  /** Whether this actor is in "Reality Fault" state (requires Vessel Reset) */
  inRealityFault: boolean;

  /** When Reality Fault began */
  faultStartedAtTick?: number;

  /** Phase 0 Input Discard tracking (DSS 07 security patch) */
  phase0Security: Phase0SecurityInfo;
}

/**
 * Paradox Penalty: Effects applied due to high debt levels
 */
export interface ParadoxPenalty {
  /** Penalty type */
  type: 'roll-penalty' | 'npc-unrest' | 'shadow-attraction' | 'attribute-penalty';

  /** Severity (-5 to -1 for roll penalties) */
  severity: number;

  /** Affected statistic (d20 rolls, faction reputation, etc.) */
  affectedStat?: string;

  /** When this penalty was applied */
  appliedAtTick: number;

  /** When this penalty expires (null = permanent until debt reduced) */
  expireAtTick?: number;

  /** Description for UI */
  description: string;
}

/**
 * Reincarnation Configuration
 * Tracks what a character retains after death or paradox reset
 */
export interface ReincarnationOptions {
  /** What % of skills are retained in new vessel */
  skillRetentionPercent: number;

  /** What ancestry to reincarnate as */
  newAncestry: string;

  /** Faction reputation retained */
  factionRepRetention: number;

  /** Special items retained (stored in Causal Vaults) */
  causalVaultItems: string[];

  /** Ancestral Echo Points available for Flash Learning */
  ancestralEchoPoints: number;
}

/**
 * Causal Vault: Legacy storage across reincarnation
 * Static locations in world that preserve items between vessel cycles
 */
export interface CausalVault {
  /** Unique vault identifier */
  id: string;

  /** Location ID in world */
  locationId: string;

  /** Owner's persistent soul ID (across reincarnations) */
  ownerSoulId: string;

  /** Stored items */
  items: VaultItem[];

  /** Ticks remaining before vault decays (null = permanent) */
  maintenanceTicks?: number;

  /** Fuel cost per tick to maintain this vault */
  fuelCostPerTick: number;

  /** When vault was created */
  createdAtTick: number;
}

/**
 * Item stored in a Causal Vault
 */
export interface VaultItem {
  itemId: string;
  quantity: number;
  storedAtTick: number;
  expiryTick?: number;
}

/**
 * Phase 0 Input Discard Tracking (DSS 07.1.1 Security Patch)
 * Prevents deterministic infinite loops via Timeline Warp replay
 */
export interface Phase0SecurityInfo {
  /** Current rollback count in this tick */
  rollbackCount: number;

  /** Maximum rollbacks allowed per tick */
  maxRollbacksPerTick: number;

  /** Was Phase 0 input discarded due to loop detection? */
  phase0InputDiscarded: boolean;

  /** Which tick the last rollback occurred */
  lastRollbackAtTick: number;

  /** Total anti-exploit flags accumulated */
  antiExploitFlags: number;

  /** If actor exceeds retry limit, flag for admin review */
  requiresAdminReview: boolean;
}

/**
 * Temporal Divergence Event
 * Tracks realtime "breaks" in causality
 */
export interface TemporalDivergence {
  /** Which actor caused the divergence */
  actorId: string;

  /** Timeline branches created */
  branchCount: number;

  /** Total information inconsistencies */
  inconsistencyCount: number;

  /** When divergence occurred */
  occurredAtTick: number;

  /** Severity (0-1 scale) */
  severity: number;

  /** Whether engine detected and corrected this automatically */
  autoResolved: boolean;
}

/**
 * Create a new Paradox Tracker for an actor
 */
export function createParadoxTracker(
  actorId: string,
  createdAtTick: number,
  debtCapacity: number = 100
): ParadoxTracker {
  return {
    actorId,
    currentDebt: 0,
    debtCapacity,
    currentState: ParadoxDebtState.WHISPER,
    eventHistory: [],
    createdAtTick,
    activePenalties: [],
    attractedShadows: [],
    lastDecayAtTick: createdAtTick,
    totalDecayApplied: 0,
    inRealityFault: false,
    phase0Security: {
      rollbackCount: 0,
      maxRollbacksPerTick: 3,
      phase0InputDiscarded: false,
      lastRollbackAtTick: 0,
      antiExploitFlags: 0,
      requiresAdminReview: false,
    },
  };
}

/**
 * Calculate paradox debt from a single event
 * Formula: EventMagnitude * (InformationGained / TemporalDivergence)
 *
 * Note: TemporalDivergence should be > 0 to avoid division by zero
 */
export function calculateParadoxDebt(
  magnitude: number,
  informationGained: number,
  temporalDivergence: number
): number {
  if (temporalDivergence === 0) {
    // Extreme case: infinite divergence = infinite debt
    return magnitude * informationGained * 100;
  }
  return magnitude * (informationGained / temporalDivergence);
}

/**
 * Add a paradox event to the tracker
 */
export function addParadoxEvent(
  tracker: ParadoxTracker,
  event: ParadoxEvent
): void {
  tracker.eventHistory.push(event);

  const debtFromEvent = calculateParadoxDebt(
    event.magnitude,
    event.informationGained,
    event.temporalDivergence
  );

  tracker.currentDebt += debtFromEvent;

  // Check if debt exceeds capacity
  if (tracker.currentDebt >= tracker.debtCapacity) {
    tracker.inRealityFault = true;
    tracker.faultStartedAtTick = event.occurredAtTick;
  }

  updateParadoxState(tracker);
}

/**
 * Update paradox state based on current debt percentage
 */
export function updateParadoxState(tracker: ParadoxTracker): void {
  const debtPercent = (tracker.currentDebt / tracker.debtCapacity) * 100;

  if (debtPercent >= 76) {
    tracker.currentState = ParadoxDebtState.REALITY_FAULT;
  } else if (debtPercent >= 51) {
    tracker.currentState = ParadoxDebtState.BLEACH;
    // Shadow attraction occurs at this level
  } else if (debtPercent >= 26) {
    tracker.currentState = ParadoxDebtState.BLEED;
  } else {
    tracker.currentState = ParadoxDebtState.WHISPER;
  }
}

/**
 * Get penalty for current state
 */
export function getPenaltyForState(state: ParadoxDebtState): number {
  switch (state) {
    case ParadoxDebtState.WHISPER:
      return -1; // Minor d20 roll bias
    case ParadoxDebtState.BLEED:
      return -2;
    case ParadoxDebtState.BLEACH:
      return -3;
    case ParadoxDebtState.REALITY_FAULT:
      return -5; // Severe penalties
    default:
      return 0;
  }
}

/**
 * Apply natural decay to paradox debt over time
 * Debt naturally "fades" as reality stabilizes
 */
export function applyParadoxDecay(
  tracker: ParadoxTracker,
  currentTick: number,
  decayPerTick: number = 0.01 // 1% per tick by default
): void {
  const ticksElapsed = currentTick - tracker.lastDecayAtTick;
  const totalDecay = ticksElapsed * decayPerTick;

  tracker.currentDebt = Math.max(0, tracker.currentDebt - totalDecay);
  tracker.totalDecayApplied += totalDecay;
  tracker.lastDecayAtTick = currentTick;

  updateParadoxState(tracker);
}

/**
 * Check if actor has exceeded Phase 0 rollback limit
 * (DSS 07.1.1: Infinite Loop Detection)
 */
export function exceedsRollbackLimit(tracker: ParadoxTracker): boolean {
  const phase0 = tracker.phase0Security;
  return phase0.rollbackCount >= phase0.maxRollbacksPerTick;
}

/**
 * Record a rollback attempt for Phase 0 security
 */
export function recordRollback(
  tracker: ParadoxTracker,
  currentTick: number
): boolean {
  const phase0 = tracker.phase0Security;

  // Reset counter if tick changed
  if (currentTick !== phase0.lastRollbackAtTick) {
    phase0.rollbackCount = 0;
  }

  phase0.rollbackCount++;
  phase0.lastRollbackAtTick = currentTick;

  if (phase0.rollbackCount >= phase0.maxRollbacksPerTick) {
    // Force Phase 0 input discard to prevent deterministic replay
    phase0.phase0InputDiscarded = true;
    phase0.antiExploitFlags++;

    if (phase0.antiExploitFlags >= 5) {
      phase0.requiresAdminReview = true;
    }

    return false; // Rollback blocked
  }

  return true; // Rollback allowed
}

/**
 * Reduce paradox debt by a specific amount
 * (Used for healing via Womb-Magic or special abilities)
 */
export function reduceParadoxDebt(tracker: ParadoxTracker, amount: number): void {
  tracker.currentDebt = Math.max(0, tracker.currentDebt - amount);
  updateParadoxState(tracker);

  // If debt drops below Reality Fault threshold, resolve fault
  if (tracker.currentDebt < tracker.debtCapacity && tracker.inRealityFault) {
    tracker.inRealityFault = false;
  }
}

/**
 * Trigger a Vessel Reset due to Reality Fault
 * Returns reincarnation options for the actor
 */
export function triggerVesselReset(tracker: ParadoxTracker): ReincarnationOptions {
  return {
    skillRetentionPercent: 0, // Skills reset to level 1
    newAncestry: 'selectable', // Player chooses new ancestry
    factionRepRetention: 0.1, // 10% of faction reputation inherited
    causalVaultItems: [], // Will be populated from actual vaults
    ancestralEchoPoints: 50, // 50 points for Flash Learning
  };
}

/**
 * Create a Causal Vault for an actor
 */
export function createCausalVault(
  ownerSoulId: string,
  locationId: string,
  createdAtTick: number
): CausalVault {
  return {
    id: `vault-${Date.now()}`,
    locationId,
    ownerSoulId,
    items: [],
    maintenanceTicks: undefined, // Permanent if maintained
    fuelCostPerTick: 5,
    createdAtTick,
  };
}

/**
 * Store an item in a Causal Vault
 */
export function storeItemInVault(
  vault: CausalVault,
  itemId: string,
  quantity: number,
  storedAtTick: number
): void {
  const existingItem = vault.items.find(i => i.itemId === itemId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    vault.items.push({
      itemId,
      quantity,
      storedAtTick,
    });
  }
}

/**
 * Retrieve an item from a Causal Vault
 */
export function retrieveItemFromVault(
  vault: CausalVault,
  itemId: string,
  quantity: number
): boolean {
  const item = vault.items.find(i => i.itemId === itemId);

  if (!item || item.quantity < quantity) {
    return false; // Not enough items
  }

  item.quantity -= quantity;

  if (item.quantity === 0) {
    vault.items = vault.items.filter(i => i.itemId !== itemId);
  }

  return true;
}

/**
 * Get all active paradox penalties for UI display
 */
export function getActivePenalties(tracker: ParadoxTracker): ParadoxPenalty[] {
  return tracker.activePenalties.filter(p => !p.expireAtTick);
}

/**
 * Validate Paradox Tracker state
 */
export function validateParadoxTracker(tracker: ParadoxTracker): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tracker.currentDebt < 0) {
    errors.push('currentDebt cannot be negative');
  }

  if (tracker.debtCapacity <= 0) {
    errors.push('debtCapacity must be positive');
  }

  if (tracker.phase0Security.rollbackCount < 0) {
    errors.push('rollbackCount cannot be negative');
  }

  if (tracker.phase0Security.maxRollbacksPerTick <= 0) {
    errors.push('maxRollbacksPerTick must be positive');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
