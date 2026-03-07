import React, { useEffect, useState } from 'react';
import styles from './CharacterWizard.module.css';
import WorldAnchorMap from './WorldAnchorMap';
import GearSelector from './GearSelector';
import type { WorldTemplate } from '../../types/template';

type PrepPhase = 'location' | 'gear' | 'curio' | 'complete';

interface Props {
  phase: PrepPhase;
  worldTemplate: WorldTemplate;
  draft: any;
  updateDraft: (patch: any) => void;
  setCodexHoverTarget: (t: any) => void;
  getRollFateRandom: () => string;
  selectedCurio?: any;
}

/**
 * PrepStageController - Manages the "Preparation Flow" (Step 6 onwards)
 * 
 * Features:
 * - Slide-to-reveal animation between phases
 * - Tactical Map for Location selection
 * - 3x3 Gear Grid with category filtering
 * - Tarot-inspired Curio reveal
 * - Full RPG aesthetic with theme-aware styling
 */
export default function PrepStageController({
  phase,
  worldTemplate,
  draft,
  updateDraft,
  setCodexHoverTarget,
  getRollFateRandom,
  selectedCurio,
}: Props) {
  const [slideOut, setSlideOut] = useState(false);
  const [slideIn, setSlideIn] = useState(false);

  // Trigger slide animation on phase change
  useEffect(() => {
    setSlideOut(true);
    const slideTimer = setTimeout(() => {
      setSlideOut(false);
      setSlideIn(true);
    }, 200);
    const resetTimer = setTimeout(() => {
      setSlideIn(false);
    }, 400);
    return () => {
      clearTimeout(slideTimer);
      clearTimeout(resetTimer);
    };
  }, [phase]);

  const contentClasses = `${slideOut ? styles.prep_slide_out : ''} ${slideIn ? styles.prep_slide_in : ''}`;

  return (
    <div className={`${styles.prep_stage_container} ${contentClasses}`}>
      {/* LOCATION PHASE */}
      {phase === 'location' && (
        <div className={styles.prep_phase_location}>
          <div className={styles.interaction_header}>
            <h2 className={styles.prep_phase_title}>📍 Your Origin</h2>
            <p className={styles.prep_phase_subtitle}>Where do you awaken in this realm?</p>
          </div>
          <WorldAnchorMap
            worldTemplate={worldTemplate}
            selectedLocationId={draft.startingLocationId}
            onSelectLocation={(id) => {
              updateDraft({ startingLocationId: id, preparationPhase: 'gear' });
            }}
            onHoverRegion={(id) =>
              setCodexHoverTarget(id ? { type: 'location', value: id } : null)
            }
          />
        </div>
      )}

      {/* GEAR PHASE */}
      {phase === 'gear' && (
        <div className={styles.prep_phase_gear}>
          <div className={styles.interaction_header}>
            <div className={styles.phase_nav_row}>
              <button
                className={styles.btn_back_nav}
                onClick={() => updateDraft({ preparationPhase: 'location' })}
              >
                ← BACK
              </button>
              <div>
                <h2 className={styles.prep_phase_title}>⚔️ Your Arsenal</h2>
                <p className={styles.prep_phase_subtitle}>Select your starting equipment</p>
              </div>
            </div>
          </div>
          <GearSelector
            gearChoices={worldTemplate.startingGearChoices || []}
            selectedGearId={draft.startingGearId}
            onSelectGear={(id) => {
              updateDraft({ startingGearId: id, preparationPhase: 'curio' });
            }}
            onHoverGear={(id) =>
              setCodexHoverTarget(id ? { type: 'gear', value: id } : null)
            }
          />
        </div>
      )}

      {/* CURIO PHASE */}
      {phase === 'curio' && (
        <div className={styles.prep_phase_fate}>
          <div className={styles.interaction_header}>
            <div className={styles.phase_nav_row}>
              <button
                className={styles.btn_back_nav}
                onClick={() => updateDraft({ preparationPhase: 'gear' })}
              >
                ← BACK
              </button>
              <div>
                <h2 className={styles.prep_phase_title}>🎲 Your Fate</h2>
                <p className={styles.prep_phase_subtitle}>Reveal your destined curio</p>
              </div>
            </div>
          </div>

          {!selectedCurio ? (
            <div className={styles.fate_roll_container}>
              <button
                className={styles.btn_roll_fate_cta}
                onClick={() => {
                  const randItem = getRollFateRandom();
                  updateDraft({ flavorItemId: randItem, preparationPhase: 'complete' });
                }}
              >
                <span className={styles.fate_roll_icon}>🎲</span>
                <span className={styles.fate_roll_text}>ROLL THE DICE</span>
              </button>
            </div>
          ) : (
            <div className={styles.curio_reveal_tarot}>
              <div className={styles.curio_card_back} />
              <div className={styles.curio_card}>
                <div className={styles.curio_card_icon}>{selectedCurio.icon || '✨'}</div>
                <div className={styles.curio_card_divider} />
                <div className={styles.curio_card_name}>{selectedCurio.name || 'Unknown Artifact'}</div>
                <div className={styles.curio_card_lore}>{selectedCurio.lore || 'A mysterious treasure.'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
