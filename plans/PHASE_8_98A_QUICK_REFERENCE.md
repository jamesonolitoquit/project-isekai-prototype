# Stage 8.98a Quick Reference - Running Paradox Flood Tests

## Direct Test Execution

### In Node REPL or Jest Test Suite

```typescript
import { runParadoxFloodTestSuite } from './src/engine/paradox-flood-test';

// Run all 4 tests and get aggregate results
const results = await runParadoxFloodTestSuite();

console.log(results.summary);
console.log(results.allResults);
console.log(`Overall: ${results.overallPassed ? '✓ PASSED' : '✗ FAILED'}`);
```

### Individual Test Execution

```typescript
import { paradoxFloodTests } from './src/engine/paradox-flood-test';

// Test 1: Concurrency (Queue Capacity)
const test1 = await paradoxFloodTests.testConcurrency();
console.log(`Test 1: ${test1.passed ? '✓' : '✗'} ${test1.message}`);

// Test 2: Paradox Scaling (Narrative Friction)
const test2 = await paradoxFloodTests.testParadoxScaling();
console.log(`Test 2: ${test2.passed ? '✓' : '✗'} ${test2.message}`);

// Test 3: State Integrity (Merkle Tree)
const test3 = await paradoxFloodTests.testStateIntegrity();
console.log(`Test 3: ${test3.passed ? '✓' : '✗'} ${test3.message}`);

// Test 4: UIPerception Ghosting (Information Lag)
const test4 = await paradoxFloodTests.testUIPerceptionGhosting();
console.log(`Test 4: ${test4.passed ? '✓' : '✗'} ${test4.message}`);
```

---

## Manual Testing: Custom Intent Flow

### Create a Custom Intent

```typescript
import type { PlayerIntent } from './src/engine/ResolutionStack';

const customIntent: PlayerIntent = {
  actorId: 'player-1',
  actionType: 'custom',
  submittedAtTick: 1000,
  customPrompt: 'I want to swing from the chandelier and kick the guards',
  narrativeWeight: 0.75,  // Medium complexity
  isCustom: true,
};
```

### Submit to Engine

```typescript
import { EngineOrchestrator } from './src/engine/EngineOrchestrator';

const orchestrator = new EngineOrchestrator(config);
await orchestrator.initialize(worldTemplate);

// Execute one tick with custom intent
const result = await orchestrator.step(customIntent);

console.log(`Tick result: ${result?.message}`);
```

### Submit Burst (50 intents)

```typescript
import { ResolutionStack } from './src/engine/ResolutionStack';

const stack = new ResolutionStack();
const intents = generateFlood(); // Helper function in paradox-flood-test.ts

// Submit all at once
const { accepted, dropped } = stack.submitIntent(intents);
console.log(`Accepted: ${accepted}, Dropped: ${dropped}`);

// Queue stats
const stats = stack.getQueueStats();
console.log(`Queue size: ${stats.queueSize}/${stats.maxQueueSize}`);
```

---

## Integration with ActionTray UI

### Playing a Card with Custom Prompt

```typescript
import { usePlayerHand } from './src/client/hooks/usePlayerHand';

const { playCard } = usePlayerHand(deps);

// Standard card click
await playCard(0);

// Card click with custom override
await playCard(0, 'Attack weakly to conserve energy');

// Result: Dispatches PLAY_CARD with:
// {
//   abilityId: 'attack',
//   customPrompt: 'Attack weakly to conserve energy',
//   narrativeWeight: 1.0,
//   isCustom: true
// }
```

---

## Expected Test Output

### Successful Run

```
========================================
PARADOX FLOOD STRESS TEST SUITE (Stage 8.98a)
========================================

[Paradox Flood Test 1] Starting Concurrency Test...
[Paradox Flood Test 1] Complete (3ms): ✓ All 50 intents buffered successfully

[Paradox Flood Test 2] Starting Paradox Scaling Test...
[Paradox Flood Test 2] Complete (12ms): ✓ Paradox accumulation stable: weight 24.5, debt 24

[Paradox Flood Test 3] Starting State Integrity Test...
[Paradox Flood Test 3] Complete (25ms): ✓ StateHash remains consistent through flood

[Paradox Flood Test 4] Starting UIPerception Ghosting Test...
[Paradox Flood Test 4] Complete (8ms): ✓ 3 info peek attempts were obfuscated (lag multiplier: 2.00x)

========================================
RESULTS: 4/4 tests passed
Total Execution Time: 48ms
Total Intents Processed: 150
Total Intents Dropped: 0
✓ ALL TESTS PASSED
========================================
```

---

## Key Metrics to Monitor

### Queue Stats

```typescript
interface QueueStats {
  queueSize: number;          // Current queue depth (0-100)
  totalProcessed: number;      // Cumulative intents handled
  totalDropped: number;        // Overflow rejections (should be 0)
  maxQueueSize: number;        // Capacity (100)
}
```

### Paradox Metrics

```typescript
// From FloodTestResult
totalNarrativeWeight: number;       // Sum of all intent weights (should be ~25 for 50 intents)
realityFaultTriggered: boolean;     // True if weight > 30 threshold
paradoxDebtAtEnd: number;           // Final debt on tracker (0-100)
```

### Performance Metrics

```typescript
executionTimeMs: number;            // Total test execution time (<100ms desired)
ticksProcessed: number;             // How many tick equivalents ran
```

---

## CI/CD Integration

### Jest Configuration

```typescript
// jest.config.js
module.exports = {
  testMatch: ['**/*.test.ts', '**/*-test.ts'],
  testTimeout: 10000,
};

// Run with:
// npm test -- paradox-flood-test.ts
```

### Add to package.json

```json
{
  "scripts": {
    "test:paradox-flood": "node -r ts-node/register src/engine/paradox-flood-test.ts",
    "test:all": "jest && npm run test:paradox-flood"
  }
}
```

---

## Troubleshooting

### Test Fails: "Intent loss detected: X dropped"

**Cause**: Queue full (submitting >100 intents at once)

**Fix**: Increase `maxQueueSize` in ResolutionStack constructor or submit in batches

### Test Fails: "Hash corruption detected"

**Cause**: PersistenceManager not recording mutations correctly

**Fix**: Verify PersistenceManager is initialized before tests run

### Test Fails: "REALITY_FAULT triggered incorrectly"

**Cause**: Paradox debt calculation differs from expected

**Fix**: Verify paradox weight threshold (default: 30.0) and paradox debt formula

---

## Future Enhancements

1. **Configurable Queue Size**: Make `maxQueueSize` adjustable per-world
2. **Intent Prioritization**: Add priority scores to process urgent intents first
3. **Batch Processing**: Submit intents in configurable batch sizes
4. **Metrics Export**: Add Prometheus-compatible metrics for monitoring
5. **LLM Synthesis**: Integrate ChatGPT for complex intent interpretation

---

**Quick Links**:
- Implementation: [PHASE_8_98A_PLAYER_INTENT_EXPANSION_COMPLETE.md](../PHASE_8_98A_PLAYER_INTENT_EXPANSION_COMPLETE.md)
- Source: [paradox-flood-test.ts](./src/engine/paradox-flood-test.ts)
- Types: [ResolutionStack.ts](./src/engine/ResolutionStack.ts)
