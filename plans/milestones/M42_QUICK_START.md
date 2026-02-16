# M42 — Executive Summary & Quick-Start Guide

> **Status:** ACTIVE
> **Category:** ROADMAP
> **Updated:** February 16, 2026

---

> **Milestone 42 — Social Scaling & Epoch Immersion**  
> **Duration:** 16–18 days (2.5–3 weeks)  
> **Team: 1–3 developers (parallel possible)**  
> **Reference Docs:** `plans/42_ROADMAP.md`, `plans/M42_TASK_LIST.md`

---

## What is M42?

Post-M41 (Beta Launch Readiness), **M42** transforms the multiplayer experience from functional to *immersive*. With M41's Director Mode, Onboarding, Telemetry, Performance validated, Epoch themes, and Smoke tests now in place, M42 elevates:

| What M41 Built | What M42 Adds |
|---|---|
| Epoch themes | **Epoch theme sync across peers** (instant <100ms) |
| Onboarding scaffold | **Advanced tier 2 milestones** (Diplomat, Weaver, Director) |
| Dev telemetry (BugExport) | **Live diagnostic feeds** (faction power, consensus health, macro events) |
| Performance baselines | **Stress test validation** (16 peers @ 10 evt/sec, <50ms p95 latency) |
| Smoke test scenarios | **Cinematic overlay** masking heavy state rebuilds |
| — | **Dice Altar modal** (D20 resolution for all critical actions) |
| — | **Atomic trade swaps** (P2P inventory with no duplication) |
| — | **Player echoes (Phantoms)** (4–10 anonymized ghosts populate world) |

---

## The 8 Tasks at a Glance

| # | Task | Complexity | Owner | Est. Days | Deliverable |
|---|---|---|---|---|---|
| 1 | Epoch Sync | 🟡 Med | Engine | 3–4 | Peers morph themes <100ms sync |
| 2 | Dice Altar | 🟠 Med-High | UI/Engine | 4–5 | Modal routing all critical actions |
| 3 | Diagnostics | 🟡 Med | UI | 3–4 | Live faction/consensus/events graphs |
| 4 | Atomic Trades | 🔴 High | Engine | 5–6 | P2P trades, 0 duplication bugs |
| 5 | Cinematic Transitions | 🟡 Med | UI/Engine | 3–4 | Glitch overlay during rebuilds |
| 6 | Tier 2 Tutorial | 🟢 Low-Med | Engine | 2–3 | Auto-detect 3 advanced milestones |
| 7 | Player Phantoms | 🟠 Med-High | Engine/API | 4–5 | 4–10 ghosts populate world |
| 8 | Stress Test | 🟡 Med | Engine/CI | 3–4 | 16-peer cluster validation |

**Total Est. Effort:** 28–35 developer-days (achievable in ~18 calendar days with 1.5–2 devs)

---

## Task Dependencies & Sequencing

```
                    START HERE
                        |
                  ┌─────┴─────┐
                  │             │
              Task 1        Task 2
             (Epoch Sync)   (Dice Altar)
                  │             │
         ┌────────┴─────┐   ┌────────────┐
         │              │   │            │
     Task 3 ← ─ ─ ─ ─ ─ Task 4       Task 6
   (Diagnostics)   (Atomic Trades)  (Tier 2 Tutorial)
         │              │
         └─────┬────────┘
               │
          ┌────┴──────┐
          │           │
      Task 5      Task 7
   (Cinematic)   (Phantoms)
          │           │
          └─────┬─────┘
                │
            Task 8
        (Stress Test)
        [VALIDATES ALL]
        
    GREEN = Can start immediately
    YELLOW = Wait for dependency
    RED = Blocker
```

**Recommend:** Start Task 1 + Task 2 in parallel (independent). Task 6 can also start immediately.

---

## File Structure — What Gets Created

```
plans/
  42_ROADMAP.md                        ← High-level roadmap (this era)
  M42_TASK_LIST.md                     ← Sprint-ready task breakdown
  M42_QUICK_START.md                   ← This file

PROTOTYPE/src/engine/
  epochSyncEngine.ts                   ← Task 1: P2P epoch broadcast
  atomicTradeEngine.ts                 ← Task 4: Atomic commit logic
  transitionEngine.ts                  ← Task 5: Cinematic overlay control
  phantomEngine.ts                     ← Task 7: Ghost player tracking
  diagnosticsEngine.ts                 ← Task 3: Telemetry data extraction

PROTOTYPE/src/client/components/
  DiceAltarModal.tsx                   ← Task 2: Main D20 modal
  CraftingModal.tsx                    ← Task 2: Crafting integration
  RitualModal.tsx                      ← Task 2: Ritual integration
  TradeOverlay.tsx                     ← Task 4: Trade negotiation UI
  WorldStateTransitionOverlay.tsx       ← Task 5: Glitch cinematic
  DiagnosticPanel.tsx                  ← Task 3: Sidebar diagnostics

PROTOTYPE/src/__tests__/
  epoch-sync.test.ts, epoch-rollback.test.ts, epoch-consensus.test.ts
  diceAltar.test.ts, crafting-*.test.ts, ritual-*.test.ts
  mutation-idempotence.test.ts, trade-*.test.ts
  diagnostic-panel.test.ts, consensus-telemetry.test.ts
  phantom-engine.test.ts, phantom-render.test.ts, phantom-fade.test.ts
  transition-*.test.ts
  tutorial-*.test.ts, tutorial-tier-progression.test.ts
  cluster-stress-test.integration.test.ts

PROTOTYPE/src/pages/api/
  sessions/active.ts                   ← Task 7: Anonymized ghost query API

scripts/
  cluster-stress-test.ts               ← Task 8: 16-peer @ 10evt/sec simulation
  cluster-stress-report.ts             ← Task 8: Metrics → markdown report
  run-cluster-stress.sh (or .ps1)      ← Task 8: Runner script

PROTOTYPE/artifacts/ (post-completion)
  M42_COMPLETE_SUMMARY.md              ← Recap of all deliverables
  M42_CLUSTER_STRESS_REPORT.md         ← Stress test results
  M42_STATUS_REPORT.txt                ← Production readiness checklist
```

---

## Key Integration Points

### 1. **epochSyncEngine ↔ multiplayerEngine**
   - When epoch shifts locally, broadcast to peers
   - Store shifts in `SessionRegistry.epochHistory`
   - Consensus logic for tie-breaking (multiple simultaneous proposals)

### 2. **diceAltarEngine ↔ actionPipeline**
   - All actions route through `DiceAltarModal` before execution
   - Modal shows math, resolves D20 roll, applies outcome
   - Mutations recorded atomically (audit trail for replay)

### 3. **atomicTradeEngine ↔ mutationLog**
   - Trade locked → single `ATOMIC_TRADE` mutation
   - Idempotent (applies once on replay, no duplication)
   - No mid-swap cancellations allowed

### 4. **transitionEngine ↔ stateRebuilder**
   - Heavy rebuild operations trigger overlay
   - Overlay duration synced to actual rebuild time (from Task 8 baseline)

### 5. **phantomEngine ↔ worldEngine + SessionRegistry**
   - Query active sessions for ghost data
   - Anonymize & procedurally name ghosts
   - Render ghosts as translucent NPCs (read-only)

### 6. **tutorialEngine (extended) ↔ TutorialOverlay**
   - New Tier 2 milestones auto-detect
   - Trigger overlay with "Tier 2" badge

---

## Testing Strategy

### Unit Tests
- Each engine (epochSync, diceAltar, atomicTrade, transition, phantom, diagnostics) has dedicated test suite
- Isolated from UI; test pure functions

### Integration Tests
- Modals + engines together (e.g., CraftingModal → diceAltarEngine → inventory mutation)
- Trade full flow (Propose → Negotiate → Lock → Commit)
- Epoch sync across 4 simulated peers

### Stress Test (Task 8)
- 16 peers, 10 evt/sec each, 60 seconds
- **Success Criteria:**
  - P95 rebuild latency < 50ms
  - Consensus sync < 200ms p99
  - 0 memory leaks
  - All events replayed identically

### Smoke Tests
- All M42 features work end-to-end in BetaApplication
- No regressions vs M41 baselines (performance, UX, reliability)
- All tests passing: `npm test -- M42`

---

## Implementation Phases

### Phase 1: Foundation (Days 1–5)
```
✅ Task 1: Epoch Sync (core P2P broadcast)
✅ Task 2: Dice Altar (modals, D20 math)
✅ Task 6: Tier 2 Tutorial (quick win, extends tutorialEngine)
✅ Task 3: Diagnostics (sidebar graphs)
```
Validate: Epoch morphing, D20 modal, tutorial detection working.

### Phase 2: Advanced (Days 6–10)
```
✅ Task 4: Atomic Trades (full trade flow, atomic commits)
✅ Task 5: Cinematic Transitions (overlay + stateRebuilder sync)
✅ Task 7: Phantoms (ghost engine + API + rendering)
```
Validate: All trades atomic, no duplication. Overlays display. Ghosts populate.

### Phase 3: Validation (Days 11–15)
```
✅ Task 8: Stress Test (16-peer simulation, metrics)
✅ Final Testing (all suites green)
✅ Documentation & Sign-off
```
Validate: System stable under 160 evt/sec load.

---

## Success Criteria (Gate)

**M42 is COMPLETE when:**

1. ✅ All 8 tasks implemented + integrated
2. ✅ 0 TypeScript compilation errors
3. ✅ All task-specific test suites passing
4. ✅ Stress test P95 rebuild <50ms (sustained 60 sec @ 16 peers)
5. ✅ Integration smoke test passing
6. ✅ 0 regressions vs M41 baselines
7. ✅ Documentation complete (SUMMARY + STATUS_REPORT)

---

## Quick-Start Commands

```bash
# Clone the repo (already done)
cd project-isekai-v2/PROTOTYPE

# Install deps (if fresh)
npm install

# Run M41 baseline tests (verify M41 still working)
npm test -- M41

# Create M42 test files (scaffolding)
mkdir -p src/__tests__/epoch-sync
mkdir -p src/__tests__/trade-system
# ... etc

# Start Task 1: Epoch Sync
# → Create src/engine/epochSyncEngine.ts
# → Create src/__tests__/epoch-sync.test.ts
# → Run: npm test -- epoch-sync

# Start Task 2: Dice Altar (parallel with Task 1)
# → Create src/client/components/DiceAltarModal.tsx
# → Create src/engine/diceAltarEngine.ts
# → Run: npm test -- diceAltar

# When all tasks complete:
npm test -- M42                           # Run all M42 tests
./scripts/run-cluster-stress.sh           # Run stress test (Linux/macOS)
# or:
.\scripts\run-cluster-stress.ps1          # Run stress test (Windows)

# Generate final summary
node scripts/cluster-stress-report.ts > PROTOTYPE/artifacts/M42_CLUSTER_STRESS_REPORT.md

# Check build
npm run build                              # Verify TypeScript compilation
```

---

## FAQ

**Q: Can I start Task 2 before Task 1?**  
A: Yes! Task 2 (Dice Altar) is independent. Start both in parallel.

**Q: How long is the stress test?**  
A: 60 seconds of simulation (9,600 events from 16 peers @ 10 evt/sec).

**Q: Are phantoms real players or bots?**  
A: Ghost data from other active sessions. Anonymized + read-only. No interaction.

**Q: What if stress test fails P95 <50ms target?**  
A: Implement sharding (split 16 peers into 2 clusters) or optimize stateRebuilder hot paths.

**Q: Can I skip Task 6 (Tutorial) to save time?**  
A: No—it's a quick win (2–3 days) and ships content. Don't defer.

**Q: Does Task 7 (Phantoms) require backend changes?**  
A: Yes, small API endpoint `/api/sessions/active`. ~100 lines. No DB changes.

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| P2P Clock Skew breaks Epoch Sync | Implement offset tracking; test with simulated 50–100ms drift |
| Trade Duplication on Replay | Atomic mutation design; comprehensive idempotence tests |
| Memory Leaks @ 160 evt/sec | Enable V8 snapshots; profile before finalizing |
| Phantoms Spoil Solo Mystery | Ghosts are read-only + anonymized; can't trade or talk |
| Epoch Rollback Complexity | Limit to 1-step undo; store prior theme state only |
| Modal Stack (multiple open) | Use modal manager; enforce single active modal at a time |

---

## Post-M42: Next Horizon (M43+)

- **M43 — Advanced AI Behaviors:** Adaptive NPC personalities, dynamic quests
- **M44 — Community & Modding:** Shareable templates, cosmetic mods
- **M45 — Live Ops & Seasons:** Seasonal events, community voting
- **M46 — Optimization & Scale:** 32+ concurrent peers, WebWorker integration

---

## Contact & Status

- **M42 Owner:** [Assign person]
- **Status Channel:** [Slack / Teams room]
- **Daily Standup:** [Time]
- **Review Cadence:** Every 2 days (days 3, 5, 7, 9, 12, 15)

---

**Ready to start?** → Pick Task 1 or Task 2, open `M42_TASK_LIST.md`, and begin subtask 1.1 / 2.1.

Good luck! 🚀
