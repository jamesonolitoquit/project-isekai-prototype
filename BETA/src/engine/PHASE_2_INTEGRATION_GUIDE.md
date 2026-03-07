# Phase 2 Engine Core Integration Guide

## Overview

Phase 2 implements the **runtime execution layer** for the game engine. While Phase 1 defined the data structures (types), Phase 2 brings them to life through three coordinated engine systems:

1. **ResolutionStack** - The 6-phase tick processing loop
2. **FrictionManager** - Vitals decay and information perception
3. **ParadoxCalculator** - Paradox debt and temporal bias

Together, these systems implement the complete gameplay flow shown in the mermaid diagram: initialization → continuous async → conflict resolution → reincarnation.

## Architecture Overview

```
                    ┌─────────────────────────┐
                    │   GAME TICK (1.5s)      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐         ┌────────▼────────┐      ┌───────▼────┐
    │ ResDemo │         │  Friction       │      │  Paradox   │
    │ Stack   │         │  Manager        │      │  Calc      │
    │         │         │                 │      │            │
    │ 6-Phase │ ◄──────│ Vitals Decay    │      │ Debt Bias  │
    │ Loop    │         │ Info Lag        │      │ Shadows    │
    └────┬────┘         └─────────────────┘      └────────────┘
         │
         │ Output
         │
    ┌────▼──────────────────────────┐
    │ Perceived World State          │
    │ - Exact/Vague Data             │
    │ - Causal Locks                 │
    │ - Conservation Checks          │
    │ - Paradox Status               │
    └────────────────────────────────┘
         │
         ▼
    ┌─────────────────┐
    │  UI / Player    │
    └─────────────────┘
```

## System Descriptions

### 1. ResolutionStack: The 6-Phase Tick Loop

**Purpose**: Process all state changes in a mathematically rigorous order that prevents race conditions and maintains causality.

**The 6 Phases** (executed each 1.5s tick):

#### Phase 1: Input Decay
- **Input**: Player action intent
- **Checks**: 
  - Is actor under Causal Lock (DSS 02.2.1)?
  - Was Phase 0 input discarded (DSS 07.1.1)?
- **Output**: Validated action or rejection
- **Rules**: If validation fails, action is dropped

#### Phase 2: World AI Drift
- **Input**: NPC decision trees, faction AI
- **Processing**: Calculate NPC actions
- **Output**: NPC intents (move, attack, interact)
- **Rules**: Autonomous actors execute their goals

#### Phase 3: Conflict Resolution
- **Input**: Validated actions from Phases 1 & 2
- **Processing**: Resolve d20 rolls, skill checks, combat
- **Output**: ConflictEvent (hit/miss, damage, outcome)
- **Rules**: Paradox bias is applied to rolls

#### Phase 4: Commit & RNG
- **Input**: ConflictEvent from Phase 3
- **Processing**: Apply damage, generate injuries, trigger Conservation Check
- **Output**: State mutations (damage committed, lock applied)
- **Critical**: This phase is atomic—no further validation after Phase 4

#### Phase 5: Ripple & Paradox
- **Input**: Conflict outcomes
- **Processing**: Update faction reputation, accumulate paradox debt
- **Output**: Ripple effects propagate to world
- **Rules**: Paradox bias calculated here, affects Phase 3 of NEXT tick

#### Phase 6: Info Synthesis
- **Input**: True world state from all previous phases
- **Processing**: Apply information lag filters
- **Output**: PerceivedVesselState (vague or exact data for UI)
- **Critical**: Does NOT mutate state; only formats for display

**Key Properties**:
- **Stricter Ordering**: Phase N must complete before Phase N+1
- **Determinism**: Same RNG seed = same outcome
- **Causality**: Physics always precedes observation

### 2. FrictionManager: Vitals & Perception

**Purpose**: Implement "realism friction"—mechanical overhead that prevents power-gaming and creates meaningful challenge.

**Three Core Systems**:

#### Vitals Decay (DSS 02.1)
Simulates entropy: characters must eat, rest, and manage psychology.

```typescript
// Per tick (1.5s):
Vigor Decay = -1%/hr * CON_Modifier
  // CON modifier = 1 - (CON_Bonus * 0.001%)
  // Example: CON 14 (+2) → 0.998 multiplier → -0.00042 per tick

Nourishment Decay = -2%/hr * Biome_Modifier
  // Desert = 1.5x, City = 0.6x

Sanity Decay = -0.5%/hr * Paradox_Modifier
  // Modified by ParadoxCalculator based on state
```

The system enforces **resource management**:
- Below 30% Nourishment: HP & Stamina caps reduced
- Below 20% Vigor: Damage output reduced (via status effects)
- Below 30% Sanity: Skill checks harder (via information lag)

#### Information Lag (Fog of War)
Players don't have perfect information. What they see depends on perception stats.

```typescript
// Calculation:
Information Lag Multiplier = 1 - ((PER + WIS) / 40)
  // 0 = perfect info, 1 = completely obscured

// Visibility Rules:
if (lag < 0.3):        // High PER/WIS
  show exact HP/Vitals
else if (lag < 0.7):   // Med PER/WIS
  show descriptors only ("Weakened" vs "Vigor: 45%")
else:                  // Low PER/WIS
  show vague text only
```

**Examples**:
- WIS 18, PER 17 → lag 0.05 → Exact stats always visible
- WIS 10, PER 10 → lag 0.5 → Need to examine self to see injuries
- WIS 6, PER 6 → lag 0.85 → Many injuries hidden unless examined

#### Perceived State Generation
Converts true world state into player-visible state:

```typescript
PerceivedVesselState {
  hasExactHealth: boolean
  healthDescriptor: "Perfect" | "Minor Wounds" | ... | "Dead"
  healthPercent?: number      // Only if hasExactHealth
  
  visibleInjuries: Injury[]   // Filtered by lag
  hasExamined: boolean        // Did player take Self-Examine action?
}
```

### 3. ParadoxCalculator: Temporal Debt & Bias

**Purpose**: Calculate and enforce the cost of temporal manipulation to prevent infinite time rewinding.

**Core Formula** (DSS 03.1):
```
Paradox Debt = EventMagnitude * (InformationGained / TemporalDivergence)

Examples:
- Timeline Warp (mag 50, info 30, div 10) = 150 debt
- Decision Undo (mag 20, info 40, div 50) = 16 debt
- Death Undo (mag 80, info 100, div 5) = 1600 debt ← CATASTROPHIC
```

**Paradox States**:
| State | Debt % | Roll Penalty | Effects |
|-------|--------|--------------|---------|
| WHISPER | 0-25% | -1 | NPCs unrest |
| BLEED | 26-50% | -2 | Environmental NPC unrest |
| BLEACH | 51-75% | -3 | Shadow entities attracted |
| REALITY_FAULT | 76%+ | -5 | Forced Vessel Reset |

**Shadow Entities**: NPCs that spawn to "correct" the timeline
- BLEACH: 1-3 shadows
- REALITY_FAULT: 5+ shadows

**Natural Decay**:
```typescript
// Reality heals itself faster at high debt
Decay Rate = 0.01 * (1 + DebtPercent / 200)

// At 0% debt: 0.01 per tick (very slow)
// At 50% debt: 0.0125 per tick (25% faster)
// At 100% debt: 0.015 per tick (50% faster)
```

**Womb-Magic Integration** (DSS 16 Patch 2):
- Reduces paradox debt by 0.05 per cast (5% of capacity)
- Only works if current debt > 50
- Effectiveness scales with spell level (1x at level 1, 1.9x at level 10)

## Complete Gameplay Loop Example

### Scenario: Scholar Studies in a Tavern

**Tick 0**: Scholar casts "Chronos Study" (Batch Tick) to skip 8 hours

```typescript
// Phase 1: Input Decay
playerIntent = {
  actionType: "study",
  payload: { mode: "batch", hours: 8 }
}
// Validation: Is scholar under Causal Lock? No. Phase 0 discarded? No.
✓ Action validated

// Phase 2: World AI Drift
// Faction army approaches the tavern
npcArmy.move("towards_tavern")

// Phase 3: Conflict Resolution
// Interrupt check: shouldInterruptBatchTick(scholar)?
// Scholar PER=14, WIS=15 → lag 0.25 → High awareness
// Army approach detected! Interrupt triggered
conflictEvent = {
  attacker: npcArmy,
  defender: scholar,
  d20Roll: 14, // Army rolls to ambush
  // ...
}

// Phase 4: Commit & RNG
// Army hits scholar for 12 damage
scholar.healthPoints -= 12  // 49 - 12 = 37/49

// Phase 5: Ripple & Paradox
// Army gains faction reputation
// Scholar's Paradox Debt unchanged (no temporal manipulation)

// Phase 6: Info Synthesis
// Scholar with WIS 15, PER 14 sees exact HP
perceivedState = {
  hasExactHealth: true,
  healthPercent: 75.5  // 37/49
  healthDescriptor: "Manageable"
}
```

**UI Output**:
```
You were ambushed while studying!
[Health: 37/49 (75.5%)]
Attacker: Faction Army
Damage: 12
```

---

## Integration with Existing Code

### With worldEngine.ts

```typescript
import { createResolutionStack, type TickContext } from './ResolutionStack';

export class WorldEngine {
  private resolutionStack = createResolutionStack();

  async processTick(worldState: any, playerAction: PlayerIntent) {
    const context: TickContext = {
      currentTick: this.currentTick,
      worldState,
      actor: this.activeVessel,
      paradoxTracker: this.paradoxTracker,
      causalLocks: this.causalLocks,
      playerIntent: playerAction,
      phaseResults: [],
      informationLagMultiplier: 0,
    };

    const result = await this.resolutionStack.processTick(context);

    // Apply state mutations from phases
    this.applyPhaseResults(result.phaseResults);

    return result.phaseResults;
  }
}
```

### With UI Components

```typescript
import { FrictionManager } from './FrictionManager';

export function HUDVitals({ vessel }: { vessel: Vessel }) {
  const perceived = FrictionManager.getPerceivedVesselState(vessel);

  return (
    <div>
      {perceived.hasExactHealth ? (
        <div>HP: {perceived.healthPercent?.toFixed(1)}%</div>
      ) : (
        <div>Health: {perceived.healthDescriptor}</div>
      )}
      {perceived.visibleInjuries.map(inj => (
        <div key={inj.id}>{inj.description}</div>
      ))}
    </div>
  );
}
```

### With Combat Resolution

```typescript
import { ParadoxCalculator } from './ParadoxCalculator';

export function resolveAttack(
  attacker: Vessel,
  defender: Vessel,
  baseD20: number,
  paradoxTracker: ParadoxTracker
) {
  // Apply paradox bias to attacker's roll
  const d20 = ParadoxCalculator.applyParadoxBiasToRoll(
    paradoxTracker,
    baseD20
  );

  const adjustedDC = ParadoxCalculator.adjustDifficultyByParadox(
    defender.ac,
    paradoxTracker
  );

  return d20 >= adjustedDC; // Hit/miss
}
```

## Testing Strategy

### Unit Tests
Located in `src/__tests__/engine.resolution.test.ts`

**Coverage**:
- Phase ordering validation
- Causal Lock enforcement
- Information lag calculations
- Paradox bias application
- Vitals decay formulas
- DSS compliance checks

**Run**:
```bash
npm test -- engine.resolution.test.ts
```

### Integration Tests (Future)
- Full 6-phase tick with multiple actors
- Paradox debt accumulation over many ticks
- Reincarnation flow with Echo Point inheritance
- Batch Ticking interruption scenarios

## Performance Considerations

### Tick Processing
- Typical 6-phase tick: ~5-10ms on modern hardware
- Phase 6 (Info Synthesis) is heaviest due to perception filters
- Parallelize Phase 2 (World AI) across worker threads for large NPC counts

### Information Lag Calculation
- Cheap operation: O(1)
- Cache result for entire frame if vessel state unchanged

### Perception Map (Phase 6)
- O(n) where n = number of locations
- Only recalculate if vessel moved
- Use spatial hashing for large worlds

## DSS Compliance Matrix

| DSS | System | Coverage |
|-----|--------|----------|
| 00 | Time Ontology | ResolutionStack (6-phase) |
| 01 | Growth | ParadoxCalculator bias to rolls |
| 02 | Survival | FrictionManager vitals + Causal Lock |
| 03 | Temporal | ParadoxCalculator debt formula |
| 04-15 | Other | Stub implementations in Phase 2 & 3 only |
| 16 | Genesis | Womb-Magic integration in ParadoxCalculator |

## Next Steps (Phase 3)

Phase 3 will implement the missing NPC/Faction systems:

1. **AITacticEngine**: Phase 2 World AI Drift
2. **FactionEngine**: Faction multiplier system
3. **SkillResolutionEngine**: Phase 3 actual skill checks
4. **ReincarnationEngine**: Legacy persistence

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-15  
**Author**: Core Engine Team
