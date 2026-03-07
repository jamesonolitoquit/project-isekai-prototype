/**
 * CinematicTextOverlay.tsx - Phase 30 Task 8: The Awakening Sequence
 * 
 * Displays the player's synthesized backstory as they awaken into the world.
 * Features:
 * - Typewriter text reveal effect
 * - Glitch overlays responsive to paradox level
 * - Integration with WeaverProcessingIndicator for synthesis status
 * - Diegetic parchment/void-violet aesthetic
 * - Keyboard/button navigation to continue
 */

import React, { useState, useEffect } from 'react';
import type { WeaverProcessingState } from './WeaverProcessingIndicator';
import WeaverProcessingIndicator from './WeaverProcessingIndicator';

export interface CinematicTextOverlayProps {
  /** Full backstory text to display */
  text: string;
  /** Character name for header */
  characterName: string;
  /** Current AI synthesis status */
  weaverProcessing: WeaverProcessingState | null;
  /** Current paradox level for glitch intensity */
  paradoxLevel?: number;
  /** Called when player clicks continue or presses key */
  onContinue: () => void;
  /** Optional custom title instead of "The Awakening" */
  title?: string;
  /** Speed of typewriter effect in ms per character */
  textSpeed?: number;
  /** Auto-dismiss after this many milliseconds (default 8s) */
  autoDismissMs?: number;
}

export const CinematicTextOverlay: React.FC<CinematicTextOverlayProps> = ({
  text,
  characterName,
  weaverProcessing,
  paradoxLevel = 0,
  onContinue,
  title = 'The Awakening',
  textSpeed = 30,
  autoDismissMs = 8000
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const [mountTime] = useState(() => Date.now());

  // Use provided text or emergency fallback
  const finalText = text || `You awaken to find yourself in a strange new world. 
Your name is ${characterName}. The path ahead is uncertain, but your journey has begun.
Ready yourself for what comes next.`;

  // Debug log text and processing state
  React.useEffect(() => {
    console.log('[CinematicOverlay] Initialized with:', {
      textLength: finalText?.length,
      characterName,
      isProcessing: weaverProcessing?.isProcessing,
      textPreview: text?.substring(0, 50)
    });
  }, [finalText, characterName, weaverProcessing]);

  // Typewriter effect
  useEffect(() => {
    if (weaverProcessing?.isProcessing) {
      // Don't start typewriter while AI is still synthesizing
      return;
    }

    if (!finalText || displayedText === finalText) {
      if (displayedText === finalText && finalText.length > 0) {
        setIsComplete(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(prev => {
        const next = prev + finalText[prev.length];
        return next.length === finalText.length ? finalText : next;
      });
    }, textSpeed);

    return () => clearTimeout(timer);
  }, [displayedText, finalText, textSpeed, weaverProcessing?.isProcessing]);

  // Allow continue after brief delay when complete, or after 2s if text exists
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setCanContinue(true), 500);
      return () => clearTimeout(timer);
    }
    
    // If text exists and not processing, allow continue after 2 seconds anyway
    if (finalText && !weaverProcessing?.isProcessing && !isComplete) {
      const timer = setTimeout(() => setCanContinue(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, finalText, weaverProcessing?.isProcessing]);

  // Safety valve: Auto-dismiss if overlay persists beyond autoDismissMs
  // This prevents deadlock if AI synthesis hangs indefinitely
  useEffect(() => {
    const autoCloseTimer = setTimeout(() => {
      const elapsedMs = Date.now() - mountTime;
      if (elapsedMs >= autoDismissMs) {
        console.warn(`[CinematicOverlay] Auto-dismissing after ${elapsedMs}ms (limit: ${autoDismissMs}ms)`);
        onContinue();
      }
    }, autoDismissMs);

    return () => clearTimeout(autoCloseTimer);
  }, [autoDismissMs, mountTime, onContinue]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && canContinue) {
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canContinue, onContinue]);

  const glitchIntensity = Math.min(100, Math.max(0, paradoxLevel));
  const hasGlitch = glitchIntensity > 40;

  return (
    <div className="cinematic-text-overlay">
      {/* Atmospheric background */}
      <div className="cinematic-bg"></div>

      {/* Glitch overlay (scales with paradox) */}
      {hasGlitch && (
        <div
          className="cinematic-glitch-overlay"
          style={{
            opacity: glitchIntensity / 150,
            animationDuration: `${1 + (100 - glitchIntensity) / 100}s`
          }}
        ></div>
      )}

      {/* Main text panel */}
      <div className="cinematic-text-panel">
        {/* Weaver Processing Indicator in corner */}
        <div className="cinematic-weaver-indicator">
          <WeaverProcessingIndicator
            state={weaverProcessing}
            position="top-right"
            theme="minimal"
            compact={true}
          />
        </div>

        {/* Header */}
        <div className="cinematic-header">
          <h2 className="cinematic-title">{title}</h2>
          <p className="cinematic-subtitle">As awakened by {characterName}</p>
        </div>

        {/* Main text with typewriter effect */}
        <div className="cinematic-text-container">
          <div className="cinematic-text">
            {displayedText || `[Loading... ${characterName}'s awakening...]`}
            {!isComplete && <span className="typewriter-cursor">▌</span>}
          </div>

          {/* Glitch text (overlay effect) */}
          {hasGlitch && (
            <div className="cinematic-glitch-text" style={{ opacity: glitchIntensity / 200 }}>
              {displayedText.substring(
                Math.max(0, displayedText.length - 20),
                displayedText.length
              )}
            </div>
          )}
        </div>

        {/* Continue prompt */}
        <div className={`cinematic-continue-prompt ${canContinue ? 'visible' : 'hidden'}`}>
          <p>[ PRESS SPACE TO CONTINUE ]</p>
        </div>

        {/* Skip button - always visible after 1s */}
        <button
          className="cinematic-skip-button"
          onClick={onContinue}
          style={{
            opacity: 1,
            pointerEvents: 'auto'
          }}
          aria-label="Skip to game world"
        >
          SKIP →
        </button>

        {/* Loading indicator while processing */}
        {weaverProcessing?.isProcessing && (
          <div className="cinematic-loading">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <p>The Weaver synthesizes your essence...</p>
          </div>
        )}

        {/* Continue button (accessible) */}
        {canContinue && (
          <button
            className="cinematic-continue-button"
            onClick={onContinue}
            aria-label="Continue to game world"
          >
            Continue Into Reality
          </button>
        )}
      </div>

      {/* Vignette fade effect */}
      <div className="cinematic-vignette"></div>

      {/* Scan lines effect */}
      <div className="cinematic-scan-lines"></div>
    </div>
  );
};

export default CinematicTextOverlay;
