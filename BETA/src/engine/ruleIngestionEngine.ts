/**
 * Phase 22: Rule Ingestion Engine
 * 
 * Manages runtime override of combat formulas and macro events from the world template.
 * Enables "Hot-Swapping" of game balance rules without process restart.
 * 
 * Strategy Pattern: Rules are pulled from luxfier-world.json at runtime,
 * with fallbacks to hardcoded defaults if overrides aren't defined.
 */

export interface CombatFormulaOverride {
  /**
   * Base critical strike multiplier (default: 2.0)
   * Example: 3.5 means crits do 3.5x damage
   */
  critMultiplier?: number;

  /**
   * Base critical chance percentage (0-100, default: 5)
   */
  baseCritChance?: number;

  /**
   * Armor piercing base percentage (0-100, default: 10)
   */
  baseArmorPiercing?: number;

  /**
   * Damage scaling factor (default: 1.0)
   * Multiply all damage values by this to tune combat difficulty
   */
  damageScaleFactor?: number;

  /**
   * Defense effectiveness multiplier (default: 1.0)
   * Increase to make defensive stats more valuable
   */
  defenseScaleFactor?: number;

  /**
   * Block reduction percentage (default: 0.3-0.5, represented as decimal)
   */
  blockMinReduction?: number;
  blockMaxReduction?: number;

  /**
   * Healing effectiveness multiplier (default: 1.0)
   */
  healingScaleFactor?: number;
}

export interface CustomMacroEvent {
  /**
   * Unique type identifier (e.g., "LIVE_FESTIVAL", "VOID_INCURSION")
   */
  type: string;

  /**
   * Display name and description
   */
  name: string;
  description: string;

  /**
   * Base severity (1-100)
   */
  baseSeverity: number;

  /**
   * Whether this event targets a specific location
   */
  isLocationSpecific?: boolean;

  /**
   * Effects to apply to affected NPCs
   */
  modifierEffects: Array<{
    /**
     * Stat name to modify (e.g., "str", "luck", "agi")
     */
    stat: string;

    /**
     * Multiplier or additive value
     * > 1: increase, < 1: decrease
     * Can be negative for debuffs
     */
    value: number;

    /**
     * "multiply" or "add" - determines if value is multiplier or additive
     * Default: "add"
     */
    mode?: 'multiply' | 'add';
  }>;

  /**
   * Optional override goal for NPCs
   * Example: "LIVE_FESTIVAL" might set goal to "celebrate"
   */
  npcGoalOverride?: string;
}

class RuleIngestionEngineInstance {
  private combatFormulas: CombatFormulaOverride = {};
  private customMacroEvents: Map<string, CustomMacroEvent> = new Map();
  private injectionLog: Array<{ timestamp: number; type: string; message: string }> = [];
  private sourceTemplate: any = null;

  /**
   * Initialize or update the ingestion engine from a world template
   */
  initialize(worldTemplate: any): void {
    this.sourceTemplate = worldTemplate;
    this.injectionLog = [];

    // Phase 22: Load injectedRules from template
    if (worldTemplate?.injectedRules) {
      this.loadCombatFormulas(worldTemplate.injectedRules);
    }

    // Load custom macro events
    if (worldTemplate?.injectedRules?.customMacroEvents) {
      this.loadCustomMacroEvents(worldTemplate.injectedRules.customMacroEvents);
    }
  }

  /**
   * Load combat formula overrides from template
   */
  private loadCombatFormulas(injectedRules: any): void {
    if (!injectedRules.combatFormulas) return;

    for (const [key, value] of Object.entries(injectedRules.combatFormulas)) {
      (this.combatFormulas as any)[key] = value;
      this.log('COMBAT_FORMULA', `${key}: ${value}`);
    }
  }

  /**
   * Load custom macro event definitions
   */
  private loadCustomMacroEvents(events: any[]): void {
    for (const event of events) {
      if (event.type) {
        this.customMacroEvents.set(event.type, event);
        this.log('MACRO_EVENT', `Registered custom event type: ${event.type}`);
      }
    }
  }

  /**
   * Get a combat formula override, or undefined if not overridden
   */
  getCombatFormulaOverride(formula: keyof CombatFormulaOverride): number | undefined {
    return (this.combatFormulas as any)[formula];
  }

  /**
   * Get all combat formula overrides
   */
  getAllCombatFormulas(): CombatFormulaOverride {
    return { ...this.combatFormulas };
  }

  /**
   * Check if a custom macro event type is defined
   */
  hasCustomMacroEvent(eventType: string): boolean {
    return this.customMacroEvents.has(eventType);
  }

  /**
   * Get a custom macro event definition
   */
  getCustomMacroEvent(eventType: string): CustomMacroEvent | undefined {
    return this.customMacroEvents.get(eventType);
  }

  /**
   * Get all custom macro event types
   */
  getCustomMacroEventTypes(): string[] {
    return Array.from(this.customMacroEvents.keys());
  }

  /**
   * Log an ingestion action for debugging
   */
  private log(type: string, message: string): void {
    this.injectionLog.push({
      timestamp: Date.now(),
      type,
      message
    });
    // eslint-disable-next-line no-console
    console.log(`[RuleIngestion] ${type}: ${message}`);
  }

  /**
   * Get the full ingestion log
   */
  getInjectionLog(): typeof this.injectionLog {
    return [...this.injectionLog];
  }

  /**
   * Reset all overrides (useful for testing)
   */
  reset(): void {
    this.combatFormulas = {};
    this.customMacroEvents.clear();
    this.injectionLog = [];
    this.sourceTemplate = null;
  }
}

// Singleton instance
let instance: RuleIngestionEngineInstance | null = null;

/**
 * Get or create the Rule Ingestion Engine singleton
 */
export function getRuleIngestionEngine(): RuleIngestionEngineInstance {
  if (!instance) {
    instance = new RuleIngestionEngineInstance();
  }
  return instance;
}

/**
 * Reset the singleton for testing
 */
export function resetRuleIngestionEngine(): void {
  instance = null;
}
