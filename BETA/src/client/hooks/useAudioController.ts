import { useEffect, useRef } from 'react';
import ToneSynthesizer from '../audio/ToneSynthesizer';

export interface SoundscapeMapping {
  [locationId: string]: {
    [weather: string]: {
      track: string;
      volume: number;
    };
  };
}

// Default soundscape mapping (used for logging/fallback)
const DEFAULT_SOUNDSCAPE: SoundscapeMapping = {
  'eldergrove-village': {
    clear: { track: 'ambient-forest-day', volume: 0.6 },
    rain: { track: 'ambient-forest-rain', volume: 0.5 },
    snow: { track: 'ambient-forest-snow', volume: 0.45 }
  },
  'luminara-grand-market': {
    clear: { track: 'ambient-town-day', volume: 0.7 },
    rain: { track: 'ambient-town-rain', volume: 0.6 },
    snow: { track: 'ambient-town-snow', volume: 0.5 }
  },
  'thornwood-depths': {
    clear: { track: 'ambient-forest-dark', volume: 0.5 },
    rain: { track: 'ambient-forest-dark-rain', volume: 0.4 },
    snow: { track: 'ambient-forest-dark-snow', volume: 0.35 }
  },
  'moonwell-shrine': {
    clear: { track: 'ambient-shrine-day', volume: 0.4 },
    rain: { track: 'ambient-shrine-rain', volume: 0.35 },
    snow: { track: 'ambient-shrine-snow', volume: 0.3 }
  },
  'forge-summit': {
    clear: { track: 'ambient-forge-day', volume: 0.65 },
    rain: { track: 'ambient-forge-rain', volume: 0.55 },
    snow: { track: 'ambient-forge-snow', volume: 0.5 }
  }
};

/**
 * Audio controller hook for adaptive soundscape using Web Audio API synthesis
 * Tracks location/weather changes and triggers synthesized drone transitions
 */
export function useAudioController(
  location: string | undefined,
  weather: string | undefined,
  globalVolume: number = 0.8,
  soundscape: SoundscapeMapping = DEFAULT_SOUNDSCAPE
) {
  const synthesizerRef = useRef<ToneSynthesizer | null>(null);
  const audioStateRef = useRef<{ location?: string; weather?: string; track?: string } | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Initialize synthesizer once
  useEffect(() => {
    if (!synthesizerRef.current) {
      synthesizerRef.current = new ToneSynthesizer();
      // Lazy initialize on first interaction
      initPromiseRef.current = synthesizerRef.current.initialize().catch(err => {
        console.error('[useAudioController] Initialization error:', err);
      });
    }

    return () => {
      // Cleanup on unmount
      if (synthesizerRef.current) {
        synthesizerRef.current.stop().catch(err => {
          console.warn('[useAudioController] Cleanup error:', err);
        });
      }
    };
  }, []);

  // Handle location/weather changes
  useEffect(() => {
    if (!location || !weather || !synthesizerRef.current) return;

    const locationMap = soundscape[location];
    if (!locationMap) {
      console.warn(`[Audio] No soundscape config for location: ${location}`);
      return;
    }

    const trackConfig = locationMap[weather];
    if (!trackConfig) {
      console.warn(`[Audio] No audio track for ${location} + ${weather}`);
      return;
    }

    const currentState = audioStateRef.current || {};
    const trackChanged = trackConfig.track !== currentState.track;
    const locationChanged = location !== currentState.location;
    const weatherChanged = weather !== currentState.weather;

    if (trackChanged || locationChanged || weatherChanged) {
      const finalVolume = trackConfig.volume * globalVolume;

      console.log(
        `[Audio] Transition: ${currentState.track || 'none'} → ${trackConfig.track} ` +
        `(location: ${location}, weather: ${weather}, volume: ${finalVolume.toFixed(2)})`
      );

      // Trigger synthesizer to play drone for this location
      initPromiseRef.current?.then(() => {
        synthesizerRef.current?.playLocationDrone(location, 2.0).catch(err => {
          console.warn('[Audio] Error playing drone:', err);
        });
      }).catch(err => {
        console.warn('[Audio] Init error before playing drone:', err);
      });

      // Update synthesizer volume
      synthesizerRef.current.setVolume(finalVolume);

      audioStateRef.current = {
        location,
        weather,
        track: trackConfig.track
      };
    }
  }, [location, weather, globalVolume, soundscape]);

  return {
    currentTrack: audioStateRef.current?.track,
    audioState: audioStateRef.current,
    synthesizerState: synthesizerRef.current?.getState() ?? 'not-initialized',
    log: (msg: string) => console.log(`[Audio] ${msg}`)
  };
}

export default useAudioController;
