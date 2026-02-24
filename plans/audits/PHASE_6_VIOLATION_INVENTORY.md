# Phase 6: Remaining Type Debt Violations - Comprehensive Inventory

**Date**: February 21, 2026  
**Scope**: 75 `as any` violations across 25 engine files  
**Target**: Reduce to <10 acceptable violations (external API only)  
**Strategy**: Systematic type consolidation following Phase 6 plan

---

## Violation Summary by Category

### 🎯 **Category 1: Avoidable - Missing Type Extensions (HIGH PRIORITY)**

These violations are caused by missing optional properties that should be defined in worldEngine.ts

#### **1.1 PlayerState Missing Properties (8 violations)**

**Violations**:
- `paradoxEngine.ts:54` - `(state.player as any).temporalDebt`
- `paradoxEngine.ts:55` - `(state.player as any).soulStrain`
- `proceduralEngine.ts:537` - `(state.player as any).temporalDebt`
- `goalOrientedPlannerEngine.ts:394` - `(npc as any).gold` (NPC, not player, but similar)
- `goalOrientedPlannerEngine.ts:394` - `(npc as any).gold` (duplicate line)
- `goalOrientedPlannerEngine.ts:397` - `(npc as any).power`
- `goalOrientedPlannerEngine.ts:397` - `(npc as any).power` (duplicate)
- `goalOrientedPlannerEngine.ts:450` - `(npc as any).gold`
- `goalOrientedPlannerEngine.ts:457` - `(npc as any).power`

**Solution**: Add to worldEngine.ts PlayerState and NPC interfaces:
```typescript
// PlayerState:
temporalDebt?: number;  // Paradox Engine debt tracking
soulStrain?: number;    // Phase 13: morphing strain

// NPC:
gold?: number;          // GOAP engine resource
power?: number;         // GOAP engine resource
```

**Files to Update**: worldEngine.ts

---

#### **1.2 Location Missing Properties (7 violations)**

**Violations**:
- `factionEngine.ts:535` - `(location as any).activeScars`
- `factionEngine.ts:536` - `(location as any).activeScars`
- `factionEngine.ts:539` - `(location as any).activeScars.push`
- `factionEngine.ts:551` - `(location as any).activeScars`
- `factionEngine.ts:554` - `(location as any).activeScars`
- `chronosLedgerEngine.ts:79` - `(location as any).activeScars`
- `chronosLedgerEngine.ts:126` - `(location as any).activeScars`

**Note**: `activeScars` already exists in Location interface (added Phase 5)

**Solution**: This is actually already added! Need to verify why cast still exists. Likely in old code paths that weren't updated. These should be straightforward removals.

**Files to Update**: factionEngine.ts, chronosLedgerEngine.ts

---

#### **1.3 NPC Missing Properties (6 violations)**

**Violations**:
- `paradoxEngine.ts:171` - `(npc as any).factionId`
- `paradoxEngine.ts:172` - `(npc as any).factionId`
- `factionEngine.ts:354` - `(npc as any).factionId`
- `chronosLedgerEngine.ts:37` - `npc as any` (for name access)
- `chronosLedgerEngine.ts:138` - `npc as any` (for name access)
- `npcSocialAutonomyEngine.ts:152` - `(initiator as any).personality`
- `npcSocialAutonomyEngine.ts:201` - `(initiator as any).charisma`
- `npcSocialAutonomyEngine.ts:209` - `(initiator as any).charisma`, `(initiator as any).intelligence`

**Solution**: Add to worldEngine.ts NPC interface:
```typescript
// NPC already has most properties, but verify:
factionId?: string;     // Should already exist - verify
personality?: { sociability: number; risk: number; ambition: number };
charisma?: number;      // Stat access
intelligence?: number;  // Stat access
```

**Files to Update**: worldEngine.ts, paradoxEngine.ts, factionEngine.ts, chronosLedgerEngine.ts, npcSocialAutonomyEngine.ts

---

#### **1.4 WorldState Missing Properties (5 violations)**

**Violations**:
- `npcSocialAutonomyEngine.ts:222` - `(state as any).weather`
- `npcSocialAutonomyEngine.ts:223` - `(state as any).season`
- `factionTerritoryEngine.ts:90` - `((state as any).factionReputation || {})`
- `factionTerritoryEngine.ts:109` - `((state as any).factionReputation || {})`
- `proceduralEngine.ts:550` - `(state as any).hour`

**Solution**: Add to worldEngine.ts WorldState interface:
```typescript
// WorldState already has these mostly, but verify:
weather?: 'clear' | 'snow' | 'rain';
season?: 'winter' | 'spring' | 'summer' | 'autumn';
hour?: number;
factionReputation?: Record<string, number>;  // Already exists?
```

**Files to Update**: worldEngine.ts, npcSocialAutonomyEngine.ts, factionTerritoryEngine.ts, proceduralEngine.ts

---

### 🔧 **Category 2: Type Guard Patterns (MEDIUM PRIORITY)**

These require creating reusable type guards to avoid repeated `as any` patterns

#### **2.1 InventoryItem.quantity Access (4 violations)**

**Violations**:
- `craftingEngine.ts:74` - `(inventoryItem as any).quantity`
- `craftingEngine.ts:203` - `(item as any).quantity`
- `craftingEngine.ts:214` - `(item as any).quantity`
- `craftingEngine.ts:218` - `(item as any).quantity`

**Solution**: Create type guard in worldEngine.ts:
```typescript
export function isStackable(item: InventoryItem): item is StackableItem {
  return item.kind === 'stackable';
}

export function getStackableQuantity(item: InventoryItem): number {
  if (isStackable(item)) return item.quantity;
  return 0;
}
```

**Files to Update**: worldEngine.ts (add guard), craftingEngine.ts (use guard)

---

#### **2.2 Item.kind Discrimination (4 violations)**

**Violations** - actionPipeline.ts line 378:
```typescript
(item as any).kind === 'stackable' && (item as any).itemId === 'gold'
```

**Solution**: Should use isStackable() guard instead

**Files to Update**: actionPipeline.ts

---

### 📊 **Category 3: Data Import Typing (MEDIUM PRIORITY)**

These require defining interfaces for JSON imports

#### **3.1 SpellsData (1 violation)**

**File**: magicEngine.ts:31
```typescript
(spellsData.spells as any[]).forEach((spell: any) => {
```

**Solution**: Create SpellData interface:
```typescript
export interface SpellData {
  id: string;
  name: string;
  manaCost: number;
  damage?: number;
  effect?: string;
  // ... other spell properties
}

export type SpellsData = { spells: SpellData[] };
```

**Files to Update**: worldEngine.ts (define), magicEngine.ts (use)

---

#### **3.2 MemoryData (1 violation)**

**File**: npcMemoryEngine.ts:79
```typescript
const data = memoryData as any;
```

**Solution**: Create MemoryEntry interface:
```typescript
export interface MemoryEntry {
  id: string;
  npcId: string;
  type: string;
  content: string;
  timestamp: number;
  importance?: number;
}

export type MemoryData = { memories: MemoryEntry[] };
```

**Files to Update**: worldEngine.ts (define), npcMemoryEngine.ts (use)

---

### 🎨 **Category 4: Literal Type Unions (LOW PRIORITY)**

These are safe but can be typed with proper string literal unions

#### **4.1 EventType Casts (3 violations)**

**Violations**:
- `directorMacroEngine.ts:266` - `type: eventType as any`
- `directorCommandEngine.ts:233` - `const eventType = args[0] as any`
- `authorityDebtEngine.ts:131` - `commandType as any`

**Solution**: Use proper union types:
```typescript
type MacroEventType = 'faction_incursion' | 'cataclysm' | 'truce' | 'uprising' | 'invasion';
type CommandType = 'faction_incursion' | 'cataclysm' | 'truce' | 'uprising' | 'invasion';
```

**Files to Update**: worldEngine.ts (define), directorMacroEngine.ts, directorCommandEngine.ts, authorityDebtEngine.ts

---

#### **4.2 Animation/Direction Casts (4 violations)**

**File**: phantomEngine.ts lines 270, 335, 336, 342
```typescript
animation = phantom.currentAction.actionName as any;
direction: (m.dir as any) || 'idle',
animation: (m.anim as any) || 'idle',
actionType: (a.type as any) || 'emote'
```

**Solution**: Define animation/action unions:
```typescript
type AnimationType = 'idle' | 'walk' | 'run' | 'attack' | 'emote' | ...;
type DirectionType = 'idle' | 'north' | 'south' | 'east' | 'west' | ...;
```

**Files to Update**: worldEngine.ts (define), phantomEngine.ts (use)

---

#### **4.3 Biome Casts (2 violations)**

**File**: mapEngine.ts lines 259, 267
```typescript
biome: (from.biome as any) ?? 'forest',
biome: (to.biome as any) ?? 'forest'
```

**Solution**: `biome` already typed on Location interface - should just be `from.biome ?? 'forest'` without cast

**Files to Update**: mapEngine.ts

---

### 🚫 **Category 5: Known Complex/Acceptable (LOW PRIORITY)**

These are either infrastructure-level or legitimate untyped external APIs

#### **5.1 Paradox Component Casts (2 violations)**

**File**: mapEngine.ts lines 420, 423 (commented out)
```typescript
//     const location = state.locations.find(l => l.id === (paradox as any).locationId);
//       const glitchType = ['pixelate', 'chromatic', 'timefold', 'void'][i % 4] as any;
```

**Status**: Commented out code - can be removed

**Files to Update**: mapEngine.ts (cleanup)

---

#### **5.2 Property Engine Access (2 violations)**

**File**: propertyUpgradeEngine.ts lines 85, 148
```typescript
const property = (propEngine as any).properties.get(propertyId);
const status = (getPropertyEngine() as any).propertyStatus.get(property.id);
```

**Solution**: Requires engine interface definition - may be acceptable to leave as is for now

**Files to Update**: propertyUpgradeEngine.ts (optional)

---

#### **5.3 Narrative/Whisper Casts (2 violations)**

**File**: narrativeWhisperEngine.ts lines 98, 109
```typescript
type: template.whisperType as any,
] as any
```

**Solution**: Define WhisperType union

**Files to Update**: worldEngine.ts (define), narrativeWhisperEngine.ts (use)

---

#### **5.4 Quest Difficulty Tier (1 violation)**

**File**: questSynthesisAI.ts:743
```typescript
quest.difficultyTier = difficulty as any;
```

**Solution**: Use proper DifficultyType union

**Files to Update**: questSynthesisAI.ts

---

#### **5.5 NPC Emotion Updates (1 violation)**

**File**: npcSocialAutonomyEngine.ts:237
```typescript
updateNpcEmotion(target, emotion as any, delta, interaction.id, currentTick);
```

**Solution**: Define proper EmotionType

**Files to Update**: npcSocialAutonomyEngine.ts

---

#### **5.6 Obfuscation Engine (3 violations)**

**File**: obfuscationEngine.ts lines 59, 126, 510
```typescript
if (maxMp === 0) return undefined as any;
const lastSeen = (groundTruth.player as any)?.lastSeen?.[npc.id];
beliefEngine.addNpcRumorKnowledge((npc as any).id, rumor.id);
```

**Status**: Complex inference logic - may be acceptable for now

**Files to Update**: obfuscationEngine.ts (optional improvements)

---

#### **5.7 Quest Registration (2 violations)**

**File**: actionPipeline.ts lines 794, 879
```typescript
(questSynthesis as any).registerGeneratedQuest(quest);
```

**Solution**: Define proper interface for questSynthesis object

**Files to Update**: actionPipeline.ts

---

#### **5.8 Constraint Validator (1 violation)**

**File**: constraintValidator.ts:83
```typescript
const value = (stats as any)[stat];
```

**Solution**: Create stats type guard

**Files to Update**: constraintValidator.ts

---

#### **5.9 SessionSync (1 violation)**

**File**: sessionSync.ts:351
```typescript
changeType: changeTypeMap[ch.ty as keyof typeof changeTypeMap] as any
```

**Status**: Complex mapping logic - relatively safe

**Files to Update**: sessionSync.ts (optional)

---

#### **5.10 Audio Engine (1 violation)**

**File**: audioEngine.ts:237
```typescript
synth: factionLeitmotif.primaryInstrument as any,
```

**Status**: Audio API external - acceptable

**Files to Update**: audioEngine.ts (optional)

---

#### **5.11 WorldEngine Dev API (2 violations)**

**File**: worldEngine.ts lines 2224, 2261, 2315
```typescript
const saveMeta = parsed as any;
const { candidateState } = rebuildState(state, events) as any;
return dev ? devApi as any : kernelApi as any;
```

**Status**: Complex return types, infrastructure-level

**Files to Update**: worldEngine.ts (considered acceptable)

---

#### **5.12 Achievement Engine (1 violation)**

**File**: achievementEngine.ts:396
```typescript
type: 'world-first-achievement' as any,
```

**Solution**: Use literal type

**Files to Update**: achievementEngine.ts

---

## Remediation Plan by Phase

### **Phase 6 - Tier 1 (Quick Wins): ~30 violations**

Priority order:
1. **Add missing type extensions** (12 violations)
   - PlayerState: temporalDebt, soulStrain
   - NPC: gold, power, factionId, personality, charisma, intelligence
   - WorldState: weather, season, hour, factionReputation
   - Location: activeScars (already added, just remove casts)

2. **Create type guards** (4 violations)
   - isStackable() for InventoryItem.quantity
   - Item.kind discrimination

3. **Define literal unions** (3 violations)
   - EventType, CommandType
   - AnimationType, DirectionType

### **Phase 6 - Tier 2 (Data Typing): ~5 violations**

4. **Define data interfaces**
   - SpellsData
   - MemoryData
   - WhisperType

### **Phase 6 - Tier 3 (Edge Cases): ~3 violations**

5. **Remaining safe casts** (biome, achievement, etc.)

### **Phase 6 - Tier 4 (Acceptable):**

6. **Known acceptable** (worldEngine dev API, audio, property engine)
   - These can remain as documented exceptions

---

## Implementation Priority Matrix

| Category | Violations | Priority | Effort | Impact | Tier |
|----------|-----------|----------|--------|--------|------|
| Type extensions | 12 | HIGH | 1 hour | 99% | 1 |
| Type guards | 4 | HIGH | 30min | 95% | 1 |
| Literal unions | 3 | MEDIUM | 45min | 90% | 1 |
| Data interfaces | 5 | MEDIUM | 1 hour | 85% | 2 |
| Edge cases | 3 | LOW | 30min | 75% | 3 |
| Acceptable | ~43 | LOW | N/A | 0% | 4 |
| **TOTAL** | **75** | | **3.5hrs** | **~50%** | |

---

## Target State After Phase 6

```
Current: 75 violations across 25 engines
Phase 6 Tier 1-3: ~44 violations eliminated (59%)
Remaining: ~31 violations
  ├─ Infrastructure-level (acceptable): ~20 violations
  ├─ External API shims (acceptable): ~8 violations
  └─ Documented exceptions: ~3 violations

Target State: <10 violations (all acceptable/documented)
Estimated Effort: 3-4 hours
Expected completion: EOF February 21-22, 2026
```

---

## Files Requiring Updates

| File | Violations | Changes | Effort |
|------|-----------|---------|--------|
| **worldEngine.ts** | 4 | Add type extensions (8), interfaces (5), guards (2) | 1.5 hrs |
| **paradoxEngine.ts** | 4 | Remove casts (use extensions) | 15 min |
| **factionEngine.ts** | 7 | Remove casts (use extensions), fix activeScars | 30 min |
| **npcSocialAutonomyEngine.ts** | 8 | Use type extensions, weather/season | 30 min |
| **goalOrientedPlannerEngine.ts** | 8 | Use NPC.gold/power extensions | 20 min |
| **chronosLedgerEngine.ts** | 8 | Fix activeScars, NPC access | 25 min |
| **craftingEngine.ts** | 4 | Use isStackable() guard | 15 min |
| **actionPipeline.ts** | 4 | Use isStackable() guard | 15 min |
| **mapEngine.ts** | 4 | Remove biome casts, cleanup comments | 10 min |
| **phantomEngine.ts** | 4 | Use animation/direction unions | 20 min |
| Other (15 files) | 10 | Various small fixes | 30 min |

**Total Estimated Effort**: 3.5 hours to reach <10-violation state

---

Generated: February 21, 2026  
Status: Phase 6 Planning Complete - Ready for Implementation
