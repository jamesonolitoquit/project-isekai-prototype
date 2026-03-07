# Phase 13 Implementation: The Ascension Protocol & Multi-Generational Mastery

**Status**: Research Complete, Implementation Ready  
**Date**: February 22, 2026  
**Previous Phase**: Phase 12 (The Chronicler's Bridge & Beta Graduation) ✅ COMPLETE  

---

## 1. Phase 13 Overview

**Title**: The Ascension Protocol: Multi-Generational Mastery

**Goal**: Implement the "Final Act" of a character's journey through ascension mechanics that allow players to transcend mortality and influence the world's future generations. Core focus is hardening soul mirror séance rituals, cross-generational paradox tracking, and UI for character transcendence.

**Key Concept**: Players who complete an epoch can now "Ascend" — canonizing their deeds, blessing/cursing future generations, and bridging missing investigation links through ancestor guidance.

---

## 2. Current Infrastructure Analysis

### Existing Systems Ready to Integrate

**Soul Mirror Séance Engine** (`soulMirrorSéanceEngine.ts` - 332 lines)
- ✅ `queryAncestorGuidance()` function exists
- ✅ Supports investigationChainId, targetLocationId, targetNpcId queries
- ⚠️ Currently returns AncestorGuidance[] but doesn't unlock Clues in knowledgeBase
- ⚠️ No integration with investigationPipelineEngine yet

**Legacy Impact System** (`legacyEngine.ts` - 1035 lines)
- ✅ `transmitSoulEchoes()` implemented (Phase 12)
- ✅ `LegacyImpact` interface exists with deeds, relics, factionInfluence
- ⚠️ Missing `AncestralBoon` and `AncestralBlight` type definitions
- ⚠️ No `applyAncestralLegacy()` function to hydrate new character stats
- ⚠️ inheritedPerks field not properly integrated with statusEffects

**Paradox Engine** (`paradoxEngine.ts` - 445 lines)
- ✅ Tracks suspicionLevel (metagaming detection)
- ✅ Tracks temporalDebt (save-scumming)
- ⚠️ Missing generationalParadox field in WorldState
- ⚠️ No "Temporal Fractures" event generation for high cumulative paradox (>=150)
- ⚠️ No reality-warping anomaly manifestations

**World State** (`worldEngine.ts` - 2427 lines)
- ✅ paradoxLevel (0-100) exists
- ✅ ageRotSeverity tracking exists
- ⚠️ Missing `generationalParadox: number` field (must persist across epochs)
- ⚠️ No epochsSpanned or totalGenerations tracking

**Investigation Pipeline** (`investigationPipelineEngine.ts` - 362 lines)
- ✅ Core investigation system exists
- ✅ Clues and contradictions tracked
- ⚠️ No mechanism for unlocking clues via ancestor guidance

---

## 3. Phase 13 Implementation Tasks

### Task 1: Soul Mirror Séance Integration ⭐
**File**: `soulMirrorSéanceEngine.ts`  
**Scope**: Refactor `queryAncestorGuidance()` to unlock Clues

**Subtasks**:
1. Update `queryAncestorGuidance()` signature to accept `investigationPipeline` parameter
2. For each `AncestorGuidance` returned with `clueIds`:
   - Call `investigationPipeline.discoverClue(investigationId, clue)` 
   - Unlock matching Clue items in player's knowledgeBase
   - Mark Codex entries as revealed
3. Add event emission when clues are unlocked: `ANCESTOR_CLUE_REVEALED`
4. Integrate with `Codex` display (if exists)

**Verification**:
- Conduct Soul Mirror Séance on specific investigation
- Verify hidden Clue is revealed in Codex without manual exploration
- Confirm resonanceStrength affects clue unlock probability

---

### Task 2: Ancestral Blessings/Curses Implementation ⭐
**File**: `legacyEngine.ts`  
**Scope**: Add typed blessing/curse mechanics

**Subtasks**:
1. Define new type interfaces:
   ```typescript
   export type AncestralBoon = {
     id: string;
     name: string;  // e.g., "Resonant Soul", "Blessed Bloodline"
     description: string;
     bonusType: 'stat' | 'ability' | 'resistance' | 'skill';
     targetStat?: string;  // 'str', 'int', 'cha', etc.
     magnitude: number;  // Bonus amount or level
     duration?: 'permanent' | 'epoch' | 'temporary';
   };

   export type AncestralBlight = {
     id: string;
     name: string;  // e.g., "Tainted Bloodline", "Curse of Paradox"
     description: string;
     penaltyType: 'stat' | 'vulnerability' | 'curse';
     targetStat?: string;
     magnitude: number;
     duration?: 'permanent' | 'epoch' | 'temporary';
   };
   ```

2. Update `LegacyImpact` interface:
   ```typescript
   ancestralBooms?: AncestralBoon[];
   ancestralBlights?: AncestralBlight[];
   canonicalDeeds?: string[];  // Player-selected favorite deeds
   heirlooms?: Array<{ itemId: string; instanceId: string }>;  // 1 unique item max
   ```

3. Implement `applyAncestralLegacy(state: WorldState, legacy: LegacyImpact): WorldState`:
   - Add inheritance bonuses to new character's statusEffects
   - Apply stat modifiers to player stats (e.g., +5 STR from "Warrior's Strength")
   - Grant ancestral abilities/skills
   - Add curses/blights as negative status effects
   - Unlock heirloom item in new character's inventory

**Verification**:
- Start new character after ascension
- Verify `AncestralBoon` (e.g., "Resonant Soul") in statusEffects
- Confirm stat bonuses applied to starting stats
- Check heirloom item available in inventory

---

### Task 3: Multi-Generation Paradox Tracking ⭐
**File**: `worldEngine.ts` + `paradoxEngine.ts` + `chronicleEngine.ts`  
**Scope**: Add generational paradox persistence

**Subtasks**:
1. Add to `WorldState` interface:
   ```typescript
   generationalParadox?: number;  // Cumulative paradox across all epochs (never resets)
   epochGenerationIndex?: number; // Which generation (1, 2, 3, etc.)
   ```

2. Update `advanceToNextEpoch()` in chronicleEngine.ts:
   - Preserve `generationalParadox` from old state
   - Only increment based on new epoch's paradoxLevel
   - Pass forward: `newState.generationalParadox = oldState.generationalParadox + (oldState.paradoxLevel || 0)`

3. In `paradoxEngine.ts`, add new function:
   ```typescript
   export function checkTemporalFractures(generationalParadox: number): {
     hasFractures: boolean;
     anomalyType?: string;
     severity?: 'minor' | 'major' | 'catastrophic';
   }
   ```
   - If generationalParadox >= 150: Trigger "Temporal Fractures"
   - Manifestations: reality glitches, NPC spawn errors, environmental anomalies
   - Generate `TEMPORAL_FRACTURE` events

4. Add anomaly types:
   - "Phased NPC" - NPC at two locations simultaneously
   - "Weather Loop" - Same weather for multiple days
   - "Location Drift" - Location coordinates shift unpredictably
   - "Echo Conflict" - Contradictory ancestor guidance

**Verification**:
- Complete 3-epoch transition
- Check DirectorConsole: `generationalParadox` sums correctly
- Trigger fractures: 150+ cumulative paradox should manifest anomalies
- Verify manifestations persist across locations

---

### Task 4: Ascension Protocol UI ⭐
**File**: Create `AscensionProtocolView.tsx`  
**Scope**: UI for character transcendence ritual

**Subtasks**:
1. Create new component:
   ```typescript
   export interface AscensionProtocolViewProps {
     state: WorldState;
     legacy: LegacyImpact;
     onCanonize: (selectedDeeds: string[]) => void;
     onSelectHeirlooms: (items: InventoryItem[]) => void;
     onComplete: (finalLegacy: LegacyImpact) => void;
   }
   ```

2. UI Sections:
   - **Deed Selection Panel**: Display grand deeds from eventLog, allow player to "Canonize" top 3-5 favorites
   - **Legacy Summary**: Show ancestry tree, myth status, faction legacies
   - **Heirloom Selection**: Display inventory, allow 1 unique item selection for next gen
   - **Blessing Preview**: Show calculated ancestral boons (based on deeds + mythStatus)
   - **Ritual Animation**: Soul Mirror reflection, ancestor whispers

3. Integration points:
   - Triggered during `RESOLVE_CHRONICLE_EPOCH` action
   - Calls `applyAncestralLegacy()` on completion
   - Saves final LegacyImpact to `WorldTemplate.soulEchoes`

**Verification**:
- Perform ascension in UI
- Verify LegacyImpact saved to WorldTemplate
- Confirm blessings calculated correctly
- Check heirloom appears in next-gen inventory

---

### Task 5: Mastery Verification - Stress Test ⭐
**File**: Update `ten-thousand-year-sim.ts`  
**Scope**: Add generational paradox stress tests

**Subtasks**:
1. Extend SimulationResult interface:
   ```typescript
   generationalParadoxTrajectory?: Array<{ epoch: number; paradoxValue: number }>;
   ancestredBonus?: Array<{ generation: number; bonusesApplied: string[] }>;
   temporalFracturesTriggered?: Array<{ generationalParadox: number; anomaly: string }>;
   ```

2. Update 5-ascension loop:
   - Track cumulative paradoxDebt from each epoch
   - Sum into generationalParadox at epoch boundaries
   - Log when generationalParadox > 100, 150, 200
   - Verify temporal fractures trigger at >= 150
   - Check environmental stability at high paradox

3. Add verification checks:
   - "Ancestral Bonus Stress Test": Verify ascended ancestors (mythStatus > 50) provide +50% soul echo guidance
   - "Paradox Accumulation Test": Verify 5-epoch run reaches target paradox threshold and triggers anomalies
   - "World Stability Test": Verify high paradox causes location coordinate drift or NPC anomalies

**Verification**:
- Run sim with 5 ascensions
- Confirm cumulative paradox correctly summed
- Verify fractures at >= 150 threshold
- Check ascended ancestors improve echo guidance quality

---

## 4. Integration Dependencies

**Critical Linking Order**:
1. ✅ Phase 12 complete (legacy transmission, world aging, chronicle resolution)
2. ⭐ Task 3 (Paradox Tracking) - Must add generationalParadox field first
3. ⭐ Task 2 (Ancestral Mechanics) - Uses LegacyImpact interface
4. ⭐ Task 4 (Ascension UI) - Uses Task 2 output, triggers Task 5
5. ⭐ Task 1 (Soul Mirror) - Can run parallel with others, uses investigationPipeline
6. ⭐ Task 5 (Stress Test) - Validates all tasks together

---

## 5. Technical Decisions

**Paradox Persistence**: `generationalParadox` is additive and non-decaying to emphasize permanent "footprint" consequences.

**Heirloom Limit**: Capped at 1 unique item per ascension to preserve early-game challenge.

**Boon/Blight Duration**: "Permanent" bonuses carry forward, "Epoch" bonuses reset each epoch, "Temporary" expire after specific trigger.

**Anomaly Manifestation**: Temporal fractures are director-driven (via aiDmEngine) to ensure narratively coherent glitches.

---

## 6. Testing Strategy

**Unit Tests**:
- `applyAncestralLegacy()` correctly hydrates stat bonuses
- Temporal fractures trigger at 150+ paradox
- Soul echo unlock works with investigation pipeline

**Integration Tests**:
- End-to-end ascension: transmit → select boons → unlock UI
- Multi-gen paradox tracking across 5-epoch sim
- Ancestral guidance reveals correct clues

**Stress Tests**:
- 10K year sim with 5 generations
- Cumulative paradox trajectory stays reasonable
- Memory usage < 100MB during full stress test

---

## 7. Success Criteria

✅ **Phase 13 Complete When**:
- Soul Mirror Séance unlocks clues via ancestor guidance
- New characters inherit ancestral boons/blights correctly
- Generational paradox persists and triggers fractures at 150+
- Ascension Protocol UI shows deeds/heirlooms and generates correct LegacyImpact
- 5-ascension stress test verifies all systems cooperate
- 0 critical errors across Phase 13 systems
- Memory footprint stable (<100MB)

---

## 8. Next Phases

**Phase 14**: The Apex Convergence - Final endgame content, mega-bosses, ultimate paradox resolution  
**Phase 15**: The Infinite Recursion - Advanced relic infusion, multi-item corruption tracking, perpetual ascension loop

