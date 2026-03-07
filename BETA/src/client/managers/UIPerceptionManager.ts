/**
 * UI Perception Manager (Phase 8 - Perception Layer)
 * 
 * Frontend data filtering layer that transforms raw engine data into
 * diegetic descriptors based on player attributes (PER/WIS).
 * 
 * This manager implements "Information Lag" - the principle that uncertain
 * player knowledge should be reflected in UI display vagueness.
 * 
 * Key Systems:
 * 1. Perception Matrix: PER/WIS determines visibility thresholds
 * 2. Diegetic Descriptors: Replace exact values with qualitative states
 * 3. Hidden Information Filtering: Obfuscate unseeable game data
 * 4. Visibility Costs: Track when player "spends" awareness to examine things
 */

import { FrictionManager, HealthDescriptor, VitalDescriptor, PerceivedVesselState } from '../../engine/FrictionManager';
import type { Vessel } from '../../types';

/**
 * UI Perception Filter Result
 * Contains both raw and filtered data for rendering decisions
 */
export interface UIPerceptionFilter {
  // Character perception stats
  playerPerception: number;         // PER attribute
  playerWisdom: number;             // WIS attribute
  lagMultiplier: number;            // 0-1, how much information is hidden
  
  // Vessel state with perception applied
  perceivedHealth: PerceivedVesselState;
  
  // Enemy information (what player can see about others)
  visibleEnemies: Array<{
    vesselId: string;
    name: string;
    healthDescriptor: HealthDescriptor;
    exactHealth?: number;           // Only if PER/WIS high enough
    isHidden: boolean;              // If true, position/name is obscured
    visibilityRange: number;        // 0-100, how clearly can player see this NPC
  }>;
  
  // Environmental information
  hiddenLocations: string[];        // Locations player shouldn't see
  hiddenNPCs: string[];             // NPCs player can't perceive
  hiddenItems: string[];            // Items hidden by shadows/fog
  
  // Information cost
  examineActionsUsed: number;       // How many "examinations" has player done this turn
  remainingExamines: number;        // How many more can they do
}

/**
 * Causal Lock UI Info
 * Display information about rebirth cooldowns
 */
export interface CausalLockDisplay {
  soulId: string;
  sessionName: string;              // "Hero", "Merchant", etc.
  remainingTicks: number;
  remainingHours: number;           // For display
  remainingMinutes: number;         // For display
  lockExpiresTick: number;
  reason: string;                   // "72-hour rebirth cooldown"
  progressPercent: number;          // 0-100 for progress bar
}

/**
 * Study Mode UI State
 * Display information during fast-forwarding
 */
export interface StudyModeDisplay {
  isActive: boolean;
  targetTick: number;
  currentTick: number;
  progressPercent: number;          // 0-100
  estimatedDurationSeconds: number;
  
  // Accumulated vitals decay during study
  healthDecayPercent: number;
  vigorDecayPercent: number;
  nourishmentDecayPercent: number;
  sanityDecayPercent: number;
  
  // Interruption risk
  interruptionRisk: number;         // 0-100, chance to be ambushed
  isInterrupted: boolean;
}

/**
 * UI Perception Manager: Frontend-side perception filtering
 * 
 * Works in tandem with FrictionManager (engine-side) to implement
 * a two-layer information gap:
 * 
 * Layer 1 (Engine): EventBus filters events before sending to UI
 * Layer 2 (Frontend): UIPerceptionManager filters received data before rendering
 */
export class UIPerceptionManager {
  /**
   * Calculate perception filter for player character
   * 
   * @param playerVessel Player's current vessel
   * @param targetVessels Other vessels to evaluate visibility of
   * @param hasExamined Whether player took "Self-Examine" action
   * @returns Perception-filtered UI data
   */
  static calculatePlayerPerception(
    playerVessel: Vessel,
    targetVessels: Vessel[] = [],
    hasExamined: boolean = false
  ): UIPerceptionFilter {
    const lagMultiplier = FrictionManager.getInformationLagMultiplier(playerVessel);
    const perceivedHealth = FrictionManager.getPerceivedVesselState(playerVessel, hasExamined);
    
    const visibleEnemies = targetVessels.map(target => {
      const targetLag = FrictionManager.getInformationLagMultiplier(target);
      const targetHealth = FrictionManager.getPerceivedVesselState(target, false);
      
      // Combine perception multipliers: player's PER affects what they see of others
      const combinedLag = (lagMultiplier + targetLag) / 2;
      const visibilityRange = Math.max(0, 100 - (combinedLag * 100));
      
      return {
        vesselId: target.id,
        name: target.name,
        healthDescriptor: targetHealth.healthDescriptor,
        exactHealth: (combinedLag < 0.3) ? target.healthPoints : undefined,
        isHidden: visibilityRange < 30,
        visibilityRange,
      };
    });
    
    // Determine hidden entities based on player perception
    const perceptionThreshold = this.getPerceptionThreshold(playerVessel);
    const hiddenLocations = this.determineHiddenLocations(targetVessels, perceptionThreshold);
    const hiddenNPCs = this.determineHiddenNPCs(targetVessels, perceptionThreshold);
    const hiddenItems = this.determineHiddenItems(targetVessels, perceptionThreshold);
    
    return {
      playerPerception: playerVessel.attributes.PER,
      playerWisdom: playerVessel.attributes.WIS,
      lagMultiplier,
      perceivedHealth,
      visibleEnemies,
      hiddenLocations,
      hiddenNPCs,
      hiddenItems,
      examineActionsUsed: 0,           // TODO: Track from session
      remainingExamines: Math.floor(playerVessel.attributes.WIS / 5), // Max examines per turn
    };
  }

  /**
   * Get the perception threshold for a vessel
   * Determines what level of detail should be hidden
   * 
   * @param vessel Vessel to evaluate
   * @returns Threshold 0-1 (0 = sees everything, 1 = sees nothing)
   */
  private static getPerceptionThreshold(vessel: Vessel): number {
    const perception = (vessel.attributes.PER + vessel.attributes.WIS) / 2;
    return Math.max(0, Math.min(1, 1 - perception / 20)); // Normalized against average attr (10)
  }

  /**
   * Determine which locations should be hidden from player view
   * Locations at the edge of perception range become foggy
   */
  private static determineHiddenLocations(vessels: Vessel[], threshold: number): string[] {
    // TODO: Implement based on player position and perception range
    return [];
  }

  /**
   * Determine which NPCs should be hidden (stealth, shadows, etc.)
   */
  private static determineHiddenNPCs(vessels: Vessel[], threshold: number): string[] {
    return vessels
      .filter(v => {
        // NPC is hidden if perception threshold says so
        return Math.random() > threshold;
      })
      .map(v => v.id);
  }

  /**
   * Determine which items should be hidden (small, hidden, etc.)
   */
  private static determineHiddenItems(vessels: Vessel[], threshold: number): string[] {
    // TODO: Implement based on item size/concealment and player perception
    return [];
  }

  /**
   * Format causal lock display for UI countdown
   * 
   * @param soulId Soul that's locked
   * @param lockExpiresTick When the lock expires
   * @param currentTick Current game tick
   * @param sessionName Display name for the session
   * @returns Display info for UI rendering
   */
  static formatCausalLock(
    soulId: string,
    lockExpiresTick: number,
    currentTick: number,
    sessionName: string = 'Unknown'
  ): CausalLockDisplay {
    const remainingTicks = Math.max(0, lockExpiresTick - currentTick);
    const ticksPerHour = 2400; // From FrictionManager
    const remainingHours = Math.floor(remainingTicks / ticksPerHour);
    const remainingMinutes = Math.floor((remainingTicks % ticksPerHour) / 40); // 40 ticks per minute
    
    const totalLockTicks = 259200; // 72 hours
    const progressPercent = Math.round(((totalLockTicks - remainingTicks) / totalLockTicks) * 100);
    
    return {
      soulId,
      sessionName,
      remainingTicks,
      remainingHours,
      remainingMinutes,
      lockExpiresTick,
      reason: '72-hour rebirth cooldown',
      progressPercent,
    };
  }

  /**
   * Format study mode display for UI progress indicators
   * 
   * @param startTick When study started
   * @param targetTick When study will end
   * @param currentTick Current progress
   * @param startingHealth Player's health at study start
   * @param currentHealth Player's health now
   * @returns Display info for study mode overlay
   */
  static formatStudyMode(
    startTick: number,
    targetTick: number,
    currentTick: number,
    startingHealth: number,
    currentHealth: number
  ): StudyModeDisplay {
    const totalDuration = targetTick - startTick;
    const elapsed = currentTick - startTick;
    const progressPercent = Math.round((elapsed / totalDuration) * 100);
    
    // Estimate remaining time (assuming 1.5s per tick, 2400 ticks per hour)
    const remainingTicks = targetTick - currentTick;
    const remainingHours = remainingTicks / 2400;
    const estimatedDurationSeconds = remainingHours * 3600;
    
    // Calculate accumulated decay
    const healthDecay = ((startingHealth - currentHealth) / startingHealth) * 100;
    
    return {
      isActive: true,
      targetTick,
      currentTick,
      progressPercent,
      estimatedDurationSeconds,
      
      healthDecayPercent: Math.round(healthDecay),
      vigorDecayPercent: 0,     // TODO: Calculate from vitals change
      nourishmentDecayPercent: 0, // TODO: Calculate from vitals change
      sanityDecayPercent: 0,     // TODO: Calculate from vitals change
      
      interruptionRisk: 0,        // TODO: Calculate based on area, paradox, etc.
      isInterrupted: false,
    };
  }

  /**
   * Apply information lag penalty to displayed skill roll
   * If player can't see clearly, their displayed roll should reflect that
   * 
   * @param baseRoll Base d20 roll result
   * @param playerVessel Player character
   * @returns Displayed roll (may be penalized by lag)
   */
  static applyPerceptionPenaltyToRoll(baseRoll: number, playerVessel: Vessel): number {
    return FrictionManager.applyInformationLagToRoll(playerVessel, baseRoll);
  }

  /**
   * Determine if an NPC position should be visible or obscured
   * Used for Stage (center) rendering - NPC sprites may be hidden by fog
   * 
   * @param npc NPC to check visibility of
   * @param playerPerception Player's PER attribute
   * @param distance Distance from player to NPC
   * @returns Whether NPC position should be rendered
   */
  static isNPCPositionVisible(
    npc: Vessel,
    playerPerception: number,
    distance: number
  ): boolean {
    // High perception allows seeing further and through obstacles
    const perceptionRange = playerPerception * 10; // Scale to units
    
    if (distance > perceptionRange) {
      return false; // Out of perception range
    }
    
    // Check if NPC has stealth abilities
    // TODO: Check NPC attributes vs player perception
    const npcStealth = npc.attributes.DEX; // Proxied by DEX
    const playerAwareness = playerPerception + 5; // Base awareness bonus
    
    if (npcStealth > playerAwareness + 5) {
      return false; // NPC successfully hidden
    }
    
    return true;
  }

  /**
   * Generate opacity/visibility CSS for an entity based on player perception
   * 
   * @param entity Entity to render
   * @param playerPerception Player's PER
   * @param baseOpacity Default opacity (1.0)
   * @returns Opacity value 0-1
   */
  static calculateEntityOpacity(
    entity: Vessel,
    playerPerception: number,
    baseOpacity: number = 1.0
  ): number {
    const perception = (playerPerception - 5) / 10; // Normalize
    const visibility = Math.max(0, Math.min(1, perception));
    return baseOpacity * visibility;
  }

  /**
   * Check if descriptors should be vague or exact
   * Used to toggle between health descriptors ("Wounded") vs exact ("%")
   * 
   * @param vessel Vessel to check
   * @param dataType Type of data to check ('health' | 'vigor' | 'sanity' | 'nourishment')
   * @returns true if exact data should be shown
   */
  static shouldShowExactData(vessel: Vessel, dataType: 'health' | 'vigor' | 'sanity' | 'nourishment'): boolean {
    const lagMultiplier = FrictionManager.getInformationLagMultiplier(vessel);
    const exactThreshold = 0.3; // If lag < 30%, show exact values
    
    const hasExamined = false; // TODO: Track examination state
    if (hasExamined) {
      return true; // Examined entities always show exact data
    }
    
    return lagMultiplier < exactThreshold;
  }

  /**
   * Transform raw engine event into UI-displayable event
   * Applies perception filtering before showing to player
   * 
   * @param event Raw engine event
   * @param playerPerception Player's PER attribute
   * @returns Filtered event (may be null if filtered out completely)
   */
  static filterEventForUI(
    event: {
      type: string;
      data: Record<string, any>;
    },
    playerPerception: number
  ): {
    type: string;
    data: Record<string, any>;
    isVisible: boolean;
    vagueness: number; // 0-1, how vague should display be
  } | null {
    const perceptionThreshold = Math.max(0, Math.min(1, 1 - playerPerception / 20));
    
    // Some events are too vague to perceive
    if (event.type === 'npc_subtle_movement' && perceptionThreshold > 0.6) {
      return null; // Filtered out completely
    }
    
    // Determine display vagueness
    let vagueness = 0;
    if (event.type === 'distant_combat') {
      vagueness = Math.max(0, perceptionThreshold - 0.2);
    }
    
    return {
      type: event.type,
      data: event.data,
      isVisible: true,
      vagueness,
    };
  }

  /**
   * Get diegetic description for a specific stat
   * Converts numeric value to text for UI display
   * 
   * @param statType Type of stat ('health' | 'vigor' | 'sanity' | 'nourishment')
   * @param percent Percentage value 0-100
   * @param isExact Whether to show exact or vague descriptor
   * @returns Human-readable string
   */
  static getStatDescriptor(
    statType: 'health' | 'vigor' | 'sanity' | 'nourishment',
    percent: number,
    isExact: boolean = false
  ): string {
    if (isExact) {
      return `${Math.round(percent)}%`;
    }
    
    if (statType === 'health') {
      return FrictionManager.getHealthDescriptor(percent);
    }
    
    return FrictionManager.getVitalDescriptor(percent);
  }

  /**
   * Check if player should see the exact position of an NPC
   * Used to determine Stage (center) NPC sprite positioning
   * 
   * @param playerVessel Player character
   * @param targetVessel NPC to check
   * @returns true if exact position should be shown
   */
  static shouldShowExactNPCPosition(playerVessel: Vessel, targetVessel: Vessel): boolean {
    const lagMultiplier = FrictionManager.getInformationLagMultiplier(playerVessel);
    const targetLag = FrictionManager.getInformationLagMultiplier(targetVessel);
    const combinedLag = (lagMultiplier + targetLag) / 2;
    
    return combinedLag < 0.4; // Show exact position if combined lag < 40%
  }

  /**
   * Generate approximate position for NPC if exact position is hidden
   * Adds visual "jitter" to suggest uncertainty
   * 
   * @param exactX Exact X coordinate
   * @param exactY Exact Y coordinate
   * @param uncertainty Amount of uncertainty 0-1
   * @returns Approximate coordinates
   */
  static getObfuscatedPosition(
    exactX: number,
    exactY: number,
    uncertainty: number
  ): { x: number; y: number } {
    const maxJitter = 200 * uncertainty; // Up to 200px jitter at max uncertainty
    const jitterX = (Math.random() - 0.5) * maxJitter;
    const jitterY = (Math.random() - 0.5) * maxJitter;
    
    return {
      x: exactX + jitterX,
      y: exactY + jitterY,
    };
  }
}
