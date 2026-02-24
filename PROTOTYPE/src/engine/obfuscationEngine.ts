import { WorldState, PlayerState, NPC } from './worldEngine';
import { getBeliefEngine, type HardFact, type Rumor } from './beliefEngine';

/**
 * Represents a limited view of the world that the player can perceive
 * This replaces actual values with obfuscated/masked data
 */
export interface FilteredState extends WorldState {
  npcs: FilteredNPC[];
  locations: FilteredLocation[];
  player: FilteredPlayerState;
  beliefLayer: BeliefLayer;
}

export interface FilteredNPC extends Omit<NPC, 'hp' | 'maxHp' | 'locationId' | 'name'> {
  name: string; // Either real name or "Mysterious Figure"
  locationId: string; // Either real or last-known
  hp?: number; // Either real number or undefined (hidden)
  maxHp?: number; // Either real number or undefined (hidden)
  healthDescription?: string; // "Healthy", "Wounded", "Near Death"
  isIdentified: boolean;
  isMaskedByFaction?: boolean; // True if masked due to faction war
  lastSeen?: { location: string; time: number };
}

export interface FilteredLocation extends Omit<WorldState['locations'][0], ''> {
  discovered: boolean;
  isVisible: boolean;
}

export interface FilteredPlayerState extends PlayerState {
  discoveredLocations: Set<string>;
  identifiedEntities: Set<string>;
}

export interface BeliefLayer {
  npcLocations: Record<string, string>; // NPC ID -> believed location (from dialogue)
  npcStats: Record<string, Partial<any>>; // NPC ID -> believed stats (false information)
  facts: Record<string, boolean>; // Event/fact ID -> whether player believes it
  suspicionLevel: number; // Accumulates when player acts on false beliefs
}

/**
 * Generate a vague health description instead of exact numbers
 */
function getHealthDescription(currentHp: number, maxHp: number): string {
  const percent = (currentHp / maxHp) * 100;
  if (percent > 80) return 'Perfect Health';
  if (percent > 60) return 'Healthy';
  if (percent > 40) return 'Wounded';
  if (percent > 20) return 'Badly Wounded';
  return 'Near Death';
}

/**
 * Generate a vague mana description
 */
function getManaDescription(currentMp: number, maxMp: number): string | undefined {
  if (maxMp === 0) return undefined;
  const percent = (currentMp / maxMp) * 100;
  if (percent > 70) return 'Abundant';
  if (percent > 40) return 'Moderate';
  if (percent > 10) return 'Low';
  return 'Critical';
}

/**
 * Check if NPC should be masked due to faction relationship
 * Returns true if player is at war with NPC's faction
 */
function shouldMaskNpcByFaction(
  npc: NPC,
  playerFactionReputation?: Record<string, number>
): boolean {
  if (!npc.factionId || !playerFactionReputation) {
    return false;
  }

  const factionRep = playerFactionReputation[npc.factionId] ?? 0;

  // At war: reputation < -85 (threshold for military conflict)
  return factionRep < -85;
}

/**
 * Check if NPC should be auto-revealed due to faction alliance
 * Returns true if player is allied with NPC's faction
 */
function shouldAutoRevealByFaction(
  npc: NPC,
  playerFactionReputation?: Record<string, number>
): boolean {
  if (!npc.factionId || !playerFactionReputation) {
    return false;
  }

  const factionRep = playerFactionReputation[npc.factionId] ?? 0;

  // Allied: reputation > 50
  return factionRep > 50;
}

/**
 * Filter the world state to show only what the player knows
 * This implements the World Truth Obfuscation Layer (WTOL)
 * 
 * Enhanced with faction-based filtering:
 * - Alliance Bonus: Auto-reveal all allied faction members
 * - War Penalty: Re-mask even identified NPCs from hostile factions
 */
export function filterStateForPlayer(
  groundTruth: WorldState,
  knowledgeBase: Set<string> | string[],
  beliefLayer: BeliefLayer,
  playerFactionReputation?: Record<string, number>
): FilteredState {
  // Convert array to Set if needed for consistency
  const kbSet = Array.isArray(knowledgeBase) ? new Set(knowledgeBase) : knowledgeBase;
  
  // Discover locations the player has visited
  const discoveredLocations = new Set(groundTruth.player?.visitedLocations || [groundTruth.player?.location]);

  // Filter NPCs based on knowledge and faction
  const filteredNpcs: FilteredNPC[] = groundTruth.npcs.map((npc) => {
    const isIdentified = kbSet.has(`npc:${npc.id}`);
    const lastSeen = undefined; // lastSeen tracking not yet implemented

    // Check faction-based access
    const shouldAutoReveal = shouldAutoRevealByFaction(npc, playerFactionReputation);
    const shouldMask = shouldMaskNpcByFaction(npc, playerFactionReputation);

    // Helper: Create safe FilteredNPC DTO (prevents WTOL leak via spread operators)
    const createFilteredNpc = (): FilteredNPC => ({
      id: npc.id,
      factionId: npc.factionId,
      factionRole: npc.factionRole,
      availability: npc.availability,
      name: '',
      locationId: '',
      hp: undefined,
      maxHp: undefined,
      healthDescription: '',
      isIdentified: false,
      isMaskedByFaction: false,
      lastSeen
    });

    // Auto-reveal if allied faction member
    if (shouldAutoReveal) {
      const filtered = createFilteredNpc();
      filtered.name = npc.name;
      filtered.locationId = npc.locationId;
      filtered.hp = npc.hp;
      filtered.maxHp = npc.maxHp;
      filtered.healthDescription = npc.hp && npc.maxHp ? getHealthDescription(npc.hp, npc.maxHp) : '???';
      filtered.isIdentified = true;
      filtered.isMaskedByFaction = false;
      return filtered;
    }

    // If player hasn't met this NPC, mask it
    if (!isIdentified) {
      const filtered = createFilteredNpc();
      filtered.name = 'Mysterious Figure';
      filtered.hp = undefined;
      filtered.maxHp = undefined;
      filtered.healthDescription = '???';
      filtered.isIdentified = false;
      filtered.isMaskedByFaction = false;
      filtered.locationId = beliefLayer.npcLocations[npc.id] || npc.locationId;
      return filtered;
    }

    // If identified but at war with faction, re-mask the NPC
    if (shouldMask) {
      const filtered = createFilteredNpc();
      filtered.name = '???';
      filtered.hp = undefined;
      filtered.maxHp = undefined;
      filtered.healthDescription = '???';
      filtered.isIdentified = false;
      filtered.isMaskedByFaction = true;
      filtered.locationId = beliefLayer.npcLocations[npc.id] || '???';
      return filtered;
    }

    // If identified and not at war, show real information
    const beliefLocation = beliefLayer.npcLocations[npc.id];
    const displayLocation = beliefLocation || npc.locationId;

    const filtered = createFilteredNpc();
    filtered.name = npc.name;
    filtered.locationId = displayLocation;
    filtered.hp = undefined;
    filtered.maxHp = undefined;
    filtered.healthDescription = npc.hp && npc.maxHp ? getHealthDescription(npc.hp, npc.maxHp) : '???';
    filtered.isIdentified = true;
    filtered.isMaskedByFaction = false;
    return filtered;
  });

  // Filter locations based on discovery
  const filteredLocations = groundTruth.locations.map((loc) => {
    const discovered = discoveredLocations.has(loc.id);
    return {
      ...loc,
      discovered,
      isVisible: discovered
    };
  });

  // Filter player state to hide unidentified stats
  const filteredPlayer: FilteredPlayerState = {
    ...groundTruth.player,
    discoveredLocations,
    identifiedEntities: new Set(
      Array.from(knowledgeBase).filter(k => k.startsWith('npc:')).map(k => k.replace('npc:', ''))
    )
  } as FilteredPlayerState;

  return {
    ...groundTruth,
    npcs: filteredNpcs,
    locations: filteredLocations,
    player: filteredPlayer,
    beliefLayer
  };
}

/**
 * Get health status with masking based on identification
 */
export function getMaskedHealthStatus(
  npc: FilteredNPC,
  isIdentified: boolean
): { hp: number | string; maxHp: number | string; description: string } {
  if (!isIdentified) {
    return {
      hp: '?',
      maxHp: '?',
      description: '???'
    };
  }

  return {
    hp: npc.hp ?? '?',
    maxHp: npc.maxHp ?? '?',
    description: npc.healthDescription || '???'
  };
}

/**
 * Reveal an NPC's true identity
 * Move from "Mysterious Figure" to known name
 */
export function revealNpcIdentity(
  npc: NPC,
  knowledgeBase: Set<string>
): void {
  knowledgeBase.add(`npc:${npc.id}`);
}

/**
 * Reveal an item's true properties
 */
export function revealItemIdentity(
  itemId: string,
  knowledgeBase: Set<string>
): void {
  knowledgeBase.add(`item:${itemId}`);
}

/**
 * Reveal a location's true properties
 */
export function revealLocation(
  locationId: string,
  knowledgeBase: Set<string>,
  discoveredLocations?: Set<string>
): void {
  knowledgeBase.add(`location:${locationId}`);
  if (discoveredLocations) {
    discoveredLocations.add(locationId);
  }
}

/**
 * Add a false belief to the belief layer
 * This is recorded when an NPC lies or the player is deceived
 */
export function addFalseBeliefNpc(
  beliefLayer: BeliefLayer,
  npcId: string,
  falseLocation?: string,
  falseStats?: any
): void {
  if (falseLocation) {
    beliefLayer.npcLocations[npcId] = falseLocation;
  }
  if (falseStats) {
    beliefLayer.npcStats[npcId] = { ...beliefLayer.npcStats[npcId], ...falseStats };
  }
}

/**
 * Correct a false belief when player discovers the truth
 */
export function correctBelief(
  beliefLayer: BeliefLayer,
  npcId: string
): void {
  delete beliefLayer.npcLocations[npcId];
  delete beliefLayer.npcStats[npcId];
}

/**
 * Increase suspicion when player acts on false information
 * This measures metagaming/cheating
 */
export function increaseSuspicion(
  beliefLayer: BeliefLayer,
  amount: number = 1
): void {
  beliefLayer.suspicionLevel = Math.min(100, beliefLayer.suspicionLevel + amount);
}

/**
 * Check if suspicious activity has reached threshold
 */
export function isSuspiciousActivity(beliefLayer: BeliefLayer): boolean {
  return beliefLayer.suspicionLevel >= 30;
}

/**
 * Get suspicion level description
 */
export function getSuspicionDescription(level: number): string {
  if (level === 0) return 'Innocent';
  if (level < 15) return 'Minor Coincidence';
  if (level < 30) return 'Questionable Behavior';
  if (level < 50) return 'Suspicious';
  if (level < 75) return 'Highly Suspicious';
  return 'Under Investigation';
}

/**
 * Reset belief layer for a location after player visits
 * Like a cache invalidation
 */
export function refreshLocationBeliefs(
  beliefLayer: BeliefLayer,
  locationId: string,
  npcs: NPC[]
): void {
  // Remove stale beliefs for NPCs in this location
  npcs.forEach((npc) => {
    if (npc.locationId === locationId && beliefLayer.npcLocations[npc.id]) {
      // If player visits location, they can verify actual NPC presence
      if (npc.locationId === beliefLayer.npcLocations[npc.id]) {
        // Belief was correct, keep it
      } else {
        // Belief was wrong, player discovers this
        delete beliefLayer.npcLocations[npc.id];
        increaseSuspicion(beliefLayer, -5); // Reduce suspicion when belief corrected
      }
    }
  });
}

/**
 * Generate discovery event data
 */
export function generateDiscoveryEvent(
  entityType: 'npc' | 'item' | 'location',
  entityId: string,
  entityName: string
): { type: string; payload: any } {
  return {
    type: 'ENTITY_DISCOVERED',
    payload: {
      entityType,
      entityId,
      entityName,
      discoveredAt: 0
    }
  };
}

/**
 * M45-A2: World Truth Obfuscation Layer (WTOL)
 * 
 * Wrapper for state delivery that filters facts based on player perception
 * Hard facts that the player doesn't have perception to know are replaced
 * with rumors (distorted versions) instead.
 * 
 * This creates the "belief layer" - the player's subjective understanding
 * of world events they shouldn't know about yet.
 */
export interface WtolFilteredState extends FilteredState {
  accessibleFacts: string[]; // Fact IDs the player can access
  rumoredFacts: Record<string, Rumor>; // Fact ID -> Rumor that player heard instead
  perceptionLevel: number; // Player's effective perception (0-100)
}

/**
 * Apply WTOL filtering to a player's state
 * 
 * This is the main function called before sending state to a client.
 * It:
 * 1. Calculates the player's perception level (faction rank, knowledge, etc.)
 * 2. Determines which hard facts the player can access
 * 3. Replaces inaccessible facts with rumors in the player's belief layer
 * 4. Returns a filtered state safe to send to client
 */
export function applyWtolToState(
  groundTruth: WorldState,
  knowledgeBase: Set<string> | string[],
  beliefLayer: BeliefLayer,
  playerFactionReputation?: Record<string, number>,
  playerFactionRank: number = 0
): WtolFilteredState {
  // Step 1: Calculate player's perception level
  const beliefEngine = getBeliefEngine();
  const playerId = groundTruth.player?.id || 'unknown';
  
  const perceptionLevel = beliefEngine.calculatePerceptionLevel(
    playerId,
    groundTruth,
    playerFactionRank
  );

  // Step 2: Get the base filtered state (faction masking, NPC identification)
  const baseFiltered = filterStateForPlayer(
    groundTruth,
    knowledgeBase,
    beliefLayer,
    playerFactionReputation
  );

  // Step 3: Determine which hard facts are accessible and which need rumor replacement
  const beliefRegistry = beliefEngine.getRegistry();
  const accessibleFacts: string[] = [];
  const rumoredFacts: Record<string, Rumor> = {};

  Object.entries(beliefRegistry.hardFacts).forEach(([factId, hardFact]) => {
    // Check if player has perception to know this fact
    const canAccess = beliefEngine.canAccessFact(
      playerId,
      factId,
      perceptionLevel.level
    );

    if (canAccess) {
      accessibleFacts.push(factId);
    } else {
      // Find the best rumor for this fact based on player's location
      const playerLocationId = groundTruth.player?.location || 'unknown';
      const rumors = Object.values(beliefRegistry.rumors)
        .filter(r => r.originalFactId === factId);

      if (rumors.length > 0) {
        // Pick rumor based on distance and faction
        const bestRumor = rumors.reduce((best, current) => {
          const currentConfidence = beliefEngine.getRumorConfidenceAtLocation(
            current.id,
            playerLocationId,
            hardFact.originLocationId,
            current.distanceFromOrigin
          );
          const bestConfidence = beliefEngine.getRumorConfidenceAtLocation(
            best.id,
            playerLocationId,
            hardFact.originLocationId,
            best.distanceFromOrigin
          );
          return currentConfidence > bestConfidence ? current : best;
        });

        rumoredFacts[factId] = bestRumor;
        
        // Add this rumor to player's knowledge base if perception is high enough
        if (perceptionLevel.level > 30) {
          beliefLayer.facts[factId] = false; // Marked as rumor, not true
        }
      }
    }
  });

  // Step 4: Create the WTOL-filtered state
  const wtolFiltered: WtolFilteredState = {
    ...baseFiltered,
    accessibleFacts,
    rumoredFacts,
    perceptionLevel: perceptionLevel.level
  };

  // Step 5: Inject rumors into NPC dialogue if appropriate
  // NPCs should mention rumors if they're confident enough
  if (wtolFiltered.npcs) {
    wtolFiltered.npcs.forEach(npc => {
      // NPCs in the same location would know local rumors
      const locationRumors = beliefEngine.getNpcRumorsForLocation(
        npc.locationId,
        npc.factionId || 'neutral'
      );

      if (locationRumors.length > 0) {
        // Store which rumors this NPC has heard
        locationRumors.forEach(rumor => {
          beliefEngine.addNpcRumorKnowledge(npc.id, rumor.id);
        });
      }
    });
  }

  return wtolFiltered;
}

/**
 * Helper: Determine if a location has "sensitive information"
 * These are facts/secrets players shouldn't know about unless faction rank is high
 */
export function getLocationSecrets(
  locationId: string,
  perceptionLevel: number
): { secret: string; requiredPerception: number }[] {
  // In full implementation, this would query a database of location secrets
  // For now, return an empty array as placeholder
  return [];
}

/**
 * Helper: Generate a rumor-based description for an NPC
 * Used when player hears about an NPC but hasn't met them
 */
export function generateRumorAboutNpc(
  npcId: string,
  npcName: string,
  npcFaction: string
): string {
  const descriptions = [
    `A mysterious ${npcFaction} operative known as ${npcName}...`,
    `They say ${npcName} works for ${npcFaction}... or maybe they don't...`,
    `Reports of someone called ${npcName} have been coming in from ${npcFaction} circles`,
    `${npcName} is said to be affiliated with ${npcFaction}, but who really knows?`,
    `There's SOME connection between ${npcName} and ${npcFaction}, but it's unclear...`
  ];
  
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

/**
 * Helper: Check if a memetic event (idea that spreads) should reach this player
 * Based on perception level and distance from origin
 */
export function shouldPlayerKnowAboutMemetEvent(
  eventOriginLocationId: string,
  playerLocationId: string,
  eventSeverity: number, // 0-100
  playerPerceptionLevel: number // 0-100
): boolean {
  // High perception = hear about more things
  const perceptionThreshold = 50 - (playerPerceptionLevel * 0.2);
  
  // High severity events spread wider
  const severityBonus = eventSeverity * 0.5;
  
  // Random spread based on combined factors
  const spreadChance = Math.min(100, perceptionThreshold + severityBonus);
  
  return Math.random() * 100 < spreadChance;
}

