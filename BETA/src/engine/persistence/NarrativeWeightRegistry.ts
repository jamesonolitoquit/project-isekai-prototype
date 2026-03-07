/**
 * Phase 36: Narrative Weight Registry
 * 
 * Centralized mapping of all event types to narrative "importance weights"
 * Used for intelligent pruning: events with Weight >= 7 are kept in permanent storage,
 * others are considered "low value" and can be archived or discarded after 100 ticks.
 * 
 * Weight Scale:
 * - 10: Canonical, world-changing events (must always be kept)
 * - 8-9: Major plot events (quests, significant faction changes)
 * - 7: Important but not critical (NPC dialogue, location discoveries)
 * - 4-6: Flavor events (ambient weather, ambient activity)
 * - 1-3: Ephemeral events (cosmetic changes, transient states)
 */

/**
 * Full event type to importance weight mapping
 */
export const NARRATIVE_WEIGHT_REGISTRY: Record<string, number> = {
  // Epoch & World-Changing Events (Weight 10: Canonical)
  'EPOCH_TRANSITION': 10,
  'EPOCH_CATALYZED': 10,
  'WORLD_PARADOX_SPIKE': 10,
  'TEMPORAL_ANOMALY_MANIFESTED': 10,
  
  // Faction Events (Weight 8-10: Major consequences)
  'FACTION_COLLAPSE': 10,
  'FACTION_POWER_SHIFT': 9,
  'FACTION_BETRAYAL': 9,
  'FACTION_ALLIANCE_FORMED': 9,
  'FACTION_CONFLICT_ESCALATED': 8,
  
  // Combat & Raid Events (Weight 8-9: High stakes)
  'RAID_INSTANCE_CREATED': 9,
  'RAID_RESOLVED': 9,
  'COMBAT_ENCOUNTER_COMPLETED': 8,
  'PLAYER_DIED': 10, // Always canonical for records
  'NPC_DIED': 9,
  
  // Quest Events (Weight 8-9: Story progression)
  'QUEST_COMPLETE': 9,
  'QUEST_FAILED': 8,
  'QUEST_STARTED': 8,
  'OBJECTIVE_UPDATED': 7,
  
  // Discovery & Knowledge Events (Weight 7-8)
  'LOCATION_DISCOVERED': 8,
  'ARTIFACT_DISCOVERED': 8,
  'LORE_UNLOCKED': 8,
  'KNOWLEDGE_GAINED': 7,
  
  // Social & NPC Events (Weight 7-8)
  'NPC_RELATIONSHIP_CHANGED': 8,
  'GOSSIP_PROPAGATED': 7,
  'RUMOR_SPREAD': 7,
  'NPC_DIALOGUE_RECORDED': 7,
  'FACTION_RECRUITMENT': 8,
  
  // Item & Inventory Events (Weight 1-4: Low value by default)
  'ITEM_ACQUIRED': 3,
  'ITEM_DROPPED': 2,
  'ITEM_EQUIPPED': 2,
  'ITEM_UNEQUIPPED': 2,
  'INVENTORY_UPDATED': 1,
  'LOOT_GENERATED': 4, // Slightly higher if rare item
  
  // Environmental & Ambient Events (Weight 1-4)
  'WEATHER_CHANGE': 1,
  'AMBIENT_ACTIVITY': 1,
  'TIME_PASSED': 1,
  'DAY_PHASE_CHANGED': 1,
  'SEASON_CHANGED': 4, // Higher weight since it affects many systems
  'ENVIRONMENT_MUTATED': 3,
  
  // Director & System Events (Weight 6-9)
  'DIRECTOR_INTERVENTION': 9,
  'DIRECTOR_WHISPER': 8,
  'NARRATIVE_RIPPLE': 8,
  'PARADOX_RIPPLE_DETECTED': 9,
  
  // World Scar & Mutation Events (Weight 8-10)
  'WORLD_SCAR_CREATED': 10,
  'WORLD_SCAR_HEALED': 10,
  'PARADOX_MUTATION_OCCURRED': 9,
  'CHRONICLE_ENTRY_CREATED': 8,
  
  // Character Advancement (Weight 7-8)
  'CHARACTER_LEVELED_UP': 8,
  'CHARACTER_STAT_INCREASED': 7,
  'TALENT_ACQUIRED': 8,
  'PERK_UNLOCKED': 8,
  
  // Portal & Travel Events (Weight 6-8)
  'PORTAL_OPENED': 8,
  'PLAYER_TELEPORTED': 7,
  'LOCATION_CHANGED': 6,
  'TRAVEL_COMPLETED': 6,
  
  // Craft & Build Events (Weight 4-7)
  'ITEM_CRAFTED': 7,
  'RECIPE_DISCOVERED': 7,
  'STRUCTURE_BUILT': 7,
  'RESOURCE_HARVESTED': 3,
  'RESOURCE_DEPLETED': 4,
  
  // Audio & Sensory Events (Weight 1-3: Cosmetic)
  'SOUND_EFFECT_PLAYED': 1,
  'AMBIENT_SOUND_CHANGED': 1,
  'MUSIC_CHANGED': 1,
  'PARTICLE_EFFECT_SPAWNED': 1,
  
  // Director Command Events (Weight 9-10: Always canonical)
  'DIRECTOR_OVERRIDE': 10,
  'DIRECTOR_FORCE_EPOCH': 10,
  'DIRECTOR_SPAWN_EVENT': 9,
  'DIRECTOR_ANNOUNCE': 8,
  
  // System Events (Weight 5-7)
  'STATE_MUTATION_LOGGED': 6,
  'DETERMINISM_CHECK_PASSED': 5,
  'DETERMINISM_CHECK_FAILED': 9, // Very important if it fails
  'TICK_COMPLETED': 1, // Low value, just bookkeeping
  'SAVE_CHECKPOINT_CREATED': 7,
  
  // Multiplayer & Social Events (Weight 7-9)
  'PLAYER_JOINED_WORLD': 8,
  'PLAYER_LEFT_WORLD': 8,
  'MULTIPLAYER_CONSENSUS_REACHED': 9,
  'MULTIPLAYER_CONFLICT_RESOLVED': 8,
  
  // Default fallback
  'UNKNOWN_EVENT': 5,
};

/**
 * Special metadata for the pruning system
 */
export const PRUNING_CONFIG = {
  // Minimum importance weight for permanent storage in Postgres
  minImportanceForCanonicalStatus: 7,
  
  // Minimum importance weight for hot cache (Redis)
  minImportanceForHotCache: 4,
  
  // After this many ticks, low-weight events can be archived
  archiveAfterTicksLowWeight: 100,
  
  // After this many ticks, any event can be moved to cold storage
  archiveAfterTicksAny: 1000,
  
  // Maximum mutation log table size (GB) before compaction is triggered
  maxMutationLogSizeGb: 10,
  
  // Threshold for compaction: if >X events match same (actor, property), collapse them
  compactionEventThreshold: 5,
};

/**
 * Get the importance weight for an event type
 * @param eventType The event type to look up
 * @returns The importance weight (1-10 scale)
 */
export function getEventWeight(eventType: string): number {
  return NARRATIVE_WEIGHT_REGISTRY[eventType] || NARRATIVE_WEIGHT_REGISTRY['UNKNOWN_EVENT'];
}

/**
 * Check if an event should be kept for canonical history
 * @param eventType The event type to check
 * @returns True if weight >= minImportanceForCanonicalStatus
 */
export function isEventCanonical(eventType: string): boolean {
  const weight = getEventWeight(eventType);
  return weight >= PRUNING_CONFIG.minImportanceForCanonicalStatus;
}

/**
 * Check if an event should be kept in hot cache (Redis)
 * @param eventType The event type to check
 * @returns True if weight >= minImportanceForHotCache
 */
export function shouldCacheEvent(eventType: string): boolean {
  const weight = getEventWeight(eventType);
  return weight >= PRUNING_CONFIG.minImportanceForHotCache;
}

/**
 * Get filtration report for a set of events
 * Useful for audit logging and debugging
 */
export function generatePruningReport(events: Array<{ event_type: string }>): {
  total: number;
  retained: number;
  pruned: number;
  weightDistribution: Record<string, number>;
} {
  const distribution: Record<string, number> = {};
  let retained = 0;

  for (const event of events) {
    const weight = getEventWeight(event.event_type);
    distribution[event.event_type] = (distribution[event.event_type] || 0) + 1;

    if (weight >= PRUNING_CONFIG.minImportanceForCanonicalStatus) {
      retained++;
    }
  }

  return {
    total: events.length,
    retained,
    pruned: events.length - retained,
    weightDistribution: distribution,
  };
}

/**
 * Export the full registry for admin use
 */
export function getFullRegistry(): Record<string, number> {
  return { ...NARRATIVE_WEIGHT_REGISTRY };
}
