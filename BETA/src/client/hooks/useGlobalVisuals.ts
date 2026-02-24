/**
 * Global Visual Impulse Hook - M15 Step 4: Visual Stimuli Integration
 * 
 * Manages viewport-wide distortion effects:
 * - Screen shake on CRITICAL_HIT (impact feedback)
 * - Chromatic aberration on TEMPORAL_ANOMALY (reality distortion)
 * - Paradox glitch based on chaos score
 * 
 * Performance: Uses transform and opacity only (GPU-accelerated, 60fps-safe)
 * Accessibility: Respects prefers-reduced-motion media query
 */

import { useEffect, useState, useRef } from 'react';

export interface VisualState {
  shakeActive: boolean;
  shakeIntensity: number; // 0.0-1.0 (scales displacement)
  flashActive: boolean;
  flashColor: string; // For spell casting effects
  flashIntensity: number; // 0.0-1.0
  glitchIntensity: number; // 0.0-1.0 (from paradox/chaos)
  chromaActive: boolean; // Chromatic aberration on paradox events
}

interface UseGlobalVisualsOptions {
  disableAccessibilityCheck?: boolean;
  debug?: boolean;
}

/**
 * Hook to track and manage global visual impulses
 * Monitors event stream and automatically manages state cleanup
 */
export function useGlobalVisuals(
  events: any[] = [],
  state: any = null,
  options: UseGlobalVisualsOptions = {}
): VisualState {
  const { disableAccessibilityCheck = false, debug = false } = options;

  const [visuals, setVisuals] = useState<VisualState>({
    shakeActive: false,
    shakeIntensity: 0,
    flashActive: false,
    flashColor: '#ffffff',
    flashIntensity: 0,
    glitchIntensity: 0,
    chromaActive: false
  });

  // Refs to track timers without re-rendering (prevents memory leaks)
  const shakeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chromaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedCountRef = useRef<number>(0);

  // Check if user prefers reduced motion
  const prefersReducedMotion = !disableAccessibilityCheck && 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Monitor event stream for visual triggers
  useEffect(() => {
    if (!events || events.length === 0) return;

    // Only process if we have NEW events (count increased)
    if (lastProcessedCountRef.current >= events.length) return;

    // Track the new event count to avoid reprocessing
    const newEventCount = events.length;

    if (debug) {
      console.log('[useGlobalVisuals] Processing events, count:', newEventCount);
    }

    // Process ALL events in the array (not just latest) to catch concurrent effects
    for (let i = lastProcessedCountRef.current; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      if (debug) {
        console.log('[useGlobalVisuals] Event detected:', event.type);
      }

      // CRITICAL_HIT → Screen shake for 500ms
      if (event.type === 'CRITICAL_HIT' && !prefersReducedMotion) {
        const impactMagnitude = event.payload?.impactMagnitude || 1;
        const intensity = Math.min(1.0, impactMagnitude / 5); // Normalize to 0-1 range

        if (debug) {
          console.log('[useGlobalVisuals] CRITICAL_HIT shake triggered, intensity:', intensity);
        }

        // Clear existing shake timer to reset countdown
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);

        setVisuals(v => ({
          ...v,
          shakeActive: true,
          shakeIntensity: intensity
        }));

        // Auto-clear after 500ms (critical hit duration)
        shakeTimerRef.current = setTimeout(() => {
          if (debug) console.log('[useGlobalVisuals] Shake cleanup');
          setVisuals(v => ({
            ...v,
            shakeActive: false,
            shakeIntensity: 0
          }));
        }, 500);
      }

      // CAST_SPELL → Flash overlay (element-colored) for 200ms
      if (event.type === 'CAST_SPELL' && !prefersReducedMotion) {
        const visualElement = event.payload?.visualElement || 'arcane';
        const flashColorMap: Record<string, string> = {
          fire: '#ff6600',
          frost: '#00bfff',
          shadow: '#4d0099',
          arcane: '#9B00FF'
        };
        const color = flashColorMap[visualElement] || '#9B00FF';

        if (debug) {
          console.log('[useGlobalVisuals] CAST_SPELL flash triggered, color:', color);
        }

        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);

        setVisuals(v => ({
          ...v,
          flashActive: true,
          flashColor: color,
          flashIntensity: 0.3
        }));

        flashTimerRef.current = setTimeout(() => {
          if (debug) console.log('[useGlobalVisuals] Flash cleanup');
          setVisuals(v => ({
            ...v,
            flashActive: false,
            flashIntensity: 0
          }));
        }, 200);
      }

      // TEMPORAL_ANOMALY → Chromatic aberration + glitch for 3s
      if (event.type === 'TEMPORAL_ANOMALY' && !prefersReducedMotion) {
        if (debug) {
          console.log('[useGlobalVisuals] TEMPORAL_ANOMALY chromatic triggered');
        }

        if (chromaTimerRef.current) clearTimeout(chromaTimerRef.current);

        setVisuals(v => ({
          ...v,
          chromaActive: true,
          glitchIntensity: 0.8
        }));

        chromaTimerRef.current = setTimeout(() => {
          if (debug) console.log('[useGlobalVisuals] Chromatic cleanup');
          setVisuals(v => ({
            ...v,
            chromaActive: false,
            glitchIntensity: 0
          }));
        }, 3000);
      }

      // PARADOX_GLITCH → Glitch intensity immediately
      if (event.type === 'PARADOX_GLITCH' && !prefersReducedMotion) {
        const glitchIntensity = event.payload?.intensity || 0.5;
        if (debug) {
          console.log('[useGlobalVisuals] PARADOX_GLITCH triggered, intensity:', glitchIntensity);
        }

        setVisuals(v => ({
          ...v,
          glitchIntensity,
          chromaActive: true
        }));

        if (chromaTimerRef.current) clearTimeout(chromaTimerRef.current);

        chromaTimerRef.current = setTimeout(() => {
          if (debug) console.log('[useGlobalVisuals] Paradox glitch cleanup');
          setVisuals(v => ({
            ...v,
            chromaActive: false,
            glitchIntensity: 0
          }));
        }, 2500); // Shorter duration than temporal anomaly
      }
    }

    // Update processed count after handling all new events
    lastProcessedCountRef.current = newEventCount;
  }, [events, prefersReducedMotion, debug]);

  // Monitor paradox score for continuous glitch background
  useEffect(() => {
    if (!state || prefersReducedMotion) return;

    const chaosScore = state.paradox || state.player?.paradoxLevel || 0;
    const normalizedChaos = Math.min(1.0, chaosScore / 100); // 0-1 range

    if (normalizedChaos > 0.3) {
      // Only update if there's meaningful chaos (30%+)
      setVisuals(v => ({
        ...v,
        glitchIntensity: Math.max(v.glitchIntensity, normalizedChaos * 0.4) // Don't override event-driven glitch
      }));
    }
  }, [state, prefersReducedMotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (chromaTimerRef.current) clearTimeout(chromaTimerRef.current);
    };
  }, []);

  return visuals;
}
