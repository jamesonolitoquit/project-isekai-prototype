/**
 * Dungeon Generator — Milestone 31, Task 5
 * 
 * Purpose: Generate procedural dungeon layouts constrained by the current epoch
 * 
 * Epoch-Specific Mechanics:
 * - Epoch I (Fracture): Linear "Temple" layouts, loot-heavy, designed for exploration
 * - Epoch II (Waning): Branching mazes, moderate complexity, faction-themed
 * - Epoch III (Twilight): "Paradox Loops" where final room links to first, increasing difficulty
 *
 * Structure:
 * - Room nodes with connections
 * - Encounter/treasure specifications  
 * - Environmental hazards scaled by epoch
 */

import type { Location } from './worldEngine';
import { SeededRng } from './prng';

/**
 * Represents a single room in a dungeon
 */
export interface DungeonRoom {
  id: string;
  name: string;
  description: string;
  connections: string[];          // Connected room IDs
  encounters?: Array<{
    type: 'combat' | 'social' | 'environmental';
    name: string;
    difficulty: number;            // 1-10 scale
    rewards?: { loot: string[]; xp: number };
  }>;
  treasures: string[];            // Item IDs hidden here
  hazards: Array<{
    type: 'trap' | 'environmental' | 'paradox';
    name: string;
    difficulty: number;
  }>;
  atmosphere: string;             // Mood/aesthetic for narration
  corrupted?: boolean;            // True in Epoch III paradox corridors
}

/**
 * Complete dungeon structure
 */
export interface DungeonLayout {
  dungeonId: string;
  name: string;
  epochId: string;
  description: string;
  entryRoom: string;
  exitRoom: string;
  rooms: Map<string, DungeonRoom>;
  totalDifficulty: number;
  structure: 'linear' | 'branching' | 'paradox_loop';
  theme: string;                  // "temple", "crypt", "fractured_space", etc.
  // M44-B2: Faction integration
  factionId?: string;             // controlling faction (if any)
  contentionLevel?: number;        // 0-1, war intensity at location
  strongholdTheme?: boolean;       // true if faction stronghold (higher tier loot)
  hazardIntensity?: number;        // 0-1, scales with contention level
}

/**
 * Configuration for dungeon generation by epoch
 */
interface EpochDungeonConfig {
  structure: 'linear' | 'branching' | 'paradox_loop';
  avgRoomCount: number;
  lootMultiplier: number;
  encounterDensity: number;        // Probability of encounters per room
  hazardDensity: number;
  baseDifficulty: number;
  allowParadoxes: boolean;
  themes: string[];
}

/**
 * Get dungeon generation config for an epoch
 */
function getEpochConfig(epochId: string): EpochDungeonConfig {
  const configs: Record<string, EpochDungeonConfig> = {
    'epoch_i_fracture': {
      structure: 'linear',
      avgRoomCount: 6,
      lootMultiplier: 1.2,
      encounterDensity: 0.5,
      hazardDensity: 0.3,
      baseDifficulty: 3,
      allowParadoxes: false,
      themes: ['ancient_temple', 'ruined_sanctuary', 'merchant_vault']
    },
    'epoch_ii_waning': {
      structure: 'branching',
      avgRoomCount: 12,
      lootMultiplier: 1.0,
      encounterDensity: 0.6,
      hazardDensity: 0.5,
      baseDifficulty: 5,
      allowParadoxes: false,
      themes: ['corrupted_crypt', 'faded_fortress', 'twisted_cavern']
    },
    'epoch_iii_twilight': {
      structure: 'paradox_loop',
      avgRoomCount: 8,
      lootMultiplier: 0.8,
      encounterDensity: 0.8,
      hazardDensity: 0.7,
      baseDifficulty: 8,
      allowParadoxes: true,
      themes: ['fractured_space', 'time_loop', 'paradox_chamber']
    }
  };

  return configs[epochId] ?? configs['epoch_i_fracture'];
}

/**
 * Generate a dungeon layout for a location based on current epoch
 * M44-B2: Enhanced with faction and contention parameters for dynamic scaling
 */
export function generateDungeonLayout(
  locationId: string,
  locationName: string,
  epochId: string,
  seed: number,
  factionId?: string,
  contentionLevel?: number
): DungeonLayout {
  const rng = new SeededRng(seed);
  const config = getEpochConfig(epochId);

  const theme = config.themes[rng.nextInt(0, config.themes.length - 1)];
  const dungeonId = `${locationId}_${epochId}`;

  // M44-B2: Scale dungeon based on contention level
  const contentionMult = contentionLevel && contentionLevel > 0.6 ? 1.5 : 1.0; // 50% more rooms in war-torn areas

  // Generate room count based on config + randomness + contention
  let roomCount = config.avgRoomCount + rng.nextInt(-2, 2);
  roomCount = Math.ceil(roomCount * contentionMult);

  // M44-B2: Adjust encounter density based on faction stronghold
  const encounterDensity = factionId ? config.encounterDensity * 1.2 : config.encounterDensity;
  const hazardDensity = contentionLevel && contentionLevel > 0.6 ? config.hazardDensity * 1.3 : config.hazardDensity;

  // Create rooms
  const rooms = new Map<string, DungeonRoom>();
  const roomIds: string[] = [];

  for (let i = 0; i < roomCount; i++) {
    const roomId = `${dungeonId}_room_${i}`;
    roomIds.push(roomId);

    const room = generateRoom(roomId, i, roomCount, config, rng, epochId, theme, factionId, contentionLevel);
    rooms.set(roomId, room);
  }

  // Connect rooms based on structure
  if (config.structure === 'linear') {
    connectLinearRooms(rooms, roomIds);
  } else if (config.structure === 'branching') {
    connectBranchingRooms(rooms, roomIds, rng);
  } else if (config.structure === 'paradox_loop') {
    connectParadoxLoop(rooms, roomIds, rng);
  }

  // Calculate total difficulty
  let totalDifficulty = config.baseDifficulty;
  for (const room of Array.from(rooms.values())) {
    if (room.encounters) {
      totalDifficulty += room.encounters.reduce((sum: number, enc: any) => sum + enc.difficulty, 0);
    }
    totalDifficulty += room.hazards.length * (config.baseDifficulty / 3);
  }

  return {
    dungeonId,
    name: `${locationName}: ${theme.replace(/_/g, ' ')}`,
    epochId,
    description: generateDungeonDescription(theme, epochId),
    entryRoom: roomIds[0],
    exitRoom: roomIds[roomIds.length - 1],
    rooms,
    totalDifficulty,
    structure: config.structure,
    theme,
    // M44-B2: Faction integration fields
    factionId,
    contentionLevel,
    strongholdTheme: factionId !== undefined && contentionLevel !== undefined && contentionLevel > 0.5,
    hazardIntensity: contentionLevel !== undefined ? contentionLevel : 0.3
  };
}

/**
 * Generate a single room
 * M44-B2: Enhanced with faction and contention parameters
 */
function generateRoom(
  roomId: string,
  index: number,
  totalRooms: number,
  config: EpochDungeonConfig,
  rng: SeededRng,
  epochId: string,
  theme: string,
  factionId?: string,
  contentionLevel?: number
): DungeonRoom {
  const isEntry = index === 0;
  const isExit = index === totalRooms - 1;
  const isMiddle = index > 0 && index < totalRooms - 1;

  // M44-B2: Scale encounter density based on contention
  const encounterDensity = contentionLevel && contentionLevel > 0.6 
    ? config.encounterDensity * 1.3 
    : config.encounterDensity;

  // Generate encounters
  const encounters: Array<{
    type: 'combat' | 'social' | 'environmental';
    name: string;
    difficulty: number;
    rewards?: { loot: string[]; xp: number };
  }> = [];
  if (rng.nextFloat(0, 1) < encounterDensity && !isEntry) {
    const encounterType: 'combat' | 'social' | 'environmental' = rng.pick(
      ['combat', 'social', 'environmental'] as const
    );
    
    // M44-B2: Add faction-themed enemies for faction strongholds
    let enemyName = generateEncounterName(theme);
    if (factionId && contentionLevel && contentionLevel > 0.5) {
      const factionEnemies: Record<string, string> = {
        silver_flame: 'Silver Flame Knight',
        shadow_conclave: 'Shadow Conclave Assassin',
      };
      enemyName = factionEnemies[factionId] || enemyName;
    }

    encounters.push({
      type: encounterType,
      name: enemyName,
      difficulty: config.baseDifficulty + rng.nextInt(-1, 2) + (contentionLevel ? Math.floor(contentionLevel * 2) : 0),
      rewards: {
        loot: ['gold_' + rng.nextInt(10, 50), 'scroll_' + rng.nextInt(1, 5)],
        xp: 50 + index * 10
      }
    });
  }

  // Generate hazards
  // M44-B2: Scale hazard intensity with contention level
  const hazardDensity = contentionLevel && contentionLevel > 0.6 
    ? config.hazardDensity * 1.3 
    : config.hazardDensity;
    
  const hazards: Array<{
    type: 'trap' | 'environmental' | 'paradox';
    name: string;
    difficulty: number;
  }> = [];
  for (let i = 0; i < rng.nextInt(0, hazardDensity > 0.5 ? 2 : 1); i++) {
    if (rng.nextFloat(0, 1) < hazardDensity) {
      const hazardType: 'trap' | 'environmental' | 'paradox' =
        epochId === 'epoch_iii_twilight' ? 'paradox' : rng.pick(['trap', 'environmental'] as const);
      hazards.push({
        type: hazardType,
        name: generateHazardName(theme, epochId),
        difficulty: config.baseDifficulty + rng.nextInt(0, 2) + (contentionLevel ? Math.floor(contentionLevel * 1.5) : 0)
      });
    }
  }

  // Generate treasures
  // M44-B2: Higher loot in faction strongholds
  const lootMult = factionId && contentionLevel && contentionLevel > 0.5 
    ? config.lootMultiplier * 1.5 
    : config.lootMultiplier;
    
  const treasures = [];
  const treasureChance = isExit ? 0.8 : isMiddle ? 0.4 : 0.2;
  if (rng.nextFloat(0, 1) < treasureChance * lootMult) {
    treasures.push(`treasure_${roomId}_${rng.nextInt(1000, 9999)}`);
  }

  // Generate room name and description
  const [name, description] = generateRoomNameDesc(theme, isEntry, isExit, epochId, index);

  const room: DungeonRoom = {
    id: roomId,
    name,
    description,
    connections: [],  // Will be set by connection functions
    encounters: encounters.length > 0 ? encounters : undefined,
    treasures,
    hazards,
    atmosphere: generateAtmosphere(theme, epochId, index),
    corrupted: epochId === 'epoch_iii_twilight' && rng.nextFloat(0, 1) < 0.3
  };

  return room;
}

/**
 * Connect rooms in a linear sequence (Epoch I)
 */
function connectLinearRooms(rooms: Map<string, DungeonRoom>, roomIds: string[]): void {
  for (let i = 0; i < roomIds.length - 1; i++) {
    const currentRoom = rooms.get(roomIds[i])!;
    const nextRoom = rooms.get(roomIds[i + 1])!;

    currentRoom.connections.push(nextRoom.id);
    nextRoom.connections.push(currentRoom.id);  // Allow backtracking
  }
}

/**
 * Connect rooms with branching paths (Epoch II)
 */
function connectBranchingRooms(rooms: Map<string, DungeonRoom>, roomIds: string[], rng: SeededRng): void {
  // Create a branching structure with some loops
  for (let i = 0; i < roomIds.length - 1; i++) {
    const currentRoom = rooms.get(roomIds[i])!;

    // Always connect to next room in sequence
    currentRoom.connections.push(roomIds[i + 1]);

    // Randomly branch to other adjacent rooms
    if (rng.nextFloat(0, 1) < 0.3) {
      const branchTarget = roomIds[rng.nextInt(0, roomIds.length - 1)];
      if (!currentRoom.connections.includes(branchTarget)) {
        currentRoom.connections.push(branchTarget);
      }
    }
  }
}

/**
 * Connect rooms in a paradox loop (Epoch III)
 * Final room connects back to first, with difficulty escalation each loop
 */
function connectParadoxLoop(rooms: Map<string, DungeonRoom>, roomIds: string[], rng: SeededRng): void {
  // Connect linearly
  for (let i = 0; i < roomIds.length - 1; i++) {
    const currentRoom = rooms.get(roomIds[i])!;
    currentRoom.connections.push(roomIds[i + 1]);
  }

  // Close the loop: final room connects back to first
  const finalRoom = rooms.get(roomIds[roomIds.length - 1])!;
  finalRoom.connections.push(roomIds[0]);

  // Mark final room as special (paradox portal)
  finalRoom.name = `The Temporal Nexus (Loop: ${roomIds.length})`;
  finalRoom.description = 'Reality spirals. This chamber channels you back to the beginning, but all has changed.';

  // Add paradox encounter in final room
  if (!finalRoom.encounters) finalRoom.encounters = [];
  finalRoom.encounters.push({
    type: 'combat',
    name: 'Temporal Echo of Yourself',
    difficulty: 9,
    rewards: { loot: ['paradox_essence', 'chrono_crystal'], xp: 200 }
  });
}

/**
 * Generate atmospheric description for a room
 */
function generateAtmosphere(theme: string, epochId: string, index: number): string {
  const atmospheres: Record<string, string[]> = {
    'ancient_temple': [
      'Dust motes dance in shafts of faded light.',
      'Stone pillars rise into shadow.',
      'The air smells of age and forgotten prayers.'
    ],
    'corrupted_crypt': [
      'An eldritch hum fills this chamber.',
      'Unnatural growth spreads across the walls.',
      'Something watches from the darkness.'
    ],
    'fractured_space': [
      'Reality flickers here. Walls seem to shift.',
      'Time moves strangely in this place.',
      'Multiple doorways exist where only one should.'
    ],
    'ruined_sanctuary': [
      'Faded murals line the walls.',
      'The sense of reverence lingers.',
      'A cool breeze flows from nowhere.'
    ],
    'twisted_cavern': [
      'Stone forms impossible shapes.',
      'Bioluminescent fungi cast eerie light.',
      'The cavern breathes.'
    ]
  };

  const list = atmospheres[theme] ?? atmospheres['ancient_temple'];
  return list[index % list.length];
}

/**
 * Generate room name and description
 */
function generateRoomNameDesc(
  theme: string,
  isEntry: boolean,
  isExit: boolean,
  epochId: string,
  index: number
): [string, string] {
  if (isEntry) {
    return [
      'Entrance',
      'The threshold of mystery. Your journey begins here.'
    ];
  }

  if (isExit) {
    if (epochId === 'epoch_iii_twilight') {
      return [
        'The Paradox Heart',
        'Reality converges here. Exiting will reset your understanding.'
      ];
    }
    return [
      'The Sanctum',
      'The heart of this place. What you seek may be here.'
    ];
  }

  const names = [
    'Chamber of Echoes',
    'The Ossuary',
    'Vault of Secrets',
    'The Withering Floor',
    'Convergence Point',
    'The Fractured Gallery'
  ];

  return [
    names[index % names.length],
    `A passage of great importance lies here. The air crackles with history.`
  ];
}

/**
 * Generate encounter name based on theme
 */
function generateEncounterName(theme: string): string {
  const encounters: Record<string, string[]> = {
    'temple': ['Guardian Spirit', 'Temple Priest Gone Mad', 'Animated Statue'],
    'crypt': ['Undead Sentinel', 'Corrupted Cleric', 'Spectral Guardian'],
    'fracture': ['Temporal Anomaly', 'Echo of Yourself', 'Timeline Collision'],
    'default': ['Ancient Guardian', 'Forgotten Enemy', 'Mystery Encounter']
  };

  const list = encounters[theme.split('_')[0]] ?? encounters['default'];
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generate hazard name based on theme and epoch
 */
function generateHazardName(theme: string, epochId: string): string {
  if (epochId === 'epoch_iii_twilight') {
    return ['Temporal Crush', 'Paradox Field', 'Time Fracture', 'Causality Breach'][
      Math.floor(Math.random() * 4)
    ];
  }

  const hazards: Record<string, string[]> = {
    'temple': ['Floor Collapse', 'Poisoned Dart', 'Stone Fall'],
    'crypt': ['Toxic Miasma', 'Pressure Plate', 'Decay Aura'],
    'default': ['Trap', 'Environmental Hazard', 'Curse']
  };

  const list = hazards[theme.split('_')[0]] ?? hazards['default'];
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generate dungeon description
 */
function generateDungeonDescription(theme: string, epochId: string): string {
  const descriptions: Record<string, string> = {
    'ancient_temple':
      'An ancient place of worship, its purpose lost to time. Treasure and danger await.',
    'ruined_sanctuary': 'Once sacred, now decayed. Echoes of faith linger in the ruin.',
    'corrupted_crypt': 'A burial chamber twisted by eldritch forces. Death and corruption dwell here.',
    'faded_fortress': 'A stronghold beaten by time. Its secrets may still be worth finding.',
    'twisted_cavern': 'A cave system warped by unnatural influence. Navigation is perilous.',
    'fractured_space': 'Reality breaks here. Rooms exist in multiple times at once.',
    'time_loop': 'An infinite recursion. Exit and return to find yourself changed.',
    'paradox_chamber': 'Where timelines converge and causality collapses.'
  };

  return (
    descriptions[theme] ??
    'A mysterious place. Its nature is obscured by time and magic.'
  );
}

/**
 * Get difficulty rating for the entire dungeon
 */
export function getDungeonDifficultyRating(dungeon: DungeonLayout): string {
  if (dungeon.totalDifficulty < 15) return 'Easy';
  if (dungeon.totalDifficulty < 25) return 'Moderate';
  if (dungeon.totalDifficulty < 35) return 'Hard';
  if (dungeon.totalDifficulty < 50) return 'Deadly';
  return 'Impossible';
}

/**
 * Export dungeon as human-readable map
 */
export function generateDungeonMap(dungeon: DungeonLayout): string {
  const lines: string[] = [
    `=== ${dungeon.name} ===`,
    `Epoch: ${dungeon.epochId} | Structure: ${dungeon.structure}`,
    `Total Difficulty: ${dungeon.totalDifficulty} (${getDungeonDifficultyRating(dungeon)})`,
    ''
  ];

  for (const room of Array.from(dungeon.rooms.values())) {
    lines.push(`[${room.id}] ${room.name}`);
    lines.push(`  "${room.description}"`);

    if (room.encounters && room.encounters.length > 0) {
      lines.push(`  🗡️ Encounters: ${room.encounters.map((e: any) => `${e.name} (diff ${e.difficulty})`).join(', ')}`);
    }

    if (room.treasures.length > 0) {
      lines.push(`  💎 Treasures: ${room.treasures.length}`);
    }

    if (room.hazards.length > 0) {
      lines.push(`  ⚠️ Hazards: ${room.hazards.map((h: any) => h.name).join(', ')}`);
    }

    if (room.connections.length > 0) {
      lines.push(`  ➜ Connects to: ${room.connections.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * M46-B1: The Ruin-Architect - Generate dungeon from world fragments
 * 
 * Takes historical world fragments (ruins, shrines, tombs, etc.) and creates
 * dungeons that reflect what happened to the location.
 * 
 * Maps fragment types to dungeon themes:
 * - ruin → collapsed fortress with faction enemies
 * - shrine → holy site with ritualistic challenges
 * - tomb → burial chamber with guardians
 * - statue/monument → location with historical echoes
 */
export interface FragmentBasedDungeon extends DungeonLayout {
  fragmentType: string;
  historicalEventId?: string;
  narrativeContext: string; // Story of what happened
  themeticLoot: boolean; // True if loot reflects the event
}

export function generateDungeonFromWorldFragment(
  locationId: string,
  locationName: string,
  fragment: any, // WorldFragment from chronicleEngine
  epochId: string,
  seed: number,
  factionRegistry?: any // factionLootRegistry
): FragmentBasedDungeon {
  const rng = new SeededRng(seed);
  
  // Map fragment type to dungeon theme
  const fragmentThemes: Record<string, string> = {
    ruin: 'faded_fortress',
    shrine: 'corrupted_crypt',
    tomb: 'faded_fortress',
    statue: 'ancient_temple',
    monument: 'ancient_temple',
    altar: 'corrupted_crypt'
  };

  const baseTheme = fragmentThemes[fragment.type] || 'ancient_temple';

  // Enhance the description with historical context
  const narrativeContext = buildFragmentNarrative(
    fragment,
    baseTheme,
    locationName
  );

  // Generate base dungeon
  const baseDungeon = generateDungeonLayout(
    locationId,
    locationName,
    epochId,
    seed,
    fragment.historicalEvent?.factionIds?.[0],
    0.5 // Medium contention for historical sites
  );

  // M46-B1: Enhance with fragment-specific features
  const fragmentDungeon: FragmentBasedDungeon = {
    ...baseDungeon,
    fragmentType: fragment.type,
    historicalEventId: fragment.historicalEvent?.id,
    narrativeContext,
    themeticLoot: true // We populate this below
  };

  // Enhanced naming
  fragmentDungeon.name = `${locationName}: ${getFragmentTypeName(fragment.type)}`;
  fragmentDungeon.description = narrativeContext;

  // M46-B1: Populate rooms with thematic loot and encounters
  populateFragmentDungeonWithHistory(
    fragmentDungeon,
    fragment,
    rng,
    factionRegistry
  );

  return fragmentDungeon;
}

/**
 * Build narrative context from historical fragment
 */
function buildFragmentNarrative(
  fragment: any,
  theme: string,
  locationName: string
): string {
  const eventDescriptions: Record<string, string> = {
    ruin: `Once, this fortress stood proud, home to ${fragment.historicalEvent?.factionIds?.[0] || 'a great faction'}. Now it lies in ruins, testament to the conflicts that raged here. The air carries echoes of ancient warfare.`,
    shrine: `A sacred place, dedicated to powers not yet forgotten. The shrine has fallen into disrepair, yet traces of its holy significance remain etched upon the stone. Something still lingers here.`,
    tomb: `A burial chamber, holding the remains of someone significant. The tomb's architecture speaks of reverence and power. Those entombed here were important to ${fragment.historicalEvent?.factionIds?.[0] || 'their faction'}.`,
    statue: `A monument to a legendary figure, carved in stone. This statue commemorates ${fragment.historicalEvent?.narrative || 'a forgotten deed'}. Time has weathered it, but its message endures.`,
    monument: `A memorial to an event of great import. The inscription speaks of ${fragment.historicalEvent?.narrative || 'a pivotal moment in history'}. The monument stands as witness to what transpired.`,
    altar: `An ancient altar, used for rituals and ceremonies. ${fragment.historicalEvent?.narrative || 'Something sacred occurred here'}. The lingering energy suggests its power has not fully faded.`
  };

  return eventDescriptions[fragment.type] || `A historical site of unknown significance, bearing the marks of ${locationName}'s complex past.`;
}

/**
 * Get human-readable name for fragment type
 */
function getFragmentTypeName(fragmentType: string): string {
  const names: Record<string, string> = {
    ruin: 'Fallen Fortress',
    shrine: 'Desecrated Shrine',
    tomb: 'Royal Tomb',
    statue: 'Monument to the Fallen',
    monument: 'Historical Monument',
    altar: 'Ancient Altar'
  };
  return names[fragmentType] || 'Historic Site';
}

/**
 * M46-B1: Populate dungeon rooms with historically appropriate loot and encounters
 */
function populateFragmentDungeonWithHistory(
  dungeon: FragmentBasedDungeon,
  fragment: any,
  rng: SeededRng,
  factionRegistry?: any
): void {
  const event = fragment.historicalEvent;
  
  // Adjust room encounters based on fragment type
  let roomIndex = 0;
  for (const [roomId, room] of dungeon.rooms) {
    // Add fragment-appropriate encounters
    if (!room.encounters) room.encounters = [];

    switch (fragment.type) {
      case 'ruin':
        // Ruins have faction guards/remnants
        if (roomIndex > 0 && roomIndex < dungeon.rooms.size - 1) {
          room.encounters.push({
            type: 'combat',
            name: `Remnant of ${event?.factionIds?.[0] || 'a fallen faction'}`,
            difficulty: 4,
            rewards: {
              loot: ['faction_seal', 'ancient_armor_piece'],
              xp: 200
            }
          });
        }
        break;

      case 'shrine':
        // Shrines have ritualistic/spiritual challenges
        if (roomIndex % 2 === 1) {
          room.encounters.push({
            type: 'social',
            name: 'Spectral Guardian',
            difficulty: 3,
            rewards: {
              loot: ['blessed_relic', 'holy_water'],
              xp: 150
            }
          });
        }
        break;

      case 'tomb':
        // Tombs have undead guardians
        if (roomIndex > dungeon.rooms.size / 2) {
          room.encounters.push({
            type: 'combat',
            name: 'Tomb Guardian',
            difficulty: 5,
            rewards: {
              loot: ['burial_treasure', 'cursed_item'],
              xp: 250
            }
          });
        }
        break;

      case 'statue':
      case 'monument':
        // Monuments have less combat, more lore
        if (roomIndex === Math.floor(dungeon.rooms.size / 2)) {
          room.encounters.push({
            type: 'environmental',
            name: 'Historical Vision',
            difficulty: 2,
            rewards: {
              loot: ['historical_artifact', 'knowledge_scroll'],
              xp: 100
            }
          });
        }
        break;
    }

    // M46-B2: Add faction-themed loot if registry available
    if (factionRegistry && event?.factionIds?.[0]) {
      const factionId = event.factionIds[0];
      const factionItems = factionRegistry.getLootByFaction(factionId);
      
      if (factionItems && factionItems.length > 0 && rng.nextFloat(0, 1) < 0.3) {
        const randomFactionItem = factionItems[rng.nextInt(0, factionItems.length - 1)];
        if (!room.treasures) room.treasures = [];
        room.treasures.push(`${randomFactionItem.id}_unique`);
      }
    }

    roomIndex++;
  }
}

/**
 * M46-B1: Query for available world fragments in an area
 * Used to see which dungeon options are available based on history
 */
export function getAvailableFragmentDungeons(
  locationId: string,
  chronicleEngine: any, // from worldEngine
  epochId: string
): Array<{
  fragmentId: string;
  fragmentType: string;
  narrative: string;
  estimatedDifficulty: number;
}> {
  if (!chronicleEngine) return [];

  const fragments = chronicleEngine.getFragmentsAtLocation?.(locationId) || [];
  
  return fragments.map((fragment: any) => ({
    fragmentId: fragment.id,
    fragmentType: fragment.type,
    narrative: buildFragmentNarrative(fragment, 'ancient_temple', locationId),
    estimatedDifficulty: getDifficultyForFragmentType(fragment.type, fragment.historicalEvent?.severity || 50)
  }));
}

/**
 * Estimate difficulty based on fragment type and historical severity  
 */
function getDifficultyForFragmentType(fragmentType: string, severity: number): number {
  const baseDifficulties: Record<string, number> = {
    ruin: 25,
    shrine: 15,
    tomb: 35,
    statue: 10,
    monument: 12,
    altar: 18
  };

  const base = baseDifficulties[fragmentType] || 20;
  // Severity 0-100 scales difficulty from 0.8x to 1.5x
  const severityMultiplier = 0.8 + (severity / 100) * 0.7;
  
  return Math.floor(base * severityMultiplier);
}

