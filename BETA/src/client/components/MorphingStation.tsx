import React, { useState } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { calculateMorphCost, generateRitualChallenge, RACIAL_BASE_STATS } from '../../engine/morphEngine';

interface MorphingStationProps {
  state: WorldState;
  onInitiateRitual: (targetRace: string) => void;
}

/**
 * Phase 13: MorphingStation UI Component
 * 
 * Display essence altar information and morphing options
 * Shows stat changes, soul strain costs, and ritual challenges
 * Provides visual feedback about morph validity and costs
 */
export const MorphingStation: React.FC<MorphingStationProps> = ({ state, onInitiateRitual }) => {
  const [selectedRace, setSelectedRace] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  // Guard against null state or player
  if (!state || !state.player) {
    return (
      <div className="morphing-station">
        <h3>Essence Altar</h3>
        <p>Loading...</p>
      </div>
    );
  }

  const currentRace = state.player.currentRace || 'human';
  const currentStats = state.player.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  const soulStrain = state.player.soulStrain || 0;

  const availableRaces = Object.keys(RACIAL_BASE_STATS);

  // Calculate morph preview when a race is selected
  let morphPreview = null;
  if (selectedRace && selectedRace !== currentRace) {
    morphPreview = calculateMorphCost(currentRace, selectedRace, currentStats, soulStrain);
  }

  // Calculate ritual difficulty for selected race
  let ritualChallenge = null;
  if (morphPreview && morphPreview.isValid) {
    ritualChallenge = generateRitualChallenge(state, selectedRace, 0.7);
  }

  const handleSelectRace = (race: string) => {
    if (race !== currentRace) {
      setSelectedRace(race);
      setShowPreview(true);
    }
  };

  const handleInitiateRitual = () => {
    if (selectedRace && morphPreview?.isValid && ritualChallenge) {
      onInitiateRitual(selectedRace);
    }
  };

  // Soul strain indicator colors
  const getSoulStrainColor = (strain: number) => {
    if (strain < 30) return '#4caf50'; // green
    if (strain < 60) return '#ff9800'; // orange
    if (strain < 85) return '#f44336'; // red
    return '#9c27b0'; // purple - critical
  };

  // Soul strain severity text
  const getSoulStrainLabel = (strain: number) => {
    if (strain < 30) return 'Healthy';
    if (strain < 60) return 'Strained';
    if (strain < 85) return 'Critical';
    return 'Shattering';
  };

  return (
    <div className="morphing-station">
      <div className="station-header">
        <h2>⚡ Essence Transformation Chamber ⚡</h2>
        <p className="subtitle">Morph your vessel at this ancient altar of transformation</p>
      </div>

      {/* Soul Integrity Display */}
      <div className="soul-integrity-section">
        <h3>Soul Integrity</h3>
        <div className="soul-strain-container">
          <div className="soul-strain-bar">
            <div
              className="soul-strain-fill"
              style={{
                width: `${100 - soulStrain}%`,
                backgroundColor: getSoulStrainColor(soulStrain)
              }}
            />
          </div>
          <div className="soul-strain-text">
            <span className="soul-strain-value">{soulStrain}/100</span>
            <span className="soul-strain-label" style={{ color: getSoulStrainColor(soulStrain) }}>
              {getSoulStrainLabel(soulStrain)}
            </span>
          </div>
        </div>
        {soulStrain >= 50 && (
          <div className="strain-warning">
            ⚠ High soul strain increases morph costs and paradox sensitivity
          </div>
        )}
      </div>

      {/* Current Form Display */}
      <div className="current-form-section">
        <h3>Current Form</h3>
        <div className="form-card current-form">
          <div className="form-name">{currentRace.toUpperCase()}</div>
          <div className="form-stats">
            {['str', 'agi', 'int', 'cha', 'end', 'luk'].map(stat => (
              <div key={stat} className="stat-row">
                <span className="stat-label">{stat.toUpperCase()}:</span>
                <span className="stat-value">{currentStats[stat as keyof typeof currentStats]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Available Races for Morphing */}
      <div className="available-races-section">
        <h3>Available Forms</h3>
        <div className="races-grid">
          {availableRaces.map(race => (
            <div
              key={race}
              className={`race-option ${selectedRace === race ? 'selected' : ''} ${
                race === currentRace ? 'current' : ''
              }`}
              onClick={() => handleSelectRace(race)}
            >
              <div className="race-name">{race}</div>
              <div className="race-power">
                {race === 'succubus' || race === 'sanguinarian' ? '⚠ HIGH COST' : 'Standard'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Morph Preview */}
      {showPreview && selectedRace && morphPreview && (
        <div className="morph-preview-section">
          <h3>Transformation Preview</h3>
          
          <div className="preview-container">
            {/* Current Form */}
            <div className="form-card">
              <div className="form-label">Current</div>
              <div className="form-name">{currentRace}</div>
              <div className="form-stats">
                {['str', 'agi', 'int', 'cha', 'end', 'luk'].map(stat => (
                  <div key={stat} className="stat-row">
                    <span className="stat-label">{stat.toUpperCase()}:</span>
                    <span className="stat-value">{currentStats[stat as keyof typeof currentStats]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="preview-arrow">→</div>

            {/* Target Form */}
            <div className={`form-card ${morphPreview.isValid ? 'valid' : 'invalid'}`}>
              <div className="form-label">Target</div>
              <div className="form-name">{selectedRace}</div>
              <div className="form-stats">
                {['str', 'agi', 'int', 'cha', 'end', 'luk'].map(stat => {
                  const newValue = morphPreview.statChanges[stat as keyof typeof morphPreview.statChanges];
                  const oldValue = currentStats[stat as keyof typeof currentStats];
                  const change = newValue ? newValue - oldValue : 0;
                  return (
                    <div key={stat} className="stat-row">
                      <span className="stat-label">{stat.toUpperCase()}:</span>
                      <span className={`stat-value ${change > 0 ? 'increase' : change < 0 ? 'decrease' : ''}`}>
                        {newValue || oldValue}
                        {change !== 0 && <span className="stat-change">{change > 0 ? '+' : ''}{change}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Soul Strain Cost */}
          <div className={`cost-display ${morphPreview.isValid ? '' : 'invalid'}`}>
            <div className="cost-item">
              <span className="cost-label">Soul Strain Cost:</span>
              <span className="cost-value">{morphPreview.soulStrainCost}</span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Current Soul Strain:</span>
              <span className="cost-value">{soulStrain}</span>
            </div>
            <div className="cost-item total">
              <span className="cost-label">After Morph:</span>
              <span className="cost-value">{soulStrain + morphPreview.soulStrainCost}</span>
            </div>
            {!morphPreview.isValid && (
              <div className="invalid-message">
                ❌ Morph cost exceeds maximum soul strain (100)
              </div>
            )}
          </div>

          {/* Ritual Challenge */}
          {ritualChallenge && morphPreview.isValid && (
            <div className="ritual-challenge-section">
              <h4>Resonance Challenge</h4>
              <div className="challenge-stats">
                <div className="challenge-stat">
                  <span className="stat-label">Difficulty:</span>
                  <span className="stat-value">{ritualChallenge.difficulty}</span>
                </div>
                <div className="challenge-stat">
                  <span className="stat-label">Required INT:</span>
                  <span className="stat-value">{ritualChallenge.requiredInt.toFixed(1)}</span>
                  <span className={`stat-modifier ${currentStats.int >= ritualChallenge.requiredInt ? 'pass' : 'fail'}`}>
                    {currentStats.int >= ritualChallenge.requiredInt ? '✓' : '✗'}
                  </span>
                </div>
                <div className="challenge-stat">
                  <span className="stat-label">Required END:</span>
                  <span className="stat-value">{ritualChallenge.requiredEnd.toFixed(1)}</span>
                  <span className={`stat-modifier ${currentStats.end >= ritualChallenge.requiredEnd ? 'pass' : 'fail'}`}>
                    {currentStats.end >= ritualChallenge.requiredEnd ? '✓' : '✗'}
                  </span>
                </div>
                <div className="challenge-stat success-rate">
                  <span className="stat-label">Success Chance:</span>
                  <span className="stat-value">{ritualChallenge.successChance}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Initiate Button */}
          {morphPreview.isValid && (
            <button
              className="initiate-ritual-button"
              onClick={handleInitiateRitual}
              disabled={!morphPreview.isValid}
            >
              ⚡ Initiate Ritual ⚡
            </button>
          )}

          {!morphPreview.isValid && (
            <button className="initiate-ritual-button" disabled>
              ✗ Cannot Morph
            </button>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h4>Transformation Notes</h4>
        <ul>
          <li>Morphing changes your racial attributes and appearance</li>
          <li>Each transformation accumulates Soul Strain (0-100)</li>
          <li>High Soul Strain makes future morphs more expensive and risky</li>
          <li>Failure at the ritual can trigger critical paradox events</li>
          <li>Strategic morphing is key to advanced gameplay</li>
        </ul>
      </div>
    </div>
  );
};

export default MorphingStation;
