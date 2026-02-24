/**
 * M42 Task 6: Landing Page Refinement
 *
 * "The Ritual Threshold" - Immersive entry point to the Isekai
 * Features:
 * - WebGL shader background (animated arcane patterns)
 * - "Identifying Vessel" transition logic (instead of login form)
 * - Lore-compliant onboarding experience
 * - Character creation flow with name/archetype selection
 *
 * Accessibility:
 * - Keyboard navigation (Tab through options, Enter to proceed)
 * - Screen reader support with semantic HTML
 * - High contrast mode support
 */

import React, { useState, useEffect, useRef } from 'react';

interface LandingPageProps {
  onEnter: (characterName: string, archetype: string) => void;
  isLoading?: boolean;
}

type PageState = 'threshold' | 'identifying' | 'vessel_confirmation' | 'complete';

/**
 * WebGL Fragment Shader for Arcane Background
 */
const ARCANE_SHADER = `
precision highp float;

uniform float time;
uniform vec2 resolution;

void main(void) {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  
  // Arcane pattern generation
  float pattern = sin(uv.x * 10.0 + time * 0.5) * cos(uv.y * 10.0 - time * 0.3);
  pattern += sin(uv.y * 15.0 + time * 0.2) * cos(uv.x * 15.0 + time * 0.4);
  
  // Chromatic aberration
  float r = sin(uv.x * 20.0 + time * 0.6 + pattern) * 0.5 + 0.5;
  float g = sin(uv.y * 20.0 + time * 0.4 + pattern + 2.0) * 0.5 + 0.5;
  float b = sin((uv.x + uv.y) * 25.0 + time * 0.3 + pattern + 4.0) * 0.5 + 0.5;
  
  // Add vignette effect
  float dist = length(uv - 0.5);
  float vignette = 1.0 - dist * 1.5;
  vignette = max(0.2, vignette); // Dark edges but not black
  
  // Indigo to purple gradient
  vec3 color = mix(
    vec3(0.39, 0.40, 0.96), // Indigo #6366f1
    vec3(0.55, 0.36, 0.96), // Purple #8b5cf6
    uv.y + sin(time * 0.1) * 0.2
  );
  
  // Apply pattern overlay
  color += vec3(r, g, b) * pattern * 0.3;
  
  // Apply vignette
  color *= vignette;
  
  gl_FragColor = vec4(color, 1.0);
}
`;

const VERTEX_SHADER = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * Landing Page Component
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, isLoading = false }) => {
  const [pageState, setPageState] = useState<PageState>('threshold');
  const [characterName, setCharacterName] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLRenderingContext | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const archetypes = [
    { id: 'seer', label: '🔮 The Seer', description: 'Perceive hidden truths' },
    { id: 'weaver', label: '✨ The Weaver', description: 'Shape reality itself' },
    { id: 'diplomat', label: '🎭 The Diplomat', description: 'Influence the masses' },
    { id: 'artificer', label: '⚙️ The Artificer', description: 'Craft powerful artifacts' }
  ];

  // Initialize WebGL shader background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (!gl) {
        console.warn('[LandingPage] WebGL not supported, using fallback');
        return;
      }

      glContextRef.current = gl;

      // Create shader program
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

      if (!vertexShader || !fragmentShader) return;

      gl.shaderSource(vertexShader, VERTEX_SHADER);
      gl.shaderSource(fragmentShader, ARCANE_SHADER);
      gl.compileShader(vertexShader);
      gl.compileShader(fragmentShader);

      const program = gl.createProgram();
      if (!program) return;

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      // Create buffer
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );

      const positionLocation = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Get uniform locations
      const timeLocation = gl.getUniformLocation(program, 'time');
      const resolutionLocation = gl.getUniformLocation(program, 'resolution');

      // Animation loop
      let startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;

        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.uniform1f(timeLocation, elapsed);
        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        animationIdRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (error) {
      console.error('[LandingPage] WebGL initialization error:', error);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  // Simulate vessel identification progress
  useEffect(() => {
    if (pageState !== 'identifying') return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setPageState('vessel_confirmation');
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [pageState]);

  const handleThresholdEnter = () => {
    setPageState('identifying');
    setProgress(0);
  };

  const handleConfirmCharacter = () => {
    if (!characterName || !selectedArchetype) {
      alert('Please enter a name and select an archetype');
      return;
    }

    setPageState('complete');
    setTimeout(() => {
      onEnter(characterName, selectedArchetype);
    }, 1500);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d0d1a',
        fontFamily: 'monospace',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* WebGL Background */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0
        }}
      />

      {/* Content Overlay */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          padding: '40px',
          maxWidth: '600px'
        }}
        role="region"
        aria-label="Landing page content"
      >
        {/* THRESHOLD STATE */}
        {pageState === 'threshold' && (
          <div
            style={{
              animation: 'fadeIn 1000ms ease-out'
            }}
          >
            <h1
              style={{
                color: '#d4af37',
                fontSize: '3rem',
                margin: '0 0 20px 0',
                textShadow: '0 0 20px rgba(212, 175, 55, 0.5)',
                letterSpacing: '2px'
              }}
            >
              THE RITUAL THRESHOLD
            </h1>

            <p
              style={{
                color: '#a78bfa',
                fontSize: '1rem',
                marginBottom: '40px',
                lineHeight: '1.8'
              }}
            >
              Welcome, consciousness unfettered by time.
              <br />
              You stand at the threshold between worlds.
              <br />
              <br />
              <em>To proceed, you must be identified as a Vessel of the Isekai.</em>
            </p>

            <button
              onClick={handleThresholdEnter}
              style={{
                padding: '12px 40px',
                backgroundColor: '#6366f1',
                border: '2px solid #d4af37',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
                transition: 'all 200ms ease',
                fontFamily: 'monospace'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 30px rgba(99, 102, 241, 0.8)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 20px rgba(99, 102, 241, 0.5)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              aria-label="Begin vessel identification process"
            >
              Begin Identification
            </button>
          </div>
        )}

        {/* IDENTIFYING STATE */}
        {pageState === 'identifying' && (
          <div
            style={{
              animation: 'fadeIn 500ms ease-out'
            }}
          >
            <h2
              style={{
                color: '#6366f1',
                fontSize: '1.8rem',
                margin: '0 0 40px 0',
                textShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
              }}
            >
              ⟳ Identifying Vessel...
            </h2>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderRadius: '4px',
                marginBottom: '30px',
                border: '1px solid #6366f1',
                overflow: 'hidden'
              }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#d4af37',
                  transition: 'width 300ms ease',
                  boxShadow: '0 0 10px rgba(212, 175, 55, 0.8)'
                }}
              />
            </div>

            <p
              style={{
                color: '#a78bfa',
                fontSize: '0.9rem',
                margin: '0'
              }}
            >
              Scanning consciousness frequency... {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* VESSEL CONFIRMATION STATE */}
        {pageState === 'vessel_confirmation' && (
          <div
            style={{
              animation: 'fadeIn 500ms ease-out'
            }}
          >
            <h2
              style={{
                color: '#22c55e',
                fontSize: '1.8rem',
                margin: '0 0 30px 0',
                textShadow: '0 0 15px rgba(34, 197, 94, 0.5)'
              }}
            >
              ✓ Vessel Identified
            </h2>

            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22c55e',
                borderRadius: '6px',
                padding: '20px',
                marginBottom: '30px'
              }}
            >
              <p
                style={{
                  color: '#e0e0e0',
                  margin: '0 0 20px 0'
                }}
              >
                Your consciousness is compatible with the Isekai fabric.
                <br />
                Now, choose your archetype to begin.
              </p>

              {/* Archetype Selection */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '20px'
                }}
              >
                {archetypes.map(arch => (
                  <button
                    key={arch.id}
                    onClick={() => setSelectedArchetype(arch.id)}
                    style={{
                      padding: '12px',
                      backgroundColor:
                        selectedArchetype === arch.id
                          ? 'rgba(212, 175, 55, 0.3)'
                          : 'rgba(99, 102, 241, 0.1)',
                      border:
                        selectedArchetype === arch.id
                          ? '2px solid #d4af37'
                          : '1px solid #6366f1',
                      borderRadius: '4px',
                      color: '#e0e0e0',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'all 200ms ease',
                      fontFamily: 'monospace'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {arch.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                      {arch.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <input
                type="text"
                placeholder="Enter vessel name..."
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid #6366f1',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  marginBottom: '15px',
                  boxSizing: 'border-box'
                }}
                aria-label="Enter character name"
              />

              {/* Confirm Button */}
              <button
                onClick={handleConfirmCharacter}
                disabled={isLoading || !characterName || !selectedArchetype}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor:
                    characterName && selectedArchetype ? '#22c55e' : '#666',
                  border: '1px solid #22c55e',
                  color: '#fff',
                  cursor: characterName && selectedArchetype ? 'pointer' : 'not-allowed',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  transition: 'all 200ms ease'
                }}
                onMouseEnter={(e) => {
                  if (characterName && selectedArchetype) {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      '0 0 20px rgba(34, 197, 94, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
                aria-label="Confirm and enter the Isekai"
              >
                {isLoading ? 'Channeling energy...' : 'Enter the Isekai'}
              </button>
            </div>
          </div>
        )}

        {/* COMPLETE STATE */}
        {pageState === 'complete' && (
          <div
            style={{
              animation: 'fadeIn 500ms ease-out'
            }}
          >
            <h2
              style={{
                color: '#d4af37',
                fontSize: '1.8rem',
                margin: '0 0 20px 0',
                textShadow: '0 0 20px rgba(212, 175, 55, 0.8)',
                animation: 'pulse 1s infinite'
              }}
            >
              Welcome, {characterName}
            </h2>
            <p
              style={{
                color: '#a78bfa',
                fontSize: '0.95rem'
              }}
            >
              Transferring consciousness to the Isekai...
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            text-shadow: 0 0 20px rgba(212, 175, 55, 0.8);
          }
          50% {
            text-shadow: 0 0 30px rgba(212, 175, 55, 1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
