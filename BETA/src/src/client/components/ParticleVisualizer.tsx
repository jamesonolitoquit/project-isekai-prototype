import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ParticleVisualizerProps {
  state?: any;
}

export default function ParticleVisualizer({ state }: ParticleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.15; // Bottom 15% of viewport
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const weather = state?.weather ?? 'clear';
    const season = state?.season ?? 'spring';

    // Get particle configuration based on weather
    const getParticleConfig = (w: string) => {
      switch (w) {
        case 'rain':
          return { type: 'rain', count: 100, color: '#4a90e2', size: 2, speedVariance: 8 };
        case 'snow':
          return { type: 'snow', count: 60, color: '#e8f4f8', size: 4, speedVariance: 1 };
        case 'clear':
        default:
          return { type: 'motes', count: 30, color: '#fff9e6', size: 2, speedVariance: 0.3 };
      }
    };

    const config = getParticleConfig(weather);

    // Initialize particles if weather changed
    if (!particlesRef.current.length || particlesRef.current.length !== config.count) {
      particlesRef.current = Array.from({ length: config.count }, () => createParticle(weather, season));
    }

    function createParticle(w: string, s: string): Particle {
      const particle: Particle = {
        x: Math.random() * (canvas?.width ?? window.innerWidth),
        y: Math.random() * (canvas?.height ?? window.innerHeight * 0.15),
        vx: 0,
        vy: 0,
        life: Math.random() * 0.5 + 0.5,
        maxLife: 1,
        size: config.size,
        color: config.color
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

    function updateAndRender() {
      if (!canvas || !ctx) return;
      ctx!.clearRect(0, 0, canvas.width, canvas.height);

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

      // Draw particles
      particlesRef.current.forEach(p => {
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(updateAndRender);
    }

    animationRef.current = requestAnimationFrame(updateAndRender);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [state?.weather, state?.season]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '15vh',
        background: 'transparent',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
}
