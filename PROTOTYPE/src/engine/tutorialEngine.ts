/**
 * M41 Task 2 + Phase 24 Task 4: Onboarding Engine (Hardened)
 * 
 * Tracks player milestone achievements and provides lore-compliant tutorials:
 * - Tier 1 (Early): First Roll, Trade, Combat, Spell, Epoch Shift
 * - Tier 2 (Mid): Diplomat, Weaver
 * - Tier 3 (Phase 24): Guild Sociability, Raid Encounter, Paradox Awareness, P2P Scaling
 * 
 * Integrates with WorldState event log to detect milestones automatically.
 * Provides localized tutorial overlays, Director Whispers prologue, and throttling.
 * Persists in PlayerState.tutorialProgress for canonical save/load.
 */

import { WorldState } from './worldEngine';

/**
 * M41 + Phase 24: Milestone identifiers for tutorial progression
 * Tier 1 (Early Game): character_created, first_roll, first_trade, first_combat, first_spell, epoch_shift
 * Tier 2 (Mid Game): diplomat, weaver
 * Tier 3 (Phase 24): first_guild_join, first_raid_enter, paradox_warning, high_density_sync
 */
export type MilestoneId = 
  | 'first_roll' 
  | 'first_trade' 
  | 'epoch_shift' 
  | 'character_created' 
  | 'first_combat' 
  | 'first_spell'
  | 'diplomat'
  | 'weaver'
  // Phase 24 Milestones
  | 'first_guild_join'        // Joined first guild
  | 'first_raid_enter'        // Entered first raid/anomaly
  | 'paradox_warning'         // Paradox level reached critical
  | 'high_density_sync';

/**
 * M41: Milestone state tracking
 */
export interface TutorialMilestone {
  id: MilestoneId;
  achieved: boolean;
  achievedAtTick?: number;
  achievedAtTimestamp?: number;
}

/**
 * M41: Tutorial overlay state
 */
export interface TutorialOverlay {
  visible: boolean;
  milestoneId: MilestoneId;
  title: string;
  text: string;
  loreText: string;
  actionLabel: string;
  icon?: string;
}

/**
 * M41: Complete tutorial state
 */
export interface TutorialState {
  milestones: Record<MilestoneId, TutorialMilestone>;
  currentOverlay?: TutorialOverlay;
  completedCount: number;
  lastShownMilestoneId?: MilestoneId;
  tutorialEnabled: boolean;
}

/**
 * M41: Lore-compliant tutorial text database
 */
const TUTORIAL_DATABASE: Record<MilestoneId, Omit<TutorialOverlay, 'visible' | 'milestoneId'>> = {
  character_created: {
    title: "Welcome, Weaver of Threads",
    text: "You have entered the Isekai - a reality fractured across epochs. Your consciousness now inhabits this timeline.",
    loreText: `The Weaver's Manual states: "Each thread of consciousness that enters the Isekai receives a conduit - a form through which to navigate multiple epochs. This is your anchor to existence itself."`,
    actionLabel: "Begin Your Journey",
    icon: "🌀"
  },
  first_roll: {
    title: "The Dice Awakens",
    text: "The Dice of Fate responds to your intent. Roll to determine the outcome of uncertain events.",
    loreText: `Chronicle Entry (Fragment): "The Dice are not mere tools of chance - they are echoes of the Fracture itself. Each roll ripples across timelines, slightly altering destiny's course."`,
    actionLabel: "Acknowledge",
    icon: "🎲"
  },
  first_trade: {
    title: "Exchange of Essence",
    text: "Trade connects you to the economic fabric of the Isekai. NPCs seek items of value, and will offer their own in return.",
    loreText: `From the Codex of Commerce: "Trade is the oldest form of magic - the exchange of value creates binding agreements across timelines. Each transaction leaves a mark on the world's consensus."`,
    actionLabel: "Understood",
    icon: "⚖️"
  },
  first_combat: {
    title: "Combat Engagement",
    text: "You have entered conflict. Use your abilities, equipment, and spells to overcome your opponent.",
    loreText: `Battle Manual, Chapter 1: "Combat in the Isekai is not merely physical - each strike carries narrative weight. Your choices in battle reshape the timeline's emotional landscape."`,
    actionLabel: "Ready",
    icon: "⚔️"
  },
  first_spell: {
    title: "Arcane Invocation",
    text: "You have cast a spell, channeling the primal forces of the Isekai. Reality bends to your will.",
    loreText: `From the Arcane Codex: "Spellcasting is the art of compelling reality to align with intent. Each incantation leaves traces of paradox - power comes with a cost to timeline stability."`,
    actionLabel: "Continue",
    icon: "✨"
  },
  epoch_shift: {
    title: "Temporal Threshold Crossed",
    text: "A new epoch awakens. The world reshapes itself according to new rules and possibilities.",
    loreText: `The Chronicle of Epochs: "Each epoch shift represents a fundamental rewrite of natural law. What was possible in one age may become impossible in the next. Adapt or perish."`,
    actionLabel: "Embrace New Era",
    icon: "⏳"
  },
  // ============ M42 TIER 2 MILESTONES ============
  diplomat: {
    title: "The Diplomat's Path",
    text: "You have wielded influence over a faction's fate. Your negotiation has shaped the course of their power.",
    loreText: `From the Archives of Influence: "Diplomacy is the art of rewriting consensus without breaking consensus. A skilled diplomat understands that every faction harbors contradictions - and those contradictions are where change lives. Your choice has echoed through the faction's hierarchy, altering their trajectory for epochs to come."`,
    actionLabel: "Embrace Diplomacy",
    icon: "🎭"
  },
  weaver: {
    title: "The Grand Weaver's Ritual",
    text: "You have orchestrated a grand ritual with 3 or more power sources converging. Reality itself bends to your design.",
    loreText: `From the Weaver's Codex: "Grand rituals are impossible - they require the unified will of multiple consciousnesses, each tethered to different probability streams. And yet, you have done it. The collective power you have channeled leaves a permanent mark on the timeline. This is not mere magic - this is the fundamental restructuring of reality's consensus. You are no longer merely a player in this world. You are an architect of it."`,
    actionLabel: "Accept Your Role",
    icon: "✨"
  },
  // ============ PHASE 24 TIER 3 MILESTONES ============
  first_guild_join: {
    title: "The Collective Ascends",
    text: "You have joined a guild - a fellowship bound by shared purpose. Together, your strength multiplies.",
    loreText: `From the Guild Manifesto: "A guild is not merely a collection of players - it is a living entity with its own reputation, treasury, and will. By joining, you surrender part of your autonomy but gain access to collective knowledge, shared resources, and protection. The guild becomes an extension of your identity in the Isekai."`,
    actionLabel: "Embrace Fellowship",
    icon: "🛡️"
  },
  first_raid_enter: {
    title: "The Anomaly Calls",
    text: "You have answered the call of a World Raid - a macro-anomaly that corrupts the very fabric of reality. Multitudes gather to stabilize it.",
    loreText: `From Chronicle of Anomalies: "World Raids are birth points of new legends. They occur when paradox reaches critical mass, spawning boss entities that embody timeline instability. A single player cannot hope to overcome such beings - only collective will, synchronized perfectly, can pierce through. This is where heroes are forged."`,
    actionLabel: "Answer the Call",
    icon: "⚔️🌀"
  },
  paradox_warning: {
    title: "Reality Strains Under Paradox",
    text: "The paradox level in this region has grown dangerous. Temporal anomalies grow more frequent and severe.",
    loreText: `From the Paradox Monitor's Log: "Each action you take creates minute ripples in causality. These ripples accumulate. When they reach a critical threshold, reality itself begins to reject the contradiction - causing glitches, spatial tears, and the manifestation of nightmare entities. Seek cleansing rituals or ventures into unparadoxed regions."`,
    actionLabel: "Understand the Warning",
    icon: "⚠️"
  },
  high_density_sync: {
    title: "The Crowd Synchronizes",
    text: "You have entered a crowded location with many other weavers. The world feels heavier, more dense with narrative weight.",
    loreText: `From the Architecture of Consciousness: "In solitude, you navigate the Isekai with perfect clarity. But when many consciousnesses converge in one place, something profound occurs - a localized intensification of the narrative field. Your individual story becomes woven into a larger tapestry. Actions carry more weight, but also less agency. This is the paradox of community."`,
    actionLabel: "Adapt to Density",
    icon: "👥"
  }
};

/**
 * Phase 24: Director Whisper messages for prologue sequence
 */
const DIRECTOR_WHISPERS: string[] = [
  "Synchronizing consciousness...",
  "Bridging probability streams...",
  "Welcome to the Isekai."
];

/**
 * M41 + Phase 24: Initialize empty tutorial state
 */
export function initializeTutorialState(): TutorialState {
  const milestones: Record<MilestoneId, TutorialMilestone> = {
    character_created: { id: 'character_created', achieved: false },
    first_roll: { id: 'first_roll', achieved: false },
    first_trade: { id: 'first_trade', achieved: false },
    first_combat: { id: 'first_combat', achieved: false },
    first_spell: { id: 'first_spell', achieved: false },
    epoch_shift: { id: 'epoch_shift', achieved: false },
    // Tier 2
    diplomat: { id: 'diplomat', achieved: false },
    weaver: { id: 'weaver', achieved: false },
    // Phase 24 Tier 3
    first_guild_join: { id: 'first_guild_join', achieved: false },
    first_raid_enter: { id: 'first_raid_enter', achieved: false },
    paradox_warning: { id: 'paradox_warning', achieved: false },
    high_density_sync: { id: 'high_density_sync', achieved: false }
  };

  return {
    milestones,
    completedCount: 0,
    tutorialEnabled: true
  };
}

/**
 * M41: Detect milestone achievement from world state
 * Simplified approach - more sophisticated detection would use event subscriptions
 */
export function detectMilestones(state: WorldState, previousTutorialState: TutorialState): MilestoneId[] {
  const detectedMilestones: MilestoneId[] = [];

  // Character Creation: Player exists and hasn't been marked as created yet
  if (state.player && !previousTutorialState.milestones.character_created.achieved) {
    detectedMilestones.push('character_created');
  }

  // Combat: Player has inventory items (suggests combat rewards or progression)
  if (
    !previousTutorialState.milestones.first_combat.achieved &&
    state.player?.inventory &&
    state.player.inventory.length > 0
  ) {
    detectedMilestones.push('first_combat');
  }

  // Spell: Player has learned abilities
  if (
    !previousTutorialState.milestones.first_spell.achieved &&
    state.player?.unlockedAbilities &&
    state.player.unlockedAbilities.length > 0
  ) {
    detectedMilestones.push('first_spell');
  }

  // Trade: Player has accumulated gold beyond starting amount (suggests trades)
  if (
    !previousTutorialState.milestones.first_trade.achieved &&
    state.player?.gold &&
    state.player.gold > 0
  ) {
    detectedMilestones.push('first_trade');
  }

  // Epoch Shift: Epoch has been set (player entered new epoch)
  if (
    !previousTutorialState.milestones.epoch_shift.achieved &&
    state.epochId &&
    state.epochMetadata?.sequenceNumber
  ) {
    detectedMilestones.push('epoch_shift');
  }

  // Dice Roll: Player has gained experience (indicates rolls/skill checks)
  if (
    !previousTutorialState.milestones.first_roll.achieved &&
    state.player?.experience &&
    state.player.experience > 0
  ) {
    detectedMilestones.push('first_roll');
  }

  // M42 TIER 2: Diplomat - Triggered when player influences a faction turn
  // Detection: Check if player has made faction influence decisions that altered consensus
  if (
    !previousTutorialState.milestones.diplomat.achieved &&
    state.factions &&
    Array.isArray(state.factions)
  ) {
    // Check for faction with recent player-influenced consensus change
    const hasInfluencedFaction = state.factions.some((faction: any) => {
      return (
        faction.recentInfluencers &&
        Array.isArray(faction.recentInfluencers) &&
        faction.recentInfluencers.includes(state.player?.id)
      );
    });
    if (hasInfluencedFaction) {
      detectedMilestones.push('diplomat');
    }
  }

  // M42 TIER 2: Weaver - Triggered when player orchestrates grand ritual with 3+ participants
  // Detection: Check ritual participation metadata
  if (
    !previousTutorialState.milestones.weaver.achieved &&
    state.macroEvents &&
    Array.isArray(state.macroEvents)
  ) {
    // Check for grand ritual with 3+ participants
    const hasGrandRitual = state.macroEvents.some((event: any) => {
      return (
        event.type === 'grand_ritual' &&
        event.participants &&
        Array.isArray(event.participants) &&
        event.participants.length >= 3 &&
        event.participants.includes(state.player?.id)
      );
    });
    if (hasGrandRitual) {
      detectedMilestones.push('weaver');
    }
  }

  return detectedMilestones;
}

/**
 * M41: Update tutorial state with detected milestones
 * Marks milestones as achieved and prepares overlay
 */
export function updateTutorialState(
  tutorialState: TutorialState,
  detectedMilestones: MilestoneId[],
  currentTick: number
): TutorialState {
  const updated = { ...tutorialState };

  // Mark detected milestones as achieved
  for (const milestoneId of detectedMilestones) {
    if (!updated.milestones[milestoneId].achieved) {
      updated.milestones[milestoneId] = {
        id: milestoneId,
        achieved: true,
        achievedAtTick: currentTick,
        achievedAtTimestamp: Date.now()
      };
      updated.completedCount += 1;
      updated.lastShownMilestoneId = milestoneId;
    }
  }

  return updated;
}

/**
 * M41: Get next tutorial overlay to display
 * Returns overlay for most recent milestone, or undefined if none pending
 */
export function getNextTutorialOverlay(tutorialState: TutorialState): TutorialOverlay | undefined {
  if (!tutorialState.tutorialEnabled || tutorialState.completedCount === 0) {
    return undefined;
  }

  // Find the most recently achieved milestone that hasn't been shown yet
  // Ordered: Tier 1 first, then Tier 2
  const milestoneIds: MilestoneId[] = [
    'character_created',
    'first_roll',
    'first_trade',
    'first_combat',
    'first_spell',
    'epoch_shift',
    // Tier 2
    'diplomat',
    'weaver'
  ];

  for (let i = milestoneIds.length - 1; i >= 0; i--) {
    const milestoneId = milestoneIds[i];
    const milestone = tutorialState.milestones[milestoneId];

    // Show overlay for first unshown achieved milestone
    if (milestone.achieved && milestone.id !== tutorialState.lastShownMilestoneId) {
      const tutorialText = TUTORIAL_DATABASE[milestoneId];
      return {
        visible: true,
        milestoneId,
        ...tutorialText
      };
    }
  }

  return undefined;
}

/**
 * M41: Suppress tutorial overlay
 * Called when user closes the overlay
 */
export function dismissTutorialOverlay(tutorialState: TutorialState, milestoneId: MilestoneId): TutorialState {
  return {
    ...tutorialState,
    lastShownMilestoneId: milestoneId
  };
}

/**
 * M41: Toggle tutorial system on/off
 */
export function toggleTutorialEnabled(tutorialState: TutorialState): TutorialState {
  return {
    ...tutorialState,
    tutorialEnabled: !tutorialState.tutorialEnabled
  };
}

/**
 * M41: Get tutorial progress as percentage
 */
export function getTutorialProgress(tutorialState: TutorialState): number {
  const totalMilestones = Object.keys(tutorialState.milestones).length;
  return totalMilestones > 0 ? (tutorialState.completedCount / totalMilestones) * 100 : 0;
}

/**
 * M41: Get achievement summary for HUD display
 */
export function getTutorialSummary(tutorialState: TutorialState): {
  achieved: MilestoneId[];
  remaining: MilestoneId[];
  progress: number;
} {
  const achieved: MilestoneId[] = [];
  const remaining: MilestoneId[] = [];

  for (const [id, milestone] of Object.entries(tutorialState.milestones)) {
    if (milestone.achieved) {
      achieved.push(id as MilestoneId);
    } else {
      remaining.push(id as MilestoneId);
    }
  }

  return {
    achieved,
    remaining,
    progress: getTutorialProgress(tutorialState)
  };
}

/**
 * M41: Get lore text for a specific milestone
 * Useful for help panels or codex entries
 */
export function getMilestoneLoreText(milestoneId: MilestoneId): string {
  return TUTORIAL_DATABASE[milestoneId]?.loreText || "Unknown milestone.";
}

/**
 * M41: Export tutorial state to persistence (for save/load)
 */
export function serializeTutorialState(tutorialState: TutorialState): Record<string, any> {
  return {
    milestones: tutorialState.milestones,
    completedCount: tutorialState.completedCount,
    lastShownMilestoneId: tutorialState.lastShownMilestoneId,
    tutorialEnabled: tutorialState.tutorialEnabled
  };
}

/**
 * M41: Restore tutorial state from persistence
 */
export function deserializeTutorialState(data: Record<string, any>): TutorialState {
  return {
    milestones: data.milestones || initializeTutorialState().milestones,
    completedCount: data.completedCount ?? 0,
    lastShownMilestoneId: data.lastShownMilestoneId,
    tutorialEnabled: data.tutorialEnabled !== false
  };
}

// ============ M42 TIER 2: MILESTONE HELPERS ============

/**
 * M42: Manually trigger Diplomat milestone
 * Called when player makes a significant faction influence decision
 */
export function triggerDiplomatMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.diplomat.achieved) {
    return tutorialState;
  }
  
  return updateTutorialState(tutorialState, ['diplomat'], Date.now());
}

/**
 * M42: Manually trigger Weaver milestone
 * Called when player completes a grand ritual with 3+ participants
 */
export function triggerWeaverMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.weaver.achieved) {
    return tutorialState;
  }
  
  return updateTutorialState(tutorialState, ['weaver'], Date.now());
}

/**
 * M42: Check if player has earned faction influence status
 * Returns true if player has influenced at least one faction
 */
export function hasFactionInfluence(tutorialState: TutorialState): boolean {
  return tutorialState.milestones.diplomat.achieved;
}

/**
 * M42: Check if player has orchestrated grand rituals
 * Returns true if player has participated in 3+ participant rituals
 */
export function hasWeaverStatus(tutorialState: TutorialState): boolean {
  return tutorialState.milestones.weaver.achieved;
}

/**
 * M42: Get Tier 2 progress
 * Returns count of Tier 2 milestones achieved
 */
export function getTier2Progress(tutorialState: TutorialState): { completed: number; total: number } {
  const tier2Milestones: MilestoneId[] = ['diplomat', 'weaver'];
  const completed = tier2Milestones.filter(
    id => tutorialState.milestones[id].achieved
  ).length;

  return {
    completed,
    total: tier2Milestones.length
  };
}

// ============ PHASE 24: TIER 3 MILESTONES & FEATURES ============

/**
 * Phase 24: Trigger first guild join milestone
 */
export function triggerGuildJoinMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.first_guild_join.achieved) {
    return tutorialState;
  }
  return updateTutorialState(tutorialState, ['first_guild_join'], Date.now());
}

/**
 * Phase 24: Trigger first raid enter milestone
 */
export function triggerRaidMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.first_raid_enter.achieved) {
    return tutorialState;
  }
  return updateTutorialState(tutorialState, ['first_raid_enter'], Date.now());
}

/**
 * Phase 24: Trigger paradox warning milestone
 */
export function triggerParadoxWarningMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.paradox_warning.achieved) {
    return tutorialState;
  }
  return updateTutorialState(tutorialState, ['paradox_warning'], Date.now());
}

/**
 * Phase 24: Trigger high-density sync milestone
 */
export function triggerHighDensitySyncMilestone(tutorialState: TutorialState): TutorialState {
  if (tutorialState.milestones.high_density_sync.achieved) {
    return tutorialState;
  }
  return updateTutorialState(tutorialState, ['high_density_sync'], Date.now());
}

/**
 * Phase 24: New Player Prologue - "Director Whispers"
 * Returns a sequence of timed whisper messages for immersive onboarding
 */
export function startNewPlayerPrologue(): Array<{ delayMs: number; message: string }> {
  return [
    { delayMs: 0, message: DIRECTOR_WHISPERS[0] },
    { delayMs: 2000, message: DIRECTOR_WHISPERS[1] },
    { delayMs: 4000, message: DIRECTOR_WHISPERS[2] }
  ];
}

/**
 * Phase 24: Check if tutorial should be throttled
 * Throttles intrusive overlays during critical moments (raids, boss phases, high-density areas)
 */
export function isTutorialThrottled(state: WorldState): boolean {
  // Throttle during active raids
  if (state.activeRaids && state.activeRaids.length > 0) {
    return true;  // Don't show tutorials during raid
  }

  // Throttle during boss phases (check paradox-triggered anomalies)
  if (state.macroAnomalies && state.macroAnomalies.length > 0) {
    for (const anomaly of state.macroAnomalies as any[]) {
      if (anomaly.status === 'IN_PROGRESS' || anomaly.status === 'STABILIZING') {
        return true;
      }
    }
  }

  // Throttle in very high-density areas (>50 concurrent players at location)
  if (state.playerLocations) {
    const playerCount = Object.values(state.playerLocations).length;
    if (playerCount > 50) {
      return true;  // Defer tutorials in crowded zones
    }
  }

  return false;
}

/**
 * Phase 24: Detect milestones with Phase 24 systems
 */
export function detectMilestonesPhase24(state: WorldState, previousTutorialState: TutorialState): MilestoneId[] {
  const detectedMilestones: MilestoneId[] = [];

  // Guild Join: Check if player now has guildId
  if (
    !previousTutorialState.milestones.first_guild_join.achieved &&
    (state.player as any)?.guildId
  ) {
    detectedMilestones.push('first_guild_join');
  }

  // Raid Enter: Check if player is in active raid
  if (
    !previousTutorialState.milestones.first_raid_enter.achieved &&
    (state.player as any)?.activeRaidId
  ) {
    detectedMilestones.push('first_raid_enter');
  }

  // Paradox Warning: Check if paradox level is critical
  if (
    !previousTutorialState.milestones.paradox_warning.achieved &&
    ((state.paradoxLevel ?? 0) > 250 || (state.generationalParadox ?? 0) > 300)
  ) {
    detectedMilestones.push('paradox_warning');
  }

  // High Density Sync: Check concurrent player count in location
  if (
    !previousTutorialState.milestones.high_density_sync.achieved &&
    state.playerLocations &&
    Object.values(state.playerLocations).length > 30
  ) {
    detectedMilestones.push('high_density_sync');
  }

  return detectedMilestones;
}

/**
 * Phase 24: Get Tier 3 (Phase 24) progress
 */
export function getTier3Progress(tutorialState: TutorialState): { completed: number; total: number } {
  const tier3Milestones: MilestoneId[] = [
    'first_guild_join',
    'first_raid_enter',
    'paradox_warning',
    'high_density_sync'
  ];
  const completed = tier3Milestones.filter(
    id => tutorialState.milestones[id].achieved
  ).length;

  return {
    completed,
    total: tier3Milestones.length
  };
}

/**
 * Phase 24: Get Tutorial Archive - all earned milestones for replay
 */
export function getTutorialArchive(tutorialState: TutorialState): Array<{
  milestoneId: MilestoneId;
  title: string;
  text: string;
  loreText: string;
  achievedAtTimestamp?: number;
}> {
  return Object.entries(tutorialState.milestones)
    .filter(([_, milestone]) => milestone.achieved)
    .map(([id, milestone]) => {
      const dbEntry = TUTORIAL_DATABASE[id as MilestoneId];
      return {
        milestoneId: id as MilestoneId,
        title: dbEntry?.title || 'Unknown Milestone',
        text: dbEntry?.text || '',
        loreText: dbEntry?.loreText || '',
        achievedAtTimestamp: milestone.achievedAtTimestamp
      };
    });
}

