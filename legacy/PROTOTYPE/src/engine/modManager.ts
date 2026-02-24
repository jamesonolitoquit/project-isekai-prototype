/**
 * M33: Mod Manager - Community Mod Loader
 * 
 * Purpose: Enable runtime injection of custom content (Items, Spells, QuestObjectives)
 * into the world template, allowing communities to extend worlds without code changes.
 * 
 * Supports loading sidecar JSON mod files that define new game entities.
 */

import type { WorldState, NPC, Location, Quest, ResourceNode } from './worldEngine';

/**
 * M33: Generic Item type for mod content
 */
export interface ModItem {
  id: string;
  name: string;
  type: string;
  rarity?: string;
  description?: string;
  stats?: Record<string, number>;
}

/**
 * M33: Mod interface for standardized content injection
 */
export interface Mod {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  content: {
    items?: ModItem[];
    npcs?: NPC[];
    locations?: Location[];
    quests?: Quest[];
    customData?: Record<string, any>; // For extensibility
  };
  compatibility?: {
    minEngineVersion?: string;
    maxEngineVersion?: string;
    targetEpochs?: string[]; // e.g., ['epoch_i_fracture', 'epoch_ii_waning']
  };
  metadata?: {
    tags?: string[];
    downloadUrl?: string;
    lastUpdated?: number;
  };
}

/**
 * M33: Registry of loaded mods
 */
interface ModRegistry {
  mods: Map<string, Mod>;
  activeModIds: string[];
  injectedIntoStates: Set<string>; // WorldState IDs that have had mods injected
}

const MOD_REGISTRY: ModRegistry = {
  mods: new Map(),
  activeModIds: [],
  injectedIntoStates: new Set()
};

/**
 * M33: Register a mod in the local mod manager
 */
export function registerMod(mod: Mod): void {
  if (MOD_REGISTRY.mods.has(mod.id)) {
    console.warn(`[ModManager] Mod ${mod.id} already registered, replacing...`);
  }

  MOD_REGISTRY.mods.set(mod.id, mod);
  console.log(`[ModManager] Registered mod: ${mod.name} (${mod.id})`);
}

/**
 * M33: Load a mod from JSON (typically from file upload or clipboard)
 */
export function loadModFromJson(jsonString: string): Mod {
  try {
    const mod = JSON.parse(jsonString) as Mod;

    // Validate required fields
    if (!mod.id || !mod.name || !mod.version || !mod.content) {
      throw new Error('Mod missing required fields: id, name, version, content');
    }

    registerMod(mod);
    return mod;
  } catch (err) {
    throw new Error(`Failed to load mod from JSON: ${err}`);
  }
}

/**
 * M33: Inject a mod's content into a WorldState
 * Returns a new WorldState with the mod's items, NPCs, etc. merged in
 */
export function injectModData(state: WorldState, modId: string): WorldState {
  const mod = MOD_REGISTRY.mods.get(modId);
  if (!mod) {
    throw new Error(`Mod ${modId} not registered. Use registerMod() first.`);
  }

  // Check compatibility
  if (mod.compatibility?.targetEpochs) {
    if (!state.epochId || !mod.compatibility.targetEpochs.includes(state.epochId)) {
      console.warn(
        `[ModManager] Mod ${modId} may not be compatible with epoch ${state.epochId}`
      );
    }
  }

  let updatedState = { ...state };

  // M33: Inject items (add as resource nodes in world)
  if (mod.content.items && mod.content.items.length > 0) {
    const existingNodes = updatedState.resourceNodes || [];
    
    // Create resource nodes for each mod item
    const newNodes: ResourceNode[] = mod.content.items
      .filter(item => !existingNodes.some(node => node.id === `mod_${modId}_item_${item.id}`))
      .map((item, idx) => ({
        id: `mod_${modId}_item_${item.id}`,
        lootTableId: `mod_item_${item.id}`,
        locationId: state.locations?.[idx % (state.locations?.length || 1)]?.id || 'unknown',
        regeneratesInHours: 0
      }));

    updatedState = {
      ...updatedState,
      resourceNodes: [...existingNodes, ...newNodes]
    };

    console.log(`[ModManager] Injected ${newNodes.length} items from mod ${modId}`);
  }

  // M33: Inject NPCs (add to world)
  if (mod.content.npcs && mod.content.npcs.length > 0) {
    const existingNpcs = updatedState.npcs || [];
    const newNpcs = mod.content.npcs.filter(
      npc => !existingNpcs.some(n => n.id === npc.id)
    );

    updatedState = {
      ...updatedState,
      npcs: [...existingNpcs, ...newNpcs]
    };

    console.log(`[ModManager] Injected ${newNpcs.length} NPCs from mod ${modId}`);
  }

  // M33: Inject locations (add to world map)
  if (mod.content.locations && mod.content.locations.length > 0) {
    const existingLocations = updatedState.locations || [];
    const newLocations = mod.content.locations.filter(
      loc => !existingLocations.some(l => l.id === loc.id)
    );

    updatedState = {
      ...updatedState,
      locations: [...existingLocations, ...newLocations]
    };

    console.log(`[ModManager] Injected ${newLocations.length} locations from mod ${modId}`);
  }

  // M33: Inject quests (add to available quests)
  if (mod.content.quests && mod.content.quests.length > 0) {
    const existingQuests = updatedState.quests || [];
    const newQuests = mod.content.quests.filter(
      q => !existingQuests.some(eq => eq.id === q.id)
    );

    updatedState = {
      ...updatedState,
      quests: [...existingQuests, ...newQuests]
    };

    console.log(`[ModManager] Injected ${newQuests.length} quests from mod ${modId}`);
  }

  // Mark this state as having mod injections
  MOD_REGISTRY.injectedIntoStates.add(state.id);

  return updatedState;
}

/**
 * M33: Batch inject multiple mods into state
 */
export function injectMultipleMods(state: WorldState, modIds: string[]): WorldState {
  let result = state;

  for (const modId of modIds) {
    try {
      result = injectModData(result, modId);
    } catch (err) {
      console.error(`[ModManager] Failed to inject mod ${modId}:`, err);
      // Continue with next mod on error
    }
  }

  return result;
}

/**
 * M33: Enable/disable a mod for future injections
 */
export function setModActive(modId: string, active: boolean): void {
  if (active && !MOD_REGISTRY.activeModIds.includes(modId)) {
    MOD_REGISTRY.activeModIds.push(modId);
    console.log(`[ModManager] Enabled mod: ${modId}`);
  } else if (!active && MOD_REGISTRY.activeModIds.includes(modId)) {
    MOD_REGISTRY.activeModIds = MOD_REGISTRY.activeModIds.filter(id => id !== modId);
    console.log(`[ModManager] Disabled mod: ${modId}`);
  }
}

/**
 * M33: Get all registered mods
 */
export function getAllMods(): Mod[] {
  return Array.from(MOD_REGISTRY.mods.values());
}

/**
 * M33: Get a specific mod
 */
export function getMod(modId: string): Mod | undefined {
  return MOD_REGISTRY.mods.get(modId);
}

/**
 * M33: Remove a mod from registry
 */
export function unregisterMod(modId: string): boolean {
  const hadMod = MOD_REGISTRY.mods.has(modId);
  if (hadMod) {
    MOD_REGISTRY.mods.delete(modId);
    MOD_REGISTRY.activeModIds = MOD_REGISTRY.activeModIds.filter(id => id !== modId);
    console.log(`[ModManager] Unregistered mod: ${modId}`);
  }
  return hadMod;
}

/**
 * M33: Export mod registry as JSON for backup/sharing
 */
export function exportModRegistry(): string {
  const modArray = Array.from(MOD_REGISTRY.mods.values());
  return JSON.stringify(
    {
      modCount: modArray.length,
      activeModIds: MOD_REGISTRY.activeModIds,
      mods: modArray
    },
    null,
    2
  );
}

/**
 * M33: Import previously exported mod registry
 */
export function importModRegistry(jsonString: string): number {
  try {
    const registry = JSON.parse(jsonString) as {
      modCount: number;
      activeModIds: string[];
      mods: Mod[];
    };

    let importedCount = 0;
    for (const mod of registry.mods || []) {
      registerMod(mod);
      importedCount++;
    }

    // Restore active mod state
    MOD_REGISTRY.activeModIds = registry.activeModIds || [];

    console.log(`[ModManager] Imported ${importedCount} mods from registry`);
    return importedCount;
  } catch (err) {
    throw new Error(`Failed to import mod registry: ${err}`);
  }
}

/**
 * M33: Get stats on mod injection
 */
export function getModStats(): {
  totalModsRegistered: number;
  activeModsCount: number;
  statesWithMods: number;
  contentInjected: {
    items: number;
    npcs: number;
    locations: number;
    quests: number;
  };
} {
  let totalItems = 0;
  let totalNpcs = 0;
  let totalLocations = 0;
  let totalQuests = 0;

  const mods = Array.from(MOD_REGISTRY.mods.values());
  for (const mod of mods) {
    totalItems += mod.content.items?.length || 0;
    totalNpcs += mod.content.npcs?.length || 0;
    totalLocations += mod.content.locations?.length || 0;
    totalQuests += mod.content.quests?.length || 0;
  }

  return {
    totalModsRegistered: MOD_REGISTRY.mods.size,
    activeModsCount: MOD_REGISTRY.activeModIds.length,
    statesWithMods: MOD_REGISTRY.injectedIntoStates.size,
    contentInjected: {
      items: totalItems,
      npcs: totalNpcs,
      locations: totalLocations,
      quests: totalQuests
    }
  };
}

/**
 * M34: Remote Mod Distribution - Fetch mod from GitHub Gist or raw URL
 * Supports:
 * - GitHub Gists: https://gist.github.com/user/gist-id
 * - Raw GitHub URLs: https://raw.githubusercontent.com/user/repo/branch/path/mod.json
 * - Direct URLs: https://example.com/mods/my-mod.json
 */
export async function fetchRemoteMod(url: string): Promise<Mod> {
  try {
    // Validate and normalize URL
    const normalizedUrl = normalizeModUrl(url);
    
    console.log(`[ModManager] Fetching remote mod from: ${normalizedUrl}`);

    // Fetch the JSON from the URL
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json') && !contentType?.includes('text/plain')) {
      throw new Error(`Invalid content type: ${contentType}. Expected JSON.`);
    }

    const jsonText = await response.text();
    const mod = loadModFromJson(jsonText);

    // Add metadata about remote source
    if (!mod.metadata) {
      mod.metadata = {};
    }
    mod.metadata.downloadUrl = url;
    mod.metadata.lastUpdated = Date.now();

    console.log(`[ModManager] Successfully loaded remote mod: ${mod.name} (${mod.id})`);
    return mod;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch remote mod from "${url}": ${message}`);
  }
}

/**
 * M34: Normalize mod URLs to get raw JSON
 * Converts GitHub Gist UI links to raw content URLs
 */
function normalizeModUrl(url: string): string {
  // GitHub Gist: https://gist.github.com/user/gist-id → https://gist.githubusercontent.com/user/gist-id/raw
  if (url.includes('gist.github.com')) {
    const match = url.match(/gist\.github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      return `https://gist.githubusercontent.com/${match[1]}/raw`;
    }
  }

  // GitHub raw URL (already raw)
  if (url.includes('raw.githubusercontent.com')) {
    return url;
  }

  // Direct URL (assume it's already correct)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If no protocol, assume https
  if (!url.startsWith('http')) {
    return `https://${url}`;
  }

  return url;
}

/**
 * M34: Fetch and apply a remote mod to world state in one operation
 */
export async function applyRemoteModToState(state: WorldState, url: string): Promise<WorldState> {
  try {
    const mod = await fetchRemoteMod(url);
    return injectModData(state, mod.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to apply remote mod: ${message}`);
  }
}

/**
 * M34: Check if a URL is a valid mod URL
 */
export function isValidModUrl(url: string): boolean {
  try {
    const normalized = normalizeModUrl(url);
    return normalized.startsWith('http://') || normalized.startsWith('https://');
  } catch {
    return false;
  }
}

/**
 * M34: Batch fetch multiple remote mods
 */
export async function fetchRemoteModBatch(urls: string[]): Promise<{ loaded: Mod[]; failed: Array<{ url: string; error: string }> }> {
  const results = { loaded: [] as Mod[], failed: [] as Array<{ url: string; error: string }> };

  for (const url of urls) {
    try {
      const mod = await fetchRemoteMod(url);
      results.loaded.push(mod);
    } catch (error) {
      results.failed.push({
        url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}
