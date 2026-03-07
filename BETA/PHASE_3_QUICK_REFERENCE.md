# Phase 3: Quick Reference Guide

## Import Statements

```typescript
// Faction Types & Utilities
import {
  ActiveFaction,
  ActionBudget,
  FactionAIState,
  FactionRelationship,
  SocialWeightClass,
  FACTION_ACTION_TYPES,
  calculateDailyBudgetGeneration,
  applySocialWeightModifier,
  createActionBudget,
  canAffordAction,
} from '@/types/factions';

// Territory Types & Utilities
import {
  TerritoryNode,
  StabilityMetric,
  TerritoryInformationLag,
  RegionalHazard,
  getControlThreshold,
  calculateTaxRevenue,
  updateTerritoryStability,
  getVitalsDecayMultipliers,
  createTerritoryNode,
} from '@/types/geography';

// Divine Types & Utilities
import {
  Deity,
  Covenant,
  SoulsReprieveCovenant,
  FaithMassTracker,
  calculateDailyFaithGeneration,
  calculateDailyFaithDecay,
  createSoulsReprieveCovenant,
  createGreatMotherDeity,
} from '@/types/divine';

// Faction AI Manager
import {
  FactionAIManager,
  createFactionAIManager,
  Phase2WorldDriftResult,
} from '@/engine/FactionAIManager';
```

## Common Usage Patterns

### 1. Initialize Factions for World

```typescript
const factions: ActiveFaction[] = [
  {
    id: 'faction-crown',
    name: 'Crown Authority',
    templateId: 'genesis-template',
    leaderSocialWeight: 'female',
    controlledLocationIds: ['capital-city', 'fort-north'],
    powerScore: 75,
    actionBudget: createActionBudget('faction-crown', 500),
    aiState: {
      state: 'aggressive',
      threatAssessment: new Map(),
      militaryConfidence: 65,
      diplomacyReputation: 20,
      internalMorale: 80,
      lastDecisionTick: 0,
    },
    // ... other fields
  },
  // More factions
];
```

### 2. Execute Phase 2 World AI Drift

```typescript
const aiManager = createFactionAIManager();

const phase2Result = await aiManager.processFactionTurn(
  factions,
  territories,
  relationships,
  deities,
  worldStability,  // 0-1
  currentTick
);

// Process results: factionDecisions, territoryInfluenceShifts, conflictEvents
console.log(`${phase2Result.factionDecisions.length} factions took actions`);
console.log(`${phase2Result.conflictEvents.length} conflicts occurred`);
```

### 3. Calculate Faction ActionBudget

```typescript
// Daily regeneration (call once per day)
const dailyRegen = calculateDailyBudgetGeneration({
  controlledLocations: faction.controlledLocationIds.length,
  activeCovenantCount: faction.activeCovenants.length,
  divineFaith: faction.faithMassInDeity,
  factionChaBonus: faction.charismaBonus,
  worldStability: 0.6,
  leaderSocialWeight: 'female',  // +15% bonus
});

// Apply to budget
faction.actionBudget.currentPoints = Math.min(
  faction.actionBudget.maxCapacity,
  faction.actionBudget.currentPoints + dailyRegen
);
```

### 4. Check Territory Control

```typescript
// What influence level is needed to control this territory?
const controlThreshold = getControlThreshold(
  territory,
  factionReputation  // optional, affects threshold
);

// Does hostile faction have enough influence?
const hostileInfluence = territory.influenceMap.get('hostile-faction') || 0;
if (hostileInfluence > controlThreshold) {
  // Territory will change hands
  territory.controllingFactionId = 'hostile-faction';
}
```

### 5. Calculate Territory Tax Revenue

```typescript
// How much does this territory generate?
const monthlyRevenue = calculateTaxRevenue(territory);

// Revenue depends on:
// - Population × 5 (base)
// - × Stability / 100 (can improve with better rule)
// - × Tax rate (0-1.0)
// - × Willingness / 100 (low willingness = tax evasion)

console.log(`${territory.name} generates ~${monthlyRevenue} gold/month`);
```

### 6. Apply Regional Hazards to Vitals Decay

```typescript
// Get all multipliers for vitals decay in this territory
const decayMults = getVitalsDecayMultipliers(territory);

// Apply to FrictionManager decay
const vigorLoss = baseVigorDecay * decayMults.vigor;
const nouritionLoss = baseNourisionDecay * decayMults.nourishment;
const sanityLoss = baseSanityDecay * decayMults.sanity;

// Example: Desert with heat hazard = 1.5x nourishment decay
```

### 7. Setup Faith & Covenants

```typescript
// Initialize Great Mother for Genesis template
const greatMother = createGreatMotherDeity();
deities.set('great-mother', greatMother);

// Create Soul's Reprieve covenant for a character
const soulReprieve = createSoulsReprieveCovenant({
  deityId: 'great-mother',
  binderId: player.id,
  sanityRecoveryPerTick: 0.1,
  sanityRecoveryCap: 100,
});

// Create faith tracker
const faithTracker = createFaithMassTracker('great-mother', player.id, 1000);
```

### 8. Calculate Daily Faith Generation & Decay

```typescript
// Faith generation (per day)
const dailyGeneration = calculateDailyFaithGeneration({
  territoryControlledCount: faction.controlledLocationIds.length,
  activeCovenantCount: faction.activeCovenants.length,
  faithfulActsCount: 3,     // player actions helping this faith
  ritualsPerformedCount: 1,  // rituals performed today
});

// Faith decay (1% per day)
const dailyDecay = calculateDailyFaithDecay(deity.totalFaithMass);

// Net change
const netChange = dailyGeneration - dailyDecay;
```

### 9. Check if Deity Can Grant Miracles

```typescript
import { canGrantMiracle } from '@/types/divine';

if (canGrantMiracle(deity, miracles)) {
  // Conditions met:
  // - Deity is active
  // - Faith mass > threshold
  // - < 1 miracle per day
  const requestedMiracle = await requestMiracle(deity, 'heal', healTarget);
} else {
  console.log('Deity cannot grant miracles');
}
```

### 10. Update Territory Stability

```typescript
// Territory gets attacked, stability drops
updateTerritoryStability(territory, -10, currentTick);

// Territory has good ruler, stability improves
updateTerritoryStability(territory, +5, currentTick);

// Check trend
console.log(`Territory trend: ${territory.stability.trend}`);
// Output: 'improving' | 'stable' | 'declining' | 'critical'
```

## Enums & Constants

### SocialWeightClass
```typescript
type SocialWeightClass = 'female' | 'male' | 'non-binary';

// Applied to ActionBudget generation:
// female: +15%
// male: -10%
// non-binary: baseline (1.0)
```

### Faction AI States
```typescript
state: 'aggressive'   // Expand territory, attack rivals
     | 'defensive'    // Fortify, protect holdings
     | 'diplomatic'   // Negotiate, build alliances
     | 'dormant';     // Inactive, low priority
```

### Territory Node Types
```typescript
nodeType: 'settlement'  // City/town
        | 'wilderness'  // Forest/plains
        | 'shrine'      // Religious site
        | 'stronghold'  // Military fort
        | 'hub'         // Trade center
        | 'ruin'        // Ancient/abandoned
        | 'other';
```

### Biomes
```typescript
biome: 'grassland' | 'forest' | 'desert' | 'mountain' | 'swamp' | 'urban' | 'coast' | 'other';

// Affects nourishment decay and hazards
// Desert: 1.5x nourishment decay
// Forest: 0.8x nourishment decay
```

### Hazard Types
```typescript
type: 'climate'     // Heat, cold, weather
     | 'disease'    // Plague, poison air
     | 'radiation'  // Magical corruption
     | 'magic'      // Enchantments
     | 'political'; // War, unrest
```

### Covenant Types
```typescript
type: 'soul-reprieve'        // Sanity recovery (DSS 06)
    | 'maternal-blessing'    // +CHA bonus (DSS 16)
    | 'ancestral-echo'       // Echo awakening boost (DSS 16)
    | 'divine-protection'    // Damage reduction
    | 'faith-amplification'  // +faith generation
    | 'other';
```

### Faction Actions
```typescript
CONQUER_TERRITORY:   { cost: 50, cooldown: 1800 ticks }
SKIRMISH:            { cost: 20, cooldown: 900 ticks }
FORTIFY:             { cost: 30, cooldown: 900 ticks }
NEGOTIATE_ALLIANCE:  { cost: 15, cooldown: 600 ticks }
OFFER_VASSAL_PACT:   { cost: 35, cooldown: 1200 ticks }
TRADE_CARAVAN:       { cost: 25, cooldown: 600 ticks }
TAX_TERRITORY:       { cost: 15, cooldown: 450 ticks }
DIVINE_MIRACLE:      { cost: 100, cooldown: 720 ticks }
MASS_AWAKENING:      { cost: 75, cooldown: 1440 ticks }
```

## Performance Characteristics

### FactionAIManager.processFactionTurn()
- **Input**: 10-20 factions, 50-100 territories, 20-30 relationships
- **Processing time**: ~10-20ms per tick
- **Primary bottleneck**: Territory influence map updates
- **Optimization**: Batch updates, cache threat assessment

### Territory Stability Updates
- **Decay/recovery rate**: 0.2-0.5 points per tick
- **Trend calculation**: Check every tick, smooth over 100 ticks
- **Cost**: O(n) where n = territories, negligible

### Faith Mass Calculations
- **Generation formula**: Straightforward arithmetic, O(1)
- **Decay**: 1% per day, runs once per day
- **Cost**: Very cheap, can run every tick

## Configuration Constants (Recommended)

```typescript
// Budget generation rates (per daily tick: day / 2400)
BUDGET_PER_TERRITORY = 10;        // +10 per controlled location
BUDGET_PER_COVENANT = 5;          // +5 per active covenant
BUDGET_PER_FAITH = 2;             // +2 per faith point
BUDGET_PER_STABILITY = 40;        // 0-40 linear with stability

// Territory control
CONTROL_THRESHOLD_BASE = 60;      // Influence level to control
CONTROL_MIN_THRESHOLD = 30;       // Never below this
CONTROL_STABILITY_FACTOR = 0.1;   // Unstable = harder to take

// Tax revenue
TAX_BASE_MULTIPLIER = 5;          // Population × 5
TAX_STABILITY_FACTOR = 1.0;       // Stability / 100
TAX_WILLINGNESS_FACTOR = 1.0;     // Willingness / 100

// Faith
FAITH_GENERATION_TERRITORY = 5;   // +5 per location
FAITH_GENERATION_COVENANT = 10;   // +10 per covenant
FAITH_DECAY_DAILY = 0.01;         // 1% per day
FAITH_DECAY_DAILY_TICKS = 2400;   // Ticks per day

// Stability
STABILITY_RECOVERY_RATE = 0.2;    // +0.2 per tick baseline
STABILITY_THREAT_FACTOR = -5;     // -5 per threatening faction
STABILITY_MIN = 0;
STABILITY_MAX = 100;
```

## Testing Checklist

- [ ] ActionBudget regeneration with female leader (+15%) vs male leader (-10%)
- [ ] Territory control threshold affected by stability
- [ ] Tax revenue calculation with all modifiers
- [ ] Territory information lag composite calculation
- [ ] Faith generation from multiple sources
- [ ] Faith decay doesn't go negative or exceed capacity
- [ ] FactionAIManager decisions scale with faction count
- [ ] Regional hazards stack correctly on vitals decay
- [ ] Covenant maintenance costs drain faith correctly
- [ ] Stress test: 1000 ticks, 20 factions, no memory leaks

## Integration Checklist

- [ ] FactionAIManager hooked into ResolutionStack.phase2_WorldAIDrift()
- [ ] Territory nodes created for all world locations
- [ ] Factions initialized with starting resources
- [ ] Deities (including Great Mother) created per template
- [ ] Relationships established between starting factions
- [ ] Player faction created with standard territory
- [ ] Phase 5 (Ripple) updated to process faction events
- [ ] UI debug view showing faction status and AI states

---

**Last Updated**: 2026-01-15  
**For Full Details**: See PHASE_3_IMPLEMENTATION_GUIDE.md
