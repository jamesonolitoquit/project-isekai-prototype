/**
 * M42 Task 2.2: Dice Altar Engine
 *
 * Core D20 resolution mechanics:
 * - Roll 1d20 and compare to DC
 * - Apply modifiers (clamped at ±5)
 * - Critical (20) always succeeds, Fumble (1) always fails
 * - Record mutation for audit trail
 *
 * Used by:
 * - Combat (attack rolls, monster saves)
 * - Skill checks (persuasion, investigation, animal handling)
 * - Crafting checks (success/failure with consequences)
 * - Ritual checks (minor/major/backlash outcomes)
 * - Saving throws (reduce damage, resist effects)
 */

/**
 * D20 Modifier source and value
 */
export interface DiceModifier {
  source: string;           // "Strength Bonus", "Fatigue", "Equipment", etc.
  value: number;            // Modifier value (-5 to +5 after clamping)
  icon?: string;            // Optional emoji/icon for UI
  description?: string;     // Tooltip
}

/**
 * Result of a D20 roll
 */
export interface RollResult {
  roll: number;             // 1-20 raw d20
  modifiers: DiceModifier[];
  total: number;            // roll + sum(modifiers), clamped
  dc: number;               // Difficulty class
  passed: boolean;          // total >= dc (or critical/fumble rules)
  isCritical: boolean;      // roll === 20
  isFumble: boolean;        // roll === 1
  margin: number;           // total - dc
}

/**
 * Action context for mutation logging
 */
export interface DiceAction {
  actionId: string;         // Unique ID for this roll attempt
  actionType: 'attack' | 'skill_check' | 'crafting' | 'ritual' | 'save';
  actionName: string;       // "Persuasion Check", "Attack Roll", etc.
  actorId?: string;         // Who is rolling
  targetId?: string;        // Who/what is being targeted (optional)
  timestamp: number;
}

/**
 * Mutation record for state audit trail (stored in mutationLog)
 */
export interface DiceMutation {
  type: 'DICE_ROLL';
  action: DiceAction;
  roll: number;
  modifiers: DiceModifier[];
  dc: number;
  result: {
    total: number;
    passed: boolean;
    isCritical: boolean;
    isFumble: boolean;
    margin: number;
  };
  timestamp: number;
}

/**
 * Resolve a D20 roll against a difficulty class
 *
 * Rules:
 * - Critical (roll === 20): Always pass, regardless of modifiers
 * - Fumble (roll === 1): Always fail, regardless of modifiers
 * - Success: total >= dc
 * - Modifiers are clamped to ±5 to prevent stat bloat
 */
export function resolveDiceRoll(
  action: DiceAction,
  modifiers: DiceModifier[],
  dc: number
): RollResult {
  // Roll 1d20 (equiprobable 1-20)
  const roll = Math.floor(Math.random() * 20) + 1;

  // Check for critical/fumble first (they override modifiers)
  const isCritical = roll === 20;
  const isFumble = roll === 1;

  // Calculate modifier sum with clamping
  let modifierSum = sumModifiers(modifiers);
  modifierSum = clampModifier(modifierSum);

  // Calculate total
  const total = roll + modifierSum;

  // Determine pass/fail
  const passed = isCritical || (!isFumble && total >= dc);

  // Calculate margin
  const margin = total - dc;

  return {
    roll,
    modifiers,
    total,
    dc,
    passed,
    isCritical,
    isFumble,
    margin
  };
}

/**
 * Sum all modifier values
 * Example: [+3, -1, +2] → 4
 */
export function sumModifiers(modifiers: DiceModifier[]): number {
  return modifiers.reduce((sum, mod) => sum + mod.value, 0);
}

/**
 * Clamp modifier total to ±5
 * Prevents modifier stacking from dominating the roll
 * Example: +12 → +5, -8 → -5, +3 → +3
 */
export function clampModifier(value: number): number {
  return Math.max(-5, Math.min(5, value));
}

/**
 * Verify DC is in valid range (typically 5-30)
 * DC 5: Very Easy
 * DC 10: Easy
 * DC 15: Moderate/Hard
 * DC 20: Very Hard
 * DC 25: Nearly Impossible
 */
export function isValidDC(dc: number): boolean {
  return dc >= 5 && dc <= 30 && Number.isInteger(dc);
}

/**
 * Get symbolic difficulty name
 */
export function getDifficultyName(dc: number): string {
  if (dc <= 5) return 'Trivial';
  if (dc <= 10) return 'Easy';
  if (dc <= 15) return 'Moderate';
  if (dc <= 20) return 'Hard';
  if (dc <= 25) return 'Very Hard';
  return 'Nearly Impossible';
}

/**
 * Calculate success probability (theoretical)
 * Assumes modifiers sum to 0 (no net bonus/penalty)
 *
 * Example:
 * - DC 10, no mods: 11/20 = 55% pass rate (need 10+)
 * - DC 15, no mods: 6/20 = 30% pass rate (need 15+)
 */
export function getSuccessProbability(dc: number, modifierSum: number = 0): number {
  const clamped = Math.max(-5, Math.min(5, modifierSum));
  const needed = Math.max(1, dc - clamped);
  const successes = Math.max(0, 21 - needed); // 20 succeeds always (critical)
  return successes / 20;
}

/**
 * Determine outcome flavor text based on result
 */
export function getOutcomeText(result: RollResult): string {
  if (result.isCritical) {
    return `Critical Success! Rolled 20 + ${sumModifiers(result.modifiers)} = ${result.total}`;
  }

  if (result.isFumble) {
    return `Fumble! You rolled a 1. Even with modifiers (${sumModifiers(result.modifiers)}), the attempt fails.`;
  }

  if (result.passed) {
    return `Success! ${result.total} beats DC ${result.dc} by ${result.margin}`;
  }

  return `Failure. ${result.total} vs DC ${result.dc} — missed by ${Math.abs(result.margin)}`;
}

/**
 * Create a dice mutation for state audit trail
 */
export function createDiceMutation(
  action: DiceAction,
  roll: number,
  modifiers: DiceModifier[],
  dc: number,
  result: RollResult
): DiceMutation {
  return {
    type: 'DICE_ROLL',
    action,
    roll,
    modifiers,
    dc,
    result: {
      total: result.total,
      passed: result.passed,
      isCritical: result.isCritical,
      isFumble: result.isFumble,
      margin: result.margin
    },
    timestamp: Date.now()
  };
}

/**
 * Validate a roll result for consistency
 */
export function validateRollResult(result: RollResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(result.roll) || result.roll < 1 || result.roll > 20) {
    errors.push('Invalid d20 roll: must be 1-20');
  }

  if (result.isCritical && result.roll !== 20) {
    errors.push('Critical strike must have roll === 20');
  }

  if (result.isFumble && result.roll !== 1) {
    errors.push('Fumble must have roll === 1');
  }

  const calcTotal = result.roll + clampModifier(sumModifiers(result.modifiers));
  if (result.total !== calcTotal) {
    errors.push(`Total mismatch: expected ${calcTotal}, got ${result.total}`);
  }

  const expectedMargin = result.total - result.dc;
  if (result.margin !== expectedMargin) {
    errors.push(`Margin mismatch: expected ${expectedMargin}, got ${result.margin}`);
  }

  // Critical always passes, fumble always fails
  if (result.isCritical && !result.passed) {
    errors.push('Critical must be a pass');
  }

  if (result.isFumble && result.passed) {
    errors.push('Fumble must be a failure');
  }

  // Normal pass/fail logic
  if (!result.isCritical && !result.isFumble) {
    const shouldPass = result.total >= result.dc;
    if (shouldPass !== result.passed) {
      errors.push(
        `Pass/fail logic error: total ${result.total} vs dc ${result.dc}, ` +
        `shouldPass=${shouldPass}, result.passed=${result.passed}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate bonus chance for different DC values
 * (Helper for UI display of difficulty)
 */
export function getBonusChances(
  modifiers: DiceModifier[]
): { dc: number; probability: number; difficulty: string }[] {
  const modSum = clampModifier(sumModifiers(modifiers));

  return [5, 10, 15, 20, 25].map(dc => ({
    dc,
    probability: getSuccessProbability(dc, modSum),
    difficulty: getDifficultyName(dc)
  }));
}
