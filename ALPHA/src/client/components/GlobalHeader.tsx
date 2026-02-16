import React from 'react';

interface GlobalHeaderProps {
  state?: any;
  isDirector?: boolean;
  onToggleDirector?: () => void;
  onExportDebug?: () => void;
}

export default function GlobalHeader({ state, isDirector = false, onToggleDirector, onExportDebug }: GlobalHeaderProps) {
  if (!state?.player) return null;

  const hp = state.player.hp || 0;
  const maxHp = state.player.maxHp || 100;
  const mp = state.player.mp || 0;
  const maxMp = state.player.maxMp || 50;
  const gold = state.player.gold || 0;
  const level = state.player.level || 1;
  const hour = state.hour !== undefined ? state.hour : state.time?.hour || 0;
  const day = state.time?.day || 1;
  const weather = state.weather?.current || 'Clear';
  const worldName = state.worldName || 'Project Isekai Alpha';
  const worldVersion = '0.14.0';

  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const mpPercent = Math.max(0, Math.min(100, (mp / maxMp) * 100));

  const hpColor = hpPercent > 50 ? '#4ade80' : hpPercent > 25 ? '#facc15' : '#ef4444';
  const mpColor = '#60a5fa';

  // Format time (0-23 to 12h)
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'linear-gradient(180deg, rgba(10, 15, 20, 0.98) 0%, rgba(20, 25, 35, 0.95) 100%)',
      borderBottom: '1px solid #3b82f6',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      padding: '8px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: '"JetBrains Mono", monospace'
    }}>
      {/* 1. World Identity Overlay */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', color: '#3b82f6' }}>
          {worldName.toUpperCase()}
        </div>
        <div style={{ fontSize: '10px', color: '#666' }}>
          INSTANCE_V{worldVersion} | SYNC_STABLE
        </div>
      </div>

      {/* 2. Spatio-temporal Indicators */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#fff' }}>{displayHour}:00 {ampm}</div>
          <div style={{ fontSize: '9px', color: '#999' }}>TIME_STEP_CYCLE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#fff' }}>DAY {day}</div>
          <div style={{ fontSize: '9px', color: '#999' }}>ERA_CONTINUUM</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#fbbf24' }}>{weather.toUpperCase()}</div>
          <div style={{ fontSize: '9px', color: '#999' }}>ATMOS_REALITY</div>
        </div>
      </div>

      {/* 3. Player Identity & Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{state.player.name}</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: '#facc15' }}>{gold} GP</span>
            <span style={{ fontSize: '12px', color: '#4ade80' }}>LVL {level}</span>
          </div>
        </div>
        {/* Simple HP/MP status dots instead of bulky bars in the tactical layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
             <div style={{ width: `${hpPercent}%`, height: '100%', background: hpColor }} />
          </div>
          <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
             <div style={{ width: `${mpPercent}%`, height: '100%', background: mpColor }} />
          </div>
        </div>
        {/* Director Mode Toggle */}
        {onToggleDirector && (
          <button
            onClick={onToggleDirector}
            style={{
              padding: '6px 10px',
              backgroundColor: isDirector ? '#6b21a8' : '#493d4a',
              border: isDirector ? '2px solid #c084fc' : '1px solid #666',
              color: isDirector ? '#e9d5ff' : '#c084fc',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '3px',
              transition: 'all 0.2s ease'
            }}
            title="Toggle Director Mode (Shift+D)"
          >
            👁️ {isDirector ? 'ON' : 'OFF'}
          </button>
        )}
        {/* Debug Export Button */}
        {onExportDebug && (
          <button
            onClick={onExportDebug}
            style={{
              padding: '6px 10px',
              backgroundColor: '#4a3e2a',
              border: '1px solid #666',
              color: '#d4af37',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '3px',
              transition: 'all 0.2s ease'
            }}
            title="Export Debug State"
          >
            📊
          </button>
        )}
      </div>
    </div>
  );
}
