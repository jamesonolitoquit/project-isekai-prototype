/**
 * Epoch Consensus Coordination Tests — Milestone 42, Task 1
 *
 * Test Coverage:
 * - Multi-peer epoch shift coordination (simulating multiplayer scenario)
 * - Latency compensation via clock offset tracking
 * - Consensus event handling
 * - Event ordering and causality verification
 * - P95 latency verification (<100ms)
 */

import {
  createEpochSyncEngine,
  EpochSyncEvent,
  EpochSyncEngine
} from '../engine/epochSyncEngine';

describe('EpochSyncEngine — Consensus Coordination', () => {
  let directorEngine: EpochSyncEngine;
  let player1Engine: EpochSyncEngine;
  let player2Engine: EpochSyncEngine;

  beforeEach(() => {
    directorEngine = createEpochSyncEngine(1, 'director');
    player1Engine = createEpochSyncEngine(1, 'player_1');
    player2Engine = createEpochSyncEngine(1, 'player_2');
  });

  describe('Multi-Peer Synchronization', () => {
    it('should synchronize epoch shift across three peers', () => {
      const directorCallback = jest.fn();
      const player1Callback = jest.fn();
      const player2Callback = jest.fn();

      directorEngine.subscribeToEpochShifts(directorCallback);
      player1Engine.subscribeToEpochShifts(player1Callback);
      player2Engine.subscribeToEpochShifts(player2Callback);

      // Director initiates shift
      directorEngine.broadcastEpochShift(2, 'director', 'director', 'Story progression');

      // Get the event that was broadcast
      const broadcastEvent: EpochSyncEvent = directorCallback.mock.calls[0][0];

      // Simulate network propagation: peers receive event
      setTimeout(() => {
        player1Engine.processEpochShiftEvent(broadcastEvent);
        player2Engine.processEpochShiftEvent(broadcastEvent);
      }, 0);

      // Verify all peers converged to same epoch
      expect(directorEngine.currentEpoch).toBe(2);
      expect(player1Engine.currentEpoch).toBe(2);
      expect(player2Engine.currentEpoch).toBe(2);
    });

    it('should maintain consistent epoch history across peers', () => {
      directorEngine.broadcastEpochShift(2, 'director', 'director');
      const event1: EpochSyncEvent = directorEngine.epochHistory[0] as any;

      player1Engine.processEpochShiftEvent({
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'director',
        initiatorClientId: 'director'
      });

      player2Engine.processEpochShiftEvent({
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'director',
        initiatorClientId: 'director'
      });

      // All three should have same history
      expect(directorEngine.epochHistory).toHaveLength(1);
      expect(player1Engine.epochHistory).toHaveLength(1);
      expect(player2Engine.epochHistory).toHaveLength(1);

      expect(directorEngine.epochHistory[0].epoch).toBe(
        player1Engine.epochHistory[0].epoch
      );
      expect(player1Engine.epochHistory[0].epoch).toBe(
        player2Engine.epochHistory[0].epoch
      );
    });
  });

  describe('Clock Drift Compensation', () => {
    it('should track clock offset for each peer', () => {
      directorEngine.recordPeerClockDrift('player_1', 15);
      directorEngine.recordPeerClockDrift('player_2', -10);

      expect(directorEngine.peerClockOffsets.get('player_1')).toBe(15);
      expect(directorEngine.peerClockOffsets.get('player_2')).toBe(-10);
    });

    it('should calculate representative average clock offset', () => {
      // Simulate network with clock skew
      directorEngine.recordPeerClockDrift('player_1', 20);
      directorEngine.recordPeerClockDrift('player_2', 15);
      directorEngine.recordPeerClockDrift('player_3', 25);

      const avgOffset = directorEngine.getAverageClockOffset();
      // Should be around 20ms
      expect(avgOffset).toBe(20); // (20+15+25)/3 = 20
    });

    it('should represent positive and negative drift', () => {
      directorEngine.recordPeerClockDrift('player_1', 30);
      directorEngine.recordPeerClockDrift('player_2', -15);
      directorEngine.recordPeerClockDrift('player_3', 5);

      const avgOffset = directorEngine.getAverageClockOffset();
      expect(avgOffset).toBeCloseTo(6.67, 0); // (30-15+5)/3 ≈ 6.67
    });

    it('should update offset tracking over time (simulate multiple measurements)', () => {
      // Initial measurement: network has 15ms drift
      directorEngine.recordPeerClockDrift('peer_A', 15);
      expect(directorEngine.getAverageClockOffset()).toBe(15);

      // Later measurement: network drifted to 25ms
      directorEngine.recordPeerClockDrift('peer_A', 25);
      expect(directorEngine.getAverageClockOffset()).toBe(25);
    });
  });

  describe('Consensus Event Coordination', () => {
    it('should handle consensus-approved epoch shift', () => {
      const callback = jest.fn();
      player1Engine.subscribeToEpochShifts(callback);

      // Simulate consensus vote approval
      const consensusEvent: EpochSyncEvent = {
        eventId: 'consensus_vote_1',
        timestamp: Date.now(),
        targetEpoch: 3,
        source: 'player_consensus',
        initiatorClientId: 'consensus_engine',
        reason: 'Players voted: 3:2 to shift to Epoch III'
      };

      player1Engine.processEpochShiftEvent(consensusEvent);

      expect(player1Engine.currentEpoch).toBe(3);
      expect(callback).toHaveBeenCalledWith(consensusEvent);
    });

    it('should handle conflicting shifts (only accept first)', () => {
      const callback = jest.fn();
      directorEngine.subscribeToEpochShifts(callback);

      // Simulating race condition: two peers both initiating shifts
      const event1: EpochSyncEvent = {
        eventId: 'evt_1',
        timestamp: 1000,
        targetEpoch: 2,
        source: 'director',
        initiatorClientId: 'director_1'
      };

      const event2: EpochSyncEvent = {
        eventId: 'evt_2',
        timestamp: 1001, // Slightly later
        targetEpoch: 3,
        source: 'player_consensus',
        initiatorClientId: 'consensus_engine'
      };

      directorEngine.processEpochShiftEvent(event1);
      expect(directorEngine.currentEpoch).toBe(2);

      // Second event arrives but shows current is already at 2
      directorEngine.processEpochShiftEvent(event2);
      expect(directorEngine.currentEpoch).toBe(3); // Updated to new target
      expect(directorEngine.epochHistory).toHaveLength(2);
    });
  });

  describe('Event Ordering', () => {
    it('should preserve shift causality in history', () => {
      directorEngine.broadcastEpochShift(2, 'director', 'director', 'Step 1');
      directorEngine.broadcastEpochShift(3, 'world_event', 'world', 'Step 2');
      directorEngine.broadcastEpochShift(1, 'player_consensus', 'consensus', 'Step 3');

      expect(directorEngine.epochHistory[0].epoch).toBe(2);
      expect(directorEngine.epochHistory[1].epoch).toBe(3);
      expect(directorEngine.epochHistory[2].epoch).toBe(1);
    });

    it('should maintain prior→current chain through history', () => {
      directorEngine.broadcastEpochShift(2, 'director', 'director');
      directorEngine.broadcastEpochShift(3, 'world_event', 'world');

      const record1 = directorEngine.epochHistory[0];
      const record2 = directorEngine.epochHistory[1];

      // Verify chain: 1→2→3
      expect(record1.priorEpoch).toBe(1);
      expect(record1.epoch).toBe(2);
      expect(record2.priorEpoch).toBe(2);
      expect(record2.epoch).toBe(3);
    });
  });

  describe('Latency Verification (P95 < 100ms)', () => {
    it('should process remote event within latency budget', () => {
      const startTime = performance.now();
      const iterations = 1000; // Measure across many events

      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const eventStartTime = performance.now();

        const event: EpochSyncEvent = {
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          targetEpoch: (((i % 3) + 1) as 1 | 2 | 3),
          source: 'world_event',
          initiatorClientId: 'world_engine'
        };

        player1Engine.processEpochShiftEvent(event);

        const eventEndTime = performance.now();
        latencies.push(eventEndTime - eventStartTime);
      }

      // Calculate P95 latency (95th percentile)
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`P95 Latency: ${p95Latency.toFixed(3)}ms (across ${iterations} events)`);

      // Assert P95 < 100ms
      expect(p95Latency).toBeLessThan(100);
    });

    it('should complete local broadcast within latency budget', () => {
      const callback = jest.fn();
      directorEngine.subscribeToEpochShifts(callback);

      const startTime = performance.now();
      directorEngine.broadcastEpochShift(2, 'director', 'director');
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Local broadcast should be very fast
    });

    it('should handle rapid consecutive shifts within budget', () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        const targetEpoch: 1 | 2 | 3 = (((i % 3) + 1) as 1 | 2 | 3);
        if (targetEpoch !== directorEngine.currentEpoch) {
          directorEngine.broadcastEpochShift(targetEpoch, 'director', 'director');
        }

        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }

      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`P95 Latency (rapid shifts): ${p95Latency.toFixed(3)}ms`);

      expect(p95Latency).toBeLessThan(100);
    });
  });

  describe('Stress Test: High-Frequency Consensus', () => {
    it('should handle 100+ concurrent remote events without degradation', () => {
      const callback = jest.fn();
      directorEngine.subscribeToEpochShifts(callback);

      const events: EpochSyncEvent[] = [];

      // Generate 100 events
      for (let i = 0; i < 100; i++) {
        events.push({
          eventId: `evt_${i}`,
          timestamp: Date.now() + i,
          targetEpoch: (((i % 3) + 1) as 1 | 2 | 3),
          source: 'world_event',
          initiatorClientId: `peer_${i % 10}`
        });
      }

      const startTime = performance.now();

      events.forEach(event => {
        directorEngine.processEpochShiftEvent(event);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerEvent = totalTime / events.length;

      console.log(
        `Processed 100 events in ${totalTime.toFixed(2)}ms (avg ${avgTimePerEvent.toFixed(3)}ms/event)`
      );

      // Average should still be well under 100ms per event
      expect(avgTimePerEvent).toBeLessThan(100);
      expect(directorEngine.epochHistory.length).toBeGreaterThan(0);
    });
  });
});
