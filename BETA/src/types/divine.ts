/**
 * Divine System Schemas (Phase 3 - DSS 06)
 * 
 * Implements deity interactions, covenant mechanics, and faith accumulation.
 * Integrates with:
 * - DSS 06: Divine systems, faith mass decay, miracle costs, covenant mechanics
 * - DSS 16: Matriarchal Genesis template with Great Mother deity
 * - Soul's Reprieve covenant for sanity recovery
 * 
 * Core Concept: Deities are active participants that grant boons and demand tribute.
 * Faith Mass accumulates in deities and is spent on miracles and covenants.
 */

/**
 * Deity Type: A divine entity in the game world
 */
export interface Deity {
  /** Unique deity ID */
  id: string;

  /** Deity name */
  name: string;

  /** Divine domain (e.g., "Death", "Motherhood", "Trickery") */
  domain: string;

  /** Alignment/personality */
  alignment: 'lawful' | 'neutral' | 'chaotic';

  /** Whether this deity is actively present in world */
  isActive: boolean;

  /** Threshold after which deity begins intervening */
  faithThreshold: number;  // Typically 100 or 200

  /** Total faith mass currently accumulated in this deity (0-10000) */
  totalFaithMass: number;

  /** Faith mass by worshipper (character ID -> faith points) */
  faithByWorshipper: Map<string, number>;

  /** Whether miracles can be requested (true if active and > threshold) */
  canGrantMiracles: boolean;

  /** Cost in faith to request a miracle */
  miracleCost: number;

  /** Description of this deity's nature */
  description?: string;

  /** Tick when this deity was introduced to world */
  createdAtTick: number;

  /** Last miracle granted by this deity */
  lastMiracleTick?: number;
}

/**
 * Miracle: A divine intervention requested at a cost
 * 
 * Examples:
 * - Heal a character (costs 50 faith)
 * - Bless a territory (costs 75 faith)
 * - Reveal hidden locations (costs 60 faith)
 * - Boost a faction's military (costs 100 faith)
 */
export interface Miracle {
  /** Unique miracle ID */
  id: string;

  /** Deity granting the miracle */
  deityId: string;

  /** Type of miracle */
  type: 'heal' | 'blessing' | 'revelation' | 'summoning' | 'transmutation' | 'protection' | 'restoration';

  /** Cost in faith mass */
  cost: number;

  /** Character or faction requesting the miracle */
  requestorId: string;

  /** Target of the miracle (character ID, faction ID, location ID, etc) */
  targetId?: string;

  /** Effect parameters (JSON-encoded) */
  effect: Record<string, any>;

  /** When the miracle was granted */
  grantedAtTick: number;

  /** Duration of effect (in ticks, 0 = instant) */
  durationTicks: number;

  /** Whether miracle is currently active */
  isActive: boolean;
}

/**
 * Covenant: A binding agreement between character/faction and deity
 * 
 * Covenants provide passive bonuses but require ongoing faith maintenance
 * and sometimes impose restrictions or quests.
 */
export interface Covenant {
  /** Unique covenant ID */
  id: string;

  /** Type of covenant */
  type:
    | 'soul-reprieve'           // DSS 06: Sanity recovery
    | 'maternal-blessing'       // DSS 16: Matriarchal bonus
    | 'ancestral-echo'          // DSS 16: Echo awakening boost
    | 'divine-protection'       // Damage reduction
    | 'faith-amplification'     // Faith generation multiplier
    | 'other';

  /** Deity this covenant is with */
  deityId: string;

  /** Character or faction bound by this covenant */
  binderId: string;

  /** Initial cost in faith to establish covenant */
  initiationCost: number;

  /** Ongoing maintenance cost per day */
  maintenanceCostPerTick: number;

  /** Whether covenant is currently active */
  isActive: boolean;

  /** Bonuses granted by this covenant */
  bonuses: {
    /** CSanity recovery rate per tick (if soul-reprieve) */
    sanityRecoveryPerTick?: number;

    /** CHA bonus (if maternal-blessing) */
    chaBonus?: number;

    /** Damage reduction % (if divine-protection) */
    damageReduction?: number;

    /** Faith generation multiplier */
    faithMultiplier?: number;

    /** Custom bonuses (string -> value map) */
    custom?: Record<string, number>;
  };

  /** Restrictions imposed by covenant (e.g., cannot harm priests) */
  restrictions: string[];

  /** Quests required to maintain covenant */
  requiredQuests: string[];

  /** When covenant was established */
  establishedAtTick: number;

  /** When covenant expires (0 = indefinite) */
  expirationTick: number;

  /** Last time maintenance was paid */
  lastMaintenanceTick: number;

  /** Description of covenant terms */
  description?: string;
}

/**
 * Soul's Reprieve Covenant (DSS 06 + Sanity Recovery)
 * 
 * A Matriarchal Genesis specific covenant that trades faith
 * for continuous sanity recovery
 */
export interface SoulsReprieveCovenant extends Covenant {
  type: 'soul-reprieve';

  /** Sanity recovery per tick while active */
  sanityRecoveryPerTick: number;

  /** Sanity cap (won't recover past this value) */
  sanityRecoveryCap: number;

  /** Temporary sanity boost on activation */
  initialSanityRestore: number;

  /** Whether active sanity check is in progress */
  hasActiveSanityCheck: boolean;

  /** Last sanity lost from paradox */
  lastParadoxSanityLoss?: number;
}

/**
 * Faith Mass Tracker: Tracks faith accumulation and decay
 * 
 * Formula (DSS 06):
 * Daily Faith Generation = (Territory Coverage × 5) + (Active Covenants × 10) + (Player Faith Acts × 2)
 * Daily Decay = (Total Faith × 0.01)  [1% natural decay per day]
 */
export interface FaithMassTracker {
  /** Deity being tracked */
  deityId: string;

  /** Character/Faction accumulating faith */
  worshipperId: string;

  /** Current faith points (0-10000) */
  current: number;

  /** Maximum capacity */
  capacity: number;

  /** Daily generation rate (average) */
  generationBreakdown: {
    territoryControl: number;      // +5 per controlled location
    covenantParticipation: number; // +10 per active covenant
    faithfulActs: number;          // +2 per beneficial player action
    rituals: number;               // +50 per ritual performed
  };

  /** Daily decay rate (typically 1% of current) */
  decayPerDay: number;

  /** Tick when last generation/decay was applied */
  lastTickProcessed: number;

  /** Covenant IDs this faith supports */
  supportedCovenantIds: string[];

  /** Major faith events in history */
  history: Array<{
    type: 'ritual' | 'miracle' | 'covenant' | 'decay' | 'generation';
    tick: number;
    delta: number;
    description: string;
  }>;
}

/**
 * Divine Alignment: How aligned a character is with a specific deity
 */
export interface DivineAlignment {
  /** Deity ID */
  deityId: string;

  /** Character ID */
  characterId: string;

  /** Alignment score (-100 to +100) */
  score: number;

  /** Active covenants with this deity */
  activeCovenantIds: string[];

  /** Total faith contributed to this deity */
  totalFaithContributed: number;

  /** Number of miracles received from this deity */
  miraclesReceived: number;

  /** Whether character is considered a "chosen" of this deity */
  isChosen: boolean;

  /** Special boons from deity (if any) */
  divineGifts: string[];
}

/**
 * Divine Intervention Event: Records when deity acts in world
 */
export interface DivineIntervention {
  /** Unique event ID */
  id: string;

  /** Deity involved */
  deityId: string;

  /** Type of intervention */
  type: 'miracle' | 'punishment' | 'blessing' | 'curse' | 'revelation' | 'manifestation';

  /** Target (character, faction, location, or null for global) */
  targetId?: string;

  /** What happened */
  description: string;

  /** Consequences/effects */
  effects: Record<string, any>;

  /** When it occurred */
  tick: number;

  /** Whether event is public knowledge */
  isPublic: boolean;

  /** Whether event is reversible */
  isReversible: boolean;
}

/**
 * Great Mother Deity (DSS 16 Genesis Template)
 * Specialized deity for Matriarchal Genesis worlds
 */
export interface GreatMotherDeity extends Deity {
  id: 'great-mother';
  name: 'The Great Mother';
  domain: 'Motherhood, Life, Ancestry';
  alignment: 'lawful';

  /** Whether she grants boons to female-led factions */
  favorsMatriarchy: boolean;

  /** Reputation multiplier for matriarchal factions */
  matriarchialBonusMultiplier: number;  // Typically 1.1 (+10%)

  /** Available miracles unique to Great Mother */
  uniqueMiracles: {
    ancestralEchoAwakening: boolean;           // Mass awakening of ancestral echoes
    womKindnessFertility: boolean;             // Blessing on lineage/birthrate
    maternalInterposition: boolean;            // Protect females from harm
    inheritanceReaffirmation: boolean;         // Restore matriarchal lineage score
  };
}

/**
 * Helper function: Calculate daily faith generation
 * 
 * Formula (DSS 06):
 * Faith Gen = (Territory × 5) + (Active Covenants × 10) + (Player Acts × 2) + (Rituals × 50)
 */
export function calculateDailyFaithGeneration(options: {
  territoryControlledCount: number;
  activeCovenantCount: number;
  faithfulActsCount: number;
  ritualsPerformedCount: number;
}): number {
  return (
    options.territoryControlledCount * 5 +
    options.activeCovenantCount * 10 +
    options.faithfulActsCount * 2 +
    options.ritualsPerformedCount * 50
  );
}

/**
 * Helper function: Calculate faith decay
 * 
 * 1% per day of current faith mass
 */
export function calculateDailyFaithDecay(currentFaith: number): number {
  return Math.floor(currentFaith * 0.01);
}

/**
 * Helper function: Check  if faith mass can support miracles
 */
export function canGrantMiracle(deity: Deity, miracles: Miracle[]): boolean {
  // Must be active and above threshold
  if (!deity.isActive || deity.totalFaithMass < deity.faithThreshold) {
    return false;
  }

  // Can't grant miracles too frequently
  if (deity.lastMiracleTick !== undefined) {
    const daysSinceLastMiracle = Math.floor((Date.now() / 1000 - deity.lastMiracleTick) / 86400);
    if (daysSinceLastMiracle < 1) {
      return false;  // Max 1 miracle per day
    }
  }

  return true;
}

/**
 * Helper function: Create a Soul's Reprieve Covenant
 */
export function createSoulsReprieveCovenant(options: {
  deityId: string;
  binderId: string;
  initiationCost?: number;
  sanityRecoveryPerTick?: number;
  sanityRecoveryCap?: number;
  initialSanityRestore?: number;
}): SoulsReprieveCovenant {
  return {
    id: `soul-reprieve-${options.binderId}`,
    type: 'soul-reprieve',
    deityId: options.deityId,
    binderId: options.binderId,
    initiationCost: options.initiationCost || 100,
    maintenanceCostPerTick: 1,  // 1 faith per tick
    isActive: true,
    bonuses: {
      sanityRecoveryPerTick: options.sanityRecoveryPerTick || 0.1,
      custom: {},
    },
    restrictions: [],
    requiredQuests: [],
    establishedAtTick: 0,
    expirationTick: 0,
    lastMaintenanceTick: 0,
    sanityRecoveryPerTick: options.sanityRecoveryPerTick || 0.1,
    sanityRecoveryCap: options.sanityRecoveryCap || 100,
    initialSanityRestore: options.initialSanityRestore || 20,
    hasActiveSanityCheck: false,
  };
}

/**
 * Helper function: Create Faith Mass Tracker
 */
export function createFaithMassTracker(
  deityId: string,
  worshipperId: string,
  capacity: number = 1000
): FaithMassTracker {
  return {
    deityId,
    worshipperId,
    current: 0,
    capacity,
    generationBreakdown: {
      territoryControl: 0,
      covenantParticipation: 0,
      faithfulActs: 0,
      rituals: 0,
    },
    decayPerDay: 0,
    lastTickProcessed: 0,
    supportedCovenantIds: [],
    history: [
      {
        type: 'generation',
        tick: 0,
        delta: 0,
        description: 'Faith tracker initialized',
      },
    ],
  };
}

/**
 * Helper function: Create Great Mother Deity for Genesis Template
 */
export function createGreatMotherDeity(): GreatMotherDeity {
  return {
    id: 'great-mother',
    name: 'The Great Mother',
    domain: 'Motherhood, Life, Ancestry',
    alignment: 'lawful',
    isActive: true,
    faithThreshold: 150,
    totalFaithMass: 0,
    faithByWorshipper: new Map(),
    canGrantMiracles: false,
    miracleCost: 100,
    description: 'The primordial divine force of creation, nurturing, and ancestral wisdom',
    createdAtTick: 0,
    favorsMatriarchy: true,
    matriarchialBonusMultiplier: 1.1,
    uniqueMiracles: {
      ancestralEchoAwakening: true,
      womKindnessFertility: true,
      maternalInterposition: true,
      inheritanceReaffirmation: true,
    },
  };
}
