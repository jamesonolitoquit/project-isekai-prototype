/**
 * ALPHA_M8 Phase 1 & 2: useAudioSynchronization Hook
 * 
 * React hook that synchronizes the deterministic AudioState from the world engine
 * with the client-side Web Audio API implementation.
 * 
 * This hook:
 * - Initializes the AudioService with sample loading (M8 Phase 2)
 * - Watches for AudioState changes from world state
 * - Updates Web Audio API parameters in real-time
 * - Manages performance by suspending AudioContext when tab is inactive (M8 Phase 2)
 * - Preloads audio samples for smooth playback (M8 Phase 2)
 * - Manages cleanup on unmount
 */

import { useEffect, useRef } from 'react';
import type { AudioState } from '../../engine/audioEngine';
import {
  initializeAudioContext,
  updateOscillatorFrequencies,
  updateVolumeLevels,
  updateFilterCutoff,
  updateDuckingCountdown,
  setLayerVolume,
  disableAllLayers,
  switchBgmTrack,
  disposeAudioContext,
  preloadAudioSamples,
  DEFAULT_AUDIO_MANIFEST,
  audioService,
  type AudioNodeTopology,
  type AudioManifest
} from '../services/AudioService';

export interface UseAudioSynchronizationOptions {
  enabled?: boolean;  // Allow disabling audio without unmounting
  onError?: (error: Error) => void;
  debug?: boolean;
  manifest?: AudioManifest;  // Custom audio manifest (M8 Phase 2)
  autoSuspend?: boolean;  // Suspend AudioContext when tab inactive (M8 Phase 2)
}

/**
 * Hook for synchronizing AudioState with Web Audio API
 */
export function useAudioSynchronization(
  audioState: AudioState | null,
  options: UseAudioSynchronizationOptions = {}
) {
  const { 
    enabled = true, 
    onError, 
    debug = false, 
    manifest = DEFAULT_AUDIO_MANIFEST,
    autoSuspend = true
  } = options;
  const topologyRef = useRef<AudioNodeTopology | null>(null);
  const lastAudioStateRef = useRef<AudioState | null>(null);
  const audioContextStartedRef = useRef(false);
  const documentVisibilityListenerRef = useRef<() => void>();

  // Initialize Audio Context on first mount
  useEffect(() => {
    if (!enabled || audioContextStartedRef.current) return;

    try {
      // Defer initialization to avoid blocking initial render
      const initTimeout = setTimeout(async () => {
        if (!topologyRef.current) {
          topologyRef.current = initializeAudioContext(manifest);
          audioContextStartedRef.current = true;
          
          // Set topology in the singleton audioService wrapper
          audioService.setTopology(topologyRef.current);
          
          // Preload bgm tracks in the background (M8 Phase 2)
          const bgmUrls = Object.values(manifest.tracks);
          const preloadResult = await preloadAudioSamples(bgmUrls.slice(0, 3), topologyRef.current.context, topologyRef.current.audioBuffers);
          
          // ALPHA_M13: Update topology with asset availability (for procedural fallback gating)
          topologyRef.current.hasAssets = preloadResult.hasAssets;
          topologyRef.current.proceduralMode = preloadResult.hasAssets ? 'samples' : 'synthesis';
          
          if (debug) {
            console.log('[AudioSync] Audio context initialized with manifest');
            console.log(`[AudioSync] Audio mode: ${topologyRef.current.proceduralMode}, Assets loaded: ${preloadResult.loaded}/${preloadResult.total}`);
          }
        }
      }, 100);

      return () => clearTimeout(initTimeout);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('[AudioSync] Failed to initialize audio context:', error);
      onError?.(error);
    }
  }, [enabled, onError, debug, manifest]);

  // Set up document visibility listener for auto-suspend (M8 Phase 2)
  useEffect(() => {
    if (!enabled || !autoSuspend || !topologyRef.current) return;

    const handleVisibilityChange = () => {
      if (!topologyRef.current) return;

      if (document.hidden) {
        // Tab is hidden - suspend the AudioContext to save resources
        try {
          if (topologyRef.current.context.state === 'running') {
            topologyRef.current.context.suspend();
            if (debug) console.log('[AudioSync] AudioContext suspended (tab hidden)');
          }
        } catch (e) {
          console.warn('[AudioSync] Error suspending AudioContext:', e);
        }
      } else {
        // Tab is visible again - resume the AudioContext
        try {
          if (topologyRef.current.context.state === 'suspended') {
            topologyRef.current.context.resume();
            if (debug) console.log('[AudioSync] AudioContext resumed (tab visible)');
          }
        } catch (e) {
          console.warn('[AudioSync] Error resuming AudioContext:', e);
        }
      }
    };

    // Store listener reference for cleanup
    documentVisibilityListenerRef.current = handleVisibilityChange;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, autoSuspend, debug]);

  // Synchronize AudioState changes to Web Audio API
  useEffect(() => {
    if (!enabled || !audioState || !topologyRef.current) return;

    try {
      const topology = topologyRef.current;
      const previousState = lastAudioStateRef.current;

      // Only update if state has changed
      if (previousState && isAudioStateEqual(previousState, audioState)) {
        return;
      }

      if (debug) {
        console.log('[AudioSync] Updating audio parameters', {
          bgm: audioState.bgm,
          layers: audioState.layers.length,
          tension: audioState.tensionHum,
          heartbeat: audioState.heartbeatBpm,
          filter: audioState.lowPassCutoff,
          masterVolume: audioState.masterVolume
        });
      }

      // === Update BGM Track ===
      if (!previousState || previousState.bgm !== audioState.bgm) {
        // Fire and forget - don't block render
        switchBgmTrack(topology, audioState.bgm).catch(err => {
          console.warn('[AudioSync] Error switching BGM track:', err);
          onError?.(err);
        });
      }

      // === Update Oscillator Frequencies (Tension effects) ===
      updateOscillatorFrequencies(
        topology,
        audioState.tensionHum,      // Hum intensity
        audioState.heartbeatBpm     // Heartbeat in BPM
      );

      // === Update Volume Levels ===
      // Calculate ambient volume from active layers
      const ambientVolume = audioState.layers.length > 0 ? 0.5 : 0.2;
      
      updateVolumeLevels(
        topology,
        audioState.masterVolume,
        0.5,                       // BGM volume
        ambientVolume,             // Ambient volume
        audioState.tensionHum,     // Tension hum intensity
        Math.min(0.8, audioState.heartbeatBpm / 150),  // Heartbeat intensity (normalized)
        audioState.duckingEnabled ? audioState.duckingAmount : 0
      );

      // === Update Low-Pass Filter (for weather muffling) ===
      updateFilterCutoff(topology, audioState.lowPassCutoff);

      // === Update Ambient Layers ===
      // Disable all first, then enable active ones
      disableAllLayers(topology);
      for (const layer of audioState.layers) {
        setLayerVolume(topology, layer, 0.6); // Standard layer volume
      }

      // === Update Ducking Countdown ===
      if (audioState.duckingEnabled && audioState.mutationOverrides?.duckingDuration) {
        updateDuckingCountdown(
          topology,
          audioState.mutationOverrides.duckingDuration,
          audioState.duckingAmount,
          50  // Default ducking duration
        );
      }

      lastAudioStateRef.current = audioState;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('[AudioSync] Error synchronizing audio state:', error);
      onError?.(error);
    }
  }, [audioState, enabled, debug, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (topologyRef.current) {
        try {
          disposeAudioContext(topologyRef.current);
          if (debug) console.log('[AudioSync] Audio context disposed');
        } catch (e) {
          console.warn('[AudioSync] Error disposing audio context:', e);
        }
      }
    };
  }, [debug]);

  // Return public interface for component usage
  return {
    isInitialized: topologyRef.current !== null,
    topology: topologyRef.current,
    lastAudioState: lastAudioStateRef.current
  };
}

/**
 * Deep equality check for AudioState to avoid unnecessary updates
 */
function isAudioStateEqual(a: AudioState, b: AudioState): boolean {
  return (
    a.bgm === b.bgm &&
    a.masterVolume === b.masterVolume &&
    a.tensionHum === b.tensionHum &&
    a.heartbeatBpm === b.heartbeatBpm &&
    a.lowPassCutoff === b.lowPassCutoff &&
    a.duckingEnabled === b.duckingEnabled &&
    a.duckingAmount === b.duckingAmount &&
    arraysEqual(a.layers, b.layers)
  );
}

/**
 * Helper to compare string arrays
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
