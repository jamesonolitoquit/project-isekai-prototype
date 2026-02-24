/**
 * narrativeWhisperEngine.ts - M45-B2: Visions & Intuitive Hints System
 * Provides mystical narrative hints and visions to guide players toward truths.
 */

import { SeededRng } from './prng';
import { getBeliefEngine } from './beliefEngine';
import type { WorldState, NPC } from './worldEngine';

export type WhisperOrigin = 'divine' | 'psychic' | 'arcane' | 'ancestral' | 'fey' | 'demonic';

export type ClarityLevel = 'veiled' | 'ambiguous' | 'clear';

export interface NarrativeWhisper {
  id: string;
  originating_from: WhisperOrigin;
  target_npc_id?: string;
  hard_fact_id: string;
  clarity_level: ClarityLevel;
  whisper_template: string;
  whisper_text: string;
  emotional_tone: string;
  hint_strength: number;
  delivery_tick: number;
  can_repeat: boolean;
  prerequisite_knowledge?: string[];
  related_facts: string[];
}

export interface WhisperTemplate {
  id: string;
  templateName: string;
  originResources: Record<WhisperOrigin, string[]>;
  clarityFrameworks: Record<ClarityLevel, string[]>;
  toneOptions: string[];
  hintVariations: string[];
}

class NarrativeWhisperEngine {
  private whispers: Map<string, NarrativeWhisper> = new Map();
  private templates: Map<string, WhisperTemplate> = new Map();
  private shownWhispers: Set<string> = new Set();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates.set('truth_revelation', {
      id: 'truth_revelation',
      templateName: 'Truth Revelation',
      originResources: {
        'divine': [
          'A golden light coalesces before you.',
          'Celestial choirs sing softly.',
          'Divine presence encompasses you.'
        ],
        'psychic': [
          'A mind not your own touches yours gently.',
          'Thoughts not born from your mind bloom.',
          'Consciousness expands beyond your skull.'
        ],
        'arcane': [
          'Mystical symbols swirl in the air.',
          'Arcane energy crackles around you.',
          'The fabric of reality shimmers nearby.'
        ],
        'ancestral': [
          'The spirits of your ancestors gather.',
          'Echoes of the past surround you.',
          'Your bloodline calls to you.'
        ],
        'fey': [
          'Otherworldly beings shimmer into view.',
          'Fey laughter tingles your awareness.',
          'The veil between worlds grows thin.'
        ],
        'demonic': [
          'A dark presence makes itself known.',
          'Sulfurous smoke curls nearby.',
          'Malevolent energy wraps around you.'
        ]
      },
      clarityFrameworks: {
        'veiled': [
          'Hint at $TRUTH without revealing it',
          'Speak in riddles about $TRUTH',
          'Obscure the $TRUTH in metaphor'
        ],
        'ambiguous': [
          'Present possibilities about $TRUTH',
          'Suggest connections to $TRUTH',
          'Leave important details about $TRUTH unclear'
        ],
        'clear': [
          'State the $TRUTH plainly',
          'Reveal $TRUTH without ambiguity',
          'Make $TRUTH unmistakably clear'
        ]
      },
      toneOptions: [
        'mysterious',
        'urgent',
        'sad',
        'joyful',
        'solemn',
        'playful',
        'menacing',
        'comforting'
      ],
      hintVariations: [
        'Location: $HINT_LOCATION',
        'Person: $HINT_PERSON',
        'Event: $HINT_EVENT',
        'Consequence: $HINT_CONSEQUENCE',
        'Timeline: $HINT_TIMELINE'
      ]
    });

    this.templates.set('warning_omen', {
      id: 'warning_omen',
      templateName: 'Warning Omen',
      originResources: {
        'divine': ['Holy wrath descends.', 'Divine judgment looms.'],
        'psychic': ['Danger thoughts flood your mind.', 'Peril echoes psychically.'],
        'arcane': ['Arcane runes blaze with warning.', 'Magical wards shatter.'],
        'ancestral': ['Ancestors wail their concern.', 'Bloodline memory screams danger.'],
        'fey': ['Fey creatures scatter in fear.', 'Faerie realm trembles.'],
        'demonic': ['Hell itself warns you.', 'Demons flee in terror.']
      },
      clarityFrameworks: {
        'veiled': ['Sense something amiss.', 'Feel unease.'],
        'ambiguous': ['Understand danger approaches.', 'Recognize peril.'],
        'clear': ['DANGER IMMINENT.', 'AVOID AT ALL COSTS.']
      },
      toneOptions: ['urgent', 'menacing', 'solemn', 'desperate'],
      hintVariations: ['Warning about $WARNING_TARGET']
    });
  }

  generateWhisper(
    hardFactId: string,
    targetNpcId?: string,
    preferredOrigin?: WhisperOrigin,
    preferredClarity?: ClarityLevel
  ): NarrativeWhisper {
    const origin = preferredOrigin || this.randomOrigin();
    const clarity = preferredClarity || this.randomClarity();

    const beliefEngine = getBeliefEngine();
    const hardFact = (beliefEngine as any).getHardFact?.(hardFactId);
    if (!hardFact) {
      throw new Error(`Hard fact ${hardFactId} not found`);
    }

    const template = this.templates.get('truth_revelation')!;
    const tone = template.toneOptions[this.rng.nextInt(0, template.toneOptions.length - 1)];

    const whisperText = this.synthesizeWhisperText(
      template,
      origin,
      clarity,
      tone,
      hardFact.content
    );

    const whisper: NarrativeWhisper = {
      id: `whisper_${hardFactId}_${Date.now()}`,
      originating_from: origin,
      target_npc_id: targetNpcId,
      hard_fact_id: hardFactId,
      clarity_level: clarity,
      whisper_template: template.id,
      whisper_text: whisperText,
      emotional_tone: tone,
      hint_strength: this.calculateHintStrength(clarity),
      delivery_tick: this.rng.nextInt(0, 100000),
      can_repeat: clarity === 'veiled',
      related_facts: this.findRelatedFacts(hardFactId, beliefEngine)
    };

    this.whispers.set(whisper.id, whisper);
    return whisper;
  }

  private randomOrigin(): WhisperOrigin {
    const origins: WhisperOrigin[] = ['divine', 'psychic', 'arcane', 'ancestral', 'fey', 'demonic'];
    return origins[this.rng.nextInt(0, origins.length - 1)];
  }

  private randomClarity(): ClarityLevel {
    const clarities: ClarityLevel[] = ['veiled', 'ambiguous', 'clear'];
    return clarities[this.rng.nextInt(0, clarities.length - 1)];
  }

  private synthesizeWhisperText(
    template: WhisperTemplate,
    origin: WhisperOrigin,
    clarity: ClarityLevel,
    tone: string,
    truthContent: string
  ): string {
    const originText = template.originResources[origin][
      this.rng.nextInt(0, template.originResources[origin].length - 1)
    ];

    const clarityText = template.clarityFrameworks[clarity][
      this.rng.nextInt(0, template.clarityFrameworks[clarity].length - 1)
    ];

    const hint = template.hintVariations[
      this.rng.nextInt(0, template.hintVariations.length - 1)
    ];

    let finalText = `${originText} ${clarityText}`;
    finalText = finalText.replace('$TRUTH', truthContent);
    finalText = finalText.replace('$HINT_LOCATION', 'a distant place');
    finalText = finalText.replace('$HINT_PERSON', 'someone you trust');
    finalText = finalText.replace('$HINT_EVENT', 'something that happened');
    finalText = finalText.replace('$HINT_CONSEQUENCE', 'something that matters');
    finalText = finalText.replace('$HINT_TIMELINE', 'soon');

    if (clarity === 'veiled') {
      finalText += ` ... ${hint}`;
    }

    return finalText;
  }

  private calculateHintStrength(clarity: ClarityLevel): number {
    if (clarity === 'clear') return 100;
    if (clarity === 'ambiguous') return 60;
    return 30;
  }

  private findRelatedFacts(factId: string, beliefEngine: ReturnType<typeof getBeliefEngine>): string[] {
    const related: string[] = [];
    const allFacts = (beliefEngine as any).getAllHardFacts?.() || [];

    for (const fact of allFacts.slice(0, 10)) {
      if (fact.id !== factId && this.rng.nextInt(0, 100) > 60) {
        related.push(fact.id);
      }
    }

    return related;
  }

  deliverWhisper(whisperId: string, targetNpc: NPC): void {
    const whisper = this.whispers.get(whisperId);
    if (!whisper || this.shownWhispers.has(whisperId)) {
      if (!whisper?.can_repeat) return;
    }

    this.shownWhispers.add(whisperId);
  }

  generateWarningWhisper(
    problemDescription: string,
    targetNpcId?: string,
    severity: number = 50
  ): NarrativeWhisper {
    const origin = this.rng.nextInt(0, 100) > 70 ? 'demonic' : 'ancestral';
    const clarity: ClarityLevel = severity > 80 ? 'clear' : (severity > 50 ? 'ambiguous' : 'veiled');

    const template = this.templates.get('warning_omen')!;
    const tone = 'urgent';

    const originText = template.originResources[origin][
      this.rng.nextInt(0, template.originResources[origin].length - 1)
    ];

    const clarityText = template.clarityFrameworks[clarity][
      this.rng.nextInt(0, template.clarityFrameworks[clarity].length - 1)
    ];

    const whisperText = `${originText} ${clarityText}. ${problemDescription}`;

    const whisper: NarrativeWhisper = {
      id: `warning_${Date.now()}`,
      originating_from: origin,
      target_npc_id: targetNpcId,
      hard_fact_id: 'warning_' + this.rng.nextInt(0, 100000),
      clarity_level: clarity,
      whisper_template: template.id,
      whisper_text: whisperText,
      emotional_tone: tone,
      hint_strength: severity,
      delivery_tick: this.rng.nextInt(0, 100000),
      can_repeat: false,
      related_facts: []
    };

    this.whispers.set(whisper.id, whisper);
    return whisper;
  }

  getWhisper(whisperId: string): NarrativeWhisper | undefined {
    return this.whispers.get(whisperId);
  }

  getAllWhispers(): NarrativeWhisper[] {
    return Array.from(this.whispers.values());
  }

  getWhispersByOrigin(origin: WhisperOrigin): NarrativeWhisper[] {
    return Array.from(this.whispers.values()).filter(w => w.originating_from === origin);
  }

  getWhispersByClarity(clarity: ClarityLevel): NarrativeWhisper[] {
    return Array.from(this.whispers.values()).filter(w => w.clarity_level === clarity);
  }

  hasWhisperBeenShown(whisperId: string): boolean {
    return this.shownWhispers.has(whisperId);
  }

  getAvailableWhispers(): NarrativeWhisper[] {
    return Array.from(this.whispers.values()).filter(
      w => !this.shownWhispers.has(w.id)
    );
  }

  clearWhispers(): void {
    this.whispers.clear();
    this.shownWhispers.clear();
  }

  reset(): void {
    this.whispers.clear();
    this.shownWhispers.clear();
  }
}

let narrativeWhisperEngineInstance: NarrativeWhisperEngine | null = null;

export function getNarrativeWhisperEngine(seed: number = 12345): NarrativeWhisperEngine {
  if (!narrativeWhisperEngineInstance) {
    narrativeWhisperEngineInstance = new NarrativeWhisperEngine(seed);
  }
  return narrativeWhisperEngineInstance;
}

export function resetNarrativeWhisperEngine(): void {
  if (narrativeWhisperEngineInstance) {
    narrativeWhisperEngineInstance.reset();
    narrativeWhisperEngineInstance = null;
  }
}

export const NarrativeWhisperEngineExports = {
  getNarrativeWhisperEngine,
  resetNarrativeWhisperEngine
};
