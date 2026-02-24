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
  baseColor?: string; // Hex color code for UI representation
  resourcePool?: {
    gold: number;
    magicNodes: number; // Magic resource access
    relics: number; // Relic count held
  };
  // Internal properties for faction genealogy
  _originEpochId?: string; // Original faction ID from epoch creation
  _isExtinct?: boolean; // Whether faction has gone extinct
  _isSchism?: boolean; // Whether this faction was created from a schism
  _parentFactionId?: string; // Parent faction ID if this is a schism
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
  return npc ? npc.factionId : undefined;
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
 * ALPHA_M19: Process physical manifestation of faction warfare in game world
 * Military conflicts spawn soldier NPCs and create location scars
 */
export function processWarfarePhysicality(
  state: any,
  conflict: any
): { newNpcs: any[]; locationScars: any[] } {
  const newNpcs: any[] = [];
  const locationScars: any[] = [];

  // Validate conflict is military AND active
  if (!conflict || conflict.type !== 'military' || !conflict.active) {
    return { newNpcs, locationScars };
  }

  // Validate factionIds and state.factions exist
  if (!conflict.factionIds || !Array.isArray(conflict.factionIds) || !state.factions) {
    return { newNpcs, locationScars };
  }

  // Get factions involved in this conflict
  const involvedFactions = state.factions.filter((f: any) => 
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
    const location = state.locations?.find((l: any) => l && l.id === locationId);
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
export function applyLocationScars(state: any, scars: any[]): void {
  for (const scar of scars) {
    const location = state.locations?.find((l: any) => l.id === scar.locationId);
    if (!location) continue;

    // Initialize scars array if missing
    if (!location.activeScars) {
      location.activeScars = [];
    }

    location.activeScars.push({
      ...scar,
      appliedAt: state.tick ?? 0
    });
  }
}

/**
 * ALPHA_M19: Cleanup location scars after duration expires
 */
export function expireLocationScars(state: any): void {
  for (const location of state.locations || []) {
    const scars = location.activeScars;
    if (!scars || scars.length === 0) continue;

    location.activeScars = scars.filter((scar: any) => {
      const elapsed = (state.tick ?? 0) - scar.appliedAt;
      return elapsed < scar.duration;
    });
  }
}

/**
 * Faction Genealogy: Determine which factions dissolve/evolve during epoch transition
 * 
 * Rules:
 * - Factions with powerScore < 10 become "Extinct" and lose territories
 * - Powerful factions (power > 60) with low player rep (< 25) spawn rebel "Schism" variants
 * - Extinct factions' territories are absorbed by strongest rival
 */
export function evolveFactionGeneology(
  factions: Faction[],
  playerFactionReputations: Record<string, number>
): {
  evolved: Faction[];
  extinct: string[];
  newSchisms: Faction[];
} {
  const evolved: Faction[] = [];
  const extinct: string[] = [];
  const newSchisms: Faction[] = [];

  factions.forEach(faction => {
    // Rule 1: Faction Dissolution (Power < 10)
    if (faction.powerScore < 10) {
      extinct.push(faction.id);
      // Don't add to evolved - faction is gone
      return;
    }

    // Create evolved faction with standard aging
    const evolvedFaction: Faction = {
      ...faction,
      _originEpochId: faction._originEpochId || faction.id,
      _isExtinct: false
    };

    // Rule 2: Faction Schism (Power > 60 AND player rep < 25)
    const playerRep = playerFactionReputations[faction.id] || 0;
    if (faction.powerScore > 60 && playerRep < 25) {
      const schismId = `schism_of_${faction.id}_rebel`;
      const schismFaction: Faction = {
        id: schismId,
        name: `Rebel ${faction.name}`,
        category: faction.category,
        description: `Splinter faction that broke away from the oppressive rule of ${faction.name}`,
        powerScore: Math.floor(faction.powerScore * 0.4), // Schism is weaker initially
        alignment: faction.alignment === 'good' ? 'chaotic' : 'good', // Often oppositional
        primaryLocationId: faction.primaryLocationId,
        coreBeliefs: [...faction.coreBeliefs, 'rebellion', 'reform'],
        memberCount: Math.floor((faction.memberCount || 10) * 0.3),
        controlledLocationIds: [],
        resourcePool: {
          gold: (faction.resourcePool?.gold || 0) * 0.2,
          magicNodes: Math.max(0, (faction.resourcePool?.magicNodes || 1) - 1),
          relics: Math.max(0, (faction.resourcePool?.relics || 0) - 1)
        },
        _isSchism: true,
        _parentFactionId: faction.id,
        _originEpochId: faction._originEpochId || faction.id
      };
      newSchisms.push(schismFaction);
      
      // Parent faction weakened by schism
      evolvedFaction.powerScore = Math.floor(faction.powerScore * 0.85);
      evolvedFaction.memberCount = Math.floor((faction.memberCount || 10) * 0.7);
    }

    evolved.push(evolvedFaction);
  });

  return { evolved, extinct, newSchisms };
}

/**
 * Redistribute territories from extinct factions to strong rivals
 */
export function redistributeExtinctTerritories(
  factions: Faction[],
  extinctFactionIds: string[]
): Faction[] {
  // Collect all territories from extinct factions
  const orphanedLocations: string[] = [];
  extinctFactionIds.forEach(extinctId => {
    const extinct = factions.find(f => f.id === extinctId);
    if (extinct?.controlledLocationIds) {
      orphanedLocations.push(...extinct.controlledLocationIds);
    }
  });

  if (orphanedLocations.length === 0) return factions;

  // Find strongest rival (highest power score)
  const activeFactions = factions.filter(f => !extinctFactionIds.includes(f.id));
  const strongest = activeFactions.reduce((a, b) =>
    (a.powerScore || 0) > (b.powerScore || 0) ? a : b
  );

  if (!strongest) return factions;

  // Transfer orphaned territories to strongest
  return factions.map(f => {
    if (f.id === strongest.id) {
      return {
        ...f,
        controlledLocationIds: [
          ...(f.controlledLocationIds || []),
          ...orphanedLocations
        ]
      };
    }
    return f;
  });
}

/**
 * Check if an NPC belongs to an extinct faction
 */
export function isNpcFromExtinctFaction(
  npc: any,
  extinctFactionIds: string[]
): boolean {
  return extinctFactionIds.includes(npc.factionId || npc.id);
}
/**
 * M37: Faction Strategic Goal Types
 */
export type FactionGoalType = 
  | 'expand_territory'
  | 'espionage'
  | 'alliance'
  | 'military_build'
  | 'propaganda'
  | 'trade_monopoly'
  | 'magic_research'
  | 'sabotage';

/**
 * M37: Strategic goal for faction to pursue
 */
export interface FactionStrategicGoal {
  id: string;
  factionId: string;
  type: FactionGoalType;
  targetFactionId?: string;      // For espionage, alliance, sabotage
  targetLocationId?: string;     // For expand_territory
  powerCost: number;             // Power required to pursue
  progressPerTurn: number;       // Progress made each turn
  currentProgress: number;       // Progress accumulated
  requiredProgress: number;      // Progress needed to complete
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  completedAt?: number;
  reward?: {
    powerGain?: number;
    territoryGain?: string[];
    allianceGain?: string[];
    espionageResult?: string;
  };
}

/**
 * M37: Faction turn execution state
 */
export interface FactionTurnResult {
  factionId: string;
  powerSpent: number;
  goalsProgressed: FactionStrategicGoal[];
  goalsCompleted: FactionStrategicGoal[];
  eventsTriggered: string[];
  territoryChanges: { gained: string[]; lost: string[] };
  powerGainedThisTurn: number;
  newConflicts: FactionConflict[];
}

/**
 * M37: Calculate power generation per turn for a faction
 * Based on territory size, resource pool, and member count
 */
export function calculateFactionPowerGeneration(faction: Faction): number {
  let basePower = 5; // Base power per turn

  // territorial bonus: +1 power per controlled location
  basePower += (faction.controlledLocationIds?.length || 0) * 1;

  // Resource pool bonus
  if (faction.resourcePool) {
    basePower += Math.floor(faction.resourcePool.gold / 100); // 1 power per 100 gold
    basePower += faction.resourcePool.magicNodes * 3;         // 3 power per magic node
    basePower += faction.resourcePool.relics * 5;              // 5 power per relic
  }

  // Member count bonus
  basePower += Math.floor((faction.memberCount || 0) / 10);    // 1 power per 10 members

  // Alignment penalty: chaotic/evil factions lose 20% power efficiency
  if (faction.alignment === 'chaotic' || faction.alignment === 'evil') {
    basePower = Math.floor(basePower * 0.8);
  }

  return Math.max(1, basePower);
}

/**
 * M37: Determine faction strategic priorities based on situational analysis
 */
export function evaluateFactionPriorities(
  faction: Faction,
  allFactions: Faction[],
  relationships: FactionRelationship[]
): FactionGoalType[] {
  const priorities: FactionGoalType[] = [];

  // Find rivals (negative relationships)
  const rivals = relationships
    .filter(r => (r.factionAId === faction.id || r.factionBId === faction.id) && r.weight < -30)
    .map(r => r.factionAId === faction.id ? r.factionBId : r.factionAId);

  // Find strong allies
  const allies = relationships
    .filter(r => (r.factionAId === faction.id || r.factionBId === faction.id) && r.weight > 30)
    .map(r => r.factionAId === faction.id ? r.factionBId : r.factionAId);

  // Build priority queue
  if (faction.powerScore && faction.powerScore > 70) {
    // Strong factions: expand and dominate
    priorities.push('expand_territory', 'trade_monopoly');
    if (rivals.length > 0) {
      priorities.push('sabotage', 'military_build');
    }
  } else if (faction.powerScore && faction.powerScore < 40) {
    // Weak factions: seek allies, hide
    priorities.push('alliance', 'espionage');
    if (allies.length === 0) {
      priorities.push('propaganda');
    }
  } else {
    // Mid-tier factions: balanced approach
    priorities.push('expand_territory', 'alliance', 'trade_monopoly');
    if (rivals.length > 0) {
      priorities.push('espionage');
    }
  }

  return priorities;
}

/**
 * M37: Create new strategic goal for a faction
 */
export function createFactionGoal(
  faction: Faction,
  goalType: FactionGoalType,
  targetFactionId?: string,
  targetLocationId?: string
): FactionStrategicGoal {
  // Determine power cost and progress requirements by goal type
  const goalConfig: Record<FactionGoalType, { cost: number; progressPerTurn: number; required: number }> = {
    expand_territory: { cost: 20, progressPerTurn: 15, required: 60 },
    espionage: { cost: 15, progressPerTurn: 10, required: 50 },
    alliance: { cost: 10, progressPerTurn: 8, required: 40 },
    military_build: { cost: 25, progressPerTurn: 12, required: 80 },
    propaganda: { cost: 8, progressPerTurn: 6, required: 30 },
    trade_monopoly: { cost: 18, progressPerTurn: 11, required: 55 },
    magic_research: { cost: 30, progressPerTurn: 14, required: 90 },
    sabotage: { cost: 22, progressPerTurn: 13, required: 70 },
  };

  const config = goalConfig[goalType];
  const priority = goalType === 'military_build' || goalType === 'sabotage' ? 'critical' : 'high';

  return {
    id: `goal-${faction.id}-${goalType}-${Date.now()}`,
    factionId: faction.id,
    type: goalType,
    targetFactionId,
    targetLocationId,
    powerCost: config.cost,
    progressPerTurn: config.progressPerTurn,
    currentProgress: 0,
    requiredProgress: config.required,
    priority,
    createdAt: Date.now(),
  };
}

/**
 * M37: Execute a single faction turn
 * Faction spends power on strategic goals, gains new power, and progresses objectives
 */
export function processFactionTurn(
  faction: Faction,
  allFactions: Faction[],
  relationships: FactionRelationship[],
  activeGoals: FactionStrategicGoal[],
  worldState: WorldState
): FactionTurnResult {
  const result: FactionTurnResult = {
    factionId: faction.id,
    powerSpent: 0,
    goalsProgressed: [],
    goalsCompleted: [],
    eventsTriggered: [],
    territoryChanges: { gained: [], lost: [] },
    powerGainedThisTurn: 0,
    newConflicts: [],
  };

  // Step 1: Calculate power generation this turn
  const powerGenerated = calculateFactionPowerGeneration(faction);
  let availablePower = faction.powerScore + powerGenerated;
  result.powerGainedThisTurn = powerGenerated;

  // Step 2: Retrieve active goals for this faction
  const factionGoals = activeGoals.filter(g => g.factionId === faction.id && !g.completedAt);

  // Step 3: Prioritize goal spending
  const priorities = evaluateFactionPriorities(faction, allFactions, relationships);
  const priorityMap = { critical: 0, high: 1, medium: 2, low: 3 };
  const goalsToFund = factionGoals.toSorted((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);

  // Step 4: Fund existing goals and create new ones if power available
  for (const goal of goalsToFund) {
    if (availablePower >= goal.powerCost) {
      availablePower -= goal.powerCost;
      result.powerSpent += goal.powerCost;

      // Progress the goal
      goal.currentProgress += goal.progressPerTurn;
      result.goalsProgressed.push(goal);

      // Check if goal is completed
      if (goal.currentProgress >= goal.requiredProgress) {
        goal.completedAt = Date.now();
        result.goalsCompleted.push(goal);

        // Apply goal rewards
        if (goal.type === 'expand_territory' && goal.targetLocationId) {
          result.territoryChanges.gained.push(goal.targetLocationId);
          result.eventsTriggered.push(`${faction.name} expanded to ${goal.targetLocationId}`);
        } else if (goal.type === 'alliance' && goal.targetFactionId) {
          result.eventsTriggered.push(`${faction.name} formed alliance with ${goal.targetFactionId}`);
        } else if (goal.type === 'sabotage' && goal.targetFactionId) {
          result.eventsTriggered.push(`${faction.name} sabotaged ${goal.targetFactionId}`);
          result.newConflicts.push({
            id: `conflict-${faction.id}-${goal.targetFactionId}-${Date.now()}`,
            factionIds: [faction.id, goal.targetFactionId],
            type: 'infiltration',
            trigger: 'Sabotage attempt discovered',
            active: true,
            startedAt: worldState.tick || 0,
          });
        }
      }
    }
  }

  // Step 5: If power remains, create new goal based on priorities
  if (availablePower > 15 && factionGoals.length < 3) {
    const nextPriority = priorities[Math.floor(Math.random() * Math.min(2, priorities.length))];
    if (nextPriority) {
      const targetFaction = allFactions.find(f => f.id !== faction.id && f.powerScore && f.powerScore > 50);
      const newGoal = createFactionGoal(
        faction,
        nextPriority,
        targetFaction?.id,
        targetFaction?.primaryLocationId
      );
      result.goalsProgressed.push(newGoal);
      result.powerSpent += newGoal.powerCost;
    }
  }

  // Step 6: Check for territorial losses (from rivals or conflicts)
  const rivalConflicts = relationships.filter(r =>
    (r.factionAId === faction.id || r.factionBId === faction.id) && r.weight < -50
  );
  if (rivalConflicts.length > 0 && faction.powerScore < 30) {
    // Weak faction with strong rivals may lose territory
    if (Math.random() > 0.7) {
      const lostTerritory = faction.controlledLocationIds?.[
        Math.floor(Math.random() * (faction.controlledLocationIds?.length || 0))
      ];
      if (lostTerritory) {
        result.territoryChanges.lost.push(lostTerritory);
        result.eventsTriggered.push(`${faction.name} lost control of ${lostTerritory}`);
      }
    }
  }

  return result;
}

/**
 * M37: Process all faction turns simultaneously
 * Returns updated faction list and new events
 */
export function processFactionRound(
  factions: Faction[],
  relationships: FactionRelationship[],
  activeGoals: FactionStrategicGoal[],
  worldState: WorldState
): {
  updatedFactions: Faction[];
  updatedGoals: FactionStrategicGoal[];
  turnResults: FactionTurnResult[];
  newConflicts: FactionConflict[];
  eventLog: string[];
} {
  const turnResults: FactionTurnResult[] = [];
  const newConflicts: FactionConflict[] = [];
  const eventLog: string[] = [];
  const updatedGoals = [...activeGoals];

  // Process each faction's turn
  for (const faction of factions) {
    const result = processFactionTurn(faction, factions, relationships, updatedGoals, worldState);
    turnResults.push(result);

    if (result.eventsTriggered.length > 0) {
      eventLog.push(...result.eventsTriggered);
    }

    if (result.newConflicts.length > 0) {
      newConflicts.push(...result.newConflicts);
    }
  }

  // Update faction properties based on turn results
  const updatedFactions = factions.map(faction => {
    const turnResult = turnResults.find(r => r.factionId === faction.id);
    if (!turnResult) return faction;

    // Apply power changes
    let newPowerScore = faction.powerScore + turnResult.powerGainedThisTurn - turnResult.powerSpent;
    newPowerScore = Math.max(0, Math.min(100, newPowerScore));

    // Apply territorial changes
    let controlledLocations = [...(faction.controlledLocationIds || [])];
    controlledLocations = controlledLocations.filter(loc => !turnResult.territoryChanges.lost.includes(loc));
    controlledLocations = [...new Set([...controlledLocations, ...turnResult.territoryChanges.gained])];

    return {
      ...faction,
      powerScore: newPowerScore,
      controlledLocationIds: controlledLocations,
    };
  });

  return {
    updatedFactions,
    updatedGoals,
    turnResults,
    newConflicts,
    eventLog,
  };
}

/**
 * M37: Get faction diagnostics for UI display (dashboard)
 */
export function getFactionDiagnostics(
  faction: Faction,
  relationships: FactionRelationship[],
  goals: FactionStrategicGoal[]
): Record<string, any> {
  const factionRelationships = relationships.filter(r =>
    r.factionAId === faction.id || r.factionBId === faction.id
  );

  const allies = factionRelationships.filter(r => r.type === 'alliance').length;
  const rivals = factionRelationships.filter(r => r.type === 'rivalry' || r.type === 'war').length;

  const factionGoals = goals.filter(g => g.factionId === faction.id && !g.completedAt);

  return {
    faction: faction.name,
    powerScore: faction.powerScore,
    powerGeneration: calculateFactionPowerGeneration(faction),
    controlledTerritories: faction.controlledLocationIds?.length || 0,
    memberCount: faction.memberCount || 0,
    resourcePool: faction.resourcePool,
    relationships: {
      allies,
      rivals,
      neutral: factionRelationships.length - allies - rivals,
    },
    activeGoals: factionGoals.length,
    topGoal: factionGoals.length > 0 ? factionGoals[0].type : null,
  };
}