/**
 * useNPCDialogueResonator.ts - NPC Dialogue AI Synthesis Hook (Pillar 2.3)
 *
 * Purpose: Apply AI-driven dialogue synthesis to NPCs, with paradox-driven glitches.
 * At high paradox levels, NPC dialogue shows temporal distortion (stuttering, repetition,
 * awareness of timeline splits).
 */

import { useEffect, useState, useCallback } from 'react';
import { getAIService } from '../services/AIService';
import type { UINPC } from '../types/uiModel';

export interface DialogueResonatorResult {
  originalDialogue: string;
  synthesizedDialogue: string;
  paradoxLevel: number;
  isGlitched: boolean;
  provider: 'llm' | 'static_glitch' | 'unmodified';
  latency: number;
}

export interface UseNPCDialogueResonatorOptions {
  enabled?: boolean;
  paradoxLevel?: number;
  autoApplyGlitch?: boolean; // If true, applies static glitch without AI at high paradox
}

/**
 * Hook: Apply AI dialogue synthesis to NPC dialogue based on paradox level
 *
 * Usage:
 * ```typescript
 * const result = useNPCDialogueResonator(
 *   npc.lastDialogue,
 *   npc.emotionalState,
 *   { paradoxLevel: 75, enabled: true }
 * );
 * ```
 */
export function useNPCDialogueResonator(
  dialogue: string,
  npc: UINPC | undefined,
  options?: UseNPCDialogueResonatorOptions
): DialogueResonatorResult | null {
  const [result, setResult] = useState<DialogueResonatorResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    enabled = true,
    paradoxLevel = 0,
    autoApplyGlitch = true,
  } = options ?? {};

  const synthesizeDialogue = useCallback(async () => {
    if (!enabled || !dialogue || paradoxLevel < 30) {
      // No synthesis needed at low paradox
      setResult({
        originalDialogue: dialogue,
        synthesizedDialogue: dialogue,
        paradoxLevel,
        isGlitched: false,
        provider: 'unmodified',
        latency: 0,
      });
      return;
    }

    // At high paradox but without AI, apply static glitch
    if (!autoApplyGlitch && paradoxLevel > 60) {
      const glitched = applyStaticGlitch(dialogue, paradoxLevel);
      setResult({
        originalDialogue: dialogue,
        synthesizedDialogue: glitched,
        paradoxLevel,
        isGlitched: true,
        provider: 'static_glitch',
        latency: 0,
      });
      return;
    }

    // Try AI synthesis for medium-high paradox
    if (paradoxLevel > 50) {
      setIsLoading(true);
      try {
        const aiService = getAIService();
        const startTime = performance.now();

        const synthesisResult = await aiService.synthesize({
          type: 'npc_dialogue_glitch',
          factors: {
            baseDialogue: dialogue,
            npcName: npc?.displayName || npc?.name || 'Unknown',
            emotionalState: npc?.emotionalState,
            paradoxMarkers: npc?.emotionalState ? Object.entries(npc.emotionalState)
              .filter(([_, val]) => typeof val === 'number' && (val as number) > 50)
              .map(([key]) => key) : [],
          },
          paradoxLevel,
        });

        setResult({
          originalDialogue: dialogue,
          synthesizedDialogue: synthesisResult.content,
          paradoxLevel,
          isGlitched: synthesisResult.provider !== 'static_fallback',
          provider: synthesisResult.provider === 'static_fallback' ? 'static_glitch' : 'llm',
          latency: synthesisResult.latency,
        });
      } catch (error) {
        console.error('NPC dialogue resonance failed:', error);
        const fallback = applyStaticGlitch(dialogue, paradoxLevel);
        setResult({
          originalDialogue: dialogue,
          synthesizedDialogue: fallback,
          paradoxLevel,
          isGlitched: true,
          provider: 'static_glitch',
          latency: 0,
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [dialogue, npc, enabled, paradoxLevel, autoApplyGlitch]);

  useEffect(() => {
    synthesizeDialogue();
  }, [synthesizeDialogue]);

  return result;
}

/**
 * Apply static paradox glitch effect to dialogue without AI
 * Used as fallback when AI is unavailable
 */
function applyStaticGlitch(dialogue: string, paradoxLevel: number): string {
  const intensity = Math.min(100, Math.max(0, paradoxLevel));

  // Low paradox: no effect
  if (intensity < 30) return dialogue;

  // Medium paradox: subtle uncertainty
  if (intensity < 60) {
    if (Math.random() < 0.3) {
      return `${dialogue} ...or did I say something else?`;
    }
    return dialogue;
  }

  // High paradox: stutter and repetition
  if (intensity < 85) {
    const words = dialogue.split(' ');
    if (words.length > 0 && Math.random() < 0.4) {
      const firstWord = words[0];
      const stuttered = `${firstWord}-${firstWord.substring(0, 2)}... ${dialogue}`;
      return stuttered;
    }
    return dialogue;
  }

  // Severe paradox: severe glitching and timeline awareness
  const words = dialogue.split(' ');
  const glitchPoints: number[] = [];
  const numGlitches = Math.ceil(words.length * 0.3);
  
  for (let i = 0; i < numGlitches; i++) {
    glitchPoints.push(Math.floor(Math.random() * words.length));
  }

  const glitchedWords = words.map((word, idx) => {
    if (glitchPoints.includes(idx) && word.length > 1) {
      // Stutter on this word
      return `${word.substring(0, 1)}-${word.substring(0, 2)}...${word}`;
    }
    return word;
  });

  return `[PARADOX] ${glitchedWords.join(' ')} [/PARADOX]`;
}

/**
 * Apply visual glitch CSS to dialogue element
 * Creates flashing, distorted effect at high paradox
 */
export function getDialogueGlitchStyles(paradoxLevel: number): React.CSSProperties {
  const intensity = Math.min(100, Math.max(0, paradoxLevel));

  if (intensity < 30) {
    return {};
  }

  if (intensity < 60) {
    return {
      opacity: 0.9,
      color: 'rgba(200, 100, 255, 0.9)',
    };
  }

  if (intensity < 85) {
    return {
      opacity: 0.85,
      color: 'rgba(200, 50, 255, 1)',
      textShadow: '0 0 4px rgba(200, 50, 255, 0.6)',
      animation: 'paradox-flicker 0.2s infinite',
    };
  }

  // Severe glitch
  return {
    opacity: 0.7,
    color: 'rgba(255, 0, 255, 1)',
    textShadow: '0 0 8px rgba(255, 0, 255, 0.8), 2px 2px 0 rgba(0, 255, 255, 0.6)',
    animation: 'paradox-severe-glitch 0.15s infinite',
    letterSpacing: '2px',
    fontStyle: 'italic',
  };
}

/**
 * CSS for glitch animations
 */
export const DIALOGUE_GLITCH_STYLES = `
  @keyframes paradox-flicker {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 0.6; }
  }

  @keyframes paradox-severe-glitch {
    0% { transform: translateX(0) skewX(0deg); opacity: 0.7; }
    20% { transform: translateX(-2px) skewX(-1deg); opacity: 0.5; }
    40% { transform: translateX(2px) skewX(1deg); opacity: 0.7; }
    60% { transform: translateX(-1px) skewX(-0.5deg); opacity: 0.6; }
    80% { transform: translateX(1px) skewX(0.5deg); opacity: 0.7; }
    100% { transform: translateX(0) skewX(0deg); opacity: 0.7; }
  }
`;
