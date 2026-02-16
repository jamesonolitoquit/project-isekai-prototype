import React, { useMemo } from 'react';

interface WorldMoodOverlayProps {
  readonly state?: any;
  readonly directorState?: any;
}

/**
 * ALPHA_M7: World Mood Overlay
 * 
 * Applies global CSS filters based on world state to create:
 * - Time-of-day color shifts (night deepens blues, evening warms)
 * - Weather atmospheric effects (rain dulls, storm increases contrast)
 * - Tension indicators (high tension adds subtle red vignette)
 */
export default function WorldMoodOverlay({ state, directorState }: WorldMoodOverlayProps) {
  const dayPhase = state?.dayPhase ?? 'afternoon';
  const weather = state?.weather ?? 'clear';
  const season = state?.season ?? 'spring';
  const narrativeTension = directorState?.narrativeTension ?? 0;

  // Determine mood classes and CSS filters
  const moodClasses = useMemo(() => {
    const classes: string[] = [];

    // Time-of-day mood
    if (dayPhase === 'night') {
      classes.push('mood-night');
    } else if (dayPhase === 'evening') {
      classes.push('mood-evening');
    } else if (dayPhase === 'morning') {
      classes.push('mood-morning');
    }

    // Weather mood
    if (weather === 'rain') {
      classes.push('mood-rain');
    } else if (weather === 'snow') {
      classes.push('mood-snow');
    }

    // High tension mood
    if (narrativeTension > 70) {
      classes.push('mood-tense');
    }

    // Extreme tension (vignette effect)
    if (narrativeTension > 85) {
      classes.push('mood-critical');
    }

    // Seasonal mood
    if (season === 'autumn') {
      classes.push('mood-autumn');
    }

    return classes;
  }, [dayPhase, weather, season, narrativeTension]);

  // Calculate filter intensity based on tension
  const tensionIntensity = Math.min(1, narrativeTension / 100);

  // Build CSS filter string
  const buildFilterString = () => {
    let filters: string[] = [];

    // Apply time-of-day filters
    if (dayPhase === 'night') {
      filters.push('hue-rotate(10deg) brightness(0.7) saturate(1.1)');
    } else if (dayPhase === 'evening') {
      filters.push('brightness(0.95) contrast(0.95) sepia(0.1) hue-rotate(-10deg)');
    } else if (dayPhase === 'morning') {
      filters.push('brightness(1.05) saturate(0.95) hue-rotate(-5deg)');
    }

    // Apply weather filters
    if (weather === 'rain') {
      filters.push('brightness(0.9) contrast(1.05) saturate(0.85)');
    } else if (weather === 'snow') {
      filters.push('brightness(1.1) saturate(0.8)');
    }

    // Apply seasonal filters
    if (season === 'autumn') {
      filters.push('hue-rotate(-15deg) saturate(1.1)');
    }

    return filters.join(' ');
  };

  return (
    <>
      <style>{`
        /* Base mood class for applying filters */
        .world-mood {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: multiply;
        }

        /* Night mood: deep blue/violet */
        .mood-night {
          filter: hue-rotate(10deg) brightness(0.7) saturate(1.1);
        }

        /* Evening mood: warm sepia/gold */
        .mood-evening {
          filter: brightness(0.95) contrast(0.95) sepia(0.1) hue-rotate(-10deg);
        }

        /* Morning mood: cool yellows */
        .mood-morning {
          filter: brightness(1.05) saturate(0.95) hue-rotate(-5deg);
        }

        /* Rain: dulled and moody */
        .mood-rain {
          filter: brightness(0.9) contrast(1.05) saturate(0.85);
        }

        /* Snow: bright and cool */
        .mood-snow {
          filter: brightness(1.1) saturate(0.8);
        }

        /* Autumn: golden and warm */
        .mood-autumn {
          filter: hue-rotate(-15deg) saturate(1.1);
        }

        /* Mild tension: subtle desaturation */
        .mood-tense {
          filter: saturate(0.95) contrast(1.05);
        }

        /* Critical tension: red vignette effect */
        .mood-critical::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            ellipse at center,
            rgba(0, 0, 0, 0) 0%,
            rgba(139, 0, 0, 0.15) 100%
          );
          pointer-events: none;
          z-index: 1000;
          animation: tensionPulse 2s ease-in-out infinite;
        }

        @keyframes tensionPulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }

        /* Container that receives the filters */
        .world-mood-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      {/* Apply mood overlay with calculated filters */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
          filter: buildFilterString(),
          mixBlendMode: 'overlay',
          opacity: 0.15 + tensionIntensity * 0.1
        }}
        className={moodClasses.join(' ')}
      />

      {/* Tension vignette effect */}
      {narrativeTension > 85 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `radial-gradient(
              ellipse at center,
              rgba(0, 0, 0, 0) 0%,
              rgba(139, 0, 0, ${0.1 + tensionIntensity * 0.2}) 100%
            )`,
            pointerEvents: 'none',
            zIndex: 1000,
            animation: `tensionPulse ${2 + (1 - tensionIntensity)}s ease-in-out infinite`
          }}
        />
      )}

      <style>{`
        @keyframes tensionPulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </>
  );
}
