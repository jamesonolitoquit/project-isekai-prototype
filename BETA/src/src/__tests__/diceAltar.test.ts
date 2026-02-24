/**
 * Dice Altar Engine Tests — Milestone 42, Task 2.2
 *
 * Test Coverage:
 * - D20 roll probability and fairness
 * - Modifier application and clamping
 * - Critical (20) and Fumble (1) rules
 * - Pass/fail determination against DC
 * - Modifier validation
 */

import {
  resolveDiceRoll,
  sumModifiers,
  clampModifier,
  isValidDC,
  getDifficultyName,
  getSuccessProbability,
  getOutcomeText,
  validateRollResult,
  createDiceMutation,
  getBonusChances,
  type DiceModifier,
  type RollResult,
  type DiceAction
} from '../engine/diceAltarEngine';

describe('Dice Altar Engine', () => {
  const testAction: DiceAction = {
    actionId: 'roll_test_1',
    actionType: 'skill_check',
    actionName: 'Persuasion Check',
    timestamp: Date.now()
  };

  describe('D20 Roll Basics', () => {
    it('should roll value between 1 and 20', () => {
      for (let i = 0; i < 100; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        expect(result.roll).toBeGreaterThanOrEqual(1);
        expect(result.roll).toBeLessThanOrEqual(20);
        expect(Number.isInteger(result.roll)).toBe(true);
      }
    });

    it('should return RollResult with correct structure', () => {
      const result = resolveDiceRoll(testAction, [], 10);

      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('modifiers');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('dc');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('isCritical');
      expect(result).toHaveProperty('isFumble');
      expect(result).toHaveProperty('margin');
    });

    it('should set modifiers array from input', () => {
      const mods: DiceModifier[] = [
        { source: 'Strength', value: 2 },
        { source: 'Equipment', value: 1 }
      ];

      const result = resolveDiceRoll(testAction, mods, 10);
      expect(result.modifiers).toEqual(mods);
    });
  });

  describe('Modifier Handling', () => {
    it('should sum positive modifiers', () => {
      const mods: DiceModifier[] = [
        { source: 'A', value: 3 },
        { source: 'B', value: 2 }
      ];

      expect(sumModifiers(mods)).toBe(5);
    });

    it('should sum negative modifiers', () => {
      const mods: DiceModifier[] = [
        { source: 'A', value: -2 },
        { source: 'B', value: -3 }
      ];

      expect(sumModifiers(mods)).toBe(-5);
    });

    it('should handle mixed positive and negative', () => {
      const mods: DiceModifier[] = [
        { source: 'A', value: 5 },
        { source: 'B', value: -2 }
      ];

      expect(sumModifiers(mods)).toBe(3);
    });

    it('should return 0 for empty modifiers', () => {
      expect(sumModifiers([])).toBe(0);
    });

    it('should clamp large positive modifier to +5', () => {
      expect(clampModifier(10)).toBe(5);
      expect(clampModifier(100)).toBe(5);
    });

    it('should clamp large negative modifier to -5', () => {
      expect(clampModifier(-10)).toBe(-5);
      expect(clampModifier(-100)).toBe(-5);
    });

    it('should preserve small modifiers within range', () => {
      expect(clampModifier(-3)).toBe(-3);
      expect(clampModifier(-1)).toBe(-1);
      expect(clampModifier(0)).toBe(0);
      expect(clampModifier(1)).toBe(1);
      expect(clampModifier(5)).toBe(5);
    });
  });

  describe('Critical & Fumble Rules', () => {
    it('should mark roll of 20 as critical', () => {
      // Test by running many rolls until we get a 20
      let foundCritical = false;
      let attempts = 0;

      while (!foundCritical && attempts < 2000) {
        const result = resolveDiceRoll(testAction, [], 10);
        if (result.roll === 20) {
          expect(result.isCritical).toBe(true);
          foundCritical = true;
        }
        attempts++;
      }

      expect(foundCritical).toBe(true);
    });

    it('should mark roll of 1 as fumble', () => {
      let foundFumble = false;
      let attempts = 0;

      while (!foundFumble && attempts < 2000) {
        const result = resolveDiceRoll(testAction, [], 10);
        if (result.roll === 1) {
          expect(result.isFumble).toBe(true);
          foundFumble = true;
        }
        attempts++;
      }

      expect(foundFumble).toBe(true);
    });

    it('critical (20) should always pass regardless of DC', () => {
      // Collect criticals
      let critical: RollResult | null = null;
      let attempts = 0;

      while (!critical && attempts < 2000) {
        const result = resolveDiceRoll(testAction, [], 100); // Impossibly high DC
        if (result.roll === 20) {
          critical = result;
        }
        attempts++;
      }

      expect(critical).not.toBeNull();
      expect(critical!.isCritical).toBe(true);
      expect(critical!.passed).toBe(true); // Must pass even with DC 100
    });

    it('fumble (1) should always fail regardless of modifiers', () => {
      const mods: DiceModifier[] = [
        { source: 'Strength', value: 5 },
        { source: 'Equipment', value: 5 }
      ];

      let fumble: RollResult | null = null;
      let attempts = 0;

      while (!fumble && attempts < 2000) {
        const result = resolveDiceRoll(testAction, mods, 5); // Easy DC, huge bonus
        if (result.roll === 1) {
          fumble = result;
        }
        attempts++;
      }

      expect(fumble).not.toBeNull();
      expect(fumble!.isFumble).toBe(true);
      expect(fumble!.passed).toBe(false); // Must fail even with bonuses
    });

    it('should not both be critical AND fumble', () => {
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        if (result.isCritical) {
          expect(result.isFumble).toBe(false);
        }
        if (result.isFumble) {
          expect(result.isCritical).toBe(false);
        }
      }
    });
  });

  describe('Pass/Fail Logic', () => {
    it('should pass when total >= DC', () => {
      const mods: DiceModifier[] = [{ source: 'Bonus', value: 5 }];

      let found = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, mods, 10);
        if (result.roll >= 10 && !result.isCritical && !result.isFumble) {
          // Normal roll where total should be >= DC
          if (result.roll + 5 >= 10) {
            expect(result.passed).toBe(true);
            found = true;
            break;
          }
        }
      }
    });

    it('should fail when total < DC', () => {
      let found = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 15);
        if (result.roll < 15 && !result.isCritical && !result.isFumble) {
          expect(result.passed).toBe(false);
          found = true;
          break;
        }
      }
    });
  });

  describe('Total Calculation', () => {
    it('should calculate total as roll + modifiers (clamped)', () => {
      const mods: DiceModifier[] = [
        { source: 'A', value: 3 },
        { source: 'B', value: 2 }
      ];

      let testFound = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, mods, 10);
        if (!result.isCritical && !result.isFumble) {
          // Verify: roll + 5 (clamped from 3+2)
          expect(result.total).toBe(result.roll + 5);
          testFound = true;
          break;
        }
      }
      expect(testFound).toBe(true);
    });

    it('should clamp total modifiers before adding to roll', () => {
      // Modifiers: +10 → clamped to +5
      const mods: DiceModifier[] = [
        { source: 'A', value: 6 },
        { source: 'B', value: 4 }
      ];

      let testFound = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, mods, 10);
        if (!result.isCritical && !result.isFumble) {
          expect(result.total).toBe(result.roll + 5); // Clamped, not 10
          testFound = true;
          break;
        }
      }
      expect(testFound).toBe(true);
    });
  });

  describe('Margin Calculation', () => {
    it('should calculate margin as total - DC', () => {
      let testFound = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 15);
        expect(result.margin).toBe(result.total - 15);
        testFound = true;
        break;
      }
      expect(testFound).toBe(true);
    });

    it('should have positive margin on success', () => {
      let found = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 15);
        if (result.passed && !result.isCritical) {
          expect(result.margin).toBeGreaterThanOrEqual(0);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('should have negative margin on failure', () => {
      let found = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 15);
        if (!result.passed && !result.isFumble) {
          expect(result.margin).toBeLessThan(0);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('DC Validation', () => {
    it('should accept valid DCs (5-30)', () => {
      expect(isValidDC(5)).toBe(true);
      expect(isValidDC(10)).toBe(true);
      expect(isValidDC(15)).toBe(true);
      expect(isValidDC(20)).toBe(true);
      expect(isValidDC(25)).toBe(true);
      expect(isValidDC(30)).toBe(true);
    });

    it('should reject DC < 5', () => {
      expect(isValidDC(1)).toBe(false);
      expect(isValidDC(4)).toBe(false);
      expect(isValidDC(0)).toBe(false);
    });

    it('should reject DC > 30', () => {
      expect(isValidDC(31)).toBe(false);
      expect(isValidDC(50)).toBe(false);
      expect(isValidDC(100)).toBe(false);
    });

    it('should reject non-integer DCs', () => {
      expect(isValidDC(10.5)).toBe(false);
      expect(isValidDC(15.1)).toBe(false);
    });
  });

  describe('Difficulty Names', () => {
    it('should map DC to difficulty name', () => {
      expect(getDifficultyName(5)).toBe('Trivial');
      expect(getDifficultyName(10)).toBe('Easy');
      expect(getDifficultyName(15)).toBe('Moderate');
      expect(getDifficultyName(20)).toBe('Hard');
      expect(getDifficultyName(25)).toBe('Very Hard');
      expect(getDifficultyName(30)).toBe('Nearly Impossible');
    });
  });

  describe('Success Probability', () => {
    it('should calculate theoretical success probability', () => {
      // DC 10, no mods: need 10+ → 11 values (10-20) → 55%
      const prob10 = getSuccessProbability(10, 0);
      expect(prob10).toBeCloseTo(0.55, 2);

      // DC 15, no mods: need 15+ → 6 values (15-20) → 30%
      const prob15 = getSuccessProbability(15, 0);
      expect(prob15).toBeCloseTo(0.30, 2);

      // DC 20, no mods: need 20 → 1 value → 5%
      const prob20 = getSuccessProbability(20, 0);
      expect(prob20).toBeCloseTo(0.05, 2);
    });

    it('should apply modifier bonus to probability', () => {
      // DC 15, +3 mod: need 12+ instead of 15+ → higher probability
      const probWithMod = getSuccessProbability(15, 3);
      const probWithout = getSuccessProbability(15, 0);
      expect(probWithMod).toBeGreaterThan(probWithout);
    });
  });

  describe('Result Validation', () => {
    it('should validate correct roll', () => {
      let testFound = false;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        const validation = validateRollResult(result);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
        testFound = true;
        break;
      }
      expect(testFound).toBe(true);
    });

    it('should detect invalid roll value', () => {
      const invalidResult: RollResult = {
        roll: 25, // Invalid! Should be 1-20
        modifiers: [],
        total: 25,
        dc: 10,
        passed: true,
        isCritical: false,
        isFumble: false,
        margin: 15
      };

      const validation = validateRollResult(invalidResult);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect critical-pass violation', () => {
      const invalidResult: RollResult = {
        roll: 20,
        modifiers: [],
        total: 20,
        dc: 10,
        passed: false, // Critical must pass!
        isCritical: true,
        isFumble: false,
        margin: 10
      };

      const validation = validateRollResult(invalidResult);
      expect(validation.valid).toBe(false);
    });

    it('should detect fumble-fail violation', () => {
      const invalidResult: RollResult = {
        roll: 1,
        modifiers: [],
        total: 1,
        dc: 10,
        passed: true, // Fumble must fail!
        isCritical: false,
        isFumble: true,
        margin: -9
      };

      const validation = validateRollResult(invalidResult);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Outcome Text', () => {
    it('should generate critical text', () => {
      let text: string | null = null;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        if (result.isCritical) {
          text = getOutcomeText(result);
          break;
        }
      }

      expect(text).not.toBeNull();
      expect(text).toContain('Critical');
    });

    it('should generate fumble text', () => {
      let text: string | null = null;
      for (let i = 0; i < 500; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        if (result.isFumble) {
          text = getOutcomeText(result);
          break;
        }
      }

      expect(text).not.toBeNull();
      expect(text).toContain('Fumble');
    });
  });

  describe('Dice Mutation Creation', () => {
    it('should create valid mutation from result', () => {
      const result = resolveDiceRoll(testAction, [], 10);
      const mutation = createDiceMutation(testAction, result.roll, result.modifiers, 10, result);

      expect(mutation.type).toBe('DICE_ROLL');
      expect(mutation.action).toEqual(testAction);
      expect(mutation.roll).toBe(result.roll);
      expect(mutation.dc).toBe(10);
      expect(mutation.result.total).toBe(result.total);
      expect(mutation.result.passed).toBe(result.passed);
    });
  });

  describe('Bonus Chances Display', () => {
    it('should generate bonus chances for common DCs', () => {
      const mods: DiceModifier[] = [{ source: 'Bonus', value: 2 }];
      const chances = getBonusChances(mods);

      expect(chances).toHaveLength(5);
      expect(chances[0].dc).toBe(5);
      expect(chances[4].dc).toBe(25);

      // Higher DC = lower probability
      for (let i = 0; i < chances.length - 1; i++) {
        expect(chances[i].probability).toBeGreaterThan(chances[i + 1].probability);
      }
    });
  });

  describe('Probability Fairness', () => {
    it('should produce approximately even distribution of d20 values', () => {
      const counts = new Map<number, number>();

      for (let i = 0; i < 20000; i++) {
        const result = resolveDiceRoll(testAction, [], 10);
        counts.set(result.roll, (counts.get(result.roll) ?? 0) + 1);
      }

      // Each value should appear roughly 1000 times (20000 / 20)
      for (let val = 1; val <= 20; val++) {
        const count = counts.get(val) ?? 0;
        // Allow ±20% variance
        expect(count).toBeGreaterThan(800);
        expect(count).toBeLessThan(1200);
      }
    });
  });
});
