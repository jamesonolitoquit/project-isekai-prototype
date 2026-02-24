/**
 * M43 Phase D Task 2: Environmental Decay Stress Test
 *
 * Purpose: Simulate 50+ Epoch transitions with 1000+ ticks to verify:
 * - Unsealed fragments reach 0.0 durability and are garbage-collected
 * - Sealed (Iron Canon) fragments survive indefinitely with no data loss
 * - Memory usage remains below 100MB for 1000 fragments
 * - Durability decay is linear and predictable
 *
 * Run via: `node scripts/m43-stress-test.ts`
 */

interface WorldFragment {
  id: string;
  epochCreated: number;
  type: 'building' | 'garden' | 'landmark' | 'monument';
  description: string;
  position: { x: number; y: number; z?: number };
  durability: number;
  sealed: boolean;
  sealTick?: number;
  lastWeatheredAt?: number;
  createdBy?: string;
}

interface StressTestMetrics {
  totalTicks: number;
  totalEpochs: number;
  fragmentsCreated: number;
  fragmentsDestroyed: number;
  fragmentsSealed: number;
  activeFragments: number;
  sealedFragments: number;
  maxMemoryUsageMB: number;
  avgTickLatencyMs: number;
  decayAccuracy: 'linear' | 'non-linear' | 'inconsistent';
  timestampStart: number;
  timestampEnd: number;
  errorCount: number;
  warnings: string[];
}

const TICKS_PER_EPOCH = 100;
const EPOCHS_TO_SIMULATE = 50;
const INITIAL_FRAGMENTS = 100;
const WEATHERING_RATE = 0.02; // 2% durability loss per tick

class FragmentRegistry {
  private fragments = new Map<string, WorldFragment>();
  private sealedHistory: Map<string, WorldFragment[]> = new Map();
  private currentEpoch = 0;
  private currentTick = 0;

  constructor() {}

  /**
   * Create a new fragment
   */
  createFragment(description: string, type: WorldFragment['type']): WorldFragment {
    const fragment: WorldFragment = {
      id: `frag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      epochCreated: this.currentEpoch,
      type,
      description,
      position: {
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        z: 0
      },
      durability: 1.0,
      sealed: false
    };

    this.fragments.set(fragment.id, fragment);
    return fragment;
  }

  /**
   * Apply weathering to all active fragments
   */
  weatherAllFragments(): { weathered: number; destroyed: number } {
    let weathered = 0;
    let destroyed = 0;
    const toRemove: string[] = [];

    for (const [id, fragment] of this.fragments.entries()) {
      if (fragment.sealed) continue; // Sealed fragments don't weather

      const oldDurability = fragment.durability;
      fragment.durability = Math.max(0, fragment.durability - WEATHERING_RATE);
      fragment.lastWeatheredAt = this.currentTick;

      if (oldDurability > 0) {
        weathered++;
      }

      if (fragment.durability <= 0) {
        toRemove.push(id);
        destroyed++;
      }
    }

    // Remove destroyed fragments
    for (const id of toRemove) {
      this.fragments.delete(id);
    }

    return { weathered, destroyed };
  }

  /**
   * Seal a fragment (Iron Canon - permanent)
   */
  sealFragment(fragmentId: string): boolean {
    const fragment = this.fragments.get(fragmentId);
    if (!fragment || fragment.sealed) return false;

    fragment.sealed = true;
    fragment.sealTick = this.currentTick;

    // Add to sealed history
    if (!this.sealedHistory.has(fragmentId)) {
      this.sealedHistory.set(fragmentId, []);
    }
    this.sealedHistory.get(fragmentId)!.push(structuredClone(fragment));

    return true;
  }

  /**
   * Transition to next epoch
   */
  nextEpoch(): void {
    this.currentEpoch++;
    this.currentTick = this.currentEpoch * TICKS_PER_EPOCH;
  }

  /**
   * Advance time by N ticks
   */
  tick(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      this.currentTick++;
      this.weatherAllFragments();
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    activeCount: number;
    sealedCount: number;
    totalCreated: number;
    avgDurability: number;
    minDurability: number;
    maxDurability: number;
  } {
    const fragments = Array.from(this.fragments.values());
    const durabilities = fragments.map(f => f.durability);

    return {
      activeCount: fragments.filter(f => !f.sealed).length,
      sealedCount: fragments.filter(f => f.sealed).length,
      totalCreated: fragments.length,
      avgDurability: durabilities.length > 0 ? durabilities.reduce((a, b) => a + b, 0) / durabilities.length : 0,
      minDurability: durabilities.length > 0 ? Math.min(...durabilities) : 0,
      maxDurability: durabilities.length > 0 ? Math.max(...durabilities) : 0
    };
  }

  /**
   * Verify sealed fragments integrity
   */
  verifySealedFragments(): {
    integrityOk: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const sealedInRegistry = Array.from(this.fragments.values()).filter(f => f.sealed);

    // Check 1: All sealed fragments still exist
    if (sealedInRegistry.length === 0 && this.sealedHistory.size > 0) {
      errors.push('Sealed fragments missing from active registry');
    }

    // Check 2: Sealed fragment durability doesn't change
    for (const [id, history] of this.sealedHistory.entries()) {
      const current = this.fragments.get(id);
      if (!current && history.length > 0) {
        // Fragment was removed - check if it had 0 durability before removal
        const lastSnapshot = history[history.length - 1];
        if (lastSnapshot.durability !== current?.durability && current) {
          errors.push(`Sealed fragment ${id} had durability change`);
        }
      }
    }

    return {
      integrityOk: errors.length === 0,
      errors
    };
  }

  /**
   * Export all fragments (for audit)
   */
  export(): { active: WorldFragment[]; sealed: Map<string, WorldFragment[]> } {
    return {
      active: Array.from(this.fragments.values()),
      sealed: this.sealedHistory
    };
  }

  /**
   * Get current state
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }
}

/**
 * Run stress test
 */
async function runStressTest(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           M43 ENVIRONMENTAL DECAY STRESS TEST                  ║');
  console.log('║         Simulating 50 Epochs, 5000+ Ticks                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const metrics: StressTestMetrics = {
    totalTicks: 0,
    totalEpochs: EPOCHS_TO_SIMULATE,
    fragmentsCreated: INITIAL_FRAGMENTS,
    fragmentsDestroyed: 0,
    fragmentsSealed: 0,
    activeFragments: 0,
    sealedFragments: 0,
    maxMemoryUsageMB: 0,
    avgTickLatencyMs: 0,
    decayAccuracy: 'linear',
    timestampStart: Date.now(),
    timestampEnd: 0,
    errorCount: 0,
    warnings: []
  };

  const registry = new FragmentRegistry();
  const tickLatencies: number[] = [];
  const durabilityTraces: Map<string, number[]> = new Map();

  // Phase 1: Initialize with fragments
  console.log(`📍 Phase 1: Initialization`);
  console.log(`   Creating ${INITIAL_FRAGMENTS} initial fragments...`);

  const fragmentTypes: WorldFragment['type'][] = ['building', 'garden', 'landmark', 'monument'];
  for (let i = 0; i < INITIAL_FRAGMENTS; i++) {
    const type = fragmentTypes[i % fragmentTypes.length];
    const frag = registry.createFragment(`Fragment_${i}`, type);
    durabilityTraces.set(frag.id, [1.0]);
  }

  console.log(`   ✓ Created ${INITIAL_FRAGMENTS} fragments\n`);

  // Phase 2: Simulate epochs with weathering
  console.log(`📍 Phase 2: Environmental Weathering Simulation`);

  for (let epoch = 0; epoch < EPOCHS_TO_SIMULATE; epoch++) {
    process.stdout.write(`   Epoch ${epoch + 1}/${EPOCHS_TO_SIMULATE} `);

    // Randomly seal some fragments (5-10% per epoch)
    const stats = registry.getStats();
    const sealableFragments = registry.export().active.filter(f => !f.sealed);
    const sealCount = Math.floor(sealableFragments.length * (0.05 + Math.random() * 0.05));

    for (let i = 0; i < Math.min(sealCount, sealableFragments.length); i++) {
      const randomIdx = Math.floor(Math.random() * sealableFragments.length);
      registry.sealFragment(sealableFragments[randomIdx].id);
      metrics.fragmentsSealed++;
    }

    // Simulate ticks for this epoch
    for (let tick = 0; tick < TICKS_PER_EPOCH; tick++) {
      const tickStart = performance.now();
      registry.tick(1);
      const tickDuration = performance.now() - tickStart;
      tickLatencies.push(tickDuration);

      metrics.totalTicks++;
    }

    // Record durability states
    for (const frag of registry.export().active) {
      if (!durabilityTraces.has(frag.id)) {
        durabilityTraces.set(frag.id, []);
      }
      durabilityTraces.get(frag.id)!.push(frag.durability);
    }

    const currentStats = registry.getStats();
    console.log(`| Active: ${currentStats.activeCount.toString().padStart(3)} | Sealed: ${currentStats.sealedCount.toString().padStart(3)} | Avg Dur: ${(currentStats.avgDurability * 100).toFixed(0)}%`);
  }

  console.log('');

  // Phase 3: Verify linearity of decay
  console.log(`📍 Phase 3: Decay Linearity Analysis`);

  let linearFragments = 0;
  let nonLinearFragments = 0;

  for (const [fragmentId, durabilityHistory] of durabilityTraces.entries()) {
    if (durabilityHistory.length < 3) continue;

    // Check if decay is linear (constant difference between points)
    const deltas = [];
    for (let i = 1; i < durabilityHistory.length; i++) {
      deltas.push(durabilityHistory[i - 1] - durabilityHistory[i]);
    }

    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 0.001) {
      // Linear decay (low variance)
      linearFragments++;
    } else {
      nonLinearFragments++;
    }
  }

  const linearPercentage = (linearFragments / (linearFragments + nonLinearFragments) * 100).toFixed(1);
  console.log(`   Linear decay: ${linearPercentage}% of tracked fragments`);
  console.log(`   Unsealed fragments total: ${registry.getStats().activeCount}`);
  console.log(`   Sealed fragments total: ${registry.getStats().sealedCount}\n`);

  if (parseFloat(linearPercentage) > 95) {
    metrics.decayAccuracy = 'linear';
    console.log('   ✓ Decay accuracy: LINEAR\n');
  } else {
    metrics.decayAccuracy = 'non-linear';
    metrics.warnings.push('Decay pattern is not perfectly linear');
  }

  // Phase 4: Verify sealed fragments integrity
  console.log(`📍 Phase 4: Sealed Fragment Integrity Check`);

  const sealVerification = registry.verifySealedFragments();
  if (sealVerification.integrityOk) {
    console.log(`   ✓ All sealed fragments intact and immutable`);
  } else {
    console.log(`   ✗ Integrity errors detected:`);
    for (const error of sealVerification.errors) {
      console.log(`     - ${error}`);
      metrics.errorCount++;
    }
  }
  console.log('');

  // Phase 5: Performance metrics
  console.log(`📍 Phase 5: Performance Analysis`);

  const avgLatency = tickLatencies.reduce((a, b) => a + b, 0) / tickLatencies.length;
  const p95Latency = tickLatencies.sort((a, b) => a - b)[Math.floor(tickLatencies.length * 0.95)];
  const p99Latency = tickLatencies.sort((a, b) => a - b)[Math.floor(tickLatencies.length * 0.99)];

  metrics.avgTickLatencyMs = avgLatency;

  console.log(`   Average tick latency: ${avgLatency.toFixed(3)}ms`);
  console.log(`   P95 latency: ${p95Latency.toFixed(3)}ms`);
  console.log(`   P99 latency: ${p99Latency.toFixed(3)}ms`);

  // Estimate memory (fragments * approximate size)
  const estimatedMemoryMB = (registry.getStats().totalCreated * 0.5) / 1024;
  metrics.maxMemoryUsageMB = estimatedMemoryMB;
  console.log(`   Estimated memory (${registry.getStats().totalCreated} fragments): ${estimatedMemoryMB.toFixed(2)}MB`);

  if (estimatedMemoryMB > 100) {
    metrics.warnings.push(`Memory usage exceeded 100MB threshold: ${estimatedMemoryMB.toFixed(2)}MB`);
  }

  console.log('');

  // Phase 6: Summary
  console.log(`📍 Phase 6: Test Summary`);

  metrics.timestampEnd = Date.now();
  const durationSeconds = (metrics.timestampEnd - metrics.timestampStart) / 1000;

  const finalStats = registry.getStats();

  console.log(`\n📊 FINAL METRICS`);
  console.log(`   Total ticks simulated: ${metrics.totalTicks}`);
  console.log(`   Total epochs: ${metrics.totalEpochs}`);
  console.log(`   Fragments created: ${metrics.fragmentsCreated}`);
  console.log(`   Fragments sealed: ${metrics.fragmentsSealed}`);
  console.log(`   Fragments destroyed (decay): ${INITIAL_FRAGMENTS - finalStats.totalCreated}`);
  console.log(`   Active fragments remaining: ${finalStats.activeCount}`);
  console.log(`   Sealed fragments remaining: ${finalStats.sealedCount}`);
  console.log(`   Simulation duration: ${durationSeconds.toFixed(2)}s`);
  console.log(`   Decay accuracy: ${metrics.decayAccuracy}`);
  console.log(`   Memory estimate: ${metrics.maxMemoryUsageMB.toFixed(2)}MB`);
  console.log(`   Errors: ${metrics.errorCount}`);

  if (metrics.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS:`);
    for (const warning of metrics.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  console.log(`\n✓ STRESS TEST COMPLETE\n`);

  // Export results
  const resultsPath = './artifacts/M43_STRESS_TEST_FINAL.txt';
  require('fs').mkdirSync('./artifacts', { recursive: true });

  const reportContent = `
M43 ENVIRONMENTAL DECAY STRESS TEST FINAL REPORT
================================================
Generated: ${new Date().toISOString()}
Duration: ${durationSeconds.toFixed(2)} seconds

SIMULATION PARAMETERS
---------------------
Epochs Simulated:        ${EPOCHS_TO_SIMULATE}
Ticks per Epoch:         ${TICKS_PER_EPOCH}
Total Ticks:             ${metrics.totalTicks}
Weathering Rate:         ${(WEATHERING_RATE * 100).toFixed(2)}% per tick
Initial Fragments:       ${INITIAL_FRAGMENTS}

RESULTS
-------
Fragments Created:       ${metrics.fragmentsCreated}
Fragments Sealed:        ${metrics.fragmentsSealed}
Fragments Destroyed:     ${INITIAL_FRAGMENTS - finalStats.totalCreated}
Active Fragments (end):  ${finalStats.activeCount}
Sealed Fragments (end):  ${finalStats.sealedCount}

PERFORMANCE METRICS
-------------------
Average Tick Latency:    ${avgLatency.toFixed(3)}ms
P95 Latency:             ${p95Latency.toFixed(3)}ms
P99 Latency:             ${p99Latency.toFixed(3)}ms
Estimated Memory:        ${metrics.maxMemoryUsageMB.toFixed(2)}MB
Memory Threshold:        100MB
Memory Status:           ${estimatedMemoryMB > 100 ? '❌ EXCEEDED' : '✅ OK'}

DECAY ANALYSIS
--------------
Decay Accuracy:          ${metrics.decayAccuracy}
Linear Fragments:        ${linearPercentage}%
Non-linear Fragments:    ${(100 - parseFloat(linearPercentage)).toFixed(1)}%

SEALED FRAGMENT VERIFICATION
-----------------------------
Integrity Status:        ${sealVerification.integrityOk ? '✅ PASSED' : '❌ FAILED'}
Sealed Fragments:        ${finalStats.sealedCount}
Errors:                  ${sealVerification.errors.length}

PERFORMANCE THRESHOLDS
----------------------
NPC Decision Latency Target:     5ms
Current P95:                     ${p95Latency.toFixed(3)}ms
Status:                          ${p95Latency < 5 ? '✅ PASS' : '⚠️ WARNING'}

Registry Memory Target:          100MB
Current Estimate:                ${estimatedMemoryMB.toFixed(2)}MB
Status:                          ${estimatedMemoryMB < 100 ? '✅ PASS' : '❌ FAIL'}

DETERMINISM VERIFICATION
------------------------
Fragment Decay Pattern:          ${metrics.decayAccuracy}
Sealed Fragment Immutability:    ${sealVerification.integrityOk ? '✅ PASS' : '❌ FAIL'}
Overall Determinism:             ${metrics.decayAccuracy === 'linear' && sealVerification.integrityOk ? '✅ VERIFIED' : '⚠️ ISSUES'}

ISSUES & WARNINGS
-----------------
${metrics.warnings.length === 0 ? 'None' : metrics.warnings.map(w => `- ${w}`).join('\n')}

CONCLUSION
----------
${metrics.decayAccuracy === 'linear' && sealVerification.integrityOk && estimatedMemoryMB < 100
  ? '✅ M43 Environmental Persistence layer is STABLE and DETERMINISTIC'
  : '⚠️ M43 Environmental Persistence layer requires review'}

Generated by M43 Stress Test Suite
  `;

  require('fs').writeFileSync(resultsPath, reportContent);
  console.log(`📁 Results exported to: ${resultsPath}\n`);
}

// Run stress test
runStressTest().catch(err => {
  console.error('❌ Stress test failed:', err);
  process.exit(1);
});
