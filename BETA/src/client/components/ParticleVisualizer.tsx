import React, { useEffect, useRef, useState } from 'react';
import { WEATHER_PARTICLES, triggerParticleEffectForEvent, TEMPORAL_RIFT_PARTICLES, AMBIENT_PARTICLES } from '../../engine/particleEngine';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  baseColor?: string; // For oscillating effects
  oscillate?: boolean;
  type?: string; // 'weather', 'ambient', 'event'
}

interface EventParticleEffect {
  eventType: string;
  startTick: number;
  duration: number;
  particles: Particle[];
}

interface ParticleVisualizerProps {
  state?: any;
  recentEvent?: any; // TEMPORAL_ANOMALY or other event
  directorState?: any; // M7: For tension-based effects
}

/**
 * M7: Determine which ambient particles to show
 */
function getAmbientParticleTypes(
  weather: string,
  season: string,
  dayPhase: string,
  biome?: string
): string[] {
  const types: string[] = [];

  // Night in clear weather → fireflies
  if (dayPhase === 'night' && weather === 'clear') {
    types.push('fireflies');
  }

  // Autumn → leaves
  if (season === 'autumn') {
    types.push('leaves');
  }

  // Afternoon/evening in clear → dust motes
  if ((dayPhase === 'afternoon' || dayPhase === 'evening') && weather === 'clear') {
    types.push('dust');
  }

  // Rain → mist
  if (weather === 'rain') {
    types.push('mist');
  }

  // Forest/nature biome → spores
  if (biome === 'forest' || biome === 'nature') {
    types.push('spores');
  }

  return types;
}

export default function ParticleVisualizer({ state, recentEvent, directorState }: ParticleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ambientParticlesRef = useRef<Map<string, Particle[]>>(new Map());
  const eventEffectsRef = useRef<EventParticleEffect[]>([]);
  const animationRef = useRef<number>();
  const [currentTick, setCurrentTick] = useState(state?.tick || 0);
  
  // M15 Step 4: Track fullscreen mode for TEMPORAL_ANOMALY events
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      // M15 Step 4: Expand to fullscreen on TEMPORAL_ANOMALY, otherwise bottom 15%
      canvas.height = isFullscreen ? window.innerHeight : window.innerHeight * 0.15;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const weather = state?.weather ?? 'clear';
    const season = state?.season ?? 'spring';
    const dayPhase = state?.dayPhase ?? 'afternoon';
    const biome = state?.locations?.find((l: any) => l.id === state.player?.location)?.biome ?? 'default';

    // Get particle configuration from particleEngine
    const getParticleConfig = (w: string) => {
      const weatherConfig = WEATHER_PARTICLES[w as keyof typeof WEATHER_PARTICLES];
      if (weatherConfig) return weatherConfig;
      return WEATHER_PARTICLES['clear']; // Default to clear weather
    };

    const config = getParticleConfig(weather);

    // Initialize weather particles if weather changed
    if (!particlesRef.current.length || particlesRef.current.length !== config.count) {
      particlesRef.current = Array.from({ length: config.count }, () => createWeatherParticle(weather, season));
    }

    function createWeatherParticle(w: string, s: string): Particle {
      const particle: Particle = {
        x: Math.random() * (canvas?.width ?? window.innerWidth),
        y: Math.random() * (canvas?.height ?? window.innerHeight * 0.15),
        vx: 0,
        vy: 0,
        life: Math.random() * 0.5 + 0.5,
        maxLife: 1,
        size: config.size,
        color: config.color,
        type: 'weather'
      };

      if (w === 'rain') {
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = 3 + Math.random() * 3;
      } else if (w === 'snow') {
        particle.vx = (Math.random() - 0.5) * 1.5;
        particle.vy = 0.5 + Math.random() * 1;
      } else {
        particle.vx = (Math.random() - 0.5) * 0.5;
        particle.vy = (Math.random() - 0.5) * 0.5;
      }

      return particle;
    }

    // M7: Initialize or update ambient particles
    function updateAmbientParticles() {
      const ambientTypes = getAmbientParticleTypes(weather, season, dayPhase, biome);
      const currentAmbientKeys = new Set(ambientParticlesRef.current.keys());
      const desiredAmbientKeys = new Set(ambientTypes);

      // Remove ambient particles that are no longer needed
      currentAmbientKeys.forEach(key => {
        if (!desiredAmbientKeys.has(key)) {
          ambientParticlesRef.current.delete(key);
        }
      });

      // Add or update ambient particles
      ambientTypes.forEach(ambientType => {
        if (!ambientParticlesRef.current.has(ambientType)) {
          const ambientConfig = AMBIENT_PARTICLES[ambientType as keyof typeof AMBIENT_PARTICLES];
          if (ambientConfig) {
            const particles = Array.from({ length: ambientConfig.count }, () => createAmbientParticle(ambientType, ambientConfig));
            ambientParticlesRef.current.set(ambientType, particles);
          }
        }
      });
    }

    function createAmbientParticle(type: string, config: any): Particle {
      const particle: Particle = {
        x: Math.random() * (canvas?.width ?? window.innerWidth),
        y: Math.random() * (canvas?.height ?? window.innerHeight * 0.15),
        vx: 0,
        vy: 0,
        life: Math.random() * 0.5 + 0.5,
        maxLife: 1,
        size: config.size,
        color: config.color,
        baseColor: config.color,
        oscillate: config.oscillation ?? false,
        type: 'ambient'
      };

      if (type === 'fireflies') {
        particle.vx = (Math.random() - 0.5) * 0.5;
        particle.vy = (Math.random() - 0.5) * 0.5;
      } else if (type === 'leaves') {
        particle.vx = (Math.random() - 0.5) * 1;
        particle.vy = 0.5 + Math.random() * 1.5;
      } else if (type === 'dust') {
        particle.vx = (Math.random() - 0.5) * 0.3;
        particle.vy = (Math.random() - 0.5) * 0.2;
      } else if (type === 'mist') {
        particle.vx = (Math.random() - 0.5) * 0.4;
        particle.vy = (Math.random() - 0.5) * 0.3;
      } else if (type === 'spores') {
        particle.vx = (Math.random() - 0.5) * 0.6;
        particle.vy = -0.5 + Math.random() * 0.5;
      }

      return particle;
    }

    function updateAndRender() {
      if (!canvas || !ctx) return;
      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      // Update weather particles
      particlesRef.current = particlesRef.current.map(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;

        // Wrap around or reset
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) {
          p.y = 0;
          p.life = 1;
        }

        return p;
      });

      // Update ambient particles
      ambientParticlesRef.current.forEach((particles, ambientType) => {
        ambientParticlesRef.current.set(ambientType, particles.map(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.015; // Slower fade for ambient

          // Wrap around or reset
          if (p.x < 0) p.x = canvas!.width;
          if (p.x > canvas!.width) p.x = 0;
          if (p.y < 0) p.y = canvas!.height;
          if (p.y > canvas!.height) {
            p.y = 0;
            p.life = 1;
          }

          return p;
        }));
      });

      // Draw weather particles
      particlesRef.current.forEach(p => {
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      });

      // Draw ambient particles
      ambientParticlesRef.current.forEach(particles => {
        particles.forEach(p => {
          // Apply oscillation for fireflies (pulsing effect)
          if (p.oscillate && p.baseColor) {
            const oscillation = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
            ctx!.fillStyle = p.baseColor;
            ctx!.globalAlpha = Math.max(0, p.life) * oscillation;
          } else {
            ctx!.fillStyle = p.color;
            ctx!.globalAlpha = Math.max(0, p.life) * 0.7; // Ambient particles are slightly more transparent
          }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.fill();
        });
      });

      // Draw event particles (temporal rifts, etc.)
      eventEffectsRef.current.forEach(effect => {
        effect.particles.forEach(p => {
          // Apply oscillation for rift particles
          if (p.oscillate && p.baseColor) {
            const oscillation = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
            const purple = parseInt(p.baseColor.slice(1, 3), 16);
            const oscillatedColor = oscillation > 0.5 ? p.baseColor : '#0a0000'; // Oscillate between purple and black
            ctx!.fillStyle = oscillatedColor;
          } else {
            ctx!.fillStyle = p.color;
          }

          ctx!.globalAlpha = Math.max(0, p.life);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.fill();
        });
      });

      ctx!.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(updateAndRender);
    }

    updateAmbientParticles(); // Initialize ambient particles
    animationRef.current = requestAnimationFrame(updateAndRender);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
      if (fullscreenTimerRef.current) clearTimeout(fullscreenTimerRef.current);
    };
  }, [state?.weather, state?.season, state?.dayPhase, state?.player?.location, state?.locations, isFullscreen]);

  // Handle event-triggered particle effects (ALPHA_M5: TEMPORAL_ANOMALY)
  useEffect(() => {
    if (!recentEvent) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger particle effect for this event
    if (recentEvent.type === 'TEMPORAL_ANOMALY') {
      // M15 Step 4: Trigger fullscreen mode for 3 seconds
      setIsFullscreen(true);
      if (fullscreenTimerRef.current) clearTimeout(fullscreenTimerRef.current);
      fullscreenTimerRef.current = setTimeout(() => {
        setIsFullscreen(false);
      }, 3000);

      // Create temporal rift particles
      const riftParticles: Particle[] = Array.from({ length: TEMPORAL_RIFT_PARTICLES.count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 30 + Math.random() * 40;
        const speed = 2 + Math.random() * 3;

        return {
          x: canvas.width / 2 + Math.cos(angle) * radius,
          y: canvas.height / 2 + Math.sin(angle) * radius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 3,
          size: TEMPORAL_RIFT_PARTICLES.size,
          color: TEMPORAL_RIFT_PARTICLES.color,
          baseColor: TEMPORAL_RIFT_PARTICLES.color,
          oscillate: true,
          type: 'event'
        };
      });

      eventEffectsRef.current.push({
        eventType: recentEvent.type,
        startTick: state?.tick || 0,
        duration: 3,
        particles: riftParticles
      });
    }
  }, [recentEvent, state?.tick]);

  // Update event effect particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const originalAnimation = animationRef.current;

    const updateEventEffects = () => {
      eventEffectsRef.current.forEach(effect => {
        effect.particles = effect.particles
          .map(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;
            return p;
          })
          .filter(p => p.life > 0);
      });

      eventEffectsRef.current = eventEffectsRef.current.filter(effect => effect.particles.length > 0);
    };

    const tickInterval = setInterval(updateEventEffects, 16); // ~60fps

    return () => clearInterval(tickInterval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 0,
        left: 0,
        width: '100%',
        height: isFullscreen ? '100vh' : '15vh',
        background: 'transparent',
        pointerEvents: 'none',
        zIndex: isFullscreen ? 2000 : 1,
        transition: isFullscreen ? 'none' : 'height 0.3s ease-out'
      }}
    />
  );
}
