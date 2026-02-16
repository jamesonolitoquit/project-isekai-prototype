/**
 * Environmental Modifier Engine (ALPHA_M9 Phase 3)
 * 
 * Calculates how weather, terrain, time-of-day, and celestial alignment
 * modify encounter rates, NPC behavior, audio effects, and spatial anomalies.
 */

import type { WorldState, Location } from './worldEngine';
import type { Weather } from './weatherEngine';

export type EnvironmentalModifier = {
  weatherMod: number;           // 0.5-2.0: weather effect on encounters
  terrainMod: number;           // 0.5-2.0: terrain difficulty
  timeOfDayMod: number;         // 0.5-2.0: diurnal/nocturnal activity
  spiritResonanceMod: number;   // 0.5-2.0: magical potency based on location
  fluxAnomalyChance: number;    // 0-1: probability of encountering spatial distortion
};

export type FluxAnomaly = {
  id: string;
  type: 'temporal_echo' | 'spatial_fold' | 'reality_rift' | 'spirit_incursion';
  intensity: 'subtle' | 'moderate' | 'severe';
  duration: number;              // Ticks
  manifestation: string;         // Flavor text
  mechanicalEffect: string;      // Gameplay effect
  celestialTrigger?: string;     // e.g., "lunar_eclipse", "stellar_alignment"
};

/**
 * Calculate weather modifier for encounters
 * Clear->normal, rain->higher encounters, snow->lower but more intense
 */
export function getWeatherModifier(weather: Weather, season: string): number {
  const weatherMods: Record<Weather, Record<string, number>> = {
    clear: { winter: 0.7, spring: 0.9, summer: 0.8, autumn: 0.8 },
    rain: { winter: 1.3, spring: 1.2, summer: 1.1, autumn: 1.4 },
    snow: { winter: 1.6, spring: 1.0, summer: 0.5, autumn: 0.9 },
  };

  return weatherMods[weather]?.[season] ?? 1.0;
}

/**
 * Calculate terrain modifier based on biome
 */
export function getTerrainModifier(biome?: string): number {
  const biomeMods: Record<string, number> = {
    forest: 1.2,      // Dense terrain, more encounters
    cave: 1.5,        // Confined space, concentrated encounters
    village: 0.5,     // Civilization deters wild encounters
    corrupted: 1.8,   // High danger zone
    shrine: 0.6,      // Sanctified, repels lesser creatures
    maritime: 1.0,    // Neutral
    mountain: 1.3,    // Challenging terrain
    plains: 0.9,      // Open, easier to avoid encounters
  };

  if (!biome) return 1.0;
  return biomeMods[biome] ?? 1.0;
}

/**
 * Calculate time-of-day modifier
 * Nocturnal enemies more active at night, diurnal at day
 */
export function getTimeOfDayModifier(hour: number, biome?: string): number {
  // Hour 0-5: night (0-5 hours after midnight)
  // Hour 6-17: day (6am-5pm)
  // Hour 18-23: dusk/evening (6pm-11pm)

  const isNight = hour >= 20 || hour < 6;
  const isDusk = hour >= 18 && hour < 20;
  const isDay = hour >= 6 && hour < 18;

  const baseNocturnalMod = isNight ? 1.4 : isDay ? 0.6 : 1.0; // Dusk = neutral

  // Some biomes are more active at specific times
  if (biome === 'corrupted') {
    return isNight ? 1.6 : 0.8; // Corruption stronger at night
  }
  if (biome === 'shrine') {
    return isNight ? 0.8 : 1.2; // Shrine more powerful during daylight
  }

  return baseNocturnalMod;
}

/**
 * Calculate spirit resonance modifier based on location spiritDensity
 */
export function getSpiritResonanceModifier(location: Location): number {
  const spiritDensity = location.spiritDensity ?? 0.5;
  // Low spirit = 0.6x, medium = 1.0x, high = 2.0x
  return 0.4 + spiritDensity * 1.6;
}

/**
 * Calculate flux anomaly chance based on celestial factors
 * (In full implementation, would integrate with timeEngine for celestial events)
 */
export function calculateFluxAnomalyChance(
  state: WorldState,
  location: Location,
  hour: number
): number {
  const baseSpiritModifier = getSpiritResonanceModifier(location);
  const season = state.season || 'spring';

  let anomalyChance = 0.02; // Base 2% chance

  // Correlate with celestial alignment (placeholder - would use timeEngine)
  // New moons and eclipses increase anomalies
  const dailyCycleMod = Math.abs(Math.sin((hour / 24) * Math.PI)); // 0 at midnight/noon, 1 at 6am/6pm
  anomalyChance += dailyCycleMod * 0.03;

  // Spirit-dense locations more likely to have anomalies
  anomalyChance *= baseSpiritModifier / 1.0;

  // Cap at 25%
  return Math.min(0.25, anomalyChance);
}

/**
 * Generate a flux anomaly for a given location
 */
export function generateFluxAnomaly(
  state: WorldState,
  location: Location,
  rng: any // SeededRng
): FluxAnomaly {
  const anomalyTypes: FluxAnomaly['type'][] = [
    'temporal_echo',
    'spatial_fold',
    'reality_rift',
    'spirit_incursion',
  ];

  const intensities: FluxAnomaly['intensity'][] = ['subtle', 'moderate', 'severe'];

  const spiritMod = getSpiritResonanceModifier(location);
  const selectedType = rng.pick ? rng.pick(anomalyTypes) : anomalyTypes[Math.floor((rng.next?.() ?? 0.5) * anomalyTypes.length)] as FluxAnomaly['type'];
  const selectedIntensity = rng.pick ? rng.pick(intensities) : intensities[Math.floor((rng.next?.() ?? 0.5) * intensities.length)] as FluxAnomaly['intensity'];

  const durationBase = 60; // Ticks
  const duration = durationBase + (rng.nextInt ? rng.nextInt(0, 60) : Math.floor((rng.next?.() ?? 0.5) * 60));

  const manifestations: Record<FluxAnomaly['type'], Record<FluxAnomaly['intensity'], string>> = {
    temporal_echo: {
      subtle: 'A faint shimmer appears—as if time reverberates here.',
      moderate: 'Echoes of nearby locations flicker into view before vanishing.',
      severe: 'You glimpse multiple timelines overlapping! Reality stutters.',
    },
    spatial_fold: {
      subtle: 'The space around you seems slightly compressed.',
      moderate: 'Distances appear warped. Nearby objects seem further than they should be.',
      severe: 'The terrain tears! A fold in space opens before closing.',
    },
    reality_rift: {
      subtle: 'The air wavers. Something fundamental is unstable here.',
      moderate: 'Cracks of impossible light spread through the air.',
      severe: 'Reality fractures! A maw of void opens, threatening to consume everything.',
    },
    spirit_incursion: {
      subtle: 'Spectral shapes drift through the environment.',
      moderate: 'Spirits of the land manifest visibly, their presence overwhelming.',
      severe: 'An army of spirits descends! The veil between worlds shatters!',
    },
  };

  const mechanicalEffects: Record<FluxAnomaly['type'], Record<FluxAnomaly['intensity'], string>> = {
    temporal_echo: {
      subtle: 'Audio distortion: +10% skill checks as echoes provide insight',
      moderate: 'Time loop: Last action can be re-attempted once',
      severe: 'Temporal regression: Lose 1 hour (stun for 60 ticks)',
    },
    spatial_fold: {
      subtle: 'Movement distance reduced by 20%',
      moderate: 'Randomly teleport within 100 coordinate units',
      severe: 'Displaced: Movement disabled for 60 ticks as you reorient',
    },
    reality_rift: {
      subtle: 'Spell effectiveness reduced 10%',
      moderate: 'Spell cost doubled',
      severe: 'All magic fails: Casting impossible for 120 ticks',
    },
    spirit_incursion: {
      subtle: 'Enemy stats +5%',
      moderate: 'Additional enemy spawned',
      severe: 'Boss-tier spirit summons; combat difficulty +100%',
    },
  };

  const manifestation = manifestations[selectedType as FluxAnomaly['type']][selectedIntensity as FluxAnomaly['intensity']];
  const mechanicalEffect = mechanicalEffects[selectedType as FluxAnomaly['type']][selectedIntensity as FluxAnomaly['intensity']];

  const tick = state.tick ?? 0;
  return {
    id: `flux-${tick}-${selectedType}`,
    type: selectedType,
    intensity: selectedIntensity,
    duration,
    manifestation,
    mechanicalEffect,
    celestialTrigger: undefined, // Placeholder for timeEngine integration
  };
}

/**
 * Calculate combined environmental modifier for an encounter
 */
export function calculateCombinedModifier(
  state: WorldState,
  location: Location
): EnvironmentalModifier {
  const weather = state.weather as Weather;
  const season = state.season || 'spring';
  const hour = state.hour ?? 12;

  const weatherMod = getWeatherModifier(weather, season);
  const terrainMod = getTerrainModifier(location.biome);
  const timeOfDayMod = getTimeOfDayModifier(hour, location.biome);
  const spiritResonanceMod = getSpiritResonanceModifier(location);
  const fluxAnomalyChance = calculateFluxAnomalyChance(state, location, hour);

  return {
    weatherMod,
    terrainMod,
    timeOfDayMod,
    spiritResonanceMod,
    fluxAnomalyChance,
  };
}

/**
 * Apply environmental modifiers to encounter generation
 * Returns multiplier for encounter difficulty/spawn count
 */
export function applyEnvironmentalModifiers(
  state: WorldState,
  location: Location
): number {
  const modifier = calculateCombinedModifier(state, location);

  // Combined multiplier (all factors together)
  return (
    modifier.weatherMod *
    modifier.terrainMod *
    modifier.timeOfDayMod *
    modifier.spiritResonanceMod
  );
}

/**
 * Get audio effect name based on environmental modifiers
 * (Integrates with audioEngine for spatial effects)
 */
export function getAudioEnvironmentalEffect(
  modifier: EnvironmentalModifier,
  weather: Weather
): string {
  if (weather === 'snow') return 'muffled_by_snow';
  if (weather === 'rain') return 'rain_ambient_wash';
  if (modifier.spiritResonanceMod > 1.5) return 'ethereal_resonance';
  if (modifier.fluxAnomalyChance > 0.15) return 'reality_distortion';
  return 'normal';
}

/**
 * ALPHA_M15: Calculate environmental fatigue - MP cost multiplier based on weather
 * Heavy rain increases MP drain for movement; blizzards are worse
 */
export function calculateEnvironmentalFatigue(weather: Weather, intensity: 'light' | 'moderate' | 'heavy'): number {
  const intensityMap = { light: 0.1, moderate: 0.3, heavy: 0.6 };
  
  if (weather === 'snow') {
    // Blizzard: severe MP drain from harsh conditions
    return 1.0 + intensityMap[intensity] * 2.33; // 1.23-2.4x MP cost
  } else if (weather === 'rain') {
    // Heavy rain: difficult footing, increased effort
    return 1.0 + intensityMap[intensity] * 0.8; // 1.08-1.48x MP cost
  }
  
  // Clear weather: no additional fatigue
  return 1.0;
}

/**
 * ALPHA_M15: Calculate seasonal buffs/debuffs
 * Returns object with mana regen multiplier and item quality multiplier
 */
export function calculateSeasonalModifiers(
  season: 'winter' | 'spring' | 'summer' | 'autumn'
): { 
  manaRegenMult: number;
  itemQualityMult: number;
  combatDifficulty: number; // Affects encounter scaling
} {
  switch (season) {
    case 'spring':
      return { manaRegenMult: 1.3, itemQualityMult: 1.0, combatDifficulty: 1.0 };
    case 'summer':
      return { manaRegenMult: 0.9, itemQualityMult: 0.95, combatDifficulty: 1.1 };
    case 'autumn':
      return { manaRegenMult: 1.0, itemQualityMult: 1.25, combatDifficulty: 0.95 };
    case 'winter':
      return { manaRegenMult: 0.8, itemQualityMult: 0.9, combatDifficulty: 1.2 };
  }
}

/**
 * ALPHA_M15: Determine if hazard effect triggers (blizzard health damage)
 * Returns hazard type if applicable, null otherwise
 */
export function checkEnvironmentalHazard(
  weather: Weather,
  intensity: 'light' | 'moderate' | 'heavy',
  hour: number,
  location: Location,
  isSheltered: boolean // At Altar or Tavern
): { hazardType: string; damageTicks: number } | null {
  // Blizzard hazard: only triggers in heavy snow
  if (weather === 'snow' && intensity === 'heavy' && !isSheltered) {
    // More damage during night hours (non-sheltered)
    const isNight = hour >= 20 || hour < 6;
    const damageTicks = isNight ? 3 : 1; // 3 health ticks per action at night, 1 during day
    
    return {
      hazardType: 'HAZARD_CHILL',
      damageTicks
    };
  }
  
  return null;
}

/**
 * ALPHA_M15: Check if location is sheltered from environmental hazards
 */
export function isLocationSheltered(biome?: string): boolean {
  const shelteredBiomes = ['village', 'shrine', 'tavern', 'cave'];
  return biome ? shelteredBiomes.includes(biome.toLowerCase()) : false;
}
