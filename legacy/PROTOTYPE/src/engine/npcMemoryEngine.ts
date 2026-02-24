/**
 * M44-T1/C1: npcMemoryEngine.ts - Universal Long-Term Memory & Relationships
 * 
 * M44-A: Stores and manages NPC memories of player interactions with sentiment/impact scores.
 * M44-C1: Extended to support NPC-to-NPC relationships with explicit tiering.
 * 
 * Key Concepts:
 * - Unified Entity Interaction: Both players and NPCs can be subjects of memories
 * - Relationship Tiering: Ally/Neutral/Rival/Enemy states trigger unique AI behaviors
 * - NPC Gossip Propagation: Social scars spread through networks deterministically
 * - Sealed Memories: Part of Iron Canon for permanence
 * - Phase 25: Global Social Tension (GST) calculation for world-wide emotional state
 */

import type { MemoryData } from './worldEngine';
import type {
  UniversalInteraction,
  SocialScar,
  RelationshipTierData,
  NarrativeState,
  HistoricalRecord
} from './narrativeTypes';

export type RelationshipTier = 'Ally' | 'Neutral' | 'Rival' | 'Enemy';

// Re-export from narrativeTypes for backward compatibility
export type { UniversalInteraction, SocialScar, RelationshipTierData, NarrativeState } from './narrativeTypes';

// Maintain backward compatibility
export type PlayerInteraction = UniversalInteraction;

export interface NpcMemoryProfile {
  npcId: string;
  interactions: Map<string, UniversalInteraction>; // key: interaction ID (timestamp-subjectId-action)
  socialScars: Map<string, SocialScar>; // key: scarId (npcId-type-subjectId)
  relationshipTiers: Map<string, RelationshipTierData>; // M44-C1: Explicit relationship tiers by subject
  npcAllies: Set<string>; // M44-C1: Cached NPC ally IDs
  npcRivals: Set<string>; // M44-C1: Cached NPC rival IDs
  maxMemories: number; // cap before oldest memories are pruned
  sealed: boolean; // if true, memories locked as Iron Canon
  sealedAt?: number;
  historicalRecords: Map<string, HistoricalRecord>; // Phase 28 Task 2: Sealed memories for legacy
}

export interface MemoryImpactOnDialogue {
  sentiment: number; // net sentiment across all interactions
  scarInfluence: number; // 0-1, how strongly scars affect choices
  trustLevel: number; // 0-1, probability of cooperation options
  cautionLevel: number; // 0-1, probability of evasive/defensive options
}

class NpcMemoryEngine {
  private memoryProfiles: Map<string, NpcMemoryProfile> = new Map();
  private readonly MEMORY_CAP = 50; // max interactions per NPC before pruning
  private readonly SCAR_THRESHOLD = 0.6; // sentiment threshold to form a scar
  private readonly SCAR_DECAY_RATE = 0.001; // per tick, for non-reinforced scars

  /**
   * Sync memory from world state (useful during event-sourcing re-processing)
   */
  syncWithState(state: { npcMemories?: Record<string, MemoryData> }): void {
    if (!state || !state.npcMemories) return;

    for (const [npcId, memoryData] of Object.entries(state.npcMemories)) {
      const data = memoryData;
      const profile = this.getOrCreateMemoryProfile(npcId);

      // Re-populate interaction map
      if (Array.isArray(data.memories)) {
        for (const inter of data.memories) {
          const id = `${inter.timestamp}-${inter.id}-${inter.type}`;
          profile.interactions.set(id, inter as UniversalInteraction);
        }
      }

      // Re-populate social scars
      if (Array.isArray(data.socialScars)) {
        for (const scar of data.socialScars) {
          const id = `${npcId}-${scar.type}-${scar.subjectId}`;
          profile.socialScars.set(id, scar as SocialScar);
        }
      }
    }
  }

  /**
   * Initialize or retrieve an NPC's memory profile
   */
  getOrCreateMemoryProfile(npcId: string): NpcMemoryProfile {
    if (!this.memoryProfiles.has(npcId)) {
      this.memoryProfiles.set(npcId, {
        npcId,
        interactions: new Map(),
        socialScars: new Map(),
        relationshipTiers: new Map(), // M44-C1
        npcAllies: new Set(), // M44-C1
        npcRivals: new Set(), // M44-C1
        maxMemories: this.MEMORY_CAP,
        sealed: false,
        historicalRecords: new Map(), // Phase 28 Task 2
      });
    }
    return this.memoryProfiles.get(npcId)!;
  }

  /**
   * Record an interaction (universal: player or NPC subject)
   * M44-C1: Enhanced to support NPC-to-NPC relationships
   */
  recordInteraction(
    observerNpcId: string,
    subjectId: string,
    subjectType: 'player' | 'npc',
    action: string,
    sentiment: number, // -1.0 to +1.0
    impact: number, // 0.0 to 1.0
    description: string,
    tick: number
  ): string {
    const profile = this.getOrCreateMemoryProfile(observerNpcId);

    if (profile.sealed) {
      console.warn(`[NpcMemoryEngine] Cannot add interaction to sealed NPC ${observerNpcId}`);
      return "";
    }

    const interactionId = `${tick}-${subjectId}-${action}`;
    const interaction: UniversalInteraction = {
      timestamp: tick,
      observerNpcId,
      subjectId,
      subjectType,
      action,
      sentiment: Math.max(-1, Math.min(1, sentiment)),
      impactScore: Math.max(0, Math.min(1, impact)),
      description,
      propagated: false,
    };

    profile.interactions.set(interactionId, interaction);

    // Check if this creates or reinforces a scar and a relationship tier
    this.updateSocialScars(observerNpcId, subjectId, sentiment, interactionId, tick);
    this.updateRelationshipTier(observerNpcId, subjectId, sentiment); // M44-C1

    // Prune old memories if we've exceeded the cap
    if (profile.interactions.size > profile.maxMemories) {
      this.pruneOldestMemories(observerNpcId);
    }

    return interactionId;
  }

  /**
   * Backward compatibility wrapper for player interactions
   */
  recordPlayerInteraction(
    npcId: string,
    playerId: string,
    action: string,
    sentiment: number,
    impact: number,
    description: string,
    tick: number
  ): string {
    return this.recordInteraction(npcId, playerId, 'player', action, sentiment, impact, description, tick);
  }

  /**
   * Detect and update social scars based on interaction sentiment
   * M44-C1: Works with universal interactions
   */
  private updateSocialScars(
    observerNpcId: string,
    subjectId: string,
    sentiment: number,
    interactionId: string,
    tick: number
  ): void {
    const profile = this.getOrCreateMemoryProfile(observerNpcId);
    const scarType: SocialScar["type"] = sentiment < -this.SCAR_THRESHOLD ? "grudge" : sentiment > this.SCAR_THRESHOLD ? "favor" : "debt";
    const scarId = `${observerNpcId}-${scarType}-${subjectId}`;

    let scar = profile.socialScars.get(scarId);
    if (!scar) {
      scar = {
        type: scarType,
        severity: Math.abs(sentiment),
        memoryIds: [interactionId],
        lastReinforced: tick,
        subjectId,
      };
      profile.socialScars.set(scarId, scar);
    } else {
      // Reinforce existing scar
      scar.memoryIds.push(interactionId);
      scar.severity = Math.min(1.0, scar.severity + Math.abs(sentiment) * 0.2);
      scar.lastReinforced = tick;
    }
  }

  /**
   * M44-C1: Update relationship tier based on accumulated scars
   * Determines if subject is an Ally, Neutral, Rival, or Enemy
   */
  private updateRelationshipTier(observerNpcId: string, subjectId: string, sentiment: number): void {
    const profile = this.getOrCreateMemoryProfile(observerNpcId);
    let netSentiment = 0;
    let totalInteractions = 0;
    let isNpcSubject = false;

    // Calculate net sentiment for this subject
    for (const interaction of profile.interactions.values()) {
      if (interaction.subjectId === subjectId) {
        netSentiment += interaction.sentiment;
        totalInteractions++;
        isNpcSubject = interaction.subjectType === 'npc';
      }
    }

    if (totalInteractions === 0) return;
    netSentiment /= totalInteractions;

    // Determine tier
    let tier: RelationshipTier;
    if (netSentiment > 0.5) {
      tier = 'Ally';
      // Ally: Provides intel buff, shares plans
      if (isNpcSubject) {
        profile.npcAllies.add(subjectId);
        profile.npcRivals.delete(subjectId);
      }
    } else if (netSentiment > 0) {
      tier = 'Neutral';
    } else if (netSentiment > -0.5) {
      tier = 'Neutral';
    } else {
      tier = 'Rival';
      // Rival: Sabotages player actions, opposes plans
      if (isNpcSubject) {
        profile.npcRivals.add(subjectId);
        profile.npcAllies.delete(subjectId);
      }
    }

    profile.relationshipTiers.set(subjectId, {
      tier,
      relatedScar: profile.socialScars.values().next().value, // Get first scar if exists
      aliases: tier === 'Ally' ? { onAllyBehavior: 'provides_intel_buff' } : tier === 'Rival' ? { onRivalBehavior: 'sabotages_player_actions' } : undefined,
    });
  }

  /**
   * Prune oldest memories when cap exceeded
   */
  private pruneOldestMemories(npcId: string): void {
    const profile = this.getOrCreateMemoryProfile(npcId);
    const sorted = Array.from(profile.interactions.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    const toRemove = sorted.slice(0, Math.floor(profile.maxMemories * 0.1));
    for (const interaction of toRemove) {
      const key = `${interaction.timestamp}-${interaction.subjectId}-${interaction.action}`;
      profile.interactions.delete(key);
    }
  }

  /**
   * Calculate dialogue impact modifiers based on memories (player-focused)
   * M44-C1: Works with universal interactions
   */
  getMemoryImpactOnDialogue(observerNpcId: string, playerId: string): MemoryImpactOnDialogue {
    const profile = this.getOrCreateMemoryProfile(observerNpcId);

    // Calculate net sentiment for this player
    const playerInteractions = Array.from(profile.interactions.values()).filter(
      (i) => i.subjectId === playerId && i.subjectType === 'player'
    );

    let netSentiment = 0;
    let totalImpact = 0;

    for (const interaction of playerInteractions) {
      netSentiment += interaction.sentiment * interaction.impactScore;
      totalImpact += interaction.impactScore;
    }

    netSentiment = totalImpact > 0 ? netSentiment / totalImpact : 0;

    // Assess scars specific to this player
    let scarInfluence = 0;
    let grudgeCount = 0;
    let favorCount = 0;

    for (const scar of profile.socialScars.values()) {
      if (scar.memoryIds.some((id) => {
        const inter = profile.interactions.get(id);
        return inter?.subjectId === playerId;
      })) {
        if (scar.type === "grudge") grudgeCount++;
        if (scar.type === "favor") favorCount++;
        scarInfluence += scar.severity * 0.3;
      }
    }

    // Calculate behavioral probabilities
    const trustLevel = Math.max(0, netSentiment + favorCount * 0.1);
    const cautionLevel = Math.max(0, -netSentiment + grudgeCount * 0.1);

    return {
      sentiment: netSentiment,
      scarInfluence: Math.min(1.0, scarInfluence),
      trustLevel: Math.min(1.0, trustLevel),
      cautionLevel: Math.min(1.0, cautionLevel),
    };
  }

  /**
   * Decay non-reinforced scars over time (only if not sealed)
   */
  decayScars(npcId: string, tick: number, timeDelta: number): void {
    const profile = this.getOrCreateMemoryProfile(npcId);

    if (profile.sealed) return;

    for (const scar of profile.socialScars.values()) {
      const ticksSinceReinforced = tick - scar.lastReinforced;
      const decayAmount = ticksSinceReinforced * this.SCAR_DECAY_RATE * timeDelta;
      scar.severity = Math.max(0, scar.severity - decayAmount);

      // Remove scar if fully decayed
      if (scar.severity <= 0) {
        for (const [key, s] of profile.socialScars.entries()) {
          if (s === scar) {
            profile.socialScars.delete(key);
          }
        }
      }
    }
  }

  /**
   * M44-C1: Propagate gossip from one NPC to others
   * Spreads social scars through the network deterministically
   */
  propagateGossip(
    sourceNpcId: string,
    targetNpcIds: string[],
    subjectId: string,
    sentiment: number,
    action: string,
    description: string,
    tick: number
  ): number {
    const sourceProfile = this.getOrCreateMemoryProfile(sourceNpcId);
    let propagatedCount = 0;

    // Only propagate if source has a strong opinion
    if (Math.abs(sentiment) > this.SCAR_THRESHOLD) {
      for (const targetId of targetNpcIds) {
        if (targetId === sourceNpcId) continue; // Don't gossip with self
        
        const interactionId = `${tick}-${subjectId}-${action}`;
        this.recordInteraction(
          targetId,
          subjectId,
          'npc', // Assuming peer NPCs when gossiping
          `gossip_${action}`,
          sentiment * 0.8, // Slightly attenuate gossip
          0.6, // Lower impact for secondhand info
          `Heard from ${sourceNpcId}: ${description}`,
          tick
        );

        const targetProfile = this.getOrCreateMemoryProfile(targetId);
        const lastInteraction = Array.from(targetProfile.interactions.values()).at(-1);
        if (lastInteraction) {
          lastInteraction.propagated = true;
        }
        propagatedCount++;
      }
    }

    return propagatedCount;
  }

  /**
   * M44-C1: Get relationship tier between observer and subject
   */
  getRelationshipTier(observerNpcId: string, subjectId: string): RelationshipTier {
    const profile = this.getOrCreateMemoryProfile(observerNpcId);
    const tier = profile.relationshipTiers.get(subjectId);
    return tier?.tier || 'Neutral';
  }

  /**
   * M44-C1: Get all NPC allies for an observer
   */
  getNpcAllies(npcId: string): string[] {
    const profile = this.getOrCreateMemoryProfile(npcId);
    return Array.from(profile.npcAllies);
  }

  /**
   * M44-C1: Get all NPC rivals for an observer
   */
  getNpcRivals(npcId: string): string[] {
    const profile = this.getOrCreateMemoryProfile(npcId);
    return Array.from(profile.npcRivals);
  }

  /**
   * Seal an NPC's memories as Iron Canon (permanent)
   */
  sealMemories(npcId: string, tick: number): void {
    const profile = this.getOrCreateMemoryProfile(npcId);
    profile.sealed = true;
    profile.sealedAt = tick;
  }

  /**
   * Check if an NPC's memories are sealed
   */
  areMemoriesSealed(npcId: string): boolean {
    return this.getOrCreateMemoryProfile(npcId).sealed;
  }

  /**
   * Get raw memory profile for audit/debugging
   */
  getMemoryProfile(npcId: string): NpcMemoryProfile | null {
    return this.memoryProfiles.get(npcId) || null;
  }

  /**
   * Get all scars for an NPC
   */
  getNpcScars(npcId: string): Array<SocialScar & { scarId: string }> {
    const profile = this.getOrCreateMemoryProfile(npcId);
    return Array.from(profile.socialScars.entries()).map(([scarId, scar]) => ({
      scarId,
      ...scar,
    }));
  }

  /**
   * Export memory state for serialization (e.g., save/load)
   */
  exportMemoryState(npcId: string): object {
    const profile = this.getOrCreateMemoryProfile(npcId);
    return {
      npcId: profile.npcId,
      interactionCount: profile.interactions.size,
      scarCount: profile.socialScars.size,
      relationshipTierCount: profile.relationshipTiers.size, // M44-C1
      allyCount: profile.npcAllies.size, // M44-C1
      rivalCount: profile.npcRivals.size, // M44-C1
      sealed: profile.sealed,
      scarDetails: Array.from(profile.socialScars.values()).map((s) => ({
        type: s.type,
        severity: s.severity,
        memoryCount: s.memoryIds.length,
      })),
      relationshipTiers: Array.from(profile.relationshipTiers.entries()).map(([subjectId, tier]) => ({
        subjectId,
        tier: tier.tier,
      })), // M44-C1
    };
  }

  /**
   * Clear all memories (for testing or npc reset)
   */
  clearMemories(npcId: string): void {
    this.memoryProfiles.delete(npcId);
  }

  /**
   * Phase 25 Task 2: Calculate Global Social Tension (GST)
   * 
   * Formula: GST = min(1.0, (sum of negative scars + active rumors) / (NPC count × 10))
   * - Grudges and Enemy relationships add to tension
   * - Favors and Ally relationships subtract from tension
   * - Result is clamped between 0.0 (harmony) and 1.0 (chaos)
   * 
   * Used to drive social/hostile visual effects (red hue, high contrast)
   */
  getGlobalSocialTension(): number {
    let tensionScore = 0;
    let totalNpcs = 0;
    let activeGrudges = 0;
    let activeFavors = 0;

    // Iterate through all NPC memory profiles
    for (const profile of this.memoryProfiles.values()) {
      totalNpcs++;

      // Count and weight social scars
      for (const scar of profile.socialScars.values()) {
        if (scar.type === 'grudge') {
          tensionScore += scar.severity;
          activeGrudges++;
        } else if (scar.type === 'favor') {
          tensionScore -= scar.severity * 0.5; // Favors reduce tension less than grudges add it
          activeFavors++;
        }
      }

      // Count relationship tiers contributing to tension
      for (const tierData of profile.relationshipTiers.values()) {
        if (tierData.tier === 'Enemy') {
          tensionScore += 0.3; // Enemy relationship adds significant tension
        } else if (tierData.tier === 'Ally') {
          tensionScore -= 0.15; // Ally relationship reduces tension
        } else if (tierData.tier === 'Rival') {
          tensionScore += 0.15; // Rival adds mild tension
        }
      }
    }

    // Normalize by NPC count (prevents empty worlds from having false positives)
    const normalizer = Math.max(1, totalNpcs * 10);
    const rawGst = tensionScore / normalizer;

    // Clamp between 0.0 (harmony) and 1.0 (maximum chaos)
    return Math.max(0, Math.min(1, rawGst));
  }

  /**
   * Phase 25 Task 2: Get detailed narrative state snapshot
   * Returns structured information about the world's social fabric
   */
  getNarrativeState(tick: number): NarrativeState {
    let activeGrudges = 0;
    let activeFavors = 0;
    let activeDebts = 0;
    let totalScarSeverity = 0;
    let totalScars = 0;
    const relationshipTiers = {
      allies: 0,
      neutrals: 0,
      rivals: 0,
      enemies: 0,
    };

    for (const profile of this.memoryProfiles.values()) {
      // Count scar types
      for (const scar of profile.socialScars.values()) {
        totalScars++;
        totalScarSeverity += scar.severity;
        if (scar.type === 'grudge') activeGrudges++;
        if (scar.type === 'favor') activeFavors++;
        if (scar.type === 'debt') activeDebts++;
      }

      // Count relationship tiers
      for (const tierData of profile.relationshipTiers.values()) {
        if (tierData.tier === 'Ally') relationshipTiers.allies++;
        if (tierData.tier === 'Neutral') relationshipTiers.neutrals++;
        if (tierData.tier === 'Rival') relationshipTiers.rivals++;
        if (tierData.tier === 'Enemy') relationshipTiers.enemies++;
      }
    }

    return {
      globalSocialTension: this.getGlobalSocialTension(),
      activeGrudges,
      activeFavors,
      activeDebts,
      avgScarSeverity: totalScars > 0 ? totalScarSeverity / totalScars : 0,
      relationshipTierDistribution: relationshipTiers,
      timestamp: tick,
    };
  }

  /**
   * Phase 28 Task 2: Record an NPC's migration during economic downturns
   * Stores the origin location in their social scar so they "remember" where they fled from
   */
  recordMigration(
    npcId: string,
    fromLocationId: string,
    toLocationId: string,
    reason: 'economic_recession' | 'faction_conflict' | 'personal',
    tick: number
  ): void {
    const profile = this.getOrCreateMemoryProfile(npcId);

    // Create a migration memory
    const migrationId = `${tick}-migration-${npcId}`;
    const migration: UniversalInteraction = {
      timestamp: tick,
      observerNpcId: npcId,
      subjectId: 'self',
      subjectType: 'npc',
      action: reason === 'economic_recession' ? 'fled_recession' : 'relocated',
      sentiment: reason === 'economic_recession' ? -0.5 : -0.2,
      impactScore: 0.8,
      description: `Migrated from ${fromLocationId} to ${toLocationId} due to ${reason}`,
      propagated: false,
    };

    profile.interactions.set(migrationId, migration);

    // Record origin location in all active scars
    for (const scar of profile.socialScars.values()) {
      if (!scar.originLocationId) {
        scar.originLocationId = fromLocationId;
      }
    }
  }

  /**
   * Phase 28 Task 2: Finalize epoch memories and seal them as history
   * Converts active social scars into Historical Records for cross-generational persistence
   * Called at end of epoch (from chronicleEngine.ts during epoch transition)
   */
  finalizeEpochMemories(
    npcMemories: Record<string, NpcMemoryProfile> | Map<string, NpcMemoryProfile>,
    epochId: string,
    currentTick: number
  ): HistoricalRecord[] {
    const historicalRecords: HistoricalRecord[] = [];

    const profiles = npcMemories instanceof Map
      ? Array.from(npcMemories.values())
      : Object.values(npcMemories);

    for (const profile of profiles) {
      // Process each social scar and convert to historical record
      for (const scar of profile.socialScars.values()) {
        const record: HistoricalRecord = {
          recordId: `hist-${profile.npcId}-${scar.type}-${currentTick}`,
          npcId: profile.npcId,
          epochId,
          originalScarId: scar.scarId,
          recordType: scar.type === 'grudge' ? 'tragedy' : scar.type === 'debt' ? 'transformation' : 'achievement',
          content: `${profile.npcId} carries ${scar.type === 'grudge' ? 'a deep grudge' : scar.type === 'debt' ? 'a burden of debt' : 'a favor remembered'}. Severity: ${(scar.severity * 100).toFixed(0)}%`,
          severity: scar.severity,
          linkedLocationIds: scar.originLocationId ? [scar.originLocationId] : [],
          linkedNpcIds: [scar.subjectId],
          linkedFactionIds: [],
          sealedAtTick: currentTick,
          legacyImpact: Math.round(scar.severity * 100), // 0-100 impact on descendants
        };

        // Store record in the profile's historical records
        profile.historicalRecords.set(record.recordId, record);
        historicalRecords.push(record);
      }
    }

    return historicalRecords;
  }

  /**
   * Phase 28 Task 2: Get historical records for an NPC (cross-epoch persistence)
   */
  getHistoricalRecords(npcId: string): HistoricalRecord[] {
    const profile = this.memoryProfiles.get(npcId);
    return profile ? Array.from(profile.historicalRecords.values()) : [];
  }

  /**
   * Phase 28 Task 2: Link NPC sentiment to economic cycle history
   * Returns economic trust modifier based on how many recessions the NPC has survived
   */
  getEconomicTrustModifier(npcId: string): number {
    const profile = this.memoryProfiles.get(npcId);
    if (!profile) return 0;

    // Count migration memories (economic hardships survived)
    const migrationMemories = Array.from(profile.interactions.values())
      .filter(i => i.action === 'fled_recession' || i.action === 'relocated');

    // Count grudges linked to economic events
    const economicGrudges = Array.from(profile.socialScars.values())
      .filter(s => s.type === 'grudge' && s.originLocationId !== undefined);

    // Base modifier: each recession survived reduces economic trust slightly
    let modifier = -migrationMemories.length * 0.1;

    // Grudges amplify distrust
    modifier -= economicGrudges.length * 0.05;

    return Math.max(-1, Math.min(1, modifier)); // Clamp to -1 to 1
  }
}

// Singleton instance
let instance: NpcMemoryEngine | null = null;

export function getNpcMemoryEngine(): NpcMemoryEngine {
  if (!instance) {
    instance = new NpcMemoryEngine();
  }
  return instance;
}
