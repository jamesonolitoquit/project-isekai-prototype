/**
 * Epoch Rollback Tests — Milestone 42, Task 1
 *
 * Test Coverage:
 * - Undo single epoch shift
 * - Rollback history consistency
 * - Subscriber notification on rollback
 * - Rollback boundary conditions (min history)
 */

import {
  createEpochSyncEngine,
  EpochSyncEvent,
  EpochSyncEngine
} from '../engine/epochSyncEngine';

describe('EpochSyncEngine — Rollback', () => {
  let engine: EpochSyncEngine;

  beforeEach(() => {
    engine = createEpochSyncEngine(1, 'test_client');
  });

  describe('undoEpochShift', () => {
    it('should rollback single shift', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      expect(engine.currentEpoch).toBe(2);

      const success = engine.undoEpochShift();

      expect(success).toBe(true);
      expect(engine.currentEpoch).toBe(1);
    });

    it('should remove last history entry on rollback', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.broadcastEpochShift(3, 'world_event', 'test_client');
      expect(engine.epochHistory).toHaveLength(2);

      engine.undoEpochShift();

      expect(engine.epochHistory).toHaveLength(1);
      expect(engine.epochHistory[0].epoch).toBe(2);
    });

    it('should restore prior epoch correctly', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.broadcastEpochShift(3, 'world_event', 'test_client');
      engine.broadcastEpochShift(1, 'system', 'test_client');

      engine.undoEpochShift();
      expect(engine.currentEpoch).toBe(3);

      engine.undoEpochShift();
      expect(engine.currentEpoch).toBe(2);

      engine.undoEpochShift();
      expect(engine.currentEpoch).toBe(1);
    });

    it('should notify subscribers on rollback', () => {
      const callback = jest.fn();
      engine.subscribeToEpochShifts(callback);

      engine.broadcastEpochShift(2, 'director', 'test_client');
      callback.mockClear(); // Clear call from broadcast

      engine.undoEpochShift();

      expect(callback).toHaveBeenCalledTimes(1);
      const rollbackEvent = callback.mock.calls[0][0];
      expect(rollbackEvent.source).toBe('system');
      expect(rollbackEvent.targetEpoch).toBe(1);
      expect(rollbackEvent.reason).toContain('Rollback');
    });

    it('should fail if history too short (min 2 records needed)', () => {
      const success = engine.undoEpochShift();
      expect(success).toBe(false);
      expect(engine.currentEpoch).toBe(1);
      expect(engine.epochHistory).toHaveLength(0);
    });

    it('should fail on second rollback after single shift', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');

      const firstRollback = engine.undoEpochShift();
      expect(firstRollback).toBe(true);

      const secondRollback = engine.undoEpochShift();
      expect(secondRollback).toBe(false);
      expect(engine.currentEpoch).toBe(1);
    });

    it('should maintain history integrity after rollback', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.broadcastEpochShift(3, 'world_event', 'test_client');

      engine.undoEpochShift();

      // Should be able to undo again (one shift remains in history)
      const canRollback = engine.undoEpochShift();
      expect(canRollback).toBe(true);
      expect(engine.currentEpoch).toBe(1);
      expect(engine.epochHistory).toHaveLength(0);
    });

    it('should allow new shift after rollback', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.undoEpochShift();

      const success = engine.broadcastEpochShift(3, 'world_event', 'test_client');
      expect(success).toBe(true);
      expect(engine.currentEpoch).toBe(3);
      expect(engine.epochHistory).toHaveLength(1);
    });

    it('should not allow rollback of initial state (epoch 1 with 0 history)', () => {
      expect(engine.epochHistory).toHaveLength(0);

      const success = engine.undoEpochShift();
      expect(success).toBe(false);
      expect(engine.currentEpoch).toBe(1);
    });
  });

  describe('Rollback Scenario: Complex Shift Chain', () => {
    it('should handle rollback in complex shift sequence', () => {
      // Simulate scenario: Director → World Event → Player Vote → Rollback → Retry
      engine.broadcastEpochShift(2, 'director', 'director_1', 'Director override');
      expect(engine.epochHistory).toHaveLength(1);

      engine.broadcastEpochShift(3, 'world_event', 'world_engine', 'Story milestone');
      expect(engine.epochHistory).toHaveLength(2);

      engine.broadcastEpochShift(1, 'player_consensus', 'consensus_engine', 'Players voted');
      expect(engine.epochHistory).toHaveLength(3);
      expect(engine.currentEpoch).toBe(1);

      // Rollback consensus vote
      const rollback1 = engine.undoEpochShift();
      expect(rollback1).toBe(true);
      expect(engine.currentEpoch).toBe(3);
      expect(engine.epochHistory).toHaveLength(2);

      // Verify state after rollback
      const state = engine.getEpochState();
      expect(state.current).toBe(3);
      expect(state.prior).toBe(2);
    });

    it('should track rollback source as system', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');

      const callback = jest.fn();
      engine.subscribeToEpochShifts(callback);

      engine.undoEpochShift();

      const rollbackEvent: EpochSyncEvent = callback.mock.calls[0][0];
      expect(rollbackEvent.source).toBe('system');
      expect(rollbackEvent.initiatorClientId).toBe('system');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid rollback attempts gracefully', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');

      const result1 = engine.undoEpochShift();
      expect(result1).toBe(true);

      const result2 = engine.undoEpochShift();
      expect(result2).toBe(false);

      const result3 = engine.undoEpochShift();
      expect(result3).toBe(false);

      expect(engine.currentEpoch).toBe(1);
    });

    it('should preserve epoch state through rollback cycle', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.broadcastEpochShift(3, 'world_event', 'test_client');

      const stateBefore = engine.getEpochState();

      engine.undoEpochShift();
      engine.broadcastEpochShift(3, 'world_event', 'test_client');

      const stateAfter = engine.getEpochState();

      expect(stateAfter.current).toBe(stateBefore.current);
      expect(stateAfter.prior).toBe(stateBefore.prior);
    });

    it('should handle rollback with clock offsets recorded', () => {
      engine.broadcastEpochShift(2, 'director', 'test_client');
      engine.recordPeerClockDrift('peer_1', 25);

      const offsetBefore = engine.getAverageClockOffset();

      engine.undoEpochShift();

      const offsetAfter = engine.getAverageClockOffset();
      // Clock offsets should persist (they're not affected by epoch rollback)
      expect(offsetAfter).toBe(offsetBefore);
    });
  });
});
