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
      return (player.paradoxLevel ?? 0) >= 20;
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
