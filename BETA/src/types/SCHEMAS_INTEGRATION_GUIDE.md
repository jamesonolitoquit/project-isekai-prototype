# Core Entity Schemas Integration Guide

## Overview

The core entity schemas (Phase 1 Implementation) provide TypeScript interfaces and utilities for managing the fundamental game data structures:

- **Attributes** (`attributes.ts`) - The 9 core attributes and skill progression mechanics
- **Vessels** (`vessels.ts`) - Character bodies with vitals, injuries, and health
- **Templates** (`template.ts`) - World configuration and the Matriarchal Genesis template
- **Temporal** (`temporal.ts`) - Paradox debt tracking and reincarnation systems

## Quick Start

### 1. Creating a Character

```typescript
import {
  createDefaultAttributes,
  calculateAttributeModifiers,
  createVessel,
  CoreAttributes,
} from '@/types';

// Create a basic intelligence-focused character
const attributes = createDefaultAttributes('intellect');
// => STR: 8, INT: 14, WIS: 12, rest: 10

// Calculate how attributes affect mechanics
const mods = calculateAttributeModifiers(attributes);
// => int_multiplier: 1.7, wis_multiplier: 1.48, etc.

// Create a new vessel (physical embodiment)
const myVessel = createVessel({
  name: 'Lyra the Scholar',
  level: 1,
  attributes,
  ancestry: 'elf-starborn',
  talent: 'ancestral-echo',
  gender: 'female',
  createdAtTick: 0,
});

console.log(myVessel.maxHealthPoints); // 50 + (-1 * 1) = 49
console.log(myVessel.vitals.sanity);  // 50 + (12 * 3) = 86
```

### 2. Tracking Skill Progression

```typescript
import { calculateSkillXpRequired, DEFAULT_LEARNING_CURVE } from '@/types';

// How much XP needed to level a skill?
// Soft cap = character_level + ((INT + WIS) / 2)
//          = 1 + ((14 + 12) / 2)
//          = 1 + 13
//          = 14

const xpForLevel5 = calculateSkillXpRequired(5, 1, attributes);
// At level 5: Below soft cap (14), so 1000 * (5 + 1) = 6000 XP

const xpForLevel20 = calculateSkillXpRequired(20, 1, attributes);
// At level 20: Beyond soft cap, exponential scaling applies
// => Much higher XP requirement due to soft cap penalty
```

### 3. Managing Injuries

```typescript
import { addInjury, getActiveInjuries, healInjury, InjuryType } from '@/types';

// Character takes a laceration while fighting
addInjury(myVessel, {
  id: 'wound-001',
  type: InjuryType.LACERATION,
  severity: 2,
  affectedAttribute: 'DEX',
  attributePenalty: -2,
  createdAtTick: 150,
  ticksUntilHealed: 1200, // 30 minutes of game time
  requiresMedicalTreatment: false,
  isActive: true,
  description: 'Deep gash across the forearm',
});

// Check what's affecting the character
const activeInjuries = getActiveInjuries(myVessel);
console.log(activeInjuries); // [{ DEX penalty of -2 }]

// Later, heal the wound
healInjury(myVessel, 'wound-001');
```

### 4. Tracking Paradox Debt

```typescript
import {
  createParadoxTracker,
  addParadoxEvent,
  applyParadoxDecay,
  ParadoxDebtState,
} from '@/types';

// Create tracker for this actor
const tracker = createParadoxTracker('actor-123', 0);

// Player uses Timeline Warp (temporal manipulation)
addParadoxEvent(tracker, {
  id: 'event-001',
  actorId: 'actor-123',
  eventType: 'timeline-warp',
  magnitude: 50,
  informationGained: 30,
  temporalDivergence: 10,
  occurredAtTick: 200,
  description: 'Rewound combat encounter to redo decisions',
});

// Formula: 50 * (30 / 10) = 150 debt
console.log(tracker.currentDebt);      // 150
console.log(tracker.currentState);     // ParadoxDebtState.BLEACH (51-75% of 100)

// Debt naturally decays over time
applyParadoxDecay(tracker, 500, 0.01); // 300 ticks * 1% = 3% decay
console.log(tracker.currentDebt);      // 145.5
```

### 5. Loading the Matriarchal Genesis Template

```typescript
import {
  createMatriarchalGenesisTemplate,
  validateTemplate,
} from '@/types';

// Load or create the genesis template
const genesisTemplate = createMatriarchalGenesisTemplate();

// Validate it against schema
const validation = validateTemplate(genesisTemplate);
if (validation.valid) {
  console.log('Template is valid!');
} else {
  console.error('Errors:', validation.errors);
}

// Access template configuration
console.log(genesisTemplate.metadata.version);           // 1.3 (with all 4 patches)
console.log(genesisTemplate.securityPatches);            // ['causal-lock-v1.2', ...]
console.log(genesisTemplate.matriarchalConfig.femaleActionBudgetBonus); // 0.15 (+15%)

// Access Womb-Magic configuration
console.log(genesisTemplate.wombMagicConfig.cooldownTicks); // 2400 (1 hour)

// Access covenant configuration
console.log(genesisTemplate.covenantConfig.maxActive); // 5
```

### 6. Death and Reincarnation

```typescript
import {
  performConservationCheck,
  triggerVesselReset,
} from '@/types';

// Character takes damage and reaches 0 HP
myVessel.healthPoints = 0;

// Perform death save (Conservation Check)
const deathSave = performConservationCheck(
  myVessel,
  10, // Difficulty class
  1000 // Current tick
);

console.log(deathSave.d20Roll);      // e.g., 15
console.log(deathSave.constitutionBonus); // e.g., 1
console.log(deathSave.totalValue);   // 16
console.log(deathSave.success);      // true (16 >= 10)

if (!deathSave.success) {
  // Vessel destroyed, trigger reincarnation
  const reincarnationOptions = triggerVesselReset(tracker);
  console.log(reincarnationOptions.skillRetentionPercent);    // 0 (reset to level 1)
  console.log(reincarnationOptions.ancestralEchoPoints);      // 50 (for Flash Learning)
  console.log(reincarnationOptions.factionRepRetention);      // 0.1 (10% kept)
}
```

## Complete Workflow Example

### Scenario: Scholar Fights Monster

```typescript
import {
  createDefaultAttributes,
  createVessel,
  createParadoxTracker,
  createMatriarchalGenesisTemplate,
  addParadoxEvent,
  addInjury,
  performConservationCheck,
  InjuryType,
  ParadoxDebtState,
} from '@/types';

// 1. Character creation
const scholarAttributes = createDefaultAttributes('intellect');
const scholar = createVessel({
  name: 'Lyra',
  level: 3,
  attributes: scholarAttributes,
  ancestry: 'elf-starborn',
  talent: 'ancestral-echo',
  gender: 'female',
  createdAtTick: 0,
});

// 2. Load world template
const world = createMatriarchalGenesisTemplate();

// 3. Apply world bonuses (female scholar in matriarchal template)
const factionBudgetBonus = world.matriarchalConfig.femaleActionBudgetBonus; // +15%

// 4. Combat: Monster hits scholar for 35 damage
scholar.healthPoints -= 35;
console.log(`Health: ${scholar.healthPoints}/${scholar.maxHealthPoints}`);

// 5. Monster also gives scholar a wound
addInjury(scholar, {
  id: 'wound-combat-001',
  type: InjuryType.LACERATION,
  severity: 1,
  affectedAttribute: 'DEX',
  attributePenalty: -1,
  createdAtTick: 150,
  ticksUntilHealed: 600,
  requiresMedicalTreatment: false,
  isActive: true,
  description: 'Minor gash from claw attack',
});

// 6. Scholar counterattacks with magic (Timeline Warp)
// This accumulates paradox debt
const tracker = createParadoxTracker(`scholar-${scholar.id}`, 0);

addParadoxEvent(tracker, {
  id: 'magic-001',
  actorId: `scholar-${scholar.id}`,
  eventType: 'timeline-warp',
  magnitude: 30,
  informationGained: 20,
  temporalDivergence: 5,
  occurredAtTick: 150,
  description: 'Cast temporal magic to dodge attack',
});

console.log(`Paradox Debt: ${tracker.currentDebt}`); // 30 * (20 / 5) = 120
console.log(`State: ${tracker.currentState}`);       // BLEACH

// 7. Combat ends, Scholar at low HP. Next hit could trigger Conservation Check
scholar.healthPoints = 5; // Critically wounded

const finalHit = performConservationCheck(scholar, 10, 500);
if (finalHit.success) {
  console.log(`Scholar survived! Entered Fragile State.`);
  scholar.vesselTier = 'fragile';
} else {
  console.log(`Scholar's vessel destroyed. Reincarnation triggered.`);
}
```

## Architecture Notes

### Separation of Concerns

1. **Attributes** - Purely mechanical: modifiers, learning curves, skill progression
2. **Vessels** - Physical embodiment: health, vitals, injuries, status effects
3. **Templates** - World configuration: factions, covenants, fuel, arcane rules
4. **Temporal** - Causality tracking: paradox debt, reincarnation, phase 0 security

### Data Flow

```
World Template (config)
         ↓
   Vessel Creation
         ↓
   Combat/Actions
         ↓
   Paradox Accumulation
         ↓
   Death/Reset → New Vessel → Reincarnation
```

### Key Dependencies

- `attributes.ts` is standalone (no dependencies)
- `vessels.ts` imports `CoreAttributes` from `attributes.ts`
- `template.ts` is standalone (describes configuration, not data)
- `temporal.ts` is standalone (paradox tracking logic)

Main engine would integrate all four modules to manage a living game world.

## Next Steps (Phase 2)

These schemas define the **data structures**. Phase 2 will implement:

1. **Engine Modules**: Actual gameplay systems
   - `skillProgressionEngine.ts` - Applies learning curves from attributes
   - `combatEngine.ts` - Uses vessel stats for damage calculations
   - `paradoxEngine.ts` - Manages debt state transitions

2. **Persistence**: Database adapters
   - Save/load vessels with all state
   - Persist paradox trackers across sessions
   - Manage causal vaults

3. **UI Integration**: Display systems
   - Character sheet showing all attributes and modifiers
   - Paradox debt visualization
   - Injury list with treatment options

---

**Documentation Version**: 1.0  
**Last Updated**: 2026-01-15  
**Author**: Core Systems Team
