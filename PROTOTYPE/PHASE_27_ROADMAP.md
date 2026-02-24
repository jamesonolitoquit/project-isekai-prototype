# Phase 27: The Synthesis of Chaos — Roadmap

**Phase Title**: Generative Causality & Temporal Paradoxes  
**Date Planned**: February 24, 2026 onwards  
**Strategic Goal**: Ensure every player action leaves permanent marks on world evolution  
**Milestone**: M59 (Advanced Engine Subsystems)

---

## Phase Overview

Phase 27 transitions the engine from **reactive** systems (responding to player actions) to **generative** systems (proactively generating consequences and paradoxes). The world becomes a living entity that not only responds to events but actively reshapes reality when causality breaks.

**Key Philosophy**:
- **Visible Causality**: Players see traceable consequences of their actions
- **Temporal Debt**: Breaking invariants creates "paradox points" that accumulate
- **Economic Vitality**: NPC behavior directly linked to realm economy
- **Multiplayer Synchronization**: 6-player consensus with oracle-based desync resolution

---

## Task 1: The Paradox Engine (Age Rot Manifestation)

**Status**: 🔄 PLANNED  
**Estimated LOC**: 150-200  
**Dependencies**: Phase 25 (snapshot system), worldEngine.ts, beliefEngine.ts

### Purpose

Move beyond static "social scars" to **temporal debt** and **age rot anomalies**. When players create invariant violations (duplicated rare items, conflicting quest states, time paradoxes), the engine accumulates "paradox points" and manifests them as zones of reality distortion.

### Design

#### 1. Paradox Point Accumulation

**Sources of Paradox Points**:

| Event | Points | Narrative |
|---|---|---|
| Duplicated unique item | +50 | "An echo of the artifact exists simultaneously" |
| Quest state conflict | +20 | "Two contradictory memories haunt the realm" |
| NPC timeline violation | +30 | "The merchant was in two places at once" |
| Player level reset | +25 | "Reality rewinds your growth" |
| Snapshot rebuild failure | +15 | "The world glitches and reconstitutes" |
| MultiplayerDesync > 100ms | +10 | "Parallel timelines briefly diverge" |

**Storage**:
```typescript
interface ParadoxState {
  totalParadoxPoints: number;      // Cumulative lifetime points (never reset)
  activeParadoxEvents: Map<string, number>; // Event ID → points remaining
  lastManifestationTick: number;   // When last anomaly appeared
  manifestationThreshold: number;  // Points needed for next anomaly (100, 200, 300...)
}
```

#### 2. Age Rot Anomalies

When paradox points exceed threshold (100 → 200 → 300 ...), the realm manifests **"Age Rot Zones"**—areas where physics and game rules become unpredictable.

**Anomaly Effects** (random per zone):

```typescript
enum AgeRotAnomalyType {
  INVERTED_HEALING = "Healing spells deal damage",
  IDENTITY_SWAP = "NPCs randomly swap identities",
  TIME_LOOP = "Location repeats last hour indefinitely",
  STAT_INVERSION = "All damage reversed and redirected to caster",
  PROPHECY_BREAK = "Quests generate contradictory objectives",
  LOOT_DUPLICATION = "Dropped items stack infinitely",
  NPC_MULTIPLICATION = "NPC spawns duplicates of itself hourly"
}
```

**Spatial Manifestation**:
- Creates a "corrupted zone" at a random location
- Lasts 1000 ticks (15-20 minutes game time)
- NPCs avoid the zone
- Player gets warning: "Reality fractures..."
- Scars the location permanently with "paradox_scar"

#### 3. Paradox Engine Implementation

**File**: `src/engine/paradoxEngine.ts`  
**Key Functions**:

```typescript
// Main orchestrator (call every 100 ticks in advanceTick)
function harvestParadoxPoints(state: WorldState, events: Event[]): number

// Accumulate from specific sources
function accumulateFromDuplication(item: Item): number
function accumulateFromQuestConflict(quest1: Quest, quest2: Quest): number
function accumulateFromTimelineViolation(npc: NPC, conflictingTimestamps: number[]): number

// Manifestation
function triggerAgeRotAnomaly(state: WorldState, paradoxPoints: number): AgeRotEvent

// Recovery
function healParadoxZone(locationId: string, healingAmount: number): boolean
```

### Integration Points

1. **In worldEngine.ts advanceTick()**:
   ```typescript
   // After social outburst section
   const paradoxPoints = harvestParadoxPoints(state, recentEvents);
   state.paradoxState = { ...state.paradoxState, totalParadoxPoints: paradoxPoints };
   
   if (shouldManifestAnomaly(state.paradoxState)) {
     const anomalyEvent = triggerAgeRotAnomaly(state, paradoxPoints);
     appendEvent(anomalyEvent);
   }
   ```

2. **In saveLoadEngine.ts**:
   - Persist `state.paradoxState` to snapshots
   - Validate paradox points in integrity checks

3. **In aiDmEngine.ts**:
   - Avoid age rot zones when pathfinding NPCs
   - Generate "reality distortion" narrative entries for chronicle

### Verification

- ✅ Paradox points accumulate from duplicated items
- ✅ Anomalies trigger at threshold (100, 200, 300...)
- ✅ Age rot zone creates playable location corruption
- ✅ Events logged to mutation log with full causality chain
- ✅ Save/load preserves paradox state
- ✅ No type errors

---

## Task 2: Multiplayer Alpha Core (Oracle Consent)

**Status**: 🔄 PLANNED  
**Estimated LOC**: 200-250  
**Dependencies**: Phase 23 (multiplayer), npcSocialAutonomyEngine.ts, p2pNetworkEngine.ts

### Purpose

Harden P2P networking for **6-player synchronization** with resolved desyncs via "oracle consensus." When two players attempt conflicting actions (both try to pick up same item, modify same NPC), use a majority-Vote or host-authority model to resolve consistently.

### Design

#### 1. Oracle Role Assignment

At world start, designate one player as **"Oracle"** (typically the host):

```typescript
interface OracleState {
  oraclePlayerId: string;           // Host player ID
  oracleNonce: number;              // Monotonic counter for decisions
  lastConsensusCheckTick: number;   // When last vote happened
  participantVotes: Map<string, ConsensusVote>; // Player ID → vote
}

interface ConsensusVote {
  playerId: string;
  actionId: string;                 // Which conflicting action to prioritize
  tick: number;
  signature: string;                // For integrity
}
```

#### 2. Conflict Detection & Resolution

**Scenario**: Player A and Player B both click on the same NPC simultaneously.

**Resolution Steps**:

1. **Local Action**: Each player executes locally (optimistic)
2. **Broadcast**: Both send mutation events to other peers
3. **Conflict Detection**: P2P engine identifies mutual exclusivity
   ```
   Conflict: NPC_INTERACTION from A @ tick 1050
   + NPC_INTERACTION from B @ tick 1050
   → Requires arbitration
   ```
4. **Oracle Vote**: Host (oracle) receives both, decides:
   - "Accept A's interaction (they initiated 2ms earlier)"
   - Sends `ORACLE_VERDICT` to all peers
5. **Convergence**: All players rebuild state with oracle decision
   - B's action rolled back
   - B receives `ACTION_DENIED_ORACLE_CONFLICT` event
   - Mutation log updated with oracle's choice

#### 3. Multiplayer Macro-Events

Certain world events (Social Outburst, Economy Boom) happen **once** across all 6 players:

```typescript
interface SynchronizedMacroEvent {
  eventId: string;
  type: 'SOCIAL_OUTBURST' | 'ECONOMY_BOOM' | 'AGE_ROT_MANIFESTATION';
  oracleInitiatedTick: number;
  consensusRequiredVotes: number;  // 4-5 out of 6 for supermajority
  votesReceived: string[];        // Player IDs who ACK'd
}
```

**Integration in worldEngine.ts**:

```typescript
// When macro-event triggers:
if (shouldTriggerMacroEvent(state)) {
  const macroEv = { ...event, oracleInitiated: true };
  appendEvent(macroEv);
  
  // Broadcast to P2P for consensus
  p2pBroadcast({
    type: 'MACRO_EVENT_PROPOSAL',
    event: macroEv,
    requestConsensus: true
  });
}
```

#### 4. Desync Recovery

If a player's state diverges significantly (> 100ms consensus lag):

```typescript
function detectDesync(myState: WorldState, theirSnapshot: StateSnapshot): boolean {
  const divergence = calculateStateDistance(myState, theirSnapshot);
  return divergence > DESYNC_THRESHOLD; // ~150 mutations difference
}

function resolveDesync(myState: WorldState, oracleState: WorldState): WorldState {
  // Take oracle snapshot as ground truth
  // Replay only my local-only actions
  // Discard any server-rejected actions
  return replayWithOracleRevision(myState, oracleState);
}
```

### Implementation Files

**File**: `src/engine/oracleConsensusEngine.ts`  
**File**: Enhanced `src/server/p2pNetworkEngine.ts` with oracle voting

**Key Functions**:

```typescript
// Setup
function assignOracle(playerIds: string[]): string

// Conflict resolution
function detectConflict(action1: Action, action2: Action): boolean
function requestOracleVerdict(conflicts: Action[]): OracleDecision

// Voting
function recordConsensusVote(playerId: string, decision: ConsensusVote): void
function hasConsensusReached(macro: SynchronizedMacroEvent): boolean

// Recovery
function detectDesyncFromOracle(myState: WorldState, oracleSnapshot: StateSnapshot): boolean
function rebuildFromOracleSnapshot(myState: WorldState, oracleSnapshot: StateSnapshot): WorldState
```

### Verification

- ✅ Two players picking same item → oracle decides one succeeds
- ✅ Macro-events propagate consistently to all 6 players
- ✅ Desync detected when state diverges
- ✅ Recovery re-syncs with oracle snapshot
- ✅ Mutation logs consistent across peers
- ✅ No type errors

---

## Task 3: Economic Synthesis (NPC Caravans)

**Status**: 🔄 PLANNED  
**Estimated LOC**: 150-180  
**Dependencies**: npcEngine.ts, npcSocialAutonomyEngine.ts, economyEngine (if exists)

### Purpose

Link **economyHealth** (from telemetryEngine) directly to **NPC behavior**. This creates visible economic causality: prosperity triggers caravans between locations, depression triggers migration and stagnation.

### Design

#### 1. Economy-Driven Caravan Events

When `economyHealth >= 75` **AND** multiple hotspots active:

**Trigger**:
```typescript
function evaluateCaravanConditions(state: WorldState, telemetry: TelemetryPulse): boolean {
  const hasAbundanceOfHotspots = telemetry.hotspots.length >= 5;
  const isProsperity = telemetry.economyHealth >= 75;
  const hasTimeElapsed = (state.tick - (state._lastCaravanTick ?? 0)) > 500; // ~7-8 minutes
  
  return hasAbundanceOfHotspots && isProsperity && hasTimeElapsed;
}
```

**Caravan Generation**:
```typescript
interface NpcCaravan {
  id: string;
  npcIds: string[];  // 2-5 NPCs traveling together
  startLocationId: string;
  routeLocationIds: string[];  // Path: start → mid1 → mid2 → destination
  cargo: Map<string, number>; // Item ID → quantity
  economyValue: number;        // Gold amount in transit
  arrivalTick: number;
  narrative: string;           // "Merchant caravan departs..."
}
```

#### 2. Depression-Triggered Migration

When `economyHealth < 25` at a location:

```typescript
function triggerEconomicMigration(state: WorldState, locationId: string) {
  // NPCs at this location consider leaving
  const npcsHere = state.npcs.filter(n => n.locationId === locationId);
  
  npcsHere.forEach(npc => {
    if (random() < 0.3) { // 30% chance per NPC
      // Find neighboring location with higher economy
      const betterLocation = findBetterLocation(state, locationId);
      if (betterLocation) {
        npc.locationId = betterLocation.id;
        // Create ECONOMIC_MIGRATION event
      }
    }
  });
}
```

#### 3. Vitality Feedback Loop

**Economy Influences**:
- High economy → Increased NPC gold → Caravan formation
- Low economy → NPCs leave → Further economic decline (negative spiral)
- Caravan passage → Resource redistribution → Economy stabilizes

```
Economy Score
    ↑
    │
    ├─ (Trade activity at hotspots)
    ├─ (NPC wealth accumulated)
    └─ (Faction conflicts resolved)

    ↓

NPC Behavior
    ├─ High: Generate caravans, stay put, reproduce
    └─ Low: Migrate, hoard, hide resources
```

#### 4. Caravan Mechanics

**Movement**:
- Caravans move 1 location per tick
- Follow pre-calculated safest route (avoid corrupted/void biomes)
- Can be ambushed by players for cargo

**Arrival**:
- When caravan reaches destination: `CARAVAN_ARRIVED` event
- Distribute cargo to NPCs at destination
- Generate `TRADE_OPPORTUNITY` quest for nearby players

**Integration into advanceTick()**:

```typescript
// Every 100 ticks
{
  const telemetry = getTelemetryEngine().generateTelemetryPulse(...);
  
  // Evaluate caravan formation
  if (evaluateCaravanConditions(state, telemetry)) {
    const newCaravan = generateNpcCaravan(state, telemetry);
    state._activeCaravans = [...(state._activeCaravans || []), newCaravan];
    appendEvent({ type: 'CARAVAN_FORMED', payload: { caravan: newCaravan } });
  }
  
  // Update active caravans
  state._activeCaravans?.forEach(caravan => {
    if (caravan.arrivalTick <= state.tick) {
      // Caravan arrived
      applyCaravanArrival(state, caravan);
    }
  });
  
  // Evaluate migration
  if (telemetry.economyHealth < 25) {
    triggerEconomicMigration(state, lowestEconomyLocationId);
  }
}
```

### Implementation File

**File**: `src/engine/economicSynthesisEngine.ts`

**Key Functions**:

```typescript
// Evaluation
function evaluateCaravanConditions(state: WorldState, telemetry: TelemetryPulse): boolean

// Generation
function generateNpcCaravan(state: WorldState, telemetry: TelemetryPulse): NpcCaravan
function selectCaravanRoute(startId: string, endId: string, state: WorldState): string[]

// Movement
function advanceCaravan(caravan: NpcCaravan, tick: number): CaravanStatus

// Arrival
function applyCaravanArrival(state: WorldState, caravan: NpcCaravan): Event[]

// Migration
function triggerEconomicMigration(state: WorldState, locationId: string): void
function findBetterLocation(state: WorldState, currentLocationId: string): Location | null
```

### Verification

- ✅ Caravans generate when economy >= 75% and multiple hotspots
- ✅ Caravans move and arrive at destinations
- ✅ NPCs migrate when local economy < 25%
- ✅ Cargo redistributed on arrival
- ✅ Events logged to mutation system
- ✅ No type errors

---

## Phase 27 Milestones

| Task | Target Date | Status | LOC Estimate |
|---|---|---|---|
| Task 1: Paradox Engine | Feb 26 | 🔄 Planned | 150-200 |
| Task 1: Integration & Test | Feb 27 | 🔄 Planned | — |
| Task 2: Multiplayer Oracle | Feb 28 | 🔄 Planned | 200-250 |
| Task 2: 6-Player Testing | Mar 1 | 🔄 Planned | — |
| Task 3: Economic Synthesis | Mar 2-3 | 🔄 Planned | 150-180 |
| Phase 27 Ready for Beta | Mar 4 | 🔄 Planned | — |

---

## Strategic Integration with Previous Phases

### Phase 25 (Snapshot & Telemetry)
- Paradox Engine: Uses snapshot system to detect invariant violations
- Oracle Consensus: Relies on snapshot as "ground truth" for desync resolution
- Economic Synthesis: Reads telemetryEngine data for economy health

### Phase 26 (Escalation & Scars)
- Social Outburst + Paradox Anomalies work together (high GST causes paradoxes to manifest)
- Economic collapse can trigger NPC migration (already done Task 2)
- Caravans pass through locations bearing Social Scars

### Phase 24 (NPC Autonomy)
- Paradox anomalies affect NPC AI (can't pathfind through anomalies)
- Caravans composed of autonomous NPCs
- Oracle consensus protects NPC state from desync corruption

---

## Success Criteria

**Phase 27 Completion** requires:

1. **Paradox Engine**:
   - [ ] Paradox points accumulate from duplications
   - [ ] Anomalies manifest and scar locations
   - [ ] Age rot zones playable (NPCs avoid, players can enter)
   - [ ] Events logged with full causality chain

2. **Oracle Consensus**:
   - [ ] Conflicts auto-resolved by oracle
   - [ ] 6 players can play simultaneously
   - [ ] Mutation logs converge within 100ms
   - [ ] Desyncs detected and recovered

3. **Economic Synthesis**:
   - [ ] Caravans form when economy > 75%
   - [ ] Caravans deliver cargo to destinations
   - [ ] NPCs migrate when economy < 25%
   - [ ] Economy health directly influences NPC behavior

---

## Architectural Diagram

```
Phase 27: Synthesis of Chaos
├── Paradox Engine (M59-A1)
│   ├── Violation detection (duplications, timeline breaks)
│   ├── Paradox point accumulation
│   ├── Age rot zone manifestation
│   └── Reality distortion anomalies
├── Oracle Consensus (M59-A2)
│   ├── Oracle role assignment
│   ├── Conflict detection & resolution
│   ├── Macro-event voting
│   └── Desync recovery
└── Economic Synthesis (M59-A3)
    ├── Caravan generation from prosperity
    ├── NPC migration from depression
    ├── Economy-behavior feedback loop
    └── Visible economic causality
```

---

## What's Next (Phase 28+)

**Phase 28: Narrative Engine Extensions** (estimated)
- Procedurally generated quests from world state
- NPC memory persistence across resets
- Dynamic dialogue based on faction/economy/scars

**Phase 29: Temporal Stabilization** (speculative)
- "Time repair" quests to heal paradoxes
- Blessed locations immune to age rot
- Ancient relics that stabilize causality

---

## Notes for Implementation

1. **Paradox Thresholds**: Start conservatively (100 pts per anomaly) for testing; adjust based on play sessions
2. **Caravan Economics**: Ensure caravans can be interrupted without soft-locking world state
3. **Oracle Failover**: If oracle player disconnects, randomly reassign role to next player
4. **Narrative Integration**: Each paradox/caravan/migration should have generateChronicleEntry() narrative

---

## References

- Phase 25 Task 4: Telemetry Engine → Data source for economy health
- Phase 26 Task 3: Social Outbursts → Triggers at high GST, creates scars
- Phase 24 Task 2: NPC Autonomy → NPCs avoid anomalies, join caravans
- Phase 23: Multiplayer → Foundation for 6-player oracle voting

---

**Next Action**: Begin Task 1 (Paradox Engine) implementation when ready.
