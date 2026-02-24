/**
 * M54-E1: The Ascension Protocol UI
 * 
 * Full-screen overlay for character transcendence ritual (Phase 13)
 * Guides player through final legacy confirmation before ascending
 */

import React, { useState, useMemo } from 'react';
import type { LegacyImpact, AncestralBoon, AncestralBlight } from '../../engine/legacyEngine';
import type { WorldState, PlayerState } from '../../engine/worldEngine';

interface AscensionProtocolProps {
  // World state and player info
  character: PlayerState;
  legacyImpact: LegacyImpact;
  generationalParadox?: number;
  
  // Available data
  allDeeds?: string[];
  worldState?: WorldState;
  
  // Callbacks
  onConfirmAscension?: (selectedDeeds: string[], selectedHeirloom?: string) => void;
  onCancelAscension?: () => void;
  
  // UI state
  isDeveloperMode?: boolean;
}

interface PanelState {
  activePanel: 'deeds' | 'heirloom' | 'blessings' | 'legacy' | 'ritual' | 'confirm';
  selectedDeeds: Set<string>;
  selectedHeirloom?: string;
  showAnimation: boolean;
  confirmationStep: 0 | 1 | 2; // 0=review, 1=confirm, 2=dissolve
}

/**
 * Calculate ancestral boons based on selected deeds and myth status
 */
function calculateAncestralBoons(
  mythStatus: number,
  selectedDeeds: string[],
  bloodlineOrigin?: string
): AncestralBoon[] {
  const boons: AncestralBoon[] = [];
  
  // Base boon from myth status
  if (mythStatus >= 50) {
    boons.push({
      id: 'ancestral_resonance_soul',
      name: 'Resonant Soul',
      description: `Your lineage echoes with power. +${Math.floor(mythStatus * 0.1)} to mental stats.`,
      bonusType: 'stat',
      targetStat: 'int',
      magnitude: Math.floor(mythStatus * 0.1),
      duration: 'permanent',
      deedSource: selectedDeeds[0] || 'legacy_start'
    });
  }
  
  if (mythStatus >= 75) {
    boons.push({
      id: 'ancestral_warrior_strength',
      name: 'Warrior\'s Inheritance',
      description: 'Battle-forged lineage grants martial prowess. +15% critical chance.',
      bonusType: 'ability',
      magnitude: 0.15,
      duration: 'permanent',
      deedSource: selectedDeeds[1] || 'legacy_combat'
    });
  }
  
  if (mythStatus >= 90) {
    boons.push({
      id: 'ancestral_legendary_echo',
      name: 'Legendary Resonance',
      description: 'Your bloodline has shaped epochs. +20% to all faction reputation gains.',
      bonusType: 'special',
      magnitude: 0.20,
      duration: 'permanent',
      deedSource: selectedDeeds[2] || 'legend_maker'
    });
  }
  
  return boons;
}

/**
 * Deed Selection Panel - permite canonizing top 3-5 deeds
 */
function DeedSelectionPanel({
  deeds,
  selectedDeeds,
  onToggleDeed,
  mythStatus
}: {
  deeds: string[];
  selectedDeeds: Set<string>;
  onToggleDeed: (deedId: string) => void;
  mythStatus: number;
}) {
  const maxDeeds = Math.min(5, Math.floor(mythStatus / 20) + 3);
  const deedRarity = (deedIdIdx: number): 'common' | 'uncommon' | 'rare' | 'legendary' => {
    if (deedIdIdx === 0) return 'legendary';
    if (deedIdIdx <= 2) return 'rare';
    if (deedIdIdx <= 4) return 'uncommon';
    return 'common';
  };
  
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>📜 Canonize Grand Deeds</h2>
      <p style={styles.panelSubtitle}>Select up to {maxDeeds} deeds to be remembered by your lineage</p>
      
      <div style={styles.deedGrid}>
        {deeds.map((deed, idx) => {
          const isSelected = selectedDeeds.has(deed);
          const rarity = deedRarity(idx);
          const rarityColor = getRarityColor(rarity);
          
          return (
            <div
              key={deed}
              style={{
                ...styles.deedCard,
                backgroundColor: isSelected ? rarityColor.dark : '#2d3748',
                borderColor: isSelected ? rarityColor.light : '#4a5568',
                borderWidth: '2px',
                cursor: selectedDeeds.size < maxDeeds || isSelected ? 'pointer' : 'not-allowed',
                opacity: selectedDeeds.size < maxDeeds || isSelected ? 1 : 0.6,
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                if (selectedDeeds.size < maxDeeds || isSelected) {
                  onToggleDeed(deed);
                }
              }}
            >
              <div style={{ ...styles.deedName, color: rarityColor.light }}>
                {isSelected && '✓ '}{deed.slice(0, 30)}...
              </div>
              <div style={styles.deedRarity}>{rarity.toUpperCase()}</div>
            </div>
          );
        })}
      </div>
      
      <div style={styles.panelFooter}>
        {selectedDeeds.size}/{maxDeeds} deeds selected
      </div>
    </div>
  );
}

/**
 * Heirloom Vault Panel - select 1 unique item to pass forward
 */
function HeirloomVaultPanel({
  items,
  selectedHeirloom,
  onSelectHeirloom
}: {
  items: Array<{ itemId: string; name?: string; rarity?: string }>;
  selectedHeirloom?: string;
  onSelectHeirloom: (itemId: string) => void;
}) {
  if (!items.length) {
    return (
      <div style={styles.panel}>
        <h2 style={styles.panelTitle}>💎 Heirloom Vault</h2>
        <p style={styles.panelSubtitle}>Pass forward one precious item to your heir</p>
        <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0' }}>
          No items in your collection yet. Gather artifacts in your journey to unlock this feature.
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>💎 Heirloom Vault</h2>
      <p style={styles.panelSubtitle}>Select 1 precious item to pass to your heir</p>
      
      <div style={styles.heirloomGrid}>
        {items.map((item) => {
          const isSelected = selectedHeirloom === item.itemId;
          const rarityColor = getRarityColor(item.rarity || 'common');
          
          return (
            <div
              key={item.itemId}
              style={{
                ...styles.heirloomCard,
                backgroundColor: isSelected ? rarityColor.dark : '#2d3748',
                borderColor: isSelected ? rarityColor.light : '#4a5568',
                borderWidth: '3px',
                cursor: 'pointer',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => onSelectHeirloom(item.itemId)}
            >
              <div style={{ color: rarityColor.light, fontSize: '18px', marginBottom: '8px' }}>
                {isSelected ? '★' : '○'} {item.name || item.itemId}
              </div>
              <div style={{ fontSize: '12px', color: rarityColor.light }}>
                {(item.rarity || 'common').toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={styles.panelFooter}>
        {selectedHeirloom ? '✓ Heirloom selected' : 'No heirloom selected (optional)'}
      </div>
    </div>
  );
}

/**
 * Blessing Preview - Show calculated ancestral boons
 */
function BlessingPreviewPanel({
  boons,
  blights,
  generationalParadox
}: {
  boons: AncestralBoon[];
  blights: AncestralBlight[];
  generationalParadox?: number;
}) {
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>✨ Ancestral Blessings & Curses</h2>
      <p style={styles.panelSubtitle}>Your heir will inherit these gifts and burdens</p>
      
      {/* Blessings */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#fbbf24', marginBottom: '12px' }}>BLESSINGS</h3>
        {boons.length > 0 ? (
          boons.map((boon) => (
            <div
              key={boon.id}
              style={{
                ...styles.blessingCard,
                borderLeft: '4px solid #fbbf24',
                backgroundColor: '#3f3a32'
              }}
            >
              <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>{boon.name}</div>
              <div style={{ fontSize: '13px', color: '#cbd5e0', marginTop: '4px' }}>
                {boon.description}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#a0aec0', fontSize: '13px' }}>
            No ancestral blessings generated. Try increasing your myth status or selecting significant deeds.
          </div>
        )}
      </div>
      
      {/* Curses */}
      {blights.length > 0 && (
        <div>
          <h3 style={{ color: '#ef4444', marginBottom: '12px' }}>CURSES</h3>
          {blights.map((blight) => (
            <div
              key={blight.id}
              style={{
                ...styles.blessingCard,
                borderLeft: '4px solid #ef4444',
                backgroundColor: '#3f2f2f'
              }}
            >
              <div style={{ color: '#ef4444', fontWeight: 'bold' }}>{blight.name}</div>
              <div style={{ fontSize: '13px', color: '#cbd5e0', marginTop: '4px' }}>
                {blight.description}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Paradox Warning */}
      {(generationalParadox ?? 0) >= 150 && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#5d2c2c', borderRadius: '6px', borderLeft: '4px solid #fca5a5' }}>
          <div style={{ color: '#fca5a5', fontWeight: 'bold' }}>⚠️ Temporal Anomalies Detected</div>
          <div style={{ fontSize: '13px', color: '#cbd5e0', marginTop: '4px' }}>
            Generational Paradox: {generationalParadox}. Your heir may experience reality fractures.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Legacy Summary - Show ancestry tree
 */
function LegacySummaryPanel({
  character,
  legacyImpact,
  worldState
}: {
  character: PlayerState;
  legacyImpact: LegacyImpact;
  worldState?: WorldState;
}) {
  const generation = worldState?.epochGenerationIndex ?? 1;
  const bloodlineData = character.bloodlineData;
  
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>🌳 Ancestral Lineage</h2>
      <p style={styles.panelSubtitle}>Your place in the eternal chain</p>
      
      <div style={styles.lineageTree}>
        <div style={styles.lineageCard}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px' }}>
            Generation {generation}: {character.name}
          </div>
          <div style={{ fontSize: '13px', color: '#cbd5e0' }}>
            <div>Myth Status: {legacyImpact.mythStatus}</div>
            <div>Deeds: {legacyImpact.deeds.length}</div>
            <div>Epochs Lived: {legacyImpact.epochsLived}</div>
          </div>
        </div>
        
        {/* Show ancestor chain if available */}
        {bloodlineData?.canonicalName && (
          <div style={{ marginTop: '20px', paddingLeft: '20px', borderLeft: '2px solid #4a5568' }}>
            <div style={{ color: '#a0aec0', marginBottom: '12px', fontSize: '13px' }}>Previous Generation:</div>
            <div style={styles.ancestorCard}>
              <div style={{ color: '#60a5fa', fontWeight: 'bold' }}>
                Generation {generation - 1}: {bloodlineData.canonicalName}
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e0', marginTop: '4px' }}>
                Inherited Perks: {bloodlineData.inheritedPerks?.join(', ') || 'None'}
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e0', marginTop: '2px' }}>
                Myth Status: {bloodlineData.mythStatus}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Final confirmation screen with ritual animation
 */
function FinalConfirmationPanel({
  character,
  confirmationStep,
  onConfirm,
  onCancel
}: {
  character: PlayerState;
  confirmationStep: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dissolvingText = confirmationStep === 2
    ? `${character.name} dissolves into the fabric of legend...`
    : `Ready to ascend as ${character.name}?`;
  
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>🔮 The Final Ascension</h2>
      
      {/* Ritual animation effect */}
      {confirmationStep >= 1 && (
        <div
          style={{
            ...styles.ritualAnimation,
            animation: confirmationStep === 2 ? 'spiritDissolve 3s ease-in forwards' : 'spiritRise 2s ease-out forwards'
          }}
        >
          💫
        </div>
      )}
      
      <p style={{ ...styles.panelSubtitle, marginTop: '20px' }}>
        {dissolvingText}
      </p>
      
      {confirmationStep === 0 && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#cbd5e0', fontSize: '13px', marginBottom: '16px' }}>
            This action will end your current incarnation and begin the next generation.
            Your legacy will be passed forward to your heir.
          </p>
          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.buttonPrimary }}
              onClick={() => onConfirm()}
            >
              ✓ Accept Destiny
            </button>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => onCancel()}
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      )}
      
      {confirmationStep === 1 && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#fbbf24', fontSize: '13px', marginBottom: '16px' }}>
            Soul ascending... preparing next incarnation...
          </p>
        </div>
      )}
      
      {confirmationStep === 2 && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#a78bfa', fontSize: '13px' }}>
            New generation awakening with your legacy...
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main Ascension Protocol Component
 */
export function AscensionProtocolView(props: AscensionProtocolProps) {
  const {
    character,
    legacyImpact,
    generationalParadox = 0,
    allDeeds = [],
    worldState,
    onConfirmAscension,
    onCancelAscension,
    isDeveloperMode = false
  } = props;
  
  const [panelState, setPanelState] = useState<PanelState>({
    activePanel: 'deeds',
    selectedDeeds: new Set(),
    selectedHeirloom: undefined,
    showAnimation: false,
    confirmationStep: 0
  });
  
  // Calculate ancestral boons based on selections
  const calculatedBoons = useMemo(
    () => calculateAncestralBoons(
      legacyImpact.mythStatus,
      Array.from(panelState.selectedDeeds),
      legacyImpact.bloodlineOrigin
    ),
    [panelState.selectedDeeds, legacyImpact.mythStatus, legacyImpact.bloodlineOrigin]
  );
  
  // Panel navigation
  const panels: (typeof panelState.activePanel)[] = ['deeds', 'heirloom', 'blessings', 'legacy', 'ritual', 'confirm'];
  const currentPanelIndex = panels.indexOf(panelState.activePanel);
  
  const goToPanel = (panel: typeof panelState.activePanel) => {
    setPanelState(prev => ({ ...prev, activePanel: panel }));
  };
  
  const nextPanel = () => {
    if (currentPanelIndex < panels.length - 1) {
      goToPanel(panels[currentPanelIndex + 1]);
    }
  };
  
  const previousPanel = () => {
    if (currentPanelIndex > 0) {
      goToPanel(panels[currentPanelIndex - 1]);
    }
  };
  
  const handleConfirmation = () => {
    if (panelState.confirmationStep === 0) {
      setPanelState(prev => ({ ...prev, confirmationStep: 1 }));
      setTimeout(() => {
        setPanelState(prev => ({ ...prev, confirmationStep: 2 }));
        setTimeout(() => {
          onConfirmAscension?.(
            Array.from(panelState.selectedDeeds),
            panelState.selectedHeirloom
          );
        }, 2000);
      }, 2000);
    }
  };
  
  const handleCancel = () => {
    if (panelState.confirmationStep === 0) {
      onCancelAscension?.();
    }
  };
  
  // Render active panel
  const renderPanel = () => {
    switch (panelState.activePanel) {
      case 'deeds':
        return (
          <DeedSelectionPanel
            deeds={allDeeds}
            selectedDeeds={panelState.selectedDeeds}
            onToggleDeed={(deedId) => {
              const newDeeds = new Set(panelState.selectedDeeds);
              if (newDeeds.has(deedId)) {
                newDeeds.delete(deedId);
              } else {
                newDeeds.add(deedId);
              }
              setPanelState(prev => ({ ...prev, selectedDeeds: newDeeds }));
            }}
            mythStatus={legacyImpact.mythStatus}
          />
        );
      
      case 'heirloom':
        return (
          <HeirloomVaultPanel
            items={character.inventory?.map((item, idx) => ({
              itemId: (item as any).itemName || `item_${idx}`,
              name: (item as any).itemName || (item as any).name || `Item ${idx}`,
              rarity: (item as any).rarity || 'common'
            })) || []}
            selectedHeirloom={panelState.selectedHeirloom}
            onSelectHeirloom={(itemId) => {
              setPanelState(prev => ({
                ...prev,
                selectedHeirloom: prev.selectedHeirloom === itemId ? undefined : itemId
              }));
            }}
          />
        );
      
      case 'blessings':
        return (
          <BlessingPreviewPanel
            boons={calculatedBoons}
            blights={legacyImpact.ancestralBlights || []}
            generationalParadox={generationalParadox}
          />
        );
      
      case 'legacy':
        return (
          <LegacySummaryPanel
            character={character}
            legacyImpact={legacyImpact}
            worldState={worldState}
          />
        );
      
      case 'ritual':
      case 'confirm':
        return (
          <FinalConfirmationPanel
            character={character}
            confirmationStep={panelState.confirmationStep}
            onConfirm={handleConfirmation}
            onCancel={handleCancel}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>✨ THE ASCENSION PROTOCOL ✨</h1>
          <p style={styles.subtitle}>Prepare your legacy for the next generation</p>
        </div>
        
        {/* Panel indicator */}
        <div style={styles.panelIndicator}>
          {panels.map((panel, idx) => (
            <div
              key={panel}
              style={{
                ...styles.indicatorDot,
                backgroundColor: idx === currentPanelIndex ? '#fbbf24' : idx < currentPanelIndex ? '#4ade80' : '#4a5568',
                cursor: 'pointer'
              }}
              onClick={() => idx <= currentPanelIndex && goToPanel(panel)}
              title={panel}
            />
          ))}
        </div>
        
        {/* Active Panel */}
        {renderPanel()}
        
        {/* Navigation buttons */}
        {panelState.activePanel !== 'confirm' || panelState.confirmationStep === 0 ? (
          <div style={styles.navButtons}>
            {currentPanelIndex > 0 && (
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={previousPanel}
              >
                ← Previous
              </button>
            )}
            
            {currentPanelIndex < panels.length - 1 ? (
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={nextPanel}
              >
                Next →
              </button>
            ) : null}
          </div>
        ) : null}
        
        {isDeveloperMode && (
          <div style={styles.devInfo}>
            <small>
              Dev: Panel={panelState.activePanel} | Deeds={panelState.selectedDeeds.size} | 
              Heirloom={panelState.selectedHeirloom ? '✓' : '✗'} | Paradox={generationalParadox}
            </small>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spiritRise {
          0% {
            opacity: 0;
            transform: translateY(100px) scale(0.5);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes spiritDissolve {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(0);
            filter: blur(20px);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Get color for rarity tier
 */
function getRarityColor(rarity?: string): { light: string; dark: string; text: string } {
  switch (rarity) {
    case 'legendary':
      return { light: '#fbbf24', dark: '#78350f', text: '#fef3c7' };
    case 'epic':
    case 'rare':
      return { light: '#a78bfa', dark: '#3f0f63', text: '#ede9fe' };
    case 'uncommon':
      return { light: '#60a5fa', dark: '#0c2d48', text: '#dbeafe' };
    default:
      return { light: '#6b7280', dark: '#1f2937', text: '#e5e7eb' };
  }
}

/**
 * Styles (extracted to avoid repeated object allocation)
 */
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    fontFamily: 'Inter, sans-serif'
  },
  
  container: {
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    backgroundColor: '#1a202c',
    borderRadius: '12px',
    border: '2px solid #4a5568',
    padding: '32px',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
  },
  
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px'
  },
  
  title: {
    color: '#fbbf24',
    fontSize: '32px',
    marginBottom: '8px',
    letterSpacing: '2px',
    textShadow: '0 0 20px rgba(251, 191, 36, 0.3)'
  },
  
  subtitle: {
    color: '#cbd5e0',
    fontSize: '14px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const
  },
  
  panelIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px'
  },
  
  indicatorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    transition: 'all 0.3s ease'
  },
  
  panel: {
    marginBottom: '24px'
  },
  
  panelTitle: {
    color: '#fbbf24',
    fontSize: '20px',
    marginBottom: '8px',
    letterSpacing: '1px'
  },
  
  panelSubtitle: {
    color: '#a0aec0',
    fontSize: '13px',
    marginBottom: '16px'
  },
  
  panelFooter: {
    color: '#718096',
    fontSize: '12px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #4a5568'
  },
  
  deedGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '16px'
  },
  
  deedCard: {
    padding: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
    borderWidth: '2px'
  },
  
  deedName: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    marginBottom: '8px'
  },
  
  deedRarity: {
    color: '#718096',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const
  },
  
  heirloomGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '16px'
  },
  
  heirloomCard: {
    padding: '16px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
    borderWidth: '2px'
  },
  
  blessingCard: {
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '12px',
    backgroundColor: '#2d3748'
  },
  
  lineageTree: {
    backgroundColor: '#2d3748',
    borderRadius: '8px',
    padding: '16px'
  },
  
  lineageCard: {
    padding: '12px',
    backgroundColor: '#1a202c',
    borderRadius: '6px',
    borderLeft: '4px solid #60a5fa'
  },
  
  ancestorCard: {
    padding: '12px',
    backgroundColor: '#2d3748',
    borderRadius: '6px',
    marginBottom: '12px',
    borderLeft: '3px solid #4a7c59'
  },
  
  ritualAnimation: {
    fontSize: '80px',
    textAlign: 'center' as const,
    marginBottom: '20px'
  },
  
  navButtons: {
    display: 'flex' as const,
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '20px'
  },
  
  button: {
    padding: '12px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    letterSpacing: '1px',
    transition: 'all 0.2s ease'
  },
  
  buttonPrimary: {
    backgroundColor: '#fbbf24',
    color: '#1a202c'
  },
  
  buttonSecondary: {
    backgroundColor: '#4a5568',
    color: '#e2e8f0'
  },
  
  buttonGroup: {
    display: 'flex' as const,
    gap: '12px',
    justifyContent: 'center'
  },
  
  devInfo: {
    marginTop: '16px',
    padding: '8px',
    backgroundColor: '#2d3748',
    borderRadius: '4px',
    color: '#718096'
  }
};

export default AscensionProtocolView;
