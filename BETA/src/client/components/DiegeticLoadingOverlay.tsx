/**
 * Phase 48-UI: Diegetic Loading Overlay
 * 
 * Replaces standard loading spinners with an immersive, full-screen
 * overlay featuring the "Weaver Resonating" animation. The overlay is
 * theme-aware and displays in the narrative codec colors (Medieval Gold
 * or Cyberpunk Cyan).
 * 
 * Purpose: Transform the loading wait into atmospheric storytelling.
 */

import React from 'react';
import DiegeticWeaverLoading from './DiegeticWeaverLoading';
import { themeManager, NarrativeCodec } from '../services/themeManager';

interface DiegeticLoadingOverlayProps {
  progress?: number;
  visible: boolean;
  themeCodec?: NarrativeCodec;
}

export const DiegeticLoadingOverlay: React.FC<DiegeticLoadingOverlayProps> = ({ 
  progress = 0, 
  visible = true,
  themeCodec
}) => {
  // Determine theme colors based on active codec
  const activeCodec: NarrativeCodec = themeCodec || themeManager.getCodec();
  const codecDef = themeManager.getCodecDefinition(activeCodec);
  
  // Extract accent color from theme
  const accentColor = codecDef.colors.accentMain || '#ffd700';
  const bgColor = codecDef.colors.bgPrimary || '#050510';
  
  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20000,
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Weaver resonating with the aeons"
    >
      {/* Animated backdrop gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(
              circle at 50% 50%,
              ${accentColor}13 0%,
              transparent 70%
            )
          `,
          animation: 'pulse-gradient 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Main content wrapper */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* The Weaver Loading Component */}
        <DiegeticWeaverLoading isLoading={true} />

        {/* Loading message with theme-aware styling */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              color: accentColor,
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '2px',
              margin: 0,
              textTransform: 'uppercase',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            RESONATING WITH THE AEONS
          </h2>
          
          <p
            style={{
              color: '#888',
              fontSize: '12px',
              fontStyle: 'italic',
              margin: 0,
              fontFamily: '"JetBrains Mono", monospace',
              maxWidth: '80vw',
            }}
          >
            "The Weaver does not create; the Weaver remembers."
          </p>

          {/* Progress indicator */}
          {progress > 0 && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '11px',
                color: accentColor,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {Math.round(progress)}%
            </div>
          )}
        </div>
      </div>

      {/* Ambient dots pattern at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          display: 'flex',
          gap: '8px',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: accentColor,
              opacity: 0.3 + (i % 2) * 0.3,
              animation: `dot-pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-gradient {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes dot-pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
};

export default DiegeticLoadingOverlay;
