import React, { useEffect, useState } from 'react';
import styles from './CharacterWizard.module.css';

interface Props {
  characterName: string;
  archetype?: string;
  location?: string;
  gear?: string;
  curio?: string;
  theme?: 'medieval' | 'sci-fi';
  onComplete?: () => void;
}

/**
 * AwakeningOverlay - Final Transition Animation
 * 
 * Features:
 * - Full-screen modal for dramatic effect
 * - Character "stamping" or "digitization" animation (theme-dependent)
 * - Cinematic text reveal
 * - Progress toward "world entry"
 * - Sound and visual effects (theme-aware)
 */
export default function AwakeningOverlay({
  characterName,
  archetype = 'Wanderer',
  location = 'Unknown Lands',
  gear = 'Basic Equipment',
  curio = 'Mysterious Artifact',
  theme = 'medieval',
  onComplete,
}: Props) {
  const [stage, setStage] = useState<'intro' | 'stamp' | 'reveal' | 'transition'>('intro');

  useEffect(() => {
    const timings = {
      intro: 800,
      stamp: 1500,
      reveal: 1000,
      transition: 2000,
    };

    const stageSequence = ['intro', 'stamp', 'reveal', 'transition'] as const;
    let currentStageIndex = 0;

    const timer = setInterval(() => {
      if (currentStageIndex < stageSequence.length - 1) {
        currentStageIndex++;
        setStage(stageSequence[currentStageIndex]);
      } else {
        clearInterval(timer);
        // Auto-complete after transition stage finishes
        setTimeout(() => {
          onComplete?.();
        }, timings['transition']);
      }
    }, timings[stage]);

    return () => clearInterval(timer);
  }, [stage, onComplete]);

  const isMedieval = theme === 'medieval';

  return (
    <div className={`${styles.awakening_overlay} ${isMedieval ? styles.awakening_medieval : styles.awakening_sci}`}>
      {/* Background Cinematic Effect */}
      <div className={styles.awakening_backdrop} />

      {/* Character Sheet Area */}
      <div className={`${styles.awakening_sheet} ${stage === 'stamp' ? styles.awakening_stamp_animation : ''}`}>
        {/* Intro Stage: Character Name Reveal */}
        {stage === 'intro' && (
          <div className={`${styles.awakening_stage_intro} ${styles.fade_in}`}>
            <h1 className={styles.awakening_character_name}>{characterName}</h1>
            <div className={styles.awakening_tagline}>
              {isMedieval ? '⚔️ Awakening...' : '⚡ ACTIVATION SEQUENCE...'}
            </div>
          </div>
        )}

        {/* Stamp Stage: Character Stamping/Digitizing */}
        {(stage === 'stamp' || stage === 'reveal' || stage === 'transition') && (
          <div className={styles.awakening_stage_stamp}>
          <div className={`${styles.awakening_character_card} ${stage === 'stamp' || stage === 'reveal' || stage === 'transition' ? styles.fade_in : ''}`}>
              {/* Character Container */}
              <div className={styles.awakening_card_content}>
                <div className={styles.awakening_card_name}>{characterName}</div>
                <div className={styles.awakening_card_divider} />

                {/* Class/Archetype */}
                <div className={styles.awakening_card_row}>
                  <span className={styles.awakening_card_label}>{isMedieval ? 'Class' : 'ROLE'}:</span>
                  <span className={styles.awakening_card_value}>{archetype}</span>
                </div>

                {/* Location */}
                <div className={styles.awakening_card_row}>
                  <span className={styles.awakening_card_label}>{isMedieval ? 'Origin' : 'SPAWN'}:</span>
                  <span className={styles.awakening_card_value}>{location}</span>
                </div>

                {/* Gear */}
                <div className={styles.awakening_card_row}>
                  <span className={styles.awakening_card_label}>{isMedieval ? 'Arms' : 'GEAR'}:</span>
                  <span className={styles.awakening_card_value}>{gear}</span>
                </div>

                {/* Curio */}
                <div className={styles.awakening_card_row}>
                  <span className={styles.awakening_card_label}>{isMedieval ? 'Fate' : 'CURSED OBJECT'}:</span>
                  <span className={styles.awakening_card_value}>{curio}</span>
                </div>

                <div className={styles.awakening_card_divider} />
                <div className={styles.awakening_card_seal}>
                  {isMedieval ? '✦ SEALED ✦' : '◆ INITIALIZED ◆'}
                </div>
              </div>

              {/* Stamp Overlay (Medieval: Wax seal; Sci-Fi: Holographic)  */}
              {stage === 'stamp' && (
                <div
                  className={`${styles.awakening_stamp_effect} ${isMedieval ? styles.stamp_seal : styles.stamp_hologram}`}
                >
                  {isMedieval ? '📜' : '⚛️'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reveal Stage: Full Character Sheet Flash */}
        {stage === 'reveal' && (
          <div className={`${styles.awakening_stage_reveal} ${styles.pulse_reveal}`}>
            <div className={styles.awakening_reveal_flash} />
            <p className={styles.awakening_reveal_text}>
              {isMedieval
                ? `${characterName} awakens in ${location}...`
                : `${characterName} INITIALIZED AT ${location}...`}
            </p>
          </div>
        )}

        {/* Transition Stage: Fade to next screen */}
        {stage === 'transition' && (
          <div className={`${styles.awakening_stage_transition} ${styles.fade_out}`}>
            <p className={styles.awakening_transition_text}>
              {isMedieval ? 'Your journey begins...' : 'ENTERING WORLD...'}
            </p>
            <div className={styles.awakening_loading_bar}>
              <div className={styles.awakening_loading_fill} />
            </div>
          </div>
        )}
      </div>

      {/* Cinematic Vignette */}
      <div className={styles.awakening_vignette} />

      {/* Theme-Specific Effects */}
      {isMedieval && stage === 'stamp' && (
        <div className={styles.awakening_particles_medieval}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={styles.particle_dust} style={{ left: `${20 + i * 10}%`, animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      )}

      {!isMedieval && stage === 'stamp' && (
        <div className={styles.awakening_particles_scifi}>
          {[...Array(12)].map((_, i) => (
            <div key={i} className={styles.particle_spark} style={{ left: `${i * 8}%`, animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}