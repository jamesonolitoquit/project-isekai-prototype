import { WorldState, PlayerState } from './worldEngine';

/**
 * Constraint Validation System: Ensures the world state never enters an impossible condition
 * Used to detect and rollback from edge-case bugs
 */

export interface ValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
  warnings: string[];
}

export interface ConstraintViolation {
  type: string;
  severity: 'critical' | 'error' | 'warning';
  message: string;
  affectedFields?: string[];
  suggestedFix?: string;
}

/**
 * Validate all invariants: ensures state is physically possible
 */
export function validateInvariants(state: WorldState): ValidationResult {
  const violations: ConstraintViolation[] = [];
  const warnings: string[] = [];

  // Player HP validation
  if (state.player?.hp === undefined) {
    violations.push({
      type: 'MISSING_PLAYER_HP',
      severity: 'critical',
      message: 'Player HP is undefined',
      affectedFields: ['player.hp'],
      suggestedFix: 'Initialize player.hp to min(current, maxHp)'
    });
  } else if (state.player?.maxHp !== undefined && state.player.hp > state.player.maxHp) {
    violations.push({
      type: 'HP_OVERFLOW',
      severity: 'error',
      message: `Player HP (${state.player.hp}) exceeds Max HP (${state.player.maxHp})`,
      affectedFields: ['player.hp', 'player.maxHp'],
      suggestedFix: `Set HP to ${state.player.maxHp}`
    });
  } else if (state.player?.hp < 0) {
    violations.push({
      type: 'NEGATIVE_HP',
      severity: 'error',
      message: 'Player HP is negative',
      affectedFields: ['player.hp'],
      suggestedFix: 'Set HP to 0'
    });
  }

  // Mana validation
  if (state.player?.mp !== undefined && state.player?.maxMp !== undefined) {
    if (state.player.mp > state.player.maxMp) {
      violations.push({
        type: 'MANA_OVERFLOW',
        severity: 'error',
        message: `Player MP (${state.player.mp}) exceeds Max MP (${state.player.maxMp})`,
        affectedFields: ['player.mp', 'player.maxMp'],
        suggestedFix: `Set MP to ${state.player.maxMp}`
      });
    }
    if (state.player.mp < 0) {
      violations.push({
        type: 'NEGATIVE_MANA',
        severity: 'error',
        message: 'Player MP is negative',
        affectedFields: ['player.mp'],
        suggestedFix: 'Set MP to 0'
      });
    }
  }

  // Stat validation (should be in reasonable range)
  if (state.player?.stats) {
    const stats = state.player.stats;
    const statKeys = ['str', 'agi', 'int', 'cha', 'end', 'luk'];
    statKeys.forEach((stat) => {
      const value = (stats as any)[stat];
      if (value !== undefined) {
        if (value < 0) {
          violations.push({
            type: 'NEGATIVE_STAT',
            severity: 'error',
            message: `Player stat ${stat} is negative (${value})`,
            affectedFields: [`player.stats.${stat}`],
            suggestedFix: `Set ${stat} to 1`
          });
        }
        if (value > 99) {
          warnings.push(`Player stat ${stat} is extremely high (${value}). Human readability may suffer.`);
        }
      }
    });
  }

  // Soul Strain validation (should be 0-100)
  if (state.player?.soulStrain !== undefined) {
    if (state.player.soulStrain < 0) {
      violations.push({
        type: 'NEGATIVE_SOUL_STRAIN',
        severity: 'error',
        message: 'Soul Strain is negative',
        affectedFields: ['player.soulStrain'],
        suggestedFix: 'Set soulStrain to 0'
      });
    }
    if (state.player.soulStrain > 100) {
      warnings.push(`Player Soul Strain is ${state.player.soulStrain} (>100). May trigger unintended penalties.`);
    }
  }

  // Temporal Debt validation (should be 0-100)
  if (state.player?.temporalDebt !== undefined) {
    if (state.player.temporalDebt < 0) {
      violations.push({
        type: 'NEGATIVE_TEMPORAL_DEBT',
        severity: 'error',
        message: 'Temporal Debt is negative',
        affectedFields: ['player.temporalDebt'],
        suggestedFix: 'Set temporalDebt to 0'
      });
    }
    if (state.player.temporalDebt > 100) {
      warnings.push(`Player Temporal Debt is ${state.player.temporalDebt} (>100). May approach Reality Snap threshold.`);
    }
  }

  // Inventory validation
  if (state.player?.inventory) {
    state.player.inventory.forEach((item, idx) => {
      // Check stackable item quantity
      if (item.kind === 'stackable' && 'quantity' in item) {
        if (item.quantity < 0) {
          violations.push({
            type: 'NEGATIVE_INVENTORY_QUANTITY',
            severity: 'error',
            message: `Inventory item ${item.itemId} has negative quantity (${item.quantity})`,
            affectedFields: [`player.inventory[${idx}].quantity`],
            suggestedFix: `Remove inventory entry or set quantity to 0`
          });
        }
        if (item.quantity === 0) {
          warnings.push(`Inventory item ${item.itemId} has zero quantity (should be removed)`);
        }
      }
    });
  }

  // NPC location validation
  if (state.npcs && state.locations) {
    const validLocationIds = state.locations.map((l) => l.id);
    state.npcs.forEach((npc, idx) => {
      if (!validLocationIds.includes(npc.locationId)) {
        violations.push({
          type: 'INVALID_NPC_LOCATION',
          severity: 'error',
          message: `NPC ${npc.name} is at invalid location ${npc.locationId}`,
          affectedFields: [`npcs[${idx}].locationId`],
          suggestedFix: `Move NPC to valid location or add location to template`
        });
      }
    });
  }

  // Player location validation
  if (state.player?.location && state.locations) {
    const validLocationIds = state.locations.map((l) => l.id);
    if (!validLocationIds.includes(state.player.location)) {
      violations.push({
        type: 'INVALID_PLAYER_LOCATION',
        severity: 'critical',
        message: `Player is at invalid location ${state.player.location}`,
        affectedFields: ['player.location'],
        suggestedFix: `Move player to valid location (e.g., ${validLocationIds[0] || 'town'})`
      });
    }
  }

  // Faction reputation validation (-100 to +100)
  if (state.player?.factionReputation) {
    Object.entries(state.player.factionReputation).forEach(([factionId, rep]) => {
      if ((rep as number) < -100 || (rep as number) > 100) {
        warnings.push(
          `Faction ${factionId} reputation is ${rep} (expected -100 to +100). Still valid but extreme.`
        );
      }
    });
  }

  // Combat state validation
  if (state.combatState?.active) {
    if (!state.combatState.participants || state.combatState.participants.length < 2) {
      violations.push({
        type: 'INVALID_COMBAT_STATE',
        severity: 'error',
        message: 'Combat is active but has fewer than 2 participants',
        affectedFields: ['combatState.participants'],
        suggestedFix: 'End combat or add participants'
      });
    }
  }

  // Travel state validation
  if (state.travelState?.isTraveling) {
    const validLocationIds = state.locations?.map((l) => l.id) || [];
    if (!validLocationIds.includes(state.travelState.fromLocationId)) {
      violations.push({
        type: 'INVALID_TRAVEL_SOURCE',
        severity: 'error',
        message: `Travel from invalid location ${state.travelState.fromLocationId}`,
        affectedFields: ['travelState.fromLocationId'],
        suggestedFix: `Update to valid location`
      });
    }
    if (!validLocationIds.includes(state.travelState.toLocationId)) {
      violations.push({
        type: 'INVALID_TRAVEL_DESTINATION',
        severity: 'error',
        message: `Travel to invalid location ${state.travelState.toLocationId}`,
        affectedFields: ['travelState.toLocationId'],
        suggestedFix: `Update to valid location`
      });
    }
    if (state.travelState.remainingTicks < 0) {
      violations.push({
        type: 'NEGATIVE_TRAVEL_TICKS',
        severity: 'error',
        message: 'Travel remainingTicks is negative',
        affectedFields: ['travelState.remainingTicks'],
        suggestedFix: 'Set to 0 and end travel'
      });
    }
  }

  // Equipment slot validation
  if (state.player?.equipment) {
    const slots = state.player.equipment;
    const validSlots = ['head', 'chest', 'mainHand', 'offHand', 'feet', 'accessory'];
    Object.entries(slots).forEach(([slot, itemId]) => {
      if (!validSlots.includes(slot)) {
        warnings.push(`Unknown equipment slot: ${slot}`);
      }
      if (itemId && !state.player?.inventory?.some((inv) => inv.itemId === itemId)) {
        violations.push({
          type: 'EQUIPPED_UNKNOWN_ITEM',
          severity: 'error',
          message: `Equipment slot ${slot} contains unknown item ${itemId}`,
          affectedFields: [`player.equipment.${slot}`],
          suggestedFix: `Remove item from equipment or add to inventory`
        });
      }
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * Check paradox-specific limits and thresholds
 */
export function checkParadoxLimits(
  state: WorldState,
  currentParadox: number
): { limitExceeded: boolean; action?: string; severity: 'warning' | 'critical' } {
  // Paradox ranges [0-100]
  if (currentParadox < 0) {
    return {
      limitExceeded: true,
      severity: 'critical',
      action: 'PARADOX_UNDERFLOW'
    };
  }

  if (currentParadox > 100) {
    return {
      limitExceeded: true,
      severity: 'critical',
      action: 'REALITY_SNAP'
    };
  }

  if (currentParadox >= 90) {
    return {
      limitExceeded: true,
      severity: 'warning',
      action: 'PARADOX_CRITICAL'
    };
  }

  return {
    limitExceeded: false,
    severity: 'warning'
  };
}

/**
 * Suggestion engine for common violations
 */
export function suggestFixForViolation(
  violation: ConstraintViolation,
  state: WorldState
): Partial<WorldState> | null {
  const fix: any = {};

  switch (violation.type) {
    case 'HP_OVERFLOW':
      fix.player = { ...state.player, hp: state.player?.maxHp || 100 };
      return fix;

    case 'NEGATIVE_HP':
      fix.player = { ...state.player, hp: 0 };
      return fix;

    case 'MANA_OVERFLOW':
      fix.player = { ...state.player, mp: state.player?.maxMp || 50 };
      return fix;

    case 'NEGATIVE_MANA':
      fix.player = { ...state.player, mp: 0 };
      return fix;

    case 'NEGATIVE_SOUL_STRAIN':
      fix.player = { ...state.player, soulStrain: 0 };
      return fix;

    case 'NEGATIVE_TEMPORAL_DEBT':
      fix.player = { ...state.player, temporalDebt: 0 };
      return fix;

    case 'INVALID_PLAYER_LOCATION':
      const validLoc = state.locations?.[0]?.id || 'town';
      fix.player = { ...state.player, location: validLoc };
      return fix;

    case 'INVALID_NPC_LOCATION':
      // NPC location will require special handling in stateRebuilder
      return null;

    case 'NEGATIVE_STAT':
      const match = violation.message.match(/stat (\w+)/);
      if (match) {
        const statName = match[1];
        fix.player = {
          ...state.player,
          stats: {
            ...state.player?.stats,
            [statName]: 1
          }
        };
      }
      return fix || null;

    case 'INVALID_TRAVEL_SOURCE':
    case 'INVALID_TRAVEL_DESTINATION':
      fix.travelState = undefined; // End travel
      return fix;

    case 'NEGATIVE_TRAVEL_TICKS':
      fix.travelState = {
        ...state.travelState,
        isTraveling: false,
        remainingTicks: 0
      };
      return fix;

    default:
      return null;
  }
}

/**
 * Check if state is in a valid playable condition
 */
export function isStatePlayable(state: WorldState): boolean {
  const result = validateInvariants(state);
  const criticalViolations = result.violations.filter((v) => v.severity === 'critical');
  return criticalViolations.length === 0;
}

/**
 * Full validation report with human-readable format
 */
export function generateValidationReport(result: ValidationResult): string {
  let report = '=== VALIDATION REPORT ===\n';
  report += `Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}\n\n`;

  if (result.violations.length > 0) {
    report += `VIOLATIONS (${result.violations.length}):\n`;
    result.violations.forEach((v) => {
      report += `  [${v.severity.toUpperCase()}] ${v.type}: ${v.message}\n`;
      if (v.suggestedFix) {
        report += `    → Fix: ${v.suggestedFix}\n`;
      }
    });
    report += '\n';
  }

  if (result.warnings.length > 0) {
    report += `WARNINGS (${result.warnings.length}):\n`;
    result.warnings.forEach((w) => {
      report += `  ⚠️ ${w}\n`;
    });
  }

  return report;
}
