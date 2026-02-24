/**
 * Particle Engine - Defines and manages particle effects
 * 
 * Provides centralized particle configurations for:
 * - Weather effects (rain, snow, clear)
 * - Environmental hazards (fire, ice, lightning)
 * - Arcane casting (spell effects, status effects)
 * - Temporal anomalies (rifts, divergence crystallization)
 */

export interface ParticleConfig {
  type: string;
  count: number;
  color: string;
  size: number;
  speedVariance?: number;
  lifetime?: number;
  oscillation?: boolean;
  direction?: 'down' | 'up' | 'swirl' | 'radiate';
}

export interface ParticleEffect {
  id: string;
  name: string;
  enabled: boolean;
  config: ParticleConfig;
}

/**
 * Standard particle configurations for weather
 */
export const WEATHER_PARTICLES = {
  rain: {
    type: 'rain',
    count: 100,
    color: '#4a90e2',
    size: 2,
    speedVariance: 8,
    direction: 'down' as const
  },
  snow: {
    type: 'snow',
    count: 60,
    color: '#e8f4f8',
    size: 4,
    speedVariance: 1,
    direction: 'down' as const
  },
  clear: {
    type: 'motes',
    count: 30,
    color: '#fff9e6',
    size: 2,
    speedVariance: 0.3,
    direction: 'swirl' as const
  }
};

/**
 * Arcane spell effect particles
 */
export const SPELL_PARTICLES = {
  fireball: {
    type: 'fireball',
    count: 40,
    color: '#ff6600',
    size: 5,
    speedVariance: 4,
    lifetime: 1.5,
    direction: 'radiate' as const
  },
  lightning: {
    type: 'lightning',
    count: 25,
    color: '#00ffff',
    size: 3,
    speedVariance: 6,
    lifetime: 0.8,
    direction: 'radiate' as const
  },
  heal: {
    type: 'heal',
    count: 35,
    color: '#00ff00',
    size: 3,
    speedVariance: 2,
    lifetime: 1.2,
    direction: 'up' as const
  },
  shield: {
    type: 'shield',
    count: 50,
    color: '#9B59B6',
    size: 2,
    speedVariance: 1.5,
    lifetime: 2,
    direction: 'swirl' as const
  }
};

/**
 * ALPHA_M15: Combat feedback particles
 * Impact and critical hit visual effects for melee attacks
 */
export const COMBAT_PARTICLES = {
  impact: {
    type: 'impact',
    count: 30,
    color: '#ff9500',
    size: 3,
    speedVariance: 5,
    lifetime: 0.8,
    direction: 'radiate' as const
  },
  critical: {
    type: 'critical',
    count: 60,
    color: '#ffff00',
    size: 4,
    speedVariance: 7,
    lifetime: 1.2,
    direction: 'radiate' as const,
    oscillation: true // Pulsing effect for intensity
  }
};

/**
 * ALPHA_M15: Visual anomaly particles
 * System glitches and paradox-induced artifact effects
 */
export const VISUAL_ANOMALY_PARTICLES = {
  system_glitch: {
    type: 'system-glitch',
    count: 40,
    color: '#0088ff',
    size: 2,
    speedVariance: 8,
    lifetime: 1.5,
    direction: 'radiate' as const,
    oscillation: true // Teleporting/glitching color shifts
  },
  chromatic_edge: {
    type: 'chromatic-edge',
    count: 20,
    color: '#ff00ff',
    size: 2,
    speedVariance: 4,
    lifetime: 1.0,
    direction: 'radiate' as const
  }
};

/**
 * Elemental spell color mappings for spectral effects
 */
export const ELEMENTAL_SPELL_PARTICLES = {
  fire: {
    type: 'fire',
    count: 45,
    color: '#ff6600',
    size: 5,
    speedVariance: 4,
    lifetime: 1.5,
    direction: 'radiate' as const
  },
  frost: {
    type: 'frost',
    count: 40,
    color: '#00bfff',
    size: 4,
    speedVariance: 2,
    lifetime: 1.8,
    direction: 'radiate' as const,
    oscillation: true
  },
  shadow: {
    type: 'shadow',
    count: 35,
    color: '#4d0099',
    size: 3,
    speedVariance: 3,
    lifetime: 1.2,
    direction: 'radiate' as const
  },
  arcane: {
    type: 'arcane',
    count: 50,
    color: '#9B00FF',
    size: 3,
    speedVariance: 5,
    lifetime: 1.5,
    direction: 'radiate' as const,
    oscillation: true
  }
};

/**
 * Status effect particles
 */
export const STATUS_PARTICLES = {
  frozen: {
    type: 'frozen',
    count: 20,
    color: '#00BCD4',
    size: 3,
    speedVariance: 0.5,
    lifetime: 2,
    direction: 'down' as const
  },
  burned: {
    type: 'burned',
    count: 30,
    color: '#D32F2F',
    size: 4,
    speedVariance: 3,
    lifetime: 1.5,
    direction: 'up' as const
  },
  stunned: {
    type: 'stunned',
    count: 35,
    color: '#FFB74D',
    size: 2,
    speedVariance: 2,
    lifetime: 1,
    direction: 'swirl' as const,
    oscillation: true
  }
};

/**
 * Environmental hazard particles
 */
export const HAZARD_PARTICLES = {
  volcanic: {
    type: 'volcanic',
    count: 60,
    color: '#FF4500',
    size: 6,
    speedVariance: 5,
    lifetime: 2,
    direction: 'up' as const
  },
  toxic: {
    type: 'toxic',
    count: 50,
    color: '#00CC00',
    size: 3,
    speedVariance: 1,
    lifetime: 3,
    direction: 'swirl' as const,
    oscillation: true
  },
  temporal: {
    type: 'temporal',
    count: 40,
    color: '#FFD700',
    size: 4,
    speedVariance: 2,
    lifetime: 2.5,
    direction: 'swirl' as const
  }
};

/**
 * ALPHA_M5: Temporal Rift particle effect
 * 
 * High-density, oscillating purple/black particles that visualize
 * temporal anomalies and divergence crystallization
 */
export const TEMPORAL_RIFT_PARTICLES: ParticleConfig = {
  type: 'temporal-rift',
  count: 80,
  color: '#9B0E9B', // Deep purple with black oscillation
  size: 5,
  speedVariance: 4,
  lifetime: 3,
  direction: 'radiate',
  oscillation: true // Particles oscillate between purple (#9B0E9B) and black (#0a0000)
};

/**
 * ALPHA_M7: Ambient weather and environmental particles
 * 
 * Background atmospheric effects that run continuously:
 * - Fireflies: Gentle, glowing lights during night in clear weather
 * - Leaves: Drifting leaves during autumn
 * - Dust motes: Fine particles in warm sunlight
 * - Mist: Ethereal fog during rain or morning
 */
export const AMBIENT_PARTICLES = {
  fireflies: {
    type: 'fireflies',
    count: 15,
    color: '#ffeb3b',
    size: 3,
    speedVariance: 0.5,
    lifetime: 4,
    direction: 'swirl' as const,
    oscillation: true // Pulsing glow effect
  },
  leaves: {
    type: 'leaves',
    count: 25,
    color: '#d4621e',
    size: 5,
    speedVariance: 1,
    lifetime: 5,
    direction: 'down' as const
  },
  dust: {
    type: 'dust',
    count: 20,
    color: '#ffd89b',
    size: 2,
    speedVariance: 0.3,
    lifetime: 3,
    direction: 'swirl' as const
  },
  mist: {
    type: 'mist',
    count: 40,
    color: '#b3d9ff',
    size: 6,
    speedVariance: 0.2,
    lifetime: 4,
    direction: 'swirl' as const
  },
  spores: {
    type: 'spores',
    count: 30,
    color: '#90ee90',
    size: 3,
    speedVariance: 0.8,
    lifetime: 3.5,
    direction: 'up' as const
  }
};

/**
 * Get particle configuration by effect name
 */
export function getParticleConfig(effectName: string): ParticleConfig | null {
  // Check spell particles
  if (effectName in SPELL_PARTICLES) {
    return SPELL_PARTICLES[effectName as keyof typeof SPELL_PARTICLES];
  }

  // ALPHA_M15: Check combat feedback particles
  if (effectName in COMBAT_PARTICLES) {
    return COMBAT_PARTICLES[effectName as keyof typeof COMBAT_PARTICLES];
  }

  // ALPHA_M15: Check visual anomaly particles
  if (effectName in VISUAL_ANOMALY_PARTICLES) {
    return VISUAL_ANOMALY_PARTICLES[effectName as keyof typeof VISUAL_ANOMALY_PARTICLES];
  }

  // ALPHA_M15: Check elemental spell particles
  if (effectName in ELEMENTAL_SPELL_PARTICLES) {
    return ELEMENTAL_SPELL_PARTICLES[effectName as keyof typeof ELEMENTAL_SPELL_PARTICLES];
  }

  // Check status particles
  if (effectName in STATUS_PARTICLES) {
    return STATUS_PARTICLES[effectName as keyof typeof STATUS_PARTICLES];
  }

  // Check weather particles
  if (effectName in WEATHER_PARTICLES) {
    return WEATHER_PARTICLES[effectName as keyof typeof WEATHER_PARTICLES];
  }

  // Check hazard particles
  if (effectName in HAZARD_PARTICLES) {
    return HAZARD_PARTICLES[effectName as keyof typeof HAZARD_PARTICLES];
  }

  // Check temporal particles
  if (effectName === 'temporal-rift') {
    return TEMPORAL_RIFT_PARTICLES;
  }

  return null;
}

/**
 * Map event types to particle effects
 */
export function mapEventToParticleEffect(eventType: string): string | null {
  const eventParticleMap: Record<string, string> = {
    // ALPHA_M15: Combat feedback effects
    COMBAT_HIT: 'impact',
    CRITICAL_HIT: 'critical',
    // Spell effects
    CAST_SPELL: 'spell', // Generic spell effect
    SPELL_HIT: 'fireball',
    // Status effects
    STATUS_APPLIED_WITH_DURATION: 'frozen', // Default, can be overridden by status type
    // Environmental
    HAZARD_DAMAGE: 'volcanic',
    // Temporal effects
    TEMPORAL_ANOMALY: 'temporal-rift',
    PARADOX_GLITCH: 'system_glitch', // ALPHA_M15: Visual anomalies
    RELIC_REBELLION: 'temporal-rift',
    WORLD_EVENT: 'temporal'
  };

  return eventParticleMap[eventType] || null;
}

/**
 * Trigger particle effect for a specific event
 * Used by ParticleVisualizer to render particles when events occur
 */
export function triggerParticleEffectForEvent(
  eventType: string,
  payload?: any
): { effectName: string; config: ParticleConfig | null; duration: number } {
  let effectName = mapEventToParticleEffect(eventType) || 'default';

  // ALPHA_M15: Handle combat feedback effects with magnitude scaling
  if (eventType === 'COMBAT_HIT' && payload?.impactMagnitude) {
    effectName = 'impact';
    // impactMagnitude (0.1-3.0+) can be used by ParticleVisualizer for scaling
  }

  if (eventType === 'CRITICAL_HIT') {
    effectName = 'critical';
  }

  // Handle status effects
  if (eventType === 'STATUS_APPLIED_WITH_DURATION' && payload?.statusEffect) {
    const statusType = payload.statusEffect.toLowerCase();
    if (statusType in STATUS_PARTICLES) {
      effectName = statusType;
    }
  }

  // ALPHA_M15: Handle spell effects with elemental variations
  if (eventType === 'CAST_SPELL') {
    // First, check for visualElement (fire, frost, shadow, arcane)
    if (payload?.visualElement) {
      const visualElement = payload.visualElement.toLowerCase();
      if (visualElement in ELEMENTAL_SPELL_PARTICLES) {
        effectName = visualElement;
      } else if (payload?.spellDiscipline) {
        // Fallback to spellDiscipline mapping
        switch (payload.spellDiscipline) {
          case 'ruin':
            effectName = 'fire';
            break;
          case 'flux':
            effectName = 'arcane';
            break;
          case 'life':
            effectName = 'heal';
            break;
          case 'veil':
            effectName = 'shadow';
            break;
          default:
            effectName = 'arcane';
        }
      }
    } else if (payload?.spellDiscipline) {
      // Map spell discipline to particle effect
      switch (payload.spellDiscipline) {
        case 'ruin':
          effectName = 'fire';
          break;
        case 'flux':
          effectName = 'arcane';
          break;
        case 'life':
          effectName = 'heal';
          break;
        case 'veil':
          effectName = 'shadow';
          break;
        default:
          effectName = 'arcane';
      }
    }
  }

  // Handle hazard effects
  if (eventType === 'HAZARD_DAMAGE' && payload?.hazardType) {
    switch (payload.hazardType) {
      case 'volcanic':
        effectName = 'volcanic';
        break;
      case 'toxic':
        effectName = 'toxic';
        break;
      default:
        effectName = 'hazard';
    }
  }

  // ALPHA_M15: Handle paradox glitch effects
  if (eventType === 'PARADOX_GLITCH') {
    effectName = 'system_glitch';
  }

  const config = getParticleConfig(effectName);
  let duration = config?.lifetime || 2;

  // ALPHA_M15: Critical hits and paradox events trigger extended visualization
  if (eventType === 'CRITICAL_HIT') {
    duration = 1.5; // Slightly longer than impact for drama
  }

  // Temporal anomalies and paradox events have extended duration
  if (eventType === 'TEMPORAL_ANOMALY' || eventType === 'RELIC_REBELLION' || eventType === 'PARADOX_GLITCH') {
    duration = 3; // Longer duration for dramatic effect
  }

  return { effectName, config, duration };
}

/**
 * Calculate particle spawn point based on effect type and location
 */
export function calculateParticleSpawnPoint(
  effectType: string,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  // Different effects spawn from different positions
  if (effectType === 'heal' || effectType === 'shield') {
    // Upward effects spawn from center slightly below
    return { x: centerX, y: centerY + 20 };
  }

  if (effectType === 'temporal-rift') {
    // Rift effects spawn in a circle around center
    const angle = Math.random() * Math.PI * 2;
    const radius = 30;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  }

  // Most effects spawn from center
  return { x: centerX, y: centerY };
}

/**
 * Generate particle effect registry for dev tools
 */
export function getAvailableEffects(): ParticleEffect[] {
  const effects: ParticleEffect[] = [];

  // Weather
  Object.entries(WEATHER_PARTICLES).forEach(([name, config]) => {
    effects.push({ id: `weather-${name}`, name: `Weather: ${name}`, enabled: true, config });
  });

  // Spells
  Object.entries(SPELL_PARTICLES).forEach(([name, config]) => {
    effects.push({ id: `spell-${name}`, name: `Spell: ${name}`, enabled: true, config });
  });

  // Status Effects
  Object.entries(STATUS_PARTICLES).forEach(([name, config]) => {
    effects.push({ id: `status-${name}`, name: `Status: ${name}`, enabled: true, config });
  });

  // Hazards
  Object.entries(HAZARD_PARTICLES).forEach(([name, config]) => {
    effects.push({ id: `hazard-${name}`, name: `Hazard: ${name}`, enabled: true, config });
  });

  // Temporal (ALPHA_M5)
  effects.push({
    id: 'temporal-rift',
    name: 'Temporal Rift (ALPHA_M5)',
    enabled: true,
    config: TEMPORAL_RIFT_PARTICLES
  });

  return effects;
}
