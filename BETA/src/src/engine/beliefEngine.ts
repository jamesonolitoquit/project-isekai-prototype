/**
 * M45-A1: Belief Engine
 * 
 * Purpose: Manage the separation of "Hard Facts" (events that occurred) from
 * "Rumors" (distorted/noisy versions of facts that NPCs share).
 * 
 * Core Philosophy:
 * - When an event occurs (e.g., "King is dead"), it is stored as a Hard Fact
 * - The further someone is from the event (geographically or factionally), 
 *   the more noise/randomization is added to the data they share
 * - Rumors spread through regions based on NPC gossip chains
 * - Belief confidence degrades with time and distance
 * - Phase 25: Uses centralized NarrativeTypes for strict type safety
 */

import type { WorldState } from './worldEngine';
import type { HardFact, Rumor, PerceptionLevel } from './narrativeTypes';
import { SeededRng } from './prng';

// Re-export types for backward compatibility
export type { HardFact, Rumor, PerceptionLevel } from './narrativeTypes';

/**
 * Belief Registry: Central store for all facts and rumors
 */
export interface BeliefRegistry {
  hardFacts: Record<string, HardFact>;
  rumors: Record<string, Rumor>;
  perceptionLevels: Record<string, PerceptionLevel>;
  
  // Tracking: Which NPCs have spread which rumors
  npcRumorDistribution: Record<string, string[]>; // NPC ID -> Rumor IDs they know
}

class BeliefEngineImpl {
  private registry: BeliefRegistry = {
    hardFacts: {},
    rumors: {},
    perceptionLevels: {},
    npcRumorDistribution: {}
  };

  private rng = new SeededRng(12345); // For consistent noise generation

  /**
   * Record a hard fact about a world event
   * This is called whenever a major event occurs (faction siege, NPC death, etc.)
   */
  recordHardFact(fact: HardFact): void {
    this.registry.hardFacts[fact.id] = fact;
    
    // Automatically create regional rumors from this fact
    this.propagateFactAsRumor(fact);
  }

  /**
   * When a hard fact occurs, it spreads outward as rumors
   * Distant regions get more noise
   */
  private propagateFactAsRumor(fact: HardFact): void {
    // Create rumors in concentric rings around the origin
    // Inner ring: ~80% accurate
    // Middle ring: ~40% accurate
    // Outer ring: ~10% accurate (almost unrecognizable)
    
    const innerRingDistance = fact.truthRadius * 0.5;
    const middleRingDistance = fact.truthRadius * 1.5;
    
    const rumors: Rumor[] = [
      // Inner ring rumor (high confidence)
      {
        id: `${fact.id}_inner`,
        originalFactId: fact.id,
        description: this.addNoiseToDescription(fact.description, 0.2),
        claimedLocationId: fact.originLocationId,
        claimedFactionIds: [...fact.factionIds],
        confidenceLevel: 80,
        distanceFromOrigin: innerRingDistance,
        factionRelevance: 0.9,
        createdAt: fact.timestamp,
        spreadsToLocations: [],
        sourceNpcIds: []
      },
      // Middle ring rumor (moderate confidence)
      {
        id: `${fact.id}_middle`,
        originalFactId: fact.id,
        description: this.addNoiseToDescription(fact.description, 0.5),
        claimedLocationId: this.distortLocation(fact.originLocationId, middleRingDistance),
        claimedFactionIds: this.distortFactionList(fact.factionIds),
        confidenceLevel: 40,
        distanceFromOrigin: middleRingDistance,
        factionRelevance: 0.5,
        createdAt: fact.timestamp,
        spreadsToLocations: [],
        sourceNpcIds: []
      },
      // Outer ring rumor (low confidence)
      {
        id: `${fact.id}_outer`,
        originalFactId: fact.id,
        description: this.addNoiseToDescription(fact.description, 0.8),
        claimedLocationId: this.distortLocation(fact.originLocationId, middleRingDistance * 2),
        claimedFactionIds: this.distortFactionList(fact.factionIds, 0.7),
        confidenceLevel: 10,
        distanceFromOrigin: middleRingDistance * 2,
        factionRelevance: 0.2,
        createdAt: fact.timestamp,
        spreadsToLocations: [],
        sourceNpcIds: []
      }
    ];

    rumors.forEach(rumor => {
      this.registry.rumors[rumor.id] = rumor;
    });
  }

  /**
   * Add noise to a description string
   * noiseLevel: 0 (no noise) to 1 (complete nonsense)
   */
  private addNoiseToDescription(description: string, noiseLevel: number): string {
    if (noiseLevel === 0) return description;
    
    const words = description.split(' ');
    const noisyWords = words.map(word => {
      if (Math.random() < noiseLevel) {
        // 30% chance to replace, 30% to scramble, 40% to keep
        const choice = Math.random();
        if (choice < 0.3) {
          // Replace with generic term
          return ['something', 'someone', 'somewhere', 'happened', 'allegedly'][
            Math.floor(Math.random() * 5)
          ];
        } else if (choice < 0.6) {
          // Scramble the word
          return word.split('').sort(() => Math.random() - 0.5).join('');
        }
      }
      return word;
    });

    return noisyWords.join(' ');
  }

  /**
   * Distort a location ID - place it somewhere nearby but wrong
   */
  private distortLocation(locationId: string, distanceKm: number): string {
    // For now, return the location with a "?" prefix to indicate uncertainty
    // In full implementation, would calculate nearby locations and pick one
    return `${locationId}?`;
  }

  /**
   * Distort a faction list - may add wrong factions or remove real ones
   * noiseLevel: 0-1, how much distortion to apply
   */
  private distortFactionList(factionIds: string[], noiseLevel: number = 0.5): string[] {
    const distorted = [...factionIds];
    
    // Randomly remove some factions if noiseLevel is high
    if (Math.random() < noiseLevel && distorted.length > 0) {
      distorted.splice(Math.floor(Math.random() * distorted.length), 1);
    }

    // Randomly add a wrong faction
    if (Math.random() < noiseLevel) {
      const possibleFactions = ['House Silver', 'Shadow Council', 'Holy Order', 'Merchant Guild'];
      const wrongFaction = possibleFactions[Math.floor(Math.random() * possibleFactions.length)];
      if (!distorted.includes(wrongFaction)) {
        distorted.push(wrongFaction);
      }
    }

    return distorted;
  }

  /**
   * Get all rumors that would be known in a specific location
   * Filters based on distance and faction
   */
  getRumorsAtLocation(
    locationId: string,
    playerFactionId: string,
    playerPerceptionLevel: number
  ): Rumor[] {
    return Object.values(this.registry.rumors).filter(rumor => {
      // Perception level affects which rumors you can access
      // Higher perception = can detect more rumors even if geographically far
      const perceptionBonus = playerPerceptionLevel * 0.5; // Perception helps access rumors
      
      // Filter by distance and faction relevance
      const effectiveConfidence = rumor.confidenceLevel + perceptionBonus;
      
      // Only return rumors with meaningful confidence
      if (effectiveConfidence < 20) {
        return false;
      }

      // Faction relevance: your faction hears rumors about enemies/rivals quicker
      if (rumor.factionRelevance > 0.7 && rumor.claimedFactionIds.includes(playerFactionId)) {
        return true;
      }

      // Higher perception = hear distant rumors
      if (playerPerceptionLevel > 50) {
        return true;
      }

      // Default: return if reasonably confident
      return effectiveConfidence > 50;
    });
  }

  /**
   * Get the hard fact behind a rumor
   * Returns null if already at hard fact
   */
  getOriginalFact(rumorId: string): HardFact | null {
    const rumor = this.registry.rumors[rumorId];
    if (!rumor) return null;
    return this.registry.hardFacts[rumor.originalFactId] || null;
  }

  /**
   * Get a rumor by its ID
   */
  getRumorById(rumorId: string): Rumor | null {
    return this.registry.rumors[rumorId] || null;
  }

  /**
   * Calculate perception level for a player
   * Based on faction rank, magical knowledge, research, etc.
   */
  calculatePerceptionLevel(
    playerId: string,
    state: WorldState,
    playerFactionRank: number = 0
  ): PerceptionLevel {
    const player = state.player;
    if (!player) {
      return {
        playerId,
        level: 0,
        sources: {
          factionRank: 0,
          secretsKnowledge: 0,
          mysticalAwareness: 0,
          historicalStudy: 0
        }
      };
    }

    // Calculate perception from different sources
    const factionRankBonus = Math.min(30, playerFactionRank * 5); // Max 30 from faction
    const secretsKnowledge = Object.values(player.quests || {}).filter(q => q.status === 'completed').length * 2; // 2 points per quest
    const mysticalAwareness = (player.mp || 0) > 50 ? 20 : 0; // Mages see more
    const historicalStudy = Math.min(20, (player.level || 1) * 2); // Level gives knowledge

    const totalLevel = Math.min(
      100,
      factionRankBonus + secretsKnowledge + mysticalAwareness + historicalStudy
    );

    const perceptionLevel: PerceptionLevel = {
      playerId,
      level: totalLevel,
      sources: {
        factionRank: factionRankBonus,
        secretsKnowledge: Math.min(40, secretsKnowledge),
        mysticalAwareness: mysticalAwareness,
        historicalStudy: historicalStudy
      }
    };

    this.registry.perceptionLevels[playerId] = perceptionLevel;
    return perceptionLevel;
  }

  /**
   * Verify if a player has the perception level needed to know a fact
   */
  canAccessFact(playerId: string, factId: string, playerPerceptionLevel: number): boolean {
    const fact = this.registry.hardFacts[factId];
    if (!fact) return false;

    // Facts have different perception requirements based on severity
    // High severity facts require higher perception to know
    const requiredPerception = (fact.severity / 100) * 80; // Severity 100 = perception 80 needed

    return playerPerceptionLevel >= requiredPerception;
  }

  /**
   * Get belief registry state (for debugging/inspection)
   */
  getRegistry(): BeliefRegistry {
    return this.registry;
  }

  /**
   * Reset beliefs for a new epoch
   */
  clearForNewEpoch(): void {
    this.registry = {
      hardFacts: {},
      rumors: {},
      perceptionLevels: {},
      npcRumorDistribution: {}
    };
  }

  /**
   * Get rumors that an NPC would know
   * NPCs in the same location spread rumors faster
   */
  getNpcRumorsForLocation(
    locationId: string,
    npcFactionId: string
  ): Rumor[] {
    return Object.values(this.registry.rumors).filter(rumor => {
      // NPCs heard rumors that spread to their location
      if (rumor.spreadsToLocations.includes(locationId)) {
        return true;
      }

      // Faction-aligned NPCs hear rumors about their rivals quickly
      const isAlignedFaction = rumor.claimedFactionIds.includes(npcFactionId);
      if (isAlignedFaction && rumor.confidenceLevel > 40) {
        return true;
      }

      return false;
    });
  }

  /**
   * Update an NPC's knowledge of rumors
   * Track which NPCs know about which rumors for consistent dialogue
   */
  addNpcRumorKnowledge(npcId: string, rumorId: string): void {
    if (!this.registry.npcRumorDistribution[npcId]) {
      this.registry.npcRumorDistribution[npcId] = [];
    }
    if (!this.registry.npcRumorDistribution[npcId].includes(rumorId)) {
      this.registry.npcRumorDistribution[npcId].push(rumorId);
    }
  }

  /**
   * Get rumor confidence with distance falloff
   * Returns lower confidence the further away from origin
   */
  getRumorConfidenceAtLocation(
    rumorId: string,
    npcLocationId: string,
    originLocationId: string,
    distanceKm: number
  ): number {
    const rumor = this.registry.rumors[rumorId];
    if (!rumor) return 0;

    // Base confidence
    let confidence = rumor.confidenceLevel;

    // Apply distance decay
    const decayFactor = Math.pow(0.95, distanceKm / 10); // 5% decay per 10km
    confidence *= decayFactor;

    // Apply location-based bonus/penalty
    if (npcLocationId === originLocationId) {
      confidence *= 1.5; // Double confidence at source location
    } else if (npcLocationId === rumor.claimedLocationId) {
      confidence *= 1.2; // Slight bonus if at claimed location
    }

    return Math.max(0, Math.min(100, confidence));
  }
}

// Singleton instance
let instance: BeliefEngineImpl | null = null;

export function getBeliefEngine(): BeliefEngineImpl {
  if (!instance) {
    instance = new BeliefEngineImpl();
  }
  return instance;
}

/**
 * Export specific methods for convenience
 */
export const beliefEngine = {
  recordHardFact: (fact: HardFact) => getBeliefEngine().recordHardFact(fact),
  getRumorsAtLocation: (locationId: string, factionId: string, perceptionLevel: number) =>
    getBeliefEngine().getRumorsAtLocation(locationId, factionId, perceptionLevel),
  getOriginalFact: (rumorId: string) => getBeliefEngine().getOriginalFact(rumorId),
  getRumorById: (rumorId: string) => getBeliefEngine().getRumorById(rumorId),
  calculatePerceptionLevel: (playerId: string, state: WorldState, factionRank?: number) =>
    getBeliefEngine().calculatePerceptionLevel(playerId, state, factionRank),
  canAccessFact: (playerId: string, factId: string, perceptionLevel: number) =>
    getBeliefEngine().canAccessFact(playerId, factId, perceptionLevel),
  clearForNewEpoch: () => getBeliefEngine().clearForNewEpoch(),
  getNpcRumorsForLocation: (locationId: string, npcFactionId: string) =>
    getBeliefEngine().getNpcRumorsForLocation(locationId, npcFactionId),
  addNpcRumorKnowledge: (npcId: string, rumorId: string) =>
    getBeliefEngine().addNpcRumorKnowledge(npcId, rumorId),
  getRumorConfidenceAtLocation: (rumorId: string, npcLoc: string, originLoc: string, distance: number) =>
    getBeliefEngine().getRumorConfidenceAtLocation(rumorId, npcLoc, originLoc, distance)
};
