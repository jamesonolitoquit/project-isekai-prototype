/**
 * investigationPipelineEngine.ts - M46-A2: Investigation & Discovery Chain System
 * Manages investigation sequences to uncover hard facts from rumors and contradictions.
 */

import { SeededRng } from './prng';
import { getBeliefEngine } from './beliefEngine';
import type { WorldState } from './worldEngine';

export interface ClueItem {
  id: string;
  clueType: 'evidence' | 'testimony' | 'physical_object' | 'location_hint' | 'npc_statement';
  description: string;
  reliability: number;
  sourceNpcId?: string;
  linkedRumorId?: string;
  contradicts?: string[];
  confirms?: string[];
  discoveredAt?: number;
}

export interface ClueContradiction {
  id: string;
  clueId1: string;
  clueId2: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  resolved: boolean;
  resolution?: string;
}

export interface Investigation {
  id: string;
  investigationTitle: string;
  targetRumorId: string;
  targetHardFactId?: string;
  initiatorNpcId?: string;
  status: 'active' | 'paused' | 'resolved' | 'abandoned' | 'failed';
  cluesDiscovered: ClueItem[];
  contradictions: ClueContradiction[];
  confidenceLevel: number;
  conclusionText?: string;
  resolvedToHardFact: boolean;
  startedAt: number;
  completedAt?: number;
  progressPercentage: number;
}

export interface InvestigationChain {
  id: string;
  chainName: string;
  investigations: Investigation[];
  finalConclusion?: string;
  chainProgress: number;
  factionReputationImpact: Record<string, number>;
}

class InvestigationPipelineEngine {
  private investigations: Map<string, Investigation> = new Map();
  private clues: Map<string, ClueItem> = new Map();
  private contradictions: Map<string, ClueContradiction> = new Map();
  private chains: Map<string, InvestigationChain> = new Map();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
  }

  createInvestigation(
    rumorId: string,
    targetHardFactId?: string,
    initiatorNpcId?: string
  ): Investigation {
    const investigation: Investigation = {
      id: `inv_${rumorId}_${Date.now()}`,
      investigationTitle: `Investigation into Rumor ${rumorId}`,
      targetRumorId: rumorId,
      targetHardFactId,
      initiatorNpcId,
      status: 'active',
      cluesDiscovered: [],
      contradictions: [],
      confidenceLevel: 0,
      resolvedToHardFact: false,
      startedAt: this.rng.nextInt(0, 100000),
      progressPercentage: 0
    };

    this.investigations.set(investigation.id, investigation);
    return investigation;
  }

  discoverClue(
    investigationId: string,
    clue: ClueItem
  ): boolean {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return false;

    this.clues.set(clue.id, clue);
    investigation.cluesDiscovered.push(clue);

    this.detectContradictions(investigationId, clue);
    this.updateConfidence(investigationId);
    this.updateProgress(investigationId);

    return true;
  }

  private detectContradictions(investigationId: string, newClue: ClueItem): void {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return;

    investigation.cluesDiscovered.forEach(existingClue => {
      if (existingClue.id !== newClue.id && this.doCluesContradict(existingClue, newClue)) {
        const contradiction: ClueContradiction = {
          id: `cont_${existingClue.id}_${newClue.id}`,
          clueId1: existingClue.id,
          clueId2: newClue.id,
          description: `Clue "${existingClue.description}" contradicts "${newClue.description}"`,
          severity: this.calculateSeverity(existingClue, newClue),
          resolved: false
        };

        this.contradictions.set(contradiction.id, contradiction);
        investigation.contradictions.push(contradiction);
      }

      if (newClue.confirms?.includes(existingClue.id)) {
        this.resolveContradiction(investigationId, existingClue.id, newClue.id);
      }
    });
  }

  private doCluesContradict(clue1: ClueItem, clue2: ClueItem): boolean {
    const contradictionThreshold = 0.5;

    if (clue1.contradicts?.includes(clue2.id) || clue2.contradicts?.includes(clue1.id)) {
      return true;
    }

    if (clue1.clueType === 'testimony' && clue2.clueType === 'testimony') {
      const reliabilityDiff = Math.abs(clue1.reliability - clue2.reliability);
      return reliabilityDiff > contradictionThreshold;
    }

    return false;
  }

  private calculateSeverity(clue1: ClueItem, clue2: ClueItem): 'minor' | 'moderate' | 'severe' {
    const reliabilityDiff = Math.abs(clue1.reliability - clue2.reliability);

    if (reliabilityDiff > 0.8) return 'severe';
    if (reliabilityDiff > 0.5) return 'moderate';
    return 'minor';
  }

  private resolveContradiction(investigationId: string, clueId1: string, clueId2: string): void {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return;

    investigation.contradictions = investigation.contradictions.filter(c => {
      if ((c.clueId1 === clueId1 && c.clueId2 === clueId2) ||
          (c.clueId1 === clueId2 && c.clueId2 === clueId1)) {
        c.resolved = true;
        c.resolution = `Contradiction resolved through corroborating evidence.`;
        return false;
      }
      return true;
    });
  }

  private updateConfidence(investigationId: string): void {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return;

    const clueCount = investigation.cluesDiscovered.length;
    const unresolvedContradictions = investigation.contradictions.filter(c => !c.resolved).length;

    let confidence = 0;
    confidence += clueCount * 8;
    confidence -= unresolvedContradictions * 15;

    const avgReliability = investigation.cluesDiscovered.length > 0
      ? investigation.cluesDiscovered.reduce((sum, c) => sum + c.reliability, 0) / investigation.cluesDiscovered.length
      : 0;

    confidence *= avgReliability;

    investigation.confidenceLevel = Math.min(100, Math.max(0, confidence));
  }

  private updateProgress(investigationId: string): void {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return;

    const baseProgress = investigation.cluesDiscovered.length * 10;
    const confidenceBonus = investigation.confidenceLevel / 2;
    const contradictionPenalty = investigation.contradictions.length * 5;

    investigation.progressPercentage = Math.min(100, Math.max(0, baseProgress + confidenceBonus - contradictionPenalty));

    if (investigation.progressPercentage >= 80) {
      investigation.status = 'resolved';
      investigation.completedAt = this.rng.nextInt(0, 100000);
      investigation.resolvedToHardFact = true;
    }
  }

  resolveInvestigation(
    investigationId: string,
    hardFactText: string
  ): boolean {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return false;

    investigation.status = 'resolved';
    investigation.conclusionText = hardFactText;
    investigation.resolvedToHardFact = true;
    investigation.completedAt = this.rng.nextInt(0, 100000);

    if (investigation.targetHardFactId) {
      const beliefEngine = getBeliefEngine();
      beliefEngine.recordHardFact({
        id: investigation.targetHardFactId,
        description: hardFactText,
        discoveryMethod: 'investigation',
        trustworthiness: investigation.confidenceLevel / 100,
        discoveredAtTick: this.rng.nextInt(0, 100000)
      } as any);
    }

    return true;
  }

  pauseInvestigation(investigationId: string): boolean {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return false;

    investigation.status = 'paused';
    return true;
  }

  resumeInvestigation(investigationId: string): boolean {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return false;

    investigation.status = 'active';
    return true;
  }

  abandonInvestigation(investigationId: string): boolean {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return false;

    investigation.status = 'abandoned';
    investigation.completedAt = this.rng.nextInt(0, 100000);
    return true;
  }

  getInvestigation(investigationId: string): Investigation | undefined {
    return this.investigations.get(investigationId);
  }

  getClue(clueId: string): ClueItem | undefined {
    return this.clues.get(clueId);
  }

  getAllCluesInInvestigation(investigationId: string): ClueItem[] {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return [];
    return investigation.cluesDiscovered;
  }

  getContradictions(investigationId: string): ClueContradiction[] {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return [];
    return investigation.contradictions;
  }

  createInvestigationChain(chainName: string): InvestigationChain {
    const chain: InvestigationChain = {
      id: `chain_${Date.now()}`,
      chainName,
      investigations: [],
      chainProgress: 0,
      factionReputationImpact: {}
    };

    this.chains.set(chain.id, chain);
    return chain;
  }

  addInvestigationToChain(chainId: string, investigationId: string): boolean {
    const chain = this.chains.get(chainId);
    const investigation = this.investigations.get(investigationId);

    if (!chain || !investigation) return false;

    chain.investigations.push(investigation);
    this.updateChainProgress(chainId);

    return true;
  }

  private updateChainProgress(chainId: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;

    if (chain.investigations.length === 0) {
      chain.chainProgress = 0;
      return;
    }

    const avgProgress = chain.investigations.reduce((sum, inv) => sum + inv.progressPercentage, 0) / chain.investigations.length;
    chain.chainProgress = avgProgress;
  }

  getChain(chainId: string): InvestigationChain | undefined {
    return this.chains.get(chainId);
  }

  getAllInvestigations(): Investigation[] {
    return Array.from(this.investigations.values());
  }

  clearInvestigations(): void {
    this.investigations.clear();
    this.clues.clear();
    this.contradictions.clear();
    this.chains.clear();
  }

  reset(): void {
    this.investigations.clear();
    this.clues.clear();
    this.contradictions.clear();
    this.chains.clear();
  }
}

let investigationEngineInstance: InvestigationPipelineEngine | null = null;

export function getInvestigationPipeline(seed: number = 12345): InvestigationPipelineEngine {
  if (!investigationEngineInstance) {
    investigationEngineInstance = new InvestigationPipelineEngine(seed);
  }
  return investigationEngineInstance;
}

export function resetInvestigationPipeline(): void {
  if (investigationEngineInstance) {
    investigationEngineInstance.reset();
    investigationEngineInstance = null;
  }
}

export const InvestigationPipelineExports = {
  getInvestigationPipeline,
  resetInvestigationPipeline
};
