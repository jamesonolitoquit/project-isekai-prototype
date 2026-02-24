/**
 * Phase 32: M62-CHRONOS Integration Module
 * 
 * Orchestrates the complete Beta Graduation pipeline:
 * 1. Ledger validation on load (deterministic integrity)
 * 2. Chronicle sequence processing on epoch transition (legendary inheritance)
 * 3. Snapshot coordination with validation checkpoints
 * 4. Atmospheric integration at root level
 */

import type { WorldState } from './worldEngine';
import type { EpochTransitionResult } from './chronicleEngine';
import { processChronicleSequence, type InheritancePayload } from './chronicleEngine';
import { calculateEpochTransitionResult } from './chronicleEngine';
import type { LegacyImpact } from './legacyEngine';
import { LedgerValidator } from './ledgerValidator';
import { getEventsForWorld } from '../events/mutationLog';

/**
 * M62-CHRONOS: Complete epoch transition with chronicle sequence processing
 * 
 * Called when player reaches epoch end conditions (Myth Status reached, world changed, etc)
 * Returns inheritance payload for next epoch player
 */
export async function processEpochTransitionWithChronicles(
  currentState: WorldState,
  fromEpochId: string,
  toEpochId: string,
  legacyImpact: LegacyImpact | null
): Promise<{
  transitionResult: EpochTransitionResult;
  inheritancePayload: InheritancePayload;
  ledgerHash: string;
}> {
  try {
    // Step 1: Calculate epoch transition result
    // Use provided legacy impact or fallback to empty impact
    const effectiveLegacy = legacyImpact || {
      id: `legacy_${Date.now()}`,
      inheritedFactionReputation: {},
      discoveredLocations: [],
      npcMemories: {},
      paradoxDebt: 0,
      ancestralBooms: [],
      ancestralBlights: [],
      canonicalDeeds: [],
      heirlooms: []
    };
    
    const transitionResult = calculateEpochTransitionResult(
      currentState,
      fromEpochId,
      toEpochId,
      effectiveLegacy
    );

    // Step 2: Process chronicle sequence for inheritance
    const inheritancePayload = processChronicleSequence(transitionResult);

    // Step 3: Validate ledger integrity for determinism
    const events = getEventsForWorld(currentState.id);
    const ledgerValidation = await LedgerValidator.validateLedgerIntegrity(
      events.map(e => ({
        type: e.type,
        tick: e.tick || 0,
        timestamp: e.timestamp || 0,
        payload: e.payload
      }))
    );

    if (!ledgerValidation.valid) {
      console.error('[M62] Ledger validation failed:', ledgerValidation.errorMessage);
      throw new Error(`Ledger integrity check failed: ${ledgerValidation.errorMessage}`);
    }

    console.log('[M62] Epoch transition complete with inheritance:', {
      fromEpoch: fromEpochId,
      toEpoch: toEpochId,
      mythStatus: transitionResult.mythStatus,
      ancestorRank: inheritancePayload.ancestorMythRank,
      legacyBudget: inheritancePayload.legacyBudget,
      ledgerHash: ledgerValidation.ledgerHash
    });

    return {
      transitionResult,
      inheritancePayload,
      ledgerHash: ledgerValidation.ledgerHash
    };
  } catch (error) {
    console.error('[M62] Epoch transition failed:', error);
    throw error;
  }
}

/**
 * M62: Verify snapshot + delta replay integrity against ledger checkpoint
 * Called after loading snapshot + replaying delta events
 * Ensures perfect determinism: snapshot + replay = original path
 */
export async function verifyDeltaReplayIntegrity(
  eventsFromSnapshotTick: Array<{ type: string; tick: number; timestamp: number; payload?: any }>,
  previousLedgerHash: string
): Promise<{
  valid: boolean;
  ledgerHash: string;
  errorMessage?: string;
}> {
  const validation = await LedgerValidator.validateLedgerIntegrity(
    eventsFromSnapshotTick,
    previousLedgerHash
  );
  return validation;
}

/**
 * M62: Get inheritance data for UI display
 * Shows ancestral gifts, memories, and starting bonuses
 */
export function formatInheritanceForDisplay(payload: InheritancePayload): {
  ancestorName: string;
  mythRank: string;
  artifacts: Array<{ name: string; rarity: string }>;
  unlockedMemories: string[];
  questsAvailable: string[];
  factionBonuses: Array<{ faction: string; bonus: number }>;
} {
  const rankNames = ['Forgotten', 'Known', 'Remembered', 'Notable', 'Legendary', 'Mythic'];
  const rankName = rankNames[Math.min(payload.ancestorMythRank, rankNames.length - 1)];

  return {
    ancestorName: `Ancestor (${rankName})`,
    mythRank: rankName,
    artifacts: payload.inheritedArtifacts.map(a => ({
      name: a.name,
      rarity: a.rarity
    })),
    unlockedMemories: payload.unlockedMemories,
    questsAvailable: payload.ancestorQuests.map(q => q.title),
    factionBonuses: Object.entries(payload.factionStandingBonus).map(([faction, bonus]) => ({
      faction,
      bonus
    }))
  };
}

/**
 * Export for integration into worldEngine epoch handler
 */
export const Phase32Chronos = {
  processEpochTransitionWithChronicles,
  verifyDeltaReplayIntegrity,
  formatInheritanceForDisplay
};

export type { InheritancePayload } from './chronicleEngine';
