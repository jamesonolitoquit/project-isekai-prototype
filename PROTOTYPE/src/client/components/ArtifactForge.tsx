import React, { useState } from 'react';
import { WorldState, PlayerState } from '../../engine/worldEngine';
import { Relic } from '../../engine/artifactEngine';
import runesData from '../../data/runes.json';

interface ArtifactForgeProps {
  state: WorldState;
  onAction: (actionType: string, payload: any) => void;
}

export const ArtifactForge: React.FC<ArtifactForgeProps> = ({ state, onAction }) => {
  const [selectedRelicId, setSelectedRelicId] = useState<string | null>(null);
  const [selectedRuneId, setSelectedRuneId] = useState<string | null>(null);
  const [bindingTarget, setBindingTarget] = useState<string | null>(null);
  const [showBindConfirm, setShowBindConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'infuse' | 'bind' | 'inventory'>('infuse');

  const player = state.player;
  const equippedRelics = player.equippedRelics || [];
  const runicInventory = player.runicInventory || [];
  const boundRelicId = player.boundRelicId;
  const relics = state.relics || {};

  // Get all available runes from data
  const allRunes = (runesData as any).runes || [];

  const handleInfuse = () => {
    if (!selectedRelicId || !selectedRuneId) {
      alert('Please select a relic and a rune.');
      return;
    }

    onAction('INFUSE_ITEM', {
      relicId: selectedRelicId,
      runeId: selectedRuneId
    });

    // Reset selections
    setSelectedRelicId(null);
    setSelectedRuneId(null);
  };

  const handleBind = (relicId: string) => {
    setBindingTarget(relicId);
    setShowBindConfirm(true);
  };

  const confirmBinding = () => {
    if (!bindingTarget) return;

    onAction('SOUL_BIND', {
      relicId: bindingTarget
    });

    setShowBindConfirm(false);
    setBindingTarget(null);
  };

  const handleUnbind = () => {
    if (!boundRelicId) return;

    if (window.confirm('Unbinding a relic costs significant soul strain. Are you sure?')) {
      onAction('UNBIND_RELIC', {
        relicId: boundRelicId
      });
    }
  };

  const getRelicBonus = (relic: Relic): string => {
    const bonusEntries = Object.entries(relic.baseBonus || {});
    return bonusEntries
      .map(([stat, value]) => `+${value} ${stat}`)
      .join(', ') || 'No base bonus';
  };

  const getRelicSentience = (level: number): string => {
    const levels = ['Inert', 'Aware', 'Conscious', 'Sentient'];
    return levels[Math.min(level, levels.length - 1)];
  };

  const getRune = (runeId: string) => {
    return allRunes.find((r: any) => r.id === runeId);
  };

  return (
    <div className="artifact-forge">
      <div className="forge-header">
        <h2>⚔️ The Artifact Forge</h2>
        <p className="subtitle">Bind relics, infuse runes, and channel your power</p>
      </div>

      {/* Tab Navigation */}
      <div className="forge-tabs">
        <button
          className={`tab-button ${activeTab === 'infuse' ? 'active' : ''}`}
          onClick={() => setActiveTab('infuse')}
        >
          Infuse Runes
        </button>
        <button
          className={`tab-button ${activeTab === 'bind' ? 'active' : ''}`}
          onClick={() => setActiveTab('bind')}
        >
          Soul Binding
        </button>
        <button
          className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory ({runicInventory.length})
        </button>
      </div>

      {/* Infuse Tab */}
      {activeTab === 'infuse' && (
        <div className="forge-tab-content infuse-tab">
          <div className="infuse-section">
            <h3>Select a Relic</h3>
            <div className="relic-selector">
              {equippedRelics.length === 0 ? (
                <p className="empty-state">You have no equipped relics.</p>
              ) : (
                equippedRelics.map((relicId) => {
                  const relic = relics[relicId];
                  if (!relic) return null;

                  const emptySlots = relic.runicSlots.filter((s) => !s.runeId).length;

                  return (
                    <div
                      key={relicId}
                      className={`relic-option ${selectedRelicId === relicId ? 'selected' : ''}`}
                      onClick={() => setSelectedRelicId(relicId)}
                    >
                      <div className="relic-header">
                        <h4>{relic.name}</h4>
                        <span className={`sentience-badge level-${relic.sentienceLevel}`}>
                          {getRelicSentience(relic.sentienceLevel)}
                        </span>
                      </div>
                      <p className="relic-bonus">{getRelicBonus(relic)}</p>
                      <div className="runic-slots">
                        {relic.runicSlots.map((slot, idx) => (
                          <div
                            key={slot.slotId}
                            className={`slot ${slot.runeId ? 'filled' : 'empty'}`}
                            title={slot.runeId ? `Contains ${getRune(slot.runeId)?.name}` : 'Empty slot'}
                          >
                            {slot.runeId ? '◆' : '◇'}
                          </div>
                        ))}
                      </div>
                      <p className="slots-info">
                        {emptySlots} empty slot{emptySlots !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <h3>Select a Rune to Infuse</h3>
            <div className="rune-selector">
              {runicInventory.length === 0 ? (
                <p className="empty-state">You have no runes in inventory.</p>
              ) : (
                runicInventory.map((invRune) => {
                  const rune = getRune(invRune.runeId);
                  if (!rune) return null;

                  return (
                    <div
                      key={invRune.runeId}
                      className={`rune-option ${selectedRuneId === invRune.runeId ? 'selected' : ''}`}
                      onClick={() => setSelectedRuneId(invRune.runeId)}
                    >
                      <div className="rune-header">
                        <h4>{rune.name}</h4>
                        <span className="rune-quantity">×{invRune.quantity}</span>
                      </div>
                      <p className="rune-essence">Essence: {rune.essence}</p>
                      <p className="rune-complexity">Complexity: {rune.complexity}</p>
                      <p className="rune-description">{rune.description}</p>
                      <div className="rune-bonus">
                        {Object.entries(rune.statBonus).map(([stat, value]) => (
                          <span key={stat}>+{String(value)} {stat}</span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              className="forge-action-button infuse-button"
              onClick={handleInfuse}
              disabled={!selectedRelicId || !selectedRuneId}
            >
              ✨ Infuse Rune
            </button>
          </div>
        </div>
      )}

      {/* Soul Binding Tab */}
      {activeTab === 'bind' && (
        <div className="forge-tab-content bind-tab">
          <div className="bind-section">
            {boundRelicId ? (
              <div className="bound-relic-info">
                <h3>⛓️ Bound Relic</h3>
                <div className="bound-relic-display">
                  {relics[boundRelicId] && (
                    <>
                      <h4>{relics[boundRelicId].name}</h4>
                      <p className="bound-description">
                        You are permanently bonded to this relic. It grants you immense power, but breaking this bond
                        requires great effort.
                      </p>
                      <div className="binding-cost">
                        <span className="label">Unbinding Cost (Soul Strain):</span>
                        <span className="value">{relics[boundRelicId].boundSoulStrain}</span>
                      </div>
                      <button
                        className="forge-action-button unbind-button danger"
                        onClick={handleUnbind}
                      >
                        ⛓️ Break Bond (High Risk)
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="unbounded-relic-options">
                <h3>Bind a Relic to Your Soul</h3>
                <p className="binding-description">
                  Soul binding grants massive bonuses but permanently attaches the relic to your essence. You cannot
                  drop it without significant soul strain.
                </p>

                <div className="bindable-relics">
                  {equippedRelics.length === 0 ? (
                    <p className="empty-state">You have no equipped relics to bind.</p>
                  ) : (
                    equippedRelics.map((relicId) => {
                      const relic = relics[relicId];
                      if (!relic) return null;

                      return (
                        <div key={relicId} className="bindable-relic">
                          <div className="relic-info">
                            <h4>{relic.name}</h4>
                            <p className="relic-flavor">{relic.lore}</p>
                            <p className="relic-sentience">
                              Sentience: {getRelicSentience(relic.sentienceLevel)}
                            </p>
                          </div>
                          <button
                            className="forge-action-button bind-button"
                            onClick={() => handleBind(relicId)}
                          >
                            ⛓️ Bind Soul
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="forge-tab-content inventory-tab">
          <h3>Runic Inventory</h3>
          {runicInventory.length === 0 ? (
            <p className="empty-state">You have no runes.</p>
          ) : (
            <div className="inventory-grid">
              {runicInventory.map((invRune) => {
                const rune = getRune(invRune.runeId);
                if (!rune) return null;

                return (
                  <div key={invRune.runeId} className="inventory-item rune-item">
                    <h4>{rune.name}</h4>
                    <p className="essence-type">{rune.essence}</p>
                    <p className="quantity">Quantity: {invRune.quantity}</p>
                    <p className="description">{rune.description}</p>
                    <div className="stat-bonuses">
                      {Object.entries(rune.statBonus).map(([stat, value]) => (
                        <span key={stat} className="stat">
                          +{String(value)} {stat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="relics-title">Equipped Relics</h3>
          <div className="equipped-relics-list">
            {equippedRelics.length === 0 ? (
              <p className="empty-state">You have no equipped relics.</p>
            ) : (
              equippedRelics.map((relicId) => {
                const relic = relics[relicId];
                if (!relic) return null;

                const isBound = boundRelicId === relicId;
                const filledSlots = relic.runicSlots.filter((s) => s.runeId).length;

                return (
                  <div key={relicId} className={`relic-inventory-item ${isBound ? 'bound' : ''}`}>
                    <div className="relic-header">
                      <h4>
                        {relic.name}
                        {isBound && <span className="bound-badge">⛓️ BOUND</span>}
                      </h4>
                      <span className="sentience">{getRelicSentience(relic.sentienceLevel)}</span>
                    </div>
                    <p className="baseBonus">{getRelicBonus(relic)}</p>
                    <p className="slots-info">
                      {filledSlots}/{relic.runicSlots.length} runes infused
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Binding Confirmation Modal */}
      {showBindConfirm && bindingTarget && relics[bindingTarget] && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <h3>⚠️ Soul Binding Ritual</h3>
            <p>
              You are about to permanently bind your soul to <strong>{relics[bindingTarget].name}</strong>. This grants
              immense power but cannot be easily undone.
            </p>
            <div className="binding-details">
              <p>
                <span className="label">Mana Cost:</span>
                <span className="value">{(relics[bindingTarget].sentienceLevel + 1) * 20}</span>
              </p>
              <p>
                <span className="label">Unbinding Cost:</span>
                <span className="value">{relics[bindingTarget].boundSoulStrain} Soul Strain</span>
              </p>
            </div>
            <div className="modal-buttons">
              <button className="modal-button confirm" onClick={confirmBinding}>
                ⛓️ Bind My Soul
              </button>
              <button
                className="modal-button cancel"
                onClick={() => {
                  setShowBindConfirm(false);
                  setBindingTarget(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
