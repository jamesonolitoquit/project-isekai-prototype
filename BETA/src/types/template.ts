/**
 * World Template System (DSS 16: The Matriarchal Genesis Template)
 * 
 * World Templates define the foundational configuration and rules for each world instance.
 * The Matriarchal Genesis Template is the first implementation, introducing gender-based
 * mechanics, Womb-Magic talent, and Ancestral Echo systems.
 */

/**
 * Base World Template Interface
 * All templates inherit from this base configuration
 */
export interface WorldTemplate {
  /** Unique template identifier */
  templateId: string;

  /** Metadata about this template */
  metadata: TemplateMetadata;

  /** Global constants that affect simulation */
  globalConstants: GlobalConstants;

  /** Faction seeding configuration */
  factionalSeed: FactionalSeed;

  /** Available ancestries in this world */
  ancestryAvailability: string[];

  /** Available talents players can select */
  talentPool: Array<{
    id: string;
    name: string;
    description: string;
    type: 'active' | 'passive';
    mechanics: string;
    cooldown?: string;
    cost?: string;
    effect: string;
  }>;

  /** Divine entities present in this world */
  divinePresence: string[];

  /** Economic model type */
  economicModel: string;

  /** Applied security patches */
  securityPatches: string[];

  /** Starting locations available for character creation */
  startingLocations: StartingLocation[];

  /** All locations in the world (full world map) */
  locations?: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    spiritDensity: number;
    biome: string;
    description: string;
    geography?: string;
    factionPresence?: string;
    lore?: string;
    resourceNodes?: any[];
  }>;

  /** Ancestry trees with racial starting stats (Phase 47) */
  ancestryTrees?: AncestryTree[];

  /** Starting gear choices (offense/defense) for character creation */
  startingGearChoices?: Array<{
    id: string;
    category: 'offense' | 'defense';
    name: string;
    icon: string;
    description: string;
    flavorText: string;
    mechanics?: string;
    statBonuses?: string;
    lore?: string;
  }>;

  /** Curiosity pool - flavor items for character creation */
  curiosityPool?: Array<{
    id: string;
    name: string;
    icon: string;
    lore: string;
  }>;
}

/**
 * Template Metadata
 */
export interface TemplateMetadata {
  name: string;
  description: string;
  worldEpoch: string;
  createdAt: string; // ISO 8601 timestamp
  version: number;
  author?: string;
  tags?: string[];
  loreHighlights?: string[];  // Key lore themes to display during character creation
}

/**
 * Starting Location for Character Creation
 * Defines where players can begin their journey
 */
export interface StartingLocation {
  id: string;
  name: string;
  description: string;
  coordinates?: { x: number; y: number };
  recommendedArchetypes?: string[];  // Optional: archetypes suited to this location
  faction?: string;  // Associated faction
  loreContext?: string;  // Narrative context for this starting point
}

/**
 * Ancestry Tree for Character Creation
 * Defines racial starting stats and lore for a playable race
 */
export interface AncestryTree {
  id: string;                        // Unique ID (e.g., "elf_fantasy_leyweaver")
  race: string;                      // Race name (e.g., "Elf")
  codec: string;                     // World template/codec (e.g., "fantasy")
  name: string;                      // Display name (e.g., "The Ley-Weavers")
  description: string;               // Flavor description of the bloodline
  baseStats: Record<string, number>; // Starting stat allocation (8-base system)
  rootNodeId?: string;               // Entry node ID for passive tree
  nodes?: any[];                     // Passive tree nodes (optional)
  innatePassive?: {                  // Innate racial passive ability
    id: string;
    name: string;
    lore: string;
    effect: string;
    icon: string;
    color: string;
  };
}

/**
 * Global Constants defined per template
 */
/**
 * Global Constants for World Simulation
 * 
 * These constants define the fundamental mechanics of the world, including
 * time scales, player capacity, and resource generation rules.
 * 
 * NOTE: The authoritative definition is in src/types/persistence.ts
 * This is re-exported here for template compatibility.
 */
import type { GlobalConstants } from './persistence';

/**
 * Faction Configuration for template seeding
 */
export interface Faction {
  id: string;
  name: string;
  powerScore: number;          // 0-100
  controlledLocationIds: string[];
  causalBudgetPerDay: number;
  description?: string;
}

/**
 * Faction Relationship
 */
export interface FactionRelationship {
  factionAId: string;
  factionBId: string;
  type: 'alliance' | 'neutral' | 'rival' | 'enemy';
  weight: number;              // 0-100 intensity
}

/**
 * Factional Seed Configuration
 */
export interface FactionalSeed {
  factions: Faction[];
  relationships: FactionRelationship[];
}

/**
 * Matriarchal Genesis Template (DSS 16)
 * Extends WorldTemplate with gender-based mechanics and ancestral systems
 */
export interface MatriarchalGenesisTemplate extends WorldTemplate {
  /** Override type specifier */
  templateType: 'matriarchal-genesis';

  /** Matriarchal-specific configuration */
  matriarchalConfig: MatriarchalConfig;

  /** Womb-Magic talent configuration (Genesis-locked) */
  wombMagicConfig: WombMagicConfig;

  /** Ancestral Echo system configuration */
  ancestralEchoConfig: AncestralEchoConfig;

  /** Covenant system configuration */
  covenantConfig: CovenantConfig;

  /** Fuel generation and consumption rules */
  fuelSystem: FuelSystemConfig;
}

/**
 * Matriarchal Configuration: Gender-based social mechanics
 */
export interface MatriarchalConfig {
  /** Female characters get +15% ActionBudget bonus */
  femaleActionBudgetBonus: number;

  /** Male characters get -10% ActionBudget penalty */
  maleActionBudgetPenalty: number;

  /** Deity alignment for matriarchal bonuses */
  matriarchDeityId: string;

  /** Reputation multiplier when aligned with matriarch deity */
  deityAlignmentMultiplier: number;

  /** Lineage score thresholds and effects */
  lineageScoreThresholds: {
    unlockMatriarchalMandate: number;    // > 100
    standardAuthority: number;            // 75-100
    socialFriction: number;               // 50-75
    alienation: number;                   // < 50
  };

  /** Lineage decay rate (ticks per decay point) */
  lineageDecayTicksPerPoint: number;

  /** Matriarchal lineage score calculation formula */
  calculateLineageScore(options: {
    ancestryLeaning: number;  // +30 to +50
    chaModifier: number;      // +1 per CHA point above 10
    activeCovenants: number;  // +10 per covenant
    alliedFemaleWeight: number; // Social aggregation
  }): number;
}

/**
 * Womb-Magic Talent Configuration (Genesis-locked to matriarchal template)
 */
export interface WombMagicConfig {
  /** Unique talent ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Templates where this talent is available */
  worldTemplates: string[];

  /** Ancestries where this talent has full effectiveness */
  effectiveAncestries: string[];

  /** Gender preference (1.0 = female, 0.75 = non-female penalty applied) */
  genderEffectiveness: {
    female: number;
    nonBinary: number;
    male: number;
  };

  /** Stat modifiers when talent is active */
  modifiers: {
    healingOutput: number;     // +50% = 1.5
    maxMp: number;             // +50
    paradoxDebtReduction: number; // 0.05 = 5% per cast
  };

  /** Max level for this talent */
  levelCap: number;

  /** Requirements to learn this talent */
  learningReqs: {
    workstationRequired: string;
    baseRequirement: string;    // WIS > 12
    costPerLevel: string[];     // Array of resource costs
  };

  /** Cool-down enforcement (Patch 2) */
  cooldownTicks: number;

  /** Paradox reduction only applies if debt > threshold */
  paradoxThreshold: number;

  /** Max concurrent rituals per zone */
  maxConcurrentPerZone: number;
}

/**
 * Ancestral Echo Configuration
 */
export interface AncestralEchoConfig {
  /** Trigger conditions */
  triggers: {
    lineageBelowThreshold: number;  // < 50
    requiresRitual: boolean;
    paradoxThresholdRequired: number; // > 50
    requiresCovenant: string;       // Maternal Covenant
  };

  /** State machine timing (in ticks) */
  stateMachine: {
    dormantDuration: number;      // 20 ticks before re-trigger
    awakeningDuration: number;    // 1 tick
    activeDuration: number;       // 10 ticks of +2 CHA/WIS bonus
    fadingDuration: number;       // 5 ticks with -1 per tick
  };

  /** Bonus provided while active */
  activeBonus: {
    charisma: number;
    wisdom: number;
  };

  /** Lineage decay acceleration (Patch 1) */
  lineageDecayAcceleration: number;   // -2 per 4 hours
  exponentialDecayAfterEchos: number; // 5th+ echo triggers 2x multiplier
}

/**
 * Divine Covenant Types (DSS 16.4)
 */
export enum CovenantType {
  MATERNAL_SHIELD = 'maternal-shield',
  BLOODLINE_RESONANCE = 'bloodline-resonance',
  WOMB_SANCTUARY = 'womb-sanctuary',
  MATRONS_JUDGMENT = 'matrons-judgment',
  SOULS_REPRIEVE = 'souls-reprieve', // Patch 4 (NEW)
}

/**
 * Covenant Definition
 */
export interface Covenant {
  id: CovenantType;
  name: string;
  description: string;

  /** Requirements to bind this covenant */
  requirements: {
    minFaith: number;
    minLineage?: number;
    minStat?: keyof any;
    minStatValue?: number;
    minRitual?: number;
  };

  /** Mechanical benefits */
  benefits: {
    damageReduction?: number;
    detectionRange?: number;
    hpRegeneration?: number;
    dialogDcBonus?: number;
    sanityRestoration?: number;
  };

  /** Sanity cost per tick */
  sanityPerTick: number;

  /** Sanity restoration per tick (for recovery covenants like Soul's Reprieve) */
  sanityRecovery?: number;

  /** Whether this covenant requires meditation to be active */
  requiresMeditation?: boolean;
}

/**
 * Covenant Configuration Container
 */
export interface CovenantConfig {
  /** All available covenants */
  covenants: Record<CovenantType, Covenant>;

  /** Maximum active covenants per character */
  maxActive: number;

  /** Sanity drain multiplier when exceeding max covenants */
  exceedanceMultiplier: number;
}

/**
 * Fuel Generation and Consumption Rules
 */
export interface FuelSystemConfig {
  /** Fuel generation formula inputs */
  generation: {
    perTerritory: number;      // +5 per controlled location
    perCovenant: number;       // +10 per active covenant
    perFaith: number;          // +2 per faith point
    perPlayer: number;         // +3 per active player
    stabilityMultiplier: number; // Linear 0-40 scaling
  };

  /** Maximum fuel cap per day */
  dailyCapacity: number;        // 500

  /** Fuel consumption rules */
  consumption: {
    militaryConquest: number;
    divineGifts: { [key: string]: number };
    ancestralEchoAwakening: number;
    matriarchalEdict: number;
    territoryConsolidation: number;
  };

  /** Cool-down periods for large expenditures */
  cooldowns: {
    militaryConquest: number;      // 48 hours
    divineGifts: number;           // 12 hours
    ancestralEcho: number;         // 24 hours
    matriarchalEdict: number;      // 72 hours
    territoryConsolidation: number; // 6 hours
  };
}

/**
 * Matron Ascension Configuration (DSS 16.7)
 */
export interface MatronAscensionConfig {
  /** Requirements to become Matron */
  requirements: {
    minFaith: number;
    minLineage: number;
    minBlessings: number;
    maxParadoxDebt: number;
    wombMagicLevel: number;
    factionDominance: number;
  };

  /** Term duration in ticks (72 hours) */
  termDurationTicks: number;

  /** Grace period for succession in ticks (24 hours) */
  successionGracePeriodTicks: number;

  /** Fuel cost for ascension ritual */
  ritualFuelCost: number;

  /** Lineage inheritance bonus for new vessels */
  lineageInheritanceBonus: number;
}

/**
 * Create a default Matriarchal Genesis template
 */
export function createMatriarchalGenesisTemplate(): MatriarchalGenesisTemplate {
  return {
    templateId: 'matriarchal-genesis-v1',
    templateType: 'matriarchal-genesis',

    metadata: {
      name: 'The Matriarchal Enclave',
      description: 'A world seeded with female ancestral dominance and divine maternity',
      worldEpoch: 'Epoch I: Awakening',
      createdAt: new Date().toISOString(),
      version: 1.3,
      loreHighlights: [
        'Magic is rare and feared',
        'Matriarchal rule governs all settlements',
        'Ancestral bloodlines hold immense power',
        'The Great Mother watches all',
        'Covenants bind communities together',
      ],
    },

    globalConstants: {
      tickDuration: 1.5,
      ticksPerDay: 57600,
      ticksPerEpoch: 1440000,
      maxConcurrentPlayers: 32,
      initialParadoxDebt: 0,
      initialStability: 0.65,
      snapshotIntervalTicks: 600,
      maxArtifactsPerWorld: 500,
      tileSize: 2,
      gravityScale: 1.0,
      manaSaturation: 0.5,
      resourceGenerationMultiplier: 1.0,
      factionActionBudgetPerDay: 100,
      securityPatches: [],
    } as any,

    ancestryAvailability: [
      'human-bloodline-alpha',
      'elf-starborn',
      'dwarf-stonekin',
      'fae-moonborn',
    ],

    talentPool: [
      'ancestral-echo',
      'matriarchal-blessing',
      'bloodline-resonance',
      'womb-magic',
      'lunar-intuition',
    ] as any,

    divinePresence: [
      'deityid-great-mother',
      'deityid-moon-sovereign',
    ],

    economicModel: 'resource-chain-matriarchal-fertility',

    securityPatches: [
      'causal-lock-v1.2',
      'phase0-input-discard-v1.2',
      'lineage-decay-patch-1.3',
      'womb-magic-throttle-patch-2.0',
      'matron-term-limits-patch-3.2',
      'souls-reprieve-patch-4.1',
    ],

    factionalSeed: {
      factions: [
        {
          id: 'house-matriarch',
          name: 'House of the Eternal Mother',
          powerScore: 45,
          controlledLocationIds: ['temple-core', 'ancestral-sanctuary'],
          causalBudgetPerDay: 120,
          description: 'The primary matriarchal faction',
        },
      ],
      relationships: [
        {
          factionAId: 'house-matriarch',
          factionBId: 'lunar-sisterhood',
          type: 'alliance',
          weight: 85,
        },
      ],
    },

    matriarchalConfig: {
      femaleActionBudgetBonus: 0.15,
      maleActionBudgetPenalty: -0.1,
      matriarchDeityId: 'deityid-great-mother',
      deityAlignmentMultiplier: 1.1,
      lineageScoreThresholds: {
        unlockMatriarchalMandate: 100,
        standardAuthority: 75,
        socialFriction: 50,
        alienation: 50,
      },
      lineageDecayTicksPerPoint: 960, // -2 per 4 hours (960 ticks)
      calculateLineageScore(options) {
        return (
          options.ancestryLeaning +
          options.chaModifier +
          options.activeCovenants * 10 +
          options.alliedFemaleWeight
        );
      },
    },

    wombMagicConfig: {
      id: 'womb-magic',
      name: 'Womb Magic',
      description: 'Channel life-force from ancestral bloodlines to heal, summon, or restore the world.',
      worldTemplates: ['matriarchal-genesis-v1'],
      effectiveAncestries: ['human-bloodline-alpha', 'elf-starborn', 'fae-moonborn'],
      genderEffectiveness: {
        female: 1.0,
        nonBinary: 0.85,
        male: 0.75,
      },
      modifiers: {
        healingOutput: 1.5,
        maxMp: 50,
        paradoxDebtReduction: 0.05,
      },
      levelCap: 10,
      learningReqs: {
        workstationRequired: 'ancient-womb-altar',
        baseRequirement: 'WIS > 12',
        costPerLevel: ['ancestral-essence-x10', 'matriarchal-token-x5'],
      },
      cooldownTicks: 2400, // 1 hour
      paradoxThreshold: 50,
      maxConcurrentPerZone: 2,
    },

    ancestralEchoConfig: {
      triggers: {
        lineageBelowThreshold: 50,
        requiresRitual: true,
        paradoxThresholdRequired: 50,
        requiresCovenant: 'maternal-covenant',
      },
      stateMachine: {
        dormantDuration: 20,
        awakeningDuration: 1,
        activeDuration: 10,
        fadingDuration: 5,
      },
      activeBonus: {
        charisma: 2,
        wisdom: 2,
      },
      lineageDecayAcceleration: 2,
      exponentialDecayAfterEchos: 5,
    },

    covenantConfig: {
      covenants: {
        [CovenantType.MATERNAL_SHIELD]: {
          id: CovenantType.MATERNAL_SHIELD,
          name: 'Maternal Shield',
          description: 'Divine protection from the Great Mother',
          requirements: { minFaith: 30 },
          benefits: { damageReduction: 0.25 },
          sanityPerTick: 2,
        },
        [CovenantType.BLOODLINE_RESONANCE]: {
          id: CovenantType.BLOODLINE_RESONANCE,
          name: 'Bloodline Resonance',
          description: 'Ancestral awareness of threats',
          requirements: { minFaith: 0 },
          benefits: { detectionRange: 50 },
          sanityPerTick: 1,
        },
        [CovenantType.WOMB_SANCTUARY]: {
          id: CovenantType.WOMB_SANCTUARY,
          name: 'Womb Sanctuary',
          description: 'Sanctuary of healing and restoration',
          requirements: { minFaith: 0 },
          benefits: { hpRegeneration: 5 },
          sanityPerTick: 3,
        },
        [CovenantType.MATRONS_JUDGMENT]: {
          id: CovenantType.MATRONS_JUDGMENT,
          name: "Matron's Judgment",
          description: 'Authority in discourse',
          requirements: { minFaith: 0 },
          benefits: { dialogDcBonus: 3 },
          sanityPerTick: 0,
        },
        [CovenantType.SOULS_REPRIEVE]: {
          id: CovenantType.SOULS_REPRIEVE,
          name: "Soul's Reprieve",
          description: 'Meditation-based Sanity recovery',
          requirements: { minFaith: 50 },
          benefits: { sanityRestoration: 3 },
          sanityPerTick: 0,
          sanityRecovery: 3,
          requiresMeditation: true,
        },
      },
      maxActive: 5,
      exceedanceMultiplier: 1.5,
    },

    fuelSystem: {
      generation: {
        perTerritory: 5,
        perCovenant: 10,
        perFaith: 2,
        perPlayer: 3,
        stabilityMultiplier: 40,
      },
      dailyCapacity: 500,
      consumption: {
        militaryConquest: 50,
        divineGifts: { miracle: 100 },
        ancestralEchoAwakening: 75,
        matriarchalEdict: 120,
        territoryConsolidation: 30,
      },
      cooldowns: {
        militaryConquest: 172800, // 48 hours in ticks
        divineGifts: 43200,       // 12 hours
        ancestralEcho: 86400,     // 24 hours
        matriarchalEdict: 259200, // 72 hours
        territoryConsolidation: 21600, // 6 hours
      },
    },

    startingLocations: [
      {
        id: 'startingVillage',
        name: 'Eldergrove Village',
        description: 'A peaceful forest settlement nestled between ancient oaks. Home to the Maternal Sanctuary.',
        coordinates: { x: 12, y: 12 },
        recommendedArchetypes: ['forest-hermit', 'wandering-scholar'],
        faction: 'house-matriarch',
        loreContext: 'The heart of the Matriarchal Enclave, where the Great Mother\'s presence is strongest.',
      },
      {
        id: 'luminaMarket',
        name: 'Luminara Grand Market',
        description: 'A bustling cosmopolitan hub where traders, adventurers, and merchants gather.',
        coordinates: { x: 25, y: 18 },
        recommendedArchetypes: ['exiled-noble', 'shadow-thief', 'battlefield-veteran'],
        faction: 'house-matriarch',
        loreContext: 'The commercial center of the realm, where gold flows as freely as the river.',
      },
      {
        id: 'moonwellShrine',
        name: 'Moonwell Shrine',
        description: 'A mystical location where the veil between worlds grows thin. Scholars gather here to study the arcane.',
        coordinates: { x: 8, y: 30 },
        recommendedArchetypes: ['wandering-scholar', 'forest-hermit'],
        faction: 'house-matriarch',
        loreContext: 'A place of power where magic flows more freely than elsewhere in the realm.',
      },
      {
        id: 'forgeSummit',
        name: 'Forge Summit',
        description: 'An isolated mountain stronghold known for master craftspeople and their legendary forges.',
        coordinates: { x: 35, y: 8 },
        recommendedArchetypes: ['cursed-smith', 'battlefield-veteran'],
        faction: 'house-matriarch',
        loreContext: 'The forge burns eternal, fed by both fire and ancestral will.',
      },
    ],
  } as MatriarchalGenesisTemplate;
}

/**
 * Validate a template against schema requirements
 */
export function validateTemplate(template: WorldTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.templateId || template.templateId.trim() === '') {
    errors.push('templateId is required');
  }

  if (!template.metadata || !template.metadata.name) {
    errors.push('metadata.name is required');
  }

  if (!template.globalConstants) {
    errors.push('globalConstants is required');
  }

  if (!Array.isArray(template.ancestryAvailability) || template.ancestryAvailability.length === 0) {
    errors.push('ancestryAvailability must be a non-empty array');
  }

  if (!Array.isArray(template.talentPool) || template.talentPool.length === 0) {
    errors.push('talentPool must be a non-empty array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
