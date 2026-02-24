/**
 * M42 Task 2.3b: Ritual Modal
 *
 * Specialized dice roll interface for ritual/miracle checks.
 * Workflow: Select Ritual → Choose Participants → Roll Check → Outcomes
 *
 * Features:
 * - Ritual selection with purpose and effect
 * - Participant selection (multiple players can contribute)
 * - Group modifier pooling: +1 per additional participant (capped)
 * - Ritual modifiers: +3 sanctified location, +1 per rarity, -2 belief mismatch
 * - Three outcome tiers: Minor (1 effect), Major (2 effects), Backlash (negative)
 * - Divine/Arcane failure: Temporary consequences
 */

import React, { useState } from 'react';
import DiceAltarModal from './DiceAltarModal';
// import type { DiceModifier, RollResult } from '../engine/diceAltarEngine';

// Temporary type definitions
interface DiceModifier {
  source: string;
  value: number;
  icon?: string;
  description?: string;
}

interface RollResult {
  roll: number;
  modifiers: DiceModifier[];
  total: number;
  dc: number;
  passed: boolean;
  isCritical: boolean;
  isFumble: boolean;
  margin: number;
}
import '../styles/ritual-modal.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RitualEffect {
  effectId: string;
  name: string;
  description: string;
  targetType: 'self' | 'single' | 'area' | 'world';
  duration: 'instant' | 'scene' | 'session' | 'permanent';
}

export interface Ritual {
  ritualId: string;
  name: string;
  category: 'divine' | 'arcane' | 'nature' | 'forbidden';
  description: string;
  baseDC: number;                        // Base difficulty
  requiredBeliefs?: string[];           // Required player beliefs
  minorEffects: RitualEffect[];         // 1-2 successes
  majorEffects: RitualEffect[];         // 3+ successes
  backlashEffect?: RitualEffect;        // Fumble or critical failure
}

export interface RitualParticipant {
  clientId: string;
  playerName: string;
  belief?: string;                       // Player's belief alignment
  isSacrificing?: boolean;              // Willing to take damage for +2 bonus
}

export interface RitualModalProps {
  availableRituals: Ritual[];
  otherPlayers: RitualParticipant[];     // Other connected players
  playerBelief?: string;                // Current player's belief
  playerLocation?: string;              // Sanctified location? (e.g., "temple")
  onRitualComplete: (result: {
    success: boolean;
    ritual: Ritual;
    participants: RitualParticipant[];
    effectsApplied: RitualEffect[];
  }) => void;
  onCancel: () => void;
}

// ============================================================================
// RITUAL MODAL COMPONENT
// ============================================================================

type RitualStep = 'ritual_select' | 'participant_select' | 'rolling' | 'outcome';

interface RitualState {
  selectedRitual: Ritual | null;
  selectedParticipants: RitualParticipant[];
  rollResult: RollResult | null;
  effectsApplied: RitualEffect[];
  backlashTriggered: boolean;
  outcomeText: string;
}

const RitualModal: React.FC<RitualModalProps> = ({
  availableRituals,
  otherPlayers,
  playerBelief,
  playerLocation,
  onRitualComplete,
  onCancel
}) => {
  const [step, setStep] = useState<RitualStep>('ritual_select');
  const [state, setState] = useState<RitualState>({
    selectedRitual: null,
    selectedParticipants: [],
    rollResult: null,
    effectsApplied: [],
    backlashTriggered: false,
    outcomeText: ''
  });

  // =========================================================================
  // HELPER: Check if player has required beliefs for ritual
  // =========================================================================

  const canPerformRitual = (ritual: Ritual): boolean => {
    if (!ritual.requiredBeliefs || ritual.requiredBeliefs.length === 0) {
      return true; // No requirement
    }

    // Check if player belief matches any requirement
    return ritual.requiredBeliefs.some(req => playerBelief === req);
  };

  // =========================================================================
  // STEP: RITUAL SELECTION
  // =========================================================================

  const handleSelectRitual = (ritual: Ritual) => {
    setState(prev => ({
      ...prev,
      selectedRitual: ritual,
      selectedParticipants: [] // Reset participants on new ritual
    }));
    setStep('participant_select');
  };

  // =========================================================================
  // STEP: PARTICIPANT SELECTION
  // =========================================================================

  const toggleParticipant = (participant: RitualParticipant) => {
    setState(prev => ({
      ...prev,
      selectedParticipants: prev.selectedParticipants.some(p => p.clientId === participant.clientId)
        ? prev.selectedParticipants.filter(p => p.clientId !== participant.clientId)
        : [...prev.selectedParticipants, participant]
    }));
  };

  const handleBeginRitual = () => {
    if (!state.selectedRitual) return;

    // Calculate ritual modifiers
    const modifiers: DiceModifier[] = [];

    // Bonus 1: Sanctified location
    if (playerLocation === 'temple' || playerLocation === 'shrine') {
      modifiers.push({
        source: 'Sanctified Location',
        value: 3,
        icon: '🏛️',
        description: 'Ritual performed in hallowed ground'
      });
    }

    // Bonus 2: Group participation
    // Each participant adds +1, capped at +3
    const groupBonus = Math.min(state.selectedParticipants.length, 3);
    if (groupBonus > 0) {
      modifiers.push({
        source: `Group Participation (${state.selectedParticipants.length} allies)`,
        value: groupBonus,
        icon: '👥',
        description: 'Additional participants strengthen the ritual'
      });
    }

    // Penalty: Belief mismatch
    const beliefMismatch = state.selectedParticipants.filter(
      p => p.belief && p.belief !== playerBelief
    ).length;
    if (beliefMismatch > 0) {
      modifiers.push({
        source: 'Belief Mismatch',
        value: -2,
        icon: '⚠️',
        description: `${beliefMismatch} participant(s) with conflicting beliefs`
      });
    }

    // Sacrifice bonus: +2 per willing sacrifice
    const sacrifices = state.selectedParticipants.filter(p => p.isSacrificing).length;
    if (sacrifices > 0) {
      modifiers.push({
        source: `Divine Sacrifice (${sacrifices} willing)`,
        value: 2 * sacrifices,
        icon: '⚡',
        description: 'Participants willing to take damage for power'
      });
    }

    setState(prev => ({
      ...prev,
      rollResult: null
    }));

    setStep('rolling');
  };

  // =========================================================================
  // STEP: ROLL OUTCOME
  // =========================================================================

  const handleRollComplete = (rollResult: RollResult) => {
    if (!state.selectedRitual) return;

    let effectsApplied: RitualEffect[] = [];
    let backlashTriggered = false;
    let outcomeText = '';

    if (rollResult.isCritical) {
      // Critical: Major effects
      effectsApplied = state.selectedRitual.majorEffects;
      outcomeText = '✦ DIVINE FAVOR! The ritual succeeds magnificently.';
    } else if (rollResult.isFumble) {
      // Fumble: Backlash
      backlashTriggered = true;
      if (state.selectedRitual.backlashEffect) {
        effectsApplied = [state.selectedRitual.backlashEffect];
      }
      outcomeText = '☠ CALAMITY! The ritual backfires with terrible consequences.';
    } else if (rollResult.passed) {
      // Success: Determine minor vs major based on margin
      if (rollResult.margin >= 5) {
        effectsApplied = state.selectedRitual.majorEffects;
        outcomeText = '✨ The ritual succeeds! Major effects manifest.';
      } else {
        effectsApplied = state.selectedRitual.minorEffects.slice(0, 1);
        outcomeText = '✓ The ritual succeeds. Minor effects take hold.';
      }
    } else {
      // Failure: No effects
      outcomeText = '✗ The ritual fizzles. Nothing happens.';
    }

    setState(prev => ({
      ...prev,
      rollResult,
      effectsApplied,
      backlashTriggered,
      outcomeText
    }));

    setStep('outcome');
  };

  // =========================================================================
  // STEP: OUTCOME DISPLAY
  // =========================================================================

  const handleConfirmOutcome = () => {
    if (!state.selectedRitual) return;

    onRitualComplete({
      success: state.rollResult?.passed ?? false,
      ritual: state.selectedRitual,
      participants: state.selectedParticipants,
      effectsApplied: state.effectsApplied
    });
  };

  // =========================================================================
  // RENDER: RITUAL SELECTION
  // =========================================================================

  if (step === 'ritual_select') {
    return (
      <div className="ritual-modal-overlay">
        <div className="ritual-modal">
          <div className="ritual-header">
            <h2>⚡ Ritual Selection</h2>
            <p>Choose a ritual to perform</p>
          </div>

          <div className="ritual-body">
            <div className="ritual-list">
              {availableRituals.length === 0 ? (
                <p>No rituals available.</p>
              ) : (
                availableRituals.map(ritual => {
                  const canPerform = canPerformRitual(ritual);
                  return (
                    <div
                      key={ritual.ritualId}
                      className={`ritual-card ${!canPerform ? 'disabled' : ''} ritual-${ritual.category}`}
                      onClick={() => canPerform && handleSelectRitual(ritual)}
                      role="button"
                      tabIndex={canPerform ? 0 : -1}
                    >
                      <div className="ritual-name">{ritual.name}</div>
                      <div className="ritual-description">{ritual.description}</div>
                      <div className="ritual-info">
                        <span className="ritual-category">{ritual.category}</span>
                        <span className="ritual-dc">DC {ritual.baseDC}</span>
                      </div>
                      {!canPerform && (
                        <div className="ritual-blocked">
                          🔒 Requires specific belief
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="ritual-footer">
            <button onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: PARTICIPANT SELECTION
  // =========================================================================

  if (step === 'participant_select' && state.selectedRitual) {
    return (
      <div className="ritual-modal-overlay">
        <div className="ritual-modal">
          <div className="ritual-header">
            <h2>Select Participants</h2>
            <p>Ritual: {state.selectedRitual.name}</p>
          </div>

          <div className="ritual-body">
            <div className="participants-list">
              {otherPlayers.length === 0 ? (
                <p>No other players available.</p>
              ) : (
                otherPlayers.map(player => (
                  <div
                    key={player.clientId}
                    className={`participant-card ${state.selectedParticipants.some(p => p.clientId === player.clientId) ? 'selected' : ''}`}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={state.selectedParticipants.some(p => p.clientId === player.clientId)}
                        onChange={() => toggleParticipant(player)}
                      />
                      <span className="participant-name">{player.playerName}</span>
                      {player.belief && <span className="participant-belief">{player.belief}</span>}
                    </label>
                    <label className="sacrifice-label">
                      <input
                        type="checkbox"
                        disabled={!state.selectedParticipants.some(p => p.clientId === player.clientId)}
                        onChange={(e) => {
                          const updated = state.selectedParticipants.map(p =>
                            p.clientId === player.clientId
                              ? { ...p, isSacrificing: e.target.checked }
                              : p
                          );
                          setState(prev => ({
                            ...prev,
                            selectedParticipants: updated
                          }));
                        }}
                      />
                      <span>Willing to Sacrifice</span>
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="ritual-notes">
              {playerLocation === 'temple' && <p>✓ In sanctified location (+3 bonus)</p>}
              <p>Selected: {state.selectedParticipants.length} participant(s)</p>
            </div>
          </div>

          <div className="ritual-footer">
            <button onClick={() => setStep('ritual_select')} className="btn-secondary">
              Back
            </button>
            <button onClick={handleBeginRitual} className="btn-primary">
              Begin Ritual
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ROLLING STATE
  // =========================================================================

  if (step === 'rolling' && state.selectedRitual) {
    const modifiers: DiceModifier[] = [];

    if (playerLocation === 'temple' || playerLocation === 'shrine') {
      modifiers.push({
        source: 'Sanctified Location',
        value: 3,
        icon: '🏛️',
        description: 'Ritual performed in hallowed ground'
      });
    }

    const groupBonus = Math.min(state.selectedParticipants.length, 3);
    if (groupBonus > 0) {
      modifiers.push({
        source: `Group (${state.selectedParticipants.length})`,
        value: groupBonus,
        icon: '👥',
        description: `Bonus from ${state.selectedParticipants.length} participants`
      });
    }

    const beliefMismatch = state.selectedParticipants.filter(
      p => p.belief && p.belief !== playerBelief
    ).length;
    if (beliefMismatch > 0) {
      modifiers.push({
        source: 'Belief Mismatch',
        value: -2,
        icon: '⚠️',
        description: 'Penalty from conflicting beliefs among participants'
      });
    }

    const sacrifices = state.selectedParticipants.filter(p => p.isSacrificing).length;
    if (sacrifices > 0) {
      modifiers.push({
        source: `Sacrifices (${sacrifices})`,
        value: 2 * sacrifices,
        icon: '⚡',
        description: `Bonus from ${sacrifices} willing sacrifice(s)`
      });
    }

    return (
      <DiceAltarModal
        actionType="ritual"
        actionTitle={`Ritual: ${state.selectedRitual.name}`}
        modifiers={modifiers}
        dc={state.selectedRitual.baseDC}
        onRollComplete={handleRollComplete}
        onCancel={onCancel}
        autoRoll={true}
      />
    );
  }

  // =========================================================================
  // RENDER: OUTCOME
  // =========================================================================

  if (step === 'outcome' && state.selectedRitual && state.rollResult) {
    return (
      <div className="ritual-modal-overlay">
        <div className="ritual-modal">
          <div className="ritual-header">
            <h2 className={state.backlashTriggered ? 'backlash' : state.rollResult.passed ? 'success' : 'failure'}>
              {state.outcomeText}
            </h2>
          </div>

          <div className="ritual-body">
            {state.effectsApplied.length > 0 && (
              <div className="ritual-effects">
                <h3>Effects:</h3>
                <ul>
                  {state.effectsApplied.map(effect => (
                    <li key={effect.effectId}>
                      <strong>{effect.name}</strong> - {effect.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.selectedParticipants.length > 0 && (
              <div className="ritual-participants">
                <p>✓ {state.selectedParticipants.length} participant(s) involved</p>
              </div>
            )}
          </div>

          <div className="ritual-footer">
            <button onClick={handleConfirmOutcome} className="btn-primary">
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default RitualModal;
