/**
 * questLegacyEngine.ts - M30 Task 3: AI DM Legacy-Aware Quest Generation
 * 
 * Generates quests based on ancestral failures and achievements.
 * Allows descendants to "redeem" or continue ancestral storylines.
 */

import type { Quest, QuestObjective, NPC } from './worldEngine';
import type { LegacyImpact } from './legacyEngine';
import { SeededRng } from './prng';

export interface AncestralFailure {
  questId: string;
  questTitle: string;
  failureLocation: string;
  failureReason: string;
  ancestorName: string;
  remainsLocation?: string;
}

export interface RedemptionQuest extends Quest {
  isRedemption: boolean;
  linkedAncestor: string;
  ancestralFailureRef: string;
  redemptionReward: {
    honoring_bonus: number; // Myth status bonus
    ancestralPerk?: string;
  };
}

/**
 * Extract failed quests from ancestor's deeds and quest history
 * Used to identify opportunities for redemption quests
 */
export function extractAncestralFailures(
  legacyImpacts: LegacyImpact[],
  failedQuestIds: string[] = []
): AncestralFailure[] {
  const failures: AncestralFailure[] = [];

  legacyImpacts.forEach((ancestor, genIndex) => {
    // Deeds that mention failure or death
    const failingDeeds = ancestor.deeds.filter(deed =>
      deed.toLowerCase().includes('failed') ||
      deed.toLowerCase().includes('died') ||
      deed.toLowerCase().includes('defeated') ||
      deed.toLowerCase().includes('perished')
    );

    failingDeeds.forEach(deed => {
      // Extract location from deed if possible (e.g., "...in the Shadow Caves...")
      const locationMatch = deed.match(/\b(in|at|near) the ([A-Z][a-zA-Z\s]+)/);
      const location = locationMatch ? locationMatch[2] : 'Unknown Location';

      failures.push({
        questId: `ancestral_failure_${genIndex}_${failures.length}`,
        questTitle: deed,
        failureLocation: location,
        failureReason: deed,
        ancestorName: ancestor.canonicalName,
        remainsLocation: location
      });
    });
  });

  return failures;
}

/**
 * Generate a "Redemption Quest" for the descendant to complete an ancestor's unfinished business
 */
export function generateRedemptionQuest(
  ancestralFailure: AncestralFailure,
  descendantName: string,
  seed: number
): RedemptionQuest {
  const rng = new SeededRng(seed + ancestralFailure.questId.charCodeAt(0));

  const redemptionTitle = `The ${ancestralFailure.ancestorName}'s Unfinished Tale`;
  const redemptionDescription = `Your ancestor, ${ancestralFailure.ancestorName}, fell while attempting: "${ancestralFailure.failureReason}". The ruins of their quest remain in ${ancestralFailure.failureLocation}. Complete what they could not.`;

  const objectives: QuestObjective[] = [
    {
      type: 'visit',
      location: ancestralFailure.remainsLocation || ancestralFailure.failureLocation
    },
    {
      type: 'combat',
      target: 'Ancestral Echo or Guardian',
      quantity: 1
    },
    {
      type: 'gather',
      target: `${ancestralFailure.ancestorName}'s memento`,
      quantity: 1
    }
  ];

  const quest: RedemptionQuest = {
    id: `redemption_${ancestralFailure.questId}`,
    title: redemptionTitle,
    description: redemptionDescription,
    objectives,
    isRedemption: true,
    linkedAncestor: ancestralFailure.ancestorName,
    ancestralFailureRef: ancestralFailure.questId,
    rewards: {
      experience: 500 + (rng.nextInt(0, 200)),
      items: [
        {
          itemId: `ancestral_${ancestralFailure.questId}`,
          rarity: 'rare',
          description: `A memento from ${ancestralFailure.ancestorName}`
        }
      ]
    },
    redemptionReward: {
      honoring_bonus: 15, // +15 myth status for honoring ancestor
      ancestralPerk: `${ancestralFailure.ancestorName}'s Courage`
    },
    expiresInHours: 48,
    persist_across_epochs: true
  };

  return quest;
}

/**
 * Generate multiple redemption quests from a bloodline's ancestral failures
 * Creates opportunities for descendants to honor and redeem ancestral stories
 */
export function generateRedemptionQuestBatch(
  legacyImpacts: LegacyImpact[],
  descendantName: string,
  worldSeed: number,
  maxQuests: number = 3
): RedemptionQuest[] {
  const ancestralFailures = extractAncestralFailures(legacyImpacts);
  
  // Select most recent and significant failures
  const selectedFailures = ancestralFailures
    .slice(-maxQuests) // Most recent
    .reverse();

  return selectedFailures.map((failure, idx) =>
    generateRedemptionQuest(failure, descendantName, worldSeed + idx * 1000)
  );
}

/**
 * Create a "Legacy Echo" quest that references a great ancestor's deeds
 * Different from Redemption Quest - this is about *honoring* rather than *redeeming*
 */
export function generateLegacyEchoQuest(
  ancestor: LegacyImpact,
  seed: number
): Quest {
  const rng = new SeededRng(seed);

  // Pick a random deed to echo
  const heroicDeed = ancestor.deeds[Math.floor(rng.nextInt(0, ancestor.deeds.length))];

  const quest: Quest = {
    id: `legacy_echo_${ancestor.canonicalName}_${seed}`,
    title: `Echo of ${ancestor.canonicalName}`,
    description: `Your ancestor ${ancestor.canonicalName} once achieved: "${heroicDeed}". The world remembers their glory. Seek to match or surpass this deed in spirit.`,
    objectives: [
      {
        type: 'exploration'
      },
      {
        type: 'challenge'
      }
    ],
    rewards: {
      experience: Math.floor(300 + (ancestor.mythStatus * 2)),
      gold: Math.floor(50 + (ancestor.mythStatus / 2))
    },
    expiresInHours: 72,
    persist_across_epochs: true
  };

  return quest;
}

/**
 * Check if descendant is eligible to receive redemption quests
 * (Must have at least one ancestor with failed deeds)
 */
export function canGenerateRedemptionQuests(legacyImpacts: LegacyImpact[]): boolean {
  return legacyImpacts.some(ancestor =>
    ancestor.deeds.some(deed =>
      deed.toLowerCase().includes('failed') ||
      deed.toLowerCase().includes('died') ||
      deed.toLowerCase().includes('perished')
    )
  );
}

/**
 * Calculate redemption bonus for completing an ancestral quest
 * Factors: generations passed, ancestor myth status, quest difficulty
 */
export function calculateRedemptionBonus(
  ancestor: LegacyImpact,
  generationDistance: number
): {
  mythStatusBonus: number;
  reputationBonus: Record<string, number>;
  specialPerk?: string;
} {
  // Bonus decays with generations (each generation halves bonus)
  const generationDecay = Math.pow(0.8, Math.max(0, generationDistance - 1));
  const mythBonus = Math.floor(ancestor.mythStatus * 0.3 * generationDecay);

  const repBonus: Record<string, number> = {};
  Object.entries(ancestor.factionInfluence).forEach(([factionId, rep]) => {
    repBonus[factionId] = Math.floor((rep as number) * 0.2 * generationDecay);
  });

  let specialPerk: string | undefined;
  if (ancestor.mythStatus >= 80 && generationDistance <= 2) {
    specialPerk = `${ancestor.canonicalName}'s Blessing`; // Temporary passive bonus
  }

  return {
    mythStatusBonus: mythBonus,
    reputationBonus: repBonus,
    specialPerk
  };
}
