/**
 * M56-C1: Millennium Simulation - 1,000 Year Cycle Test
 * 
 * Purpose: Verify long-term inheritance integrity & faction equilibrium
 * - 10 sequential epoch transitions (1,000 years)
 * - Heirloom item persistence tracking
 * - Faction power score stability monitoring
 * - Legacy impact accumulation
 * 
 * Run: npm run millennium (after adding script to package.json)
 */

import type { WorldState, NPC, PlayerState, UniqueItem } from '../src/engine/worldEngine';
import type { LegacyImpact } from '../src/engine/legacyEngine';
import { SeededRng } from '../src/engine/prng';
import { initiateChronicleTransition, EPOCH_DEFINITIONS } from '../src/engine/chronicleEngine';
import { canonizeCharacter } from '../src/engine/legacyEngine';

interface MillenniumTestResult {
  totalEpochs: number;
  totalTicks: number;
  heirloomFoundInFinal: boolean;
  heirloomMetadata: {
    name: string;
    originEpoch: string;
    finalLocation: string;
    preserved: boolean;
  } | null;
  factionTracking: Array<{
    epoch: number;
    faction: string;
    powerScore: number;
    stability: 'stable' | 'declining' | 'rising' | 'critical';
  }>;
  stabilityFailures: string[];
  legendaryAncestors: Array<{
    epoch: number;
    name: string;
    mythStatus: number;
    deeds: string[];
  }>;
  memoryProfile: {
    peakMB: number;
    averageMB: number;
    readings: number[];
  };
  chronicleLength: number;
  completed: boolean;
}

/**
 * Generate initial 200 deterministic NPCs
 */
function generateTestNPCs(worldSeed: number, count: number = 200): any[] {
  const rng = new SeededRng(worldSeed);
  const npcs: any[] = [];
  const locations = ['town-square', 'temple', 'tavern', 'market', 'forest', 'ruins', 'castle', 'docks', 'inn', 'academy'];
  const factions = ['faction-light', 'faction-shadow', 'faction-neutral', 'faction-wild', 'faction-ancient'];

  for (let i = 0; i < count; i++) {
    const npcId = `npc-${i}`;
    const hp = 50 + rng.nextInt(30, 50);
    npcs.push({
      id: npcId,
      name: `Character_${i}`,
      locationId: locations[i % locations.length],
      factionId: factions[i % factions.length],
      hp: Math.min(hp, 100),
      maxHp: 100,
      beliefs: { trust: rng.nextInt(0, 100), fear: rng.nextInt(0, 100) },
      relationships: {},
      inventory: [],
      equippedItems: [],
      schedule: [],
      currentAction: 'idle',
      actionStartTick: 0
    });
  }

  return npcs;
}

/**
 * Create world state with The Founder's Blade heirloom
 */
function createMillenniumWorld(epochId: string, seed: number): WorldState {
  const rng = new SeededRng(seed);
  
  const foundersBladeInstance: UniqueItem = {
    kind: 'unique',
    itemId: 'founders-blade',
    instanceId: 'founders-blade-001',
    equipped: false,
    metadata: {
      experience: 10000,  // Accumulated experience marking its age
      sentience: 95       // Near-sentient artifact
    }
  };

  const state: any = {
    id: `millennium-world-${seed}`,
    tick: 0,
    seed,
    hour: 12,
    day: 1,
    dayPhase: 'afternoon',
    season: 'spring',
    weather: 'clear',
    locations: [
      { id: 'town-square', name: 'Town Square', discovered: true, biome: 'village' },
      { id: 'temple', name: 'Temple', discovered: true, biome: 'shrine' },
      { id: 'tavern', name: 'Tavern', discovered: true, biome: 'village' },
      { id: 'market', name: 'Market', discovered: true, biome: 'village' },
      { id: 'forest', name: 'Forest', discovered: false, biome: 'forest' },
      { id: 'ruins', name: 'Ancient Ruins', discovered: false, biome: 'mountain' },
      { id: 'castle', name: 'Castle', discovered: true, biome: 'fortress' },
      { id: 'docks', name: 'Harbor Docks', discovered: true, biome: 'coast' },
      { id: 'inn', name: 'Traveler\'s Inn', discovered: true, biome: 'village' },
      { id: 'academy', name: 'Arcane Academy', discovered: true, biome: 'tower' }
    ],
    npcs: generateTestNPCs(seed, 200),
    player: {
      id: 'millennium-hero',
      name: 'TheFounder',
      race: 'human',
      location: 'town-square',
      level: 40,
      gold: 10000,
      hp: 200,
      maxHp: 200,
      mp: 150,
      maxMp: 150,
      stats: { str: 20, agi: 18, int: 16, cha: 17, end: 19, luk: 15 },
      factionReputation: { 
        'faction-light': 100, 
        'faction-shadow': -30, 
        'faction-neutral': 70,
        'faction-wild': 40,
        'faction-ancient': 80
      },
      inventory: [foundersBladeInstance],
      quests: {}
    },
    factions: [
      { id: 'faction-light', name: 'Light Council', category: 'political', powerScore: 75, alignment: 'good', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-shadow', name: 'Shadow Cult', category: 'religious', powerScore: 50, alignment: 'evil', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-neutral', name: 'Merchants Guild', category: 'mercenary', powerScore: 65, alignment: 'neutral', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-wild', name: 'Wild Druids', category: 'nature', powerScore: 45, alignment: 'neutral', coreBeliefs: [], controlledLocationIds: [] },
      { id: 'faction-ancient', name: 'Ancient Order', category: 'secretsociety', powerScore: 60, alignment: 'neutral', coreBeliefs: [], controlledLocationIds: [] }
    ],
    quests: [],
    chronicleId: 'millennium-chronicle',
    epochId,
    epochMetadata: {
      chronologyYear: EPOCH_DEFINITIONS[epochId]?.chronologyYear || 1000,
      theme: EPOCH_DEFINITIONS[epochId]?.theme || 'Unknown',
      description: EPOCH_DEFINITIONS[epochId]?.description || 'Test epoch',
      sequenceNumber: EPOCH_DEFINITIONS[epochId]?.sequenceNumber || 1
    },
    heirloomCaches: [
      {
        itemId: 'founders-blade',
        discoveredAt: { x: 50, y: 50, locationId: 'town-square' },
        metadata: {
          experience: 10000,
          sentience: 95
        }
      }
    ]
  };

  return state as WorldState;
}

/**
 * Find heirloom in world state
 */
function findHeirloomInWorld(state: WorldState): { found: boolean; location: string } {
  // Check player inventory first
  if (state.player && (state.player as any).inventory) {
    const playerHeirloom = (state.player as any).inventory.find((item: any) => 
      item.itemId === 'founders-blade'
    );
    if (playerHeirloom) {
      const location = ((state.player as any).location || 'player-inventory');
      return { found: true, location };
    }
  }

  // Check heirloom caches
  if ((state as any).heirloomCaches) {
    const cache = (state as any).heirloomCaches.find((h: any) => h.itemId === 'founders-blade');
    if (cache) {
      return { found: true, location: cache.discoveredAt?.locationId || 'cache' };
    }
  }

  // Check NPC inventories
  if (state.npcs) {
    for (const npc of state.npcs) {
      if ((npc as any).inventory?.some((item: any) => item.itemId === 'founders-blade')) {
        return { found: true, location: `${npc.name}'s inventory` };
      }
    }
  }

  return { found: false, location: 'unknown' };
}

/**
 * Check faction power equilibrium
 */
function checkFactionStability(factions: any[]): { stable: boolean; violations: string[] } {
  const violations: string[] = [];
  const MIN_POWER = 10;
  const MAX_POWER = 300;

  factions.forEach(faction => {
    if (faction.powerScore < MIN_POWER) {
      violations.push(`${faction.name} power too low: ${faction.powerScore} < ${MIN_POWER}`);
    }
    if (faction.powerScore > MAX_POWER) {
      violations.push(`${faction.name} power too high: ${faction.powerScore} > ${MAX_POWER}`);
    }
  });

  return { stable: violations.length === 0, violations };
}

/**
 * Get next epoch ID in sequence
 */
function getNextEpoch(currentEpochId: string): string | null {
  const epochIds = [
    'epoch_i_fracture',
    'epoch_ii_waning',
    'epoch_iii_twilight',
    'epoch_iv_renewal',
    'epoch_v_ascension',
    'epoch_vi_zenith',
    'epoch_vii_eclipse',
    'epoch_viii_void',
    'epoch_ix_rebirth',
    'epoch_x_eternity'
  ];

  const currentIndex = epochIds.indexOf(currentEpochId);
  return currentIndex >= 0 && currentIndex < epochIds.length - 1 ? epochIds[currentIndex + 1] : null;
}

/**
 * Main millennium simulation
 */
async function runMillenniumSimulation(): Promise<MillenniumTestResult> {
  console.log('\n🌍 M56-C1: MILLENNIUM SIMULATION — 1,000 Year Cycle\n');
  console.log('═'.repeat(70));

  const result: MillenniumTestResult = {
    totalEpochs: 0,
    totalTicks: 0,
    heirloomFoundInFinal: false,
    heirloomMetadata: null,
    factionTracking: [],
    stabilityFailures: [],
    legendaryAncestors: [],
    memoryProfile: { peakMB: 0, averageMB: 0, readings: [] },
    chronicleLength: 0,
    completed: false
  };

  const epochSequence = [
    'epoch_i_fracture',
    'epoch_ii_waning',
    'epoch_iii_twilight',
    'epoch_iv_renewal',
    'epoch_v_ascension',
    'epoch_vi_zenith',
    'epoch_vii_eclipse',
    'epoch_viii_void',
    'epoch_ix_rebirth',
    'epoch_x_eternity'
  ];

  let currentWorldState = createMillenniumWorld(epochSequence[0], 99999);
  let currentEpochIndex = 0;

  // Run through all 10 epochs
  for (let epochNum = 1; epochNum <= 10; epochNum++) {
    const epochId = epochSequence[epochNum - 1];
    const epochDef = EPOCH_DEFINITIONS[epochId] || {
      id: epochId,
      sequenceNumber: epochNum,
      name: `Epoch ${epochNum}`,
      theme: `Era of the cycle`,
      chronologyYear: 1000 + (epochNum - 1) * 100,
      description: `Year ${1000 + (epochNum - 1) * 100}`
    };

    console.log(`\n📍 EPOCH ${epochNum}: ${epochDef.name} (Year ${epochDef.chronologyYear})`);

    // Record faction power at start of epoch
    if (currentWorldState.factions) {
      currentWorldState.factions.forEach(faction => {
        result.factionTracking.push({
          epoch: epochNum,
          faction: faction.name,
          powerScore: faction.powerScore,
          stability: faction.powerScore >= 30 && faction.powerScore <= 250 ? 'stable' : 
                     faction.powerScore < 30 ? 'critical' : 'rising'
        });
      });
    }

    // Simulate ticks within epoch
    const ticksInEpoch = 1000;
    for (let tick = 0; tick < ticksInEpoch; tick++) {
      const memBefore = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
      result.memoryProfile.readings.push(memBefore);
      result.memoryProfile.peakMB = Math.max(result.memoryProfile.peakMB, memBefore);

      // Simulate basic state changes
      if (currentWorldState.npcs && Math.random() > 0.95) {
        const randomNpc = currentWorldState.npcs[Math.floor(Math.random() * currentWorldState.npcs.length)];
        const locations = currentWorldState.locations!.map(l => l.id);
        randomNpc.locationId = locations[Math.floor(Math.random() * locations.length)];
      }

      currentWorldState.tick = tick;
      result.totalTicks++;
    }

    // Create legacy impact for canonization
    const deedsList = [
      `Great deed in ${epochDef.name}`,
      `Victory for faction-light`,
      `Discovery in ancient lands`,
      `Peace established`
    ];

    const legacyImpact = canonizeCharacter(currentWorldState.player, currentWorldState, undefined, deedsList.slice(0, 2 + (epochNum % 2)));
    
    // Track legendary ancestors
    if ((legacyImpact as any).mythStatus >= 70) {
      result.legendaryAncestors.push({
        epoch: epochNum,
        name: currentWorldState.player.name,
        mythStatus: (legacyImpact as any).mythStatus,
        deeds: deedsList.slice(0, 2 + (epochNum % 2))
      });
    }

    // Transition to next epoch
    if (epochNum < 10) {
      const nextEpochId = epochSequence[epochNum];
      console.log(`  → Transitioning to ${EPOCH_DEFINITIONS[nextEpochId]?.name || nextEpochId}...`);
      
      try {
        currentWorldState = initiateChronicleTransition(currentWorldState, legacyImpact) as WorldState;
        currentWorldState.epochId = nextEpochId;

        // Check stability after transition
        const stabilityCheck = checkFactionStability(currentWorldState.factions || []);
        if (!stabilityCheck.stable) {
          result.stabilityFailures.push(...stabilityCheck.violations);
        }
      } catch (error) {
        console.error(`  ❌ Transition failed: ${error}`);
        result.stabilityFailures.push(`Epoch ${epochNum} transition error: ${error}`);
        break;
      }
    }

    result.totalEpochs++;
    const memUsed = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
    console.log(`✓ Epoch ${epochNum} complete | Memory: ${memUsed}MB | NPCs: ${currentWorldState.npcs.length}`);
  }

  // Final heirloom verification
  const heirloomSearch = findHeirloomInWorld(currentWorldState);
  result.heirloomFoundInFinal = heirloomSearch.found;
  
  if (result.heirloomFoundInFinal) {
    result.heirloomMetadata = {
      name: 'The Founder\'s Blade',
      originEpoch: epochSequence[0],
      finalLocation: heirloomSearch.location,
      preserved: true
    };
  }

  // Calculate averages
  if (result.memoryProfile.readings.length > 0) {
    const avgMem = result.memoryProfile.readings.reduce((a, b) => a + b, 0) / result.memoryProfile.readings.length;
    result.memoryProfile.averageMB = Math.round(avgMem * 100) / 100;
  }

  result.completed = result.totalEpochs === 10 && result.heirloomFoundInFinal;

  // Print results
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 MILLENNIUM SIMULATION RESULTS\n');

  console.log(`Total Epochs Processed:    ${result.totalEpochs}/10`);
  console.log(`Total Ticks Simulated:     ${result.totalTicks.toLocaleString()}`);
  console.log(`Legendary Ancestors Found: ${result.legendaryAncestors.length}`);
  
  console.log(`\n🗡️  HEIRLOOM VERIFICATION`);
  if (result.heirloomFoundInFinal) {
    console.log(`  ✅ The Founder's Blade FOUND`);
    console.log(`  📍 Location: ${result.heirloomMetadata?.finalLocation}`);
    console.log(`  🏛️  Origin: ${result.heirloomMetadata?.originEpoch}`);
  } else {
    console.log(`  ❌ The Founder's Blade LOST`);
  }

  console.log(`\n📈 FACTION STABILITY`);
  if (result.stabilityFailures.length === 0) {
    console.log(`  ✅ All factions maintained equilibrium`);
  } else {
    console.log(`  ⚠️  Stability violations detected:`);
    result.stabilityFailures.slice(0, 5).forEach(failure => {
      console.log(`    - ${failure}`);
    });
    if (result.stabilityFailures.length > 5) {
      console.log(`    ... and ${result.stabilityFailures.length - 5} more`);
    }
  }

  console.log(`\n💾 MEMORY PROFILE`);
  console.log(`  Peak: ${result.memoryProfile.peakMB}MB`);
  console.log(`  Average: ${result.memoryProfile.averageMB}MB`);
  console.log(`  Readings: ${result.memoryProfile.readings.length}`);

  console.log(`\n🏆 LEGENDARY ANCESTORS`);
  if (result.legendaryAncestors.length > 0) {
    result.legendaryAncestors.forEach(ancestor => {
      console.log(`  • Epoch ${ancestor.epoch}: ${ancestor.name} (Myth ${ancestor.mythStatus})`);
    });
  } else {
    console.log(`  (None achieved legendary status)`);
  }

  console.log('\n' + '═'.repeat(70));
  if (result.completed) {
    console.log(`\n✅ MILLENNIUM SIMULATION PASSED`);
    console.log(`   1,000 years simulated successfully`);
    console.log(`   Heirloom preserved across all epochs`);
  } else {
    console.log(`\n❌ MILLENNIUM SIMULATION INCOMPLETE`);
  }

  return result;
}

// Execute
runMillenniumSimulation().catch(console.error);
