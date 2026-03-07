# Milestone 42 — Social Scaling & Epoch Immersion (Roadmap)

> **Status:** ACTIVE
> **Category:** ROADMAP
> **Updated:** February 16, 2026

---

> **Status:** READY-FOR-IMPLEMENTATION
> **Category:** ROADMAP
> **Updated:** February 16, 2026
> **Prior Milestone:** M41 (Beta Launch Readiness)

---

## 42.1 Milestone Objectives

With M41 establishing a solid Beta foundation (Director Mode, Onboarding, Telemetry, Performance validated, Epoch themes, Smoke tests), **M42** elevates the multiplayer experience from functional to immersive:

| Objective | Success Criterion | Owner |
|---|---|---|
| **Multiplayer Epoch Sync** | Epoch theme transitions sync across peers with <100ms latency | Task 1 |
| **Dice Altar Integration** | All critical actions (Crafting, Rituals, Combat) resolve through modal with transparent math | Task 2 |
| **Live Diagnostics** | Faction, consensus, and macro event graphs update in real-time in sidebar | Task 3 |
| **Atomic Trade Swaps** | P2P trades complete atomically; no mid-commit cancellations or duplication | Task 4 |
| **Cinematic State Transitions** | Heavy stateRebuilder ops masked by lore-compliant overlay with glitch effects | Task 5 |
| **Advanced Onboarding** | Tier 2 milestones ("Diplomat", "Weaver", "Director") automatically detected | Task 6 |
| **Player Echoes (Strands)** | Anonymized ghost players populate world; feel of 4-10+ concurrent peers | Task 7 |
| **Cluster Stress Test** | 16-peer simulation @ 10 evt/sec sustains <50ms rebuild latency | Task 8 |

---

## 42.2 Task Breakdown

### Task 1: Multiplayer Epoch Synchronization

**Goal:** Link epoch theme transitions to multiplayerEngine event stream. When any peer (Director, world event, or consensus) shifts epoch, all connected clients morph their theme simultaneously with <100ms clock skew.

**Dependencies:** M41 (epochThemeManager, epoch-theme.css), multiplayerEngine.ts (existing)

**Complexity:** Medium (3-4 days)

**Components to Create/Modify:**
1. `src/engine/epochSyncEngine.ts` (NEW, 250 lines)
   - `EpochSyncEvent` type for P2P epoch broadcasts
   - `broadcastEpochShift(epoch: 1|2|3, source: 'director'|'world'|'player')` → fires across multiplayerEngine
   - Clock sync compensation: store `clientClockOffset` to correct incoming timestamps
   - Rollback logic: if peer requests undo epoch shift, reset to prior theme state

2. `src/client/components/BetaApplication.tsx` (MODIFY)
   - Subscribe to `epochSyncEngine.onEpochShiftEvent`
   - Override existing `state.epochId` watcher to trigger sync broadcast
   - Add latency telemetry: measure time from broadcast to visual confirmation

3. `src/engine/multiplayerEngine.ts` (MODIFY)
   - Add `epochEventQueue: EpochSyncEvent[]` to `SessionRegistry`
   - Add epoch consensus method: `requestEpochConsensus(epoch, initiator)` → requires majority or unanimous approval
   - Store epoch change history: `epochHistory: { tick, epoch, source, consensus }[]`

**Tests:**
- `epoch-sync.test.ts`: Broadcast epoch shift to 4 simulated peers, verify all complete within 100ms
- `epoch-rollback.test.ts`: Shift epoch, request rollback, verify state consistency
- `epoch-consensus.test.ts`: 3 peers vote on epoch shift; verify tie-breaking logic

**Deliverable:** Synchronized 800ms theme morphing across all connected peers

---

### Task 2: Modal Integration — The Dice Altar

**Goal:** Create a reusable modal component for action resolution. All critical actions (Crafting, Rituals, Combat, social checks) pass through The Dice Altar, showing roll math, modifiers, and outcome deterministically.

**Dependencies:** M41 (Performance baselines), actionPipeline.ts (existing)

**Complexity:** Medium-High (4-5 days)

**Components to Create/Modify:**

1. `src/client/components/DiceAltarModal.tsx` (CREATE, 380 lines)
   - Modal structure: title (action type), roll formula, modifiers breakdown, D20 animation, outcome
   - States: `rolling` | `showing_math` | `resolved` | `animating_outcome`
   - Modifier sources: equipment (+1), status (+2), opposition (-2), environmental (-1)
   - D20 animation: 60-frame spin, 500ms slow-down to final value (sounds: sfx-roll.mp3)
   - Outcome display: Pass/Fail/Critical/Fumble with flavor text
   - "Confirm" button to apply outcome; "Request Reroll" (limited to 1 per action, requires Director approval)

2. `src/client/components/CraftingModal.tsx` (CREATE, 280 lines)
   - Crafting workflow: Select recipe → confirm ingredients → Roll check → Dice Altar integration
   - On success: item created, inventory updated, mutation log recorded
   - On failure: ingredients consumed anyway (risk/reward), outcome message
   - Link to `/recipes` for recipe reference

3. `src/client/components/RitualModal.tsx` (CREATE, 320 lines)
   - Ritual workflow: Select ritual → choose participants (NPC + player) → Roll check
   - Ritual modifiers based on belief alignment, location sanctity, ingredient rarity
   - Multiple outcomes: Minor success (1 effect), Major success (2 effects), Failure (backlash)

4. `src/engine/diceAltarEngine.ts` (CREATE, 200 lines)
   - `resolveDiceRoll(action, modifiers) → RollResult`
   - D20 system: base 1d20 + modifier, compare to DC (difficulty class)
   - Critical success/fumble: 20 → auto-success, 1 → auto-fail (regardless of modifiers)
   - Store results in mutationLog for replay audit

5. `src/client/components/BetaApplication.tsx` (MODIFY)
   - Route all actionPipeline dispatches through DiceAltarModal
   - State: `pendingDiceAction: Action | null`, `diceResult: RollResult | null`
   - Handlers: `handleActionStart`, `handleRollComplete`, `handleOutcomeApply`

**Tests:**
- `diceAltar.test.ts`: Verify D20 math, modifier stacking, critical/fumble logic
- `crafting-integration.test.ts`: Craft item → DiceAltar → confirm inventory update
- `ritual-integration.test.ts`: Perform ritual with 2 participants, verify both mutationLog entries

**Deliverable:** Functional Dice Altar modal with 3 integration points (Crafting, Ritual, Combat)

---

### Task 3: Live Diagnostic Feeds

**Goal:** Replace static UI stubs in BetaSidebar with real-time graphs/feeds:
- **Faction Diagnostics**: Bar chart of all faction power levels, updating per tick
- **Consensus Diagnostics**: P2P network health (latency histogram, peer count, proposal queue depth)
- **Macro Event Diagnostics**: Countdown timer to next impending world events

**Dependencies:** worldEngine.ts, multiplayerEngine.ts (existing), stateRebuilder.ts (for tick sync)

**Complexity:** Medium (3-4 days)

**Components to Create/Modify:**

1. `src/client/components/DiagnosticPanel.tsx` (CREATE, 400 lines)
   - 3 tabs: Faction | Consensus | Macro Events
   - Tab 1 — Faction Power:
     - Stacked bar chart (CSS Grid or Canvas for minimal deps)
     - Power sources: military, political, economic, spiritual
     - Color-coded per faction (stored in epoch-theme.css)
     - Update triggers: on mutationLog changes to faction state
   - Tab 2 — Consensus Health:
     - Latency graph (50-point rolling window, ms scale)
     - Peer count + activity indicator (green/yellow/red)
     - Proposal queue depth counter
     - Clock drift indicator (±100ms threshold)
   - Tab 3 — Macro Events:
     - List of pending events with ETA (in ticks, converted to "3 minutes remaining")
     - Event icons + flavor text
     - Click to preview event details

2. `src/client/components/BetaSidebar.tsx` (MODIFY)
   - Replace stubs with `<DiagnosticPanel />`
   - Add "Expand" button to hide/show diagnostics
   - Pass state + diagnostics data as props

3. `src/engine/diagnosticsEngine.ts` (CREATE, 180 lines)
   - `getFactionPower(state): FactionPowerData[]`
   - `getConsensusHealth(registry): ConsensusHealthData` (latency, peer count, queue)
   - `getMacroEventCountdowns(state): MacroEventData[]`
   - Export types for component integration

**Tests:**
- `diagnostics.test.ts`: Update faction power, verify graph data structure
- `consensus-telemetry.test.ts`: Simulate P2P latency spikes, verify graph responds

**Deliverable:** Live diagnostic feeds updating in real-time on sidebar

---

### Task 4: P2P Trade & Atomic Swaps

**Goal:** Finalize the `TradeOverlay` component. Implement full 4-stage trade flow (Propose → Negotiate → Lock → Commit). Ensure `mutationLog` records swap as single atomic event to prevent duplication on replay.

**Dependencies:** multiplayerEngine.ts (TradeState interface), mutationLog.ts (existing)

**Complexity:** High (5-6 days) — atomic commit is non-trivial

**Components to Create/Modify:**

1. `src/client/components/TradeOverlay.tsx` (CREATE, 420 lines)
   - Overlay structure: "Trade with [Peer Name]" title, 2-column layout (your items | their items)
   - Stage progression UI:
     - **Proposed**: Show peer's request, "Accept" / "Decline" buttons
     - **Offered**: Both sides can add/remove items before confirming. Estimated value shown (placeholder).
     - **Committed**: Button-disabled, waiting for peer to confirm
     - **Completed**: Summary screen, timestamp logged
   - Item selection: Click to add from inventory to trade panel
   - Item details: Hover popover (rarity, enchantments)

2. `src/engine/atomicTradeEngine.ts` (CREATE, 280 lines)
   - `proposeTrade(initiator, responder, items) → TradeId`
   - `confirmTrade(tradeId, side): Promise<TradeResult>`
   - **Atomic Commit Logic:**
     - Both peers set `committed=true` independently
     - When both true: single `ATOMIC_TRADE` mutation fired
     - Mutation includes: both inventories, participants, items, timestamp
     - On replay: `ATOMIC_TRADE` applied once (idempotent)
     - Concurrency: if one side rejects mid-commit, entire trade marked cancelled (rollback both inventories)

3. `src/client/components/BetaApplication.tsx` (MODIFY)
   - Mount `<TradeOverlay>` conditional on `activeTrade !== null`
   - Handlers: `handleTradePropose`, `handleTradeConfirm`, `handleTradeCancel`
   - Pass multiplayerEngine reference for P2P sync

4. `src/engine/multiplayerEngine.ts` (MODIFY)
   - Add `processTradeEvent(event): void` to handle incoming trade messages
   - Add trade validation: check inventory availability before commit
   - Add trade history: `completedTrades: TradeRecord[]`

5. `tests/mutation-idempotence.test.ts` (CREATE, 150 lines)
   - Test: perform trade, serialize world, replay mutations → verify inventory state identical
   - Test: two concurrent trade proposals → verify only one succeeds (first-to-commit wins)

**Tests:**
- `trade-proposal.test.ts`: Initiate trade, verify peer receives notification
- `atomic-commit.test.ts`: Both peers confirm trade simultaneously; verify single mutation recorded
- `trade-cancel.test.ts`: Peer rejects mid-commit; verify inventories unchanged
- `trade-replay.test.ts`: Perform trade, save/load world, verify trade replayed exactly once

**Deliverable:** Fully functional P2P trade system with atomic commit guarantee

---

### Task 5: Cinematic Epoch Transitions

**Goal:** Create a `WorldStateTransition` overlay. During heavy `stateRebuilder` operations (like Paradox resets or major world mutations), display a lore-compliant cinematic screen that masks background updates with "Lore static" and glitch effects.

**Dependencies:** stateRebuilder.ts (existing), epoch-theme.css (for styling)

**Complexity:** Medium (3-4 days)

**Components to Create/Modify:**

1. `src/client/components/WorldStateTransitionOverlay.tsx` (CREATE, 360 lines)
   - Full-screen modal overlay with:
     - Background: Animated glitch effect (CSS @keyframes) with lore text fragments (quotes from Chronicles)
     - Center: "Reality Shifting..." spinner with ETA countdown (based on rebuild time estimate)
     - Lore text layers: Semi-transparent text overlays showing philosophical quotes, cryptic warnings
     - Sound: ambient horror/mystical tone (optional mp3 background)
   - Triggers on: `stateRebuilder.startRebuild()` (broadcasts event)
   - Auto-dismisses when: `stateRebuilder.finishRebuild()` (broadcasts completion)
   - Duration shown realistically (from performance.stateRebuilder.test.ts baseline)

2. `src/engine/transitionEngine.ts` (CREATE, 200 lines)
   - `startWorldTransition(reason: 'paradox'|'epoch_shift'|'world_reset'): void`
   - `finishWorldTransition(): void`
   - Event subscription system for overlay to listen
   - Stores transition metadata: reason, start tick, end tick

3. `src/client/components/BetaApplication.tsx` (MODIFY)
   - Mount `<WorldStateTransitionOverlay>` at root level (above all other UI)
   - Subscribe to `transitionEngine` events
   - State: `isTransitioning: boolean`, `transitionReason: string`

4. `src/engine/stateRebuilder.ts` (MODIFY)
   - Before rebuild: emit `TRANSITION_START` event
   - After rebuild: emit `TRANSITION_END` event
   - Rebuild time estimate based on mutation count (from Task 4 perf baseline)

**Tests:**
- `transition-overlay.test.ts`: Render overlay, verify lore text loads, countdown works
- `transition-timing.test.ts`: 10K mutation rebuild, overlay duration matches baseline ±20%

**Deliverable:** Seamless cinematic cover for stateRebuilder operations

---

### Task 6: Advanced Tutorial Tier (Tier 2)

**Goal:** Extend `tutorialEngine.ts` with 3 new Tier 2 milestones: "The Diplomat", "The Weaver", "The Director". Auto-detect each based on player actions.

**Dependencies:** M41 (tutorialEngine.ts), multiplayerEngine.ts (faction rep), actionPipeline.ts (rituals)

**Complexity:** Low-Medium (2-3 days)

**Components to Create/Modify:**

1. `src/engine/tutorialEngine.ts` (MODIFY)
   - Add 3 new milestones to `MilestoneType`:
     - `'diplomat_tier_2'`: Gain reputation with 1 faction to 50+ (detect: `faction.reputation > 50`)
     - `'weaver_tier_2'`: Complete multi-ingredient ritual successfully (detect: ritual with 3+ ingredients succeeds)
     - `'director_tier_2'`: Open CoDmDashboard (Director Mode) for first time (detect: `isDirector = true` state)
   - Add tier progression: T1 milestones → T2 unlock auto-detect
   - Extend lore database: 3 new Chronicle quotes for T2 milestones

2. `src/client/components/TutorialOverlay.tsx` (MODIFY, if needed)
   - If new overlay style: add indicator showing "Tier 2 Milestone" for visual distinction

**Tests:**
- `tutorial-diplomat.test.ts`: Build faction reputation to 50, verify milestone triggered
- `tutorial-weaver.test.ts`: Cast 3-ingredient ritual, verify success milestone triggered
- `tutorial-director.test.ts`: Toggle Director Mode, verify milestone triggered
- `tutorial-tier-progression.test.ts`: Complete T1, verify T2 milestones become detectable

**Deliverable:** 3 new auto-detected advanced milestones

---

### Task 7: "Strand Phantoms" — Player Echoes

**Goal:** Enable persistent "Player Echoes" in `worldEngine.ts`. Fetch anonymized ghost data from other active sessions, so the world feels populated by 4–10+ concurrent peers even in solo play.

**Dependencies:** worldEngine.ts, multiplayerEngine.ts (session registry), persistence service (implied)

**Complexity:** Medium-High (4-5 days) — requires persistence layer

**Components to Create/Modify:**

1. `src/engine/phantomEngine.ts` (CREATE, 300 lines)
   - `GhostPlayer` type: anonymized player data
     - `id, name (anonymized), location, lastActionTick, action, visibleItems`
   - `trackGhostPresence(currentWorldId, maxDistance): Promise<GhostPlayer[]>`
     - Queries other active sessions in same world
     - Filters: only players within visual range (same region or adjacent)
     - Returns anonymized copy (no PII, no real player names—use procedural names: "Wanderer-7382")
   - `updateGhostActions(ghosts, tick): void`
     - Replay ghost actions to create illusion of movement/interaction
     - Ghosts persist for 10 real minutes then fade (they leave the location)

2. `src/engine/worldEngine.ts` (MODIFY)
   - Add `phantoms: GhostPlayer[]` to `WorldState`
   - On tick: call `phantomEngine.trackGhostPresence()` and update phantoms
   - Render ghosts as NPCs in world view (slightly translucent, labeled as "Echo" or "Phantom")
   - Ghosts are read-only: no interaction, no trade (they're ephemeral)

3. `src/client/components/WorldView.tsx` (MODIFY, if exists)
   - Render phantom players with distinct visual treatment (fade, slight glow, label "Echo")
   - Tooltip on hover showing action (e.g., "Echo is weaving a ritual")

4. `src/pages/api/sessions/active.ts` (CREATE, 100 lines)
   - API endpoint: `GET /api/sessions/active?worldId=world-123&skip=clientId&limit=10`
   - Returns anonymized ghost data for all active sessions in world

**Tests:**
- `phantom-engine.test.ts`: Track ghosts, verify anonymization, distance filtering
- `phantom-render.test.ts`: Render 10 ghosts, verify visual treatment distinct from NPCs
- `phantom-fade.test.ts`: Ghosts present for 10min, verify fadeout at 11min

**Deliverable:** Populated world feel with 4–10+ visible echo players

---

### Task 8: Multiplayer Cluster Stress Test

**Goal:** Run a headless simulation of 16 concurrent peers, each emitting 10 events/sec, for 60 seconds. Measure `stateRebuilder` rebuild latency and verify P2P consensus remains stable under load. Generate performance report.

**Dependencies:** All M42 tasks (esp. Tasks 1, 4, 7), performance-baseline.ts from M41

**Complexity:** Medium (3-4 days)

**Components to Create/Modify:**

1. `scripts/cluster-stress-test.ts` (CREATE, 400 lines)
   - Headless Node.js simulation (no UI)
   - Creates 16 `WorldState` instances + `SessionRegistry`
   - Event generator: Mix of TICK (40%), MOVE (20%), TRADE (10%), RITUAL (10%), EPOCH_SYNC (10%), other (10%)
   - Emission rate: 10 evt/sec per peer = 160 evt/sec cluster-wide
   - Duration: 60 seconds = 9,600 total events
   - Metrics collected:
     - Rebuild latency histogram (ms, p50/p95/p99)
     - Consensus sync time (time for all peers to reach same state)
     - Conflict resolution count (ties, rejections)
     - Memory growth (baseline → peak → stabilized)
     - GC pauses (if --expose-gc enabled)
   - Success criteria:
     - P95 rebuild latency < 50ms
     - Consensus sync < 200ms p99
     - Zero memory leaks (stable after GC)
     - All events replayed identically (audit trail)

2. `scripts/cluster-stress-report.ts` (CREATE, 150 lines)
   - Formats stress test results into markdown report
   - Includes: summary table, histogram graphs (ASCII), recommendations
   - Output: `ALPHA/artifacts/M42_CLUSTER_STRESS_REPORT.md`

3. `src/__tests__/cluster-stress-test.integration.test.ts` (CREATE, 250 lines)
   - Jest wrapper around cluster-stress-test.ts (calls script, parses output)
   - Jest assertions on success criteria
   - Runs as part of CI/CD pipeline

**Tests:**
- `cluster-stress-run.sh` / `.ps1`: Execute for human review

**Deliverable:** Stress test results; confirmation that cluster remains stable under load

---

## 42.3 Implementation Priority & Sequencing

**Recommended order (respecting dependencies):**

1. **Task 1** (Epoch Sync) — Foundation for all subsequent sync tasks
2. **Task 2** (Dice Altar) — Highest UI polish; can be done in parallel with 1
3. **Task 3** (Diagnostics) — Low risk; UI-only; can start once 1/2 underway
4. **Task 6** (Tier 2 Tutorial) — Quickest win; low complexity; boosts UX
5. **Task 4** (Atomic Trades) — High complexity; do after 1 is stable
6. **Task 5** (Cinematic Transitions) — Depends on stateRebuilder telemetry from Task 8
7. **Task 7** (Phantoms) — Requires persistence layer; can prep while other tasks finish
8. **Task 8** (Stress Test) — Last; validates all prior work

**Team assignment (if multi-team):**
- **A** → Tasks 1, 3, 5 (Engine/Backend-heavy)
- **B** → Tasks 2, 6 (UI/Components-heavy)
- **C** → Tasks 4, 7, 8 (Integration-heavy, requires both A + B)

---

## 42.4 Success Metrics & Verification

| Metric | Target | Owner |
|---|---|---|
| **Epoch Sync Latency** | <100ms p95 across 4 peers | Task 1 test |
| **Dice Altar Coverage** | 100% of critical actions route through modal | Task 2 integration test |
| **Diagnostic Responsiveness** | UI updates <50ms after state mutation | Task 3 telemetry |
| **Trade Atomicity** | 0 duplication bugs; 100% audit trail | Task 4 replay test |
| **Transition Cinematic UX** | Overlay displays for 100% of stateRebuilder ops | Task 5 smoke test |
| **Tutorial Tier 2 Detection** | All 3 milestones auto-detect within 1 tick | Task 6 unit test |
| **Phantom Population** | 4–10 echoes visible per location (avg) | Task 7 integration test |
| **Cluster Stress Stability** | P95 rebuild <50ms @ 10 evt/sec/peer | Task 8 perf test |

---

## 42.5 Risk Mitigation

| Risk | Mitigation |
|---|---|
| **P2P Clock Skew** | Implement clock sync compensation; test with simulated drift | Task 1 |
| **Trade Duplication on Replay** | Atomic mutation design; comprehensive idempotence tests | Task 4 |
| **Memory Leaks under Cluster Load** | Enable V8 snapshots; profile before finalizing | Task 8 |
| **Phantoms Spoiling Solo Mystery** | NPCs remain hostile to echoes; ghosts cannot be interacted with | Task 7 |
| **Epoch Sync Rollback Complexity** | Store epoch history; allow 1-step rollback only (not arbitrary undo) | Task 1 |

---

## 42.6 Deliverables Checklist

- [ ] Task 1: `epochSyncEngine.ts` + M41 integration + tests
- [ ] Task 2: `DiceAltarModal.tsx`, `CraftingModal.tsx`, `RitualModal.tsx`, `diceAltarEngine.ts` + tests
- [ ] Task 3: `DiagnosticPanel.tsx`, `diagnosticsEngine.ts` + BetaSidebar integration + tests
- [ ] Task 4: `TradeOverlay.tsx`, `atomicTradeEngine.ts`, idempotence tests
- [ ] Task 5: `WorldStateTransitionOverlay.tsx`, `transitionEngine.ts` + stateRebuilder integration
- [ ] Task 6: Enhanced `tutorialEngine.ts` with Tier 2 milestones + tests
- [ ] Task 7: `phantomEngine.ts`, `/api/sessions/active.ts`, ghost rendering + tests
- [ ] Task 8: `cluster-stress-test.ts`, `cluster-stress-report.ts`, stress test results
- [ ] **Master Docs**: `M42_COMPLETE_SUMMARY.md`, `M42_STATUS_REPORT.txt` (post-completion)
- [ ] **Verification**: All tests passing, 0 regressions vs M41 baseline

---

## 42.7 Success Criteria (Gate)

**M42 is complete when:**

1. ✅ All 8 tasks implemented + integrated
2. ✅ 0 TypeScript compilation errors
3. ✅ All task-specific test suites passing
4. ✅ Cluster stress test sustains <50ms p95 rebuild latency
5. ✅ Integration smoke test passes (combined system test)
6. ✅ 0 regressions vs M41 baselines (performance, UX, reliability)

---

## 42.8 Post-Delivery: Next Horizon (M43+)

With M42 delivering immersive multiplayer and a truly populated world, future work shifts to:

- **M43 — Advanced AI Behaviors**: Adaptive NPC personalities, dynamic quests from player actions
- **M44 — Community & Modding**: Shareable world templates, blueprints, cosmetic mods
- **M45 — Live Ops & Seasons**: Seasonal events, limited-time quests, community voting
- **M46 — Optimization & Scale**: Support 32+ concurrent peers, integrate WebWorker for event processing

---

**Next Step:** Proceed to `M42_TASK_LIST.md` for detailed sprint breakdown and subtask assignments.
