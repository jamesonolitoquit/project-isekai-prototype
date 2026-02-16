import React, { useEffect, useState } from 'react';
import type { WorldState } from '../../engine/worldEngine';

interface TravelProgressProps {
  state: WorldState;
}

/**
 * Phase 14: TravelProgress Component
 * 
 * Displays a progress bar overlay during travel between locations.
 * Shows:
 * - Remaining travel time
 * - Current biome danger level
 * - Encounter warnings
 * - Estimated arrival
 */
export const TravelProgress: React.FC<TravelProgressProps> = ({ state }) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  const travelState = state.travelState;

  if (!travelState || !travelState.isTraveling) {
    return null;
  }

  const progress = ((travelState.ticksPerTravelSession - travelState.remainingTicks) / travelState.ticksPerTravelSession) * 100;

  // Determine biome danger color
  const getBiomelevel = (locationId: string): { name: string; danger: 'low' | 'medium' | 'high' | 'extreme' } => {
    const biomeMap: Record<string, { name: string; danger: 'low' | 'medium' | 'high' | 'extreme' }> = {
      'eldergrove-village': { name: 'Village', danger: 'low' },
      'luminara-grand-market': { name: 'Market', danger: 'low' },
      'forge-summit': { name: 'Mountain', danger: 'medium' },
      'thornwood-depths': { name: 'Forest', danger: 'high' },
      'moonwell-shrine': { name: 'Shrine', danger: 'medium' },
      'frozen-lake': { name: 'Frozen Lake', danger: 'high' },
      'abyss-edge': { name: 'Abyss', danger: 'extreme' }
    };
    return biomeMap[locationId] || { name: 'Unknown', danger: 'medium' };
  };

  const fromBiome = getBiomelevel(travelState.fromLocationId);
  const toBiome = getBiomelevel(travelState.toLocationId);

  const getDangerColor = (danger: string): string => {
    switch (danger) {
      case 'low':
        return '#4caf50'; // green
      case 'medium':
        return '#ff9800'; // orange
      case 'high':
        return '#f44336'; // red
      case 'extreme':
        return '#9c27b0'; // purple
      default:
        return '#9c27b0';
    }
  };

  return (
    <div className="travel-progress-overlay">
      <div className="travel-progress-container">
        <div className="travel-progress-header">
          <h3>🗺 Journey in Progress</h3>
          <p className="travel-route">
            {fromBiome.name} → {toBiome.name}
          </p>
        </div>

        <div className="travel-progress-bar-section">
          <div className="travel-progress-bar-container">
            <div
              className="travel-progress-bar-fill"
              style={{
                width: `${progress}%`,
                backgroundColor: getDangerColor(toBiome.danger)
              }}
            />
          </div>
          <div className="travel-progress-text">
            <span className="progress-remaining">{travelState.remainingTicks} ticks remaining</span>
            <span className="progress-percent">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="travel-biome-info">
          <div className="biome-status">
            <span className="biome-label">Destination Danger:</span>
            <span className="biome-danger" style={{ color: getDangerColor(toBiome.danger) }}>
              {toBiome.danger.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="travel-warnings">
          {toBiome.danger === 'high' && (
            <div className="travel-warning warning-high">
              ⚠ High encounter probability in this region
            </div>
          )}
          {toBiome.danger === 'extreme' && (
            <div className="travel-warning warning-extreme">
              ⚠⚠ EXTREME Danger! Encounters very likely
            </div>
          )}
          {state.player.beliefLayer && state.player.beliefLayer.suspicionLevel > 50 && (
            <div className="travel-warning warning-paradox">
              ⚠ High paradox - encounters manifest unpredictably
            </div>
          )}
        </div>

        <div className="travel-tips">
          <p className="tip-text">💡 Encounters may occur during travel. Be prepared!</p>
        </div>
      </div>
    </div>
  );
};

export default TravelProgress;
