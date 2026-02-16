/**
 * M41 Task 4: Direct Performance Test Runner
 * Executes performance profiling without Jest overhead
 * Outputs baseline metrics for state rebuilder optimization
 */

import { Event } from '../src/events/mutationLog';
import { createInitialWorld } from '../src/engine/worldEngine';
import { rebuildState } from '../src/engine/stateRebuilder';

// Reuse event generation from performance test
function generateSyntheticEventStream(count: number): Event[] {
  const events: Event[] = [];
  
  const eventTypeDistribution = {
    'TICK': 0.4,
    'MOVE': 0.15,
    'COMBAT_HIT': 0.1,
    'ITEM_PICKED_UP': 0.08,
    'QUEST_STARTED': 0.05,
    'XP_GAINED': 0.05,
    'TRADE_INITIATED': 0.03,
    'SPELL_CAST': 0.03,
    'WORLD_EVENT_TRIGGERED': 0.03,
    'STATUS_APPLIED': 0.03,
    'LOCATION_DISCOVERED': 0.02,
    'NPC_IDENTIFIED': 0.02,
    'RUNE_INFUSED': 0.01,
    'TEMPORAL_PARADOX': 0.01
  };
  
  const eventTypes = Object.keys(eventTypeDistribution);
  
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let cumulative = 0;
    let selectedType = 'TICK';
    
    for (const type of eventTypes) {
      cumulative += eventTypeDistribution[type as keyof typeof eventTypeDistribution];
      if (rand < cumulative) {
        selectedType = type;
        break;
      }
    }
    
    const payload = generatePayloadForEventType(selectedType, i);
    
    events.push({
      id: i.toString(),
      worldInstanceId: 'test_world',
      actorId: 'player_test',
      type: selectedType,
      payload,
      timestamp: i
    } as unknown as Event);
  }
  
  return events;
}

function generatePayloadForEventType(type: string, index: number): Record<string, any> {
  const basePayloads: Record<string, Record<string, any>> = {
    'TICK': { tick: index },
    'MOVE': { fromLocation: 'tavern', toLocation: 'forest', duration: 10 },
    'COMBAT_HIT': {
      initiatorId: 'player_test',
      targetId: `enemy_${index % 5}`,
      damage: 5 + Math.floor(Math.random() * 15),
      hitType: 'normal'
    },
    'ITEM_PICKED_UP': {
      itemId: `item_${index}`,
      itemName: 'Item Name',
      location: 'forest'
    },
    'QUEST_STARTED': {
      questId: `quest_${index % 10}`,
      title: 'Sample Quest'
    },
    'XP_GAINED': {
      xpAmount: 10 + Math.floor(Math.random() * 50),
      source: 'combat'
    },
    'TRADE_INITIATED': {
      traderId: `npc_${index % 3}`,
      offeredItems: ['item_1', 'item_2'],
      requestedItems: ['gold']
    },
    'SPELL_CAST': {
      spellId: `spell_${index % 4}`,
      targetId: `enemy_${index % 5}`,
      damageDealt: 10 + Math.floor(Math.random() * 20)
    },
    'WORLD_EVENT_TRIGGERED': {
      eventName: 'Random Event',
      location: 'forest'
    },
    'STATUS_APPLIED': {
      targetId: `entity_${index % 5}`,
      statusEffect: 'poisoned'
    },
    'LOCATION_DISCOVERED': {
      locationId: `location_${index}`,
      locationName: 'New Location'
    },
    'NPC_IDENTIFIED': {
      npcId: `npc_${index % 20}`,
      npcName: 'NPC Name'
    },
    'RUNE_INFUSED': {
      itemId: `item_${index}`,
      runeId: 'rune_1'
    },
    'TEMPORAL_PARADOX': {
      severity: 'low',
      description: 'Minor time anomaly'
    }
  };
  
  return basePayloads[type] || {};
}

async function runPerformanceTest() {
  console.log('\n=== M41 Task 4: Performance Profiling Baseline ===\n');
  
  const initialState = createInitialWorld('test_world');
  const eventCount = 10000;
  
  // Generate synthetic event stream
  console.log(`Generating ${eventCount} synthetic events...`);
  const startGenerate = performance.now();
  const events = generateSyntheticEventStream(eventCount);
  const generateTime = performance.now() - startGenerate;
  console.log(`✓ Generated in ${generateTime.toFixed(2)}ms\n`);
  
  // Analyze event distribution
  const typeMetrics: Record<string, { count: number; percentage: number }> = {};
  events.forEach(e => {
    typeMetrics[e.type] = typeMetrics[e.type] || { count: 0, percentage: 0 };
    typeMetrics[e.type].count++;
  });
  
  console.log('Event Type Distribution:');
  Object.entries(typeMetrics)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([type, metrics]) => {
      metrics.percentage = (metrics.count / eventCount) * 100;
      console.log(`  ${type.padEnd(25)} ${metrics.count.toString().padStart(5)} (${metrics.percentage.toFixed(1)}%)`);
    });
  console.log('');
  
  // Measure memory before
  if (typeof globalThis !== 'undefined' && (globalThis as any).gc) (globalThis as any).gc();
  const memBefore = process.memoryUsage();
  
  // Perform state rebuild
  console.log('Starting state rebuild (10,000 events)...');
  const startRebuild = performance.now();
  const result = rebuildState(initialState, events);
  const rebuildTime = performance.now() - startRebuild;
  
  // Measure memory after
  const memAfter = process.memoryUsage();
  
  console.log(`\n=== Rebuild Performance Metrics ===`);
  console.log(`Total rebuild time: ${rebuildTime.toFixed(2)}ms`);
  console.log(`Average per-event:  ${(rebuildTime / eventCount).toFixed(4)}ms`);
  console.log(`Throughput:         ${(eventCount / (rebuildTime / 1000)).toFixed(0)} events/sec\n`);
  
  // Memory analysis
  const heapDelta = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  console.log(`Memory Usage:`);
  console.log(`  Before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  After:  ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Delta:  ${heapDelta.toFixed(2)}MB\n`);
  
  // Frame rate impact
  const frameTimeMs = 16.67; // 60 FPS
  const framesStalled = Math.ceil(rebuildTime / frameTimeMs);
  console.log(`Frame Rate Impact (60fps baseline = 16.67ms per frame):`);
  console.log(`  Rebuild blocks: ${framesStalled} frames (${(framesStalled * frameTimeMs).toFixed(0)}ms)`);
  console.log(`  FPS if on main thread: ${(60 * frameTimeMs / (frameTimeMs + rebuildTime)).toFixed(1)}fps\n`);
  
  // M40 optimization targets
  console.log(`=== Optimization Targets (M40) ===`);
  console.log(`Target: <100ms for ${eventCount} events (<0.01ms per event)`);
  console.log(`Actual: ${rebuildTime.toFixed(2)}ms (${(rebuildTime / eventCount).toFixed(4)}ms per event)`);
  
  if (rebuildTime < 100) {
    console.log(`✓ EXCELLENT: Well under 100ms target\n`);
  } else if (rebuildTime < 200) {
    console.log(`✓ GOOD: Under 200ms (acceptable for production)\n`);
  } else if (rebuildTime < 500) {
    console.log(`⚠ WARNING: Under 500ms (needs optimization if on main thread)\n`);
  } else {
    console.log(`✗ POOR: Over 500ms (requires optimization)\n`);
  }
  
  // FastPath vs Standard handler comparison
  console.log(`=== Handler Dispatch Analysis ===`);
  
  // Test FastPath events (TICK, MOVE)
  const fastPathCount = 5000;
  const fastPathEvents = Array.from({ length: fastPathCount }, (_, i) => ({
    id: i.toString(),
    worldInstanceId: 'test_world',
    actorId: 'player_test',
    type: i % 2 === 0 ? 'TICK' : 'MOVE',
    payload: {},
    timestamp: i
  } as unknown as Event));
  
  const startFastPath = performance.now();
  rebuildState(initialState, fastPathEvents);
  const fastPathTime = performance.now() - startFastPath;
  
  // Test diverse events
  const diverseEventTypes = [
    'COMBAT_HIT', 'ITEM_PICKED_UP', 'QUEST_STARTED', 'XP_GAINED',
    'TRADE_INITIATED', 'SPELL_CAST', 'WORLD_EVENT_TRIGGERED'
  ];
  
  const diverseCount = 5000;
  const diverseEvents = Array.from({ length: diverseCount }, (_, i) => ({
    id: (fastPathCount + i).toString(),
    worldInstanceId: 'test_world',
    actorId: 'player_test',
    type: diverseEventTypes[i % diverseEventTypes.length],
    payload: { tick: fastPathCount + i },
    timestamp: fastPathCount + i
  } as unknown as Event));
  
  const startDiverse = performance.now();
  rebuildState(initialState, diverseEvents);
  const diverseTime = performance.now() - startDiverse;
  
  console.log(`FastPath (TICK/MOVE):     ${fastPathTime.toFixed(2)}ms for ${fastPathCount} events (${(fastPathTime / fastPathCount).toFixed(4)}ms/event)`);
  console.log(`Standard handlers:        ${diverseTime.toFixed(2)}ms for ${diverseCount} events (${(diverseTime / diverseCount).toFixed(4)}ms/event)`);
  console.log(`Efficiency ratio:         ${(fastPathTime / diverseTime).toFixed(2)}x\n`);
  
  console.log(`=== Baseline Metrics Captured ===`);
  console.log(`State integrity: ${result.candidateState ? '✓' : '✗'}`);
  console.log(`Performance test: ${rebuildTime < 200 ? '✓ PASS' : '⚠ WARNING'}`);
  console.log(`Dispatch efficiency: ${(fastPathTime / diverseTime) < 1.2 ? '✓ PASS' : '⚠ ACCEPTABLE'}\n`);
  
  return {
    rebuildTime,
    eventCount,
    throughput: eventCount / (rebuildTime / 1000),
    memoryDelta: heapDelta,
    framesStalled
  };
}

// Execute with error handling
(async () => {
  try {
    await runPerformanceTest();
    console.log('✓ Performance baseline established\n');
    process.exit(0);
  } catch (err) {
    console.error('✗ Performance test failed:', err);
    process.exit(1);
  }
})();
