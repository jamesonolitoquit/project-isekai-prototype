/**
 * assetGenerator.ts - The Synthesis Engine (ALPHA_M7)
 * 
 * Generates rich, context-aware visual prompts, dynamic environmental descriptions,
 * and sensory narrative feedback based on world state and context.
 * 
 * Features:
 * - Visual prompts for AI image generators
 * - Atmospheric/sensory text generation
 * - Asset type mapping (item/NPC types to visual styles)
 * - Context-aware mood and aesthetics
 */

import type { WorldState, Location, NPC } from './worldEngine';

/**
 * Visual style classification for assets
 */
export type VisualStyle = 
  | 'gothic'
  | 'high-fantasy'
  | 'void-corrupted'
  | 'nature-infused'
  | 'arcane'
  | 'steampunk'
  | 'ethereal'
  | 'corrupted'
  | 'noble'
  | 'mystical';

/**
 * Asset type registry mapping
 */
export interface AssetTypeMapping {
  itemType: string;
  npcType: string;
  visualStyle: VisualStyle;
  colorPalette: string[];
  aestheticKeywords: string[];
  atmosphereModifiers: string[];
}

/**
 * Visual prompt context information
 */
export interface VisualPromptContext {
  location: Location;
  weather: string;
  season: string;
  time: string;
  dayPhase: string;
  intensity?: string;
  specialEvents?: string[];
}

/**
 * Generated visual prompt (for M7)
 */
export interface VisualPrompt {
  mainScene: string;
  atmosphere: string;
  lighting: string;
  detailedDescription: string;
  styleGuide: string;
  colorTone: string;
  fullPrompt: string;
}

/**
 * Legacy asset prompt (backward compatibility)
 */
export interface AssetPrompt {
  type: 'map' | 'npc_portrait' | 'encounter' | 'location' | 'item';
  subject: string;
  context: string;
  style: 'luxfier' | 'dark-fantasy' | 'minimal';
  seed: number;
}

export interface GeneratedAsset {
  id: string;
  type: 'map' | 'npc_portrait' | 'encounter' | 'location' | 'item';
  url: string;
  prompt: string;
  generatedAt: number;
  sourceId: string;
}


/**
 * Asset registry for mapping types to visual styles
 */
const ASSET_REGISTRY: Record<string, AssetTypeMapping> = {
  'noble-warrior': {
    itemType: 'sword',
    npcType: 'knight',
    visualStyle: 'high-fantasy',
    colorPalette: ['#FFD700', '#C0C0C0', '#4B0082'],
    aestheticKeywords: ['heroic', 'noble', 'steel', 'crested-armor'],
    atmosphereModifiers: ['majestic', 'honorable', 'resolute']
  },
  'void-mage': {
    itemType: 'staff',
    npcType: 'sorcerer',
    visualStyle: 'void-corrupted',
    colorPalette: ['#000000', '#663399', '#8B008B'],
    aestheticKeywords: ['otherworldly', 'ominous', 'reality-tearing'],
    atmosphereModifiers: ['sinister', 'arcane', 'dangerous']
  },
  'forest-guardian': {
    itemType: 'bow',
    npcType: 'ranger',
    visualStyle: 'nature-infused',
    colorPalette: ['#228B22', '#32CD32', '#8B4513'],
    aestheticKeywords: ['verdant', 'organic', 'ancient-wood'],
    atmosphereModifiers: ['peaceful', 'alive', 'watchful']
  },
  'arcane-scholar': {
    itemType: 'grimoire',
    npcType: 'mage',
    visualStyle: 'arcane',
    colorPalette: ['#4169E1', '#E0FFFF', '#FFD700'],
    aestheticKeywords: ['mystical', 'learned', 'ethereal-runes'],
    atmosphereModifiers: ['intellectual', 'mysterious', 'wondrous']
  },
  'corrupted-knight': {
    itemType: 'cursed-blade',
    npcType: 'corrupted-warrior',
    visualStyle: 'corrupted',
    colorPalette: ['#8B0000', '#DC143C', '#000000'],
    aestheticKeywords: ['twisted', 'unholy', 'veins-of-dark-energy'],
    atmosphereModifiers: ['threatening', 'unnatural', 'corrupted']
  },
  'ethereal-spirit': {
    itemType: 'spectral-orb',
    npcType: 'ghost',
    visualStyle: 'ethereal',
    colorPalette: ['#FFFACD', '#87CEEB', '#B0C4DE'],
    aestheticKeywords: ['translucent', 'ghostly', 'luminous'],
    atmosphereModifiers: ['haunting', 'mysterious', 'otherworldly']
  }
};

/**
 * Time-of-day visual characteristics
 */
const TIME_OF_DAY_AESTHETICS = {
  night: {
    lighting: 'Deep shadows, moonlight filtering through canopy, stars twinkling above',
    colorShift: 'cool blues, purples, and silhouettes',
    atmosphere: 'mysterious, intimate, dangerous'
  },
  morning: {
    lighting: 'Golden sunlight breaking through mist, long shadows',
    colorShift: 'warm golds, soft oranges, dewy greens',
    atmosphere: 'hopeful, awakening, fresh'
  },
  afternoon: {
    lighting: 'Bright, clear sunlight casting sharp shadows',
    colorShift: 'vibrant colors, saturated greens and blues',
    atmosphere: 'alert, active, visible'
  },
  evening: {
    lighting: 'Warm sunset glow, long golden-hour shadows',
    colorShift: 'deep oranges, reds, purples transitioning to dusk',
    atmosphere: 'contemplative, melancholic, wondrous'
  }
};

/**
 * Season-specific visual characteristics
 */
const SEASON_AESTHETICS = {
  winter: {
    elements: 'snow, ice, frost, bare branches',
    colorPalette: ['#F0FFFF', '#E8E8E8', '#87CEEB'],
    atmosphere: 'harsh, serene, desolate',
    flora: 'snow-laden trees, frozen waterfalls, icicles'
  },
  spring: {
    elements: 'blooming flowers, budding trees, flowing water',
    colorPalette: ['#FFB6C1', '#90EE90', '#87CEEB'],
    atmosphere: 'rejuvenating, hopeful, alive',
    flora: 'cherry blossoms, new growth, vibrant wildflowers'
  },
  summer: {
    elements: 'lush green foliage, bright sun, warm air',
    colorPalette: ['#90EE90', '#FFD700', '#87CEEB'],
    atmosphere: 'vibrant, energetic, abundant',
    flora: 'dense forest canopy, bold flowers, verdant grass'
  },
  autumn: {
    elements: 'falling leaves, golden light, crisp air',
    colorPalette: ['#FF8C00', '#DAA520', '#8B4513'],
    atmosphere: 'melancholic, beautiful, transitional',
    flora: 'falling golden leaves, bare branches, muted colors'
  }
};

/**
 * Weather-specific visual characteristics
 */
const WEATHER_AESTHETICS = {
  clear: {
    effects: 'clear sky, excellent visibility',
    lighting: 'direct, natural',
    atmosphere: 'open, peaceful, revealed'
  },
  rain: {
    effects: 'falling rain, wet surfaces, reduced visibility, mist',
    lighting: 'diffused, overcast, moody',
    atmosphere: 'introspective, dreamy, melancholic'
  },
  snow: {
    effects: 'falling snow, white landscape, crystal formations',
    lighting: 'soft, bright despite clouds, ethereal',
    atmosphere: 'quiet, pristine, isolated'
  }
};

/**
 * M7: Generate a rich visual prompt based on world state
 */
export function generateVisualPrompt(
  state: WorldState,
  context: VisualPromptContext
): VisualPrompt {
  const weather = context.weather || 'clear';
  const season = context.season || 'spring';
  const dayPhase = context.dayPhase || 'afternoon';
  const location = context.location;

  const timeAesthetic = TIME_OF_DAY_AESTHETICS[dayPhase as keyof typeof TIME_OF_DAY_AESTHETICS] || TIME_OF_DAY_AESTHETICS.afternoon;
  const seasonAesthetic = SEASON_AESTHETICS[season as keyof typeof SEASON_AESTHETICS] || SEASON_AESTHETICS.spring;
  const weatherAesthetic = WEATHER_AESTHETICS[weather as keyof typeof WEATHER_AESTHETICS] || WEATHER_AESTHETICS.clear;

  const mainScene = buildMainSceneDescription(location, seasonAesthetic, context.specialEvents || []);
  const lighting = timeAesthetic.lighting;
  
  const atmosphereElements = [
    timeAesthetic.atmosphere,
    weatherAesthetic.atmosphere,
    seasonAesthetic.atmosphere
  ].filter(Boolean);
  const atmosphere = atmosphereElements.join(', ') || 'peaceful and serene';

  const timeColors = timeAesthetic.colorShift;
  const seasonColors = seasonAesthetic.colorPalette.join(', ');
  const colorTone = `${timeColors}. Dominant colors: ${seasonColors}`;

  const styleGuide = generateStyleGuide(location, season, dayPhase);

  const detailedDescription = [
    mainScene,
    `Weather conditions: ${weatherAesthetic.effects}`,
    `Lighting: ${lighting}`,
    `Flora and environment: ${seasonAesthetic.flora}`
  ].filter(Boolean).join('. ');

  const fullPrompt = buildFullPrompt({
    mainScene,
    atmosphere,
    lighting,
    detailedDescription,
    styleGuide,
    colorTone,
    weatherAesthetic
  });

  return {
    mainScene,
    atmosphere,
    lighting,
    detailedDescription,
    styleGuide,
    colorTone,
    fullPrompt
  };
}

/**
 * M7: Generate atmospheric sensory narrative text
 */
export function generateAtmosphericText(state: WorldState): string {
  const weather = state.weather || 'clear';
  const season = state.season || 'spring';
  const dayPhase = state.dayPhase || 'afternoon';
  const location = state.locations.find(l => l.id === state.player.location);

  if (!location) return 'You stand in an uncertain place, the world around you unclear.';

  const soundscape = generateSoundscape(weather, season, dayPhase, location);
  const scent = generateScent(weather, season, dayPhase);
  const tactile = generateTactileSensations(weather, season, dayPhase);
  const visual = generateVisualDetail(weather, season, dayPhase, location);

  const narrativeFragments = [
    visual,
    soundscape,
    scent,
    tactile
  ].filter(Boolean);

  return narrativeFragments.join(' ');
}

/**
 * Helper: Build main scene description
 */
function buildMainSceneDescription(location: Location, seasonAesthetic: any, specialEvents: string[]): string {
  const baseDescription = location.description || location.name;
  const seasonalModifier = seasonAesthetic.elements || '';
  
  let description = `A view of ${baseDescription}. ${seasonalModifier}`;
  
  if (specialEvents.length > 0) {
    description += ` The area is affected by: ${specialEvents.join(', ')}`;
  }

  return description;
}

/**
 * Helper: Generate a style guide
 */
function generateStyleGuide(location: Location, season: string, dayPhase: string): string {
  const styles: string[] = [];

  if (location.name.toLowerCase().includes('forest') || location.name.toLowerCase().includes('wood')) {
    styles.push('natural, organic, overgrown');
  } else if (location.name.toLowerCase().includes('cave') || location.name.toLowerCase().includes('dungeon')) {
    styles.push('dark, cramped, foreboding');
  } else if (location.name.toLowerCase().includes('tower') || location.name.toLowerCase().includes('castle')) {
    styles.push('majestic, imposing, architectural');
  } else if (location.name.toLowerCase().includes('village') || location.name.toLowerCase().includes('town')) {
    styles.push('cozy, lived-in, communal');
  } else {
    styles.push('exploration, discovery, unknown');
  }

  if (season === 'winter') {
    styles.push('harsh, minimalist, crystalline');
  } else if (season === 'spring') {
    styles.push('renewal, vibrant, growing');
  } else if (season === 'summer') {
    styles.push('lush, abundant, saturated');
  } else if (season === 'autumn') {
    styles.push('nostalgic, transitional, golden');
  }

  return styles.join('. ');
}

/**
 * Helper: Build full AI-ready prompt
 */
function buildFullPrompt(components: any): string {
  const parts = [
    `Scene: ${components.mainScene}`,
    `Atmosphere: ${components.atmosphere}`,
    `Lighting: ${components.lighting}`,
    `Colors: ${components.colorTone}`,
    `Weather: ${components.weatherAesthetic.effects}`,
    `Style: ${components.styleGuide}`,
    `Details: ${components.detailedDescription}`
  ];

  return parts.filter(Boolean).join('. ') + '. Digital art, high detail, immersive fantasy environment.';
}

/**
 * Helper: Generate soundscape
 */
function generateSoundscape(weather: string, season: string, dayPhase: string, location: Location): string {
  const sounds: string[] = [];

  if (weather === 'rain') {
    sounds.push('the pitter-patter of rain on leaves');
  } else if (weather === 'snow') {
    sounds.push('the soft crunch of snow underfoot and wind through bare branches');
  } else {
    sounds.push('the gentle rustle of the breeze');
  }

  if (dayPhase === 'night') {
    sounds.push('the distant howl of wolves echoing');
  } else if (dayPhase === 'morning') {
    sounds.push('chirping birds greeting the dawn');
  } else if (dayPhase === 'evening') {
    sounds.push('crickets beginning their evening chorus');
  }

  if (season === 'autumn') {
    sounds.push('leaves crunching beneath your steps');
  } else if (season === 'spring') {
    sounds.push('the babbling of streams and birdsong');
  }

  return 'You hear ' + sounds.join(', and ') + '.';
}

/**
 * Helper: Generate scent description
 */
function generateScent(weather: string, season: string, dayPhase: string): string {
  const scents: string[] = [];

  if (weather === 'rain') {
    scents.push('the fresh, earthy smell of petrichor');
  } else if (weather === 'snow') {
    scents.push('the crisp, clean scent of cold air');
  } else {
    scents.push('the subtle fragrance of the natural world');
  }

  if (season === 'spring') {
    scents.push('flowers blooming in the distance');
  } else if (season === 'summer') {
    scents.push('sun-warmed earth and growing things');
  } else if (season === 'autumn') {
    scents.push('decaying leaves and wood smoke');
  } else if (season === 'winter') {
    scents.push('the sharp, metallic scent of cold');
  }

  return 'The air carries ' + scents.join(', ') + '.';
}

/**
 * Helper: Generate tactile sensations
 */
function generateTactileSensations(weather: string, season: string, dayPhase: string): string {
  const sensations: string[] = [];

  if (weather === 'rain') {
    sensations.push('cool raindrops on your skin');
  } else if (weather === 'snow') {
    sensations.push('biting cold and soft snowflakes');
  } else {
    sensations.push('a gentle breeze');
  }

  if (dayPhase === 'night') {
    sensations.push('cool night air');
  } else if (dayPhase === 'afternoon') {
    sensations.push('warm sun');
  }

  return 'You feel ' + sensations.join(' and ') + ' against your face.';
}

/**
 * Helper: Generate visual detail
 */
function generateVisualDetail(weather: string, season: string, dayPhase: string, location: Location): string {
  const visuals: string[] = [];

  if (location.name.toLowerCase().includes('forest')) {
    visuals.push('ancient trees tower above');
  } else if (location.name.toLowerCase().includes('mountain')) {
    visuals.push('towering peaks stretch toward the sky');
  } else if (location.name.toLowerCase().includes('plains') || location.name.toLowerCase().includes('meadow')) {
    visuals.push('rolling grasslands extend to the horizon');
  }

  if (weather === 'rain') {
    visuals.push('visibility is reduced by sheets of rain');
  } else if (weather === 'snow') {
    visuals.push('snowflakes dance through the air');
  } else {
    visuals.push('the landscape is clearly visible');
  }

  return 'Before you, ' + visuals.join(', ') + '.';
}

/**
 * M7: Get visual style for an asset type
 */
export function getAssetVisualStyle(assetType: string): AssetTypeMapping | undefined {
  return ASSET_REGISTRY[assetType];
}

/**
 * M7: Register or override an asset type mapping
 */
export function registerAssetType(assetType: string, mapping: AssetTypeMapping): void {
  ASSET_REGISTRY[assetType] = mapping;
}

/**
 * M7: Get all registered asset types
 */
export function getAllAssetTypes(): Record<string, AssetTypeMapping> {
  return { ...ASSET_REGISTRY };
}

// ===== LEGACY FUNCTIONS (backward compatibility) =====

// ===== LEGACY FUNCTIONS (backward compatibility) =====

/**
 * Legacy: Convert player's current location to visual prompt
 */
export function generateLocationPrompt(
  state: WorldState,
  locationId: string,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  const location = state.locations?.find(l => l.id === locationId);
  const description = location?.description || 'An unknown place';
  
  return {
    type: 'location',
    subject: location?.name || locationId,
    context: description,
    style,
    seed: (location?.id ?? locationId).split('').reduce((a, b) => a + (b.codePointAt(0) ?? 0), 0)
  };
}

/**
 * Legacy: Convert NPC to visual portrait prompt
 */
export function generateNpcPortraitPrompt(
  npc: NPC,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  return {
    type: 'npc_portrait',
    subject: npc.name,
    context: `A ${npc.factionRole ?? 'denizen'} of the ${npc.factionId ?? 'unknown'} faction`,
    style,
    seed: npc.id.split('').reduce((a, b) => a + (b.codePointAt(0) ?? 0), 0)
  };
}

/**
 * Legacy: Convert encounter to visual scene prompt
 */
export function generateEncounterPrompt(
  encounterType: string,
  locationName: string,
  difficulty: number,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  return {
    type: 'encounter',
    subject: encounterType,
    context: `In ${locationName}, difficulty ${difficulty}/10`,
    style,
    seed: (encounterType.codePointAt(0) ?? 0) + difficulty + Date.now() % 1000
  };
}

/**
 * Legacy: Generate world map visualization prompt
 */
export function generateMapPrompt(
  state: WorldState,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  const regionCount = state.locations?.length ?? 0;
  
  return {
    type: 'map',
    subject: `World Map - ${regionCount} regions`,
    context: `Luxfier world with ${regionCount} major locations`,
    style,
    seed: (state.id ?? '').split('')[0].codePointAt(0) ?? 0 * 7
  };
}

/**
 * Cache manager for generated assets
 */
const assetCache = new Map<string, GeneratedAsset>();

export function cacheAsset(asset: GeneratedAsset): void {
  assetCache.set(asset.id, asset);
}

export function getAssetFromCache(id: string): GeneratedAsset | undefined {
  return assetCache.get(id);
}

export function clearAssetCache(): void {
  assetCache.clear();
}

/**
 * Placeholder: Call external AI service to generate image
 */
export async function generateImageFromPrompt(prompt: AssetPrompt): Promise<string> {
  return `data:image/placeholder;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
}

/**
 * Generate multiple assets in batch (more efficient)
 */
export async function generateAssetBatch(
  prompts: AssetPrompt[]
): Promise<GeneratedAsset[]> {
  return [];
}
