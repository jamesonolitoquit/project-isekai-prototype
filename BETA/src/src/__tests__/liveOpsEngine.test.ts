/**
 * Live Ops Engine Test Suite
 * Validates scheduling, queueing, cancellation, and auto-firing of events
 */

import { liveOpsEngine, LiveOpsEngine } from '../engine/liveOpsEngine';

describe('LiveOpsEngine', () => {
  let engine: LiveOpsEngine;

  beforeEach(async () => {
    // Create fresh engine for each test
    engine = new LiveOpsEngine();
  });

  // =========================================================================
  // SCHEDULE OPERATION TESTS
  // =========================================================================

  describe('scheduleEvent', () => {
    it('should schedule an event successfully', () => {
      const result = engine.scheduleEvent(
        'test_event_01',
        'Test Event',
        'story_beat',
        100,
        0,
        50,
        'A test event'
      );

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBeDefined();
      expect(result.eventFireTime).toBe(100);
    });

    it('should generate unique schedule IDs', () => {
      const result1 = engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0, 50);
      const result2 = engine.scheduleEvent('event2', 'Event 2', 'story_beat', 200, 0, 50);

      expect(result1.scheduleId).not.toBe(result2.scheduleId);
    });

    it('should reject events with empty event ID', () => {
      const result = engine.scheduleEvent('', 'Event', 'story_beat', 100, 0, 50);
      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot be empty');
    });

    it('should reject negative delay', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', -10, 0, 50);
      expect(result.success).toBe(false);
      expect(result.message).toContain('non-negative');
    });

    it('should reject zero delay', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 0, 0, 50);
      expect(result.success).toBe(false);
      expect(result.message).toContain('at least 1');
    });

    it('should reject out-of-range severity', () => {
      const result1 = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0, -5);
      const result2 = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0, 150);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it('should apply default values', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      expect(result.success).toBe(true);

      const scheduled = engine.getScheduledEventById(result.scheduleId!);
      expect(scheduled?.severity).toBe(50); // Default severity
      expect(scheduled?.category).toBe('story_beat');
    });

    it('should calculate fire time correctly relative to current tick', () => {
      const currentTick = 500;
      const delayTicks = 250;
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', delayTicks, currentTick);

      expect(result.eventFireTime).toBe(750); // 500 + 250
    });
  });

  // =========================================================================
  // RETRIEVAL TESTS
  // =========================================================================

  describe('getScheduledEvents', () => {
    it('should return empty array when no events scheduled', () => {
      const events = engine.getScheduledEvents();
      expect(events).toEqual([]);
    });

    it('should return all queued events', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 200, 0);
      engine.scheduleEvent('event3', 'Event 3', 'seasonal', 300, 0);

      const events = engine.getScheduledEvents();
      expect(events).toHaveLength(3);
    });

    it('should not return cancelled events', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.cancelEvent(result.scheduleId!);

      const events = engine.getScheduledEvents();
      expect(events).toEqual([]);
    });

    it('should not return fired events', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.processTick(100);

      const events = engine.getScheduledEvents();
      expect(events).toEqual([]);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return events sorted by fire time', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 300, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 100, 0);
      engine.scheduleEvent('event3', 'Event 3', 'story_beat', 200, 0);

      const upcoming = engine.getUpcomingEvents();
      expect(upcoming[0].scheduledFireTick).toBe(100);
      expect(upcoming[1].scheduledFireTick).toBe(200);
      expect(upcoming[2].scheduledFireTick).toBe(300);
    });

    it('should respect limit parameter', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 200, 0);
      engine.scheduleEvent('event3', 'Event 3', 'story_beat', 300, 0);

      const upcoming = engine.getUpcomingEvents(2);
      expect(upcoming).toHaveLength(2);
    });
  });

  describe('getNextEvent', () => {
    it('should return null when no events', () => {
      const next = engine.getNextEvent();
      expect(next).toBeNull();
    });

    it('should return the next event to fire', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 300, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 100, 0);

      const next = engine.getNextEvent();
      expect(next?.eventId).toBe('event2');
      expect(next?.scheduledFireTick).toBe(100);
    });
  });

  describe('getScheduledEventById', () => {
    it('should return the event by schedule ID', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const scheduled = engine.getScheduledEventById(result.scheduleId!);

      expect(scheduled).toBeDefined();
      expect(scheduled?.eventId).toBe('event');
    });

    it('should return null for invalid schedule ID', () => {
      const scheduled = engine.getScheduledEventById('invalid_id');
      expect(scheduled).toBeNull();
    });
  });

  // =========================================================================
  // TICK PROCESSING TESTS
  // =========================================================================

  describe('processTick', () => {
    it('should fire events at correct tick', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const fired = engine.processTick(100);

      expect(fired).toHaveLength(1);
      expect(fired[0].eventId).toBe('event');
      expect(fired[0].status).toBe('fired');
    });

    it('should not fire events before fire time', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const fired = engine.processTick(99);

      expect(fired).toEqual([]);
    });

    it('should fire multiple events in same tick', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 100, 0);

      const fired = engine.processTick(100);
      expect(fired).toHaveLength(2);
    });

    it('should remove fired events from queue', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.processTick(100);

      const scheduled = engine.getScheduledEvents();
      expect(scheduled).toEqual([]);
    });

    it('should handle events firing after their scheduled time', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const fired = engine.processTick(150);

      expect(fired).toHaveLength(1);
    });
  });

  // =========================================================================
  // CANCELLATION TESTS
  // =========================================================================

  describe('cancelEvent', () => {
    it('should cancel a scheduled event', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const cancelled = engine.cancelEvent(result.scheduleId!);

      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent event', () => {
      const cancelled = engine.cancelEvent('invalid_id');
      expect(cancelled).toBe(false);
    });

    it('should remove cancelled event from queue', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.cancelEvent(result.scheduleId!);

      const scheduled = engine.getScheduledEvents();
      expect(scheduled).toEqual([]);
    });

    it('should move cancelled event to history', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.cancelEvent(result.scheduleId!);

      const history = engine.getEventHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].status).toBe('cancelled');
    });
  });

  // =========================================================================
  // STATISTICS TESTS
  // =========================================================================

  describe('getQueueStats', () => {
    it('should report queue statistics', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 50, 0);
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 150, 0);
      engine.scheduleEvent('event3', 'Event 3', 'story_beat', 600, 0);

      const stats = engine.getQueueStats(0);
      expect(stats.totalScheduled).toBe(3);
      expect(stats.imminentEvents).toBe(1); // < 100 ticks
      expect(stats.warningEvents).toBe(2); // < 500 ticks
      expect(stats.nextEventName).toBe('Event 1');
    });

    it('should report null next event when empty', () => {
      const stats = engine.getQueueStats(0);
      expect(stats.nextEventFireTime).toBeNull();
      expect(stats.nextEventName).toBeNull();
    });

    it('should update stats as tick progresses', () => {
      // Imminent = < 100 ticks away, Warning = < 500 ticks away
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 50, 0);    // Fires at tick 50
      engine.scheduleEvent('event2', 'Event 2', 'story_beat', 600, 0);   // Fires at tick 600

      const stats1 = engine.getQueueStats(0);
      // At tick 0: event1 is 50 away (imminent), event2 is 600 away (not warning)
      expect(stats1.imminentEvents).toBe(1);
      expect(stats1.warningEvents).toBe(1);

      const stats2 = engine.getQueueStats(550);
      // At tick 550: event1 is -500 away (already passed, but stillin past so < 100), event2 is 50 away (imminent)
      // Both are imminent (< 100)
      expect(stats2.imminentEvents).toBe(2);
    });
  });

  // =========================================================================
  // HISTORY TESTS
  // =========================================================================

  describe('getEventHistory', () => {
    it('should track fired events', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.processTick(100);

      const history = engine.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('fired');
    });

    it('should track cancelled events', () => {
      const result = engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      engine.cancelEvent(result.scheduleId!);

      const history = engine.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('cancelled');
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        const result = engine.scheduleEvent(`event${i}`, `Event ${i}`, 'story_beat', 100, 0);
        engine.cancelEvent(result.scheduleId!);
      }

      const history = engine.getEventHistory(2);
      expect(history).toHaveLength(2);
    });

    it('should maintain max history size', () => {
      // Schedule and cancel 600 events
      for (let i = 0; i < 600; i++) {
        const result = engine.scheduleEvent(`event${i}`, `Event ${i}`, 'story_beat', 100, 0);
        engine.cancelEvent(result.scheduleId!);
      }

      const history = engine.getEventHistory(1000);
      // History should be limited to ~500 entries
      expect(history.length).toBeLessThanOrEqual(510);
    });
  });

  // =========================================================================
  // EDGE CASES & INTEGRATION TESTS
  // =========================================================================

  describe('Complex Scheduling Scenarios', () => {
    it('should handle multiple events firing in sequence', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);
      engine.scheduleEvent('event2', 'Event 2', 'seasonal', 200, 0);
      engine.scheduleEvent('event3', 'Event 3', 'catastrophe', 300, 0);

      const fired1 = engine.processTick(100);
      expect(fired1).toHaveLength(1);

      const fired2 = engine.processTick(200);
      expect(fired2).toHaveLength(1);

      const fired3 = engine.processTick(300);
      expect(fired3).toHaveLength(1);
    });

    it('should handle scheduling event while others are in queue', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);

      const result = engine.scheduleEvent('event2', 'Event 2', 'seasonal', 100, 50);
      expect(result.success).toBe(true);
      expect(result.eventFireTime).toBe(150);

      const scheduled = engine.getScheduledEvents();
      expect(scheduled).toHaveLength(2);
    });

    it('should handle fire time collisions', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0, 50);
      engine.scheduleEvent('event2', 'Event 2', 'seasonal', 100, 0, 75);
      engine.scheduleEvent('event3', 'Event 3', 'catastrophe', 100, 0, 60);

      const fired = engine.processTick(100);
      expect(fired).toHaveLength(3);
      expect(fired.every(e => e.status === 'fired')).toBe(true);
    });
  });

  describe('clearExpired', () => {
    it('should remove expired events', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const cleared = engine.clearExpired(11000);

      expect(cleared).toBe(1);
      expect(engine.getScheduledEvents()).toEqual([]);
    });

    it('should not remove active events', () => {
      engine.scheduleEvent('event', 'Event', 'story_beat', 100, 0);
      const cleared = engine.clearExpired(500);

      expect(cleared).toBe(0);
      expect(engine.getScheduledEvents()).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0);
      engine.scheduleEvent('event2', 'Event 2', 'seasonal', 200, 0);

      engine.reset();

      expect(engine.getScheduledEvents()).toEqual([]);
      expect(engine.getEventHistory()).toEqual([]);
    });
  });

  describe('listScheduledEvents', () => {
    it('should format event list for display', () => {
      engine.scheduleEvent('event1', 'Event 1', 'story_beat', 100, 0, 50);
      engine.scheduleEvent('event2', 'Event 2', 'seasonal', 250, 0, 75);

      const list = engine.listScheduledEvents(0);
      expect(list).toContain('Event 1');
      expect(list).toContain('100 ticks');
      expect(list).toContain('story_beat');
      expect(list).toContain('severity: 50');
    });

    it('should return message when empty', () => {
      const list = engine.listScheduledEvents(0);
      expect(list).toBe('No events scheduled');
    });
  });
});
