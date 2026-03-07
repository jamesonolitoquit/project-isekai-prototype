/**
 * questSynthesisAI.ts - M46-A1: Procedural Quest Generation
 * Synthesizes quests from faction warfare, NPC memory, rumors, and world fragments.
 * Enhanced with Pillar 2.3: AI Weaver integration for dynamic quest prologues.
 */

import { SeededRng } from './prng';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import { getNpcMemoryEngine } from './npcMemoryEngine';
import { getBeliefEngine } from './beliefEngine';
import type { WorldState, Quest } from './worldEngine';

// Import AI Weaver service (note: only imported for async enhancement, not required)
let AIService: any = null;
try {
  // Attempt to import AIService - will work in server context
  const { getAIService } = require('../client/services/AIService');
  const tempAI = getAIService;
  if (tempAI) AIService = tempAI;
} catch (e) {
  // AI service not available in this context, quests will use static descriptions
}

export interface ProceduralQuest extends Quest {
  synthesisSource: 'faction_warfare' | 'npc_memory' | 'rumor_investigation' | 'world_fragment' | 'hybrid';
  parentFactors: string[];
  dynamicObjectives: QuestObjective[];
  rewardVariant: 'gold' | 'item' | 'reputation' | 'knowledge' | 'relationship';
  failureConsequence?: string;
  timeLimit?: number;
  difficultyRating: number;
}

export interface QuestObjective {
  id: string;
  objectiveType: 'defeat_enemy' | 'retrieve_item' | 'discover_truth' | 'persuade_npc' | 'survive' | 'gather_resources';
  description: string;
  targetLocationId?: string;
  targetNpcId?: string;
  targetItemId?: string;
  progressValue: number;
  isCompleted: boolean;
  optional: boolean;
  reward?: number;
}

interface QuestTemplate {
  templateId: string;
  title: string;
  descriptionTemplate: string;
  objectives: QuestObjective[];
  difficulty: number;
}

class QuestSynthesisAI {
  private synthesisMethods: Map<ProceduralQuest['synthesisSource'], () => ProceduralQuest[]> = new Map();
  private questRepository: Map<string, ProceduralQuest> = new Map();
  private questTemplates: Map<string, QuestTemplate> = new Map();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.questTemplates.set('faction_conflict', {
      templateId: 'faction_conflict',
      title: 'Faction Rivalry: {faction1} vs {faction2}',
      descriptionTemplate: 'Tensions between {faction1} and {faction2} have escalated. {description}',
      objectives: [
        {
          id: 'obj_1',
          objectiveType: 'defeat_enemy',
          description: 'Defeat the enemy forces',
          progressValue: 0,
          isCompleted: false,
          optional: false
        }
      ],
      difficulty: 5
    });

    this.questTemplates.set('rumor_chase', {
      templateId: 'rumor_chase',
      title: 'Investigate Rumor: {rumor_title}',
      descriptionTemplate: 'A rumor spreads through the land: {description}. Investigate and determine its veracity.',
      objectives: [
        {
          id: 'obj_investigate',
          objectiveType: 'discover_truth',
          description: 'Uncover the truth behind the rumor',
          progressValue: 0,
          isCompleted: false,
          optional: false
        }
      ],
      difficulty: 3
    });

    this.questTemplates.set('npc_favor', {
      templateId: 'npc_favor',
      title: 'Favor for {npc_name}',
      descriptionTemplate: '{npc_name} needs your help with something important: {description}',
      objectives: [
        {
          id: 'obj_favor',
          objectiveType: 'retrieve_item',
          description: 'Retrieve the requested item',
          progressValue: 0,
          isCompleted: false,
          optional: false
        }
      ],
      difficulty: 2
    });
  }

  synthesizeFromFactionWarfare(worldState: WorldState): ProceduralQuest[] {
    const factionEngine = getFactionWarfareEngine();
    const quests: ProceduralQuest[] = [];
    const skirmishes = factionEngine.getAllSkirmishes();

    for (const skirmish of skirmishes.slice(-5)) {
      const template = this.questTemplates.get('faction_conflict')!;
      const attacker = factionEngine.getFaction(skirmish.attackingFactionId);
      const defender = factionEngine.getFaction(skirmish.defendingFactionId);

      if (!attacker || !defender) continue;

      const quest: ProceduralQuest = {
        id: `quest_faction_${skirmish.id}`,
        title: `${attacker.name} vs ${defender.name} Conflict`,
        description: skirmish.narrative,
        objectives: (template.objectives as any) || [],
        synthesisSource: 'faction_warfare',
        parentFactors: [skirmish.id, attacker.id, defender.id],
        dynamicObjectives: [
          {
            id: 'obj_choose_side',
            objectiveType: 'defeat_enemy',
            description: `Choose a side and fight for ${this.rng.nextInt(0, 100) % 2 === 0 ? attacker.name : defender.name}`,
            progressValue: 0,
            isCompleted: false,
            optional: false,
            reward: 100
          }
        ],
        rewardVariant: 'reputation',
        difficultyRating: 6,
        // status: 'available' // [M48-A4: Property not in type]
      } as any;

      this.questRepository.set(quest.id, quest);
      quests.push(quest);
    }

    return quests;
  }

  synthesizeFromNpcMemory(worldState: WorldState): ProceduralQuest[] {
    const memoryEngine = getNpcMemoryEngine();
    const quests: ProceduralQuest[] = [];
    const interactions = memoryEngine.getAllInteractions();

    for (const interaction of interactions.slice(-5)) {
      if (interaction.interactionType === 'betrayal' || interaction.interactionType === 'conflict') {
        const template = this.questTemplates.get('npc_favor')!;

        const quest: ProceduralQuest = {
          id: `quest_memory_${interaction.id}`,
          title: `Resolve Conflict: ${interaction.id}`,
          description: `An old tension between NPCs needs resolution: ${interaction.description}`,
          objectives: (template.objectives as any) || [],
          synthesisSource: 'npc_memory',
          parentFactors: [interaction.npc1Id, interaction.npc2Id],
          dynamicObjectives: [
            {
              id: 'obj_mediate',
              objectiveType: 'persuade_npc',
              description: 'Mediate between the conflicted parties',
              targetNpcId: interaction.npc1Id,
              progressValue: 0,
              isCompleted: false,
              optional: false,
              reward: 75
            }
          ],
          rewardVariant: 'relationship',
          difficultyRating: 4,
          // status: 'available' // [M48-A4: Property not in type]
        } as any;

        this.questRepository.set(quest.id, quest);
        quests.push(quest);
      }
    }

    return quests;
  }

  synthesizeFromRumors(worldState: WorldState): ProceduralQuest[] {
    const beliefEngine = getBeliefEngine();
    const quests: ProceduralQuest[] = [];

    const hardFacts = (beliefEngine as any).getAllHardFacts?.() || [];

    for (const fact of hardFacts.slice(-8)) {
      const template = this.questTemplates.get('rumor_chase')!;

      const quest: ProceduralQuest = {
        id: `quest_rumor_${fact.id}`,
        title: `Investigate: ${fact.content.substring(0, 40)}...`,
        description: `Rumors abound about: ${fact.content}. Learn the truth.`,
        objectives: (template.objectives as any) || [],
        synthesisSource: 'rumor_investigation',
        parentFactors: [fact.id],
        dynamicObjectives: [
          {
            id: 'obj_investigate',
            objectiveType: 'discover_truth',
            description: 'Uncover evidence confirming or denying the claim',
            progressValue: 0,
            isCompleted: false,
            optional: false,
            reward: 50
          }
        ],
        rewardVariant: 'knowledge',
        difficultyRating: Math.min(8, 3 + Math.floor(fact.perceptionDistance / 2)),
        // status: 'available' // [M48-A4: Property not in type]
      } as any;

      this.questRepository.set(quest.id, quest);
      quests.push(quest);
    }

    return quests;
  }

  synthesizeFromWorldFragments(worldState: WorldState): ProceduralQuest[] {
    const quests: ProceduralQuest[] = [];

    const fragments = (((worldState as any).worldFragments) || []).slice(-5);

    for (const fragment of fragments) {
      const quest: ProceduralQuest = {
        id: `quest_fragment_${fragment.id}`,
        title: `Explore: ${fragment.name}`,
        description: `Discover the secrets of ${fragment.name}: ${fragment.description}`,
        objectives: [
          {
            id: 'obj_explore',
            objectiveType: 'discover_truth',
            description: `Fully explore ${fragment.name}`,
            targetLocationId: fragment.locationId,
            progressValue: 0,
            isCompleted: false,
            optional: false,
            reward: 100
          }
        ],
        synthesisSource: 'world_fragment',
        parentFactors: [fragment.id],
        dynamicObjectives: [],
        rewardVariant: 'item',
        difficultyRating: 3,
        // status: 'available' // [M48-A4: Property not in type]
      } as any;

      this.questRepository.set(quest.id, quest);
      quests.push(quest);
    }

    return quests;
  }

  synthesizeHybridQuests(worldState: WorldState): ProceduralQuest[] {
    const factionQuests = this.synthesizeFromFactionWarfare(worldState);
    const memoryQuests = this.synthesizeFromNpcMemory(worldState);
    const rumorQuests = this.synthesizeFromRumors(worldState);

    const hybrid: ProceduralQuest[] = [];

    for (let i = 0; i < Math.min(factionQuests.length, memoryQuests.length); i++) {
      const fq = factionQuests[i];
      const mq = memoryQuests[i];

      const hybridQuest: ProceduralQuest = {
        id: `quest_hybrid_${i}_${Date.now()}`,
        title: `Complex Situation: ${fq.title} & ${mq.title}`,
        description: `Multiple factors converge: ${fq.description} AND ${mq.description}`,
        objectives: [...fq.objectives, ...mq.objectives],
        synthesisSource: 'hybrid',
        parentFactors: [...fq.parentFactors, ...mq.parentFactors],
        dynamicObjectives: [...fq.dynamicObjectives, ...mq.dynamicObjectives],
        rewardVariant: 'gold',
        difficultyRating: Math.ceil((fq.difficultyRating + mq.difficultyRating) / 2),
        // status: 'available' // [M48-A4: Property not in type]
      } as any;

      this.questRepository.set(hybridQuest.id, hybridQuest);
      hybrid.push(hybridQuest);
    }

    return hybrid;
  }

  generateAllQuests(worldState: WorldState): ProceduralQuest[] {
    const allQuests: ProceduralQuest[] = [];

    allQuests.push(...this.synthesizeFromFactionWarfare(worldState));
    allQuests.push(...this.synthesizeFromNpcMemory(worldState));
    allQuests.push(...this.synthesizeFromRumors(worldState));
    allQuests.push(...this.synthesizeFromWorldFragments(worldState));
    allQuests.push(...this.synthesizeHybridQuests(worldState));

    return allQuests;
  }

  /**
   * Enhance quest with AI-generated prologue (Pillar 2.3)
   * This is an async operation that should be called after quest creation
   * if AI is available. Falls back gracefully to static descriptions if AI unavailable.
   */
  async enhanceQuestWithAI(quest: ProceduralQuest, worldState: WorldState): Promise<void> {
    if (!AIService) {
      return; // AI service not available, keep static description
    }

    try {
      const aiService = AIService();
      
      // Determine context factors from quest
      const factionInvolved = (quest.parentFactors || []).filter(f => 
        worldState.factions?.some(fac => fac.id === f)
      ) || [];

      // Build player background from available properties
      const playerBackground = worldState.player?.currentRace 
        ? `${worldState.player.currentRace} Adventurer`
        : 'Adventurer';

      const result = await aiService.synthesize({
        type: 'quest_prologue',
        factors: {
          questTitle: quest.title,
          questTemplate: quest.synthesisSource,
          factionInvolved,
          playerBackground,
          difficulty: quest.difficultyRating,
        },
        paradoxLevel: worldState.paradoxLevel,
      });

      // Only update if synthesis was successful
      if (result.content && result.provider !== 'static_fallback') {
        quest.description = `${result.content}\n\n[Weaver Synthesis]`;
      }
    } catch (error) {
      console.warn('AI enhancement of quest failed, keeping static description:', error);
      // Quest retains its static description if AI fails
    }
  }

  /**
   * Batch enhance multiple quests with AI (Pillar 2.3)
   * Use this for initial quest generation to add immersive prologues
   */
  async batchEnhanceQuestsWithAI(quests: ProceduralQuest[], worldState: WorldState): Promise<void> {
    // Limit concurrent AI calls to avoid rate limiting
    const maxConcurrent = 3;
    
    for (let i = 0; i < quests.length; i += maxConcurrent) {
      const batch = quests.slice(i, i + maxConcurrent);
      await Promise.all(
        batch.map(quest => this.enhanceQuestWithAI(quest, worldState).catch(() => {
          // Silently catch individual failures, don't block other enhancements
        }))
      );
    }
  }

  getQuest(questId: string): ProceduralQuest | undefined {
    return this.questRepository.get(questId);
  }

  getAllQuests(): ProceduralQuest[] {
    return Array.from(this.questRepository.values());
  }

  getQuestsBySource(source: ProceduralQuest['synthesisSource']): ProceduralQuest[] {
    return Array.from(this.questRepository.values()).filter(q => q.synthesisSource === source);
  }

  completeObjective(questId: string, objectiveId: string): void {
    const quest = this.questRepository.get(questId);
    if (!quest) return;

    quest.dynamicObjectives.forEach(obj => {
      if (obj.id === objectiveId) {
        obj.isCompleted = true;
        obj.progressValue = 100;
      }
    });

    const allCompleted = quest.dynamicObjectives.every(obj => obj.isCompleted || obj.optional);
    if (allCompleted) {
      quest.status = 'completed';
    }
  }

  abandonQuest(questId: string): void {
    const quest = this.questRepository.get(questId);
    if (quest) {
      quest.status = 'abandoned';
    }
  }

  clearQuests(): void {
    this.questRepository.clear();
  }

  reset(): void {
    this.questRepository.clear();
  }
}

let questEngineInstance: QuestSynthesisAI | null = null;

export function getQuestSynthesisAI(seed: number = 12345): QuestSynthesisAI {
  if (!questEngineInstance) {
    questEngineInstance = new QuestSynthesisAI(seed);
  }
  return questEngineInstance;
}

export function resetQuestSynthesisAI(): void {
  if (questEngineInstance) {
    questEngineInstance.reset();
    questEngineInstance = null;
  }
}

export const QuestSynthesisAIExports = {
  getQuestSynthesisAI,
  resetQuestSynthesisAI
};
