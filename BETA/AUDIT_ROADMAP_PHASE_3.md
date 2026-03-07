# BETA Audit Roadmap - Phase 3+ (Post-Compilation)

> **Current State**: 26/62 errors fixed (73% compilation progress)  
> **Target**: Production-ready BETA Phase 1 with zero critical vulnerabilities  
> **Session Date**: March 4, 2026

---

## 🎯 Strategic Audit Priority Matrix

### TIER 1: CRITICAL BLOCKERS (Must Fix Before Build)
*Estimated Time: 2-3 hours | Blocks: `npm run dev` full verification*

| Priority | Audit | Impact | Files | Est. Time |
|----------|-------|--------|-------|-----------|
| **P0.1** | ✅ **Complete Compilation (26 → 0 errors)** | Build cannot succeed | EngineOrchestrator.ts, Phase5Manager.ts, PostgresAdapter.ts | 1.5 hrs |
| **P0.2** | ✅ **Verify Game Loop Integration** | Server can't boot | server-start.ts, EngineOrchestrator entrypoint | 30 min |

**Why First**: Without zero-error compilation, cannot run integration tests or verify production readiness.

---

### TIER 2: PRODUCTION VULNERABILITIES (Security & Balance)
*Estimated Time: 4-5 hours | Blocks: Phase 46 economic release*

#### **P1.1: Phase 45 Proficiency XP Exploitation** 🔴 CRITICAL

**Vulnerability**: Gathering actions bypass significance validation entirely
```typescript
// proficiencyEngine.ts:207-209 (EMPTY CASE)
case 'gathering':
  // ⚠️ NO VALIDATION — accepts all gathering actions
  break;
```

**Impact**:
- Player reaches Mastery (level 20) in 2 weeks vs. intended 3 months
- Economy destroyed before Phase 49 marketplace launch
- Players can XP farm indefinitely on same tile

**Files to Audit**:
- [proficiencyEngine.ts](BETA/src/engine/proficiencyEngine.ts) (lines 166-215)
- [spatialInteractionEngine.ts](BETA/src/engine/spatialInteractionEngine.ts) (lines 151-238)
- [worldEngine.ts](BETA/src/engine/worldEngine.ts) (~5290, XP grant call site)

**Required Fixes**:
1. Add `tile.lastHarvestTick` + `HARVEST_COOLDOWN_TICKS = 600` (10 min)
2. Reject gathering XP on action failure (success only = +XP)
3. Create global `player.dailyXpEarnedGlobal` with cap (not per-skill)
4. Test: Run millennium sim, verify Mastery takes 3+ months

**Time**: ~3 hours | **Severity**: CRITICAL

---

#### **P1.2: Cross-Epoch Soul Echo Seeding** ⚠️ IMPORTANT

**Audit Target**: ReincarnationEngine soul persistence logic
```typescript
// From conversation: "Soul Echoes + Great Library persist across epochs"
// Verify: Deeds properly carry to next epoch
// Verify: NPC memory population follows canon rules
```

**Files to Audit**:
- [ReincarnationEngine.ts](BETA/src/engine/ReincarnationEngine.ts) (lines 120-300)
- [chronicleEngine.ts](BETA/src/engine/chronicleEngine.ts) (lines 120-200)

**Risk**: If soul injection fails, player legacy achievements don't persist → breaks long-term narrative

**Time**: ~2 hours | **Severity**: HIGH

---

### TIER 3: VISUAL & IMMERSION QUALITY (Phase 45 UX)
*Estimated Time: 3-4 hours | Blocks: Phase 45 production polish*

#### **P2.1: Z-Fighting on Isometric Grid** 🟠 MEDIUM

**Issue**: At 45° camera rotation + 200% zoom, tile status indicators flicker

**Root Cause**: Canvas 2D painter's algorithm; all layers render same plane (no `translateZ`)

**Audit**:
- [TacticalBoard.tsx](BETA/src/components/TacticalBoard.tsx) (lines 113-220)
  - Verify: `drawIsometricTile()` method doesn't use depth layering
  - Check: Canvas 2D context lacks z-depth support
  
**Fix Strategy**:
1. Enable CSS 3D transforms in [TabletopContainer.module.css](BETA/src/components/TabletopContainer.module.css) line 43
2. Apply `translateZ(1px)` to status indicator renders
3. Test at 200% zoom + 45° rotation

**Time**: 1-2 hours | **Severity**: MEDIUM (visual quality, not functional)

---

#### **P2.2: Codec Transition "Hybrid States"** 🟠 MEDIUM

**Issue**: During Medieval → Cyberpunk codec shift, player sees both aesthetics in same frame

**Root Cause**: CodecTransitionOverlay plays 500ms animation but child components update asynchronously

**Audit**:
- [CodecTransitionOverlay.tsx](BETA/src/components/CodecTransitionOverlay.tsx) (lines 69-120)
  - Verify: Event subscription timing vs. child re-render
  - Check: No explicit broadcast signal for codec changes
  
**Fix Strategy**:
1. Add explicit codec update broadcast to ThemeManager
2. Force React batch update using `flushSync()` or `useTransition`
3. Synchronize overlay 500ms animation with child re-render completion

**Time**: 1.5 hours | **Severity**: MEDIUM (immersion, not critical path)

---

#### **P2.3: Shadow/Light Model Consistency** 🟢 LOW

**Issue**: Sidebar has 3D drop-shadow; board tiles render flat
- Breaks tabletop aesthetic consistency

**Audit**:
- [TabletopContainer.tsx](BETA/src/components/TabletopContainer.tsx)
- [TabletopContainer.module.css](BETA/src/components/TabletopContainer.module.css)

**Fix**: Unify drop-shadow filter across sidebar + board

**Time**: 30 min | **Severity**: LOW (polish only)

---

### TIER 4: INFRASTRUCTURE & PERSISTENCE
*Estimated Time: 2-3 hours | Blocks: Database operations in production*

#### **P3.1: PostgresAdapter Event Flushing** ⚠️ IMPORTANT

**Status**: Syntax error fixed; need functional audit

**Files to Audit**:
- [PostgresAdapter.ts](BETA/src/engine/persistence/PostgresAdapter.ts) (post-fix state)
  - Verify: `flushRewindEvents()` method works correctly
  - Check: Event queue batching doesn't overflow
  - Verify: Connection pooling under high load

**Test**:
```bash
npm run test -- persistence-adapter
# Expected: Event flushing batches correctly, no connection leaks
```

**Time**: 1 hour | **Severity**: HIGH (data integrity)

---

#### **P3.2: Redis Cache Coherence** ✅ AUDITED

**Status**: Mock RedisCache created; need integration testing

**Verify**:
- Socket.IO Redis adapter correctly syncs state
- Cache invalidation on write operations
- Race conditions on concurrent updates

**Test**:
```bash
npm run server:dev &
npm run dev &
# Manually test multiplayer state sync
# Check Redis logs for cache coherence
```

**Time**: 1.5 hours | **Severity**: MEDIUM (multiplayer)

---

## 📋 RECOMMENDED AUDIT SEQUENCE

### **Session 3 (2-3 hours)** — Production Build
```
[ ] 1. Fix remaining 26 compilation errors
[ ] 2. Run npm run build → verify 0 errors
[ ] 3. Run npm run start → verify server boots
[ ] 4. Test /api/health endpoint
```

### **Session 4 (3-4 hours)** — Vulnerability Audit
```
[ ] 1. Investigate ParadoxTracker/ActiveFaction properties (investigation phase)
[ ] 2. Fix Phase 45 proficiency XP exploitation
[ ] 3. Run millennium sim → verify Mastery takes 3+ months
[ ] 4. Run stress-test → verify economy doesn't collapse
```

### **Session 5 (2-3 hours)** — Soul Echo & Persistence
```
[ ] 1. Audit ReincarnationEngine soul injection
[ ] 2. Trace cross-epoch adventure/chronicle propagation
[ ] 3. Test: Play 3 epochs, verify achievements carry forward
```

### **Session 6 (3-4 hours)** — Visual Quality (Optional but Recommended)
```
[ ] 1. Enable TabletopContainer 3D transforms
[ ] 2. Test Z-fighting at 45°/200% zoom
[ ] 3. Implement codec transition broadcast
[ ] 4. Verify shadow consistency
```

### **Session 7 (1-2 hours)** — Infrastructure Verification
```
[ ] 1. Integration test: PostgresAdapter event flushing
[ ] 2. Integration test: Redis cache coherence
[ ] 3. Multiplayer state sync verification
[ ] 4. Load test: 10 concurrent player sessions
```

---

## 🔍 INVESTIGATION CHECKLIST (For Session 3)

Before fixing remaining 26 errors, gather these type definitions:

```bash
# 1. Find actual ParadoxTracker properties
grep -r "interface ParadoxTracker" BETA/src/types/

# 2. Find actual ActiveFaction properties
grep -r "interface ActiveFaction\|type ActiveFaction" BETA/src/types/

# 3. Find PersistenceManager.createWorldSnapshot signature
grep -A 10 "createWorldSnapshot" BETA/src/engine/PersistenceManager.ts

# 4. Find Phase5Manager.processTick signature
grep -A 5 "processTick" BETA/src/engine/Phase5Manager.ts
```

**Create findings document**: `BETA/INVESTIGATION_SESSION3_FINDINGS.md`

---

## 📊 AUDIT COMPLETION CHECKLIST

- [ ] **Compilation**: 26 → 0 errors
- [ ] **Game Logic**: Millennium sim passes (1000-year run)
- [ ] **Proficiency**: XP capped correctly, Mastery takes 3+ months
- [ ] **Soul Echoes**: Cross-epoch deeds carry forward
- [ ] **Persistence**: PostgreSQL event flushing works
- [ ] **Cache**: Redis coherence verified
- [ ] **Visual**: Z-fighting fixed, codec transitions smooth
- [ ] **Integration**: Full server + client boot successful
- [ ] **Stress Test**: 10 concurrent players, no corruption
- [ ] **Documentation**: All audit findings documented

---

## 🎯 SUCCESS CRITERIA FOR BETA PHASE 1

By end of comprehensive audit:
```
✅ npm run build → PASSES (0 errors)
✅ npm run dev → LAUNCHES (UI loads)
✅ npm run server:dev → BOOTS (/api/health responds)
✅ npm run millennium → PASSES (1000-year sim completes)
✅ npm run stress-test → PASSES (economy stable)
✅ No proficiency XP exploitation possible
✅ Soul echoes persistent across epochs
✅ Visual quality matches production standards
✅ Database transactions atomic & consistent
```

---

## 📞 AUDIT HANDOFF

**Current State**: 26 errors remaining, all P0.1 compilation blockers  
**Next Immediate Action**: Session 3 compilation fixes (1.5 hrs)  
**Then**: Session 4 vulnerability audit (P1.1 proficiency exploitation is CRITICAL)  
**Total Path to Production**: 6-8 hours remaining work

---

**Last Updated**: March 4, 2026 | Session 2 Complete  
**Next Session**: Investigation Phase (type definitions) + Compilation Fixes
