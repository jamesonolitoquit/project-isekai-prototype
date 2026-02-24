/**
 * factionEngine.ts — Faction Power Dynamics & Inter-Faction Conflicts
 * 
 * Phase 11: The Weight of Influence
 * 
 * Manages faction power graphs, conflicting influence, alliance/rivalry relationships,
 * and dynamic territorial control. Integrates with WTOL for faction-gated information.
 */

import { WorldState } from './worldEngine';
import { random } from './prng';

export type FactionCategory = 
  | 'political' 
  | 'religious' 
  | 'mercenary' 
  | 'legendary' 
  | 'shadow' 
  | 'adventure';

export type FactionRole = 'leader' | 'soldier' | 'informant' | 'merchant' | 'priest' | 'member';

export type RelationshipType = 'alliance' | 'neutral' | 'rivalry' | 'war' | 'dependency';

export interface Faction {
  id: string;
  name: string;
  category: FactionCategory;
  description?: string;
  powerScore: number; // 0-100: political/military influence
  alignment: 'good' | 'neutral' | 'evil' | 'chaotic'; // Belief alignment
  primaryLocationId?: string; // Headquarters
  coreBeliefs: string[]; // Ideological pillars
  memberCount?: number;
  controlledLocationIds: string[]; // Territories under faction dominance
  influenceTheme?: {
    // M15 Step 5: Visual theme for faction territory dominance
    color: string; // Hex color for territory tinting
    ambiance: 'industrial' | 'ethereal' | 'opulent' | 'none'; // Ambiactic visual/audio filter
  };
  resourcePool?: {
    gold: number;
    magicNodes: number; // Magic resource access
    relics: number; // Relic count held
  };
  // M51-A1: Faction Strategic Command
  playerStrategy?: 'CONQUEST' | 'ESPIONAGE' | 'ISOLATIONISM'; // Player-commanded strategy
}

export interface FactionRelationship {
  factionAId: string;
  factionBId: string;
  type: RelationshipType;
  weight: number; // -100 to +100, strength of relationship
  lastEventId?: string;
  lastUpdated: number; // timestamp
}

export interface FactionConflict {
  id: string;
  factionIds: string[];
  type: 'diplomatic' | 'religious' | 'military' | 'economic' | 'infiltration';
  trigger: string; // Description of what caused conflict
  active: boolean;
  startedAt: number; // tick
  resolvedAt?: number;
}

/**
 * Initialize factions for world instance
 * Creates base faction relationships and power structures
 */
export function initializeFactions(state: WorldState): Faction[] {
  return [
    {
      id: 'silver-flame',
      name: 'The Silver Flame',
      category: 'religious',
      description: 'An order of healers and protectors devoted to light magic',
      powerScore: 60,
      alignment: 'good',
      primaryLocationId: 'moonwell-shrine',
      coreBeliefs: ['healing', 'protection', 'light-magic', 'virtue'],
      memberCount: 25,
      controlledLocationIds: ['moonwell-shrine', 'eldergrove-village'],
      influenceTheme: {
        color: '#fffacd',
        ambiance: 'ethereal'
      },
      resourcePool: { gold: 500, magicNodes: 3, relics: 1 }
    },
    {
      id: 'ironsmith-guild',
      name: 'Ironsmith Guild',
      category: 'adventure',
      description: 'Crafters and merchants specializing in forged weapons and armor',
      powerScore: 45,
      alignment: 'neutral',
      primaryLocationId: 'forge-summit',
      coreBeliefs: ['craftsmanship', 'trade', 'self-improvement', 'community'],
      memberCount: 20,
      controlledLocationIds: ['forge-summit'],
      influenceTheme: {
        color: '#8b4513',
        ambiance: 'industrial'
      },
      resourcePool: { gold: 300, magicNodes: 1, relics: 0 }
    },
    {
      id: 'luminara-mercantile',
      name: 'Luminara Mercantile Consortium',
      category: 'political',
      description: 'Merchants and traders controlling economic flow through the realm',
      powerScore: 55,
      alignment: 'neutral',
      primaryLocationId: 'luminara-grand-market',
      coreBeliefs: ['trade', 'profit', 'information', 'neutrality'],
      memberCount: 40,
      controlledLocationIds: ['luminara-grand-market'],
      influenceTheme: {
        color: '#ffd700',
        ambiance: 'opulent'
      },
      resourcePool: { gold: 1000, magicNodes: 0, relics: 0 }
    },
    {
      id: 'shadow-conclave',
      name: 'Shadow Conclave',
      category: 'shadow',
      description: 'Secret society dealing in forbidden knowledge and artifacts',
      powerScore: 35,
      alignment: 'evil',
      primaryLocationId: 'thornwood-depths',
      coreBeliefs: ['knowledge', 'power', 'secrecy', 'forbidden-magic'],
      memberCount: 12,
      controlledLocationIds: ['thornwood-depths'],
      influenceTheme: {
        color: '#4d0099',
        ambiance: 'none'
      },
      resourcePool: { gold: 200, magicNodes: 2, relics: 2 }
    },
    {
      id: 'adventurers-league',
      name: "Adventurers' League",
      category: 'adventure',
      description: 'Open collective of independent adventurers bound by common interest',
      powerScore: 40,
      alignment: 'chaotic',
      coreBeliefs: ['freedom', 'exploration', 'heroism', 'opportunity'],
      memberCount: 15,
      controlledLocationIds: [],
      influenceTheme: {
        color: '#00bfff',
        ambiance: 'none'
      },
      resourcePool: { gold: 100, magicNodes: 0, relics: 0 }
    }
  ];
}

/**
 * Initialize faction relationships with power dynamics
 */
export function initializeFactionRelationships(): FactionRelationship[] {
  return [
    // Silver Flame & Ironsmith Guild - Alliance
    {
      factionAId: 'silver-flame',
      factionBId: 'ironsmith-guild',
      type: 'alliance',
      weight: 70,
      lastUpdated: 0
    },
    // Silver Flame & Shadow Conclave - War
    {
      factionAId: 'silver-flame',
      factionBId: 'shadow-conclave',
      type: 'war',
      weight: -85,
      lastUpdated: 0
    },
    // Luminara & Shadow Conclave - Neutral
    {
      factionAId: 'luminara-mercantile',
      factionBId: 'shadow-conclave',
      type: 'neutral',
      weight: 10,
      lastUpdated: 0
    },
    // Luminara & Ironsmith Guild - Alliance
    {
      factionAId: 'luminara-mercantile',
      factionBId: 'ironsmith-guild',
      type: 'alliance',
      weight: 60,
      lastUpdated: 0
    },
    // Adventurers League & Shadow Conclave - Rivalry
    {
      factionAId: 'adventurers-league',
      factionBId: 'shadow-conclave',
      type: 'rivalry',
      weight: -45,
      lastUpdated: 0
    },
    // Adventurers League & Silver Flame - Alliance
    {
      factionAId: 'adventurers-league',
      factionBId: 'silver-flame',
      type: 'alliance',
      weight: 55,
      lastUpdated: 0
    }
  ];
}

/**
 * Calculate power shift for a faction
 * Called when faction gains/loses influence from player actions or events
 */
export function calculatePowerShift(
  factions: Faction[],
  factionId: string,
  delta: number
): Faction[] {
  const updated = factions.map(f => {
    if (f.id === factionId) {
      return {
        ...f,
        powerScore: Math.max(0, Math.min(100, f.powerScore + delta))
      };
    }
    return f;
  });
  return updated;
}

/**
 * Get relationship between two factions
 */
export function getFactionRelationship(
  relationships: FactionRelationship[],
  factionAId: string,
  factionBId: string
): FactionRelationship | undefined {
  return relationships.find(
    r => (r.factionAId === factionAId && r.factionBId === factionBId) ||
         (r.factionAId === factionBId && r.factionBId === factionAId)
  );
}

/**
 * Calculate tension between two factions
 * Higher tension = more likely conflict
 * Based on relationship type and power balance
 */
export function calculateFactionTension(
  relationshipWeight: number,
  powerScoreDiff: number
): number {
  // Base tension from relationship (war/rivalry = high tension)
  let tension = Math.abs(relationshipWeight) > 50 ? 70 : 30;
  
  // Large power imbalance increases tension
  if (Math.abs(powerScoreDiff) > 30) {
    tension += 20;
  }
  
  return Math.min(100, tension);
}

/**
 * Check if faction conflict should trigger during faction tick
 * Returns conflict if one should occur
 */
export function checkForFactionConflict(
  factionA: Faction,
  factionB: Faction,
  relationship: FactionRelationship,
  randomVal: number // 0-1 random number
): FactionConflict | null {
  // Calculate if conflict should occur
  const powerDiff = factionA.powerScore - factionB.powerScore;
  const tension = calculateFactionTension(relationship.weight, powerDiff);
  
  // Check if random outcome triggers conflict
  const conflictThreshold = tension / 100; // 0-1
  
  if (randomVal < conflictThreshold * 0.15) { // 15% of tension = conflict chance
    const conflictTypes: FactionConflict['type'][] = 
      relationship.type === 'war' ? ['military', 'military'] :
      relationship.type === 'rivalry' ? ['economic', 'military', 'infiltration'] :
      relationship.type === 'neutral' ? ['diplomatic'] :
      ['diplomatic'];
    
    const type = conflictTypes[Math.floor(random() * conflictTypes.length)];
    const randTag = Math.floor(random() * 0xffffff).toString(16);
    
    return {
      id: `conflict-${factionA.id}-${factionB.id}-${randTag}`,
      factionIds: [factionA.id, factionB.id],
      type,
      trigger: `Tension between ${factionA.name} and ${factionB.name} erupted`,
      active: true,
      startedAt: 0 // Would be set by worldEngine
    };
  }
  
  return null;
}

/**
 * Apply faction conflict resolution
 * Shifts power based on conflict outcome
 */
export function resolveFactionConflict(
  factions: Faction[],
  conflict: FactionConflict,
  winnerId?: string,
  loserId?: string
): Faction[] {
  if (!winnerId || !loserId) return factions;
  
  const powerShift = 5; // Power lost/gained per conflict
  let updated = factions;
  
  // Winner gains power
  updated = calculatePowerShift(updated, winnerId, powerShift);
  
  // Loser loses power
  updated = calculatePowerShift(updated, loserId, -powerShift);
  
  return updated;
}

/**
 * Process territory control changes
 * Triggered after faction conflicts or player actions
 */
export function updateTerritoryControl(
  factions: Faction[],
  locationId: string,
  newControllingFactionId: string
): Faction[] {
  return factions.map(f => {
    // Remove location from all factions
    if (f.controlledLocationIds.includes(locationId)) {
      return {
        ...f,
        controlledLocationIds: f.controlledLocationIds.filter(id => id !== locationId)
      };
    }
    
    // Add to controlling faction
    if (f.id === newControllingFactionId) {
      return {
        ...f,
        controlledLocationIds: [...f.controlledLocationIds, locationId]
      };
    }
    
    return f;
  });
}

/**
 * Get NPC faction affiliation from world state
 */
export function getNpcFaction(
  state: WorldState,
  npcId: string
): string | undefined {
  const npc = state.npcs.find(n => n.id === npcId);
  return npc ? (npc as any).factionId : undefined;
}

/**
 * Update NPC faction affiliation
 * Used when NPCs switch sides or defect
 */
export function updateNpcFaction(
  npcs: any[],
  npcId: string,
  newFactionId: string
): any[] {
  return npcs.map(npc => {
    if (npc.id === npcId) {
      return { ...npc, factionId: newFactionId };
    }
    return npc;
  });
}

/**
 * Player reputation with a faction affects gameplay
 * Returns faction attitude based on reputation
 */
export function getFactionAttitude(
  playerReputation: number
): 'allied' | 'neutral' | 'hostile' {
  if (playerReputation >= 50) return 'allied';
  if (playerReputation <= -50) return 'hostile';
  return 'neutral';
}

/**
 * Check if player can access faction-gated content
 */
export function canAccessFactionContent(
  playerReputation: number,
  requiredReputation: number,
  requiredAttitude?: 'allied' | 'neutral' | 'hostile'
): boolean {
  if (playerReputation < requiredReputation) return false;
  
  if (requiredAttitude) {
    const attitude = getFactionAttitude(playerReputation);
    return attitude === requiredAttitude;
  }
  
  return true;
}

/**
 * Apply faction power influence on world events
 * Higher faction power = more quest availability, resource access, etc.
 */
export function getFactionInfluence(
  factions: Faction[],
  factionId: string
): number {
  const faction = factions.find(f => f.id === factionId);
  return faction ? faction.powerScore : 0;
}

/**
 * ALPHA_M3: Resolve a full day of faction turns
 * Called every 24 ticks (1 game day)
 * 
 * Processes:
 * 1. Power gains from controlled territories
 * 2. Relationship decay/improvement over time
 * 3. Conflict initiation and resolution
 * 4. Territory control changes
 * 
 * Returns array of events describing faction changes
 */
export function resolveFactionTurns(
  state: WorldState,
  factions: Faction[],
  relationships: FactionRelationship[],
  conflicts: FactionConflict[]
): { 
  updatedFactions: Faction[]; 
  updatedRelationships: FactionRelationship[];
  updatedConflicts: FactionConflict[];
  events: any[] 
} {
  const events: any[] = [];
  let updatedFactions = [...factions];
  let updatedRelationships = [...relationships];
  let updatedConflicts = [...conflicts];

  // === PHASE 1: Calculate power gains from territories ===
  for (const faction of updatedFactions) {
    const territoryCount = faction.controlledLocationIds.length;
    const powerGain = territoryCount * 2; // +2 power per controlled location per day
    
    if (powerGain > 0 && territoryCount > 0) {
      const oldPower = faction.powerScore;
      const newPower = Math.min(100, faction.powerScore + powerGain);
      
      updatedFactions = updatedFactions.map(f => 
        f.id === faction.id ? { ...f, powerScore: newPower } : f
      );

      events.push({
        type: 'FACTION_POWER_SHIFT',
        factionId: faction.id,
        factionName: faction.name,
        reason: `territorial-control (${territoryCount} locations)`,
        powerBefore: oldPower,
        powerAfter: newPower,
        delta: newPower - oldPower
      });
    }

    // Factions without any territory lose power (attrition)
    if (territoryCount === 0 && faction.powerScore > 10) {
      const oldPower = faction.powerScore;
      const newPower = Math.max(0, faction.powerScore - 3); // -3 power per day without territory
      
      updatedFactions = updatedFactions.map(f => 
        f.id === faction.id ? { ...f, powerScore: newPower } : f
      );

      if (newPower < oldPower) {
        events.push({
          type: 'FACTION_POWER_SHIFT',
          factionId: faction.id,
          factionName: faction.name,
          reason: 'no-territory-attrition',
          powerBefore: oldPower,
          powerAfter: newPower,
          delta: newPower - oldPower
        });
      }
    }
  }

  // === PHASE 2: Relationship decay and improvement ===
  updatedRelationships = updatedRelationships.map(rel => {
    let newWeight = rel.weight;
    
    // Neutral relationships slowly drift toward 0
    if (rel.type === 'neutral' && Math.abs(rel.weight) > 0) {
      newWeight = rel.weight > 0 
        ? Math.max(0, rel.weight - 2)
        : Math.min(0, rel.weight + 2);
    }
    
    // Alliances strengthen slightly over time
    if (rel.type === 'alliance' && rel.weight < 100) {
      newWeight = Math.min(100, rel.weight + 1);
    }
    
    // Wars intensify (weight becomes more negative)
    if (rel.type === 'war' && rel.weight > -100) {
      newWeight = Math.max(-100, rel.weight - 2);
    }
    
    // Rivalries occasionally fluctuate
    if (rel.type === 'rivalry') {
      const fluctuation = Math.floor(random() * 5) - 2; // -2 to +2
      newWeight = Math.max(-100, Math.min(100, rel.weight + fluctuation));
    }

    if (newWeight !== rel.weight) {
      events.push({
        type: 'FACTION_RELATIONSHIP_CHANGED',
        factionA: rel.factionAId,
        factionB: rel.factionBId,
        relationshipType: rel.type,
        weightBefore: rel.weight,
        weightAfter: newWeight,
        reason: 'time-decay'
      });
    }

    return { ...rel, weight: newWeight, lastUpdated: state.tick ?? 0 };
  });

  // === PHASE 3: Check for new conflicts ===
  for (const rel of updatedRelationships) {
    // Don't initiate new conflicts if one already exists
    const existingConflict = updatedConflicts.find(c => 
      c.active && 
      ((c.factionIds[0] === rel.factionAId && c.factionIds[1] === rel.factionBId) ||
       (c.factionIds[0] === rel.factionBId && c.factionIds[1] === rel.factionAId))
    );

    if (existingConflict) continue;

    // Get faction objects
    const factionA = updatedFactions.find(f => f.id === rel.factionAId);
    const factionB = updatedFactions.find(f => f.id === rel.factionBId);
    
    if (!factionA || !factionB) continue;

    // Check if conflict should trigger
    const conflictChance = random();
    const newConflict = checkForFactionConflict(factionA, factionB, rel, conflictChance);
    
    if (newConflict) {
      newConflict.startedAt = state.tick ?? 0;
      updatedConflicts.push(newConflict);

      events.push({
        type: 'FACTION_CONFLICT_STARTED',
        conflictId: newConflict.id,
        factionA: factionA.name,
        factionB: factionB.name,
        conflictType: newConflict.type,
        message: `${factionA.name} and ${factionB.name} are now in ${newConflict.type} conflict!`
      });
    }
  }

  // === PHASE 4: Resolve active conflicts (random outcomes) ===
  updatedConflicts = updatedConflicts.map(conflict => {
    if (!conflict.active) return conflict;

    // Conflicts last 2-5 days before resolution
    const durationTicks = Math.floor(24 * (Math.floor(random() * 4) + 2));
    const conflictAge = (state.tick ?? 0) - conflict.startedAt;

    if (conflictAge >= durationTicks) {
      // Determine winner
      const factionAId = conflict.factionIds[0];
      const factionBId = conflict.factionIds[1];
      const factionA = updatedFactions.find(f => f.id === factionAId);
      const factionB = updatedFactions.find(f => f.id === factionBId);

      if (factionA && factionB) {
        // Winner determined by power + luck
        const aWinChance = 0.5 + (factionA.powerScore - factionB.powerScore) / 200;
        const winnerId = random() < aWinChance ? factionAId : factionBId;
        const loserId = winnerId === factionAId ? factionBId : factionAId;

        // Apply power shifts
        updatedFactions = resolveFactionConflict(updatedFactions, conflict, winnerId, loserId);

        events.push({
          type: 'FACTION_CONFLICT_RESOLVED',
          conflictId: conflict.id,
          winner: updatedFactions.find(f => f.id === winnerId)?.name,
          loser: updatedFactions.find(f => f.id === loserId)?.name,
          conflictType: conflict.type
        });
      }

      return { ...conflict, active: false, resolvedAt: state.tick ?? 0 };
    }

    return conflict;
  });

  return {
    updatedFactions,
    updatedRelationships,
    updatedConflicts,
    events
  };
}

/**
 * ALPHA_M19: Process physical manifestation of faction warfare in game world
 * Military conflicts spawn soldier NPCs and create location scars
 */
export function processWarfarePhysicality(
  state: WorldState,
  conflict: FactionConflict
): { newNpcs: any[]; locationScars: any[] } {
  const newNpcs: any[] = [];
  const locationScars: any[] = [];

  // Validate conflict is military AND active
  if (!conflict || conflict.type !== 'military' || !conflict.active) {
    return { newNpcs, locationScars };
  }

  // Validate factionIds and state.factions exist
  if (!conflict.factionIds || conflict.factionIds.length === 0 || !state.factions) {
    return { newNpcs, locationScars };
  }

  // Get factions involved in this conflict
  const involvedFactions = state.factions.filter(f => 
    f && f.id && conflict.factionIds.includes(f.id)
  );

  if (involvedFactions.length === 0) {
    return { newNpcs, locationScars };
  }

  // Collect all controlled locations from conflict factions
  const targetLocations = new Set<string>();
  for (const faction of involvedFactions) {
    if (faction.controlledLocationIds && Array.isArray(faction.controlledLocationIds)) {
      for (const locId of faction.controlledLocationIds) {
        targetLocations.add(locId);
      }
    }
  }

  if (targetLocations.size === 0) {
    return { newNpcs, locationScars };
  }

  // Spawn soldiers and create scars for each contested location
  for (const locationId of targetLocations) {
    const location = state.locations?.find(l => l && l.id === locationId);
    if (!location) continue;

    // Determine soldier count per location (2-4 soldiers)
    const soldierCount = 2 + Math.floor(random() * 3);

    // Spawn soldiers for this location
    for (let i = 0; i < soldierCount; i++) {
      const soldier: any = {
        id: `soldier-${conflict.id}-${locationId}-${i}`,
        name: random() < 0.5 ? `Soldier of ${involvedFactions[0]?.name}` : `Mercenary ${i + 1}`,
        locationId,
        factionId: involvedFactions[0]?.id,
        hp: Math.floor(25 + random() * 20),
        maxHp: 45,
        stats: {
          str: 15 + Math.floor(random() * 5),
          agi: 10 + Math.floor(random() * 5),
          int: 8,
          cha: 9,
          end: 12,
          luk: 8
        },
        personality: {
          type: 'aggressive',
          attackThreshold: 20,
          defendThreshold: 10,
          riskTolerance: 0.7
        },
        importance: 'minor',
        isWarfareUnit: true, // Cleanup after conflict ends
        emotionalState: {
          trust: 50,
          fear: 30,
          gratitude: 50,
          resentment: 70,
          emotionalHistory: []
        },
        dialogue: [`We hold this ground for the ${involvedFactions[0]?.name}.`, 'Stand back, civilian.']
      };

      newNpcs.push(soldier);
    }

    // Create location scar from warfare
    const scarType = random() < 0.6 ? 'infrastructure_damage' : 'market_closure';
    const scar: any = {
      locationId,
      scarType,
      appliedAt: state.tick ?? 0,
      description: scarType === 'infrastructure_damage'
        ? `${location.name} shows signs of recent conflict - buildings scarred, streets damaged`
        : `The market at ${location.name} is temporarily closed due to warfare`,
      terrainModifier: -0.2, 
      economicModifier: -0.3, 
      duration: 5000 // ~3.5 in-game days
    };

    locationScars.push(scar);
  }

  return { newNpcs, locationScars };
}

/**
 * ALPHA_M19: Apply location scars to world state
 */
export function applyLocationScars(state: WorldState, scars: any[]): void {
  for (const scar of scars) {
    const location = state.locations?.find(l => l.id === scar.locationId);
    if (!location) continue;

    // Initialize scars array if missing
    if (!(location as any).activeScars) {
      (location as any).activeScars = [];
    }

    (location as any).activeScars.push({
      ...scar,
      appliedAt: state.tick ?? 0
    });
  }
}

/**
 * ALPHA_M19: Cleanup location scars after duration expires
 */
export function expireLocationScars(state: WorldState): void {
  for (const location of state.locations || []) {
    const scars = (location as any).activeScars;
    if (!scars || scars.length === 0) continue;

    (location as any).activeScars = scars.filter((scar: any) => {
      const elapsed = (state.tick ?? 0) - scar.appliedAt;
      return elapsed < scar.duration;
    });
  }
}

