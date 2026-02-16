/**
 * FactionVisualOverlay.tsx - M15 Step 5: Faction Territory Visual Feedback
 * 
 * Displays visual indicators for faction-controlled territories:
 * - Territory color tinting based on dominant faction
 * - Ambiance effects (industrial, ethereal, opulent)
 * - Territory control banner with faction name
 * - Smooth transitions when entering new faction territory
 */

import React, { useEffect, useState, useRef } from 'react';
import { Faction } from '../../engine/factionEngine';
import { WorldState } from '../../engine/worldEngine';

interface TerritoryState {
  dominantFactionId: string | null;
  previousFactionId: string | null;
  influenceScore: number;
  shouldShowBanner: boolean;
  bannerTimer: NodeJS.Timeout | null;
}

export interface FactionVisualOverlayProps {
  state: WorldState | null;
  enabled?: boolean;
}

export default function FactionVisualOverlay({ state, enabled = true }: FactionVisualOverlayProps) {
  const [territory, setTerritory] = useState<TerritoryState>({
    dominantFactionId: null,
    previousFactionId: null,
    influenceScore: 0,
    shouldShowBanner: false,
    bannerTimer: null
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  // Determine dominant faction in current location
  useEffect(() => {
    if (!state || !enabled) return;

    const currentLocationId = state.player?.location;
    const influenceMap = state.influenceMap || {};
    const factions = state.factions || [];

    if (!currentLocationId || !influenceMap[currentLocationId]) return;

    // Find faction with highest influence at current location
    let dominantFactionId: string | null = null;
    let maxInfluence = 30; // Only consider factions above 30 influence (losing threshold)

    Object.entries(influenceMap[currentLocationId]).forEach(([factionId, score]) => {
      if (score > maxInfluence) {
        maxInfluence = score;
        dominantFactionId = factionId;
      }
    });

    // Check if faction changed (territory shift)
    const controlChanged = dominantFactionId !== territory.dominantFactionId;

    setTerritory(prev => ({
      ...prev,
      dominantFactionId,
      previousFactionId: controlChanged ? prev.dominantFactionId : prev.previousFactionId,
      influenceScore: maxInfluence,
      shouldShowBanner: controlChanged
    }));

    // Auto-hide banner after 3 seconds
    if (controlChanged && territory.bannerTimer) {
      clearTimeout(territory.bannerTimer);
    }

    if (controlChanged) {
      const timer = setTimeout(() => {
        setTerritory(prev => ({ ...prev, shouldShowBanner: false }));
      }, 3000);

      setTerritory(prev => ({ ...prev, bannerTimer: timer }));
    }
  }, [state?.player?.location, state?.influenceMap]);

  if (!enabled || !state) return null;

  const dominantFaction = state.factions?.find(f => f.id === territory.dominantFactionId);
  const controlLevel = Math.min(3, Math.ceil(territory.influenceScore / 25)); // 1-3 control bars

  const themeColor = dominantFaction?.influenceTheme?.color || '#333333';
  const ambiance = dominantFaction?.influenceTheme?.ambiance || 'none';

  // Build CSS filter based on ambiance
  const getAmbianceFilter = () => {
    switch (ambiance) {
      case 'industrial':
        return 'saturate(0.8) brightness(0.90) contrast(1.1)';
      case 'ethereal':
        return 'saturate(1.2) hue-rotate(20deg) brightness(1.05) blur(0.3px)';
      case 'opulent':
        return 'saturate(1.3) brightness(1.1) drop-shadow(0 0 10px rgba(255,215,0,0.2))';
      default:
        return 'none';
    }
  };

  return (
    <div
      ref={overlayRef}
      id="faction-visual-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
        backgroundColor: dominantFaction ? `${themeColor}08` : 'transparent', // Very subtle 3% opacity
        transition: 'background-color 0.6s ease-in-out',
        filter: getAmbianceFilter() || undefined
      }}
    >
      {/* Territory control indicator */}
      {dominantFaction && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            display: 'flex',
            gap: 4,
            zIndex: 101
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 24,
                backgroundColor: i < controlLevel ? themeColor : '#cccccc',
                borderRadius: 2,
                opacity: i < controlLevel ? 1 : 0.3,
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
      )}

      {/* Territory entry banner */}
      {territory.shouldShowBanner && dominantFaction && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: themeColor,
            color: '#ffffff',
            padding: '20px 40px',
            borderRadius: 8,
            fontSize: 24,
            fontWeight: 'bold',
            textAlign: 'center',
            boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
            animation: 'faction-banner-in 0.4s ease-out',
            zIndex: 102,
            maxWidth: 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          🚩 {dominantFaction.name} Territory
        </div>
      )}

      {/* Edge tone for ultra subtle ambient effect */}
      {dominantFaction && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderLeft: `8px solid ${themeColor}`,
            borderRight: `8px solid ${themeColor}`,
            opacity: 0.1,
            pointerEvents: 'none',
            transition: 'border-color 0.6s ease-in-out'
          }}
        />
      )}

      <style>{`
        @keyframes faction-banner-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -60%);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  );
}
