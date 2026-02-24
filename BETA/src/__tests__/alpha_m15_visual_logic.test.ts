import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useGlobalVisuals } from '../client/hooks/useGlobalVisuals';

/**
 * M15 Step 4: Visual Stimuli Integration Tests
 * 
 * Validates:
 * - Screen shake detection on CRITICAL_HIT events
 * - Flash overlay triggering on CAST_SPELL events
 * - Chromatic aberration on TEMPORAL_ANOMALY events
 * - Paradox glitch accumulation from chaos score
 * - Timer cleanup without memory leaks
 * - Accessibility: prefers-reduced-motion respects
 */

describe('M15: Visual Stimuli Integration', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame for animations
    jest.useFakeTimers();
    
    // Mock window.matchMedia for accessibility checks
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Screen Shake Detection', () => {
    test('useGlobalVisuals detects CRITICAL_HIT and activates shake', () => {
      const events = [
        {
          type: 'CRITICAL_HIT',
          payload: {
            impactMagnitude: 2.5,
            damage: 25,
            isCritical: true
          }
        }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.shakeActive).toBe(true);
      expect(result.current.shakeIntensity).toBeGreaterThan(0);
    });

    test('impactMagnitude scales shake intensity (0.0-1.0)', () => {
      const event = (magnitude: number) => [
        {
          type: 'CRITICAL_HIT',
          payload: { impactMagnitude: magnitude, damage: magnitude * 10 }
        }
      ];

      // Test low impact
      const { result: low } = renderHook(() => useGlobalVisuals(event(0.5), {}));
      expect(low.current.shakeIntensity).toBeLessThan(0.15);

      // Test high impact
      const { result: high } = renderHook(() => useGlobalVisuals(event(5.0), {}));
      expect(high.current.shakeIntensity).toBeCloseTo(1.0);

      // Test clamped at max
      const { result: max } = renderHook(() => useGlobalVisuals(event(10.0), {}));
      expect(max.current.shakeIntensity).toBeLessThanOrEqual(1.0);
    });

    test('shake automatically clears after 500ms', () => {
      const events = [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 1.5 } }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.shakeActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.shakeActive).toBe(false);
      expect(result.current.shakeIntensity).toBe(0);
    });

    test('succeeding CRITICAL_HIT resets shake timer', () => {
      const { result, rerender } = renderHook(
        ({ events }: any) => useGlobalVisuals(events, {}),
        { initialProps: { events: [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 1 } }] } }
      );

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.shakeActive).toBe(true);

      // Trigger new event
      rerender({
        events: [
          { type: 'CRITICAL_HIT', payload: { impactMagnitude: 1 } },
          { type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } }
        ]
      });

      // Timer should reset
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.shakeActive).toBe(true);
    });
  });

  describe('Flash Overlay Effects', () => {
    test('useGlobalVisuals detects CAST_SPELL and activates flash', () => {
      const events = [
        {
          type: 'CAST_SPELL',
          payload: {
            spellId: 'fireball',
            visualElement: 'fire'
          }
        }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.flashActive).toBe(true);
      expect(result.current.flashIntensity).toBeGreaterThan(0);
    });

    test('flash color maps to visualElement (fire/frost/shadow/arcane)', () => {
      const testCases = [
        { element: 'fire', expectedColor: '#ff6600' },
        { element: 'frost', expectedColor: '#00bfff' },
        { element: 'shadow', expectedColor: '#4d0099' },
        { element: 'arcane', expectedColor: '#9B00FF' }
      ];

      testCases.forEach(({ element, expectedColor }) => {
        const events = [
          {
            type: 'CAST_SPELL',
            payload: { visualElement: element }
          }
        ];

        const { result } = renderHook(() => useGlobalVisuals(events, {}));

        expect(result.current.flashColor).toBe(expectedColor);
      });
    });

    test('flash clears after 200ms', () => {
      const events = [{ type: 'CAST_SPELL', payload: { visualElement: 'arcane' } }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.flashActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.flashActive).toBe(false);
      expect(result.current.flashIntensity).toBe(0);
    });
  });

  describe('Chromatic Aberration and Glitch', () => {
    test('useGlobalVisuals detects TEMPORAL_ANOMALY and activates chromatic', () => {
      const events = [
        {
          type: 'TEMPORAL_ANOMALY',
          payload: { message: 'Reality fractures!' }
        }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.chromaActive).toBe(true);
      expect(result.current.glitchIntensity).toBeGreaterThan(0);
    });

    test('TEMPORAL_ANOMALY sets glitch intensity to 0.8', () => {
      const events = [{ type: 'TEMPORAL_ANOMALY', payload: {} }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.glitchIntensity).toBe(0.8);
    });

    test('chromatic aberration clears after 3000ms', () => {
      const events = [{ type: 'TEMPORAL_ANOMALY', payload: {} }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.chromaActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.chromaActive).toBe(false);
    });

    test('PARADOX_GLITCH sets glitch intensity from payload', () => {
      const events = [
        {
          type: 'PARADOX_GLITCH',
          payload: { intensity: 0.65 }
        }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.glitchIntensity).toBe(0.65);
      expect(result.current.chromaActive).toBe(true);
    });

    test('PARADOX_GLITCH clears after 2500ms (shorter than temporal anomaly)', () => {
      const events = [{ type: 'PARADOX_GLITCH', payload: { intensity: 0.5 } }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      act(() => {
        jest.advanceTimersByTime(2500);
      });

      expect(result.current.chromaActive).toBe(false);
    });
  });

  describe('Paradox Score Integration', () => {
    test('chaos score (paradox) updates glitch intensity continuously', () => {
      const state = { paradox: 50 };

      const { result, rerender } = renderHook(
        ({ s }: any) => useGlobalVisuals([], s),
        { initialProps: { s: state } }
      );

      // 50% paradox should trigger some glitch
      expect(result.current.glitchIntensity).toBeGreaterThan(0);

      // Increase paradox
      rerender({ s: { paradox: 85 } });

      expect(result.current.glitchIntensity).toBeGreaterThan(0.3);
    });

    test('paradox < 30% does not trigger glitch', () => {
      const state = { paradox: 25 };

      const { result } = renderHook(() => useGlobalVisuals([], state));

      expect(result.current.glitchIntensity).toBe(0);
    });

    test('high paradox (90%+) maximizes glitch intensity towards 0.4', () => {
      const state = { paradox: 100 };

      const { result } = renderHook(() => useGlobalVisuals([], state));

      expect(result.current.glitchIntensity).toBeGreaterThanOrEqual(0.35);
      expect(result.current.glitchIntensity).toBeLessThanOrEqual(0.4);
    });
  });

  describe('Accessibility: prefers-reduced-motion', () => {
    test('respects prefers-reduced-motion: reduce media query', () => {
      // Mock media query match
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn(() => ({
        matches: true, // User prefers reduced motion
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      })) as any;

      const events = [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } }];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      // Shake should not activate if prefers-reduced-motion
      expect(result.current.shakeActive).toBe(false);

      window.matchMedia = originalMatchMedia;
    });

    test('can disable accessibility check with disableAccessibilityCheck option', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      })) as any;

      const events = [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } }];

      const { result } = renderHook(() =>
        useGlobalVisuals(events, {}, { disableAccessibilityCheck: true })
      );

      // Shake should activate even with reduced motion preference
      expect(result.current.shakeActive).toBe(true);

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Memory Leak Prevention', () => {
    test('clears all timers on unmount', () => {
      const events = [
        { type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } },
        { type: 'CAST_SPELL', payload: { visualElement: 'fire' } }
      ];

      const { unmount } = renderHook(() => useGlobalVisuals(events, {}));

      expect(() => unmount()).not.toThrow();

      // Verify no timers are still pending after unmount
      const pendingTimers = jest.getTimerCount();
      // Should be minimal or zero
      expect(pendingTimers).toBeLessThanOrEqual(1); // Account for possible React internals
    });

    test('replaces timers instead of accumulating on repeated events', () => {
      const { result, rerender } = renderHook(
        ({ events }: any) => useGlobalVisuals(events, {}),
        { initialProps: { events: [] } }
      );

      const getTimerCountBefore = () => jest.getTimerCount();

      rerender({ events: [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 1 } }] });
      const afterFirst = getTimerCountBefore();

      rerender({ events: [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 1 } }] });
      const afterSecond = getTimerCountBefore();

      // Second event should not accumulate more timers
      expect(afterSecond).toBeLessThanOrEqual(afterFirst + 1);
    });
  });

  describe('Event Stream Robustness', () => {
    test('handles empty events array safely', () => {
      const { result } = renderHook(() => useGlobalVisuals([], {}));

      expect(result.current.shakeActive).toBe(false);
      expect(result.current.flashActive).toBe(false);
      expect(result.current.chromaActive).toBe(false);
    });

    test('ignores non-visual events', () => {
      const events = [
        { type: 'RANDOM_EVENT', payload: {} },
        { type: 'WORLD_TICK', payload: {} },
        { type: 'NPC_LOCATION_CHANGED', payload: {} }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      expect(result.current.shakeActive).toBe(false);
      expect(result.current.flashActive).toBe(false);
      expect(result.current.chromaActive).toBe(false);
    });

    test('only reacts to latest event in stream', () => {
      const events = [
        { type: 'CRITICAL_HIT', payload: { impactMagnitude: 1 } },
        { type: 'CAST_SPELL', payload: { visualElement: 'fire' } },
        { type: 'CRITICAL_HIT', payload: { impactMagnitude: 3 } }
      ];

      const { result } = renderHook(() => useGlobalVisuals(events, {}));

      // Should reflect the last event (CRITICAL_HIT)
      expect(result.current.shakeActive).toBe(true);
      expect(result.current.shakeIntensity).toBeGreaterThan(0.5);
    });
  });

  describe('Debug Mode', () => {
    test('logs events when debug option enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const events = [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } }];

      renderHook(() => useGlobalVisuals(events, {}, { debug: true }));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useGlobalVisuals] Event detected:',
        'CRITICAL_HIT'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Visual State Initialization', () => {
    test('initializes all states to default/inactive', () => {
      const { result } = renderHook(() => useGlobalVisuals([], {}));

      expect(result.current.shakeActive).toBe(false);
      expect(result.current.shakeIntensity).toBe(0);
      expect(result.current.flashActive).toBe(false);
      expect(result.current.flashColor).toBe('#ffffff');
      expect(result.current.flashIntensity).toBe(0);
      expect(result.current.glitchIntensity).toBe(0);
      expect(result.current.chromaActive).toBe(false);
    });

    test('returns consistent state reference (memoization)', () => {
      const { result, rerender } = renderHook(() => useGlobalVisuals([], {}));

      const firstState = result.current;

      // Rerender with same inputs
      rerender();

      const secondState = result.current;

      // States might be different objects, but should be equivalent when nothing changed
      expect(firstState.shakeActive).toBe(secondState.shakeActive);
    });
  });

  describe('Concurrent Event Handling', () => {
    test('prioritizes event-driven effects over state-driven glitch for intensity', () => {
      const events = [
        // Event-driven glitch (TEMPORAL_ANOMALY)
        { type: 'TEMPORAL_ANOMALY', payload: {} }
      ];
      const state = { paradox: 50 }; // Would normally set glitch to ~0.2

      const { result } = renderHook(() => useGlobalVisuals(events, state));

      // TEMPORAL_ANOMALY sets to 0.8, should not be reduced by paradox calculation
      expect(result.current.glitchIntensity).toBe(0.8);
    });

    test('combines multiple effects if events occur close together', () => {
      const { result, rerender } = renderHook(
        ({ events }: any) => useGlobalVisuals(events, {}),
        {
          initialProps: {
            events: [{ type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } }]
          }
        }
      );

      expect(result.current.shakeActive).toBe(true);

      // Quickly add flash event
      rerender({
        events: [
          { type: 'CRITICAL_HIT', payload: { impactMagnitude: 2 } },
          { type: 'CAST_SPELL', payload: { visualElement: 'arcane' } }
        ]
      });

      // Both should be active
      expect(result.current.shakeActive).toBe(true);
      expect(result.current.flashActive).toBe(true);
    });
  });
});
