import React, { useState } from 'react';
import { getAbilitiesByBranch, getAbilitiesByTier } from '../../engine/skillEngine';

interface LevelUpModalProps {
  state?: any;
  isOpen?: boolean;
  onAllocateStat?: (stat: string, amount: number) => void;
  onSpendSkillPoint?: (abilityId: string) => void;
  onEquipAbility?: (abilityId: string) => void;
  onClose?: () => void;
}

const STATS = ['str', 'agi', 'int', 'cha', 'end', 'luk'] as const;
const SKILL_BRANCHES = ['martial', 'arcane', 'resonance', 'social'] as const;

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

export default function LevelUpModal({ state, isOpen = false, onAllocateStat, onSpendSkillPoint, onEquipAbility, onClose }: LevelUpModalProps) {
  const player = state?.player;
  const [currentTab, setCurrentTab] = useState<'stats' | 'skills'>('stats');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState<string>('martial');

  const attributePoints = player?.attributePoints ?? 0;
  const skillPoints = player?.skillPoints ?? 0;
  const level = player?.level ?? 1;
  const currentStats = player?.stats || { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  const unlockedAbilities = player?.unlockedAbilities ?? [];
  const equippedAbilities = player?.equippedAbilities ?? [];

  const handleAllocate = (stat: string, delta: number) => {
    const current = allocations[stat] || 0;
    const newValue = Math.max(0, current + delta);
    
    if (newValue + totalAllocated - current <= attributePoints) {
      const newAllocations = { ...allocations, [stat]: newValue };
      setAllocations(newAllocations);
      setTotalAllocated(Object.values(newAllocations).reduce((a, b) => a + b, 0));
    }
  };

  const handleConfirmStats = () => {
    STATS.forEach((stat) => {
      if (allocations[stat] && allocations[stat] > 0) {
        onAllocateStat?.(stat, allocations[stat]);
      }
    });
    setAllocations({});
    setTotalAllocated(0);
    onClose?.();
  };

  const handleSpendSkillPoint = (abilityId: string) => {
    onSpendSkillPoint?.(abilityId);
  };

  const handleEquipAbility = (abilityId: string) => {
    onEquipAbility?.(abilityId);
  };

  if (!isOpen) {
    return null;
  }

  const shouldShowStats = attributePoints > 0;
  const shouldShowSkills = skillPoints > 0;

  // Try to get branch abilities dynamically
  const getBranchAbilities = (branch: string) => {
    try {
      return getAbilitiesByBranch(branch as any);
    } catch {
      return [];
    }
  };

  const branchAbilities = getBranchAbilities(selectedBranch);

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
          maxWidth: 700,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '2px solid #ffd700'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, textAlign: 'center', color: '#ffd700' }}>
          ✨ Level {level} Reached!
        </h2>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #444' }}>
          {shouldShowStats && (
            <button
              onClick={() => setCurrentTab('stats')}
              style={{
                padding: '8px 16px',
                backgroundColor: currentTab === 'stats' ? '#ffd700' : '#444',
                color: currentTab === 'stats' ? '#000' : '#fff',
                border: 'none',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: currentTab === 'stats' ? 'bold' : 'normal'
              }}
            >
              Attributes ({attributePoints})
            </button>
          )}
          {shouldShowSkills && (
            <button
              onClick={() => setCurrentTab('skills')}
              style={{
                padding: '8px 16px',
                backgroundColor: currentTab === 'skills' ? '#ffd700' : '#444',
                color: currentTab === 'skills' ? '#000' : '#fff',
                border: 'none',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: currentTab === 'skills' ? 'bold' : 'normal'
              }}
            >
              Skills ({skillPoints})
            </button>
          )}
        </div>

        {/* Stats Tab */}
        {currentTab === 'stats' && shouldShowStats && (
          <div>
            <div style={{ backgroundColor: '#2a2a2a', padding: 12, borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                You have <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{attributePoints}</span> attribute points to allocate.
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
                onClick={handleConfirmStats}
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
        )}

        {/* Skills Tab */}
        {currentTab === 'skills' && shouldShowSkills && (
          <div>
            <div style={{ backgroundColor: '#2a2a2a', padding: 12, borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                You have <span style={{ color: '#9c27b0', fontWeight: 'bold' }}>{skillPoints}</span> skill points to spend.
              </div>
            </div>

            {/* Skill Branch Selection */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {SKILL_BRANCHES.map((branch) => (
                <button
                  key={branch}
                  onClick={() => setSelectedBranch(branch)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: selectedBranch === branch ? '#9c27b0' : '#2a2a2a',
                    color: 'white',
                    border: selectedBranch === branch ? '2px solid #fff' : '1px solid #666',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: selectedBranch === branch ? 'bold' : 'normal',
                    textTransform: 'capitalize'
                  }}
                >
                  {branch}
                </button>
              ))}
            </div>

            {/* Abilities in Branch */}
            <div style={{ marginBottom: 16 }}>
              {branchAbilities.length > 0 ? (
                branchAbilities.map((ability: any) => {
                  const isUnlocked = unlockedAbilities.includes(ability.id);
                  const isEquipped = equippedAbilities.includes(ability.id);
                  const canAfford = skillPoints >= ability.skillPointCost;

                  return (
                    <div
                      key={ability.id}
                      style={{
                        backgroundColor: '#2a2a2a',
                        padding: 12,
                        borderRadius: 4,
                        marginBottom: 8,
                        borderLeft: `4px solid ${isEquipped ? '#00ff00' : isUnlocked ? '#4caf50' : '#999'}`,
                        opacity: isUnlocked ? 1 : 0.7
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: 14, color: isEquipped ? '#00ff00' : '#fff' }}>
                            {ability.name}
                            {isEquipped && ' ✓'}
                            {isUnlocked && !isEquipped && ' (unlocked)'}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 400 }}>
                            {ability.description}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                            Tier {ability.tier} • Cost: {ability.skillPointCost} points
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isUnlocked && (
                          <button
                            onClick={() => handleSpendSkillPoint(ability.id)}
                            disabled={!canAfford}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: canAfford ? '#9c27b0' : '#666',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: canAfford ? 'pointer' : 'not-allowed',
                              opacity: canAfford ? 1 : 0.5,
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}
                          >
                            Unlock ({ability.skillPointCost} points)
                          </button>
                        )}
                        {isUnlocked && !isEquipped && equippedAbilities.length < 6 && (
                          <button
                            onClick={() => handleEquipAbility(ability.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}
                          >
                            Equip Ability
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', opacity: 0.6, padding: 16 }}>
                  No abilities in this branch yet
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 'bold',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

