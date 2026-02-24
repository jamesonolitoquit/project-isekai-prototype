/**
 * M63-C: Tier 3 Tutorial System - Director & Weaver Paths
 * 
 * Final tutorial tier for beta graduation:
 * - Director Path: Shape world direction via macro events + faction influence
 * - Weaver Path: Craft legendaries + build NPC social networks
 * - Both paths culminate in "Ascending to Legend" (myth rank 5+)
 */

/**
 * Tier 3 milestone categories
 */
export type Tier3Path = 'director' | 'weaver';
export type Tier3Milestone = 
  | 'directors_first_gambit'       // Trigger 1st macro event
  | 'directors_trilogy'            // Trigger 3 macro events
  | 'world_shaper'                 // All 3 event types triggered
  | 'weavers_first_bond'           // Create first strong NPC relationship
  | 'weavers_tapestry'             // 5+ unique high-affinity relationships
  | 'legendary_crafter'            // Create 3 legendary artifacts
  | 'echo_resonance'               // Reach myth rank 5
  | 'bloodline_eternal'            // Complete one full inheritance cycle
  | 'multiplayer_consensus'        // Win one democratic vote in 16-peer
  | 'paradox_master';              // Trigger & survive paradox spike recovery

/**
 * Tier 3 milestone definition
 */
export interface Tier3MilestoneData {
  id: Tier3Milestone;
  path: Tier3Path;
  title: string;
  description: string;
  objective: string;
  rewardLP: number;
  rewardXP: number;
  rewardArtifacts?: string[];      // Special legendary items
  rewardPerk?: string;              // Gameplay enhancement
  unlocks?: string[];               // Next milestones, achievements
  estimatedTicks: number;           // Approximate ticks to complete
  difficulty: 'medium' | 'hard' | 'expert';
}

// ============================================================================
// DIRECTOR PATH: Macro Events & Faction Influence
// ============================================================================

export const DIRECTOR_MILESTONES: Partial<Record<Tier3Milestone, Tier3MilestoneData>> = {
  'directors_first_gambit': {
    id: 'directors_first_gambit',
    path: 'director',
    title: '🎭 Director\'s First Gambit',
    description: 'Trigger your first macro event to shape the world',
    objective: 'Trigger any macro event (Festival, Plague, Coup, Natural Disaster)',
    rewardLP: 50,
    rewardXP: 500,
    unlocks: ['directors_trilogy', 'world_shaper'],
    estimatedTicks: 500,
    difficulty: 'medium'
  },

  'directors_trilogy': {
    id: 'directors_trilogy',
    path: 'director',
    title: '🎖️ Director\'s Trilogy',
    description: 'Orchestrate 3 major events to guide world history',
    objective: 'Successfully trigger 3 distinct macro events in one epoch',
    rewardLP: 150,
    rewardXP: 1500,
    rewardPerk: 'Director\'s Foresight',   // +25% chance to predict NPC actions
    unlocks: ['world_shaper', 'echo_resonance'],
    estimatedTicks: 1500,
    difficulty: 'hard'
  },

  'world_shaper': {
    id: 'world_shaper',
    path: 'director',
    title: '🌍 World Shaper',
    description: 'Control all three types of macro events',
    objective: 'Trigger Festival, Plague/Disaster, and Coup in same epoch',
    rewardLP: 250,
    rewardXP: 2500,
    rewardArtifacts: ['orb_of_command'],  // Director artifact: +1 macro event/epoch
    unlocks: ['multiplayer_consensus'],
    estimatedTicks: 2000,
    difficulty: 'expert'
  },

  'multiplayer_consensus': {
    id: 'multiplayer_consensus',
    path: 'director',
    title: '⚖️ Master of Consensus',
    description: 'Win a democratic vote in multiplayer to shape collective fate',
    objective: 'Successfully pass a vote with 75%+ agreement in 16-peer session',
    rewardLP: 100,
    rewardXP: 1000,
    rewardPerk: 'Democratic Authority', // NPCs favor your faction +50 rep
    unlocks: ['echo_resonance'],
    estimatedTicks: 1000,
    difficulty: 'hard'
  }
};

// ============================================================================
// WEAVER PATH: Legendary Crafting & NPC Networks
// ============================================================================

export const WEAVER_MILESTONES: Partial<Record<Tier3Milestone, Tier3MilestoneData>> = {
  'weavers_first_bond': {
    id: 'weavers_first_bond',
    path: 'weaver',
    title: '💫 Weaver\'s First Bond',
    description: 'Establish a deep connection with an NPC',
    objective: 'Achieve "Soulbound" affinity (90+) with single NPC',
    rewardLP: 50,
    rewardXP: 500,
    unlocks: ['weavers_tapestry', 'legendary_crafter'],
    estimatedTicks: 400,
    difficulty: 'medium'
  },

  'weavers_tapestry': {
    id: 'weavers_tapestry',
    path: 'weaver',
    title: '🧵 Weaver\'s Tapestry',
    description: 'Weave a network of deep relationships',
    objective: 'Achieve "High Affinity" (75+) with 5+ distinct NPCs',
    rewardLP: 150,
    rewardXP: 1500,
    rewardPerk: 'Soul Resonance', // NPCs share 50% affinity with each other
    unlocks: ['echo_resonance'],
    estimatedTicks: 1200,
    difficulty: 'hard'
  },

  'legendary_crafter': {
    id: 'legendary_crafter',
    path: 'weaver',
    title: '⚔️ Legendary Crafter',
    description: 'Channel ancestral power into artifacts',
    objective: 'Successfully craft 3 legendary-tier artifacts',
    rewardLP: 250,
    rewardXP: 2500,
    rewardArtifacts: ['loom_of_fates'],  // Weaver artifact: +1 legendary craft/epoch
    unlocks: ['multiplayer_consensus'],
    estimatedTicks: 1800,
    difficulty: 'expert'
  },

  'multiplayer_consensus': {
    id: 'multiplayer_consensus',
    path: 'weaver',
    title: '⚖️ Master of Consensus',
    description: 'Unite peers through collective decision-making',
    objective: 'Successfully broker peace (faction truce vote) in multiplayer',
    rewardLP: 100,
    rewardXP: 1000,
    rewardPerk: 'Peacemaker\'s Blessing', // Trade prices -30%, NPC gifts +2 rarity tier
    unlocks: ['echo_resonance'],
    estimatedTicks: 800,
    difficulty: 'hard'
  }
};

// ============================================================================
// UNIVERSAL MILESTONES (Both Paths Lead Here)
// ============================================================================

export const UNIVERSAL_MILESTONES: Partial<Record<Tier3Milestone, Tier3MilestoneData>> = {
  'echo_resonance': {
    id: 'echo_resonance',
    path: 'director',  // Both paths converge here
    title: '✨ Echo\'s Resonance',
    description: 'Achieve mythic status and transcend mortality',
    objective: 'Reach myth rank 5 (100+ myth status)',
    rewardLP: 500,
    rewardXP: 5000,
    rewardArtifacts: ['crown_of_eternity'],  // Final legendary artifact
    rewardPerk: 'Eternal Echo',  // Automatically pass to next generation (+10 myth start)
    unlocks: ['bloodline_eternal'],
    estimatedTicks: 1500,
    difficulty: 'expert'
  },

  'bloodline_eternal': {
    id: 'bloodline_eternal',
    path: 'director',  // Achievement across epochs
    title: '👑 Bloodline Eternal',
    description: 'Complete the cycle - live and pass to next generation hero',
    objective: 'Ascend with myth rank 5, then complete one full epoch as descendant',
    rewardLP: 1000,
    rewardXP: 10000,
    rewardArtifacts: ['throne_of_legends'],  // Heirloom artifact
    rewardPerk: 'Dynasty\'s Legacy',  // All descendants inherit +5 perks
    unlocks: [],  // Terminal achievement
    estimatedTicks: 3000,
    difficulty: 'expert'
  },

  'paradox_master': {
    id: 'paradox_master',
    path: 'director',
    title: '🌀 Paradox Master',
    description: 'Master the chaos of reality itself',
    objective: 'Survive paradox spike (350+) and recover to <100 within 200 ticks',
    rewardLP: 300,
    rewardXP: 3000,
    rewardPerk: 'Paradox Resilience',  // Take -50% paradox damage
    unlocks: ['echo_resonance'],
    estimatedTicks: 1000,
    difficulty: 'hard'
  }
};

// ============================================================================
// MILESTONE PROGRESS TRACKING
// ============================================================================

export interface Tier3Progress {
  currentPath: Tier3Path | null;
  completedMilestones: Tier3Milestone[];
  activeMilestone: Tier3Milestone | null;
  progress: Record<Tier3Milestone, number>; // 0-100%
  totalRewardLP: number;
  totalRewardXP: number;
  milestonesEarned: Tier3MilestoneData[];
}

/**
 * Initialize tier 3 tracking for new character
 */
export function initializeTier3Progress(): Tier3Progress {
  return {
    currentPath: null,
    completedMilestones: [],
    activeMilestone: null,
    progress: {
      'directors_first_gambit': 0,
      'directors_trilogy': 0,
      'world_shaper': 0,
      'weavers_first_bond': 0,
      'weavers_tapestry': 0,
      'legendary_crafter': 0,
      'echo_resonance': 0,
      'bloodline_eternal': 0,
      'multiplayer_consensus': 0,
      'paradox_master': 0
    },
    totalRewardLP: 0,
    totalRewardXP: 0,
    milestonesEarned: []
  };
}

/**
 * Select tutorial path (Director or Weaver)
 */
export function selectTutorialPath(path: Tier3Path): Tier3Path {
  return path;
}

/**
 * Record milestone advancement
 */
export function advanceMilestone(
  progress: Tier3Progress,
  milestone: Tier3Milestone,
  completion: number  // 0-100
): Tier3Progress {
  return {
    ...progress,
    progress: {
      ...progress.progress,
      [milestone]: completion
    }
  };
}

/**
 * Complete milestone and apply rewards
 */
export function completeMilestone(
  progress: Tier3Progress,
  milestone: Tier3Milestone
): { progress: Tier3Progress; reward: Tier3MilestoneData } {
  const allMilestones = {
    ...DIRECTOR_MILESTONES,
    ...WEAVER_MILESTONES,
    ...UNIVERSAL_MILESTONES
  };

  const milestoneData = allMilestones[milestone];
  if (!milestoneData) {
    throw new Error(`Unknown milestone: ${milestone}`);
  }

  return {
    progress: {
      ...progress,
      completedMilestones: [...progress.completedMilestones, milestone],
      totalRewardLP: progress.totalRewardLP + milestoneData.rewardLP,
      totalRewardXP: progress.totalRewardXP + milestoneData.rewardXP,
      milestonesEarned: [...progress.milestonesEarned, milestoneData],
      progress: {
        ...progress.progress,
        [milestone]: 100
      }
    },
    reward: milestoneData
  };
}

/**
 * Get remaining milestones for path
 */
export function getRemainingMilestones(
  progress: Tier3Progress,
  path: Tier3Path
): Tier3MilestoneData[] {
  const pathMilestones = path === 'director' ? DIRECTOR_MILESTONES : WEAVER_MILESTONES;
  const remaining = Object.values(pathMilestones).filter(
    m => !progress.completedMilestones.includes(m.id)
  );
  return remaining;
}

/**
 * Check if character is ready for tier 3
 * Prerequisite: Mythology introduction + basic survival (tier 2)
 */
export function isReadyForTier3(playerProgress: any): boolean {
  return (
    playerProgress.tutorialTier >= 2 &&
    playerProgress.mythStatus >= 5 &&
    playerProgress.epochsLived >= 1
  );
}

/**
 * Generate tier 3 milestone display for UI
 */
export interface Tier3MilestoneDisplay {
  id: Tier3Milestone;
  icon: string;
  title: string;
  description: string;
  progress: number;
  completed: boolean;
  rewards: {
    lp: number;
    xp: number;
    perks: string[];
    items: string[];
  };
  estimatedTime: string;  // Human-readable
}

export function formatMilestoneForDisplay(
  milestone: Tier3MilestoneData,
  currentProgress: number,
  isCompleted: boolean
): Tier3MilestoneDisplay {
  const estimatedMinutes = Math.floor(milestone.estimatedTicks * 0.0167); // ~16.7ms per tick

  return {
    id: milestone.id,
    icon: milestone.title.split(' ')[0],  // First emoji
    title: milestone.title,
    description: milestone.description,
    progress: currentProgress,
    completed: isCompleted,
    rewards: {
      lp: milestone.rewardLP,
      xp: milestone.rewardXP,
      perks: milestone.rewardPerk ? [milestone.rewardPerk] : [],
      items: milestone.rewardArtifacts || []
    },
    estimatedTime: estimatedMinutes < 60 
      ? `~${estimatedMinutes}m`
      : `~${Math.floor(estimatedMinutes / 60)}h`
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * M63-C Tier 3 Tutorial System - Key Exports:
 * 
 * Paths:
 * - Director: Shape world through macro events + faction influence
 * - Weaver: Build relationships + craft legendary artifacts
 * 
 * Milestones (10 total):
 * - Director: First Gambit, Trilogy, World Shaper, Master of Consensus
 * - Weaver: First Bond, Tapestry, Legendary Crafter, Master of Consensus
 * - Universal: Echo's Resonance, Bloodline Eternal, Paradox Master
 * 
 * Progression:
 * - initializeTier3Progress()
 * - selectTutorialPath()
 * - advanceMilestone()
 * - completeMilestone()
 * - getRemainingMilestones()
 * - formatMilestoneForDisplay()
 * 
 * Rewards:
 * - LP (50-1000 per milestone)
 * - XP (500-10000 per milestone)
 * - Legendary artifacts + perks
 */
