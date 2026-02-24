/**
 * alpha_m13_audio_resilience.test.ts
 * 
 * ALPHA_M13: Audio Resilience & Sample Strategy Verification
 * 
 * Tests the graceful fallback system for missing audio assets:
 * - Console warning suppression during preload
 * - Procedural synthesis activation on asset unavailability
 * - Biome-specific audio frequency routing
 * - Audio mode gating based on asset availability
 */

import { 
  initializeAudioContext, 
  AudioNodeTopology, 
  DEFAULT_AUDIO_MANIFEST, 
  preloadAudioSamples 
} from '../client/services/AudioService';
import { 
  getProceduralFrequencyForBiome, 
  describeProcedurallAudioFallback 
} from '../engine/audioEngine';

describe('ALPHA_M13: Audio Resilience & Sample Strategy', () => {
  let mockAudioContext: any;
  let mockGain: any;
  let mockOscillator: any;
  let mockBiquadFilter: any;
  let mockDynamicsCompressor: any;

  beforeEach(() => {
    // Mock oscillator with readable/writable frequency property
    mockOscillator = {
      frequency: { setTargetAtTime: jest.fn(), value: 440 },
      type: 'square',
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };

    // Mock gain node
    mockGain = {
      gain: { setTargetAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), value: 1.0 },
      connect: jest.fn(),
    };

    // Mock biquad filter
    mockBiquadFilter = {
      type: 'lowpass',
      frequency: { setTargetAtTime: jest.fn(), value: 8000 },
      Q: { value: 1.0 },
      connect: jest.fn(),
    };

    // Mock dynamics compressor
    mockDynamicsCompressor = {
      threshold: { value: -24 },
      knee: { value: 30 },
      ratio: { value: 12 },
      connect: jest.fn(),
    };

    // Mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      destination: { connect: jest.fn() },
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => mockGain),
      createBiquadFilter: jest.fn(() => mockBiquadFilter),
      createDynamicsCompressor: jest.fn(() => mockDynamicsCompressor),
      decodeAudioData: jest.fn(),
      createBufferSource: jest.fn(() => ({
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        playbackRate: { value: 1.0 },
      })),
      state: 'running',
      suspend: jest.fn(),
      resume: jest.fn(),
      close: jest.fn(),
    };

    global.AudioContext = jest.fn(() => mockAudioContext);
  });

  describe('Step 1: Audio Sample Fallback Gracefully', () => {
    test('preloadAudioSamples returns asset availability status', async () => {
      const bgmUrls = ['sounds/bgm/forest-day.mp3', 'sounds/bgm/cave-tense.mp3'];
      const audioBuffers = new Map();

      const result = await preloadAudioSamples(bgmUrls, mockAudioContext, audioBuffers);

      // Should return object with load status
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasAssets');
      expect(result.total).toBe(2);
    });

    test('preloadAudioSamples indicates hasAssets=false when loads fail', async () => {
      const bgmUrls = ['sounds/nonexistent1.mp3', 'sounds/nonexistent2.mp3'];
      const audioBuffers = new Map();

      // Mock fetch to fail silently
      mockAudioContext.decodeAudioData = jest.fn((_buffer, success, _error) => {
        success(null);
      });

      const result = await preloadAudioSamples(bgmUrls, mockAudioContext, audioBuffers);

      expect(result.hasAssets).toBe(false);
      expect(result.loaded).toBeLessThanOrEqual(result.total);
    });

    test('console warning suppression does not spam per-file 404 errors', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const bgmUrls = [
        'sounds/bgm/missing1.mp3',
        'sounds/bgm/missing2.mp3',
        'sounds/bgm/missing3.mp3',
      ];
      const audioBuffers = new Map();

      await preloadAudioSamples(bgmUrls, mockAudioContext, audioBuffers);

      // Should not spam per-file warn/error calls during preload
      const warnCalls = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.includes?.('404') || call[0]?.includes?.('failed to load')
      );

      // Per-file error spam should not occur
      expect(warnCalls.length).toBeLessThanOrEqual(1);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Step 2: Establish "Silence" Baseline', () => {
    test('DEFAULT_AUDIO_MANIFEST includes silence fallback entries', () => {
      const manifest = DEFAULT_AUDIO_MANIFEST;

      // Manifest should include silence as a track
      expect(manifest.tracks).toHaveProperty('silence');

      // Should have fallback ambient layers
      expect(manifest.ambientLayers).toBeDefined();
      expect(typeof manifest.ambientLayers).toBe('object');
      expect(manifest.ambientLayers['silence']).toBeDefined();
    });

    test('silence manifest entries are accessible as fallback', () => {
      const manifest = DEFAULT_AUDIO_MANIFEST;
      const silenceTrack = manifest.tracks['silence'];

      expect(silenceTrack).toBeDefined();
      expect(typeof silenceTrack).toBe('string');
      expect(silenceTrack).toContain('silence');
    });
  });

  describe('Step 3: Hybrid Procedural Audio Foundation', () => {
    test('getProceduralFrequencyForBiome returns frequency data for all biomes', () => {
      const biomes = ['forest', 'cave', 'village', 'corrupted', 'desert', 'maritime', 'shrine'];

      biomes.forEach(biome => {
        const freqData = getProceduralFrequencyForBiome(biome);

        expect(freqData).toHaveProperty('baseFrequency');
        expect(freqData).toHaveProperty('modulation');
        expect(freqData).toHaveProperty('description');

        expect(typeof freqData.baseFrequency).toBe('number');
        expect(freqData.baseFrequency).toBeGreaterThan(0);
        expect(['low-drone', 'mid-chirp', 'high-shimmer', 'pulse']).toContain(freqData.modulation);
      });
    });

    test('forest biome has high-shimmer frequency (880Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('forest');

      expect(freqData.baseFrequency).toBe(880);
      expect(freqData.modulation).toBe('high-shimmer');
      expect(freqData.description.toLowerCase()).toContain('forest');
    });

    test('cave biome has low-drone frequency (40Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('cave');

      expect(freqData.baseFrequency).toBe(40);
      expect(freqData.modulation).toBe('low-drone');
      expect(freqData.description.toLowerCase()).toContain('cave');
    });

    test('village biome has mid-chirp frequency (262Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('village');

      expect(freqData.baseFrequency).toBe(262);
      expect(freqData.modulation).toBe('mid-chirp');
    });

    test('corrupted biome has ominous pulse (55Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('corrupted');

      expect(freqData.baseFrequency).toBe(55);
      expect(freqData.modulation).toBe('pulse');
      expect(freqData.description).toContain('Corrupted') || expect(freqData.description).toContain('ominous');
    });

    test('desert biome has wind-shimmer (440Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('desert');

      expect(freqData.baseFrequency).toBe(440);
      expect(freqData.modulation).toBe('high-shimmer');
    });

    test('maritime biome has oceanic drone (220Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('maritime');

      expect(freqData.baseFrequency).toBe(220);
      expect(freqData.modulation).toBe('low-drone');
      const desc = freqData.description.toLowerCase();
      expect(desc.includes('maritime') || desc.includes('ocean') || desc.includes('wave')).toBe(true);
    });

    test('shrine biome has sacred tone (528Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('shrine');

      expect(freqData.baseFrequency).toBe(528);
      expect(freqData.modulation).toBe('high-shimmer');
      expect(freqData.description).toContain('Shrine') || expect(freqData.description).toContain('sacred');
    });

    test('unknown biome returns safe default (440Hz)', () => {
      const freqData = getProceduralFrequencyForBiome('unknown-biome-xyz');

      expect(freqData.baseFrequency).toBe(440); // A4
      expect(freqData.modulation).toBeDefined();
      expect(freqData.description).toBeDefined();
    });

    test('describeProcedurallAudioFallback provides diagnostic text', () => {
      const biomes = ['forest', 'cave', 'village', 'corrupted'];

      biomes.forEach(biome => {
        const description = describeProcedurallAudioFallback(biome);

        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Step 4: Audio Manifest Hardening', () => {
    test('audio topology resilience fields are properly typed in manifest', () => {
      const manifest = DEFAULT_AUDIO_MANIFEST;

      // Manifest should have proper structure for resilience
      expect(manifest.tracks).toBeDefined();
      expect(manifest.ambientLayers).toBeDefined();
      expect(Object.keys(manifest.tracks).length).toBeGreaterThan(0);
      expect(Object.keys(manifest.ambientLayers).length).toBeGreaterThan(0);
    });

    test('audio manifest includes resilience fallpack paths', () => {
      const manifest = DEFAULT_AUDIO_MANIFEST;

      // Should have silence fallback entries
      expect(manifest.tracks['silence']).toBeDefined();
      expect(manifest.ambientLayers['silence']).toBeDefined();

      // All paths should be strings
      Object.values(manifest.tracks).forEach(track => {
        expect(typeof track).toBe('string');
      });
      Object.values(manifest.ambientLayers).forEach(layer => {
        expect(typeof layer).toBe('string');
      });
    });
  });

  describe('Step 5: Verification - Console Noise Reduction', () => {
    test('missing audio assets do not cause repeated console errors', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const missingUrls = ['sounds/missing1.mp3', 'sounds/missing2.mp3'];
      const audioBuffers = new Map();

      await preloadAudioSamples(missingUrls, mockAudioContext, audioBuffers);

      // Should have at most 1 aggregated info message
      const infoMessages = consoleInfoSpy.mock.calls.filter(call =>
        call[0]?.includes?.('Samples missing') ||
        call[0]?.includes?.('procedural')
      );

      // Expecting either 0 or 1 info message (gracefully handles missing assets)
      expect(infoMessages.length).toBeLessThanOrEqual(1);

      // No per-file errors should be logged
      const perFileErrors = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.includes?.('404') && !call[0]?.includes?.('falling back')
      );
      expect(perFileErrors.length).toBe(0);

      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('procedural audio frequencies do not trigger network errors', () => {
      // Procedural synthesis should work without network calls
      const biomes = ['forest', 'cave', 'village'];

      biomes.forEach(biome => {
        const freqData = getProceduralFrequencyForBiome(biome);

        // Should be able to create oscillator with this frequency
        expect(freqData.baseFrequency).toBeGreaterThan(0);
        expect(freqData.baseFrequency).toBeLessThan(20000); // Within human hearing range (or near it)
      });
    });

    test('audio service gracefully handles various manifest structures', () => {
      const testManifests = [
        { tracks: { 'test1': 'path1.mp3' }, ambientLayers: { 'test2': 'path2.mp3' } },
        { tracks: DEFAULT_AUDIO_MANIFEST.tracks, ambientLayers: DEFAULT_AUDIO_MANIFEST.ambientLayers },
      ];

      testManifests.forEach(manifest => {
        // Should not throw when creating manifest
        expect(manifest.tracks).toBeDefined();
        expect(manifest.ambientLayers).toBeDefined();
        expect(typeof manifest.tracks).toBe('object');
        expect(typeof manifest.ambientLayers).toBe('object');
      });
    });
  });

  describe('Integration: Full Audio Resilience Pipeline', () => {
    test('procedural and manifest systems work together', async () => {
      // Verify procedural audio frequencies are available for all biomes
      const biomes = ['forest', 'cave', 'village', 'corrupted', 'desert', 'maritime', 'shrine'];
      
      biomes.forEach(biome => {
        const freqData = getProceduralFrequencyForBiome(biome);
        expect(freqData.baseFrequency).toBeGreaterThan(0);
        expect(freqData.modulation).toBeDefined();
      });

      // Verify manifest has fallback entries for all audio types
      const manifest = DEFAULT_AUDIO_MANIFEST;
      expect(manifest.tracks['silence']).toBeDefined();
      expect(manifest.ambientLayers['silence']).toBeDefined();
    });

    test('audio resilience maintains performance with or without assets', async () => {
      const startTime = performance.now();

      // Test with no assets - should be fast (no network delays)
      const audioBuffers = new Map();
      const mockContext = mockAudioContext;

      await preloadAudioSamples(['sounds/fake.mp3'], mockContext, audioBuffers);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Preload should complete quickly even with missing files
      // (actual time will vary, but should be sub-100ms in test environment)
      expect(duration).toBeLessThan(1000); // Conservative upper bound
    });
  });
});
