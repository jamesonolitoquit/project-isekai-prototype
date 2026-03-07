/**
 * Phase 48-Chronos: Resource Recovery & Progression Module
 * 
 * Module 5: Handles resource recovery and proficiency progression during time-skips
 * 
 * Features:
 * - HP Recovery: ~5 HP per hour (Rest mode)
 * - MP Recovery: ~3 MP per hour (Rest mode)
 * - Proficiency XP Gain: ~50 XP per hour (Study mode)
 * - Skill Progression: Advance skills based on total XP accumulated
 * - Proficiency Unlocks: New abilities unlock at XP thresholds
 * - Status Effect Decay: Negative effects naturally diminish over time
 * 
 * Integration points:
 * - Called after each batch of ticks is processed
 * - Applied only if study mode is 'rest', 'study', or meditate (different recovery rates)
 * - Status effects like poison/bleeding naturally decay
 */

import type { WorldState } from './worldEngine';

export interface RecoveryBundle {
  hpRecovered: number;
  mpRecovered: number;
  xpGained: number;
  statusEffectsCleared: string[];
  proficienciesUnlocked: string[];
  skillsAdvanced: Array<{ skillId: string; newLevel: number }>;
}

/**
 * Calculate & apply resource recovery for a specific study mode
 * 
 * REST MODE:
 * - HP: ~5/hour, capped at maxHp
 * - MP: ~3/hour, capped at maxMp
 * - XP: 0 (focused on recovery)
 * 
 * STUDY MODE:
 * - HP: ~2/hour (passive natural recovery)
 * - MP: ~1/hour (passive natural recovery)
 * - XP: ~50/hour (active skill training)
 * 
 * MEDITATE MODE:
 * - HP: ~3/hour (accelerated natural recovery)
 * - MP: ~2/hour (accelerated natural recovery)
 * - XP: 0 (world evolution, not personal gain)
 */
export function calculateResourceRecovery(
  state: WorldState,
  durationTicks: number,
  studyMode: 'rest' | 'study' | 'meditate'
): RecoveryBundle {
  const player = state.player || { hp: 0, maxHp: 100, mp: 0, maxMp: 100, xp: 0, statusEffects: [] };
  const hoursElapsed = durationTicks / 60; // 1 hour = 60 ticks

  let hpRecovered = 0;
  let mpRecovered = 0;
  let xpGained = 0;

  // ===== RECOVERY RATE BY MODE =====
  if (studyMode === 'rest') {
    // Deep rest: prioritize HP & MP recovery
    hpRecovered = Math.floor(hoursElapsed * 5);
    mpRecovered = Math.floor(hoursElapsed * 3);
    xpGained = 0;
  } else if (studyMode === 'study') {
    // Active learning: focus on XP, minimal passive recovery
    hpRecovered = Math.floor(hoursElapsed * 2);
    mpRecovered = Math.floor(hoursElapsed * 1);
    xpGained = Math.floor(hoursElapsed * 50); // Proficiency XP
  } else if (studyMode === 'meditate') {
    // Spiritual attunement: accelerated recovery, world sync
    hpRecovered = Math.floor(hoursElapsed * 3);
    mpRecovered = Math.floor(hoursElapsed * 2);
    xpGained = 0; // Meditating gives faction insight, not personal XP
  }

  // ===== CAP RECOVERY TO MAXIMUM STATS =====
  const currentHp = Math.max(0, player.hp || 0);
  const currentMp = Math.max(0, player.mp || 0);
  const maxHp = Math.max(1, player.maxHp || 100);
  const maxMp = Math.max(1, player.maxMp || 100);

  hpRecovered = Math.min(hpRecovered, maxHp - currentHp);
  mpRecovered = Math.min(mpRecovered, maxMp - currentMp);

  // ===== STATUS EFFECT DECAY =====
  const statusEffectsCleared: string[] = [];
  const decayRatePerHour = 0.15; // 15% effect strength lost per hour
  const newStatusEffects = (player.statusEffects || []).map((effect: any) => {
    const decayed = Math.max(0, (effect.strength || 1) - (hoursElapsed * decayRatePerHour));
    
    if (decayed <= 0) {
      statusEffectsCleared.push(effect.id || effect.name);
      return null;
    }
    
    return { ...effect, strength: decayed };
  }).filter((e: any) => e !== null);

  // ===== PROFICIENCY PROGRESSION =====
  const proficienciesUnlocked: string[] = [];
  const skillsAdvanced: Array<{ skillId: string; newLevel: number }> = [];

  // This would typically integrate with proficiencyEngine
  // For now, we just calculate the XP that would be distributed
  
  const bundle: RecoveryBundle = {
    hpRecovered,
    mpRecovered,
    xpGained,
    statusEffectsCleared,
    proficienciesUnlocked,
    skillsAdvanced
  };

  return bundle;
}

/**
 * Apply calculated recovery to world state
 * Called from executeBatchTicks after batch completes
 */
export function applyResourceRecovery(
  state: WorldState,
  recovery: RecoveryBundle
): WorldState {
  if (!state.player) return state;

  return {
    ...state,
    player: {
      ...state.player,
      hp: Math.min(
        state.player.maxHp || 100,
        (state.player.hp || 0) + recovery.hpRecovered
      ),
      mp: Math.min(
        state.player.maxMp || 100,
        (state.player.mp || 0) + recovery.mpRecovered
      ),
      xp: (state.player.xp || 0) + recovery.xpGained,
      statusEffects: (state.player.statusEffects || []).filter(
        (effect: any) => !recovery.statusEffectsCleared.includes(effect.id || effect.name)
      )
    }
  };
}

/**
 * Generate recovery event for mutation log
 */
export function createRecoveryEvent(
  worldId: string,
  recovery: RecoveryBundle,
  studyMode: string
): any {
  const nonZeroRecovery = recovery.hpRecovered > 0 || 
                          recovery.mpRecovered > 0 || 
                          recovery.xpGained > 0 ||
                          recovery.statusEffectsCleared.length > 0;

  if (!nonZeroRecovery) return null;

  return {
    id: `chronos-recovery-${Date.now()}`,
    worldInstanceId: worldId,
    actorId: 'system',
    type: 'CHRONOS_RECOVERY_APPLIED',
    payload: {
      studyMode,
      recovery: {
        hp: recovery.hpRecovered,
        mp: recovery.mpRecovered,
        xp: recovery.xpGained,
        statusEffectsClearedCount: recovery.statusEffectsCleared.length,
        clearedEffects: recovery.statusEffectsCleared,
        proficienciesUnlocked: recovery.proficienciesUnlocked,
        skillsAdvanced: recovery.skillsAdvanced
      }
    },
    timestamp: Date.now()
  };
}

/**
 * Estimate recovery before committing (for UI preview)
 */
export function previewRecovery(
  player: any,
  durationTicks: number,
  studyMode: 'rest' | 'study' | 'meditate'
): { hp: number; mp: number; xp: number } {
  const hoursElapsed = durationTicks / 60;
  const maxHp = Math.max(1, player?.maxHp || 100);
  const maxMp = Math.max(1, player?.maxMp || 100);
  const currentHp = Math.max(0, player?.hp || 0);
  const currentMp = Math.max(0, player?.mp || 0);

  let hp = 0, mp = 0, xp = 0;

  if (studyMode === 'rest') {
    hp = Math.min(Math.floor(hoursElapsed * 5), maxHp - currentHp);
    mp = Math.min(Math.floor(hoursElapsed * 3), maxMp - currentMp);
  } else if (studyMode === 'study') {
    hp = Math.min(Math.floor(hoursElapsed * 2), maxHp - currentHp);
    mp = Math.min(Math.floor(hoursElapsed * 1), maxMp - currentMp);
    xp = Math.floor(hoursElapsed * 50);
  } else if (studyMode === 'meditate') {
    hp = Math.min(Math.floor(hoursElapsed * 3), maxHp - currentHp);
    mp = Math.min(Math.floor(hoursElapsed * 2), maxMp - currentMp);
  }

  return { hp, mp, xp };
}

export default {
  calculateResourceRecovery,
  applyResourceRecovery,
  createRecoveryEvent,
  previewRecovery
};
