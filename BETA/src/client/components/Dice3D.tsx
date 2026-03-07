import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Dice3DProps {
  isRolling: boolean;
  result?: number;
  onRollComplete?: (result: number) => void;
}

const ROLL_DURATION = 1100;

/**
 * D20 die — flat SVG icosahedron projection (always faces viewer).
 * Rolling is simulated via 2D shake/spin/bounce, not 3D perspective.
 */
export function Dice3D({ isRolling, result, onRollComplete }: Dice3DProps) {
  const [displayNumber, setDisplayNumber] = useState<number>(20);
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'settled'>('idle');
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef(result);
  resultRef.current = result;
  const onCompleteRef = useRef(onRollComplete);
  onCompleteRef.current = onRollComplete;

  const cleanup = useCallback(() => {
    if (flashRef.current) { clearInterval(flashRef.current); flashRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!isRolling) return;
    cleanup();
    setPhase('rolling');

    // Flash random numbers on the face
    flashRef.current = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
    }, 55);

    // Settle after duration
    timerRef.current = setTimeout(() => {
      if (flashRef.current) { clearInterval(flashRef.current); flashRef.current = null; }
      const final = resultRef.current ?? Math.floor(Math.random() * 20) + 1;
      setDisplayNumber(final);
      setPhase('settled');
      onCompleteRef.current?.(final);
    }, ROLL_DURATION);

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRolling]);

  // Number color based on result
  const numColor = phase === 'rolling' ? '#c4b5fd'
    : displayNumber === 20 ? '#fbbf24'
    : displayNumber === 1 ? '#f87171'
    : displayNumber >= 15 ? '#86efac'
    : '#c4b5fd';

  const numShadow = phase === 'rolling' ? '0 0 6px rgba(192,132,252,0.7)'
    : displayNumber === 20 ? '0 0 12px rgba(251,191,36,0.9), 0 0 24px rgba(251,191,36,0.4)'
    : displayNumber === 1 ? '0 0 12px rgba(248,113,113,0.9), 0 0 24px rgba(248,113,113,0.4)'
    : displayNumber >= 15 ? '0 0 8px rgba(134,239,172,0.6)'
    : '0 0 6px rgba(192,132,252,0.5)';

  // D20 geometry: regular icosahedron front-face = triangle-in-hexagon
  // viewBox 0 0 100 100, center 50,50
  const R = 44, cx = 50, cy = 50;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const pts = (ps: { x: number; y: number }[]) => ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Build triangular facets for the classic D20 front-face look
  // Outer hexagon has vertices 0-5 (top, upper-right, lower-right, bottom, lower-left, upper-left)
  // Inner triangle connects alternating hex vertices: 0, 2, 4 (pointing up)
  // This creates the characteristic "triangle inside hexagon with 3 kite panels" look
  const innerTri = [hex[0], hex[2], hex[4]]; // upward triangle

  const edgeStroke = phase === 'rolling' ? 'rgba(167,139,250,0.8)' : 'rgba(139,92,246,0.6)';

  return (
    <div style={{
      width: '72px',
      height: '72px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* The D20 SVG — 2D shake animation when rolling */}
      <div style={{
        width: '64px',
        height: '64px',
        animation: phase === 'rolling' ? 'diceRoll 0.15s ease-in-out infinite'
          : phase === 'idle' ? 'diceBreathe 3s ease-in-out infinite'
          : phase === 'settled' ? 'diceSettle 0.3s ease-out forwards'
          : 'none',
        filter: phase === 'rolling'
          ? 'drop-shadow(0 0 10px rgba(139,92,246,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
          : 'drop-shadow(0 0 5px rgba(139,92,246,0.3)) drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
      }}>
        <svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="d20main" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="rgba(100,60,190,0.95)" />
              <stop offset="100%" stopColor="rgba(45,20,100,0.98)" />
            </linearGradient>
            <linearGradient id="d20side" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="rgba(70,35,140,0.9)" />
              <stop offset="100%" stopColor="rgba(35,15,75,0.95)" />
            </linearGradient>
            <radialGradient id="d20sheen" cx="40%" cy="35%" r="40%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* Three "kite" side panels (between outer hex edges and inner triangle) */}
          {/* Side panel: hex[1] - hex[0] - hex[5] with inner triangle edge hex[0]->hex[4] and hex[0]->hex[2] */}
          <polygon points={pts([hex[0], hex[1], hex[2]])} fill="url(#d20side)" />
          <polygon points={pts([hex[2], hex[3], hex[4]])} fill="url(#d20side)" />
          <polygon points={pts([hex[4], hex[5], hex[0]])} fill="url(#d20side)" />

          {/* Central upward triangle — the main face */}
          <polygon points={pts(innerTri)} fill="url(#d20main)" />

          {/* Specular highlight across center */}
          <polygon points={pts([hex[0], hex[1], hex[2], hex[3], hex[4], hex[5]])} fill="url(#d20sheen)" />

          {/* Hex outline */}
          <polygon points={pts(hex)} fill="none" stroke={edgeStroke} strokeWidth="2" strokeLinejoin="round" />

          {/* Inner triangle edges */}
          <polygon points={pts(innerTri)} fill="none" stroke={edgeStroke} strokeWidth="1.2" strokeLinejoin="round" />

          {/* Connecting lines from inner triangle vertices to adjacent hex vertices */}
          {/* hex[0] (top) connects to hex[1] and hex[5] via hex outline — already drawn */}
          {/* Additional facet lines inside the kite panels for D20 texture */}
          <line x1={hex[1].x} y1={hex[1].y} x2={cx} y2={cy} stroke={edgeStroke} strokeWidth="0.6" opacity="0.4" />
          <line x1={hex[3].x} y1={hex[3].y} x2={cx} y2={cy} stroke={edgeStroke} strokeWidth="0.6" opacity="0.4" />
          <line x1={hex[5].x} y1={hex[5].y} x2={cx} y2={cy} stroke={edgeStroke} strokeWidth="0.6" opacity="0.4" />

          {/* The number */}
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontWeight="700"
            fontSize={displayNumber >= 10 ? '20' : '24'}
            fill={numColor}
            style={{ textShadow: numShadow }}
          >
            {displayNumber}
          </text>
        </svg>
      </div>

      {/* Shadow beneath dice */}
      <div style={{
        position: 'absolute',
        bottom: '-2px',
        width: '36px',
        height: '6px',
        background: 'radial-gradient(ellipse, rgba(139,92,246,0.35), transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(2px)',
        opacity: phase === 'rolling' ? 0.2 : 0.6,
        transition: 'opacity 0.2s',
      }} />

      <style>{`
        @keyframes diceRoll {
          0% { transform: rotate(0deg) scale(1.05); }
          25% { transform: rotate(12deg) scale(0.95); }
          50% { transform: rotate(-8deg) scale(1.08); }
          75% { transform: rotate(6deg) scale(0.97); }
          100% { transform: rotate(0deg) scale(1.05); }
        }
        @keyframes diceBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(139,92,246,0.2)) drop-shadow(0 2px 3px rgba(0,0,0,0.4)); }
          50% { transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(139,92,246,0.35)) drop-shadow(0 2px 3px rgba(0,0,0,0.4)); }
        }
        @keyframes diceSettle {
          0% { transform: scale(1.1) rotate(4deg); }
          50% { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
