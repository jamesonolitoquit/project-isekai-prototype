import React from 'react';

interface GlobalHeaderProps {
  state?: any;
}

export default function GlobalHeader({ state }: GlobalHeaderProps) {
  if (!state?.player) return null;

  const hp = state.player.hp || 0;
  const maxHp = state.player.maxHp || 100;
  const mp = state.player.mp || 0;
  const maxMp = state.player.maxMp || 50;
  const gold = state.player.gold || 0;
  const level = state.player.level || 1;
  const hour = state.hour !== undefined ? state.hour : state.time?.hour || 0;
  
  // BETA: Epoch awareness
  const epochId = state.epochId;
  const epochMetadata = state.epochMetadata;
  
  // Determine visual theme based on epoch
  let epochBgColor = 'rgba(26, 31, 46, 0.95)';
  let epochBorderColor = '#2d3561';
  
  if (epochMetadata?.theme?.includes('Waning')) {
    // Waning era: desaturated, grayish
    epochBgColor = 'rgba(40, 40, 40, 0.95)';
    epochBorderColor = '#1a1a1a';
  } else if (epochMetadata?.theme?.includes('Twilight')) {
    // Twilight era: dark with red/purple tones
    epochBgColor = 'rgba(26, 15, 20, 0.95)';
    epochBorderColor = '#3d1e2e';
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: `linear-gradient(90deg, rgba(15, 20, 25, 0.95) 0%, ${epochBgColor} 100%)`,
      borderBottom: `2px solid ${epochBorderColor}`,
      padding: '12px 16px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      alignItems: 'center'
    }}>
      {/* Character Name & Level */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#74b9ff' }}>
          {state.player.name}
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Lvl {level}
        </div>
      </div>

      {/* HP Bar */}
      <div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          HP: <span style={{ color: hpPercent > 50 ? '#4ade80' : hpPercent > 25 ? '#facc15' : '#ef4444', fontWeight: 'bold' }}>{Math.ceil(hp)}</span>/{Math.ceil(maxHp)}
        </div>
        <div style={{
          width: '100%',
          height: '16px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: `1px solid ${epochBorderColor}`,
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${hpPercent}%`,
            height: '100%',
            background: hpPercent > 50 ? '#4ade80' : hpPercent > 25 ? '#facc15' : '#ef4444',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* MP Bar */}
      <div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          MP: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{Math.ceil(mp)}</span>/{Math.ceil(maxMp)}
        </div>
        <div style={{
          width: '100%',
          height: '16px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: `1px solid ${epochBorderColor}`,
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${mpPercent}%`,
            height: '100%',
            background: '#60a5fa',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* BETA: Epoch Info */}
      {epochMetadata && (
        <div style={{ 
          fontSize: '11px', 
          color: '#aaa',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          border: `1px solid ${epochBorderColor}`
        }}>
          <div style={{ color: '#c9a961', fontWeight: 'bold' }}>
            {epochMetadata.theme}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            Year {epochMetadata.chronologyYear}
          </div>
        </div>
      )}

      {/* Gold & Time */}
      <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-end' }}>
        <div style={{ fontSize: '12px', color: '#fbbf24' }}>
          💰 {gold} Gold
        </div>
        <div style={{ fontSize: '12px', color: '#9333ea' }}>
          🕐 {hour.toString().padStart(2, '0')}:00
        </div>
      </div>
    </div>
  );
}
