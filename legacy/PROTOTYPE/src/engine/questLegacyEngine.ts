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
// ============================================================================
// PHASE 30: ANCESTRAL GRAVE SPAWNING - ECHOES OF HISTORY
// ============================================================================

/**
 * Ancestral Grave NPC: Physical manifestation of an ancestor's death site
 * Phase 30 Task 2: Spawn as interactive ghost NPCs at failure locations
 */
export interface AncestralGrave {
  id: string;
  ancestorName: string;
  ancestorMythStatus: number;
  graveLocation: string;
  graveCoordinates?: { x: number; y: number };
  deathCause: string;
  generationsPassed: number;
  npcEchoId: string;  // Reference to spawned NPC
  questsAvailable: string[];  // Linked redemption quests
  discoveredBy: string[];  // Player IDs who found it
  isActive: boolean;
}

/**
 * Spawn an Ancestral Grave NPC at a failure location
 * Creates a ghost/echo NPC that the player can interact with
 * 
 * @param failure - AncestralFailure describing where ancestor died
 * @param ancestor - LegacyImpact with ancestor's full history
 * @param locationId - World location ID where grave should spawn
 * @param seed - Random seed for grave generation
 * @returns Ancestral Grave definition and associated quest IDs
 */
export function spawnAncestralGrave(
  failure: AncestralFailure,
  ancestor: LegacyImpact,
  locationId: string,
  seed: number
): { grave: AncestralGrave; linkedQuestIds: string[] } {
  const rng = new SeededRng(seed);
  
  const graveId = `grave_${ancestor.canonicalName.replace(/\s+/g, '_')}_${locationId}`;
  const npcEchoId = `echo_${graveId}`;
  
  // Create grave definition
  const grave: AncestralGrave = {
    id: graveId,
    ancestorName: ancestor.canonicalName,
    ancestorMythStatus: ancestor.mythStatus,
    graveLocation: locationId,
    graveCoordinates: {
      x: rng.nextInt(0, 100),
      y: rng.nextInt(0, 100)
    },
    deathCause: failure.failureReason,
    generationsPassed: ancestor.epochsLived || 1,
    npcEchoId,
    questsAvailable: [],
    discoveredBy: [],
    isActive: true
  };
  
  // Create associated redemption quest
  const redemptionQuest = generateRedemptionQuest(failure, 'Descendant', seed);
  grave.questsAvailable.push(redemptionQuest.id);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[AncestralGrave] Spawned grave for ${ancestor.canonicalName} at ${locationId} with quest ${redemptionQuest.id}`
    );
  }
  
  return {
    grave,
    linkedQuestIds: [redemptionQuest.id]
  };
}

/**
 * Convert an Ancestral Grave into an NPC that players can interact with
 * The NPC serves as a "ghost" or "echo" of the ancestor
 * 
 * @param grave - AncestralGrave to convert to NPC
 * @param seed - Random seed for NPC generation
 * @returns NPC representation of the ancestral grave
 */
export function createAncestralGraveNPC(
  grave: AncestralGrave,
  seed: number
): NPC {
  const rng = new SeededRng(seed);
  
  const echoNpc: NPC = {
    id: grave.npcEchoId,
    name: `Echo of ${grave.ancestorName}`,
    displayName: `${grave.ancestorName}'s Ghost`,
    description: `The spectral form of your ancestor. They died attempting: "${grave.deathCause}"`,
    location: grave.graveLocation,
    status: 'active',
    factionRole: 'guide',  // Ghosts guide descendants
    importance: grave.ancestorMythStatus > 70 ? 'legendary' : 'major',
    personality: {
      combat: 'avoidant',  // Ghosts don't fight
      social: 'melancholy',
      cooperation: 'helpful'  // Helps descendants complete their quests
    },
    stats: {
      str: 0,  // Ghosts have no physical stats
      agi: 0,
      int: grave.ancestorMythStatus,  // Knowledge-based stat
      cha: Math.max(10, grave.ancestorMythStatus / 2),  // Charisma based on legacy
      end: 0,
      luk: 0
    },
    currentHp: 100,  // Ghosts don't die
    maxHp: 100,
    abilities: ['speak', 'guide', 'provide_quest'],
    factionId: 'ancestral_legacy',
    reputation: 0,  // Neutrality
    isUnique: true,
    isEcho: true,  // Mark as echo/ghost
    echoOf: grave.ancestorName,
    linkedGraveId: grave.id,
    dialogueOverrides: {
      greeting: `I am the echo of ${grave.ancestorName}. My quest remains unfinished...`,
      onQuestAccept: `Thank you, descendant. Finish what I could not.`,
      onQuestComplete: `You have honored my memory. Our bloodline grows stronger.`
    }
  };
  
  return echoNpc;
}

/**
 * Generate all ancestral graves for the current player based on their heritage
 * Called on world initialization to populate graves
 * 
 * @param legacyImpacts - Array of previous generation legacies
 * @param currentLocationIds - Available location IDs in world
 * @param worldSeed - World seed for reproducible generation
 * @returns Array of graves to spawn and their linked quests
 */
export function generateAllAncestralGraves(
  legacyImpacts: LegacyImpact[],
  currentLocationIds: string[],
  worldSeed: number
): Array<{ grave: AncestralGrave; linkedQuestIds: string[]; npc: NPC }> {
  const graves: Array<{ grave: AncestralGrave; linkedQuestIds: string[]; npc: NPC }> = [];
  
  if (legacyImpacts.length === 0) {
    return graves;
  }
  
  const failures = extractAncestralFailures(legacyImpacts);
  
  // Spawn graves for significant ancestors (myth status > 40)
  legacyImpacts.forEach((ancestor, ancestorIdx) => {
    if (ancestor.mythStatus < 40) {
      return;  // Skip low-myth ancestors
    }
    
    // Find failures related to this ancestor
    const ancestorFailures = failures.filter(f => f.ancestorName === ancestor.canonicalName);
    
    ancestorFailures.forEach((failure, failureIdx) => {
      // Select a location from available locations (hash-based for reproducibility)
      const locationIdx = (ancestorIdx * 1000 + failureIdx) % currentLocationIds.length;
      const graveLocation = currentLocationIds[locationIdx];
      
      const graveSeed = worldSeed + ancestorIdx * 10000 + failureIdx * 100;
      
      const { grave, linkedQuestIds } = spawnAncestralGrave(
        failure,
        ancestor,
        graveLocation,
        graveSeed
      );
      
      const npc = createAncestralGraveNPC(grave, graveSeed);
      
      graves.push({
        grave,
        linkedQuestIds,
        npc
      });
    });
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AncestralGraves] Generated ${graves.length} ancestral graves from ${legacyImpacts.length} ancestors`);
  }
  
  return graves;
}

/**
 * Check if a location has ancestral graves and return them
 * Used during navigation to trigger grave discovery
 * 
 * @param locationId - Location to check
 * @param allGraves - Array of all spawned graves
 * @returns Graves at this location
 */
export function getGravesAtLocation(
  locationId: string,
  allGraves: AncestralGrave[]
): AncestralGrave[] {
  return allGraves.filter(g => g.graveLocation === locationId && g.isActive);
}

/**
 * Mark a grave as discovered by a player
 * Triggers grave discovery narrative event
 * 
 * @param grave - Grave that was discovered
 * @param playerId - Player who discovered it
 * @returns Updated grave with discovery recorded
 */
export function discoverAncestralGrave(
  grave: AncestralGrave,
  playerId: string
): AncestralGrave {
  if (!grave.discoveredBy.includes(playerId)) {
    grave.discoveredBy.push(playerId);
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AncestralGrave] ${playerId} discovered grave of ${grave.ancestorName}`);
  }
  
  return grave;
}

/**
 * Deactivate a grave after its associated quests are completed
 * Optional: can keep graves active for repeated visits
 * 
 * @param grave - Grave to deactivate
 * @param reason - Why the grave is being deactivated
 * @returns Updated grave
 */
export function deactivateAncestralGrave(
  grave: AncestralGrave,
  reason: string = 'quests_completed'
): AncestralGrave {
  grave.isActive = false;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AncestralGrave] Deactivated ${grave.ancestorName}'s grave: ${reason}`);
  }
  
  return grave;
}