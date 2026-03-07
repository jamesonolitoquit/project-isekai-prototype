/**
 * GeographyManager.ts
 *
 * Manages territorial stability, tax collection, information lag, and regional effects.
 * Integrates into Phase 5 (Ripple & Paradox) of the ResolutionStack.
 *
 * DSS Compliance:
 * - DSS 05: Territory control, stability metrics, tax formulas, information lag
 * - Stability Recovery: +0.2/tick (capped to prevent "instant peace")
 * - Tax Collection: Every 600 ticks (15 mins) to reduce computational overhead
 * - Information Lag: Composite fog combining environmental + political + divine
 */

import {
  TerritoryNode,
  StabilityMetric,
  TerritoryInformationLag,
  RegionalHazard,
  TaxSystem,
  ActiveFaction,
} from '../types';

export interface TerritoryUpdate {
  territoryId: string;
  previousStability: number;
  newStability: number;
  stabilityTrend: number;
  threatLevel: number;
  informationLag: TerritoryInformationLag;
  taxesClaimed: boolean;
  taxRevenue: number;
}

export interface TaxCollectionResult {
  territoryId: string;
  controllingFactionId: string | null;
  taxRevenue: number;
  populationWillingness: number;
  stabilityModifier: number;
}

export interface GeographyPhaseResult {
  tickNumber: number;
  territoryUpdates: TerritoryUpdate[];
  taxCollections: TaxCollectionResult[];
  informationLags: Map<string, TerritoryInformationLag>;
  vitalsMutipliers: Map<string, number>;
}

/**
 * Stability Decay Sources
 * - Threat: Military presence from hostile factions (+0.5 per enemy territory adjacent)
 * - Insurgency: Low population loyalty (-0.1 to -0.5 based on oppressive taxation)
 * - Disruption: Regional hazards causing population suffering (-0.1 to -0.3 per hazard)
 * - Morale Loss: Citizens moving elsewhere during conflicts (-0.2 per tick if major conflict nearby)
 */
export class GeographyManager {
  /**
   * Processes all territories for a tick, calculating stability trends and tax collection.
   * Called during Phase 5 (Ripple & Paradox) to allow world changes to ripple through mechanics.
   */
  async processGeographyPhase(
    territories: Map<string, TerritoryNode>,
    factions: Map<string, ActiveFaction>,
    worldStability: number,
    currentTick: number
  ): Promise<GeographyPhaseResult> {
    const result: GeographyPhaseResult = {
      tickNumber: currentTick,
      territoryUpdates: [],
      taxCollections: [],
      informationLags: new Map(),
      vitalsMutipliers: new Map(),
    };

    // Process each territory
    for (const [territoryId, territory] of territories.entries()) {
      // Calculate stability trend
      const stabilityUpdate = this.calculateStabilityTrend(
        territory,
        territories,
        factions,
        worldStability,
        currentTick
      );

      // Update territory stability with trend
      const previousStability = territory.stability.current;
      territory.stability.current = Math.max(
        0,
        Math.min(100, previousStability + stabilityUpdate.trend)
      );

      // Update stability trend history
      // NOTE: Add trend history tracking to TerritoryNode.stability if needed
      // For now, we update current stability
      if (!territory.recentEvents) {
        territory.recentEvents = [];
      }
      territory.recentEvents.push({
        type: 'stability_update',
        description: `Stability: ${territory.stability.current.toFixed(1)} (${stabilityUpdate.sources.join('; ')})`,
        tick: currentTick,
      });

      // Prune old event history (keep last 100 events)
      if (territory.recentEvents.length > 100) {
        territory.recentEvents.shift();
      }

      // Calculate regional information lag (fog of war)
      const informationLag = this.calculateRegionalInformationLag(
        territory,
        territories,
        worldStability
      );
      territory.informationLag = informationLag;
      result.informationLags.set(territoryId, informationLag);

      // Calculate vitals multipliers based on regional hazards
      const vitalsMultiplier = this.getVitalsDecayModifiers(territory);
      result.vitalsMutipliers.set(territoryId, vitalsMultiplier);

      // Collect taxes every 600 ticks (15 mins) to reduce overhead
      let taxesClaimed = false;
      let taxRevenue = 0;

      if (currentTick % 600 === 0 && territory.controllingFactionId) {
        const taxResult = this.collectTaxes(territory);
        taxesClaimed = true;
        taxRevenue = taxResult.taxRevenue;

        // Award tax revenue to controlling faction
        const controlling = factions.get(territory.controllingFactionId);
        if (controlling && controlling.actionBudget) {
          controlling.actionBudget.currentPoints = Math.min(
            controlling.actionBudget.maxCapacity,
            controlling.actionBudget.currentPoints + Math.floor(taxRevenue)
          );
          controlling.actionBudget.lastRegenTick = currentTick;
        }

        result.taxCollections.push(taxResult);
      }

      result.territoryUpdates.push({
        territoryId,
        previousStability,
        newStability: territory.stability.current,
        stabilityTrend: stabilityUpdate.trend,
        threatLevel: stabilityUpdate.threatLevel,
        informationLag,
        taxesClaimed,
        taxRevenue,
      });
    }

    return result;
  }

  /**
   * Calculates stability trend for a territory.
   *
   * Base Recovery: +0.2/tick (natural healing)
   * Threat Decay: -0.5 per adjacent enemy-controlled territory
   * Insurgency Decay: -0.1 to -0.5 based on population willingness
   * Disruption Decay: -0.1 to -0.3 per regional hazard
   * Morale Loss: -0.2 per major conflict adjacent
   *
   * Result is clamped to [-1.0, +0.2] to ensure realistic friction.
   */
  private calculateStabilityTrend(
    territory: TerritoryNode,
    territories: Map<string, TerritoryNode>,
    factions: Map<string, ActiveFaction>,
    worldStability: number,
    currentTick: number
  ): { trend: number; threatLevel: number; sources: string[] } {
    const sources: string[] = [];
    let trend = 0.2; // Base recovery
    let threatLevel = 0;

    // 1. Threat Assessment: Enemy territories adjacent
    let adjacentEnemies = 0;
    for (const adjacentId of territory.connectedLocationIds) {
      const adjacent = territories.get(adjacentId);
      if (
        adjacent &&
        adjacent.controllingFactionId &&
        adjacent.controllingFactionId !== territory.controllingFactionId
      ) {
        adjacentEnemies++;
      }
    }

    if (adjacentEnemies > 0) {
      const threatDecay = adjacentEnemies * 0.5;
      trend -= threatDecay;
      threatLevel = adjacentEnemies;
      sources.push(`threat:${adjacentEnemies}_enemies:-${threatDecay}`);
    }

    // 2. Insurgency Assessment: Low population willingness
    const willingness = (territory.taxSystem?.willingness ?? 50) / 100;
    if (willingness < 0.5) {
      const insurgencyDecay = (0.5 - willingness) * 0.5; // Max -0.25
      trend -= insurgencyDecay;
      sources.push(`insurgency:-${insurgencyDecay.toFixed(2)}`);
    }

    // 3. Disruption from Regional Hazards
    const hazardDecay = this.calculateHazardDisruption(territory);
    if (hazardDecay > 0) {
      trend -= hazardDecay;
      sources.push(`hazards:-${hazardDecay.toFixed(2)}`);
    }

    // 4. Stability Multiplier (world state)
    // Lower world stability makes local stability harder to maintain
    if (worldStability < 50) {
      const worldMultiplier = (50 - worldStability) * 0.01; // -0.5 at world stability 0
      trend -= worldMultiplier;
      sources.push(`world_instability:-${worldMultiplier.toFixed(2)}`);
    }

    // Clamp trend to realistic range
    trend = Math.max(-1.0, Math.min(0.2, trend));

    return { trend, threatLevel, sources };
  }

  /**
   * Calculates information lag (fog of war) for a territory.
   * Composites environmental, political, and divine factors.
   *
   * Environmental Lag: Based on biome (mountains = +0.3, plains = -0.2)
   * Political Lag: Increases with conflict nearby (-0.1 to +0.5)
   * Divine Lag: Increases if deity is active in region (+0.1 to +0.3)
   * Stability Factor: Lower stability increases fog (uncertainty)
   */
  private calculateRegionalInformationLag(
    territory: TerritoryNode,
    territories: Map<string, TerritoryNode>,
    worldStability: number
  ): TerritoryInformationLag {
    let environmentalMod = 0;

    // Biome-based environmental lag
    switch (territory.biome) {
      case 'mountain':
        environmentalMod = 0.3;
        break;
      case 'forest':
        environmentalMod = 0.2;
        break;
      case 'desert':
        environmentalMod = 0.15;
        break;
      case 'swamp':
        environmentalMod = 0.25;
        break;
      case 'grassland':
        environmentalMod = -0.2;
        break;
      case 'urban':
        environmentalMod = -0.3;
        break;
      case 'coast':
        environmentalMod = 0.1;
        break;
      default:
        environmentalMod = 0;
    }

    // Political lag from adjacent conflicts
    let politicalMod = 0;
    let conflictCount = 0;
    for (const adjacentId of territory.connectedLocationIds) {
      const adjacent = territories.get(adjacentId);
      if (adjacent && adjacent.controllingFactionId !== territory.controllingFactionId) {
        conflictCount++;
      }
    }
    politicalMod = Math.min(0.5, conflictCount * 0.1);

    // Divine lag (assumed no deity presence without expanded deity state)
    const divineMod = 0;

    // Stability factor: Lower stability = higher fog (more uncertainty)
    const stabilityFactor = 1 + (100 - territory.stability.current) * 0.001;

    const baseMultiplier = 0.25; // 25% base fog of war
    const compositeFog =
      baseMultiplier *
      (1 + environmentalMod + politicalMod + divineMod) *
      stabilityFactor;

    return {
      baseMultiplier,
      environmentalModifier: environmentalMod,
      politicalModifier: politicalMod,
      divineModifier: divineMod,
      composite: Math.min(0.9, compositeFog),
      hiddenLocations: [],
    };
  }

  /**
   * Collects taxes from a territory.
   * Formula: Revenue = (Population × 5) × (Stability / 100) × TaxRate × (Willingness / 100)
   *
   * This is called during Phase 5 only during tax collection ticks (600 tick interval).
   */
  private collectTaxes(territory: TerritoryNode): TaxCollectionResult {
    const baseRevenue = territory.population * 5;
    const stabilityModifier = territory.stability.current / 100;
    const rateModifier = territory.taxSystem?.rate ?? 0.1;
    const willingnessModifier = (territory.taxSystem?.willingness ?? 50) / 100;

    const taxRevenue = baseRevenue * stabilityModifier * rateModifier * willingnessModifier;

    // NOTE: Tax history tracking would be added to TaxSystem interface if needed
    // For now, we just calc and return the revenue

    return {
      territoryId: territory.id,
      controllingFactionId: territory.controllingFactionId || null,
      taxRevenue,
      populationWillingness: territory.taxSystem?.willingness ?? 50,
      stabilityModifier: territory.stability.current,
    };
  }

  /**
   * Calculates vitals decay multipliers based on regional hazards.
   * Each hazard type affects specific vitals with decay modifiers.
   *
   * Example: Desert hazard might apply 1.2x to Thirst, 1.1x to Exhaustion
   */
  private getVitalsDecayModifiers(territory: TerritoryNode): number {
    let totalMultiplier = 1.0;

    for (const hazard of territory.hazards) {
      // Apply decay multiplier based on hazard type
      switch (hazard.type) {
        case 'climate':
          // Harsh climate affects Thirst and Exhaustion
          totalMultiplier *= Math.max(1.0, 1.0 + hazard.vigorDecayMultiplier);
          break;
        case 'disease':
          // Disease affects Health and Nourishment
          totalMultiplier *= Math.max(1.0, 1.0 + hazard.nourishmentDecayMultiplier);
          break;
        case 'radiation':
          // Radiation affects Health and Sanity
          totalMultiplier *= Math.max(1.0, 1.0 + hazard.sanityDecayMultiplier);
          break;
        case 'magic':
          // Magic affects Sanity and Vigor
          totalMultiplier *= Math.max(1.0, 1.0 + hazard.sanityDecayMultiplier);
          break;
        case 'political':
          // Political unrest affects Morale (Vigor/Sanity)
          totalMultiplier *= Math.max(1.0, 1.0 + hazard.vigorDecayMultiplier);
          break;
      }
    }

    // Cap multiplier at 2.0x to prevent extreme decay
    return Math.min(2.0, totalMultiplier);
  }

  /**
   * Calculates total hazard disruption to stability.
   * Each hazard contributes to insurgency and morale loss.
   */
  private calculateHazardDisruption(territory: TerritoryNode): number {
    let disruption = 0;

    for (const hazard of territory.hazards) {
      // Each hazard contributes -0.1 base
      disruption += 0.1;

      // Hazard type intensity increases disruption
      // Use canAdapt to determine baseline severity
      disruption += (hazard.canAdapt ? 0.05 : 0.15);
    }

    // Cap at -0.5 (total hazard disruption should not exceed 50% of stability recovery)
    return Math.min(0.5, disruption);
  }

  /**
   * Gets information lag for FrictionManager integration.
   * This allows FrictionManager to apply regional fog to perception.
   */
  public getInformationLag(territory: TerritoryNode): TerritoryInformationLag {
    return territory.informationLag;
  }

  /**
   * Gets vitals decay multipliers for FrictionManager integration.
   * Used to apply regional hazards to vitals decay.
   */
  public getVitalsMultipliers(
    territories: Map<string, TerritoryNode>
  ): Map<string, number> {
    const multipliers = new Map<string, number>();

    for (const [territoryId, territory] of territories.entries()) {
      multipliers.set(territoryId, this.getVitalsDecayModifiers(territory));
    }

    return multipliers;
  }

  /**
   * Gets control threshold for a territory.
   * Base: 60 influence points
   * Penalty: (100 - Stability) × 0.1
   * Result: Harder to capture unstable territories
   */
  public getControlThreshold(territory: TerritoryNode): number {
    const baseThreshold = 60;
    const stabilityPenalty = (100 - territory.stability.current) * 0.1;
    const threshold = baseThreshold + stabilityPenalty;

    // Clamp between 30 and 90
    return Math.max(30, Math.min(90, threshold));
  }

  /**
   * Updates territory population based on stability and conditions.
   * Stable territories grow slightly, unstable ones lose population to migration.
   */
  public updatePopulation(
    territory: TerritoryNode,
    ticksElapsed: number = 1
  ): number {
    // Base growth rate: 0.1% per tick at 100% stability
    const stabilityFactor = territory.stability.current / 100;
    const willingnessMultiplier = (territory.taxSystem?.willingness ?? 50) / 100;

    // Growth can be negative (population decline) if stability is low
    const growthRate = (stabilityFactor * willingnessMultiplier - 0.5) * 0.001;
    const newPopulation = Math.max(10, territory.population * (1 + growthRate * ticksElapsed));

    territory.population = newPopulation;
    return newPopulation;
  }
}

export default GeographyManager;

// NOTE: The following would be useful additions to TerritoryNode interface:
// - trendHistory: Array of {tick, stability, sources} for trend visualization
// - taxCollectionHistory: Tracked in TaxSystem for revenue analysis
// These would enable better historical tracking and UI visualization
