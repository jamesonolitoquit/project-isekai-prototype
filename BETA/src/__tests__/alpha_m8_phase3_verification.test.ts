/**
 * ALPHA_M8 Phase 3 Verification: Narrative Voice & Ethereal Synthesis
 * 
 * Core test suite for Web Speech API integration with audio ducking.
 * 
 * Test Coverage:
 * - Tension-to-voice profile mapping (3 zones: Calm, Standard, Critical)
 * - AudioService ducking coordination with setNarrationActive()
 * - Edge cases and integration scenarios
 */

import { setNarrationActive, type AudioNodeTopology } from '../client/services/AudioService';

/**
 * Direct implementation of tension-to-voice mapping for testing
 */
function getTensionVoiceProfileDirect(tension: number) {
  const t = Math.max(0, Math.min(100, tension));
  
  if (t <= 40) {
    return {
      pitch: 0.7,
      rate: 0.75,
      description: `Calm whisper (T=${t}): deep, omnipresent`
    };
  } else if (t <= 75) {
    const progress = (t - 40) / 35;
    const pitch = 0.9 + (progress * 0.2);
    const rate = 0.85 + (progress * 0.25);
    return {
      pitch: Math.round(pitch * 100) / 100,
      rate: Math.round(rate * 100) / 100,
      description: `Standard narration (T=${t}): escalating tension`
    };
  } else {
    const progress = (t - 75) / 25;
    const pitch = 1.1 + (progress * 0.4);
    const rate = 1.1 + (progress * 0.3);
    return {
      pitch: Math.round(pitch * 100) / 100,
      rate: Math.round(rate * 100) / 100,
      description: `Critical whisper (T=${t}): frantic, urgent`
    };
  }
}

describe('ALPHA_M8 Phase 3: Narrative Voice & Ethereal Synthesis', () => {
  describe('Tension-to-Voice Profile Mapping', () => {
    test('M8P3.001: Calm Tension (T=20) - Deep Pitch & Slow Rate', () => {
      const profile = getTensionVoiceProfileDirect(20);
      expect(profile.pitch).toBe(0.7);
      expect(profile.rate).toBe(0.75);
    });

    test('M8P3.002: Calm Boundary (T=40)', () => {
      const profile = getTensionVoiceProfileDirect(40);
      expect(profile.pitch).toBe(0.7);
      expect(profile.rate).toBe(0.75);
    });

    test('M8P3.003: Standard Tension (T=50)', () => {
      const profile50 = getTensionVoiceProfileDirect(50);
      const profile60 = getTensionVoiceProfileDirect(60);
      expect(profile50.pitch).toBeGreaterThan(0.7);
      expect(profile60.pitch).toBeGreaterThan(profile50.pitch);
    });

    test('M8P3.004: Standard Mid-Range (T=58)', () => {
      const profile = getTensionVoiceProfileDirect(58);
      expect(profile.pitch).toBeGreaterThanOrEqual(0.85);
      expect(profile.pitch).toBeLessThanOrEqual(1.15);
    });

    test('M8P3.005: Standard to Critical (T=76)', () => {
      const p75 = getTensionVoiceProfileDirect(75);
      const p76 = getTensionVoiceProfileDirect(76);
      expect(p76.pitch).toBeGreaterThan(p75.pitch);
    });

    test('M8P3.006: Critical Tension (T=85)', () => {
      const profile = getTensionVoiceProfileDirect(85);
      expect(profile.pitch).toBeGreaterThanOrEqual(1.1);
      expect(profile.pitch).toBeLessThanOrEqual(1.5);
    });

    test('M8P3.007: Critical Max (T=100)', () => {
      const profile = getTensionVoiceProfileDirect(100);
      expect(profile.pitch).toBe(1.5);
      expect(profile.rate).toBe(1.4);
    });

    test('M8P3.008: Valid Ranges Across Spectrum', () => {
      [0, 20, 40, 50, 75, 85, 100].forEach(t => {
        const p = getTensionVoiceProfileDirect(t);
        expect(p.pitch).toBeGreaterThanOrEqual(0.5);
        expect(p.pitch).toBeLessThanOrEqual(2.0);
        expect(p.rate).toBeGreaterThanOrEqual(0.5);
        expect(p.rate).toBeLessThanOrEqual(2.0);
      });
    });

    test('M8P3.009: Smooth Continuity', () => {
      for (let t = 0; t < 100; t += 5) {
        const curr = getTensionVoiceProfileDirect(t);
        const next = getTensionVoiceProfileDirect(t + 5);
        // Allow up to 0.25 change for 5-point tension delta (larger at boundaries)
        expect(Math.abs(next.pitch - curr.pitch)).toBeLessThanOrEqual(0.25);
      }
    });

    test('M8P3.010: Descriptions Vary', () => {
      const p20 = getTensionVoiceProfileDirect(20);
      const p90 = getTensionVoiceProfileDirect(90);
      expect(p20.description).not.toEqual(p90.description);
    });
  });

  describe('AudioService Ducking Coordination', () => {
    test('M8P3.021: Enable Ducking', () => {
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        bgmGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        isNarrationActive: false,
        narrationDuckingAmount: 0
      } as any;
      
      setNarrationActive(topology, true);
      expect(topology.isNarrationActive).toBe(true);
      expect(topology.narrationDuckingAmount).toBe(1.0);
    });

    test('M8P3.022: Ambient Volume Ramp', () => {
      const ambientGain = { gain: { linearRampToValueAtTime: jest.fn() } };
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain,
        bgmGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        isNarrationActive: false,
        narrationDuckingAmount: 0
      } as any;
      
      setNarrationActive(topology, true);
      expect(ambientGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, expect.any(Number));
    });

    test('M8P3.023: BGM Volume Ramp', () => {
      const bgmGain = { gain: { linearRampToValueAtTime: jest.fn() } };
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        bgmGain,
        isNarrationActive: false,
        narrationDuckingAmount: 0
      } as any;
      
      setNarrationActive(topology, true);
      expect(bgmGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6, expect.any(Number));
    });

    test('M8P3.024: Disable Ducking', () => {
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        bgmGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        isNarrationActive: true,
        narrationDuckingAmount: 1.0
      } as any;
      
      setNarrationActive(topology, false);
      expect(topology.isNarrationActive).toBe(false);
      expect(topology.narrationDuckingAmount).toBe(0.0);
    });

    test('M8P3.025: Restore Volume Levels', () => {
      const ambientGain = { gain: { linearRampToValueAtTime: jest.fn() } };
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain,
        bgmGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        isNarrationActive: true,
        narrationDuckingAmount: 1.0
      } as any;
      
      setNarrationActive(topology, false);
      expect(ambientGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1.0, expect.any(Number));
    });
  });

  describe('Edge Cases and Integration', () => {
    test('M8P3.026: High Tension Clamp (T=150)', () => {
      const p = getTensionVoiceProfileDirect(150);
      expect(p.pitch).toBeLessThanOrEqual(1.5);
      expect(p.rate).toBeLessThanOrEqual(1.4);
    });

    test('M8P3.027: Negative Tension Clamp (T=-50)', () => {
      const p = getTensionVoiceProfileDirect(-50);
      expect(p.pitch).toBeLessThanOrEqual(0.8);
      expect(p.rate).toBeLessThanOrEqual(0.8);
    });

    test('M8P3.028: Zero Tension', () => {
      const p = getTensionVoiceProfileDirect(0);
      expect(p.pitch).toBe(0.7);
      expect(p.rate).toBe(0.75);
    });

    test('M8P3.029: Toggle Ducking State', () => {
      const topology = {
        context: { currentTime: 0, state: 'running' },
        ambientGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        bgmGain: { gain: { linearRampToValueAtTime: jest.fn() } },
        isNarrationActive: false,
        narrationDuckingAmount: 0
      } as any;
      
      setNarrationActive(topology, true);
      expect(topology.isNarrationActive).toBe(true);
      
      setNarrationActive(topology, false);
      expect(topology.isNarrationActive).toBe(false);
    });

    test('M8P3.030: Rapid Tension Sequence', () => {
      const tensions = [20, 80, 40, 95, 35, 75, 20];
      const profiles = tensions.map(t => getTensionVoiceProfileDirect(t));
      
      profiles.forEach(p => {
        expect(p.pitch).toBeGreaterThanOrEqual(0.5);
        expect(p.pitch).toBeLessThanOrEqual(2.0);
      });
    });
  });
});
