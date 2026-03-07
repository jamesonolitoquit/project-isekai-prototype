/**
 * narrativeSeedProcessor.ts - Phase 6: The Weaving of Fates
 * Transforms player character choices (origin story, archetype, talents) into:
 * - Social Scars (initial reputation modifiers)
 * - Talent Engine Modifiers
 * - Prologue Quests
 * - World State Seeds
 */

import type { WorldState, PlayerState } from './worldEngine';
import { ARCHETYPES, TALENTS, type Archetype } from '../engine/characterCreation';

export interface NarrativeSeed {
  socialScars: Record<string, number>;        // NPC/faction ID -> reputation modifier
  playerModifiers: PlayerModifiers;           // Bonuses from talents
  prologueQuestId?: string;                   // Unique starter quest ID
  discoveredLocations: string[];              // Starting known locations
  initialReputation: Record<string, number>;  // Faction reputation seeds
  narrativeFlags: Record<string, boolean>;    // Story branching flags
}

export interface PlayerModifiers {
  goldMultiplier?: number;
  stealthBonus?: number;
  intimidationBonus?: number;
  magicDetectionBonus?: number;
  reputationBoost?: number;
  luckVariance?: 'high' | 'normal';
  healingBonus?: number;
  spiritProtection?: number;
  // 7-stat modifiers (derived from talents and archetype)
  strModifier?: number;
  agiModifier?: number;
  intModifier?: number;
  chaModifier?: number;
  endModifier?: number;
  lukModifier?: number;
  perceptionModifier?: number;
}

// =========================================================================
// KEYWORD EXTRACTION - Parse origin story for narrative themes
// =========================================================================

const KEYWORD_THEMES = {
  betray: { factions: ['merchant-guild', 'noble-house'], repMod: -20, theme: 'betrayer' },
  innocent: { factions: ['clergy', 'noble-house'], repMod: 10, theme: 'innocent' },
  criminal: { factions: ['merchant-guild', 'city-watch'], repMod: -15, theme: 'criminal' },
  scholar: { factions: ['arcane-lodge', 'noble-house'], repMod: 10, theme: 'scholar' },
  exile: { factions: ['traveler-camp', 'outcasts'], repMod: 15, theme: 'exile' },
  warrior: { factions: ['mercenary-band', 'city-watch'], repMod: 10, theme: 'warrior' },
  magic: { factions: ['arcane-lodge'], repMod: 10, theme: 'magic_user' },
  curse: { factions: ['clergy', 'arcane-lodge'], repMod: -10, theme: 'cursed' },
  wealth: { factions: ['merchant-guild', 'noble-house'], repMod: 15, theme: 'wealthy' },
  poverty: { factions: ['traveler-camp', 'outcasts'], repMod: 10, theme: 'poor' },
  family: { factions: ['noble-house', 'clergy'], repMod: 5, theme: 'family_ties' },
  lost: { factions: ['clergy', 'outcasts'], repMod: 5, theme: 'lost_soul' },
  revenge: { factions: ['mercenary-band'], repMod: 5, theme: 'vengeful' },
  stealth: { factions: ['traveler-camp', 'shadow-syndicate'], repMod: 5, theme: 'stealthy' }
};

function extractKeywordThemes(text: string): Record<string, number> {
  const normalized = text.toLowerCase();
  const themes: Record<string, number> = {};

  for (const [keyword, data] of Object.entries(KEYWORD_THEMES)) {
    if (normalized.includes(keyword)) {
      data.factions.forEach(faction => {
        themes[faction] = (themes[faction] || 0) + data.repMod;
      });
    }
  }

  return themes;
}

// =========================================================================
// ARCHETYPE PROCESSORS - Map archetype to world seeds
// =========================================================================

const ARCHETYPE_PROCESSORS: Record<string, () => Partial<NarrativeSeed>> = {
  'exiled-noble': () => ({
    socialScars: {
      'noble-house': -30,    // Estranged from family
      'merchant-guild': 5,   // Still respected in commerce
      'city-watch': 10       // Knows the laws
    },
    initialReputation: {
      'noble-house': -30,
      'merchant-guild': 10,
      'city-watch': 5
    },
    discoveredLocations: ['luminara-grand-market', 'noble-quarter'],
    prologueQuestId: 'prologue-exiled-noble-seal',
    narrativeFlags: { 'is-noble-exile': true, 'seeking-redemption': true }
  }),

  'wandering-scholar': () => ({
    socialScars: {
      'arcane-lodge': 15,    // Scholarly reputation
      'merchant-guild': 5,   // Deals with traders
      'outcasts': 10         // Empathetic to downtrodden
    },
    initialReputation: {
      'arcane-lodge': 20,
      'clergy': 10,
      'noble-house': 5
    },
    discoveredLocations: ['moonwell-shrine', 'ancient-library'],
    prologueQuestId: 'prologue-scholar-forbidden-text',
    narrativeFlags: { 'is-scholar': true, 'seeking-knowledge': true, 'has-library-access': true }
  }),

  'cursed-smith': () => ({
    socialScars: {
      'mercenary-band': 10,  // Supplies weapons
      'armorers-guild': 20,  // Guild affiliation
      'outcasts': 5          // Sympathetic to cursed
    },
    initialReputation: {
      'armorers-guild': 25,
      'mercenary-band': 10,
      'clergy': -5
    },
    discoveredLocations: ['forge-summit', 'blacksmith-district'],
    prologueQuestId: 'prologue-smith-eternal-flame',
    narrativeFlags: { 'is-smith': true, 'is-cursed': true, 'seeking-cure': true }
  }),

  'forest-hermit': () => ({
    socialScars: {
      'druid-circle': 20,    // Nature affinity
      'traveler-camp': 10,   // Lives off-grid
      'church': -5           // Distrusts institutions
    },
    initialReputation: {
      'druid-circle': 25,
      'traveler-camp': 15,
      'merchant-guild': -10
    },
    discoveredLocations: ['eldergrove-village', 'thornwood-depths', 'sacred-grove'],
    prologueQuestId: 'prologue-hermit-forest-call',
    narrativeFlags: { 'is-hermit': true, 'nature-bonded': true, 'wilderness-trained': true }
  }),

  'shadow-thief': () => ({
    socialScars: {
      'shadow-syndicate': 15, // Thief reputation
      'city-watch': -25,      // Wanted
      'merchant-guild': -10   // Stole from them
    },
    initialReputation: {
      'shadow-syndicate': 20,
      'city-watch': -30,
      'merchant-guild': -15
    },
    discoveredLocations: ['thornwood-depths', 'hidden-den', 'criminal-underbelly'],
    prologueQuestId: 'prologue-thief-grand-heist',
    narrativeFlags: { 'is-thief': true, 'wanted-criminal': true, 'shadow-trained': true }
  }),

  'battlefield-veteran': () => ({
    socialScars: {
      'mercenary-band': 25,  // Military brotherhood
      'city-watch': 10,      // Law enforcement respect
      'clergy': -10          // Haunted by war
    },
    initialReputation: {
      'mercenary-band': 30,
      'city-watch': 15,
      'noble-house': 5
    },
    discoveredLocations: ['mercenary-camp', 'city-barracks', 'battlefield-cemetery'],
    prologueQuestId: 'prologue-veteran-final-mission',
    narrativeFlags: { 'is-veteran': true, 'battle-scarred': true, 'seeking-peace': true }
  })
};

// =========================================================================
// TALENT PROCESSORS - Map talents to engine modifiers
// =========================================================================

const TALENT_MODIFIERS: Record<string, Partial<PlayerModifiers>> = {
  'midas-touch': { goldMultiplier: 1.2 },
  'shadow-stalk': { stealthBonus: 25 },
  'primal-fear': { intimidationBonus: 20 },
  'arcane-insight': { magicDetectionBonus: 30 },
  'ancient-lineage': { reputationBoost: 10 },
  'cursed-fortune': { luckVariance: 'high' },
  'healer\'s-blessing': { healingBonus: 25 },
  'spirit-ward': { spiritProtection: 15 }
};

// =========================================================================
// PROLOGUE QUEST TEMPLATES
// =========================================================================

export interface PrologueQuestTemplate {
  questId: string;
  archetype: string;
  title: string;
  description: string;
  objectives: Array<{
    id: string;
    description: string;
    type: string;
  }>;
  reward: {
    gold?: number;
    xp?: number;
    reputationGain?: Record<string, number>;
    items?: string[];
  };
}

export const PROLOGUE_QUESTS: Record<string, PrologueQuestTemplate> = {
  'prologue-exiled-noble-seal': {
    questId: 'prologue-exiled-noble-seal',
    archetype: 'exiled-noble',
    title: 'Reclaim the Family Seal',
    description: 'Your family seal was stolen by a rival merchant during your exile. Retrieve it to reclaim your honor in Luminara society.',
    objectives: [
      { id: 'obj-1', description: 'Locate the merchant who holds your seal (found in Luminara Grand Market)', type: 'locate_npc' },
      { id: 'obj-2', description: 'Negotiate or retrieve the seal', type: 'interact_with_npc' },
      { id: 'obj-3', description: 'Return the seal to the Noble House representative', type: 'complete_trade' }
    ],
    reward: { gold: 500, xp: 1000, reputationGain: { 'noble-house': 20, 'merchant-guild': 5 } }
  },

  'prologue-scholar-forbidden-text': {
    questId: 'prologue-scholar-forbidden-text',
    archetype: 'wandering-scholar',
    title: 'Find the Forbidden Grimoire',
    description: 'A rare grimoire is rumored to be hidden in the Moonwell Shrine. The Arcane Lodge will pay handsomely for its safe return.',
    objectives: [
      { id: 'obj-1', description: 'Search the Moonwell Shrine', type: 'explore_location' },
      { id: 'obj-2', description: 'Decipher the grimoire\'s location puzzle', type: 'solve_riddle' },
      { id: 'obj-3', description: 'Deliver the grimoire to the Arcane Lodge', type: 'deliver_item' }
    ],
    reward: { gold: 800, xp: 1500, reputationGain: { 'arcane-lodge': 30 } }
  },

  'prologue-smith-eternal-flame': {
    questId: 'prologue-smith-eternal-flame',
    archetype: 'cursed-smith',
    title: 'Quench the Eternal Flame',
    description: 'The curse binding you originated from the Eternal Flame atop Forge Summit. Return there to seek salvation from a mysterious oracle.',
    objectives: [
      { id: 'obj-1', description: 'Ascend Forge Summit', type: 'reach_location' },
      { id: 'obj-2', description: 'Confront the Eternal Flame', type: 'challenge_boss' },
      { id: 'obj-3', description: 'Find the oracle\'s shrine', type: 'explore_location' }
    ],
    reward: { gold: 0, xp: 2000, reputationGain: { 'armorers-guild': 15 } }
  },

  'prologue-hermit-forest-call': {
    questId: 'prologue-hermit-forest-call',
    archetype: 'forest-hermit',
    title: 'Answer the Forest\'s Call',
    description: 'Strange whispers echo through Eldergrove. The Druid Circle requests your help investigating the disturbance.',
    objectives: [
      { id: 'obj-1', description: 'Meet with the Druid Circle elders', type: 'interact_with_npc' },
      { id: 'obj-2', description: 'Journey to Thornwood Depths', type: 'explore_location' },
      { id: 'obj-3', description: 'Cleanse the corrupted grove', type: 'purify_location' }
    ],
    reward: { gold: 300, xp: 1200, reputationGain: { 'druid-circle': 40 } }
  },

  'prologue-thief-grand-heist': {
    questId: 'prologue-thief-grand-heist',
    archetype: 'shadow-thief',
    title: 'The Grand Heist',
    description: 'The Shadow Syndicate has a job for you—steal a valuable artifact from the Luminara Noble House vault. Your freedom depends on success.',
    objectives: [
      { id: 'obj-1', description: 'Scout the Noble House vault', type: 'infiltrate_location' },
      { id: 'obj-2', description: 'Acquire the heist tools from your fence', type: 'trade_with_npc' },
      { id: 'obj-3', description: 'Execute the heist and escape', type: 'steal_artifact' },
      { id: 'obj-4', description: 'Deliver the artifact to the Syndicate', type: 'deliver_item' }
    ],
    reward: { gold: 1200, xp: 1800, reputationGain: { 'shadow-syndicate': 35 } }
  },

  'prologue-veteran-final-mission': {
    questId: 'prologue-veteran-final-mission',
    archetype: 'battlefield-veteran',
    title: 'One Final Mission',
    description: 'Your old commander calls you back for a desperate mission. Mercenaries are needed to defend a caravan from bandits on the road.',
    objectives: [
      { id: 'obj-1', description: 'Report to the mercenary camp', type: 'reach_location' },
      { id: 'obj-2', description: 'Meet with your commander', type: 'interact_with_npc' },
      { id: 'obj-3', description: 'Defend the caravan from ambush', type: 'combat_encounter' },
      { id: 'obj-4', description: 'Escort the caravan to safety', type: 'escort_mission' }
    ],
    reward: { gold: 1000, xp: 1600, reputationGain: { 'mercenary-band': 40 } }
  }
};

// =========================================================================
// MAIN PROCESSOR
// =========================================================================

export class NarrativeSeedProcessor {
  static procesPlayerCharacterSeed(
    player: PlayerState & { originStory?: string; archetype?: string; talents?: string[] }
  ): NarrativeSeed {
    const archetype = player.archetype || 'adventurer';
    const originStory = player.originStory || '';
    const talents = player.talents || [];

    // 1. Extract keyword themes from origin story
    const keywordThemes = extractKeywordThemes(originStory);

    // 2. Get archetype processor
    const archetypeProcessor = ARCHETYPE_PROCESSORS[archetype];
    const archetypeSeed = archetypeProcessor ? archetypeProcessor() : {};

    // 3. Merge reputation modifiers (keyword + archetype)
    const mergedReputation = {
      ...archetypeSeed.initialReputation,
      ...keywordThemes
    };

    // 4. Collect talent modifiers
    const talentMods = talents.reduce((acc, talentId) => {
      const modifier = TALENT_MODIFIERS[talentId];
      if (modifier) {
        return { ...acc, ...modifier };
      }
      return acc;
    }, {} as PlayerModifiers);

    // 5. Accumulate all modifiers from archetype + talents
    const archetypeStatMods = ARCHETYPE_PROCESSORS[archetype]?.() || {};
    const combinedModifiers: PlayerModifiers = {
      ...talentMods,
      // Future: merge archetype stat modifiers here
    };

    return {
      socialScars: {
        ...archetypeSeed.socialScars,
        ...keywordThemes
      },
      playerModifiers: combinedModifiers,
      prologueQuestId: archetypeSeed.prologueQuestId,
      discoveredLocations: archetypeSeed.discoveredLocations || [],
      initialReputation: mergedReputation,
      narrativeFlags: archetypeSeed.narrativeFlags || {}
    };
  }

  /**
   * Apply narrative seed to world state
   * Modifies initial faction reputation, seeded prologue quest, discovered locations
   */
  static applySeedToWorldState(worldState: WorldState, playerSeed: NarrativeSeed): void {
    if (!worldState.player) return;

    // 1. Seed initial faction reputation
    worldState.player.factionReputation = {
      ...worldState.player.factionReputation,
      ...playerSeed.initialReputation
    };

    // 2. Mark starting locations as discovered
    if (playerSeed.discoveredLocations.length > 0) {
      worldState.locations = worldState.locations.map(loc => {
        if (playerSeed.discoveredLocations.includes(loc.id)) {
          return { ...loc, discovered: true };
        }
        return loc;
      });
    }

    // 3. Add prologue quest to journal
    if (playerSeed.prologueQuestId && PROLOGUE_QUESTS[playerSeed.prologueQuestId]) {
      const questTemplate = PROLOGUE_QUESTS[playerSeed.prologueQuestId];
      worldState.player.quests = worldState.player.quests || {};
      
      // Store only the player quest state (metadata), not the full quest definition
      worldState.player.quests[playerSeed.prologueQuestId] = {
        status: 'in_progress',
        startedAt: worldState.tick || 0
      };

      // Store full quest definition in worldState.quests if available
      if (!worldState.quests) {
        worldState.quests = [];
      }
      
      const existingQuestIdx = worldState.quests.findIndex(q => q.id === playerSeed.prologueQuestId);
      if (existingQuestIdx === -1) {
        worldState.quests.push({
          id: questTemplate.questId,
          title: questTemplate.title,
          description: questTemplate.description,
          objectives: questTemplate.objectives.map(obj => ({
            type: obj.type as any,
            target: obj.description
          })),
          rewards: questTemplate.reward,
          giverNpcId: 'quest-system',
          status: 'active'
        });
      }
    }

    // 4. Store narrative flags for world branching
    if (Object.keys(playerSeed.narrativeFlags).length > 0) {
      worldState.player.knowledgeBase = Array.isArray(worldState.player.knowledgeBase)
        ? [...(worldState.player.knowledgeBase as string[]), ...Object.keys(playerSeed.narrativeFlags)]
        : worldState.player.knowledgeBase || [];
    }
  }

  /**
   * Apply talent and archetype modifiers to player stats
   */
  static applyModifiersToPlayer(player: PlayerState, modifiers: PlayerModifiers): void {
    if (!player.stats) return;

    // Apply stat modifiers from talents/archetype
    if (modifiers.strModifier) player.stats.str += modifiers.strModifier;
    if (modifiers.agiModifier) player.stats.agi += modifiers.agiModifier;
    if (modifiers.intModifier) player.stats.int += modifiers.intModifier;
    if (modifiers.chaModifier) player.stats.cha += modifiers.chaModifier;
    if (modifiers.endModifier) player.stats.end += modifiers.endModifier;
    if (modifiers.lukModifier) player.stats.luk += modifiers.lukModifier;
    if (modifiers.perceptionModifier) player.stats.perception = (player.stats.perception || 10) + modifiers.perceptionModifier;

    // Apply other bonuses
    if (modifiers.goldMultiplier && player.gold) {
      player.gold = Math.floor(player.gold * modifiers.goldMultiplier);
    }

    // Store modifiers in player state for reference
    (player as any).appliedModifiers = modifiers;
  }
}

export default NarrativeSeedProcessor;
