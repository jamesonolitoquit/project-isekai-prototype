/**
 * Phase 32: ParticleSurface Component
 * Phase 34 Extension: Theme-driven particle profile selection
 * Phase 37 Extension: Event-driven BurstHook for turn-based particle effects
 * 
 * Renders ambient particle effects on the tabletop surface
 * - Responds to world state (spirit density, paradox level, weather)
 * - Responds to active narrative codec's particle profile
 * - Uses canvas for efficient rendering
 * - Integrates with CSS 3D perspective of TabletopContainer
 * - Phase 37: Supports event-driven particle bursts (Spell Impact, Dice Glow, etc)
 * 
 * Particles:
 * - Spirit Shimmer: Gentle floating lights (normal/mystical state)
 * - Embers: Drifting fiery particles (combat/chaos state)
 * - Chronoshards: Temporal fragments (high paradox)
 * - Themed variants: leaf, void, ash, stardust, dream (per codec profile)
 * - Burst effects: Dynamic particles from turn events (Phase 37)
 */

import React, { useEffect, useRef, useMemo } from 'react';
import type { ParticleProfile } from '../services/themeManager';

interface ParticleSurfaceProps {
  worldState?: {
    paradoxLevel?: number;
    spiritDensity?: number;
    isInCombat?: boolean;
    biome?: string;
  };
  particleProfile?: ParticleProfile;
  // Phase 45: Tile-specific particle effects
  tileEffects?: Array<{
    tileX: number;
    tileY: number;
    type: 'burning' | 'cursed' | 'sacred';
    intensity?: number;
  }>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: 'spirit' | 'ember' | 'chronoshard' | 'spell-burst' | 'dice-glow' | 'critical-impact' | 'tile-ember' | 'tile-void' | 'tile-golden';
  opacity: number;
}

// Phase 37: Global particle burst emitter for event-driven effects
export interface VisualEventEmitter {
  emitBurst(x: number, y: number, type: 'spell-impact' | 'dice-glow' | 'critical-hit' | 'paradox-surge', intensity?: number): void;
}

let globalBurstEmitter: VisualEventEmitter | null = null;

export function setGlobalBurstEmitter(emitter: VisualEventEmitter): void {
  globalBurstEmitter = emitter;
}

export function getGlobalBurstEmitter(): VisualEventEmitter | null {
  return globalBurstEmitter;
}

export default function ParticleSurface({ worldState, particleProfile, tileEffects }: ParticleSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const paradoxLevel = worldState?.paradoxLevel ?? 0;
  const spiritDensity = worldState?.spiritDensity ?? 0.5;
  const isInCombat = worldState?.isInCombat ?? false;

  // Determine particle emission rate based on world state
  const emissionRate = useMemo(() => {
    if (isInCombat) return 3; // 3 embers per frame in combat
    if (paradoxLevel > 50) return 2; // 2 chronoshards when paradox high
    return 1; // 1 spirit shimmer in normal state
  }, [isInCombat, paradoxLevel]);

  // Phase 45: Create tile-specific particles for environmental effects
  const createTileParticle = (tileType: 'burning' | 'cursed' | 'sacred', screenX: number, screenY: number): Particle => {
    if (tileType === 'burning') {
      // Burning tile: orange embers rising
      const angle = (Math.random() - 0.5) * Math.PI / 3;
      return {
        x: screenX + (Math.random() - 0.5) * 30,
        y: screenY + (Math.random() - 0.5) * 20,
        vx: Math.sin(angle) * 0.5,
        vy: -Math.random() * 0.8 - 0.5,
        life: 0,
        maxLife: Math.random() * 40 + 30,
        size: Math.random() * 3 + 1,
        type: 'tile-ember',
        opacity: Math.random() * 0.7 + 0.3
      };
    } else if (tileType === 'cursed') {
      // Cursed tile: dark void smoke swirling
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.4 + 0.2;
      return {
        x: screenX + Math.cos(angle) * 20,
        y: screenY + Math.sin(angle) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 0.2,
        life: 0,
        maxLife: Math.random() * 60 + 40,
        size: Math.random() * 4 + 2,
        type: 'tile-void',
        opacity: Math.random() * 0.4 + 0.2
      };
    } else { // sacred
      // Sacred tile: golden dust floating
      return {
        x: screenX + (Math.random() - 0.5) * 40,
        y: screenY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.sin(Math.random() * Math.PI) * 0.3,
        life: 0,
        maxLife: Math.random() * 50 + 60,
        size: Math.random() * 2 + 0.5,
        type: 'tile-golden',
        opacity: Math.random() * 0.5 + 0.3
      };
    }
  };

  // Create a particle based on current world state
  const createParticle = (burstType?: 'spell-burst' | 'dice-glow' | 'critical-impact'): Particle => {
    if (burstType === 'spell-burst') {
      // Spell impact burst: radiating colored particles
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      return {
        x: 400, // Center of canvas
        y: 300,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: Math.random() * 40 + 20,
        size: Math.random() * 5 + 2,
        type: 'spell-burst',
        opacity: Math.random() * 0.8 + 0.5
      };
    } else if (burstType === 'dice-glow') {
      // Dice glow: golden sparkles
      return {
        x: 400 + (Math.random() - 0.5) * 20,
        y: 300 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        life: 0,
        maxLife: Math.random() * 30 + 15,
        size: Math.random() * 2 + 1,
        type: 'dice-glow',
        opacity: 0.9
      };
    } else if (burstType === 'critical-impact') {
      // Critical hit: explosive bright burst
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      return {
        x: 400,
        y: 300,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: Math.random() * 50 + 30,
        size: Math.random() * 6 + 2,
        type: 'critical-impact',
        opacity: 1.0
      };
    } else if (isInCombat) {
      // Ember particle
      return {
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.2 - 0.5, // Drift up
        life: 0,
        maxLife: Math.random() * 60 + 40,
        size: Math.random() * 4 + 2,
        type: 'ember',
        opacity: Math.random() * 0.6 + 0.4
      };
    } else if (paradoxLevel > 50) {
      // Chronoshard particle
      return {
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        life: 0,
        maxLife: Math.random() * 80 + 60,
        size: Math.random() * 3 + 1,
        type: 'chronoshard',
        opacity: Math.random() * 0.4 + 0.3
      };
    } else {
      // Spirit shimmer
      return {
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        life: 0,
        maxLife: Math.random() * 100 + 80,
        size: Math.random() * 2 + 0.5,
        type: 'spirit',
        opacity: Math.random() * 0.3 + 0.2
      };
    }
  };

  // Phase 37: Create burst effect callback
  const emitBurst = (x: number, y: number, type: 'spell-impact' | 'dice-glow' | 'critical-hit' | 'paradox-surge', intensity: number = 1) => {
    const burstCount = Math.round(intensity * (type === 'critical-hit' ? 20 : type === 'spell-impact' ? 15 : 10));
    for (let i = 0; i < burstCount; i++) {
      const particle = createParticle(type === 'critical-hit' ? 'critical-impact' : type === 'spell-impact' ? 'spell-burst' : 'dice-glow');
      // Override position if provided
      if (x !== undefined && y !== undefined) {
        particle.x = x;
        particle.y = y;
      }
      particlesRef.current.push(particle);
    }
  };

  // Register burst emitter on mount
  useEffect(() => {
    const emitter: VisualEventEmitter = { emitBurst };
    setGlobalBurstEmitter(emitter);
    return () => {
      setGlobalBurstEmitter(null);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const animate = () => {
      // Clear canvas with slight fade for motion blur effect
      ctx.fillStyle = 'rgba(13, 13, 26, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add new particles based on emission rate
      for (let i = 0; i < emissionRate; i++) {
        if (Math.random() < 0.3) { // 30% chance per frame per rate
          particlesRef.current.push(createParticle());
        }
      }

      // Phase 45: Emit tile-specific particles
      if (tileEffects && tileEffects.length > 0) {
        tileEffects.forEach(effect => {
          // Convert tile coordinates to screen coordinates (approximate isometric projection)
          const screenX = canvas.width / 2 + (effect.tileX - effect.tileY) * 20;
          const screenY = canvas.height / 2 + (effect.tileX + effect.tileY) * 10;
          
          // Emit particles based on tile intensity
          const intensity = effect.intensity ?? 1;
          for (let i = 0; i < Math.ceil(intensity); i++) {
            if (Math.random() < 0.4) {
              particlesRef.current.push(createTileParticle(effect.type, screenX, screenY));
            }
          }
        });
      }

      // Update and render particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.life += 1;

        // Apply physics
        p.x += p.vx;
        p.y += p.vy;

        // Slight gravity effect for non-spirit particles
        if (p.type !== 'spirit') {
          p.vy += 0.05;
        }

        // Wrap around edges for spirit particles only
        if (p.type === 'spirit') {
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
        }

        // Calculate fade-out at end of life
        const lifeRatio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (lifeRatio > 0.8) {
          alpha *= (1 - (lifeRatio - 0.8) / 0.2); // Fade out last 20% of life
        }

        // Render particle based on type
        if (p.type === 'spirit') {
          // Glowing blue-purple shimmer
          ctx.fillStyle = `rgba(100, 150, 200, ${alpha * 0.6})`;
          ctx.shadowColor = 'rgba(100, 150, 255, 0.8)';
          ctx.shadowBlur = p.size * 2;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else if (p.type === 'ember') {
          // Glowing orange-red flame
          ctx.fillStyle = `rgba(255, ${100 + Math.sin(p.life * 0.1) * 50}, 50, ${alpha})`;
          ctx.shadowColor = 'rgba(255, 100, 0, 0.8)';
          ctx.shadowBlur = p.size * 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'chronoshard') {
          // Purple glitchy shard
          ctx.fillStyle = `rgba(192, 100, 255, ${alpha * 0.7})`;
          ctx.shadowColor = 'rgba(192, 100, 255, 0.9)';
          ctx.shadowBlur = p.size * 2;
          // Draw small diamond shape
          const size = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - size);
          ctx.lineTo(p.x + size, p.y);
          ctx.lineTo(p.x, p.y + size);
          ctx.lineTo(p.x - size, p.y);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'spell-burst') {
          // Radiant spell burst: bright cyan to purple
          const hue = 200 + Math.sin(p.life * 0.2) * 30;
          ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
          ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
          ctx.shadowBlur = p.size * 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'dice-glow') {
          // Golden sparkle
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.8})`;
          ctx.shadowColor = 'rgba(255, 215, 0, 1)';
          ctx.shadowBlur = p.size * 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'critical-impact') {
          // Bright white explosion
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = 'rgba(255, 200, 0, 1)';
          ctx.shadowBlur = p.size * 5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'tile-ember') {
          // Phase 45: Burning tile - orange rising embers
          ctx.fillStyle = `rgba(255, ${120 + Math.sin(p.life * 0.15) * 60}, 30, ${alpha})`;
          ctx.shadowColor = 'rgba(255, 100, 0, 0.6)';
          ctx.shadowBlur = p.size * 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'tile-void') {
          // Phase 45: Cursed tile - dark purple void wisps
          ctx.fillStyle = `rgba(${80 + Math.sin(p.life * 0.1) * 40}, 40, ${100 + Math.cos(p.life * 0.12) * 40}, ${alpha * 0.6})`;
          ctx.shadowColor = 'rgba(100, 50, 150, 0.5)';
          ctx.shadowBlur = p.size * 1.5;
          // Draw wispy shape
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y);
          ctx.quadraticCurveTo(p.x - p.size / 2, p.y - p.size / 2, p.x, p.y - p.size);
          ctx.quadraticCurveTo(p.x + p.size / 2, p.y - p.size / 2, p.x + p.size, p.y);
          ctx.quadraticCurveTo(p.x + p.size / 2, p.y + p.size / 2, p.x, p.y + p.size);
          ctx.quadraticCurveTo(p.x - p.size / 2, p.y + p.size / 2, p.x - p.size, p.y);
          ctx.fill();
        } else if (p.type === 'tile-golden') {
          // Phase 45: Sacred tile - golden dust particles
          ctx.fillStyle = `rgba(255, ${200 + Math.sin(p.life * 0.08) * 40}, 100, ${alpha * 0.7})`;
          ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
          ctx.shadowBlur = p.size * 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Keep particle if still alive
        return p.life < p.maxLife;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [emissionRate, tileEffects]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        filter: 'brightness(0.9)'
      }}
    />
  );
}
