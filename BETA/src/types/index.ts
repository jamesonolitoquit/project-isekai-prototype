/**
 * Core Entity Schemas Index (Phase 1 Implementation)
 * 
 * This index file re-exports all core entity type definitions from the DSS system.
 * Enables clean imports: `import { Vessel, Attributes, ParadoxTracker } from '@/types'`
 */

// Attributes Module (DSS 01: Growth System)
export type { CoreAttributes, AttributeModifiers, LearningCurveConfig } from './attributes';
export {
  ATTRIBUTE_BOUNDS,
  calculateAttributeModifiers,
  calculateSkillXpRequired,
  validateAttributes,
  createDefaultAttributes,
  DEFAULT_LEARNING_CURVE,
} from './attributes';

// Vessels Module (DSS 02: Survival Mechanics)
export type {
  Injury,
  VitalStats,
  MaximumVitals,
  Vessel,
  StatusEffect,
  ConservationCheck,
  CausalLock,
} from './vessels';
export { InjuryType } from './vessels';
export {
  calculateMaxHealthPoints,
  calculateMaxStamina,
  calculateMaxVigor,
  calculateMaxSanity,
  createVessel,
  addInjury,
  getActiveInjuries,
  calculateTotalAttributePenalties,
  healInjury,
  performConservationCheck,
  isCausallyLocked,
} from './vessels';

// Template Module (DSS 16: Matriarchal Genesis)
export type {
  WorldTemplate,
  TemplateMetadata,
  Faction,
  FactionalSeed,
  MatriarchalGenesisTemplate,
  MatriarchalConfig,
  WombMagicConfig,
  AncestralEchoConfig,
  FuelSystemConfig,
  MatronAscensionConfig,
} from './template';
export { CovenantType } from './template';
export { createMatriarchalGenesisTemplate, validateTemplate } from './template';

// Temporal Module (DSS 03: Temporal Mechanics)
export type {
  ParadoxTracker,
  ParadoxEvent,
  ParadoxPenalty,
  ReincarnationOptions,
  CausalVault,
  VaultItem,
  Phase0SecurityInfo,
  TemporalDivergence,
} from './temporal';
export { ParadoxDebtState } from './temporal';
export {
  createParadoxTracker,
  calculateParadoxDebt,
  addParadoxEvent,
  updateParadoxState,
  getPenaltyForState,
  applyParadoxDecay,
  exceedsRollbackLimit,
  recordRollback,
  reduceParadoxDebt,
  triggerVesselReset,
  createCausalVault,
  storeItemInVault,
  retrieveItemFromVault,
  getActivePenalties,
  validateParadoxTracker,
} from './temporal';

// Factions Module (DSS 04: Governance)
export type {
  SocialWeightClass,
  SocialWeightModifier,
  ActionBudget,
  FactionAgenda,
  FactionAIState,
  FactionSocialRecord,
  ActiveFaction,
  FactionRelationship,
} from './factions';
export {
  FACTION_ACTION_TYPES,
  applySocialWeightModifier,
  calculateDailyBudgetGeneration,
  createActionBudget,
  isActionOnCooldown,
  canAffordAction,
} from './factions';

// Geography Module (DSS 05: Territory & Information Lag)
export type {
  StabilityMetric,
  TerritoryInformationLag,
  TaxSystem,
  RegionalHazard,
  TerritoryNode,
  Region,
  TerritoryInfluenceEvent,
} from './geography';
export {
  getControlThreshold,
  calculateTaxRevenue,
  updateTerritoryStability,
  getVitalsDecayMultipliers,
  calculateTerritoryInformationLag,
  createTerritoryNode,
} from './geography';

// Divine Module (DSS 06: Deity & Covenant Systems)
export type {
  Deity,
  Miracle,
  Covenant,
  SoulsReprieveCovenant,
  FaithMassTracker,
  DivineAlignment,
  DivineIntervention,
  GreatMotherDeity,
} from './divine';
export {
  calculateDailyFaithGeneration,
  calculateDailyFaithDecay,
  canGrantMiracle,
  createSoulsReprieveCovenant,
  createFaithMassTracker,
  createGreatMotherDeity,
} from './divine';

// Skills Module (Phase 4 - DSS 01: Growth System & Skill Architecture)
export type {
  Skill,
  XpProgress,
  Talent,
  CharacterSkillSet,
  SkillCoefficients,
} from './skills';
export type { SkillCategory } from './skills';
export {
  SkillProficiency,
  getSkillProficiency,
  calculateXpRequiredForLevel,
  DEFAULT_XP_TABLE,
} from './skills';

// Combat Module (Phase 4 - DSS 08: Combat & Conflict Resolution)
export type {
  Initiative,
  AttackResult,
  CombatAction,
  CombatRound,
  SpellMisfire,
  PacifismAttempt,
  EnvironmentalInteraction,
  AttackRollCoefficient,
  DefenseRollCoefficient,
} from './combat';
export type {
  CombatStance,
  DefenseReaction,
  ActionType,
} from './combat';
export {
  COMBAT_ROLL_MODIFIERS,
} from './combat';

// Inventory Module (Phase 4 - DSS 09 & 12: Equipment & Crafting)
export type {
  Item,
  Durability,
  Weapon,
  Armor,
  Container,
  Consumable,
  QuestItem,
  Inventory,
  EncumbranceCalculation,
  MarketFluctuation,
} from './inventory';
export type {
  ItemRarity,
  EquipmentSlot,
  WeaponCategory,
  ArmorType,
  DamageType,
} from './inventory';
export {
  ENCUMBRANCE_CONSTANTS,
  DURABILITY_CONSTANTS,
  ARMOR_DR_BY_TYPE,
  ARMOR_AGI_PENALTY_BY_TYPE,
} from './inventory';

// Persistence Module (Phase 5 - DSS 07 & 11: Meta-Integrity & Ledger)
export type {
  CauseID,
  LedgerEntry,
  WorldSnapshot,
  GlobalConstants,
  PartialStateMutation,
  BranchMarker,
  LedgerRangeQuery,
  StateHash,
  LedgerCommitResult,
  SaveGameState,
  RollbackTransaction,
} from './persistence';
export {
  createCauseID,
  createWorldSnapshot,
  createLedgerEntry,
  BRANCH_MARKER_CONSTANTS,
  LEDGER_CONSTANTS,
  SNAPSHOT_CONSTANTS,
} from './persistence';

// Reincarnation Module (Phase 5 - DSS 03.2 & 16: Ancestral Echoes)
export type {
  PlayerSoul,
  VesselIncarnation,
  Achievement,
  AncestralEchoPoint,
  VesselRebinding,
  ReincarnationConfig,
  FlashLearningSession,
} from './reincarnation';
export {
  VesselTerminationCause,
  ECHO_POINT_FORMULA,
  SKILL_XP_RETENTION_FORMULA,
  REPUTATION_INHERITANCE_FORMULA,
  REINCARNATION_CONSTANTS,
  createPlayerSoul,
  recordVesselIncarnation,
  calculateEchoPoints,
  calculateRetainedXp,
  calculateCausalLockExpiration,
} from './reincarnation';

// Multiplayer Module (Phase 9: Witness Consensus & Distributed Tabletop)
export type {
  PeerHandshake,
  SignedMutation,
  WitnessCertificate,
  OracleElectionState,
  TickSyncEvent,
  ConflictResolution,
  MultiplayerAuthority,
  LatencyProfile,
  PeerState,
  SessionMetrics,
  ReadyCheckPulse,
  SignatureContext,
} from './multiplayer';
