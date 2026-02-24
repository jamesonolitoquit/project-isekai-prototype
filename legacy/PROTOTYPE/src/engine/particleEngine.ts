/**
 * M36: Particle Engine - Temporal Morphing
 * 
 * Manages visual particle effects that adapt and morph based on the current epoch.
 * - Epoch I: Orchestral particles (clean, crystalline, geometric)
 * - Epoch II: Blended particles (temporal echoes, semi-transparent overlays)
 * - Epoch III: Glitched particles (fractured, distorted, corrupted rendering)
 */

/**
 * Particle preset configuration per epoch
 */
export type ParticlePreset = {
  name: string;
  epoch: 'I' | 'II' | 'III';
  particleShape: 'crystal' | 'sphere' | 'shard' | 'echo' | 'glitch' | 'spiral';
  baseColor: string;
  secondaryColor?: string;
  glitchColor?: string;
  emissionRate: number;  // Particles per second
  lifespan: number;      // Milliseconds
  velocity: { x: number; y: number; z: number };
  acceleration: { x: number; y: number; z: number };
  scale: number;
  scaleVariation: number;
  alpha: number;
  alphaDecay: number;    // Alpha reduction per ms
  rotationSpeed: number;
  bloomIntensity: number;
  distortionStrength: number;  // 0 = none, 1 = max glitch
  temporalEchoCount: number;   // For Epoch II: number of echo particles
  frequencyHz?: number;  // Oscillation frequency for echo effects
};

/**
 * Particle system state for a location or entity
 */
export type ParticleSystemState = {
  id: string;
  locationId?: string;
  entityId?: string;
  activeParticles: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    createdAt: number;
    lifespan: number;
    scale: number;
    alpha: number;
    rotation: number;
  }>;
  preset: ParticlePreset;
  currentEpoch: 'I' | 'II' | 'III';
  lastMorphedAt: number;
};

/**
 * M36: Get the particle preset for a given epoch and environment type
 */
export function getEpochParticlePreset(
  epoch: 'I' | 'II' | 'III',
  environmentType: 'forest' | 'cave' | 'ruins' | 'city' | 'sacred' | 'twisted' = 'forest'
): ParticlePreset {
  const presets: Record<string, Record<string, ParticlePreset>> = {
    'I': {
      forest: {
        name: 'Epoch I: Crystalline Flora',
        epoch: 'I',
        particleShape: 'crystal',
        baseColor: '#a8e6cf',
        secondaryColor: '#ffd3b6',
        emissionRate: 120,
        lifespan: 2000,
        velocity: { x: 0.5, y: 0.8, z: 0.2 },
        acceleration: { x: 0.01, y: -0.15, z: 0.01 },
        scale: 0.05,
        scaleVariation: 0.02,
        alpha: 0.8,
        alphaDecay: 0.0004,
        rotationSpeed: 45,
        bloomIntensity: 0.3,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
      cave: {
        name: 'Epoch I: Luminous Crystals',
        epoch: 'I',
        particleShape: 'crystal',
        baseColor: '#8ecae6',
        secondaryColor: '#ffb4a2',
        emissionRate: 90,
        lifespan: 2500,
        velocity: { x: 0.3, y: 0.5, z: 0.3 },
        acceleration: { x: 0.005, y: -0.1, z: 0.005 },
        scale: 0.07,
        scaleVariation: 0.03,
        alpha: 0.9,
        alphaDecay: 0.00035,
        rotationSpeed: 60,
        bloomIntensity: 0.5,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
      ruins: {
        name: 'Epoch I: Dust Motes',
        epoch: 'I',
        particleShape: 'sphere',
        baseColor: '#e0aaff',
        secondaryColor: '#d0a9ff',
        emissionRate: 150,
        lifespan: 3000,
        velocity: { x: 0.2, y: 0.3, z: 0.2 },
        acceleration: { x: 0, y: -0.05, z: 0 },
        scale: 0.03,
        scaleVariation: 0.01,
        alpha: 0.6,
        alphaDecay: 0.0002,
        rotationSpeed: 20,
        bloomIntensity: 0.1,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
      city: {
        name: 'Epoch I: Prismatic Light',
        epoch: 'I',
        particleShape: 'crystal',
        baseColor: '#ffffbf',
        secondaryColor: '#ffdfba',
        emissionRate: 200,
        lifespan: 1500,
        velocity: { x: 1, y: 1, z: 0.5 },
        acceleration: { x: 0.02, y: -0.2, z: 0.02 },
        scale: 0.04,
        scaleVariation: 0.015,
        alpha: 0.85,
        alphaDecay: 0.00055,
        rotationSpeed: 90,
        bloomIntensity: 0.4,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
      sacred: {
        name: 'Epoch I: Celestial Aura',
        epoch: 'I',
        particleShape: 'spiral',
        baseColor: '#ffffff',
        secondaryColor: '#ffe066',
        emissionRate: 100,
        lifespan: 3500,
        velocity: { x: 0.4, y: 0.9, z: 0.4 },
        acceleration: { x: 0.01, y: -0.08, z: 0.01 },
        scale: 0.06,
        scaleVariation: 0.025,
        alpha: 0.95,
        alphaDecay: 0.00025,
        rotationSpeed: 120,
        bloomIntensity: 0.8,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
      twisted: {
        name: 'Epoch I: Corrupted Shards',
        epoch: 'I',
        particleShape: 'shard',
        baseColor: '#ff6b6b',
        secondaryColor: '#ee5a6f',
        emissionRate: 110,
        lifespan: 2200,
        velocity: { x: 0.6, y: 0.4, z: 0.6 },
        acceleration: { x: 0.02, y: -0.12, z: 0.02 },
        scale: 0.05,
        scaleVariation: 0.025,
        alpha: 0.7,
        alphaDecay: 0.00035,
        rotationSpeed: 75,
        bloomIntensity: 0.2,
        distortionStrength: 0,
        temporalEchoCount: 0,
      },
    },
    'II': {
      forest: {
        name: 'Epoch II: Temporal Echo Flora',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#a8e6cf',
        secondaryColor: '#ffd3b6',
        emissionRate: 180,
        lifespan: 3000,
        velocity: { x: 0.4, y: 0.6, z: 0.2 },
        acceleration: { x: 0.008, y: -0.12, z: 0.008 },
        scale: 0.06,
        scaleVariation: 0.025,
        alpha: 0.65,
        alphaDecay: 0.00025,
        rotationSpeed: 30,
        bloomIntensity: 0.25,
        distortionStrength: 0.2,
        temporalEchoCount: 3,
        frequencyHz: 2,
      },
      cave: {
        name: 'Epoch II: Temporal Luminescence',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#8ecae6',
        secondaryColor: '#ffb4a2',
        emissionRate: 140,
        lifespan: 3500,
        velocity: { x: 0.25, y: 0.4, z: 0.25 },
        acceleration: { x: 0.004, y: -0.08, z: 0.004 },
        scale: 0.08,
        scaleVariation: 0.03,
        alpha: 0.7,
        alphaDecay: 0.0002,
        rotationSpeed: 45,
        bloomIntensity: 0.35,
        distortionStrength: 0.15,
        temporalEchoCount: 4,
        frequencyHz: 1.5,
      },
      ruins: {
        name: 'Epoch II: Temporal Dust',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#e0aaff',
        secondaryColor: '#d0a9ff',
        emissionRate: 220,
        lifespan: 4000,
        velocity: { x: 0.15, y: 0.25, z: 0.15 },
        acceleration: { x: 0, y: -0.03, z: 0 },
        scale: 0.04,
        scaleVariation: 0.015,
        alpha: 0.5,
        alphaDecay: 0.00015,
        rotationSpeed: 15,
        bloomIntensity: 0.08,
        distortionStrength: 0.25,
        temporalEchoCount: 5,
        frequencyHz: 1,
      },
      city: {
        name: 'Epoch II: Temporal Shimmer',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#ffffbf',
        secondaryColor: '#ffdfba',
        emissionRate: 280,
        lifespan: 2500,
        velocity: { x: 0.8, y: 0.8, z: 0.4 },
        acceleration: { x: 0.015, y: -0.15, z: 0.015 },
        scale: 0.05,
        scaleVariation: 0.02,
        alpha: 0.7,
        alphaDecay: 0.00035,
        rotationSpeed: 60,
        bloomIntensity: 0.3,
        distortionStrength: 0.2,
        temporalEchoCount: 3,
        frequencyHz: 2.5,
      },
      sacred: {
        name: 'Epoch II: Temporal Divinity',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#ffffff',
        secondaryColor: '#ffe066',
        emissionRate: 150,
        lifespan: 4500,
        velocity: { x: 0.3, y: 0.7, z: 0.3 },
        acceleration: { x: 0.008, y: -0.06, z: 0.008 },
        scale: 0.07,
        scaleVariation: 0.03,
        alpha: 0.8,
        alphaDecay: 0.0002,
        rotationSpeed: 90,
        bloomIntensity: 0.6,
        distortionStrength: 0.1,
        temporalEchoCount: 4,
        frequencyHz: 0.8,
      },
      twisted: {
        name: 'Epoch II: Temporal Corruption',
        epoch: 'II',
        particleShape: 'echo',
        baseColor: '#ff6b6b',
        secondaryColor: '#ee5a6f',
        emissionRate: 160,
        lifespan: 3200,
        velocity: { x: 0.5, y: 0.35, z: 0.5 },
        acceleration: { x: 0.015, y: -0.1, z: 0.015 },
        scale: 0.06,
        scaleVariation: 0.028,
        alpha: 0.6,
        alphaDecay: 0.0003,
        rotationSpeed: 50,
        bloomIntensity: 0.15,
        distortionStrength: 0.3,
        temporalEchoCount: 3,
        frequencyHz: 3,
      },
    },
    'III': {
      forest: {
        name: 'Epoch III: Glitched Flora',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#4affff',
        glitchColor: '#ff00ff',
        emissionRate: 250,
        lifespan: 1500,
        velocity: { x: 1.2, y: 0.5, z: 0.8 },
        acceleration: { x: 0.05, y: -0.08, z: 0.05 },
        scale: 0.07,
        scaleVariation: 0.04,
        alpha: 0.9,
        alphaDecay: 0.0006,
        rotationSpeed: 180,
        bloomIntensity: 0.2,
        distortionStrength: 0.9,
        temporalEchoCount: 0,
      },
      cave: {
        name: 'Epoch III: Fractured Crystals',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#00ffff',
        glitchColor: '#ff0080',
        emissionRate: 200,
        lifespan: 1800,
        velocity: { x: 0.9, y: 0.4, z: 0.9 },
        acceleration: { x: 0.04, y: -0.06, z: 0.04 },
        scale: 0.08,
        scaleVariation: 0.045,
        alpha: 0.95,
        alphaDecay: 0.0005,
        rotationSpeed: 200,
        bloomIntensity: 0.3,
        distortionStrength: 0.95,
        temporalEchoCount: 0,
      },
      ruins: {
        name: 'Epoch III: Reality Shattering',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#00ff88',
        glitchColor: '#ff00ff',
        emissionRate: 280,
        lifespan: 1200,
        velocity: { x: 0.8, y: 0.3, z: 0.8 },
        acceleration: { x: 0.08, y: -0.04, z: 0.08 },
        scale: 0.05,
        scaleVariation: 0.035,
        alpha: 0.8,
        alphaDecay: 0.00075,
        rotationSpeed: 160,
        bloomIntensity: 0.15,
        distortionStrength: 1,
        temporalEchoCount: 0,
      },
      city: {
        name: 'Epoch III: Glitched Civilization',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#ffff00',
        glitchColor: '#00ffff',
        emissionRate: 320,
        lifespan: 1000,
        velocity: { x: 1.5, y: 0.6, z: 1.2 },
        acceleration: { x: 0.06, y: -0.1, z: 0.06 },
        scale: 0.06,
        scaleVariation: 0.03,
        alpha: 0.85,
        alphaDecay: 0.00085,
        rotationSpeed: 240,
        bloomIntensity: 0.25,
        distortionStrength: 0.85,
        temporalEchoCount: 0,
      },
      sacred: {
        name: 'Epoch III: Corrupted Divinity',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#ff00ff',
        glitchColor: '#00ffff',
        emissionRate: 180,
        lifespan: 2000,
        velocity: { x: 0.6, y: 0.8, z: 0.6 },
        acceleration: { x: 0.03, y: -0.12, z: 0.03 },
        scale: 0.09,
        scaleVariation: 0.05,
        alpha: 0.9,
        alphaDecay: 0.00045,
        rotationSpeed: 220,
        bloomIntensity: 0.5,
        distortionStrength: 0.8,
        temporalEchoCount: 0,
      },
      twisted: {
        name: 'Epoch III: Total Corruption',
        epoch: 'III',
        particleShape: 'glitch',
        baseColor: '#ff2080',
        glitchColor: '#00ff00',
        emissionRate: 240,
        lifespan: 1600,
        velocity: { x: 1.1, y: 0.5, z: 1.1 },
        acceleration: { x: 0.07, y: -0.09, z: 0.07 },
        scale: 0.07,
        scaleVariation: 0.04,
        alpha: 0.88,
        alphaDecay: 0.00062,
        rotationSpeed: 190,
        bloomIntensity: 0.18,
        distortionStrength: 1,
        temporalEchoCount: 0,
      },
    },
  };

  return presets[epoch]?.[environmentType] || presets[epoch]?.forest;
}

/**
 * M36: Calculate the morphing speed based on epoch transition
 */
export function calculateParticleMorphSpeed(
  fromEpoch: 'I' | 'II' | 'III',
  toEpoch: 'I' | 'II' | 'III',
  transitionDurationMs: number = 5000
): number {
  // Speed is particles morphed per ms
  // More dramatic transitions (I->III) may need faster morphing
  const epochDistance = Math.abs(
    ['I', 'II', 'III'].indexOf(fromEpoch) - ['I', 'II', 'III'].indexOf(toEpoch)
  );

  // Base speed: transition all particles over duration
  // Adjusted for distance to make dramatic transitions feel faster
  const baseSpeed = (100 * (epochDistance + 1)) / transitionDurationMs;
  return Math.max(0.01, Math.min(10, baseSpeed));
}

/**
 * M36: Morph a particle system from one epoch to another
 */
export function morphParticlesToEpoch(
  particleSystem: ParticleSystemState,
  targetEpoch: 'I' | 'II' | 'III',
  environmentType: 'forest' | 'cave' | 'ruins' | 'city' | 'sacred' | 'twisted' = 'forest',
  transitionDurationMs: number = 5000
): ParticleSystemState {
  const fromEpoch = particleSystem.currentEpoch;
  
  if (fromEpoch === targetEpoch) {
    // Already in target epoch
    return particleSystem;
  }

  const newPreset = getEpochParticlePreset(targetEpoch, environmentType);
  const morphSpeed = calculateParticleMorphSpeed(fromEpoch, targetEpoch, transitionDurationMs);

  // Interpolate between current and target preset properties
  const interpolateValue = (current: number, target: number, progress: number) => {
    return current + (target - current) * Math.min(1, progress * 0.5);  // Smooth interpolation over half the duration
  };

  // Create morphed preset by interpolating key values
  const morphedPreset: ParticlePreset = {
    ...newPreset,
    emissionRate: interpolateValue(particleSystem.preset.emissionRate, newPreset.emissionRate, morphSpeed),
    velocity: {
      x: interpolateValue(particleSystem.preset.velocity.x, newPreset.velocity.x, morphSpeed),
      y: interpolateValue(particleSystem.preset.velocity.y, newPreset.velocity.y, morphSpeed),
      z: interpolateValue(particleSystem.preset.velocity.z, newPreset.velocity.z, morphSpeed),
    },
    acceleration: {
      x: interpolateValue(particleSystem.preset.acceleration.x, newPreset.acceleration.x, morphSpeed),
      y: interpolateValue(particleSystem.preset.acceleration.y, newPreset.acceleration.y, morphSpeed),
      z: interpolateValue(particleSystem.preset.acceleration.z, newPreset.acceleration.z, morphSpeed),
    },
    scale: interpolateValue(particleSystem.preset.scale, newPreset.scale, morphSpeed),
    alpha: interpolateValue(particleSystem.preset.alpha, newPreset.alpha, morphSpeed),
    distortionStrength: interpolateValue(particleSystem.preset.distortionStrength, newPreset.distortionStrength, morphSpeed),
  };

  return {
    ...particleSystem,
    preset: morphedPreset,
    currentEpoch: targetEpoch,
    lastMorphedAt: Date.now(),
  };
}

/**
 * M36: Generate visual effect string for particle rendering UI
 */
export function generateParticleVisualEffect(
  preset: ParticlePreset,
  intensity: number = 1
): string {
  const glitchFactor = preset.distortionStrength * intensity;
  
  switch (preset.particleShape) {
    case 'crystal':
      return `radial-gradient(circle, ${preset.baseColor} 0%, ${preset.secondaryColor || preset.baseColor} 100%)`;
    case 'sphere':
      return `radial-gradient(ellipse at 30% 30%, ${preset.baseColor}, ${preset.secondaryColor || preset.baseColor})`;
    case 'shard':
      return `conic-gradient(from 45deg, ${preset.baseColor}, ${preset.secondaryColor || preset.baseColor}, ${preset.baseColor})`;
    case 'echo':
      return `radial-gradient(circle, ${preset.baseColor} 0%, transparent 70%), radial-gradient(circle, ${preset.secondaryColor || preset.baseColor} 0%, transparent 50%)`;
    case 'glitch': {
      const glitchBlend = Math.round(glitchFactor * 255);
      return `conic-gradient(${preset.baseColor} 0deg, ${preset.glitchColor || preset.baseColor} ${glitchBlend}deg, ${preset.baseColor} 360deg)`;
    }
    case 'spiral':
      return `conic-gradient(${preset.baseColor}, ${preset.secondaryColor || preset.baseColor}, ${preset.baseColor}, ${preset.baseColor})`;
    default:
      return `radial-gradient(circle, ${preset.baseColor}, transparent)`;
  }
}

/**
 * M36: Create initial particle system for a location
 */
export function createParticleSystem(
  locationId: string,
  epoch: 'I' | 'II' | 'III',
  environmentType: 'forest' | 'cave' | 'ruins' | 'city' | 'sacred' | 'twisted' = 'forest'
): ParticleSystemState {
  const preset = getEpochParticlePreset(epoch, environmentType);
  
  return {
    id: `particles-${locationId}-${Date.now()}`,
    locationId,
    activeParticles: [],
    preset,
    currentEpoch: epoch,
    lastMorphedAt: Date.now(),
  };
}

/**
 * M36: Update particle system each frame (spawn new, age existing)
 */
export function updateParticleSystem(
  system: ParticleSystemState,
  deltaTimeMs: number
): ParticleSystemState {
  const now = Date.now();
  const { preset } = system;
  
  // Remove dead particles
  const updatedParticles = system.activeParticles
    .filter(p => (now - p.createdAt) < p.lifespan)
    .map(p => ({
      ...p,
      alpha: p.alpha - (preset.alphaDecay * deltaTimeMs),
      position: {
        x: p.position.x + p.velocity.x * (deltaTimeMs / 1000),
        y: p.position.y + p.velocity.y * (deltaTimeMs / 1000),
        z: p.position.z + p.velocity.z * (deltaTimeMs / 1000),
      },
      velocity: {
        x: p.velocity.x + preset.acceleration.x * (deltaTimeMs / 1000),
        y: p.velocity.y + preset.acceleration.y * (deltaTimeMs / 1000),
        z: p.velocity.z + preset.acceleration.z * (deltaTimeMs / 1000),
      },
      rotation: p.rotation + (preset.rotationSpeed * (deltaTimeMs / 1000)),
    }))
    .filter(p => p.alpha > 0);

  // Spawn new particles
  const particlesToSpawn = Math.floor((preset.emissionRate * deltaTimeMs) / 1000);
  const newParticles = Array.from({ length: particlesToSpawn }, () => ({
    id: `particle-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    position: { x: 0, y: 0, z: 0 },
    velocity: {
      x: preset.velocity.x + (Math.random() - 0.5) * 0.2,
      y: preset.velocity.y + (Math.random() - 0.5) * 0.2,
      z: preset.velocity.z + (Math.random() - 0.5) * 0.2,
    },
    createdAt: now,
    lifespan: preset.lifespan + (Math.random() - 0.5) * 200,
    scale: preset.scale + (Math.random() - 0.5) * preset.scaleVariation * 2,
    alpha: preset.alpha,
    rotation: Math.random() * 360,
  }));

  return {
    ...system,
    activeParticles: [...updatedParticles, ...newParticles],
  };
}

/**
 * M36: Get particle diagnostics for debugging
 */
export function getParticleDiagnostics(system: ParticleSystemState): Record<string, any> {
  const preset = system.preset;
  
  return {
    systemId: system.id,
    locationId: system.locationId,
    epoch: system.currentEpoch,
    particleShape: preset.particleShape,
    activeParticleCount: system.activeParticles.length,
    emissionRate: preset.emissionRate,
    averageLifespan: preset.lifespan,
    bloomIntensity: preset.bloomIntensity,
    distortionStrength: preset.distortionStrength,
    lastMorphedAt: system.lastMorphedAt,
    avgAlpha: system.activeParticles.length > 0
      ? system.activeParticles.reduce((sum, p) => sum + p.alpha, 0) / system.activeParticles.length
      : 0,
  };
}
