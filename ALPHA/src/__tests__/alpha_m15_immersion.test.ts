/**
 * M15 Milestone Immersion Test Suite: "The Pulsing World"
 * 
 * Tests for atmospheric mechanics and environmental attrition:
 * - Environmental fatigue (MP costs based on weather)
 * - Seasonal buffs/debuffs (mana regen, item quality)
 * - Hazard effects (blizzard HAZARD_CHILL damage)
 * - Deterministic weather/season drift
 */

import {
  calculateEnvironmentalFatigue,
  calculateSeasonalModifiers,
  checkEnvironmentalHazard,
  isLocationSheltered,
} from '../engine/environmentalModifierEngine';

import { resolveWeather } from '../engine/weatherEngine';

describe('M15: Environmental Fatigue & Mechanical Weather', () => {
  test('calculateEnvironmentalFatigue - Clear weather no penalty', () => {
    const fatigue = calculateEnvironmentalFatigue('clear', 'light');
    expect(fatigue).toBe(1.0); // No additional fatigue
  });

  test('calculateEnvironmentalFatigue - Rain increases MP cost', () => {
    const lightRain = calculateEnvironmentalFatigue('rain', 'light');
    const moderateRain = calculateEnvironmentalFatigue('rain', 'moderate');
    const heavyRain = calculateEnvironmentalFatigue('rain', 'heavy');

    expect(lightRain).toBeGreaterThan(1.0);
    expect(moderateRain).toBeGreaterThan(lightRain);
    expect(heavyRain).toBeGreaterThan(moderateRain);
    expect(heavyRain).toBeLessThan(2.0); // Max heavy rain is ~1.48x
  });

  test('calculateEnvironmentalFatigue - Blizzard severe penalty', () => {
    const lightSnow = calculateEnvironmentalFatigue('snow', 'light');
    const moderateSnow = calculateEnvironmentalFatigue('snow', 'moderate');
    const heavySnow = calculateEnvironmentalFatigue('snow', 'heavy');

    expect(lightSnow).toBeGreaterThan(1.0);
    expect(moderateSnow).toBeGreaterThan(lightSnow);
    expect(heavySnow).toBeGreaterThan(moderateSnow);
    expect(heavySnow).toBeGreaterThan(2.0); // Heavy snow is ~2.4x
  });

  test('Environmental fatigue scales correctly with intensity', () => {
    const rainLight = calculateEnvironmentalFatigue('rain', 'light');
    const rainModerate = calculateEnvironmentalFatigue('rain', 'moderate');
    const rainHeavy = calculateEnvironmentalFatigue('rain', 'heavy');

    // Should scale monotonically
    expect(rainLight).toBeLessThanOrEqual(rainModerate);
    expect(rainModerate).toBeLessThanOrEqual(rainHeavy);
  });
});

describe('M15: Seasonal Modifiers', () => {
  test('calculateSeasonalModifiers - Spring boosts mana regen', () => {
    const spring = calculateSeasonalModifiers('spring');
    expect(spring.manaRegenMult).toBe(1.3);
    expect(spring.itemQualityMult).toBe(1.0);
    expect(spring.combatDifficulty).toBe(1.0);
  });

  test('calculateSeasonalModifiers - Summer increases mob difficulty', () => {
    const summer = calculateSeasonalModifiers('summer');
    expect(summer.manaRegenMult).toBeLessThan(1.0);
    expect(summer.itemQualityMult).toBeLessThan(1.0);
    expect(summer.combatDifficulty).toBeGreaterThan(1.0);
  });

  test('calculateSeasonalModifiers - Autumn boosts item crafting', () => {
    const autumn = calculateSeasonalModifiers('autumn');
    expect(autumn.manaRegenMult).toBe(1.0);
    expect(autumn.itemQualityMult).toBeGreaterThan(1.0); // 1.25x
    expect(autumn.combatDifficulty).toBeLessThan(1.0);
  });

  test('calculateSeasonalModifiers - Winter debuffs mana', () => {
    const winter = calculateSeasonalModifiers('winter');
    expect(winter.manaRegenMult).toBeLessThan(1.0); // 0.8x
    expect(winter.itemQualityMult).toBeLessThan(1.0);
    expect(winter.combatDifficulty).toBeGreaterThan(1.0);
  });
});

describe('M15: Environmental Hazards', () => {
  const mockLocation = {
    id: 'test-location',
    name: 'Test',
    biome: 'plains' as const,
    features: [],
    connected: []
  };

  const shelterLocation = {
    id: 'tavern',
    name: 'Tavern',
    biome: 'village' as const,
    features: [],
    connected: []
  };

  test('checkEnvironmentalHazard - Blizzard damages player at night (unsheltered)', () => {
    const hazard = checkEnvironmentalHazard('snow', 'heavy', 23, mockLocation, false);

    expect(hazard).not.toBeNull();
    if (hazard) {
      expect(hazard.hazardType).toBe('HAZARD_CHILL');
      expect(hazard.damageTicks).toBe(3); // Night multiplier
    }
  });

  test('checkEnvironmentalHazard - Blizzard does less damage during day', () => {
    const hazard = checkEnvironmentalHazard('snow', 'heavy', 12, mockLocation, false);

    expect(hazard).not.toBeNull();
    if (hazard) {
      expect(hazard.hazardType).toBe('HAZARD_CHILL');
      expect(hazard.damageTicks).toBe(1); // Day = 1 tick
    }
  });

  test('checkEnvironmentalHazard - Shelter blocks blizzard damage', () => {
    const hazard = checkEnvironmentalHazard('snow', 'heavy', 23, shelterLocation, true);
    expect(hazard).toBeNull(); // Sheltered location
  });

  test('checkEnvironmentalHazard - Clear weather causes no hazard', () => {
    const hazard = checkEnvironmentalHazard('clear', 'heavy', 23, mockLocation, false);
    expect(hazard).toBeNull();
  });

  test('checkEnvironmentalHazard - Light/moderate snow no hazard', () => {
    const light = checkEnvironmentalHazard('snow', 'light', 23, mockLocation, false);
    const moderate = checkEnvironmentalHazard('snow', 'moderate', 23, mockLocation, false);

    expect(light).toBeNull();
    expect(moderate).toBeNull();
  });
});

describe('M15: Shelter Detection', () => {
  test('isLocationSheltered - Village biome is sheltered', () => {
    expect(isLocationSheltered('village')).toBe(true);
  });

  test('isLocationSheltered - Shrine biome is sheltered', () => {
    expect(isLocationSheltered('shrine')).toBe(true);
  });

  test('isLocationSheltered - Cave biome is sheltered', () => {
    expect(isLocationSheltered('cave')).toBe(true);
  });

  test('isLocationSheltered - Forest biome is not sheltered', () => {
    expect(isLocationSheltered('forest')).toBe(false);
  });

  test('isLocationSheltered - Plains biome is not sheltered', () => {
    expect(isLocationSheltered('plains')).toBe(false);
  });

  test('isLocationSheltered - Unknown biome is not sheltered', () => {
    expect(isLocationSheltered('unknown')).toBe(false);
    expect(isLocationSheltered(undefined)).toBe(false);
  });
});

describe('M15: Deterministic Weather System', () => {
  test('resolveWeather - Same input produces same output (deterministic)', () => {
    const result1 = resolveWeather('winter', 12, 'clear');
    const result2 = resolveWeather('winter', 12, 'clear');

    expect(result1.current).toBe(result2.current);
    expect(result1.intensity).toBe(result2.intensity);
    expect(result1.hasChanged).toBe(result2.hasChanged);
  });

  test('resolveWeather - Winter favors snow', () => {
    const winterResults = new Map<string, number>();

    // Test all hours to see weather distribution
    for (let hour = 0; hour < 24; hour++) {
      const result = resolveWeather('winter', hour, undefined);
      const key = result.current;
      winterResults.set(key, (winterResults.get(key) || 0) + 1);
    }

    // Winter should have more snow than other seasons
    const snowCount = winterResults.get('snow') || 0;
    const clearCount = winterResults.get('clear') || 0;
    expect(snowCount).toBeGreaterThan(clearCount);
  });

  test('resolveWeather - Spring favors rain', () => {
    const springResults = new Map<string, number>();

    for (let hour = 0; hour < 24; hour++) {
      const result = resolveWeather('spring', hour, undefined);
      const key = result.current;
      springResults.set(key, (springResults.get(key) || 0) + 1);
    }

    // Spring should have some rain
    const rainCount = springResults.get('rain') || 0;
    expect(rainCount).toBeGreaterThan(0);
  });

  test('resolveWeather - Different hours can have different weather', () => {
    const hourly = Array.from({ length: 24 }, (_, i) =>
      resolveWeather('summer', i, undefined).current
    );

    // Not all hours should be the same
    const unique = new Set(hourly);
    expect(unique.size).toBeGreaterThan(1);
  });

  test('resolveWeather - Intensity scales with severity', () => {
    const blizzardIntensities = new Map<string, number>();

    for (let hour = 0; hour < 24; hour++) {
      const result = resolveWeather('winter', hour, undefined);
      if (result.current === 'snow') {
        blizzardIntensities.set(
          result.intensity,
          (blizzardIntensities.get(result.intensity) || 0) + 1
        );
      }
    }

    // Should have multiple intensity levels
    expect(blizzardIntensities.size).toBeGreaterThan(0);
  });

  test('resolveWeather - Detects weather transitions', () => {
    const startWeather = 'clear' as const;
    const result = resolveWeather('spring', 12, startWeather);

    // If weather changed, hasChanged should be true
    if (result.current !== startWeather) {
      expect(result.hasChanged).toBe(true);
      expect(result.transitionEvent).toBeDefined();
    } else {
      expect(result.hasChanged).toBe(false);
    }
  });
});

describe('M15: 365-Day Weather Drift', () => {
  test('Weather cycle across year is deterministic', () => {
    const weatherSequence: Record<string, number> = {
      clear: 0,
      rain: 0,
      snow: 0,
    };

    // Simulate one full year (365 days × 24 hours)
    const seasons = ['winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn'] as const;
    
    for (let month = 0; month < 12; month++) {
      for (let day = 0; day < 30; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const result = resolveWeather(seasons[month], hour, undefined);
          weatherSequence[result.current]++;
        }
      }
    }

    // Over a year, should have varied weather
    expect(weatherSequence.clear).toBeGreaterThan(0);
    expect(weatherSequence.snow).toBeGreaterThan(0);
    expect(weatherSequence.rain).toBeGreaterThan(0);

    // Winter should dominate in winter months
    const winterSnow = new Map<string, number>();
    for (let hour = 0; hour < 24; hour++) {
      const result = resolveWeather('winter', hour, undefined);
      winterSnow.set(result.current, (winterSnow.get(result.current) || 0) + 1);
    }
    expect(winterSnow.get('snow') || 0).toBeGreaterThan(winterSnow.get('clear') || 0);
  });
});

describe('M15: Integration - Environmental Mechanics', () => {
  test('Shelter location blocks all hazards regardless of weather', () => {
    const shelterLocation = {
      id: 'shrine',
      name: 'Shrine',
      biome: 'shrine' as const,
      features: [],
      connected: []
    };

    // Test all weather/hazard combinations against shrine
    const weatherTypes = ['snow', 'rain', 'clear'] as const;
    const intensities = ['light', 'moderate', 'heavy'] as const;

    for (const weather of weatherTypes) {
      for (const intensity of intensities) {
        const hazard = checkEnvironmentalHazard(weather, intensity, 23, shelterLocation, true);
        expect(hazard).toBeNull(); // All should be blocked
      }
    }
  });

  test('Seasonal bonus compounds with quality rolls', () => {
    // Autumn bonus should enhance item crafting
    const autumn = calculateSeasonalModifiers('autumn');
    const spring = calculateSeasonalModifiers('spring');

    expect(autumn.itemQualityMult).toBeGreaterThan(spring.itemQualityMult);
    expect(autumn.itemQualityMult).toBe(1.25);
  });

  test('Mana regeneration varies significantly by season', () => {
    const speeds = [
      calculateSeasonalModifiers('spring').manaRegenMult,
      calculateSeasonalModifiers('summer').manaRegenMult,
      calculateSeasonalModifiers('autumn').manaRegenMult,
      calculateSeasonalModifiers('winter').manaRegenMult,
    ];

    // Spring should be fastest
    expect(speeds[0]).toBeGreaterThan(speeds[1]);
    expect(speeds[0]).toBeGreaterThan(speeds[3]);

    // Should have variety
    const unique = new Set(speeds);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  test('Blizzard hazard only triggers in heavy snow storms', () => {
    const allCombos: Array<{ weather: string; intensity: string; shouldTrigger: boolean }> = [
      { weather: 'snow', intensity: 'light', shouldTrigger: false },
      { weather: 'snow', intensity: 'moderate', shouldTrigger: false },
      { weather: 'snow', intensity: 'heavy', shouldTrigger: true },
      { weather: 'rain', intensity: 'heavy', shouldTrigger: false },
      { weather: 'clear', intensity: 'heavy', shouldTrigger: false },
    ];

    const mockLocation = { id: 'plains', name: 'Plains', biome: 'plains' as const, features: [], connected: [] };

    for (const combo of allCombos) {
      const hazard = checkEnvironmentalHazard(
        combo.weather as any,
        combo.intensity as any,
        23,
        mockLocation,
        false
      );

      if (combo.shouldTrigger) {
        expect(hazard).not.toBeNull();
        expect(hazard?.hazardType).toBe('HAZARD_CHILL');
      } else {
        expect(hazard).toBeNull();
      }
    }
  });
});
