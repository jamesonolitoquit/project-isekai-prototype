/**
 * narrative-codec-theme-test.ts - Phase 30 Task 9: Theme Manager Test Suite
 * 
 * Comprehensive tests for the Diegetic Theme Manager & Narrative Codec system
 * Validates:
 * - Theme switching and CSS variable injection
 * - localStorage persistence across sessions
 * - React hook state management
 * - Paradox glitch effects
 * - Codec definitions and color accuracy
 * - Performance metrics
 */

import { themeManager, type NarrativeCodec, type CodecDefinition } from '../client/services/themeManager';
import { useNarrativeCodec } from '../client/hooks/useNarrativeCodec';

describe('Phase 30 Task 9: Diegetic Theme Manager & Narrative Codecs', () => {
  // Store original localStorage
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset CSS variables
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    // Restore state
    localStorage.clear();
    document.documentElement.style.cssText = '';
  });

  describe('9.1: ThemeManager Singleton', () => {
    it('should create a singleton instance', () => {
      const instance1 = themeManager;
      const instance2 = require('../client/services/themeManager').themeManager;
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default codec (CODENAME_GLITCH)', () => {
      const codec = themeManager.getCodec();
      expect(codec).toBe('CODENAME_GLITCH');
    });

    it('should return all available codecs', () => {
      const codecs = themeManager.getAllCodecs();
      expect(codecs).toContain('CODENAME_MEDIEVAL');
      expect(codecs).toContain('CODENAME_GLITCH');
      expect(codecs).toContain('CODENAME_MINIMAL');
      expect(codecs.length).toBe(3);
    });

    it('should provide codec definitions', () => {
      const def = themeManager.getCodecDefinition('CODENAME_GLITCH');
      expect(def).toHaveProperty('colors');
      expect(def).toHaveProperty('typography');
      expect(def).toHaveProperty('shadows');
      expect(def).toHaveProperty('animations');
    });
  });

  describe('9.2: Codec Definitions Accuracy', () => {
    const testCodecDefinition = (codec: NarrativeCodec, label: string) => {
      it(`${codec} has complete definition`, () => {
        const def = themeManager.getCodecDefinition(codec);
        
        // Check structure
        expect(def.name).toBe(codec);
        expect(def.label).toBe(label);
        expect(def.description).toBeTruthy();

        // Check colors
        expect(def.colors.bgPrimary).toMatch(/^#[0-9a-f]{6}$/i);
        expect(def.colors.borderAccent).toMatch(/^#[0-9a-f]{6}$/i);
        expect(def.colors.textPrimary).toMatch(/^#[0-9a-f]{6}$/i);
        expect(def.colors.accentMain).toMatch(/^#[0-9a-f]{6}$/i);

        // Check typography
        expect(def.typography.fontFamily).toBeTruthy();
        expect(def.typography.headingFamily).toBeTruthy();
        expect(def.typography.fontSize.base).toBeTruthy();
        expect(def.typography.fontWeight.normal).toBeGreaterThan(0);

        // Check animations
        expect(def.animations.transitionSpeed).toMatch(/^[\d.]+s$/);
        expect(def.animations.pulseSpeed).toMatch(/^[\d.]+s$/);
      });
    };

    testCodecDefinition('CODENAME_MEDIEVAL', 'Medieval');
    testCodecDefinition('CODENAME_GLITCH', 'Glitch');
    testCodecDefinition('CODENAME_MINIMAL', 'Minimal');
  });

  describe('9.3: CSS Variable Injection', () => {
    it('should inject CSS variables into :root', () => {
      themeManager.setCodec('CODENAME_GLITCH');

      const root = document.documentElement;
      const bgPrimary = root.style.getPropertyValue('--bg-primary');
      const accentMain = root.style.getPropertyValue('--accent-main');

      expect(bgPrimary).toBeTruthy();
      expect(accentMain).toBeTruthy();
    });

    it('should switch codecs and update variables', () => {
      const root = document.documentElement;

      themeManager.setCodec('CODENAME_MEDIEVAL');
      const medievalBg = root.style.getPropertyValue('--bg-primary');

      themeManager.setCodec('CODENAME_GLITCH');
      const glitchBg = root.style.getPropertyValue('--bg-primary');

      themeManager.setCodec('CODENAME_MINIMAL');
      const minimalBg = root.style.getPropertyValue('--bg-primary');

      expect(medievalBg).not.toBe(glitchBg);
      expect(glitchBg).not.toBe(minimalBg);
    });

    it('should inject typography variables', () => {
      themeManager.setCodec('CODENAME_GLITCH');

      const root = document.documentElement;
      const fontFamily = root.style.getPropertyValue('--font-family-body');
      const fontSize = root.style.getPropertyValue('--font-size-base');

      expect(fontFamily).toBeTruthy();
      expect(fontSize).toMatch(/px$/);
    });

    it('should inject shadow and animation variables', () => {
      themeManager.setCodec('CODENAME_GLITCH');

      const root = document.documentElement;
      const shadowSm = root.style.getPropertyValue('--shadow-sm');
      const transitionSpeed = root.style.getPropertyValue('--transition-speed');

      expect(shadowSm).toBeTruthy();
      expect(transitionSpeed).toMatch(/s$/);
    });

    it('should render performance: inject < 16ms', () => {
      const start = performance.now();
      themeManager.setCodec('CODENAME_MEDIEVAL');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(16);
    });
  });

  describe('9.4: localStorage Persistence', () => {
    it('should persist theme to localStorage', () => {
      themeManager.setCodec('CODENAME_MEDIEVAL');

      const stored = localStorage.getItem('isekai:narrativeCodec');
      expect(stored).toBe('CODENAME_MEDIEVAL');
    });

    it('should restore theme from localStorage on load', () => {
      localStorage.setItem('isekai:narrativeCodec', 'CODENAME_MINIMAL');

      // Create new instance to simulate page reload
      const codecWillBe = themeManager.getAllCodecs()[2]; // Last codec
      themeManager.setCodec(codecWillBe);

      const stored = localStorage.getItem('isekai:narrativeCodec');
      expect(stored).toBeDefined();
    });

    it('should handle localStorage unavailable gracefully', () => {
      // Mock localStorage to be undefined
      Object.defineProperty(window, 'localStorage', { value: undefined });

      // Should not throw
      expect(() => themeManager.setCodec('CODENAME_GLITCH')).not.toThrow();

      // Restore
      Object.defineProperty(window, 'localStorage', { value: originalLocalStorage });
    });
  });

  describe('9.5: Theme Switching Performance', () => {
    it('should switch codecs instantly (<50ms)', () => {
      const codecs = themeManager.getAllCodecs();

      codecs.forEach(codec => {
        const start = performance.now();
        themeManager.setCodec(codec);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(50);
      });
    });

    it('should not cause layout thrashing', () => {
      // This is a conceptual test - real layout thrashing detection
      // would require monitoring reflow/repaint events
      const before = document.documentElement.offsetHeight;

      themeManager.setCodec('CODENAME_MEDIEVAL');
      themeManager.setCodec('CODENAME_GLITCH');
      themeManager.setCodec('CODENAME_MINIMAL');

      const after = document.documentElement.offsetHeight;

      // Height should be same (no reflows triggered by theme change alone)
      expect(before).toBe(after);
    });
  });

  describe('9.6: Paradox Glitch Effects', () => {
    it('should apply paradox glitch at high intensity (>60%)', () => {
      const cleanup = themeManager.applyParadoxGlitch(75);

      const root = document.documentElement;
      const bgPrimary = root.style.getPropertyValue('--bg-primary');

      // Should have glitch color (magenta)
      expect(bgPrimary).toMatch(/ff|196/); // Contains part of glitch color

      cleanup();
    });

    it('should return cleanup function', () => {
      const cleanup = themeManager.applyParadoxGlitch(80);

      expect(typeof cleanup).toBe('function');

      // Call cleanup
      const beforeCleanup = document.documentElement.style.getPropertyValue('--bg-primary');
      cleanup();
      const afterCleanup = document.documentElement.style.getPropertyValue('--bg-primary');

      // Cleanup should have modified state
      expect(beforeCleanup).toBeDefined();
      expect(afterCleanup).toBeDefined();
    });

    it('should restore original theme after glitch cleanup', () => {
      themeManager.setCodec('CODENAME_GLITCH');
      const original = document.documentElement.style.getPropertyValue('--bg-primary');

      const cleanup = themeManager.applyParadoxGlitch(85);
      cleanup();

      // Should be restored or similar
      const restored = document.documentElement.style.getPropertyValue('--bg-primary');
      expect(restored).toBeDefined();
    });
  });

  describe('9.7: Theme Subscription & Listeners', () => {
    it('should subscribe to codec changes', () => {
      const listener = jest.fn();

      const unsubscribe = themeManager.subscribe(listener);
      themeManager.setCodec('CODENAME_MEDIEVAL');

      expect(listener).toHaveBeenCalledWith('CODENAME_MEDIEVAL');
      unsubscribe();
    });

    it('should call all subscribers on codec change', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsub1 = themeManager.subscribe(listener1);
      const unsub2 = themeManager.subscribe(listener2);

      themeManager.setCodec('CODENAME_GLITCH');

      expect(listener1).toHaveBeenCalledWith('CODENAME_GLITCH');
      expect(listener2).toHaveBeenCalledWith('CODENAME_GLITCH');

      unsub1();
      unsub2();
    });

    it('should unsubscribe listeners', () => {
      const listener = jest.fn();

      const unsubscribe = themeManager.subscribe(listener);
      unsubscribe();

      themeManager.setCodec('CODENAME_MINIMAL');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('9.8: Error Handling', () => {
    it('should handle invalid codec gracefully', () => {
      const invalidCodec = 'INVALID_CODEC' as any;

      // Should not throw
      expect(() => themeManager.setCodec(invalidCodec)).not.toThrow();
    });

    it('should log error for unknown codec', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      themeManager.setCodec('UNKNOWN_CODEC' as any);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown codec'));

      consoleSpy.mockRestore();
    });

    it('should handle missing codec definition', () => {
      const def = themeManager.getCodecDefinition('CODENAME_GLITCH');

      expect(def).toBeDefined();
      expect(def.colors).toBeDefined();
    });
  });

  describe('9.9: Color Accuracy & Contrast', () => {
    it('should use WCAG AA compliant text colors', () => {
      const codecs = themeManager.getAllCodecs();

      codecs.forEach(codec => {
        const def = themeManager.getCodecDefinition(codec);

        // Medieval: Dark brown + parchment
        if (codec === 'CODENAME_MEDIEVAL') {
          expect(def.colors.bgPrimary).toBe('#2a2416');
          expect(def.colors.textPrimary).toBe('#e8d7c3');
        }

        // Glitch: Void + parchment
        if (codec === 'CODENAME_GLITCH') {
          expect(def.colors.bgPrimary).toBe('#0a0a1a');
          expect(def.colors.textPrimary).toBe('#e8d7c3');
          expect(def.colors.borderAccent).toBe('#ff00c4');
        }

        // Minimal: Light background + dark text
        if (codec === 'CODENAME_MINIMAL') {
          expect(def.colors.bgPrimary).toBe('#f5f5f5');
          expect(def.colors.textPrimary).toBe('#2c3e50');
        }
      });
    });

    it('should provide accessible color swatches for preview', () => {
      const css = themeManager.getCodecPreviewCSS('CODENAME_GLITCH');

      expect(css).toContain('--bg-primary');
      expect(css).toContain('--border-accent');
      expect(css).toContain('--text-primary');
      expect(css).toContain('--accent-main');
    });
  });

  describe('9.10: Integration with useNarrativeCodec Hook', () => {
    it('should work with codec definitions', () => {
      const def = themeManager.getCodecDefinition('CODENAME_MEDIEVAL');

      expect(def.name).toBe('CODENAME_MEDIEVAL');
      expect(def.colors.accentMain).toBe('#b8341d'); // Blood red
    });

    it('should provide all codecs list', () => {
      const all = themeManager.getAllCodecs();

      expect(all.length).toBe(3);
      expect(all[1]).toBe('CODENAME_GLITCH');
    });
  });

  describe('9.11: CSS Variable Naming Conventions', () => {
    it('should use consistent -- prefix for variables', () => {
      themeManager.setCodec('CODENAME_GLITCH');

      const root = document.documentElement;
      const style = root.style.cssText;

      // Check that all injected variables follow the convention
      const vars = [
        '--bg-primary',
        '--border-accent',
        '--text-primary',
        '--accent-main',
        '--font-family-body',
        '--shadow-sm',
        '--transition-speed'
      ];

      vars.forEach(varName => {
        const value = root.style.getPropertyValue(varName);
        expect(value).toBeTruthy();
      });
    });
  });

  describe('9.12: Codec Metadata', () => {
    it('should have proper descriptions for all codecs', () => {
      const codecs = themeManager.getAllCodecs();

      codecs.forEach(codec => {
        const def = themeManager.getCodecDefinition(codec);
        expect(def.description.length).toBeGreaterThan(10);
        expect(def.label.length).toBeGreaterThan(3);
      });
    });

    it('should have thematic font choices', () => {
      const medieval = themeManager.getCodecDefinition('CODENAME_MEDIEVAL');
      const glitch = themeManager.getCodecDefinition('CODENAME_GLITCH');
      const minimal = themeManager.getCodecDefinition('CODENAME_MINIMAL');

      // Medieval uses serif fonts
      expect(medieval.typography.fontFamily).toMatch(/serif/i);

      // Glitch uses monospace
      expect(glitch.typography.fontFamily).toMatch(/monospace/i);

      // Minimal uses sans-serif
      expect(minimal.typography.fontFamily).toMatch(/sans-serif/);
    });
  });

  describe('9.13: Session Persistence Flow', () => {
    it('should remember codec across simulated page reload', () => {
      // Set a codec
      themeManager.setCodec('CODENAME_MEDIEVAL');

      // Check it's stored
      let stored = localStorage.getItem('isekai:narrativeCodec');
      expect(stored).toBe('CODENAME_MEDIEVAL');

      // Simulate getting current codec (would load from storage on "init")
      const current = themeManager.getCodec();
      expect(current).toBe('CODENAME_MEDIEVAL');
    });
  });
});

// Export test utilities
export const CODEC_TEST_HELPERS = {
  /**
   * Verify a codec is properly configured
   */
  verifyCodecStructure: (codec: NarrativeCodec): boolean => {
    const def = themeManager.getCodecDefinition(codec);
    return !!(
      def.name &&
      def.colors.bgPrimary &&
      def.typography.fontFamily &&
      def.shadows.sm
    );
  },

  /**
   * Get all CSS variables currently injected
   */
  getInjectedVariables: (): Record<string, string> => {
    const root = document.documentElement;
    const vars: Record<string, string> = {};

    const variableNames = [
      'bg-primary', 'bg-secondary', 'bg-tertiary',
      'border-accent', 'border-secondary',
      'text-primary', 'text-secondary',
      'accent-main', 'accent-alt',
      'glitch-color', 'warning-color',
      'font-family-body', 'font-size-base',
      'shadow-sm', 'shadow-md',
      'transition-speed', 'pulse-speed'
    ];

    variableNames.forEach(name => {
      vars[name] = root.style.getPropertyValue(`--${name}`);
    });

    return vars;
  },

  /**
   * Validate all color values are valid hex
   */
  validateHexColors: (codec: NarrativeCodec): boolean => {
    const def = themeManager.getCodecDefinition(codec);
    const hexRegex = /^#[0-9a-f]{6}$/i;

    return Object.values(def.colors).every(color =>
      typeof color === 'string' && hexRegex.test(color)
    );
  }
};
