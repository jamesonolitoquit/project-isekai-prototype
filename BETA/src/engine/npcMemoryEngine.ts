/**
 * npcMemoryEngine.ts - M44-T1/C1: Universal NPC Memory System
 * Manages all NPC interactions, social scars, and relationship tiering.
 */

import { SeededRng } from './prng';
import type { NPC, WorldState } from './worldEngine';

export interface UniversalInteraction {
  id: string;
  npc1Id: string;
  npc2Id: string;
  interactionType: 'conversation' | 'combat' | 'alliance' | 'betrayal' | 'trade' | 'romance' | 'conflict' | 'aid';
  description: string;
  tick: number;
  emotionalContext: Record<string, number>;
  consequence?: string;
  wasPositive: boolean;
  impactOnRelationship: number;
  gossipReliability: number;
}

export interface SocialScar {
  id: string;
  npcId: string;
  scarType: 'trauma' | 'betrayal' | 'shame' | 'regret' | 'guilt';
  description: string;
  severity: number;
  causedByNpcId?: string;
  apparitionChance: number;
  activeEffects: string[];
  healingProgress: number;
  createdAt: number;
}

export interface RelationshipTierData {
  npc1Id: string;
  npc2Id: string;
  tier: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'allied' | 'intimate';
  relationshipScore: number;
  mutualMemories: UniversalInteraction[];
  mutualScars: SocialScar[];
  trustLevel: number;
  communicationHistory: Array<{
    tick: number;
    content: string;
    tone: 'positive' | 'negative' | 'neutral';
  }>;
  lastInteractionTick?: number;
}

class NpcMemoryEngine {
  private interactions: Map<string, UniversalInteraction> = new Map();
  private socialScars: Map<string, SocialScar> = new Map();
  private relationships: Map<string, RelationshipTierData> = new Map();
  private gossipLog: Array<{ sourcerId: string; content: string; reliability: number; tick: number; }> = [];
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
  }

  recordInteraction(
    npc1Id: string,
    npc2Id: string,
    type: UniversalInteraction['interactionType'],
    description: string,
    wasPositive: boolean,
    worldState: WorldState
  ): UniversalInteraction {
    const interaction: UniversalInteraction = {
      id: `interaction_${npc1Id}_${npc2Id}_${Date.now()}`,
      npc1Id,
      npc2Id,
      interactionType: type,
      description,
      tick: worldState.tick || 0,
      emotionalContext: this.generateEmotionalContext(type),
      wasPositive,
      impactOnRelationship: wasPositive ? this.rng.nextInt(5, 20) : this.rng.nextInt(-20, -5),
      gossipReliability: this.rng.nextInt(40, 100) / 100
    };

    this.interactions.set(interaction.id, interaction);
    this.updateRelationship(npc1Id, npc2Id, interaction);
    this.propagateGossip(npc1Id, npc2Id, description, interaction.gossipReliability);

    return interaction;
  }

  private generateEmotionalContext(interactionType: UniversalInteraction['interactionType']): Record<string, number> {
    const contexts: Record<UniversalInteraction['interactionType'], Record<string, number>> = {
      'conversation': { joy: 0.3, curiosity: 0.4, trust: 0.3 },
      'combat': { anger: 0.8, fear: 0.5, adrenaline: 0.9 },
      'alliance': { trust: 0.8, hope: 0.6, camaraderie: 0.7 },
      'betrayal': { anger: 0.9, despair: 0.8, distrust: 1.0 },
      'trade': { pragmatism: 0.6, curiosity: 0.3, satisfaction: 0.4 },
      'romance': { affection: 0.9, vulnerability: 0.7, hope: 0.8 },
      'conflict': { anger: 0.7, resentment: 0.6, defensiveness: 0.8 },
      'aid': { gratitude: 0.8, trust: 0.7, camaraderie: 0.6 }
    };

    return contexts[interactionType] || {};
  }

  private updateRelationship(npc1Id: string, npc2Id: string, interaction: UniversalInteraction): void {
    const key = this.getRelationshipKey(npc1Id, npc2Id);
    let relationship = this.relationships.get(key);

    if (!relationship) {
      relationship = {
        npc1Id,
        npc2Id: npc2Id === npc1Id ? npc2Id : npc2Id,
        tier: 'neutral',
        relationshipScore: 0,
        mutualMemories: [],
        mutualScars: [],
        trustLevel: 50,
        communicationHistory: [],
        lastInteractionTick: interaction.tick
      };

      this.relationships.set(key, relationship);
    }

    relationship.mutualMemories.push(interaction);
    relationship.relationshipScore += interaction.impactOnRelationship;
    relationship.trustLevel = Math.min(100, Math.max(0, relationship.trustLevel + (interaction.wasPositive ? 5 : -8)));
    relationship.lastInteractionTick = interaction.tick;

    this.updateRelationshipTier(relationship);
  }

  private updateRelationshipTier(relationship: RelationshipTierData): void {
    const score = relationship.relationshipScore;

    if (score >= 80) {
      relationship.tier = 'intimate';
    } else if (score >= 50) {
      relationship.tier = 'allied';
    } else if (score >= 20) {
      relationship.tier = 'friendly';
    } else if (score >= -20) {
      relationship.tier = 'neutral';
    } else if (score >= -50) {
      relationship.tier = 'wary';
    } else {
      relationship.tier = 'hostile';
    }
  }

  recordSocialScar(
    npcId: string,
    scarType: SocialScar['scarType'],
    description: string,
    causedByNpcId?: string,
    severity: number = 50
  ): SocialScar {
    const scar: SocialScar = {
      id: `scar_${npcId}_${Date.now()}`,
      npcId,
      scarType,
      description,
      severity: Math.min(100, Math.max(0, severity)),
      causedByNpcId,
      apparitionChance: severity / 100,
      activeEffects: this.generateScarEffects(scarType, severity),
      healingProgress: 0,
      createdAt: this.rng.nextInt(0, 100000)
    };

    this.socialScars.set(scar.id, scar);

    if (causedByNpcId) {
      const key = this.getRelationshipKey(npcId, causedByNpcId);
      const relationship = this.relationships.get(key);
      if (relationship) {
        relationship.mutualScars.push(scar);
        relationship.relationshipScore -= severity / 2;
        this.updateRelationshipTier(relationship);
      }
    }

    return scar;
  }

  private generateScarEffects(scarType: SocialScar['scarType'], severity: number): string[] {
    const effects: Record<SocialScar['scarType'], string[]> = {
      'trauma': ['Anxiety in crowds', 'Heightened vigilance', 'Trust issues'],
      'betrayal': ['Paranoia', 'Doubled betrayal sensitivity', 'Isolation tendency'],
      'shame': ['Reduced charisma', 'Avoidance of public places', 'Imposter syndrome'],
      'regret': ['Difficulty making decisions', 'Second-guessing', 'Melancholy'],
      'guilt': ['Self-sabotage tendency', 'Compulsive atonement seeking', 'Self-loathing']
    };

    return effects[scarType] || [];
  }

  healSocialScar(scarId: string, healingAmount: number): void {
    const scar = this.socialScars.get(scarId);
    if (!scar) return;

    scar.healingProgress = Math.min(100, scar.healingProgress + healingAmount);

    if (scar.healingProgress >= 100) {
      this.socialScars.delete(scarId);
    }
  }

  private propagateGossip(source1: string, source2: string, content: string, reliability: number): void {
    this.gossipLog.push({
      sourcerId: source1,
      content: `${content} (from interaction with ${source2})`,
      reliability,
      tick: this.rng.nextInt(0, 100000)
    });

    if (this.gossipLog.length > 1000) {
      this.gossipLog = this.gossipLog.slice(-500);
    }
  }

  getRelationship(npc1Id: string, npc2Id: string): RelationshipTierData | undefined {
    const key = this.getRelationshipKey(npc1Id, npc2Id);
    return this.relationships.get(key);
  }

  private getRelationshipKey(npc1Id: string, npc2Id: string): string {
    return npc1Id < npc2Id ? `${npc1Id}_${npc2Id}` : `${npc2Id}_${npc1Id}`;
  }

  getInteractionsInvolving(npcId: string): UniversalInteraction[] {
    return Array.from(this.interactions.values()).filter(
      i => i.npc1Id === npcId || i.npc2Id === npcId
    );
  }

  getSocialScarsOf(npcId: string): SocialScar[] {
    return Array.from(this.socialScars.values()).filter(s => s.npcId === npcId);
  }

  getAllGossip(): Array<{ sourcerId: string; content: string; reliability: number; tick: number; }> {
    return [...this.gossipLog];
  }

  getGossipReliability(content: string): number {
    const relevant = this.gossipLog.filter(g => g.content.includes(content));
    if (relevant.length === 0) return 0;

    const avgReliability = relevant.reduce((sum, g) => sum + g.reliability, 0) / relevant.length;
    return avgReliability;
  }

  getAllInteractions(): UniversalInteraction[] {
    return Array.from(this.interactions.values());
  }

  getAllRelationships(): RelationshipTierData[] {
    return Array.from(this.relationships.values());
  }

  getAllSocialScars(): SocialScar[] {
    return Array.from(this.socialScars.values());
  }

  clearMemories(): void {
    this.interactions.clear();
    this.socialScars.clear();
    this.relationships.clear();
    this.gossipLog = [];
  }

  reset(): void {
    this.interactions.clear();
    this.socialScars.clear();
    this.relationships.clear();
    this.gossipLog = [];
  }
}

let memoryEngineInstance: NpcMemoryEngine | null = null;

export function getNpcMemoryEngine(seed: number = 12345): NpcMemoryEngine {
  if (!memoryEngineInstance) {
    memoryEngineInstance = new NpcMemoryEngine(seed);
  }
  return memoryEngineInstance;
}

export function resetNpcMemoryEngine(): void {
  if (memoryEngineInstance) {
    memoryEngineInstance.reset();
    memoryEngineInstance = null;
  }
}

export const NpcMemoryEngineExports = {
  getNpcMemoryEngine,
  resetNpcMemoryEngine
};

/**
 * BETA Phase 2: Export all social scars from memory engine to world state format
 * This bridges the internal memory map with the global WorldState for persistence
 */
export function exportSocialScarsToWorldState(engine: NpcMemoryEngine): any[] {
  return Array.from(engine.getAllSocialScars());
}

/**
 * BETA Phase 2: Hydrate social scars from world state back into memory engine
 * Call this when loading a saved game to restore psychological state
 */
export function hydrateScarsFromWorldState(engine: NpcMemoryEngine, scars: any[]): void {
  if (!Array.isArray(scars)) return;
  
  for (const scar of scars) {
    if (!scar.id || !scar.npcId) continue;
    engine.recordSocialScar(
      scar.npcId,
      scar.scarType || 'regret',
      scar.description || 'Unknown scar',
      scar.causedByNpcId,
      scar.severity || 50
    );
  }
}

/**
 * Get all scars from an NPC by their ID (for NPC context loading)
 */
export function getNpcSocialScars(engine: NpcMemoryEngine, npcId: string): any[] {
  return engine.getSocialScarsOf(npcId);
}

