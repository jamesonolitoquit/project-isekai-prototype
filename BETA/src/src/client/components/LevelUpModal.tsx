import React, { useState } from 'react';

interface LevelUpModalProps {
  state?: any;
  isOpen?: boolean;
  onAllocateStat?: (stat: string, amount: number) => void;
  onClose?: () => void;
}

const STATS = ['str', 'agi', 'int', 'cha', 'end', 'luk'] as const;

const STAT_DESCRIPTIONS: Record<string, string> = {
  str: 'Strength - Increases melee damage and carrying capacity',
  agi: 'Agility - Improves dodge chance, parry, and movement speed',
  int: 'Intelligence - Enhances spell power and healing effectiveness',
  cha: 'Charisma - Increases persuasion and faction reputation gains',
  end: 'Endurance - Increases max HP and physical resistance',
  luk: 'Luck - Improves critical hit chance and rare item drops'
};

const STAT_COLORS: Record<string, string> = {
  str: '#d32f2f',
  agi: '#ffa726',
  int: '#42a5f5',
  cha: '#ab47bc',
  end: '#66bb6a',
  luk: '#fdd835'
};

export default function LevelUpModal({ state, isOpen = false, onAllocateStat, onClose }: LevelUpModalProps) {
  const player = state?.player;
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [totalAllocated, setTotalAllocated] = useState(0);

  const attributePoints = player?.attributePoints ?? 0;
  const level = player?.level ?? 1;
  const currentStats = player?.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };

  const handleAllocate = (stat: string, delta: number) => {
    const current = allocations[stat] || 0;
    const newValue = Math.max(0, current + delta);
    
    if (newValue + totalAllocated - current <= attributePoints) {
      const newAllocations = { ...allocations, [stat]: newValue };
      setAllocations(newAllocations);
      setTotalAllocated(Object.values(newAllocations).reduce((a, b) => a + b, 0));
    }
  };

  const handleConfirm = () => {
    STATS.forEach((stat) => {
      if (allocations[stat] && allocations[stat] > 0) {
        onAllocateStat?.(stat, allocations[stat]);
      }
    });
    setAllocations({});
    setTotalAllocated(0);
    onClose?.();
  };

  if (!isOpen || attributePoints <= 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          color: '#fff',
          padding: 20,
          borderRadius: 8,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '2px solid #ffd700'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, textAlign: 'center', color: '#ffd700' }}>
          ✨ Level {level} Reached!
        </h2>

        <div style={{ backgroundColor: '#2a2a2a', padding: 12, borderRadius: 4, marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            You have <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{attributePoints}</span> attribute
            points to allocate.
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Distributed: <span style={{ color: '#ffa726' }}>{totalAllocated}</span> / {attributePoints}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {STATS.map((stat) => {
            const color = STAT_COLORS[stat];
            const current = currentStats[stat] || 10;
            const allocated = allocations[stat] || 0;

            return (
              <div
                key={stat}
                style={{
                  backgroundColor: '#2a2a2a',
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 8,
                  borderLeft: `4px solid ${color}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color, fontSize: 14 }}>
                      {stat.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{STAT_DESCRIPTIONS[stat]}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => handleAllocate(stat, -1)}
                      style={{
                        padding: 6,
                        minWidth: 36,
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                      disabled={allocated === 0}
                    >
                      −
                    </button>
                    <div style={{ minWidth: 60, textAlign: 'center' }}>
                      <div style={{ fontSize: 12 }}>
                        {current} → <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{current + allocated}</span>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.6 }}>+{allocated}</div>
                    </div>
                    <button
                      onClick={() => handleAllocate(stat, 1)}
                      style={{
                        padding: 6,
                        minWidth: 36,
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                      disabled={totalAllocated >= attributePoints}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={totalAllocated === 0}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontWeight: 'bold',
              fontSize: 14,
              cursor: totalAllocated === 0 ? 'not-allowed' : 'pointer',
              opacity: totalAllocated === 0 ? 0.5 : 1
            }}
          >
            Confirm Allocation
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 12,
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
