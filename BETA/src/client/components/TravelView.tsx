import React from 'react';

interface TravelViewProps {
  worldState?: any; // WorldState
}

/**
 * TravelView Component
 * 
 * Displays travel/navigation content:
 * - Current location (highlighted)
 * - List of reachable locations with travel times
 * - Resource costs for travel (Grit, items, etc.)
 * - Travel history / discovered locations
 * 
 * Data from: worldState.locations, worldState.map, worldState.player.location
 */
export function TravelView({ worldState }: TravelViewProps) {
  const player = worldState?.player;
  const locations = worldState?.locations || [];
  const currentLocationId = player?.location;
  const currentLocation = locations.find((l: any) => l.id === currentLocationId);

  if (!locations || locations.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'rgba(200, 180, 220, 0.4)',
        padding: '2rem',
      }}>
        <div>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🗺️</div>
          <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
            No locations discovered yet.
          </p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'rgba(200, 180, 220, 0.3)' }}>
            Explore the world to find new places.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      padding: '0.75rem 0.6rem',
      gap: '1rem',
    }}>
      {/* Current Location Highlight */}
      {currentLocation && (
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, rgba(132,204,22,0.12), rgba(101,163,13,0.08))',
          border: '2px solid rgba(132,204,22,0.4)',
          borderRadius: '8px',
          boxShadow: '0 0 16px rgba(132,204,22,0.2)',
        }}>
          <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📍</span>
            <span style={{ fontWeight: 700, color: '#86efac', fontSize: '1.05rem' }}>
              {currentLocation.name || currentLocationId}
            </span>
          </div>
          <span style={{
            fontSize: '0.7rem',
            background: 'rgba(132,204,22,0.2)',
            padding: '0.2rem 0.5rem',
            borderRadius: '3px',
            color: '#86efac',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Current
          </span>
        </div>
          {currentLocation.description && (
            <p style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'rgba(200,180,220,0.6)',
              lineHeight: 1.5,
            }}>
              {currentLocation.description}
            </p>
          )}
        </div>
      )}

      {/* Nearby/Reachable Locations */}
      <div>
        <div style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#a78bfa',
          fontWeight: 600,
          marginBottom: '0.75rem',
        }}>
          Nearby Locations
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {locations
            .filter((l: any) => l.id !== currentLocationId)
            .map((location: any, idx: number) => {
              // Calculate estimated travel time (random for demo)
              const travelTime = Math.max(15, Math.floor(Math.random() * 180));
              const hours = Math.floor(travelTime / 60);
              const minutes = travelTime % 60;
              const travelTimeStr = hours > 0
                ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
                : `${minutes}m`;

              return (
                <button key={location.id ?? idx}
                  onClick={() => console.log(`[TravelView] Travel to ${location.name}`)}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.15)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)';
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#d8b4fe',
                      fontWeight: 600,
                      marginBottom: '0.2rem',
                    }}>
                      {location.name || `Location ${idx + 1}`}
                    </div>
                    {location.biome && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'rgba(200,180,220,0.5)',
                        textTransform: 'capitalize',
                      }}>
                        🌍 {location.biome}
                      </div>
                    )}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.2rem',
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#fbbf24',
                      fontFamily: 'monospace',
                    }}>
                      {travelTimeStr}
                    </div>
                    {player?.grit !== undefined && (
                      <div style={{
                        fontSize: '0.65rem',
                        color: 'rgba(200,180,220,0.5)',
                      }}>
                        ⚡ {Math.ceil(travelTime / 10)} Grit
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Quick Travel Tips */}
      <div style={{
        marginTop: 'auto',
        padding: '0.75rem',
        background: 'rgba(96,165,250,0.08)',
        border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: 'rgba(200,180,220,0.6)',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: '0.3rem' }}>
          💡 Travel Tips
        </div>
        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
          <li>Travel consumes Grit and time from your journey pool</li>
          <li>Rest at inns to restore resources before long trips</li>
          <li>Some locations are only accessible during specific seasons</li>
        </ul>
      </div>
    </div>
  );
}
