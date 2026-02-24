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
import { getIntentResolver, type ComplexIntent, type IntentOutcome } from './intentResolverEngine';
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
  intentType: 'PERSUADE' | 'DECEIVE' | 'INTIMIDATE' | 'CHARM' | 'NEGOTIATE' | 'BLUFF' | 'INSPIRE' | 'SEDUCE' | 'MANIPULATE' | 'THREATEN';
  
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
  
  status: 'neutral' | 'allied' | 'hostile' | 'rival';
  lastUpdate: number;
}

/**
 * Phase 19: Rumor & Gossip System
 * Rumors are created from social interactions and spread between co-located NPCs
 * With each transfer, rumor distortion increases by 10%
 */
export interface Rumor {
  id: string;
  content: string; // The rumor text
  originNpcId: string; // Who started it
  originTick: number; // When was it created
  currentDistortion: number; // 0-100 (increases by 10 per transfer, represents degradation)
  transferCount: number; // How many NPCs have spread it
  holderNpcIds: string[]; // NPCs currently holding this rumor
  lastSpreadTick: number; // When was it last transferred
}

/**
 * Co-location tracking: How long have two NPCs been in the same location
 */
export interface CoLocationTracker {
  npcId1: string;
  npcId2: string;
  tick: number; // Tick counter while co-located
  locationId: string;
}

/**
 * Phase 19: Trade transaction between NPCs
 */
export interface NpcTrade {
  id: string;
  traderId: string; // NPC offering the trade
  partnerIds: string[]; // NPCs accepting the trade
  tick: number;
  offered: { itemId: string; quantity: number }[];
  requested: { itemId: string; quantity: number }[];
  completed: boolean;
  success: boolean;
}

class NpcSocialAutonomy {
  private interactions: Map<string, NpcInteraction> = new Map(); // ID -> interaction
  private relationships: Map<string, NpcSocialRelationship> = new Map(); // "fromId-toId" -> relationship
  private npcMemories: Map<string, any[]> = new Map(); // NPC ID -> array of memories
  private rumors: Map<string, Rumor> = new Map(); // Rumor ID -> rumor
  private coLocations: Map<string, CoLocationTracker> = new Map(); // "npc1-npc2" -> co-location tracker
  private trades: Map<string, NpcTrade> = new Map(); // Trade ID -> trade

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
  ): ComplexIntent['type'] {
    const personality = initiator.personality?.riskTolerance ? { ambition: initiator.personality.riskTolerance } : { ambition: 0.5 };
    const roll = Math.random();

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
   * Execute social intent between two NPCs
   */
  initiateSocialInteraction(
    initiator: NPC,
    target: NPC,
    state: WorldState,
    currentTick: number
  ): NpcInteraction | null {
    const intentResolver = getIntentResolver();
    const belief = getBeliefEngine();

    // Ensure relationship exists
    const relationship = this.ensureRelationship(initiator.id, target.id, currentTick);

    // Select intent based on personalities
    const intentType = this.selectIntent(initiator, target, relationship);

    // Build intent for resolver
    const intent: Partial<ComplexIntent> = {
      type: intentType,
      targetNpcId: target.id,
      playerSkill: initiator.charisma || 5,
      description: `${initiator.name} attempts to ${intentType.toLowerCase()} ${target.name}`
    };

    // Resolve the intent
    const outcome = intentResolver.resolveIntent(
      intent as ComplexIntent,
      state,
      { charisma: initiator.charisma || 5, intelligence: initiator.intelligence || 5 }
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
        weather: (state.weather as any) || 'clear',
        season: state.season || 'spring'
      },
      outcome: this.mapOutcome(outcome.criticalityLevel),
      emotionalEffect: this.calculateEmotionalEffect(intentType, outcome.criticalityLevel),
      reputation: {
        initiatorReputation: outcome.reputationDelta,
        targetReputation: -outcome.reputationDelta // Inverse for target
      },
      memoryFormed: outcome.criticalityLevel !== 'failure'
    };

    // Apply emotional effects on target
    if (interaction.memoryFormed) {
      for (const [emotion, delta] of Object.entries(interaction.emotionalEffect)) {
        const emotionType = emotion as 'trust' | 'fear' | 'gratitude' | 'resentment';
        updateNpcEmotion(target, emotionType, delta, interaction.id, currentTick);
      }
    }

    // Update relationship status based on outcome
    this.updateRelationshipFromInteraction(relationship, interaction, outcome);

    // Optional: record as rumor if juicy enough
    if (interaction.outcome === 'success' && intentType === 'DECEIVE') {
      interaction.beliefEffect = {
        rumorCreated: `${initiator.name} deceived ${target.name} about something...`
      };
      // Create rumor object for gossip propagation (Phase 19)
      this.createRumor(interaction.beliefEffect.rumorCreated, initiator.id, currentTick);
      
      // Rumor propagates through belief engine
      belief.recordHardFact({
        id: interaction.id,
        eventType: 'betrayal', // deception is a form of betrayal
        description: interaction.beliefEffect.rumorCreated,
        originLocationId: initiator.locationId,
        originEpochTick: currentTick,
        factionIds: [], // no specific factions involved
        severity: 30,
        truthRadius: 2,
        truthDecayRate: 0.1,
        timestamp: currentTick
      });
    } else if (interaction.outcome === 'success' && (intentType === 'CHARM' || intentType === 'PERSUADE')) {
      // Create positive rumors about positive interactions
      const rumorText = `${initiator.name} showed great ${intentType.toLowerCase()} to ${target.name}`;
      interaction.beliefEffect = { rumorCreated: rumorText };
      this.createRumor(rumorText, initiator.id, currentTick);
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
   * Phase 19: Create a new rumor from a social interaction
   */
  private createRumor(content: string, originNpcId: string, tick: number): Rumor {
    const rumor: Rumor = {
      id: `rumor_${originNpcId}_${tick}`,
      content,
      originNpcId,
      originTick: tick,
      currentDistortion: 0,
      transferCount: 0,
      holderNpcIds: [originNpcId],
      lastSpreadTick: tick
    };
    this.rumors.set(rumor.id, rumor);
    return rumor;
  }

  /**
   * Phase 19: Distort a rumor (adds 10% distortion per transfer)
   */
  private distortRumor(rumor: Rumor): string {
    // Add noise to rumor content and increase distortion counter
    rumor.currentDistortion = Math.min(100, rumor.currentDistortion + 10);
    
    // Apply content distortion: add ellipsis or corrupt words
    const distortionLevel = rumor.transferCount;
    if (distortionLevel > 3) {
      return rumor.content + ' [corrupted...]';
    } else if (distortionLevel > 1) {
      return rumor.content + ' [altered]';
    }
    return rumor.content;
  }

  /**
   * Phase 19: Transfer rumor between two co-located NPCs
   */
  triggerGossipExchange(
    npc1: NPC,
    npc2: NPC,
    tick: number,
    existingRumors: Rumor[]
  ): { rumorId: string; content: string; distortion: number }[] | null {
    // NPCs must be co-located (same location)
    if (npc1.locationId !== npc2.locationId) {
      return null;
    }

    // Track co-location
    const coLocKey = npc1.id < npc2.id ? `${npc1.id}-${npc2.id}` : `${npc2.id}-${npc1.id}`;
    if (!this.coLocations.has(coLocKey)) {
      this.coLocations.set(coLocKey, {
        npcId1: npc1.id,
        npcId2: npc2.id,
        tick: 0,
        locationId: npc1.locationId
      });
    }

    const coLocation = this.coLocations.get(coLocKey)!;
    coLocation.tick++;

    // Every 5 co-location ticks, trigger gossip exchange
    if (coLocation.tick % 5 !== 0) {
      return null;
    }

    // Find rumors that one NPC knows but the other doesn't
    const transferred: { rumorId: string; content: string; distortion: number }[] = [];
    
    for (const rumor of existingRumors) {
      const npc1HasRumor = rumor.holderNpcIds.includes(npc1.id);
      const npc2HasRumor = rumor.holderNpcIds.includes(npc2.id);

      // If one has it and other doesn't, transfer it
      if (npc1HasRumor && !npc2HasRumor) {
        const distortedContent = this.distortRumor(rumor);
        rumor.holderNpcIds.push(npc2.id);
        rumor.transferCount++;
        rumor.lastSpreadTick = tick;
        transferred.push({
          rumorId: rumor.id,
          content: distortedContent,
          distortion: rumor.currentDistortion
        });
      } else if (npc2HasRumor && !npc1HasRumor) {
        const distortedContent = this.distortRumor(rumor);
        rumor.holderNpcIds.push(npc1.id);
        rumor.transferCount++;
        rumor.lastSpreadTick = tick;
        transferred.push({
          rumorId: rumor.id,
          content: distortedContent,
          distortion: rumor.currentDistortion
        });
      }
    }

    return transferred.length > 0 ? transferred : null;
  }

  /**
   * Phase 19: Get rumors held by a specific NPC
   */
  getRumorsForNpc(npcId: string): Rumor[] {
    const result: Rumor[] = [];
    for (const [, rumor] of this.rumors.entries()) {
      if (rumor.holderNpcIds.includes(npcId)) {
        result.push(rumor);
      }
    }
    return result;
  }

  /**
   * Phase 19: Get all rumors in the world
   */
  getAllRumors(): Rumor[] {
    return Array.from(this.rumors.values());
  }

  /**
   * Phase 19: Process gossip exchanges for all NPCs during world tick
   * Returns descriptions of gossip exchanges that occurred
   */
  processGossipTick(
    npcs: NPC[],
    currentTick: number
  ): { gossipOccurrences: number; descriptions: string[] } {
    let gossipOccurrences = 0;
    const descriptions: string[] = [];

    // Get all rumors currently floating around
    const allRumors = this.getAllRumors();

    // Check all pairs of NPCs for co-location and gossip exchange
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const npc1 = npcs[i];
        const npc2 = npcs[j];

        // Skip if not at same location
        if (npc1.locationId !== npc2.locationId) {
          continue;
        }

        // Try to exchange gossip
        const transferred = this.triggerGossipExchange(npc1, npc2, currentTick, allRumors);
        if (transferred && transferred.length > 0) {
          gossipOccurrences++;
          for (const rumor of transferred) {
            const distortionMarker = rumor.distortion > 50 ? '[HEAVILY DISTORTED]' : 
                                      rumor.distortion > 20 ? '[ALTERED]' : '';
            descriptions.push(`${npc1.name} and ${npc2.name} gossiped: "${rumor.content}" ${distortionMarker}`);
          }
        }
      }
    }

    return { gossipOccurrences, descriptions };
  }

  /**
   * Phase 19: Initiate trade negotiation between two NPCs
   * NPCs trade items from their inventories if co-located
   */
  initiateNpcTrade(
    trader: NPC,
    partner: NPC,
    tick: number
  ): NpcTrade | null {
    // Must be co-located
    if (trader.locationId !== partner.locationId) {
      return null;
    }

    // Check if both have inventories
    const traderInventory = trader.inventory || [];
    const partnerInventory = partner.inventory || [];

    if (traderInventory.length === 0 || partnerInventory.length === 0) {
      return null;
    }

    // Randomly select items to trade
    const traderOffered = traderInventory.length > 0 ? 
      [traderInventory[Math.floor(Math.random() * traderInventory.length)]] : [];
    const partnerRequested = partnerInventory.length > 0 ? 
      [partnerInventory[Math.floor(Math.random() * partnerInventory.length)]] : [];

    if (traderOffered.length === 0 || partnerRequested.length === 0) {
      return null;
    }

    // Create trade
    const trade: NpcTrade = {
      id: `trade_${trader.id}_${partner.id}_${tick}`,
      traderId: trader.id,
      partnerIds: [partner.id],
      tick,
      offered: traderOffered.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity ?? 1
      })),
      requested: partnerRequested.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity ?? 1
      })),
      completed: false,
      success: false
    };

    // Check if trade is beneficial (both NPCs improve inventory value)
    const relevantRel = this.getRelationship(trader.id, partner.id);
    const acceptTrade = !relevantRel || 
                        (relevantRel.trust >= -20 && relevantRel.affinity > -30);

    if (acceptTrade) {
      trade.success = true;
      trade.completed = true;
      this.trades.set(trade.id, trade);

      // Update relationship - successful trades increase affinity
      if (relevantRel) {
        relevantRel.affinity = Math.min(100, relevantRel.affinity + 5);
        relevantRel.cooperationCount++;
      }

      return trade;
    }

    return null;
  }

  /**
   * Phase 19: Get all completed trades for an NPC
   */
  getCompletedTrades(npcId: string): NpcTrade[] {
    const result: NpcTrade[] = [];
    for (const [, trade] of this.trades.entries()) {
      if ((trade.traderId === npcId || trade.partnerIds.includes(npcId)) && trade.completed) {
        result.push(trade);
      }
    }
    return result;
  }

  /**
   * M57-T4: Complete gossip intent between two NPCs
   * Transfers random rumor from initiator to target with distortion increase
   * Both NPCs gain +2 affinity trust from social bonding
   */
  completeGossipIntent(initiator: NPC, target: NPC, tick: number): string {
    try {
      // Get rumors initiator knows
      const initiatorRumors = this.getRumorsForNpc(initiator.id);
      
      let rumor: Rumor | null = null;
      if (initiatorRumors.length > 0) {
        // Pick random rumor (bias toward newer ones)
        rumor = initiatorRumors[Math.floor(Math.random() * initiatorRumors.length)];
      } else {
        // Create rumor from recent events (stub)
        rumor = {
          id: `rumor-${tick}-${Math.random().toString(36).substr(2, 9)}`,
          content: `I heard about ${target.name} from a reliable source`,
          originNpcId: initiator.id,
          originTick: tick,
          currentDistortion: 0,
          transferCount: 0,
          holderNpcIds: [initiator.id],
          lastSpreadTick: tick
        };
        this.rumors.set(rumor.id, rumor);
      }

      // Apply distortion (+10% per transfer, max 100%)
      rumor.currentDistortion = Math.min(rumor.currentDistortion + 10, 100);
      
      // Transfer rumor to target
      if (!rumor.holderNpcIds.includes(target.id)) {
        rumor.holderNpcIds.push(target.id);
      }
      rumor.transferCount++;
      rumor.lastSpreadTick = tick;

      // Increase affinity trust between NPCs (+2)
      const relationship = this.getRelationship(initiator.id, target.id) ||
        this.createRelationship(initiator.id, target.id);
      if (relationship) {
        relationship.affinity = Math.min(relationship.affinity + 2, 100);
      }

      return `${initiator.name} told ${target.name} a rumor (${rumor.currentDistortion}% distorted): "${rumor.content}"`;
    } catch (error) {
      return `Gossip between ${initiator.name} and ${target.name} failed`;
    }
  }

  /**
   * M57-T4: Apply rumor decay and cleanup
   * Rumors older than 1000 ticks decay by -5 per 100 ticks
   * Remove rumors at 100% distortion
   * Limit NPCs to 50 rumors (FIFO eviction)
   */
  processRumorDecay(tick: number): void {
    try {
      const rumorsToDelete: string[] = [];

      for (const [rumorId, rumor] of this.rumors.entries()) {
        const rumorAge = tick - rumor.originTick;

        // Apply decay after 1000 ticks
        if (rumorAge > 1000) {
          const decayPeriods = Math.floor((rumorAge - 1000) / 100);
          const decayAmount = decayPeriods * 5;
          rumor.currentDistortion = Math.min(rumor.currentDistortion + decayAmount, 100);
        }

        // Remove at 100% distortion (forgotten)
        if (rumor.currentDistortion >= 100) {
          rumorsToDelete.push(rumorId);
        }
      }

      // Delete forgotten rumors
      for (const rumorId of rumorsToDelete) {
        this.rumors.delete(rumorId);
      }

      // Enforce per-NPC rumor limit (50 max)
      const npcRumorCounts = new Map<string, string[]>();
      for (const [rumorId, rumor] of this.rumors.entries()) {
        for (const npcId of rumor.holderNpcIds) {
          if (!npcRumorCounts.has(npcId)) {
            npcRumorCounts.set(npcId, []);
          }
          npcRumorCounts.get(npcId)!.push(rumorId);
        }
      }

      // FIFO eviction if over limit
      for (const [npcId, rumorIds] of npcRumorCounts.entries()) {
        if (rumorIds.length > 50) {
          const toDelete = rumorIds.length - 50;
          for (let i = 0; i < toDelete; i++) {
            const rumorId = rumorIds[i];
            const rumor = this.rumors.get(rumorId);
            if (rumor) {
              rumor.holderNpcIds = rumor.holderNpcIds.filter(id => id !== npcId);
              if (rumor.holderNpcIds.length === 0) {
                this.rumors.delete(rumorId);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[NpcSocialEngine] Rumor decay failed:', error);
    }
  }

  /**
   * Clear all data when epoch resets
   */
  clearAll(): void {
    this.interactions.clear();
    this.relationships.clear();
    this.npcMemories.clear();
    this.rumors.clear();
    this.coLocations.clear();
    this.trades.clear();
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
  getMemoriesForNpc: (npcId: string, maxCount?: number) =>
    getNpcSocialAutonomy().getMemoriesForNpc(npcId, maxCount),
  getRelationship: (fromId: string, toId: string) =>
    getNpcSocialAutonomy().getRelationship(fromId, toId),
  getRelationshipsForNpc: (npcId: string) =>
    getNpcSocialAutonomy().getRelationshipsForNpc(npcId),
  getInteraction: (interactionId: string) =>
    getNpcSocialAutonomy().getInteraction(interactionId),
  triggerGossipExchange: (npc1: NPC, npc2: NPC, tick: number, rumors: Rumor[]) =>
    getNpcSocialAutonomy().triggerGossipExchange(npc1, npc2, tick, rumors),
  getRumorsForNpc: (npcId: string) =>
    getNpcSocialAutonomy().getRumorsForNpc(npcId),
  getAllRumors: () =>
    getNpcSocialAutonomy().getAllRumors(),
  processGossipTick: (npcs: NPC[], tick: number) =>
    getNpcSocialAutonomy().processGossipTick(npcs, tick),
  completeGossipIntent: (initiator: NPC, target: NPC, tick: number) =>
    getNpcSocialAutonomy().completeGossipIntent(initiator, target, tick),
  processRumorDecay: (tick: number) =>
    getNpcSocialAutonomy().processRumorDecay(tick),
  initiateNpcTrade: (trader: NPC, partner: NPC, tick: number) =>
    getNpcSocialAutonomy().initiateNpcTrade(trader, partner, tick),
  getCompletedTrades: (npcId: string) =>
    getNpcSocialAutonomy().getCompletedTrades(npcId),
  clearAll: () =>
    getNpcSocialAutonomy().clearAll()
};
