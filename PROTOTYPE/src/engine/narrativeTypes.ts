/**
 * Phase 25 Task 2: Absolute Narrative Types
 * 
 * Central source of truth for all narrative/memory/belief interfaces.
 * Prevents circular dependencies and consolidates type definitions for:
 * - NPC memories (UniversalInteraction)
 * - Social bonds (SocialScar)
 * - Relationship tiers (RelationshipTierData)
 * - Belief registry (HardFact, Rumor, Belief system)
 * - Global social tension calculation
 */

/**
 * M44-T1/C1: Interaction between any two entities (player↔NPC or NPC↔NPC)
 * Represents memories, conversations, and significant moments
 */
export interface UniversalInteraction {
  timestamp: number;              // world tick when interaction occurred
  observerNpcId: string;          // who remembers this
  subjectId: string;              // who the memory is about (playerId or npcId)
  subjectType: 'player' | 'npc';  // type of subject
  action: string;                 // e.g., "betrayed", "saved", "helped", "insulted", "sabotaged_plan"
  sentiment: number;              // -1.0 (very negative) to +1.0 (very positive)
  impactScore: number;            // 0.0 to 1.0 - how much this memory weighs
  description: string;            // human-readable description of the event
  propagated?: boolean;           // true if this is a gossip-derived memory
}

/**
 * Phase 25 Task 2: Social Scar - Persisting grudges, debts, and favors
 * Represents lasting emotional damage/bonds from significant events
 * Includes temporal expiration to model memory decay
 * Phase 28 Task 2: Added originLocationId to track migrations during recessions
 */
export interface SocialScar {
  type: 'grudge' | 'debt' | 'favor';  // nature of the scar
  severity: number;                    // 0.0 to 1.0 - intensity of the scar
  memoryIds: string[];                 // references to contributing UniversalInteractions
  originTick: number;                  // when this scar was first created
  expirationTick: number;              // when this scar naturally expires (tick-based decay)
  lastReinforced: number;              // tick of most recent reinforcement (extends expiration)
  subjectId: string;                   // ID of the NPC this scar relates to
  scarId?: string;                     // optional unique identifier (npcId-type-subjectId)
  originLocationId?: string;           // Phase 28 Task 2: Where did the NPC migrate from (economic migration tracking)
}

/**
 * M44-C1: Explicit relationship tier between two entities
 * Summarizes the overall state: Ally, Neutral, Rival, or Enemy
 */
export interface RelationshipTierData {
  tier: 'Ally' | 'Neutral' | 'Rival' | 'Enemy';  // relationship state
  relatedScar?: SocialScar;                        // underlying scar (e.g., Ally backed by "favor")
  aliases?: {
    onAllyBehavior?: string;     // e.g., "provides_intel_buff"
    onRivalBehavior?: string;    // e.g., "sabotages_player_actions"
    onEnemyBehavior?: string;    // e.g., "attacks_on_sight"
  };
}

/**
 * Phase 25 Task 2: Global Narrative State snapshot
 * Summarizes the overall social/emotional state of the world
 */
export interface NarrativeState {
  globalSocialTension: number;      // 0.0 - 1.0, how fractured is NPC society
  activeGrudges: number;            // count of active grudges in the world
  activeFavors: number;             // count of active favors in the world
  activeDebts: number;              // count of active debts in the world
  avgScarSeverity: number;          // average severity of all scars (0.0 - 1.0)
  relationshipTierDistribution: {
    allies: number;                 // count of Ally relationships
    neutrals: number;               // count of Neutral relationships
    rivals: number;                 // count of Rival relationships
    enemies: number;                // count of Enemy relationships
  };
  timestamp: number;                // tick when this snapshot was created
}

/**
 * M45-A1: Hard Fact - An event that actually occurred in the world
 * Foundation for the belief system; rumors are distorted versions of facts
 */
export interface HardFact {
  id: string;
  eventType: 'death' | 'siege' | 'miracle' | 'catastrophe' | 'discovery' | 'treaty' | 'betrayal';
  description: string;
  originLocationId: string;
  originEpochTick: number;
  factionIds: string[];             // Factions involved
  severity: number;                 // 0-100, how important this fact is
  truthRadius: number;              // How far the truth spreads before noise takes over
  truthDecayRate: number;            // How quickly confidence drops with distance (0-1)
  timestamp: number;
  discoveredByPlayerId?: string;
}

/**
 * M45-A1: Rumor - A noisy/distorted version of a hard fact
 * Created when NPCs in distant regions retell stories
 */
export interface Rumor {
  id: string;
  originalFactId: string;
  description: string;              // Noisy version of the description
  claimedLocationId: string;         // Wrong location (closer to rumor source)
  claimedFactionIds: string[];       // May include wrong factions
  confidenceLevel: number;           // 0-100, how sure the NPC is about this rumor
  distanceFromOrigin: number;        // Geographic distance from where event occurred
  factionRelevance: number;          // How relevant this rumor is to the NPC's faction
  createdAt: number;
  spreadsToLocations: string[];      // Which locations have heard this rumor
  sourceNpcIds: string[];            // NPCs who told this rumor
}

/**
 * M45-A1: Perception Level - How much truth can a character access?
 * Based on faction rank, magical knowledge, research, etc.
 */
export interface PerceptionLevel {
  playerId: string;
  level: number;                     // 0-100
  sources: {
    factionRank: number;
    secretsKnowledge: number;
    mysticalAwareness: number;
    historicalStudy: number;
  };
}

/**
 * Phase 28 Task 2: Historical Record - Sealed memories from epoch transitions
 * These are memories converted to Iron Canon at epoch end for cross-generational persistence
 * They represent the "official history" of what happened in an epoch
 */
export interface HistoricalRecord {
  recordId: string;                     // Unique identifier
  npcId: string;                        // Who does this record belong to?
  epochId: string;                      // Which epoch sealed this?
  originalScarId?: string;              // Original SocialScar if this came from one
  recordType: 'migration' | 'outburst' | 'achievement' | 'tragedy' | 'transformation';
  content: string;                      // Human-readable historical account
  severity: number;                     // 0.0-1.0, importance/weight of this record
  linkedLocationIds: string[];          // Places affected by this historical event
  linkedNpcIds: string[];               // NPCs involved in this historical event
  linkedFactionIds: string[];           // Factions affected by this record
  sealedAtTick: number;                 // When was this sealed into history?
  legacyImpact: number;                 // 0-100, how much does this affect descendants?
}

