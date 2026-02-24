/**
 * M42 Phase 4 Task 2: Live Ops Event Scheduler
 *
 * Purpose: Manage queued, scheduled world events for seasonal content, deity interventions, world resets
 * Design: Maintains event queue with scheduled fire times; auto-triggers when time arrives
 * Integration: DirectorCommandEngine (`/schedule_event`, `/queue_events`, `/cancel_event`)
 * Display: DiagnosticPanel countdown timers + upcoming events forecast
 */

import { WorldState } from './worldEngine';

/**
 * Scheduled event waiting in queue
 */
export interface ScheduledEvent {
  scheduleId: string;           // Unique schedule reference
  eventId: string;              // Base event identifier
  eventName: string;            // Human-readable name
  category: string;             // 'seasonal', 'world_reset', 'deity_intervention', 'catastrophe', 'story_beat'
  scheduledFireTick: number;    // World tick when event should trigger
  severity: number;             // 0-100
  description: string;
  icon?: string;
  factionImpact?: string[];
  createdBy?: string;           // 'director' or 'system'
  createdAtTick: number;
  status: 'queued' | 'fired' | 'cancelled' | 'expired';
}

/**
 * Result of schedule operation
 */
export interface ScheduleResult {
  success: boolean;
  message: string;
  scheduleId?: string;
  eventFireTime?: number;
}

/**
 * Event queue statistics
 */
export interface QueueStats {
  totalScheduled: number;
  imminentEvents: number;      // Firing within 100 ticks
  warningEvents: number;        // Firing within 500 ticks
  nextEventFireTime: number | null;
  nextEventName: string | null;
}

/**
 * Live Ops Engine - Manages scheduled event queue
 */
export class LiveOpsEngine {
  private scheduledEvents: Map<string, ScheduledEvent> = new Map();
  private scheduleIdCounter = 0;
  private eventHistory: ScheduledEvent[] = [];
  private readonly maxHistorySize = 500;

  /**
   * Schedule an event to fire at a specific game tick
   */
  scheduleEvent(
    eventId: string,
    eventName: string,
    category: string,
    delayTicks: number,
    currentTick: number,
    severity: number = 50,
    description: string = '',
    options?: {
      icon?: string;
      factionImpact?: string[];
      createdBy?: string;
    }
  ): ScheduleResult {
    try {
      // Validation
      if (!eventId || eventId.trim().length === 0) {
        return { success: false, message: 'Event ID cannot be empty' };
      }

      if (delayTicks < 0) {
        return { success: false, message: 'Delay must be non-negative' };
      }

      if (delayTicks === 0) {
        return { success: false, message: 'Delay must be at least 1 tick' };
      }

      if (severity < 0 || severity > 100) {
        return { success: false, message: 'Severity must be between 0-100' };
      }

      const scheduleId = `sched_${++this.scheduleIdCounter}`;
      const scheduledFireTick = currentTick + delayTicks;

      const scheduled: ScheduledEvent = {
        scheduleId,
        eventId,
        eventName: eventName || eventId,
        category: category || 'story_beat',
        scheduledFireTick,
        severity,
        description: description || `Scheduled event: ${eventId}`,
        icon: options?.icon,
        factionImpact: options?.factionImpact,
        createdBy: options?.createdBy || 'system',
        createdAtTick: currentTick,
        status: 'queued'
      };

      this.scheduledEvents.set(scheduleId, scheduled);

      return {
        success: true,
        message: `Event scheduled: ${eventName} (ID: ${scheduleId}) firing in ${delayTicks} ticks`,
        scheduleId,
        eventFireTime: scheduledFireTick
      };
    } catch (error) {
      return { success: false, message: `Schedule failed: ${error}` };
    }
  }

  /**
   * Cancel a scheduled event
   */
  cancelEvent(scheduleId: string): boolean {
    const scheduled = this.scheduledEvents.get(scheduleId);
    if (!scheduled) {
      return false;
    }

    scheduled.status = 'cancelled';
    this.scheduledEvents.delete(scheduleId);
    
    // Add to history and maintain size limit
    this.eventHistory.push(scheduled);
    while (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    return true;
  }

  /**
   * Process scheduled events for current tick
   * Returns events that should fire this tick
   */
  processTick(currentTick: number): ScheduledEvent[] {
    const firedEvents: ScheduledEvent[] = [];

    // Check all scheduled events
    for (const [scheduleId, scheduled] of this.scheduledEvents.entries()) {
      if (scheduled.status !== 'queued') continue;

      // Check if event should fire this tick
      if (scheduled.scheduledFireTick <= currentTick) {
        scheduled.status = 'fired';
        firedEvents.push(scheduled);

        // Move to history and maintain size limit
        this.eventHistory.push(scheduled);
        while (this.eventHistory.length > this.maxHistorySize) {
          this.eventHistory.shift();
        }

        // Remove from active queue
        this.scheduledEvents.delete(scheduleId);
      }
    }

    return firedEvents;
  }

  /**
   * Get all currently scheduled events
   */
  getScheduledEvents(): ScheduledEvent[] {
    return Array.from(this.scheduledEvents.values()).filter(e => e.status === 'queued');
  }

  /**
   * Get upcoming events sorted by fire time
   */
  getUpcomingEvents(limit: number = 10): ScheduledEvent[] {
    return this.getScheduledEvents()
      .sort((a, b) => a.scheduledFireTick - b.scheduledFireTick)
      .slice(0, limit);
  }

  /**
   * Get next event to fire
   */
  getNextEvent(): ScheduledEvent | null {
    const upcoming = this.getUpcomingEvents(1);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(currentTick: number): QueueStats {
    const scheduled = this.getScheduledEvents();
    const nextEvent = this.getNextEvent();

    return {
      totalScheduled: scheduled.length,
      imminentEvents: scheduled.filter(e => e.scheduledFireTick - currentTick < 100).length,
      warningEvents: scheduled.filter(e => e.scheduledFireTick - currentTick < 500).length,
      nextEventFireTime: nextEvent?.scheduledFireTick || null,
      nextEventName: nextEvent?.eventName || null
    };
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 20): ScheduledEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear old scheduled events (expired after some time)
   */
  clearExpired(currentTick: number, expirationWindow: number = 10000): number {
    let cleared = 0;
    for (const [scheduleId, scheduled] of this.scheduledEvents.entries()) {
      if (scheduled.scheduledFireTick + expirationWindow < currentTick) {
        scheduled.status = 'expired';
        this.scheduledEvents.delete(scheduleId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Reset engine (clear all scheduled events)
   */
  reset(): void {
    this.scheduledEvents.clear();
    this.eventHistory = [];
    this.scheduleIdCounter = 0;
  }

  /**
   * Get a scheduled event by ID
   */
  getScheduledEventById(scheduleId: string): ScheduledEvent | null {
    return this.scheduledEvents.get(scheduleId) || null;
  }

  /**
   * List all scheduled events with formatting
   */
  listScheduledEvents(currentTick: number): string {
    const scheduled = this.getScheduledEvents();

    if (scheduled.length === 0) {
      return 'No events scheduled';
    }

    const sorted = scheduled.sort((a, b) => a.scheduledFireTick - b.scheduledFireTick);

    return sorted
      .map(event => {
        const eta = Math.max(0, event.scheduledFireTick - currentTick);
        return `[${event.scheduleId}] ${event.eventName} (${event.category}) - ${eta} ticks (severity: ${event.severity})`;
      })
      .join('\n');
  }
}

/**
 * Singleton instance of Live Ops Engine
 */
export const liveOpsEngine = new LiveOpsEngine();

// Types are already exported above as interfaces
