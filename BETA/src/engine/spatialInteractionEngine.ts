/**
 * spatialInteractionEngine.ts — Phase 45: Tactical World Interaction
 * 
 * Handles in-world verbs for player interaction with tiles:
 * - SEARCH: Use Perception to find hidden items/clue markers
 * - HARVEST: Extract materials from natural nodes (Smithing/Alchemy proficiency)
 * - INTERACT: Toggle stateful objects like Chests, Levers, Portals
 */

import type { WorldState, Location } from './worldEngine';
import { random } from './prng';
import { Event } from '../events/mutationLog';

/**
 * Workstation metadata for crafting stations
 */
export interface Workstation {
  id: string;
  type: 'smithing' | 'alchemy' | 'weaving' | 'artifice' | 'terminal';
  quality: 'rusted' | 'standard' | 'masterwork' | 'legendary';
  bonusToRoll?: number;
  discoveryChance?: number; // % chance to discover new recipes
  restrictions?: string[]; // Recipes that require this station
}

/**
 * Spatial interaction result with success determination and loot
 */
export interface SpatialInteractionResult {
  success: boolean;
  action: 'SEARCH' | 'HARVEST' | 'INTERACT';
  location: Location;
  tileX: number;
  tileY: number;
  difficultyClass: number;           // DC for the check
  playerRoll: number;                // Player's roll result
  xpAwarded: number;
  loof: Array<{ name: string; quantity: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic' }>;
  narrativeResult: string;           // Flavor text for result
  proficiencyUsed?: string;          // Which profession was used
  proficiencyXpGained?: number;
  workstationData?: {
    stationType: Workstation['type'];
    quality: Workstation['quality'];
    bonusToRoll?: number;
    discoveryChance?: number;
  };
}

/**
 * Session 4 Anti-Exploit Constants
 */
const HARVEST_COOLDOWN_TICKS = 600; // 10 minutes between harvests per tile
const GLOBAL_DAILY_XP_SOFTCAP = 8000; // Total XP cap per day (all proficiencies combined)

/**
 * Get base tile difficulty for interactions
 */
export function getTileDifficulty(biome: string | undefined): number {
  const biomeDifficulties: Record<string, number> = {
    'forest': 12,
    'cave': 14,
    'village': 10,
    'corrupted': 16,
    'shrine': 13,
    'maritime': 11,
    'mountain': 15,
    'plains': 8
  };
  return biomeDifficulties[biome || 'plains'] || 10;
}

/**
 * Resolve a SEARCH action using Perception attribute
 * Finds hidden items, clue markers, or secret passages
 */
export function resolveSearch(
  state: WorldState,
  location: Location,
  tileX: number,
  tileY: number
): SpatialInteractionResult {
  const difficultyClass = getTileDifficulty(location.biome) + 2; // SEARCH is harder
  const perceptionModifier = Math.floor((state.player.stats?.perception ?? 10 - 10) / 2);
  
  // Roll d20 + perception modifier
  const playerRoll = Math.ceil(random() * 20) + perceptionModifier;
  const success = playerRoll >= difficultyClass;

  const loot: SpatialInteractionResult['loof'] = [];
  let xpAwarded = 0;
  let narrativeResult = '';

  if (success) {
    xpAwarded = 50 + Math.floor(random() * 50);
    
    // Generate hidden items based on location
    const hiddenItemTables: Record<string, Array<{ name: string; chance: number; rarity: string }>> = {
      'forest': [
        { name: 'Ancient Coin', chance: 0.3, rarity: 'uncommon' },
        { name: 'Healing Herb Bundle', chance: 0.6, rarity: 'common' },
        { name: 'Carved Bone Charm', chance: 0.2, rarity: 'rare' }
      ],
      'cave': [
        { name: 'Crystal Shard', chance: 0.5, rarity: 'uncommon' },
        { name: 'Ore Sample', chance: 0.4, rarity: 'common' },
        { name: 'Glowing Geode', chance: 0.15, rarity: 'epic' }
      ],
      'village': [
        { name: 'Forgotten Letter', chance: 0.3, rarity: 'uncommon' },
        { name: 'Copper Coin', chance: 0.8, rarity: 'common' },
        { name: 'Silver Locket', chance: 0.1, rarity: 'rare' }
      ],
      'shrine': [
        { name: 'Sacred Token', chance: 0.7, rarity: 'rare' },
        { name: 'Blessed Candle Wax', chance: 0.5, rarity: 'uncommon' },
        { name: 'Relic Fragment', chance: 0.2, rarity: 'epic' }
      ]
    };

    const itemTable = hiddenItemTables[location.biome || 'plains'] || hiddenItemTables['village'];
    itemTable.forEach(item => {
      if (random() < item.chance) {
        loot.push({
          name: item.name,
          quantity: Math.ceil(random() * 3),
          rarity: item.rarity as 'common' | 'uncommon' | 'rare' | 'epic'
        });
      }
    });

    narrativeResult = `You discover hidden items buried beneath the soil. Your keen eyes spot what others would miss.`;
  } else {
    narrativeResult = `Despite careful searching, you find nothing of value here. The location reveals no secrets.`;
  }

  return {
    success,
    action: 'SEARCH',
    location,
    tileX,
    tileY,
    difficultyClass,
    playerRoll,
    xpAwarded,
    loof: loot,
    narrativeResult,
    proficiencyUsed: 'investigation',
    proficiencyXpGained: success ? 25 : 10
  };
}

/**
 * Resolve a HARVEST action using Smithing or Alchemy proficiency
 * Extracts materials from natural nodes (ore veins, mana crystals, etc.)
 * CRITICAL: Session 4 - Enforces tile depletion cooldown to prevent gathering exploit
 */
export function resolveHarvest(
  state: WorldState,
  location: Location,
  tileX: number,
  tileY: number
): SpatialInteractionResult {
  // Session 4 Fix #1: Check tile depletion cooldown
  const currentTick = state.tick ?? 0;
  
  if (!location.tileHarvestHistory) {
    location.tileHarvestHistory = [];
  }
  
  const tileRecord = location.tileHarvestHistory.find(t => t.tileX === tileX && t.tileY === tileY);
  const lastHarvestTick = tileRecord?.lastHarvestTick ?? -Infinity;
  const ticksSinceLastHarvest = currentTick - lastHarvestTick;
  
  // If harvested recently, reject with narrative failure
  if (ticksSinceLastHarvest < HARVEST_COOLDOWN_TICKS) {
    const ticksRemaining = HARVEST_COOLDOWN_TICKS - ticksSinceLastHarvest;
    return {
      success: false,
      action: 'HARVEST',
      location,
      tileX,
      tileY,
      difficultyClass: 0,
      playerRoll: 0,
      xpAwarded: 0, // CRITICAL: No XP on depleted tile
      loof: [],
      narrativeResult: `This natural deposit has been thoroughly harvested recently. The materials need time to regenerate (${ticksRemaining} ticks remaining).`,
      proficiencyUsed: 'smithing',
      proficiencyXpGained: 0 // Zero XP on cooldown
    };
  }

  const basedc = getTileDifficulty(location.biome);
  const hasMiningTools = state.player.inventory?.some(i => i.itemId?.includes('pickaxe')) ?? false;
  const hasAlchemyTools = state.player.inventory?.some(i => i.itemId?.includes('alembic')) ?? false;
  
  // Determine which proficiency to use
  const smithingProf = state.player.proficiencies?.['Smithing']?.level ?? 0;
  const alchemyProf = state.player.proficiencies?.['Alchemy']?.level ?? 0;
  const bestProf = Math.max(smithingProf, alchemyProf);
  const profModifier = Math.floor((bestProf - 10) * 0.5); // Scale proficiency to modifier

  const difficultyClass = basedc + (hasMiningTools && hasAlchemyTools ? 0 : 3);
  const playerRoll = Math.ceil(random() * 20) + profModifier;
  const success = playerRoll >= difficultyClass;

  const loot: SpatialInteractionResult['loof'] = [];
  let xpAwarded = 0;
  let narrativeResult = '';
  let proficiencyUsed = 'smithing';
  let proficiencyXpGained = 0; // Default: no XP on failure

  if (success) {
    // Update tile harvest history ONLY on success
    if (tileRecord) {
      tileRecord.lastHarvestTick = currentTick;
      tileRecord.harvestCount = (tileRecord.harvestCount || 0) + 1;
    } else {
      location.tileHarvestHistory.push({
        tileX,
        tileY,
        lastHarvestTick: currentTick,
        harvestCount: 1
      });
    }

    xpAwarded = 75 + Math.floor(random() * 75);
    proficiencyXpGained = 40; // Only successful harvests grant XP

    // Generate harvestable materials by biome
    const harvestTables: Record<string, Array<{ name: string; quantity: number; rarity: string }>> = {
      'cave': [
        { name: 'Iron Ore', quantity: 2, rarity: 'common' },
        { name: 'Copper Ore', quantity: 3, rarity: 'common' },
        { name: 'Silver Ore', quantity: 1, rarity: 'uncommon' }
      ],
      'plains': [
        { name: 'Stone Block', quantity: 3, rarity: 'common' },
        { name: 'Flint', quantity: 2, rarity: 'common' }
      ],
      'forest': [
        { name: 'Root Fiber', quantity: 4, rarity: 'common' },
        { name: 'Mana Crystal Dust', quantity: 2, rarity: 'uncommon' }
      ],
      'mountain': [
        { name: 'Gold Ore', quantity: 1, rarity: 'rare' },
        { name: 'Diamond Dust', quantity: 1, rarity: 'epic' }
      ],
      'shrine': [
        { name: 'Blessed Water', quantity: 2, rarity: 'uncommon' },
        { name: 'Sacred Ash', quantity: 3, rarity: 'rare' }
      ]
    };

    const harvestTable = harvestTables[location.biome || 'plains'] || [];
    harvestTable.forEach(mat => {
      const harvestQuantity = Math.max(1, Math.floor(mat.quantity * (1 + profModifier * 0.1)));
      loot.push({
        name: mat.name,
        quantity: harvestQuantity,
        rarity: mat.rarity as 'common' | 'uncommon' | 'rare' | 'epic'
      });
    });

    proficiencyUsed = alchemyProf > smithingProf ? 'alchemy' : 'smithing';
    narrativeResult = `You carefully extract valuable materials from this natural deposit. Your ${proficiencyUsed} expertise yields a bountiful harvest.`;
  } else {
    // Session 4 Fix #2: Failed harvests grant NO XP (eliminates 50% spam farming)
    xpAwarded = 0;
    proficiencyXpGained = 0; // Zero XP on failed harvest
    narrativeResult = `Your harvesting attempt fails. The materials shatter or crumble in your grasp, yielding nothing useful.`;
  }

  return {
    success,
    action: 'HARVEST',
    location,
    tileX,
    tileY,
    difficultyClass,
    playerRoll,
    xpAwarded,
    loof: loot,
    narrativeResult,
    proficiencyUsed,
    proficiencyXpGained // Only successful harvests grant XP
  };
}

/**
 * Resolve an INTERACT action with stateful tile objects
 * Handles Chests, Levers, Portals, Shrines, Workstations, etc.
 */
export function resolveInteract(
  state: WorldState,
  location: Location,
  tileX: number,
  tileY: number
): SpatialInteractionResult {
  // Check for workstation tiles first (Phase 46)
  const workstations: Record<string, Workstation[]> = {
    'village': [
      { id: 'ws-village-smithy', type: 'smithing', quality: 'standard', bonusToRoll: 1, discoveryChance: 0.1 },
      { id: 'ws-village-alchemy', type: 'alchemy', quality: 'standard', bonusToRoll: 0, discoveryChance: 0.15 }
    ],
    'cave': [
      { id: 'ws-cave-forge', type: 'smithing', quality: 'masterwork', bonusToRoll: 2, discoveryChance: 0.2 }
    ],
    'shrine': [
      { id: 'ws-shrine-altar', type: 'artifice', quality: 'legendary', bonusToRoll: 3, discoveryChance: 0.25 }
    ]
  };

  const stationList = workstations[location.biome || 'village'];
  if (stationList && stationList.length > 0 && random() > 0.5) {
    // 50% chance to interact with a workstation at this tile
    const selectedStation = stationList[Math.floor(random() * stationList.length)];
    return {
      success: true,
      action: 'INTERACT',
      location,
      tileX,
      tileY,
      difficultyClass: 8,
      playerRoll: 20,
      xpAwarded: 10,
      loof: [],
      narrativeResult: `You find a ${selectedStation.quality} ${selectedStation.type} workstation!`,
      proficiencyUsed: 'investigation',
      proficiencyXpGained: 0,
      workstationData: {
        stationType: selectedStation.type,
        quality: selectedStation.quality,
        bonusToRoll: selectedStation.bonusToRoll,
        discoveryChance: selectedStation.discoveryChance
      }
    };
  }

  // Determine what type of object to interact with based on location
  const objectTypes: Record<string, Array<{ name: string; dc: number; rewards: string[] }>> = {
    'village': [
      { name: 'Locked Chest', dc: 12, rewards: ['Gold Coin', 'Weathered Key', 'Old Records'] },
      { name: 'Wooden Lever', dc: 8, rewards: ['Creaking Sound'] },
      { name: 'Village Well', dc: 10, rewards: ['Fresh Water', 'Copper Coin'] }
    ],
    'cave': [
      { name: 'Ancient Altar', dc: 14, rewards: ['Glowing Crystal', 'Ritual Knowledge'] },
      { name: 'Sealed Chest', dc: 16, rewards: ['Relic', 'Ancient Tome'] },
      { name: 'Stone Mechanism', dc: 13, rewards: ['Hidden Passage Revealed'] }
    ],
    'shrine': [
      { name: 'Prayer Altar', dc: 10, rewards: ['Blessed Blessing', 'Sacred Knowledge'] },
      { name: 'Offering Bowl', dc: 8, rewards: ['Spiritual Insight'] }
    ],
    'forest': [
      { name: 'Wooden Chest', dc: 11, rewards: ['Forest Treasures', 'Hermit\'s Supplies'] },
      { name: 'Ancient Tree Hollow', dc: 12, rewards: ['Nature\' Gift', 'Old Scroll'] }
    ]
  };

  const objectList = objectTypes[location.biome || 'village'] || objectTypes['village'];
  const selectedObject = objectList[Math.floor(random() * objectList.length)];

  const perceptionMod = Math.floor((state.player.stats?.perception ?? 10 - 10) / 2);
  const playerRoll = Math.ceil(random() * 20) + perceptionMod;
  const success = playerRoll >= selectedObject.dc;

  const loot: SpatialInteractionResult['loof'] = [];

  if (success) {
    selectedObject.rewards.forEach(reward => {
      loot.push({ name: reward, quantity: 1, rarity: 'uncommon' });
    });
  }

  return {
    success,
    action: 'INTERACT',
    location,
    tileX,
    tileY,
    difficultyClass: selectedObject.dc,
    playerRoll,
    xpAwarded: success ? 60 : 20,
    loof: loot,
    narrativeResult: success
      ? `You successfully interact with the ${selectedObject.name}. It yields its secrets.`
      : `Your interaction fails. The mechanism resists your efforts.`,
    proficiencyUsed: 'investigation',
    proficiencyXpGained: 20
  };
}

/**
 * Main dispatcher for spatial interactions
 */
export function resolveSpatialInteraction(
  state: WorldState,
  actionType: 'SEARCH' | 'HARVEST' | 'INTERACT',
  location: Location,
  tileX: number,
  tileY: number
): SpatialInteractionResult {
  switch (actionType) {
    case 'SEARCH':
      return resolveSearch(state, location, tileX, tileY);
    case 'HARVEST':
      return resolveHarvest(state, location, tileX, tileY);
    case 'INTERACT':
      return resolveInteract(state, location, tileX, tileY);
    default:
      throw new Error(`Unknown spatial interaction type: ${actionType}`);
  }
}

/**
 * Phase 46: Detect and resolve workstation interactions
 * Returns structured data for WorkstationOverlay component
 */
export function resolveWorkstationInteraction(
  state: WorldState,
  stationType: 'smithing' | 'alchemy' | 'weaving' | 'artifice' | 'terminal',
  quality: 'rusted' | 'standard' | 'masterwork' | 'legendary'
): {
  allowed: boolean;
  message: string;
  workstationData?: {
    stationType: string;
    quality: string;
    bonusToRoll: number;
    discoveryChance: number;
  };
} {
  // Determine proficiency requirement based on station type
  const proficiencyMap: Record<string, string> = {
    'smithing': 'Smithing',
    'alchemy': 'Alchemy',
    'weaving': 'Weaving',
    'artifice': 'Artifice',
    'terminal': 'Engineering'
  };

  const requiredProf = proficiencyMap[stationType];
  const playerProf = state.player?.proficiencies?.[requiredProf];
  const playerProfLevel = playerProf?.level ?? 0;

  // Quality thresholds for minimum proficiency requirement
  const qualityMinLevel: Record<string, number> = {
    'rusted': 0,
    'standard': 3,
    'masterwork': 7,
    'legendary': 13
  };

  const minLevel = qualityMinLevel[quality] || 0;

  if (playerProfLevel < minLevel) {
    return {
      allowed: false,
      message: `Your ${requiredProf} skill (${playerProfLevel}) is too low to use this ${quality} ${stationType} workstation. You need at least level ${minLevel}.`
    };
  }

  // Calculate bonuses based on quality
  const qualityBonus: Record<string, number> = {
    'rusted': 0,
    'standard': 2,
    'masterwork': 5,
    'legendary': 10
  };

  // Calculate discovery chance based on both quality and proficiency
  const baseDiscoveryChance = 0.15 + (quality === 'legendary' ? 0.15 : quality === 'masterwork' ? 0.1 : 0);
  const proficiencyBonus = Math.min(0.2, playerProfLevel * 0.01); // +0.01 per level, capped at 0.2
  const discoveryChance = Math.min(0.8, baseDiscoveryChance + proficiencyBonus);

  return {
    allowed: true,
    message: `${requiredProf} workstation unlocked. Ready for blind fusing.`,
    workstationData: {
      stationType,
      quality,
      bonusToRoll: qualityBonus[quality],
      discoveryChance
    }
  };
}

/**
 * Generate events from spatial interaction result
 */
export function createSpatialInteractionEvents(
  state: WorldState,
  result: SpatialInteractionResult
): Event[] {
  const events: Event[] = [];
  const timestamp = Date.now();

  // Main interaction event
  events.push({
    id: `spatial-${result.action.toLowerCase()}-${state.tick || 0}-${Math.random().toString(16).slice(2)}`,
    worldInstanceId: state.id,
    actorId: state.player.id,
    type: `SPATIAL_${result.action}`,
    payload: {
      locationId: result.location.id,
      tileX: result.tileX,
      tileY: result.tileY,
      success: result.success,
      difficultyClass: result.difficultyClass,
      playerRoll: result.playerRoll,
      items: result.loof,
      proficiency: result.proficiencyUsed,
      proficiencyXpGained: result.proficiencyXpGained
    },
    timestamp: state.tick ? (state.tick * 1000) : Date.now()
  });

  // Loot events if items found
  result.loof.forEach((item, idx) => {
    events.push({
      id: `loot-${result.action.toLowerCase()}-${state.tick || 0}-${idx}-${Math.random().toString(16).slice(2)}`,
      worldInstanceId: state.id,
      actorId: state.player.id,
      type: 'ITEM_FOUND',
      payload: {
        itemName: item.name,
        quantity: item.quantity,
        rarity: item.rarity,
        from: result.action,
        location: result.location.id
      },
      timestamp: state.tick ? (state.tick * 1000) : Date.now()
    });
  });

  return events;
}
