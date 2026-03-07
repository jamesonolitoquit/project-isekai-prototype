# Milestone 28: Developer Quick Reference

> **Status:** ACTIVE
> **Category:** IMPLEMENTATION
> **Updated:** February 16, 2026

---

## Quick Start: Integrating Living Chronicle Features

### 1. Faction Evolution in Gameplay
```typescript
// When loading next epoch, factions have already been evolved
// Access evolved faction properties:
const factions = worldState.factions;

// Identify new schism factions:
const schismFactions = factions.filter(f => f._isSchism);
schismFactions.forEach(schism => {
  console.log(`${schism.name} split from ${schism._parentFactionId}`);
});

// Check if NPC is from extinct faction:
import { isNpcFromExtinctFaction } from './engine/factionEngine';
if (isNpcFromExtinctFaction(npc, worldState._extinctFactionIds)) {
  // NPC doesn't exist in this epoch
  npc.isUnavailable = true;
}
```

### 2. Biome Changes & Environmental Effects
```typescript
// Location biome may have shifted
const location = worldState.locations[0];
console.log(`Biome: ${location.biome}`); // e.g., "Blighted Woods"
console.log(`Corruption Level: ${location._corruptionLevel}`);

// Adjust encounter difficulty based on biome/corruption
const biomeMultiplier = {
  'forest': 1.0,
  'Blighted Woods': 1.3,
  'Withered Wastelands': 1.5
}[location.biome] || 1.0;

enemyDifficulty *= biomeMultiplier;
```

### 3. Soul Echo Ability Teaching
```typescript
import { getTeachableAbilities, canLearnLegendaryAbility } from './engine/legacyEngine';

// During Soul Echo NPC interaction:
const ancestor = getCurrentAncestor(player);
const teachableAbilities = getTeachableAbilities(ancestor.mythStatus);

// Show dialog options for learning
teachableAbilities.forEach(ability => {
  addDialogueChoice({
    text: `Learn "${ability.name}"`,
    icon: 'spirit-glow',
    onSelect: () => {
      player = learnLegendaryAbility(player, ability.id);
      showMessage(`You learned ${ability.name} from ${ancestor.name}!`);
    }
  });
});
```

### 4. Great Library Research
```typescript
import { satisfyLoreGatedQuest } from './engine/chronicleEngine';

// Player enters library and interacts with tome:
const tome = libraries.find(l => l.id === 'library_tome_0');

player = satisfyLoreGatedQuest(player, tome.id, libraries);
showMessage(`You researched: ${tome._loreContent.title}`);

// Check if quest prerequisite is satisfied:
if (player._satisfiedPrerequisites.includes('knowledge:ancient_timeline')) {
  quest.prerequisiteMet = true;
}
```

### 5. Epoch-Gated Crafting
```typescript
import { 
  rollEpochAdjustedCraft, 
  hasPrimalFluxIngredient,
  consumePrimalFlux 
} from './engine/craftingEngine';

// When player attempts runic crafting:
const hasPrimal = hasPrimalFluxIngredient(player.inventory);
const result = rollEpochAdjustedCraft(
  player.stats.int,
  runicRecipe,
  worldState.epochId,
  0, // modifier
  hasPrimal
);

if (result.success) {
  // Success - consume Primal Flux if used
  if (hasPrimal) {
    player.inventory = consumePrimalFlux(player.inventory);
  }
  addCraftResult(player.inventory, runicRecipe);
} else {
  // Show epoch penalty message
  showMessage(`The age resists runic magic! Penalty: ${result.epochPenalty.toFixed(1)} DC`);
}
```

### 6. Timeline Visualization (Already Integrated)
```typescript
// ChronicleArchive.tsx already renders:
// - Lineage Ascension Tree (myth status progression bars)
// - World Epochs & Summaries (era thematic labels)
// No additional implementation needed - it's displayed by default
```

---

## Data Structure Reference

### Faction Genealogy
```typescript
// Evolved faction properties
{
  ...originalFaction,
  _originEpochId: 'epoch_i_fracture',
  _isExtinct: false,
  
  // For schism factions specifically:
  _isSchism: true,
  _parentFactionId: 'original-faction-id',
  // Reduced stats compared to parent
}
```

### Biome Shifts
```typescript
// Location after environmental shift
{
  ...originalLocation,
  biome: 'Blighted Woods', // transformed from 'forest'
  description: 'Once verdant, these woods are now twisted...',
  _corruptionLevel: 50, // accumulated over epochs
  spiritDensity: 0.5 // unchanged
}
```

### Legendary Abilities
```typescript
// Ability object from LEGENDARY_ABILITIES array
{
  id: 'echo_strike',
  name: 'Echo Strike',
  description: 'Channel your ancestor\'s combat prowess...',
  mythRequirement: 50,
  cooldown: 300,
  manaCost: 40,
  effect: 'Deal 150% weapon damage...',
  ancestorName: 'First Ancestor',
  type: 'combat'
}

// Player learned ability tracking
player.unlockedSoulEchoAbilities: ['echo_strike', 'ancestral_foresight']
```

### Great Library Archives
```typescript
// Library tome structure
{
  id: 'library_tome_0',
  name: 'Tome: "History of the Fracture Era"',
  parentLocationId: 'luminara-grand-market',
  description: '...',
  _loreContent: { originalLoreObject },
  _researchable: true,
  _researchReward: ['knowledge:ancient_timeline', 'skill:lore_expert']
}

// Player tracking
player._researchedLore: ['library_tome_0', 'library_tome_2']
player._satisfiedPrerequisites: ['knowledge:ancient_timeline', ...]
```

### Epoch-Gated Recipes
```typescript
// Recipe with tier for cost degradation
{
  ...baseRecipe,
  tier: 'runic' | 'legendary', // gates epoch-gating
  difficulty: 18 // base difficulty
}
```

---

## Common Integration Patterns

### Pattern 1: Handling Extinct Factions Gracefully
```typescript
const npcsInWorld = worldState.npcs.filter(npc => {
  return !isNpcFromExtinctFaction(npc, worldState._extinctFactionIds);
});
```

### Pattern 2: Checking Achievement Unlock (Soul Echo)
```typescript
if (playerAncestor.mythStatus >= 50) {
  unlockedAbilities = getTeachableAbilities(playerAncestor.mythStatus);
  if (unlockedAbilities.length > 0) {
    showNotification('A Soul Echo whispers: "I can teach you power..."');
  }
}
```

### Pattern 3: Crafting Difficulty Adaptation
```typescript
let DC = baseDifficulty;

// Apply epoch penalty if runic recipe
if (recipe.tier === 'runic') {
  const epochMultiplier = calculateEpochAdjustedSuccess(1.0, recipe, epochId, false);
  DC = Math.ceil(DC / epochMultiplier);
}

// Show difficulty comparison
showMessage(`DC: ${DC} (base: ${baseDifficulty}, epoch penalty: ${DC - baseDifficulty})`);
```

### Pattern 4: Dialogue with Schism Faction Members
```typescript
if (npc._isSchism) {
  // Rebels have anti-parent faction sentiment
  npc.dialogue = {
    ...npc.dialogue,
    greeting: `We've broken free from ${npc._parentFactionId}. Are you with us?`,
    ...applyRebelTone(npc)
  };
}
```

---

## Testing Checklist

- [ ] Faction with power < 10 is removed in next epoch
- [ ] Extinct faction's NPCs don't appear
- [ ] Extinct faction's locations reassigned to rival
- [ ] Schism faction created for powerful (>60) faction with low player rep
- [ ] Forest biome location with high spiritDensity transforms in epoch III
- [ ] Soul Echo teaching unlocks at milestone thresholds (50%, 60%, etc.)
- [ ] Library tomes appear in Lux-Ar city research area
- [ ] Researching lore satisfies quest prerequisites
- [ ] Runic recipe difficulty increased in Twilight epoch (without Primal Flux)
- [ ] ChronicleArchive displays ascension tree with correct myth values
- [ ] ChronicleArchive shows all three world epochs

---

## Performance Considerations

- **Faction Evolution**: O(n + m) where n=factions, m=relationships; calculated once per epoch transition
- **Biome Transformation**: O(locations); uses simple Map lookup
- **Legendary Teaching**: O(1) lookup per ability; set operations
- **Great Library**: O(books) to populate; small overhead
- **Crafting Check**: O(1) calculation; minor floating-point operations

**No bottlenecks identified** - all M28 features are lightweight.

---

## Debugging Tips

### Faction Issues
```typescript
// Debug why faction wasn't evolved
const extinct = evolveFactionGeneology(factions, playerReps).extinct;
console.log('Extinct factions:', extinct);

// Check faction power scores before/after
console.log('Before:', factions.map(f => ({ id: f.id, power: f.powerScore })));
```

### Biome Transformation Issues
```typescript
// Check corruption accumulation
console.log(`Location: ${loc.id}`);
console.log(`  Biome: ${loc.biome}`);
console.log(`  Corruption: ${loc._corruptionLevel}`);
console.log(`  Spirit Density: ${loc.spiritDensity}`);
```

### Ability Teaching Issues
```typescript
// Verify ancestor myth status is correct
console.log(`Ancestor: ${ancestor.name}`);
console.log(`  Myth: ${ancestor.mythStatus}`);
console.log(`  Teachable: ${getTeachableAbilities(ancestor.mythStatus).length}`);
```

---

## Notes for Future Expansions

1. **Faction Warfare**: Schism factions could automatically battle parents every N epochs
2. **Environmental Quests**: "Purify Blighted Woods" → gradually shift biome back
3. **Primal Flux Economy**: Make finite; craft it from rare materials
4. **Ancestral Bonds**: Deepen with each ability learned (new dialogue, unique perks)
5. **Timeline Branches**: Show AI-forecasted world states for each faction alignment choice
