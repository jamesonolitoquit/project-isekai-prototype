/**
 * M45-B2: Narrative Whisper Engine
 * 
 * Purpose: Inject "Visions" or "Intuition" directly into the player's log that are
 * derived from hidden truths they haven't discovered yet.
 * 
 * The AI DM can use this to provide diegetic feedback that feels like:
 * - Divine inspiration from deities
 * - Precognitive visions
 * - Psychic hunches
 * - Ancient mystical knowledge
 * - NPC memories you somehow access
 * 
 * These whispers are NOT cheating - they're game-assisted storytelling that:
 * 1. Hints at world truths without spoiling them
 * 2. Creates narrative tension and mystery
 * 3. Guides players toward interesting content
 * 4. Feels like the world is responding to your character
 */

import type { WorldState, PlayerState, WhisperType } from './worldEngine';
import { getBeliefEngine, type HardFact, type Rumor } from './beliefEngine';
import { random } from './prng';

/**
 * A narrative whisper: Vague hints about world truths
 */
export interface NarrativeWhisper {
  id: string;
  type: 'vision' | 'intuition' | 'prophecy' | 'memory' | 'resonance' | 'echo';
  description: string; // The vague hint
  relatedFactId: string; // Which hard fact does this relate to?
  mysticalOrigin: 'divine' | 'psychic' | 'arcane' | 'ancestral' | 'fey' | 'demonic';
  confidenceHint: number; // 0-100: How strongly does the whisper hint at the truth?
  
  // Clarity levels: full truth heavily obfuscated
  clarityLevel: 'veiled' | 'ambiguous' | 'clear';
  
  // Timing
  triggeredAt: number; // World tick this whisper was triggered
  maxReveals: number; // How many times can this whisper reveal itself?
  timesRevealed: number; // How many times has player seen it?
  
  // Emotional impact
  emotionalTone: 'ominous' | 'hopeful' | 'mysterious' | 'sorrowful' | 'urgent' | 'peaceful';
  playerReactionHint?: string; // Suggested emotional reaction
}

/**
 * Template for generating whispers about specific fact types
 */
interface WhisperTemplate {
  factType: 'death' | 'siege' | 'miracle' | 'catastrophe' | 'discovery' | 'treaty' | 'betrayal';
  whisperType: 'vision' | 'intuition' | 'prophecy' | 'memory' | 'resonance';
  veiledDescriptions: string[];
  ambiguousDescriptions: string[];
  clearDescriptions: string[];
  emotionalTones: string[];
}

class NarrativeWhisperEngineImpl {
  private whispers: Map<string, NarrativeWhisper> = new Map();
  private playerWhisperLog: Map<string, string[]> = new Map(); // Player ID -> Whisper IDs seen

  /**
   * Generate a narrative whisper based on a hidden fact
   * The whisper is vague enough to intrigue without revealing the truth
   */
  generateWhisperForFact(
    playerId: string,
    fact: HardFact,
    state: WorldState,
    clarityLevel: 'veiled' | 'ambiguous' | 'clear' = 'veiled'
  ): NarrativeWhisper {
    const template = this.getTemplateForFactType(fact.eventType);
    
    // Choose obscured description based on clarity level
    let description: string;
    if (clarityLevel === 'veiled') {
      description = template.veiledDescriptions[
        Math.floor(Math.random() * template.veiledDescriptions.length)
      ];
    } else if (clarityLevel === 'ambiguous') {
      description = template.ambiguousDescriptions[
        Math.floor(Math.random() * template.ambiguousDescriptions.length)
      ];
    } else {
      description = template.clearDescriptions[
        Math.floor(Math.random() * template.clearDescriptions.length)
      ];
    }

    // Obfuscate location and faction names
    description = this.obfuscateDetails(description, fact);

    const whisper: NarrativeWhisper = {
      id: `whisper_${fact.id}_${Date.now()}`,
      type: template.whisperType as WhisperType,
      description,
      relatedFactId: fact.id,
      mysticalOrigin: this.selectMysticalOrigin(fact, state) as NarrativeWhisper['mysticalOrigin'],
      confidenceHint: this.calculateConfidenceHint(fact, state),
      clarityLevel,
      triggeredAt: state.tick ?? 0,
      maxReveals: clarityLevel === 'veiled' ? 5 : clarityLevel === 'ambiguous' ? 3 : 1,
      timesRevealed: 0,
      emotionalTone: template.emotionalTones[
        Math.floor(Math.random() * template.emotionalTones.length)
      ] as any
    };

    this.whispers.set(whisper.id, whisper);
    
    // Track for this player
    if (!this.playerWhisperLog.has(playerId)) {
      this.playerWhisperLog.set(playerId, []);
    }
    this.playerWhisperLog.get(playerId)!.push(whisper.id);

    return whisper;
  }

  /**
   * Get template descriptions for a fact type
   */
  private getTemplateForFactType(factType: string): WhisperTemplate {
    const templates: Record<string, WhisperTemplate> = {
      death: {
        factType: 'death',
        whisperType: 'vision',
        veiledDescriptions: [
          "You see a flash of steel and hear a final cry... but the face is obscured by shadow.",
          "A chill runs through you. Someone falls in the darkness.",
          "You sense the moment between life and death, but whose life?"
        ],
        ambiguousDescriptions: [
          "A figure of importance falls... you can almost see their face.",
          "Death comes to someone in a place of power.",
          "A life ends in unexpected circumstances."
        ],
        clearDescriptions: [
          "You see clearly: a death has occurred, changing the course of history.",
          "A specific name comes to mind... and then it fades."
        ],
        emotionalTones: ['ominous', 'sorrowful', 'urgent']
      },
      siege: {
        factType: 'siege',
        whisperType: 'vision',
        veiledDescriptions: [
          "You see walls under assault... the banners are indistinct and fluttering in smoke.",
          "The sound of war echoes faintly. Two great powers clash, but in which land?",
          "Blood stains stone. A place of refuge becomes a battlefield."
        ],
        ambiguousDescriptions: [
          "A siege occurs - you can sense the location but not which faction leads.",
          "Walls are breached. The victor remains unclear.",
          "War tears at a stronghold. The outcome shifts like smoke."
        ],
        clearDescriptions: [
          "A siege concludes. One faction emerges victorious.",
          "A stronghold changes hands."
        ],
        emotionalTones: ['urgent', 'ominous', 'mysterious']
      },
      miracle: {
        factType: 'miracle',
        whisperType: 'prophecy',
        veiledDescriptions: [
          "Something impossible happens... but you cannot quite grasp its nature.",
          "The threads of fate shimmer and rearrange themselves.",
          "A blessing descends upon the world, changing its course."
        ],
        ambiguousDescriptions: [
          "A miracle occurs - divine or arcane in origin?",
          "Something wondrous transforms the land.",
          "Hope blooms where despair once reigned."
        ],
        clearDescriptions: [
          "A miracle unfolds before you. The world shall never be the same.",
          "Divine intervention manifests in the mortal realm."
        ],
        emotionalTones: ['hopeful', 'peaceful', 'mysterious']
      },
      catastrophe: {
        factType: 'catastrophe',
        whisperType: 'intuition',
        veiledDescriptions: [
          "You sense terrible suffering... felt across great distances.",
          "Destruction rushes forward like a tide, consuming all in its path.",
          "Suffering multiplies. Many perish in some distant calamity."
        ],
        ambiguousDescriptions: [
          "A catastrophe befalls a region - its nature remains shrouded.",
          "Disaster strikes. Thousands cry out in anguish.",
          "Something precious is lost forever."
        ],
        clearDescriptions: [
          "You witness a catastrophe clearly. Prepare yourself.",
          "Catastrophe has already struck. The world has changed."
        ],
        emotionalTones: ['ominous', 'sorrowful', 'urgent']
      },
      discovery: {
        factType: 'discovery',
        whisperType: 'resonance',
        veiledDescriptions: [
          "Something hidden has been revealed... but the details elude you.",
          "Knowledge surfaces like a drowning man gasping for air.",
          "A secret long buried suddenly feels exposed."
        ],
        ambiguousDescriptions: [
          "A discovery is made. It will change understanding of the world.",
          "Something long lost is found.",
          "Truth emerges from the darkness."
        ],
        clearDescriptions: [
          "A discovery is made clearly. The implications are profound.",
          "Knowledge is unveiled before you."
        ],
        emotionalTones: ['mysterious', 'hopeful', 'peaceful']
      },
      treaty: {
        factType: 'treaty',
        whisperType: 'intuition',
        veiledDescriptions: [
          "Two great powers come to an accord... but under what terms?",
          "Conflict dissolves into negotiation. The outcome remains unclear.",
          "Enemies clasp hands, though their intentions are hidden."
        ],
        ambiguousDescriptions: [
          "A treaty is brokered between powers.",
          "Peace (or the appearance of it) settles over a conflict.",
          "Old enemies forge a temporary bond."
        ],
        clearDescriptions: [
          "A treaty is clearly established. The political landscape shifts.",
          "Two factions broker an accord."
        ],
        emotionalTones: ['peaceful', 'mysterious', 'hopeful']
      },
      betrayal: {
        factType: 'betrayal',
        whisperType: 'vision',
        veiledDescriptions: [
          "You sense treachery... a knife in the dark, but whose hand holds it?",
          "Trust is shattered like glass. The betrayer's identity escapes you.",
          "Someone close to power turns against their own."
        ],
        ambiguousDescriptions: [
          "A betrayal occurs - but you cannot discern who betrays whom.",
          "Loyalty proves false. The traitor's motives are obscured.",
          "Someone's true colors are revealed."
        ],
        clearDescriptions: [
          "A betrayal becomes clear. Someone has chosen a new allegiance.",
          "Treachery is laid bare."
        ],
        emotionalTones: ['ominous', 'sorrowful', 'mysterious']
      }
    };

    return templates[factType] || templates.discovery;
  }

  /**
   * Select a mystical origin for the whisper
   */
  private selectMysticalOrigin(fact: HardFact, state: WorldState): NarrativeWhisper['mysticalOrigin'] {
    const origins = ['divine', 'psychic', 'arcane', 'ancestral', 'fey', 'demonic'];
    
    // If player has high mana, lean toward arcane/fey
    if ((state.player?.mp || 0) > 50) {
      return Math.random() > 0.5 ? 'arcane' : 'fey';
    }

    // If high wisdom, lean toward divine/ancestral
    if ((state.player?.stats?.int || 10) > 14) {
      return Math.random() > 0.5 ? 'divine' : 'ancestral';
    }

    // Default: random
    return origins[Math.floor(Math.random() * origins.length)] as NarrativeWhisper['mysticalOrigin'];
  }

  /**
   * Calculate how much confidence to hint at the truth
   */
  private calculateConfidenceHint(fact: HardFact, state: WorldState): number {
    let confidence = 30; // Default: moderate mystery

    // Higher severity facts are clearer
    confidence += (fact.severity / 100) * 30;

    // Higher player perception = clearer whispers
    if ((state.player?.stats?.int || 10) >= 15) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Obfuscate location and faction names in the description
   */
  private obfuscateDetails(description: string, fact: HardFact): string {
    let obfuscated = description;

    // Replace location name with vague reference
    obfuscated = obfuscated.replace(
      fact.originLocationId,
      ['a distant place', 'a strange land', 'somewhere far away', 'a place of power'][
        Math.floor(Math.random() * 4)
      ]
    );

    // Replace faction names with vague references
    fact.factionIds.forEach((factionId, idx) => {
      const vagueFactions = [
        'a great power', 'a mighty force', 'an ancient faction',
        'a shadowy organization', 'a noble house', 'a mysterious order'
      ];
      obfuscated = obfuscated.replace(
        factionId,
        vagueFactions[idx % vagueFactions.length]
      );
    });

    return obfuscated;
  }

  /**
   * Get all whispers for a player
   */
  getPlayerWhispers(playerId: string): NarrativeWhisper[] {
    const whisperIds = this.playerWhisperLog.get(playerId) || [];
    return whisperIds
      .map(id => this.whispers.get(id))
      .filter((w): w is NarrativeWhisper => w !== undefined);
  }

  /**
   * Trigger a whisper - increment reveal count
   */
  revealWhisper(whisperId: string): void {
    const whisper = this.whispers.get(whisperId);
    if (whisper && whisper.timesRevealed < whisper.maxReveals) {
      whisper.timesRevealed++;
    }
  }

  /**
   * Should a whisper gradually become clearer over time?
   */
  degradeWhisperClarityOverTime(
    whisper: NarrativeWhisper,
    currentTick: number
  ): NarrativeWhisper {
    // Every 1000 ticks, clarify the whisper if it's been revealed
    const ticksElapsed = currentTick - whisper.triggeredAt;
    const clarityIncreases = Math.floor(ticksElapsed / 1000);

    if (clarityIncreases > 0 && whisper.clarityLevel === 'veiled') {
      whisper.clarityLevel = 'ambiguous';
    } else if (clarityIncreases > 1 && whisper.clarityLevel === 'ambiguous') {
      whisper.clarityLevel = 'clear';
    }

    return whisper;
  }

  /**
   * Generate a conversational version of the whisper for the log
   */
  formatWhisperForLog(whisper: NarrativeWhisper): string {
    const prefixes: Record<string, string> = {
      vision: '✦ Vision: ',
      intuition: '◇ Intuition: ',
      prophecy: '☆ Prophecy: ',
      memory: '◆ Ancient Memory: ',
      resonance: '✧ Resonance: ',
      echo: '◊ Echo: '
    };

    const prefix = prefixes[whisper.type] || '◇ ';
    return `${prefix}${whisper.description}`;
  }

  /**
   * Clear whispers for a new epoch
   */
  clearForNewEpoch(): void {
    this.whispers.clear();
    this.playerWhisperLog.clear();
  }
}

// Singleton instance
let instance: NarrativeWhisperEngineImpl | null = null;

export function getNarrativeWhisperEngine(): NarrativeWhisperEngineImpl {
  if (!instance) {
    instance = new NarrativeWhisperEngineImpl();
  }
  return instance;
}

/**
 * Export convenience functions
 */
export const narrativeWhisperEngine = {
  generateWhisperForFact: (playerId: string, fact: HardFact, state: WorldState, clarity?: any) =>
    getNarrativeWhisperEngine().generateWhisperForFact(playerId, fact, state, clarity),
  getPlayerWhispers: (playerId: string) =>
    getNarrativeWhisperEngine().getPlayerWhispers(playerId),
  revealWhisper: (whisperId: string) =>
    getNarrativeWhisperEngine().revealWhisper(whisperId),
  degradeWhisperClarityOverTime: (whisper: NarrativeWhisper, tick: number) =>
    getNarrativeWhisperEngine().degradeWhisperClarityOverTime(whisper, tick),
  formatWhisperForLog: (whisper: NarrativeWhisper) =>
    getNarrativeWhisperEngine().formatWhisperForLog(whisper),
  clearForNewEpoch: () =>
    getNarrativeWhisperEngine().clearForNewEpoch()
};
