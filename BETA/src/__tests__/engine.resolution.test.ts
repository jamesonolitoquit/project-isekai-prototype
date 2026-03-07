/**
 * Unit Tests for Phase 2 Engine Core
 * 
 * Tests for ResolutionStack, FrictionManager, and ParadoxCalculator
 * Verifies that the 6-phase tick resolution, vitals decay, and paradox calculations
 * work according to DSS specifications.
 */

import {
  ResolutionStack,
  createResolutionStack,
  PlayerIntent,
  TickContext,
} from '../engine/ResolutionStack';
import {
  FrictionManager,
  VITAL_DECAY_RATES,
  HealthDescriptor,
  VitalDescriptor,
} from '../engine/FrictionManager';
import {
  ParadoxCalculator,
  ParadoxEventDetails,
} from '../engine/ParadoxCalculator';
import {
  createParadoxTracker,
  createVessel,
  createDefaultAttributes,
  ParadoxDebtState,
} from '../types';

describe('ResolutionStack: 6-Phase Tick Resolution', () => {
  let stack: ResolutionStack;
  let context: TickContext;

  beforeEach(() => {
    stack = createResolutionStack();

    const mockRng = { next: () => 0.5 };
    stack = createResolutionStack(mockRng);

    // Create test vessel
    const testVessel = createVessel({
      name: 'Test Actor',
      level: 1,
      attributes: createDefaultAttributes('balanced'),
      ancestry: 'human-bloodline-alpha',
      talent: 'ancestral-echo',
      gender: 'female',
      createdAtTick: 0,
      vesselId: 'test-actor',
    });

    // Create test paradox tracker
    const paradoxTracker = createParadoxTracker('test-actor', 0);

    context = {
      currentTick: 100,
      worldState: {},
      actor: testVessel,
      paradoxTracker,
      causalLocks: new Map(),
      phaseResults: [],
      informationLagMultiplier: 0.5,
    };
  });

  test('Phase 1: Input Decay - Accepts valid action', async () => {
    context.playerIntent = {
      actorId: 'test-actor',
      actionType: 'move',
      submittedAtTick: 100,
    };

    await (stack as any).phase1_InputDecay(context);

    expect(context.phaseResults).toHaveLength(1);
    expect(context.phaseResults[0].success).toBe(true);
    expect(context.validatedAction?.isValid).toBe(true);
  });

  test('Phase 1: Input Decay - Rejects action when Causally Locked', async () => {
    const lock = {
      actorId: 'test-actor',
      startedAtTick: 100,
      durationTicks: 1,
      reason: 'conservation_check' as const,
    };
    context.causalLocks.set('test-actor', lock);

    context.playerIntent = {
      actorId: 'test-actor',
      actionType: 'move',
      submittedAtTick: 100,
    };

    await (stack as any).phase1_InputDecay(context);

    expect(context.phaseResults[0].success).toBe(false);
    expect(context.phaseResults[0].invalidReason).toContain('Causal Lock');
  });

  test('Phase 1: Input Decay - Rejects Phase 0 discarded input', async () => {
    context.paradoxTracker.phase0Security.phase0InputDiscarded = true;

    context.playerIntent = {
      actorId: 'test-actor',
      actionType: 'move',
      submittedAtTick: 100,
    };

    await (stack as any).phase1_InputDecay(context);

    expect(context.phaseResults[0].success).toBe(false);
    expect(context.phaseResults[0].invalidReason).toContain('Phase 0');
  });

  test('Phase order validation: All phases execute in sequence', async () => {
    const result = await stack.processTick(context);

    expect(result.phaseResults).toHaveLength(6);
    const isInOrder = stack['validatePhaseOrder'](result.phaseResults);
    expect(isInOrder).toBe(true);
  });

  test('Phase 4: Commit & RNG - Triggers Conservation Check at 0 HP', async () => {
    context.actor.healthPoints = 0;
    context.conflictEvent = {
      id: 'conflict-01',
      attacker: context.actor,
      defender: { id: 'defender' } as any,
      d20Roll: 15,
      baseAttackBonus: 1,
      defenderAC: 12,
      isCritical: false,
      isHit: true,
      damageRoll: 5,
      totalDamage: 5,
      happenedAtTick: 100,
    };

    await (stack as any).phase4_CommitAndRNG(context);

    expect(context.conservationCheck).toBeDefined();
    expect(context.conservationCheck!.actorId).toBe(context.actor.id);
  });

  test('Phase lock expiration: Old locks are cleaned up', () => {
    const oldLock = {
      actorId: 'old-actor',
      startedAtTick: 50,
      durationTicks: 1,
      reason: 'conservation_check' as const,
    };

    stack['causalLocks'].set('old-actor', oldLock);
    expect(stack['causalLocks'].has('old-actor')).toBe(true);

    stack.expireOldLocks(101); // Tick 101, lock expired at 51

    expect(stack['causalLocks'].has('old-actor')).toBe(false);
  });
});

describe('FrictionManager: Vitals Decay & Information Lag', () => {
  let testVessel: ReturnType<typeof createVessel>;

  beforeEach(() => {
    testVessel = createVessel({
      name: 'Test Vessel',
      level: 5,
      attributes: createDefaultAttributes('intellect'),
      ancestry: 'elf-starborn',
      talent: 'ancestral-echo',
      gender: 'female',
      createdAtTick: 0,
    });
  });

  test('Vitals Decay: Vigor decreases based on CON', () => {
    const initialVigor = testVessel.vitals.vigor;
    FrictionManager.applyVitalsDecay(testVessel, 1.0, 1.0);

    expect(testVessel.vitals.vigor).toBeLessThan(initialVigor);
  });

  test('Vitals Decay: Nourishment affected by biome modifier', () => {
    const initialNourishment = testVessel.vitals.nourishment;

    FrictionManager.applyVitalsDecay(testVessel, 2.0, 1.0); // Desert biome (2x decay)

    // Should decay more than base rate
    expect(testVessel.vitals.nourishment).toBeLessThan(initialNourishment);
  });

  test('Information Lag: Low PER/WIS = high lag multiplier', () => {
    testVessel.attributes.PER = 6; // Low perception
    testVessel.attributes.WIS = 7; // Low wisdom

    const lag = FrictionManager.getInformationLagMultiplier(testVessel);

    expect(lag).toBeGreaterThan(0.5); // High lag
  });

  test('Information Lag: High PER/WIS = low lag multiplier', () => {
    testVessel.attributes.PER = 18;
    testVessel.attributes.WIS = 17;

    const lag = FrictionManager.getInformationLagMultiplier(testVessel);

    expect(lag).toBeLessThan(0.5); // Low lag
  });

  test('Perceived State: Low PER/WIS shows vague descriptors', () => {
    testVessel.attributes.PER = 6;
    testVessel.attributes.WIS = 7;
    testVessel.healthPoints = testVessel.maxHealthPoints * 0.5;

    const perceived = FrictionManager.getPerceivedVesselState(testVessel, false);

    expect(perceived.hasExactHealth).toBe(false);
    expect(perceived.healthPercent).toBeUndefined();
    expect(perceived.healthDescriptor).toBeDefined();
  });

  test('Perceived State: High PER/WIS shows exact values', () => {
    testVessel.attributes.PER = 18;
    testVessel.attributes.WIS = 17;
    testVessel.healthPoints = testVessel.maxHealthPoints * 0.5;

    const perceived = FrictionManager.getPerceivedVesselState(testVessel, false);

    expect(perceived.hasExactHealth).toBe(true);
    expect(perceived.healthPercent).toBeCloseTo(50, 1);
  });

  test('Health Descriptor: Perfect health at 100% HP', () => {
    const descriptor = FrictionManager.getHealthDescriptor(100);
    expect(descriptor).toBe(HealthDescriptor.PERFECT);
  });

  test('Health Descriptor: Dying at 5% HP', () => {
    const descriptor = FrictionManager.getHealthDescriptor(5);
    expect(descriptor).toBe(HealthDescriptor.DYING);
  });

  test('Vital Descriptor: Vibrant at 90%+', () => {
    const descriptor = FrictionManager.getVitalDescriptor(95);
    expect(descriptor).toBe(VitalDescriptor.VIBRANT);
  });

  test('Vital Descriptor: Critical at <20%', () => {
    const descriptor = FrictionManager.getVitalDescriptor(15);
    expect(descriptor).toBe(VitalDescriptor.CRITICAL);
  });

  test('Information Lag Roll Penalty: High lag reduces roll', () => {
    testVessel.attributes.PER = 6;
    testVessel.attributes.WIS = 7;

    const baseRoll = 15;
    const modifiedRoll = FrictionManager.applyInformationLagToRoll(testVessel, baseRoll);

    expect(modifiedRoll).toBeLessThan(baseRoll);
    expect(modifiedRoll).toBeGreaterThanOrEqual(1);
  });

  test('Batch Tick Interrupt: Characters with low PER are more likely ambushed', () => {
    testVessel.attributes.PER = 6; // Low perception

    // Run 100 checks with base 50% interrupt chance
    let interruptCount = 0;
    for (let i = 0; i < 100; i++) {
      if (FrictionManager.shouldInterruptBatchTick(testVessel, 0.5)) {
        interruptCount++;
      }
    }

    // With high PER bonus and 50% base, should interrupt frequently
    expect(interruptCount).toBeGreaterThan(40); // Rough check
  });

  test('Vitals Validation: Valid vessel passes validation', () => {
    const validation = FrictionManager.validateVitals(testVessel);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Vitals Validation: Out-of-bounds vitals fail validation', () => {
    testVessel.vitals.vigor = -10; // Invalid

    const validation = FrictionManager.validateVitals(testVessel);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

describe('ParadoxCalculator: Debt & Bias', () => {
  let tracker: ReturnType<typeof createParadoxTracker>;

  beforeEach(() => {
    tracker = createParadoxTracker('test-actor', 0);
  });

  test('Paradox Debt Calculation: Formula = Magnitude * (Info / Divergence)', () => {
    const event: ParadoxEventDetails = {
      actionType: 'timeline-warp',
      magnitude: 50,
      informationGained: 30,
      temporalDivergence: 10,
    };

    const debt = ParadoxCalculator.calculateDebtFromEvent(event);

    expect(debt).toBe(50 * (30 / 10)); // 150
  });

  test('Paradox Debt Calculation: Zero divergence = catastrophic debt', () => {
    const event: ParadoxEventDetails = {
      actionType: 'timeline-warp',
      magnitude: 50,
      informationGained: 30,
      temporalDivergence: 0,
    };

    const debt = ParadoxCalculator.calculateDebtFromEvent(event);

    expect(debt).toBeGreaterThan(1000); // Very high
  });

  test('Paradox State: 0-25% is WHISPER', () => {
    tracker.currentDebt = 20;

    const state = ParadoxCalculator.getParadoxState(tracker);
    expect(state).toBe(ParadoxDebtState.WHISPER);
  });

  test('Paradox State: 26-50% is BLEED', () => {
    tracker.currentDebt = 40;

    const state = ParadoxCalculator.getParadoxState(tracker);
    expect(state).toBe(ParadoxDebtState.BLEED);
  });

  test('Paradox State: 51-75% is BLEACH', () => {
    tracker.currentDebt = 65;

    const state = ParadoxCalculator.getParadoxState(tracker);
    expect(state).toBe(ParadoxDebtState.BLEACH);
  });

  test('Paradox State: 76%+ is REALITY_FAULT', () => {
    tracker.currentDebt = 80;

    const state = ParadoxCalculator.getParadoxState(tracker);
    expect(state).toBe(ParadoxDebtState.REALITY_FAULT);
  });

  test('Paradox Bias: WHISPER state = -1 penalty', () => {
    tracker.currentDebt = 20;

    const bias = ParadoxCalculator.calculateParadoxBias(tracker);

    expect(bias.rollPenalty).toBe(-1);
    expect(bias.shadowAttraction).toBe(0);
  });

  test('Paradox Bias: BLEACH state = -3 penalty + shadows', () => {
    tracker.currentDebt = 65;

    const bias = ParadoxCalculator.calculateParadoxBias(tracker);

    expect(bias.rollPenalty).toBe(-3);
    expect(bias.shadowAttraction).toBeGreaterThan(0);
  });

  test('Paradox Bias: REALITY_FAULT = -5 penalty', () => {
    tracker.currentDebt = 80;

    const bias = ParadoxCalculator.calculateParadoxBias(tracker);

    expect(bias.rollPenalty).toBe(-5);
  });

  test('Apply Paradox Bias to Roll: Penalty is applied', () => {
    tracker.currentDebt = 40; // BLEED state = -2 penalty

    const baseRoll = 15;
    const modifiedRoll = ParadoxCalculator.applyParadoxBiasToRoll(tracker, baseRoll);

    expect(modifiedRoll).toBe(13); // 15 + (-2)
  });

  test('Natural Decay Rate: Higher debt decays faster', () => {
    tracker.currentDebt = 50; // 50% debt

    const decayRate = ParadoxCalculator.calculateNaturalDecayRate(tracker);

    expect(decayRate).toBeGreaterThan(0.01); // More than base rate
  });

  test('Reality Fault Check: True when debt >= capacity', () => {
    tracker.currentDebt = 100;

    const isFault = ParadoxCalculator.isInRealityFault(tracker);

    expect(isFault).toBe(true);
  });

  test('Reality Fault Check: False when debt < capacity', () => {
    tracker.currentDebt = 50;

    const isFault = ParadoxCalculator.isInRealityFault(tracker);

    expect(isFault).toBe(false);
  });

  test('Attracted Shadows: 0 in WHISPER state', () => {
    tracker.currentDebt = 20;

    const shadows = ParadoxCalculator.calculateAttractedShadows(tracker);

    expect(shadows).toBe(0);
  });

  test('Attracted Shadows: 1-3 in BLEACH state', () => {
    tracker.currentDebt = 65;

    const shadows = ParadoxCalculator.calculateAttractedShadows(tracker);

    expect(shadows).toBeGreaterThanOrEqual(1);
    expect(shadows).toBeLessThanOrEqual(3);
  });

  test('Womb-Magic Reduction: Only applies if debt > 50', () => {
    tracker.currentDebt = 30; // Below threshold

    const reduction = ParadoxCalculator.applyWombMagicReduction(tracker, 5);

    expect(reduction).toBe(0); // No reduction
    expect(tracker.currentDebt).toBe(30); // Unchanged
  });

  test('Womb-Magic Reduction: Reduces debt proportionally to level', () => {
    tracker.currentDebt = 60;

    const reduction = ParadoxCalculator.applyWombMagicReduction(tracker, 1);

    expect(reduction).toBeGreaterThan(0);
    expect(tracker.currentDebt).toBeLessThan(60);
  });

  test('Record Paradox Event: Updates tracker debt', () => {
    const event: ParadoxEventDetails = {
      actionType: 'timeline-warp',
      magnitude: 50,
      informationGained: 30,
      temporalDivergence: 10,
    };

    const debt = ParadoxCalculator.recordParadoxEvent(tracker, event);

    expect(tracker.currentDebt).toBe(debt);
    expect(debt).toBe(150); // 50 * (30 / 10)
  });

  test('Reality Fault triggers when recording extreme event', () => {
    const event: ParadoxEventDetails = {
      actionType: 'death-undo',
      magnitude: 100,
      informationGained: 100,
      temporalDivergence: 1,
    };

    ParadoxCalculator.recordParadoxEvent(tracker, event);

    expect(tracker.inRealityFault).toBe(true);
  });

  test('Describe Paradox State: Provides readable description', () => {
    tracker.currentDebt = 40;

    const description = ParadoxCalculator.describeParadoxState(tracker);

    expect(description).toContain('Bleed');
    expect(description).toContain('40');
  });

  test('Paradox Tracker Validation: Valid tracker passes', () => {
    const validation = ParadoxCalculator.validateParadoxTracker(tracker);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Paradox Tracker Validation: Negative debt fails', () => {
    tracker.currentDebt = -10;

    const validation = ParadoxCalculator.validateParadoxTracker(tracker);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

describe('DSS Compliance Integration', () => {
  test('DSS 02.2.1 (Causal Lock): Prevents action during Conservation Check', async () => {
    const stack = createResolutionStack();

    const testVessel = createVessel({
      name: 'Test',
      level: 1,
      attributes: createDefaultAttributes('balanced'),
      ancestry: 'human-bloodline-alpha',
      talent: 'ancestral-echo',
      gender: 'female',
      createdAtTick: 0,
    });

    const lock = {
      actorId: testVessel.id,
      startedAtTick: 100,
      durationTicks: 1,
      reason: 'conservation_check' as const,
    };
    stack['causalLocks'].set(testVessel.id, lock);

    const context: TickContext = {
      currentTick: 100,
      worldState: {},
      actor: testVessel,
      paradoxTracker: createParadoxTracker(testVessel.id, 0),
      causalLocks: new Map([[testVessel.id, lock]]),
      playerIntent: {
        actorId: testVessel.id,
        actionType: 'move',
        submittedAtTick: 100,
      },
      phaseResults: [],
      informationLagMultiplier: 0,
    };

    await (stack as any).phase1_InputDecay(context);

    expect(context.phaseResults[0].success).toBe(false);
  });

  test('DSS 07.1.1 (Phase 0 Input): Discards replay attempts', async () => {
    const tracker = createParadoxTracker('test', 0);
    tracker.phase0Security.phase0InputDiscarded = true;

    const stack = createResolutionStack();
    const testVessel = createVessel({
      name: 'Test',
      level: 1,
      attributes: createDefaultAttributes('balanced'),
      ancestry: 'human-bloodline-alpha',
      talent: 'ancestral-echo',
      gender: 'female',
      createdAtTick: 0,
    });

    const context: TickContext = {
      currentTick: 100,
      worldState: {},
      actor: testVessel,
      paradoxTracker: tracker,
      causalLocks: new Map(),
      playerIntent: {
        actorId: testVessel.id,
        actionType: 'move',
        submittedAtTick: 100,
      },
      phaseResults: [],
      informationLagMultiplier: 0,
    };

    await (stack as any).phase1_InputDecay(context);

    expect(context.phaseResults[0].success).toBe(false);
    expect(context.phaseResults[0].invalidReason).toContain('Phase 0');
  });
});
