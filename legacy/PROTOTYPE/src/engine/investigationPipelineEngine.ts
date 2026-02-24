/**
 * M46-A2: Investigation Pipeline Engine
 * 
 * Purpose: Create discovery chains where players investigate rumors to uncover hard facts.
 * 
 * Mechanics:
 * - Player accepts a rumor-investigation quest
 * - Each NPC interaction/location clue adds evidence
 * - Evidence accumulates toward the hard fact
 * - When threshold reached, hard fact is revealed
 * - NPC dialogue adapts based on evidence gathered
 */

import type { WorldState, NPC } from './worldEngine';
import { getBeliefEngine, type HardFact, type Rumor } from './beliefEngine';

/**
 * Investigation state: tracks what player has discovered about a rumor
 */
export interface Investigation {
  id: string;
  questId: string; // Link to rumor investigation quest
  rumorId: string;
  hardFactId: string; // The truth being investigated
  
  // Evidence gathering
  evidenceItems: ClueItem[]; // Collected evidence pieces
  evidenceStrength: number; // 0-100: how much evidence accumulated
  confidenceInTruth: number; // 0-100: how sure is player of true fact?
  
  // NPC interactions
  npcsInterviewed: string[]; // NPC IDs player talked to
  npcCluesByNpc: Record<string, string[]>; // NPC ID -> clue IDs they provided
  contradictions: ClueContradiction[]; // When NPC statements conflict
  
  // Locations investigated
  locationsVisited: string[];
  physicalEvidenceFound: string[]; // Artifact/item IDs found in locations
  
  // Investigation state
  status: 'active' | 'stalled' | 'solved' | 'abandoned';
  createdAt: number;
  lastInteractionAt: number;
  revelationAt?: number; // When hard fact was revealed
}

/**
 * A clue is a piece of evidence pointing toward/away from the truth
 */
export interface ClueItem {
  id: string;
  source: 'npc_dialogue' | 'location_search' | 'artifact_inspection' | 'memory_recall';
  sourceId: string; // NPC ID, location ID, item ID, etc.
  description: string; // What the clue reveals
  confidenceBonus: number; // 0-100: how much does this point toward truth?
  contradicts?: string[]; // IDs of other clues this contradicts
  discoveredAt: number;
}

/**
 * When NPCs tell different stories
 */
export interface ClueContradiction {
  id: string;
  npcIds: string[]; // Which NPCs contradict each other?
  clueIds: string[]; // Which clues contradict?
  description: string; // What's the contradiction?
  resolutionRequired: boolean; // Does player need to resolve this?
}

/**
 * Investigation evidence threshold system
 */
const INVESTIGATION_THRESHOLDS = {
  SUSPICIOUS: 25,      // Enough to suspect something
  COMPELLING: 50,      // Strong evidence
  CONVINCING: 75,      // Nearly certain
  ABSOLUTE: 100        // Proven beyond doubt
};

class InvestigationPipelineImpl {
  private investigations: Map<string, Investigation> = new Map();
  private clueLibrary: Map<string, ClueItem[]> = new Map(); // Fact ID -> possible clues
  private npcTestimonies: Map<string, string[]> = new Map(); // NPC ID -> testimony texts
  private locationClues: Map<string, string[]> = new Map(); // Location ID -> clue descriptions

  constructor() {
    this.initializeClueLibrary();
  }

  /**
   * Initialize the library of possible clues for each fact type
   */
  private initializeClueLibrary(): void {
    // For death facts
    this.clueLibrary.set('death', [
      {
        id: 'clue-death-1',
        source: 'npc_dialogue',
        sourceId: 'unknown',
        description: 'An eyewitness describes seeing the victim fall',
        confidenceBonus: 20,
        discoveredAt: 0
      },
      {
        id: 'clue-death-2',
        source: 'artifact_inspection',
        sourceId: 'unknown',
        description: 'Blood-stained clothing confirms the tragedy',
        confidenceBonus: 25,
        discoveredAt: 0
      },
      {
        id: 'clue-death-3',
        source: 'location_search',
        sourceId: 'unknown',
        description: 'Battle markings at the scene tell a story',
        confidenceBonus: 20,
        discoveredAt: 0
      }
    ]);

    // For siege facts
    this.clueLibrary.set('siege', [
      {
        id: 'clue-siege-1',
        source: 'npc_dialogue',
        sourceId: 'unknown',
        description: 'Refugees describe the fortress falling',
        confidenceBonus: 18,
        discoveredAt: 0
      },
      {
        id: 'clue-siege-2',
        source: 'location_search',
        sourceId: 'unknown',
        description: 'Scorched walls show signs of great fire',
        confidenceBonus: 22,
        discoveredAt: 0
      },
      {
        id: 'clue-siege-3',
        source: 'artifact_inspection',
        sourceId: 'unknown',
        description: 'Military insignias found prove competing armies fought here',
        confidenceBonus: 20,
        discoveredAt: 0
      }
    ]);

    // For miracle facts
    this.clueLibrary.set('miracle', [
      {
        id: 'clue-miracle-1',
        source: 'npc_dialogue',
        sourceId: 'unknown',
        description: 'NPCs describe witnessing the impossible',
        confidenceBonus: 25,
        discoveredAt: 0
      },
      {
        id: 'clue-miracle-2',
        source: 'location_search',
        sourceId: 'unknown',
        description: 'Unnatural phenomena remain visible at the site',
        confidenceBonus: 30,
        discoveredAt: 0
      }
    ]);

    // For betrayal facts
    this.clueLibrary.set('betrayal', [
      {
        id: 'clue-betrayal-1',
        source: 'npc_dialogue',
        sourceId: 'unknown',
        description: 'An accomplice reveals the treachery',
        confidenceBonus: 35,
        discoveredAt: 0
      },
      {
        id: 'clue-betrayal-2',
        source: 'artifact_inspection',
        sourceId: 'unknown',
        description: 'Forged documents prove the deception',
        confidenceBonus: 28,
        discoveredAt: 0
      },
      {
        id: 'clue-betrayal-3',
        source: 'npc_dialogue',
        sourceId: 'unknown',
        description: 'The victim\'s ally admits they suspected treachery',
        confidenceBonus: 15,
        discoveredAt: 0
      }
    ]);
  }

  /**
   * Start a new investigation based on a rumor
   */
  startInvestigation(
    questId: string,
    rumor: Rumor,
    hardFact: HardFact,
    currentTick: number
  ): Investigation {
    const investigation: Investigation = {
      id: `inv_${questId}_${currentTick}`,
      questId,
      rumorId: rumor.id,
      hardFactId: hardFact.id,
      evidenceItems: [],
      evidenceStrength: 0,
      confidenceInTruth: rumor.confidenceLevel, // Start with rumor's confidence
      npcsInterviewed: [],
      npcCluesByNpc: {},
      contradictions: [],
      locationsVisited: [],
      physicalEvidenceFound: [],
      status: 'active',
      createdAt: currentTick,
      lastInteractionAt: currentTick
    };

    this.investigations.set(investigation.id, investigation);
    return investigation;
  }

  /**
   * Player interviews an NPC about the investigation
   * NPC provides testimony with varying reliability
   */
  interviewNpc(
    investigationId: string,
    npcId: string,
    npc: NPC,
    state: WorldState,
    currentTick: number
  ): {
    testimony: string;
    clueAdded: ClueItem;
    contradictionDetected: ClueContradiction | null;
  } {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) {
      throw new Error(`Investigation ${investigationId} not found`);
    }

    // Mark NPC as interviewed
    if (!investigation.npcsInterviewed.includes(npcId)) {
      investigation.npcsInterviewed.push(npcId);
      investigation.npcCluesByNpc[npcId] = [];
    }

    // Generate testimony based on NPC personality + what they witnessed
    const testimony = this.generateNpcTestimony(
      investigation,
      npcId,
      npc,
      state
    );

    // Extract a clue from the testimony
    const clue = this.extractClueFromTestimony(
      investigation,
      npcId,
      testimony,
      currentTick
    );

    // Check if this contradicts previous evidence
    const contradiction = this.checkForContradictions(investigation, clue);

    // Add clue to investigation
    investigation.evidenceItems.push(clue);
    investigation.npcCluesByNpc[npcId].push(clue.id);
    investigation.evidenceStrength += clue.confidenceBonus;
    investigation.lastInteractionAt = currentTick;

    // Update confidence in truth
    if (!contradiction) {
      investigation.confidenceInTruth += clue.confidenceBonus * 0.5;
    } else {
      // Contradictions lower confidence slightly but increase mystery
      investigation.confidenceInTruth += clue.confidenceBonus * 0.2;
    }

    investigation.confidenceInTruth = Math.min(100, investigation.confidenceInTruth);

    // Check if investigation should be marked as solved
    this.updateInvestigationStatus(investigation);

    return {
      testimony,
      clueAdded: clue,
      contradictionDetected: contradiction
    };
  }

  /**
   * Generate unique NPC testimony
   */
  private generateNpcTestimony(
    investigation: Investigation,
    npcId: string,
    npc: NPC,
    state: WorldState
  ): string {
    const beliefEngine = getBeliefEngine();
    const hardFact = beliefEngine.getRegistry().hardFacts[investigation.hardFactId];

    if (!hardFact) {
      return `${npc.name}]: I... I don't know much about what happened.`;
    }

    // Generate testimony based on:
    // 1. NPC's faction alignment with the hard fact
    // 2. Whether NPC was near the event
    // 3. Their personality traits

    const testimonies: Record<string, string[]> = {
      aligned: [
        `${npc.name}]: I know the truth about ${hardFact.description}. We saw it happen.`,
        `${npc.name}]: The events you're asking about... yes, I witnessed them. It was as they say.`,
        `${npc.name}]: This matter has troubled me greatly. The truth is...`
      ],
      unaligned: [
        `${npc.name}]: I can only tell you what I heard, which may be wrong...`,
        `${npc.name}]: The rumor at the tavern says ${hardFact.description}, but who knows?`,
        `${npc.name}]: I was far away, but I have my suspicions about what occurred.`
      ],
      contradictory: [
        `${npc.name}]: That's not what happened at all! The true story is completely different.`,
        `${npc.name}]: Everyone's lying about this. Let me tell you what really happened.`,
        `${npc.name}]: The official story is nonsense. The truth is far more complicated.`
      ]
    };

    // Choose testimony type based on NPC faction alignment
    const factionAlignment = npc.factionId === hardFact.factionIds?.[0] ? 'aligned' : 
                            npc.factionId === hardFact.factionIds?.[1] ? 'contradictory' : 
                            'unaligned';

    const availableTestimonies = testimonies[factionAlignment];
    return availableTestimonies[Math.floor(Math.random() * availableTestimonies.length)];
  }

  /**
   * Extract a clue from NPC testimony
   */
  private extractClueFromTestimony(
    investigation: Investigation,
    npcId: string,
    testimony: string,
    currentTick: number
  ): ClueItem {
    // Get possible clues for this fact type
    const factType = investigation.hardFactId.split('_')[0] || 'discovery';
    const possibleClues = this.clueLibrary.get(factType) || [];

    if (possibleClues.length === 0) {
      return {
        id: `clue_${npcId}_${currentTick}`,
        source: 'npc_dialogue',
        sourceId: npcId,
        description: testimony,
        confidenceBonus: 15,
        discoveredAt: currentTick
      };
    }

    // Pick a clue type that hasn't been discovered yet
    const unusedClues = possibleClues.filter(
      c => !investigation.evidenceItems.some(ei => ei.id === c.id)
    );

    const selectedClue = unusedClues.length > 0 
      ? unusedClues[Math.floor(Math.random() * unusedClues.length)]
      : possibleClues[Math.floor(Math.random() * possibleClues.length)];

    return {
      ...selectedClue,
      id: `clue_${npcId}_${currentTick}`,
      sourceId: npcId,
      description: testimony,
      discoveredAt: currentTick
    };
  }

  /**
   * Check if clue contradicts existing evidence
   */
  private checkForContradictions(
    investigation: Investigation,
    newClue: ClueItem
  ): ClueContradiction | null {
    // Check if this clue contradicts previous ones
    for (const existingClue of investigation.evidenceItems) {
      // Different NPC testimony often contradicts
      if (existingClue.source === 'npc_dialogue' && newClue.source === 'npc_dialogue') {
        if (existingClue.sourceId !== newClue.sourceId) {
          // Probability of contradiction based on evidence strength
          if (Math.random() < 0.25) {
            const contradiction: ClueContradiction = {
              id: `contra_${existingClue.id}_${newClue.id}`,
              npcIds: [existingClue.sourceId, newClue.sourceId],
              clueIds: [existingClue.id, newClue.id],
              description: `${existingClue.sourceId} says ${existingClue.description}, but ${newClue.sourceId} says ${newClue.description}`,
              resolutionRequired: true
            };

            if (!investigation.contradictions.find(c => c.id === contradiction.id)) {
              investigation.contradictions.push(contradiction);
            }

            return contradiction;
          }
        }
      }
    }

    return null;
  }

  /**
   * Player searches a location for physical evidence
   */
  searchLocationForClues(
    investigationId: string,
    locationId: string,
    searchDC: number,
    playerPerception: number,
    currentTick: number
  ): ClueItem | null {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return null;

    if (!investigation.locationsVisited.includes(locationId)) {
      investigation.locationsVisited.push(locationId);
    }

    // Location search DC check
    if (playerPerception < searchDC) {
      return null; // Failed to find anything
    }

    // Generate location-based clue
    const clue: ClueItem = {
      id: `clue_loc_${locationId}_${currentTick}`,
      source: 'location_search',
      sourceId: locationId,
      description: `You found evidence at ${locationId} related to the investigation.`,
      confidenceBonus: 20 + (playerPerception - searchDC), // Better search = more confidence
      discoveredAt: currentTick
    };

    investigation.evidenceItems.push(clue);
    investigation.evidenceStrength += clue.confidenceBonus;
    investigation.confidenceInTruth += clue.confidenceBonus * 0.7;
    investigation.lastInteractionAt = currentTick;

    this.updateInvestigationStatus(investigation);

    return clue;
  }

  /**
   * Update investigation status based on evidence accumulated
   */
  private updateInvestigationStatus(investigation: Investigation): void {
    if (investigation.evidenceStrength >= INVESTIGATION_THRESHOLDS.ABSOLUTE) {
      investigation.status = 'solved';
      investigation.revelationAt = investigation.lastInteractionAt;
    } else if (investigation.confidenceInTruth < 10) {
      investigation.status = 'stalled';
    } else {
      investigation.status = 'active';
    }
  }

  /**
   * Get investigation summary for UI display
   */
  getInvestigationSummary(investigationId: string): {
    status: string;
    evidenceCount: number;
    confidenceLevel: string;
    nextSteps: string[];
    contradictions: string[];
  } {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) {
      return {
        status: 'not_found',
        evidenceCount: 0,
        confidenceLevel: 'None',
        nextSteps: [],
        contradictions: []
      };
    }

    const nextSteps: string[] = [];
    
    if (investigation.status !== 'solved') {
      if (investigation.npcsInterviewed.length < 3) {
        nextSteps.push('Interview more NPCs about what they know');
      }
      if (investigation.locationsVisited.length < 2) {
        nextSteps.push('Search key locations for physical evidence');
      }
      if (investigation.contradictions.length > 0) {
        nextSteps.push('Resolve contradictions between testimonies');
      }
    }

    const confidenceLevels = [
      { threshold: 0, label: 'No Confidence' },
      { threshold: INVESTIGATION_THRESHOLDS.SUSPICIOUS, label: 'Suspicious' },
      { threshold: INVESTIGATION_THRESHOLDS.COMPELLING, label: 'Compelling Evidence' },
      { threshold: INVESTIGATION_THRESHOLDS.CONVINCING, label: 'Convincing' },
      { threshold: INVESTIGATION_THRESHOLDS.ABSOLUTE, label: 'Proof' }
    ];

    let confidenceLabel = 'No Confidence';
    for (let i = confidenceLevels.length - 1; i >= 0; i--) {
      if (investigation.confidenceInTruth >= confidenceLevels[i].threshold) {
        confidenceLabel = confidenceLevels[i].label;
        break;
      }
    }

    return {
      status: investigation.status,
      evidenceCount: investigation.evidenceItems.length,
      confidenceLevel: confidenceLabel,
      nextSteps,
      contradictions: investigation.contradictions.map(c => c.description)
    };
  }

  /**
   * Get all active investigations
   */
  getActiveInvestigations(): Investigation[] {
    return Array.from(this.investigations.values())
      .filter(i => i.status === 'active');
  }

  /**
   * Abandon investigation
   */
  abandonInvestigation(investigationId: string): void {
    const investigation = this.investigations.get(investigationId);
    if (investigation) {
      investigation.status = 'abandoned';
    }
  }

  /**
   * Reveal hard fact to player (completes investigation)
   */
  revealHardFact(investigationId: string): HardFact | null {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return null;

    const beliefEngine = getBeliefEngine();
    const hardFact = beliefEngine.getRegistry().hardFacts[investigation.hardFactId];

    if (hardFact) {
      investigation.status = 'solved';
      investigation.revelationAt = investigation.lastInteractionAt;
      
      // Remove rumor from belief layer and record hard fact as known
      // Player has now moved from Rumor Tier to Hard Fact tier
    }

    return hardFact || null;
  }

  /**
   * Clear all investigations (for new epoch)
   */
  clearAllInvestigations(): void {
    this.investigations.clear();
  }
}

// Singleton instance
let instance: InvestigationPipelineImpl | null = null;

export function getInvestigationPipeline(): InvestigationPipelineImpl {
  if (!instance) {
    instance = new InvestigationPipelineImpl();
  }
  return instance;
}

/**
 * Convenience exports
 */
export const investigationPipeline = {
  startInvestigation: (questId: string, rumor: Rumor, hardFact: HardFact, tick: number) =>
    getInvestigationPipeline().startInvestigation(questId, rumor, hardFact, tick),
  interviewNpc: (invId: string, npcId: string, npc: NPC, state: WorldState, tick: number) =>
    getInvestigationPipeline().interviewNpc(invId, npcId, npc, state, tick),
  searchLocationForClues: (invId: string, locId: string, dc: number, perception: number, tick: number) =>
    getInvestigationPipeline().searchLocationForClues(invId, locId, dc, perception, tick),
  getInvestigationSummary: (invId: string) =>
    getInvestigationPipeline().getInvestigationSummary(invId),
  getActiveInvestigations: () =>
    getInvestigationPipeline().getActiveInvestigations(),
  abandonInvestigation: (invId: string) =>
    getInvestigationPipeline().abandonInvestigation(invId),
  revealHardFact: (invId: string) =>
    getInvestigationPipeline().revealHardFact(invId),
  clearAllInvestigations: () =>
    getInvestigationPipeline().clearAllInvestigations()
};
