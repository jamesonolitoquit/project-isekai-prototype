/**
 * useNarrativeCodec.ts - Phase 30 Task 9 React Hook
 * 
 * Provides the current narrative codec state and methods to switch between them.
 * Automatically persists selection to localStorage for session persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import { themeManager, type NarrativeCodec, type CodecDefinition } from '../services/themeManager';

export interface UseNarrativeCodecReturn {
  /** Current active narrative codec */
  currentCodec: NarrativeCodec;
  /** Definition object for current codec (colors, typography, etc) */
  codecDefinition: CodecDefinition;
  /** Function to switch to a different codec */
  setCodec: (codec: NarrativeCodec) => void;
  /** Get definition for any codec */
  getCodecDefinition: (codec: NarrativeCodec) => CodecDefinition;
  /** Get all available codecs */
  getAllCodecs: () => NarrativeCodec[];
  /** Apply temporary paradox glitch effect, returns cleanup function */
  applyGlitch: (intensity: number) => () => void;
}

/**
 * React hook for managing narrative codec in components
 * 
 * Usage:
 * ```typescript
 * const { currentCodec, setCodec, codecDefinition } = useNarrativeCodec();
 * 
 * return (
 *   <>
 *     <select value={currentCodec} onChange={(e) => setCodec(e.target.value as NarrativeCodec)}>
 *       {getAllCodecs().map(c => (
 *         <option key={c} value={c}>{c}</option>
 *       ))}
 *     </select>
 *     <div style={{ color: codecDefinition.colors.textPrimary }}>
 *       Current theme: {currentCodec}
 *     </div>
 *   </>
 * );
 * ```
 */
export function useNarrativeCodec(): UseNarrativeCodecReturn {
  const [currentCodec, setCurrentCodec] = useState<NarrativeCodec>(
    themeManager.getCodec()
  );

  // Listen for external theme changes
  useEffect(() => {
    const unsubscribe = themeManager.subscribe((newCodec: NarrativeCodec) => {
      setCurrentCodec(newCodec);
    });

    return unsubscribe;
  }, []);

  const handleSetCodec = useCallback((codec: NarrativeCodec) => {
    themeManager.setCodec(codec);
    setCurrentCodec(codec);
  }, []);

  const handleGetCodecDefinition = useCallback((codec: NarrativeCodec): CodecDefinition => {
    return themeManager.getCodecDefinition(codec);
  }, []);

  const handleGetAllCodecs = useCallback((): NarrativeCodec[] => {
    return themeManager.getAllCodecs();
  }, []);

  const handleApplyGlitch = useCallback((intensity: number): (() => void) => {
    return themeManager.applyParadoxGlitch(intensity);
  }, []);

  return {
    currentCodec,
    codecDefinition: themeManager.getCodecDefinition(currentCodec),
    setCodec: handleSetCodec,
    getCodecDefinition: handleGetCodecDefinition,
    getAllCodecs: handleGetAllCodecs,
    applyGlitch: handleApplyGlitch
  };
}

export default useNarrativeCodec;
