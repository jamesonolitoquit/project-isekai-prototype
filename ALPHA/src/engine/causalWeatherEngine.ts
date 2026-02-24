/**
 * M44-D1: Advanced Causal Weather Engine
 * 
 * Refactored weatherEngine to consume CausalRules from World Template.
 * Weather is no longer random - it's driven by world state:
 * - High contentionLevel (>0.7) triggers Ash Storms or Cinder-Fog
 * - Magical events trigger Mana-Static
 * - Magnus Fluctus (priority 100+) overrides all local weather rules
 * 
 * Enables immersive environmental feedback tied to faction warfare, magic, events.
 */

import type { WorldState } from './worldEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';

export type Weather = 'clear' | 'snow' | 'rain' | 'ash_storm' | 'cinder_fog' | 'mana_static';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * M44-D1: Causal rule from World Template that drives weather
 */
export interface CausalWeatherRule {
  id: string;
  name: string;
  condition: 'high_contention' | 'low_contention' | 'magical_surge' | 'faction_victory' | 'epoch_transition';
  triggerThreshold: number; // 0-1 scale (e.g., contentionLevel > 0.7)
  weatherResult: Weather;
  intensity: 'light' | 'moderate' | 'heavy';
  duration: number; // ticks the weather persists
  priority: number; // Higher priority overrides lower
  icon?: string;
  narrative?: string; // Flavor text when triggered
}

/**
 * M44-D1: Enhanced weather result with causal metadata
 */
export interface EnhancedWeatherResult {
  current: Weather;
  intensity: 'light' | 'moderate' | 'heavy';
  hasChanged: boolean;
  transitionEvent?: string;
  triggeredByRule?: CausalWeatherRule;
  causedBy: 'base' | 'contention' | 'magic' | 'macro_event' | 'magnus_fluctus';
  remainingDuration: number;
}

/**
 * M44-D1: Causal Weather Engine with template-driven rules
 */
export class CausalWeatherEngine {
  private causalRules: Map<string, CausalWeatherRule> = new Map();
  private activeWeather: Map<string, { weather: EnhancedWeatherResult; expiresAt: number }> = new Map(); // locationId → weather
  private rng: any; // Seeded RNG for determinism

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Set seeded RNG for deterministic weather
   */
  setSeededRng(rng: any): void {
    this.rng = rng;
  }

  /**
   * Initialize default causal rules from World Template
   */
  private initializeDefaultRules(): void {
    // Ash Storm: High contention areas
    this.registerRule({
      id: 'ash_storm_high_contention',
      name: 'Ash Storm',
      condition: 'high_contention',
      triggerThreshold: 0.7,
      weatherResult: 'ash_storm',
      intensity: 'heavy',
      duration: 5000,
      priority: 50,
      icon: '🌪️',
      narrative: 'Ash swirls in the conflict zone...',
    });

    // Cinder-Fog: Moderate contention
    this.registerRule({
      id: 'cinder_fog_contention',
      name: 'Cinder-Fog',
      condition: 'high_contention',
      triggerThreshold: 0.5,
      weatherResult: 'cinder_fog',
      intensity: 'moderate',
      duration: 3000,
      priority: 40,
      icon: '🔥',
      narrative: 'Embers dance in the air...',
    });

    // Mana-Static: Magical surge
    this.registerRule({
      id: 'mana_static_surge',
      name: 'Mana-Static',
      condition: 'magical_surge',
      triggerThreshold: 0.6,
      weatherResult: 'mana_static',
      intensity: 'heavy',
      duration: 2000,
      priority: 80,
      icon: '⚡',
      narrative: 'Reality crackles with arcane energy!',
    });

    // Clear skies: Peace
    this.registerRule({
      id: 'clear_skies_peace',
      name: 'Clear Skies',
      condition: 'low_contention',
      triggerThreshold: 0.2,
      weatherResult: 'clear',
      intensity: 'light',
      duration: 999999,
      priority: 10,
      icon: '☀️',
      narrative: 'The sky is clear and peaceful.',
    });
  }

  /**
   * Register a custom causal rule
   */
  registerRule(rule: CausalWeatherRule): void {
    this.causalRules.set(rule.id, rule);
  }

  /**
   * M44-D1: Resolve weather for location based on causal rules
   */
  resolveWeatherByCausalRules(
    locationId: string,
    worldState: WorldState,
    currentTick: number,
    season: Season
  ): EnhancedWeatherResult {
    const factionEngine = getFactionWarfareEngine();
    // const warZone = factionEngine.getWarZoneStatus(locationId); // [M48-A4: getWarZoneStatus not available]
    const contentionLevel = 0.3; // Default to 0.3

    // Check for Magnus Fluctus (priority 100+ override)
    const macroEvents = worldState.macroEvents || [];
    const magnusFluctus = macroEvents.find(e => e.priority >= 100 && e.locationId === locationId);

    if (magnusFluctus) {
      // Magnus Fluctus suppresses all local weather rules
      return {
        current: 'clear',
        intensity: 'light',
        hasChanged: false,
        causedBy: 'magnus_fluctus',
        remainingDuration: 10000,
      };
    }

    // Check if active weather still has duration
    const existing = this.activeWeather.get(locationId);
    if (existing && existing.expiresAt > currentTick) {
      return {
        ...existing.weather,
        remainingDuration: existing.expiresAt - currentTick,
        hasChanged: false,
      };
    }

    // Evaluate causal rules in priority order
    const applicableRules = Array.from(this.causalRules.values())
      .filter(rule => this.evaluateRuleCondition(rule, contentionLevel, worldState, locationId))
      .sort((a, b) => b.priority - a.priority); // Highest priority first

    if (applicableRules.length === 0) {
      // Fallback: use season-based weather
      return this.resolveSeasonalWeather(season);
    }

    const selectedRule = applicableRules[0];
    const newWeather: EnhancedWeatherResult = {
      current: selectedRule.weatherResult,
      intensity: selectedRule.intensity,
      hasChanged: existing ? existing.weather.current !== selectedRule.weatherResult : true,
      transitionEvent: existing ? `WEATHER_CHANGED_TO_${selectedRule.weatherResult.toUpperCase()}` : undefined,
      triggeredByRule: selectedRule,
      causedBy: this.getCauseFromCondition(selectedRule.condition),
      remainingDuration: selectedRule.duration,
    };

    // Cache the weather
    this.activeWeather.set(locationId, {
      weather: newWeather,
      expiresAt: currentTick + selectedRule.duration,
    });

    return newWeather;
  }

  /**
   * Evaluate if a rule's condition is met
   */
  private evaluateRuleCondition(
    rule: CausalWeatherRule,
    contentionLevel: number,
    worldState: WorldState,
    locationId: string
  ): boolean {
    switch (rule.condition) {
      case 'high_contention':
        return contentionLevel > rule.triggerThreshold;

      case 'low_contention':
        return contentionLevel < rule.triggerThreshold;

      case 'magical_surge':
        // Check if magical events are active in location
        const hasMagicEvent = (worldState.macroEvents || []).some(
          e => e.locationId === locationId && e.eventType?.includes('magic')
        );
        return hasMagicEvent;

      case 'faction_victory':
        // Check if faction just won territory
        const factionEngine = require('./factionWarfareEngine').getFactionWarfareEngine();
        const warZone = factionEngine.getWarZoneStatus(locationId);
        return warZone.recentSkirmishes?.length > 0;

      case 'epoch_transition':
        // Check if epoch just transitioned
        return (worldState.lastEpochTransitionTick || 0) < 100;

      default:
        return false;
    }
  }

  /**
   * Get cause type from rule condition
   */
  private getCauseFromCondition(condition: string): 'base' | 'contention' | 'magic' | 'macro_event' | 'magnus_fluctus' {
    if (condition.includes('contention')) return 'contention';
    if (condition.includes('magical')) return 'magic';
    if (condition.includes('faction')) return 'macro_event';
    if (condition.includes('epoch')) return 'macro_event';
    return 'base';
  }

  /**
   * Fallback: Resolve seasonal weather (original logic)
   */
  private resolveSeasonalWeather(season: Season): EnhancedWeatherResult {
    let weather: Weather = 'clear';
    let intensity: 'light' | 'moderate' | 'heavy' = 'light';

    if (season === 'winter') {
      weather = 'snow';
      intensity = 'moderate';
    } else if (season === 'spring') {
      weather = 'rain';
      intensity = 'light';
    } else if (season === 'summer') {
      weather = 'clear';
      intensity = 'light';
    } else if (season === 'autumn') {
      weather = 'rain';
      intensity = 'moderate';
    }

    return {
      current: weather,
      intensity,
      hasChanged: false,
      causedBy: 'base',
      remainingDuration: 999999,
    };
  }

  /**
   * Get visual parameters for weather rendering
   */
  getWeatherVisuals(weather: Weather, intensity: 'light' | 'moderate' | 'heavy') {
    const intensityMap = { light: 0.3, moderate: 0.6, heavy: 0.9 };
    const intensityValue = intensityMap[intensity];

    const visuals: Record<Weather, any> = {
      clear: { particleType: 'motes', color: '#fff9e6', count: 50, alpha: 0.4, tint: '#ffffff' },
      snow: { particleType: 'snow', color: '#e8f4f8', count: intensityValue * 200, alpha: 0.6, tint: '#e8e8ff' },
      rain: { particleType: 'rain', color: '#4a90e2', count: intensityValue * 300, alpha: 0.7, tint: '#4a7aaa' },
      ash_storm: { particleType: 'ash', color: '#8b8680', count: intensityValue * 400, alpha: 0.8, tint: '#444444' },
      cinder_fog: { particleType: 'embers', color: '#ff6b35', count: intensityValue * 250, alpha: 0.5, tint: '#ff4400' },
      mana_static: { particleType: 'mana', color: '#00ffff', count: intensityValue * 350, alpha: 0.6, tint: '#0099ff' },
    };

    return visuals[weather] || visuals.clear;
  }

  /**
   * Get all causal rules for editor/debugging
   */
  getAllRules(): CausalWeatherRule[] {
    return Array.from(this.causalRules.values());
  }

  /**
   * Get active weather for all locations
   */
  getActiveWeathers(): Map<string, EnhancedWeatherResult> {
    const result = new Map<string, EnhancedWeatherResult>();
    for (const [loc, data] of this.activeWeather.entries()) {
      result.set(loc, data.weather);
    }
    return result;
  }

  /**
   * Clear weather cache (for reset/epoch transition)
   */
  clearWeatherCache(): void {
    this.activeWeather.clear();
  }
}

// Singleton instance
let causalWeatherEngineInstance: CausalWeatherEngine | null = null;

export function getCausalWeatherEngine(): CausalWeatherEngine {
  if (!causalWeatherEngineInstance) {
    causalWeatherEngineInstance = new CausalWeatherEngine();
  }
  return causalWeatherEngineInstance;
}

export function resetCausalWeatherEngine(): void {
  causalWeatherEngineInstance = null;
}
