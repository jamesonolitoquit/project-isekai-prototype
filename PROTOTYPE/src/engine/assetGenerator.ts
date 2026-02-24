import type { WorldState, NPC, Location } from './worldEngine';

/**
 * M7: Visual style identifiers for consistent art direction
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
 * M7: Mapping from asset type to visual characteristics
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
 * M7: Context for generating visual prompts
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
 * M7: Generated visual composition
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
 * M7: Legacy prompt format for backward compat
 */
export interface AssetPrompt {
  type: 'location' | 'npc_portrait' | 'encounter' | 'map' | 'item' | 'scene';
  subject: string;
  context: string;
  style: 'luxfier' | 'dark-fantasy' | 'minimal';
  seed: number;
}

/**
 * M7: Generated asset with metadata
 */
export interface GeneratedAsset {
  id: string;
  type: string;
  promptUsed: AssetPrompt | VisualPrompt;
  imageData?: string;
  generatedAt: number;
  expiresAt?: number;
}

/**
 * Asset type registry mapping
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

// M33: Epoch-Themed AI Image Generation (Visual Continuity)

/**
 * M33: Epoch-specific visual style modifiers for consistent thematic art
 * Maps epoch ID/theme to visual keywords, color palettes, and atmosphere
 */
export interface EpochVisualStyle {
  epochId: string;
  theme: string;
  styleKeywords: string[];
  colorPalette: string[];
  atmosphereModifiers: string[];
  architectureStyle: string;
  lightingStyle: string;
}

const EPOCH_VISUAL_STYLES: Record<string, EpochVisualStyle> = {
  epoch_i_fracture: {
    epochId: 'epoch_i_fracture',
    theme: 'Fracture',
    styleKeywords: ['radiance', 'ornate', 'vibrant', 'crystalline', 'golden-light'],
    colorPalette: ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#00CED1'],
    atmosphereModifiers: ['hopeful', 'luminous', 'intricate', 'majestic'],
    architectureStyle: 'ornate spires, geometric symmetry, light-refracting crystals',
    lightingStyle: 'bright golden hour, lens flares, prismatic reflections'
  },
  epoch_ii_waning: {
    epochId: 'epoch_ii_waning',
    theme: 'Waning Light',
    styleKeywords: ['twilight', 'bioluminescent', 'fading-gold', 'shadow-play', 'amber-glow'],
    colorPalette: ['#FF8C00', '#DAA520', '#696969', '#2F4F4F', '#8B7355'],
    atmosphereModifiers: ['melancholic', 'transitional', 'mysterious', 'ethereal'],
    architectureStyle: 'weathered towers, moss-covered stone, crumbling grandeur',
    lightingStyle: 'sunset and dusk, long shadows, bioluminescent accents'
  },
  epoch_iii_twilight: {
    epochId: 'epoch_iii_twilight',
    theme: 'Twilight',
    styleKeywords: ['eldritch', 'rust-decay', 'void-space', 'chiaroscuro', 'extreme-contrast'],
    colorPalette: ['#1a1a2e', '#16213e', '#8B008B', '#FF6347', '#FFD700'],
    atmosphereModifiers: ['ominous', 'corrupted', 'reality-tearing', 'sinister'],
    architectureStyle: 'twisted metal, organic corruption, void-touched ruin',
    lightingStyle: 'extreme chiaroscuro, void-black shadows, eldritch purple glow'
  }
};

/**
 * M33: Get epoch-specific visual style modifiers
 */
export function getEpochVisualStyle(epochId?: string, theme?: string): EpochVisualStyle {
  if (epochId && EPOCH_VISUAL_STYLES[epochId]) {
    return EPOCH_VISUAL_STYLES[epochId];
  }

  // Fallback to default (Epoch I)
  return EPOCH_VISUAL_STYLES['epoch_i_fracture'];
}

/**
 * M33: Enhance NPC portrait prompt with epoch-themed styling
 * The epoch's visual theme becomes a primary style seed for AI generation
 */
export function generateEpochThemedNpcPortraitPrompt(
  npc: NPC,
  epochId?: string,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  const epochStyle = getEpochVisualStyle(epochId);

  const basePrompt = {
    type: 'npc_portrait' as const,
    subject: npc.name,
    context: `A ${npc.factionRole ?? 'denizen'} of the ${npc.factionId ?? 'unknown'} faction`,
    style,
    seed: npc.id.split('').reduce((a, b) => a + (b.codePointAt(0) ?? 0), 0)
  };

  // Inject epoch theme into prompt synthesis
  const epochModifiers = epochStyle.styleKeywords.join(', ');
  const atmosphereKeywords = epochStyle.atmosphereModifiers.slice(0, 2).join(', ');

  return {
    ...basePrompt,
    context: `${basePrompt.context}. Theme: ${epochStyle.theme}. Style: ${epochModifiers}. Atmosphere: ${atmosphereKeywords}.`
  };
}

/**
 * M33: Enhance location prompt with epoch-themed styling
 */
export function generateEpochThemedLocationPrompt(
  state: WorldState,
  locationId: string,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt {
  const location = state.locations?.find(l => l.id === locationId);
  const description = location?.description || 'An unknown place';
  const epochStyle = getEpochVisualStyle(state.epochId);

  const basePrompt = {
    type: 'location' as const,
    subject: location?.name || locationId,
    context: description,
    style,
    seed: (location?.id ?? locationId).split('').reduce((a, b) => a + (b.codePointAt(0) ?? 0), 0)
  };

  // Inject epoch architecture and lighting styles
  const enhancedContext = `${basePrompt.context}. Architecture: ${epochStyle.architectureStyle}. Lighting: ${epochStyle.lightingStyle}. Color scheme: ${epochStyle.colorPalette.slice(0, 3).join(', ')}.`;

  return {
    ...basePrompt,
    context: enhancedContext
  };
}

/**
 * M33: Batch generate epoch-themed prompts for entire location set
 * Useful for pre-caching visual assets when entering a new epoch
 */
export function generateEpochThemedLocationBatch(
  state: WorldState,
  style: 'luxfier' | 'dark-fantasy' | 'minimal' = 'luxfier'
): AssetPrompt[] {
  return (state.locations || []).map(location =>
    generateEpochThemedLocationPrompt(state, location.id, style)
  );
}

/**
 * M33: Generate a full visual census for a new epoch
 * Returns prompts for all NPCs and key locations with consistent epoch theming
 */
export function generateEpochCensusBatch(
  state: WorldState,
  maxNpcs: number = 10,
  maxLocations: number = 8
): {
  npcPrompts: AssetPrompt[];
  locationPrompts: AssetPrompt[];
  epochStyle: EpochVisualStyle;
} {
  const npcPrompts = state.npcs.slice(0, maxNpcs).map(npc =>
    generateEpochThemedNpcPortraitPrompt(npc, state.epochId)
  );

  const locationPrompts = (state.locations || []).slice(0, maxLocations).map(location =>
    generateEpochThemedLocationPrompt(state, location.id)
  );

  return {
    npcPrompts,
    locationPrompts,
    epochStyle: getEpochVisualStyle(state.epochId)
  };
}
