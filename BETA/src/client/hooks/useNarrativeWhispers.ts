/**
 * Phase 3 Task 3: useNarrativeWhispers Hook
 * 
 * Tracks director whispers and relic whispers from event log
 * Manages whisper queue for display in NarrativeInterventionOverlay
 */

import { useState, useCallback, useEffect } from 'react';
import type { Event } from '../../events/mutationLog';

export interface WhisperDisplay {
  id: string;
  message: string;
  source: 'director' | 'relic' | 'npc';
  intensity: number; // 0-100
  narrativeWeight?: string; // 'whisper' | 'echo' | 'scream' | 'ambient'
  timestamp: number;
  durationMs: number;
  isActive: boolean;
}

export interface UseNarrativeWhispersResult {
  activeWhisper: WhisperDisplay | null;
  whisperHistory: WhisperDisplay[];
  addWhisper: (whisper: WhisperDisplay) => void;
  dismissWhisper: (id: string) => void;
  clearHistory: () => void;
}

/**
 * Hook: useNarrativeWhispers
 * 
 * Manages whisper queue and display state.
 * Whispers are displayed one at a time, with queuing for multiple events.
 */
export function useNarrativeWhispers(): UseNarrativeWhispersResult {
  const [whisperQueue, setWhisperQueue] = useState<WhisperDisplay[]>([]);
  const [activeWhisper, setActiveWhisper] = useState<WhisperDisplay | null>(null);
  const [whisperHistory, setWhisperHistory] = useState<WhisperDisplay[]>([]);

  // Add whisper to queue
  const addWhisper = useCallback((whisper: WhisperDisplay) => {
    setWhisperQueue(prev => [...prev, whisper]);
  }, []);

  // Dismiss current whisper and load next from queue
  const dismissWhisper = useCallback((id: string) => {
    if (activeWhisper?.id === id) {
      setActiveWhisper(null);
      // Add to history
      setWhisperHistory(prev => [...prev, { ...activeWhisper, isActive: false }]);
    }
  }, [activeWhisper]);

  // Clear history
  const clearHistory = useCallback(() => {
    setWhisperHistory([]);
  }, []);

  // Process queue: display next whisper when current is done
  useEffect(() => {
    if (activeWhisper || whisperQueue.length === 0) {
      return;
    }

    const nextWhisper = whisperQueue[0];
    const remainingQueue = whisperQueue.slice(1);

    setActiveWhisper(nextWhisper);
    setWhisperQueue(remainingQueue);

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      dismissWhisper(nextWhisper.id);
    }, nextWhisper.durationMs);

    return () => clearTimeout(timer);
  }, [activeWhisper, whisperQueue, dismissWhisper]);

  return {
    activeWhisper,
    whisperHistory,
    addWhisper,
    dismissWhisper,
    clearHistory
  };
}

/**
 * Convert Event to WhisperDisplay for rendering
 * Phase 7: Replaced `as any` casts with explicit type guards
 */
export function eventToWhisper(event: Event): WhisperDisplay | null {
  // Phase 7: Type guard for DIRECTOR_WHISPER
  if (event.type === 'DIRECTOR_WHISPER') {
    // Validate payload shape before accessing properties
    const payload = event.payload as Record<string, any> | undefined;
    if (!payload || typeof payload !== 'object') {
      console.warn('[eventToWhisper] DIRECTOR_WHISPER missing or invalid payload', event);
      return null;
    }
    
    const message = typeof payload.message === 'string' ? payload.message : 'Unknown whisper';
    const intensity = typeof payload.intensity === 'number' ? payload.intensity : 50;
    const narrativeWeight = typeof payload.narrativeWeight === 'string' ? payload.narrativeWeight : 'whisper';
    
    return {
      id: event.id,
      message,
      source: 'director',
      intensity: Math.max(0, Math.min(100, intensity)), // Clamp to 0-100
      narrativeWeight,
      timestamp: event.timestamp,
      durationMs: (typeof payload.durationTicks === 'number' ? payload.durationTicks * 16.67 : 5000),
      isActive: true
    };
  }

  // Phase 7: Type guard for RELIC_WHISPER
  if (event.type === 'RELIC_WHISPER') {
    // Validate payload shape before accessing properties
    const payload = event.payload as Record<string, any> | undefined;
    if (!payload || typeof payload !== 'object') {
      console.warn('[eventToWhisper] RELIC_WHISPER missing or invalid payload', event);
      return null;
    }
    
    const dialogue = typeof payload.dialogue === 'string' ? payload.dialogue : 'Relic speaks...';
    const sentienceLevel = typeof payload.sentienceLevel === 'number' ? payload.sentienceLevel : 25;
    
    return {
      id: event.id,
      message: dialogue,
      source: 'relic',
      intensity: Math.max(0, Math.min(100, sentienceLevel * 2)), // Scale 0-50 to 0-100, clamped
      narrativeWeight: 'echo',
      timestamp: event.timestamp,
      durationMs: 4000, // Shorter for relic whispers
      isActive: true
    };
  }

  return null;
}
