# M42 Milestone Task List — Sprint-Ready Implementation

> **Status:** ACTIVE
> **Category:** ROADMAP
> **Updated:** February 16, 2026

---

> **Target:** All 8 tasks complete, 0 TypeScript errors, 100% test coverage  
> **Duration:** Est. 16-18 days (2.5-3 weeks)  
> **Reference:** `plans/42_ROADMAP.md`

---

## Task 1: Multiplayer Epoch Synchronization

### Objective
Link epoch theme transitions to `multiplayerEngine` so all connected peers morph their theme simultaneously with <100ms latency skew.

### Subtasks

#### 1.1 Create epochSyncEngine.ts (250 lines)
- [ ] Define `EpochSyncEvent` type:
  ```ts
  interface EpochSyncEvent {
    eventId: string;
    timestamp: number;           // Sender's clock
    targetEpoch: 1 | 2 | 3;
    source: 'director' | 'world_event' | 'player_consensus';
    initiatorClientId: string;
    clockOffset?: number;        // For sync compensation
  }
  ```
- [ ] Implement `broadcastEpochShift(epoch, source)` → fires event to all peers
- [ ] Implement `subscribeToEpochShifts(callback)` → for BetaApplication listener
- [ ] Implement clock offset tracking: `recordPeerClockDrift(clientId, drift)` and `getClockOffset(clientId)`
- [ ] Implement rollback: `undoEpochShift()` → returns to prior epoch + theme
- [ ] Implement epoch history: `epochHistory: { tick, epoch, source, consensus }[]`

#### 1.2 Modify multiplayerEngine.ts (SessionRegistry)
- [ ] Add `epochEventQueue: EpochSyncEvent[]` to SessionRegistry
- [ ] Add `epochConsensus(targetEpoch, initiator, votes)` method
  - [ ] Consensus rules: 'any' = initiator wins, 'majority' = 50%+1, 'unanimous' = all agree
  - [ ] Return: `{ approved: boolean, reason: string }`
- [ ] Add `epochHistory: EpochRecord[]` storage
- [ ] Add epoch validation: block invalid epoch values (must be 1, 2, or 3)

#### 1.3 Modify BetaApplication.tsx
- [ ] Import `epochSyncEngine` and subscribe to `onEpochShiftEvent`
- [ ] Add handler: `handleRemoteEpochShift = (event) => { themeManager.applyTheme(...) }`
- [ ] Add broadcast on local epoch change: if `state.epochId` changes, call `broadcastEpochShift`
- [ ] Add telemetry: measure time from broadcast to visual confirmation
- [ ] Add UI indicator: "Waiting for peers to sync..." if clock skew detected

#### 1.4 Create epoch-sync.test.ts
- [ ] Test: Create registry with 4 peers
- [ ] Test: Shift epoch on peer 0 → broadcast → all 4 receive within 100ms
- [ ] Test: Simultaneous epoch shifts (2 peers propose different epochs) → consensus tie-break
- [ ] Test: Clock offset compensation (simulate 50ms drift) → verify sync still <100ms
- [ ] Test: Rollback epoch from 2→1 → verify all peers revert

#### 1.5 Create epoch-rollback.test.ts
- [ ] Test: Shift epoch 1→2, request rollback, verify all peers return to 1
- [ ] Test: Verify no lingering theme state artifacts after rollback

#### 1.6 Create epoch-consensus.test.ts
- [ ] Test: 3 peers vote on epoch 2 (2 yes, 1 no) with majority rule → approved
- [ ] Test: Unanimous rule with 1 dissent → rejected
- [ ] Test: Single initiator (any rule) → auto-approved

### Deliverable
- ✅ epochSyncEngine.ts with event broadcasting and clock compensation
- ✅ SessionRegistry extended with epoch consensus & history
- ✅ BetaApplication listening and broadcasting epoch changes
- ✅ 3 test suites (30+ assertions total)
- ✅ <100ms latency validation

---

## Task 2: Modal Integration — The Dice Altar

### Objective
Create a reusable modal component for action resolution. All critical actions (Crafting, Rituals, Combat) resolve through The Dice Altar with transparent math display.

### Subtasks

#### 2.1 Create DiceAltarModal.tsx (380 lines)
- [ ] Component structure:
  - [ ] Header: action type icon + title (e.g., "Craft Longsword")
  - [ ] Roll formula display: "1d20 + 3 (equipment) - 1 (fatigue) = ??"
  - [ ] Modifiers breakdown table:
    - [ ] Source | Bonus | Icon
    - [ ] "Equipment" | +1 | 🛡️
    - [ ] "Status: Focused" | +2 | ✨
    - [ ] "Opposition" | -2 | 🚫
    - [ ] "Weather" | -1 | 🌧️
  - [ ] D20 animation area (500ms spin, slow-down effect)
  - [ ] Outcome display: "Pass" / "Fail" / "Critical" / "Fumble"
  - [ ] Action buttons: "Confirm Outcome" | "Request Reroll" (if Director available)
- [ ] States: `rolling | showing_math | resolved | animating_outcome`
- [ ] Styling: Centered modal, semi-transparent backdrop, epoch-theme color scheme
- [ ] Sound integration (sfx-roll.mp3 placeholder; can add later)

#### 2.2 Create CraftingModal.tsx (280 lines)
- [ ] Workflow:
  1. [ ] "Select Recipe" phase → dropdown of known recipes
  2. [ ] "Confirm Ingredients" phase → show required items, check inventory
  3. [ ] "Roll Check" phase → call diceAltarEngine with crafting DC (difficulty)
  4. [ ] "Outcome" phase → show result (success/failure) + flavor text
- [ ] On success:
  - [ ] Create item in inventory
  - [ ] Record mutation: `{ type: 'CRAFT_ITEM', item, ingredients }`
  - [ ] Close modal
- [ ] On failure:
  - [ ] Consume ingredients anyway (risk/reward)
  - [ ] Record mutation: `{ type: 'CRAFT_FAILED', recipe, ingredients }`
  - [ ] Show "Attempt failed—ingredients were lost" message

#### 2.3 Create RitualModal.tsx (320 lines)
- [ ] Workflow:
  1. [ ] "Select Ritual" → modal list of known rituals
  2. [ ] "Choose Participants" → NPC selector (must be nearby)
  3. [ ] "Roll Check" → diceAltarEngine with ritual-specific modifiers
  4. [ ] "Outcome" → display effects (Minor/Major/Backlash)
- [ ] Ritual modifiers:
  - [ ] +3 if location is sanctified (faction temple)
  - [ ] +1 per ingredient rarity (rare vs common)
  - [ ] -2 if belief misaligned with ritual goal
  - [ ] -1 per distracting NPC nearby (not participant)
- [ ] Outcome effects:
  - [ ] Minor (DC met): 1 small effect (e.g., +1 faction rep)
  - [ ] Major (DC+5 met): 2 effects (rep + item)
  - [ ] Backlash (fumble): -2 faction rep + self-damage (1-5 HP)

#### 2.4 Create diceAltarEngine.ts (200 lines)
- [ ] D20 system implementation:
  - [ ] `resolveDiceRoll(action, modifiers, dc) → RollResult`
  - [ ] Roll 1d20 (1–20 uniform random) + sum modifiers
  - [ ] Compare to DC. Results: pass if >= DC, fail if < DC
  - [ ] Crit on 20 (auto-pass), fumble on 1 (auto-fail)
- [ ] Modifier type validation:
  - [ ] Only accept known modifier sources (equipment, status, opposition, environment, ritual_bonus)
  - [ ] Clamp total modifiers to [-5, +5] to avoid degenerate states
- [ ] Result storage:
  - [ ] Record each roll to mutationLog (for replay audit)
  - [ ] Format: `{ type: 'DICE_ROLL', action, roll, modifiers, dc, result, timestamp }`

#### 2.5 Modify BetaApplication.tsx
- [ ] State: `pendingDiceAction: Action | null`, `diceResult: RollResult | null`
- [ ] Router: All actionPipeline dispatches check DiceAltar modal state
- [ ] Handlers:
  - [ ] `handleActionStart = (action) => { setPendingDiceAction(action); }`
  - [ ] `handleRollComplete = (result) => { setDiceResult(result); }`
  - [ ] `handleOutcomeApply = () => { applyMutation(result); closeDiceAltar(); }`
- [ ] Mount DiceAltarModal conditionally

#### 2.6 Create diceAltar.test.ts (240 lines)
- [ ] Test: Base D20 roll with 0 mod → range 1–20
- [ ] Test: Roll with +3 mod → range 4–23
- [ ] Test: Roll 1d20 meets DC 15 → pass
- [ ] Test: Roll 1d20 below DC 15 → fail
- [ ] Test: Roll 20 (any mod) → always pass
- [ ] Test: Roll 1 (any mod) → always fail
- [ ] Test: Modifier clamping (stack +10 mods) → clamp to +5
- [ ] Test: Mutation log records roll atomically

#### 2.7 Create crafting-integration.test.ts (200 lines)
- [ ] Test: Start crafting Long Sword (requires: Iron x2, Wood x1)
- [ ] Test: Confirm ingredients (deduct from inventory)
- [ ] Test: Roll check passes (DC 12, roll 15) → item created
- [ ] Test: Roll check fails (DC 12, roll 8) → item not created, ingredients consumed
- [ ] Test: Verify inventory mutation applied

#### 2.8 Create ritual-integration.test.ts (220 lines)
- [ ] Test: Select ritual "Blessing of Strength"
- [ ] Test: Choose 2 participants (player + nearby NPC)
- [ ] Test: Roll check → calculate modifiers (location +1, nearby NPCs -1, etc.)
- [ ] Test: Minor success → apply 1 effect
- [ ] Test: Major success → apply 2 effects
- [ ] Test: Backlash → apply negative effects
- [ ] Test: Verify both player and NPC mutations recorded

### Deliverable
- ✅ DiceAltarModal.tsx (D20 animation, formula display, outcome)
- ✅ CraftingModal.tsx + RitualModal.tsx (workflow modals)
- ✅ diceAltarEngine.ts (D20 math, modifiers, crit/fumble)
- ✅ 3 component tests + 3 integration tests
- ✅ BetaApplication routing all actions through Dice Altar

---

## Task 3: Live Diagnostic Feeds

### Objective
Replace static UI stubs with real-time faction power, consensus health, and macro event countdowns.

### Subtasks

#### 3.1 Create diagnosticsEngine.ts (180 lines)
- [ ] `getFactionPower(state: WorldState): FactionPowerData[]`
  - [ ] Return array: `{ factionId, name, power, breakdown: { military, political, economic, spiritual } }`
  - [ ] Update on: any faction mutation
- [ ] `getConsensusHealth(registry: SessionRegistry): ConsensusHealthData`
  - [ ] Return: `{ avgLatency, p95Latency, peerCount, activePlayerCount, proposalQueueDepth, clockDrift }`
- [ ] `getMacroEventCountdowns(state: WorldState): MacroEventData[]`
  - [ ] Return array of impending events with ETA in ticks

#### 3.2 Create DiagnosticPanel.tsx (400 lines)
- [ ] Tab 1 — Faction Power:
  - [ ] Stacked horizontal bar chart (CSS Grid)
  - [ ] Each faction is a segment, color from epoch-theme.css
  - [ ] Hover tooltip: name + power breakdown
  - [ ] Update triggers: on `state` changes containing faction mutations
- [ ] Tab 2 — Consensus Health:
  - [ ] Latency graph: 50-point rolling window (500px width, 100px height)
  - [ ] X-axis: time (last 50 ticks), Y-axis: ms (0–500)
  - [ ] Peer count counter + indicator (green <100ms, yellow 100–200ms, red >200ms)
  - [ ] Proposal queue depth: simple number display
  - [ ] Clock drift: ±100ms threshold indicator
  - [ ] Canvas-based for minimal deps (or ASCII if Canvas unavailable)
- [ ] Tab 3 — Macro Events:
  - [ ] Table: Event Icon | Name | ETA (in human-readable format: "3m 45s remaining")
  - [ ] Sortable by ETA (nearest first)
  - [ ] Click row to expand details (icon, description, preconditions met?)

#### 3.3 Modify BetaSidebar.tsx
- [ ] Remove or hide old stubs (factionDiagnostics, consensusDiagnostics, macroEventDiagnostics)
- [ ] Mount `<DiagnosticPanel state={state} registry={registry} />`
- [ ] Add "Expand/Collapse" button to toggle diagnostics visibility
- [ ] Pass required props: state, SessionRegistry (from controller)

#### 3.4 Create diagnostic-panel.test.ts (180 lines)
- [ ] Test: Render panel with mock faction data → verify bar chart renders
- [ ] Test: Update faction power → verify bar updates
- [ ] Test: Render latency graph with 10 data points → verify curve renders
- [ ] Test: Macro event countdown → verify ETA format correct (minutes:seconds)

#### 3.5 Create consensus-telemetry.test.ts (160 lines)
- [ ] Test: Simulate P2P latency spike (normal 20ms → 150ms) → graph updates
- [ ] Test: Drop peer from session → peer count decreases
- [ ] Test: Queue proposal → queue depth counter increments

### Deliverable
- ✅ diagnosticsEngine.ts with 3 data extraction functions
- ✅ DiagnosticPanel.tsx with 3 tabs (Faction, Consensus, Macro Events)
- ✅ BetaSidebar integration
- ✅ 2 test suites (20+ assertions)

---

## Task 4: P2P Trade & Atomic Swaps

### Objective
Finalize TradeOverlay with full 4-stage flow (Propose → Negotiate → Lock → Commit). Ensure mutations recorded atomically.

### Subtasks

#### 4.1 Create TradeOverlay.tsx (420 lines)
- [ ] Component structure:
  - [ ] Header: "Trade with [Peer Name]" + close button
  - [ ] 2-column layout (Your Items | Their Items)
  - [ ] Stage indicator: "Proposed" | "Offered" | "Committed" | "Completed"
  - [ ] Item panels: scrollable list of items in each side
  - [ ] Item card: icon, name, quantity, rarity color, click to add/remove
  - [ ] Estimated value display (placeholder; can integrate pricing later)
  - [ ] Action buttons (stage-specific):
    - [ ] Proposed: "Accept" | "Decline"
    - [ ] Offered: "Add Item" | "Remove Item" | "Confirm"
    - [ ] Committed: Disabled buttons, "Waiting for peer..."
    - [ ] Completed: "Done" button to close, summary of swapped items
- [ ] Styling: Modal overlay, 50% scene brightness behind (backdrop-filter: blur)

#### 4.2 Create atomicTradeEngine.ts (280 lines)
- [ ] `proposeTrade(initiator, responder, initiatorItems): TradeId`
  - [ ] Create TradeState in 'proposed' stage
  - [ ] Send P2P event to responder
- [ ] `confirmTrade(tradeId, side): Promise<TradeResult>`
  - [ ] Set side's `confirmed = true`
  - [ ] If both sides confirmed: emit atomic mutation
  - [ ] Mutation: `{ type: 'ATOMIC_TRADE', initiator, responder, items_a, items_b, timestamp }`
  - [ ] Idempotent: applying same mutation twice = no-op (prevents duplication)
- [ ] `cancelTrade(tradeId, reason): void`
  - [ ] Mark trade as cancelled
  - [ ] Send cancellation event to peer
  - [ ] If mid-commit: rollback both inventories
- [ ] Trade history: `completedTrades: TradeRecord[]`

#### 4.3 Modify multiplayerEngine.ts
- [ ] Add `processTradeEvent(event): TradeAction`
  - [ ] Validate event source (must be known peer)
  - [ ] Route to atomicTradeEngine
- [ ] Add trade validation:
  - [ ] Check initiator.inventory has items before propose
  - [ ] Check responder.inventory has items before confirm
  - [ ] Prevent duplicate trades (no 2 trades between same peers in <5 sec)
- [ ] Add conflict resolution: if both peers initiate trade simultaneously → first-to-propose wins

#### 4.4 Modify BetaApplication.tsx
- [ ] State: `activeTrade: TradeState | null`
- [ ] Handlers:
  - [ ] `handleTradePropose = (peer, items) => { atomicTradeEngine.proposeTrade(...) }`
  - [ ] `handleTradeConfirm = () => { await atomicTradeEngine.confirmTrade(...); }`
  - [ ] `handleTradeCancel = () => { atomicTradeEngine.cancelTrade(...); }`
- [ ] Mount TradeOverlay conditional

#### 4.5 Create mutation-idempotence.test.ts (150 lines)
- [ ] Test: Propose trade → confirm both sides → 1 ATOMIC_TRADE mutation
- [ ] Test: Replay mutations from save → trade replayed exactly once
- [ ] Test: Two consecutive trades → verify both recorded (no merging)
- [ ] Test: Trade → save → load → trade gone (not replayed twice)

#### 4.6 Create trade-proposal.test.ts (140 lines)
- [ ] Test: Peer A proposes to B → B receives notification
- [ ] Test: B accepts → state transitions to 'offered'
- [ ] Test: A adds item → negotiation allowed
- [ ] Test: B declines → trade transitions to 'cancelled'

#### 4.7 Create atomic-commit.test.ts (180 lines)
- [ ] Test: Both peers confirm simultaneously → single ATOMIC_TRADE mutation
- [ ] Test: Mutation idempotent (apply 2x) → same final state
- [ ] Test: Concurrent modifications mid-commit (A removes item) → trade fails, inventories unchanged

#### 4.8 Create trade-cancel.test.ts (120 lines)
- [ ] Test: Mid-offer cancel → both inventories unchanged
- [ ] Test: Mid-committed cancel → rollback both sides
- [ ] Test: Timeout cancel (10s with no activity) → auto-cancelled

#### 4.9 Create trade-replay.test.ts (160 lines)
- [ ] Test: Trade A ↔ B, save world, load, replay events → identical state
- [ ] Test: Trade with modified inventory mid-replay → rollback on conflict

### Deliverable
- ✅ TradeOverlay.tsx (4-stage modal)
- ✅ atomicTradeEngine.ts (atomic commit logic)
- ✅ multiplayerEngine extended with trade validation
- ✅ 5 test suites (40+ assertions)
- ✅ 0 trade duplication bugs

---

## Task 5: Cinematic Epoch Transitions

### Objective
Create overlay for stateRebuilder operations. Display lore-compliant cinematic screen with glitch effects.

### Subtasks

#### 5.1 Create WorldStateTransitionOverlay.tsx (360 lines)
- [ ] Full-screen modal w/ backdrop filter (blurred, darkened)
- [ ] Center content:
  - [ ] Title: "Reality Shifting..." or "The Strands Realign..."
  - [ ] Animated spinner (CSS rotation + scale)
  - [ ] ETA countdown: "Estimated time: ~3 seconds"
  - [ ] Lore text: Semi-transparent overlay with philosophical quotes
- [ ] Background glitch effect:
  - [ ] CSS @keyframes `glitch-shift` (displacement, color offset)
  - [ ] Trigger animation loop while transitioning
  - [ ] Text fragments from Chronicles (e.g., "...and the world fractured...")
- [ ] Sound: Ambient horror tone (optional; skip if budget tight)
- [ ] Auto-dismiss on event: `transitionEngine.onFinish()`

#### 5.2 Create transitionEngine.ts (200 lines)
- [ ] `startWorldTransition(reason: 'paradox'|'epoch_shift'|'world_reset'): void`
  - [ ] Broadcast event to all subscribers (BetaApplication)
  - [ ] Store metadata: reason, tick, estimated duration
- [ ] `finishWorldTransition(): void`
  - [ ] Broadcast completion event
  - [ ] Clean up resources
- [ ] Event subscription system: `subscribeToTransition(callback)`
- [ ] Transition metadata storage

#### 5.3 Modify stateRebuilder.ts
- [ ] Before rebuild: call `transitionEngine.startWorldTransition('reason')`
- [ ] Calculate estimated duration: `mutation_count * 0.5ms` (from Task 8 perf baseline)
- [ ] After rebuild: call `transitionEngine.finishWorldTransition()`

#### 5.4 Modify BetaApplication.tsx
- [ ] Subscribe to transitionEngine events
- [ ] State: `isTransitioning: boolean`, `transitionReason: string`
- [ ] Mount `<WorldStateTransitionOverlay>` at root (z-index: 9999)

#### 5.5 Create CSS @keyframes
- [ ] `@keyframes glitch-shift`: color offset R/G/B, 100ms cycle
- [ ] `@keyframes glitch-displacement`: vertical shift, 150ms cycle
- [ ] `@keyframes fade-in-out`: for lore text layers

#### 5.6 Create transition-overlay.test.ts (140 lines)
- [ ] Test: Render overlay → verify visible
- [ ] Test: Lore text loads → verify content present
- [ ] Test: Countdown timer updates every 100ms
- [ ] Test: Click backdrop → no-op (modal is blocking)
- [ ] Test: onFinish event →overlay disappears

#### 5.7 Create transition-timing.test.ts (180 lines)
- [ ] Test: 1000 mutations rebuild → overlay duration ~500ms
- [ ] Test: 10K mutations rebuild → overlay duration ~5s
- [ ] Test: Overlay ETA matches actual rebuild time ±20%

### Deliverable
- ✅ WorldStateTransitionOverlay.tsx (glitch effects, lore text, countdown)
- ✅ transitionEngine.ts (event system)
- ✅ stateRebuilder integration w/ callbacks
- ✅ CSS @keyframes for glitch effect
- ✅ 2 test suites (15+ assertions)

---

## Task 6: Advanced Tutorial Tier (Tier 2)

### Objective
Add 3 new auto-detected Tier 2 milestones: "The Diplomat", "The Weaver", "The Director".

### Subtasks

#### 6.1 Extend tutorialEngine.ts
- [ ] Add to `MilestoneType` enum:
  - [ ] `'diplomat_tier_2'`
  - [ ] `'weaver_tier_2'`
  - [ ] `'director_tier_2'`
- [ ] Add detection logic:
  - [ ] Diplomat: `faction.reputation > 50` (check all factions)
  - [ ] Weaver: Ritual with 3+ ingredients succeeds (check last successful ritual)
  - [ ] Director: `isDirector = true` (check state)
- [ ] Add lore database entries for T2 milestones (3 new Chronicle quotes)
- [ ] Extend progression: T2 milestones only detectable after T1 completion

#### 6.2 Modify detectMilestones() function
- [ ] Add branch: `if (tutorialState.tier === 1) return detectTier2Milestones()`
- [ ] Tier 2 detection checks (each returns bool):
  - [ ] `checkDiplomatMilestone(state, tutorialState)`
  - [ ] `checkWeaverMilestone(state, tutorialState)`
  - [ ] `checkDirectorMilestone(state, tutorialState)`

#### 6.3 Tier 2 lore database
- [ ] Diplomat quote: "To unite the fractured Strands is to understand their deepest desires..."
- [ ] Weaver quote: "The threads of magic intertwine; those who dance with them shall remake reality..."
- [ ] Director quote: "The Observer becomes the Observed; perspective is power..."

#### 6.4 Modify TutorialOverlay.tsx (if needed)
- [ ] Add visual indicator for Tier 2 (e.g., "⭐ Tier 2 Milestone" badge)
- [ ] Adjust fade-in animation or styling for distinction

#### 6.5 Create tutorial-diplomat.test.ts (100 lines)
- [ ] Test: Build faction rep to 50 → verify milestone triggered
- [ ] Test: Multiple factions, rep >50 each → triggers once per faction (or once total?)
- [ ] Test: Verify lore quote displays

#### 6.6 Create tutorial-weaver.test.ts (120 lines)
- [ ] Test: Cast ritual with 2 ingredients → no trigger
- [ ] Test: Cast ritual with 3+ ingredients, success → trigger
- [ ] Test: Ritual fails (fumble) → no trigger

#### 6.7 Create tutorial-director.test.ts (100 lines)
- [ ] Test: Toggle Director Mode OFF → no trigger
- [ ] Test: Toggle Director Mode ON → trigger
- [ ] Test: Verify lore quote displays

#### 6.8 Create tutorial-tier-progression.test.ts (150 lines)
- [ ] Test: Start fresh game → Tier 1 milestones detectable, Tier 2 not
- [ ] Test: Complete all Tier 1 → Tier 2 milestones become detectable
- [ ] Test: Trigger 3 Tier 2 milestones → all display correctly

### Deliverable
- ✅ tutorialEngine.ts extended with Tier 2 logic
- ✅ 3 new milestone detections + lore
- ✅ 4 test suites (30+ assertions)

---

## Task 7: "Strand Phantoms" — Player Echoes

### Objective
Persistent "Player Echoes" appear in world; anonymized ghost data from other active sessions create illusion of populated world.

### Subtasks

#### 7.1 Create phantomEngine.ts (300 lines)
- [ ] `GhostPlayer` type:
  ```ts
  interface GhostPlayer {
    id: string;              // Anonymized hash
    name: string;            // Procedural name: "Wanderer-7382"
    location: string;        // Region/area ID
    lastActionTick: number;  // When last seen acting
    action: string;          // e.g., "weaving_ritual", "exploring"
    visibleItems: string[];  // Public inventory items (non-PII)
    spawnedAt: number;       // Timestamp when echo appeared
  }
  ```
- [ ] `trackGhostPresence(worldId, playerLocation, maxDistance): Promise<GhostPlayer[]>`
  - [ ] Query `/api/sessions/active?worldId=...&skip=clientId`
  - [ ] Filter ghosts within `maxDistance` (same region + adjacent regions)
  - [ ] Anonymize: hash player IDs, use procedural names
  - [ ] Return 4–10 ghosts (randomize count)
- [ ] `updateGhostActions(ghosts, tick): void`
  - [ ] Replay ghost actions from past ticks
  - [ ] Move ghosts within region (random walk)
  - [ ] Age ghosts: after 10 real minutes, fade out
- [ ] `getGhostPresenceScore(regionId): number`
  - [ ] 0–10 scale based on active ghost density

#### 7.2 Create /api/sessions/active.ts (100 lines)
- [ ] `GET /api/sessions/active?worldId=...&skip=clientId&limit=10`
  - [ ] Query active sessions in `worldId`
  - [ ] Skip calling client (don't echo yourself)
  - [ ] Limit to 10 results
  - [ ] Return anonymized player data (no PII, no real names, no IPs)
  - [ ] Format: `{ id, proceduralName, location, lastActionTick, action }`

#### 7.3 Modify worldEngine.ts
- [ ] Add `phantoms: GhostPlayer[]` to `WorldState`
- [ ] On each tick: call `phantomEngine.trackGhostPresence()`
- [ ] Update phantoms array
- [ ] Render ghosts as NPCs (read-only)

#### 7.4 Modify WorldView.tsx (if exists)
- [ ] Render phantom players with distinct visual treatment:
  - [ ] 50% opacity (translucent)
  - [ ] Subtle glow effect (box-shadow: 0 0 10px rgba(200,200,255,0.3))
  - [ ] Label: "Echo" (not "NPC" or player name)
  - [ ] Hover tooltip: procedural name + action (e.g., "Wanderer-7382 is exploring")
- [ ] No interaction: clicking phantom does nothing

#### 7.5 Add anonymization utilities
- [ ] `hashPlayerId(playerId): string` → deterministic hash for same player
- [ ] `generateProceduralName(hash): string` → Wanderer-XXXX format
- [ ] Verify no PII leakage in ghost data

#### 7.6 Create phantom-engine.test.ts (200 lines)
- [ ] Test: `trackGhostPresence` returns 4–10 ghosts
- [ ] Test: Anonymization: no real player IDs in ghost data
- [ ] Test: Distance filtering: ghosts in adjacent regions included, far regions excluded
- [ ] Test: Ghost aging: present at 0min, fade at 10min
- [ ] Test: Ghost actions update smoothly (random walk)

#### 7.7 Create phantom-render.test.ts (140 lines)
- [ ] Test: Render 10 phantoms in world view
- [ ] Test: Phantoms visually distinct from NPCs (opacity, label)
- [ ] Test: Hovering shows procedural name + action
- [ ] Test: Clicking phantom = no-op (no interaction)

#### 7.8 Create phantom-fade.test.ts (120 lines)
- [ ] Test: Ghost appears at tick 0
- [ ] Test: Ghost persists for 10 real minutes (~600 game ticks)
- [ ] Test: At 11 min, ghost fades out (alpha -> 0 over 1 sec)
- [ ] Test: Faded ghost removed from phantoms array

#### 7.9 Test API endpoint
- [ ] Manual test: Call `/api/sessions/active?worldId=test&skip=client123`
- [ ] Verify anonymized response

### Deliverable
- ✅ phantomEngine.ts (ghost tracking, aging, anonymization)
- ✅ `/api/sessions/active` endpoint (anonymized session query)
- ✅ WorldEngine + WorldView integration
- ✅ Utilities for anonymization & procedural naming
- ✅ 4 test suites (35+ assertions)

---

## Task 8: Multiplayer Cluster Stress Test

### Objective
16-peer simulation @ 10 evt/sec sustains <50ms p95 rebuild latency. Generate performance report.

### Subtasks

#### 8.1 Create scripts/cluster-stress-test.ts (400 lines)
- [ ] Headless Node.js simulation (no UI)
- [ ] Setup: 16 `WorldState` instances + `SessionRegistry`
- [ ] Event emitter:
  - [ ] 10 evt/sec per peer = 160 evt/sec total
  - [ ] Event distribution (realistic):
    - [ ] TICK: 40%
    - [ ] MOVE: 20%
    - [ ] TRADE: 10%
    - [ ] RITUAL: 10%
    - [ ] EPOCH_SYNC: 10%
    - [ ] OTHER: 10%
  - [ ] Duration: 60 seconds
  - [ ] Total: 9,600 events
- [ ] Metrics collection:
  - [ ] Rebuild latency: histogram (ms, p50/p95/p99)
  - [ ] Consensus sync time: p95/p99 across all peers
  - [ ] Conflict resolution: count (ties, rejections)
  - [ ] Memory: baseline → peak → stabilized
  - [ ] GC pause count (if --expose-gc enabled)
- [ ] Success criteria (assert):
  - [ ] P95 rebuild latency < 50ms
  - [ ] P99 consensus sync < 200ms
  - [ ] 0 memory leaks (stable after GC)
  - [ ] All events replayed identically (audit trail)
- [ ] Output: console log + JSON metrics file

#### 8.2 Create cluster-stress-report.ts (150 lines)
- [ ] Format metrics into markdown report
- [ ] Include:
  - [ ] Summary table (p50/p95/p99 latency, throughput, memory)
  - [ ] ASCII histogram (latency distribution)
  - [ ] Recommendations (e.g., "Consider sharding if >32 peers desired")
- [ ] Output: `ALPHA/artifacts/M42_CLUSTER_STRESS_REPORT.md` (append timestamp)

#### 8.3 Create test wrapper: cluster-stress-test.integration.test.ts (250 lines)
- [ ] Jest wrapper around `cluster-stress-test.ts`
- [ ] Launch as child process: `node scripts/cluster-stress-test.ts`
- [ ] Parse output & metrics
- [ ] Jest assertions on success criteria:
  - [ ] `expect(metrics.p95LatencyMs).toBeLessThan(50)`
  - [ ] `expect(metrics.p99ConsensusSyncMs).toBeLessThan(200)`
  - [ ] `expect(metrics.memoryLeakDetected).toBe(false)`
  - [ ] `expect(metrics.eventReplayErrors).toBe(0)`
- [ ] Runs as part of CI (with `--timeout 120000` for 2min run)

#### 8.4 Create bash/PowerShell runner
- [ ] `scripts/run-cluster-stress.sh` (bash) or `.ps1` (Windows)
- [ ] Usage: `./run-cluster-stress.sh` or `.\run-cluster-stress.ps1`
- [ ] Launches stress test, captures output, calls report generator

#### 8.5 Stress test specifics
- [ ] Use deterministic RNG seed (`seed=42`) for reproducibility
- [ ] Log every 1000 events: "1000 events processed in Xms"
- [ ] Periodically log GC stats (if available)
- [ ] Catch and log any errors (don't crash on single event)

#### 8.6 Integration with prior tasks
- [ ] Stress test **uses** Task 1 (epoch sync machinery)
- [ ] Stress test **uses** Task 4 (atomic trade logic)
- [ ] Stress test **uses** Task 7 (phantom queries)
- [ ] Ensures all M42 systems stable under load

### Deliverable
- ✅ cluster-stress-test.ts (9,600-event simulation, 16 peers)
- ✅ cluster-stress-report.ts (markdown report generator)
- ✅ Jest integration test wrapper
- ✅ Bash/PowerShell runner script
- ✅ Performance report: `M42_CLUSTER_STRESS_REPORT.md`
- ✅ Verification: All systems stable at 160 evt/sec

---

# Implementation Schedule

## Week 1 (Days 1–5)
- **Day 1–2:** Task 1 (Epoch Sync) — core engine + tests
- **Day 2–3:** Task 2 (Dice Altar) — modals + diceAltarEngine + 50% of tests
- **Day 3–4:** Task 6 (Tutorial Tier 2) — quick win, extend tutorialEngine
- **Day 4–5:** Task 3 (Diagnostics) — diagnostic panel + sidebar integration

## Week 2 (Days 6–10)
- **Day 6–7:** Task 4 (Atomic Trades) — full trade flow + atomic commit logic
- **Day 7–8:** Task 5 (Cinematic Transitions) — overlay + stateRebuilder integration
- **Day 8–9:** Task 7 (Phantoms) — phantomEngine + API endpoint + integration
- **Day 9–10:** Testing & Polish — run full test suites, fix minor issues

## Week 3 (Days 11–15)
- **Day 11–13:** Task 8 (Stress Test) — cluster simulation, metrics, report
- **Day 13–15:** Final validation — all tasks integrated, smoke test, M42 summary docs

---

# Sign-Off Checklist

- [ ] All 8 tasks implemented
- [ ] 0 TypeScript compilation errors
- [ ] All task-specific test suites passing (green)
- [ ] Integration smoke test passing
- [ ] Cluster stress test P95 <50ms latency
- [ ] No regressions vs M41 baselines
- [ ] Documentation: `M42_COMPLETE_SUMMARY.md` + `M42_STATUS_REPORT.txt`
- [ ] Git commit: "M42 complete: Social Scaling & Epoch Immersion"
