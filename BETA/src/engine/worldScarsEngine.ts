/**
 * worldScarsEngine.ts - M51-D1: World Scarring & Environmental Persistence
 * 
 * Implements persistent environmental markers left by macro events.
 * Scars accumulate across epochs and influence world atmosphere, NPC morale, and location properties.
 */

import type { WorldState } from './worldEngine';
import { Event } from '../events/mutationLog';

export type ScarType = 
  | 'battlefield'
  | 'plague_site'
  | 'invasion_damage'
  | 'celestial_mark'
  | 'cultural_scar'
  | 'natural_disaster'
  | 'temporal_rift';

export interface WorldScar {
  id: string;
  type: ScarType;
  locationId: string;
  description: string;
  severity: number;
  createdAt: number;
  epochCreated: number;
  npcsAffected: string[];
  healingProgress: number;
  visualMarker?: string;
}

export interface ScarImpact {
  moraleMod: number;
  habitabilityMod: number;
  conflictLikelihood: number;
  discoveryChance: number;
}

/**
 * M51-D1: Generate a world scar from a macro event
 */
export function createWorldScar(
  state: WorldState,
  macroEventType: string,
  locationId: string,
  currentEpoch: number
): { scar: WorldScar; events: Event[] } {
  const timestamp = Date.now();
  const events: Event[] = [];

  const scarTypeMap: Record<string, ScarType> = {
    'FACTION_SKIRMISH': 'battlefield',
    'WAR': 'battlefield',
    'PLAGUE': 'plague_site',
    'INVASION': 'invasion_damage',
    'ECLIPSE': 'celestial_mark',
    'COMET': 'celestial_mark',
    'FESTIVAL_SUPPRESSION': 'cultural_scar',
    'RELIGIOUS_UPHEAVAL': 'cultural_scar',
    'FLOODING': 'natural_disaster',
    'WILDFIRE': 'natural_disaster',
    'TEMPORAL_ANOMALY': 'temporal_rift'
  };

  const scarType = scarTypeMap[macroEventType] || 'battlefield';

  const scarDescriptions: Record<ScarType, string> = {
    'battlefield': 'The ground is still torn from recent combat. Bones and weapons litter the earth.',
    'plague_site': 'A haunting silence permeates this place. Burial mounds dot the landscape.',
    'invasion_damage': 'Buildings stand half-destroyed. Charred wood and ash stain everything.',
    'celestial_mark': 'An otherworldly glow remains from the celestial event. Reality feels thin here.',
    'cultural_scar': 'All signs of the festival are gone, replaced with ashes and silence.',
    'natural_disaster': 'The landscape is ravaged. Rebuilt structures stand fragile against the wind.',
    'temporal_rift': 'Time moves strangely here. Echoes of the past bleed into the present.'
  };

  const visualMarkers: Record<ScarType, string> = {
    'battlefield': '⚔️ Scarred battlefield - remnants of battle',
    'plague_site': '🪦 Plague grave - haunted burial ground',
    'invasion_damage': '🔥 Invasion scar - destroyed structures',
    'celestial_mark': '✨ Celestial mark - reality distortion',
    'cultural_scar': '🎭 Cultural scar - suppressed traditions',
    'natural_disaster': '🌍 Nature\'s wound - ravaged landscape',
    'temporal_rift': '⏳ Temporal rift - time twisted'
  };

  const scar: WorldScar = {
    id: `scar-${locationId}-${currentEpoch}-${timestamp}`,
    type: scarType,
    locationId,
    description: scarDescriptions[scarType],
    severity: 60 + Math.random() * 40,
    createdAt: timestamp,
    epochCreated: currentEpoch,
    npcsAffected: [],
    healingProgress: 0,
    visualMarker: visualMarkers[scarType]
  };

  const npcsInLocation = state.npcs.filter(npc => npc.locationId === locationId);
  scar.npcsAffected = npcsInLocation.map(npc => npc.id);

  const scarEvent: Event = {
    id: `world-scar-created-${scar.id}`,
    worldInstanceId: state.id,
    actorId: 'world',
    type: 'WORLD_SCAR_CREATED',
    payload: {
      scarId: scar.id,
      scarType,
      locationId,
      severity: scar.severity,
      npcsAffected: scar.npcsAffected.length,
      description: scar.description
    },
    timestamp
  };
  events.push(scarEvent);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[WorldScars] Created ${scarType} scar at ${locationId} (severity: ${scar.severity.toFixed(0)})`);
  }

  return { scar, events };
}

/**
 * M51-D1: Get all scars at a location and their combined impact
 */
export function getScarImpactAtLocation(
  scars: WorldScar[],
  locationId: string
): ScarImpact {
  const locationScars = scars.filter(s => s.locationId === locationId);
  
  if (locationScars.length === 0) {
    return {
      moraleMod: 0,
      habitabilityMod: 0,
      conflictLikelihood: 0,
      discoveryChance: 0
    };
  }

  let moraleMod = 0;
  let habitabilityMod = 0;
  let conflictLikelihood = 0;
  let discoveryChance = 0;

  for (const scar of locationScars) {
    const impactMultiplier = (scar.severity / 100) * (1 - scar.healingProgress / 100);

    switch (scar.type) {
      case 'battlefield':
        moraleMod -= 20 * impactMultiplier;
        conflictLikelihood += 30 * impactMultiplier;
        discoveryChance += 25 * impactMultiplier;
        break;
      case 'plague_site':
        moraleMod -= 30 * impactMultiplier;
        habitabilityMod -= 25 * impactMultiplier;
        break;
      case 'invasion_damage':
        habitabilityMod -= 20 * impactMultiplier;
        conflictLikelihood += 15 * impactMultiplier;
        moraleMod -= 15 * impactMultiplier;
        break;
      case 'celestial_mark':
        discoveryChance += 40 * impactMultiplier;
        conflictLikelihood += 10 * impactMultiplier;
        break;
      case 'cultural_scar':
        moraleMod -= 25 * impactMultiplier;
        conflictLikelihood += 20 * impactMultiplier;
        break;
      case 'natural_disaster':
        habitabilityMod -= 15 * impactMultiplier;
        moraleMod -= 10 * impactMultiplier;
        discoveryChance += 15 * impactMultiplier;
        break;
      case 'temporal_rift':
        discoveryChance += 50 * impactMultiplier;
        conflictLikelihood += 25 * impactMultiplier;
        break;
    }
  }

  return {
    moraleMod: Math.max(-50, moraleMod),
    habitabilityMod: Math.max(-50, habitabilityMod),
    conflictLikelihood: Math.min(100, conflictLikelihood),
    discoveryChance: Math.min(100, discoveryChance)
  };
}

/**
 * M51-D1: Progress healing of scars over time
 */
export function progressScarHealing(
  scars: WorldScar[],
  locationId: string,
  epochsElapsed: number
): WorldScar[] {
  const healingRate = 5;
  
  return scars.map(scar => {
    if (scar.locationId === locationId && scar.healingProgress < 100) {
      const newHealing = Math.min(100, scar.healingProgress + healingRate * epochsElapsed);
      return {
        ...scar,
        healingProgress: newHealing
      };
    }
    return scar;
  });
}

/**
 * M51-D1: Check if affected NPCs have integrated scar into their belief system
 */
export function getNpcScarMemories(
  scars: WorldScar[],
  npcId: string
): { scarId: string; memory: string; emotionalImpact: number }[] {
  const memories = [];

  for (const scar of scars) {
    if (scar.npcsAffected.includes(npcId)) {
      const emotionalImpact = (scar.severity / 100) * (1 - scar.healingProgress / 100);
      
      const memoryTemplates: Record<ScarType, string> = {
        'battlefield': `I was here when the battle raged. So much blood spilled that day.`,
        'plague_site': `I lost loved ones to the plague. This place haunts me still.`,
        'invasion_damage': `The invaders burned everything I knew. I helped rebuild from the ashes.`,
        'celestial_mark': `The sky opened and changed everything. I still feel it watching.`,
        'cultural_scar': `They took our traditions and burned them. We could do nothing but watch.`,
        'natural_disaster': `Nature showed us our fragility. We are grateful to have survived.`,
        'temporal_rift': `Time twisted here. I remember things that haven't happened yet.`
      };

      memories.push({
        scarId: scar.id,
        memory: memoryTemplates[scar.type],
        emotionalImpact
      });
    }
  }

  return memories;
}

/**
 * M51-D1: Get all scars suitable for investigation clues
 */
export function getScarInvestigationClues(scars: WorldScar[]): 
  { clueId: string; scarId: string; clueText: string; reliability: string }[] {
  
  const clues = [];

  for (const scar of scars) {
    const clueTemplates: Record<ScarType, string> = {
      'battlefield': 'Weapons and armor scatter the ground—signs of desperate fighting.',
      'plague_site': 'Burial mounds and mass graves. The disease must have been devastating.',
      'invasion_damage': 'The construction patterns suggest organized, systematic destruction.',
      'celestial_mark': 'The marks on the ground form symbols. Someone or something left a message.',
      'cultural_scar': 'Ash patterns suggest ritualistic burning. A cultural tradition was destroyed here.',
      'natural_disaster': 'Geological evidence shows the disaster struck from [direction]. Nature was wrathful.',
      'temporal_rift': 'The scars exist in multiple timelines. This is no ordinary damage.'
    };

    if (clueTemplates[scar.type]) {
      clues.push({
        clueId: `clue-${scar.id}`,
        scarId: scar.id,
        clueText: clueTemplates[scar.type],
        reliability: scar.severity > 80 ? 'certain' : scar.severity > 50 ? 'probable' : 'unreliable'
      });
    }
  }

  return clues;
}

/**
 * M54-A1: Heal a specific world scar with resonance and merit
 * Returns the healed scar and whether it reached 100% healing (full restoration)
 */
export function healWorldScar(
  scar: WorldScar,
  resonanceAmount: number,
  meritAmount: number
): { healed: WorldScar; fullyRestored: boolean; healingGained: number } {
  // Each point of Resonance and Merit contributes to healing
  // 50 Resonance + 20 Merit = 70 healing points
  const healingGained = resonanceAmount * 0.8 + meritAmount * 2;
  
  const newHealing = Math.min(100, scar.healingProgress + healingGained);
  const fullyRestored = newHealing >= 100 && scar.healingProgress < 100;

  const healed: WorldScar = {
    ...scar,
    healingProgress: newHealing
  };

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[WorldScars] Healed ${scar.type} scar: ${scar.healingProgress.toFixed(0)}% → ${newHealing.toFixed(0)}% ` +
      (fullyRestored ? '(FULLY RESTORED!)' : '')
    );
  }

  return { healed, fullyRestored, healingGained };
}

/**
 * M54-A1: Restore a healed scar location's biome back to normal
 * Called when a scar reaches 100% healing
 */
export function restoreScarLocation(locationId: string, originalBiome?: string): {
  restoredBiome: string;
  description: string;
} {
  // Map scarred biomes back to their restored versions
  const biomeRestoration: Record<string, string> = {
    'corrupted': 'forest',
    'blighted': 'plains',
    'ravaged': 'mountain',
    'scorched': 'maritime',
    'cursed': 'shrine'
  };

  const restoredBiome = originalBiome || 'forest'; // Default to forest if no original specified
  
  const restorationDescriptions: Record<string, string> = {
    'forest': '🌲 The forest has healed. Green life returns to those twisted, blackened woods.',
    'plains': '🌾 The plains bloom again. Grass and wheat reclaim the barren ground.',
    'mountain': '⛰️ The mountain stands proud. Snow caps its peaks once more.',
    'maritime': '🌊 The waters run clear. Light returns to the depths.',
    'shrine': '🕯️ The shrine gleams. Holy light suffuses the restored sanctuary.',
    'cave': '⛏️ The cave finds peace. Echoes settle into harmony.',
    'village': '🏘️ The village thrives. Smoke from chimneys tells of hearth and home.'
  };

  return {
    restoredBiome,
    description: restorationDescriptions[restoredBiome] || 
      `✨ The land has been restored. Life and hope return to this place.`
  };
}

/**
 * M54-D1: Check if a location has a fully healed scar (eligible for relic discovery)
 */
export function isLocationFullyRestored(scar: WorldScar | undefined): boolean {
  return scar !== undefined && scar.healingProgress >= 100;
}

/**
 * M54-D1: Get relics eligible for discovery at a healed scar location
 */
export function getEligibleRelicsAtHealedScar(locationId: string, scars: WorldScar[]): {
  canDiscoverRelics: boolean;
  scarId?: string;
  scarType?: string;
} {
  const locationScar = scars.find(s => s.locationId === locationId);
  
  if (!locationScar || locationScar.healingProgress < 100) {
    return { canDiscoverRelics: false };
  }

  // Return which relics are discoverable based on scar type
  return {
    canDiscoverRelics: true,
    scarId: locationScar.id,
    scarType: locationScar.type
  };
}

export const WorldScarsEngineExports = {
  createWorldScar,
  getScarImpactAtLocation,
  progressScarHealing,
  getNpcScarMemories,
  getScarInvestigationClues,
  healWorldScar,
  restoreScarLocation,
  isLocationFullyRestored,
  getEligibleRelicsAtHealedScar
};

