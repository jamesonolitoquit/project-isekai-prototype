/**
 * M34: Global Achievement Ledger (World-First System)
 * 
 * Tracks achievements across all sessions/chronicles for a specific world template.
 * "World-Firsts" are achievements earned by the first player/session to accomplish them globally.
 * Achievements are broadcast as hard-canon rumors across all active sessions.
 */

import { LegacyImpact } from './legacyEngine';
import { HardCanonEvent } from './loreEngine';

/**
 * M34: World-First Achievement definition
 */
export interface WorldFirstAchievement {
  id: string; // Unique achievement ID
  name: string; // Display name
  description: string; // What triggers this achievement
  templateId: string; // World template this achievement belongs to
  earnedBy: string; // Session/chronicle ID that earned it
  earnedByPlayer: string; // Character name/player ID
  timestamp: number; // When it was earned
  reward: AchievementReward; // What it grants
  isHardCanon: boolean; // Whether this became canon event
  epicness: number; // 0-100 scale for narrative weight
}

/**
 * M34: What achievements reward
 */
export interface AchievementReward {
  legacyPoints: number; // Added to lineage pool
  chronicleNotoriety: number; // Fame increase
  narrativeWeight: number; // Impacts prophecy generation
  specialItem?: string; // Optional item granted
  specialPerk?: string; // Optional ability unlock
  worldTrait?: string; // Trait added to world template
}

/**
 * M34: Pre-defined achievements (50 base achievements)
 */
const ACHIEVEMENT_REGISTRY: Record<string, Omit<WorldFirstAchievement, 'id' | 'templateId' | 'earnedBy' | 'earnedByPlayer' | 'timestamp' | 'isHardCanon'>> = {
  'FIRST_DRAGON_SLAIN': {
    name: 'Dragon Slayer',
    description: 'Defeat the first dragon in the world',
    reward: { legacyPoints: 500, chronicleNotoriety: 250, narrativeWeight: 50, specialPerk: 'scales_resistance' },
    epicness: 95
  },
  'FIRST_DEITY_SUMMONED': {
    name: 'Divine Communion',
    description: 'Successfully summon a deity',
    reward: { legacyPoints: 750, chronicleNotoriety: 400, narrativeWeight: 80, specialItem: 'divine_seal' },
    epicness: 100
  },
  'FIRST_BLOODLINE_AWAKENED': {
    name: 'Lineage Ascendant',
    description: 'Unlock bloodline powers in a bloodline',
    reward: { legacyPoints: 300, chronicleNotoriety: 150, narrativeWeight: 40, worldTrait: 'bloodline_clarity' },
    epicness: 85
  },
  'FIRST_PROPHECY_FULFILLED': {
    name: 'Fate Weaver',
    description: 'Complete a prophecy before it expires',
    reward: { legacyPoints: 400, chronicleNotoriety: 200, narrativeWeight: 60, specialPerk: 'prophecy_insight' },
    epicness: 90
  },
  'FIRST_FACTION_UNIFIED': {
    name: 'Unity Brought',
    description: 'Achieve maximum reputation with all factions',
    reward: { legacyPoints: 600, chronicleNotoriety: 350, narrativeWeight: 70, worldTrait: 'unified_factions' },
    epicness: 88
  },
  'FIRST_EPOCH_TRANSITIONED': {
    name: 'Age Changer',
    description: 'Successfully transition to the next epoch',
    reward: { legacyPoints: 800, chronicleNotoriety: 500, narrativeWeight: 85, specialItem: 'epoch_catalyst' },
    epicness: 98
  },
  'FIRST_PARTY_FORMED': {
    name: 'Bond Forged',
    description: 'Form a player party with 3+ members',
    reward: { legacyPoints: 200, chronicleNotoriety: 100, narrativeWeight: 25, specialPerk: 'party_harmony' },
    epicness: 60
  },
  'FIRST_LEGENDARY_ITEM_FOUND': {
    name: 'Legendary Finder',
    description: 'Find the first legendary item in the world',
    reward: { legacyPoints: 350, chronicleNotoriety: 175, narrativeWeight: 45, worldTrait: 'legendary_awakened' },
    epicness: 80
  },
  'FIRST_WORLD_BOSS_DEFEATED': {
    name: 'Apex Predator',
    description: 'Defeat the world boss',
    reward: { legacyPoints: 900, chronicleNotoriety: 600, narrativeWeight: 95, specialPerk: 'apex_resilience' },
    epicness: 99
  },
  'FIRST_HIDDEN_AREA_DISCOVERED': {
    name: 'Secret Keeper',
    description: 'Discover a hidden world area',
    reward: { legacyPoints: 250, chronicleNotoriety: 125, narrativeWeight: 30, worldTrait: 'hidden_revealed' },
    epicness: 70
  },
  'FIRST_NPC_ROMANCE_COMPLETED': {
    name: 'Heart Breaker',
    description: 'Complete a romance questline with an NPC',
    reward: { legacyPoints: 300, chronicleNotoriety: 150, narrativeWeight: 35, specialPerk: 'romantic_favor' },
    epicness: 72
  },
  'FIRST_PARADOX_BLOOM_RESOLVED': {
    name: 'Paradox Resolver',
    description: 'Resolve a temporal paradox bloom event',
    reward: { legacyPoints: 700, chronicleNotoriety: 400, narrativeWeight: 75, specialPerk: 'temporal_stability' },
    epicness: 92
  },
  'FIRST_STRAND_PHANTOM_ENCOUNTERED': {
    name: 'Phantom Witness',
    description: 'Encounter a Strand Phantom from another timeline',
    reward: { legacyPoints: 280, chronicleNotoriety: 140, narrativeWeight: 40, worldTrait: 'phantom_aware' },
    epicness: 75
  },
  'FIRST_MULTIPLAYER_QUEST_COMPLETED': {
    name: 'Fellowship Bound',
    description: 'Complete a co-op quest with other players',
    reward: { legacyPoints: 350, chronicleNotoriety: 175, narrativeWeight: 50, specialPerk: 'coop_synergy' },
    epicness: 78
  },
  'FIRST_RESOURCE_MONOPOLY': {
    name: 'Collector Supreme',
    description: 'Collect 100+ of a single resource type',
    reward: { legacyPoints: 150, chronicleNotoriety: 75, narrativeWeight: 15, specialPerk: 'resource_insight' },
    epicness: 50
  },
  'FIRST_TIME_LOOP_SURVIVED': {
    name: 'Loop Master',
    description: 'Survive 5+ time loops in a single session',
    reward: { legacyPoints: 550, chronicleNotoriety: 300, narrativeWeight: 65, specialPerk: 'loop_knowledge' },
    epicness: 87
  },
  'FIRST_ANCIENT_RUNE_DECODED': {
    name: 'Runestone Sage',
    description: 'Decode an ancient rune language',
    reward: { legacyPoints: 320, chronicleNotoriety: 160, narrativeWeight: 45, specialPerk: 'runic_understanding' },
    epicness: 76
  },
  'FIRST_CURSE_BROKEN': {
    name: 'Curse Breaker',
    description: 'Break a world curse',
    reward: { legacyPoints: 600, chronicleNotoriety: 350, narrativeWeight: 70, specialItem: 'purification_token' },
    epicness: 89
  },
  'FIRST_ARTIFACT_ASSEMBLED': {
    name: 'Artifact Master',
    description: 'Collect and assemble all pieces of an artifact',
    reward: { legacyPoints: 500, chronicleNotoriety: 250, narrativeWeight: 60, specialPerk: 'artifact_attunement' },
    epicness: 85
  },
  'FIRST_MIRACLE_PERFORMED': {
    name: 'Holy Champion',
    description: 'Cast a divine miracle at maximum piety',
    reward: { legacyPoints: 450, chronicleNotoriety: 225, narrativeWeight: 55, specialPerk: 'divine_favor' },
    epicness: 82
  },
  'FIRST_NIGHTMARE_VANQUISHED': {
    name: 'Dream Slayer',
    description: 'Defeat a nightmare/void entity',
    reward: { legacyPoints: 680, chronicleNotoriety: 380, narrativeWeight: 72, specialPerk: 'void_resistance' },
    epicness: 91
  },
  'FIRST_SEASON_TRIGGERED': {
    name: 'Season Changer',
    description: 'Trigger the first seasonal change event',
    reward: { legacyPoints: 200, chronicleNotoriety: 100, narrativeWeight: 30, worldTrait: 'seasonal_cycle_active' },
    epicness: 65
  },
  'FIRST_FORBIDDEN_SPELL_LEARNED': {
    name: 'Forbidden Knowledge',
    description: 'Learn a forbidden/dark spell',
    reward: { legacyPoints: 400, chronicleNotoriety: 200, narrativeWeight: 50, specialPerk: 'void_caster' },
    epicness: 80
  },
  'FIRST_SANCTUARY_CONSECRATED': {
    name: 'Holy Ground Maker',
    description: 'Consecrate a sacred sanctuary',
    reward: { legacyPoints: 350, chronicleNotoriety: 175, narrativeWeight: 45, worldTrait: 'sanctuary_blessed' },
    epicness: 77
  },
  'FIRST_HEIRLOOM_AWAKENED': {
    name: 'Heirloom Keeper',
    description: 'Awaken a dormant heirloom item',
    reward: { legacyPoints: 380, chronicleNotoriety: 190, narrativeWeight: 48, specialPerk: 'heirloom_resonance' },
    epicness: 79
  },
  'FIRST_MYSTERY_SOLVED': {
    name: 'Mystery Solver',
    description: 'Solve a major world mystery',
    reward: { legacyPoints: 320, chronicleNotoriety: 160, narrativeWeight: 42, specialPerk: 'lore_master' },
    epicness: 74
  },
  'FIRST_ANCIENT_CIVILIZATION_AWAKENED': {
    name: 'Archaeologist',
    description: 'Awaken an ancient civilization',
    reward: { legacyPoints: 700, chronicleNotoriety: 400, narrativeWeight: 75, worldTrait: 'ancient_risen' },
    epicness: 94
  },
  'FIRST_RITUAL_COMPLETED': {
    name: 'Ritual Master',
    description: 'Complete a complex ritual successfully',
    reward: { legacyPoints: 350, chronicleNotoriety: 175, narrativeWeight: 50, specialPerk: 'ritual_affinity' },
    epicness: 77
  },
  'FIRST_CATASTROPHE_SURVIVED': {
    name: 'Survivor',
    description: 'Survive a catastrophic world event',
    reward: { legacyPoints: 550, chronicleNotoriety: 300, narrativeWeight: 65, specialPerk: 'survivor_fortitude' },
    epicness: 86
  },
  'FIRST_TRANSCENDENT_FORM_ACHIEVED': {
    name: 'Transcendent',
    description: 'Achieve transcendent form/state',
    reward: { legacyPoints: 1000, chronicleNotoriety: 700, narrativeWeight: 99, specialPerk: 'transcendence' },
    epicness: 100
  }
};

/**
 * M34: World-First Ledger - tracks all achievements per world template
 */
export class WorldFirstLedger {
  private achievements: Map<string, WorldFirstAchievement> = new Map();
  private templateId: string;
  private version: number = 1;

  constructor(templateId: string) {
    this.templateId = templateId;
  }

  /**
   * M34: Check if an achievement can be earned (hasn't been earned yet)
   */
  canEarnAchievement(achievementKey: string): boolean {
    // Create a composite key to avoid duplicates across sessions
    const compositeKey = `${this.templateId}:${achievementKey}`;
    return !this.achievements.has(compositeKey);
  }

  /**
   * M34: Earn an achievement globally
   */
  earnAchievement(
    achievementKey: string,
    sessionId: string,
    playerName: string,
    customReward?: Partial<AchievementReward>
  ): WorldFirstAchievement | null {
    if (!this.canEarnAchievement(achievementKey)) {
      return null; // Already earned by someone else
    }

    const baseTemplate = ACHIEVEMENT_REGISTRY[achievementKey];
    if (!baseTemplate) {
      console.warn(`Unknown achievement: ${achievementKey}`);
      return null;
    }

    const compositeKey = `${this.templateId}:${achievementKey}`;
    const achievement: WorldFirstAchievement = {
      id: achievementKey,
      name: baseTemplate.name,
      description: baseTemplate.description,
      templateId: this.templateId,
      earnedBy: sessionId,
      earnedByPlayer: playerName,
      timestamp: Date.now(),
      reward: { ...baseTemplate.reward, ...customReward },
      isHardCanon: baseTemplate.epicness >= 70, // Achievements with high epicness become hard canon
      epicness: baseTemplate.epicness
    };

    this.achievements.set(compositeKey, achievement);
    return achievement;
  }

  /**
   * M34: Get an achievement if it's been earned
   */
  getAchievement(achievementKey: string): WorldFirstAchievement | undefined {
    const compositeKey = `${this.templateId}:${achievementKey}`;
    return this.achievements.get(compositeKey);
  }

  /**
   * M34: Get all earned achievements
   */
  getAllAchievements(): WorldFirstAchievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * M34: Get achievements that became hard canon (high epicness)
   */
  getHardCanonAchievements(): WorldFirstAchievement[] {
    return this.getAllAchievements().filter(a => a.isHardCanon);
  }

  /**
   * M34: Calculate total legacy points from achievements
   */
  getTotalLegacyPoints(): number {
    return this.getAllAchievements().reduce((sum, a) => sum + a.reward.legacyPoints, 0);
  }

  /**
   * M34: Get world traits added by achievements
   */
  getWorldTraits(): string[] {
    const traits: string[] = [];
    for (const achievement of this.getAllAchievements()) {
      if (achievement.reward.worldTrait) {
        traits.push(achievement.reward.worldTrait);
      }
    }
    return Array.from(new Set(traits)); // Deduplicate
  }

  /**
   * M34: Estimate world corruption reduction from achievements
   */
  estimateCorruptionReduction(): number {
    const traits = this.getWorldTraits();
    return Math.min(traits.length * 5, 50); // Up to 50% reduction from traits
  }

  /**
   * M34: Serialize ledger for network transmission
   */
  serialize(): {
    templateId: string;
    version: number;
    achievements: WorldFirstAchievement[];
    timestamp: number;
  } {
    return {
      templateId: this.templateId,
      version: this.version,
      achievements: this.getAllAchievements(),
      timestamp: Date.now()
    };
  }

  /**
   * M34: Deserialize ledger from transmitted data
   */
  static deserialize(data: {
    templateId: string;
    version: number;
    achievements: WorldFirstAchievement[];
  }): WorldFirstLedger {
    const ledger = new WorldFirstLedger(data.templateId);
    ledger.version = data.version;

    for (const achievement of data.achievements) {
      const compositeKey = `${data.templateId}:${achievement.id}`;
      ledger.achievements.set(compositeKey, achievement);
    }

    return ledger;
  }
}

/**
 * M34: Global achievement tracker (one per world template)
 */
export const GLOBAL_ACHIEVEMENT_LEDGERS: Map<string, WorldFirstLedger> = new Map();

/**
 * M34: Get or create a ledger for a template
 */
export function getLedgerForTemplate(templateId: string): WorldFirstLedger {
  if (!GLOBAL_ACHIEVEMENT_LEDGERS.has(templateId)) {
    GLOBAL_ACHIEVEMENT_LEDGERS.set(templateId, new WorldFirstLedger(templateId));
  }
  return GLOBAL_ACHIEVEMENT_LEDGERS.get(templateId)!;
}

/**
 * M34: Convert achievement to hard-canon event for lore propagation
 */
export function achievementToHardCanonEvent(achievement: WorldFirstAchievement): HardCanonEvent {
  // Create a HardCanonEvent with required fields
  return {
    id: `achievement:${achievement.id}:${achievement.timestamp}`,
    name: `World-First: ${achievement.name}`,
    worldInstanceId: 'all', // Applies to all instances
    actorId: achievement.earnedBy,
    type: 'world-first-achievement' as any,
    payload: {
      achievementName: achievement.name,
      player: achievement.earnedByPlayer,
      reward: achievement.reward,
      worldTraits: achievement.reward.worldTrait ? [achievement.reward.worldTrait] : [],
      narrativeImpact: achievement.reward.narrativeWeight
    },
    timestamp: achievement.timestamp
  };
}

/**
 * M34: Check for and handle potential achievement triggers during world updates
 */
export function checkAchievementTriggers(
  templateId: string,
  sessionId: string,
  playerName: string,
  worldState: any,
  lastWorldState?: any
): WorldFirstAchievement[] {
  const ledger = getLedgerForTemplate(templateId);
  const earned: WorldFirstAchievement[] = [];

  // Check various achievement conditions
  const checks = [
    {
      key: 'FIRST_LEGENDARY_ITEM_FOUND',
      check: () => {
        const newLegendaryCount = worldState.resourceNodes?.filter((r: any) => r.rarity === 'legendary').length || 0;
        const oldLegendaryCount = lastWorldState?.resourceNodes?.filter((r: any) => r.rarity === 'legendary').length || 0;
        return newLegendaryCount > oldLegendaryCount;
      }
    },
    {
      key: 'FIRST_EPOCH_TRANSITIONED',
      check: () => worldState.currentEpoch !== lastWorldState?.currentEpoch
    },
    {
      key: 'FIRST_SEASON_TRIGGERED',
      check: () => worldState.season !== lastWorldState?.season
    },
    {
      key: 'FIRST_FACTION_UNIFIED',
      check: () => {
        const allMaxRep = worldState.factions?.every((f: any) => f.playerReputation >= 100) || false;
        return allMaxRep && !lastWorldState?.factions?.every((f: any) => f.playerReputation >= 100);
      }
    }
  ];

  for (const { key, check } of checks) {
    if (ledger.canEarnAchievement(key)) {
      try {
        if (check()) {
          const achievement = ledger.earnAchievement(key, sessionId, playerName);
          if (achievement) {
            earned.push(achievement);
          }
        }
      } catch (error) {
        console.error(`Error checking achievement ${key}:`, error);
      }
    }
  }

  return earned;
}

/**
 * M34: Get achievement statistics for world
 */
export function getAchievementStats(templateId: string): {
  totalEarned: number;
  hardCanonCount: number;
  totalLegacyPoints: number;
  corruptionReductionEstimate: number;
  topAchievements: WorldFirstAchievement[];
} {
  const ledger = getLedgerForTemplate(templateId);
  const achievements = ledger.getAllAchievements();

  return {
    totalEarned: achievements.length,
    hardCanonCount: ledger.getHardCanonAchievements().length,
    totalLegacyPoints: ledger.getTotalLegacyPoints(),
    corruptionReductionEstimate: ledger.estimateCorruptionReduction(),
    topAchievements: achievements
      .sort((a, b) => b.epicness - a.epicness)
      .slice(0, 5)
  };
}
