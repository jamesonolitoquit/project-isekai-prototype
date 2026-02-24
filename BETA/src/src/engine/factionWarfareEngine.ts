/**
 * M44-T2: factionWarfareEngine.ts - Dynamic Territory Control
 * M44-E4: Chronicles integration for historical siege events
 * 
 * Manages faction influence over locations with deterministic skirmishes
 * during Chrono-Action leaps. Uses seeded RNG for reproducibility.
 */

import { getHistoricalEventRecorder, type HistoricalEvent } from './chronicleEngine';

export interface Faction {
  id: string;
  name: string;
  baseStrength: number; // 0-1, global faction power level
  color: string; // for UI
}

export interface LocationInfluence {
  locationId: string;
  factionInfluenceMap: Map<string, number>; // factionId -> influence (0-1)
  dominantFactionId: string | null;
  lastSkirmishTick: number;
}

export interface SkirmishEvent {
  tick: number;
  locationId: string;
  aggressor: string; // factionId
  defender: string; // factionId
  outcome: "aggressor_wins" | "defender_holds" | "stalemate";
  influenceShift: number; // how much influence changed
  casualties: number; // approximate NPC casualty count (worldbuilding flavor)
}

export interface WarZoneStatus {
  locationId: string;
  currentDominant: string;
  previousDominant: string | null;
  contentionLevel: number; // 0-1, how contested is this location
  recentSkirmishes: SkirmishEvent[];
}

class FactionWarfareEngine {
  private locationInfluences: Map<string, LocationInfluence> = new Map();
  private factionRegistry: Map<string, Faction> = new Map();
  private skirmishHistory: SkirmishEvent[] = [];
  private seededRng: any; // Will be set via injection

  constructor(initialFactions: Faction[] = []) {
    for (const faction of initialFactions) {
      this.registerFaction(faction);
    }
  }

  /**
   * Set the seeded RNG for deterministic warfare
   */
  setSeededRng(rng: any): void {
    this.seededRng = rng;
  }

  /**
   * Sync complete engine state from world state influences
   */
  syncWithState(worldState: any): void {
    if (!worldState || !worldState.locationInfluences) return;

    for (const locationId of Object.keys(worldState.locationInfluences)) {
      this.getOrCreateLocationInfluence(locationId, worldState);
    }
  }

  /**
   * Register a faction into the warfare system
   */
  registerFaction(faction: Faction): void {
    this.factionRegistry.set(faction.id, faction);
  }

  /**
   * Get or create location influence state, optionally syncing from world state
   */
  getOrCreateLocationInfluence(locationId: string, worldState?: any): LocationInfluence {
    // If we have world state with influence data, use it to populate our internal map
    if (worldState && worldState.locationInfluences && worldState.locationInfluences[locationId]) {
      const stateData = worldState.locationInfluences[locationId];
      const influenceMap = new Map<string, number>();
      let dominantId = null;
      let maxInf = -1;

      for (const [factionId, influence] of Object.entries(stateData)) {
        const infValue = influence as number;
        influenceMap.set(factionId, infValue);
        if (infValue > maxInf) {
          maxInf = infValue;
          dominantId = factionId;
        }
      }

      const influence: LocationInfluence = {
        locationId,
        factionInfluenceMap: influenceMap,
        dominantFactionId: dominantId,
        lastSkirmishTick: worldState.tick || 0,
      };
      
      this.locationInfluences.set(locationId, influence);
      return influence;
    }

    if (!this.locationInfluences.has(locationId)) {
      const influenceMap = new Map<string, number>();
      // Initialize all factions with equal influence if no registry, otherwise use registry
      const factions = Array.from(this.factionRegistry.keys());
      const baseInfluence = factions.length > 0 ? 1.0 / factions.length : 0.5;
      
      for (const factionId of factions) {
        influenceMap.set(factionId, baseInfluence);
      }

      this.locationInfluences.set(locationId, {
        locationId,
        factionInfluenceMap: influenceMap,
        dominantFactionId: factions.length > 0 ? factions[0] : null,
        lastSkirmishTick: 0,
      });
    }
    return this.locationInfluences.get(locationId)!;
  }

  /**
   * Simulate a skirmish at a location (called during Chrono-Action leap)
   */
  simulateSkirmish(
    locationId: string,
    tick: number,
    seed: number
  ): SkirmishEvent | null {
    if (!this.seededRng) {
      console.warn("[FactionWarfareEngine] No RNG set, skipping skirmish");
      return null;
    }

    const influence = this.getOrCreateLocationInfluence(locationId);

    // If no change in many ticks, skip skirmish
    if (tick - influence.lastSkirmishTick < 100) {
      return null;
    }

    // Determine aggressor (strongest challenger to dominant faction)
    const dominant = influence.dominantFactionId;
    if (!dominant) return null;

    let challenger: string | null = null;
    let maxChallenge = 0;

    for (const [factionId, inf] of influence.factionInfluenceMap.entries()) {
      if (factionId !== dominant && inf > maxChallenge) {
        challenger = factionId;
        maxChallenge = inf;
      }
    }

    if (!challenger) return null;

    // Use seeded RNG to determine outcome
    const battleSeed = seed + tick + locationId.charCodeAt(0);
    const rngValue = this.seededRng.next(battleSeed) % 100;

    const dominantStrength = (this.factionRegistry.get(dominant)?.baseStrength || 0.5) * 100;
    const challengerStrength = (this.factionRegistry.get(challenger)?.baseStrength || 0.5) * 100;

    let outcome: SkirmishEvent["outcome"];
    let influenceShift = 0;
    const baseShift = 0.1;

    if (rngValue < challengerStrength && rngValue >= dominantStrength) {
      // Aggressor wins
      outcome = "aggressor_wins";
      influenceShift = baseShift;
    } else if (rngValue < dominantStrength) {
      // Defender holds
      outcome = "defender_holds";
      influenceShift = -baseShift * 0.5; // slight decay for challenger
    } else {
      // Stalemate
      outcome = "stalemate";
      influenceShift = 0;
    }

    // Apply influence shift
    const dominantCurrent = influence.factionInfluenceMap.get(dominant) || 0;
    const challengerCurrent = influence.factionInfluenceMap.get(challenger) || 0;

    if (outcome === "aggressor_wins") {
      influence.factionInfluenceMap.set(
        challenger,
        Math.min(1.0, challengerCurrent + influenceShift)
      );
      influence.factionInfluenceMap.set(
        dominant,
        Math.max(0, dominantCurrent - influenceShift)
      );
    } else if (outcome === "defender_holds") {
      influence.factionInfluenceMap.set(
        challenger,
        Math.max(0, challengerCurrent - Math.abs(influenceShift))
      );
    }

    // Update dominant if shift is large enough
    const newMax = Math.max(
      ...Array.from(influence.factionInfluenceMap.values())
    );
    for (const [factionId, inf] of influence.factionInfluenceMap.entries()) {
      if (inf === newMax) {
        const previousDominant = influence.dominantFactionId;
        influence.dominantFactionId = factionId;
        break;
      }
    }

    influence.lastSkirmishTick = tick;

    const skirmish: SkirmishEvent = {
      tick,
      locationId,
      aggressor: challenger,
      defender: dominant,
      outcome,
      influenceShift: outcome === "aggressor_wins" ? influenceShift : -Math.abs(influenceShift),
      casualties: Math.floor(this.seededRng.next(seed + tick) % 50) + 5, // 5-55 casual deaths
    };

    this.skirmishHistory.push(skirmish);

    // M44-E4: Record to chronicle if significant outcome
    if (outcome === "aggressor_wins" && influenceShift > 0.2) {
      const eventRecorder = getHistoricalEventRecorder();
      const historicalEvent: HistoricalEvent = {
        id: `siege_${tick}_${locationId}`,
        type: 'faction_siege',
        epochId: 'current',
        tick,
        locationId,
        description: `Faction Siege at ${locationId}`,
        factionIds: [challenger, dominant],
        severity: Math.min(100, Math.floor(Math.abs(influenceShift) * 100)),
        narrative: `The ${challenger} laid siege to ${locationId}, held by the ${dominant}. After fierce fighting, the attackers prevailed.`,
        monumentName: `Ruins of the ${dominant} Defense at ${locationId}`,
        monumentType: 'ruin'
      };
      
      eventRecorder.recordHistoricalEvent(historicalEvent);
      eventRecorder.createWorldFragmentFromEvent(historicalEvent);
    }

    return skirmish;
  }

  /**
   * Process skirmishes during a Chrono-Action leap
   * Called from actionPipeline when REST/WAIT advances time
   */
  processChronoActionSkirmishes(
    worldLocations: string[],
    tickAdvance: number,
    currentTick: number,
    worldSeed: number
  ): SkirmishEvent[] {
    const events: SkirmishEvent[] = [];

    // Simulate skirmishes probabilistically based on time advance
    const skirmishChance = Math.min(1.0, tickAdvance / 1000); // more ticks = higher chance

    for (const locationId of worldLocations) {
      if (this.seededRng.next(worldSeed + currentTick + locationId.length) < skirmishChance * 100) {
        const event = this.simulateSkirmish(locationId, currentTick + tickAdvance, worldSeed);
        if (event) {
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Get current war zone status for a location
   */
  getWarZoneStatus(locationId: string): WarZoneStatus {
    const influence = this.getOrCreateLocationInfluence(locationId);

    // Calculate contention level (how close are top 2 factions)
    const sortedInfluence = Array.from(influence.factionInfluenceMap.values()).sort(
      (a, b) => b - a
    );
    const contentionLevel =
      sortedInfluence.length > 1 ? Math.abs(sortedInfluence[0] - sortedInfluence[1]) : 0;

    // Get recent skirmishes at this location
    const recentSkirmishes = this.skirmishHistory
      .filter((s) => s.locationId === locationId)
      .slice(-5);

    return {
      locationId,
      currentDominant: influence.dominantFactionId || "None",
      previousDominant: recentSkirmishes.length > 0 ? recentSkirmishes[0].defender : null,
      contentionLevel: Math.max(0, 1 - contentionLevel),
      recentSkirmishes,
    };
  }

  /**
   * Enforce influence caps (no faction can reach 100% without Director Macro Event)
   */
  enforceInfluenceCaps(locationId: string, maxInfluence: number = 0.85): void {
    const influence = this.getOrCreateLocationInfluence(locationId);

    for (const [factionId, inf] of influence.factionInfluenceMap.entries()) {
      if (inf > maxInfluence) {
        const excess = inf - maxInfluence;
        influence.factionInfluenceMap.set(factionId, maxInfluence);

        // Redistribute excess to other factions
        const others = Array.from(influence.factionInfluenceMap.entries()).filter(
          ([id]) => id !== factionId
        );
        for (const [otherId] of others) {
          const share = otherId === others[0]?.[0] ? excess : 0; // give all to strongest competitor
          influence.factionInfluenceMap.set(
            otherId,
            Math.min(maxInfluence, (influence.factionInfluenceMap.get(otherId) || 0) + share)
          );
        }
      }
    }
  }

  /**
   * Get all location influence states
   */
  getAllInfluenceStates(): LocationInfluence[] {
    return Array.from(this.locationInfluences.values());
  }

  /**
   * Get influence for specific faction at location
   */
  getFactionInfluence(locationId: string, factionId: string): number {
    return this.getOrCreateLocationInfluence(locationId).factionInfluenceMap.get(factionId) || 0;
  }

  /**
   * Export faction warfare state for serialization
   */
  exportWarfareState(): object {
    return {
      locationCount: this.locationInfluences.size,
      factionCount: this.factionRegistry.size,
      skirmishCount: this.skirmishHistory.length,
      locations: Array.from(this.locationInfluences.values()).map((loc) => ({
        locationId: loc.locationId,
        dominant: loc.dominantFactionId,
        influenceSnapshot: Object.fromEntries(loc.factionInfluenceMap),
      })),
      recentSkirmishes: this.skirmishHistory.slice(-10).map((s) => ({
        tick: s.tick,
        location: s.locationId,
        outcome: s.outcome,
        shift: s.influenceShift,
      })),
    };
  }

  /**
   * Clear all warfare state (for testing)
   */
  clearState(): void {
    this.locationInfluences.clear();
    this.skirmishHistory = [];
  }
}

// Singleton instance
let instance: FactionWarfareEngine | null = null;

export function getFactionWarfareEngine(initialFactions?: Faction[]): FactionWarfareEngine {
  if (!instance) {
    if (initialFactions && initialFactions.length > 0) {
      instance = new FactionWarfareEngine(initialFactions);
    } else {
      // Fallback defaults if no template provided
      instance = new FactionWarfareEngine([
        { id: "silver-flame", name: "Silver Flame", baseStrength: 0.6, color: "#FFD700" },
        { id: "shadow-conclave", name: "Shadow Conclave", baseStrength: 0.5, color: "#1a1a2e" },
      ]);
    }
  }
  return instance;
}
