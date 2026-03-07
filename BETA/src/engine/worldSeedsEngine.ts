/**
 * ALPHA_M17 - Legacy Persistence: World Seeds & Template Export
 * 
 * Purpose: Enable players to export their mutated Luxfier world and share it
 * as a new starting template for other players. This creates a form of
 * "generational gameplay" where worlds evolve through multiple players.
 * 
 * Features:
 * 1. Export current world state as a "World Seed"
 * 2. Encode world mutations (faction states, NPC deaths, lore unlocks, locations)
 * 3. Create shareable world templates (QR codes, IDs, URLs)
 * 4. Allow new players to load shared worlds and continue the story
 * 5. Track "generation" (how many players have this world)
 * 6. Preserve important narrative moments while randomizing fresh encounters
 */

import type { WorldState } from './worldEngine';
import type { NPC, Location } from './worldEngine';
import type { Faction } from './factionEngine';
import type { Event } from '../events/mutationLog';

export interface WorldSeedExport {
  id: string;
  name: string;
  description: string;
  generation: number; // How many players have inherited this world
  creator: string; // Player who created this seed
  createdAt: number; // Timestamp
  lastModified: number;
  
  // Mutations that carry forward
  factionStates: Array<{
    factionId: string;
    name: string;
    reputation: number; // Player's reputation with faction
    controlledLocations: string[]; // Locations dominated by this faction
    influenceMap: Record<string, number>; // Influence at each location
  }>;
  
  npcMutations: Array<{
    npcId: string;
    name: string;
    isDead: boolean;
    relationshipTier: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';
    lastKnownLocation: string;
  }>;
  
  locationMutations: Array<{
    locationId: string;
    name: string;
    discovered: boolean;
    hasSecret: boolean;
    secretName?: string;
  }>;
  
  loreMutations: Array<{
    loreId: string;
    title: string;
    isUnlocked: boolean;
    discoveryType: 'dialogue' | 'discovery' | 'combat' | 'event' | 'faction' | 'temporal';
  }>;
  
  // Narrative metadata
  majórEvents: Array<{
    eventType: string;
    description: string;
    tick: number;
  }>;
  
  // Statistics for UI presentation
  playTime: number; // Total tick count (represents time played)
  turningPointCount: number;
  temporalDebt: number;
  suspicionLevel: number;
  
  // For validation
  checksum: string;
  version: string;
}

export interface WorldSeedMetadata {
  id: string;
  name: string;
  creator: string;
  generation: number;
  createdAt: number;
  rating?: number; // Out of 5 stars (community feature)
  downloads?: number;
  description: string;
  seedCode: string; // Shareable identifier (shorter than full ID)
}

const WORLD_SEEDS: Map<string, WorldSeedExport> = new Map();

const WORLD_SEED_VERSION = '1.0.0';
const SEED_CODE_LENGTH = 8; // Shareable code length

/**
 * Generate a shareable seed code from world seed ID
 */
function generateSeedCode(seedId: string): string {
  const hash = seedId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  const code = Math.abs(hash).toString(36).toUpperCase().padEnd(SEED_CODE_LENGTH, '0').substring(0, SEED_CODE_LENGTH);
  return code;
}

/**
 * Extract faction states from world state for export
 */
function extractFactionStates(state: WorldState): WorldSeedExport['factionStates'] {
  if (!state.factions) return [];
  
  return state.factions.map(faction => ({
    factionId: faction.id,
    name: faction.name,
    reputation: state.player.factionReputation?.[faction.id] || 0,
    controlledLocations: state.locations
      .filter(loc => state.influenceMap?.[loc.id]?.[faction.id] && 
                     state.influenceMap[loc.id][faction.id] > 60)
      .map(loc => loc.id),
    influenceMap: state.influenceMap?.[faction.id] || {}
  }));
}

/**
 * Extract NPC mutations from state for export
 */
function extractNpcMutations(state: WorldState): WorldSeedExport['npcMutations'] {
  if (!state.npcs) return [];
  
  return state.npcs.map(npc => {
    const isDead = npc.hp === 0;
    
    // Determine relationship tier
    let relationshipTier: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied' = 'neutral';
    if (npc.factionId && state.player.factionReputation) {
      const rep = state.player.factionReputation[npc.factionId] || 0;
      if (rep >= 61) relationshipTier = 'allied';
      else if (rep >= 21) relationshipTier = 'friendly';
      else if (rep <= -61) relationshipTier = 'hostile';
      else if (rep <= -21) relationshipTier = 'unfriendly';
    }
    
    return {
      npcId: npc.id,
      name: npc.name,
      isDead,
      relationshipTier,
      lastKnownLocation: npc.locationId || 'unknown'
    };
  });
}

/**
 * Extract location mutations from state
 */
function extractLocationMutations(state: WorldState): WorldSeedExport['locationMutations'] {
  if (!state.locations) return [];
  
  return state.locations.map(loc => ({
    locationId: loc.id,
    name: loc.name,
    discovered: hasItem(state.player.visitedLocations, loc.id),
    hasSecret: false,
    secretName: ''
  }));
}

/**
 * Extract lore mutations from state
 */
function extractLoreMutations(state: WorldState): WorldSeedExport['loreMutations'] {
  if (!state.player.knowledgeBase || (state.player.knowledgeBase as Map<string, any>).size === 0) {
    return [];
  }
  
  const lores: WorldSeedExport['loreMutations'] = [];
  (state.player.knowledgeBase as Map<string, any>).forEach((value, key) => {
    if (key.startsWith('lore-')) {
      lores.push({
        loreId: key,
        title: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        isUnlocked: true,
        discoveryType: 'discovery' // Simplified; in real impl would track actual trigger
      });
    }
  });
  
  return lores;
}

/**
 * Helper to check if item exists in Set/Array
 */
function hasItem(collection: Set<string> | string[] | undefined, item: string): boolean {
  if (!collection) return false;
  if (collection instanceof Set) return collection.has(item);
  return (collection as string[]).includes(item);
}

/**
 * Extract major narrative events from event log (simplified)
 */
function extractMajorEvents(events: Event[], limit = 10): WorldSeedExport['majórEvents'] {
  return events
    .filter(e => {
      const type = e.type.toUpperCase();
      return type.includes('QUEST_COMPLETE') || 
             type.includes('FACTION_CONTROL') ||
             type.includes('LORE_DISCOVERED');
    })
    .slice(-limit)
    .map(e => ({
      eventType: e.type,
      description: e.type.split('_').join(' ').toLowerCase(),
      tick: e.timestamp ? Math.floor(e.timestamp / 1000) : 0
    }));
}

/**
 * Create a world seed export from current game state
 */
export function createWorldSeed(
  state: WorldState,
  playerName: string,
  description: string,
  eventLog: Event[]
): WorldSeedExport {
  const seedId = `seed_${Date.now()}_${Math.floor(Math.random() * 0xffffff).toString(16)}`;
  
  const seed: WorldSeedExport = {
    id: seedId,
    name: `${playerName}'s Luxfier`,
    description,
    generation: 1,
    creator: playerName,
    createdAt: Date.now(),
    lastModified: Date.now(),
    
    factionStates: extractFactionStates(state),
    npcMutations: extractNpcMutations(state),
    locationMutations: extractLocationMutations(state),
    loreMutations: extractLoreMutations(state),
    
    majórEvents: extractMajorEvents(eventLog),
    
    playTime: state.tick || 0,
    turningPointCount: eventLog.filter(e => 
      e.type.includes('QUEST_COMPLETE') || e.type.includes('FACTION_CONTROL')
    ).length,
    temporalDebt: state.player.temporalDebt || 0,
    suspicionLevel: state.player.suspicionLevel || 0,
    
    checksum: '',
    version: WORLD_SEED_VERSION
  };
  
  // Calculate checksum
  seed.checksum = calculateWorldSeedChecksum(seed);
  
  WORLD_SEEDS.set(seedId, seed);
  return seed;
}

/**
 * Calculate checksum for world seed integrity
 */
function calculateWorldSeedChecksum(seed: Omit<WorldSeedExport, 'checksum'>): string {
  const toHash = JSON.stringify({
    id: seed.id,
    generation: seed.generation,
    creator: seed.creator,
    factionCount: seed.factionStates.length,
    npcCount: seed.npcMutations.length,
    locCount: seed.locationMutations.length,
    loreCount: seed.loreMutations.length,
    playTime: seed.playTime,
    version: seed.version
  });
  
  let hash = 0;
  for (let i = 0; i < toHash.length; i++) {
    const char = toHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Keep as 32-bit int
  }
  
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Export world seed as JSON string
 */
export function exportWorldSeedJson(seedId: string): string  {
  const seed = WORLD_SEEDS.get(seedId);
  if (!seed) {
    throw new Error(`World seed ${seedId} not found`);
  }
  
  return JSON.stringify(seed, null, 2);
}

/**
 * Import world seed from JSON
 */
export function importWorldSeedJson(jsonData: string): WorldSeedExport {
  const seed = JSON.parse(jsonData) as WorldSeedExport;
  
  // Validate structure
  if (!seed.id || !seed.creator || !seed.factionStates) {
    throw new Error('Invalid world seed format');
  }
  
  // Verify checksum
  const expectedChecksum = calculateWorldSeedChecksum(seed);
  if (seed.checksum !== expectedChecksum) {
    throw new Error('World seed checksum mismatch - seed may be corrupted');
  }
  
  WORLD_SEEDS.set(seed.id, seed);
  return seed;
}

/**
 * Get metadata for a world seed (for listing/sharing)
 */
export function getWorldSeedMetadata(seedId: string): WorldSeedMetadata | null {
  const seed = WORLD_SEEDS.get(seedId);
  if (!seed) return null;
  
  const seedCode = generateSeedCode(seedId);
  
  return {
    id: seed.id,
    name: seed.name,
    creator: seed.creator,
    generation: seed.generation,
    createdAt: seed.createdAt,
    description: seed.description,
    seedCode
  };
}

/**
 * List all world seeds as metadata (for UI browsing)
 */
export function listWorldSeeds(): WorldSeedMetadata[] {
  return Array.from(WORLD_SEEDS.values()).map(seed => ({
    id: seed.id,
    name: seed.name,
    creator: seed.creator,
    generation: seed.generation,
    createdAt: seed.createdAt,
    description: seed.description,
    seedCode: generateSeedCode(seed.id)
  }));
}

/**
 * Find world seed by shareable code
 */
export function findWorldSeedByCode(code: string): WorldSeedExport | null {
  for (const seed of Array.from(WORLD_SEEDS.values())) {
    if (generateSeedCode(seed.id) === code.toUpperCase()) {
      return seed;
    }
  }
  return null;
}

/**
 * Load world seed as new starting template
 * Returns mutations needed to apply to new world
 */
export function loadWorldSeedAsTemplate(seedId: string): {
  factionOverrides: Record<string, any>;
  npcMutations: Record<string, any>;
  discoveredLocations: string[];
  unlockedLore: string[];
  playerReputation: Record<string, number>;
} {
  const seed = WORLD_SEEDS.get(seedId);
  if (!seed) {
    throw new Error(`World seed ${seedId} not found`);
  }
  
  return {
    factionOverrides: Object.fromEntries(
      seed.factionStates.map(f => [f.factionId, { name: f.name }])
    ),
    npcMutations: Object.fromEntries(
      seed.npcMutations.map(n => [n.npcId, { isDead: n.isDead }])
    ),
    discoveredLocations: seed.locationMutations
      .filter(l => l.discovered)
      .map(l => l.locationId),
    unlockedLore: seed.loreMutations
      .filter(l => l.isUnlocked)
      .map(l => l.loreId),
    playerReputation: Object.fromEntries(
      seed.factionStates.map(f => [f.factionId, f.reputation * 0.75]) // New player starts at 75% of original rep
    )
  };
}

/**
 * Increment generation when a new player loads a seed
 */
export function inheritWorldSeed(
  seedId: string,
  newPlayerName: string
): WorldSeedExport {
  const seed = WORLD_SEEDS.get(seedId);
  if (!seed) {
    throw new Error(`World seed ${seedId} not found`);
  }
  
  const inheritedSeed: WorldSeedExport = {
    ...seed,
    id: `seed_${Date.now()}_${Math.floor(Math.random() * 0xffffff).toString(16)}`,
    generation: seed.generation + 1,
    creator: `${newPlayerName} (via ${seed.creator})`,
    createdAt: Date.now(),
    lastModified: Date.now()
  };
  
  inheritedSeed.checksum = calculateWorldSeedChecksum(inheritedSeed);
  WORLD_SEEDS.set(inheritedSeed.id, inheritedSeed);
  
  return inheritedSeed;
}

/**
 * Generate shareable URL for world seed (would be used by UI)
 */
export function generateSeedUrl(seedId: string, baseUrl: string = 'https://isekai.world'): string {
  const code = generateSeedCode(seedId);
  return `${baseUrl}/load-seed/${code}`;
}

/**
 * Generate QR code data for sharing (returns JSON string for QR encoding)
 */
export function generateSeedQrData(seedId: string): string {
  const metadata = getWorldSeedMetadata(seedId);
  if (!metadata) {
    throw new Error(`Seed ${seedId} not found`);
  }
  
  return JSON.stringify({
    type: 'isekai_world_seed',
    seedCode: metadata.seedCode,
    name: metadata.name,
    creator: metadata.creator,
    generation: metadata.generation
  });
}

/**
 * Statistics about world seed ecosystem
 */
export function getWorldSeedStats(): {
  totalSeeds: number;
  averageGeneration: number;
  mostPopularCreator: string | null;
  oldestSeed: number;
  diversityScore: number; // 0-100, based on variation
} {
  if (WORLD_SEEDS.size === 0) {
    return {
      totalSeeds: 0,
      averageGeneration: 0,
      mostPopularCreator: null,
      oldestSeed: 0,
      diversityScore: 0
    };
  }
  
  const seeds = Array.from(WORLD_SEEDS.values());
  const avgGeneration = seeds.reduce((sum, s) => sum + s.generation, 0) / seeds.length;
  
  const creatorCounts = new Map<string, number>();
  seeds.forEach(s => {
    creatorCounts.set(s.creator, (creatorCounts.get(s.creator) || 0) + 1);
  });
  
  const mostPopularCreator = Array.from(creatorCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  
  const oldestSeed = Math.min(...seeds.map(s => s.createdAt));
  
  // Diversity based on faction variation
  let diversityScore = 50;
  const factionVariations = new Set(seeds.flatMap(s => s.factionStates.map(f => f.factionId)));
  diversityScore += Math.min(50, factionVariations.size * 10);
  
  return {
    totalSeeds: WORLD_SEEDS.size,
    averageGeneration: avgGeneration,
    mostPopularCreator,
    oldestSeed,
    diversityScore: Math.min(100, diversityScore)
  };
}
