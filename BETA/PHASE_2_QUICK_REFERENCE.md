# Phase 2 Engine Quick Reference

## At a Glance

Three engines work together to power the 1.5-second game tick:

```
Player Input → ResolutionStack.processTick() → World State Changes
                      ↓
            Phase 1: Validate (Causal Lock check)
            Phase 2: NPCs act
            Phase 3: Resolve combat
            Phase 4: Apply damage
            Phase 5: Update factions & paradox
            Phase 6: Generate perception (FrictionManager)
                      ↓
            Perception → FrictionManager.getPerceivedVesselState()
            Paradox Bias → ParadoxCalculator.calculateParadoxBias()
                      ↓
            UI Display
```

## Import Statements

```typescript
// Resolution Stack (6-phase processor)
import {
  ResolutionStack,
  createResolutionStack,
  PlayerIntent,
  TickContext,
} from './engine/ResolutionStack';

// Vitals & Information Lag
import {
  FrictionManager,
  HealthDescriptor,
  VitalDescriptor,
} from './engine/FrictionManager';

// Paradox Debt & Bias
import {
  ParadoxCalculator,
  ParadoxDebtState,
} from './engine/ParadoxCalculator';
```

## Common Usage Patterns

### 1. Process One Game Tick

```typescript
const stack = createResolutionStack();

const context: TickContext = {
  currentTick: 100,
  worldState: myWorldState,
  actor: player,
  paradoxTracker: playerParadox,
  causalLocks: activeLocks,
  playerIntent: {
    actorId: player.id,
    actionType: 'attack',
    targetId: enemy.id,
    submittedAtTick: 99,
  },
  phaseResults: [],
  informationLagMultiplier: 0.5,
};

const result = await stack.processTick(context);

// result.phaseResults[0] = Phase 1 output
// result.phaseResults[1] = Phase 2 output
// ... etc
// result.phaseResults[5] = Phase 6 output (perception-filtered)
```

### 2. Get What the Player Sees (Not Exact Values)

```typescript
// Calculate information lag based on PER/WIS
const perceived = FrictionManager.getPerceivedVesselState(player);

// Low intelligence = don't see exact HP
if (perceived.hasExactHealth) {
  console.log(`HP: ${perceived.healthPercent}%`);
} else {
  console.log(`Condition: ${perceived.healthDescriptor}`); // "Wounded", "Dying", etc
}

// Injuries hidden if lag was high
console.log(`Visible wounds: ${perceived.visibleInjuries.length}`);
```

### 3. Apply Vitals Decay

```typescript
// Every tick, character loses resources
FrictionManager.applyVitalsDecay(player, conModifier, biomeModifier);

// Example: Desert trip with low CON
const conMod = 1 - (8 - 10) * 0.001; // Low CON = faster decay
const biomeMod = 1.5; // Desert harsh
FrictionManager.applyVitalsDecay(player, conMod, biomeMod);
```

### 4. Calculate Paradox Debt from Event

```typescript
// When player rewinds time
const debt = ParadoxCalculator.calculateDebtFromEvent({
  magnitude: 80,        // Death undo = high magnitude
  informationGained: 100, // Learned everything in undone timeline
  temporalDivergence: 5,   // Small divergence = expensive
});
// Result: 1600 debt (CATASTROPHIC)

// Apply to tracker
ParadoxCalculator.recordParadoxEvent(
  player.paradoxTracker,
  debt,
  'death_undo'
);
```

### 5. Apply Paradox Bias to d20 Roll

```typescript
// In combat
const baseRoll = 14; // Player rolled d20
const adjustedRoll = ParadoxCalculator.applyParadoxBiasToRoll(
  player.paradoxTracker,
  baseRoll
);
// If BLEACH state: 14 + (-2) = 12 (harder to hit)
```

### 6. Check If Actor Can Act (Causal Lock)

```typescript
import { isCausallyLocked } from './types';

if (isCausallyLocked(actor, Array.from(causalLocks.values()), currentTick)) {
  // Actor is locked (during death save), can't take actions
  console.log("Can't act - Under Causal Lock");
} else {
  // Actor is free to act
}
```

### 7. Start a Conservation Check (Death Save)

```typescript
import { performConservationCheck } from './types';

const result = performConservationCheck(actor, 3); // DC 3

if (result.success) {
  console.log("Survived! No lock applied.");
} else {
  console.log("Failed! Actor locked for 1 tick.");
  // Lock will be added to causalLocks by Phase 4
}
```

### 8. Heal with Womb-Magic (Paradox Reduction)

```typescript
// Priestess casts spell to reduce paradox
ParadoxCalculator.applyWombMagicReduction(
  tracker,
  spellLevel, // 1-10
  wombMagicPower // 0-1 scale
);
// Reduces debt by 0.05 * level * power (if debt > 50)
```

## State Objects

### TickContext
```typescript
interface TickContext {
  currentTick: number;           // e.g., 100
  worldState: any;               // Reference to world
  actor: Vessel;                 // Active character
  paradoxTracker: ParadoxTracker;
  causalLocks: Map<string, CausalLock>;
  playerIntent?: PlayerIntent;   // Optional action this tick
  validatedAction?: ValidatedAction;
  conflictEvent?: ConflictEvent;
  conservationCheck?: ConservationCheck;
  phaseResults: PhaseResult[];
  informationLagMultiplier: number;
}
```

### PhaseResult
```typescript
interface PhaseResult {
  phaseNumber: 1 | 2 | 3 | 4 | 5 | 6;
  tickNumber: number;
  success: boolean;
  message?: string;                   // "Action validated: attack"
  mutations?: any;                    // State changes
  invalidReason?: string;             // "Causal Lock active"
}
```

## Enums

### HealthDescriptor
```typescript
enum HealthDescriptor {
  PERFECT = "Perfect",             // 100%
  MINOR_WOUNDS = "Minor Wounds",   // 75-99%
  MANAGEABLE = "Manageable",       // 50-74%
  WOUNDED = "Wounded",             // 25-49%
  GRIEVOUS = "Grievous",           // 10-24%
  DYING = "Dying",                 // 1-9%
  DEAD = "Dead",                   // 0%
}
```

### VitalDescriptor
```typescript
enum VitalDescriptor {
  VIBRANT = "Vibrant",       // 90%+
  NORMAL = "Normal",         // 60-89%
  DIMINISHED = "Diminished", // 30-59%
  CRITICAL = "Critical",     // <30%
}
```

### ParadoxDebtState
```typescript
enum ParadoxDebtState {
  WHISPER = "WHISPER",           // 0-25% (no bonus)
  BLEED = "BLEED",               // 26-50% (-1 penalty)
  BLEACH = "BLEACH",             // 51-75% (-2 penalty)
  REALITY_FAULT = "REALITY_FAULT", // 76%+ (-5 penalty, forced reset)
}
```

## Configuration Constants

### Vitals Decay Rates (per 1.5s tick)
```typescript
VITAL_DECAY_RATES = {
  vigor: 1 / (60 * 60 * 60 * 60), // -1%/hr ÷ 2400 ticks
  nourishment: 2 / (60 * 60 * 60 * 60),
  sanity: 0.5 / (60 * 60 * 60 * 60),
};
```

### Paradox Bias Penalties
```typescript
PARADOX_STATE_PENALTIES = {
  WHISPER: { roll: -1, failureInflation: 0.05, shadows: 0 },
  BLEED: { roll: -2, failureInflation: 0.10, shadows: 0 },
  BLEACH: { roll: -3, failureInflation: 0.15, shadows: 3 },
  REALITY_FAULT: { roll: -5, failureInflation: 0.25, shadows: 5 },
};
```

### Information Lag Formula
```typescript
// lag = 1 - ((PER + WIS) / 40)
// 0 = perfect vision
// 1 = completely blind

// Visibility thresholds:
if (lag < 0.3) showExactStats();          // High PER/WIS
else if (lag < 0.7) showDescriptorsOnly();  // Medium PER/WIS
else showVagueText();                      // Low PER/WIS
```

## Testing Examples

```typescript
// From engine.resolution.test.ts

// Test that lock prevents action
const lock: CausalLock = {
  actorId: player.id,
  startedAtTick: 100,
  durationTicks: 1,
  reason: 'conservation_check',
};
context.causalLocks.set(player.id, lock);
await stack.processTick(context);
expect(context.phaseResults[0].success).toBe(false);

// Test perception lag
const lag = FrictionManager.getInformationLagMultiplier(character);
expect(lag).toBeGreaterThan(0.5); // Low INT = high lag

// Test paradox debt
const debt = ParadoxCalculator.calculateDebtFromEvent({
  magnitude: 50,
  informationGained: 30,
  temporalDivergence: 10,
});
expect(debt).toBe(150);

// Test state transition
ParadoxCalculator.recordParadoxEvent(tracker, 100, 'event');
expect(tracker.currentDebtState).toBe('BLEED'); // 26-50%
```

## Performance Tips

1. **Cache Perception**: Only recalculate when vessel state changes
```typescript
if (vessel.healthPoints !== lastHealth) {
  perceived = FrictionManager.getPerceivedVesselState(vessel);
}
```

2. **Batch Causal Lock Checks**: Convert Map to Array once per frame
```typescript
const lockArray = Array.from(causalLocks.values());
// Use lockArray in all isCausallyLocked() calls
```

3. **Parallelize Phase 2**: NPC AI decisions are independent
```typescript
// Phase 2 stub can become:
const npcPromises = npcs.map(npc => npc.decideTick());
await Promise.all(npcPromises);
```

4. **Profile Phase 6**: Info Synthesis grows with world size
```typescript
// Cache visibility calculations if world is large
const visibilityCache = new Map();
// Invalidate on actor move only
```

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Causal Lock active" | Player tried to act during death save | Wait - lock expires in 1 tick |
| Roll is unexpectedly low | Paradox debt at high level | Cast Womb-Magic to reduce debt |
| Exact HP suddenly hidden | PER/WIS dropped below threshold | Increase WIS through leveling |
| Performance drop after 100+ ticks | Locks not expiring | Check causalLocks cleanup in Phase 1 |

## Integration Checklist

- [ ] Import ResolutionStack, FrictionManager, ParadoxCalculator
- [ ] Create TickContext with all required fields
- [ ] Call stack.processTick(context) each game frame
- [ ] Process phaseResults[5] for perception-filtered state
- [ ] Update UI with FrictionManager.getPerceivedVesselState()
- [ ] Apply Paradox bias in combat rolls
- [ ] Track Causal Locks during Conservation Checks
- [ ] Run jest tests before commit

---

**Last Updated**: 2026-01-15  
**For Questions**: See PHASE_2_INTEGRATION_GUIDE.md
