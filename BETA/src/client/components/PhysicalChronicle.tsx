/**
 * Phase 31: Physical Chronicle Component
 * Phase 34 Extension: Audio Hooks for Tactile Feedback
 * 
 * Displays narrative events, world history, or important lore as a physical scroll/book
 * sitting on the Tabletop surface. Styled with parchment texture and aged appearance.
 * 
 * Features:
 * - Parchment paper background with aged texture
 * - Deckled edge effect (subtle irregular borders)
 * - Proper z-depth positioning on tabletop
 * - Serif font for handwritten feel
 * - Scrollable content with elegant styling
 * - Paper shuffle sound on scroll expansion
 */

import React, { useState } from 'react';
import styles from '../../styles/diegetic.module.css';
import { audioService } from '../services/AudioService';

interface PhysicalChronicleProps {
  title: string;
  entries: Array<{
    id: string;
    timestamp?: string;
    text: string;
    icon?: string;
  }>;
  maxHeight?: string;
  position?: 'left' | 'right' | 'center';
}

export default function PhysicalChronicle({
  title,
  entries,
  maxHeight = '400px',
  position = 'left'
}: PhysicalChronicleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Position on the tabletop surface
  const positionStyle = {
    left: {
      position: 'absolute' as const,
      bottom: '20px',
      left: '20px',
      maxWidth: '350px'
    },
    right: {
      position: 'absolute' as const,
      bottom: '20px',
      right: '20px',
      maxWidth: '350px'
    },
    center: {
      position: 'absolute' as const,
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '450px'
    }
  };

  return (
    <div
      style={{
        ...positionStyle[position],
        transform: position === 'center' ? 'translateX(-50%) translateZ(15px)' : 'translateZ(15px)',
        zIndex: 100,
        transition: 'all 0.3s ease-out'
      }}
    >
      <div className={styles.panelParchment}
        style={{
          cursor: 'pointer',
          transform: isExpanded ? 'scale(1.05)' : 'scale(1)',
          boxShadow: isExpanded 
            ? '0 15px 40px rgba(0, 0, 0, 0.5)' 
            : '0 8px 20px rgba(0, 0, 0, 0.3)'
        }}
        onClick={() => {
          if (!isExpanded) {
            try {
              audioService.playPaperShuffle();
            } catch (e) {
              console.warn('[PhysicalChronicle] Failed to play paper shuffle:', e);
            }
          }
          setIsExpanded(!isExpanded);
        }}
      >
        {/* Header */}
        <div className={styles.panelParchmentHeader}>
          📜 {title}
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            fontSize: '11px',
            color: '#8b4513',
            marginBottom: '8px',
            opacity: 0.7,
            fontStyle: 'italic'
          }}
        >
          {isExpanded ? '▼ Click to collapse' : '▶ Click to read'}
        </div>

        {/* Content */}
        <div
          className={styles.panelParchmentContent}
          style={{
            maxHeight: isExpanded ? maxHeight : 'auto',
            overflowY: isExpanded ? 'auto' : 'hidden',
            paddingRight: isExpanded ? '8px' : '0',
            transition: 'max-height 0.3s ease-out'
          }}
        >
          {entries.length === 0 ? (
            <div style={{ opacity: 0.5, fontStyle: 'italic' }}>
              No entries yet...
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={entry.id || idx}
                style={{
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: idx < entries.length - 1 ? '1px solid #d4c5b0' : 'none'
                }}
              >
                {/* Timestamp */}
                {entry.timestamp && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#a1887f',
                      marginBottom: '4px',
                      fontFamily: 'monospace'
                    }}
                  >
                    [{entry.timestamp}]
                  </div>
                )}

                {/* Entry content */}
                <div>
                  {entry.icon && <span style={{ marginRight: '4px' }}>{entry.icon}</span>}
                  <span>{entry.text}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Decorative corner */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            fontSize: '18px',
            opacity: 0.3,
            color: '#8b4513'
          }}
        >
          ✦
        </div>
      </div>
    </div>
  );
}
