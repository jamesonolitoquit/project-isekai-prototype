/**
 * Phase 48-Chronos: Study & Rest UI Component
 * 
 * Provides a time-dial slider in the Right Tactical Tray for:
 * - Rest (recover HP/MP)
 * - Study (gain Proficiency XP)
 * - Meditate (world advancement in quiet mode)
 * 
 * Players slide to select duration (1h, 4h, 8h, 1day, 3days, 7days)
 * Component tracks resource recovery and displays a "Meditating..." overlay
 */

import React, { useState } from 'react';
import styles from './ChronosStudyUI.module.css';

interface ChronosStudyUIProps {
  playerHp?: number;
  playerMaxHp?: number;
  playerMp?: number;
  playerMaxMp?: number;
  onStudySubmit: (durationTicks: number, studyType: 'rest' | 'study' | 'meditate') => void;
  isProcessing?: boolean;
}

export const ChronosStudyUI: React.FC<ChronosStudyUIProps> = ({
  playerHp = 100,
  playerMaxHp = 100,
  playerMp = 50,
  playerMaxMp = 100,
  onStudySubmit,
  isProcessing = false
}) => {
  const [selectedDuration, setSelectedDuration] = useState(240); // 4 hours default (240 ticks)
  const [selectedType, setSelectedType] = useState<'rest' | 'study' | 'meditate'>('rest');

  // Presets: converted from hours to ticks (1 tick = 1 minute in world time, so 60 ticks = 1 hour)
  const durationPresets = [
    { label: '1h', ticks: 60 },
    { label: '4h', ticks: 240 },
    { label: '8h', ticks: 480 },
    { label: '1d', ticks: 1440 },
    { label: '3d', ticks: 4320 },
    { label: '7d', ticks: 10080 },
  ];

  const getEstimatedRecovery = (duration: number, type: string) => {
    if (type === 'rest') {
      // HP recovery: ~5 per 60 ticks (1 hour), or ~12 per day
      const hpRecovered = Math.min(playerMaxHp - playerHp, Math.floor((duration / 60) * 5));
      const mpRecovered = Math.min(playerMaxMp - playerMp, Math.floor((duration / 60) * 3));
      return { hpRecovered, mpRecovered, xpGained: 0 };
    } else if (type === 'study') {
      // XP gain: ~50 per hour
      const xpGained = Math.floor((duration / 60) * 50);
      return { hpRecovered: 0, mpRecovered: 0, xpGained };
    }
    // Meditate: passive world advancement, no direct recovery
    return { hpRecovered: 0, mpRecovered: 0, xpGained: 0 };
  };

  const recovery = getEstimatedRecovery(selectedDuration, selectedType);
  const currentPreset = durationPresets.find(p => p.ticks === selectedDuration);

  return (
    <div className={styles.chronosStudyContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>⏳ Chronos Study</h3>
        <p className={styles.subtitle}>Advance world time while you rest</p>
      </div>

      {/* Study Type Buttons */}
      <div className={styles.typeButtons}>
        {(['rest', 'study', 'meditate'] as const).map(type => (
          <button
            key={type}
            className={`${styles.typeButton} ${selectedType === type ? styles.active : ''}`}
            onClick={() => setSelectedType(type)}
            disabled={isProcessing}
            title={
              type === 'rest' ? 'Recover HP & MP' :
              type === 'study' ? 'Gain Proficiency XP' :
              'Sync with world, trigger events'
            }
          >
            {type === 'rest' && '💤 Rest'}
            {type === 'study' && '📚 Study'}
            {type === 'meditate' && '🧘 Meditate'}
          </button>
        ))}
      </div>

      {/* Duration Slider */}
      <div className={styles.sliderSection}>
        <label className={styles.sliderLabel}>Duration: {currentPreset?.label || `${Math.round(selectedDuration / 60)}h`}</label>
        <input
          type="range"
          min={durationPresets[0].ticks}
          max={durationPresets[durationPresets.length - 1].ticks}
          value={selectedDuration}
          onChange={(e) => setSelectedDuration(parseInt(e.target.value))}
          disabled={isProcessing}
          className={styles.slider}
        />
        <div className={styles.presetButtons}>
          {durationPresets.map(preset => (
            <button
              key={preset.ticks}
              className={`${styles.presetButton} ${selectedDuration === preset.ticks ? styles.selected : ''}`}
              onClick={() => setSelectedDuration(preset.ticks)}
              disabled={isProcessing}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recovery/Gain Preview */}
      {selectedType === 'rest' && (
        <div className={styles.recoveryPreview}>
          <div className={styles.stat}>
            <span className={styles.label}>HP Recovery:</span>
            <span className={styles.value}>{recovery.hpRecovered} / {playerMaxHp}</span>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${(recovery.hpRecovered / playerMaxHp) * 100}%`, background: '#ff6b6b' }} />
            </div>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>MP Recovery:</span>
            <span className={styles.value}>{recovery.mpRecovered} / {playerMaxMp}</span>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${(recovery.mpRecovered / playerMaxMp) * 100}%`, background: '#4c9aff' }} />
            </div>
          </div>
        </div>
      )}

      {selectedType === 'study' && (
        <div className={styles.recoveryPreview}>
          <div className={styles.stat}>
            <span className={styles.label}>📚 Proficiency XP:</span>
            <span className={styles.value}>{recovery.xpGained} XP</span>
          </div>
          <p className={styles.hint}>Your proficiencies will advance while you study.</p>
        </div>
      )}

      {selectedType === 'meditate' && (
        <div className={styles.recoveryPreview}>
          <p className={styles.hint}>🌍 The world will evolve while you meditate.</p>
          <p className={styles.hint}>Faction conflicts, NPC routines, and events will progress naturally.</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        className={styles.submitButton}
        onClick={() => onStudySubmit(selectedDuration, selectedType)}
        disabled={isProcessing}
      >
        {isProcessing ? '⟳ Processing...' : '✨ Begin'}
      </button>
    </div>
  );
};

export default ChronosStudyUI;
