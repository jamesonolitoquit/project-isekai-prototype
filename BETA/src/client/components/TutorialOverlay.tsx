/**
 * Phase 19: Tutorial Overlay Component
 * Displays "Chronicler Whispers" - lore-compliant tutorial hints and milestones
 * 
 * Features:
 * - Parchment aesthetic with glitch effects (when paradox > 0.6)
 * - Milestone achievement notifications
 * - Button highlighting for guided actions
 * - Dismissible overlays with fade-out
 * - Responsive positioning (center, side-panel, or fixed)
 * 
 * Integration:
 * - Subscribes to worldState.player.tutorialState
 * - Reads worldState.paradoxLevel for glitch intensity
 * - Can target UI buttons via milestone-specific highlights
 */

import React, { useState, useEffect, useRef } from 'react';

interface TutorialOverlayProps {
  appState?: any;
  onDismiss?: (milestoneId: string) => void;
}

interface OverlayState {
  isVisible: boolean;
  milestoneId?: string;
  title: string;
  text: string;
  loreText: string;
  actionLabel: string;
  icon?: string;
  glitchIntensity: number; // 0-1, based on paradox level
  dismissing: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ appState, onDismiss }) => {
  const [overlay, setOverlay] = useState<OverlayState>({
    isVisible: false,
    title: '',
    text: '',
    loreText: '',
    actionLabel: 'Continue',
    glitchIntensity: 0,
    dismissing: false
  });

  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Phase 19: Calculate glitch intensity based on paradox level
   * Higher paradox makes tutorial text stutter/glitch
   */
  const getGlitchIntensity = (paradox: number): number => {
    if (paradox > 0.8) return 1.0; // Full glitch
    if (paradox > 0.6) return 0.6; // Medium glitch
    if (paradox > 0.4) return 0.3; // Light glitch
    return 0; // No glitch
  };

  /**
   * Phase 19: Monitor tutorial state changes and update overlay
   */
  useEffect(() => {
    if (!appState) return;

    const tutorialState = appState.player?.tutorialState;
    if (!tutorialState) {
      setOverlay(prev => ({ ...prev, isVisible: false }));
      return;
    }

    const nextOverlay = appState.tutorialOverlay;
    const paradoxLevel = appState.paradoxLevel || 0;
    const glitchIntensity = getGlitchIntensity(paradoxLevel);

    if (nextOverlay && nextOverlay.visible) {
      // New overlay to show
      setOverlay({
        isVisible: true,
        milestoneId: nextOverlay.milestoneId,
        title: nextOverlay.title || '',
        text: nextOverlay.text || '',
        loreText: nextOverlay.loreText || '',
        actionLabel: nextOverlay.actionLabel || 'Continue',
        icon: nextOverlay.icon,
        glitchIntensity,
        dismissing: false
      });
    } else {
      // Update glitch intensity even when not showing
      setOverlay(prev => ({
        ...prev,
        glitchIntensity,
        isVisible: false
      }));
    }
  }, [appState?.player?.tutorialState, appState?.tutorialOverlay, appState?.paradoxLevel]);

  /**
   * Phase 19: Handle overlay dismissal with fade-out animation
   */
  const handleDismiss = () => {
    setOverlay(prev => ({ ...prev, dismissing: true }));

    // Fade out then notify parent
    if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
    fadeOutTimeoutRef.current = setTimeout(() => {
      const milestoneId = overlay.milestoneId || 'unknown';
      onDismiss?.(milestoneId);
      setOverlay(prev => ({ ...prev, isVisible: false, dismissing: false }));
    }, 600); // Match CSS fade-out duration
  };

  /**
   * Phase 19: Generate glitched text for high paradox states
   * Randomly flickers characters to 0 or other chars
   */
  const renderGlitchedText = (text: string, intensity: number): React.ReactNode => {
    if (intensity === 0) return text;

    return (
      <span className="chronicle-glitch-text">
        {text.split('').map((char, idx) => {
          const glitchChance = Math.random();
          const isGlitched = glitchChance < intensity;
          
          if (isGlitched) {
            const glitchChars = ['█', '░', '▓', '0', '1', ' ', char];
            const glitchChar = glitchChars[Math.floor(Math.random() * glitchChars.length)];
            return (
              <span key={idx} className="glitch-char" style={{ opacity: 0.7 }}>
                {glitchChar}
              </span>
            );
          }
          return (
            <span key={idx}>{char}</span>
          );
        })}
      </span>
    );
  };

  if (!overlay.isVisible) {
    return null;
  }

  return (
    <div className={`tutorial-overlay-container ${overlay.dismissing ? 'fade-out' : 'fade-in'}`}>
      {/* Parchment Background */}
      <div className="chronicle-parchment">
        {/* Header with milestone icon */}
        <div className="chronicle-header">
          {overlay.icon && (
            <span className="chronicle-icon" style={{ fontSize: '2.5rem', marginRight: '1rem' }}>
              {overlay.icon}
            </span>
          )}
          <h2 className="chronicle-title">
            {overlay.glitchIntensity > 0 ? renderGlitchedText(overlay.title, overlay.glitchIntensity) : overlay.title}
          </h2>
        </div>

        {/* Main tutorial text */}
        <div className="chronicle-text">
          <p className="tutorial-main-text">
            {overlay.glitchIntensity > 0 ? renderGlitchedText(overlay.text, overlay.glitchIntensity * 0.3) : overlay.text}
          </p>
        </div>

        {/* Lore text (expanded narrative) */}
        <div className="chronicle-lore">
          <em className="lore-label">~ Chronicle Entry ~</em>
          <p className="lore-text">
            {overlay.glitchIntensity > 0 ? renderGlitchedText(overlay.loreText, overlay.glitchIntensity * 0.2) : overlay.loreText}
          </p>
        </div>

        {/* Action button */}
        <div className="chronicle-actions">
          <button className="btn-acknowledge" onClick={handleDismiss}>
            {overlay.actionLabel}
          </button>
        </div>
      </div>

      {/* CSS Styles embedded */}
      <style>{`
        .tutorial-overlay-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9500;
          pointer-events: all;
          animation: overlayFadeIn 0.4s ease-out;
        }

        .tutorial-overlay-container.fade-out {
          animation: overlayFadeOut 0.6s ease-out forwards;
        }

        .tutorial-overlay-container.fade-in {
          animation: overlayFadeIn 0.4s ease-out forwards;
        }

        .chronicle-parchment {
          max-width: 500px;
          width: 90%;
          background: linear-gradient(135deg, #2a2416 0%, #3d3428 50%, #2a2416 100%);
          border: 3px solid #8b7355;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .chronicle-parchment::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            repeating-linear-gradient(
              0deg,
              rgba(139, 115, 85, 0.03) 0px,
              rgba(139, 115, 85, 0.03) 1px,
              transparent 1px,
              transparent 2px
            );
          pointer-events: none;
        }

        .chronicle-header {
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid #8b7355;
          padding-bottom: 1rem;
        }

        .chronicle-icon {
          display: inline-block;
          filter: drop-shadow(0 0 8px rgba(255, 200, 100, 0.3));
        }

        .chronicle-title {
          margin: 0;
          color: #ffd700;
          font-size: 1.5rem;
          font-family: 'Georgia', serif;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          font-weight: bold;
          letter-spacing: 0.05em;
        }

        .chronicle-text {
          margin-bottom: 1.5rem;
        }

        .tutorial-main-text {
          color: #e8d5c4;
          font-size: 1rem;
          line-height: 1.6;
          margin: 0;
          font-family: 'Georgia', serif;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .chronicle-lore {
          background: rgba(0, 0, 0, 0.2);
          border-left: 3px solid #d4af37;
          padding: 1rem;
          margin-bottom: 1.5rem;
          border-radius: 4px;
        }

        .lore-label {
          color: #b8941f;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-family: 'Arial', sans-serif;
          display: block;
          margin-bottom: 0.5rem;
          opacity: 0.8;
        }

        .lore-text {
          color: #d4af37;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
          font-style: italic;
          font-family: 'Georgia', serif;
        }

        .chronicle-actions {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .btn-acknowledge {
          background: linear-gradient(135deg, #d4af37 0%, #f0e68c 50%, #d4af37 100%);
          color: #2a2416;
          border: 2px solid #8b7355;
          padding: 0.75rem 2rem;
          font-size: 1rem;
          font-weight: bold;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Georgia', serif;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .btn-acknowledge:hover {
          background: linear-gradient(135deg, #f0e68c 0%, #ffd700 50%, #f0e68c 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(212, 175, 55, 0.4);
        }

        .btn-acknowledge:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        /* Glitch effect text */
        .chronicle-glitch-text {
          position: relative;
          display: inline;
        }

        .glitch-char {
          display: inline-block;
          animation: glitchFlicker 0.1s infinite;
        }

        @keyframes glitchFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes overlayFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes overlayFadeOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .chronicle-parchment {
            padding: 1.5rem;
            max-width: 90%;
          }

          .chronicle-title {
            font-size: 1.25rem;
          }

          .tutorial-main-text {
            font-size: 0.95rem;
          }

          .lore-text {
            font-size: 0.85rem;
          }

          .btn-acknowledge {
            padding: 0.6rem 1.5rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
};

export default TutorialOverlay;
