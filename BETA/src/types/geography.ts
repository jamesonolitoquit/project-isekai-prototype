/**
 * Geography System Schemas (Phase 3 - DSS 05)
 * 
 * Implements territory control, regional stability, and information lag mechanics.
 * Integrates with:
 * - DSS 05: Territory ownership, stability metrics, tax formulas, fog of war
 * - FrictionManager: Information lag perception system
 * 
 * Core Concept: Territories are regions controlled by factions. Each territory has:
 * - Stability (affects resource generation and tax collection)
 * - Information Lag (fog of war overlaid on region)
 * - Population/vitals decay influenced by region hazards
 */

/**
 * Stability Metric: Measures how stable a territory is (0-100)
 * 
 * Stability affects:
 * - Resource generation rate
 * - Tax collection efficiency
 * - NPC morale and population growth
 * - Information clarity (higher stab = less fog)
 */
export interface StabilityMetric {
  /** Current stability score (0-100) */
  current: number;

  /** Maximum possible stability */
  max: number;

  /** Sources of stability loss */
  threatLevel: number;          // Rival factions nearby (-5 to -30)
  insurgentPopulation: number;  // % of locals opposing control (-2 to -20)
  economicDisruption: number;   // From wars/disasters (-5 to -50)
  demoralizedPopulation: number; // From poor tax rates (-2 to -15)

  /** Natural recovery rate (per tick) */
  recoveryRate: number;         // Typically 0.1-0.5 per tick

  /** When stability was last recalculated */
  lastUpdateTick: number;

  /** Trend over last 100 ticks (for UI) */
  trend: 'improving' | 'stable' | 'declining' | 'critical';
}

/**
 * Information Lag at Territory Level (DSS 05 + Fog of War)
 * 
 * Overlays on top of player's individual perception lag.
 * Represents regional "darkness" or obscurity:
 * - High mountains = limited visibility
 * - Dense forests = hard to map
 * - Political instability = rumors and misinformation
 */
export interface TerritoryInformationLag {
  /** Base fog of war multiplier (0-1) */
  baseMultiplier: number;

  /** Environmental contribution (terrain, weather) */
  environmentalModifier: number;

  /** Political obscurity (instability, spies, secrets) */
  politicalModifier: number;

  /** Divine obscurity (high faith in deity = clearer visions) */
  divineModifier: number;

  /** Composite fog (used in perception filters) */
  composite: number;  // Combined = base * (env + political + divine)

  /** Locations within territory that are especially hidden */
  hiddenLocations: string[];
}

/**
 * Tax System: How much a territory generates per tick/day
 * (DSS 05: Resource yield formulas)
 */
export interface TaxSystem {
  /** Tax rate (0-1.0, where 1.0 = 100%+ exploitation) */
  rate: number;

  /** Monthly tax revenue (rough estimate) */
  expectedMonthlyRevenue: number;

  /** Whether locals are paying willingly or through force */
  compliance: 'cooperative' | 'resentful' | 'defiant' | 'rebellious';

  /** Locals' willingness to pay (0-100) */
  willingness: number;

  /** If willingness < 20, insurgency risk increases */
  insurgencyRisk: number;

  /** Tick when tax system was last audited */
  lastAuditTick: number;
}

/**
 * Regional Hazards: Factors affecting character vitals decay in territory
 * (Integrates with FrictionManager vitals decay)
 */
export interface RegionalHazard {
  /** Hazard ID (e.g., "desert-heat", "mountain-cold", "swamp-disease") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Type of hazard */
  type: 'climate' | 'disease' | 'radiation' | 'magic' | 'political';

  /** Vigor decay multiplier (1.5x = 50% faster) */
  vigorDecayMultiplier: number;

  /** Nourishment decay multiplier */
  nourishmentDecayMultiplier: number;

  /** Sanity decay multiplier */
  sanityDecayMultiplier: number;

  /** Whether player can adapt (reduce multiplier over time) */
  canAdapt: boolean;

  /** Adaptation period (ticks to reach 50% reduced effect) */
  adaptationTicksPeriod?: number;
}

/**
 * Territory Node: A single region in the game world
 * 
 * Can be:
 * - A city/settlement
 * - A wilderness area
 * - A sacred site
 * - A military stronghold
 * - A trade hub
 * - A hidden ruin
 */
export interface TerritoryNode {
  // -- Identity --
  id: string;
  name: string;
  nodeType: 'settlement' | 'wilderness' | 'shrine' | 'stronghold' | 'hub' | 'ruin' | 'other';
  description?: string;

  // -- Ownership & Control --
  controllingFactionId?: string;    // undefined if neutral/unclaimed
  influenceMap: Map<string, number>; // factionId -> influence (0-100)
  isFactionCapital: boolean;        // If true, faction loses if this falls
  lastControlChangeTicket: number;

  // -- Geography & Hazards --
  biome: 'grassland' | 'forest' | 'desert' | 'mountain' | 'swamp' | 'urban' | 'coast' | 'other';
  hazards: RegionalHazard[];
  elevation: number;  // -100 to +100 (affects weather/resources)
  accessibility: number; // 0-100 (how easy to reach/patrol)

  // -- Territory Metrics --
  stability: StabilityMetric;
  informationLag: TerritoryInformationLag;
  taxSystem?: TaxSystem;  // Only if controlled by faction

  // -- Resources & Population --
  population: number;        // Rough count of inhabitants
  populationModifier: number; // Multiplier from events/morale
  resourceNodes: {
    wood: number;
    metal: number;
    herbs: number;
    water: number;
  };
  resourceRegenerationRate: number;  // 0-1 scale

  // -- Divine Properties --
  holinessLevel: number;     // 0-100 (affects miracles/faith generation)
  isHallowedSite: boolean;   // True if deity-aligned shrine
  alignedDeityId?: string;   // Deity this shrine/site favors

  // -- Connections & Trading --
  connectedLocationIds: string[];  // Nearby territories
  tradeValue: number;        // Hub desirability (0-100)
  tradingPartnerFactionIds: string[];

  // -- Military & Defense --
  garrisonSize: number;      // NPC soldiers
  fortificationLevel: number; // 0-5 (affects defense)
  militaryStrategy?: string;  // "defensive", "offensive", "trade-focused"

  // -- Temporal Tracking --
  createdAtTick: number;
  lastUpdatedTick: number;
  ticksSinceLastConflict: number;

  // -- Events & Narrative --
  recentEvents: Array<{
    type: string;
    description: string;
    tick: number;
  }>;

  // -- Metadata --
  isPlayerControlled: boolean;
  isPlayerHome: boolean;
  unexploredPOIs: string[];  // Points of interest not yet visited
}

/**
 * Region: A macro-grouping of related TerritoryNodes
 * (Used for city/region UI and large-scale faction operations)
 */
export interface Region {
  /** Region ID */
  id: string;

  /** Human name */
  name: string;

  /** Territory nodes in this region */
  territoryNodeIds: string[];

  /** Dominant controlling faction (if any) */
  dominantFactionId?: string;

  /** Regional stability (average of contained nodes) */
  regionalStability: number;

  /** Regional information lag (average + political factors) */
  regionalFog: TerritoryInformationLag;

  /** Control rating (% of territory controlled by dominant faction) */
  controlRating: number;

  /** Overall threat level (0-100) */
  threatLevel: number;

  /** When this region was last fully surveyed */
  lastSurveyTick: number;
}

/**
 * Territory Influence Event: Tracks changes in faction control
 */
export interface TerritoryInfluenceEvent {
  /** Event ID */
  id: string;

  /** Territory affected */
  territoryNodeId: string;

  /** Faction involved */
  factionId: string;

  /** Type of event */
  type: 'gained_influence' | 'lost_influence' | 'gained_control' | 'lost_control' | 'challenged';

  /** Influence/control change amount */
  delta: number;

  /** What caused the event */
  cause: string;  // "military_action", "tax_evasion", "trade_mission", "divine_miracle", etc

  /** When event occurred */
  tick: number;

  /** Secondary faction involved (if applicable) */
  secondaryFactionId?: string;

  /** Whether this caused a territory flip */
  causedFactionChange: boolean;
}

/**
 * Helper function: Calculate territory control threshold
 * 
 * Returns the influence level needed to control a territory
 * Base: 60+, but affected by region stability and faction rep
 */
export function getControlThreshold(territory: TerritoryNode, factionReputation?: number): number {
  let threshold = 60;

  // Stability matters
  threshold += (100 - territory.stability.current) * 0.1;  // Unstable = harder to take

  // Reputation can help
  if (factionReputation !== undefined && factionReputation > 0) {
    threshold -= Math.min(factionReputation * 0.1, 10);  // Up to -10 bonus
  }

  return Math.max(threshold, 30);  // Never below 30
}

/**
 * Helper function: Calculate territory tax revenue
 * 
 * Formula: (population × 5) × (stability / 100) × (taxRate) × willingness_factor
 */
export function calculateTaxRevenue(territory: TerritoryNode): number {
  if (!territory.taxSystem) return 0;

  const baseRevenue = territory.population * 5;
  const stabilityFactor = territory.stability.current / 100;
  const taxFactor = territory.taxSystem.rate;
  const willingnessFactor = territory.taxSystem.willingness / 100;

  return Math.floor(baseRevenue * stabilityFactor * taxFactor * willingnessFactor);
}

/**
 * Helper function: Update territory stability based on factors
 */
export function updateTerritoryStability(
  territory: TerritoryNode,
  deltaPerTick: number,
  currentTick: number
): void {
  const oldStability = territory.stability.current;

  // Apply delta
  territory.stability.current = Math.max(0, Math.min(100, territory.stability.current + deltaPerTick));

  // Update trend
  if (territory.stability.current > oldStability + 2) {
    territory.stability.trend = 'improving';
  } else if (territory.stability.current < oldStability - 2) {
    territory.stability.trend = 'declining';
  } else {
    territory.stability.trend = 'stable';
  }

  if (territory.stability.current < 20) {
    territory.stability.trend = 'critical';
  }

  territory.stability.lastUpdateTick = currentTick;
}

/**
 * Helper function: Get vitals decay multipliers for a territory
 */
export function getVitalsDecayMultipliers(territory: TerritoryNode): {
  vigor: number;
  nourishment: number;
  sanity: number;
} {
  let vigMultiplier = 1.0;
  let nourMultiplier = 1.0;
  let sanityMultiplier = 1.0;

  // Apply hazard multipliers
  for (const hazard of territory.hazards) {
    vigMultiplier *= hazard.vigorDecayMultiplier;
    nourMultiplier *= hazard.nourishmentDecayMultiplier;
    sanityMultiplier *= hazard.sanityDecayMultiplier;
  }

  // Stability affects nourishment (better stability = better food production)
  const stabilityFactor = 0.5 + territory.stability.current / 200;  // 0.5 to 1.0
  nourMultiplier *= stabilityFactor;

  // HolynessLevel affects sanity (holy sites = more stable mind)
  const holyFactor = 1.0 - territory.holinessLevel / 500;  // -0.2 at max holiness
  sanityMultiplier *= Math.max(0.5, holyFactor);

  return {
    vigor: vigMultiplier,
    nourishment: nourMultiplier,
    sanity: sanityMultiplier,
  };
}

/**
 * Helper function: Calculate composite information lag for territory
 */
export function calculateTerritoryInformationLag(territory: TerritoryNode): number {
  const stability = territory.stability.current / 100;
  const fog = territory.informationLag;

  // Higher stability = less fog
  const stabilityFactor = 1.0 - stability * 0.3;

  // Compute composite
  const composite = fog.baseMultiplier * (fog.environmentalModifier + fog.politicalModifier + fog.divineModifier) * stabilityFactor;

  return Math.max(0, Math.min(1, composite));
}

/**
 * Helper function: Create a new territory node
 */
export function createTerritoryNode(options: {
  id: string;
  name: string;
  nodeType: TerritoryNode['nodeType'];
  biome: TerritoryNode['biome'];
  population?: number;
  isFactionCapital?: boolean;
}): TerritoryNode {
  return {
    id: options.id,
    name: options.name,
    nodeType: options.nodeType,
    biome: options.biome,
    description: '',
    controllingFactionId: undefined,
    influenceMap: new Map(),
    isFactionCapital: options.isFactionCapital || false,
    lastControlChangeTicket: 0,
    hazards: [],
    elevation: 0,
    accessibility: 50,
    stability: {
      current: 75,
      max: 100,
      threatLevel: 0,
      insurgentPopulation: 0,
      economicDisruption: 0,
      demoralizedPopulation: 0,
      recoveryRate: 0.2,
      lastUpdateTick: 0,
      trend: 'stable',
    },
    informationLag: {
      baseMultiplier: 0.3,
      environmentalModifier: 1.0,
      politicalModifier: 1.0,
      divineModifier: 1.0,
      composite: 0.3,
      hiddenLocations: [],
    },
    population: options.population || 100,
    populationModifier: 1.0,
    resourceNodes: { wood: 50, metal: 30, herbs: 40, water: 100 },
    resourceRegenerationRate: 0.5,
    holinessLevel: 0,
    isHallowedSite: false,
    connectedLocationIds: [],
    tradeValue: 50,
    tradingPartnerFactionIds: [],
    garrisonSize: 0,
    fortificationLevel: 0,
    createdAtTick: 0,
    lastUpdatedTick: 0,
    ticksSinceLastConflict: 0,
    recentEvents: [],
    isPlayerControlled: false,
    isPlayerHome: false,
    unexploredPOIs: [],
  };
}
