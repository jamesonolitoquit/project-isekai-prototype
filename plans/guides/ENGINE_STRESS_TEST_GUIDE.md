# ENGINE STRESS TEST & PERFORMANCE PROFILING - M48-A5

## Objective
Validate that the ALPHA engine can maintain 60+ FPS during heavy simulation and sensory effect rendering. Stress-test the belief engine, faction engine, and sensory layer under realistic gameplay conditions.

---

## PRE-STRESS TEST SETUP

### Browser Performance Tools:
1. Open DevTools: `F12`
2. Navigate to **Performance** tab
3. Also keep **Console** open to monitor for errors

### Baseline Measurements:
Before stress testing, document baseline metrics:
- [ ] Idle FPS (no interaction): _____ FPS
- [ ] Menu navigation FPS: _____ FPS  
- [ ] Normal dialogue FPS: _____ FPS
- [ ] Memory usage baseline: _____ MB
- [ ] CPU time baseline: _____ ms

---

## STRESS TEST 1: TIME ACCELERATION (24-HOUR CYCLE)

### Purpose:
Test belief engine and faction engine under rapid time advancement. This triggers batch updates for rumors, faction standings, and NPC social memories.

### Prerequisites:
- ✅ Game started with NPCs present
- ✅ At least 3-5 NPCs with relationships established
- ✅ Belief registry populated with rumors

### Test Procedure:

1. **Locate time control**:
   - Look for "Time" or "Epoch" display in UI
   - Find time advancement button (if available)
   - Alternative: Check if there's developer console to advance time

2. **Advance time by +24 hours**:
   - Set time to advance by 1 day
   - Or manually call `advanceTime(24 * 60)` if console available
   - Monitor performance during advancement

3. **Record metrics during advancement**:
   - **Observation 1**: Frame rate during time skip
     - Target: 60 FPS or smooth > 30 FPS
     - Watch for: Stutters, frame drops, freezes
   - **Observation 2**: Engine processing
     - Watch console for: Batch update logs
     - Count: Number of rumor updates
     - Count: Number of faction updates
   - **Observation 3**: Memory changes
     - Check DevTools Memory before/after
     - Calculate memory delta: _____ MB

4. **After time advancement**:
   - Verify game state still responsive
   - Check that beliefs updated correctly
   - Verify NPC social graphs updated
   - Monitor frame rate returns to normal

### Expected Results:
- ✅ Time advancement completes in < 500ms
- ✅ Frame rate drops minimally during calculation
- ✅ No permanent frame rate degradation after
- ✅ Memory increase < 50 MB (temporary)
- ✅ All calculations complete without errors

### Data Flow During Time Acceleration:
```
World.advanceTime(+1440 minutes)
  ↓
beliefEngine.propagateGossip()
  ├─ Update rumor distortion levels
  ├─ Calculate new confidence scores
  └─ Process NPC memory updates
  ↓
factionEngine.updateFactionStandings()
  ├─ Process warfare events
  ├─ Update territorial control
  └─ Trigger relevant macroEvents
  ↓
npcSocialAutonomyEngine.updateNPCInteractions()
  ├─ Process queued interactions
  ├─ Update relationship values
  └─ Generate new rumors from interactions
  ↓
UI refresh
  └─ RumorMillUI, Politics tab updates
```

---

## STRESS TEST 2: SENSORY EFFECT INTENSITY (Reality Thinning)

### Purpose:
Test GPU performance during heavy visual effects. Verify chromatic aberration, glitch effects, and paradox visualizations don't cause frame rate collapse.

### Prerequisites:
- ✅ `paradoxDebt` > 50 (to trigger strong effects)
- ✅ PerceptionGlitchOverlay active
- ✅ Multiple sensory layers rendering simultaneously

### Test Procedure:

1. **Enable heavy sensory effects**:
   - Increase `paradoxDebt` to 80-100
   - Alternatively, find "Reality Thinning" toggle if available
   - Enable all visual layers: chromatic aberration, glitch, distortion

2. **Trigger simultaneous effects**:
   - Open EnhancedDialogPanel
   - Initiate NPC dialogue
   - Monitor framerate during heavy shader application

3. **Measure performance metrics**:
   - **Metric 1**: GPU frame time
     - Open DevTools → Rendering tab
     - Observe frame rendering time
     - Target: < 16ms per frame (60 FPS = 16.67ms per frame)
     - Recording: _____ ms average frame time
   - **Metric 2**: CPU time
     - Observe CPU spending time on effects
     - Target: < 10ms CPU time for shader work
     - Recording: _____ ms
   - **Metric 3**: Frame rate stability
     - Count frames per second
     - Calculate FPS variance
     - Target: ±5 FPS variance max
     - Recording: _____ FPS average, _____ FPS minimum

4. **Stress test variations**:
   - a) Sensory effects alone: _____ FPS
   - b) Heavy simultaneous dialogue: _____ FPS  
   - c) Multiple NPCs with effects: _____ FPS
   - d) Map rendering + effects: _____ FPS

### Expected Results:
- ✅ Frame rate maintained ≥ 30 FPS minimum
- ✅ Target 60 FPS achieved in most conditions
- ✅ No visible stuttering or frame pacing issues
- ✅ GPU shader compilation time < 100ms
- ✅ Canvas rendering < 5ms per frame

### Components Under Load:
```
PerceptionGlitchOverlay
  ├─ Canvas shader computation
  ├─ Chromatic aberration filter
  ├─ Text glitch distortion
  └─ Paradox glow effect

EnhancedDialogPanel  
  ├─ Dialogue text rendering
  ├─ Personality badge rendering
  └─ Sentiment visualization

Visual effects pipeline:
  ├─ CSS transforms + GPU acceleration
  ├─ Canvas 2D context rendering
  ├─ Shader computation (if WebGL used)
  └─ DOM re-renders (React reconciliation)
```

---

## STRESS TEST 3: SIMULATION COMPLEXITY (Full World)

### Purpose:
Test all engines running simultaneously with maximum simulation complexity. Verify no performance collapses with large NPC counts and decision-making.

### Prerequisites:
- ✅ Multiple NPCs (10+) with active relationships
- ✅ Multiple factions with competing interests
- ✅ World with 20+ discoverable locations
- ✅ Active quests and narrative threads

### Test Procedure:

1. **Establish complex world state**:
   - Interact with multiple NPCs (5-10 conversations)
   - Travel between multiple locations
   - Trigger multiple faction interactions
   - Generate multiple active rumors

2. **Run simulation with all engines**:
   - Advance time while observing performance
   - Have NPCs actively interacting
   - Track simultaneous processes:
     - Belief propagation
     - Faction warfare
     - NPC social autonomy
     - Quest synthesis
     - Narrative whispers

3. **Measure aggregate performance**:
   - **Total engine time**: _____ ms per update
   - **Slowest single engine**: _____ (name: _____ ms)
   - **Memory usage peak**: _____ MB
   - **Frame rate sustained**: _____ FPS average

4. **Identify performance bottlenecks**:
   - Which engine consumes most CPU time?
   - Which component causes most memory allocation?
   - Are there any algorithmic inefficiencies?
   - Are there any redundant calculations?

### Expected Results:
- ✅ Full simulation runs in < 100ms per update
- ✅ No engine takes > 30ms individual time
- ✅ Frame rate maintained > 30 FPS
- ✅ Memory stable (no continuous growth)
- ✅ Identify top 3 performance bottlenecks

### Profiling Strategy:
```
In DevTools Performance tab:
1. Click "Record"
2. Trigger time advancement
3. Wait for simulation completion
4. Click "Stop"
5. Analyze flame chart:
   - Find longest bars (slowest code)
   - Identify which engines/functions
   - Note timing in milliseconds
6. Screenshot results for documentation
```

---

## PERFORMANCE TARGETS

| Metric | Target | Minimum Acceptable | Current |
|--------|--------|-------------------|---------|
| Idle FPS | 60 | 30 | _____ |
| Dialogue FPS | 60 | 30 | _____ |
| Effect FPS | 60 | 30 | _____ |
| Time advance (24h) | < 500ms | < 2000ms | _____ |
| Engine update | < 100ms | < 300ms | _____ |
| Memory baseline | < 200 MB | < 400 MB | _____ |
| Shader compile | < 100ms | < 500ms | _____ |
| React reconcile | < 16ms | < 33ms | _____ |

---

## PROFILING CHECKLIST

### Before Profiling:
- [ ] Browser cache cleared
- [ ] DevTools open with Performance tab ready
- [ ] Console cleared of previous logs
- [ ] Game in stable state (not error state)
- [ ] Dev extensions disabled (if possible)

### During Profiling:
- [ ] Record baseline (no stress)
- [ ] Record Time Acceleration test
- [ ] Record Sensory Effects test
- [ ] Record Full Simulation test
- [ ] Take screenshots of flame charts

### After Profiling:
- [ ] Export profiles for analysis
- [ ] Document bottleneck findings
- [ ] Note any errors in console
- [ ] Check for memory leaks
- [ ] Record all metrics

---

## RESULTS DOCUMENTATION

After completing all stress tests, document:

### Performance Summary:
- Overall assessment: 🟢 Excellent / 🟡 Good / 🔴 Poor
- FPS achieved: _____ (target: 60)
- Memory usage: _____ MB (target: < 200 MB)
- Top bottleneck: _____ (engine/function name)
- Time to optimize: _____ (brief description)

### Test Results:

**Test 1 - Time Acceleration**:
- Time to complete: _____ ms
- Frame rate during: _____ FPS
- Peak memory: _____ MB
- Status: ✅ PASS / ⚠️ MARGINAL / ❌ FAIL

**Test 2 - Sensory Effects**:
- Average FPS: _____ FPS
- Minimum FPS: _____ FPS
- GPU frame time: _____ ms
- Status: ✅ PASS / ⚠️ MARGINAL / ❌ FAIL

**Test 3 - Full Simulation**:
- Engine total time: _____ ms
- Slowest engine: _____ (_____ ms)
- Memory peak: _____ MB
- Status: ✅ PASS / ⚠️ MARGINAL / ❌ FAIL

### Recommended Optimizations:
1. _____ (identified optimization opportunity)
2. _____ (identified optimization opportunity)
3. _____ (identified optimization opportunity)

---

## PERFORMANCE OPTIMIZATION TIPS

If performance is below target:

1. **CPU Optimization**:
   - Reduce NPC update frequency (e.g., every 2 ticks instead of each tick)
   - Cache expensive calculations
   - Use memoization for belief propagation
   - Profile with DevTools to find hot spots

2. **GPU Optimization**:
   - Use requestAnimationFrame efficiently
   - Minimize canvas redraws
   - Use CSS transforms instead of layout changes
   - Consider WebGL for complex effects

3. **Memory Optimization**:
   - Clear old rumor entries
   - Pool and reuse objects
   - Implement garbage collection strategies
   - Monitor for reference leaks

4. **React Optimization**:
   - Use React.memo for expensive components
   - Implement key props correctly
   - Avoid unnecessary re-renders
   - Lazy load components if applicable

---

## SUCCESS CRITERIA FOR M48-A5

Performance testing passes when:

✅ **Baseline**: 60 FPS during normal gameplay  
✅ **Time Acceleration**: Completes in < 500ms without significant FPS drop  
✅ **Sensory Effects**: Maintains > 30 FPS with heavy visual effects  
✅ **Full Simulation**: All engines < 100ms combined  
✅ **Memory**: No unbounded growth, < 300 MB peak  
✅ **Stability**: Zero crashes or errors under stress  

---

*End of Engine Stress Test & Performance Profiling Guide*  
*Part of M48-A5: Production Stability & Sensory Verification*
