/**
 * M66: Cosmic Entity Framework
 * 
 * Extends M65 dialogue gates with metaphysical entities.
 * Introduces cosmic and absolute_truth gate types.
 * Persists Void-Walker entities through world resets.
 * 
 * Integration with m65NarrativeHardening for type-safe dialogue.
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Cosmic Entities & Extended Dialogue
// ============================================================================

/**
 * Extended gate types including cosmic entities
 */
export type CosmicDialogueGateType =
  | 'reputation'
  | 'relationship'
  | 'faction'
  | 'skill'
  | 'item'
  | 'quest'
  | 'scar'
  | 'political'
  | 'time'
  | 'composite'
  | 'cosmic' // Metaphysical entity presence
  | 'absolute_truth'; // Immutable narrative anchors

/**
 * Cosmic entity types
 */
export type CosmicEntityType =
  | 'void_walker'
  | 'paradox_echo'
  | 'aspect_manifestation'
  | 'temporal_specter'
  | 'silence_ambassador'
  | 'chronicle_keeper';

/**
 * Profile for a cosmic entity
 */
export interface CosmicEntityProfile {
  readonly entityId: string;
  readonly entityName: string;
  readonly type: CosmicEntityType;
  readonly affinity: number; // How much entity "likes" player (0-100, or -100 to +100)
  readonly knowledgeSeals: string[]; // Truths this entity knows
  readonly persistenceLevel: number; // 0-100, survives world resets?
  readonly voidPresence: number; // 0-100, how much paradox this entity brings
  readonly speaksAt: 'catastrophe_threshold' | 'chronicle_sealing' | 'new_epoch';
  readonly lastInteractionAt: number;
}

/**
 * Void-Walker metadata for persistence
 */
export interface VoidWalkerMetadata {
  readonly walkerId: string;
  readonly encounterCount: number;
  readonly revelationsGiven: string[];
  readonly legacyMemory: string; // Persistent memory across resets
  readonly hasSeenErasure: boolean; // Did they witness world end?
  readonly canPersist: boolean; // Flag for storage
  readonly persistsInStorage: 'localStorage' | 'indexeddb' | 'none';
}

/**
 * Cosmic gate requires metaphysical entity present
 */
export interface CosmicGateRequirement {
  readonly gateId: string;
  readonly requiredEntity: CosmicEntityType;
  readonly requiredAffinity: number; // Minimum affinity to pass
  readonly knowledgeRequired: string[]; // Must know certain truths
}

/**
 * Absolute truth gate: immutable fact anchor
 * Cannot be circumvented by any dialogue choice
 */
export interface AbsoluteTruthGate {
  readonly gateId: string;
  readonly truthContent: string; // The immutable fact
  readonly chronicleId: string; // Which chronicle sealed this truth
  readonly effectOnParadox: number; // How much this truth grounds reality (0-100)
}

/**
 * Dialogue node extended with cosmic gates
 */
export interface CosmicDialogueNode {
  readonly nodeId: string;
  readonly text: string;
  readonly speaker: 'player' | 'npc' | 'cosmic_entity' | 'narrator';
  readonly gateType: CosmicDialogueGateType;
  readonly cosmicGateRequirement?: CosmicGateRequirement; // For 'cosmic' gates
  readonly absoluteTruthGate?: AbsoluteTruthGate; // For 'absolute_truth' gates
  readonly consequences: string[]; // What changes after this dialogue
  readonly paradoxShift: number; // -100 to +100
}

/**
 * Choice with cosmic consequences
 */
export interface CosmicDialogueChoice {
  readonly choiceId: string;
  readonly text: string;
  readonly leadsToNode: string;
  readonly paradoxCost: number;
  readonly voidAffinity: number; // How much cosmic entities like this choice
  readonly truthsRevealed: string[];
}

// ============================================================================
// COSMIC ENTITY FRAMEWORK: Core Operations
// ============================================================================

let cosmicEntities: Map<string, CosmicEntityProfile> = new Map();
let voidWalkers: Map<string, VoidWalkerMetadata> = new Map();
let absoluteTruths: Map<string, string> = new Map();

const COSMIC_STORAGE_KEY = 'project_isekai_cosmic_entities';
const VOID_WALKER_KEY = 'project_isekai_void_walkers';

// ============================================================================
// MUTATION HELPERS: Type-safe entity updates
// ============================================================================

/**
 * Create updated cosmic entity
 * Ensures immutability by returning new object
 */
function updateCosmicEntity(entity: CosmicEntityProfile, updates: Partial<Omit<CosmicEntityProfile, 'readonly'>>): CosmicEntityProfile {
  return { ...entity, ...updates };
}

/**
 * Create updated void walker
 * Ensures immutability by returning new object
 */
function updateVoidWalker(walker: VoidWalkerMetadata, updates: Partial<Omit<VoidWalkerMetadata, 'readonly'>>): VoidWalkerMetadata {
  return { ...walker, ...updates };
}

/**
 * Create a cosmic entity
 * 
 * @param name Entity name
 * @param type Entity type
 * @param speaksAt When does it communicate?
 * @returns Entity profile
 */
export function createCosmicEntity(
  name: string,
  type: CosmicEntityType,
  speaksAt: 'catastrophe_threshold' | 'chronicle_sealing' | 'new_epoch'
): CosmicEntityProfile {
  const entity: CosmicEntityProfile = {
    entityId: `cosmic_${uuid()}`,
    entityName: name,
    type,
    affinity: 0,
    knowledgeSeals: [],
    persistenceLevel: 0,
    voidPresence: 50,
    speaksAt,
    lastInteractionAt: 0
  };

  cosmicEntities.set(entity.entityId, entity);
  return entity;
}

/**
 * Modify cosmic entity affinity
 * 
 * @param entityId Entity ID
 * @param delta Affinity change (-100 to +100)
 */
export function modifyCosmicAffinity(entityId: string, delta: number): void {
  const entity = cosmicEntities.get(entityId);
  if (!entity) return;

  const newAffinity = Math.max(-100, Math.min(100, entity.affinity + delta));
  const updated = updateCosmicEntity(entity, { affinity: newAffinity });
  cosmicEntities.set(entityId, updated);
}

/**
 * Seal a truth with an entity
 * 
 * @param entityId Entity ID
 * @param truthContent Immutable fact
 * @returns Truth ID
 */
export function sealTruthWithEntity(entityId: string, truthContent: string): string {
  const entity = cosmicEntities.get(entityId);
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const truthId = `truth_${uuid()}`;
  absoluteTruths.set(truthId, truthContent);
  
  const updated = updateCosmicEntity(entity, { 
    knowledgeSeals: [...entity.knowledgeSeals, truthId]
  });
  cosmicEntities.set(entityId, updated);

  return truthId;
}

/**
 * Create Void-Walker metadata
 * 
 * @param name Walker name
 * @returns Walker metadata
 */
export function createVoidWalker(name: string): VoidWalkerMetadata {
  const walker: VoidWalkerMetadata = {
    walkerId: `void_walker_${uuid()}`,
    encounterCount: 0,
    revelationsGiven: [],
    legacyMemory: `First encounter with ${name}`,
    hasSeenErasure: false,
    canPersist: true,
    persistsInStorage: 'none'
  };

  voidWalkers.set(walker.walkerId, walker);
  return walker;
}

/**
 * Record Void-Walker interaction
 * 
 * @param walkerId Walker ID
 * @param revelation Truth revealed
 */
export function recordVoidWalkerRevelation(walkerId: string, revelation: string): void {
  const walker = voidWalkers.get(walkerId);
  if (!walker) return;

  const updated = updateVoidWalker(walker, {
    encounterCount: walker.encounterCount + 1,
    revelationsGiven: [...walker.revelationsGiven, revelation],
    lastInteractionAt: Date.now()
  });
  voidWalkers.set(walkerId, updated);
}

/**
 * Mark Void-Walker as having witnessed erasure
 * 
 * @param walkerId Walker ID
 */
export function recordErasureWitness(walkerId: string): void {
  const walker = voidWalkers.get(walkerId);
  if (!walker) return;

  const updated = updateVoidWalker(walker, {
    hasSeenErasure: true,
    legacyMemory: walker.legacyMemory + ' | Witnessed world erasure'
  });
  voidWalkers.set(walkerId, updated);
}

/**
 * Check if player can pass cosmic gate
 * 
 * @param requirement Gate requirement
 * @param playerAffinityWithEntity Current affinity value
 * @param playerKnownTruths Truths player knows
 * @returns Whether gate passes
 */
export function checkCosmicGatePass(
  requirement: CosmicGateRequirement,
  playerAffinityWithEntity: number,
  playerKnownTruths: string[]
): boolean {
  // Check affinity requirement
  if (playerAffinityWithEntity < requirement.requiredAffinity) {
    return false;
  }

  // Check all required truths known
  for (const truthId of requirement.knowledgeRequired) {
    if (!playerKnownTruths.includes(truthId)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate absolute truth gate
 * Cannot be bypassed - player either knows it or doesn't
 * 
 * @param gate Gate to evaluate
 * @param playerKnownTruths Truths player knows
 * @returns Whether truth is known
 */
export function evaluateAbsoluteTruthGate(
  gate: AbsoluteTruthGate,
  playerKnownTruths: string[]
): boolean {
  return playerKnownTruths.includes(gate.gateId);
}

/**
 * Register absolute truth in dialogue system
 * 
 * @param truthContent The immutable fact
 * @param chronicleId Which chronicle sealed it
 * @param paradoxEffect How much this grounds reality (0-100)
 * @returns Gate config
 */
export function registerAbsoluteTruth(
  truthContent: string,
  chronicleId: string,
  paradoxEffect: number
): AbsoluteTruthGate {
  const gate: AbsoluteTruthGate = {
    gateId: `absolute_truth_${uuid()}`,
    truthContent,
    chronicleId,
    effectOnParadox: paradoxEffect
  };

  absoluteTruths.set(gate.gateId, truthContent);
  return gate;
}

/**
 * Create cosmic dialogue node
 * 
 * @param text Node dialogue text
 * @param speaker Who is speaking
 * @param gateType What type of gate
 * @param cosmicRequirement Optional cosmic gate requirement
 * @returns Dialogue node
 */
export function createCosmicDialogueNode(
  text: string,
  speaker: 'player' | 'npc' | 'cosmic_entity' | 'narrator',
  gateType: CosmicDialogueGateType,
  cosmicRequirement?: CosmicGateRequirement
): CosmicDialogueNode {
  return {
    nodeId: `dialogue_${uuid()}`,
    text,
    speaker,
    gateType,
    cosmicGateRequirement: cosmicRequirement,
    consequences: [],
    paradoxShift: 0
  };
}

/**
 * Create cosmic dialogue choice
 * 
 * @param text Choice text
 * @param leadsToNode Next dialogue node ID
 * @param paradoxCost Cost in paradox units
 * @returns Choice node
 */
export function createCosmicDialogueChoice(
  text: string,
  leadsToNode: string,
  paradoxCost: number
): CosmicDialogueChoice {
  return {
    choiceId: `choice_${uuid()}`,
    text,
    leadsToNode,
    paradoxCost,
    voidAffinity: 0,
    truthsRevealed: []
  };
}

/**
 * Record dialogue consequence
 * 
 * @param nodeId Dialogue node ID
 * @param consequence What changed
 */
export function recordDialogueConsequence(nodeId: string, consequence: string): void {
  // Note: In real implementation, would track dialogue nodes
  console.log(`Consequential dialogue: ${consequence}`);
}

/**
 * Persist cosmic entities to storage
 */
export function persistCosmicEntitiesToStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = {
        entities: Array.from(cosmicEntities.entries()),
        truths: Array.from(absoluteTruths.entries())
      };
      localStorage.setItem(COSMIC_STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.warn('Failed to persist cosmic entities:', error);
  }
}

/**
 * Load cosmic entities from storage
 */
export function loadCosmicEntitiesFromStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(COSMIC_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        cosmicEntities = new Map(data.entities);
        absoluteTruths = new Map(data.truths);
      }
    }
  } catch (error) {
    console.warn('Failed to load cosmic entities:', error);
  }
}

/**
 * Persist Void-Walkers to storage
 */
export function persistVoidWalkersToStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = Array.from(voidWalkers.entries());
      localStorage.setItem(VOID_WALKER_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.warn('Failed to persist Void-Walkers:', error);
  }
}

/**
 * Load Void-Walkers from storage
 */
export function loadVoidWalkersFromStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(VOID_WALKER_KEY);
      if (stored) {
        voidWalkers = new Map(JSON.parse(stored));
      }
    }
  } catch (error) {
    console.warn('Failed to load Void-Walkers:', error);
  }
}

/**
 * Get all cosmic entities
 * 
 * @returns Array of cosmic entities
 */
export function getAllCosmicEntities(): CosmicEntityProfile[] {
  return Array.from(cosmicEntities.values());
}

/**
 * Get cosmic entity by ID
 * 
 * @param entityId Entity ID
 * @returns Entity or null
 */
export function getCosmicEntityById(entityId: string): CosmicEntityProfile | null {
  return cosmicEntities.get(entityId) || null;
}

/**
 * Get all Void-Walkers
 * 
 * @returns Array of Void-Walkers
 */
export function getAllVoidWalkers(): VoidWalkerMetadata[] {
  return Array.from(voidWalkers.values());
}

/**
 * Get Void-Walker by ID
 * 
 * @param walkerId Walker ID
 * @returns Walker or null
 */
export function getVoidWalkerById(walkerId: string): VoidWalkerMetadata | null {
  return voidWalkers.get(walkerId) || null;
}

/**
 * Get all absolute truths
 * 
 * @returns Map of truth IDs to content
 */
export function getAllAbsoluteTruths(): Map<string, string> {
  return new Map(absoluteTruths);
}

/**
 * Get Void-Walkers marked for persistence
 * 
 * @returns Array of persistent Void-Walkers
 */
export function getPersistentVoidWalkers(): VoidWalkerMetadata[] {
  return Array.from(voidWalkers.values()).filter((w) => w.canPersist);
}

/**
 * Clear cosmic entity state (for testing)
 */
export function clearCosmicState(): void {
  cosmicEntities.clear();
  voidWalkers.clear();
  absoluteTruths.clear();
}
