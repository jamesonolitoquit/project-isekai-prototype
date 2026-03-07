/**
 * DivineManager.ts
 *
 * Manages divine faith dynamics, miracle execution, and covenant maintenance.
 * Integrates into Phase 2 (World AI Drift) and Phase 5 (Ripple & Paradox) of the ResolutionStack.
 *
 * DSS Compliance:
 * - DSS 06: Faith mass generation/decay, covenants, miracle execution
 * - DSS 16: Soul's Reprieve sanity recovery for meditating players
 * - Faith Decay: 5% per hour (0.5% per tick at 600 ticks/hour) - baseline 1% per day
 * - Miracle Magnitude: Integrates with ParadoxCalculator for debt penalties
 * - Soul's Reprieve: +0.1/tick sanity recovery when active (DSS 16 Patch 4)
 */

import {
  Deity,
  Covenant,
  SoulsReprieveCovenant,
  FaithMassTracker,
  DivineIntervention,
  Miracle,
  ActiveFaction,
} from '../types';

export interface FaithUpdate {
  deityId: string;
  previousFaith: number;
  generatedFaith: number;
  decayedFaith: number;
  newFaith: number;
  sources: FaithSource[];
}

export interface FaithSource {
  sourceType: 'territory' | 'covenant' | 'ritual' | 'decay';
  amount: number;
  description: string;
}

export interface MiracleExecution {
  deityId: string;
  miracleType: string;
  targetId: string;
  costFaith: number;
  magnitude: number;
  paradoxDebtIncurred: number;
  success: boolean;
  effects: MiracleEffect[];
}

export interface MiracleEffect {
  type: string;
  target: string;
  value: number;
  duration?: number;
}

export interface CovenantMaintenance {
  covenantId: string;
  deityId: string;
  maintenanceCost: number;
  maintenanceFrequency: number;
  active: boolean;
}

export interface SoulsReprieveResult {
  playerId: string;
  sanityRecovery: number;
  previousSanity: number;
  newSanity: number;
}

export interface DivinePhaseResult {
  tickNumber: number;
  faithUpdates: FaithUpdate[];
  miracleExecutions: MiracleExecution[];
  covenantMaintenanceResults: CovenantMaintenance[];
  soulsReprieveResults: SoulsReprieveResult[];
}

/**
 * Tracks which deities have cast miracles this day (to enforce 1 miracle/day limit)
 */
const miracleCooldowns = new Map<string, number>();

export class DivineManager {
  /**
   * Processes all divine systems for a tick.
   * Called during Phase 2 (World AI Drift) to allow deities to react to world state.
   */
  async processDivinePhase(
    deities: Map<string, Deity>,
    factions: Map<string, ActiveFaction>,
    currentTick: number,
    worldStability: number
  ): Promise<DivinePhaseResult> {
    const result: DivinePhaseResult = {
      tickNumber: currentTick,
      faithUpdates: [],
      miracleExecutions: [],
      covenantMaintenanceResults: [],
      soulsReprieveResults: [],
    };

    // Process each deity
    for (const [deityId, deity] of deities.entries()) {
      // Update faith dynamics (generation + decay)
      const faithUpdate = this.processFaithDynamics(
        deity,
        factions,
        currentTick,
        worldStability
      );
      result.faithUpdates.push(faithUpdate);

      // Process covenant maintenance (assuming covenants stored elsewhere)
      // NOTE: Covenant management would tie to deity covenant registry
      for (const covenant of []) {
        const maintenance = this.processCovenantMaintenance(deity, covenant, currentTick);
        result.covenantMaintenanceResults.push(maintenance);

        // Apply maintenance cost
        deity.totalFaithMass -= maintenance.maintenanceCost;
      }

      // Execute miracles if opportunity exists
      const miracleDecision = this.decideMiracleExecution(deity, factions, currentTick);
      if (miracleDecision) {
        const execution = await this.executeMiracle(deity, miracleDecision, currentTick);
        result.miracleExecutions.push(execution);
      }
    }

    return result;
  }

  /**
   * Processes faith generation and decay for a deity.
   *
   * Generation Sources:
   * - Territory: Controlled territories × 5 faith/tick
   * - Covenants: Active covenants × 10 faith/tick
   * - Rituals: Player rituals × 50 faith/tick
   * - Acts: Faithful acts × 2 faith/tick
   *
   * Decay:
   * - Base: 1% per day (0.0139% per tick at 600 ticks/hour × 24 hours)
   * - Lower world stability increases decay
   */
  private processFaithDynamics(
    deity: Deity,
    factions: Map<string, ActiveFaction>,
    currentTick: number,
    worldStability: number
  ): FaithUpdate {
    const previousFaith = deity.totalFaithMass;
    const sources: FaithSource[] = [];

    let generatedFaith = 0;

    // Territory generation (number of territories with pilgrimage sites)
    const territoryFaith = 0; // TODO: Calculate from territory list
    generatedFaith += territoryFaith;
    sources.push({
      sourceType: 'territory',
      amount: territoryFaith,
      description: `Pilgrimage sites: ${territoryFaith}`,
    });

    // Covenant generation
    // NOTE: Covenant count tracking would require covenant registry
    const covenantFaith = 0; // TODO: Track covenants per deity
    generatedFaith += covenantFaith;
    if (covenantFaith > 0) {
      sources.push({
        sourceType: 'covenant',
        amount: covenantFaith,
        description: `Active covenants: ${covenantFaith}`,
      });
    }

    // Ritual generation (from faction-provided data)
    let ritualFaith = 0;
    for (const faction of factions.values()) {
      // TODO: Track faction ritual completion
      // ritualFaith += faction.completedRitualsThisTick * 50;
    }
    generatedFaith += ritualFaith;
    if (ritualFaith > 0) {
      sources.push({
        sourceType: 'ritual',
        amount: ritualFaith,
        description: `Faction rituals: ${ritualFaith}`,
      });
    }

    // Apply generation
    deity.totalFaithMass += generatedFaith;

    // Calculate decay (1% per day baseline + world stability modifier)
    // At 1 tick = 1 minute, 1 day = 1440 ticks
    // 1% effective decay = 0.0139% per tick
    const baseDecayRate = 0.000139; // 1% per 1440 ticks

    // World stability modifier: Lower stability = faster decay
    const decayMultiplier = 1 + (100 - worldStability) * 0.0001; // +0.01 at stability 0
    const decayedFaith = deity.totalFaithMass * baseDecayRate * decayMultiplier;

    deity.totalFaithMass = Math.max(0, deity.totalFaithMass - decayedFaith);

    sources.push({
      sourceType: 'decay',
      amount: -decayedFaith,
      description: `Baseline decay: -${decayedFaith.toFixed(2)}`,
    });

    return {
      deityId: deity.id,
      previousFaith,
      generatedFaith,
      decayedFaith,
      newFaith: deity.totalFaithMass,
      sources,
    };
  }

  /**
   * Processes covenant maintenance costs.
   * Each active covenant requires periodic faith payments to maintain benefits.
   *
   * Maintenance Frequency:
   * - soul-reprieve: Every 300 ticks (0.5 cost per day)
   * - maternal-blessing: Every 600 ticks (1.0 cost per day)
   * - ancestral-echo: Every 1200 ticks (2.0 cost per 2 days)
   * - divine-protection: Every 900 ticks (1.0 cost per day)
   * - faith-amplification: Every 450 ticks (1.5 cost per day)
   */
  private processCovenantMaintenance(
    deity: Deity,
    covenant: Covenant,
    currentTick: number
  ): CovenantMaintenance {
    let maintenanceFrequency = 600; // Default: every 10 minutes
    let maintenanceCost = 1.0;

    // Ensure covenant.type is defined
    const covenantType = (covenant as any).type || 'other';

    switch (covenantType as string) {
      case 'soul-reprieve':
        maintenanceFrequency = 300; // Every 5 minutes
        maintenanceCost = 0.5;
        break;
      case 'maternal-blessing':
        maintenanceFrequency = 600;
        maintenanceCost = 1.0;
        break;
      case 'ancestral-echo':
        maintenanceFrequency = 1200;
        maintenanceCost = 2.0;
        break;
      case 'divine-protection':
        maintenanceFrequency = 900;
        maintenanceCost = 1.0;
        break;
      case 'faith-amplification':
        maintenanceFrequency = 450;
        maintenanceCost = 1.5;
        break;
    }

    // Check if maintenance is due
    const lastMaint = (covenant as any).lastMaintenanceTick || 0;
    const timeSinceMaintenance = currentTick - lastMaint;
    const active =
      timeSinceMaintenance >= maintenanceFrequency &&
      deity.totalFaithMass >= maintenanceCost;

    // Update maintenance tick if active
    if (active && (covenant as any).lastMaintenanceTick !== undefined) {
      (covenant as any).lastMaintenanceTick = currentTick;
    }

    return {
      covenantId: covenant.id,
      deityId: deity.id,
      maintenanceCost: active ? maintenanceCost : 0,
      maintenanceFrequency,
      active,
    };
  }

  /**
   * Decides whether a deity should execute a miracle.
   * Decision factors:
   * - Faith threshold: Must have > 50% of max faith
   * - Cooldown: 1 miracle per day (1440 ticks)
   * - World need: Lower world stability increases likelihood
   * - Faction favor: Factions with higher favor get miracles
   */
  private decideMiracleExecution(
    deity: Deity,
    factions: Map<string, ActiveFaction>,
    currentTick: number
  ): { factionId: string; miracleType: string; targetType: string } | null {
    // Check cooldown
    const lastMiracleTime = miracleCooldowns.get(deity.id) || 0;
    if (currentTick - lastMiracleTime < 1440) {
      return null; // Cooldown active
    }

    // Check faith threshold
    const maxFaith = 1000; // Baseline max faith
    if (deity.totalFaithMass < maxFaith * 0.5) {
      return null; // Insufficient faith
    }

    // Find faction with highest alignment
    let bestFaction: ActiveFaction | null = null;
    let bestAlignment = 0;

    for (const faction of factions.values()) {
      // NOTE: alignmentMap would need to be added to Deity or tracked separately
      const alignment = 0; // TODO: Track faction-deity alignment
      if (alignment > bestAlignment) {
        bestAlignment = alignment;
        bestFaction = faction;
      }
    }

    if (!bestFaction) {
      // Default to first faction if available
      for (const faction of factions.values()) {
        bestFaction = faction;
        break;
      }
    }

    if (!bestFaction) {
      return null; // No factions available
    }

    // Decide miracle type (since alignment is 0, use random)
    const miracleType = Math.random() > 0.5 ? 'major' : 'minor';

    return {
      factionId: bestFaction.id,
      miracleType,
      targetType: 'faction',
    };
  }

  /**
   * Executes a miracle for a faction.
   * Miracle magnitude determines success chance and paradox debt incurred.
   *
   * Major Miracle (100 faith):
   * - Success rate: 90%
   * - Paradox debt: 5.0
   * - Effects: Large faction buff, territory capture bonus
   *
   * Minor Miracle (30 faith):
   * - Success rate: 98%
   * - Paradox debt: 0.5
   * - Effects: Small faction buff, resource generation boost
   *
   * Integration with ParadoxCalculator:
   * If world state is already in BLEACH or REALITY_FAULT, higher debt can trigger state change.
   */
  async executeMiracle(
    deity: Deity,
    decision: {
      factionId: string;
      miracleType: string;
      targetType: string;
    },
    currentTick: number
  ): Promise<MiracleExecution> {
    const costFaith = decision.miracleType === 'major' ? 100 : 30;
    const magnitude = decision.miracleType === 'major' ? 1.0 : 0.5;
    const paradoxDebtBase = decision.miracleType === 'major' ? 5.0 : 0.5;

    const successRate = decision.miracleType === 'major' ? 0.9 : 0.98;
    const success = Math.random() < successRate;

    const effects: MiracleEffect[] = [];

    if (success) {
      deity.totalFaithMass -= costFaith;

      // Apply miracle effects
      if (decision.miracleType === 'major') {
        effects.push({
          type: 'faction_momentum',
          target: decision.factionId,
          value: 20, // +20% action efficiency
          duration: 300, // 5 minutes
        });
        effects.push({
          type: 'territory_influence',
          target: decision.factionId,
          value: 50, // +50 influence points
        });
      } else {
        effects.push({
          type: 'faction_momentum',
          target: decision.factionId,
          value: 5, // +5% action efficiency
          duration: 150, // 2.5 minutes
        });
        effects.push({
          type: 'resource_generation',
          target: decision.factionId,
          value: 15, // +15 budget
        });
      }
    }

    // Paradox debt incurrence
    // NOTE: This should integrate with ParadoxCalculator in integrated testing
    const paradoxDebtIncurred = success ? paradoxDebtBase : paradoxDebtBase * 0.5;

    // Update miracle cooldown
    miracleCooldowns.set(deity.id, currentTick);

    return {
      deityId: deity.id,
      miracleType: decision.miracleType,
      targetId: decision.factionId,
      costFaith,
      magnitude,
      paradoxDebtIncurred,
      success,
      effects,
    };
  }

  /**
   * Applies Soul's Reprieve sanity recovery.
   * This is DSS 16 Patch 4 feature for meditating players with the covenant.
   *
   * Recovery: +0.1/tick sanity when actively meditating
   * Duration: Continues as long as player is in meditation state
   * Cost: 1 faith per 10 ticks of meditation
   */
  public async applySoulsReprieve(
    deity: Deity,
    playerId: string,
    previousSanity: number,
    meditationDuration: number, // ticks
    isActive: boolean
  ): Promise<SoulsReprieveResult> {
    let newSanity = previousSanity;
    let recovery = 0;

    // NOTE: Soul's Reprieve covenant would need to be tracked in covenant registry
    const covenant = null; // TODO: Lookup from covenant registry

    if (isActive && covenant && deity.totalFaithMass > 0.1) {
      // Apply recovery
      recovery = Math.min(10, meditationDuration * 0.1); // Max 10 sanity per update
      newSanity = Math.min(100, previousSanity + recovery);

      // Apply faith cost
      const faithCost = meditationDuration / 10;
      deity.totalFaithMass -= faithCost;
    }

    return {
      playerId,
      sanityRecovery: recovery,
      previousSanity,
      newSanity,
    };
  }

  /**
   * Checks if a deity can grant a miracle to a faction.
   * Requirements:
   * - Sufficient faith (>50% max)
   * - Cooldown expired (1/day)
   * - Target faction has sufficient alignment
   */
  public canGrantMiracle(
    deity: Deity,
    targetFactionId: string,
    currentTick: number
  ): boolean {
    const lastMiracleTime = miracleCooldowns.get(deity.id) || 0;
    const cooldownRemaining = 1440 - (currentTick - lastMiracleTime);

    if (cooldownRemaining > 0) {
      return false; // Cooldown active
    }

    const maxFaith = 1000;
    if (deity.totalFaithMass < maxFaith * 0.5) {
      return false; // Insufficient faith
    }

    // NOTE: alignmentMap would need to be added or tracked separately
    const alignment = 0; // TODO: Track alignment
    if (alignment < 50) {
      return false; // Insufficient alignment
    }

    return true;
  }

  /**
   * Gets faith mass for a deity.
   */
  public getFaithMass(deity: Deity): number {
    return deity.totalFaithMass;
  }

  /**
   * Gets active covenants for a deity.
   */
  public getActiveCovenants(deity: Deity): Covenant[] {
    // NOTE: Would need to query covenant registry
    return [];
  }

  /**
   * Registers a miracle cooldown reset (for daily reset at midnight)
   */
  public resetMiracleCooldowns(): void {
    miracleCooldowns.clear();
  }

  /**
   * Gets remaining cooldown for a deity's next miracle (in ticks)
   */
  public getMiracleCooldownRemaining(deityId: string, currentTick: number): number {
    const lastMiracleTime = miracleCooldowns.get(deityId) || 0;
    const timeSinceMiracle = currentTick - lastMiracleTime;
    const cooldown = Math.max(0, 1440 - timeSinceMiracle);
    return cooldown;
  }
}

export default DivineManager;

// NOTE: The following would need to be added to Deity interface for full integration:
// - alignmentMap: Map<string, number> (faction ID -> alignment score)
// - activeCovenants: Covenant[] (list of active covenants)
// These would enable full tracking of covenant relationships and faction alignment
