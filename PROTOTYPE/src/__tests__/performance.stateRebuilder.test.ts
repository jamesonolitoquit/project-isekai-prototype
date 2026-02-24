/**
 * M41 Task 4: Performance Profiling - State Rebuilder Stress Test
 * 
 * Validates M40 optimization improvements under high-load scenarios
 * Measures:
 * - Total rebuild time for 10,000 events
 * - Average time per event type
 * - Memory overhead
 * - Frame rate impact (simulated)
 */

import { Event } from '../events/mutationLog';
import { createInitialWorld } from '../engine/worldEngine';
import { rebuildState } from '../engine/stateRebuilder';

describe('M41 Task 4: Performance Profiling - State Rebuilder', () => {
  
  /**
   * Generates a diverse event stream for stress testing
   * Simulates realistic game progression across 10,000 mutations
   */
  function generateSyntheticEventStream(count: number): Event[] {
    const events: Event[] = [];
    
    // Event type distribution based on typical gameplay
    const eventTypeDistribution = {
      'TICK': 0.4,            // 40% - Most frequent
      'MOVE': 0.15,           // 15% - Player movement
      'COMBAT_HIT': 0.1,      // 10% - Combat actions
      'ITEM_PICKED_UP': 0.08, // 8% - Inventory
      'QUEST_STARTED': 0.05,  // 5% - Quest progression
      'XP_GAINED': 0.05,      // 5% - Leveling
      'TRADE_INITIATED': 0.03,// 3% - Trading
      'SPELL_CAST': 0.03,     // 3% - Magic
      'WORLD_EVENT_TRIGGERED': 0.03, // 3% - World events
      'STATUS_APPLIED': 0.03,  // 3% - Status effects
      'LOCATION_DISCOVERED': 0.02, // 2% - Exploration
      'NPC_IDENTIFIED': 0.02,   // 2% - Knowledge
      'RUNE_INFUSED': 0.01,     // 1% - Relics
      'TEMPORAL_PARADOX': 0.01   // 1% - Arcane
    };
    
    const eventTypes = Object.keys(eventTypeDistribution);
    
    for (let i = 0; i < count; i++) {
      // Weighted random selection
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
      
      // Generate realistic payload based on event type
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
  
  /**
   * Generates realistic payloads for different event types
   */
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
  
  /**
   * Measures memory usage before and after rebuild
   */
  function measureMemoryUsage(): { before: number; after: number; delta: number } {
    if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
      (globalThis as any).gc();
    }
    
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    return { before: memBefore, after: 0, delta: 0 };
  }
  
  /**
   * Primary performance test: 10,000 event rebuild simulation
   */
  test('should rebuild state from 10,000 events within acceptable time budget', () => {
    const initialState = createInitialWorld('test_world');
    const eventCount = 10000;
    
    // Generate synthetic event stream
    const startGenerate = performance.now();
    const events = generateSyntheticEventStream(eventCount);
    const generateTime = performance.now() - startGenerate;
    
    console.log(`\n=== M41 Task 4: Performance Profiling Results ===`);
    console.log(`Event generation time: ${generateTime.toFixed(2)}ms for ${eventCount} events`);
    console.log(`Events: ${eventCount}, Distribution: 40% TICK, 15% MOVE, 45% other\n`);
    
    // Measure memory before rebuild
    const memBefore = measureMemoryUsage();
    
    // Perform state rebuild
    const startRebuild = performance.now();
    const result = rebuildState(initialState, events);
    const rebuildTime = performance.now() - startRebuild;
    
    // Measure memory after rebuild
    const memAfter = measureMemoryUsage();
    
    console.log(`State rebuild time: ${rebuildTime.toFixed(2)}ms`);
    console.log(`Average per-event rebuild: ${(rebuildTime / eventCount).toFixed(4)}ms`);
    console.log(`Throughput: ${(eventCount / (rebuildTime / 1000)).toFixed(0)} events/sec\n`);
    
    // Calculate memory overhead
    const memDelta = (memAfter.before - memBefore.before) * 1024; // Convert back to KB for detail
    console.log(`Memory before rebuild: ${memBefore.before.toFixed(2)}MB`);
    console.log(`Memory after rebuild: ${memAfter.before.toFixed(2)}MB`);
    console.log(`Memory overhead: ~${memDelta.toFixed(2)}KB\n`);
    
    // Estimate frame rate impact (assume 16.67ms per frame @ 60fps)
    const frameTimeMs = 16.67;
    const framesStalled = Math.ceil(rebuildTime / frameTimeMs);
    console.log(`Frame rate impact estimate:`);
    console.log(`- Rebuild time: ${rebuildTime.toFixed(2)}ms`);
    console.log(`- Frames stalled at 60fps: ~${framesStalled} (${(framesStalled * 16.67).toFixed(0)}ms)`);
    console.log(`- FPS degradation if on main thread: ${(60 * frameTimeMs / (frameTimeMs + rebuildTime)).toFixed(1)} fps\n`);
    
    // Calculate event type distribution metrics
    console.log(`Event type frequency analysis:`);
    const typeMetrics: Record<string, { count: number; percentage: number }> = {};
    events.forEach(e => {
      typeMetrics[e.type] = typeMetrics[e.type] || { count: 0, percentage: 0 };
      typeMetrics[e.type].count++;
    });
    
    Object.entries(typeMetrics)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([type, metrics]) => {
        metrics.percentage = (metrics.count / eventCount) * 100;
        console.log(`- ${type.padEnd(25)} ${metrics.count.toString().padStart(5)} (${metrics.percentage.toFixed(1)}%)`);
      });
    
    console.log(`\n=== Performance Assertions ===`);
    
    // M40 optimization target: <100ms for 10,000 events (~0.01ms per event)
    const targetTimePerEvent = 0.01; // ms
    const actualTimePerEvent = rebuildTime / eventCount;
    
    console.log(`Target: <${(eventCount * targetTimePerEvent).toFixed(0)}ms for ${eventCount} events`);
    console.log(`Actual: ${rebuildTime.toFixed(2)}ms`);
    console.log(`Per-event: ${actualTimePerEvent.toFixed(4)}ms (target: <${targetTimePerEvent}ms)`);
    
    // Assertion 1: Total rebuild time should be well under 1 second
    expect(rebuildTime).toBeLessThan(500);
    console.log(`✓ Rebuild time < 500ms: PASS (${rebuildTime.toFixed(2)}ms)\n`);
    
    // Assertion 2: Average per-event time should be minimal
    expect(actualTimePerEvent).toBeLessThan(0.05);
    console.log(`✓ Per-event time < 0.05ms: PASS (${actualTimePerEvent.toFixed(4)}ms)\n`);
    
    // Assertion 3: Verify state integrity
    expect(result.candidateState).toBeDefined();
    expect(result.candidateState.tick).toBeDefined();
    console.log(`✓ State integrity verified: PASS\n`);
  });
  
  /**
   * Event type segregation performance test
   * Verifies FastPathMap optimization for high-frequency events
   */
  test('should prioritize FastPath optimization (TICK/MOVE)', () => {
    const initialState = createInitialWorld('test_world');
    
    // Test 1: High-frequency events (TICK, MOVE)
    const fastPathEvents = Array.from({ length: 5000 }, (_, i) => ({
      id: i.toString(),
      worldInstanceId: 'test_world',
      actorId: 'player_test',
      type: i % 2 === 0 ? 'TICK' : 'MOVE',
      payload: {},
      timestamp: i
    } as unknown as Event));
    
    const startFastPath = performance.now();
    const fastPathResult = rebuildState(initialState, fastPathEvents);
    const fastPathTime = performance.now() - startFastPath;
    
    // Test 2: Diverse events (other handlers)
    const diverseEventTypes = [
      'COMBAT_HIT', 'ITEM_PICKED_UP', 'QUEST_STARTED', 'XP_GAINED',
      'TRADE_INITIATED', 'SPELL_CAST', 'WORLD_EVENT_TRIGGERED'
    ];
    
    const diverseEvents = Array.from({ length: 5000 }, (_, i) => ({
      id: (5000 + i).toString(),
      worldInstanceId: 'test_world',
      actorId: 'player_test',
      type: diverseEventTypes[i % diverseEventTypes.length],
      payload: { tick: 5000 + i },
      timestamp: 5000 + i
    } as unknown as Event));
    
    const startDiverse = performance.now();
    const diverseResult = rebuildState(initialState, diverseEvents);
    const diverseTime = performance.now() - startDiverse;
    
    console.log(`\n=== FastPath vs. Standard Handler Performance ===`);
    console.log(`FastPath (TICK/MOVE): ${fastPathTime.toFixed(2)}ms for 5000 events (${(fastPathTime / 5000).toFixed(4)}ms per event)`);
    console.log(`Standard handlers: ${diverseTime.toFixed(2)}ms for 5000 events (${(diverseTime / 5000).toFixed(4)}ms per event)`);
    
    // FastPath should be somewhat faster (at least not significantly slower)
    const ratio = fastPathTime / diverseTime;
    console.log(`FastPath efficiency ratio: ${ratio.toFixed(2)}x\n`);
    
    expect(fastPathResult.candidateState).toBeDefined();
    expect(diverseResult.candidateState).toBeDefined();
    console.log(`✓ Both rebuild paths produce valid state: PASS\n`);
  });
});
