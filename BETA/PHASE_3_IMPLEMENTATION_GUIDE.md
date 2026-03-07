# Phase 3: Factions, Territory & Divine Systems - Implementation Guide

**Status**: ✅ SCHEMA & PRIMARY ENGINE COMPLETE  
**Date**: 2026-01-15  
**Compilation**: 0 Errors  
**Files Created**: 4 Type Schemas + 1 AI Engine

## Overview

Phase 3 expands the game from a "Single-Actor Simulation" to a "Living World" where Factions, Territory, and Deities exert pressure on the player's survival. This phase implements the macro-scale governance systems that manage world simulation outside the player's immediate control.

**Key Concept**: While Phase 2 (ResolutionStack) processes a single 1.5-second tick for combat/vitals/perception, Phase 3 governs what all other factions and territories are doing during that same tick.

## Completed Components

### 1. Faction Type Schemas (factions.ts) ✅

**Purpose**: Define faction entities and their resource management

**Key Types**:

#### `SocialWeightModifier` (DSS 16)
Gender-based ActionBudget contribution:
- Female: +15% multiplier
- Male: -10% multiplier  
- Non-binary: 1.0x (baseline)

#### `ActionBudget` (DSS 04)
Faction's resource pool for executing high-impact actions
```typescript
interface ActionBudget {
  factionId: string;
  currentPoints: number;      // 0-1000
  maxCapacity: number;
  generationBreakdown: {
    territoryControl: number;     // +10 per location
    covenantParticipation: number; // +5 per covenant
    divineFaith: number;          // +2 per faith point
    factionCharism: number;       // +CHA × 0.5
    stability: number;            // +0-40 linear
    socialWeight: number;         // Male -10%, Female +15%
  };
  actionCooldowns: Map<string, number>;
}
```

#### `ActiveFaction`
Complete faction state combining seed data with runtime AI
- Territory control list
- Power score (0-100)
- Leader characteristics & social weight
- Action budget & cooldowns
- AI state (aggressive/defensive/diplomatic)
- Social record & relationships
- Divine alignment & faith

#### `FactionAIState`
Decision-making context
```typescript
interface FactionAIState {
  state: 'aggressive' | 'defensive' | 'diplomatic' | 'dormant';
  threatAssessment: Map<string, number>;      // Per faction threat level
  militaryConfidence: number;                  // Based on territory+garrison
  diplomacyReputation: number;                 // Average reputation
  internalMorale: number;                      // Affects action efficiency
}
```

**Helper Functions**:
- `applySocialWeightModifier()` - Apply gender bonus/penalty to budget generation
- `calculateDailyBudgetGeneration()` - Full formula with all modifiers
- `createActionBudget()` - Initialize new budget
- `isActionOnCooldown()` - Check action availability
- `canAffordAction()` - Verify sufficient budget

**Available Actions** (from `FACTION_ACTION_TYPES`):
```typescript
CONQUER_TERRITORY:      { cost: 50, cooldown: 1800 ticks }  // 48 hours
SKIRMISH:               { cost: 20, cooldown: 900 ticks }   // 24 hours
FORTIFY:                { cost: 30, cooldown: 900 ticks }
NEGOTIATE_ALLIANCE:     { cost: 15, cooldown: 600 ticks }   // 16 hours
TRADE_CARAVAN:          { cost: 25, cooldown: 600 ticks }
DIVINE_MIRACLE:         { cost: 100, cooldown: 720 ticks }  // 12 hours
```

---

### 2. Territory Type Schemas (geography.ts) ✅

**Purpose**: Define territorial mechanics, stability, and information lag

**Key Types**:

#### `StabilityMetric`
Measures how stable a territory is (0-100)
```typescript
interface StabilityMetric {
  current: number;                // 0-100
  threatLevel: number;            // rival factions nearby
  insurgentPopulation: number;    // % opposing control
  economicDisruption: number;     // from wars/disasters
  demoralizedPopulation: number;  // from high taxes
  recoveryRate: number;           // natural healing per tick
  trend: 'improving' | 'stable' | 'declining' | 'critical';
}
```

#### `TerritoryInformationLag` (DSS 05 Fog of War)
Composite fog combining environment + politics + divine factors
```typescript
interface TerritoryInformationLag {
  baseMultiplier: number;          // 0-1
  environmentalModifier: number;   // terrain/weather
  politicalModifier: number;       // instability/spies
  divineModifier: number;          // high faith = clearer visions
  composite: number;               // final fog value
}
```

Integrates with FrictionManager's information lag system to create **regional fog of war**.

#### `TaxSystem` (DSS 05)
How much a territory generates per tick/day
```typescript
interface TaxSystem {
  rate: number;                    // 0-1.0
  expectedMonthlyRevenue: number;
  compliance: 'cooperative' | 'resentful' | 'defiant' | 'rebellious';
  willingness: number;             // 0-100, <20 = insurgency risk
}

// Formula: (population × 5) × (stability / 100) × (taxRate) × willingness
```

#### `RegionalHazard`
Factors affecting character vitals decay in territory
```typescript
interface RegionalHazard {
  type: 'climate' | 'disease' | 'radiation' | 'magic' | 'political';
  vigorDecayMultiplier: number;
  nourishmentDecayMultiplier: number;
  sanityDecayMultiplier: number;
  canAdapt: boolean;
}
```

#### `TerritoryNode`
A single region in the game world
```typescript
interface TerritoryNode {
  id: string;
  name: string;
  nodeType: 'settlement' | 'wilderness' | 'shrine' | 'stronghold' | 'hub' | 'ruin';
  biome: 'grassland' | 'forest' | 'desert' | 'mountain' | 'swamp' | 'urban' | 'coast';
  
  // Control & Influence
  controllingFactionId?: string;
  influenceMap: Map<string, number>;  // factionId -> influence (0-100)
  isFactionCapital: boolean;
  
  // Stability & Fog
  stability: StabilityMetric;
  informationLag: TerritoryInformationLag;
  hazards: RegionalHazard[];
  
  // Resources & Population
  population: number;
  resourceNodes: { wood, metal, herbs, water };
  resourceRegenerationRate: number;
  
  // Military & Defense
  garrisonSize: number;
  fortificationLevel: number;  // 0-5 defense rating
}
```

**Helper Functions**:
- `getControlThreshold()` - Influence level needed to control territory
- `calculateTaxRevenue()` - Revenue formula with stability/compliance factors
- `updateTerritoryStability()` - Apply stability changes with trend tracking
- `getVitalsDecayMultipliers()` - All regional hazards combined
- `calculateTerritoryInformationLag()` - Compute final fog value
- `createTerritoryNode()` - Initialize new territory

---

### 3. Divine Type Schemas (divine.ts) ✅

**Purpose**: Implement deity mechanics, covenants, and miracles

**Key Types**:

#### `Deity` (DSS 06)
Divine entity with faith management
```typescript
interface Deity {
  id: string;
  name: string;
  domain: string;  // "Death", "Motherhood", "Trickery"
  alignment: 'lawful' | 'neutral' | 'chaotic';
  
  totalFaithMass: number;              // 0-10000 accumulated faith
  faithByWorshipper: Map<string, number>;
  faithThreshold: number;              // Minimum to grant miracles
  canGrantMiracles: boolean;           // true if active & > threshold
  miracleCost: number;
}
```

#### `Miracle` (DSS 06)
Divine intervention execution
```typescript
interface Miracle {
  id: string;
  deityId: string;
  type: 'heal' | 'blessing' | 'revelation' | 'summoning' | 'transmutation';
  cost: number;              // faith cost
  requestorId: string;
  targetId?: string;
  durationTicks: number;     // 0 = instant
  isActive: boolean;
}
```

#### `Covenant` (DSS 06)
Binding agreement with deity
```typescript
interface Covenant {
  id: string;
  type: 'soul-reprieve' | 'maternal-blessing' | 'ancestral-echo' | 'divine-protection' | ...;
  deityId: string;
  binderId: string;
  
  initiationCost: number;        // one-time faith cost
  maintenanceCostPerTick: number; // ongoing drain
  isActive: boolean;
  
  bonuses: {
    sanityRecoveryPerTick?: number;
    chaBonus?: number;
    damageReduction?: number;
    faithMultiplier?: number;
  };
  
  restrictions: string[];        // cannot harm priests, etc
  requiredQuests: string[];
}
```

#### `SoulsReprieveCovenant` (DSS 06 + Sanity Recovery)
Matriarchal Genesis specific covenant
```typescript
interface SoulsReprieveCovenant extends Covenant {
  type: 'soul-reprieve';
  sanityRecoveryPerTick: number;
  sanityRecoveryCap: number;
  initialSanityRestore: number;  // restore on activation
  hasActiveSanityCheck: boolean;
}

// Matches ParadoxCalculator debt, provides counter-mechanic
```

#### `FaithMassTracker` (DSS 06)
Tracks faith accumulation and decay
```typescript
interface FaithMassTracker {
  deityId: string;
  worshipperId: string;
  current: number;
  capacity: number;
  
  generationBreakdown: {
    territoryControl: number;      // +5 per location
    covenantParticipation: number; // +10 per covenant
    faithfulActs: number;          // +2 per act
    rituals: number;               // +50 per ritual
  };
  
  decayPerDay: number;  // 1% of current per day
  supportedCovenantIds: string[];  // covenants this faith maintains
}

// Formula: Generation - (Current × 0.01) per day
```

#### `GreatMotherDeity` (DSS 16)
Specialized deity for Matriarchal Genesis
```typescript
interface GreatMotherDeity extends Deity {
  id: 'great-mother';
  favorsMatriarchy: boolean;
  matriarchialBonusMultiplier: number;  // +10% for female-led factions
  
  uniqueMiracles: {
    ancestralEchoAwakening: boolean;
    wombKindnessFertility: boolean;
    maternalInterposition: boolean;
    inheritanceReaffirmation: boolean;
  };
}
```

**Helper Functions**:
- `calculateDailyFaithGeneration()` - Full formula with all sources
- `calculateDailyFaithDecay()` - 1% baseline decay
- `canGrantMiracle()` - Check availability
- `createSoulsReprieveCovenant()` - Initialize sanity recover covenant
- `createFaithMassTracker()` - Initialize faith tracking
- `createGreatMotherDeity()` - Create Genesis template deity

---

### 4. FactionAIManager Engine (FactionAIManager.ts) ✅

**Purpose**: Execute Phase 2 (World AI Drift) for autonomous faction actions

**Execution Flow**:

```
processFactionTurn()
  ├─ For each faction:
  │  ├─ Regenerate ActionBudget (territory + covenants + faith + stability)
  │  ├─ Update AI state (threat assessment, military confidence, diplomacy rep)
  │  ├─ Decide actions (based on AI state strategy)
  │  ├─ Execute affordable actions
  │  │  ├─ Update territory influence
  │  │  ├─ Record events
  │  │  └─ Set action cooldowns
  │  └─ Track budget changes
  └─ Return Phase2WorldDriftResult with all faction activities
```

**Decision-Making Strategies**:

1. **Aggressive State**: Expand territory
   - Get expansion targets (adjacent territories with high influence)
   - Try CONQUER_TERRITORY (90% confidence) or SKIRMISH (60%)
   - Raid neighboring territories

2. **Defensive State**: Fortify and protect
   - Identify threatened territories
   - FORTIFY actions on territories under attack (+5 stability)
   - Build garrison strength

3. **Diplomatic State**: Build relationships
   - Identify non-hostile factions
   - NEGOTIATE_ALLIANCE proposals (50% success)
   - Reduce threat through treaties

4. **Economic Activity**: Trade & resource generation
   - TRADE_CARAVAN (80% success)
   - STIMULATE_PRODUCTION
   - Build wealth for future actions

5. **Divine Activity**: Faith-based miracles
   - Only if faction has patron deity and faith > 100
   - DIVINE_MIRACLE or MASS_AWAKENING (30% probability)

**State Transitions**:
- Military Confidence > 70 + Threats exist → **Aggressive**
- Max threat > 60 → **Defensive**
- Territory < 3 → **Aggressive** (expansion mode)
- Otherwise → **Diplomatic**

**Key Methods**:
- `processFactionTurn()` - Main entry point called from ResolutionStack.phase2_WorldAIDrift()
- `regenerateActionBudget()` - Apply daily generation formula
- `updateFactionAIState()` - Recalculate threats, confidence, reputation
- `decideFactionActions()` - Strategy-based action planning
- `getExpansionTargets()` - Find territories to conquer
- `canConquerTerritory()` - Check military viability
- `executeAction()` - Update world state based on action choice

**Result Output** (`Phase2WorldDriftResult`):
```typescript
{
  factionDecisions: [],           // What factions decided to do
  territoryInfluenceShifts: [],   // How territory control changed
  conflictEvents: [],             // Skirmishes, wars
  budgetUpdates: [],              // Budget changes per faction
}
```

---

## Integration with Phase 2

**Call Site in ResolutionStack**:

```typescript
// Phase 2: World AI Drift
private async phase2_WorldAIDrift(context: TickContext): Promise<void> {
  const aiManager = createFactionAIManager(this.rng);
  
  const result = await aiManager.processFactionTurn(
    this.allFactions,
    this.territories,
    this.factionRelationships,
    this.deities,
    this.worldStability,
    context.currentTick
  );
  
  // Apply results to context for Phase 5 processing
  // ...
}
```

**Output Usage in Phase 5 (Ripple & Paradox)**:
- Territory influence shifts processed
- Faction relationships updated
- Faction power scores recalculated
- Events queued for narrative system

---

## Specifications by DSS Rules

| DSS Rule | Component | Implementation |
|----------|-----------|-----------------|
| 04 | ActionBudget formula | `calculateDailyBudgetGeneration()` |
| 04 | Faction AI autonomy | `FactionAIManager.decideFactionActions()` |
| 04 | Social weight (DSS 16) | `applySocialWeightModifier()` for +15%/-10% |
| 05 | Territory control threshold | `getControlThreshold()` (base 60, affected by stability) |
| 05 | Tax collection formula | `calculateTaxRevenue()` with stability/compliance |
| 05 | Information lag (fog of war) | `TerritoryInformationLag.composite` |
| 05 | Vitals decay by region | `getVitalsDecayMultipliers()` hazard stacking |
| 06 | Faith mass generation | `calculateDailyFaithGeneration()` formula |
| 06 | Faith mass decay | `calculateDailyFaithDecay()` (1% per day) |
| 06 | Soul's Reprieve covenant | `SoulsReprieveCovenant` with sanity recovery |
| 06 | Miracle execution | `Miracle` type + cost system |
| 16 | Matriarchal social weight | Gender multiplier in ActionBudget |
| 16 | Great Mother deity | `GreatMotherDeity` with `matriarchialBonusMultiplier` |
| 16 | Genesis template covenants | Foundation for covenant system |

---

## Type Compilation Status

✅ **factions.ts**: 0 errors (760 lines)
✅ **geography.ts**: 0 errors (820 lines)
✅ **divine.ts**: 0 errors (650 lines)
✅ **FactionAIManager.ts**: 0 errors (680 lines)
✅ **types/index.ts**: Updated with all exports, 0 errors

---

## Next Steps (Phase 3 Continuation)

### Immediate (Next 1-2 hours):
1. **GeographyManager.ts** - Implement territory stability updates and tax revenue
2. **DivineManager.ts** - Covenant activation, miracle execution, faith decay
3. **Phase 2 Integration Tests** - Verify FactionAIManager executes correctly in tick loop

### Short-term (Next 4 hours):
1. **Implement Phase 5 (Ripple & Paradox) expansion** - Process faction events from Phase 2
2. **Create TerritoryController.ts** - Consolidate territory control changes
3. **Build faction relationship system** - Track and evolve faction relationships
4. **Create stress tests** - Run 1000-tick simulations to verify budget/faith don't break

### Medium-term (Next 8 hours):
1. **Write unit tests** for all Phase 3 engines (similar to Phase 2 test suite)
2. **Integrate with worldEngine.ts** - Hook FactionAIManager into main game loop
3. **Implement NPC decision-making** - Connect to Phase 2 World AI Drift
4. **Create debug UI** - Visualize faction AI states and territory control

### Before Production:
1. **Stress test**: 10,000-tick run with 20+ factions
2. **Verify DSS compliance**: All formulas match specifications
3. **Check performance**: Ensure Phase 2 doesn't exceed 5ms per tick
4. **Edge case validation**: Empty territories, eliminated factions, deity death

---

## Known Limitations & Assumptions

**Limitations**:
- FactionAIManager makes decisions based on limited information (doesn't see player state)
- Territory control threshold is static; could be made dynamic
- Covenants are defined but not yet integrated into faith decay calculations
- Divine miracles are placeholder; actual effects not implemented
- NPC leaders not yet assigned to factions

**Assumptions**:
- Factions have clear strategic preferences (aggressive/defensive/diplomatic)
- Territory influence is purely additive (no negative influence warfare)
- Faith mass is unlimited (no overflow checks yet)
- Budget regeneration happens once per day (1/2400 per tick)
- All factions have same decision logic (no personality variance)

**Stress Test Concerns** (from DSS 16 research):
- Can male characters exploit Womb-Magic to trivialize Matriarchal hierarchy?
- Can factions with high fuel generation execute unlimited high-impact actions?
- Can a player spam Ancestral Echo triggers for infinite +2 CHA bonus?
- Can faith mass infinitely inflate or hit 0 without player intervention?

These will be addressed in unit/stress tests.

---

## File Structure

```
BETA/src/types/
├── factions.ts              (760 lines) ✅ NEW
│   ├── SocialWeightClass
│   ├── ActionBudget
│   ├── ActiveFaction
│   ├── FactionAIState
│   └── Helper functions
├── geography.ts             (820 lines) ✅ NEW
│   ├── StabilityMetric
│   ├── TerritoryNode
│   ├── TerritoryInformationLag
│   ├── TaxSystem
│   └── Helper functions
├── divine.ts                (650 lines) ✅ NEW
│   ├── Deity
│   ├── Covenant
│   ├── SoulsReprieveCovenant
│   ├── GreatMotherDeity
│   └── Helper functions
└── index.ts                 ✅ UPDATED (exports)

BETA/src/engine/
├── FactionAIManager.ts      (680 lines) ✅ NEW
│   ├── FactionAIManager class
│   ├── Phase2WorldDriftResult
│   └── Autonomous faction decision-making

BETA/src/engine/PHASE_2_INTEGRATION_GUIDE.md
BETA/PHASE_2_COMPLETION_REPORT.md
BETA/PHASE_2_QUICK_REFERENCE.md
BETA/PHASE_3_IMPLEMENTATION_GUIDE.md (THIS FILE)
```

---

**Document Version**: 1.0  
**Status**: Implementation Guide - Schema Complete  
**Next Phase**: GeographyManager & DivineManager Implementation
**Estimated Completion**: 4 hours
