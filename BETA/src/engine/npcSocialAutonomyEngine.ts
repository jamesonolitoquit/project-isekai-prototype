/**
 * M46-C2: NPC Social Autonomy Engine
 * 
 * Purpose: Enable NPCs to interact with each other using intentResolverEngine.
 * NPCs execute social intents (PERSUADE, DECEIVE, CHARM, etc.) against other NPCs.
 * Social outcomes trigger faction shifts, belief layer updates, and autonomousmemory formation.
 * 
 * Architecture:
 * NPC A → SelectTarget (nearby NPC B) → SelectIntent (DECEIVE) → ResolveOutcome → Update beliefs
 *      ↓
 *   NPC Memory (I was deceived by NPC A)
 *      ↓
 *   Emotional shift (fear ↑, trust ↓)
 *      ↓
 *   Faction shift (if NPC A and B are from rival factions)
 */

import type { WorldState, NPC } from './worldEngine';
import { getIntentResolverEngine, type ComplexIntent, type IntentOutcome, type SocialIntent } from './intentResolverEngine';
import { getBeliefEngine } from './beliefEngine';
import { updateNpcEmotion } from './npcEngine';

/**
 * Interaction between two NPCs: who, what, outcome
 */
export interface NpcInteraction {
  id: string;
  initiatorId: string; // NPC who started the interaction
  targetId: string; // NPC who was targeted
  type: 'conversation' | 'social_intent' | 'trade' | 'conflict';
  intentType: 'PERSUADE' | 'DECEIVE' | 'INTIMIDATE' | 'CHARM' | 'NEGOTIATE' | 'BLUFF' | 'INSPIRE' | 'SEDUCE' | 'MANIPULATE' | 'THREATEN' | 'GOSSIP';
  
  context: {
    location: string; // Where did this happen?
    tick: number; // When?
    weather?: string;
    season?: string;
  };
  
  outcome: 'success' | 'partial' | 'failure';
  emotionalEffect: Record<string, number>; // { fear: +10, trust: -5 }
  beliefEffect?: {
    rumorCreated?: string; // Rumor about the interaction
    hardFactRecorded?: boolean; // Should this be recorded as hard fact?
  };
  
  memoryFormed: boolean; // Did each NPC remember this?
  reputation: {
    initiatorReputation: number; // How did initiator's reputation change?
    targetReputation: number; // How did target's reputation change?
  };
}

/**
 * Social relationship tracking between NPCs
 */
export interface NpcSocialRelationship {
  fromNpcId: string;
  toNpcId: string;
  
  // Relationship metrics
  trust: number; // -100 to +100 (> 0 means trusts; < 0 means distrusts)
  affinity: number; // -100 to +100 (likes or dislikes)
  debt: number; // Favors owed (positive = creditor, negative = debtor)
  
  // Interaction history
  recentInteractions: string[]; // IDs of recent interactions
  conflictCount: number; // How many conflicts?
  cooperationCount: number; // How many cooperative actions?
  
  // M55-B1: Gossip tracking
  coLocationTicks?: number; // Consecutive ticks spent together at same location
  lastSharedLocation?: string; // Last location where they met
  lastGossipExchange?: number; // Tick when last gossip was exchanged
  
  status: 'neutral' | 'allied' | 'hostile' | 'rival';
  lastUpdate: number;
}

class NpcSocialAutonomy {
  private interactions: Map<string, NpcInteraction> = new Map(); // ID -> interaction
  private relationships: Map<string, NpcSocialRelationship> = new Map(); // "fromId-toId" -> relationship
  private npcMemories: Map<string, any[]> = new Map(); // NPC ID -> array of memories

  /**
   * Initialize social relationship between two NPCs if not exists
   */
  private ensureRelationship(fromId: string, toId: string, currentTick: number): NpcSocialRelationship {
    const key = `${fromId}-${toId}`;
    if (this.relationships.has(key)) {
      return this.relationships.get(key)!;
    }

    const relationship: NpcSocialRelationship = {
      fromNpcId: fromId,
      toNpcId: toId,
      trust: 0, // Neutral starting point
      affinity: 0,
      debt: 0,
      recentInteractions: [],
      conflictCount: 0,
      cooperationCount: 0,
      status: 'neutral',
      lastUpdate: currentTick
    };

    this.relationships.set(key, relationship);
    return relationship;
  }

  /**
   * M55-B1: Update relationship metrics for co-located NPCs
   * Increments coLocationTicks for NPCs sharing the same location
   * This enables gossip triggers after 50+ consecutive ticks together
   */
  updateRelationshipsTick(npcs: NPC[], currentTick: number): void {
    // Group NPCs by location
    const npcsByLocation: Map<string, NPC[]> = new Map();
    
    for (const npc of npcs) {
      const locationId = npc.locationId || 'unknown';
      if (!npcsByLocation.has(locationId)) {
        npcsByLocation.set(locationId, []);
      }
      npcsByLocation.get(locationId)!.push(npc);
    }

    // For each location with 2+ NPCs, update co-location tracking
    for (const [locationId, locatedNpcs] of npcsByLocation.entries()) {
      if (locatedNpcs.length < 2) {
        continue;
      }

      // Update all pairs of NPCs at this location
      for (let i = 0; i < locatedNpcs.length; i++) {
        for (let j = i + 1; j < locatedNpcs.length; j++) {
          const npcA = locatedNpcs[i];
          const npcB = locatedNpcs[j];

          // Update A->B relationship
          let relAB = this.ensureRelationship(npcA.id, npcB.id, currentTick);
          relAB.coLocationTicks = (relAB.coLocationTicks || 0) + 1;
          relAB.lastSharedLocation = locationId;
          relAB.lastUpdate = currentTick;

          // Update B->A relationship
          let relBA = this.ensureRelationship(npcB.id, npcA.id, currentTick);
          relBA.coLocationTicks = (relBA.coLocationTicks || 0) + 1;
          relBA.lastSharedLocation = locationId;
          relBA.lastUpdate = currentTick;
        }
      }
    }
  }

  /**
   * Select a random nearby NPC target for interaction
   */
  private selectTargetNpc(
    initiator: NPC,
    npcs: NPC[],
    state: WorldState
  ): NPC | null {
    // Find NPCs in same location
    const potentialTargets = npcs.filter(
      npc => npc.id !== initiator.id && npc.locationId === initiator.locationId
    );

    if (potentialTargets.length === 0) {
      return null;
    }

    // Weight by affinity if we have relationship data
    const weighted = potentialTargets.map(target => {
      const rel = this.relationships.get(`${initiator.id}-${target.id}`);
      const affinity = rel?.affinity ?? 0;
      return { npc: target, weight: 50 + affinity }; // Bias toward liked NPCs
    });

    // Random weighted selection
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let pick = Math.random() * totalWeight;

    for (const { npc, weight } of weighted) {
      pick -= weight;
      if (pick <= 0) {
        return npc;
      }
    }

    return weighted[weighted.length - 1].npc;
  }

  /**
   * Select intent for this interaction based on personalities and relationship
   */
  private selectIntent(
    initiator: NPC,
    target: NPC,
    relationship: NpcSocialRelationship
  ): SocialIntent {
    const personality = initiator.personality || { sociability: 0.5, risk: 0.5, ambition: 0.5 };
    const roll = Math.random();

    // M55-B1/C1: GOSSIP intent if co-located for 50+ ticks
    if ((relationship.coLocationTicks || 0) > 50 && roll < 0.4) {
      return 'GOSSIP'; // Rumor exchange after extended proximity
    }

    // Ambition check: try to manipulate
    if (personality.ambition > 0.7 && roll < 0.3) {
      return 'MANIPULATE';
    }

    // Deceptive check if distrusts
    if (relationship.trust < -30 && roll < 0.25) {
      return 'DECEIVE';
    }

    // Charm if likes
    if (relationship.affinity > 50 && roll < 0.3) {
      return 'CHARM';
    }

    // Intimidate if hostile
    if (relationship.status === 'hostile' && roll < 0.2) {
      return 'INTIMIDATE';
    }

    // Default: negotiate
    return 'NEGOTIATE';
  }

  /**
   * Phase 6: Apply distortion to rumor text based on NPC personality
   * Implements "Telephone Effect" - rumors mutate with each exchange
   */
  private distortRumor(rumor: any, npc: NPC, currentTick: number): any {
    const personality = npc.personality || { ambition: 0.5, boldness: 0.5, sociability: 0.5 };
    
    // Distortion chance increases with ambition (NPCs exaggerate) and boldness (NPCs lie)
    const distortionChance = Math.min(0.8, (personality.ambition || 0) * 0.4 + (personality.boldness || 0) * 0.4);
    const shouldDistort = Math.random() < distortionChance;

    let distortedRumor = { ...rumor };

    if (shouldDistort && rumor.description) {
      // Extract potential names and locations from rumor text
      const namePatterns = /\b[A-Z][a-z]+\b/g; // Simple CamelCase names
      const matches = rumor.description.match(namePatterns) || [];

      // 20% chance to swap a name or location with another NPC/location
      if (matches.length >= 2 && Math.random() < 0.2) {
        const idx1 = Math.floor(Math.random() * matches.length);
        let idx2 = Math.floor(Math.random() * matches.length);
        while (idx2 === idx1) {
          idx2 = Math.floor(Math.random() * matches.length);
        }

        const swapped = rumor.description.replace(
          new RegExp(`\\b${matches[idx1]}\\b`, 'g'),
          `${matches[idx2]}_TEMP`
        );
        distortedRumor.description = swapped.replace(
          new RegExp(`\\b${matches[idx2]}\\b`, 'g'),
          matches[idx1]
        ).replace(/_TEMP/g, matches[idx2]);
      }

      // Apply personality-based distortion
      if (personality.ambition > 0.7) {
        // Ambitious NPCs exaggerate: add superlatives or intensifiers
        distortedRumor.description = distortedRumor.description
          .replace(/very/gi, 'extremely')
          .replace(/slightly/gi, '')
          .replace(/might/gi, 'definitely')
          .replace(/could/gi, 'certainly');
      }

      if ((personality.boldness || 0) > 0.7) {
        // Risky NPCs corrupt: add vague accusations or emotional language
        if (!distortedRumor.description.includes('?')) {
          distortedRumor.description += ' ...or so they claim.';
        }
      }
    }

    // Always apply reliability decay (Telephone Effect base mechanic)
    distortedRumor.reliability = Math.max(0.1, (distortedRumor.reliability || 0.5) * 0.85);

    // Track distortion accumulation (for audit trails)
    distortedRumor.distortion = (distortedRumor.distortion || 0) + 1;
    distortedRumor.lastDistortedBy = npc.id;
    distortedRumor.lastDistortedAt = currentTick;

    // Preserve original content for reference (immutable)
    if (!distortedRumor.originalDescription) {
      distortedRumor.originalDescription = rumor.description;
    }

    return distortedRumor;
  }

  /**
   * M55-C1: Exchange rumors/gossip between co-located NPCs
   * NPCs share rumors about third parties, creating cascading rumors
   * Phase 6: Rumors now distort during exchange (Telephone Effect)
   */
  private exchangeGossipRumors(npcA: NPC, npcB: NPC, currentTick: number): void {
    // Each NPC has a 'rumors' array from belief system
    const rumorsA = (npcA as any).beliefs?.rumors || [];
    const rumorsB = (npcB as any).beliefs?.rumors || [];

    if (rumorsA.length === 0 && rumorsB.length === 0) {
      return; // No rumors to exchange
    }

    // Select high-value rumors from A to share with B
    // Prioritize rare or high-reliability rumors
    const valuableRumorsFromA = rumorsA
      .filter((r: any) => r.reliability !== undefined && r.reliability > 0.5)
      .slice(0, 2); // Share up to 2 rumors

    const valuableRumorsFromB = rumorsB
      .filter((r: any) => r.reliability !== undefined && r.reliability > 0.5)
      .slice(0, 2); // Share up to 2 rumors

    // Phase 6: Apply distortion to rumors based on target NPC personality (Telephone Effect)
    const distortedFromA = valuableRumorsFromA.map((r: any) => 
      this.distortRumor(r, npcB, currentTick)
    );
    const distortedFromB = valuableRumorsFromB.map((r: any) =>
      this.distortRumor(r, npcA, currentTick)
    );

    // Update target NPC rumors arrays (they now know these rumors)
    if ((npcB as any).beliefs && distortedFromA.length > 0) {
      (npcB as any).beliefs.rumors = [
        ...((npcB as any).beliefs.rumors || []),
        ...distortedFromA.map((r: any) => ({
          ...r,
          learnedFrom: npcA.id,
          learnedAt: currentTick
        }))
      ];
    }

    if ((npcA as any).beliefs && distortedFromB.length > 0) {
      (npcA as any).beliefs.rumors = [
        ...((npcA as any).beliefs.rumors || []),
        ...distortedFromB.map((r: any) => ({
          ...r,
          learnedFrom: npcB.id,
          learnedAt: currentTick
        }))
      ];
    }

    // Record memory of gossip exchange with distortion meta-tracking
    const distortionMetaA = distortedFromB.filter((r: any) => r.distortion > 0).length;
    const distortionMetaB = distortedFromA.filter((r: any) => r.distortion > 0).length;
    
    this.recordMemory(
      npcA.id,
      `Shared rumors with ${npcB.name} about various people (heard ${distortionMetaA} rumors with distortion)`,
      currentTick
    );
    this.recordMemory(
      npcB.id,
      `Heard rumors from ${npcA.name} about various people (heard ${distortionMetaB} rumors with distortion)`,
      currentTick
    );
  }

  /**
   * Execute social intent between two NPCs
   */
  initiateSocialInteraction(
    initiator: NPC,
    target: NPC,
    state: WorldState,
    currentTick: number
  ): NpcInteraction | null {
    const intentResolver = getIntentResolverEngine();
    const belief = getBeliefEngine();

    // Ensure relationship exists
    const relationship = this.ensureRelationship(initiator.id, target.id, currentTick);

    // Select intent based on personalities
    const intentType = this.selectIntent(initiator, target, relationship);

    // M55-C1: Special handling for GOSSIP intent
    if (intentType === 'GOSSIP') {
      // Exchange rumors directly without intent resolver
      this.exchangeGossipRumors(initiator, target, currentTick);
      
      // Record gossip exchange as a special interaction
      const gossipInteraction: NpcInteraction = {
        id: `gossip_${initiator.id}_${target.id}_${currentTick}`,
        initiatorId: initiator.id,
        targetId: target.id,
        type: 'social_intent',
        intentType: 'GOSSIP',
        context: {
          location: initiator.locationId,
          tick: currentTick,
          weather: state.weather,
          season: state.season
        },
        outcome: 'success',
        emotionalEffect: { familiarity: 5 }, // Slight familiarity boost
        reputation: {
          initiatorReputation: 0,
          targetReputation: 0
        },
        memoryFormed: true
      };

      // Update relationship after gossip
      relationship.coLocationTicks = 0; // Reset counter after gossip
      relationship.lastGossipExchange = currentTick;
      relationship.affinity = Math.min(100, (relationship.affinity || 0) + 5); // Slight affinity boost

      this.interactions.set(gossipInteraction.id, gossipInteraction);
      return gossipInteraction;
    }

    // Build intent for resolver (non-gossip intents)
    const intent: ComplexIntent = {
      id: `interaction_${initiator.id}_${target.id}_${currentTick}`,
      intentType: intentType,
      initiatorNpcId: initiator.id,
      targetNpcId: target.id,
      description: `${initiator.name} attempts to ${intentType.toLowerCase()} ${target.name}`,
      stakes: relationship.affinity > 50 ? 'low' : relationship.affinity < -50 ? 'high' : 'medium',
      desiredOutcome: `Improve relations with ${target.name}`
    };

    // Resolve the intent
    const outcome = intentResolver.resolveIntent(
      intent,
      initiator,
      target
    );

    // Create interaction record
    const interaction: NpcInteraction = {
      id: `interaction_${initiator.id}_${target.id}_${currentTick}`,
      initiatorId: initiator.id,
      targetId: target.id,
      type: 'social_intent',
      intentType,
      context: {
        location: initiator.locationId,
        tick: currentTick,
        weather: state.weather,
        season: state.season
      },
      outcome: outcome.skillCheck.isSuccess ? 'success' : 'failure',
      emotionalEffect: outcome.emotionalEffect || {},
      reputation: {
        initiatorReputation: outcome.relationship_impact || 0,
        targetReputation: -(outcome.relationship_impact || 0) // Inverse for target
      },
      memoryFormed: outcome.skillCheck.isSuccess
    };

    // Apply emotional effects on target
    if (interaction.memoryFormed) {
      for (const [emotion, delta] of Object.entries(interaction.emotionalEffect)) {
        updateNpcEmotion(target, emotion as any, delta, interaction.id, currentTick);
      }
    }

    // Update relationship status based on outcome
    this.updateRelationshipFromInteraction(relationship, interaction, outcome);

    // Optional: record as rumor if juicy enough
    if (interaction.outcome === 'success' && intentType === 'DECEIVE') {
      interaction.beliefEffect = {
        rumorCreated: `${initiator.name} deceived ${target.name} about something...`
      };
      // Record as hard fact in belief engine
      belief.recordHardFact({
        id: interaction.id,
        description: interaction.beliefEffect.rumorCreated,
        eventType: 'betrayal',
        originLocationId: interaction.context.location,
        originEpochTick: currentTick,
        factionIds: [],
        severity: 30,
        truthRadius: 2,
        truthDecayRate: 0.1,
        timestamp: Date.now()
      });
    }

    // Store interaction
    this.interactions.set(interaction.id, interaction);

    // Form memories
    if (interaction.memoryFormed) {
      this.recordMemory(initiator.id, `Attempted to ${intentType.toLowerCase()} ${target.name}`, currentTick);
      this.recordMemory(target.id, `${initiator.name} tried to ${intentType.toLowerCase()} me`, currentTick);
    }

    return interaction;
  }

  /**
   * Process all NPC-to-NPC interactions for the world tick
   */
  processNpcSocialTick(
    npcs: NPC[],
    state: WorldState,
    currentTick: number,
    interactionProbability: number = 0.05 // 5% chance per NPC per tick
  ): {
    interactionsOccurred: number;
    descriptions: string[];
  } {
    let interactionsOccurred = 0;
    const descriptions: string[] = [];

    for (const npc of npcs) {
      // Random chance to initiate social interaction
      if (Math.random() > interactionProbability) {
        continue;
      }

      // Find target
      const target = this.selectTargetNpc(npc, npcs, state);
      if (!target) {
        continue;
      }

      // Execute interaction
      const interaction = this.initiateSocialInteraction(npc, target, state, currentTick);
      if (interaction) {
        interactionsOccurred++;
        const desc = `${npc.name} and ${target.name} had a ${interaction.outcome} social interaction.`;
        descriptions.push(desc);
      }
    }

    return { interactionsOccurred, descriptions };
  }

  /**
   * Map intent resolver outcome criticality to interaction outcome
   */
  private mapOutcome(criticality: string): 'success' | 'partial' | 'failure' {
    switch (criticality) {
      case 'critical_success':
      case 'success':
        return 'success';
      case 'partial_success':
        return 'partial';
      case 'failure':
      case 'critical_failure':
        return 'failure';
      default:
        return 'partial';
    }
  }

  /**
   * Calculate emotional effect based on intent type and outcome
   */
  private calculateEmotionalEffect(
    intent: string,
    outcome: string
  ): Record<string, number> {
    const effects: Record<string, number> = {};

    switch (intent) {
      case 'DECEIVE':
        effects.trust = outcome === 'success' ? -20 : -5;
        effects.resentment = -10;
        break;

      case 'INTIMIDATE':
        effects.fear = outcome === 'success' ? 30 : 10;
        effects.resentment = 15;
        break;

      case 'CHARM':
        effects.trust = outcome === 'success' ? 25 : 5;
        effects.gratitude = 10;
        break;

      case 'PERSUADE':
        effects.trust = outcome === 'success' ? 15 : 0;
        effects.gratitude = 10;
        break;

      case 'MANIPULATE':
        effects.trust = -15;
        effects.resentment = 20;
        break;

      case 'THREATEN':
        effects.fear = 25;
        effects.resentment = 30;
        break;

      default:
        effects.trust = 5;
    }

    return effects;
  }

  /**
   * Update relationship status based on interaction outcome
   */
  private updateRelationshipFromInteraction(
    relationship: NpcSocialRelationship,
    interaction: NpcInteraction,
    outcome: any
  ): void {
    // Update trust
    if (interaction.outcome === 'success') {
      relationship.trust += 10;
    } else if (interaction.outcome === 'failure') {
      relationship.trust -= 15;
    }

    // Update affinity
    switch (interaction.intentType) {
      case 'CHARM':
      case 'PERSUADE':
        relationship.affinity += 10;
        break;
      case 'DECEIVE':
      case 'INTIMIDATE':
        relationship.affinity -= 15;
        break;
    }

    // Track interaction history
    relationship.recentInteractions.push(interaction.id);
    if (relationship.recentInteractions.length > 10) {
      relationship.recentInteractions.shift();
    }

    // Update status
    if (relationship.trust > 50 && relationship.affinity > 50) {
      relationship.status = 'allied';
    } else if (relationship.trust < -50 && relationship.affinity < -50) {
      relationship.status = 'hostile';
    } else if (Math.abs(relationship.trust) > 30 || Math.abs(relationship.affinity) > 30) {
      relationship.status = 'rival';
    } else {
      relationship.status = 'neutral';
    }

    // Clamp values
    relationship.trust = Math.max(-100, Math.min(100, relationship.trust));
    relationship.affinity = Math.max(-100, Math.min(100, relationship.affinity));
  }

  /**
   * Record memory for an NPC
   */
  private recordMemory(npcId: string, memory: string, tick: number): void {
    if (!this.npcMemories.has(npcId)) {
      this.npcMemories.set(npcId, []);
    }

    this.npcMemories.get(npcId)!.push({
      text: memory,
      tick,
      id: `memory_${npcId}_${tick}`
    });

    // Keep only last 50 memories per NPC
    const memories = this.npcMemories.get(npcId)!;
    if (memories.length > 50) {
      this.npcMemories.set(npcId, memories.slice(-50));
    }
  }

  /**
   * Get recent memories for an NPC
   */
  getMemoriesForNpc(npcId: string, maxCount: number = 10): any[] {
    const memories = this.npcMemories.get(npcId) || [];
    return memories.slice(-maxCount);
  }

  /**
   * Get relationship between two NPCs
   */
  getRelationship(fromId: string, toId: string): NpcSocialRelationship | null {
    return this.relationships.get(`${fromId}-${toId}`) || null;
  }

  /**
   * Get all relationships for an NPC
   */
  getRelationshipsForNpc(npcId: string): NpcSocialRelationship[] {
    const result: NpcSocialRelationship[] = [];
    for (const [key, rel] of this.relationships.entries()) {
      if (rel.fromNpcId === npcId) {
        result.push(rel);
      }
    }
    return result;
  }

  /**
   * Get interaction by ID
   */
  getInteraction(interactionId: string): NpcInteraction | null {
    return this.interactions.get(interactionId) || null;
  }

  /**
   * Clear all data when epoch resets
   */
  clearAll(): void {
    this.interactions.clear();
    this.relationships.clear();
    this.npcMemories.clear();
  }
}

// Singleton instance
let instance: NpcSocialAutonomy | null = null;

export function getNpcSocialAutonomy(): NpcSocialAutonomy {
  if (!instance) {
    instance = new NpcSocialAutonomy();
  }
  return instance;
}

/**
 * Convenience exports
 */
export const npcSocialEngine = {
  initiateSocialInteraction: (initiator: NPC, target: NPC, state: WorldState, tick: number) =>
    getNpcSocialAutonomy().initiateSocialInteraction(initiator, target, state, tick),
  processNpcSocialTick: (npcs: NPC[], state: WorldState, tick: number, prob?: number) =>
    getNpcSocialAutonomy().processNpcSocialTick(npcs, state, tick, prob),
  updateRelationshipsTick: (npcs: NPC[], tick: number) =>
    getNpcSocialAutonomy().updateRelationshipsTick(npcs, tick),
  getMemoriesForNpc: (npcId: string, maxCount?: number) =>
    getNpcSocialAutonomy().getMemoriesForNpc(npcId, maxCount),
  getRelationship: (fromId: string, toId: string) =>
    getNpcSocialAutonomy().getRelationship(fromId, toId),
  getRelationshipsForNpc: (npcId: string) =>
    getNpcSocialAutonomy().getRelationshipsForNpc(npcId),
  getInteraction: (interactionId: string) =>
    getNpcSocialAutonomy().getInteraction(interactionId),
  clearAll: () =>
    getNpcSocialAutonomy().clearAll()
};
