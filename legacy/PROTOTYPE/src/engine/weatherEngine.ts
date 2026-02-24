/**
 * weatherEngine.ts - Environmental Weather System
 * Determines weather based on season, time, and deterministic sun cycle.
 */

export type Weather = 'clear' | 'snow' | 'rain';

export interface WeatherResult {
  current: Weather;
  intensity: 'light' | 'moderate' | 'heavy';
  hasChanged: boolean;
  transitionEvent?: string;
}

/**
 * Resolve weather for a given tick/hour and season
 * Deterministic: same input always produces same output
 */
export function resolveWeather(
  season: 'winter' | 'spring' | 'summer' | 'autumn',
  hour: number,
  previousWeather?: Weather
): WeatherResult {
  // Deterministic chance based on hour modulo
  const chance = (hour % 6) / 6; // 0-1 value varies by hour window

  let weather: Weather = 'clear';
  let intensity: 'light' | 'moderate' | 'heavy' = 'light';

  if (season === 'winter') {
    if (chance > 0.3) weather = 'snow';
    intensity = chance > 0.7 ? 'heavy' : 'moderate';
  } else if (season === 'spring') {
    if (chance > 0.6) weather = 'rain';
    intensity = 'light';
  } else if (season === 'summer') {
    if (chance > 0.7) weather = 'rain';
    intensity = chance > 0.85 ? 'heavy' : 'moderate';
  } else if (season === 'autumn') {
    if (chance > 0.4) weather = 'rain';
    intensity = 'moderate';
  }

  const hasChanged = previousWeather !== undefined && weather !== previousWeather;
  const transitionEvent = hasChanged ? `WEATHER_CHANGED_TO_${weather.toUpperCase()}` : undefined;

  return { current: weather, intensity, hasChanged, transitionEvent };
}

/**
 * Get visual color/intensity parameters for rendering weather
 */
export function getWeatherVisuals(weather: Weather, intensity: 'light' | 'moderate' | 'heavy') {
  const intensityMap = { light: 0.3, moderate: 0.6, heavy: 0.9 };

  switch (weather) {
    case 'snow':
      return { particleType: 'snow', color: '#e8f4f8', count: intensityMap[intensity] * 200, alpha: 0.6 };
    case 'rain':
      return { particleType: 'rain', color: '#4a90e2', count: intensityMap[intensity] * 300, alpha: 0.7 };
    case 'clear':
    default:
      return { particleType: 'motes', color: '#fff9e6', count: 50, alpha: 0.4 };
  }
}
