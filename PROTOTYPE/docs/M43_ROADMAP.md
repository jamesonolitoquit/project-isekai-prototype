// Milestone 43 Roadmap: Advanced AI & Persistent Worlds
// Foundation: Milestone 42 Complete (Director Authority System)
// Release Target: March 15, 2026

## M43 Vision: Transform Reactive World into Emergent NPC Intelligence

### Strategic Goals

1. **aiDmEngine**: Replace hardcoded NPC responses with personality-driven AI decisions
   - Each NPC has personality vector (compassion, ambition, prudence, mystique)
   - Director actions influence personality drift (paradoxes → more likely to question authority)
   - Conversations generate unique outcomes per personality state
   
2. **Persistent World Fragments**: Epoch-spanning environmental changes
   - Buildings built in epoch N remain in epoch N+1 (with weathering)
   - Gardens planted survive as overgrown ruins
   - Director sealing creates hard boundaries (canon events can't be rolled back)
   
3. **Multiplayer Authority Ledger**: Decentralized Director consensus
   - Multiple GMs can co-direct with democratic overrides
   - Ritual consensus becomes binding for major world events
   - Phantom detection prevents solo director exploits

### Phase A: AI Decision Engine (Weeks 1-2)

#### Task A1: Personality Vector System
- **File**: `src/engine/aiDmEngine.ts` (NEW)
- **Personality Dimensions**:
  - `compassion`: [0-1] how much NPC cares about others (higher → helps players more)
  - `ambition`: [0-1] drive to gain power/resources (higher → bids higher in auctions)
  - `prudence`: [0-1] risk aversion (higher → doesn't join risky quests)
  - `mystique`: [0-1] faith in weird/magical explanations (higher → believes paradox reports)
- **Drift Mechanics**:
  - Paradoxes detected by NPC → mystique +0.1
  - Director overrides NPC choice → prudence +0.1
  - NPC succeeds in ambitious goal → ambition increases slightly
- **Default Personality**: Use legacy bloodline data to seed starting personality
- **Test**: Create NPC with personality vector, evolve through 10 world ticks, verify 4 dimensions tracked

#### Task A2: Narrative Decision Tree
- **File**: `src/engine/narrativeDecisionTree.ts` (NEW)
- **Structure**: Conversation → Personality filter → Probability distribution → Action
- **Example**: 
  ```
  Conversation: "Will you join me on a dangerous quest?"
  NPC with low prudence (0.2), high compassion (0.8)
    → 80% chance: "Yes, friend needs me"
    → 15% chance: "Let me think..."
    → 5% chance: "Too risky"
  ```
- **Integration**: Called by actionPipeline during NPC conversation events
- **Test**: Verify 100 conversations with same seed produce deterministic outcomes
- **Replay Safety**: All random choices use SeededRng(npcSeed, conversationId)

#### Task A3: Authority Debt System
- **File**: `src/engine/authorityDebtEngine.ts` (NEW)
- **Concept**: Director overrides accumulate "narrative debt" that must be repaid through roleplay
- **Mechanics**:
  - Each `/force_epoch` adds +1 debt
  - Each sealed portion of timeline adds +2 debt
  - High debt NPCs become uncontrollable (more likely to question authority)
  - Director can "spend" ritual consensus votes to reset debt
- **Display**: CoDmDashboard shows authority debt meter
- **Test**: Verify debt tracking across 5 director overrides

#### Task A4: Integration with ExistingRoleplay
- **File**: Update `src/engine/actionPipeline.ts` to call aiDmEngine
- **Change**: Before executing NPC action, check personality first
- **Performance**: All AI decisions must complete in <5ms
- **Test**: Benchmark 100 concurrent NPC decision requests

### Phase B: Persistent World Fragments (Weeks 3-4)

#### Task B1: Environmental Change Persistence
- **File**: `src/engine/worldFragmentEngine.ts` (NEW)
- **Structure**: FragmentId → (epochCreated, building/garden/landmark description, durability)
- **Lifecycle**:
  - Player builds building in Epoch 5 → fragmentId.durability = 1.0
  - Transition to Epoch 6 → fragmentId.durability = 0.8 (weathered)
  - Transition to Epoch 7 → fragmentId.durability = 0.6 (crumbling)
  - At durability 0.0 → Fragment destroyed unless sealed
- **Sealed Fragments**: Use `/seal_canon` to prevent decay
- **Save Format**: Store fragments in saveLoadEngine.stateSnapshot
- **Test**: Create fragment, transition through 3 epochs, verify durability decreases correctly

#### Task B2: Canonical Event Boundaries
- **File**: Update `src/engine/saveLoadEngine.ts` with canonicalBoundary tracking
- **Concept**: When `/seal_canon` executed at tick T:
  - Events before T become "canonical" (can never be rolled back)
  - worldFragments created before T locked into position permanently
  - Player can't load saves before canonical boundary
- **Effect**: Director sealing creates permanent world state decision points
- **Test**: Create 2 fragments, seal one epoch later, verify sealed fragment persists across reload

#### Task B3: Cross-Epoch Visibility
- **File**: `src/client/components/WorldVisualization.tsx` (NEW)
- **Feature**: Show world state with overlayed fragment history
- **Visual**: Transparent older buildings (Epoch N-1), opaque current (Epoch N)
- **Hover Detail**: "This shrine was built in Epoch 3, currently deteriorating"
- **Integration**: Called during world render phase
- **Test**: Render world with 3 fragments from different epochs, verify layering

#### Task B4: Persistent Quests & Locations
- **File**: Update questEngine with epoch-spanning quest threads
- **Mechanic**: Quests spawned in Epoch 5 still active in Epoch 6 (unless sealed)
- **Example**: "Find 3 artifacts" quest created in Epoch 5 remains in Epoch 6 but locations may be different
- **Performance**: All cross-epoch lookups cached and memoized
- **Test**: Create quest in Epoch 5, transition to Epoch 6, verify quest still available

### Phase C: Multiplayer Authority (Weeks 5-6)

#### Task C1: GM Ledger System
- **File**: `src/engine/directorLedgerEngine.ts` (NEW)
- **Log Structure**: DirectorAction → (directorId, timestamp, actionType, approval_votes, veto_votes)
- **Approval Threshold**: 2/3 majority of active GMs
- **Actions Requiring Vote**:
  - `/seal_canon` → requires 2/3 approval
  - `/force_epoch` with debt > 2 → requires approval
  - Ritual consensus triggers → counts as formal action
- **Veto Mechanism**: Single GM veto (for abuse prevention) with justification required
- **Storage**: Persisted in saveLoadEngine alongside mutations
- **Test**: Execute 3 director actions with multi-GM voting, verify ledger recorded

#### Task C2: Phantom Detection Hardening
- **File**: Update `src/engine/phantomEngine.ts` with reputation scoring
- **Detection Algorithm**:
  - If one GM sealed an event, other GMs must see identical event in replay
  - Mismatch → phantom marker increases for out-of-sync GM
  - High phantom score triggers notification UI
- **Prevention**: Phantom GMs can't vote on sealed areas during next seal period
- **Test**: Simulate 2 GMs with different event sequences, verify phantom detection

#### Task C3: Ritual Consensus Authority
- **File**: Update `src/client/components/RitualConsensusUI.tsx` for locked majorities
- **Change**: After 2/3 vote achieved, consensus becomes "locked"
- **Effect**: Can't rewind past locked consensus point without Director override
- **Display**: Show locked consensus in immutable historical timeline
- **Test**: Create consensus vote, reach 2/3, try to rollback, verify denied

#### Task C4: Authority Transparency Dashboard
- **File**: Update `src/client/components/CoDmDashboard.tsx` with new Authority section
- **Display**:
  - Director ledger (last 10 actions with voting status)
  - GM reputation scores
  - Current authority debt levels
  - Sealed regions on world map highlight
- **Integration**: Real-time updates from directorLedgerEngine
- **Performance**: All ledger lookups cached, update every 5s
- **Test**: Render dashboard with 5 historical director actions, verify all visible and accurate

### Phase D: Integration & Testing (Week 7)

#### Task D1: End-to-End Personality System
- **Scenario**: Player meets NPC (low prudence, high compassion)
- **Flow**: 
  1. DirectorConsole can suggest NPC personality via `/describe_npc`
  2. NPC makes personality-driven decision in conversation
  3. aiDmEngine generates dialogue based on personality
  4. action recorded as deterministic (uses npcSeed)
- **Test**: 3 conversations with same seed produce identical outcomes ✓
- **Test**: 3 conversations with different seeds produce varied outcomes ✓

#### Task D2: World Fragment Persistence
- **Scenario**: Player builds shrine in Epoch 1, world transitions to Epoch 2
- **Flow**:
  1. Shrine created with fragmentId and durability 1.0
  2. Epoch transition → durability 0.8
  3. Player loads old save → shrine visible but damaged
  4. New epoch → shrine is "memory" version if not sealed
- **Test**: Create 5 fragments, transition 2 epochs, reload save, verify all 5 visible with correct durability

#### Task D3: GM Authority Ledger
- **Scenario**: 3 GMs collaboratively direct 1 world
- **Flow**:
  1. GM1 executes `/force_epoch` → recorded in ledger
  2. GM2 and GM3 vote (2s window, auto-passes if 2+ approve)
  3. Sealed event appears in all 3 GM views identically
  4. If phantom GM detected → ledger marks with ⚠️
- **Test**: 5 multi-GM director actions, all ledger entries match ✓

#### Task D4: Stress Test M43
- **File**: `scripts/m43-stress-test.ts` (NEW)
- **Parameters**:
  - 3 concurrent GMs
  - 10 NPCs with personality drift
  - 20 world fragments (mixed durability)
  - 5 locked consensus votes
  - 1000 simulated world ticks
- **Targets**:
  - P95 latency: <200ms
  - Director ledger sync: 100% accuracy
  - Personality consistency: 100% deterministic
  - Fragment durability: verified accurate
- **Output**: artifacts/M43_STRESS_TEST_FINAL.txt with telemetry

### File Checklist

**New Files (8):**
- [ ] src/engine/aiDmEngine.ts
- [ ] src/engine/narrativeDecisionTree.ts
- [ ] src/engine/authorityDebtEngine.ts
- [ ] src/engine/worldFragmentEngine.ts
- [ ] src/engine/directorLedgerEngine.ts
- [ ] src/client/components/WorldVisualization.tsx
- [ ] scripts/m43-stress-test.ts
- [ ] docs/M43_IMPLEMENTATION_REPORT.md

**Modified Files (5):**
- [ ] src/engine/actionPipeline.ts (add aiDmEngine call)
- [ ] src/engine/saveLoadEngine.ts (add canonicalBoundary + fragments)
- [ ] src/engine/phantomEngine.ts (reputation scoring)
- [ ] src/engine/questEngine.ts (epoch-spanning quests)
- [ ] src/client/components/CoDmDashboard.tsx (Authority section)
- [ ] src/client/components/RitualConsensusUI.tsx (locked consensus)

**Build Requirements:**
- [ ] npm run build validates all 13 file changes
- [ ] jest runs all 8 new test suites (40+ tests total)
- [ ] type check passes with strict engine interfaces extended to M43 engines

### Dependencies & Risk Analysis

**Dependencies on M42:**
- Director Console ready ✓
- seededNow() available ✓
- saveLoadEngine supports custom fields ✓
- RitualConsensusUI foundation ✓
- Determinism test suite template ✓

**Risks & Mitigation:**
- **Personality drift explosion**: Mitigate with bounded [-1, 1] clamping
- **Fragment database bloat**: Mitigate with lazy-loading and durability cleanup
- **Multi-GM sync failures**: Mitigate with phantom detection ledger
- **AI decision latency**: Mitigate with pre-computed decision tree caching

### Success Criteria

✅ All 4 phases complete on schedule (7 weeks)
✅ Build passes with zero TypeScript errors
✅ 13 new/modified files integrated
✅ 40+ new unit tests all passing
✅ Stress test achieves <200ms P95 latency
✅ M43 documentation complete and reviewed

### Next Steps After M43

**M44 Roadmap Preview:**
- Dynamic NPC faction warfare (rival merchant guilds)
- Procedural dungeon generation with seal checkpoints
- Player-built architecture persistence (housing system)
- Advanced AI memory system (NPC remembers past decisions)

---

**Milestone 42 to 43 Transition:**
- M42 Complete: Feb 17, 2026 ✓
- M43 Start: Feb 18, 2026
- M43 Target Complete: Mar 15, 2026
- M44 Preview: Mar 22, 2026
