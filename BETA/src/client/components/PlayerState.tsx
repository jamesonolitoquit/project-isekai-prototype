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
  // M52 Polish: Merit and Resonance
  const merit = player.merit ?? 0;
  const resonance = player.resonance ?? 0;
  const seanceCooldown = player.seanceCooldown ?? 0;

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

  // M52 Polish: Merit bar (threshold: 50)
  const meritPercent = Math.min(100, (merit / 50) * 100);
  let meritBarColor = '#fbbf24'; // Amber - ready to use
  if (merit < 50) meritBarColor = '#ef4444'; // Red - not ready

  // M52 Polish: Resonance bar (threshold: 20)
  const resonancePercent = Math.min(100, (resonance / 20) * 100);
  let resonanceBarColor = '#60a5fa'; // Blue - mystical

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

      {/* M52 Polish: Merit Display */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <strong>Merit</strong>
            <span style={{ fontSize: 11, opacity: 0.7 }} title="Costs 50 to command factions">💰</span>
          </span>
          <span style={{ fontSize: 12, opacity: 0.8, color: merit >= 50 ? '#a8d5a8' : '#ef4444' }}>
            {merit} / 50
          </span>
        </div>
        <div style={{
          width: '100%',
          height: 14,
          backgroundColor: '#222',
          borderRadius: 4,
          overflow: 'hidden',
          border: `1px solid ${merit >= 50 ? '#a8d5a8' : '#666'}`
        }}>
          <div style={{
            width: `${meritPercent}%`,
            height: '100%',
            backgroundColor: meritBarColor,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }} />
        </div>
        {merit >= 50 && (
          <div style={{ fontSize: 10, color: '#a8d5a8', marginTop: 2, textAlign: 'right' }}>
            ✓ Ready for faction command
          </div>
        )}
      </div>

      {/* M52 Polish: Resonance Display */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <strong>Resonance</strong>
            <span style={{ fontSize: 11, opacity: 0.7 }} title="Costs 20 to initiate séance; 5-min cooldown">✧</span>
          </span>
          <span style={{ fontSize: 12, opacity: 0.8, color: resonance >= 20 ? '#60a5fa' : '#ef4444' }}>
            {resonance} / 20
          </span>
        </div>
        <div style={{
          width: '100%',
          height: 14,
          backgroundColor: '#222',
          borderRadius: 4,
          overflow: 'hidden',
          border: `1px solid ${resonance >= 20 ? '#60a5fa' : '#666'}`
        }}>
          <div style={{
            width: `${resonancePercent}%`,
            height: '100%',
            backgroundColor: resonanceBarColor,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }} />
        </div>
        {resonance >= 20 && seanceCooldown <= 0 && (
          <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 2, textAlign: 'right' }}>
            ✓ Ready for séance
          </div>
        )}
        {seanceCooldown > 0 && (
          <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2, textAlign: 'right' }}>
            ⏱ Séance cooldown: {seanceCooldown}s
          </div>
        )}
      </div>

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
