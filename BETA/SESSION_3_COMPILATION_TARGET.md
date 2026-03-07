# Session 3 Compilation Fix Target (26 Remaining Errors)

> **Goal**: Reduce 26 → 0 errors to enable production build  
> **Estimated Time**: 1.5-2 hours  
> **Focus**: Type alignment only (no logic changes needed)

---

## 📊 Error Distribution (26 Total)

| File | Errors | Type | Priority |
|------|--------|------|----------|
| EngineOrchestrator.ts | 17 | Type/signature mismatches | P0.1 |
| Phase5Manager.ts | 1 | Property mismatch | P0.1 |
| PostgresAdapter.ts | 1 | Scope issue | P0.1 |
| Phase7.spec.ts | 3 | Method signature (test) | P1 |
| Phase8.spec.ts | 2 | vitest missing + method (test) | P1 |
| DatabaseQueue.ts | 2 | Method references (test) | P1 |

**BLOCKING BUILD**: EngineOrchestrator.ts (17) + Phase5Manager.ts (1) + PostgresAdapter.ts (1) = **19 errors**  
**NON-BLOCKING** (test-only): Phase7.spec.ts + Phase8.spec.ts + DatabaseQueue.ts = **7 errors**

---

## 🔴 TOP PRIORITY: EngineOrchestrator.ts (17 Errors)

### Investigation Required First (15 minutes)

You need the actual type signatures. Run these in BETA directory:

```bash
# Find ParadoxTracker definition
grep -n "interface ParadoxTracker\|type ParadoxTracker" src/types/*.ts

# Find ActiveFaction definition  
grep -n "interface ActiveFaction\|type ActiveFaction" src/types/*.ts

# Find Vessel definition
grep -n "interface Vessel\|type Vessel" src/types/*.ts

# Find PersistenceManager methods
grep -n "createWorldSnapshot\|calculateStateHash" src/engine/PersistenceManager.ts | head -20
```

### Error Categories to Fix

**Error Group 1: ParadoxTracker property mismatch**
- Line 519: `.currentLevel` should be correct property name
- Fix: Replace with actual property name from type definition

**Error Group 2: ActiveFaction property mismatches**  
- Line 353: `.power` property missing
- Line 507: `.territoriesControlled` property missing
- Fix: Find correct property names from ActiveFaction interface

**Error Group 3: Method signature mismatches**
- Line 270: `processTick()` expects different arg count
- Line 281: `createWorldSnapshot()` expects 9 args, getting 3
- Line 321: `recordLedgerEntry()` expects 5 args, getting 1
- Fix: Match actual signatures from implementation

**Error Group 4: Type conversion issues**
- Line 460: `vessels` is `Map<string, Vessel>` but expects `Vessel[]`
- Fix: Convert to array: `Array.from(this.vessels.values())`

**Error Group 5: StateHash property mismatches**
- Lines 459, 544, 625: `StateHash` missing `calculatedAt` property
- Fix: Remove from call site or add to StateHash type

---

## 🟡 SECONDARY PRIORITY: Phase5Manager.ts (1 Error)

**Line 29**: `GlobalConstants` missing `snapshotIntervalTicks`
- Find: Actual GlobalConstants definition
- Fix: Add missing property or remove from ParadoxTracker

---

## 🟡 SECONDARY PRIORITY: PostgresAdapter.ts (1 Error)

**Line 239**: Scope issue - `toFlush` variable undefined
- Context: Part of event flushing logic  
- Fix: Declare variable in correct scope or pass as parameter

---

## 📝 STEP-BY-STEP SESSION 3 PLAN

### Step 1: Gather Intelligence (15 minutes)
```bash
cd BETA

# Create investigation file with actual type definitions
echo "# Type Definitions Investigation" > INVESTIGATION_SESSION3_OUTPUT.md

# Run discovery commands and save to file
grep -n "interface ParadoxTracker\|type ParadoxTracker" src/types/*.ts >> INVESTIGATION_SESSION3_OUTPUT.md
grep -n "interface ActiveFaction\|type ActiveFaction" src/types/*.ts >> INVESTIGATION_SESSION3_OUTPUT.md
grep -n "interface Vessel\|type Vessel" src/types/*.ts >> INVESTIGATION_SESSION3_OUTPUT.md

# Review findings
code INVESTIGATION_SESSION3_OUTPUT.md  # Opens in VS Code
```

### Step 2: Fix EngineOrchestrator Type Alignments (45 minutes)

For each error group identified in investigation:
1. Open [EngineOrchestrator.ts](file:///c%3A/Users/Jaoce/OneDrive/Documents/GitHub/project-isekai-v2/BETA/src/engine/EngineOrchestrator.ts)
2. Replace incorrect property/method names with correct ones
3. Convert Map→Array where needed  
4. Run `npx tsc --noEmit` to verify each group

### Step 3: Fix Phase5Manager & PostgresAdapter (10 minutes)
1. [Phase5Manager.ts](file:///c%3A/Users/Jaoce/OneDrive/Documents/GitHub/project-isekai-v2/BETA/src/engine/Phase5Manager.ts) line 29
2. [PostgresAdapter.ts](file:///c%3A/Users/Jaoce/OneDrive/Documents/GitHub/project-isekai-v2/BETA/src/engine/persistence/PostgresAdapter.ts) line 239

### Step 4: Verify Build (10 minutes)
```bash
npm run build
# Expected: 0 TypeScript errors, .next folder created
```

### Step 5: Test Runtime (10 minutes)
```bash
npm run stress-test
# Expected: completedSuccessfully: true

npm run millennium  
# Expected: All 10 epochs complete, ✅ Founder's Blade found
```

---

## 🔍 CRITICAL INVESTIGATION COMMANDS

Save output to file for reference:

```bash
# 1. ParadoxTracker actual interface
grep -B2 -A15 "interface ParadoxTracker" src/types/*.ts

# 2. ActiveFaction actual interface
grep -B2 -A15 "interface ActiveFaction" src/types/*.ts

# 3. Vessel actual interface  
grep -B2 -A15 "interface Vessel" src/types/*.ts

# 4. PersistenceManager.createWorldSnapshot full signature
grep -B1 -A8 "createWorldSnapshot(" src/engine/PersistenceManager.ts

# 5. ReincarnationEngine soul field name
grep "souls\|soulRegistry" src/engine/ReincarnationEngine.ts | head -3
```

---

## ⚠️ GOTCHAS TO AVOID

❌ **DON'T** cast types with `as any` — defeats strict mode  
✅ **DO** find actual type definitions and align call sites  

❌ **DON'T** add properties to types just to make things work  
✅ **DO** check if property has different name or structure  

❌ **DON'T** change method signatures in implementations  
✅ **DO** change how methods are called (args/return types)  

❌ **DON'T** skip verification with `npm run build`  
✅ **DO** verify 0 errors before moving to next group

---

## 📌 SUCCESS CRITERIA

Session 3 is complete when:

```
✅ npm run build    → SUCCESS (0 errors)
✅ npm run dev      → Ready on localhost:3000
✅ npm run server:dev → Ready on localhost:5000
✅ npm run millennium → All 10 epochs complete
✅ npm run stress-test → errorCount: 0
```

If ANY of these fail, fix before moving to Session 4.

---

## 📞 HANDOFF NOTES

- **Investigation phase is critical** — spending 15 min on discovery saves 30 min in fixing
- **EngineOrchestrator.ts is the hub** — fixing its 17 errors likely cascades fixes to other files
- **Test errors can wait** — Phase7/Phase8/DatabaseQueue errors won't block build, only testing
- **Three independent error groups** — can be fixed in parallel if multiple editors open

**Estimated Session 3 End Time**: ~2 hours from start to 0 errors  
**Ready for Next Audit**: Phase 45 proficiency XP vulnerability (Session 4)

---

**Created**: March 4, 2026 22:45 UTC  
**For**: Compilation fix automation  
**Status**: Ready for Session 3 execution
