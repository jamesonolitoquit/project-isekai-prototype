/**
 * M41 Task 2: Tutorial Overlay Component
 * 
 * Displays lore-compliant tutorial messages as overlays.
 * Appears when player discovers a new mechanic.
 */

import React, { useState, useEffect } from 'react';
import type { TutorialOverlay } from '../../engine/tutorialEngine';

interface TutorialOverlayProps {
  overlay: TutorialOverlay;
  onDismiss: () => void;
  autoHideDelay?: number; // Milliseconds before auto-hide (0 = disable)
}

const TutorialOverlayComponent: React.FC<TutorialOverlayProps> = ({
  overlay,
  onDismiss,
  autoHideDelay = 0
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHideDelay > 0 && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHideDelay, isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 8000,
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(13, 13, 26, 0.95)',
          border: '2px solid #8b5cf6',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)',
          animation: 'fadeInScale 0.4s ease-out'
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: 0.9
          }}
        >
          {overlay.icon}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#c084fc',
            marginBottom: '12px',
            margin: '0 0 12px 0'
          }}
        >
          {overlay.title}
        </h2>

        {/* Main Text */}
        <p
          style={{
            fontSize: '16px',
            color: '#e5e7eb',
            marginBottom: '20px',
            lineHeight: 1.6,
            margin: '0 0 20px 0'
          }}
        >
          {overlay.text}
        </p>

        {/* Lore Text (Chronicle Entry) */}
        <div
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderLeft: '4px solid #8b5cf6',
            borderRadius: '4px',
            padding: '12px 16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#c084fc',
              fontStyle: 'italic',
              lineHeight: 1.5,
              margin: 0
            }}
          >
            {overlay.loreText}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
          style={{
            backgroundColor: '#8b5cf6',
            color: '#fff',
            border: 'none',
            padding: '10px 32px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#a78bfa';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8b5cf6';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
          }}
        >
          {overlay.actionLabel}
        </button>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default TutorialOverlayComponent;
