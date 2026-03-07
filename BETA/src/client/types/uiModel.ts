/**
 * Oracle View: UI World Model (Pillar 2.1 - Extraction Remediations)
 * 
 * Purpose: Decouple UI rendering from engine's WorldState structure.
 * This derived view flattens nested engine data into UI-ready formats with
 * pre-calculated display strings, preventing "State-View Paradoxes" as the
 * engine evolves.
 * 
 * Key Design:
 * - Strictly typed (no `any`)
 * - Derived from WorldState (immutable transformation)
 * - Memoized to prevent unnecessary re-renders
 * - Supports visual debugging with paradox/age metrics
 */

/**
 * Location display with pre-calculated view data
 */
export interface UILocation {
  id: string;
  name: string;
  description: string;
  terrainType: string;
  
  // Pre-calculated for UI
  displayName: string; // Formatted with atmosphere effects
  atmosphereLevel: number; // 0-100, visual indicator
  populationCount: number;
  factionPresence: {
    factionId: string;
    factionName: string;
    control: number; // 0-100 control percentage
  }[];
  
  // Activity indicators
  isActual: boolean; // true if confirmed observation
  paradoxValue: number; // 0-100 paradox accumulation
  visualMarkers: string[]; // ['haunted', 'blessed', 'corrupted']
}

/**
 * NPC display with pre-calculated relationship data
 */
export interface UINPC {
  id: string;
  name: string;
  title: string;
  displayName: string; // Formatted, potentially affected by narrative attrition
  
  // Current state
  location: {
    locationId: string;
    locationName: string;
  };
  faction: {
    factionId: string;
    factionName: string;
  };
  
  // Narrative health indicators
  scarCount: number; // From narrative attrition
  scarTypes: string[]; // ['memory_loss', 'emotional_trauma', ...]
  emotionalState: 'stable' | 'distressed' | 'fractured';
  
  // Dialogue availability
  dialogueAvailable: boolean;
  dialogueLockedReasons: string[]; // Why can't talk to them
  
  // Visual indicators
  atmosphereAffected: boolean; // If showing paradox effects
  paradoxMarkers: string[];
}

/**
 * Player character display
 */
export interface UIPlayer {
  name: string;
  level: number;
  currentEpoch: number;
  currentSeason: string;
  currentDayPhase: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Time display
  formattedClock: string; // "06:30"
  formattedDate: string; // "Winter, Day 45"
  currentEpochName: string; // "The Echoes of Reality"
  
  // Status
  location: {
    locationId: string;
    locationName: string;
  };
  
  // Inventory pre-computed
  inventoryCount: number;
  equippedItems: Array<{ id: string; name: string; type: string }>;
  
  // Buffs/Debuffs
  activeEffects: Array<{
    id: string;
    name: string;
    type: 'buff' | 'debuff' | 'curse' | 'blessing';
    duration: number;
    icon: string;
  }>;
}

/**
 * Faction display with simplified metrics
 */
export interface UIFaction {
  id: string;
  name: string;
  description: string;
  
  // Status
  powerLevel: number; // 0-100
  memberCount: number;
  controlledLocations: UILocation[];
  
  // Relationship to player
  playerReputation: number; // -100 to 100
  playerRelationship: 'enemy' | 'neutral' | 'ally' | 'member';
  
  // Narrative state
  isActive: boolean;
  isDestabilized: boolean; // Due to paradox
}

/**
 * Dialogue option display
 */
export interface UIDialogueOption {
  id: string;
  text: string;
  isAvailable: boolean;
  lockReason?: string; // Why can't select this
  consequencePreview?: string; // "This will anger the Order"
  atmosphereCost?: number; // Dialogue that destabilizes reality
}

/**
 * Quest/Legacy marker in UI
 */
export interface UILegacyMarker {
  id: string;
  title: string;
  description: string;
  generationNumber: number;
  deeds: string[]; // Summary of significant actions
  inherited: boolean; // Has player inherited this?
  bonusesApplied: string[]; // ['soul_echo_x2', 'starting_level_boost']
}

/**
 * Atmospheric/Reality state visualization
 */
export interface UIAtmosphere {
  // Paradox tracking
  paradoxLevel: number; // 0-100, visual intensity
  paradoxSeverity: 'stable' | 'rippling' | 'fracturing' | 'shattered';
  
  // Age of reality
  ageRotSeverity: number; // 0-100, visual decay
  ageRotEffect: 'fresh' | 'weathered' | 'ancient' | 'dying';
  
  // Visual feedback
  visualFilters: {
    chromatic?: number; // 0-1, RGB shift intensity
    glitch?: number; // 0-1, digital artifacts
    sepia?: number; // 0-1, temporal decay
    blur?: number; // 0-1, reality instability
  };
  
  // CSS custom properties for root container
  cssVariables: {
    '--paradox-level': string; // "0.45"
    '--age-rot-level': string; // "0.72"
    '--atmosphere-intensity': string; // "0.6"
  };
}

/**
 * Complete UI World Model
 * This is the single source of truth for all UI rendering.
 * Transform happens once per render cycle via useMemo.
 */
export interface UIWorldModel {
  // Identity
  worldId: string;
  timestamp: number; // When this model was calculated
  
  // Player view
  player: UIPlayer;
  
  // Location visibility
  visibleLocations: UILocation[];
  currentLocationDetails: UILocation | null;
  
  // NPC visibility
  visibleNPCs: UINPC[];
  npcsAtCurrentLocation: UINPC[];
  
  // Faction overview
  knownFactions: UIFaction[];
  playerFaction: UIFaction | null;
  
  // Dialogue state
  activeDialogue: {
    npcId: string;
    npcName: string;
    dialogue: {
      id: string;
      speakerName: string;
      text: string;
      options: UIDialogueOption[];
    };
  } | null;
  
  // Narrative state
  legacyMarkers: UILegacyMarker[];
  
  // Atmospheric effects
  atmosphere: UIAtmosphere;
  
  // Metadata for debugging
  _metadata: {
    parentsCount: number; // NPCs with narrative attrition
    scarCountTotal: number; // Total social scars in world
    dialogueLockedCount: number; // NPCs with dialogue locked
    paradoxAffectedLocations: number;
    renderTimeMs?: number; // Time to compute this model
  };
}

/**
 * Phase 8: UI Notification (for alerts, popups, toasts)
 */
export interface UINotification {
  id: string;
  type: 'death' | 'epoch' | 'paradox' | 'warning' | 'info' | 'success' | 'error';
  message: string;
  timestamp: number;
  duration?: number; // How long to show (ms), null = permanent
  actionUrl?: string; // Optional link to detailed info
  soundEffect?: string; // Optional audio cue
}

/**
 * Phase 8: UI State (perception + connection status)
 */
export interface UIState {
  // Connection
  isConnected: boolean;
  syncLatency: number; // ms
  eventCount: number;
  
  // Perception filtering
  playerPerception: number;
  playerWisdom: number;
  lagMultiplier: number; // 0-1, how much info is hidden
  
  // Active overlays
  showCausalLocks: boolean;
  showStudyModeOverlay: boolean;
  showPerceptionDebug: boolean; // Dev mode
  
  // Notifications
  notifications: UINotification[];
  
  // Study Mode
  studyMode: {
    isActive: boolean;
    targetTick: number;
    currentTick: number;
    estimatedRemaining: number; // seconds
    healthDecayPercent: number;
    vigorDecayPercent: number;
  } | null;
  
  // Causal Locks
  activeCausalLocks: Array<{
    soulId: string;
    sessionName: string;
    remainingHours: number;
    remainingMinutes: number;
    progressPercent: number;
  }>;
}

/**
 * Phase 8: Perception-filtered NPC info for Stage display
 */
export interface UIPerceptionNPC {
  id: string;
  name: string;
  displayName: string; // May be obfuscated
  position?: { x: number; y: number }; // May be null if hidden
  isVisible: boolean;
  isHidden: boolean; // Behind fog/stealth
  healthDescriptor: string;
  healthPercent?: number; // Only if player can perceive exactly
  opacity: number; // 0-1, visibility
  spriteUrl: string;
  markerColor: string; // For UI indicator
}

/**
 * Controller interface for sending intents back to engine
 * Strictly defines the contract between UI and engine
 */
export interface UIControllerInterface {
  // Movement
  moveToLocation(locationId: string): Promise<void>;
  
  // Interaction
  interactWithNPC(npcId: string): Promise<void>;
  selectDialogueOption(optionId: string): Promise<void>;
  
  // Faction
  joinFaction(factionId: string): Promise<void>;
  setFactionReputation(factionId: string, delta: number): Promise<void>;
  
  // Time
  advanceTime(ticks: number): Promise<void>;
  skipToNextEpoch(): Promise<void>;
  
  // State query
  getWorldState(): Promise<any>; // WorldState type
  getCurrentTick(): Promise<number>;
  getPlayerLocation(): Promise<string>;
}

