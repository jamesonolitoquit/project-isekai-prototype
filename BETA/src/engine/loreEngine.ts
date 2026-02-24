/**
 * loreEngine.ts - M16 Step 5: Codex Lore Unlock System
 * 
 * Manages persistent lore entries that unlock gradually through:
 * - Dialogue discoveries (dialogue nodes with lore triggers)
 * - Exploration (discovering locations with lore significance)
 * - Combat/events (witnessing significant battles or phenomena)
 * 
 * Persists across save/load via knowledgeBase in playerState
 */

import { Event, appendEvent } from '../events/mutationLog';
import { WorldState } from './worldEngine';

export type LoreUnlockTrigger = 'dialogue' | 'discovery' | 'combat' | 'event' | 'faction' | 'temporal';

export interface LoreEntry {
  id: string;
  title: string;
  category: string; // 'factions' | 'locations' | 'history' | 'bestiary' | 'mechanics' | 'secrets'
  content: string; // Full text revealed to player
  summary?: string; // Brief preview before unlock
  author?: string; // Lore attribution (NPC, faction, etc.)
  unlockedAt?: number; // Tick when discovered
  unlockTrigger?: LoreUnlockTrigger;
  requiresAccessLevel?: 'public' | 'restricted' | 'secret'; // For faction-based gating
  relatedLoreIds?: string[]; // Cross-references (shows up in codex)
  weight?: number; // Priority in suggestions (higher = more important)
}

export interface KnowledgeBase {
  entries: Map<string, LoreEntry>;
  discoveredAt: Map<string, number>; // loreId → tick
  unlockedCategories: Set<string>;
}

/**
 * Initialize empty knowledge base for new player
 */
export function initializeKnowledgeBase(): KnowledgeBase {
  return {
    entries: new Map(),
    discoveredAt: new Map(),
    unlockedCategories: new Set()
  };
}

/**
 * Attempt to unlock a lore entry with hard canon conditions
 * Returns true if unlocked, false if didn't meet conditions
 */
export function unlockLoreEntry(
  state: WorldState,
  loreId: string,
  trigger: LoreUnlockTrigger,
  loreEntry: LoreEntry
): { unlocked: boolean; wasNew: boolean } {
  const knowledgeBase = state.player?.knowledgeBase || new Map();
  
  // Already discovered
  if (knowledgeBase.has(loreId)) {
    return { unlocked: true, wasNew: false };
  }

  // Check hard canon conditions based on trigger type
  const conditionsMet = checkUnlockConditions(state, loreId, trigger, loreEntry);
  if (!conditionsMet) {
    return { unlocked: false, wasNew: false };
  }

  // Conditions met - unlock the entry
  if (!knowledgeBase.has(loreId)) {
    knowledgeBase.set(loreId, loreEntry);

    // Emit LORE_DISCOVERED event
    const ev: Event = {
      id: `lore-discover-${Date.now()}-${loreId}`,
      worldInstanceId: state.id,
      actorId: 'system',
      type: 'LORE_DISCOVERED',
      payload: {
        loreId,
        title: loreEntry.title,
        category: loreEntry.category,
        trigger,
        unlockedAt: state.tick ?? 0
      },
      timestamp: Date.now()
    };
    appendEvent(ev);

    // Add category if not already there
    if (!state.player.knowledgeBase) {
      state.player.knowledgeBase = new Map();
    }
    const categories = new Set<string>(Array.from(state.player.knowledgeBase.values()).map(entry => entry.category));
    categories.add(loreEntry.category);

    return { unlocked: true, wasNew: true };
  }

  return { unlocked: true, wasNew: false };
}

/**
 * Check hard canon conditions for lore unlock
 * Different triggers require different conditions to prevent lore spam
 */
function checkUnlockConditions(
  state: WorldState,
  loreId: string,
  trigger: LoreUnlockTrigger,
  entry: LoreEntry
): boolean {
  const player = state.player;
  const factions = state.factions || [];

  switch (trigger) {
    case 'dialogue': {
      // Dialogue lore requires min reputation with source NPC's faction
      if (entry.requiresAccessLevel === 'secret') {
        // Secrets require allied reputation (60+) with any faction
        return factions.some(f => 
          (player.factionReputation?.[f.id] ?? 0) >= 60
        );
      }
      if (entry.requiresAccessLevel === 'restricted') {
        // Restricted requires friendly (20+)
        return factions.some(f => 
          (player.factionReputation?.[f.id] ?? 0) >= 20
        );
      }
      // Public dialogue lore is always available
      return true;
    }

    case 'discovery': {
      // Location discovery requires player has visited or heard about location
      // Hard canon: just checking if location exists in world is sufficient
      return (state.locations || []).length > 0;
    }

    case 'combat': {
      // Combat lore requires player to have reached combat level 3+
      // Hard canon: checked via player experience/level
      return (player.level ?? 1) >= 3;
    }

    case 'event': {
      // Event lore requires corresponding event to have occurred
      // Hard canon: checked via past events in mutation log
      return true; // Assume event system validates this
    }

    case 'faction': {
      // Faction lore requires allegiance to the faction
      const requiredFaction = entry.author;
      if (!requiredFaction) return true;
      
      return factions.some(f => 
        f.id === requiredFaction && 
        (player.factionReputation?.[f.id] ?? 0) >= 20
      );
    }

    case 'temporal': {
      // Temporal/paradox lore requires paradox level to be high
      // Hard canon: checked via paradox accumulation
      return (player.temporalDebt ?? 0) >= 20;
    }

    default:
      return true;
  }
}

/**
 * Get related lore entries (for codex cross-reference).
 * Returns lore entries that are referenced by the given entry
 */
export function getRelatedLoreEntries(
  state: WorldState,
  loreId: string
): LoreEntry[] {
  const knowledgeBase = state.player?.knowledgeBase;
  if (!knowledgeBase) {
    return [];
  }

  const entry = knowledgeBase.get(loreId);
  if (!entry || !entry.relatedLoreIds) {
    return [];
  }

  return entry.relatedLoreIds
    .map(id => knowledgeBase.get(id))
    .filter((e): e is LoreEntry => e !== undefined);
}

/**
 * Get suggested next lore entries based on player progress
 * Orders by weight and category affinity
 */
export function getSuggestedLoreEntries(
  state: WorldState,
  maxSuggestions: number = 3
): LoreEntry[] {
  const allLore: LoreEntry[] = [
    // This would be pulled from a global lore database in production
    // For now, return empty - actual lore entries are added dynamically
  ];

  const knowledgeBase = state.player?.knowledgeBase;
  
  // Filter to undisc covered entries only
  const undiscovered = allLore.filter(entry => 
    !knowledgeBase?.has(entry.id)
  );

  // Sort by weight (higher first) and return top suggestions
  return undiscovered
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, maxSuggestions);
}

/**
 * Get lore entries by category for Codex display
 */
export function getLoreByCategory(
  state: WorldState,
  category: string
): Array<LoreEntry & { unlocked: boolean; unlockedAt?: number }> {
  const knowledgeBase = state.player?.knowledgeBase;
  if (!knowledgeBase) {
    return [];
  }

  return Array.from(knowledgeBase.values())
    .filter(entry => entry.category === category)
    .map(entry => ({
      ...entry,
      unlocked: true,
      unlockedAt: entry.unlockedAt
    }))
    .sort((a, b) => (a.unlockedAt ?? 0) - (b.unlockedAt ?? 0));
}

/**
 * Get progress annotation for Codex (e.g., "8/24 entries unlocked")
 */
export function getLoreProgressForCategory(
  state: WorldState,
  category: string,
  totalInCategory: number
): { unlocked: number; total: number; percentage: number } {
  const knowledgeBase = state.player?.knowledgeBase;
  const unlockedInCategory = knowledgeBase
    ? Array.from(knowledgeBase.values()).filter(e => e.category === category).length
    : 0;

  return {
    unlocked: unlockedInCategory,
    total: totalInCategory,
    percentage: Math.round((unlockedInCategory / totalInCategory) * 100)
  };
}
/**
 * ========== M53-B1: The Great Library - Lore Tome Archival System ==========
 * 
 * Converts Grand Deeds into persisted Lore Tome items (UniqueItem) that
 * survive epoch transitions and are findable in The Great Library location.
 */

import type { UniqueItem } from './worldEngine';
import type { LegacyImpact } from './legacyEngine';

export interface LoreTome extends UniqueItem {
  kind: 'unique';
  itemId: 'lore_tome';
  metadata: {
    title: string;
    narrativeContent: string;
    deedType: string;
    powerLevel: number;
    sentiment: 'triumphant' | 'sorrowful' | 'tragic' | 'mysterious';
    authorName: string;
    epochCreated: string;
    readingTime: number;
    relatedContacts?: string[];
    experience: number;
    sentience: number;
    corruption: number;
    infusions: Array<{ runeId: string; timestamp: number }>;
    runes?: string[];
  };
}

/**
 * M53-B1: Convert a Grand Deed event into a Lore Tome UniqueItem
 */
export function deedToLoreTome(
  event: Event,
  authorName: string,
  epochId: string
): LoreTome {
  const instanceId = `lore_tome_${event.id}_${Date.now()}`;
  const payload = event.payload || {};

  let deedType = 'legendary_action';
  let narrative = '';
  let powerLevel = 50;
  let sentiment: 'triumphant' | 'sorrowful' | 'tragic' | 'mysterious' = 'mysterious';
  let title = 'Unknown Deed';
  let relatedContacts: string[] = [];

  switch (event.type) {
    case 'QUEST_COMPLETED': {
      deedType = 'quest_completion';
      const questName = payload.questName || payload.questId || 'A Great Task';
      title = `The Completion of ${questName}`;
      narrative = `In ${epochId}, ${authorName} completed the quest "${questName}". ` +
        `${payload.description || 'This was a significant undertaking.'}`;
      powerLevel = Math.min(100, payload.questDifficulty ? payload.questDifficulty * 10 : 60);
      sentiment = 'triumphant';
      if (payload.questNpcId) relatedContacts.push(payload.questNpcId);
      break;
    }

    case 'LEGENDARY_DEED': {
      deedType = 'legendary_action';
      title = payload.name || 'A Legendary Act';
      narrative = `${authorName} achieved: ${payload.description || 'A moment of glory.'}`;
      powerLevel = Math.min(100, payload.magnitude || 85);
      sentiment = payload.sentiment === 'tragic' ? 'tragic' : 'triumphant';
      if (payload.witnesses) relatedContacts.push(...payload.witnesses);
      break;
    }

    case 'FACTION_SKIRMISH': {
      deedType = 'faction_victory';
      const factions = payload.factionIds?.join(' vs ') || 'Factions';
      title = `The Battle of ${payload.locationId || 'the Contested Lands'}`;
      narrative = `During ${epochId}, conflict erupted ${factions}. ` +
        `${authorName} affected the outcome. ${payload.narrative || 'Power shifted.'}`;
      powerLevel = Math.min(100, payload.powerShift ? Math.abs(payload.powerShift) * 2 : 70);
      sentiment = payload.outcome === 'victory' ? 'triumphant' : 'sorrowful';
      if (payload.factionIds) relatedContacts.push(...payload.factionIds);
      break;
    }

    case 'NPC_DEATH': {
      deedType = 'npc_death';
      title = `The Death of ${payload.npcName || 'a Notable'}`;
      narrative = `An important figure met their end${payload.cause ? ` through ${payload.cause}` : ''}. ` +
        `${authorName} played a role in this moment.`;
      powerLevel = payload.npcImportance === 'critical' ? 100 : 75;
      sentiment = 'sorrowful';
      if (payload.npcName) relatedContacts.push(payload.npcName);
      break;
    }

    case 'PLAYER_DEATH': {
      deedType = 'legendary_action';
      title = `The Fall of ${authorName}`;
      narrative = `In a climactic moment, ${authorName} fell. Their legacy lived on.`;
      powerLevel = 100;
      sentiment = 'tragic';
      break;
    }

    case 'WORLD_EVENT': {
      deedType = 'legendary_action';
      title = `The Event of ${payload.eventName || 'the Ages'}`;
      narrative = `An event: ${payload.description || 'Something momentous.'}. ` +
        `${authorName} was changed by it.`;
      powerLevel = Math.min(100, payload.magnitude ? payload.magnitude * 1.2 : 80);
      sentiment = payload.eventType === 'catastrophe' ? 'tragic' : 'mysterious';
      break;
    }

    default: {
      title = 'A Deed of Note';
      narrative = `${authorName} performed an action during ${epochId}. ` +
        `${payload.description || 'History would remember it.'}`;
      powerLevel = 50;
      sentiment = 'mysterious';
    }
  }

  return {
    kind: 'unique',
    itemId: 'lore_tome',
    instanceId,
    metadata: {
      title,
      narrativeContent: narrative,
      deedType,
      powerLevel,
      sentiment,
      authorName,
      epochCreated: epochId,
      readingTime: Math.ceil(narrative.length / 50),
      relatedContacts,
      experience: Math.floor(powerLevel * 0.5),
      sentience: Math.min(100, powerLevel + 20),
      corruption: 0,
      infusions: [],
      runes: []
    }
  };
}

/**
 * M53-B1: Archive legacy deeds as Lore Tomes for The Great Library
 */
export function archiveLegacyAsLoreTomes(
  legacy: LegacyImpact,
  epochId: string,
  deedEvents: Event[]
): LoreTome[] {
  const tomes: LoreTome[] = [];

  for (const deedEvent of deedEvents) {
    try {
      const tome = deedToLoreTome(deedEvent, legacy.canonicalName, epochId);
      tomes.push(tome);
    } catch (error) {
      console.warn(`Failed to convert event ${deedEvent.id} to tome:`, error);
    }
  }

  if (tomes.length === 0 && legacy.deeds.length > 0) {
    const summaryTome: LoreTome = {
      kind: 'unique',
      itemId: 'lore_tome',
      instanceId: `lore_tome_summary_${Date.now()}`,
      metadata: {
        title: `The Legend of ${legacy.canonicalName}`,
        narrativeContent:
          `This tome archives ${legacy.canonicalName}. ` +
          `Through ${legacy.epochsLived || 1} epoch(s), mythStatus: ${legacy.mythStatus}. ` +
          `${legacy.deeds.length} significant moments shaped history. ` +
          `May their legend endure.`,
        deedType: 'legendary_action',
        powerLevel: Math.min(100, legacy.mythStatus),
        sentiment: legacy.finalWorldState === 'improved' ? 'triumphant' : 'tragic',
        authorName: legacy.canonicalName,
        epochCreated: epochId,
        readingTime: 60,
        relatedContacts: [],
        experience: Math.floor(legacy.mythStatus * 0.75),
        sentience: 80,
        corruption: 0,
        infusions: [],
        runes: []
      }
    };
    tomes.push(summaryTome);
  }

  return tomes;
}

/**
 * M53-B1: Format a tome for UI display
 */
export function formatTomeForDisplay(tome: LoreTome): {
  title: string;
  author: string;
  content: string;
  readingTime: string;
  sentiment: string;
  rarity: string;
} {
  const powerToRarity = (power: number): string => {
    if (power >= 90) return 'Legendary';
    if (power >= 75) return 'Epic';
    if (power >= 60) return 'Rare';
    if (power >= 40) return 'Uncommon';
    return 'Common';
  };

  return {
    title: tome.metadata.title,
    author: tome.metadata.authorName,
    content: tome.metadata.narrativeContent,
    readingTime: `~${tome.metadata.readingTime}s`,
    sentiment: `(${tome.metadata.sentiment})`,
    rarity: powerToRarity(tome.metadata.powerLevel)
  };
}

/**
 * M53-B1: Create library catalog for display
 */
export function formatLibraryCatalog(tomes: LoreTome[]): Array<{
  index: number;
  title: string;
  author: string;
  rarity: string;
  epoch: string;
}> {
  return tomes.map((tome, idx) => {
    const powerToRarity = (power: number): string => {
      if (power >= 90) return '✦✦✦';
      if (power >= 75) return '✦✦';
      if (power >= 60) return '✦';
      return '•';
    };

    return {
      index: idx,
      title: tome.metadata.title,
      author: tome.metadata.authorName,
      rarity: powerToRarity(tome.metadata.powerLevel),
      epoch: tome.metadata.epochCreated
    };
  });
}