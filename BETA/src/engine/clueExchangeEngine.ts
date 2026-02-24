/**
 * clueExchangeEngine.ts - M51-B1: Interrogative Dialogue & Evidence Presentation
 * 
 * Implements the clue presentation mechanic where players can present evidence to NPCs
 * during dialogue, triggering belief state changes and forced revelations.
 */

import type { WorldState, NPC } from './worldEngine';
import { Event } from '../events/mutationLog';

export type ClueReliability = 'unreliable' | 'probable' | 'certain';

export interface ClueItem {
  id: string;
  name: string;
  description: string;
  reliability: ClueReliability;
  relevantTopics: string[];  // Investigation chains this clue relates to
  contradicts?: string[];    // Other clue IDs this contradicts
}

export interface NpcBelief {
  beliefId: string;
  content: string;
  confidence: number;  // 0-100
  isRumor: boolean;
  source?: string;
  contradictingClues?: string[];
}

export interface ClueExchangeResult {
  npcId: string;
  clueId: string;
  beliefId: string;
  beliefResolved: boolean;
  newBeliefs?: string[];      // New facts revealed
  relationships?: 'trust' | 'distrust' | 'neutral';
  events: Event[];
}

/**
 * M51-B1: Check if NPC accepts a clue as valid evidence
 * Returns belief system impact and triggered revelations
 */
export function presentClueToNpc(
  state: WorldState,
  npcId: string,
  clue: ClueItem,
  targetBeliefId: string
): ClueExchangeResult {
  const npc = state.npcs.find(n => n.id === npcId);
  const events: Event[] = [];

  if (!npc) {
    return {
      npcId,
      clueId: clue.id,
      beliefId: targetBeliefId,
      beliefResolved: false,
      events: [{
        id: `clue-exchange-failed-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'player',
        type: 'CLUE_EXCHANGE_NPC_NOT_FOUND',
        payload: { npcId, clueId: clue.id },
        timestamp: Date.now()
      }]
    };
  }

  // Get NPC's current belief about the topic
  const npcBelief = (npc as any).beliefs?.[targetBeliefId];
  if (!npcBelief) {
    return {
      npcId,
      clueId: clue.id,
      beliefId: targetBeliefId,
      beliefResolved: false,
      events: [{
        id: `clue-exchange-no-belief-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'player',
        type: 'CLUE_EXCHANGE_NO_TARGET_BELIEF',
        payload: { npcId, clueId: clue.id, targetBeliefId },
        timestamp: Date.now()
      }]
    };
  }

  // Determine if clue is relevant and reliable enough
  const isRelevant = clue.relevantTopics.some(topic =>
    npcBelief.content.toLowerCase().includes(topic.toLowerCase())
  );

  if (!isRelevant) {
    return {
      npcId,
      clueId: clue.id,
      beliefId: targetBeliefId,
      beliefResolved: false,
      events: [{
        id: `clue-exchange-irrelevant-${Date.now()}`,
        worldInstanceId: state.id,
        actorId: 'player',
        type: 'CLUE_EXCHANGE_IRRELEVANT',
        payload: { npcId, clueId: clue.id, npcBelief: npcBelief.content },
        timestamp: Date.now()
      }]
    };
  }

  // Process the clue based on reliability
  let beliefResolved = false;
  let relationshipImpact: 'trust' | 'distrust' | 'neutral' = 'neutral';
  const newBeliefs: string[] = [];

  if (clue.reliability === 'certain') {
    // Certain clue forces belief change
    beliefResolved = true;
    relationshipImpact = 'trust';  // NPC trusts player for solid evidence
    
    // Mark contradicting beliefs as false
    if (clue.contradicts) {
      for (const contradictedClueId of clue.contradicts) {
        (npc as any).beliefs = (npc as any).beliefs || {};
        if ((npc as any).beliefs[contradictedClueId]) {
          (npc as any).beliefs[contradictedClueId].confidence = 0;
          (npc as any).beliefs[contradictedClueId].isRumor = true;
        }
      }
    }
  } else if (clue.reliability === 'probable') {
    // Probable clue reduces confidence in rumor
    beliefResolved = npcBelief.confidence < 50;  // Resolves if NPC was already doubting
    relationshipImpact = beliefResolved ? 'trust' : 'neutral';
    npcBelief.confidence = Math.max(0, npcBelief.confidence - 30);
  } else {
    // Unreliable clue increases suspicion
    relationshipImpact = 'distrust';
    npcBelief.confidence = Math.min(100, npcBelief.confidence + 20);
  }

  // Emit clue exchange event
  const exchangeEvent: Event = {
    id: `clue-exchange-${npcId}-${clue.id}-${Date.now()}`,
    worldInstanceId: state.id,
    actorId: 'player',
    type: 'CLUE_EXCHANGE_PRESENTED',
    payload: {
      npcId,
      npcName: npc.name,
      clueId: clue.id,
      clueName: clue.name,
      reliability: clue.reliability,
      beliefResolved,
      relationshipChange: relationshipImpact,
      targetedBelief: npcBelief.content
    },
    timestamp: Date.now()
  };
  events.push(exchangeEvent);

  // If belief resolved, emit revelation event
  if (beliefResolved) {
    const revelationEvent: Event = {
      id: `belief-resolved-${npcId}-${targetBeliefId}-${Date.now()}`,
      worldInstanceId: state.id,
      actorId: npcId,
      type: 'BELIEF_RESOLVED',
      payload: {
        npcId,
        npcName: npc.name,
        resolvedBelief: npcBelief.content,
        revealedTruths: newBeliefs
      },
      timestamp: Date.now()
    };
    events.push(revelationEvent);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ClueExchange] ${npc.name} resolved false belief thanks to ${clue.name}`);
    }
  }

  // Update player reputation slightly
  if (relationshipImpact !== 'neutral') {
    const reputationDelta = relationshipImpact === 'trust' ? 5 : -3;
    (state.player as any).factionReputation = (state.player as any).factionReputation || {};
    if ((npc as any).factionId) {
      (state.player as any).factionReputation[(npc as any).factionId] = 
        ((state.player as any).factionReputation[(npc as any).factionId] || 0) + reputationDelta;
    }
  }

  return {
    npcId,
    clueId: clue.id,
    beliefId: targetBeliefId,
    beliefResolved,
    newBeliefs,
    relationships: relationshipImpact,
    events
  };
}

/**
 * M51-B1: Get NPCs who hold a specific belief
 */
export function getNpcsWithBelief(state: WorldState, beliefId: string): NPC[] {
  return state.npcs.filter(npc => {
    const npcBelief = (npc as any).beliefs?.[beliefId];
    return npcBelief && npcBelief.confidence > 30;  // Holds belief with moderate confidence
  });
}

/**
 * M51-B1: Get clues that would resolve a belief
 */
export function getCluesThatResolveBelief(
  clues: ClueItem[],
  npcBelief: NpcBelief
): ClueItem[] {
  return clues.filter(clue => {
    // Clue is relevant to the belief topic
    const isRelevant = clue.relevantTopics.some(topic =>
      npcBelief.content.toLowerCase().includes(topic.toLowerCase())
    );
    
    // Clue contradicts the false belief (explicit or certainty-based)
    const contradicts = clue.contradicts?.includes(npcBelief.beliefId) || 
                       clue.reliability === 'certain';
    
    return isRelevant && contradicts;
  });
}

/**
 * M51-B1: Generate a "hardFact" from resolved belief
 */
export function generateHardFactFromResolution(
  npc: NPC,
  resolvedBelief: NpcBelief
): { factId: string; content: string } {
  const facts: Record<string, string> = {
    'TRAITOR_LOCATION': `${npc.name} remembers seeing the traitor at [LOCATION].`,
    'HIDDEN_STASH': `${npc.name} reveals a hidden cache of supplies near ${npc.locationId}.`,
    'FACTION_SECRET': `${npc.name} confesses a faction secret: "The leaders plan..."`,
    'ESCAPED_PRISONER': `${npc.name} admits they helped an escaped prisoner escape via [ROUTE].`,
    'CORRUPTED_OFFICIAL': `${npc.name} identifies a corrupt official in the settlement.`
  };

  const factKey = Object.keys(facts)[Math.floor(Math.random() * Object.keys(facts).length)];
  
  return {
    factId: `hard-fact-${npc.id}-${Date.now()}`,
    content: facts[factKey] || `${npc.name} reveals a shocking truth after reconsidering their belief.`
  };
}

export const ClueExchangeEngineExports = {
  presentClueToNpc,
  getNpcsWithBelief,
  getCluesThatResolveBelief,
  generateHardFactFromResolution
};
