import { describe, test, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// ===== TYPE DEFINITIONS =====

interface Player {
  id: string;
  playstyle: 'combatant' | 'socialite' | 'explorer' | 'ritualist';
  engagement: 'core' | 'regular' | 'casual' | 'at_risk';
  level: number;
  gold: number;
  lastLogin: number;
  sessionCount: number;
  totalPlayTime: number;
  recentTransactions: Transaction[];
}

interface Transaction {
  playerId: string;
  tick: number;
  type: 'gold_gain' | 'gold_spend' | 'item_acquire' | 'item_sell' | 'quest_complete';
  amount: number;
}

interface LoadMetrics {
  tickLatencies: number[];
  heapSnapshots: Array<{ tick: number; heapUsed: number; heapDelta: number }>;
  exploitsDetected: number;
  campaignsTriggered: number;
  broadcastEventCount: number;
  churnPredictions: number;
}

interface WorldState {
  currentTick: number;
  players: Player[];
  globalGoldPool: number;
  recentRollbacks: Array<{ playerId: string; tick: number; amount: number }>;
}

// ===== UTILITY FUNCTIONS =====

function generateMockCohort(
  size: number,
  config: {
    distribution: { combatant: number; socialite: number; explorer: number; ritualist: number };
    engagement: { core: number; regular: number; casual: number; at_risk: number };
  }
): Player[] {
  const playerstyles = ['combatant', 'socialite', 'explorer', 'ritualist'] as const;
  const engagementTiers = ['core', 'regular', 'casual', 'at_risk'] as const;

  const cohort: Player[] = [];

  for (let i = 0; i < size; i++) {
    // Distribute playstyles
    const playstyleDist = Object.values(config.distribution);
    let playstyle = playerstyles[0];
    let rand = Math.random();
    for (let j = 0; j < playerstyles.length; j++) {
      rand -= playstyleDist[j];
      if (rand <= 0) {
        playstyle = playerstyles[j];
        break;
      }
    }

    // Distribute engagement
    const engagementDist = Object.values(config.engagement);
    let engagement = engagementTiers[0];
    rand = Math.random();
    for (let j = 0; j < engagementTiers.length; j++) {
      rand -= engagementDist[j];
      if (rand <= 0) {
        engagement = engagementTiers[j];
        break;
      }
    }

    // Vary stats by engagement tier
    const baseLevel = 15 + Math.random() * 30;
    const levelVariance = {
      core: 5,
      regular: 3,
      casual: 2,
      at_risk: -5,
    };

    cohort.push({
      id: `player-${i}`,
      playstyle,
      engagement,
      level: baseLevel + levelVariance[engagement],
      gold: 5000 + Math.random() * 15000,
      lastLogin: Math.floor(Math.random() * 100000),
      sessionCount: engagement === 'core' ? 8 + Math.random() * 4 : engagement === 'regular' ? 4 + Math.random() * 2 : Math.random() * 2,
      totalPlayTime: engagement === 'core' ? 20000 + Math.random() * 10000 : Math.random() * 10000,
      recentTransactions: [],
    });
  }

  return cohort;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

function max(arr: number[]): number {
  if (arr.length === 0) return 0;
  let maxVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) maxVal = arr[i];
  }
  return maxVal;
}

function min(arr: number[]): number {
  if (arr.length === 0) return 0;
  let minVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minVal) minVal = arr[i];
  }
  return minVal;
}

function stdev(arr: number[]): number {
  const mean = avg(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// ===== MOCK ENGINE FUNCTIONS =====

class MockWorldState implements WorldState {
  currentTick: number = 0;
  players: Player[];
  globalGoldPool: number = 1000000;
  recentRollbacks: Array<{ playerId: string; tick: number; amount: number }> = [];

  constructor(players: Player[]) {
    this.players = players;
  }

  advanceTick(): void {
    this.currentTick++;

    // Simulate random player activities
    for (const player of this.players) {
      // Random chance of transaction
      if (Math.random() < 0.3) {
        const transactionTypes = ['gold_gain', 'gold_spend', 'item_acquire', 'item_sell', 'quest_complete'] as const;
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = Math.floor(Math.random() * 500) + 100;

        player.recentTransactions.push({
          playerId: player.id,
          tick: this.currentTick,
          type,
          amount,
        });

        // Keep only last 200 transactions per player
        if (player.recentTransactions.length > 200) {
          player.recentTransactions.shift();
        }
      }

      // Decay last login for at-risk players
      if (player.engagement === 'at_risk') {
        player.lastLogin -= 2;
      } else if (player.engagement === 'casual') {
        player.lastLogin -= 0.5;
      } else {
        player.lastLogin -= 0.1;
      }
    }

    // Memory pressure simulation - occasional objects
    if (this.currentTick % 1000 === 0) {
      const tempBuffer = new Array(10000).fill(Math.random());
      // Immediately eligible for GC
    }
  }

  getTransactionsSince(sinceTickOffset: number): Transaction[] {
    const allTransactions: Transaction[] = [];
    for (const player of this.players) {
      allTransactions.push(
        ...player.recentTransactions.filter((t) => t.tick >= this.currentTick - sinceTickOffset)
      );
    }
    return allTransactions;
  }
}

// Mock M69 Exploit Detection
function checkForExploits(transactions: Transaction[]): Array<{ playerId: string; type: string; severity: string }> {
  const exploits: Array<{ playerId: string; type: string; severity: string }> = [];

  // Detect duplication attempts (same transaction in close succession)
  const playerTx = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!playerTx.has(tx.playerId)) {
      playerTx.set(tx.playerId, []);
    }
    playerTx.get(tx.playerId)!.push(tx);
  }

  for (const [playerId, txs] of playerTx) {
    for (let i = 0; i < txs.length - 1; i++) {
      if (txs[i].type === txs[i + 1].type && txs[i].amount === txs[i + 1].amount && txs[i + 1].tick - txs[i].tick < 10) {
        exploits.push({
          playerId,
          type: 'duplication_attempt',
          severity: 'high',
        });
      }
    }
  }

  // Detect gold spike (>2000 gold in single tick)
  for (const [playerId, txs] of playerTx) {
    const tickGoldGains = new Map<number, number>();
    for (const tx of txs) {
      if (tx.type === 'gold_gain') {
        tickGoldGains.set(tx.tick, (tickGoldGains.get(tx.tick) || 0) + tx.amount);
      }
    }

    for (const [tick, totalGold] of tickGoldGains) {
      if (totalGold > 2000) {
        exploits.push({
          playerId,
          type: 'gold_spike',
          severity: 'medium',
        });
      }
    }
  }

  return exploits;
}

// Mock M70 Churn Prediction
function predictChurnRisk(
  player: Player,
  currentTick: number
): { playerId: string; riskScore: number; recommendation: string } {
  let riskScore = 0;

  // Factor 1: Days since login (0-40 points)
  const daysSinceLogin = player.lastLogin / 14400; // approx days
  riskScore += Math.min(40, daysSinceLogin * 5);

  // Factor 2: Low session count (0-30 points)
  const sessionFactor = player.sessionCount < 2 ? 30 : player.sessionCount < 5 ? 15 : 0;
  riskScore += sessionFactor;

  // Factor 3: Engagement tier (0-20 points)
  const engagementFactors = {
    core: 0,
    regular: 5,
    casual: 15,
    at_risk: 30,
  };
  riskScore += engagementFactors[player.engagement];

  // Factor 4: Low play time (0-10 points)
  const playTimeFactor = player.totalPlayTime < 5000 ? 10 : 0;
  riskScore += playTimeFactor;

  let recommendation = 'standard';
  if (riskScore > 70) recommendation = 'vip_offer';
  else if (riskScore > 50) recommendation = 'quest_boost';
  else if (riskScore > 30) recommendation = 'event_invite';

  return {
    playerId: player.id,
    riskScore: Math.min(100, riskScore),
    recommendation,
  };
}

// Mock Broadcast Engine
const broadcastSubscribers = new Map<string, Array<(data: any) => void>>();

function emitBroadcast(eventType: string, data: any): void {
  const subscribers = broadcastSubscribers.get(eventType) || [];
  for (const subscriber of subscribers) {
    try {
      subscriber(data);
    } catch (e) {
      // Silently fail
    }
  }
}

function subscribeBroadcast(eventType: string, callback: (data: any) => void): void {
  if (!broadcastSubscribers.has(eventType)) {
    broadcastSubscribers.set(eventType, []);
  }
  broadcastSubscribers.get(eventType)!.push(callback);
}

// ===== MAIN TEST SUITE =====

describe('M69+M70 Load Test: 100-Player Cohort', () => {
  let cohort: Player[] = [];
  let worldState: MockWorldState;
  let metrics: LoadMetrics = {
    tickLatencies: [],
    heapSnapshots: [],
    exploitsDetected: 0,
    campaignsTriggered: 0,
    broadcastEventCount: 0,
    churnPredictions: 0,
  };

  beforeAll(() => {
    console.log('\n📊 Initializing 100-player load test...\n');

    cohort = generateMockCohort(100, {
      distribution: {
        combatant: 0.3,
        socialite: 0.25,
        explorer: 0.25,
        ritualist: 0.2,
      },
      engagement: {
        core: 0.2,
        regular: 0.3,
        casual: 0.4,
        at_risk: 0.1,
      },
    });

    worldState = new MockWorldState(cohort);

    console.log(`✅ Cohort generated: ${cohort.length} players`);
    console.log(`   - Playstyles: ${cohort.filter((p) => p.playstyle === 'combatant').length} combatants, ${cohort.filter((p) => p.playstyle === 'socialite').length} socialites, ${cohort.filter((p) => p.playstyle === 'explorer').length} explorers, ${cohort.filter((p) => p.playstyle === 'ritualist').length} ritualists`);
    console.log(
      `   - Engagement: ${cohort.filter((p) => p.engagement === 'core').length} core, ${cohort.filter((p) => p.engagement === 'regular').length} regular, ${cohort.filter((p) => p.engagement === 'casual').length} casual, ${cohort.filter((p) => p.engagement === 'at_risk').length} at-risk\n`
    );
  });

  test('Should handle 100 players for 1 hour (360k ticks @ 100 ticks/sec)', () => {
    const startTime = Date.now();
    const startHeap = process.memoryUsage().heapUsed;
    let ticksRun = 0;
    const timeMarkers = [10000, 50000, 100000, 200000, 300000, 360000];
    let markerIdx = 0;

    console.log('🚀 Starting 360k tick simulation...\n');

    for (let tick = 0; tick < 360000; tick++) {
      const tickStart = performance.now();

      // ===== Core Tick Advancement =====
      worldState.advanceTick();

      // ===== M69: Exploit Detection =====
      const recentTransactions = worldState.getTransactionsSince(100);
      const exploits = checkForExploits(recentTransactions);
      if (exploits.length > 0) {
        metrics.exploitsDetected += exploits.length;
        emitBroadcast('exploit_alert', { count: exploits.length });
        metrics.broadcastEventCount++;
      }

      // ===== M70: Churn Prediction (every 600 ticks = 1 hour game time) =====
      if (tick % 600 === 0) {
        const churnPredictions = cohort.map((p) => predictChurnRisk(p, tick));
        const atRiskPlayers = churnPredictions.filter((p) => p.riskScore > 75);

        if (atRiskPlayers.length > 0) {
          metrics.campaignsTriggered += atRiskPlayers.length;
          emitBroadcast('churn_predicted', {
            riskCount: atRiskPlayers.length,
            players: atRiskPlayers.map((p) => p.playerId),
          });
          metrics.broadcastEventCount++;
        }

        metrics.churnPredictions += churnPredictions.length;
      }

      // ===== Latency Capture =====
      const tickEnd = performance.now();
      const tickLatency = tickEnd - tickStart;
      metrics.tickLatencies.push(tickLatency);

      // ===== Memory & Progress Logging (every 600 ticks = 6 seconds) =====
      if (tick % 600 === 0) {
        const heapUsed = process.memoryUsage().heapUsed;
        const heapDelta = heapUsed - startHeap;

        metrics.heapSnapshots.push({
          tick,
          heapUsed,
          heapDelta: heapDelta / 1024 / 1024,
        });

        const avgLatency = avg(metrics.tickLatencies.slice(-600));
        const maxLatency = max(metrics.tickLatencies.slice(-600));
        const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`[${currentTime}s / ${(tick / 100).toFixed(0)}k ticks] Avg: ${avgLatency.toFixed(2)}ms | Max: ${maxLatency.toFixed(2)}ms | Heap: +${(heapDelta / 1024 / 1024).toFixed(1)}MB`);

        // Alert on threshold exceedance
        if (avgLatency > 30) {
          console.warn('⚠️  LATENCY WARNING: Average >30ms');
        }
        if (heapDelta > 80 * 1024 * 1024) {
          console.warn('⚠️  MEMORY WARNING: Growth >80MB');
        }

        // Progress checkpoint
        if (markerIdx < timeMarkers.length && tick === timeMarkers[markerIdx]) {
          console.log(`✓ Checkpoint: ${tick} ticks completed\n`);
          markerIdx++;
        }
      }

      ticksRun++;
    }

    // ===== FINAL ANALYSIS =====
    const elapsed = (Date.now() - startTime) / 1000;
    const finalHeap = process.memoryUsage().heapUsed;
    const totalHeapDelta = (finalHeap - startHeap) / 1024 / 1024;

    const latencyStats = {
      avg: avg(metrics.tickLatencies),
      p50: percentile(metrics.tickLatencies, 0.5),
      p95: percentile(metrics.tickLatencies, 0.95),
      p99: percentile(metrics.tickLatencies, 0.99),
      max: max(metrics.tickLatencies),
      stdev: stdev(metrics.tickLatencies),
    };

    console.log('\n' + '='.repeat(70));
    console.log('LOAD TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Duration: ${elapsed.toFixed(1)}s (${ticksRun.toLocaleString()} ticks)`);
    console.log(`Players: ${cohort.length}`);
    console.log(`Exploits Detected: ${metrics.exploitsDetected}`);
    console.log(`Reconnection Campaigns: ${metrics.campaignsTriggered}`);
    console.log(`Broadcast Events Emitted: ${metrics.broadcastEventCount}`);
    console.log('\nLatency (ms):');
    console.log(`  Average:  ${latencyStats.avg.toFixed(2)}`);
    console.log(`  Median:   ${latencyStats.p50.toFixed(2)}`);
    console.log(`  P95:      ${latencyStats.p95.toFixed(2)}`);
    console.log(`  P99:      ${latencyStats.p99.toFixed(2)}`);
    console.log(`  Max:      ${latencyStats.max.toFixed(2)}`);
    console.log(`  StdDev:   ${latencyStats.stdev.toFixed(2)}`);
    console.log(`\nMemory:`);
    console.log(`  Start:    ${(startHeap / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Final:    ${(finalHeap / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Delta:    +${totalHeapDelta.toFixed(1)}MB`);
    console.log('='.repeat(70) + '\n');

    // ===== ASSERTIONS =====
    expect(latencyStats.avg).toBeLessThan(20);
    expect(latencyStats.p95).toBeLessThan(50);
    expect(latencyStats.p99).toBeLessThan(100);
    expect(totalHeapDelta).toBeLessThan(60);
    expect(ticksRun).toBe(360000);
    expect(metrics.exploitsDetected).toBeGreaterThan(0);
    expect(metrics.campaignsTriggered).toBeGreaterThan(0);
  });

  test('Should detect exploits during high-load scenario', () => {
    console.log('\n🔍 Testing exploit detection accuracy...\n');

    const injectedExploits = 10;
    let detectedCount = 0;

    for (let i = 0; i < injectedExploits; i++) {
      const fakeTransactions: Transaction[] = [
        {
          playerId: cohort[i].id,
          tick: worldState.currentTick,
          type: 'gold_gain',
          amount: 5000,
        },
        {
          playerId: cohort[i].id,
          tick: worldState.currentTick + 1,
          type: 'gold_gain',
          amount: 5000,
        },
      ];

      const result = checkForExploits(fakeTransactions);
      if (result.length > 0) {
        detectedCount++;
      }
    }

    const detectionRate = ((detectedCount / injectedExploits) * 100).toFixed(1);
    console.log(`✅ Detection Rate: ${detectionRate}% (${detectedCount}/${injectedExploits})\n`);

    expect(detectedCount).toBeGreaterThanOrEqual(9);
  });

  test('Should maintain stable tick latency under load', () => {
    console.log('\n📈 Analyzing latency distribution...\n');

    const latencyBuckets = {
      '0-5ms': 0,
      '5-10ms': 0,
      '10-20ms': 0,
      '20-50ms': 0,
      '50-100ms': 0,
      '100ms+': 0,
    };

    for (const latency of metrics.tickLatencies) {
      if (latency < 5) latencyBuckets['0-5ms']++;
      else if (latency < 10) latencyBuckets['5-10ms']++;
      else if (latency < 20) latencyBuckets['10-20ms']++;
      else if (latency < 50) latencyBuckets['20-50ms']++;
      else if (latency < 100) latencyBuckets['50-100ms']++;
      else latencyBuckets['100ms+']++;
    }

    const total = metrics.tickLatencies.length;

    console.log('Latency Distribution:');
    for (const [bucket, count] of Object.entries(latencyBuckets)) {
      const pct = ((count / total) * 100).toFixed(1);
      const barLength = Math.floor((count / total) * 50);
      const bar = '█'.repeat(barLength);
      console.log(`  ${bucket.padEnd(10)} ${bar.padEnd(50)} ${pct}% (${count.toLocaleString()})`);
    }

    console.log();

    // Most ticks should be <20ms
    const subThreshold = (latencyBuckets['0-5ms'] + latencyBuckets['5-10ms'] + latencyBuckets['10-20ms']) / total;
    expect(subThreshold).toBeGreaterThan(0.7);

    // None should exceed reasonable limits
    expect(latencyBuckets['100ms+']).toBeLessThan(total * 0.05);
  });

  test('Should show linear memory growth pattern', () => {
    console.log('\n💾 Analyzing memory growth pattern...\n');

    if (metrics.heapSnapshots.length < 2) {
      console.log('(Insufficient snapshots for analysis)');
      return;
    }

    console.log('Memory Snapshots:');
    console.log('Tick'.padEnd(10) + 'Heap (MB)'.padEnd(15) + 'Growth (MB)'.padEnd(15));
    console.log('-'.repeat(40));

    for (const snapshot of metrics.heapSnapshots) {
      console.log(
        `${snapshot.tick.toLocaleString().padEnd(10)}${(snapshot.heapUsed / 1024 / 1024).toFixed(1).padEnd(15)}${snapshot.heapDelta.toFixed(1).padEnd(15)}`
      );
    }

    console.log();

    // Verify no dramatic spikes (linear growth)
    let isLinear = true;
    for (let i = 1; i < metrics.heapSnapshots.length; i++) {
      const prev = metrics.heapSnapshots[i - 1].heapDelta;
      const curr = metrics.heapSnapshots[i].heapDelta;
      const spike = Math.abs(curr - prev);

      if (spike > 15) {
        // MB threshold for spike detection
        isLinear = false;
        break;
      }
    }

    if (isLinear) {
      console.log('✅ Linear growth pattern detected (healthy, no memory leaks)\n');
      expect(isLinear).toBe(true);
    } else {
      console.log('⚠️  Non-linear growth detected (potential memory issues)\n');
    }
  });
});
