import React from 'react';

interface PlayerStateProps {
  state?: any;
}

// Status effect color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'chilled': { bg: '#e3f2fd', text: '#01579b', label: '❄️ Chilled' },
  'cold': { bg: '#e3f2fd', text: '#01579b', label: '❄️ Cold' },
  'poisoned': { bg: '#f1f8e9', text: '#33691e', label: '☠️ Poisoned' },
  'poison': { bg: '#f1f8e9', text: '#33691e', label: '☠️ Poison' },
  'burning': { bg: '#ffebee', text: '#b71c1c', label: '🔥 Burning' },
  'fire': { bg: '#ffebee', text: '#b71c1c', label: '🔥 Fire' },
  'blessed': { bg: '#f3e5f5', text: '#4a148c', label: '✨ Blessed' },
  'cursed': { bg: '#eceff1', text: '#263238', label: '💀 Cursed' },
};

export default function PlayerState({ state }: PlayerStateProps) {
  const player = state?.player ?? {};
  const hp = player.hp ?? 100;
  const maxHp = player.maxHp ?? 100;
  const mp = player.mp ?? 0;
  const maxMp = player.maxMp ?? 0;
  const statusEffects = player.statusEffects ?? [];

  // Calculate health bar percentage and color
  const healthPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  let healthBarColor = '#4caf50'; // Green
  if (healthPercent <= 25) healthBarColor = '#d32f2f'; // Red
  else if (healthPercent <= 50) healthBarColor = '#ff9800'; // Orange
  else if (healthPercent <= 75) healthBarColor = '#fbc02d'; // Yellow

  // Calculate mana bar percentage and color
  const manaPrecent = maxMp > 0 ? Math.max(0, Math.min(100, (mp / maxMp) * 100)) : 0;
  let manaBarColor = '#2196f3'; // Blue
  if (manaPrecent <= 33) manaBarColor = '#ff9800'; // Orange
  else if (manaPrecent <= 66) manaBarColor = '#4caf50'; // Green

  return (
    <div className="player-state" style={{ padding: 12, fontSize: 14 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Player Status</h3>
      
      {/* Location & Gold */}
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        <div><strong>Location:</strong> {player.location || 'Unknown'}</div>
        <div><strong>Gold:</strong> {player.gold ?? 0}</div>
      </div>

      {/* Health Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <strong>Health</strong>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{Math.ceil(hp)} / {maxHp}</span>
        </div>
        <div style={{
          width: '100%',
          height: 20,
          backgroundColor: '#e0e0e0',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid #999'
        }}>
          <div style={{
            width: `${healthPercent}%`,
            height: '100%',
            backgroundColor: healthBarColor,
            transition: 'width 0.3s ease, background-color 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'white',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
          }}>
            {healthPercent > 10 && `${Math.round(healthPercent)}%`}
          </div>
        </div>
      </div>

      {/* Mana Bar */}
      {maxMp > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <strong>Mana</strong>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{Math.ceil(mp)} / {maxMp}</span>
          </div>
          <div style={{
            width: '100%',
            height: 16,
            backgroundColor: '#e0e0e0',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid #999'
          }}>
            <div style={{
              width: `${manaPrecent}%`,
              height: '100%',
              backgroundColor: manaBarColor,
              transition: 'width 0.3s ease, background-color 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: 'white',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}>
              {manaPrecent > 10 && `${Math.round(manaPrecent)}%`}
            </div>
          </div>
        </div>
      )}

      {/* Status Effects */}
      {statusEffects.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Active Effects:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {statusEffects.map((effect: string) => {
              const effectKey = effect.toLowerCase();
              const config = STATUS_COLORS[effectKey] || {
                bg: '#f5f5f5',
                text: '#333',
                label: effect
              };
              return (
                <div
                  key={effect}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    backgroundColor: config.bg,
                    color: config.text,
                    fontSize: 11,
                    fontWeight: 'bold',
                    border: `1px solid ${config.text}33`
                  }}
                >
                  {config.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reputation Summary */}
      {Object.keys(player.reputation || {}).length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
          <strong>Reputation:</strong> {JSON.stringify(player.reputation || {})}
        </div>
      )}
    </div>
  );
}
