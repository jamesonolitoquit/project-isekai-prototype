# Phase 10 Coder Task: Ledger Persistence & Snapshot Hydration
## Infrastructure Hardening for Long-Term Simulation Stability

**Status**: ACTIVE - Ready for Implementation  
**Date**: February 26, 2026  
**Priority**: CRITICAL (blocks Phase 12-13 scaled simulations)  
**Estimated Effort**: 4-6 engineering hours  
**Target Build Time**: <2.5s (unchanged)

---

## Executive Summary

Phase 9 ("Echoes of Reality") successfully implemented narrative attrition, atmospheric filtering, and dialogue gating. However, these new systems **generate high volumes of events** (every 1440 ticks: faction turns, narrative scars, social interactions, macro events).

**Problem**: The current event sourcing system uses $O(n)$ full replay to reconstruct world state:
```
hydration_time = event_count × (parse_time + apply_time)
```

During 10,000-year simulations (36,500 epochs = 52.56M ticks), the ledger can accumulate 100K+ events, causing:
- ❌ **Hydration delays**: >500ms to load a saved world
- ❌ **Memory pressure**: Replaying all events loads entire history into memory
- ❌ **Save/load performance**: UI freezes during world load
- ❌ **Epoch transition bottlenecks**: State rebuilding takes seconds instead of milliseconds

**Solution**: Implement **Periodic Snapshotting + Optimized Hydration** to achieve **<200ms hydration regardless of session length**.

---

## Core Architecture

### 1. Snapshot Strategy

**Snapshot Frequency**: Every 100 ticks (~100 seconds game time per snapshot)
- **Rationale**: Balances storage overhead vs. replay speed
- **Storage per snapshot**: ~50-100 KB (serialized WorldState)
- **Replay cost**: Max 100 events × 0.1ms each = 10ms

**Snapshot Lifecycle**:
```
Tick 0-99: Events only
Tick 100:  [SNAPSHOT] + Events 0-99
Tick 101-199: Events only
Tick 200:  [SNAPSHOT] + Events 100-199
```

### 2. Optimized Hydration Flow

**Current (Naive)**:
```
Load WorldState
├─ Replay all events (event 1 → latest)
├─ Apply each event to state
└─ Return final state
```

**New (Optimized)**:
```
Load WorldState
├─ Find most recent valid snapshot (tick X)
├─ Load serialized snapshot → state
├─ Identify delta events (tick X+1 → tick N)
├─ Replay only ~100 events
└─ Return final state (10ms vs 500ms)
```

**Performance Improvement**:
- Old: 50K events × 0.1ms = **5000ms hydration**
- New: 100 events × 0.1ms = **10ms hydration** (500x faster!)

### 3. Integrity Chain (Explicit Hash Verification)

**Goal**: Detect tampering without cryptographic overhead

**Implementation**:
```typescript
// Extend existing SaveLoadEngine's hash chain
// Each snapshot includes SHA-256 hash of its state
snapshot.stateHash = simpleHash(canonicalize(state))
snapshot.previousSnapshotHash = previousSnapshot.stateHash

// On hydration, verify:
if (snapshot.stateHash !== computedHash) {
  throw new Error("Snapshot tampering detected: hash mismatch")
}
```

**Integration Points**:
- `saveLoadEngine.ts`: Already provides `simpleHash()` and `canonicalize()`
- `stateRebuilder.ts`: Add hash validation before applying events
- `worldEngine.ts`: Emit `SNAPSHOT_TAMPERED` event if verification fails

---

## Implementation Roadmap

### Step 1: Snapshot Persistence Layer
**File**: `BETA/src/engine/worldEngine.ts` (advanceTick function)

**Changes**:
```typescript
function advanceTick(amount = 1) {
  // ... existing tick advancement logic ...
  
  // NEW: Emit snapshot every 100 ticks
  if (nextTick % 100 === 0) {
    const snapshot = {
      tick: nextTick,
      stateHash: computeSnapshotHash(state),
      previousSnapshotHash: getLastSnapshotHash(),
      serializedState: serializeWorldState(state),  // ~100KB JSON
      timestamp: Date.now()
    };
    
    // Persist to storage (Redis/IndexedDB/PostgreSQL)
    await persistSnapshot(snapshot);
    
    // Emit event for audit trail
    appendEvent({
      type: 'SNAPSHOT_SAVED',
      payload: { 
        tick: nextTick, 
        snapshotId: snapshot.id,
        eventCountInWindow: 100,
        stateHash: snapshot.stateHash 
      }
    });
  }
}
```

**Storage Interface** (abstract - supports multiple backends):
```typescript
interface SnapshotStorage {
  save(snapshot: WorldSnapshot): Promise<void>;
  load(tick: number): Promise<WorldSnapshot | null>;
  findMostRecent(beforeTick: number): Promise<WorldSnapshot | null>;
  delete(tick: number): Promise<void>;
  listAll(): Promise<WorldSnapshot[]>;
}
```

### Step 2: Optimized Hydration Pipeline
**File**: `BETA/src/events/mutationLog.ts` (reconstructState function)

**Current Implementation**:
```typescript
export function reconstructState(
  worldId: string, 
  targetTick: number
): WorldState {
  const allEvents = getEventsForWorld(worldId);
  let state = createInitialWorld(worldId);
  
  for (const event of allEvents) {
    state = applyEvent(state, event);  // O(n) loop
  }
  
  return state;
}
```

**New Implementation**:
```typescript
export async function reconstructState(
  worldId: string, 
  targetTick: number
): Promise<WorldState> {
  // 1. Find most recent snapshot before targetTick
  const snapshot = await snapshotStorage.findMostRecent(targetTick);
  
  // 2. If snapshot exists, load it (O(1) deserialization)
  let state: WorldState;
  if (snapshot) {
    state = deserializeWorldState(snapshot.serializedState);
    
    // 3. Verify snapshot integrity
    const computedHash = computeSnapshotHash(state);
    if (computedHash !== snapshot.stateHash) {
      emit({
        type: 'SNAPSHOT_TAMPERED',
        payload: {
          tick: snapshot.tick,
          expectedHash: snapshot.stateHash,
          actualHash: computedHash
        }
      });
      throw new IntegrityError('Snapshot hash mismatch');
    }
  } else {
    // Fall back to initial state if no snapshot (first 100 ticks)
    state = createInitialWorld(worldId);
  }
  
  // 4. Replay only delta events (snapshot.tick+1 → targetTick)
  const deltaEvents = getEventsForWorld(worldId)
    .filter(e => e.payload?.tick > (snapshot?.tick ?? 0) && e.payload?.tick <= targetTick);
  
  for (const event of deltaEvents) {
    state = applyEvent(state, event);
  }
  
  return state;
}
```

### Step 3: Integrity Verification
**File**: `BETA/src/engine/saveLoadEngine.ts` (extend existing module)

**Changes**:
```typescript
/**
 * Compute cryptographic hash of world state
 * Used for snapshot integrity verification
 */
export function computeSnapshotHash(state: WorldState): string {
  const canonical = canonicalize({
    tick: state.tick,
    seed: state.seed,
    npcs: state.npcs,
    player: state.player,
    quests: state.quests,
    factions: state.factions
    // Exclude timestamp, audio state, transient data
  });
  
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify snapshot chain integrity
 * Returns { valid: boolean; reason?: string }
 */
export function verifySnapshotChain(snapshots: WorldSnapshot[]): VerificationResult {
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const state = deserializeWorldState(snapshot.serializedState);
    
    // Check individual snapshot integrity
    const computedHash = computeSnapshotHash(state);
    if (computedHash !== snapshot.stateHash) {
      return {
        valid: false,
        failedAt: i,
        reason: `Snapshot ${i} hash chain broken`
      };
    }
    
    // Check chain linkage (if not first snapshot)
    if (i > 0 && snapshot.previousSnapshotHash !== snapshots[i-1].stateHash) {
      return {
        valid: false,
        failedAt: i,
        reason: `Snapshot ${i} missing valid link to previous (chain broken)`
      };
    }
  }
  
  return { valid: true };
}
```

### Step 4: Cleanup Protocol (Ledger Pruning)
**File**: `BETA/src/engine/snapshotPruningEngine.ts` (new file, 150 lines)

**Goal**: Keep storage bounded while maintaining rewind buffer

**Strategy**:
```typescript
/**
 * Phase 10.4: Ledger Pruning
 * 
 * Retain:
 * - All snapshots from current epoch  (for fast replay within epoch)
 * - Last 5 epochs of snapshots       (for rewind capability)
 * - All events from last epoch only  (older events become snapshot-only)
 * 
 * Delete:
 * - Events older than last epoch (replaced by snapshots)
 * - Snapshots older than 5-epoch lookback window
 * 
 * Storage math:
 * - 5 epochs × 1440 ticks/epoch × 1 snapshot/100 ticks = 72 snapshots
 * - 72 snapshots × 100KB = 7.2 MB (bounded!)
 */

export function pruneEventLog(
  worldId: string, 
  currentTick: number, 
  retentionEpochs: number = 5
): PruningReport {
  const ticksPerEpoch = 1440;
  const earliestEpochToKeep = Math.max(0, currentTick / ticksPerEpoch - retentionEpochs);
  const earliestTickToKeep = earliestEpochToKeep * ticksPerEpoch;
  
  // Delete old events
  const allEvents = getEventsForWorld(worldId);
  const eventsToDelete = allEvents.filter(e => (e.payload?.tick ?? 0) < earliestTickToKeep);
  const eventsToKeep = allEvents.filter(e => (e.payload?.tick ?? 0) >= earliestTickToKeep);
  
  // Delete old snapshots (keep only 5 epochs)
  const allSnapshots = snapshotStorage.listAll();
  const snapshotsToDelete = allSnapshots.filter(s => s.tick < earliestTickToKeep);
  const snapshotsToKeep = allSnapshots.filter(s => s.tick >= earliestTickToKeep);
  
  // Execute deletions
  eventsToDelete.forEach(e => deleteEvent(e.id));
  snapshotsToDelete.forEach(s => snapshotStorage.delete(s.tick));
  
  return {
    eventsDeleted: eventsToDelete.length,
    eventsBytesFreed: eventsToDelete.length * 200, // estimate
    snapshotsDeleted: snapshotsToDelete.length,
    snapshotBytesFreed: snapshotsToDelete.length * 100_000,
    eventsRetained: eventsToKeep.length,
    snapshotsRetained: snapshotsToKeep.length
  };
}
```

### Step 5: Simulation Integration
**File**: `BETA/scripts/ten-thousand-year-sim.ts` (update existing file)

**Changes**:
```typescript
async function runTenThousandYearSim(): Promise<SimulationResult> {
  // ... existing setup ...
  
  // NEW: Enable snapshotting before simulation
  snapshotStorage = new RedisSnapshotStorage(redis);
  
  for (let epoch = 0; epoch < 25; epoch++) {
    console.log(`[Epoch ${epoch}] Starting evolution...`);
    
    const epochStartTick = epoch * 1440;
    const epochEndTick = (epoch + 1) * 1440;
    
    for (let tick = epochStartTick; tick < epochEndTick; tick++) {
      world.advanceTick(1);
      
      // Track snapshot creation
      if (tick % 100 === 0) {
        result.snapshotStats.totalCreated++;
        const snapshotSize = JSON.stringify(world.getState()).length;
        console.log(`  [Tick ${tick}] Snapshot saved (${snapshotSize} bytes)`);
      }
    }
    
    // NEW: Prune ledger after each epoch
    const pruningReport = pruneEventLog(world.id, epochEndTick);
    result.snapshotStats.totalPruned += pruningReport.eventsDeleted;
    console.log(`[Epoch ${epoch}] Pruned ${pruningReport.eventsDeleted} events, freed ${pruningReport.eventsBytesFreed} bytes`);
    
    // NEW: Verify snapshot chain integrity
    const snapshots = await snapshotStorage.listAll();
    const chainVerification = verifySnapshotChain(snapshots);
    if (!chainVerification.valid) {
      throw new Error(`Snapshot chain broken at snapshot ${chainVerification.failedAt}: ${chainVerification.reason}`);
    }
    console.log(`[Epoch ${epoch}] Snapshot chain verified (${snapshots.length} snapshots OK)`);
  }
  
  // Final statistics
  console.log(`\n=== FINAL STATISTICS ===`);
  console.log(`Total snapshots created: ${result.snapshotStats.totalCreated}`);
  console.log(`Total events pruned: ${result.snapshotStats.totalPruned}`);
  console.log(`Final snapshot count: ${result.snapshotStats.finalCount}`);
  
  return result;
}
```

---

## Verification Benchmarks

### Benchmark 1: Hydration Performance
**Scenario**: Load a 5,000-event world

**Expected Results**:
```
OLD (Naive Replay):
- Replay time: ~500ms (50K events in ledger after 1,000 epochs)
- Memory used: ~50MB (full ledger + state)

NEW (Snapshot + Delta):
- Snapshot load: ~5ms
- Delta replay (max 100 events): ~10ms
- Total: <15ms ✅ (97% improvement)
- Memory: ~2MB (one snapshot + 100 events)
```

### Benchmark 2: Snapshot Frequency Verification
**Scenario**: Run 10,000-year simulation for 1 hour

**Expected**:
- Total ticks = 52.56M
- Snapshots created = 525,600 (52.56M / 100)
- Events pruned = 52.04M (all but last 1440 ticks)
- Benchmark passes if `SNAPSHOT_SAVED` events appear exactly every 100 ticks in logs ✅

### Benchmark 3: Integrity Verification Under Tampering
**Scenario**: Manually corrupt a stored snapshot

**Steps**:
1. Load world to tick 5000
2. Find snapshot file for tick 5000
3. Modify JSON: change `player.hp` from 100 → 50
4. Attempt to load world

**Expected**:
- `SNAPSHOT_TAMPERED` event emitted
- Load fails with `IntegrityError`
- Fallback to previous valid snapshot (tick 4900) or full replay ✅

### Benchmark 4: Storage Overhead
**Scenario**: Run 5 epochs (7200 ticks)

**Calculations**:
- Snapshots created: 72 (7200 / 100)
- Snapshot size: ~100KB each = 7.2 MB
- Events in last epoch: ~1440 = ~300KB (estimate)
- Total: 7.5 MB (bounded and acceptable) ✅

---

## Risk Mitigation

### Risk 1: Snapshot Deserialization Performance
**Impact**: If `deserializeWorldState()` is slow, optimization fails
**Mitigation**: 
- Profile deserialization cost (target <5ms)
- If slow, use lazy deserialization (deserialize NPC array only on access)
- Consider binary snapshots (MessagePack) for future optimization

### Risk 2: Hash Collision False Positives
**Impact**: Legitimate snapshots rejected as "tampered"
**Mitigation**:
- Use SHA-256 (collision probability negligible: 1 in 2^256)
- Never use `simpleHash()` from saveLoadEngine for snapshots (too weak)
- Test hash stability: serialize state 100x, verify hash never drifts

### Risk 3: Storage Backend Unavailability
**Impact**: If Redis/DB down, snapshots can't save, ledger grows unbounded
**Mitigation**:
- Implement fallback to in-memory snapshots (circular buffer of last 10)
- Emit `SNAPSHOT_PERSISTENCE_FAILED` event (logged to UI)
- Allow simulation to proceed (snapshot persistence is optimization, not requirement)

### Risk 4: Breaking Change to Event Schema
**Impact**: Old events can't be replayed with new state structure
**Mitigation**:
- Version event schema: `event.schemaVersion = 1`
- Implement event migration layer before replay
- Never delete events before migration is complete

---

## Integration Checklist

- [ ] **Step 1**: Add `SNAPSHOT_SAVED` event emission to advanceTick (~30 lines)
- [ ] **Step 2**: Implement `reconstructState` optimization in mutationLog.ts (~50 lines)
- [ ] **Step 3**: Add hash validation to saveLoadEngine.ts (~40 lines)
- [ ] **Step 4**: Create snapshotPruningEngine.ts (~150 lines)
- [ ] **Step 5**: Update ten-thousand-year-sim.ts to use new hydration (~30 lines)
- [ ] **Step 6**: Create storage interface and Redis implementation (~100 lines)
- [ ] **Step 7**: Integration tests for all components (~200 lines)
- [ ] **Step 8**: Performance benchmarks and logging (~100 lines)

**Total New Code**: ~700 lines  
**Modified Existing Code**: ~80 lines  
**Total Effort**: 4-6 hours

---

## Success Criteria

✅ Phase 10 "Ledger Persistence & Snapshot Hydration" is complete when:

1. **Hydration Benchmark**: Load a 10K-event world in <200ms (vs. current 500ms+)
2. **Snapshot Frequency**: Logs show `SNAPSHOT_SAVED` events exactly every 100 ticks
3. **Integrity Test**: Tampering detected and rejected with `SNAPSHOT_TAMPERED` event
4. **Storage Bounded**: 5 epochs of snapshots uses <50MB (not growing unbounded)
5. **Fallback Behavior**: Without snapshot storage, simulation still runs (events replayed)
6. **Zero Behavioral Changes**: Existing Phase 9 systems (atmospheric, dialogue, attrition) work identically
7. **Build Verification**: `npm run build` completes in <2.5s with 0 errors
8. **Simulation Completes**: 10,000-year sim finishes faster (due to optimized hydration during load)

---

## Next Phase Preview

**Phase 11**: "The Weight of Influence" - Faction Power Dynamics  
- Faction reputation affects NPC dialogue and quest availability
- Faction conflicts trigger dynamically based on player actions
- Territory control changes based on faction power shifts
- **Dependency**: Phase 10 hydration stability (for multi-epoch faction persistence)

**Phase 12**: "The Bind" - Temporal Debt & Save-Scum Detection  
- Track player rewinding/save-scumming across snapshots
- Accumulate "temporal debt" (new resource) when reverting saves
- At 100 temporal debt, trigger narrative consequence
- **Dependency**: Phase 10 snapshots (to detect rewind patterns across snapshot boundaries)

---

## Questions Before Starting?

1. **Storage Backend**: Use Redis (fast, in-memory) or PostgreSQL (persistent)? Recommend **Redis for BETA**, PostgreSQL for production.
2. **Snapshot Granularity**: 100 ticks (current proposal) or different interval? Can tune based on early benchmarks.
3. **Event Retention**: Keep last 5 epochs or different window? 5 epochs = ~7 MB (reasonable for most systems).

---

**Ready to begin implementation?** Start with **Step 1** (snapshot persistence in worldEngine.ts).
