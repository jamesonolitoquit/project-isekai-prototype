/**
 * Epoch Sync Engine Tests — Milestone 42, Task 1
 *
 * Test Coverage:
 * - Event broadcasting (local state change triggers subscribers)
 * - Event processing (remote events update local state)
 * - Clock drift tracking and compensation
 * - Epoch history recording
 * - Subscriber lifecycle
 */

import {
  createEpochSyncEngine,
  EpochSyncEvent,
  EpochSyncEngine,
  initializeEpochSyncEngine,
  getEpochSyncEngine
} from '../engine/epochSyncEngine';

describe('EpochSyncEngine', () => {
  let engine: EpochSyncEngine;

  beforeEach(() => {
    engine = createEpochSyncEngine(1, 'test_client');
  });

  describe('Initialization', () => {
    it('should create engine with valid initial state', () => {
      const newEngine = createEpochSyncEngine(2, 'client_A');

      expect(newEngine.currentEpoch).toBe(2);
      expect(newEngine.epochHistory).toHaveLength(0);
      expect(newEngine.pendingShifts).toHaveLength(0);
      expect(newEngine.peerClockOffsets.size).toBe(0);
    });

    it('should default to epoch 1 if not specified', () => {
      const newEngine = createEpochSyncEngine();
      expect(newEngine.currentEpoch).toBe(1);
    });
  });

  describe('broadcastEpochShift', () => {
    it('should broadcast valid epoch shift', () => {
      const callback = jest.fn<void, [EpochSyncEvent]>();
      engine.subscribeToEpochShifts(callback);

      const success = engine.broadcastEpochShift(2, 'director', 'director_1', 'Test shift');

      expect(success).toBe(true);
      expect(engine.currentEpoch).toBe(2);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          targetEpoch: 2,
          source: 'director',
          initiatorClientId: 'director_1'
        })
      );
    });

    it('should record shift in epoch history', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');

      expect(engine.epochHistory).toHaveLength(1);
      expect(engine.epochHistory[0]).toMatchObject({
        epoch: 2,
        priorEpoch: 1,
        source: 'director',
        initiator: 'test_client'
      });
    });

    it('should reject invalid target epoch', () => {
      const success = engine.broadcastEpochShift(4 as any, 'director', 'test_client');

      expect(success).toBe(false);
      expect(engine.currentEpoch).toBe(1); // unchanged
      expect(engine.epochHistory).toHaveLength(0);
    });

    it('should reject shift to same epoch', () => {
      engine.currentEpoch = 2;

      const success = engine.broadcastEpochShift(2, 'director', 'test_client');

      expect(success).toBe(false);
      expect(engine.epochHistory).toHaveLength(0);
    });

    it('should support all three epoch targets', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      expect(engine.currentEpoch).toBe(2);

      engine.broadcastEpochShift(3, 'world_event', 'test_client');
      expect(engine.currentEpoch).toBe(3);

      // 1→3 already done, test 3→1
      engine.broadcastEpochShift(1, 'system', 'test_client');
      expect(engine.currentEpoch).toBe(1);
    });

    it('should notify all subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      engine.subscribeToEpochShifts(callback1);
      engine.subscribeToEpochShifts(callback2);

      engine.broadcastEpochShift(2, 'director', 'test_client');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = jest.fn();

      engine.subscribeToEpochShifts(errorCallback);
      engine.subscribeToEpochShifts(goodCallback);

      // Should not throw
      expect(() => {
        engine.broadcastEpochShift(2, 'director', 'test_client');
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(goodCallback).toHaveBeenCalledTimes(1); // Still called despite error
    });
  });

  describe('processEpochShiftEvent', () => {
    it('should process valid incoming event', () => {
      const callback = jest.fn();
      engine.subscribeToEpochShifts(callback);

      const event: EpochSyncEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'world_event',
        initiatorClientId: 'peer_1',
        reason: 'Remote epoch shift'
      };

      engine.processEpochShiftEvent(event);

      expect(engine.currentEpoch).toBe(2);
      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should update epoch history on remote event', () => {
      const event: EpochSyncEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'player_consensus',
        initiatorClientId: 'consensus_engine'
      };

      engine.processEpochShiftEvent(event);

      expect(engine.epochHistory).toHaveLength(1);
      expect(engine.epochHistory[0]).toMatchObject({
        epoch: 2,
        priorEpoch: 1,
        source: 'player_consensus'
      });
    });

    it('should record peer clock drift from event', () => {
      const event: EpochSyncEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'director',
        initiatorClientId: 'peer_1',
        clockOffset: 25
      };

      engine.processEpochShiftEvent(event);

      expect(engine.peerClockOffsets.get('peer_1')).toBe(25);
    });

    it('should reject invalid event', () => {
      const callback = jest.fn();
      engine.subscribeToEpochShifts(callback);

      const invalidEvent: any = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 999, // Invalid
        source: 'director',
        initiatorClientId: 'peer_1'
      };

      engine.processEpochShiftEvent(invalidEvent);

      expect(engine.currentEpoch).toBe(1); // unchanged
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not update if already at target epoch', () => {
      engine.currentEpoch = 2;
      const callback = jest.fn();
      engine.subscribeToEpochShifts(callback);

      const event: EpochSyncEvent = {
        eventId: 'evt_1',
        timestamp: Date.now(),
        targetEpoch: 2,
        source: 'director',
        initiatorClientId: 'peer_1'
      };

      engine.processEpochShiftEvent(event);

      // Still notifies subscribers (event was valid)
      expect(callback).toHaveBeenCalledWith(event);
      // But no new history entry
      expect(engine.epochHistory).toHaveLength(0);
    });
  });

  describe('subscribeToEpochShifts', () => {
    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = engine.subscribeToEpochShifts(callback);

      engine.broadcastEpochShift(2, 'director', 'test_client');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      engine.broadcastEpochShift(3, 'director', 'test_client');
      expect(callback).toHaveBeenCalledTimes(1); // Not increased
    });

    it('should support multiple independent subscribers', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const cb3 = jest.fn();

      engine.subscribeToEpochShifts(cb1);
      engine.subscribeToEpochShifts(cb2);
      const unsub3 = engine.subscribeToEpochShifts(cb3);

      engine.broadcastEpochShift(2, 'director', 'test_client');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);

      unsub3();

      engine.broadcastEpochShift(1, 'director', 'test_client');
      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledTimes(2);
      expect(cb3).toHaveBeenCalledTimes(1); // No increase
    });
  });

  describe('Clock Drift Tracking', () => {
    it('should record peer clock drift', () => {
      engine.recordPeerClockDrift('peer_A', 15);
      engine.recordPeerClockDrift('peer_B', -10);

      expect(engine.peerClockOffsets.get('peer_A')).toBe(15);
      expect(engine.peerClockOffsets.get('peer_B')).toBe(-10);
    });

    it('should calculate average clock offset', () => {
      engine.recordPeerClockDrift('peer_A', 10);
      engine.recordPeerClockDrift('peer_B', 20);
      engine.recordPeerClockDrift('peer_C', 30);

      const avg = engine.getAverageClockOffset();
      expect(avg).toBe(20); // (10+20+30)/3
    });

    it('should handle negative offsets in average', () => {
      engine.recordPeerClockDrift('peer_A', -10);
      engine.recordPeerClockDrift('peer_B', 10);

      const avg = engine.getAverageClockOffset();
      expect(avg).toBe(0); // (-10+10)/2
    });

    it('should return 0 if no peers recorded', () => {
      const avg = engine.getAverageClockOffset();
      expect(avg).toBe(0);
    });

    it('should handle updates to existing peer drift', () => {
      engine.recordPeerClockDrift('peer_A', 10);
      expect(engine.getAverageClockOffset()).toBe(10);

      engine.recordPeerClockDrift('peer_A', 20);
      expect(engine.getAverageClockOffset()).toBe(20); // Updated value
    });
  });

  describe('getEpochState', () => {
    it('should return current and prior epochs', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      const state = engine.getEpochState();

      expect(state.current).toBe(2);
      expect(state.prior).toBe(1);
    });

    it('should not have prior epoch when first initialized', () => {
      const state = engine.getEpochState();

      expect(state.current).toBe(1);
      expect(state.prior).toBeUndefined();
    });

    it('should update prior after multiple shifts', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.broadcastEpochShift(3, 'director', 'test_client');

      const state = engine.getEpochState();
      expect(state.current).toBe(3);
      expect(state.prior).toBe(2);
    });
  });

  describe('Epoch History', () => {
    it('should maintain complete shift history', () => {
      engine.broadcastEpochShift(2, 'director', 'client_1');
      engine.broadcastEpochShift(3, 'world_event', 'client_1');
      engine.broadcastEpochShift(1, 'player_consensus', 'client_1');

      expect(engine.epochHistory).toHaveLength(3);
    });

    it('should record all shift metadata', () => {
      const startTime = Date.now();
      engine.broadcastEpochShift(2, 'director', 'director_1', 'Test reason');

      const record = engine.epochHistory[0];
      expect(record.epoch).toBe(2);
      expect(record.priorEpoch).toBe(1);
      expect(record.source).toBe('director');
      expect(record.initiator).toBe('director_1');
      expect(record.timestamp).toBeGreaterThanOrEqual(startTime);
    });
  });
});
