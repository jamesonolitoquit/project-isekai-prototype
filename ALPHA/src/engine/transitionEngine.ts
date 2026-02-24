/**
 * M42 Task 5: Transition Engine
 *
 * Purpose: Manage cinematic world state transitions with glitch effects
 * Triggers: Epoch shifts, world resets, paradox resolutions
 * Design: Event-driven system with subscription callbacks
 */

export type TransitionReason = 'paradox' | 'epoch_shift' | 'world_reset' | 'faction_restructure';

export interface TransitionMetadata {
  reason: TransitionReason;
  startTick: number;
  estimatedDuration: number; // in milliseconds
  actualDuration?: number;
  completed: boolean;
}

export interface TransitionEvent {
  type: 'START' | 'FINISH';
  metadata: TransitionMetadata;
}

/**
 * Event subscription callback type
 */
export type TransitionCallback = (event: TransitionEvent) => void;

/**
 * Transition Engine - Manages cinematic overlay state during world rebuilds
 */
class TransitionEngine {
  private activeTransition: TransitionMetadata | null = null;
  private subscribers: Set<TransitionCallback> = new Set();
  private transitionHistory: TransitionMetadata[] = [];

  /**
   * Start a world transition with cinematic overlay
   */
  startWorldTransition(reason: TransitionReason, estimatedDuration: number = 800): void {
    if (this.activeTransition) {
      console.warn('Transition already active, ignoring new transition request');
      return;
    }

    const metadata: TransitionMetadata = {
      reason,
      startTick: Date.now(),
      estimatedDuration,
      completed: false
    };

    this.activeTransition = metadata;

    // Broadcast start event to all subscribers
    const event: TransitionEvent = {
      type: 'START',
      metadata
    };

    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Transition subscriber error:', error);
      }
    });
  }

  /**
   * Finish the current world transition
   */
  finishWorldTransition(): void {
    if (!this.activeTransition) {
      console.warn('No active transition to finish');
      return;
    }

    const endTick = Date.now();
    const actualDuration = endTick - this.activeTransition.startTick;

    this.activeTransition.actualDuration = actualDuration;
    this.activeTransition.completed = true;

    // Store in history
    this.transitionHistory.push({ ...this.activeTransition });

    // Broadcast finish event
    const event: TransitionEvent = {
      type: 'FINISH',
      metadata: this.activeTransition
    };

    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Transition subscriber error:', error);
      }
    });

    // Clear active transition
    this.activeTransition = null;
  }

  /**
   * Subscribe to transition events
   */
  subscribeToTransition(callback: TransitionCallback): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current transition state
   */
  getCurrentTransition(): TransitionMetadata | null {
    return this.activeTransition ? { ...this.activeTransition } : null;
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): readonly TransitionMetadata[] {
    return [...this.transitionHistory];
  }

  /**
   * Check if a transition is currently active
   */
  isTransitioning(): boolean {
    return this.activeTransition !== null;
  }

  /**
   * Force cancel current transition (emergency cleanup)
   */
  cancelTransition(): void {
    if (this.activeTransition) {
      console.warn('Force cancelling active transition');
      this.activeTransition.completed = false;
      this.activeTransition.actualDuration = Date.now() - this.activeTransition.startTick;
      this.transitionHistory.push({ ...this.activeTransition });
      this.activeTransition = null;
    }
  }

  /**
   * Clear old transition history (keep last N entries)
   */
  clearHistory(keepLast: number = 10): void {
    if (this.transitionHistory.length > keepLast) {
      this.transitionHistory = this.transitionHistory.slice(-keepLast);
    }
  }
}

// Singleton instance
export const transitionEngine = new TransitionEngine();

// Export types for external use
export type { TransitionEngine };
